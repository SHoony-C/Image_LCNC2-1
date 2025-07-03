<template>
  <div class="msa-component">
    <div class="card-header">
      <div class="header-left">
        <i class="fas fa-network-wired"></i>
        <span>3D Image Similarity Map

</span>
      </div>
    </div>

    <div class="status-message" v-if="message.show">
      <i :class="message.icon"></i>
      <span>{{ message.text }}</span>
    </div>

    <div class="content-container">
      <div class="plot-container">
        <div id="plotly-visualization"></div>
        <div v-if="!isDataLoaded && !loadingComplete" class="loading-overlay">
          <div class="loading-spinner"></div>
          <div class="loading-message">데이터 로딩 중...</div>
        </div>
      </div>
      
      <div v-if="isProcessing" class="loading-overlay">
        <div class="loading-spinner"></div>
        <div class="loading-message">{{ loadingMessage }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 강제 고정 크기 및 스크롤 스타일 */
.msa-component {
  position: relative !important;
  display: flex !important;
  flex-direction: column !important;
  height: 100% !important;
  width: 100% !important;
  overflow: hidden !important;
  max-height: 100vh !important;
}

.component-header {
  height: 48px !important;
  min-height: 48px !important;
  max-height: 48px !important;
  background-color: #6c5ce7;
  color: white;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  padding: 0 15px !important;
  flex: 0 0 48px !important;
  flex-shrink: 0 !important;
  flex-grow: 0 !important;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  color: white;
}

.header-left i {
  color: white;
}

.header-left span {
  color: white;
  font-weight: 600;
}

.content-container {
  display: flex !important;
  flex-direction: column !important;
  height: calc(100% - 40px) !important;
  width: 100% !important;
  overflow: hidden !important;
  position: relative !important;
  flex: 1 1 auto !important; 
}

.plot-container {
  height: 100% !important;
  width: 100% !important;
  position: relative !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
  flex: 1 !important;
}

#plotly-visualization {
  width: 100% !important;
  height: 100% !important;
  flex: 1 !important;
}

/* 로딩 및 에러 메시지 스타일 */
.loading-overlay {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  background: rgba(255, 255, 255, 0.9) !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  z-index: 10 !important;
}

