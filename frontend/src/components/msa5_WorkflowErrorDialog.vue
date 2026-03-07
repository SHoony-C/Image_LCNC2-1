<template>
  <Teleport to="body">
    <div class="workflow-error-overlay" v-if="show" @click="$emit('close')">
      <div class="workflow-error-dialog" @click.stop>
        <div class="error-icon">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <div class="error-message">
          <div class="error-main-message">{{ title }}</div>
          <div class="error-details">{{ message }}</div>
          <div class="error-tips">
            <h4>{{ details }}</h4>
            <ul>
              <li>{{ details }}</li>
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
          <button class="ok-btn" @click="$emit('close')">확인</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script>
export default {
  name: 'MSA5WorkflowErrorDialog',
  props: {
    show: { type: Boolean, default: false },
    title: { type: String, default: '' },
    message: { type: String, default: '' },
    details: { type: String, default: '' },
  },
  emits: ['close'],
}
</script>

<style scoped>
</style>
