

3번

// 유사 이미지 처리
    handleSimilarImagesFound(images) {
      console.log('▶ handleSimilarImagesFound 시작', { images });
      if (!images || !Array.isArray(images)) {
        console.log('⚠️ handleSimilarImagesFound: images가 배열이 아닙니다.');
        return;
      }
      
      // MSA1에서 온 데이터인지 확인
      const isFromMSA1 = images.length > 0 && images[0].fromMSA1;
      console.log(`MSA1 여부: ${isFromMSA1}`, images[0]);

      // MSA1 데이터가 아니고, 이미 처리 중인 경우 중복 방지
      if (!isFromMSA1 && this.isProcessingSimilarImages) {
        console.log('MSA3: 이미 처리 중이므로 중복 호출 무시');
        return;
      }
      if (!isFromMSA1) {
        this.isProcessingSimilarImages = true;
      }

      try {
        // MSA1에서 온 데이터인 경우 원본 similarity 값을 보존
        if (isFromMSA1) {
          console.log('MSA1에서 온 데이터: 원본 similarity 값 보존');
          
          // 1) 전처리 단계 - MSA1 데이터는 similarity 값을 그대로 사용
          const processedImages = images.map((img, idx) => {
            const imageUrl = img.url || this.getImageUrl(img.filename);
            // MSA1에서 온 데이터는 원본 similarity 값을 그대로 사용
            const similarity = img.similarity != null ? img.similarity : null;
            let tagType = img.tag_type || (this.isIAppTag(img.filename) ? 'I-TAP' : 'Analysis');
            console.log(`[MSA1 전처리 ${idx}]`, {
              filename: img.filename,
              originalSimilarity: img.similarity,
              preservedSimilarity: similarity,
              computedTag: tagType,
              finalUrl: imageUrl
            });
            return { ...img, url: imageUrl, similarity, tag_type: tagType };
          });
          console.log('✅ MSA1 processedImages:', processedImages);

          // 2) 태그별 필터링
          const iappImages = processedImages.filter(img => img.tag_type === 'I-TAP');
          const analysisImages = processedImages.filter(img => img.tag_type === 'Analysis');
          console.log(`🔖 MSA1 태그별 필터링: I-TAP(${iappImages.length}), Analysis(${analysisImages.length})`);

          // 3) 정렬 전 샘플 확인
          console.log('MSA1 정렬 전 샘플 (I-TAP):', iappImages.slice(0,3));
          console.log('MSA1 정렬 전 샘플 (Analysis):', analysisImages.slice(0,3));

          // 4) 유사도 순으로 정렬 (원본 similarity 값 사용)
          iappImages.sort((a, b) => b.similarity - a.similarity);
          analysisImages.sort((a, b) => b.similarity - a.similarity);
          console.log('✅ MSA1 정렬된 I-TAP 상위 3:', iappImages.slice(0,3));
          console.log('✅ MSA1 정렬된 Analysis 상위 3:', analysisImages.slice(0,3));

          // 5) 상위 3개씩 선택
          const selectedIappImages = iappImages.slice(0, 3);
          const selectedAnalysisImages = analysisImages.slice(0, 3);
          console.log('▶ MSA1 selectedIappImages:', selectedIappImages);
          console.log('▶ MSA1 selectedAnalysisImages:', selectedAnalysisImages);

          // 6) 최종 결합
          this.similarImages = [...selectedIappImages, ...selectedAnalysisImages];
          console.log('📝 MSA1 this.similarImages 업데이트 완료:', this.similarImages);

          // 7) MSA4 전송 조건
          console.log('MSA1 MSA4 전송 대상 Analysis 이미지:', selectedAnalysisImages);
          this.sendAnalysisImagesToMSA4(selectedAnalysisImages);
        } else {
          // MSA1이 아닌 다른 소스에서 온 데이터는 기존 로직 사용
          console.log('MSA1이 아닌 데이터: 기존 처리 로직 사용');
          
          // 1) 전처리 단계
          const processedImages = images.map((img, idx) => {
            const imageUrl = img.url || this.getImageUrl(img.filename);
            const similarity = img.similarity != null ? img.similarity : null;
            let tagType = img.tag_type || (this.isIAppTag(img.filename) ? 'I-TAP' : 'Analysis');
            console.log(`[전처리 ${idx}]`, {
              filename: img.filename,
              rawDistance: img.distance,
              rawSimilarity: img.similarity,
              computedTag: tagType,
              finalUrl: imageUrl
            });
            return { ...img, url: imageUrl, similarity, tag_type: tagType };
          });
          console.log('✅ processedImages:', processedImages);

          // 2) 태그별 필터링
          const iappImages = processedImages.filter(img => img.tag_type === 'I-TAP');
          const analysisImages = processedImages.filter(img => img.tag_type === 'Analysis');
          console.log(`🔖 태그별 필터링: I-TAP(${iappImages.length}), Analysis(${analysisImages.length})`);

          // 3) 정렬 전 샘플 확인
          console.log('정렬 전 샘플 (I-TAP):', iappImages.slice(0,3));
          console.log('정렬 전 샘플 (Analysis):', analysisImages.slice(0,3));

          // 4) 유사도 순으로 정렬
          iappImages.sort((a, b) => b.similarity - a.similarity);
          analysisImages.sort((a, b) => b.similarity - a.similarity);
          console.log('✅ 정렬된 I-TAP 상위 3:', iappImages.slice(0,3));
          console.log('✅ 정렬된 Analysis 상위 3:', analysisImages.slice(0,3));

          // 5) 상위 3개씩 선택
          const selectedIappImages = iappImages.slice(0, 3);
          const selectedAnalysisImages = analysisImages.slice(0, 3);
          console.log('▶ selectedIappImages:', selectedIappImages);
          console.log('▶ selectedAnalysisImages:', selectedAnalysisImages);

          // 6) 최종 결합
          this.similarImages = [...selectedIappImages, ...selectedAnalysisImages];
          console.log('📝 this.similarImages 업데이트 완료:', this.similarImages);

          // 7) MSA4 전송 조건
          console.log('MSA4 전송 대상 Analysis 이미지:', selectedAnalysisImages);
          this.sendAnalysisImagesToMSA4(selectedAnalysisImages);
        }
      } catch (error) {
        console.error('🚨 유사 이미지 처리 중 오류:', error);
      } finally {
        if (!isFromMSA1) {
          this.isProcessingSimilarImages = false;
          console.log('플래그 초기화: isProcessingSimilarImages = false');
        }
        console.log('handleSimilarImagesFound 종료');
      }
  },


  