.loading-spinner {
  border: 3px solid #f3f3f3 !important;
  border-top: 3px solid #3498db !important;
  border-radius: 50% !important;
  width: 30px !important;
  height: 30px !important;
  animation: spin 1s linear infinite !important;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-message {
  color: #dc3545 !important;
  text-align: center !important;
  padding: 10px !important;
  margin-top: 10px !important;
}

.status-message {
  position: fixed !important;
  top: 20px !important;
  right: 20px !important;
  background: rgba(0, 0, 0, 0.8) !important;
  color: white !important;
  padding: 10px 20px !important;
  border-radius: 4px !important;
  z-index: 1000 !important;
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
}

.card-header {
  height: 40px !important;
  min-height: 40px !important;
  max-height: 40px !important;
  background-color: #6c5ce7;
  color: white;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  padding: 8px 12px !important;
  flex: 0 0 40px !important;
  flex-shrink: 0 !important;
  flex-grow: 0 !important;
  border-radius: 8px 8px 0 0;
}
</style>

<script>
import Plotly from 'plotly.js-dist';

// Plotly를 전역 객체로 설정 (window.Plotly 참조용)
window.Plotly = Plotly;

// 디버깅 로거 설정
const DEBUG = true;
function logDebug(...args) {
  if (DEBUG) {
    // console.log('[MSA4]', ...args);
  }
}

export default {
  name: 'MSA4VectorTransform',
  emits: ['update-msa5-image'], // MSA5로 이미지 전달 이벤트 정의
  data() {
    return {
      vectors: [],               // 원본 벡터 데이터
      projectedVectors: [],      // 3D로 투영된 벡터 데이터
      labels: [],                // 이미지 레이블 (파일명)
      imageLabels: [],           // 이미지 레이블의 별도 복사본
      markerColors: [],          // 마커 색상 배열
      markerSizes: [],           // 마커 크기 배열
      similarImages: [],         // 유사 이미지 배열
      selectedImage: null,       // 현재 선택된 이미지 정보 (filename, url, index, coordinates)
      isProcessing: false,       // 처리 중 상태
      isDataLoaded: false,       // 데이터 로드 완료 상태
      loadingComplete: false,    // 로딩 완료 상태
      loadingMessage: '',        // 로딩 메시지
      errorMessage: '',          // 오류 메시지
      plot: null,                // Plotly 플롯 참조
      resizeObserver: null,      // ResizeObserver 인스턴스
      lastSimilarImagesRequestId: null, // 마지막 유사 이미지 요청 ID
      selectedFilename: null,
      selectedImageIndex: -1,
      selectedIndex: -1,
      showCoordinates: true,     // 좌표 표시 여부
      message: {
        show: false,
        text: '',
        icon: 'fas fa-info-circle',
        type: 'info'
      },
      resizeHandler: null,
      containerObserver: null,
      containerWidth: 0,
      containerHeight: 0,
      lastImageData: null, // 마지막 이미지 데이터 저장
      msa1Element: null,
      msa5Element: null,
      componentFindInterval: null,
      apiEndpoints: [
        '/api/process-image',
        '/api/msa4/process-image',
        '/api/vectors/extract'
      ],
      lastImageTimestamp: 0,
      currentImageData: null,
      selectedImageName: null,
      msa1FindAttempts: 0,
      maxFindAttempts: 5,
      msa5MessageActive: false, // MSA5 메시지 전송 표시
      showDebugControls: false, // 디버그 컨트롤 표시
      currentImage: null,
      showStatusMessage: false,
      plotSizeObserver: null,
      isSelectingImageFlag: false, // 이미지 선택 중 플래그 (재귀 방지)
      isLoading: false,
      lastHighlightIndex: -1,    // 마지막으로 하이라이트된 포인트 인덱스
      plotData: [],
      selectedPoint: null,
      plotLayout: {
        scene: {
          xaxis: { title: 'X' },
          yaxis: { title: 'Y' },
          zaxis: { title: 'Z' }
        },
        showlegend: false,
        margin: { l: 0, r: 0, t: 0, b: 0 },
        hovermode: 'closest'
      },
      showImagePopup: false,
      popupImageUrl: '',
      popupImageFilename: '',
      popupWorkflowData: null,
      plotColors: [],
      plotOriginalColors: [],
      plotPointTypes: [],
      plotOriginalIndices: [],
      plotCenter: null, // 중심점 저장
      currentCameraPosition: { // 현재 카메라 위치 저장
        eye: {x: 1.5, y: 1.5, z: 1.5},
        up: {x: 0, y: 0, z: 1}
      }
    }
  },
  computed: {
    plotlyData() {
      if (!this.vectors || this.vectors.length === 0) return [];
      
      return [{
        type: 'scatter3d',
        mode: 'markers',
        x: this.vectors.map(v => v[0]),
        y: this.vectors.map(v => v[1]),
        z: this.vectors.map(v => v[2]),
        marker: {
          size: this.markerSizes,
          color: this.markerColors,
          line: {
            color: 'rgba(0,0,0,0.2)',
            width: 0.5
          }
        },
        hoverinfo: 'none'
      }];
    }
  },
  watch: {
    vectors: {
      handler(newVectors) {
        if (newVectors) {
          this.markerSizes = Array(newVectors.length).fill(6);
          this.markerColors = Array(newVectors.length).fill('#1f77b4');
          // this.initializePlot();
        }
      },
      immediate: true
    }
  },
  mounted() {
    // logDebug('MSA4 Vector Transform Component mounted');
    this.checkVectorsData();
    
    // 전역 이벤트 리스너 설정
    // logDebug('Setting up document-level event listeners');
    window.addEventListener('keydown', this.handleKeyDown);
    
    // MSA1에서 이미지 업데이트 이벤트 리스너 등록
    document.addEventListener('msa1-to-msa4-image', this.handleImageUpdate);
    
    // MSA1에서 유사 이미지 데이터 수신 이벤트 리스너 등록 (새로 추가)
    document.addEventListener('msa1-to-msa2-similar-images', this.handleSimilarImagesFromMSA1);
    
    // 백엔드로부터 최유사 이미지 수신 이벤트 리스너 등록 (새로 추가)
    document.addEventListener('backend-to-msa2-similar-image', this.handleSimilarImageFromBackend);
    
    // MSA5에서 유사 이미지 결과 수신하는 이벤트 리스너 등록
    document.addEventListener('msa5-to-msa4-similar-images', this.handleSimilarImagesFromMSA5);
    
    // 컴포넌트 크기 변경 감지를 위한 ResizeObserver 설정
    this.setupResizeObserver();
    
    // 기본 3D 그래프 시각화 생성
    this.createVisualization();
    
    // MSA 컴포넌트 간 통신 상태 콘솔에 로깅
    // console.log('%c[MSA4] Component ready for inter-component communication', 
    //   'background: #28a745; color: white; padding: 2px 6px; border-radius: 2px');
    
    // logDebug('MSA4 component initialization complete');
    
    // 타이머로 MSA3 연결 시도 (새로 추가)
    setTimeout(() => {
      this.connectToMSA3();
    }, 2000);
    
    // 첫 번째 포인트 자동 선택 제거 (불필요한 API 호출 방지)
  },
  beforeUnmount() {
    // logDebug('MSA4 component unmounting');
    
    // 이벤트 리스너 정리
    window.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('msa1-to-msa4-image', this.handleImageUpdate);
    document.removeEventListener('msa1-to-msa2-similar-images', this.handleSimilarImagesFromMSA1);
    document.removeEventListener('backend-to-msa2-similar-image', this.handleSimilarImageFromBackend);
    document.removeEventListener('msa5-to-msa4-similar-images', this.handleSimilarImagesFromMSA5);
    
    // ResizeObserver 정리
    if (this.containerObserver) {
      this.containerObserver.disconnect();
    }
    
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    
    // logDebug('MSA4 event listeners and observers cleaned up');
  },
  methods: {
    // MSA1 요소 찾기 및 모니터링
    findAndMonitorMSA1() {
      // 다양한 선택자 시도
      const selectors = [
        '#msa1-component',
        '.msa1-component',
        '[data-component="msa1"]',
        '.msa1',
        // DOM 계층 구조 기반 선택자
        '.top-row .msa1',
        '.main-container .msa1',
        // 상위 컴포넌트에서 찾기
        '.upper-section .msa1',
        // 문서 전체에서 찾기
        'div[id*="msa1"]',
        'div[class*="msa1"]'
      ];

      // 각 선택자 시도
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          // logDebug(`MSA1 element found with selector: ${selector}`);
          this.msa1Element = element;
          this.setupMSA1Listeners(element);
          return;
        }
      }

      // MSA5 요소도 찾기
      const msa5Selectors = [
        '#msa5-component',
        '.msa5-component',
        '[data-component="msa5"]',
        '.msa5',
        '.bottom-row .msa5',
        'div[id*="msa5"]',
        'div[class*="msa5"]'
      ];

      for (const selector of msa5Selectors) {
        const element = document.querySelector(selector);
        if (element) {
          // logDebug(`MSA5 element found with selector: ${selector}`);
          this.msa5Element = element;
        }
      }

      // 요소를 찾지 못한 경우 재시도
      if (!this.msa1Element && this.msa1FindAttempts < this.maxFindAttempts) {
        this.msa1FindAttempts++;
        // logDebug(`MSA1 element not found, retrying (${this.msa1FindAttempts}/${this.maxFindAttempts})`);
        setTimeout(() => this.findAndMonitorMSA1(), 1000);
      } else if (!this.msa1Element) {
        // logDebug('Failed to find MSA1 element after maximum attempts');
      }
    },

    // MSA1 리스너 설정
    setupMSA1Listeners(element) {
      // 파일 입력 요소 찾기
      const fileInputs = element.querySelectorAll('input[type="file"]');
      if (fileInputs.length > 0) {
        fileInputs.forEach(input => {
          input.addEventListener('change', this.handleMSA1FileInputChange);
          // logDebug('Added file input change listener to MSA1');
        });
      }
      
      // 이미지 요소 찾기
      const images = element.querySelectorAll('img');
      if (images.length > 0) {
        images.forEach(img => {
          img.addEventListener('load', this.handleMSA1ImageLoad);
          // logDebug('Added image load listener to MSA1');
        });
      }
    },

    // MSA1 파일 입력 변경 처리
    handleMSA1FileInputChange(event) {
      const files = event.target.files;
      if (files && files.length > 0) {
        const file = files[0];
        // logDebug(`MSA1 file input change detected: ${file.name}`);
        
        // 파일을 이미지 URL로 변환
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
        // logDebug(`MSA1 image loaded: ${img.src}`);
        // 이미지가 변경되었는지 확인 (타임스탬프 또는 URL 비교)
        const currentTime = Date.now();
        if (currentTime - this.lastImageTimestamp > 1000) { // 1초 이내 중복 방지
          this.lastImageTimestamp = currentTime;
          this.processNewImage({
            imageUrl: img.src,
            imageName: this.getImageNameFromUrl(img.src),
            source: 'msa1-image-load'
          });
        }
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
    
    // 전역 객체를 통한 이미지 데이터 폴링 (기존 유지)
    // setupImagePolling() {}
    
    // 외부에서 직접 호출하는 이미지 처리 핸들러
    handleDirectImageData(imageData) {
      // logDebug('Received direct image data:', imageData);
      if (!imageData || (!imageData.imageUrl && !imageData.url)) {
        // logDebug('Invalid image data received in handleDirectImageData');
        return;
      }
      
      // 다양한 포맷 지원
      const processData = {
        imageUrl: imageData.imageUrl || imageData.url,
        imageName: imageData.imageName || imageData.name || this.getImageNameFromUrl(imageData.imageUrl || imageData.url),
        source: imageData.source || 'external-direct'
      };
      
      // 이미지 처리 호출
      this.processNewImage(processData);
    },
    
    // 기존 메서드들...
    async checkVectorsData() {
      // logDebug('Checking vector data availability');
      
      // Reset all data states before loading
      this.vectors = [];
      this.projectedVectors = [];
      this.labels = [];
      this.imageLabels = [];
      this.markerColors = [];
      this.markerSizes = [];
      this.similarImages = [];
      this.selectedImage = null;
      this.selectedFilename = null;
      this.selectedImageIndex = -1;
      this.selectedIndex = -1;
      
      if (this.vectors && this.vectors.length > 0) {
        // logDebug(`Vector data already loaded, ${this.vectors.length} vectors available`);
        return;
      }
      
      this.loadingMessage = '벡터 데이터 로딩 중...';
      this.isLoading = true;
      
      try {
        // logDebug('직접 파일 접근으로 벡터 로드 시도...');
        
        // Add cache-busting parameter to prevent browser caching
        const timestamp = new Date().getTime();
        // 처리된 벡터 파일 직접 접근
        const processedVectorsResponse = await fetch(`http://localhost:8000/storage/vector/processed_vectors.json?t=${timestamp}`, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
        const processedMetadataResponse = await fetch(`http://localhost:8000/storage/vector/processed_metadata.json?t=${timestamp}`, {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
        
        if (processedVectorsResponse.ok && processedMetadataResponse.ok) {
          const vectors = await processedVectorsResponse.json();
          const metadata = await processedMetadataResponse.json();
          
          if (vectors && vectors.length > 0 && metadata && metadata.length > 0) {
            // logDebug(`직접 파일에서 로드: ${vectors.length} 벡터, ${metadata.length} 메타데이터`);
            
            // Create new copies of arrays to prevent reference issues
            const vectorsCopy = JSON.parse(JSON.stringify(vectors));
            const metadataCopy = JSON.parse(JSON.stringify(metadata));
            
            this.processVectorData(vectorsCopy, metadataCopy);
            this.isDataLoaded = true;
            this.loadingComplete = true;
            this.loadingMessage = '';
            this.showMessage('이미지의 고차원 특징 기반 유사도 매핑 완료', 'info');
            return;
          }
        }
        
        throw new Error('직접 파일 접근 실패');
      } catch (fileError) {
        // logDebug(`직접 파일 접근 오류: ${fileError.message}`);
        this.loadingComplete = true;
        this.isLoading = false;
        this.showMessage('벡터 데이터를 로드할 수 없습니다', 'error');
      }
    },
    
    

    async extractVectors() {
      this.isProcessing = true;
      this.loadingMessage = '이미지 벡터 추출 중...';
      
      try {
        const response = await fetch('/api/msa4/extract-vectors', {
          method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
          this.showMessage(`${data.count}개 이미지 벡터 추출 완료`, 'success');
          await this.checkVectorsData();
        } else {
          this.showMessage(data.message || '벡터 추출 실패', 'warning');
        }
      } catch (error) {
        console.error('Error extracting vectors:', error);
        this.showMessage('벡터 추출 중 오류가 발생했습니다', 'error');
      }
    },
    
    showMessage(text, type = 'info') {
      this.message = {
        show: true,
        text: text,
        type: type,
        icon: type === 'success' ? 'fas fa-check-circle' : 
             type === 'warning' ? 'fas fa-exclamation-triangle' : 
             type === 'error' ? 'fas fa-times-circle' : 'fas fa-info-circle'
      };
      
      // 3초 후 메시지 자동 숨김
      setTimeout(() => {
        this.message.show = false;
      }, 3000);
    },
        
    projectVectorsWith3DPCA(vectors) {
      // logDebug('Projecting vectors to 3D space...');
      if (!vectors || vectors.length === 0) {
        console.error('No vectors to project');
        return [];
      }
      
      try {
        // 벡터 차원 확인
        const vectorDim = vectors[0].length;
        if (vectorDim < 3) {
          throw new Error(`Vector dimension (${vectorDim}) is too small for 3D projection`);
        }

        // 벡터를 3개의 그룹으로 나누어 평균 계산
        const projectedVectors = vectors.map(vec => {
          const groupSize = Math.floor(vec.length / 3);
          const groups = [
            vec.slice(0, groupSize),
            vec.slice(groupSize, 2 * groupSize),
            vec.slice(2 * groupSize)
          ];
          
          return groups.map(group => 
            group.reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0) / group.length
          );
        });

        // 정규화
        const dimensions = [0, 1, 2].map(dim => ({
          min: Math.min(...projectedVectors.map(v => v[dim])),
          max: Math.max(...projectedVectors.map(v => v[dim]))
        }));

        return projectedVectors.map(vec => 
          vec.map((val, i) => {
            const min = dimensions[i].min;
            const max = dimensions[i].max;
            return max > min ? (val - min) / (max - min) : 0.5;
          })
        );

      } catch (error) {
        console.error('Error in vector projection:', error);
        return vectors.map(() => [0.5, 0.5, 0.5]); // 에러 시 기본값 반환
      }
    },
    
    calculate3DDistance(point1, point2) {
      if (!point1 || !point2) return 1; // 기본값으로 충분히 큰 거리 반환
      
      // 유클리드 거리 계산
      const dx = point1[0] - point2[0];
      const dy = point1[1] - point2[1];
      const dz = point1[2] - point2[2];
      
      return Math.sqrt(dx*dx + dy*dy + dz*dz);
    },
    

    // 에러 메시지 표시 함수 추가
    displayErrorMessage(message) {
      console.error('[MSA4 Error]', message);
      this.errorMessage = message;
      this.showMessage(message, 'error');
      
      // 3초 후 에러 메시지 숨기기
      setTimeout(() => {
        this.errorMessage = '';
      }, 3000);
    },

    // ResizeObserver 설정 함수 개선
    setupResizeObserver() {
      // logDebug('Setting up ResizeObserver');
      
      // 기존 ResizeObserver 정리
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
      }
      
      // 컨테이너 요소 찾기
      const container = this.$el.querySelector('.content-container');
      if (!container) {
        // logDebug('Content container not found');
        return;
      }
      
      // 디바운스 설정 - 너무 빠른 리사이즈 이벤트 방지
      let resizeTimeout = null;
      let lastResizeTime = 0;
      const RESIZE_DELAY = 300; // 최소 300ms 간격으로 리사이즈 실행
      
      // 새로운 ResizeObserver 생성
      this.resizeObserver = new ResizeObserver(entries => {
        // 디바운스 처리 - 이전 타이머 취소
        if (resizeTimeout) {
          clearTimeout(resizeTimeout);
        }
        
        // 충분한 시간이 지났는지 확인
        const now = Date.now();
        if (now - lastResizeTime < RESIZE_DELAY) {
          // 너무 빠른 연속 호출 방지를 위해 지연 처리
          resizeTimeout = setTimeout(() => {
            this.handleResize(entries);
            lastResizeTime = Date.now();
          }, RESIZE_DELAY);
          return;
        }
        
        // 시간이 충분히 지났으면 즉시 실행
        this.handleResize(entries);
        lastResizeTime = now;
      });
      
      // 컨테이너 관찰 시작
      this.resizeObserver.observe(container);
      // logDebug('ResizeObserver setup complete');
    },
    
    // 리사이즈 처리 로직을 별도 함수로 분리
    handleResize(entries) {
      try {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          // logDebug(`Container size changed: ${width}x${height}`);
          
          // Plotly 플롯이 존재하고 DOM에 표시되어 있는 경우에만 리사이즈
          const plotDiv = document.getElementById('plotly-visualization');
          if (plotDiv && plotDiv.innerHTML !== '' && plotDiv.clientWidth > 0) {
            // requestAnimationFrame으로 레이아웃 계산 최적화
            requestAnimationFrame(() => {
            try {
              window.Plotly.relayout(plotDiv, {
                width: plotDiv.clientWidth,
                height: plotDiv.clientHeight
              });
              // logDebug('Plot resized successfully');
            } catch (error) {
              console.error('Error resizing plot:', error);
            }
            });
          } else {
            // logDebug('Plot not ready for resize');
          }
        }
      } catch (err) {
        console.error('Error in handleResize:', err);
      }
    },

    // 3D 시각화 생성 함수 추가
    createVisualization() {
      // logDebug('Creating 3D visualization');
      
      // 시각화 컨테이너 요소 선택
      const container = document.getElementById('plotly-visualization');
      if (!container) {
        // logDebug('Visualization container not found');
        return;
      }
      
      // 컨테이너 크기 확인
      if (container.clientWidth === 0 || container.clientHeight === 0) {
        // logDebug('Container has zero dimensions, delaying visualization creation');
        // 컨테이너 크기가 설정될 때까지 지연
        setTimeout(() => this.createVisualization(), 100);
        return;
      }
      
      // 초기 데이터 (실제 데이터가 로드되기 전에 표시할 빈 그래프)
      const emptyData = [{
        type: 'scatter3d',
        mode: 'markers',
        x: [],
        y: [],
        z: [],
        text: [],
        marker: {
          size: 5,
          color: '#cccccc',
          opacity: 0.7
        }
      }];
      
      // 그래프 레이아웃 설정
      const layout = {
        margin: { l: 0, r: 0, b: 0, t: 0 },
        scene: {
          xaxis: { title: '' },
          yaxis: { title: '' },
          zaxis: { title: '' },
          aspectratio: { x: 1, y: 1, z: 1 },
          // 카메라 설정 - 저장된 값 사용
          camera: {
            eye: this.currentCameraPosition ? this.currentCameraPosition.eye : {x: 1.5, y: 1.5, z: 1.5},
            center: {x: 0.5, y: 0.5, z: 0.5},
            up: this.currentCameraPosition ? this.currentCameraPosition.up : {x: 0, y: 0, z: 1}
          }
        },
        showlegend: false,
        hovermode: 'closest',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        autosize: true,
        width: container.clientWidth,
        height: container.clientHeight
      };
      
      
      // 그래프 초기화
      try {
        // 이미 생성된 플롯이 있으면 제거
        if (container.innerHTML !== '') {
          window.Plotly.purge(container);
        }
        
      } catch (error) {
        console.error('Error creating Plotly visualization:', error);
      }
    },
    
    // 3D 그래프 점 클릭 이벤트 처리기
    handlePointClick(data) {
      try {
        // 클릭한 점의 데이터 포인트 정보 가져오기
        const point = data.points[0];
        if (!point) {
          // logDebug('No point data in click event');
          return;
        }
        
        // 클릭한 점의 인덱스 가져오기
        const pointIndex = point.pointIndex;
        const pointNumber = point.pointNumber;
        const curveNumber = point.curveNumber;
        
        // 직접 이미지 선택 처리 (window 전역 객체에도 저장)
        this.selectImageByIndex(pointIndex);
        
        // 마커 스타일 업데이트
        this.updatePlotMarkers(pointIndex);
      } catch (error) {
        console.error('Error handling point click:', error);
      }
    },
    
    // 거리 기반으로 유사 이미지 찾기
    findSimilarImagesByDistance(selectedIndex) {
      // logDebug(`Finding similar images for index ${selectedIndex} using distance-based method`);
      
      return new Promise((resolve, reject) => {
        try {
          if (!this.projectedVectors || !this.projectedVectors[selectedIndex]) {
            // logDebug('No projected vectors available');
            resolve([]);
            return;
          }
          
          // 선택된 이미지의 벡터
          const selectedVector = this.projectedVectors[selectedIndex];
          const selectedIsIApp = this.labels[selectedIndex] && this.labels[selectedIndex].includes('_before');
          
          // 모든 이미지와의 거리 계산 및 태그별 분류
          const iAppDistances = [];
          const analysisDistances = [];
          
          for (let idx = 0; idx < this.projectedVectors.length; idx++) {
            // 같은 점이면 건너뛰기
            if (idx === selectedIndex) continue;
            
            const vector = this.projectedVectors[idx];
            if (!vector) continue;
            
            const isIApp = this.labels[idx] && this.labels[idx].includes('_before');
            const distance = this.calculate3DDistance(selectedVector, vector);
            
            // 태그별로 분류
            if (isIApp) {
              iAppDistances.push({
                index: idx,
                filename: this.labels[idx],
                distance: distance,
                tag_type: 'I-TAP'
              });
            } else {
              analysisDistances.push({
                index: idx,
                filename: this.labels[idx],
                distance: distance,
                tag_type: 'Analysis'
              });
            }
          }
          
          // 거리 기준으로 정렬 (가까운 순)
          iAppDistances.sort((a, b) => a.distance - b.distance);
          analysisDistances.sort((a, b) => a.distance - b.distance);
          
          // logDebug(`I-app 태그 이미지: ${iAppDistances.length}개, Analysis 태그 이미지: ${analysisDistances.length}개`);
          
          // 각 태그별로 정확히 3개씩 선택
          const topIAppImages = iAppDistances.slice(0, 3);
          const topAnalysisImages = analysisDistances.slice(0, 3);
          
          // 이미지 변환 함수
          const transformToSimilarImage = (item) => {
            // 거리를 유사도로 변환 (1 - 정규화된 거리)
            const maxDistance = 1.732; // 3D 공간에서 최대 거리 (대략적 값)
            const normalizedDistance = Math.min(item.distance / maxDistance, 1);
            const similarity = Math.round((1 - normalizedDistance) * 100);
            
            return {
              filename: item.filename,
              similarity: similarity,
              url: this.getImageUrl(item.filename),
              tag_type: item.tag_type
            };
          };
          
          // 변환 및 결합
          const iappImages = topIAppImages.map(transformToSimilarImage);
          const analysisImages = topAnalysisImages.map(transformToSimilarImage);
          const similarImages = [...iappImages, ...analysisImages];
          
          // 유사 이미지 개수 로그
          // logDebug(`태그별 유사 이미지 처리 완료 - I-app: ${iappImages.length}개, Analysis: ${analysisImages.length}개, 총: ${similarImages.length}개`);
          
          // 현재 객체에도 저장
          this.similarImages = similarImages;
          
          resolve(similarImages);
        } catch (error) {
          console.error('Error finding similar images by distance:', error);
          resolve([]); // 오류 발생 시 빈 배열 반환
        }
      });
    },
    
    // API 엔드포인트 설정 함수 수정
    getApiEndpoint(path) {
      // API는 8000 포트 사용
      const baseUrl = 'http://localhost:8000';
      return `${baseUrl}${path}`;
    },

    // 이미지 URL 생성 함수 수정
    getImageUrl(filename) {
      if (!filename) return '';
      
      // 유효하지 않은 이미지 파일명 필터링
      if (filename === 'main' || filename.includes('localhost') || 
          filename.includes('undefined') || filename.includes('null')) {
        console.warn(`MSA2: 유효하지 않은 이미지 파일명: ${filename}, 기본 이미지 URL 반환`);
        return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2NjY2NjYyIgc3Ryb2tlLXdpZHRoPSIyIj48cGF0aCBkPSJNMTAgMTQgMTIgMTEuNSAxNCAxNCIvPjxwYXRoIGQ9Ik0yMCAxM3YtNGExIDEgMCAwIDAtMS0xSDVhMSAxIDAgMCAwLTEgMXY0Ii8+PHBhdGggZD0iTTEgMTd2NGExIDEgMCAwIDAgMSAxaDIwYTEgMSAwIDAgMCAxLTF2LTRhMSAxIDAgMCAwLTEtMUgyYTEgMSAwIDAgMC0xIDF6Ii8+PC9zdmc+';
      }
      
      // 파일명 정규화 - 특수문자 및 공백 처리
      let imageFilename = encodeURIComponent(filename);
      
      // 디버깅용 로그
      // logDebug(`Getting image URL for: ${filename} (encoded: ${imageFilename})`);
      
      // 이미 완전한 URL인 경우 그대로 반환
      if (filename.startsWith('http://') || filename.startsWith('https://')) {
        return filename;
      }
      
      // API 서버를 통해 이미지 요청
      return `http://localhost:8000/api/imageanalysis/images/${imageFilename}`;
    },

    // 벡터 데이터 처리 함수
    processVectorData(vectors, labels) {
      // logDebug(`Processing vector data: ${vectors.length} vectors, ${labels?.length || 0} labels`);
      
      // 유효성 검사
      if (!vectors || vectors.length === 0) {
        this.displayErrorMessage('유효한 벡터 데이터가 없습니다.');
        return;
      }
      
      // 벡터와 레이블 저장 (원본 이미지 파일명 보존)
      this.vectors = [...vectors]; // Create a new copy
      
      // 라벨 확인 - 콘솔에 출력해서 실제 이미지 파일명 확인
      // console.log('Original labels received:', labels);
      
      if (labels && Array.isArray(labels) && labels.length > 0) {
        this.labels = [...labels]; // Create a new copy
        // logDebug(`Using ${labels.length} original image labels`);
      } else {
        // 라벨이 없는 경우에만 생성
        this.labels = Array(vectors.length).fill().map((_, i) => `fallback_${i+1}`);
        // logDebug('No labels provided, using fallback labels');
      }
      
      this.imageLabels = [...this.labels]; // Create a new copy
      
      try {
        // 3D PCA를 사용하여 벡터 투영
        this.projectedVectors = this.projectVectorsWith3DPCA([...vectors]); // Create a new copy
        
        if (!this.projectedVectors || this.projectedVectors.length === 0) {
          // logDebug('Failed to project vectors, cannot visualize');
          this.displayErrorMessage('벡터 데이터를 시각화할 수 없습니다.');
          return;
        }
        
        // Plotly 데이터 준비 (여기서 createPlot 호출)
        // console.log("벡터 데이터 처리 완료, 그래프 생성 시작...");
        this.createPlot();
        // console.log("그래프 생성 완료");
        
        // 데이터 로드 상태 업데이트
        this.isDataLoaded = true;
        this.loadingComplete = true;
        this.loadingMessage = '';
      } catch (error) {
        console.error('Error processing vector data:', error);
        this.displayErrorMessage('벡터 데이터 처리 중 오류가 발생했습니다');
        this.loadingComplete = true;
        this.loadingMessage = '';
      }
    },
    
    // 인덱스로 이미지 선택하는 함수 (Plotly 이벤트용)
    selectImageByIndex(index) {
      // console.log(`======= 이미지 선택 시작 (인덱스: ${index}) =======`);
      
      // 인덱스 유효성 검사
      if (index === undefined || index === null || isNaN(index)) {
        console.error(`유효하지 않은 인덱스 타입: ${typeof index}, 값: ${index}`);
        return;
      }
      
      if (index < 0 || index >= this.labels.length) {
        console.error(`인덱스 범위 오류: ${index}, 유효 범위: 0-${this.labels.length - 1}`);
        return;
      }
      
      // 파일명 유효성 검사
      const filename = this.labels[index];
      if (!filename || filename === 'main' || filename.includes('localhost') ||
          filename.includes('undefined') || filename.includes('null')) {
        console.error(`유효하지 않은 파일명: ${filename}, 선택 무시`);
        return;
      }
      
      // 동일한 이미지 재선택 방지
      if (this.selectedIndex === index) {
        // console.log(`이미 선택된 이미지입니다 (인덱스: ${index}, 파일명: ${this.labels[index]})`);
        return;
      }
      
      try {
        // 이전 선택 인덱스 저장
        const prevSelectedIndex = this.selectedIndex;
        
        // 선택된 인덱스와 파일명 업데이트
        this.selectedIndex = index;
        this.selectedFilename = this.labels[index];
        
        // console.log(`선택된 이미지 정보 업데이트 완료:`);
        // console.log(`- 인덱스: ${this.selectedIndex}`);
        // console.log(`- 파일명: ${this.selectedFilename}`);
        // console.log(`- 좌표: ${JSON.stringify(this.projectedVectors[index])}`);
        
        // 선택한 이미지 정보 구성
        const selectedImage = {
          url: this.getImageUrl(this.labels[index]),
          filename: this.labels[index],
          index: index
        };
        
        // 3D 그래프에서 선택된 점 강조 표시
        try {
          // console.log('3D 그래프에서 선택된 점 강조 표시 시작...');
          const plotContainer = document.getElementById('plotly-visualization');
          if (plotContainer) {
            // 새로운 하이라이트 메서드 호출
            this.highlightPointByColor(index);
            // console.log('3D 그래프 점 강조 표시 요청 완료');
          } else {
            console.error('plotly-visualization 요소를 찾을 수 없습니다');
            
            // 요소를 찾을 수 없는 경우 지연 후 재시도
            setTimeout(() => {
              const retryContainer = document.getElementById('plotly-visualization');
              if (retryContainer) {
                this.highlightPointByColor(index);
                // console.log('3D 그래프 점 강조 표시 지연 재시도 완료');
              } else {
                console.error('plotly-visualization 요소를 재시도에서도 찾을 수 없습니다');
              }
            }, 500);
          }
        } catch (plotError) {
          console.error('3D 그래프 점 강조 표시 중 오류:', plotError);
        }
        
        // 전역 객체에 직접 저장
        if (window.MSASharedData) {
          window.MSASharedData.currentImage = selectedImage;
          // console.log('MSA2: 전역 데이터에 이미지 정보 저장 완료');
        } else {
          console.warn('MSA2: 전역 MSASharedData 객체가 없습니다');
          // 전역 객체가 없으면 생성
          window.MSASharedData = {
            currentImage: selectedImage,
            similarImages: []
          };
          // console.log('MSA2: 전역 MSASharedData 객체 생성 완료');
        }
        
        // 유사 이미지 찾기
        this.findSimilarImagesByDistance(index)
          .then(similarImages => {
            // 전역 객체에 유사 이미지 저장
            if (window.MSASharedData) {
              window.MSASharedData.similarImages = similarImages;
              // console.log(`MSA2: 유사 이미지 정보를 MSA3로 전송합니다: ${similarImages.length} 개`);
            }
            
            // 이벤트 발생 및 데이터 전송
            this.sendImageDataToMSA3(selectedImage);
          })
          .catch(error => {
            console.error('유사 이미지 찾기 오류:', error);
            
            // 오류가 있어도 선택된 이미지 정보는 전송
            this.sendImageDataToMSA3(selectedImage);
          });
        
        // console.log(`======= 이미지 선택 완료 (인덱스: ${index}) =======`);
      } catch (error) {
        console.error('MSA2: 이미지 선택 처리 중 오류 발생:', error);
      }
    },
    
    
    
    // 플롯 마커 업데이트 함수 (선택된 점 강조)
    updatePlotMarkers(selectedIndex) {
      try {
        // 컨테이너 유효성 검사
        const container = document.getElementById('plotly-visualization');
        if (!container) {
          console.error('시각화 컨테이너를 찾을 수 없습니다');
          return;
        }
        
        // 선택된 인덱스가 유효한지 확인
        if (selectedIndex === undefined || selectedIndex < 0 || selectedIndex >= this.labels.length) {
          console.error(`유효하지 않은 선택 인덱스: ${selectedIndex}, 범위: 0-${this.labels.length - 1}`);
          return;
        }
        
        // 기존 Plotly 그래프가 있는지 확인
        if (!window.Plotly) {
          console.error('Plotly 객체를 찾을 수 없습니다');
          return;
        }
        
        try {
          // 그래프가 비어있거나 데이터가 없는 경우 새로 그래프 생성
          if (!container.data || container.data.length === 0) {
            // console.log('플롯이 비어있어 새로 생성합니다');
            this.createPlot();
          return;
        }
        
        // 이전에 선택된 점이 있다면 그 정보 저장
          const prevSelectedIndex = this.selectedIndex !== selectedIndex ? this.selectedIndex : -1;
          
          // console.log(`마커 스타일 업데이트 시작: 인덱스 ${selectedIndex}, 이전 인덱스 ${prevSelectedIndex}`);
          
          // 기존 트레이스 확인
          const existingTraces = container.data || [];
          
          // 기본 데이터 트레이스 수 확인 (I-app, Analysis 태그 그룹 등)
          let baseTraceCount = 0;
          for (const trace of existingTraces) {
            if (trace.name === 'I-TAP' || trace.name === 'Analysis' || trace.name === '모든 포인트' || trace.name === 'All Points') {
              baseTraceCount++;
            }
          }
          
          // 하이라이트 트레이스 삭제
          if (existingTraces.length > baseTraceCount) {
            // console.log(`기존 하이라이트 트레이스 제거: ${existingTraces.length - baseTraceCount}개`);
            
            // 삭제할 트레이스 인덱스 계산
            const tracesToDelete = [];
            for (let i = baseTraceCount; i < existingTraces.length; i++) {
              tracesToDelete.push(i);
            }
            
            // 지연 함수 - Promise 반환
            const deleteTracesAsync = () => {
              return new Promise((resolve, reject) => {
                try {
                  if (tracesToDelete.length > 0) {
                    Plotly.deleteTraces(container, tracesToDelete)
                      .then(resolve)
                      .catch(e => {
                        console.error('트레이스 삭제 오류:', e);
                        // 오류가 있어도 계속 진행
                        resolve();
                      });
                  } else {
                    resolve();
                  }
      } catch (error) {
                  console.error('트레이스 삭제 처리 오류:', error);
                  // 오류가 있어도 계속 진행
                  resolve();
                }
              });
            };
            
            // 삭제 후 새 트레이스 추가
            deleteTracesAsync()
        .then(() => {
                // console.log('기존 트레이스 삭제 완료, 새 트레이스 추가 중...');
                setTimeout(() => {
                  this.addSelectedPointTraces(container, selectedIndex, prevSelectedIndex);
                }, 100);
        })
        .catch(error => {
                console.error('트레이스 삭제 후처리 오류:', error);
                // 오류가 있어도 새 트레이스 추가 시도
                setTimeout(() => {
                  this.addSelectedPointTraces(container, selectedIndex, prevSelectedIndex);
                }, 100);
              });
        } else {
            // 삭제할 트레이스가 없으면 바로 새 트레이스 추가
            // console.log('기존 트레이스 없음, 새 트레이스 직접 추가');
            this.addSelectedPointTraces(container, selectedIndex, prevSelectedIndex);
          }
      } catch (error) {
          console.error('마커 업데이트 처리 오류:', error);
          
          // 오류 복구 시도 - 그래프 재생성
          try {
            // console.log('오류 복구: 그래프 재생성 시도');
            this.createPlot();
            
            // 그래프 생성 후 점 선택 재시도
            setTimeout(() => {
              const retryContainer = document.getElementById('plotly-visualization');
              if (retryContainer && retryContainer.data) {
                this.addSelectedPointTraces(retryContainer, selectedIndex, -1);
              }
            }, 500);
          } catch (recoveryError) {
            console.error('그래프 복구 시도 실패:', recoveryError);
          }
        }
      } catch (outerError) {
        console.error('전체 마커 업데이트 프로세스 오류:', outerError);
      }
    },
    
    // 선택된 점 트레이스 추가 - updatePlotMarkers에서 분리하여 모듈화
    addSelectedPointTraces(container, selectedIndex, prevSelectedIndex) {
      try {
        // 컨테이너 및 데이터 유효성 검사
        if (!container) {
          console.error('시각화 컨테이너가 유효하지 않습니다');
          return;
        }
        
        // Plotly 객체가 올바르게 초기화되었는지 확인
        if (typeof Plotly === 'undefined' || !Plotly.addTraces) {
          console.error('Plotly 라이브러리가 초기화되지 않았습니다');
        return;
      }
      
        // 선택된 점이 존재하는지 확인
        if (!this.projectedVectors || !this.projectedVectors[selectedIndex] || 
            !Array.isArray(this.projectedVectors[selectedIndex]) || 
            this.projectedVectors[selectedIndex].length !== 3) {
          console.error('선택된 점의 좌표 데이터가 없거나 유효하지 않습니다');
        return;
      }
      
        // 안전하게 좌표 값 추출
        const coords = this.projectedVectors[selectedIndex];
        const x = coords[0] || 0;
        const y = coords[1] || 0;
        const z = coords[2] || 0;
        
        // 선택된 점의 태그 확인
        const isIApp = this.labels[selectedIndex] && this.labels[selectedIndex].includes('_before');
        const selectedTag = isIApp ? 'I-TAP' : 'Analysis';
        
        // 선택된 점 강조 트레이스
        const selectedPointTrace = {
        type: 'scatter3d',
        mode: 'markers',
          x: [x],
          y: [y],
          z: [z],
          text: [`${this.labels[selectedIndex] || '알 수 없음'} (선택됨)`],
        hoverinfo: 'text',
        marker: {
            size: 12,
            color: 'rgba(255, 0, 0, 1)', // 빨간색으로 선택된 점 강조
            symbol: 'circle',
            opacity: 1,
          line: {
              color: 'white',
              width: 2
            }
          },
          name: '선택된 이미지',
          showlegend: true
        };
        
        // 추가할 트레이스 배열
        const traces = [selectedPointTrace];
        
        // 유사한 점들에 대한 트레이스 추가 (오류 처리 추가)
        try {
          // 유사 포인트 찾기
          const similarPoints = this.findSimilarPoints(selectedIndex, 5);
          
          // 유사한 점들에 대한 트레이스
          if (similarPoints && similarPoints.length > 0) {
            // 유사 포인트의 좌표가 모두 유효한지 확인
            const validSimilarPoints = similarPoints.filter(p => 
              this.projectedVectors[p.index] && 
              Array.isArray(this.projectedVectors[p.index]) && 
              this.projectedVectors[p.index].length === 3
            );
            
            if (validSimilarPoints.length > 0) {
      const similarPointsTrace = {
        type: 'scatter3d',
        mode: 'markers',
                x: validSimilarPoints.map(p => this.projectedVectors[p.index][0]),
                y: validSimilarPoints.map(p => this.projectedVectors[p.index][1]),
                z: validSimilarPoints.map(p => this.projectedVectors[p.index][2]),
                text: validSimilarPoints.map(p => `${this.labels[p.index] || '알 수 없음'} (유사도: ${Math.round((1 - p.distance) * 100)}%)`),
        hoverinfo: 'text',
        marker: {
                  size: 8,
                  color: 'rgba(255, 165, 0, 1)', // 주황색
                  opacity: 1,
          line: {
            color: 'white',
            width: 1
          }
        },
                name: '유사 이미지',
        showlegend: true
      };
      
      traces.push(similarPointsTrace);
      
      // 선택된 점과 유사한 점들 사이의 연결선
              for (const point of validSimilarPoints) {
        const lineTrace = {
          type: 'scatter3d',
          mode: 'lines',
                  x: [x, this.projectedVectors[point.index][0]],
                  y: [y, this.projectedVectors[point.index][1]],
                  z: [z, this.projectedVectors[point.index][2]],
          line: {
                    color: 'rgba(255, 165, 0, 0.8)', // 주황색 라인
            width: 3
          },
          opacity: 0.8,
          hoverinfo: 'none',
          showlegend: false
        };
        
        traces.push(lineTrace);
              }
            }
          }
        } catch (similarError) {
          console.error('유사한 점들 표시 오류:', similarError);
          // 오류가 있어도 계속 진행 (선택된 점만 표시)
        }
        
        // 모든 트레이스 추가
        try {
          // 트레이스 추가 시도
          Plotly.addTraces(container, traces)
            .then(() => {
              // console.log(`선택된 점 ${selectedIndex}와 유사한 점들 트레이스 추가 완료 (총 ${traces.length}개)`);
            })
            .catch(err => {
              console.error('트레이스 추가 오류:', err);
              
              // 오류 발생 시 단순 선택 트레이스만 추가 시도
              if (traces.length > 1) {
                // console.log('단순 선택 트레이스만 추가 시도...');
                Plotly.addTraces(container, [selectedPointTrace])
                  .catch(e => console.error('단순 선택 트레이스 추가도 실패:', e));
              }
            });
        } catch (addError) {
          console.error('트레이스 추가 시도 오류:', addError);
        }
      } catch (error) {
        console.error('선택된 점 트레이스 추가 오류:', error);
      }
    },
    
    // 유사 포인트 찾기 - 단순화된 함수
    findSimilarPoints(selectedIndex, count = 5) {
      if (!this.projectedVectors || !this.projectedVectors[selectedIndex]) {
        return [];
      }
      
      // 선택된 이미지의 벡터
      const selectedVector = this.projectedVectors[selectedIndex];
      
      // 모든 이미지와의 거리 계산
      const distances = this.projectedVectors.map((vector, idx) => {
        return {
          index: idx,
          distance: this.calculate3DDistance(selectedVector, vector),
          isSelf: idx === selectedIndex
        };
      });
      
      // 거리 기준으로 정렬 (가까운 순)
      distances.sort((a, b) => a.distance - b.distance);
      
      // 가장 가까운 이미지 선택 (자신 제외)
      return distances
        .filter(item => !item.isSelf)
        .slice(0, count);
    },

    // MSA3와 직접 연결 시도 (새로 추가)
    connectToMSA3() {
      // console.log('MSA2: MSA3와 직접 연결 시도...');
      
      // MSA3 컴포넌트 찾기
      const msa3El = document.querySelector('.msa3-container');
      if (msa3El) {
        // console.log('MSA2: MSA3 컴포넌트를 DOM에서 찾았습니다');
        
        // 이미 선택된 이미지가 있는지 확인
        if (this.selectedIndex >= 0 && this.selectedFilename) {
          console.log(`MSA2: MSA3로 선택된 이미지 정보 전송: ${this.selectedFilename}`);
          
          // 선택된 이미지 정보 구성
          const selectedImage = {
            filename: this.selectedFilename,
            url: this.getImageUrl(this.selectedFilename),
            index: this.selectedIndex
          };
          
          // 모든 가능한 방법으로 MSA3에 데이터 전송
          this.sendImageDataToMSA3(selectedImage);
          
          // 전역 객체를 통한 직접 데이터 전송
          if (window.MSASharedData) {
            window.MSASharedData.currentImage = selectedImage;
            
            // 유사 이미지도 설정
            if (this.similarImages && this.similarImages.length > 0) {
              window.MSASharedData.similarImages = this.similarImages;
            }
            
            // console.log('MSA2: 전역 데이터에 이미지 정보 저장 완료');
          }
        } else {
          // console.log('MSA2: 아직 선택된 이미지가 없습니다');
        }
      } else {
        // console.log('MSA2: MSA3 컴포넌트를 찾을 수 없습니다');
      }
    },
    
    // MSA3로 이미지 데이터 전송하는 함수
    sendImageDataToMSA3(imageData) {
      // console.log('MSA2: MSA3로 이미지 데이터 전송 시작');
      
      try {
        // Vue 이벤트 버스를 통한 전송
        this.$eventBus.emit('image-selected', imageData);
        
        // DOM 이벤트를 통한 전송
        const event = new CustomEvent('msa2-to-msa3-image-selected', {
          detail: imageData,
          bubbles: true
        });
        document.dispatchEvent(event);
        
        // 유사 이미지 검색 및 전송
        this.findSimilarImagesByDistance(imageData.index)
          .then(similarImages => {
            // 유사 이미지가 있는 경우에만 전송
            if (similarImages && similarImages.length > 0) {
              // Vue 이벤트 버스를 통한 전송
              this.$eventBus.emit('similar-images-found', similarImages);
              
              // DOM 이벤트를 통한 전송
              const similarEvent = new CustomEvent('msa2-to-msa3-similar-images', {
                detail: similarImages,
                bubbles: true
              });
              document.dispatchEvent(similarEvent);
              
              // 이미지 개수 확인
              const iAppCount = similarImages.filter(img => img.tag_type === 'I-TAP').length;
              const analysisCount = similarImages.filter(img => img.tag_type === 'Analysis').length;
              
              // 로그 메시지 수정
              // console.log(`선택된 이미지 1개 / ${similarImages.length}개의 (tag별 I-app: ${iAppCount}, Analysis: ${analysisCount}) 유사 이미지 전송 완료`);
            }
          })
          .catch(error => {
            console.error('유사 이미지 검색 및 전송 오류:', error);
          });
        
        // console.log('MSA2: MSA3로 이미지 데이터 전송 완료');
      } catch (error) {
        console.error('MSA2: MSA3로 이미지 데이터 전송 오류:', error);
      }
    },
    
    // 3D 플롯 생성 - 완전히 새로운 방식 (더 간단하게)
    createPlot() {
      // logDebug('초간단 3D 시각화 생성 시작');
      
      // 1. 컨테이너 확인
      const container = document.getElementById('plotly-visualization');
      if (!container) {
        console.warn('시각화 컨테이너가 없습니다. 200ms 후 재시도합니다.');
        setTimeout(() => this.createPlot(), 200);
        return;
      }
      
      // 컨테이너 크기 저장 (중요: 이후 업데이트에 사용)
      this.containerWidth = container.clientWidth;
      this.containerHeight = container.clientHeight;
      
      // WebGL 컨텍스트 정리 - 새 그래프 생성 전에 호출
      this.cleanupWebGLContexts();
      
      // 기존 플롯 정리
      try {
        if (container.data) {
          Plotly.purge(container);
        }
      } catch (e) {
        // 무시
      }
      
      // 2. 데이터 준비
      if (!this.projectedVectors || !this.projectedVectors.length) {
        console.error('벡터 데이터가 없습니다.');
        return;
      }
      
      // console.log(`3D 그래프 생성: ${this.projectedVectors.length}개 포인트`);
      
      // 3. 유효한 벡터 필터링
      const validIndices = [];
      const x = [];
      const y = [];
      const z = [];
      const text = [];
      const originalIndices = [];
      const pointTypes = []; // 0 = I-app, 1 = Analysis
      
      for (let i = 0; i < this.projectedVectors.length; i++) {
        const vector = this.projectedVectors[i];
        if (!vector || !Array.isArray(vector) || vector.length < 3) {
          continue;
        }
        
        validIndices.push(i);
        x.push(vector[0] || 0);
        y.push(vector[1] || 0);
        z.push(vector[2] || 0);
        text.push(this.labels[i] || `Point ${i}`);
        originalIndices.push(i);
        
        // 점 유형 저장 (0 = I-app, 1 = Analysis)
        const isIApp = (this.labels[i] && this.labels[i].includes('_before'));
        pointTypes.push(isIApp ? 0 : 1);
      }
      
      // 상수로 포인트 크기 정의 (일관성 유지)
      const NORMAL_POINT_SIZE = 7.5;  // 기본 포인트 크기
      const SELECTED_POINT_SIZE = 12; // 선택된 포인트 크기
      const SIMILAR_POINT_SIZE = 9;   // 유사한 포인트 크기
      
      // 4. 색상 배열 생성 (전역 저장 - 업데이트용) - 항상 새로운 배열 생성
      // 모든 점을 초기 상태에서 파란색 반투명으로 설정
      this.plotColors = Array(pointTypes.length).fill('rgba(30, 144, 255, 0.6)'); // 반투명 파란색
      this.plotOriginalColors = [...this.plotColors]; // 원래 색상 백업 (새 배열로 복사)
      this.plotPointTypes = [...pointTypes]; // 새 배열로 복사
      this.plotOriginalIndices = [...originalIndices]; // 새 배열로 복사
      
      // 포인트 크기 배열 초기화 (전역 저장)
      this.plotPointSizes = Array(pointTypes.length).fill(NORMAL_POINT_SIZE);
      
      // 5. 확실하게 고정된 레이아웃 
      const layout = {
        scene: {
          xaxis: { title: 'X', range: [-0.1, 1.1], autorange: false },
          yaxis: { title: 'Y', range: [-0.1, 1.1], autorange: false },
          zaxis: { title: 'Z', range: [-0.1, 1.1], autorange: false },
          // 카메라 위치 설정 - 저장된 값 사용
          camera: {
            eye: this.currentCameraPosition ? {...this.currentCameraPosition.eye} : {x: 1.5, y: 1.5, z: 1.5},
            center: {x: 0.5, y: 0.5, z: 0.5}, // 이 값은 나중에 계산된 중심점으로 덮어씌워짐
            up: this.currentCameraPosition ? {...this.currentCameraPosition.up} : {x: 0, y: 0, z: 1},
            projection: {type: 'perspective'}
          },
          aspectratio: {x: 1, y: 1, z: 1},
          aspectmode: 'manual',
          // 회전 중심점 설정을 유지하기 위한 속성
          dragmode: 'orbit'
        },
        margin: { l: 0, r: 0, t: 0, b: 0, pad: 0, autoexpand: false },
        paper_bgcolor: 'rgba(255,255,255,0.8)',
        plot_bgcolor: 'rgba(255,255,255,0.8)',
        // 그래프 크기 설정 고정
        width: this.containerWidth,
        height: this.containerHeight,
        autosize: false,
        dragmode: 'orbit',
        hovermode: 'closest',
        uirevision: 'true' // 상태 보존 - 중요
      };
      
      // 6. 데이터 준비 (단일 트레이스) - 새로운 배열 사용
      const data = [{
        type: 'scatter3d',
        mode: 'markers',
        x: [...x], // 새 배열로 복사
        y: [...y], // 새 배열로 복사
        z: [...z], // 새 배열로 복사
        text: [...text], // 새 배열로 복사
        hoverinfo: 'text',
        marker: {
          size: [...this.plotPointSizes], // 새 배열로 복사
          color: [...this.plotColors], // 새 배열로 복사
          opacity: 0.8,
          line: {
            color: 'rgba(255,255,255,0.5)',
            width: 0.5
          }
        },
        customdata: [...originalIndices], // 새 배열로 복사
        // 회전 중심 설정을 유지하기 위한 속성
        _center: this.plotCenter ? {...this.plotCenter} : {x: 0.5, y: 0.5, z: 0.5}
      }];
      
      // 7. 플롯 생성 (에러 처리 개선)
      try {
        // 데이터 중심점 계산 (회전 중심으로 사용)
        const centerX = x.length > 0 ? x.reduce((sum, val) => sum + val, 0) / x.length : 0.5;
        const centerY = y.length > 0 ? y.reduce((sum, val) => sum + val, 0) / y.length : 0.5;
        const centerZ = z.length > 0 ? z.reduce((sum, val) => sum + val, 0) / z.length : 0.5;
        
        // 계산된 중심점 저장 (나중에 재사용)
        this.plotCenter = {x: centerX, y: centerY, z: centerZ};
        
        // 레이아웃에 중심점 설정
        layout.scene.camera.center = this.plotCenter;
        
        const plotConfig = {
          responsive: false, // 반응형 비활성화 (크기 고정)
          displayModeBar: false,
          scrollZoom: true,
          displaylogo: false,
          // WebGL 성능 최적화 옵션 추가
          showSendToCloud: false,
          staticPlot: false, // 인터랙션 유지
          // 불필요한 모드바 버튼 제거
          modeBarButtonsToRemove: ['resetCameraDefault3d', 'resetCameraLastSave3d', 'toImage', 'sendDataToCloud'],
          toImageButtonOptions: {
            format: 'png',
            width: 800,
            height: 600
          },
          // 더블클릭으로 리셋 방지
          doubleClick: false
        };
        
        Plotly.newPlot(container, data, layout, plotConfig)
          .then(() => {
            // console.log('3D 그래프 생성 완료');
            
            // 8. 클릭 이벤트 등록 - 한 번만 등록하기 위해 기존 이벤트 제거
            container.removeAllListeners && container.removeAllListeners('plotly_click');
            container.on('plotly_click', (eventData) => {
              if (!eventData || !eventData.points || !eventData.points[0]) return;
              
              const pointIndex = eventData.points[0].pointNumber;
              const customIndex = eventData.points[0].customdata;
              
              if (customIndex !== undefined) {
                // console.log(`포인트 클릭: ${pointIndex} (원본 인덱스: ${customIndex})`);
                this.selectImageByIndex(customIndex);
              }
            });
            
            // 더블클릭 이벤트 방지
            container.on('plotly_doubleclick', (eventData) => {
              if (eventData) eventData.preventDefault();
              return false;
            });
            
            // 리레이아웃 이벤트 - 카메라 위치 유지하면서 회전 중심 보존
            container.on('plotly_relayout', (eventData) => {
              // 카메라 변경 감지 (회전은 허용)
              if (eventData['scene.camera']) {
                // 카메라 위치 저장 (회전 상태 유지용)
                if (eventData['scene.camera'].eye) {
                  this.currentCameraPosition.eye = eventData['scene.camera'].eye;
                  // console.log('카메라 위치 저장:', JSON.stringify(this.currentCameraPosition.eye));
                }
                if (eventData['scene.camera'].up) {
                  this.currentCameraPosition.up = eventData['scene.camera'].up;
                }
                
                // 회전은 허용하되, 중심점은 원래 값으로 유지
                if (this.plotCenter && eventData['scene.camera'].center) {
                  // 회전 중심 강제 고정
                  setTimeout(() => {
                    Plotly.relayout(container, {
                      'scene.camera.center': this.plotCenter
                    }).catch(e => console.warn('회전 중심 유지 오류:', e));
                  }, 10);
                }
                return;
              }
              
              // 다른 변경이 있으면 원래 크기와 위치 유지
              if (eventData.width !== this.containerWidth || 
                  eventData.height !== this.containerHeight) {
                // 크기 변경 감지 시 원래 크기로 복원
                Plotly.relayout(container, {
                  width: this.containerWidth,
                  height: this.containerHeight,
                  autosize: false
                }).catch(e => console.warn('크기 복원 오류:', e));
              }
            });
            
            // 이전에 선택된 점이 있는 경우 하이라이트 적용
            if (this.selectedIndex >= 0) {
              setTimeout(() => {
                this.highlightPointByColor(this.selectedIndex);
              }, 300);
            }
          })
          .catch(error => {
            console.error('Plotly 초기화 오류:', error);
          });
      } catch (error) {
        console.error('플롯 생성 중 치명적 오류:', error);
      }
    },
    
    // 색상 기반 점 하이라이트 (트레이스 추가/제거 방식 대신 색상 업데이트)
    highlightPointByColor(index) {
      try {
        // console.log(`색상 기반 점 하이라이트: 인덱스 ${index}`);
        
        // 컨테이너 확인
        const container = document.getElementById('plotly-visualization');
        if (!container || !container.data || !container.data[0]) {
          console.warn('플롯 컨테이너가 초기화되지 않았습니다.');
          return;
        }
        
        // 전역 색상 배열이 없으면 초기화
        if (!this.plotColors || !this.plotOriginalColors || !this.plotOriginalIndices) {
          console.warn('색상 배열이 초기화되지 않았습니다.');
          return;
        }
        
        // 선택된 점의 플롯 내 인덱스 찾기
        const plotIndex = this.plotOriginalIndices.findIndex(i => i === index);
        if (plotIndex === -1) {
          console.warn(`인덱스 ${index}에 해당하는 점이 플롯에 없습니다.`);
          return;
        }
        
        // 상수로 포인트 크기 정의 (일관성 유지)
        const NORMAL_POINT_SIZE = 7.5;  // 기본 포인트 크기
        const SELECTED_POINT_SIZE = 12; // 선택된 포인트 크기
        const SIMILAR_POINT_SIZE = 9;   // 유사한 포인트 크기
        
        // 기본 색상 배열로 모든 점 초기화 (파란색 반투명)
        const newColors = Array(this.plotOriginalIndices.length).fill('rgba(30, 144, 255, 0.6)');
        
        // 기본 크기 배열로 모든 점 초기화
        const newSizes = Array(this.plotOriginalIndices.length).fill(NORMAL_POINT_SIZE);
        
        // 선택된 점 색상 및 크기 변경 (빨간색)
        newColors[plotIndex] = 'rgb(255, 0, 0)';
        newSizes[plotIndex] = SELECTED_POINT_SIZE;
        
        // 선택된 점의 태그 타입 확인
        const selectedPointType = this.plotPointTypes[plotIndex];
        const selectedVector = this.projectedVectors[index];
        
        // 선 트레이스 정보 저장용 배열
        const lineTraces = [];
        
        // 선택된 점의 좌표
        const selectedX = selectedVector[0];
        const selectedY = selectedVector[1];
        const selectedZ = selectedVector[2];
        
        if (selectedVector) {
          // I-app 그룹 내 유사 점 찾기
          const iAppDistances = [];
          const analysisDistances = [];
          
          // 각 태그별 거리 계산
          for (let i = 0; i < this.plotOriginalIndices.length; i++) {
            // 같은 점이면 건너뛰기
            if (i === plotIndex) continue;
            
            const origIndex = this.plotOriginalIndices[i];
            const vector = this.projectedVectors[origIndex];
            const pointType = this.plotPointTypes[i];
            
            if (vector) {
              const distance = this.calculate3DDistance(selectedVector, vector);
              
              // 태그별로 분리
              if (pointType === 0) { // I-app
                iAppDistances.push({ index: i, distance, vector });
              } else { // Analysis
                analysisDistances.push({ index: i, distance, vector });
              }
            }
          }
          
          // 거리순 정렬
          iAppDistances.sort((a, b) => a.distance - b.distance);
          analysisDistances.sort((a, b) => a.distance - b.distance);
          
          // I-app 태그 유사 이미지 3개 (초록색)
          const nearestIApp = iAppDistances.slice(0, 3);
          for (const point of nearestIApp) {
            newColors[point.index] = 'rgb(46, 204, 113)'; // 초록색
            newSizes[point.index] = SIMILAR_POINT_SIZE;
            
            // I-app 유사점과 선택된 점 사이의 연결선 정보 저장
            lineTraces.push({
              x: [selectedX, point.vector[0]],
              y: [selectedY, point.vector[1]],
              z: [selectedZ, point.vector[2]],
              color: 'rgba(46, 204, 113, 0.7)', // 초록색 반투명
              width: 6 // 1.5배 증가 (3 → 4.5)
            });
          }
          
          // Analysis 태그 유사 이미지 3개 (주황색)
          const nearestAnalysis = analysisDistances.slice(0, 3);
          for (const point of nearestAnalysis) {
            newColors[point.index] = 'rgb(255, 165, 0)'; // 주황색
            newSizes[point.index] = SIMILAR_POINT_SIZE;
            
            // Analysis 유사점과 선택된 점 사이의 연결선 정보 저장
            lineTraces.push({
              x: [selectedX, point.vector[0]],
              y: [selectedY, point.vector[1]],
              z: [selectedZ, point.vector[2]],
              color: 'rgba(255, 165, 0, 0.7)', // 주황색 반투명
              width: 6 // 1.5배 증가 (3 → 4.5)
            });
          }
        }
        
        // 1단계: 마커 업데이트 (색상과 크기만 변경)
        Plotly.restyle(container, {
          'marker.color': [newColors],
          'marker.size': [newSizes]
        }, [0]).catch(error => {
          console.warn('플롯 색상 업데이트 오류 (무시됨):', error);
        });
        
        // 2단계: 기존 선 트레이스 제거 (첫 번째 트레이스는 점들이므로 보존)
        let tracesToDelete = [];
        if (container.data && container.data.length > 1) {
          for (let i = 1; i < container.data.length; i++) {
            tracesToDelete.push(i);
          }
          
          if (tracesToDelete.length > 0) {
            try {
              Plotly.deleteTraces(container, tracesToDelete);
            } catch (error) {
              console.warn('선 트레이스 삭제 중 오류 (무시됨):', error);
            }
          }
        }
        
        // 3단계: 선 트레이스 추가 (모든 선을 한 번에 추가 - 성능 향상)
        if (lineTraces.length > 0) {
          // 모든 선 트레이스를 한 번에 처리하기 위한 배열
          const lines = {
            type: 'scatter3d',
            mode: 'lines',
            x: [],
            y: [],
            z: [],
            line: {
              color: [],
              width: []
            },
            hoverinfo: 'none',
            showlegend: false
          };
          
          // 선 트레이스 정보 추가 (null을 사용해 선 분리)
          for (let i = 0; i < lineTraces.length; i++) {
            const line = lineTraces[i];
            
            // 선 시작점
            lines.x.push(line.x[0]);
            lines.y.push(line.y[0]);
            lines.z.push(line.z[0]);
            lines.line.color.push(line.color);
            lines.line.width.push(line.width);
            
            // 선 끝점
            lines.x.push(line.x[1]);
            lines.y.push(line.y[1]);
            lines.z.push(line.z[1]);
            lines.line.color.push(line.color);
            lines.line.width.push(line.width);
            
            // 선 분리 (다음 선과 연결되지 않도록)
            if (i < lineTraces.length - 1) {
              lines.x.push(null);
              lines.y.push(null);
              lines.z.push(null);
              lines.line.color.push('rgba(0,0,0,0)');
              lines.line.width.push(0);
            }
          }
          
          // 모든 선을 한 번에 추가
          Plotly.addTraces(container, [lines])
            .catch(error => {
              console.warn('선 트레이스 추가 오류 (무시됨):', error);
            });
        }
        
        // 4단계: 카메라 위치 고정 (그래프 이동 방지)
        Plotly.relayout(container, {
          // 카메라 eye 위치 재설정 제거 - 회전 각도 유지
          'scene.camera.center': this.plotCenter || {x: 0.5, y: 0.5, z: 0.5}
        }).catch(error => {
          console.warn('카메라 위치 고정 오류 (무시됨):', error);
        });
        
        // 현재 색상 및 크기 상태 저장
        this.plotColors = newColors;
        this.plotPointSizes = newSizes;
        
      } catch (error) {
        console.error('점 하이라이트 오류:', error);
      }
    },
    
    // 인덱스로 이미지 선택하는 함수 (Plotly 이벤트용)
    selectImageByIndex(index) {
      // console.log(`======= 이미지 선택 시작 (인덱스: ${index}) =======`);
      
      // 인덱스 유효성 검사
      if (index === undefined || index === null || isNaN(index)) {
        console.error(`유효하지 않은 인덱스 타입: ${typeof index}, 값: ${index}`);
        return;
      }
      
      if (index < 0 || index >= this.labels.length) {
        console.error(`인덱스 범위 오류: ${index}, 유효 범위: 0-${this.labels.length - 1}`);
        return;
      }
      
      // 동일한 이미지 재선택 방지
      if (this.selectedIndex === index) {
        // console.log(`이미 선택된 이미지입니다 (인덱스: ${index}, 파일명: ${this.labels[index]})`);
        return;
      }
      
      try {
        // 이전 선택 인덱스 저장
        const prevSelectedIndex = this.selectedIndex;
        
        // 선택된 인덱스와 파일명 업데이트
        this.selectedIndex = index;
        this.selectedFilename = this.labels[index];
        
        // console.log(`선택된 이미지 정보 업데이트 완료:`);
        // console.log(`- 인덱스: ${this.selectedIndex}`);
        // console.log(`- 파일명: ${this.selectedFilename}`);
        
        // 선택한 이미지 정보 구성
        const selectedImage = {
          url: this.getImageUrl(this.labels[index]),
          filename: this.labels[index],
          index: index
        };
        
        // 3D 그래프에서 선택된 점 강조 표시
        try {
          // console.log('3D 그래프에서 선택된 점 강조 표시 시작...');
          
          // 색상 기반 하이라이트 함수 호출
          this.highlightPointByColor(index);
          
          // console.log('3D 그래프 점 강조 표시 요청 완료');
        } catch (plotError) {
          // console.error('3D 그래프 점 강조 표시 중 오류:', plotError);
        }
        
        // 전역 객체에 직접 저장
        if (window.MSASharedData) {
          window.MSASharedData.currentImage = selectedImage;
          // console.log('MSA2: 전역 데이터에 이미지 정보 저장 완료');
      } else {
          window.MSASharedData = {
            currentImage: selectedImage,
            similarImages: []
          };
        }
        
        // 유사 이미지 찾기
        this.findSimilarImagesByDistance(index)
          .then(similarImages => {
            // 전역 객체에 유사 이미지 저장
            if (window.MSASharedData) {
              window.MSASharedData.similarImages = similarImages;
            }
            
            // 이벤트 발생 및 데이터 전송
            this.sendImageDataToMSA3(selectedImage);
          })
          .catch(error => {
            // console.error('유사 이미지 찾기 오류:', error);
            this.sendImageDataToMSA3(selectedImage);
          });
        
        // console.log(`======= 이미지 선택 완료 (인덱스: ${index}) =======`);
      } catch (error) {
        // console.error('이미지 선택 처리 중 오류 발생:', error);
      }
    },
    
    // 태그별 그룹 생성 함수
    getTagGroups() {
      try {
        // 기본 태그 그룹 구조 초기화
      const tagGroups = {
        'I-TAP': [],
        'Analysis': []
      };
        
        // 라벨 배열이 없거나 비어있으면 기본값 반환
        if (!this.labels || this.labels.length === 0) {
          // console.warn('라벨 배열이 비어있거나 정의되지 않았습니다. 빈 태그 그룹을 반환합니다.');
          return tagGroups;
        }
      
      // 라벨을 기반으로 태그 그룹 생성
      for (let i = 0; i < this.labels.length; i++) {
        const label = this.labels[i];
          if (!label) {
            // console.warn(`인덱스 ${i}의 라벨이 undefined 또는 null입니다. 건너뜁니다.`);
            continue;
          }
          
          if (typeof label === 'string' && label.includes('_before')) {
          tagGroups['I-TAP'].push(i);
        } else {
          tagGroups['Analysis'].push(i);
        }
      }
      
      return tagGroups;
      } catch (error) {
        // console.error('태그 그룹 생성 오류:', error);
        return { 'I-TAP': [], 'Analysis': [] };
      }
    },
    
    // MSA1에서 유사 이미지 데이터 수신 처리 (새로 추가)
    handleSimilarImagesFromMSA1(event) {
      try {
        // console.log('[MSA2] MSA1에서 유사 이미지 데이터 수신:', event.detail);
        
        const { mainImage, similarImages, uploadedVector, totalCompared } = event.detail;
        
        // 업로드된 이미지의 3D 벡터가 있으면 처리
        if (uploadedVector && uploadedVector.length === 3) {
          // console.log('[MSA2] 업로드된 이미지의 3D 벡터:', uploadedVector);
          // 업로드된 벡터를 기존 벡터 데이터에 추가할 수 있음 (선택사항)
        }
        
        // 유사 이미지 데이터 저장
        this.similarImages = similarImages || [];
        
        // 메인 이미지 정보 저장
        this.selectedImage = mainImage;
        this.selectedImageName = mainImage.filename;
        
        // console.log(`[MSA2] 총 ${totalCompared || 0}개 이미지와 비교하여 ${similarImages.length}개 유사 이미지 발견`);
        
        // 플롯 업데이트
        this.updatePlotWithSimilarImages(mainImage, similarImages);
        
        // MSA3에 이미지 선택 이벤트 전송
        this.sendImageSelectedToMSA3(mainImage, similarImages);
        
        // console.log('[MSA2] Base64 유사 이미지 데이터 처리 완료');
        
      } catch (error) {
        // console.error('[MSA2] 유사 이미지 데이터 처리 오류:', error);
      }
    },
    
    // 유사 이미지로 플롯 업데이트
    updatePlotWithSimilarImages(mainImage, similarImages) {
      try {
        // console.log('[MSA2] 유사 이미지로 플롯 업데이트 시작');
        
        // 기존 벡터 데이터가 없으면 처리할 수 없음
        if (!this.projectedVectors || this.projectedVectors.length === 0) {
          console.warn('[MSA2] 기존 벡터 데이터가 없어 유사 이미지 하이라이트를 건너뜁니다');
          return;
        }
        
        // 기존 라벨이 없으면 처리할 수 없음
        if (!this.labels || this.labels.length === 0) {
          console.warn('[MSA2] 기존 라벨 데이터가 없어 유사 이미지 하이라이트를 건너뜁니다');
          return;
        }
        
        // 메인 이미지의 인덱스 찾기
        let mainImageIndex = -1;
        if (this.labels) {
          mainImageIndex = this.labels.findIndex(label => {
            if (typeof label === 'string' && typeof mainImage.filename === 'string') {
              return label === mainImage.filename || 
                     label.includes(mainImage.filename) ||
                     mainImage.filename.includes(label) ||
                     this.compareFilenames(label, mainImage.filename);
            }
            return false;
          });
        }
        
        // console.log('[MSA2] 메인 이미지 인덱스:', mainImageIndex, '파일명:', mainImage.filename);
        
        // 메인 이미지를 찾았으면 기존 updatePlotMarkers 함수 호출
        if (mainImageIndex !== -1) {
          // 선택된 인덱스 설정
          this.selectedIndex = mainImageIndex;
          
          // 기존 updatePlotMarkers 함수 호출 (기존 로직 그대로 사용)
          this.updatePlotMarkers(mainImageIndex);
          
          // console.log('[MSA2] 기존 updatePlotMarkers 함수로 플롯 업데이트 완료');
        } else {
          // console.warn('[MSA2] 메인 이미지를 찾을 수 없습니다:', mainImage.filename);
          
          // 유사 이미지 검색 결과의 첫 번째 이미지를 메인 이미지로 사용
          if (similarImages && similarImages.length > 0) {
            // console.log('[MSA2] 유사 이미지 검색 결과의 첫 번째 이미지를 메인 이미지로 사용합니다');
            
            const firstSimilarImage = similarImages[0];
            // console.log('[MSA2] 첫 번째 유사 이미지:', firstSimilarImage.filename);
            
            // 첫 번째 유사 이미지로 인덱스 다시 검색
            const fallbackIndex = this.labels.findIndex(label => {
              if (typeof label === 'string' && typeof firstSimilarImage.filename === 'string') {
                const match = label === firstSimilarImage.filename || 
                             label.includes(firstSimilarImage.filename) ||
                             firstSimilarImage.filename.includes(label) ||
                             this.compareFilenames(label, firstSimilarImage.filename);
                
                if (match) {
                  // console.log(`[MSA2] 유사 이미지로 매칭 발견! 라벨: "${label}", 파일명: "${firstSimilarImage.filename}"`);
                }
                
                return match;
              }
              return false;
            });
            
            // console.log('[MSA2] 유사 이미지로 찾은 인덱스:', fallbackIndex);
            
            // 유사 이미지로 찾았으면 해당 인덱스로 플롯 업데이트
            if (fallbackIndex !== -1) {
              // 기존 점 클릭과 완전히 동일한 방식으로 처리
              this.selectImageByIndex(fallbackIndex);
              // console.log('[MSA2] 유사 이미지를 메인 이미지로 사용하여 기존 점 클릭과 동일하게 처리 완료');
            } else {
              console.warn('[MSA2] 유사 이미지도 기존 데이터에서 찾을 수 없습니다');
              // console.log('[MSA2] 사용 가능한 라벨들 (처음 10개):', this.labels.slice(0, 10));
            }
          } else {
            // console.log('[MSA2] 사용 가능한 라벨들 (처음 10개):', this.labels.slice(0, 10));
          }
        }
        
      } catch (error) {
        console.error('[MSA2] 플롯 업데이트 오류:', error);
      }
    },
        
      
    // 파일명 비교 함수
    compareFilenames(filename1, filename2) {
      try {
        // 확장자 제거하고 비교
        const name1 = filename1.split('.')[0].toLowerCase();
        const name2 = filename2.split('.')[0].toLowerCase();
        
        // 타임스탬프 제거하고 비교
        const cleanName1 = name1.replace(/^\d{8}_\d{6}_/, '');
        const cleanName2 = name2.replace(/^\d{8}_\d{6}_/, '');
        
        return cleanName1 === cleanName2 || name1 === name2;
      } catch (error) {
        return false;
      }
    },
    
    
    // MSA3에 이미지 선택 이벤트 전송
    sendImageSelectedToMSA3(mainImage, similarImages) {
      try {
        // 커스텀 이벤트로 MSA3에 전송
        const msa3Event = new CustomEvent('msa2-to-msa3-image-selected', {
          detail: {
            selectedImage: mainImage,
            similarImages: similarImages
          }
        });
        document.dispatchEvent(msa3Event);
        
        // console.log('[MSA2] MSA3에 이미지 선택 이벤트 전송됨');
        
      } catch (error) {
        console.error('[MSA2] MSA3 이벤트 전송 오류:', error);
      }
    },
    
    // 백엔드로부터 최유사 이미지 수신 처리 (새로 추가)
    handleSimilarImageFromBackend(event) {
      try {
        // console.log('[MSA2] 백엔드로부터 최유사 이미지 수신:', event.detail);
        
        const { filename, similarity, source_image, tag_type, index } = event.detail;
        
        if (!filename) {
          console.warn('[MSA2] 최유사 이미지 파일명이 없습니다');
          return;
        }
        
        // console.log(`[MSA2] 최유사 이미지 수신됨: ${filename} (유사도: ${similarity}%, 원본: ${source_image}, 인덱스: ${index})`);
        
        // 백엔드에서 제공한 인덱스가 있으면 우선 사용
        if (typeof index === 'number' && index >= 0) {
          // console.log('[MSA2] 백엔드에서 제공한 인덱스 사용:', index);
          this.selectImageByIndex(index);
          // console.log('[MSA2] 백엔드 인덱스로 최유사 이미지 선택 완료');
          return;
        }
        
        // 기존 벡터 데이터에서 해당 이미지의 인덱스 찾기
        let imageIndex = -1;
        if (this.labels && this.labels.length > 0) {
          imageIndex = this.labels.findIndex(label => {
            if (typeof label === 'string' && typeof filename === 'string') {
              return label === filename || 
                     label.includes(filename) ||
                     filename.includes(label) ||
                     this.compareFilenames(label, filename);
            }
            return false;
          });
        }
        
        // console.log('[MSA2] 최유사 이미지 인덱스:', imageIndex, '파일명:', filename);
        
        if (imageIndex !== -1) {
          // 기존 select point 기능 호출
          this.selectImageByIndex(imageIndex);
          // console.log('[MSA2] 최유사 이미지를 기존 select point 기능에 연동 완료');
        } else {
          // console.warn('[MSA2] 최유사 이미지를 기존 데이터에서 찾을 수 없습니다:', filename);
          // console.log('[MSA2] 사용 가능한 라벨들 (처음 10개):', this.labels ? this.labels.slice(0, 10) : []);
        }
        
      } catch (error) {
        console.error('[MSA2] 백엔드 최유사 이미지 처리 오류:', error);
      }
    },
  },
  created() {
    // logDebug('MSA2VectorTransform component created');
    
    // 초기화 시 선택된 점이 없도록 설정
    this.selectedIndex = -1;
    this.selectedFilename = null;
    
    // WebGL 컨텍스트 관리 함수 정의
    this.cleanupWebGLContexts = () => {
      // canvas 요소들 중 WebGL 컨텍스트가 있는 요소 검색
      const canvases = document.querySelectorAll('canvas');
      const plotlyCanvases = Array.from(canvases).filter(canvas => {
        // plotly-visualization 내부에 없는 캔버스는 제외
        const parent = canvas.closest('#plotly-visualization');
        return !parent && canvas.id.includes('gl-canvas');
      });
      
      // 사용하지 않는 WebGL 캔버스 정리
      plotlyCanvases.forEach(canvas => {
        try {
          // WebGL 컨텍스트 가져오기 시도
          const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
          if (gl) {
            // WebGL 컨텍스트 정리
            gl.getExtension('WEBGL_lose_context')?.loseContext();
            
            // 캔버스 제거 (선택 사항, 상황에 따라 주의 필요)
            if (canvas.parentNode) {
              canvas.parentNode.removeChild(canvas);
            }
          }
        } catch (e) {
          console.warn('WebGL 컨텍스트 정리 중 오류:', e);
        }
      });
    };
    
    // // 플롯 초기화
    // this.initializeVisualization();
    
    // MSA3에서 오는 이미지 선택 이벤트 리스너 등록
    if (this.$eventBus) {
      this.$eventBus.on('select-image-by-filename', this.handleSelectImageByFilename);
    }
  },
  
  beforeDestroy() {
    // logDebug('MSA2VectorTransform component unmounting');
    
    // WebGL 컨텍스트 정리
    this.cleanupWebGLContexts();
    
    // 이벤트 리스너 정리
    window.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('msa1-to-msa4-image', this.handleImageUpdate);
    document.removeEventListener('msa1-to-msa2-similar-images', this.handleSimilarImagesFromMSA1);
    document.removeEventListener('msa5-to-msa4-similar-images', this.handleSimilarImagesFromMSA5);
    
    // ResizeObserver 정리
    if (this.containerObserver) {
      this.containerObserver.disconnect();
    }
    
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    
    // 이벤트 리스너 제거
    if (this.$eventBus) {
      this.$eventBus.off('select-image-by-filename', this.handleSelectImageByFilename);
    }
    
    // logDebug('MSA4 event listeners and observers cleaned up');
  },
}
</script>