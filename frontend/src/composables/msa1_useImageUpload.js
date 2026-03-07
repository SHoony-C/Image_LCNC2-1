import LogService from '../utils/logService'

/**
 * Composable for MSA1 file upload handling.
 * Manages file input triggers, file selection, drag & drop, paste, and image processing pipeline.
 *
 * @param {Object} deps - Dependencies
 * @param {import('vue').Ref} deps.fileInputRef - Template ref to the file input element
 * @param {import('vue').Ref} deps.previewImage - Reactive ref to preview image data URL
 * @param {import('vue').Ref} deps.status - Reactive ref to status string
 * @param {import('vue').Ref} deps.statusText - Reactive ref to status text string
 * @param {import('vue').Ref} deps.isActive - Reactive ref to active state
 * @param {import('vue').Ref} deps.isProcessingImage - Reactive ref to processing flag
 * @param {Function} deps.checkAndResizeImage - Function to check/resize image
 * @param {Function} deps.searchSimilarImages - Function to search similar images
 * @param {Function} deps.dispatchImageEvents - Function to dispatch image events to other MSAs
 * @returns Upload handler functions
 */
export function useImageUpload(deps) {
  const {
    fileInputRef, previewImage, status, statusText,
    isActive, isProcessingImage,
    checkAndResizeImage, searchSimilarImages, dispatchImageEvents
  } = deps

  // 파일 입력 트리거
  const triggerFileInput = () => {
    if (!previewImage.value) {
      fileInputRef.value.click()
    }
  }

  // 파일 선택 핸들러
  const handleFileSelect = (event) => {
    const file = event.target.files[0]
    if (file) {
      processImage(file)
    }
  }

  // 드래그 앤 드롭 핸들러
  const handleDrop = (event) => {
    const file = event.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      processImage(file)
    }
  }

  // 붙여넣기 핸들러
  const handlePaste = (event) => {
    event.preventDefault()
    if (isProcessingImage.value) return

    const clipboard = event.clipboardData || event.originalEvent.clipboardData
    let file = null
    if (clipboard.items) {
      for (const item of clipboard.items) {
        if (item.type.startsWith('image/')) {
          file = item.getAsFile()
          break
        }
      }
    }
    if (!file && clipboard.files?.length) {
      const candidate = clipboard.files[0]
      if (candidate.type.startsWith('image/')) file = candidate
    }
    if (!file) return

    isProcessingImage.value = true
    // processImage가 Promise라면 finally가 정상 동작
    processImage(file).finally(() => {
      isProcessingImage.value = false
    })
  }

  // 이미지 처리 파이프라인
  const processImage = (file) => {
    // Promise 반환
    return new Promise((resolve, reject) => {
      if (!(file && file.type.startsWith('image/'))) {
        resolve()
        return
      }

      const reader = new FileReader()

      reader.onerror = (err) => {
        console.error('[MSA1] FileReader error:', err)
        reject(err)
      }

      reader.onload = async (e) => {
        try {
          // 1) 이미지 용량 체크 및 해상도 조정
          const processedImageData = await checkAndResizeImage(e.target.result, file.name)

          // 2) preview/status 업데이트
          previewImage.value  = processedImageData
          status.value        = 'processing'
          statusText.value    = '유사 이미지 검색 중...'
          isActive.value      = true

          // 3) 로그 저장
          LogService.logAction('upload_image', {
            filename: file.name,
            filesize: file.size,
            filetype: file.type
          })

          // 4) 유사 이미지 검색
          try {
            await searchSimilarImages(file.name, processedImageData)
            status.value     = 'success'
            statusText.value = '이미지 준비됨'
          } catch (err) {
            console.error('[MSA1] 유사 이미지 검색 실패:', err)
            status.value     = 'warning'
            statusText.value = '검색 실패'
          }

          // 5) MSA4, MSA5로 이벤트 발송
          dispatchImageEvents(processedImageData, file.name)

          resolve()
        } catch (err) {
          reject(err)
        }
      }

      reader.readAsDataURL(file)
    })
  }

  return {
    triggerFileInput,
    handleFileSelect,
    handleDrop,
    handlePaste,
    processImage
  }
}
