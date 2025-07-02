/**
 * MSA6 스케일바 관리자
 * 기존 Vue 컴포넌트의 scalebar 관련 기능들을 별도 관리
 */
export class MSA6ScalebarManager {
  constructor(context) {
    this.context = context; // Vue 컴포넌트 인스턴스
  }

  /**
   * 스케일바 자동 감지 함수
   * @param {boolean} forceShowPopup - 팝업 강제 표시 여부
   */
  detectScaleBar(forceShowPopup = false) {
    // console.log('[detectScaleBar] 스케일바 자동 감지 시작, 강제팝업:', forceShowPopup);
    
    // ⚠️ 주의: 이 부분은 스케일바 감지 및 팝업 표시의 핵심 로직입니다. 수정 시 주의하세요! ⚠️
    // 다른 부분과의 충돌을 막기 위해 popupOverride.js와 동기화해야 합니다.
    
    // 팝업이 열려있지 않은 경우 아무 작업도 하지 않음 (강제 팝업 모드가 아닌 경우에만)
    if (!forceShowPopup && !this.context.isVisible) {
      // console.log('[detectScaleBar] 팝업이 열려있지 않아 스케일바 감지를 수행하지 않음');
      return;
    }
    
    // 강제 팝업 모드가 아닌 경우에만 조건 검사 수행
    if (!forceShowPopup) {
      // 스케일바 자동 감지 팝업 방지 플래그 확인
      const noScalePopup = sessionStorage.getItem('msa6_no_scale_popup') === 'true';
      if (noScalePopup) {
        // console.log('[detectScaleBar] 스케일바 자동 감지 팝업 방지 플래그가 설정되어 있어 팝업을 표시하지 않음');
        // 플래그 제거 (일회성)
        sessionStorage.removeItem('msa6_no_scale_popup');
        return;
      }

      // 추가: manualScaleBarSet 값의 유효성을 확인
      // 현재 값이 true지만 manualScaleBar 객체가 없으면 잘못된 상태로 간주하고 초기화
      if (this.context.manualScaleBarSet && !this.context.manualScaleBar) {
        console.warn('[detectScaleBar] 오류 상태 감지: manualScaleBarSet이 true지만 manualScaleBar 객체가 없습니다. 초기화합니다.');
        this.context.manualScaleBarSet = false;
        this.saveScaleBarSettings();
      }
      
      // 수동 스케일바 설정 유효성 검증
      const { hasValidManualScaleBar } = this.validateScaleBarSettings();
      
      // 이미 유효한 수동 스케일바가 설정되어 있는 경우 팝업 표시하지 않음
      if (hasValidManualScaleBar) {
        // console.log('[detectScaleBar] 유효한 수동 스케일바가 이미 설정되어 있어 감지를 수행하지 않음:', 
          // 'manualScaleBarSet:', this.context.manualScaleBarSet,
          // 'scaleBarValue:', this.context.scaleBarValue, 
          // 'scaleBarUnit:', this.context.scaleBarUnit);
        
        // 팝업 플래그도 확실히 false로 설정
        this.context.showScaleChoicePopup = false;
        return;
      }
    }

    // 여기에서 실제 스케일바 감지 로직이 있어야 함 (여기서는 간단히 실패로 처리)
    // 실제 프로젝트에서는 이미지 분석을 통해 스케일바를 감지하는 로직 구현
    
    // 중요: 자동 감지 성공 시에도 manualScaleBarSet은 false로 유지해야 함
    // this.context.scaleBarDetected가 true가 되더라도 manualScaleBarSet은 false로 유지
    // 사용자가 직접 스케일바를 그릴 때만 manualScaleBarSet이 true가 되어야 함
    this.context.scaleBarDetected = false;
    
    // 팝업 표시 - 감지 실패 시
    // console.log('[detectScaleBar] 스케일바 감지 실패, 선택 팝업 표시 (강제모드:', forceShowPopup, ')');
    
    // 팝업 표시 플래그 설정
    this.context.showScaleChoicePopup = true;
    
    // 새로운 메서드를 사용하여 팝업 표시
    this.showScaleDetectionFailurePopup(forceShowPopup);
    
    this.context.render();
  }

