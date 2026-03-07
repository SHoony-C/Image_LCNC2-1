<template>
  <div v-if="show" class="popup-overlay" @click="close">
    <div class="popup-container" @click.stop>
      <div class="popup-header">
        <h3>Analysis Image Details</h3>
        <button class="close-button" @click="close">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="popup-content">
        <div class="images-container">
          <div class="image-card">
            <h4>Original Image</h4>
            <div class="image-wrapper">
              <img :src="originalImageUrl" :alt="imageName" class="detail-image" />
            </div>
          </div>
          
          <div class="image-card">
            <h4>Whole Image View</h4>
            <div class="image-wrapper">
              <img 
                :src="wholeImageUrl" 
                :alt="imageName + ' (whole)'" 
                class="detail-image" 
                @error="handleImageError" 
                @load="imageLoaded"
              />
            </div>
          </div>
        </div>
        
        <div class="text-content-section">
          <h4>Image Information</h4>
          <div class="text-content-wrapper">
            <div class="text-content-container">
              <div class="text-content-header">
                <div class="header-left">
                  <i class="fas fa-file-text"></i>
                  <span>{{ imageName.split('.')[0] }}.txt</span>
                </div>
                <button class="refresh-button" @click="refreshTextFrame" title="새로고침">
                  <i class="fas fa-sync-alt"></i>
                </button>
              </div>
              <div class="text-content-body">
                <iframe 
                  :src="textContentUrl" 
                  class="text-content-frame"
                  frameborder="0"
                  :key="frameKey"
                  @load="onFrameLoad"
                  @error="onFrameError"
                ></iframe>
              </div>
            </div>
          </div>
        </div>
        
        <div class="action-buttons">
          <button class="analyze-button" @click="analyzeImage">
            <i class="fas fa-brain"></i>
            Analyze
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import '@/assets/css/msa3_image_analysis_popup.css'

export default {
  name: 'ImageAnalysisPopup',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    imageUrl: {
      type: String,
      required: true
    },
    imageName: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      frameKey: 0
    };
  },
  watch: {
    show: {
      handler(newVal) {
        console.log('Analysis Popup: show prop changed to:', newVal);
        // iframe handles loading automatically
      },
      immediate: true
    }
  },
  mounted() {
    console.log('Analysis Popup: Component mounted, show prop is:', this.show);
  },
  computed: {
    wholeImageUrl() {
      // Construct URL for the '_whole.png' version of the image
      // Using direct IIS server connection as specified by user
      const imageName = this.imageName.split('.')[0]; // Remove file extension
      const url = `http://localhost:8091/additional_images/${imageName}_whole.png`
      console.log('Analysis Popup: Generated whole image URL:', imageName,url);
      return url;
    },
    originalImageUrl() {
      // Construct URL for the original image without '_whole'
      const imageName = this.imageName.split('.')[0]; // Remove file extension
      const url = `http://localhost:8091/additional_images/${imageName}.png`
      console.log('Analysis Popup: Generated original image URL:', imageName, url);
      return url;
    },
    textContentUrl() {
      // Construct URL for the '.txt' file associated with the image
      // Using direct IIS server connection with encoding hints
      const imageName = this.imageName.split('.')[0]; // Remove file extension
      const url = `http://localhost:8091/additional_images/${imageName}.txt?charset=utf-8`;
      console.log('Analysis Popup: Generated text content URL:', imageName, url);
      return url;
    }
  },
  methods: {
    close() {
      this.$emit('close');
    },
    handleImageError(event) {
      // Replace with inline base64 placeholder if image fails to load
      event.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNFNUU1RTUiLz48cGF0aCBkPSJNNzUgOTBMOTAgMTEwTDExMCA5MEwxMzAgMTIwTDcwIDEyMEw3NSA5MFoiIGZpbGw9IiM5OTkiLz48Y2lyY2xlIGN4PSIxMjAiIGN5PSI4MCIgcj0iMTAiIGZpbGw9IiM5OTkiLz48cGF0aCBkPSJNMTYwIDUwSDQwVjE1MEgxNjBWNTBaIiBzdHJva2U9IiM5OTkiIHN0cm9rZS13aWR0aD0iNCIvPjwvc3ZnPg==';
      event.target.alt = '이미지 로드 실패';
      console.error('Analysis Popup: Image load error for URL:', event.target.src);
    },
    imageLoaded(event) {
      //console.log('Analysis Popup: Image successfully loaded:', event.target.src);
    },
    async analyzeImage() {
      try {
        // Fetch the text content from the URL
        const response = await fetch(this.textContentUrl);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch text content: ${response.statusText}`);
        }
        
        const textContent = await response.text();
        
        // Emit event to send the text content for analysis in MSA4
        this.$emit('analyze', {
          imageName: this.imageName,
          textContent: textContent
        });
        
        // Close the popup after triggering analysis
        this.close();
      } catch (error) {
        console.error('Error analyzing image:', error);
        alert('Failed to analyze image. Please try again.');
      }
    },
    refreshTextFrame() {
      this.frameKey++;
    },
    onFrameLoad(event) {
      //console.log('Text content frame loaded');
    },
    onFrameError(event) {
      console.error('Error loading text content:', event.target.error);
      // Handle error appropriately
    }
  }
};
</script>

<style scoped>
</style> 