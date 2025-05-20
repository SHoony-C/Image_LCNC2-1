<template>
  <Teleport to="body">
    <div class="image-measurement-popup" v-if="showPopup" @click.self="closePopup">
      <div class="measurement-container" @click.stop>
        <div class="measurement-header">
          <div class="header-left">
            <h3>이미지 측정 도구</h3>
          </div>
          
          <div class="header-right">
            <div class="measurement-options">
              <div class="option-group">
                <span class="option-group-label">배율</span>
                <input type="number" v-model="magnification" min="0.1" step="0.1" class="header-input no-spinners" title="측정 배율 설정" />
              </div>

              <div class="option-group" v-if="measurementMode.startsWith('area')">
                <span class="option-group-label">선 개수</span>
                <div class="line-count-control">
                  <button class="count-btn" @click="decreaseLineCount" :disabled="lineCount <= 2">
                    <i class="fas fa-minus"></i>
                  </button>
                  <input type="number" v-model="lineCount" min="2" max="20" class="header-input" title="영역 측정 선 개수" />
                  <button class="count-btn" @click="increaseLineCount" :disabled="lineCount >= 20">
                    <i class="fas fa-plus"></i>
                  </button>
                </div>
              </div>

              <div class="option-group">
                <span class="option-group-label">선 측정</span>
                <button class="option-btn" :class="{ active: measurementMode === 'line' }" @click="setMode('line')" title="단일 선 측정">
                  <i class="fas fa-ruler-horizontal"></i>
                </button>
              </div>

              <div class="option-group">
                <span class="option-group-label">영역</span>
                <button class="option-btn" :class="{ active: measurementMode === 'area-vertical' }" @click="setMode('area-vertical')" title="세로 방향 영역 측정">
                  <i class="fas fa-grip-lines-vertical"></i>
                </button>
                <button class="option-btn" :class="{ active: measurementMode === 'area-horizontal' }" @click="setMode('area-horizontal')" title="가로 방향 영역 측정">
                  <i class="fas fa-grip-lines"></i>
                </button>
              </div>

              <div class="option-group">
                <span class="option-group-label">불량 감지</span>
                <button class="option-btn" :class="{ active: measurementMode === 'defect' }" @click="setMode('defect')" title="불량 감지">
                  <i class="fas fa-search"></i>
                </button>
              </div>
            </div>
            
            <button class="close-btn" @click="closePopup">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>

        <div class="measurement-content">
          <div class="image-container" ref="container">
            <img ref="sourceImage" :src="imageUrl" crossorigin="anonymous" style="display: none;" @load="handleImageLoad" />
            <canvas ref="canvas" class="measurement-canvas"
                   @mousedown.prevent.stop="startMeasurement"
                   @mousemove.prevent.stop="updateMeasurement"
                   @mouseup.prevent.stop="endMeasurement"
                   @mouseleave.prevent.stop="endMeasurement"
                   @click="handleCanvasClick"></canvas>
          </div>

          <div class="right-panel">
            <div class="panel-section">
              <div class="id-input-panel">
                <h5>ID 설정</h5>
                <div class="id-input-container">
                  <div class="input-group">
                    <label>Item ID</label>
                    <input type="text" v-model="newItemId" class="form-control" placeholder="Item ID 입력">
                  </div>
                  <div class="input-group">
                    <label>Sub ID</label>
                    <input type="text" v-model="newSubId" class="form-control" placeholder="Sub ID 입력 (예: s1)">
                  </div>
                </div>
                <button class="btn-apply" @click="applySelectedIds" :disabled="selectedRows.length === 0">
                  선택한 행에 ID 적용
                </button>
              </div>

              <div v-if="measurementMode === 'defect'" class="circle-options-panel">
                <button class="circle-option-btn" :class="{ active: circleOptions.striation }" @click="circleOptions.striation = !circleOptions.striation">
                  <i class="fas fa-circle-notch"></i>
                  <span>Striation</span>
                </button>
                <button class="circle-option-btn" :class="{ active: circleOptions.distortion }" @click="circleOptions.distortion = !circleOptions.distortion">
                  <i class="fas fa-circle-dot"></i>
                  <span>Distortion</span>
                </button>
              </div>

              <div class="control-group" v-if="selectedAreaRect">
                <button 
                  class="send-api-btn" 
                  @click="sendSelectedAreaToApi"
                  :disabled="isApiSending"
                >
                  <i class="fas fa-search"></i>
                  {{ isApiSending ? '감지 중...' : '선택 영역 불량 감지' }}
                </button>
              </div>

              <div class="results-panel">
                <div class="results-table-container">
                  <table class="results-table" v-if="measurementMode !== 'defect'">
                    <thead>
                      <tr>
                        <th>Item ID</th>
                        <th>Sub ID</th>
                        <th>값</th>
                        <th>삭제</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(segment, index) in filteredMeasurements" 
                          :key="segment.subItemId"
                          :class="{ 'selected-row': selectedRows.includes(segment) }"
                          @mousedown="handleRowMouseDown(segment, index)"
                          @mouseenter="handleRowMouseEnter(segment, index)"
                          @mouseup="handleRowMouseUp">
                        <td>{{ segment.itemId }}</td>
                        <td>{{ segment.subItemId }}</td>
                        <td>{{ segment.value?.toFixed(2) }}</td>
                        <td class="action-buttons">
                          <button class="option-btn" @click.stop="deleteSegment(segment)">
                            <i class="fas fa-trash"></i>
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <table class="results-table" v-else>
                    <thead>
                      <tr>
                        <th>Item ID</th>
                        <th>Sub ID</th>
                        <th>X</th>
                        <th>Y</th>
                        <th>값</th>
                        <th>양/불</th>
                        <th v-if="circleOptions.striation">Striation</th>
                        <th v-if="circleOptions.distortion">Distortion</th>
                        <th>삭제</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(defect, index) in defectMeasurements" 
                          :key="defect.subItemId"
                          :class="{ 'selected-row': selectedDefects.includes(defect) }"
                          @mousedown="handleDefectMouseDown(defect, index)"
                          @mouseenter="handleDefectMouseEnter(defect, index)"
                          @mouseup="handleDefectMouseUp">
                        <td>{{ defect.itemId }}</td>
                        <td>{{ defect.subItemId }}</td>
                        <td>{{ defect.x?.toFixed(2) }}</td>
                        <td>{{ defect.y?.toFixed(2) }}</td>
                        <td>{{ defect.value?.toFixed(2) }}</td>
                        <td>{{ defect.isBright ? '양' : '불' }}</td>
                        <td v-if="circleOptions.striation">{{ defect.isStriated ? '있음' : '없음' }}</td>
                        <td v-if="circleOptions.distortion">{{ defect.isDistorted ? '있음' : '없음' }}</td>
                        <td class="action-buttons">
                          <button class="option-btn" @click.stop="deleteDefect(defect)">
                            <i class="fas fa-trash"></i>
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div class="results-bottom-bar">
                  <div class="results-summary">
                    <span>총 측정: {{ measurementMode === 'defect' ? defectMeasurements.length : filteredMeasurements.length }}</span>
                  </div>
                  <button 
                    class="save-measurements-btn" 
                    @click="saveMeasurementsToMongoDB"
                    :disabled="isSaving || (measurementMode === 'defect' ? defectMeasurements.length === 0 : filteredMeasurements.length === 0)"
                  >
                    <i class="fas fa-save"></i>
                    {{ isSaving ? '저장 중...' : '측정 결과 저장' }}
                  </button>
                </div>
              </div>
            </div>

            <div class="measurement-controls">
              <template v-if="!isAreaSelectionMode">
                <div class="control-group">
                  <label class="control-label">밝기 임계값: {{ brightnessThreshold }}</label>
                  <input type="range" v-model="brightnessThreshold" min="0" max="255" class="threshold-slider" />
                  <button class="option-btn" @click="toggleReverse">
                    {{ isReversed ? '어두운 영역' : '밝은 영역' }}
                  </button>
                </div>

                <div class="control-group" v-if="measurementMode.startsWith('area')">
                  <label class="control-label">선 개수:</label>
                  <input type="number" v-model="lineCount" min="2" max="20" class="control-input" />
                  <label class="control-label">배율:</label>
                  <input type="number" v-model="magnification" min="0.1" step="0.1" class="control-input" />
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script>
export default {
  name: 'MSA6ImagePopup',
  props: {
    imageUrl: {
      type: String,
      required: true
    },
    showPopup: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close'],
  data() {
    return {
      image: null,
      canvas: null,
      ctx: null,
      isMeasuring: false,
      currentMeasurement: null,
      measurements: [],
      segmentedMeasurements: [],
      nextId: 1,
      subItemPrefix: 'S',
      brightnessThreshold: 200,
      isReversed: false,
      measurementMode: 'line',
      isSettingReference: false,
      scale: 1,
      magnification: 500,
      imageData: null,
      imageRatio: 1,
      prevWidth: 1,
      prevHeight: 1,
      brightSubIdCounter: 1,
      darkSubIdCounter: 1,
      selectedRows: [],
      selectionStart: null,
      newItemId: '',
      newSubId: '',
      selectedMeasurement: null,
      measurementHistory: [],
      selectedSegment: null,
      undoHistory: [],
      redoHistory: [],
      areaStart: null,
      areaEnd: null,
      lineSpacing: 50,
      lineCount: 10,
      circleOptions: {
        striation: false,
        distortion: false
      },
      selectedArea: null,
      isApiSending: false,
      isAreaSelectionMode: false,
      areaSelectionStart: null,
      areaSelectionEnd: null,
      selectedAreaRect: null,
      defectMeasurements: [],
      selectedDefects: [],
      isSaving: false,
    };
  },
  mounted() {
    this.loadImage();
    window.addEventListener('resize', this.onWindowResize);
    window.addEventListener('keydown', this.handleKeyDown);
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.onWindowResize);
    window.removeEventListener('keydown', this.handleKeyDown);
  },
  computed: {
    filteredMeasurements() {
      return this.segmentedMeasurements.filter(segment => 
        this.isReversed ? !segment.isBright : segment.isBright
      );
    },
    brightSegmentsCount() {
      return this.filteredMeasurements.length;
    },
    darkSegmentsCount() {
      return this.segmentedMeasurements.filter(s => !s.isBright).length;
    }
  },
  watch: {
    imageUrl: {
      immediate: true,
      handler(newUrl) {
        if (newUrl) {
          this.$nextTick(() => {
            this.loadImage();
          });
        }
      }
    },
    magnification: {
      handler() {
        // 배율 변경 시 모든 측정값 업데이트
        this.updateAllMeasurements();
      }
    }
  },
  methods: {
    async loadImage() {
      this.image = new Image();
      this.image.crossOrigin = 'anonymous';
      this.image.src = this.imageUrl;
      
      await new Promise((resolve) => {
        this.image.onload = () => {
          this.updateCanvasSize();
          resolve();
        };
      });
    },
    async handleImageLoad() {
      const img = this.$refs.sourceImage;
      
      // 원본 이미지 비율 저장
      this.imageRatio = img.naturalWidth / img.naturalHeight;
      
      // 이미지 데이터 추출을 위한 임시 캔버스
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = img.naturalWidth;
      tempCanvas.height = img.naturalHeight;
      const tempCtx = tempCanvas.getContext('2d');
      
      tempCtx.drawImage(img, 0, 0);
      this.imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      
      this.updateCanvasSize();
    },
    updateCanvasSize() {
      const img = this.$refs.sourceImage;
      const canvas = this.$refs.canvas;
      const container = this.$refs.container;
      
      const containerRatio = container.clientWidth / container.clientHeight;
      
      let canvasWidth, canvasHeight;
      if (containerRatio > this.imageRatio) {
        canvasHeight = container.clientHeight;
        canvasWidth = canvasHeight * this.imageRatio;
      } else {
        canvasWidth = container.clientWidth;
        canvasHeight = canvasWidth / this.imageRatio;
      }
      
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      
      // 컨텍스트 재설정 및 이미지 다시 그리기
      this.ctx = canvas.getContext('2d');
      this.ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // 기존 측정값들의 좌표 조정
      this.adjustMeasurements(canvasWidth / this.prevWidth, canvasHeight / this.prevHeight);
      
      this.prevWidth = canvasWidth;
      this.prevHeight = canvasHeight;
      
      this.render();
    },
    adjustMeasurements(scaleX, scaleY) {
      if (!isFinite(scaleX) || !isFinite(scaleY)) return;
      
      // 모든 측정값의 좌표 조정
      this.measurements.forEach(measurement => {
        measurement.start.x *= scaleX;
        measurement.start.y *= scaleY;
        measurement.end.x *= scaleX;
        measurement.end.y *= scaleY;
      });

      this.segmentedMeasurements.forEach(segment => {
        segment.start.x *= scaleX;
        segment.start.y *= scaleY;
        segment.end.x *= scaleX;
        segment.end.y *= scaleY;
      });
    },
    onWindowResize() {
      if (this.$refs.canvas) {
        this.updateCanvasSize();
      }
    },
    calculateValue(start, end) {
      if (!start || !end) return 0;
      const img = this.$refs.sourceImage;
      const canvas = this.$refs.canvas;
      
      // 캔버스 좌표를 원본 이미지 좌표로 변환
      const startX = (start.x / canvas.width) * img.naturalWidth;
      const startY = (start.y / canvas.height) * img.naturalHeight;
      const endX = (end.x / canvas.width) * img.naturalWidth;
      const endY = (end.y / canvas.height) * img.naturalHeight;
      
      // 원본 이미지 좌표에서의 거리 계산 및 배율 적용
      const dx = endX - startX;
      const dy = endY - startY;
      return parseFloat((Math.sqrt(dx * dx + dy * dy) * this.magnification).toFixed(2));
    },
    startMeasurement(e) {
      if (this.isAreaSelectionMode) {
        const pos = this.getLocalPos(e);
        this.areaSelectionStart = pos;
        this.areaSelectionEnd = pos;
        this.isMeasuring = true;
        this.render();
        return;
      }

      // 기존 측정 로직
      e.preventDefault();
      e.stopPropagation();
      const pos = this.getLocalPos(e);

      if (this.measurementMode === 'line') {
        this.currentMeasurement = {
          start: pos,
          end: pos,
          itemId: this.nextId.toString(),
          subItemId: `${this.nextId}-${this.subItemPrefix}1`,
          value: 0,
          brightness: this.calculateBrightness(pos.x, pos.y)
        };
      } else if (this.measurementMode === 'circle') {
        this.areaStart = pos;
        this.areaEnd = pos;
      } else {
        this.areaStart = pos;
        this.areaEnd = pos;
      }
      
      this.isMeasuring = true;
      this.render();
    },
    updateMeasurement(e) {
      if (!this.isMeasuring) return;
      
      if (this.isAreaSelectionMode) {
        const pos = this.getLocalPos(e);
        this.areaSelectionEnd = pos;
        this.render();
        return;
      }

      // 기존 측정 업데이트 로직
      const pos = this.getLocalPos(e);

      if (this.measurementMode === 'line' && this.currentMeasurement) {
        this.currentMeasurement.end = pos;
        this.currentMeasurement.value = this.calculateValue(this.currentMeasurement.start, this.currentMeasurement.end);
      } else if (this.measurementMode === 'circle' || this.areaStart) {
        this.areaEnd = pos;
      }
      
      this.render();
    },
    endMeasurement() {
      if (!this.isMeasuring) return;
      this.isMeasuring = false;

      if (this.isAreaSelectionMode) {
        if (this.areaSelectionStart && this.areaSelectionEnd) {
          const width = Math.abs(this.areaSelectionEnd.x - this.areaSelectionStart.x);
          const height = Math.abs(this.areaSelectionEnd.y - this.areaSelectionStart.y);
          
          if (width > 10 && height > 10) {
            this.selectedAreaRect = {
              start: { ...this.areaSelectionStart },
              end: { ...this.areaSelectionEnd }
            };
            console.log('Selected area rect set:', this.selectedAreaRect);
          }
        }
        this.render();
        return;
      }

      // 기존 측정 종료 로직
      if (this.measurementMode === 'line') {
        if (this.currentMeasurement && 
            this.calculateValue(this.currentMeasurement.start, this.currentMeasurement.end) > 5) {
          const measurement = {
            ...this.currentMeasurement,
            value: this.calculateValue(this.currentMeasurement.start, this.currentMeasurement.end),
            brightness: this.calculateAverageBrightness(this.currentMeasurement.start, this.currentMeasurement.end)
          };
          this.measurements.push(measurement);
          this.nextId++;
          this.createSegments(measurement);
        }
      } else if (this.areaStart && this.areaEnd) {
        const width = Math.abs(this.areaEnd.x - this.areaStart.x);
        const height = Math.abs(this.areaEnd.y - this.areaStart.y);
        
        if (width > 10 && height > 10) {
          this.selectedArea = {
            start: { ...this.areaStart },
            end: { ...this.areaEnd }
          };
          
          if (this.measurementMode === 'defect') {
            console.log('Defect mode - Setting selectedAreaRect');
            this.selectedAreaRect = {
              start: { ...this.areaStart },
              end: { ...this.areaEnd }
            };
            console.log('selectedAreaRect after setting:', this.selectedAreaRect);
          } else if (this.measurementMode === 'circle') {
            const measurement = {
              start: { ...this.areaStart },
              end: { ...this.areaEnd },
              itemId: this.nextId.toString(),
              subItemId: `${this.nextId}-${this.subItemPrefix}1`,
              value: Math.max(width, height),
              brightness: this.calculateAverageBrightness(this.areaStart, this.areaEnd),
              isStriated: this.circleOptions.striation,
              isDistorted: this.circleOptions.distortion,
              isBright: this.calculateBrightness(
                (this.areaStart.x + this.areaEnd.x) / 2,
                (this.areaStart.y + this.areaEnd.y) / 2
              ) > this.brightnessThreshold
            };
            this.measurements.push(measurement);
            this.segmentedMeasurements.push(measurement);
            this.nextId++;
          } else if (this.measurementMode.startsWith('area')) {
            this.createAreaMeasurements();
          }
        }
      }
      
      this.currentMeasurement = null;
      this.render();
    },
    calculateBrightness(x, y) {
      if (!this.imageData) return 128;
      
      const canvas = this.$refs.canvas;
      const img = this.$refs.sourceImage;
      
      // 캔버스 좌표를 원본 이미지 좌표로 변환
      const imageX = Math.floor((x / canvas.width) * img.naturalWidth);
      const imageY = Math.floor((y / canvas.height) * img.naturalHeight);
      
      // 주변 픽셀을 포함한 밝기 계산 (3x3 영역)
      let totalBrightness = 0;
      let pixelCount = 0;
      
      for (let offsetY = -1; offsetY <= 1; offsetY++) {
        for (let offsetX = -1; offsetX <= 1; offsetX++) {
          const sampleX = imageX + offsetX;
          const sampleY = imageY + offsetY;
          
          if (sampleX >= 0 && sampleX < img.naturalWidth && 
              sampleY >= 0 && sampleY < img.naturalHeight) {
            const index = (sampleY * img.naturalWidth + sampleX) * 4;
            if (index >= 0 && index < this.imageData.data.length) {
              // 흑백 이미지의 경우 R 채널만 사용
              totalBrightness += this.imageData.data[index];
              pixelCount++;
            }
          }
        }
      }
      
      return pixelCount > 0 ? Math.round(totalBrightness / pixelCount) : 128;
    },
    calculateAverageBrightness(start, end) {
      if (!start || !end) return 0;
      const samples = 3000; // 샘플링 포인트 수 증가
      let totalBrightness = 0;
      let validSamples = 0;
      
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const x = start.x + (end.x - start.x) * t;
        const y = start.y + (end.y - start.y) * t;
        const brightness = this.calculateBrightness(x, y);
        if (brightness !== 128) { // 유효한 픽셀만 계산에 포함
          totalBrightness += brightness;
          validSamples++;
        }
      }
      
      return validSamples > 0 ? totalBrightness / validSamples : 0;
    },
    getLocalPos(e) {
      const canvas = this.$refs.canvas;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    },
    createSegments(measurement) {
      const samples = 3000; // 샘플링 포인트 수
      const segments = [];
      let prevBrightness = null;
      let startPoint = null;
      
      const points = [];
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const point = {
          x: measurement.start.x + (measurement.end.x - measurement.start.x) * t,
          y: measurement.start.y + (measurement.end.y - measurement.start.y) * t
        };
        const brightness = this.calculateBrightness(point.x, point.y);
        points.push({ ...point, brightness });
      }
      
      // 이동 평균으로 노이즈 제거
      const windowSize = 5;
      const smoothedPoints = points.map((point, i) => {
        if (i < windowSize/2 || i > points.length - windowSize/2 - 1) return point;
        
        let sum = 0;
        for (let j = -Math.floor(windowSize/2); j <= Math.floor(windowSize/2); j++) {
          sum += points[i + j].brightness;
        }
        return { ...point, brightness: sum / windowSize };
      });
      
      // 세그먼트 생성
      smoothedPoints.forEach((point, index) => {
        const isBright = point.brightness > this.brightnessThreshold;
        
        if (index === 0) {
          startPoint = point;
          prevBrightness = isBright;
        } else {
          // 밝기가 변경되었거나 마지막 포인트인 경우
          if (isBright !== prevBrightness || index === smoothedPoints.length - 1) {
            if (startPoint) {
              segments.push({
                start: { x: startPoint.x, y: startPoint.y },
                end: { x: point.x, y: point.y },
                brightness: prevBrightness ? 255 : 0,
                isBright: prevBrightness,
                itemId: measurement.itemId,
                subItemId: `s${prevBrightness ? this.brightSubIdCounter++ : this.darkSubIdCounter++}`,
                value: this.calculateValue({ x: startPoint.x, y: startPoint.y }, { x: point.x, y: point.y })
              });
            }
            startPoint = point;
            prevBrightness = isBright;
          }
        }
      });
      
      this.segmentedMeasurements.push(...segments);
    },
    render() {
      if (!this.ctx) return;
      
      const canvas = this.$refs.canvas;
      const img = this.$refs.sourceImage;
      
      // 캔버스 초기화
      this.ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      console.log('Render - measurementMode:', this.measurementMode);
      console.log('Render - selectedAreaRect:', this.selectedAreaRect);
      console.log('Render - isMeasuring:', this.isMeasuring);

      // 측정된 선들 그리기
      if (this.measurementMode !== 'defect') {
        this.segmentedMeasurements.forEach(segment => {
          this.ctx.beginPath();
          // 밝기 조건에 따라 색상과 선 스타일 결정
          if (this.isReversed ? segment.isBright : !segment.isBright) {
            this.ctx.strokeStyle = 'blue';
            this.ctx.setLineDash([5, 5]); // 파란색은 점선
          } else {
            this.ctx.strokeStyle = 'red';
            this.ctx.setLineDash([]); // 빨간색은 실선
          }
          this.ctx.lineWidth = 2;
          this.ctx.moveTo(segment.start.x, segment.start.y);
          this.ctx.lineTo(segment.end.x, segment.end.y);
          this.ctx.stroke();
        });
      }

      // 현재 측정 중인 선 그리기
      if (this.isMeasuring) {
        if (this.measurementMode === 'line' && this.currentMeasurement) {
          this.ctx.beginPath();
          this.ctx.strokeStyle = 'blue';
          this.ctx.lineWidth = 2;
          this.ctx.setLineDash([5, 5]); // 점선
          this.ctx.moveTo(this.currentMeasurement.start.x, this.currentMeasurement.start.y);
          this.ctx.lineTo(this.currentMeasurement.end.x, this.currentMeasurement.end.y);
          this.ctx.stroke();
        } else if (this.areaStart && this.areaEnd) {
          if (this.measurementMode === 'defect') {
            // 불량 감지 모드에서는 점선 네모 박스만 표시
            this.ctx.strokeStyle = 'blue';
            this.ctx.setLineDash([5, 5]);
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(
              Math.min(this.areaStart.x, this.areaEnd.x),
              Math.min(this.areaStart.y, this.areaEnd.y),
              Math.abs(this.areaEnd.x - this.areaStart.x),
              Math.abs(this.areaEnd.y - this.areaStart.y)
            );
          } else {
            // 영역 측정 그리기
            this.ctx.strokeStyle = 'blue';
            this.ctx.setLineDash([5, 5]); // 점선
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(
              Math.min(this.areaStart.x, this.areaEnd.x),
              Math.min(this.areaStart.y, this.areaEnd.y),
              Math.abs(this.areaEnd.x - this.areaStart.x),
              Math.abs(this.areaEnd.y - this.areaStart.y)
            );

            // 예상되는 측정선 그리기
            if (this.measurementMode === 'area-vertical') {
              const startX = Math.min(this.areaStart.x, this.areaEnd.x);
              const endX = Math.max(this.areaStart.x, this.areaEnd.x);
              const startY = Math.min(this.areaStart.y, this.areaEnd.y);
              const endY = Math.max(this.areaStart.y, this.areaEnd.y);
              const width = endX - startX;
              const spacing = width / (this.lineCount - 1);

              this.ctx.beginPath();
              this.ctx.strokeStyle = 'blue';
              this.ctx.setLineDash([5, 5]); // 점선
              for (let i = 0; i < this.lineCount; i++) {
                const x = startX + (spacing * i);
                this.ctx.moveTo(x, startY);
                this.ctx.lineTo(x, endY);
              }
              this.ctx.stroke();
            } else if (this.measurementMode === 'area-horizontal') {
              const startX = Math.min(this.areaStart.x, this.areaEnd.x);
              const endX = Math.max(this.areaStart.x, this.areaEnd.x);
              const startY = Math.min(this.areaStart.y, this.areaEnd.y);
              const endY = Math.max(this.areaStart.y, this.areaEnd.y);
              const height = endY - startY;
              const spacing = height / (this.lineCount - 1);

              this.ctx.beginPath();
              this.ctx.strokeStyle = 'blue';
              this.ctx.setLineDash([5, 5]); // 점선
              for (let i = 0; i < this.lineCount; i++) {
                const y = startY + (spacing * i);
                this.ctx.moveTo(startX, y);
                this.ctx.lineTo(endX, y);
              }
              this.ctx.stroke();
            }
          }
        }
      }

      // 선택된 영역 그리기 (불량 감지 모드에서만)
      if (this.measurementMode === 'defect' && this.selectedAreaRect) {
        console.log('Drawing selected area rect:', this.selectedAreaRect);
        this.ctx.beginPath();
        this.ctx.strokeStyle = 'red';
        this.ctx.setLineDash([]); // 실선
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(
          Math.min(this.selectedAreaRect.start.x, this.selectedAreaRect.end.x),
          Math.min(this.selectedAreaRect.start.y, this.selectedAreaRect.end.y),
          Math.abs(this.selectedAreaRect.end.x - this.selectedAreaRect.start.x),
          Math.abs(this.selectedAreaRect.end.y - this.selectedAreaRect.start.y)
        );
      }
    },
    setMode(mode) {
      if (mode === 'defect') {
        if (this.measurements.length > 0) {
          if (!confirm('불량 감지 모드로 전환하면 기존 측정값이 초기화됩니다. 계속하시겠습니까?')) {
            return;
          }
          // 모든 측정값 초기화
          this.measurements = [];
          this.segmentedMeasurements = [];
          this.selectedMeasurement = null;
          this.selectedRows = [];
          this.selectedSegment = null;
          this.nextId = 1;
        }
      }
      
      this.measurementMode = mode;
      this.selectedMeasurement = null;
      this.areaStart = null;
      this.areaEnd = null;
      this.selectedArea = null;
      this.render();
    },
    toggleReferenceMode() {
      this.isSettingReference = !this.isSettingReference;
    },
    closePopup() {
      this.$emit('close');
    },
    applySelectedIds() {
      if (this.selectedRows.length === 0 || !this.newItemId || !this.newSubId) return;
      
      this.selectedRows.forEach((segment, index) => {
        segment.itemId = this.newItemId;
        // subId에 숫자만 추출하여 증가
        const baseSubId = this.newSubId.replace(/\d+$/, '');
        const startNum = parseInt(this.newSubId.match(/\d+$/)?.[0] || '1');
        segment.subItemId = `${baseSubId}${startNum + index}`;
      });
      
      this.render();
    },
    editSegment(segment) {
      // 세그먼트 편집 로직 구현
      console.log('Editing segment:', segment);
    },
    deleteSegment(segment) {
      const index = this.segmentedMeasurements.indexOf(segment);
      if (index > -1) {
        // 관련된 모든 세그먼트와 측정값 삭제
        const itemId = segment.itemId;
        this.segmentedMeasurements = this.segmentedMeasurements.filter(s => s.itemId !== itemId);
        this.measurements = this.measurements.filter(m => m.itemId !== itemId);
        
        // 삭제된 항목을 실행 취소 기록에 추가
        const relatedSegments = this.segmentedMeasurements.filter(s => s.itemId === itemId);
        const measurement = this.measurements.find(m => m.itemId === itemId);
        if (measurement) {
          this.undoHistory.push({
            measurement: measurement,
            segments: relatedSegments
          });
        }
        
        this.render();
      }
    },
    toggleReverse() {
      this.isReversed = !this.isReversed;
      this.render(); // 시각적 표시만 업데이트
    },
    handleRowMouseDown(segment, index) {
      this.selectionStart = index;
      this.selectedRows = [segment];
      this.selectedSegment = segment;
    },
    handleRowMouseEnter(segment, index) {
      if (this.selectionStart !== null) {
        const start = Math.min(this.selectionStart, index);
        const end = Math.max(this.selectionStart, index);
        this.selectedRows = this.filteredMeasurements.slice(start, end + 1);
      }
    },
    handleRowMouseUp() {
      this.selectionStart = null;
    },
    handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        this.undoLastMeasurement();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        this.redoLastMeasurement();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.selectedSegment) {
          this.deleteSegment(this.selectedSegment);
          this.selectedSegment = null;
        }
      }
    },
    undoLastMeasurement() {
      if (this.measurements.length > 0) {
        const lastMeasurement = this.measurements.pop();
        this.undoHistory.push(lastMeasurement);
        
        // 관련된 세그먼트들도 함께 저장하고 삭제
        const relatedSegments = this.segmentedMeasurements.filter(
          segment => segment.itemId === lastMeasurement.itemId
        );
        this.redoHistory.push({
          measurement: lastMeasurement,
          segments: relatedSegments
        });
        
        this.segmentedMeasurements = this.segmentedMeasurements.filter(
          segment => segment.itemId !== lastMeasurement.itemId
        );
        
        this.render();
      }
    },
    redoLastMeasurement() {
      if (this.redoHistory.length > 0) {
        const lastState = this.redoHistory.pop();
        this.measurements.push(lastState.measurement);
        this.segmentedMeasurements.push(...lastState.segments);
        this.render();
      }
    },
    updateAllMeasurements() {
      // 모든 측정값에 배율 적용
      this.measurements.forEach(measurement => {
        if (measurement.radius !== undefined) {
          measurement.value = measurement.radius * 2 * this.magnification;
        } else {
          measurement.value = this.calculateValue(measurement.start, measurement.end);
        }
      });

      this.segmentedMeasurements.forEach(segment => {
        segment.value = this.calculateValue(segment.start, segment.end);
      });
    },
    createAreaMeasurements() {
      const startX = Math.min(this.areaStart.x, this.areaEnd.x);
      const endX = Math.max(this.areaStart.x, this.areaEnd.x);
      const startY = Math.min(this.areaStart.y, this.areaEnd.y);
      const endY = Math.max(this.areaStart.y, this.areaEnd.y);
      
      if (this.measurementMode === 'area-vertical') {
        const width = endX - startX;
        const spacing = width / (this.lineCount - 1);
        
        for (let i = 0; i < this.lineCount; i++) {
          const x = startX + (spacing * i);
          const measurement = {
            start: { x, y: startY },
            end: { x, y: endY },
            itemId: this.nextId.toString(),
            subItemId: `${this.nextId}-${this.subItemPrefix}${i + 1}`,
            value: this.calculateValue({ x, y: startY }, { x, y: endY }),
            brightness: 0
          };
          this.measurements.push(measurement);
          this.createSegments(measurement);
        }
        this.nextId++;
      } else if (this.measurementMode === 'area-horizontal') {
        const height = endY - startY;
        const spacing = height / (this.lineCount - 1);
        
        for (let i = 0; i < this.lineCount; i++) {
          const y = startY + (spacing * i);
          const measurement = {
            start: { x: startX, y },
            end: { x: endX, y },
            itemId: this.nextId.toString(),
            subItemId: `${this.nextId}-${this.subItemPrefix}${i + 1}`,
            value: this.calculateValue({ x: startX, y }, { x: endX, y }),
            brightness: 0
          };
          this.measurements.push(measurement);
          this.createSegments(measurement);
        }
        this.nextId++;
      }
    },
    // 선 선택을 위한 거리 계산 함수
    distanceToLine(point, lineStart, lineEnd) {
      const A = point.x - lineStart.x;
      const B = point.y - lineStart.y;
      const C = lineEnd.x - lineStart.x;
      const D = lineEnd.y - lineStart.y;
      
      const dot = A * C + B * D;
      const lenSq = C * C + D * D;
      let param = -1;
      
      if (lenSq !== 0) param = dot / lenSq;
      
      let xx, yy;
      
      if (param < 0) {
        xx = lineStart.x;
        yy = lineStart.y;
      } else if (param > 1) {
        xx = lineEnd.x;
        yy = lineEnd.y;
      } else {
        xx = lineStart.x + param * C;
        yy = lineStart.y + param * D;
      }
      
      const dx = point.x - xx;
      const dy = point.y - yy;
      
      return Math.sqrt(dx * dx + dy * dy);
    },
    // 캔버스 클릭 이벤트 핸들러
    handleCanvasClick(e) {
      if (this.isMeasuring) return;
      
      const pos = this.getLocalPos(e);
      const threshold = 10; // 선택 허용 거리 (픽셀)
      
      // 가장 가까운 측정선 찾기
      let closestMeasurement = null;
      let minDistance = threshold;
      
      this.measurements.forEach(measurement => {
        const distance = this.distanceToLine(pos, measurement.start, measurement.end);
        if (distance < minDistance) {
          minDistance = distance;
          closestMeasurement = measurement;
        }
      });
      
      this.selectedMeasurement = closestMeasurement;
      this.render();
    },
    extractSelectedAreaImage() {
      if (!this.selectedAreaRect) return null;
      
      const { start, end } = this.selectedAreaRect;
      const canvas = this.$refs.canvas;
      const tempCanvas = document.createElement('canvas');
      const ctx = tempCanvas.getContext('2d');
      
      const x = Math.min(start.x, end.x);
      const y = Math.min(start.y, end.y);
      const width = Math.abs(end.x - start.x);
      const height = Math.abs(end.y - start.y);
      
      tempCanvas.width = width;
      tempCanvas.height = height;
      
      ctx.drawImage(
        canvas,
        x, y, width, height,
        0, 0, width, height
      );
      
      return tempCanvas.toDataURL('image/png');
    },
    
    async sendSelectedAreaToApi() {
      if (!this.selectedAreaRect || this.isApiSending) return;
      
      try {
        this.isApiSending = true;
        const imageData = this.extractSelectedAreaImage();
        
        if (!imageData) {
          throw new Error('선택된 영역이 없습니다.');
        }
        
        const response = await fetch('http://localhost:8000/api/analyze-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image: imageData,
            x: Math.min(this.selectedAreaRect.start.x, this.selectedAreaRect.end.x),
            y: Math.min(this.selectedAreaRect.start.y, this.selectedAreaRect.end.y),
            width: Math.abs(this.selectedAreaRect.end.x - this.selectedAreaRect.start.x),
            height: Math.abs(this.selectedAreaRect.end.y - this.selectedAreaRect.start.y),
          }),
        });
        
        if (!response.ok) {
          throw new Error('API 호출 실패');
        }
        
        const result = await response.json();
        console.log('API Response:', result);
        
      } catch (error) {
        console.error('이미지 전송 실패:', error);
      } finally {
        this.isApiSending = false;
      }
    },
    decreaseLineCount() {
      if (this.lineCount > 2) {
        this.lineCount--;
      }
    },
    increaseLineCount() {
      if (this.lineCount < 20) {
        this.lineCount++;
      }
    },
    toggleAreaSelectionMode() {
      this.isAreaSelectionMode = !this.isAreaSelectionMode;
      if (this.isAreaSelectionMode) {
        this.selectedAreaRect = null;
        this.areaSelectionStart = null;
        this.areaSelectionEnd = null;
      }
      this.render();
    },
    handleDefectMouseDown(defect, index) {
      this.selectionStart = index;
      this.selectedDefects = [defect];
    },
    handleDefectMouseEnter(defect, index) {
      if (this.selectionStart !== null) {
        const start = Math.min(this.selectionStart, index);
        const end = Math.max(this.selectionStart, index);
        this.selectedDefects = this.defectMeasurements.slice(start, end + 1);
      }
    },
    handleDefectMouseUp() {
      this.selectionStart = null;
    },
    deleteDefect(defect) {
      const index = this.defectMeasurements.indexOf(defect);
      if (index > -1) {
        this.defectMeasurements.splice(index, 1);
        this.render();
      }
    },
    toggleImageSelection(image, selected) {
      // 이미지 선택 토글
      this.selectedImages[image.id] = selected;
    },
    saveMeasurementsToMongoDB() {
      if (this.isSaving || (this.measurementMode === 'defect' ? this.defectMeasurements.length === 0 : this.filteredMeasurements.length === 0)) return;
      
      this.isSaving = true;
      
      // 세션 ID 가져오기 (localStorage에서)
      const sessionId = localStorage.getItem('current_workflow_session_id');
      
      if (!sessionId) {
        alert('워크플로우 세션을 찾을 수 없습니다. 먼저 워크플로우를 실행해 주세요.');
        this.isSaving = false;
        return;
      }
      
      // 측정 데이터 준비
      const measurementData = {
        session_id: sessionId,
        measurements: this.measurementMode === 'defect' ? this.defectMeasurements : this.filteredMeasurements,
        measurement_mode: this.measurementMode,
        measurement_config: {
          magnification: this.magnification,
          lineCount: this.lineCount,
          brightnessThreshold: this.brightnessThreshold,
          isReversed: this.isReversed
        },
        timestamp: new Date().toISOString()
      };
      
      // MongoDB에 저장 API 호출
      fetch('http://localhost:8000/api/msa6/save-measurement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(measurementData)
      })
      .then(response => response.json())
      .then(result => {
        if (result.status === 'success') {
          alert('측정 결과가 성공적으로 저장되었습니다.');
        } else {
          alert(`저장 실패: ${result.message || '알 수 없는 오류'}`);
        }
      })
      .catch(error => {
        console.error('측정 데이터 저장 중 오류:', error);
        alert(`저장 오류: ${error.message || '알 수 없는 오류'}`);
      })
      .finally(() => {
        this.isSaving = false;
      });
    }
  }
};
</script>

