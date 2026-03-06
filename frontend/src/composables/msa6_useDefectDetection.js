/**
 * msa6_useDefectDetection.js
 * Defect detection: sendSelectedAreaToApi, emergencyStop, state management.
 */
import { ref, reactive } from 'vue';
import { DefectDetector } from '@/utils/msa6_defect_detection.js';
import {
  emergencyStopDefectDetection,
  registerDefectDetector,
  resetDefectStopState,
} from '@/utils/msa6_defect_stop.js';

export function useDefectDetection(deps) {
  // deps: { canvasRef, sourceImageRef, ctx, imageData, brightnessThreshold, isReversed,
  //          scaleMethod, scaleBarValue, scaleBarUnit, manualScaleBar, magnification,
  //          scaleBarMeasurement, measurementMode, newItemId, newSubId,
  //          selectedAreaRect, selectedDefects, render, showNotification, forceUpdate }

  const defectMeasurements = ref([]);
  const isDefectDetecting = ref(false);
  const defectDetectionResult = ref(null);
  const isApiSending = ref(false);
  const circleOptions = reactive({
    striation: true,
    distortion: true,
  });
  const selectedAreaRect = ref(null);
  const globalDefectIdCounter = ref(1);

  async function sendSelectedAreaToApi() {
    if (!selectedAreaRect.value) {
      console.error('No selected area');
      alert('먼저 영역을 선택해주세요.');
      return;
    }

    const canvas = deps.canvasRef.value;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!canvas || !ctx) {
      console.error('Canvas not found');
      return;
    }

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const boundingBox = {
      x: Math.min(selectedAreaRect.value.start.x, selectedAreaRect.value.end.x),
      y: Math.min(selectedAreaRect.value.start.y, selectedAreaRect.value.end.y),
      width: Math.abs(selectedAreaRect.value.end.x - selectedAreaRect.value.start.x),
      height: Math.abs(selectedAreaRect.value.end.y - selectedAreaRect.value.start.y),
    };

    try {
      isDefectDetecting.value = true;
      const previousMode = deps.measurementMode.value;
      deps.measurementMode.value = null;

      let scaleBarExclusionArea = null;
      if (deps.scaleMethod.value === 'scaleBar' && deps.manualScaleBar.value) {
        const padding = 20;
        const minX = Math.min(deps.manualScaleBar.value.start.x, deps.manualScaleBar.value.end.x) - padding;
        const maxX = Math.max(deps.manualScaleBar.value.start.x, deps.manualScaleBar.value.end.x) + padding;
        const minY = Math.min(deps.manualScaleBar.value.start.y, deps.manualScaleBar.value.end.y) - padding;
        const maxY = Math.max(deps.manualScaleBar.value.start.y, deps.manualScaleBar.value.end.y) + padding;

        scaleBarExclusionArea = {
          x: Math.max(0, minX),
          y: Math.max(0, minY),
          width: Math.min(canvas.width, maxX) - Math.max(0, minX),
          height: Math.min(canvas.height, maxY) - Math.max(0, minY),
        };
      }

      const detector = new DefectDetector(
        canvas, ctx, imageData,
        deps.brightnessThreshold.value,
        deps.isReversed.value,
        scaleBarExclusionArea,
        deps.sourceImageRef.value?.naturalWidth,
        deps.sourceImageRef.value?.naturalHeight,
        deps.imageData.value,
      );

      registerDefectDetector(detector, { isDefectDetecting, measurementMode: deps.measurementMode });

      const onProgress = () => {};

      const onComplete = (results, error) => {
        isDefectDetecting.value = false;
        deps.measurementMode.value = 'defect';

        if (error) {
          console.error('Defect detection failed:', error);
          alert('불량감지 중 오류가 발생했습니다: ' + error.message);
          return;
        }

        selectedAreaRect.value = null;

        if (!results || results.length === 0) {
          return;
        }

        if (results.length >= 100) {
          const warningMsg = `불량 영역이 ${results.length}개로 매우 많이 감지되었습니다.\n\n밝기 임계값을 조정하거나 더 작은 영역을 선택해보세요.`;
          alert(warningMsg);
        }

        if (!defectMeasurements.value) {
          defectMeasurements.value = [];
        }

        let currentAreaId = 1;
        if (defectMeasurements.value.length > 0) {
          const existingAreaIds = defectMeasurements.value
            .map((item) => item.itemId)
            .filter((id) => id && id.startsWith('defect'))
            .map((id) => parseInt(id.replace('defect', '')) || 0);
          if (existingAreaIds.length > 0) {
            currentAreaId = Math.max(...existingAreaIds) + 1;
          }
        }

        const currentAreaItemId = `defect${currentAreaId}`;
        let subCounter = 1;

        results.forEach((result, index) => {
          const defectId = globalDefectIdCounter.value++;

          const convertPixelToRealUnit = (pixelValue) => {
            if (!pixelValue || isNaN(pixelValue) || pixelValue <= 0) return 0;

            if (deps.scaleMethod.value === 'scaleBar' && deps.manualScaleBar.value && deps.scaleBarValue.value) {
              const scaleBarPixelLength = Math.sqrt(
                Math.pow(deps.manualScaleBar.value.end.x - deps.manualScaleBar.value.start.x, 2) +
                Math.pow(deps.manualScaleBar.value.end.y - deps.manualScaleBar.value.start.y, 2),
              );
              if (!scaleBarPixelLength || isNaN(scaleBarPixelLength) || scaleBarPixelLength <= 0) return pixelValue;
              const pixelToRealRatio = deps.scaleBarValue.value / scaleBarPixelLength;
              const r = pixelValue * pixelToRealRatio;
              return isNaN(r) ? pixelValue : r;
            } else {
              const mag = deps.magnification.value || 500;
              const r = pixelValue / mag;
              return isNaN(r) ? pixelValue : r;
            }
          };

          const safeRadiusX = (result.radiusX && !isNaN(result.radiusX) && result.radiusX > 0) ? result.radiusX : 1;
          const safeRadiusY = (result.radiusY && !isNaN(result.radiusY) && result.radiusY > 0) ? result.radiusY : 1;

          const majorAxisPixels = Math.max(safeRadiusX, safeRadiusY) * 2;
          const minorAxisPixels = Math.min(safeRadiusX, safeRadiusY) * 2;

          let safeArea = result.area;
          if (!safeArea || isNaN(safeArea) || safeArea <= 0) {
            safeArea = Math.PI * safeRadiusX * safeRadiusY;
          }

          const majorAxisScaled = convertPixelToRealUnit(majorAxisPixels);
          const minorAxisScaled = convertPixelToRealUnit(minorAxisPixels);

          let areaScaled;
          if (deps.scaleMethod.value === 'scaleBar' && deps.manualScaleBar.value && deps.scaleBarValue.value) {
            const scaleBarPixelLength = Math.sqrt(
              Math.pow(deps.manualScaleBar.value.end.x - deps.manualScaleBar.value.start.x, 2) +
              Math.pow(deps.manualScaleBar.value.end.y - deps.manualScaleBar.value.start.y, 2),
            );
            if (scaleBarPixelLength && !isNaN(scaleBarPixelLength) && scaleBarPixelLength > 0) {
              const pixelToRealRatio = deps.scaleBarValue.value / scaleBarPixelLength;
              areaScaled = safeArea * (pixelToRealRatio * pixelToRealRatio);
            } else {
              areaScaled = safeArea;
            }
          } else {
            const mag = deps.magnification.value || 500;
            areaScaled = safeArea / (mag * mag);
          }

          const finalMajorAxis = isNaN(majorAxisScaled) ? majorAxisPixels : majorAxisScaled;
          const finalMinorAxis = isNaN(minorAxisScaled) ? minorAxisPixels : minorAxisScaled;
          const finalArea = isNaN(areaScaled) ? safeArea : areaScaled;

          const defectMeasurement = {
            id: defectId,
            itemId: deps.newItemId.value || currentAreaItemId,
            subItemId: deps.newSubId.value || `d${subCounter++}`,
            x: result.x,
            y: result.y,
            width: result.width,
            height: result.height,
            radiusX: result.radiusX,
            radiusY: result.radiusY,
            centerX: result.centerX,
            centerY: result.centerY,
            value: result.area,
            pixelCount: result.pixelCount,
            brightness: result.brightness,
            area: result.area,
            majorAxisScaled: finalMajorAxis,
            minorAxisScaled: finalMinorAxis,
            areaScaled: finalArea,
            isBright: result.brightness > deps.brightnessThreshold.value,
            distortion: result.distortion || 0,
            striation: result.striation || 0,
            isDistorted: (result.distortion || 0) > 30,
            isStriated: (result.striation || 0) > 20,
            description: `불량 ${index + 1} (Distortion: ${result.distortion || 0}, Striation: ${result.striation || 0})`,
            timestamp: new Date().toLocaleString(),
            edgePixels: result.edgePixels || [],
          };

          defectMeasurements.value.push(defectMeasurement);
        });

        deps.forceUpdate();
      };

      await detector.startDetection(boundingBox, onProgress, onComplete);
    } catch (error) {
      isDefectDetecting.value = false;
      deps.measurementMode.value = 'defect';
      console.error('Defect detection failed:', error);
      alert('불량감지 중 오류가 발생했습니다: ' + error.message);
    }
  }

  function emergencyStopDetection() {
    try {
      if (!confirm('불량 감지를 즉시 중단하시겠습니까?\n\n진행 중인 측정 내용이 모두 삭제됩니다.')) {
        return;
      }

      const result = emergencyStopDefectDetection();

      if (result.success) {
        deps.showNotification('불량 감지가 즉시 중단되었습니다.', 'info');
        finalizeEmergencyStop();
      } else {
        forceStopCleanup();
        deps.showNotification(
          result.message || '중단 중 오류가 발생했지만 강제 초기화되었습니다.',
          'warning',
        );
      }

      completeFinalCleanup();
    } catch (error) {
      console.error('Emergency stop error:', error);
      forceStopCleanup();
      completeFinalCleanup();
      deps.showNotification('중단 중 오류가 발생했습니다. 시스템이 초기화되었습니다.', 'error');
    }
  }

  function finalizeEmergencyStop() {
    try {
      isDefectDetecting.value = false;
      defectMeasurements.value = [];
      deps.selectedDefects.value = [];
      defectDetectionResult.value = null;
      deps.measurementMode.value = 'defect';
      selectedAreaRect.value = null;
      deps.isAreaSelectionMode.value = false;
      isApiSending.value = false;

      deps.render();
    } catch (error) {
      console.error('finalizeEmergencyStop error:', error);
    }
  }

  function forceStopCleanup() {
    try {
      isDefectDetecting.value = false;
      defectMeasurements.value = [];
      deps.selectedDefects.value = [];
      defectDetectionResult.value = null;
      deps.measurementMode.value = 'defect';
      selectedAreaRect.value = null;

      resetDefectStopState();

      restoreUIState();
    } catch (error) {
      console.error('forceStopCleanup error:', error);
    }
  }

  function completeFinalCleanup() {
    try {
      isDefectDetecting.value = false;
      isApiSending.value = false;
      defectDetectionResult.value = null;
      deps.measurementMode.value = 'defect';

      restoreUIState();
      deps.render();
    } catch (error) {
      console.error('completeFinalCleanup error:', error);
    }
  }

  function restoreUIState() {
    const buttons = document.querySelectorAll('.option-btn, .start-btn, .reset-btn, .close-btn');
    buttons.forEach((btn) => {
      btn.disabled = false;
      btn.style.pointerEvents = 'auto';
      btn.style.opacity = '1';
    });

    const canvas = deps.canvasRef.value;
    if (canvas) {
      canvas.classList.remove('detecting-disabled');
      canvas.style.pointerEvents = 'auto';
      canvas.style.opacity = '1';
      canvas.style.cursor = 'auto';
    }
  }

  function clearDefectMeasurements() {
    try {
      defectMeasurements.value = [];
      deps.selectedDefects.value = [];
      defectDetectionResult.value = null;
      selectedAreaRect.value = null;
    } catch (error) {
      console.error('[clearDefectMeasurements] Error:', error);
    }
  }

  return {
    defectMeasurements,
    isDefectDetecting,
    defectDetectionResult,
    isApiSending,
    circleOptions,
    selectedAreaRect,
    globalDefectIdCounter,
    sendSelectedAreaToApi,
    emergencyStopDetection,
    finalizeEmergencyStop,
    forceStopCleanup,
    completeFinalCleanup,
    clearDefectMeasurements,
  };
}
