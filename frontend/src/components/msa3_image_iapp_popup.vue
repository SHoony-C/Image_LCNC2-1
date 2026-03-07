<template>
  <div v-if="show" class="popup-overlay" @click="close">
    <div class="popup-container" @click.stop>
      <div class="popup-header">
        <h3>I-TAP Image Details</h3>
        <div class="header-actions">
          <button v-if="image && image.workflow" class="load-workflow-btn" @click="loadWorkflowToMSA5">
            <i class="fas fa-file-import"></i> 워크플로우 불러오기
          </button>
        <button class="close-button" @click="close">
          <i class="fas fa-times"></i>
        </button>
        </div>
      </div>
      <div class="popup-content">
        <div class="image-section">
          <!-- 이미지 비교 섹션 -->
          <div class="image-comparison">
            <div class="before-image">
              <h4>Before</h4>
          <img :src="imageUrl" :alt="imageName" class="main-image" />
            </div>
            <div class="after-image" v-if="hasAfterImage">
              <h4>After</h4>
              <img :src="afterImageUrl" :alt="afterImageName" class="main-image" />
            </div>
          </div>
        </div>
        <div class="workflow-section">
          <div class="iapp-workflow-info" v-if="image && image.workflow">
            <!-- 워크플로우 정보 -->
            <h3>{{ workflowName }}</h3>
            <p v-if="workflowDescription">{{ workflowDescription }}</p>
            <p v-if="workflowTimestamp"><small>생성일: {{ workflowTimestamp }}</small></p>
            
            <!-- 워크플로우 노드 시각화 - 세로 방향 -->
            <div v-if="hasNodes" class="workflow-diagram">
              <h4>워크플로우</h4>
              <div class="workflow-nodes-container">
                <!-- 시작 노드 -->
                <div class="workflow-node start-node">
                  <i class="fas fa-play"></i>
                  <span>시작</span>
                </div>
                
                <!-- 중간 노드들 - 세로 배치 -->
                <div v-for="(node, index) in processedNodes" :key="node.id || index" class="workflow-node-wrapper">
                  <div class="connector-line"></div>
                  <div class="workflow-node process-node">
                    <div class="node-badge">{{ index + 1 }}</div>
                    <div class="node-content">
                      <div class="node-header">
                        <i v-if="node.data && node.data.icon" :class="node.data.icon"></i>
                        <i v-else :class="getNodeIcon(node.name || node.type || 'process')"></i>
                        <span>{{ node.data && node.data.label ? node.data.label : (node.name || '처리') }}</span>
                    </div>
                      <div class="node-option">
                        <div v-if="node.data && node.data.params">
                          <div v-for="(param, key) in getFilteredParams(node.data.params)" :key="key" class="param-item">
                            <span class="param-name">{{ formatParamName(key) }}</span>:
                            <span class="param-value">{{ typeof param === 'object' ? param.value : param }}</span>
                          </div>
                        </div>
                        <div v-else-if="node.type === 'clahe'" class="param-item">
                          <span class="param-name">Clip limit</span>: <span class="param-value">2.0</span><br>
                          <span class="param-name">Tile grid size</span>: <span class="param-value">8</span>
                        </div>
                        <div v-else-if="node.type === 'median_filter' || node.type === 'median'" class="param-item">
                          <span class="param-name">Kernel size</span>: <span class="param-value">3</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- 연결선 -->
                <div class="connector-line"></div>
                
                <!-- 종료 노드 -->
                <div class="workflow-node end-node">
                  <i class="fas fa-stop"></i>
                  <span>종료</span>
                </div>
              </div>
            </div>
            
            <!-- 워크플로우 메타데이터 -->
            <div class="workflow-metadata">
              <div class="metadata-row" v-if="image.workflow.workflow_id">
                <span class="metadata-label">워크플로우 ID:</span>
                <span class="metadata-value">{{ image.workflow.workflow_id }}</span>
              </div>
              <div class="metadata-row" v-if="image.workflow.workflow_name">
                <span class="metadata-label">워크플로우 이름:</span>
                <span class="metadata-value">{{ image.workflow.workflow_name }}</span>
              </div>
              <div class="metadata-row" v-if="image.workflow.input_image_filename">
                <span class="metadata-label">입력 이미지:</span>
                <span class="metadata-value">{{ getShortFilename(image.workflow.input_image_filename) }}</span>
              </div>
              <div class="metadata-row" v-if="image.workflow.output_image_filename">
                <span class="metadata-label">출력 이미지:</span>
                <span class="metadata-value">{{ getShortFilename(image.workflow.output_image_filename) }}</span>
              </div>
            </div>
          </div>
          
          <div class="iapp-workflow-info workflow-not-found" v-else-if="image && image.workflowStatus === 'not_found'">
            <h3>워크플로우 정보 없음</h3>
            <p>이 이미지에 대한 워크플로우 데이터를 찾을 수 없습니다.</p>
            <p><small>이미지 파일명: {{ image.name }}</small></p>
          </div>
          
          <div class="iapp-workflow-info workflow-error" v-else-if="image && image.workflowStatus === 'error'">
            <h3>워크플로우 정보 오류</h3>
            <p>워크플로우 데이터를 불러오는 중 오류가 발생했습니다.</p>
            <p><small>이미지 파일명: {{ image.name }}</small></p>
          </div>
          
          <div class="iapp-workflow-info workflow-loading" v-else-if="image && image.isLoading">
            <h3>워크플로우 정보 로딩 중...</h3>
            <div class="loading-spinner">
              <div class="spinner"></div>
            </div>
          </div>
          
          <div class="iapp-workflow-info workflow-unknown" v-else-if="image">
            <h3>워크플로우 상태 불명</h3>
            <p>워크플로우 상태: {{ image.workflowStatus || '알 수 없음' }}</p>
            <p><small>이미지 파일명: {{ image.name }}</small></p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import '@/assets/css/msa3_image_iapp_popup.css'
