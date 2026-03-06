/**
 * msa6_usePopupState.js
 * Popup visibility, reset confirmation, table selector popup.
 */
import { ref } from 'vue';

export function usePopupState(deps) {
  // deps: { emit, imageUrl (prop), showPopup (prop), currentImageUrl, loadImage,
  //          updateCanvasSize, detectScaleBar, scaleMethod, scaleBarDetected,
  //          internalInputImageUrl, outputImageUrl, isShowingInputImage,
  //          isMeasuring, currentMeasurement, areaStart, areaEnd, selectedAreaRect,
  //          isDefectDetecting, emergencyStopDetection,
  //          showShortcutHelp, isFKeyPressed, showBrightnessTooltip,
  //          showNotification, segmentedMeasurements, defectMeasurements, referenceLines,
  //          selectedRows, selectedMeasurement, selectedDefects, selectedSegment,
  //          areaSelectionStart, areaSelectionEnd, nextId, brightSubIdCounter, darkSubIdCounter,
  //          referenceId, globalDefectIdCounter, measurementMode, isDeleteMode, isAreaSelectionMode,
  //          isDragging, dragStartIndex, dragEndIndex, dragStartRow, tempDragLine,
  //          render, emitMeasurementsUpdate, addToHistory, activeReferenceLine }

  const isVisible = ref(false);
  const showResetConfirmPopup = ref(false);
  const showTableSelectorPopup = ref(false);

  function openPopup(imageUrl = null) {
    try {
      deps.isShowingInputImage.value = false;

      const msa5StartImage = sessionStorage.getItem('msa5_start_image_url');
      const msa5EndImage = sessionStorage.getItem('msa5_end_image_url');

      if (imageUrl) {
        deps.outputImageUrl.value = imageUrl;
      } else if (msa5EndImage) {
        deps.outputImageUrl.value = msa5EndImage;
      }

      if (msa5StartImage && !deps.internalInputImageUrl.value) {
        deps.internalInputImageUrl.value = msa5StartImage;
      }

      isVisible.value = true;
      deps.emit('update:showPopup', true);

      deps.nextTickFn(() => {
        const currentUrl = deps.currentImageUrl.value || deps.imageUrl.value || deps.outputImageUrl.value;
        if (currentUrl) {
          deps.loadImage(currentUrl);
        } else {
          console.warn('[openPopup] No image URL');
        }
        deps.updateCanvasSize();

        if (deps.scaleMethod.value === 'scaleBar' && !deps.scaleBarDetected.value) {
          deps.detectScaleBar();
        }
      });
    } catch (error) {
      console.error('[openPopup] Error:', error);
    }
  }

  function closePopup() {
    try {
      isVisible.value = false;
      deps.emit('update:showPopup', false);
      deps.emit('close');

      deps.isMeasuring.value = false;
      deps.currentMeasurement.value = null;
      deps.areaStart.value = null;
      deps.areaEnd.value = null;
      deps.selectedAreaRect.value = null;

      if (deps.isDefectDetecting.value) {
        deps.emergencyStopDetection();
      }

      deps.showShortcutHelp.value = false;
      deps.isFKeyPressed.value = false;
      deps.showBrightnessTooltip.value = false;
    } catch (error) {
      console.error('[closePopup] Error:', error);
      isVisible.value = false;
      deps.emit('update:showPopup', false);
    }
  }

  function showResetConfirmation() {
    try {
      showResetConfirmPopup.value = true;
    } catch (error) {
      console.error('[showResetConfirmation] Error:', error);
    }
  }

  function cancelReset() {
    try {
      showResetConfirmPopup.value = false;
    } catch (error) {
      console.error('[cancelReset] Error:', error);
    }
  }

  function confirmReset() {
    try {
      deps.addToHistory(
        'reset_all', null,
        JSON.parse(JSON.stringify(deps.segmentedMeasurements.value)),
        JSON.parse(JSON.stringify(deps.referenceLines.value)),
        JSON.parse(JSON.stringify(deps.defectMeasurements.value)),
      );

      deps.segmentedMeasurements.value = [];
      deps.defectMeasurements.value = [];
      deps.referenceLines.value = [];
      deps.activeReferenceLine.value = null;

      deps.selectedRows.value = [];
      deps.selectedMeasurement.value = null;
      deps.selectedSegment.value = null;
      deps.selectedDefects.value = [];
      deps.selectedAreaRect.value = null;

      deps.currentMeasurement.value = null;
      deps.isMeasuring.value = false;
      deps.areaStart.value = null;
      deps.areaEnd.value = null;
      deps.areaSelectionStart.value = null;
      deps.areaSelectionEnd.value = null;

      deps.nextId.value = 1;
      deps.brightSubIdCounter.value = 1;
      deps.darkSubIdCounter.value = 1;
      deps.referenceId.value = 1;
      deps.globalDefectIdCounter.value = 1;

      deps.measurementMode.value = 'line';
      deps.isDeleteMode.value = false;
      deps.isAreaSelectionMode.value = false;

      deps.isDragging.value = false;
      deps.dragStartIndex.value = -1;
      deps.dragEndIndex.value = -1;
      deps.dragStartRow.value = null;
      deps.tempDragLine.value = null;

      showResetConfirmPopup.value = false;

      deps.render();
      deps.emitMeasurementsUpdate();
      deps.showNotification('모든 측정 결과가 초기화되었습니다.', 'success');
    } catch (error) {
      console.error('[confirmReset] Error:', error);
      deps.showNotification('측정 결과 초기화 중 오류가 발생했습니다.', 'error');
    }
  }

  function showTableSelector() {
    try {
      let measurementsToSave;
      let dataType = '';

      if (deps.measurementMode.value === 'defect') {
        measurementsToSave = deps.defectMeasurements.value;
        dataType = '불량감지';
      } else {
        measurementsToSave = deps.localMeasurements.value.length > 0
          ? deps.localMeasurements.value
          : deps.segmentedMeasurements.value;
        dataType = '측정';
      }

      if (!measurementsToSave || measurementsToSave.length === 0) {
        deps.showNotification(`저장할 ${dataType} 결과가 없습니다.`, 'error');
        return;
      }

      showTableSelectorPopup.value = true;
    } catch (error) {
      console.error('[showTableSelector] Error:', error);
      deps.showNotification('테이블 선택 팝업 표시 중 오류가 발생했습니다.', 'error');
    }
  }

  return {
    isVisible,
    showResetConfirmPopup,
    showTableSelectorPopup,
    openPopup,
    closePopup,
    showResetConfirmation,
    cancelReset,
    confirmReset,
    showTableSelector,
  };
}