<style scoped>
.image-measurement-popup {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.measurement-container {
  background: #f8f9fa;
  border-radius: 12px;
  width: 95vw;
  height: 95vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
  position: relative;
  height: 100%;
}

.measurement-header {
  padding: 1rem 1.5rem;
  background: #7950f2;
  border-bottom: 1px solid #6741d9;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.header-left h3 {
  margin: 0;
  color: #fff;
  font-size: 1.25rem;
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.measurement-options {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: rgba(255, 255, 255, 0.1);
  padding: 0.5rem;
  border-radius: 8px;
}

.option-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  border-right: 1px solid rgba(255, 255, 255, 0.2);
}

.option-group:last-child {
  border-right: none;
}

.option-group-label {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.85rem;
  font-weight: 500;
  margin-right: 0.5rem;
}

.option-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.option-btn i {
  font-size: 1.1rem;
}

.option-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.5);
}

.option-btn.active {
  background: #fff;
  color: #7950f2;
  border-color: #fff;
}

.close-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn i {
  font-size: 1.2rem;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.5);
}

.measurement-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.image-container {
  flex: 1;
  position: relative;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.measurement-canvas {
  position: absolute;
  cursor: crosshair;
}

.right-panel {
  width: 400px;
  background: #fff;
  border-left: 1px solid #e9ecef;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.results-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.results-table-container {
  border: 1px solid #e9ecef;
  border-radius: 8px;
  overflow: auto;
  height: 600px;
  max-height: 65vh;
}

.results-bottom-bar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  gap: 1.5rem;
  padding: 1.25rem 1.5rem 1.5rem 1.5rem;
  background: #fff;
  border-top: 1px solid #e9ecef;
  flex-shrink: 0;
  position: static;
  margin-top: auto;
}

