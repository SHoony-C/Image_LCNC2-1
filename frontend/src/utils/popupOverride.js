/**
 * 팝업 오버라이드 시스템
 * Vue 컴포넌트 시스템을 우회하고 직접 DOM 요소를 생성/제어하여 
 * 스케일바 감지 실패 시 팝업을 표시합니다.
 */

// 팝업이 이미 생성되었는지 추적하는 변수
let popupCreated = false;

/**
 * 스케일바 선택 팝업을 DOM에 직접 생성
 * @param {Function} onMagnificationSelect 배율 기반 측정 선택 시 콜백
 * @param {Function} onScaleBarSelect 수동 스케일바 설정 선택 시 콜백
 * @returns {HTMLElement} 생성된 팝업 요소
 */
export function createScaleChoicePopup(onMagnificationSelect, onScaleBarSelect) {
  // 팝업이 이미 존재하면 제거
  removeExistingPopup();
  
  console.log('[popupOverride] 독립 팝업 생성 시작');
  
  // 팝업 컨테이너 생성
  const popupDiv = document.createElement('div');
  popupDiv.id = 'scale-choice-popup-override';
  popupDiv.className = 'scale-choice-popup super-overlay';
  
  // 인라인 스타일 적용 (외부 CSS보다 우선)
  const popupStyles = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    display: flex !important;
    visibility: visible !important;
    z-index: 99999999 !important;
    background: rgba(0, 0, 0, 0.8) !important;
    justify-content: center !important;
    align-items: center !important;
    pointer-events: auto !important;
    opacity: 1 !important;
  `;
  popupDiv.setAttribute('style', popupStyles);
  
  // 팝업 내용 생성
  const contentHTML = `
    <div class="scale-choice-content" style="z-index:100000000 !important;position:relative !important;background:#fff !important;border-radius:12px !important;padding:2rem !important;width:90% !important;max-width:500px !important;box-shadow:0 10px 25px rgba(0,0,0,0.4) !important;text-align:center !important;">
      <h3 style="color:#7950f2 !important;margin:0 0 1rem 0 !important;font-size:1.5rem !important;">스케일바 감지 실패</h3>
      <p style="color:#495057 !important;margin-bottom:1.5rem !important;font-size:1rem !important;line-height:1.5 !important;">스케일바를 자동으로 감지하지 못했습니다. 측정 방식을 선택해주세요:</p>
      <div class="scale-choice-buttons" style="display:flex !important;justify-content:center !important;gap:1rem !important;">
        <button id="magnification-btn" class="choice-btn magnification-btn" style="display:flex !important;flex-direction:column !important;align-items:center !important;justify-content:center !important;padding:1.5rem !important;border-radius:10px !important;border:none !important;background:#e7f5ff !important;color:#228be6 !important;font-size:1rem !important;font-weight:600 !important;cursor:pointer !important;flex:1 !important;max-width:180px !important;">
          <i class="fas fa-search-plus" style="font-size:2rem !important;margin-bottom:0.5rem !important;"></i>
          <span>배율 기반 측정</span>
        </button>
        <button id="scalebar-btn" class="choice-btn scalebar-btn" style="display:flex !important;flex-direction:column !important;align-items:center !important;justify-content:center !important;padding:1.5rem !important;border-radius:10px !important;border:none !important;background:#fff4e6 !important;color:#fd7e14 !important;font-size:1rem !important;font-weight:600 !important;cursor:pointer !important;flex:1 !important;max-width:180px !important;">
          <i class="fas fa-pencil-ruler" style="font-size:2rem !important;margin-bottom:0.5rem !important;"></i>
          <span>수동 스케일바 설정</span>
        </button>
      </div>
    </div>
  `;
  
  popupDiv.innerHTML = contentHTML;
  
  // 팝업을 body에 추가
  document.body.appendChild(popupDiv);
  console.log('[popupOverride] 팝업 요소가 DOM에 추가됨');
  
  // 이벤트 리스너 추가
  const magBtn = document.getElementById('magnification-btn');
  const scaleBarBtn = document.getElementById('scalebar-btn');
  
  if (magBtn) {
    magBtn.addEventListener('click', function() {
      console.log('[popupOverride] 배율 기반 측정 선택됨');
      if (typeof onMagnificationSelect === 'function') {
        onMagnificationSelect();
      }
      removePopup(popupDiv);
    });
  }
  
  if (scaleBarBtn) {
    scaleBarBtn.addEventListener('click', function() {
      console.log('[popupOverride] 수동 스케일바 설정 선택됨');
      if (typeof onScaleBarSelect === 'function') {
        onScaleBarSelect();
      }
      removePopup(popupDiv);
    });
  }
  
  // 팝업 생성 플래그 설정
  popupCreated = true;
  
  // 5초 후 팝업이 여전히 존재하는지 확인 (디버깅용)
  setTimeout(() => {
    const popupExists = document.getElementById('scale-choice-popup-override');
    console.log('[popupOverride] 5초 후 팝업 존재 확인:', !!popupExists);
    
    if (popupExists) {
      // 팝업 요소의 스타일 확인
      const computedStyle = window.getComputedStyle(popupExists);
      console.log('[popupOverride] 팝업 스타일 확인:');
      console.log('- display:', computedStyle.display);
      console.log('- visibility:', computedStyle.visibility);
      console.log('- z-index:', computedStyle.zIndex);
      console.log('- opacity:', computedStyle.opacity);
    }
  }, 5000);
  
  return popupDiv;
}

/**
 * 이미 존재하는 팝업 요소 제거
 */
function removeExistingPopup() {
  const existingPopup = document.getElementById('scale-choice-popup-override');
  if (existingPopup) {
    console.log('[popupOverride] 기존 팝업 요소 제거');
    existingPopup.parentNode.removeChild(existingPopup);
    popupCreated = false;
  }
}

/**
 * 팝업 요소 제거
 * @param {HTMLElement} popupElement 제거할 팝업 요소
 */
function removePopup(popupElement) {
  console.log('[popupOverride] 팝업 제거 시작');
  
  if (popupElement && popupElement.parentNode) {
    popupElement.parentNode.removeChild(popupElement);
    console.log('[popupOverride] 팝업 요소가 DOM에서 제거됨');
  } else {
    removeExistingPopup();
  }
  
  popupCreated = false;
}

/**
 * 스케일바 감지 실패 시 팝업 표시 함수
 * @param {Object} component 이미지 측정 Vue 컴포넌트 인스턴스
 */
export function showScaleDetectionFailurePopup(component) {
  console.log('[popupOverride] 스케일바 감지 실패 팝업 표시 함수 호출됨');
  
  // 이미 팝업이 생성되어 있으면 중복 생성 방지
  if (popupCreated) {
    console.log('[popupOverride] 이미 팝업이 생성되어 있음, 중복 생성 방지');
    return;
  }
  
  // 콜백 함수 정의
  const onMagnificationSelect = function() {
    console.log('[popupOverride] 배율 기반 측정 콜백 실행');
    if (component) {
      // Vue 컴포넌트 메소드 호출
      if (typeof component.selectScaleMethod === 'function') {
        component.selectScaleMethod('magnification');
      } else {
        // 대체 처리: 직접 데이터 설정
        component.scaleMethod = 'magnification';
        component.isDrawingScaleBar = false;
      }
    }
  };
  
  const onScaleBarSelect = function() {
    console.log('[popupOverride] 수동 스케일바 설정 콜백 실행');
    if (component) {
      // Vue 컴포넌트 메소드 호출
      if (typeof component.selectScaleMethod === 'function') {
        component.selectScaleMethod('scaleBar');
      } else {
        // 대체 처리: 직접 데이터 설정
        component.scaleMethod = 'scaleBar';
        component.isDrawingScaleBar = true;
      }
    }
  };
  
  // 팝업 생성
  createScaleChoicePopup(onMagnificationSelect, onScaleBarSelect);
  
  // 알림 메시지 표시 (컴포넌트 메소드 사용)
  if (component && typeof component.showNotification === 'function') {
    component.showNotification('스케일바 자동 감지에 실패했습니다. 측정 방식을 선택해주세요.', 'warning');
  }
}

/**
 * 메인 스케일바 감지 함수 패치 (기존 함수를 대체)
 * @param {Object} component 이미지 측정 Vue 컴포넌트 인스턴스
 */
export function patchDetectScaleBar(component) {
  if (!component) {
    console.error('[popupOverride] 컴포넌트가 제공되지 않음, 패치 실패');
    return false;
  }
  
  // 원본 함수 참조 저장
  const originalDetectScaleBar = component.detectScaleBar;
  
  // 새로운 함수로 대체
  component.detectScaleBar = function() {
    console.log('[popupOverride] 패치된 detectScaleBar 함수 호출됨');
    
    // 이미지 데이터가 없는 경우 항상 팝업 표시
    if (!this.imageData && this.scaleMethod === 'scaleBar') {
      console.log('[popupOverride] 이미지 데이터 없음, 감지 실패 팝업 표시');
      this.scaleBarDetected = false;
      
      // 항상 커스텀 팝업 표시 (조건 체크 없이)
      showScaleDetectionFailurePopup(this);
      return;
    }
    
    // 원본 함수 실행 (이미지 데이터가 있는 경우)
    if (this.imageData) {
      console.log('[popupOverride] 이미지 데이터 있음, 원본 함수 호출');
      const result = originalDetectScaleBar.apply(this);
      
      // 스케일바 감지 실패한 경우 항상 팝업 표시 (첫 번째 시도 조건 제거)
      if (!this.scaleBarDetected && this.scaleMethod === 'scaleBar') {
        console.log('[popupOverride] 스케일바 감지 실패, 팝업 표시');
        
        // 커스텀 팝업 표시
        showScaleDetectionFailurePopup(this);
      }
      
      return result;
    }
  };
  
  console.log('[popupOverride] detectScaleBar 함수가 성공적으로 패치됨');
  return true;
}

// 개별 함수 내보내기만 유지하고 기본 내보내기 제거
// export default {
//  createScaleChoicePopup,
//  showScaleDetectionFailurePopup,
//  patchDetectScaleBar
// }; 