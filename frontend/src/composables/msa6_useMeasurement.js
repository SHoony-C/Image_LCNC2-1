/**
 * msa6_useMeasurement.js
 * Measurement start/update/end, mode management, measurement state.
 */
import { ref, computed } from 'vue';
import { createBoundedSegments, createAreaMeasurements } from '@/utils/msa6_measures.js';
import { trimMeasurementBetweenTwoReferences } from '@/utils/msa6_reference_trimmer.js';
import {
  trimMeasurementByReferenceLine,
  trimSingleMeasurementByReferenceLine,
} from '@/utils/msa6_reference_trimmer.js';

export function useMeasurement(deps) {
  // deps: { canvasRef, sourceImageRef, ctx, image, imageData,
  //          getLocalPos, calculateValue, calculateBrightness, calculateAverageBrightness,
  //          brightnessThreshold, isReversed, scaleMethod, scaleBarDetected, scaleBarMeasurement,
  //          scaleBarValue, scaleBarUnit, magnification, manualScaleBar, manualScaleBarSet,
  //          referenceLines, activeReferenceLine, referenceLineColor,
  //          isDrawingScaleBar, pendingMeasurementMode, scalebarManager,
  //          selectedAreaRect, defectMeasurements,
  //          isDKeyPressed, tempDragLine, isDeleteMode, deleteStart, deleteEnd,
  //          circleOptions, showNotification, render, addToHistory,
  //          emit, emitMeasurementsUpdate, lineCount }

  const isMeasuring = ref(false);
  const currentMeasurement = ref(null);
  const segmentedMeasurements = ref([]);
  const localMeasurements = ref([]);
  const measurementMode = ref('line');
  const nextId = ref(1);
  const subItemPrefix = ref('S');
  const brightSubIdCounter = ref(1);
  const darkSubIdCounter = ref(1);
  const lineCount = ref(5);
  const areaStart = ref(null);
  const areaEnd = ref(null);
  const areaSelectionStart = ref(null);
  const areaSelectionEnd = ref(null);
  const isAreaSelectionMode = ref(false);
  const isDeleteMode = ref(false);
  const deleteStart = ref(null);
  const deleteEnd = ref(null);
  const tempDragLine = ref(null);
  const previousMeasurementMode = ref('line');
  const areaDirection = ref('horizontal');
  const selectedArea = ref(null);
  const measurementHistory = ref([]);

  const filteredMeasurements = computed(() => {
    const filtered = segmentedMeasurements.value.filter((segment) =>
      (deps.isReversed.value ? !segment.isBright : segment.isBright) && !segment.isTotal,
    );
    return filtered;
  });

  const currentAverage = computed(() => {
    if (filteredMeasurements.value.length === 0) return 0;
    const sum = filteredMeasurements.value.reduce((total, seg) => total + (seg.value || 0), 0);
    return sum / filteredMeasurements.value.length;
  });

  const currentStandardDeviation = computed(() => {
    if (filteredMeasurements.value.length <= 1) return 0;
    const mean = currentAverage.value;
    const squaredDiffs = filteredMeasurements.value.map((seg) => {
      const diff = (seg.value || 0) - mean;
      return diff * diff;
    });
    const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / filteredMeasurements.value.length;
    return Math.sqrt(variance);
  });

  const currentThreeSigma = computed(() => {
    return currentAverage.value + 3 * currentStandardDeviation.value;
  });

  const averageMeasurementValue = computed(() => {
    if (filteredMeasurements.value.length === 0) return 0;
    const sum = filteredMeasurements.value.reduce((total, seg) => total + (seg.value || 0), 0);
    return sum / filteredMeasurements.value.length;
  });

  function increaseLineCount() {
    if (lineCount.value < 20) lineCount.value++;
  }

  function decreaseLineCount() {
    if (lineCount.value > 2) lineCount.value--;
  }

  function setMode(mode) {
    if (measurementMode.value === 'defect' && mode !== 'defect') {
      deps.defectMeasurements.value = [];
      deps.selectedDefects.value = [];
      deps.selectedAreaRect.value = null;
      isAreaSelectionMode.value = false;
      areaStart.value = null;
      areaEnd.value = null;
    }

    if (isDeleteMode.value) {
      isDeleteMode.value = false;
    }

    if (
      (mode === 'area' || mode === 'area-vertical' || mode === 'area-horizontal' || mode === 'defect') &&
      deps.scaleMethod.value === 'scaleBar' &&
      deps.scalebarManager.value
    ) {
      const { hasValidManualScaleBar } = deps.scalebarManager.value.validateScaleBarSettings();

      if (!hasValidManualScaleBar && !deps.scaleBarDetected.value) {
        deps.pendingMeasurementMode.value = mode;
        deps.showNotification('스케일바를 먼저 설정해주세요.', 'warning');
        deps.isDrawingScaleBar.value = true;
        measurementMode.value = 'line';

        if (mode === 'defect') {
          isAreaSelectionMode.value = false;
          deps.selectedAreaRect.value = null;
          areaStart.value = null;
          areaEnd.value = null;
        }

        deps.render();
        return;
      }
    }

    if (mode === 'area') {
      measurementMode.value = areaDirection.value === 'horizontal' ? 'area-horizontal' : 'area-vertical';
    } else {
      measurementMode.value = mode;
    }

    if (mode === 'defect') {
      isAreaSelectionMode.value = true;
    } else {
      isAreaSelectionMode.value = false;
    }

    isMeasuring.value = false;
    currentMeasurement.value = null;
    areaStart.value = null;
    areaEnd.value = null;

    deps.render();
  }

  function toggleDeleteMode() {
    isDeleteMode.value = !isDeleteMode.value;

    if (isDeleteMode.value) {
      isMeasuring.value = false;
      currentMeasurement.value = null;
      areaStart.value = null;
      areaEnd.value = null;
      isAreaSelectionMode.value = false;
      measurementMode.value = null;
      deps.render();
    }
  }

  function startMeasurement(e) {
    if (deps.isDefectDetecting.value) {
      console.warn('Cannot start measurement during defect detection');
      return;
    }

    if (!deps.canvasRef.value) {
      console.warn('[startMeasurement] Canvas element not found');
      return;
    }

    if (isDeleteMode.value) {
      try {
        const pos = deps.getLocalPos(e);
        if (!pos) return;
        deleteStart.value = { ...pos };
        deleteEnd.value = null;
        isMeasuring.value = true;
        deps.render();
      } catch (error) {
        console.error('[startMeasurement] Error in delete mode:', error);
      }
      return;
    }

    const pos = deps.getLocalPos(e);
    if (!pos) return;

    if (isAreaSelectionMode.value) {
      areaSelectionStart.value = pos;
      areaSelectionEnd.value = null;
      isMeasuring.value = true;
      deps.render();
      return;
    }

    if (deps.isDKeyPressed.value) {
      tempDragLine.value = {
        start: { ...pos },
        end: { ...pos },
      };
      deps.render();
      return;
    }

    if (deps.isDrawingScaleBar.value) {
      currentMeasurement.value = {
        start: { ...pos },
        end: { ...pos },
        isScaleBar: true,
      };
      isMeasuring.value = true;
      deps.render();
      return;
    }

    isMeasuring.value = true;

    if (measurementMode.value === 'line' || measurementMode.value === 'reference') {
      currentMeasurement.value = {
        start: { ...pos },
        end: { ...pos },
      };
    } else if (
      measurementMode.value === 'circle' ||
      (measurementMode.value && measurementMode.value.startsWith('area'))
    ) {
      areaStart.value = { ...pos };
      areaEnd.value = { ...pos };
    } else if (measurementMode.value === 'defect') {
      areaStart.value = { ...pos };
      areaEnd.value = { ...pos };
    }

    deps.render();
  }

  function updateMeasurement(e) {
    if (!deps.canvasRef.value) return;

    if (isDeleteMode.value) {
      if (!isMeasuring.value || !deleteStart.value) return;
      try {
        const pos = deps.getLocalPos(e);
        if (!pos) return;
        deleteEnd.value = pos;
        deps.render();
      } catch (error) {
        console.error('[updateMeasurement] Error in delete mode:', error);
      }
      return;
    }

    if (!isMeasuring.value) return;

    const pos = deps.getLocalPos(e);
    if (!pos) return;

    if (isAreaSelectionMode.value) {
      areaSelectionEnd.value = pos;
      deps.render();
      return;
    }

    if (deps.isDKeyPressed.value && tempDragLine.value) {
      tempDragLine.value.end = { ...pos };
      deps.render();
      return;
    }

    if (deps.isDrawingScaleBar.value && currentMeasurement.value) {
      currentMeasurement.value.end = { ...pos };
      deps.render();
      return;
    }

    if ((measurementMode.value === 'line' || measurementMode.value === 'reference') && currentMeasurement.value) {
      currentMeasurement.value.end = { ...pos };
    } else if (measurementMode.value === 'circle' || (measurementMode.value && measurementMode.value.startsWith('area'))) {
      areaEnd.value = { ...pos };
    } else if (measurementMode.value === 'defect') {
      areaEnd.value = { ...pos };
    }

    deps.render();
  }

  function endMeasurement(e) {
    if (!deps.canvasRef.value) return;

    if (isDeleteMode.value) {
      try {
        if (isMeasuring.value && deleteStart.value && deleteEnd.value) {
          deps.deleteMeasurementsInPath();
        }
      } catch (error) {
        console.error('[endMeasurement] Error in delete mode:', error);
      } finally {
        deleteStart.value = null;
        deleteEnd.value = null;
        isMeasuring.value = false;
        deps.render();
      }
      return;
    }

    if (!isMeasuring.value) return;

    if (isAreaSelectionMode.value) {
      if (areaSelectionStart.value && areaSelectionEnd.value) {
        const width = Math.abs(areaSelectionEnd.value.x - areaSelectionStart.value.x);
        const height = Math.abs(areaSelectionEnd.value.y - areaSelectionStart.value.y);
        if (width > 10 && height > 10) {
          deps.selectedAreaRect.value = {
            start: { ...areaSelectionStart.value },
            end: { ...areaSelectionEnd.value },
          };
        }
      }
      areaSelectionStart.value = null;
      areaSelectionEnd.value = null;
      isMeasuring.value = false;
      deps.render();
      return;
    }

    if (deps.isDKeyPressed.value && tempDragLine.value) {
      handleDragEnd();
      return;
    }

    // Scale bar drawing mode
    if (deps.isDrawingScaleBar.value && currentMeasurement.value) {
      const distance = Math.sqrt(
        Math.pow(currentMeasurement.value.end.x - currentMeasurement.value.start.x, 2) +
        Math.pow(currentMeasurement.value.end.y - currentMeasurement.value.start.y, 2),
      );

      if (distance > 10) {
        deps.manualScaleBar.value = { ...currentMeasurement.value };
        deps.manualScaleBarSet.value = true;

        const img = deps.sourceImageRef.value;
        const canvas = deps.canvasRef.value;

        const startX = (deps.manualScaleBar.value.start.x / canvas.width) * img.naturalWidth;
        const startY = (deps.manualScaleBar.value.start.y / canvas.height) * img.naturalHeight;
        const endX = (deps.manualScaleBar.value.end.x / canvas.width) * img.naturalWidth;
        const endY = (deps.manualScaleBar.value.end.y / canvas.height) * img.naturalHeight;

        const pixelLength = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));

        deps.scaleBarMeasurement.value = {
          start: deps.manualScaleBar.value.start,
          end: deps.manualScaleBar.value.end,
          pixelLength: pixelLength,
          unit: deps.scaleBarUnit.value,
        };

        deps.scaleBarDetected.value = true;
        if (deps.scalebarManager.value) {
          deps.scalebarManager.value.saveScaleBarSettings();
          deps.scalebarManager.value.showScaleBarValueDialog();
        }

        deps.isDrawingScaleBar.value = false;

        if (deps.pendingMeasurementMode.value) {
          measurementMode.value = deps.pendingMeasurementMode.value;
          if (deps.pendingMeasurementMode.value === 'defect') {
            isAreaSelectionMode.value = true;
          }
          const modeNames = {
            'area-vertical': '세로 영역 측정',
            'area-horizontal': '가로 영역 측정',
            defect: '불량 감지',
          };
          const modeName = modeNames[deps.pendingMeasurementMode.value] || deps.pendingMeasurementMode.value;
          deps.showNotification(`스케일바 설정 완료. ${modeName} 모드로 전환되었습니다.`, 'info');
          deps.pendingMeasurementMode.value = null;
        } else {
          measurementMode.value = 'line';
          deps.showNotification('수동 스케일바 설정 완료. 선 측정 모드로 전환되었습니다.', 'info');
        }
      }

      currentMeasurement.value = null;
      isMeasuring.value = false;
      deps.render();
      return;
    }

    // Line / reference measurement end
    if ((measurementMode.value === 'line' || measurementMode.value === 'reference') && currentMeasurement.value) {
      const width = Math.abs(currentMeasurement.value.end.x - currentMeasurement.value.start.x);
      const height = Math.abs(currentMeasurement.value.end.y - currentMeasurement.value.start.y);

      if (width > 10 || height > 10) {
        let measurement = {
          ...currentMeasurement.value,
          isReference: measurementMode.value === 'reference',
          color: deps.referenceLineColor.value,
          value: deps.calculateValue(currentMeasurement.value.start, currentMeasurement.value.end),
        };

        if (measurementMode.value === 'reference') {
          measurement.itemId = `REF-${deps.referenceId.value}`;
          measurement.subItemId = `REF-${deps.referenceId.value}-1`;
          deps.referenceLines.value.push(measurement);
          deps.activeReferenceLine.value = measurement;
          deps.referenceId.value++;
        } else {
          measurement.itemId = nextId.value.toString();
          measurement.subItemId = `${nextId.value}-${subItemPrefix.value}1`;

          if (deps.referenceLines.value.length > 0) {
            if (deps.referenceLines.value.length === 2) {
              measurement = trimMeasurementBetweenTwoReferences(measurement, deps.referenceLines.value);
            } else {
              for (const referenceLine of deps.referenceLines.value) {
                measurement = trimSingleMeasurementByReferenceLine(measurement, referenceLine);
              }
            }
            measurement.value = deps.calculateValue(measurement.start, measurement.end);
            measurement.relativeToReference = deps.activeReferenceLine.value?.itemId;
          }

          deps.addToHistory('add', null);
          deps.emit('measurement-added', measurement);

          // Call createBoundedSegments with `this` context
          _createBoundedSegments(measurement);
          nextId.value++;
        }
      }

      currentMeasurement.value = null;
      isMeasuring.value = false;
      deps.render();
      return;
    } else if (areaStart.value && areaEnd.value) {
      const width = Math.abs(areaEnd.value.x - areaStart.value.x);
      const height = Math.abs(areaEnd.value.y - areaStart.value.y);

      if (width > 10 && height > 10) {
        selectedArea.value = {
          start: { ...areaStart.value },
          end: { ...areaEnd.value },
        };

        if (measurementMode.value === 'defect') {
          deps.selectedAreaRect.value = {
            start: { ...areaStart.value },
            end: { ...areaEnd.value },
          };
          isMeasuring.value = false;
          deps.render();
          return;
        } else if (measurementMode.value === 'circle') {
          deps.addToHistory('add', null);

          const measurement = {
            start: { ...areaStart.value },
            end: { ...areaEnd.value },
            itemId: nextId.value.toString(),
            subItemId: `${nextId.value}-${subItemPrefix.value}1`,
            value: Math.max(width, height),
            brightness: deps.calculateAverageBrightness(areaStart.value, areaEnd.value),
            isStriated: deps.circleOptions.striation,
            isDistorted: deps.circleOptions.distortion,
            isBright: deps.calculateBrightness(
              (areaStart.value.x + areaEnd.value.x) / 2,
              (areaStart.value.y + areaEnd.value.y) / 2,
            ) > deps.brightnessThreshold.value,
          };
          localMeasurements.value.push(measurement);
          deps.emit('measurement-added', measurement);
          segmentedMeasurements.value.push(measurement);
          deps.emitMeasurementsUpdate();
          nextId.value++;
        } else if (measurementMode.value.startsWith('area')) {
          deps.addToHistory('add-area', null);
          const createdMeasurements = _createAreaMeasurements();

          if (createdMeasurements && createdMeasurements.length > 0) {
            createdMeasurements.forEach((m) => {
              localMeasurements.value.push(m);
              deps.emit('measurement-added', m);
            });
            deps.emitMeasurementsUpdate();
          }
        }
      }
    }

    currentMeasurement.value = null;
    areaStart.value = null;
    areaEnd.value = null;
    isMeasuring.value = false;
    deps.render();
  }

  function handleDragEnd() {
    // Stub for D-key drag end - reset drag state
    tempDragLine.value = null;
    isMeasuring.value = false;
    deps.render();
  }

  // Wrapper for createBoundedSegments to provide the right context
  function _createBoundedSegments(measurement) {
    // Build a context object that mimics `this` for the imported function
    const context = _buildMeasurementContext();
    createBoundedSegments.call(context, measurement);
    // Sync back
    _syncFromContext(context);
  }

  function _createAreaMeasurements() {
    const context = _buildMeasurementContext();
    const result = createAreaMeasurements.call(context);
    _syncFromContext(context);
    return result;
  }

  function _buildMeasurementContext() {
    return {
      segmentedMeasurements: segmentedMeasurements.value,
      localMeasurements: localMeasurements.value,
      brightnessThreshold: deps.brightnessThreshold.value,
      isReversed: deps.isReversed.value,
      nextId: nextId.value,
      brightSubIdCounter: brightSubIdCounter.value,
      darkSubIdCounter: darkSubIdCounter.value,
      subItemPrefix: subItemPrefix.value,
      areaStart: areaStart.value,
      areaEnd: areaEnd.value,
      selectedArea: selectedArea.value,
      lineCount: lineCount.value,
      measurementMode: measurementMode.value,
      imageData: deps.imageData.value,
      referenceLines: deps.referenceLines.value,
      activeReferenceLine: deps.activeReferenceLine.value,
      scaleMethod: deps.scaleMethod.value,
      scaleBarDetected: deps.scaleBarDetected.value,
      scaleBarMeasurement: deps.scaleBarMeasurement.value,
      scaleBarValue: deps.scaleBarValue.value,
      scaleBarUnit: deps.scaleBarUnit.value,
      magnification: deps.magnification.value,
      canvas: deps.canvasRef.value,
      $refs: {
        canvas: deps.canvasRef.value,
        sourceImage: deps.sourceImageRef.value,
      },
      calculateValue: deps.calculateValue,
      calculateBrightness: deps.calculateBrightness,
      calculateAverageBrightness: deps.calculateAverageBrightness,
      trimMeasurementByReferenceLine,
      trimSingleMeasurementByReferenceLine,
    };
  }

  function _syncFromContext(context) {
    segmentedMeasurements.value = context.segmentedMeasurements;
    nextId.value = context.nextId;
    brightSubIdCounter.value = context.brightSubIdCounter;
    darkSubIdCounter.value = context.darkSubIdCounter;
  }

  function updateAllMeasurements() {
    // Re-calculate all measurement values with new magnification
    segmentedMeasurements.value.forEach((segment) => {
      if (segment.start && segment.end) {
        segment.value = deps.calculateValue(segment.start, segment.end);
      }
    });
    localMeasurements.value.forEach((measurement) => {
      if (measurement.start && measurement.end) {
        measurement.value = deps.calculateValue(measurement.start, measurement.end);
      }
    });
  }

  function initializeMeasurements(measurements) {
    try {
      if (Array.isArray(measurements)) {
        localMeasurements.value = JSON.parse(JSON.stringify(measurements));
      } else {
        localMeasurements.value = [];
      }

      segmentedMeasurements.value = [];
      deps.defectMeasurements.value = [];
      deps.referenceLines.value = [];
      deps.activeReferenceLine.value = null;

      deps.selectedRows.value = [];
      deps.selectedMeasurement.value = null;
      deps.selectedSegment.value = null;
      deps.selectedAreaRect.value = null;

      nextId.value = 1;
      brightSubIdCounter.value = 1;
      darkSubIdCounter.value = 1;
      deps.referenceId.value = 1;

      deps.undoHistory.value = [];
      deps.redoHistory.value = [];
    } catch (error) {
      console.error('[initializeMeasurements] Error:', error);
      localMeasurements.value = [];
    }
  }

  function clearMeasurements() {
    try {
      localMeasurements.value = [];
      segmentedMeasurements.value = [];
      deps.referenceLines.value = [];
      deps.activeReferenceLine.value = null;

      deps.selectedRows.value = [];
      deps.selectedMeasurement.value = null;
      deps.selectedSegment.value = null;
      deps.selectedAreaRect.value = null;

      currentMeasurement.value = null;
      isMeasuring.value = false;
      areaStart.value = null;
      areaEnd.value = null;

      nextId.value = 1;
      brightSubIdCounter.value = 1;
      darkSubIdCounter.value = 1;
      deps.referenceId.value = 1;

      measurementMode.value = 'line';
      isDeleteMode.value = false;
      isAreaSelectionMode.value = false;

      areaSelectionStart.value = null;
      areaSelectionEnd.value = null;
      deleteStart.value = null;
      deleteEnd.value = null;

      tempDragLine.value = null;
      measurementHistory.value = [];

      deps.undoHistory.value = [];
      deps.redoHistory.value = [];

      deps.render();

      try {
        deps.emit('measurements-cleared');
        deps.emitMeasurementsUpdate();
      } catch (emitError) {
        console.error('[clearMeasurements] Emit error:', emitError);
      }
    } catch (error) {
      console.error('[clearMeasurements] Error:', error);
    }
  }

  function emitMeasurementsUpdate() {
    try {
      deps.emit('update:measurements', localMeasurements.value);
    } catch (error) {
      console.error('[emitMeasurementsUpdate] Error:', error);
    }
  }

  return {
    isMeasuring,
    currentMeasurement,
    segmentedMeasurements,
    localMeasurements,
    measurementMode,
    nextId,
    subItemPrefix,
    brightSubIdCounter,
    darkSubIdCounter,
    lineCount,
    areaStart,
    areaEnd,
    areaSelectionStart,
    areaSelectionEnd,
    isAreaSelectionMode,
    isDeleteMode,
    deleteStart,
    deleteEnd,
    tempDragLine,
    previousMeasurementMode,
    areaDirection,
    selectedArea,
    measurementHistory,
    filteredMeasurements,
    currentAverage,
    currentStandardDeviation,
    currentThreeSigma,
    averageMeasurementValue,
    increaseLineCount,
    decreaseLineCount,
    setMode,
    toggleDeleteMode,
    startMeasurement,
    updateMeasurement,
    endMeasurement,
    updateAllMeasurements,
    initializeMeasurements,
    clearMeasurements,
    emitMeasurementsUpdate,
  };
}
