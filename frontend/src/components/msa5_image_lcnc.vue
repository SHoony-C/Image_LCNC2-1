<template>
  <div class="msa-component" :class="{ maximized: isMaximized }" tabindex="0" @keydown="handleKeyDown">
    <div class="component-header">
      <div class="header-left">
        <i class="fas fa-image"></i>
        <span>이미지 전처리 LCNC</span>
      </div>
      <div class="header-right">
        <button @click="processStart" class="process-btn" :disabled="!inputImage">
          <i class="fas fa-play-circle"></i>
          Process Start
        </button>
        <button @click="toggleMaximize" class="maximize-btn">
          <i :class="isMaximized ? 'fas fa-compress' : 'fas fa-expand'"></i>
        </button>
      </div>
    </div>

    <!-- 상태 메시지 알림 -->
    <div class="status-message" v-if="showStatusMessage">
      <i class="fas fa-info-circle"></i>
      <span>{{ statusMessage }}</span>
    </div>

    <div class="workflow-container" ref="containerRef">
      <div class="node-palette">
        <div class="palette-header">
          <i class="fas fa-th-large"></i>
          <span>전처리 옵션</span>
        </div>
        
        <!-- 전처리 노드 팔레트 (스크롤 가능) -->
        <div class="preprocessing-nodes-wrapper">
          <div class="preprocessing-nodes-container">
            <template v-if="availableNodes && filteredNodes.length > 0">
              <div v-for="node in filteredNodes" 
                  :key="node.id" 
                  class="palette-node" 
                  draggable="true"
                  @dragstart="onDragStart($event, node)">
                <i :class="node.icon"></i>
                <span>{{ node.label }}</span>
              </div>
            </template>
            <div v-if="!availableNodes || isNodesLoading" class="loading-placeholder">
              <i class="fas fa-spinner fa-spin"></i>
              <span>노드 로딩 중...</span>
            </div>
          </div>
        </div>
        
        <!-- 병합 노드를 하단에 고정 배치 -->
        <div class="merge-palette-section">
          <div v-if="mergeNode" 
              class="merge-node-container" 
              draggable="true" 
              @dragstart="onDragStart($event, mergeNode)">
            <div class="merge-node-preview">
              <div class="diamond-preview">
                <i class="fas fa-object-group"></i>
              </div>
              <span>이미지 병합</span>
            </div>
            <div class="merge-node-desc">
              여러 이미지를 하나로 병합합니다 (최대 5개 입력)
            </div>
          </div>
        </div>
      </div>

      <div class="workflow-area" @dragover="onDragOver" @drop="onDrop" ref="workflowArea">

        <VueFlow v-model="elements" 
          :default-viewport="{ x: 0, y: 0, zoom: 0.7 }"
          :style="{ width: '100%', height: '100%' }"
          @connect="onConnect" @node-drag-stop="onNodeDragStop" @node-click="onNodeClick"
          :min-zoom="0.2" :max-zoom="2" :snap-to-grid="true" :snap-grid="[15, 15]"
          :fit-view-on-init="true"
          :auto-connect="false"
          @pane-ready="onPaneReady"
          @init="onInit">
          <Background pattern-color="#aaa" gap="8" />
          <Controls />
          <MiniMap 
            ref="minimap"
            node-color="#8b5cf6" 
            mask-color="rgba(139, 92, 246, 0.1)"
            class="custom-minimap"
            :pannable="true"
          />
          
          <template #node-start>
            <div class="start-node" :class="{ 'has-connection': hasInput, 'has-image': !!inputImage }">
              <Handle type="source" position="right" />
              <div class="node-header">
                <i class="fas fa-play"></i>
                <span>시작</span>
              </div>
              <div class="node-image" v-if="inputImage" @click.stop="openImagePreview(inputImage)">
                <img :src="inputImage" alt="Input image" />
              </div>
            </div>
          </template>

          <template #node-end>
            <div class="end-node" :class="{ 'has-connection': hasOutput, 'has-image': !!processedImages['end'] }">
              <Handle type="target" position="left" />
              <div class="node-header">
                <i class="fas fa-stop"></i>
                <span>종료</span>
              </div>
              <div class="node-image" v-if="processedImages['end']" @click.stop="openImagePreview(processedImages['end'])">
                <img :src="processedImages['end']" alt="Output image" />
              </div>
            </div>
          </template>

          <template #node-custom="nodeProps">
            <div class="workflow-node">
              <Handle type="target" position="left" />
              <Handle type="source" position="right" />
              <div class="node-header">
                <i :class="nodeProps.data.icon"></i>
                <span>{{ nodeProps.data.label }}</span>
              </div>
              <div class="node-image" v-if="processedImages[nodeProps.id]" @click.stop="openImagePreview(processedImages[nodeProps.id])">
                <img :src="processedImages[nodeProps.id]" alt="Processed image" />
              </div>
            </div>
          </template>

          <template #node-merge="nodeProps">
            <div class="merge-node">
              <!-- 여러 입력을 받을 수 있도록 핸들 위치 조정 -->
              <Handle type="target" position="left" id="input-1" :style="{ left: '-5px', top: '30%', transform: 'none' }" />
              <Handle type="target" position="left" id="input-2" :style="{ left: '-5px', top: '50%', transform: 'none' }" />
              <Handle type="target" position="left" id="input-3" :style="{ left: '-5px', top: '70%', transform: 'none' }" />
              <Handle type="target" position="top" id="input-4" :style="{ top: '-5px', left: '30%', transform: 'none' }" />
              <Handle type="target" position="top" id="input-5" :style="{ top: '-5px', left: '70%', transform: 'none' }" />
              <Handle type="source" position="right" id="output" :style="{ right: '-5px', top: '50%', transform: 'none' }" />
              
              <div class="node-header">
                <i :class="nodeProps.data.icon"></i>
                <span>{{ nodeProps.data.label }}</span>
              </div>
              <div class="node-image" v-if="processedImages[nodeProps.id]" @click.stop="openImagePreview(processedImages[nodeProps.id])">
                <img :src="processedImages[nodeProps.id]" alt="Merged image" />
              </div>
            </div>
          </template>
        </VueFlow>
      </div>

      <div class="options-panel" v-if="selectedNode" :class="{ 'fullscreen-panel': isMaximized }">
        <div class="panel-header">
          <h3>{{ selectedNode.data.label }} 설정</h3>
          <button class="close-btn" @click="selectedNode = null">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="panel-content">
          <div v-for="(param, key) in selectedNode.data.params" :key="key" class="param-item">
            <label>{{ param.label }}</label>
            <template v-if="param.options">
              <select v-model="param.value" class="param-input">
                <option v-for="option in param.options" :key="option" :value="option">
                  {{ option }}
                </option>
              </select>
            </template>
            <template v-else>
              <input type="number" v-model="param.value" class="param-input"
                :min="param.min" :max="param.max" :step="param.step">
            </template>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 이미지 프리뷰 팝업 -->
    <Teleport to="body">
      <div class="image-preview-overlay" v-if="previewImageUrl" @click="closeImagePreview">
        <div class="image-preview-container" @click.stop>
          <div class="preview-header">
            <h3>이미지 상세보기</h3>
            <button class="close-preview-btn" @click="closeImagePreview">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="preview-content">
            <img :src="previewImageUrl" alt="Preview" class="preview-image">
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, reactive, computed } from 'vue'
import { VueFlow, Handle } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/core/dist/style.css'

