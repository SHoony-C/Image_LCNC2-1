import { ref } from 'vue'

/**
 * Composable for MSA2 event handlers: image selection, cross-component communication,
 * MSA1/MSA3/MSA5 integration, keyboard handling, and image processing.
 *
 * @param {Object} deps - Dependencies
 * @param {import('vue').Ref} deps.projectedVectors
 * @param {import('vue').Ref} deps.labels
 * @param {import('vue').Ref} deps.similarImages
 * @param {import('vue').Ref} deps.plotlyContainer - template ref
 * @param {Function} deps.getImageUrl
 * @param {Function} deps.getImageNameFromUrl
 * @param {Function} deps.compareFilenames
 * @param {Function} deps.findSimilarImagesByDistance
 * @param {Function} deps.highlightPointByColor
 * @param {Function} deps.updatePlotMarkers
 * @param {Function} deps.updatePlot
 * @param {Object} deps.eventBus - Vue event bus ($eventBus)
 * @returns event handling state and functions
 */
export function useEventHandlers(deps) {
  const selectedImage = ref(null)
  const selectedFilename = ref(null)
  const selectedImageIndex = ref(-1)
  const selectedIndex = ref(-1)
  const selectedPoint = ref(null)
  const selectedImageName = ref(null)
  const currentImage = ref(null)
  const lastImageData = ref(null)
  const currentImageData = ref(null)
  const lastImageTimestamp = ref(0)
  const lastSimilarImagesRequestId = ref(null)
  const isSelectingImageFlag = ref(false)

  const msa1Element = ref(null)
  const msa5Element = ref(null)
  const msa1FindAttempts = ref(0)
  const maxFindAttempts = ref(5)
  const msa5MessageActive = ref(false)
  const componentFindInterval = ref(null)

  const showImagePopup = ref(false)
  const popupImageUrl = ref('')
  const popupImageFilename = ref('')
  const popupWorkflowData = ref(null)

  const showCoordinates = ref(true)

  const apiEndpoints = ref([
    '/api/process-image',
    '/api/msa4/process-image',
    '/api/vectors/extract'
  ])

  // ========================================
  // Image selection
  // ========================================
  function selectImageByIndex(index) {
    console.log(`======= 이미지 선택 시작 (인덱스: ${index}) =======`)

    if (index === undefined || index === null || isNaN(index)) {
      console.error(`유효하지 않은 인덱스 타입: ${typeof index}, 값: ${index}`)
      return
    }

    if (index < 0 || index >= deps.labels.value.length) {
      console.error(`인덱스 범위 오류: ${index}, 유효 범위: 0-${deps.labels.value.length - 1}`)
      return
    }

    // 동일한 이미지 재선택 방지
    if (selectedIndex.value === index) {
      return
    }

    try {
      const prevSelectedIndex = selectedIndex.value

      selectedIndex.value = index
      selectedFilename.value = deps.labels.value[index]

      const selectedImageInfo = {
        url: deps.getImageUrl(deps.labels.value[index]),
        filename: deps.labels.value[index],
        index: index
      }

      // 3D 그래프에서 선택된 점 강조 표시
      try {
        deps.highlightPointByColor(index)
      } catch (plotError) {
        // ignore
      }

      // 전역 객체에 직접 저장
      if (window.MSASharedData) {
        window.MSASharedData.currentImage = selectedImageInfo
      } else {
        window.MSASharedData = {
          currentImage: selectedImageInfo,
          similarImages: []
        }
      }

      // 유사 이미지 찾기
      deps.findSimilarImagesByDistance(index)
        .then(similarImagesResult => {
          if (window.MSASharedData) {
            window.MSASharedData.similarImages = similarImagesResult
          }

          sendImageDataToMSA3(selectedImageInfo)
        })
        .catch(error => {
          sendImageDataToMSA3(selectedImageInfo)
        })

      console.log(`======= 이미지 선택 완료 (인덱스: ${index}) =======`)
    } catch (error) {
      console.error('이미지 선택 처리 중 오류 발생:', error)
    }
  }

  // ========================================
  // MSA1 integration
  // ========================================
  function findAndMonitorMSA1() {
    const selectors = [
      '#msa1-component', '.msa1-component', '[data-component="msa1"]', '.msa1',
      '.top-row .msa1', '.main-container .msa1', '.upper-section .msa1',
      'div[id*="msa1"]', 'div[class*="msa1"]'
    ]

    for (const selector of selectors) {
      const element = document.querySelector(selector)
      if (element) {
        msa1Element.value = element
        setupMSA1Listeners(element)
        return
      }
    }

    const msa5Selectors = [
      '#msa5-component', '.msa5-component', '[data-component="msa5"]', '.msa5',
      '.bottom-row .msa5', 'div[id*="msa5"]', 'div[class*="msa5"]'
    ]

    for (const selector of msa5Selectors) {
      const element = document.querySelector(selector)
      if (element) {
        msa5Element.value = element
      }
    }

    if (!msa1Element.value && msa1FindAttempts.value < maxFindAttempts.value) {
      msa1FindAttempts.value++
      setTimeout(() => findAndMonitorMSA1(), 1000)
    }
  }

  function setupMSA1Listeners(element) {
    const fileInputs = element.querySelectorAll('input[type="file"]')
    if (fileInputs.length > 0) {
      fileInputs.forEach(input => {
        input.addEventListener('change', handleMSA1FileInputChange)
      })
    }

    const images = element.querySelectorAll('img')
    if (images.length > 0) {
      images.forEach(img => {
        img.addEventListener('load', handleMSA1ImageLoad)
      })
    }
  }

  function handleMSA1FileInputChange(event) {
    const files = event.target.files
    if (files && files.length > 0) {
      const file = files[0]

      const imageUrl = URL.createObjectURL(file)
      processNewImage({
        imageUrl: imageUrl,
        imageName: file.name,
        source: 'msa1-file-input'
      })
    }
  }

  function handleMSA1ImageLoad(event) {
    const img = event.target
    if (img.src && img.complete && img.naturalWidth > 0) {
      const currentTime = Date.now()
      if (currentTime - lastImageTimestamp.value > 1000) {
        lastImageTimestamp.value = currentTime
        processNewImage({
          imageUrl: img.src,
          imageName: deps.getImageNameFromUrl(img.src),
          source: 'msa1-image-load'
        })
      }
    }
  }

  // ========================================
  // Direct image handler
  // ========================================
  function handleDirectImageData(imageData) {
    if (!imageData || (!imageData.imageUrl && !imageData.url)) {
      return
    }

    const processData = {
      imageUrl: imageData.imageUrl || imageData.url,
      imageName: imageData.imageName || imageData.name || deps.getImageNameFromUrl(imageData.imageUrl || imageData.url),
      source: imageData.source || 'external-direct'
    }

    processNewImage(processData)
  }

  // processNewImage - referenced but not defined in original; keep as stub
  function processNewImage(data) {
    // This method is called but was never defined in the original component.
    // It likely was intended as a placeholder. We keep it as a no-op to maintain compatibility.
    console.log('[MSA2] processNewImage called:', data)
  }

  // ========================================
  // MSA3 communication
  // ========================================
  function connectToMSA3() {
    const msa3El = document.querySelector('.msa3-container')
    if (msa3El) {
      if (selectedIndex.value >= 0 && selectedFilename.value) {
        console.log(`MSA2: MSA3로 선택된 이미지 정보 전송: ${selectedFilename.value}`)

        const selectedImageInfo = {
          filename: selectedFilename.value,
          url: deps.getImageUrl(selectedFilename.value),
          index: selectedIndex.value
        }

        sendImageDataToMSA3(selectedImageInfo)

        if (window.MSASharedData) {
          window.MSASharedData.currentImage = selectedImageInfo

          if (deps.similarImages.value && deps.similarImages.value.length > 0) {
            window.MSASharedData.similarImages = deps.similarImages.value
          }
        }
      }
    }
  }

  function sendImageDataToMSA3(imageData) {
    try {
      if (deps.eventBus) {
        deps.eventBus.emit('image-selected', imageData)
      }

      const event = new CustomEvent('msa2-to-msa3-image-selected', {
        detail: imageData,
        bubbles: true
      })
      document.dispatchEvent(event)

      deps.findSimilarImagesByDistance(imageData.index)
        .then(similarImagesResult => {
          if (similarImagesResult && similarImagesResult.length > 0) {
            const msa2SimilarImages = similarImagesResult.map(img => ({
              ...img,
              fromMSA1: false
            }))

            if (deps.eventBus) {
              deps.eventBus.emit('similar-images-found', msa2SimilarImages)
            }

            const similarEvent = new CustomEvent('msa2-to-msa3-similar-images', {
              detail: msa2SimilarImages,
              bubbles: true
            })
            document.dispatchEvent(similarEvent)

            const iAppCount = msa2SimilarImages.filter(img => img.tag_type === 'I-TAP').length
            const analysisCount = msa2SimilarImages.filter(img => img.tag_type === 'Analysis').length

            console.log(`MSA2에서 전송: 선택된 이미지 1개 / ${msa2SimilarImages.length}개의 유사 이미지 (I-app: ${iAppCount}, Analysis: ${analysisCount})`)
          }
        })
        .catch(error => {
          console.error('유사 이미지 검색 및 전송 오류:', error)
        })
    } catch (error) {
      console.error('MSA2: MSA3로 이미지 데이터 전송 오류:', error)
    }
  }

  function sendImageSelectedToMSA3(mainImage, similarImagesResult) {
    try {
      const msa3Event = new CustomEvent('msa2-to-msa3-image-selected', {
        detail: {
          selectedImage: mainImage,
          similarImages: similarImagesResult
        }
      })
      document.dispatchEvent(msa3Event)
    } catch (error) {
      console.error('[MSA2] MSA3 이벤트 전송 오류:', error)
    }
  }

  // ========================================
  // Event handlers for incoming events
  // ========================================

  // handleImageUpdate - referenced but not defined in original
  function handleImageUpdate(event) {
    // Placeholder - this method was referenced in addEventListener but never defined in the original
    console.log('[MSA2] handleImageUpdate called:', event?.detail)
  }

  // handleSimilarImagesFromMSA5 - referenced but not defined in original
  function handleSimilarImagesFromMSA5(event) {
    // Placeholder - this method was referenced in addEventListener but never defined in the original
    console.log('[MSA2] handleSimilarImagesFromMSA5 called:', event?.detail)
  }

  function handleSimilarImagesFromMSA1(event) {
    try {
      const { mainImage, similarImages: simImages, uploadedVector, totalCompared } = event.detail

      if (uploadedVector && uploadedVector.length === 3) {
        // uploadedVector can be used to add to existing vectors
      }

      deps.similarImages.value = simImages || []

      selectedImage.value = mainImage
      selectedImageName.value = mainImage.filename

      updatePlotWithSimilarImages(mainImage, simImages)

      sendImageSelectedToMSA3(mainImage, simImages)
    } catch (error) {
      // ignore
    }
  }

  function handleSimilarImageFromBackend(event) {
    try {
      const { filename, similarity, source_image, tag_type, index } = event.detail

      if (!filename) {
        console.warn('[MSA2] 최유사 이미지 파일명이 없습니다')
        return
      }

      if (typeof index === 'number' && index >= 0) {
        selectImageByIndex(index)
        return
      }

      let imageIndex = -1
      if (deps.labels.value && deps.labels.value.length > 0) {
        imageIndex = deps.labels.value.findIndex(label => {
          if (typeof label === 'string' && typeof filename === 'string') {
            return label === filename ||
                   label.includes(filename) ||
                   filename.includes(label) ||
                   deps.compareFilenames(label, filename)
          }
          return false
        })
      }

      if (imageIndex !== -1) {
        selectImageByIndex(imageIndex)
      }
    } catch (error) {
      console.error('[MSA2] 백엔드 최유사 이미지 처리 오류:', error)
    }
  }

  function updatePlotWithSimilarImages(mainImage, simImages) {
    try {
      if (!deps.projectedVectors.value || deps.projectedVectors.value.length === 0) {
        console.warn('[MSA2] 기존 벡터 데이터가 없어 유사 이미지 하이라이트를 건너뜁니다')
        return
      }

      if (!deps.labels.value || deps.labels.value.length === 0) {
        console.warn('[MSA2] 기존 라벨 데이터가 없어 유사 이미지 하이라이트를 건너뜁니다')
        return
      }

      let mainImageIndex = -1
      if (deps.labels.value) {
        mainImageIndex = deps.labels.value.findIndex(label => {
          if (typeof label === 'string' && typeof mainImage.filename === 'string') {
            return label === mainImage.filename ||
                   label.includes(mainImage.filename) ||
                   mainImage.filename.includes(label) ||
                   deps.compareFilenames(label, mainImage.filename)
          }
          return false
        })
      }

      if (mainImageIndex !== -1) {
        selectedIndex.value = mainImageIndex
        deps.updatePlotMarkers(mainImageIndex)
      } else {
        if (simImages && simImages.length > 0) {
          const firstSimilarImage = simImages[0]

          const fallbackIndex = deps.labels.value.findIndex(label => {
            if (typeof label === 'string' && typeof firstSimilarImage.filename === 'string') {
              return label === firstSimilarImage.filename ||
                     label.includes(firstSimilarImage.filename) ||
                     firstSimilarImage.filename.includes(label) ||
                     deps.compareFilenames(label, firstSimilarImage.filename)
            }
            return false
          })

          if (fallbackIndex !== -1) {
            selectImageByIndex(fallbackIndex)
          } else {
            console.warn('[MSA2] 유사 이미지도 기존 데이터에서 찾을 수 없습니다')
          }
        }
      }
    } catch (error) {
      console.error('[MSA2] 플롯 업데이트 오류:', error)
    }
  }

  // handleKeyDown - referenced but not defined in original
  function handleKeyDown(event) {
    // Placeholder - this method was referenced in addEventListener but never defined in the original
  }

  // handleSelectImageByFilename - referenced but not defined in original
  function handleSelectImageByFilename(data) {
    // Placeholder - this method was referenced in $eventBus.on but never defined in the original
    console.log('[MSA2] handleSelectImageByFilename called:', data)
  }

  return {
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
  }
}
