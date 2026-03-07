import { nextTick, getCurrentInstance } from 'vue'

/**
 * Composable for MSA4 UI helper functions.
 * Handles scrolling, text formatting, keyboard events, textarea adjustment, and message sending.
 *
 * @param {Object} deps - Dependencies from other composables
 * @param {import('vue').Ref} deps.userInput - Reactive ref to user input text
 * @param {import('vue').Ref} deps.isAnalyzing - Reactive ref to analyzing state flag
 * @param {import('vue').Ref} deps.chatHistory - Reactive ref to chat history array
 * @param {Object} deps.refs - Template refs object
 * @param {import('vue').Ref} deps.refs.chatInput - Ref to chat input textarea element
 * @param {import('vue').Ref} deps.refs.messageContainer - Ref to message container element
 * @param {Function} deps.sendChatMessage - Function to send chat message to backend
 * @returns UI helper functions
 */
export function useUIHelpers(deps) {
  // getCurrentInstance()는 setup() 컨텍스트에서만 호출 가능하므로 여기서 캡처
  const instance = getCurrentInstance()

  function scrollToBottom() {
    // chat-container를 대상으로 스크롤 (이중 스크롤 방지)
    const scrollToBottomWithRetry = () => {
      const rootElement = instance?.proxy?.$el
      const container = rootElement?.querySelector('.chat-container')
      if (container) {
        container.scrollTop = container.scrollHeight

        // 스크롤이 제대로 되지 않았다면 다시 시도
        setTimeout(() => {
          if (container.scrollTop < container.scrollHeight - container.clientHeight - 10) {
            container.scrollTop = container.scrollHeight
          }
        }, 50)
      }
    }

    nextTick(() => {
      scrollToBottomWithRetry()
      // 추가로 한 번 더 시도
      setTimeout(scrollToBottomWithRetry, 100)
    })
  }

  function formatAnswer(text) {
    // Convert markdown-like syntax to HTML
    let formatted = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>')

    return formatted
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
    }
  }

  function adjustTextareaHeight() {
    nextTick(() => {
      const textarea = deps.refs.chatInput.value
      if (textarea) {
        textarea.style.height = 'auto'
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px'
      }
    })
  }

  async function sendMessage() {
    if (!deps.userInput.value.trim() || deps.isAnalyzing.value) {
      return
    }

    const message = deps.userInput.value.trim()
    deps.userInput.value = ''

    // 사용자 메시지를 채팅 이력에 추가
    deps.chatHistory.value.push({
      type: 'user',
      content: message,
      timestamp: new Date()
    })

    // 텍스트 영역 높이 초기화
    nextTick(() => {
      const textarea = deps.refs.chatInput.value
      if (textarea) {
        textarea.style.height = 'auto'
      }
    })

    // 채팅 메시지 전송
    await deps.sendChatMessage(message)
  }

  return {
    scrollToBottom,
    formatAnswer,
    handleKeyDown,
    adjustTextareaHeight,
    sendMessage
  }
}
