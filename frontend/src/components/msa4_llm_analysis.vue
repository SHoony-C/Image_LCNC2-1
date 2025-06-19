<template>
  <div class="msa4-container">
    <div class="card-header">
      <div class="header-left">
        <i class="fas fa-brain"></i>
        <span>Image Analysis Assistant</span>
      </div>
    </div>
    
    <div class="chat-container">
      <div v-if="!hasAnalysisData && chatHistory.length === 0" class="empty-state">
        <div class="welcome-content">
          <div class="welcome-icon">
            <i class="fas fa-robot"></i>
          </div>
          <h3>Image Analysis Assistant</h3>
          <p>MSA3에서 Analysis 태그 이미지를 선택하면 자동으로 분석이 시작됩니다.<br>또는 아래 입력창에서 직접 질문하실 수 있습니다.</p>
        </div>
      </div>
      
      <div v-else class="chat-content">
        <div v-if="hasAnalysisData" class="analysis-info">
          <div class="analysis-header">
            <h4>분석 중인 이미지들</h4>
            <span class="image-count">{{ analysisData.length }}개 이미지</span>
          </div>
          <div class="image-list">
            <div v-for="item in analysisData" :key="item.imageName" class="image-item">
              <span class="image-name">{{ item.imageName }}</span>
              <span class="similarity">{{ item.similarity?.toFixed(1) || 0 }}% 유사</span>
            </div>
          </div>
        </div>
        
        <div class="message-container" ref="messageContainer">
          <!-- Chat history messages -->
          <div v-for="(message, index) in chatHistory" :key="index" class="message" :class="message.type + '-message'">
            <div class="message-content" v-html="message.type === 'ai' ? formatAnswer(message.content) : message.content"></div>
          </div>
          
          <!-- Current analysis result (if any) -->
          <div v-if="analysisResult" class="message ai-message">
            <div class="message-content" v-html="formatAnswer(analysisResult)"></div>
          </div>
          
          <!-- Typing indicator -->
          <div v-if="isAnalyzing" class="message ai-message">
            <div class="message-content typing-indicator">
              <span class="dot"></span>
              <span class="dot"></span>
              <span class="dot"></span>
              <span class="analyzing-text">분석 중...</span>
            </div>
          </div>
          
          <!-- Error message -->
          <div v-if="errorMessage" class="message error-message">
            <div class="message-content">{{ errorMessage }}</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Chat input area -->
    <div class="chat-input-container">
      <div class="input-wrapper">
        <textarea
          v-model="userInput"
          @keydown="handleKeyDown"
          @input="adjustTextareaHeight"
          ref="chatInput"
          placeholder="질문을 입력하세요..."
          class="chat-input"
          rows="1"
          :disabled="isAnalyzing"
        ></textarea>
        <div class="input-buttons">
          <button 
            v-if="isAnalyzing" 
            class="stop-button" 
            @click="stopAnalysis"
            title="Stop generation"
          >
            <i class="fas fa-stop"></i>
          </button>
          <button 
            v-else
            class="send-button" 
            @click="sendMessage"
            :disabled="!userInput.trim()"
            title="Send message"
          >
            <i class="fas fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'MSA4LLMAnalysis',
  data() {
    return {
      analysisData: [],
      analysisResult: '',
      isAnalyzing: false,
      hasAnalysisData: false,
      errorMessage: '',
      abortController: null,
      lastProcessedData: null, // 마지막으로 처리한 데이터 추적
      debounceTimer: null, // 디바운스 타이머
      userInput: '', // 사용자 입력
      chatHistory: [], // 채팅 이력
      currentAnalysisImages: [] // 현재 분석 중인 이미지들
    }
  },
  methods: {
    handleAnalysisData(data) {
      // 메인 페이지에서 호출되는 메서드
      // 이미 분석 중이라면 새로운 요청을 무시
      if (this.isAnalyzing) {
        console.log('MSA4: Already analyzing, ignoring new request');
        return;
      }
      
      // 중복 데이터 체크 - 같은 데이터가 연속으로 오는 경우 무시
      if (this.isDuplicateData(data)) {
        console.log('MSA4: Duplicate data detected, ignoring request');
        return;
      }
      
      // 디바운스 처리 - 짧은 시간 내에 여러 요청이 오면 마지막 것만 처리
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      
      this.debounceTimer = setTimeout(() => {
        this.processAnalysisData(data);
        this.debounceTimer = null;
      }, 300); // 300ms 디바운스
    },
    
    // 중복 데이터 체크 함수
    isDuplicateData(newData) {
      if (!this.lastProcessedData || !newData) {
        return false;
      }
      
      // 데이터 타입과 길이 비교
      if (this.lastProcessedData.type !== newData.type) {
        return false;
      }
      
      const lastData = this.lastProcessedData.data || [];
      const currentData = newData.data || [];
      
      if (lastData.length !== currentData.length) {
        return false;
      }
      
      // 각 이미지의 이름과 텍스트 내용 비교
      for (let i = 0; i < lastData.length; i++) {
        if (lastData[i].imageName !== currentData[i].imageName ||
            lastData[i].textContent !== currentData[i].textContent) {
          return false;
        }
      }
      
      return true; // 완전히 동일한 데이터
    },
    
    async processAnalysisData(data) {
      // console.log('MSA4: Received analysis data:', data);
      
      // 이미 분석 중이라면 새로운 요청을 보내지 않음
      if (this.isAnalyzing) {
        console.log('MSA4: Already analyzing, skipping new request');
        return;
      }
      
      // 마지막 처리 데이터 저장
      this.lastProcessedData = JSON.parse(JSON.stringify(data));
      
      this.analysisData = data.data || [];
      this.currentAnalysisImages = [...this.analysisData];
      this.hasAnalysisData = this.analysisData.length > 0;
      this.analysisResult = '';
      this.errorMessage = '';
      
      if (this.hasAnalysisData) {
        await this.sendToBackend(data);
      }
    },
    
    handleKeyDown(event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.sendMessage();
      }
    },
    
    adjustTextareaHeight() {
      this.$nextTick(() => {
        const textarea = this.$refs.chatInput;
        if (textarea) {
          textarea.style.height = 'auto';
          textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
        }
      });
    },
    
    async sendMessage() {
      if (!this.userInput.trim() || this.isAnalyzing) {
        return;
      }
      
      const message = this.userInput.trim();
      this.userInput = '';
      
      // 사용자 메시지를 채팅 이력에 추가
      this.chatHistory.push({
        type: 'user',
        content: message,
        timestamp: new Date()
      });
      
      // 텍스트 영역 높이 초기화
      this.$nextTick(() => {
        const textarea = this.$refs.chatInput;
        if (textarea) {
          textarea.style.height = 'auto';
        }
      });
      
      // 채팅 메시지 전송
      await this.sendChatMessage(message);
    },
    
    async sendChatMessage(message) {
      this.isAnalyzing = true;
      this.analysisResult = '';
      this.errorMessage = '';
      
      // 스크롤을 아래로
      this.scrollToBottom();
      
      // AbortController 생성 (중단 기능용)
      this.abortController = new AbortController();
      
      try {
        // 채팅 이력과 현재 이미지 정보를 포함한 데이터 구성
        const chatData = {
          type: 'chat',
          message: message,
          history: this.chatHistory.slice(-10).map(msg => ({
            role: msg.type === 'user' ? 'user' : 'assistant',
            content: msg.content,
            timestamp: msg.timestamp
          })), // 최근 10개 메시지만 포함하고 백엔드 형식에 맞게 변환
          images: this.currentAnalysisImages || [] // 현재 분석 중인 이미지들
        };
        
        const response = await fetch('http://localhost:8000/api/imagestorage/chats/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(chatData),
          signal: this.abortController.signal
        });
        
        if (!response.ok) {
          if (response.status === 200 && response.headers.get('content-type')?.includes('application/json')) {
            const result = await response.json();
            if (result.status === 'busy') {
              this.errorMessage = '이미 다른 분석이 진행 중입니다. 잠시 후 다시 시도해주세요.';
              this.scrollToBottom();
              return;
            }
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // 스트리밍 응답 처리
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let aiResponse = '';
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            // AbortController로 중단된 경우 체크
            if (this.abortController.signal.aborted) {
              break;
            }
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const jsonData = JSON.parse(line.slice(6));
                  
                  if (jsonData.content) {
                    aiResponse += jsonData.content;
                    this.analysisResult += jsonData.content;
                    // 스크롤을 아래로 이동
                    this.scrollToBottom();
                  } else if (jsonData.done) {
                    // console.log('MSA4: Chat completed');
                    // AI 응답을 채팅 이력에 추가
                    if (aiResponse.trim()) {
                      this.chatHistory.push({
                        type: 'ai',
                        content: aiResponse,
                        timestamp: new Date()
                      });
                    }
                    this.analysisResult = ''; // 현재 분석 결과 초기화
                    this.scrollToBottom();
                    break;
                  } else if (jsonData.error) {
                    this.errorMessage = jsonData.error;
                    this.scrollToBottom();
                    break;
                  }
                } catch (parseError) {
                  // console.warn('MSA4: Failed to parse JSON:', parseError);
                }
              }
            }
            
            // 메인 스레드가 다른 작업을 처리할 수 있도록 양보
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        } finally {
          // reader를 안전하게 닫기
          try {
            reader.releaseLock();
          } catch (e) {
            // 이미 닫혀있거나 에러가 발생해도 무시
          }
        }
        
      } catch (error) {
        if (error.name === 'AbortError') {
          // console.log('MSA4: Chat was aborted');
          // 중단된 응답이 있다면 채팅 이력에 저장
          if (this.analysisResult && this.analysisResult.trim()) {
            this.chatHistory.push({
              type: 'ai',
              content: this.analysisResult + '\n\n[응답이 중단되었습니다]',
              timestamp: new Date(),
              isInterrupted: true
            });
            this.analysisResult = ''; // 현재 분석 결과 초기화
          }
        } else {
          // console.error('MSA4: Error sending chat message:', error);
          this.errorMessage = `채팅 중 오류가 발생했습니다: ${error.message}`;
        }
        this.scrollToBottom();
      } finally {
        this.isAnalyzing = false;
        this.abortController = null;
      }
    },
    
    scrollToBottom() {
      // chat-container를 대상으로 스크롤 (이중 스크롤 방지)
      const scrollToBottomWithRetry = () => {
        const container = this.$el?.querySelector('.chat-container');
        if (container) {
          container.scrollTop = container.scrollHeight;
          
          // 스크롤이 제대로 되지 않았다면 다시 시도
          setTimeout(() => {
            if (container.scrollTop < container.scrollHeight - container.clientHeight - 10) {
              container.scrollTop = container.scrollHeight;
            }
          }, 50);
        }
      };
      
      this.$nextTick(() => {
        scrollToBottomWithRetry();
        // 추가로 한 번 더 시도
        setTimeout(scrollToBottomWithRetry, 100);
      });
    },
    
    async sendToBackend(data) {
      this.isAnalyzing = true;
      this.analysisResult = '';
      this.errorMessage = '';
      
      // 분석 시작 시 스크롤을 아래로
      this.scrollToBottom();
      
      // AbortController 생성 (중단 기능용)
      this.abortController = new AbortController();
      
      try {
        // 데이터 형식 확인 및 정규화
        const analysisData = {
          ...data,
          history: this.chatHistory.slice(-5).map(msg => ({
            role: msg.type === 'user' ? 'user' : 'assistant',
            content: msg.content,
            timestamp: msg.timestamp
          })) // 이미지 분석 시에도 최근 채팅 이력 포함
        };
        
        const response = await fetch('http://localhost:8000/api/imagestorage/chats/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(analysisData),
          signal: this.abortController.signal
        });
        
        if (!response.ok) {
          if (response.status === 200 && response.headers.get('content-type')?.includes('application/json')) {
            const result = await response.json();
            if (result.status === 'busy') {
              this.errorMessage = '이미 다른 분석이 진행 중입니다. 잠시 후 다시 시도해주세요.';
              this.scrollToBottom();
              return;
            }
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // 스트리밍 응답 처리
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let aiResponse = '';
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            // AbortController로 중단된 경우 체크
            if (this.abortController.signal.aborted) {
              break;
            }
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const jsonData = JSON.parse(line.slice(6));
                  
                  if (jsonData.content) {
                    aiResponse += jsonData.content;
                    this.analysisResult += jsonData.content;
                    // 스크롤을 아래로 이동
                    this.scrollToBottom();
                  } else if (jsonData.done) {
                    // console.log('MSA4: Analysis completed');
                    // AI 응답을 채팅 이력에 추가 (이미지 분석의 경우)
                    if (aiResponse.trim()) {
                      this.chatHistory.push({
                        type: 'ai',
                        content: aiResponse,
                        timestamp: new Date(),
                        isAnalysis: true
                      });
                    }
                    this.analysisResult = ''; // 현재 분석 결과 초기화
                    this.scrollToBottom();
                    break;
                  } else if (jsonData.error) {
                    this.errorMessage = jsonData.error;
                    this.scrollToBottom();
                    break;
                  }
                } catch (parseError) {
                  // console.warn('MSA4: Failed to parse JSON:', parseError);
                }
              }
            }
            
            // 메인 스레드가 다른 작업을 처리할 수 있도록 양보
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        } finally {
          // reader를 안전하게 닫기
          try {
            reader.releaseLock();
          } catch (e) {
            // 이미 닫혀있거나 에러가 발생해도 무시
          }
        }
        
      } catch (error) {
        if (error.name === 'AbortError') {
          // console.log('MSA4: Analysis was aborted');
          // 중단된 응답이 있다면 채팅 이력에 저장
          if (this.analysisResult && this.analysisResult.trim()) {
            this.chatHistory.push({
              type: 'ai',
              content: this.analysisResult + '\n\n[분석이 중단되었습니다]',
              timestamp: new Date(),
              isAnalysis: true,
              isInterrupted: true
            });
            this.analysisResult = ''; // 현재 분석 결과 초기화
          }
        } else {
          // console.error('MSA4: Error sending to backend:', error);
          this.errorMessage = `분석 중 오류가 발생했습니다: ${error.message}`;
        }
        this.scrollToBottom();
      } finally {
        this.isAnalyzing = false;
        this.abortController = null;
      }
    },
    
    stopAnalysis() {
      if (this.abortController) {
        // 현재 진행 중인 응답이 있다면 채팅 이력에 저장
        if (this.analysisResult && this.analysisResult.trim()) {
          this.chatHistory.push({
            type: 'ai',
            content: this.analysisResult + '\n\n[응답이 중단되었습니다]',
            timestamp: new Date(),
            isInterrupted: true
          });
          this.analysisResult = ''; // 현재 분석 결과 초기화
        }
        
        this.abortController.abort();
        this.scrollToBottom();
      }
      this.isAnalyzing = false;
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
  },
  
  mounted() {
    // 컴포넌트가 마운트된 후 스크롤을 아래로
    this.scrollToBottom();
  },
  
  updated() {
    // 컴포넌트가 업데이트된 후 스크롤을 아래로
    this.scrollToBottom();
  },
  
  watch: {
    analysisResult() {
      // analysisResult가 변경될 때마다 스크롤을 아래로
      this.scrollToBottom();
    },
    errorMessage() {
      // errorMessage가 변경될 때마다 스크롤을 아래로
      this.scrollToBottom();
    },
    isAnalyzing() {
      // 분석 상태가 변경될 때마다 스크롤을 아래로
      this.scrollToBottom();
    },
    chatHistory: {
      handler() {
        // 채팅 이력이 변경될 때마다 스크롤을 아래로
        this.scrollToBottom();
      },
      deep: true
    }
  },
  
  beforeDestroy() {
    // 컴포넌트 파괴 시 디바운스 타이머 정리
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    
    // 진행 중인 분석 중단
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
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

.chat-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background-color: #f9f9f9;
  scroll-behavior: smooth;
}

