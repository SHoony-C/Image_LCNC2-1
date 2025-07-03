/**
 * MSA6 불량 감지 모듈 - 간단하고 확실한 박스 수축 방식
 * 핵심 개념:
 * 1. 빨간 박스가 1픽셀씩 안쪽으로 줄어듦
 * 2. 현재 박스를 파란 실선으로 표시
 * 3. 임계값 만나면 해당 위치에서 멈춤
 * 4. 멈춘 영역을 빨간 점으로 표시
 * 5. 최종 불량 영역을 녹색 원으로 표시 (가장자리만)
 * 6. 측정 완료 후 박스가 같은 속도로 사라짐
 */

export class DefectDetector {
  constructor(canvas, ctx, imageData, brightnessThreshold, isReversed = false, scaleBarExclusionArea = null) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.imageData = imageData;
    this.brightnessThreshold = brightnessThreshold - 20; // 더 엄격한 임계값
    this.isReversed = isReversed;
    this.isDetecting = false;
    this.originalImageData = null;
    this.scaleBarExclusionArea = scaleBarExclusionArea; // 스케일바 제외 영역 추가
    
    // 박스 수축을 위한 데이터
    this.currentBox = null; // 현재 박스 크기
    this.originalBox = null; // 원본 박스 크기 (경계 체크용)
    this.stoppedPixels = []; // 임계값에서 멈춘 픽셀들
    this.defectRegions = []; // 최종 불량 영역들
    this.isCompleting = false; // 완료 중 상태
    
