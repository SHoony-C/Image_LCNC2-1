import { ref } from 'vue'

/**
 * Composable for managing workflow undo/redo history.
 * Provides saveToHistory, undo, redo operations with a configurable max history limit.
 *
 * @param {import('vue').Ref} elements - Reactive ref to workflow elements array
 * @param {Function} updateConnections - Callback to update connection states after undo/redo
 * @returns Undo/redo state and functions
 */
export function useWorkflowHistory(elements, updateConnections) {
  const undoStack = ref([])
  const redoStack = ref([])
  const MAX_HISTORY = 20

  /**
   * Save the current elements state to the undo stack.
   * Uses JSON deep copy for compatibility.
   */
  const saveToHistory = () => {
    if (undoStack.value.length >= MAX_HISTORY) {
      undoStack.value.shift()
    }
    undoStack.value.push(JSON.parse(JSON.stringify(elements.value)))
    redoStack.value = []
  }

  /**
   * Undo the last action by restoring the previous state from the undo stack.
   * Blocks undo if MSA6 popup is currently visible.
   */
  const undo = () => {
    // MSA6 팝업이 열려있는지 확인
    const msa6Popup = document.querySelector('.image-measurement-popup')
    const isMSA6PopupVisible = msa6Popup && msa6Popup.style.display !== 'none' && msa6Popup.style.visibility !== 'hidden'

    if (isMSA6PopupVisible) {
      console.log('MSA6 팝업이 열려있어 실행 취소가 차단되었습니다.')
      return
    }

    if (undoStack.value.length === 0) return

    redoStack.value.push(JSON.parse(JSON.stringify(elements.value)))
    const lastState = undoStack.value.pop()
    elements.value = lastState

    updateConnections()
  }

  /**
   * Redo the last undone action by restoring state from the redo stack.
   */
  const redo = () => {
    if (redoStack.value.length === 0) return

    undoStack.value.push(JSON.parse(JSON.stringify(elements.value)))
    const nextState = redoStack.value.pop()
    elements.value = nextState

    updateConnections()
  }

  return {
    undoStack,
    redoStack,
    MAX_HISTORY,
    saveToHistory,
    undo,
    redo
  }
}
