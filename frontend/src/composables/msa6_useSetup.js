import {
  ref, watch, toRef,
  getCurrentInstance,
} from 'vue'

import { useNotification } from '@/composables/msa6_useNotification.js'
import { useReferenceLines } from '@/composables/msa6_useReferenceLines.js'
import { useBrightness } from '@/composables/msa6_useBrightness.js'
import { useScaleBar } from '@/composables/msa6_useScaleBar.js'
import { useCanvas } from '@/composables/msa6_useCanvas.js'
import { useMeasurement } from '@/composables/msa6_useMeasurement.js'
import { useDefectDetection } from '@/composables/msa6_useDefectDetection.js'
import { useImageToggle } from '@/composables/msa6_useImageToggle.js'
import { useInteraction } from '@/composables/msa6_useInteraction.js'

export function useSetup(props, emit, templateRefs) {
  const { canvas, container, sourceImage, magnifierCanvas } = templateRefs

  // Notification
  const { notification, showNotification } = useNotification()

  // Reference Lines
  let render
  const refLinesDeps = { render: () => render() }
  const {
    referenceLines, activeReferenceLine, referenceLineColor,
    showReferenceColorPicker, referenceColorOptions, referenceId,
    selectReferenceColor,
  } = useReferenceLines(refLinesDeps)

  // Image Toggle
  const {
    isShowingInputImage, internalInputImageUrl, outputImageUrl, isToggling,
    currentImageUrl, toggleBeforeAfterImage, copyImageUrl, downloadResultImage,
  } = useImageToggle({
    canvasRef: canvas, sourceImageRef: sourceImage,
    inputImageUrl: toRef(props, 'inputImageUrl'),
    imageUrl: toRef(props, 'imageUrl'),
    showNotification, render: () => render(),
  })

  // Scale Bar
  const scalebarManagerRef = ref(null)
  const measurementModeRef = ref('line')
  const isAreaSelectionModeRef = ref(false)
  const selectedAreaRectRef = ref(null)
  const areaStartRef = ref(null)
  const areaEndRef = ref(null)

  const scaleBarDeps = {
    scalebarManager: scalebarManagerRef, measurementMode: measurementModeRef,
    isAreaSelectionMode: isAreaSelectionModeRef, selectedAreaRect: selectedAreaRectRef,
    areaStart: areaStartRef, areaEnd: areaEndRef,
    render: () => render(), showNotification,
  }
  const {
    scaleMethod, magnification, scaleBarValue, scaleBarUnit,
    scaleBarDetected, scaleBarMeasurement, isDrawingScaleBar,
    manualScaleBar, manualScaleBarSet, pendingMeasurementMode,
    detectScaleBar, toggleScaleBarDrawing, showScaleDetectionFailurePopup,
  } = useScaleBar(scaleBarDeps)

  // Brightness
  let getLocalPos
  const brightnessDeps = {
    canvasRef: canvas, sourceImageRef: sourceImage,
    magnifierCanvasRef: magnifierCanvas, imageData: ref(null),
    showNotification, getLocalPos: (e) => getLocalPos(e),
  }
  const {
    brightnessThreshold, isReversed, isFKeyPressed, showBrightnessTooltip,
    currentBrightness, currentMousePos,
    brightnessTooltipStyle, magnifierStyle,
    calculateBrightness, calculateAverageBrightness,
    updateBrightnessAtPosition, updateMagnifier, toggleReverse,
  } = useBrightness(brightnessDeps)

  // Canvas
  const canvasDeps = {
    canvasRef: canvas, containerRef: container,
    sourceImageRef: sourceImage, magnifierCanvasRef: magnifierCanvas,
    emit, props,
    isMeasuring: ref(false), currentMeasurement: ref(null),
    segmentedMeasurements: ref([]), localMeasurements: ref([]),
    defectMeasurements: ref([]),
    referenceLines, activeReferenceLine, referenceLineColor,
    measurementMode: measurementModeRef, isReversed, brightnessThreshold,
    scaleMethod, scaleBarValue, scaleBarUnit, scaleBarDetected,
    scaleBarMeasurement, magnification, manualScaleBar, manualScaleBarSet,
    isDrawingScaleBar, selectedAreaRect: selectedAreaRectRef,
    areaStart: areaStartRef, areaEnd: areaEndRef,
    areaSelectionStart: ref(null), areaSelectionEnd: ref(null),
    deleteStart: ref(null), deleteEnd: ref(null),
    isDeleteMode: ref(false), isAreaSelectionMode: isAreaSelectionModeRef,
    tempDragLine: ref(null), isToggling, isShowingInputImage,
    internalInputImageUrl, outputImageUrl, showNotification,
    showScaleDetectionFailurePopup, lineCount: ref(5),
  }

  const {
    image, ctx, imageData, scalebarManager, initialLoadDone,
    getLocalPos: _getLocalPos, calculateValue, updateCanvasSize,
    onWindowResize, render: _render, drawMeasurementsOnCanvas,
    loadImage, handleImageLoad, cleanupImageUrls, initScalebarManager,
  } = useCanvas(canvasDeps)

  render = _render
  getLocalPos = _getLocalPos
  brightnessDeps.imageData = imageData
  scalebarManagerRef.value = scalebarManager.value

  // Defect Detection
  const selectedDefectsRef = ref([])
  const defectDeps = {
    canvasRef: canvas, sourceImageRef: sourceImage,
    ctx, imageData, brightnessThreshold, isReversed,
    scaleMethod, scaleBarValue, scaleBarUnit, manualScaleBar,
    magnification, scaleBarMeasurement, measurementMode: measurementModeRef,
    newItemId: ref(''), newSubId: ref(''),
    selectedAreaRect: selectedAreaRectRef, selectedDefects: selectedDefectsRef,
    isAreaSelectionMode: isAreaSelectionModeRef,
    render: () => render(), showNotification,
    forceUpdate: () => {
      const instance = getCurrentInstance()
      if (instance) instance.proxy?.$forceUpdate()
    },
  }
  const {
    defectMeasurements, isDefectDetecting, isApiSending,
    circleOptions, selectedAreaRect: defectSelectedAreaRect,
    globalDefectIdCounter, sendSelectedAreaToApi, emergencyStopDetection,
    clearDefectMeasurements,
  } = useDefectDetection(defectDeps)

  const selectedAreaRect = selectedAreaRectRef
  watch(defectSelectedAreaRect, (v) => { selectedAreaRectRef.value = v })
  watch(selectedAreaRectRef, (v) => { defectSelectedAreaRect.value = v })
  canvasDeps.defectMeasurements = defectMeasurements

  // Measurement
  const measurementDeps = {
    canvasRef: canvas, sourceImageRef: sourceImage,
    ctx, image, imageData,
    getLocalPos: (e) => getLocalPos(e), calculateValue,
    calculateBrightness, calculateAverageBrightness,
    brightnessThreshold, isReversed, scaleMethod, scaleBarDetected,
    scaleBarMeasurement, scaleBarValue, scaleBarUnit, magnification,
    manualScaleBar, manualScaleBarSet,
    referenceLines, activeReferenceLine, referenceLineColor,
    isDrawingScaleBar, pendingMeasurementMode, scalebarManager,
    selectedAreaRect: selectedAreaRectRef, defectMeasurements,
    isDKeyPressed: ref(false),
    tempDragLine: canvasDeps.tempDragLine,
    isDeleteMode: canvasDeps.isDeleteMode,
    deleteStart: canvasDeps.deleteStart, deleteEnd: canvasDeps.deleteEnd,
    circleOptions, showNotification,
    render: () => render(),
    addToHistory: (...args) => addToHistory(...args),
    emit, emitMeasurementsUpdate: () => emitMeasurementsUpdate(),
    lineCount: canvasDeps.lineCount, isDefectDetecting,
    selectedDefects: selectedDefectsRef,
    selectedRows: ref([]), selectedMeasurement: ref(null),
    selectedSegment: ref(null), referenceId,
    undoHistory: ref([]), redoHistory: ref([]),
    deleteMeasurementsInPath: () => {},
  }

  const {
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
  } = useMeasurement(measurementDeps)

  // Wire canvas deps
  canvasDeps.isMeasuring = isMeasuring
  canvasDeps.currentMeasurement = currentMeasurement
  canvasDeps.segmentedMeasurements = segmentedMeasurements
  canvasDeps.localMeasurements = localMeasurements
  canvasDeps.areaSelectionStart = areaSelectionStart
  canvasDeps.areaSelectionEnd = areaSelectionEnd
  canvasDeps.deleteStart = deleteStart
  canvasDeps.deleteEnd = deleteEnd
  canvasDeps.isDeleteMode = isDeleteMode
  canvasDeps.isAreaSelectionMode = isAreaSelectionMode
  canvasDeps.tempDragLine = tempDragLine
  canvasDeps.lineCount = lineCount

  watch(measurementMode, (v) => { measurementModeRef.value = v })
  watch(isAreaSelectionMode, (v) => { isAreaSelectionModeRef.value = v })
  watch(areaStart, (v) => { areaStartRef.value = v })
  watch(areaEnd, (v) => { areaEndRef.value = v })

  // Interaction (history, selection, keyboard, popup, export, lifecycle)
  const interaction = useInteraction({
    props, emit, canvas, container, sourceImage,
    showNotification, render: () => render(),
    getLocalPos: (e) => getLocalPos(e),
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
    image, imageCtx: ctx, imageData, scalebarManager, initialLoadDone,
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
    measurementDeps, canvasDeps, defectDeps,
  })

  return {
    notification, showNotification,
    referenceLineColor, showReferenceColorPicker, referenceColorOptions, selectReferenceColor,
    isShowingInputImage, internalInputImageUrl, outputImageUrl,
    currentImageUrl, toggleBeforeAfterImage, copyImageUrl, downloadResultImage,
    scaleMethod, magnification, scaleBarValue, scaleBarUnit,
    isDrawingScaleBar, detectScaleBar, toggleScaleBarDrawing,
    brightnessThreshold, isReversed, isFKeyPressed, showBrightnessTooltip,
    currentBrightness, brightnessTooltipStyle, magnifierStyle, toggleReverse,
    handleImageLoad,
    measurementMode, lineCount, isDeleteMode, selectedAreaRect,
    filteredMeasurements, currentAverage, currentThreeSigma,
    increaseLineCount, decreaseLineCount, setMode, toggleDeleteMode,
    startMeasurement, updateMeasurement, endMeasurement,
    defectMeasurements, isDefectDetecting, isApiSending,
    circleOptions, sendSelectedAreaToApi, emergencyStopDetection,
    ...interaction,
    render: () => render(),
  }
}
