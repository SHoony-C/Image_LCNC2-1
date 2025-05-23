<template>
  <div class="msa-component">
    <div class="component-header">
      <div class="header-left">
        <i class="fas fa-network-wired"></i>
        <span>유사 이미지 검색</span>
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
      
      <div class="image-section">
        <div v-if="isProcessing" class="loading-overlay">
          <div class="loading-spinner"></div>
          <div class="loading-message">{{ loadingMessage }}</div>
        </div>
        
        <div class="scrollable-content">
          <!-- 선택된 이미지 섹션 -->
          <div class="selected-image-section" v-if="selectedFilename">
            <h3>선택된 이미지</h3>
            <div class="selected-image-wrapper">
              <img 
                :src="getImageUrl(selectedFilename)" 
                :alt="selectedFilename"
                @error="handleImageError"
                @click="showImageDetailsPopup(selectedFilename)"
                class="main-image clickable"
              />
            </div>
          </div>
          
          <!-- 유사 이미지 섹션 -->
          <div v-if="similarImages.length > 0" class="similar-images-section">
            <h3>유사 이미지</h3>
            <div class="similar-images-grid">
              <div 
                v-for="(image, idx) in similarImages.slice(0, 4)" 
                :key="idx" 
                class="similar-image-item"
                @click="handleSimilarImageClick(image.filename)"
              >
                <img 
                  :src="getImageUrl(image.filename)" 
                  :alt="image.filename"
                  @error="handleImageError"
                  class="similar-image"
                />
                <div class="similarity-score">
                  {{ formatSimilarity(image.similarity) }}% 유사
                </div>
              </div>
            </div>
          </div>

          <div v-if="errorMessage" class="error-message">
            {{ errorMessage }}
          </div>
        </div>
      </div>
    </div>
    
    <!-- 이미지 상세 팝업 -->
    <Teleport to="body">
      <div v-if="showImagePopup" class="image-detail-popup-overlay" @click="closeImagePopup">
        <div class="image-detail-popup" @click.stop>
          <div class="popup-header">
            <h3>이미지 상세 정보</h3>
            <button class="close-btn" @click="closeImagePopup">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="popup-content">
            <div class="image-preview">
              <img 
                :src="popupImageUrl" 
                :alt="popupImageFilename" 
                class="popup-image"
              />
              <div class="image-title">{{ popupImageFilename }}</div>
            </div>
            
            <div class="popup-actions">
              <button class="action-btn import-btn" @click="sendImageToLCNC">
                <i class="fas fa-file-import"></i>
                MSA5로 보내기
              </button>
              
              <div v-if="popupWorkflowData" class="workflow-info">
                <div class="workflow-badge">
                  <i class="fas fa-save"></i> 
                  저장된 워크플로우 있음
                </div>
                <button class="action-btn view-btn" @click="loadWorkflowToLCNC">
                  <i class="fas fa-file-import"></i>
                  워크플로우 불러오기
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script>
import Plotly from 'plotly.js-dist';
// import axios from 'axios'; // 사용하지 않음 - API 호출 제거됨
// Vue 3에서 이벤트 버스 구현이 필요하면 mitt 라이브러리 설치 필요
// import mitt from 'mitt'; // npm install mitt

// Plotly를 전역 객체로 설정 (window.Plotly 참조용)
window.Plotly = Plotly;

