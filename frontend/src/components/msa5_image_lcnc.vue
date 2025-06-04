<template>
  <div class="msa-component" :class="{ maximized: isMaximized }" tabindex="0" @keydown="handleKeyDown">
    <div class="component-header">
      <div class="header-left">
        <i class="fas fa-image"></i>
        <span>이미지 전처리 LCNC</span>
      </div>
      <div class="header-right">
        <button @click="saveWorkflow" class="save-btn" :disabled="!canSaveWorkflow || !processedImages['end']" title="현재 워크플로우 저장">
          <i class="fas fa-save"></i>
          저장
        </button>
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
    <div class="status-message" :class="{ 'error': processingStatus === 'error' }" v-if="showStatusMessage">
      <i :class="processingStatus === 'error' ? 'fas fa-exclamation-circle' : 'fas fa-info-circle'"></i>
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

      <div class="workflow-area" @dragover="onDragOver" @drop="onDrop" @click="handleCanvasClick" ref="workflowArea">
        <!-- 워크플로우 오류 하이라이트 표시 -->
        <div class="workflow-error-highlight" v-if="processingStatus === 'error'"></div>

        <VueFlow v-model="elements" 
          :default-viewport="{ x: 0, y: 0, zoom: 0.7 }"
          :style="{ width: '100%', height: '100%' }"
          @connect="onConnect" @node-drag-stop="onNodeDragStop" @node-click="onNodeClick" @edge-click="onEdgeClick"
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
            <div class="preview-actions" v-if="previewImageUrl === processedImages['end']">
              <button class="action-btn similar-btn" @click="findSimilarForEndImage">
                <i class="fas fa-search"></i>
                유사 이미지 검색
              </button>
              <button class="action-btn msa6-btn" @click="handleMSA6Transfer">
                <i class="fas fa-file-export"></i>
                MSA6로 전송
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 워크플로우 이름 입력 팝업 추가 -->
    <Teleport to="body">
      <div class="save-workflow-overlay" v-if="showSaveWorkflowDialog" @click="cancelSaveWorkflow">
        <div class="save-workflow-dialog" @click.stop>
          <div class="dialog-header">
            <h3>워크플로우 저장</h3>
            <button class="close-btn" @click="cancelSaveWorkflow">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="dialog-content">
            <div class="form-group">
              <label for="workflow-name">워크플로우 이름</label>
              <input 
                type="text" 
                id="workflow-name" 
                v-model="workflowName" 
                placeholder="저장할 워크플로우 이름을 입력하세요"
                class="workflow-name-input"
                ref="workflowNameInput"
                @keyup.enter="confirmSaveWorkflow"
              >
              <small class="input-help-text">공백은 자동으로 언더스코어(_)로 변환됩니다.</small>
            </div>
            <div class="form-group">
              <label for="workflow-desc">설명 (선택사항)</label>
              <textarea 
                id="workflow-desc" 
                v-model="workflowDescription" 
                placeholder="워크플로우에 대한 설명을 입력하세요"
                class="workflow-desc-input"
              ></textarea>
            </div>
            <div class="preview-info">
              <div class="preview-item">
                <label>시작 이미지:</label>
                <div class="preview-image-container" v-if="inputImage">
                  <img :src="inputImage" alt="시작 이미지" class="mini-preview">
                </div>
                <div class="no-image" v-else>이미지 없음</div>
              </div>
              <div class="preview-item">
                <label>결과 이미지:</label>
                <div class="preview-image-container" v-if="processedImages['end']">
                  <img :src="processedImages['end']" alt="결과 이미지" class="mini-preview">
                </div>
                <div class="no-image" v-else>이미지 없음</div>
              </div>
            </div>
            
            <!-- 워크플로우 요약 정보 추가 -->
            <div class="workflow-summary">
              <label>워크플로우 요약:</label>
              <div class="workflow-nodes-container">
                <div class="workflow-node-list">
                  <div class="workflow-node start-node-mini">
                    <i class="fas fa-play"></i>
                    <span>시작</span>
                  </div>
                  
                  <div v-for="node in getNodeSummary()" :key="node.id" class="workflow-node">
                    <i :class="node.icon"></i>
                    <span>{{ node.label }}</span>
                  </div>
                  
                  <div class="workflow-node end-node-mini">
                    <i class="fas fa-stop"></i>
                    <span>종료</span>
                  </div>
                </div>
                
                <div class="workflow-stats">
                  <div class="stat-item">
                    <span class="stat-label">총 노드:</span>
                    <span class="stat-value">{{ getNodeCount() }}</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-label">총 연결:</span>
                    <span class="stat-value">{{ getConnectionCount() }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="dialog-footer">
            <button class="cancel-btn" @click="cancelSaveWorkflow">취소</button>
            <button class="save-btn" @click="confirmSaveWorkflow" :disabled="!workflowName">저장</button>
          </div>
        </div>
      </div>
    </Teleport>
    
    <!-- 중복 이름 확인 팝업 -->
    <Teleport to="body">
      <div class="duplicate-name-overlay" v-if="showDuplicateNameDialog" @click="closeDuplicateNameDialog">
        <div class="duplicate-name-dialog" @click.stop>
          <div class="dialog-header">
            <h3>중복된 이름</h3>
            <button class="close-btn" @click="closeDuplicateNameDialog">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="dialog-content">
            <div class="warning-icon">
              <i class="fas fa-exclamation-triangle"></i>
            </div>
            <p>입력하신 이름 "<strong>{{ workflowName }}</strong>"는 이미 사용 중입니다.</p>
            <p><strong>다른 이름을 사용하세요.</strong></p>
            <div class="form-group mt-3">
              <label for="new-workflow-name">새 이름:</label>
              <input 
                type="text" 
                id="new-workflow-name" 
                v-model="newWorkflowName" 
                placeholder="새로운 워크플로우 이름을 입력하세요"
                class="workflow-name-input"
                ref="newWorkflowNameInput"
                @keyup.enter="applyNewName"
              >
              <!-- 중복 이름 오류 메시지 추가 -->
              <div class="input-error-message" v-if="showDuplicateNameError">
                <i class="fas fa-exclamation-circle"></i>
                해당 이름도 중복됩니다. 다른 이름을 입력하세요.
              </div>
            </div>
          </div>
          <div class="dialog-footer">
            <button class="cancel-btn" @click="closeDuplicateNameDialog">취소</button>
            <button class="save-btn" @click="applyNewName" :disabled="!newWorkflowName">적용</button>
          </div>
        </div>
      </div>
    </Teleport>
    
    <!-- 워크플로우 오류 팝업 -->
    <Teleport to="body">
      <div class="workflow-error-overlay" v-if="showWorkflowErrorDialog" @click="closeWorkflowErrorDialog">
        <div class="workflow-error-dialog" @click.stop>
          <div class="dialog-header">
            <h3>{{ workflowErrorTitle }}</h3>
            <button class="close-btn" @click="closeWorkflowErrorDialog">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="dialog-content">
            <div class="error-icon">
              <i class="fas fa-exclamation-circle"></i>
            </div>
            <div class="error-message">
              <p class="error-main-message">{{ workflowErrorMessage }}</p>
              <div class="error-details">
                {{ workflowErrorDetails }}
              </div>
            </div>
            <div class="error-tips">
              <h4>해결 방법</h4>
              <ul>
                <li>시작 노드와 종료 노드가 올바르게 연결되어 있는지 확인하세요.</li>
                <li>워크플로우 내 모든 노드가 적절히 연결되어 있는지 확인하세요.</li>
                <li>끊어진 연결이 없는지 확인하세요.</li>
              </ul>
            </div>
          </div>
          <div class="dialog-footer">
            <button class="ok-btn" @click="closeWorkflowErrorDialog">확인</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, reactive, computed, nextTick } from 'vue'
import { VueFlow, Handle } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/core/dist/style.css'
import LogService from '../utils/logService'
import { mapValues } from 'lodash'

