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
      v-if="showMeasurementPopup"
      :imageUrl="finalImage"
      :showPopup="showMeasurementPopup"
      @close="closeMeasurementPopup"
    />
  </div>
</template>

<script>
import MSA6ImagePopup from './msa6_image_popup.vue'

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
    window.addEventListener('msa5-image-processed', this.handleMSA5ImageProcessed)
  },
  beforeUnmount() {
    window.removeEventListener('msa5-image-processed', this.handleMSA5ImageProcessed)
  },
  methods: {
    handleMSA5ImageProcessed(event) {
      if (event.detail && event.detail.imageUrl) {
        this.finalImage = event.detail.imageUrl
        this.showResult = true
      }
    },
    toggleMaximize() {
      this.isMaximized = !this.isMaximized
    },
    openMeasurementPopup() {
      if (this.finalImage) {
        this.showMeasurementPopup = true
      }
    },
    closeMeasurementPopup() {
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
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  opacity: 0;
  transition: opacity 0.2s ease;
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