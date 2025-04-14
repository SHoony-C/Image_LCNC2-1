<template>
  <div class="analysis-container">
    <div class="header">
      <h2>분석</h2>
      <div class="controls">
        <div class="date-range-selector">
          <label for="dateRange">기간:</label>
          <select id="dateRange" v-model="selectedDateRange" @change="updatePlot">
            <option value="7">7일</option>
            <option value="30">30일</option>
            <option value="365">365일</option>
          </select>
        </div>
      </div>
    </div>
    
    <!-- 그래프 영역 -->
    <div class="graph-container">
      <div class="graph-controls">
        <div class="date-range">
          <label>기간 선택:</label>
          <select v-model="selectedDateRange">
            <option value="7">7일</option>
            <option value="30">30일</option>
            <option value="365">365일</option>
          </select>
        </div>
      </div>
      <div class="plot-wrapper">
        <div ref="plotContainer" class="plot-container"></div>
        <div v-if="isGraphLoading" class="loading-overlay">
          <div class="loading-content">
            <div class="loading-spinner"></div>
            <div class="loading-text">그래프를 그리는 중...</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 선택된 데이터 표시 영역 -->
    <div class="data-display">
      <!-- 왼쪽: 선택된 데이터 목록 -->
      <div class="selected-data">
        <div class="panel-header">
          <h3>선택된 데이터</h3>
          <div class="header-controls">
            <div class="selected-count" v-if="selectedData.length > 0">
              {{ selectedData.length }}개 선택됨
            </div>
            <div class="column-control">
              <button class="settings-btn" @click="showColumnSettings = !showColumnSettings">
                <i class="fas fa-cog"></i>
              </button>
              <div class="column-settings" v-if="showColumnSettings">
                <div v-for="(visible, column) in visibleColumns" :key="column" class="column-option">
                  <input type="checkbox" :id="column" v-model="visibleColumns[column]">
                  <label :for="column">{{ columnLabels[column] }}</label>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="data-table-container">
          <div v-if="isGraphLoading" class="loading-overlay active">
            <div class="loading-spinner"></div>
            <div class="loading-text">데이터를 불러오는 중...</div>
          </div>
          <template v-else>
            <table v-if="selectedData.length > 0" class="data-table">
              <thead>
                <tr>
                  <th v-if="visibleColumns.date">날짜</th>
                  <th v-if="visibleColumns.item">Item</th>
                  <th v-if="visibleColumns.subitem">Subitem</th>
                  <th v-if="visibleColumns.value">값</th>
                  <th v-if="visibleColumns.status">상태</th>
                  <th v-if="visibleColumns.temperature">온도</th>
                  <th v-if="visibleColumns.humidity">습도</th>
                  <th v-if="visibleColumns.pressure">압력</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(data, index) in selectedData" 
                    :key="index" 
                    :class="getStatusClass(data.flag)">
                  <td v-if="visibleColumns.date">{{ formatDate(data.date) }}</td>
                  <td v-if="visibleColumns.item">{{ data.item_id }}</td>
                  <td v-if="visibleColumns.subitem">{{ data.subitem_id }}</td>
                  <td v-if="visibleColumns.value">{{ data.value.toFixed(2) }}</td>
                  <td v-if="visibleColumns.status">
                    <span class="status-dot" :class="getStatusClass(data.flag)"></span>
                    <span class="status-text">{{ getStatusText(data.flag) }}</span>
                  </td>
                  <td v-if="visibleColumns.temperature">{{ (data.temperature || 0).toFixed(1) }}°C</td>
                  <td v-if="visibleColumns.humidity">{{ (data.humidity || 0).toFixed(1) }}%</td>
                  <td v-if="visibleColumns.pressure">{{ (data.pressure || 0).toFixed(1) }}hPa</td>
                </tr>
              </tbody>
            </table>
            <div v-else class="no-data">
              데이터를 선택하세요
            </div>
          </template>
        </div>
      </div>

      <!-- 오른쪽: 선택된 데이터의 이미지 -->
      <div class="selected-images">
        <div class="panel-header">
          <h3>관련 이미지</h3>
          <div class="header-controls">
            <div class="selected-count" v-if="selectedData.length > 0">
              {{ selectedData.length }}개의 이미지
            </div>
            <div class="column-control">
              <button class="settings-btn" @click="showImageColumnSettings = !showImageColumnSettings">
                <i class="fas fa-cog"></i>
              </button>
              <div class="column-settings" v-if="showImageColumnSettings">
                <div v-for="(visible, column) in visibleImageColumns" :key="column" class="column-option">
                  <input type="checkbox" :id="'img-' + column" v-model="visibleImageColumns[column]">
                  <label :for="'img-' + column">{{ columnLabels[column] }}</label>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="image-table-container">
          <div v-if="isGraphLoading" class="loading-overlay active">
            <div class="loading-spinner"></div>
            <div class="loading-text">이미지를 불러오는 중...</div>
          </div>
          <template v-else>
            <table v-if="selectedData.length > 0" class="image-table">
              <thead>
                <tr>
                  <th v-if="visibleImageColumns.date">날짜</th>
                  <th v-if="visibleImageColumns.item">Item</th>
                  <th v-if="visibleImageColumns.subitem">Subitem</th>
                  <th v-if="visibleImageColumns.value">값</th>
                  <th v-if="visibleImageColumns.status">상태</th>
                  <th v-if="visibleImageColumns.temperature">온도</th>
                  <th v-if="visibleImageColumns.humidity">습도</th>
                  <th v-if="visibleImageColumns.pressure">압력</th>
                  <th>이미지</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(data, index) in selectedData" 
                    :key="index"
                    :class="getStatusClass(data.flag)">
                  <td v-if="visibleImageColumns.date">{{ formatDate(data.date) }}</td>
                  <td v-if="visibleImageColumns.item">{{ data.item_id }}</td>
                  <td v-if="visibleImageColumns.subitem">{{ data.subitem_id }}</td>
                  <td v-if="visibleImageColumns.value">{{ data.value.toFixed(2) }}</td>
                  <td v-if="visibleImageColumns.status">
                    <span class="status-dot" :class="getStatusClass(data.flag)"></span>
                    <span class="status-text">{{ getStatusText(data.flag) }}</span>
                  </td>
                  <td v-if="visibleImageColumns.temperature">{{ (data.temperature || 0).toFixed(1) }}°C</td>
                  <td v-if="visibleImageColumns.humidity">{{ (data.humidity || 0).toFixed(1) }}%</td>
                  <td v-if="visibleImageColumns.pressure">{{ (data.pressure || 0).toFixed(1) }}hPa</td>
                  <td>
                    <div class="image-preview" @click="showImagePopup(data.image_url)">
                      <img :src="data.image_url" 
                           :alt="`${data.item_id}-${data.subitem_id}`"
                           class="thumbnail">
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-else class="no-data">
              이미지가 없습니다
            </div>
          </template>
        </div>
      </div>

      <!-- 이미지 팝업 -->
      <div class="image-popup" v-if="showPopup" @click="showPopup = false">
        <div class="popup-content" @click.stop>
          <button class="close-btn" @click="showPopup = false">&times;</button>
          <img :src="popupImageUrl" class="popup-image">
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import Plotly from 'plotly.js-dist-min'
import { useSide2AnalysisStore } from '@/stores/side2Analysis'

