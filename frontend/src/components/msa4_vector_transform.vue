<template>
  <div class="msa-component">
    <div class="component-header">
      <div class="header-left">
        <i class="fas fa-network-wired"></i>
        <span>유사 이미지 검색</span>
      </div>
      <div class="header-right" v-if="showDebugControls">
        <button @click="testMSA5Communication" class="debug-button">MSA5 통신 테스트</button>
      </div>
    </div>

    <div class="status-message" v-if="message.show">
      <i :class="message.icon"></i>
      <span>{{ message.text }}</span>
    </div>

    <!-- MSA5 통신 알림 -->
    <div class="msa5-communication-indicator" v-if="msa5MessageActive">
      <i class="fas fa-exchange-alt"></i>
      <span>MSA5로 이미지 전송됨</span>
    </div>

    <div class="content-container">
      <div class="visualization-container">
        <!-- 3D 그래프 항상 표시 -->
        <div id="plotly-visualization" class="plot-container"></div>
        
        <!-- 선택된 이미지가 있을 경우 -->
        <div class="image-section" v-if="selectedPoint">
          <div class="selected-image">
            <h3>선택된 이미지</h3>
            <div class="image-info">
              <img :src="getImageUrl(selectedPoint)" :alt="selectedPoint" class="preview-image">
              <p>{{ selectedPoint }}</p>
            </div>
          </div>
          <div class="similar-images" v-if="similarImages.length">
            <h3>유사 이미지 (유사도 순)</h3>
            <div class="similar-list">
              <div v-for="(image, index) in similarImages" :key="index" class="similar-item">
                <img :src="getImageUrl(image.filename)" :alt="image.filename" class="preview-image">
                <div class="similar-item-info">
                  <p>{{ image.filename }}</p>
                  <span class="similarity-score">
                    유사도: {{ image.similarity.toFixed(3) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 이미지가 선택되지 않았을 때 숨겨진 안내 메시지 -->
        <div class="image-section empty-image-section" v-if="!selectedPoint">
          <div class="paste-image-prompt">
            <div class="image-icon-wrapper">
              <i class="fas fa-cloud-upload-alt"></i>
              <i class="fas fa-image"></i>
            </div>
            <h3>이미지를 추가하세요</h3>
            <p>Ctrl+V로 붙여넣거나 이미지를 드래그하세요</p>
          </div>
        </div>
      </div>
    </div>
    
    <div class="loading-container" v-if="isProcessing">
      <div class="loading-spinner"></div>
      <p>{{ loadingMessage }}</p>
    </div>

    <!-- 이벤트 통신용 숨겨진 overlay 추가 -->
    <div class="component-event-bridge"></div>
  </div>
</template>

<script>
import Plotly from 'plotly.js-dist';
// import axios from 'axios'; // 사용하지 않음 - API 호출 제거됨
// Vue 3에서 이벤트 버스 구현이 필요하면 mitt 라이브러리 설치 필요
// import mitt from 'mitt'; // npm install mitt

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
      vectors: [],
      labels: [],
      selectedPoint: null,
      similarImages: [],
      isProcessing: false,
      isDataLoaded: false,
      selectedIndex: -1,
      markerColors: [],
      markerSizes: [],
      message: {
        show: false,
        text: '',
        icon: 'fas fa-info-circle',
        type: 'info'
      },
      loadingMessage: '데이터 처리 중...',
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
      showDebugControls: true, // 디버그 컨트롤 표시
      currentImage: null,
      showStatusMessage: false,
      statusMessage: ''
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
      logDebug('Checking vectors data from backend');
      try {
        this.isProcessing = true;
        this.loadingMessage = '벡터 데이터 로드 중...';
        
        const response = await fetch('http://localhost:8000/api/msa4/vectors');
        const data = await response.json();
        
        logDebug('Vectors API response status:', data.status);
        logDebug('Vector count:', data.vectors?.length || 0);
        
        if (data.status === 'success' && data.vectors && data.vectors.length > 0) {
          this.vectors = data.vectors;
          this.labels = data.metadata;
          
          logDebug('Vectors loaded successfully. Labels:', this.labels.length);
          this.showMessage('벡터 데이터 로드 완료', 'success');
          
          // 3D 그래프 초기화는 하지만 이미지 선택은 하지 않음
          this.createVisualization();
        } else {
          if (data.message) {
            logDebug('Warning from vectors API:', data.message);
            this.showMessage(data.message, 'warning');
          }
          
          // 데이터가 없어도 3D 그래프 초기화 (빈 그래프)
          this.vectors = [];
          this.labels = [];
          logDebug('No vectors available, initializing empty visualization');
          this.createVisualization();
        }
      } catch (error) {
        logDebug('Error checking vector data:', error);
        this.showMessage('데이터 로드 오류가 발생했습니다', 'error');
        
        // 오류가 발생해도 3D 그래프 초기화 (빈 그래프)
        this.vectors = [];
        this.labels = [];
        this.createVisualization();
      } finally {
        this.isProcessing = false;
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
      } finally {
        this.isProcessing = false;
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
      if (!this.vectors) {
        this.markerColors = [];
        this.markerSizes = [];
        return;
      }
      
      this.markerColors = new Array(this.vectors.length).fill('rgba(169, 169, 169, 0.3)');
      this.markerSizes = new Array(this.vectors.length).fill(10);
    },
    
    projectVectors() {
      console.log('Projecting vectors to 3D space...');
      if (!this.vectors || this.vectors.length === 0) {
        console.error('No vectors to project');
        // 기본 더미 벡터 생성
        return this.createDummyProjections();
      }
      
      const projectedVectors = this.vectors.map(vec => {
        // 벡터가 비어있거나 무효한 경우 기본값 사용
        if (!vec || !Array.isArray(vec) || vec.length === 0) {
          return [Math.random(), Math.random(), Math.random()];
        }
        
        // 벡터를 3개의 그룹으로 나누기
        const groupSize = Math.floor(vec.length / 3);
        const groups = [
          vec.slice(0, groupSize),
          vec.slice(groupSize, 2 * groupSize),
          vec.slice(2 * groupSize)
        ];
        
        // 각 그룹의 평균 계산
        return groups.map(group => 
          group.length > 0 ? group.reduce((sum, val) => sum + val, 0) / group.length : Math.random()
        );
      });

      // 프로젝션이 비어있는 경우 더미 데이터 반환
      if (projectedVectors.length === 0) {
        return this.createDummyProjections();
      }

      // 정규화
      const dimensions = [0, 1, 2].map(dim => ({
        min: Math.min(...projectedVectors.map(v => v[dim] || 0)),
        max: Math.max(...projectedVectors.map(v => v[dim] || 0))
      }));

      return projectedVectors.map(vec => 
        vec.map((val, i) => {
          const min = dimensions[i].min;
          const max = dimensions[i].max;
          // 분모가 0이 되는 것 방지
          return max > min ? (val - min) / (max - min) : Math.random();
        })
      );
    },
    
    // 기본 더미 프로젝션 생성
    createDummyProjections() {
      console.log('Creating dummy projections');
      const dummyPoints = 10;
      const projections = [];
      
      // 기본 축 및 원점 추가
      projections.push([0.5, 0.5, 0.5]); // 원점
      projections.push([1.0, 0.5, 0.5]); // X축
      projections.push([0.5, 1.0, 0.5]); // Y축
      projections.push([0.5, 0.5, 1.0]); // Z축
      
      // 랜덤 포인트 추가
      for (let i = 0; i < dummyPoints; i++) {
        projections.push([
          Math.random(),
          Math.random(),
          Math.random()
        ]);
      }
      
      // 데이터가 없는 경우 라벨도 업데이트
      if (!this.labels || this.labels.length === 0) {
        this.labels = [
          'origin.jpg',
          'x_axis.jpg',
          'y_axis.jpg',
          'z_axis.jpg'
        ];
        
        for (let i = 0; i < dummyPoints; i++) {
          this.labels.push(`sample_image_${i+1}.jpg`);
        }
      }
      
      return projections;
    },
    
    calculate3DDistance(point1, point2) {
      return Math.sqrt(
        Math.pow(point1[0] - point2[0], 2) +
        Math.pow(point1[1] - point2[1], 2) +
        Math.pow(point1[2] - point2[2], 2)
      );
    },
    
    async getSimilarImages(imageName) {
      logDebug('Getting similar images for:', imageName);
      try {
        const response = await fetch(`http://localhost:8000/api/msa4/similar-images/${encodeURIComponent(imageName)}`);
        const data = await response.json();
        
        if (data.status === 'success') {
          // 유사도에 따라 내림차순 정렬하여 가장 유사한 순서대로 표시
          const sortedImages = data.similar_images.sort((a, b) => b.similarity - a.similarity);
          
          // 완전히 다른 이미지만 표시 (선택된 이미지와 같은 파일명을 가진 이미지 제외)
          const filteredImages = sortedImages.filter(img => img.filename !== imageName);
          
          logDebug(`Found ${filteredImages.length} similar images (excluded ${sortedImages.length - filteredImages.length} with same filename)`);
          logDebug('First few similar images:', filteredImages.slice(0, 3));
          
          return filteredImages;
        } else {
          logDebug('Error getting similar images:', data.message);
          return [];
        }
      } catch (error) {
        logDebug('Error fetching similar images:', error);
        return [];
      }
    },
    
    async selectImage(index) {
      if (!this.vectors || !this.vectors.length || index === undefined || index < 0) {
        logDebug('Invalid image index for selection:', index);
        return;
      }
      
      if (index === this.selectedIndex) {
        logDebug('Image already selected, index:', index);
        return;
      }
      
      logDebug('Selecting image at index:', index, 'label:', this.labels[index]);
      
      this.selectedIndex = index;
      this.selectedPoint = this.labels[index];
      
      // 마커 스타일 초기화
      this.initializeMarkerStyles();
      
      // 선택된 이미지 스타일 업데이트
      this.markerColors[index] = 'rgb(50, 205, 50)';
      this.markerSizes[index] = 20;
      
      // 유사 이미지 가져오기
      this.isProcessing = true;
      this.loadingMessage = '유사 이미지 검색 중...';
      
      // 이미지 선택 시 isDataLoaded를 true로 설정
      this.isDataLoaded = true;
      
      try {
        logDebug('Fetching similar images for:', this.labels[index]);
        this.getSimilarImages(this.labels[index]).then(similarImages => {
          this.similarImages = similarImages;
          logDebug('Similar images loaded:', this.similarImages.length);
          
          // 유사한 이미지들의 마커 스타일 업데이트
          this.similarImages.forEach((image, i) => {
            const intensity = Math.round(255 * (1 - (5 - i) / 5));
            const idx = image.index;
            if (idx !== undefined && idx >= 0) {
              this.markerColors[idx] = `rgb(${intensity}, 65, 54)`;
              this.markerSizes[idx] = Math.max(15, 20 * (1 - i / 5));
            }
          });
          
          this.isProcessing = false;
          
          // 마커 스타일 업데이트
          this.updatePlotStyles();
        }).catch(error => {
          logDebug('Error getting similar images:', error);
          this.showMessage('유사 이미지 검색 중 오류가 발생했습니다', 'error');
          this.similarImages = [];
          this.isProcessing = false;
        });
      } catch (error) {
        logDebug('Error in selectImage:', error);
        this.showMessage('유사 이미지 검색 중 오류가 발생했습니다', 'error');
        this.similarImages = [];
        this.isProcessing = false;
      }
    },
    
    updatePlotStyles() {
      const plot = document.getElementById('plotly-visualization');
      if (!plot || !plot.data || !plot.data[0]) return;
      
      try {
        // 약간의 지연 후 스타일 업데이트
        setTimeout(() => {
          try {
            Plotly.restyle(plot, {
              'marker.color': [this.markerColors],
              'marker.size': [this.markerSizes]
            });
          } catch (innerError) {
            console.error('Error in delayed plot style update:', innerError);
          }
        }, 50);
      } catch (error) {
        console.error('Error updating plot styles:', error);
      }
    },
    
    // 이미지 URL 생성
    getImageUrl(imageName) {
      // Remove any newline characters from the image name
      const cleanName = imageName.replace(/\r|\n/g, '');
      
      // If the image name already contains a URL format, return it as is
      if (cleanName.startsWith('http://') || cleanName.startsWith('https://')) {
        return cleanName;
      }
      
      // Remove timestamp prefix (YYYYMMDD_HHMMSS_) if present
      const nameWithoutTimestamp = cleanName.replace(/^\d{8}_\d{6}_/, '');
      
      // Construct the URL with the cleaned name and port 8091
      return `http://127.0.0.1:8091/images/${nameWithoutTimestamp}`;
    },

    // 새 이미지 처리
    async processNewImage(imageData) {
      if (!imageData || !imageData.imageUrl) {
        logDebug('Invalid image data received in processNewImage');
        return;
      }

      try {
        const { imageUrl, imageName, source } = imageData;
        this.loadingMessage = '이미지 처리 중...';
        this.isProcessing = true;
        
        // 상태 업데이트
        this.currentImageData = imageData;
        this.selectedImageName = imageName || 'Unnamed Image';
        
        logDebug(`Processing new image: ${imageName || 'Unnamed'} from ${source || 'unknown'}`);
        
        // API 호출 없이 더미 데이터 직접 생성
        logDebug('Skipping API calls, using existing data for visualization');
        const vectorData = this.generateDummyVectorData(imageName);
        
        // 벡터 데이터 처리
        if (vectorData) {
          this.processVectorData(vectorData, imageUrl, imageName);
          
          // MSA5로 이미지 전송
          this.sendImageToMSA5(imageData);
          
          // 로딩 상태 업데이트
          this.loadingMessage = '';
          this.isProcessing = false;
          this.isDataLoaded = true;
        } else {
          throw new Error('Failed to process image vector data');
        }
        
      } catch (error) {
        logDebug(`Error in processNewImage: ${error.message}`);
        this.loadingMessage = '이미지 처리 중 오류가 발생했습니다';
        this.isProcessing = false;
        this.isDataLoaded = false;
        
        // 오류 발생해도 기본 더미 데이터로 시각화는 시도
        const dummyData = this.generateDummyVectorData(imageData.imageName);
        this.processVectorData(dummyData, imageData.imageUrl, imageData.imageName);
      }
    },
    
    // 이미지 URL을 Base64로 변환
    async convertImageUrlToBase64(url) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          
          try {
            const dataURL = canvas.toDataURL('image/jpeg');
            resolve(dataURL);
          } catch (err) {
            reject(new Error(`Failed to convert to base64: ${err.message}`));
          }
        };
        
        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };
        
        // CORS 문제 방지를 위한 프록시 사용 (필요시)
        img.src = url;
      });
    },
    
    // 더미 벡터 데이터 생성
    generateDummyVectorData(imageName) {
      const numPoints = 15; // 적당한 수의 포인트로 줄임
      const vectors = [];
      const projections = [];
      const labels = [];
      
      // 기존 데이터가 있고 이미지 이름이 제공된 경우
      if (this.projectedVectors && this.projectedVectors.length > 0 && imageName) {
        return {
          vectors: [...this.projectedVectors],
          projections: [...this.projectedVectors, [Math.random() * 0.5 + 0.25, Math.random() * 0.5 + 0.25, Math.random() * 0.5 + 0.25]],
          labels: [...this.imageLabels, imageName]
        };
      }
      
      // 기본 축과 원점 추가
      vectors.push(new Array(30).fill(0)); // 원점
      projections.push([0.5, 0.5, 0.5]);
      labels.push('origin.jpg');
      
      vectors.push(new Array(30).fill(0).map((_, i) => i < 10 ? 1 : 0)); // X축
      projections.push([1.0, 0.5, 0.5]);
      labels.push('x_axis.jpg');
      
      vectors.push(new Array(30).fill(0).map((_, i) => i >= 10 && i < 20 ? 1 : 0)); // Y축 
      projections.push([0.5, 1.0, 0.5]);
      labels.push('y_axis.jpg');
      
      vectors.push(new Array(30).fill(0).map((_, i) => i >= 20 ? 1 : 0)); // Z축
      projections.push([0.5, 0.5, 1.0]);
      labels.push('z_axis.jpg');
      
      // 랜덤 포인트 추가
      for (let i = 0; i < numPoints; i++) {
        // 30차원 랜덤 벡터 생성
        const randomVector = new Array(30).fill(0).map(() => Math.random());
        vectors.push(randomVector);
        
        // 3D 프로젝션
        const x = (Math.random() * 0.5) + 0.25;  // 0.25-0.75 범위로 제한
        const y = (Math.random() * 0.5) + 0.25;
        const z = (Math.random() * 0.5) + 0.25;
        
        projections.push([x, y, z]);
        
        // 랜덤 레이블
        labels.push(`sample_${i+1}.jpg`);
      }
      
      // 이미지 이름이 제공된 경우 추가
      if (imageName) {
        const randomVector = new Array(30).fill(0).map(() => Math.random());
        vectors.push(randomVector);
        
        // 이미지를 중앙 근처에 배치하여 가시성 향상
        projections.push([0.5, 0.5, 0.5]);
        labels.push(imageName);
      }
      
      return {
        vectors: vectors,
        projections: projections,
        labels: labels
      };
    },
    
    processVectorData(vectorData, imageUrl, imageName) {
      logDebug(`Processing vector data for image: ${imageName}`);
      
      try {
        // 벡터 데이터 포맷 분석
        let projectedVectors = [];
        let labels = [];
        
        // 다양한 API 응답 포맷 처리
        if (vectorData.projections && Array.isArray(vectorData.projections)) {
          // [x,y,z] 형식의 투영 벡터 배열
          projectedVectors = vectorData.projections;
          
          // 레이블이 있는 경우
          if (vectorData.labels && Array.isArray(vectorData.labels)) {
            labels = vectorData.labels;
          } else {
            // 레이블이 없으면 인덱스 기반 레이블 생성
            labels = projectedVectors.map((_, i) => `image_${i}.jpg`);
          }
        } else if (vectorData.projected_vectors && Array.isArray(vectorData.projected_vectors)) {
          // {x, y, z, image_name} 형식 객체 배열
          projectedVectors = vectorData.projected_vectors.map(v => [v.x, v.y, v.z]);
          labels = vectorData.projected_vectors.map(v => v.image_name || 'unknown.jpg');
        } else {
          throw new Error('Unsupported vector data format');
        }
        
        // 현재 이미지 레이블 추가 (아직 없는 경우)
        const hasCurrentImage = labels.includes(imageName);
        let currentImageIndex = labels.indexOf(imageName);
        
        if (!hasCurrentImage && imageName) {
          projectedVectors.push([0.5, 0.5, 0.5]); // 중앙에 배치하여 가시성 향상
          labels.push(imageName);
          currentImageIndex = labels.length - 1;
        }
        
        // 데이터 저장
        this.projectedVectors = projectedVectors;
        this.imageLabels = labels;
        
        // 3D 시각화 업데이트
        this.createVisualization();
        
        // 이미지 URL과 이름 저장
        this.currentImageUrl = imageUrl;
        this.currentImageName = imageName;
        
        // 자동으로 현재 이미지를 선택하고 유사 이미지 표시
        if (currentImageIndex >= 0) {
          setTimeout(() => {
            this.selectImage(currentImageIndex);
          }, 300); // 약간의 지연을 두고 이미지 선택 (시각화가 완료된 후)
        }
        
        return true;
      } catch (error) {
        logDebug(`Error processing vector data: ${error.message}`);
        return false;
      }
    },
    
    // 키보드 이벤트 처리
    handleKeyDown(event) {
      // 클립보드 이미지 붙여넣기 감지 (Ctrl+V)
      if (event.ctrlKey && event.key === 'v') {
        logDebug('Detected Ctrl+V key combination');
        this.handlePasteEvent();
      }
    },
    
    // 붙여넣기 이벤트 처리
    handlePasteEvent() {
      logDebug('Handling paste event');
      
      // 클립보드 데이터 접근 시도
      navigator.clipboard.read()
        .then(clipboardItems => {
          for (const clipboardItem of clipboardItems) {
            // 이미지 타입 확인
            if (clipboardItem.types.includes('image/png') || 
                clipboardItem.types.includes('image/jpeg')) {
              
              const imageType = clipboardItem.types.find(type => 
                type.startsWith('image/'));
              
              // 이미지 블롭 가져오기
              clipboardItem.getType(imageType)
                .then(blob => {
                  // 이미지 URL 생성
                  const imageUrl = URL.createObjectURL(blob);
                  const timestamp = Date.now();
                  const imageName = `pasted_image_${timestamp}.${imageType.split('/')[1]}`;
                  
                  logDebug(`Pasted image processed: ${imageName}`);
                  
                  // 이미지 처리
                  this.processNewImage({
                    imageUrl: imageUrl,
                    imageName: imageName,
                    source: 'clipboard-paste'
                  });
                })
                .catch(error => {
                  logDebug('Error getting clipboard image:', error);
                  this.showMessage('이미지를 가져오는 중 오류가 발생했습니다', 'error');
                });
              
              return; // 첫 번째 이미지만 처리
            }
          }
        })
        .catch(error => {
          logDebug('Error accessing clipboard:', error);
          this.showMessage('클립보드 접근 권한이 필요합니다', 'warning');
        });
    },
    
    // MSA5로 이미지 전송
    sendImageToMSA5(imageData) {
      if (!imageData || (!imageData.imageUrl && !imageData.url)) {
        logDebug('Invalid image data for MSA5');
        return;
      }
      
      // 이미지 URL과 이름 추출 (다양한 포맷 지원)
      const imageUrl = imageData.imageUrl || imageData.url;
      const imageName = imageData.imageName || imageData.name || this.getImageNameFromUrl(imageUrl);
      
      logDebug('Sending image to MSA5:', imageName);
      
      // MSA5로 이미지 직접 전송 (한 번만)
      const event = new CustomEvent('msa4-to-msa5-image', {
        detail: {
          imageUrl: imageUrl,
          imageName: imageName,
          timestamp: new Date().toLocaleTimeString()
        }
      });
      
      document.dispatchEvent(event);
      logDebug('[MSA4→MSA5] Image sent:', {
        imageName: imageName,
        timestamp: new Date().toLocaleTimeString()
      });
      
      // 통신 표시기 활성화
      this.showMSA5CommunicationIndicator();
    },
    
    // MSA5 통신 표시기 표시
    showMSA5CommunicationIndicator() {
      this.msa5MessageActive = true;
      setTimeout(() => {
        this.msa5MessageActive = false;
      }, 3000);
    },
    
    // MSA5 통신 테스트
    testMSA5Communication() {
      this.simulateMSA1ImageUpdate();
      this.showMessage('MSA5 통신 테스트 메시지 전송 완료', 'success');
    },

    // 3D 시각화 생성
    createVisualization() {
      logDebug('Creating 3D visualization');
      const plot = document.getElementById('plotly-visualization');
      
      try {
        // 항상 더미 데이터 생성 (실제 데이터가 없는 경우)
        let vectors = this.projectedVectors;
        let labels = this.imageLabels || this.labels || [];
        
        if (!vectors || vectors.length === 0) {
          logDebug('No vector data available, creating dummy visualization');
          vectors = this.createDummyProjections();
          
          // 레이블이 없으면 기본 레이블 생성
          if (!labels.length) {
            labels = Array(vectors.length).fill(0).map((_, i) => `dummy_image_${i+1}.jpg`);
          }
        }
        
        // 데이터 포맷 준비
        const x = vectors.map(p => p[0]);
        const y = vectors.map(p => p[1]);
        const z = vectors.map(p => p[2]);
        
        // 마커 스타일 초기화
        this.initializeMarkerStyles();
        
        // X, Y, Z 좌표와 이미지 파일명 표시
        const hoverText = vectors.map((p, i) => {
          const label = labels[i] || `Point ${i+1}`;
          return `Image: ${label}<br>X: ${p[0].toFixed(3)}<br>Y: ${p[1].toFixed(3)}<br>Z: ${p[2].toFixed(3)}`;
        });
        
        const data = [{
          x: x,
          y: y,
          z: z,
          mode: 'markers',
          type: 'scatter3d',
          text: hoverText,
          hoverinfo: 'text',
          marker: {
            color: this.markerColors,
            size: this.markerSizes,
            opacity: 0.8,
            line: {
              color: 'rgb(100,100,100)',
              width: 1
            }
          }
        }];
        
        const layout = {
          width: 600,
          height: 500,
          margin: { l: 0, r: 0, b: 0, t: 30 },
          title: {
            text: '이미지 벡터 시각화',
            font: { size: 16 }
          },
          scene: {
            xaxis: { title: 'X 차원', gridcolor: 'rgb(230, 230, 230)' },
            yaxis: { title: 'Y 차원', gridcolor: 'rgb(230, 230, 230)' },
            zaxis: { title: 'Z 차원', gridcolor: 'rgb(230, 230, 230)' },
            bgcolor: 'rgb(250, 250, 250)'
          },
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
          showlegend: false
        };
        
        const config = {
          displayModeBar: false,
          responsive: true
        };
        
        // 플롯 초기화
        Plotly.newPlot(plot, data, layout, config);
        
        // 클릭 이벤트 핸들러
        plot.on('plotly_click', (data) => {
          const pointIndex = data.points[0].pointNumber;
          logDebug(`Clicked on point with index: ${pointIndex}`);
          this.selectImage(pointIndex);
        });
        
        // 데이터가 로드됨 표시
        this.isDataLoaded = true;
        
      } catch (error) {
        console.error(`Error creating visualization: ${error.message}`);
        this.isDataLoaded = false;
      }
    },
    
    // 컨테이너 크기 변경 감지를 위한 ResizeObserver 설정
    setupResizeObserver() {
      const container = document.querySelector('.plot-container');
      if (!container) return;
      
      this.containerWidth = container.clientWidth;
      this.containerHeight = container.clientHeight;
      
      this.containerObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width !== this.containerWidth || height !== this.containerHeight) {
            this.containerWidth = width;
            this.containerHeight = height;
            this.updatePlotSize();
          }
        }
      });
      
      this.containerObserver.observe(container);
    },
    
    // 그래프 크기 업데이트
    updatePlotSize() {
      const plot = document.getElementById('plotly-visualization');
      if (!plot) {
        console.log('Plot element not found for resize');
        return;
      }
      
      // 그래프가 이미 초기화되었는지 확인
      if (!plot.data || !plot.layout) {
        console.log('Plot not initialized yet, skipping resize');
        return;
      }
      
      try {
        // 현재 그래프 데이터와 레이아웃을 저장
        const currentData = plot.data || [];
        const currentLayout = {...plot.layout};
        
        // width와 height만 업데이트
        currentLayout.width = this.containerWidth;
        currentLayout.height = this.containerHeight;
        
        // 제한 시간 후 다시 시도 (DOM이 완전히 업데이트된 후)
        setTimeout(() => {
          try {
            // react 메서드 사용 (relayout 대신) - 전체 그래프 다시 그리기
            Plotly.react(plot, currentData, currentLayout);
          } catch (innerError) {
            console.error('Error in delayed plot resize:', innerError);
          }
        }, 100);
      } catch (error) {
        console.error('Error updating plot size:', error);
      }
    },

    // 이미지 업데이트 핸들러
    handleImageUpdate(event) {
      logDebug('[MSA4] MSA1에서 이미지 수신:', event.detail);
      
      if (event.detail && event.detail.imageUrl) {
        // 이미지 정보 저장
        const imageData = {
          imageUrl: event.detail.imageUrl,
          imageName: event.detail.imageName || '이미지',
          timestamp: new Date().getTime(),
          source: 'MSA1'
        };
        
        // 상태 메시지 표시
        this.showMessage(`MSA1에서 이미지 수신됨: ${imageData.imageName}`, 'success');
        
        // 이미지 처리 시작
        this.isProcessing = true;
        this.loadingMessage = '이미지 분석 중...';
        
        // 약간의 지연을 두고 처리 (UI 업데이트를 위해)
        setTimeout(() => {
          this.processNewImage(imageData);
        }, 100);
      }
    },
    
    // 이미지 처리 함수
    processImage(imageData) {
      if (!imageData || !imageData.url) {
        console.error('[MSA4] 유효하지 않은 이미지 데이터:', imageData);
        return;
      }
      
      console.log(`[MSA4] 이미지 처리 시작: ${imageData.name}`);
      this.loadingMessage = '이미지 처리 중...';
      this.isProcessing = true;
      
      // 이미지 URL 설정
      this.selectedImage = imageData.url;
      
      // 벡터 데이터 처리
      this.processVectorData(imageData.url, imageData.name);
      
      // MSA5에 이미지 전송 (단 한 번만)
      this.sendImageToMSA5(imageData);
    },

    // MSA1 이미지 업데이트 시뮬레이션 (개발/테스트용)
    simulateMSA1ImageUpdate() {
      // 더미 이미지 데이터
      const dummyEvent = new CustomEvent('msa1-to-msa4-image', {
        detail: {
          imageUrl: 'http://localhost:8000/images/test_image.jpg',
          imageName: 'test_image_' + Date.now() + '.jpg',
          timestamp: new Date().toISOString()
        }
      });
      
      // 이벤트 디스패치
      document.dispatchEvent(dummyEvent);
      logDebug('Simulated MSA1 image update event dispatched');
    },
  }
}
</script>

