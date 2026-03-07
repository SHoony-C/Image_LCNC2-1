import { onMounted } from 'vue'

/**
 * Composable for user actions in the I-APP popup.
 * Handles loading workflow to MSA5, closing popup, and event bus initialization.
 *
 * @param {Object} props - Component props (image)
 * @param {Object} deps - Dependencies
 * @param {Function} deps.emit - Component emit function
 * @returns Action functions
 */
export function useActions(props, deps) {
  // deps: { emit }

  function close() {
    deps.emit('close')
  }

  function loadWorkflowToMSA5() {
    console.log('=== MSA3 → MSA5 워크플로우 로드 시작 ===')
    console.log('원본 이미지 객체:', props.image)
    console.log('원본 워크플로우 데이터:', props.image ? props.image.workflow : 'null')

    // 워크플로우 데이터 검증
    if (!props.image || !props.image.workflow) {
      console.error('워크플로우 데이터가 없습니다.')
      console.error('image 존재 여부:', !!props.image)
      console.error('workflow 존재 여부:', !!(props.image && props.image.workflow))
      alert('워크플로우 데이터가 없습니다.')
      return
    }

    // 워크플로우 구조 분석
    const rawWorkflow = props.image.workflow
    console.log('워크플로우 원본 데이터 타입:', typeof rawWorkflow)
    console.log('워크플로우 원본 데이터 키:', Object.keys(rawWorkflow))
    console.log('워크플로우 전체 내용:', rawWorkflow)

    // elements 배열이 있는지 확인
    if (rawWorkflow.elements && Array.isArray(rawWorkflow.elements)) {
      console.log('elements 배열 발견, 길이:', rawWorkflow.elements.length)
      console.log('elements 내용:', rawWorkflow.elements)

      // MSA5에 직접 전송할 데이터 준비
      const workflowData = {
        workflow_name: rawWorkflow.workflow_name || 'Loaded Workflow',
        elements: rawWorkflow.elements,
        input_image_url: rawWorkflow.input_image_url || null,
        originalWorkflow: rawWorkflow
      }

      console.log('MSA5로 전송할 최종 데이터:', workflowData)

      // 이벤트 버스를 통해 MSA5에 워크플로우 데이터 전송
      if (window.MSAEventBus) {
        window.MSAEventBus.emit('load-workflow-to-msa5', workflowData)
        console.log('MSAEventBus를 통해 load-workflow-to-msa5 이벤트 발생')
      }

      // 직접 DOM 이벤트로도 전송 (추가 안전장치)
      const event = new CustomEvent('load-workflow-to-msa5', {
        detail: workflowData,
        bubbles: true
      })
      document.dispatchEvent(event)
      console.log('DOM 이벤트를 통해 load-workflow-to-msa5 이벤트 발생')

      // 팝업 닫기
      close()

      // 성공 메시지 표시
      alert('워크플로우가 MSA5로 로드되었습니다.')
      return
    }

    // elements가 없는 경우 기존 로직 사용
    console.log('elements 배열이 없음, 기존 노드 추출 로직 사용')

    // 가능한 노드 키 목록
    const possibleNodeKeys = ['nodes', 'node', 'elements', 'steps', 'operations']

    // 노드 데이터 추출 (다양한 구조 지원)
    let nodes = []

    // 1. 직접적인 노드 배열 검색
    let foundNodesDirectly = false
    for (const key of possibleNodeKeys) {
      if (rawWorkflow[key] && Array.isArray(rawWorkflow[key])) {
        nodes = rawWorkflow[key]
        console.log(`직접적인 노드 배열 발견: "${key}", 길이:`, nodes.length)
        foundNodesDirectly = true
        break
      }
    }

    // 2. 중첩된 위치에서 노드 배열 검색
    if (!foundNodesDirectly) {
      for (const key of Object.keys(rawWorkflow)) {
        if (typeof rawWorkflow[key] === 'object' && rawWorkflow[key] !== null) {
          for (const innerKey of possibleNodeKeys) {
            if (rawWorkflow[key][innerKey] && Array.isArray(rawWorkflow[key][innerKey])) {
              nodes = rawWorkflow[key][innerKey]
              console.log(`중첩된 노드 배열 발견: "${key}.${innerKey}", 길이:`, nodes.length)
              foundNodesDirectly = true
              break
            }
          }
          if (foundNodesDirectly) break
        }
      }
    }

    // 최종 노드 필터링 - 유효한 객체만 유지
    nodes = nodes.filter(node => node && typeof node === 'object')

    console.log('추출된 노드 목록:', nodes)

    if (nodes.length === 0) {
      console.error('워크플로우에 유효한 노드가 없습니다.')
      alert('워크플로우에 노드가 없습니다.')
      return
    }

    // 워크플로우 이름 추출
    const workflowName = rawWorkflow.name || rawWorkflow.title ||
                          (props.image.title ? `${props.image.title}_workflow` : null)

    // 전달할 데이터 준비 (기존 로직)
    const workflowData = {
      name: workflowName,
      nodes: nodes,
      edges: rawWorkflow.edges || [],
      originalWorkflow: rawWorkflow
    }

    console.log('MSA5로 전송할 워크플로우 데이터 (기존 로직):', workflowData)

    // 이벤트 버스를 통해 MSA5에 워크플로우 데이터 전송
    if (window.MSAEventBus) {
      window.MSAEventBus.emit('load-workflow-to-msa5', workflowData)
      console.log('MSAEventBus를 통해 load-workflow-to-msa5 이벤트 발생')
    }

    // 직접 DOM 이벤트로도 전송 (추가 안전장치)
    const event = new CustomEvent('load-workflow-to-msa5', {
      detail: workflowData,
      bubbles: true
    })
    document.dispatchEvent(event)
    console.log('DOM 이벤트를 통해 load-workflow-to-msa5 이벤트 발생')

    // 팝업 닫기
    close()

    // 성공 메시지 표시
    alert('워크플로우가 MSA5로 로드되었습니다.')
  }

  // =============================================
  // Event bus initialization (lifecycle)
  // =============================================
  function initEventBus() {
    // 전역 이벤트 버스 초기화 (없으면 생성)
    if (!window.MSAEventBus) {
      window.MSAEventBus = {
        listeners: {},
        emit(event, data) {
          if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data))
          }
        },
        on(event, callback) {
          if (!this.listeners[event]) {
            this.listeners[event] = []
          }
          this.listeners[event].push(callback)
        },
        off(event, callback) {
          if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(
              cb => cb !== callback
            )
          }
        }
      }
    }
  }

  onMounted(() => {
    initEventBus()
  })

  return {
    close,
    loadWorkflowToMSA5
  }
}