.results-bottom-bar .results-summary {
  margin: 0;
  padding: 0;
  background: none;
  font-size: 1rem;
  color: #7950f2;
  font-weight: 600;
}

.save-measurements-btn {
  padding: 12px 28px;
  background-color: #7950f2;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1.1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 4px 16px rgba(121, 80, 242, 0.12);
  transition: background 0.2s, box-shadow 0.2s;
}

.save-measurements-btn:hover:not(:disabled) {
  background-color: #6741d9;
  box-shadow: 0 6px 20px rgba(121, 80, 242, 0.18);
}

.save-measurements-btn:disabled {
  background-color: #b197fc;
  cursor: not-allowed;
}

.save-measurements-btn i {
  font-size: 20px;
}

.panel-section {
  padding: 1.5rem;
}

.id-input-panel {
  background: #f8f0ff;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 2px 8px rgba(121, 80, 242, 0.1);
}

.id-input-panel h5 {
  color: #7950f2;
  margin: 0 0 1rem 0;
  font-size: 1rem;
}

.id-input-container {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.input-group {
  flex: 1;
}

.input-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: #495057;
  font-size: 0.9rem;
  font-weight: 500;
}

.form-control {
  width: 100%;
  padding: 0.625rem;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.form-control:focus {
  border-color: #7950f2;
  outline: none;
  box-shadow: 0 0 0 3px rgba(121, 80, 242, 0.1);
}

.btn-apply {
  width: 100%;
  padding: 0.75rem;
  background: #7950f2;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-apply:hover {
  background: #6741d9;
}

.btn-apply:disabled {
  background: #dee2e6;
  cursor: not-allowed;
}

.results-table {
  width: 100%;
  border-collapse: collapse;
}

.results-table th {
  background: #f8f0ff;
  padding: 0.75rem 1rem;
  text-align: left;
  font-weight: 600;
  color: #495057;
  border-bottom: 2px solid #e9ecef;
  position: sticky;
  top: 0;
}

.results-table td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e9ecef;
  color: #495057;
}

