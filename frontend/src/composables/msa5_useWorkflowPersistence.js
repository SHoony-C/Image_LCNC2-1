import { ref, nextTick } from 'vue'

/**
 * Composable for workflow persistence (save/load/duplicate handling).
 *
 * @param {import('vue').Ref} elements - Reactive ref to workflow elements array
 * @param {import('vue').Ref} inputImage - Reactive ref to the input image URL
 * @param {Object} processedImages - Reactive object mapping nodeId -> processed image URL
 * @param {import('vue').Ref} processingStatus - Reactive ref to processing status
 * @param {Object} uiState - UI state refs (showStatusMessage, statusMessage, statusType)
 * @param {Object} errorDialogState - Error dialog refs
 * @param {Function} getNodeSummary - Function to get node summary
 * @param {Function} initializeElements - Function to initialize default elements
 * @param {Function} getDefaultParams - Function to get default params for a node type
 * @param {import('vue').Ref} defaultOptions - Reactive ref to default options
 * @returns Persistence functions and state
 */
export function useWorkflowPersistence(
  elements, inputImage, processedImages, processingStatus,
  uiState, errorDialogState,
  getNodeSummary, initializeElements, getDefaultParams, defaultOptions,
  canSaveWorkflow
) {
  const { showStatusMessage, statusMessage, statusType } = uiState

  const savedWorkflows = ref({})
  const showSaveWorkflowDialog = ref(false)
  const workflowName = ref('')
  const workflowDescription = ref('')
  const workflowNameInput = ref(null)
  const showDuplicateNameDialog = ref(false)
  const newWorkflowName = ref('')
  const newWorkflowNameInput = ref(null)
  const showDuplicateNameError = ref(false)
  const currentImageTitle = ref('')

  // 이미지 해시 계산 함수
  const calculateImageHash = async (imageUrl) => {
    try {
      if (!imageUrl) {
        console.error('이미지 URL이 없습니다.')
        return 'no-image-hash'
      }
      const filename = imageUrl.split('/').pop()
      if (!filename) {
        return `url-hash-${Date.now()}`
      }
      return `image-${filename}`
    } catch (error) {
      console.error('해시 계산 중 오류 발생:', error)
      return `error-hash-${Date.now()}`
    }
  }

  // 저장된 워크플로우 확인
  const checkSavedWorkflow = async (imageHash) => {
    try {
      const response = await fetch(`http://localhost:8000/api/lcnc/get-workflow-by-hash/${imageHash}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        mode: 'cors',
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        if (data.status === 'success' && data.data) {
          savedWorkflows.value[imageHash] = {
            session_id: data.data.session_id,
            image_title: data.data.image_title || currentImageTitle.value,
            timestamp: data.data.timestamp
          }

          showStatusMessage.value = true
          statusMessage.value = '이 이미지에 대해 저장된 워크플로우가 있습니다.'
          setTimeout(() => { showStatusMessage.value = false }, 3000)
        }
      }
    } catch (error) {
      console.error('워크플로우 조회 중 오류:', error)
    }
  }

  // 워크플로우 요소를 저장용으로 준비하는 함수
  const prepareElementsForSave = (elems) => {
    if (!elems || !Array.isArray(elems)) {
      return []
    }

    const startNode = elems.find(el => el.id === 'start')
    const endNode = elems.find(el => el.id === 'end')
    const customNodes = elems.filter(el => el.id !== 'start' && el.id !== 'end' && el.type !== 'smoothstep')
    const connections = elems.filter(el => el.type === 'smoothstep')

    const cleanedElements = []

    const connectionMap = {}
    connections.forEach(conn => {
      if (!connectionMap[conn.source]) {
        connectionMap[conn.source] = []
      }
      connectionMap[conn.source].push(conn.target)
    })

    if (startNode) {
      const cleanedStartNode = {
        id: 'start',
        type: 'start',
        position: startNode.position,
        data: { label: startNode.data?.label || '시작' }
      }
      if (connectionMap['start']) {
        cleanedStartNode.data.connections = connectionMap['start']
      }
      cleanedElements.push(cleanedStartNode)
    }

    customNodes.forEach(node => {
      const nodeId = node.id
      const baseName = nodeId.includes('_') ? nodeId.split('_')[0] : nodeId

      const cleanedNode = {
        id: nodeId,
        name: baseName,
        type: 'custom',
        position: node.position,
        data: {
          label: node.data?.label || nodeId,
          nodeId: nodeId,
          icon: node.data?.icon
        }
      }

      if (node.data?.params) {
        cleanedNode.data.params = node.data.params
      }

      if (connectionMap[nodeId]) {
        cleanedNode.data.connections = connectionMap[nodeId]
      }

      cleanedElements.push(cleanedNode)
    })

    if (endNode) {
      cleanedElements.push({
        id: 'end',
        type: 'end',
        position: endNode.position,
        data: { label: endNode.data?.label || '종료' }
      })
    }

    return cleanedElements
  }

  // 요소 로드 전 처리 함수
  const prepareElementsForLoad = (inputElements) => {
    console.log('=== prepareElementsForLoad 함수 호출됨 ===')
    console.log('입력 요소들:', inputElements)
    console.log('입력 요소 개수:', inputElements ? inputElements.length : 'null')

    if (!inputElements || !Array.isArray(inputElements)) {
      console.warn('prepareElementsForLoad: 유효하지 않은 입력 요소')
      return []
    }

    const reorganizedElements = []
    const idMapping = {}
    const nameToIdMapping = {}

    const startNode = inputElements.find(el => el.type === 'start')
    const endNode = inputElements.find(el => el.type === 'end')
    const customNodes = inputElements.filter(el => el.type !== 'start' && el.type !== 'end' && el.type !== 'edge')

    if (startNode) {
      reorganizedElements.push({ ...startNode })
    }

    const timestamp = Date.now()

    // 1단계: ID 매핑 생성
    console.log('=== 1단계: ID 매핑 생성 ===')
    customNodes.forEach(node => {
      const originalId = node.id
      const nodeName = node.name || originalId
      const uniqueId = `${nodeName}_${timestamp}_${Math.floor(Math.random() * 10000)}`

      idMapping[originalId] = uniqueId
      nameToIdMapping[nodeName] = uniqueId

      console.log(`매핑 생성: ${originalId} -> ${uniqueId} (이름: ${nodeName})`)

      if (originalId.includes('_')) {
        const baseName = originalId.split('_')[0]
        if (!nameToIdMapping[baseName]) {
          nameToIdMapping[baseName] = uniqueId
          console.log(`기본 이름 매핑 추가: ${baseName} -> ${uniqueId}`)
        }
      }
    })

    // 2단계: connections 배열 분석하여 추가 매핑 생성
    console.log('=== 2단계: connections 기반 추가 매핑 ===')
    inputElements.forEach(el => {
      if (el.data && el.data.connections && Array.isArray(el.data.connections)) {
        console.log(`${el.id}의 connections:`, el.data.connections)

        el.data.connections.forEach(targetId => {
          if (idMapping[targetId] || targetId === 'start' || targetId === 'end') {
            return
          }

          let baseName = targetId
          if (targetId.includes('_')) {
            baseName = targetId.split('_')[0]
          }

          const matchingNode = customNodes.find(node => {
            const nodeId = node.id
            const nodeName = node.name || nodeId
            const nodeBaseName = nodeName.split('_')[0]

            if (nodeId === targetId) return true
            if (nodeBaseName === baseName) return true
            if (nodeName.toLowerCase() === targetId.toLowerCase()) return true
            if (nodeName.toLowerCase().includes(targetId.toLowerCase())) return true

            return false
          })

          if (matchingNode) {
            const mappedId = idMapping[matchingNode.id]
            if (mappedId) {
              idMapping[targetId] = mappedId
              console.log(`connections 기반 매핑: ${targetId} -> ${mappedId}`)
            }
          } else {
            console.warn(`connections에서 타겟 노드를 찾을 수 없음: ${targetId}`)

            if (nameToIdMapping[baseName]) {
              idMapping[targetId] = nameToIdMapping[baseName]
              console.log(`기본 이름으로 매핑: ${targetId} -> ${nameToIdMapping[baseName]}`)
            } else if (nameToIdMapping[targetId]) {
              idMapping[targetId] = nameToIdMapping[targetId]
              console.log(`직접 이름으로 매핑: ${targetId} -> ${nameToIdMapping[targetId]}`)
            }
          }
        })
      }
    })

    // 3단계: 커스텀 노드 추가
    console.log('=== 3단계: 노드 생성 ===')
    customNodes.forEach(node => {
      const originalId = node.id
      const uniqueId = idMapping[originalId]
      const nodeName = node.name || originalId

      console.log(`노드 생성: ${originalId} -> ${uniqueId}`)

      const isMergeNode = node.type === 'merge' ||
                         (node.data && node.data.id === 'merge') ||
                         (node.data && node.data.label && node.data.label.includes('병합')) ||
                         (node.data && node.data.label && node.data.label.includes('merge')) ||
                         (node.id && node.id.includes('merge')) ||
                         (node.name && node.name.includes('merge'))

      const updatedNode = {
        ...node,
        id: uniqueId,
        name: nodeName,
        type: isMergeNode ? 'merge' : node.type,
        data: {
          ...node.data,
          id: isMergeNode ? 'merge' : node.data?.id,
          nodeId: node.data?.nodeId || node.data?.id,
          label: node.data?.label,
          icon: node.data?.icon,
          params: node.data?.params ? { ...node.data.params } : undefined,
          connections: undefined
        }
      }

      reorganizedElements.push(updatedNode)
    })

    if (endNode) {
      reorganizedElements.push({ ...endNode })
    }

    // 4단계: connections 기반 엣지 생성
    console.log('=== 4단계: 엣지 생성 ===')
    inputElements.forEach(el => {
      if (el.data && el.data.connections && Array.isArray(el.data.connections)) {
        let sourceId
        if (el.id === 'start') {
          sourceId = 'start'
        } else if (el.id === 'end') {
          sourceId = 'end'
        } else {
          sourceId = idMapping[el.id] || el.id
        }

        console.log(`${el.id}에서 ${el.data.connections.length}개 분기 생성:`)

        el.data.connections.forEach((targetId, index) => {
          let mappedTargetId
          if (targetId === 'start') {
            mappedTargetId = 'start'
          } else if (targetId === 'end') {
            mappedTargetId = 'end'
          } else {
            mappedTargetId = idMapping[targetId] || targetId
          }

          const edgeId = `e_${sourceId}_${mappedTargetId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`

          console.log(`  분기 ${index + 1}: ${sourceId} -> ${mappedTargetId} (${targetId})`)

          reorganizedElements.push({
            id: edgeId,
            type: 'smoothstep',
            source: sourceId,
            target: mappedTargetId,
            sourceHandle: null,
            targetHandle: null,
            style: { stroke: '#666', strokeWidth: 2 },
            animated: false
          })
        })
      }
    })

    console.log('=== 최종 결과 ===')
    console.log('생성된 elements:', reorganizedElements)
    console.log('ID 매핑 테이블:', idMapping)
    console.log('이름 매핑 테이블:', nameToIdMapping)

    return reorganizedElements
  }

  // 워크플로우 저장 대화상자 열기
  const openWorkflowSaveDialog = () => {
    if (processingStatus.value !== 'completed') {
      showStatusMessage.value = true
      statusMessage.value = '워크플로우를 먼저 실행해주세요.'
      statusType.value = 'warning'
      setTimeout(() => { showStatusMessage.value = false }, 3000)
      return
    }

    showSaveWorkflowDialog.value = true

    nextTick(() => {
      if (workflowNameInput.value) {
        workflowNameInput.value.focus()
      }
    })
  }

  // 워크플로우 저장 취소
  const cancelSaveWorkflow = () => {
    showSaveWorkflowDialog.value = false
    workflowName.value = ''
    workflowDescription.value = ''
  }

  // 워크플로우 저장 확인
  const confirmSaveWorkflow = async () => {
    if (!workflowName.value) {
      showStatusMessage.value = true
      statusMessage.value = '워크플로우 이름을 입력하세요.'
      setTimeout(() => { showStatusMessage.value = false }, 3000)

      if (workflowNameInput.value) {
        workflowNameInput.value.focus()
      }
      return
    }

    try {
      const checkResponse = await fetch('http://localhost:8000/api/external_storage/check-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors',
        credentials: 'include',
        body: JSON.stringify({ title: workflowName.value })
      })

      const checkResult = await checkResponse.json()

      if (checkResult.status === 'duplicate_name') {
        showDuplicateNameWarning()
        return
      }

      showSaveWorkflowDialog.value = false
      await saveWorkflowToServer()
    } catch (error) {
      console.error('중복 이름 확인 중 오류:', error)
      showStatusMessage.value = true
      statusMessage.value = `중복 이름 확인 실패: ${error.message}`
      setTimeout(() => { showStatusMessage.value = false }, 5000)
    }
  }

  // 워크플로우 서버에 저장
  const saveWorkflowToServer = async () => {
    if (!workflowName.value) {
      showStatusMessage.value = true
      statusMessage.value = '워크플로우 이름을 입력하세요.'
      setTimeout(() => { showStatusMessage.value = false }, 3000)
      return
    }

    try {
      const workflowToSave = {
        workflow_name: workflowName.value,
        elements: prepareElementsForSave(elements.value),
        input_image_url: inputImage.value
      }

      const nodesSummary = getNodeSummary(elements.value)
      if (nodesSummary && nodesSummary.length > 0) {
        workflowToSave.nodes_summary = nodesSummary
      }

      const response = await fetch('http://localhost:8000/api/msa5/save-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflowToSave)
      })

      if (response.ok) {
        const responseData = await response.json()

        if (responseData.status === 'success') {
          // 워크플로우 저장 성공 후 이미지 저장 진행
          try {
            if (!inputImage.value || !processedImages['end']) {
              console.warn('저장할 이미지가 없습니다. 이미지 저장 건너뜀')
            } else {
              const sessionId = responseData.id || `workflow_${Date.now()}`
              const safeWorkflowName = workflowName.value.replace(/ /g, '_')
              const beforeFilename = `${safeWorkflowName}_before`
              const afterFilename = `${safeWorkflowName}_after`

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
                  return new Promise((resolve, reject) => {
                    const reader = new FileReader()
                    reader.onloadend = () => resolve(reader.result)
                    reader.onerror = (e) => {
                      console.error('FileReader 오류:', e)
                      reject(new Error('이미지 읽기 오류'))
                    }
                    reader.readAsDataURL(blob)
                  })
                } catch (error) {
                  console.error('Base64 변환 중 오류:', error)
                  return ''
                }
              }

              const beforeImageBase64 = await blobToBase64(inputImage.value)
              const afterImageBase64 = await blobToBase64(processedImages['end'])

              const imageResponse = await fetch('http://localhost:8000/api/external_storage/save-images', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                },
                mode: 'cors',
                credentials: 'include',
                body: JSON.stringify({
                  title: safeWorkflowName,
                  description: workflowDescription.value || '',
                  before_image: beforeImageBase64,
                  after_image: afterImageBase64,
                  workflow_id: sessionId,
                  tags: ['lcnc', '이미지 처리'],
                  is_result: false
                })
              })

              if (imageResponse.ok) {
                const imageResult = await imageResponse.json()
                // success
              } else {
                console.error('이미지 저장 실패:', await imageResponse.text())
              }
            }
          } catch (imageError) {
            console.error('이미지 저장 중 오류:', imageError)
          }

          showSaveWorkflowDialog.value = false
          showStatusMessage.value = true
          statusMessage.value = '워크플로우가 저장되었습니다.'
          setTimeout(() => { showStatusMessage.value = false }, 3000)
        } else {
          throw new Error(responseData.message || '저장 중 오류가 발생했습니다.')
        }
      } else {
        throw new Error(`서버 응답 오류: ${response.status}`)
      }
    } catch (error) {
      console.error('워크플로우 저장 중 오류 발생:', error)
      showStatusMessage.value = true
      statusMessage.value = `저장 실패: ${error.message}`
      setTimeout(() => { showStatusMessage.value = false }, 3000)
    }
  }

  // 워크플로우 저장 기능 (저장 대화상자 열기)
  const saveWorkflow = async () => {
    if (!workflowName.value) {
      showStatusMessage.value = true
      statusMessage.value = '워크플로우 이름을 입력하세요.'
      setTimeout(() => { showStatusMessage.value = false }, 3000)
      return
    }

    try {
      const workflowToSave = {
        workflow_name: workflowName.value,
        elements: prepareElementsForSave(elements.value),
        input_image_url: inputImage.value
      }

      const nodesSummary = getNodeSummary(elements.value)
      if (nodesSummary && nodesSummary.length > 0) {
        workflowToSave.nodes_summary = nodesSummary
      }

      const response = await fetch('http://localhost:8000/api/msa5/save-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflowToSave)
      })

      if (response.ok) {
        const responseData = await response.json()
        if (responseData.status === 'success') {
          showStatusMessage.value = true
          statusMessage.value = '워크플로우가 저장되었습니다.'
          setTimeout(() => { showStatusMessage.value = false }, 3000)
        } else {
          throw new Error(responseData.message || '저장 중 오류가 발생했습니다.')
        }
      } else {
        throw new Error(`서버 응답 오류: ${response.status}`)
      }
    } catch (error) {
      console.error('워크플로우 저장 중 오류 발생:', error)
      showStatusMessage.value = true
      statusMessage.value = `저장 실패: ${error.message}`
      setTimeout(() => { showStatusMessage.value = false }, 3000)
    }
  }

  // 워크플로우 로드
  const loadWorkflow = async (sessionId) => {
    if (!sessionId) return

    try {
      const response = await fetch(`http://localhost:8000/api/msa5/get-workflow/${sessionId}`)

      if (response.ok) {
        const data = await response.json()
        if (data.status === 'success' && data.workflow && data.workflow.elements) {
          elements.value = prepareElementsForLoad(data.workflow.elements)

          if (data.workflow.input_image_url) {
            inputImage.value = data.workflow.input_image_url
          }

          if (data.workflow.workflow_name) {
            workflowName.value = data.workflow.workflow_name
          }

          showStatusMessage.value = true
          statusMessage.value = '워크플로우를 불러왔습니다.'
          setTimeout(() => { showStatusMessage.value = false }, 3000)
        } else {
          throw new Error(data.message || '워크플로우 데이터가 없습니다.')
        }
      } else {
        throw new Error(`API 응답 오류: ${response.status}`)
      }
    } catch (error) {
      console.error('워크플로우 로드 중 오류 발생:', error)
      showStatusMessage.value = true
      statusMessage.value = `워크플로우 로드 실패: ${error.message}`
      setTimeout(() => { showStatusMessage.value = false }, 3000)
    }
  }

  // 기본 워크플로우 로드
  const loadDefaultWorkflow = () => {
    try {
      const storedWorkflow = localStorage.getItem('msa5_last_workflow')

      if (storedWorkflow) {
        try {
          const workflow = JSON.parse(storedWorkflow)
          if (workflow && Array.isArray(workflow.elements) && workflow.elements.length > 0) {
            elements.value = workflow.elements
            return
          }
        } catch (parseError) {
          console.error('저장된 워크플로우 파싱 오류:', parseError)
        }
      }

      initializeElements()
    } catch (error) {
      console.error('워크플로우 로드 중 오류 발생:', error)
      initializeElements()
    }
  }

  // 저장된 워크플로우 목록 로드
  const loadSavedWorkflows = async () => {
    try {
      savedWorkflows.value = {}
    } catch (error) {
      console.error('저장된 워크플로우 목록 초기화 중 오류:', error)
    }
  }

  // 중복 이름 경고 표시
  const showDuplicateNameWarning = () => {
    showDuplicateNameDialog.value = true
    showDuplicateNameError.value = false
    newWorkflowName.value = `${workflowName.value}_new`

    nextTick(() => {
      if (newWorkflowNameInput.value) {
        newWorkflowNameInput.value.focus()
      }
    })
  }

  // 중복 이름 대화상자 닫기
  const closeDuplicateNameDialog = () => {
    showDuplicateNameDialog.value = false
    newWorkflowName.value = ''
    showDuplicateNameError.value = false
  }

  // 새 이름으로 저장 적용
  const applyNewName = async () => {
    if (!newWorkflowName.value) {
      showDuplicateNameError.value = true
      return
    }

    try {
      const checkResponse = await fetch('http://localhost:8000/api/external_storage/check-title', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        mode: 'cors',
        credentials: 'include',
        body: JSON.stringify({ title: newWorkflowName.value })
      })

      const checkResult = await checkResponse.json()

      if (checkResult.status === 'duplicate_name') {
        showDuplicateNameError.value = true
        return
      }

      workflowName.value = newWorkflowName.value
      closeDuplicateNameDialog()
      confirmSaveWorkflow()
    } catch (error) {
      console.error('중복 이름 확인 중 오류:', error)
      showStatusMessage.value = true
      statusMessage.value = `중복 이름 확인 실패: ${error.message}`
      setTimeout(() => { showStatusMessage.value = false }, 5000)
    }
  }

  return {
    canSaveWorkflow,
    savedWorkflows,
    showSaveWorkflowDialog,
    workflowName,
    workflowDescription,
    workflowNameInput,
    showDuplicateNameDialog,
    newWorkflowName,
    newWorkflowNameInput,
    showDuplicateNameError,
    currentImageTitle,
    calculateImageHash,
    checkSavedWorkflow,
    prepareElementsForSave,
    prepareElementsForLoad,
    openWorkflowSaveDialog,
    cancelSaveWorkflow,
    confirmSaveWorkflow,
    saveWorkflowToServer,
    saveWorkflow,
    loadWorkflow,
    loadDefaultWorkflow,
    loadSavedWorkflows,
    showDuplicateNameWarning,
    closeDuplicateNameDialog,
    applyNewName
  }
}