  /**
   * 스케일바 감지 실패 팝업 표시 메서드
   */
  showScaleDetectionFailurePopup(forceShow = false) {
    // console.log('[showScaleDetectionFailurePopup] 스케일바 감지 실패 팝업 표시 시작, 강제표시:', forceShow);
    
    // 강제 표시 모드가 아닌 경우에만 조건 검사 수행
    if (!forceShow) {
      // 팝업이 열려있지 않으면 표시하지 않음
      if (!this.context.isVisible) {
        // console.log('[showScaleDetectionFailurePopup] 팝업이 열려있지 않아 스케일바 감지 실패 팝업을 표시하지 않음');
        return;
      }
      
      // 스케일바 자동 감지 팝업 방지 플래그 확인
      const noScalePopup = sessionStorage.getItem('msa6_no_scale_popup') === 'true';
      if (noScalePopup) {
        // console.log('[showScaleDetectionFailurePopup] 스케일바 자동 감지 팝업 방지 플래그가 설정되어 있어 팝업을 표시하지 않음');
        // 플래그 제거 (일회성)
        sessionStorage.removeItem('msa6_no_scale_popup');
        return;
      }
      
      // 수동 스케일바 설정 유효성 검증
      const { hasValidManualScaleBar } = this.validateScaleBarSettings();
      
      // 유효한 수동 스케일바가 이미 설정되어 있는 경우 팝업 표시하지 않음
      if (hasValidManualScaleBar) {
        // console.log('[showScaleDetectionFailurePopup] 유효한 수동 스케일바가 이미 설정되어 있어 팝업을 표시하지 않음:', 
        //   'manualScaleBarSet:', this.context.manualScaleBarSet,
        //   'scaleBarValue:', this.context.scaleBarValue,
        //   'scaleBarUnit:', this.context.scaleBarUnit);
        
        // 팝업 플래그도 확실히 false로 설정
        this.context.showScaleChoicePopup = false;
        return;
      }
    }
    
    // 팝업 표시 전에 방식을 scaleBar로 변경 (선택 팝업이 관련성을 가지도록)
    if (this.context.scaleMethod !== 'scaleBar') {
      // console.log('[showScaleDetectionFailurePopup] 현재 방식이 scaleBar가 아님, scaleBar로 변경:', this.context.scaleMethod);
      this.context.scaleMethod = 'scaleBar';
    }
    
    // Show the scale choice popup - 먼저 플래그 설정
    // console.log('[showScaleDetectionFailurePopup] showScaleChoicePopup 플래그를 true로 설정');
    // this.context.showScaleChoicePopup = true;
    
    // 알림 표시
    this.context.showNotification('스케일바 자동 감지에 실패했습니다. 측정 방식을 선택해주세요.', 'warning');
    
    // Vue의 반응성 시스템이 DOM을 업데이트할 시간을 충분히 주기 위해 여러 단계로 처리
    this.context.$nextTick(() => {
      // console.log('[showScaleDetectionFailurePopup] $nextTick 1단계 - DOM 업데이트 후 팝업 요소 찾기 시도');
      
      // 약간의 추가 지연 후 DOM 요소 찾기
      setTimeout(() => {
        const popupElement = document.querySelector('.scale-choice-popup');
        // console.log('[showScaleDetectionFailurePopup] 팝업 요소 검색 결과:', popupElement ? '찾음' : '못찾음');
        
        if (popupElement) {
          // 팝업 요소 스타일 강제 적용
          popupElement.style.display = 'flex';
          popupElement.style.visibility = 'visible';
          popupElement.style.opacity = '1';
          popupElement.style.zIndex = '999999';
          popupElement.style.position = 'fixed';
          popupElement.style.top = '0';
          popupElement.style.left = '0';
          popupElement.style.width = '100%';
          popupElement.style.height = '100%';
          
          // console.log('[showScaleDetectionFailurePopup] 팝업 스타일 적용 완료');
          
          // 팝업 내용 요소도 확인
          const contentElement = popupElement.querySelector('.scale-choice-content');
          if (contentElement) {
            contentElement.style.display = 'block';
            contentElement.style.visibility = 'visible';
            // console.log('[showScaleDetectionFailurePopup] 팝업 내용 요소 스타일도 적용 완료');
          }
        } else {
          console.error('[showScaleDetectionFailurePopup] 팝업 요소를 찾을 수 없음 - DOM 구조 확인');
          
          // 전체 DOM에서 관련 요소들 찾기 시도
          const allPopups = document.querySelectorAll('[class*="popup"], [class*="modal"], [class*="overlay"]');
          // console.log('[showScaleDetectionFailurePopup] 전체 팝업/모달 요소들:', allPopups.length, '개');
          
          // showScaleChoicePopup 상태 다시 확인
          // console.log('[showScaleDetectionFailurePopup] 현재 showScaleChoicePopup 상태:', this.context.showScaleChoicePopup);
          
          // 강제로 Vue 컴포넌트 업데이트 트리거
          this.context.$forceUpdate();
        }
      }, 100);
    });
  }