// 디버깅 로거 설정
const DEBUG = true;
function logDebug(...args) {
  if (DEBUG) {
    console.log('[MSA4]', ...args);
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
      plotConfig: {
        responsive: true,
        displayModeBar: true,
        scrollZoom: true
      },
      showImagePopup: false,
      popupImageUrl: '',
      popupImageFilename: '',
      popupWorkflowData: null
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
          this.initializePlot();
        }
      },
      immediate: true
    }
  },
  mounted() {
    logDebug('MSA4 Vector Transform Component mounted');
    this.checkVectorsData();
    
    // 전역 이벤트 리스너 설정
    logDebug('Setting up document-level event listeners');
    window.addEventListener('keydown', this.handleKeyDown);
    
    // MSA1에서 이미지 업데이트 이벤트 리스너 등록
    document.addEventListener('msa1-to-msa4-image', this.handleImageUpdate);
    
    // MSA5에서 유사 이미지 결과 수신하는 이벤트 리스너 등록
    document.addEventListener('msa5-to-msa4-similar-images', this.handleSimilarImagesFromMSA5);
    
    // 컴포넌트 크기 변경 감지를 위한 ResizeObserver 설정
    this.setupResizeObserver();
    
    // 기본 3D 그래프 시각화 생성
    this.createVisualization();
    
    // MSA 컴포넌트 간 통신 상태 콘솔에 로깅
    console.log('%c[MSA4] Component ready for inter-component communication', 
      'background: #28a745; color: white; padding: 2px 6px; border-radius: 2px');
    
    logDebug('MSA4 component initialization complete');
  },
  beforeUnmount() {
    logDebug('MSA4 component unmounting');
    
    // 이벤트 리스너 정리
    window.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('msa1-to-msa4-image', this.handleImageUpdate);
    document.removeEventListener('msa5-to-msa4-similar-images', this.handleSimilarImagesFromMSA5);
    
    // ResizeObserver 정리
    if (this.containerObserver) {
      this.containerObserver.disconnect();
    }
    
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    
    logDebug('MSA4 event listeners and observers cleaned up');
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
          logDebug(`MSA1 element found with selector: ${selector}`);
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
          logDebug(`MSA5 element found with selector: ${selector}`);
          this.msa5Element = element;
        }
      }

      // 요소를 찾지 못한 경우 재시도
      if (!this.msa1Element && this.msa1FindAttempts < this.maxFindAttempts) {
        this.msa1FindAttempts++;
        logDebug(`MSA1 element not found, retrying (${this.msa1FindAttempts}/${this.maxFindAttempts})`);
        setTimeout(() => this.findAndMonitorMSA1(), 1000);
      } else if (!this.msa1Element) {
        logDebug('Failed to find MSA1 element after maximum attempts');
      }
    },

    // MSA1 리스너 설정
    setupMSA1Listeners(element) {
      // 파일 입력 요소 찾기
      const fileInputs = element.querySelectorAll('input[type="file"]');
      if (fileInputs.length > 0) {
        fileInputs.forEach(input => {
          input.addEventListener('change', this.handleMSA1FileInputChange);
          logDebug('Added file input change listener to MSA1');
        });
      }
      
      // 이미지 요소 찾기
      const images = element.querySelectorAll('img');
      if (images.length > 0) {
        images.forEach(img => {
          img.addEventListener('load', this.handleMSA1ImageLoad);
          logDebug('Added image load listener to MSA1');
        });
      }
    },

    // MSA1 파일 입력 변경 처리
    handleMSA1FileInputChange(event) {
      const files = event.target.files;
      if (files && files.length > 0) {
        const file = files[0];
        logDebug(`MSA1 file input change detected: ${file.name}`);
        
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
        logDebug(`MSA1 image loaded: ${img.src}`);
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
      logDebug('Received direct image data:', imageData);
      if (!imageData || (!imageData.imageUrl && !imageData.url)) {
        logDebug('Invalid image data received in handleDirectImageData');
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
      logDebug('Checking vector data availability');
      
      if (this.vectors && this.vectors.length > 0) {
        logDebug(`Vector data already loaded, ${this.vectors.length} vectors available`);
        return;
      }
      
      this.loadingMessage = '벡터 데이터 로딩 중...';
      this.isLoading = true;
      
      try {
        // 8000 포트 API에서 벡터 데이터 가져오기
        const response = await fetch('http://localhost:8000/api/vectors', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`API returned status: ${response.status}`);
        }
        
        const data = await response.json();
        logDebug(`Received vector data from API: ${data.vectors?.length || 0} vectors`);
        
        if (!data.vectors || !Array.isArray(data.vectors) || data.vectors.length === 0) {
          throw new Error('No valid vector data received from API');
        }

        // 벡터 데이터와 라벨 처리
        const vectors = data.vectors;
        const labels = data.labels || Array(vectors.length).fill().map((_, i) => `이미지${i+1}`);

        // 벡터 데이터 처리 및 시각화
        this.processVectorData(vectors, labels);
        
        this.isDataLoaded = true;
        this.loadingComplete = true;
        this.loadingMessage = '';
        
      } catch (error) {
        console.error('Error loading vector data:', error);
        this.displayErrorMessage('벡터 데이터를 불러오는데 실패했습니다');
        this.loadingComplete = true;
        this.isLoading = false;
      }
    },
    
    // 일반 벡터 데이터 API 호출 (백업용)
    async fallbackToRegularVectors() {
      logDebug('Falling back to regular vectors API');
      
      try {
        const response = await fetch(this.getApiEndpoint('/api/msa4/vectors'), {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Fallback API returned status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.vectors && data.vectors.length > 0 && data.metadata) {
          logDebug(`Loaded ${data.vectors.length} vectors from fallback API`);
          
          // 중복 제거를 위한 맵 생성
          const uniqueVectors = new Map();
          
          // 동일한 이미지명을 가진 첫 번째 벡터만 유지
          data.metadata.forEach((label, index) => {
            const cleanLabel = this.removeTimestamp(label);
            if (!uniqueVectors.has(cleanLabel)) {
              uniqueVectors.set(cleanLabel, data.vectors[index]);
            }
          });
          
          // 맵에서 배열로 변환
          const processedVectors = Array.from(uniqueVectors.values());
          const processedLabels = Array.from(uniqueVectors.keys());
          
          logDebug(`Processed ${processedVectors.length} unique vectors`);
          this.processVectorData(processedVectors, processedLabels);
        } else {
          this.displayErrorMessage('유효한 벡터 데이터가 없습니다');
        }
      } catch (error) {
        console.error('Error in fallback vector loading:', error);
        this.displayErrorMessage('벡터 데이터 로드를 위한 모든 시도가 실패했습니다');
        this.createDummyVectorData();
      }
    },
    
    // 타임스탬프 제거 함수
    removeTimestamp(filename) {
      if (!filename) return filename;
      return filename.replace(/^\d{8}_\d{6}_/, '');
    },
    
    // 이미지명 정규화 함수 (타임스탬프 제거)
    normalizeImageName(filename) {
      return this.removeTimestamp(filename);
    },
    
    // 더미 벡터 데이터 생성 (테스트용)
    createDummyVectorData() {
      logDebug('Creating dummy vector data for testing');
      
      const dummyCount = 30;
      const dummyVectors = [];
      const dummyLabels = [];
      
      for (let i = 0; i < dummyCount; i++) {
        // 128차원 랜덤 벡터 생성
        const vector = Array(128).fill().map(() => Math.random() - 0.5);
        dummyVectors.push(vector);
        dummyLabels.push(`테스트이미지${i+1}`);
      }
      
      this.processVectorData(dummyVectors, dummyLabels);
      this.showMessage('테스트용 더미 데이터가 생성되었습니다', 'warning');
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
    
    initializeMarkerStyles() {
      // 이 메서드는 더 이상 사용하지 않음 - 비반응형 접근법으로 대체됨
      logDebug('initializeMarkerStyles is now deprecated');
      // 기존 반응형 로직 대신 createPlot 및 highlightSelectedPoint에서 
      // 비반응형 배열을 직접 생성하여 사용함
    },
    
    projectVectorsWith3DPCA(vectors) {
      logDebug('Projecting vectors to 3D space...');
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
      return Math.sqrt(
        Math.pow(point1[0] - point2[0], 2) +
        Math.pow(point1[1] - point2[1], 2) +
        Math.pow(point1[2] - point2[2], 2)
      );
    },
    
    // 유사 이미지 검색 함수 수정
    findSimilarImages(filename) {
      if (!filename) {
        logDebug('No filename provided for finding similar images');
        return;
      }
      
      logDebug(`Finding similar images for: ${filename}`);
      this.isProcessing = true;
      this.loadingMessage = '유사 이미지 검색 중...';
      
      // API 엔드포인트를 8000 포트 /api/similar-images로 변경
      const apiUrl = `http://localhost:8000/api/similar-images/${encodeURIComponent(filename)}`;
      
      fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`API returned status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        logDebug(`Received similar images data: ${data.similar_images?.length || 0} images`);
        
        if (data.status === 'success' && data.similar_images && data.similar_images.length > 0) {
          // 상위 4개만 선택
          const topSimilarImages = data.similar_images.slice(0, 4).map(item => ({
            filename: item.filename,
            similarity: item.similarity,
            url: this.getImageUrl(item.filename)
          }));
          
          this.similarImages = topSimilarImages;
          logDebug(`Processed ${topSimilarImages.length} similar images`);
        } else {
          this.similarImages = [];
          if (data.status === 'error') {
            this.displayErrorMessage(data.message || '유사 이미지를 찾을 수 없습니다');
          }
        }
      })
      .catch(error => {
        console.error('Error finding similar images:', error);
        this.displayErrorMessage('유사 이미지 검색 중 오류가 발생했습니다');
        this.similarImages = [];
      })
      .finally(() => {
        this.isProcessing = false;
      });
    },

    // 유사 이미지 클릭 처리
    handleSimilarImageClick(filename) {
      logDebug(`Similar image clicked: ${filename}`);
      
      // 재귀 방지 (이미 이미지 선택 처리 중이면 무시)
      if (this.isSelectingImageFlag) {
        logDebug('Already in image selection process, ignoring similar image click');
        return;
      }
      
      // setTimeout으로 콜 스택 초기화
      setTimeout(() => {
        this.selectImage(filename);
      }, 0);
    },

    // 유사도 값 포맷팅 (필터 대신 메소드 사용)
    formatSimilarity(similarity) {
      return Math.round(parseFloat(similarity) * 100);
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

    // ResizeObserver 설정 함수 추가
    setupResizeObserver() {
      logDebug('Setting up ResizeObserver');
      
      // 기존 ResizeObserver 정리
      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
      }
      
      // 컨테이너 요소 찾기
      const container = this.$el.querySelector('.content-container');
      if (!container) {
        logDebug('Content container not found');
        return;
      }
      
      // 새로운 ResizeObserver 생성
      this.resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          logDebug(`Container size changed: ${width}x${height}`);
          
          // Plotly 플롯이 존재하고 DOM에 표시되어 있는 경우에만 리사이즈
          const plotDiv = document.getElementById('plotly-visualization');
          if (plotDiv && plotDiv.innerHTML !== '' && plotDiv.clientWidth > 0) {
            try {
              window.Plotly.relayout(plotDiv, {
                width: plotDiv.clientWidth,
                height: plotDiv.clientHeight
              });
              logDebug('Plot resized successfully');
            } catch (error) {
              console.error('Error resizing plot:', error);
            }
          } else {
            logDebug('Plot not ready for resize');
          }
        }
      });
      
      // 컨테이너 관찰 시작
      this.resizeObserver.observe(container);
      logDebug('ResizeObserver setup complete');
    },

    // 3D 시각화 생성 함수 추가
    createVisualization() {
      logDebug('Creating 3D visualization');
      
      // 시각화 컨테이너 요소 선택
      const container = document.getElementById('plotly-visualization');
      if (!container) {
        logDebug('Visualization container not found');
        return;
      }
      
      // 컨테이너 크기 확인
      if (container.clientWidth === 0 || container.clientHeight === 0) {
        logDebug('Container has zero dimensions, delaying visualization creation');
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
          aspectratio: { x: 1, y: 1, z: 1 }
        },
        showlegend: false,
        hovermode: 'closest',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        autosize: true,
        width: container.clientWidth,
        height: container.clientHeight
      };
      
      // Plotly 옵션 설정
      const config = {
        responsive: true,
        displayModeBar: false
      };
      
      // 그래프 초기화
      try {
        // 이미 생성된 플롯이 있으면 제거
        if (container.innerHTML !== '') {
          window.Plotly.purge(container);
        }
        
        // 새 플롯 생성
        window.Plotly.newPlot(container, emptyData, layout, config)
          .then(() => {
            logDebug('Initial empty visualization created successfully');
            // 빈 플롯 참조 저장
            this.plot = container;
          })
          .catch(error => {
            console.error('Error creating initial visualization:', error);
          });
      } catch (error) {
        console.error('Error creating Plotly visualization:', error);
      }
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
      return `http://localhost:8091/images/${encodeURIComponent(filename)}`;
    },

    // 벡터 데이터 처리 함수
    processVectorData(vectors, labels) {
      logDebug(`Processing vector data: ${vectors.length} vectors, ${labels?.length || 0} labels`);
      
      // 유효성 검사
      if (!vectors || vectors.length === 0) {
        this.displayErrorMessage('유효한 벡터 데이터가 없습니다.');
        return;
      }
      
      // 벡터와 레이블 저장 (원본 이미지 파일명 보존)
      this.vectors = vectors;
      
      // 라벨 확인 - 콘솔에 출력해서 실제 이미지 파일명 확인
      console.log('Original labels received:', labels);
      
      if (labels && Array.isArray(labels) && labels.length > 0) {
        this.labels = labels;
        logDebug(`Using ${labels.length} original image labels`);
      } else {
        // 라벨이 없는 경우에만 생성
        this.labels = Array(vectors.length).fill().map((_, i) => `fallback_${i+1}`);
        logDebug('No labels provided, using fallback labels');
      }
      
      this.imageLabels = [...this.labels]; // 레이블 복사본 생성
      
      // 3D 투영을 위한 마커 스타일 초기화
      this.initializeMarkerStyles();
      
      try {
        // 3D PCA를 사용하여 벡터 투영
        this.projectedVectors = this.projectVectorsWith3DPCA(vectors);
        
        if (!this.projectedVectors || this.projectedVectors.length === 0) {
          logDebug('Failed to project vectors, cannot visualize');
          this.displayErrorMessage('벡터 데이터를 시각화할 수 없습니다.');
          return;
        }
        
        // Plotly 데이터 준비
        this.createPlot();
        
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
      // 절대로 다른 이벤트를 유발하지 않게 단순화
      if (index < 0 || index >= this.labels.length || this.isSelectingImageFlag) {
        return;
      }
      
      this.isSelectingImageFlag = true;
      
      try {
        // 데이터만 업데이트
        this.selectedIndex = index;
        this.selectedFilename = this.labels[index];
        
        // 유사 이미지 찾기는 별도 함수에서 실행
        this.processSelectedImage();
      } catch (error) {
        console.error('Error selecting image:', error);
      } finally {
        // 플래그는 processSelectedImage에서 해제
      }
    },
    
    // 선택된 이미지 처리 - 완전 분리된 함수로 구현
    processSelectedImage() {
      if (!this.selectedFilename) {
        this.isSelectingImageFlag = false;
        return;
      }
      
      // 재진입 방지를 위해 로컬 변수로 저장
      const filename = this.selectedFilename;
      const index = this.selectedIndex;
      
      // UI 업데이트
      this.updatePlotMarkers(index);
      
      // 실제 API 호출은 타이머로 분리해서 실행
      setTimeout(() => {
        // 유사 이미지 검색
        this.findSimilarImagesForIndex(index, filename);
      }, 100);
    },
    
    // 별도 함수로 유사 이미지 검색을 분리
    findSimilarImagesForIndex(index, filename) {
      if (!filename) return;
      
      logDebug(`Finding similar images for index ${index}: ${filename}`);
      this.isProcessing = true;
      this.loadingMessage = '유사 이미지 검색 중...';
      
      // API 엔드포인트로 요청
      const apiUrl = `http://localhost:8000/api/similar-images/${encodeURIComponent(filename)}`;
      
      // 로컬 변수로 현재 요청 추적
      const requestId = Date.now();
      this.lastSimilarImagesRequestId = requestId;
      
      fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      })
      .then(response => {
        // 지연된 응답 무시
        if (this.lastSimilarImagesRequestId !== requestId) {
          return null;
        }
        
        if (!response.ok) {
          throw new Error(`API returned status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        // 지연된 응답 또는 취소된 요청 무시
        if (!data || this.lastSimilarImagesRequestId !== requestId) {
          return;
        }
        
        if (data.status === 'success' && data.similar_images && data.similar_images.length > 0) {
          const topSimilarImages = data.similar_images.slice(0, 4).map(item => ({
            filename: item.filename,
            similarity: item.similarity,
            url: this.getImageUrl(item.filename)
          }));
          
          this.similarImages = topSimilarImages;
        } else {
          this.similarImages = [];
          if (data.status === 'error') {
            this.displayErrorMessage(data.message || '유사 이미지를 찾을 수 없습니다');
          }
        }
      })
      .catch(error => {
        console.error('Error finding similar images:', error);
        this.displayErrorMessage('유사 이미지 검색 중 오류가 발생했습니다');
        this.similarImages = [];
      })
      .finally(() => {
        this.isProcessing = false;
        // 이제 플래그 해제
        this.isSelectingImageFlag = false;
      });
    },
    
    // 플롯 마커만 업데이트 - Plotly 의존성 최소화
    updatePlotMarkers(selectedIndex) {
      try {
        const container = document.getElementById('plotly-visualization');
        if (!container) return;
        
        // 새 색상과 크기 배열 생성
        const colors = Array(this.projectedVectors.length).fill('rgba(169, 169, 169, 0.7)');
        const sizes = Array(this.projectedVectors.length).fill(6);
        
        // 선택된 점만 강조
        if (selectedIndex >= 0 && selectedIndex < colors.length) {
          colors[selectedIndex] = 'rgba(255, 0, 0, 0.8)';
          sizes[selectedIndex] = 12;
        }
        
        // 단일 업데이트
        Plotly.restyle(container, {
          'marker.color': [colors],
          'marker.size': [sizes]
        }, [0]);
      } catch (error) {
        console.error('Error updating markers:', error);
      }
    },

    // 이미지 업데이트 핸들러 (다른 컴포넌트에서 이미지 데이터 수신)
    handleImageUpdate(event) {
      logDebug('Received image update event from another component');
      
      try {
        // 이벤트에서 이미지 데이터 추출
        const imageData = event.detail || event;
        logDebug('Image data received:', imageData);
        
        // 이미지 데이터가 없으면 반환
        if (!imageData || (!imageData.url && !imageData.imageUrl)) {
          logDebug('Invalid image data received');
          return;
        }
        
        // 처리 중 표시 업데이트
        this.isProcessing = true;
        this.loadingMessage = '이미지 처리 중...';
        
        // 새 이미지 레퍼런스 저장
        this.lastImageData = {
          url: imageData.url || imageData.imageUrl,
          name: imageData.name || imageData.imageName || this.getImageNameFromUrl(imageData.url || imageData.imageUrl),
          timestamp: new Date().getTime(),
          source: imageData.source || 'external'
        };
        
        // 0.5초 지연 후 이미지 처리 (연속적인 이벤트 방지)
        setTimeout(() => {
          this.processNewImage(this.lastImageData);
        }, 500);
      } catch (error) {
        console.error('Error handling image update:', error);
        this.showMessage('이미지 업데이트 처리 중 오류가 발생했습니다', 'error');
        this.isProcessing = false;
      }
    },

    // 새 이미지 처리 함수
    processNewImage(imageData) {
      logDebug('Processing new image:', imageData);
      
      if (!imageData || (!imageData.url && !imageData.imageUrl)) {
        logDebug('Invalid image data received');
        this.isProcessing = false;
        return;
      }
      
      // URL 정보 추출
      const imageUrl = imageData.url || imageData.imageUrl;
      const imageName = imageData.name || imageData.imageName || this.getImageNameFromUrl(imageUrl);
      
      logDebug(`Processing image: ${imageName} (${imageUrl})`);
      this.loadingMessage = '이미지 처리 중...';
      this.isProcessing = true;
      
      // 벡터 데이터 확인
      this.checkVectorsData()
        .then(() => {
          // 이미지에 해당하는 인덱스 찾기
          const imageIndex = this.labels.findIndex(label => label === imageName);
          
          if (imageIndex !== -1) {
            logDebug(`Found image in dataset at index ${imageIndex}: ${imageName}`);
            // 해당 이미지 선택
            this.selectImage(imageName);
          } else {
            logDebug(`Image not found in dataset: ${imageName}`);
            this.showMessage(`데이터셋에서 이미지를 찾을 수 없습니다: ${imageName}`, 'warning');
            this.isProcessing = false;
          }
        })
        .catch(error => {
          console.error('Error during image processing:', error);
          this.displayErrorMessage('이미지 처리 중 오류가 발생했습니다');
          this.isProcessing = false;
        });
    },

    // 이미지 오류 처리 함수
    handleImageError(event) {
      const img = event.target;
      logDebug(`Image loading error for: ${img.alt || 'unknown image'}`);
      
      // 이미지 소스 URL에서 파일명 추출
      const filename = img.alt || this.getImageNameFromUrl(img.src);
      
      // 오류 메시지 표시
      this.displayErrorMessage(`이미지 로딩 실패: ${filename}`);
      
      // 이미지에 오류 스타일 적용
      img.classList.add('image-error');
      
      // 기본 오류 이미지로 대체 (선택 사항)
      // img.src = '/images/image-error.png';
    },

    // 선택된 이미지의 3D 좌표 반환
    getSelectedImageCoordinates() {
      if (this.selectedIndex >= 0 && this.selectedIndex < this.projectedVectors.length) {
        return this.projectedVectors[this.selectedIndex].map(val => val.toFixed(4));
      }
      return ['0.0000', '0.0000', '0.0000'];
    },

    // Plotly 스타일 업데이트
    updatePlotStyles() {
      logDebug('Updating plot styles');
      
      const container = document.getElementById('plotly-visualization');
      if (!container) {
        logDebug('Plot container not found');
        return;
      }

      try {
        // 스타일 업데이트를 위한 데이터 준비
        const update = {
          'marker.size': [this.markerSizes],
          'marker.color': [this.markerColors]
        };

        // 단일 Plotly.restyle 호출로 모든 스타일 업데이트
        Plotly.restyle(container, update, [0]).catch(error => {
          console.error('Error in Plotly.restyle:', error);
        });
      } catch (error) {
        console.error('Error updating plot styles:', error);
      }
    },

    async initializePlot() {
      logDebug('Initializing plot');
      const container = document.getElementById('plotly-visualization');
      if (!container || !this.vectors || this.vectors.length === 0) return;

      try {
        await Plotly.newPlot(container, this.plotlyData, this.plotLayout, this.plotConfig);
        
        // 이벤트 리스너 등록
        container.on('plotly_click', this.handlePlotClick);
      } catch (error) {
        console.error('Error initializing plot:', error);
      }
    },

    async loadSimilarImages(index) {
      if (index >= 0 && index < this.labels.length) {
        const filename = this.labels[index];
        await this.findSimilarImages(filename);
      }
    },

    // 이미지 파일명으로 선택하는 함수 (외부 호출용)
    selectImage(filename) {
      logDebug(`Selecting image by filename: ${filename}`);
      
      if (!filename) {
        logDebug('No filename provided');
        return;
      }
      
      // 중복 선택 방지 플래그 설정
      if (this.isSelectingImageFlag) {
        logDebug('Already in image selection process, ignoring');
        return;
      }
      
      this.isSelectingImageFlag = true;
      
      try {
        // 입력된 파일명에서 타임스탬프 제거
        const normalizedFilename = this.normalizeImageName(filename);
        
        logDebug(`Normalized filename: ${normalizedFilename}`);
        
        // 파일명으로 인덱스 찾기 (정규화된 이름 기준)
        let index = -1;
        
        for (let i = 0; i < this.labels.length; i++) {
          if (this.normalizeImageName(this.labels[i]) === normalizedFilename) {
            index = i;
            break;
          }
        }
        
        if (index === -1) {
          logDebug(`No image found with filename: ${normalizedFilename}`);
          this.displayErrorMessage(`이미지를 찾을 수 없습니다: ${normalizedFilename}`);
          return;
        }
        
        // 인덱스 기반 선택 함수 호출
        this.selectImageByIndex(index);
      } catch (error) {
        console.error('Error in selectImage:', error);
        this.isSelectingImageFlag = false;
      }
    },

    createPlot() {
      logDebug('Creating plot with projected vector data');
      
      const container = document.getElementById('plotly-visualization');
      if (!container || !this.projectedVectors || this.projectedVectors.length === 0) {
        logDebug('Cannot create plot: container or data missing');
        return;
      }
      
      try {
        // 기존 플롯 제거
        Plotly.purge(container);
        
        // 컨테이너 크기 고정 (300px)
        const containerHeight = 300;
        logDebug(`Plot container height set to: ${containerHeight}px`);
        
        // 3D 포인트 데이터 준비 - 깊은 복사
        const x = [...this.projectedVectors.map(v => v[0])];
        const y = [...this.projectedVectors.map(v => v[1])];
        const z = [...this.projectedVectors.map(v => v[2])];
        
        // 비반응형 데이터로 플롯 생성
        const plotData = [{
          type: 'scatter3d',
          mode: 'markers',
          x: x,
          y: y,
          z: z,
          text: [...this.labels],
          hoverinfo: 'text',
          marker: {
            size: 6,
            color: 'rgba(169, 169, 169, 0.7)',
            opacity: 0.8,
            line: {
              color: 'rgba(0,0,0,0.2)',
              width: 0.5
            }
          }
        }];
        
        const layout = {
          margin: { l: 0, r: 0, b: 0, t: 0 },
          scene: {
            xaxis: { title: '', showgrid: true, zeroline: true },
            yaxis: { title: '', showgrid: true, zeroline: true },
            zaxis: { title: '', showgrid: true, zeroline: true },
            camera: {
              eye: { x: 1.5, y: 1.5, z: 1.5 }
            }
          },
          showlegend: false,
          hovermode: 'closest',
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
          autosize: false, // 자동 크기 조정 사용하지 않음
          width: container.clientWidth,
          height: containerHeight // 고정 높이 300px
        };
        
        const config = {
          responsive: true,
          displayModeBar: true,
          displaylogo: false,
          modeBarButtonsToRemove: ['toImage', 'sendDataToCloud'],
          // 아이콘 크기 조정 옵션
          modeBarButtonsToAdd: [{
            name: 'Reset',
            click: function(gd) {
              Plotly.relayout(gd, {
                'scene.camera': layout.scene.camera
              });
            }
          }]
        };

        // this 컨텍스트 저장 (먼저 선언)
        const self = this;

        // 새 플롯 생성
        Plotly.newPlot(container, plotData, layout, config).then(() => {
          logDebug('Plot created successfully');
          
          // 모드바 스타일 수정
          this.fixModeBarStyle();
          
          // 클릭 이벤트 핸들러는 하나만 등록 - Plotly 방식으로
          container.on('plotly_click', function(eventData) {
            // 이미 처리 중이면 중복 실행 방지
            if (self.isSelectingImageFlag) {
              logDebug('Already processing, skipping click');
              return;
            }
            
            if (eventData && eventData.points && eventData.points.length > 0) {
              const point = eventData.points[0];
              const index = point.pointNumber;
              
              if (index >= 0 && index < self.labels.length) {
                // 이벤트 루프 분리해서 처리
                setTimeout(() => {
                  self.selectImageByIndex(index);
                }, 0);
              }
            }
          });
          
          // 초기 선택 포인트가 있으면 강조
          if (this.selectedIndex >= 0) {
            this.updatePlotMarkers(this.selectedIndex);
          }
        });

      } catch (error) {
        console.error('Error in createPlot:', error);
        this.displayErrorMessage('그래프 생성 중 오류가 발생했습니다');
      }
    },
    
    // 모드바 스타일 수정 함수
    fixModeBarStyle() {
      setTimeout(() => {
        const modeBar = document.querySelector('.modebar');
        if (modeBar) {
          // 모드바 스타일 축소
          modeBar.style.cssText = 'transform: scale(0.6); transform-origin: top right;';
          
          // 모드바 버튼 스타일 축소
          const buttons = modeBar.querySelectorAll('.modebar-btn');
          buttons.forEach(btn => {
            btn.style.cssText = 'width: 24px; height: 24px;';
            
            // SVG 아이콘 크기 조정
            const svg = btn.querySelector('svg');
            if (svg) {
              svg.style.cssText = 'width: 16px; height: 16px;';
            }
          });
        }
      }, 100); // 플롯 렌더링 후 실행
    },

    async showImageDetailsPopup(filename) {
      this.popupImageUrl = this.getImageUrl(filename);
      this.popupImageFilename = filename;
      
      // 워크플로우 데이터 확인
      try {
        // 이미지 해시 계산 (해시 계산 함수가 없으면 백엔드에 직접 요청하는 방식으로 대체)
        const imageHash = await this.calculateImageHash(this.popupImageUrl);
        
        // 워크플로우 데이터 조회
        const response = await fetch(`http://localhost:8000/api/lcnc/get-workflow-by-hash/${imageHash}`);
        
        if (response.ok) {
          const result = await response.json();
          if (result.status === 'success' && result.data) {
            this.popupWorkflowData = result.data;
            logDebug('워크플로우 데이터 로드 완료:', this.popupWorkflowData);
          } else {
            this.popupWorkflowData = null;
          }
        } else {
          this.popupWorkflowData = null;
        }
      } catch (error) {
        console.error('워크플로우 데이터 조회 오류:', error);
        this.popupWorkflowData = null;
      }
      
      this.showImagePopup = true;
    },

    closeImagePopup() {
      this.showImagePopup = false;
      this.popupWorkflowData = null;
    },

    // 이미지 해시 계산 (대략적인 구현)
    async calculateImageHash(imageUrl) {
      try {
        // 이미지 바이너리 데이터 가져오기
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        
        // ArrayBuffer로 변환
        const arrayBuffer = await blob.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        
        // 16진수 문자열로 변환
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        return hashHex;
      } catch (error) {
        console.error('이미지 해시 계산 오류:', error);
        // 오류 발생 시 간단한 해시 대체
        return `hash_${this.popupImageFilename.replace(/\W+/g, '_')}`;
      }
    },

    sendImageToLCNC() {
      if (!this.popupImageUrl || !this.popupImageFilename) {
        this.showMessage('전송할 이미지 정보가 없습니다.', 'error');
        return;
      }
      
      // 커스텀 이벤트 생성하여 MSA5에 이미지 데이터 전송
      const imageData = {
        imageUrl: this.popupImageUrl,
        imageTitle: this.popupImageFilename
      };
      
      // 이벤트 생성 및 발송
      const event = new CustomEvent('msa4-to-msa5-image', {
        detail: imageData,
        bubbles: true
      });
      document.dispatchEvent(event);
      
      // 메시지 표시
      this.showMessage('이미지가 MSA5로 전송되었습니다.', 'success');
      
      // 팝업 닫기
      this.closeImagePopup();
    },

    loadWorkflowToLCNC() {
      if (!this.popupWorkflowData) {
        this.showMessage('워크플로우 데이터가 없습니다.', 'error');
        return;
      }
      
      // 이미지 전송과 함께 워크플로우 데이터도 전송
      const imageData = {
        imageUrl: this.popupImageUrl,
        imageTitle: this.popupImageFilename,
        workflowData: this.popupWorkflowData
      };
      
      // 이벤트 생성 및 발송
      const event = new CustomEvent('msa4-to-msa5-workflow', {
        detail: imageData,
        bubbles: true
      });
      document.dispatchEvent(event);
      
      // 메시지 표시
      this.showMessage('워크플로우가 MSA5로 전송되었습니다.', 'success');
      
      // 팝업 닫기
      this.closeImagePopup();
    },

    // MSA5에서 유사 이미지 결과 처리
    handleSimilarImagesFromMSA5(event) {
      logDebug('Received similar images from MSA5:', event.detail);
      
      const data = event.detail;
      if (!data || !data.originalImage || !data.similarImages) {
        logDebug('Invalid similar images data received from MSA5');
        return;
      }
      
      // 원본 이미지 정보 저장
      this.selectedFilename = data.originalImage.filename;
      
      // 유사 이미지 처리
      const processedSimilarImages = data.similarImages.map(img => ({
        filename: img.filename,
        similarity: img.similarity * 100, // 0~1 값을 퍼센트로 변환
        url: img.url || this.getImageUrl(img.filename)
      }));
      
      // 유사 이미지 업데이트
      this.similarImages = processedSimilarImages;
      
      // 메시지 표시
      this.showMessage('MSA5에서 유사 이미지 결과를 수신했습니다', 'success');
    }
  }
}
</script>

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
  background-color: rgba(0, 0, 0, 0.02);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
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
}

.header-left i {
  color: #555;
}

.content-container {
  display: flex !important;
  flex-direction: column !important;
  height: calc(100% - 48px) !important;
  width: 100% !important;
  overflow: hidden !important;
  position: relative !important;
  flex: 1 1 auto !important; 
}

.plot-container {
  height: 300px !important;
  min-height: 300px !important;
  max-height: 300px !important;
  width: 100% !important;
  position: relative !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
  flex: 0 0 300px !important;
  flex-shrink: 0 !important;
  flex-grow: 0 !important;
}

#plotly-visualization {
  width: 100% !important;
  height: 300px !important;
  min-height: 300px !important;
  max-height: 300px !important;
  flex: 1 !important;
}

.image-section {
  position: relative !important;
  height: calc(100% - 300px) !important;
  max-height: calc(100% - 300px) !important;
  width: 100% !important;
  background-color: #f8f9fa;
  flex: 1 1 auto !important;
  overflow: hidden !important;
  display: flex !important;
  flex-direction: column !important;
}

/* 스크롤 가능한 내부 컨테이너 */
.scrollable-content {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  height: 100% !important;
  width: 100% !important;
  overflow-y: scroll !important; /* 항상 스크롤바 표시 */
  overflow-x: hidden !important;
  padding: 20px !important;
  box-sizing: border-box !important;
}

/* 선택된 이미지 섹션 */
.selected-image-section {
  margin-bottom: 20px !important;
  width: 100% !important;
}

.selected-image-section h3 {
  font-size: 18px !important;
  margin-bottom: 15px !important;
  color: #333 !important;
}

.selected-image-wrapper {
  display: flex !important;
  justify-content: center !important;
  margin-bottom: 20px !important;
}

/* 클릭 가능한 이미지 스타일 */
.clickable {
  cursor: pointer;
  transition: transform 0.2s;
}

.clickable:hover {
  transform: scale(1.03);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

/* 이미지 상세 팝업 스타일 */
.image-detail-popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(3px);
}

.image-detail-popup {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: popup-fade-in 0.3s ease-out;
}

@keyframes popup-fade-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid #eee;
}

