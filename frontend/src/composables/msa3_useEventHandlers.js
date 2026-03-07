/**
 * Composable for MSA3 cross-component event handling (MSA1, MSA2 events).
 *
 * @param {Object} deps - Dependencies
 * @param {import('vue').Ref} deps.mainImage - Main image ref
 * @param {import('vue').Ref} deps.similarImages - Similar images array ref
 * @param {import('vue').Ref} deps.isProcessingMSA1Data - MSA1 processing flag ref
 * @param {import('vue').Ref} deps.lastMSA1ProcessTime - Last MSA1 process time ref
 * @param {import('vue').Ref} deps.isProcessingSimilarImages - Similar images processing flag ref
 * @param {Function} deps.isIAppTag - Function to check I-TAP tag
 * @param {Function} deps.getImageUrl - Function to get image URL
 * @param {Function} deps.sendAnalysisImagesToMSA4 - Function to send analysis images to MSA4
 * @param {Function} deps.handleMainImageChanged - Function to handle main image change
 * @param {Function} deps.fetchWorkflowInfo - Function to fetch workflow info
 * @returns Event handler functions
 */
export function useEventHandlers(deps) {
  const {
    mainImage, similarImages,
    isProcessingMSA1Data, lastMSA1ProcessTime,
    isProcessingSimilarImages,
    isIAppTag, getImageUrl,
    sendAnalysisImagesToMSA4, handleMainImageChanged,
    fetchWorkflowInfo
  } = deps

  // MSA2에서 보내는 커스텀 이벤트 핸들러
  function handleMSA2Event(event) {
    // MSA1 데이터 처리 중이면 완전히 무시
    if (isProcessingMSA1Data.value) {
      console.log('MSA3: MSA1 데이터 처리 중이므로 MSA2 이벤트 완전 무시')
      return
    }

    if (event.detail) {
      handleImageSelected(event.detail)
    }
  }

  // MSA2에서 보내는 유사 이미지 커스텀 이벤트 핸들러 (수정된 버전)
  function handleMSA2SimilarImages(event) {
    // MSA1 데이터 처리 중이면 완전히 무시
    if (isProcessingMSA1Data.value) {
      console.log('MSA3: MSA1 데이터 처리 중이므로 MSA2 유사 이미지 이벤트 완전 무시')
      return
    }

    // MSA1에서 온 데이터가 최근에 처리되었는지 확인 (3초 이내)
    const now = Date.now()
    const lastTime = lastMSA1ProcessTime.value || 0
    const timeSinceMSA1Process = now - lastTime

    if (timeSinceMSA1Process < 3000) { // 3초 이내
      console.log(`MSA3: MSA1 데이터 처리 후 ${timeSinceMSA1Process}ms 경과 - MSA2 데이터 무시`)
      return
    }

    // MSA2에서 온 데이터인지 확인 (fromMSA1 속성이 없거나 false인 경우)
    if (event.detail && Array.isArray(event.detail)) {
      const isFromMSA2 = event.detail.length > 0 && !event.detail[0].fromMSA1

      if (isFromMSA2) {
        console.log('MSA3: MSA2에서 온 유사 이미지 데이터 처리')
        handleSimilarImagesFound(event.detail)
      } else {
        console.log('MSA3: MSA1에서 온 유사 이미지 데이터는 무시')
      }
    }
  }

  // MSA1에서 보내는 유사 이미지 커스텀 이벤트 핸들러 (새로 추가)
  function handleMSA1SimilarImages(event) {
    console.log('=== MSA3: handleMSA1SimilarImages 함수 시작 ===')
    console.log('MSA3: 이벤트 데이터 전체:', event)
    console.log('MSA3: 이벤트 상세 데이터:', event.detail)

    // MSA1 데이터 처리 시작 플래그 설정
    isProcessingMSA1Data.value = true
    console.log('MSA3: isProcessingMSA1Data 플래그 설정됨:', isProcessingMSA1Data.value)

    try {
      console.log('[MSA3] MSA1에서 유사 이미지 데이터 수신:', event.detail)

      if (event.detail && event.detail.similarImages && Array.isArray(event.detail.similarImages)) {
        // MSA1 데이터 처리 시 기존 데이터 완전 초기화
        console.log('MSA3: MSA1 데이터 처리를 위해 기존 데이터 초기화')
        mainImage.value = null
        similarImages.value = []

        const similarImagesData = event.detail.similarImages
        console.log(`MSA3: 총 ${similarImagesData.length}개의 유사 이미지 수신`)

        // 받은 원본 데이터 로그 - 상세 정보
        console.log('MSA3: 원본 유사 이미지 데이터 상세:', similarImagesData.map((img, idx) => ({
          index: idx,
          filename: img.filename,
          similarity: img.similarity,
          similarityType: typeof img.similarity,
          distance: img.distance,
          tag_type: img.tag_type,
          fromMSA1: img.fromMSA1
        })))

        if (similarImagesData.length > 0) {
          // 유사도 순으로 정렬 (높은 순서대로) - 원본 similarity 값 사용
          const sortedImages = similarImagesData.sort((a, b) => {
            const similarityA = parseFloat(a.similarity) || 0
            const similarityB = parseFloat(b.similarity) || 0
            console.log(`MSA3: 정렬 비교 - ${a.filename}(${similarityA}%) vs ${b.filename}(${similarityB}%)`)
            return similarityB - similarityA // 내림차순 (높은 유사도가 먼저)
          })

          console.log('MSA3: 정렬된 이미지들 (유사도 높은 순):', sortedImages.map((img, index) => ({
            index: index,
            filename: img.filename,
            similarity: img.similarity,
            similarityType: typeof img.similarity,
            url: img.url
          })))

          // 가장 유사도 높은 이미지를 선택된 이미지로 설정
          const topImage = sortedImages[0]
          console.log(`MSA3: 최고 유사도 이미지 선택: ${topImage.filename} (유사도: ${topImage.similarity}%)`)
          console.log('MSA3: topImage 전체 객체:', topImage)
          console.log('MSA3: topImage의 모든 키:', Object.keys(topImage))
          console.log('MSA3: topImage similarity 값:', topImage.similarity)
          console.log('MSA3: topImage similarity 타입:', typeof topImage.similarity)

          // 메인 이미지로 직접 설정
          mainImage.value = {
            filename: topImage.filename,
            url: topImage.url || getImageUrl(topImage.filename),
            similarity: topImage.similarity, // 직접 similarity 설정
            fromMSA1: true
          }

          console.log('MSA3: mainImage 직접 설정 완료:', {
            filename: mainImage.value.filename,
            similarity: mainImage.value.similarity,
            similarityType: typeof mainImage.value.similarity,
            fromMSA1: mainImage.value.fromMSA1
          })

          const selectedImageData = {
            ...topImage,
            fromMSA1: true,
            url: topImage.url || getImageUrl(topImage.filename) // URL이 없으면 생성
          }

          console.log(`MSA3: 선택된 이미지 최종 정보:`, {
            filename: selectedImageData.filename,
            similarity: selectedImageData.similarity,
            similarityType: typeof selectedImageData.similarity,
            url: selectedImageData.url,
            fromMSA1: selectedImageData.fromMSA1
          })

          // selectedImageData의 모든 속성 출력
          console.log('MSA3: selectedImage 전체 객체:', selectedImageData)
          console.log('MSA3: selectedImage의 모든 키:', Object.keys(selectedImageData))
          console.log('MSA3: selectedImage의 모든 값:', Object.values(selectedImageData))

          // similarity 값이 제대로 있는지 확인
          if (selectedImageData.similarity !== undefined && selectedImageData.similarity !== null) {
            console.log('MSA3: selectedImage similarity 값 확인됨:', selectedImageData.similarity)
          } else {
            console.warn('MSA3: selectedImage similarity 값이 없음')
          }

          // 나머지 이미지들을 유사 이미지로 설정 (URL도 함께 설정)
          const remainingImages = sortedImages.slice(1).map(img => ({
            ...img,
            fromMSA1: true,
            url: img.url || getImageUrl(img.filename) // URL이 없으면 생성
          }))

          console.log(`MSA3: 나머지 ${remainingImages.length}개 이미지를 유사 이미지로 설정`)
          console.log('MSA3: 나머지 이미지들 상세:', remainingImages.map((img, idx) => ({
            index: idx,
            filename: img.filename,
            similarity: img.similarity,
            similarityType: typeof img.similarity,
            fromMSA1: img.fromMSA1
          })))

          // MSA1 데이터는 직접 처리하여 similarity 값 보호
          console.log('MSA3: processMSA1SimilarImages 함수 호출 시작')
          processMSA1SimilarImages(remainingImages)
          console.log('MSA3: processMSA1SimilarImages 함수 호출 완료')

          console.log('[MSA3] MSA1 유사 이미지 데이터 처리 완료')
          console.log('MSA3: 최종 mainImage 상태:', {
            filename: mainImage.value?.filename,
            url: mainImage.value?.url,
            similarity: mainImage.value?.similarity,
            similarityType: typeof mainImage.value?.similarity,
            fromMSA1: mainImage.value?.fromMSA1
          })
          console.log('MSA3: 최종 similarImages 상태:', similarImages.value.map((img, idx) => ({
            index: idx,
            filename: img.filename,
            similarity: img.similarity,
            similarityType: typeof img.similarity,
            fromMSA1: img.fromMSA1
          })))

          // MSA1 데이터 처리 완료 시간 기록
          lastMSA1ProcessTime.value = Date.now()
          console.log('MSA3: MSA1 데이터 처리 완료 시간 기록:', lastMSA1ProcessTime.value)
        } else {
          console.warn('MSA3: 유사 이미지가 없습니다')
        }
      } else {
        console.warn('MSA3: event.detail 또는 similarImages가 없습니다')
        console.warn('MSA3: event.detail:', event.detail)
        console.warn('MSA3: similarImages:', event.detail?.similarImages)
      }
    } catch (error) {
      console.error('[MSA3] MSA1 유사 이미지 데이터 처리 오류:', error)
      console.error('[MSA3] 오류 스택:', error.stack)
    } finally {
      // MSA1 데이터 처리 완료 플래그 즉시 해제
      isProcessingMSA1Data.value = false
      console.log('MSA3: MSA1 데이터 처리 완료 플래그 해제:', isProcessingMSA1Data.value)
    }

    console.log('=== MSA3: handleMSA1SimilarImages 함수 종료 ===')
  }

  // MSA1 데이터 전용 처리 함수 - similarity 값 완전 보호
  function processMSA1SimilarImages(images) {
    console.log('=== MSA1 전용 처리 함수 시작 - similarity 값 완전 보호 ===')
    console.log('MSA1 전용 처리: 입력 이미지 개수:', images.length)

    if (!images || !Array.isArray(images)) {
      console.log('MSA1 전용 처리: images가 배열이 아닙니다.')
      return
    }

    try {
      // MSA1 데이터는 원본 similarity 값을 절대 변경하지 않음
      console.log('MSA1 전용 처리: 원본 similarity 값 보존 시작')
      const processedImages = images.map((img, idx) => {
        const imageUrl = img.url || getImageUrl(img.filename)
        // MSA1에서 온 데이터는 원본 similarity 값을 절대 변경하지 않음
        const similarity = img.similarity // 원본 값 그대로 사용
        let tagType = img.tag_type || (isIAppTag(img.filename) ? 'I-TAP' : 'Analysis')
        console.log(`[MSA1 전용 처리 ${idx}]`, {
          filename: img.filename,
          originalSimilarity: img.similarity,
          originalSimilarityType: typeof img.similarity,
          preservedSimilarity: similarity,
          preservedSimilarityType: typeof similarity,
          computedTag: tagType,
          finalUrl: imageUrl,
          fromMSA1: img.fromMSA1
        })
        return { ...img, url: imageUrl, similarity, tag_type: tagType }
      })
      console.log('MSA1 전용 processedImages:', processedImages.map((img, idx) => ({
        index: idx,
        filename: img.filename,
        similarity: img.similarity,
        similarityType: typeof img.similarity,
        fromMSA1: img.fromMSA1
      })))

      // 태그별 필터링
      const iappImages = processedImages.filter(img => img.tag_type === 'I-TAP')
      const analysisImages = processedImages.filter(img => img.tag_type === 'Analysis')
      console.log(`MSA1 전용 태그별 필터링: I-TAP(${iappImages.length}), Analysis(${analysisImages.length})`)

      // 정렬 전 샘플 확인
      console.log('MSA1 전용 정렬 전 샘플 (I-TAP):', iappImages.slice(0, 3).map(img => ({
        filename: img.filename,
        similarity: img.similarity,
        similarityType: typeof img.similarity
      })))
      console.log('MSA1 전용 정렬 전 샘플 (Analysis):', analysisImages.slice(0, 3).map(img => ({
        filename: img.filename,
        similarity: img.similarity,
        similarityType: typeof img.similarity
      })))

      // 유사도 순으로 정렬 (원본 similarity 값 사용)
      iappImages.sort((a, b) => b.similarity - a.similarity)
      analysisImages.sort((a, b) => b.similarity - a.similarity)
      console.log('MSA1 전용 정렬된 I-TAP 상위 3:', iappImages.slice(0, 3).map(img => ({
        filename: img.filename,
        similarity: img.similarity,
        similarityType: typeof img.similarity
      })))
      console.log('MSA1 전용 정렬된 Analysis 상위 3:', analysisImages.slice(0, 3).map(img => ({
        filename: img.filename,
        similarity: img.similarity,
        similarityType: typeof img.similarity
      })))

      // 상위 3개씩 선택
      const selectedIappImages = iappImages.slice(0, 3)
      const selectedAnalysisImages = analysisImages.slice(0, 3)
      console.log('MSA1 전용 selectedIappImages:', selectedIappImages.map(img => ({
        filename: img.filename,
        similarity: img.similarity,
        similarityType: typeof img.similarity
      })))
      console.log('MSA1 전용 selectedAnalysisImages:', selectedAnalysisImages.map(img => ({
        filename: img.filename,
        similarity: img.similarity,
        similarityType: typeof img.similarity
      })))

      // 최종 결합
      similarImages.value = [...selectedIappImages, ...selectedAnalysisImages]
      console.log('MSA1 전용 this.similarImages 업데이트 완료:', similarImages.value.map((img, idx) => ({
        index: idx,
        filename: img.filename,
        similarity: img.similarity,
        similarityType: typeof img.similarity,
        fromMSA1: img.fromMSA1
      })))

      // MSA4 전송 조건
      console.log('MSA1 전용 MSA4 전송 대상 Analysis 이미지:', selectedAnalysisImages.map(img => ({
        filename: img.filename,
        similarity: img.similarity,
        similarityType: typeof img.similarity
      })))
      sendAnalysisImagesToMSA4(selectedAnalysisImages)

      console.log('=== MSA1 전용 처리 함수 완료 - similarity 값 완전 보호됨 ===')
    } catch (error) {
      console.error('MSA1 전용 처리 중 오류:', error)
      console.error('오류 스택:', error.stack)
    }
  }

  // 선택된 이미지 처리
  function handleImageSelected(image) {
    console.log('MSA3: handleImageSelected 호출됨 - 이미지:', image.filename, 'fromMSA1:', image.fromMSA1, 'similarity:', image.similarity)

    // 기존 mainImage의 similarity와 fromMSA1 값을 보존
    const existingSimilarity = mainImage.value ? mainImage.value.similarity : undefined
    const existingFromMSA1 = mainImage.value ? mainImage.value.fromMSA1 : undefined

    console.log('MSA3: 기존 mainImage 값들 - similarity:', existingSimilarity, 'fromMSA1:', existingFromMSA1)

    // 새로운 이미지로 설정하되, 기존 값들을 보존
    mainImage.value = {
      filename: image.filename,
      url: image.url || getImageUrl(image.filename),
      similarity: image.similarity !== undefined ? image.similarity : existingSimilarity,
      fromMSA1: image.fromMSA1 !== undefined ? image.fromMSA1 : existingFromMSA1
    }

    console.log('MSA3: mainImage 설정 완료 - filename:', mainImage.value.filename, 'fromMSA1:', mainImage.value.fromMSA1, 'similarity:', mainImage.value.similarity)

    // 메인 이미지 변경 처리 (MSA4로 데이터 전송 포함)
    handleMainImageChanged(mainImage.value)

    // 워크플로우 정보 요청 - 유효한 파일명인 경우에만
    if (image && image.filename &&
        !image.filename.includes('localhost') &&
        image.filename !== 'main' &&
        image.filename !== 'image' &&
        !image.filename.includes('undefined') &&
        !image.filename.includes('null')) {
      fetchWorkflowInfo(image.filename)
    }
  }

  // 유사 이미지 처리
  function handleSimilarImagesFound(images) {
    console.log('handleSimilarImagesFound 시작', { images })
    if (!images || !Array.isArray(images)) {
      console.log('handleSimilarImagesFound: images가 배열이 아닙니다.')
      return
    }

    // MSA1에서 온 데이터인지 확인
    const isFromMSA1 = images.length > 0 && images[0].fromMSA1
    console.log(`MSA1 여부: ${isFromMSA1}`, images[0])

    // MSA1 데이터가 아니고, 이미 처리 중인 경우 중복 방지
    if (!isFromMSA1 && isProcessingSimilarImages.value) {
      console.log('MSA3: 이미 처리 중이므로 중복 호출 무시')
      return
    }
    if (!isFromMSA1) {
      isProcessingSimilarImages.value = true
    }

    try {
      // MSA1에서 온 데이터인 경우 원본 similarity 값을 보존
      if (isFromMSA1) {
        console.log('MSA1에서 온 데이터: 원본 similarity 값 보존')

        // 1) 전처리 단계 - MSA1 데이터는 similarity 값을 그대로 사용
        const processedImages = images.map((img, idx) => {
          const imageUrl = img.url || getImageUrl(img.filename)
          // MSA1에서 온 데이터는 원본 similarity 값을 그대로 사용
          const similarity = img.similarity != null ? img.similarity : null
          let tagType = img.tag_type || (isIAppTag(img.filename) ? 'I-TAP' : 'Analysis')
          console.log(`[MSA1 전처리 ${idx}]`, {
            filename: img.filename,
            originalSimilarity: img.similarity,
            preservedSimilarity: similarity,
            computedTag: tagType,
            finalUrl: imageUrl
          })
          return { ...img, url: imageUrl, similarity, tag_type: tagType }
        })
        console.log('MSA1 processedImages:', processedImages)

        // 2) 태그별 필터링
        const iappImages = processedImages.filter(img => img.tag_type === 'I-TAP')
        const analysisImages = processedImages.filter(img => img.tag_type === 'Analysis')
        console.log(`MSA1 태그별 필터링: I-TAP(${iappImages.length}), Analysis(${analysisImages.length})`)

        // 3) 정렬 전 샘플 확인
        console.log('MSA1 정렬 전 샘플 (I-TAP):', iappImages.slice(0, 3))
        console.log('MSA1 정렬 전 샘플 (Analysis):', analysisImages.slice(0, 3))

        // 4) 유사도 순으로 정렬 (원본 similarity 값 사용)
        iappImages.sort((a, b) => b.similarity - a.similarity)
        analysisImages.sort((a, b) => b.similarity - a.similarity)
        console.log('MSA1 정렬된 I-TAP 상위 3:', iappImages.slice(0, 3))
        console.log('MSA1 정렬된 Analysis 상위 3:', analysisImages.slice(0, 3))

        // 5) 상위 3개씩 선택
        const selectedIappImages = iappImages.slice(0, 3)
        const selectedAnalysisImages = analysisImages.slice(0, 3)
        console.log('MSA1 selectedIappImages:', selectedIappImages)
        console.log('MSA1 selectedAnalysisImages:', selectedAnalysisImages)

        // 6) 최종 결합
        similarImages.value = [...selectedIappImages, ...selectedAnalysisImages]
        console.log('MSA1 this.similarImages 업데이트 완료:', similarImages.value)

        // 7) MSA4 전송 조건
        console.log('MSA1 MSA4 전송 대상 Analysis 이미지:', selectedAnalysisImages)
        sendAnalysisImagesToMSA4(selectedAnalysisImages)
      } else {
        // MSA1이 아닌 다른 소스에서 온 데이터는 기존 로직 사용
        console.log('MSA1이 아닌 데이터: 기존 처리 로직 사용')

        // 1) 전처리 단계
        const processedImages = images.map((img, idx) => {
          const imageUrl = img.url || getImageUrl(img.filename)
          const similarity = img.similarity != null ? img.similarity : null
          let tagType = img.tag_type || (isIAppTag(img.filename) ? 'I-TAP' : 'Analysis')
          console.log(`[전처리 ${idx}]`, {
            filename: img.filename,
            rawDistance: img.distance,
            rawSimilarity: img.similarity,
            computedTag: tagType,
            finalUrl: imageUrl
          })
          return { ...img, url: imageUrl, similarity, tag_type: tagType }
        })
        console.log('processedImages:', processedImages)

        // 2) 태그별 필터링
        const iappImages = processedImages.filter(img => img.tag_type === 'I-TAP')
        const analysisImages = processedImages.filter(img => img.tag_type === 'Analysis')
        console.log(`태그별 필터링: I-TAP(${iappImages.length}), Analysis(${analysisImages.length})`)

        // 3) 정렬 전 샘플 확인
        console.log('정렬 전 샘플 (I-TAP):', iappImages.slice(0, 3))
        console.log('정렬 전 샘플 (Analysis):', analysisImages.slice(0, 3))

        // 4) 유사도 순으로 정렬
        iappImages.sort((a, b) => b.similarity - a.similarity)
        analysisImages.sort((a, b) => b.similarity - a.similarity)
        console.log('정렬된 I-TAP 상위 3:', iappImages.slice(0, 3))
        console.log('정렬된 Analysis 상위 3:', analysisImages.slice(0, 3))

        // 5) 상위 3개씩 선택
        const selectedIappImages = iappImages.slice(0, 3)
        const selectedAnalysisImages = analysisImages.slice(0, 3)
        console.log('selectedIappImages:', selectedIappImages)
        console.log('selectedAnalysisImages:', selectedAnalysisImages)

        // 6) 최종 결합
        similarImages.value = [...selectedIappImages, ...selectedAnalysisImages]
        console.log('this.similarImages 업데이트 완료:', similarImages.value)

        // 7) MSA4 전송 조건
        console.log('MSA4 전송 대상 Analysis 이미지:', selectedAnalysisImages)
        sendAnalysisImagesToMSA4(selectedAnalysisImages)
      }
    } catch (error) {
      console.error('유사 이미지 처리 중 오류:', error)
    } finally {
      if (!isFromMSA1) {
        isProcessingSimilarImages.value = false
        console.log('플래그 초기화: isProcessingSimilarImages = false')
      }
      console.log('handleSimilarImagesFound 종료')
    }
  }

  return {
    handleMSA2Event,
    handleMSA2SimilarImages,
    handleMSA1SimilarImages,
    processMSA1SimilarImages,
    handleImageSelected,
    handleSimilarImagesFound
  }
}
