/**
 * Composable for MSA4 LLM analysis logic, API calls, and streaming.
 *
 * @param {Object} deps - Dependencies from other composables
 * @param {import('vue').Ref} deps.analysisData - Reactive ref to analysis data array
 * @param {import('vue').Ref} deps.analysisResult - Reactive ref to current analysis result text
 * @param {import('vue').Ref} deps.isAnalyzing - Reactive ref to analyzing state flag
 * @param {import('vue').Ref} deps.hasAnalysisData - Reactive ref to flag indicating analysis data exists
 * @param {import('vue').Ref} deps.errorMessage - Reactive ref to error message string
 * @param {import('vue').Ref} deps.abortController - Reactive ref to AbortController instance
 * @param {import('vue').Ref} deps.lastProcessedData - Reactive ref to last processed data (for dedup)
 * @param {import('vue').Ref} deps.debounceTimer - Reactive ref to debounce timer ID
 * @param {import('vue').Ref} deps.chatHistory - Reactive ref to chat history array
 * @param {import('vue').Ref} deps.currentAnalysisImages - Reactive ref to current analysis images
 * @param {Function} deps.isDuplicateData - Function to check duplicate data
 * @param {Function} deps.scrollToBottom - Function to scroll chat to bottom
 * @returns Analysis functions
 */
