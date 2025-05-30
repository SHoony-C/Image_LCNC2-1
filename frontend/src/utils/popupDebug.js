/**
 * 팝업 디버깅 유틸리티
 * 스케일바 감지 실패 팝업이 표시되지 않는 문제를 해결하기 위한 디버깅 도구
 */

// 팝업 요소 강제 표시 함수
export function forceShowPopup() {
  console.log('팝업 강제 표시 시도');
  
  // 글로벌 변수에 상태 저장
  window._popupDebugForce = {
    timestamp: new Date().toISOString(),
    attempts: 0
  };
  
  // 1초 간격으로 10번 시도
  const intervalId = setInterval(() => {
    // 시도 횟수 증가
    if (window._popupDebugForce) {
      window._popupDebugForce.attempts++;
    }
    
    try {
      // 팝업 요소 찾기
      const popupElement = document.querySelector('.scale-choice-popup');
      const contentElement = document.querySelector('.scale-choice-content');
      
      if (popupElement) {
        console.log('팝업 요소 발견, 강제 표시');
        
        // 스타일 강제 적용
        popupElement.style.display = 'flex';
        popupElement.style.visibility = 'visible';
        popupElement.style.zIndex = '9999999';
        popupElement.style.position = 'fixed';
        popupElement.style.top = '0';
        popupElement.style.left = '0';
        popupElement.style.width = '100%';
        popupElement.style.height = '100%';
        popupElement.style.background = 'rgba(0, 0, 0, 0.8)';
        
        if (contentElement) {
          contentElement.style.zIndex = '10000000';
          contentElement.style.boxShadow = '0 0 30px rgba(0, 0, 0, 0.8)';
        }
        
        console.log('팝업 스타일 적용 완료');
        
        // 성공 시 간격 종료
        clearInterval(intervalId);
        
        if (window._popupDebugForce) {
          window._popupDebugForce.success = true;
          window._popupDebugForce.endTimestamp = new Date().toISOString();
        }
      } else {
        console.log(`팝업 요소를 찾을 수 없음 (시도 ${window._popupDebugForce?.attempts || 0}/10)`);
        
        // 이미지 측정 컴포넌트 찾기
        const compInstance = window.imageMeasurement;
        if (compInstance) {
          // 팝업 표시 플래그 설정
          compInstance.showScaleChoicePopup = true;
          
          // 다음 틱에서 DOM 업데이트
          if (compInstance.$nextTick) {
            compInstance.$nextTick(() => {
              const newPopupElement = document.querySelector('.scale-choice-popup');
              if (newPopupElement) {
                console.log('팝업 요소 생성됨, 스타일 적용');
                newPopupElement.style.display = 'flex';
                newPopupElement.style.visibility = 'visible';
                newPopupElement.style.zIndex = '9999999';
                // 다른 스타일도 적용
              }
            });
          }
        } else {
          console.log('이미지 측정 컴포넌트를 찾을 수 없음');
        }
      }
    } catch (e) {
      console.error('팝업 강제 표시 중 오류:', e);
      
      if (window._popupDebugForce) {
        window._popupDebugForce.error = e.message;
      }
    }
    
    // 10번 시도 후 종료
    if (window._popupDebugForce && window._popupDebugForce.attempts >= 10) {
      clearInterval(intervalId);
      console.log('팝업 강제 표시 시도 종료 (10회 시도)');
      
      if (window._popupDebugForce) {
        window._popupDebugForce.endTimestamp = new Date().toISOString();
      }
    }
  }, 1000);
  
  return '팝업 강제 표시 시도 중... 콘솔에서 window._popupDebugForce 변수로 상태를 확인할 수 있습니다.';
}

