msa6 popup에 추가





deleteSegment(segment) {
  // segmentedMeasurements에서 해당 segment 삭제
  const idx = this.segmentedMeasurements.indexOf(segment);
  if (idx !== -1) {
    this.segmentedMeasurements.splice(idx, 1);
  }
  // localMeasurements에서도 삭제(필요시)
  const idx2 = this.localMeasurements.indexOf(segment);
  if (idx2 !== -1) {
    this.localMeasurements.splice(idx2, 1);
  }
  // defectMeasurements에서도 삭제
  const idx3 = this.defectMeasurements.indexOf(segment);
  if (idx3 !== -1) {
    this.defectMeasurements.splice(idx3, 1);
  }
  // 선택된 행에서도 삭제
  const selIdx = this.selectedRows.indexOf(segment);
  if (selIdx !== -1) {
    this.selectedRows.splice(selIdx, 1);
  }
  // 캔버스 다시 그리기
  this.$nextTick(() => this.render());
  // 필요하면 부모에 emit
  this.emitMeasurementsUpdate && this.emitMeasurementsUpdate();
}



<table class="results-table" v-else>
  <thead>
    <tr>
      <th>Item ID</th>
      <th>Sub ID</th>
      <th>Major Axis</th>
      <th>Minor Axis</th>
      <th>Area ({{ scaleMethod === 'scaleBar' ? scaleBarUnit + '²' : 'px²' }})</th>
      <th v-if="circleOptions.striation">Striation (%)</th>
      <th v-if="circleOptions.distortion">Distortion (%)</th>
      <th></th> <!-- 삭제 버튼용 -->
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
      <td>{{ (defect.majorAxisScaled && !isNaN(defect.majorAxisScaled)) ? defect.majorAxisScaled.toFixed(2) : '0.00' }}</td>
      <td>{{ (defect.minorAxisScaled && !isNaN(defect.minorAxisScaled)) ? defect.minorAxisScaled.toFixed(2) : '0.00' }}</td>
      <td>{{ (defect.areaScaled && !isNaN(defect.areaScaled)) ? defect.areaScaled.toFixed(2) : '0.00' }}</td>
      <td v-if="circleOptions.striation">{{ ((defect.striation || 0) / 100).toFixed(1) }}%</td>
      <td v-if="circleOptions.distortion">{{ ((defect.distortion || 0) / 100).toFixed(1) }}%</td>
      <td class="action-buttons">
        <button class="option-btn" @click.stop="deleteSegment(defect)">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    </tr>
  </tbody>
</table>