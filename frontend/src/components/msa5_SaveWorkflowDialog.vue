<template>
  <Teleport to="body">
    <div class="save-workflow-overlay" v-if="show" @click="$emit('cancel')">
      <div class="save-workflow-dialog" @click.stop>
        <div class="dialog-header">
          <h3>워크플로우 저장</h3>
          <button class="close-btn" @click="$emit('cancel')">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="dialog-content">
          <div class="form-group">
            <label for="workflow-name">워크플로우 이름</label>
            <input
              type="text"
              id="workflow-name"
              :value="workflowName"
              @input="$emit('update:workflowName', $event.target.value)"
              placeholder="저장할 워크플로우 이름을 입력하세요"
              class="workflow-name-input"
              ref="workflowNameInput"
              @keyup.enter="$emit('confirm')"
            >
            <small class="input-help-text">공백은 자동으로 언더스코어(_)로 변환됩니다.</small>
          </div>
          <div class="form-group">
            <label for="workflow-desc">설명 (선택사항)</label>
            <textarea
              id="workflow-desc"
              :value="workflowDescription"
              @input="$emit('update:workflowDescription', $event.target.value)"
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
              <div class="preview-image-container" v-if="endImage">
                <img :src="endImage" alt="결과 이미지" class="mini-preview">
              </div>
              <div class="no-image" v-else>이미지 없음</div>
            </div>
          </div>

          <div class="workflow-summary">
            <label>워크플로우 요약:</label>
            <div class="workflow-nodes-container">
              <div class="workflow-node-list">
                <div class="workflow-node start-node-mini">
                  <i class="fas fa-play"></i>
                  <span>시작</span>
                </div>

                <div v-for="node in nodeSummary" :key="node.id" class="workflow-node">
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
          <button class="cancel-btn" @click="$emit('cancel')">취소</button>
          <button class="save-btn" @click="$emit('confirm')">저장</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script>
export default {
  name: 'MSA5SaveWorkflowDialog',
  props: {
    show: { type: Boolean, default: false },
    workflowName: { type: String, default: '' },
    workflowDescription: { type: String, default: '' },
    inputImage: { type: String, default: '' },
    endImage: { type: String, default: null },
    nodeSummary: { type: Array, default: () => [] },
  },
  emits: ['cancel', 'confirm', 'update:workflowName', 'update:workflowDescription'],
}
</script>

<style scoped>
</style>
