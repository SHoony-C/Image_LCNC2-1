import LogService from './logService';
import { showScaleDetectionFailurePopup } from './popupOverride';

export const scaleBarHandlers = {
  // 스케일바 설정 저장 함수 개선
  saveScaleBarSettings() {
    try {
      console.log('[saveScaleBarSettings] 스케일바 설정 저장 시작');
      
      // 현재 이미지 키 생성
      let currentImageKey = 'default';
      if (this.outputImageUrl) {
        const urlParts = this.outputImageUrl.split('/');
        const fileName = urlParts[urlParts.length - 1];
        currentImageKey = fileName.split('.')[0]; // 확장자 제거
      }
      
      console.log(`[saveScaleBarSettings] 현재 이미지 키: ${currentImageKey}`);
      
      // 현재 이미지별 설정 저장
      const currentImageSettings = {
        scaleMethod: this.scaleMethod,
        scaleBarValue: this.scaleBarValue,
        scaleBarUnit: this.scaleBarUnit,
        manualScaleBarSet: this.manualScaleBarSet,
        magnification: this.magnification,
        timestamp: new Date().toISOString()
      };
      
      const currentImageStorageKey = `msa6_scalebar_${currentImageKey}`;
      localStorage.setItem(currentImageStorageKey, JSON.stringify(currentImageSettings));
      console.log(`[saveScaleBarSettings] 현재 이미지 설정 저장 완료 -> localStorage[${currentImageStorageKey}]`, currentImageSettings);
      
      // 마지막 이미지 키 저장
      localStorage.setItem('msa6_last_image_key', currentImageKey);
      console.log(`[saveScaleBarSettings] 마지막 이미지 키 저장: ${currentImageKey}`);
      
      // 전역 설정도 업데이트 (호환성 유지)
      const globalSettings = {
        lastScaleMethod: this.scaleMethod,
        lastScaleBarValue: this.scaleBarValue,
        lastScaleBarUnit: this.scaleBarUnit,
        lastManualScaleBarSet: this.manualScaleBarSet,
        lastMagnification: this.magnification,
        lastImageKey: currentImageKey,
        timestamp: new Date().toISOString()
      };
      
      localStorage.setItem('msa6_scalebar_global', JSON.stringify(globalSettings));
      console.log('[saveScaleBarSettings] 전역 설정 저장 완료 -> localStorage[msa6_scalebar_global]', globalSettings);
      
      return true;
    } catch (e) {
      console.error('[saveScaleBarSettings] 저장 오류:', e);
      return false;
    }
  },
  
  // 스케일바 설정 복원 함수 개선
  restoreScaleBarSettings() {
      try {
          console.log('[restoreScaleBarSettings] 스케일바 설정 복원 시작');
          
          // 현재 이미지 키 생성
          let currentImageKey = 'default';
          if (this.outputImageUrl) {
              const urlParts = this.outputImageUrl.split('/');
              const fileName = urlParts[urlParts.length - 1];
              currentImageKey = fileName.split('.')[0]; // 확장자 제거
          }
          
          // 마지막으로 사용한 이미지 키 가져오기
          const lastImageKey = localStorage.getItem('msa6_last_image_key');
          
          console.log(`[restoreScaleBarSettings] 현재 이미지 키: ${currentImageKey}`);
          console.log(`[restoreScaleBarSettings] 마지막 이미지 키: ${lastImageKey || '없음'}`);
          
          // 복원 시도할 스토리지 키 목록
          console.log('[restoreScaleBarSettings] 복원 시도 순서: 1) 현재 이미지 설정 -> 2) 마지막 이미지 설정 -> 3) 전역 설정');
          
          // 저장된 설정이 있는지 확인
          let savedSettings = null;
          
          // 1. 현재 이미지 설정 확인
          const currentImageStorageKey = `msa6_scalebar_${currentImageKey}`;
          savedSettings = localStorage.getItem(currentImageStorageKey);
          
          if (savedSettings) {
              const settings = JSON.parse(savedSettings);
              console.log(`[restoreScaleBarSettings] 1) 현재 이미지 설정 찾음 -> localStorage[${currentImageStorageKey}]`, settings);
              
              // 저장된 측정 방식, 값, 단위 복원
              this.scaleMethod = settings.scaleMethod || 'scaleBar';
              this.scaleBarValue = settings.scaleBarValue || 500;
              this.scaleBarUnit = settings.scaleBarUnit || 'nm';
              
              // 값이 유효한지 확인
              const validScaleBarValue = typeof this.scaleBarValue === 'number' && this.scaleBarValue > 0;
              const validScaleBarUnit = typeof this.scaleBarUnit === 'string' && this.scaleBarUnit.trim() !== '';
              
              // 중요: 저장된 manualScaleBarSet 값을 그대로 복원
              this.manualScaleBarSet = !!settings.manualScaleBarSet;
              console.log(`[restoreScaleBarSettings] 저장된 manualScaleBarSet 값 복원: ${this.manualScaleBarSet}`);
              
              // 배율 설정 복원
              if (settings.magnification) this.magnification = settings.magnification;
              
              // manualScaleBarSet이 true인 경우 scaleBarDetected도 true로 설정
              this.scaleBarDetected = this.manualScaleBarSet;
              
              console.log(`[restoreScaleBarSettings] 현재 이미지 설정 복원 완료:`, {
                  scaleMethod: this.scaleMethod,
                  scaleBarValue: this.scaleBarValue,
                  scaleBarUnit: this.scaleBarUnit,
                  manualScaleBarSet: this.manualScaleBarSet,
                  scaleBarDetected: this.scaleBarDetected,
                  magnification: this.magnification
              });
              
              
              return true;
    } else {
              console.log(`[restoreScaleBarSettings] 1) 현재 이미지 설정 없음 -> localStorage[${currentImageStorageKey}]`);
          }
          
          // 2. 마지막 이미지 설정 확인 (현재 이미지와 다른 경우)
          if (lastImageKey && lastImageKey !== currentImageKey) {
              const lastImageStorageKey = `msa6_scalebar_${lastImageKey}`;
              savedSettings = localStorage.getItem(lastImageStorageKey);
              
              if (savedSettings) {
                  const settings = JSON.parse(savedSettings);
                  console.log(`[restoreScaleBarSettings] 2) 마지막 이미지 설정 찾음 -> localStorage[${lastImageStorageKey}]`, settings);
                  
                  // 저장된 측정 방식, 값, 단위 복원
                  this.scaleMethod = settings.scaleMethod || 'scaleBar';
                  this.scaleBarValue = settings.scaleBarValue || 500;
                  this.scaleBarUnit = settings.scaleBarUnit || 'nm';
                  
                  // 중요: 저장된 manualScaleBarSet 값을 그대로 복원
                  this.manualScaleBarSet = !!settings.manualScaleBarSet;
                  console.log(`[restoreScaleBarSettings] 마지막 이미지의 manualScaleBarSet 값 복원: ${this.manualScaleBarSet}`);
                  
                  // 배율 설정 복원
                  if (settings.magnification) this.magnification = settings.magnification;
                  
                  // manualScaleBarSet이 true인 경우 scaleBarDetected도 true로 설정
                  this.scaleBarDetected = this.manualScaleBarSet;
                  
                  console.log(`[restoreScaleBarSettings] 마지막 이미지 설정 복원 완료:`, {
                      scaleMethod: this.scaleMethod,
                      scaleBarValue: this.scaleBarValue,
                      scaleBarUnit: this.scaleBarUnit,
                      manualScaleBarSet: this.manualScaleBarSet,
                      scaleBarDetected: this.scaleBarDetected,
                      magnification: this.magnification
                  });
                  
                  // 현재 이미지 키를 사용하여 설정 저장 (다음에 열 때 이 설정 사용)
                  this.saveScaleBarSettings();
                  
                  return true;
              } else {
                  console.log(`[restoreScaleBarSettings] 2) 마지막 이미지 설정 없음 -> localStorage[${lastImageStorageKey}]`);
              }
          } else {
              console.log(`[restoreScaleBarSettings] 2) 마지막 이미지 키가 없거나 현재 이미지와 동일하여 확인 건너뜀`);
          }
          
          // 3. 전역 설정 확인
          const globalSettings = localStorage.getItem('msa6_scalebar_global');
          if (globalSettings) {
              const settings = JSON.parse(globalSettings);
              console.log('[restoreScaleBarSettings] 3) 전역 설정 찾음 -> localStorage[msa6_scalebar_global]', settings);
              
              // 저장된 측정 방식, 값, 단위 복원
              this.scaleMethod = settings.lastScaleMethod || 'scaleBar';
              this.scaleBarValue = settings.lastScaleBarValue || 500;
              this.scaleBarUnit = settings.lastScaleBarUnit || 'nm';
              
              // 중요: 전역 설정에서도 manualScaleBarSet 값 복원
              this.manualScaleBarSet = !!settings.lastManualScaleBarSet;
              console.log(`[restoreScaleBarSettings] 전역 설정의 manualScaleBarSet 값 복원: ${this.manualScaleBarSet}`);
              
              // 배율 설정 복원
              if (settings.lastMagnification) this.magnification = settings.lastMagnification;
              
              // manualScaleBarSet이 true인 경우 scaleBarDetected도 true로 설정
              this.scaleBarDetected = this.manualScaleBarSet;
              
              console.log(`[restoreScaleBarSettings] 전역 설정 복원 완료:`, {
                  scaleMethod: this.scaleMethod,
                  scaleBarValue: this.scaleBarValue,
                  scaleBarUnit: this.scaleBarUnit,
                  manualScaleBarSet: this.manualScaleBarSet,
                  scaleBarDetected: this.scaleBarDetected,
                  magnification: this.magnification
              });
              
              
              return true;
          } else {
              console.log(`[restoreScaleBarSettings] 3) 전역 설정 없음 -> localStorage[msa6_scalebar_global]`);
          }
          
          // 설정이 없는 경우 기본값 설정
          this.scaleMethod = 'scaleBar';
          this.scaleBarValue = 500;
          this.scaleBarUnit = 'nm';
          this.manualScaleBarSet = false;
      this.scaleBarDetected = false;
          
          console.log('[restoreScaleBarSettings] 저장된 설정 없음, 기본값 설정:', {
              scaleMethod: this.scaleMethod,
              scaleBarValue: this.scaleBarValue,
              scaleBarUnit: this.scaleBarUnit,
              manualScaleBarSet: this.manualScaleBarSet,
              scaleBarDetected: this.scaleBarDetected
          });
          return false;
      } catch (e) {
          console.error('[restoreScaleBarSettings] 복원 오류:', e);
          
          // 오류 발생 시에도 기본값 설정
          this.scaleMethod = 'scaleBar';
          this.scaleBarValue = 500;
          this.scaleBarUnit = 'nm';
      this.manualScaleBarSet = false;
          this.scaleBarDetected = false;
          
          console.log('[restoreScaleBarSettings] 오류 발생으로 기본값 설정');
          return false;
    }
  },
  
  // 스케일 방식 선택 메서드 수정
  selectScaleMethod(method) {
    console.log(`[selectScaleMethod] 사용자가 선택한 측정 방식: ${method}, 이전 방식: ${this.scaleMethod}`);
    
    // 선택 팝업 닫기 - showScaleChoicePopup 플래그 설정
    this.showScaleChoicePopup = false;
    
    // DOM 요소도 직접 제어하여 확실하게 팝업 숨기기 (v-show 문제 해결)
    this.$nextTick(() => {
      const popupElement = document.querySelector('.scale-choice-popup');
      if (popupElement) {
        popupElement.style.display = 'none';
        console.log('[selectScaleMethod] 팝업 요소 직접 숨김 처리');
      }
    });
    
    // 사용자 선택에 따라 처리
    if (method === 'magnification') {
      // 배율 기반 측정 선택
      this.scaleMethod = 'magnification';
      this.isDrawingScaleBar = false; // 스케일바 그리기 모드 비활성화
      this.measurementMode = 'line'; // 선 측정 모드로 설정
      this.showNotification('배율 기반 측정 방식을 선택했습니다.', 'info');
          
          // 배율 기반으로 전환 시 manualScaleBarSet은 false로 설정
          this.manualScaleBarSet = false;
    } else if (method === 'scaleBar') {
      // 수동 스케일바 설정 선택
      this.scaleMethod = 'scaleBar';
      this.isDrawingScaleBar = true;
      this.measurementMode = 'scaleBar';
      // 알림 메시지 제거 - UI에 영향을 주지 않도록
      // this.showNotification('수동 스케일바 설정 모드를 선택했습니다. 이미지의 스케일바 위에 선을 그려주세요.', 'info');
          
          // 스케일바 모드로 전환 시에는 manualScaleBarSet 상태를 바꾸지 않음
          // 사용자가 실제로 스케일바를 그리고 값을 입력할 때 true로 설정됨
    }
    
    // 첫 번째 감지 시도 플래그 해제
    this.isFirstDetectionAttempt = false;
      
      // 설정 저장
      this.saveScaleBarSettings();
    
    this.render();
    
    // 이벤트 발생 기록
    LogService.logAction(`select_scale_method_${method}`, {
      previous: this.scaleMethod,
      selected: method
    });
  },
  
  // 스케일바 값 입력 다이얼로그 핸들링 수정
  handleScaleBarValueInput() {
      console.log('[handleScaleBarValueInput] 스케일바 값 입력 처리');
      
      const numValue = parseFloat(this.tempScaleBarValue);
      if (isNaN(numValue) || numValue <= 0) {
          alert('유효한 양수를 입력해주세요.');
          return;
      }
      
      console.log(`[handleScaleBarValueInput] 입력값: ${numValue} ${this.tempScaleBarUnit}`);
      
      // 스케일바 값 설정
      this.scaleBarValue = numValue;
      this.scaleBarUnit = this.tempScaleBarUnit;
      
      // 스케일바 감지 상태 업데이트
      this.scaleBarDetected = true;
      
      // 수동 스케일바 설정 완료 플래그 설정
      this.manualScaleBarSet = true;
      console.log('[handleScaleBarValueInput] manualScaleBarSet을 true로 설정');
      
      // 다이얼로그 닫기
      this.showScaleBarDialog = false;
      
      // 설정 저장
      this.saveScaleBarSettings();
      
      // 모든 측정값 업데이트
      this.updateAllMeasurements();
      
      // 성공 알림
      this.showNotification(`스케일바 값이 설정되었습니다: ${this.scaleBarValue} ${this.scaleBarUnit}`, 'success');
      
      console.log(`[handleScaleBarValueInput] 스케일바 값 설정 완료: ${this.scaleBarValue} ${this.scaleBarUnit}`);
      
      // 로그 저장
      LogService.logAction('set_scale_bar_value', {
          value: this.scaleBarValue,
          unit: this.scaleBarUnit
      });
  },
  
  // 스케일바 값 입력 다이얼로그 표시
  showScaleBarValueDialog() {
      console.log('[showScaleBarValueDialog] 스케일바 값 입력 다이얼로그 표시');
      
      // 임시 값 초기화
      this.tempScaleBarValue = this.scaleBarValue || 500;
      this.tempScaleBarUnit = this.scaleBarUnit || 'nm';
      
      // 다이얼로그 표시
      this.showScaleBarDialog = true;
      
      // 입력 필드에 포커스 (약간의 지연 후)
      this.$nextTick(() => {
          const inputElement = document.querySelector('.scale-bar-dialog input[type="number"]');
          if (inputElement) {
              inputElement.focus();
              inputElement.select();
          }
      });
  },
  
  // 스케일바 값 입력 다이얼로그 취소
  cancelScaleBarValueInput() {
      console.log('[cancelScaleBarValueInput] 스케일바 값 입력 취소');
      
      // 다이얼로그 닫기
      this.showScaleBarDialog = false;
      
      // 수동 스케일바 관련 상태 초기화
      this.manualScaleBar = null;
      this.scaleBarMeasurement = null;
      this.manualScaleBarSet = false;
      this.scaleBarDetected = false;
      
      // 스케일바 그리기 모드 해제
      this.isDrawingScaleBar = false;
      this.measurementMode = 'line';
      
      // 캔버스 다시 그리기
      this.render();
      
      console.log('[cancelScaleBarValueInput] 스케일바 설정 취소 완료');
  },
  
  // 스케일바 설정 유효성 검증
  validateScaleBarSettings() {
      const hasValidScaleBarValue = typeof this.scaleBarValue === 'number' && this.scaleBarValue > 0;
      const hasValidScaleBarUnit = typeof this.scaleBarUnit === 'string' && this.scaleBarUnit.trim() !== '';
      const hasValidManualScaleBar = this.manualScaleBarSet && hasValidScaleBarValue && hasValidScaleBarUnit;
      
      console.log('[validateScaleBarSettings] 스케일바 설정 유효성 검증:', {
          scaleBarValue: this.scaleBarValue,
          scaleBarUnit: this.scaleBarUnit,
          manualScaleBarSet: this.manualScaleBarSet,
          hasValidScaleBarValue,
          hasValidScaleBarUnit,
          hasValidManualScaleBar
      });
      
      return {
          hasValidScaleBarValue,
          hasValidScaleBarUnit,
          hasValidManualScaleBar
      };
  },
  
  // 스케일바 자동 감지 함수
  detectScaleBar(forceShowPopup = false) {
      console.log('[detectScaleBar] 스케일바 자동 감지 시작, forceShowPopup:', forceShowPopup);
      
      // 이미지가 로드되지 않은 경우 감지 불가
      if (!this.image || !this.image.complete) {
          console.log('[detectScaleBar] 이미지가 로드되지 않아 감지 불가');
          return false;
      }
      
      // 자동 감지 시도 (실제 구현은 복잡하므로 여기서는 간단히 처리)
      // 실제로는 이미지 분석을 통해 스케일바를 찾아야 함
      
      // 감지 실패 시 팝업 표시
      if (forceShowPopup || this.isFirstDetectionAttempt) {
          console.log('[detectScaleBar] 자동 감지 실패, 사용자 선택 팝업 표시');
          showScaleDetectionFailurePopup();
          this.isFirstDetectionAttempt = false;
      }
      
      return false; // 자동 감지 실패
  },
  
  // 스케일바 설정 초기화
  resetScaleBarSettings() {
      console.log('[resetScaleBarSettings] 스케일바 설정 초기화');
      
      // 스케일바 관련 모든 상태 초기화
      this.scaleMethod = 'scaleBar';
      this.scaleBarValue = 500;
      this.scaleBarUnit = 'nm';
      this.scaleBarDetected = false;
      this.manualScaleBarSet = false;
      this.manualScaleBar = null;
      this.scaleBarMeasurement = null;
      this.isDrawingScaleBar = false;
      
      // 다이얼로그 상태 초기화
      this.showScaleBarDialog = false;
      this.showScaleChoicePopup = false;
      
      // 설정 저장
      this.saveScaleBarSettings();
      
      // 모든 측정값 업데이트
      this.updateAllMeasurements();
      
      // 캔버스 다시 그리기
      this.render();
      
      console.log('[resetScaleBarSettings] 스케일바 설정 초기화 완료');
  }
} 