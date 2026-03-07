import { computed } from 'vue'

/**
 * Composable for workflow data processing and node visualization in the I-APP popup.
 * Handles workflow metadata extraction, node processing, formatting, and debugging.
 *
 * @param {Object} props - Component props (image)
 * @returns Workflow computed properties and helper functions
 */
export function useWorkflow(props) {
  // =============================================
  // API compatibility mapping for node types
  // =============================================
  const apiCompatibilityMap = {
    'median': 'median_filter',
    'blur': 'gaussian_blur',
    'gamma': 'gamma',
    'gamma_correction': 'gamma',
    'anisotropic': 'anisotropic_diffusion',
    'anisotropic_diffusion_filter': 'anisotropic_diffusion',
    'anisotropic_filter': 'anisotropic_diffusion',
    '비등방성 확산': 'anisotropic_diffusion',
    '비등방성': 'anisotropic_diffusion',
    '확산 필터': 'anisotropic_diffusion',
    '비등방성 확산 필터': 'anisotropic_diffusion',
    'clahe': 'clahe',
    'threshold': 'threshold',
    'edge': 'edge',
    'edge_detection': 'edge',
    'brightness': 'brightness',
    'contrast': 'contrast',
    'histogram_eq': 'histogram_equalization',
    'hist_eq': 'histogram_equalization',
    'histogram': 'histogram_equalization',
    'histogram_equalization': 'histogram_equalization',
    'object_detection': 'object_detection',
    'object-detection': 'object_detection',
    'object': 'object_detection',
    'opening': 'opening',
    'closing': 'closing',
    'hrnet': 'hrnet',
    'unet_attention': 'unet_attention',
    'unet-attention': 'unet_attention',
    'unet+attention': 'unet_attention',
  }

  // =============================================
  // Formatting helpers
  // =============================================
  function formatDate(timestamp) {
    if (!timestamp) return 'Unknown'
    const date = new Date(timestamp)
    return date.toLocaleString()
  }

  function getNodeIcon(nodeType) {
    const iconMap = {
      'start': 'mdi mdi-play',
      'end': 'mdi mdi-stop',
      'input': 'mdi mdi-file-import',
      'output': 'mdi mdi-file-export',
      'process': 'mdi mdi-cog',
      'filter': 'mdi mdi-filter',
      'transform': 'mdi mdi-auto-fix',
      'custom': 'mdi mdi-cube',
      'median': 'fas fa-brush',
      'gamma': 'fas fa-sliders-h',
      'clahe': 'fas fa-chart-line'
    }
    return iconMap[nodeType.toLowerCase()] || 'mdi mdi-cube'
  }

  function getShortFilename(filename) {
    if (!filename) return ''
    // 너무 긴 파일명은 앞뒤 10자만 표시하고 중간은 ...으로 줄임
    if (filename.length > 25) {
      return filename.substring(0, 10) + '...' + filename.substring(filename.length - 10)
    }
    return filename
  }

  function formatParamName(key) {
    // 언더스코어를 공백으로 변환하고 첫 글자를 대문자로
    return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  function formatParamValue(value) {
    if (typeof value === 'number') {
      // 숫자인 경우 소수점 2자리까지만 표시
      return Number.isInteger(value) ? value : value.toFixed(2)
    } else if (typeof value === 'boolean') {
      // 불리언 값 표시
      return value ? '활성화' : '비활성화'
    } else if (Array.isArray(value)) {
      // 배열 값 표시
      return value.join(', ')
    } else if (value === null || value === undefined) {
      return '없음'
    }
    return value
  }

  function getFilteredParams(params) {
    if (!params) return {}
    const result = {}

    Object.entries(params).forEach(([key, value]) => {
      if (key !== 'enabled' && key !== '0') {
        result[key] = value
      }
    })

    return result
  }

  // =============================================
  // Workflow metadata extraction helpers (method versions)
  // =============================================
  function getWorkflowName(workflow) {
    const possibleNameProps = ['workflow_name', 'name', 'title', 'id']
    for (const prop of possibleNameProps) {
      if (workflow[prop]) {
        return workflow[prop]
      }
    }
    return 'No workflow data available'
  }

  function getWorkflowDescription(workflow) {
    const possibleDescProps = ['description', 'desc', 'summary', 'details']
    for (const prop of possibleDescProps) {
      if (workflow[prop]) {
        return workflow[prop]
      }
    }
    return 'No description data available'
  }

  function getWorkflowTimestamp(workflow) {
    const possibleTimeProps = ['created_at', 'timestamp', 'date', 'created', 'time']
    for (const prop of possibleTimeProps) {
      if (workflow[prop]) {
        return workflow[prop]
      }
    }
    // Return null to indicate no timestamp instead of current date
    return null
  }

  // =============================================
  // Node helpers
  // =============================================
  function hasWorkflowNodes(workflow) {
    const hasNodes = workflow.nodes && Array.isArray(workflow.nodes) && workflow.nodes.length > 0
    return hasNodes
  }

  function getWorkflowNodes(workflow) {
    return workflow.nodes || []
  }

  function getNodeType(node) {
    return node.type || 'custom'
  }

  function getNodeLabel(node) {
    return node.label || node.name || node.id || node.type || 'Node'
  }

  // =============================================
  // Node type mapping helper
  // =============================================
  function mapNodeType(node) {
    // 원본 타입 저장
    const originalType = node.type || (node.data && node.data.type) || ''

    // 타입 매핑 적용
    if (apiCompatibilityMap[originalType]) {
      if (node.type) {
        node.type = apiCompatibilityMap[originalType]
      }
      if (node.data && node.data.type) {
        node.data.type = apiCompatibilityMap[originalType]
      }

      // 노드 이름도 일관성 있게 변경
      if (node.name) {
        node.name = apiCompatibilityMap[originalType]
      }
    }

    return node
  }

  // =============================================
  // Main node processing
  // =============================================
  function processNodes() {
    if (!props.image || !props.image.workflow) {
      return []
    }

    // elements 배열이 있으면 사용
    if (props.image.workflow.elements && Array.isArray(props.image.workflow.elements)) {
      // start와 end를 제외한 요소들만 반환
      const customNodes = []

      props.image.workflow.elements.forEach((element, index) => {
        if (element.type !== 'start' && element.type !== 'end') {
          // 노드 타입 매핑 적용
          element = mapNodeType(element)
          customNodes.push(element)
        }
      })

      return customNodes
    }

    // 다른 형태의 노드 구조 처리 (기존 코드와 동일)
    if (props.image.workflow.nodes && Array.isArray(props.image.workflow.nodes)) {
      const customNodes = props.image.workflow.nodes
        .filter(node => node.type !== 'start' && node.type !== 'end')
        .map(node => mapNodeType(node))
      return customNodes
    }

    // nodes_summary 배열이 있으면 사용
    if (props.image.workflow.nodes_summary && Array.isArray(props.image.workflow.nodes_summary)) {
      const customNodes = props.image.workflow.nodes_summary
        .filter(node => node.type !== 'start' && node.type !== 'end')
        .map(node => mapNodeType(node))
      return customNodes
    }

    return []
  }

  // =============================================
  // Debugging helpers
  // =============================================
  function inspectWorkflowStructure(workflow, prefix = '') {
    if (!workflow) {
      return
    }

    const keys = Object.keys(workflow)

    const possibleNodeKeys = ['nodes', 'node', 'elements', 'steps', 'operations']
    let foundNodesKey = null

    // 직접적인 노드 배열 검색
    for (const key of possibleNodeKeys) {
      if (workflow[key] && Array.isArray(workflow[key])) {
        foundNodesKey = key
        break
      }
    }

    // 중첩된 위치에서 노드 배열 검색
    if (!foundNodesKey) {
      for (const key of Object.keys(workflow)) {
        if (typeof workflow[key] === 'object' && workflow[key] !== null) {
          for (const innerKey of possibleNodeKeys) {
            if (workflow[key][innerKey] && Array.isArray(workflow[key][innerKey])) {
              foundNodesKey = `${key}.${innerKey}`
              break
            }
          }
          if (foundNodesKey) break
        }
      }
    }

    // 노드 맵 구조 검색 (객체 내 여러 노드 객체가 있는 경우)
    if (!foundNodesKey) {
      let nodeCount = 0
      for (const key of Object.keys(workflow)) {
        if (
          typeof workflow[key] === 'object' &&
          workflow[key] !== null &&
          (workflow[key].type || workflow[key].data)
        ) {
          nodeCount++
        }
      }
    }

    // 워크플로우 속성 상세 분석
    for (const key of Object.keys(workflow)) {
      const value = workflow[key]

      if (Array.isArray(value)) {
        // 배열의 첫 번째 항목 구조 분석
        if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
          // analysis only
        }
      }
    }

    return foundNodesKey
  }

  function debugWorkflow(workflow) {
    try {
      // 특정 노드 타입 확인
      const nodeTypes = new Set()
      const findNodes = (obj) => {
        if (!obj || typeof obj !== 'object') return

        if (obj.type && typeof obj.type === 'string') {
          nodeTypes.add(obj.type)
        }

        if (Array.isArray(obj)) {
          obj.forEach(item => findNodes(item))
          return
        }

        Object.values(obj).forEach(val => {
          if (val && typeof val === 'object') {
            findNodes(val)
          }
        })
      }

      findNodes(workflow)
    } catch (error) {
      console.error('워크플로우 디버깅 중 오류:', error)
    }
  }

  // =============================================
  // Computed properties
  // =============================================
  const workflowNameComputed = computed(() => {
    if (props.image && props.image.workflow) {
      const name = props.image.workflow.workflow_name
      if (name) {
        return name
      }
    }
    return '워크플로우 정보 없음'
  })

  const workflowDescriptionComputed = computed(() => {
    if (props.image && props.image.workflow) {
      const possibleFields = ['description', 'workflow_description']
      for (const field of possibleFields) {
        if (props.image.workflow[field]) {
          return props.image.workflow[field]
        }
      }
    }
    return null
  })

  const workflowTimestampComputed = computed(() => {
    if (props.image && props.image.workflow) {
      const possibleFields = ['created_at', 'timestamp']
      for (const field of possibleFields) {
        if (props.image.workflow[field]) {
          try {
            return new Date(props.image.workflow[field]).toLocaleString()
          } catch (e) {
            return props.image.workflow[field]
          }
        }
      }
    }
    return null
  })

  const hasNodesComputed = computed(() => {
    if (!props.image || !props.image.workflow) {
      return false
    }

    // elements 배열 확인
    if (props.image.workflow.elements && Array.isArray(props.image.workflow.elements)) {
      const hasProcessNodes = props.image.workflow.elements.some(el => el.type !== 'start' && el.type !== 'end')
      return hasProcessNodes
    }

    return false
  })

  const processedNodesComputed = computed(() => {
    if (!props.image || !props.image.workflow) {
      return []
    }

    // Use the same mapping function from processNodes method
    return processNodes()
  })

  const nodeCountComputed = computed(() => {
    return props.image &&
           props.image.workflow &&
           props.image.workflow.nodes
           ? props.image.workflow.nodes.length : 0
  })

  return {
    // Formatting helpers
    formatDate,
    getNodeIcon,
    getShortFilename,
    formatParamName,
    formatParamValue,
    getFilteredParams,

    // Workflow metadata extraction methods
    getWorkflowName,
    getWorkflowDescription,
    getWorkflowTimestamp,

    // Node helpers
    hasWorkflowNodes,
    getWorkflowNodes,
    getNodeType,
    getNodeLabel,

    // Node processing
    processNodes,

    // Debugging
    inspectWorkflowStructure,
    debugWorkflow,

    // Computed properties
    workflowName: workflowNameComputed,
    workflowDescription: workflowDescriptionComputed,
    workflowTimestamp: workflowTimestampComputed,
    hasNodes: hasNodesComputed,
    processedNodes: processedNodesComputed,
    nodeCount: nodeCountComputed
  }
}
