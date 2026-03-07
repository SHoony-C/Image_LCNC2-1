<template>
  <div>
    <!-- 불량 감지 로딩 오버레이 -->
    <div class="defect-detection-loading-overlay" v-show="isDefectDetecting">
      <div class="loading-content">
        <div class="loading-spinner"><div class="spinner-ring"></div></div>
        <h4 class="loading-title">불량 감지 진행 중...</h4>
        <p class="loading-message">측정하는 동안 잠시만 기다려주세요</p>
        <div class="loading-warning">
          <i class="fas fa-exclamation-triangle"></i>
          <span>감지 중에는 다른 작업을 수행할 수 없습니다</span>
        </div>
        <button class="emergency-stop-btn" @click="$emit('emergencyStop')" title="불량 감지 즉시 중단">
          <i class="fas fa-stop"></i><span>즉시 중단</span>
        </button>
      </div>
    </div>

    <!-- 도움말 단축키 오버레이 -->
    <div class="shortcut-help-overlay" :class="{ show: showShortcutHelp }">
      <div class="shortcut-help-content" :class="{ show: showShortcutHelp }">
        <h2>단축키 도움말</h2>
        <div class="shortcut-grid">
          <div class="shortcut-item" v-for="item in shortcuts" :key="item.key">
            <div class="shortcut-key">{{ item.key }}</div>
            <div class="shortcut-desc">{{ item.desc }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 초기화 확인 팝업 -->
    <div class="reset-confirmation-overlay" v-show="showResetConfirmPopup" @click.self="$emit('cancelReset')">
      <div class="reset-confirmation-popup">
        <div class="popup-header">
          <h3>측정 결과 초기화</h3>
          <button class="popup-close-btn" @click="$emit('cancelReset')">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="popup-content">
          <div class="warning-icon"><i class="fas fa-exclamation-triangle"></i></div>
          <p class="warning-message">모든 측정 결과를 초기화하시겠습니까?</p>
          <p class="warning-detail">이 작업은 되돌릴 수 없습니다.</p>
          <ul class="reset-items">
            <li> 모든 선 측정 결과</li>
            <li> 불량 감지 결과</li>
            <li> 기준선</li>
            <li> Item ID 및 Sub ID 카운터</li>
          </ul>
        </div>
        <div class="popup-actions">
          <button class="cancel-btn" @click="$emit('cancelReset')">
            <i class="fas fa-times"></i> 취소
          </button>
          <button class="confirm-btn" @click="$emit('confirmReset')">
            <i class="fas fa-trash-alt"></i> 초기화
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
const SHORTCUT_LIST = [
  { key: 'F', desc: '밝기값 보기 및 돋보기 활성화 (누르고 있는 동안)' },
  { key: 'A', desc: '영역 선 측정 모드 (한번 더 누르면 수직/수평 방향 전환)' },
  { key: 'S', desc: '단일 선 측정 모드 활성화' },
  { key: 'C', desc: 'Cut - 기준선 그리기 모드 활성화' },
  { key: 'D', desc: '선택된 측정 결과 삭제' },
  { key: 'H', desc: '도움말 표시 (누르고 있는 동안)' },
  { key: 'R', desc: '불량 감지 모드 활성화 (Recognition)' },
  { key: 'Ctrl+Z', desc: '측정 실행 취소' },
  { key: 'Ctrl+Y', desc: '측정 다시 실행' },
]

export default {
  name: 'MSA6PopupOverlays',
  props: {
    isDefectDetecting: { type: Boolean, default: false },
    showShortcutHelp: { type: Boolean, default: false },
    showResetConfirmPopup: { type: Boolean, default: false },
  },
  emits: ['emergencyStop', 'cancelReset', 'confirmReset'],
  data() {
    return { shortcuts: SHORTCUT_LIST }
  },
}
</script>

<style scoped>
</style>
