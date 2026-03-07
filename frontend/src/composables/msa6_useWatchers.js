import { watch, onMounted, onBeforeUnmount, nextTick, getCurrentInstance } from 'vue'

/**
 * Watchers and lifecycle hooks for msa6_image_popup1.
 */
export function useWatchers(deps) {
  const {
    props, canvas, container, sourceImage,
    ctx, image, imageData, scalebarManager, initialLoadDone,
    loadImage, onWindowResize, cleanupImageUrls,
    initScalebarManager,
    showNotification,
    isShowingInputImage, internalInputImageUrl,
    scaleMethod, magnification, scaleBarValue, scaleBarUnit,
    scaleBarDetected, scaleBarMeasurement, isDrawingScaleBar,
    manualScaleBar, manualScaleBarSet,
    scalebarManagerRef, scaleBarDeps,
    updateAllMeasurements, initializeMeasurements,
    handleKeyDown, handleKeyUp,
    handleMSA5ImageProcessed, handleMSA5ProcessStart,
    isVisible, openPopup, closePopup,
    pendingMeasurementMode,
    localMeasurements,
    buildComponentInterface,
  } = deps

  // =====================
  // Watchers
  // =====================
  let _isUpdatingMeasurements = false
  watch(() => props.measurements, (newMeasurements) => {
    try {
      if (_isUpdatingMeasurements) return
      _isUpdatingMeasurements = true
      if (Array.isArray(newMeasurements)) {
        localMeasurements.value = JSON.parse(JSON.stringify(newMeasurements))
      } else {
        localMeasurements.value = []
      }
    } catch (error) {
      console.error('[measurements watcher] Error:', error)
      localMeasurements.value = []
    } finally {
      _isUpdatingMeasurements = false
    }
  }, { immediate: true, deep: true })

  watch(() => props.imageUrl, (newUrl) => {
    if (newUrl) {
      isShowingInputImage.value = false
      nextTick(() => {
        loadImage(newUrl)
        if (scaleMethod.value === 'scaleBar' && isVisible.value && !scaleBarDetected.value) {
          setTimeout(() => {
            if (scalebarManager.value) scalebarManager.value.detectScaleBar()
          }, 1000)
        }
      })
    }
  }, { immediate: true })

  watch(() => props.inputImageUrl, (newUrl) => {
    if (newUrl) {
      internalInputImageUrl.value = newUrl
    } else {
      const msa5StartImage = sessionStorage.getItem('msa5_start_image_url')
      if (msa5StartImage) internalInputImageUrl.value = msa5StartImage
    }
  }, { immediate: true })

  watch(magnification, () => { updateAllMeasurements() })

  watch(() => props.showPopup, (newVal) => {
    isVisible.value = newVal
    if (newVal) {
      openPopup()
      if (!initialLoadDone.value) initialLoadDone.value = true
    }
  }, { immediate: true })

  watch(scaleBarDetected, (detected) => {
    if (detected) {
      if (scalebarManager.value) scalebarManager.value.saveScaleBarSettings()
      if (manualScaleBarSet.value && scaleBarValue.value && scaleBarUnit.value) return
    }
    if (!detected && scaleMethod.value === 'scaleBar' && isVisible.value) {
      nextTick(() => {
        if (scalebarManager.value) scalebarManager.value.showScaleDetectionFailurePopup()
      })
      showNotification('스케일바 자동 감지에 실패했습니다. 측정 방식을 선택해주세요.', 'warning')
    }
  })

  // =====================
  // Lifecycle
  // =====================
  onMounted(() => {
    nextTick(() => {
      const canvasEl = canvas.value
      if (canvasEl) {
        ctx.value = canvasEl.getContext('2d', { willReadFrequently: true })
      }
    })

    manualScaleBarSet.value = false
    internalInputImageUrl.value = props.inputImageUrl

    window.addEventListener('resize', onWindowResize)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('msa5-image-processed', handleMSA5ImageProcessed)
    window.addEventListener('msa6:imageProcessed', handleMSA5ImageProcessed)
    window.addEventListener('msa5-process-start', handleMSA5ProcessStart)

    nextTick(() => {
      const componentInterface = buildComponentInterface()
      initScalebarManager(componentInterface)
      scalebarManagerRef.value = scalebarManager.value
      scaleBarDeps.scalebarManager = scalebarManager
    })

    initializeMeasurements(props.measurements)

    const keydownHandler = (e) => {
      if (e.key === 'Escape') closePopup()
    }
    document.addEventListener('keydown', keydownHandler)

    onBeforeUnmount(() => {
      document.removeEventListener('keydown', keydownHandler)
    })
  })

  onBeforeUnmount(() => {
    cleanupImageUrls()
    try {
      window.removeEventListener('resize', onWindowResize)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('msa5-image-processed', handleMSA5ImageProcessed)
      window.removeEventListener('msa6:imageProcessed', handleMSA5ImageProcessed)
      window.removeEventListener('msa5-process-start', handleMSA5ProcessStart)
    } catch (error) {
      console.error('[beforeUnmount] Cleanup error:', error)
    }
  })
}
