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
import { ref, onMounted, onUnmounted, reactive, computed } from 'vue'
import { VueFlow, Handle } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import '@/assets/css/msa5_image_lcnc.css'
import '@vue-flow/core/dist/style.css'

// Composables
import { useNodeProcessor } from '../composables/msa5_useNodeProcessor'
import { useWorkflowHistory } from '../composables/msa5_useWorkflowHistory'
import { useWorkflowValidation } from '../composables/msa5_useWorkflowValidation'
import { useWorkflowPersistence } from '../composables/msa5_useWorkflowPersistence'
import { useWorkflowExecution } from '../composables/msa5_useWorkflowExecution'
import { useDragDrop } from '../composables/msa5_useDragDrop'
import { useVueFlow } from '../composables/msa5_useVueFlow'
import { useImageManagement } from '../composables/msa5_useImageManagement'
import { useUIState } from '../composables/msa5_useUIState'
import { useCrossComponent } from '../composables/msa5_useCrossComponent'

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
    // =============================================
    // Core shared state
    // =============================================
    const hasInput = ref(false)
    const hasOutput = ref(false)
    const elements = ref([])
    const selectedNode = ref(null)
    const selectedEdge = ref(null)
    const inputImage = ref('')
    const processedImages = reactive({})
    const processingStatus = ref('idle')
    const previewImageUrl = ref(null)
    const availableNodes = ref([])
    const isNodesLoading = ref(true)
    const defaultOptions = ref({})
    const workflowArea = ref(null)
    const canSaveWorkflow = ref(false)

    // 노드 필터링을 위한 computed 속성
    const filteredNodes = computed(() => {
      return availableNodes.value ? availableNodes.value.filter(n => n && n.id !== 'merge') : []
    })

    // 병합 노드를 위한 computed 속성
    const mergeNode = computed(() => {
      return availableNodes.value ? availableNodes.value.find(n => n && n.id === 'merge') : null
    })

    // 연결 상태 업데이트
    const updateConnections = () => {
      const connections = elements.value.filter(el => el.type === 'smoothstep')
      hasInput.value = connections.some(conn => conn.source === 'start')
      hasOutput.value = connections.some(conn => conn.target === 'end')
    }

    // 초기 엘리먼트 설정
    const initializeElements = () => {
      elements.value = [
        { id: 'start', type: 'start', position: { x: 100, y: 100 }, data: { label: '시작' } },
        { id: 'end', type: 'end', position: { x: 500, y: 300 }, data: { label: '종료' } }
      ]
    }

    // =============================================
    // 1. Workflow History (undo/redo)
    // =============================================
    const {
      undoStack,
      redoStack,
      saveToHistory,
      undo,
      redo
    } = useWorkflowHistory(elements, updateConnections)

    // =============================================
    // 2. UI State (maximize, preview, status, delete, keyboard, summary)
    // =============================================
    const {
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
    } = useUIState(
      elements, selectedNode, selectedEdge, previewImageUrl,
      saveToHistory, updateConnections, undo, redo,
      canSaveWorkflow,
      processingStatus
    )

    // =============================================
    // 3. Node Processor
    // =============================================
    const errorDialogState = {
      showWorkflowErrorDialog,
      workflowErrorTitle,
      workflowErrorMessage,
      workflowErrorDetails
    }

    const {
      getDefaultParams,
      resolveNodeType,
      processNode,
      processMergeNode,
      setProcessedImage,
      revokeAllProcessedImages,
      cleanupDeletedNodeImages,
      detectImageFormat
    } = useNodeProcessor(elements, processedImages, defaultOptions, errorDialogState)

    // =============================================
    // 4. Workflow Validation
    // =============================================
    const {
      validateWorkflow,
      findProcessingPath
    } = useWorkflowValidation(elements, inputImage)

    // =============================================
    // 5. Workflow Persistence
    // =============================================
    const uiStateForPersistence = { showStatusMessage, statusMessage, statusType }

    const {
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
    } = useWorkflowPersistence(
      elements, inputImage, processedImages, processingStatus,
      uiStateForPersistence, errorDialogState,
      getNodeSummary, initializeElements, getDefaultParams, defaultOptions,
      canSaveWorkflow
    )

    // =============================================
    // 6. Image Management
    // =============================================
    const persistenceStateForImage = {
      canSaveWorkflow,
      currentImageTitle,
      calculateImageHash,
      checkSavedWorkflow,
      workflowName,
      workflowDescription
    }

    const {
      setImage,
      sendImageToMSA6,
      exportImagesToExternal,
      findSimilarForEndImage,
      handleMSA6Transfer
    } = useImageManagement(
      elements, inputImage, processedImages,
      uiStateForPersistence, persistenceStateForImage
    )

    // =============================================
    // 7. Workflow Execution
    // =============================================
    const {
      processingQueue,
      processStart,
      processWorkflow
    } = useWorkflowExecution(
      elements, inputImage, processedImages, processingStatus,
      uiStateForPersistence, errorDialogState,
      validateWorkflow, processNode, processMergeNode, sendImageToMSA6,
      canSaveWorkflow, hasOutput
    )

    // =============================================
    // 8. VueFlow instance management
    // =============================================
    const {
      flowInstance,
      onInit,
      onPaneReady,
      onNodeDragStop,
      onConnect,
      onNodeClick,
      onEdgeClick,
      handleCanvasClick
    } = useVueFlow(
      elements, selectedNode, selectedEdge,
      getDefaultParams, defaultOptions,
      saveToHistory, updateConnections,
      canSaveWorkflow, processingStatus
    )

    // =============================================
    // 9. Drag & Drop
    // =============================================
    const {
      onDragStart,
      onDragOver,
      onDrop
    } = useDragDrop(
      elements, selectedNode, flowInstance, workflowArea,
      getDefaultParams, defaultOptions,
      saveToHistory, canSaveWorkflow, processingStatus
    )

    // =============================================
    // 10. Cross-Component Communication
    // =============================================
    const persistenceStateForCross = {
      workflowName,
      prepareElementsForLoad
    }

    const {
      handleImageUpdate,
      handleWorkflowFromMSA4,
      handleWorkflowFromMSA3
    } = useCrossComponent(
      elements, inputImage, processedImages,
      uiStateForPersistence, persistenceStateForCross, setImage
    )

    // =============================================
    // Backend node loading
    // =============================================
    const loadAvailableNodes = async () => {
      isNodesLoading.value = true

      try {
        const apiUrl = 'http://localhost:8000/api/msa5/nodes'
        console.time('API 호출 시간')

        try {
          const response = await fetch(apiUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            mode: 'cors',
            credentials: 'include'
          })
          console.timeEnd('API 호출 시간')

          if (response.ok) {
            try {
              const data = await response.json()

              if (data.options && Array.isArray(data.options)) {
                availableNodes.value = data.options

                if (data.defaultOptions) {
                  defaultOptions.value = data.defaultOptions
                }
              } else {
                console.warn('백엔드 응답에 options 배열이 없거나 형식이 맞지 않습니다:', data)
              }
            } catch (parseError) {
              console.error('JSON 파싱 오류:', parseError)
            }
          } else {
            console.error(`API 요청 실패: ${response.status} ${response.statusText}`)
            const errorText = await response.text()
            console.error('오류 응답 내용:', errorText)
          }
        } catch (fetchError) {
          console.timeEnd('API 호출 시간')
          console.error('fetch 호출 오류:', fetchError)
          console.error('오류 세부 정보:', {
            name: fetchError.name,
            message: fetchError.message,
            stack: fetchError.stack
          })
        }
      } finally {
        initializeElements()
        isNodesLoading.value = false
      }
    }

    // =============================================
    // Lifecycle hooks
    // =============================================
    onMounted(() => {
      // 이벤트 리스너 등록
      document.addEventListener('msa4-to-msa5-image', handleImageUpdate)
      document.addEventListener('msa1-to-msa5-image', handleImageUpdate)
      document.addEventListener('msa4-to-msa5-workflow', handleWorkflowFromMSA4)
      document.addEventListener('load-workflow-to-msa5', handleWorkflowFromMSA3)

      if (window.MSAEventBus) {
        window.MSAEventBus.on('load-workflow-to-msa5', handleWorkflowFromMSA3)
      }

      // 노드 목록 로드
      loadAvailableNodes()

      // 페이지 새로고침 시 MSA5 상태 초기화
      sessionStorage.removeItem('msa5_end_image')
      sessionStorage.removeItem('msa5_processing')

      // 기본 워크플로우 로드
      loadDefaultWorkflow()

      // 키보드 이벤트 리스너 추가
      window.addEventListener('keydown', handleKeyDown)

      // 워크플로우 저장 목록 로드
      loadSavedWorkflows()
    })

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

    // =============================================
    // Return all template bindings
    // =============================================
    return {
      // Core state
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

      // Process execution
      processStart,

      // Drag & drop
      onDragStart,
      onDragOver,
      onDrop,

      // VueFlow
      onInit,
      onConnect,
      onNodeClick,
      onEdgeClick,
      onNodeDragStop,
      onPaneReady,

      // Available nodes
      availableNodes,
      isNodesLoading,
      filteredNodes,
      mergeNode,

      // DOM refs
      containerRef,
      workflowArea,

      // Undo/redo
      undo,
      redo,
      deleteSelectedNode,
      deleteSelectedEdge,
      handleKeyDown,
      handleCanvasClick,

      // Workflow persistence
      saveWorkflow,
      canSaveWorkflow,
      savedWorkflows,
      loadWorkflow,
      openWorkflowSaveDialog,

      // Save dialog
      showSaveWorkflowDialog,
      workflowName,
      workflowDescription,
      workflowNameInput,
      cancelSaveWorkflow,
      confirmSaveWorkflow,
      saveWorkflowToServer,

      // Summary
      getNodeSummary,
      getNodeCount,
      getConnectionCount,
      getWorkflowDisplayItems,
      workflowSummaryItems,
      processedWorkflowItems,

      // External storage
      exportImagesToExternal,

      // Similar image search
      findSimilarForEndImage,

      // MSA6
      handleMSA6Transfer,
      sendImageToMSA6,

      // Duplicate name dialog
      showDuplicateNameDialog,
      closeDuplicateNameDialog,
      newWorkflowName,
      newWorkflowNameInput,
      applyNewName,
      showDuplicateNameWarning,
      showDuplicateNameError,

      // Validation
      validateWorkflow,

      // Error dialog
      showWorkflowErrorDialog,
      workflowErrorTitle,
      workflowErrorMessage,
      workflowErrorDetails,
      closeWorkflowErrorDialog,
      statusMessage,
      statusType,
      setStatusMessage,

      // Status message
      showStatusMessage,
    }
  }
}
</script>

<style scoped>

</style>