  /**
   * 스케일바 설정 저장 함수
   */
  saveScaleBarSettings() {
    try {
      // console.log('[saveScaleBarSettings] 스케일바 설정 저장 시작');
      
      // 현재 상태 로깅
      // console.log('[saveScaleBarSettings] 현재 설정 상태:', {
      //   scaleMethod: this.context.scaleMethod,
      //   scaleBarValue: this.context.scaleBarValue,
      //   scaleBarUnit: this.context.scaleBarUnit,
      //   manualScaleBarSet: this.context.manualScaleBarSet,
      //   scaleBarDetected: this.context.scaleBarDetected,
      //   magnification: this.context.magnification
      // });
      
      // 디버깅: manualScaleBarSet이 false인 경우 호출 스택 로깅
      if (!this.context.manualScaleBarSet && this.context.scaleMethod === 'scaleBar' && this.context.scaleBarDetected) {
        console.warn('[saveScaleBarSettings] 경고: 스케일바가 감지되었지만 manualScaleBarSet이 false입니다.');
        console.trace('[saveScaleBarSettings] 호출 스택:');
      }
      
      // 저장할 데이터 준비
      const settings = {
        scaleMethod: this.context.scaleMethod,
        scaleBarValue: this.context.scaleBarValue,
        scaleBarUnit: this.context.scaleBarUnit,
        manualScaleBarSet: this.context.manualScaleBarSet,
        magnification: this.context.magnification,
        savedAt: new Date().toISOString()
      };
      
      // console.log('[saveScaleBarSettings] 저장할 데이터:', settings);
      
      // 이미지 키 생성 (URL에서 파일명 추출)
      let imageKey = 'default';
      if (this.context.imageUrl) {
        const urlParts = this.context.imageUrl.split('/');
        const fileName = urlParts[urlParts.length - 1];
        imageKey = fileName.split('.')[0]; // 확장자 제거
      }
      
      // console.log(`[saveScaleBarSettings] 이미지 키: ${imageKey}`);
      
      // 1. 현재 이미지에 대한 설정 저장
      localStorage.setItem(`msa6_scalebar_${imageKey}`, JSON.stringify(settings));
      // console.log(`[saveScaleBarSettings] 현재 이미지 설정 저장 완료 -> localStorage[msa6_scalebar_${imageKey}]`);
      
      // 2. 마지막 사용 이미지 키 저장 (다른 이미지에서 재사용하기 위함)
      localStorage.setItem('msa6_last_image_key', imageKey);
      // console.log(`[saveScaleBarSettings] 마지막 이미지 키 저장 완료 -> localStorage[msa6_last_image_key] = ${imageKey}`);
      
      // 3. 전역 설정에도 마지막 사용 설정 저장
      const globalSettings = {
        lastScaleMethod: this.context.scaleMethod,
        lastScaleBarValue: this.context.scaleBarValue,
        lastScaleBarUnit: this.context.scaleBarUnit,
        lastManualScaleBarSet: this.context.manualScaleBarSet,
        lastMagnification: this.context.magnification,
        lastUpdatedAt: new Date().toISOString()
      };
      
      localStorage.setItem('msa6_scalebar_global', JSON.stringify(globalSettings));
      // console.log(`[saveScaleBarSettings] 전역 설정 저장 완료 -> localStorage[msa6_scalebar_global]`);
      
      // 4. 저장된 데이터 검증
      const savedImageSettings = JSON.parse(localStorage.getItem(`msa6_scalebar_${imageKey}`));
      const savedGlobalSettings = JSON.parse(localStorage.getItem('msa6_scalebar_global'));
      
      // console.log('[saveScaleBarSettings] 저장된 이미지별 설정:', savedImageSettings);
      // console.log('[saveScaleBarSettings] 저장된 전역 설정:', savedGlobalSettings);
      
      // 저장된 manualScaleBarSet 값 확인
      if (savedImageSettings.manualScaleBarSet !== this.context.manualScaleBarSet) {
        console.error(`[saveScaleBarSettings] 오류: 저장된 manualScaleBarSet 값(${savedImageSettings.manualScaleBarSet})이 현재 값(${this.context.manualScaleBarSet})과 다릅니다.`);
      }
      
      // console.log('[saveScaleBarSettings] 스케일바 설정 저장 완료');
      return true;
    } catch (e) {
      console.error('[saveScaleBarSettings] 저장 오류:', e);
      return false;
    }
  }