// Composables
import { useImageData } from '../composables/msa3_iapp_useImageData'
import { useWorkflow } from '../composables/msa3_iapp_useWorkflow'
import { useActions } from '../composables/msa3_iapp_useActions'

export default {
  name: 'ImageIAppPopup',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    imageUrl: {
      type: String,
      required: true
    },
    imageName: {
      type: String,
      required: true
    },
    image: Object
  },
  setup(props, { emit }) {
    // =============================================
    // 1. Image Data (before/after images)
    // =============================================
    const {
      hasAfterImage,
      afterImageName,
      afterImageUrl
    } = useImageData(props)

    // =============================================
    // 2. Workflow (metadata, node processing, formatting, debugging)
    // =============================================
    const {
      formatDate,
      getNodeIcon,
      getShortFilename,
      formatParamName,
      formatParamValue,
      getFilteredParams,
      getWorkflowName,
      getWorkflowDescription,
      getWorkflowTimestamp,
      hasWorkflowNodes,
      getWorkflowNodes,
      getNodeType,
      getNodeLabel,
      processNodes,
      inspectWorkflowStructure,
      debugWorkflow,
      workflowName,
      workflowDescription,
      workflowTimestamp,
      hasNodes,
      processedNodes,
      nodeCount
    } = useWorkflow(props)

    // =============================================
    // 3. Actions (close, load workflow to MSA5, event bus)
    // =============================================
    const {
      close,
      loadWorkflowToMSA5
    } = useActions(props, { emit })

    // =============================================
    // Return all template bindings
    // =============================================
    return {
      // Image data
      hasAfterImage,
      afterImageName,
      afterImageUrl,

      // Workflow computed properties
      workflowName,
      workflowDescription,
      workflowTimestamp,
      hasNodes,
      processedNodes,
      nodeCount,

      // Workflow helper functions
      formatDate,
      getNodeIcon,
      getShortFilename,
      formatParamName,
      formatParamValue,
      getFilteredParams,
      getWorkflowName,
      getWorkflowDescription,
      getWorkflowTimestamp,
      hasWorkflowNodes,
      getWorkflowNodes,
      getNodeType,
      getNodeLabel,
      processNodes,
      inspectWorkflowStructure,
      debugWorkflow,

      // Actions
      close,
      loadWorkflowToMSA5
    }
  }
};
</script>

<style scoped>
</style> 