<style scoped>
.msa-component {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  position: relative; /* 추가: 상대적 위치 지정 */
  z-index: 1; /* 추가: 기본 z-index 설정 */
}

/* 이벤트 통신용 숨겨진 overlay 추가 */
.component-event-bridge {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none; /* 마우스 이벤트 무시 */
  z-index: 0; /* 다른 내용보다 아래에 위치 */
}

.component-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: #f0f0f0;
  border-bottom: 1px solid #ddd;
  position: relative; /* 추가: 상대적 위치 지정 */
  z-index: 2; /* 추가: 헤더는 더 높은 z-index */
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
}

.header-left i {
  color: #666;
}

.content-container {
  flex: 1;
  padding: 16px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  height: calc(100% - 50px);
  position: relative; /* 추가: 상대적 위치 지정 */
  z-index: 1; /* 추가: 기본 z-index 설정 */
}

.visualization-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  position: relative;
}

/* 이미지 영역 호버 트리거 */
.visualization-container::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 80px; /* 호버 감지 영역 높이 */
  z-index: 4;
}

.plot-container {
  width: 100%;
  height: 500px;
  min-height: 500px;
  margin-bottom: 20px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: rgb(240, 240, 240);
  overflow: visible;
  position: relative;
  z-index: 1; /* 추가: 그래프 시각화 z-index 설정 */
}

