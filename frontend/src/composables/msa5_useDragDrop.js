/**
 * Composable for drag and drop handling in the workflow editor.
 *
 * @param {import('vue').Ref} elements - Reactive ref to workflow elements array
 * @param {import('vue').Ref} selectedNode - Reactive ref to selected node
 * @param {import('vue').Ref} flowInstance - Reactive ref to VueFlow instance
 * @param {import('vue').Ref} workflowArea - Reactive ref to workflow area DOM element
 * @param {Function} getDefaultParams - Function to get default params for a node type
 * @param {import('vue').Ref} defaultOptions - Reactive ref to default options
 * @param {Function} saveToHistory - Function to save history state
 * @param {import('vue').Ref} canSaveWorkflow - Reactive ref to save workflow flag
 * @param {import('vue').Ref} processingStatus - Reactive ref to processing status
 * @returns Drag/drop event handlers
 */
export function useDragDrop(
  elements, selectedNode, flowInstance, workflowArea,
  getDefaultParams, defaultOptions,
  saveToHistory, canSaveWorkflow, processingStatus
) {
  // 드래그 시작 이벤트 핸들러
  const onDragStart = (event, node) => {
    event.dataTransfer.setData('application/vueflow', JSON.stringify(node))
    event.dataTransfer.effectAllowed = 'move'
  }

  // 드래그 오버 이벤트 핸들러
  const onDragOver = (event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  // 드롭 이벤트 핸들러
  const onDrop = (event) => {
    event.preventDefault()

    try {
      const nodeData = JSON.parse(event.dataTransfer.getData('application/vueflow'))

      if (!nodeData) {
        console.warn('드롭된 데이터가 없습니다')
        return
      }

      // 드롭 위치 계산
      let position = { x: 100, y: 100 }

      if (workflowArea.value && flowInstance.value) {
        const reactFlowBounds = workflowArea.value.getBoundingClientRect()
        position = flowInstance.value.project({
          x: event.clientX - reactFlowBounds.left,
          y: event.clientY - reactFlowBounds.top
        })
      }

      // 노드 ID 생성
      const id = `${nodeData.id}_${Date.now()}`

      // 노드 타입 결정
      let type = 'custom'
      if (nodeData.id === 'merge') {
        type = 'merge'
      }

      // 새 노드 생성
      const newNode = {
        id,
        type,
        position,
        data: {
          ...nodeData,
          params: getDefaultParams(nodeData.id, defaultOptions.value)
        }
      }

      // 상태 저장 (실행 취소 지원)
      saveToHistory()

      // 노드 추가
      elements.value = [...elements.value, newNode]

      // 새 노드 선택
      setTimeout(() => {
        const addedNode = elements.value.find(el => el.id === id)
        if (addedNode) {
          selectedNode.value = addedNode
        }
      }, 100)

      canSaveWorkflow.value = false
      processingStatus.value = 'idle'
    } catch (error) {
      console.error('노드 드롭 처리 중 오류:', error)
    }
  }

  return {
    onDragStart,
    onDragOver,
    onDrop
  }
}
