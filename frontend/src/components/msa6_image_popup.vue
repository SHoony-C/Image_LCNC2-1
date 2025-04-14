<template>
  <Teleport to="body">
    <div class="image-measurement-popup" v-if="showPopup" @click="closePopup">
      <div class="measurement-container" @click.stop>
        <div class="measurement-header">
          <h3>이미지 측정 도구</h3>
          <div class="header-controls">
            <div class="measurement-options">
              <button class="option-btn" :class="{ active: isSettingReference }" 
                @click="isSettingReference = !isSettingReference" title="Set Reference Scale">
                <i class="fas fa-ruler"></i>
              </button>
              <button class="option-btn" :class="{ active: measurementMode === 'line' && !isSettingReference }" 
                @click="measurementMode = 'line'; isSettingReference = false" title="선 길이 측정">
                <i class="fas fa-ruler-horizontal"></i>
              </button>
              <button class="option-btn" :class="{ active: measurementMode === 'area' && !isSettingReference }" 
                @click="measurementMode = 'area'; isSettingReference = false" title="면적 측정">
                <i class="fas fa-draw-polygon"></i>
              </button>
              <button class="option-btn" :class="{ active: measurementMode === 'angle' && !isSettingReference }" 
                @click="measurementMode = 'angle'; isSettingReference = false" title="각도 측정">
                <i class="fas fa-ruler-combined"></i>
              </button>
            </div>
            <button class="close-btn" @click="closePopup">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>
        
        <div class="measurement-content">
          <div class="image-container" ref="imageContainer">
            <img :src="imageUrl" alt="Measurement Image" ref="measurementImage" 
              @mousedown.prevent="startMeasurement" 
              @mousemove.prevent="updateMeasurement" 
              @mouseup.prevent="endMeasurement"
              @mouseleave.prevent="endMeasurement"
              draggable="false"
              @load="initSVG">
            <svg class="measurement-overlay" ref="overlay"></svg>
          </div>
          
          <div class="measurement-controls">
            <div class="scale-reference" v-if="isSettingReference">
              <h4>Set Reference Scale</h4>
              <p>Draw a line on a known distance</p>
              <div class="scale-input-group">
                <input 
                  type="number" 
                  v-model.number="referenceLength"
                  placeholder="Known length"
                >
                <select v-model="selectedUnit">
                  <option value="pixel">pixels</option>
                  <option value="mm">mm</option>
                  <option value="cm">cm</option>
                  <option value="m">m</option>
                </select>
              </div>
            </div>
            
            <div class="id-range-panel">
              <h4>ID 범위 설정</h4>
              <div class="input-grid">
                <div class="input-group">
                  <label>시작 ID:</label>
                  <input type="number" v-model.number="idRangeStart" min="1" step="1">
                </div>
                <div class="input-group">
                  <label>끝 ID:</label>
                  <input type="number" v-model.number="idRangeEnd" min="1" step="1">
                </div>
                <div class="input-group">
                  <label>SubItem 접두사:</label>
                  <input type="text" v-model="subItemPrefix" maxlength="3">
                </div>
                <div class="button-group">
                  <button class="apply-btn" @click="applyIdRange" :disabled="!isValidIdRange">
                    <i class="fas fa-check"></i> ID 적용
                  </button>
                </div>
              </div>
            </div>
            
            <div class="threshold-panel" v-if="selectedMeasurement">
              <h4>선택된 측정 ({{ selectedMeasurement.itemId }}-{{ selectedMeasurement.subItemId }})</h4>
              <div class="input-group">
                <label>선택 측정 밝기 임계값:</label>
                <input 
                  type="range" 
                  v-model.number="selectedBrightnessThreshold" 
                  min="0" 
                  max="255" 
                  @input="updateSelectedThreshold(selectedBrightnessThreshold)"
                >
                <span>{{ selectedBrightnessThreshold }}</span>
              </div>
            </div>
            
            <div class="threshold-input">
              <div class="threshold-header">
                <label>전체 밝기 임계값:</label>
                <button 
                  class="toggle-btn" 
                  :class="{ 'toggled': invertThreshold }"
                  @click="toggleInvertThreshold"
                  title="밝기/어두움 모드 전환"
                >
                  <i class="fas" :class="invertThreshold ? 'fa-moon' : 'fa-sun'"></i>
                  {{ invertThreshold ? '어두운 영역 인식' : '밝은 영역 인식' }}
                </button>
              </div>
              <input type="range" v-model.number="brightnessThreshold" min="0" max="255">
              <span>{{ brightnessThreshold }}</span>
            </div>
            
            <div class="scale-input">
              <label>스케일 설정:</label>
              <div class="scale-input-group">
                <input type="number" v-model="scaleValue" min="0.1" step="0.1">
                <span>픽셀 =</span>
                <input type="number" v-model="scaleUnit" min="0.1" step="0.1">
                <span>{{ selectedUnit }}</span>
              </div>
            </div>
            
            <div class="measurement-results" v-if="measurements.length > 0">
              <div class="results-header">
                <h4>측정 결과</h4>
                <div class="segment-count">
                  <span>세그먼트 수: {{ segmentCount }}</span>
                </div>
              </div>
              
              <div class="results-table-container">
                <table class="results-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Sub ID</th>
                      <th>값</th>
                      <th>작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(m, idx) in measurements" :key="idx" 
                      :class="{
                        'highlighted': m === selectedMeasurement,
                        'bright': m.brightness > brightnessThreshold,
                        'dark': m.brightness <= brightnessThreshold
                      }"
                      @click="selectMeasurement(m)"
                    >
                      <td>{{ m.itemId }}</td>
                      <td>{{ m.subItemId }}</td>
                      <td>{{ formatValue(m.value) }}</td>
                      <td>
                        <button class="icon-btn delete-btn" @click.stop="deleteMeasurement(idx)" title="삭제">
                          <i class="fas fa-trash"></i>
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <div class="segment-info" v-if="segmentCount > 0">
                <div class="segment-header">
                  <h5>세그먼트 목록</h5>
                </div>
                <div class="segment-count-by-type">
                  <div class="bright-count">빨간 세그먼트: {{ matchingSegments.length }}</div>
                  <div class="dark-count">파란 세그먼트: {{ nonMatchingSegments.length }}</div>
                </div>
              </div>
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
      isDrawing: false,
      isMeasuring: false,
      isEditing: false,
      measurementMode: 'line',
      selectedUnit: 'pixel',
      scaleValue: 1,
      scaleUnit: 1,
      referenceLength: 100,
      referenceScale: null,
      isSettingReference: false,
      measurements: [],
      currentMeasurement: null,
      selectedMeasurement: null,
      selectedMeasurementIndex: -1,
      selectedPointIndex: undefined,
      startPoint: null,
      svg: null,
      itemId: '',
      subItemId: '',
      tempItemId: '',
      tempSubItemId: '',
      threshold: 128,
      brightnessThreshold: 128,
      svgInitialized: false,
      
      nextId: 1,
      idRangeStart: 1,
      idRangeEnd: 10,
      subItemPrefix: 'S',
      selectedBrightnessThreshold: 128,
      showBrightSegments: true,
      segmentedMeasurements: [],
      invertThreshold: false
    }
  },
  computed: {
    brightMeasurements() {
      return this.measurements.filter(m => this.isBrightAccordingToThreshold(m.brightness));
    },
    darkMeasurements() {
      return this.measurements.filter(m => !this.isBrightAccordingToThreshold(m.brightness));
    },
    segmentCount() {
      return this.segmentedMeasurements.length;
    },
    isValidIdRange() {
      return this.idRangeStart > 0 && this.idRangeEnd >= this.idRangeStart;
    },
    matchingSegments() {
      return this.segmentedMeasurements.filter(segment => 
        this.isBrightAccordingToThreshold(segment.brightness)
      );
    },
    nonMatchingSegments() {
      return this.segmentedMeasurements.filter(segment => 
        !this.isBrightAccordingToThreshold(segment.brightness)
      );
    }
  },
  mounted() {
    this.initSVG()
    document.addEventListener('keydown', this.handleEscKey)
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.handleEscKey)
  },
  methods: {
    
    calculateBrightnessAtPointImproved(x, y) {
  try {
    const img = this.$refs.measurementImage;
    if (!img) return 128;

    // 1. 캔버스 생성 및 이미지 그리기
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // 2. 좌표 변환: DOM상의 좌표(x, y)를 실제 이미지의 픽셀 좌표로 변환
    // img.width/height는 DOM 상의 크기와 달라도, naturalWidth/Height를 이용해 원본 크기로 맞춥니다.
    const scaleX = canvas.width / img.width;
    const scaleY = canvas.height / img.height;
    let scaledX = Math.round(x * scaleX);
    let scaledY = Math.round(y * scaleY);

    // 3. 안티앨리어싱 및 경계 효과 제거: 내부 영역에서 샘플링하도록 마진 적용 (예: 2픽셀)
    const margin = 2;
    scaledX = Math.min(Math.max(scaledX, margin), canvas.width - margin - 1);
    scaledY = Math.min(Math.max(scaledY, margin), canvas.height - margin - 1);

    // 4. 스무딩: 3x3 커널 내의 픽셀들을 평균내어 단일 픽셀 노이즈와 경계 효과 완화
    let totalR = 0, totalG = 0, totalB = 0, count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const px = scaledX + dx;
        const py = scaledY + dy;
        const pixel = ctx.getImageData(px, py, 1, 1).data;
        totalR += pixel[0];
        totalG += pixel[1];
        totalB += pixel[2];
        count++;
      }
    }
    const avgR = totalR / count;
    const avgG = totalG / count;
    const avgB = totalB / count;
    const brightness = (avgR + avgG + avgB) / 3;

    return brightness;
  } catch (e) {
    console.error("calculateBrightnessAtPointImproved 에러:", e);
    return 128;
  }
}


