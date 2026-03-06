import { ref } from 'vue'

/**
 * Composable for image management (setImage, hash, format detection, export, MSA6 communication).
 *
 * @param {import('vue').Ref} elements - Reactive ref to workflow elements array
 * @param {import('vue').Ref} inputImage - Reactive ref to input image URL
 * @param {Object} processedImages - Reactive object mapping nodeId -> processed image URL
 * @param {Object} uiState - UI state refs
 * @param {Object} persistenceState - Persistence-related refs and functions
 * @returns Image management functions
 */
export function useImageManagement(
  elements, inputImage, processedImages,
  uiState, persistenceState
) {
  const { showStatusMessage, statusMessage } = uiState
  const {
    canSaveWorkflow,
    currentImageTitle,
    calculateImageHash,
    checkSavedWorkflow,
    workflowName,
    workflowDescription
  } = persistenceState

  // 이미지 설정 함수 (MSA4에서 이미지를 받아올 때 호출)
  const setImage = async (imageUrl, imageTitle, fromMSA1 = false) => {
    inputImage.value = imageUrl
    currentImageTitle.value = imageTitle ? imageTitle.replace(/ /g, '_') : ''

    if (imageUrl && !fromMSA1) {
      try {
        const imageHash = await calculateImageHash(imageUrl)
        canSaveWorkflow.value = true
        checkSavedWorkflow(imageHash)
      } catch (error) {
        console.error('이미지 해시 계산 중 오류:', error)
      }
    } else if (fromMSA1) {
      canSaveWorkflow.value = true
    }
  }

  // MSA6로 이미지 전송 함수
  const sendImageToMSA6 = (imageUrl, imageFormat) => {
    try {
      if (!imageUrl) {
        console.error('[sendImageToMSA6] 이미지 URL이 없습니다.')
        return false
      }

      // 워크플로우 메타데이터 수집
      const nodeCount = elements.value.filter(el => el.type !== 'smoothstep').length - 2
      const connectionCount = elements.value.filter(el => el.type === 'smoothstep').length

      const nodeTypes = elements.value
        .filter(el => el.type !== 'smoothstep' && el.id !== 'start' && el.id !== 'end')
        .map(node => ({
          id: node.id,
          type: node.data?.nodeId || node.data?.id || 'unknown',
          label: node.data?.label || 'Unknown Node'
        }))

      const imageTitle = workflowName.value || currentImageTitle.value || `processed_${Date.now()}`

      const imageData = {
        imageUrl: imageUrl,
        format: imageFormat || 'png',
        title: imageTitle,
        source: 'MSA5',
        timestamp: new Date().toISOString(),
        noPopup: true,
        metadata: {
          workflow_name: workflowName.value || '',
          workflow_description: workflowDescription.value || '',
          node_count: nodeCount,
          connection_count: connectionCount,
          nodes: nodeTypes,
          processing_type: 'image_lcnc'
        }
      }

      // 세션 스토리지에 데이터 저장
      sessionStorage.setItem('msa5_to_msa6_image_data', JSON.stringify(imageData))
      sessionStorage.setItem('msa5_end_image', 'true')
      sessionStorage.setItem('msa6_no_auto_popup', 'true')

      // 이벤트 발생
      const customEvent = new CustomEvent('msa5-to-msa6-image', {
        detail: imageData,
        bubbles: true,
        cancelable: true
      })

      const msa6Event = new CustomEvent('msa5-image-processed', {
        detail: {
          imageUrl: imageUrl,
          timestamp: Date.now(),
          title: imageTitle,
          format: imageFormat || 'png',
          noPopup: true,
          metadata: imageData.metadata
        },
        bubbles: true,
        cancelable: true
      })

      document.dispatchEvent(customEvent)
      window.dispatchEvent(customEvent)
      document.dispatchEvent(msa6Event)
      window.dispatchEvent(msa6Event)

      // localStorage 기반 통신
      localStorage.setItem('msa5_latest_image', JSON.stringify({
        url: imageUrl,
        title: imageTitle,
        timestamp: Date.now(),
        format: imageFormat || 'png'
      }))

      localStorage.setItem('msa6_final_image', imageUrl)

      // 글로벌 이벤트
      if (!window.msa5LatestImage) {
        window.msa5LatestImage = {}
      }
      window.msa5LatestImage = {
        url: imageUrl,
        title: imageTitle,
        timestamp: Date.now(),
        format: imageFormat || 'png',
        metadata: imageData.metadata
      }

      // 직접 MSA6 접근 시도
      const msa6Component = document.querySelector('.msa6-component')
      if (msa6Component) {
        const msa6Instance = msa6Component.__vue__
        if (msa6Instance && typeof msa6Instance.setImage === 'function') {
          msa6Instance.setImage(imageUrl, imageTitle)
        }
      }

      showStatusMessage.value = true
      statusMessage.value = 'MSA6로 이미지 전송 완료'
      setTimeout(() => { showStatusMessage.value = false }, 3000)

      return true
    } catch (error) {
      console.error('[sendImageToMSA6] MSA6로 이미지 전송 중 오류:', error)
      showStatusMessage.value = true
      statusMessage.value = `MSA6 전송 오류: ${error.message}`
      setTimeout(() => { showStatusMessage.value = false }, 3000)
      return false
    }
  }

  // 외부 저장소로 이미지 내보내기
  const exportImagesToExternal = async () => {
    try {
      if (!inputImage.value || !processedImages['end']) {
        throw new Error('내보낼 이미지가 없습니다.')
      }

      const title = workflowName.value || ''
      if (!title) {
        throw new Error('워크플로우 이름이 필요합니다.')
      }

      const sessionId = `workflow_${Date.now()}`
      const beforeFilename = `${title}_before`
      const afterFilename = `${title}_after`

      const blobToBase64 = async (blobUrl) => {
        try {
          if (blobUrl.startsWith('data:')) {
            return blobUrl
          }
          const response = await fetch(blobUrl)
          if (!response.ok) {
            throw new Error(`Blob URL 가져오기 실패: ${response.status}`)
          }
          const blob = await response.blob()
          console.log('Blob 정보 (상세):', {
            type: blob.type,
            size: blob.size + ' bytes',
            lastModified: blob.lastModified ? new Date(blob.lastModified).toISOString() : 'N/A'
          })
          return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result)
            reader.onerror = (e) => {
              console.error('FileReader 오류 (상세):', e)
              reject(new Error('이미지 읽기 오류'))
            }
            reader.readAsDataURL(blob)
          })
        } catch (error) {
          console.error('Base64 변환 중 오류:', error)
          return blobUrl
        }
      }

      const beforeImageBase64 = await blobToBase64(inputImage.value)

      let afterImageBase64
      try {
        afterImageBase64 = await blobToBase64(processedImages['end'])
      } catch (conversionError) {
        console.error('표준 방식 변환 실패:', conversionError)
        try {
          const response = await fetch(processedImages['end'])
          const blob = await response.blob()
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.onerror = (e) => {
              console.error('FileReader 오류:', e)
              reject(new Error('이미지 읽기 오류'))
            }
            reader.readAsDataURL(blob)
          })
          afterImageBase64 = dataUrl
        } catch (alternativeError) {
          console.error('대체 방식도 실패:', alternativeError)
          afterImageBase64 = processedImages['end']
        }
      }

      let result

      try {
        const response = await fetch('http://localhost:8000/api/external_storage/save-images', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          mode: 'cors',
          credentials: 'include',
          body: JSON.stringify({
            title: workflowName.value.replace(/ /g, '_'),
            description: workflowDescription.value || '',
            before_image: beforeImageBase64,
            after_image: afterImageBase64,
            workflow_id: sessionId,
            tags: ['lcnc', '이미지 처리'],
            is_result: false
          })
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('JSON 방식 API 오류:', response.status, errorText)
          throw new Error(`JSON 방식 실패 (${response.status})`)
        }

        result = await response.json()
      } catch (jsonError) {
        console.error('JSON 방식 실패, FormData 방식으로 재시도:', jsonError)

        try {
          const beforeBlob = await (async () => {
            const res = await fetch(inputImage.value)
            return await res.blob()
          })()

          const afterBlob = await (async () => {
            const res = await fetch(processedImages['end'])
            return await res.blob()
          })()

          const formData = new FormData()
          formData.append('title', title)
          formData.append('description', workflowDescription.value || '')
          formData.append('before_file', beforeBlob, `${beforeFilename}.${beforeBlob.type.split('/')[1] || 'png'}`)
          formData.append('file', afterBlob, `${afterFilename}.${afterBlob.type.split('/')[1] || 'png'}`)
          formData.append('workflow_id', sessionId)
          formData.append('tags', JSON.stringify(['lcnc', '이미지 처리']))
          formData.append('is_result', 'false')

          const formResponse = await fetch('http://localhost:8000/api/external_storage/upload-file', {
            method: 'POST',
            mode: 'cors',
            credentials: 'include',
            body: formData
          })

          if (!formResponse.ok) {
            const errorText = await formResponse.text()
            console.error('FormData 방식 API 오류:', formResponse.status, errorText)
            throw new Error(`FormData 방식 실패 (${formResponse.status}): ${errorText}`)
          }

          result = await formResponse.json()
        } catch (formError) {
          console.error('FormData 방식도 실패:', formError)
          throw new Error('모든 이미지 저장 방식이 실패했습니다.')
        }
      }

      if (result && result.session_id) {
        localStorage.setItem('current_workflow_session_id', result.session_id)
      } else {
        localStorage.setItem('current_workflow_session_id', sessionId)
      }

      return result
    } catch (error) {
      console.error('이미지 내보내기 중 오류:', error)
      throw error
    }
  }

  // 유사 이미지 검색 기능
  const findSimilarForEndImage = async () => {
    if (!processedImages['end']) {
      showStatusMessage.value = true
      statusMessage.value = '검색할 이미지가 없습니다.'
      setTimeout(() => { showStatusMessage.value = false }, 3000)
      return
    }

    try {
      showStatusMessage.value = true
      statusMessage.value = '유사 이미지 검색 중...'

      if (processedImages['end'].startsWith('blob:')) {
        const response = await fetch(processedImages['end'])
        const blob = await response.blob()

        const formData = new FormData()
        formData.append('image', blob)

        const searchEvent = new CustomEvent('msa5-similar-image-search', {
          detail: {
            imageUrl: processedImages['end'],
            blob: blob,
            timestamp: new Date().toISOString()
          }
        })

        window.dispatchEvent(searchEvent)
        document.dispatchEvent(searchEvent)
      } else {
        const searchEvent = new CustomEvent('msa5-similar-image-search', {
          detail: {
            imageUrl: processedImages['end'],
            timestamp: new Date().toISOString()
          }
        })

        window.dispatchEvent(searchEvent)
        document.dispatchEvent(searchEvent)
      }

      statusMessage.value = '유사 이미지 검색 요청을 전송했습니다.'
      setTimeout(() => { showStatusMessage.value = false }, 3000)
    } catch (error) {
      console.error('유사 이미지 검색 중 오류:', error)
      statusMessage.value = `유사 이미지 검색 오류: ${error.message}`
      setTimeout(() => { showStatusMessage.value = false }, 3000)
    }
  }

  // MSA6 전송 버튼 핸들러
  const handleMSA6Transfer = (previewImageUrl) => {
    try {
      const msa6Btn = document.querySelector('.msa6-btn')
      if (msa6Btn) {
        const originalHTML = msa6Btn.innerHTML
        msa6Btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 전송 중...'
        msa6Btn.disabled = true
        msa6Btn.style.backgroundColor = '#94d3a2'

        const imageFormat = sessionStorage.getItem('msa5_end_image_format') || 'png'
        const success = sendImageToMSA6(previewImageUrl.value, imageFormat)

        sessionStorage.setItem('msa5_end_image', 'true')
        localStorage.setItem('msa6_final_image', previewImageUrl.value)

        const msa6Event = new CustomEvent('msa5-image-processed', {
          detail: {
            imageUrl: previewImageUrl.value,
            timestamp: Date.now()
          },
          bubbles: true,
          cancelable: true
        })
        document.dispatchEvent(msa6Event)
        window.dispatchEvent(msa6Event)

        setTimeout(() => {
          if (success) {
            msa6Btn.innerHTML = '<i class="fas fa-check"></i> 전송 완료'
            msa6Btn.style.backgroundColor = '#10b981'
          } else {
            msa6Btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 전송 실패'
            msa6Btn.style.backgroundColor = '#f87171'
          }

          setTimeout(() => {
            msa6Btn.innerHTML = originalHTML
            msa6Btn.disabled = false
            msa6Btn.style.backgroundColor = ''
          }, 2000)
        }, 1000)
      } else {
        const imageFormat = sessionStorage.getItem('msa5_end_image_format') || 'png'
        sendImageToMSA6(previewImageUrl.value, imageFormat)
      }
    } catch (error) {
      console.error('MSA6 전송 처리 중 오류:', error)
      showStatusMessage.value = true
      statusMessage.value = `MSA6 전송 오류: ${error.message}`
      setTimeout(() => { showStatusMessage.value = false }, 3000)
    }
  }

  return {
    setImage,
    sendImageToMSA6,
    exportImagesToExternal,
    findSimilarForEndImage,
    handleMSA6Transfer
  }
}