export default {
  name: 'MSA5ImageLCNC',
  components: {
    VueFlow,
    Background,
    Controls,
    Handle,
    MiniMap
  },
  props: {
    initialImage: {
      type: String,
      default: null
    }
  },
  setup(props) {
    const isMaximized = ref(false)
    const hasInput = ref(false)
    const hasOutput = ref(false)
    const elements = ref([])
    const selectedNode = ref(null)
    const selectedEdge = ref(null) // 선택된 엣지(연결선) 저장용
    const inputImage = ref('')
    const processedImages = reactive({})
    const processingStatus = ref('idle')
    const previewImageUrl = ref(null)
    const showStatusMessage = ref(false)
    const statusMessage = ref('')
    const statusType = ref('info')
    const availableNodes = ref([])
    const isNodesLoading = ref(true)
    const flowInstance = ref(null)
    const defaultOptions = ref({})
    const processingQueue = ref([])
    const containerRef = ref(null)
    const currentImageTitle = ref('')
    const canSaveWorkflow = ref(false)
    const savedWorkflows = ref({})
    const showSaveWorkflowDialog = ref(false)
    const workflowName = ref('')
    const workflowDescription = ref('')
    const workflowNameInput = ref(null)
    const showDuplicateNameDialog = ref(false)
    const newWorkflowName = ref('')
    const newWorkflowNameInput = ref(null)
    const showDuplicateNameError = ref(false)
    const workflowErrorTitle = ref('')
    const workflowErrorMessage = ref('')
    const workflowErrorDetails = ref('')
    const showWorkflowErrorDialog = ref(false)
    const workflowArea = ref(null)  // 워크플로우 영역 DOM 참조 추가
    
    // 이미지 해시 계산 함수
    const calculateImageHash = async (imageUrl) => {
      try {
        // Base64 대신 URL 자체를 사용
        if (!imageUrl) {
          console.error('이미지 URL이 없습니다.');
          return 'no-image-hash';
        }
        
        // URL에서 파일명만 추출하여 사용
        const filename = imageUrl.split('/').pop();
        if (!filename) {
          return `url-hash-${Date.now()}`;
        }
        
        // 파일명 자체를 해시로 사용하거나 간단한 해시 생성
        return `image-${filename}`;
      } catch (error) {
        console.error('해시 계산 중 오류 발생:', error);
        return `error-hash-${Date.now()}`;
      }
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
    
    // 선택한 엣지(연결선) 삭제
    const deleteSelectedEdge = () => {
      if (!selectedEdge.value) return
      
      // 해당 엣지의 ID
      const edgeId = selectedEdge.value.id
      
      console.log('엣지 삭제 시작:', edgeId)
      
      // 변경 전 상태 저장
      saveToHistory()
      
      // 엣지 삭제
      elements.value = elements.value.filter(el => el.id !== edgeId)
      
      // 선택 해제
      selectedEdge.value = null
      
      // 입력/출력 연결 상태 업데이트
      updateConnections()
      
      console.log('엣지 삭제 완료')
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
        return;
      }
      
      // Delete 키로 선택된 엣지 삭제
      if (event.key === 'Delete' && selectedEdge.value) {
        console.log('Delete 키 감지 - 엣지 삭제 실행');
        deleteSelectedEdge();
        return;
      }
      
      // Ctrl+Z: 실행 취소
      if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
        console.log('Ctrl+Z 감지 - 실행 취소 실행');
        undo();
        event.preventDefault();
        return;
      }
      
      // Ctrl+Y: 다시 실행
      if ((event.ctrlKey || event.metaKey) && event.key === 'y') {
        console.log('Ctrl+Y 감지 - 다시 실행 실행');
        redo();
        event.preventDefault();
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
    
    // 드롭 이벤트 핸들러
    const onDrop = (event) => {
      event.preventDefault()
      
      try {
        // 드래그 데이터 가져오기
        const nodeData = JSON.parse(event.dataTransfer.getData('application/vueflow'))
        
        if (!nodeData) {
          console.warn('드롭된 데이터가 없습니다')
          return
        }
        
        // 드롭 위치 계산 (workflowArea 참조가 없을 경우 기본 위치 사용)
        let position = { x: 100, y: 100 };
        
        if (workflowArea.value && flowInstance.value) {
          const reactFlowBounds = workflowArea.value.getBoundingClientRect()
          position = flowInstance.value.project({
            x: event.clientX - reactFlowBounds.left,
            y: event.clientY - reactFlowBounds.top
          })
        }
        
        // 노드 ID 생성 (타입 + 타임스탬프)
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
        
        // 새 노드 생성 후 약간의 딜레이 후 선택 (UI 렌더링 보장)
        setTimeout(() => {
          const addedNode = elements.value.find(el => el.id === id)
          if (addedNode) {
            selectedNode.value = addedNode
          }
        }, 100)
      } catch (error) {
        console.error('노드 드롭 처리 중 오류:', error)
      }
    }
    
    // 노드 타입별 기본 파라미터 가져오기
    const getDefaultParams = (nodeType, defaultOpts) => {
      // 기본값이 없는 경우 빈 객체 반환
      if (!defaultOpts || !nodeType) {
        return {}
      }
      
      // nodeType에 해당하는 기본 파라미터 반환
      const params = defaultOpts[nodeType] || {}
      
      // 파라미터 타입별로 UI 구성을 위한 메타데이터 추가
      const result = {}
      
      // 파라미터 형식 변환 및 메타데이터 추가
      Object.entries(params).forEach(([key, value]) => {
        let paramConfig = {
          value: value,
          label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
          min: 0,
          max: 1000,
          step: 1
        }
        
        // 파라미터 타입에 따른 특수 설정
        if (key.includes('factor')) {
          paramConfig.min = 0
          paramConfig.max = 2
          paramConfig.step = 0.1
        } else if (key.includes('angle')) {
          paramConfig.min = -360
          paramConfig.max = 360
          paramConfig.step = 1
        } else if (key.includes('threshold')) {
          paramConfig.min = 0
          paramConfig.max = 255
          paramConfig.step = 1
        } else if (key.includes('radius')) {
          paramConfig.min = 0
          paramConfig.max = 50
          paramConfig.step = 1
        } else if (key.includes('direction') || key.includes('method') || key.includes('model')) {
          // 옵션형 파라미터는 select 요소로 표시
          paramConfig.options = Array.isArray(value) ? value : 
            key === 'direction' ? ['horizontal', 'vertical'] :
            key === 'method' ? ['canny', 'sobel', 'laplacian'] :
            key === 'model' ? ['yolov5', 'yolov8', 'faster_rcnn'] : 
            [value]
        }
        
        result[key] = paramConfig
      })
      
      return result
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
      
      // 엣지 선택 해제
      selectedEdge.value = null;
      
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
    
    // 엣지(연결선) 클릭 이벤트 핸들러
    const onEdgeClick = (event) => {
      const { edge } = event;
      console.log('엣지 클릭:', edge.id, '마우스 위치:', {
        clientX: event.event?.clientX,
        clientY: event.event?.clientY
      });
      
      // 노드 선택 해제
      selectedNode.value = null;
      
      // 엣지 선택
      selectedEdge.value = edge;
      console.log('Edge selected:', selectedEdge.value);
      
      // 선택된 엣지에 시각적 표시를 위해 클래스 적용
      // Vue Flow에서는 이벤트를 통해 자동으로 처리되므로 추가 작업 필요 없음
    }

    // 워크플로우 처리 시작
    const processStart = async () => {
      if (!inputImage.value) {
        showStatusMessage.value = true
        statusMessage.value = '이미지가 없습니다. 먼저 이미지를 로드해주세요.'
        setTimeout(() => { showStatusMessage.value = false }, 5000)
        return
      }
      
      // 액션 로깅 데이터 준비
      const logData = {
        component: 'MSA5',
        hasImage: !!inputImage.value,
        nodeCount: elements.value.filter(el => el.type !== 'smoothstep').length - 2,
        connectionCount: elements.value.filter(el => el.type === 'smoothstep').length
      };
      
      try {
        // 액션 로깅 - 프로세스 시작 (한 번만 호출되도록 개선됨)
        LogService.logAction('process_start', logData)
          .catch(err => console.error('로그 저장 실패:', err));
      } catch (err) {
        // 로깅 실패는 무시하고 계속 진행
        console.error('로그 저장 오류:', err);
      }
      
      // 시작 전에 워크플로우 검증 수행
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
        // 워크플로우 처리
        await processWorkflow()
        
        // 처리 완료 후 저장 버튼 활성화
        canSaveWorkflow.value = true
        
        // MongoDB에 자동 저장하는 코드 제거 - 저장은 사용자가 '저장' 버튼을 클릭할 때만 수행
      } catch (error) {
        console.error('워크플로우 처리 중 오류 발생:', error)
        processingStatus.value = 'error'
        statusMessage.value = `처리 오류: ${error.message || '알 수 없는 오류'}`
        showStatusMessage.value = true
        setTimeout(() => { showStatusMessage.value = false }, 5000)
      }
    }
    
    // 워크플로우 유효성 검증 함수
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
      
      // 5. 연결 경로 확인 (시작 -> 종료)
      const graph = {}
      elements.value.filter(el => el.type !== 'smoothstep').forEach(node => {
        graph[node.id] = []
      })
      
      connections.forEach(conn => {
        if (!graph[conn.source]) graph[conn.source] = []
        graph[conn.source].push(conn.target)
      })
      
      // BFS로 시작 노드에서 종료 노드까지 경로 확인
      const queue = ['start']
      const visited = new Set(['start'])
      
      while (queue.length > 0) {
        const current = queue.shift()
        
        if (current === 'end') {
          // 종료 노드에 도달 가능
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
      
      // 종료 노드에 도달하지 못함
      return {
        valid: false,
        message: '시작부터 종료까지의 경로가 없습니다.',
        details: '시작 노드에서 종료 노드까지 연결된 경로를 만들어주세요. 모든 노드가 올바르게 연결되어 있는지 확인하세요.'
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
    
    // 일반 노드 처리 함수
    const processNode = async (node, inputImage) => {
      try {
        console.log(`[processNode] 노드 ${node.id} 처리 시작, 타입: ${node.data?.nodeId || node.data?.id}`);
        
        // 노드에 파라미터가 없으면 기본값 설정
        if (!node.data?.params) {
          console.warn(`[processNode] 노드 ${node.id}에 파라미터가 없습니다. 기본값 사용`);
          node.data.params = getDefaultParams(node.data?.nodeId || node.data?.id, defaultOptions.value);
        }
        
        // 노드 타입 및 파라미터 추출
        const nodeType = node.data?.nodeId || node.data?.id;
        const params = {};
        
        // 파라미터 객체 구성
        if (node.data?.params) {
          Object.entries(node.data.params).forEach(([key, param]) => {
            params[key] = param.value;
          });
        }
        
        console.log(`[processNode] API 요청 준비: ${node.id}, 타입: ${nodeType}`, params);
        
        // 입력 이미지 URL에서 이미지 형식 추출 (가능한 경우)
        let imageFormat = null;
        if (inputImage) {
          // URL에서 파일 확장자 추출 시도
          try {
            const fileExtMatch = inputImage.match(/\.([^.?]+)(?:\?|$)/);
            if (fileExtMatch && fileExtMatch[1]) {
              imageFormat = fileExtMatch[1].toLowerCase();
              console.log(`[processNode] 입력 이미지 형식 감지: ${imageFormat}`);
            }
          } catch (e) {
            console.warn(`[processNode] 이미지 형식 감지 실패:`, e);
          }
        }
        
        // FormData 생성
        const formData = new FormData();
        
        // 이미지 데이터를 Blob으로 변환
        const response = await fetch(inputImage);
        
        // 응답 헤더에서 Content-Type 확인
        const contentType = response.headers.get('Content-Type');
        if (contentType && contentType.startsWith('image/') && !imageFormat) {
          // Content-Type에서 형식 추출 (image/jpeg -> jpeg)
          const formatFromHeader = contentType.split('/')[1];
          if (formatFromHeader) {
            imageFormat = formatFromHeader.toLowerCase();
            console.log(`[processNode] Content-Type에서 이미지 형식 감지: ${imageFormat}`);
          }
        }
        
        const blob = await response.blob();
        
        // Blob 타입에서 형식 확인 (우선순위 높음)
        if (blob.type && blob.type.startsWith('image/') && (!imageFormat || blob.type !== `image/${imageFormat}`)) {
          const formatFromBlob = blob.type.split('/')[1];
          if (formatFromBlob) {
            imageFormat = formatFromBlob.toLowerCase();
            console.log(`[processNode] Blob 타입에서 이미지 형식 감지: ${imageFormat}`);
          }
        }
        
        // 적절한 파일 이름 구성 (형식 포함)
        const fileName = imageFormat ? `image.${imageFormat}` : 'image.png';
        
        // FormData에 이미지와 파라미터 추가
        formData.append('image', blob, fileName);
        formData.append('params', JSON.stringify(params));
        
        // 명시적으로 형식 파라미터 추가 (필요한 경우)
        // 이미지 변환 노드에서 원본 형식 보존을 위해 유용
        if (imageFormat) {
          formData.append('format', imageFormat);
          console.log(`[processNode] 원본 이미지 형식 파라미터 추가: ${imageFormat}`);
        }
        
        // 백엔드 API 호출 - 노드 타입에 맞는 엔드포인트 사용
        const apiUrl = `http://localhost:8000/api/msa5/work/${nodeType}`;
        
        console.log(`[processNode] 요청 URL: ${apiUrl}, 파일명: ${fileName}`);
        
        const apiResponse = await fetch(apiUrl, {
          method: 'POST',
          body: formData
        });
        
        if (!apiResponse.ok) {
          const errorText = await apiResponse.text();
          throw new Error(`API 응답 오류 (${apiResponse.status}): ${errorText}`);
        }
        
        // 헤더에서 이미지 형식 확인 (X-Image-Format 헤더 확인)
        let outputFormat = 'png'; // 기본값
        const formatHeader = apiResponse.headers.get('X-Image-Format');
        if (formatHeader) {
          outputFormat = formatHeader.toLowerCase();
          if (outputFormat === 'jpeg') outputFormat = 'jpg';
          console.log(`[processNode] 응답 헤더에서 이미지 형식 감지: ${outputFormat} (X-Image-Format)`);
        }
        
        // 응답 헤더에서 Content-Type 확인
        const responseContentType = apiResponse.headers.get('Content-Type');
        if (responseContentType && !formatHeader) {
          if (responseContentType.includes('image/jpeg')) {
            outputFormat = 'jpg';
          } else if (responseContentType.includes('image/png')) {
            outputFormat = 'png';
          } else if (responseContentType.includes('image/gif')) {
            outputFormat = 'gif';
          } else if (responseContentType.includes('image/webp')) {
            outputFormat = 'webp';
          } else if (responseContentType.includes('image/bmp')) {
            outputFormat = 'bmp';
          } else if (responseContentType.includes('image/tiff')) {
            outputFormat = 'tiff';
          }
          console.log(`[processNode] 응답 Content-Type: ${responseContentType}, 감지된 출력 형식: ${outputFormat}`);
        }
        
        // 응답에서 이미지 데이터 추출
        const imageBlob = await apiResponse.blob();
        
        // Blob 타입을 확인하여 출력 형식 재확인
        if (imageBlob.type && imageBlob.type.startsWith('image/')) {
          const blobFormat = imageBlob.type.split('/')[1];
          if (blobFormat) {
            outputFormat = blobFormat.toLowerCase();
            if (outputFormat === 'jpeg') outputFormat = 'jpg';
            console.log(`[processNode] Blob에서 재확인된 출력 형식: ${outputFormat}`);
          }
        }
        
        // 적절한 확장자 포함하여 URL 생성
        const processedImageUrl = URL.createObjectURL(imageBlob);
        
        // 파일명 생성 (타임스탬프 + 형식)
        const timestamp = Date.now();
        const outputFilename = `processed_${timestamp}.${outputFormat}`;
        
        // 이미지 형식 정보를 세션 스토리지에 저장 (임시, 노드별로)
        sessionStorage.setItem(`msa5_node_${node.id}_format`, outputFormat);
        
        console.log(`[processNode] 노드 ${node.id} 처리 완료, 출력 형식: ${outputFormat}, 파일명: ${outputFilename}`);
        return processedImageUrl;
      } catch (error) {
        console.error(`[processNode] 노드 ${node.id} 처리 중 오류:`, error);
        throw error;
      }
    }
    
    // 병합 노드 처리 함수
    const processMergeNode = async (node) => {
      try {
        console.log(`[processMergeNode] 병합 노드 ${node.id} 처리 시작`);
        
        // 병합 노드로 들어오는 모든 엣지 찾기
        const inputEdges = elements.value.filter(
          el => el.type === 'smoothstep' && el.target === node.id
        );
        
        // 각 입력에 대한 이미지 데이터 수집
        const imagePromises = [];
        
        // 주요 이미지 형식 추적 (첫 번째 이미지를 기본으로 사용)
        let primaryImageFormat = null;
        
        for (const edge of inputEdges) {
          const sourceNodeId = edge.source;
          const sourceImage = processedImages[sourceNodeId];
          
          if (sourceImage) {
            // 노드별 형식 정보 확인
            const nodeFormat = sessionStorage.getItem(`msa5_node_${sourceNodeId}_format`);
            if (nodeFormat && !primaryImageFormat) {
              primaryImageFormat = nodeFormat;
              console.log(`[processMergeNode] 노드 스토리지에서 형식 감지: ${primaryImageFormat}`);
            }
            
            // 이미지 URL에서 형식 추출 시도
            if (!primaryImageFormat) {
            try {
              const fileExtMatch = sourceImage.match(/\.([^.?]+)(?:\?|$)/);
              if (fileExtMatch && fileExtMatch[1]) {
                // 첫 번째 이미지 형식을 추적
                if (primaryImageFormat === null) {
                  primaryImageFormat = fileExtMatch[1].toLowerCase();
                  console.log(`[processMergeNode] 주요 이미지 형식 설정: ${primaryImageFormat}`);
                }
              }
            } catch (e) {
              console.warn(`[processMergeNode] 이미지 형식 추출 실패:`, e);
              }
            }
            
            // 이미지 데이터를 Blob으로 변환
            const response = await fetch(sourceImage);
            
            // 응답 헤더에서 Content-Type 확인
            const contentType = response.headers.get('Content-Type');
            if (contentType && contentType.startsWith('image/') && !primaryImageFormat) {
              const formatFromHeader = contentType.split('/')[1];
              if (formatFromHeader) {
                primaryImageFormat = formatFromHeader.toLowerCase();
                console.log(`[processMergeNode] Content-Type에서 형식 감지: ${primaryImageFormat}`);
              }
            }
            
            const blob = await response.blob();
            
            // Blob 타입에서 형식 확인 (더 정확함)
            if (blob.type && blob.type.startsWith('image/')) {
              const formatFromBlob = blob.type.split('/')[1];
              // 주요 형식이 없으면 첫 번째 이미지의 형식을 사용
              if (formatFromBlob && primaryImageFormat === null) {
                primaryImageFormat = formatFromBlob.toLowerCase();
                console.log(`[processMergeNode] Blob 타입에서 주요 이미지 형식 설정: ${primaryImageFormat}`);
              }
            }
            
            imagePromises.push({ sourceNodeId, blob });
          }
        }
        
        if (imagePromises.length < 2) {
          console.error(`[processMergeNode] 병합 노드 ${node.id}에 충분한 입력 이미지가 없습니다.`);
          throw new Error("병합에는 최소 2개의 이미지가 필요합니다.");
        }
        
        // 파라미터 추출
        const params = {};
        if (node.data?.params) {
          Object.entries(node.data.params).forEach(([key, param]) => {
            params[key] = param.value;
          });
        }
        
        // FormData 생성
        const formData = new FormData();
        
        // 각 이미지를 FormData에 추가
        for (let i = 0; i < imagePromises.length; i++) {
          const { sourceNodeId, blob } = imagePromises[i];
          
          // 이미지 형식을 포함한 파일 이름 사용
          const imageFormat = blob.type && blob.type.startsWith('image/') 
            ? blob.type.split('/')[1] 
            : (primaryImageFormat || 'png');
          
          formData.append('images', blob, `image_${i}.${imageFormat}`);
        }
        
        // 파라미터 추가
        formData.append('params', JSON.stringify(params));
        
        // 원본 형식 전달 - 명시적으로 format 파라미터 추가
        if (primaryImageFormat) {
          formData.append('format', primaryImageFormat);
          console.log(`[processMergeNode] 원본 이미지 형식 파라미터 추가: ${primaryImageFormat}`);
        }
        
        console.log(`[processMergeNode] 병합 API 요청 준비, 출력 형식: ${primaryImageFormat || 'png'}`);
        
        // 백엔드 API 호출
        const apiUrl = `http://localhost:8000/api/msa5/work/merge`;
        const apiResponse = await fetch(apiUrl, {
          method: 'POST',
          body: formData
        });
        
        if (!apiResponse.ok) {
          const errorText = await apiResponse.text();
          throw new Error(`병합 API 응답 오류 (${apiResponse.status}): ${errorText}`);
        }
        
        // 헤더에서 이미지 형식 확인 (X-Image-Format 헤더 확인)
        let outputFormat = primaryImageFormat || 'png'; // 기본적으로 입력 형식 유지
        const formatHeader = apiResponse.headers.get('X-Image-Format');
        if (formatHeader) {
          outputFormat = formatHeader.toLowerCase();
          if (outputFormat === 'jpeg') outputFormat = 'jpg';
          console.log(`[processMergeNode] 응답 헤더에서 이미지 형식 감지: ${outputFormat} (X-Image-Format)`);
        }
        
        // 응답 헤더에서 Content-Type 확인
        const responseContentType = apiResponse.headers.get('Content-Type');
        if (responseContentType && !formatHeader) {
          if (responseContentType.includes('image/jpeg')) {
            outputFormat = 'jpg';
          } else if (responseContentType.includes('image/png')) {
            outputFormat = 'png';
          } else if (responseContentType.includes('image/gif')) {
            outputFormat = 'gif';
          } else if (responseContentType.includes('image/webp')) {
            outputFormat = 'webp';
          } else if (responseContentType.includes('image/bmp')) {
            outputFormat = 'bmp';
          } else if (responseContentType.includes('image/tiff')) {
            outputFormat = 'tiff';
          }
          console.log(`[processMergeNode] 응답 Content-Type: ${responseContentType}, 감지된 출력 형식: ${outputFormat}`);
        }
        
        // 응답에서 이미지 데이터 추출
        const imageBlob = await apiResponse.blob();
        
        // Blob 타입 확인
        if (imageBlob.type && imageBlob.type.startsWith('image/')) {
          const blobFormat = imageBlob.type.split('/')[1];
          if (blobFormat) {
            outputFormat = blobFormat.toLowerCase();
            if (outputFormat === 'jpeg') outputFormat = 'jpg';
            console.log(`[processMergeNode] Blob에서 재확인된 출력 형식: ${outputFormat}`);
          }
        }
        
        const processedImageUrl = URL.createObjectURL(imageBlob);
        
        // 형식 정보를 세션 스토리지에 저장
        sessionStorage.setItem(`msa5_node_${node.id}_format`, outputFormat);
        
        console.log(`[processMergeNode] 병합 노드 ${node.id} 처리 완료, 출력 형식: ${outputFormat}`);
        return processedImageUrl;
      } catch (error) {
        console.error(`[processMergeNode] 병합 노드 ${node.id} 처리 중 오류:`, error);
        throw error;
      }
    }
    
    // 워크플로우 실제 처리 함수
    const processWorkflow = async () => {
      try {
        console.log('[processWorkflow] 워크플로우 처리 시작 ====================================');
        console.log('[processWorkflow] 네트워크 상태 확인:', navigator.onLine ? '온라인' : '오프라인');
        console.log('[processWorkflow] 백엔드 API 기본 URL: http://localhost:8000/api/msa5/work');
        
        // 처리 큐 초기화
        const queue = []
        const visited = new Set(['start']) // 시작 노드 방문 표시
        
        // 입력 이미지 처리
        processedImages['start'] = inputImage.value
        
        // 세션 스토리지에 시작 이미지 URL 저장
        sessionStorage.setItem('msa5_start_image_url', inputImage.value);
        console.log('MSA5: 세션 스토리지에 시작 이미지 URL 저장:', inputImage.value.substring(0, 30) + '...');
        
        // 연결 관계 확인 - 간선 처리 준비
        const graph = {}
        elements.value.filter(el => el.type !== 'smoothstep').forEach(node => {
          graph[node.id] = []
        })
        
        elements.value.filter(el => el.type === 'smoothstep').forEach(conn => {
          if (!graph[conn.source]) graph[conn.source] = []
          graph[conn.source].push(conn.target)
        })
        
        console.log('[processWorkflow] 노드 그래프 구성:', graph);
        
        // BFS 큐 초기화 - 시작 노드의 모든 연결 추가
        for (const nodeId of graph['start']) {
          queue.push(nodeId)
        }
        
        // BFS 처리 - 레벨별로 모든 노드 처리
        while (queue.length > 0) {
          const batchSize = queue.length // 현재 레벨의 노드 수
          const currentBatch = queue.splice(0, batchSize) // 현재 레벨의 노드 추출
          
          console.log(`[processWorkflow] 현재 처리 배치 (${currentBatch.length}개 노드):`, currentBatch);
          
          // 현재 레벨의 노드 모두 병렬 처리
          const processingPromises = []
          
          for (const nodeId of currentBatch) {
            if (visited.has(nodeId)) continue // 이미 방문한 노드 건너뛰기
            
            const node = elements.value.find(el => el.id === nodeId)
            if (!node) {
              console.error(`[processWorkflow] 노드 ID ${nodeId}에 해당하는 노드가 없습니다.`);
              continue
            }
            
            console.log(`[processWorkflow] 노드 처리 시작: ${nodeId}, 타입: ${node.data?.nodeId || node.data?.id}`);
            
            // 입력 이미지 찾기 - 노드로 들어오는 엣지의 소스 노드의 이미지
            const inputEdges = elements.value.filter(
              el => el.type === 'smoothstep' && el.target === nodeId
            )
            
            if (inputEdges.length === 0) {
              console.error(`[processWorkflow] 노드 ${nodeId}에 입력 연결이 없습니다.`);
              continue
            }
            
            const sourceNodeId = inputEdges[0].source
            const inputImage = processedImages[sourceNodeId]
            
            if (!inputImage) {
              console.error(`[processWorkflow] 소스 노드 ${sourceNodeId}의 이미지가 없습니다.`);
              continue
            }
            
            // 실제 노드 타입에 따른 처리
            let processingPromise;
            
            if (nodeId === 'end') {
              // 종료 노드는 그대로 입력 이미지 전달
              processingPromise = Promise.resolve(inputImage);
              console.log(`[processWorkflow] 종료 노드 처리 - 이미지 전달`);
            } else if (node.data?.nodeId === 'merge' || node.data?.id === 'merge') {
              // 병합 노드 처리
              console.log(`[processWorkflow] 병합 노드 처리 시작: ${nodeId}`);
              processingPromise = processMergeNode(node);
            } else {
              // 일반 노드 처리
              console.log(`[processWorkflow] 일반 노드 처리 시작: ${nodeId}, 타입: ${node.data?.nodeId || node.data?.id}`);
              processingPromise = processNode(node, inputImage);
            }
            
            // 노드 처리 결과를 저장
            processingPromises.push(
              processingPromise.then(processedImage => {
                if (processedImage) {
                  processedImages[nodeId] = processedImage;
                  visited.add(nodeId);
                  console.log(`[processWorkflow] 노드 ${nodeId} 처리 완료, 결과 이미지 저장됨`);
                  
                  // 다음 노드 큐에 추가
                  for (const nextNodeId of graph[nodeId] || []) {
                    if (!visited.has(nextNodeId)) {
                      queue.push(nextNodeId);
                    }
                  }
                } else {
                  console.warn(`[processWorkflow] 노드 ${nodeId} 처리 결과가 없습니다.`);
                }
                return nodeId;
              }).catch(error => {
                console.error(`[processWorkflow] 노드 ${nodeId} 처리 중 오류 발생:`, error);
                return null;
              })
            );
          }
          
          // 현재 레벨의 모든 노드 처리 대기
          console.log(`[processWorkflow] 현재 배치의 ${processingPromises.length}개 노드 처리 대기 중...`);
          const results = await Promise.all(processingPromises);
          console.log(`[processWorkflow] 배치 처리 완료, 결과:`, results.filter(Boolean));
        }
        
        console.log('[processWorkflow] 모든 노드 처리 완료');
        console.log('[processWorkflow] 처리된 이미지:', Object.keys(processedImages));
        
        // 최종 결과 처리 - 측정 결과가 있을 경우 MSA6으로 전달
        if (processedImages['end']) {
          console.log('[processWorkflow] 종료 노드의 이미지 데이터가 있습니다. 결과 처리 준비');
          console.log('[processWorkflow] 최종 이미지 URL:', processedImages['end'].substring(0, 30) + '...');
          
          // 세션 스토리지에 시작 및 종료 이미지 URL 저장
          sessionStorage.setItem('msa5_start_image_url', processedImages['start']);
          sessionStorage.setItem('msa5_end_image_url', processedImages['end']);
          console.log('[processWorkflow] 세션 스토리지에 이미지 URL 저장 완료 - 시작/종료 이미지');
          
          // 이미지 형식 감지 - 여러 소스에서 시도
          let imageFormat = 'png'; // 기본값
          
          // 1. 마지막 처리 노드의 형식 정보 가져오기 (가장 정확함)
          const endNodeInputEdges = elements.value.filter(
            el => el.type === 'smoothstep' && el.target === 'end'
          );
          
          if (endNodeInputEdges.length > 0) {
            const sourceNodeId = endNodeInputEdges[0].source;
            const nodeFormat = sessionStorage.getItem(`msa5_node_${sourceNodeId}_format`);
            
            if (nodeFormat) {
              imageFormat = nodeFormat;
              console.log(`[processWorkflow] 소스 노드(${sourceNodeId})의 형식 정보 사용: ${imageFormat}`);
            }
          }
          
          // 2. 이미지가 데이터 URL 형식인 경우 형식 추출
          if (processedImages['end'].startsWith('data:image/')) {
            const formatMatch = processedImages['end'].match(/data:image\/([a-z0-9]+);base64,/i);
            if (formatMatch && formatMatch[1]) {
              imageFormat = formatMatch[1].toLowerCase();
              if (imageFormat === 'jpeg') imageFormat = 'jpg';
              console.log(`[processWorkflow] 데이터 URL에서 이미지 형식 감지: ${imageFormat}`);
            }
          }
          
          // 3. Blob에서 직접 확인 (가장 정확한 방법)
          try {
            const response = await fetch(processedImages['end']);
            
            // 응답 헤더에서 Content-Type 확인
            const contentType = response.headers.get('Content-Type');
            if (contentType && contentType.startsWith('image/')) {
              const formatFromHeader = contentType.split('/')[1].toLowerCase();
              if (formatFromHeader) {
                imageFormat = formatFromHeader;
                if (imageFormat === 'jpeg') imageFormat = 'jpg';
                console.log(`[processWorkflow] Content-Type에서 이미지 형식 감지: ${imageFormat}`);
              }
            }
            
            // Blob에서 형식 확인
            const blob = await response.blob();
            if (blob.type && blob.type.startsWith('image/')) {
              const formatFromBlob = blob.type.split('/')[1].toLowerCase();
              if (formatFromBlob) {
                imageFormat = formatFromBlob;
                if (imageFormat === 'jpeg') imageFormat = 'jpg';
                console.log(`[processWorkflow] Blob에서 이미지 형식 감지: ${imageFormat}`);
              }
            }
          } catch (e) {
            console.warn('[processWorkflow] Blob 형식 감지 중 오류:', e);
          }
          
          // 이미지 형식을 세션 스토리지에 저장
          sessionStorage.setItem('msa5_end_image_format', imageFormat);
          console.log(`[processWorkflow] 이미지 형식 정보 저장: ${imageFormat}`);
          
          // MSA6로 이미지 전송 (여러 번 시도)
          console.log('[processWorkflow] MSA6로 이미지 전송 시작...');
          
          // 먼저 MSA5 처리 상태 설정 (MSA6가 이 값을 확인함)
          sessionStorage.setItem('msa5_end_image', 'true');
          
          // 약간의 지연 후 첫 번째 시도 (렌더링 시간 고려)
          setTimeout(() => {
            let msa6SendSuccess = false;
            
            // 첫 번째 시도
            msa6SendSuccess = sendImageToMSA6(processedImages['end'], imageFormat);
            
            // 첫 번째 시도가 실패하면 잠시 후 다시 시도
            if (!msa6SendSuccess) {
              console.log('[processWorkflow] MSA6 전송 첫 번째 시도 실패. 500ms 후 재시도...');
              setTimeout(() => {
                msa6SendSuccess = sendImageToMSA6(processedImages['end'], imageFormat);
                
                if (!msa6SendSuccess) {
                  console.log('[processWorkflow] MSA6 전송 두 번째 시도 실패. 1000ms 후 마지막 시도...');
                  setTimeout(() => {
                    sendImageToMSA6(processedImages['end'], imageFormat);
                  }, 1000);
                }
              }, 500);
            }
          }, 300);
          
          hasOutput.value = true;
          statusMessage.value = '이미지 처리가 완료되었습니다!';
        } else {
          console.warn('최종 이미지가 없습니다');
          statusMessage.value = '이미지 처리 중 오류가 발생했습니다';
          hasOutput.value = false;
        }
        
        processingStatus.value = 'completed';
        showStatusMessage.value = true;
        setTimeout(() => { showStatusMessage.value = false }, 3000);
      } catch (error) {
        console.error('워크플로우 처리 중 오류 발생:', error);
        processingStatus.value = 'error'
        statusMessage.value = `처리 오류: ${error.message || '알 수 없는 오류'}`
        showStatusMessage.value = true
        setTimeout(() => { showStatusMessage.value = false }, 5000)
      }
    }

    // 이미지 설정 함수 (MSA4에서 이미지를 받아올 때 호출)
    const setImage = async (imageUrl, imageTitle) => {
      inputImage.value = imageUrl
      // 이미지 제목이 없으면 기본값 사용, 있으면 공백을 언더스코어로 변환
      currentImageTitle.value = imageTitle ? imageTitle.replace(/ /g, '_') : ''
      
      // 이미지 해시 계산하여 저장된 워크플로우 확인
      if (imageUrl) {
        try {
          const imageHash = await calculateImageHash(imageUrl)
          canSaveWorkflow.value = true
          
          // 해당 이미지에 대해 저장된 워크플로우가 이미 저장되어 있는지 확인
          checkSavedWorkflow(imageHash)
        } catch (error) {
          console.error('이미지 해시 계산 중 오류:', error)
        }
      }
    }
    
    // 저장된 워크플로우 확인
    const checkSavedWorkflow = async (imageHash) => {
      try {
        // 백엔드 API를 통해 해당 이미지 해시로 저장된 워크플로우 조회
        const response = await fetch(`http://localhost:8000/api/lcnc/get-workflow-by-hash/${imageHash}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          },
          mode: 'cors',
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'success' && data.data) {
            // 저장된 워크플로우가 있음
            savedWorkflows.value[imageHash] = {
              session_id: data.data.session_id,
              image_title: data.data.image_title || currentImageTitle.value,
              timestamp: data.data.timestamp
            }
            
            showStatusMessage.value = true;
            statusMessage.value = '이 이미지에 대해 저장된 워크플로우가 있습니다.';
            setTimeout(() => {
              showStatusMessage.value = false;
            }, 3000);
          }
        }
      } catch (error) {
        console.error('워크플로우 조회 중 오류:', error);
      }
    }
    
    // 기본 노드 설정 함수
    const useDefaultNodes = () => {
      // 가상의 노드 목록 설정 (백엔드 API 오류 시 대체)
      availableNodes.value = [
        { id: 'resize', label: '크기 조정', icon: 'fas fa-expand' },
        { id: 'crop', label: '이미지 자르기', icon: 'fas fa-crop' },
        { id: 'rotate', label: '회전', icon: 'fas fa-sync' },
        { id: 'brightness', label: '밝기 조정', icon: 'fas fa-sun' },
        { id: 'blur', label: '블러 효과', icon: 'fas fa-blur' },
        { id: 'merge', label: '이미지 병합', icon: 'fas fa-object-group' },
        { id: 'object_detection', label: '객체 감지', icon: 'fas fa-search' },
        { id: 'style_transfer', label: '스타일 변환', icon: 'fas fa-paint-brush' }
      ]
      
      defaultOptions.value = {
        resize: { width: 800, height: 600 },
        crop: { x: 0, y: 0, width: 200, height: 200 },
        rotate: { angle: 90 },
        brightness: { factor: 1.2 },
        blur: { radius: 5 },
        merge: { merge_type: 'horizontal', spacing: 10 },
        object_detection: { confidence: 0.5 },
        style_transfer: { style_strength: 0.8 }
      }
      
      console.log('기본 노드 목록 설정 완료:', availableNodes.value);
    }
    
    // 초기 엘리먼트 설정
    const initializeElements = () => {
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
    }

    // MSA4에서 이미지 데이터 받기 - 이벤트 리스너
    onMounted(() => {
      // 이벤트 리스너 등록 - MSA4에서 이미지 선택 시 호출
      document.addEventListener('msa4-to-msa5-image', handleImageUpdate)
      
      // MSA1에서 이미지 선택 시 호출되는 이벤트 리스너 추가
      document.addEventListener('msa1-to-msa5-image', handleImageUpdate)
      
      // 워크플로우 이벤트 리스너 등록 - MSA4에서 워크플로우 불러오기 선택 시 호출
      document.addEventListener('msa4-to-msa5-workflow', handleWorkflowFromMSA4)
      
      // 노드 목록 로드
      loadAvailableNodes()
      
      // 페이지 새로고침 시 MSA5 상태 초기화
      sessionStorage.removeItem('msa5_end_image')
      sessionStorage.removeItem('msa5_processing')
      console.log('MSA5: 컴포넌트 마운트 시 상태 초기화됨')
      
      // 기본 워크플로우 로드
      loadDefaultWorkflow()
      
      // 키보드 이벤트 리스너 추가
      window.addEventListener('keydown', handleKeyDown)
      
      // 워크플로우 저장 목록 로드
      loadSavedWorkflows()
    })

    // 노드 연결 이벤트 핸들러
    const onConnect = (params) => {
      // 유효한 연결인지 확인
      if (!params.source || !params.target) {
        console.warn('유효하지 않은 연결 파라미터:', params);
        return;
      }
      
      // 변경 전 상태 저장 (실행 취소 지원)
      saveToHistory();
      
      // 연결선 ID 생성
      const id = `e_${params.source}_${params.target}_${Date.now()}`;
      
      // 새 연결 생성
      const newEdge = {
        id,
        source: params.source,
        target: params.target,
        type: 'smoothstep',
        sourceHandle: params.sourceHandle,
        targetHandle: params.targetHandle
      };
      
      // 연결선 추가
      elements.value = [...elements.value, newEdge];
      
      // 연결 상태 업데이트
      updateConnections();
      
      console.log(`연결 생성됨: ${params.source} -> ${params.target}`)
    }
    
    // 기본 워크플로우 로드
    const loadDefaultWorkflow = () => {
      try {
        // 로컬 스토리지에서 저장된 워크플로우 확인
        const storedWorkflow = localStorage.getItem('msa5_last_workflow');
        
        if (storedWorkflow) {
          try {
            // 저장된 워크플로우 파싱 및 로드
            const workflow = JSON.parse(storedWorkflow);
            if (workflow && Array.isArray(workflow.elements) && workflow.elements.length > 0) {
              elements.value = workflow.elements;
              console.log('마지막으로 저장된 워크플로우를 로드했습니다.');
              return;
            }
          } catch (parseError) {
            console.error('저장된 워크플로우 파싱 오류:', parseError);
          }
        }
        
        // 저장된 워크플로우가 없거나 로드 실패 시 기본 워크플로우 사용
        console.log('기본 워크플로우를 초기화합니다.');
        initializeElements();
      } catch (error) {
        console.error('워크플로우 로드 중 오류 발생:', error);
        // 오류 발생 시 기본 요소로 초기화
        initializeElements();
      }
    }
    
    // 저장된 워크플로우 목록 로드
    const loadSavedWorkflows = async () => {
      try {
        console.log('워크플로우 저장 목록 초기화');
        // Note: We're removing the API call to /api/msa5/get-workflows since it returns 404
        // Instead, just initialize the savedWorkflows with an empty object
        savedWorkflows.value = {};
      } catch (error) {
        console.error('저장된 워크플로우 목록 초기화 중 오류:', error);
      }
    }
    
    // 워크플로우 저장 취소
    const cancelSaveWorkflow = () => {
      showSaveWorkflowDialog.value = false;
      workflowName.value = '';
      workflowDescription.value = '';
    }
    
    // 워크플로우 저장 확인
    const confirmSaveWorkflow = async () => {
      if (!workflowName.value) {
        showStatusMessage.value = true;
        statusMessage.value = '워크플로우 이름을 입력하세요.';
        setTimeout(() => { showStatusMessage.value = false }, 3000);
        
        // 입력 필드에 포커스
        if (workflowNameInput.value) {
          workflowNameInput.value.focus();
        }
        return;
      }
      
      // 중복 이름 확인을 위해 API 호출
      try {
        // 중복 확인 API 호출
        const checkResponse = await fetch('http://localhost:8000/api/external_storage/check-title', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          mode: 'cors',
          credentials: 'include',
          body: JSON.stringify({ title: workflowName.value })
        });
        
        const checkResult = await checkResponse.json();
        
        // 중복된 이름이 있는 경우
        if (checkResult.status === 'duplicate_name') {
          showDuplicateNameWarning();
          return;
        }
        
        // 중복이 아닌 경우 저장 진행
        showSaveWorkflowDialog.value = false;
        
        try {
          console.log('워크플로우 저장 시작...');
          
          // 입력 이미지 확인
          if (!inputImage.value) {
            showStatusMessage.value = true;
            statusMessage.value = '저장 실패: 입력 이미지가 없습니다.';
            setTimeout(() => { showStatusMessage.value = false }, 3000);
            console.error('워크플로우 저장 실패: 입력 이미지 없음');
            return;
          }
          
          // 이미지 URL에서 파일명 추출
          const getFilenameFromUrl = (url) => {
            return url.split('/').pop() || `image_${Date.now()}.png`;
          };
          
          const inputFilename = getFilenameFromUrl(inputImage.value);
          let outputFilename = processedImages['end'] ? getFilenameFromUrl(processedImages['end']) : '';
          
          // 세션 ID 생성
          const sessionId = `workflow_${Date.now()}`;
          
          // 저장할 워크플로우 데이터 구성 - 이미지 데이터는 포함하지 않음
          const workflowData = {
            session_id: sessionId,
            input_image_filename: inputFilename,
            output_image_filename: outputFilename,
            elements: elements.value,
            workflow_name: workflowName.value,
            workflow_description: workflowDescription.value,
            image_title: currentImageTitle.value || '', // 빈 값으로 설정하여 서버에서 자동 생성되도록 함
            timestamp: new Date().toISOString()
          }
          
          console.log('워크플로우 데이터 구성 완료. API 요청 시작...');
          
          // 이미지와 워크플로우 정보를 external storage API로 저장
          if (inputImage.value && processedImages['end']) {
            try {
              showStatusMessage.value = true;
              statusMessage.value = '이미지 저장 중...';
              
              // Blob URL 확인 및 특별 처리
              if (processedImages['end'].startsWith('blob:')) {
                console.log('Blob URL 감지됨, exportImagesToExternal 함수 사용...');
                
                // 임시로 workflowName 값 설정 (함수가 이 값을 사용함)
                const originalName = workflowName.value;
                workflowName.value = workflowName.value.replace(/ /g, '_');
                
                try {
                  // exportImagesToExternal 함수는 Blob URL을 올바르게 처리함
                  await exportImagesToExternal();
                  console.log('Blob URL 저장 성공, 워크플로우 저장 계속...');
                  
                  // workflowData에 세션 ID 설정 (외부 저장소에서 생성된 ID 재사용)
                  workflowData.workflow_id = localStorage.getItem('current_workflow_session_id') || sessionId;
                } finally {
                  // workflowName 원래 값으로 복원
                  workflowName.value = originalName;
                }
              } else {
                // 일반 이미지 URL인 경우 기존 방식으로 저장
              // API 요청 데이터 구성
              const requestData = {
                  title: workflowName.value.replace(/ /g, '_'),  // 공백을 언더스코어(_)로 변경
                description: workflowDescription.value || '',
                before_image: inputImage.value,
                after_image: processedImages['end'],
                workflow_id: sessionId,
                tags: ['lcnc', '이미지 처리']
              };
              
                // 외부 이미지 저장 API 호출
              const extResponse = await fetch('http://localhost:8000/api/external_storage/save-images', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                  mode: 'cors',
                  credentials: 'include',
                body: JSON.stringify(requestData)
              });
              
              if (extResponse.ok) {
                const extResult = await extResponse.json();
                console.log('이미지 저장 결과:', extResult);
                
                  // 경고 메시지가 있으면 표시
                if (extResult.warning) {
                  showStatusMessage.value = true;
                  statusMessage.value = extResult.warning;
                  setTimeout(() => { showStatusMessage.value = false }, 4000);
                }
                
                // 실제 저장된 이미지 URL 또는 파일명을 워크플로우 데이터에 추가
                if (extResult.image_data) {
                  workflowData.before_image_url = extResult.image_data.before_url;
                  workflowData.after_image_url = extResult.image_data.after_url;
                  
                  // 파일명을 업데이트
                  const beforeFilename = extResult.image_data.before_url.split('/').pop();
                  const afterFilename = extResult.image_data.after_url.split('/').pop();
                  
                  if (beforeFilename) workflowData.input_image_filename = beforeFilename;
                  if (afterFilename) workflowData.output_image_filename = afterFilename;
                  }
                }
              }
            } catch (extError) {
              console.error('이미지 저장 중 오류 발생:', extError);
              // 이미지 저장 실패를 알리지만 워크플로우 저장은 계속 진행
              showStatusMessage.value = true;
              statusMessage.value = '이미지 저장 중 오류가 발생했지만 워크플로우 저장을 진행합니다.';
            }
          }
          
          // 워크플로우 데이터를 MongoDB의 lcnc_result 컬렉션에 저장
          const response = await fetch('http://localhost:8000/api/msa5/save-workflow', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            mode: 'cors',
            credentials: 'include',
            body: JSON.stringify(workflowData)
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            
            // 409 Conflict 오류 처리 (중복 워크플로우 이름)
            if (response.status === 409) {
              try {
                const errorData = JSON.parse(errorText);
                if (errorData.status === 'duplicate') {
                  console.log('중복된 워크플로우 이름 감지됨:', errorData);
                  // 저장 대화상자를 다시 보여주지 않고 바로 중복 경고 대화상자 표시
                  showDuplicateNameWarning();
                  return;
                }
              } catch (jsonError) {
                console.error('중복 오류 응답 파싱 실패:', jsonError);
              }
            }
            
            throw new Error(`워크플로우 저장 실패: ${response.status} ${response.statusText} - ${errorText}`);
          }
          
          const result = await response.json();
          console.log('API 응답 받음:', result);
          
          if (result.status === 'success') {
            // 경고 메시지가 있는 경우 표시
            if (result.warning) {
              showStatusMessage.value = true;
              statusMessage.value = result.warning;
              setTimeout(() => { showStatusMessage.value = false }, 4000);
            } else {
              // 성공 메시지 표시
              showStatusMessage.value = true;
              statusMessage.value = '워크플로우가 성공적으로 저장되었습니다!';
              setTimeout(() => {
                showStatusMessage.value = false;
              }, 3000);
            }
            
            // 세션 ID를 localStorage에 저장 (측정 결과 저장 시 사용)
            localStorage.setItem('current_workflow_session_id', workflowData.session_id);
            
            // 저장된 워크플로우 목록 업데이트
            const imageHash = await calculateImageHash(inputImage.value);
            savedWorkflows.value[imageHash] = {
              session_id: workflowData.session_id,
              workflow_name: workflowData.workflow_name,
              image_title: currentImageTitle.value,
              timestamp: workflowData.timestamp
            }
          } else {
            throw new Error(result.message || '서버에서 저장 실패 응답을 반환했습니다.');
          }
          
        } catch (error) {
          console.error('워크플로우 저장 중 오류 발생:', error);
          showStatusMessage.value = true;
          statusMessage.value = `워크플로우 저장 실패: ${error.message}`;
          setTimeout(() => {
            showStatusMessage.value = false;
          }, 5000);
        }
      } catch (error) {
        console.error('중복 이름 확인 중 오류:', error);
        showStatusMessage.value = true;
        statusMessage.value = `중복 이름 확인 실패: ${error.message}`;
        setTimeout(() => {
          showStatusMessage.value = false;
        }, 5000);
      }
    }

    // 워크플로우 로드
    const loadWorkflow = async (sessionId) => {
      if (!sessionId) return;
      
      try {
        const response = await fetch(`http://localhost:8000/api/msa5/get-workflow/${sessionId}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'success' && data.workflow && data.workflow.elements) {
            // 워크플로우 데이터 로드
            elements.value = JSON.parse(JSON.stringify(data.workflow.elements));
            
            // 기타 필요한 정보 업데이트
            if (data.workflow.input_image_url) {
              inputImage.value = data.workflow.input_image_url;
            }
            
            if (data.workflow.workflow_name) {
              workflowName.value = data.workflow.workflow_name;
            }
            
            // 알림 표시
            showStatusMessage.value = true;
            statusMessage.value = '워크플로우를 불러왔습니다.';
            setTimeout(() => { showStatusMessage.value = false }, 3000);
          } else {
            throw new Error(data.message || '워크플로우 데이터가 없습니다.');
          }
        } else {
          throw new Error(`API 응답 오류: ${response.status}`);
        }
      } catch (error) {
        console.error('워크플로우 로드 중 오류:', error);
        showStatusMessage.value = true;
        statusMessage.value = `워크플로우 로드 실패: ${error.message}`;
        setTimeout(() => { showStatusMessage.value = false }, 3000);
      }
    }

    // 캔버스 클릭 이벤트 핸들러 - 노드 선택 해제용
    const handleCanvasClick = (event) => {
      // 이벤트 타겟이 캔버스 자체인지 확인
      const isCanvas = event.target.classList.contains('workflow-area') || 
                       event.target.classList.contains('vue-flow__pane') ||
                       event.target.classList.contains('vue-flow__transformationpane');
      
      if (isCanvas && selectedNode.value) {
        console.log('캔버스 클릭 - 노드 선택 해제');
        selectedNode.value = null;
      }
    }

    // MSA4나 MSA1에서 이미지 데이터 받기 - 이벤트 핸들러
    const handleImageUpdate = (event) => {
      try {
        console.log('MSA5: 이미지 이벤트 수신', event.type);
        
        // 이벤트 데이터 추출
        const data = event.detail;
        
        if (!data) {
          console.warn('MSA5: 이벤트에 데이터가 없습니다');
            return;
        }
        
        // 이미지 URL과 제목 추출
        const imageUrl = data.imageUrl || data.url || data.image;
        const imageTitle = data.imageTitle || data.title || data.name || '';
        
        if (!imageUrl) {
          console.warn('MSA5: 이벤트에 이미지 URL이 없습니다');
            return;
          }
          
        console.log(`MSA5: 이미지 수신 - URL: ${imageUrl.substring(0, 30)}..., 제목: ${imageTitle}`);
        
        // 이미지 설정
        setImage(imageUrl, imageTitle);
        
        // processedImages에 시작 이미지로 설정
        processedImages['start'] = imageUrl;
        
        // 세션 스토리지에 시작 이미지 URL 저장
        sessionStorage.setItem('msa5_start_image_url', imageUrl);
        console.log('MSA5: 세션 스토리지에 시작 이미지 URL 저장:', imageUrl.substring(0, 30) + '...');
        
        // 이벤트 타입에 따른 추가 처리
        if (event.type === 'msa4-to-msa5-image') {
          console.log('MSA5: MSA4에서 이미지 수신됨');
        } else if (event.type === 'msa1-to-msa5-image') {
          // MSA1에서 온 경우 특별한 처리 (있다면)
          console.log('MSA5: MSA1에서 이미지 수신됨');
          }
        } catch (error) {
        console.error('MSA5: 이미지 업데이트 처리 중 오류 발생', error);
      }
    }

    // 백엔드에서 사용 가능한 노드 로드
    const loadAvailableNodes = async () => {
      isNodesLoading.value = true
      console.log('===============================================');
      console.log('【노드 목록 로드 시작...】');
      console.log('===============================================');
      
      try {
        // 백엔드 API에서 노드 목록 로드 시도
        const apiUrl = 'http://localhost:8000/api/msa5/nodes';
        console.log(`API 호출 URL: ${apiUrl}`);
        
        // fetch API 호출 전에 로그 출력
        console.time('API 호출 시간');
        
        try {
          const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
              'Accept': 'application/json'
            },
            mode: 'cors',
            credentials: 'include'
          });
          console.timeEnd('API 호출 시간');
          
          console.log('API 응답 상태코드:', response.status);
          
          if (response.ok) {
            try {
              const data = await response.json();
              console.log('API 응답 데이터:', data);
              
              if (data.options && Array.isArray(data.options)) {
                console.log(`노드 데이터 개수: ${data.options.length}`);
                availableNodes.value = data.options;
                
                // 기본 옵션 설정 - 이 부분을 수정하여 백엔드에서 받은 defaultOptions 사용
                if (data.defaultOptions) {
                  defaultOptions.value = data.defaultOptions;
                  console.log('기본 옵션 설정 완료:', defaultOptions.value);
                }
                
                console.log('노드 목록 업데이트 완료:', availableNodes.value);
              } else {
                console.warn('❌ 백엔드 응답에 options 배열이 없거나 형식이 맞지 않습니다:', data);
                console.warn('기본 노드 목록을 사용합니다.');
                useDefaultNodes();
              }
            } catch (parseError) {
              console.error('❌ JSON 파싱 오류:', parseError);
              console.warn('JSON 파싱에 실패했습니다. 기본 노드 목록을 사용합니다.');
              useDefaultNodes();
            }
          } else {
            console.error(`❌ API 요청 실패: ${response.status} ${response.statusText}`);
            const errorText = await response.text();
            console.error('오류 응답 내용:', errorText);
            console.warn('API 요청이 실패했습니다. 기본 노드 목록을 사용합니다.');
            useDefaultNodes();
          }
        } catch (fetchError) {
          console.timeEnd('API 호출 시간');
          console.error('❌ fetch 호출 오류:', fetchError);
          console.error('오류 세부 정보:', {
            name: fetchError.name,
            message: fetchError.message,
            stack: fetchError.stack
          });
          console.warn('백엔드 연결에 실패했습니다. 기본 노드 목록을 사용합니다.');
          useDefaultNodes();
        }
      } finally {
        // 노드 로드 후 초기 요소 설정
        initializeElements();
        
        // 노드 목록이 로드되면 로딩 상태 해제
        isNodesLoading.value = false;
        console.log('노드 로딩 상태 업데이트:', isNodesLoading.value);
        console.log('===============================================');
        console.log('【노드 목록 로드 완료】');
        console.log('===============================================');
      }
    }
    
    // 워크플로우 요약 함수
    const getNodeSummary = () => {
      // 노드 요약 계산 로직
      return elements.value.filter(el => 
        el.type !== 'smoothstep' && 
        el.id !== 'start' && 
        el.id !== 'end'
      );
    }
    
    // 노드 개수 계산
    const getNodeCount = () => {
      return elements.value.filter(el => el.type !== 'smoothstep').length;
    }
    
    // 연결 개수 계산
    const getConnectionCount = () => {
      return elements.value.filter(el => el.type === 'smoothstep').length;
    }

    // 워크플로우 저장 기능 (저장 대화상자 열기)
    const saveWorkflow = () => {
      if (!inputImage.value || !processedImages['end']) {
        showStatusMessage.value = true;
        statusMessage.value = '저장할 이미지가 없습니다. 워크플로우를 실행해주세요.';
        setTimeout(() => { showStatusMessage.value = false }, 3000);
        return;
      }
      
      // 저장 대화상자 표시
      showSaveWorkflowDialog.value = true;
      
      // 다음 렌더링 사이클에서 입력 필드에 포커스
      nextTick(() => {
        if (workflowNameInput.value) {
          workflowNameInput.value.focus();
        }
      });
    }
    
    // 중복 이름 경고 표시
    const showDuplicateNameWarning = () => {
      showDuplicateNameDialog.value = true;
      showDuplicateNameError.value = false;
      
      // 현재 이름을 새 이름 필드에 복사하고 _new 접미사 추가
      newWorkflowName.value = `${workflowName.value}_new`;
      
      // 다음 렌더링 사이클에서 입력 필드에 포커스
      nextTick(() => {
        if (newWorkflowNameInput.value) {
          newWorkflowNameInput.value.focus();
        }
      });
    }
    
    // 중복 이름 대화상자 닫기
    const closeDuplicateNameDialog = () => {
      showDuplicateNameDialog.value = false;
      newWorkflowName.value = '';
      showDuplicateNameError.value = false;
    }
    
    // 새 이름으로 저장 적용
    const applyNewName = async () => {
      if (!newWorkflowName.value) {
        showDuplicateNameError.value = true;
        return;
      }
      
      try {
        // 중복 확인 API 호출
        const checkResponse = await fetch('http://localhost:8000/api/external_storage/check-title', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          mode: 'cors',
          credentials: 'include',
          body: JSON.stringify({ title: newWorkflowName.value })
        });
        
        const checkResult = await checkResponse.json();
        
        // 여전히 중복된 이름인 경우
        if (checkResult.status === 'duplicate_name') {
          showDuplicateNameError.value = true;
        return;
      }
      
        // 중복이 아닌 경우 이름 적용
        workflowName.value = newWorkflowName.value;
        closeDuplicateNameDialog();
        
        // 저장 진행
        confirmSaveWorkflow();
      } catch (error) {
        console.error('중복 이름 확인 중 오류:', error);
        showStatusMessage.value = true;
        statusMessage.value = `중복 이름 확인 실패: ${error.message}`;
        setTimeout(() => { showStatusMessage.value = false }, 5000);
      }
    }
    
    // 워크플로우 오류 대화상자 닫기
    const closeWorkflowErrorDialog = () => {
      showWorkflowErrorDialog.value = false;
    }
    
    // 상태 메시지 설정 함수
    const setStatusMessage = (message, type = 'info', duration = 3000) => {
      statusMessage.value = message;
      statusType.value = type;
      showStatusMessage.value = true;
      
      if (duration > 0) {
        setTimeout(() => {
          showStatusMessage.value = false;
        }, duration);
      }
    }
    
    // MSA4에서 워크플로우 데이터 받기 - 이벤트 핸들러
    const handleWorkflowFromMSA4 = async (event) => {
      try {
        console.log('MSA5: 워크플로우 이벤트 수신', event.type);
        
        // 이벤트 데이터 추출
        const data = event.detail;
        
        if (!data) {
          console.warn('MSA5: 이벤트에 데이터가 없습니다');
              return;
            }
        
        // 워크플로우 데이터 추출
        const { workflowId, elements, image } = data;
        
        if (!workflowId) {
          console.warn('MSA5: 이벤트에 워크플로우 ID가 없습니다');
          return;
        }
        
        console.log(`MSA5: 워크플로우 수신 - ID: ${workflowId}`);
        
        // 워크플로우 데이터가 있으면 요소 설정
        if (elements && Array.isArray(elements)) {
          elements.value = elements;
          console.log('MSA5: 워크플로우 요소 설정됨');
        } else {
          // 워크플로우 ID로 서버에서 데이터 로드
          await loadWorkflow(workflowId);
        }
        
        // 이미지가 있으면 설정
        if (image) {
          setImage(image.url || image.imageUrl, image.title || image.imageTitle || '');
        }
        
        // 알림 표시
        showStatusMessage.value = true;
        statusMessage.value = '워크플로우가 로드되었습니다.';
        setTimeout(() => { showStatusMessage.value = false }, 3000);
      } catch (error) {
        console.error('MSA5: 워크플로우 업데이트 처리 중 오류 발생', error);
        showStatusMessage.value = true;
        statusMessage.value = `워크플로우 로드 실패: ${error.message}`;
        setTimeout(() => { showStatusMessage.value = false }, 3000);
      }
    }
    
    // 외부 저장소로 이미지 내보내기 - 단일 API 호출 방식
    const exportImagesToExternal = async () => {
      try {
        if (!inputImage.value || !processedImages['end']) {
          throw new Error('내보낼 이미지가 없습니다.');
        }
        
        // 현재 워크플로우 이름 가져오기
        const title = workflowName.value || '';
        if (!title) {
          throw new Error('워크플로우 이름이 필요합니다.');
        }
        
        console.log('이미지 외부 내보내기 시작 - 타이틀:', title);
        
        // 세션 ID 생성
        const sessionId = `workflow_${Date.now()}`;
        
        // 파일 이름 설정 - 요구사항에 맞게 _before와 _after 접미사 사용
        const beforeFilename = `${title}_before`;
        const afterFilename = `${title}_after`;
        
        console.log('원본 이미지 URL 확인:');
        console.log('Before 이미지:', inputImage.value.substring(0, 30) + '...');
        console.log('After 이미지:', processedImages['end'].substring(0, 30) + '...');
        
        // 로컬 Helper 함수: Blob URL을 Base64 데이터 URL로 변환
        const blobToBase64 = async (blobUrl) => {
          try {
            // 이미 data URL이면 변환하지 않음
            if (blobUrl.startsWith('data:')) {
              console.log('이미 Data URL 형식입니다. 변환 불필요. 전체 URL:', blobUrl);
              return blobUrl;
            }
            
            console.log('Blob URL을 Base64로 변환 시작 (전체 URL):', blobUrl);
            const response = await fetch(blobUrl);
            
            if (!response.ok) {
              throw new Error(`Blob URL 가져오기 실패: ${response.status}`);
            }
            
            const blob = await response.blob();
            console.log('Blob 정보 (상세):', {
              type: blob.type,
              size: blob.size + ' bytes',
              lastModified: blob.lastModified ? new Date(blob.lastModified).toISOString() : 'N/A'
            });
            
            return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const result = reader.result;
                console.log('Base64 변환 완료 (전체 결과):', result);
                resolve(result);
              };
              reader.onerror = (e) => {
                console.error('FileReader 오류 (상세):', e);
                reject(new Error('이미지 읽기 오류'));
              };
              reader.readAsDataURL(blob);
            });
          } catch (error) {
            console.error('Base64 변환 중 오류:', error);
            // 오류 발생 시 원본 URL 반환 (API에서 처리 가능한지 시도)
            return blobUrl;
          }
        };
        
        // Blob URL을 Base64 데이터 URL로 변환
        const beforeImageBase64 = await blobToBase64(inputImage.value);
        
        // After 이미지 변환 특별 처리 (더 상세한 로깅)
        console.log('After 이미지 변환 시작...');
        console.log('After 이미지 URL 타입:', processedImages['end'].startsWith('blob:') ? 'Blob URL' : 
                                           processedImages['end'].startsWith('data:') ? 'Data URL' : 'HTTP URL');
        
        let afterImageBase64;
        try {
          // 우선 표준 방식으로 변환 시도
          afterImageBase64 = await blobToBase64(processedImages['end']);
          console.log('After 이미지 변환 성공 - 표준 방식');
        } catch (conversionError) {
          console.error('표준 방식 변환 실패:', conversionError);
          
          // 변환 실패 시 대체 방식으로 시도
          console.log('대체 방식으로 변환 시도...');
          try {
            const response = await fetch(processedImages['end']);
            const blob = await response.blob();
            console.log('After 이미지 Blob 정보:', {
              type: blob.type || 'unknown',
              size: blob.size + ' bytes'
            });
            
            // 수동으로 FileReader 사용
            const dataUrl = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const result = reader.result;
                console.log('FileReader 결과 (전체):', result);
                resolve(result);
              };
              reader.onerror = (e) => {
                console.error('FileReader 오류:', e);
                reject(new Error('이미지 읽기 오류'));
              };
              reader.readAsDataURL(blob);
            });
            
            afterImageBase64 = dataUrl;
            console.log('After 이미지 변환 성공 - 대체 방식');
          } catch (alternativeError) {
            console.error('대체 방식도 실패:', alternativeError);
            console.log('원본 URL 사용 (변환 실패)');
            afterImageBase64 = processedImages['end']; // 원본 URL 사용 (API가 처리 가능한지 시도)
          }
        }
        
        console.log('변환된 이미지 데이터:');
        console.log('Before 이미지 타입 (전체):', beforeImageBase64);
        console.log('After 이미지 타입 (전체):', afterImageBase64);
        
        // API 요청 데이터 구성 - 두 이미지 모두 포함 (API 요구사항)
              const requestData = {
          title: title,
                description: workflowDescription.value || '',
          before_image: beforeImageBase64,
          after_image: afterImageBase64,
          before_filename: beforeFilename,
          after_filename: afterFilename,
                workflow_id: sessionId,
                tags: ['lcnc', '이미지 처리']
              };
              
        console.log('이미지 저장 API 요청 준비 완료');
        
        // 결과 저장 변수
        let result;
        
        try {
          // 1. JSON 방식으로 시도
          console.log('JSON 방식으로 이미지 저장 시도...');
          const response = await fetch('http://localhost:8000/api/external_storage/save-images', {
                method: 'POST',
                headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
                },
            mode: 'cors',
            credentials: 'include',
                body: JSON.stringify(requestData)
              });
              
          if (!response.ok) {
            const errorText = await response.text();
            console.error('JSON 방식 API 오류:', response.status, errorText);
            throw new Error(`JSON 방식 실패 (${response.status})`);
          }
          
          result = await response.json();
          console.log('JSON 방식 이미지 저장 성공:', result);
          console.log('JSON 방식 이미지 저장 성공 (전체 응답):', JSON.stringify(result, null, 2));
          
          // 저장된 이미지 URL 로깅
          if (result.image_data) {
            console.log('저장된 Before 이미지 URL (전체):', result.image_data.before_url);
            console.log('저장된 After 이미지 URL (전체):', result.image_data.after_url);
          }
        } catch (jsonError) {
          console.error('JSON 방식 실패, FormData 방식으로 재시도:', jsonError);
          
          // 2. FormData 방식으로 시도
          try {
            // 이미지를 Blob으로 변환
            console.log('이미지를 Blob으로 변환...');
            const beforeBlob = await (async () => {
              if (inputImage.value.startsWith('data:')) {
                // Data URL에서 Blob 생성
                console.log('Before 이미지: Data URL에서 Blob 변환 중');
                const res = await fetch(inputImage.value);
                return await res.blob();
              } else if (inputImage.value.startsWith('blob:')) {
                // Blob URL에서 Blob 가져오기
                console.log('Before 이미지: Blob URL에서 Blob 변환 중');
                const res = await fetch(inputImage.value);
                return await res.blob();
              } else {
                // 일반 URL에서 Blob 가져오기
                console.log('Before 이미지: 일반 URL에서 Blob 변환 중');
                const res = await fetch(inputImage.value);
                return await res.blob();
              }
            })();
            
            const afterBlob = await (async () => {
              if (processedImages['end'].startsWith('data:')) {
                console.log('After 이미지: Data URL에서 Blob 변환 중');
                const res = await fetch(processedImages['end']);
                return await res.blob();
              } else if (processedImages['end'].startsWith('blob:')) {
                console.log('After 이미지: Blob URL에서 Blob 변환 중');
                const res = await fetch(processedImages['end']);
                return await res.blob();
              } else {
                console.log('After 이미지: 일반 URL에서 Blob 변환 중');
                const res = await fetch(processedImages['end']);
                return await res.blob();
              }
            })();
            
            console.log('Blob 변환 완료 - 상세 정보:');
            console.log('Before Blob 전체 정보:', {
              type: beforeBlob.type,
              size: beforeBlob.size,
              lastModified: beforeBlob.lastModified ? new Date(beforeBlob.lastModified).toISOString() : 'N/A'
            });
            console.log('After Blob 전체 정보:', {
              type: afterBlob.type,
              size: afterBlob.size,
              lastModified: afterBlob.lastModified ? new Date(afterBlob.lastModified).toISOString() : 'N/A'
            });
            
            console.log('Blob 변환 완료');
            console.log('Before Blob 타입:', beforeBlob.type, 'Size:', beforeBlob.size);
            console.log('After Blob 타입:', afterBlob.type, 'Size:', afterBlob.size);
            
            // FormData 구성
            const formData = new FormData();
            formData.append('title', title);
            formData.append('description', workflowDescription.value || '');
            formData.append('before_file', beforeBlob, `${beforeFilename}.${beforeBlob.type.split('/')[1] || 'png'}`);
            formData.append('file', afterBlob, `${afterFilename}.${afterBlob.type.split('/')[1] || 'png'}`);
            formData.append('workflow_id', sessionId);
            formData.append('tags', JSON.stringify(['lcnc', '이미지 처리']));
            
            console.log('FormData 구성 완료, API 요청 시작...');
            
            // API 호출
            const formResponse = await fetch('http://localhost:8000/api/external_storage/upload-file', {
            method: 'POST',
              mode: 'cors',
              credentials: 'include',
              body: formData
            });
            
            if (!formResponse.ok) {
              const errorText = await formResponse.text();
              console.error('FormData 방식 API 오류:', formResponse.status, errorText);
              throw new Error(`FormData 방식 실패 (${formResponse.status}): ${errorText}`);
            }
            
            result = await formResponse.json();
            console.log('FormData 방식 이미지 저장 성공:', result);
            console.log('FormData 방식 이미지 저장 성공 (전체 응답):', JSON.stringify(result, null, 2));
            
            // 저장된 이미지 URL 로깅
            if (result.image_data) {
              console.log('저장된 Before 이미지 URL (전체):', result.image_data.before_url);
              console.log('저장된 After 이미지 URL (전체):', result.image_data.after_url);
            }
          } catch (formError) {
            console.error('FormData 방식도 실패:', formError);
            throw new Error('모든 이미지 저장 방식이 실패했습니다.');
          }
        }
        
        // 세션 ID를 localStorage에 저장
        if (result && result.session_id) {
          localStorage.setItem('current_workflow_session_id', result.session_id);
        } else {
          localStorage.setItem('current_workflow_session_id', sessionId);
        }
        
        return result;
      } catch (error) {
        console.error('이미지 내보내기 중 오류:', error);
        throw error;
      }
    }

    // 유사 이미지 검색 기능
    const findSimilarForEndImage = async () => {
      if (!processedImages['end']) {
              showStatusMessage.value = true;
        statusMessage.value = '검색할 이미지가 없습니다.';
        setTimeout(() => { showStatusMessage.value = false }, 3000);
        return;
      }
      
      try {
        showStatusMessage.value = true;
        statusMessage.value = '유사 이미지 검색 중...';
        
        // Blob URL인 경우 데이터로 변환
        if (processedImages['end'].startsWith('blob:')) {
          const response = await fetch(processedImages['end']);
          const blob = await response.blob();
          
          // FormData 생성
          const formData = new FormData();
          formData.append('image', blob);
          
          // 이벤트 생성 (이미지 검색 이벤트)
          const searchEvent = new CustomEvent('msa5-similar-image-search', {
            detail: {
              imageUrl: processedImages['end'],
              blob: blob,
              timestamp: new Date().toISOString()
            }
          });
          
          // 이벤트 발생
          window.dispatchEvent(searchEvent);
          document.dispatchEvent(searchEvent);
          
          console.log('유사 이미지 검색 이벤트 발생');
          } else {
          // 일반 URL인 경우 바로 이벤트 발생
          const searchEvent = new CustomEvent('msa5-similar-image-search', {
            detail: {
              imageUrl: processedImages['end'],
              timestamp: new Date().toISOString()
            }
          });
          
          // 이벤트 발생
          window.dispatchEvent(searchEvent);
          document.dispatchEvent(searchEvent);
          
          console.log('유사 이미지 검색 이벤트 발생');
        }
        
        // 메시지 업데이트
        statusMessage.value = '유사 이미지 검색 요청을 전송했습니다.';
        setTimeout(() => { showStatusMessage.value = false }, 3000);
      } catch (error) {
        console.error('유사 이미지 검색 중 오류:', error);
        statusMessage.value = `유사 이미지 검색 오류: ${error.message}`;
        setTimeout(() => { showStatusMessage.value = false }, 3000);
      }
    }

    // MSA6로 이미지 전송 함수
    const sendImageToMSA6 = (imageUrl, imageFormat) => {
      try {
        console.log('[sendImageToMSA6] MSA6로 이미지 전송 시작... URL:', imageUrl);
        
        if (!imageUrl) {
          console.error('[sendImageToMSA6] 이미지 URL이 없습니다.');
          return false;
        }
        
        // 워크플로우 메타데이터 수집
        const nodeCount = elements.value.filter(el => el.type !== 'smoothstep').length - 2; // 시작/종료 노드 제외
        const connectionCount = elements.value.filter(el => el.type === 'smoothstep').length;
        
        // 워크플로우 요약 - 노드 타입 목록
        const nodeTypes = elements.value
          .filter(el => el.type !== 'smoothstep' && el.id !== 'start' && el.id !== 'end')
          .map(node => ({
            id: node.id,
            type: node.data?.nodeId || node.data?.id || 'unknown',
            label: node.data?.label || 'Unknown Node'
          }));
        
        // 타이틀 구성
        const imageTitle = workflowName.value || currentImageTitle.value || `processed_${Date.now()}`;
        
        // 이미지 정보 구성
        const imageData = {
          imageUrl: imageUrl,
          format: imageFormat || 'png',
          title: imageTitle,
          source: 'MSA5',
          timestamp: new Date().toISOString(),
          noPopup: true, // 팝업을 자동으로 열지 않도록 플래그 추가
          metadata: {
            workflow_name: workflowName.value || '',
            workflow_description: workflowDescription.value || '',
            node_count: nodeCount,
            connection_count: connectionCount,
            nodes: nodeTypes,
            processing_type: 'image_lcnc'
          }
        };
        
        // 세션 스토리지에 데이터 저장 (MSA6가 직접 접근할 수 있도록)
        sessionStorage.setItem('msa5_to_msa6_image_data', JSON.stringify(imageData));
        
        // 세션 스토리지에 MSA5 처리 상태 표시 - MSA6가 이를 감지함
        sessionStorage.setItem('msa5_end_image', 'true');
        // 팝업 자동 열림 방지 플래그 추가
        sessionStorage.setItem('msa6_no_auto_popup', 'true');
        
        // 다양한 이벤트 발생 방법 시도
        
        // 1. 표준 커스텀 이벤트 방식 (원래 사용하던 이벤트)
        const customEvent = new CustomEvent('msa5-to-msa6-image', {
          detail: imageData,
          bubbles: true,
          cancelable: true
        });
        
        // 2. MSA6가 실제로 듣고 있는 이벤트 (코드 검색에서 발견)
        const msa6Event = new CustomEvent('msa5-image-processed', {
          detail: {
            imageUrl: imageUrl,
            timestamp: Date.now(),
            title: imageTitle,
            format: imageFormat || 'png',
            noPopup: true, // 팝업 자동 열림 방지 플래그
            metadata: imageData.metadata
          },
          bubbles: true,
          cancelable: true
        });
        
        // 문서와 창에 이벤트 발생 (두 가지 이벤트 모두 발생)
        document.dispatchEvent(customEvent);
        window.dispatchEvent(customEvent);
        
        document.dispatchEvent(msa6Event);
        window.dispatchEvent(msa6Event);
        
        console.log('[sendImageToMSA6] MSA6 표준 이벤트 발생 완료');
        
        // 3. localStorage 기반 통신 시도 (다른 컴포넌트가 polling할 수 있음)
        localStorage.setItem('msa5_latest_image', JSON.stringify({
          url: imageUrl,
          title: imageTitle,
          timestamp: Date.now(),
          format: imageFormat || 'png'
        }));
        
        // MSA6 컴포넌트가 직접 사용하는 로컬스토리지 키 설정
        localStorage.setItem('msa6_final_image', imageUrl);
        console.log('[sendImageToMSA6] msa6_final_image 로컬스토리지 설정 완료:', imageUrl.substring(0, 30) + '...');
        
        // 강제로 글로벌 이벤트 트리거 (window에 직접 할당)
        if (!window.msa5LatestImage) {
          window.msa5LatestImage = {};
        }
        window.msa5LatestImage = {
          url: imageUrl,
          title: imageTitle,
          timestamp: Date.now(),
          format: imageFormat || 'png',
          metadata: imageData.metadata
        };
        
        // 5. 직접 MSA6에 접근 시도
        const msa6Component = document.querySelector('.msa6-component');
        if (msa6Component) {
          console.log('[sendImageToMSA6] MSA6 컴포넌트 발견, 직접 이미지 설정 시도');
          
          // Vue 컴포넌트 접근
          const msa6Instance = msa6Component.__vue__;
          if (msa6Instance) {
            console.log('[sendImageToMSA6] MSA6 Vue 인스턴스 발견');
            // 컴포넌트의 메서드나 속성 접근 시도
            if (typeof msa6Instance.setImage === 'function') {
              msa6Instance.setImage(imageUrl, imageTitle);
              console.log('[sendImageToMSA6] MSA6 setImage 메서드 호출 성공');
            }
          }
        }
        
        console.log('[sendImageToMSA6] MSA6로 이미지 전송 완료. 데이터:', {
          url: imageUrl.substring(0, 30) + '...',
          format: imageFormat,
          title: imageTitle,
          timestamp: new Date().toISOString()
        });
        
        // 사용자에게 알림
            showStatusMessage.value = true;
        statusMessage.value = 'MSA6로 이미지 전송 완료';
            setTimeout(() => { showStatusMessage.value = false }, 3000);
        
        return true;
      } catch (error) {
        console.error('[sendImageToMSA6] MSA6로 이미지 전송 중 오류:', error);
        
        // 오류 알림
        showStatusMessage.value = true;
        statusMessage.value = `MSA6 전송 오류: ${error.message}`;
        setTimeout(() => { showStatusMessage.value = false }, 3000);
        
        return false;
      }
    };

    // MSA6 전송 버튼 핸들러 (피드백 강화)
    const handleMSA6Transfer = () => {
      try {
        // 버튼 상태를 일시적으로 변경하여 피드백 제공
        const msa6Btn = document.querySelector('.msa6-btn');
        if (msa6Btn) {
          // 버튼 텍스트와 아이콘 변경
          const originalHTML = msa6Btn.innerHTML;
          msa6Btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 전송 중...';
          msa6Btn.disabled = true;
          msa6Btn.style.backgroundColor = '#94d3a2';
          
          // 이미지 형식 가져오기
          const imageFormat = sessionStorage.getItem('msa5_end_image_format') || 'png';
          
          // MSA6로 전송
          const success = sendImageToMSA6(previewImageUrl.value, imageFormat);
          
          // 강제로 MSA5 처리 상태 설정 (MSA6가 이 값을 확인함)
          sessionStorage.setItem('msa5_end_image', 'true');
          
          // MSA6 최종 이미지 직접 설정
          localStorage.setItem('msa6_final_image', previewImageUrl.value);
          
          // 추가 확인을 위해 다시 이벤트 발생
          const msa6Event = new CustomEvent('msa5-image-processed', {
            detail: {
              imageUrl: previewImageUrl.value,
              timestamp: Date.now()
            },
            bubbles: true,
            cancelable: true
          });
          document.dispatchEvent(msa6Event);
          window.dispatchEvent(msa6Event);
          
          // 성공/실패에 따른 피드백
          setTimeout(() => {
            if (success) {
              msa6Btn.innerHTML = '<i class="fas fa-check"></i> 전송 완료';
              msa6Btn.style.backgroundColor = '#10b981';
          } else {
              msa6Btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 전송 실패';
              msa6Btn.style.backgroundColor = '#f87171';
            }
            
            // 원래 상태로 복원
            setTimeout(() => {
              msa6Btn.innerHTML = originalHTML;
              msa6Btn.disabled = false;
              msa6Btn.style.backgroundColor = '';
            }, 2000);
          }, 1000);
        } else {
          // 버튼을 찾을 수 없으면 바로 전송 시도
          const imageFormat = sessionStorage.getItem('msa5_end_image_format') || 'png';
          sendImageToMSA6(previewImageUrl.value, imageFormat);
        }
      } catch (error) {
        console.error('MSA6 전송 처리 중 오류:', error);
        showStatusMessage.value = true;
        statusMessage.value = `MSA6 전송 오류: ${error.message}`;
        setTimeout(() => { showStatusMessage.value = false }, 3000);
      }
    }

    return {
      isMaximized,
      toggleMaximize,
      hasInput,
      hasOutput,
      elements,
      selectedNode,
      selectedEdge,
      inputImage,
      processedImages,
      processingStatus,
      previewImageUrl,
      openImagePreview,
      closeImagePreview,
      processStart,
      onDragStart,
      onDragOver,
      onDrop,
      onInit,
      onConnect,
      onNodeClick,
      onEdgeClick,
      onNodeDragStop,
      onPaneReady,
      availableNodes,
      isNodesLoading,
      filteredNodes,
      mergeNode,
      containerRef,
      workflowArea,  // 워크플로우 영역 DOM 참조 추가
      
      // 실행 취소/다시 실행 함수
      undo,
      redo,
      deleteSelectedNode,
      deleteSelectedEdge,
      handleKeyDown,
      handleCanvasClick,  // 캔버스 클릭 이벤트 핸들러 추가
      
      // 워크플로우 저장 관련 함수
      saveWorkflow,
      canSaveWorkflow,
      savedWorkflows,
      loadWorkflow,
      
      // 워크플로우 저장 다이얼로그 관련
      showSaveWorkflowDialog,
      workflowName,
      workflowDescription,
      workflowNameInput,
      cancelSaveWorkflow,
      confirmSaveWorkflow,
      
      // 워크플로우 요약 함수
      getNodeSummary,
      getNodeCount,
      getConnectionCount,
      
      // 외부 저장 기능
      exportImagesToExternal,
      
      // 결과 이미지 유사 이미지 검색
      findSimilarForEndImage,
      
      // MSA6 연동 기능
      handleMSA6Transfer,
      sendImageToMSA6,
      
      // 중복 이름 확인 팝업
      showDuplicateNameDialog,
      closeDuplicateNameDialog,
      newWorkflowName,
      newWorkflowNameInput,
      applyNewName,
      showDuplicateNameWarning,
      showDuplicateNameError,
      
      // 워크플로우 검증
      validateWorkflow,
      
      // 워크플로우 오류 팝업
      showWorkflowErrorDialog,
      workflowErrorTitle,
      workflowErrorMessage,
      workflowErrorDetails,
      closeWorkflowErrorDialog,
      statusMessage,
      statusType,
      setStatusMessage,
      
      // Add missing variable to fix the Vue warning
      showStatusMessage,
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

.save-btn {
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
  animation: popup-fade-in 0.3s ease-out;
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
  flex-direction: column;
  align-items: center;
  gap: 20px;
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

.preview-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 15px;
  width: 100%;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 20px;
  background: #8b5cf6;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: #7c3aed;
  transform: translateY(-1px);
}

.similar-btn {
  background: #0ea5e9;
}

.similar-btn:hover {
  background: #0284c7;
}

.msa6-btn {
  background: #10b981;
}

.msa6-btn:hover {
  background: #059669;
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

/* 워크플로우 저장 다이얼로그 스타일 */
.save-workflow-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100000;
  backdrop-filter: blur(5px);
}

.save-workflow-dialog {
  background: white;
  border-radius: 10px;
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.2);
  width: 90%;
  max-width: 600px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: popup-fade-in 0.3s ease-out;
}