,
    isBrightAccordingToThreshold(brightness) {
      return this.invertThreshold 
        ? brightness <= this.brightnessThreshold 
        : brightness > this.brightnessThreshold;
    },
    toggleInvertThreshold() {
      this.invertThreshold = !this.invertThreshold;
      this.segmentMeasurements();
      this.updateOverlay();
    },
    handleEscKey(event) {
      if (event.key === 'Escape') {
        this.closePopup()
      }
    },
    initSVG() {
      console.log('Initializing SVG')
      this.$nextTick(() => {
        const container = this.$refs.imageContainer
        const img = this.$refs.measurementImage
        
        if (!container || !img) {
          console.error('Container or image not found')
          return
        }
        
        if (img.complete) {
          console.log('Image already loaded')
          this.setupSVG(container)
        } else {
          console.log('Waiting for image to load')
          img.onload = () => {
            console.log('Image loaded')
            this.setupSVG(container)
          }
        }
      })
    },
    setupSVG(container) {
      console.log('Setting up SVG')
      this.svg = this.$refs.overlay
      if (!this.svg) {
        console.error('SVG element not found')
        return
      }
      
      this.svg.setAttribute('width', container.offsetWidth)
      this.svg.setAttribute('height', container.offsetHeight)
      
      this.svg.style.position = 'absolute'
      this.svg.style.top = '0'
      this.svg.style.left = '0'
      this.svg.style.pointerEvents = 'none'
      this.svg.style.zIndex = '2'
      
      this.svgInitialized = true
      console.log('SVG initialized', {
        width: container.offsetWidth,
        height: container.offsetHeight
      })
      
      this.updateOverlay()
    },
    startMeasurement(event) {
      console.log('=== startMeasurement 호출 ===')
      
      if (!this.svg || !this.svgInitialized) {
        console.error('SVG not initialized')
        this.initSVG()
        return
      }
      
      event.preventDefault()
      event.stopPropagation()
      
      const container = this.$refs.imageContainer
      if (!container) {
        console.error('Container not found')
        return
      }
      
      const rect = container.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      
      console.log('마우스 위치:', { x, y })
      
      if (event.shiftKey && !this.isSettingReference) {
        const measurement = this.findMeasurementAtPoint(x, y)
        if (measurement) {
          this.selectedMeasurement = measurement
          this.isEditing = true
          console.log('측정선 편집 선택', measurement)
          return
        }
      }
      
      this.isDrawing = true
      this.isMeasuring = true
      
      if (this.isSettingReference) {
        this.currentMeasurement = {
          type: 'reference',
          points: [{ x, y }],
          value: 0
        }
      } else {
        // 시작 지점 밝기 계산
        const brightness = this.calculateBrightness(x, y)
        console.log('시작 지점 밝기:', brightness)
        
        this.currentMeasurement = {
          type: this.measurementMode,
          points: [{ x, y }],
          value: 0,
          itemId: this.nextId.toString(),
          subItemId: `${this.subItemPrefix}1`,
          brightness: brightness,
          // 실선으로 표시하지 않도록 기본값 설정
          drawAsSolid: false
        }
      }
      
      this.startPoint = { x, y }
      this.currentMeasurement.points.push({ x, y })
      
      console.log('측정 시작', {
        isMeasuring: this.isMeasuring,
        isDrawing: this.isDrawing,
        startPoint: this.startPoint,
        currentMeasurement: this.currentMeasurement
      })
      
      this.updateOverlay()
    },
    applyMeasurementInfo() {
      if (this.selectedMeasurementIndex >= 0 && this.selectedMeasurementIndex < this.measurements.length) {
        const measurement = this.measurements[this.selectedMeasurementIndex];
        measurement.itemId = this.tempItemId || 'Item';
        measurement.subItemId = this.tempSubItemId || 'Sub';
        
        this.$forceUpdate();
        this.updateOverlay();
      }
    },
    selectMeasurementForEdit(index) {
      this.selectedMeasurementIndex = index;
      if (index >= 0 && index < this.measurements.length) {
        const measurement = this.measurements[index];
        this.tempItemId = measurement.itemId || '';
        this.tempSubItemId = measurement.subItemId || '';
      }
    },
    findMeasurementAtPoint(x, y) {
      const threshold = 10
      return this.measurements.find(measurement => {
        const points = measurement.points
        return points.some(point => {
          const dx = point.x - x
          const dy = point.y - y
          return Math.sqrt(dx * dx + dy * dy) <= threshold
        })
      })
    },
    calculateBrightness(x, y) {
      try {
        const img = this.$refs.measurementImage
        if (!img) return 128
        
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        canvas.width = img.naturalWidth || img.width
        canvas.height = img.naturalHeight || img.height
        
        const scaleX = canvas.width / img.width
        const scaledX = Math.round(x * scaleX)
        const scaleY = canvas.height / img.height
        const scaledY = Math.round(y * scaleY)
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        
        try {
          const pixel = ctx.getImageData(scaledX, scaledY, 1, 1).data
          return (pixel[0] + pixel[1] + pixel[2]) / 3
        } catch (e) {
          console.error('Failed to get image data', e)
          return 128
        }
      } catch (e) {
        console.error('Failed to calculate brightness', e)
        return 128
      }
    },
    updateMeasurement(event) {
      console.log('updateMeasurement called', {
        isMeasuring: this.isMeasuring, 
        isEditing: this.isEditing,
        currentMeasurement: this.currentMeasurement ? 'exists' : 'null'
      })
      
      if (!this.isMeasuring && !this.isEditing) return
      
      event.preventDefault()
      event.stopPropagation()
      
      const container = this.$refs.imageContainer
      if (!container) {
        console.error('Container not found')
        return
      }
      
      const rect = container.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      
      if (this.isEditing && this.selectedMeasurement) {
        if (this.selectedPointIndex !== undefined) {
          this.selectedMeasurement.points[this.selectedPointIndex] = { x, y }
        } else {
          const points = this.selectedMeasurement.points
          let closestPoint = null
          let minDistance = Infinity
          
          points.forEach((point, index) => {
            const dx = point.x - x
            const dy = point.y - y
            const distance = Math.sqrt(dx * dx + dy * dy)
            if (distance < minDistance) {
              minDistance = distance
              closestPoint = { point, index }
            }
          })
          
          if (closestPoint && minDistance <= 10) {
            points[closestPoint.index] = { x, y }
          }
        }
        this.calculateMeasurement(this.selectedMeasurement)
      } else if (this.isMeasuring && this.currentMeasurement) {
        if (this.currentMeasurement.points.length > 1) {
          this.currentMeasurement.points[this.currentMeasurement.points.length - 1] = { x, y }
          
          if (this.currentMeasurement.points.length >= 2) {
            this.calculateMeasurement(this.currentMeasurement)
          }
        }
        this.startPoint = { x, y }
        
        if (this.$refs.measurementImage) {
          this.currentMeasurement.brightness = this.calculateBrightness(x, y)
        }
      }
      
      this.updateOverlay()
    },
    endMeasurement(event) {
      console.log('endMeasurement called', {
        isMeasuring: this.isMeasuring,
        isEditing: this.isEditing
      })
      
      event.preventDefault()
      event.stopPropagation()
      
      if (this.isEditing) {
        this.isEditing = false
        this.selectedMeasurement = null
        this.selectedPointIndex = undefined
        this.segmentMeasurements();
        this.updateOverlay()
        return
      }
      
      if (!this.isMeasuring || !this.currentMeasurement) {
        return
      }
      
      this.isMeasuring = false
      this.isDrawing = false
      
      if (this.currentMeasurement.points.length >= 2) {
        this.calculateMeasurement(this.currentMeasurement)
        
        if (this.isSettingReference) {
          this.referenceScale = this.currentMeasurement.value
          this.scaleUnit = this.referenceLength / this.referenceScale
          this.isSettingReference = false
          console.log('Reference scale set', {
            referenceScale: this.referenceScale,
            scaleUnit: this.scaleUnit
          })
        } else {
          console.log('Adding measurement', this.currentMeasurement)
          const measurementCopy = JSON.parse(JSON.stringify(this.currentMeasurement))
          this.measurements.push(measurementCopy)
          
          this.nextId++;
          
          // 새 측정이 추가되면 세그먼트 생성
          this.$nextTick(() => {
            this.segmentMeasurements();
          });
        }
      }
      
      this.currentMeasurement = null
      this.startPoint = null
      this.updateOverlay()
    },
    calculateMeasurement(measurement) {
      const points = measurement.points
      const start = points[0]
      const end = points[points.length - 1]
      
      switch (measurement.type) {
        case 'line':
          measurement.value = this.calculateDistance(start, end)
          break
        case 'area':
          measurement.value = this.calculateArea(points)
          break
        case 'angle':
          measurement.value = this.calculateAngle(points)
          break
      }
    },
    calculateDistance(start, end) {
      const dx = end.x - start.x
      const dy = end.y - start.y
      return Math.sqrt(dx * dx + dy * dy)
    },
    calculateArea(points) {
      let area = 0
      for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length
        area += points[i].x * points[j].y
        area -= points[j].x * points[i].y
      }
      return Math.abs(area / 2)
    },
    calculateAngle(points) {
      if (points.length < 3) return 0
      
      const p1 = points[0]
      const p2 = points[1]
      const p3 = points[2]
      
      const v1 = { x: p2.x - p1.x, y: p2.y - p1.y }
      const v2 = { x: p3.x - p2.x, y: p3.y - p2.y }
      
      const dot = v1.x * v2.x + v1.y * v2.y
      const det = v1.x * v2.y - v1.y * v2.x
      return Math.atan2(det, dot) * (180 / Math.PI)
    },
    updateOverlay() {
      console.log('=== updateOverlay 호출 ===');
      console.log('SVG 초기화 상태:', this.svgInitialized);
      console.log('측정선 개수:', this.measurements.length);
      console.log('세그먼트 개수:', this.segmentedMeasurements.length);
      
      if (!this.svg || !this.svgInitialized) return;
      
      while (this.svg.firstChild) {
        this.svg.removeChild(this.svg.firstChild);
      }
      
      // 1. 전체 측정선을 먼저 파란색 점선으로 그림
      this.measurements.forEach((measurement, midx) => {
        console.log(`측정선 ${midx + 1} 그리기 - ID: ${measurement.itemId}-${measurement.subItemId}`);
        
        const points = measurement.points;
        if (!points || points.length < 2) return;
        
        // 전체 경로를 파란색 점선으로 그림
        const fullPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        let d = `M ${points[0].x} ${points[0].y}`;
        
        for (let i = 1; i < points.length; i++) {
          d += ` L ${points[i].x} ${points[i].y}`;
        }
        
        fullPath.setAttribute('d', d);
        fullPath.setAttribute('stroke', measurement === this.selectedMeasurement ? '#8b5cf6' : '#3b82f6');
        fullPath.setAttribute('stroke-width', '2');
        fullPath.setAttribute('fill', 'none');
        fullPath.setAttribute('stroke-dasharray', '5,5');
        
        this.svg.appendChild(fullPath);
        
        // 2. 밝기 임계값을 초과하는 세그먼트만 빨간색 실선으로 그림
        const matchingSegments = this.segmentedMeasurements.filter(
          segment => segment.originalMeasurement === measurement && segment.isMatching
        );
        
        console.log(`측정선 ${midx + 1}의 매칭 세그먼트: ${matchingSegments.length}개`);
        
        // 빨간색 실선으로 임계값을 초과하는 부분 그리기
        matchingSegments.forEach((segment, sidx) => {
          if (segment.points.length < 2) return;
          
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          let d = `M ${segment.points[0].x} ${segment.points[0].y}`;
          
          for (let i = 1; i < segment.points.length; i++) {
            d += ` L ${segment.points[i].x} ${segment.points[i].y}`;
          }
          
          path.setAttribute('d', d);
          
          const isSelected = measurement === this.selectedMeasurement;
          
          path.setAttribute('stroke', isSelected ? '#8b5cf6' : '#ff0000');
          path.setAttribute('stroke-width', '3');
          path.setAttribute('fill', 'none');
          path.setAttribute('stroke-dasharray', ''); // 실선
          
          this.svg.appendChild(path);
          
          console.log(`세그먼트 ${sidx + 1} 그림 - 길이: ${segment.value.toFixed(2)}px, 밝기: ${segment.brightness.toFixed(0)}`);
        });
        
        // 3. 끝점에 원 표시
        points.forEach((point, pointIndex) => {
          const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          circle.setAttribute('cx', point.x);
          circle.setAttribute('cy', point.y);
          circle.setAttribute('r', '4');
          circle.setAttribute('fill', pointIndex === 0 ? '#00ff00' : '#ff0000');
          circle.setAttribute('cursor', 'move');
          circle.setAttribute('pointer-events', 'all');
          this.svg.appendChild(circle);
        });
      });
      
      // 4. 현재 그리고 있는 측정선 표시
      if (this.isMeasuring && this.currentMeasurement && this.currentMeasurement.points.length >= 1) {
        console.log('현재 측정선 그리기');
        const points = this.currentMeasurement.points;
        
        // 파란색 점선으로 그림
        const dottedPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        let d = `M ${points[0].x} ${points[0].y}`;
        
        for (let i = 1; i < points.length; i++) {
          d += ` L ${points[i].x} ${points[i].y}`;
        }
        
        dottedPath.setAttribute('d', d);
        dottedPath.setAttribute('stroke', '#3b82f6');
        dottedPath.setAttribute('stroke-width', '2');
        dottedPath.setAttribute('fill', 'none');
        dottedPath.setAttribute('stroke-dasharray', '5,5');
        
        this.svg.appendChild(dottedPath);
        
        // 현재 포인트 표시
        points.forEach((point, i) => {
          const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          circle.setAttribute('cx', point.x);
          circle.setAttribute('cy', point.y);
          circle.setAttribute('r', '4');
          circle.setAttribute('fill', i === 0 ? '#00ff00' : '#ff0000');
          circle.setAttribute('cursor', 'move');
          this.svg.appendChild(circle);
        });
      }
      
      console.log('오버레이 업데이트 완료');
    },
    clearCurrentMeasurement() {
      this.currentMeasurement = null
      this.startPoint = null
      this.svg.innerHTML = ''
    },
    deleteMeasurement(index) {
      this.measurements.splice(index, 1)
    },
    formatValue(value) {
      let scaledValue = value;
      if (this.selectedUnit !== 'pixel' && this.referenceScale) {
        scaledValue = (value * this.scaleUnit);
      }
      return `${scaledValue.toFixed(2)} ${this.selectedUnit}`;
    },
    formatMeasurement(measurement) {
      let value = measurement.value
      
      if (measurement.type !== 'reference' && this.selectedUnit !== 'pixel' && this.referenceScale) {
        value = (value * this.scaleUnit)
      }
      
      return `${measurement.itemId}|${measurement.subItemId}|${value.toFixed(2)}`
    },
    closePopup() {
      this.$emit('close')
    },
    segmentMeasurements() {
      this.segmentedMeasurements = [];
      
      this.measurements.forEach(measurement => {
        if (measurement.type !== 'line' || !measurement.points || measurement.points.length < 2) {
          return;
        }
        
        const segments = this.createBrightnessSegments(measurement);
        this.segmentedMeasurements.push(...segments);
      });
      
      console.log('Segmented measurements:', this.segmentedMeasurements.length);
    },
    createBrightnessSegments(measurement) {
  const segments = [];
  const points = measurement.points;
  if (points.length < 2) return segments;

  // 임계값(선택 측정이 있으면 그쪽 우선)
  const threshold =
    this.selectedMeasurement === measurement &&
    this.selectedBrightnessThreshold !== this.brightnessThreshold
      ? this.selectedBrightnessThreshold
      : this.brightnessThreshold;

  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // 샘플링 개수(최소 200, 거리만큼)
    const numSamples = Math.max(200, Math.ceil(distance));

    // brightnessPoints 구하기
    const brightnessPoints = [];
    for (let j = 0; j <= numSamples; j++) {
      const ratio = j / numSamples;
      const sampleX = p1.x + dx * ratio;
      const sampleY = p1.y + dy * ratio;
      const brightness = this.calculateBrightnessAtPointImproved(sampleX, sampleY);
      const isMatching = this.invertThreshold
        ? brightness <= threshold
        : brightness > threshold;

      brightnessPoints.push({ x: sampleX, y: sampleY, brightness, isMatching });
    }

    // (선택) 이동평균 or 미디언 필터로 brightnessPoints 스무딩
    // ...

    // 연속 구간으로 세그먼트화 + 임계값 경계에서 보간
    let currentSegment = null;
    for (let k = 0; k < brightnessPoints.length - 1; k++) {
      const cur = brightnessPoints[k];
      const nxt = brightnessPoints[k + 1];

      // 만약 현재가 임계값 만족 중이라면(빨간 선이어야 함)
      if (cur.isMatching) {
        if (!currentSegment) {
          // 새 세그먼트 시작
          currentSegment = {
            points: [{ x: cur.x, y: cur.y }],
            brightness: cur.brightness,
            originalMeasurement: measurement,
            type: 'segment',
            itemId: measurement.itemId,
            subItemId: measurement.subItemId,
            isMatching: true
          };
        } else {
          // 기존 세그먼트에 포인트 추가
          currentSegment.points.push({ x: cur.x, y: cur.y });
        }
      } else {
        // 임계값 불만족(파란 선)
        // 만약 열려있는 세그먼트가 있으면 여기서 종료
        if (currentSegment) {
          // (선택) cur와 nxt 사이에서 경계가 있다면 보간
          if (nxt.isMatching !== cur.isMatching) {
            // 여기서 threshold 교차 지점을 찾는다 (linear interpolation)
            const ratio = (threshold - cur.brightness) / (nxt.brightness - cur.brightness);
            const xInterp = cur.x + ratio * (nxt.x - cur.x);
            const yInterp = cur.y + ratio * (nxt.y - cur.y);
            currentSegment.points.push({ x: xInterp, y: yInterp });
          }

          // 세그먼트 마무리
          currentSegment.value = this.calculateDistanceForPoints(currentSegment.points);
          segments.push(currentSegment);
          currentSegment = null;
        }
      }
    }

    // 마지막 포인트 체크
    const lastPoint = brightnessPoints[brightnessPoints.length - 1];
    if (currentSegment && lastPoint.isMatching) {
      currentSegment.points.push({ x: lastPoint.x, y: lastPoint.y });
      currentSegment.value = this.calculateDistanceForPoints(currentSegment.points);
      segments.push(currentSegment);
      currentSegment = null;
    }
  }

  return segments;
  },
  rgbToHsv(r, g, b) {
      r /= 255;
      g /= 255;
      b /= 255;
  
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;
  
      let h = 0, s = 0, v = max;
  
      if (delta !== 0) {
        s = delta / max;
        if (r === max) {
          h = ((g - b) / delta) % 6;
        } else if (g === max) {
          h = (b - r) / delta + 2;
        } else {
          h = (r - g) / delta + 4;
        }
        h *= 60;
        if (h < 0) h += 360;
      }
  
      return { h, s, v };
    },

    // 예시: calculateColorAtPoint에서 사용
    calculateColorAtPoint(x, y) {
      try {
        const img = this.$refs.measurementImage;
        if (!img) return { r: 128, g: 128, b: 128, brightness: 128, h: 0, s: 0, v: 0.5 };

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;

        const scaleX = canvas.width / img.width;
        const scaleY = canvas.height / img.height;
        const scaledX = Math.min(Math.max(Math.round(x * scaleX), 0), canvas.width - 1);
        const scaledY = Math.min(Math.max(Math.round(y * scaleY), 0), canvas.height - 1);

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const kernelSize = 5;
        const halfSize = Math.floor(kernelSize / 2);
        let totalR = 0, totalG = 0, totalB = 0;
        let count = 0;

        for (let offsetY = -halfSize; offsetY <= halfSize; offsetY++) {
          for (let offsetX = -halfSize; offsetX <= halfSize; offsetX++) {
            const checkX = Math.min(Math.max(scaledX + offsetX, 0), canvas.width - 1);
            const checkY = Math.min(Math.max(scaledY + offsetY, 0), canvas.height - 1);
            const pixel = ctx.getImageData(checkX, checkY, 1, 1).data;
            totalR += pixel[0];
            totalG += pixel[1];
            totalB += pixel[2];
            count++;
          }
        }

        const avgR = totalR / count;
        const avgG = totalG / count;
        const avgB = totalB / count;
        const brightness = (avgR + avgG + avgB) / 3;

        // rgbToHsv 함수 호출 (같은 컴포넌트 내에 정의되어 있으므로 this를 붙여서 호출)
        const { h, s, v } = this.rgbToHsv(avgR, avgG, avgB);

        return { r: avgR, g: avgG, b: avgB, brightness, h, s, v };
      } catch (e) {
        console.error('Error in calculateColorAtPoint:', e);
        return { r: 128, g: 128, b: 128, brightness: 128, h: 0, s: 0, v: 0.5 };
      }
    },


    calculateDistanceForPoints(points) {
      if (points.length < 2) return 0;
      
      let totalDistance = 0;
      for (let i = 1; i < points.length; i++) {
        const p1 = points[i-1];
        const p2 = points[i];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        totalDistance += Math.sqrt(dx*dx + dy*dy);
      }
      
      return totalDistance;
    },
    applyIdRange() {
      if (!this.isValidIdRange) return;
      
      let currentId = this.idRangeStart;
      let subIdx = 1;
      
      this.measurements.forEach(measurement => {
        if (currentId <= this.idRangeEnd) {
          measurement.itemId = currentId.toString();
          measurement.subItemId = `${this.subItemPrefix}${subIdx}`;
          subIdx++;
          
          if (subIdx > 99) {
            subIdx = 1;
            currentId++;
          }
        }
      });
      
      this.nextId = this.idRangeEnd + 1;
      this.segmentMeasurements();
      this.$forceUpdate();
    },
    updateSelectedThreshold(newThreshold) {
      if (this.selectedMeasurement) {
        this.selectedBrightnessThreshold = newThreshold;
        this.segmentMeasurements();
        this.updateOverlay();
      }
    },
    selectMeasurement(measurement) {
      this.selectedMeasurement = measurement;
      this.selectedBrightnessThreshold = this.brightnessThreshold;
      this.updateOverlay();
    }
  },
  watch: {
    showPopup(newVal) {
      if (newVal) {
        console.log('Popup shown, initializing SVG')
        this.$nextTick(() => {
          this.initSVG()
        })
      }
    },
    measurements: {
      handler(newVal) {
        console.log('Measurements updated', newVal.length)
        this.updateOverlay()
        this.segmentMeasurements()
      },
      deep: true
    },
    brightnessThreshold() {
      this.updateOverlay()
      this.segmentMeasurements()
    },
    invertThreshold() {
      this.updateOverlay()
      this.segmentMeasurements()
    }
  }
}
</script>

