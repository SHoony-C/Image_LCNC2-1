<template>
  <div class="analysis-container">
    <div class="chart-container">
      <div class="chart-card">
        <div class="chart-header">
          <h3>분석 결과</h3>
          <div class="chart-actions">
            <button class="btn-chart-type" :class="{ active: chartType === 'measurement' }" @click="setChartType('measurement')">
              계측
            </button>
            <button class="btn-chart-type" :class="{ active: chartType === 'defect' }" @click="setChartType('defect')">
              불량 감지
            </button>
          </div>
        </div>
        <div class="chart-content" ref="chartContainer" style="height: 400px; position: relative;">
          <!-- 계측 차트 -->
          <svg v-if="chartType === 'measurement' && chartData && chartData.points && chartData.points.length > 0" 
              :width="width" :height="height" class="chart">
            <!-- Grid Lines -->
            <g class="grid-lines">
              <line v-for="y in yGridLines" :key="'y-' + y"
                :x1="margin.left" :x2="width - margin.right" :y1="y" :y2="y"
                stroke="#eee" stroke-dasharray="2,2" />
              <line v-for="x in xGridLines" :key="'x-' + x"
                :x1="x" :x2="x" :y1="margin.top" :y2="height - margin.bottom"
                stroke="#eee" stroke-dasharray="2,2" />
            </g>
            <!-- Data points -->
            <g class="data-points">
              <circle v-for="point in getVisiblePoints" :key="point.item_id + '-' + point.x + '-' + point.y"
                :cx="point.x" :cy="point.y" r="4"
                :fill="point.color"
                stroke="white"
                stroke-width="2"
                @mouseover="selectedPoint = point"
                @mouseout="selectedPoint = null" />
            </g>
            <!-- Tooltip -->
            <g v-if="selectedPoint" class="tooltip"
              :transform="'translate(' + (selectedPoint.x + 10) + ',' + (selectedPoint.y - 10) + ')'">
              <rect x="0" y="0" width="120" height="60" rx="4"
                fill="rgba(255,255,255,0.95)" />
              <text x="10" y="20" fill="#333" font-size="12">
                {{ selectedPoint.label }}
              </text>
              <text x="10" y="40" fill="#333" font-size="12">
                {{ selectedPoint.date }}
              </text>
              <text x="10" y="55" fill="#333" font-size="12">
                값: {{ selectedPoint.value.toFixed(3) }}
              </text>
            </g>
            <!-- Axes -->
            <g class="axes">
              <line :x1="margin.left" :x2="width - margin.right" 
                    :y1="height - margin.bottom" :y2="height - margin.bottom" 
                    stroke="#666" />
              <line :x1="margin.left" :y1="margin.top" 
                    :x2="margin.left" :y2="height - margin.bottom" 
                    stroke="#666" />
            </g>
            <!-- Labels -->
            <g class="labels">
              <text v-for="(label, i) in limitedLabels" :key="'label-' + i"
                :x="getLabelX(i)" :y="height - margin.bottom/2"
                fill="#666" text-anchor="middle"
                font-size="12">{{ label }}</text>
            </g>
          </svg>
          <!-- 불량 감지 차트 -->
          <svg v-if="chartType === 'defect' && defectChartData && defectChartData.points && defectChartData.points.length > 0" 
              :width="width" :height="height" class="chart">
            <!-- Grid Lines -->
            <g class="grid-lines">
              <line v-for="y in yGridLines" :key="'y-' + y"
                :x1="margin.left" :x2="width - margin.right" :y1="y" :y2="y"
                stroke="#eee" stroke-dasharray="2,2" />
              <line v-for="x in xGridLines" :key="'x-' + x"
                :x1="x" :x2="x" :y1="margin.top" :y2="height - margin.bottom"
                stroke="#eee" stroke-dasharray="2,2" />
            </g>
            <!-- Data points -->
            <g class="data-points">
              <circle v-for="point in getVisibleDefectPoints" :key="point.item_id + '-' + point.x + '-' + point.y"
                :cx="point.x" :cy="point.y" r="4"
                :fill="point.color"
                stroke="white"
                stroke-width="2"
                @mouseover="selectedPoint = point"
                @mouseout="selectedPoint = null" />
            </g>
            <!-- Tooltip -->
            <g v-if="selectedPoint" class="tooltip"
              :transform="'translate(' + (selectedPoint.x + 10) + ',' + (selectedPoint.y - 10) + ')'">
              <rect x="0" y="0" width="160" height="100" rx="4"
                fill="rgba(255,255,255,0.95)" />
              <text x="10" y="20" fill="#333" font-size="12">
                {{ selectedPoint.item_id }}
              </text>
              <text x="10" y="40" fill="#333" font-size="12">
                {{ selectedPoint.date }}
              </text>
              <text x="10" y="60" fill="#333" font-size="12">
                줄무늬: {{ selectedPoint.striation?.toFixed(3) || 'N/A' }}
              </text>
              <text x="10" y="80" fill="#333" font-size="12">
                왜곡: {{ selectedPoint.distortion?.toFixed(3) || 'N/A' }}
              </text>
            </g>
            <!-- Axes -->
            <g class="axes">
              <line :x1="margin.left" :x2="width - margin.right" 
                    :y1="height - margin.bottom" :y2="height - margin.bottom" 
                    stroke="#666" />
              <line :x1="margin.left" :y1="margin.top" 
                    :x2="margin.left" :y2="height - margin.bottom" 
                    stroke="#666" />
            </g>
            <!-- Labels -->
            <g class="labels">
              <text v-for="(label, i) in limitedLabels" :key="'label-' + i"
                :x="getLabelX(i)" :y="height - margin.bottom/2"
                fill="#666" text-anchor="middle"
                font-size="12">{{ label }}</text>
            </g>
          </svg>
          <div v-else class="loading-chart">
            <template v-if="chartType === 'measurement' && (!chartData || !chartData.points || chartData.points.length === 0)">
              계측 데이터 로딩 중...
            </template>
            <template v-else-if="chartType === 'defect' && (!defectChartData || !defectChartData.points || defectChartData.points.length === 0)">
              불량 감지 데이터 로딩 중...
            </template>
            <template v-else>
              표시할 데이터가 없습니다.
            </template>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 계측 데이터 테이블 -->
    <div v-if="chartType === 'measurement'" class="data-container">
      <div class="table-section">
        <table class="data-table">
          <thead>
            <tr>
              <th>날짜</th>
              <th>Item ID</th>
              <th>Sub ID</th>
              <th>값</th>
              <th class="image-header">이미지</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(group, groupIndex) in Object.values(groupDataByImage)" :key="'group-' + groupIndex">
              <tr v-for="(point, index) in group.points" 
                  :key="'point-' + groupIndex + '-' + index"
                  :class="{ 
                    'group-row': true,
                    'group-start': index === 0,
                    'hovered': hoveredImage === group
                  }"
                  :data-item-id="group.item_id"
                  @mouseover="hoveredImage = group"
                  @mouseout="handleMouseOut">
                <td>{{ point.date }}</td>
                <td>{{ point.label }}</td>
                <td>{{ point.subId }}</td>
                <td>{{ point.value.toFixed(3) }}</td>
                <td v-if="index === 0" :rowspan="group.points.length" class="image-cell">
                  <img :src="group.imageUrl" 
                       :alt="group.item_id" 
                       class="table-image"
                       @error="handleImageError"
                       @click="showImagePopup(group)" />
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 불량 감지 데이터 테이블 -->
    <div v-if="chartType === 'defect'" class="data-container">
      <div class="table-section">
        <table class="data-table">
          <thead>
            <tr>
              <th>날짜</th>
              <th>Item ID</th>
              <th>Sub ID</th>
              <th>X</th>
              <th>Y</th>
              <th>Striation</th>
              <th>Distortion</th>
              <th>양/불</th>
              <th class="image-header">이미지</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(group, groupIndex) in Object.values(groupDefectDataByImage)" :key="'group-' + groupIndex">
              <tr v-for="(point, index) in group.points" 
                  :key="'point-' + groupIndex + '-' + index"
                  :class="{ 
                    'group-row': true,
                    'group-start': index === 0,
                    'hovered': hoveredImage === group
                  }"
                  :data-item-id="group.item_id"
                  @mouseover="hoveredImage = group"
                  @mouseout="handleMouseOut">
                <td>{{ point.date }}</td>
                <td>{{ point.item_id }}</td>
                <td>{{ point.subitem_id }}</td>
                <td>{{ point.x.toFixed(3) }}</td>
                <td>{{ point.y.toFixed(3) }}</td>
                <td>{{ point.striation.toFixed(3) }}</td>
                <td>{{ point.distortion.toFixed(3) }}</td>
                <td :class="point.result === '양품' ? 'pass' : 'fail'">{{ point.result }}</td>
                <td v-if="index === 0" :rowspan="group.points.length" class="image-cell">
                  <img :src="group.imageUrl" 
                       :alt="group.item_id" 
                       class="table-image"
                       @error="handleImageError"
                       @click="showImagePopup(group)" />
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Image Popup -->
    <div v-if="selectedImage" class="image-popup" @click="closeImagePopup">
      <div class="popup-content" @click.stop>
        <button class="close-btn" @click="closeImagePopup">&times;</button>
        <img :src="selectedImage.imageUrl" :alt="selectedImage.item_id" />
        <div class="popup-info">
          <h4>{{ selectedImage.item_id }}</h4>
          <div class="measurement-list">
            <div v-for="point in selectedImage.points" 
                 :key="point.x + '-' + point.y"
                 class="measurement-item">
              <span>{{ point.date }}</span>
              <div>
                <div>X: {{ point.x.toFixed(3) }}</div>
                <div>Y: {{ point.y.toFixed(3) }}</div>
                <div>줄무늬: {{ point.striation.toFixed(3) }}</div>
                <div>왜곡: {{ point.distortion.toFixed(3) }}</div>
                <div :class="point.result === '양품' ? 'pass' : 'fail'">{{ point.result }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="image-container">
      <img :src="'http://localhost:8091/images/' + currentImage" alt="현재 이미지" />
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed, watch, reactive } from 'vue'
import axios from 'axios'

