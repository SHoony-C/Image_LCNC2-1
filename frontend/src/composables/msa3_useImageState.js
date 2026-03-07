import { ref, computed, watch } from 'vue'

/**
 * Composable for MSA3 image state management.
 * Manages mainImage, similarImages, computed filtered lists, and watcher.
 *
 * @returns Image state refs, computed properties
 */
export function useImageState() {
  const mainImage = ref(null)
  const similarImages = ref([])
  const showImagePopup = ref(false)
  const selectedImage = ref(null)
  const errorMessage = ref('')
  const dataPollingInterval = ref(null)
  const debugMode = ref(false) // 디버깅 모드 비활성화
  const layoutInitialized = ref(false) // 레이아웃 초기화 상태 추적
  const resizeHandler = ref(null)
  const isProcessingSimilarImages = ref(false)
  const isProcessingMSA1Data = ref(false) // MSA1 데이터 처리 중 플래그 추가
  const lastMSA1ProcessTime = ref(null) // 최근 MSA1 데이터 처리 시간 저장
  const abortController = ref(null) // fetch 요청 취소용 AbortController

  // I-app 태그 유사 이미지 (최대 3개)
  const iAppSimilarImages = computed(() => {
    return similarImages.value
      .filter(image => isIAppTag(image.filename))
      .slice(0, 3)
  })

  // Analysis 태그 유사 이미지 (최대 3개)
  const analysisSimilarImages = computed(() => {
    return similarImages.value
      .filter(image => !isIAppTag(image.filename))
      .slice(0, 3)
  })

  // similarImages 배열 상한선 제한 (최대 100개)
  watch(similarImages, (newVal) => {
    if (newVal && newVal.length > 100) {
      // 오래된 항목 제거 (뒤쪽이 오래된 것)
      similarImages.value = newVal.slice(0, 100)
    }
  })

  // I-app 태그 여부 확인
  function isIAppTag(filename) {
    if (!filename) return false
    return filename.includes('_before')
  }

  // 파일명 정리
  function getCleanFilename(filename) {
    if (!filename) return ''
    // 경로 제거
    const nameOnly = filename.split('/').pop()
    return nameOnly
  }

  // 유사도 포맷팅
  function formatSimilarity(value) {
    if (typeof value === 'number') {
      return Math.round(value)
    }
    return 0
  }

  // 상태 초기화
  function resetState() {
    mainImage.value = null
    similarImages.value = []
    showImagePopup.value = false
    selectedImage.value = null
    errorMessage.value = ''
    layoutInitialized.value = false
  }

  // 전역 데이터 초기화
  function initGlobalData() {
    if (typeof window !== 'undefined') {
      if (!window.MSASharedData) {
        window.MSASharedData = {
          currentImage: null,
          similarImages: []
        }
      } else {
        window.MSASharedData.currentImage = null
        window.MSASharedData.similarImages = []
      }
    }
  }

  // 전역 데이터 정리
  function cleanupGlobalData() {
    if (typeof window !== 'undefined' && window.MSASharedData) {
      window.MSASharedData.currentImage = null
      window.MSASharedData.similarImages = []
    }
  }

  return {
    mainImage,
    similarImages,
    showImagePopup,
    selectedImage,
    errorMessage,
    dataPollingInterval,
    debugMode,
    layoutInitialized,
    resizeHandler,
    isProcessingSimilarImages,
    isProcessingMSA1Data,
    lastMSA1ProcessTime,
    abortController,
    iAppSimilarImages,
    analysisSimilarImages,
    isIAppTag,
    getCleanFilename,
    formatSimilarity,
    resetState,
    initGlobalData,
    cleanupGlobalData
  }
}
