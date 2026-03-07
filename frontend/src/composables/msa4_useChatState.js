import { ref } from 'vue'

/**
 * Composable for MSA4 chat state management.
 * Manages all reactive state related to chat history, analysis data, and UI flags.
 *
 * @returns Chat state refs and utility functions
 */
export function useChatState() {
  const analysisData = ref([])
  const analysisResult = ref('')
  const isAnalyzing = ref(false)
  const hasAnalysisData = ref(false)
  const errorMessage = ref('')
  const abortController = ref(null)
  const lastProcessedData = ref(null) // 마지막으로 처리한 데이터 추적
  const debounceTimer = ref(null) // 디바운스 타이머
  const userInput = ref('') // 사용자 입력
  const chatHistory = ref([]) // 채팅 이력
  const currentAnalysisImages = ref([]) // 현재 분석 중인 이미지들

  // 중복 데이터 체크 함수
  function isDuplicateData(newData) {
    if (!lastProcessedData.value || !newData) {
      return false
    }

    // 데이터 타입과 길이 비교
    if (lastProcessedData.value.type !== newData.type) {
      return false
    }

    const lastData = lastProcessedData.value.data || []
    const currentData = newData.data || []

    if (lastData.length !== currentData.length) {
      return false
    }

    // 각 이미지의 이름과 텍스트 내용 비교
    for (let i = 0; i < lastData.length; i++) {
      if (lastData[i].imageName !== currentData[i].imageName ||
          lastData[i].textContent !== currentData[i].textContent) {
        return false
      }
    }

    return true // 완전히 동일한 데이터
  }

  return {
    analysisData,
    analysisResult,
    isAnalyzing,
    hasAnalysisData,
    errorMessage,
    abortController,
    lastProcessedData,
    debounceTimer,
    userInput,
    chatHistory,
    currentAnalysisImages,
    isDuplicateData
  }
}