<style scoped>
.image-measurement-popup {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99999;
  backdrop-filter: blur(5px);
}

.measurement-container {
  background: white;
  border-radius: 12px;
  width: 90vw;
  max-width: 1400px;
  height: 95vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 35px rgba(0, 0, 0, 0.3);
}

.measurement-header {
  padding: 1.25rem 1.5rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.measurement-header h3 {
  margin: 0;
  color: #1e293b;
  font-size: 1.25rem;
  font-weight: 600;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.measurement-options {
  display: flex;
  gap: 0.5rem;
}

.option-btn {
  background: none;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #64748b;
  transition: all 0.2s ease;
}

.option-btn:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.option-btn.active {
  background: #8b5cf6;
  color: white;
  border-color: #8b5cf6;
}

.close-btn {
  background: none;
  border: none;
  color: #64748b;
  font-size: 1.2rem;
  cursor: pointer;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: #e2e8f0;
  color: #1e293b;
}

.measurement-content {
  display: flex;
  flex: 1;
  overflow: hidden;
  height: calc(95vh - 60px);
}

.image-container {
  position: relative;
  flex: 1;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
  overflow: hidden;
}

.image-container img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  pointer-events: auto;
  position: relative;
  z-index: 1;
}

.measurement-overlay {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 2;
}

.measurement-controls {
  width: 350px;
  padding: 1.25rem;
  background: white;
  border-left: 1px solid #e2e8f0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.measurement-input-panel {
  background: #f8fafc;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  border: 1px solid #e2e8f0;
}

.measurement-input-panel h4 {
  margin: 0 0 1rem;
  color: #1e293b;
  font-size: 1rem;
  font-weight: 600;
}

.input-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-gap: 0.75rem;
}