  /**
   * 스케일바 설정 복원 함수
   */
  restoreScaleBarSettings() {
    try {
      // console.log('[restoreScaleBarSettings] 스케일바 설정 복원 시작');
      
      // 현재 이미지 키 생성
      let currentImageKey = 'default';
      if (this.context.outputImageUrl) {
        const urlParts = this.context.outputImageUrl.split('/');
        const fileName = urlParts[urlParts.length - 1];
        currentImageKey = fileName.split('.')[0]; // 확장자 제거
      }
      
      // console.log(`[restoreScaleBarSettings] 현재 이미지 키: ${currentImageKey}`);
      
      // 1. 현재 이미지에 대한 특정 설정 확인
      const currentImageSettings = localStorage.getItem(`msa6_scalebar_${currentImageKey}`);
      if (currentImageSettings) {
        const settings = JSON.parse(currentImageSettings);
        // console.log('[restoreScaleBarSettings] 1) 현재 이미지 설정 찾음 -> localStorage[msa6_scalebar_' + currentImageKey + ']', settings);
        
        // 모든 설정 복원
        this.context.scaleMethod = settings.scaleMethod || 'scaleBar';
        this.context.scaleBarValue = settings.scaleBarValue || 500;
        this.context.scaleBarUnit = settings.scaleBarUnit || 'nm';
        this.context.manualScaleBarSet = !!settings.manualScaleBarSet;
        
        // manualScaleBarSet이 true인 경우 scaleBarDetected도 true로 설정
        this.context.scaleBarDetected = this.context.manualScaleBarSet;
        
        // 배율 설정 복원
        if (settings.magnification) this.context.magnification = settings.magnification;
        
        // console.log(`[restoreScaleBarSettings] 현재 이미지 설정 복원 완료:`, {
        //   scaleMethod: this.context.scaleMethod,
        //   scaleBarValue: this.context.scaleBarValue,
        //   scaleBarUnit: this.context.scaleBarUnit,
        //   manualScaleBarSet: this.context.manualScaleBarSet,
        //   scaleBarDetected: this.context.scaleBarDetected,
        //   magnification: this.context.magnification
        // });
        
        return true;
      } else {
        // console.log(`[restoreScaleBarSettings] 1) 현재 이미지 설정 없음 -> localStorage[msa6_scalebar_${currentImageKey}]`);
      }
      
      // 2. 마지막 사용 이미지 설정 확인 (현재 이미지와 다른 경우에만)
      const lastImageKey = localStorage.getItem('msa6_last_image_key');
      if (lastImageKey && lastImageKey !== currentImageKey) {
        const lastImageSettings = localStorage.getItem(`msa6_scalebar_${lastImageKey}`);
        if (lastImageSettings) {
          const settings = JSON.parse(lastImageSettings);
          // console.log('[restoreScaleBarSettings] 2) 마지막 이미지 설정 찾음 -> localStorage[msa6_scalebar_' + lastImageKey + ']', settings);
          
          // 모든 설정 복원
          this.context.scaleMethod = settings.scaleMethod || 'scaleBar';
          this.context.scaleBarValue = settings.scaleBarValue || 500;
          this.context.scaleBarUnit = settings.scaleBarUnit || 'nm';
          this.context.manualScaleBarSet = !!settings.manualScaleBarSet;
          
          // 배율 설정 복원
          if (settings.magnification) this.context.magnification = settings.magnification;
          
          // manualScaleBarSet이 true인 경우 scaleBarDetected도 true로 설정
          this.context.scaleBarDetected = this.context.manualScaleBarSet;
          
          // console.log(`[restoreScaleBarSettings] 마지막 이미지 설정 복원 완료:`, {
          //   scaleMethod: this.context.scaleMethod,
          //   scaleBarValue: this.context.scaleBarValue,
          //   scaleBarUnit: this.context.scaleBarUnit,
          //   manualScaleBarSet: this.context.manualScaleBarSet,
          //   scaleBarDetected: this.context.scaleBarDetected,
          //   magnification: this.context.magnification
          // });
          
          this.saveScaleBarSettings();
          return true;
        } else {
          // console.log(`[restoreScaleBarSettings] 2) 마지막 이미지 설정 없음 -> localStorage[msa6_scalebar_${lastImageKey}]`);
        }
      } else {
        // console.log(`[restoreScaleBarSettings] 2) 마지막 이미지 키가 없거나 현재 이미지와 동일하여 확인 건너뜀`);
      }
      
      // 3. 전역 설정 확인
      const globalSettings = localStorage.getItem('msa6_scalebar_global');
      if (globalSettings) {
        const settings = JSON.parse(globalSettings);
        // console.log('[restoreScaleBarSettings] 3) 전역 설정 찾음 -> localStorage[msa6_scalebar_global]', settings);
        
        // 저장된 측정 방식, 값, 단위 복원
        this.context.scaleMethod = settings.lastScaleMethod || 'scaleBar';
        this.context.scaleBarValue = settings.lastScaleBarValue || 500;
        this.context.scaleBarUnit = settings.lastScaleBarUnit || 'nm';
        
        // 중요: 전역 설정에서도 manualScaleBarSet 값 복원
        this.context.manualScaleBarSet = !!settings.lastManualScaleBarSet;
        // console.log(`[restoreScaleBarSettings] 전역 설정의 manualScaleBarSet 값 복원: ${this.context.manualScaleBarSet}`);
        
        // 배율 설정 복원
        if (settings.lastMagnification) this.context.magnification = settings.lastMagnification;
        
        // manualScaleBarSet이 true인 경우 scaleBarDetected도 true로 설정
        this.context.scaleBarDetected = this.context.manualScaleBarSet;
        
        // console.log(`[restoreScaleBarSettings] 전역 설정 복원 완료:`, {
        //   scaleMethod: this.context.scaleMethod,
        //   scaleBarValue: this.context.scaleBarValue,
        //   scaleBarUnit: this.context.scaleBarUnit,
        //   manualScaleBarSet: this.context.manualScaleBarSet,
        //   scaleBarDetected: this.context.scaleBarDetected,
        //   magnification: this.context.magnification
        // });
        
        return true;
      } else {
        // console.log(`[restoreScaleBarSettings] 3) 전역 설정 없음 -> localStorage[msa6_scalebar_global]`);
      }
      
      // 설정이 없는 경우 기본값 설정
      this.context.scaleMethod = 'scaleBar';
      this.context.scaleBarValue = 500;
      this.context.scaleBarUnit = 'nm';
      this.context.manualScaleBarSet = false;
      this.context.scaleBarDetected = false;
      
      // console.log('[restoreScaleBarSettings] 저장된 설정 없음, 기본값 설정:', {
      //   scaleMethod: this.context.scaleMethod,
      //   scaleBarValue: this.context.scaleBarValue,
      //   scaleBarUnit: this.context.scaleBarUnit,
      //   manualScaleBarSet: this.context.manualScaleBarSet,
      //   scaleBarDetected: this.context.scaleBarDetected
      // });
      return false;
    } catch (e) {
      console.error('[restoreScaleBarSettings] 복원 오류:', e);
      
      // 오류 발생 시에도 기본값 설정
      this.context.scaleMethod = 'scaleBar';
      this.context.scaleBarValue = 500;
      this.context.scaleBarUnit = 'nm';
      this.context.manualScaleBarSet = false;
      this.context.scaleBarDetected = false;
      
      // console.log('[restoreScaleBarSettings] 오류 발생으로 기본값 설정');
      return false;
    }
  }