export default {
  name: 'MSA5ImageLCNC',
  components: {
    VueFlow,
    MiniMap,
    Handle,
    Background,
    Controls
  },
  setup() {
    const isMaximized = ref(false)
    const hasInput = ref(false)
    const hasOutput = ref(false)
    const elements = ref([])
    const selectedNode = ref(null)
    const inputImage = ref('')
    const processedImages = reactive({})
    const processingStatus = ref('idle')
    const previewImageUrl = ref(null)
    const showStatusMessage = ref(false)
    const statusMessage = ref('')
    const availableNodes = ref([])
    const isNodesLoading = ref(true)
    const flowInstance = ref(null)
    const defaultOptions = ref({})
    const processingQueue = ref([])
    const containerRef = ref(null)
    
    // 이미지 해시 계산 함수
    const calculateImageHash = async (base64Image) => {
      // base64 데이터 추출
      const base64Data = base64Image.split(',')[1];
      // ArrayBuffer로 변환
      const binaryData = atob(base64Data);
      const bytes = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        bytes[i] = binaryData.charCodeAt(i);
      }
      // 해시 계산
      const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    // 노드 필터링을 위한 computed 속성
    const filteredNodes = computed(() => {
      return availableNodes.value ? availableNodes.value.filter(n => n && n.id !== 'merge') : [];
    });
    
    // 병합 노드를 위한 computed 속성
    const mergeNode = computed(() => {
      return availableNodes.value ? availableNodes.value.find(n => n && n.id === 'merge') : null;
    });

    // 실행 취소/다시 실행 기록을 위한 상태 변수 추가
    const undoStack = ref([])
    const redoStack = ref([])
    const MAX_HISTORY = 20 // 최대 히스토리 갯수

    // 노드/엣지 작업 내역 저장
    const saveToHistory = () => {
      // 너무 많은 히스토리를 저장하지 않도록 제한
      if (undoStack.value.length >= MAX_HISTORY) {
        undoStack.value.shift() // 가장 오래된 히스토리 제거
      }
      
      // 현재 상태 깊은 복사하여 저장
      undoStack.value.push(JSON.parse(JSON.stringify(elements.value)))
      
      // 새 액션 이후 redo 스택은 비움
      redoStack.value = []
    }

    // 실행 취소 (Ctrl+Z)
    const undo = () => {
      if (undoStack.value.length === 0) return
      
      // 현재 상태를 redo 스택에 저장
      redoStack.value.push(JSON.parse(JSON.stringify(elements.value)))
      
      // 마지막 저장된 상태로 되돌림
      const lastState = undoStack.value.pop()
      elements.value = lastState
      
      // 실행 취소 후 입력/출력 연결 상태 업데이트
      updateConnections()
    }

    // 다시 실행 (Ctrl+Y)
    const redo = () => {
      if (redoStack.value.length === 0) return
      
      // 현재 상태를 undo 스택에 저장
      undoStack.value.push(JSON.parse(JSON.stringify(elements.value)))
      
      // redo 스택에서 상태 복원
      const nextState = redoStack.value.pop()
      elements.value = nextState
      
      // 다시 실행 후 입력/출력 연결 상태 업데이트
      updateConnections()
    }

    // 선택한 노드 삭제
    const deleteSelectedNode = () => {
      if (!selectedNode.value) return
      
      // 해당 노드의 ID
      const nodeId = selectedNode.value.id
      
      // 변경 전 상태 저장
      saveToHistory()
      
      // 연결된 엣지 먼저 삭제
      elements.value = elements.value.filter(el => {
        if (el.type === 'smoothstep') {
          return el.source !== nodeId && el.target !== nodeId
        }
        return true
      })
      
      // 노드 삭제
      elements.value = elements.value.filter(el => el.id !== nodeId)
      
      // 선택 해제
      selectedNode.value = null
      
      // 입력/출력 연결 상태 업데이트
      updateConnections()
    }

    // 키보드 이벤트 핸들러
    const handleKeyDown = (event) => {
      console.log('키보드 이벤트 감지:', event.key, event.ctrlKey);
      console.log('키보드 이벤트 상세정보:', {
        key: event.key,
        code: event.code,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey,
        target: event.target.tagName,
        activeElement: document.activeElement?.tagName
      });
      
      // Escape 키는 이미지 프리뷰 닫기
      if (event.key === 'Escape' && previewImageUrl.value) {
        closeImagePreview();
        return;
      }
      
      // Delete 키로 선택된 노드 삭제
      if (event.key === 'Delete' && selectedNode.value) {
        console.log('Delete 키 감지 - 노드 삭제 실행');
        deleteSelectedNode();
        event.preventDefault();
        return;
      }
      
      // Ctrl+Z: 실행 취소
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        console.log('Ctrl+Z 감지 - 실행 취소 실행');
        event.preventDefault();
        undo();
        return;
      }
      
      // Ctrl+Y: 다시 실행
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        console.log('Ctrl+Y 감지 - 다시 실행 실행');
        event.preventDefault();
        redo();
        return;
      }
    }

    // 연결 상태 업데이트
    const updateConnections = () => {
      const connections = elements.value.filter(el => el.type === 'smoothstep')
      
      // 시작 노드에서 나가는 연결 확인
      hasInput.value = connections.some(conn => conn.source === 'start')
      
      // 종료 노드로 들어오는 연결 확인
      hasOutput.value = connections.some(conn => conn.target === 'end')
    }

    // 이미지 프리뷰 열기
    const openImagePreview = (imageUrl) => {
      previewImageUrl.value = imageUrl
    }

    // 이미지 프리뷰 닫기
    const closeImagePreview = () => {
      previewImageUrl.value = null
    }

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

    // 최대화 버튼 토글
    const toggleMaximize = () => {
      isMaximized.value = !isMaximized.value
    }

    // VueFlow 초기화
    const onInit = (instance) => {
      flowInstance.value = instance
      console.log('VueFlow initialized')
    }

    // 패널 준비 완료 이벤트 핸들러
    const onPaneReady = (instance) => {
      console.log('VueFlow pane ready')
      if (instance) {
        instance.fitView({ padding: 0.2, duration: 200 })
      }
    }

    // 노드 드래그 종료 이벤트 핸들러
    const onNodeDragStop = (event) => {
      console.log('Node dragged:', event.node.id)
    }

    // 노드 클릭 이벤트 핸들러
    const onNodeClick = (event) => {
      const { node } = event
      console.log('노드 클릭:', node.id, '마우스 위치:', { 
        clientX: event.event?.clientX, 
        clientY: event.event?.clientY,
        screenX: event.event?.screenX, 
        screenY: event.event?.screenY 
      });
      
      if (node && node.type && node.type !== 'smoothstep' && node.data && node.id !== 'start' && node.id !== 'end') {
        if (!node.data.params) {
          console.warn(`Node ${node.id} data is missing params object. Initializing.`)
          node.data.params = getDefaultParams(node.data.id, defaultOptions.value)
        }
        
        selectedNode.value = node
        console.log('Node selected:', selectedNode.value);
        
        // 패널 위치 디버깅 로그
        setTimeout(() => {
          const panelEl = document.querySelector('.options-panel');
          const componentEl = document.querySelector('.msa-component');
          
          if (panelEl && componentEl) {
            console.log('옵션 패널 위치 정보:', {
              panel: {
                offsetTop: panelEl.offsetTop,
                offsetLeft: panelEl.offsetLeft,
                offsetWidth: panelEl.offsetWidth,
                offsetHeight: panelEl.offsetHeight,
                clientRect: panelEl.getBoundingClientRect()
              },
              component: {
                isMaximized: isMaximized.value,
                clientRect: componentEl.getBoundingClientRect()
              },
              windowSize: {
                innerWidth: window.innerWidth,
                innerHeight: window.innerHeight
              }
            });
          }
        }, 10);
      } else {
        selectedNode.value = null
        console.log('Node deselected or invalid node clicked.')
      }
    }

    // 워크플로우 처리 시작
    const processStart = async () => {
      if (!inputImage.value) return
      
      showStatusMessage.value = true
      statusMessage.value = '워크플로우 처리 시작...'
      processingStatus.value = 'processing'
      
      // 처리된 이미지 초기화 (시작 노드는 유지)
      Object.keys(processedImages).forEach(key => {
        if (key !== 'start') delete processedImages[key]
      })
      
      // 워크플로우 처리 경로 찾기
      const workflow = findProcessingPath()
      if (!workflow || workflow.length === 0) {
        console.error('유효한 워크플로우 경로를 찾을 수 없습니다')
        processingStatus.value = 'error'
        statusMessage.value = '유효한 워크플로우 경로가 없습니다. 시작부터 종료까지 연결된 경로를 만들어주세요.'
        showStatusMessage.value = true
        setTimeout(() => { showStatusMessage.value = false }, 5000)
        return
      }
      
      console.log('처리할 워크플로우 경로:', workflow)
      
      try {
        // 워크플로우 처리
        await processWorkflow()
        
        // MongoDB에 워크플로우 저장
        if (processedImages['end']) {
          // 세션 ID 생성 (현재 시간 기반)
          const sessionId = `workflow_${Date.now()}`
          
          // 저장할 워크플로우 데이터 구성
          const workflowData = {
            session_id: sessionId,
            input_image_hash: await calculateImageHash(inputImage.value),
            elements: elements.value.map(element => {
              if (element.type === 'smoothstep') return element;
              
              // 노드 데이터 구조화 - 실제 값만 저장
              const nodeData = {
                id: element.data.id,
                label: element.data.label,
                position: element.position
              };

              // params에서 실제 값만 추출하여 상위 레벨로 이동
              if (element.data.params) {
                Object.entries(element.data.params).forEach(([key, param]) => {
                  nodeData[key] = param.value;
                });
              }

              return nodeData;
            }),
            timestamp: new Date().toISOString()
          }
          
          // API 호출하여 MongoDB에 저장
          const response = await fetch('http://localhost:8000/api/msa5/save-workflow', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(workflowData)
          })
          
          const result = await response.json()
          
          if (result.status === 'success') {
            console.log('워크플로우가 MongoDB에 성공적으로 저장되었습니다')
            // 세션 ID를 localStorage에 저장 (측정 결과 저장 시 사용)
            localStorage.setItem('current_workflow_session_id', sessionId)
          } else {
            console.error('워크플로우 저장 실패:', result.message)
          }
        }
      } catch (error) {
        console.error('워크플로우 처리 또는 저장 중 오류 발생:', error)
        processingStatus.value = 'error'
        statusMessage.value = `처리 오류: ${error.message || '알 수 없는 오류'}`
        showStatusMessage.value = true
        setTimeout(() => { showStatusMessage.value = false }, 5000)
      }
    }
    
    // 워크플로우 처리 경로 찾기 (시작 노드부터 종료 노드까지)
    const findProcessingPath = () => {
      const connections = elements.value.filter(el => el.type === 'smoothstep')
      const nodes = elements.value.filter(el => el.type !== 'smoothstep')
      
      // 그래프 구성
      const graph = {}
      for (const node of nodes) {
        graph[node.id] = []
      }
      
      // 연결 관계 설정
      for (const conn of connections) {
        if (!graph[conn.source]) graph[conn.source] = []
        graph[conn.source].push(conn.target)
      }
      
      // 각 노드의 방문 상태 추적
      const visited = new Set()
      const visiting = new Set() // 순환 참조 검사용
      const path = []
      
      // 병합 노드 식별
      const mergeNodes = nodes
        .filter(node => node.type === 'merge' || (node.data && node.data.id === 'merge'))
        .map(node => node.id)
      
      // 각 노드로 들어오는 엣지 개수 (병합 노드의 여러 입력 처리용)
      const incomingEdges = {}
      for (const node of nodes) {
        incomingEdges[node.id] = 0
      }
      
      for (const conn of connections) {
        incomingEdges[conn.target] = (incomingEdges[conn.target] || 0) + 1
      }
      
      // DFS로 유효 경로 탐색 (순환 참조 확인 포함)
      const findPathDFS = (nodeId) => {
        // 순환 참조 확인
        if (visiting.has(nodeId)) {
          console.error('순환 참조 발견:', nodeId)
          return false
        }
        
        // 이미 방문한 노드는 건너뜀
        if (visited.has(nodeId)) return true
        
        visiting.add(nodeId)
        
        // 자식 노드들 재귀 호출
        const children = graph[nodeId] || []
        for (const child of children) {
          if (!findPathDFS(child)) return false
        }
        
        // 방문 완료
        visiting.delete(nodeId)
        visited.add(nodeId)
        
        // 경로에 추가 (역순)
        path.unshift(nodeId)
        return true
      }
      
      // 시작 노드부터 DFS 시작
      if (!findPathDFS('start')) {
        console.error('순환 참조가 있어 유효한 경로를 찾을 수 없습니다')
        return null
      }
      
      // 종료 노드가 경로에 포함되었는지 확인
      if (!visited.has('end')) {
        console.error('시작부터 종료까지의 경로가 없습니다')
        return null
      }
      
      // 병합 노드의 입력이 모두 처리될 수 있도록 경로 조정
      let finalPath = []
      for (let i = 0; i < path.length; i++) {
        const nodeId = path[i]
        
        if (mergeNodes.includes(nodeId)) {
          // 병합 노드로 들어오는 모든 입력 노드 확인
          const inputNodeIds = connections
            .filter(conn => 
              conn.target === nodeId && 
              conn.targetHandle?.startsWith('input-')
            )
            .map(conn => conn.source)
          
          // 모든 입력 노드가 이미 처리되었는지 확인
          const allInputsProcessed = inputNodeIds.every(inputId => 
            finalPath.includes(inputId) || inputId === 'start'
          )
          
          if (allInputsProcessed) {
            finalPath.push(nodeId)
          } else {
            // 아직 모든 입력이 처리되지 않았으면 나중에 다시 시도
            path.push(nodeId)
          }
        } else {
          finalPath.push(nodeId)
        }
      }
      
      return finalPath
    }
    
    // 워크플로우 실제 처리 함수
    const processWorkflow = async () => {
      try {
        console.log('워크플로우 처리 시작')
        
        // 처리 큐 초기화
        processingQueue.value = []
        
        // 시작 노드 처리
        const startNode = elements.value.find(node => node.id === 'start')
        if (!startNode) {
          throw new Error('시작 노드를 찾을 수 없습니다')
        }
        
        // 시작 노드에서 나가는 엣지 찾기
        const startEdges = elements.value.filter(edge => 
          edge.type === 'smoothstep' && edge.source === 'start'
        )
        
        // 시작 이미지 확인
        const startImage = processedImages['start']
        if (!startImage) {
          throw new Error('시작 이미지가 없습니다')
        }
        
        // 처리 큐에 시작 엣지 추가
        processingQueue.value.push(...startEdges)
        console.log('처리 큐 초기화:', processingQueue.value.length, '개 엣지')
        
        // 큐에 있는 엣지 순서대로 처리
        while (processingQueue.value.length > 0) {
          const edge = processingQueue.value.shift()
          console.log('현재 처리 중인 엣지:', edge.id)
          
          const sourceNode = elements.value.find(node => node.id === edge.source)
          const targetNode = elements.value.find(node => node.id === edge.target)
          
          if (!sourceNode || !targetNode) {
            console.warn('엣지의 소스 또는 타겟 노드를 찾을 수 없습니다:', edge.id)
            continue
          }
          
          // 이미 처리된 노드는 건너뜀
          if (processedImages[targetNode.id]) {
            console.log(`노드 ${targetNode.id}는 이미 처리되었습니다. 건너뜁니다.`)
            continue
          }
          
          // 소스 노드의 출력 이미지 확인
          const sourceImage = processedImages[sourceNode.id]
          if (!sourceImage) {
            console.warn(`소스 노드 ${sourceNode.id}의 이미지가 없습니다`)
            continue
          }
          
          // 타겟 노드 처리
          let processedImage = null
          
          if (targetNode.type === 'merge') {
            // 병합 노드 특별 처리 - 모든 입력 확인
            processedImage = await processMergeNode(targetNode)
            if (!processedImage) {
              console.log(`병합 노드 ${targetNode.id}는 아직 모든 입력이 준비되지 않았습니다`)
              continue
            }
          } else if (targetNode.id === 'end') {
            // 종료 노드는 처리 없이 이미지 전달
            processedImage = sourceImage
            console.log('종료 노드 도달')
          } else {
            // 일반 노드 처리
            processedImage = await processNode(targetNode, sourceImage)
          }
          
          // 처리 결과 저장
          processedImages[targetNode.id] = processedImage
          console.log(`노드 ${targetNode.id} 처리 완료, 결과 저장됨`)
          
          // 다음 처리할 엣지 큐에 추가 (종료 노드가 아닌 경우)
          if (targetNode.id !== 'end') {
            const nextEdges = elements.value.filter(
              e => e.type === 'smoothstep' && e.source === targetNode.id
            )
            
            nextEdges.forEach(nextEdge => {
              if (!processingQueue.value.some(qEdge => qEdge.id === nextEdge.id)) {
                processingQueue.value.push(nextEdge)
              }
            })
            
            console.log(`${nextEdges.length}개의 다음 엣지가 큐에 추가됨`)
          }
        }
        
        // 워크플로우 처리 완료
        console.log('워크플로우 처리 완료')
        
        // 종료 노드 이미지 확인
        const finalImage = processedImages['end']
        if (finalImage) {
          console.log('최종 처리 이미지 준비 완료')
          
          // 이벤트 발생 - 다른 컴포넌트로 이미지 전달
          const imageProcessedEvent = new CustomEvent('msa5-image-processed', {
            detail: { 
              imageUrl: finalImage,
              timestamp: new Date().toISOString()
            }
          })
          
          window.dispatchEvent(imageProcessedEvent)
          console.log('이미지 처리 완료 이벤트 발송')
          
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
        statusMessage.value = `처리 오류: ${error.message || '알 수 없는 오류'}`
        showStatusMessage.value = true
        setTimeout(() => { showStatusMessage.value = false }, 5000)
        throw error; // 에러를 다시 던져서 상위 호출자가 처리할 수 있게 함
      }
    }
    
    // 일반 노드 처리 함수
    const processNode = async (node, inputImage) => {
      try {
        console.log(`${node.data.id} 타입 노드 처리 시작`)
        
        // 실제 구현에서는 여기서 백엔드 API 호출하여 이미지 처리
        // 예시 코드이므로 입력 이미지를 그대로 반환
        
        // 처리 지연 시뮬레이션 (실제 구현에서는 제거)
        await new Promise(resolve => setTimeout(resolve, 500))
        
        console.log(`${node.data.id} 노드 처리 완료`)
        return inputImage
      } catch (error) {
        console.error(`노드 처리 오류:`, error)
        throw error
      }
    }
    
    // 병합 노드 특별 처리 함수
    const processMergeNode = async (node) => {
      try {
        // 병합 노드로 들어오는 모든 입력 연결 찾기
        const inputConnections = elements.value.filter(
          el => el.type === 'smoothstep' && 
               el.target === node.id && 
               el.targetHandle?.startsWith('input-')
        )
        
        if (inputConnections.length === 0) {
          return null // 입력 연결 없음
        }
        
        // 모든 입력 이미지 수집
        const inputImages = []
        let allInputsReady = true
        
        for (const conn of inputConnections) {
          const sourceImage = processedImages[conn.source]
          if (!sourceImage) {
            // 하나라도 준비되지 않은 입력이 있으면 처리 불가
            allInputsReady = false
            break
          }
          inputImages.push(sourceImage)
        }
        
        if (!allInputsReady) {
          return null // 아직 모든 입력이 준비되지 않음
        }
        
        console.log(`병합 노드 처리: ${inputImages.length}개 이미지 병합`)
        
        // 실제 구현에서는 여기서 백엔드 API 호출하여 이미지 병합
        // 예시 코드이므로 첫 번째 입력 이미지를 그대로 반환
        
        // 처리 지연 시뮬레이션 (실제 구현에서는 제거)
        await new Promise(resolve => setTimeout(resolve, 800))
        
        console.log('병합 처리 완료')
        return inputImages[0]
      } catch (error) {
        console.error('병합 노드 처리 오류:', error)
        throw error
      }
    }

    // 노드의 기본 파라미터 반환
    const getDefaultParams = (nodeId, defaults) => {
      const nodeDefaults = defaults[nodeId] || {}
      const params = {}
      
      // 노드 타입에 따른 기본 파라미터 설정
      switch (nodeId) {
        case 'resize':
          params.width = { label: '너비', value: nodeDefaults.width || 100, min: 1, max: 5000, step: 1 }
          params.height = { label: '높이', value: nodeDefaults.height || 100, min: 1, max: 5000, step: 1 }
          break
        case 'crop':
          params.x = { label: 'X 좌표', value: nodeDefaults.x || 0, min: 0, max: 5000, step: 1 }
          params.y = { label: 'Y 좌표', value: nodeDefaults.y || 0, min: 0, max: 5000, step: 1 }
          params.width = { label: '너비', value: nodeDefaults.width || 100, min: 1, max: 5000, step: 1 }
          params.height = { label: '높이', value: nodeDefaults.height || 100, min: 1, max: 5000, step: 1 }
          break
        case 'rotate':
          params.angle = { label: '각도', value: nodeDefaults.angle || 0, min: -360, max: 360, step: 1 }
          break
        case 'brightness':
          params.factor = { label: '밝기', value: nodeDefaults.factor || 1, min: 0, max: 3, step: 0.1 }
          break
        case 'blur':
          params.radius = { label: '반경', value: nodeDefaults.radius || 5, min: 0, max: 20, step: 1 }
          break
        case 'merge':
          params.merge_type = { 
            label: '병합 방식', 
            value: nodeDefaults.merge_type || 'horizontal',
            options: ['horizontal', 'vertical', 'grid', 'overlay']
          }
          params.spacing = { label: '간격', value: nodeDefaults.spacing || 10, min: 0, max: 100, step: 1 }
          break
        default:
          console.warn(`Node type "${nodeId}" has no default parameters defined.`)
      }
      
      return params
    }

    // 백엔드에서 사용 가능한 노드 로드
    const loadAvailableNodes = async () => {
      isNodesLoading.value = true
      try {
        // 가상의 노드 목록 설정 (실제 구현에서는 백엔드에서 로드)
        availableNodes.value = [
          { id: 'resize', label: '크기 조정', icon: 'fas fa-expand' },
          { id: 'crop', label: '이미지 자르기', icon: 'fas fa-crop' },
          { id: 'rotate', label: '회전', icon: 'fas fa-sync' },
          { id: 'brightness', label: '밝기 조정', icon: 'fas fa-sun' },
          { id: 'blur', label: '블러 효과', icon: 'fas fa-blur' },
          { id: 'merge', label: '이미지 병합', icon: 'fas fa-object-group' }
        ]
        
        defaultOptions.value = {
          resize: { width: 800, height: 600 },
          crop: { x: 0, y: 0, width: 200, height: 200 },
          rotate: { angle: 90 },
          brightness: { factor: 1.2 },
          blur: { radius: 5 },
          merge: { merge_type: 'horizontal', spacing: 10 }
        }
        
        // 초기 엘리먼트 설정
        elements.value = [
          { 
            id: 'start', 
            type: 'start', 
            position: { x: 100, y: 100 }, 
            data: { label: '시작' } 
          },
          { 
            id: 'end', 
            type: 'end', 
            position: { x: 500, y: 300 }, 
            data: { label: '종료' } 
          }
        ]
      } catch (error) {
        console.error('노드 로드 중 오류 발생:', error)
        statusMessage.value = '노드 로드 중 오류가 발생했습니다.'
        showStatusMessage.value = true
        setTimeout(() => { showStatusMessage.value = false }, 3000)
      } finally {
        isNodesLoading.value = false
      }
    }

    // 이미지 업데이트 핸들러
    const handleImageUpdate = (event) => {
      console.log('MSA1에서 이미지 업데이트 이벤트 수신:', event)
      
      let imageUrl = null
      
      if (event.detail && event.detail.imageUrl) {
        imageUrl = event.detail.imageUrl
      }
      
      if (imageUrl) {
        inputImage.value = imageUrl
        processedImages['start'] = imageUrl
        console.log('이미지 업데이트 완료')
        
        // 상태 메시지 표시
        showStatusMessage.value = true;
        statusMessage.value = 'MSA1에서 이미지 수신됨';
        
        // 몇 초 후 상태 메시지 숨김
        setTimeout(() => {
          showStatusMessage.value = false;
        }, 3000);
      }
    }

    // 노드 추가 시 히스토리 저장 추가
    const onDrop = (event) => {
      event.preventDefault()

      const bounds = event.currentTarget.getBoundingClientRect()
      const position = flowInstance.value.project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top
      })

      const nodeData = JSON.parse(event.dataTransfer.getData('application/vueflow'))

      // 현재 상태 저장
      saveToHistory()

      const newNode = {
        id: `${nodeData.id}-${Date.now()}`,
        type: nodeData.id === 'merge' ? 'merge' : 'custom',
        position,
        data: {
          id: nodeData.id,
          label: nodeData.label,
          icon: nodeData.icon,
          params: getDefaultParams(nodeData.id, defaultOptions.value)
        }
      }
      console.log("Dropped new node:", newNode)

      elements.value.push(newNode)
    }

    // 연결 시 히스토리 저장 추가
    const onConnect = (params) => {
      const { source, target, sourceHandle, targetHandle } = params
      if (isValidConnection(source, target, sourceHandle, targetHandle)) {
        // 현재 상태 저장
        saveToHistory()
        
        // 연결 생성
        elements.value.push({
          id: `e${source}-${target}${sourceHandle ? `-${sourceHandle}` : ''}${targetHandle ? `-${targetHandle}` : ''}`,
          source,
          target,
          sourceHandle,
          targetHandle,
          type: 'smoothstep'
        })
        
        // 입력/출력 연결 상태 업데이트
        updateConnections()
      }
    }

    // 유효한 연결인지 확인 (병합 노드의 경우 여러 입력 허용)
    const isValidConnection = (source, target, sourceHandle, targetHandle) => {
      if (source === target) return false
      if (source === 'end') return false
      if (target === 'start') return false
      
      // 이미 같은 연결이 있는지 확인
      const existingConnection = elements.value.find(
        el => el.type === 'smoothstep' && 
        el.source === source && 
        el.target === target &&
        el.sourceHandle === sourceHandle &&
        el.targetHandle === targetHandle
      )
      
      // 병합 노드가 아닌 경우 한 개의 입력만 허용
      const targetNode = elements.value.find(el => el.id === target)
      if (targetNode && targetNode.type !== 'merge' && target !== 'end') {
        const incomingConnections = elements.value.filter(
          el => el.type === 'smoothstep' && el.target === target
        )
        
        if (incomingConnections.length > 0) {
          console.log('이미 입력이 있는 노드:', target)
          return false
        }
      }
      
      return !existingConnection
    }

    // 컴포넌트 마운트/언마운트 시 이벤트 처리 변경
    onMounted(() => {
      // 노드 로드
      loadAvailableNodes();
      
      // MSA1에서 이미지 업데이트 이벤트 리스너 등록
      document.addEventListener('msa1-to-msa5-image', handleImageUpdate);
      
      // 컴포넌트에 포커스 - 키보드 이벤트를 받을 수 있게 함
      setTimeout(() => {
        const componentEl = document.querySelector('.msa-component');
        if (componentEl) {
          componentEl.focus();
        }
      }, 100);
    });

    onUnmounted(() => {
      // 이벤트 리스너 해제
      document.removeEventListener('msa1-to-msa5-image', handleImageUpdate);
    });

    return {
      // 상태 변수
      isMaximized,
      hasInput,
      hasOutput,
      elements,
      selectedNode,
      inputImage,
      processedImages,
      previewImageUrl,
      statusMessage,
      showStatusMessage,
      containerRef,
      availableNodes,
      isNodesLoading,
      filteredNodes,
      mergeNode,
      
      // 이벤트 핸들러
      onDragStart,
      onDragOver,
      onDrop,
      onConnect,
      onNodeDragStop,
      onNodeClick,
      toggleMaximize,
      onInit,
      onPaneReady,
      processStart,
      openImagePreview,
      closeImagePreview,
      handleKeyDown,
      
      // 실행 취소/다시 실행 함수
      undo,
      redo,
      deleteSelectedNode,
    }
  }
}
</script>

