/**
 * msa6_useKeyboard.js
 * Keyboard event handling (keydown, keyup).
 */
import { ref } from 'vue';

export function useKeyboard(deps) {
  // deps: { showBrightnessTooltip, isFKeyPressed, showShortcutHelp,
  //          measurementMode, areaDirection, setMode, isDeleteMode, isDKeyPressed,
  //          tempDragLine, isMeasuring, selectedRows, selectedDefects,
  //          deleteSelectedMeasurements, undo, redo, showNotification, render, closePopup }

  const isDKeyPressed = ref(false);
  const showShortcutHelp = ref(false);

  function handleKeyDown(e) {
    try {
      const activeElement = document.activeElement;
      if (
        activeElement && (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.contentEditable === 'true' ||
          activeElement.isContentEditable
        )
      ) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && ['c', 'a', 'x'].includes(e.key.toLowerCase())) {
        return;
      }

      const key = e.key.toLowerCase();

      if (key === 'f') {
        e.preventDefault();
        deps.showBrightnessTooltip.value = true;
        deps.isFKeyPressed.value = true;
        return;
      }

      if (key === 'a') {
        e.preventDefault();
        if (
          deps.measurementMode.value === 'area' ||
          deps.measurementMode.value === 'area-vertical' ||
          deps.measurementMode.value === 'area-horizontal'
        ) {
          deps.areaDirection.value = deps.areaDirection.value === 'horizontal' ? 'vertical' : 'horizontal';
          if (deps.areaDirection.value === 'horizontal') {
            deps.measurementMode.value = 'area-horizontal';
          } else {
            deps.measurementMode.value = 'area-vertical';
          }
          deps.showNotification(
            `영역 측정 방향: ${deps.areaDirection.value === 'horizontal' ? '수평' : '수직'}`,
            'info',
          );
        } else {
          deps.setMode('area');
          deps.showNotification('영역 선 측정 모드 활성화', 'info');
        }
        return;
      }

      if (key === 's') {
        e.preventDefault();
        deps.setMode('line');
        deps.showNotification('단일 선 측정 모드 활성화', 'info');
        return;
      }

      if (key === 'c') {
        e.preventDefault();
        deps.setMode('reference');
        deps.showNotification('기준선 그리기 모드 활성화', 'info');
        return;
      }

      if (key === 'd' && !isDKeyPressed.value) {
        e.preventDefault();
        isDKeyPressed.value = true;

        if (deps.isDeleteMode.value) {
          deps.isDeleteMode.value = false;
          deps.showNotification('삭제 모드 비활성화됨.', 'info');
          return;
        }

        if (deps.selectedRows.value.length > 0 || deps.selectedDefects.value.length > 0) {
          deps.deleteSelectedMeasurements();
        } else {
          deps.isDeleteMode.value = true;
          deps.showNotification('삭제 모드 활성화됨. 삭제할 측정 결과를 클릭하세요.', 'info');
        }
        return;
      }

      if (key === 'h') {
        e.preventDefault();
        showShortcutHelp.value = true;
        return;
      }

      if (key === 'r') {
        e.preventDefault();
        deps.setMode('defect');
        deps.showNotification('불량 감지 모드 활성화', 'info');
        return;
      }

      if (e.ctrlKey && key === 'z') {
        e.preventDefault();
        deps.undo();
        return;
      }

      if (e.ctrlKey && key === 'y') {
        e.preventDefault();
        deps.redo();
        return;
      }

      if (key === 'escape') {
        deps.closePopup();
        return;
      }
    } catch (error) {
      console.error('[handleKeyDown] Error:', error);
    }
  }

  function handleKeyUp(e) {
    try {
      const key = e.key.toLowerCase();

      if (key === 'f') {
        e.preventDefault();
        deps.showBrightnessTooltip.value = false;
        deps.isFKeyPressed.value = false;
        return;
      }

      if (key === 'h') {
        e.preventDefault();
        showShortcutHelp.value = false;
        return;
      }

      if (key === 'd' && isDKeyPressed.value) {
        isDKeyPressed.value = false;
        if (deps.tempDragLine.value) {
          deps.tempDragLine.value = null;
          deps.isMeasuring.value = false;
          deps.render();
        }
      }
    } catch (error) {
      console.error('[handleKeyUp] Error:', error);
    }
  }

  return {
    isDKeyPressed,
    showShortcutHelp,
    handleKeyDown,
    handleKeyUp,
  };
}
