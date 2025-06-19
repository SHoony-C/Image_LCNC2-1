<template>
  <div class="analysis-container">
    <!-- AppHeader 컴포넌트 추가 -->
    <AppHeader pageTitle="Analysis" />
    
    <div class="analysis-content">
      <div class="analysis-left-panel">
        <!-- 데이터 로드 컨트롤 섹션 -->
        <div class="control-section">
          <div class="control-group">
            <label for="table-select">테이블 선택:</label>
            <select 
              id="table-select"
              v-model="selectedTable" 
              class="table-select"
              :disabled="isLoading"
            >
              <option value="">테이블을 선택하세요</option>
              <option v-for="table in authorizedTables" 
                      :key="table" 
                      :value="table">
                {{ table }}
              </option>
            </select>
          </div>
          
          <div class="control-group">
            <label>날짜 범위:</label>
            <div class="date-range">
              <input 
                type="date" 
                v-model="dateFrom" 
                class="date-input"
                :disabled="isLoading"
              />
              <span class="date-separator">~</span>
              <input 
                type="date" 
                v-model="dateTo" 
                class="date-input"
                :disabled="isLoading"
              />
            </div>
          </div>
          
          <button 
            class="load-btn" 
            @click="loadData" 
            :disabled="!canLoadData || isLoading"
          >
            {{ isLoading ? '로딩 중...' : 'Data Load' }}
          </button>
        </div>

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
            <div class="chart-content" ref="chartContainer">
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
              </div>
            </div>
          </div>
        </div>
        
        <!-- 계측 데이터 테이블 -->
        <div v-if="chartType === 'measurement'" class="data-container">
          <h3>계측 데이터</h3>
          <div class="table-section">
            <table class="data-table">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>테이블명</th>
                  <th>Lot Wafer</th>
                  <th>Item ID</th>
                  <th>Sub ID</th>
                  <th>사용자</th>
                  <th>값</th>
                  <th class="image-header">이미지</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="(group, groupIndex) in Object.values(groupDataByImage)">
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
                    <td>{{ point.table_name || '-' }}</td>
                    <td>{{ point.lot_wafer || '-' }}</td>
                    <td>{{ point.item_id }}</td>
                    <td>{{ point.subitem_id }}</td>
                    <td>{{ point.username || '-' }}</td>
                    <td>{{ point.value ? point.value.toFixed(3) : '-' }}</td>
                    <td v-if="index === 0" :rowspan="group.points.length" class="image-cell">
                      <div class="image-container">
                        <div class="image-item">
                          <label>Before</label>
                          <img v-if="getImageUrl(group.points[0].lot_wafer, selectedTable, 'before')" 
                               :src="getImageUrl(group.points[0].lot_wafer, selectedTable, 'before')" 
                               :alt="`${group.points[0].lot_wafer}_before`" 
                               class="table-image"
                               @error="handleImageError"
                               @click="showImagePopup({...group, imageType: 'before'})" />
                          <div v-else class="image-placeholder">
                            Before 이미지 없음
                          </div>
                        </div>
                        <div class="image-item">
                          <label>After</label>
                          <img v-if="getImageUrl(group.points[0].lot_wafer, selectedTable, 'after')" 
                               :src="getImageUrl(group.points[0].lot_wafer, selectedTable, 'after')" 
                               :alt="`${group.points[0].lot_wafer}_after`" 
                               class="table-image"
                               @error="handleImageError"
                               @click="showImagePopup({...group, imageType: 'after'})" />
                          <div v-else class="image-placeholder">
                            After 이미지 없음
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 불량 감지 데이터 테이블 -->
        <div v-if="chartType === 'defect'" class="data-container">
          <h3>불량 감지 데이터</h3>
          <div class="table-section">
            <table class="data-table">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>세션 ID</th>
                  <th>Lot Wafer</th>
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
                <template v-for="(group, groupIndex) in Object.values(groupDefectDataByImage)">
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
                    <td>{{ point.session_id || '-' }}</td>
                    <td>{{ point.lot_wafer || '-' }}</td>
                    <td>{{ point.item_id }}</td>
                    <td>{{ point.subitem_id }}</td>
                    <td>{{ point.x.toFixed(3) }}</td>
                    <td>{{ point.y.toFixed(3) }}</td>
                    <td>{{ point.striation.toFixed(3) }}</td>
                    <td>{{ point.distortion.toFixed(3) }}</td>
                    <td :class="point.result === '양품' ? 'pass' : 'fail'">{{ point.result }}</td>
                    <td v-if="index === 0" :rowspan="group.points.length" class="image-cell">
                      <div class="image-container">
                        <div class="image-item">
                          <label>Before</label>
                          <img v-if="getImageUrl(group.points[0].lot_wafer, selectedTable, 'before')" 
                               :src="getImageUrl(group.points[0].lot_wafer, selectedTable, 'before')" 
                               :alt="`${group.points[0].lot_wafer}_before`" 
                               class="table-image"
                               @error="handleImageError"
                               @click="showImagePopup({...group, imageType: 'before'})" />
                          <div v-else class="image-placeholder">
                            Before 이미지 없음
                          </div>
                        </div>
                        <div class="image-item">
                          <label>After</label>
                          <img v-if="getImageUrl(group.points[0].lot_wafer, selectedTable, 'after')" 
                               :src="getImageUrl(group.points[0].lot_wafer, selectedTable, 'after')" 
                               :alt="`${group.points[0].lot_wafer}_after`" 
                               class="table-image"
                               @error="handleImageError"
                               @click="showImagePopup({...group, imageType: 'after'})" />
                          <div v-else class="image-placeholder">
                            After 이미지 없음
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </div>
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
  </div>