<style scoped>
.msa-component {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  transition: all 0.3s ease;
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  outline: none;
}

/* 로딩 표시기 스타일 */
.loading-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: #64748b;
  gap: 0.5rem;
}

.loading-placeholder i {
  font-size: 1.5rem;
  color: #8b5cf6;
}

.component-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  color: #1e293b;
}

.header-right {
  display: flex;
  gap: 0.5rem;
}

.process-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #8b5cf6;
  color: white;
  border: none;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-right: 0.5rem;
}

.process-btn:hover {
  background: #7c3aed;
}

.process-btn:disabled {
  background: #c4b5fd;
  cursor: not-allowed;
}

.maximize-btn {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.maximize-btn:hover {
  background: #e2e8f0;
  color: #1e293b;
}

.workflow-container {
  display: flex;
  flex: 1;
  overflow: hidden;
  height: calc(100% - 4rem); /* Account for header */
}

.node-palette {
  width: 200px;
  background: #f8fafc;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.palette-header {
  padding: 1rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  color: #1e293b;
  flex-shrink: 0;
}

.palette-content {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.palette-node {
  padding: 0.75rem;
  margin-bottom: 0.5rem;
  background: white;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: move;
  transition: all 0.2s ease;
}

.palette-node:hover {
  border-color: #8b5cf6;
  box-shadow: 0 2px 4px rgba(139, 92, 246, 0.1);
}

.workflow-area {
  flex: 1;
  position: relative;
  background: #f8fafc;
  overflow: hidden;
  height: 100%;
  cursor: default;
  min-width: 0;
  min-height: 0;
}

.workflow-area.dragging {
  cursor: move;
}

/* Basic node styles */
.workflow-node {
  background: white;
  border-radius: 8px;
  padding: 1rem;
  min-width: 180px;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  position: relative;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}

.workflow-node:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

/* Node header */
.node-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.95rem;
  font-weight: 500;
  color: #1e293b;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #f1f5f9;
}

.node-header i {
  font-size: 1.1rem;
  color: #8b5cf6;
}

/* Node image container */
.node-image {
  margin-top: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
  width: 160px;
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #4ade80;  /* 녹색 배경 */
  cursor: pointer;
  transition: all 0.2s ease;
}

.node-image:hover {
  border-color: #8b5cf6;
  box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
  transform: scale(1.02);
}

.node-image img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

/* 이미지가 있을 때의 스타일 */
.node-image:has(img) {
  background: #f8fafc;
}

/* Start node styles */
.start-node {
  width: 180px !important;
  height: auto !important;
  min-height: 120px !important;
  background: linear-gradient(135deg, #a5f3fc, #0ea5e9) !important;
  color: white !important;
  border: none !important;
  border-radius: 8px !important;
  padding: 8px !important;
  position: relative !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  z-index: 5 !important;
  overflow: visible !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05) !important;
  transition: all 0.2s ease !important;
}

.start-node.has-image {
  min-height: auto !important;
}

.start-node .node-header {
  width: 100% !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding-bottom: 0.5rem !important;
  margin-bottom: 0 !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2) !important;
}

