<template>
  <div class="msa-component" :class="{ maximized: isMaximized }" tabindex="0" @keydown="handleKeyDown">
    <div class="component-header">
      <div class="header-left">
        <i class="fas fa-image"></i>
        <span>Smart Image Preprocessor</span>
      </div>
      <div class="header-right">
        <button @click="() => { console.log('저장 버튼 클릭됨'); openWorkflowSaveDialog(); }" class="save-btn" :disabled="!canSaveWorkflow || processingStatus !== 'completed'" title="현재 워크플로우 저장">
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
          :style="{ width: '100%', height: 'calc(100% - 40px)' }"
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
              
              <Handle type="target" position="left" />
              <Handle type="source" position="right" />
              
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
                    <div class="node-header">
                      <i :class="node.data?.icon || 'fas fa-cog'"></i>
                      <span>{{ node.data?.label || '처리 노드' }}</span>
                    </div>
                    <div v-if="node.data?.params" class="node-params">
                      <div v-for="(param, key) in node.data.params" :key="key" class="param-item">
                        <span class="param-name">{{ key }}:</span> 
                        <span class="param-value">{{ param.value }}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div class="workflow-node end-node-mini">
                    <i class="fas fa-stop"></i>
                    <span>종료</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="dialog-footer">
            <button class="cancel-btn" @click="cancelSaveWorkflow">취소</button>
            <button class="save-btn" @click="confirmSaveWorkflow">저장</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 워크플로우 오류 팝업 -->
    <Teleport to="body">
      <div class="workflow-error-overlay" v-if="showWorkflowErrorDialog" @click="closeWorkflowErrorDialog">
        <div class="workflow-error-dialog" @click.stop>
          <div class="error-icon">
            <i class="fas fa-exclamation-triangle"></i>
          </div>
          <div class="error-message">
            <div class="error-main-message">{{ workflowErrorTitle }}</div>
            <div class="error-details">{{ workflowErrorMessage }}</div>
            <div class="error-tips">
              <h4>{{ workflowErrorDetails }}</h4>
              <ul>
                <li>{{ workflowErrorDetails }}</li>
              </ul>
            </div>
          </div>
          <div class="error-tips">
            <h4>오류 해결 방법</h4>
            <ul>
              <li>워크플로우 검증 실패: 워크플로우에 노드와 엣지가 올바르게 연결되어 있는지 확인하세요.</li>
              <li>워크플로우 처리 중 오류: 워크플로우 처리 과정에서 발생한 오류를 확인하세요.</li>
              <li>워크플로우 저장 실패: 워크플로우를 저장하는 과정에서 발생한 오류를 확인하세요.</li>
            </ul>
          </div>
          <div class="error-tips">
            <h4>추가 도움이 필요하신가요?</h4>
            <p>워크플로우 설정 및 처리 과정에서 발생한 오류를 해결하는 방법을 알려드리겠습니다.</p>
          </div>
          <div class="dialog-footer">
            <button class="ok-btn" @click="closeWorkflowErrorDialog">확인</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 중복 이름 확인 팝업 -->
    <Teleport to="body">
      <div class="duplicate-name-overlay" v-if="showDuplicateNameDialog" @click="closeDuplicateNameDialog">
        <div class="duplicate-name-dialog" @click.stop>
          <div class="dialog-header">
            <h3>중복 이름 확인</h3>
            <button class="close-btn" @click="closeDuplicateNameDialog">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="dialog-content">
            <div class="warning-icon">
              <i class="fas fa-exclamation-triangle"></i>
            </div>
            <p>{{ newWorkflowName }}은(는) 이미 존재하는 워크플로우 이름입니다.</p>
            <div class="form-group">
              <label for="new-workflow-name">새로운 워크플로우 이름</label>
              <input 
                type="text" 
                id="new-workflow-name" 
                v-model="newWorkflowName" 
                placeholder="새로운 워크플로우 이름을 입력하세요"
                class="workflow-name-input"
                ref="newWorkflowNameInput"
                @keyup.enter="applyNewName"
              >
              <small class="input-help-text">공백은 자동으로 언더스코어(_)로 변환됩니다.</small>
            </div>
          </div>
          <div class="dialog-footer">
            <button class="cancel-btn" @click="closeDuplicateNameDialog">취소</button>
            <button class="ok-btn" @click="applyNewName">저장</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 워크플로우 저장 다이얼로그 -->
    <Teleport to="body">
      <div class="save-workflow-modal" v-if="showSaveWorkflowDialog">
        <div class="save-workflow-content">
          <div class="save-workflow-header">
            <h2>워크플로우 저장</h2>
            <button class="close-btn" @click="showSaveWorkflowDialog = false">&times;</button>
          </div>
          <div class="save-workflow-body">
            <div class="form-group">
              <label for="workflow-name">워크플로우 이름</label>
              <input type="text" id="workflow-name" v-model="workflowName" ref="workflowNameInput" />
            </div>
            
            <div class="workflow-preview">
              <h3>워크플로우 정보</h3>
              <div v-if="getNodeSummary(elements).length > 0" class="workflow-summary">
                <div class="workflow-nodes">
                  <div v-for="(node, index) in getNodeSummary(elements)" :key="index" class="node-summary-item">
                    <div class="node-icon" v-if="node.icon">
                      <i :class="node.icon"></i>
                    </div>
                    <div class="node-info">
                      <div class="node-label">{{ node.label }}</div>
                      <div class="node-params" v-if="node.params && Object.keys(node.params).length > 0">
                        <div v-for="(value, key) in node.params" :key="key" class="param-item">
                          <span class="param-name">{{ key }}:</span>
                          <span class="param-value">{{ value }}</span>
                        </div>
                      </div>
                    </div>
                    <div class="node-connector" v-if="index < getNodeSummary(elements).length - 1">
                      <i class="fas fa-arrow-right"></i>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="no-workflow-data">
                워크플로우 정보가 없습니다.
              </div>
            </div>
          </div>
          <div class="save-workflow-footer">
            <button class="cancel-btn" @click="showSaveWorkflowDialog = false">취소</button>
            <button class="save-btn" @click="saveWorkflowToServer">저장</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, reactive, computed, nextTick, watch } from 'vue'