</template>

<script>
import { ref, onMounted, computed, watch, reactive, onUnmounted } from 'vue'
import axios from 'axios'
import AppHeader from '@/components/AppHeader.vue'
import MSA3ImageDisplay from '@/components/msa3_image_display.vue'
import MSA4LLMAnalysis from '@/components/msa4_llm_analysis.vue'

export default {
  name: 'Side2Analysis',
  components: {
    AppHeader,
    MSA3ImageDisplay,
    MSA4LLMAnalysis
  },
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
    const measurementData = ref([])
    const images = ref([])
    
    // MSA3 and MSA4 component references
    const msa3Component = ref(null)
    const msa4Component = ref(null)
    
    // Method to handle image analysis request from MSA3
    const handleImageAnalysis = (imageData) => {
      console.log('Received image analysis request from MSA3:', imageData)
      // Forward the analysis data from MSA3 to MSA4
      if (msa4Component.value) {
        msa4Component.value.analyzeImage(imageData)
      }
    }

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
        chartData.value = null;
        return;
      }
      
      // 측정 데이터에서 x, y 값 추출
      const points = measurementData.value.map(item => {
        if (!item.measurements || typeof item.measurements.x === 'undefined' || typeof item.measurements.y === 'undefined') {
          return null;
        }

        const x = parseFloat(item.measurements.x);
        const y = parseFloat(item.measurements.y);
        
        if (isNaN(x) || isNaN(y)) {
          return null;
        }
        
        return {
          x,
          y,
          item_id: item.item_id,
          subitem_id: item.subitem_id,
          table_name: item.table_name,
          lot_wafer: item.lot_wafer,
          username: item.username,
          date: item.date,
          result: item.result,
          color: item.result === '양품' ? '#4CAF50' : '#F44336',
          value: item.value || Math.sqrt(x * x + y * y), // 실제 값 또는 계산된 값
          imageUrl: getImageUrl(item.lot_wafer, selectedTable.value, 'before') // 선택된 테이블명 사용
        };
      }).filter(point => point !== null);
      
      if (points.length === 0) {
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
    }

    const processDefectData = () => {
      if (!defectData.value || !defectData.value.length) {
        defectChartData.value = null;
        return;
      }
      
      const points = defectData.value.map(item => {
        if (typeof item.x === 'undefined' || typeof item.y === 'undefined' || 
            typeof item.striation === 'undefined' || typeof item.distortion === 'undefined') {
          return null;
        }

        const x = parseFloat(item.x);
        const y = parseFloat(item.y);
        const striation = parseFloat(item.striation);
        const distortion = parseFloat(item.distortion);
        
        if (isNaN(x) || isNaN(y) || isNaN(striation) || isNaN(distortion)) {
          return null;
        }
        
        return {
          x,
          y,
          item_id: item.item_id,
          subitem_id: item.subitem_id,
          session_id: item.session_id,
          lot_wafer: item.lot_wafer,
          date: item.date,
          striation,
          distortion,
          result: item.result,
          color: item.result === '양품' ? '#4CAF50' : '#F44336',
          imageUrl: getImageUrl(item.lot_wafer, selectedTable.value, 'before') // 선택된 테이블명 사용
        };
      }).filter(point => point !== null);
      
      if (points.length === 0) {
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
    }

    // 테이블 선택 관련 변수 추가
    const selectedTable = ref('')
    const authorizedTables = ref(['table1', 'table2', 'table3']) // 예시 테이블 목록
    
    // 기본 날짜 설정 (오늘부터 일주일 전까지)
    const today = new Date()
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const dateFrom = ref(weekAgo.toISOString().split('T')[0])
    const dateTo = ref(today.toISOString().split('T')[0])
    const isLoading = ref(false)

    // 데이터 로드 가능 여부 확인
    const canLoadData = computed(() => {
      return selectedTable.value && dateFrom.value && dateTo.value
    })

    // 데이터 로드 함수
    const loadData = async () => {
      if (!canLoadData.value) return
      
      isLoading.value = true
      try {
        await fetchData()
      } finally {
        isLoading.value = false
      }
    }

    // 이미지 URL 생성 함수 수정 - lot_wafer 기반
    const getImageUrl = (lotWafer, tableName = null, imageType = 'before') => {
      if (!lotWafer) {
        return '';
      }
      
      // 명확히 잘못된 값들만 필터링
      if (lotWafer === 'main' || 
          lotWafer === 'undefined' ||
          lotWafer === 'null' ||
          lotWafer === '' ||
          typeof lotWafer !== 'string') {
        return '';
      }
      
      // 테이블명 결정 (파라미터로 받은 것 또는 선택된 테이블 또는 기본값)
      const tableToUse = tableName || selectedTable.value || 'default';
      
      // IIS 서버를 통해 이미지 요청 - lot_wafer 기반
      const imageName = `${lotWafer}_${imageType}.png`;
      const finalUrl = `http://localhost:8091/results_images/${tableToUse}/${imageName}`;
      
      return finalUrl;
    }

    // 테이블 목록 가져오기
    const fetchTables = async () => {
      try {
        const response = await axios.get('http://localhost:8000/api/msa6/table-names')
        if (response.data.status === 'success' && response.data.data) {
          authorizedTables.value = response.data.data.map(table => table.table_name)
        }
      } catch (error) {
        console.error('테이블 목록 로드 실패:', error)
        // 기본 테이블 목록 사용
        authorizedTables.value = ['default', 'table1', 'table2']
      }
    }

    const fetchData = async () => {
      try {
        // API 파라미터 구성
        const params = new URLSearchParams();
        if (selectedTable.value) {
          params.append('table_name', selectedTable.value);
        }
        if (dateFrom.value) {
          params.append('date_from', dateFrom.value);
        }
        if (dateTo.value) {
          params.append('date_to', dateTo.value);
        }
        
        const queryString = params.toString();
        const measurementUrl = `http://localhost:8000/api/side2/data${queryString ? '?' + queryString : ''}`;
        const defectUrl = `http://localhost:8000/api/side2/data_defect${queryString ? '?' + queryString : ''}`;
        
        const [measurementResponse, defectResponse] = await Promise.all([
          axios.get(measurementUrl),
          axios.get(defectUrl)
        ]);
        
        if (measurementResponse.data.status === 'success') {
          measurementData.value = measurementResponse.data.data;
          images.value = measurementResponse.data.images ? measurementResponse.data.images.map(img => ({
            ...img,
            path: `http://127.0.0.1:8091/images/${img.filename}`
          })) : [];
          
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
        return [];
      }
      
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
        
        return {
          ...point,
          x,
          y
        };
      });
    })

    const onMouseover = () => {
      // 함수 내용 제거 (이미지 관련 기능 제거)
    }

    const groupDataByImage = computed(() => {
      if (!chartData.value?.points) return {};
      
      const points = chartData.value.points;
      
      const grouped = {};
      points.forEach(point => {
        if (!grouped[point.item_id]) {
          grouped[point.item_id] = {
            item_id: point.item_id,
            points: [],
            imageUrl: point.imageUrl || getImageUrl(point.lot_wafer, selectedTable.value, 'before')
          };
        }
        grouped[point.item_id].points.push(point);
      });
      
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
      // 이미지 오류 처리를 완전히 차단하여 무한 루프 방지
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      
      // 이미 처리된 경우 아무것도 하지 않음
      if (event.target.dataset.errorHandled === 'true') {
        return false;
      }
      
      // 오류 처리 완료 표시
      event.target.dataset.errorHandled = 'true';
      
      // 이미지를 숨기고 텍스트로 대체
      event.target.style.display = 'none';
      
      // 부모 요소에 텍스트 추가 (이미지 대신)
      const parent = event.target.parentElement;
      if (parent && !parent.querySelector('.image-placeholder')) {
        const placeholder = document.createElement('div');
        placeholder.className = 'image-placeholder';
        placeholder.textContent = '이미지 없음';
        placeholder.style.cssText = `
          width: 110px;
          height: 110px;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #f5f5f5;
          border: 1px solid #ddd;
          border-radius: 8px;
          color: #666;
          font-size: 12px;
          text-align: center;
        `;
        parent.appendChild(placeholder);
      }
      
      return false;
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
        return [];
      }
      
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
        
        return {
          ...point,
          x,
          y
        };
      });
    });

    const groupDefectDataByImage = computed(() => {
      if (!defectChartData.value?.points) return {};
      
      const points = defectChartData.value.points;
      
      const grouped = {};
      points.forEach(point => {
        if (!grouped[point.item_id]) {
          grouped[point.item_id] = {
            item_id: point.item_id,
            points: [],
            imageUrl: point.imageUrl || getImageUrl(point.lot_wafer, selectedTable.value, 'before')
          };
        }
        grouped[point.item_id].points.push(point);
      });
      
      return grouped;
    });

    // 차트 타입 변경 시 데이터 초기화 및 재처리
    watch(chartType, (newType) => {
      selectedPoint.value = null;
      
      if (newType === 'measurement') {
        processChartData();
      } else {
        processDefectData();
      }
    });

    // 컴포넌트 마운트 시 초기 데이터 로드
    onMounted(() => {
      if (chartContainer.value) {
        const rect = chartContainer.value.getBoundingClientRect();
        width.value = rect.width;
        height.value = Math.min(400, window.innerHeight * 0.4); // 화면 높이에 맞게 차트 높이 조정
      }
      
      // 테이블 목록을 먼저 가져온 후 데이터 로드
      fetchTables().then(() => {
        // 기본 테이블이 있으면 선택
        if (authorizedTables.value.length > 0) {
          selectedTable.value = authorizedTables.value[0];
        }
        fetchData();
      });
      
      // 창 크기 변경 시 차트 크기 조정
      window.addEventListener('resize', handleResize);
    });

    // 컴포넌트 언마운트 시 이벤트 리스너 제거
    onUnmounted(() => {
      window.removeEventListener('resize', handleResize);
    });

    // 창 크기 변경 핸들러
    const handleResize = () => {
      if (chartContainer.value) {
        const rect = chartContainer.value.getBoundingClientRect();
        width.value = rect.width;
        height.value = Math.min(400, window.innerHeight * 0.4);
      }
    };

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
      measurementData,
      images,
      onMouseover,
      getVisibleDefectPoints,
      groupDefectDataByImage,
      handleResize,
      msa3Component,
      msa4Component,
      handleImageAnalysis,
      getImageUrl,
      fetchData,
      selectedTable,
      authorizedTables,
      dateFrom,
      dateTo,
      isLoading,
      canLoadData,
      loadData,
      fetchTables
    }
  }
}
</script>

