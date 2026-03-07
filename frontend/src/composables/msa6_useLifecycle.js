import { nextTick, getCurrentInstance } from 'vue'
import {
  doLinesIntersect, getPointToLineDistance,
} from '@/composables/msa6_useGeometry.js'
import { useWatchers } from '@/composables/msa6_useWatchers.js'

/**
 * Handlers and component interface for msa6_image_popup1.
 * Delegates watchers/lifecycle to useWatchers.
 */
export function useLifecycle(deps) {
  const {
    props, canvas, container, sourceImage,
    ctx, image, imageData, scalebarManager, initialLoadDone,
    loadImage, updateCanvasSize, onWindowResize, cleanupImageUrls,
    initScalebarManager, render,
    showNotification,
    isShowingInputImage, internalInputImageUrl, outputImageUrl,
    scaleMethod, magnification, scaleBarValue, scaleBarUnit,
    scaleBarDetected, scaleBarMeasurement, isDrawingScaleBar,
    manualScaleBar, manualScaleBarSet,
    detectScaleBar, scalebarManagerRef, scaleBarDeps,
    brightnessThreshold, isFKeyPressed, currentBrightness, currentMousePos,
    updateBrightnessAtPosition, updateMagnifier, calculateBrightness,
    isMeasuring, segmentedMeasurements, localMeasurements,
    deleteStart, deleteEnd,
    updateAllMeasurements, initializeMeasurements, clearMeasurements,
    emitMeasurementsUpdate, measurementDeps, getLocalPos,
    defectMeasurements, clearDefectMeasurements,
    selectedRows, selectedMeasurement, selectedDefects,
    referenceLines,
    addToHistory,
    handleKeyDown, handleKeyUp,
    isVisible, openPopup, closePopup,
    pendingMeasurementMode,
    measurementMode, isReversed,
  } = deps

  // =====================
  // deleteMeasurementsInPath
  // =====================
  function deleteMeasurementsInPath() {
    try {
      if (!deleteStart.value || !deleteEnd.value) return

      let deletedCount = 0
      addToHistory('delete', null)

      const initialSegCount = segmentedMeasurements.value.length
      segmentedMeasurements.value = segmentedMeasurements.value.filter((segment) => {
        return !doLinesIntersect(deleteStart.value, deleteEnd.value, segment.start, segment.end)
      })
      deletedCount += initialSegCount - segmentedMeasurements.value.length

      const initialRefCount = referenceLines.value.length
      referenceLines.value = referenceLines.value.filter((refLine) => {
        return !doLinesIntersect(deleteStart.value, deleteEnd.value, refLine.start, refLine.end)
      })
      deletedCount += initialRefCount - referenceLines.value.length

      const initialDefCount = defectMeasurements.value.length
      defectMeasurements.value = defectMeasurements.value.filter((defect) => {
        if (defect.center) {
          const distance = getPointToLineDistance(defect.center, deleteStart.value, deleteEnd.value)
          return distance > 15
        }
        return true
      })
      deletedCount += initialDefCount - defectMeasurements.value.length

      selectedRows.value = []
      selectedMeasurement.value = null
      selectedDefects.value = []
      emitMeasurementsUpdate()

      if (deletedCount > 0) {
        showNotification(`${deletedCount}개의 측정 결과가 삭제되었습니다.`, 'success')
      } else {
        showNotification('삭제할 측정 결과를 찾을 수 없습니다.', 'info')
      }
    } catch (error) {
      console.error('[deleteMeasurementsInPath] Error:', error)
      showNotification('측정값 삭제 중 오류가 발생했습니다.', 'error')
    }
  }

  measurementDeps.deleteMeasurementsInPath = deleteMeasurementsInPath

  // =====================
  // Mouse / canvas handlers
  // =====================
  function handleMouseMove(e) {
    if (!canvas.value) return
    const rect = canvas.value.getBoundingClientRect()
    currentMousePos.x = e.clientX - rect.left
    currentMousePos.y = e.clientY - rect.top

    if (isFKeyPressed.value) {
      updateBrightnessAtPosition(e)
      updateMagnifier(e)
    }
  }

  function handleCanvasClick(e) {
    if (!canvas.value) return
    if (isMeasuring.value) return
    if (!isFKeyPressed.value) return

    const pos = getLocalPos(e)
    const brightness = calculateBrightness(pos.x, pos.y)
    brightnessThreshold.value = brightness
    showNotification(`밝기 임계값이 ${brightness}로 설정되었습니다.`, 'info')
    currentBrightness.value = brightness
  }

  // =====================
  // MSA5 event handlers
  // =====================
  function handleMSA5ImageProcessed(event) {
    try {
      const data = event.detail
      if (data && data.outputImageUrl) outputImageUrl.value = data.outputImageUrl
      if (data && data.inputImageUrl) internalInputImageUrl.value = data.inputImageUrl
    } catch (error) {
      console.error('[handleMSA5ImageProcessed] Error:', error)
    }
  }

  function handleMSA5ProcessStart(event) {
    try {
      const data = event.detail
      if (data && data.action === 'clear_measurements') {
        clearMeasurements()
        clearDefectMeasurements()
        manualScaleBar.value = null
        manualScaleBarSet.value = false
        scaleBarDetected.value = false
        scaleBarMeasurement.value = null
        isDrawingScaleBar.value = false
        scaleBarValue.value = 500
        scaleBarUnit.value = 'nm'
        if (scalebarManager.value) {
          try { scalebarManager.value.clearScalebarSettings() }
          catch (err) { console.error('[handleMSA5ProcessStart] Scalebar manager clear error:', err) }
        }
        render()
      }
    } catch (error) {
      console.error('[handleMSA5ProcessStart] Error:', error)
    }
  }

  // =====================
  // buildComponentInterface
  // =====================
  function buildComponentInterface() {
    return {
      get image() { return image.value },
      set image(v) { image.value = v },
      get canvas() { return canvas.value },
      get ctx() { return ctx.value },
      set ctx(v) { ctx.value = v },
      get imageData() { return imageData.value },
      set imageData(v) { imageData.value = v },
      get scaleMethod() { return scaleMethod.value },
      set scaleMethod(v) { scaleMethod.value = v },
      get scaleBarValue() { return scaleBarValue.value },
      set scaleBarValue(v) { scaleBarValue.value = v },
      get scaleBarUnit() { return scaleBarUnit.value },
      set scaleBarUnit(v) { scaleBarUnit.value = v },
      get scaleBarDetected() { return scaleBarDetected.value },
      set scaleBarDetected(v) { scaleBarDetected.value = v },
      get scaleBarMeasurement() { return scaleBarMeasurement.value },
      set scaleBarMeasurement(v) { scaleBarMeasurement.value = v },
      get manualScaleBar() { return manualScaleBar.value },
      set manualScaleBar(v) { manualScaleBar.value = v },
      get manualScaleBarSet() { return manualScaleBarSet.value },
      set manualScaleBarSet(v) { manualScaleBarSet.value = v },
      get isDrawingScaleBar() { return isDrawingScaleBar.value },
      set isDrawingScaleBar(v) { isDrawingScaleBar.value = v },
      get magnification() { return magnification.value },
      set magnification(v) { magnification.value = v },
      get measurementMode() { return measurementMode.value },
      set measurementMode(v) { measurementMode.value = v },
      get isVisible() { return isVisible.value },
      set isVisible(v) { isVisible.value = v },
      get showPopup() { return props.showPopup },
      get brightnessThreshold() { return brightnessThreshold.value },
      set brightnessThreshold(v) { brightnessThreshold.value = v },
      get isReversed() { return isReversed.value },
      set isReversed(v) { isReversed.value = v },
      get initialLoadDone() { return initialLoadDone.value },
      set initialLoadDone(v) { initialLoadDone.value = v },
      get pendingMeasurementMode() { return pendingMeasurementMode.value },
      set pendingMeasurementMode(v) { pendingMeasurementMode.value = v },
      $refs: {
        get canvas() { return canvas.value },
        get sourceImage() { return sourceImage.value },
        get container() { return container.value },
      },
      $nextTick: (fn) => nextTick(fn),
      $forceUpdate: () => {
        const instance = getCurrentInstance()
        if (instance) instance.proxy?.$forceUpdate()
      },
      showNotification,
      render,
      scalebarManager: scalebarManager.value,
    }
  }

  // Delegate watchers and lifecycle hooks
  useWatchers({
    props, canvas, container, sourceImage,
    ctx, image, imageData, scalebarManager, initialLoadDone,
    loadImage, onWindowResize, cleanupImageUrls, initScalebarManager,
    showNotification,
    isShowingInputImage, internalInputImageUrl,
    scaleMethod, magnification, scaleBarValue, scaleBarUnit,
    scaleBarDetected, scaleBarMeasurement, isDrawingScaleBar,
    manualScaleBar, manualScaleBarSet,
    scalebarManagerRef, scaleBarDeps,
    updateAllMeasurements, initializeMeasurements,
    handleKeyDown, handleKeyUp,
    handleMSA5ImageProcessed, handleMSA5ProcessStart,
    isVisible, openPopup, closePopup,
    pendingMeasurementMode,
    localMeasurements,
    buildComponentInterface,
  })

  return {
    handleMouseMove,
    handleCanvasClick,
    deleteMeasurementsInPath,
  }
}
