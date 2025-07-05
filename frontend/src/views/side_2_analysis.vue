<template>
  <div class="analysis-container">
    <!-- AppHeader 컴포넌트 추가 -->
    <AppHeader pageTitle="Analysis" />
    
    <div class="analysis-content">
      <div class="analysis-left-panel">
        <!-- 데이터 로드 컨트롤 섹션 -->
        <div class="control-section">
          <!-- 분석 타입 선택 추가 -->
          <div class="control-group">
            <label for="analysis-type-select">분석 타입:</label>
            <select 
              id="analysis-type-select"
              v-model="chartType" 
              class="analysis-type-select"
              :disabled="isLoading"
            >
              <option value="measurement">CD 분석</option>
              <option value="defect">불량 분석</option>
            </select>
          </div>
          
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
              <div v-if="dataLoadCompleted && ((loadedChartType === 'measurement' && chartData && chartData.points && chartData.points.length > 0) || (loadedChartType === 'defect' && defectChartData && defectChartData.points && defectChartData.points.length > 0))" class="legend-control">
                <!-- Y축 선택 드롭다운 (불량 분석일 때만 표시) -->
                <div v-if="loadedChartType === 'defect'" class="y-axis-control">
                  <label for="y-axis-select">Y축 값:</label>
                  <select 
                    id="y-axis-select"
                    v-model="selectedYAxis" 
                    class="y-axis-select-inline"
                  >
                    <option value="area">Area</option>
                    <option value="major_axis">Major Axis</option>
                    <option value="minor_axis">Minor Axis</option>
                    <option value="striated_ratio">Striation Ratio</option>
                    <option value="distorted_ratio">Distortion Ratio</option>
                  </select>
                </div>
                
                <div class="legend-control">
                  <label for="legend-select">Legend:</label>
                  <select 
                    id="legend-select"
                    v-model="legendType" 
                    class="legend-select-inline"
                  >
                    <option value="item_id">Item ID</option>
                    <option value="subitem_id">Sub Item ID</option>
                    <option value="combined">Item ID + Sub Item ID</option>
                  </select>
                </div>
              </div>
            </div>
            <div class="chart-content" ref="chartContainer">
              <!-- 그래프와 이미지를 나란히 배치 -->
              <div class="chart-with-images">
                <!-- 차트 영역 -->
                <div class="chart-area">
                  <!-- 계측 차트 -->
                  <svg v-if="dataLoadCompleted && loadedChartType === 'measurement' && chartData && chartData.points && chartData.points.length > 0" 
                      :width="width" :height="height" class="chart">
                    <!-- Grid Lines -->
                    <g class="grid-lines">
                      <line v-for="y in yGridLines" :key="'y-' + y"
                        :x1="dynamicMargin.left" :x2="width - dynamicMargin.right" :y1="y" :y2="y"
                        stroke="#eee" stroke-dasharray="2,2" />
                      <line v-for="x in xGridLines" :key="'x-' + x"
                        :x1="x" :x2="x" :y1="dynamicMargin.top" :y2="height - dynamicMargin.bottom"
                        stroke="#eee" stroke-dasharray="2,2" />
                    </g>
                    <!-- Y-axis labels -->
                    <g class="y-axis-labels">
                      <text v-for="(label, i) in yAxisLabels" :key="'y-label-' + i"
                        :x="dynamicMargin.left - 10" :y="label.y + 5"
                        fill="#666" text-anchor="end"
                        font-size="12">{{ label.value.toFixed(3) }}</text>
                    </g>
                    <!-- Data points -->
                    <g class="data-points">
                      <circle v-for="(point, index) in getVisiblePoints" :key="point.item_id + '-' + index"
                        :cx="point.x" :cy="point.y" r="4"
                        :fill="point.color"
                        stroke="white"
                        stroke-width="2"
                        :class="{ 
                          'selected-point': selectedPoint && isSameGroup(selectedPoint, point, legendType) && selectedPoint.lot_wafer === point.lot_wafer,
                          'highlighted-point': hoveredPoint && isSameGroup(hoveredPoint, point, legendType)
                        }"
                        @mouseover="hoveredPoint = point"
                        @mouseout="hoveredPoint = null"
                        @click="selectedPoint = point" />
                    </g>
                    <!-- Tooltip -->
                    <g v-if="displayPoint && hoveredPoint" class="tooltip"
                      :transform="'translate(' + (hoveredPoint.x + 10) + ',' + (hoveredPoint.y - 10) + ')'">
                      <rect x="0" y="0" width="180" height="100" rx="4"
                        fill="rgba(255,255,255,0.95)" stroke="#ddd" stroke-width="1" />
                      <text x="10" y="20" fill="#333" font-size="12" font-weight="600">
                        {{ hoveredPoint.item_id }} : {{ hoveredPoint.subitem_id }}
                      </text>
                      <text x="10" y="40" fill="#333" font-size="12">
                        {{ hoveredPoint.date }}
                      </text>
                      <text x="10" y="60" fill="#333" font-size="12">
                        Value: {{ hoveredPoint.value?.toFixed(3) || 'N/A' }}
                      </text>
                      <text x="10" y="80" fill="#333" font-size="12">
                        Lot Wafer: {{ hoveredPoint.lot_wafer || 'N/A' }}
                      </text>
                    </g>
                    <!-- Axes -->
                    <g class="axes">
                      <line :x1="dynamicMargin.left" :x2="width - dynamicMargin.right" 
                            :y1="height - dynamicMargin.bottom" :y2="height - dynamicMargin.bottom" 
                            stroke="#666" />
                      <line :x1="dynamicMargin.left" :y1="dynamicMargin.top" 
                            :x2="dynamicMargin.left" :y2="height - dynamicMargin.bottom" 
                            stroke="#666" />
                    </g>
                    <!-- X-axis Labels -->
                    <g class="x-axis-labels">
                      <text v-for="(label, i) in limitedLabels" :key="'label-' + i"
                        :x="getLabelX(i)" :y="height - dynamicMargin.bottom/2"
                        fill="#666" text-anchor="middle"
                        font-size="12">{{ label }}</text>
                    </g>
                    <!-- Legend -->
                    <g v-if="legendItems.length > 0" class="legend" :transform="'translate(' + (width - dynamicMargin.right + 10) + ', 20)'">
                      <rect x="0" y="0" :width="180" :height="legendItems.length * 25 + 10" 
                            fill="rgba(255,255,255,0.9)" stroke="#ddd" rx="4"/>
                      <g v-for="(item, i) in legendItems" :key="'legend-' + i">
                        <circle :cx="15" :cy="20 + i * 25" r="6" :fill="item.color" stroke="white" stroke-width="2"/>
                        <text :x="30" :y="25 + i * 25" fill="#333" font-size="12">{{ item.label }}</text>
                      </g>
                    </g>
                  </svg>
                  <!-- 불량 감지 차트 -->
                  <svg v-if="dataLoadCompleted && loadedChartType === 'defect' && defectChartData && defectChartData.points && defectChartData.points.length > 0" 
                      :width="width" :height="height" class="chart">
                    <!-- Grid Lines -->
                    <g class="grid-lines">
                      <line v-for="y in yGridLines" :key="'y-' + y"
                        :x1="dynamicMargin.left" :x2="width - dynamicMargin.right" :y1="y" :y2="y"
                        stroke="#eee" stroke-dasharray="2,2" />
                      <line v-for="x in xGridLines" :key="'x-' + x"
                        :x1="x" :x2="x" :y1="dynamicMargin.top" :y2="height - dynamicMargin.bottom"
                        stroke="#eee" stroke-dasharray="2,2" />
                    </g>
                    <!-- Y-axis labels -->
                    <g class="y-axis-labels">
                      <text v-for="(label, i) in yAxisLabels" :key="'y-label-' + i"
                        :x="dynamicMargin.left - 10" :y="label.y + 5"
                        fill="#666" text-anchor="end"
                        font-size="12">{{ label.value.toFixed(3) }}</text>
                    </g>
                    <!-- Y-axis title -->
                    <!-- <text :x="15" :y="height/2" 
                          fill="#666" text-anchor="middle"
                          font-size="12" font-weight="600"
                          transform="rotate(-90, 15, ${height/2})">{{ yAxisTitle }}</text> -->
                    
                    <!-- Data points -->
                    <g class="data-points">
                      <circle v-for="(point, index) in getVisibleDefectPoints" :key="point.item_id + '-' + index"
                        :cx="point.x" :cy="point.y" r="4"
                        :fill="point.color"
                        stroke="white"
                        stroke-width="2"
                        :class="{ 
                          'selected-point': selectedPoint && isSameGroup(selectedPoint, point, legendType) && selectedPoint.lot_wafer === point.lot_wafer,
                          'highlighted-point': hoveredPoint && isSameGroup(hoveredPoint, point, legendType)
                        }"
                        @mouseover="hoveredPoint = point"
                        @mouseout="hoveredPoint = null"
                        @click="selectedPoint = point" />
                    </g>
                    <!-- Tooltip -->
                    <g v-if="displayPoint && hoveredPoint" class="tooltip"
                      :transform="'translate(' + (hoveredPoint.x + 10) + ',' + (hoveredPoint.y - 10) + ')'">
                      <rect x="0" y="0" width="180" height="120" rx="4"
                        fill="rgba(255,255,255,0.95)" stroke="#ddd" stroke-width="1" />
                      <text x="10" y="20" fill="#333" font-size="12" font-weight="600">
                        {{ hoveredPoint.item_id }} : {{ hoveredPoint.subitem_id }}
                      </text>
                      <text x="10" y="40" fill="#333" font-size="12">
                        {{ hoveredPoint.date }}
                      </text>
                      <text x="10" y="60" fill="#333" font-size="12">
                        Area: {{ hoveredPoint.area?.toFixed(3) || 'N/A' }}
                      </text>
                      <text x="10" y="80" fill="#333" font-size="12">
                        Lot Wafer: {{ hoveredPoint.lot_wafer || 'N/A' }}
                      </text>
                      <text x="10" y="100" fill="#333" font-size="12">
                        Created: {{ hoveredPoint.created_at || 'N/A' }}
                      </text>
                    </g>
                    <!-- Axes -->
                    <g class="axes">
                      <line :x1="dynamicMargin.left" :x2="width - dynamicMargin.right" 
                            :y1="height - dynamicMargin.bottom" :y2="height - dynamicMargin.bottom" 
                            stroke="#666" />
                      <line :x1="dynamicMargin.left" :y1="dynamicMargin.top" 
                            :x2="dynamicMargin.left" :y2="height - dynamicMargin.bottom" 
                            stroke="#666" />
                    </g>
                    <!-- X-axis Labels -->
                    <g class="x-axis-labels">
                      <text v-for="(label, i) in limitedLabels" :key="'label-' + i"
                        :x="getLabelX(i)" :y="height - dynamicMargin.bottom/2"
                        fill="#666" text-anchor="middle"
                        font-size="12">{{ label }}</text>
                    </g>
                    <!-- Y-axis title -->
                    <!-- <text :x="15" :y="height/2" 
                          fill="#666" text-anchor="middle"
                          font-size="12" font-weight="600"
                          transform="rotate(-90, 15, ${height/2})">Area</text> -->
                    <!-- Legend -->
                    <g v-if="legendItems.length > 0" class="legend" :transform="'translate(' + (width - dynamicMargin.right + 10) + ', 20)'">
                      <rect x="0" y="0" :width="180" :height="legendItems.length * 25 + 10" 
                            fill="rgba(255,255,255,0.9)" stroke="#ddd" rx="4"/>
                      <g v-for="(item, i) in legendItems" :key="'legend-' + i">
                        <circle :cx="15" :cy="20 + i * 25" r="6" :fill="item.color" stroke="white" stroke-width="2"/>
                        <text :x="30" :y="25 + i * 25" fill="#333" font-size="12">{{ item.label }}</text>
                      </g>
                    </g>
                  </svg>
                  <div v-else class="loading-chart">
                    <template v-if="!dataLoadCompleted">
                      Data Load를 진행해주세요
                    </template>
                    <template v-else-if="loadedChartType === 'measurement' && (!chartData || !chartData.points || chartData.points.length === 0)">
                      선택된 조건에 대한 계측 데이터가 없습니다
                    </template>
                    <template v-else-if="loadedChartType === 'defect' && (!defectChartData || !defectChartData.points || defectChartData.points.length === 0)">
                      선택된 조건에 대한 불량 감지 데이터가 없습니다
                    </template>
                  </div>
                </div>
                
                <!-- 호버 이미지 표시 영역 -->
                <div v-if="displayPoint && dataLoadCompleted && ((loadedChartType === 'measurement') || (loadedChartType === 'defect'))" class="hover-images-section">
                  <div class="hover-images-header">
                    <h4>{{ displayPoint.lot_wafer || 'N/A' }}</h4>
                    <p class="hover-date">{{ displayPoint.date }}</p>
                  </div>
                  <div class="hover-images-container">
                    <div class="hover-image-item">
                      <label>전 이미지</label>
                      <img v-if="getImageUrl(displayPoint.lot_wafer, loadedTable, 'before')" 
                           :src="getImageUrl(displayPoint.lot_wafer, loadedTable, 'before')" 
                           :alt="`${displayPoint.lot_wafer}_before`" 
                           class="hover-image"
                           loading="lazy"
                           @error="handleImageError"
                           @load="handleImageLoad"
                           @click="showImagePopup({lot_wafer: displayPoint.lot_wafer, points: [displayPoint], imageType: 'before', analysisType: loadedChartType, imageUrl: getImageUrl(displayPoint.lot_wafer, loadedTable, 'before')})" />
                      <div v-else class="hover-image-placeholder">
                        전 이미지 없음
                      </div>
                    </div>
                    <div class="hover-image-item">
                      <label>후 이미지</label>
                      <img v-if="getImageUrl(displayPoint.lot_wafer, loadedTable, 'after')" 
                           :src="getImageUrl(displayPoint.lot_wafer, loadedTable, 'after')" 
                           :alt="`${displayPoint.lot_wafer}_after`" 
                           class="hover-image"
                           loading="lazy"
                           @error="handleImageError"
                           @load="handleImageLoad"
                           @click="showImagePopup({lot_wafer: displayPoint.lot_wafer, points: [displayPoint], imageType: 'after', analysisType: loadedChartType, imageUrl: getImageUrl(displayPoint.lot_wafer, loadedTable, 'after')})" />
                      <div v-else class="hover-image-placeholder">
                        후 이미지 없음
                      </div>
                    </div>
                  </div>
                  <!-- 호버 포인트 상세 정보 -->
                  <div class="hover-point-details">
                    <div v-if="loadedChartType === 'measurement'" class="measurement-details">
                      <div class="detail-item">
                        <span class="detail-label">Item ID:</span>
                        <span class="detail-value">{{ displayPoint.item_id || 'N/A' }}</span>
                      </div>
                      <div class="detail-item">
                        <span class="detail-label">Sub Item ID:</span>
                        <span class="detail-value">{{ displayPoint.subitem_id || 'N/A' }}</span>
                      </div>
                      <div class="detail-item">
                        <span class="detail-label">Value:</span>
                        <span class="detail-value">{{ displayPoint.value?.toFixed(3) || 'N/A' }}</span>
                      </div>
                    </div>
                    <div v-else-if="loadedChartType === 'defect'" class="defect-details">
                      <div class="detail-item">
                        <span class="detail-label">생성 시간:</span>
                        <span class="detail-value">{{ displayPoint.created_at || 'N/A' }}</span>
                      </div>
                      <div class="detail-item">
                        <span class="detail-label">Item ID:</span>
                        <span class="detail-value">{{ displayPoint.item_id || 'N/A' }}</span>
                      </div>
                      <div class="detail-item">
                        <span class="detail-label">Sub Item ID:</span>
                        <span class="detail-value">{{ displayPoint.subitem_id || 'N/A' }}</span>
                      </div>
                      <div class="detail-item">
                        <span class="detail-label">Area :</span>
                        <span class="detail-value">{{ (displayPoint.area && typeof displayPoint.area === 'number') ? displayPoint.area.toFixed(3) : 'N/A' }}</span>
                      </div>
                      <div class="detail-item">
                        <span class="detail-label">Major Axis:</span>
                        <span class="detail-value">{{ (displayPoint.major_axis && typeof displayPoint.major_axis === 'number') ? displayPoint.major_axis.toFixed(3) : 'N/A' }}</span>
                      </div>
                      <div class="detail-item">
                        <span class="detail-label">Minor Axis :</span>
                        <span class="detail-value">{{ (displayPoint.minor_axis && typeof displayPoint.minor_axis === 'number') ? displayPoint.minor_axis.toFixed(3) : 'N/A' }}</span>
                      </div>
                      <div class="detail-item">
                        <span class="detail-label">Striation Ratio :</span>
                        <span class="detail-value">{{ (displayPoint.striated_ratio && typeof displayPoint.striated_ratio === 'number') ? displayPoint.striated_ratio.toFixed(3) : 'N/A' }}</span>
                      </div>
                      <div class="detail-item">
                        <span class="detail-label">Distortion Ratio :</span>
                        <span class="detail-value">{{ (displayPoint.distorted_ratio && typeof displayPoint.distorted_ratio === 'number') ? displayPoint.distorted_ratio.toFixed(3) : 'N/A' }}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- 기본 안내 메시지 (호버하지 않은 상태) -->
                <div v-else class="hover-guide">
                  <div class="guide-content">
                    <div class="guide-icon">📊</div>
                    <h4>그래프 포인트에 마우스를 올려보세요</h4>
                    <p>데이터 포인트를 호버하면<br>해당 이미지와 상세 정보를 볼 수 있습니다</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 계측 데이터 테이블 -->
        <div v-if="loadedChartType === 'measurement'" class="data-container">
          <h3>계측 데이터</h3>
          <div v-if="dataLoadCompleted && loadedChartType === 'measurement' && chartData && chartData.points && chartData.points.length > 0" class="table-section scrollable-table">
            <table class="data-table">
              <thead class="table-header-sticky">
                <tr>
                  <th>날짜</th>
                  <th>테이블명</th>
                  <th>Lot Wafer</th>
                  <th>Item ID</th>
                  <th>Sub ID</th>
                  <th>사용자</th>
                  <th>값</th>
                  <th class="image-header">전 이미지</th>
                  <th class="image-header">후 이미지</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="(group, groupIndex) in Object.values(groupDataByLotWafer)">
                  <tr v-for="(point, index) in group.points" 
                      :key="'point-' + groupIndex + '-' + index"
                      :class="{ 
                        'group-row': true,
                        'group-start': index === 0,
                        'hovered': hoveredImage === group
                      }"
                      :data-lot-wafer="group.lot_wafer"
                      @mouseover="hoveredImage = group"
                      @mouseout="handleMouseOut">
                    <td>{{ point.date }}</td>
                    <td>{{ point.table_name || '-' }}</td>
                    <td>{{ point.lot_wafer || '-' }}</td>
                    <td>{{ point.item_id }}</td>
                    <td>{{ point.subitem_id }}</td>
                    <td>{{ point.username || '-' }}</td>
                    <td>{{ point.value ? point.value.toFixed(3) : '-' }}</td>
                    <td v-if="index === 0" :rowspan="group.points.length" class="image-cell sticky-image-cell">
                      <div class="sticky-image-container" :data-lot-wafer="group.lot_wafer">
                        <img v-if="getImageUrl(group.lot_wafer, loadedTable, 'before')" 
                             :src="getImageUrl(group.lot_wafer, loadedTable, 'before')" 
                             :alt="`${group.lot_wafer}_before`" 
                             class="table-image sticky-image"
                             loading="lazy"
                             @error="handleImageError"
                             @load="handleImageLoad"
                             @click="showImagePopup({...group, imageType: 'before', analysisType: 'measurement', imageUrl: getImageUrl(group.lot_wafer, loadedTable, 'before')})" />
                        <div v-else class="image-placeholder">
                          전 이미지 없음
                        </div>
                      </div>
                    </td>
                    <td v-if="index === 0" :rowspan="group.points.length" class="image-cell sticky-image-cell">
                      <div class="sticky-image-container" :data-lot-wafer="group.lot_wafer">
                        <img v-if="getImageUrl(group.lot_wafer, loadedTable, 'after')" 
                             :src="getImageUrl(group.lot_wafer, loadedTable, 'after')" 
                             :alt="`${group.lot_wafer}_after`" 
                             class="table-image sticky-image"
                             loading="lazy"
                             @error="handleImageError"
                             @load="handleImageLoad"
                             @click="showImagePopup({...group, imageType: 'after', analysisType: 'measurement', imageUrl: getImageUrl(group.lot_wafer, loadedTable, 'after')})" />
                        <div v-else class="image-placeholder">
                          후 이미지 없음
                        </div>
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
          <div v-else class="table-section">
            <div class="empty-data-message">
              <div class="empty-icon">📊</div>
              <h4 v-if="!dataLoadCompleted">Data Load를 진행해주세요</h4>
              <h4 v-else>선택된 조건에 대한 계측 데이터가 없습니다</h4>
              <p v-if="!dataLoadCompleted">분석 타입, 테이블, 날짜 범위를 설정한 후<br>Data Load 버튼을 클릭하세요</p>
              <p v-else>다른 조건으로 다시 검색해보세요</p>
            </div>
          </div>
        </div>

        <!-- 불량 감지 데이터 테이블 -->
        <div v-if="loadedChartType === 'defect'" class="data-container">
          <h3>불량 감지 데이터</h3>
          <div v-if="dataLoadCompleted && loadedChartType === 'defect' && defectChartData && defectChartData.points && defectChartData.points.length > 0" class="table-section scrollable-table">
            <table class="data-table">
              <thead class="table-header-sticky">
                <tr>
                  <th>날짜</th>
                  <th>Lot Wafer</th>
                  <th>Item ID</th>
                  <th>Sub ID</th>
                  <th>Area</th>
                  <th>Major Axis</th>
                  <th>Minor Axis</th>
                  <th>Striation Ratio</th>
                  <th>Distortion Ratio</th>
                  <th>Value</th>
                  <th class="image-header">전 이미지</th>
                  <th class="image-header">후 이미지</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="(group, groupIndex) in Object.values(groupDefectDataByLotWafer)">
                  <tr v-for="(point, index) in group.points" 
                      :key="'point-' + groupIndex + '-' + index"
                      :class="{ 
                        'group-row': true,
                        'group-start': index === 0,
                        'hovered': hoveredImage === group
                      }"
                      :data-lot-wafer="group.lot_wafer"
                      @mouseover="hoveredImage = group"
                      @mouseout="handleMouseOut">
                    <td>{{ point.date }}</td>
                    <td>{{ point.lot_wafer || '-' }}</td>
                    <td>{{ point.item_id }}</td>
                    <td>{{ point.subitem_id }}</td>
                    <td>{{ (point.area && typeof point.area === 'number') ? point.area.toFixed(3) : 'N/A' }}</td>
                    <td>{{ (point.major_axis && typeof point.major_axis === 'number') ? point.major_axis.toFixed(3) : 'N/A' }}</td>
                    <td>{{ (point.minor_axis && typeof point.minor_axis === 'number') ? point.minor_axis.toFixed(3) : 'N/A' }}</td>
                    <td>{{ (point.striated_ratio && typeof point.striated_ratio === 'number') ? point.striated_ratio.toFixed(3) : 'N/A' }}</td>
                    <td>{{ (point.distorted_ratio && typeof point.distorted_ratio === 'number') ? point.distorted_ratio.toFixed(3) : 'N/A' }}</td>
                    <td>{{ point.value?.toFixed(3) || 'N/A' }}</td>
                    <td v-if="index === 0" :rowspan="group.points.length" class="image-cell sticky-image-cell">
                      <div class="sticky-image-container" :data-lot-wafer="group.lot_wafer">
                        <img v-if="getImageUrl(group.lot_wafer, loadedTable, 'before')" 
                             :src="getImageUrl(group.lot_wafer, loadedTable, 'before')" 
                             :alt="`${group.lot_wafer}_before`" 
                             class="table-image sticky-image"
                             loading="lazy"
                             @error="handleImageError"
                             @load="handleImageLoad"
                             @click="showImagePopup({...group, imageType: 'before', analysisType: 'defect', imageUrl: getImageUrl(group.lot_wafer, loadedTable, 'before')})" />
                        <div v-else class="image-placeholder">
                          전 이미지 없음
                        </div>
                      </div>
                    </td>
                    <td v-if="index === 0" :rowspan="group.points.length" class="image-cell sticky-image-cell">
                      <div class="sticky-image-container" :data-lot-wafer="group.lot_wafer">
                        <img v-if="getImageUrl(group.lot_wafer, loadedTable, 'after')" 
                             :src="getImageUrl(group.lot_wafer, loadedTable, 'after')" 
                             :alt="`${group.lot_wafer}_after`" 
                             class="table-image sticky-image"
                             loading="lazy"
                             @error="handleImageError"
                             @load="handleImageLoad"
                             @click="showImagePopup({...group, imageType: 'after', analysisType: 'defect', imageUrl: getImageUrl(group.lot_wafer, loadedTable, 'after')})" />
                        <div v-else class="image-placeholder">
                          후 이미지 없음
                        </div>
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
          <div v-else class="table-section">
            <div class="empty-data-message">
              <div class="empty-icon">🔍</div>
              <h4 v-if="!dataLoadCompleted">Data Load를 진행해주세요</h4>
              <h4 v-else>선택된 조건에 대한 불량 감지 데이터가 없습니다</h4>
              <p v-if="!dataLoadCompleted">분석 타입, 테이블, 날짜 범위를 설정한 후<br>Data Load 버튼을 클릭하세요</p>
              <p v-else>다른 조건으로 다시 검색해보세요</p>
            </div>
          </div>
        </div>
        
        <!-- 데이터가 아직 로드되지 않았을 때 표시할 안내 영역 -->
        <div v-if="!dataLoadCompleted" class="data-container">
          <h3>{{ chartType === 'measurement' ? '계측 데이터' : '불량 감지 데이터' }}</h3>
          <div class="table-section">
            <div class="empty-data-message">
              <div class="empty-icon">{{ chartType === 'measurement' ? '📊' : '🔍' }}</div>
              <h4>Data Load를 진행해주세요</h4>
              <p>분석 타입, 테이블, 날짜 범위를 설정한 후<br>Data Load 버튼을 클릭하세요</p>
            </div>
          </div>
        </div>
      </div>
      
    </div>
    
    <!-- Image Popup -->
    <div v-if="selectedImage" class="image-popup" @click="closeImagePopup">
      <div class="popup-content" @click.stop>
        <button class="close-btn" @click="closeImagePopup">&times;</button>
        <div class="popup-image-section">
          <img :src="selectedImage.imageUrl" :alt="selectedImage.alt" />
          <div class="popup-image-info">
            <h4>{{ selectedImage.lot_wafer }}</h4>
            <p class="popup-image-type">{{ selectedImage.imageType === 'before' ? '전 이미지' : '후 이미지' }}</p>
            <p class="popup-date">{{ selectedImage.date || 'N/A' }}</p>
          </div>
        </div>
        <div class="popup-data-section">
          <h5>{{ selectedImage.analysisType === 'measurement' ? 'CD 분석 데이터' : '불량 감지 데이터' }}</h5>
          <div class="popup-data-list">
            <!-- CD 분석 데이터 -->
            <template v-if="selectedImage.analysisType === 'measurement'">
              <div v-for="point in selectedImage.points" 
                   :key="point.item_id + '-' + point.subitem_id + '-' + point.date"
                   class="popup-data-item cd-data-item">
                <div class="data-header">
                  <span class="data-date">{{ point.date }}</span>
                  <span class="data-user">{{ point.username || 'N/A' }}</span>
                </div>
                <div class="data-content">
                  <div class="data-row">
                    <span class="data-label">Item ID:</span>
                    <span class="data-value">{{ point.item_id || 'N/A' }}</span>
                  </div>
                  <div class="data-row">
                    <span class="data-label">Sub Item ID:</span>
                    <span class="data-value">{{ point.subitem_id || 'N/A' }}</span>
                  </div>
                  <div class="data-row">
                    <span class="data-label">Value:</span>
                    <span class="data-value highlight">{{ point.value?.toFixed(3) || 'N/A' }}</span>
                  </div>
                </div>
              </div>
            </template>
            
            <!-- 불량 감지 데이터 -->
            <template v-else-if="selectedImage.analysisType === 'defect'">
              <div v-for="point in selectedImage.points" 
                   :key="point.pk_id || point.item_id + '-' + point.subitem_id + '-' + point.date"
                   class="popup-data-item defect-data-item">
                <div class="data-header">
                  <span class="data-date">{{ point.date }}</span>
                  <span class="data-user">{{ point.username || 'N/A' }}</span>
                </div>
                <div class="data-content">
                  <div class="data-row">
                    <span class="data-label">Item ID:</span>
                    <span class="data-value">{{ point.item_id || 'N/A' }}</span>
                  </div>
                  <div class="data-row">
                    <span class="data-label">Sub Item ID:</span>
                    <span class="data-value">{{ point.subitem_id || 'N/A' }}</span>
                  </div>
                  <div class="data-section">
                    <h6>측정 데이터</h6>
                    <div class="data-grid">
                      <div class="data-row">
                        <span class="data-label">Area :</span>
                        <span class="data-value highlight">{{ (point.area && typeof point.area === 'number') ? point.area.toFixed(3) : 'N/A' }}</span>
                      </div>
                      <div class="data-row">
                        <span class="data-label">Major Axis:</span>
                        <span class="data-value">{{ (point.major_axis && typeof point.major_axis === 'number') ? point.major_axis.toFixed(3) : 'N/A' }}</span>
                      </div>
                      <div class="data-row">
                        <span class="data-label">Minor Axis:</span>
                        <span class="data-value">{{ (point.minor_axis && typeof point.minor_axis === 'number') ? point.minor_axis.toFixed(3) : 'N/A' }}</span>
                      </div>
                      <div class="data-row">
                        <span class="data-label">Striated Ratio:</span>
                        <span class="data-value">{{ (point.striated_ratio && typeof point.striated_ratio === 'number') ? point.striated_ratio.toFixed(3) : 'N/A' }}</span>
                      </div>
                      <div class="data-row">
                        <span class="data-label">Distorted Ratio:</span>
                        <span class="data-value">{{ (point.distorted_ratio && typeof point.distorted_ratio === 'number') ? point.distorted_ratio.toFixed(3) : 'N/A' }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed, watch, reactive, onUnmounted, nextTick } from 'vue'