.input-grid .input-group {
  grid-column: span 2;
}

.button-group {
  grid-column: span 2;
  display: flex;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.apply-btn {
  background: #8b5cf6;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s ease;
}

.apply-btn:hover {
  background: #7c3aed;
}

.apply-btn:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
}

.results-table-container {
  overflow-x: auto;
  margin-bottom: 1rem;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.results-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.results-table th,
.results-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}

.results-table th {
  background: #f1f5f9;
  font-weight: 600;
  color: #1e293b;
  position: sticky;
  top: 0;
}

.results-table tr:last-child td {
  border-bottom: none;
}

.results-table tr.highlighted {
  background-color: #ede9fe;
}

.results-table tr.bright {
  border-left: 3px solid #ef4444;
}

.results-table tr.dark {
  border-left: 3px solid #3b82f6;
}

.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  padding: 0.25rem;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.delete-btn {
  color: #ef4444;
}

.delete-btn:hover {
  background: #fee2e2;
}

.edit-btn {
  color: #3b82f6;
}

.edit-btn:hover {
  background: #dbeafe;
}

.results-summary {
  display: flex;
  justify-content: space-between;
  background: #f8fafc;
  padding: 0.75rem;
  border-radius: 8px;
  margin-top: 1rem;
  border: 1px solid #e2e8f0;
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.summary-label {
  font-size: 0.75rem;
  color: #64748b;
  margin-bottom: 0.25rem;
}

.summary-value {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1e293b;
}

.unit-selector, .scale-input {
  margin-bottom: 1.5rem;
}

.unit-selector label, .scale-input label {
  display: block;
  margin-bottom: 0.5rem;
  color: #1e293b;
  font-weight: 500;
}

.unit-selector select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  background: white;
}

