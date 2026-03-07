import { ref, reactive } from 'vue'

/**
 * Composable for MSA2 UI state management (messages, loading, error display, resize observer).
 *
 * @returns UI state refs and functions
 */
export function useUIState() {
  const isProcessing = ref(false)
  const isDataLoaded = ref(false)
  const loadingComplete = ref(false)
  const loadingMessage = ref('')
  const errorMessage = ref('')
  const isLoading = ref(false)
  const showStatusMessage = ref(false)
  const showDebugControls = ref(false)

  const message = reactive({
    show: false,
    text: '',
    icon: 'fas fa-info-circle',
    type: 'info'
  })

  // 상태 메시지 표시
  function showMessage(text, type = 'info') {
    message.show = true
    message.text = text
    message.type = type
    message.icon = type === 'success' ? 'fas fa-check-circle'
      : type === 'warning' ? 'fas fa-exclamation-triangle'
      : type === 'error' ? 'fas fa-times-circle'
      : 'fas fa-info-circle'

    // 3초 후 메시지 자동 숨김
    setTimeout(() => {
      message.show = false
    }, 3000)
  }

  // 에러 메시지 표시
  function displayErrorMessage(msg) {
    console.error('[MSA4 Error]', msg)
    errorMessage.value = msg
    showMessage(msg, 'error')

    // 3초 후 에러 메시지 숨기기
    setTimeout(() => {
      errorMessage.value = ''
    }, 3000)
  }

  return {
    isProcessing,
    isDataLoaded,
    loadingComplete,
    loadingMessage,
    errorMessage,
    isLoading,
    showStatusMessage,
    showDebugControls,
    message,
    showMessage,
    displayErrorMessage
  }
}