<style scoped>
html, body {
  overflow-x: hidden;
  width: 100%;
  margin: 0;
  padding: 0;
}

* {
  box-sizing: border-box;
}

.analysis-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  background-color: #f6f3ff;
  min-height: 100vh;
  padding: 0 2rem;
  margin: 0;
  overflow: hidden;
  box-sizing: border-box;
  padding-bottom: 3.5rem; /* 푸터 높이만큼 하단 여백 추가 */
}

.analysis-content {
  display: flex;
  height: calc(100vh - 120px);
  gap: 20px;
  padding: 20px;
}

.analysis-left-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.analysis-right-panel {
  width: 40%;
  max-width: 800px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.msa3-wrapper, .msa4-wrapper {
  flex: 1;
  border: 1px solid #eee;
  border-radius: 8px;
  background-color: white;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.chart-container {
  margin: 0 1.5rem 1.5rem;
  padding: 0;
  width: calc(100% - 3rem);
  max-width: calc(100% - 3rem);
  overflow: hidden;
  box-sizing: border-box;
}

.chart-card {
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  padding: 1.5rem;
  margin: 0.5rem 0;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  box-sizing: border-box;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--gray-200);
}

.chart-header h3 {
  font-size: 1.4rem;
  font-weight: 600;
  color: var(--primary-700);
  margin: 0;
}

.chart-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-chart-type {
  background-color: #f0eaff;
  border: none;
  border-radius: 8px;
  padding: 0.6rem 1rem;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--primary-600);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-chart-type:hover {
  background-color: #e5dcff;
}

.btn-chart-type.active {
  background-color: var(--primary-600);
  color: white;
}

.chart-content {
  width: 100%;
  max-width: 100%;
  position: relative;
  box-sizing: border-box;
  overflow: hidden;
  height: auto;
}

.data-container {
  width: calc(100% - 3rem);
  overflow: hidden; /* 가로 스크롤만 허용하던 것을 모든 방향 스크롤 방지로 변경 */
  margin: 0 1.5rem 1rem;
  padding: 0;
  box-sizing: border-box;
}

.table-section {
  overflow-x: auto; /* 테이블 내용이 넘칠 경우 가로 스크롤만 허용 */
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  padding: 1rem;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
  table-layout: fixed;
  margin: 0.5rem 0;
}

.data-table th {
  font-weight: 600;
  color: var(--primary-700);
  background-color: #f9f7ff;
  padding: 1rem;
  text-align: left;
  border-bottom: 2px solid var(--primary-200);
}

.data-table td {
  padding: 0.8rem 1rem;
  text-align: left;
  border-bottom: 1px solid #eee;
  word-break: break-word;
  overflow-wrap: break-word;
}

.image-cell {
  width: 240px;
  vertical-align: middle;
  text-align: center;
  padding: 0.5rem;
}

.image-header {
  width: 240px;
}

.image-container {
  display: flex;
  gap: 10px;
  justify-content: center;
  align-items: flex-start;
}

.image-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.image-item label {
  font-size: 11px;
  font-weight: 600;
  color: var(--primary-600);
  margin-bottom: 2px;
}

.table-image {
  max-width: 110px;
  max-height: 110px;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  border: 1px solid var(--gray-200);
}

.image-placeholder {
  width: 110px;
  height: 110px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 8px;
  color: #666;
  font-size: 10px;
  text-align: center;
  cursor: default;
}

/* 반응형 스타일 */
@media (max-width: 768px) {
  .analysis-container {
    padding: 0 1rem;
  }
  
  .chart-card, 
  .data-container {
    padding: 1rem;
  }
  
  .chart-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .data-table th,
  .data-table td {
    padding: 0.6rem 0.8rem;
    font-size: 0.8rem;
  }
  
  .table-image {
    max-width: 80px;
    max-height: 80px;
  }
}

.image-popup {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.popup-content {
  position: relative;
  background-color: white;
  padding: 1.25rem;
  border-radius: 12px;
  max-width: 90%;
  max-height: 90%;
  overflow: auto;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.popup-content img {
  max-width: 100%;
  max-height: 70vh;
  margin-bottom: 1rem;
  box-sizing: border-box;
}

.popup-info {
  margin-top: 1rem;
  width: 100%;
  box-sizing: border-box;
}

.close-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--primary-600);
  z-index: 10;
}

.loading-chart {
  display: flex;
  align-items: center;
  justify-content: center;
  height: auto;
  min-height: 100px;
  color: var(--gray-500);
  font-style: italic;
}

.table-image:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.group-row.hovered {
  background-color: #f9f7ff;
}

.group-row.group-start {
  border-top: 1px solid var(--primary-100);
}

.pass {
  color: #28a745;
  font-weight: 600;
}

.fail {
  color: #dc3545;
  font-weight: 600;
}

/* 테이블 헤더 스타일 */
.data-container {
  margin-top: 2rem;
}

.data-container h3 {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--primary-700);
  margin: 0 0 1rem 0;
  padding-left: 0.5rem;
}

