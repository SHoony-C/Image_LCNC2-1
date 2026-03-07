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

        <div class="preprocessing-nodes-wrapper">
          <div class="preprocessing-nodes-container">
            <template v-if="availableNodes && filteredNodes.length > 0">
              <div v-for="node in filteredNodes" :key="node.id" class="palette-node"
                  draggable="true" @dragstart="onDragStart($event, node)">
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

        <div class="merge-palette-section">
          <div v-if="mergeNode" class="merge-node-container" draggable="true"
              @dragstart="onDragStart($event, mergeNode)">
            <div class="merge-node-preview">
              <div class="diamond-preview"><i class="fas fa-object-group"></i></div>
              <span>이미지 병합</span>
            </div>
            <div class="merge-node-desc">여러 이미지를 하나로 병합합니다 (최대 5개 입력)</div>
          </div>
        </div>
      </div>

      <div class="workflow-area" @dragover="onDragOver" @drop="onDrop" @click="handleCanvasClick" ref="workflowArea">
        <div class="workflow-error-highlight" v-if="processingStatus === 'error'"></div>

        <VueFlow v-model="elements"
          :default-viewport="{ x: 0, y: 0, zoom: 0.7 }"
          :style="{ width: '100%', height: 'calc(100% - 40px)' }"
          @connect="onConnect" @node-drag-stop="onNodeDragStop" @node-click="onNodeClick" @edge-click="onEdgeClick"
          :min-zoom="0.2" :max-zoom="2" :snap-to-grid="true" :snap-grid="[15, 15]"
          :fit-view-on-init="true" :auto-connect="false"
          @pane-ready="onPaneReady" @init="onInit">
          <Background pattern-color="#aaa" gap="8" />
          <Controls />
          <MiniMap ref="minimap" node-color="#8b5cf6" mask-color="rgba(139, 92, 246, 0.1)"
            class="custom-minimap" :pannable="true" />

          <template #node-start>
            <div class="start-node" :class="{ 'has-connection': hasInput, 'has-image': !!inputImage }">
              <Handle type="source" position="right" />
              <div class="node-header"><i class="fas fa-play"></i><span>시작</span></div>
              <div class="node-image" v-if="inputImage" @click.stop="openImagePreview(inputImage)">
                <img :src="inputImage" alt="Input image" />
              </div>
            </div>
          </template>

          <template #node-end>
            <div class="end-node" :class="{ 'has-connection': hasOutput, 'has-image': !!processedImages['end'] }">
              <Handle type="target" position="left" />
              <div class="node-header"><i class="fas fa-stop"></i><span>종료</span></div>
              <div class="node-image" v-if="processedImages['end']" @click.stop="openImagePreview(processedImages['end'])">
                <img :src="processedImages['end']" alt="Output image" />
              </div>
            </div>
          </template>

          <template #node-custom="nodeProps">
            <div class="workflow-node">
              <Handle type="target" position="left" />
              <Handle type="source" position="right" />
              <div class="node-header"><i :class="nodeProps.data.icon"></i><span>{{ nodeProps.data.label }}</span></div>
              <div class="node-image" v-if="processedImages[nodeProps.id]" @click.stop="openImagePreview(processedImages[nodeProps.id])">
                <img :src="processedImages[nodeProps.id]" alt="Processed image" />
              </div>
            </div>
          </template>

          <template #node-merge="nodeProps">
            <div class="merge-node">
              <Handle type="target" position="left" />
              <Handle type="source" position="right" />
              <div class="node-header"><i :class="nodeProps.data.icon"></i><span>{{ nodeProps.data.label }}</span></div>
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
          <button class="close-btn" @click="selectedNode = null"><i class="fas fa-times"></i></button>
        </div>
        <div class="panel-content">
          <div v-for="(param, key) in selectedNode.data.params" :key="key" class="param-item">
            <label>{{ param.label }}</label>
            <template v-if="param.options">
              <select v-model="param.value" class="param-input">
                <option v-for="option in param.options" :key="option" :value="option">{{ option }}</option>
              </select>
            </template>
            <template v-else>
              <input type="number" v-model="param.value" class="param-input" :min="param.min" :max="param.max" :step="param.step">
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
            <button class="close-preview-btn" @click="closeImagePreview"><i class="fas fa-times"></i></button>
          </div>
          <div class="preview-content">
            <img :src="previewImageUrl" alt="Preview" class="preview-image">
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 서브컴포넌트 다이얼로그 -->
    <MSA5SaveWorkflowDialog
      :show="showSaveWorkflowDialog"
      v-model:workflowName="workflowName"
      v-model:workflowDescription="workflowDescription"
      :inputImage="inputImage"
      :endImage="processedImages['end']"
      :nodeSummary="getNodeSummary()"
      @cancel="cancelSaveWorkflow"
      @confirm="confirmSaveWorkflow"
    />

    <MSA5WorkflowErrorDialog
      :show="showWorkflowErrorDialog"
      :title="workflowErrorTitle"
      :message="workflowErrorMessage"
      :details="workflowErrorDetails"
      @close="closeWorkflowErrorDialog"
    />

    <MSA5DuplicateNameDialog
      :show="showDuplicateNameDialog"
      v-model:newWorkflowName="newWorkflowName"
      @close="closeDuplicateNameDialog"
      @apply="applyNewName"
    />
  </div>
</template>

<script>
import { VueFlow, Handle } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import '@/assets/css/msa5_image_lcnc.css'
import '@vue-flow/core/dist/style.css'

import { useSetup } from '../composables/msa5_useSetup'
import MSA5SaveWorkflowDialog from './msa5_SaveWorkflowDialog.vue'
import MSA5WorkflowErrorDialog from './msa5_WorkflowErrorDialog.vue'
import MSA5DuplicateNameDialog from './msa5_DuplicateNameDialog.vue'

export default {
  name: 'MSA5ImageLCNC',
  components: {
    VueFlow, Background, Controls, Handle, MiniMap,
    MSA5SaveWorkflowDialog, MSA5WorkflowErrorDialog, MSA5DuplicateNameDialog
  },
  props: {
    initialImage: { type: String, default: null }
  },
  setup(props) {
    return useSetup(props)
  }
}
</script>

<style scoped>
</style>
