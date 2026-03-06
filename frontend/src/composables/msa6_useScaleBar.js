/**
 * msa6_useScaleBar.js
 * Scale bar detection, toggling, scale method selection.
 */
import { ref } from 'vue';

export function useScaleBar(deps) {
  // deps: { scalebarManager, measurementMode, isAreaSelectionMode, selectedAreaRect,
  //          areaStart, areaEnd, isDrawingScaleBar, pendingMeasurementMode,
  //          render, showNotification }

  const scaleMethod = ref('scaleBar');
  const magnification = ref(500);
  const scaleBarValue = ref(500);
  const scaleBarUnit = ref('nm');
  const scaleBarDetected = ref(false);
  const scaleBarMeasurement = ref(null);
  const isDrawingScaleBar = ref(false);
  const manualScaleBar = ref(null);
  const manualScaleBarSet = ref(false);
  const pendingMeasurementMode = ref(null);

  function detectScaleBar() {
    if (deps.scalebarManager.value) {
      deps.scalebarManager.value.detectScaleBar();
    }
  }

  function toggleScaleBarDrawing() {
    if (deps.measurementMode.value === 'defect') {
      pendingMeasurementMode.value = 'defect';

      isDrawingScaleBar.value = true;
      deps.measurementMode.value = 'line';

      deps.isAreaSelectionMode.value = false;
      deps.selectedAreaRect.value = null;
      deps.areaStart.value = null;
      deps.areaEnd.value = null;

      deps.render();
      return;
    }

    if (deps.scalebarManager.value) {
      deps.scalebarManager.value.toggleScaleBarDrawing();
    }
  }

  function selectScaleMethod(method) {
    scaleMethod.value = method;

    if (method === 'magnification') {
      scaleBarDetected.value = false;
      manualScaleBarSet.value = false;
    } else if (method === 'scaleBar') {
      toggleScaleBarDrawing();
    }
  }

  function showScaleDetectionFailurePopup() {
    // Placeholder - actual popup logic handled via scalebarManager
  }

  return {
    scaleMethod,
    magnification,
    scaleBarValue,
    scaleBarUnit,
    scaleBarDetected,
    scaleBarMeasurement,
    isDrawingScaleBar,
    manualScaleBar,
    manualScaleBarSet,
    pendingMeasurementMode,
    detectScaleBar,
    toggleScaleBarDrawing,
    selectScaleMethod,
    showScaleDetectionFailurePopup,
  };
}