.image-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  position: relative; /* 추가: 상대적 위치 지정 */
  z-index: 2; /* 추가: 이미지 섹션은 더 높은 z-index */
}

.selected-image, .similar-images {
  background-color: #f9f9f9;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.selected-image h3, .similar-images h3 {
  margin-top: 0;
  margin-bottom: 12px;
  font-size: 16px;
  color: #333;
}

.image-info {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.preview-image {
  max-width: 100%;
  max-height: 200px;
  border-radius: 4px;
  margin-bottom: 8px;
  object-fit: contain;
  border: 1px solid #ddd;
}

.similar-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.similar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.similar-item-info {
  width: 100%;
}

.similar-item-info p {
  margin: 4px 0;
  font-size: 12px;
  word-break: break-all;
}

.similarity-score {
  display: block;
  font-size: 12px;
  color: #0066cc;
  font-weight: 600;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
}

.loading-spinner {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 2s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.empty-image-section {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  transform: translateY(100%); /* 완전히 숨김 */
  transition: transform 0.3s ease-in-out;
  opacity: 0.7;
  z-index: 5;
}

/* visualization-container 하단에 마우스를 올리면 숨겨진 이미지 영역 표시 */
.visualization-container:hover .empty-image-section {
  transform: translateY(0);
  opacity: 1;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #666;
  text-align: center;
  padding: 20px;
}

.empty-state i {
  font-size: 48px;
  margin-bottom: 16px;
  color: #ddd;
}

.empty-state .subtitle {
  font-size: 14px;
  color: #999;
  margin-top: 8px;
}

.status-message {
  background-color: #f8f9fa;
  border-left: 4px solid #17a2b8;
  padding: 12px 16px;
  margin: 0 0 16px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-message i {
  color: #17a2b8;
}

.status-message.success {
  border-left-color: #28a745;
}

.status-message.success i {
  color: #28a745;
}

.status-message.warning {
  border-left-color: #ffc107;
}

.status-message.warning i {
  color: #ffc107;
}

.status-message.error {
  border-left-color: #dc3545;
}

.status-message.error i {
  color: #dc3545;
}

.paste-image-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: linear-gradient(135deg, #f5f7fa, #e4edf9);
  border-radius: 12px;
  border: 2px dashed #c3d0e6;
  text-align: center;
  transition: all 0.3s ease;
  cursor: pointer;
}

.paste-image-prompt:hover {
  border-color: #8b5cf6;
  box-shadow: 0 5px 15px rgba(139, 92, 246, 0.15);
  transform: translateY(-2px);
}

.image-icon-wrapper {
  position: relative;
  margin-bottom: 20px;
}

.image-icon-wrapper i.fa-cloud-upload-alt {
  font-size: 42px;
  color: #8b5cf6;
  margin-bottom: 10px;
}

.image-icon-wrapper i.fa-image {
  position: absolute;
  bottom: -5px;
  right: -10px;
  font-size: 24px;
  color: #4ade80;
  background: white;
  padding: 5px;
  border-radius: 50%;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}

.paste-image-prompt h3 {
  font-size: 20px;
  font-weight: 600;
  color: #4b5563;
  margin: 0 0 8px 0;
}

.paste-image-prompt p {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

@media (max-width: 768px) {
  .visualization-container {
    flex-direction: column;
  }
  
  .plot-container {
    height: 400px;
    min-height: 400px;
  }
}

.msa5-communication-indicator {
  position: fixed;
  top: 10px;
  right: 10px;
  background-color: #28a745;
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  z-index: 9999;
  animation: fadeInOut 3s ease;
}

.msa5-communication-indicator i {
  animation: rotate 1s infinite linear;
}

@keyframes fadeInOut {
  0% { opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { opacity: 0; }
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.debug-button {
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
}

.debug-button:hover {
  background-color: #5a6268;
}
</style> 