export default {
  name: 'Side2Analysis',
  setup() {
    const plotContainer = ref(null)
    const store = useSide2AnalysisStore()
    const showColumnSettings = ref(false)
    const showPopup = ref(false)
    const popupImageUrl = ref('')
    const showImageColumnSettings = ref(false)
    const isGraphLoading = ref(false)

    const visibleColumns = ref({
      date: true,
      item: true,
      subitem: true,
      value: true,
      status: true,
      temperature: true,
      humidity: true,
      pressure: true
    })

    const columnLabels = {
      date: '날짜',
      item: 'Item',
      subitem: 'Subitem',
      value: '값',
      status: '상태',
      temperature: '온도',
      humidity: '습도',
      pressure: '압력'
    }

    const visibleImageColumns = ref({
      date: true,
      item: true,
      subitem: true,
      value: true,
      status: true,
      temperature: true,
      humidity: true,
      pressure: true
    })

    // 날짜 포맷 함수
    const formatDate = (dateStr) => {
      const date = new Date(dateStr)
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
    }

    // 상태 클래스 반환 함수
    const getStatusClass = (flag) => {
      switch (flag) {
        case 1:
          return 'normal'
        case 0:
          return 'warning'
        case -1:
          return 'error'
        default:
          return ''
      }
    }

    // 상태 텍스트 반환 함수
    const getStatusText = (flag) => {
      switch (flag) {
        case 1:
          return '정상'
        case 0:
          return '경고'
        case -1:
          return '위험'
        default:
          return ''
      }
    }

    // 그래프 업데이트
    const updatePlot = () => {
      if (!store.plotData || !plotContainer.value) {
        console.log('Plot data or container not ready:', { plotData: store.plotData, container: plotContainer.value })
        return
      }

      isGraphLoading.value = true
      console.log('Graph loading started')

      const filteredData = store.filterDataByDateRange()
      if (!filteredData) {
        console.log('No filtered data available')
        isGraphLoading.value = false
        return
      }

      const traces = [
        ...filteredData.items.map(item => ({
          x: filteredData.dates,
          y: filteredData.values[item],
          type: 'scatter',
          mode: 'markers+lines',
          name: item,
          marker: { size: 8 },
          line: { width: 2 }
        }))
      ]

      const layout = {
        title: `분석 데이터 (최근 ${store.selectedDateRange}일)`,
        xaxis: {
          title: '날짜',
          gridcolor: '#eee'
        },
        yaxis: {
          title: '값',
          gridcolor: '#eee'
        },
        dragmode: 'select',
        selectdirection: 'any',
        showlegend: true,
        legend: {
          x: 0.02,
          xanchor: 'left',
          y: 1,
          yanchor: 'top',
          bgcolor: 'rgba(255, 255, 255, 0.8)',
          bordercolor: '#ddd',
          borderwidth: 1,
          font: {
            size: 12
          }
        },
        plot_bgcolor: 'white',
        paper_bgcolor: 'white',
        margin: {
          l: 50,
          r: 50,
          t: 50,
          b: 50
        },
        autosize: true
      }

      const config = {
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToAdd: ['select2d', 'lasso2d'],
        modeBarButtonsToRemove: ['zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d']
      }

      // 기존 그래프 제거
      if (plotContainer.value._fullLayout) {
        Plotly.purge(plotContainer.value)
      }

      // 새 그래프 그리기
      console.log('Starting plot render')
      Plotly.newPlot(plotContainer.value, traces, layout, config)
        .then(() => {
          console.log('Plot rendering completed')
          setTimeout(() => {
            isGraphLoading.value = false
          }, 100)
        })
        .catch(error => {
          console.error('Error rendering plot:', error)
          isGraphLoading.value = false
        })

      // 이벤트 핸들러 설정
      plotContainer.value.on('plotly_selected', (eventData) => {
        if (eventData && eventData.points && eventData.points.length > 0) {
          const selectedIds = eventData.points.map(point => 
            `${filteredData.items[point.curveNumber]}_${point.pointIndex}`
          )
          store.fetchSelectedData(selectedIds)
        } else {
          const allIds = filteredData.items.flatMap(item => 
            filteredData.dates.map((_, index) => `${item}_${index}`)
          )
          store.fetchSelectedData(allIds)
          Plotly.restyle(plotContainer.value, {
            selectedpoints: null
          })
        }
      })

      plotContainer.value.on('plotly_click', (eventData) => {
        if (!eventData.points || eventData.points.length === 0) {
          const allIds = filteredData.items.flatMap(item => 
            filteredData.dates.map((_, index) => `${item}_${index}`)
          )
          store.fetchSelectedData(allIds)
          Plotly.restyle(plotContainer.value, {
            selectedpoints: null
          })
        }
      })

      // 레전드 클릭 이벤트 처리
      plotContainer.value.on('plotly_legendclick', (eventData) => {
        const clickedItem = filteredData.items[eventData.curveNumber]
        const selectedIds = filteredData.dates.map((_, index) => 
          `${clickedItem}_${index}`
        )
        store.fetchSelectedData(selectedIds)
        return false
      })

      // 윈도우 리사이즈 이벤트 처리
      window.addEventListener('resize', () => {
        Plotly.Plots.resize(plotContainer.value)
      })
    }

    // 데이터 로드 후 그래프 업데이트
    const initializePlot = async () => {
      try {
        await store.fetchData()
        if (store.plotData) {
          updatePlot()
        }
      } catch (error) {
        console.error('Error loading data:', error)
      }
    }

    const showImagePopup = (imageUrl) => {
      popupImageUrl.value = imageUrl
      showPopup.value = true
    }

    onMounted(() => {
      // 페이지가 마운트되면 즉시 표시하고, 데이터 로드는 다음 틱에서 시작
      setTimeout(() => {
        initializePlot()
      }, 0)
    })

    return {
      plotContainer,
      selectedData: computed(() => store.selectedData),
      selectedDateRange: computed({
        get: () => store.selectedDateRange,
        set: (value) => {
          store.selectedDateRange = value
          updatePlot()
        }
      }),
      formatDate,
      updatePlot,
      showColumnSettings,
      visibleColumns,
      columnLabels,
      showPopup,
      popupImageUrl,
      showImagePopup,
      showImageColumnSettings,
      visibleImageColumns,
      getStatusClass,
      getStatusText,
      isGraphLoading,
      isImageLoading: computed(() => store.isImageLoading)
    }
  }
}
</script>

