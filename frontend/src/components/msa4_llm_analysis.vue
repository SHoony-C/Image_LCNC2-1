<template>
  <div class="msa4-container">
    <div class="card-header">
      <div class="header-left">
        <i class="fas fa-brain"></i>
        <span>Image Analysis Assistant</span>
      </div>
      <div class="header-right">
        <button 
          v-if="isAnalyzing" 
          class="stop-button" 
          @click="stopAnalysis"
          title="Stop generation"
        >
          <i class="fas fa-stop"></i>
        </button>
      </div>
    </div>
    
    <div class="chat-container">
      <div v-if="!currentImageData" class="empty-state">
        <div class="welcome-content">
          <div class="welcome-icon">
            <i class="fas fa-robot"></i>
          </div>
          <h3>Image Analysis Assistant</h3>
          <p>Select an image with the "Analysis" tag and click the "Analyze" button to start a conversation about the image.</p>
        </div>
      </div>
      
      <div v-else class="chat-content">
        <div class="image-info">
          <div class="image-preview">
            <img :src="currentImageData.imageUrl" :alt="currentImageData.imageName" />
          </div>
          <div class="image-details">
            <h4>{{ currentImageData.imageName }}</h4>
            <p>Ask questions about this image:</p>
          </div>
        </div>
        
        <div class="message-container" ref="messageContainer">
          <div v-if="currentQuestion" class="message user-message">
            <div class="message-content">{{ currentQuestion }}</div>
          </div>
          
          <div v-if="currentAnswer" class="message ai-message">
            <div class="message-content" v-html="formatAnswer(currentAnswer)"></div>
          </div>
          
          <div v-if="isAnalyzing" class="message ai-message">
            <div class="message-content typing-indicator">
              <span class="dot"></span>
              <span class="dot"></span>
              <span class="dot"></span>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="input-container">
      <textarea 
        v-model="newQuestion" 
        placeholder="Ask a question about the image..."
        @keydown.enter.prevent="submitQuestion"
        :disabled="!currentImageData || isAnalyzing"
        ref="questionInput"
        rows="1"
      ></textarea>
      <button 
        class="send-button" 
        @click="submitQuestion" 
        :disabled="!currentImageData || isAnalyzing || !newQuestion.trim()"
      >
        <i class="fas fa-paper-plane"></i>
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'MSA4LLMAnalysis',
  data() {
    return {
      currentImageData: null,
      currentQuestion: '',
      currentAnswer: '',
      newQuestion: '',
      isAnalyzing: false,
      contextData: null
    }
  },
  methods: {
    async analyzeImage(imageData) {
      this.currentImageData = {
        imageName: imageData.imageName,
        imageUrl: imageData.imageUrl || this.constructImageUrl(imageData.imageName),
        textContent: imageData.textContent
      };
      
      this.contextData = imageData.textContent;
      this.currentQuestion = '';
      this.currentAnswer = '';
      this.newQuestion = '';
      
      // Focus the question input
      this.$nextTick(() => {
        if (this.$refs.questionInput) {
          this.$refs.questionInput.focus();
        }
      });
    },
    
    constructImageUrl(imageName) {
      // Construct URL for the image
      return `/api/imageanalysis/images/${imageName}`;
    },
    
    async submitQuestion() {
      if (!this.newQuestion.trim() || this.isAnalyzing) return;
      
      this.currentQuestion = this.newQuestion;
      this.newQuestion = '';
      this.currentAnswer = '';
      this.isAnalyzing = true;
      
      try {
        // Construct the API request to the /completion endpoint
        const response = await fetch('/api/completion', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prompt: this.currentQuestion,
            context: this.contextData
          })
        });
        
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }
        
        const data = await response.json();
        this.currentAnswer = data.response || 'Sorry, I couldn\'t analyze this image properly.';
      } catch (error) {
        console.error('Error generating answer:', error);
        this.currentAnswer = 'An error occurred while generating the answer. Please try again.';
      } finally {
        this.isAnalyzing = false;
        
        // Scroll to bottom of message container
        this.$nextTick(() => {
          if (this.$refs.messageContainer) {
            this.$refs.messageContainer.scrollTop = this.$refs.messageContainer.scrollHeight;
          }
        });
      }
    },
    
    stopAnalysis() {
      // In a real implementation, this would abort the fetch request
      this.isAnalyzing = false;
      this.currentAnswer += ' [Generation stopped]';
    },
    
    formatAnswer(text) {
      // Convert markdown-like syntax to HTML
      let formatted = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
      
      return formatted;
    }
  }
}
</script>

<style scoped>
.msa4-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  border-radius: 8px;
  background-color: white;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: #6c5ce7;
  color: white;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.stop-button {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: none;
  border-radius: 4px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s;
}

.stop-button:hover {
  background: rgba(255, 255, 255, 0.3);
}

.chat-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background-color: #f9f9f9;
}

.empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  color: #666;
}

.welcome-icon {
  font-size: 48px;
  color: #6c5ce7;
  margin-bottom: 16px;
}

.welcome-content h3 {
  margin: 0 0 12px 0;
  color: #333;
}

.welcome-content p {
  max-width: 400px;
  line-height: 1.5;
}

.chat-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.image-info {
  display: flex;
  gap: 16px;
  padding: 12px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.image-preview {
  width: 80px;
  height: 80px;
  overflow: hidden;
  border-radius: 4px;
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-details {
  flex: 1;
}

.image-details h4 {
  margin: 0 0 8px 0;
  color: #333;
}

.image-details p {
  margin: 0;
  color: #666;
  font-size: 14px;
}

.message-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.message {
  display: flex;
  max-width: 85%;
}

.user-message {
  align-self: flex-end;
}

.ai-message {
  align-self: flex-start;
}

.message-content {
  padding: 12px 16px;
  border-radius: 18px;
  line-height: 1.5;
}

.user-message .message-content {
  background-color: #6c5ce7;
  color: white;
  border-bottom-right-radius: 4px;
}

.ai-message .message-content {
  background-color: white;
  color: #333;
  border-bottom-left-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.typing-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 12px 16px;
  min-width: 40px;
  justify-content: center;
}

.dot {
  width: 8px;
  height: 8px;
  background-color: #6c5ce7;
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out;
}

.dot:nth-child(1) {
  animation-delay: -0.32s;
}

.dot:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%, 80%, 100% { 
    transform: scale(0);
  } 40% { 
    transform: scale(1.0);
  }
}

.input-container {
  display: flex;
  padding: 12px 16px;
  background-color: white;
  border-top: 1px solid #eee;
}

textarea {
  flex: 1;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  resize: none;
  font-family: inherit;
  font-size: 14px;
  transition: border-color 0.2s;
}

textarea:focus {
  outline: none;
  border-color: #6c5ce7;
}

.send-button {
  margin-left: 8px;
  width: 40px;
  height: 40px;
  background-color: #6c5ce7;
  color: white;
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s;
}

.send-button:hover {
  background-color: #5b4bc9;
}

.send-button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}
</style> 