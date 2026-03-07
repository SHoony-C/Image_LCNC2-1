import { nextTick } from 'vue'

export function useMSA6Methods({ state, refs }) {
  const {
    isMaximized,
    finalImage,
    showResult,
    showMeasurementPopup,
    inputImage,
    msa5ImageAvailable,
    measurements
  } = state

  function checkMSA5StatusAndUpdateImage() {
    const hasMSA5EndImage = sessionStorage.getItem('msa5_end_image')

    if (hasMSA5EndImage === 'true') {
      msa5ImageAvailable.value = true

      if (localStorage.getItem('msa6_final_image')) {
        finalImage.value = localStorage.getItem('msa6_final_image')
        showResult.value = true
        inputImage.value = sessionStorage.getItem('msa5_start_image_url')
      } else {
        showResult.value = false
      }
    } else {
      msa5ImageAvailable.value = false
      finalImage.value = ''
      inputImage.value = null
      showResult.value = false
    }
  }

  function clearImageOnReload() {
    sessionStorage.setItem('image_cleared', 'true')
    setTimeout(() => {
      sessionStorage.removeItem('image_cleared')
    }, 1000)

    checkMSA5StatusAndUpdateImage()

    const popup = refs.measurementPopup.value
    if (popup && typeof popup.clearImage === 'function') {
      popup.clearImage()
    }
  }

  function handleMSA5ImageProcessed(event) {
    const { imageUrl, timestamp, noPopup } = event.detail

    finalImage.value = imageUrl
    showResult.value = true
    localStorage.setItem('msa6_final_image', imageUrl)
    inputImage.value = sessionStorage.getItem('msa5_start_image_url')
    msa5ImageAvailable.value = true

    if (noPopup === true) {
      sessionStorage.setItem('msa6_no_auto_popup', 'true')
    } else {
      const noAutoPopupFromStorage = sessionStorage.getItem('msa6_no_auto_popup') === 'true'
      // If flag exists, keep it; otherwise do nothing (no auto-popup by default)
    }
  }

  function handleMSA5ProcessStart(event) {
    try {
      const data = event.detail
      if (data && data.action === 'clear_measurements') {
        measurements.value = []

        const popup = refs.measurementPopup.value
        if (popup && typeof popup.clearMeasurements === 'function') {
          popup.clearMeasurements()
        }
      }
    } catch (error) {
      // silently handle
    }
  }

  function toggleMaximize() {
    isMaximized.value = !isMaximized.value
  }

  function openMeasurementPopup() {
    if (!finalImage.value) return

    showMeasurementPopup.value = true
    sessionStorage.removeItem('msa6_no_auto_popup')

    nextTick(() => {
      const teleportElements = document.querySelectorAll('.msa6-image-popup-container')
      teleportElements.forEach(element => {
        element.style.display = 'block'
        element.style.visibility = 'visible'
      })

      const popupContainer = document.querySelector('.image-measurement-popup')
      if (popupContainer) {
        popupContainer.style.removeProperty('display')
        popupContainer.style.removeProperty('visibility')
      }

      const popup = refs.measurementPopup.value
      if (popup && typeof popup.openPopup === 'function') {
        try {
          popup.openPopup(finalImage.value)
        } catch (error) {
          // silently handle
        }
      } else {
        console.error('MSA6: 측정 팝업 컴포넌트 참조 또는 openPopup 메서드를 찾을 수 없습니다.', {
          hasRef: !!popup,
          refType: popup ? typeof popup : 'undefined',
          hasMethod: popup ? typeof popup.openPopup : 'N/A'
        })
      }
    })
  }

  function closeMeasurementPopup() {
    showMeasurementPopup.value = false

    nextTick(() => {
      const popupContainer = document.querySelector('.image-measurement-popup')
      if (popupContainer) {
        popupContainer.style.display = 'none'
        popupContainer.style.visibility = 'hidden'
      }

      const teleportElements = document.querySelectorAll('.msa6-image-popup-container')
      teleportElements.forEach(element => {
        element.style.display = 'none'
        element.style.visibility = 'hidden'
      })
    })
  }

  function handleMeasurementAdded(measurement) {
    measurements.value = [...measurements.value, measurement]
  }

  function handleMeasurementRemoved(measurement) {
    if (measurement.itemId) {
      measurements.value = measurements.value.filter(m => m.itemId !== measurement.itemId)
    } else if (measurement.id) {
      measurements.value = measurements.value.filter(m => m.id !== measurement.id)
    } else {
      const index = measurements.value.indexOf(measurement)
      if (index > -1) {
        measurements.value = measurements.value.filter((_, i) => i !== index)
      }
    }
  }

  function handleMeasurementsCleared() {
    measurements.value = []
  }

  function handleMeasurementsUpdate(newMeasurements) {
    measurements.value = newMeasurements
  }

  return {
    checkMSA5StatusAndUpdateImage,
    clearImageOnReload,
    handleMSA5ImageProcessed,
    handleMSA5ProcessStart,
    toggleMaximize,
    openMeasurementPopup,
    closeMeasurementPopup,
    handleMeasurementAdded,
    handleMeasurementRemoved,
    handleMeasurementsCleared,
    handleMeasurementsUpdate
  }
}