.start-node.has-image .node-header {
  justify-content: flex-start !important;
}

.start-node .node-header i {
  color: white !important;
}

.start-node .node-image {
  width: 150px !important;
  height: 150px !important;
  margin-top: 10px !important;
  border: 1px solid rgba(255, 255, 255, 0.3) !important;
  border-radius: 6px !important;
  overflow: hidden !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  background: rgba(255, 255, 255, 0.1) !important;
  position: relative !important;
  z-index: 6 !important;
}

.start-node .node-image img {
  max-width: 100% !important;
  max-height: 100% !important;
  object-fit: contain !important;
  display: block !important;
}

/* End node styles */
.end-node {
  width: 180px !important;
  height: auto !important;
  min-height: 120px !important;
  background: linear-gradient(135deg, #fecaca, #ef4444) !important;
  color: white !important;
  border: none !important;
  border-radius: 8px !important;
  padding: 8px !important;
  position: relative !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  z-index: 5 !important;
  overflow: visible !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05) !important;
  transition: all 0.2s ease !important;
}

.end-node.has-image {
  min-height: auto !important;
}

.end-node .node-header {
  width: 100% !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding-bottom: 0.5rem !important;
  margin-bottom: 0 !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2) !important;
}

.end-node.has-image .node-header {
  justify-content: flex-start !important;
}

