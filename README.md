

msa4
async processAnalysisData(data) {
      // console.log('MSA4: Received analysis data:', data);
      
      // 이미 분석 중이라면 새로운 요청을 보내지 않음
      if (this.isAnalyzing) {
        // console.log('MSA4: Already analyzing, skipping new request');
        return;
      }
      
      // 마지막 처리 데이터 저장
      this.lastProcessedData = JSON.parse(JSON.stringify(data));
      
      // 유사도 계산 처리 (msa2, msa3와 동일한 코사인 유사도 계산)
      const processedData = data.data || [];
      const processedAnalysisData = processedData.map(item => {
        let similarity = item.similarity;
        
        // 유사도가 없거나 null인 경우 코사인 유사도로 계산
        if (similarity === undefined || similarity === null) {
          if (item.distance !== undefined && item.distance !== null) {
            // 코사인 유사도 기반 계산 (msa2, msa3와 동일한 방식)
            if (item.distance === 0) {
              similarity = 100; // 완전히 동일한 경우
            } else {
              // 거리를 코사인 유사도로 변환
              const cosineSimilarity = Math.max(0, 1 - (item.distance * item.distance / 2));
              similarity = Math.round(cosineSimilarity * 100);
            }
          } else {
            similarity = 50; // 기본값
          }
        }
        
        return {
          ...item,
          similarity: similarity
        };
      });
      
      this.analysisData = processedAnalysisData;
      this.currentAnalysisImages = [...this.analysisData];
      this.hasAnalysisData = this.analysisData.length > 0;
      this.analysisResult = '';
      this.errorMessage = '';
      
      if (this.hasAnalysisData) {
        await this.sendToBackend(data);
      }
    },


msa2

// 이미지 변환 함수 - 정확한 코사인 유사도 계산
          const transformToSimilarImage = (item) => {
            const distance = item.distance;
            const selectedIndex = this.selectedImageIndex;
            
            // 원본 벡터를 사용한 정확한 코사인 유사도 계산
            if (this.vectors && this.vectors[selectedIndex] && this.vectors[item.index]) {
              const vectorA = this.vectors[selectedIndex];
              const vectorB = this.vectors[item.index];
              
              // 코사인 유사도 계산
              const dotProduct = vectorA.reduce((sum, val, i) => sum + val * vectorB[i], 0);
              const magnitudeA = Math.sqrt(vectorA.reduce((sum, val) => sum + val * val, 0));
              const magnitudeB = Math.sqrt(vectorB.reduce((sum, val) => sum + val * val, 0));
              
              const cosineSimilarity = dotProduct / (magnitudeA * magnitudeB);
              
              // 코사인 유사도를 백분율로 변환 (-1~1 → 0~100)
              const similarity = Math.round(((cosineSimilarity + 1) / 2) * 100);
              
              return {
                filename: item.filename,
                similarity: similarity,
                url: this.getImageUrl(item.filename),
                tag_type: item.tag_type,
                distance: distance
              };
            } else {
              // 원본 벡터가 없는 경우 거리 기반 근사 계산
              const similarity = Math.max(0, Math.round(100 - (distance * 20)));
              
              return {
                filename: item.filename,
                similarity: similarity,
                url: this.getImageUrl(item.filename),
                tag_type: item.tag_type,
                distance: distance
              };
            }
          };