export function useAnalysis(deps) {
  // 스트리밍 응답 처리 공통 함수
  async function processStreamingResponse(response, options = {}) {
    const { onDone, abortedMessage } = options
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let aiResponse = ''

    try {
      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        // AbortController로 중단된 경우 체크
        if (deps.abortController.value.signal.aborted) {
          break
        }

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonData = JSON.parse(line.slice(6))

              if (jsonData.content) {
                aiResponse += jsonData.content
                deps.analysisResult.value += jsonData.content
                // 스크롤을 아래로 이동
                deps.scrollToBottom()
              } else if (jsonData.done) {
                // AI 응답을 채팅 이력에 추가
                if (aiResponse.trim()) {
                  const historyEntry = {
                    type: 'ai',
                    content: aiResponse,
                    timestamp: new Date()
                  }
                  if (onDone) {
                    Object.assign(historyEntry, onDone)
                  }
                  deps.chatHistory.value.push(historyEntry)
                }
                deps.analysisResult.value = '' // 현재 분석 결과 초기화
                deps.scrollToBottom()
                break
              } else if (jsonData.error) {
                deps.errorMessage.value = jsonData.error
                deps.scrollToBottom()
                break
              }
            } catch (parseError) {
              // console.warn('MSA4: Failed to parse JSON:', parseError);
            }
          }
        }

        // 메인 스레드가 다른 작업을 처리할 수 있도록 양보
        await new Promise(resolve => setTimeout(resolve, 0))
      }
    } finally {
      // reader를 안전하게 닫기
      try {
        reader.releaseLock()
      } catch (e) {
        // 이미 닫혀있거나 에러가 발생해도 무시
      }
    }

    return aiResponse
  }

  // 공통 API 호출 + 스트리밍 처리 함수
  async function executeStreamingRequest(requestData, options = {}) {
    const { onDone, abortedMessage, errorPrefix } = options

    deps.isAnalyzing.value = true
    deps.analysisResult.value = ''
    deps.errorMessage.value = ''

    // 스크롤을 아래로
    deps.scrollToBottom()

    // AbortController 생성 (중단 기능용)
    deps.abortController.value = new AbortController()

    try {
      const response = await fetch('http://localhost:8000/api/imagestorage/chats/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
        signal: deps.abortController.value.signal
      })

      if (!response.ok) {
        if (response.status === 200 && response.headers.get('content-type')?.includes('application/json')) {
          const result = await response.json()
          if (result.status === 'busy') {
            deps.errorMessage.value = '이미 다른 분석이 진행 중입니다. 잠시 후 다시 시도해주세요.'
            deps.scrollToBottom()
            return
          }
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // 스트리밍 응답 처리
      await processStreamingResponse(response, { onDone, abortedMessage })

    } catch (error) {
      if (error.name === 'AbortError') {
        // 중단된 응답이 있다면 채팅 이력에 저장
        if (deps.analysisResult.value && deps.analysisResult.value.trim()) {
          const historyEntry = {
            type: 'ai',
            content: deps.analysisResult.value + '\n\n[' + (abortedMessage || '응답이 중단되었습니다') + ']',
            timestamp: new Date(),
            isInterrupted: true
          }
          if (onDone) {
            Object.assign(historyEntry, onDone)
          }
          deps.chatHistory.value.push(historyEntry)
          deps.analysisResult.value = '' // 현재 분석 결과 초기화
        }
      } else {
        deps.errorMessage.value = `${errorPrefix || '오류가 발생했습니다'}: ${error.message}`
      }
      deps.scrollToBottom()
    } finally {
      deps.isAnalyzing.value = false
      deps.abortController.value = null
    }
  }

  async function sendChatMessage(message) {
    // 채팅 이력과 현재 이미지 정보를 포함한 데이터 구성
    const chatData = {
      type: 'chat',
      message: message,
      history: deps.chatHistory.value.slice(-10).map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content,
        timestamp: msg.timestamp
      })), // 최근 10개 메시지만 포함하고 백엔드 형식에 맞게 변환
      images: deps.currentAnalysisImages.value || [] // 현재 분석 중인 이미지들
    }

    await executeStreamingRequest(chatData, {
      abortedMessage: '응답이 중단되었습니다',
      errorPrefix: '채팅 중 오류가 발생했습니다'
    })
  }

  async function sendToBackend(data) {
    // 데이터 형식 확인 및 정규화
    const analysisRequestData = {
      ...data,
      history: deps.chatHistory.value.slice(-5).map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content,
        timestamp: msg.timestamp
      })) // 이미지 분석 시에도 최근 채팅 이력 포함
    }

    await executeStreamingRequest(analysisRequestData, {
      onDone: { isAnalysis: true },
      abortedMessage: '분석이 중단되었습니다',
      errorPrefix: '분석 중 오류가 발생했습니다'
    })
  }

  async function processAnalysisData(data) {
    // 이미 분석 중이라면 새로운 요청을 보내지 않음
    if (deps.isAnalyzing.value) {
      return
    }

    // 마지막 처리 데이터 저장
    deps.lastProcessedData.value = JSON.parse(JSON.stringify(data))

    // 유사도 계산 처리 (msa2, msa3와 동일한 코사인 유사도 계산)
    const processedData = data.data || []
    console.log('MSA4: 원본 데이터 수신:', processedData.map((item, idx) => ({
      index: idx,
      imageName: item.imageName,
      similarity: item.similarity,
      similarityType: typeof item.similarity,
      fromMSA1: item.fromMSA1,
      distance: item.distance
    })))

    const processedAnalysisData = processedData.map((item, idx) => {
      let similarity = item.similarity

      // MSA1에서 온 데이터인지 확인 (fromMSA1 속성이 있거나 similarity가 이미 정확한 값인 경우)
      const isFromMSA1 = item.fromMSA1 === true || (item.similarity && typeof item.similarity === 'number' && item.similarity > 0)

      console.log(`MSA4: 처리 중인 아이템 ${idx}:`, {
        imageName: item.imageName,
        originalSimilarity: item.similarity,
        originalSimilarityType: typeof item.similarity,
        fromMSA1: item.fromMSA1,
        isFromMSA1: isFromMSA1,
        distance: item.distance
      })

      if (isFromMSA1) {
        // MSA1에서 온 데이터는 원본 similarity 값을 그대로 사용
        console.log(`MSA4: MSA1에서 온 데이터 - similarity 값 보존: ${item.similarity}`)
        similarity = item.similarity
      } else {
        // MSA1이 아닌 데이터만 similarity 재계산
        console.log(`MSA4: MSA1이 아닌 데이터 - similarity 재계산 시작`)
        // 유사도가 없거나 null인 경우 코사인 유사도로 계산
        if (similarity === undefined || similarity === null) {
          if (item.distance !== undefined && item.distance !== null) {
            // 코사인 유사도 기반 계산 (msa2, msa3와 동일한 방식)
            if (item.distance === 0) {
              similarity = 100 // 완전히 동일한 경우
            } else {
              // 거리를 코사인 유사도로 변환
              const cosineSimilarity = Math.max(0, 1 - (item.distance * item.distance / 2))
              similarity = Math.round(cosineSimilarity * 100)
            }
          } else {
            similarity = 50 // 기본값
          }
        }
        console.log(`MSA4: similarity 계산 결과: ${similarity}`)
      }

      const result = {
        ...item,
        similarity: similarity
      }

      console.log(`MSA4: 최종 처리 결과 ${idx}:`, {
        imageName: result.imageName,
        finalSimilarity: result.similarity,
        finalSimilarityType: typeof result.similarity,
        fromMSA1: result.fromMSA1
      })

      return result
    })

    console.log('MSA4: 최종 processedAnalysisData:', processedAnalysisData.map((item, idx) => ({
      index: idx,
      imageName: item.imageName,
      similarity: item.similarity,
      similarityType: typeof item.similarity,
      fromMSA1: item.fromMSA1
    })))

    deps.analysisData.value = processedAnalysisData
    deps.currentAnalysisImages.value = [...deps.analysisData.value]
    deps.hasAnalysisData.value = deps.analysisData.value.length > 0
    deps.analysisResult.value = ''
    deps.errorMessage.value = ''

    if (deps.hasAnalysisData.value) {
      await sendToBackend(data)
    }
  }

  function handleAnalysisData(data) {
    // 메인 페이지에서 호출되는 메서드
    // 이미 분석 중이라면 새로운 요청을 무시
    if (deps.isAnalyzing.value) {
      return
    }

    // 중복 데이터 체크 - 같은 데이터가 연속으로 오는 경우 무시
    if (deps.isDuplicateData(data)) {
      return
    }

    // 디바운스 처리 - 짧은 시간 내에 여러 요청이 오면 마지막 것만 처리
    if (deps.debounceTimer.value) {
      clearTimeout(deps.debounceTimer.value)
    }

    deps.debounceTimer.value = setTimeout(() => {
      processAnalysisData(data)
      deps.debounceTimer.value = null
    }, 300) // 300ms 디바운스
  }

  function stopAnalysis() {
    if (deps.abortController.value) {
      // 현재 진행 중인 응답이 있다면 채팅 이력에 저장
      if (deps.analysisResult.value && deps.analysisResult.value.trim()) {
        deps.chatHistory.value.push({
          type: 'ai',
          content: deps.analysisResult.value + '\n\n[응답이 중단되었습니다]',
          timestamp: new Date(),
          isInterrupted: true
        })
        deps.analysisResult.value = '' // 현재 분석 결과 초기화
      }

      deps.abortController.value.abort()
      deps.scrollToBottom()
    }
    deps.isAnalyzing.value = false
  }

  return {
    handleAnalysisData,
    processAnalysisData,
    sendChatMessage,
    sendToBackend,
    stopAnalysis
  }
}