.end-node .node-header i {
  color: white !important;
}

.end-node .node-image {
  width: 150px !important;
  height: 150px !important;
  margin-top: 10px !important;
  border: 1px solid rgba(255, 255, 255, 0.3) !important;
  border-radius: 6px !important;
  overflow: hidden !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  background: rgba(255, 255, 255, 0.1) !important;
  position: relative !important;
  z-index: 6 !important;
}

.end-node .node-image img {
  max-width: 100% !important;
  max-height: 100% !important;
  object-fit: contain !important;
  display: block !important;
}

/* Image indicators */
.image-loaded-indicator {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 16px;
  height: 16px;
  background-color: #22c55e;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  z-index: 10;
}

.image-not-loaded {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0,0,0,0.05);
  color: #64748b;
  font-size: 12px;
}

.msa-component.maximized {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  border-radius: 0;
  z-index: 9999;
}

.msa-component.maximized .workflow-container {
  height: calc(100vh - 4rem);
}

.options-panel {
  width: 280px;
  background: white;
  border-left: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 1000;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.options-panel.fullscreen-panel {
  right: 0;
  position: fixed;
  height: 100%;
  top: 0;
  z-index: 10000;
  box-shadow: -2px 0 12px rgba(0, 0, 0, 0.1);
}

.options-panel.hidden {
  transform: translateX(100%);
}

.options-panel.visible {
  transform: translateX(0);
}

.panel-header {
  padding: 1.25rem;
  background: rgba(139, 92, 246, 0.1);
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #7c3aed;
}

.close-btn {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: #e2e8f0;
  color: #1e293b;
}

.panel-content {
  padding: 1.25rem;
  overflow-y: auto;
  flex: 1;
}

.param-item {
  margin-bottom: 1.25rem;
}

.param-item label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  font-weight: 500;
  color: #1e293b;
}

