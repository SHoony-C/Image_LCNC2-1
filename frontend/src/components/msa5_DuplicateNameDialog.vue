<template>
  <Teleport to="body">
    <div class="duplicate-name-overlay" v-if="show" @click="$emit('close')">
      <div class="duplicate-name-dialog" @click.stop>
        <div class="dialog-header">
          <h3>중복 이름 확인</h3>
          <button class="close-btn" @click="$emit('close')">
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
              :value="newWorkflowName"
              @input="$emit('update:newWorkflowName', $event.target.value)"
              placeholder="새로운 워크플로우 이름을 입력하세요"
              class="workflow-name-input"
              ref="newWorkflowNameInput"
              @keyup.enter="$emit('apply')"
            >
            <small class="input-help-text">공백은 자동으로 언더스코어(_)로 변환됩니다.</small>
          </div>
        </div>
        <div class="dialog-footer">
          <button class="cancel-btn" @click="$emit('close')">취소</button>
          <button class="ok-btn" @click="$emit('apply')">저장</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script>
export default {
  name: 'MSA5DuplicateNameDialog',
  props: {
    show: { type: Boolean, default: false },
    newWorkflowName: { type: String, default: '' },
  },
  emits: ['close', 'apply', 'update:newWorkflowName'],
}
</script>

<style scoped>
</style>
