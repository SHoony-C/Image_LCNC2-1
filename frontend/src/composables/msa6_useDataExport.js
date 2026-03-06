/**
 * msa6_useDataExport.js
 * CSV download, save with table name, measurement image saving.
 */
import { ref } from 'vue';

export function useDataExport(deps) {
  // deps: { filteredMeasurements, segmentedMeasurements, localMeasurements, defectMeasurements,
  //          measurementMode, isReversed, currentAverage, currentStandardDeviation, currentThreeSigma,
  //          scaleMethod, scaleBarUnit, magnification, manualScaleBar, scaleBarValue,
  //          canvasRef, sourceImageRef, referenceLines, referenceLineColor,
  //          internalInputImageUrl, inputImageUrl, isShowingInputImage,
  //          showNotification, showTableSelectorPopup, drawMeasurementsOnCanvas }

  const isSaving = ref(false);

  function downloadCSV() {
    if (deps.filteredMeasurements.value.length === 0) {
      deps.showNotification('다운로드할 측정 데이터가 없습니다.', 'warning');
      return;
    }

    const headers = ['Item ID', 'Sub ID', '값'];

    const csvData = deps.filteredMeasurements.value.map((segment) => [
      segment.itemId,
      segment.subItemId,
      segment.value?.toFixed(2) || '0.00',
    ]);

    const currentArea = deps.isReversed.value ? '어두운 영역' : '밝은 영역';
    const statsData = [
      ['', '', ''],
      ['통계 정보', '', ''],
      ['영역', '', currentArea],
      ['평균', '', deps.currentAverage.value.toFixed(2)],
      ['표준편차', '', deps.currentStandardDeviation.value.toFixed(2)],
      ['3σ', '', deps.currentThreeSigma.value.toFixed(2)],
      ['총 측정 수', '', deps.filteredMeasurements.value.length.toString()],
    ];

    const csvContent = [
      headers.join(','),
      ...csvData.map((row) => row.join(',')),
      ...statsData.map((row) => row.join(',')),
    ].join('\n');

    const now = new Date();
    const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `measurement_results_${timestamp}.csv`;

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    deps.showNotification('CSV 파일이 다운로드되었습니다.', 'success');
  }

  async function saveWithTableName(selectedTable) {
    console.log(222);

    try {
      isSaving.value = true;

      let measurementsToSave;
      let isDefectMode = false;

      if (deps.measurementMode.value === 'defect' && deps.defectMeasurements.value && deps.defectMeasurements.value.length > 0) {
        measurementsToSave = deps.defectMeasurements.value;
        isDefectMode = true;
      } else {
        let allMeasurements = deps.segmentedMeasurements.value.length > 0
          ? deps.segmentedMeasurements.value
          : deps.localMeasurements.value;

        measurementsToSave = allMeasurements.filter((measurement) => {
          if (measurement.isTotal) return false;
          return deps.isReversed.value ? !measurement.isBright : measurement.isBright;
        });

        console.log('[saveWithTableName] Data source:', deps.segmentedMeasurements.value.length > 0 ? 'segmentedMeasurements' : 'localMeasurements');
        console.log('[saveWithTableName] Mode:', deps.isReversed.value ? 'dark area' : 'bright area');
        console.log('[saveWithTableName] Save count:', measurementsToSave.length);
      }

      if (!measurementsToSave || measurementsToSave.length === 0) {
        deps.showNotification('저장할 측정 결과가 없습니다.', 'error');
        return;
      }

      const userInfo = JSON.parse(localStorage.getItem('user') || '{}');
      const userName = userInfo.username || '';

      if (!userName) {
        deps.showNotification('사용자 정보를 찾을 수 없습니다.', 'error');
        return;
      }

      let processedMeasurements;

      if (isDefectMode) {
        processedMeasurements = measurementsToSave.map((defect, index) => ({
          itemId: defect.itemId || `defect_${index + 1}`,
          subItemId: defect.subItemId || `d${index + 1}`,
          value: parseFloat(defect.areaScaled) || 0,
          majorAxis: parseFloat(defect.majorAxisScaled) || 0,
          minorAxis: parseFloat(defect.minorAxisScaled) || 0,
          area: parseFloat(defect.areaScaled) || 0,
          distortion: parseFloat(defect.distortion) || 0,
          striation: parseFloat(defect.striation) || 0,
          description: defect.description || '',
          brightness: defect.brightness || 0,
          isBright: defect.isBright || false,
          isDistorted: defect.isDistorted || false,
          isStriated: defect.isStriated || false,
        }));
      } else {
        processedMeasurements = measurementsToSave.map((measurement, index) => ({
          itemId: measurement.itemId || `item_${index + 1}`,
          subItemId: measurement.subItemId || `sub_${index + 1}`,
          value: parseFloat(measurement.value) || 0,
        }));
      }

      const requestData = {
        table_name: selectedTable.table_name,
        username: userName,
        lot_wafer: selectedTable.lot_wafer || '',
        measurements: processedMeasurements,
        measurement_type: isDefectMode ? 'defect' : 'measurement',
      };

      const response = await fetch('http://localhost:8000/api/msa6/save-with-table-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();

      if (result.status !== 'success') {
        if (response.status === 403) {
          deps.showNotification(result.message || '해당 테이블에 대한 저장 권한이 없습니다.', 'error');
          return;
        }
        throw new Error(result.message || '저장 실패');
      }

      await saveMeasurementImages(selectedTable, isDefectMode);

      const dataType = isDefectMode ? '불량감지' : '측정';
      deps.showNotification(`${dataType} 결과가 '${selectedTable.table_name}' 테이블에 저장되었습니다.`, 'success');
      deps.showTableSelectorPopup.value = false;
    } catch (error) {
      console.error('[saveWithTableName] Error:', error);
      deps.showNotification('측정 결과 저장 중 오류가 발생했습니다.', 'error');
    } finally {
      isSaving.value = false;
    }
  }

  async function saveMeasurementImages(selectedTable, isDefectMode) {
    try {
      console.log('[saveMeasurementImages] Image save start');

      const FIXED_WIDTH = 1920;
      const FIXED_HEIGHT = 1080;

      const canvas = deps.canvasRef.value;
      if (!canvas) {
        console.error('[saveMeasurementImages] Canvas not found');
        return;
      }

      const afterImageDataUrl = await createFixedSizeImage(canvas, FIXED_WIDTH, FIXED_HEIGHT);

      let beforeImageDataUrl = null;
      const originalIsShowingInputImage = deps.isShowingInputImage.value;

      try {
        if (!deps.isShowingInputImage.value && (deps.internalInputImageUrl.value || deps.inputImageUrl.value)) {
          deps.isShowingInputImage.value = true;
          await deps.nextTickFn();
          await new Promise((resolve) => setTimeout(resolve, 100));
          beforeImageDataUrl = await createFixedSizeImage(canvas, FIXED_WIDTH, FIXED_HEIGHT);
        } else if (deps.isShowingInputImage.value) {
          beforeImageDataUrl = await createFixedSizeImage(canvas, FIXED_WIDTH, FIXED_HEIGHT);
        } else {
          console.warn('[saveMeasurementImages] No before image, using after image');
          beforeImageDataUrl = afterImageDataUrl;
        }
      } finally {
        if (deps.isShowingInputImage.value !== originalIsShowingInputImage) {
          deps.isShowingInputImage.value = originalIsShowingInputImage;
          await deps.nextTickFn();
        }
      }

      const imageData = {
        before_image: beforeImageDataUrl,
        after_image: afterImageDataUrl,
        measurement_type: isDefectMode ? 'defect' : 'measurement',
        table_name: selectedTable.table_name,
        lot_wafer: selectedTable.lot_wafer || 'unknown',
        title: `${selectedTable.lot_wafer || 'unknown'}_${isDefectMode ? 'defect' : 'measurement'}_${new Date().toISOString().slice(0, 10)}`,
      };

      const response = await fetch('http://localhost:8000/api/external_storage/save-measurement-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(imageData),
      });

      const result = await response.json();

      if (result.status === 'success') {
        console.log('[saveMeasurementImages] Image save success:', result);
      } else {
        console.error('[saveMeasurementImages] Image save failed:', result);
      }
    } catch (error) {
      console.error('[saveMeasurementImages] Error:', error);
    }
  }

  async function createFixedSizeImage(sourceCanvas, width, height) {
    return new Promise((resolve, reject) => {
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');

      tempCanvas.width = width;
      tempCanvas.height = height;

      tempCtx.drawImage(sourceCanvas, 0, 0, width, height);

      tempCanvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Image conversion failed'));
          return;
        }

        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      }, 'image/png');
    });
  }

  async function convertImageToFixedSize(imageUrl, width, height) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        tempCanvas.width = width;
        tempCanvas.height = height;
        tempCtx.drawImage(img, 0, 0, width, height);

        tempCanvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Image conversion failed'));
            return;
          }

          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        }, 'image/png');
      };

      img.onerror = () => reject(new Error('Image load failed'));
      img.src = imageUrl;
    });
  }

  async function createImageWithMeasurements(imageUrl, width, height) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        tempCanvas.width = width;
        tempCanvas.height = height;
        tempCtx.drawImage(img, 0, 0, width, height);

        deps.drawMeasurementsOnCanvas(tempCtx, width, height);

        tempCanvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Image conversion failed'));
            return;
          }

          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        }, 'image/png');
      };

      img.onerror = () => reject(new Error('Image load failed'));
      img.src = imageUrl;
    });
  }

  return {
    isSaving,
    downloadCSV,
    saveWithTableName,
    saveMeasurementImages,
    createFixedSizeImage,
    convertImageToFixedSize,
    createImageWithMeasurements,
  };
}
