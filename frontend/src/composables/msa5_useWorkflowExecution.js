import { ref } from 'vue'
import LogService from '../utils/logService'

/**
 * Composable for workflow execution (processStart, processWorkflow BFS engine).
 *
 * @param {import('vue').Ref} elements - Reactive ref to workflow elements array
 * @param {import('vue').Ref} inputImage - Reactive ref to input image URL
 * @param {Object} processedImages - Reactive object mapping nodeId -> processed image URL
 * @param {import('vue').Ref} processingStatus - Reactive ref to processing status
 * @param {Object} uiState - UI state refs
 * @param {Object} errorDialogState - Error dialog refs
 * @param {Function} validateWorkflow - Validation function
 * @param {Function} processNode - Node processing function
 * @param {Function} processMergeNode - Merge node processing function
 * @param {Function} sendImageToMSA6 - Function to send image to MSA6
 * @param {import('vue').Ref} canSaveWorkflow - Reactive ref to save workflow flag
 * @param {import('vue').Ref} hasOutput - Reactive ref to output connection state
 * @returns Execution functions and state
 */
export function useWorkflowExecution(
  elements, inputImage, processedImages, processingStatus,
  uiState, errorDialogState,
  validateWorkflow, processNode, processMergeNode, sendImageToMSA6,
  canSaveWorkflow, hasOutput
) {
  const { showStatusMessage, statusMessage } = uiState
  const {
    showWorkflowErrorDialog,
    workflowErrorTitle,
    workflowErrorMessage,
    workflowErrorDetails
  } = errorDialogState

  const processingQueue = ref([])

  // 워크플로우 처리 시작
  const processStart = async () => {
    if (!inputImage.value) {
      showStatusMessage.value = true
      statusMessage.value = '이미지가 없습니다. 먼저 이미지를 로드해주세요.'
      setTimeout(() => { showStatusMessage.value = false }, 5000)
      return
    }

    // MSA6 측정 결과 초기화 이벤트 발생
    try {
      const clearEvent = new CustomEvent('msa5-process-start', {
        detail: {
          timestamp: Date.now(),
          action: 'clear_measurements'
        },
        bubbles: true,
        cancelable: true
      })

      document.dispatchEvent(clearEvent)
      window.dispatchEvent(clearEvent)

      sessionStorage.setItem('msa5_process_started', 'true')
    } catch (error) {
      console.error('[processStart] MSA6 초기화 이벤트 발생 실패:', error)
    }

    // 액션 로깅
    const logData = {
      component: 'MSA5',
      hasImage: !!inputImage.value,
      nodeCount: elements.value.filter(el => el.type !== 'smoothstep').length - 2,
      connectionCount: elements.value.filter(el => el.type === 'smoothstep').length
    }

    try {
      LogService.logAction('process_start', logData)
        .catch(err => console.error('로그 저장 실패:', err))
    } catch (err) {
      console.error('로그 저장 오류:', err)
    }

    // 워크플로우 검증
    const validationResult = validateWorkflow()

    if (!validationResult.valid) {
      showStatusMessage.value = true
      statusMessage.value = validationResult.message
      setTimeout(() => { showStatusMessage.value = false }, 5000)
      console.error('워크플로우 검증 실패:', validationResult)
      return
    }

    processingStatus.value = 'processing'
    statusMessage.value = '워크플로우 처리 중...'
    showStatusMessage.value = true

    try {
      await processWorkflow()
      canSaveWorkflow.value = true
    } catch (error) {
      console.error('워크플로우 처리 중 오류 발생:', error)
      processingStatus.value = 'error'

      const errorMessage = error.message || '알 수 없는 오류'
      statusMessage.value = `처리 오류: ${errorMessage}`

      showWorkflowErrorDialog.value = true
      workflowErrorTitle.value = '워크플로우 처리 오류'
      workflowErrorMessage.value = `워크플로우 처리 중 오류가 발생했습니다: ${errorMessage}`

      if (errorMessage.includes('API 응답 오류')) {
        workflowErrorDetails.value = '백엔드 API 호출 중 오류가 발생했습니다. 노드 타입이나 파라미터가 올바른지 확인하세요.'
      } else if (errorMessage.includes('not found') || errorMessage.includes('404')) {
        workflowErrorDetails.value = '요청한 리소스를 찾을 수 없습니다. 백엔드 서버가 실행 중인지 확인하세요.'
      } else if (errorMessage.includes('network') || errorMessage.includes('연결')) {
        workflowErrorDetails.value = '네트워크 연결 오류가 발생했습니다. 인터넷 연결 상태를 확인하세요.'
      } else {
        workflowErrorDetails.value = '워크플로우 실행 중 예상치 못한 오류가 발생했습니다. 개발자 콘솔에서 자세한 정보를 확인하세요.'
      }

      showStatusMessage.value = true
      setTimeout(() => { showStatusMessage.value = false }, 5000)
    }
  }

  // 워크플로우 실제 처리 함수 (BFS engine)
  const processWorkflow = async () => {
    try {
      const queue = []
      const visited = new Set(['start'])

      processedImages['start'] = inputImage.value
      sessionStorage.setItem('msa5_start_image_url', inputImage.value)

      // 그래프 구성
      const graph = {}
      elements.value.filter(el => el.type !== 'smoothstep').forEach(node => {
        graph[node.id] = []
      })

      elements.value.filter(el => el.type === 'smoothstep').forEach(conn => {
        if (!graph[conn.source]) graph[conn.source] = []
        graph[conn.source].push(conn.target)
      })

      // BFS 큐 초기화
      for (const nodeId of graph['start']) {
        queue.push(nodeId)
      }

      // BFS 처리
      while (queue.length > 0) {
        const batchSize = queue.length
        const currentBatch = queue.splice(0, batchSize)

        const processingPromises = []

        for (const nodeId of currentBatch) {
          if (visited.has(nodeId)) continue

          const node = elements.value.find(el => el.id === nodeId)
          if (!node) {
            console.error(`[processWorkflow] 노드 ID ${nodeId}에 해당하는 노드가 없습니다.`)
            continue
          }

          const inputEdges = elements.value.filter(
            el => el.type === 'smoothstep' && el.target === nodeId
          )

          if (inputEdges.length === 0) {
            console.error(`[processWorkflow] 노드 ${nodeId}에 입력 연결이 없습니다.`)
            continue
          }

          const sourceNodeId = inputEdges[0].source
          const nodeInputImage = processedImages[sourceNodeId]

          if (!nodeInputImage) {
            console.error(`[processWorkflow] 소스 노드 ${sourceNodeId}의 이미지가 없습니다.`)
            continue
          }

          let processingPromise

          if (nodeId === 'end') {
            processingPromise = Promise.resolve(nodeInputImage)
          } else if (node.data?.nodeId === 'merge' || node.data?.id === 'merge') {
            processingPromise = processMergeNode(node)
          } else if (node.data?.nodeId === 'sam2' || node.data?.id === 'sam2' || node.data?.label?.includes('SAM2')) {
            console.log(`[processWorkflow] SAM2 노드 처리 시작: ${nodeId}, 라벨: ${node.data?.label}`)
            processingPromise = processNode(node, nodeInputImage)
          } else {
            processingPromise = processNode(node, nodeInputImage)
          }

          processingPromises.push(
            processingPromise.then(processedImage => {
              if (processedImage) {
                processedImages[nodeId] = processedImage
                visited.add(nodeId)

                for (const nextNodeId of graph[nodeId] || []) {
                  if (!visited.has(nextNodeId)) {
                    queue.push(nextNodeId)
                  }
                }
              } else {
                console.warn(`[processWorkflow] 노드 ${nodeId} 처리 결과가 없습니다.`)
              }
              return nodeId
            }).catch(error => {
              console.error(`[processWorkflow] 노드 ${nodeId} 처리 중 오류 발생:`, error)
              return null
            })
          )
        }

        const results = await Promise.all(processingPromises)
      }

      // 최종 결과 처리
      if (processedImages['end']) {
        sessionStorage.setItem('msa5_start_image_url', processedImages['start'])
        sessionStorage.setItem('msa5_end_image_url', processedImages['end'])

        // 이미지 형식 감지
        let imageFormat = 'png'

        const endNodeInputEdges = elements.value.filter(
          el => el.type === 'smoothstep' && el.target === 'end'
        )

        if (endNodeInputEdges.length > 0) {
          const sourceNodeId = endNodeInputEdges[0].source
          const nodeFormat = sessionStorage.getItem(`msa5_node_${sourceNodeId}_format`)
          if (nodeFormat) {
            imageFormat = nodeFormat
          }
        }

        if (processedImages['end'].startsWith('data:image/')) {
          const formatMatch = processedImages['end'].match(/data:image\/([a-z0-9]+);base64,/i)
          if (formatMatch && formatMatch[1]) {
            imageFormat = formatMatch[1].toLowerCase()
            if (imageFormat === 'jpeg') imageFormat = 'jpg'
          }
        }

        try {
          const response = await fetch(processedImages['end'])
          const contentType = response.headers.get('Content-Type')
          if (contentType && contentType.startsWith('image/')) {
            const formatFromHeader = contentType.split('/')[1].toLowerCase()
            if (formatFromHeader) {
              imageFormat = formatFromHeader
              if (imageFormat === 'jpeg') imageFormat = 'jpg'
            }
          }
          const blob = await response.blob()
          if (blob.type && blob.type.startsWith('image/')) {
            const formatFromBlob = blob.type.split('/')[1].toLowerCase()
            if (formatFromBlob) {
              imageFormat = formatFromBlob
              if (imageFormat === 'jpeg') imageFormat = 'jpg'
            }
          }
        } catch (e) {
          console.warn('[processWorkflow] Blob 형식 감지 중 오류:', e)
        }

        sessionStorage.setItem('msa5_end_image_format', imageFormat)
        sessionStorage.setItem('msa5_end_image', 'true')

        // MSA6로 이미지 전송
        setTimeout(() => {
          let msa6SendSuccess = false
          msa6SendSuccess = sendImageToMSA6(processedImages['end'], imageFormat)

          if (!msa6SendSuccess) {
            setTimeout(() => {
              msa6SendSuccess = sendImageToMSA6(processedImages['end'], imageFormat)
              if (!msa6SendSuccess) {
                setTimeout(() => {
                  sendImageToMSA6(processedImages['end'], imageFormat)
                }, 1000)
              }
            }, 500)
          }
        }, 300)

        hasOutput.value = true
        statusMessage.value = '이미지 처리가 완료되었습니다!'
      } else {
        console.warn('최종 이미지가 없습니다')
        statusMessage.value = '이미지 처리 중 오류가 발생했습니다'
        hasOutput.value = false
      }

      processingStatus.value = 'completed'
      showStatusMessage.value = true
      setTimeout(() => { showStatusMessage.value = false }, 3000)
    } catch (error) {
      console.error('워크플로우 처리 중 오류 발생:', error)
      processingStatus.value = 'error'

      const errorMessage = error.message || '알 수 없는 오류'
      statusMessage.value = `처리 오류: ${errorMessage}`

      showWorkflowErrorDialog.value = true
      workflowErrorTitle.value = '워크플로우 처리 오류'
      workflowErrorMessage.value = `워크플로우 처리 중 오류가 발생했습니다: ${errorMessage}`

      if (errorMessage.includes('API 응답 오류')) {
        workflowErrorDetails.value = '백엔드 API 호출 중 오류가 발생했습니다. 노드 타입이나 파라미터가 올바른지 확인하세요.'
      } else if (errorMessage.includes('not found') || errorMessage.includes('404')) {
        workflowErrorDetails.value = '요청한 리소스를 찾을 수 없습니다. 백엔드 서버가 실행 중인지 확인하세요.'
      } else if (errorMessage.includes('network') || errorMessage.includes('연결')) {
        workflowErrorDetails.value = '네트워크 연결 오류가 발생했습니다. 인터넷 연결 상태를 확인하세요.'
      } else {
        workflowErrorDetails.value = '워크플로우 실행 중 예상치 못한 오류가 발생했습니다. 개발자 콘솔에서 자세한 정보를 확인하세요.'
      }

      showStatusMessage.value = true
      setTimeout(() => { showStatusMessage.value = false }, 5000)
    }
  }

  return {
    processingQueue,
    processStart,
    processWorkflow
  }
}
