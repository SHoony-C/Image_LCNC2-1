/**
 * msa6_useHistory.js
 * Undo/redo history management for measurements.
 */
import { ref } from 'vue';

export function useHistory(deps) {
  // deps: { segmentedMeasurements, referenceLines, defectMeasurements, localMeasurements,
  //          selectedRows, selectedMeasurement, selectedDefects, render, emitMeasurementsUpdate, showNotification }

  const undoHistory = ref([]);
  const redoHistory = ref([]);

  function addToHistory(action, data, segments = null, references = null, defects = null) {
    try {
      const historyEntry = {
        action,
        data,
        segments: segments || JSON.parse(JSON.stringify(deps.segmentedMeasurements.value)),
        references: references || JSON.parse(JSON.stringify(deps.referenceLines.value)),
        defects: defects || JSON.parse(JSON.stringify(deps.defectMeasurements.value)),
        localMeasurements: JSON.parse(JSON.stringify(deps.localMeasurements.value)),
        timestamp: new Date().toISOString(),
      };

      undoHistory.value.push(historyEntry);

      if (undoHistory.value.length > 50) {
        undoHistory.value.shift();
      }

      redoHistory.value = [];
    } catch (error) {
      console.error('[addToHistory] Error:', error);
    }
  }

  function undo() {
    try {
      if (undoHistory.value.length === 0) {
        deps.showNotification('실행 취소할 작업이 없습니다.', 'info');
        return;
      }

      const currentState = {
        action: 'current_state',
        data: null,
        segments: JSON.parse(JSON.stringify(deps.segmentedMeasurements.value)),
        references: JSON.parse(JSON.stringify(deps.referenceLines.value)),
        defects: JSON.parse(JSON.stringify(deps.defectMeasurements.value)),
        timestamp: new Date().toISOString(),
      };
      redoHistory.value.push(currentState);

      const undoAction = undoHistory.value.pop();

      if (undoAction.segments) {
        deps.segmentedMeasurements.value = JSON.parse(JSON.stringify(undoAction.segments));
      }
      if (undoAction.references) {
        deps.referenceLines.value = JSON.parse(JSON.stringify(undoAction.references));
      }
      if (undoAction.defects) {
        deps.defectMeasurements.value = JSON.parse(JSON.stringify(undoAction.defects));
      }

      deps.selectedRows.value = [];
      deps.selectedMeasurement.value = null;
      deps.selectedDefects.value = [];

      deps.render();
      deps.emitMeasurementsUpdate();
      deps.showNotification('작업이 실행 취소되었습니다.', 'success');
    } catch (error) {
      console.error('[undo] Error:', error);
      deps.showNotification('실행 취소 중 오류가 발생했습니다.', 'error');
    }
  }

  function redo() {
    try {
      if (redoHistory.value.length === 0) {
        deps.showNotification('다시 실행할 작업이 없습니다.', 'info');
        return;
      }

      const redoAction = redoHistory.value.pop();

      const currentState = {
        action: 'redo_current',
        data: null,
        segments: JSON.parse(JSON.stringify(deps.segmentedMeasurements.value)),
        references: JSON.parse(JSON.stringify(deps.referenceLines.value)),
        defects: JSON.parse(JSON.stringify(deps.defectMeasurements.value)),
        timestamp: new Date().toISOString(),
      };
      undoHistory.value.push(currentState);

      if (redoAction.segments) {
        deps.segmentedMeasurements.value = JSON.parse(JSON.stringify(redoAction.segments));
      }
      if (redoAction.references) {
        deps.referenceLines.value = JSON.parse(JSON.stringify(redoAction.references));
      }
      if (redoAction.defects) {
        deps.defectMeasurements.value = JSON.parse(JSON.stringify(redoAction.defects));
      }

      deps.selectedRows.value = [];
      deps.selectedMeasurement.value = null;
      deps.selectedDefects.value = [];

      deps.render();
      deps.emitMeasurementsUpdate();
      deps.showNotification('작업이 다시 실행되었습니다.', 'success');
    } catch (error) {
      console.error('[redo] Error:', error);
      deps.showNotification('다시 실행 중 오류가 발생했습니다.', 'error');
    }
  }

  return {
    undoHistory,
    redoHistory,
    addToHistory,
    undo,
    redo,
  };
}
