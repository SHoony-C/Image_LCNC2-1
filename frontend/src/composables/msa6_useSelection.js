/**
 * msa6_useSelection.js
 * Row/defect selection, drag selection, ID application, delete selected.
 */
import { ref } from 'vue';

export function useSelection(deps) {
  // deps: { filteredMeasurements, defectMeasurements, segmentedMeasurements, localMeasurements,
  //          measurementMode, render, showNotification, addToHistory, emitMeasurementsUpdate }

  const selectedRows = ref([]);
  const selectedDefects = ref([]);
  const hoveredSegment = ref(null);
  const selectedMeasurement = ref(null);
  const selectedSegment = ref(null);
  const isDragging = ref(false);
  const dragStartIndex = ref(-1);
  const dragEndIndex = ref(-1);
  const dragStartRow = ref(null);
  const newItemId = ref('');
  const newSubId = ref('');

  // --- Row (line measurement) handlers ---

  function handleRowMouseDown(segment, index) {
    try {
      if (event.shiftKey && selectedRows.value.length > 0) {
        const lastSelectedIndex = deps.filteredMeasurements.value.indexOf(
          selectedRows.value[selectedRows.value.length - 1],
        );
        if (lastSelectedIndex !== -1) {
          const startIdx = Math.min(lastSelectedIndex, index);
          const endIdx = Math.max(lastSelectedIndex, index);
          selectedRows.value = [];
          for (let i = startIdx; i <= endIdx; i++) {
            if (deps.filteredMeasurements.value[i]) {
              selectedRows.value.push(deps.filteredMeasurements.value[i]);
            }
          }
        }
      } else if (event.ctrlKey || event.metaKey) {
        const segmentIndex = selectedRows.value.indexOf(segment);
        if (segmentIndex > -1) {
          selectedRows.value.splice(segmentIndex, 1);
        } else {
          selectedRows.value.push(segment);
        }
      } else {
        selectedRows.value = [segment];
        isDragging.value = true;
        dragStartIndex.value = index;
        dragStartRow.value = segment;
      }
    } catch (error) {
      console.error('[handleRowMouseDown] Error:', error);
    }
  }

  function handleRowMouseEnter(segment, index) {
    try {
      if (isDragging.value && dragStartIndex.value !== -1) {
        dragEndIndex.value = index;
        const startIdx = Math.min(dragStartIndex.value, dragEndIndex.value);
        const endIdx = Math.max(dragStartIndex.value, dragEndIndex.value);
        selectedRows.value = [];
        for (let i = startIdx; i <= endIdx; i++) {
          if (deps.filteredMeasurements.value[i]) {
            selectedRows.value.push(deps.filteredMeasurements.value[i]);
          }
        }
      } else {
        hoveredSegment.value = segment;
        deps.render();
      }
    } catch (error) {
      console.error('[handleRowMouseEnter] Error:', error);
    }
  }

  function handleRowMouseUp() {
    try {
      if (isDragging.value) {
        isDragging.value = false;
        dragStartIndex.value = -1;
        dragEndIndex.value = -1;
        dragStartRow.value = null;
      }
    } catch (error) {
      console.error('[handleRowMouseUp] Error:', error);
    }
  }

  // --- Defect handlers ---

  function handleDefectMouseDown(defect, index) {
    try {
      if (event.shiftKey && selectedDefects.value.length > 0) {
        const lastSelectedIndex = deps.defectMeasurements.value.indexOf(
          selectedDefects.value[selectedDefects.value.length - 1],
        );
        if (lastSelectedIndex !== -1) {
          const startIdx = Math.min(lastSelectedIndex, index);
          const endIdx = Math.max(lastSelectedIndex, index);
          selectedDefects.value = [];
          for (let i = startIdx; i <= endIdx; i++) {
            if (deps.defectMeasurements.value[i]) {
              selectedDefects.value.push(deps.defectMeasurements.value[i]);
            }
          }
        }
      } else if (event.ctrlKey || event.metaKey) {
        const defectIndex = selectedDefects.value.indexOf(defect);
        if (defectIndex > -1) {
          selectedDefects.value.splice(defectIndex, 1);
        } else {
          selectedDefects.value.push(defect);
        }
      } else {
        selectedDefects.value = [defect];
        isDragging.value = true;
        dragStartIndex.value = index;
        dragStartRow.value = defect;
      }
    } catch (error) {
      console.error('[handleDefectMouseDown] Error:', error);
    }
  }

  function handleDefectMouseEnter(defect, index) {
    try {
      if (isDragging.value && dragStartIndex.value !== -1) {
        dragEndIndex.value = index;
        const startIdx = Math.min(dragStartIndex.value, dragEndIndex.value);
        const endIdx = Math.max(dragStartIndex.value, dragEndIndex.value);
        selectedDefects.value = [];
        for (let i = startIdx; i <= endIdx; i++) {
          if (deps.defectMeasurements.value[i]) {
            selectedDefects.value.push(deps.defectMeasurements.value[i]);
          }
        }
      }
    } catch (error) {
      console.error('[handleDefectMouseEnter] Error:', error);
    }
  }

  function handleDefectMouseUp() {
    try {
      if (isDragging.value) {
        isDragging.value = false;
        dragStartIndex.value = -1;
        dragEndIndex.value = -1;
        dragStartRow.value = null;
      }
    } catch (error) {
      console.error('[handleDefectMouseUp] Error:', error);
    }
  }

  // --- Shared ---

  function applySelectedIds() {
    try {
      if (!newItemId.value && !newSubId.value) {
        deps.showNotification('적용할 Item ID 또는 Sub ID를 입력해주세요.', 'warning');
        return;
      }

      let updatedCount = 0;

      if (deps.measurementMode.value !== 'defect' && selectedRows.value.length > 0) {
        selectedRows.value.forEach((segment) => {
          if (newItemId.value) segment.itemId = newItemId.value;
          if (newSubId.value) segment.subItemId = newSubId.value;
          updatedCount++;
        });
      }

      if (deps.measurementMode.value === 'defect' && selectedDefects.value.length > 0) {
        selectedDefects.value.forEach((defect) => {
          if (newItemId.value) defect.itemId = newItemId.value;
          if (newSubId.value) defect.subItemId = newSubId.value;
          updatedCount++;
        });
      }

      if (updatedCount > 0) {
        selectedRows.value = [];
        selectedDefects.value = [];
        newItemId.value = '';
        newSubId.value = '';
        deps.render();
        deps.showNotification(`${updatedCount}개 항목의 ID가 업데이트되었습니다.`, 'success');
      } else {
        deps.showNotification('선택된 항목이 없습니다.', 'warning');
      }
    } catch (error) {
      console.error('[applySelectedIds] Error:', error);
      deps.showNotification('ID 적용 중 오류가 발생했습니다.', 'error');
    }
  }

  function deleteSelectedMeasurements() {
    try {
      if (selectedRows.value.length === 0 && selectedDefects.value.length === 0) {
        deps.showNotification('삭제할 선택된 항목이 없습니다.', 'warning');
        return;
      }

      deps.addToHistory('delete_selected', null);

      let deletedCount = 0;

      // Delete selected rows from segmentedMeasurements
      if (selectedRows.value.length > 0) {
        selectedRows.value.forEach((row) => {
          const idx = deps.segmentedMeasurements.value.indexOf(row);
          if (idx !== -1) {
            deps.segmentedMeasurements.value.splice(idx, 1);
            deletedCount++;
          }
          const idx2 = deps.localMeasurements.value.indexOf(row);
          if (idx2 !== -1) {
            deps.localMeasurements.value.splice(idx2, 1);
          }
        });
        selectedRows.value = [];
      }

      // Delete selected defects
      if (selectedDefects.value.length > 0) {
        selectedDefects.value.forEach((defect) => {
          const idx = deps.defectMeasurements.value.indexOf(defect);
          if (idx !== -1) {
            deps.defectMeasurements.value.splice(idx, 1);
            deletedCount++;
          }
        });
        selectedDefects.value = [];
      }

      deps.render();
      deps.emitMeasurementsUpdate();

      if (deletedCount > 0) {
        deps.showNotification(`${deletedCount}개 항목이 삭제되었습니다.`, 'success');
      }
    } catch (error) {
      console.error('[deleteSelectedMeasurements] Error:', error);
      deps.showNotification('삭제 중 오류가 발생했습니다.', 'error');
    }
  }

  function deleteSegment(segment) {
    const idx = deps.segmentedMeasurements.value.indexOf(segment);
    if (idx !== -1) deps.segmentedMeasurements.value.splice(idx, 1);

    const idx2 = deps.localMeasurements.value.indexOf(segment);
    if (idx2 !== -1) deps.localMeasurements.value.splice(idx2, 1);

    const idx3 = deps.defectMeasurements.value.indexOf(segment);
    if (idx3 !== -1) deps.defectMeasurements.value.splice(idx3, 1);

    const selIdx = selectedRows.value.indexOf(segment);
    if (selIdx !== -1) selectedRows.value.splice(selIdx, 1);

    deps.render();
    deps.emitMeasurementsUpdate();
  }

  return {
    selectedRows,
    selectedDefects,
    hoveredSegment,
    selectedMeasurement,
    selectedSegment,
    isDragging,
    dragStartIndex,
    dragEndIndex,
    dragStartRow,
    newItemId,
    newSubId,
    handleRowMouseDown,
    handleRowMouseEnter,
    handleRowMouseUp,
    handleDefectMouseDown,
    handleDefectMouseEnter,
    handleDefectMouseUp,
    applySelectedIds,
    deleteSelectedMeasurements,
    deleteSegment,
  };
}