  /**
   * 스케일 방식 선택 메서드
   * @param {string} method - 선택한 측정 방식 ('magnification' 또는 'scaleBar')
   */
  selectScaleMethod(method) {
    // console.log(`[selectScaleMethod] 사용자가 선택한 측정 방식: ${method}, 이전 방식: ${this.context.scaleMethod}`);
    
    // 선택 팝업 닫기 - showScaleChoicePopup 플래그 설정
    // this.context.showScaleChoicePopup = false;
    
    // DOM 요소도 직접 제어하여 확실하게 팝업 숨기기 (v-show 문제 해결)
    this.context.$nextTick(() => {
      const popupElement = document.querySelector('.scale-choice-popup');
      if (popupElement) {
        popupElement.style.display = 'none';
        // console.log('[selectScaleMethod] 팝업 요소 직접 숨김 처리');
      }
    });
    
    // 사용자 선택에 따라 처리
    if (method === 'magnification') {
      // 배율 기반 측정 선택
      this.context.scaleMethod = 'magnification';
      this.context.isDrawingScaleBar = false; // 스케일바 그리기 모드 비활성화
      this.context.measurementMode = 'line'; // 선 측정 모드로 설정
      this.context.showNotification('배율 기반 측정 방식을 선택했습니다.', 'info');
      
      // 배율 기반으로 전환 시 manualScaleBarSet은 false로 설정
      this.context.manualScaleBarSet = false;
    } else if (method === 'scaleBar') {
      // 수동 스케일바 설정 선택
      this.context.scaleMethod = 'scaleBar';
      this.context.isDrawingScaleBar = true;
      this.context.measurementMode = 'scaleBar';
      // 알림 메시지 제거 - UI에 영향을 주지 않도록
      // this.context.showNotification('수동 스케일바 설정 모드를 선택했습니다. 이미지의 스케일바 위에 선을 그려주세요.', 'info');
      
      // 스케일바 모드로 전환 시에는 manualScaleBarSet 상태를 바꾸지 않음
      // 사용자가 실제로 스케일바를 그리고 값을 입력할 때 true로 설정됨
    }
    
    // 첫 번째 감지 시도 플래그 해제
    this.context.isFirstDetectionAttempt = false;
    
    // 설정 저장
    this.saveScaleBarSettings();
    
    this.context.render();
    
    // 이벤트 발생 기록
    this.context.LogService?.logAction(`select_scale_method_${method}`, {
      previous: this.context.scaleMethod,
      selected: method
    });
  }