/* 컨트롤 섹션 스타일 */
.control-section {
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  padding: 1.5rem;
  margin: 1.5rem;
  display: flex;
  gap: 2rem;
  align-items: flex-end;
  flex-wrap: wrap;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 200px;
}

.control-group label {
  font-weight: 600;
  color: var(--primary-700);
  font-size: 0.9rem;
}

.table-select {
  padding: 0.6rem;
  border: 1px solid var(--gray-300);
  border-radius: 6px;
  font-size: 0.9rem;
  background-color: white;
  min-width: 200px;
}

.table-select:disabled {
  background-color: var(--gray-100);
  cursor: not-allowed;
}

.date-range {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.date-input {
  padding: 0.6rem;
  border: 1px solid var(--gray-300);
  border-radius: 6px;
  font-size: 0.9rem;
  background-color: white;
  min-width: 150px;
}

.date-input:disabled {
  background-color: var(--gray-100);
  cursor: not-allowed;
}

.date-separator {
  color: var(--gray-600);
  font-weight: 500;
}

.load-btn {
  background-color: var(--primary-600);
  color: white;
  border: none;
  border-radius: 6px;
  padding: 0.6rem 1.5rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 120px;
  height: 40px;
}

.load-btn:hover:not(:disabled) {
  background-color: var(--primary-700);
}

.load-btn:disabled {
  background-color: var(--gray-400);
  cursor: not-allowed;
}

/* 반응형 스타일 */
@media (max-width: 768px) {
  .control-section {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
    margin: 1rem;
  }
  
  .control-group {
    width: 100%;
  }
  
  .table-select,
  .date-input {
    width: 100%;
  }
  
  .load-btn {
    width: 100%;
  }
}

@media (max-width: 1200px) {
  .analysis-content {
    flex-direction: column;
  }
  
  .analysis-right-panel {
    width: 100%;
    max-width: 100%;
  }
}
</style> 