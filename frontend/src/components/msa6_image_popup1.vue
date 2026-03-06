<template>
  <div class="msa6-image-popup-container">
  <Teleport to="body">
      <div class="image-measurement-popup" v-show="isVisible">

      <!-- 불량 감지 로딩 오버레이 -->
      <div class="defect-detection-loading-overlay" v-show="isDefectDetecting">
        <div class="loading-content">
          <div class="loading-spinner">
            <div class="spinner-ring"></div>
          </div>
          <h4 class="loading-title">불량 감지 진행 중...</h4>
          <p class="loading-message">측정하는 동안 잠시만 기다려주세요</p>
          <div class="loading-warning">
            <i class="fas fa-exclamation-triangle"></i>
            <span>감지 중에는 다른 작업을 수행할 수 없습니다</span>
          </div>
          <!-- 즉시 중단 버튼 추가 -->
          <button
            class="emergency-stop-btn"
            @click="emergencyStopDetection"
            title="불량 감지 즉시 중단">
            <i class="fas fa-stop"></i>
            <span>즉시 중단</span>
          </button>
        </div>
      </div>

      <!-- 도움말 단축키 오버레이 -->
      <div class="shortcut-help-overlay" :class="{ show: showShortcutHelp }">
        <div class="shortcut-help-content" :class="{ show: showShortcutHelp }">
          <h2>단축키 도움말</h2>
          <div class="shortcut-grid">
            <div class="shortcut-item">
              <div class="shortcut-key">F</div>
              <div class="shortcut-desc">밝기값 보기 및 돋보기 활성화 (누르고 있는 동안)</div>
            </div>
            <div class="shortcut-item">
              <div class="shortcut-key">A</div>
              <div class="shortcut-desc">영역 선 측정 모드 (한번 더 누르면 수직/수평 방향 전환)</div>
            </div>
            <div class="shortcut-item">
              <div class="shortcut-key">S</div>
              <div class="shortcut-desc">단일 선 측정 모드 활성화</div>
            </div>
            <div class="shortcut-item">
              <div class="shortcut-key">C</div>
              <div class="shortcut-desc">Cut - 기준선 그리기 모드 활성화</div>
            </div>
            <div class="shortcut-item">
              <div class="shortcut-key">D</div>
              <div class="shortcut-desc">선택된 측정 결과 삭제</div>
            </div>
            <div class="shortcut-item">
              <div class="shortcut-key">H</div>
              <div class="shortcut-desc">도움말 표시 (누르고 있는 동안)</div>
            </div>
            <div class="shortcut-item">
              <div class="shortcut-key">R</div>
              <div class="shortcut-desc">불량 감지 모드 활성화 (Recognition)</div>
            </div>
            <div class="shortcut-item">
              <div class="shortcut-key">Ctrl+Z</div>
              <div class="shortcut-desc">측정 실행 취소</div>
            </div>
            <div class="shortcut-item">
              <div class="shortcut-key">Ctrl+Y</div>
              <div class="shortcut-desc">측정 다시 실행</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 초기화 확인 팝업 -->
      <div class="reset-confirmation-overlay" v-show="showResetConfirmPopup" @click.self="cancelReset">
        <div class="reset-confirmation-popup">
          <div class="popup-header">
            <h3>측정 결과 초기화</h3>
            <button class="popup-close-btn" @click="cancelReset">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="popup-content">
            <div class="warning-icon">
              <i class="fas fa-exclamation-triangle"></i>
            </div>
            <p class="warning-message">모든 측정 결과를 초기화하시겠습니까?</p>
            <p class="warning-detail">이 작업은 되돌릴 수 없습니다.</p>
            <ul class="reset-items">
              <li> 모든 선 측정 결과</li>
              <li> 불량 감지 결과</li>
              <li> 기준선</li>
              <li> Item ID 및 Sub ID 카운터</li>
            </ul>
          </div>
          <div class="popup-actions">
            <button class="cancel-btn" @click="cancelReset">
              <i class="fas fa-times"></i>
              취소
            </button>
            <button class="confirm-btn" @click="confirmReset">
              <i class="fas fa-trash-alt"></i>
              초기화
            </button>
          </div>
        </div>
      </div>

      <div class="measurement-container" @click.stop>
        <div class="measurement-header">
          <div class="header-left">
              <h3 class="header-title">이미지 측정 도구</h3>
          </div>

          <div class="header-right">
            <div class="measurement-options">
                <!-- 배율/스케일바 선택 옵션 추가 -->
                <div class="option-group scale-option-group">
                  <span class="option-group-label">측정 방식</span>
                  <div class="scale-method-selector">
                    <button
                      class="option-btn scale-btn"
                      :class="{ active: scaleMethod === 'magnification' }"
                      @click="scaleMethod = 'magnification'"
                      title="배율 기반 측정">
                      <i class="fas fa-search-plus"></i>
                      <span class="btn-text">배율</span>
                    </button>
                    <button
                      class="option-btn scale-btn"
                      :class="{ active: scaleMethod === 'scaleBar' }"
                      @click="scaleMethod = 'scaleBar'"
                      title="스케일바 기반 측정">
                      <i class="fas fa-ruler"></i>
                      <span class="btn-text">스케일바</span>
                    </button>
                  </div>
                </div>

                <!-- 스케일바 모드인 경우 수동 스케일바 그리기 버튼 추가 -->
                <div class="option-group" v-if="scaleMethod === 'scaleBar'">
                  <span class="option-group-label">스케일바 설정</span>
                  <button
                    class="option-btn"
                    :class="{ active: isDrawingScaleBar }"
                    @click="toggleScaleBarDrawing"
                    title="수동 스케일바 그리기">
                    <i class="fas fa-pencil-ruler"></i>
                  </button>
                  <button
                    class="option-btn"
                    @click="detectScaleBar"
                    title="자동 스케일바 감지">
                    <i class="fas fa-magic"></i>
                  </button>
                </div>

                <!-- 배율 설정 필드 - 스케일바 모드가 아닐 때만 표시 -->
                <div class="option-group" v-if="scaleMethod !== 'scaleBar'">
                <span class="option-group-label">배율</span>
                <input type="number" v-model="magnification" min="0.1" step="0.1" class="header-input no-spinners" title="측정 배율 설정" />
              </div>

                <!-- 스케일바 값 입력 필드 추가 -->
                <div class="option-group" v-if="scaleMethod === 'scaleBar'">
                  <span class="option-group-label">스케일바 길이</span>
                  <input type="number" v-model="scaleBarValue" min="0.1" step="0.1" class="header-input no-spinners" title="스케일바 길이" />
                  <select v-model="scaleBarUnit" class="unit-selector">
                    <option value="nm">nm</option>
                    <option value="μm">μm</option>
                  </select>
              </div>

              <div class="option-group">
                <span class="option-group-label">기준선</span>
                <button class="option-btn" :class="{ active: measurementMode === 'reference' }" @click="setMode('reference')" title="기준선 그리기">
                  <i class="fas fa-ruler"></i>
                  </button>
                <button class="option-btn color-palette-btn" @click="showReferenceColorPicker = !showReferenceColorPicker" title="기준선 색상 선택">
                  <i class="fas fa-palette" :style="{ color: referenceLineColor }"></i>
                  </button>
                <div v-if="showReferenceColorPicker" class="color-picker-dropdown">
                  <div class="color-options">
                    <div
                      v-for="color in referenceColorOptions"
                      :key="color"
                      class="color-option"
                      :style="{ backgroundColor: color }"
                      @click="selectReferenceColor(color)"
                    ></div>
                  </div>
                </div>
              </div>

              <div class="option-group">
                <span class="option-group-label">선 측정</span>
                <button class="option-btn" :class="{ active: measurementMode === 'line' }" @click="setMode('line')" title="단일 선 측정">
                  <i class="fas fa-ruler-horizontal"></i>
                </button>
              </div>

              <div class="option-group">
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
                <span class="option-group-label">영역</span>
                <button class="option-btn" :class="{ active: measurementMode === 'area-vertical' }" @click="setMode('area-vertical')" title="세로 방향 영역 측정">
                  <i class="fas fa-grip-lines-vertical"></i>
                </button>
                <button class="option-btn" :class="{ active: measurementMode === 'area-horizontal' }" @click="setMode('area-horizontal')" title="가로 방향 영역 측정">
                  <i class="fas fa-grip-lines"></i>
                </button>
              </div>

              <div class="option-group">
                <span class="option-group-label">삭제</span>
                <button class="option-btn" :class="{ active: isDeleteMode }" @click="toggleDeleteMode" title="측정값 삭제 (D)">
                  <i class="fas fa-trash"></i>
                </button>
              </div>

              <div class="option-group">
                <span class="option-group-label">불량 감지</span>
                <button
                  class="option-btn"
                  :class="{ active: measurementMode === 'defect' }"
                  :disabled="isDefectDetecting"
                  @click="setMode('defect')"
                  title="불량 감지">
                  <i class="fas fa-search"></i>
                </button>
              </div>
            </div>

            <button
              class="reset-btn"
              :disabled="isDefectDetecting"
              @click="showResetConfirmation"
              title="모든 측정 결과 초기화">
                <i class="fas fa-trash-alt"></i> <span class="btn-text">초기화</span>
            </button>
            <button
              class="close-btn"
              :disabled="isDefectDetecting"
              @click="closePopup">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>

        <div class="measurement-content">
          <div class="image-container" ref="container">
            <img ref="sourceImage" :src="currentImageUrl" crossorigin="anonymous" style="display: none;" @load="handleImageLoad" />
            <canvas ref="canvas" class="measurement-canvas"
                   @mousedown.prevent.stop="startMeasurement"
                   @mousemove.prevent.stop="updateMeasurement"
                   @mouseup.prevent.stop="endMeasurement"
                   @mouseleave.prevent.stop="endMeasurement"
                   @click="handleCanvasClick"
                   @mousemove="handleMouseMove"></canvas>

            <!-- 밝기 값 표시 -->
            <div class="brightness-tooltip" v-show="showBrightnessTooltip" :style="brightnessTooltipStyle">
              {{ currentBrightness }}
            </div>

            <!-- 돋보기 추가 -->
            <div class="magnifier-container" v-show="isFKeyPressed" :style="magnifierStyle">
              <canvas ref="magnifierCanvas" class="magnifier-canvas"></canvas>
              <div class="magnifier-crosshair"></div>
              <div class="magnifier-brightness">{{ currentBrightness }}</div>
            </div>

            <!-- 이미지 전/후 전환 버튼 추가 -->
            <div class="image-toggle-controls">
              <button
                v-if="(internalInputImageUrl || inputImageUrl) && (outputImageUrl || imageUrl)"
                class="toggle-image-btn"
                @click="toggleBeforeAfterImage"
                :title="isShowingInputImage ? '처리 후 이미지 보기' : '처리 전 이미지 보기'"
              >
                <i class="fas" :class="isShowingInputImage ? 'fa-arrow-right' : 'fa-arrow-left'"></i>
                <span>{{ isShowingInputImage ? '처리 후' : '처리 전' }}</span>
              </button>

              <!-- URL 복사 버튼 -->
              <button
                v-if="(internalInputImageUrl || inputImageUrl) && (outputImageUrl || imageUrl)"
                class="copy-url-btn"
                @click="copyImageUrl"
                title="이미지 URL 클립보드에 복사"
              >
                <i class="fas fa-copy"></i>
                <span>URL 복사</span>
              </button>

              <!-- 이미지 다운로드 버튼 추가 -->
              <button
                class="download-image-btn"
                @click="downloadResultImage"
                title="측정 결과 포함 이미지 다운로드"
              >
                <i class="fas fa-download"></i>
                <span>다운로드</span>
              </button>
            </div>
          </div>

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
                    <input type="text" v-model="newItemId" class="form-control" placeholder="Item ID 입력">
                  </div>
                  <div class="input-group">
                    <label>Sub ID</label>
                    <input type="text" v-model="newSubId" class="form-control" placeholder="Sub ID 입력 (예: s1)">
                  </div>
                </div>
                <button class="btn-apply" @click="applySelectedIds" :disabled="(measurementMode === 'defect' ? selectedDefects.length === 0 : selectedRows.length === 0) || (!newItemId && !newSubId)">
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
                  class="send-api-btn blinking-button"
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
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(segment, index) in filteredMeasurements"
                          :key="segment.subItemId"
                          :class="{ 'selected-row': selectedRows.includes(segment), 'total-measurement': segment.isTotal }"
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
                </div>
                <div class="average-section" v-if="measurementMode !== 'defect' && filteredMeasurements.length > 0">
                  <div class="stats-container">
                    <!-- 현재 모드에 따른 통계만 표시 -->
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
                  <button
                    class="download-csv-btn"
                    @click="downloadCSV"
                    title="측정 결과를 CSV 파일로 다운로드">
                    <i class="fas fa-download"></i>
                    CSV 다운로드
                  </button>
                </div>
                <div class="results-bottom-bar">
                  <div class="results-summary">

                    <span>총 측정: {{ measurementMode === 'defect' ? defectMeasurements.length : filteredMeasurements.length }}</span>
                  </div>
                  <button
                    class="save-measurements-btn"
                    :class="{ 'shortcut-highlight': showShortcutHelp }"
                    @click="showTableSelector"
                    :disabled="isSaving || (measurementMode === 'defect' ? defectMeasurements.length === 0 : filteredMeasurements.length === 0)"
                  >
                    <i class="fas fa-save"></i>
                    {{ isSaving ? '저장 중...' : '측정 결과 저장' }}
                  </button>
                </div>
              </div>
            </div>

            <div class="measurement-controls">
              <div class="control-group">
                <label class="control-label">밝기 임계값: {{ brightnessThreshold }}</label>
                <input type="range" v-model="brightnessThreshold" min="0" max="255" class="threshold-slider" />
                <button class="option-btn" @click="toggleReverse">
                  {{ isReversed ? '어두운 영역' : '밝은 영역' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 테이블 이름 선택 팝업 -->
      <TableNameSelector
        :show="showTableSelectorPopup"
        :measurementMode="measurementMode"
        @close="showTableSelectorPopup = false"
        @select="saveWithTableName"
      />

      <!-- 알림 메시지 -->
      <div v-if="notification.show"
          :class="['notification', notification.type]"
          :style="{
            backgroundColor: notification.type === 'success' ? 'rgb(76, 175, 80)' :
                            notification.type === 'error' ? 'rgb(244, 67, 54)' :
                            notification.type === 'warning' ? 'rgb(255, 152, 0)' : 'rgb(33, 150, 243)',
            color: 'white',
            borderLeft: notification.type === 'success' ? '5px solid #2e7d32' :
                        notification.type === 'error' ? '5px solid #c62828' :
                        notification.type === 'warning' ? '5px solid #ef6c00' : '5px solid #1565c0'
          }">
        {{ notification.message }}
      </div>
      </div>
    </Teleport>

    <!-- 스케일바 감지 알림 팝업 삭제 -->

  </div>
</template>

<script setup>
import '@/assets/css/msa6_image_popup1.css';
import TableNameSelector from './TableNameSelector.vue';

import {
  ref, computed, watch, onMounted, onBeforeUnmount, nextTick, toRef,
  getCurrentInstance,
} from 'vue';

// Composables
import { useNotification } from '@/composables/msa6_useNotification.js';
import { useReferenceLines } from '@/composables/msa6_useReferenceLines.js';
import { useBrightness } from '@/composables/msa6_useBrightness.js';
import { useHistory } from '@/composables/msa6_useHistory.js';
import { useScaleBar } from '@/composables/msa6_useScaleBar.js';
import { useCanvas } from '@/composables/msa6_useCanvas.js';
import { useMeasurement } from '@/composables/msa6_useMeasurement.js';
import { useDefectDetection } from '@/composables/msa6_useDefectDetection.js';
import { useSelection } from '@/composables/msa6_useSelection.js';
import { useImageToggle } from '@/composables/msa6_useImageToggle.js';
import { useKeyboard } from '@/composables/msa6_useKeyboard.js';
import { usePopupState } from '@/composables/msa6_usePopupState.js';
import { useDataExport } from '@/composables/msa6_useDataExport.js';
import {
  doLinesIntersect, getPointToLineDistance,
} from '@/composables/msa6_useGeometry.js';

// =====================
// Props & Emits
// =====================
const props = defineProps({
  imageUrl: { type: String, default: null },
  inputImageUrl: { type: String, default: null },
  showPopup: { type: Boolean, default: false },
  title: { type: String, default: '이미지 측정 결과' },
  measurements: { type: Array, default: () => [] },
  config: {
    type: Object,
    default: () => ({
      showToolbar: true,
      showSaveButton: true,
      showImageSwitch: true,
    }),
  },
});

const emit = defineEmits([
  'close',
  'update:showPopup',
  'update:measurements',
  'measurement-added',
  'measurement-deleted',
  'measurements-cleared',
]);

// =====================
// Template refs
// =====================
const canvas = ref(null);
const container = ref(null);
const sourceImage = ref(null);
const magnifierCanvas = ref(null);

// =====================
// Notification
// =====================
const { notification, showNotification } = useNotification();

// =====================
// Reference Lines
// =====================
// We need render function - forward-declare it
let render;
const refLinesDeps = { render: () => render() };
const {
  referenceLines, activeReferenceLine, referenceLineColor,
  showReferenceColorPicker, referenceColorOptions, referenceId,
  selectReferenceColor,
} = useReferenceLines(refLinesDeps);

// =====================
// Image Toggle
// =====================
const imageToggleDeps = {
  canvasRef: canvas,
  sourceImageRef: sourceImage,
  inputImageUrl: toRef(props, 'inputImageUrl'),
  imageUrl: toRef(props, 'imageUrl'),
  showNotification,
  render: () => render(),
};
const {
  isShowingInputImage, internalInputImageUrl, outputImageUrl, isToggling,
  currentImageUrl, toggleBeforeAfterImage, copyImageUrl, downloadResultImage,
} = useImageToggle(imageToggleDeps);

// =====================
// Scale Bar
// =====================
// Forward-declare some refs that ScaleBar needs
const scalebarManagerRef = ref(null);
const measurementModeRef = ref('line');
const isAreaSelectionModeRef = ref(false);
const selectedAreaRectRef = ref(null);
const areaStartRef = ref(null);
const areaEndRef = ref(null);

const scaleBarDeps = {
  scalebarManager: scalebarManagerRef,
  measurementMode: measurementModeRef,
  isAreaSelectionMode: isAreaSelectionModeRef,
  selectedAreaRect: selectedAreaRectRef,
  areaStart: areaStartRef,
  areaEnd: areaEndRef,
  render: () => render(),
  showNotification,
};
const {
  scaleMethod, magnification, scaleBarValue, scaleBarUnit,
  scaleBarDetected, scaleBarMeasurement, isDrawingScaleBar,
  manualScaleBar, manualScaleBarSet, pendingMeasurementMode,
  detectScaleBar, toggleScaleBarDrawing, selectScaleMethod,
  showScaleDetectionFailurePopup,
} = useScaleBar(scaleBarDeps);

// =====================
// Brightness
// =====================
// getLocalPos will be provided by canvas composable
let getLocalPos;
const brightnessDeps = {
  canvasRef: canvas,
  sourceImageRef: sourceImage,
  magnifierCanvasRef: magnifierCanvas,
  imageData: ref(null), // will be set below
  showNotification,
  getLocalPos: (e) => getLocalPos(e),
};
const {
  brightnessThreshold, isReversed, isFKeyPressed, showBrightnessTooltip,
  currentBrightness, magnifierSize, magnifierZoom, currentMousePos,
  brightnessTooltipStyle, magnifierStyle,
  calculateBrightness, calculateAverageBrightness,
  updateBrightnessAtPosition, updateMagnifier, toggleReverse,
} = useBrightness(brightnessDeps);

// =====================
// Canvas
// =====================
const canvasDeps = {
  canvasRef: canvas,
  containerRef: container,
  sourceImageRef: sourceImage,
  magnifierCanvasRef: magnifierCanvas,
  emit,
  props,
  // These will be wired after measurement composable is created
  isMeasuring: ref(false),
  currentMeasurement: ref(null),
  segmentedMeasurements: ref([]),
  localMeasurements: ref([]),
  defectMeasurements: ref([]),
  referenceLines,
  activeReferenceLine,
  referenceLineColor,
  measurementMode: measurementModeRef,
  isReversed,
  brightnessThreshold,
  scaleMethod,
  scaleBarValue,
  scaleBarUnit,
  scaleBarDetected,
  scaleBarMeasurement,
  magnification,
  manualScaleBar,
  manualScaleBarSet,
  isDrawingScaleBar,
  selectedAreaRect: selectedAreaRectRef,
  areaStart: areaStartRef,
  areaEnd: areaEndRef,
  areaSelectionStart: ref(null),
  areaSelectionEnd: ref(null),
  deleteStart: ref(null),
  deleteEnd: ref(null),
  isDeleteMode: ref(false),
  isAreaSelectionMode: isAreaSelectionModeRef,
  tempDragLine: ref(null),
  isToggling,
  isShowingInputImage,
  internalInputImageUrl,
  outputImageUrl,
  showNotification,
  showScaleDetectionFailurePopup,
  lineCount: ref(5),
};

const {
  image, ctx, imageData, imageRatio, scalebarManager,
  initialLoadDone,
  getLocalPos: _getLocalPos,
  calculateValue, updateCanvasSize,
  adjustMeasurements, onWindowResize,
  render: _render, drawMeasurementsOnCanvas,
  loadImage, handleImageLoad, cleanupImageUrls,
  initScalebarManager,
} = useCanvas(canvasDeps);

// Wire up
render = _render;
getLocalPos = _getLocalPos;
brightnessDeps.imageData = imageData;
scalebarManagerRef.value = scalebarManager.value; // Will be set during mount

// =====================
// Defect Detection
// =====================
const selectedDefectsRef = ref([]);

const defectDeps = {
  canvasRef: canvas,
  sourceImageRef: sourceImage,
  ctx,
  imageData,
  brightnessThreshold,
  isReversed,
  scaleMethod,
  scaleBarValue,
  scaleBarUnit,
  manualScaleBar,
  magnification,
  scaleBarMeasurement,
  measurementMode: measurementModeRef,
  newItemId: ref(''),
  newSubId: ref(''),
  selectedAreaRect: selectedAreaRectRef,
  selectedDefects: selectedDefectsRef,
  isAreaSelectionMode: isAreaSelectionModeRef,
  render: () => render(),
  showNotification,
  forceUpdate: () => {
    const instance = getCurrentInstance();
    if (instance) instance.proxy?.$forceUpdate();
  },
};

const {
  defectMeasurements, isDefectDetecting, defectDetectionResult,
  isApiSending, circleOptions, selectedAreaRect: defectSelectedAreaRect,
  globalDefectIdCounter,
  sendSelectedAreaToApi, emergencyStopDetection,
  clearDefectMeasurements,
} = useDefectDetection(defectDeps);

// Expose selectedAreaRect for template
const selectedAreaRect = selectedAreaRectRef;

// Sync selectedAreaRect between defect and measurement
watch(defectSelectedAreaRect, (v) => { selectedAreaRectRef.value = v; });
watch(selectedAreaRectRef, (v) => { defectSelectedAreaRect.value = v; });

// Wire canvas deps to defectMeasurements
canvasDeps.defectMeasurements = defectMeasurements;

// =====================
// Measurement
// =====================
const measurementDeps = {
  canvasRef: canvas,
  sourceImageRef: sourceImage,
  ctx,
  image,
  imageData,
  getLocalPos: (e) => getLocalPos(e),
  calculateValue,
  calculateBrightness,
  calculateAverageBrightness,
  brightnessThreshold,
  isReversed,
  scaleMethod,
  scaleBarDetected,
  scaleBarMeasurement,
  scaleBarValue,
  scaleBarUnit,
  magnification,
  manualScaleBar,
  manualScaleBarSet,
  referenceLines,
  activeReferenceLine,
  referenceLineColor,
  isDrawingScaleBar,
  pendingMeasurementMode,
  scalebarManager,
  selectedAreaRect: selectedAreaRectRef,
  defectMeasurements,
  isDKeyPressed: ref(false), // will be wired from keyboard
  tempDragLine: canvasDeps.tempDragLine,
  isDeleteMode: canvasDeps.isDeleteMode,
  deleteStart: canvasDeps.deleteStart,
  deleteEnd: canvasDeps.deleteEnd,
  circleOptions,
  showNotification,
  render: () => render(),
  addToHistory: (...args) => addToHistory(...args),
  emit,
  emitMeasurementsUpdate: () => emitMeasurementsUpdate(),
  lineCount: canvasDeps.lineCount,
  isDefectDetecting,
  selectedDefects: selectedDefectsRef,
  selectedMeasurement: ref(null),
  selectedSegment: ref(null),
  referenceId,
  undoHistory: ref([]),
  redoHistory: ref([]),
  deleteMeasurementsInPath: () => deleteMeasurementsInPath(),
};

const {
  isMeasuring, currentMeasurement, segmentedMeasurements, localMeasurements,
  measurementMode, nextId, subItemPrefix, brightSubIdCounter, darkSubIdCounter,
  lineCount, areaStart, areaEnd, areaSelectionStart, areaSelectionEnd,
  isAreaSelectionMode, isDeleteMode, deleteStart, deleteEnd, tempDragLine,
  previousMeasurementMode, areaDirection, selectedArea, measurementHistory,
  filteredMeasurements, currentAverage, currentStandardDeviation, currentThreeSigma,
  averageMeasurementValue,
  increaseLineCount, decreaseLineCount, setMode, toggleDeleteMode,
  startMeasurement, updateMeasurement, endMeasurement,
  updateAllMeasurements, initializeMeasurements, clearMeasurements,
  emitMeasurementsUpdate,
} = useMeasurement(measurementDeps);

// Wire canvas deps to measurement refs
canvasDeps.isMeasuring = isMeasuring;
canvasDeps.currentMeasurement = currentMeasurement;
canvasDeps.segmentedMeasurements = segmentedMeasurements;
canvasDeps.localMeasurements = localMeasurements;
canvasDeps.areaSelectionStart = areaSelectionStart;
canvasDeps.areaSelectionEnd = areaSelectionEnd;
canvasDeps.deleteStart = deleteStart;
canvasDeps.deleteEnd = deleteEnd;
canvasDeps.isDeleteMode = isDeleteMode;
canvasDeps.isAreaSelectionMode = isAreaSelectionMode;
canvasDeps.tempDragLine = tempDragLine;
canvasDeps.lineCount = lineCount;

// Sync measurement mode and area refs
watch(measurementMode, (v) => { measurementModeRef.value = v; });
watch(isAreaSelectionMode, (v) => { isAreaSelectionModeRef.value = v; });
watch(areaStart, (v) => { areaStartRef.value = v; });
watch(areaEnd, (v) => { areaEndRef.value = v; });

// =====================
// History
// =====================
const historyDeps = {
  segmentedMeasurements,
  referenceLines,
  defectMeasurements,
  localMeasurements,
  selectedRows: ref([]),
  selectedMeasurement: ref(null),
  selectedDefects: selectedDefectsRef,
  render: () => render(),
  emitMeasurementsUpdate: () => emitMeasurementsUpdate(),
  showNotification,
};

const { undoHistory, redoHistory, addToHistory, undo, redo } = useHistory(historyDeps);

// Wire undo/redo to measurement deps
measurementDeps.undoHistory = undoHistory;
measurementDeps.redoHistory = redoHistory;

// =====================
// Selection
// =====================
const selectionDeps = {
  filteredMeasurements,
  defectMeasurements,
  segmentedMeasurements,
  localMeasurements,
  measurementMode,
  render: () => render(),
  showNotification,
  addToHistory,
  emitMeasurementsUpdate: () => emitMeasurementsUpdate(),
};

const {
  selectedRows, selectedDefects, hoveredSegment,
  selectedMeasurement, selectedSegment,
  isDragging, dragStartIndex, dragEndIndex, dragStartRow,
  newItemId, newSubId,
  handleRowMouseDown, handleRowMouseEnter, handleRowMouseUp,
  handleDefectMouseDown, handleDefectMouseEnter, handleDefectMouseUp,
  applySelectedIds, deleteSelectedMeasurements, deleteSegment,
} = useSelection(selectionDeps);

// Wire selection refs back
historyDeps.selectedRows = selectedRows;
historyDeps.selectedMeasurement = selectedMeasurement;
defectDeps.newItemId = newItemId;
defectDeps.newSubId = newSubId;

// Sync selectedDefects
watch(selectedDefects, (v) => { selectedDefectsRef.value = v; }, { deep: true });
watch(selectedDefectsRef, (v) => { selectedDefects.value = v; }, { deep: true });

// =====================
// Keyboard
// =====================
const keyboardDeps = {
  showBrightnessTooltip,
  isFKeyPressed,
  showShortcutHelp: ref(false),
  measurementMode,
  areaDirection,
  setMode,
  isDeleteMode,
  isDKeyPressed: ref(false),
  tempDragLine,
  isMeasuring,
  selectedRows,
  selectedDefects,
  deleteSelectedMeasurements,
  undo,
  redo,
  showNotification,
  render: () => render(),
  closePopup: () => closePopup(),
};

const {
  isDKeyPressed, showShortcutHelp,
  handleKeyDown, handleKeyUp,
} = useKeyboard(keyboardDeps);

// Wire keyboard refs
measurementDeps.isDKeyPressed = isDKeyPressed;

// =====================
// Popup State
// =====================
const popupDeps = {
  emit,
  imageUrl: toRef(props, 'imageUrl'),
  showPopup: toRef(props, 'showPopup'),
  currentImageUrl,
  loadImage,
  updateCanvasSize,
  detectScaleBar,
  scaleMethod,
  scaleBarDetected,
  internalInputImageUrl,
  outputImageUrl,
  isShowingInputImage,
  isMeasuring,
  currentMeasurement,
  areaStart,
  areaEnd,
  selectedAreaRect: selectedAreaRectRef,
  isDefectDetecting,
  emergencyStopDetection,
  showShortcutHelp,
  isFKeyPressed,
  showBrightnessTooltip,
  showNotification,
  segmentedMeasurements,
  defectMeasurements,
  referenceLines,
  selectedRows,
  selectedMeasurement,
  selectedDefects,
  selectedSegment,
  areaSelectionStart,
  areaSelectionEnd,
  nextId,
  brightSubIdCounter,
  darkSubIdCounter,
  referenceId,
  globalDefectIdCounter,
  measurementMode,
  isDeleteMode,
  isAreaSelectionMode,
  isDragging,
  dragStartIndex,
  dragEndIndex,
  dragStartRow,
  tempDragLine,
  render: () => render(),
  emitMeasurementsUpdate: () => emitMeasurementsUpdate(),
  addToHistory,
  activeReferenceLine,
  localMeasurements,
  nextTickFn: (fn) => nextTick(fn),
};

const {
  isVisible, showResetConfirmPopup, showTableSelectorPopup,
  openPopup, closePopup, showResetConfirmation, cancelReset, confirmReset,
  showTableSelector,
} = usePopupState(popupDeps);

// =====================
// Data Export
// =====================
const exportDeps = {
  filteredMeasurements,
  segmentedMeasurements,
  localMeasurements,
  defectMeasurements,
  measurementMode,
  isReversed,
  currentAverage,
  currentStandardDeviation,
  currentThreeSigma,
  scaleMethod,
  scaleBarUnit,
  magnification,
  manualScaleBar,
  scaleBarValue,
  canvasRef: canvas,
  sourceImageRef: sourceImage,
  referenceLines,
  referenceLineColor,
  internalInputImageUrl,
  inputImageUrl: toRef(props, 'inputImageUrl'),
  isShowingInputImage,
  showNotification,
  showTableSelectorPopup,
  drawMeasurementsOnCanvas,
  nextTickFn: (fn) => nextTick(fn),
};

const {
  isSaving, downloadCSV, saveWithTableName, saveMeasurementImages,
  createFixedSizeImage, convertImageToFixedSize, createImageWithMeasurements,
} = useDataExport(exportDeps);

// =====================
// Delete measurements in path (uses geometry)
// =====================
function deleteMeasurementsInPath() {
  try {
    if (!deleteStart.value || !deleteEnd.value) return;

    let deletedCount = 0;
    addToHistory('delete', null);

    const initialSegCount = segmentedMeasurements.value.length;
    segmentedMeasurements.value = segmentedMeasurements.value.filter((segment) => {
      return !doLinesIntersect(deleteStart.value, deleteEnd.value, segment.start, segment.end);
    });
    deletedCount += initialSegCount - segmentedMeasurements.value.length;

    const initialRefCount = referenceLines.value.length;
    referenceLines.value = referenceLines.value.filter((ref) => {
      return !doLinesIntersect(deleteStart.value, deleteEnd.value, ref.start, ref.end);
    });
    deletedCount += initialRefCount - referenceLines.value.length;

    const initialDefCount = defectMeasurements.value.length;
    defectMeasurements.value = defectMeasurements.value.filter((defect) => {
      if (defect.center) {
        const distance = getPointToLineDistance(defect.center, deleteStart.value, deleteEnd.value);
        return distance > 15;
      }
      return true;
    });
    deletedCount += initialDefCount - defectMeasurements.value.length;

    selectedRows.value = [];
    selectedMeasurement.value = null;
    selectedDefects.value = [];

    emitMeasurementsUpdate();

    if (deletedCount > 0) {
      showNotification(`${deletedCount}개의 측정 결과가 삭제되었습니다.`, 'success');
    } else {
      showNotification('삭제할 측정 결과를 찾을 수 없습니다.', 'info');
    }
  } catch (error) {
    console.error('[deleteMeasurementsInPath] Error:', error);
    showNotification('측정값 삭제 중 오류가 발생했습니다.', 'error');
  }
}

// Wire deleteMeasurementsInPath into measurement deps
measurementDeps.deleteMeasurementsInPath = deleteMeasurementsInPath;

// =====================
// Mouse move handler (canvas)
// =====================
function handleMouseMove(e) {
  if (!canvas.value) return;
  const rect = canvas.value.getBoundingClientRect();
  currentMousePos.x = e.clientX - rect.left;
  currentMousePos.y = e.clientY - rect.top;

  if (isFKeyPressed.value) {
    updateBrightnessAtPosition(e);
    updateMagnifier(e);
  }
}

// =====================
// Canvas click handler
// =====================
function handleCanvasClick(e) {
  if (!canvas.value) return;
  if (isMeasuring.value) return;
  if (!isFKeyPressed.value) return;

  const pos = getLocalPos(e);
  const brightness = calculateBrightness(pos.x, pos.y);
  brightnessThreshold.value = brightness;
  showNotification(`밝기 임계값이 ${brightness}로 설정되었습니다.`, 'info');
  currentBrightness.value = brightness;
}

// =====================
// MSA5 event handlers
// =====================
function handleMSA5ImageProcessed(event) {
  // Stub handler for MSA5 image processing events
  try {
    const data = event.detail;
    if (data && data.outputImageUrl) {
      outputImageUrl.value = data.outputImageUrl;
    }
    if (data && data.inputImageUrl) {
      internalInputImageUrl.value = data.inputImageUrl;
    }
  } catch (error) {
    console.error('[handleMSA5ImageProcessed] Error:', error);
  }
}

function handleMSA5ProcessStart(event) {
  try {
    const data = event.detail;

    if (data && data.action === 'clear_measurements') {
      clearMeasurements();
      clearDefectMeasurements();

      manualScaleBar.value = null;
      manualScaleBarSet.value = false;
      scaleBarDetected.value = false;
      scaleBarMeasurement.value = null;
      isDrawingScaleBar.value = false;

      scaleBarValue.value = 500;
      scaleBarUnit.value = 'nm';

      if (scalebarManager.value) {
        try {
          scalebarManager.value.clearScalebarSettings();
        } catch (managerError) {
          console.error('[handleMSA5ProcessStart] Scalebar manager clear error:', managerError);
        }
      }

      render();
    }
  } catch (error) {
    console.error('[handleMSA5ProcessStart] Error:', error);
  }
}

// =====================
// Build component interface for scalebarManager
// =====================
function buildComponentInterface() {
  return {
    // Refs exposed as properties via getters/setters
    get image() { return image.value; },
    set image(v) { image.value = v; },
    get canvas() { return canvas.value; },
    get ctx() { return ctx.value; },
    set ctx(v) { ctx.value = v; },
    get imageData() { return imageData.value; },
    set imageData(v) { imageData.value = v; },
    get scaleMethod() { return scaleMethod.value; },
    set scaleMethod(v) { scaleMethod.value = v; },
    get scaleBarValue() { return scaleBarValue.value; },
    set scaleBarValue(v) { scaleBarValue.value = v; },
    get scaleBarUnit() { return scaleBarUnit.value; },
    set scaleBarUnit(v) { scaleBarUnit.value = v; },
    get scaleBarDetected() { return scaleBarDetected.value; },
    set scaleBarDetected(v) { scaleBarDetected.value = v; },
    get scaleBarMeasurement() { return scaleBarMeasurement.value; },
    set scaleBarMeasurement(v) { scaleBarMeasurement.value = v; },
    get manualScaleBar() { return manualScaleBar.value; },
    set manualScaleBar(v) { manualScaleBar.value = v; },
    get manualScaleBarSet() { return manualScaleBarSet.value; },
    set manualScaleBarSet(v) { manualScaleBarSet.value = v; },
    get isDrawingScaleBar() { return isDrawingScaleBar.value; },
    set isDrawingScaleBar(v) { isDrawingScaleBar.value = v; },
    get magnification() { return magnification.value; },
    set magnification(v) { magnification.value = v; },
    get measurementMode() { return measurementMode.value; },
    set measurementMode(v) { measurementMode.value = v; },
    get isVisible() { return isVisible.value; },
    set isVisible(v) { isVisible.value = v; },
    get showPopup() { return props.showPopup; },
    get brightnessThreshold() { return brightnessThreshold.value; },
    set brightnessThreshold(v) { brightnessThreshold.value = v; },
    get isReversed() { return isReversed.value; },
    set isReversed(v) { isReversed.value = v; },
    get initialLoadDone() { return initialLoadDone.value; },
    set initialLoadDone(v) { initialLoadDone.value = v; },
    get pendingMeasurementMode() { return pendingMeasurementMode.value; },
    set pendingMeasurementMode(v) { pendingMeasurementMode.value = v; },
    $refs: {
      get canvas() { return canvas.value; },
      get sourceImage() { return sourceImage.value; },
      get container() { return container.value; },
    },
    $nextTick: (fn) => nextTick(fn),
    $forceUpdate: () => {
      const instance = getCurrentInstance();
      if (instance) instance.proxy?.$forceUpdate();
    },
    showNotification,
    render: () => render(),
    scalebarManager: scalebarManager.value,
  };
}

// =====================
// Watchers (replicate original behavior)
// =====================

// measurements prop watcher
let _isUpdatingMeasurements = false;
watch(() => props.measurements, (newMeasurements) => {
  try {
    if (_isUpdatingMeasurements) return;
    _isUpdatingMeasurements = true;

    if (Array.isArray(newMeasurements)) {
      localMeasurements.value = JSON.parse(JSON.stringify(newMeasurements));
    } else {
      localMeasurements.value = [];
    }
  } catch (error) {
    console.error('[measurements watcher] Error:', error);
    localMeasurements.value = [];
  } finally {
    _isUpdatingMeasurements = false;
  }
}, { immediate: true, deep: true });

// imageUrl watcher
watch(() => props.imageUrl, (newUrl) => {
  if (newUrl) {
    isShowingInputImage.value = false;
    nextTick(() => {
      loadImage(newUrl);
      if (scaleMethod.value === 'scaleBar' && isVisible.value && !scaleBarDetected.value) {
        setTimeout(() => {
          if (scalebarManager.value) scalebarManager.value.detectScaleBar();
        }, 1000);
      }
    });
  }
}, { immediate: true });

// inputImageUrl watcher
watch(() => props.inputImageUrl, (newUrl) => {
  if (newUrl) {
    internalInputImageUrl.value = newUrl;
  } else {
    const msa5StartImage = sessionStorage.getItem('msa5_start_image_url');
    if (msa5StartImage) {
      internalInputImageUrl.value = msa5StartImage;
    }
  }
}, { immediate: true });

// magnification watcher
watch(magnification, () => {
  updateAllMeasurements();
});

// showPopup watcher
watch(() => props.showPopup, (newVal) => {
  isVisible.value = newVal;
  if (newVal) {
    openPopup();
    if (!initialLoadDone.value) {
      initialLoadDone.value = true;
    }
  }
}, { immediate: true });

// scaleBarDetected watcher
watch(scaleBarDetected, (detected) => {
  if (detected) {
    if (scalebarManager.value) scalebarManager.value.saveScaleBarSettings();
    if (manualScaleBarSet.value && scaleBarValue.value && scaleBarUnit.value) {
      return;
    }
  }

  if (!detected && scaleMethod.value === 'scaleBar' && isVisible.value) {
    nextTick(() => {
      if (scalebarManager.value) scalebarManager.value.showScaleDetectionFailurePopup();
    });
    showNotification('스케일바 자동 감지에 실패했습니다. 측정 방식을 선택해주세요.', 'warning');
  }
});

// =====================
// Lifecycle
// =====================
onMounted(() => {
  nextTick(() => {
    const canvasEl = canvas.value;
    if (canvasEl) {
      ctx.value = canvasEl.getContext('2d', { willReadFrequently: true });
    }
  });

  manualScaleBarSet.value = false;
  internalInputImageUrl.value = props.inputImageUrl;

  window.addEventListener('resize', onWindowResize);
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('msa5-image-processed', handleMSA5ImageProcessed);
  window.addEventListener('msa6:imageProcessed', handleMSA5ImageProcessed);
  window.addEventListener('msa5-process-start', handleMSA5ProcessStart);

  // Initialize scalebar manager
  nextTick(() => {
    const componentInterface = buildComponentInterface();
    initScalebarManager(componentInterface);
    scalebarManagerRef.value = scalebarManager.value;
    scaleBarDeps.scalebarManager = scalebarManager;
  });

  // Initialize measurements from props
  initializeMeasurements(props.measurements);

  // Escape key handler
  const keydownHandler = (e) => {
    if (e.key === 'Escape') {
      closePopup();
    }
  };
  document.addEventListener('keydown', keydownHandler);

  // Store for cleanup
  onBeforeUnmount(() => {
    document.removeEventListener('keydown', keydownHandler);
  });
});

onBeforeUnmount(() => {
  cleanupImageUrls();

  try {
    window.removeEventListener('resize', onWindowResize);
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    window.removeEventListener('msa5-image-processed', handleMSA5ImageProcessed);
    window.removeEventListener('msa6:imageProcessed', handleMSA5ImageProcessed);
    window.removeEventListener('msa5-process-start', handleMSA5ProcessStart);
  } catch (error) {
    console.error('[beforeUnmount] Cleanup error:', error);
  }
});

// Expose for parent component access (replaces Options API expose)
defineExpose({
  openPopup,
  closePopup,
  clearMeasurements,
  render: () => render(),
  isVisible,
});
</script>

<style scoped>

</style>