  /**
   * 수동 스케일바 설정이 유효한지 검증하는 도우미 함수
   */
  validateScaleBarSettings() {
    // 수동 스케일바 설정 값 유효성 검증
    const validScaleBarValue = typeof this.context.scaleBarValue === 'number' && this.context.scaleBarValue > 0;
    const validScaleBarUnit = typeof this.context.scaleBarUnit === 'string' && this.context.scaleBarUnit.trim() !== '';
    const isValidScaleBar = validScaleBarValue && validScaleBarUnit;
    
    // 추가: manualScaleBar 객체 존재 여부도 확인
    const hasManualScaleBarObject = !!this.context.manualScaleBar;
    
    // 오류 상태 감지 및 수정: manualScaleBarSet이 true지만 다른 조건이 맞지 않으면 초기화
    if (this.context.manualScaleBarSet && (!isValidScaleBar || !hasManualScaleBarObject)) {
      // console.warn('[validateScaleBarSettings] 오류 상태 감지 및 수정:', {
      //   manualScaleBarSet: this.context.manualScaleBarSet,
      //   scaleBarValue: this.context.scaleBarValue,
      //   scaleBarUnit: this.context.scaleBarUnit,
      //   validValue: validScaleBarValue,
      //   validUnit: validScaleBarUnit,
      //   hasManualScaleBarObject: hasManualScaleBarObject,
      //   reason: !isValidScaleBar ? '유효하지 않은 값' : '수동 스케일바 객체 없음'
      // });
      
      // 잘못된 상태 초기화
      this.context.manualScaleBarSet = false;
      this.context.scaleBarDetected = false;
      
      // 변경사항 저장
      this.saveScaleBarSettings();
    }
    
    // 수동 스케일바가 설정되어 있고 모든 조건이 유효한 경우만 true 반환
    const hasValidManualScaleBar = this.context.manualScaleBarSet && isValidScaleBar && hasManualScaleBarObject;
    
    return {
      validValue: validScaleBarValue,
      validUnit: validScaleBarUnit,
      isValidScaleBar: isValidScaleBar,
      hasManualScaleBarObject: hasManualScaleBarObject,
      hasValidManualScaleBar: hasValidManualScaleBar
    };
  }