export default {
  name: 'Side2Analysis',
  setup() {
    const chartContainer = ref(null)
    const width = ref(800)
    const height = ref(400)
    const margin = reactive({
      top: 40,
      right: 40,
      bottom: 40,
      left: 60
    })
    const chartType = ref('measurement')
    const chartData = ref(null)
    const defectChartData = ref(null)
    const selectedPoint = ref(null)
    const defectData = ref([])
    const currentImage = ref(null)
    const measurementData = ref([])
    const images = ref([])

    const setChartType = (type) => {
      chartType.value = type;
    }

    const yGridLines = computed(() => {
      if (!chartData.value || !chartData.value.points || !chartData.value.points.length) return []
      const count = 5
      const step = (height.value - margin.top - margin.bottom) / count
      return Array(count + 1).fill().map((_, i) => margin.top + i * step)
    })

    const xGridLines = computed(() => {
      if (!chartData.value || !chartData.value.points || !chartData.value.points.length) return []
      const count = chartData.value.points.length - 1
      const step = (width.value - margin.left - margin.right) / count
      return Array(count + 1).fill().map((_, i) => margin.left + i * step)
    })

    const getLinePath = (dataset) => {
      if (!dataset || !dataset.data || dataset.data.length === 0) {
        console.log('No data for line path')
        return ''
      }
      
      const xStep = (width.value - margin.left - margin.right) / (dataset.data.length - 1)
      // 모든 데이터셋에서 y 값을 가져와서 최대값과 최소값을 계산
      const allValues = chartData.value.datasets.flatMap(d => d.data.map(point => point.y))
      console.log('All y values:', allValues)
      
      const maxY = Math.max(...allValues)
      const minY = Math.min(...allValues)
      const yScale = (height.value - margin.top - margin.bottom) / ((maxY - minY) || 1)  // 0으로 나누는 것 방지
      
      console.log(`Line path calculation - yScale: ${yScale}, minY: ${minY}, maxY: ${maxY}`)
      
      let path = ''
      dataset.data.forEach((point, i) => {
        const x = margin.left + i * xStep
        const y = height.value - margin.bottom - (point.y - minY) * yScale
        path += (i === 0 ? 'M' : 'L') + `${x},${y}`
      })
      
      console.log(`Path for ${dataset.label}:`, path)
      return path
    }

    const getAllPoints = () => {
      if (!chartData.value || !chartData.value.points || !chartData.value.points.length) {
        console.log('No chart data available for points')
        return []
      }
      
      const points = []
      const allValues = chartData.value.points.map(point => point.y)
      const maxY = Math.max(...allValues)
      const minY = Math.min(...allValues)
      const yScale = (height.value - margin.top - margin.bottom) / ((maxY - minY) || 1)
      
      console.log(`Points calculation - yScale: ${yScale}, minY: ${minY}, maxY: ${maxY}`)
      
      chartData.value.points.forEach((point, index) => {
        const xStep = (width.value - margin.left - margin.right) / (chartData.value.points.length - 1)
        const x = margin.left + index * xStep
        const y = height.value - margin.bottom - (point.y - minY) * yScale
        
        points.push({
          x,
          y,
          color: point.color,
          value: point.y,
          date: point.date,
          label: point.item_id,
          subId: point.subitem_id
        })
      })
      
      console.log(`Generated ${points.length} data points`)
      return points
    }

    const limitedLabels = computed(() => {
      if (!chartData.value || !chartData.value.points || !chartData.value.points.length) return []
      const allLabels = chartData.value.points.map(point => point.date)
      const maxLabels = 4
      
      if (allLabels.length <= maxLabels) return allLabels
      
      const step = Math.ceil(allLabels.length / maxLabels)
      return allLabels.filter((_, index) => index % step === 0)
    })

    const getLabelX = (index) => {
      if (!chartData.value || !chartData.value.points || !chartData.value.points.length) return 0
      const totalLabels = chartData.value.points.length
      const step = (width.value - margin.left - margin.right) / (totalLabels - 1)
      const labelStep = Math.ceil(totalLabels / limitedLabels.value.length)
      return margin.left + (index * labelStep) * step
    }

    const processChartData = () => {
      if (!measurementData.value || !measurementData.value.length) {
        console.log('No measurement data available');
        chartData.value = null;
        return;
      }
      
      console.log('Processing chart data:', measurementData.value);
      
      // 측정 데이터에서 x, y 값 추출
      const points = measurementData.value.map(item => {
        if (!item.measurements || typeof item.measurements.x === 'undefined' || typeof item.measurements.y === 'undefined') {
          console.warn('Invalid measurement data:', item);
          return null;
        }

        const x = parseFloat(item.measurements.x);
        const y = parseFloat(item.measurements.y);
        
        if (isNaN(x) || isNaN(y)) {
          console.warn(`Invalid point data: x=${x}, y=${y}`, item);
          return null;
        }
        
        return {
          x,
          y,
          item_id: item.item_id,
          subitem_id: item.subitem_id,
          date: item.date,
          result: item.result,
          color: item.result === '양품' ? '#4CAF50' : '#F44336',
          value: Math.sqrt(x * x + y * y) // 값 계산 추가
        };
      }).filter(point => point !== null);
      
      if (points.length === 0) {
        console.warn('No valid points after processing');
        chartData.value = null;
        return;
      }
      
      const xValues = points.map(p => p.x);
      const yValues = points.map(p => p.y);
      
      chartData.value = {
        points,
        minX: Math.min(...xValues),
        maxX: Math.max(...xValues),
        minY: Math.min(...yValues),
        maxY: Math.max(...yValues)
      };
      
      console.log('Final chart data:', chartData.value);
    }

    const processDefectData = () => {
      if (!defectData.value || !defectData.value.length) {
        console.log('No defect data available');
        defectChartData.value = null;
        return;
      }
      
      console.log('Processing defect data:', defectData.value);
      
      const points = defectData.value.map(item => {
        if (typeof item.x === 'undefined' || typeof item.y === 'undefined' || 
            typeof item.striation === 'undefined' || typeof item.distortion === 'undefined') {
          console.warn('Invalid defect data:', item);
          return null;
        }

        const x = parseFloat(item.x);
        const y = parseFloat(item.y);
        const striation = parseFloat(item.striation);
        const distortion = parseFloat(item.distortion);
        
        if (isNaN(x) || isNaN(y) || isNaN(striation) || isNaN(distortion)) {
          console.warn(`Invalid defect point data: x=${x}, y=${y}, striation=${striation}, distortion=${distortion}`, item);
          return null;
        }
        
        return {
          x,
          y,
          item_id: item.item_id,
          subitem_id: item.subitem_id,
          date: item.date,
          striation,
          distortion,
          result: item.result,
          color: item.result === '양품' ? '#4CAF50' : '#F44336'
        };
      }).filter(point => point !== null);
      
      if (points.length === 0) {
        console.warn('No valid defect points after processing');
        defectChartData.value = null;
        return;
      }
      
      const xValues = points.map(p => p.x);
      const yValues = points.map(p => p.y);
      
      defectChartData.value = {
        points,
        minX: Math.min(...xValues),
        maxX: Math.max(...xValues),
        minY: Math.min(...yValues),
        maxY: Math.max(...yValues)
      };
      
      console.log('Final defect chart data:', defectChartData.value);
    }

    const fetchData = async () => {
      try {
        console.log('Fetching data...');
        const [measurementResponse, defectResponse] = await Promise.all([
          axios.get('http://127.0.0.1:8000/api/side2/data'),
          axios.get('http://127.0.0.1:8000/api/side2/data_defect')
        ]);
        
        console.log('Measurement API response:', measurementResponse.data);
        console.log('Defect API response:', defectResponse.data);
        
        if (measurementResponse.data.status === 'success') {
          measurementData.value = measurementResponse.data.data;
          images.value = measurementResponse.data.images.map(img => ({
            ...img,
            path: `http://127.0.0.1:8091/images/${img.filename}`
          }));
          
          processChartData();
        }
        
        if (defectResponse.data.status === 'success') {
          defectData.value = defectResponse.data.data;
          processDefectData();
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    }

    const getVisiblePoints = computed(() => {
      if (!chartData.value || !chartData.value.points || !chartData.value.points.length) {
        console.log('No points to display');
        return [];
      }
      
      console.log('Calculating visible points with data:', chartData.value);
      
      // 실제 그래프 영역 계산
      const plotWidth = width.value - margin.left - margin.right;
      const plotHeight = height.value - margin.top - margin.bottom;
      
      // 데이터 범위 계산
      const xRange = chartData.value.maxX - chartData.value.minX;
      const yRange = chartData.value.maxY - chartData.value.minY;
      
      // 스케일 계산 (0으로 나누는 것 방지)
      const xScale = xRange === 0 ? 1 : plotWidth / xRange;
      const yScale = yRange === 0 ? 1 : plotHeight / yRange;
      
      return chartData.value.points.map(point => {
        const x = margin.left + (point.x - chartData.value.minX) * xScale;
        const y = height.value - margin.bottom - (point.y - chartData.value.minY) * yScale;
        
        console.log(`Point (${point.item_id}): original(${point.x}, ${point.y}) -> scaled(${x}, ${y})`);
        
        return {
          ...point,
          x,
          y
        };
      });
    })

    const onMouseover = (point) => {
      currentImage.value = images.value.find(img => 
        img.filename.includes(point.item_id)
      );
    }

    const groupDataByImage = computed(() => {
      if (!chartData.value?.points) return {};
      
      console.log('=== 이미지 데이터 그룹화 시작 ===');
      const points = chartData.value.points;
      console.log('모든 포인트:', points);
      
      const grouped = {};
      points.forEach(point => {
        if (!grouped[point.item_id]) {
          console.log(`이미지 URL for ${point.item_id}:`, point.imageUrl);
          grouped[point.item_id] = {
            item_id: point.item_id,
            points: [],
            imageUrl: point.imageUrl || `http://localhost:8091/images/그림${point.item_id.replace('item', '')}.png`
          };
        }
        grouped[point.item_id].points.push(point);
      });
      
      console.log('그룹화된 데이터:', grouped);
      return grouped;
    })

    const selectedImage = ref(null)
    const hoveredImage = ref(null)

    // 차트 데이터가 로드되면 첫 번째 그룹을 기본으로 선택
    watch(groupDataByImage, (groups) => {
      const groupValues = Object.values(groups);
      if (groupValues.length > 0 && !hoveredImage.value) {
        hoveredImage.value = groupValues[0];
      }
    }, { immediate: true })

    const showImagePopup = (image) => {
      selectedImage.value = image
    }

    const closeImagePopup = () => {
      selectedImage.value = null
    }

    const getStatusClass = (value) => {
      if (value > 80) return 'error'
      if (value > 70) return 'warning'
      return 'normal'
    }

    const getStatusText = (value) => {
      if (value > 80) return '위험'
      if (value > 70) return '경고'
      return '정상'
    }

    const handleImageError = (event) => {
      console.error('Failed to load image:', event.target.src)
      // 이미지 로드 실패 시 기본 이미지 표시
      event.target.src = event.target.dataset.fallbackUrl || '' // 백엔드에서 제공하는 기본 이미지 URL 사용
    }

    const handleDragEnter = (group) => {
      hoveredImage.value = group
    }
    
    const handleDrop = () => {
      // 드롭 이벤트 처리 (필요한 경우)
    }

    const handleMouseOut = (event) => {
      // 마우스가 다른 행으로 이동하지 않았다면 이미지를 유지
      const relatedTarget = event.relatedTarget;
      if (!relatedTarget || !relatedTarget.closest('tr')) {
        // 이미지는 유지 (이전 코드와 달리 이미지를 계속 표시)
        // hoveredImage.value = null;
      }
    }

    const getVisibleDefectPoints = computed(() => {
      if (!defectChartData.value || !defectChartData.value.points || !defectChartData.value.points.length) {
        console.log('No defect points to display');
        return [];
      }
      
      console.log('Calculating visible defect points with data:', defectChartData.value);
      
      const plotWidth = width.value - margin.left - margin.right;
      const plotHeight = height.value - margin.top - margin.bottom;
      
      // 데이터 범위 계산
      const xRange = defectChartData.value.maxX - defectChartData.value.minX || 1;
      const yRange = defectChartData.value.maxY - defectChartData.value.minY || 1;
      
      // 스케일 계산
      const xScale = plotWidth / xRange;
      const yScale = plotHeight / yRange;
      
      return defectChartData.value.points.map(point => {
        // x, y 좌표를 실제 그래프 영역 내로 조정
        const x = margin.left + (point.x - defectChartData.value.minX) * xScale;
        const y = height.value - margin.bottom - (point.y - defectChartData.value.minY) * yScale;
        
        console.log(`Defect Point (${point.item_id}): original(${point.x}, ${point.y}) -> scaled(${x}, ${y})`);
        
        return {
          ...point,
          x,
          y
        };
      });
    });

    const groupDefectDataByImage = computed(() => {
      if (!defectChartData.value?.points) return {};
      
      console.log('=== 불량 감지 이미지 데이터 그룹화 시작 ===');
      const points = defectChartData.value.points;
      console.log('모든 불량 감지 포인트:', points);
      
      const grouped = {};
      points.forEach(point => {
        if (!grouped[point.item_id]) {
          console.log(`이미지 URL for ${point.item_id}:`, point.imageUrl);
          grouped[point.item_id] = {
            item_id: point.item_id,
            points: [],
            imageUrl: point.imageUrl || `http://localhost:8091/images/그림${point.item_id.replace('item', '')}.png`
          };
        }
        grouped[point.item_id].points.push(point);
      });
      
      console.log('그룹화된 불량 감지 데이터:', grouped);
      return grouped;
    });

    // 차트 타입 변경 시 데이터 초기화 및 재처리
    watch(chartType, (newType) => {
      console.log('차트 타입 변경:', newType);
      selectedPoint.value = null;
      
      if (newType === 'measurement') {
        console.log('계측 데이터 처리 시작');
        processChartData();
      } else {
        console.log('불량 감지 데이터 처리 시작');
        processDefectData();
      }
    });

    // 컴포넌트 마운트 시 초기 데이터 로드
    onMounted(() => {
      console.log('컴포넌트 마운트됨');
      if (chartContainer.value) {
        const rect = chartContainer.value.getBoundingClientRect();
        width.value = rect.width;
        height.value = 400;
        console.log(`차트 컨테이너 크기: ${width.value} x ${height.value}`);
      }
      fetchData();
    });

    // 로깅 추가
    watch(() => chartData.value, (newVal) => {
      console.log('chartData가 변경됨:', newVal);
    });

    watch(() => defectChartData.value, (newVal) => {
      console.log('defectChartData가 변경됨:', newVal);
    });

    return {
      chartType,
      chartData,
      defectChartData,
      width,
      height,
      margin,
      yGridLines,
      xGridLines,
      getLinePath,
      getLabelX,
      limitedLabels,
      getAllPoints,
      setChartType,
      chartContainer,
      selectedPoint,
      getStatusClass,
      getStatusText,
      groupDataByImage,
      selectedImage,
      showImagePopup,
      closeImagePopup,
      getVisiblePoints,
      handleImageError,
      hoveredImage,
      handleDragEnter,
      handleDrop,
      handleMouseOut,
      defectData,
      currentImage,
      measurementData,
      images,
      onMouseover,
      getVisibleDefectPoints,
      groupDefectDataByImage
    }
  }
}
</script>

<style scoped>
.analysis-container {
  padding: 20px;
  background: #f8f9fa;
  border-radius: 15px;
  color: #4a4a4a;
}

.chart-container {
  margin-bottom: 20px;
}

.chart-card {
  background: #ffffff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(147, 112, 219, 0.1);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.chart-header h3 {
  margin: 0;
  color: #4a4a4a;
  font-size: 1.25rem;
}

.btn-chart-type {
  background: transparent;
  border: 1px solid #9370db;
  color: #9370db;
  padding: 8px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.btn-chart-type:hover,
.btn-chart-type.active {
  color: #ffffff;
  background: #9370db;
}

.chart-content {
  position: relative;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.loading-chart {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 1.2em;
  color: #666;
}

.data-container {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(147, 112, 219, 0.1);
  height: calc(100vh - 500px);
  min-height: 400px;
  overflow: hidden;
}

.table-section {
  height: 100%;
  overflow: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.data-table th {
  position: sticky;
  top: 0;
  background: #ffffff;
  z-index: 1;
  color: #4a4a4a;
  padding: 12px;
  text-align: left;
  border-bottom: 2px solid #9370db;
}

.image-header {
  width: 50%;
}

.data-table td {
  padding: 12px;
  color: #666666;
  border-bottom: 1px solid rgba(147, 112, 219, 0.1);
}

.group-start {
  border-top: 2px solid rgba(147, 112, 219, 0.2);
}

/* 이미지 셀 스타일 */
.image-cell {
  width: 50%;
  text-align: center;
  background: #f8f9fa;
  border-left: 1px solid rgba(147, 112, 219, 0.1);
  padding: 10px;
  position: sticky;
  top: 40px; /* 헤더 높이 고려 */
  z-index: 2;
  height: 300px;
  vertical-align: top;
}

.table-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.table-image:hover {
  transform: scale(1.02);
}

tr.hovered {
  background-color: rgba(147, 112, 219, 0.05);
}

tr.hovered + tr {
  background-color: rgba(147, 112, 219, 0.05);
}

.image-popup {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.popup-content {
  position: relative;
  max-width: 90%;
  max-height: 90%;
  background: #ffffff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(147, 112, 219, 0.15);
}

.close-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  background: #ffffff;
  border: none;
  color: #4a4a4a;
  font-size: 24px;
  cursor: pointer;
  z-index: 1;
  width: 32px;
  height: 32px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(147, 112, 219, 0.1);
}

.measurement-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
  padding: 20px;
}

.measurement-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 12px;
  background: rgba(147, 112, 219, 0.1);
  border-radius: 4px;
  color: #4a4a4a;
  margin-bottom: 8px;
}

.measurement-item > div {
  text-align: right;
}

.measurement-item > div > div {
  margin-bottom: 4px;
}

.image-container {
  margin-top: 20px;
  text-align: center;
}

.pass {
  color: green;
}

.fail {
  color: red;
}

.chart {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.group-row {
  background-color: transparent;
  transition: background-color 0.2s ease;
}

.group-row.group-start {
  border-top: 2px solid rgba(147, 112, 219, 0.3);
}

.group-row.hovered {
  background-color: rgba(147, 112, 219, 0.05);
}

.image-cell {
  width: 50%;
  padding: 10px;
  background: #f8f9fa;
  border-left: 1px solid rgba(147, 112, 219, 0.1);
}

.table-image {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  transition: transform 0.2s ease;
}

.table-image:hover {
  transform: scale(1.05);
}
</style> 