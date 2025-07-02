<template>
  <div class="msa-component" :class="{ maximized: isMaximized }">
    <div class="card-header">
      <div class="header-left">
        <i class="fas fa-flag-checkered"></i>
        <span>I-TAP Result</span>
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
      :measurements="measurements"
      @update:showPopup="showMeasurementPopup = $event"
      @update:measurements="handleMeasurementsUpdate"
      @close="closeMeasurementPopup"
      @measurement-added="handleMeasurementAdded"
      @measurement-removed="handleMeasurementRemoved"
      @measurements-cleared="handleMeasurementsCleared"
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
      msa5ImageAvailable: false,
      measurements: []
    }
  },
  mounted() {
    // MSA5 이미지 처리 이벤트 리스너 등록
    window.addEventListener('msa5-image-processed', this.handleMSA5ImageProcessed)
    
    // MSA5 프로세스 시작 이벤트 리스너 등록 (측정 결과 즉시 초기화)
    window.addEventListener('msa5-process-start', this.handleMSA5ProcessStart)
    
    // 측정 팝업 컴포넌트가 항상 존재하지만 처음에는 보이지 않게 설정
    this.showMeasurementPopup = false
    
    // 새로고침 후 처음 로드 시 이미지 초기화 이벤트 리스너 추가
    window.addEventListener('load', this.clearImageOnReload)
    
    // 팝업 닫힘 이벤트 리스너 추가
    window.addEventListener('msa6-popup-closed', () => {
      // console.log('MSA6: 팝업 닫힘 이벤트 수신')
      this.showMeasurementPopup = false
      this.$nextTick(() => this.closeMeasurementPopup())
    })
    
    // 페이지 로드 시 MSA5 상태 확인 후 이미지 표시 여부 결정
    this.checkMSA5StatusAndUpdateImage()
  },
  beforeUnmount() {
    window.removeEventListener('msa5-image-processed', this.handleMSA5ImageProcessed)
    window.removeEventListener('msa5-process-start', this.handleMSA5ProcessStart)
    window.removeEventListener('load', this.clearImageOnReload)
    window.removeEventListener('msa6-popup-closed', () => {})
  },
  methods: {
    // MSA5 상태를 확인하고 이미지 표시 여부 결정하는 메소드 추가
    checkMSA5StatusAndUpdateImage() {
      // 페이지 새로고침 시에는 MSA5 end 노드에 이미지가 없기 때문에 MSA6도 초기화해야 함
      const hasMSA5EndImage = sessionStorage.getItem('msa5_end_image')
      // console.log('MSA6: MSA5 이미지 상태 확인 - 종료 이미지 있음:', hasMSA5EndImage)
      
      if (hasMSA5EndImage === 'true') {
        // MSA5에 종료 이미지가 있으면 MSA6도 이미지 표시
        this.msa5ImageAvailable = true
        
        // 로컬 스토리지에서 최종 이미지 가져오기
        if (localStorage.getItem('msa6_final_image')) {
          this.finalImage = localStorage.getItem('msa6_final_image')
          this.showResult = true
          // console.log('MSA6: 로컬 스토리지에서 최종 이미지 로드됨')
          
          // MSA5 입력 이미지 URL 저장 (세션 스토리지에서 가져오기)
          this.inputImage = sessionStorage.getItem('msa5_start_image_url')
          // console.log('MSA6: MSA5 입력 이미지 URL 로드됨:', this.inputImage ? '있음' : '없음')
        } else {
          // console.log('MSA6: 로컬 스토리지에 저장된 이미지 없음')
          this.showResult = false
        }
      } else {
        // MSA5에 이미지가 없으면 MSA6도 이미지 표시하지 않음
        this.msa5ImageAvailable = false
        this.finalImage = ''
        this.inputImage = null
        this.showResult = false
        // console.log('MSA6: MSA5 이미지 없음, 결과 표시 안함')
      }
    },
    // 페이지 새로고침 시 이미지 초기화 메소드 추가
    clearImageOnReload() {
      // console.log('MSA6: 페이지 새로고침 감지, 이미지 초기화 시작')
      
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
        // console.log('MSA6: 측정 팝업 이미지 초기화 완료')
      }
    },
    handleMSA5ImageProcessed(event) {
      // console.log('MSA5 이미지 처리 이벤트 수신')
      const { imageUrl, timestamp, noPopup } = event.detail
      
      // 최종 이미지 설정
      this.finalImage = imageUrl
      this.showResult = true
      
      // 로컬 스토리지에 저장
      localStorage.setItem('msa6_final_image', imageUrl)
      
      // MSA5 입력 이미지 URL 저장 (세션 스토리지에서 가져오기)
      this.inputImage = sessionStorage.getItem('msa5_start_image_url')
      // console.log('MSA6: MSA5 입력 이미지 URL 업데이트됨:', this.inputImage ? '있음' : '없음')
      
      // MSA5 이미지 사용 가능 플래그 설정
      this.msa5ImageAvailable = true
      
      // console.log('MSA6 최종 결과 이미지 업데이트 완료')
      
      // 자동 팝업 열림 방지 플래그 확인 및 설정
      if (noPopup === true) {
        // console.log('MSA6: MSA5에서 noPopup 플래그가 전달됨. 팝업을 열지 않습니다.');
        // 세션 스토리지에도 플래그 설정 (다른 컴포넌트에서 참조할 수 있도록)
        sessionStorage.setItem('msa6_no_auto_popup', 'true');
      } else {
        // noPopup 플래그가 없는 경우, 세션 스토리지의 플래그 확인
        const noAutoPopupFromStorage = sessionStorage.getItem('msa6_no_auto_popup') === 'true';
        
        if (noAutoPopupFromStorage) {
          // console.log('MSA6: 세션 스토리지에 자동 팝업 방지 플래그가 설정되어 있습니다.');
          // 플래그는 유지 (필요한 경우 다른 컴포넌트에서 초기화)
        } else {
          // console.log('MSA6: 자동 팝업 방지 플래그가 없습니다. 사용자가 이미지를 클릭하면 팝업이 열립니다.');
          // 플래그가 없는 경우에는 아무 작업도 하지 않음 (기본적으로 팝업을 열지 않음)
        }
      }
    },
    handleMSA5ProcessStart(event) {
      // console.log('MSA6: MSA5 프로세스 시작 이벤트 수신')
      
      try {
        // 이벤트 데이터 확인
        const data = event.detail;
        
        if (data && data.action === 'clear_measurements') {
          // console.log('MSA6: 측정 결과 초기화 요청 수신');
          
          // measurements 배열 직접 초기화
          this.measurements = [];
          // console.log('MSA6: measurements 배열 초기화 완료');
          
          // 측정 팝업 컴포넌트에도 초기화 요청 (내부 데이터 초기화용)
          if (this.$refs.measurementPopup && typeof this.$refs.measurementPopup.clearMeasurements === 'function') {
            this.$refs.measurementPopup.clearMeasurements();
            // console.log('MSA6: 측정 팝업에 초기화 요청 전송 완료');
          } else {
            // console.warn('MSA6: 측정 팝업 컴포넌트를 찾을 수 없거나 clearMeasurements 메서드가 없습니다');
          }
        }
      } catch (error) {
        // console.error('MSA6: MSA5 프로세스 시작 이벤트 처리 중 오류:', error);
      }
    },
    toggleMaximize() {
      this.isMaximized = !this.isMaximized
    },
    openMeasurementPopup() {
      if (this.finalImage) {
        // console.log('Opening measurement popup with image:', this.finalImage)
        this.showMeasurementPopup = true
        
        // 세션 스토리지 플래그 초기화 (팝업을 명시적으로 열었으므로 플래그 초기화)
        sessionStorage.removeItem('msa6_no_auto_popup');
        // console.log('MSA6: 사용자가 수동으로 팝업을 열었습니다. 자동 팝업 방지 플래그를 초기화합니다.');
        
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
          
          // console.log('MSA6: 팝업 컨테이너 표시 설정 완료');
          
          // 이제 팝업 컴포넌트의 openPopup 메서드 호출
          if (this.$refs.measurementPopup && typeof this.$refs.measurementPopup.openPopup === 'function') {
            try {
              this.$refs.measurementPopup.openPopup(this.finalImage);
              // console.log('MSA6: 측정 팝업 openPopup 메서드 호출 완료');
            } catch (error) {
              // console.error('MSA6: openPopup 메서드 호출 중 오류 발생:', error);
            }
          } else {
            console.error('MSA6: 측정 팝업 컴포넌트 참조 또는 openPopup 메서드를 찾을 수 없습니다.', {
              hasRef: !!this.$refs.measurementPopup,
              refType: this.$refs.measurementPopup ? typeof this.$refs.measurementPopup : 'undefined',
              hasMethod: this.$refs.measurementPopup ? typeof this.$refs.measurementPopup.openPopup : 'N/A'
            });
          }
        });
      } else {
        // console.warn('MSA6: 표시할 이미지가 없어 측정 팝업을 열 수 없습니다.');
      }
    },
    closeMeasurementPopup() {
      // console.log('Closing measurement popup, data will be preserved')
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
        
        // console.log('MSA6: 측정 팝업 DOM 요소 강제 숨김 처리 완료');
      });
    },
    handleMeasurementAdded(measurement) {
      // console.log('MSA6: 측정 결과 추가됨', measurement);
      // Create a new array instead of mutating directly
      this.measurements = [...this.measurements, measurement];
      
      // 히스토리 저장은 측정 컴포넌트 내부에서 처리하므로 여기서는 제거
    },
    handleMeasurementRemoved(measurement) {
      // console.log('MSA6: 측정 결과 제거됨', measurement);
      if (measurement.itemId) {
        // itemId로 삭제하는 경우 - create new array instead of mutating
        this.measurements = this.measurements.filter(m => m.itemId !== measurement.itemId);
      } else if (measurement.id) {
        // id로 삭제하는 경우 - create new array instead of mutating
        this.measurements = this.measurements.filter(m => m.id !== measurement.id);
      } else {
        // 전체 객체로 삭제하는 경우 - create new array instead of mutating
        const index = this.measurements.indexOf(measurement);
        if (index > -1) {
          this.measurements = this.measurements.filter((_, i) => i !== index);
        }
      }
    },
    handleMeasurementsCleared() {
      // console.log('MSA6: 모든 측정 결과 제거됨');
      // Create new empty array instead of mutating
      this.measurements = [];
    },
    handleMeasurementsUpdate(measurements) {
      // console.log('MSA6: 측정 결과 업데이트됨', measurements);
      this.measurements = measurements;
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

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: #6c5ce7;
  color: white;
  margin-bottom: 1rem;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.header-left i {
  font-size: 1.2rem;
  color: white;
}

.header-left span {
  font-size: 1rem;
  font-weight: 600;
  color: white;
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