// 팝업 상태 진단 함수
export function diagnosePopupState() {
  console.log('=== 팝업 상태 진단 시작 ===');
  
  // 진단 결과 저장 객체
  const diagnosis = {
    timestamp: new Date().toISOString(),
    foundElements: {},
    componentState: {},
    styleIssues: {},
    zIndexConflicts: []
  };
  
  try {
    // 1. DOM에 팝업 요소가 있는지 확인
    const popupElement = document.querySelector('.scale-choice-popup');
    const contentElement = document.querySelector('.scale-choice-content');
    
    diagnosis.foundElements.popup = !!popupElement;
    diagnosis.foundElements.content = !!contentElement;
    
    console.log('팝업 요소 존재:', !!popupElement);
    console.log('콘텐츠 요소 존재:', !!contentElement);
    
    // 2. 이미지 측정 컴포넌트 상태 확인
    const compInstance = window.imageMeasurement;
    if (compInstance) {
      diagnosis.componentState.exists = true;
      diagnosis.componentState.showScaleChoicePopup = compInstance.showScaleChoicePopup;
      diagnosis.componentState.scaleMethod = compInstance.scaleMethod;
      diagnosis.componentState.isFirstDetectionAttempt = compInstance.isFirstDetectionAttempt;
      
      console.log('컴포넌트 상태:');
      console.log('- showScaleChoicePopup:', compInstance.showScaleChoicePopup);
      console.log('- scaleMethod:', compInstance.scaleMethod);
      console.log('- isFirstDetectionAttempt:', compInstance.isFirstDetectionAttempt);
    } else {
      diagnosis.componentState.exists = false;
      console.log('이미지 측정 컴포넌트를 찾을 수 없음');
    }
    
    // 3. 팝업 요소 스타일 확인
    if (popupElement) {
      const style = window.getComputedStyle(popupElement);
      diagnosis.popupStyles = {
        display: style.display,
        visibility: style.visibility,
        zIndex: style.zIndex,
        position: style.position
      };
      
      console.log('팝업 스타일:');
      console.log('- display:', style.display);
      console.log('- visibility:', style.visibility);
      console.log('- z-index:', style.zIndex);
      console.log('- position:', style.position);
      
      // 스타일 문제 확인
      if (style.display === 'none') {
        diagnosis.styleIssues.display = true;
        console.log('문제: 팝업이 display: none으로 설정됨');
      }
      
      if (style.visibility === 'hidden') {
        diagnosis.styleIssues.visibility = true;
        console.log('문제: 팝업이 visibility: hidden으로 설정됨');
      }
      
      if (parseInt(style.zIndex) < 9000) {
        diagnosis.styleIssues.lowZIndex = true;
        console.log('문제: 팝업의 z-index가 낮음:', style.zIndex);
      }
    }
    
    // 4. z-index 충돌 확인
    const allElements = document.querySelectorAll('*');
    const highZIndexElements = [];
    
    allElements.forEach(el => {
      const style = window.getComputedStyle(el);
      const zIndex = parseInt(style.zIndex);
      
      if (!isNaN(zIndex) && zIndex > 9000 && !el.classList.contains('scale-choice-popup') && !el.classList.contains('scale-choice-content')) {
        highZIndexElements.push({
          element: el.tagName,
          class: el.className,
          zIndex: zIndex
        });
      }
    });
    
    diagnosis.zIndexConflicts = highZIndexElements;
    
    if (highZIndexElements.length > 0) {
      console.log('높은 z-index를 가진 다른 요소들 (잠재적 충돌):');
      highZIndexElements.forEach(item => {
        console.log(`- ${item.element}.${item.class}: z-index ${item.zIndex}`);
      });
    } else {
      console.log('z-index 충돌 없음');
    }
    
    // 5. 최종 진단 및 권장 조치
    console.log('\n=== 진단 결과 ===');
    
    if (!popupElement) {
      console.log('심각: 팝업 DOM 요소가 존재하지 않음');
      console.log('권장 조치: 컴포넌트의 showScaleChoicePopup 값이 true인지 확인');
    } else if (diagnosis.styleIssues.display || diagnosis.styleIssues.visibility) {
      console.log('심각: 팝업이 숨겨져 있음 (display 또는 visibility 문제)');
      console.log('권장 조치: 팝업 스타일을 display: flex, visibility: visible로 강제 설정');
    } else if (diagnosis.styleIssues.lowZIndex || diagnosis.zIndexConflicts.length > 0) {
      console.log('경고: z-index 충돌 가능성');
      console.log('권장 조치: 팝업의 z-index를 더 높은 값으로 설정 (99999999 등)');
    } else if (popupElement && !diagnosis.styleIssues.display && !diagnosis.styleIssues.visibility && !diagnosis.styleIssues.lowZIndex) {
      console.log('정보: 팝업이 올바르게 표시되어야 함, 다른 문제 있을 수 있음');
      console.log('권장 조치: 브라우저 개발자 도구로 팝업 요소 검사');
    }
    
    // 저장된 진단 정보를 전역 변수에 노출
    window._popupDiagnosis = diagnosis;
    
    console.log('\n진단 완료. window._popupDiagnosis에서 결과 확인 가능.');
  } catch (e) {
    console.error('팝업 상태 진단 중 오류:', e);
    diagnosis.error = e.message;
  }
  
  return diagnosis;
}

// 스케일바 감지 직접 호출 (선택 팝업 표시 유도)
export function triggerScaleBarDetection() {
  const compInstance = window.imageMeasurement;
  
  if (!compInstance) {
    console.error('이미지 측정 컴포넌트를 찾을 수 없음');
    return '컴포넌트를 찾을 수 없음';
  }
  
  try {
    // 스케일바 메소드로 설정
    compInstance.scaleMethod = 'scaleBar';
    
    // 첫 번째 감지 시도 플래그 설정
    compInstance.isFirstDetectionAttempt = true;
    
    // 스케일바 감지 실행
    console.log('스케일바 감지 함수 호출 시도...');
    compInstance.detectScaleBar();
    
    return '스케일바 감지 함수 호출 완료. 콘솔을 확인하세요.';
  } catch (e) {
    console.error('스케일바 감지 호출 중 오류:', e);
    return `오류 발생: ${e.message}`;
  }
}

// 모든 함수를 객체로 export
export default {
  forceShowPopup,
  diagnosePopupState,
  triggerScaleBarDetection
}; 