.selected-row {
  background-color: #f3f0ff !important;
}

.results-table tr {
  cursor: pointer;
  user-select: none;
}

.results-table tr:hover {
  background-color: #f8f0ff;
}

.measurement-controls {
  position: absolute;
  bottom: 1.5rem;
  left: 1.5rem;
  background: rgba(0, 0, 0, 0.85);
  padding: 1rem 1.5rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  gap: 1.5rem;
  white-space: nowrap;
  max-width: calc(100% - 3rem);
  overflow-x: auto;
  z-index: 1000;
}

.measurement-controls .option-btn {
  background: #7950f2;
  color: #fff;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 120px;
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.measurement-controls .option-btn i {
  font-size: 1.2rem;
  color: #fff;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
}

.measurement-controls .option-btn:hover {
  background: #6741d9;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.measurement-controls .option-btn.active {
  background: #fff;
  color: #7950f2;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.measurement-controls .option-btn.active i {
  color: #7950f2;
  text-shadow: none;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
}

.control-label {
  color: #fff;
  font-size: 1rem;
  font-weight: 500;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
  min-width: max-content;
}

.threshold-slider {
  width: 200px;
  height: 6px;
  -webkit-appearance: none;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  outline: none;
}

.threshold-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  background: #fff;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.threshold-slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.results-summary {
  display: flex;
  justify-content: space-between;
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: #f8f0ff;
  border-radius: 6px;
  font-size: 0.9rem;
  color: #495057;
  font-weight: 500;
}