2번

// msa3_image_display.vue에서 수정할 부분

// MSA2에서 보내는 유사 이미지 커스텀 이벤트 핸들러 (수정된 버전)
handleMSA2SimilarImages(event) {
  // MSA1 데이터 처리 중이면 무시
  if (this.isProcessingMSA1Data) {
    console.log('MSA3: MSA1 데이터 처리 중이므로 MSA2 유사 이미지 이벤트 무시');
    return;
  }
  
  // MSA2에서 온 데이터인지 확인 (fromMSA1 속성이 없거나 false인 경우)
  if (event.detail && Array.isArray(event.detail)) {
    const isFromMSA2 = event.detail.length > 0 && !event.detail[0].fromMSA1;
    
    if (isFromMSA2) {
      console.log('MSA3: MSA2에서 온 유사 이미지 데이터 처리');
      this.handleSimilarImagesFound(event.detail);
    } else {
      console.log('MSA3: MSA1에서 온 유사 이미지 데이터는 무시');
    }
  }
},




1번

// msa2_vector_plot.vue의 sendImageDataToMSA3 함수에서 수정할 부분

// 유사 이미지 검색 및 전송
this.findSimilarImagesByDistance(imageData.index)
  .then(similarImages => {
    // 유사 이미지가 있는 경우에만 전송
    if (similarImages && similarImages.length > 0) {
      // MSA2에서 온 데이터임을 명시
      const msa2SimilarImages = similarImages.map(img => ({
        ...img,
        fromMSA1: false // MSA2에서 온 데이터임을 명시
      }));
      
      // Vue 이벤트 버스를 통한 전송
      this.$eventBus.emit('similar-images-found', msa2SimilarImages);
      
      // DOM 이벤트를 통한 전송
      const similarEvent = new CustomEvent('msa2-to-msa3-similar-images', {
        detail: msa2SimilarImages,
        bubbles: true
      });
      document.dispatchEvent(similarEvent);
      
      // 이미지 개수 확인
      const iAppCount = msa2SimilarImages.filter(img => img.tag_type === 'I-TAP').length;
      const analysisCount = msa2SimilarImages.filter(img => img.tag_type === 'Analysis').length;
      
      console.log(`MSA2에서 전송: 선택된 이미지 1개 / ${msa2SimilarImages.length}개의 유사 이미지 (I-app: ${iAppCount}, Analysis: ${analysisCount})`);
    }
  })
  .catch(error => {
    console.error('유사 이미지 검색 및 전송 오류:', error);
  });