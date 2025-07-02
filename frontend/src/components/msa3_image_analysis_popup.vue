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
.popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.popup-container {
  background-color: white;
  border-radius: 8px;
  width: 90%;
  max-width: 1200px;
  max-height: 93vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #eee;
}

.popup-header h3 {
  margin: 0;
  color: #333;
}

.close-button {
  background: none;
  border: none;
  font-size: 20px;
  color: #666;
  cursor: pointer;
}

.close-button:hover {
  color: #333;
}

.popup-content {
  padding: 24px;
}

.images-container {
  display: flex;
  gap: 24px;
  margin-bottom: 24px;
}

.image-card {
  flex: 1;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.image-card h4 {
  margin-top: 0;
  margin-bottom: 16px;
  color: #333;
  text-align: center;
}

.image-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
}

.detail-image {
  max-width: 100%;
  max-height: 400px;
  border-radius: 4px;
}

.text-content-section {
  margin-bottom: 24px;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.text-content-section h4 {
  margin-top: 0;
  margin-bottom: 16px;
  color: #333;
}

.text-content-wrapper {
  min-height: 100px;
  display: block;
}

.text-content-container {
  border: 1px solid #e9ecef;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.text-content-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 500;
}

.text-content-header .header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.text-content-header i {
  font-size: 16px;
}

.refresh-button {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.refresh-button:hover {
  background: rgba(255, 255, 255, 0.3);
}

.text-content-body {
  background-color: #f8f9fa;
  min-height: 400px;
  overflow: hidden;
}

.text-content-frame {
  width: 100%;
  height: 400px;
  border: none;
  background-color: white;
  font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
}

.text-content-frame::before {
  content: '';
  display: block;
  font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
}

.loading-message {
  color: #6c757d;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px;
  font-size: 16px;
  height: 400px;
}

.loading-message i {
  font-size: 18px;
}

.error-message {
  color: #dc3545;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px;
  font-size: 16px;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 8px;
  margin: 20px;
  height: 360px;
}

.error-message i {
  font-size: 18px;
}

.fallback-message {
  height: 400px;
}

.action-buttons {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}

.analyze-button {
  background-color: #6c5ce7;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 12px 24px;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background-color 0.2s;
}

.analyze-button:hover {
  background-color: #5b4bc9;
}

@media (max-width: 768px) {
  .images-container {
    flex-direction: column;
  }
  
  .image-card {
    margin-bottom: 16px;
  }
}
</style> 