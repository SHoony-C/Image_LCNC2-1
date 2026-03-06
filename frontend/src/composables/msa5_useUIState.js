import { ref, computed, watch } from 'vue'

/**
 * Composable for UI state management (maximize, preview, status messages, error dialogs).
 *
 * @param {import('vue').Ref} elements - Reactive ref to workflow elements array
 * @param {import('vue').Ref} selectedNode - Reactive ref to selected node
 * @param {import('vue').Ref} selectedEdge - Reactive ref to selected edge
 * @param {import('vue').Ref} previewImageUrl - Reactive ref to preview image URL
 * @param {Function} saveToHistory - Function to save history state
 * @param {Function} updateConnections - Function to update connection states
 * @param {Function} undo - Undo function
 * @param {Function} redo - Redo function
 * @param {import('vue').Ref} canSaveWorkflow - Reactive ref for save workflow flag
 * @param {import('vue').Ref} processingStatus - Reactive ref to processing status
 * @returns UI state and functions
 */
export function useUIState(
  elements, selectedNode, selectedEdge, previewImageUrl,
  saveToHistory, updateConnections, undo, redo,
  canSaveWorkflow, processingStatus
) {
  const isMaximized = ref(false)
  const showStatusMessage = ref(false)
  const statusMessage = ref('')
  const statusType = ref('info')
  const showWorkflowErrorDialog = ref(false)
  const workflowErrorTitle = ref('')
  const workflowErrorMessage = ref('')
  const workflowErrorDetails = ref('')
  const containerRef = ref(null)

  // 최대화 버튼 토글
  const toggleMaximize = () => {
    isMaximized.value = !isMaximized.value
  }

  // 최대화 상태 변경 시 부모 컨테이너의 position 조정
  watch(isMaximized, (newVal) => {
    const component = document.querySelector('.msa5')
    if (component && component.parentElement) {
      if (newVal) {
        component.parentElement.style.position = 'relative'
        component.parentElement.style.zIndex = '9999'
      } else {
        component.parentElement.style.position = ''
        component.parentElement.style.zIndex = ''
      }
    }
  }, { immediate: false })

  // 이미지 프리뷰 열기
  const openImagePreview = (imageUrl) => {
    previewImageUrl.value = imageUrl
  }

  // 이미지 프리뷰 닫기
  const closeImagePreview = () => {
    previewImageUrl.value = null
  }

  // 워크플로우 오류 대화상자 닫기
  const closeWorkflowErrorDialog = () => {
    showWorkflowErrorDialog.value = false
  }

  // 상태 메시지 설정 함수
  const setStatusMessage = (message, type = 'info', duration = 3000) => {
    statusMessage.value = message
    statusType.value = type
    showStatusMessage.value = true

    if (duration > 0) {
      setTimeout(() => {
        showStatusMessage.value = false
      }, duration)
    }
  }

  // 선택한 노드 삭제
  const deleteSelectedNode = () => {
    if (!selectedNode.value) return

    const nodeId = selectedNode.value.id

    saveToHistory()

    elements.value = elements.value.filter(el => {
      if (el.type === 'smoothstep') {
        return el.source !== nodeId && el.target !== nodeId
      }
      return true
    })

    elements.value = elements.value.filter(el => el.id !== nodeId)

    selectedNode.value = null

    updateConnections()
    canSaveWorkflow.value = false
    processingStatus.value = 'idle'
  }

  // 선택한 엣지(연결선) 삭제
  const deleteSelectedEdge = () => {
    if (!selectedEdge.value) return

    const edgeId = selectedEdge.value.id

    saveToHistory()

    elements.value = elements.value.filter(el => el.id !== edgeId)

    selectedEdge.value = null

    updateConnections()
    canSaveWorkflow.value = false
    processingStatus.value = 'idle'
  }

  // 키보드 이벤트 핸들러
  const handleKeyDown = (event) => {
    // Escape 키는 이미지 프리뷰 닫기
    if (event.key === 'Escape' && previewImageUrl.value) {
      closeImagePreview()
      return
    }

    // Delete 키로 선택된 노드 삭제
    if (event.key === 'Delete' && selectedNode.value) {
      deleteSelectedNode()
      return
    }

    // Delete 키로 선택된 엣지 삭제
    if (event.key === 'Delete' && selectedEdge.value) {
      deleteSelectedEdge()
      return
    }

    // Ctrl+Z: 실행 취소
    if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
      undo()
      event.preventDefault()
      return
    }

    // Ctrl+Y: 다시 실행
    if ((event.ctrlKey || event.metaKey) && event.key === 'y') {
      redo()
      event.preventDefault()
      return
    }
  }

  // 워크플로우 요약 함수
  const getNodeSummary = () => {
    if (!elements.value || !Array.isArray(elements.value)) {
      return []
    }

    const nodes = elements.value.filter(el =>
      el.type !== 'smoothstep' &&
      el.id !== 'start' &&
      el.id !== 'end'
    )

    const connections = elements.value.filter(el => el.type === 'smoothstep')

    const graph = {}
    elements.value.filter(el => el.type !== 'smoothstep').forEach(node => {
      graph[node.id] = []
    })

    connections.forEach(conn => {
      if (graph[conn.source]) {
        graph[conn.source].push(conn.target)
      }
    })

    const visited = new Set()
    const orderedNodes = []

    const bfs = (startNodeId) => {
      const queue = [startNodeId]

      while (queue.length > 0) {
        const nodeId = queue.shift()

        if (visited.has(nodeId)) continue
        visited.add(nodeId)

        const node = elements.value.find(el => el.id === nodeId)
        if (node && nodeId !== 'start' && nodeId !== 'end') {
          orderedNodes.push(node)
        }

        ;(graph[nodeId] || []).forEach(nextNode => {
          if (!visited.has(nextNode)) {
            queue.push(nextNode)
          }
        })
      }
    }

    bfs('start')

    nodes.forEach(node => {
      if (!visited.has(node.id)) {
        orderedNodes.push(node)
      }
    })

    return orderedNodes
  }

  // 워크플로우 표시용 노드와 연결선 아이템 준비
  const getWorkflowDisplayItems = () => {
    const nodes = getNodeSummary()
    const items = []

    nodes.forEach((node, index) => {
      items.push({
        type: 'workflow-node',
        icon: node.data?.icon || 'fas fa-cog',
        label: node.data?.label || '처리 노드',
        params: node.data?.params || {},
        id: node.id
      })

      if (index < nodes.length - 1) {
        items.push({ type: 'workflow-node-connection' })
      }
    })

    return items
  }

  // 노드 개수 계산
  const getNodeCount = () => {
    return elements.value.filter(el => el.type !== 'smoothstep').length
  }

  // 연결 개수 계산
  const getConnectionCount = () => {
    return elements.value.filter(el => el.type === 'smoothstep').length
  }

  // 워크플로우 요약 아이템 (computed)
  const workflowSummaryItems = computed(() => {
    const nodes = getNodeSummary()
    return nodes.map(node => ({
      id: node.id,
      icon: node.data?.icon || 'fas fa-cog',
      label: node.data?.label || '처리 노드',
      params: node.data?.params || {},
      nodeType: node.data?.nodeId || node.data?.id
    }))
  })

  // 워크플로우 표시용 아이템
  const processedWorkflowItems = computed(() => {
    const items = []
    const nodes = workflowSummaryItems.value

    if (nodes.length > 0) {
      items.push({ type: 'workflow-node-connection' })
    }

    nodes.forEach((node, index) => {
      items.push({
        type: 'workflow-node',
        icon: node.icon,
        label: node.label,
        params: node.params,
        nodeType: node.nodeType,
        id: node.id
      })

      if (index < nodes.length - 1) {
        items.push({ type: 'workflow-node-connection' })
      }
    })

    if (nodes.length > 0) {
      items.push({ type: 'workflow-node-connection' })
    }

    return items
  })

  return {
    isMaximized,
    showStatusMessage,
    statusMessage,
    statusType,
    showWorkflowErrorDialog,
    workflowErrorTitle,
    workflowErrorMessage,
    workflowErrorDetails,
    containerRef,
    toggleMaximize,
    openImagePreview,
    closeImagePreview,
    closeWorkflowErrorDialog,
    setStatusMessage,
    deleteSelectedNode,
    deleteSelectedEdge,
    handleKeyDown,
    getNodeSummary,
    getWorkflowDisplayItems,
    getNodeCount,
    getConnectionCount,
    workflowSummaryItems,
    processedWorkflowItems
  }
}
