import { ref, watch, nextTick, toRef } from 'vue'

import { useHistory } from '@/composables/msa6_useHistory.js'
import { useSelection } from '@/composables/msa6_useSelection.js'
import { useKeyboard } from '@/composables/msa6_useKeyboard.js'
import { usePopupState } from '@/composables/msa6_usePopupState.js'
import { useDataExport } from '@/composables/msa6_useDataExport.js'
import { useLifecycle } from '@/composables/msa6_useLifecycle.js'

/**
 * Second half of msa6 setup: history, selection, keyboard, popup, export, lifecycle.
 */
export function useInteraction(ctx) {
  const {
    props, emit, canvas, container, sourceImage,
    // From first half
    showNotification, render, getLocalPos,
    referenceLines, activeReferenceLine, referenceLineColor, referenceId,
    isShowingInputImage, internalInputImageUrl, outputImageUrl,
    currentImageUrl, drawMeasurementsOnCanvas,
    scalebarManagerRef, scaleBarDeps,
    scaleMethod, magnification, scaleBarValue, scaleBarUnit,
    scaleBarDetected, scaleBarMeasurement, isDrawingScaleBar,
    manualScaleBar, manualScaleBarSet, pendingMeasurementMode,
    detectScaleBar,
    brightnessThreshold, isReversed, isFKeyPressed, showBrightnessTooltip,
    currentBrightness, currentMousePos,
    calculateBrightness, calculateAverageBrightness,
    updateBrightnessAtPosition, updateMagnifier,
    image, imageCtx: ctxRef, imageData, scalebarManager, initialLoadDone,
    loadImage, updateCanvasSize, onWindowResize, cleanupImageUrls,
    initScalebarManager,
    selectedAreaRectRef, selectedDefectsRef, measurementModeRef,
    defectMeasurements, isDefectDetecting, isApiSending,
    circleOptions, globalDefectIdCounter,
    sendSelectedAreaToApi, emergencyStopDetection, clearDefectMeasurements,
    defectSelectedAreaRect,
    isMeasuring, currentMeasurement, segmentedMeasurements, localMeasurements,
    measurementMode, nextId, brightSubIdCounter, darkSubIdCounter,
    lineCount, areaStart, areaEnd, areaSelectionStart, areaSelectionEnd,
    isAreaSelectionMode, isDeleteMode, deleteStart, deleteEnd, tempDragLine,
    areaDirection, filteredMeasurements,
    currentAverage, currentStandardDeviation, currentThreeSigma,
    increaseLineCount, decreaseLineCount, setMode, toggleDeleteMode,
    startMeasurement, updateMeasurement, endMeasurement,
    updateAllMeasurements, initializeMeasurements, clearMeasurements,
    emitMeasurementsUpdate,
    measurementDeps, canvasDeps,
  } = ctx

  // History
  const historyDeps = {
    segmentedMeasurements, referenceLines, defectMeasurements, localMeasurements,
    selectedRows: ref([]), selectedMeasurement: ref(null),
    selectedDefects: selectedDefectsRef,
    render: () => render(),
    emitMeasurementsUpdate: () => emitMeasurementsUpdate(),
    showNotification,
  }
  const { undoHistory, redoHistory, addToHistory, undo, redo } = useHistory(historyDeps)
  measurementDeps.undoHistory = undoHistory
  measurementDeps.redoHistory = redoHistory
  measurementDeps.addToHistory = (...args) => addToHistory(...args)

  // Selection
  const {
    selectedRows, selectedDefects, selectedMeasurement, selectedSegment,
    isDragging, dragStartIndex, dragEndIndex, dragStartRow,
    newItemId, newSubId,
    handleRowMouseDown, handleRowMouseEnter, handleRowMouseUp,
    handleDefectMouseDown, handleDefectMouseEnter, handleDefectMouseUp,
    applySelectedIds, deleteSelectedMeasurements, deleteSegment,
  } = useSelection({
    filteredMeasurements, defectMeasurements, segmentedMeasurements,
    localMeasurements, measurementMode,
    render: () => render(), showNotification,
    addToHistory, emitMeasurementsUpdate: () => emitMeasurementsUpdate(),
  })

  historyDeps.selectedRows = selectedRows
  historyDeps.selectedMeasurement = selectedMeasurement
  measurementDeps.selectedRows = selectedRows
  measurementDeps.selectedMeasurement = selectedMeasurement
  measurementDeps.selectedSegment = selectedSegment
  ctx.defectDeps.newItemId = newItemId
  ctx.defectDeps.newSubId = newSubId

  watch(selectedDefects, (v) => { selectedDefectsRef.value = v }, { deep: true })
  watch(selectedDefectsRef, (v) => { selectedDefects.value = v }, { deep: true })

  // Keyboard
  const keyboardDeps = {
    showBrightnessTooltip, isFKeyPressed, showShortcutHelp: ref(false),
    measurementMode, areaDirection, setMode, isDeleteMode,
    isDKeyPressed: ref(false), tempDragLine, isMeasuring,
    selectedRows, selectedDefects, deleteSelectedMeasurements,
    undo, redo, showNotification,
    render: () => render(),
    closePopup: () => closePopup(),
  }
  const { isDKeyPressed, showShortcutHelp, handleKeyDown, handleKeyUp } = useKeyboard(keyboardDeps)
  measurementDeps.isDKeyPressed = isDKeyPressed

  // Popup State
  const {
    isVisible, showResetConfirmPopup, showTableSelectorPopup,
    openPopup, closePopup, showResetConfirmation, cancelReset, confirmReset,
    showTableSelector,
  } = usePopupState({
    emit, imageUrl: toRef(props, 'imageUrl'), showPopup: toRef(props, 'showPopup'),
    currentImageUrl, loadImage, updateCanvasSize, detectScaleBar,
    scaleMethod, scaleBarDetected, internalInputImageUrl, outputImageUrl,
    isShowingInputImage, isMeasuring, currentMeasurement, areaStart, areaEnd,
    selectedAreaRect: selectedAreaRectRef, isDefectDetecting, emergencyStopDetection,
    showShortcutHelp, isFKeyPressed, showBrightnessTooltip, showNotification,
    segmentedMeasurements, defectMeasurements, referenceLines,
    selectedRows, selectedMeasurement, selectedDefects, selectedSegment,
    areaSelectionStart, areaSelectionEnd,
    nextId, brightSubIdCounter, darkSubIdCounter, referenceId,
    globalDefectIdCounter, measurementMode, isDeleteMode, isAreaSelectionMode,
    isDragging, dragStartIndex, dragEndIndex, dragStartRow, tempDragLine,
    render: () => render(),
    emitMeasurementsUpdate: () => emitMeasurementsUpdate(),
    addToHistory, activeReferenceLine, localMeasurements,
    nextTickFn: (fn) => nextTick(fn),
  })

  // Data Export
  const {
    isSaving, downloadCSV, saveWithTableName,
  } = useDataExport({
    filteredMeasurements, segmentedMeasurements, localMeasurements,
    defectMeasurements, measurementMode, isReversed,
    currentAverage, currentStandardDeviation, currentThreeSigma,
    scaleMethod, scaleBarUnit, magnification, manualScaleBar, scaleBarValue,
    canvasRef: canvas, sourceImageRef: sourceImage,
    referenceLines, referenceLineColor,
    internalInputImageUrl, inputImageUrl: toRef(props, 'inputImageUrl'),
    isShowingInputImage, showNotification, showTableSelectorPopup,
    drawMeasurementsOnCanvas, nextTickFn: (fn) => nextTick(fn),
  })

  // Lifecycle, watchers, handlers
  const { handleMouseMove, handleCanvasClick } = useLifecycle({
    props, emit, canvas, container, sourceImage,
    ctx: ctxRef, image, imageData, scalebarManager, initialLoadDone,
    loadImage, updateCanvasSize, onWindowResize, cleanupImageUrls,
    initScalebarManager, render: () => render(),
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
    emitMeasurementsUpdate, measurementDeps,
    getLocalPos: (e) => getLocalPos(e),
    defectMeasurements, clearDefectMeasurements,
    selectedRows, selectedMeasurement, selectedDefects,
    referenceLines,
    addToHistory,
    handleKeyDown, handleKeyUp,
    isVisible, openPopup, closePopup,
    pendingMeasurementMode,
    measurementMode, isReversed,
  })

  return {
    selectedRows, selectedDefects, newItemId, newSubId,
    handleRowMouseDown, handleRowMouseEnter, handleRowMouseUp,
    handleDefectMouseDown, handleDefectMouseEnter, handleDefectMouseUp,
    applySelectedIds, deleteSegment,
    showShortcutHelp,
    isVisible, showResetConfirmPopup, showTableSelectorPopup,
    openPopup, closePopup, showResetConfirmation, cancelReset, confirmReset,
    showTableSelector,
    isSaving, downloadCSV, saveWithTableName,
    handleMouseMove, handleCanvasClick,
    clearMeasurements,
  }
}