::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #f8f0ff;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #7950f2;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #6741d9;
}

.measurement-controls .control-group label {
  color: #fff;
  font-size: 1rem;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
}

.results-table td.action-buttons .option-btn {
  color: #7950f2;
  background: #fff;
  border: 1px solid #7950f2;
  padding: 8px 12px;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.results-table td.action-buttons .option-btn i {
  color: #7950f2;
  text-shadow: none;
}

.results-table td.action-buttons .option-btn:hover {
  background: #7950f2;
  color: #fff;
  transform: scale(1.05);
  transition: all 0.2s ease;
}

.results-table td.action-buttons .option-btn:hover i {
  color: #fff;
}

.circle-options-panel {
  background: #f8f0ff;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
  display: flex;
  gap: 1rem;
}

.circle-option-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px solid #7950f2;
  border-radius: 6px;
  background: #fff;
  color: #7950f2;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.circle-option-btn i {
  font-size: 1.1rem;
}

.circle-option-btn:hover {
  background: #f8f0ff;
}

.circle-option-btn.active {
  background: #7950f2;
  color: #fff;
}

.send-api-btn {
  background: #2b8a3e;
  color: #fff;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 140px;
  white-space: nowrap;
}

.send-api-btn i {
  font-size: 1.2rem;
}

.send-api-btn:hover:not(:disabled) {
  background-color: #2f9e44;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.send-api-btn:disabled {
  background: #adb5bd;
  cursor: not-allowed;
  transform: none;
}

