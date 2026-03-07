import Plotly from 'plotly.js-dist'
import { onMounted, onUnmounted } from 'vue'

export function useLifecycle({
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
}) {
  onMounted(() => {
    selectedIndex.value = -1
    selectedFilename.value = null

    checkVectorsData()

    window.addEventListener('keydown', handleKeyDown)
    document.addEventListener('msa1-to-msa4-image', handleImageUpdate)
    document.addEventListener('msa1-to-msa2-similar-images', handleSimilarImagesFromMSA1)
    document.addEventListener('backend-to-msa2-similar-image', handleSimilarImageFromBackend)
    document.addEventListener('msa5-to-msa4-similar-images', handleSimilarImagesFromMSA5)

    const el = instance?.proxy?.$el
    if (el) {
      setupResizeObserver(el)
    }

    initializePlot()

    resizeHandler.value = () => {
      if (plotlyContainer.value) {
        Plotly.Plots.resize(plotlyContainer.value)
      }
    }
    window.addEventListener('resize', resizeHandler.value)

    setTimeout(() => {
      connectToMSA3()
    }, 2000)

    if (eventBus) {
      eventBus.on('select-image-by-filename', handleSelectImageByFilename)
    }
  })

  onUnmounted(() => {
    cleanupWebGLContexts()

    window.removeEventListener('keydown', handleKeyDown)
    document.removeEventListener('msa1-to-msa4-image', handleImageUpdate)
    document.removeEventListener('msa1-to-msa2-similar-images', handleSimilarImagesFromMSA1)
    document.removeEventListener('backend-to-msa2-similar-image', handleSimilarImageFromBackend)
    document.removeEventListener('msa5-to-msa4-similar-images', handleSimilarImagesFromMSA5)

    if (containerObserver.value) {
      containerObserver.value.disconnect()
    }

    if (resizeHandler.value) {
      window.removeEventListener('resize', resizeHandler.value)
    }

    if (plotlyContainer.value) {
      Plotly.purge(plotlyContainer.value)
    }

    if (eventBus) {
      eventBus.off('select-image-by-filename', handleSelectImageByFilename)
    }

    lastImageData.value = null
    currentImageData.value = null
    plotData.value = []
    plotOriginalIndices.value = []
  })
}