    // console.log('DefectDetector 간단 박스 수축 방식 초기화:', {
    //   canvasSize: { width: canvas.width, height: canvas.height },
    //   adjustedThreshold: this.brightnessThreshold,
    //   originalThreshold: brightnessThreshold,
    //   scaleBarExclusionArea: this.scaleBarExclusionArea
    // });
  }

  /**
   * 불량 감지 시작
   */
  async startDetection(boundingBox, onProgress = null, onComplete = null) {
    // console.log('=== 간단 박스 수축 불량 감지 시작 ===', boundingBox);
    
    if (this.isDetecting) {
      console.warn('이미 감지가 진행 중입니다.');
      return;
    }

    this.isDetecting = true;
    this.isCompleting = false;
    this.stoppedPixels = [];
    this.defectRegions = [];
    
    // 원본 이미지 데이터 백업
    this.originalImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    
    try {
      const validBox = this.validateBoundingBox(boundingBox);
      if (!validBox) {
        throw new Error('유효하지 않은 감지 영역입니다.');
      }

      // 현재 박스를 초기 영역으로 설정
      this.currentBox = { ...validBox };
      this.originalBox = { ...validBox }; // 원본 박스 저장
      
      // console.log('초기 박스:', this.currentBox);
      
      // 박스 수축 감지 수행
      await this.performBoxShrinkingDetection(onProgress, onComplete);
      
    } catch (error) {
      console.error('불량 감지 중 오류 발생:', error);
      if (onComplete) onComplete([], error);
    } finally {
      this.isDetecting = false;
      this.isCompleting = false;
    }
  }

  /**
   * 박스 수축 감지 수행
   */
  performBoxShrinkingDetection(onProgress, onComplete) {
    return new Promise((resolve) => {
      const maxSteps = Math.min(this.currentBox.width, this.currentBox.height) / 2 - 3;
      let currentStep = 0;
      
      // console.log(`박스 수축 감지 시작: 최대 ${maxSteps} 단계`);
      
      const executeStep = () => {
        if (!this.isDetecting || currentStep >= maxSteps || 
            this.currentBox.width <= 6 || this.currentBox.height <= 6) {
          // 감지 완료 - 불량 영역 분석
          this.finalizeDetection();
          
          // console.log('박스 수축 감지 완료:', {
          //   totalSteps: currentStep,
          //   stoppedPixels: this.stoppedPixels.length,
          //   defectRegions: this.defectRegions.length
          // });
          
          // 완료 후 즉시 최종 결과 표시 (파란 박스 완전 제거)
          this.drawFinalResults();
          
          // 결과 반환
          const results = this.getResults();
          // console.log('최종 결과 반환:', results);
          if (onComplete) onComplete(results);
          
          resolve();
          return;
        }

        // 캔버스 지우고 원본 이미지 복원
        this.ctx.putImageData(this.originalImageData, 0, 0);
        
        // 박스 경계에서 임계값 확인하고 멈춘 픽셀 기록
        const newStoppedPixels = this.checkBoxBoundaryForThreshold(currentStep);
        
        // 박스를 1픽셀씩 안쪽으로 수축
        this.shrinkBoxByOnePixel();
        
        // 진행 중 시각적 표시 (파란 박스와 빨간 점)
        this.drawCurrentBox();
        
        // 진행 중 멈춘 픽셀들을 빨간색 사각형으로 채워서 표시 (진행 상황 표시용)
        this.drawStoppedPixelsProgress();
        
        // 기존 불량 영역들 다시 그리기
        this.drawExistingDefects();

        // 진행 상황 업데이트
        if (onProgress) {
          const percentage = Math.round(((currentStep + 1) / maxSteps) * 100);
          onProgress({
            step: currentStep + 1,
            totalSteps: maxSteps,
            percentage,
            currentBoxSize: `${this.currentBox.width}x${this.currentBox.height}`,
            stoppedPixels: this.stoppedPixels.length,
            newStoppedPixels: newStoppedPixels
          });
        }

        currentStep++;

        // 7ms 후 다음 단계 실행 (3배 빠른 속도)
        setTimeout(() => {
          if (this.isDetecting) {
            executeStep();
          } else {
            resolve();
          }
        }, 7);
      };

      // 첫 번째 단계 시작
      executeStep();
    });
  }

  /**
   * 박스 경계에서 임계값 확인 (원본 박스 경계 내에서만 엄격하게)
   */
  checkBoxBoundaryForThreshold(currentStep = 0) {
    const newStoppedPixels = [];
    const { x, y, width, height } = this.currentBox;
    
    // 박스 경계의 모든 픽셀 확인
    const boundaryPixels = [];
    
    // 상단 경계
    for (let px = x; px < x + width; px++) {
      if (this.isPixelStrictlyInOriginalBox(px, y)) {
        boundaryPixels.push({ x: px, y: y });
      }
    }
    
    // 하단 경계
    for (let px = x; px < x + width; px++) {
      if (this.isPixelStrictlyInOriginalBox(px, y + height - 1)) {
        boundaryPixels.push({ x: px, y: y + height - 1 });
      }
    }
    
    // 좌측 경계 (모서리 제외)
    for (let py = y + 1; py < y + height - 1; py++) {
      if (this.isPixelStrictlyInOriginalBox(x, py)) {
        boundaryPixels.push({ x: x, y: py });
      }
    }
    
    // 우측 경계 (모서리 제외)
    for (let py = y + 1; py < y + height - 1; py++) {
      if (this.isPixelStrictlyInOriginalBox(x + width - 1, py)) {
        boundaryPixels.push({ x: x + width - 1, y: py });
      }
    }
    
    // 각 경계 픽셀에서 임계값 확인
    for (const pixel of boundaryPixels) {
      const brightness = this.getPixelBrightness(pixel.x, pixel.y);
      
      if (this.isThresholdMet(brightness)) {
        // 임계값에서 멈춘 픽셀 기록
        this.stoppedPixels.push({
          x: pixel.x,
          y: pixel.y,
          brightness: brightness,
          step: currentStep
        });
        newStoppedPixels.push(pixel);
      }
    }
    
    return newStoppedPixels.length;
  }

  /**
   * 픽셀이 스케일바 제외 영역에 있는지 확인
   */
  isPixelInScaleBarExclusionArea(x, y) {
    if (!this.scaleBarExclusionArea) return false;
    
    return x >= this.scaleBarExclusionArea.x && 
           x < this.scaleBarExclusionArea.x + this.scaleBarExclusionArea.width &&
           y >= this.scaleBarExclusionArea.y && 
           y < this.scaleBarExclusionArea.y + this.scaleBarExclusionArea.height;
  }

  /**
   * 픽셀이 원본 박스 경계 내에 있는지 엄격하게 확인 (스케일바 영역 제외)
   */
  isPixelStrictlyInOriginalBox(x, y) {
    // 스케일바 영역에 있는 픽셀은 제외
    if (this.isPixelInScaleBarExclusionArea(x, y)) {
      return false;
    }
    
    return x >= this.originalBox.x + 2 && 
           x < this.originalBox.x + this.originalBox.width - 2 &&
           y >= this.originalBox.y + 2 && 
           y < this.originalBox.y + this.originalBox.height - 2;
  }

  /**
   * 픽셀이 원본 박스 경계 내에 있는지 확인 (스케일바 영역 제외)
   */
  isPixelInOriginalBox(x, y) {
    // 스케일바 영역에 있는 픽셀은 제외
    if (this.isPixelInScaleBarExclusionArea(x, y)) {
      return false;
    }
    
    return x >= this.originalBox.x && 
           x < this.originalBox.x + this.originalBox.width &&
           y >= this.originalBox.y && 
           y < this.originalBox.y + this.originalBox.height;
  }

  /**
   * 박스를 1픽셀씩 안쪽으로 수축
   */
  shrinkBoxByOnePixel() {
    this.currentBox.x += 1;
    this.currentBox.y += 1;
    this.currentBox.width -= 2;
    this.currentBox.height -= 2;
    
    // 박스가 너무 작아지지 않도록 제한 완화 (10 → 6)
    if (this.currentBox.width < 6) this.currentBox.width = 6;
    if (this.currentBox.height < 6) this.currentBox.height = 6;
  }

  /**
   * 현재 박스를 파란 실선으로 표시
   */
  drawCurrentBox() {
    this.ctx.save();
    this.ctx.strokeStyle = '#0066ff';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([]);
    
    this.ctx.strokeRect(
      this.currentBox.x,
      this.currentBox.y,
      this.currentBox.width,
      this.currentBox.height
    );
    
    this.ctx.restore();
  }

  /**
   * 진행 중 멈춘 픽셀들을 빨간색 사각형으로 채워서 표시 (진행 상황 표시용)
   */
  drawStoppedPixelsProgress() {
    if (this.stoppedPixels.length === 0) return;
    
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(255, 0, 0, 0.7)'; // 빨간색으로 채우기
    
    for (const pixel of this.stoppedPixels) {
      // 작은 원 대신 사각형으로 채워서 표시
      this.ctx.fillRect(pixel.x - 0.5, pixel.y - 0.5, 1, 1);
    }
    
    this.ctx.restore();
  }

  /**
   * 임계값 도달 여부 확인
   */
  isThresholdMet(brightness) {
    if (this.isReversed) {
      // 어두운 영역 모드: 임계값보다 어두운 픽셀을 감지
      return brightness < this.brightnessThreshold;
    } else {
      // 밝은 영역 모드: 임계값보다 밝은 픽셀을 감지
      return brightness > this.brightnessThreshold;
    }
  }

  /**
   * 감지 완료 후 불량 영역 분석 (더 타이트하게)
   */
  finalizeDetection() {
    // console.log('박스 수축 감지 완료 - 불량 영역 분석 시작...');
    
    if (this.stoppedPixels.length === 0) {
      // console.log('멈춘 픽셀이 없어 불량 영역을 찾을 수 없습니다.');
      return;
    }
    
    // console.log(`분석할 멈춘 픽셀 수: ${this.stoppedPixels.length}`);
    
    // 멈춘 픽셀들을 클러스터링하여 불량 영역 찾기 (더 타이트한 기준)
    const clusters = this.clusterStoppedPixels(this.stoppedPixels);
    
    // 불량 영역이 100개를 초과하는 경우 경고
    if (clusters.length > 100) {
      console.warn(`⚠️ 불량 영역이 ${clusters.length}개로 과도하게 감지되었습니다.`);
      console.warn('이는 다음 원인일 수 있습니다:');
      console.warn('1. 밝기 임계값이 부적절하게 설정됨');
      console.warn('2. 배경 노이즈나 텍스처가 불량으로 감지됨');
      console.warn('3. 이미지 품질이 낮아 전체적으로 노이즈가 많음');
      console.warn('상위 100개 불량 영역만 표시합니다.');
      
      // 픽셀 수가 많은 상위 100개만 선택
      clusters.sort((a, b) => b.length - a.length);
      clusters.splice(100);
    }
    
    // 각 클러스터를 타이트한 불량 영역으로 변환
    this.defectRegions = clusters.map((cluster, index) => {
      const bounds = this.calculateTightDefectBounds(cluster);
      const defectData = this.analyzeDefectCharacteristics(cluster, bounds);
      
      const defectRegion = {
        id: index + 1,
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        centerX: bounds.centerX,
        centerY: bounds.centerY,
        radius: bounds.radius,
        radiusX: bounds.radiusX,  // 각 불량별 개별 radiusX
        radiusY: bounds.radiusY,  // 각 불량별 개별 radiusY
        pixelCount: cluster.length,
        isCircular: false, // 타원 형태 허용
        timestamp: Date.now(),
        // 불량 특성 분석 결과
        distortion: defectData.distortion,
        striation: defectData.striation,
        brightness: defectData.averageBrightness,
        area: defectData.area,
        // 실제 불량 영역의 경계점들
        edgePixels: this.findEdgePixels(cluster)
      };
      
      // 각 불량 영역 생성 디버깅 로그
      // console.log(`불량 영역 ${index + 1} 생성:`, {
      //   id: defectRegion.id,
      //   pixelCount: cluster.length,
      //   centerX: bounds.centerX,
      //   centerY: bounds.centerY,
      //   radiusX: bounds.radiusX,
      //   radiusY: bounds.radiusY,
      //   width: bounds.width,
      //   height: bounds.height,
      //   area: defectData.area
      // });
      
      return defectRegion;
    });
    
    // console.log(`최종 불량 영역 ${this.defectRegions.length}개 발견`);
    
    // 과도한 불량 감지에 대한 추가 경고
    if (this.defectRegions.length >= 50) {
      console.warn(`⚠️ 불량 영역이 ${this.defectRegions.length}개로 많이 감지되었습니다.`);
      console.warn('밝기 임계값을 조정하거나 다른 영역을 선택해보세요.');
    }
  }

  /**
   * 정확한 타원 경계 계산 (원으로 변환하지 않고 타원 그대로)
   */
  calculateTightDefectBounds(cluster) {
    if (cluster.length === 0) return null;
    
    // 클러스터의 정확한 경계 찾기
    let minX = cluster[0].x, maxX = cluster[0].x;
    let minY = cluster[0].y, maxY = cluster[0].y;
    
    for (const pixel of cluster) {
      minX = Math.min(minX, pixel.x);
      maxX = Math.max(maxX, pixel.x);
      minY = Math.min(minY, pixel.y);
      maxY = Math.max(maxY, pixel.y);
    }
    
    // 중심점 계산
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    // 실제 불량 영역의 크기 계산 (각 불량별로 개별적인 크기)
    const actualWidth = maxX - minX + 1; // +1을 해서 최소 1픽셀 크기 보장
    const actualHeight = maxY - minY + 1; // +1을 해서 최소 1픽셀 크기 보장
    
    // 각 불량별 개별 타원 반지름 계산 (실제 크기 기반)
    const radiusX = Math.max(actualWidth / 2, 1); // 최소 1픽셀
    const radiusY = Math.max(actualHeight / 2, 1); // 최소 1픽셀
    
    // 타원 경계 박스 계산
    const boundingWidth = radiusX * 2;
    const boundingHeight = radiusY * 2;
    
    // 각 불량별 경계 계산 디버깅 로그
    // console.log(`클러스터 경계 계산 - 픽셀 수: ${cluster.length}`, {
    //   pixelBounds: { minX, maxX, minY, maxY },
    //   actualSize: { actualWidth, actualHeight },
    //   center: { centerX, centerY },
    //   radius: { radiusX, radiusY },
    //   boundingBox: { boundingWidth, boundingHeight }
    // });
    
    return {
      x: centerX - radiusX,
      y: centerY - radiusY,
      width: boundingWidth,
      height: boundingHeight,
      centerX: Math.round(centerX),
      centerY: Math.round(centerY),
      radius: Math.max(radiusX, radiusY), // 호환성을 위해 유지
      radiusX: Math.round(radiusX),
      radiusY: Math.round(radiusY),
      // 실제 픽셀 기반 크기 정보 추가
      actualWidth: actualWidth,
      actualHeight: actualHeight
    };
  }

  /**
   * 불량 영역의 edge 픽셀들 찾기
   */
  findEdgePixels(cluster) {
    const edgePixels = [];
    
    for (const pixel of cluster) {
      // 주변 8방향 확인
      let isEdge = false;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          
          const neighborX = pixel.x + dx;
          const neighborY = pixel.y + dy;
          const neighborBrightness = this.getPixelBrightness(neighborX, neighborY);
          
          // 주변에 밝은 픽셀이 있으면 edge
          if (!this.isThresholdMet(neighborBrightness)) {
            isEdge = true;
            break;
          }
        }
        if (isEdge) break;
      }
      
      if (isEdge) {
        edgePixels.push(pixel);
      }
    }
    
    return edgePixels;
  }

  /**
   * 불량 특성 분석 (distortion, striation 계산) - 숫자 값으로 반환
   */
  analyzeDefectCharacteristics(cluster, bounds) {
    const { centerX, centerY, radiusX, radiusY } = bounds;
    
    // 실제 감지된 픽셀들만 사용하여 분석
    const analysisPixels = cluster.map(pixel => ({
      x: pixel.x,
      y: pixel.y,
      brightness: pixel.brightness
    }));
    
    if (analysisPixels.length === 0) {
      return {
        distortion: 0,
        striation: 0,
        averageBrightness: 0,
        area: Math.PI * radiusX * radiusY
      };
    }
    
    // 평균 밝기 계산
    const averageBrightness = analysisPixels.reduce((sum, p) => sum + p.brightness, 0) / analysisPixels.length;
    
    // Distortion 계산: 밝기 변화의 불균등성을 0-100 스케일로 변환
    const brightnessVariance = analysisPixels.reduce((sum, p) => 
      sum + Math.pow(p.brightness - averageBrightness, 2), 0) / analysisPixels.length;
    
    // Distortion 값을 0-100 범위로 정규화
    const distortionValue = Math.min(100, Math.round((brightnessVariance / 10))); // 0-100 범위
    
    // Striation 계산: 선형 패턴 강도를 0-100 스케일로 반환
    const striationValue = this.calculateStriationValue(analysisPixels, centerX, centerY, radiusX, radiusY);
    
    // console.log('불량 특성 분석 결과 (숫자 값):', {
    //   pixelCount: analysisPixels.length,
    //   averageBrightness: Math.round(averageBrightness),
    //   brightnessVariance: Math.round(brightnessVariance),
    //   distortionValue,
    //   striationValue
    // });
    
    return {
      distortion: distortionValue,      // 0-100 숫자 값
      striation: striationValue,        // 0-100 숫자 값
      averageBrightness: Math.round(averageBrightness),
      area: Math.round(Math.PI * radiusX * radiusY)
    };
  }

  /**
   * Striation 값 계산 - 0-100 범위의 숫자로 반환
   */
  calculateStriationValue(pixels, centerX, centerY, radiusX, radiusY) {
    if (pixels.length < 10) return 0;
    
    // 여러 방향으로 선형 패턴 확인
    const directions = [
      { dx: 1, dy: 0, name: '수평' },
      { dx: 0, dy: 1, name: '수직' },
      { dx: 1, dy: 1, name: '대각선' },
      { dx: 1, dy: -1, name: '역대각선' }
    ];
    
    let maxStriationScore = 0;
    let detectedDirection = '';
    
    for (const dir of directions) {
      const linePixels = pixels.filter(p => {
        const relX = p.x - centerX;
        const relY = p.y - centerY;
        const normalizedX = relX / radiusX;
        const normalizedY = relY / radiusY;
        return Math.abs(normalizedX * dir.dy - normalizedY * dir.dx) < 0.5;
      });
      
      if (linePixels.length > pixels.length * 0.15) { // 15% 이상이 선형
        // 밝기 변화 패턴 확인
        linePixels.sort((a, b) => {
          const aPos = (a.x - centerX) * dir.dx + (a.y - centerY) * dir.dy;
          const bPos = (b.x - centerX) * dir.dx + (b.y - centerY) * dir.dy;
          return aPos - bPos;
        });
        
        // 연속된 밝기 변화 강도 계산
        let totalVariation = 0;
        let variationCount = 0;
        let consecutiveChanges = 0;
        
        for (let i = 1; i < linePixels.length - 1; i++) {
          const prev = linePixels[i - 1].brightness;
          const curr = linePixels[i].brightness;
          const next = linePixels[i + 1].brightness;
          
          const change1 = Math.abs(curr - prev);
          const change2 = Math.abs(next - curr);
          const avgChange = (change1 + change2) / 2;
          
          if (avgChange > 10) { // 최소 변화량
            totalVariation += avgChange;
            variationCount++;
            consecutiveChanges++;
            
            // 연속적인 변화에 가중치 부여
            if (consecutiveChanges >= 3) {
              totalVariation += avgChange * 0.5; // 50% 보너스
            }
          } else {
            consecutiveChanges = 0;
          }
        }
        
        if (variationCount > 0) {
          // 평균 변화량을 0-100 스케일로 변환
          const avgVariation = totalVariation / variationCount;
          const striationScore = Math.min(100, avgVariation * 2); // 0-100 범위
          
          if (striationScore > maxStriationScore) {
            maxStriationScore = striationScore;
            detectedDirection = dir.name;
          }
        }
      }
    }
    
    const striationValue = Math.round(maxStriationScore);
    
    if (striationValue > 10) {
      // console.log(`Striation 측정: ${detectedDirection} 방향, 값: ${striationValue}/100`);
    }
    
    return striationValue;
  }

  /**
   * 멈춘 픽셀들을 클러스터링 (더 타이트한 기준)
   */
  clusterStoppedPixels(pixels) {
    const clusters = [];
    const visited = new Set();
    const clusterRadius = 12; // 클러스터링 반경 더 줄임 (15→12)
    
    // console.log(`클러스터링 시작 - 총 픽셀 수: ${pixels.length}, 클러스터링 반경: ${clusterRadius}`);
    
    for (let i = 0; i < pixels.length; i++) {
      if (visited.has(i)) continue;
      
      const cluster = [];
      const queue = [i];
      visited.add(i);
      
      while (queue.length > 0) {
        const currentIdx = queue.shift();
        const currentPixel = pixels[currentIdx];
        cluster.push(currentPixel);
        
        // 주변의 가까운 픽셀들을 같은 클러스터로 그룹화
        for (let j = 0; j < pixels.length; j++) {
          if (visited.has(j)) continue;
          
          const otherPixel = pixels[j];
          const distance = Math.sqrt(
            Math.pow(currentPixel.x - otherPixel.x, 2) + 
            Math.pow(currentPixel.y - otherPixel.y, 2)
          );
          
          if (distance <= clusterRadius) {
            visited.add(j);
            queue.push(j);
          }
        }
      }
      
      // 최소 6개 이상의 픽셀이 있는 클러스터만 불량으로 간주 (더 타이트)
      if (cluster.length >= 6) {
        // 클러스터 경계 계산
        let minX = cluster[0].x, maxX = cluster[0].x;
        let minY = cluster[0].y, maxY = cluster[0].y;
        
        for (const pixel of cluster) {
          minX = Math.min(minX, pixel.x);
          maxX = Math.max(maxX, pixel.x);
          minY = Math.min(minY, pixel.y);
          maxY = Math.max(maxY, pixel.y);
        }
        
        const clusterWidth = maxX - minX + 1;
        const clusterHeight = maxY - minY + 1;
        
        // console.log(`클러스터 ${clusters.length + 1} 생성:`, {
        //   pixelCount: cluster.length,
        //   bounds: { minX, maxX, minY, maxY },
        //   size: { width: clusterWidth, height: clusterHeight },
        //   center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
        // });
        
        clusters.push(cluster);
      } else {
        // console.log(`클러스터 제외 - 픽셀 수 부족: ${cluster.length}개 (최소 6개 필요)`);
      }
    }
    
    // console.log(`클러스터링 완료 - 유효한 클러스터 수: ${clusters.length}`);
    return clusters;
  }

  /**
   * 불량 영역들을 녹색 선으로 표시 (빨간 감지 영역 + 정확한 타원 테두리)
   */
  drawExistingDefects() {
    if (this.defectRegions.length === 0) return;
    
    this.ctx.save();
    
    this.defectRegions.forEach((defect, index) => {
      // 1. 실제 감지된 픽셀들을 빨간색으로 채워서 표시 (감지 과정 시각화)
      if (defect.edgePixels && defect.edgePixels.length > 0) {
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.7)'; // 빨간색으로 채우기
        for (const edgePixel of defect.edgePixels) {
          this.ctx.fillRect(edgePixel.x - 0.8, edgePixel.y - 0.8, 1.6, 1.6);
        }
      }
      
      // 2. 정확한 타원형 테두리 표시 (색칠 없이 녹색 선만)
      this.ctx.strokeStyle = '#00ff00';
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([]);
      
      this.ctx.beginPath();
      this.ctx.ellipse(
        defect.centerX, 
        defect.centerY, 
        defect.radiusX, // 정확한 타원 반지름 사용
        defect.radiusY, // 정확한 타원 반지름 사용
        0, 0, 2 * Math.PI
      );
      this.ctx.stroke();
      
      // 3. 불량 번호 표시
      this.ctx.fillStyle = '#00ff00';
      this.ctx.font = 'bold 12px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(
        `${index + 1}`, 
        defect.centerX, 
        defect.centerY + 4
      );
    });
    
    this.ctx.restore();
  }

  /**
   * 최종 결과 표시 (파란 박스 완전 제거, 빨간 감지 영역 + 녹색 결과 표시)
   */
  drawFinalResults() {
    // console.log('최종 결과 표시 중 - 파란 박스 완전 제거, 빨간 감지 영역 유지...');
    
    // 원본 이미지 완전 복원
    this.ctx.putImageData(this.originalImageData, 0, 0);
    
    // 1. 직접 감지한 영역을 빨간색으로 채워서 표시 (감지 과정 시각화)
    this.drawDetectedPixelAreas();
    
    // 2. 불량 영역 녹색 타원 테두리 표시 (최종 결과)
    this.drawExistingDefects();
    
    // console.log('최종 불량 영역 결과:', this.defectRegions);
    // console.log('총 불량 개수:', this.defectRegions.length);
  }

  /**
   * 직접 감지한 픽셀 영역들을 빨간색으로 채워서 표시
   */
  drawDetectedPixelAreas() {
    if (this.stoppedPixels.length === 0) return;
    
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(255, 0, 0, 0.6)'; // 반투명 빨간색으로 채우기
    
    // 각 감지된 픽셀을 작은 사각형으로 채워서 표시
    for (const pixel of this.stoppedPixels) {
      this.ctx.fillRect(pixel.x - 0.5, pixel.y - 0.5, 1, 1);
    }
    
    // 추가로 각 불량 영역별로 클러스터된 픽셀들을 더 진한 빨간색으로 표시
    this.defectRegions.forEach((defect, index) => {
      if (defect.edgePixels && defect.edgePixels.length > 0) {
        this.ctx.fillStyle = 'rgba(200, 0, 0, 0.8)'; // 더 진한 빨간색
        
        for (const edgePixel of defect.edgePixels) {
          this.ctx.fillRect(edgePixel.x - 0.8, edgePixel.y - 0.8, 1.6, 1.6);
        }
      }
    });
    
    this.ctx.restore();
    
    // console.log(`직접 감지한 픽셀 영역 표시 완료 - 총 ${this.stoppedPixels.length}개 픽셀`);
  }

  /**
   * 박스 영역 검증
   */
  validateBoundingBox(box) {
    if (!box || typeof box !== 'object') {
      console.error('박스가 객체가 아닙니다:', box);
      return null;
    }
    
    const { x, y, width, height } = box;
    
    if (typeof x !== 'number' || typeof y !== 'number' || 
        typeof width !== 'number' || typeof height !== 'number') {
      console.error('박스 속성이 숫자가 아닙니다:', { x, y, width, height });
      return null;
    }
    
    if (x < 0 || y < 0 || width <= 20 || height <= 20) {
      console.error('박스 크기가 너무 작습니다:', { x, y, width, height });
      return null;
    }
    
    if (x + width > this.canvas.width || y + height > this.canvas.height) {
      console.error('박스가 캔버스 범위를 벗어납니다:', { 
        box: { x, y, width, height },
        canvas: { width: this.canvas.width, height: this.canvas.height }
      });
      return null;
    }
    
    return { x, y, width, height };
  }

  /**
   * 픽셀의 밝기값 계산
   */
  getPixelBrightness(x, y) {
    if (!this.imageData || !this.imageData.data) return 128;
    
    const floorX = Math.floor(x);
    const floorY = Math.floor(y);
    
    if (floorX < 0 || floorY < 0 || floorX >= this.imageData.width || floorY >= this.imageData.height) {
      return 128;
    }
    
    const index = (floorY * this.imageData.width + floorX) * 4;
    
    if (index < 0 || index + 2 >= this.imageData.data.length) {
      return 128;
    }
    
    const r = this.imageData.data[index];
    const g = this.imageData.data[index + 1];
    const b = this.imageData.data[index + 2];
    
    return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }

  /**
   * 감지 중단
   */
  stopDetection() {
    // console.log('불량 감지 중단 요청');
    this.isDetecting = false;
    this.isCompleting = false;
    
    // 데이터 초기화
    this.stoppedPixels = [];
    this.defectRegions = [];
    
    // 캔버스 초기화
    if (this.originalImageData) {
      this.ctx.putImageData(this.originalImageData, 0, 0);
    }
  }

  /**
   * 결과 가져오기 (정확한 타원 정보 포함)
   */
  getResults() {
    const results = this.defectRegions.map((defect) => {
      const result = {
        id: defect.id,
        // 좌상단 좌표로 변환하여 반환 (Vue 컴포넌트에서 일관된 처리를 위해)
        x: defect.centerX - defect.radiusX,
        y: defect.centerY - defect.radiusY,
        width: defect.radiusX * 2,
        height: defect.radiusY * 2,
        radiusX: defect.radiusX,
        radiusY: defect.radiusY,
        // 중심점 좌표도 별도로 제공
        centerX: defect.centerX,
        centerY: defect.centerY,
        pixelCount: defect.pixelCount,
        isDefect: true,
        distortion: defect.distortion,
        striation: defect.striation,
        brightness: defect.brightness,
        area: defect.area,
        type: 'ellipse', // 타원 타입 명시
        // edge 픽셀 정보 추가
        edgePixels: defect.edgePixels || []
      };
      
      // 각 불량별 개별 타원 정보 디버깅 로그
      // console.log(`DefectDetector - 불량 ${defect.id} 개별 타원 정보:`, {
      //   id: defect.id,
      //   centerX: defect.centerX,
      //   centerY: defect.centerY,
      //   radiusX: defect.radiusX,
      //   radiusY: defect.radiusY,
      //   width: defect.radiusX * 2,
      //   height: defect.radiusY * 2,
      //   area: defect.area,
      //   pixelCount: defect.pixelCount
      // });
      
      return result;
    });
    
    // console.log('DefectDetector.getResults() 전체 결과:', results);
    return results;
  }

  /**
   * 멈춘 픽셀들을 edge 점으로만 표시 (최종 결과용 - 사용 안함)
   */
  drawStoppedPixels() {
    // 이 함수는 더 이상 사용하지 않음 - 최종 결과에서는 녹색 타원만 표시
    return;
  }
}

/**
 * 편의 함수
 */
export function detectDefects(canvas, ctx, imageData, boundingBox, options = {}) {
  const {
    brightnessThreshold = 128,
    isReversed = false,
    onProgress = null,
    onComplete = null
  } = options;

  const detector = new DefectDetector(canvas, ctx, imageData, brightnessThreshold, isReversed);
  return detector.startDetection(boundingBox, onProgress, onComplete);
} 