.control-input {
  width: 60px;
  padding: 4px 8px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 0.9rem;
  text-align: center;
}

.control-input:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.2);
}

.header-input {
  width: 60px;
  padding: 4px 8px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 0.9rem;
  text-align: center;
}

.header-input:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.2);
}

.header-input.no-spinners::-webkit-inner-spin-button,
.header-input.no-spinners::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.header-input.no-spinners {
  -moz-appearance: textfield;
}

.line-count-control {
  display: flex;
  align-items: center;
  gap: 4px;
}

.count-btn {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.count-btn i {
  font-size: 0.8rem;
}

.count-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.5);
}

.count-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 1200px) {
  .measurement-container {
    width: 100vw;
    height: 100vh;
    border-radius: 0;
  }

  .measurement-content {
    flex-direction: column;
  }

  .right-panel {
    width: 100%;
    height: auto;
    min-height: 200px;
  }

  .image-container {
    height: 50vh;
  }

  .results-table-container {
    max-height: 30vh;
  }

  .measurement-controls {
    bottom: 0;
    left: 0;
    width: 100%;
    max-width: 100%;
    border-radius: 0;
  }

  .control-group {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .threshold-slider {
    width: 150px;
  }
}

@media (max-width: 768px) {
  .measurement-header {
    padding: 0.75rem;
    height: auto;
  }

  .header-controls {
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .control-input {
    width: 60px;
  }

  .measurement-options {
    margin-right: 0;
  }

  .option-btn {
    width: 32px;
    height: 32px;
  }

  .option-btn i {
    font-size: 1rem;
  }

  .results-table th,
  .results-table td {
    padding: 0.5rem;
    font-size: 0.8rem;
  }

  .measurement-controls {
    bottom: 0;
    left: 0;
    width: 100%;
    max-width: 100%;
    border-radius: 0;
    padding: 1rem;
  }

  .control-group {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding: 0.5rem;
    gap: 0.75rem;
  }

  .threshold-slider {
    width: 150px;
  }

  .measurement-controls .option-btn {
    padding: 8px 16px;
    min-width: 100px;
    font-size: 0.9rem;
  }

  .measurement-controls .option-btn i {
    font-size: 1rem;
  }

  .send-api-btn {
    padding: 8px 16px;
    font-size: 0.9rem;
    min-width: 120px;
  }
  
  .send-api-btn i {
    font-size: 1rem;
  }
}
</style>
