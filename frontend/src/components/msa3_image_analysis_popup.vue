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
              <img :src="imageUrl" :alt="imageName" class="detail-image" />
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
  computed: {
    wholeImageUrl() {
      // Construct URL for the '_whole.png' version of the image
      // Using direct IIS server connection as specified by user
      const imageName = this.imageName.split('.')[0]; // Remove file extension
      const url = `http://localhost:8091/additional_images/${imageName}_whole.png`;
      //console.log('Analysis Popup: Generated whole image URL:', url);
      return url;
    },
    textContentUrl() {
      // Construct URL for the '.txt' file associated with the image
      // Using proxy to avoid CORS issues
      const imageName = this.imageName.split('.')[0]; // Remove file extension
      const url = `http://localhost:8000/proxy/additional_images/${imageName}.txt`;
      //console.log('Analysis Popup: Generated text content URL:', url);
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
  max-height: 90vh;
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