import axios from 'axios'
import AppHeader from '@/components/AppHeader.vue'
import '@/assets/css/side2_analysis.css'
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
    const selectedYAxis = ref('area') // 기본값은 area
    
    // 레전드 유무에 따른 동적 margin 계산
    const dynamicMargin = computed(() => {
      const baseMargin = {
        top: 40,
        right: 40,
        bottom: 40,
        left: 60
      };
      
      // 레전드가 있을 때는 오른쪽 margin을 220px로 확장 (레전드 폭 180px + 여백 40px)
      if (legendItems.value && legendItems.value.length > 0) {
        return {
          ...baseMargin,
          right: 220
        };
      }
      
      return baseMargin;
    });

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
    const hoveredPoint = ref(null)
    const defectData = ref([])
    const measurementData = ref([])
    const images = ref([])
    const legendType = ref('item_id')
    
    // MSA3 and MSA4 component references
    const msa3Component = ref(null)
    const msa4Component = ref(null)
    
    // Method to handle image analysis request from MSA3
    const handleImageAnalysis = (imageData) => {
      // console.log('Received image analysis request from MSA3:', imageData)
      // Forward the analysis data from MSA3 to MSA4
      if (msa4Component.value) {
        msa4Component.value.analyzeImage(imageData)
      }
    }

    const setChartType = (type) => {
      chartType.value = type;
    }

    const yGridLines = computed(() => {
      if (!dataLoadCompleted.value) return []
      
      if (loadedChartType.value === 'measurement') {
        if (!chartData.value || !chartData.value.points || !chartData.value.points.length) return []
      } else if (loadedChartType.value === 'defect') {
        if (!defectChartData.value || !defectChartData.value.points || !defectChartData.value.points.length) return []
      } else {
        return []
      }
      const count = 5
      const step = (height.value - dynamicMargin.value.top - dynamicMargin.value.bottom) / count
      return Array(count + 1).fill().map((_, i) => dynamicMargin.value.top + i * step)
    })

    const xGridLines = computed(() => {
      if (!dataLoadCompleted.value) return []
      
      if (loadedChartType.value === 'measurement') {
        if (!chartData.value || !chartData.value.points || !chartData.value.points.length) return []
        
        // 고유한 날짜 목록 생성
        const uniqueDates = [...new Set(chartData.value.points.map(point => point.date))].sort()
        const dateCount = uniqueDates.length
        const step = (width.value - dynamicMargin.value.left - dynamicMargin.value.right) / Math.max(dateCount - 1, 1)
        return Array(dateCount).fill().map((_, i) => dynamicMargin.value.left + i * step)
        
      } else if (loadedChartType.value === 'defect') {
        if (!defectChartData.value || !defectChartData.value.points || !defectChartData.value.points.length) return []
        
        // 고유한 날짜 목록 생성
        const uniqueDates = [...new Set(defectChartData.value.points.map(point => point.created_at || point.date))].sort()
        const dateCount = uniqueDates.length
        const step = (width.value - dynamicMargin.value.left - dynamicMargin.value.right) / Math.max(dateCount - 1, 1)
        return Array(dateCount).fill().map((_, i) => dynamicMargin.value.left + i * step)
        
      } else {
        return []
      }
    })

    // Y축 라벨 계산
    const yAxisLabels = computed(() => {
      if (loadedChartType.value === 'measurement') {
        // 기존 계측 차트 로직 유지
        if (!chartData.value || !chartData.value.points || !chartData.value.points.length) return []
        
        const values = chartData.value.points.map(p => p.value).filter(v => v !== null && v !== undefined)
        if (values.length === 0) return []
        
        const minValue = Math.min(...values)
        const maxValue = Math.max(...values)
        const range = maxValue - minValue || 1
        const count = 5
        
        const labels = []
        for (let i = 0; i <= count; i++) {
          const value = minValue + (range * i / count)
          const y = height.value - dynamicMargin.value.bottom - ((value - minValue) / range) * (height.value - dynamicMargin.value.top - dynamicMargin.value.bottom)
          labels.push({ value, y })
        }
        
        return labels
      } else if (loadedChartType.value === 'defect') {
        // 불량 차트 로직 수정 - 선택된 Y축 값 사용
        if (!defectChartData.value || !defectChartData.value.points || !defectChartData.value.points.length) return []
        
        const values = defectChartData.value.points
          .map(p => p[selectedYAxis.value])
          .filter(v => v !== null && v !== undefined && typeof v === 'number')
        
        if (values.length === 0) return []
        
        const minValue = Math.min(...values)
        const maxValue = Math.max(...values)
        const range = maxValue - minValue || 1
        const count = 5
        
        const labels = []
        for (let i = 0; i <= count; i++) {
          const value = minValue + (range * i / count)
          const y = height.value - dynamicMargin.value.bottom - ((value - minValue) / range) * (height.value - dynamicMargin.value.top - dynamicMargin.value.bottom)
          labels.push({ value, y })
        }
        
        return labels
      }
      
      return []
    })

    const yAxisTitle = computed(() => {
      if (loadedChartType.value === 'measurement') {
        return 'Value'
      } else if (loadedChartType.value === 'defect') {
        // 선택된 Y축에 따라 제목 변경
        const titleMap = {
          'area': 'Area',
          'major_axis': 'Major Axis',
          'minor_axis': 'Minor Axis',
          'striated_ratio': 'Striation Ratio',
          'distorted_ratio': 'Distortion Ratio'
        }
        return titleMap[selectedYAxis.value] || 'Area'
      }
      return 'Value'
    })

    // 범례 아이템 계산
    const legendItems = computed(() => {
      if (loadedChartType.value === 'measurement') {
        if (!chartData.value || !chartData.value.points || !chartData.value.points.length) return []
        
        const items = new Map()
        
        chartData.value.points.forEach(point => {
          let key = ''
          let label = ''
          
          switch (legendType.value) {
            case 'item_id':
              key = point.item_id || 'Unknown'
              label = key
              break
            case 'subitem_id':
              key = point.subitem_id || 'Unknown'
              label = key
              break
            case 'combined':
              key = `${point.item_id || 'Unknown'}_${point.subitem_id || 'Unknown'}`
              label = `${point.item_id || 'Unknown'} + ${point.subitem_id || 'Unknown'}`
              break
          }
          
          if (!items.has(key)) {
            items.set(key, {
              label,
              color: point.color
            })
          }
        })
        
        return Array.from(items.values()).slice(0, 10) // 최대 10개 항목만 표시
      } else if (loadedChartType.value === 'defect') {
        if (!defectChartData.value || !defectChartData.value.points || !defectChartData.value.points.length) return []
        
        const items = new Map()
        
        defectChartData.value.points.forEach(point => {
          let key = ''
          let label = ''
          
          switch (legendType.value) {
            case 'item_id':
              key = point.item_id || 'Unknown'
              label = key
              break
            case 'subitem_id':
              key = point.subitem_id || 'Unknown'
              label = key
              break
            case 'combined':
              key = `${point.item_id || 'Unknown'}_${point.subitem_id || 'Unknown'}`
              label = `${point.item_id || 'Unknown'} + ${point.subitem_id || 'Unknown'}`
              break
          }
          
          if (!items.has(key)) {
            items.set(key, {
              label,
              color: point.color
            })
          }
        })
        
        return Array.from(items.values()).slice(0, 10) // 최대 10개 항목만 표시
      }
      
      return []
    })

    const getLinePath = (dataset) => {
      if (!dataset || !dataset.data || dataset.data.length === 0) {
        // console.log('No data for line path')
        return ''
      }
      
      const xStep = (width.value - margin.left - margin.right) / (dataset.data.length - 1)
      // 모든 데이터셋에서 y 값을 가져와서 최대값과 최소값을 계산
      const allValues = chartData.value.datasets.flatMap(d => d.data.map(point => point.y))
      // console.log('All y values:', allValues)
      
      const maxY = Math.max(...allValues)
      const minY = Math.min(...allValues)
      const yScale = (height.value - margin.top - margin.bottom) / ((maxY - minY) || 1)  // 0으로 나누는 것 방지
      
      // console.log(`Line path calculation - yScale: ${yScale}, minY: ${minY}, maxY: ${maxY}`)
      
      let path = ''
      dataset.data.forEach((point, i) => {
        const x = margin.left + i * xStep
        const y = height.value - margin.bottom - (point.y - minY) * yScale
        path += (i === 0 ? 'M' : 'L') + `${x},${y}`
      })
      
      // console.log(`Path for ${dataset.label}:`, path)
      return path
    }

    const getAllPoints = () => {
      if (!chartData.value || !chartData.value.points || !chartData.value.points.length) {
        // console.log('No chart data available for points')
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
      
      // console.log(`Generated ${points.length} data points`)
      return points
    }

    const limitedLabels = computed(() => {
      if (!dataLoadCompleted.value) return []
      
      if (loadedChartType.value === 'measurement') {
        if (!chartData.value || !chartData.value.points || !chartData.value.points.length) return []
        
        // 고유한 날짜 목록 생성 (시간순 정렬)
        const uniqueDates = [...new Set(chartData.value.points.map(point => point.date))].sort()
        const maxLabels = 6
        
        if (uniqueDates.length <= maxLabels) return uniqueDates
        
        const step = Math.ceil(uniqueDates.length / maxLabels)
        return uniqueDates.filter((_, index) => index % step === 0)
        
      } else if (loadedChartType.value === 'defect') {
        if (!defectChartData.value || !defectChartData.value.points || !defectChartData.value.points.length) return []
        
        // 고유한 날짜 목록 생성 (시간순 정렬) - created_at 기준
        const uniqueDates = [...new Set(defectChartData.value.points.map(point => point.created_at || point.date))].sort()
        const maxLabels = 6
        
        if (uniqueDates.length <= maxLabels) return uniqueDates
        
        const step = Math.ceil(uniqueDates.length / maxLabels)
        return uniqueDates.filter((_, index) => index % step === 0)
        
      } else {
        return []
      }
    })

    const getLabelX = (index) => {
      if (!dataLoadCompleted.value) return 0
      
      if (loadedChartType.value === 'measurement') {
        if (!chartData.value || !chartData.value.points || !chartData.value.points.length) return 0
        
        // 고유한 날짜 목록 생성
        const uniqueDates = [...new Set(chartData.value.points.map(point => point.date))].sort()
        const totalDates = uniqueDates.length
        const step = (width.value - dynamicMargin.value.left - dynamicMargin.value.right) / Math.max(totalDates - 1, 1)
        const labelStep = Math.ceil(totalDates / limitedLabels.value.length)
        return dynamicMargin.value.left + (index * labelStep) * step
        
      } else if (loadedChartType.value === 'defect') {
        if (!defectChartData.value || !defectChartData.value.points || !defectChartData.value.points.length) return 0
        
        // 고유한 날짜 목록 생성
        const uniqueDates = [...new Set(defectChartData.value.points.map(point => point.created_at || point.date))].sort()
        const totalDates = uniqueDates.length
        const step = (width.value - dynamicMargin.value.left - dynamicMargin.value.right) / Math.max(totalDates - 1, 1)
        const labelStep = Math.ceil(totalDates / limitedLabels.value.length)
        return dynamicMargin.value.left + (index * labelStep) * step
        
      } else {
        return 0
      }
    }

    const processChartData = () => {
      if (!measurementData.value || !measurementData.value.length) {
        chartData.value = null;
        return;
      }
      
      // 색상 팔레트 정의
      const colorPalette = [
        '#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336',
        '#607D8B', '#795548', '#3F51B5', '#009688', '#CDDC39',
        '#E91E63', '#FF5722', '#8BC34A', '#00BCD4', '#FFC107'
      ]
      
      // 측정 데이터에서 포인트 생성 및 색상 할당
      const colorMap = new Map()
      const points = measurementData.value.map((item, index) => {
        // value 값이 있으면 사용, 없으면 0으로 설정
        const value = item.value !== null && item.value !== undefined ? parseFloat(item.value) : 0
        
        if (isNaN(value)) {
          return null
        }
        
        // 범례 타입에 따라 색상 키 결정
        let colorKey = ''
        switch (legendType.value) {
          case 'item_id':
            colorKey = item.item_id || 'Unknown'
            break
          case 'subitem_id':
            colorKey = item.subitem_id || 'Unknown'
            break
          case 'combined':
            colorKey = `${item.item_id || 'Unknown'}_${item.subitem_id || 'Unknown'}`
            break
        }
        
        // 색상 할당
        if (!colorMap.has(colorKey)) {
          const colorIndex = colorMap.size % colorPalette.length
          colorMap.set(colorKey, colorPalette[colorIndex])
        }
        
        return {
          value,
          item_id: item.item_id,
          subitem_id: item.subitem_id,
          table_name: item.table_name,
          lot_wafer: item.lot_wafer,
          username: item.username,
          date: item.date,
          result: item.result,
          color: colorMap.get(colorKey),
          imageUrl: getImageUrl(item.lot_wafer, loadedTable.value, 'before')
        }
      }).filter(point => point !== null)
      
      if (points.length === 0) {
        chartData.value = null
        return
      }
      
      // 날짜순으로 정렬
      points.sort((a, b) => new Date(a.date) - new Date(b.date))
      
      const values = points.map(p => p.value)
      
      chartData.value = {
        points,
        minValue: Math.min(...values),
        maxValue: Math.max(...values)
      }
    }

    const processDefectData = () => {
      if (!defectData.value || !defectData.value.length) {
        defectChartData.value = null;
        return;
      }
      
      // 색상 팔레트 정의 (CD 분석과 동일)
      const colorPalette = [
        '#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336',
        '#607D8B', '#795548', '#3F51B5', '#009688', '#CDDC39',
        '#E91E63', '#FF5722', '#8BC34A', '#00BCD4', '#FFC107'
      ]
      
      // 색상 할당을 위한 맵
      const colorMap = new Map()
      
      const points = defectData.value.map(item => {
        const majorAxis = parseFloat(item.major_axis) || 0;
        const minorAxis = parseFloat(item.minor_axis) || 0;
        const area = parseFloat(item.area) || 0;
        const striatedRatio = parseFloat(item.striated_ratio) || 0;
        const distortedRatio = parseFloat(item.distorted_ratio) || 0;
        
        // 범례 타입에 따라 색상 키 결정
        let colorKey = ''
        switch (legendType.value) {
          case 'item_id':
            colorKey = item.item_id || 'Unknown'
            break
          case 'subitem_id':
            colorKey = item.subitem_id || 'Unknown'
            break
          case 'combined':
            colorKey = `${item.item_id || 'Unknown'}_${item.subitem_id || 'Unknown'}`
            break
        }
        
        // 색상 할당
        if (!colorMap.has(colorKey)) {
          const colorIndex = colorMap.size % colorPalette.length
          colorMap.set(colorKey, colorPalette[colorIndex])
        }
        
        return {
          pk_id: item.pk_id,
          item_id: item.item_id,
          subitem_id: item.subitem_id,
          lot_wafer: item.lot_wafer,
          table_name: item.table_name,
          username: item.username,
          date: item.date,
          created_at: item.created_at || item.date,
          major_axis: majorAxis,
          minor_axis: minorAxis,
          area: area,
          striated_ratio: striatedRatio,
          distorted_ratio: distortedRatio,
          value: area, // 기본값으로 area 사용
          is_bright: item.is_bright || false,
          is_striated: item.is_striated || false,
          is_distorted: item.is_distorted || false,
          color: colorMap.get(colorKey), // 동적 색상 할당
          imageUrl: getImageUrl(item.lot_wafer, loadedTable.value, 'before')
        };
      }).filter(point => point !== null);
      
      if (points.length === 0) {
        defectChartData.value = null;
        return;
      }
      
      // 시간순으로 정렬
      points.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      
      const areaValues = points.map(p => p.area).filter(v => typeof v === 'number');
      const majorAxisValues = points.map(p => p.major_axis).filter(v => typeof v === 'number');
      const minorAxisValues = points.map(p => p.minor_axis).filter(v => typeof v === 'number');
      const striatedRatioValues = points.map(p => p.striated_ratio).filter(v => typeof v === 'number');
      const distortedRatioValues = points.map(p => p.distorted_ratio).filter(v => typeof v === 'number');
      
      defectChartData.value = {
        points,
        minArea: areaValues.length ? Math.min(...areaValues) : 0,
        maxArea: areaValues.length ? Math.max(...areaValues) : 0,
        minMajorAxis: majorAxisValues.length ? Math.min(...majorAxisValues) : 0,
        maxMajorAxis: majorAxisValues.length ? Math.max(...majorAxisValues) : 0,
        minMinorAxis: minorAxisValues.length ? Math.min(...minorAxisValues) : 0,
        maxMinorAxis: minorAxisValues.length ? Math.max(...minorAxisValues) : 0,
        minStriatedRatio: striatedRatioValues.length ? Math.min(...striatedRatioValues) : 0,
        maxStriatedRatio: striatedRatioValues.length ? Math.max(...striatedRatioValues) : 0,
        minDistortedRatio: distortedRatioValues.length ? Math.min(...distortedRatioValues) : 0,
        maxDistortedRatio: distortedRatioValues.length ? Math.max(...distortedRatioValues) : 0
      };
    }

    // 테이블 선택 관련 변수 추가
    const selectedTable = ref('')
    const loadedTable = ref('') // 실제로 로드된 테이블명을 저장
    const authorizedTables = ref([]) // 예시 테이블 목록
    
    // 데이터 로드 완료 상태 추적
    const dataLoadCompleted = ref(false)
    const loadedChartType = ref('') // 실제로 로드된 차트 타입
    
    // 한국시간 기준으로 날짜 설정 (오늘부터 30일 전까지)
    const getKoreanDate = (daysOffset = 0) => {
      const now = new Date()
      // 한국시간 (UTC+9) 적용
      const koreanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000))
      const targetDate = new Date(koreanTime.getTime() + (daysOffset * 24 * 60 * 60 * 1000))
      return targetDate.toISOString().split('T')[0]
    }
    
    const dateFrom = ref(getKoreanDate(-30)) // 30일 전
    const dateTo = ref(getKoreanDate(0)) // 오늘
    const isLoading = ref(false)

    // 데이터 로드 가능 여부 확인
    const canLoadData = computed(() => {
      return selectedTable.value && dateFrom.value && dateTo.value
    })

    // 데이터 로드 함수
    const loadData = async () => {
      if (!canLoadData.value) return
      
      isLoading.value = true
      // 데이터 로드 시작 시 완료 상태 초기화
      dataLoadCompleted.value = false
      loadedChartType.value = ''
      
      try {
        await fetchData()
        // 데이터 로드 완료 후 상태 설정
        dataLoadCompleted.value = true
        loadedChartType.value = chartType.value
      } finally {
        isLoading.value = false
      }
    }

    const handleImageLoad = (event) => {
      // 이미지 로드 성공 시 상세 로깅
      const img = event.target;
      // console.log('이미지 로드 성공:', {
      //   src: img.src,
      //   naturalWidth: img.naturalWidth,
      //   naturalHeight: img.naturalHeight,
      //   width: img.width,
      //   height: img.height,
      //   complete: img.complete
      // });
      
      // 이미지가 실제로 로드되었는지 확인
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        console.warn('이미지가 로드되었지만 크기가 0입니다:', img.src);
        // 이미지 크기가 0이면 오류로 처리
        handleImageError(event);
        return;
      }
      
      // 이미지가 제대로 보이도록 스타일 설정
      img.style.display = 'block';
      img.style.opacity = '1';
      img.dataset.errorHandled = 'false'; // 오류 플래그 리셋
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
      
      // 상세한 오류 정보 로깅
      const img = event.target;
      console.warn('이미지 로드 실패:', {
        src: img.src,
        alt: img.alt,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        complete: img.complete,
        error: event.type
      });
      
      // 이미지를 숨기고 텍스트로 대체
      img.style.display = 'none';
      
      // 부모 요소에 텍스트 추가 (이미지 대신)
      const parent = img.parentElement;
      if (parent && !parent.querySelector('.image-placeholder')) {
        const placeholder = document.createElement('div');
        placeholder.className = 'image-placeholder';
        placeholder.textContent = '이미지 없음';
        placeholder.style.cssText = `
          width: 120px;
          height: 120px;
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


    // 이미지 URL 생성 함수 수정 - loadedChartType 기반으로 변경
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
      
      // 테이블명 결정 (파라미터로 받은 것 또는 로드된 테이블)
      const tableToUse = tableName || loadedTable.value;
      
      // 테이블명이 없으면 이미지 URL 생성하지 않음
      if (!tableToUse) {
        return '';
      }
      
      // 데이터가 로드되지 않았으면 빈 URL 반환
      if (!dataLoadCompleted.value) {
        return '';
      }
      
      // loadedChartType에 따라 다른 이미지 경로 사용 (chartType 대신 loadedChartType 사용)
      const imagePath = loadedChartType.value === 'measurement' ? 'cd_images' : 'defect_images';
      
      // 요구사항에 맞는 정확한 IIS URL 형식
      // 예시: http://localhost:8091/defect_images/a1/a_after.png
      const imageName = `${lotWafer}_${imageType}.png`;
      const finalUrl = `http://localhost:8091/${imagePath}/${tableToUse}/${imageName}`;
           
      return finalUrl;
    }

    // 테이블 목록 가져오기 개선 - 새로운 API 사용
    const fetchTables = async () => {
      try {
        // 현재 사용자 정보 가져오기
        const getCurrentUser = () => {
          const userInfo = localStorage.getItem('user');
          if (userInfo) {
            return JSON.parse(userInfo);
          }
          return { username: 'default_user' };
        };

        const user = getCurrentUser();
        
        // 사용자별 권한 테이블 조회 API 호출
        const response = await axios.get(`http://localhost:8000/api/side2/authorized-tables?username=${user.username}`)
        if (response.data.status === 'success' && response.data.data && Array.isArray(response.data.data)) {
          authorizedTables.value = response.data.data.filter(name => name && name.trim() !== '')
          // console.log('권한 있는 테이블 목록:', authorizedTables.value)
          // 권한이 있는 테이블이 없으면 test_result 추가
          if (authorizedTables.value.length === 0) {
            authorizedTables.value = ['test_result']
          }
        } else {
          throw new Error('Invalid response format')
        }
      } catch (error) {
        console.error('테이블 목록 로드 실패:', error)
        // 오류 발생 시 빈 배열로 설정
        authorizedTables.value = []
        // console.log('테이블 목록 조회 실패로 빈 배열 설정')
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
        
        // 현재 선택된 차트 타입에 따라 해당 API만 호출
        if (chartType.value === 'measurement') {
          const measurementUrl = `http://localhost:8000/api/side2/data${queryString ? '?' + queryString : ''}`;
          const measurementResponse = await axios.get(measurementUrl);
          
          if (measurementResponse.data.status === 'success') {
            measurementData.value = measurementResponse.data.data;
            images.value = measurementResponse.data.images ? measurementResponse.data.images.map(img => ({
              ...img,
              path: `http://127.0.0.1:8091/images/${img.filename}`
            })) : [];
            
            // 계측 데이터만 처리
            processChartData();
          }
          
          // 불량 데이터 초기화 (다른 타입의 데이터 제거)
          defectData.value = [];
          defectChartData.value = null;
          
        } else if (chartType.value === 'defect') {
          const defectUrl = `http://localhost:8000/api/side2/data_defect${queryString ? '?' + queryString : ''}`;
          const defectResponse = await axios.get(defectUrl);
          
          if (defectResponse.data.status === 'success') {
            defectData.value = defectResponse.data.data;
            
            // 불량 데이터만 처리
            processDefectData();
          }
          
          // 계측 데이터 초기화 (다른 타입의 데이터 제거)
          measurementData.value = [];
          chartData.value = null;
          images.value = [];
        }
        
        // 데이터 로드 성공 시에만 loadedTable 설정
        loadedTable.value = selectedTable.value;
        
      } catch (error) {
        console.error('Error fetching data:', error);
        // 오류 발생 시 모든 데이터 초기화
        measurementData.value = [];
        defectData.value = [];
        chartData.value = null;
        defectChartData.value = null;
        images.value = [];
      }
    }

    const getVisiblePoints = computed(() => {
      if (!chartData.value || !chartData.value.points || !chartData.value.points.length) {
        return [];
      }
      
      // 실제 그래프 영역 계산
      const plotWidth = width.value - dynamicMargin.value.left - dynamicMargin.value.right;
      const plotHeight = height.value - dynamicMargin.value.top - dynamicMargin.value.bottom;
      
      // 데이터 값 범위 계산
      const values = chartData.value.points.map(p => p.value).filter(v => v !== null && v !== undefined);
      if (values.length === 0) return [];
      
      const minValue = Math.min(...values);
      const maxValue = Math.max(...values);
      const valueRange = maxValue - minValue || 1; // 0으로 나누는 것 방지
      
      // 고유한 날짜 목록 생성 (시간순 정렬)
      const uniqueDates = [...new Set(chartData.value.points.map(p => p.date))].sort();
      const dateCount = uniqueDates.length;
      const xStep = dateCount > 1 ? plotWidth / (dateCount - 1) : 0;
      
      // 각 날짜에 대한 x축 위치 매핑
      const dateToXMap = {};
      uniqueDates.forEach((date, index) => {
        dateToXMap[date] = dynamicMargin.value.left + (index * xStep);
      });
      
      return chartData.value.points.map((point) => {
        const x = dateToXMap[point.date];
        const y = height.value - dynamicMargin.value.bottom - ((point.value - minValue) / valueRange) * plotHeight;
        
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

    const groupDataByLotWafer = computed(() => {
      // 데이터 로드가 완료되지 않았거나 현재 타입과 로드된 타입이 다르면 빈 객체 반환
      if (!dataLoadCompleted.value || loadedChartType.value !== 'measurement') {
        return {};
      }
      
      if (!chartData.value?.points) return {};
      
      const points = chartData.value.points;
      
      const grouped = {};
      points.forEach(point => {
        if (!grouped[point.lot_wafer]) {
          grouped[point.lot_wafer] = {
            lot_wafer: point.lot_wafer,
            points: [],
            imageUrl: point.imageUrl || getImageUrl(point.lot_wafer, loadedTable.value, 'before')
          };
        }
        grouped[point.lot_wafer].points.push(point);
      });
      
      return grouped;
    })

    const selectedImage = ref(null)
    const hoveredImage = ref(null)

    // 차트 데이터가 로드되면 첫 번째 그룹을 기본으로 선택
    watch(groupDataByLotWafer, (groups) => {
      const groupValues = Object.values(groups);
      if (groupValues.length > 0 && !hoveredImage.value) {
        hoveredImage.value = groupValues[0];
      }
    }, { immediate: true })

    watch(selectedYAxis, () => {
      if (defectData.value && defectData.value.length > 0 && dataLoadCompleted.value && loadedChartType.value === 'defect') {
        // Y축 변경 시 차트 포인트만 재계산 (전체 데이터 재처리 불필요)
        // getVisibleDefectPoints와 yAxisLabels가 computed이므로 자동으로 업데이트됨
      }
    })

    const showImagePopup = (image) => {
      // 분석 타입에 따라 날짜 결정
      let displayDate = 'N/A';
      if (image.points && image.points.length > 0) {
        const firstPoint = image.points[0];
        if (image.analysisType === 'measurement') {
          displayDate = firstPoint.date || 'N/A';
        } else if (image.analysisType === 'defect') {
          displayDate = firstPoint.created_at || firstPoint.date || 'N/A';
        }
      }
      
      selectedImage.value = {
        ...image,
        alt: `${image.lot_wafer}_${image.imageType}`,
        date: displayDate
      };
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
      
      const plotWidth = width.value - dynamicMargin.value.left - dynamicMargin.value.right;
      const plotHeight = height.value - dynamicMargin.value.top - dynamicMargin.value.bottom;
      
      // 고유한 날짜 목록 생성 (시간순 정렬) - created_at 기준
      const uniqueDates = [...new Set(defectChartData.value.points.map(p => p.created_at || p.date))].sort();
      const dateCount = uniqueDates.length;
      const xStep = dateCount > 1 ? plotWidth / (dateCount - 1) : 0;
      
      // 각 날짜에 대한 x축 위치 매핑
      const dateToXMap = {};
      uniqueDates.forEach((date, index) => {
        dateToXMap[date] = dynamicMargin.value.left + (index * xStep);
      });
      
      // 선택된 Y축 값의 범위 계산 (동적으로 변경)
      const values = defectChartData.value.points
        .map(p => p[selectedYAxis.value])
        .filter(v => v !== null && v !== undefined && typeof v === 'number');
      
      if (values.length === 0) return [];
      
      const minValue = Math.min(...values);
      const maxValue = Math.max(...values);
      const valueRange = maxValue - minValue || 1;
      
      return defectChartData.value.points.map((point) => {
        const x = dateToXMap[point.created_at || point.date];
        const yValue = point[selectedYAxis.value];
        const y = typeof yValue === 'number' 
          ? height.value - dynamicMargin.value.bottom - ((yValue - minValue) / valueRange) * plotHeight
          : height.value - dynamicMargin.value.bottom;
        
        return {
          ...point,
          x,
          y
        };
      });
    });

    const groupDefectDataByLotWafer = computed(() => {
      // 데이터 로드가 완료되지 않았거나 현재 타입과 로드된 타입이 다르면 빈 객체 반환
      if (!dataLoadCompleted.value || loadedChartType.value !== 'defect') {
        return {};
      }
      
      if (!defectChartData.value?.points) return {};
      
      const points = defectChartData.value.points;
      
      const grouped = {};
      points.forEach(point => {
        if (!grouped[point.lot_wafer]) {
          grouped[point.lot_wafer] = {
            lot_wafer: point.lot_wafer,
            points: [],
            imageUrl: point.imageUrl || getImageUrl(point.lot_wafer, loadedTable.value, 'before')
          };
        }
        grouped[point.lot_wafer].points.push(point);
      });
      
      return grouped;
    });

    // 표시할 포인트 결정: 호버된 포인트가 있으면 호버된 포인트, 없으면 선택된 포인트
    const displayPoint = computed(() => {
      return hoveredPoint.value || selectedPoint.value;
    });

    // 범례 타입 변경 시 차트 데이터 재처리 (Data Load 없이 색상만 업데이트)
    watch(legendType, () => {
      if (measurementData.value && measurementData.value.length > 0 && dataLoadCompleted.value && loadedChartType.value === 'measurement') {
        processChartData();
      }
      if (defectData.value && defectData.value.length > 0 && dataLoadCompleted.value && loadedChartType.value === 'defect') {
        processDefectData();
      }
    });

    // 분석 타입 변경 시 데이터 로드 상태는 유지하고, UI만 조건부로 표시
    // (데이터 초기화 제거 - 기존 데이터는 유지하되 현재 선택된 타입과 로드된 타입이 다르면 UI에서 숨김)
    
    // 테이블 선택, 날짜 범위 변경 시 자동 데이터 로드 제거 (주석 처리)
    /*
    watch([selectedTable, dateFrom, dateTo], ([newTable, newDateFrom, newDateTo], [oldTable, oldDateFrom, oldDateTo]) => {
      // 초기 로드 시에는 실행하지 않음 (모든 값이 undefined에서 설정되는 경우)
      if (oldTable === undefined && oldDateFrom === undefined && oldDateTo === undefined) {
        return;
      }
      
      // 값이 변경되고 모든 필수 값이 있으면 자동 로드
      if (newTable && newDateFrom && newDateTo) {
        console.log('Auto loading data due to parameter change:', {
          table: newTable,
          dateFrom: newDateFrom,
          dateTo: newDateTo
        });
        loadData();
      }
    }, { immediate: false });
    */

    // 컴포넌트 마운트 시 초기 데이터 로드
    onMounted(async () => {
      // DOM이 완전히 렌더링될 때까지 대기
      await nextTick();
      
      if (chartContainer.value) {
        // 초기 차트 크기 설정
        handleResize();
        
        // ResizeObserver를 사용해서 차트 컨테이너 크기 변경 감지
        const resizeObserver = new ResizeObserver((entries) => {
          // 컴포넌트가 언마운트되었거나 chartContainer가 null인 경우 처리하지 않음
          if (!chartContainer.value) {
            return;
          }
          
          // 디바운싱을 위한 지연 처리
          if (chartContainer.value._resizeTimeout) {
            clearTimeout(chartContainer.value._resizeTimeout);
          }
          
          chartContainer.value._resizeTimeout = setTimeout(() => {
            // 타이머 실행 시에도 다시 한번 확인
            if (chartContainer.value) {
              handleResize();
            }
          }, 100);
        });
        resizeObserver.observe(chartContainer.value);
        
        // cleanup을 위해 observer 저장
        chartContainer.value._resizeObserver = resizeObserver;
      }
      
      // 테이블 목록을 먼저 가져온 후 기본 테이블만 선택 (데이터 로드는 하지 않음)
      fetchTables().then(() => {
        // 기본 테이블이 있으면 선택
        if (authorizedTables.value.length > 0) {
          selectedTable.value = authorizedTables.value[0];
          // console.log('기본 테이블 선택:', selectedTable.value);
        }
        // fetchData() 제거 - 버튼을 통해서만 데이터 로드하도록 수정
      });
      
      // 창 크기 변경 시 차트 크기 조정 (backup)
      window.addEventListener('resize', handleResize);
      
      // 스크롤 이벤트 리스너 추가
      setupScrollHandlers();
    });

    // 스크롤 핸들러 설정
    const setupScrollHandlers = () => {
      // console.log('setupScrollHandlers 호출됨');
      
      // 스크롤 가능한 테이블 섹션들에 이벤트 리스너 추가
      const observeScrollableTable = () => {
        const scrollableTables = document.querySelectorAll('.scrollable-table');
        // console.log('찾은 scrollable-table 개수:', scrollableTables.length);
        
        scrollableTables.forEach((table, index) => {
          // console.log(`테이블 ${index} 이벤트 리스너 설정:`, table.className);
          // 기존 이벤트 리스너 제거 (중복 방지)
          table.removeEventListener('scroll', handleTableScroll);
          // 새 이벤트 리스너 추가
          table.addEventListener('scroll', handleTableScroll, { passive: true });
          
          // 초기 sticky 상태 설정
          setTimeout(() => {
            // console.log(`테이블 ${index} 초기 sticky 설정 시도`);
            updateStickyVisualFeedback(table, table.scrollTop);
          }, 100);
        });
      };
      
      // DOM 업데이트 후 이벤트 리스너 추가
      nextTick(() => {
        // console.log('nextTick에서 스크롤 핸들러 설정');
        observeScrollableTable();
      });
      
      // chartType 변경 시 스크롤 핸들러만 재설정 (데이터는 변경하지 않음)
      watch(chartType, () => {
        // console.log('chartType 변경됨, 스크롤 핸들러 재설정');
        nextTick(() => {
          observeScrollableTable();
        });
      });
      
      // 데이터 로드 완료 후에도 핸들러 재설정
      watch(dataLoadCompleted, (newVal) => {
        if (newVal) {
          // console.log('데이터 로드 완료, 스크롤 핸들러 재설정');
          nextTick(() => {
            observeScrollableTable();
          });
        }
      });
    };

    // 테이블 스크롤 핸들러
    const handleTableScroll = (event) => {
      // console.log('스크롤 이벤트 발생!', event.target.className);
      
      const scrollContainer = event.target;
      const scrollTop = scrollContainer.scrollTop;
      
      // 스크롤 성능 최적화를 위한 throttling
      if (scrollContainer._scrollTimeout) {
        clearTimeout(scrollContainer._scrollTimeout);
      }
      
      scrollContainer._scrollTimeout = setTimeout(() => {
        // console.log('스크롤 처리 시작, scrollTop:', scrollTop);
        // CSS sticky가 적용되므로 단순한 시각적 피드백만 추가
        updateStickyVisualFeedback(scrollContainer, scrollTop);
      }, 16); // 60fps
    };

    // sticky 시각적 피드백 업데이트 (마지막 row 개선)
    const updateStickyVisualFeedback = (scrollContainer, scrollTop) => {
      // console.log('updateStickyVisualFeedback 함수 호출됨', scrollTop);
      
      const stickyImages = scrollContainer.querySelectorAll('.sticky-image-container');
      // console.log('찾은 sticky 이미지 개수:', stickyImages.length);
      
      if (stickyImages.length === 0) {
        // console.log('sticky 이미지가 없음 - 함수 종료');
        return;
      }
      
      const headerHeight = 60;
      const containerRect = scrollContainer.getBoundingClientRect();
      const containerHeight = containerRect.height;
      
      // 모든 lot_wafer 그룹 식별
      const allLotWafers = Array.from(stickyImages).map(img => img.dataset.lotWafer);
      const uniqueLotWafers = [...new Set(allLotWafers)];
      // console.log('모든 그룹:', uniqueLotWafers);
      
      // 마지막 그룹 식별 (DOM 순서 기준)
      let lastGroupLotWafer = null;
      if (uniqueLotWafers.length > 0) {
        const lastImageContainer = stickyImages[stickyImages.length - 1];
        lastGroupLotWafer = lastImageContainer?.dataset.lotWafer;
        // console.log('마지막 그룹 식별:', lastGroupLotWafer);
      }
      
      stickyImages.forEach((imageContainer, index) => {
        const lotWafer = imageContainer.dataset.lotWafer;
        const isLastGroup = lotWafer === lastGroupLotWafer;
        
        // 마지막 그룹 표시 - CSS 클래스로 확실히 적용
        if (isLastGroup) {
          imageContainer.classList.add('last-group');
          // console.log(`마지막 그룹 설정: ${lotWafer} (인덱스: ${index})`);
          
          // 마지막 그룹에 강제로 sticky 스타일 적용
          imageContainer.style.position = 'sticky';
          imageContainer.style.top = '60px';
          imageContainer.style.zIndex = '16';
          imageContainer.style.transform = 'none';
          imageContainer.style.backgroundColor = 'white';
          imageContainer.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
          imageContainer.classList.add('is-sticky');
        } else {
          imageContainer.classList.remove('last-group');
        }
        
        // 해당 lot_wafer의 모든 행 찾기
        const relatedRows = scrollContainer.querySelectorAll(`tr[data-lot-wafer="${lotWafer}"]`);
        
        if (relatedRows.length === 0) return;
        
        // 첫 번째와 마지막 행의 위치 계산
        const firstRow = relatedRows[0];
        const lastRow = relatedRows[relatedRows.length - 1];
        const firstRowRect = firstRow.getBoundingClientRect();
        const lastRowRect = lastRow.getBoundingClientRect();
        
        // 그룹의 상단과 하단 위치 (스크롤 컨테이너 기준)
        const groupTop = firstRowRect.top - containerRect.top + scrollTop;
        const groupBottom = lastRowRect.bottom - containerRect.top + scrollTop;
        
        // 현재 보이는 영역
        const visibleTop = scrollTop + headerHeight;
        const visibleBottom = scrollTop + containerHeight;
        
        // sticky 상태 판단 및 처리
        const isGroupVisible = groupBottom >= visibleTop && groupTop <= visibleBottom;
        const isGroupStartAboveView = groupTop < visibleTop;
        
        if (!isGroupVisible) {
          // 그룹이 완전히 화면 밖에 있음
          if (!isLastGroup) {
            imageContainer.classList.remove('is-sticky');
            imageContainer.style.position = '';
            imageContainer.style.top = '';
            imageContainer.style.transform = '';
          }
          return;
        }
        
        if (isGroupStartAboveView) {
          // 그룹의 시작이 화면 위에 있음 - sticky 상태
          imageContainer.classList.add('is-sticky');
          
          // 마지막 그룹은 항상 sticky 상태 유지
          if (isLastGroup) {
            // console.log(`마지막 그룹 sticky 활성화: ${lotWafer}`);
            // 이미 위에서 스타일 적용했으므로 추가 처리 없음
          } else {
            // 일반 그룹 처리
            const imageHeight = 140;
            const availableSpace = groupBottom - visibleTop;
            
            if (availableSpace >= imageHeight) {
              // 충분한 공간이 있으면 sticky 유지
              imageContainer.style.position = 'sticky';
              imageContainer.style.top = `${headerHeight}px`;
              imageContainer.style.zIndex = '15';
              imageContainer.style.transform = 'none';
            } else {
              // 공간이 부족하면 그룹 끝에 맞춰 위치 조정
              imageContainer.classList.remove('is-sticky');
              imageContainer.style.position = '';
              imageContainer.style.top = '';
              imageContainer.style.transform = '';
            }
          }
        } else {
          // 그룹이 정상적으로 보이는 상태
          // 마지막 그룹이 아닌 경우에만 sticky 해제
          if (!isLastGroup) {
            imageContainer.classList.remove('is-sticky');
            imageContainer.style.position = '';
            imageContainer.style.top = '';
            imageContainer.style.transform = '';
          }
        }
      });
    };

    // 컴포넌트 언마운트 시 이벤트 리스너 제거
    onUnmounted(() => {
      window.removeEventListener('resize', handleResize);
      
      // ResizeObserver cleanup
      if (chartContainer.value) {
        if (chartContainer.value._resizeObserver) {
          chartContainer.value._resizeObserver.disconnect();
          chartContainer.value._resizeObserver = null;
        }
        
        // 타이머 cleanup
        if (chartContainer.value._resizeTimeout) {
          clearTimeout(chartContainer.value._resizeTimeout);
          chartContainer.value._resizeTimeout = null;
        }
      }
      
      // 스크롤 이벤트 리스너 제거 및 타이머 정리
      const scrollableTables = document.querySelectorAll('.scrollable-table');
      scrollableTables.forEach(table => {
        table.removeEventListener('scroll', handleTableScroll);
        // 스크롤 타이머 정리
        if (table._scrollTimeout) {
          clearTimeout(table._scrollTimeout);
          table._scrollTimeout = null;
        }
      });
    });

    // 창 크기 변경 핸들러 개선 - 차트가 잘리지 않도록 정확한 크기 계산
    const handleResize = () => {
      // chartContainer가 존재하고 DOM에 마운트되어 있는지 확인
      if (!chartContainer.value || !chartContainer.value.isConnected) {
        return;
      }
      
      try {
        // chart-area 요소를 찾아서 실제 사용 가능한 공간 계산
        const chartArea = chartContainer.value.querySelector('.chart-area');
        if (!chartArea) {
          // chart-area가 없으면 기존 방식 사용
          const rect = chartContainer.value.getBoundingClientRect();
          const containerWidth = rect.width;
          const containerHeight = rect.height;
          
          if (containerWidth <= 0 || containerHeight <= 0) {
            return;
          }
          
          const availableWidth = Math.max(300, containerWidth - 60);
          const availableHeight = Math.max(250, containerHeight - 40);
          
          width.value = availableWidth;
          height.value = Math.min(availableHeight, availableWidth * 0.6);
          return;
        }
        
        // chart-area의 실제 크기 계산
        const rect = chartArea.getBoundingClientRect();
        const areaWidth = rect.width;
        const areaHeight = rect.height;
        
        // 유효한 크기인지 확인
        if (areaWidth <= 0 || areaHeight <= 0) {
          return;
        }
        
        // 패딩과 여백을 고려한 차트 크기 계산
        const availableWidth = Math.max(300, areaWidth - 40); // 좌우 여백 20px씩
        const availableHeight = Math.max(250, areaHeight - 40); // 상하 여백 20px씩
        
        // 차트 크기 설정 - chart-area에 맞춰 동적 조정
        width.value = availableWidth;
        height.value = Math.min(availableHeight, availableWidth * 0.6); // 적절한 비율 유지
        
        // console.log(`Chart resized: ${width.value}x${height.value} (chart-area: ${areaWidth}x${areaHeight})`);
      } catch (error) {
        console.warn('Chart resize failed:', error);
      }
    };

    // 선택된 점과 같은 그룹인지 판단하는 함수 추가
    const isSameGroup = (point1, point2, currentLegendType) => {
      if (!point1 || !point2) return false;
      
      switch (currentLegendType) {
        case 'item_id':
          return point1.item_id === point2.item_id;
        case 'subitem_id':
          return point1.subitem_id === point2.subitem_id;
        case 'combined':
          return point1.item_id === point2.item_id && point1.subitem_id === point2.subitem_id;
        default:
          return point1.item_id === point2.item_id;
      }
    }

    return {
      chartType,
      chartData,
      defectChartData,
      width,
      height,
      margin,
      dynamicMargin,
      yGridLines,
      xGridLines,
      getLinePath,
      getLabelX,
      limitedLabels,
      getAllPoints,
      setChartType,
      chartContainer,
      selectedPoint,
      hoveredPoint,
      getStatusClass,
      getStatusText,
      groupDataByLotWafer,
      selectedImage,
      showImagePopup,
      closeImagePopup,
      getVisiblePoints,
      handleImageError,
      handleImageLoad,
      hoveredImage,
      handleDragEnter,
      handleDrop,
      handleMouseOut,
      defectData,
      measurementData,
      images,
      onMouseover,
      getVisibleDefectPoints,
      groupDefectDataByLotWafer,
      displayPoint,
      handleResize,
      msa3Component,
      msa4Component,
      handleImageAnalysis,
      getImageUrl,
      fetchData,
      selectedTable,
      loadedTable,
      authorizedTables,
      dateFrom,
      dateTo,
      isLoading,
      canLoadData,
      loadData,
      fetchTables,
      setupScrollHandlers,
      handleTableScroll,
      updateStickyVisualFeedback,
      yAxisLabels,
      legendItems,
      legendType,
      dataLoadCompleted,
      loadedChartType,
      isSameGroup,
      selectedYAxis,
      yAxisTitle
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

/* 강조된 포인트 스타일 추가 */
.highlighted-point {
  stroke: #ff6b35 !important;
  stroke-width: 3px !important;
  filter: drop-shadow(0 0 8px rgba(255, 107, 53, 0.6));
  transition: all 0.2s ease;
}

.selected-point {
  stroke: #2196F3 !important;
  stroke-width: 3px !important;
  filter: drop-shadow(0 0 8px rgba(33, 150, 243, 0.6));
}

</style> 