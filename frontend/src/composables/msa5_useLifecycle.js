import { onMounted, onUnmounted } from 'vue'

/**
 * Backend node loading, lifecycle hooks for MSA5.
 */
export function useLifecycle(deps) {
  const {
    availableNodes, isNodesLoading, defaultOptions,
    initializeElements, handleKeyDown,
    handleImageUpdate, handleWorkflowFromMSA4, handleWorkflowFromMSA3,
    loadDefaultWorkflow, loadSavedWorkflows,
  } = deps

  // =============================================
  // Backend node loading
  // =============================================
  const loadAvailableNodes = async () => {
    isNodesLoading.value = true

    try {
      const apiUrl = 'http://localhost:8000/api/msa5/nodes'
      console.time('API 호출 시간')

      try {
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          mode: 'cors',
          credentials: 'include'
        })
        console.timeEnd('API 호출 시간')

        if (response.ok) {
          try {
            const data = await response.json()

            if (data.options && Array.isArray(data.options)) {
              availableNodes.value = data.options

              if (data.defaultOptions) {
                defaultOptions.value = data.defaultOptions
              }
            } else {
              console.warn('백엔드 응답에 options 배열이 없거나 형식이 맞지 않습니다:', data)
            }
          } catch (parseError) {
            console.error('JSON 파싱 오류:', parseError)
          }
        } else {
          console.error(`API 요청 실패: ${response.status} ${response.statusText}`)
          const errorText = await response.text()
          console.error('오류 응답 내용:', errorText)
        }
      } catch (fetchError) {
        console.timeEnd('API 호출 시간')
        console.error('fetch 호출 오류:', fetchError)
        console.error('오류 세부 정보:', {
          name: fetchError.name,
          message: fetchError.message,
          stack: fetchError.stack
        })
      }
    } finally {
      initializeElements()
      isNodesLoading.value = false
    }
  }

  // =============================================
  // Lifecycle hooks
  // =============================================
  onMounted(() => {
    document.addEventListener('msa4-to-msa5-image', handleImageUpdate)
    document.addEventListener('msa1-to-msa5-image', handleImageUpdate)
    document.addEventListener('msa4-to-msa5-workflow', handleWorkflowFromMSA4)
    document.addEventListener('load-workflow-to-msa5', handleWorkflowFromMSA3)

    if (window.MSAEventBus) {
      window.MSAEventBus.on('load-workflow-to-msa5', handleWorkflowFromMSA3)
    }

    loadAvailableNodes()

    sessionStorage.removeItem('msa5_end_image')
    sessionStorage.removeItem('msa5_processing')

    loadDefaultWorkflow()

    window.addEventListener('keydown', handleKeyDown)

    loadSavedWorkflows()
  })

  onUnmounted(() => {
    document.removeEventListener('msa4-to-msa5-image', handleImageUpdate)
    document.removeEventListener('msa1-to-msa5-image', handleImageUpdate)
    document.removeEventListener('msa4-to-msa5-workflow', handleWorkflowFromMSA4)
    document.removeEventListener('load-workflow-to-msa5', handleWorkflowFromMSA3)

    window.removeEventListener('keydown', handleKeyDown)

    if (window.MSAEventBus) {
      window.MSAEventBus.off('load-workflow-to-msa5', handleWorkflowFromMSA3)
    }
  })
}