<style scoped>
.analysis-container {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
  opacity: 1;
  transition: opacity 0.3s ease;
  visibility: visible;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.controls {
  display: flex;
  gap: 20px;
  align-items: center;
}

.date-range-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.date-range-selector select {
  padding: 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  min-width: 100px;
}

.graph-container {
  flex: 1;
  min-height: 400px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 20px;
  display: flex;
}

.plot-wrapper {
  position: relative;
  flex: 1;
  width: 100%;
  height: 100%;
}

.plot-container {
  flex: 1;
  width: 100%;
  height: 100%;
}

.data-display {
  display: flex;
  gap: 20px;
  height: 300px;
}

.selected-data, .selected-images {
  flex: 1;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}

.panel-header {
  padding: 15px 20px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h3 {
  margin: 0;
  font-size: 1.1em;
}

.selected-count {
  font-size: 0.9em;
  color: #666;
}

.data-table-container {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9em;
}

.data-table th,
.data-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.data-table th {
  background-color: #f8f8f8;
  font-weight: 600;
  position: sticky;
  top: 0;
  z-index: 1;
  padding-top: 15px;
  padding-bottom: 15px;
}

.data-table tr:hover {
  background-color: #f5f5f5;
}

.data-table tr.warning {
  background-color: #fff8e1;
}

.data-table tr.error {
  background-color: #ffebee;
}

.data-table tr.normal {
  background-color: #e8f5e9;
}

.image-table-container {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.image-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9em;
}

.image-table th,
.image-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.image-table th {
  background-color: #f8f8f8;
  font-weight: 600;
  position: sticky;
  top: 0;
  z-index: 1;
  padding-top: 15px;
  padding-bottom: 15px;
}

.image-table tr:hover {
  background-color: #f5f5f5;
}

.image-preview {
  cursor: pointer;
  width: 100px;
  height: 100px;
  overflow: hidden;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.2s;
}

.thumbnail:hover {
  transform: scale(1.05);
}

.image-popup {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.popup-content {
  position: relative;
  width: 80%;
  height: 80%;
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.close-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 5px;
}

.close-btn:hover {
  color: #333;
}

.popup-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.no-data {
  text-align: center;
  color: #666;
  padding: 20px;
}

@media (max-width: 1200px) {
  .data-display {
    flex-direction: column;
    height: auto;
  }

  .selected-data, .selected-images {
    height: 300px;
  }
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 15px;
}

.column-control {
  position: relative;
}

.settings-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 5px;
  color: #666;
  font-size: 1.1em;
}

.settings-btn:hover {
  color: #333;
}

.column-settings {
  position: absolute;
  right: 0;
  top: 30px;
  background: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 100;
  min-width: 150px;
}

.column-option {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.column-option:last-child {
  margin-bottom: 0;
}

.status-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 8px;
}

.status-text {
  font-size: 0.9em;
  color: #666;
}

.status-dot.warning {
  background-color: #f0ad4e;
}

.status-dot.error {
  background-color: #d9534f;
}

.status-dot.normal {
  background-color: #5cb85c;
}

.image-table tr.warning {
  background-color: #fff8e1;
}

.image-table tr.error {
  background-color: #ffebee;
}

.image-table tr.normal {
  background-color: #e8f5e9;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.loading-overlay.active {
  opacity: 1;
  pointer-events: auto;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 5px solid #f3f3f3;
  border-top: 5px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 15px;
}

.loading-text {
  color: #333;
  font-size: 1.1em;
  font-weight: 500;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.graph-container,
.data-table-container,
.image-table-container {
  position: relative;
  min-height: 200px;
}
</style> 