<template>
  <div class="msa-component" :class="{ maximized: isMaximized }">
    <div class="component-header">
      <div class="header-left">
        <i class="fas fa-image"></i>
        <span>최종 결과</span>
      </div>
      <div class="header-right">
        <button @click="toggleMaximize" class="maximize-btn">
          <i :class="isMaximized ? 'fas fa-compress' : 'fas fa-expand'"></i>
        </button>
      </div>
    </div>

    <div class="result-container">
      <div v-if="showResult" class="result-content">
        <div class="result-image" @click="openMeasurementPopup">
          <img :src="finalImage" alt="Final Result" />
          <div class="measurement-hint">
            <i class="fas fa-ruler"></i>
            <span>이미지를 클릭하여 측정 도구 열기</span>
          </div>
        </div>
      </div>
      <div v-else class="no-result">
        <i class="fas fa-image"></i>
        <span>처리된 이미지가 없습니다</span>
      </div>
    </div>

    <!-- 이미지 측정 팝업 -->
    <MSA6ImagePopup
      v-show="showMeasurementPopup && finalImage"
      :imageUrl="finalImage"
      :showPopup="showMeasurementPopup"
      @close="closeMeasurementPopup"
    />
  </div>
</template>

<script>
import MSA6ImagePopup from './msa6_image_popup1.vue'

export default {
  name: 'MSA6FinalResult',
  components: {
    MSA6ImagePopup
  },
  data() {
    return {
      isMaximized: false,
      finalImage: null,
      showResult: false,
      showMeasurementPopup: false
    }
  },
  mounted() {
    // MSA5 이미지 처리 이벤트 리스너 등록
    window.addEventListener('msa5-image-processed', this.handleMSA5ImageProcessed)
    
    // 측정 팝업 컴포넌트가 항상 존재하지만 처음에는 보이지 않게 설정
    this.showMeasurementPopup = false
    
    // MSA5 이미지 처리 완료 여부 확인 (초기화)
    const isWorkflowCompleted = localStorage.getItem('msa5_workflow_completed') === 'true';
    console.log('MSA6: 워크플로우 처리 완료 여부:', isWorkflowCompleted);
    
    // 워크플로우가 완료된 경우에만 이미지 표시
    if (isWorkflowCompleted && localStorage.getItem('msa6_final_image')) {
      console.log('MSA6: 기존에 처리된 이미지 로드');
      this.finalImage = localStorage.getItem('msa6_final_image')
      this.showResult = true
    } else {
      // 워크플로우가 완료되지 않았으면 이미지 초기화
      console.log('MSA6: 워크플로우가 완료되지 않아 이미지 표시하지 않음');
      this.finalImage = null;
      this.showResult = false;
      // 저장된 이미지도 제거
      localStorage.removeItem('msa6_final_image');
      localStorage.removeItem('msa5_workflow_completed');
    }
  },
  beforeUnmount() {
    window.removeEventListener('msa5-image-processed', this.handleMSA5ImageProcessed)
  },
  methods: {
    handleMSA5ImageProcessed(event) {
      if (event.detail && event.detail.imageUrl) {
        this.finalImage = event.detail.imageUrl
        this.showResult = true
        
        // 이미지 URL을 localStorage에 저장하여 페이지 새로고침 시에도 유지
        localStorage.setItem('msa6_final_image', event.detail.imageUrl)
      }
    },
    toggleMaximize() {
      this.isMaximized = !this.isMaximized
    },
    openMeasurementPopup() {
      if (this.finalImage) {
        console.log('Opening measurement popup with image:', this.finalImage)
        this.showMeasurementPopup = true
      }
    },
    closeMeasurementPopup() {
      console.log('Closing measurement popup, data will be preserved')
      this.showMeasurementPopup = false
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

.result-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: #f8fafc;
}

.result-content {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.result-image {
  position: relative;
  max-width: 100%;
  max-height: 100%;
  cursor: pointer;
  transition: all 0.2s ease;
}

.result-image:hover {
  transform: scale(1.02);
}

.result-image img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.measurement-hint {
  position: absolute;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 1rem 2rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 1.1rem;
  opacity: 0;
  transition: opacity 0.3s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  white-space: nowrap;
}

.measurement-hint i {
  font-size: 1.4rem;
  color: #7950f2;
}

.result-image:hover .measurement-hint {
  opacity: 1;
}

.no-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  color: #64748b;
}

.no-result i {
  font-size: 3rem;
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
</style> 