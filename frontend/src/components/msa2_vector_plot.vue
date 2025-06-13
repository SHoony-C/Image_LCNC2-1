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
      
      <div v-if="isProcessing" class="loading-overlay">
        <div class="loading-spinner"></div>
        <div class="loading-message">{{ loadingMessage }}</div>
      </div>
    </div>
  </div>
</template>

<script>
import { plotlyManager } from '@/utils/msa2_plotlyManager'
import { dataProcessor } from '@/utils/msa2_dataProcessor'
import { eventHandlers } from '@/utils/msa2_eventHandlers'
import { imageSelector } from '@/utils/msa2_imageSelector'

const DEBUG = true;
function logDebug(...args) {
  if (DEBUG) {
    console.log('[MSA4]', ...args);
  }
}

export default {
  name: 'MSA4VectorTransform',
  emits: ['update-msa5-image'],
  data() {
    return {
      vectors: [],
      projectedVectors: [],
      labels: [],
      imageLabels: [],
      markerColors: [],
      markerSizes: [],
      similarImages: [],
      selectedImage: null,
      isProcessing: false,
      isDataLoaded: false,
      loadingComplete: false,
      loadingMessage: '',
      errorMessage: '',
      plot: null,
      resizeObserver: null,
      lastSimilarImagesRequestId: null,
      selectedFilename: null,
      selectedImageIndex: -1,
      selectedIndex: -1,
      showCoordinates: true,
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
      lastImageData: null,
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
      msa5MessageActive: false,
      showDebugControls: false,
      currentImage: null,
      showStatusMessage: false,
      plotSizeObserver: null,
      isSelectingImageFlag: false,
      isLoading: false,
      lastHighlightIndex: -1,
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
      popupWorkflowData: null,
      plotColors: [],
      plotOriginalColors: [],
      plotPointTypes: [],
      plotOriginalIndices: [],
      plotCenter: null,
      currentCameraPosition: {
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
          this.initializePlot();
        }
      },
      immediate: true
    }
  },
  mounted() {
    logDebug('MSA4 Vector Transform Component mounted');
    this.checkVectorsData();
    
    logDebug('Setting up document-level event listeners');
    window.addEventListener('keydown', this.handleKeyDown);
    
    document.addEventListener('msa1-to-msa4-image', this.handleImageUpdate);
    document.addEventListener('msa5-to-msa4-similar-images', this.handleSimilarImagesFromMSA5);
    
    this.setupResizeObserver();
    this.createVisualization();
    
    logDebug('MSA4 component initialization complete');
    
    setTimeout(() => {
      this.connectToMSA3();
    }, 2000);
  },
  beforeUnmount() {
    logDebug('MSA4 component unmounting');
    
    window.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('msa1-to-msa4-image', this.handleImageUpdate);
    document.removeEventListener('msa5-to-msa4-similar-images', this.handleSimilarImagesFromMSA5);
    
    if (this.containerObserver) {
      this.containerObserver.disconnect();
    }
    
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    
    if (this.componentFindInterval) {
      clearInterval(this.componentFindInterval);
    }
    
    if (this.plotSizeObserver) {
      this.plotSizeObserver.disconnect();
    }
  },
  methods: {
    // Plotly 관련 메서드들
    ...plotlyManager,
    
    // 데이터 처리 관련 메서드들
    ...dataProcessor,
    
    // 이벤트 처리 관련 메서드들
    ...eventHandlers,
    
    // 이미지 선택 관련 메서드들
    ...imageSelector
  }
}
</script>

<style scoped src="@/styles/msa2_vector_plot.css"></style>