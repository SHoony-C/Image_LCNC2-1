<template>
  <div class="analysis-container">
    <div class="chart-container">
      <div class="chart-card">
        <div class="chart-header">
          <h3>분석 결과</h3>
          <div class="chart-actions">
            <button class="btn-chart-type" :class="{ active: chartType === 'line' }" @click="setChartType('line')">
              <i class="fas fa-chart-line"></i>
            </button>
            <button class="btn-chart-type" :class="{ active: chartType === 'bar' }" @click="setChartType('bar')">
              <i class="fas fa-chart-bar"></i>
            </button>
          </div>
        </div>
        <div class="chart-content" ref="chartContainer" style="height: 400px;">
          <svg v-if="chartData" :width="width" :height="height" class="chart">
            <!-- Grid Lines -->
            <g class="grid-lines">
              <line v-for="y in yGridLines" :key="'y-' + y"
                x1="50" :x2="width - 20" :y1="y" :y2="y"
                stroke="#eee" stroke-dasharray="2,2" />
              <line v-for="x in xGridLines" :key="'x-' + x"
                :x1="x" :x2="x" y1="20" :y2="height - 30"
                stroke="#eee" stroke-dasharray="2,2" />
            </g>
            <!-- Data points -->
            <g class="data-points">
              <circle v-for="point in getVisiblePoints()" :key="point.x + '-' + point.y"
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
                값: {{ selectedPoint.value.toFixed(2) }}
              </text>
            </g>
            <!-- Axes -->
            <g class="axes">
              <line x1="50" :x2="width - 20" :y1="height - 30" :y2="height - 30" stroke="#666" />
              <line x1="50" y1="20" x2="50" :y2="height - 30" stroke="#666" />
            </g>
            <!-- Labels -->
            <g class="labels">
              <text v-for="(label, i) in getLimitedLabels()" :key="'label-' + i"
                :x="getLabelX(i)" :y="height - 10"
                fill="#666" text-anchor="middle"
                font-size="12">{{ label }}</text>
            </g>
          </svg>
          <div v-else class="loading-chart">차트 데이터 로딩 중...</div>
        </div>
      </div>
    </div>
    
    <!-- Data Table with Right Image Column -->
    <div class="data-container">
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
            <template v-for="group in Object.values(groupDataByImage)" :key="group.item_id">
              <template v-for="(point, index) in group.points" :key="point.x + '-' + point.y">
                <tr :class="{ 
                      'group-start': index === 0,
                      'hovered': hoveredImage === group
                    }"
                    :data-item-id="group.item_id"
                    @mouseover="hoveredImage = group"
                    @mouseout="handleMouseOut"
                    @dragenter.prevent="handleDragEnter(group)"
                    draggable="true">
                  <td>{{ point.date }}</td>
                  <td>{{ point.label }}</td>
                  <td>{{ point.subId }}</td>
                  <td>{{ point.value.toFixed(2) }}</td>
                  <td v-if="index === 0" :rowspan="group.points.length" class="image-cell">
                    <img :src="group.imageUrl" 
                         :alt="group.item_id" 
                         class="table-image"
                         @error="handleImageError"
                         @click="showImagePopup(group)" />
                  </td>
                </tr>
              </template>
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
              <span>{{ point.date }} (Sub ID: {{ point.subId }})</span>
              <span>{{ point.value.toFixed(2) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed, watch } from 'vue'
import axios from 'axios'

// 랜덤 색상 생성 함수
const getRandomColor = () => {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 70%, 50%)`;
}

export default {
  name: 'Side2Analysis',
  setup() {
    const chartContainer = ref(null)
    const width = ref(800)
    const height = ref(400)
    const chartType = ref('line')
    const chartData = ref(null)
    const selectedPoint = ref(null)

    const yGridLines = computed(() => {
      if (!chartData.value) return []
      const count = 5
      const step = (height.value - 50) / count
      return Array(count + 1).fill().map((_, i) => 20 + i * step)
    })

    const xGridLines = computed(() => {
      if (!chartData.value) return []
      const count = chartData.value.labels.length - 1
      const step = (width.value - 70) / count
      return Array(count + 1).fill().map((_, i) => 50 + i * step)
    })

    const getLinePath = (dataset) => {
      if (!dataset || !dataset.data || dataset.data.length === 0) {
        console.log('No data for line path')
        return ''
      }
      
      const xStep = (width.value - 70) / (dataset.data.length - 1)
      // 모든 데이터셋에서 y 값을 가져와서 최대값과 최소값을 계산
      const allValues = chartData.value.datasets.flatMap(d => d.data.map(point => point.y))
      console.log('All y values:', allValues)
      
      const maxY = Math.max(...allValues)
      const minY = Math.min(...allValues)
      const yScale = (height.value - 50) / ((maxY - minY) || 1)  // 0으로 나누는 것 방지
      
      console.log(`Line path calculation - yScale: ${yScale}, minY: ${minY}, maxY: ${maxY}`)
      
      let path = ''
      dataset.data.forEach((point, i) => {
        const x = 50 + i * xStep
        const y = height.value - 30 - (point.y - minY) * yScale
        path += (i === 0 ? 'M' : 'L') + `${x},${y}`
      })
      
      console.log(`Path for ${dataset.label}:`, path)
      return path
    }

    const getAllPoints = () => {
      if (!chartData.value) {
        console.log('No chart data available for points')
        return []
      }
      const points = []
      
      // 모든 데이터셋에서 y 값을 가져와서 최대값과 최소값을 계산
      const allValues = chartData.value.datasets.flatMap(d => d.data.map(point => point.y))
      const maxY = Math.max(...allValues)
      const minY = Math.min(...allValues)
      // 0으로 나누는 것 방지
      const yScale = (height.value - 50) / ((maxY - minY) || 1)
      
      console.log(`Points calculation - yScale: ${yScale}, minY: ${minY}, maxY: ${maxY}`)
      
      chartData.value.datasets.forEach((dataset) => {
        dataset.data.forEach((item, index) => {
          const xStep = (width.value - 70) / (dataset.data.length - 1)
          const x = 50 + index * xStep
          const y = height.value - 30 - (item.y - minY) * yScale
          
          points.push({
            x,
            y,
            color: dataset.borderColor,
            value: item.y,
            date: item.x,
            label: item.label,
            subId: item.subitem_id
          })
        })
      })
      
      console.log(`Generated ${points.length} data points`)
      return points
    }

    const getLimitedLabels = () => {
      if (!chartData.value) return [];
      const allLabels = chartData.value.labels;
      const maxLabels = 4; // x축에 표시할 최대 라벨 수
      
      if (allLabels.length <= maxLabels) return allLabels;
      
      const step = Math.ceil(allLabels.length / maxLabels);
      return allLabels.filter((_, index) => index % step === 0);
    }

    const getLabelX = (index) => {
      if (!chartData.value) return 0;
      const limitedLabels = getLimitedLabels();
      const totalLabels = chartData.value.labels.length;
      const step = (width.value - 70) / (totalLabels - 1);
      const labelStep = Math.ceil(totalLabels / limitedLabels.length);
      return 50 + (index * labelStep) * step;
    }

    const fetchData = async () => {
      try {
        console.log('=== API 호출 시작 ===');
        const response = await axios.get('http://localhost:8000/api/side2/data');
        console.log('API 응답 전체:', response);
        console.log('API 응답 데이터:', response.data);
        
        if (response.data.status === 'success') {
          console.log('데이터 처리 시작');
          const rawData = response.data.data;
          console.log('원본 데이터:', rawData);
          
          // 데이터를 날짜별로 그룹화
          const groupedByDate = {};
          rawData.forEach(item => {
            if (!groupedByDate[item.date]) {
              groupedByDate[item.date] = [];
            }
            groupedByDate[item.date].push(item);
          });
          console.log('날짜별 그룹화된 데이터:', groupedByDate);
          
          // 데이터셋 생성
          const datasets = [];
          const itemIds = [...new Set(rawData.map(item => item.item_id))];
          console.log('고유한 item_id 목록:', itemIds);
          
          itemIds.forEach(itemId => {
            const itemData = rawData.filter(item => item.item_id === itemId);
            console.log(`${itemId}의 데이터:`, itemData);
            
            const color = getRandomColor();
            const dataset = {
              label: itemId,
              data: itemData.map(item => ({
                x: item.date,
                y: parseFloat(item.value),  // 값이 문자열인 경우를 대비해 숫자로 변환
                label: item.item_id,
                subitem_id: item.subitem_id
              })),
              backgroundColor: color,
              borderColor: color,
              borderWidth: 1,
              pointRadius: 5,
              pointHoverRadius: 8
            };
            console.log(`${itemId}의 데이터셋:`, dataset);
            datasets.push(dataset);
          });
          
          console.log('생성된 전체 데이터셋:', datasets);
          
          // 차트 데이터 업데이트
          chartData.value = {
            labels: Object.keys(groupedByDate),
            datasets: datasets
          };
          
          console.log('최종 차트 데이터:', chartData.value);
        }
      } catch (error) {
        console.error('데이터 가져오기 실패:', error);
      }
    }

    const groupDataByImage = computed(() => {
      console.log('=== 이미지 데이터 그룹화 시작 ===');
      const points = getAllPoints();
      console.log('모든 포인트:', points);
      
      const grouped = {};
      points.forEach(point => {
        if (!grouped[point.label]) {
          grouped[point.label] = {
            item_id: point.label,
            points: [],
            imageUrl: `/test_image/${point.label.replace('item', '')}.png`
          };
        }
        grouped[point.label].points.push(point);
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

    const getVisiblePoints = () => {
      const points = getAllPoints()
      return points
    }

    const setChartType = (type) => {
      chartType.value = type
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
      event.target.src = '/test_image/1.png'  // 기본 이미지로 1.png 사용
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

    onMounted(() => {
      console.log('컴포넌트 마운트됨')
      if (chartContainer.value) {
        const rect = chartContainer.value.getBoundingClientRect()
        width.value = rect.width
        height.value = 400 // 명시적인 높이 지정
        console.log(`차트 컨테이너 크기: ${width.value} x ${height.value}`)
      } else {
        console.log('차트 컨테이너를 찾을 수 없음')
      }
      fetchData()
    })

    return {
      chartType,
      chartData,
      width,
      height,
      yGridLines,
      xGridLines,
      getLinePath,
      getLabelX,
      getLimitedLabels,
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
      handleMouseOut
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
}

.loading-chart {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(255, 255, 255, 0.8);
  font-size: 1.2rem;
  color: #9370db;
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
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  background: rgba(147, 112, 219, 0.1);
  border-radius: 4px;
  color: #4a4a4a;
}
</style> 