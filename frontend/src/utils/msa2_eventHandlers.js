export const eventHandlers = {
  // MSA1 이미지 업데이트 이벤트 처리
  handleImageUpdate(event) {
    console.log('[MSA4] MSA1에서 이미지 업데이트 이벤트 수신:', event.detail);
    
    if (!event.detail) {
      console.warn('MSA1 이미지 이벤트에 detail이 없습니다');
      return;
    }
    
    const { imageUrl, imageName } = event.detail;
    
    if (!imageUrl) {
      console.warn('MSA1 이미지 이벤트에 imageUrl이 없습니다');
      return;
    }
    
    this.processNewImage({
      imageUrl: imageUrl,
      imageName: imageName || this.getImageNameFromUrl(imageUrl),
      source: 'msa1-event'
    });
  },

  // MSA5에서 유사 이미지 결과 수신
  handleSimilarImagesFromMSA5(event) {
    console.log('[MSA4] MSA5에서 유사 이미지 결과 수신:', event.detail);
    
    if (!event.detail || !event.detail.similarImages) {
      console.warn('MSA5 유사 이미지 이벤트에 데이터가 없습니다');
      return;
    }
    
    this.similarImages = event.detail.similarImages;
    console.log(`MSA5에서 ${this.similarImages.length}개의 유사 이미지를 받았습니다`);
  },

  // 키보드 이벤트 처리
  handleKeyDown(event) {
    if (event.key === 'Escape') {
      this.selectedIndex = -1;
      this.selectedFilename = null;
      this.updatePlotMarkers(-1);
    }
  },

  // MSA1 파일 입력 변경 처리
  handleMSA1FileInputChange(event) {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      console.log(`MSA1 file input change detected: ${file.name}`);
      
      const imageUrl = URL.createObjectURL(file);
      this.processNewImage({
        imageUrl: imageUrl,
        imageName: file.name,
        source: 'msa1-file-input'
      });
    }
  },

  // MSA1 이미지 로드 처리
  handleMSA1ImageLoad(event) {
    const img = event.target;
    if (img.src && img.complete && img.naturalWidth > 0) {
      console.log(`MSA1 image loaded: ${img.src}`);
      const currentTime = Date.now();
      if (currentTime - this.lastImageTimestamp > 1000) {
        this.lastImageTimestamp = currentTime;
        this.processNewImage({
          imageUrl: img.src,
          imageName: this.getImageNameFromUrl(img.src),
          source: 'msa1-image-load'
        });
      }
    }
  },

  // 외부에서 직접 호출하는 이미지 처리 핸들러
  handleDirectImageData(imageData) {
    console.log('Received direct image data:', imageData);
    if (!imageData || (!imageData.imageUrl && !imageData.url)) {
      console.log('Invalid image data received in handleDirectImageData');
      return;
    }
    
    const processData = {
      imageUrl: imageData.imageUrl || imageData.url,
      imageName: imageData.imageName || imageData.name || this.getImageNameFromUrl(imageData.imageUrl || imageData.url),
      source: imageData.source || 'external-direct'
    };
    
    this.processNewImage(processData);
  },

  // MSA3에서 이미지 선택 이벤트 처리
  handleSelectImageByFilename(filename) {
    console.log(`[MSA4] MSA3에서 이미지 선택 요청: ${filename}`);
    
    if (!filename) {
      console.warn('선택할 이미지 파일명이 없습니다');
      return;
    }
    
    const normalizedFilename = this.normalizeImageName(filename);
    
    for (let i = 0; i < this.labels.length; i++) {
      const normalizedLabel = this.normalizeImageName(this.labels[i]);
      if (normalizedLabel === normalizedFilename) {
        console.log(`이미지 찾음: 인덱스 ${i}, 라벨: ${this.labels[i]}`);
        this.selectImageByIndex(i);
        return;
      }
    }
    
    console.warn(`이미지를 찾을 수 없습니다: ${filename}`);
  },

  // 새 이미지 처리
  async processNewImage(imageData) {
    console.log('[MSA4] 새 이미지 처리 시작:', imageData);
    
    if (!imageData || !imageData.imageUrl) {
      console.warn('유효하지 않은 이미지 데이터');
      return;
    }
    
    this.currentImageData = imageData;
    this.isProcessing = true;
    this.loadingMessage = '이미지 처리 중...';
    
    try {
      const response = await fetch('/api/msa4/process-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image_url: imageData.imageUrl,
          image_name: imageData.imageName
        })
      });
      
      const result = await response.json();
      
      if (result.status === 'success') {
        console.log('이미지 처리 성공:', result);
        this.showMessage('이미지 처리가 완료되었습니다', 'success');
        
        if (result.similar_images) {
          this.similarImages = result.similar_images;
        }
        
        this.checkVectorsData();
      } else {
        console.error('이미지 처리 실패:', result);
        this.showMessage('이미지 처리에 실패했습니다', 'error');
      }
    } catch (error) {
      console.error('이미지 처리 중 오류:', error);
      this.showMessage('이미지 처리 중 오류가 발생했습니다', 'error');
    } finally {
      this.isProcessing = false;
      this.loadingMessage = '';
    }
  },

  // ResizeObserver 설정
  setupResizeObserver() {
    if (typeof ResizeObserver !== 'undefined') {
      const container = document.getElementById('plotly-visualization');
      if (container) {
        this.containerObserver = new ResizeObserver(entries => {
          for (let entry of entries) {
            const { width, height } = entry.contentRect;
            if (width !== this.containerWidth || height !== this.containerHeight) {
              this.containerWidth = width;
              this.containerHeight = height;
              
              if (this.plot && window.Plotly) {
                window.Plotly.Plots.resize(container);
              }
            }
          }
        });
        
        this.containerObserver.observe(container);
        console.log('ResizeObserver 설정 완료');
      }
    }
    
    this.resizeHandler = () => {
      const container = document.getElementById('plotly-visualization');
      if (container && this.plot && window.Plotly) {
        setTimeout(() => {
          window.Plotly.Plots.resize(container);
        }, 100);
      }
    };
    
    window.addEventListener('resize', this.resizeHandler);
  },

  // MSA3 연결
  connectToMSA3() {
    console.log('[MSA4] MSA3 연결 시도');
    
    const msa3Component = document.querySelector('.msa3-component') || 
                         document.querySelector('#msa3-component') ||
                         document.querySelector('[data-component="msa3"]');
    
    if (msa3Component) {
      console.log('[MSA4] MSA3 컴포넌트 발견, 연결 설정');
      
      const imageElements = msa3Component.querySelectorAll('img');
      imageElements.forEach(img => {
        img.addEventListener('click', (event) => {
          const filename = this.extractFilenameFromImageSrc(img.src);
          if (filename) {
            console.log(`[MSA4] MSA3 이미지 클릭: ${filename}`);
            this.handleSelectImageByFilename(filename);
          }
        });
      });
    } else {
      console.log('[MSA4] MSA3 컴포넌트를 찾을 수 없음');
    }
  },

  // 이미지 src에서 파일명 추출
  extractFilenameFromImageSrc(src) {
    if (!src) return null;
    
    try {
      const url = new URL(src);
      const pathname = url.pathname;
      const filename = pathname.substring(pathname.lastIndexOf('/') + 1);
      return decodeURIComponent(filename);
    } catch (error) {
      console.warn('이미지 src에서 파일명 추출 실패:', error);
      return null;
    }
  },

  // URL에서 이미지 이름 추출
  getImageNameFromUrl(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.substring(pathname.lastIndexOf('/') + 1);
      return decodeURIComponent(filename);
    } catch (error) {
      return 'unknown_image.jpg';
    }
  },

  // 메시지 표시
  showMessage(text, type = 'info') {
    this.message = {
      show: true,
      text: text,
      type: type,
      icon: type === 'success' ? 'fas fa-check-circle' : 
            type === 'error' ? 'fas fa-exclamation-circle' : 
            'fas fa-info-circle'
    };
    
    setTimeout(() => {
      this.message.show = false;
    }, 3000);
  },

  // 오류 메시지 표시
  displayErrorMessage(message) {
    this.errorMessage = message;
    this.showMessage(message, 'error');
  }
} 