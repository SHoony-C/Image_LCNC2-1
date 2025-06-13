import LogService from './logService';
import { showScaleDetectionFailurePopup } from './popupOverride';

export const imageHandlers = {
  async loadImage(url) {
    console.log('[loadImage] 이미지 로드 시작:', url);
    
    if (!url) {
      console.error('[loadImage] 유효한 URL이 제공되지 않음');
      return;
    }
    
    // 이미지 URL 검증
    const validation = this.validateImageUrl(url);
    if (!validation.isValid) {
      console.error('[loadImage] URL 검증 실패:', validation.error);
      this.showNotification(validation.error, 'error');
      return;
    }
    
    // 이미지 URL 설정
    this.outputImageUrl = url;
      
    // 이전 이미지 제거
    if (this.image) {
      console.log('[loadImage] 이전 이미지 정리');
    }
    
    // 새 이미지 객체 생성
    this.image = new Image();
    this.image.crossOrigin = 'anonymous'; // CORS 이슈 방지
    
    // 저장된 스케일바 설정 복원
    this.restoreScaleBarSettings();
    
    // 수동 스케일바 설정 유효성 검증
    const { hasValidManualScaleBar } = this.validateScaleBarSettings();
      
    // 수동 스케일바 설정이 있고 유효한 경우에만 scaleBarDetected를 true로 설정
    if (hasValidManualScaleBar) {
      console.log('[loadImage] 유효한 수동 스케일바 설정 확인:', 
        'scaleBarValue:', this.scaleBarValue, 
        'scaleBarUnit:', this.scaleBarUnit);
      this.scaleBarDetected = true;
    }
    
    // Promise를 사용한 이미지 로드 처리
    return new Promise((resolve, reject) => {
      // 이미지 로드 성공 처리
      this.image.onload = async () => {
        try {
          console.log('[loadImage] 이미지 로드 완료');
          
          // 이미지 크기 검증
          if (this.image.naturalWidth === 0 || this.image.naturalHeight === 0) {
            throw new Error('이미지 크기가 0입니다');
          }
          
          // 이미지 로드 후 캔버스 크기 업데이트
          this.updateCanvasSize();
          
          // 캔버스 스타일 강제 업데이트
          const canvas = this.$refs.canvas;
          if (canvas) {
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.margin = '0';
            canvas.style.padding = '0';
            
            // 강제 리플로우 트리거 (브라우저 레이아웃 재계산)
            void canvas.offsetHeight;
          }
          
          // 이미지 데이터 추출을 위한 임시 캔버스
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = this.image.naturalWidth;
          tempCanvas.height = this.image.naturalHeight;
          const tempCtx = tempCanvas.getContext('2d');
          
          tempCtx.drawImage(this.image, 0, 0);
          this.imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            
          // 팝업 표시 여부 결정 - 수동 스케일바가 설정되어 있는지 정확히 확인
          console.log('[loadImage] 수동 스케일바 설정 상태 확인:', 
            'manualScaleBarSet:', this.manualScaleBarSet, 
            'scaleBarValue:', this.scaleBarValue, 
            'scaleBarUnit:', this.scaleBarUnit,
            '유효한 설정:', hasValidManualScaleBar);
          
          // ⚠️ 주의: 이 부분은 MSA5 프로세스 시작 시 스케일바 팝업 방지를 위한 핵심 로직입니다. 수정 시 주의하세요! ⚠️
          // 스케일바 자동 감지 팝업 방지 플래그 확인
          const noScalePopup = sessionStorage.getItem('msa6_no_scale_popup') === 'true';
          if (noScalePopup) {
            console.log('[loadImage] 스케일바 자동 감지 팝업 방지 플래그가 설정되어 있어 팝업을 표시하지 않음');
            // 플래그 제거 (일회성)
            sessionStorage.removeItem('msa6_no_scale_popup');
            resolve();
            return;
          }
          
          // 수동 스케일바가 설정되어 있고 유효한 경우 팝업 표시하지 않음
          if (hasValidManualScaleBar) {
            console.log('[loadImage] 유효한 수동 스케일바가 이미 설정되어 있어 팝업 표시하지 않음');
          }
          // 스케일바 모드이고 수동 설정이 안 된 경우에만 자동 감지 시도
          else if (this.scaleMethod === 'scaleBar' && this.showPopup) {
            console.log('[loadImage] 스케일바 자동 감지 시도');
            // 약간의 지연 후 detectScaleBar 호출 (DOM이 완전히 업데이트되도록)
            setTimeout(() => {
                // 자동 감지 실행 - 감지 성공 여부는 detectScaleBar 내에서 처리
                this.detectScaleBar(true); // true = 감지 실패 시 팝업 표시 강제
            }, 300);
          } else {
            console.log('[loadImage] 자동 감지 미실행:', 
              '방식:', this.scaleMethod, 
              '팝업표시:', this.showPopup, 
              '수동설정여부:', this.manualScaleBarSet);
          }
          
          // 이미지가 로드된 후 기존 측정값 렌더링
          if (this.initialLoadDone && this.measurements.length > 0) {
            console.log('[loadImage] 기존 측정값 렌더링');
            this.$nextTick(() => this.render());
          }
          
          // 로그 저장 - 측정 팝업 열기
          LogService.logAction('open_measurement_popup', {
            imageLoaded: true
          });
          
          resolve();
        } catch (error) {
          console.error('[loadImage] 이미지 로드 후 처리 중 오류:', error);
          this.showNotification('이미지 처리 중 오류가 발생했습니다.', 'error');
          reject(error);
        }
      };
      
      // 이미지 로드 실패 처리
      this.image.onerror = (error) => {
        console.error('[loadImage] 이미지 로드 실패:', error);
        console.error('[loadImage] 실패한 URL:', url);
        
        // 향상된 오류 메시지 제공
        let errorMessage = '이미지를 불러오는데 실패했습니다.';
        
        if (url.startsWith('data:image/svg+xml')) {
          errorMessage = 'SVG 이미지 데이터를 처리할 수 없습니다. 이미지 형식을 확인해주세요.';
        } else if (url.startsWith('data:')) {
          errorMessage = '이미지 데이터 형식이 올바르지 않습니다.';
        } else if (url.startsWith('http')) {
          errorMessage = '이미지 서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.';
        }
        
        this.showNotification(errorMessage, 'error');
        
        // 로그 저장 - 이미지 로드 실패
        LogService.logAction('image_load_error', {
          url: url.substring(0, 100) + '...', // URL이 너무 길 수 있으므로 일부만 저장
          error: error ? error.toString() : 'Unknown error',
          isDataUrl: url.startsWith('data:'),
          isSvg: url.includes('svg'),
          validation: validation
        });
        
        reject(error);
      };
      
      // 이미지 로드 시작
      this.image.src = url;
    });
  },

  async handleImageLoad(event) {
    // Get the image element from the event or reference
    const img = event.target || this.$refs.sourceImage;
    
    console.log('[handleImageLoad] 이미지 로드 완료 - 크기:', img.naturalWidth, 'x', img.naturalHeight);
    this.image = img;
    
    // 전환 중인지 확인 (toggleBeforeAfterImage에서 호출된 경우)
    const isToggling = this.isToggling;
    if (isToggling) {
      console.log('[handleImageLoad] 이미지 전환 중, 측정 데이터 유지');
      return; // 전환 중이면 추가 처리하지 않음 (toggleBeforeAfterImage에서 처리)
    }
    
    // 원본 이미지 비율 저장
    this.imageRatio = img.naturalWidth / img.naturalHeight;
    
    // 이미지 데이터 추출을 위한 임시 캔버스
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = img.naturalWidth;
    tempCanvas.height = img.naturalHeight;
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCtx.drawImage(img, 0, 0);
    this.imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    
    this.updateCanvasSize();
    
    // 수동 스케일바 설정 여부 정확히 확인
    console.log('[handleImageLoad] 수동 스케일바 설정 상태 확인:', 
      'manualScaleBarSet:', this.manualScaleBarSet, 
      'scaleBarValue:', this.scaleBarValue, 
      'scaleBarUnit:', this.scaleBarUnit);
    
    // 스케일바 자동 감지 팝업 방지 플래그 확인
    const noScalePopup = sessionStorage.getItem('msa6_no_scale_popup') === 'true';
    if (noScalePopup) {
      console.log('[handleImageLoad] 스케일바 자동 감지 팝업 방지 플래그가 설정되어 있어 팝업을 표시하지 않음');
      // 플래그 제거 (일회성)
      sessionStorage.removeItem('msa6_no_scale_popup');
      return;
    }
    
    // 스케일바 모드이고 수동 스케일바가 설정되어 있지 않은 경우에만 팝업 표시
    if (this.scaleMethod === 'scaleBar' && this.showPopup && 
        !(this.manualScaleBarSet && this.scaleBarValue && this.scaleBarUnit)) {
        console.log('[handleImageLoad] 스케일바 모드, 수동 스케일바 없음, 선택 팝업 표시');
        
        // 여기서 직접 팝업 표시
        this.showScaleChoicePopup = true;
        
        // 잠시 지연 후 오버라이드 팝업 표시
        setTimeout(() => {
          showScaleDetectionFailurePopup();
          
          // 내장 팝업도 표시
          this.$nextTick(() => {
            try {
              const popupElement = document.querySelector('.scale-choice-popup');
              if (popupElement) {
                console.log('[handleImageLoad] 팝업 요소에 스타일 직접 적용');
                popupElement.style.display = 'flex';
                popupElement.style.zIndex = '999999';
              }
            } catch (e) {
              console.error('[handleImageLoad] 팝업 스타일 적용 중 오류:', e);
            }
          });
        }, 100);
      } else {
        console.log('[handleImageLoad] 수동 스케일바가 이미 설정되어 있어 팝업 표시하지 않음:', 
        this.scaleBarValue, this.scaleBarUnit, 'manualScaleBarSet:', this.manualScaleBarSet);
    }
    
    // 스케일바 자동 감지 시도 - 최초 로드 시에만 시도, 그리고 수동 스케일바가 없는 경우에만
    if (this.scaleMethod === 'scaleBar' && !this.initialLoadDone && 
        !(this.manualScaleBarSet && this.scaleBarValue && this.scaleBarUnit)) {
      console.log('[handleImageLoad] 이미지 로드 완료, 스케일바 감지 시도, 초기 로드 상태:', this.$_isInitialLoad);
      this.detectScaleBar();
    }
    
    // 처음 로드인 경우 플래그 설정
    if (!this.initialLoadDone) {
      this.initialLoadDone = true;
      this.$_isInitialLoad = false;
    }
    
    // 이미지 로드 완료 후 캔버스 다시 그리기
      this.$nextTick(() => {
        this.render();
      });
  },

  clearImage() {
    console.log('[clearImage] 이미지 초기화');
    this.image = null;
    this.imageData = null;
    
    // 캔버스 초기화
    const canvas = this.$refs.canvas;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  },

  // 이미지 전/후 전환 함수
  toggleBeforeAfterImage() {
    console.log('[toggleBeforeAfterImage] 이미지 전환 시작, 현재 상태:', this.isShowingInputImage ? '입력 이미지' : '출력 이미지');
    
    // 전환 중 플래그 설정
    this.isToggling = true;
    
    // 상태 토글
    this.isShowingInputImage = !this.isShowingInputImage;
    
    // 이미지 소스 업데이트
    const img = this.$refs.sourceImage;
    if (img) {
      const newSrc = this.isShowingInputImage ? this.internalInputImageUrl : this.imageUrl;
      console.log('[toggleBeforeAfterImage] 이미지 소스 변경:', newSrc);
      
      img.onload = () => {
        console.log('[toggleBeforeAfterImage] 새 이미지 로드 완료');
        
        // 이미지 객체 업데이트
        this.image = img;
        
        // 이미지 데이터 추출
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.naturalWidth;
        tempCanvas.height = img.naturalHeight;
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCtx.drawImage(img, 0, 0);
        this.imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        
        // 캔버스 크기 업데이트 및 다시 그리기
        this.updateCanvasSize();
        this.render();
        
        // 전환 완료 플래그 해제
        this.isToggling = false;
        
        console.log('[toggleBeforeAfterImage] 이미지 전환 완료, 새 상태:', this.isShowingInputImage ? '입력 이미지' : '출력 이미지');
      };
      
      img.onerror = (error) => {
        console.error('[toggleBeforeAfterImage] 이미지 로드 실패:', error);
        this.showNotification('이미지 전환에 실패했습니다.', 'error');
        
        // 상태 되돌리기
        this.isShowingInputImage = !this.isShowingInputImage;
        this.isToggling = false;
      };
      
      img.src = newSrc;
    }
  },

  // 결과 이미지 다운로드 함수
  downloadResultImage() {
    console.log('[downloadResultImage] 이미지 다운로드 시작');
    
    try {
      const currentImageUrl = this.isShowingInputImage ? this.internalInputImageUrl : this.imageUrl;
      
      if (!currentImageUrl) {
        this.showNotification('다운로드할 이미지가 없습니다.', 'error');
        return;
      }
      
      // 파일명 생성
      const urlParts = currentImageUrl.split('/');
      const originalFileName = urlParts[urlParts.length - 1];
      const fileNameWithoutExt = originalFileName.split('.')[0];
      const extension = originalFileName.split('.').pop();
      
      const prefix = this.isShowingInputImage ? 'input_' : 'output_';
      const downloadFileName = `${prefix}${fileNameWithoutExt}.${extension}`;
      
      // 다운로드 링크 생성
      const link = document.createElement('a');
      link.href = currentImageUrl;
      link.download = downloadFileName;
      link.target = '_blank';
      
      // 다운로드 실행
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('[downloadResultImage] 다운로드 완료:', downloadFileName);
      this.showNotification(`이미지가 다운로드되었습니다: ${downloadFileName}`, 'success');
      
      // 로그 저장
      LogService.logAction('download_image', {
        fileName: downloadFileName,
        imageType: this.isShowingInputImage ? 'input' : 'output'
      });
      
    } catch (error) {
      console.error('[downloadResultImage] 다운로드 실패:', error);
      this.showNotification('이미지 다운로드에 실패했습니다.', 'error');
    }
  },

  // MSA5 이미지 처리 완료 이벤트 핸들러
  handleMSA5ImageProcessed(event) {
    console.log('[handleMSA5ImageProcessed] MSA5 이미지 처리 완료 이벤트 수신:', event.detail);
    
    try {
      const { inputImageUrl, outputImageUrl } = event.detail;
      
      if (inputImageUrl) {
        this.internalInputImageUrl = inputImageUrl;
        console.log('[handleMSA5ImageProcessed] 입력 이미지 URL 업데이트:', inputImageUrl);
      }
      
      if (outputImageUrl) {
        this.outputImageUrl = outputImageUrl;
        console.log('[handleMSA5ImageProcessed] 출력 이미지 URL 업데이트:', outputImageUrl);
        
        // 현재 표시 중인 이미지가 출력 이미지인 경우 업데이트
        if (!this.isShowingInputImage) {
          this.loadImage(outputImageUrl);
        }
      }
      
    } catch (error) {
      console.error('[handleMSA5ImageProcessed] 이벤트 처리 중 오류:', error);
    }
  },

  // 이미지 URL 정리 함수
  cleanupImageUrls() {
    console.log('[cleanupImageUrls] 이미지 URL 정리 시작');
    
    try {
      // 이미지 객체 정리
      if (this.image) {
        this.image.onload = null;
        this.image.onerror = null;
        this.image.src = '';
        this.image = null;
      }
      
      // URL 정리 (Blob URL인 경우)
      if (this.internalInputImageUrl && this.internalInputImageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(this.internalInputImageUrl);
        console.log('[cleanupImageUrls] 입력 이미지 Blob URL 해제:', this.internalInputImageUrl);
      }
      
      if (this.outputImageUrl && this.outputImageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(this.outputImageUrl);
        console.log('[cleanupImageUrls] 출력 이미지 Blob URL 해제:', this.outputImageUrl);
      }
      
      // URL 초기화
      this.internalInputImageUrl = null;
      this.outputImageUrl = null;
      
      console.log('[cleanupImageUrls] 이미지 URL 정리 완료');
      
    } catch (error) {
      console.error('[cleanupImageUrls] URL 정리 중 오류:', error);
    }
  }
} 