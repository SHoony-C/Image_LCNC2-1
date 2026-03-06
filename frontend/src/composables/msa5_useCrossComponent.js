/**
 * Composable for cross-component event communication (MSA1/MSA3/MSA4/MSA6).
 *
 * @param {import('vue').Ref} elements - Reactive ref to workflow elements array
 * @param {import('vue').Ref} inputImage - Reactive ref to input image URL
 * @param {Object} processedImages - Reactive object mapping nodeId -> processed image URL
 * @param {Object} uiState - UI state refs
 * @param {Object} persistenceState - Persistence-related refs and functions
 * @param {Function} setImage - Function to set image
 * @returns Cross-component event handlers
 */
export function useCrossComponent(
  elements, inputImage, processedImages,
  uiState, persistenceState, setImage
) {
  const { showStatusMessage, statusMessage } = uiState
  const {
    workflowName,
    prepareElementsForLoad
  } = persistenceState

  // MSA4나 MSA1에서 이미지 데이터 받기 - 이벤트 핸들러
  const handleImageUpdate = (event) => {
    try {
      const data = event.detail

      if (!data) {
        console.warn('MSA5: 이벤트에 데이터가 없습니다')
        return
      }

      const imageUrl = data.imageUrl || data.url || data.image
      const imageTitle = data.imageTitle || data.title || data.name || ''

      if (!imageUrl) {
        console.warn('MSA5: 이벤트에 이미지 URL이 없습니다')
        return
      }

      const fromMSA1 = event.type === 'msa1-to-msa5-image'

      setImage(imageUrl, imageTitle, fromMSA1)

      processedImages['start'] = imageUrl
      sessionStorage.setItem('msa5_start_image_url', imageUrl)
    } catch (error) {
      console.error('MSA5: 이미지 업데이트 처리 중 오류 발생', error)
    }
  }

  // MSA4에서 워크플로우 데이터 받기 - 이벤트 핸들러
  const handleWorkflowFromMSA4 = (workflowString) => {
    try {
      const workflowData = JSON.parse(workflowString)

      if (workflowData && workflowData.elements && Array.isArray(workflowData.elements)) {
        elements.value = prepareElementsForLoad(workflowData.elements)

        if (workflowData.input_image_url) {
          inputImage.value = workflowData.input_image_url
        }

        if (workflowData.workflow_name) {
          workflowName.value = workflowData.workflow_name
        }

        showStatusMessage.value = true
        statusMessage.value = 'MSA4에서 워크플로우를 가져왔습니다.'
        setTimeout(() => { showStatusMessage.value = false }, 3000)
      } else {
        throw new Error('워크플로우 데이터 형식이 올바르지 않습니다.')
      }
    } catch (error) {
      console.error('MSA4 워크플로우 처리 중 오류 발생:', error)
      showStatusMessage.value = true
      statusMessage.value = `워크플로우 로드 실패: ${error.message}`
      setTimeout(() => { showStatusMessage.value = false }, 3000)
    }
  }

  // MSA3에서 워크플로우 데이터 받기 - 이벤트 핸들러
  const handleWorkflowFromMSA3 = (event) => {
    console.log('=== MSA5: handleWorkflowFromMSA3 함수 호출됨 ===')
    console.log('MSA5: 수신된 이벤트:', event)
    console.log('MSA5: 이벤트 타입:', typeof event)
    console.log('MSA5: 이벤트 detail:', event.detail)

    try {
      const workflowData = event.detail || event
      console.log('MSA5: 추출된 워크플로우 데이터:', workflowData)

      if (!workflowData) {
        console.error('MSA5: 워크플로우 데이터가 없습니다.')
        showStatusMessage.value = true
        statusMessage.value = '워크플로우 데이터가 없습니다.'
        setTimeout(() => { showStatusMessage.value = false }, 3000)
        return
      }

      console.log('MSA5: 워크플로우 데이터 키:', Object.keys(workflowData))
      console.log('MSA5: elements 존재 여부:', !!workflowData.elements)
      console.log('MSA5: elements 타입:', typeof workflowData.elements)
      console.log('MSA5: elements 길이:', workflowData.elements ? workflowData.elements.length : 'null')

      if (workflowData.elements && Array.isArray(workflowData.elements)) {
        console.log('MSA5: elements 배열을 직접 처리합니다.')
        console.log('MSA5: elements 내용:', workflowData.elements)

        console.log('MSA5: prepareElementsForLoad 함수 호출 시작')
        const processedElements = prepareElementsForLoad(workflowData.elements)
        console.log('MSA5: prepareElementsForLoad 완료, 결과:', processedElements)

        elements.value = processedElements

        if (workflowData.workflow_name) {
          workflowName.value = workflowData.workflow_name
        }

        showStatusMessage.value = true
        statusMessage.value = 'MSA3에서 워크플로우를 성공적으로 불러왔습니다.'
        setTimeout(() => { showStatusMessage.value = false }, 3000)

        console.log('MSA5: 워크플로우 로드 완료')
        return
      }

      console.warn('MSA5: elements 배열이 없습니다')
      showStatusMessage.value = true
      statusMessage.value = '워크플로우에 처리할 요소가 없습니다.'
      setTimeout(() => { showStatusMessage.value = false }, 3000)
    } catch (error) {
      console.error('MSA5: 워크플로우 처리 중 오류 발생:', error)
      showStatusMessage.value = true
      statusMessage.value = `워크플로우 로드 실패: ${error.message}`
      setTimeout(() => { showStatusMessage.value = false }, 3000)
    }
  }

  return {
    handleImageUpdate,
    handleWorkflowFromMSA4,
    handleWorkflowFromMSA3
  }
}