import { VueFlow, Handle } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import '@/assets/css/msa5_image_lcnc.css'
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
      // MSA6 팝업이 열려있는지 확인
      const msa6Popup = document.querySelector('.image-measurement-popup');
      const isMSA6PopupVisible = msa6Popup && msa6Popup.style.display !== 'none' && msa6Popup.style.visibility !== 'hidden';
      
      // MSA6 팝업이 열려있으면 실행 취소 방지
      if (isMSA6PopupVisible) {
        console.log('MSA6 팝업이 열려있어 실행 취소가 차단되었습니다.');
        return;
      }
      
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
      canSaveWorkflow.value = false; // 워크플로우 변경 시 저장 비활성화
      processingStatus.value = 'idle'; // 저장버튼 비활성화

    }
    
    // 선택한 엣지(연결선) 삭제
    const deleteSelectedEdge = () => {
      if (!selectedEdge.value) return
      
      // 해당 엣지의 ID
      const edgeId = selectedEdge.value.id
      
      //console.log('엣지 삭제 시작:', edgeId)
      
      // 변경 전 상태 저장
      saveToHistory()
      
      // 엣지 삭제
      elements.value = elements.value.filter(el => el.id !== edgeId)
      
      // 선택 해제
      selectedEdge.value = null
      
      // 입력/출력 연결 상태 업데이트
      updateConnections()
      canSaveWorkflow.value = false; // 워크플로우 변경 시 저장 비활성화
      processingStatus.value = 'idle'; // 저장버튼 비활성화

      //console.log('엣지 삭제 완료')
    }

    // 키보드 이벤트 핸들러
    const handleKeyDown = (event) => {
      //   console.log('키보드 이벤트 감지:', event.key, event.ctrlKey);
      //   console.log('키보드 이벤트 상세정보:', {
      //   key: event.key,
      //   code: event.code,
      //   ctrlKey: event.ctrlKey,
      //   metaKey: event.metaKey,
      //   altKey: event.altKey,
      //   shiftKey: event.shiftKey,
      //   target: event.target.tagName,
      //   activeElement: document.activeElement?.tagName
      // });
      
      // Escape 키는 이미지 프리뷰 닫기
      if (event.key === 'Escape' && previewImageUrl.value) {
        closeImagePreview();
        return;
      }
      
      // Delete 키로 선택된 노드 삭제
      if (event.key === 'Delete' && selectedNode.value) {
        //console.log('Delete 키 감지 - 노드 삭제 실행');
        deleteSelectedNode();
        return;
      }
      
      // Delete 키로 선택된 엣지 삭제
      if (event.key === 'Delete' && selectedEdge.value) {
        //console.log('Delete 키 감지 - 엣지 삭제 실행');
        deleteSelectedEdge();
        return;
      }
      
      // Ctrl+Z: 실행 취소
      if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
        //console.log('Ctrl+Z 감지 - 실행 취소 실행');
        undo();
        event.preventDefault();
        return;
      }
      
      // Ctrl+Y: 다시 실행
      if ((event.ctrlKey || event.metaKey) && event.key === 'y') {
        //console.log('Ctrl+Y 감지 - 다시 실행 실행');
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
        canSaveWorkflow.value = false; // 워크플로우 변경 시 저장 비활성화
        processingStatus.value = 'idle'; // 저장버튼 비활성화

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
      
      // 백엔드에서 제공하는 options 정보 추출
      const backendOptions = params.options || {}
      
      // 파라미터 형식 변환 및 메타데이터 추가
      Object.entries(params).forEach(([key, value]) => {
        // options 필드는 메타데이터이므로 파라미터로 처리하지 않음
        if (key === 'options') {
          return
        }
        
        let paramConfig = {
          value: value,
          label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
          min: 0,
          max: 1000,
          step: 1
        }
        
        // 백엔드에서 제공하는 옵션이 있는지 확인
        if (backendOptions[key] && Array.isArray(backendOptions[key])) {
          paramConfig.options = backendOptions[key]
        } else {
          // 파라미터 타입에 따른 특수 설정 (기존 로직 유지)
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
        }
        
        result[key] = paramConfig
      })
      
      return result
    }

    // 최대화 버튼 토글
    const toggleMaximize = () => {
      isMaximized.value = !isMaximized.value
    }

    // 최대화 상태 변경 시 부모 컨테이너의 position 조정
    watch(isMaximized, (newVal) => {
      const component = document.querySelector('.msa5');
      if (component && component.parentElement) {
        if (newVal) {
          // 최대화 시: 부모에 relative position 적용
          component.parentElement.style.position = 'relative';
          component.parentElement.style.zIndex = '9999';
        } else {
          // 최대화 해제 시: 원래 스타일로 복원
          component.parentElement.style.position = '';
          component.parentElement.style.zIndex = '';
        }
      }
    }, { immediate: false })

    // VueFlow 초기화
    const onInit = (instance) => {
      flowInstance.value = instance
      //console.log('VueFlow initialized')
    }

    // 패널 준비 완료 이벤트 핸들러
    const onPaneReady = (instance) => {
      //console.log('VueFlow pane ready')
      if (instance) {
        instance.fitView({ padding: 0.2, duration: 200 })
      }
    }

    // 노드 드래그 종료 이벤트 핸들러
    const onNodeDragStop = (event) => {
      //console.log('Node dragged:', event.node.id)
    }

    // 노드 클릭 이벤트 핸들러
    const onNodeClick = (event) => {
      const { node } = event
      // console.log('노드 클릭:', node.id, '마우스 위치:', { 
      //   clientX: event.event?.clientX, 
      //   clientY: event.event?.clientY,
      //   screenX: event.event?.screenX, 
      //   screenY: event.event?.screenY 
      // });
      
      // 엣지 선택 해제
      selectedEdge.value = null;
      
      if (node && node.type && node.type !== 'smoothstep' && node.data && node.id !== 'start' && node.id !== 'end') {
        if (!node.data.params) {
          console.warn(`Node ${node.id} data is missing params object. Initializing.`)
          node.data.params = getDefaultParams(node.data.id, defaultOptions.value)
        }
        
        selectedNode.value = node
        //console.log('Node selected:', selectedNode.value);
        
        // 패널 위치 디버깅 로그
        setTimeout(() => {
          const panelEl = document.querySelector('.options-panel');
          const componentEl = document.querySelector('.msa-component');
          
          if (panelEl && componentEl) {
            // console.log('옵션 패널 위치 정보:', {
            //   panel: {
            //     offsetTop: panelEl.offsetTop,
            //     offsetLeft: panelEl.offsetLeft,
            //     offsetWidth: panelEl.offsetWidth,
            //     offsetHeight: panelEl.offsetHeight,
            //     clientRect: panelEl.getBoundingClientRect()
            //   },
            //   component: {
            //     isMaximized: isMaximized.value,
            //     clientRect: componentEl.getBoundingClientRect()
            //   },
            //   windowSize: {
            //     innerWidth: window.innerWidth,
            //     innerHeight: window.innerHeight
            //   }
            // });
          }
        }, 10);
      } else {
        selectedNode.value = null
        //console.log('Node deselected or invalid node clicked.')
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
      //console.log('Edge selected:', selectedEdge.value);
      
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
      
      // MSA6 측정 결과 초기화 이벤트 발생 (프로세스 시작 시 즉시)
      try {
        // console.log('[processStart] MSA6 측정 결과 초기화 이벤트 발생');
        const clearEvent = new CustomEvent('msa5-process-start', {
          detail: {
            timestamp: Date.now(),
            action: 'clear_measurements'
          },
          bubbles: true,
          cancelable: true
        });
        
        document.dispatchEvent(clearEvent);
        window.dispatchEvent(clearEvent);
        
        // 세션 스토리지에도 플래그 설정
        sessionStorage.setItem('msa5_process_started', 'true');
        
        // console.log('[processStart] MSA6 측정 결과 초기화 이벤트 발생 완료');
      } catch (error) {
        console.error('[processStart] MSA6 초기화 이벤트 발생 실패:', error);
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
        
        // 오류 메시지 상세화
        const errorMessage = error.message || '알 수 없는 오류';
        statusMessage.value = `처리 오류: ${errorMessage}`;
        
        // 상세 오류 정보 팝업 표시
        showWorkflowErrorDialog.value = true;
        workflowErrorTitle.value = '워크플로우 처리 오류';
        workflowErrorMessage.value = `워크플로우 처리 중 오류가 발생했습니다: ${errorMessage}`;
        
        // 특정 패턴의 오류에 대한 힌트 제공
        if (errorMessage.includes('API 응답 오류')) {
          workflowErrorDetails.value = '백엔드 API 호출 중 오류가 발생했습니다. 노드 타입이나 파라미터가 올바른지 확인하세요.';
        } else if (errorMessage.includes('not found') || errorMessage.includes('404')) {
          workflowErrorDetails.value = '요청한 리소스를 찾을 수 없습니다. 백엔드 서버가 실행 중인지 확인하세요.';
        } else if (errorMessage.includes('network') || errorMessage.includes('연결')) {
          workflowErrorDetails.value = '네트워크 연결 오류가 발생했습니다. 인터넷 연결 상태를 확인하세요.';
        } else {
          workflowErrorDetails.value = '워크플로우 실행 중 예상치 못한 오류가 발생했습니다. 개발자 콘솔에서 자세한 정보를 확인하세요.';
        }
        
        showStatusMessage.value = true;
        setTimeout(() => { showStatusMessage.value = false }, 5000);
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
        
        // 노드로 들어오는 연결 개수 확인
        const incomingConnections = connections.filter(conn => conn.target === nodeId)
        
        // 이미지 병합 노드 확인 (여러 조건으로 검증)
        const isMergeNode = node.type === 'merge' || 
                           (node.data && node.data.id === 'merge') ||
                           (node.data && node.data.label && node.data.label.includes('병합')) ||
                           (node.data && node.data.label && node.data.label.includes('merge')) ||
                           (node.id && node.id.includes('merge')) ||
                           (node.name && node.name.includes('merge'))
        
        if (isMergeNode) {
          // 병합 노드는 하나의 핸들에 여러 입력 허용, 하지만 최소 2개 이상 필요
          if (incomingConnections.length < 2) {
            return {
              valid: false,
              message: `이미지 병합 노드에 입력이 부족합니다.`,
              details: `병합 노드 '${node.data?.label || nodeId}'는 최소 2개 이상의 입력이 필요합니다. 현재 ${incomingConnections.length}개 입력만 연결되어 있습니다. 하나의 입력 핸들에 여러 연결선을 연결할 수 있습니다.`
            }
          }
          
          // 병합 노드의 최대 입력 개수 확인 (5개로 제한)
          if (incomingConnections.length > 5) {
            return {
              valid: false,
              message: `이미지 병합 노드의 입력이 너무 많습니다.`,
              details: `병합 노드 '${node.data?.label || nodeId}'는 최대 5개까지의 입력만 허용됩니다. 현재 ${incomingConnections.length}개 입력이 연결되어 있습니다. 일부 연결을 제거해주세요.`
            }
          }
        } else {
          // 일반 노드는 하나의 입력만 허용 (시작/종료 노드 제외)
          if (nodeId !== 'start' && nodeId !== 'end' && incomingConnections.length > 1) {
            return {
              valid: false,
              message: `노드에 여러 입력이 연결되어 있습니다.`,
              details: `노드 '${node.data?.label || nodeId}'는 하나의 입력만 허용됩니다. 현재 ${incomingConnections.length}개 입력이 연결되어 있습니다. 여러 이미지를 병합하려면 이미지 병합 노드를 사용하세요.`
            }
          }
          
          // 일반 노드는 최소 하나의 입력 필요 (시작 노드 제외)
          if (nodeId !== 'start' && incomingConnections.length === 0) {
            return {
              valid: false,
              message: `노드에 입력이 연결되어 있지 않습니다.`,
              details: `노드 '${node.data?.label || nodeId}'에 입력을 연결해주세요.`
            }
          }
        }
        
        // 노드에서 나가는 연결 개수 확인 (모든 노드는 여러 출력 분기 허용)
        const outgoingConnections = connections.filter(conn => conn.source === nodeId)
        
        // 종료 노드를 제외한 모든 노드는 최소 하나의 출력 필요
        if (nodeId !== 'end' && outgoingConnections.length === 0) {
          return {
            valid: false,
            message: `노드에서 나가는 연결이 없습니다.`,
            details: `노드 '${node.data?.label || nodeId}'에서 다른 노드로의 연결을 추가해주세요.`
          }
        }
      }
      
      // 6. 연결 경로 확인 (시작 -> 종료)
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
        //console.log(`[processNode] 노드 ${node.id} 처리 시작, 타입: ${node.data?.nodeId || node.data?.id || node.type}`);
        
        // 노드에 파라미터가 없으면 기본값 설정
        if (!node.data?.params) {
          console.warn(`[processNode] 노드 ${node.id}에 파라미터가 없습니다. 기본값 사용`);
          node.data.params = getDefaultParams(node.data?.nodeId || node.data?.id || node.type, defaultOptions.value);
        }
        
        // 노드 타입 추출 (우선순위: nodeId > id > type > label)
        let nodeType = node.data?.nodeId || node.data?.id || node.data?.type || 'custom';
        let originalNodeType = nodeType; // 디버깅을 위해 원본 타입 저장
        
        // SAM2 노드 특별 처리 - 조기 감지
        if (node.data?.label && (node.data.label.includes('SAM2') || node.data.label.includes('세그멘테이션'))) {
          console.log(`[processNode] SAM2 노드 조기 감지 - 라벨: ${node.data.label}`);
          nodeType = 'sam2';
          originalNodeType = node.data.label;
        }
        
        console.log(`[processNode] 노드 처리 시작 - ID: ${node.id}, 라벨: ${node.data?.label}, 초기 타입: ${nodeType}`);
        
        // // 노드 데이터 전체 디버깅
        // console.log(`[processNode] 노드 상세 정보:`, {
        //   id: node.id,
        //   type: node.type,
        //   data: {
        //     nodeId: node.data?.nodeId,
        //     id: node.data?.id,
        //     label: node.data?.label,
        //     params: node.data?.params ? Object.keys(node.data.params) : 'none'
        //   }
        // });
        
        // 1. 항상 노드 ID에서 타입 추출 시도 (불러온 워크플로우에서 가장 확실한 방법)
        if (typeof node.id === 'string' && node.id.includes('_')) {
          const idParts = node.id.split('_');
          console.log(`[processNode] 노드 ID 분석: ${node.id} -> parts:`, idParts);
          
          // 마지막 두 부분이 숫자인지 확인 (타임스탬프와 랜덤 숫자로 추정)
          const lastPart = idParts[idParts.length - 1];
          const secondLastPart = idParts[idParts.length - 2];
          
          if (/^\d+$/.test(lastPart) && /^\d+$/.test(secondLastPart)) {
            // 마지막 두 부분(타임스탬프와 랜덤)을 제외한 ID 부분을 타입으로 사용
            const typeFromId = idParts.slice(0, -2).join('_');
            if (typeFromId) {
              nodeType = typeFromId;
              console.log(`[processNode] 노드 ID에서 타입 추출 (두 숫자): ${typeFromId}`);
            }
          } else if (/^\d+$/.test(lastPart)) {
            // 마지막 부분만 숫자인 경우
            const typeFromId = idParts.slice(0, -1).join('_');
            if (typeFromId) {
              nodeType = typeFromId;
              console.log(`[processNode] 노드 ID에서 타입 추출 (한 숫자): ${typeFromId}`);
            }
          } else {
            // 숫자가 없는 경우 전체를 타입으로 사용
            nodeType = node.id;
            console.log(`[processNode] 노드 ID 전체를 타입으로 사용: ${nodeType}`);
          }
        }
        
        // 2. 불러온 워크플로우에서 노드 타입이 손실된 경우에만 추가 복구 시도
        if (nodeType === 'custom' || !nodeType || nodeType === 'undefined') {
          // 노드 이름(name) 속성에서 타입 추출 시도
          if (node.name && typeof node.name === 'string') {
            if (node.name.includes('_')) {
              const nameParts = node.name.split('_');
              const lastPart = nameParts[nameParts.length - 1];
              if (/^\d+$/.test(lastPart)) {
                const typeFromName = nameParts.slice(0, -1).join('_');
                if (typeFromName) {
                  nodeType = typeFromName;
                  console.log(`[processNode] 노드 이름에서 타입 복구: ${typeFromName}`);
                }
              }
            } else {
              nodeType = node.name;
              console.log(`[processNode] 노드 이름을 타입으로 사용: ${nodeType}`);
            }
          }
        }
        
        // 3. 노드 ID에서 타입 추출 시도 (기존 로직 강화)
        if ((nodeType === 'custom' || !nodeType) && typeof node.id === 'string' && node.id.includes('_')) {
          const idParts = node.id.split('_');
          // ID의 마지막 부분이 숫자인지 확인 (타임스탬프로 추정)
          const lastPart = idParts[idParts.length - 1];
          if (/^\d+$/.test(lastPart)) {
            // 마지막 부분(타임스탬프)을 제외한 ID 부분을 타입으로 사용
            const typeFromId = idParts.slice(0, -1).join('_');
            if (typeFromId) {
              nodeType = typeFromId;
              console.log(`[processNode] ID에서 추출한 타입으로 대체: ${nodeType}`);
            }
          }
        }
        
        // 한글 라벨에서 타입 추출 시도
        if ((nodeType === 'custom' || !nodeType) && node.data?.label) {
          const koreanLabelMap = {
            '미디언 필터': 'median_filter',
            '미디안 필터': 'median_filter',
            '감마 보정': 'gamma',
            '히스토그램 평활화': 'histogram_equalization',
            '히스토그램': 'histogram_equalization',
            '가우시안 블러': 'gaussian_blur',
            '블러': 'gaussian_blur',
            '비등방성 확산': 'anisotropic_diffusion',
            '비등방성 확산 필터': 'anisotropic_diffusion',
            '비등방성 필터': 'anisotropic_diffusion',
            '비등방성': 'anisotropic_diffusion',
            '이진화': 'threshold',
            '밝기 조정': 'brightness',
            '밝기': 'brightness',
            '대비 조정': 'contrast',
            '대비': 'contrast',
            '객체 검출': 'object_detection',
            '객체 감지': 'object_detection',
            '적응형 히스토그램 평활화': 'clahe',
            'CLAHE': 'clahe',
            '샤프닝': 'sharpen',
            '샤프': 'sharpen',
            '그레이스케일': 'grayscale',
            '회색조': 'grayscale',
            '정규화': 'normalize',
            '이미지 병합': 'merge',
            '병합': 'merge',
            'SAM2 세그멘테이션': 'sam2',
            'SAM2': 'sam2',
            '세그멘테이션': 'sam2'
          };
          
          if (koreanLabelMap[node.data.label]) {
            //console.log(`[processNode] 한글 라벨에서 타입 추출: '${node.data.label}' -> ${koreanLabelMap[node.data.label]}`);
            nodeType = koreanLabelMap[node.data.label];
          }
        }
        
        // 기본적인 호환성 매핑 적용
        const basicTypeMap = {
          'median': 'median_filter',
          'blur': 'gaussian_blur',
          'gaussian': 'gaussian_blur',
          'gamma_correction': 'gamma',
          'gamma': 'gamma',
          'anisotropic': 'anisotropic_diffusion',
          'anisotropic_diffusion_filter': 'anisotropic_diffusion',
          'anisotropic_filter': 'anisotropic_diffusion',
          'histogram_eq': 'histogram_equalization',
          'hist_eq': 'histogram_equalization',
          'histogram': 'histogram_equalization',
          'histogram_equalization': 'histogram_equalization',
          'threshold': 'threshold',
          'brightness': 'brightness',
          'contrast': 'contrast',
          'clahe': 'clahe',
          'object_detection': 'object_detection',
          'object-detection': 'object_detection',
          'object': 'object_detection',
          'sharpen': 'sharpen',
          'grayscale': 'grayscale',
          'normalize': 'normalize',
          'merge': 'merge',
          'sam2': 'sam2',
          'segmentation': 'sam2',
          'segment': 'sam2',
          'SAM2': 'sam2',
          'opening': 'opening',
          'closing': 'closing',
          'hrnet': 'hrnet',
          'unet_attention': 'unet_attention',
          'unet-attention': 'unet_attention',
          'unet+attention': 'unet_attention',
        };
        
        // 필요한 경우에만 타입 변환 (호환성 이슈가 있는 타입만)
        if (basicTypeMap[nodeType]) {
          //console.log(`[processNode] 노드 타입 매핑 적용: ${nodeType} -> ${basicTypeMap[nodeType]}`);
          nodeType = basicTypeMap[nodeType];
        }
        
        console.log(`[processNode] 최종 API 요청 타입: ${nodeType} (원본: ${originalNodeType})`);
        
        // 지원되는 노드 타입인지 확인 및 404 오류 방지를 위한 강화된 검증
        const supportedNodeTypes = [
          'median_filter', 'gaussian_blur', 'gamma', 'anisotropic_diffusion',
          'histogram_equalization', 'threshold', 'brightness', 'contrast',
          'clahe', 'object_detection', 'blur', 'sharpen', 'grayscale', 'normalize', 'merge', 'sam2',
          'opening', 'closing', 'hrnet', 'unet_attention'
        ];
        
        if (!supportedNodeTypes.includes(nodeType)) {
          console.warn(`[processNode] 지원되지 않는 노드 타입: ${nodeType}, 지원되는 타입 목록:`, supportedNodeTypes);
          console.warn(`[processNode] 노드 정보 - ID: ${node.id}, 라벨: ${node.data?.label}, 원본 타입: ${originalNodeType}`);
          
          // custom 대신 오류를 발생시켜 더 명확한 디버깅 가능
          throw new Error(`지원되지 않는 노드 타입: ${nodeType}. 지원되는 타입: ${supportedNodeTypes.join(', ')}`);
        }
        
        // 404 오류 방지를 위한 추가 검증
        if (!nodeType || nodeType === 'undefined' || nodeType === 'null') {
          console.error(`[processNode] 유효하지 않은 노드 타입이 감지됨: '${nodeType}'`);
          throw new Error(`유효하지 않은 노드 타입: ${nodeType}`);
        }
        
        const params = {};
        
        // 파라미터 객체 구성
        if (node.data?.params) {
          Object.entries(node.data.params).forEach(([key, param]) => {
            params[key] = param.value;
          });
        }
        
        //console.log(`[processNode] API 요청 준비: ${node.id}, 타입: ${nodeType}`, params);
        
        // 입력 이미지 URL에서 이미지 형식 추출 (가능한 경우)
        let imageFormat = null;
        if (inputImage) {
          // URL에서 파일 확장자 추출 시도
          try {
            const fileExtMatch = inputImage.match(/\.([^.?]+)(?:\?|$)/);
            if (fileExtMatch && fileExtMatch[1]) {
              imageFormat = fileExtMatch[1].toLowerCase();
              //console.log(`[processNode] 입력 이미지 형식 감지: ${imageFormat}`);
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
            //console.log(`[processNode] Content-Type에서 이미지 형식 감지: ${imageFormat}`);
          }
        }
        
        const blob = await response.blob();
        
        // Blob 타입에서 형식 확인 (우선순위 높음)
        if (blob.type && blob.type.startsWith('image/') && (!imageFormat || blob.type !== `image/${imageFormat}`)) {
          const formatFromBlob = blob.type.split('/')[1];
          if (formatFromBlob) {
            imageFormat = formatFromBlob.toLowerCase();
            //console.log(`[processNode] Blob 타입에서 이미지 형식 감지: ${imageFormat}`);
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
          //console.log(`[processNode] 원본 이미지 형식 파라미터 추가: ${imageFormat}`);
        }
        
        // 백엔드 API 호출 - 노드 타입에 맞는 엔드포인트 사용
        const apiUrl = `http://localhost:8000/api/msa5/work/${nodeType}`;
        //console.log(`[processNode] 요청 URL: ${apiUrl}, 파일명: ${fileName}`);
        //console.log(`[processNode] 노드 타입 확인 - 최종: ${nodeType}, 원본: ${originalNodeType}`);
        
        // SAM2 노드의 경우 추가 로깅
        if (nodeType === 'sam2') {
          console.log(`[processNode] SAM2 API 요청:`, {
            url: apiUrl,
            params: params,
            fileName: fileName,
            imageFormat: imageFormat
          });
          
          // SAM2 파라미터 검증
          if (!params.hasOwnProperty('model_size')) {
            console.warn(`[processNode] SAM2 model_size 파라미터가 없습니다. 기본값 사용`);
          }
          if (!params.hasOwnProperty('automatic_mask')) {
            console.warn(`[processNode] SAM2 automatic_mask 파라미터가 없습니다. 기본값 사용`);
          }
          
          console.log(`[processNode] SAM2 파라미터 상세:`, {
            model_size: params.model_size || 'large',
            automatic_mask: params.automatic_mask !== undefined ? params.automatic_mask : true,
            points: params.points || [],
            point_labels: params.point_labels || [],
            boxes: params.boxes || []
          });
        }
        
        try {
          const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            body: formData
          });
    
        if (!apiResponse.ok) {
          const errorText = await apiResponse.text();
          console.error(`[processNode] API 응답 오류 (${apiResponse.status}): ${errorText}`);
          console.error(`[processNode] 응답 헤더:`, Object.fromEntries([...apiResponse.headers]));
          
          // SAM2 노드의 경우 더 구체적인 오류 메시지
          if (nodeType === 'sam2') {
            console.error(`[processNode] SAM2 API 호출 실패:`, {
              status: apiResponse.status,
              statusText: apiResponse.statusText,
              url: apiUrl,
              errorText: errorText
            });
            
            if (apiResponse.status === 500) {
              throw new Error(`SAM2 모델 로딩 오류: ${errorText}. SAM2 모델이 설치되어 있는지 확인하세요.`);
            } else if (apiResponse.status === 422) {
              throw new Error(`SAM2 파라미터 오류: ${errorText}. 노드 설정을 확인하세요.`);
            }
          }
          
          throw new Error(`API 응답 오류 (${apiResponse.status}): ${errorText}`);
        }
        
        // 헤더에서 이미지 형식 확인 (X-Image-Format 헤더 확인)
        let outputFormat = 'png'; // 기본값
        const formatHeader = apiResponse.headers.get('X-Image-Format');
        if (formatHeader) {
          outputFormat = formatHeader.toLowerCase();
          if (outputFormat === 'jpeg') outputFormat = 'jpg';
          //console.log(`[processNode] 응답 헤더에서 이미지 형식 감지: ${outputFormat} (X-Image-Format)`);
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
          //console.log(`[processNode] 응답 Content-Type: ${responseContentType}, 감지된 출력 형식: ${outputFormat}`);
        }
        
        // 응답에서 이미지 데이터 추출
        const imageBlob = await apiResponse.blob();
        
        // Blob 타입을 확인하여 출력 형식 재확인
        if (imageBlob.type && imageBlob.type.startsWith('image/')) {
          const blobFormat = imageBlob.type.split('/')[1];
          if (blobFormat) {
            outputFormat = blobFormat.toLowerCase();
            if (outputFormat === 'jpeg') outputFormat = 'jpg';
            //console.log(`[processNode] Blob에서 재확인된 출력 형식: ${outputFormat}`);
          }
        }
        
        // 적절한 확장자 포함하여 URL 생성
        const processedImageUrl = URL.createObjectURL(imageBlob);
        
        // 파일명 생성 (타임스탬프 + 형식)
        const timestamp = Date.now();
        const outputFilename = `processed_${timestamp}.${outputFormat}`;
        
        // 이미지 형식 정보를 세션 스토리지에 저장 (임시, 노드별로)
        sessionStorage.setItem(`msa5_node_${node.id}_format`, outputFormat);
        
        // SAM2 노드 처리 완료 로깅
        if (nodeType === 'sam2') {
          console.log(`[processNode] SAM2 노드 ${node.id} 처리 완료:`, {
            outputFormat: outputFormat,
            outputFilename: outputFilename,
            imageUrl: processedImageUrl.substring(0, 50) + '...'
          });
        }
        
        //console.log(`[processNode] 노드 ${node.id} 처리 완료, 출력 형식: ${outputFormat}, 파일명: ${outputFilename}`);
        return processedImageUrl;
        } catch (apiError) {
          console.error(`[processNode] API 호출 중 오류 발생:`, apiError);
          
          // 네트워크 오류 처리
          if (apiError.name === 'TypeError' && apiError.message.includes('fetch')) {
            if (nodeType === 'sam2') {
              throw new Error(`SAM2 API 서버에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인하세요. (${apiUrl})`);
            } else {
              throw new Error(`API 서버에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인하세요. (${apiUrl})`);
            }
          }
          
          // CORS 오류 처리
          if (apiError.message.includes('CORS')) {
            throw new Error(`CORS 오류: 백엔드 서버의 CORS 설정을 확인하세요.`);
          }
          
          // SAM2 특화 오류 처리
          if (nodeType === 'sam2') {
            if (apiError.message.includes('sam2') || apiError.message.includes('SAM2')) {
              throw new Error(`SAM2 처리 오류: ${apiError.message}`);
            }
          }
          
          throw apiError;
        }
      } catch (error) {
        console.error(`[processNode] 노드 ${node.id} 처리 중 오류:`, error);
        // 오류 정보를 더 자세히 표시
        showWorkflowErrorDialog.value = true;
        workflowErrorTitle.value = '노드 처리 오류';
        workflowErrorMessage.value = `노드 '${node.data?.label || node.id}' (타입: ${node.data?.nodeId || node.data?.id}) 처리 중 오류가 발생했습니다.`;
        workflowErrorDetails.value = error.message || '알 수 없는 오류';
        throw error;
      }
    }
    
    // 병합 노드 처리 함수
    const processMergeNode = async (node) => {
      try {
        //console.log(`[processMergeNode] 병합 노드 ${node.id} 처리 시작`);
        
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
              //console.log(`[processMergeNode] 노드 스토리지에서 형식 감지: ${primaryImageFormat}`);
            }
            
            // 이미지 URL에서 형식 추출 시도
            if (!primaryImageFormat) {
            try {
              const fileExtMatch = sourceImage.match(/\.([^.?]+)(?:\?|$)/);
              if (fileExtMatch && fileExtMatch[1]) {
                // 첫 번째 이미지 형식을 추적
                if (primaryImageFormat === null) {
                  primaryImageFormat = fileExtMatch[1].toLowerCase();
                  //console.log(`[processMergeNode] 주요 이미지 형식 설정: ${primaryImageFormat}`);
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
                //console.log(`[processMergeNode] Content-Type에서 형식 감지: ${primaryImageFormat}`);
              }
            }
            
            const blob = await response.blob();
            
            // Blob 타입에서 형식 확인 (더 정확함)
            if (blob.type && blob.type.startsWith('image/')) {
              const formatFromBlob = blob.type.split('/')[1];
              // 주요 형식이 없으면 첫 번째 이미지의 형식을 사용
              if (formatFromBlob && primaryImageFormat === null) {
                primaryImageFormat = formatFromBlob.toLowerCase();
                //console.log(`[processMergeNode] Blob 타입에서 주요 이미지 형식 설정: ${primaryImageFormat}`);
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
          //console.log(`[processMergeNode] 원본 이미지 형식 파라미터 추가: ${primaryImageFormat}`);
        }
        
        //console.log(`[processMergeNode] 병합 API 요청 준비, 출력 형식: ${primaryImageFormat || 'png'}`);
        
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
          //console.log(`[processMergeNode] 응답 헤더에서 이미지 형식 감지: ${outputFormat} (X-Image-Format)`);
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
          //console.log(`[processMergeNode] 응답 Content-Type: ${responseContentType}, 감지된 출력 형식: ${outputFormat}`);
        }
        
        // 응답에서 이미지 데이터 추출
        const imageBlob = await apiResponse.blob();
        
        // Blob 타입 확인
        if (imageBlob.type && imageBlob.type.startsWith('image/')) {
          const blobFormat = imageBlob.type.split('/')[1];
          if (blobFormat) {
            outputFormat = blobFormat.toLowerCase();
            if (outputFormat === 'jpeg') outputFormat = 'jpg';
            //console.log(`[processMergeNode] Blob에서 재확인된 출력 형식: ${outputFormat}`);
          }
        }
        
        const processedImageUrl = URL.createObjectURL(imageBlob);
        
        // 형식 정보를 세션 스토리지에 저장
        sessionStorage.setItem(`msa5_node_${node.id}_format`, outputFormat);
        
        //console.log(`[processMergeNode] 병합 노드 ${node.id} 처리 완료, 출력 형식: ${outputFormat}`);
        return processedImageUrl;
      } catch (error) {
        console.error(`[processMergeNode] 병합 노드 ${node.id} 처리 중 오류:`, error);
        throw error;
      }
    }
    
    // 워크플로우 실제 처리 함수
    const processWorkflow = async () => {
      try {
        // 처리 큐 초기화
        const queue = []
        const visited = new Set(['start']) // 시작 노드 방문 표시
        
        // 입력 이미지 처리
        processedImages['start'] = inputImage.value
        
        // 세션 스토리지에 시작 이미지 URL 저장
        sessionStorage.setItem('msa5_start_image_url', inputImage.value);
        //console.log('MSA5: 세션 스토리지에 시작 이미지 URL 저장:', inputImage.value.substring(0, 30) + '...');
        
        // 연결 관계 확인 - 간선 처리 준비
        const graph = {}
        elements.value.filter(el => el.type !== 'smoothstep').forEach(node => {
          graph[node.id] = []
        })
        
        elements.value.filter(el => el.type === 'smoothstep').forEach(conn => {
          if (!graph[conn.source]) graph[conn.source] = []
          graph[conn.source].push(conn.target)
        })
        
        //console.log('[processWorkflow] 노드 그래프 구성:', graph);
        
        // BFS 큐 초기화 - 시작 노드의 모든 연결 추가
        for (const nodeId of graph['start']) {
          queue.push(nodeId)
        }
        
        // BFS 처리 - 레벨별로 모든 노드 처리
        while (queue.length > 0) {
          const batchSize = queue.length // 현재 레벨의 노드 수
          const currentBatch = queue.splice(0, batchSize) // 현재 레벨의 노드 추출
          
          //console.log(`[processWorkflow] 현재 처리 배치 (${currentBatch.length}개 노드):`, currentBatch);
          
          // 현재 레벨의 노드 모두 병렬 처리
          const processingPromises = []
          
          for (const nodeId of currentBatch) {
            if (visited.has(nodeId)) continue // 이미 방문한 노드 건너뛰기
            
            const node = elements.value.find(el => el.id === nodeId)
            if (!node) {
              console.error(`[processWorkflow] 노드 ID ${nodeId}에 해당하는 노드가 없습니다.`);
              continue
            }
            
            //console.log(`[processWorkflow] 노드 처리 시작: ${nodeId}, 타입: ${node.data?.nodeId || node.data?.id}`);
            
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
              //console.log(`[processWorkflow] 종료 노드 처리 - 이미지 전달`);
            } else if (node.data?.nodeId === 'merge' || node.data?.id === 'merge') {
              // 병합 노드 처리
              //console.log(`[processWorkflow] 병합 노드 처리 시작: ${nodeId}`);
              processingPromise = processMergeNode(node);
            } else if (node.data?.nodeId === 'sam2' || node.data?.id === 'sam2' || node.data?.label?.includes('SAM2')) {
              // SAM2 세그멘테이션 노드 처리
              console.log(`[processWorkflow] SAM2 노드 처리 시작: ${nodeId}, 라벨: ${node.data?.label}`);
              processingPromise = processNode(node, inputImage);
            } else {
              // 일반 노드 처리
              //console.log(`[processWorkflow] 일반 노드 처리 시작: ${nodeId}, 타입: ${node.data?.nodeId || node.data?.id}`);
              processingPromise = processNode(node, inputImage);
            }
            
            // 노드 처리 결과를 저장
            processingPromises.push(
              processingPromise.then(processedImage => {
                if (processedImage) {
                  processedImages[nodeId] = processedImage;
                  visited.add(nodeId);
                  //console.log(`[processWorkflow] 노드 ${nodeId} 처리 완료, 결과 이미지 저장됨`);
                  
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
          //console.log(`[processWorkflow] 현재 배치의 ${processingPromises.length}개 노드 처리 대기 중...`);
          const results = await Promise.all(processingPromises);
          //console.log(`[processWorkflow] 배치 처리 완료, 결과:`, results.filter(Boolean));
        }
        
        //console.log('[processWorkflow] 모든 노드 처리 완료');
        //console.log('[processWorkflow] 처리된 이미지:', Object.keys(processedImages));
        
        // 최종 결과 처리 - 측정 결과가 있을 경우 MSA6으로 전달
        if (processedImages['end']) {
          //console.log('[processWorkflow] 종료 노드의 이미지 데이터가 있습니다. 결과 처리 준비');
          //console.log('[processWorkflow] 최종 이미지 URL:', processedImages['end'].substring(0, 30) + '...');
          
          // 세션 스토리지에 시작 및 종료 이미지 URL 저장
          sessionStorage.setItem('msa5_start_image_url', processedImages['start']);
          sessionStorage.setItem('msa5_end_image_url', processedImages['end']);
          //console.log('[processWorkflow] 세션 스토리지에 이미지 URL 저장 완료 - 시작/종료 이미지');
          
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
              //console.log(`[processWorkflow] 소스 노드(${sourceNodeId})의 형식 정보 사용: ${imageFormat}`);
            }
          }
          
          // 2. 이미지가 데이터 URL 형식인 경우 형식 추출
          if (processedImages['end'].startsWith('data:image/')) {
            const formatMatch = processedImages['end'].match(/data:image\/([a-z0-9]+);base64,/i);
            if (formatMatch && formatMatch[1]) {
              imageFormat = formatMatch[1].toLowerCase();
              if (imageFormat === 'jpeg') imageFormat = 'jpg';
              //console.log(`[processWorkflow] 데이터 URL에서 이미지 형식 감지: ${imageFormat}`);
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
                //console.log(`[processWorkflow] Content-Type에서 이미지 형식 감지: ${imageFormat}`);
              }
            }
            
            // Blob에서 형식 확인
            const blob = await response.blob();
            if (blob.type && blob.type.startsWith('image/')) {
              const formatFromBlob = blob.type.split('/')[1].toLowerCase();
              if (formatFromBlob) {
                imageFormat = formatFromBlob;
                if (imageFormat === 'jpeg') imageFormat = 'jpg';
                //console.log(`[processWorkflow] Blob에서 이미지 형식 감지: ${imageFormat}`);
              }
            }
          } catch (e) {
            console.warn('[processWorkflow] Blob 형식 감지 중 오류:', e);
          }
          
          // 이미지 형식을 세션 스토리지에 저장
          sessionStorage.setItem('msa5_end_image_format', imageFormat);
          //console.log(`[processWorkflow] 이미지 형식 정보 저장: ${imageFormat}`);
          
          // MSA6로 이미지 전송 (여러 번 시도)
          //console.log('[processWorkflow] MSA6로 이미지 전송 시작...');
          
          // 먼저 MSA5 처리 상태 설정 (MSA6가 이 값을 확인함)
          sessionStorage.setItem('msa5_end_image', 'true');
          
          // 약간의 지연 후 첫 번째 시도 (렌더링 시간 고려)
          setTimeout(() => {
            let msa6SendSuccess = false;
            
            // 첫 번째 시도
            msa6SendSuccess = sendImageToMSA6(processedImages['end'], imageFormat);
            
            // 첫 번째 시도가 실패하면 잠시 후 다시 시도
            if (!msa6SendSuccess) {
              //console.log('[processWorkflow] MSA6 전송 첫 번째 시도 실패. 500ms 후 재시도...');
              setTimeout(() => {
                msa6SendSuccess = sendImageToMSA6(processedImages['end'], imageFormat);
                
                if (!msa6SendSuccess) {
                  //console.log('[processWorkflow] MSA6 전송 두 번째 시도 실패. 1000ms 후 마지막 시도...');
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
        
        // 오류 메시지 상세화
        const errorMessage = error.message || '알 수 없는 오류';
        statusMessage.value = `처리 오류: ${errorMessage}`;
        
        // 상세 오류 정보 팝업 표시
        showWorkflowErrorDialog.value = true;
        workflowErrorTitle.value = '워크플로우 처리 오류';
        workflowErrorMessage.value = `워크플로우 처리 중 오류가 발생했습니다: ${errorMessage}`;
        
        // 특정 패턴의 오류에 대한 힌트 제공
        if (errorMessage.includes('API 응답 오류')) {
          workflowErrorDetails.value = '백엔드 API 호출 중 오류가 발생했습니다. 노드 타입이나 파라미터가 올바른지 확인하세요.';
        } else if (errorMessage.includes('not found') || errorMessage.includes('404')) {
          workflowErrorDetails.value = '요청한 리소스를 찾을 수 없습니다. 백엔드 서버가 실행 중인지 확인하세요.';
        } else if (errorMessage.includes('network') || errorMessage.includes('연결')) {
          workflowErrorDetails.value = '네트워크 연결 오류가 발생했습니다. 인터넷 연결 상태를 확인하세요.';
        } else {
          workflowErrorDetails.value = '워크플로우 실행 중 예상치 못한 오류가 발생했습니다. 개발자 콘솔에서 자세한 정보를 확인하세요.';
        }
        
        showStatusMessage.value = true;
        setTimeout(() => { showStatusMessage.value = false }, 5000);
      }
    }

    // 이미지 설정 함수 (MSA4에서 이미지를 받아올 때 호출)
    const setImage = async (imageUrl, imageTitle, fromMSA1 = false) => {
      inputImage.value = imageUrl
      // 이미지 제목이 없으면 기본값 사용, 있으면 공백을 언더스코어로 변환
      currentImageTitle.value = imageTitle ? imageTitle.replace(/ /g, '_') : ''
      
      // 이미지 해시 계산하여 저장된 워크플로우 확인 - MSA1에서 온 이미지가 아닌 경우에만
      if (imageUrl && !fromMSA1) {
        try {
          const imageHash = await calculateImageHash(imageUrl)
          canSaveWorkflow.value = true
          
          // 해당 이미지에 대해 저장된 워크플로우가 이미 저장되어 있는지 확인
          checkSavedWorkflow(imageHash)
        } catch (error) {
          console.error('이미지 해시 계산 중 오류:', error)
        }
      } else if (fromMSA1) {
        // MSA1에서 온 이미지는 항상 새로운 이미지이므로 저장 가능하게 설정하고 API 호출 생략
        canSaveWorkflow.value = true
        // 기존에 저장된 워크플로우 체크를 하지 않아서 API 에러가 발생하지 않습니다.
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

    // MSA5에서 워크플로우 데이터 받기 - 이벤트 리스너
    onMounted(() => {
      // 이벤트 리스너 등록 - MSA4에서 이미지 선택 시 호출
      document.addEventListener('msa4-to-msa5-image', handleImageUpdate)
      
      // MSA1에서 이미지 선택 시 호출되는 이벤트 리스너 추가
      document.addEventListener('msa1-to-msa5-image', handleImageUpdate)
      
      // 워크플로우 이벤트 리스너 등록 - MSA4에서 워크플로우 불러오기 선택 시 호출
      document.addEventListener('msa4-to-msa5-workflow', handleWorkflowFromMSA4)
      
      // MSA3에서 워크플로우 데이터 받을 이벤트 리스너 추가
      document.addEventListener('load-workflow-to-msa5', handleWorkflowFromMSA3)
      
      // 전역 이벤트 버스를 통해 워크플로우 데이터 수신
      if (window.MSAEventBus) {
        window.MSAEventBus.on('load-workflow-to-msa5', handleWorkflowFromMSA3)
      }
      
      // 노드 목록 로드
      loadAvailableNodes()
      
      // 페이지 새로고침 시 MSA5 상태 초기화
      sessionStorage.removeItem('msa5_end_image')
      sessionStorage.removeItem('msa5_processing')
      //console.log('MSA5: 컴포넌트 마운트 시 상태 초기화됨')
      
      // 기본 워크플로우 로드
      loadDefaultWorkflow()
      
      // 키보드 이벤트 리스너 추가
      window.addEventListener('keydown', handleKeyDown)
      
      // 워크플로우 저장 목록 로드
      loadSavedWorkflows()
    })

    // 컴포넌트 언마운트 시 이벤트 리스너 제거
    onUnmounted(() => {
      document.removeEventListener('msa4-to-msa5-image', handleImageUpdate)
      document.removeEventListener('msa1-to-msa5-image', handleImageUpdate)
      document.removeEventListener('msa4-to-msa5-workflow', handleWorkflowFromMSA4)
      document.removeEventListener('load-workflow-to-msa5', handleWorkflowFromMSA3)
      
      window.removeEventListener('keydown', handleKeyDown)
      
      if (window.MSAEventBus) {
        window.MSAEventBus.off('load-workflow-to-msa5', handleWorkflowFromMSA3)
      }
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
      canSaveWorkflow.value = false; // 워크플로우 변경 시 저장 비활성화
      processingStatus.value = 'idle'; // 저장버튼 비활성화

      //console.log(`연결 생성됨: ${params.source} -> ${params.target}`)
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
              //console.log('마지막으로 저장된 워크플로우를 로드했습니다.');
              return;
            }
          } catch (parseError) {
            console.error('저장된 워크플로우 파싱 오류:', parseError);
          }
        }
        
        // 저장된 워크플로우가 없거나 로드 실패 시 기본 워크플로우 사용
        //console.log('기본 워크플로우를 초기화합니다.');
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
        //console.log('워크플로우 저장 목록 초기화');
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
        
        // 저장 함수 호출
        await saveWorkflowToServer();
        
      } catch (error) {
        console.error('중복 이름 확인 중 오류:', error);
        showStatusMessage.value = true;
        statusMessage.value = `중복 이름 확인 실패: ${error.message}`;
        setTimeout(() => { showStatusMessage.value = false }, 5000);
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
            // 워크플로우 데이터 로드 - 요소 정렬을 위해 prepareElementsForLoad 함수 사용
            elements.value = prepareElementsForLoad(data.workflow.elements);
            
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
        console.error('워크플로우 로드 중 오류 발생:', error);
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
        //console.log('캔버스 클릭 - 노드 선택 해제');
        selectedNode.value = null;
      }
    }

    // MSA4나 MSA1에서 이미지 데이터 받기 - 이벤트 핸들러
    const handleImageUpdate = (event) => {
      try {
        //console.log('MSA5: 이미지 이벤트 수신', event.type);
        
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
          
        //console.log(`MSA5: 이미지 수신 - URL: ${imageUrl.substring(0, 30)}..., 제목: ${imageTitle}`);
        
        // MSA1에서 온 이미지인지 확인
        const fromMSA1 = event.type === 'msa1-to-msa5-image';
        
        // 이미지 설정
        setImage(imageUrl, imageTitle, fromMSA1);
        
        // processedImages에 시작 이미지로 설정
        processedImages['start'] = imageUrl;
        
        // 세션 스토리지에 시작 이미지 URL 저장
        sessionStorage.setItem('msa5_start_image_url', imageUrl);
        //console.log('MSA5: 세션 스토리지에 시작 이미지 URL 저장:', imageUrl.substring(0, 30) + '...');
        
        // 이벤트 타입에 따른 추가 처리
        if (event.type === 'msa4-to-msa5-image') {
          //console.log('MSA5: MSA4에서 이미지 수신됨');
        } else if (event.type === 'msa1-to-msa5-image') {
          // MSA1에서 온 경우 특별한 처리 (있다면)
          //console.log('MSA5: MSA1에서 이미지 수신됨');
          }
        } catch (error) {
        console.error('MSA5: 이미지 업데이트 처리 중 오류 발생', error);
      }
    }

    // 백엔드에서 사용 가능한 노드 로드
    const loadAvailableNodes = async () => {
      isNodesLoading.value = true
      //console.log('===============================================');
      //console.log('【노드 목록 로드 시작...】');
      //console.log('===============================================');
      
      try {
        // 백엔드 API에서 노드 목록 로드 시도
        const apiUrl = 'http://localhost:8000/api/msa5/nodes';
        //console.log(`API 호출 URL: ${apiUrl}`);
        
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
          
          //console.log('API 응답 상태코드:', response.status);
          
          if (response.ok) {
            try {
              const data = await response.json();
              //console.log('API 응답 데이터:', data);
              
              if (data.options && Array.isArray(data.options)) {
                //console.log(`노드 데이터 개수: ${data.options.length}`);
                availableNodes.value = data.options;
                
                // 기본 옵션 설정 - 이 부분을 수정하여 백엔드에서 받은 defaultOptions 사용
                if (data.defaultOptions) {
                  defaultOptions.value = data.defaultOptions;
                  //console.log('기본 옵션 설정 완료:', defaultOptions.value);
                }
                
                //console.log('노드 목록 업데이트 완료:', availableNodes.value);
              } else {
                console.warn('❌ 백엔드 응답에 options 배열이 없거나 형식이 맞지 않습니다:', data);
                console.warn('기본 노드 목록을 사용합니다.');
              }
            } catch (parseError) {
              console.error('❌ JSON 파싱 오류:', parseError);
              console.warn('JSON 파싱에 실패했습니다. 기본 노드 목록을 사용합니다.');
            }
          } else {
            console.error(`❌ API 요청 실패: ${response.status} ${response.statusText}`);
            const errorText = await response.text();
            console.error('오류 응답 내용:', errorText);
            console.warn('API 요청이 실패했습니다. 기본 노드 목록을 사용합니다.');
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
        }
      } finally {
        // 노드 로드 후 초기 요소 설정
        initializeElements();
        
        // 노드 목록이 로드되면 로딩 상태 해제
        isNodesLoading.value = false;
        //console.log('노드 로딩 상태 업데이트:', isNodesLoading.value);
        //console.log('===============================================');
        //console.log('【노드 목록 로드 완료】');
        //console.log('===============================================');
      }
    }
    
    // 워크플로우 요약 함수
    const getNodeSummary = () => {
      if (!elements.value || !Array.isArray(elements.value)) {
        return [];
      }
      
      // 노드와 연결 정보 추출
      const nodes = elements.value.filter(el => 
        el.type !== 'smoothstep' && 
        el.id !== 'start' && 
        el.id !== 'end'
      );
      
      const connections = elements.value.filter(el => el.type === 'smoothstep');
      
      // 연결 기반으로 경로 찾기
      const graph = {};
      elements.value.filter(el => el.type !== 'smoothstep').forEach(node => {
        graph[node.id] = [];
      });
      
      connections.forEach(conn => {
        if (graph[conn.source]) {
          graph[conn.source].push(conn.target);
        }
      });
      
      // 시작 노드부터 경로 탐색
      const visited = new Set();
      const orderedNodes = [];
      
      // BFS로 노드 순서 찾기 (DFS보다 워크플로우 순서를 더 정확히 표현)
      const bfs = (startNodeId) => {
        const queue = [startNodeId];
        
        while (queue.length > 0) {
          const nodeId = queue.shift();
          
          if (visited.has(nodeId)) continue;
          visited.add(nodeId);
          
          // 노드가 start나 end가 아닌 경우만 결과에 추가
          const node = elements.value.find(el => el.id === nodeId);
          if (node && nodeId !== 'start' && nodeId !== 'end') {
            orderedNodes.push(node);
          }
          
          // 다음 노드들을 큐에 추가
          (graph[nodeId] || []).forEach(nextNode => {
            if (!visited.has(nextNode)) {
              queue.push(nextNode);
            }
          });
        }
      };
      
      // 시작 노드부터 BFS 시작
      bfs('start');
      
      // 연결되지 않은 노드들도 추가 (고립된 노드)
      nodes.forEach(node => {
        if (!visited.has(node.id)) {
          orderedNodes.push(node);
        }
      });
      
      return orderedNodes;
    }
    
    // 워크플로우 표시용 노드와 연결선 아이템 준비
    const getWorkflowDisplayItems = () => {
      const nodes = getNodeSummary();
      const items = [];
      
      nodes.forEach((node, index) => {
        // 노드 추가
        items.push({
          type: 'workflow-node',
          icon: node.data?.icon || 'fas fa-cog',
          label: node.data?.label || '처리 노드',
          params: node.data?.params || {},
          id: node.id
        });
        
        // 마지막 노드가 아니면 연결선 추가
        if (index < nodes.length - 1) {
          items.push({ 
            type: 'workflow-node-connection'
          });
        }
      });
      
      return items;
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
    const saveWorkflow = async () => {
      if (!workflowName.value) {
        showStatusMessage.value = true;
        statusMessage.value = '워크플로우 이름을 입력하세요.';
        setTimeout(() => { showStatusMessage.value = false }, 3000);
        return;
      }
      
      try {
        const workflowToSave = {
          workflow_name: workflowName.value,
          elements: prepareElementsForSave(elements.value),
          input_image_url: inputImage.value
        };
        
        // Workflow BFS 요약 정보 추가
        const nodesSummary = getNodeSummary(elements.value);
        if (nodesSummary && nodesSummary.length > 0) {
          workflowToSave.nodes_summary = nodesSummary;
        }
        
        const response = await fetch('http://localhost:8000/api/msa5/save-workflow', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(workflowToSave)
        });
        
        if (response.ok) {
          const responseData = await response.json();
          if (responseData.status === 'success') {
            showWorkflowDialog.value = false;
            showStatusMessage.value = true;
            statusMessage.value = '워크플로우가 저장되었습니다.';
            setTimeout(() => { showStatusMessage.value = false }, 3000);
          } else {
            throw new Error(responseData.message || '저장 중 오류가 발생했습니다.');
          }
        } else {
          throw new Error(`서버 응답 오류: ${response.status}`);
        }
      } catch (error) {
        console.error('워크플로우 저장 중 오류 발생:', error);
        showStatusMessage.value = true;
        statusMessage.value = `저장 실패: ${error.message}`;
        setTimeout(() => { showStatusMessage.value = false }, 3000);
      }
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
    const handleWorkflowFromMSA4 = (workflowString) => {
      try {
        // JSON 문자열을 객체로 변환
        const workflowData = JSON.parse(workflowString);
        
        if (workflowData && workflowData.elements && Array.isArray(workflowData.elements)) {
          // 워크플로우 요소 정렬 및 ID 재구성하여 로드
          elements.value = prepareElementsForLoad(workflowData.elements);
          
          // 입력 이미지가 있는 경우 처리
          if (workflowData.input_image_url) {
            inputImage.value = workflowData.input_image_url;
          }
          
          // 워크플로우 이름이 있는 경우 처리
          if (workflowData.workflow_name) {
            workflowName.value = workflowData.workflow_name;
          }
          
          showStatusMessage.value = true;
          statusMessage.value = 'MSA4에서 워크플로우를 가져왔습니다.';
          setTimeout(() => { showStatusMessage.value = false }, 3000);
        } else {
          throw new Error('워크플로우 데이터 형식이 올바르지 않습니다.');
        }
      } catch (error) {
        console.error('MSA4 워크플로우 처리 중 오류 발생:', error);
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
        
        //console.log('이미지 외부 내보내기 시작 - 타이틀:', title);
        
        // 세션 ID 생성
        const sessionId = `workflow_${Date.now()}`;
        
        // 파일 이름 설정 - 요구사항에 맞게 _before와 _after 접미사 사용
        const beforeFilename = `${title}_before`;
        const afterFilename = `${title}_after`;
        
        //console.log('원본 이미지 URL 확인:');
        //console.log('Before 이미지:', inputImage.value.substring(0, 30) + '...');
        //console.log('After 이미지:', processedImages['end'].substring(0, 30) + '...');
        
        // 로컬 Helper 함수: Blob URL을 Base64 데이터 URL로 변환
        const blobToBase64 = async (blobUrl) => {
          try {
            // 이미 data URL이면 변환하지 않음
            if (blobUrl.startsWith('data:')) {
              //console.log('이미 Data URL 형식입니다. 변환 불필요. 전체 URL:', blobUrl);
              return blobUrl;
            }
            
            //console.log('Blob URL을 Base64로 변환 시작 (전체 URL):', blobUrl);
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
                //console.log('Base64 변환 완료 (전체 결과):', result);
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
        //console.log('After 이미지 변환 시작...');
        // console.log('After 이미지 URL 타입:', processedImages['end'].startsWith('blob:') ? 'Blob URL' : 
        //                                    processedImages['end'].startsWith('data:') ? 'Data URL' : 'HTTP URL');
        
        let afterImageBase64;
        try {
          // 우선 표준 방식으로 변환 시도
          afterImageBase64 = await blobToBase64(processedImages['end']);
          //console.log('After 이미지 변환 성공 - 표준 방식');
        } catch (conversionError) {
          console.error('표준 방식 변환 실패:', conversionError);
          
          // 변환 실패 시 대체 방식으로 시도
          //console.log('대체 방식으로 변환 시도...');
          try {
            const response = await fetch(processedImages['end']);
            const blob = await response.blob();
            // console.log('After 이미지 Blob 정보:', {
            //   type: blob.type || 'unknown',
            //   size: blob.size + ' bytes'
            // });
            
            // 수동으로 FileReader 사용
            const dataUrl = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const result = reader.result;
                //console.log('FileReader 결과 (전체):', result);
                resolve(result);
              };
              reader.onerror = (e) => {
                console.error('FileReader 오류:', e);
                reject(new Error('이미지 읽기 오류'));
              };
              reader.readAsDataURL(blob);
            });
            
            afterImageBase64 = dataUrl;
            //console.log('After 이미지 변환 성공 - 대체 방식');
          } catch (alternativeError) {
            console.error('대체 방식도 실패:', alternativeError);
            //console.log('원본 URL 사용 (변환 실패)');
            afterImageBase64 = processedImages['end']; // 원본 URL 사용 (API가 처리 가능한지 시도)
          }
        }
        
        //console.log('변환된 이미지 데이터:');
        //console.log('Before 이미지 타입 (전체):', beforeImageBase64);
        //console.log('After 이미지 타입 (전체):', afterImageBase64);
        
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
              
        //console.log('이미지 저장 API 요청 준비 완료');
        
        // 결과 저장 변수
        let result;
        
        try {
          // 1. JSON 방식으로 시도
          //console.log('JSON 방식으로 이미지 저장 시도...');
          const response = await fetch('http://localhost:8000/api/external_storage/save-images', {
                method: 'POST',
                headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
                },
            mode: 'cors',
            credentials: 'include',
                body: JSON.stringify({
                  title: workflowName.value.replace(/ /g, '_'),
                  description: workflowDescription.value || '',
                  before_image: beforeImageBase64,
                  after_image: afterImageBase64,
                  workflow_id: sessionId,
                  tags: ['lcnc', '이미지 처리'],
                  is_result: false  // MSA5는 workflow_images에 저장하도록 지정
                })
              });
              
          if (!response.ok) {
            const errorText = await response.text();
            console.error('JSON 방식 API 오류:', response.status, errorText);
            throw new Error(`JSON 방식 실패 (${response.status})`);
          }
          
          result = await response.json();
          //console.log('JSON 방식 이미지 저장 성공:', result);
          //console.log('JSON 방식 이미지 저장 성공 (전체 응답):', JSON.stringify(result, null, 2));
          
          // 저장된 이미지 URL 로깅
          if (result.image_data) {
            //console.log('저장된 Before 이미지 URL (전체):', result.image_data.before_url);
            //console.log('저장된 After 이미지 URL (전체):', result.image_data.after_url);
          }
        } catch (jsonError) {
          console.error('JSON 방식 실패, FormData 방식으로 재시도:', jsonError);
          
          // 2. FormData 방식으로 시도
          try {
            // 이미지를 Blob으로 변환
            //console.log('이미지를 Blob으로 변환...');
            const beforeBlob = await (async () => {
              if (inputImage.value.startsWith('data:')) {
                // Data URL에서 Blob 생성
                //console.log('Before 이미지: Data URL에서 Blob 변환 중');
                const res = await fetch(inputImage.value);
                return await res.blob();
              } else if (inputImage.value.startsWith('blob:')) {
                // Blob URL에서 Blob 가져오기
                //console.log('Before 이미지: Blob URL에서 Blob 변환 중');
                const res = await fetch(inputImage.value);
                return await res.blob();
              } else {
                // 일반 URL에서 Blob 가져오기
                //console.log('Before 이미지: 일반 URL에서 Blob 변환 중');
                const res = await fetch(inputImage.value);
                return await res.blob();
              }
            })();
            
            const afterBlob = await (async () => {
              if (processedImages['end'].startsWith('data:')) {
                //console.log('After 이미지: Data URL에서 Blob 변환 중');
                const res = await fetch(processedImages['end']);
                return await res.blob();
              } else if (processedImages['end'].startsWith('blob:')) {
                //console.log('After 이미지: Blob URL에서 Blob 변환 중');
                const res = await fetch(processedImages['end']);
                return await res.blob();
              } else {
                //console.log('After 이미지: 일반 URL에서 Blob 변환 중');
                const res = await fetch(processedImages['end']);
                return await res.blob();
              }
            })();
            
            //console.log('Blob 변환 완료 - 상세 정보:');
            //console.log('Before Blob 전체 정보:', {
            //   type: beforeBlob.type,
            //   size: beforeBlob.size,
            //   lastModified: beforeBlob.lastModified ? new Date(beforeBlob.lastModified).toISOString() : 'N/A'
            // });
            //console.log('After Blob 전체 정보:', {
            //   type: afterBlob.type,
            //   size: afterBlob.size,
            //   lastModified: afterBlob.lastModified ? new Date(afterBlob.lastModified).toISOString() : 'N/A'
            // });
            
            //console.log('Blob 변환 완료');
            //console.log('Before Blob 타입:', beforeBlob.type, 'Size:', beforeBlob.size);
            //console.log('After Blob 타입:', afterBlob.type, 'Size:', afterBlob.size);
            
            // FormData 구성
            const formData = new FormData();
            formData.append('title', title);
            formData.append('description', workflowDescription.value || '');
            formData.append('before_file', beforeBlob, `${beforeFilename}.${beforeBlob.type.split('/')[1] || 'png'}`);
            formData.append('file', afterBlob, `${afterFilename}.${afterBlob.type.split('/')[1] || 'png'}`);
            formData.append('workflow_id', sessionId);
            formData.append('tags', JSON.stringify(['lcnc', '이미지 처리']));
            formData.append('is_result', 'false');  // MSA5는 workflow_images에 저장하도록 지정
            
            //console.log('FormData 구성 완료, API 요청 시작...');
            
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
            //console.log('FormData 방식 이미지 저장 성공:', result);
            //console.log('FormData 방식 이미지 저장 성공 (전체 응답):', JSON.stringify(result, null, 2));
            
            // 저장된 이미지 URL 로깅
            if (result.image_data) {
              //console.log('저장된 Before 이미지 URL (전체):', result.image_data.before_url);
              //console.log('저장된 After 이미지 URL (전체):', result.image_data.after_url);
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
          
          //console.log('유사 이미지 검색 이벤트 발생');
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
          
          //console.log('유사 이미지 검색 이벤트 발생');
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
        //console.log('[sendImageToMSA6] MSA6로 이미지 전송 시작... URL:', imageUrl);
        
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
        
        //console.log('[sendImageToMSA6] MSA6 표준 이벤트 발생 완료');
        
        // 3. localStorage 기반 통신 시도 (다른 컴포넌트가 polling할 수 있음)
        localStorage.setItem('msa5_latest_image', JSON.stringify({
          url: imageUrl,
          title: imageTitle,
          timestamp: Date.now(),
          format: imageFormat || 'png'
        }));
        
        // MSA6 컴포넌트가 직접 사용하는 로컬스토리지 키 설정
        localStorage.setItem('msa6_final_image', imageUrl);
        //console.log('[sendImageToMSA6] msa6_final_image 로컬스토리지 설정 완료:', imageUrl.substring(0, 30) + '...');
        
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
          //console.log('[sendImageToMSA6] MSA6 컴포넌트 발견, 직접 이미지 설정 시도');
          
          // Vue 컴포넌트 접근
          const msa6Instance = msa6Component.__vue__;
          if (msa6Instance) {
            //console.log('[sendImageToMSA6] MSA6 Vue 인스턴스 발견');
            // 컴포넌트의 메서드나 속성 접근 시도
            if (typeof msa6Instance.setImage === 'function') {
              msa6Instance.setImage(imageUrl, imageTitle);
              //console.log('[sendImageToMSA6] MSA6 setImage 메서드 호출 성공');
            }
          }
        }
        
        //console.log('[sendImageToMSA6] MSA6로 이미지 전송 완료. 데이터:', {
        //   url: imageUrl.substring(0, 30) + '...',
        //   format: imageFormat,
        //   title: imageTitle,
        //   timestamp: new Date().toISOString()
        // });
        
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

    // 워크플로우 요약 아이템 계산 (computed property로 추가)
    const workflowSummaryItems = computed(() => {
      const nodes = getNodeSummary();
      return nodes.map(node => ({
        id: node.id,
        icon: node.data?.icon || 'fas fa-cog',
        label: node.data?.label || '처리 노드',
        params: node.data?.params || {},
        nodeType: node.data?.nodeId || node.data?.id
      }));
    });
    
    // 워크플로우 표시용 아이템 (노드와 연결선을 하나의 배열로 처리)
    const processedWorkflowItems = computed(() => {
      const items = [];
      const nodes = workflowSummaryItems.value;
      
      // 첫 번째 연결선 (시작 노드에서 첫 번째 노드로)
      if (nodes.length > 0) {
        items.push({ type: 'workflow-node-connection' });
      }
      
      // 각 노드와 다음 노드로의 연결선 추가
      nodes.forEach((node, index) => {
        // 노드 추가
        items.push({
          type: 'workflow-node',
          icon: node.icon,
          label: node.label,
          params: node.params,
          nodeType: node.nodeType,
          id: node.id
        });
        
        // 마지막 노드가 아니면 연결선 추가
        if (index < nodes.length - 1) {
          items.push({ type: 'workflow-node-connection' });
        }
      });
      
      // 마지막 연결선 (마지막 노드에서 종료 노드로)
      if (nodes.length > 0) {
        items.push({ type: 'workflow-node-connection' });
      }
      
      return items;
    });

    // 워크플로우 요소를 저장용으로 준비하는 함수 (필요한 데이터만 포함)
    const prepareElementsForSave = (elements) => {
      if (!elements || !Array.isArray(elements)) {
        return [];
      }
      
      //console.log('저장 전 요소 데이터:', elements);
      
      // 요소 분류
      const startNode = elements.find(el => el.id === 'start');
      const endNode = elements.find(el => el.id === 'end');
      const customNodes = elements.filter(el => el.id !== 'start' && el.id !== 'end' && el.type !== 'smoothstep');
      const connections = elements.filter(el => el.type === 'smoothstep');
      
      // 결과 배열 (순서 중요: start -> 커스텀 노드들 -> end)
      const cleanedElements = [];
      
      // 노드 연결 정보 맵 생성 (소스 -> 타겟)
      const connectionMap = {};
      connections.forEach(conn => {
        if (!connectionMap[conn.source]) {
          connectionMap[conn.source] = [];
        }
        connectionMap[conn.source].push(conn.target);
      });
      
      //console.log('연결 정보 맵:', connectionMap);
      
      // 시작 노드 추가 (필수 속성만)
      if (startNode) {
        const cleanedStartNode = {
          id: 'start',
          type: 'start',
          position: startNode.position,
          data: {
            label: startNode.data?.label || '시작'
          }
        };
        
        // 시작 노드의 연결 정보 추가
        if (connectionMap['start']) {
          cleanedStartNode.data.connections = connectionMap['start'];
        }
        
        cleanedElements.push(cleanedStartNode);
      }
      
      // 커스텀 노드 추가 (필요한 속성만)
      customNodes.forEach(node => {
        // 노드의 기본 ID 사용
        const nodeId = node.id;
        
        // 노드 이름에서 타임스탬프 ID 제거 (예: "anisotropic_diffusion_1749242475786" -> "anisotropic_diffusion")
        const baseName = nodeId.includes('_') ? nodeId.split('_')[0] : nodeId;
        
        //console.log('노드 이름 처리:', {
        //   원본ID: nodeId,
        //   변환된이름: baseName
        // });
        
        const cleanedNode = {
          id: nodeId,
          name: baseName, // 타임스탬프가 제거된 기본 이름만 사용
          type: 'custom', // 타입을 custom으로 통일
          position: node.position,
          data: {
            label: node.data?.label || nodeId,
            nodeId: nodeId,
            icon: node.data?.icon
          }
        };
        
        // 파라미터가 있는 경우 추가
        if (node.data?.params) {
          cleanedNode.data.params = node.data.params;
        }
        
        // 노드의 연결 정보 추가
        if (connectionMap[nodeId]) {
          cleanedNode.data.connections = connectionMap[nodeId];
        }
        
        cleanedElements.push(cleanedNode);
      });
      
      // 종료 노드 추가
      if (endNode) {
        cleanedElements.push({
          id: 'end',
          type: 'end',
          position: endNode.position,
          data: {
            label: endNode.data?.label || '종료'
          }
        });
      }
      
      //console.log('저장될 요소 데이터:', cleanedElements);
      
      return cleanedElements;
    }

    // 요소 로드 전 처리 함수 - 정렬 및 ID 재구성
    const prepareElementsForLoad = (inputElements) => {
      console.log('=== prepareElementsForLoad 함수 호출됨 ===');
      console.log('입력 요소들:', inputElements);
      console.log('입력 요소 개수:', inputElements ? inputElements.length : 'null');
      
      if (!inputElements || !Array.isArray(inputElements)) {
        console.warn('prepareElementsForLoad: 유효하지 않은 입력 요소');
        return [];
      }
      
      const reorganizedElements = [];
      const idMapping = {}; // 저장된 ID → 새로운 고유 ID
      const nameToIdMapping = {}; // 기본 이름 → 새로운 고유 ID
      
      // 시작 노드와 종료 노드 분리
      const startNode = inputElements.find(el => el.type === 'start');
      const endNode = inputElements.find(el => el.type === 'end');
      const customNodes = inputElements.filter(el => el.type !== 'start' && el.type !== 'end' && el.type !== 'edge');
      
      // 시작 노드를 먼저 추가
      if (startNode) {
        reorganizedElements.push({ ...startNode });
      }
      
      // 타임스탬프 생성 (모든 노드에 동일한 타임스탬프 사용)
      const timestamp = Date.now();
      
      // 1단계: 모든 저장된 노드 ID들을 새로운 고유 ID로 매핑
      console.log('=== 1단계: ID 매핑 생성 ===');
      customNodes.forEach(node => {
        const originalId = node.id;
        const nodeName = node.name || originalId;
        const uniqueId = `${nodeName}_${timestamp}_${Math.floor(Math.random() * 10000)}`;
        
        // 기본 매핑
        idMapping[originalId] = uniqueId;
        nameToIdMapping[nodeName] = uniqueId;
        
        console.log(`매핑 생성: ${originalId} → ${uniqueId} (이름: ${nodeName})`);
        
        // 저장된 고유 ID에서 기본 이름 추출하여 추가 매핑
        if (originalId.includes('_')) {
          const baseName = originalId.split('_')[0];
          if (!nameToIdMapping[baseName]) {
            nameToIdMapping[baseName] = uniqueId;
            console.log(`기본 이름 매핑 추가: ${baseName} → ${uniqueId}`);
          }
        }
      });
      
      // 2단계: connections 배열 분석하여 추가 매핑 생성
      console.log('=== 2단계: connections 기반 추가 매핑 ===');
      inputElements.forEach(el => {
        if (el.data && el.data.connections && Array.isArray(el.data.connections)) {
          console.log(`${el.id}의 connections:`, el.data.connections);
          
          el.data.connections.forEach(targetId => {
            // 이미 매핑된 경우 건너뛰기
            if (idMapping[targetId] || targetId === 'start' || targetId === 'end') {
              return;
            }
            
            // 기본 이름 추출 시도
            let baseName = targetId;
            if (targetId.includes('_')) {
              baseName = targetId.split('_')[0];
            }
            
            // 해당 기본 이름을 가진 노드 찾기
            const matchingNode = customNodes.find(node => {
              const nodeId = node.id;
              const nodeName = node.name || nodeId;
              const nodeBaseName = nodeName.split('_')[0];
              
              // 1. 정확한 ID 매칭 시도
              if (nodeId === targetId) return true;
              
              // 2. 기본 이름 매칭 시도  
              if (nodeBaseName === baseName) return true;
              
              // 3. 이름 직접 매칭 시도 (대소문자 무시)
              if (nodeName.toLowerCase() === targetId.toLowerCase()) return true;
              
              // 4. 타겟 ID가 노드 이름에 포함되는지 확인
              if (nodeName.toLowerCase().includes(targetId.toLowerCase())) return true;
              
              return false;
            });
            
            if (matchingNode) {
              const mappedId = idMapping[matchingNode.id];
              if (mappedId) {
                idMapping[targetId] = mappedId;
                console.log(`connections 기반 매핑: ${targetId} → ${mappedId}`);
              }
            } else {
              console.warn(`connections에서 타겟 노드를 찾을 수 없음: ${targetId}`);
              
              // 매칭되는 노드가 없는 경우, 이름 매핑 테이블에서 시도
              if (nameToIdMapping[baseName]) {
                idMapping[targetId] = nameToIdMapping[baseName];
                console.log(`기본 이름으로 매핑: ${targetId} → ${nameToIdMapping[baseName]}`);
              } else if (nameToIdMapping[targetId]) {
                idMapping[targetId] = nameToIdMapping[targetId];
                console.log(`직접 이름으로 매핑: ${targetId} → ${nameToIdMapping[targetId]}`);
              }
            }
          });
        }
      });
      
      // 3단계: 커스텀 노드 추가
      console.log('=== 3단계: 노드 생성 ===');
      customNodes.forEach(node => {
        const originalId = node.id;
        const uniqueId = idMapping[originalId];
        const nodeName = node.name || originalId;
        
        console.log(`노드 생성: ${originalId} → ${uniqueId}`);
        
        // 병합 노드인지 확인하여 타입 정보 보존
        const isMergeNode = node.type === 'merge' || 
                           (node.data && node.data.id === 'merge') ||
                           (node.data && node.data.label && node.data.label.includes('병합')) ||
                           (node.data && node.data.label && node.data.label.includes('merge')) ||
                           (node.id && node.id.includes('merge')) ||
                           (node.name && node.name.includes('merge'));
        
        const updatedNode = {
          ...node,
          id: uniqueId,
          name: nodeName,
          type: isMergeNode ? 'merge' : node.type, // 병합 노드 타입 확실히 보존
          data: {
            ...node.data,
            id: isMergeNode ? 'merge' : node.data?.id, // 병합 노드 데이터 ID도 보존
            nodeId: node.data?.nodeId || node.data?.id, // 원본 nodeId 보존 (404 오류 방지)
            label: node.data?.label, // 라벨 보존
            icon: node.data?.icon, // 아이콘 보존
            params: node.data?.params ? { ...node.data.params } : undefined, // 파라미터 완전 복사
            connections: undefined // connections는 엣지로 별도 처리
          }
        };
        
        reorganizedElements.push(updatedNode);
      });
      
      // 종료 노드 추가
      if (endNode) {
        reorganizedElements.push({ ...endNode });
      }
      
      // 4단계: connections 기반 엣지 생성
      console.log('=== 4단계: 엣지 생성 ===');
      inputElements.forEach(el => {
        if (el.data && el.data.connections && Array.isArray(el.data.connections)) {
          // 소스 노드 ID 결정
          let sourceId;
          if (el.id === 'start') {
            sourceId = 'start';
          } else if (el.id === 'end') {
            sourceId = 'end';
          } else {
            sourceId = idMapping[el.id] || el.id;
          }
          
          console.log(`${el.id}에서 ${el.data.connections.length}개 분기 생성:`);
          
          // 각 연결 대상에 대해 엣지 생성
          el.data.connections.forEach((targetId, index) => {
            // 타겟 노드 ID 결정
            let mappedTargetId;
            if (targetId === 'start') {
              mappedTargetId = 'start';
            } else if (targetId === 'end') {
              mappedTargetId = 'end';
            } else {
              mappedTargetId = idMapping[targetId] || targetId;
            }
            
            // 엣지 ID 생성
            const edgeId = `e_${sourceId}_${mappedTargetId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            
            console.log(`  분기 ${index + 1}: ${sourceId} → ${mappedTargetId} (${targetId})`);
            
            // 엣지 추가
            reorganizedElements.push({
              id: edgeId,
              type: 'smoothstep',
              source: sourceId,
              target: mappedTargetId,
              sourceHandle: null,
              targetHandle: null,
              style: {
                stroke: '#666',
                strokeWidth: 2
              },
              animated: false
            });
          });
        }
      });
      
      console.log('=== 최종 결과 ===');
      console.log('생성된 elements:', reorganizedElements);
      console.log('ID 매핑 테이블:', idMapping);
      console.log('이름 매핑 테이블:', nameToIdMapping);
      
      return reorganizedElements;
    }

    // 워크플로우 저장 대화상자 열기
    const openWorkflowSaveDialog = () => {
      //console.log('openWorkflowSaveDialog 함수 호출됨');
      //console.log('processingStatus:', processingStatus.value);
      //console.log('inputImage:', inputImage.value ? '있음' : '없음');
      //console.log('processedImages[end]:', processedImages['end'] ? '있음' : '없음');
      
      // Process가 완료되지 않은 경우 저장 불가
      if (processingStatus.value !== 'completed') {
        showStatusMessage.value = true;
        statusMessage.value = '워크플로우를 먼저 실행해주세요.';
        statusType.value = 'warning';
        setTimeout(() => { showStatusMessage.value = false }, 3000);
        return;
      }
      
      // 저장 대화상자 표시
      showSaveWorkflowDialog.value = true;
      //console.log('showSaveWorkflowDialog 값 설정됨:', showSaveWorkflowDialog.value);
      
      // 다음 렌더링 사이클에서 입력 필드에 포커스
      nextTick(() => {
        //console.log('nextTick 실행, workflowNameInput:', workflowNameInput.value ? '있음' : '없음');
        if (workflowNameInput.value) {
          workflowNameInput.value.focus();
        }
      });
    }
    
    // 워크플로우 서버에 저장
    const saveWorkflowToServer = async () => {
      if (!workflowName.value) {
        showStatusMessage.value = true;
        statusMessage.value = '워크플로우 이름을 입력하세요.';
        setTimeout(() => { showStatusMessage.value = false }, 3000);
        return;
      }
      
      try {
        // 워크플로우 데이터 준비
        const workflowToSave = {
          workflow_name: workflowName.value,
          elements: prepareElementsForSave(elements.value),
          input_image_url: inputImage.value
        };
        
        // Workflow BFS 요약 정보 추가
        const nodesSummary = getNodeSummary(elements.value);
        if (nodesSummary && nodesSummary.length > 0) {
          workflowToSave.nodes_summary = nodesSummary;
        }
        
        // 워크플로우 저장 API 호출
        const response = await fetch('http://localhost:8000/api/msa5/save-workflow', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(workflowToSave)
        });
        
        if (response.ok) {
          const responseData = await response.json();
          
          if (responseData.status === 'success') {
            // 워크플로우 저장 성공 후 이미지 저장 진행
            try {
              //console.log('워크플로우 저장 성공, 이미지 저장 시작...');
              
              // 시작 이미지와 결과 이미지 확인
              if (!inputImage.value || !processedImages['end']) {
                console.warn('저장할 이미지가 없습니다. 이미지 저장 건너뜀');
              } else {
                // 세션 ID 생성 또는 응답에서 받은 ID 사용
                const sessionId = responseData.id || `workflow_${Date.now()}`;
                
                // 워크플로우 이름 (공백을 언더스코어로 변환)
                const safeWorkflowName = workflowName.value.replace(/ /g, '_');
                
                // 파일 이름 설정 - 요구사항에 맞게 _before와 _after 접미사 사용
                const beforeFilename = `${safeWorkflowName}_before`;
                const afterFilename = `${safeWorkflowName}_after`;
                
                //console.log('이미지 외부 내보내기 시작 - 타이틀:', safeWorkflowName);
                //console.log('Before 이미지:', inputImage.value.substring(0, 30) + '...');
                //console.log('After 이미지:', processedImages['end'].substring(0, 30) + '...');
                
                // Blob URL을 Base64 데이터 URL로 변환하는 함수
                const blobToBase64 = async (blobUrl) => {
                  try {
                    // 이미 data URL이면 변환하지 않음
                    if (blobUrl.startsWith('data:')) {
                      //console.log('이미 Data URL 형식입니다. 변환 불필요. 전체 URL:', blobUrl);
                      return blobUrl;
                    }
                    
                    //console.log('Blob URL을 Base64로 변환 시작:', blobUrl.substring(0, 30) + '...');
                    const response = await fetch(blobUrl);
                    
                    if (!response.ok) {
                      throw new Error(`Blob URL 가져오기 실패: ${response.status}`);
                    }
                    
                    const blob = await response.blob();
                    //console.log('Blob 정보:', {
                    //   type: blob.type,
                    //   size: blob.size + ' bytes'
                    // });
                    
                    return new Promise((resolve, reject) => {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        const result = reader.result;
                        //console.log('Base64 변환 완료 (길이):', result.length);
                        resolve(result);
                      };
                      reader.onerror = (e) => {
                        console.error('FileReader 오류:', e);
                        reject(new Error('이미지 읽기 오류'));
                      };
                      reader.readAsDataURL(blob);
                    });
                  } catch (error) {
                    console.error('Base64 변환 중 오류:', error);
                    return '';
                  }
                };
                
                // 이미지를 Base64로 변환
                //console.log('이미지를 Base64로 변환 시작...');
                const beforeImageBase64 = await blobToBase64(inputImage.value);
                const afterImageBase64 = await blobToBase64(processedImages['end']);
                
                //console.log('이미지 변환 완료:');
                //console.log('- Before 이미지:', beforeImageBase64 ? '성공' : '실패');
                //console.log('- After 이미지:', afterImageBase64 ? '성공' : '실패');
                
                // 이미지 저장 API 호출 (JSON 방식)
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
                    is_result: false  // MSA5는 workflow_images에 저장하도록 지정
                  })
                });
                
                if (imageResponse.ok) {
                  const imageResult = await imageResponse.json();
                  //console.log('이미지 저장 성공:', imageResult);
                  
                  // 저장된 이미지 URL 로그
                  if (imageResult.image_data) {
                    //console.log('저장된 Before 이미지 URL:', imageResult.image_data.before_url);
                    //console.log('저장된 After 이미지 URL:', imageResult.image_data.after_url);
                  }
        } else {
                  console.error('이미지 저장 실패:', await imageResponse.text());
                }
              }
            } catch (imageError) {
              console.error('이미지 저장 중 오류:', imageError);
              // 이미지 저장 실패해도 워크플로우 저장은 성공으로 처리
            }
            
            // 저장 완료 메시지 표시
            showSaveWorkflowDialog.value = false;
            showStatusMessage.value = true;
            statusMessage.value = '워크플로우가 저장되었습니다.';
            setTimeout(() => { showStatusMessage.value = false }, 3000);
          } else {
            throw new Error(responseData.message || '저장 중 오류가 발생했습니다.');
          }
        } else {
          throw new Error(`서버 응답 오류: ${response.status}`);
        }
      } catch (error) {
        console.error('워크플로우 저장 중 오류 발생:', error);
        showStatusMessage.value = true;
        statusMessage.value = `저장 실패: ${error.message}`;
        setTimeout(() => { showStatusMessage.value = false }, 3000);
      }
    }

    // MSA3에서 워크플로우 데이터 받기 - 이벤트 핸들러
    const handleWorkflowFromMSA3 = (event) => {
      console.log('=== MSA5: handleWorkflowFromMSA3 함수 호출됨 ===');
      console.log('MSA5: 수신된 이벤트:', event);
      console.log('MSA5: 이벤트 타입:', typeof event);
      console.log('MSA5: 이벤트 detail:', event.detail);
      
      try {
        // 이벤트 객체에서 워크플로우 데이터 추출
        const workflowData = event.detail || event;
        console.log('MSA5: 추출된 워크플로우 데이터:', workflowData);
        
        if (!workflowData) {
          console.error('MSA5: 워크플로우 데이터가 없습니다.');
          showStatusMessage.value = true;
          statusMessage.value = '워크플로우 데이터가 없습니다.';
          setTimeout(() => { showStatusMessage.value = false }, 3000);
          return;
        }
        
        // MSA3에서 보낸 데이터 구조 확인
        console.log('MSA5: 워크플로우 데이터 키:', Object.keys(workflowData));
        console.log('MSA5: elements 존재 여부:', !!workflowData.elements);
        console.log('MSA5: elements 타입:', typeof workflowData.elements);
        console.log('MSA5: elements 길이:', workflowData.elements ? workflowData.elements.length : 'null');
        
        // MSA3에서 전송한 elements 배열을 직접 사용
        if (workflowData.elements && Array.isArray(workflowData.elements)) {
          console.log('MSA5: elements 배열을 직접 처리합니다.');
          console.log('MSA5: elements 내용:', workflowData.elements);
          
          // prepareElementsForLoad 함수를 사용하여 요소 처리
          console.log('MSA5: prepareElementsForLoad 함수 호출 시작');
          const processedElements = prepareElementsForLoad(workflowData.elements);
          console.log('MSA5: prepareElementsForLoad 완료, 결과:', processedElements);
          
          // 처리된 요소를 워크플로우에 적용
          elements.value = processedElements;
          
          // MSA3에서 불러올 때는 input 이미지를 덮어쓰지 않음
          // MSA1의 현재 상태를 유지하면서 워크플로우만 불러옴
          // if (workflowData.input_image_url) {
          //   // console.log('MSA5: 입력 이미지 URL 설정:', workflowData.input_image_url);
          //   inputImage.value = workflowData.input_image_url;
          // }
          
          // 워크플로우 이름이 있으면 설정
          if (workflowData.workflow_name) {
            // console.log('MSA5: 워크플로우 이름 설정:', workflowData.workflow_name);
            workflowName.value = workflowData.workflow_name;
          }
          
          // 성공 메시지 표시
          showStatusMessage.value = true;
          statusMessage.value = 'MSA3에서 워크플로우를 성공적으로 불러왔습니다.';
          setTimeout(() => { showStatusMessage.value = false }, 3000);
          
          console.log('MSA5: 워크플로우 로드 완료');
          return;
        }
        
        // elements가 없는 경우
        console.warn('MSA5: elements 배열이 없습니다');
        showStatusMessage.value = true;
        statusMessage.value = '워크플로우에 처리할 요소가 없습니다.';
        setTimeout(() => { showStatusMessage.value = false }, 3000);
        
      } catch (error) {
        console.error('MSA5: 워크플로우 처리 중 오류 발생:', error);
        showStatusMessage.value = true;
        statusMessage.value = `워크플로우 로드 실패: ${error.message}`;
        setTimeout(() => { showStatusMessage.value = false }, 3000);
      }
    }

    // 워크플로우 구조 분석 및 로깅 함수
    const logWorkflowStructure = (data) => {
      try {
        //console.log('=== 워크플로우 구조 분석 시작 ===');
        //console.log('워크플로우 데이터 타입:', typeof data);
        //console.log('최상위 키:', Object.keys(data));
        
        // 노드 데이터 위치 탐색
        let nodesData = null;
        let nodeLocations = [];
        
        if (data.nodes && Array.isArray(data.nodes)) {
          nodesData = data.nodes;
          nodeLocations.push('nodes');
        } else if (data.elements && Array.isArray(data.elements)) {
          const nonEdgeElements = data.elements.filter(el => 
            el.type !== 'smoothstep' && el.type !== 'edge'
          );
          if (nonEdgeElements.length > 0) {
            nodesData = nonEdgeElements;
            nodeLocations.push('elements (non-edge)');
          }
        }
        
        // 노드가 발견되지 않았으면 더 깊이 탐색
        if (!nodesData) {
          Object.keys(data).forEach(key => {
            if (typeof data[key] === 'object' && data[key] !== null) {
              if (Array.isArray(data[key])) {
                // 배열인 경우, 첫 번째 항목이 노드 형태인지 확인
                if (data[key].length > 0 && 
                    typeof data[key][0] === 'object' && 
                    (data[key][0].id || data[key][0].type || data[key][0].data)) {
                  nodesData = data[key];
                  nodeLocations.push(key);
                }
              } else {
                // 객체인 경우, 내부에 nodes 또는 elements 키가 있는지 확인
                if (data[key].nodes && Array.isArray(data[key].nodes)) {
                  nodesData = data[key].nodes;
                  nodeLocations.push(`${key}.nodes`);
                } else if (data[key].elements && Array.isArray(data[key].elements)) {
                  const nonEdgeElements = data[key].elements.filter(el => 
                    el.type !== 'smoothstep' && el.type !== 'edge'
                  );
                  if (nonEdgeElements.length > 0) {
                    nodesData = nonEdgeElements;
                    nodeLocations.push(`${key}.elements (non-edge)`);
                  }
                }
              }
            }
          });
        }
        
        //console.log('노드 데이터 위치:', nodeLocations.join(', ') || '찾을 수 없음');
        
        // 노드 데이터 구조 분석
        if (nodesData && nodesData.length > 0) {
          //console.log('노드 개수:', nodesData.length);
          
          // 첫 번째 노드 상세 분석
          const sampleNode = nodesData[0];
          //console.log('샘플 노드 구조:', Object.keys(sampleNode));
          
          // 파라미터 위치 분석
          const paramLocations = [];
          
          if (sampleNode.params) {
            paramLocations.push('params');
            //console.log('params 구조:', Object.keys(sampleNode.params));
            
            // params 값 형식 분석
            const firstParamKey = Object.keys(sampleNode.params)[0];
            if (firstParamKey) {
              const firstParam = sampleNode.params[firstParamKey];
              //console.log(`params.${firstParamKey} 타입:`, typeof firstParam);
              if (typeof firstParam === 'object') {
                //console.log(`params.${firstParamKey} 구조:`, Object.keys(firstParam));
                
                // value가 있는지 확인
                if (firstParam.value !== undefined) {
                  //console.log(`params.${firstParamKey}.value 존재: 예`);
                  //console.log(`params.${firstParamKey}.value 타입:`, typeof firstParam.value);
                  //console.log(`params.${firstParamKey}.value 값:`, firstParam.value);
                }
              }
            }
          }
          
          if (sampleNode.data && sampleNode.data.params) {
            paramLocations.push('data.params');
            //console.log('data.params 구조:', Object.keys(sampleNode.data.params));
            
            // data.params 값 형식 분석
            const firstParamKey = Object.keys(sampleNode.data.params)[0];
            if (firstParamKey) {
              const firstParam = sampleNode.data.params[firstParamKey];
              //console.log(`data.params.${firstParamKey} 타입:`, typeof firstParam);
              if (typeof firstParam === 'object') {
                //console.log(`data.params.${firstParamKey} 구조:`, Object.keys(firstParam));
                
                // value가 있는지 확인
                if (firstParam.value !== undefined) {
                  //console.log(`data.params.${firstParamKey}.value 존재: 예`);
                  //console.log(`data.params.${firstParamKey}.value 타입:`, typeof firstParam.value);
                  //console.log(`data.params.${firstParamKey}.value 값:`, firstParam.value);
                }
              } else {
                //console.log(`data.params.${firstParamKey} 값:`, firstParam);
              }
            }
          }
          
          // 노드 자체에 있는 파라미터 필드 확인
          Object.keys(sampleNode).forEach(key => {
            if (key !== 'id' && key !== 'type' && key !== 'data' && key !== 'params' && 
                key !== 'position' && key !== 'label' && key !== 'icon' && 
                key !== 'connections' && typeof sampleNode[key] !== 'object') {
              paramLocations.push(key);
            }
          });
          
          if (sampleNode.data) {
            Object.keys(sampleNode.data).forEach(key => {
              if (key !== 'id' && key !== 'type' && key !== 'params' && 
                  key !== 'label' && key !== 'icon' && key !== 'nodeId' && 
                  typeof sampleNode.data[key] !== 'object') {
                paramLocations.push(`data.${key}`);
              }
            });
          }
          
          //console.log('파라미터 위치:', paramLocations.join(', ') || '찾을 수 없음');
          
          // 노드 연결 정보 분석
          const connectionLocations = [];
          
          if (sampleNode.connections) {
            connectionLocations.push('connections');
          }
          
          if (sampleNode.data && sampleNode.data.connections) {
            connectionLocations.push('data.connections');
          }
          
          if (data.edges || data.connections) {
            connectionLocations.push('별도 엣지 배열');
          }
          
          //console.log('연결 정보 위치:', connectionLocations.join(', ') || '찾을 수 없음');
        }
        
        // 전체 워크플로우 구조 요약
        //console.log('=== 워크플로우 구조 요약 ===');
        //console.log('워크플로우 이름:', data.workflow_name || data.name || '알 수 없음');
        //console.log('입력 이미지 URL:', data.input_image_url ? '있음' : '없음');
        //console.log('노드 개수:', nodesData ? nodesData.length : '알 수 없음');
        //console.log('=== 워크플로우 구조 분석 완료 ===');
      } catch (error) {
        console.error('워크플로우 구조 분석 중 오류:', error);
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
      openWorkflowSaveDialog,  // 저장 대화상자 열기 함수 추가
      
      // 워크플로우 저장 다이얼로그 관련
      showSaveWorkflowDialog,
      workflowName,
      workflowDescription,
      workflowNameInput,
      cancelSaveWorkflow,
      confirmSaveWorkflow,
      saveWorkflowToServer,  // 서버에 워크플로우 저장 함수 추가
      
      // 워크플로우 요약 함수
      getNodeSummary,
      getNodeCount,
      getConnectionCount,
      
      // 워크플로우 표시 아이템 
      getWorkflowDisplayItems,
      
      // 워크플로우 요약 아이템
      workflowSummaryItems,
      
      // 워크플로우 표시용 아이템 (노드와 연결선 포함)
      processedWorkflowItems,
      
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

</style> 