.chat-container::-webkit-scrollbar {
  width: 6px;
}

.chat-container::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.chat-container::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.chat-container::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
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

.analysis-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.analysis-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.analysis-header h4 {
  margin: 0;
  color: #333;
}

.image-count {
  color: #666;
  font-size: 14px;
}

.image-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.image-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.image-name {
  color: #333;
}

.similarity {
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

.ai-message {
  align-self: flex-start;
}

.user-message {
  align-self: flex-end;
}

.message-content {
  padding: 12px 16px;
  border-radius: 18px;
  line-height: 1.5;
}

.ai-message .message-content {
  background-color: white;
  color: #333;
  border-bottom-left-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.user-message .message-content {
  background-color: #6c5ce7;
  color: white;
  border-bottom-right-radius: 4px;
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

.analyzing-text {
  color: #6c5ce7;
  font-weight: 600;
}

.error-message {
  background-color: #ffd1d1;
  color: #ff3b3b;
  border-radius: 8px;
  padding: 12px 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

/* Chat input styles */
.chat-input-container {
  padding: 16px;
  background-color: white;
  border-top: 1px solid #e0e0e0;
}

.input-wrapper {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  max-width: 100%;
}

.chat-input {
  flex: 1;
  min-height: 40px;
  max-height: 120px;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 20px;
  resize: none;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.4;
  outline: none;
  transition: border-color 0.2s;
}

.chat-input:focus {
  border-color: #6c5ce7;
}

.chat-input:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.input-buttons {
  display: flex;
  align-items: center;
}

.send-button, .stop-button {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.send-button {
  background-color: #6c5ce7;
  color: white;
}

.send-button:hover:not(:disabled) {
  background-color: #5a4fcf;
  transform: scale(1.05);
}

.send-button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
  transform: none;
}

.stop-button {
  background-color: #ff4757;
  color: white;
}

.stop-button:hover {
  background-color: #ff3742;
  transform: scale(1.05);
}
</style> 