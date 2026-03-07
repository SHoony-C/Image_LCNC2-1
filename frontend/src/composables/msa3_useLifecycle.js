import { nextTick, onMounted, onBeforeUnmount, getCurrentInstance } from 'vue'
import { useImageState } from './msa3_useImageState'
import { useImageLoader } from './msa3_useImageLoader'
import { useMSA4Communication } from './msa3_useMSA4Communication'
import { useEventHandlers } from './msa3_useEventHandlers'
import { usePopupManager } from './msa3_usePopupManager'
import { useLayout } from './msa3_useLayout'

export function useLifecycle(emit) {
  const instance = getCurrentInstance()

  // 1. Image State
  const imageState = useImageState()
  const {
    mainImage, similarImages, showImagePopup, selectedImage,
    errorMessage, dataPollingInterval, debugMode, layoutInitialized,
    resizeHandler, isProcessingSimilarImages, isProcessingMSA1Data,
    lastMSA1ProcessTime, abortController,
    iAppSimilarImages, analysisSimilarImages,
    isIAppTag, getCleanFilename, formatSimilarity,
    resetState, initGlobalData, cleanupGlobalData
  } = imageState

  // 2. Image Loader
  const { getImageUrl, handleImageError, handleImageLoad } = useImageLoader({ isIAppTag })

  // 3. Layout
  const { debounce, initializeLayout } = useLayout({
    layoutInitialized,
    getEl: () => instance?.proxy?.$el
  })

  // 4. MSA4 Communication
  const msa4Comm = useMSA4Communication({
    mainImage, selectedImage, abortController, isIAppTag, getImageUrl, emit
  })

  // 5. Event Handlers
  const eventHandlers = useEventHandlers({
    mainImage, similarImages, isProcessingMSA1Data, lastMSA1ProcessTime,
    isProcessingSimilarImages, isIAppTag, getImageUrl,
    sendAnalysisImagesToMSA4: msa4Comm.sendAnalysisImagesToMSA4,
    handleMainImageChanged: msa4Comm.handleMainImageChanged,
    fetchWorkflowInfo: msa4Comm.fetchWorkflowInfo
  })

  // 6. Popup Manager
  const popupManager = usePopupManager({
    mainImage, selectedImage, showImagePopup, isIAppTag, getImageUrl,
    fetchWorkflowInfo: msa4Comm.fetchWorkflowInfo
  })

  // Event listener management
  function removeEventListeners() {
    document.removeEventListener('msa2-to-msa3-image-selected', eventHandlers.handleMSA2Event)
    document.removeEventListener('msa2-to-msa3-similar-images', eventHandlers.handleMSA2SimilarImages)
    document.removeEventListener('msa1-to-msa3-similar-images', eventHandlers.handleMSA1SimilarImages)
  }

  // Created equivalent (runs immediately in setup)
  try {
    abortController.value = new AbortController()
    resetState()
    initGlobalData()

    removeEventListeners()
    document.addEventListener('msa2-to-msa3-image-selected', eventHandlers.handleMSA2Event)
    document.addEventListener('msa2-to-msa3-similar-images', eventHandlers.handleMSA2SimilarImages)
    document.addEventListener('msa1-to-msa3-similar-images', eventHandlers.handleMSA1SimilarImages)

    if (window.MSAEventBus) {
      window.MSAEventBus.on('msa2-image-selected', eventHandlers.handleImageSelected)
      window.MSAEventBus.on('msa2-similar-images', eventHandlers.handleSimilarImagesFound)
    }

    setTimeout(() => {
      try {
        const event = new CustomEvent('msa3-ready', { detail: true })
        document.dispatchEvent(event)
        if (window.MSAEventBus) {
          window.MSAEventBus.emit('msa3-ready', true)
        }
      } catch (error) {
        // silent
      }
    }, 500)

    resizeHandler.value = debounce(() => {
      initializeLayout()
    }, 250)
    window.addEventListener('resize', resizeHandler.value)
  } catch (error) {
    // silent
  }

  // Mounted
  onMounted(() => {
    resetState()
    if (dataPollingInterval.value) {
      clearInterval(dataPollingInterval.value)
      dataPollingInterval.value = null
    }
    cleanupGlobalData()

    nextTick(() => {
      initializeLayout()
      setTimeout(() => {
        if (!layoutInitialized.value) {
          initializeLayout()
        }
      }, 500)
    })
  })

  // BeforeUnmount
  onBeforeUnmount(() => {
    try {
      if (abortController.value) {
        abortController.value.abort()
        abortController.value = null
      }
      removeEventListeners()
      if (window.MSAEventBus) {
        window.MSAEventBus.off('msa2-image-selected', eventHandlers.handleImageSelected)
        window.MSAEventBus.off('msa2-similar-images', eventHandlers.handleSimilarImagesFound)
      }
      window.removeEventListener('resize', resizeHandler.value)
      if (dataPollingInterval.value) {
        clearInterval(dataPollingInterval.value)
      }
      cleanupGlobalData()
      similarImages.value = []
      mainImage.value = null
      selectedImage.value = null
    } catch (error) {
      // silent
    }
  })

  return {
    // State refs
    mainImage, similarImages, showImagePopup, selectedImage,
    errorMessage, debugMode, layoutInitialized,
    // Computed
    iAppSimilarImages, analysisSimilarImages,
    // Image state functions
    isIAppTag, getCleanFilename, formatSimilarity,
    // Image loader functions
    getImageUrl, handleImageError, handleImageLoad,
    // Event handler functions
    handleMSA2Event: eventHandlers.handleMSA2Event,
    handleMSA2SimilarImages: eventHandlers.handleMSA2SimilarImages,
    handleMSA1SimilarImages: eventHandlers.handleMSA1SimilarImages,
    handleImageSelected: eventHandlers.handleImageSelected,
    handleSimilarImagesFound: eventHandlers.handleSimilarImagesFound,
    // MSA4 communication functions
    sendAnalysisImagesToMSA4: msa4Comm.sendAnalysisImagesToMSA4,
    handleMainImageChanged: msa4Comm.handleMainImageChanged,
    sendSingleAnalysisImageToMSA4: msa4Comm.sendSingleAnalysisImageToMSA4,
    fetchWorkflowInfo: msa4Comm.fetchWorkflowInfo,
    handleAnalyzeRequest: msa4Comm.handleAnalyzeRequest,
    // Popup manager functions
    showImageDetailsPopup: popupManager.showImageDetailsPopup,
    selectSimilarImage: popupManager.selectSimilarImage,
    closeImagePopup: popupManager.closeImagePopup,
    // Layout functions
    initializeLayout
  }
}
