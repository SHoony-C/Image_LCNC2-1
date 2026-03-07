<template>
  <div class="right-panel">
    <div class="panel-section">
      <div class="id-input-panel">
        <div class="usage-hint-shortcut">
          <i class="fas fa-keyboard"></i>
          <span>  단축키 정보: H</span>
        </div>
        <h5>ID 설정</h5>
        <div class="usage-hint">
          <i class="fas fa-info-circle"></i>
          <span>Ctrl, Shift, 드래그로 다중 선택</span>
        </div>
        <div class="id-input-container">
          <div class="input-group">
            <label>Item ID</label>
            <input type="text" :value="newItemId" @input="$emit('update:newItemId', $event.target.value)"
              class="form-control" placeholder="Item ID 입력">
          </div>
          <div class="input-group">
            <label>Sub ID</label>
            <input type="text" :value="newSubId" @input="$emit('update:newSubId', $event.target.value)"
              class="form-control" placeholder="Sub ID 입력 (예: s1)">
          </div>
        </div>
        <button class="btn-apply" @click="$emit('applySelectedIds')"
          :disabled="applyDisabled">
          선택한 행에 ID 적용
        </button>
      </div>

      <div v-if="measurementMode === 'defect'" class="circle-options-panel">
        <button class="circle-option-btn" :class="{ active: circleOptions.striation }"
          @click="$emit('toggleCircleOption', 'striation')">
          <i class="fas fa-circle-notch"></i><span>Striation</span>
        </button>
        <button class="circle-option-btn" :class="{ active: circleOptions.distortion }"
          @click="$emit('toggleCircleOption', 'distortion')">
          <i class="fas fa-circle-dot"></i><span>Distortion</span>
        </button>
      </div>

      <div class="control-group" v-if="selectedAreaRect">
        <button class="send-api-btn blinking-button" @click="$emit('sendSelectedAreaToApi')" :disabled="isApiSending">
          <i class="fas fa-search"></i>
          {{ isApiSending ? '감지 중...' : '선택 영역 불량 감지' }}
        </button>
      </div>

      <div class="results-panel">
        <div class="results-table-container">
          <!-- 일반 측정 테이블 -->
          <table class="results-table" v-if="measurementMode !== 'defect'">
            <thead>
              <tr><th>Item ID</th><th>Sub ID</th><th>값</th></tr>
            </thead>
            <tbody>
              <tr v-for="(segment, index) in filteredMeasurements" :key="segment.subItemId"
                :class="{ 'selected-row': selectedRows.includes(segment), 'total-measurement': segment.isTotal }"
                @mousedown="$emit('rowMouseDown', segment, index)"
                @mouseenter="$emit('rowMouseEnter', segment, index)"
                @mouseup="$emit('rowMouseUp')">
                <td>{{ segment.itemId }}</td>
                <td>{{ segment.subItemId }}</td>
                <td>{{ segment.value?.toFixed(2) }}</td>
                <td class="action-buttons">
                  <button class="option-btn" @click.stop="$emit('deleteSegment', segment)">
                    <i class="fas fa-trash"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- 불량 감지 테이블 -->
          <table class="results-table" v-else>
            <thead>
              <tr>
                <th>Item ID</th><th>Sub ID</th><th>Major Axis</th><th>Minor Axis</th>
                <th>Area ({{ scaleMethod === 'scaleBar' ? scaleBarUnit + '²' : 'px²' }})</th>
                <th v-if="circleOptions.striation">Striation (%)</th>
                <th v-if="circleOptions.distortion">Distortion (%)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(defect, index) in defectMeasurements" :key="defect.subItemId"
                :class="{ 'selected-row': selectedDefects.includes(defect) }"
                @mousedown="$emit('defectMouseDown', defect, index)"
                @mouseenter="$emit('defectMouseEnter', defect, index)"
                @mouseup="$emit('defectMouseUp')">
                <td>{{ defect.itemId }}</td>
                <td>{{ defect.subItemId }}</td>
                <td>{{ (defect.majorAxisScaled && !isNaN(defect.majorAxisScaled)) ? defect.majorAxisScaled.toFixed(2) : '0.00' }}</td>
                <td>{{ (defect.minorAxisScaled && !isNaN(defect.minorAxisScaled)) ? defect.minorAxisScaled.toFixed(2) : '0.00' }}</td>
                <td>{{ (defect.areaScaled && !isNaN(defect.areaScaled)) ? defect.areaScaled.toFixed(2) : '0.00' }}</td>
                <td v-if="circleOptions.striation">{{ ((defect.striation || 0) / 100).toFixed(1) }}%</td>
                <td v-if="circleOptions.distortion">{{ ((defect.distortion || 0) / 100).toFixed(1) }}%</td>
                <td class="action-buttons">
                  <button class="option-btn" @click.stop="$emit('deleteSegment', defect)">
                    <i class="fas fa-trash"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 통계 -->
        <div class="average-section" v-if="measurementMode !== 'defect' && filteredMeasurements.length > 0">
          <div class="stats-container">
            <div class="area-stats">
              <div class="stat-item">
                <span class="stat-label">평균:</span>
                <span class="stat-value">{{ currentAverage.toFixed(2) }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">3σ:</span>
                <span class="stat-value">{{ currentThreeSigma.toFixed(2) }}</span>
              </div>
            </div>
          </div>
          <button class="download-csv-btn" @click="$emit('downloadCSV')" title="측정 결과를 CSV 파일로 다운로드">
            <i class="fas fa-download"></i> CSV 다운로드
          </button>
        </div>

        <div class="results-bottom-bar">
          <div class="results-summary">
            <span>총 측정: {{ measurementMode === 'defect' ? defectMeasurements.length : filteredMeasurements.length }}</span>
          </div>
          <button class="save-measurements-btn" :class="{ 'shortcut-highlight': showShortcutHelp }"
            @click="$emit('showTableSelector')"
            :disabled="isSaving || (measurementMode === 'defect' ? defectMeasurements.length === 0 : filteredMeasurements.length === 0)">
            <i class="fas fa-save"></i>
            {{ isSaving ? '저장 중...' : '측정 결과 저장' }}
          </button>
        </div>
      </div>
    </div>

    <div class="measurement-controls">
      <div class="control-group">
        <label class="control-label">밝기 임계값: {{ brightnessThreshold }}</label>
        <input type="range" :value="brightnessThreshold"
          @input="$emit('update:brightnessThreshold', Number($event.target.value))"
          min="0" max="255" class="threshold-slider" />
        <button class="option-btn" @click="$emit('toggleReverse')">
          {{ isReversed ? '어두운 영역' : '밝은 영역' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'MSA6PopupResults',
  props: {
    measurementMode: { type: String, default: 'line' },
    newItemId: { type: String, default: '' },
    newSubId: { type: String, default: '' },
    circleOptions: { type: Object, default: () => ({ striation: false, distortion: false }) },
    selectedAreaRect: { type: Object, default: null },
    isApiSending: { type: Boolean, default: false },
    filteredMeasurements: { type: Array, default: () => [] },
    selectedRows: { type: Array, default: () => [] },
    defectMeasurements: { type: Array, default: () => [] },
    selectedDefects: { type: Array, default: () => [] },
    scaleMethod: { type: String, default: 'magnification' },
    scaleBarUnit: { type: String, default: 'nm' },
    currentAverage: { type: Number, default: 0 },
    currentThreeSigma: { type: Number, default: 0 },
    showShortcutHelp: { type: Boolean, default: false },
    isSaving: { type: Boolean, default: false },
    brightnessThreshold: { type: Number, default: 128 },
    isReversed: { type: Boolean, default: false },
    applyDisabled: { type: Boolean, default: true },
  },
  emits: [
    'update:newItemId', 'update:newSubId', 'update:brightnessThreshold',
    'applySelectedIds', 'toggleCircleOption', 'sendSelectedAreaToApi',
    'rowMouseDown', 'rowMouseEnter', 'rowMouseUp',
    'defectMouseDown', 'defectMouseEnter', 'defectMouseUp',
    'deleteSegment', 'downloadCSV', 'showTableSelector',
    'toggleReverse',
  ],
}
</script>

<style scoped>
</style>
