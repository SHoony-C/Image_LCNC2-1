export const imageSelector = {
  // 인덱스로 이미지 선택
  selectImageByIndex(index) {
    console.log(`Vector Transform: 이미지 선택 (인덱스: ${index})`);
    if (index < 0 || index >= this.labels.length) {
      console.error(`Invalid image index: ${index}`);
      return;
    }
    
    const selectedLabel = this.labels[index];
    console.log(`선택된 이미지: ${selectedLabel}`);
    
    this.selectedIndex = index;
    this.selectedFilename = selectedLabel;
    this.selectedImageName = selectedLabel;
    
    this.updatePlotMarkers(index);
    
    this.$emit('image-selected', {
      index: index,
      label: selectedLabel,
      filename: selectedLabel
    });
    
    // MSA3 업데이트 이벤트 발송 (선택된 이미지)
    const msa3Event = new CustomEvent('msa2-to-msa3-image-selected', {
      detail: {
        filename: selectedLabel,
        index: index,
        url: this.getImageUrl(selectedLabel),
        source: 'main-selection'
      }
    });
    document.dispatchEvent(msa3Event);
    console.log('[MSA2] 선택된 이미지 정보가 MSA3로 전송됨:', selectedLabel);
    
    // 유사 이미지들 찾기 및 MSA3에 전송
    this.findAndSendSimilarImages(index);
    
    this.findSimilarImagesByDistance(index).then(similarImages => {
      console.log(`유사 이미지 ${similarImages.length}개 찾음`);
      
      const msa5Event = new CustomEvent('msa4-to-msa5-similar-images', {
        detail: {
          selectedImage: {
            filename: selectedLabel,
            index: index,
            url: this.getImageUrl(selectedLabel)
          },
          similarImages: similarImages
        }
      });
      document.dispatchEvent(msa5Event);
      console.log('[MSA4] 유사 이미지 데이터가 MSA5로 전송됨');
    });
  },

  // 유사 이미지들 찾기 및 MSA3에 전송
  findAndSendSimilarImages(selectedIndex) {
    if (!this.projectedVectors || this.projectedVectors.length === 0) {
      console.log('벡터 데이터가 없어 유사 이미지를 찾을 수 없습니다');
      return;
    }
    
    const tagGroups = this.getTagGroups();
    const selectedPoint = this.projectedVectors[selectedIndex];
    
    // 가장 가까운 점들 찾기 (각 태그별로 3개씩)
    const iAppIndices = tagGroups['I-app'] || [];
    const analysisIndices = tagGroups['Analysis'] || [];
    
    const iAppDistances = [];
    const analysisDistances = [];
    
    for (let i = 0; i < this.projectedVectors.length; i++) {
      if (i === selectedIndex) continue;
      
      const distance = this.calculate3DDistance(selectedPoint, this.projectedVectors[i]);
      const isCurrentIApp = iAppIndices.includes(i);
      
      if (isCurrentIApp) {
        iAppDistances.push({ index: i, distance });
      } else {
        analysisDistances.push({ index: i, distance });
      }
    }
    
    // 거리순 정렬 후 상위 3개씩 선택
    iAppDistances.sort((a, b) => a.distance - b.distance);
    analysisDistances.sort((a, b) => a.distance - b.distance);
    
    const topIApp = iAppDistances.slice(0, 3);
    const topAnalysis = analysisDistances.slice(0, 3);
    
    // 유사 이미지들을 MSA3에 전송할 형태로 변환
    const similarImages = [...topIApp, ...topAnalysis].map((img, idx) => ({
      filename: this.labels[img.index],
      index: img.index,
      url: this.getImageUrl(this.labels[img.index]),
      distance: img.distance,
      similarity: (1 - Math.min(img.distance, 1)) * 100,
      tag_type: topIApp.includes(img) ? 'I-app' : 'Analysis',
      similarityRank: idx + 1
    }));
    
    // MSA3에 유사 이미지들을 배열로 한 번에 전송
    if (similarImages.length > 0) {
      const msa3SimilarEvent = new CustomEvent('msa2-to-msa3-similar-images', {
        detail: similarImages
      });
      document.dispatchEvent(msa3SimilarEvent);
      console.log(`[MSA2] 유사 이미지 ${similarImages.length}개가 MSA3로 전송됨:`, similarImages.map(img => img.filename));
    }
  },

  // MSA1 요소 찾기 및 모니터링
  findAndMonitorMSA1() {
    const selectors = [
      '#msa1-component',
      '.msa1-component',
      '[data-component="msa1"]',
      '.msa1',
      '.top-row .msa1',
      '.main-container .msa1',
      '.upper-section .msa1',
      'div[id*="msa1"]',
      'div[class*="msa1"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        console.log(`MSA1 element found with selector: ${selector}`);
        this.msa1Element = element;
        this.setupMSA1Listeners(element);
        return;
      }
    }

    const msa5Selectors = [
      '#msa5-component',
      '.msa5-component',
      '[data-component="msa5"]',
      '.msa5',
      '.bottom-row .msa5',
      'div[id*="msa5"]',
      'div[class*="msa5"]'
    ];

    for (const selector of msa5Selectors) {
      const element = document.querySelector(selector);
      if (element) {
        console.log(`MSA5 element found with selector: ${selector}`);
        this.msa5Element = element;
      }
    }

    if (!this.msa1Element && this.msa1FindAttempts < this.maxFindAttempts) {
      this.msa1FindAttempts++;
      console.log(`MSA1 element not found, retrying (${this.msa1FindAttempts}/${this.maxFindAttempts})`);
      setTimeout(() => this.findAndMonitorMSA1(), 1000);
    } else if (!this.msa1Element) {
      console.log('Failed to find MSA1 element after maximum attempts');
    }
  },

  // MSA1 리스너 설정
  setupMSA1Listeners(element) {
    const fileInputs = element.querySelectorAll('input[type="file"]');
    if (fileInputs.length > 0) {
      fileInputs.forEach(input => {
        input.addEventListener('change', this.handleMSA1FileInputChange);
        console.log('Added file input change listener to MSA1');
      });
    }
    
    const images = element.querySelectorAll('img');
    if (images.length > 0) {
      images.forEach(img => {
        img.addEventListener('load', this.handleMSA1ImageLoad);
        console.log('Added image load listener to MSA1');
      });
    }
  },

  // 유사한 점들 태그별 하이라이트
  highlightSimilarPointsByTag(selectedIndex) {
    const tagGroups = this.getTagGroups();
    const selectedTag = this.labels[selectedIndex].includes('_before') ? 'I-app' : 'Analysis';
    const sameTagIndices = tagGroups[selectedTag] || [];
    
    const distances = [];
    for (const index of sameTagIndices) {
      if (index === selectedIndex) continue;
      
      const distance = this.calculate3DDistance(
        this.projectedVectors[selectedIndex],
        this.projectedVectors[index]
      );
      
      distances.push({
        index,
        distance,
        similarity: 1 - Math.min(distance, 1)
      });
    }
    
    distances.sort((a, b) => a.distance - b.distance);
    
    const topSimilar = distances.slice(0, 3);
    
    if (topSimilar.length === 0) {
      return [];
    }
    
    const similarPointsTrace = {
      type: 'scatter3d',
      mode: 'markers',
      x: topSimilar.map(p => this.projectedVectors[p.index][0]),
      y: topSimilar.map(p => this.projectedVectors[p.index][1]),
      z: topSimilar.map(p => this.projectedVectors[p.index][2]),
      text: topSimilar.map(p => `${this.labels[p.index]} (유사도: ${Math.round(p.similarity * 100)}%)`),
      hoverinfo: 'text',
      marker: {
        size: 7,
        color: 'rgba(0, 255, 0, 1)',
        symbol: 'circle',
        line: {
          color: 'white',
          width: 1
        }
      },
      name: '태그 내 유사 이미지',
      showlegend: true
    };
      
    return [similarPointsTrace];
  },

  // 시각화 초기화
  initializeVisualization() {
    console.log('[MSA4] 시각화 초기화 시작');
    
    this.createVisualization();
    
    setTimeout(() => {
      this.checkVectorsData();
    }, 1000);
  }
} 