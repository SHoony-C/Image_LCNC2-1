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
import '@/assets/css/msa4_llm_analysis.css'
import { ref, watch, onMounted, onUpdated, onBeforeUnmount } from 'vue'

// Composables
import { useChatState } from '../composables/msa4_useChatState'
import { useAnalysis } from '../composables/msa4_useAnalysis'
import { useUIHelpers } from '../composables/msa4_useUIHelpers'

export default {
  name: 'MSA4LLMAnalysis',
  setup() {
    // =============================================
    // Template refs
    // =============================================
    const chatInput = ref(null)
    const messageContainer = ref(null)

    // =============================================
    // 1. Chat State
    // =============================================
    const {
      analysisData,
      analysisResult,
      isAnalyzing,
      hasAnalysisData,
      errorMessage,
      abortController,
      lastProcessedData,
      debounceTimer,
      userInput,
      chatHistory,
      currentAnalysisImages,
      isDuplicateData
    } = useChatState()

    // =============================================
    // 2. UI Helpers (needs refs and sendChatMessage - wired after analysis)
    // =============================================
    const uiRefs = { chatInput, messageContainer }

    // sendChatMessage comes from useAnalysis, but useAnalysis needs scrollToBottom from useUIHelpers.
    // Break this circular dependency with a late-bound reference.
    let _sendChatMessage = null

    const {
      scrollToBottom,
      formatAnswer,
      handleKeyDown,
      adjustTextareaHeight,
      sendMessage
    } = useUIHelpers({
      userInput,
      isAnalyzing,
      chatHistory,
      refs: uiRefs,
      sendChatMessage: (...args) => _sendChatMessage(...args)
    })

    // =============================================
    // 3. Analysis (LLM API calls, streaming)
    // =============================================
    const {
      handleAnalysisData,
      processAnalysisData,
      sendChatMessage,
      sendToBackend,
      stopAnalysis
    } = useAnalysis({
      analysisData,
      analysisResult,
      isAnalyzing,
      hasAnalysisData,
      errorMessage,
      abortController,
      lastProcessedData,
      debounceTimer,
      chatHistory,
      currentAnalysisImages,
      isDuplicateData,
      scrollToBottom
    })

    // Wire up the late-bound reference now that useAnalysis has been initialized
    _sendChatMessage = sendChatMessage

    // =============================================
    // Watchers
    // =============================================
    watch(analysisResult, () => {
      // analysisResult가 변경될 때마다 스크롤을 아래로
      scrollToBottom()
    })

    watch(errorMessage, () => {
      // errorMessage가 변경될 때마다 스크롤을 아래로
      scrollToBottom()
    })

    watch(isAnalyzing, () => {
      // 분석 상태가 변경될 때마다 스크롤을 아래로
      scrollToBottom()
    })

    watch(chatHistory, () => {
      // 채팅 이력이 변경될 때마다 스크롤을 아래로
      scrollToBottom()
    }, { deep: true })

    // =============================================
    // Lifecycle hooks
    // =============================================
    onMounted(() => {
      // 컴포넌트가 마운트된 후 스크롤을 아래로
      scrollToBottom()
    })

    onUpdated(() => {
      // 컴포넌트가 업데이트된 후 스크롤을 아래로
      scrollToBottom()
    })

    onBeforeUnmount(() => {
      // 컴포넌트 파괴 시 디바운스 타이머 정리
      if (debounceTimer.value) {
        clearTimeout(debounceTimer.value)
        debounceTimer.value = null
      }

      // 진행 중인 분석 중단
      if (abortController.value) {
        abortController.value.abort()
        abortController.value = null
      }
    })

    // =============================================
    // Return all template bindings
    // =============================================
    return {
      // Template refs
      chatInput,
      messageContainer,

      // Chat state
      analysisData,
      analysisResult,
      isAnalyzing,
      hasAnalysisData,
      errorMessage,
      userInput,
      chatHistory,

      // UI helpers
      scrollToBottom,
      formatAnswer,
      handleKeyDown,
      adjustTextareaHeight,
      sendMessage,

      // Analysis
      handleAnalysisData,
      stopAnalysis
    }
  }
}
</script>

<style scoped>
</style>