.scale-input-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.scale-input-group input {
  width: 80px;
  padding: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
}

.measurement-results {
  margin-top: 2rem;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.measurement-results h4 {
  margin: 0 0 1rem;
  color: #1e293b;
  font-size: 1rem;
  font-weight: 600;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.segment-count {
  font-size: 0.875rem;
  color: #64748b;
}

.segment-info {
  margin-top: 1rem;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.segment-header {
  margin-bottom: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
}

.segment-count-by-type {
  display: flex;
  justify-content: space-between;
}

.bright-count, .dark-count {
  font-size: 0.875rem;
  color: #64748b;
}

/* 신규 ID 범위 설정 패널 스타일 */
.id-range-panel {
  background: #f8fafc;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  border: 1px solid #e2e8f0;
}

.id-range-panel h4 {
  margin: 0 0 1rem;
  color: #1e293b;
  font-size: 1rem;
  font-weight: 600;
}

/* 선택된 측정을 위한 임계값 조정 패널 */
.threshold-panel {
  background: #ede9fe;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  border: 1px solid #c4b5fd;
}

.threshold-panel h4 {
  margin: 0 0 1rem;
  color: #5b21b6;
  font-size: 1rem;
  font-weight: 600;
}

/* 기본 입력 그리드 스타일 */
.input-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-gap: 0.75rem;
}

.input-grid .input-group {
  grid-column: span 1;
}

.input-grid .input-group:last-child {
  grid-column: span 2;
}

.button-group {
  grid-column: span 2;
  display: flex;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.apply-btn {
  background: #8b5cf6;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 0.5rem 1rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s ease;
}

.apply-btn:hover {
  background: #7c3aed;
}

.apply-btn:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
}

/* 결과 테이블 스타일 업데이트 */
.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.segment-count {
  font-size: 0.875rem;
  padding: 0.25rem 0.5rem;
  background: #f1f5f9;
  border-radius: 4px;
  color: #334155;
  font-weight: 500;
}

.results-table-container {
  overflow-y: auto;
  max-height: 200px;
  margin-bottom: 1rem;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.results-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.results-table th,
.results-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}

.results-table th {
  background: #f1f5f9;
  font-weight: 600;
  color: #1e293b;
  position: sticky;
  top: 0;
  z-index: 1;
}

.results-table tr {
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.results-table tr:hover {
  background-color: #f8fafc;
}

.results-table tr:last-child td {
  border-bottom: none;
}

.results-table tr.highlighted {
  background-color: #ede9fe;
}

.results-table tr.bright {
  border-left: 3px solid #ef4444;
}

.results-table tr.dark {
  border-left: 3px solid #3b82f6;
}

/* 세그먼트 정보 스타일 */
.segment-info {
  background: #f8fafc;
  border-radius: 8px;
  padding: 0.75rem;
  margin-top: 1rem;
  border: 1px solid #e2e8f0;
}

.segment-header {
  margin-bottom: 0.5rem;
}

.segment-header h5 {
  margin: 0;
  color: #1e293b;
  font-size: 0.875rem;
  font-weight: 600;
}

.segment-count-by-type {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
}

.bright-count {
  color: #ef4444;
  font-weight: 500;
}

.dark-count {
  color: #3b82f6;
  font-weight: 500;
}

/* 기본 입력 컴포넌트 스타일 */
.input-group {
  margin-bottom: 0.75rem;
}

.input-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: #1e293b;
  font-weight: 500;
  font-size: 0.875rem;
}

.input-group input,
.input-group select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 0.875rem;
}

.input-group input[type="range"] {
  margin-bottom: 0.5rem;
}

.input-group span {
  display: block;
  text-align: center;
  color: #64748b;
  font-size: 0.875rem;
}

/* 아이콘 버튼 스타일 */
.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  padding: 0.25rem;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.delete-btn {
  color: #ef4444;
}

.delete-btn:hover {
  background: #fee2e2;
}

/* 기존 스타일 유지 */
.unit-selector, .scale-input, .threshold-input {
  margin-bottom: 1.5rem;
}

.scale-input-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.scale-input-group input {
  width: 80px;
  padding: 0.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
}

.measurement-results {
  margin-top: 2rem;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.measurement-results h4 {
  margin: 0;
  color: #1e293b;
  font-size: 1rem;
  font-weight: 600;
}

/* 기존 스타일 유지 (추가 부분) */
.measurement-input-panel {
  background: #f8fafc;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  border: 1px solid #e2e8f0;
}

.measurement-input-panel h4 {
  margin: 0 0 1rem;
  color: #1e293b;
  font-size: 1rem;
  font-weight: 600;
}

.threshold-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.threshold-header label {
  display: block;
  color: #1e293b;
  font-weight: 500;
  font-size: 0.875rem;
}

.toggle-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 0.75rem;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toggle-btn i {
  font-size: 0.875rem;
}

.toggle-btn.toggled {
  background: #1e293b;
  color: white;
  border-color: #1e293b;
}

.toggle-btn:hover {
  background: #e2e8f0;
}

.toggle-btn.toggled:hover {
  background: #334155;
}
</style> 