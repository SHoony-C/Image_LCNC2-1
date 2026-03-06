/**
 * Composable for workflow validation logic.
 * Validates the workflow graph structure including node connections,
 * merge node constraints, and start-to-end path reachability.
 *
 * @param {import('vue').Ref} elements - Reactive ref to workflow elements array
 * @param {import('vue').Ref} inputImage - Reactive ref to the input image URL
 * @returns Validation functions
 */
export function useWorkflowValidation(elements, inputImage) {

  /**
   * Validate the entire workflow for correctness.
   * Checks: input image, connections exist, start/end connections,
   * per-node input/output constraints, merge node limits, and BFS reachability.
   *
   * @returns {{ valid: boolean, message: string, details?: string }}
   */
  const validateWorkflow = () => {
    // 1. 입력 이미지 확인
    if (!inputImage.value) {
      return {
        valid: false,
        message: '입력 이미지가 없습니다.',
        details: '워크플로우를 실행하기 전에 이미지를 로드해주세요.'
      }
    }

    // 2. 노드와 엣지 확인
    const connections = elements.value.filter(el => el.type === 'smoothstep')
    const nodes = elements.value.filter(el => el.type !== 'smoothstep')

    if (connections.length === 0) {
      return {
        valid: false,
        message: '워크플로우에 연결선이 없습니다.',
        details: '시작 노드에서 종료 노드까지 연결을 만들어주세요.'
      }
    }

    // 3. 시작 노드에서 나가는 연결 확인
    const startConnections = connections.filter(conn => conn.source === 'start')
    if (startConnections.length === 0) {
      return {
        valid: false,
        message: '시작 노드에서 나가는 연결이 없습니다.',
        details: '시작 노드에서 다른 노드로 연결선을 추가해주세요.'
      }
    }

    // 4. 종료 노드로 들어오는 연결 확인
    const endConnections = connections.filter(conn => conn.target === 'end')
    if (endConnections.length === 0) {
      return {
        valid: false,
        message: '종료 노드로 들어오는 연결이 없습니다.',
        details: '종료 노드로 연결되는 연결선을 추가해주세요.'
      }
    }

    // 5. 노드별 입력/출력 제약사항 검증
    for (const node of nodes) {
      const nodeId = node.id

      const incomingConnections = connections.filter(conn => conn.target === nodeId)

      // 이미지 병합 노드 확인
      const isMergeNode = node.type === 'merge' ||
                         (node.data && node.data.id === 'merge') ||
                         (node.data && node.data.label && node.data.label.includes('병합')) ||
                         (node.data && node.data.label && node.data.label.includes('merge')) ||
                         (node.id && node.id.includes('merge')) ||
                         (node.name && node.name.includes('merge'))

      if (isMergeNode) {
        if (incomingConnections.length < 2) {
          return {
            valid: false,
            message: '이미지 병합 노드에 입력이 부족합니다.',
            details: `병합 노드 '${node.data?.label || nodeId}'는 최소 2개 이상의 입력이 필요합니다. 현재 ${incomingConnections.length}개 입력만 연결되어 있습니다. 하나의 입력 핸들에 여러 연결선을 연결할 수 있습니다.`
          }
        }

        if (incomingConnections.length > 5) {
          return {
            valid: false,
            message: '이미지 병합 노드의 입력이 너무 많습니다.',
            details: `병합 노드 '${node.data?.label || nodeId}'는 최대 5개까지의 입력만 허용됩니다. 현재 ${incomingConnections.length}개 입력이 연결되어 있습니다. 일부 연결을 제거해주세요.`
          }
        }
      } else {
        if (nodeId !== 'start' && nodeId !== 'end' && incomingConnections.length > 1) {
          return {
            valid: false,
            message: '노드에 여러 입력이 연결되어 있습니다.',
            details: `노드 '${node.data?.label || nodeId}'는 하나의 입력만 허용됩니다. 현재 ${incomingConnections.length}개 입력이 연결되어 있습니다. 여러 이미지를 병합하려면 이미지 병합 노드를 사용하세요.`
          }
        }

        if (nodeId !== 'start' && incomingConnections.length === 0) {
          return {
            valid: false,
            message: '노드에 입력이 연결되어 있지 않습니다.',
            details: `노드 '${node.data?.label || nodeId}'에 입력을 연결해주세요.`
          }
        }
      }

      // 노드에서 나가는 연결 개수 확인
      const outgoingConnections = connections.filter(conn => conn.source === nodeId)

      if (nodeId !== 'end' && outgoingConnections.length === 0) {
        return {
          valid: false,
          message: '노드에서 나가는 연결이 없습니다.',
          details: `노드 '${node.data?.label || nodeId}'에서 다른 노드로의 연결을 추가해주세요.`
        }
      }
    }

    // 6. 연결 경로 확인 (시작 -> 종료) via BFS
    const graph = {}
    elements.value.filter(el => el.type !== 'smoothstep').forEach(node => {
      graph[node.id] = []
    })

    connections.forEach(conn => {
      if (!graph[conn.source]) graph[conn.source] = []
      graph[conn.source].push(conn.target)
    })

    const queue = ['start']
    const visited = new Set(['start'])

    while (queue.length > 0) {
      const current = queue.shift()

      if (current === 'end') {
        return {
          valid: true,
          message: '워크플로우가 유효합니다.'
        }
      }

      const neighbors = graph[current] || []
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push(neighbor)
        }
      }
    }

    return {
      valid: false,
      message: '시작부터 종료까지의 경로가 없습니다.',
      details: '시작 노드에서 종료 노드까지 연결된 경로를 만들어주세요. 모든 노드가 올바르게 연결되어 있는지 확인하세요.'
    }
  }

  /**
   * Find the processing path from start to end using topological sort (DFS).
   * Handles merge nodes that need all inputs processed before execution.
   *
   * @returns {string[]|null} Ordered array of node IDs, or null if invalid
   */
  const findProcessingPath = () => {
    const connections = elements.value.filter(el => el.type === 'smoothstep')
    const nodes = elements.value.filter(el => el.type !== 'smoothstep')

    const graph = {}
    for (const node of nodes) {
      graph[node.id] = []
    }

    for (const conn of connections) {
      if (!graph[conn.source]) graph[conn.source] = []
      graph[conn.source].push(conn.target)
    }

    const visited = new Set()
    const visiting = new Set()
    const path = []

    const mergeNodes = nodes
      .filter(node => node.type === 'merge' || (node.data && node.data.id === 'merge'))
      .map(node => node.id)

    const incomingEdges = {}
    for (const node of nodes) {
      incomingEdges[node.id] = 0
    }

    for (const conn of connections) {
      incomingEdges[conn.target] = (incomingEdges[conn.target] || 0) + 1
    }

    const findPathDFS = (nodeId) => {
      if (visiting.has(nodeId)) {
        console.error('순환 참조 발견:', nodeId)
        return false
      }

      if (visited.has(nodeId)) return true

      visiting.add(nodeId)

      const children = graph[nodeId] || []
      for (const child of children) {
        if (!findPathDFS(child)) return false
      }

      visiting.delete(nodeId)
      visited.add(nodeId)
      path.unshift(nodeId)
      return true
    }

    if (!findPathDFS('start')) {
      console.error('순환 참조가 있어 유효한 경로를 찾을 수 없습니다')
      return null
    }

    if (!visited.has('end')) {
      console.error('시작부터 종료까지의 경로가 없습니다')
      return null
    }

    let finalPath = []
    for (let i = 0; i < path.length; i++) {
      const nodeId = path[i]

      if (mergeNodes.includes(nodeId)) {
        const inputNodeIds = connections
          .filter(conn =>
            conn.target === nodeId &&
            conn.targetHandle?.startsWith('input-')
          )
          .map(conn => conn.source)

        const allInputsProcessed = inputNodeIds.every(inputId =>
          finalPath.includes(inputId) || inputId === 'start'
        )

        if (allInputsProcessed) {
          finalPath.push(nodeId)
        } else {
          path.push(nodeId)
        }
      } else {
        finalPath.push(nodeId)
      }
    }

    return finalPath
  }

  return {
    validateWorkflow,
    findProcessingPath
  }
}