  /**
   * 수동 스케일바 그리기 모드 토글 함수
   */
  toggleScaleBarDrawing() {
    this.context.isDrawingScaleBar = !this.context.isDrawingScaleBar;
    
    // console.log(`[toggleScaleBarDrawing] 스케일바 그리기 모드 ${this.context.isDrawingScaleBar ? '활성화' : '비활성화'}`);
    
    if (this.context.isDrawingScaleBar) {
      // 스케일바 그리기 모드 활성화 시 측정 모드도 변경
      this.context.measurementMode = 'scaleBar';
      // 알림 메시지 제거 - UI에 영향을 주지 않도록
      // this.context.showNotification('수동 스케일바 그리기 모드가 활성화되었습니다. 이미지의 스케일바 위에 선을 그려주세요.', 'info');
      
      // 기존 설정 유지 (그리기 시작 전에 manualScaleBarSet을 변경하지 않음)
      // console.log(`[toggleScaleBarDrawing] 그리기 모드 활성화 - 현재 manualScaleBarSet: ${this.context.manualScaleBarSet}`);
    } else {
      // 스케일바 그리기 모드 비활성화 시 일반 선 측정 모드로 전환
      this.context.measurementMode = 'line';
      // 알림 메시지 제거 - UI에 영향을 주지 않도록
      // this.context.showNotification('수동 스케일바 그리기 모드가 비활성화되었습니다.', 'info');
    }
    
    // 캔버스 다시 그리기
    this.context.render();
  }

  /**
   * 스케일바 값 입력 다이얼로그 핸들링
   */
  handleScaleBarValueInput() {
    // console.log('[handleScaleBarValueInput] 스케일바 값 입력 처리');
    
    const numValue = parseFloat(this.context.tempScaleBarValue);
    if (isNaN(numValue) || numValue <= 0) {
      alert('유효한 양수를 입력해주세요.');
      return;
    }
    
    // console.log(`[handleScaleBarValueInput] 입력값: ${numValue} ${this.context.tempScaleBarUnit}`);
    
    // 스케일바 값 설정
    this.context.scaleBarValue = numValue;
    this.context.scaleBarUnit = this.context.tempScaleBarUnit;
    this.context.showScaleBarInputDialog = false;
    
    // 수동 스케일바 설정 플래그 업데이트 - 사용자가 직접 그린 경우에만 true로 설정
    if (this.context.manualScaleBar) {
      this.context.manualScaleBarSet = true;
      // console.log(`[handleScaleBarValueInput] 사용자가 직접 그린 스케일바에 대해 manualScaleBarSet 플래그를 true로 설정`);
      
      // 스케일바 감지 상태도 true로 설정
      this.context.scaleBarDetected = true;
    } else {
      // console.log(`[handleScaleBarValueInput] 사용자가 직접 그린 스케일바가 없어 manualScaleBarSet 플래그를 변경하지 않음`);
    }
    
    // 현재 상태 확인 로깅
    // console.log(`[handleScaleBarValueInput] 저장 전 상태 확인:`, {
    //   scaleMethod: this.context.scaleMethod,
    //   scaleBarValue: this.context.scaleBarValue,
    //   scaleBarUnit: this.context.scaleBarUnit,
    //   manualScaleBarSet: this.context.manualScaleBarSet,
    //   scaleBarDetected: this.context.scaleBarDetected
    // });
    
    // 설정 저장
    // console.log(`[handleScaleBarValueInput] saveScaleBarSettings 호출하여 설정 저장`);
    this.saveScaleBarSettings();
    
    // 저장 후 상태 확인 로깅
    // console.log(`[handleScaleBarValueInput] 설정 저장 후 manualScaleBarSet: ${this.context.manualScaleBarSet}`);
    
    // console.log('[handleScaleBarValueInput] 스케일바 값 설정 완료:', this.context.scaleBarValue, this.context.scaleBarUnit);
    this.context.showNotification(`스케일바 값이 ${this.context.scaleBarValue} ${this.context.scaleBarUnit}로 설정되었습니다.`, 'success');
    
    // 측정 모드로 전환 (중요: scaleMethod는 'scaleBar'로 유지하면서 measurementMode만 'line'으로 변경)
    this.context.isDrawingScaleBar = false;
    
    // pendingMeasurementMode가 있으면 해당 모드로 전환, 없으면 기본 선측정 모드
    if (this.context.pendingMeasurementMode) {
      this.context.measurementMode = this.context.pendingMeasurementMode;
      
      // 불량 감지 모드인 경우 관련 설정 활성화
      if (this.context.pendingMeasurementMode === 'defect') {
        this.context.isAreaSelectionMode = true;
      }
      
      // 상태 변경 알림 표시
      const modeNames = {
        'area-vertical': '세로 영역 측정',
        'area-horizontal': '가로 영역 측정',
        'defect': '불량 감지'
      };
      const modeName = modeNames[this.context.pendingMeasurementMode] || this.context.pendingMeasurementMode;
      this.context.showNotification(`스케일바 설정 완료. ${modeName} 모드로 전환되었습니다.`, 'info');
      
      // 대기 중인 모드 초기화
      this.context.pendingMeasurementMode = null;
    } else {
      this.context.measurementMode = 'line';
      // 추가 알림 표시 - 선 측정 모드 전환 안내
      this.context.showNotification('선 측정 모드로 자동 전환되었습니다.', 'info');
    }
    
    // console.log('[handleScaleBarValueInput] 선 측정 모드로 자동 전환:', 
      // 'scaleMethod:', this.context.scaleMethod,
      // 'measurementMode:', this.context.measurementMode);
    
    // 캔버스 다시 그리기
    this.context.render();
  }

