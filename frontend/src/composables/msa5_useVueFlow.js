import { ref } from 'vue'

/**
 * Composable for VueFlow instance management and event handlers.
 *
 * @param {import('vue').Ref} elements - Reactive ref to workflow elements array
 * @param {import('vue').Ref} selectedNode - Reactive ref to selected node
 * @param {import('vue').Ref} selectedEdge - Reactive ref to selected edge
 * @param {Function} getDefaultParams - Function to get default params for a node type
 * @param {import('vue').Ref} defaultOptions - Reactive ref to default options
 * @param {Function} saveToHistory - Function to save history state
 * @param {Function} updateConnections - Function to update connection states
 * @param {import('vue').Ref} canSaveWorkflow - Reactive ref to save workflow flag
 * @param {import('vue').Ref} processingStatus - Reactive ref to processing status
 * @returns VueFlow event handlers and state
 */
export function useVueFlow(
  elements, selectedNode, selectedEdge,
  getDefaultParams, defaultOptions,
  saveToHistory, updateConnections,
  canSaveWorkflow, processingStatus
) {
  const flowInstance = ref(null)

  // VueFlow 초기화
  const onInit = (instance) => {
    flowInstance.value = instance
  }

  // 패널 준비 완료 이벤트 핸들러
  const onPaneReady = (instance) => {
    if (instance) {
      instance.fitView({ padding: 0.2, duration: 200 })
    }
  }

  // 노드 드래그 종료 이벤트 핸들러
  const onNodeDragStop = (event) => {
    // 노드 드래그 완료 시 처리
  }

  // 노드 연결 이벤트 핸들러
  const onConnect = (params) => {
    if (!params.source || !params.target) {
      console.warn('유효하지 않은 연결 파라미터:', params)
      return
    }

    saveToHistory()

    const id = `e_${params.source}_${params.target}_${Date.now()}`

    const newEdge = {
      id,
      source: params.source,
      target: params.target,
      type: 'smoothstep',
      sourceHandle: params.sourceHandle,
      targetHandle: params.targetHandle
    }

    elements.value = [...elements.value, newEdge]

    updateConnections()
    canSaveWorkflow.value = false
    processingStatus.value = 'idle'
  }

  // 노드 클릭 이벤트 핸들러
  const onNodeClick = (event) => {
    const { node } = event

    // 엣지 선택 해제
    selectedEdge.value = null

    if (node && node.type && node.type !== 'smoothstep' && node.data && node.id !== 'start' && node.id !== 'end') {
      if (!node.data.params) {
        console.warn(`Node ${node.id} data is missing params object. Initializing.`)
        node.data.params = getDefaultParams(node.data.id, defaultOptions.value)
      }

      selectedNode.value = node

      // 패널 위치 디버깅
      setTimeout(() => {
        const panelEl = document.querySelector('.options-panel')
        const componentEl = document.querySelector('.msa-component')
        // panelEl and componentEl available for debugging if needed
      }, 10)
    } else {
      selectedNode.value = null
    }
  }

  // 엣지(연결선) 클릭 이벤트 핸들러
  const onEdgeClick = (event) => {
    const { edge } = event
    console.log('엣지 클릭:', edge.id, '마우스 위치:', {
      clientX: event.event?.clientX,
      clientY: event.event?.clientY
    })

    selectedNode.value = null
    selectedEdge.value = edge
  }

  // 캔버스 클릭 이벤트 핸들러
  const handleCanvasClick = (event) => {
    const isCanvas = event.target.classList.contains('workflow-area') ||
                     event.target.classList.contains('vue-flow__pane') ||
                     event.target.classList.contains('vue-flow__transformationpane')

    if (isCanvas && selectedNode.value) {
      selectedNode.value = null
    }
  }

  return {
    flowInstance,
    onInit,
    onPaneReady,
    onNodeDragStop,
    onConnect,
    onNodeClick,
    onEdgeClick,
    handleCanvasClick
  }
}