.popup-header h3 {
  font-size: 18px;
  margin: 0;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #777;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #333;
}

.popup-content {
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.image-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.popup-image {
  max-width: 100%;
  max-height: 400px;
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
}

.image-title {
  font-size: 14px;
  color: #666;
  text-align: center;
  word-break: break-all;
}

.popup-actions {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 10px 15px;
  border-radius: 4px;
  border: none;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.import-btn {
  background-color: #8b5cf6;
  color: white;
}

.import-btn:hover {
  background-color: #7c3aed;
}

.view-btn {
  background-color: #10b981;
  color: white;
}

.view-btn:hover {
  background-color: #059669;
}

.workflow-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-top: 1px solid #eee;
  padding-top: 15px;
  margin-top: 5px;
}

.workflow-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background-color: #f3f4f6;
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 13px;
  color: #374151;
  width: fit-content;
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
</style>

<!-- MSA4 컴포넌트 추가 스타일 (전역) -->
<style>
/* 전역 스타일 - 더 강력한 선택자 사용 */
body .msa-card, 
body .msa4, 
body .msa-grid, 
body [class*="msa"] {
  height: 100% !important;
  max-height: 100% !important;
  width: 100% !important;
  overflow: hidden !important;
}

/* Plotly 요소 크기 제한 */
body .js-plotly-plot, 
body .plotly, 
body .plot-container {
  width: 100% !important;
  height: 300px !important;
  max-height: 300px !important;
}

/* 3D 시각화 영역은 300px 높이로 고정 */
body #plotly-visualization, 
body .plot-container {
  height: 300px !important;
  max-height: 300px !important;
  min-height: 300px !important;
  flex: 0 0 300px !important;
  overflow: hidden !important;
  flex-shrink: 0 !important;
}

/* 모드바 스타일 축소 */
body .modebar {
  transform: scale(0.6) !important;
  transform-origin: top right !important;
}

body .modebar-btn {
  width: 24px !important;
  height: 24px !important;
}

body .modebar-btn svg {
  width: 16px !important;
  height: 16px !important;
}

/* 스크롤바 스타일 지정 */
body .scrollable-content::-webkit-scrollbar {
  width: 8px !important;
}

body .scrollable-content::-webkit-scrollbar-track {
  background: #f1f1f1 !important;
  border-radius: 4px !important;
}

body .scrollable-content::-webkit-scrollbar-thumb {
  background: #888 !important;
  border-radius: 4px !important;
}

body .scrollable-content::-webkit-scrollbar-thumb:hover {
  background: #555 !important;
}

/* 전역 스타일 오버라이드 방지 */
body .msa-component * {
  box-sizing: border-box !important;
}

/* 부모 요소 강제 제한 */
html body .msa-component,
html body .content-container {
  max-height: 100vh !important;
  overflow: hidden !important;
}

/* 스크롤 영역 강제 설정 */
html body .scrollable-content {
  max-height: 100% !important;
  height: 100% !important;
  overflow-y: scroll !important;
  -webkit-overflow-scrolling: touch !important;
}
</style> 