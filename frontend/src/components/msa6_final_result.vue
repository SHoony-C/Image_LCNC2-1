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
      ref="measurementPopup"
      v-show="showMeasurementPopup && finalImage"
      :imageUrl="finalImage"
      :inputImageUrl="inputImage"
      :showPopup="showMeasurementPopup"
      @update:showPopup="showMeasurementPopup = $event"
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
      finalImage: '',
      showResult: false,
      showMeasurementPopup: false,
      inputImage: null,
      msa5ImageAvailable: false
    }
  },
  mounted() {
    // MSA5 이미지 처리 이벤트 리스너 등록
    window.addEventListener('msa5-image-processed', this.handleMSA5ImageProcessed)
    
    // 측정 팝업 컴포넌트가 항상 존재하지만 처음에는 보이지 않게 설정
    this.showMeasurementPopup = false
    
    // 새로고침 후 처음 로드 시 이미지 초기화 이벤트 리스너 추가
    window.addEventListener('load', this.clearImageOnReload)
    
    // 팝업 닫힘 이벤트 리스너 추가
    window.addEventListener('msa6-popup-closed', () => {
      console.log('MSA6: 팝업 닫힘 이벤트 수신')
      this.showMeasurementPopup = false
      this.$nextTick(() => this.closeMeasurementPopup())
    })
    
    // 페이지 로드 시 MSA5 상태 확인 후 이미지 표시 여부 결정
    this.checkMSA5StatusAndUpdateImage()
  },
  beforeUnmount() {
    window.removeEventListener('msa5-image-processed', this.handleMSA5ImageProcessed)
    window.removeEventListener('load', this.clearImageOnReload)
    window.removeEventListener('msa6-popup-closed', () => {})
  },
  methods: {
    // MSA5 상태를 확인하고 이미지 표시 여부 결정하는 메소드 추가
    checkMSA5StatusAndUpdateImage() {
      // 페이지 새로고침 시에는 MSA5 end 노드에 이미지가 없기 때문에 MSA6도 초기화해야 함
      const hasMSA5EndImage = sessionStorage.getItem('msa5_end_image')
      console.log('MSA6: MSA5 이미지 상태 확인 - 종료 이미지 있음:', hasMSA5EndImage)
      
      if (hasMSA5EndImage === 'true') {
        // MSA5에 종료 이미지가 있으면 MSA6도 이미지 표시
        this.msa5ImageAvailable = true
        
        // 로컬 스토리지에서 최종 이미지 가져오기
        if (localStorage.getItem('msa6_final_image')) {
          this.finalImage = localStorage.getItem('msa6_final_image')
          this.showResult = true
          console.log('MSA6: 로컬 스토리지에서 최종 이미지 로드됨')
          
          // MSA5 입력 이미지 URL 저장 (세션 스토리지에서 가져오기)
          this.inputImage = sessionStorage.getItem('msa5_start_image_url')
          console.log('MSA6: MSA5 입력 이미지 URL 로드됨:', this.inputImage ? '있음' : '없음')
        } else {
          console.log('MSA6: 로컬 스토리지에 저장된 이미지 없음')
          this.showResult = false
        }
      } else {
        // MSA5에 이미지가 없으면 MSA6도 이미지 표시하지 않음
        this.msa5ImageAvailable = false
        this.finalImage = ''
        this.inputImage = null
        this.showResult = false
        console.log('MSA6: MSA5 이미지 없음, 결과 표시 안함')
      }
    },
    // 페이지 새로고침 시 이미지 초기화 메소드 추가
    clearImageOnReload() {
      console.log('MSA6: 페이지 새로고침 감지, 이미지 초기화 시작')
      
      // 세션 스토리지에 초기화 플래그 설정 (1초 후 자동 삭제)
      sessionStorage.setItem('image_cleared', 'true')
      setTimeout(() => {
        sessionStorage.removeItem('image_cleared')
      }, 1000)
      
      // MSA5 상태 확인 후 이미지 표시 여부 결정
      this.checkMSA5StatusAndUpdateImage()
      
      // 측정 팝업 초기화
      if (this.$refs.measurementPopup && typeof this.$refs.measurementPopup.clearImage === 'function') {
        this.$refs.measurementPopup.clearImage()
        console.log('MSA6: 측정 팝업 이미지 초기화 완료')
      }
    },
    handleMSA5ImageProcessed(event) {
      console.log('MSA5 이미지 처리 이벤트 수신')
      const { imageUrl, timestamp } = event.detail
      
      // 최종 이미지 설정
      this.finalImage = imageUrl
      this.showResult = true
      
      // 로컬 스토리지에 저장
      localStorage.setItem('msa6_final_image', imageUrl)
      
      // MSA5 입력 이미지 URL 저장 (세션 스토리지에서 가져오기)
      this.inputImage = sessionStorage.getItem('msa5_start_image_url')
      console.log('MSA6: MSA5 입력 이미지 URL 업데이트됨:', this.inputImage ? '있음' : '없음')
      
      // MSA5 이미지 사용 가능 플래그 설정
      this.msa5ImageAvailable = true
      
      console.log('MSA6 최종 결과 이미지 업데이트 완료')
    },
    toggleMaximize() {
      this.isMaximized = !this.isMaximized
    },
    openMeasurementPopup() {
      if (this.finalImage) {
        console.log('Opening measurement popup with image:', this.finalImage)
        this.showMeasurementPopup = true
        
        // First make sure the container elements are visible
        this.$nextTick(() => {
          // 먼저 팝업 관련 요소들 표시 설정
          const teleportElements = document.querySelectorAll('.msa6-image-popup-container');
          teleportElements.forEach(element => {
            element.style.display = 'block';
            element.style.visibility = 'visible';
          });
          
          const popupContainer = document.querySelector('.image-measurement-popup');
          if (popupContainer) {
            popupContainer.style.removeProperty('display');
            popupContainer.style.removeProperty('visibility');
          }
          
          console.log('MSA6: 팝업 컨테이너 표시 설정 완료');
          
          // Then call the component's method
          if (this.$refs.measurementPopup && typeof this.$refs.measurementPopup.openPopup === 'function') {
            this.$refs.measurementPopup.openPopup(this.finalImage);
          }
        });
      }
    },
    closeMeasurementPopup() {
      console.log('Closing measurement popup, data will be preserved')
      this.showMeasurementPopup = false
      
      // Force refresh the component state
      this.$nextTick(() => {
        // 모든 팝업 관련 요소 강제 숨김
        const popupContainer = document.querySelector('.image-measurement-popup');
        if (popupContainer) {
          popupContainer.style.display = 'none';
          popupContainer.style.visibility = 'hidden';
        }
        
        const teleportElements = document.querySelectorAll('.msa6-image-popup-container');
        teleportElements.forEach(element => {
          element.style.display = 'none';
          element.style.visibility = 'hidden';
        });
        
        console.log('MSA6: 측정 팝업 DOM 요소 강제 숨김 처리 완료');
      });
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