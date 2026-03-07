<template>
  <div class="msa-component">
    <div class="card-header">
      <div class="header-left">
        <i class="fas fa-network-wired"></i>
        <span>3D Image Similarity Map

</span>
      </div>
    </div>

    <div class="status-message" v-if="message.show">
      <i :class="message.icon"></i>
      <span>{{ message.text }}</span>
    </div>

    <div class="content-container">
      <div class="plot-container">
        <div id="plotly-visualization" ref="plotlyContainer"></div>
        <div v-if="!isDataLoaded && !loadingComplete" class="loading-overlay">
          <div class="loading-spinner"></div>
          <div class="loading-message">데이터 로딩 중...</div>
        </div>
      </div>

      <div v-if="isProcessing" class="loading-overlay">
        <div class="loading-spinner"></div>
        <div class="loading-message">{{ loadingMessage }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>

<script>
import '@/assets/css/msa2_vector_plot.css'
import Plotly from 'plotly.js-dist'
import { ref, watch, getCurrentInstance } from 'vue'

// Plotly를 전역 객체로 설정 (window.Plotly 참조용)
window.Plotly = Plotly

// Composables
import { useUIState } from '../composables/msa2_useUIState'
import { useDataProcessing } from '../composables/msa2_useDataProcessing'
import { usePlotlyChart } from '../composables/msa2_usePlotlyChart'
import { useEventHandlers } from '../composables/msa2_useEventHandlers'
import { useLifecycle } from '../composables/msa2_useLifecycle'

export default {
  name: 'MSA4VectorTransform',
  emits: ['update-msa5-image'],
  setup() {
    // =============================================
    // Template ref
    // =============================================
    const plotlyContainer = ref(null)

    // =============================================
    // Get event bus from component instance
    // =============================================
    const instance = getCurrentInstance()
    const eventBus = instance?.proxy?.$eventBus || null

    // =============================================
    // 1. UI State
    // =============================================
    const {
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
    } = useUIState()

    // =============================================
    // 2. Data Processing (needs updatePlot from chart, wired below)
    // =============================================
    // We create a placeholder for updatePlot that will be set after chart composable init
    let _updatePlotFn = () => {}

    const {
      vectors,
      projectedVectors,
      labels,
      imageLabels,
      markerColors,
      markerSizes,
      similarImages,
      checkVectorsData,
      extractVectors,
      projectVectorsWith3DPCA,
      processVectorBySize,
      processTinyVector,
      processSmallVector,
      processMediumVector,
      processLargeVector,
      normalizeVectors,
      fallbackVectorProjection,
      calculate3DDistance,
      findSimilarImagesByDistance,
      findSimilarPoints,
      getApiEndpoint,
      getImageUrl,
      getImageNameFromUrl,
      compareFilenames,
      processVectorData,
      getTagGroups
    } = useDataProcessing({
      isDataLoaded,
      loadingComplete,
      loadingMessage,
      isLoading,
      isProcessing,
      showMessage,
      displayErrorMessage,
      updatePlot: () => _updatePlotFn()
    })

    // =============================================
    // 3. Event Handlers (needs chart functions, wired via deps)
    // =============================================
    // We create placeholders for chart functions that will be set after chart init
    let _highlightPointByColorFn = () => {}
    let _updatePlotMarkersFn = () => {}

    const {
      selectedImage,
      selectedFilename,
      selectedImageIndex,
      selectedIndex,
      selectedPoint,
      selectedImageName,
      currentImage,
      lastImageData,
      currentImageData,
      lastImageTimestamp,
      lastSimilarImagesRequestId,
      isSelectingImageFlag,
      msa1Element,
      msa5Element,
      msa1FindAttempts,
      maxFindAttempts,
      msa5MessageActive,
      componentFindInterval,
      showImagePopup,
      popupImageUrl,
      popupImageFilename,
      popupWorkflowData,
      showCoordinates,
      apiEndpoints,
      selectImageByIndex,
      findAndMonitorMSA1,
      setupMSA1Listeners,
      handleMSA1FileInputChange,
      handleMSA1ImageLoad,
      handleDirectImageData,
      processNewImage,
      connectToMSA3,
      sendImageDataToMSA3,
      sendImageSelectedToMSA3,
      handleImageUpdate,
      handleSimilarImagesFromMSA5,
      handleSimilarImagesFromMSA1,
      handleSimilarImageFromBackend,
      updatePlotWithSimilarImages,
      handleKeyDown,
      handleSelectImageByFilename
    } = useEventHandlers({
      projectedVectors,
      labels,
      similarImages,
      plotlyContainer,
      getImageUrl,
      getImageNameFromUrl,
      compareFilenames,
      findSimilarImagesByDistance,
      highlightPointByColor: (...args) => _highlightPointByColorFn(...args),
      updatePlotMarkers: (...args) => _updatePlotMarkersFn(...args),
      updatePlot: () => _updatePlotFn(),
      eventBus
    })

    // =============================================
    // 4. Plotly Chart
    // =============================================
    const {
      plot,
      resizeObserver,
      resizeHandler,
      containerObserver,
      containerWidth,
      containerHeight,
      plotSizeObserver,
      plotData,
      plotColors,
      plotOriginalColors,
      plotPointTypes,
      plotOriginalIndices,
      plotPointSizes,
      plotCenter,
      currentCameraPosition,
      plotLayout,
      lastHighlightIndex,
      setupResizeObserver,
      handleResize,
      initializePlot,
      handlePointClick,
      updatePlotMarkers,
      addSelectedPointTraces,
      updatePlot,
      highlightPointByColor,
      cleanupWebGLContexts,
      cleanup: cleanupChart
    } = usePlotlyChart({
      plotlyContainer,
      projectedVectors,
      labels,
      selectedIndex,
      calculate3DDistance,
      findSimilarPoints,
      selectImageByIndex
    })

    // Wire up the deferred function references
    _updatePlotFn = updatePlot
    _highlightPointByColorFn = highlightPointByColor
    _updatePlotMarkersFn = updatePlotMarkers

    // =============================================
    // Watch: vectors changes
    // =============================================
    watch(vectors, (newVectors) => {
      if (newVectors) {
        if (!markerSizes.value || markerSizes.value.length !== newVectors.length) {
          markerSizes.value = Array(newVectors.length).fill(6)
        }
        if (!markerColors.value || markerColors.value.length !== newVectors.length) {
          markerColors.value = Array(newVectors.length).fill('#1f77b4')
        }
      }
    }, { immediate: true })

    // =============================================
    // Lifecycle hooks (extracted to composable)
    // =============================================
    useLifecycle({
      instance,
      eventBus,
      plotlyContainer,
      selectedIndex,
      selectedFilename,
      checkVectorsData,
      handleKeyDown,
      handleImageUpdate,
      handleSimilarImagesFromMSA1,
      handleSimilarImageFromBackend,
      handleSimilarImagesFromMSA5,
      setupResizeObserver,
      initializePlot,
      resizeHandler,
      connectToMSA3,
      handleSelectImageByFilename,
      cleanupWebGLContexts,
      containerObserver,
      lastImageData,
      currentImageData,
      plotData,
      plotOriginalIndices
    })

    // =============================================
    // Return all template bindings
    // =============================================
    return {
      // Template ref
      plotlyContainer,

      // UI State
      isProcessing,
      isDataLoaded,
      loadingComplete,
      loadingMessage,
      message
    }
  }
}
</script>