.param-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 0.9rem;
  background: #f8fafc;
  transition: all 0.2s ease;
}

.param-input:focus {
  outline: none;
  border-color: #8b5cf6;
  background: white;
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
}

select.param-input {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M6 8L2 4h8z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  padding-right: 2.5rem;
}

/* Merge node styles */
.merge-node {
  background: white;
  border-radius: 8px;
  padding: 1rem;
  min-width: 180px;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  position: relative;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.merge-node .node-header {
  background: rgba(139, 92, 246, 0.05);
  padding: 0.75rem;
  border-radius: 6px;
  margin-bottom: 0.5rem;
}

.merge-node .node-header i {
  color: #8b5cf6;
}

.merge-node .node-image {
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
}

.merge-node .node-image:hover {
  border-color: #8b5cf6;
  background: rgba(139, 92, 246, 0.05);
}

/* Node handle styles */
:deep(.vue-flow__handle) {
  width: 12px !important;
  height: 12px !important;
  border-radius: 50% !important;
  background: #8b5cf6 !important;
  border: 2px solid white !important;
  box-shadow: 0 0 0 2px #8b5cf6 !important;
  transition: transform 0.2s ease !important;
  cursor: crosshair !important;
  transform: none !important;
  position: absolute !important;
}

:deep(.vue-flow__handle:hover) {
  background: #7c3aed !important;
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.3) !important;
  transform: scale(1.1) !important;
}

