export const dataProcessor = {
  // 벡터 데이터 확인
  async checkVectorsData() {
    console.log('[MSA4] Checking vector data availability');
    
    this.vectors = [];
    this.projectedVectors = [];
    this.labels = [];
    this.imageLabels = [];
    this.markerColors = [];
    this.markerSizes = [];
    this.similarImages = [];
    this.selectedImage = null;
    this.selectedFilename = null;
    this.selectedImageIndex = -1;
    this.selectedIndex = -1;
    
    if (this.vectors && this.vectors.length > 0) {
      console.log(`Vector data already loaded, ${this.vectors.length} vectors available`);
      return;
    }
    
    this.loadingMessage = '벡터 데이터 로딩 중...';
    this.isLoading = true;
    
    try {
      console.log('직접 파일 접근으로 벡터 로드 시도...');
      
      const timestamp = new Date().getTime();
      const processedVectorsResponse = await fetch(`http://localhost:8000/storage/vector/processed_vectors.json?t=${timestamp}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      const processedMetadataResponse = await fetch(`http://localhost:8000/storage/vector/processed_metadata.json?t=${timestamp}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (processedVectorsResponse.ok && processedMetadataResponse.ok) {
        const vectors = await processedVectorsResponse.json();
        const metadata = await processedMetadataResponse.json();
        
        if (vectors && vectors.length > 0 && metadata && metadata.length > 0) {
          console.log(`직접 파일에서 로드: ${vectors.length} 벡터, ${metadata.length} 메타데이터`);
          
          const vectorsCopy = JSON.parse(JSON.stringify(vectors));
          const metadataCopy = JSON.parse(JSON.stringify(metadata));
          
          this.processVectorData(vectorsCopy, metadataCopy);
          this.isDataLoaded = true;
          this.loadingComplete = true;
          this.loadingMessage = '';
          this.showMessage('벡터 데이터를 직접 파일에서 로드했습니다', 'info');
          return;
        }
      }
      
      throw new Error('직접 파일 접근 실패');
    } catch (fileError) {
      console.log(`직접 파일 접근 오류: ${fileError.message}`);
      this.loadingComplete = true;
      this.isLoading = false;
      this.showMessage('벡터 데이터를 로드할 수 없습니다', 'error');
    }
  },

  // 벡터 데이터 처리 함수
  processVectorData(vectors, labels) {
    console.log(`Processing vector data: ${vectors.length} vectors, ${labels?.length || 0} labels`);
    
    if (!vectors || vectors.length === 0) {
      this.displayErrorMessage('유효한 벡터 데이터가 없습니다.');
      return;
    }
    
    this.vectors = [...vectors];
    
    console.log('Original labels received:', labels);
    
    if (labels && Array.isArray(labels) && labels.length > 0) {
      this.labels = [...labels];
      console.log(`Using ${labels.length} original image labels`);
    } else {
      this.labels = Array(vectors.length).fill().map((_, i) => `fallback_${i+1}`);
      console.log('No labels provided, using fallback labels');
    }
    
    this.imageLabels = [...this.labels];
    
    this.projectedVectors = vectors.map(vector => {
      if (vector.length >= 3) {
        return [vector[0], vector[1], vector[2]];
      } else if (vector.length === 2) {
        return [vector[0], vector[1], 0];
      } else {
        return [Math.random(), Math.random(), Math.random()];
      }
    });
    
    this.markerColors = Array(vectors.length).fill('#1f77b4');
    this.markerSizes = Array(vectors.length).fill(6);
    
    console.log(`Processed ${this.projectedVectors.length} vectors for 3D visualization`);
    
    this.updateData();
    this.isDataLoaded = true;
    this.loadingComplete = true;
    this.isLoading = false;
  },

  // 벡터 추출
  async extractVectors() {
    this.isProcessing = true;
    this.loadingMessage = '이미지 벡터 추출 중...';
    
    try {
      const response = await fetch('/api/msa4/extract-vectors', {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        this.vectors = data.vectors;
        this.labels = data.labels;
        this.projectedVectors = data.projected_vectors;
        this.updateData();
        this.showMessage('벡터 추출이 완료되었습니다', 'success');
      } else {
        this.showMessage('벡터 추출에 실패했습니다', 'error');
      }
    } catch (error) {
      console.error('Error extracting vectors:', error);
      this.showMessage('벡터 추출 중 오류가 발생했습니다', 'error');
    } finally {
      this.isProcessing = false;
      this.loadingMessage = '';
    }
  },

  // 태그 그룹 생성
  getTagGroups() {
    try {
      const tagGroups = {
        'I-app': [],
        'Analysis': []
      };
      
      if (!this.labels || this.labels.length === 0) {
        console.warn('라벨 배열이 비어있거나 정의되지 않았습니다.');
        return tagGroups;
      }
      
      for (let i = 0; i < this.labels.length; i++) {
        const label = this.labels[i];
        if (!label) {
          console.warn(`인덱스 ${i}의 라벨이 undefined 또는 null입니다. 건너뜁니다.`);
          continue;
        }
        
        if (typeof label === 'string' && label.includes('_before')) {
          tagGroups['I-app'].push(i);
        } else {
          tagGroups['Analysis'].push(i);
        }
      }
      
      return tagGroups;
    } catch (error) {
      console.error('태그 그룹 생성 오류:', error);
      return { 'I-app': [], 'Analysis': [] };
    }
  },

  // 타임스탬프 제거 함수
  removeTimestamp(filename) {
    if (!filename) return filename;
    return filename.replace(/^\d{8}_\d{6}_/, '');
  },

  // 이미지명 정규화 함수
  normalizeImageName(filename) {
    return this.removeTimestamp(filename);
  },

  // 3D 거리 계산
  calculate3DDistance(point1, point2) {
    if (!point1 || !point2 || point1.length < 3 || point2.length < 3) {
      return Infinity;
    }
    
    const dx = point1[0] - point2[0];
    const dy = point1[1] - point2[1];
    const dz = point1[2] - point2[2];
    
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  },

  // 거리 기반으로 유사 이미지 찾기
  findSimilarImagesByDistance(selectedIndex) {
    console.log(`Finding similar images for index ${selectedIndex} using distance-based method`);
    
    return new Promise((resolve, reject) => {
      try {
        if (!this.projectedVectors || !this.projectedVectors[selectedIndex]) {
          console.log('No projected vectors available');
          resolve([]);
          return;
        }
        
        const selectedVector = this.projectedVectors[selectedIndex];
        const selectedIsIApp = this.labels[selectedIndex] && this.labels[selectedIndex].includes('_before');
        
        const iAppDistances = [];
        const analysisDistances = [];
        
        for (let idx = 0; idx < this.projectedVectors.length; idx++) {
          if (idx === selectedIndex) continue;
          
          const vector = this.projectedVectors[idx];
          if (!vector) continue;
          
          const isIApp = this.labels[idx] && this.labels[idx].includes('_before');
          const distance = this.calculate3DDistance(selectedVector, vector);
          
          if (isIApp) {
            iAppDistances.push({
              index: idx,
              filename: this.labels[idx],
              distance: distance,
              tag_type: 'I-app'
            });
          } else {
            analysisDistances.push({
              index: idx,
              filename: this.labels[idx],
              distance: distance,
              tag_type: 'Analysis'
            });
          }
        }
        
        iAppDistances.sort((a, b) => a.distance - b.distance);
        analysisDistances.sort((a, b) => a.distance - b.distance);
        
        console.log(`I-app 태그 이미지: ${iAppDistances.length}개, Analysis 태그 이미지: ${analysisDistances.length}개`);
        
        const topIAppImages = iAppDistances.slice(0, 3);
        const topAnalysisImages = analysisDistances.slice(0, 3);
        
        const transformToSimilarImage = (item) => {
          const maxDistance = 1.732;
          const normalizedDistance = Math.min(item.distance / maxDistance, 1);
          const similarity = Math.round((1 - normalizedDistance) * 100);
          
          return {
            filename: item.filename,
            similarity: similarity,
            url: this.getImageUrl(item.filename),
            tag_type: item.tag_type
          };
        };
        
        const iappImages = topIAppImages.map(transformToSimilarImage);
        const analysisImages = topAnalysisImages.map(transformToSimilarImage);
        const similarImages = [...iappImages, ...analysisImages];
        
        console.log(`태그별 유사 이미지 처리 완료 - I-app: ${iappImages.length}개, Analysis: ${analysisImages.length}개, 총: ${similarImages.length}개`);
        
        this.similarImages = similarImages;
        
        resolve(similarImages);
      } catch (error) {
        console.error('Error finding similar images by distance:', error);
        resolve([]);
      }
    });
  },

  // API 엔드포인트 설정
  getApiEndpoint(path) {
    const baseUrl = 'http://localhost:8000';
    return `${baseUrl}${path}`;
  },

  // 이미지 URL 생성
  getImageUrl(filename) {
    if (!filename) return '';
    
    if (filename === 'main' || filename.includes('localhost') || 
        filename.includes('undefined') || filename.includes('null')) {
      console.warn(`MSA2: 유효하지 않은 이미지 파일명: ${filename}, 기본 이미지 URL 반환`);
      return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2NjY2NjYyIgc3Ryb2tlLXdpZHRoPSIyIj48cGF0aCBkPSJNMTAgMTQgMTIgMTEuNSAxNCAxNCIvPjxwYXRoIGQ9Ik0yMCAxM3YtNGExIDEgMCAwIDAtMS0xSDVhMSAxIDAgMCAwLTEgMXY0Ii8+PHBhdGggZD0iTTEgMTd2NGExIDEgMCAwIDAgMSAxaDIwYTEgMSAwIDAgMCAxLTF2LTRhMSAxIDAgMCAwLTEtMUgyYTEgMSAwIDAgMC0xIDF6Ii8+PC9zdmc+';
    }
    
    let imageFilename = encodeURIComponent(filename);
    
    console.log(`Getting image URL for: ${filename} (encoded: ${imageFilename})`);
    
    if (filename.startsWith('http://') || filename.startsWith('https://')) {
      return filename;
    }
    
    return `http://localhost:8000/api/imageanalysis/images/${imageFilename}`;
  }
} 