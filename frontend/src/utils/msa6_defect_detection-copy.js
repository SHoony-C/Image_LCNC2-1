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
  constructor(canvas, ctx, imageData, brightnessThreshold, isReversed = false, scaleBarExclusionArea = null, originalImageWidth = null, originalImageHeight = null, originalImageData = null, sourceImage = null) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.imageData = imageData;
    this.brightnessThreshold = brightnessThreshold; // 정확한 임계값
    this.isReversed = isReversed;
    this.isDetecting = false;
    this.isProcessing = false; // 타원 매핑 등 후처리 중 상태 추가
    this.originalImageData = originalImageData || imageData; // 원본 이미지 데이터 (F키와 동일)
    this.scaleBarExclusionArea = scaleBarExclusionArea; // 스케일바 제외 영역 추가
    this.sourceImage = sourceImage; // 원본 이미지 요소
    
    // 원본 이미지 크기 정보 추가 (F키와 동일한 계산을 위해)
    this.originalImageWidth = originalImageWidth || imageData.width;
    this.originalImageHeight = originalImageHeight || imageData.height;
    
    // 박스 수축을 위한 데이터
    this.currentBox = null; // 현재 박스 크기
    this.originalBox = null; // 원본 박스 크기 (경계 체크용)
    this.stoppedPixels = []; // 임계값에서 멈춘 픽셀들
    this.defectRegions = []; // 최종 불량 영역들
    this.isCompleting = false; // 완료 중 상태
    
    // 배경 감지 중단을 위한 변수들 - 매우 보수적으로 조정
    this.backgroundDetectionThreshold = 0.8; // 전체 경계의 80% 이상이 임계값에 걸리면 배경으로 판단 (40% → 80%)
    this.consecutiveHighDetectionCount = 0; // 연속으로 높은 감지가 발생한 횟수
    this.maxConsecutiveHighDetection = 15; // 15번 연속 높은 감지시 중단 (8 → 15)
    this.minBoxShrinkSteps = 20; // 최소 20단계는 박스 수축을 진행해야 함 (10 → 20)
    this.currentStepCount = 0; // 현재 진행된 단계 수
    
    // 원본 이미지 데이터 백업
    this.backupImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    
    // console.log('DefectDetector 간단 박스 수축 방식 초기화:', {
    //   canvasSize: { width: canvas.width, height: canvas.height },
    //   adjustedThreshold: this.brightnessThreshold,
    //   originalThreshold: brightnessThreshold,
    //   scaleBarExclusionArea: this.scaleBarExclusionArea,
    //   originalImageSize: { width: this.originalImageWidth, height: this.originalImageHeight }
    // });
  }

  /**
   * 이미지 데이터 특성 분석 및 디버깅
   */
  analyzeImageData() {
    if (!this.imageData || !this.imageData.data) {
      // console.log('이미지 데이터가 없습니다.');
      return;
    }
    
    // console.log('=== 이미지 데이터 특성 분석 ===');
    // console.log(`이미지 크기: ${this.imageData.width} x ${this.imageData.height}`);
    // console.log(`데이터 길이: ${this.imageData.data.length}`);
    
    // 샘플 픽셀 분석 (첫 10개 픽셀)
    // console.log('=== 샘플 픽셀 분석 ===');
    for (let i = 0; i < Math.min(10, this.imageData.data.length / 4); i++) {
      const index = i * 4;
      const r = this.imageData.data[index];
      const g = this.imageData.data[index + 1];
      const b = this.imageData.data[index + 2];
      const a = this.imageData.data[index + 3];
      
      // console.log(`픽셀 ${i}: RGBA(${r}, ${g}, ${b}, ${a})`);
    }
    
    // 전체 이미지의 밝기 분포 분석
    let minBrightness = 255;
    let maxBrightness = 0;
    let totalBrightness = 0;
    let pixelCount = 0;
    
    for (let i = 0; i < this.imageData.data.length; i += 4) {
      const r = this.imageData.data[i];
      
      minBrightness = Math.min(minBrightness, r);
      maxBrightness = Math.max(maxBrightness, r);
      totalBrightness += r;
      pixelCount++;
    }
    
    const avgBrightness = Math.round(totalBrightness / pixelCount);
    
    // console.log('=== 밝기 분포 분석 ===');
    // console.log(`최소 밝기: ${minBrightness}`);
    // console.log(`최대 밝기: ${maxBrightness}`);
    // console.log(`평균 밝기: ${avgBrightness}`);
    // console.log(`픽셀 수: ${pixelCount}`);
    
    // 어두운 픽셀 개수 분석
    let darkPixels = 0;
    let veryDarkPixels = 0;
    
    for (let i = 0; i < this.imageData.data.length; i += 4) {
      const r = this.imageData.data[i];
      
      if (r <= 50) darkPixels++;
      if (r <= 10) veryDarkPixels++;
    }
    
    // console.log(`밝기 ≤ 50인 픽셀: ${darkPixels}개 (${(darkPixels/pixelCount*100).toFixed(2)}%)`);
    // console.log(`밝기 ≤ 10인 픽셀: ${veryDarkPixels}개 (${(veryDarkPixels/pixelCount*100).toFixed(2)}%)`);
    // console.log('=== 분석 완료 ===');
  }

  /**
   * 불량 감지 시작
   */
  async startDetection(boundingBox, onProgress = null, onComplete = null) {
    // console.log('=== 간단 박스 수축 불량 감지 시작 ===', boundingBox);
    
    if (this.isDetecting || this.isProcessing) {
      console.warn('이미 감지 또는 처리가 진행 중입니다.');
      return;
    }

    // 이미지 데이터 특성 분석 (디버깅용)
    this.analyzeImageData();

    this.isDetecting = true;
    this.isProcessing = false;
    this.isCompleting = false;
    this.stoppedPixels = [];
    this.defectRegions = [];
    this.consecutiveHighDetectionCount = 0; // 초기화
    this.currentStepCount = 0; // 초기화
    
    // 원본 이미지 데이터 백업
    // this.originalImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height); // 이 부분은 생성자에서 초기화되므로 제거
    
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
      this.isProcessing = false;
      this.isCompleting = false;
    }
  }

  /**
   * 박스 수축 감지 수행
   */
  performBoxShrinkingDetection(onProgress, onComplete) {
    return new Promise((resolve) => {
      const maxSteps = Math.min(this.currentBox.width, this.currentBox.height) / 2 - 1; // 더 많은 단계 허용 (3 → 1)
      let currentStep = 0;
      
      // console.log(`박스 수축 감지 시작: 최대 ${maxSteps} 단계`);
      
      const executeStep = () => {
        // 중단 요청 확인
        if (!this.isDetecting) {
          console.log('감지 중단 요청됨');
          resolve();
          return;
        }
        
        // 박스 크기가 최소 크기에 도달했을 때만 종료 (더 작은 최소 크기)
        if (currentStep >= maxSteps || 
            this.currentBox.width <= 2 || this.currentBox.height <= 2) { // 6 → 2로 변경
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

        // 현재 단계 수 업데이트
        this.currentStepCount = currentStep;

        // 백업된 원본 이미지 데이터로 캔버스 복원
        if (this.backupImageData) {
          this.ctx.putImageData(this.backupImageData, 0, 0);
        }
        
        // 박스 경계에서 임계값 확인하고 멈춘 픽셀 기록
        const detectionResult = this.checkBoxBoundaryForThreshold(currentStep);
        
        // 배경 감지 중단 로직 체크 (매우 보수적으로 적용)
        if (this.shouldTerminateForBackground(detectionResult)) {
          // console.log('배경 감지로 인한 조기 중단');
          this.finalizeDetection();
          this.drawFinalResults();
          const results = this.getResults();
          if (onComplete) onComplete(results);
          resolve();
          return;
        }
        
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
            newStoppedPixels: detectionResult.newStoppedPixels
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
   * 배경 감지로 인한 중단 여부 결정 - 매우 보수적인 버전
   */
  shouldTerminateForBackground(detectionResult) {
    const { totalBoundaryPixels, newStoppedPixels, detectionRatio } = detectionResult;
    
    // 최소 단계 수만큼은 반드시 진행
    if (this.currentStepCount < this.minBoxShrinkSteps) {
      this.consecutiveHighDetectionCount = 0; // 카운터 리셋
      return false;
    }
    
    // 경계 픽셀의 80% 이상이 임계값에 걸리면 배경일 가능성이 높음 (매우 보수적)
    if (detectionRatio >= this.backgroundDetectionThreshold) {
      this.consecutiveHighDetectionCount++;
      // console.log(`높은 감지율 감지: ${(detectionRatio * 100).toFixed(1)}% (${this.consecutiveHighDetectionCount}/${this.maxConsecutiveHighDetection}) - 단계: ${this.currentStepCount}`);
      
      // 15번 연속 높은 감지율이면 배경으로 판단하고 중단
      if (this.consecutiveHighDetectionCount >= this.maxConsecutiveHighDetection) {
        return true;
      }
    } else {
      // 감지율이 낮으면 카운터 리셋
      this.consecutiveHighDetectionCount = 0;
    }
    
    // 전체 멈춘 픽셀이 너무 많으면 배경일 가능성 높음 (추가 안전장치)
    const totalAreaRatio = this.stoppedPixels.length / (this.originalBox.width * this.originalBox.height);
    if (totalAreaRatio > 0.7 && this.currentStepCount > this.minBoxShrinkSteps) { // 70%로 더 완화
      // console.log(`전체 감지 픽셀이 과도함 - 배경으로 판단하여 중단 (${(totalAreaRatio * 100).toFixed(1)}%)`);
      return true;
    }
    
    return false;
  }

  /**
   * 박스 경계에서 임계값 확인 (원본 박스 경계 내에서만 엄격하게) - 개선된 버전
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
    
    // 각 경계 픽셀에서 정확한 임계값 확인
    for (const pixel of boundaryPixels) {
      const brightness = this.getPixelBrightnessAccurate(pixel.x, pixel.y); // 정확한 밝기 계산 사용
      
      if (this.isThresholdMet(brightness)) { // 정확한 임계값 비교 사용
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
    
    // 배경 감지를 위한 통계 정보 반환
    const totalBoundaryPixels = boundaryPixels.length;
    const detectionRatio = totalBoundaryPixels > 0 ? newStoppedPixels.length / totalBoundaryPixels : 0;
    
    return {
      newStoppedPixels: newStoppedPixels.length,
      totalBoundaryPixels,
      detectionRatio
    };
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
    
    // 박스가 너무 작아지지 않도록 제한을 더 완화 (6 → 2)
    if (this.currentBox.width < 2) this.currentBox.width = 2;
    if (this.currentBox.height < 2) this.currentBox.height = 2;
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
   * 감지 완료 후 불량 영역 분석 (최적화된 버전) - 중단 기능 강화
   */
  finalizeDetection() {
    // console.log('박스 수축 감지 완료 - 불량 영역 분석 시작...');
    
    // 처리 중 상태로 변경
    this.isProcessing = true;
    this.isDetecting = false;
    
    if (this.stoppedPixels.length === 0) {
      // console.log('멈춘 픽셀이 없어 불량 영역을 찾을 수 없습니다.');
      this.isProcessing = false;
      return;
    }
    
    // console.log(`분석할 멈춘 픽셀 수: ${this.stoppedPixels.length}`);
    
    // 중단 요청 확인 - 더 자주 체크
    if (!this.isProcessing) {
      // console.log('타원 매핑 중단 요청됨');
      return;
    }
    
    // 최적화된 클러스터링으로 불량 영역 찾기
    // console.log('클러스터링 시작...');
    const clusters = this.clusterStoppedPixelsOptimized(this.stoppedPixels);
    
    // 중단 요청 확인
    if (!this.isProcessing) {
      // console.log('클러스터링 중단 요청됨');
      return;
    }
    
    // console(`클러스터링 완료 - ${clusters.length}개 클러스터 발견`);
    
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
    
    // 중단 요청 확인
    if (!this.isProcessing) {
      // console.log('불량 영역 분석 중단 요청됨');
      return;
    }
    
    // console.log('불량 영역 변환 시작...');
    
    // 각 클러스터를 타이트한 불량 영역으로 변환 (최적화)
    this.defectRegions = [];
    
    for (let index = 0; index < clusters.length; index++) {
      // 중단 요청 확인 (각 클러스터 처리 중)
      if (!this.isProcessing) {
        // console.log('클러스터 처리 중단 요청됨');
        break;
      }
      
      const cluster = clusters[index];
      const bounds = this.calculateTightDefectBoundsOptimized(cluster);
      const defectData = this.analyzeDefectCharacteristicsOptimized(cluster, bounds);
      
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
        // 실제 불량 영역의 경계점들 (최적화)
        edgePixels: this.findEdgePixelsOptimized(cluster)
      };
      
      this.defectRegions.push(defectRegion);
      
      // 진행 상황 로깅
      if (index % 10 === 0) {
        // console.log(`불량 영역 처리 진행: ${index + 1}/${clusters.length}`);
      }
    }
    
    // console.log(`최종 불량 영역 ${this.defectRegions.length}개 발견`);
    
    // 과도한 불량 감지에 대한 추가 경고
    if (this.defectRegions.length >= 50) {
      console.warn(`⚠️ 불량 영역이 ${this.defectRegions.length}개로 많이 감지되었습니다.`);
      console.warn('밝기 임계값을 조정하거나 다른 영역을 선택해보세요.');
    }
    
    // 처리 완료
    this.isProcessing = false;
    // console.log('불량 영역 분석 완료');
  }

  /**
   * 최적화된 클러스터링 알고리즘 (Union-Find 기반)
   */
  clusterStoppedPixelsOptimized(pixels) {
    if (pixels.length === 0) return [];
    
    const clusterRadius = 12;
    const minClusterSize = 6;
    
    // Union-Find 자료구조로 빠른 클러스터링
    const parent = new Array(pixels.length);
    const rank = new Array(pixels.length);
    
    // 초기화
    for (let i = 0; i < pixels.length; i++) {
      parent[i] = i;
      rank[i] = 0;
    }
    
    // Find 함수 (경로 압축)
    const find = (x) => {
      if (parent[x] !== x) {
        parent[x] = find(parent[x]);
      }
      return parent[x];
    };
    
    // Union 함수 (rank 기반)
    const union = (x, y) => {
      const rootX = find(x);
      const rootY = find(y);
      
      if (rootX !== rootY) {
        if (rank[rootX] < rank[rootY]) {
          parent[rootX] = rootY;
        } else if (rank[rootX] > rank[rootY]) {
          parent[rootY] = rootX;
        } else {
          parent[rootY] = rootX;
          rank[rootX]++;
        }
      }
    };
    
    // 거리 기반으로 픽셀들 연결
    for (let i = 0; i < pixels.length; i++) {
      for (let j = i + 1; j < pixels.length; j++) {
        const dx = pixels[i].x - pixels[j].x;
        const dy = pixels[i].y - pixels[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= clusterRadius) {
          union(i, j);
        }
      }
    }
    
    // 클러스터 그룹화
    const clusters = new Map();
    for (let i = 0; i < pixels.length; i++) {
      const root = find(i);
      if (!clusters.has(root)) {
        clusters.set(root, []);
      }
      clusters.get(root).push(pixels[i]);
    }
    
    // 최소 크기 이상의 클러스터만 반환
    return Array.from(clusters.values()).filter(cluster => cluster.length >= minClusterSize);
  }

  /**
   * 최적화된 경계 계산
   */
  calculateTightDefectBoundsOptimized(cluster) {
    if (cluster.length === 0) return null;
    
    // 한 번의 순회로 경계와 중심점 계산
    let minX = cluster[0].x, maxX = cluster[0].x;
    let minY = cluster[0].y, maxY = cluster[0].y;
    let sumX = 0, sumY = 0;
    
    for (const pixel of cluster) {
      minX = Math.min(minX, pixel.x);
      maxX = Math.max(maxX, pixel.x);
      minY = Math.min(minY, pixel.y);
      maxY = Math.max(maxY, pixel.y);
      sumX += pixel.x;
      sumY += pixel.y;
    }
    
    // 중심점 계산 (가중 평균 대신 실제 중심)
    const centerX = sumX / cluster.length;
    const centerY = sumY / cluster.length;
    
    // 실제 불량 영역의 크기 계산 (각 불량별로 개별적인 크기)
    const actualWidth = maxX - minX + 1;
    const actualHeight = maxY - minY + 1;
    
    // 각 불량별 개별 타원 반지름 계산 (실제 크기 기반)
    const radiusX = Math.max(actualWidth / 2, 1);
    const radiusY = Math.max(actualHeight / 2, 1);
    
    // 타원 경계 박스 계산
    const boundingWidth = radiusX * 2;
    const boundingHeight = radiusY * 2;
    
    return {
      x: centerX - radiusX,
      y: centerY - radiusY,
      width: boundingWidth,
      height: boundingHeight,
      centerX: Math.round(centerX),
      centerY: Math.round(centerY),
      radius: Math.max(radiusX, radiusY),
      radiusX: Math.round(radiusX),
      radiusY: Math.round(radiusY),
      actualWidth: actualWidth,
      actualHeight: actualHeight
    };
  }

  /**
   * 최적화된 불량 특성 분석
   */
  analyzeDefectCharacteristicsOptimized(cluster, bounds) {
    const { centerX, centerY, radiusX, radiusY } = bounds;
    
    if (cluster.length === 0) {
      return {
        distortion: 0,
        striation: 0,
        averageBrightness: 0,
        area: Math.PI * radiusX * radiusY
      };
    }
    
    // 한 번의 순회로 평균 밝기와 분산 계산
    let sumBrightness = 0;
    let sumSquaredDiff = 0;
    
    for (const pixel of cluster) {
      sumBrightness += pixel.brightness;
    }
    
    const averageBrightness = sumBrightness / cluster.length;
    
    for (const pixel of cluster) {
      const diff = pixel.brightness - averageBrightness;
      sumSquaredDiff += diff * diff;
    }
    
    const brightnessVariance = sumSquaredDiff / cluster.length;
    const distortionValue = Math.min(100, Math.round(brightnessVariance / 10));
    
    // 간소화된 Striation 계산
    const striationValue = this.calculateStriationValueOptimized(cluster, centerX, centerY, radiusX, radiusY);
    
    return {
      distortion: distortionValue,
      striation: striationValue,
      averageBrightness: Math.round(averageBrightness),
      area: Math.round(Math.PI * radiusX * radiusY)
    };
  }

  /**
   * 최적화된 Striation 값 계산
   */
  calculateStriationValueOptimized(pixels, centerX, centerY, radiusX, radiusY) {
    if (pixels.length < 10) return 0;
    
    // 간소화된 방향성 분석 (수평/수직만)
    const directions = [
      { dx: 1, dy: 0 }, // 수평
      { dx: 0, dy: 1 }  // 수직
    ];
    
    let maxStriationScore = 0;
    
    for (const dir of directions) {
      const linePixels = pixels.filter(p => {
        const relX = (p.x - centerX) / radiusX;
        const relY = (p.y - centerY) / radiusY;
        return Math.abs(relX * dir.dy - relY * dir.dx) < 0.5;
      });
      
      if (linePixels.length > pixels.length * 0.2) {
        // 간소화된 변화 계산
        let totalVariation = 0;
        let count = 0;
        
        for (let i = 1; i < linePixels.length - 1; i++) {
          const prev = linePixels[i - 1].brightness;
          const curr = linePixels[i].brightness;
          const next = linePixels[i + 1].brightness;
          
          const variation = Math.abs(curr - prev) + Math.abs(next - curr);
          if (variation > 20) {
            totalVariation += variation;
            count++;
          }
        }
        
        if (count > 0) {
          const avgVariation = totalVariation / count;
          const striationScore = Math.min(100, avgVariation);
          maxStriationScore = Math.max(maxStriationScore, striationScore);
        }
      }
    }
    
    return Math.round(maxStriationScore);
  }

  /**
   * 최적화된 edge 픽셀 찾기
   */
  findEdgePixelsOptimized(cluster) {
    // 클러스터가 작으면 모든 픽셀을 edge로 간주
    if (cluster.length <= 20) {
      return cluster;
    }
    
    // 큰 클러스터의 경우 샘플링하여 edge 픽셀 찾기
    const sampleRate = Math.max(1, Math.floor(cluster.length / 50)); // 최대 50개까지만
    const edgePixels = [];
    
    for (let i = 0; i < cluster.length; i += sampleRate) {
      const pixel = cluster[i];
      
      // 간단한 edge 검사 (4방향만)
      let isEdge = false;
      const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      
      for (const [dx, dy] of directions) {
        const neighborX = pixel.x + dx;
        const neighborY = pixel.y + dy;
        const neighborBrightness = this.getPixelBrightnessAccurate(neighborX, neighborY);
        
        if (!this.isThresholdMet(neighborBrightness)) {
          isEdge = true;
          break;
        }
      }
      
      if (isEdge) {
        edgePixels.push(pixel);
      }
    }
    
    return edgePixels.length > 0 ? edgePixels : cluster.slice(0, 10); // 최소 10개는 보장
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
    
    // 백업된 원본 이미지 데이터로 캔버스 복원
    if (this.backupImageData) {
      this.ctx.putImageData(this.backupImageData, 0, 0);
    }
    
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
   * 정확한 픽셀 밝기 계산 - F키 로직과 완전히 동일한 방식
   */
  getPixelBrightnessAccurate(x, y) {
    if (!this.originalImageData || !this.originalImageData.data) return 128;
    
    const canvas = this.canvas;
    
    // F키와 동일한 방식: 캔버스 좌표를 원본 이미지 좌표로 변환
    const imageX = Math.floor((x / canvas.width) * this.originalImageWidth);
    const imageY = Math.floor((y / canvas.height) * this.originalImageHeight);
    
    // F키와 동일: 주변 픽셀을 포함한 밝기 계산 (3x3 영역)
    let totalBrightness = 0;
    let pixelCount = 0;
    
    for (let offsetY = -1; offsetY <= 1; offsetY++) {
      for (let offsetX = -1; offsetX <= 1; offsetX++) {
        const sampleX = imageX + offsetX;
        const sampleY = imageY + offsetY;
        
        if (sampleX >= 0 && sampleX < this.originalImageWidth && 
            sampleY >= 0 && sampleY < this.originalImageHeight) {
          const index = (sampleY * this.originalImageWidth + sampleX) * 4;
          if (index >= 0 && index < this.originalImageData.data.length) {
            // F키와 동일: 흑백 이미지의 경우 R 채널만 사용
            totalBrightness += this.originalImageData.data[index];
            pixelCount++;
          }
        }
      }
    }
    
    const grayValue = pixelCount > 0 ? Math.round(totalBrightness / pixelCount) : 128;
    
    // 디버깅: 어두운 픽셀과 임계값 0인 경우 상세 로깅
    if (grayValue <= 30 || (this.brightnessThreshold <= 10 && grayValue <= 50)) {
      console.log(`어두운 픽셀 감지 (${imageX}, ${imageY}): F키 방식 그레이스케일: ${grayValue}, 임계값: ${this.brightnessThreshold}, 반전: ${this.isReversed}`);
    }
    
    return grayValue;
  }

  /**
   * 개선된 픽셀 밝기 계산 - F키 로직 기반
   */
  getPixelBrightnessEnhanced(x, y) {
    if (!this.imageData || !this.imageData.data) return 128;
    
    const floorX = Math.floor(x);
    const floorY = Math.floor(y);
    
    if (floorX < 0 || floorY < 0 || floorX >= this.imageData.width || floorY >= this.imageData.height) {
      return 128;
    }
    
    // F키 로직과 동일: 3x3 영역의 평균 밝기 계산
    let totalBrightness = 0;
    let pixelCount = 0;
    
    for (let offsetY = -1; offsetY <= 1; offsetY++) {
      for (let offsetX = -1; offsetX <= 1; offsetX++) {
        const sampleX = floorX + offsetX;
        const sampleY = floorY + offsetY;
        
        if (sampleX >= 0 && sampleX < this.imageData.width && 
            sampleY >= 0 && sampleY < this.imageData.height) {
          const index = (sampleY * this.imageData.width + sampleX) * 4;
          if (index >= 0 && index < this.imageData.data.length) {
            // F키 로직과 동일: 흑백 이미지의 경우 R 채널만 사용
            totalBrightness += this.imageData.data[index];
            pixelCount++;
          }
        }
      }
    }
    
    return pixelCount > 0 ? Math.round(totalBrightness / pixelCount) : 128;
  }

  /**
   * 픽셀의 밝기값 계산 - F키 로직과 동일
   */
  getPixelBrightness(x, y) {
    if (!this.imageData || !this.imageData.data) return 128;
    
    const floorX = Math.floor(x);
    const floorY = Math.floor(y);
    
    if (floorX < 0 || floorY < 0 || floorX >= this.imageData.width || floorY >= this.imageData.height) {
      return 128;
    }
    
    const index = (floorY * this.imageData.width + floorX) * 4;
    
    if (index < 0 || index >= this.imageData.data.length) {
      return 128;
    }
    
    // F키 로직과 동일: 흑백 이미지의 경우 R 채널만 사용
    return this.imageData.data[index];
  }

  /**
   * 정확한 임계값 도달 여부 확인 - F키 로직과 동일
   */
  isThresholdMet(brightness) {
    if (this.isReversed) {
      // 어두운 영역 모드: 임계값보다 어두운 픽셀을 감지
      return brightness <= this.brightnessThreshold;
    } else {
      // 밝은 영역 모드: 임계값보다 밝은 픽셀을 감지
      return brightness >= this.brightnessThreshold;
    }
  }

  /**
   * 감지 중단 - 모든 단계에서 작동하도록 개선
   */
  stopDetection() {
    // console.log('불량 감지 중단 요청 - 모든 단계 중단');
    
    // 모든 상태 플래그를 false로 설정
    this.isDetecting = false;
    this.isProcessing = false;
    this.isCompleting = false;
    
    // 데이터 초기화
    this.stoppedPixels = [];
    this.defectRegions = [];
    
    // 캔버스 초기화
    if (this.originalImageData) {
      this.ctx.putImageData(this.originalImageData, 0, 0);
    }
    
    // console.log('감지 중단 완료 - 모든 상태 초기화됨');
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
    onComplete = null,
    originalImageWidth = null,
    originalImageHeight = null,
    originalImageData = null,
    sourceImage = null
  } = options;

  const detector = new DefectDetector(canvas, ctx, imageData, brightnessThreshold, isReversed, null, originalImageWidth, originalImageHeight, originalImageData, sourceImage);
  return detector.startDetection(boundingBox, onProgress, onComplete);
} 