:deep(.vue-flow__handle-left) {
  left: -6px !important;
}

:deep(.vue-flow__handle-right) {
  right: -6px !important;
}

/* Merge node handle positions */
.merge-node :deep(.vue-flow__handle-left) {
  left: -6px !important;
}

.merge-node :deep(.vue-flow__handle-right) {
  right: -6px !important;
}

.merge-node :deep(.vue-flow__handle-top) {
  top: -6px !important;
}

/* Selected node style */
:deep(.selected) {
  box-shadow: 0 0 0 2px #8b5cf6 !important;
  border-color: #8b5cf6 !important;
}

/* 이미지 프리뷰 팝업 스타일 */
.image-preview-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100000;
  backdrop-filter: blur(5px);
  transform: translateZ(0);
}

.image-preview-container {
  position: relative;
  width: 90vw;
  max-width: 1400px;
  max-height: 95vh;
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 35px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.preview-header h3 {
  margin: 0;
  color: #1e293b;
  font-size: 1.25rem;
  font-weight: 600;
}

.preview-content {
  padding: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  max-height: calc(95vh - 70px);
}

.preview-image {
  max-width: 100%;
  max-height: 85vh;
  object-fit: contain;
  min-width: 500px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.close-preview-btn {
  background: none;
  border: none;
  color: #64748b;
  font-size: 1.2rem;
  cursor: pointer;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.close-preview-btn:hover {
  background: #e2e8f0;
  color: #1e293b;
  transform: scale(1.05);
}

/* 상태 메시지 스타일 */
.status-message {
  position: absolute;
  top: 4rem;
  left: 50%;
  transform: translateX(-50%);
  background: #3b82f6;
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 50;
  animation: fade-in-out 3s forwards;
  max-width: 90%;
}

.status-message i {
  font-size: 1.25rem;
}

@keyframes fade-in-out {
  0% { opacity: 0; transform: translate(-50%, -10px); }
  10% { opacity: 1; transform: translate(-50%, 0); }
  80% { opacity: 1; transform: translate(-50%, 0); }
  100% { opacity: 0; transform: translate(-50%, -10px); }
}
</style> 