/**
 * MSA6 불량 감지 중단 관리 모듈
 * 사용자 수동 중단 기능
 */

export class DefectDetectionStopper {
  constructor() {
    this.currentDetector = null;
    this.vueInstance = null;
    this.isEmergencyStop = false;
    
    // console.log('DefectDetectionStopper 초기화 완료');
  }

  /**
   * 현재 감지기와 Vue 인스턴스 등록
   */
  registerDetector(detector, vueInstance) {
    this.currentDetector = detector;
    this.vueInstance = vueInstance;
    this.isEmergencyStop = false;
    
    // console.log('불량 감지기 등록 완료');
  }

  /**
   * 즉시 중단 실행
   */
  emergencyStop() {
    // console.log('🚨 불량 감지 즉시 중단 실행');
    
    this.isEmergencyStop = true;
    
    try {
      // 1. 감지기 중단
      if (this.currentDetector) {
        // console.log('감지기 중단 중...');
        this.currentDetector.stopDetection();
        this.currentDetector = null;
      }
      
      // 2. Vue 컴포넌트 상태 초기화
      if (this.vueInstance) {
        // console.log('Vue 컴포넌트 상태 초기화 중...');
        this.resetVueComponentState();
      }
      
      // 3. 캔버스 초기화
      this.resetCanvas();
      
      // 4. 메모리 정리
      this.performMemoryCleanup();
      
      // console.log('✅ 불량 감지 즉시 중단 완료');
      
      return {
        success: true,
        message: '불량 감지가 성공적으로 중단되었습니다.'
      };
      
    } catch (error) {
      console.error('❌ 즉시 중단 중 오류 발생:', error);
      
      // 오류 발생 시 강제 초기화
      this.forceReset();
      
      return {
        success: false,
        message: `중단 중 오류가 발생했지만 강제 초기화되었습니다: ${error.message}`
      };
    }
  }

  /**
   * Vue 컴포넌트 상태 초기화
   */
  resetVueComponentState() {
    if (!this.vueInstance) return;
    
    try {
      // console.log('Vue 컴포넌트 상태 초기화 시작');
      
      // 감지 상태 완전 초기화
      this.vueInstance.isDefectDetecting = false;
      
      // 측정 내용 완전 삭제
      this.vueInstance.defectMeasurements = [];
      this.vueInstance.selectedDefects = [];
      this.vueInstance.defectDetectionResult = null;
      
      // 불량감지 모드를 명시적으로 설정하고 유지
      this.vueInstance.measurementMode = 'defect';
      // console.log('불량감지 모드 명시적 설정:', this.vueInstance.measurementMode);
      
      // 선택 영역 초기화
      this.vueInstance.selectedAreaRect = null;
      this.vueInstance.selectedArea = null;
      this.vueInstance.isAreaSelectionMode = false;
      
      // API 전송 상태 초기화
      this.vueInstance.isApiSending = false;
      
      // 버튼 상태 강제 업데이트를 위한 nextTick 사용
      this.vueInstance.$nextTick(() => {
        // Vue의 반응성을 이용하여 자동으로 버튼 상태 업데이트
        // measurementMode가 'defect'로 설정되어 있으므로 템플릿에서 자동으로 활성화됨
        // console.log('불량감지 모드 유지 완료:', this.vueInstance.measurementMode);
        
        // 모든 버튼 활성화
        const allBtns = document.querySelectorAll('.option-btn, .start-btn, .reset-btn, .close-btn');
        allBtns.forEach(btn => {
          btn.disabled = false;
          btn.style.pointerEvents = 'auto';
          btn.style.opacity = '1';
        });
        
        // 캔버스 상호작용 활성화
        const canvas = this.vueInstance.$refs.canvas;
        if (canvas) {
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // 원본 이미지 복원
          if (this.vueInstance.imageData) {
            ctx.putImageData(this.vueInstance.imageData, 0, 0);
          }
        }
      });
      
      // 강제 업데이트
      this.vueInstance.$forceUpdate();
      
      // console.log('Vue 컴포넌트 상태 초기화 완료 - 불량감지 모드 유지');
      
    } catch (error) {
      console.error('Vue 컴포넌트 상태 초기화 중 오류:', error);
    }
  }

  /**
   * 캔버스 초기화
   */
  resetCanvas() {
    if (!this.vueInstance) return;
    
    try {
      // console.log('캔버스 초기화 시작');
      
      this.vueInstance.$nextTick(() => {
        const canvas = this.vueInstance.$refs.canvas;
        if (canvas) {
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // 원본 이미지 복원
          if (this.vueInstance.imageData) {
            ctx.putImageData(this.vueInstance.imageData, 0, 0);
          }
        }
      });
      
      // console.log('캔버스 초기화 완료');
      
    } catch (error) {
      console.error('캔버스 초기화 중 오류:', error);
    }
  }

  /**
   * 메모리 정리
   */
  performMemoryCleanup() {
    try {
      // console.log('메모리 정리 시작');
      
      // 타이머 정리
      this.clearAllTimers();
      
      // 가비지 컬렉션 힌트
      if (typeof window !== 'undefined' && window.gc) {
        window.gc();
      }
      
      // console.log('메모리 정리 완료');
      
    } catch (error) {
      console.error('메모리 정리 중 오류:', error);
    }
  }

  /**
   * 모든 타이머 정리
   */
  clearAllTimers() {
    try {
      // 활성 타이머 ID 범위에서 정리 (일반적인 범위)
      const maxTimerId = setTimeout(() => {}, 0);
      for (let i = 1; i <= maxTimerId; i++) {
        clearTimeout(i);
        clearInterval(i);
      }
      clearTimeout(maxTimerId);
      
      // console.log('타이머 정리 완료');
      
    } catch (error) {
      console.error('타이머 정리 중 오류:', error);
    }
  }

  /**
   * 강제 초기화 (오류 발생 시)
   */
  forceReset() {
    // console.log('🔄 강제 초기화 실행');
    
    try {
      this.isEmergencyStop = true;
      this.currentDetector = null;
      
      if (this.vueInstance) {
        this.vueInstance.isDefectDetecting = false;
        this.vueInstance.defectMeasurements = [];
        this.vueInstance.$forceUpdate();
      }
      
      this.clearAllTimers();
      
      // console.log('강제 초기화 완료');
      
    } catch (error) {
      console.error('강제 초기화 중 오류:', error);
    }
  }

  /**
   * 중단 상태 확인
   */
  isEmergencyStopped() {
    return this.isEmergencyStop;
  }

  /**
   * 중단 상태 리셋
   */
  resetStopState() {
    this.isEmergencyStop = false;
    // console.log('중단 상태 리셋됨');
  }
}

// 전역 인스턴스
const globalStopper = new DefectDetectionStopper();

// 편의 함수들
export function emergencyStopDefectDetection() {
  return globalStopper.emergencyStop();
}

export function registerDefectDetector(detector, vueInstance) {
  globalStopper.registerDetector(detector, vueInstance);
}

export function isDefectDetectionStopped() {
  return globalStopper.isEmergencyStopped();
}

export function resetDefectStopState() {
  globalStopper.resetStopState();
} 