@keyframes popup-fade-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dialog-header {
  padding: 15px 20px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dialog-header h3 {
  margin: 0;
  color: #1e293b;
  font-size: 18px;
  font-weight: 600;
}

.dialog-content {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.dialog-footer {
  padding: 15px 20px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 14px;
  font-weight: 500;
  color: #4b5563;
}

.workflow-name-input {
  padding: 10px 15px;
  border-radius: 6px;
  border: 1px solid #d1d5db;
  font-size: 14px;
  transition: all 0.2s;
}

.workflow-name-input:focus {
  outline: none;
  border-color: #8b5cf6;
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
}

.workflow-desc-input {
  padding: 10px 15px;
  border-radius: 6px;
  border: 1px solid #d1d5db;
  font-size: 14px;
  min-height: 80px;
  resize: vertical;
  transition: all 0.2s;
}

.workflow-desc-input:focus {
  outline: none;
  border-color: #8b5cf6;
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
}

.preview-info {
  display: flex;
  gap: 20px;
  margin-top: 10px;
}

.preview-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-item label {
  font-size: 14px;
  font-weight: 500;
  color: #4b5563;
}

.preview-image-container {
  height: 120px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
  overflow: hidden;
}

.mini-preview {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.no-image {
  height: 120px;
  border: 1px dashed #d1d5db;
  border-radius: 6px;
  background: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 13px;
}

.cancel-btn {
  padding: 8px 15px;
  border-radius: 6px;
  border: 1px solid #d1d5db;
  background: white;
  color: #4b5563;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn:hover {
  background: #f3f4f6;
}

.save-btn {
  padding: 8px 20px;
  border-radius: 6px;
  border: none;
  background: #8b5cf6;
  color: white;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.save-btn:hover {
  background: #7c3aed;
}

.save-btn:disabled {
  background: #c4b5fd;
  cursor: not-allowed;
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

.status-message.error {
  background: #ef4444;
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

/* 워크플로우 오류 표시 스타일 */
.workflow-error-highlight {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(239, 68, 68, 0.1);
  border: 2px dashed #ef4444;
  border-radius: 8px;
  pointer-events: none;
  z-index: 5;
  animation: pulse-error 2s infinite;
}

@keyframes pulse-error {
  0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
  100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
}

/* 워크플로우 요약 스타일 */
.workflow-summary {
  margin-top: 20px;
  border-top: 1px solid #e5e7eb;
  padding-top: 15px;
}

.workflow-summary label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #4b5563;
  margin-bottom: 10px;
}

.workflow-nodes-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.workflow-node-list {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  padding: 8px 0;
  max-width: 100%;
}

.workflow-node {
  min-width: 80px;
  padding: 8px 12px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  position: relative;
}

.workflow-node:not(:last-child)::after {
  content: '';
  position: absolute;
  right: -12px;
  top: 50%;
  width: 16px;
  height: 2px;
  background: #d1d5db;
  transform: translateY(-50%);
}

.workflow-node i {
  font-size: 16px;
  color: #6b7280;
}

.workflow-node span {
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.start-node-mini {
  background: #0ea5e9;
  border: none;
  color: white;
}

.start-node-mini i, .start-node-mini span {
  color: white;
}

.end-node-mini {
  background: #ef4444;
  border: none;
  color: white;
}

.end-node-mini i, .end-node-mini span {
  color: white;
}

.workflow-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  padding: 8px 12px;
  background: #f9fafb;
  border-radius: 6px;
}

.stat-item {
  display: flex;
  gap: 6px;
  align-items: center;
}

.stat-label {
  font-size: 13px;
  color: #6b7280;
}

.stat-value {
  font-weight: 600;
  color: #111827;
}

.cancel-btn {
  padding: 8px 15px;
  border-radius: 6px;
  border: 1px solid #d1d5db;
  background: white;
  color: #4b5563;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.export-btn {
  padding: 8px 20px;
  border-radius: 6px;
  border: none;
  background: #3b82f6;
  color: white;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}

.export-btn i {
  font-size: 0.9rem;
}

.export-btn:hover {
  background: #2563eb;
  transform: translateY(-1px);
}

.export-btn:disabled {
  background: #93c5fd;
  cursor: not-allowed;
  transform: none;
}

.input-help-text {
  font-size: 12px;
  color: #64748b;
  margin-top: 4px;
  display: block;
  line-height: 1.4;
}

/* 중복 이름 확인 팝업 스타일 */
.duplicate-name-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100000;
  backdrop-filter: blur(5px);
}

.duplicate-name-dialog {
  background: white;
  border-radius: 10px;
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.2);
  width: 90%;
  max-width: 600px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: popup-fade-in 0.3s ease-out;
}

@keyframes popup-fade-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dialog-header {
  padding: 15px 20px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dialog-header h3 {
  margin: 0;
  color: #1e293b;
  font-size: 18px;
  font-weight: 600;
}

.dialog-content {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.dialog-footer {
  padding: 15px 20px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.warning-icon {
  font-size: 2rem;
  color: #ef4444;
}

.ok-btn {
  padding: 8px 20px;
  border-radius: 6px;
  border: none;
  background: #3b82f6;
  color: white;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.ok-btn:hover {
  background: #2563eb;
}

/* 입력 필드 오류 스타일 */
.input-error {
  border-color: #ef4444 !important;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2) !important;
  animation: shake 0.4s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-5px); }
  40%, 80% { transform: translateX(5px); }
}

/* 중복 이름 오류 메시지 스타일 */
.input-error-message {
  color: #ef4444;
  font-size: 14px;
  margin-top: 5px;
}

.input-error-message i {
  margin-right: 5px;
}

/* 선택된 엣지 스타일 */
:deep(.vue-flow__edge.selected) {
  z-index: 1000 !important;
}

:deep(.vue-flow__edge.selected .vue-flow__edge-path) {
  stroke: #8b5cf6 !important;
  stroke-width: 3px !important;
  filter: drop-shadow(0 0 5px rgba(139, 92, 246, 0.7)) !important;
}

:deep(.vue-flow__edge.selected .vue-flow__edge-text) {
  font-weight: bold !important;
}

:deep(.vue-flow__edge:hover .vue-flow__edge-path) {
  stroke: #8b5cf6 !important;
  stroke-width: 2px !important;
  cursor: pointer !important;
}

/* 워크플로우 오류 팝업 스타일 */
.workflow-error-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100000;
  backdrop-filter: blur(5px);
}

.workflow-error-dialog {
  background: white;
  border-radius: 10px;
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.2);
  width: 90%;
  max-width: 600px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: popup-fade-in 0.3s ease-out;
}

.error-icon {
  font-size: 2.5rem;
  color: #ef4444;
  display: flex;
  justify-content: center;
  margin-bottom: 10px;
}

.error-message {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.error-main-message {
  font-size: 18px;
  font-weight: 500;
  color: #ef4444;
  margin: 0 0 5px 0;
}

.error-details {
  background: #fef2f2;
  border-radius: 6px;
  padding: 15px;
  color: #991b1b;
  font-size: 14px;
  line-height: 1.5;
}

.error-tips {
  margin-top: 15px;
  background: #f0f9ff;
  border-radius: 6px;
  padding: 15px;
}

.error-tips h4 {
  margin: 0 0 10px 0;
  color: #0284c7;
  font-size: 16px;
}

.error-tips ul {
  margin: 0;
  padding-left: 20px;
}

.error-tips li {
  margin-bottom: 8px;
  color: #0369a1;
  font-size: 14px;
}
</style> 