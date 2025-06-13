export const keyboardHandlers = {
  handleKeyDown(e) {
    console.log(`[handleKeyDown] 키 눌림: ${e.key}`);
    
    // 입력 필드에 포커스가 있는 경우 키보드 이벤트 무시
    if (this.isInputFocused()) {
      return;
    }
    
    switch (e.key.toLowerCase()) {
      case 'f':
        this.isFKeyPressed = true;
        this.showBrightnessTooltip = true;
        break;
      case 'd':
        this.isDKeyPressed = true;
        break;
      case 'delete':
      case 'backspace':
        this.toggleDeleteMode();
        break;
      case 'r':
        this.toggleReverse();
        break;
      case '+':
      case '=':
        this.increaseLineCount();
        break;
      case '-':
      case '_':
        this.decreaseLineCount();
        break;
      case 'escape':
        this.handleEscapeKey();
        break;
      case 'z':
        if (e.ctrlKey) {
          e.preventDefault();
          this.undo();
        }
        break;
      case 'y':
        if (e.ctrlKey) {
          e.preventDefault();
          this.redo();
        }
        break;
      case 's':
        if (e.ctrlKey) {
          e.preventDefault();
          this.exportResults();
        }
        break;
      case '1':
        this.setMode('line');
        break;
      case '2':
        this.setMode('reference');
        break;
      case '3':
        this.setMode('circle');
        break;
      case '4':
        this.setMode('area-bright');
        break;
      case '5':
        this.setMode('area-dark');
        break;
      case '6':
        this.setMode('defect');
        break;
    }
  },

  handleKeyUp(e) {
    console.log(`[handleKeyUp] 키 해제: ${e.key}`);
    
    switch (e.key.toLowerCase()) {
      case 'f':
        this.isFKeyPressed = false;
        this.showBrightnessTooltip = false;
        break;
      case 'd':
        this.isDKeyPressed = false;
        // d키 해제 시 임시 드래그 선 제거
        if (this.tempDragLine) {
          this.tempDragLine = null;
          this.render();
        }
        break;
    }
  },

  handleEscapeKey() {
    console.log('[handleEscapeKey] ESC 키 처리');
    
    // 현재 측정 중인 작업 취소
    this.currentMeasurement = null;
    this.areaStart = null;
    this.areaEnd = null;
    this.isMeasuring = false;
    
    // 삭제 모드 해제
    this.isDeleteMode = false;
    this.deleteStart = null;
    this.deleteEnd = null;
    
    // 영역 선택 모드 해제
    this.isAreaSelectionMode = false;
    this.areaSelectionStart = null;
    this.areaSelectionEnd = null;
    
    // 스케일바 그리기 모드 해제
    this.isDrawingScaleBar = false;
    
    // 임시 드래그 선 제거
    this.tempDragLine = null;
    
    // 다이얼로그 닫기
    this.showScaleBarDialog = false;
    this.showScaleChoicePopup = false;
    
    // 캔버스 다시 그리기
    this.render();
    
    console.log('[handleEscapeKey] 모든 작업 취소 완료');
  },

  isInputFocused() {
    const activeElement = document.activeElement;
    return activeElement && (
      activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.tagName === 'SELECT' ||
      activeElement.contentEditable === 'true'
    );
  },

  // 키보드 이벤트 리스너 등록
  setupKeyboardListeners() {
    console.log('[setupKeyboardListeners] 키보드 이벤트 리스너 등록');
    
    // 기존 리스너 제거 (중복 방지)
    this.removeKeyboardListeners();
    
    // 키보드 이벤트 리스너 등록
    this.keyDownHandler = this.handleKeyDown.bind(this);
    this.keyUpHandler = this.handleKeyUp.bind(this);
    
    document.addEventListener('keydown', this.keyDownHandler);
    document.addEventListener('keyup', this.keyUpHandler);
  },

  // 키보드 이벤트 리스너 제거
  removeKeyboardListeners() {
    console.log('[removeKeyboardListeners] 키보드 이벤트 리스너 제거');
    
    if (this.keyDownHandler) {
      document.removeEventListener('keydown', this.keyDownHandler);
      this.keyDownHandler = null;
    }
    
    if (this.keyUpHandler) {
      document.removeEventListener('keyup', this.keyUpHandler);
      this.keyUpHandler = null;
    }
  }
} 