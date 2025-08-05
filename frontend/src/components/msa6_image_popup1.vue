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

<script>
import '@/assets/css/msa6_image_popup1.css'
import LogService from '../utils/logService'
import TableNameSelector from './TableNameSelector.vue';
import PopupDebug from '../utils/popupDebug';
import { createBoundedSegments, createAreaMeasurements  } from '@/utils/msa6_measures.js';
// 기준선 기반 자르기 기능을 위한 import 추가
import { 
  trimMeasurementByReferenceLine, 
  trimSingleMeasurementByReferenceLine
} from '@/utils/msa6_reference_trimmer.js';

// 개별 함수를 직접 가져오기
import { patchDetectScaleBar, showScaleDetectionFailurePopup, createScaleChoicePopup } from '../utils/popupOverride';

// 불량 감지 모듈 import
import { DefectDetector } from '@/utils/msa6_defect_detection.js';
// 불량 감지 중단 모듈 import
import { 
  emergencyStopDefectDetection, 
  registerDefectDetector, 
  resetDefectStopState 
} from '@/utils/msa6_defect_stop.js';
import { MSA6ScalebarManager } from '../utils/msa6_scalebar_manager.js';

export default {
  name: 'MSA6ImagePopup',
  props: {
    imageUrl: {
      type: String,
      default: null
    },
    inputImageUrl: {
      type: String,
      default: null
    },
    showPopup: {
      type: Boolean,
      default: false
    },
    title: {
      type: String,
      default: '이미지 측정 결과'
    },
    measurements: {
      type: Array,
      default: () => []
    },
    config: {
      type: Object,
      default: () => ({
        showToolbar: true,
        showSaveButton: true,
        showImageSwitch: true
      })
    }
  },
  emits: [
    'close', 
    'update:showPopup', 
    'update:measurements', 
    'measurement-added', 
    'measurement-deleted', 
    'measurements-cleared'
  ],
  components: {
    TableNameSelector
  },
  data() {
    return {
      image: null,
      canvas: null,
      ctx: null,
      isMeasuring: false,
      currentMeasurement: null,
      segmentedMeasurements: [],
      // measurements prop 대신 사용할 내부 데이터 추가
      localMeasurements: [],
      nextId: 1,
      subItemPrefix: 'S',
      // 기준선용 별도 ID 카운터 추가
      referenceId: 1,
      brightnessThreshold: 200,
      isReversed: true,
      measurementMode: 'line',
      isSettingReference: false,
      scale: 1,
      magnification: 500,
      // 스케일바 관련 데이터 추가
      scaleMethod: 'scaleBar', // 기본 측정 방식
      scaleBarValue: 500, // 기본값 500
      scaleBarUnit: 'nm', // 기본 단위
      scaleBarDetected: false, // 스케일바 감지 여부
      scaleBarMeasurement: null, // 스케일바 측정 결과
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
      hoveredSegment: null, // 마우스 오버된 세그먼트
      selectedDefects: [],
      isSaving: false,
      referenceLines: [],
      activeReferenceLine: null,
      referenceLineColor: '#ff9900', // 기본 기준선 색상
      showReferenceColorPicker: false,
      referenceColorOptions: ['#ff9900', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffffff'],
      debugInfo: {
        referenceLinesCount: 0,
        lastAction: ''
      },
      showTableSelectorPopup: false,
      notification: {
        show: false,
        message: '',
        type: 'info',
        timeout: null
      },
      // 수동 스케일바 그리기 관련 변수 추가
      isDrawingScaleBar: false, // 스케일바 그리기 모드
      manualScaleBar: null,
      // 수동 스케일바가 사용자에 의해 설정되었는지 추적하는 플래그 추가
      manualScaleBarSet: false, // 수동 스케일바 설정 여부
      $_isInitialLoad: true,
      // 첫 번째 감지 시도 플래그 추가
      isFirstDetectionAttempt: true,
      // 최초 로드 완료 플래그 추가
      initialLoadDone: false,
      // 이미지 전/후 전환 관련 변수 추가
      isShowingInputImage: false, // 처리 후 이미지가 기본으로 표시되도록 false로 설정
      internalInputImageUrl: null, // 내부에서 사용할 MSA5의 시작 이미지 URL
      outputImageUrl: null, // MSA5의 종료 이미지 URL (현재 imageUrl)
      // 이미지 토글 중 플래그
      isToggling: false,
      
      // Add a local state to track visibility internally
      isVisible: false,
      // 밝기 값 표시 관련 변수 추가
      showBrightnessTooltip: false,
      currentBrightness: 0,
      currentMousePos: { x: 0, y: 0 },
      isFKeyPressed: false,
      // 돋보기 관련 변수 추가
      magnifierSize: 150,
      magnifierZoom: 5,
      // 단축키 도움말 표시 상태
      showShortcutHelp: false,
      isDKeyPressed: false,
      tempDragLine: null,
      // 삭제 모드 관련 변수 추가
      isDeleteMode: false,
      deleteStart: null,
      deleteEnd: null,
      previousMeasurementMode: 'line', // 이전 측정 모드 저장
      isDefectDetecting: false,
      defectDetectionResult: null,
      scalebarManager: null,
      hoveredSegment: null, // 마우스 오버된 세그먼트
      
      // 순환 업데이트 방지 플래그 추가
      _isUpdatingMeasurements: false,
      _renderRetryCount: 0,
      lineCount: 5,
      isAreaSelectionMode: false, // Added property
      
      // 불량 감지 관련 데이터 추가
      defectMeasurements: [],
      circleOptions: {
        striation: true,
        distortion: true
      },
      // 누락된 속성들 추가
      isApiSending: false,
      selectedAreaRect: null,
      // 불량감지 영역 선택 관련 변수 추가
      areaStart: null,
      areaEnd: null,
      areaSelectionStart: null,
      areaSelectionEnd: null,
      // 드래그 선택 관련 변수들 추가
      isDragging: false,
      dragStartIndex: -1,
      dragEndIndex: -1,
      dragStartRow: null,
      pendingMeasurementMode: null,
      // 실행 취소/다시 실행 관련 변수 추가
      undoHistory: [],
      redoHistory: [],
      // 초기화 확인 팝업 관련 변수 추가
      showResetConfirmPopup: false,
      // 전역 불량감지 ID 카운터 추가
      globalDefectIdCounter: 1,
      // 단축키 기능 관련 속성들 추가
      showBrightnessValue: false,
      isMagnifierActive: false,
      areaDirection: 'horizontal', // 영역 측정 방향 (horizontal/vertical)
    };
  },
  mounted() {
    // console.log('[mounted] 컴포넌트 마운트됨');
    
    // 캔버스 컨텍스트 초기화
    this.$nextTick(() => {
      const canvas = this.$refs.canvas;
      if (canvas) {
        this.ctx = canvas.getContext('2d', { willReadFrequently: true });
        // console.log('[mounted] 캔버스 컨텍스트 초기화 완료:', !!this.ctx);
      } else {
        console.warn('[mounted] 캔버스 요소를 찾을 수 없음');
      }
    });
    
    // 페이지 새로고침 시 수동 스케일바 설정 항상 초기화
    this.manualScaleBarSet = false;
    // console.log('[mounted] 수동 스케일바 설정 초기화: manualScaleBarSet = false');
    
    // prop에서 내부 데이터 초기화
    this.internalInputImageUrl = this.inputImageUrl;
    
    // 이벤트 리스너 등록
    window.addEventListener('resize', this.onWindowResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    
    // MSA5 이미지 처리 완료 이벤트 리스너 등록
    window.addEventListener('msa5-image-processed', this.handleMSA5ImageProcessed);
    window.addEventListener('msa6:imageProcessed', this.handleMSA5ImageProcessed);
    
    // MSA5 프로세스 시작 이벤트 리스너 등록 (측정 결과 즉시 초기화)
    window.addEventListener('msa5-process-start', this.handleMSA5ProcessStart);
    
    // 최초 로드 시에만 초기화 플래그 설정
    if (!this.initialLoadDone) {
      this.$_isInitialLoad = true;
      this.isFirstDetectionAttempt = true;
      // console.log('[mounted] 최초 로드, 초기화 플래그 설정');

      // 이미 스케일바 값이 있는지 확인 (수동 설정 여부는 고려하지 않음)
      const hasScaleBarValues = this.scaleBarValue && this.scaleBarUnit;

      // 스케일바 모드인 경우 스케일바 값이 없을 때만 팝업 표시 - showPopup이 true일 때만 진행
      if (this.scaleMethod === 'scaleBar' && this.showPopup && !hasScaleBarValues) {
        // console.log('[mounted] 스케일바 모드로 첫 마운트, 팝업 표시 시도');
        // 팝업 표시를 위한 플래그 설정
        // this.showScaleChoicePopup = true;
        
        // 직접 DOM에 팝업 생성
        setTimeout(() => {
          // this.showScaleDetectionFailurePopup();
          
          // 내장 팝업도 가시성 확보
          this.$nextTick(() => {
            try {
              const popupElement = document.querySelector('.scale-choice-popup');
              if (popupElement) {
                // console.log('[mounted] 팝업 요소에 스타일 직접 적용');
                popupElement.style.display = 'flex';
                popupElement.style.zIndex = '999999';
              }
            } catch (e) {
              console.error('[mounted] 팝업 스타일 적용 중 오류:', e);
            }
          });
        }, 100);
      } else if (hasScaleBarValues) {
        // console.log('[mounted] 스케일바 값이 있어 팝업 표시하지 않음:', 
          // 'scaleBarValue:', this.scaleBarValue, 
          // 'scaleBarUnit:', this.scaleBarUnit,
          // 'manualScaleBarSet:', this.manualScaleBarSet);
      }
    } else {
      // console.log('[mounted] 재마운트, 측정 데이터 유지');
    }
    
    // 디버깅용 전역 변수 설정
    window.imageMeasurement = this;
    // console.log('Component mounted. Use window.imageMeasurement to access component in console');
    
    // 플래그 초기값 로깅
    // console.log('[mounted] 초기 상태 - showScaleChoicePopup:', this.showScaleChoicePopup);
    // console.log('[mounted] 초기 상태 - isFirstDetectionAttempt:', this.isFirstDetectionAttempt);
    // console.log('[mounted] 초기 상태 - scaleMethod:', this.scaleMethod);
    // console.log('[mounted] 초기 상태 - showPopup:', this.showPopup);
    
    // 디버깅 유틸리티 설정
    window.popupDebug = PopupDebug;
    // console.log('팝업 디버깅 유틸리티가 콘솔에 window.popupDebug로 노출되었습니다.');
    
    // 팝업 오버라이드 함수 전역으로 노출
    window.showScalePopup = () => this.showScaleDetectionFailurePopup();
    
    // detectScaleBar 함수 패치
    setTimeout(() => {
      // console.log('[mounted] 팝업 오버라이드 시스템 적용 시도');
      const patchResult = patchDetectScaleBar(this);
      // console.log('[mounted] 패치 결과:', patchResult);
      
      // 스케일바 자동 감지 시도 (이미 이미지가 로드된 경우) - showPopup이 true일 때만 진행
      if (this.image && this.imageData && this.scaleMethod === 'scaleBar' && this.showPopup && !this.initialLoadDone) {
        // console.log('[mounted] 이미지 로드됨, 스케일바 감지 시도');
        this.scalebarManager.detectScaleBar();
      }
    }, 500);
    
    // 스케일바 관리자 초기화
    this.scalebarManager = new MSA6ScalebarManager(this);
  },
  beforeUnmount() {
    // 컴포넌트 언마운트 전에 클린업 수행
    // console.log('[MSA6_ImagePopup] beforeUnmount 호출됨');
    
    // 모든 이미지 URL 정리
    this.cleanupImageUrls();
    
    // 이벤트 리스너 제거 (안전하게 처리)
    try {
      // resize 이벤트 리스너 제거
      if (typeof window !== 'undefined' && window.removeEventListener) {
        if (this.onWindowResize) {
          window.removeEventListener('resize', this.onWindowResize);
          // console.log('[beforeUnmount] resize 이벤트 리스너 제거됨');
        }
      }
      
      // keydown 이벤트 리스너 제거
      if (typeof window !== 'undefined' && window.removeEventListener) {
        if (this.handleKeyDown) {
          window.removeEventListener('keydown', this.handleKeyDown);
          // console.log('[beforeUnmount] keydown 이벤트 리스너 제거됨');
        }
        
        if (this.keydownHandler) {
          document.removeEventListener('keydown', this.keydownHandler);
          this.keydownHandler = null;
          // console.log('[beforeUnmount] document keydown 이벤트 리스너 제거됨');
        }
      }
      
      // keyup 이벤트 리스너 제거
      if (typeof window !== 'undefined' && window.removeEventListener) {
        if (this.handleKeyUp) {
          window.removeEventListener('keyup', this.handleKeyUp);
          // console.log('[beforeUnmount] keyup 이벤트 리스너 제거됨');
        }
      }
      
      // MSA5 이미지 처리 이벤트 리스너 제거
      if (typeof window !== 'undefined' && window.removeEventListener) {
        if (this.handleMSA5ImageProcessed) {
          window.removeEventListener('msa5-image-processed', this.handleMSA5ImageProcessed);
          window.removeEventListener('msa6:imageProcessed', this.handleMSA5ImageProcessed);
          // console.log('[beforeUnmount] MSA5 이미지 처리 이벤트 리스너 제거됨');
        }
        
        // MSA5 프로세스 시작 이벤트 리스너 제거
        if (this.handleMSA5ProcessStart) {
          window.removeEventListener('msa5-process-start', this.handleMSA5ProcessStart);
          // console.log('[beforeUnmount] MSA5 프로세스 시작 이벤트 리스너 제거됨');
        }
      }
    } catch (error) {
      console.error('[beforeUnmount] 이벤트 리스너 제거 중 오류:', error);
    }
  },
  computed: {
    // 현재 모드에 따른 평균
    currentAverage() {
      if (this.filteredMeasurements.length === 0) return 0;
      
      const sum = this.filteredMeasurements.reduce((total, segment) => {
        return total + (segment.value || 0);
      }, 0);
      
      return sum / this.filteredMeasurements.length;
    },

    // 현재 모드에 따른 표준편차
    currentStandardDeviation() {
      if (this.filteredMeasurements.length <= 1) return 0;
      
      const mean = this.currentAverage;
      const squaredDifferences = this.filteredMeasurements.map(segment => {
        const diff = (segment.value || 0) - mean;
        return diff * diff;
      });
      
      const variance = squaredDifferences.reduce((sum, diff) => sum + diff, 0) / this.filteredMeasurements.length;
      return Math.sqrt(variance);
    },

    // 현재 모드에 따른 3σ
    currentThreeSigma() {
      return this.currentAverage + (3 * this.currentStandardDeviation);
    },
    averageMeasurementValue() {
      if (this.filteredMeasurements.length === 0) return 0;
      
      const sum = this.filteredMeasurements.reduce((total, segment) => {
        return total + (segment.value || 0);
      }, 0);
      
      return sum / this.filteredMeasurements.length;
    },
    currentImageUrl() {
      let url;
      if (this.isShowingInputImage) {
        // 처리 전 이미지 표시
        url = this.internalInputImageUrl || this.inputImageUrl;
        // console.log('[currentImageUrl] 처리 전 이미지 선택:', url ? url.substring(0, 50) + '...' : '없음');
        // console.log('[currentImageUrl] 처리 전 - internalInputImageUrl:', this.internalInputImageUrl ? 'O' : 'X', 'inputImageUrl:', this.inputImageUrl ? 'O' : 'X');
      } else {
        // 처리 후 이미지 표시
        url = this.outputImageUrl || this.imageUrl;
        // console.log('[currentImageUrl] 처리 후 이미지 선택:', url ? url.substring(0, 50) + '...' : '없음');
        // console.log('[currentImageUrl] 처리 후 - outputImageUrl:', this.outputImageUrl ? 'O' : 'X', 'imageUrl:', this.imageUrl ? 'O' : 'X');
      }
      // console.log('[currentImageUrl] 최종 반환 URL:', url ? url.substring(0, 80) + '...' : '없음', 'isShowingInputImage:', this.isShowingInputImage);
      return url;
    },
    filteredMeasurements() {
      // 먼저 전체 측정값 로깅
      // console.log(`[filteredMeasurements] 모든 세그먼트 측정값: ${this.segmentedMeasurements.length}개`);
      
      // 각 측정값 카테고리별 수 계산
      const brightCount = this.segmentedMeasurements.filter(s => s.isBright).length;
      const darkCount = this.segmentedMeasurements.filter(s => !s.isBright).length;
      const totalCount = this.segmentedMeasurements.filter(s => s.isTotal).length;
      
      // console.log(`[filteredMeasurements] 측정값 카테고리: 밝은 영역=${brightCount}, 어두운 영역=${darkCount}, 전체 선=${totalCount}`);
      
      // 원래 필터링 로직에 isTotal이 아닌 항목만 포함하도록 수정
      const filtered = this.segmentedMeasurements.filter(segment => 
        (this.isReversed ? !segment.isBright : segment.isBright) && !segment.isTotal
      );
      
      // console.log(`[filteredMeasurements] 필터링된 측정값: ${filtered.length}개`);
      
      // 필터링된 측정값의 ID와 값 간략히 로깅
      filtered.forEach((segment, idx) => {
        if (idx < 10 || idx >= filtered.length - 5) { // 처음 10개와 마지막 5개만 로깅
          // console.log(`  측정값 #${idx+1}: ID=${segment.itemId}, SubID=${segment.subItemId}, 값=${segment.value?.toFixed(2)}`);
        } else if (idx === 10) {
          // console.log(`  ... 중간 ${filtered.length - 15}개 생략 ...`);
        }
      });
      
      return filtered;
    },
    brightnessTooltipStyle() {
      return {
        left: `${this.currentMousePos.x + 15}px`,
        top: `${this.currentMousePos.y - 10}px`
      };
    },
    magnifierStyle() {
      return {
        left: `${this.currentMousePos.x + 20}px`,
        top: `${this.currentMousePos.y - this.magnifierSize - 10}px`,
        width: `${this.magnifierSize}px`,
        height: `${this.magnifierSize}px`
      };
    },
  },
  watch: {
    // measurements prop 변경 감지하여 localMeasurements 업데이트
    measurements: {
      immediate: true,
      deep: true,
      handler(newMeasurements) {
        try {
          // prop 변경 시도를 완전히 방지하기 위한 안전장치
          if (this._isUpdatingMeasurements) {
            // console.log('[measurements watcher] 순환 업데이트 방지');
            return;
          }
          
          this._isUpdatingMeasurements = true;
          
          // 안전하게 배열 복사
          if (Array.isArray(newMeasurements)) {
            // 깊은 복사를 통해 prop과 완전히 분리된 새로운 배열 생성
            this.localMeasurements = JSON.parse(JSON.stringify(newMeasurements));
          } else {
            this.localMeasurements = [];
          }
          // console.log('[measurements watcher] localMeasurements 업데이트 완료:', this.localMeasurements.length, '개');
        } catch (error) {
          console.error('[measurements watcher] localMeasurements 업데이트 중 오류:', error);
          // 오류 발생 시 빈 배열로 초기화
          this.localMeasurements = [];
        } finally {
          // 플래그 해제
          this._isUpdatingMeasurements = false;
        }
      }
    },
    imageUrl: {
      immediate: true,
      handler(newUrl) {
        if (newUrl) {
          // console.logconsole.log('[watch:imageUrl] 이미지 URL 변경:', newUrl);
          
          // 새로운 이미지가 로드될 때 처리 후 이미지가 기본으로 표시되도록 상태 초기화
          this.isShowingInputImage = false;
          // console.log('[watch:imageUrl] 이미지 전환 상태 초기화 - 처리 후 이미지가 기본으로 설정됨');
          
          this.$nextTick(() => {
            this.loadImage(newUrl);
            
            // 이미지 로드 후 스케일바 감지 시도 (지연 적용)
            // 팝업이 열려있고 스케일바 모드일 때만 감지 실행 (단, 이미 감지된 경우는 제외)
            if (this.scaleMethod === 'scaleBar' && this.isVisible && !this.scaleBarDetected) {
              setTimeout(() => {
                // console.log('[watch:imageUrl] 이미지 URL 변경 후 스케일바 감지 시도');
                this.scalebarManager.detectScaleBar();
              }, 1000);
            }
          });
        } else {
          // imageUrl이 없는 경우 이미지 초기화 (추가)
          // console.log('[watch:imageUrl] 이미지 URL 없음, 이미지 초기화');
          // this.clearImage();
        }
      }
    },
    // inputImageUrl prop 변경 감지
    inputImageUrl: {
      immediate: true,
      handler(newUrl) {
        // console.log('[watch:inputImageUrl] 입력 이미지 URL 변경:', newUrl);
        if (newUrl) {
          // 내부 데이터 속성 업데이트
          this.internalInputImageUrl = newUrl;
          // console.log('[watch:inputImageUrl] 내부 입력 이미지 URL 업데이트됨');
        } else {
          // inputImageUrl이 없으면 세션 스토리지에서 MSA5 시작 이미지 확인
          const msa5StartImage = sessionStorage.getItem('msa5_start_image_url');
          if (msa5StartImage) {
            // console.log('[watch:inputImageUrl] 세션 스토리지에서 MSA5 시작 이미지 로드:', msa5StartImage ? msa5StartImage.substring(0, 50) + '...' : '없음');
            this.internalInputImageUrl = msa5StartImage;
          }
        }
      }
    },
    magnification: {
      handler() {
        // 배율 변경 시 모든 측정값 업데이트
        this.updateAllMeasurements();
      }
    },
    showPopup: {
      immediate: true,
      handler(newVal) {
        // console.log('[watch:showPopup] 팝업 표시 상태 변경:', newVal);
        this.isVisible = newVal;
        
        if (newVal) {
          // 팝업이 표시될 때 openPopup 함수 호출
          this.openPopup();
          
          // 최초 로드 완료 플래그 설정
          if (!this.initialLoadDone) {
            this.initialLoadDone = true;
          }
        } else {
          // 팝업이 닫힐 때
          // console.log('[watch:showPopup] 팝업 닫힘, 데이터 유지');
          // closePopup은 호출하지 않음 - 사용자가 닫기 버튼을 통해 닫을 때만 호출됨
        }
      }
    },
    // 스케일바 감지 상태 감시
    scaleBarDetected: {
      handler(detected) {
        // console.log('[watch:scaleBarDetected] 스케일바 감지 상태 변경:', detected);
        
        if (detected) {
          // 스케일바가 감지되었을 때 manualScaleBarSet을 true로 설정하지 않음
          // 자동 감지의 경우에도 manualScaleBarSet은 false로 유지
          // console.log('[watch:scaleBarDetected] 스케일바가 감지됨, 설정 저장');
          
          // 설정 저장
          this.scalebarManager.saveScaleBarSettings();
          
          // 이미 수동 스케일바가 설정되어 있는 경우 팝업 표시하지 않음
          // (이 플래그가 true인 경우 팝업 표시를 방지하기 위해 사용)
          // 조건 강화: 수동 스케일바가 설정되어 있고 값도 있는 경우에만 팝업 방지
          if (this.manualScaleBarSet && this.scaleBarValue && this.scaleBarUnit) {
            // console.log('[watch:scaleBarDetected] 수동 스케일바가 이미 설정되어 있어 팝업을 표시하지 않음:',
            //   'manualScaleBarSet:', this.manualScaleBarSet,
            //   'scaleBarValue:', this.scaleBarValue,
            //   'scaleBarUnit:', this.scaleBarUnit);
            
            // 팝업 표시 방지
            // this.showScaleChoicePopup = false;
            return;
          }
        }
        
        // 팝업 표시 여부 결정 - 팝업이 열려있을 때만 알림 표시
        if (!detected && this.scaleMethod === 'scaleBar' && this.isVisible) {
          // console.log('[watch:scaleBarDetected] 감지 실패, 선택 팝업 표시');
          
          // 팝업 표시 플래그 설정
          // this.showScaleChoicePopup = true;
          
          // 별도 메서드로 팝업 표시 (약간 지연)
          this.$nextTick(() => {
            this.scalebarManager.showScaleDetectionFailurePopup();
          });
          
          this.showNotification('스케일바 자동 감지에 실패했습니다. 측정 방식을 선택해주세요.', 'warning');
        }
      }
    },
    // Watch the showPopup prop and update local state
    showPopup: {
        immediate: true,
        handler(newVal) {
            this.isVisible = newVal;
        }
    },
  },
  methods: {
    createAreaMeasurements,
    createBoundedSegments,
    // 기준선 기반 자르기 유틸리티 함수들 추가
    trimMeasurementByReferenceLine,
    trimSingleMeasurementByReferenceLine,
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
},
    downloadCSV() {
  if (this.filteredMeasurements.length === 0) {
    this.showNotification('다운로드할 측정 데이터가 없습니다.', 'warning');
    return;
  }

  // CSV 헤더
  const headers = ['Item ID', 'Sub ID', '값'];
  
  // CSV 데이터 생성
  const csvData = this.filteredMeasurements.map(segment => [
    segment.itemId,
    segment.subItemId,
    segment.value?.toFixed(2) || '0.00'
  ]);
  
  // 현재 모드 통계 정보 추가
  const currentArea = this.isReversed ? '어두운 영역' : '밝은 영역';
  const statsData = [
    ['', '', ''],
    ['통계 정보', '', ''],
    ['영역', '', currentArea],
    ['평균', '', this.currentAverage.toFixed(2)],
    ['표준편차', '', this.currentStandardDeviation.toFixed(2)],
    ['3σ', '', this.currentThreeSigma.toFixed(2)],
    ['총 측정 수', '', this.filteredMeasurements.length.toString()]
  ];
  
  // CSV 문자열 생성
  const csvContent = [
    headers.join(','),
    ...csvData.map(row => row.join(',')),
    ...statsData.map(row => row.join(','))
  ].join('\n');
  
  // 파일명 생성 (현재 시간 포함)
  const now = new Date();
  const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
  const filename = `measurement_results_${timestamp}.csv`;
  
  // CSV 파일 다운로드
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  this.showNotification('CSV 파일이 다운로드되었습니다.', 'success');
},
    // 측정값 초기화 함수 추가
    initializeMeasurements() {
      try {
        // measurements prop을 로컬 변수로 안전하게 복사
        if (Array.isArray(this.measurements)) {
          this.localMeasurements = JSON.parse(JSON.stringify(this.measurements));
        } else {
          this.localMeasurements = [];
        }
        
        // 측정 관련 상태 초기화
        this.segmentedMeasurements = [];
        this.defectMeasurements = [];
        this.referenceLines = [];
        this.activeReferenceLine = null;
        
        // 선택 상태 초기화
        this.selectedRows = [];
        this.selectedMeasurement = null;
        this.selectedSegment = null;
        this.selectedAreaRect = null;
        
        // ID 카운터 초기화
        this.nextId = 1;
        this.brightSubIdCounter = 1;
        this.darkSubIdCounter = 1;
        this.referenceId = 1;
        // 전역 불량감지 ID 카운터는 유지 (누적 ID를 위해 초기화하지 않음)
        // this.globalDefectIdCounter = 1;
        
        // 이력 초기화
        this.undoHistory = [];
        this.redoHistory = [];
        
        // console.log('[initializeMeasurements] 측정값 초기화 완료:', this.localMeasurements.length, '개');
      } catch (error) {
        console.error('[initializeMeasurements] 초기화 중 오류:', error);
        this.localMeasurements = [];
      }
    },
    
    async loadImage(url) {
      // console.log('[loadImage] 이미지 로드 시작:', url);
      
      if (!url) {
        // console.error('[loadImage] 유효한 URL이 제공되지 않음');
        return;
      }
      
      // 이미지 URL 설정
      this.outputImageUrl = url;
        
      // 이전 이미지 제거
      if (this.image) {
        // this.image.src = ''; // 이전 이미지 로드 취소
        // console.log('[loadImage] 이전 이미지 정리');
      }
      
      // 새 이미지 객체 생성
      this.image = new Image();
      this.image.crossOrigin = 'anonymous'; // CORS 이슈 방지
      this.image.src = url;
      
      // 저장된 스케일바 설정 복원
      this.scalebarManager.restoreScaleBarSettings();
      
      // 수동 스케일바 설정 유효성 검증
      const { hasValidManualScaleBar } = this.scalebarManager.validateScaleBarSettings();
        
      // 수동 스케일바 설정이 있고 유효한 경우에만 scaleBarDetected를 true로 설정
      if (hasValidManualScaleBar) {
        // console.log('[loadImage] 유효한 수동 스케일바 설정 확인:', 
          // 'scaleBarValue:', this.scaleBarValue, 
          // 'scaleBarUnit:', this.scaleBarUnit);
        this.scaleBarDetected = true;
      }
      
      // 비동기로 이미지 로드 처리
      this.image.onload = async () => {
          // console.log('[loadImage] 이미지 로드 완료');
          // 이미지 로드 후 캔버스 크기 업데이트
          this.updateCanvasSize();
          
          // 캔버스 스타일 강제 업데이트
          const canvas = this.$refs.canvas;
          if (canvas) {
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.margin = '0';
            canvas.style.padding = '0';
            
            // 강제 리플로우 트리거 (브라우저 레이아웃 재계산)
            void canvas.offsetHeight;
          }
          
        // 이미지 데이터 추출을 위한 임시 캔버스
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.image.naturalWidth;
        tempCanvas.height = this.image.naturalHeight;
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
        
        tempCtx.drawImage(this.image, 0, 0);
        this.imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
          
        // 팝업 표시 여부 결정 - 수동 스케일바가 설정되어 있는지 정확히 확인
        // console.log('[loadImage] 수동 스케일바 설정 상태 확인:', 
        //   'manualScaleBarSet:', this.manualScaleBarSet, 
        //   'scaleBarValue:', this.scaleBarValue, 
        //   'scaleBarUnit:', this.scaleBarUnit,
        //   '유효한 설정:', hasValidManualScaleBar);
        
        // ⚠️ 주의: 이 부분은 MSA5 프로세스 시작 시 스케일바 팝업 방지를 위한 핵심 로직입니다. 수정 시 주의하세요! ⚠️
        // 스케일바 자동 감지 팝업 방지 플래그 확인
        const noScalePopup = sessionStorage.getItem('msa6_no_scale_popup') === 'true';
        if (noScalePopup) {
          // console.log('[loadImage] 스케일바 자동 감지 팝업 방지 플래그가 설정되어 있어 팝업을 표시하지 않음');
          // 플래그 제거 (일회성)
          sessionStorage.removeItem('msa6_no_scale_popup');
          return;
        }
        
        // MSA5 초기화 후 스케일바 재검출 필요 플래그 확인
        const needScaleDetection = sessionStorage.getItem('msa6_need_scale_detection') === 'true';
        
        // 수동 스케일바가 설정되어 있고 유효한 경우 팝업 표시하지 않음 (단, 재검출 필요한 경우 제외)
        if (hasValidManualScaleBar && !needScaleDetection) {
          // console.log('[loadImage] 유효한 수동 스케일바가 이미 설정되어 있어 팝업 표시하지 않음');
        }
        // 스케일바 모드이고 (수동 설정이 안 된 경우 또는 재검출이 필요한 경우)에만 자동 감지 시도
        else if (this.scaleMethod === 'scaleBar' && this.showPopup && (!hasValidManualScaleBar || needScaleDetection)) {
          // console.log('[loadImage] 스케일바 자동 감지 시도');
          if (needScaleDetection) {
            // console.log('[loadImage] MSA5 초기화 후 스케일바 재검출 필요');
            sessionStorage.removeItem('msa6_need_scale_detection'); // 플래그 제거
          }
        // 자동 감지 실행 - 감지 성공 여부는 detectScaleBar 내에서 처리
        this.scalebarManager.detectScaleBar(true); // true = 감지 실패 시 팝업 표시 강제
        } else {
          // console.log('[loadImage] 자동 감지 미실행:', 
            // '방식:', this.scaleMethod, 
            // '팝업표시:', this.showPopup, 
            // '수동설정여부:', this.manualScaleBarSet);
      }
      
      // 이미지가 로드된 후 기존 측정값 렌더링
      if (this.initialLoadDone && this.localMeasurements.length > 0) {
        // console.log('[loadImage] 기존 측정값 렌더링');
        this.$nextTick(() => this.render());
      }
      
      // // 로그 저장 - 측정 팝업 열기
      // LogService.logAction('open_measurement_popup', {
      //   imageLoaded: true
      //   });
      };
      
      // 이미지 로드 실패 처리
      this.image.onerror = (error) => {
        console.error('[loadImage] 이미지 로드 실패:', error);
        
        // 사용자에게 알림
        this.showNotification('이미지를 불러오는데 실패했습니다. 다시 시도해주세요.', 'error');
        
        // 로그 저장 - 이미지 로드 실패
        // LogService.logAction('image_load_error', {
        //   url: url,
        //   error: error ? error.toString() : 'Unknown error'
        // });
      };
    },
    async handleImageLoad(event) {
      // Get the image element from the event or reference
      const img = event.target || this.$refs.sourceImage;
      
      // console.log('[handleImageLoad] 이미지 로드 완료 - 크기:', img.naturalWidth, 'x', img.naturalHeight);
      // console.log('[handleImageLoad] isToggling 상태:', this.isToggling);
      this.image = img;
      
      // 원본 이미지 비율 저장
      this.imageRatio = img.naturalWidth / img.naturalHeight;
      
      // 이미지 데이터 추출을 위한 임시 캔버스
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = img.naturalWidth;
      tempCanvas.height = img.naturalHeight;
      const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
      
      tempCtx.drawImage(img, 0, 0);
      this.imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      
      this.updateCanvasSize();
      
      // 전환 중인 경우 스케일바 관련 처리는 건너뛰고 렌더링만 수행
      if (this.isToggling) {
        // console.log('[handleImageLoad] 이미지 전환 중, 스케일바 처리 건너뛰고 렌더링만 수행');
        // 이미지 로드 완료 후 캔버스 다시 그리기
        this.$nextTick(() => {
          this.render();
        });
        return;
      }
      
      // 수동 스케일바 설정 여부 정확히 확인
      // console.log('[handleImageLoad] 수동 스케일바 설정 상태 확인:', 
      //   'manualScaleBarSet:', this.manualScaleBarSet, 
      //   'scaleBarValue:', this.scaleBarValue, 
      //   'scaleBarUnit:', this.scaleBarUnit);
      
      // 스케일바 자동 감지 팝업 방지 플래그 확인
      const noScalePopup = sessionStorage.getItem('msa6_no_scale_popup') === 'true';
      if (noScalePopup) {
        // console.log('[handleImageLoad] 스케일바 자동 감지 팝업 방지 플래그가 설정되어 있어 팝업을 표시하지 않음');
        // 플래그 제거 (일회성)
        sessionStorage.removeItem('msa6_no_scale_popup');
        return;
      }
      
      // 스케일바 모드이고 수동 스케일바가 설정되어 있지 않은 경우에만 팝업 표시
      if (this.scaleMethod === 'scaleBar' && this.showPopup && 
          !(this.manualScaleBarSet && this.scaleBarValue && this.scaleBarUnit)) {
          // console.log('[handleImageLoad] 스케일바 모드, 수동 스케일바 없음, 선택 팝업 표시');
          
          // 여기서 직접 팝업 표시
          // this.showScaleChoicePopup = true;
          
          // 잠시 지연 후 오버라이드 팝업 표시
          setTimeout(() => {
            // this.showScaleDetectionFailurePopup();
            
            // 내장 팝업도 표시
            this.$nextTick(() => {
              try {
                const popupElement = document.querySelector('.scale-choice-popup');
                if (popupElement) {
                  // console.log('[handleImageLoad] 팝업 요소에 스타일 직접 적용');
                  popupElement.style.display = 'flex';
                  popupElement.style.zIndex = '999999';
                }
              } catch (e) {
                console.error('[handleImageLoad] 팝업 스타일 적용 중 오류:', e);
              }
            });
          }, 100);
        } else {
          // console.log('[handleImageLoad] 수동 스케일바가 이미 설정되어 있어 팝업 표시하지 않음:', 
          // this.scaleBarValue, this.scaleBarUnit, 'manualScaleBarSet:', this.manualScaleBarSet);
      }
      
      // 스케일바 자동 감지 시도 - 최초 로드 시에만 시도, 그리고 수동 스케일바가 없는 경우에만
      if (this.scaleMethod === 'scaleBar' && !this.initialLoadDone && 
          !(this.manualScaleBarSet && this.scaleBarValue && this.scaleBarUnit)) {
        // console.log('[handleImageLoad] 이미지 로드 완료, 스케일바 감지 시도, 초기 로드 상태:', this.$_isInitialLoad);
        this.scalebarManager.detectScaleBar();
      }
      
      // 처음 로드인 경우 플래그 설정
      if (!this.initialLoadDone) {
        this.initialLoadDone = true;
        this.$_isInitialLoad = false;
      }
      
      // 이미지 로드 완료 후 캔버스 다시 그리기
        this.$nextTick(() => {
          this.render();
        });
    },
    updateCanvasSize() {
      // console.log('[updateCanvasSize] 캔버스 크기 조정 시작');
      const container = this.$refs.container;
      if (!container) {
        console.error('[updateCanvasSize] 캔버스 컨테이너 참조 없음');
        return;
      }

      const img = this.$refs.sourceImage;
      const canvas = this.$refs.canvas;
      
      if (!canvas) {
        console.error('[updateCanvasSize] 캔버스 참조 없음');
        return;
      }
      
      // 컨테이너 크기 확인 - 0인 경우 처리
      const canvasWidth = container.clientWidth;
      const canvasHeight = container.clientHeight;
      
      if (canvasWidth <= 0 || canvasHeight <= 0) {
        // 경고 메시지를 더 상세하게 수정하고 재시도 로직 개선
        // console.warn('[updateCanvasSize] 컨테이너 크기가 유효하지 않음, 재시도 예정:', {
        //   containerWidth: canvasWidth,
        //   containerHeight: canvasHeight
        // });
        
        // 컨테이너가 아직 렌더링되지 않은 경우 다음 프레임에서 재시도
        this.$nextTick(() => {
          setTimeout(() => {
            if (container.clientWidth > 0 && container.clientHeight > 0) {
              this.updateCanvasSize();
            } else {
              // 여러 번 재시도 후에도 크기가 0이면 기본값으로 설정
              // console.warn('[updateCanvasSize] 컨테이너 크기 재시도 후에도 유효하지 않음, 기본값 사용');
              canvas.width = 800;
              canvas.height = 600;
              canvas.style.width = '100%';
              canvas.style.height = '100%';
              this.ctx = canvas.getContext('2d');
            }
          }, 100);
        });
        return;
      }
      
      // 이미지 요소의 크기 확인
      let imgWidth = img ? img.clientWidth : 0;
      let imgHeight = img ? img.clientHeight : 0;
      
      // console.log(`[updateCanvasSize] 이미지 크기: ${imgWidth}x${imgHeight}, 컨테이너 크기: ${container.clientWidth}x${container.clientHeight}`);
      
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      
      // 캔버스를 컨테이너에 맞게 항상 꽉 채움 (마진 없이)
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.margin = '0';
      canvas.style.padding = '0';
      
      // 컨텍스트 재설정 및 이미지 다시 그리기
      this.ctx = canvas.getContext('2d', { willReadFrequently: true });
      
      // 이미지가 있는 경우에만 그리기 - 이미지 유효성 검증 추가
      if (img && this.image && img.complete && this.image.complete && this.image.width > 0) {
        try {
          this.ctx.drawImage(this.image, 0, 0, canvas.width, canvas.height);
        } catch (error) {
          console.error('[updateCanvasSize] 이미지 그리기 실패:', error);
        }
      } else {
        console.warn('[updateCanvasSize] 유효한 이미지 없음, 이미지 그리기 건너뜀');
      }
      
      // 기존 측정값들의 좌표 조정 - 초기화 시에는 건너뛰기
      if (this.prevWidth !== 1 && this.prevHeight !== 1) {
        this.adjustMeasurements(canvasWidth / this.prevWidth, canvasHeight / this.prevHeight);
      }
      
      this.prevWidth = canvasWidth;
      this.prevHeight = canvasHeight;
      
      // 모든 측정 데이터 렌더링
      this.render();
      
      // console.log('[updateCanvasSize] 캔버스 크기 조정 완료');
    },
    adjustMeasurements(scaleX, scaleY) {
      if (!isFinite(scaleX) || !isFinite(scaleY)) return;
      
      // 모든 측정값의 좌표 조정
      this.localMeasurements.forEach(measurement => {
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

      // 불량감지 측정값들의 좌표 조정 추가
      if (this.defectMeasurements && this.defectMeasurements.length > 0) {
        this.defectMeasurements.forEach(defect => {
          if (defect.start && defect.end) {
            defect.start.x *= scaleX;
            defect.start.y *= scaleY;
            defect.end.x *= scaleX;
            defect.end.y *= scaleY;
          }
          // 불량감지 영역의 중심점도 조정
          if (defect.center) {
            defect.center.x *= scaleX;
            defect.center.y *= scaleY;
          }
          // 타원의 중심점 좌표 조정
          if (defect.centerX !== undefined) {
            defect.centerX *= scaleX;
          }
          if (defect.centerY !== undefined) {
            defect.centerY *= scaleY;
          }
          // 타원의 반지름 조정
          if (defect.radiusX !== undefined) {
            defect.radiusX *= scaleX;
          }
          if (defect.radiusY !== undefined) {
            defect.radiusY *= scaleY;
          }
          // 사각형 영역 좌표 조정
          if (defect.x !== undefined) {
            defect.x *= scaleX;
          }
          if (defect.y !== undefined) {
            defect.y *= scaleY;
          }
          if (defect.width !== undefined) {
            defect.width *= scaleX;
          }
          if (defect.height !== undefined) {
            defect.height *= scaleY;
          }
          // 엣지 픽셀들의 좌표 조정
          if (defect.edgePixels && defect.edgePixels.length > 0) {
            defect.edgePixels.forEach(pixel => {
              if (pixel.x !== undefined) {
                pixel.x *= scaleX;
              }
              if (pixel.y !== undefined) {
                pixel.y *= scaleY;
              }
            });
          }
        });
      }

      // 선택된 불량감지 영역의 좌표 조정 추가
      if (this.selectedAreaRect) {
        this.selectedAreaRect.start.x *= scaleX;
        this.selectedAreaRect.start.y *= scaleY;
        this.selectedAreaRect.end.x *= scaleX;
        this.selectedAreaRect.end.y *= scaleY;
      }

      // 현재 드래그 중인 영역 변수들의 좌표 조정 추가
      if (this.areaStart) {
        this.areaStart.x *= scaleX;
        this.areaStart.y *= scaleY;
      }
      if (this.areaEnd) {
        this.areaEnd.x *= scaleX;
        this.areaEnd.y *= scaleY;
      }
      if (this.areaSelectionStart) {
        this.areaSelectionStart.x *= scaleX;
        this.areaSelectionStart.y *= scaleY;
      }
      if (this.areaSelectionEnd) {
        this.areaSelectionEnd.x *= scaleX;
        this.areaSelectionEnd.y *= scaleY;
      }

      // 기준선들의 좌표 조정 추가
      if (this.referenceLines && this.referenceLines.length > 0) {
        this.referenceLines.forEach(refLine => {
          if (refLine.start && refLine.end) {
            refLine.start.x *= scaleX;
            refLine.start.y *= scaleY;
            refLine.end.x *= scaleX;
            refLine.end.y *= scaleY;
          }
        });
      }

      // 현재 측정 중인 변수의 좌표 조정 추가
      if (this.currentMeasurement && this.currentMeasurement.start && this.currentMeasurement.end) {
        this.currentMeasurement.start.x *= scaleX;
        this.currentMeasurement.start.y *= scaleY;
        this.currentMeasurement.end.x *= scaleX;
        this.currentMeasurement.end.y *= scaleY;
      }

      // 수동 스케일바의 좌표 조정 추가
      if (this.manualScaleBar && this.manualScaleBar.start && this.manualScaleBar.end) {
        this.manualScaleBar.start.x *= scaleX;
        this.manualScaleBar.start.y *= scaleY;
        this.manualScaleBar.end.x *= scaleX;
        this.manualScaleBar.end.y *= scaleY;
      }

      // 스케일바 측정값의 좌표 조정 추가
      if (this.scaleBarMeasurement && this.scaleBarMeasurement.start && this.scaleBarMeasurement.end) {
        this.scaleBarMeasurement.start.x *= scaleX;
        this.scaleBarMeasurement.start.y *= scaleY;
        this.scaleBarMeasurement.end.x *= scaleX;
        this.scaleBarMeasurement.end.y *= scaleY;
      }

      // 삭제 모드 관련 변수들의 좌표 조정 추가
      if (this.deleteStart) {
        this.deleteStart.x *= scaleX;
        this.deleteStart.y *= scaleY;
      }
      if (this.deleteEnd) {
        this.deleteEnd.x *= scaleX;
        this.deleteEnd.y *= scaleY;
      }

      // 임시 드래그 라인의 좌표 조정 추가
      if (this.tempDragLine && this.tempDragLine.start && this.tempDragLine.end) {
        this.tempDragLine.start.x *= scaleX;
        this.tempDragLine.start.y *= scaleY;
        this.tempDragLine.end.x *= scaleX;
        this.tempDragLine.end.y *= scaleY;
      }

      // 선택된 영역의 좌표 조정 추가 (selectedArea)
      if (this.selectedArea && this.selectedArea.start && this.selectedArea.end) {
        this.selectedArea.start.x *= scaleX;
        this.selectedArea.start.y *= scaleY;
        this.selectedArea.end.x *= scaleX;
        this.selectedArea.end.y *= scaleY;
      }
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
      
      // 원본 이미지 좌표에서의 거리 계산
      const dx = endX - startX;
      const dy = endY - startY;
      
      // 피타고라스 정리로 거리 계산
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      let value;
      
      if (this.scaleMethod === 'scaleBar' && this.scaleBarDetected && this.scaleBarMeasurement) {
        // 스케일바 기반 측정
        const scaleBarPixelLength = this.scaleBarMeasurement.pixelLength;
        let scaleBarRealLength = this.scaleBarValue;
        
        // 단위 변환 (μm -> nm)
        if (this.scaleBarUnit === 'μm') {
          scaleBarRealLength *= 1000; // 1μm = 1000nm
        }
        
        // 픽셀 거리에 스케일 적용
        value = (distance / scaleBarPixelLength) * scaleBarRealLength;
        
        // console.log(`[calculateValue] 스케일바 기반 계산: 
          // 거리=${distance.toFixed(4)} 픽셀,
          // 스케일바=${scaleBarPixelLength.toFixed(2)} 픽셀 = ${this.scaleBarValue} ${this.scaleBarUnit},
          // 비율=${(scaleBarRealLength / scaleBarPixelLength).toFixed(4)} ${this.scaleBarUnit === 'μm' ? 'nm' : this.scaleBarUnit}/픽셀,
          // 최종값=${value.toFixed(2)} nm`);
      } else {
        // 배율 기반 측정 (기존 코드)
        value = distance * this.magnification;
        
        // console.log(`[calculateValue] 배율 기반 계산: 
        // 시작점=(${startX.toFixed(2)}, ${startY.toFixed(2)}), 
        // 끝점=(${endX.toFixed(2)}, ${endY.toFixed(2)}), 
        // dx=${dx.toFixed(2)}, dy=${dy.toFixed(2)}, 
        // 거리=${distance.toFixed(4)},
        // 배율=${this.magnification}, 
        // 최종값=${value.toFixed(2)}`);
      }
      
      // 결과값을 그대로 반환 (반올림하지 않음)
      return value;
    },
    
    startMeasurement(e) {
      // 불량 감지 중일 때는 측정 시작을 차단
      if (this.isDefectDetecting) {
        console.warn('불량 감지 진행 중에는 측정을 시작할 수 없습니다.');
        return;
      }
      
      if (!this.$refs.canvas) {
        console.warn('[startMeasurement] Canvas element not found');
        return;
      }

      if (this.isDeleteMode) {
        try {
          const pos = this.getLocalPos(e);
          if (!pos) return;
          this.deleteStart = {...pos};
          this.deleteEnd = null;
          this.isMeasuring = true;
          console.log('[startMeasurement] 삭제 모드 시작:', this.deleteStart);
          this.render();
        } catch (error) {
          console.error('[startMeasurement] Error in delete mode:', error);
        }
        return;
      }

      const pos = this.getLocalPos(e);
      if (!pos) return;

      if (this.isAreaSelectionMode) {
        this.areaSelectionStart = pos;
        this.areaSelectionEnd = null;
        this.isMeasuring = true;
        this.render();
        return;
      }

      // d키가 눌린 상태에서 클릭한 경우
      if (this.isDKeyPressed) {
        this.tempDragLine = {
          start: {...pos},
          end: {...pos}
        };
        this.render();
        return;
      }

      // 수동 스케일바 그리기 모드인 경우
      if (this.isDrawingScaleBar) {
        this.currentMeasurement = {
          start: {...pos},
          end: {...pos},
          isScaleBar: true
        };
        this.isMeasuring = true;
        this.render();
        return;
      }

      this.isMeasuring = true;

      // 기준 측정 시작 로직
      if (this.measurementMode === 'line' || this.measurementMode === 'reference') {
        this.currentMeasurement = {
          start: {...pos},
          end: {...pos}
        };
      } else if (this.measurementMode === 'circle' || (this.measurementMode && this.measurementMode.startsWith('area'))) {
        this.areaStart = {...pos};
        this.areaEnd = {...pos};
      } else if (this.measurementMode === 'defect') {
        // 불량감지 모드에서 영역 선택 시작
        this.areaStart = {...pos};
        this.areaEnd = {...pos};
      }
      
      this.render();
    },

    // 마우스 이동 시 currentMousePos 업데이트 (밝기값 표시 및 돋보기용)
    handleMouseMove(e) {
      if (!this.$refs.canvas) return;
      
      const rect = this.$refs.canvas.getBoundingClientRect();
      this.currentMousePos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      
      // F키가 눌린 상태에서만 밝기값 계산
      if (this.isFKeyPressed) {
        this.updateBrightnessAtPosition(e);
        this.updateMagnifier(e);
      }
    },

    // F키가 눌린 상태에서 밝기값 업데이트
    updateBrightnessAtPosition(e) {
      if (!this.$refs.canvas) return;
      
      const pos = this.getLocalPos(e);
      this.currentBrightness = this.calculateBrightness(pos.x, pos.y);
    },
    
    // 돋보기 기능 업데이트
    updateMagnifier(e) {
      if (!this.$refs.canvas || !this.$refs.magnifierCanvas) return;
      
      const pos = this.getLocalPos(e);
      const magnifierCanvas = this.$refs.magnifierCanvas;
      const magnifierCtx = magnifierCanvas.getContext('2d');
      
      // 돋보기 캔버스 크기 설정
      magnifierCanvas.width = this.magnifierSize;
      magnifierCanvas.height = this.magnifierSize;
      
      // 원본 캔버스에서 해당 영역 추출
      const sourceSize = 50; // 원본에서 가져올 영역 크기
      const sourceX = pos.x - sourceSize / 2;
      const sourceY = pos.y - sourceSize / 2;
      
      try {
        magnifierCtx.clearRect(0, 0, this.magnifierSize, this.magnifierSize);
        
        // 원본 캔버스에서 이미지 데이터 복사하고 확대
        magnifierCtx.drawImage(
          this.$refs.canvas,
          sourceX, sourceY, sourceSize, sourceSize,
          0, 0, this.magnifierSize, this.magnifierSize
        );
      } catch (error) {
        console.error('돋보기 업데이트 오류:', error);
      }
    },

    // 캔버스 클릭 시 해당 위치의 밝기값을 임계값으로 설정
    handleCanvasClick(e) {
      if (!this.$refs.canvas) return;
      
      // 측정 중일 때는 클릭 처리하지 않음
      if (this.isMeasuring) return;
      
      // F키가 눌린 상태일 때만 임계값 변경
      if (!this.isFKeyPressed) return;
      
      const pos = this.getLocalPos(e);
      const brightness = this.calculateBrightness(pos.x, pos.y);
      
      // 클릭한 위치의 밝기값을 임계값으로 설정
      this.brightnessThreshold = brightness;
      
      // 알림 표시
      this.showNotification(`밝기 임계값이 ${brightness}로 설정되었습니다.`, 'info');
      
      // 현재 밝기값도 업데이트
      this.currentBrightness = brightness;
    },

    updateMeasurement(e) {
      if (!this.$refs.canvas) {
        console.warn('[updateMeasurement] Canvas element not found');
        return;
      }

      if (this.isDeleteMode) {
        // 삭제 모드에서는 isMeasuring이 true이고 시작점이 있을 때만 업데이트
        if (!this.isMeasuring || !this.deleteStart) {
          return;
        }
        try {
          const pos = this.getLocalPos(e);
          if (!pos) return;
          this.deleteEnd = pos;
          this.render();
        } catch (error) {
          console.error('[updateMeasurement] Error in delete mode:', error);
        }
        return;
      }

      if (!this.isMeasuring) return;

      const pos = this.getLocalPos(e);
      if (!pos) return;

      if (this.isAreaSelectionMode) {
        this.areaSelectionEnd = pos;
        this.render();
        return;
      }

      // d키가 눌린 상태에서 드래그 중인 경우
      if (this.isDKeyPressed && this.tempDragLine) {
        this.tempDragLine.end = {...pos};
        this.render();
        return;
      }

      // 수동 스케일바 그리기 모드인 경우
      if (this.isDrawingScaleBar && this.currentMeasurement) {
        this.currentMeasurement.end = {...pos};
        this.render();
        return;
      }

      // 기존 측정 업데이트 로직
      if ((this.measurementMode === 'line' || this.measurementMode === 'reference') && this.currentMeasurement) {
        this.currentMeasurement.end = {...pos};
      } else if (this.measurementMode === 'circle' || this.measurementMode.startsWith('area')) {
        this.areaEnd = {...pos};
      } else if (this.measurementMode === 'defect') {
        // 불량감지 모드에서 영역 선택 업데이트
        this.areaEnd = {...pos};
      }
      
      this.render();
    },
    endMeasurement(e) {
      if (!this.$refs.canvas) {
        console.warn('[endMeasurement] Canvas element not found');
        return;
      }

      if (this.isDeleteMode) {
        try {
          if (this.isMeasuring && this.deleteStart && this.deleteEnd) {
            this.deleteMeasurementsInPath();
          }
        } catch (error) {
          console.error('[endMeasurement] Error in delete mode:', error);
        } finally {
          // 삭제 모드의 모든 상태 초기화
          this.deleteStart = null;
          this.deleteEnd = null;
          this.isMeasuring = false;
          this.render();
        }
        return;
      }

      if (!this.isMeasuring) return;

      if (this.isAreaSelectionMode) {
        if (this.areaSelectionStart && this.areaSelectionEnd) {
          // 영역 선택 처리
          const width = Math.abs(this.areaSelectionEnd.x - this.areaSelectionStart.x);
          const height = Math.abs(this.areaSelectionEnd.y - this.areaSelectionStart.y);
          
          if (width > 10 && height > 10) {
            this.selectedAreaRect = {
              start: { ...this.areaSelectionStart },
              end: { ...this.areaSelectionEnd }
            };
            // console.log('Selected area rect set:', this.selectedAreaRect);
          }
        }
        this.areaSelectionStart = null;
        this.areaSelectionEnd = null;
        this.isMeasuring = false;
        this.render();
        return;
      }

      // d키가 눌린 상태에서 드래그가 끝난 경우
      if (this.isDKeyPressed && this.tempDragLine) {
        this.handleDragEnd();
        return;
      }

      // 수동 스케일바 그리기 모드인 경우
      if (this.isDrawingScaleBar && this.currentMeasurement) {
        const distance = Math.sqrt(
          Math.pow(this.currentMeasurement.end.x - this.currentMeasurement.start.x, 2) +
          Math.pow(this.currentMeasurement.end.y - this.currentMeasurement.start.y, 2)
        );
        
        // 최소 길이 체크
        if (distance > 10) {
          // 그린 선을 스케일바로 설정
          this.manualScaleBar = { ...this.currentMeasurement };
          
          // 중요: 수동 스케일바 설정 플래그를 즉시 true로 설정
          this.manualScaleBarSet = true;
          // console.log('[endMeasurement] 수동 스케일바 설정 완료, manualScaleBarSet을 true로 설정');
          
          // 캔버스 좌표를 이미지 좌표로 변환
          const img = this.$refs.sourceImage;
          const canvas = this.$refs.canvas;
          
          const startX = (this.manualScaleBar.start.x / canvas.width) * img.naturalWidth;
          const startY = (this.manualScaleBar.start.y / canvas.height) * img.naturalHeight;
          const endX = (this.manualScaleBar.end.x / canvas.width) * img.naturalWidth;
          const endY = (this.manualScaleBar.end.y / canvas.height) * img.naturalHeight;
          
          // 스케일바 픽셀 길이 계산
          const pixelLength = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
          
          // 스케일바 측정값 저장
          this.scaleBarMeasurement = {
            start: this.manualScaleBar.start,
            end: this.manualScaleBar.end,
            pixelLength: pixelLength,
            unit: this.scaleBarUnit
          };
          
          // console.log(`[endMeasurement] 스케일바 측정값 저장:`, JSON.stringify(this.scaleBarMeasurement));
          // console.log(`[endMeasurement] 스케일바 픽셀 길이: ${pixelLength}, 단위: ${this.scaleBarUnit}`);
          
          // 스케일바 감지 상태 업데이트
          this.scaleBarDetected = true;
          
          // 현재 상태 저장
          this.scalebarManager.saveScaleBarSettings();
          
          // 스케일바 값 입력 다이얼로그 표시
          this.scalebarManager.showScaleBarValueDialog();
          
          // 수동 스케일바 설정 완료 후 바로 측정 모드로 전환
          // isDrawingScaleBar 플래그를 false로 변경하여 다음 드래그는 측정으로 처리되게 함
          this.isDrawingScaleBar = false;
          
          // pendingMeasurementMode가 있으면 해당 모드로 전환, 없으면 기본 선측정 모드
          if (this.pendingMeasurementMode) {
            this.measurementMode = this.pendingMeasurementMode;
            
            // 불량 감지 모드인 경우 관련 설정 활성화
            if (this.pendingMeasurementMode === 'defect') {
              this.isAreaSelectionMode = true;
            }
            
            // 상태 변경 알림 표시
            const modeNames = {
              'area-vertical': '세로 영역 측정',
              'area-horizontal': '가로 영역 측정',
              'defect': '불량 감지'
            };
            const modeName = modeNames[this.pendingMeasurementMode] || this.pendingMeasurementMode;
            this.showNotification(`스케일바 설정 완료. ${modeName} 모드로 전환되었습니다.`, 'info');
            
            // 대기 중인 모드 초기화
            this.pendingMeasurementMode = null;
          } else {
            this.measurementMode = 'line';
            // 상태 변경 알림 표시
            this.showNotification('수동 스케일바 설정 완료. 선 측정 모드로 전환되었습니다.', 'info');
          }
          
          // 로그 기록 추가
          // console.log(`[endMeasurement] 수동 스케일바 설정 완료, 픽셀 길이: ${pixelLength}, 자동으로 ${this.measurementMode} 모드로 전환`);
        }
        
        this.currentMeasurement = null;
        this.isMeasuring = false;
        this.render();
        return;
      }

      // 기존 측정 종료 로직
      if ((this.measurementMode === 'line' || this.measurementMode === 'reference') && this.currentMeasurement) {
        const width = Math.abs(this.currentMeasurement.end.x - this.currentMeasurement.start.x);
        const height = Math.abs(this.currentMeasurement.end.y - this.currentMeasurement.start.y);
        
        if (width > 10 || height > 10) {
          let measurement = {
            ...this.currentMeasurement,
            isReference: this.measurementMode === 'reference',
            color: this.referenceLineColor,
            value: this.calculateValue(this.currentMeasurement.start, this.currentMeasurement.end)
          };
          
          if (this.measurementMode === 'reference') {
            // 기준선에는 별도의 ID 체계 사용
            measurement.itemId = `REF-${this.referenceId}`;
            measurement.subItemId = `REF-${this.referenceId}-1`;
            this.referenceLines.push(measurement);
            this.activeReferenceLine = measurement;
            this.referenceId++; // 기준선 ID만 증가
          } else {
            // 측정선에는 기존 nextId 사용
            measurement.itemId = this.nextId.toString();
            measurement.subItemId = `${this.nextId}-${this.subItemPrefix}1`;
            
            // 단일 선 측정 - 기준선 기반 자르기 기능 복원
            // 모든 기준선을 순회하면서 측정선을 자르기
            if (this.referenceLines.length > 0) {
              // 모든 기준선에 대해 순차적으로 자르기 적용
              for (const referenceLine of this.referenceLines) {
                measurement = this.trimSingleMeasurementByReferenceLine(measurement, referenceLine);
              }
              // 자른 후 값 다시 계산
              measurement.value = this.calculateValue(measurement.start, measurement.end);
              // 마지막 기준선의 ID를 참조로 설정 (기존 호환성 유지)
              measurement.relativeToReference = this.activeReferenceLine?.itemId;
            }
            
            // 측정값 추가를 히스토리에 저장 (추가 이전 상태)
            this.addToHistory('add', null);
            
            this.$emit('measurement-added', measurement); // 부모에게 이벤트 발생
            this.createBoundedSegments(measurement); // 선 측정 분할 처리
            
            this.nextId++; // 측정선 ID만 증가
          }
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
            // 불량감지 모드에서는 selectedAreaRect 설정하고 상태 초기화하지 않음
            this.selectedAreaRect = {
              start: { ...this.areaStart },
              end: { ...this.areaEnd }
            };
            // console.log('불량감지 영역 선택 완료:', this.selectedAreaRect);
            // 불량감지 모드에서는 여기서 return하여 상태 초기화 방지
            this.isMeasuring = false;
            this.render();
            return;
          } else if (this.measurementMode === 'circle') {
            // 측정값 추가를 히스토리에 저장 (추가 이전 상태)
            this.addToHistory('add', null);
            
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
            // this.measurements.push(measurement); // prop이므로 직접 수정 불가
            this.localMeasurements.push(measurement);
            this.$emit('measurement-added', measurement); // 부모에게 이벤트 발생
            this.segmentedMeasurements.push(measurement);
            
            // 부모 컴포넌트에 전체 측정값 업데이트 알림
            this.emitMeasurementsUpdate();
            
            this.nextId++;
          } else if (this.measurementMode.startsWith('area')) {
            // console.log(`[endMeasurement] 영역 측정 완료, 영역 측정 생성 시작 - 모드: ${this.measurementMode}, 기준선 있음: ${!!this.activeReferenceLine}`);
            
            // 영역 측정 생성 전 히스토리에 현재 상태 저장
            this.addToHistory('add-area', null);
            
            // 영역 측정 생성 전 현재 측정값 개수 저장
            const beforeCount = this.localMeasurements.length;
            
            // createAreaMeasurements 호출하여 생성된 측정값들을 받아옴
            const createdMeasurements = this.createAreaMeasurements();
            
            // 생성된 측정값들을 localMeasurements에 추가하고 부모에게 emit
            if (createdMeasurements && createdMeasurements.length > 0) {
              createdMeasurements.forEach(measurement => {
                this.localMeasurements.push(measurement);
                this.$emit('measurement-added', measurement);
              });
              
              // 부모 컴포넌트에 전체 측정값 업데이트 알림
              this.emitMeasurementsUpdate();
            }
          }
        }
      }
      
      // 모든 상태 초기화
      this.currentMeasurement = null;
      this.areaStart = null;
      this.areaEnd = null;
      this.isMeasuring = false;
      this.render();
    },
    calculateBrightness(x, y) {
      if (!this.imageData) return 128;
      
      const canvas = this.$refs.canvas;
      const img = this.$refs.sourceImage;
      
      // 캔버스 좌표를 원본 이미지 좌표로 변환
      const imageX = Math.floor((x / canvas.width) * img.naturalWidth);
      const imageY = Math.floor((y / canvas.height) * img.naturalHeight);
      
      // 주변 픽셀을 포함한 밝기 계산 (1x1 영역)
      let totalBrightness = 0;
      let pixelCount = 0;
      
      // 1x1 영역으로 변경 (중앙 픽셀만)
      const sampleX = imageX;
      const sampleY = imageY;
      
      if (sampleX >= 0 && sampleX < img.naturalWidth && 
          sampleY >= 0 && sampleY < img.naturalHeight) {
        const index = (sampleY * img.naturalWidth + sampleX) * 4;
        if (index >= 0 && index < this.imageData.data.length) {
          // 흑백 이미지의 경우 R 채널만 사용
          totalBrightness += this.imageData.data[index];
          pixelCount++;
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
      if (!canvas) {
        console.warn('getLocalPos: Canvas reference is null');
        return { x: 0, y: 0 };
      }
      
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    },
    
    
    render() {
      // 캔버스 요소와 컨텍스트 null 체크 강화
      if (!this.$refs.canvas) {
        console.error('[render] 캔버스 요소가 없음');
        return;
      }
      
      // 컨텍스트가 없는 경우 자동 초기화
      if (!this.ctx) {
        console.warn('[render] 컨텍스트가 없어 자동 초기화 시도');
        this.ctx = this.$refs.canvas.getContext('2d', { willReadFrequently: true });
        
        if (!this.ctx) {
          console.error('[render] 컨텍스트 초기화 실패');
          return;
        }
        // console.log('[render] 컨텍스트 자동 초기화 완료');
      }

      try {
        // 캔버스 크기 다시 한번 확인 - 0인 경우 처리 강화
        const canvas = this.$refs.canvas;
        if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
          console.error('[render] 캔버스 크기가 유효하지 않음:', {
            width: canvas?.width,
            height: canvas?.height,
            offsetWidth: canvas?.offsetWidth,
            offsetHeight: canvas?.offsetHeight
          });
          
          // 무한 루프 방지를 위한 재시도 제한
          if (!this._renderRetryCount) {
            this._renderRetryCount = 0;
          }
          
          if (this._renderRetryCount < 3) {
            this._renderRetryCount++;
            // console.log(`[render] 캔버스 크기 재시도 ${this._renderRetryCount}/3`);
            
            // 캔버스 크기가 0인 경우 다음 프레임에서 다시 시도
            if (canvas && (canvas.width <= 0 || canvas.height <= 0)) {
              this.$nextTick(() => {
                this.updateCanvasSize();
                setTimeout(() => this.render(), 100);
              });
            }
          } else {
            console.warn('[render] 캔버스 크기 재시도 횟수 초과, 렌더링 중단');
            this._renderRetryCount = 0; // 카운터 리셋
          }
          return;
        }
        
        // 성공적으로 렌더링이 시작되면 카운터 리셋
        this._renderRetryCount = 0;

        // 캔버스 지우기
        this.ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 이미지 그리기 전에 유효성 검사
        if (this.image && this.image.complete && this.image.naturalWidth > 0) {
          try {
            // 이미지 그리기 - 항상 꽉 채우면서 가운데 정렬되도록
            this.ctx.drawImage(this.image, 0, 0, canvas.width, canvas.height);
          } catch (drawError) {
            console.error('[render] 이미지 그리기 오류:', drawError);
            // 이미지가 로드되지 않은 경우 에러 메시지 표시
            this.ctx.fillStyle = '#f8f9fa';
            this.ctx.fillRect(0, 0, canvas.width, canvas.height);
            this.ctx.fillStyle = '#dc3545';
            this.ctx.font = '16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('이미지를 로드할 수 없습니다', canvas.width / 2, canvas.height / 2);
          }
        } else {
          // 이미지가 없거나 로드되지 않은 경우 회색 배경 표시
          this.ctx.fillStyle = '#f8f9fa';
          this.ctx.fillRect(0, 0, canvas.width, canvas.height);
          this.ctx.fillStyle = '#6c757d';
          this.ctx.font = '16px Arial';
          this.ctx.textAlign = 'center';
          this.ctx.fillText('이미지 로딩 중...', canvas.width / 2, canvas.height / 2);
        }

        // 기준선 먼저 그리기
        if (this.referenceLines.length > 0) {
          this.referenceLines.forEach((refLine, index) => {
            this.ctx.beginPath();
            this.ctx.strokeStyle = refLine.color || this.referenceLineColor;
            this.ctx.lineWidth = 4;
            this.ctx.setLineDash([]);
            this.ctx.moveTo(refLine.start.x, refLine.start.y);
            this.ctx.lineTo(refLine.end.x, refLine.end.y);
            this.ctx.stroke();
          });
        }

        // 측정된 선들 그리기
        if (this.measurementMode !== 'defect') {
          this.segmentedMeasurements.forEach(segment => {
            const shouldDisplay = this.isReversed ? segment.isBright : !segment.isBright;
            
            this.ctx.beginPath();
            if (shouldDisplay) {
              this.ctx.strokeStyle = 'blue';
              this.ctx.setLineDash([5, 5]);
            } else {
              this.ctx.strokeStyle = 'red';
              this.ctx.setLineDash([]);
            }
            
            this.ctx.lineWidth = 2;
            this.ctx.moveTo(segment.start.x, segment.start.y);
            this.ctx.lineTo(segment.end.x, segment.end.y);
            this.ctx.stroke();
            
            // 측정값 텍스트 표시 - shouldDisplay 조건 확인
            if (segment.value && !shouldDisplay) {
              const midX = (segment.start.x + segment.end.x) / 2;
              const midY = (segment.start.y + segment.end.y) / 2;
              
              // 텍스트 배경을 위한 반투명 사각형
              this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
              const text = `${segment.value.toFixed(2)}nm`;
              this.ctx.font = '12px Arial';
              const textMetrics = this.ctx.measureText(text);
              const textWidth = textMetrics.width;
              const textHeight = 12;
              
              this.ctx.fillRect(midX + 5, midY - textHeight - 5, textWidth + 6, textHeight + 4);
              
              // 측정값 텍스트
              this.ctx.fillStyle = 'white';
              this.ctx.font = '12px Arial';
              this.ctx.textAlign = 'left';
              this.ctx.fillText(text, midX + 8, midY - 8);
            }
          });
        }

        // 현재 측정 중인 선 그리기
        if (this.isMeasuring && this.currentMeasurement) {
          this.ctx.beginPath();
          this.ctx.strokeStyle = this.measurementMode === 'reference' ? this.referenceLineColor : 'blue';
          this.ctx.lineWidth = this.measurementMode === 'reference' ? 4 : 2;
          this.ctx.setLineDash([5, 5]);
          this.ctx.moveTo(this.currentMeasurement.start.x, this.currentMeasurement.start.y);
          this.ctx.lineTo(this.currentMeasurement.end.x, this.currentMeasurement.end.y);
          this.ctx.stroke();
        }

        // 수동 스케일바 그리기 추가
        if (this.manualScaleBar && this.scaleMethod === 'scaleBar') {
          this.ctx.beginPath();
          this.ctx.strokeStyle = '#FF6600'; // 주황색으로 구분
          this.ctx.lineWidth = 3;
          this.ctx.setLineDash([8, 4]); // 점선 패턴으로 구분
          this.ctx.moveTo(this.manualScaleBar.start.x, this.manualScaleBar.start.y);
          this.ctx.lineTo(this.manualScaleBar.end.x, this.manualScaleBar.end.y);
          this.ctx.stroke();
          
          // 스케일바 표시를 위한 텍스트 추가 (선택사항)
          if (this.scaleBarValue && this.scaleBarUnit) {
            this.ctx.fillStyle = '#FF6600';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            const midX = (this.manualScaleBar.start.x + this.manualScaleBar.end.x) / 2;
            const midY = (this.manualScaleBar.start.y + this.manualScaleBar.end.y) / 2 - 10;
            this.ctx.fillText(`${this.scaleBarValue} ${this.scaleBarUnit}`, midX, midY);
          }
        }

        // 불량 감지 결과 그리기 - 항상 표시 (measurementMode 조건 제거)
        if (this.defectMeasurements && this.defectMeasurements.length > 0) {
          this.defectMeasurements.forEach((defect, index) => {
            this.ctx.save();
            
            // 중심점 좌표가 있으면 직접 사용, 없으면 계산
            const centerX = defect.centerX || (defect.x + defect.width / 2);
            const centerY = defect.centerY || (defect.y + defect.height / 2);
            const radiusX = defect.radiusX || defect.width / 2;
            const radiusY = defect.radiusY || defect.height / 2;
            
            // 1. 실제 불량 영역의 edge 픽셀들을 빨간색 점으로 표시 (간단한 방식)
            if (defect.edgePixels && defect.edgePixels.length > 0) {
              this.ctx.fillStyle = '#ff0000';
              for (const edgePixel of defect.edgePixels) {
                this.ctx.fillRect(edgePixel.x - 1, edgePixel.y - 1, 2, 2);
              }
            }
            
            // 2. 장축/단축 기반 타원 테두리 (녹색 실선)
            this.ctx.beginPath();
            this.ctx.strokeStyle = '#00ff00';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([]);
            
            this.ctx.ellipse(
              centerX,
              centerY,
              radiusX,
              radiusY,
              0, 0, 2 * Math.PI
            );
            this.ctx.stroke();
            
            // 3. 불량 번호 표시 (녹색)
            this.ctx.fillStyle = '#00ff00';
            this.ctx.font = 'bold 12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(
              `${defect.id}`, 
              centerX, 
              centerY + 4
            );
            
            this.ctx.restore();
          });
        }

        // 선택 영역 박스 그리기 (불량감지용)
        if (this.selectedAreaRect) {
          this.ctx.beginPath();
          this.ctx.strokeStyle = '#ffff00'; // 노란색 테두리
          this.ctx.lineWidth = 2;
          this.ctx.setLineDash([5, 5]); // 점선 패턴
          
          const x = Math.min(this.selectedAreaRect.start.x, this.selectedAreaRect.end.x);
          const y = Math.min(this.selectedAreaRect.start.y, this.selectedAreaRect.end.y);
          const width = Math.abs(this.selectedAreaRect.end.x - this.selectedAreaRect.start.x);
          const height = Math.abs(this.selectedAreaRect.end.y - this.selectedAreaRect.start.y);
          
          this.ctx.strokeRect(x, y, width, height);
          
          // 선택 영역 반투명 배경
          this.ctx.fillStyle = 'rgba(255, 255, 0, 0.1)';
          this.ctx.fillRect(x, y, width, height);
        }

        // 현재 드래그 중인 영역 박스 그리기 (불량감지 모드)
        if (this.measurementMode === 'defect' && this.isMeasuring && this.areaStart && this.areaEnd) {
          this.ctx.beginPath();
          this.ctx.strokeStyle = '#ff00ff'; // 마젠타색 테두리
          this.ctx.lineWidth = 2;
          this.ctx.setLineDash([3, 3]); // 작은 점선 패턴
          
          const x = Math.min(this.areaStart.x, this.areaEnd.x);
          const y = Math.min(this.areaStart.y, this.areaEnd.y);
          const width = Math.abs(this.areaEnd.x - this.areaStart.x);
          const height = Math.abs(this.areaEnd.y - this.areaStart.y);
          
          this.ctx.strokeRect(x, y, width, height);
        }

        // 현재 드래그 중인 영역 박스 그리기 (영역 측정 모드)
        if (this.measurementMode.startsWith('area') && this.isMeasuring && this.areaStart && this.areaEnd) {
          const x = Math.min(this.areaStart.x, this.areaEnd.x);
          const y = Math.min(this.areaStart.y, this.areaEnd.y);
          const width = Math.abs(this.areaEnd.x - this.areaStart.x);
          const height = Math.abs(this.areaEnd.y - this.areaStart.y);
          
          // 실제 측정선들을 드래그 중에 그리기
          if (this.measurementMode === 'area-vertical') {
            // 세로 방향 실제 측정선들
            const lineSpacing = width / (this.lineCount - 1);
            for (let i = 0; i < this.lineCount; i++) {
              const lineX = x + i * lineSpacing;
              
              this.ctx.beginPath();
              this.ctx.strokeStyle = 'blue';
              this.ctx.lineWidth = 2;
              this.ctx.setLineDash([5, 5]); // 드래그 중임을 나타내는 점선
              this.ctx.moveTo(lineX, y);
              this.ctx.lineTo(lineX, y + height);
              this.ctx.stroke();
            }
          } else if (this.measurementMode === 'area-horizontal') {
            // 가로 방향 실제 측정선들
            const lineSpacing = height / (this.lineCount - 1);
            for (let i = 0; i < this.lineCount; i++) {
              const lineY = y + i * lineSpacing;
              
              this.ctx.beginPath();
              this.ctx.strokeStyle = 'blue';
              this.ctx.lineWidth = 2;
              this.ctx.setLineDash([5, 5]); // 드래그 중임을 나타내는 점선
              this.ctx.moveTo(x, lineY);
              this.ctx.lineTo(x + width, lineY);
              this.ctx.stroke();
            }
          }
        }

        // 영역 선택 모드의 현재 드래그 박스 그리기
        if (this.isAreaSelectionMode && this.isMeasuring && this.areaSelectionStart && this.areaSelectionEnd) {
          this.ctx.beginPath();
          this.ctx.strokeStyle = '#00ffff'; // 시안색 테두리
          this.ctx.lineWidth = 2;
          this.ctx.setLineDash([5, 3]); // 점선 패턴
          
          const x = Math.min(this.areaSelectionStart.x, this.areaSelectionEnd.x);
          const y = Math.min(this.areaSelectionStart.y, this.areaSelectionEnd.y);
          const width = Math.abs(this.areaSelectionEnd.x - this.areaSelectionStart.x);
          const height = Math.abs(this.areaSelectionEnd.y - this.areaSelectionStart.y);
          
          this.ctx.strokeRect(x, y, width, height);
          
          // 드래그 중인 영역 반투명 배경
          this.ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
          this.ctx.fillRect(x, y, width, height);
        }

        // 삭제 모드의 현재 드래그 선 그리기
        if (this.isDeleteMode && this.isMeasuring && this.deleteStart && this.deleteEnd) {
          this.ctx.beginPath();
          this.ctx.strokeStyle = '#ff0000'; // 빨간색 선
          this.ctx.lineWidth = 3;
          this.ctx.setLineDash([5, 5]); // 점선 패턴
          
          this.ctx.moveTo(this.deleteStart.x, this.deleteStart.y);
          this.ctx.lineTo(this.deleteEnd.x, this.deleteEnd.y);
          this.ctx.stroke();
          
          // 선의 양 끝에 원형 표시
          this.ctx.setLineDash([]); // 실선으로 변경
          this.ctx.fillStyle = '#ff0000';
          
          // 시작점 원
          this.ctx.beginPath();
          this.ctx.arc(this.deleteStart.x, this.deleteStart.y, 4, 0, 2 * Math.PI);
          this.ctx.fill();
          
          // 끝점 원
          this.ctx.beginPath();
          this.ctx.arc(this.deleteEnd.x, this.deleteEnd.y, 4, 0, 2 * Math.PI);
          this.ctx.fill();
        }

      } catch (error) {
        console.error('[render] 렌더링 중 오류:', error);
      }
    },
    emergencyStopDetection() {
      // console.log('🚨 불량 감지 즉시 중단 버튼 클릭됨');
      
      try {
        // 중단 확인 대화상자
        if (!confirm('불량 감지를 즉시 중단하시겠습니까?\n\n진행 중인 측정 내용이 모두 삭제됩니다.')) {
          // console.log('사용자가 중단을 취소했습니다.');
          return;
        }

        // 불량감지 중단 모듈 호출
        const result = emergencyStopDefectDetection();
        
        if (result.success) {
          // console.log('✅ 불량 감지 즉시 중단 성공:', result.message);
          
          // 성공 알림
          this.showNotification('불량 감지가 즉시 중단되었습니다.', 'info');
          
          // Vue 컴포넌트 상태 완전 정리
          this.finalizeEmergencyStop();
          
        } else {
          console.error('❌ 불량 감지 중단 실패:', result.message);
          
          // 실패 시에도 강제 초기화
          this.forceStopCleanup();
          
          // 오류 알림
          this.showNotification(
            result.message || '중단 중 오류가 발생했지만 강제 초기화되었습니다.', 
            'warning'
          );
        }
        
        // 추가 정리 작업 - 중단 상태 완전 리셋
        this.completeFinalCleanup();
        
      } catch (error) {
        console.error('긴급 중단 중 예외 발생:', error);
        
        // 예외 발생 시 강제 정리
        this.forceStopCleanup();
        this.completeFinalCleanup();
        
        this.showNotification('중단 중 오류가 발생했습니다. 시스템이 초기화되었습니다.', 'error');
      }
    },

    // 최종 정리 작업
    completeFinalCleanup() {
      try {
        // console.log('🔄 최종 정리 작업 시작');
        
        // 상태 완전 초기화
        this.isDefectDetecting = false;
        this.isApiSending = false;
        this.defectDetectionResult = null;
        
        // 불량감지 모드를 유지 - 모드 변경하지 않음
        this.measurementMode = 'defect';
        // console.log('최종 정리 - 불량감지 모드 유지:', this.measurementMode);
        
        // 다음 틱에서 UI 상태 강제 업데이트
        this.$nextTick(() => {
          // Vue의 반응성을 이용하여 자동으로 버튼 상태 업데이트
          // measurementMode가 'defect'로 설정되어 있으므로 템플릿에서 자동으로 활성화됨
          // console.log('불량감지 모드 유지 완료:', this.measurementMode);
          
          // 모든 버튼 상태 정상화
          const buttons = document.querySelectorAll('.option-btn, .start-btn, .reset-btn, .close-btn');
          buttons.forEach(btn => {
            btn.disabled = false;
            btn.style.pointerEvents = 'auto';
            btn.style.opacity = '1';
          });
          
          // 캔버스 상호작용 복원
          const canvas = this.$refs.canvas;
          if (canvas) {
            canvas.classList.remove('detecting-disabled');
            canvas.style.pointerEvents = 'auto';
            canvas.style.opacity = '1';
            canvas.style.cursor = 'auto';
          }
          
          // 강제 렌더링
          this.render();
        });
        
        // console.log('✅ 최종 정리 작업 완료 - 불량감지 모드 유지:', this.measurementMode);
        
      } catch (error) {
        console.error('최종 정리 작업 중 오류:', error);
      }
    },


    // 강제 중단 정리 (오류 발생 시)
    forceStopCleanup() {
      try {
        // console.log('🔄 강제 중단 정리 실행');
        
        // 모든 상태 강제 초기화
        this.isDefectDetecting = false;
        this.defectMeasurements = [];
        this.selectedDefects = [];
        this.defectDetectionResult = null;
        
        // 불량감지 모드를 명시적으로 설정하고 유지
        this.measurementMode = 'defect';
        // console.log('강제 중단 - 불량감지 모드 명시적 설정:', this.measurementMode);
        
        this.selectedAreaRect = null;
        this.selectedArea = null;
        
        // 중단 상태 리셋
        resetDefectStopState();
        
        // UI 상태 강제 업데이트
        this.$nextTick(() => {
          // Vue의 반응성을 이용하여 자동으로 버튼 상태 업데이트
          // measurementMode가 'defect'로 설정되어 있으므로 템플릿에서 자동으로 활성화됨
          // console.log('불량감지 모드 유지 완료:', this.measurementMode);
          
          // 모든 버튼 상태 정상화
          const buttons = document.querySelectorAll('.option-btn, .start-btn, .reset-btn, .close-btn');
          buttons.forEach(btn => {
            btn.disabled = false;
            btn.style.pointerEvents = 'auto';
            btn.style.opacity = '1';
          });
          
          // 캔버스 상호작용 복원
          const canvas = this.$refs.canvas;
          if (canvas) {
            canvas.classList.remove('detecting-disabled');
            canvas.style.pointerEvents = 'auto';
            canvas.style.opacity = '1';
            canvas.style.cursor = 'auto';
          }
          
          // 강제 렌더링
          this.render();
        });
        
        // console.log('강제 중단 정리 완료 - 불량감지 모드 유지:', this.measurementMode);
        
      } catch (error) {
        console.error('강제 중단 정리 중 오류:', error);
      }
    },

    // 선택 영역 불량 감지 - startDefectDetection과 동일한 기능
    async sendSelectedAreaToApi() {
      // console.log('선택 영역 불량 감지 버튼 클릭됨');
      
      if (!this.selectedAreaRect) {
        console.error('선택된 영역이 없습니다.');
        alert('먼저 영역을 선택해주세요.');
        return;
      }

      const canvas = this.$refs.canvas;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      
      if (!canvas || !ctx) {
        console.error('캔버스를 찾을 수 없습니다.');
        return;
      }

      // 이미지 데이터 가져오기
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // console.log('이미지 데이터:', { width: imageData.width, height: imageData.height });

      // 선택 영역을 올바른 형식으로 변환
      const boundingBox = {
        x: Math.min(this.selectedAreaRect.start.x, this.selectedAreaRect.end.x),
        y: Math.min(this.selectedAreaRect.start.y, this.selectedAreaRect.end.y),
        width: Math.abs(this.selectedAreaRect.end.x - this.selectedAreaRect.start.x),
        height: Math.abs(this.selectedAreaRect.end.y - this.selectedAreaRect.start.y)
      };

      // console.log('변환된 바운딩 박스:', boundingBox);

      try {
        this.isDefectDetecting = true;
        
        // 새로운 불량 감지 시작 전 기존 결과 초기화 - 제거하여 이전 결과 유지
        // this.clearDefectMeasurements();
        // console.log('새로운 불량 감지 시작 - 기존 결과 초기화 완료');
        // console.log('새로운 불량 감지 시작 - 이전 결과 유지');
        
        // 감지 중 UI 비활성화 - 모든 측정 모드 비활성화
        const previousMode = this.measurementMode;
        this.measurementMode = null;
        
        // DefectDetector 인스턴스 생성
        // 스케일바 영역 정보 준비
        let scaleBarExclusionArea = null;
        if (this.scaleMethod === 'scaleBar' && this.manualScaleBar) {
          // 스케일바 영역을 약간 확장하여 제외 영역으로 설정
          const padding = 20; // 스케일바 주변 여백
          const minX = Math.min(this.manualScaleBar.start.x, this.manualScaleBar.end.x) - padding;
          const maxX = Math.max(this.manualScaleBar.start.x, this.manualScaleBar.end.x) + padding;
          const minY = Math.min(this.manualScaleBar.start.y, this.manualScaleBar.end.y) - padding;
          const maxY = Math.max(this.manualScaleBar.start.y, this.manualScaleBar.end.y) + padding;
          
          scaleBarExclusionArea = {
            x: Math.max(0, minX),
            y: Math.max(0, minY),
            width: Math.min(canvas.width, maxX) - Math.max(0, minX),
            height: Math.min(canvas.height, maxY) - Math.max(0, minY)
          };
          
          // console.log('스케일바 제외 영역 설정:', scaleBarExclusionArea);
        }
        
        const detector = new DefectDetector(
          canvas,
          ctx,
          imageData,
          this.brightnessThreshold,
          this.isReversed,
          scaleBarExclusionArea, // 스케일바 제외 영역 전달
          this.$refs.sourceImage?.naturalWidth, // 원본 이미지 너비
          this.$refs.sourceImage?.naturalHeight, // 원본 이미지 높이
          this.imageData // 원본 이미지 데이터 (F키와 동일)
        );

        // console.log('DefectDetector 생성 완료:', {
        //   brightnessThreshold: this.brightnessThreshold,
        //   isReversed: this.isReversed
        // });

        // 중단 기능에 감지기와 Vue 인스턴스 등록
        registerDefectDetector(detector, this);
        // console.log('불량 감지 중단 기능 등록 완료');

        // 진행 상황 콜백
        const onProgress = (progress) => {
          // console.log(`감지 진행: ${progress.percentage}% (${progress.step}/${progress.totalSteps})`);
          // console.log(`박스 크기: ${progress.currentBoxSize}, 멈춘 픽셀: ${progress.stoppedPixels}개`);
        };

        // 완료 콜백
        const onComplete = (results, error) => {
          // console.log(`🎯 불량감지 완료 콜백 시작 - 현재 전역카운터: ${this.globalDefectIdCounter}, 발견된 불량: ${results ? results.length : 0}개`);
          this.isDefectDetecting = false;
          this.measurementMode = 'defect';
          // console.log('불량감지 완료 - 불량감지 모드 유지:', this.measurementMode);
          
          if (error) {
            console.error('불량감지 실패:', error);
            alert('불량감지 중 오류가 발생했습니다: ' + error.message);
            return;
          }

          // console.log('불량감지 완료!', results);
          
          // 불량 감지 완료 후 선택 영역 박스 제거
          this.selectedAreaRect = null;
          
          if (!results || results.length === 0) {
            // console.log('선택한 영역에서 불량이 발견되지 않았습니다.');
          } else {
            // 과도한 불량 감지에 대한 경고 (100개 이상)
            if (results.length >= 100) {
              const warningMsg = `⚠️ 불량 영역이 ${results.length}개로 매우 많이 감지되었습니다.\n\n이는 다음 원인일 수 있습니다:\n• 밝기 임계값이 부적절하게 설정됨\n• 배경 노이즈나 텍스처가 불량으로 감지됨\n• 선택 영역이 너무 넓음\n\n밝기 임계값을 조정하거나 더 작은 영역을 선택해보세요.`;
              alert(warningMsg);
            }
            
            // defectMeasurements 배열이 존재하는지 확인
            if (!this.defectMeasurements) {
              this.defectMeasurements = [];
            }
            
            // 결과를 defectMeasurements에 추가
            // console.log('불량감지 결과를 defectMeasurements에 추가:', results);
            
            // 현재 영역의 itemId 생성
            let currentAreaId = 1;
            if (this.defectMeasurements && this.defectMeasurements.length > 0) {
              const existingAreaIds = this.defectMeasurements
                .map(item => item.itemId)
                .filter(id => id && id.startsWith('defect'))
                .map(id => parseInt(id.replace('defect', '')) || 0);
              if (existingAreaIds.length > 0) {
                currentAreaId = Math.max(...existingAreaIds) + 1;
              }
            }
            
            const currentAreaItemId = `defect${currentAreaId}`;
            let subCounter = 1;
            
            results.forEach((result, index) => {
              // console.log(`🔍 불량 ${index + 1} 처리 시작 - 현재 전역카운터: ${this.globalDefectIdCounter}`);
              const defectId = this.globalDefectIdCounter++;
              // console.log(`🔍 불량 ${index + 1} ID 할당 완료 - 할당된 ID: ${defectId}, 증가 후 전역카운터: ${this.globalDefectIdCounter}`);
              
              // DefectDetector에서 전달된 원본 데이터 상세 로깅
              // console.log(`=== 불량 ${index + 1} 원본 데이터 상세 분석 ===`, {
              //   id: result.id,
              //   x: result.x,
              //   y: result.y,
              //   width: result.width,
              //   height: result.height,
              //   radiusX: result.radiusX,
              //   radiusY: result.radiusY,
              //   centerX: result.centerX,
              //   centerY: result.centerY,
              //   area: result.area,
              //   pixelCount: result.pixelCount,
              //   type: result.type
              // });
              
              // 스케일바 기준으로 픽셀을 실제 단위로 변환하는 함수
              const convertPixelToRealUnit = (pixelValue) => {
                // 입력값 검증
                if (!pixelValue || isNaN(pixelValue) || pixelValue <= 0) {
                  return 0;
                }
                
                if (this.scaleMethod === 'scaleBar' && this.manualScaleBar && this.scaleBarValue) {
                  // 스케일바 길이 (픽셀)
                  const scaleBarPixelLength = Math.sqrt(
                    Math.pow(this.manualScaleBar.end.x - this.manualScaleBar.start.x, 2) +
                    Math.pow(this.manualScaleBar.end.y - this.manualScaleBar.start.y, 2)
                  );
                  
                  // 스케일바 길이가 유효한지 확인
                  if (!scaleBarPixelLength || isNaN(scaleBarPixelLength) || scaleBarPixelLength <= 0) {
                    console.warn('스케일바 길이가 유효하지 않음, 픽셀 값 그대로 반환');
                    return pixelValue;
                  }
                  
                  // 픽셀당 실제 단위 계산
                  const pixelToRealRatio = this.scaleBarValue / scaleBarPixelLength;
                  const result = pixelValue * pixelToRealRatio;
                  
                  return isNaN(result) ? pixelValue : result;
                } else {
                  // 배율 기반 계산 (기존 방식)
                  const magnification = this.magnification || 500; // 기본값 설정
                  const result = pixelValue / magnification;
                  return isNaN(result) ? pixelValue : result;
                }
              };
              
              // 타원의 radiusX, radiusY 값 검증 및 기본값 설정 - 각 불량별 개별 값 사용
              const safeRadiusX = (result.radiusX && !isNaN(result.radiusX) && result.radiusX > 0) ? result.radiusX : 1;
              const safeRadiusY = (result.radiusY && !isNaN(result.radiusY) && result.radiusY > 0) ? result.radiusY : 1;
              
              // 각 불량별 개별 타원의 major axis와 minor axis 계산 (큰 반지름이 major, 작은 반지름이 minor)
              const majorAxisPixels = Math.max(safeRadiusX, safeRadiusY) * 2;
              const minorAxisPixels = Math.min(safeRadiusX, safeRadiusY) * 2;
              
              // 각 불량별 개별 면적 계산 - 타원 면적 공식 사용
              let safeArea = result.area;
              if (!safeArea || isNaN(safeArea) || safeArea <= 0) {
                // 각 불량의 실제 radiusX, radiusY를 사용한 타원 면적 공식: π * radiusX * radiusY
                safeArea = Math.PI * safeRadiusX * safeRadiusY;
              }
              
              // 각 불량별 스케일바 기준으로 변환된 값들
              const majorAxisScaled = convertPixelToRealUnit(majorAxisPixels);
              const minorAxisScaled = convertPixelToRealUnit(minorAxisPixels);
              
              // 면적 변환 - 제곱근 후 제곱하는 방식 대신 직접 면적 변환
              let areaScaled;
              if (this.scaleMethod === 'scaleBar' && this.manualScaleBar && this.scaleBarValue) {
                const scaleBarPixelLength = Math.sqrt(
                  Math.pow(this.manualScaleBar.end.x - this.manualScaleBar.start.x, 2) +
                  Math.pow(this.manualScaleBar.end.y - this.manualScaleBar.start.y, 2)
                );
                
                if (scaleBarPixelLength && !isNaN(scaleBarPixelLength) && scaleBarPixelLength > 0) {
                  const pixelToRealRatio = this.scaleBarValue / scaleBarPixelLength;
                  // 면적은 비율의 제곱으로 변환
                  areaScaled = safeArea * (pixelToRealRatio * pixelToRealRatio);
                } else {
                  areaScaled = safeArea;
                }
              } else {
                const magnification = this.magnification || 500;
                areaScaled = safeArea / (magnification * magnification);
              }
              
              // 최종 검증
              const finalMajorAxis = isNaN(majorAxisScaled) ? majorAxisPixels : majorAxisScaled;
              const finalMinorAxis = isNaN(minorAxisScaled) ? minorAxisPixels : minorAxisScaled;
              const finalArea = isNaN(areaScaled) ? safeArea : areaScaled;
              
              // 각 불량별 개별 계산 결과 디버깅 로그
              // console.log(`불량 ${index + 1} 개별 계산 결과:`, {
              //   defectId: defectId,
              //   originalRadiusX: result.radiusX,
              //   originalRadiusY: result.radiusY,
              //   safeRadiusX,
              //   safeRadiusY,
              //   majorAxisPixels,
              //   minorAxisPixels,
              //   safeArea,
              //   majorAxisScaled,
              //   minorAxisScaled,
              //   areaScaled,
              //   finalMajorAxis,
              //   finalMinorAxis,
              //   finalArea,
              //   scaleMethod: this.scaleMethod,
              //   hasScaleBar: !!(this.manualScaleBar && this.scaleBarValue),
              //   magnification: this.magnification
              // });
              
              // 측정 과정에서 나온 좌표를 그대로 사용하도록 좌표 변환 없이 저장
              // DefectDetector에서 반환하는 좌표는 이미 캔버스 좌표계이므로 변환하지 않음
              const defectMeasurement = {
                id: defectId,
                itemId: this.newItemId || currentAreaItemId,
                subItemId: this.newSubId || `d${subCounter++}`,
                x: result.x,
                y: result.y,
                width: result.width,
                height: result.height,
                radiusX: result.radiusX,
                radiusY: result.radiusY,
                // 중심점 좌표도 저장하여 렌더링 시 정확한 위치 표시
                centerX: result.centerX,
                centerY: result.centerY,
                value: result.area,
                pixelCount: result.pixelCount,
                brightness: result.brightness,
                area: result.area,
                // 스케일바 기준으로 변환된 값들 추가
                majorAxisScaled: finalMajorAxis,
                minorAxisScaled: finalMinorAxis,
                areaScaled: finalArea,
                isBright: result.brightness > this.brightnessThreshold,
                distortion: result.distortion || 0,
                striation: result.striation || 0,
                isDistorted: (result.distortion || 0) > 30,
                isStriated: (result.striation || 0) > 20,
                description: `불량 ${index + 1} (Distortion: ${result.distortion || 0}, Striation: ${result.striation || 0})`,
                timestamp: new Date().toLocaleString(),
                // edge 픽셀 정보 추가
                edgePixels: result.edgePixels || []
              };
              
              // console.log(`🔍 불량 ${index + 1} ID 할당: ${defectId}, 전역카운터: ${this.globalDefectIdCounter}`);
              this.defectMeasurements.push(defectMeasurement);
              // console.log(`불량 ${index + 1} defectMeasurements에 추가:`, defectMeasurement);
            });
            
            // console.log('전체 defectMeasurements:', this.defectMeasurements);
            // console.log(`현재 영역: ${currentAreaItemId}, 다음 영역: defect${currentAreaId + 1}`);
            // console.log(`불량감지 완료! 발견된 불량: ${results.length}개`);
            
            // Vue의 반응성을 위해 강제 업데이트
            this.$forceUpdate();
          }
        };

        // 불량감지 시작
        // console.log(`🚀 불량감지 시작 - 현재 전역카운터: ${this.globalDefectIdCounter}`);
        // console.log('DefectDetector.startDetection 호출...');
        await detector.startDetection(boundingBox, onProgress, onComplete);
        
      } catch (error) {
        this.isDefectDetecting = false;
        this.measurementMode = 'defect';
        // console.log('불량감지 오류 발생 - 불량감지 모드 유지:', this.measurementMode);
        console.error('불량감지 실패:', error);
        alert('불량감지 중 오류가 발생했습니다: ' + error.message);
      }
    },
    // 긴급 중단 후 Vue 컴포넌트 상태 정리
    finalizeEmergencyStop() {
      try {
        // console.log('Vue 컴포넌트 긴급 중단 후 정리 시작');
        
        // 감지 상태 초기화
        this.isDefectDetecting = false;
        
        // 측정 내용 완전 삭제
        this.defectMeasurements = [];
        this.selectedDefects = [];
        this.defectDetectionResult = null;
        
        // 불량감지 모드를 명시적으로 설정하고 유지
        this.measurementMode = 'defect';
        // console.log('긴급 중단 - 불량감지 모드 명시적 설정:', this.measurementMode);
        
        // 선택 영역 초기화
        this.selectedAreaRect = null;
        this.selectedArea = null;
        this.isAreaSelectionMode = false;
        
        // API 전송 상태 초기화
        this.isApiSending = false;
        
        // UI 상태 강제 업데이트
        this.$nextTick(() => {
          // Vue의 반응성을 이용하여 자동으로 버튼 상태 업데이트
          // measurementMode가 'defect'로 설정되어 있으므로 템플릿에서 자동으로 활성화됨
          // console.log('불량감지 모드 유지 완료:', this.measurementMode);
          
          // 캔버스 강제 새로고침
          if (this.$refs.canvas) {
            this.render();
          }
        });
        
        // console.log('Vue 컴포넌트 긴급 중단 후 정리 완료 - 불량감지 모드 유지');
        
      } catch (error) {
        console.error('긴급 중단 후 정리 중 오류:', error);
      }
    },
    // clearMeasurements 함수 추가
    clearMeasurements() {
      try {
        // console.log('[clearMeasurements] 측정 결과 초기화 시작');
        
        // localMeasurements 사용하여 안전하게 초기화
        this.localMeasurements = [];
        this.segmentedMeasurements = [];
        // 불량 감지 결과는 유지 - 이미지 전환 시에도 보존됨
        // this.defectMeasurements = []; // 주석 처리하여 불량 감지 결과 보존
        this.referenceLines = [];
        this.activeReferenceLine = null;
        
        // 선택 상태 초기화
        this.selectedRows = [];
        this.selectedMeasurement = null;
        this.selectedSegment = null;
        this.selectedAreaRect = null;
        
        // 측정 관련 상태 초기화
        this.currentMeasurement = null;
        this.isMeasuring = false;
        this.areaStart = null;
        this.areaEnd = null;
        
        // ID 카운터 초기화
        this.nextId = 1;
        this.brightSubIdCounter = 1;
        this.darkSubIdCounter = 1;
        this.referenceId = 1;
        // 전역 불량감지 ID 카운터는 유지 (누적 ID를 위해 초기화하지 않음)
        // this.globalDefectIdCounter = 1;
        
        // 측정 모드 및 상태 초기화
        this.measurementMode = 'line';
        this.isMeasuring = false;
        this.currentMeasurement = null;
        this.isDeleteMode = false;
        this.isAreaSelectionMode = false;
        
        // 영역 선택 관련 초기화
        this.areaStart = null;
        this.areaEnd = null;
        this.areaSelectionStart = null;
        this.areaSelectionEnd = null;
        this.deleteStart = null;
        this.deleteEnd = null;
        
        // 드래그 관련 초기화
        this.isDragging = false;
        this.dragStartIndex = -1;
        this.dragEndIndex = -1;
        this.dragStartRow = null;
        this.tempDragLine = null;
        
        // 이력 초기화
        this.undoHistory = [];
        this.redoHistory = [];
        this.measurementHistory = [];
        
        // 불량 감지 관련 초기화
        this.defectDetectionResult = null;
        this.isDefectDetecting = false;
        
        // 새 항목 ID 필드 초기화
        this.newItemId = '';
        this.newSubId = '';
        
        // 캔버스 다시 그리기
        this.$nextTick(() => {
          this.render();
        });
        
        // console.log('[clearMeasurements] 측정 결과 초기화 완료');
        
        // 부모 컴포넌트에 변경사항 알림
        try {
          this.$emit('measurements-cleared');
          this.emitMeasurementsUpdate();
        } catch (emitError) {
          console.error('[clearMeasurements] 이벤트 emit 중 오류:', emitError);
        }
        
        // console.log('[clearMeasurements] 측정 결과 초기화 완료');
      } catch (error) {
        console.error('[clearMeasurements] 초기화 중 오류:', error);
      }
    },
    
    // 측정값 업데이트 이벤트 발생 함수
    emitMeasurementsUpdate() {
      try {
        // 부모 컴포넌트에 측정값 업데이트 알림
        this.$emit('update:measurements', this.localMeasurements);
        // console.log('[emitMeasurementsUpdate] 측정값 업데이트 이벤트 발생:', this.localMeasurements.length, '개');
      } catch (error) {
        console.error('[emitMeasurementsUpdate] 이벤트 발생 중 오류:', error);
      }
    },
    
    // 알림 메시지 표시 함수
    showNotification(message, type = 'info', duration = 3000) {
      try {
        // 기존 타이머가 있으면 정리
        if (this.notification.timeout) {
          clearTimeout(this.notification.timeout);
        }

        // 알림 설정
        this.notification.message = message;
        this.notification.type = type;
        this.notification.show = true;

        // 자동 숨기기 타이머 설정
        this.notification.timeout = setTimeout(() => {
          this.notification.show = false;
          this.notification.timeout = null;
        }, duration);

        // console.log(`[showNotification] ${type.toUpperCase()}: ${message}`);
      } catch (error) {
        console.error('[showNotification] 알림 표시 중 오류:', error);
      }
    },
    
    // 히스토리에 작업 추가 (실행 취소/다시 실행용)
    addToHistory(action, data, segments = null, references = null, defects = null) {
      try {
        const historyEntry = {
          action: action,
          data: data,
          segments: segments || JSON.parse(JSON.stringify(this.segmentedMeasurements)),
          references: references || JSON.parse(JSON.stringify(this.referenceLines)),
          defects: defects || JSON.parse(JSON.stringify(this.defectMeasurements)),
          localMeasurements: JSON.parse(JSON.stringify(this.localMeasurements)),
          timestamp: new Date().toISOString()
        };
        
        // 실행 취소 히스토리에 추가
        this.undoHistory.push(historyEntry);
        
        // 히스토리 크기 제한 (최대 50개)
        if (this.undoHistory.length > 50) {
          this.undoHistory.shift();
        }
        
        // 새로운 작업이 추가되면 다시 실행 히스토리 클리어
        this.redoHistory = [];
        
        // console.log(`[addToHistory] ${action} 작업이 히스토리에 추가됨:`, historyEntry);
        
      } catch (error) {
        console.error('[addToHistory] 히스토리 추가 중 오류:', error);
      }
    },
    
    // 팝업 열기 함수
    openPopup(imageUrl = null) {
      try {
        // console.log('[openPopup] 팝업 열기 시작, 이미지 URL:', imageUrl);
        
        // 팝업이 열릴 때 항상 처리 후 이미지가 기본으로 표시되도록 상태 초기화
        this.isShowingInputImage = false;
        // console.log('[openPopup] 이미지 전환 상태 초기화 - 처리 후 이미지가 기본으로 설정됨');
        
        // MSA5에서 전달된 시작/종료 이미지 URL 확인
        const msa5StartImage = sessionStorage.getItem('msa5_start_image_url');
        const msa5EndImage = sessionStorage.getItem('msa5_end_image_url');
        
        // console.log('[openPopup] MSA5 이미지 확인:');
        // console.log('- 시작 이미지:', msa5StartImage ? msa5StartImage.substring(0, 50) + '...' : '없음');
        // console.log('- 종료 이미지:', msa5EndImage ? msa5EndImage.substring(0, 50) + '...' : '없음');
        
        // 이미지 URL이 제공된 경우 설정
        if (imageUrl) {
          // 전달받은 이미지 URL을 종료 이미지(처리 후)로 설정
          this.outputImageUrl = imageUrl;
          this.localImageUrl = imageUrl;
          // console.log('[openPopup] 전달받은 이미지를 처리 후 이미지로 설정');
        } else if (msa5EndImage) {
          // MSA5 종료 이미지를 처리 후 이미지로 설정
          this.outputImageUrl = msa5EndImage;
          this.localImageUrl = msa5EndImage;
          // console.log('[openPopup] MSA5 종료 이미지를 처리 후 이미지로 설정');
        }
        
        // MSA5 시작 이미지를 처리 전 이미지로 설정
        if (msa5StartImage && !this.internalInputImageUrl) {
          this.internalInputImageUrl = msa5StartImage;
          // console.log('[openPopup] MSA5 시작 이미지를 처리 전 이미지로 설정');
        }
        
        // 팝업 표시
        this.isVisible = true;
        this.$emit('update:showPopup', true);
        
        // 이미지 로드 및 캔버스 초기화
        this.$nextTick(() => {
          // 현재 표시해야 할 이미지 URL 결정
          const currentUrl = this.currentImageUrl || this.imageUrl || this.outputImageUrl;
          // console.log('[openPopup] 로드할 이미지 URL:', currentUrl ? currentUrl.substring(0, 80) + '...' : '없음');
          
          if (currentUrl) {
            this.loadImage(currentUrl);
          } else {
            console.warn('[openPopup] 로드할 이미지 URL이 없음');
          }
          
          this.updateCanvasSize();
          
          // 스케일바 모드이고 아직 감지되지 않은 경우 스케일바 감지 실행
          if (this.scaleMethod === 'scaleBar' && !this.scaleBarDetected) {
            this.detectScaleBar();
          }
        });
        
        // console.log('[openPopup] 팝업 열기 완료');
        
      } catch (error) {
        console.error('[openPopup] 팝업 열기 중 오류:', error);
      }
    },
    
    // 스케일 방법 선택 함수 추가
    selectScaleMethod(method) {
      this.scaleMethod = method;
      // this.showScaleChoicePopup = false;
      
      // 선택된 방법에 따른 추가 처리
      if (method === 'magnification') {
        // console.log('[selectScaleMethod] 배율 기반 측정 선택');
        // 배율 모드로 설정
        this.scaleBarDetected = false;
        this.manualScaleBarSet = false;
      } else if (method === 'scaleBar') {
        // console.log('[selectScaleMethod] 스케일바 기반 측정 선택');
        // 수동 스케일바 그리기 모드 활성화
        this.toggleScaleBarDrawing();
      }
    },
    
    // 스케일바 감지 실패 팝업 표시 함수 추가
    showScaleDetectionFailurePopup() {
      try {
        // console.log('[showScaleDetectionFailurePopup]');
        
        // 스케일바 감지 실패 시 선택 팝업 표시
        // this.showScaleChoicePopup = true;
        
      } catch (error) {
        console.error('[showScaleDetectionFailurePopup] 오류:', error);
        // 오류 발생 시에만 선택 팝업 표시
        // this.showScaleChoicePopup = true;
      }
    },
    
    // 팝업 닫기 함수 추가
    closePopup() {
      try {
        // console.log('[closePopup] 팝업 닫기 시작');
        
        // 팝업 숨기기
        this.isVisible = false;
        
        // 부모 컴포넌트에 팝업 닫기 이벤트 전달
        this.$emit('update:showPopup', false);
        this.$emit('close');
        
        // 측정 상태 초기화
        this.isMeasuring = false;
        this.currentMeasurement = null;
        this.areaStart = null;
        this.areaEnd = null;
        this.selectedAreaRect = null;
        
        // 불량 감지 중인 경우 중단
        if (this.isDefectDetecting) {
          this.emergencyStopDetection();
        }
        
        // 키보드 이벤트 정리
        this.showShortcutHelp = false;
        this.isFKeyPressed = false;
        this.showBrightnessTooltip = false;
        
        // console.log('[closePopup] 팝업 닫기 완료');
        
      } catch (error) {
        console.error('[closePopup] 팝업 닫기 중 오류:', error);
        // 오류가 발생해도 팝업은 닫기
        this.isVisible = false;
        this.$emit('update:showPopup', false);
      }
    },
    
    // 누락된 메서드들 추가
    setMode(mode) {
      // console.log('[setMode] 측정 모드 변경:', mode);
      
      // 불량감지 모드에서 다른 모드로 전환할 때 불량감지 결과 초기화
      if (this.measurementMode === 'defect' && mode !== 'defect') {
        this.defectMeasurements = [];
        this.selectedDefects = [];
        this.defectDetectionResult = null;
        this.selectedAreaRect = null;
        this.isAreaSelectionMode = false;
        this.areaStart = null;
        this.areaEnd = null;
        // console.log('[setMode] 불량감지 결과 초기화됨');
      }
      
      // 다른 측정 모드로 전환할 때 삭제 모드 해제
      if (this.isDeleteMode) {
        this.isDeleteMode = false;
        // console.log('[setMode] 삭제 모드 해제됨');
      }
      
      // 영역 측정과 불량 감지 모드에서 스케일바 체크 추가
      if ((mode === 'area' || mode === 'area-vertical' || mode === 'area-horizontal' || mode === 'defect') && 
          this.scaleMethod === 'scaleBar') {
        
        // 스케일바 설정 유효성 검증
        const { hasValidManualScaleBar } = this.scalebarManager.validateScaleBarSettings();
        
        if (!hasValidManualScaleBar && !this.scaleBarDetected) {
          // 스케일바 설정이 필요한 경우 원래 선택하려던 모드를 저장
          this.pendingMeasurementMode = mode;
          
          // 스케일바 설정이 필요한 경우 먼저 스케일바 그리기 모드로 전환
          this.showNotification('스케일바를 먼저 설정해주세요.', 'warning');
          this.isDrawingScaleBar = true;
          this.measurementMode = 'line'; // 임시로 선측정 모드로 설정
          
          // 불량 감지 모드 관련 상태 초기화
          if (mode === 'defect') {
            this.isAreaSelectionMode = false;
            this.selectedAreaRect = null;
            this.areaStart = null;
            this.areaEnd = null;
          }
          
          this.render();
          return;
        }
      }
      
      // area 모드인 경우 현재 방향에 따라 구체적인 모드 설정
      if (mode === 'area') {
        if (this.areaDirection === 'horizontal') {
          this.measurementMode = 'area-horizontal';
        } else {
          this.measurementMode = 'area-vertical';
        }
      } else {
        this.measurementMode = mode;
      }
      
      // 모드에 따른 추가 설정
      if (mode === 'defect') {
        this.isAreaSelectionMode = true;
      } else {
        this.isAreaSelectionMode = false;
      }
      
      // 현재 측정 상태 초기화
      this.isMeasuring = false;
      this.currentMeasurement = null;
      this.areaStart = null;
      this.areaEnd = null;
      
      this.render();
    },
    
    // 삭제 모드 토글 메서드 추가
    toggleDeleteMode() {
      this.isDeleteMode = !this.isDeleteMode;
      
      // 삭제 모드가 활성화될 때 다른 측정 모드 해제
      if (this.isDeleteMode) {
        // 현재 측정 상태 초기화
        this.isMeasuring = false;
        this.currentMeasurement = null;
        this.areaStart = null;
        this.areaEnd = null;
        this.isAreaSelectionMode = false;
        
        // 측정 모드를 기본값으로 설정 (UI에서 아무것도 선택되지 않은 상태)
        this.measurementMode = null;
        
        this.render();
        // console.log('[toggleDeleteMode] 삭제 모드 활성화, 다른 측정 모드 해제됨');
      }
      
      // console.log('[toggleDeleteMode] 삭제 모드:', this.isDeleteMode);
    },
    
    // 기준선 색상 선택 메서드 추가
    selectReferenceColor(color) {
      this.referenceLineColor = color;
      this.showReferenceColorPicker = false;
      // 기존 기준선들의 색상도 업데이트
      this.referenceLines.forEach(line => {
        line.color = color;
      });
      this.render();
      // console.log('[selectReferenceColor] 기준선 색상 변경:', color);
    },
    
    handleRowMouseEnter(segment, index) {
      try {
        // 드래그 중인 경우 범위 선택
        if (this.isDragging && this.dragStartIndex !== -1) {
          this.dragEndIndex = index;
          
          // 드래그 범위 내의 모든 행 선택
          const startIndex = Math.min(this.dragStartIndex, this.dragEndIndex);
          const endIndex = Math.max(this.dragStartIndex, this.dragEndIndex);
          
          this.selectedRows = [];
          for (let i = startIndex; i <= endIndex; i++) {
            if (this.filteredMeasurements[i]) {
              this.selectedRows.push(this.filteredMeasurements[i]);
            }
          }
        } else {
          // 기존 기능: 테이블 행에 마우스 오버 시 해당 측정선 강조
          this.hoveredSegment = segment;
          this.render();
        }
      } catch (error) {
        console.error('[handleRowMouseEnter] 마우스 엔터 처리 중 오류:', error);
      }
    },
    
    downloadResultImage() {
      try {
        // console.log('[downloadResultImage] 이미지 다운로드 시작');
        
        const canvas = this.$refs.canvas;
        if (!canvas) {
          console.error('[downloadResultImage] 캔버스를 찾을 수 없음');
          this.showNotification('캔버스를 찾을 수 없습니다.', 'error');
          return;
        }
        
        // 캔버스를 이미지로 변환
        canvas.toBlob((blob) => {
          if (!blob) {
            console.error('[downloadResultImage] 이미지 변환 실패');
            this.showNotification('이미지 변환에 실패했습니다.', 'error');
            return;
          }
          
          // 다운로드 링크 생성
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `measurement_result_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
          
          // 다운로드 실행
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // 메모리 정리
          URL.revokeObjectURL(url);
          
          // console.log('[downloadResultImage] 이미지 다운로드 완료');
          this.showNotification('이미지가 다운로드되었습니다.', 'success');
          
        }, 'image/png');
        
      } catch (error) {
        console.error('[downloadResultImage] 다운로드 중 오류:', error);
        this.showNotification('다운로드 중 오류가 발생했습니다.', 'error');
      }
    },
    copyImageUrl() {
       try {
         // 캔버스를 찾아서 검증
         const canvas = this.$refs.canvas;
         if (!canvas) {
           console.error('[copyImageUrl] 캔버스를 찾을 수 없음');
           this.showNotification('캔버스를 찾을 수 없습니다.', 'error');
           return;
         }
         
         // 로딩 상태 표시
         this.showNotification('이미지 URL 생성 중...', 'info');
         
         // 캔버스를 Blob으로 변환하여 백엔드에 업로드
         this.uploadCanvasAndGetUrl(canvas);
         
       } catch (error) {
         console.error('[copyImageUrl] URL 복사 중 오류:', error);
         this.showNotification('URL 복사 중 오류가 발생했습니다.', 'error');
       }
     },
     
     async uploadCanvasAndGetUrl(canvas) {
       try {
         // 캔버스를 Blob으로 변환
         return new Promise((resolve, reject) => {
           canvas.toBlob(async (blob) => {
             if (!blob) {
               console.error('[uploadCanvasAndGetUrl] 이미지 변환 실패');
               this.showNotification('이미지 변환에 실패했습니다.', 'error');
               reject(new Error('이미지 변환 실패'));
               return;
             }
             
             try {
               // FormData 생성
               const formData = new FormData();
               const filename = `measurement_result_${Date.now()}.png`;
               formData.append('file', blob, filename);
               
               // 백엔드 API 호출
               const uploadResponse = await fetch('http://localhost:8000/api/msa6/generate_image_url', {
                 method: 'POST',
                 body: formData
               });
               
               if (!uploadResponse.ok) {
                 throw new Error(`HTTP error! status: ${uploadResponse.status}`);
               }
               
               const result = await uploadResponse.json();
               
               if (result.status === 'success') {
                 // 생성된 URL을 클립보드에 복사
                 const fullUrl = `http://localhost:8000/api/msa6/temp_image_url${result.url.replace('/static/temp_image_url/', '/')}`;
                 
                 navigator.clipboard.writeText(fullUrl).then(() => {
                   this.showNotification('측정 결과 포함 이미지 URL이 클립보드에 복사되었습니다.', 'success');
                   resolve(fullUrl);
                 }).catch((error) => {
                   console.error('[uploadCanvasAndGetUrl] 클립보드 복사 실패:', error);
                   // 대체 방법 시도
                   this.fallbackCopyToClipboard(fullUrl);
                   resolve(fullUrl);
                 });
               } else {
                 throw new Error(result.message || '이미지 URL 생성에 실패했습니다.');
               }
               
             } catch (error) {
               console.error('[uploadCanvasAndGetUrl] 이미지 업로드 실패:', error);
               this.showNotification(`이미지 URL 생성 실패: ${error.message}`, 'error');
               reject(error);
             }
           }, 'image/png');
         });
         
       } catch (error) {
         console.error('[uploadCanvasAndGetUrl] 캔버스 업로드 실패:', error);
         this.showNotification(`이미지 URL 생성 실패: ${error.message}`, 'error');
       }
     },
     
    
    fallbackCopyToClipboard(text) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          this.showNotification('이미지 URL이 클립보드에 복사되었습니다.', 'success');
        } else {
          this.showNotification('클립보드 복사를 지원하지 않는 브라우저입니다.', 'warning');
        }
      } catch (error) {
        console.error('[fallbackCopyToClipboard] 대체 복사 방법 실패:', error);
        this.showNotification('클립보드 복사에 실패했습니다.', 'error');
      }
    },
    
    toggleBeforeAfterImage() {
      try {
        // console.log('[toggleBeforeAfterImage] 이미지 전환 시작');
        // console.log('[toggleBeforeAfterImage] 현재 상태:', {
        //   isShowingInputImage: this.isShowingInputImage,
        //   internalInputImageUrl: this.internalInputImageUrl ? '있음' : '없음',
        //   outputImageUrl: this.outputImageUrl ? '있음' : '없음',
        //   imageUrl: this.imageUrl ? '있음' : '없음'
        // });
        
        // 전환 플래그 설정
        this.isToggling = true;
        
        // 현재 상태 토글
        this.isShowingInputImage = !this.isShowingInputImage;
        
        // 표시할 이미지 URL 결정 (검증용)
        let targetUrl;
        if (this.isShowingInputImage) {
          // 처리 전 이미지로 전환
          targetUrl = this.internalInputImageUrl || this.inputImageUrl;
        } else {
          // 처리 후 이미지로 전환
          targetUrl = this.outputImageUrl || this.imageUrl;
        }
        
        // console.log('[toggleBeforeAfterImage] 전환할 이미지 URL:', targetUrl ? '있음' : '없음');
        
        if (!targetUrl) {
          console.error('[toggleBeforeAfterImage] 전환할 이미지 URL이 없습니다.');
          this.showNotification('전환할 이미지가 없습니다.', 'error');
          // 상태 되돌리기
          this.isShowingInputImage = !this.isShowingInputImage;
          this.isToggling = false;
          return;
        }
        
        // Vue의 반응성에 의해 이미지가 자동으로 전환됨
        // 하지만 캐시된 이미지의 경우 @load 이벤트가 발생하지 않을 수 있으므로
        // 강제로 이미지를 다시 로드
        this.$nextTick(() => {
          const img = this.$refs.sourceImage;
          if (img && img.src === targetUrl) {
            // console.log('[toggleBeforeAfterImage] 이미지가 캐시되었을 수 있음, 강제 재로드');
            // 이미지 소스를 임시로 변경했다가 다시 설정하여 강제 재로드
            const originalSrc = img.src;
            img.src = '';
            setTimeout(() => {
              img.src = originalSrc;
            }, 10);
          }
        });
        
        // 전환 완료 후 플래그 해제
        setTimeout(() => {
          this.isToggling = false;
        }, 500); // 시간을 늘려서 이미지 로드 완료 대기
        
        // console.log('[toggleBeforeAfterImage] 이미지 전환 완료:', this.isShowingInputImage ? '처리 전' : '처리 후');
        
      } catch (error) {
        console.error('[toggleBeforeAfterImage] 이미지 전환 중 오류:', error);
        this.isToggling = false;
        this.showNotification('이미지 전환 중 오류가 발생했습니다.', 'error');
      }
    },
    
    toggleReverse() {
      // console.log('[toggleReverse] 밝기 반전 토글:', !this.isReversed);
      this.isReversed = !this.isReversed;
      this.render();
    },
    
    // MSA5 프로세스 시작 이벤트 처리 함수 (측정 결과 및 스케일바 초기화)
    handleMSA5ProcessStart(event) {
      try {
        // console.log('[handleMSA5ProcessStart] MSA5 프로세스 시작 이벤트 수신');
        
        // 이벤트 데이터 확인
        const data = event.detail;
        
        if (data && data.action === 'clear_measurements') {
          // console.log('[handleMSA5ProcessStart] 측정 결과 및 스케일바 초기화 요청 수신');
          
          // 측정값 초기화
          this.clearMeasurements();
          
          // MSA5 프로세스 시작 시에만 불량 감지 결과도 초기화
          this.clearDefectMeasurements();
          // console.log('[handleMSA5ProcessStart] MSA5 프로세스 시작 - 불량 감지 결과도 초기화');
          
          // 스케일바 관련 상태 초기화
          this.manualScaleBar = null;
          this.manualScaleBarSet = false;
          this.scaleBarDetected = false;
          this.scaleBarMeasurement = null;
          this.isDrawingScaleBar = false;
          
          // 스케일바 값 초기화 (기본값으로 리셋)
          this.scaleBarValue = 500;
          this.scaleBarUnit = 'nm';
          
          // 스케일바 매니저를 통한 설정 초기화
          if (this.scalebarManager) {
            try {
              // 스케일바 관련 세션 스토리지 초기화
              this.scalebarManager.clearScalebarSettings();
              // console.log('[handleMSA5ProcessStart] 스케일바 매니저를 통한 설정 초기화 완료');
            } catch (managerError) {
              console.error('[handleMSA5ProcessStart] 스케일바 매니저 초기화 중 오류:', managerError);
            }
          }
          
          // 캔버스 다시 렌더링 (스케일바 제거)
          this.render();
          
          // console.log('[handleMSA5ProcessStart] 측정 결과 및 스케일바 초기화 완료');
        }
      } catch (error) {
        console.error('[handleMSA5ProcessStart] MSA5 프로세스 시작 이벤트 처리 중 오류:', error);
      }
    },
    toggleScaleBarDrawing() {
      // 현재 불량감지 모드인 경우 이전 모드로 저장
      if (this.measurementMode === 'defect') {
        this.pendingMeasurementMode = 'defect';
        console.log('[toggleScaleBarDrawing] 불량감지 모드에서 스케일바 설정 시작, 이전 모드 저장:', this.pendingMeasurementMode);
        
        // 스케일바 그리기 모드로 전환
        this.isDrawingScaleBar = true;
        this.measurementMode = 'line'; // 임시로 선측정 모드로 설정
        
        // 불량감지 관련 상태 초기화
        this.isAreaSelectionMode = false;
        this.selectedAreaRect = null;
        this.areaStart = null;
        this.areaEnd = null;
        
        this.render();
        return;
      }
      
      if (this.scalebarManager) {
        this.scalebarManager.toggleScaleBarDrawing();
      }
    },
    detectScaleBar() {
      if (this.scalebarManager) {
        this.scalebarManager.detectScaleBar();
      }
    },
    // 이미지 URL 정리 함수 추가
    cleanupImageUrls() {
      try {
        // console.log('[cleanupImageUrls] 이미지 URL 정리 시작');
        
        // 현재 활성화된 이미지들의 URL 정리
        if (this.outputImageUrl && this.outputImageUrl.startsWith('blob:')) {
          URL.revokeObjectURL(this.outputImageUrl);
          // console.log('[cleanupImageUrls] outputImageUrl 정리됨');
        }
        
        if (this.internalInputImageUrl && this.internalInputImageUrl.startsWith('blob:')) {
          URL.revokeObjectURL(this.internalInputImageUrl);
          // console.log('[cleanupImageUrls] internalInputImageUrl 정리됨');
        }
        
        // 이미지 객체 정리
        if (this.image) {
          if (this.image.src && this.image.src.startsWith('blob:')) {
            URL.revokeObjectURL(this.image.src);
            // console.log('[cleanupImageUrls] image.src 정리됨');
          }
          this.image = null;
        }
        
        // 캔버스 컨텍스트 정리
        if (this.ctx) {
          this.ctx = null;
        }
        
        // console.log('[cleanupImageUrls] 이미지 URL 정리 완료');
      } catch (error) {
        console.error('[cleanupImageUrls] 이미지 URL 정리 중 오류:', error);
      }
    },
    // 불량 감지 결과만 초기화하는 함수 추가
    clearDefectMeasurements() {
      try {
        // console.log('[clearDefectMeasurements] 불량 감지 결과 초기화 시작');
        
        // 불량 감지 결과만 초기화
        this.defectMeasurements = [];
        this.selectedDefects = [];
        this.defectDetectionResult = null;
        
        // 불량 감지 관련 선택 상태 초기화
        this.selectedAreaRect = null;
        
        // console.log('[clearDefectMeasurements] 불량 감지 결과 초기화 완료');
        
      } catch (error) {
        console.error('[clearDefectMeasurements] 불량 감지 결과 초기화 중 오류:', error);
      }
    },
    
    // 선택한 행에 ID 적용
    applySelectedIds() {
      try {
        if (!this.newItemId && !this.newSubId) {
          this.showNotification('적용할 Item ID 또는 Sub ID를 입력해주세요.', 'warning');
          return;
        }

        let updatedCount = 0;

        // 일반 측정 결과에 ID 적용
        if (this.measurementMode !== 'defect' && this.selectedRows.length > 0) {
          this.selectedRows.forEach(segment => {
            if (this.newItemId) {
              segment.itemId = this.newItemId;
            }
            if (this.newSubId) {
              segment.subItemId = this.newSubId;
            }
            updatedCount++;
          });
        }

        // 불량 감지 결과에 ID 적용
        if (this.measurementMode === 'defect' && this.selectedDefects.length > 0) {
          this.selectedDefects.forEach(defect => {
            if (this.newItemId) {
              defect.itemId = this.newItemId;
            }
            if (this.newSubId) {
              defect.subItemId = this.newSubId;
            }
            updatedCount++;
          });
        }

        if (updatedCount > 0) {
          // 선택 해제
          this.selectedRows = [];
          this.selectedDefects = [];
          
          // ID 입력 필드 초기화
          this.newItemId = '';
          this.newSubId = '';
          
          // 캔버스 다시 그리기 (불량 감지 결과의 ID 표시 업데이트)
          this.$nextTick(() => {
            this.render();
          });
          
          this.showNotification(`${updatedCount}개 항목의 ID가 업데이트되었습니다.`, 'success');
        } else {
          this.showNotification('선택된 항목이 없습니다.', 'warning');
        }

      } catch (error) {
        console.error('[applySelectedIds] ID 적용 중 오류:', error);
        this.showNotification('ID 적용 중 오류가 발생했습니다.', 'error');
      }
    },
    
    // 불량 감지 결과 테이블 마우스 이벤트 핸들러
    handleDefectMouseDown(defect, index) {
      try {
        // Shift 키가 눌린 상태에서 클릭하면 범위 선택
        if (event.shiftKey && this.selectedDefects.length > 0) {
          // 마지막으로 선택된 행의 인덱스 찾기
          const lastSelectedIndex = this.defectMeasurements.indexOf(this.selectedDefects[this.selectedDefects.length - 1]);
          if (lastSelectedIndex !== -1) {
            const startIndex = Math.min(lastSelectedIndex, index);
            const endIndex = Math.max(lastSelectedIndex, index);
            
            // 범위 내의 모든 행 선택
            this.selectedDefects = [];
            for (let i = startIndex; i <= endIndex; i++) {
              if (this.defectMeasurements[i]) {
                this.selectedDefects.push(this.defectMeasurements[i]);
              }
            }
          }
        }
        // Ctrl/Cmd 키가 눌린 상태에서 클릭하면 다중 선택
        else if (event.ctrlKey || event.metaKey) {
          const defectIndex = this.selectedDefects.indexOf(defect);
          if (defectIndex > -1) {
            // 이미 선택된 경우 선택 해제
            this.selectedDefects.splice(defectIndex, 1);
          } else {
            // 선택되지 않은 경우 선택 추가
            this.selectedDefects.push(defect);
          }
        } else {
          // 일반 클릭: 단일 선택 및 드래그 시작점 설정
          this.selectedDefects = [defect];
          this.isDragging = true;
          this.dragStartIndex = index;
          this.dragStartRow = defect;
        }
      } catch (error) {
        console.error('[handleDefectMouseDown] 불량 선택 중 오류:', error);
      }
    },

    handleDefectMouseEnter(defect, index) {
      try {
        // 드래그 중인 경우 범위 선택
        if (this.isDragging && this.dragStartIndex !== -1) {
          this.dragEndIndex = index;
          
          // 드래그 범위 내의 모든 행 선택
          const startIndex = Math.min(this.dragStartIndex, this.dragEndIndex);
          const endIndex = Math.max(this.dragStartIndex, this.dragEndIndex);
          
          this.selectedDefects = [];
          for (let i = startIndex; i <= endIndex; i++) {
            if (this.defectMeasurements[i]) {
              this.selectedDefects.push(this.defectMeasurements[i]);
            }
          }
        }
        // 기존에는 특별한 동작이 없었으므로 드래그가 아닐 때는 아무것도 하지 않음
      } catch (error) {
        console.error('[handleDefectMouseEnter] 불량 마우스 엔터 처리 중 오류:', error);
      }
    },

    
    // 일반 측정 결과 테이블 마우스 이벤트 핸들러
    handleRowMouseDown(segment, index) {
      try {
        // Shift 키가 눌린 상태에서 클릭하면 범위 선택
        if (event.shiftKey && this.selectedRows.length > 0) {
          // 마지막으로 선택된 행의 인덱스 찾기
          const lastSelectedIndex = this.filteredMeasurements.indexOf(this.selectedRows[this.selectedRows.length - 1]);
          if (lastSelectedIndex !== -1) {
            const startIndex = Math.min(lastSelectedIndex, index);
            const endIndex = Math.max(lastSelectedIndex, index);
            
            // 범위 내의 모든 행 선택
            this.selectedRows = [];
            for (let i = startIndex; i <= endIndex; i++) {
              if (this.filteredMeasurements[i]) {
                this.selectedRows.push(this.filteredMeasurements[i]);
              }
            }
          }
        }
        // Ctrl/Cmd 키가 눌린 상태에서 클릭하면 다중 선택
        else if (event.ctrlKey || event.metaKey) {
          const segmentIndex = this.selectedRows.indexOf(segment);
          if (segmentIndex > -1) {
            // 이미 선택된 경우 선택 해제
            this.selectedRows.splice(segmentIndex, 1);
          } else {
            // 선택되지 않은 경우 선택 추가
            this.selectedRows.push(segment);
          }
        } else {
          // 일반 클릭: 단일 선택 및 드래그 시작점 설정
          this.selectedRows = [segment];
          this.isDragging = true;
          this.dragStartIndex = index;
          this.dragStartRow = segment;
        }
      } catch (error) {
        console.error('[handleRowMouseDown] 측정 결과 선택 중 오류:', error);
      }
    },

    handleRowMouseUp() {
      try {
        // 드래그 종료
        if (this.isDragging) {
          this.isDragging = false;
          this.dragStartIndex = -1;
          this.dragEndIndex = -1;
          this.dragStartRow = null;
        }
      } catch (error) {
        console.error('[handleRowMouseUp] 드래그 종료 중 오류:', error);
      }
    },
    
    // 캔버스에 측정 결과를 그리는 함수
    drawMeasurementsOnCanvas(ctx, canvasWidth, canvasHeight) {
      try {
        // 현재 캔버스 크기 가져오기
        const currentCanvas = this.$refs.canvas;
        if (!currentCanvas) return;
        
        const scaleX = canvasWidth / currentCanvas.width;
        const scaleY = canvasHeight / currentCanvas.height;
        
        // 기준선 그리기
        if (this.referenceLines.length > 0) {
          this.referenceLines.forEach((refLine) => {
            ctx.beginPath();
            ctx.strokeStyle = refLine.color || this.referenceLineColor;
            ctx.lineWidth = 4 * Math.min(scaleX, scaleY);
            ctx.setLineDash([]);
            ctx.moveTo(refLine.start.x * scaleX, refLine.start.y * scaleY);
            ctx.lineTo(refLine.end.x * scaleX, refLine.end.y * scaleY);
            ctx.stroke();
          });
        }

        // 측정된 선들 그리기 - 캔버스와 동일한 로직 적용
        if (this.measurementMode !== 'defect') {
          this.segmentedMeasurements.forEach(segment => {
            const shouldDisplay = this.isReversed ? segment.isBright : !segment.isBright;
            
            ctx.beginPath();
            if (shouldDisplay) {
              ctx.strokeStyle = 'blue';
              ctx.setLineDash([5 * Math.min(scaleX, scaleY), 5 * Math.min(scaleX, scaleY)]);
            } else {
              ctx.strokeStyle = 'red';
              ctx.setLineDash([]);
            }
            
            ctx.lineWidth = 2 * Math.min(scaleX, scaleY);
            ctx.moveTo(segment.start.x * scaleX, segment.start.y * scaleY);
            ctx.lineTo(segment.end.x * scaleX, segment.end.y * scaleY);
            ctx.stroke();
            
            // 측정값 텍스트 표시 - shouldDisplay 조건과 동일하게 적용
            if (segment.value && !shouldDisplay) {
              const midX = (segment.start.x + segment.end.x) / 2 * scaleX;
              const midY = (segment.start.y + segment.end.y) / 2 * scaleY;
              
              // 텍스트 배경을 위한 반투명 사각형
              ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
              const text = `${segment.value.toFixed(2)}nm`;
              ctx.font = `${12 * Math.min(scaleX, scaleY)}px Arial`;
              const textMetrics = ctx.measureText(text);
              const textWidth = textMetrics.width;
              const textHeight = 12 * Math.min(scaleX, scaleY);
              
              ctx.fillRect(midX + 5 * scaleX, midY - textHeight - 5 * scaleY, textWidth + 6 * scaleX, textHeight + 4 * scaleY);
              
              // 측정값 텍스트
              ctx.fillStyle = 'white';
              ctx.font = `${12 * Math.min(scaleX, scaleY)}px Arial`;
              ctx.textAlign = 'left';
              ctx.fillText(text, midX + 8 * scaleX, midY - 8 * scaleY);
            }
          });
        }

        // 로컬 측정값들 그리기 - 캔버스와 동일한 파란색 사용
        if (this.localMeasurements.length > 0) {
          this.localMeasurements.forEach((measurement) => {
            if (measurement.start && measurement.end) {
              ctx.beginPath();
              ctx.strokeStyle = 'blue'; // 캔버스와 동일한 파란색 사용
              ctx.lineWidth = 2 * Math.min(scaleX, scaleY); // 캔버스와 동일한 두께
              ctx.setLineDash([]);
              ctx.moveTo(measurement.start.x * scaleX, measurement.start.y * scaleY);
              ctx.lineTo(measurement.end.x * scaleX, measurement.end.y * scaleY);
              ctx.stroke();
              
              // 측정값 텍스트 표시 - 캔버스와 동일한 스타일
              if (measurement.value) {
                const midX = (measurement.start.x + measurement.end.x) / 2 * scaleX;
                const midY = (measurement.start.y + measurement.end.y) / 2 * scaleY;
                
                // 텍스트 배경을 위한 반투명 사각형
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                const text = `${measurement.value.toFixed(2)}nm`;
                ctx.font = `${12 * Math.min(scaleX, scaleY)}px Arial`;
                const textMetrics = ctx.measureText(text);
                const textWidth = textMetrics.width;
                const textHeight = 12 * Math.min(scaleX, scaleY);
                
                ctx.fillRect(midX + 5 * scaleX, midY - textHeight - 5 * scaleY, textWidth + 6 * scaleX, textHeight + 4 * scaleY);
                
                // 측정값 텍스트
                ctx.fillStyle = 'white';
                ctx.font = `${12 * Math.min(scaleX, scaleY)}px Arial`;
                ctx.textAlign = 'left';
                ctx.fillText(text, midX + 8 * scaleX, midY - 8 * scaleY);
              }
            }
          });
        }

        // 불량감지 결과 그리기 - 캔버스와 동일한 녹색 스타일 사용
        if (this.defectMeasurements && this.defectMeasurements.length > 0) {
          this.defectMeasurements.forEach((defect, index) => {
            // 중심점 좌표가 있으면 직접 사용, 없으면 계산
            const centerX = (defect.centerX || (defect.x + defect.width / 2)) * scaleX;
            const centerY = (defect.centerY || (defect.y + defect.height / 2)) * scaleY;
            const radiusX = (defect.radiusX || defect.width / 2) * scaleX;
            const radiusY = (defect.radiusY || defect.height / 2) * scaleY;
            
            // 1. 실제 불량 영역의 edge 픽셀들을 작은 녹색 점으로 표시
            if (defect.edgePixels && defect.edgePixels.length > 0) {
              ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
              for (const edgePixel of defect.edgePixels) {
                ctx.beginPath();
                ctx.arc(edgePixel.x * scaleX, edgePixel.y * scaleY, 0.8 * Math.min(scaleX, scaleY), 0, 2 * Math.PI);
                ctx.fill();
              }
            }
            
            // 2. 장축/단축 기반 타원 테두리 (녹색 실선)
            ctx.beginPath();
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 2 * Math.min(scaleX, scaleY);
            ctx.setLineDash([]);
            
            ctx.ellipse(
              centerX,
              centerY,
              radiusX,
              radiusY,
              0, 0, 2 * Math.PI
            );
              ctx.stroke();
              
            // 3. 불량 번호 표시 (녹색)
            ctx.fillStyle = '#00ff00';
            ctx.font = `bold ${12 * Math.min(scaleX, scaleY)}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(
              `${defect.id}`, 
              centerX, 
              centerY + 4 * Math.min(scaleX, scaleY)
            );
            
          });
        }

        // 수동 스케일바 그리기 - 캔버스와 동일한 주황색 스타일
        if (this.manualScaleBar && this.scaleMethod === 'scaleBar') {
          ctx.beginPath();
          ctx.strokeStyle = '#FF6600'; // 주황색으로 구분
          ctx.lineWidth = 3 * Math.min(scaleX, scaleY);
          ctx.setLineDash([8 * Math.min(scaleX, scaleY), 4 * Math.min(scaleX, scaleY)]); // 점선 패턴으로 구분
          ctx.moveTo(this.manualScaleBar.start.x * scaleX, this.manualScaleBar.start.y * scaleY);
          ctx.lineTo(this.manualScaleBar.end.x * scaleX, this.manualScaleBar.end.y * scaleY);
          ctx.stroke();
          
          // 스케일바 표시를 위한 텍스트 추가
          if (this.scaleBarValue && this.scaleBarUnit) {
            ctx.fillStyle = '#FF6600';
            ctx.font = `${12 * Math.min(scaleX, scaleY)}px Arial`;
            ctx.textAlign = 'center';
            const midX = (this.manualScaleBar.start.x + this.manualScaleBar.end.x) / 2 * scaleX;
            const midY = (this.manualScaleBar.start.y + this.manualScaleBar.end.y) / 2 * scaleY - 10 * Math.min(scaleX, scaleY);
            ctx.fillText(`${this.scaleBarValue} ${this.scaleBarUnit}`, midX, midY);
          }
        }

      } catch (error) {
        console.error('[drawMeasurementsOnCanvas] 측정 결과 그리기 중 오류:', error);
      }
    },

    // 초기화 확인
    confirmReset() {
      try {
        // console.log('[confirmReset] 측정 결과 초기화 확인됨');
        
        // 히스토리에 현재 상태 저장 (초기화 전 상태)
        this.addToHistory('reset_all', null, 
          JSON.parse(JSON.stringify(this.segmentedMeasurements)),
          JSON.parse(JSON.stringify(this.referenceLines)),
          JSON.parse(JSON.stringify(this.defectMeasurements))
        );
        
        // 모든 측정 결과 초기화
        this.segmentedMeasurements = [];
        this.defectMeasurements = [];
        this.referenceLines = [];
        this.activeReferenceLine = null;
        
        // 선택 상태 초기화
        this.selectedRows = [];
        this.selectedMeasurement = null;
        this.selectedSegment = null;
        this.selectedDefects = [];
        this.selectedAreaRect = null;
        
        // 측정 관련 상태 초기화
        this.currentMeasurement = null;
        this.isMeasuring = false;
        this.areaStart = null;
        this.areaEnd = null;
        this.areaSelectionStart = null;
        this.areaSelectionEnd = null;
        
        // ID 카운터 초기화
        this.nextId = 1;
        this.brightSubIdCounter = 1;
        this.darkSubIdCounter = 1;
        this.referenceId = 1;
        this.globalDefectIdCounter = 1;
        
        // 측정 모드 초기화
        this.measurementMode = 'line';
        this.isDeleteMode = false;
        this.isAreaSelectionMode = false;
        
        // 드래그 관련 초기화
        this.isDragging = false;
        this.dragStartIndex = -1;
        this.dragEndIndex = -1;
        this.dragStartRow = null;
        this.tempDragLine = null;
        
        // 팝업 닫기
        this.showResetConfirmPopup = false;
        
        // 캔버스 다시 그리기
        this.$nextTick(() => {
          this.render();
        });
        
        // 부모 컴포넌트에 변경사항 알림
        this.emitMeasurementsUpdate();
        
        this.showNotification('모든 측정 결과가 초기화되었습니다.', 'success');
        // console.log('[confirmReset] 측정 결과 초기화 완료');
        
      } catch (error) {
        console.error('[confirmReset] 측정 결과 초기화 중 오류:', error);
        this.showNotification('측정 결과 초기화 중 오류가 발생했습니다.', 'error');
      }
    },

    // 초기화 취소
    cancelReset() {
      try {
        // 확인 팝업 닫기
        this.showResetConfirmPopup = false;
        // console.log('[cancelReset] 초기화 취소됨');
      } catch (error) {
        console.error('[cancelReset] 초기화 취소 중 오류:', error);
      }
    },

    // 초기화 확인 팝업 표시
    showResetConfirmation() {
      try {
        // 초기화 확인 팝업 표시
        this.showResetConfirmPopup = true;
        // console.log('[showResetConfirmation] 초기화 확인 팝업 표시됨');
      } catch (error) {
        console.error('[showResetConfirmation] 초기화 확인 팝업 표시 중 오류:', error);
      }
    },

    handleKeyUp(e) {
      try {
        const key = e.key.toLowerCase();

        // F키: 밝기값 보기 및 돋보기 비활성화
        if (key === 'f') {
          e.preventDefault();
          this.showBrightnessTooltip = false;
          this.isFKeyPressed = false;
          return;
        }

        // H키: 도움말 숨기기
        if (key === 'h') {
          e.preventDefault();
          this.showShortcutHelp = false;
          return;
        }

        // D키: 키 중복 방지용 플래그만 해제
        if (key === 'd' && this.isDKeyPressed) {
          this.isDKeyPressed = false;
          
          // 드래그 중이던 임시 라인이 있다면 초기화
          if (this.tempDragLine) {
            this.tempDragLine = null;
            this.isMeasuring = false;
            this.render();
          }
          
          // console.log('[handleKeyUp] D키 떼기 감지');
        }
      } catch (error) {
        console.error('[handleKeyUp] 키보드 이벤트 처리 중 오류:', error);
      }
    },

    // 실행 취소 함수
    undo() {
      try {
        if (this.undoHistory.length === 0) {
          this.showNotification('실행 취소할 작업이 없습니다.', 'info');
          return;
        }

        // 현재 상태를 redo 히스토리에 저장
        const currentState = {
          action: 'current_state',
          data: null,
          segments: JSON.parse(JSON.stringify(this.segmentedMeasurements)),
          references: JSON.parse(JSON.stringify(this.referenceLines)),
          defects: JSON.parse(JSON.stringify(this.defectMeasurements)),
          timestamp: new Date().toISOString()
        };
        this.redoHistory.push(currentState);

        // 마지막 undo 작업을 가져오기
        const undoAction = this.undoHistory.pop();
        
        // 상태 복원
        if (undoAction.segments) {
          this.segmentedMeasurements = JSON.parse(JSON.stringify(undoAction.segments));
        }
        if (undoAction.references) {
          this.referenceLines = JSON.parse(JSON.stringify(undoAction.references));
        }
        if (undoAction.defects) {
          this.defectMeasurements = JSON.parse(JSON.stringify(undoAction.defects));
        }

        // 선택 상태 초기화
        this.selectedRows = [];
        this.selectedMeasurement = null;
        this.selectedDefects = [];

        // 캔버스 다시 그리기
        this.$nextTick(() => {
          this.render();
        });

        // 부모 컴포넌트에 변경사항 알림
        this.emitMeasurementsUpdate();

        this.showNotification(`작업이 실행 취소되었습니다.`, 'success');
        // console.log('[undo] 실행 취소 완료:', undoAction.action);

      } catch (error) {
        console.error('[undo] 실행 취소 중 오류:', error);
        this.showNotification('실행 취소 중 오류가 발생했습니다.', 'error');
      }
    },
    
    // 테이블 선택 팝업 표시
    showTableSelector() {
      try {
        // 불량감지 모드인지 확인하여 저장할 데이터 결정
        let measurementsToSave;
        let dataType = '';
        
        if (this.measurementMode === 'defect') {
          // 불량감지 모드일 때는 불량감지 결과 확인
          measurementsToSave = this.defectMeasurements;
          dataType = '불량감지';
        } else {
          // 일반 측정 모드일 때는 기존 측정 결과 확인
          measurementsToSave = this.localMeasurements.length > 0 ? this.localMeasurements : this.segmentedMeasurements;
          dataType = '측정';
        }
        
        if (!measurementsToSave || measurementsToSave.length === 0) {
          this.showNotification(`저장할 ${dataType} 결과가 없습니다.`, 'error');
          return;
        }
        
        // 테이블 선택 팝업 표시
        this.showTableSelectorPopup = true;
        
      } catch (error) {
        console.error('[showTableSelector] 테이블 선택 팝업 표시 중 오류:', error);
        this.showNotification('테이블 선택 팝업 표시 중 오류가 발생했습니다.', 'error');
      }
    },
    
    // 선택한 테이블 이름으로 측정 결과 저장
    async saveWithTableName(selectedTable) {
      console.log(222)
      // console.log('[saveWithTableName] 함수 호출됨, 선택한 테이블:', selectedTable);
      
      try {
        this.isSaving = true;
        
        // 불량감지 모드인지 확인하여 저장할 데이터 결정
        let measurementsToSave;
        let isDefectMode = false;
        
        if (this.measurementMode === 'defect' && this.defectMeasurements && this.defectMeasurements.length > 0) {
          // 불량감지 모드일 때는 불량감지 결과 저장
          measurementsToSave = this.defectMeasurements;
          isDefectMode = true;
        } else {
          // 일반 측정 모드일 때는 우측 테이블에 표시되는 segmentedMeasurements를 우선 저장
          // segmentedMeasurements가 있으면 이를 사용하고, 없으면 localMeasurements 사용
          let allMeasurements = this.segmentedMeasurements.length > 0 ? this.segmentedMeasurements : this.localMeasurements;
          
          // 현재 모드에 따라 밝은 영역 또는 어두운 영역 데이터만 필터링
          measurementsToSave = allMeasurements.filter(measurement => {
            // isTotal인 경우는 전체 선이므로 제외
            if (measurement.isTotal) {
              return false;
            }
            // 현재 모드가 어두운 모드(isReversed=true)인 경우 어두운 영역(!isBright) 데이터만 저장
            // 현재 모드가 밝은 모드(isReversed=false)인 경우 밝은 영역(isBright) 데이터만 저장
            return this.isReversed ? !measurement.isBright : measurement.isBright;
          });
          
          // 디버깅: 저장할 데이터 확인
          console.log('[saveWithTableName] 저장할 데이터 결정:');
          console.log('- segmentedMeasurements 개수:', this.segmentedMeasurements.length);
          console.log('- localMeasurements 개수:', this.localMeasurements.length);
          console.log('- 선택된 데이터 소스:', this.segmentedMeasurements.length > 0 ? 'segmentedMeasurements' : 'localMeasurements');
          console.log('- 현재 모드:', this.isReversed ? '어두운 영역' : '밝은 영역');
          console.log('- 필터링 전 데이터 개수:', allMeasurements.length);
          console.log('- 저장할 데이터 개수:', measurementsToSave.length);
          
          // 처음 3개 데이터 샘플 출력
          if (measurementsToSave.length > 0) {
            console.log('- 저장할 데이터 샘플 (처음 3개):');
            measurementsToSave.slice(0, 3).forEach((item, index) => {
              console.log(`  [${index}]:`, {
                itemId: item.itemId,
                subItemId: item.subItemId,
                value: item.value,
                isBright: item.isBright,
                isTotal: item.isTotal
              });
            });
          }
        }
        
        if (!measurementsToSave || measurementsToSave.length === 0) {
          console.error('[saveWithTableName] 저장할 데이터가 없습니다');
          this.showNotification('저장할 측정 결과가 없습니다.', 'error');
          return;
        }
        
        // 로컬 스토리지에서 사용자 정보 가져오기
        const userInfo = JSON.parse(localStorage.getItem('user') || '{}');
        const userName = userInfo.username || '';
        
        if (!userName) {
          this.showNotification('사용자 정보를 찾을 수 없습니다.', 'error');
          return;
        }
        
        // 측정 데이터 가공
        let processedMeasurements;
        
        if (isDefectMode) {
          // 불량감지 결과 데이터 가공
          processedMeasurements = measurementsToSave.map((defect, index) => ({
            itemId: defect.itemId || `defect_${index + 1}`,
            subItemId: defect.subItemId || `d${index + 1}`,
            value: parseFloat(defect.areaScaled) || 0, // 불량 면적을 값으로 사용
            majorAxis: parseFloat(defect.majorAxisScaled) || 0,
            minorAxis: parseFloat(defect.minorAxisScaled) || 0,
            area: parseFloat(defect.areaScaled) || 0,
            distortion: parseFloat(defect.distortion) || 0,
            striation: parseFloat(defect.striation) || 0,
            description: defect.description || '',
            brightness: defect.brightness || 0,
            isBright: defect.isBright || false,
            isDistorted: defect.isDistorted || false,
            isStriated: defect.isStriated || false
          }));
        } else {
          // 일반 측정 결과 데이터 가공
          processedMeasurements = measurementsToSave.map((measurement, index) => ({
            itemId: measurement.itemId || `item_${index + 1}`,
            subItemId: measurement.subItemId || `sub_${index + 1}`,
            value: parseFloat(measurement.value) || 0
          }));
        }
        
        // API 요청 데이터 준비 - selectedTable에서 lot_wafer 값을 가져와서 사용
        const requestData = {
          table_name: selectedTable.table_name,
          username: userName,
          lot_wafer: selectedTable.lot_wafer || '', // selectedTable에서 lot_wafer 값 사용
          measurements: processedMeasurements,
          measurement_type: isDefectMode ? 'defect' : 'measurement' // 측정 타입 추가
        };
        
        // console.log('[saveWithTableName] API 요청 데이터:', requestData);
        
        // API 호출
        const response = await fetch('http://localhost:8000/api/msa6/save-with-table-name', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestData)
        });
        
        const result = await response.json();
        
        if (result.status !== 'success') {
          if (response.status === 403) {
            this.showNotification(result.message || '해당 테이블에 대한 저장 권한이 없습니다.', 'error');
            return;
          }
          throw new Error(result.message || '저장 실패');
        }
        
        // 측정 결과 저장 성공 후 이미지도 저장
        await this.saveMeasurementImages(selectedTable, isDefectMode);
        
        const dataType = isDefectMode ? '불량감지' : '측정';
        this.showNotification(`${dataType} 결과가 '${selectedTable.table_name}' 테이블에 저장되었습니다.`, 'success');
        this.showTableSelectorPopup = false;
        
      } catch (error) {
        console.error('[saveWithTableName] 저장 중 오류:', error);
        this.showNotification('측정 결과 저장 중 오류가 발생했습니다.', 'error');
      } finally {
        this.isSaving = false;
      }
    },
    
    // 측정 결과 이미지 저장 함수
    async saveMeasurementImages(selectedTable, isDefectMode) {
      try {
        console.log('[saveMeasurementImages] 이미지 저장 시작');
        
        // 고정 크기 설정 (1920x1080)
        const FIXED_WIDTH = 1920;
        const FIXED_HEIGHT = 1080;
        
        // 캔버스에서 현재 측정 결과가 포함된 이미지를 가져오기 (다운로드와 동일한 방식)
        const canvas = this.$refs.canvas;
        if (!canvas) {
          console.error('[saveMeasurementImages] 캔버스를 찾을 수 없음');
          return;
        }
        
        // 처리 후 이미지 생성 (고정 크기로 변환)
        const afterImageDataUrl = await this.createFixedSizeImage(canvas, FIXED_WIDTH, FIXED_HEIGHT);
        
        // 처리 전 이미지 생성 - 다운로드 기능과 동일한 방식으로 변경
        let beforeImageDataUrl = null;
        
        // 현재 이미지 표시 상태 저장
        const originalIsShowingInputImage = this.isShowingInputImage;
        
        try {
          // 처리 전 이미지 모드로 임시 전환
          if (!this.isShowingInputImage && (this.internalInputImageUrl || this.inputImageUrl)) {
            this.isShowingInputImage = true;
            
            // Vue의 반응성을 기다림
            await this.$nextTick();
            
            // 이미지 로드 완료를 기다림
            await new Promise((resolve) => {
              setTimeout(resolve, 100);
            });
            
            // 처리 전 모드에서의 캔버스 상태를 그대로 저장 (다운로드 기능과 동일)
            beforeImageDataUrl = await this.createFixedSizeImage(canvas, FIXED_WIDTH, FIXED_HEIGHT);
          } else if (this.isShowingInputImage) {
            // 이미 처리 전 이미지를 표시 중인 경우
            beforeImageDataUrl = await this.createFixedSizeImage(canvas, FIXED_WIDTH, FIXED_HEIGHT);
          } else {
            // 처리 전 이미지가 없는 경우 처리 후 이미지를 복사
            console.warn('[saveMeasurementImages] 처리 전 이미지가 없어 처리 후 이미지를 사용합니다.');
            beforeImageDataUrl = afterImageDataUrl;
          }
        } finally {
          // 원래 이미지 표시 상태로 복원
          if (this.isShowingInputImage !== originalIsShowingInputImage) {
            this.isShowingInputImage = originalIsShowingInputImage;
            await this.$nextTick();
          }
        }
        
        // API 요청 데이터 준비 - 파일명을 {lot_wafer}_before, {lot_wafer}_after로 설정
        const imageData = {
          before_image: beforeImageDataUrl,
          after_image: afterImageDataUrl,
          measurement_type: isDefectMode ? 'defect' : 'measurement',
          table_name: selectedTable.table_name,
          lot_wafer: selectedTable.lot_wafer || 'unknown',
          title: `${selectedTable.lot_wafer || 'unknown'}_${isDefectMode ? 'defect' : 'measurement'}_${new Date().toISOString().slice(0, 10)}`
        };
        
        console.log('[saveMeasurementImages] 이미지 저장 API 호출');
        
        // 이미지 저장 API 호출
        const response = await fetch('http://localhost:8000/api/external_storage/save-measurement-images', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(imageData)
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
          console.log('[saveMeasurementImages] 이미지 저장 성공:', result);
          const folderName = result.saved_images?.folder || 'results_images';
          console.log(`이미지가 ${folderName} 폴더에 저장되었습니다.`);
        } else {
          console.error('[saveMeasurementImages] 이미지 저장 실패:', result);
        }
        
      } catch (error) {
        console.error('[saveMeasurementImages] 이미지 저장 중 오류:', error);
        // 이미지 저장 실패는 전체 저장 과정을 중단하지 않도록 함
      }
    },
    
    // 캔버스를 고정 크기로 변환하는 함수
    async createFixedSizeImage(sourceCanvas, width, height) {
      return new Promise((resolve, reject) => {
        // 고정 크기의 임시 캔버스 생성
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCanvas.width = width;
        tempCanvas.height = height;
        
        // 소스 캔버스를 고정 크기에 맞게 그리기
        tempCtx.drawImage(sourceCanvas, 0, 0, width, height);
        
        // DataURL로 변환
        tempCanvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('이미지 변환 실패'));
            return;
          }
          
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        }, 'image/png');
      });
    },
    
    // 이미지 URL을 고정 크기 DataURL로 변환하는 헬퍼 함수
    async convertImageToFixedSize(imageUrl, width, height) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
          // 고정 크기의 임시 캔버스 생성
          const tempCanvas = document.createElement('canvas');
          const tempCtx = tempCanvas.getContext('2d');
          
          tempCanvas.width = width;
          tempCanvas.height = height;
          
          // 이미지를 고정 크기에 맞게 그리기
          tempCtx.drawImage(img, 0, 0, width, height);
          
          // DataURL로 변환
          tempCanvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('이미지 변환 실패'));
              return;
            }
            
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          }, 'image/png');
        };
        
        img.onerror = () => reject(new Error('이미지 로드 실패'));
        img.src = imageUrl;
      });
    },
    // 원본 이미지에 측정 결과를 그려서 생성하는 함수
    async createImageWithMeasurements(imageUrl, width, height) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
          // 고정 크기의 임시 캔버스 생성
          const tempCanvas = document.createElement('canvas');
          const tempCtx = tempCanvas.getContext('2d');
          
          tempCanvas.width = width;
          tempCanvas.height = height;
          
          // 원본 이미지를 고정 크기에 맞게 그리기
          tempCtx.drawImage(img, 0, 0, width, height);
          
          // 현재 캔버스의 측정 결과를 임시 캔버스에 그리기
          this.drawMeasurementsOnCanvas(tempCtx, width, height);
          
          // DataURL로 변환
          tempCanvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('이미지 변환 실패'));
              return;
            }
            
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          }, 'image/png');
        };
        
        img.onerror = () => reject(new Error('이미지 로드 실패'));
        img.src = imageUrl;
      });
    },
    
    // 캔버스에 측정 결과를 그리는 함수
    drawMeasurementsOnCanvas(ctx, canvasWidth, canvasHeight) {
      try {
        // 현재 캔버스 크기 가져오기
        const currentCanvas = this.$refs.canvas;
        if (!currentCanvas) return;
        
        const scaleX = canvasWidth / currentCanvas.width;
        const scaleY = canvasHeight / currentCanvas.height;
        
        // 기준선 그리기
        if (this.referenceLines.length > 0) {
          this.referenceLines.forEach((refLine) => {
            ctx.beginPath();
            ctx.strokeStyle = refLine.color || this.referenceLineColor;
            ctx.lineWidth = 4 * Math.min(scaleX, scaleY);
            ctx.setLineDash([]);
            ctx.moveTo(refLine.start.x * scaleX, refLine.start.y * scaleY);
            ctx.lineTo(refLine.end.x * scaleX, refLine.end.y * scaleY);
            ctx.stroke();
          });
        }

        // 측정된 선들 그리기 - 캔버스와 동일한 로직 적용
        if (this.measurementMode !== 'defect') {
          this.segmentedMeasurements.forEach(segment => {
            const shouldDisplay = this.isReversed ? segment.isBright : !segment.isBright;
            
            ctx.beginPath();
            if (shouldDisplay) {
              ctx.strokeStyle = 'blue';
              ctx.setLineDash([5 * Math.min(scaleX, scaleY), 5 * Math.min(scaleX, scaleY)]);
            } else {
              ctx.strokeStyle = 'red';
              ctx.setLineDash([]);
            }
            
            ctx.lineWidth = 2 * Math.min(scaleX, scaleY);
            ctx.moveTo(segment.start.x * scaleX, segment.start.y * scaleY);
            ctx.lineTo(segment.end.x * scaleX, segment.end.y * scaleY);
            ctx.stroke();
            
            // 측정값 텍스트 표시 - shouldDisplay 조건과 동일하게 적용
            if (segment.value && !shouldDisplay) {
              const midX = (segment.start.x + segment.end.x) / 2 * scaleX;
              const midY = (segment.start.y + segment.end.y) / 2 * scaleY;
              
              // 텍스트 배경을 위한 반투명 사각형
              ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
              const text = `${segment.value.toFixed(2)}nm`;
              ctx.font = `${12 * Math.min(scaleX, scaleY)}px Arial`;
              const textMetrics = ctx.measureText(text);
              const textWidth = textMetrics.width;
              const textHeight = 12 * Math.min(scaleX, scaleY);
              
              ctx.fillRect(midX + 5 * scaleX, midY - textHeight - 5 * scaleY, textWidth + 6 * scaleX, textHeight + 4 * scaleY);
              
              // 측정값 텍스트
              ctx.fillStyle = 'white';
              ctx.font = `${12 * Math.min(scaleX, scaleY)}px Arial`;
              ctx.textAlign = 'left';
              ctx.fillText(text, midX + 8 * scaleX, midY - 8 * scaleY);
            }
          });
        }

        // 로컬 측정값들 그리기 - 캔버스와 동일한 파란색 사용
        if (this.localMeasurements.length > 0) {
          this.localMeasurements.forEach((measurement) => {
            if (measurement.start && measurement.end) {
              ctx.beginPath();
              ctx.strokeStyle = 'blue'; // 캔버스와 동일한 파란색 사용
              ctx.lineWidth = 2 * Math.min(scaleX, scaleY); // 캔버스와 동일한 두께
              ctx.setLineDash([]);
              ctx.moveTo(measurement.start.x * scaleX, measurement.start.y * scaleY);
              ctx.lineTo(measurement.end.x * scaleX, measurement.end.y * scaleY);
              ctx.stroke();
              
              // 측정값 텍스트 표시 - 캔버스와 동일한 스타일
              if (measurement.value) {
                const midX = (measurement.start.x + measurement.end.x) / 2 * scaleX;
                const midY = (measurement.start.y + measurement.end.y) / 2 * scaleY;
                
                // 텍스트 배경을 위한 반투명 사각형
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                const text = `${measurement.value.toFixed(2)}nm`;
                ctx.font = `${12 * Math.min(scaleX, scaleY)}px Arial`;
                const textMetrics = ctx.measureText(text);
                const textWidth = textMetrics.width;
                const textHeight = 12 * Math.min(scaleX, scaleY);
                
                ctx.fillRect(midX + 5 * scaleX, midY - textHeight - 5 * scaleY, textWidth + 6 * scaleX, textHeight + 4 * scaleY);
                
                // 측정값 텍스트
                ctx.fillStyle = 'white';
                ctx.font = `${12 * Math.min(scaleX, scaleY)}px Arial`;
                ctx.textAlign = 'left';
                ctx.fillText(text, midX + 8 * scaleX, midY - 8 * scaleY);
              }
            }
          });
        }

        // 불량감지 결과 그리기 - 캔버스와 동일한 녹색 스타일 사용
        if (this.defectMeasurements && this.defectMeasurements.length > 0) {
          this.defectMeasurements.forEach((defect, index) => {
            // 중심점 좌표가 있으면 직접 사용, 없으면 계산
            const centerX = (defect.centerX || (defect.x + defect.width / 2)) * scaleX;
            const centerY = (defect.centerY || (defect.y + defect.height / 2)) * scaleY;
            const radiusX = (defect.radiusX || defect.width / 2) * scaleX;
            const radiusY = (defect.radiusY || defect.height / 2) * scaleY;
            
            // 1. 실제 불량 영역의 edge 픽셀들을 작은 녹색 점으로 표시
            if (defect.edgePixels && defect.edgePixels.length > 0) {
              ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
              for (const edgePixel of defect.edgePixels) {
              ctx.beginPath();
                ctx.arc(edgePixel.x * scaleX, edgePixel.y * scaleY, 0.8 * Math.min(scaleX, scaleY), 0, 2 * Math.PI);
                ctx.fill();
              }
            }
            
            // 2. 장축/단축 기반 타원 테두리 (녹색 실선)
            ctx.beginPath();
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 2 * Math.min(scaleX, scaleY);
              ctx.setLineDash([]);
            
            ctx.ellipse(
              centerX,
              centerY,
              radiusX,
              radiusY,
              0, 0, 2 * Math.PI
            );
              ctx.stroke();
              
            // 3. 불량 번호 표시 (녹색)
            ctx.fillStyle = '#00ff00';
            ctx.font = `bold ${12 * Math.min(scaleX, scaleY)}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(
              `${defect.id}`, 
              centerX, 
              centerY + 4 * Math.min(scaleX, scaleY)
            );
            
          });
        }

        // 수동 스케일바 그리기 - 캔버스와 동일한 주황색 스타일
        if (this.manualScaleBar && this.scaleMethod === 'scaleBar') {
          ctx.beginPath();
          ctx.strokeStyle = '#FF6600'; // 주황색으로 구분
          ctx.lineWidth = 3 * Math.min(scaleX, scaleY);
          ctx.setLineDash([8 * Math.min(scaleX, scaleY), 4 * Math.min(scaleX, scaleY)]); // 점선 패턴으로 구분
          ctx.moveTo(this.manualScaleBar.start.x * scaleX, this.manualScaleBar.start.y * scaleY);
          ctx.lineTo(this.manualScaleBar.end.x * scaleX, this.manualScaleBar.end.y * scaleY);
          ctx.stroke();
          
          // 스케일바 표시를 위한 텍스트 추가
          if (this.scaleBarValue && this.scaleBarUnit) {
            ctx.fillStyle = '#FF6600';
            ctx.font = `${12 * Math.min(scaleX, scaleY)}px Arial`;
            ctx.textAlign = 'center';
            const midX = (this.manualScaleBar.start.x + this.manualScaleBar.end.x) / 2 * scaleX;
            const midY = (this.manualScaleBar.start.y + this.manualScaleBar.end.y) / 2 * scaleY - 10 * Math.min(scaleX, scaleY);
            ctx.fillText(`${this.scaleBarValue} ${this.scaleBarUnit}`, midX, midY);
          }
        }

      } catch (error) {
        console.error('[drawMeasurementsOnCanvas] 측정 결과 그리기 중 오류:', error);
      }
    },

    // 다시 실행 함수
    redo() {
      try {
        if (this.redoHistory.length === 0) {
          this.showNotification('다시 실행할 작업이 없습니다.', 'info');
          return;
        }

        // Redo 작업을 가져오기
        const redoAction = this.redoHistory.pop();
        
        // 현재 상태를 undo 히스토리에 저장
        const currentState = {
          action: 'redo_current',
          data: null,
          segments: JSON.parse(JSON.stringify(this.segmentedMeasurements)),
          references: JSON.parse(JSON.stringify(this.referenceLines)),
          defects: JSON.parse(JSON.stringify(this.defectMeasurements)),
          timestamp: new Date().toISOString()
        };
        this.undoHistory.push(currentState);

        // 상태 복원
        if (redoAction.segments) {
          this.segmentedMeasurements = JSON.parse(JSON.stringify(redoAction.segments));
        }
        if (redoAction.references) {
          this.referenceLines = JSON.parse(JSON.stringify(redoAction.references));
        }
        if (redoAction.defects) {
          this.defectMeasurements = JSON.parse(JSON.stringify(redoAction.defects));
        }

        // 선택 상태 초기화
        this.selectedRows = [];
        this.selectedMeasurement = null;
        this.selectedDefects = [];

        // 캔버스 다시 그리기
        this.$nextTick(() => {
          this.render();
        });

        // 부모 컴포넌트에 변경사항 알림
        this.emitMeasurementsUpdate();

        this.showNotification(`작업이 다시 실행되었습니다.`, 'success');

      } catch (error) {
        console.error('[redo] 다시 실행 중 오류:', error);
        this.showNotification('다시 실행 중 오류가 발생했습니다.', 'error');
      }
    },

    // 단축키 처리 함수
    handleKeyDown(e) {
      try {
        // 텍스트 입력 영역에서는 단축키 비활성화
        const activeElement = document.activeElement;
        if (activeElement && (
          activeElement.tagName === 'INPUT' || 
          activeElement.tagName === 'TEXTAREA' || 
          activeElement.contentEditable === 'true' ||
          activeElement.isContentEditable
        )) {
          return; // 텍스트 입력 중에는 단축키 처리하지 않음
        }
        if ((event.ctrlKey || event.metaKey) && ['c', 'a', 'x'].includes(event.key.toLowerCase())) {
          return; // 기본 복사/붙여넣기/전체선택/잘라내기 허용
        }

        const key = e.key.toLowerCase();

        // 기본 텍스트 조작 키는 허용 (추가 필요)
        if (e.ctrlKey && ['c', 'a', 'x'].includes(key)) {
          return; // 기본 복사/붙여넣기/전체선택/잘라내기 허용
        }

        // F키: 밝기값 보기 및 돋보기 비활성화
        if (key === 'f') {
          e.preventDefault();
          this.showBrightnessTooltip = true;
          this.isFKeyPressed = true;
          return;
        }

        // A키: 영역 선 측정 모드 (한번 더 누르면 수직/수평 방향 전환)
        if (key === 'a') {
          e.preventDefault();
          if (this.measurementMode === 'area' || this.measurementMode === 'area-vertical' || this.measurementMode === 'area-horizontal') {
            // 이미 영역 모드인 경우 방향 전환
            this.areaDirection = this.areaDirection === 'horizontal' ? 'vertical' : 'horizontal';
            
            // 방향에 따라 구체적인 모드 설정
            if (this.areaDirection === 'horizontal') {
              this.measurementMode = 'area-horizontal';
            } else {
              this.measurementMode = 'area-vertical';
            }
            
            this.showNotification(`영역 측정 방향: ${this.areaDirection === 'horizontal' ? '수평' : '수직'}`, 'info');
          } else {
            // 영역 모드 활성화
            this.setMode('area');
            this.showNotification('영역 선 측정 모드 활성화', 'info');
          }
          return;
        }

        // S키: 단일 선 측정 모드 활성화
        if (key === 's') {
          e.preventDefault();
          this.setMode('line');
          this.showNotification('단일 선 측정 모드 활성화', 'info');
          return;
        }

        // C키: Cut - 기준선 그리기 모드 활성화
        if (key === 'c') {
          e.preventDefault();
          this.setMode('reference');
          this.showNotification('기준선 그리기 모드 활성화', 'info');
          return;
        }

        // D키: 선택된 측정 결과 삭제
        if (key === 'd' && !this.isDKeyPressed) {
          e.preventDefault();
          this.isDKeyPressed = true;
          
          // 이미 삭제 모드가 활성화되어 있는 경우 비활성화
          if (this.isDeleteMode) {
            this.isDeleteMode = false;
            this.showNotification('삭제 모드 비활성화됨.', 'info');
            return;
          }
          
          // 선택된 항목이 있는 경우 삭제
          if (this.selectedRows.length > 0 || this.selectedDefects.length > 0) {
            this.deleteSelectedMeasurements();
          } else {
            // 선택된 항목이 없으면 삭제 모드 활성화
            this.isDeleteMode = true;
            this.showNotification('삭제 모드 활성화됨. 삭제할 측정 결과를 클릭하세요.', 'info');
          }
          return;
        }

        // H키: 도움말 표시
        if (key === 'h') {
          e.preventDefault();
          this.showShortcutHelp = true;
          return;
        }

        // R키: 불량 감지 모드 활성화 (Recognition)
        if (key === 'r') {
          e.preventDefault();
          this.setMode('defect');
          this.showNotification('불량 감지 모드 활성화', 'info');
          return;
        }

        // Ctrl+Z: 측정 실행 취소
        if (e.ctrlKey && key === 'z') {
          e.preventDefault();
          this.undo();
          return;
        }

        // Ctrl+Y: 측정 다시 실행
        if (e.ctrlKey && key === 'y') {
          e.preventDefault();
          this.redo();
          return;
        }

      } catch (error) {
        console.error('[handleKeyDown] 키보드 이벤트 처리 중 오류:', error);
      }
    },

    // 경로 내 측정값 삭제 함수
    deleteMeasurementsInPath() {
      try {
        if (!this.deleteStart || !this.deleteEnd) {
          console.warn('[deleteMeasurementsInPath] Delete path not defined');
          return;
        }

        let deletedCount = 0;

        // 히스토리 저장
        this.addToHistory('delete', null);

        // 세그먼트 측정값 삭제 - 드래그 선분과 교차하는 것들만 삭제
        const initialSegmentCount = this.segmentedMeasurements.length;
        this.segmentedMeasurements = this.segmentedMeasurements.filter(segment => {
          return !this.doLinesIntersect(
            this.deleteStart, this.deleteEnd,
            segment.start, segment.end
          );
        });
        deletedCount += initialSegmentCount - this.segmentedMeasurements.length;

        // 기준선 삭제 - 드래그 선분과 교차하는 것들만 삭제
        const initialReferenceCount = this.referenceLines.length;
        this.referenceLines = this.referenceLines.filter(ref => {
          return !this.doLinesIntersect(
            this.deleteStart, this.deleteEnd,
            ref.start, ref.end
          );
        });
        deletedCount += initialReferenceCount - this.referenceLines.length;

        // 불량 감지 결과 삭제 - 드래그 선분 근처에 있는 것들만 삭제
        const initialDefectCount = this.defectMeasurements.length;
        this.defectMeasurements = this.defectMeasurements.filter(defect => {
          if (defect.center) {
            const distance = this.getPointToLineDistance(
              defect.center, this.deleteStart, this.deleteEnd
            );
            return distance > 15; // 불량 감지는 15픽셀 임계값 사용
          }
          return true;
        });
        deletedCount += initialDefectCount - this.defectMeasurements.length;

        // 선택 상태 초기화
        this.selectedRows = [];
        this.selectedMeasurement = null;
        this.selectedDefects = [];

        // 부모 컴포넌트에 변경사항 알림
        this.emitMeasurementsUpdate();

        if (deletedCount > 0) {
          this.showNotification(`${deletedCount}개의 측정 결과가 삭제되었습니다.`, 'success');
        } else {
          this.showNotification('삭제할 측정 결과를 찾을 수 없습니다.', 'info');
        }

      } catch (error) {
        console.error('[deleteMeasurementsInPath] 경로 내 측정값 삭제 중 오류:', error);
        this.showNotification('측정값 삭제 중 오류가 발생했습니다.', 'error');
      }
    },

    // 두 선분이 교차하는지 판단하는 함수
    doLinesIntersect(line1Start, line1End, line2Start, line2End) {
      const d1 = this.getDirection(line1Start, line1End, line2Start);
      const d2 = this.getDirection(line1Start, line1End, line2End);
      const d3 = this.getDirection(line2Start, line2End, line1Start);
      const d4 = this.getDirection(line2Start, line2End, line1End);

      // 일반적인 교차 케이스
      if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
          ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
        return true;
      }

      // 특수 케이스: 점이 선분 위에 있는 경우
      if (d1 === 0 && this.isPointOnSegment(line1Start, line1End, line2Start)) return true;
      if (d2 === 0 && this.isPointOnSegment(line1Start, line1End, line2End)) return true;
      if (d3 === 0 && this.isPointOnSegment(line2Start, line2End, line1Start)) return true;
      if (d4 === 0 && this.isPointOnSegment(line2Start, line2End, line1End)) return true;

      return false;
    },

    // 세 점의 방향성을 계산하는 함수
    getDirection(p1, p2, p3) {
      return (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
    },

    // 점이 선분 위에 있는지 확인하는 함수
    isPointOnSegment(lineStart, lineEnd, point) {
      return point.x <= Math.max(lineStart.x, lineEnd.x) &&
             point.x >= Math.min(lineStart.x, lineEnd.x) &&
             point.y <= Math.max(lineStart.y, lineEnd.y) &&
             point.y >= Math.min(lineStart.y, lineEnd.y);
    },

    // 점과 선분 간 거리 계산
    getPointToLineDistance(point, lineStart, lineEnd) {
      const A = point.x - lineStart.x;
      const B = point.y - lineStart.y;
      const C = lineEnd.x - lineStart.x;
      const D = lineEnd.y - lineStart.y;

      const dot = A * C + B * D;
      const lenSq = C * C + D * D;
      
      if (lenSq === 0) {
        // 선분의 길이가 0인 경우 (점과 점 사이의 거리)
        return Math.sqrt(A * A + B * B);
      }

      let param = dot / lenSq;

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

    // 두 점 사이의 거리 비율 계산 (전체 선 길이에 대한 비율)
    getDistanceRatio(start, end, lineStart, lineEnd) {
      // 두 점 사이의 거리 계산
      const dx1 = end.x - start.x;
      const dy1 = end.y - start.y;
      const segmentLength = Math.sqrt(dx1 * dx1 + dy1 * dy1);
      
      // 전체 선 길이 계산
      const dx2 = lineEnd.x - lineStart.x;
      const dy2 = lineEnd.y - lineStart.y;
      const totalLength = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      
      // 비율 계산 (0으로 나누는 것을 방지)
      return totalLength > 0 ? segmentLength / totalLength : 0;
    },
  },
  created() {
    // 이미지 URL을 로컬 변수에 복사 (prop과 분리)
    this.localImageUrl = this.imageUrl;
    this.localInputImageUrl = this.inputImageUrl;
    
    // 측정값을 로컬 배열에 깊은 복사 (prop과 분리)
    this.initializeMeasurements();
    
    // 모드 초기화
    if (this.config && this.config.defaultMode) {
      this.mode = this.config.defaultMode;
    }
    
    // 로컬 키보드 이벤트 핸들러 설정
    this.keydownHandler = (e) => {
      // Escape 키로 팝업 닫기
      if (e.key === 'Escape') {
        this.closePopup();
      }
    };
    
    // 이벤트 리스너 등록
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', this.keydownHandler);
    }
  },
};
</script>

<style scoped>

</style>