  /**
   * 스케일바 값 입력 다이얼로그 표시 메소드
   */
  showScaleBarValueDialog() {
    // console.log('[showScaleBarValueDialog] 스케일바 값 입력 다이얼로그 표시');
    
    // 임시 입력값 초기화
    this.context.tempScaleBarValue = this.context.scaleBarValue || 500;
    this.context.tempScaleBarUnit = this.context.scaleBarUnit || 'nm';
    
    // 다이얼로그 표시
    this.context.showScaleBarInputDialog = true;
    
    // DOM에 반영되도록 nextTick 사용
    this.context.$nextTick(() => {
      // 입력 필드에 포커스
      const inputField = document.querySelector('.scale-bar-input-field');
      if (inputField) {
        inputField.focus();
        inputField.select();
      }
    });
  }

  /**
   * 스케일바 설정을 완전히 초기화하는 함수
   */
  clearScalebarSettings() {
    try {
      // console.log('[clearScalebarSettings] 스케일바 설정 전체 초기화 시작');
      
      // 세션 스토리지에서 스케일바 관련 데이터 모두 제거
      sessionStorage.removeItem('msa6_scale_method');
      sessionStorage.removeItem('msa6_scale_bar_value');
      sessionStorage.removeItem('msa6_scale_bar_unit');
      sessionStorage.removeItem('msa6_manual_scale_bar_set');
      sessionStorage.removeItem('msa6_manual_scale_bar');
      sessionStorage.removeItem('msa6_no_scale_popup');
      sessionStorage.removeItem('msa6_need_scale_detection');
      
      // Vue 컴포넌트 상태 초기화
      this.context.manualScaleBar = null;
      this.context.manualScaleBarSet = false;
      this.context.scaleBarDetected = false;
      this.context.scaleBarMeasurement = null;
      this.context.isDrawingScaleBar = false;
      this.context.showScaleChoicePopup = false;
      
      // 스케일바 값 기본값으로 리셋
      this.context.scaleBarValue = 500;
      this.context.scaleBarUnit = 'nm';
      this.context.scaleMethod = 'scaleBar';
      
      // console.log('[clearScalebarSettings] 스케일바 설정 전체 초기화 완료');
      
    } catch (error) {
      console.error('[clearScalebarSettings] 스케일바 설정 초기화 중 오류:', error);
    }
  }
} 