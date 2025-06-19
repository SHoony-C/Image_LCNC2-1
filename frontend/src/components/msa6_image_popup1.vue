<template>
  <div class="msa6-image-popup-container">
  <Teleport to="body">
      <div class="image-measurement-popup" v-show="isVisible" @click.self="closePopup">
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
                <button class="option-btn" :class="{ active: measurementMode === 'defect' }" @click="setMode('defect')" title="불량 감지">
                  <i class="fas fa-search"></i>
                </button>
              </div>
            </div>
            
            <button class="reset-btn" @click="resetMeasurements" title="모든 측정 결과 초기화">
                <i class="fas fa-trash-alt"></i> <span class="btn-text">초기화</span>
            </button>
            <button class="close-btn" @click="closePopup">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>

        <div class="measurement-content">
          <div class="image-container" ref="container">
            <img ref="sourceImage" :src="isShowingInputImage ? internalInputImageUrl : imageUrl" crossorigin="anonymous" style="display: none;" @load="handleImageLoad" />
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
                v-if="internalInputImageUrl && outputImageUrl"
                class="toggle-image-btn" 
                @click="toggleBeforeAfterImage" 
                :title="isShowingInputImage ? '처리 후 이미지 보기' : '처리 전 이미지 보기'"
              >
                <i class="fas" :class="isShowingInputImage ? 'fa-arrow-right' : 'fa-arrow-left'"></i>
                <span>{{ isShowingInputImage ? '처리 후' : '처리 전' }}</span>
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
                <h5>ID 설정</h5>
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
                <button class="btn-apply" @click="applySelectedIds" :disabled="selectedRows.length === 0 || (!newItemId && !newSubId)">
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
                  class="send-api-btn" 
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
                        <th>삭제</th>
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
                        <th>X</th>
                        <th>Y</th>
                        <th>값</th>
                        <th>양/불</th>
                        <th v-if="circleOptions.striation">Striation</th>
                        <th v-if="circleOptions.distortion">Distortion</th>
                        <th>삭제</th>
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
                        <td>{{ defect.x?.toFixed(2) }}</td>
                        <td>{{ defect.y?.toFixed(2) }}</td>
                        <td>{{ defect.value?.toFixed(2) }}</td>
                        <td>{{ defect.isBright ? '양' : '불' }}</td>
                        <td v-if="circleOptions.striation">{{ defect.isStriated ? '있음' : '없음' }}</td>
                        <td v-if="circleOptions.distortion">{{ defect.isDistorted ? '있음' : '없음' }}</td>
                        <td class="action-buttons">
                          <button class="option-btn" @click.stop="deleteDefect(defect)">
                            <i class="fas fa-trash"></i>
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div class="results-bottom-bar">
                  <div class="results-summary">
                    <span>총 측정: {{ measurementMode === 'defect' ? defectMeasurements.length : filteredMeasurements.length }}</span>
                  </div>
                  <button 
                    class="save-measurements-btn" 
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
              <template v-if="!isAreaSelectionMode">
                <div class="control-group">
                  <label class="control-label">밝기 임계값: {{ brightnessThreshold }}</label>
                  <input type="range" v-model="brightnessThreshold" min="0" max="255" class="threshold-slider" />
                  <button class="option-btn" @click="toggleReverse">
                    {{ isReversed ? '어두운 영역' : '밝은 영역' }}
                  </button>
                </div>

                <!-- 선 개수와 배율 설정 컨트롤 삭제 - 상단에 이미 있음 -->
              </template>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 테이블 이름 선택 팝업 -->
      <TableNameSelector
        :show="showTableSelectorPopup"
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
    
    <Teleport to="body">
      <div class="scale-choice-popup super-overlay" v-if="showScaleChoicePopup">
        <div class="scale-choice-content">
          <h3>스케일바 감지 알림</h3>
          <p>스케일바 자동감지에 실패했습니다. </p>
          <p>측정 방식을 선택해주세요</p>
          <div class="scale-choice-buttons">
            <button class="choice-btn magnification-btn" @click="selectScaleMethod('magnification')">
              <i class="fas fa-search-plus"></i>
              <span>배율 기반 측정</span>
              <small>배율 값을 기준으로 측정합니다</small>
            </button>
            <button class="choice-btn scalebar-btn" @click="selectScaleMethod('scaleBar')">
              <i class="fas fa-pencil-ruler"></i>
              <span>수동 스케일바 설정</span>
              <small>이미지의 스케일바를 직접 지정합니다</small>
            </button>
          </div>
        </div>
    </div>
  </Teleport>
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
  emits: ['close', 'update:showPopup'],
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
      nextId: 1,
      subItemPrefix: 'S',
      // 기준선용 별도 ID 카운터 추가
      referenceId: 1,
      brightnessThreshold: 200,
      isReversed: false,
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
      undoHistory: [],
      redoHistory: [],
      areaStart: null,
      areaEnd: null,
      lineSpacing: 50,
      lineCount: 10,
      circleOptions: {
        striation: false,
        distortion: false
      },
      selectedArea: null,
      isApiSending: false,
      isAreaSelectionMode: false,
      areaSelectionStart: null,
      areaSelectionEnd: null,
      selectedAreaRect: null,
      defectMeasurements: [],
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
      // 스케일바 감지 실패 시 선택 팝업 관련 변수 추가
      showScaleChoicePopup: false,
      // 첫 번째 감지 시도 플래그 추가
      isFirstDetectionAttempt: true,
      // 최초 로드 완료 플래그 추가
      initialLoadDone: false,
      // 이미지 전/후 전환 관련 변수 추가
      isShowingInputImage: false, // 기본적으로 출력 이미지 표시
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
      previousMeasurementMode: 'line' // 이전 측정 모드 저장
    };
  },
  mounted() {
    // console.log('[mounted] 컴포넌트 마운트됨');
    
    
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
        this.showScaleChoicePopup = true;
        
        // 직접 DOM에 팝업 생성
        setTimeout(() => {
          this.showScaleDetectionFailurePopup();
          
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
        this.detectScaleBar();
      }
    }, 500);
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
    brightSegmentsCount() {
      return this.filteredMeasurements.length;
    },
    darkSegmentsCount() {
      return this.segmentedMeasurements.filter(s => !s.isBright).length;
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
    imageUrl: {
      immediate: true,
      handler(newUrl) {
        if (newUrl) {
          // console.logconsole.log('[watch:imageUrl] 이미지 URL 변경:', newUrl);
          this.$nextTick(() => {
            this.loadImage(newUrl);
            
            // 이미지 로드 후 스케일바 감지 시도 (지연 적용)
            if (this.scaleMethod === 'scaleBar') {
              setTimeout(() => {
                // console.log('[watch:imageUrl] 이미지 URL 변경 후 스케일바 감지 시도');
                this.detectScaleBar();
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
        
        // 자동 감지 시 수동 설정 플래그를 변경하지 않도록 수정
        // 스케일바가 감지되었을 때 manualScaleBarSet을 true로 설정하지 않음
        if (detected) {
          // console.log('[watch:scaleBarDetected] 스케일바가 감지됨, 설정 저장');
          
          // 설정 즉시 저장
          this.saveScaleBarSettings();
          
          // 팝업 플래그 명시적으로 false로 설정
          this.showScaleChoicePopup = false;
          return;
        }
        
        // 이미 수동 스케일바가 설정되어 있는 경우 팝업 표시하지 않음 - 조건 강화
        if (this.manualScaleBarSet && this.scaleBarValue && this.scaleBarUnit) {
          // console.log('[watch:scaleBarDetected] 수동 스케일바가 이미 설정되어 있어 팝업을 표시하지 않음:',
          //   'manualScaleBarSet:', this.manualScaleBarSet,
          //   'scaleBarValue:', this.scaleBarValue,
          //   'scaleBarUnit:', this.scaleBarUnit);
          
          // 팝업 플래그 명시적으로 false로 설정
          this.showScaleChoicePopup = false;
          return;
        }
        
        // 감지 실패 시 팝업 표시 (수동 설정이 없는 경우에만)
        if (!detected && this.scaleMethod === 'scaleBar') {
          // console.log('[watch:scaleBarDetected] 감지 실패, 선택 팝업 표시');
          
          // 세션 스토리지에서 팝업 자동 표시 방지 플래그 확인
          const noAutoPopup = sessionStorage.getItem('msa6_no_auto_popup') === 'true';
          
          if (!noAutoPopup) {
            // 팝업 표시
          this.showScaleChoicePopup = true;
            this.showScaleDetectionFailurePopup();
          this.showNotification('스케일바 자동 감지에 실패했습니다. 측정 방식을 선택해주세요.', 'warning');
          } else {
            // console.log('[watch:scaleBarDetected] 자동 팝업 방지 플래그가 설정되어 있어 팝업을 표시하지 않음');
          }
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
    async loadImage(url) {
      // console.log('[loadImage] 이미지 로드 시작:', url);
      
      if (!url) {
        console.error('[loadImage] 유효한 URL이 제공되지 않음');
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
      this.restoreScaleBarSettings();
      
      // 수동 스케일바 설정 유효성 검증
      const { hasValidManualScaleBar } = this.validateScaleBarSettings();
        
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
        const tempCtx = tempCanvas.getContext('2d');
        
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
        
        // 수동 스케일바가 설정되어 있고 유효한 경우 팝업 표시하지 않음
        if (hasValidManualScaleBar) {
          // console.log('[loadImage] 유효한 수동 스케일바가 이미 설정되어 있어 팝업 표시하지 않음');
        }
        // 스케일바 모드이고 수동 설정이 안 된 경우에만 자동 감지 시도
        else if (this.scaleMethod === 'scaleBar' && this.showPopup) {
          // console.log('[loadImage] 스케일바 자동 감지 시도');
        // 약간의 지연 후 detectScaleBar 호출 (DOM이 완전히 업데이트되도록)
        setTimeout(() => {
            // 자동 감지 실행 - 감지 성공 여부는 detectScaleBar 내에서 처리
            this.detectScaleBar(true); // true = 감지 실패 시 팝업 표시 강제
        }, 300);
        } else {
          // console.log('[loadImage] 자동 감지 미실행:', 
            // '방식:', this.scaleMethod, 
            // '팝업표시:', this.showPopup, 
            // '수동설정여부:', this.manualScaleBarSet);
      }
      
      // 이미지가 로드된 후 기존 측정값 렌더링
      if (this.initialLoadDone && this.measurements.length > 0) {
        // console.log('[loadImage] 기존 측정값 렌더링');
        this.$nextTick(() => this.render());
      }
      
      // 로그 저장 - 측정 팝업 열기
      LogService.logAction('open_measurement_popup', {
        imageLoaded: true
        });
      };
      
      // 이미지 로드 실패 처리
      this.image.onerror = (error) => {
        console.error('[loadImage] 이미지 로드 실패:', error);
        
        // 사용자에게 알림
        this.showNotification('이미지를 불러오는데 실패했습니다. 다시 시도해주세요.', 'error');
        
        // 로그 저장 - 이미지 로드 실패
        LogService.logAction('image_load_error', {
          url: url,
          error: error ? error.toString() : 'Unknown error'
        });
      };
    },
    async handleImageLoad(event) {
      // Get the image element from the event or reference
      const img = event.target || this.$refs.sourceImage;
      
      // console.log('[handleImageLoad] 이미지 로드 완료 - 크기:', img.naturalWidth, 'x', img.naturalHeight);
      this.image = img;
      
      // 전환 중인지 확인 (toggleBeforeAfterImage에서 호출된 경우)
      const isToggling = this.isToggling;
      if (isToggling) {
        // console.log('[handleImageLoad] 이미지 전환 중, 측정 데이터 유지');
        return; // 전환 중이면 추가 처리하지 않음 (toggleBeforeAfterImage에서 처리)
      }
      
      // 원본 이미지 비율 저장
      this.imageRatio = img.naturalWidth / img.naturalHeight;
      
      // 이미지 데이터 추출을 위한 임시 캔버스
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = img.naturalWidth;
      tempCanvas.height = img.naturalHeight;
      const tempCtx = tempCanvas.getContext('2d');
      
      tempCtx.drawImage(img, 0, 0);
      this.imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      
      this.updateCanvasSize();
      
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
          this.showScaleChoicePopup = true;
          
          // 잠시 지연 후 오버라이드 팝업 표시
          setTimeout(() => {
            this.showScaleDetectionFailurePopup();
            
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
        this.detectScaleBar();
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
      
      // 이미지 요소의 크기 확인
      let imgWidth = img ? img.clientWidth : 0;
      let imgHeight = img ? img.clientHeight : 0;
      
      // console.log(`[updateCanvasSize] 이미지 크기: ${imgWidth}x${imgHeight}, 컨테이너 크기: ${container.clientWidth}x${container.clientHeight}`);
      
      // 컨테이너 크기에 맞게 캔버스 크기 조정
      const canvasWidth = container.clientWidth;
      const canvasHeight = container.clientHeight;
      
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      
      // 캔버스를 컨테이너에 맞게 항상 꽉 채움 (마진 없이)
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.margin = '0';
      canvas.style.padding = '0';
      
      // 컨텍스트 재설정 및 이미지 다시 그리기
      this.ctx = canvas.getContext('2d');
      
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
      
      // 기존 측정값들의 좌표 조정
      this.adjustMeasurements(canvasWidth / this.prevWidth, canvasHeight / this.prevHeight);
      
      this.prevWidth = canvasWidth;
      this.prevHeight = canvasHeight;
      
      // 모든 측정 데이터 렌더링
      this.render();
      
      // console.log('[updateCanvasSize] 캔버스 크기 조정 완료');
    },
    adjustMeasurements(scaleX, scaleY) {
      if (!isFinite(scaleX) || !isFinite(scaleY)) return;
      
      // 모든 측정값의 좌표 조정
      this.measurements.forEach(measurement => {
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
      if (!this.$refs.canvas) {
        console.warn('[startMeasurement] Canvas element not found');
        return;
      }

      if (this.isDeleteMode) {
        try {
          const pos = this.getLocalPos(e);
          if (!pos) return;
          this.deleteStart = pos;
          this.deleteEnd = null;
          this.isMeasuring = true;
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

      // 기존 측정 시작 로직
      if (this.measurementMode === 'line' || this.measurementMode === 'reference') {
        this.currentMeasurement = {
          start: {...pos},
          end: {...pos}
        };
      } else if (this.measurementMode === 'circle' || this.measurementMode.startsWith('area')) {
        this.areaStart = {...pos};
        this.areaEnd = {...pos};
      }
      
      this.render();
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
          this.saveScaleBarSettings();
          
          // 스케일바 값 입력 다이얼로그 표시
          this.showScaleBarValueDialog();
          
          // 수동 스케일바 설정 완료 후 바로 측정 모드로 전환
          // isDrawingScaleBar 플래그를 false로 변경하여 다음 드래그는 측정으로 처리되게 함
          this.isDrawingScaleBar = false;
          this.measurementMode = 'line';
          
          // 로그 기록 추가
          // console.log(`[endMeasurement] 수동 스케일바 설정 완료, 픽셀 길이: ${pixelLength}, 자동으로 선 측정 모드로 전환`);
          
          // 상태 변경 알림 표시
          this.showNotification('수동 스케일바 설정 완료. 선 측정 모드로 전환되었습니다.', 'info');
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
            if (this.activeReferenceLine) {
              measurement = this.trimSingleMeasurementByReferenceLine(measurement, this.activeReferenceLine);
              // 자른 후 값 다시 계산
              measurement.value = this.calculateValue(measurement.start, measurement.end);
              measurement.relativeToReference = this.activeReferenceLine.itemId;
            }
            
            this.$emit('measurement-added', measurement); // 부모에게 이벤트 발생
            this.createBoundedSegments(measurement); // 선 측정 분할 처리
            
            // 측정값 추가를 히스토리에 저장
            this.$nextTick(() => {
              const segments = this.segmentedMeasurements.filter(s => s.itemId === measurement.itemId);
              this.addToHistory('add', measurement, segments);
            });
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
            // console.log('Defect mode - Setting selectedAreaRect');
            this.selectedAreaRect = {
              start: { ...this.areaStart },
              end: { ...this.areaEnd }
            };
            // console.log('selectedAreaRect after setting:', this.selectedAreaRect);
          } else if (this.measurementMode === 'circle') {
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
            this.$emit('measurement-added', measurement); // 부모에게 이벤트 발생
            this.segmentedMeasurements.push(measurement);
            
            // 측정값 추가를 히스토리에 저장
            this.$nextTick(() => {
              const segments = this.segmentedMeasurements.filter(s => s.itemId === measurement.itemId);
              this.addToHistory('add', measurement, segments);
            });
            
            this.nextId++;
          } else if (this.measurementMode.startsWith('area')) {
            // console.log(`[endMeasurement] 영역 측정 완료, 영역 측정 생성 시작 - 모드: ${this.measurementMode}, 기준선 있음: ${!!this.activeReferenceLine}`);
            
            // 영역 측정 생성 전 현재 측정값 개수 저장
            const beforeCount = this.measurements.length;
            
            this.createAreaMeasurements();
            
            // 영역 측정 완료 후 추가된 모든 측정값을 하나의 히스토리 그룹으로 저장
            this.$nextTick(() => {
              const addedMeasurements = this.measurements.slice(beforeCount);
              if (addedMeasurements.length > 0) {
                // 영역 측정의 경우 여러 측정값을 하나의 그룹으로 히스토리에 저장
                this.addToHistory('add-area', {
                  measurements: addedMeasurements,
                  areaStart: { ...this.areaStart },
                  areaEnd: { ...this.areaEnd },
                  mode: this.measurementMode
                });
              }
            });
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
      
      // 주변 픽셀을 포함한 밝기 계산 (3x3 영역)
      let totalBrightness = 0;
      let pixelCount = 0;
      
      for (let offsetY = -1; offsetY <= 1; offsetY++) {
        for (let offsetX = -1; offsetX <= 1; offsetX++) {
          const sampleX = imageX + offsetX;
          const sampleY = imageY + offsetY;
          
          if (sampleX >= 0 && sampleX < img.naturalWidth && 
              sampleY >= 0 && sampleY < img.naturalHeight) {
            const index = (sampleY * img.naturalWidth + sampleX) * 4;
            if (index >= 0 && index < this.imageData.data.length) {
              // 흑백 이미지의 경우 R 채널만 사용
              totalBrightness += this.imageData.data[index];
              pixelCount++;
            }
          }
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
      
      // 전체 길이에 대한 비율 반환
      return totalLength > 0 ? segmentLength / totalLength : 0;
    },
    render() {
      if (!this.ctx) {
        console.error('[render] 컨텍스트가 없음');
        return;
      }

      try {
        // console.log('[render] 이미지 상태:', {
        //   image: this.image ? '있음' : '없음',
        //   canvas: this.$refs.canvas ? '있음' : '없음',
        //   ctx: this.ctx ? '있음' : '없음',
        //   canvasWidth: this.$refs.canvas?.width,
        //   canvasHeight: this.$refs.canvas?.height
        // });

        // 캔버스 지우기
        this.ctx.clearRect(0, 0, this.$refs.canvas.width, this.$refs.canvas.height);

        // 이미지 그리기 전에 유효성 검사
        if (this.image && this.image.complete && this.image.naturalWidth > 0) {
          try {
            // 이미지 그리기 - 항상 꽉 채우면서 가운데 정렬되도록
            this.ctx.drawImage(this.image, 0, 0, this.$refs.canvas.width, this.$refs.canvas.height);
          } catch (drawError) {
            console.error('[render] 이미지 그리기 오류:', drawError);
            // console.log('[render] 오류 발생한 이미지 정보:', {
            //   src: this.image.src.substring(0, 30) + '...',
            //   complete: this.image.complete,
            //   naturalWidth: this.image.naturalWidth,
            //   naturalHeight: this.image.naturalHeight
            // });
            
            // 이미지가 로드되지 않은 경우 에러 메시지 표시
            this.ctx.fillStyle = '#f8f9fa';
            this.ctx.fillRect(0, 0, this.$refs.canvas.width, this.$refs.canvas.height);
            this.ctx.fillStyle = '#dc3545';
            this.ctx.font = '16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('이미지를 로드할 수 없습니다', this.$refs.canvas.width / 2, this.$refs.canvas.height / 2);
          }
        } else {
          // 이미지가 없거나 로드되지 않은 경우 회색 배경 표시
          this.ctx.fillStyle = '#f8f9fa';
          this.ctx.fillRect(0, 0, this.$refs.canvas.width, this.$refs.canvas.height);
          this.ctx.fillStyle = '#6c757d';
          this.ctx.font = '16px Arial';
          this.ctx.textAlign = 'center';
          this.ctx.fillText('이미지 로딩 중...', this.$refs.canvas.width / 2, this.$refs.canvas.height / 2);
        }

        // 감지된 스케일바 표시 (디버깅 용도)
        if (this.scaleBarDetected && this.scaleBarMeasurement && this.scaleMethod === 'scaleBar') {
          this.ctx.beginPath();
          this.ctx.moveTo(this.scaleBarMeasurement.start.x, this.scaleBarMeasurement.start.y);
          this.ctx.lineTo(this.scaleBarMeasurement.end.x, this.scaleBarMeasurement.end.y);
          this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
          this.ctx.lineWidth = 2;
          this.ctx.stroke();
          
          // 스케일바 텍스트 표시
          this.ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
          this.ctx.font = '12px Arial';
          this.ctx.fillText(
            `${this.scaleBarValue} ${this.scaleBarUnit}`, 
            this.scaleBarMeasurement.start.x, 
            this.scaleBarMeasurement.start.y - 5
          );
        }
        
        // 수동 스케일바 그리기 모드인 경우 안내 텍스트 표시
        if (this.isDrawingScaleBar) {
          this.ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
          this.ctx.font = '14px Arial';
          this.ctx.fillText(
            '이미지의 스케일바 위에 선을 그려주세요', 
            20, 
            30
          );
          
          // 현재 그리고 있는 스케일바 선 표시 - 더 눈에 띄게 표시
          if (this.isMeasuring && this.currentMeasurement && this.currentMeasurement.isScaleBar) {
            this.ctx.beginPath();
            this.ctx.moveTo(this.currentMeasurement.start.x, this.currentMeasurement.start.y);
            this.ctx.lineTo(this.currentMeasurement.end.x, this.currentMeasurement.end.y);
            this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.9)'; // 밝은 노란색
            this.ctx.lineWidth = 3; // 두꺼운 선
            this.ctx.setLineDash([5, 5]); // 점선
            this.ctx.stroke();
            this.ctx.setLineDash([]); // 점선 초기화
            
            // 시작점과 끝점 표시
            this.ctx.fillStyle = 'rgba(255, 255, 0, 0.9)';
            this.ctx.beginPath();
            this.ctx.arc(this.currentMeasurement.start.x, this.currentMeasurement.start.y, 5, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.beginPath();
            this.ctx.arc(this.currentMeasurement.end.x, this.currentMeasurement.end.y, 5, 0, Math.PI * 2);
            this.ctx.fill();
          }
        }

        // 디버깅 정보 콘솔에 출력
        // console.log('Render - mode:', this.measurementMode);
        // console.log('Render - referenceLines:', this.referenceLines.length);
        // console.log('Render - isMeasuring:', this.isMeasuring);
        
        // 기준선 먼저 그리기
        if (this.referenceLines.length > 0) {
          // console.log('Drawing reference lines:', this.referenceLines.length);
          
          this.referenceLines.forEach((refLine, index) => {
            // console.log(`Drawing reference line ${index}:`, 
            //   `시작(${refLine.start.x.toFixed(0)}, ${refLine.start.y.toFixed(0)})`, 
            //   `끝(${refLine.end.x.toFixed(0)}, ${refLine.end.y.toFixed(0)})`);
            
            this.ctx.beginPath();
            this.ctx.strokeStyle = refLine.color || this.referenceLineColor; // 저장된 색상 또는 기본 색상 사용
            this.ctx.lineWidth = 4;
            this.ctx.setLineDash([]);
            this.ctx.moveTo(refLine.start.x, refLine.start.y);
            this.ctx.lineTo(refLine.end.x, refLine.end.y);
            this.ctx.stroke();
            
            // 기준선 텍스트 표시 제거
          });
        }

        // 측정된 선들 그리기
        if (this.measurementMode !== 'defect') {
          // console.log(`Drawing ${this.segmentedMeasurements.length} segmented measurements`);
          // console.log(`Measurements count: ${this.measurements.length}, segmented count: ${this.segmentedMeasurements.length}`);
          
          // 먼저 중복된 측정값이 있는지 체크
          const uniqueIds = new Set();
          const duplicates = [];
          this.segmentedMeasurements.forEach((segment, index) => {
            const id = `${segment.itemId}-${segment.subItemId}`;
            if (uniqueIds.has(id)) {
              duplicates.push({ id, index });
            } else {
              uniqueIds.add(id);
            }
          });
          
          if (duplicates.length > 0) {
            console.warn(`Found ${duplicates.length} duplicate segmented measurements:`, duplicates);
          }
          
          this.segmentedMeasurements.forEach(segment => {
            // 밝기 조건에 따라 색상과 선 스타일 결정
            const shouldDisplay = this.isReversed ? segment.isBright : !segment.isBright;
            
            this.ctx.beginPath();
            if (shouldDisplay) {
              this.ctx.strokeStyle = 'blue';
              this.ctx.setLineDash([5, 5]); // 파란색은 점선
            } else {
              this.ctx.strokeStyle = 'red';
              this.ctx.setLineDash([]); // 빨간색은 실선
            }
            
            this.ctx.lineWidth = 2;
            this.ctx.moveTo(segment.start.x, segment.start.y);
            this.ctx.lineTo(segment.end.x, segment.end.y);
            this.ctx.stroke();
          });
        }

        // 현재 측정 중인 선 그리기
        if (this.isMeasuring) {
          if ((this.measurementMode === 'line' || this.measurementMode === 'reference') && this.currentMeasurement) {
            // 기준선 그리기는 일반적인 방식으로
            if (this.measurementMode === 'reference') {
              this.ctx.beginPath();
              this.ctx.strokeStyle = this.referenceLineColor; // 선택된 색상 사용
              this.ctx.lineWidth = 4;
              this.ctx.setLineDash([5, 5]); // 점선
              this.ctx.moveTo(this.currentMeasurement.start.x, this.currentMeasurement.start.y);
              this.ctx.lineTo(this.currentMeasurement.end.x, this.currentMeasurement.end.y);
              this.ctx.stroke();
            } else {
              // 일반 측정선은 항상 원래 선만 표시 (경계 감지 없이)
            this.ctx.beginPath();
            this.ctx.strokeStyle = 'blue';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]); // 점선
            this.ctx.moveTo(this.currentMeasurement.start.x, this.currentMeasurement.start.y);
            this.ctx.lineTo(this.currentMeasurement.end.x, this.currentMeasurement.end.y);
            this.ctx.stroke();
            }
          } else if (this.areaStart && this.areaEnd) {
            if (this.measurementMode === 'defect') {
              // 불량 감지 모드에서는 점선 네모 박스만 표시
              this.ctx.strokeStyle = 'blue';
              this.ctx.setLineDash([5, 5]);
              this.ctx.lineWidth = 2;
              this.ctx.strokeRect(
                Math.min(this.areaStart.x, this.areaEnd.x),
                Math.min(this.areaStart.y, this.areaEnd.y),
                Math.abs(this.areaEnd.x - this.areaStart.x),
                Math.abs(this.areaEnd.y - this.areaStart.y)
              );
            } else {
              // 영역 측정 그리기
              const startX = Math.min(this.areaStart.x, this.areaEnd.x);
              const endX = Math.max(this.areaStart.x, this.areaEnd.x);
              const startY = Math.min(this.areaStart.y, this.areaEnd.y);
              const endY = Math.max(this.areaStart.y, this.areaEnd.y);
              
              // 기준선 기반 영역 측정인 경우 기준선 방향에 맞춰 영역 표시
              if (this.activeReferenceLine && this.measurementMode.startsWith('area')) {
                // 회전 없이 직사각형 그리기
                this.ctx.beginPath();
              this.ctx.strokeStyle = 'blue';
              this.ctx.setLineDash([5, 5]); // 점선
              this.ctx.lineWidth = 2;
                
                // 직사각형 그리기
              this.ctx.strokeRect(
                Math.min(this.areaStart.x, this.areaEnd.x),
                Math.min(this.areaStart.y, this.areaEnd.y),
                Math.abs(this.areaEnd.x - this.areaStart.x),
                Math.abs(this.areaEnd.y - this.areaStart.y)
              );

              // 예상되는 측정선 그리기
                this.ctx.beginPath();
                this.ctx.strokeStyle = 'blue';
                this.ctx.setLineDash([5, 5]); // 점선
                
                const startX = Math.min(this.areaStart.x, this.areaEnd.x);
                const endX = Math.max(this.areaStart.x, this.areaEnd.x);
                const startY = Math.min(this.areaStart.y, this.areaEnd.y);
                const endY = Math.max(this.areaStart.y, this.areaEnd.y);
                
                if (this.measurementMode === 'area-vertical') {
                  // 수직 방향 라인 그리기
                const width = endX - startX;
                const spacing = width / (this.lineCount - 1);

                for (let i = 0; i < this.lineCount; i++) {
                  const x = startX + (spacing * i);
                  this.ctx.moveTo(x, startY);
                  this.ctx.lineTo(x, endY);
                }
              } else if (this.measurementMode === 'area-horizontal') {
                  // 수평 방향 라인 그리기
                const height = endY - startY;
                const spacing = height / (this.lineCount - 1);
                  
                  for (let i = 0; i < this.lineCount; i++) {
                    const y = startY + (spacing * i);
                    this.ctx.moveTo(startX, y);
                    this.ctx.lineTo(endX, y);
                  }
                }
                
                this.ctx.stroke();
              } else {
                // 기준선 없는 일반 영역 측정
                this.ctx.strokeStyle = 'blue';
                this.ctx.setLineDash([5, 5]); // 점선
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(
                  startX, startY, endX - startX, endY - startY
                );

                this.ctx.beginPath();
                this.ctx.strokeStyle = 'blue';
                this.ctx.setLineDash([5, 5]); // 점선
                
                if (this.measurementMode === 'area-vertical') {
                  const width = endX - startX;
                  const spacing = width / (this.lineCount - 1);
                  
                  for (let i = 0; i < this.lineCount; i++) {
                    const x = startX + (spacing * i);
                    
                    // 드래그 중에는 전체 선 표시 (경계 감지 없이)
                    this.ctx.moveTo(x, startY);
                    this.ctx.lineTo(x, endY);
                  }
                } else if (this.measurementMode === 'area-horizontal') {
                  const height = endY - startY;
                  const spacing = height / (this.lineCount - 1);

                for (let i = 0; i < this.lineCount; i++) {
                  const y = startY + (spacing * i);
                    
                    // 드래그 중에는 전체 선 표시 (경계 감지 없이)
                  this.ctx.moveTo(startX, y);
                  this.ctx.lineTo(endX, y);
                }
                }
                
                this.ctx.stroke();
              }
            }
          }
        }

        // 선택된 영역 그리기 (불량 감지 모드에서만)
        if (this.measurementMode === 'defect' && this.selectedAreaRect) {
          // console.log('Drawing selected area rect:', this.selectedAreaRect);
          this.ctx.beginPath();
          this.ctx.strokeStyle = 'red';
          this.ctx.setLineDash([]); // 실선
          this.ctx.lineWidth = 2;
          this.ctx.strokeRect(
            Math.min(this.selectedAreaRect.start.x, this.selectedAreaRect.end.x),
            Math.min(this.selectedAreaRect.start.y, this.selectedAreaRect.end.y),
            Math.abs(this.selectedAreaRect.end.x - this.selectedAreaRect.start.x),
            Math.abs(this.selectedAreaRect.end.y - this.selectedAreaRect.start.y)
          );
        }

        // 삭제 모드에서 삭제 경로 그리기
        if (this.isDeleteMode && this.deleteStart && this.deleteEnd) {
          this.ctx.beginPath();
          this.ctx.strokeStyle = 'white';
          this.ctx.setLineDash([5, 5]); // 흰색 점선
          this.ctx.lineWidth = 2;
          this.ctx.moveTo(this.deleteStart.x, this.deleteStart.y);
          this.ctx.lineTo(this.deleteEnd.x, this.deleteEnd.y);
          this.ctx.stroke();
        }
      } catch (error) {
        console.error('[render] 렌더링 중 오류:', error);
      }
    },
    setMode(mode) {
      if (mode === 'defect') {
        if (this.measurements.length > 0) {
          if (!confirm('불량 감지 모드로 전환하면 기존 측정값이 초기화됩니다. 계속하시겠습니까?')) {
            return;
          }
          // 모든 측정값 초기화
          // this.measurements = []; // prop이므로 직접 수정 불가
          this.segmentedMeasurements = [];
          this.selectedMeasurement = null;
          this.selectedRows = [];
          this.selectedSegment = null;
          this.nextId = 1;
          this.referenceId = 1;
          this.brightSubIdCounter = 1;
        }
      }
      
      // console.log('모드 변경:', mode);
      this.debugInfo.lastAction = `모드 변경: ${mode}`;
      this.measurementMode = mode;
      
      // 측정 모드 설정 시 삭제 모드 강제 비활성화
      if (this.isDeleteMode) {
        this.isDeleteMode = false;
      }
      
      // 수동 스케일바 그리기 모드 비활성화 
      // (다른 측정 모드가 활성화되면 스케일바 그리기 모드는 비활성화)
      if (this.isDrawingScaleBar) {
        this.isDrawingScaleBar = false;
      }
      
      this.selectedMeasurement = null;
      this.areaStart = null;
      this.areaEnd = null;
      this.selectedArea = null;
      this.render();
    },
    toggleReferenceMode() {
      this.isSettingReference = !this.isSettingReference;
    },
    closePopup() {
      // console.log('[closePopup] MSA6 이미지 팝업 닫기');
        
      // 팝업 닫기 전에 현재 스케일바 설정 저장
      this.saveScaleBarSettings();
        
      // 알림 정리
      if (this.notification.timeout) {
        clearTimeout(this.notification.timeout);
        this.notification.show = false;
      }
        
      // 팝업 표시 상태 설정
      this.isVisible = false;
      this.$emit('update:showPopup', false);
        
      // 팝업이 닫힐 때 이벤트 발생
      this.$emit('close');
    },
    
    async handleSave() {
      try {
        // 저장 처리 중인지 확인
        if (this.isSaving) {
          // console.log('[handleSave] 이미 저장 중입니다.');
          return;
        }
        
        // 저장 처리 중 상태로 설정
        this.isSaving = true;
        // console.log('[handleSave] 저장 시작');
        
        // 저장할 데이터가 있는지 확인
        if (!this.measurements || this.measurements.length === 0) {
          // console.log('[handleSave] 저장할 측정값이 없습니다.');
          this.showNotification('저장할 측정값이 없습니다.', 'warning');
          this.isSaving = false;
          return;
        }
        
        // 저장 처리
        const result = await this.openTableNameSelector();
        
        // 저장 결과 처리
        if (result && result.success) {
          // console.log('[handleSave] 저장 성공:', result);
          // 팝업 닫기
          this.closePopup();
        } else if (result && !result.success) {
          // console.log('[handleSave] 저장 실패:', result.error || '알 수 없는 오류');
        } else {
          // console.log('[handleSave] 저장 취소됨');
        }
      } catch (error) {
        // console.log('[handleSave] 저장 중 오류:', error.message);
        this.showNotification(`저장 중 오류가 발생했습니다: ${error.message}`, 'error');
      } finally {
        // 저장 처리 완료 상태로 설정
        this.isSaving = false;
      }
    },
    
    async openTableNameSelector() {
      return new Promise((resolve) => {
        // console.log('[openTableNameSelector] 테이블 선택기 열기');
        
        // 테이블 선택기 컴포넌트 표시
        this.$refs.tableNameSelector.open({
          onSelect: async (selectedTable) => {
            if (!selectedTable) {
              // console.log('[openTableNameSelector] 선택된 테이블 없음, 취소됨');
              resolve(null);
              return;
            }
            
            // console.log('[openTableNameSelector] 테이블 선택됨:', selectedTable);
            
            try {
              // 저장 처리
              const result = await this.blobToBase64SaveWithTableName(selectedTable);
              // console.log('[openTableNameSelector] 저장 결과:', result);
              resolve(result);
            } catch (error) {
              // console.log('[openTableNameSelector] 저장 처리 중 오류:', error.message);
              this.showNotification(`저장 중 오류가 발생했습니다: ${error.message}`, 'error');
              resolve({ success: false, error: error.message });
            }
          },
          onCancel: () => {
            // console.log('[openTableNameSelector] 사용자가 취소함');
            resolve(null);
          }
        });
      });
    },
    applySelectedIds() {
      if (this.selectedRows.length === 0 || (!this.newItemId && !this.newSubId)) return;
      
      this.selectedRows.forEach((segment, index) => {
        // Item ID가 입력된 경우만 Item ID 변경
        if (this.newItemId) {
          segment.itemId = this.newItemId;
        }
        
        // Sub ID가 입력된 경우만 Sub ID 변경
        if (this.newSubId) {
          // subId에 숫자만 추출하여 증가
          const baseSubId = this.newSubId.replace(/\d+$/, '');
          const startNum = parseInt(this.newSubId.match(/\d+$/)?.[0] || '1');
          segment.subItemId = `${baseSubId}${startNum + index}`;
        }
      });
      
      // 상태 저장 및 로그 기록
      // console.log(`[applySelectedIds] ID 적용 완료 - Item ID: ${this.newItemId || '변경 없음'}, Sub ID: ${this.newSubId || '변경 없음'}`);
      
      this.render();
    },
    editSegment(segment) {
      // 세그먼트 편집 로직 구현
      // console.log('Editing segment:', segment);
    },
    deleteSegment(segment) {
      const index = this.segmentedMeasurements.indexOf(segment);
      if (index > -1) {
        // 관련된 모든 세그먼트와 측정값 삭제
        const itemId = segment.itemId;
        
        // 삭제 전에 히스토리에 저장
        const relatedSegments = this.segmentedMeasurements.filter(s => s.itemId === itemId);
        const measurement = this.measurements.find(m => m.itemId === itemId);
        if (measurement) {
          this.addToHistory('delete', measurement, relatedSegments);
        }
        
        this.segmentedMeasurements = this.segmentedMeasurements.filter(s => s.itemId !== itemId);
        this.measurements = this.measurements.filter(m => m.itemId !== itemId);
        
        this.render();
      }
    },
    toggleReverse() {
      this.isReversed = !this.isReversed;
      this.render(); // 시각적 표시만 업데이트
    },
    handleRowMouseDown(segment, index) {
      this.selectionStart = index;
      this.selectedRows = [segment];
      this.selectedSegment = segment;
    },
    handleRowMouseEnter(segment, index) {
      if (this.selectionStart !== null) {
        const start = Math.min(this.selectionStart, index);
        const end = Math.max(this.selectionStart, index);
        this.selectedRows = this.filteredMeasurements.slice(start, end + 1);
      }
    },
    handleRowMouseUp() {
      this.selectionStart = null;
    },
    handleKeyDown(e) {
      // 단축키 처리
      if (e.key === 'h' || e.key === 'H') {
        this.showShortcutHelp = true;
      } else if (e.key === 'f' || e.key === 'F') {
        this.isFKeyPressed = true;
      } else if (e.key === 'd' || e.key === 'D') {
        if (!e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          this.toggleDeleteMode();
        }
      } else if (e.key === 'c' || e.key === 'C') {
        // 기준선 그리기 모드로 전환
        this.setMode('reference');
      } else if (e.key === 'a' || e.key === 'A') {
        // 영역 측정 모드 전환
        if (this.measurementMode === 'area-vertical') {
          this.setMode('area-horizontal');
        } else {
          this.setMode('area-vertical');
        }
      } else if (e.key === 's' || e.key === 'S') {
        // 단일 선 측정 모드로 전환
        this.setMode('line');
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.undoLastMeasurement();
      } else if (e.key === 'y' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.redoLastMeasurement();
      }
    },
    handleKeyUp(e) {
      // 키업 이벤트 처리
      if (e.key === 'h' || e.key === 'H') {
        this.showShortcutHelp = false;
      } else if (e.key === 'f' || e.key === 'F') {
        this.isFKeyPressed = false;
      }
    },
    undoLastMeasurement() {
      if (this.undoHistory.length > 0) {
        const lastState = this.undoHistory.pop();
        if (lastState.action === 'add') {
          // 측정값 추가 작업 실행 취소
          const index = this.measurements.findIndex(m => m.itemId === lastState.measurement.itemId);
          if (index !== -1) {
            this.measurements.splice(index, 1);
          }
          this.segmentedMeasurements = this.segmentedMeasurements.filter(s => s.itemId !== lastState.measurement.itemId);
        } else if (lastState.action === 'add-area') {
          // 영역 측정 추가 작업 실행 취소
          lastState.measurement.measurements.forEach(measurement => {
            const index = this.measurements.findIndex(m => m.itemId === measurement.itemId);
            if (index !== -1) {
              this.measurements.splice(index, 1);
            }
            this.segmentedMeasurements = this.segmentedMeasurements.filter(s => s.itemId !== measurement.itemId);
          });
        } else if (lastState.action === 'delete') {
          // 측정값 삭제 작업 실행 취소
          this.measurements.push(lastState.measurement);
          this.segmentedMeasurements.push(...lastState.segments);
        } else if (lastState.action === 'delete-defect') {
          // 불량 측정 삭제 작업 실행 취소
          this.defectMeasurements.push(lastState.measurement);
        }
        this.redoHistory.push(lastState);
        this.render();
      }
    },
    redoLastMeasurement() {
      if (this.redoHistory.length > 0) {
        const lastState = this.redoHistory.pop();
        if (lastState.action === 'add') {
          // 측정값 추가 작업 복구
          this.measurements.push(lastState.measurement);
          this.segmentedMeasurements.push(...lastState.segments);
        } else if (lastState.action === 'add-area') {
          // 영역 측정 추가 작업 복구
          lastState.measurement.measurements.forEach(measurement => {
            this.measurements.push(measurement);
            const segments = this.segmentedMeasurements.filter(s => s.itemId === measurement.itemId);
            this.segmentedMeasurements.push(...segments);
          });
        } else if (lastState.action === 'delete') {
          // 측정값 삭제 작업 복구
          const index = this.measurements.findIndex(m => m.itemId === lastState.measurement.itemId);
          if (index !== -1) {
            this.measurements.splice(index, 1);
          }
          this.segmentedMeasurements = this.segmentedMeasurements.filter(s => s.itemId !== lastState.measurement.itemId);
        } else if (lastState.action === 'delete-defect') {
          // 불량 측정 삭제 작업 복구
          const index = this.defectMeasurements.findIndex(m => m.itemId === lastState.measurement.itemId);
          if (index !== -1) {
            this.defectMeasurements.splice(index, 1);
          }
        }
        this.undoHistory.push(lastState);
        this.render();
      }
    },
    // 히스토리에 액션 추가하는 통합 메서드
    addToHistory(action, measurement, segments = []) {
      // 측정값 추가 시 관련 세그먼트 찾기
      if (action === 'add' && segments.length === 0) {
        segments = this.segmentedMeasurements.filter(s => s.itemId === measurement.itemId);
      }
      
      this.undoHistory.push({
        action: action,
        measurement: measurement,
        segments: [...segments]
      });
      
      // redo 히스토리 초기화 (새로운 액션 후)
      this.redoHistory = [];
      
      const logId = action === 'add-area' ? `${measurement.measurements.length}개 영역 측정` : measurement.itemId;
      // console.log(`[addToHistory] ${action} 액션이 히스토리에 저장됨:`, logId);
    },
    updateAllMeasurements() {
      // 모든 측정값에 배율 적용
      this.measurements.forEach(measurement => {
        if (measurement.radius !== undefined) {
          measurement.value = measurement.radius * 2 * this.magnification;
        } else {
          measurement.value = this.calculateValue(measurement.start, measurement.end);
        }
      });

      this.segmentedMeasurements.forEach(segment => {
        segment.value = this.calculateValue(segment.start, segment.end);
      });
    },
    
    // 두 선의 교차 여부 확인
    isLineIntersecting(line1, line2) {
      // 첫 번째 선
      const x1 = line1.start.x;
      const y1 = line1.start.y;
      const x2 = line1.end.x;
      const y2 = line1.end.y;
      
      // 두 번째 선
      const x3 = line2.start.x;
      const y3 = line2.start.y;
      const x4 = line2.end.x;
      const y4 = line2.end.y;
      
      // 선분 교차점 계산
      const det = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
      
      // 평행한 경우
      if (det === 0) {
        return false;
      }
      
      const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / det;
      const u = -((x1 - x2) * (y3 - y1) - (y1 - y2) * (x3 - x1)) / det;
      
      // 선분 내에 교차점이 있는 경우
      return (t >= 0 && t <= 1 && u >= 0 && u <= 1);
    },
    
    // 드래그 선과 교차하는 모든 측정선 찾기
    findIntersectingLines(dragLine) {
      const intersectingLines = [];
      
      // 모든 segmentedMeasurements에 대해 교차 검사
      for (const segment of this.segmentedMeasurements) {
        if (this.isLineIntersecting(dragLine, segment)) {
          intersectingLines.push(segment);
        }
      }
      
      return intersectingLines;
    },
    
    decreaseLineCount() {
      if (this.lineCount > 2) {
        this.lineCount--;
      }
    },
    increaseLineCount() {
      if (this.lineCount < 20) {
        this.lineCount++;
      }
    },
    toggleAreaSelectionMode() {
      this.isAreaSelectionMode = !this.isAreaSelectionMode;
      if (this.isAreaSelectionMode) {
        this.selectedAreaRect = null;
        this.areaSelectionStart = null;
        this.areaSelectionEnd = null;
      }
      this.render();
    },
    handleDefectMouseDown(defect, index) {
      this.selectionStart = index;
      this.selectedDefects = [defect];
    },
    handleDefectMouseEnter(defect, index) {
      if (this.selectionStart !== null) {
        const start = Math.min(this.selectionStart, index);
        const end = Math.max(this.selectionStart, index);
        this.selectedDefects = this.defectMeasurements.slice(start, end + 1);
      }
    },
    handleDefectMouseUp() {
      this.selectionStart = null;
    },
    deleteDefect(defect) {
      const index = this.defectMeasurements.indexOf(defect);
      if (index > -1) {
        this.addToHistory('delete-defect', defect);
        this.defectMeasurements.splice(index, 1);
        this.render();
      }
    },
    toggleImageSelection(image, selected) {
      // 이미지 선택 토글
      this.selectedImages[image.id] = selected;
    },
    saveMeasurementsToLCNC() {
      if (this.isSaving || (this.measurementMode === 'defect' ? this.defectMeasurements.length === 0 : this.segmentedMeasurements.length === 0)) return;
      
      this.isSaving = true;
      
      console.log('[saveMeasurementsToLCNC] 측정 결과 저장 시작...');
      console.log('[saveMeasurementsToLCNC] measurements (prop):', this.measurements.length, '개');
      console.log('[saveMeasurementsToLCNC] segmentedMeasurements:', this.segmentedMeasurements.length, '개');
      console.log('[saveMeasurementsToLCNC] measurements 샘플:', this.measurements.slice(0, 3));
      console.log('[saveMeasurementsToLCNC] segmentedMeasurements 샘플:', this.segmentedMeasurements.slice(0, 3));
      
      // 로그 저장 - 측정 결과 저장
      LogService.logAction('save_measurements', {
        mode: this.measurementMode,
        count: this.measurementMode === 'defect' 
          ? this.defectMeasurements.length 
          : this.segmentedMeasurements.length
      })
      
      // 세션 ID 가져오기 (localStorage에서)
      const sessionId = localStorage.getItem('current_workflow_session_id');
      
      if (!sessionId) {
        alert('워크플로우 세션을 찾을 수 없습니다. 먼저 워크플로우를 실행해 주세요.');
        this.isSaving = false;
        return;
      }
      
      // 측정 데이터 준비 - segmentedMeasurements 사용
      const measurementData = {
        session_id: sessionId,
        measurements: this.measurementMode === 'defect' ? this.defectMeasurements : this.segmentedMeasurements,
        measurement_mode: this.measurementMode,
        measurement_config: {
          magnification: this.magnification,
          lineCount: this.lineCount,
          brightnessThreshold: this.brightnessThreshold,
          isReversed: this.isReversed
        },
        timestamp: new Date().toISOString(),
        // 명시적으로 테이블 지정
        target_table: this.measurementMode === 'defect' ? 'msa6_result_defect' : 'msa6_result_cd'
      };
      
      console.log(`[saveMeasurementsToLCNC] 저장 요청 데이터:`, {
        테이블: measurementData.target_table,
        세션ID: sessionId,
        측정모드: this.measurementMode,
        데이터개수: measurementData.measurements.length,
        실제데이터샘플: measurementData.measurements.slice(0, 3)
      });
      
      // API 호출 - LCNC 스키마에 데이터 저장
      fetch('http://localhost:8000/api/msa6/save-measurement-lcnc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(measurementData)
      })
      .then(response => {
        console.log(`[saveMeasurementsToLCNC] 서버 응답 상태: ${response.status}`);
        return response.json();
      })
      .then(result => {
        console.log(`[saveMeasurementsToLCNC] 서버 응답 데이터:`, result);
        if (result.status === 'success') {
          alert('측정 결과가 성공적으로 저장되었습니다.');
          console.log(`[saveMeasurementsToLCNC] 성공: ${result.message}`);
          console.log(`[saveMeasurementsToLCNC] 저장된 데이터: ${JSON.stringify(result.data || {})}`);
        } else {
          alert(`저장 실패: ${result.message || '알 수 없는 오류'}`);
          console.error(`[saveMeasurementsToLCNC] 실패: ${result.message}`, result.error);
        }
      })
      .catch(error => {
        console.error('[saveMeasurementsToLCNC] 측정 데이터 저장 중 오류:', error);
        alert(`저장 오류: ${error.message || '알 수 없는 오류'}`);
      })
      .finally(() => {
        this.isSaving = false;
        console.log('[saveMeasurementsToLCNC] 저장 작업 완료');
      });
    },
    calculateAngle(start, end) {
      // 각도 계산 (라디안)
      return Math.atan2(end.y - start.y, end.x - start.x);
    },
    
    getPerpendicularVector(vector) {
      // 주어진 벡터에 수직인 벡터 계산
      return {
        x: -vector.y,
        y: vector.x
      };
    },
    
    getNormalizedVector(vector) {
      // 벡터 정규화
      const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
      if (length === 0) return { x: 0, y: 0 };
      return {
        x: vector.x / length,
        y: vector.y / length
      };
    },
    
    applyReferenceToMeasurement(measurement) {
      // 기준선이 없으면 아무 것도 하지 않음
      if (!this.activeReferenceLine) return measurement;
      
      // console.log(`[applyReferenceToMeasurement] 기준선 적용 - 모드: ${this.measurementMode}, 측정값 ID: ${measurement.itemId}`);
      
      // 기준선에 상대적인 측정값 설정
      measurement.relativeToReference = this.activeReferenceLine.itemId;
      
      // 가로/세로 방향 설정 유지
      if (this.measurementMode === 'area-horizontal') {
        measurement.isHorizontal = true;
        // console.log(`[applyReferenceToMeasurement] 수평 방향 표시 추가`);
      }
      
      return measurement;
    },
    
    calculateAngleDifference(angle1, angle2) {
      // 두 각도 사이의 차이 계산 (도)
      let angleDiff = ((angle2 - angle1) * 180 / Math.PI) % 360;
      if (angleDiff < 0) angleDiff += 360;
      if (angleDiff > 180) angleDiff = 360 - angleDiff;
      return parseFloat(angleDiff.toFixed(2));
    },
    // 측정선을 객체 경계에 맞게 조정하는 함수 - 기준선 기반 자르기 기능 제거
    trimMeasurementToObjectBoundaries(measurement) {
      // console.log(`[trimMeasurementToObjectBoundaries] 호출 - 방향: ${measurement.isHorizontal ? '수평' : '수직'}, 기준선 관련: ${!!measurement.relativeToReference}`);
      
      const result = {
        ...measurement,
        start: { ...measurement.start },
        end: { ...measurement.end }
      };
      
      // 기준선 기반 자르기 로직 제거 - 원본 측정값 그대로 반환
      // if (this.activeReferenceLine) {
      //   // 기준선을 직선으로 가정하고 교차점 계산
      //   const refLine = this.activeReferenceLine;
      //   
      //   // 선분 교차점 계산
      //   const det = (measurement.end.x - measurement.start.x) * (refLine.end.y - refLine.start.y) - 
      //               (measurement.end.y - measurement.start.y) * (refLine.end.x - refLine.start.x);
      //   
      //   if (det !== 0) {  // 평행하지 않은 경우만
      //     const t = ((refLine.start.x - measurement.start.x) * (refLine.end.y - refLine.start.y) - 
      //               (refLine.start.y - measurement.start.y) * (refLine.end.x - refLine.start.x)) / det;
      //     
      //     const u = -((measurement.start.x - measurement.end.x) * (measurement.start.y - refLine.start.y) - 
      //               (measurement.start.y - measurement.end.y) * (measurement.start.x - refLine.start.x)) / det;
      //     
      //     if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      //       // 교차점 좌표
      //       const intersectionPoint = {
      //         x: measurement.start.x + t * (measurement.end.x - measurement.start.x),
      //         y: measurement.start.y + t * (measurement.end.y - measurement.start.y)
      //       };
      //       
      //       // console.log(`[trimMeasurementToObjectBoundaries] 기준선 교차점 발견: (${intersectionPoint.x.toFixed(0)}, ${intersectionPoint.y.toFixed(0)})`);
      //       
      //       // 시작점과 끝점 중 교차점에 더 가까운 쪽을 교차점으로 설정
      //       const distToStart = Math.hypot(
      //         intersectionPoint.x - measurement.start.x,
      //         intersectionPoint.y - measurement.start.y
      //       );
      //       const distToEnd = Math.hypot(
      //         intersectionPoint.x - measurement.end.x,
      //         intersectionPoint.y - measurement.end.y
      //       );
      //       
      //       if (distToStart < distToEnd) {
      //         // 교차점이 시작점에 더 가까우면
      //         result.start = intersectionPoint;
      //       } else {
      //         // 교차점이 끝점에 더 가까우면
      //         result.end = intersectionPoint;
      //       }
      //       
      //       
      //       // console.log('[trimMeasurementToObjectBoundaries] 기준선 기준 측정선 조정:', 
      //         // `Start: (${result.start.x.toFixed(0)}, ${result.start.y.toFixed(0)})`, 
      //         // `End: (${result.end.x.toFixed(0)}, ${result.end.y.toFixed(0)})`);
      //     }
      //   }
      // }
      
      // 수평/수직 방향 속성 유지
      if (measurement.isHorizontal) {
        result.isHorizontal = true;
      }
      
      return result;
    },
    resetMeasurements() {
      if (confirm('모든 측정 결과를 초기화하시겠습니까?')) {
        // 모든 측정값 초기화
        // this.measurements = []; // prop이므로 직접 수정 불가
        this.segmentedMeasurements = [];
        this.defectMeasurements = [];
        this.selectedRows = [];
        this.selectedDefects = [];
        this.nextId = 1;
        this.brightSubIdCounter = 1;
        this.darkSubIdCounter = 1;
        
        // 기준선도 초기화
        this.referenceLines = [];
        this.activeReferenceLine = null;
        
        // 선택된 영역 초기화
        this.selectedArea = null;
        this.selectedAreaRect = null;
        
        // console.log('모든 측정 결과가 초기화되었습니다.');
        this.render();
        
        // 로그 저장 - 측정 결과 초기화
        LogService.logAction('reset_measurements', {
          mode: this.measurementMode
        });
      }
    },
    selectReferenceColor(color) {
      this.referenceLineColor = color;
      this.showReferenceColorPicker = false;
      this.render(); // 색상 변경 후 캔버스 다시 그리기
    },
    /**
     * 테이블 이름 선택 팝업 표시
     */
    showTableSelector() {
      this.showTableSelectorPopup = true;
      
      // 로그 저장 - 테이블 선택 팝업 열기
      LogService.logAction('open_table_selector', {
        measurementCount: this.measurements.length
      });
    },
    
    /**
     * 선택한 테이블 이름으로 측정 결과 저장
     */
    async saveWithTableName(selectedTable) {
      try {
        console.log('🔥🔥🔥 msa6_image_popup1.vue saveWithTableName 함수 호출됨! 🔥🔥🔥');
        console.log('전달받은 selectedTable:', selectedTable);
        
        // 테이블 정보 확인
        if (!selectedTable || typeof selectedTable !== 'object') {
          console.log('[saveWithTableName] 테이블 정보가 유효하지 않습니다:', selectedTable);
          this.showNotification('유효하지 않은 테이블 정보입니다.', 'error');
          return { success: false, error: '유효하지 않은 테이블 정보입니다.' };
        }
        
        // 필수 필드 확인
        if (!selectedTable.table_name || !selectedTable.lot_wafer) {
          console.log('[saveWithTableName] 테이블 정보에 필수 필드가 없습니다:', selectedTable);
          this.showNotification('테이블 이름과 Lot/Wafer 정보가 필요합니다.', 'error');
          return { success: false, error: '테이블 이름과 Lot/Wafer 정보가 필요합니다.' };
        }
        
        this.isSaving = true;
        console.log('테이블명으로 저장 시작:', selectedTable.table_name);

        // 현재 상태 저장
        const currentIsShowingInputImage = this.isShowingInputImage;
        
        let beforeImageBase64 = '';
        let afterImageBase64 = '';
        
        console.log('측정선이 포함된 이미지 생성 시작');
        
        try {
          // Before 이미지 (원본 이미지 + 측정선)
          if (this.internalInputImageUrl) {
            console.log('Before 이미지 생성 중 (원본 이미지 + 측정선)...');
            
            // Before 모드로 전환 (입력 이미지 표시)
            this.isShowingInputImage = true;
            
            // 캔버스 렌더링 강제 실행
            await this.$nextTick();
            this.render();
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // 캔버스에서 측정선이 포함된 이미지 캡처
            if (this.$refs.canvas) {
              beforeImageBase64 = await new Promise((resolve, reject) => {
                this.$refs.canvas.toBlob((blob) => {
                  if (blob) {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                  } else {
                    reject(new Error('Before 이미지 캡처 실패'));
                  }
                }, 'image/png');
              });
              console.log('Before 이미지 Base64 생성 완료 (원본 + 측정선)');
            }
          }
          
          // After 이미지 (처리 후 이미지 + 측정선)
          if (this.outputImageUrl) {
            console.log('After 이미지 생성 중 (처리 후 이미지 + 측정선)...');
            
            // After 모드로 전환 (출력 이미지 표시)
            this.isShowingInputImage = false;
            
            // 캔버스 렌더링 강제 실행
            await this.$nextTick();
            this.render();
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // 캔버스에서 측정선이 포함된 이미지 캡처
            if (this.$refs.canvas) {
              afterImageBase64 = await new Promise((resolve, reject) => {
                this.$refs.canvas.toBlob((blob) => {
                  if (blob) {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                  } else {
                    reject(new Error('After 이미지 캡처 실패'));
                  }
                }, 'image/png');
              });
              console.log('After 이미지 Base64 생성 완료 (처리 후 + 측정선)');
            }
          }
          
          // 원래 상태 복원
          this.isShowingInputImage = currentIsShowingInputImage;
          await this.$nextTick();
          this.render();
          
        } catch (imageError) {
          console.error('이미지 생성 중 오류:', imageError);
          // 원래 상태 복원
          this.isShowingInputImage = currentIsShowingInputImage;
          await this.$nextTick();
          this.render();
          throw imageError;
        }

        // 2. 8000포트 API로 이미지 저장
        console.log('8000포트 API로 이미지 저장 시작');
        const imageResponse = await fetch('http://localhost:8000/api/external_storage/save-images', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          mode: 'cors',
          credentials: 'include',
          body: JSON.stringify({
            title: selectedTable.table_name,
            description: `MSA6 측정 결과 - ${selectedTable.table_name}`,
            before_image: beforeImageBase64,
            after_image: afterImageBase64,
            table_name: selectedTable.table_name,
            lot_wafer: selectedTable.lot_wafer,
            is_result: true, // MSA6는 results_images에 저장
            tags: ['msa6', '측정', '결과']
          })
        });

        if (!imageResponse.ok) {
          const errorText = await imageResponse.text();
          console.error('이미지 저장 API 오류:', errorText);
          throw new Error(`이미지 저장 실패: ${imageResponse.status}`);
        }

        const imageResult = await imageResponse.json();
        console.log('이미지 저장 성공:', imageResult);

        // 3. 측정 데이터 저장 (기존 로직 유지)
        // 사용자 정보 추출
        let userName = '측정사용자';
        try {
          const userKeys = ['userName', 'user_name', 'username', 'user', 'loginId', 'login_id', 'id', 'email'];
          
          for(const key of userKeys) {
            const value = localStorage.getItem(key);
            if(value && value !== 'undefined' && value !== 'null') {
              try {
                const parsed = JSON.parse(value);
                if(typeof parsed === 'object' && parsed !== null) {
                  const nameFields = ['name', 'userName', 'username', 'loginId', 'id', 'email'];
                  for(const field of nameFields) {
                    if(parsed[field]) {
                      userName = parsed[field];
                      break;
                    }
                  }
                } else if(typeof parsed === 'string') {
                  userName = parsed;
                }
                break;
              } catch(e) {
                if(typeof value === 'string') {
                  userName = value;
                  break;
                }
              }
            }
          }
          
          // 이메일에서 사용자 이름만 추출
          if(userName && typeof userName === 'string' && userName.includes('@')) {
            userName = userName.split('@')[0];
          }
        } catch (userError) {
          console.warn('사용자 정보 추출 중 오류:', userError);
        }

        const measurementData = {
          table_name: selectedTable.table_name,
          username: userName,
          lot_wafer: selectedTable.lot_wafer,
          measurements: this.filteredMeasurements.map(m => ({
            itemId: m.itemId,
            subItemId: m.subItemId,
            value: m.value
          })),
          before_image_data: beforeImageBase64,
          after_image_data: afterImageBase64
        };

        console.log('🔥🔥🔥 저장할 데이터 확인 🔥🔥🔥');
        console.log('this.measurements 개수:', this.measurements.length);
        console.log('this.segmentedMeasurements 개수:', this.segmentedMeasurements.length);
        console.log('this.filteredMeasurements 개수:', this.filteredMeasurements.length);
        console.log('현재 모드 (isReversed):', this.isReversed ? '어두운 영역' : '밝은 영역');
        console.log('실제 저장되는 measurements:', measurementData.measurements);
        console.log('측정 데이터 저장 요청:', {
          ...measurementData,
          before_image_data: beforeImageBase64 ? '있음' : '없음',
          after_image_data: afterImageBase64 ? '있음' : '없음'
        });

        const response = await fetch('http://localhost:8000/api/msa6/save-with-table-name', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(measurementData)
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('측정 데이터 저장 오류:', errorText);
          throw new Error(`측정 데이터 저장 실패: ${response.status}`);
        }

        const result = await response.json();
        console.log('측정 데이터 저장 성공:', result);

        this.showNotification(`테이블명 "${selectedTable.table_name}"으로 저장되었습니다.`, 'success');
        
        // 성공 결과 반환
        return { success: true, ...result };

      } catch (error) {
        console.error('저장 중 오류 발생:', error);
        this.showNotification(`저장 중 오류가 발생했습니다: ${error.message}`, 'error');
        return { success: false, error: error.message };
      } finally {
        this.isSaving = false;
      }
    },
    
    /**
     * 알림 메시지 표시
     */
    showNotification(message, type = 'info') {
      // console.log(`[알림] ${type.toUpperCase()}: ${message}`);
      
      // 기존 타임아웃 정리
      if (this.notification.timeout) {
        clearTimeout(this.notification.timeout);
      }
      
      // 알림 설정
      this.notification = {
        show: true,
        type: type, // 'info', 'success', 'warning', 'error' 중 하나
        message: message,
        timeout: setTimeout(() => {
          this.notification.show = false;
        }, 5000) // 5초 후 자동 닫기
      };
      
      // 알림 이벤트 발생
      this.$emit('notification', {
        type: type,
        message: message
      });
      
      // DOM에 직접 스타일 적용
      this.$nextTick(() => {
        const notificationEl = document.querySelector('.notification');
        if (notificationEl) {
          // Remove all possible notification type classes first
          notificationEl.classList.remove('success', 'error', 'warning', 'info');
          // Add the correct class
          notificationEl.classList.add(type);
          
          // Set styles directly
          if (type === 'success') {
            notificationEl.style.backgroundColor = 'rgb(76, 175, 80)';
            notificationEl.style.borderLeft = '5px solid #2e7d32';
          } else if (type === 'error') {
            notificationEl.style.backgroundColor = 'rgb(244, 67, 54)';
            notificationEl.style.borderLeft = '5px solid #c62828';
          } else if (type === 'warning') {
            notificationEl.style.backgroundColor = 'rgb(255, 152, 0)';
            notificationEl.style.borderLeft = '5px solid #ef6c00';
          } else {
            notificationEl.style.backgroundColor = 'rgb(33, 150, 243)';
            notificationEl.style.borderLeft = '5px solid #1565c0';
          }
          notificationEl.style.color = 'white';
        }
      });
    },
    // 기존 createSegments 함수는 단일 선 측정에만 사용
    createSegments(measurement) {
      // 경계가 있는 세그먼트 생성 함수 사용
      this.createBoundedSegments(measurement);
    },
    // 스케일바 감지 함수 업데이트
    detectScaleBar(forceShowPopup = false) {
      // console.log('[detectScaleBar] 스케일바 자동 감지 시작, 강제팝업:', forceShowPopup);
      
      // ⚠️ 주의: 이 부분은 스케일바 감지 및 팝업 표시의 핵심 로직입니다. 수정 시 주의하세요! ⚠️
      // 다른 부분과의 충돌을 막기 위해 popupOverride.js와 동기화해야 합니다.
      
      // 팝업이 열려있지 않은 경우 아무 작업도 하지 않음
      if (!this.isVisible) {
        // console.log('[detectScaleBar] 팝업이 열려있지 않아 스케일바 감지를 수행하지 않음');
        return;
      }
      
      // 스케일바 자동 감지 팝업 방지 플래그 확인
      const noScalePopup = sessionStorage.getItem('msa6_no_scale_popup') === 'true';
      if (noScalePopup) {
        // console.log('[detectScaleBar] 스케일바 자동 감지 팝업 방지 플래그가 설정되어 있어 팝업을 표시하지 않음');
        // 플래그 제거 (일회성)
        sessionStorage.removeItem('msa6_no_scale_popup');
        return;
      }

      // 추가: manualScaleBarSet 값의 유효성을 확인
      // 현재 값이 true지만 manualScaleBar 객체가 없으면 잘못된 상태로 간주하고 초기화
      if (this.manualScaleBarSet && !this.manualScaleBar) {
        console.warn('[detectScaleBar] 오류 상태 감지: manualScaleBarSet이 true지만 manualScaleBar 객체가 없습니다. 초기화합니다.');
        this.manualScaleBarSet = false;
        this.saveScaleBarSettings();
      }
      
      // 수동 스케일바 설정 유효성 검증
      const { hasValidManualScaleBar } = this.validateScaleBarSettings();
      
      // 이미 유효한 수동 스케일바가 설정되어 있는 경우 팝업 표시하지 않음
      if (hasValidManualScaleBar) {
        // console.log('[detectScaleBar] 유효한 수동 스케일바가 이미 설정되어 있어 감지를 수행하지 않음:', 
          // 'manualScaleBarSet:', this.manualScaleBarSet,
          // 'scaleBarValue:', this.scaleBarValue, 
          // 'scaleBarUnit:', this.scaleBarUnit);
        
        // 팝업 플래그도 확실히 false로 설정
        this.showScaleChoicePopup = false;
        return;
      }

      // 여기에서 실제 스케일바 감지 로직이 있어야 함 (여기서는 간단히 실패로 처리)
      // 실제 프로젝트에서는 이미지 분석을 통해 스케일바를 감지하는 로직 구현
      
      // 중요: 자동 감지 성공 시에도 manualScaleBarSet은 false로 유지해야 함
      // this.scaleBarDetected가 true가 되더라도 manualScaleBarSet은 false로 유지
      // 사용자가 직접 스케일바를 그릴 때만 manualScaleBarSet이 true가 되어야 함
      this.scaleBarDetected = false;
      
      // 팝업 표시 - 감지 실패 시
      // console.log('[detectScaleBar] 스케일바 감지 실패, 선택 팝업 표시');
      
      // 팝업 표시 플래그 설정
      this.showScaleChoicePopup = true;
      
        // 새로운 메서드를 사용하여 팝업 표시
        this.showScaleDetectionFailurePopup();
      
      this.render();
    },
    // 스케일바 감지 실패 팝업 표시 메서드 개선
    showScaleDetectionFailurePopup() {
      // console.log('[showScaleDetectionFailurePopup] 스케일바 감지 실패 팝업 표시');
      
      // 팝업이 열려있지 않으면 표시하지 않음
      if (!this.isVisible) {
        // console.log('[showScaleDetectionFailurePopup] 팝업이 열려있지 않아 스케일바 감지 실패 팝업을 표시하지 않음');
        return;
      }
      
      // 스케일바 자동 감지 팝업 방지 플래그 확인
      const noScalePopup = sessionStorage.getItem('msa6_no_scale_popup') === 'true';
      if (noScalePopup) {
        // console.log('[showScaleDetectionFailurePopup] 스케일바 자동 감지 팝업 방지 플래그가 설정되어 있어 팝업을 표시하지 않음');
        // 플래그 제거 (일회성)
        sessionStorage.removeItem('msa6_no_scale_popup');
        return;
      }
      
      // 수동 스케일바 설정 유효성 검증
      const { hasValidManualScaleBar } = this.validateScaleBarSettings();
      
      // 유효한 수동 스케일바가 이미 설정되어 있는 경우 팝업 표시하지 않음
      if (hasValidManualScaleBar) {
        // console.log('[showScaleDetectionFailurePopup] 유효한 수동 스케일바가 이미 설정되어 있어 팝업을 표시하지 않음:', 
          // 'manualScaleBarSet:', this.manualScaleBarSet,
          // 'scaleBarValue:', this.scaleBarValue,
          // 'scaleBarUnit:', this.scaleBarUnit);
        
        // 팝업 플래그도 확실히 false로 설정
        this.showScaleChoicePopup = false;
        return;
      }
      
      // 팝업 표시 전에 방식을 scaleBar로 변경 (선택 팝업이 관련성을 가지도록)
      if (this.scaleMethod !== 'scaleBar') {
        // console.log('[showScaleDetectionFailurePopup] 현재 방식이 scaleBar가 아님, scaleBar로 변경:', this.scaleMethod);
      this.scaleMethod = 'scaleBar';
      }
      
      // Show the scale choice popup
      this.showScaleChoicePopup = true;
      
      // 알림 표시
      this.showNotification('스케일바 자동 감지에 실패했습니다. 측정 방식을 선택해주세요.', 'warning');
      
      // Force DOM update and apply styles
      this.$nextTick(() => {
          const popupElement = document.querySelector('.scale-choice-popup');
          if (popupElement) {
            popupElement.style.display = 'flex';
            popupElement.style.zIndex = '999999';
          console.log('[showScaleDetectionFailurePopup] 팝업 스타일 적용 완료');
        } else {
            console.error('[showScaleDetectionFailurePopup] 팝업 요소를 찾을 수 없음');
        }
      });
    },
    // 스케일바 설정 저장 함수 개선
    saveScaleBarSettings() {
      try {
        // console.log('[saveScaleBarSettings] 스케일바 설정 저장 시작');
        
        // 현재 상태 로깅
        // console.log('[saveScaleBarSettings] 현재 설정 상태:', {
        //   scaleMethod: this.scaleMethod,
        //   scaleBarValue: this.scaleBarValue,
        //   scaleBarUnit: this.scaleBarUnit,
        //   manualScaleBarSet: this.manualScaleBarSet,
        //   scaleBarDetected: this.scaleBarDetected,
        //   magnification: this.magnification
        // });
        
        // 디버깅: manualScaleBarSet이 false인 경우 호출 스택 로깅
        if (!this.manualScaleBarSet && this.scaleMethod === 'scaleBar' && this.scaleBarDetected) {
          console.warn('[saveScaleBarSettings] 경고: 스케일바가 감지되었지만 manualScaleBarSet이 false입니다.');
          console.trace('[saveScaleBarSettings] 호출 스택:');
        }
        
        // 저장할 데이터 준비
        const settings = {
          scaleMethod: this.scaleMethod,
          scaleBarValue: this.scaleBarValue,
          scaleBarUnit: this.scaleBarUnit,
          manualScaleBarSet: this.manualScaleBarSet,
          magnification: this.magnification,
          savedAt: new Date().toISOString()
        };
        
        // console.log('[saveScaleBarSettings] 저장할 데이터:', settings);
        
        // 이미지 키 생성 (URL에서 파일명 추출)
        let imageKey = 'default';
        if (this.imageUrl) {
          const urlParts = this.imageUrl.split('/');
          const fileName = urlParts[urlParts.length - 1];
          imageKey = fileName.split('.')[0]; // 확장자 제거
        }
        
        // console.log(`[saveScaleBarSettings] 이미지 키: ${imageKey}`);
        
        // 1. 현재 이미지에 대한 설정 저장
        localStorage.setItem(`msa6_scalebar_${imageKey}`, JSON.stringify(settings));
        // console.log(`[saveScaleBarSettings] 현재 이미지 설정 저장 완료 -> localStorage[msa6_scalebar_${imageKey}]`);
        
        // 2. 마지막 사용 이미지 키 저장 (다른 이미지에서 재사용하기 위함)
        localStorage.setItem('msa6_last_image_key', imageKey);
        // console.log(`[saveScaleBarSettings] 마지막 이미지 키 저장 완료 -> localStorage[msa6_last_image_key] = ${imageKey}`);
        
        // 3. 전역 설정에도 마지막 사용 설정 저장
        const globalSettings = {
          lastScaleMethod: this.scaleMethod,
          lastScaleBarValue: this.scaleBarValue,
          lastScaleBarUnit: this.scaleBarUnit,
          lastManualScaleBarSet: this.manualScaleBarSet,
          lastMagnification: this.magnification,
          lastUpdatedAt: new Date().toISOString()
        };
        
        localStorage.setItem('msa6_scalebar_global', JSON.stringify(globalSettings));
        // console.log(`[saveScaleBarSettings] 전역 설정 저장 완료 -> localStorage[msa6_scalebar_global]`);
        
        // 4. 저장된 데이터 검증
        const savedImageSettings = JSON.parse(localStorage.getItem(`msa6_scalebar_${imageKey}`));
        const savedGlobalSettings = JSON.parse(localStorage.getItem('msa6_scalebar_global'));
        
        // console.log('[saveScaleBarSettings] 저장된 이미지별 설정:', savedImageSettings);
        // console.log('[saveScaleBarSettings] 저장된 전역 설정:', savedGlobalSettings);
        
        // 저장된 manualScaleBarSet 값 확인
        if (savedImageSettings.manualScaleBarSet !== this.manualScaleBarSet) {
          console.error(`[saveScaleBarSettings] 오류: 저장된 manualScaleBarSet 값(${savedImageSettings.manualScaleBarSet})이 현재 값(${this.manualScaleBarSet})과 다릅니다.`);
        }
        
        // console.log('[saveScaleBarSettings] 스케일바 설정 저장 완료');
        return true;
      } catch (e) {
        console.error('[saveScaleBarSettings] 저장 오류:', e);
        return false;
      }
    },
    
    // 스케일바 설정 복원 함수 개선
    restoreScaleBarSettings() {
        try {
            // console.log('[restoreScaleBarSettings] 스케일바 설정 복원 시작');
            
            // 현재 이미지 키 생성
            let currentImageKey = 'default';
            if (this.outputImageUrl) {
                const urlParts = this.outputImageUrl.split('/');
                const fileName = urlParts[urlParts.length - 1];
                currentImageKey = fileName.split('.')[0]; // 확장자 제거
            }
            
            // 마지막으로 사용한 이미지 키 가져오기
            const lastImageKey = localStorage.getItem('msa6_last_image_key');
            
            // console.log(`[restoreScaleBarSettings] 현재 이미지 키: ${currentImageKey}`);
            // console.log(`[restoreScaleBarSettings] 마지막 이미지 키: ${lastImageKey || '없음'}`);
            
            // 복원 시도할 스토리지 키 목록
            // console.log('[restoreScaleBarSettings] 복원 시도 순서: 1) 현재 이미지 설정 -> 2) 마지막 이미지 설정 -> 3) 전역 설정');
            
            // 저장된 설정이 있는지 확인
            let savedSettings = null;
            
            // 1. 현재 이미지 설정 확인
            const currentImageStorageKey = `msa6_scalebar_${currentImageKey}`;
            savedSettings = localStorage.getItem(currentImageStorageKey);
            
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                // console.log(`[restoreScaleBarSettings] 1) 현재 이미지 설정 찾음 -> localStorage[${currentImageStorageKey}]`, settings);
                
                // 저장된 측정 방식, 값, 단위 복원
                this.scaleMethod = settings.scaleMethod || 'scaleBar';
                this.scaleBarValue = settings.scaleBarValue || 500;
                this.scaleBarUnit = settings.scaleBarUnit || 'nm';
                
                // 값이 유효한지 확인
                const validScaleBarValue = typeof this.scaleBarValue === 'number' && this.scaleBarValue > 0;
                const validScaleBarUnit = typeof this.scaleBarUnit === 'string' && this.scaleBarUnit.trim() !== '';
                
                // 중요: 저장된 manualScaleBarSet 값을 그대로 복원
                this.manualScaleBarSet = !!settings.manualScaleBarSet;
                // console.log(`[restoreScaleBarSettings] 저장된 manualScaleBarSet 값 복원: ${this.manualScaleBarSet}`);
                
                // 배율 설정 복원
                if (settings.magnification) this.magnification = settings.magnification;
                
                // manualScaleBarSet이 true인 경우 scaleBarDetected도 true로 설정
                this.scaleBarDetected = this.manualScaleBarSet;
                
                // console.log(`[restoreScaleBarSettings] 현재 이미지 설정 복원 완료:`, {
                //     scaleMethod: this.scaleMethod,
                //     scaleBarValue: this.scaleBarValue,
                //     scaleBarUnit: this.scaleBarUnit,
                //     manualScaleBarSet: this.manualScaleBarSet,
                //     scaleBarDetected: this.scaleBarDetected,
                //     magnification: this.magnification
                // });
                
                
                return true;
      } else {
                // console.log(`[restoreScaleBarSettings] 1) 현재 이미지 설정 없음 -> localStorage[${currentImageStorageKey}]`);
            }
            
            // 2. 마지막 이미지 설정 확인 (현재 이미지와 다른 경우)
            if (lastImageKey && lastImageKey !== currentImageKey) {
                const lastImageStorageKey = `msa6_scalebar_${lastImageKey}`;
                savedSettings = localStorage.getItem(lastImageStorageKey);
                
                if (savedSettings) {
                    const settings = JSON.parse(savedSettings);
                    // console.log(`[restoreScaleBarSettings] 2) 마지막 이미지 설정 찾음 -> localStorage[${lastImageStorageKey}]`, settings);
                    
                    // 저장된 측정 방식, 값, 단위 복원
                    this.scaleMethod = settings.scaleMethod || 'scaleBar';
                    this.scaleBarValue = settings.scaleBarValue || 500;
                    this.scaleBarUnit = settings.scaleBarUnit || 'nm';
                    
                    // 중요: 저장된 manualScaleBarSet 값을 그대로 복원
                    this.manualScaleBarSet = !!settings.manualScaleBarSet;
                    // console.log(`[restoreScaleBarSettings] 마지막 이미지의 manualScaleBarSet 값 복원: ${this.manualScaleBarSet}`);
                    
                    // 배율 설정 복원
                    if (settings.magnification) this.magnification = settings.magnification;
                    
                    // manualScaleBarSet이 true인 경우 scaleBarDetected도 true로 설정
                    this.scaleBarDetected = this.manualScaleBarSet;
                    
                    // console.log(`[restoreScaleBarSettings] 마지막 이미지 설정 복원 완료:`, {
                    //     scaleMethod: this.scaleMethod,
                    //     scaleBarValue: this.scaleBarValue,
                    //     scaleBarUnit: this.scaleBarUnit,
                    //     manualScaleBarSet: this.manualScaleBarSet,
                    //     scaleBarDetected: this.scaleBarDetected,
                    //     magnification: this.magnification
                    // });
                    
                    // 현재 이미지 키를 사용하여 설정 저장 (다음에 열 때 이 설정 사용)
                    this.saveScaleBarSettings();
                    
                    return true;
                } else {
                    // console.log(`[restoreScaleBarSettings] 2) 마지막 이미지 설정 없음 -> localStorage[${lastImageStorageKey}]`);
                }
            } else {
                // console.log(`[restoreScaleBarSettings] 2) 마지막 이미지 키가 없거나 현재 이미지와 동일하여 확인 건너뜀`);
            }
            
            // 3. 전역 설정 확인
            const globalSettings = localStorage.getItem('msa6_scalebar_global');
            if (globalSettings) {
                const settings = JSON.parse(globalSettings);
                // console.log('[restoreScaleBarSettings] 3) 전역 설정 찾음 -> localStorage[msa6_scalebar_global]', settings);
                
                // 저장된 측정 방식, 값, 단위 복원
                this.scaleMethod = settings.lastScaleMethod || 'scaleBar';
                this.scaleBarValue = settings.lastScaleBarValue || 500;
                this.scaleBarUnit = settings.lastScaleBarUnit || 'nm';
                
                // 중요: 전역 설정에서도 manualScaleBarSet 값 복원
                this.manualScaleBarSet = !!settings.lastManualScaleBarSet;
                // console.log(`[restoreScaleBarSettings] 전역 설정의 manualScaleBarSet 값 복원: ${this.manualScaleBarSet}`);
                
                // 배율 설정 복원
                if (settings.lastMagnification) this.magnification = settings.lastMagnification;
                
                // manualScaleBarSet이 true인 경우 scaleBarDetected도 true로 설정
                this.scaleBarDetected = this.manualScaleBarSet;
                
                // console.log(`[restoreScaleBarSettings] 전역 설정 복원 완료:`, {
                //     scaleMethod: this.scaleMethod,
                //     scaleBarValue: this.scaleBarValue,
                //     scaleBarUnit: this.scaleBarUnit,
                //     manualScaleBarSet: this.manualScaleBarSet,
                //     scaleBarDetected: this.scaleBarDetected,
                //     magnification: this.magnification
                // });
                
                
                return true;
            } else {
                // console.log(`[restoreScaleBarSettings] 3) 전역 설정 없음 -> localStorage[msa6_scalebar_global]`);
            }
            
            // 설정이 없는 경우 기본값 설정
            this.scaleMethod = 'scaleBar';
            this.scaleBarValue = 500;
            this.scaleBarUnit = 'nm';
            this.manualScaleBarSet = false;
        this.scaleBarDetected = false;
            
            // console.log('[restoreScaleBarSettings] 저장된 설정 없음, 기본값 설정:', {
            //     scaleMethod: this.scaleMethod,
            //     scaleBarValue: this.scaleBarValue,
            //     scaleBarUnit: this.scaleBarUnit,
            //     manualScaleBarSet: this.manualScaleBarSet,
            //     scaleBarDetected: this.scaleBarDetected
            // });
            return false;
        } catch (e) {
            console.error('[restoreScaleBarSettings] 복원 오류:', e);
            
            // 오류 발생 시에도 기본값 설정
            this.scaleMethod = 'scaleBar';
            this.scaleBarValue = 500;
            this.scaleBarUnit = 'nm';
        this.manualScaleBarSet = false;
            this.scaleBarDetected = false;
            
            // console.log('[restoreScaleBarSettings] 오류 발생으로 기본값 설정');
            return false;
      }
    },
    
    // 스케일 방식 선택 메서드 수정
    selectScaleMethod(method) {
      // console.log(`[selectScaleMethod] 사용자가 선택한 측정 방식: ${method}, 이전 방식: ${this.scaleMethod}`);
      
      // 선택 팝업 닫기 - showScaleChoicePopup 플래그 설정
      this.showScaleChoicePopup = false;
      
      // DOM 요소도 직접 제어하여 확실하게 팝업 숨기기 (v-show 문제 해결)
      this.$nextTick(() => {
        const popupElement = document.querySelector('.scale-choice-popup');
        if (popupElement) {
          popupElement.style.display = 'none';
          // console.log('[selectScaleMethod] 팝업 요소 직접 숨김 처리');
        }
      });
      
      // 사용자 선택에 따라 처리
      if (method === 'magnification') {
        // 배율 기반 측정 선택
        this.scaleMethod = 'magnification';
        this.isDrawingScaleBar = false; // 스케일바 그리기 모드 비활성화
        this.measurementMode = 'line'; // 선 측정 모드로 설정
        this.showNotification('배율 기반 측정 방식을 선택했습니다.', 'info');
            
            // 배율 기반으로 전환 시 manualScaleBarSet은 false로 설정
            this.manualScaleBarSet = false;
      } else if (method === 'scaleBar') {
        // 수동 스케일바 설정 선택
        this.scaleMethod = 'scaleBar';
        this.isDrawingScaleBar = true;
        this.measurementMode = 'scaleBar';
        // 알림 메시지 제거 - UI에 영향을 주지 않도록
        // this.showNotification('수동 스케일바 설정 모드를 선택했습니다. 이미지의 스케일바 위에 선을 그려주세요.', 'info');
            
            // 스케일바 모드로 전환 시에는 manualScaleBarSet 상태를 바꾸지 않음
            // 사용자가 실제로 스케일바를 그리고 값을 입력할 때 true로 설정됨
      }
      
      // 첫 번째 감지 시도 플래그 해제
      this.isFirstDetectionAttempt = false;
        
        // 설정 저장
        this.saveScaleBarSettings();
      
      this.render();
      
      // 이벤트 발생 기록
      LogService.logAction(`select_scale_method_${method}`, {
        previous: this.scaleMethod,
        selected: method
      });
    },
    
    // 스케일바 값 입력 다이얼로그 핸들링 수정
    handleScaleBarValueInput() {
        // console.log('[handleScaleBarValueInput] 스케일바 값 입력 처리');
        
        const numValue = parseFloat(this.tempScaleBarValue);
        if (isNaN(numValue) || numValue <= 0) {
            alert('유효한 양수를 입력해주세요.');
            return;
        }
        
        // console.log(`[handleScaleBarValueInput] 입력값: ${numValue} ${this.tempScaleBarUnit}`);
        
        // 스케일바 값 설정
        this.scaleBarValue = numValue;
        this.scaleBarUnit = this.tempScaleBarUnit;
        this.showScaleBarInputDialog = false;
        
        // 수동 스케일바 설정 플래그 업데이트 - 사용자가 직접 그린 경우에만 true로 설정
        if (this.manualScaleBar) {
            this.manualScaleBarSet = true;
            // console.log(`[handleScaleBarValueInput] 사용자가 직접 그린 스케일바에 대해 manualScaleBarSet 플래그를 true로 설정`);
            
            // 스케일바 감지 상태도 true로 설정
            this.scaleBarDetected = true;
        } else {
            // console.log(`[handleScaleBarValueInput] 사용자가 직접 그린 스케일바가 없어 manualScaleBarSet 플래그를 변경하지 않음`);
        }
        
        // 현재 상태 확인 로깅
        // console.log(`[handleScaleBarValueInput] 저장 전 상태 확인:`, {
        //   scaleMethod: this.scaleMethod,
        //   scaleBarValue: this.scaleBarValue,
        //   scaleBarUnit: this.scaleBarUnit,
        //     manualScaleBarSet: this.manualScaleBarSet,
        //     scaleBarDetected: this.scaleBarDetected
        // });
        
        // 설정 저장
        // console.log(`[handleScaleBarValueInput] saveScaleBarSettings 호출하여 설정 저장`);
        this.saveScaleBarSettings();
        
        // 저장 후 상태 확인 로깅
        // console.log(`[handleScaleBarValueInput] 설정 저장 후 manualScaleBarSet: ${this.manualScaleBarSet}`);
        
        // console.log('[handleScaleBarValueInput] 스케일바 값 설정 완료:', this.scaleBarValue, this.scaleBarUnit);
        this.showNotification(`스케일바 값이 ${this.scaleBarValue} ${this.scaleBarUnit}로 설정되었습니다.`, 'success');
        
        // 측정 모드로 전환 (중요: scaleMethod는 'scaleBar'로 유지하면서 measurementMode만 'line'으로 변경)
        this.isDrawingScaleBar = false;
        this.measurementMode = 'line';
        
        // 추가 알림 표시 - 선 측정 모드 전환 안내
        this.showNotification('선 측정 모드로 자동 전환되었습니다.', 'info');
        
        // console.log('[handleScaleBarValueInput] 선 측정 모드로 자동 전환:', 
            // 'scaleMethod:', this.scaleMethod,
            // 'measurementMode:', this.measurementMode);
        
        // 캔버스 다시 그리기
        this.render();
    },
    // 스케일바 값 입력 다이얼로그 표시 메소드 추가
    showScaleBarValueDialog() {
        // console.log('[showScaleBarValueDialog] 스케일바 값 입력 다이얼로그 표시');
        
        // 임시 입력값 초기화
        this.tempScaleBarValue = this.scaleBarValue || 500;
        this.tempScaleBarUnit = this.scaleBarUnit || 'nm';
        
        // 다이얼로그 표시
        this.showScaleBarInputDialog = true;
        
        // DOM에 반영되도록 nextTick 사용
        this.$nextTick(() => {
            // 입력 필드에 포커스
            const inputField = document.querySelector('.scale-bar-input-field');
            if (inputField) {
                inputField.focus();
                inputField.select();
            }
        });
    },
    handleMouseMove(e) {
      const pos = this.getLocalPos(e);
      this.currentMousePos = { x: e.clientX, y: e.clientY };
      
      if (this.isFKeyPressed) {
        this.currentBrightness = this.calculateBrightness(pos.x, pos.y);
        this.updateMagnifier(pos);
        
        // 돋보기가 보이도록 강제 설정
        const magnifierContainer = document.querySelector('.magnifier-container');
        if (magnifierContainer) {
          magnifierContainer.style.display = 'block';
        }
      }
    },
    
    updateMagnifier(pos) {
      // 돋보기 캔버스가 없으면 종료
      if (!this.$refs.magnifierCanvas || !this.$refs.canvas) return;
      
      const sourceCanvas = this.$refs.canvas;
      const magnifierCanvas = this.$refs.magnifierCanvas;
      const ctx = magnifierCanvas.getContext('2d');
      
      // 돋보기 캔버스 크기 설정
      magnifierCanvas.width = this.magnifierSize;
      magnifierCanvas.height = this.magnifierSize;
      
      // 크기가 설정되지 않은 경우 초기화
      if (sourceCanvas.width === 0 || sourceCanvas.height === 0) return;
      
      // 확대할 영역의 크기 계산
      const zoomArea = this.magnifierSize / this.magnifierZoom;
      
      // 시작 좌표 계산 (중앙에서 zoomArea/2만큼 뺌)
      const startX = Math.max(0, pos.x - zoomArea / 2);
      const startY = Math.max(0, pos.y - zoomArea / 2);
      
      // 이미지 데이터 가져오기
      try {
        // 확대된 이미지 그리기
        ctx.drawImage(
          sourceCanvas,
          startX, startY, zoomArea, zoomArea,
          0, 0, this.magnifierSize, this.magnifierSize
        );
        
        // 테두리 그리기
        ctx.strokeStyle = '#ff9900';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, this.magnifierSize, this.magnifierSize);
      } catch (err) {
        console.error('돋보기 업데이트 중 오류:', err);
      }
    },
    handleCanvasClick(e) {
      // 기존 코드가 있을 경우 유지
      // F키가 눌린 상태에서 클릭 처리
      if (this.isFKeyPressed) {
        const pos = this.getLocalPos(e);
        const brightness = this.calculateBrightness(pos.x, pos.y);
        this.brightnessThreshold = brightness;
        this.showNotification(`밝기 임계값이 ${brightness}로 설정되었습니다.`, 'info');
      }
    },
    // F키를 떼면 밝기 표시 숨기기
    handleKeyUp(e) {
      if (e.key && e.key.toLowerCase() === 'f') {
        this.isFKeyPressed = false;
        this.showBrightnessTooltip = false;
        // this.hideMagnifier() 호출 제거
      } else if (e.key && e.key.toLowerCase() === 'h') {
        this.showShortcutHelp = false;
      }
    },
    handleMSA5ImageProcessed(event) {
      // console.log('[handleMSA5ImageProcessed] MSA5 이미지 처리 완료 이벤트 수신', event.type);
      
      try {
        // 이벤트 데이터 추출
        const data = event.detail;
        
        if (!data || !data.imageUrl) {
          console.warn('[handleMSA5ImageProcessed] 이벤트에 이미지 URL이 없습니다');
          return;
        }
        
        // ⚠️ 주의: 이 부분은 스케일바 자동 감지 로직의 핵심입니다. 수정 시 주의하세요! ⚠️
        // 중요: MSA5 프로세스 시작 시 manualScaleBarSet 플래그 초기화
        // 이를 통해 스케일바 자동 감지가 다시 가능하도록 함
        if (this.manualScaleBarSet) {
          // console.log('[handleMSA5ImageProcessed] MSA5 프로세스 시작 감지됨, manualScaleBarSet 초기화 (true -> false)');
          this.manualScaleBarSet = false;
          this.scaleBarDetected = false;
          
          // 수동 스케일바 객체도 초기화
          this.manualScaleBar = null;
          
          // 설정 저장하여 초기화된 상태 유지
          this.saveScaleBarSettings();
        }
      
        // 측정 결과 초기화 - Process Start 버튼 누를 때 측정 결과도 함께 초기화
        // console.log('[handleMSA5ImageProcessed] 측정 결과 초기화');
        this.measurements = [];
        this.segmentedMeasurements = [];
        this.defectMeasurements = [];
        this.referenceLines = [];
        this.activeReferenceLine = null;
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
        // 이력 초기화
        this.undoHistory = [];
      this.redoHistory = [];
        
        // 테이블 데이터 초기화를 위한 이벤트 발생
        this.$nextTick(() => {
          // 측정 결과 테이블 업데이트를 위한 이벤트 발생
          window.dispatchEvent(new CustomEvent('msa6-measurements-cleared'));
          
          // 캔버스 초기화 (다음 이미지 로드 시 자동으로 다시 그려짐)
          if (this.ctx) {
            // console.log('[handleMSA5ImageProcessed] 캔버스 초기화');
            this.render();
          }
        });
      
        // 자동 팝업 열림 방지 플래그 확인
        const noPopup = data.noPopup || sessionStorage.getItem('msa6_no_auto_popup') === 'true';
        
        if (noPopup) {
          // console.log('[handleMSA5ImageProcessed] 자동 팝업 열림 방지 플래그가 설정되어 있어 팝업을 열지 않습니다');
          // 이미지 URL만 저장하고 팝업은 열지 않음
          this.outputImageUrl = data.imageUrl;
          
          // 세션 스토리지 플래그 초기화 (다음 번에는 정상 작동하도록)
          sessionStorage.removeItem('msa6_no_auto_popup');
          return;
        }
        
        // 이미지 URL 추출
        const imageUrl = data.imageUrl;
        
        // 이미지 형식 확인
        let imageFormat = data.imageFormat || 'png'; // 이벤트에서 형식 정보 가져오기, 없으면 기본값 png
        // console.log(`[handleMSA5ImageProcessed] 이미지 형식: ${imageFormat}`);
        
        // 세션 스토리지에 이미지 형식 저장
        sessionStorage.setItem('msa5_end_image_format', imageFormat);
        
        // ⚠️ 주의: 이 플래그는 MSA5 프로세스 시작 시 스케일바 팝업이 뜨지 않도록 방지합니다. 제거하지 마세요! ⚠️
        // 중요: 스케일바 자동 감지 팝업 방지 플래그 설정
        // MSA5 프로세스 시작 시에는 자동으로 스케일바 감지 팝업이 표시되지 않도록 함
        sessionStorage.setItem('msa6_no_scale_popup', 'true');
        // console.log('[handleMSA5ImageProcessed] 스케일바 자동 감지 팝업 방지 플래그 설정');
        
        // 팝업 열기
        this.openPopup(imageUrl);
        
        // 팝업을 열고 이미지 로드가 완료된 후 측정 모드 설정
        setTimeout(() => {
          this.fetchMSA5Images(); // 시작/종료 이미지 가져오기
          
          // 토글 이미지가 가능한지 확인
          if (this.internalInputImageUrl && this.outputImageUrl) {
            // console.log('[handleMSA5ImageProcessed] 시작/종료 이미지가 모두 있어 토글 가능');
            
            // 이미지 형식 정보 표시
            this.showNotification(`이미지가 로드되었습니다. 형식: ${imageFormat}`, 'info');
          }
        }, 1000);
      } catch (error) {
        console.error('[handleMSA5ImageProcessed] 이벤트 처리 중 오류:', error);
      }
    },
    
    // 이미지 다운로드 함수 추가
    downloadResultImage() {
      try {
        // console.log('[downloadResultImage] 측정 결과 포함 이미지 다운로드 시작');
        
        // 현재 표시된 이미지 URL 가져오기
        // 현재 표시된 이미지 URL 가져오기
        const imageUrl = this.isShowingInputImage ? this.internalInputImageUrl : this.outputImageUrl;
        
        if (!imageUrl) {
          this.showNotification('다운로드할 이미지가 없습니다.', 'error');
          return;
        }
        
        // 이미지 형식 확인
        let imageFormat = sessionStorage.getItem('msa5_end_image_format') || 'png';
        // console.log(`[downloadResultImage] 이미지 형식: ${imageFormat}`);
        
        // 파일명 생성
        const timestamp = new Date().toISOString().replace(/[-:.]/g, '').substring(0, 14);
        const fileName = `image_result_${timestamp}.${imageFormat}`;
        
        // 캔버스를 blob으로 변환하여 다운로드
        const canvas = this.$refs.canvas;
        if (!canvas) {
          this.showNotification('캔버스를 찾을 수 없습니다.', 'error');
          return;
        }
        
        canvas.toBlob((blob) => {
          if (!blob) {
            this.showNotification('이미지 생성에 실패했습니다.', 'error');
            return;
          }
          
          // 다운로드 링크 생성
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          link.style.display = 'none';
          
          // 링크를 DOM에 추가하고 클릭
          document.body.appendChild(link);
          link.click();
          
          // 링크 제거 및 URL 해제
          setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }, 100);
          
          this.showNotification(`측정 결과가 포함된 이미지가 ${fileName} 파일로 다운로드되었습니다.`, 'success');
          // console.log(`[downloadResultImage] 이미지 다운로드 완료: ${fileName}`);
        }, `image/${imageFormat}`, 0.95);
      } catch (error) {
        console.error('[downloadResultImage] 이미지 다운로드 중 오류:', error);
        this.showNotification('이미지 다운로드 중 오류가 발생했습니다.', 'error');
      }
    },
    // 이미지 팝업을 열기 위한 메소드 수정
    openPopup(imageUrl) {
      // console.log('[openPopup] 함수 호출됨, 이미지 URL:', imageUrl);
      
      // Use the local variable instead of the prop directly
      this.isVisible = true;
      
      // Emit an event to let parent know we want to update the prop
      this.$emit('update:showPopup', true);
      
      // 세션 스토리지에서 팝업 자동 표시 방지 플래그 확인 및 초기화
      const noAutoPopup = sessionStorage.getItem('msa6_no_auto_popup') === 'true';
      if (noAutoPopup) {
        // console.log('[openPopup] 자동 팝업 방지 플래그가 설정되어 있음, 초기화함');
        sessionStorage.removeItem('msa6_no_auto_popup');
      }
      
      // 저장된 스케일바 설정 복원 시도 - 이미지 로드 전에 수행하여 설정이 준비되도록 함
      this.restoreScaleBarSettings();
      
      // 이미지 로드
      this.loadImage(imageUrl);
      
      // MSA5에서 input 이미지 가져오기 (세션 스토리지 사용)
      this.fetchMSA5Images();
      
      // 팝업 강제 표시 - 직접 DOM 요소 찾아서 표시
      this.$nextTick(() => {
        // console.log('[openPopup] $nextTick 실행');
        
        // 팝업 요소들 직접 찾아서 표시
        const measurementPopup = document.querySelector('.image-measurement-popup');
        if (measurementPopup) {
          measurementPopup.style.display = 'flex';
          measurementPopup.style.visibility = 'visible';
          // console.log('[openPopup] 측정 팝업 요소 표시 설정 완료');
        } else {
          console.warn('[openPopup] 측정 팝업 요소를 찾을 수 없음');
        }
        
        // Teleport 컨테이너도 표시
        const teleportElements = document.querySelectorAll('.msa6-image-popup-container');
        teleportElements.forEach(element => {
          element.style.display = 'block';
          element.style.visibility = 'visible';
          // console.log('[openPopup] Teleport 컨테이너 표시 처리');
        });
        
        // 팝업 열림 이벤트 발생 (다른 컴포넌트에 알림)
        window.dispatchEvent(new CustomEvent('msa6-popup-opened'));
      });
    },
    // 새로운 메소드: MSA5의 시작/종료 이미지 가져오기
    fetchMSA5Images() {
      // 이미지 URL을 저장하는 세션 스토리지 키
      const startImageKey = 'msa5_start_image_url';
      const endImageKey = 'msa5_end_image_url';
      const formatKey = 'msa5_end_image_format';
      
      // 세션 스토리지에서 이미지 URL과 형식 가져오기
      let startImage = sessionStorage.getItem(startImageKey);
      let endImage = sessionStorage.getItem(endImageKey);
      let imageFormat = sessionStorage.getItem(formatKey) || 'png';
      
      // console.log('[fetchMSA5Images] 세션 스토리지에서 이미지 확인:', 
        // '시작=', startImage ? startImage.substring(0, 20) + '...' : '없음', 
        // '종료=', endImage ? endImage.substring(0, 20) + '...' : '없음',
        // '형식=', imageFormat);
      
      // 세션 스토리지에서 이미지가 없는 경우 로컬 스토리지 확인
      if (!startImage) {
        // console.log('[fetchMSA5Images] 세션 스토리지에 시작 이미지 없음, 로컬 스토리지 확인');
        
        // MSA5 컴포넌트의 processedImages['start'] 값을 찾아야 함
        // 로컬 스토리지에서 워크플로우 데이터를 찾아 시작 이미지 추출
        const storedWorkflows = localStorage.getItem('msa5_workflows');
        
        if (storedWorkflows) {
          try {
            const workflows = JSON.parse(storedWorkflows);
            // 가장 최근 워크플로우의 시작 이미지 찾기
            if (workflows && workflows.length > 0) {
              const latestWorkflow = workflows[workflows.length - 1];
              if (latestWorkflow.inputImage) {
                startImage = latestWorkflow.inputImage;
                // console.log('[fetchMSA5Images] 로컬 스토리지에서 시작 이미지 찾음');
              }
            }
          } catch (e) {
            console.error('[fetchMSA5Images] 워크플로우 파싱 오류:', e);
          }
        }
      }
      
      // 종료 이미지가 없으면 현재 imageUrl 사용
      if (!endImage) {
        endImage = this.imageUrl;
      }
      
      // 이미지 URL 저장 - prop 대신 내부 데이터 속성 사용
      this.internalInputImageUrl = startImage || this.inputImageUrl;
      this.outputImageUrl = endImage || this.imageUrl;
      
      // console.log('[fetchMSA5Images] 이미지 URL 설정 - 입력:', 
        // this.internalInputImageUrl ? this.internalInputImageUrl.substring(0, 20) + '...' : '없음', 
        // '출력:', this.outputImageUrl ? this.outputImageUrl.substring(0, 20) + '...' : '없음',
        // '형식:', imageFormat);
      
      // 전환 버튼 표시 여부 결정
      if (this.internalInputImageUrl && this.outputImageUrl) {
        // console.log('[fetchMSA5Images] 전환 버튼 표시 가능');
      } else {
        // console.log('[fetchMSA5Images] 전환 버튼 표시 불가 - 이미지 부족');
      }
    },
    // 수동 스케일바 설정이 유효한지 검증하는 도우미 함수
    validateScaleBarSettings() {
      // 수동 스케일바 설정 값 유효성 검증
      const validScaleBarValue = typeof this.scaleBarValue === 'number' && this.scaleBarValue > 0;
      const validScaleBarUnit = typeof this.scaleBarUnit === 'string' && this.scaleBarUnit.trim() !== '';
      const isValidScaleBar = validScaleBarValue && validScaleBarUnit;
      
      // 추가: manualScaleBar 객체 존재 여부도 확인
      const hasManualScaleBarObject = !!this.manualScaleBar;
      
      // 오류 상태 감지 및 수정: manualScaleBarSet이 true지만 다른 조건이 맞지 않으면 초기화
      if (this.manualScaleBarSet && (!isValidScaleBar || !hasManualScaleBarObject)) {
        console.warn('[validateScaleBarSettings] 오류 상태 감지 및 수정:', {
          manualScaleBarSet: this.manualScaleBarSet,
        scaleBarValue: this.scaleBarValue,
        scaleBarUnit: this.scaleBarUnit,
          validValue: validScaleBarValue,
          validUnit: validScaleBarUnit,
          hasManualScaleBarObject: hasManualScaleBarObject,
          reason: !isValidScaleBar ? '유효하지 않은 값' : '수동 스케일바 객체 없음'
        });
        
        // 잘못된 상태 초기화
            this.manualScaleBarSet = false;
        this.scaleBarDetected = false;
        
        // 변경사항 저장
        this.saveScaleBarSettings();
      }
      
      // 수동 스케일바가 설정되어 있고 모든 조건이 유효한 경우만 true 반환
      const hasValidManualScaleBar = this.manualScaleBarSet && isValidScaleBar && hasManualScaleBarObject;
      
      return {
        validValue: validScaleBarValue,
        validUnit: validScaleBarUnit,
        isValidScaleBar: isValidScaleBar,
        hasManualScaleBarObject: hasManualScaleBarObject,
        hasValidManualScaleBar: hasValidManualScaleBar
      };
    },
    // 수동 스케일바 그리기 모드 토글 함수 추가
    toggleScaleBarDrawing() {
      this.isDrawingScaleBar = !this.isDrawingScaleBar;
      
      // console.log(`[toggleScaleBarDrawing] 스케일바 그리기 모드 ${this.isDrawingScaleBar ? '활성화' : '비활성화'}`);
      
      if (this.isDrawingScaleBar) {
        // 스케일바 그리기 모드 활성화 시 측정 모드도 변경
            this.measurementMode = 'scaleBar';
        // 알림 메시지 제거 - UI에 영향을 주지 않도록
        // this.showNotification('수동 스케일바 그리기 모드가 활성화되었습니다. 이미지의 스케일바 위에 선을 그려주세요.', 'info');
        
        // 기존 설정 유지 (그리기 시작 전에 manualScaleBarSet을 변경하지 않음)
        // console.log(`[toggleScaleBarDrawing] 그리기 모드 활성화 - 현재 manualScaleBarSet: ${this.manualScaleBarSet}`);
      } else {
        // 스케일바 그리기 모드 비활성화 시 일반 선 측정 모드로 전환
        this.measurementMode = 'line';
        // 알림 메시지 제거 - UI에 영향을 주지 않도록
        // this.showNotification('수동 스케일바 그리기 모드가 비활성화되었습니다.', 'info');
      }
        
        // 캔버스 다시 그리기
      this.render();
    },
    // 돋보기 숨기는 함수 추가
    hideMagnifier() {
      // 돋보기를 숨기는 로직 구현
      // 이미 showBrightnessTooltip = false로 설정되어 있어서 
      // 돋보기는 자동으로 숨겨지므로 여기서는 추가 작업 필요 없음
      // console.log('돋보기 숨기기');
    },
    // 1. First, add the blobToBase64 helper function before the saveWithTableName method
    /**
     * Blob URL을 Base64 데이터 URL로 변환
     */
    async blobToBase64(blobUrl) {
      try {
        // 입력값이 없으면 빈 문자열 반환
        if (!blobUrl) {
          // console.log('[blobToBase64] 입력 URL이 없습니다');
          return '';
        }
        
        // 이미 data URL이면 변환하지 않음
        if (typeof blobUrl === 'string' && blobUrl.startsWith('data:')) {
          // console.log('[blobToBase64] 이미 Data URL 형식입니다. 변환 불필요');
          return blobUrl;
        }
        
        // console.log('[blobToBase64] Blob URL을 Base64로 변환 시작:', typeof blobUrl === 'string' ? blobUrl.substring(0, 50) + '...' : 'non-string');
        
        // URL이 유효한지 확인
        if (typeof blobUrl !== 'string' || !blobUrl.startsWith('blob:')) {
          console.warn('[blobToBase64] 유효하지 않은 Blob URL:', blobUrl);
          return '';
        }
        
        const response = await fetch(blobUrl);
        
        if (!response.ok) {
          throw new Error(`Blob URL 가져오기 실패: ${response.status}`);
        }
        
        const blob = await response.blob();
        if (!blob) {
          console.error('[blobToBase64] Blob이 null입니다');
          return '';
        }
        
        // console.log('[blobToBase64] Blob 정보:', {
        //   type: blob.type || 'unknown',
        //   size: blob.size + ' bytes',
        //   lastModified: blob.lastModified ? new Date(blob.lastModified).toISOString() : 'N/A'
        // });
        
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (!reader || !reader.result) {
              console.error('[blobToBase64] 파일 읽기 결과가 null입니다');
              resolve('');
              return;
            }
            
            const result = reader.result;
            // console.log('[blobToBase64] Base64 변환 완료 (길이):', result.length);
            
            // MIME 타입이 없는 경우 추가
            if (typeof result === 'string' && !result.startsWith('data:') && blob.type) {
              resolve(`data:${blob.type};base64,${result}`);
            } else {
              resolve(result);
            }
          };
          reader.onerror = (e) => {
            console.error('[blobToBase64] FileReader 오류:', e);
            reject(new Error('이미지 읽기 오류'));
          };
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        console.error('[blobToBase64] Base64 변환 중 오류:', error);
        // 오류 발생 시 빈 문자열 반환 (안전한 처리)
        return '';
      }
    },

    // 2. Now update the saveWithTableName method to use base64 conversion
    async blobToBase64SaveWithTableName(selectedTable) {
      // console.log('[blobToBase64SaveWithTableName] 시작');
      
      try {
        // 테이블 데이터 유효성 검사
        if (!selectedTable) {
          // console.log('[blobToBase64SaveWithTableName] 테이블 데이터가 없습니다');
          this.showNotification('테이블 정보가 없습니다.', 'warning');
          return;
        }
        
        // 테이블 객체인 경우 (객체 경우)
        if (typeof selectedTable === 'object') {
          // console.log('[blobToBase64SaveWithTableName] 테이블 객체 정보:', selectedTable);
          
          // saveWithTableName 함수 호출
          const result = await this.saveWithTableName(selectedTable);
          
          // 성공 여부에 따라 다르게 처리
          if (result && result.success) {
            // console.log('[blobToBase64SaveWithTableName] 저장 성공:', result);
            return result;
          } else if (result && !result.success) {
            // console.log('[blobToBase64SaveWithTableName] 저장 실패:', result.error || '알 수 없는 오류');
            this.showNotification(`저장 실패: ${result.error || '알 수 없는 오류'}`, 'error');
            return result;
          }
        } 
        // URL 문자열인 경우 (레거시 코드 호환)
        else if (typeof selectedTable === 'string' && selectedTable.startsWith('http')) {
          // console.log('[blobToBase64SaveWithTableName] URL 문자열로 호출됨:', selectedTable);
          // 테이블 URL이 주어진 경우 (레거시 코드 호환)
          const tableUrl = selectedTable;
          const fetchResponse = await fetch(tableUrl);
          
          if (!fetchResponse.ok) {
            throw new Error(`테이블 정보를 가져오는데 실패했습니다 (${fetchResponse.status})`);
          }
          
          const tableData = await fetchResponse.json();
          // console.log('[blobToBase64SaveWithTableName] 테이블 데이터 가져옴:', tableData);
          
          // 가져온 테이블 정보로 저장 함수 호출
          return await this.saveWithTableName(tableData);
        } else {
          throw new Error('유효하지 않은 테이블 정보 형식입니다.');
        }
      } catch (error) {
        // console.log('[blobToBase64SaveWithTableName] 오류 발생:', error.message);
        this.showNotification(`저장 중 오류: ${error.message}`, 'error');
        return { success: false, error: error.message };
      }
    },
    cleanupImageUrls() {
      // 생성된 Blob URL 정리
      // console.log('[cleanupImageUrls] 이미지 URL 정리 시작');
      try {
        // Blob URL 정리
        const urlsToRevoke = [
          this.imageUrl, 
          this.inputImageUrl, 
          ...(this.measurements || [])
            .filter(m => m && typeof m.imageUrl === 'string' && m.imageUrl.startsWith('blob:'))
            .map(m => m.imageUrl)
        ].filter(url => url && typeof url === 'string' && url.startsWith('blob:'));
        
        // 중복 제거
        const uniqueUrls = [...new Set(urlsToRevoke)];
        
        // console.log(`[cleanupImageUrls] ${uniqueUrls.length}개의 Blob URL 정리 중`);
        
        uniqueUrls.forEach(url => {
          try {
            URL.revokeObjectURL(url);
            // (`[cleanupImageUrls] URL 정리됨: ${url.substring(0, 30)}...`);
          } catch (e) {
            console.warn(`[cleanupImageUrls] URL 정리 중 오류: ${e.message}`);
          }
        });
      } catch (error) {
        console.error('[cleanupImageUrls] URL 정리 중 오류:', error);
      }
      
      // 로컬 URL 변수 초기화
      this.imageUrl = null;
      this.inputImageUrl = null;
      this.resultImageUrl = null;
      
      // console.log('[cleanupImageUrls] 이미지 URL 정리 완료');
    },
    // 임시 드래그 선 그리기 메서드
    drawTempDragLine() {
      if (!this.ctx || !this.isDKeyPressed || !this.tempDragLine) return;
      
      // console.log('drawTempDragLine 호출됨:', this.tempDragLine);
      
      // 교차하는 선 찾기
      const intersectingLines = this.findIntersectingLines(this.tempDragLine);
      
      // 교차하는 선들을 먼저 강조 표시 (더 두껍게)
      if (intersectingLines.length > 0) {
        this.ctx.beginPath();
        this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.9)'; // 더 진한 노란색
        this.ctx.lineWidth = 5; // 더 두껍게
        this.ctx.setLineDash([]);
        
        intersectingLines.forEach(line => {
          this.ctx.moveTo(line.start.x, line.start.y);
          this.ctx.lineTo(line.end.x, line.end.y);
        });
        
        this.ctx.stroke();
      }
      
      // 임시 드래그 선 그리기 (빨간 점선)
      this.ctx.beginPath();
      this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.9)'; // 더 진한 빨간색
      this.ctx.lineWidth = 4; // 더 두껍게
      this.ctx.setLineDash([8, 8]); // 더 큰 점선
      this.ctx.moveTo(this.tempDragLine.start.x, this.tempDragLine.start.y);
      this.ctx.lineTo(this.tempDragLine.end.x, this.tempDragLine.end.y);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
      
      // 안내 텍스트 표시 (배경과 함께)
      if (intersectingLines.length > 0) {
        const text = `${intersectingLines.length}개 선이 선택되었습니다 (삭제됩니다)`;
        this.ctx.font = 'bold 16px Arial';
        
        // 텍스트 크기 측정
        const textMetrics = this.ctx.measureText(text);
        const textWidth = textMetrics.width;
        const textHeight = 20;
        
        // 배경 그리기
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(15, 15, textWidth + 20, textHeight + 10);
        
        // 텍스트 그리기
        this.ctx.fillStyle = 'rgba(255, 255, 255, 1)';
        this.ctx.fillText(text, 25, 35);
      } else {
        // 교차하는 선이 없을 때
        const text = "드래그하여 삭제할 선을 선택하세요";
        this.ctx.font = 'bold 14px Arial';
        
        const textMetrics = this.ctx.measureText(text);
        const textWidth = textMetrics.width;
        const textHeight = 18;
        
        // 배경 그리기
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(15, 15, textWidth + 20, textHeight + 10);
        
        // 텍스트 그리기
        this.ctx.fillStyle = 'rgba(200, 200, 200, 1)';
        this.ctx.fillText(text, 25, 32);
      }
    },
    toggleDeleteMode() {
        const canvas = this.$refs.canvas;
        if (!canvas) {
        console.warn('[toggleDeleteMode] Canvas element not found');
        return;
      }

      this.isDeleteMode = !this.isDeleteMode;
      if (this.isDeleteMode) {
        this.measurementMode = null;
        this.deleteStart = null;
        this.deleteEnd = null;
        this.showNotification('삭제 모드가 활성화되었습니다. 삭제할 측정값을 선택하세요.', 'info');
      } else {
        this.measurementMode = 'line';
        this.deleteStart = null;
        this.deleteEnd = null;
        this.showNotification('삭제 모드가 비활성화되었습니다.', 'info');
      }
      this.render();
    },
    deleteMeasurementsInPath() {
      if (!this.deleteStart || !this.deleteEnd) return;

      // 삭제 선과 교차하는 측정선들 찾기
      const intersectingMeasurements = this.segmentedMeasurements.filter(segment => {
        return this.checkIntersection(
          this.deleteStart,
          this.deleteEnd,
          segment.start,
          segment.end
        );
      });

      // 교차하는 측정선들 삭제
      if (intersectingMeasurements.length > 0) {
        // 삭제될 각 측정값에 대해 히스토리 저장
        const itemIdsToDelete = new Set(intersectingMeasurements.map(m => m.itemId));
        
        itemIdsToDelete.forEach(itemId => {
          const relatedSegments = this.segmentedMeasurements.filter(s => s.itemId === itemId);
          const measurement = this.measurements.find(m => m.itemId === itemId);
          
          if (measurement && relatedSegments.length > 0) {
            this.addToHistory('delete', measurement, relatedSegments);
          }
        });
        
        // redo 히스토리 초기화 (새로운 액션 후)
        this.redoHistory = [];
        
        // 먼저 segmentedMeasurements에서 삭제
        intersectingMeasurements.forEach(segment => {
          const index = this.segmentedMeasurements.findIndex(s => 
            s.itemId === segment.itemId && s.subItemId === segment.subItemId
          );
          if (index !== -1) {
            this.segmentedMeasurements.splice(index, 1);
          }
        });

        // 관련된 measurements도 삭제
        // 부모 컴포넌트에 삭제 이벤트 발생
        this.$emit('delete-measurements', itemIdsToDelete);

        // 삭제 후 화면 갱신
        this.render();
      }
    },
    checkIntersection(line1Start, line1End, line2Start, line2End) {
      // 두 선분의 교차점을 확인하는 함수
      const x1 = line1Start.x;
      const y1 = line1Start.y;
      const x2 = line1End.x;
      const y2 = line1End.y;
      const x3 = line2Start.x;
      const y3 = line2Start.y;
      const x4 = line2End.x;
      const y4 = line2End.y;

      // 두 선분의 방정식을 연립하여 교차점 계산
      const denominator = ((x1 - x2) * (y3 - y4)) - ((y1 - y2) * (x3 - x4));
      if (denominator === 0) return false; // 평행한 경우

      const t = (((x1 - x3) * (y3 - y4)) - ((y1 - y3) * (x3 - x4))) / denominator;
      const u = -(((x1 - x2) * (y1 - y3)) - ((y1 - y2) * (x1 - x3))) / denominator;

      // 교차점이 두 선분 위에 있는지 확인
      return (t >= 0 && t <= 1 && u >= 0 && u <= 1);
    },
    initializeMeasurements() {
      // measurements prop을 무시하고 항상 빈 배열로 초기화
      // 실제 측정 데이터는 segmentedMeasurements에서 관리
      this.measurements = [];
      console.log('[initializeMeasurements] measurements prop 무시, 빈 배열로 초기화');
      console.log('[initializeMeasurements] 실제 데이터는 segmentedMeasurements에서 관리됩니다.');
    },
    
    // 측정 결과 초기화 메서드 (MSA5 프로세스 시작 시 호출)
    clearMeasurements() {
      // console.log('[clearMeasurements] 측정 결과 초기화 시작');
      
      try {
        // 내부 데이터만 초기화 (prop이 아닌 것들)
        this.segmentedMeasurements = [];
        this.defectMeasurements = [];
        this.referenceLines = [];
        this.activeReferenceLine = null;
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
        
        // 이력 초기화
        this.undoHistory = [];
        this.redoHistory = [];
        
        // console.log('[clearMeasurements] 측정 결과 초기화 완료');
        
        // 부모 컴포넌트에 측정 결과 초기화 이벤트 발생
        this.$emit('measurements-cleared');
        
        // 테이블 데이터 초기화를 위한 이벤트 발생
        this.$nextTick(() => {
          // 측정 결과 테이블 업데이트를 위한 이벤트 발생
          window.dispatchEvent(new CustomEvent('msa6-measurements-cleared'));
          
          // 캔버스 초기화 (다음 이미지 로드 시 자동으로 다시 그려짐)
          if (this.ctx) {
            // console.log('[clearMeasurements] 캔버스 초기화');
            this.render();
          }
        });
        
        // 사용자에게 알림
        this.showNotification('MSA5 프로세스 시작으로 인해 측정 결과가 초기화되었습니다.', 'info');
      } catch (error) {
        console.error('[clearMeasurements] 측정 결과 초기화 중 오류:', error);
      }
    },
    
    // MSA5 프로세스 시작 이벤트 핸들러
    handleMSA5ProcessStart(event) {
      // console.log('[handleMSA5ProcessStart] MSA5 프로세스 시작 이벤트 수신');
      
      try {
        // 이벤트 데이터 확인
        const data = event.detail;
        
        if (data && data.action === 'clear_measurements') {
          // console.log('[handleMSA5ProcessStart] 측정 결과 초기화 요청 수신');
          
          // 측정 결과 초기화
          this.clearMeasurements();
          
          // 삭제 모드 비활성화
          if (this.isDeleteMode) {
            // console.log('[handleMSA5ProcessStart] 삭제 모드 비활성화');
            this.isDeleteMode = false;
            this.deleteStart = null;
            this.deleteEnd = null;
          }
          
          // 측정 모드를 선 측정 모드로 변경
          // console.log('[handleMSA5ProcessStart] 측정 모드를 선 측정 모드로 변경');
          this.measurementMode = 'line';
          
          // 이전 측정 모드도 선 측정으로 설정
          this.previousMeasurementMode = 'line';
          
          // 캔버스 재렌더링
          if (this.ctx) {
            this.render();
          }
          
          // console.log('[handleMSA5ProcessStart] MSA5 프로세스 시작 처리 완료 - 삭제 모드 비활성화, 선 측정 모드로 변경');
        }
      } catch (error) {
        console.error('[handleMSA5ProcessStart] MSA5 프로세스 시작 이벤트 처리 중 오류:', error);
      }
    },
    // 전후 이미지 전환 메서드 추가
    toggleBeforeAfterImage() {
      try {
        // console.log('[toggleBeforeAfterImage] 전후 이미지 전환 시작');
        
        // MSA5의 시작 이미지 URL 가져오기
        const startImageUrl = sessionStorage.getItem('msa5_start_image_url');
        
        if (!startImageUrl) {
          this.showNotification('처리 전 이미지를 찾을 수 없습니다.', 'error');
          console.error('[toggleBeforeAfterImage] MSA5 시작 이미지 URL이 없음');
          return;
        }
        
        // 현재 표시 중인 이미지가 시작 이미지인지 확인
        const currentImageUrl = this.isShowingInputImage ? this.internalInputImageUrl : this.outputImageUrl;
        const isCurrentlyShowingStart = currentImageUrl === startImageUrl;
        
        if (isCurrentlyShowingStart) {
          // 현재 시작 이미지를 보고 있다면 처리 후 이미지로 전환
          this.isShowingInputImage = false;
          this.showNotification('처리 후 이미지로 전환되었습니다.', 'info');
          // console.log('[toggleBeforeAfterImage] 처리 후 이미지로 전환');
        } else {
          // 현재 처리 후 이미지를 보고 있다면 시작 이미지로 전환
          this.isShowingInputImage = true;
          this.internalInputImageUrl = startImageUrl;
          this.showNotification('처리 전 이미지로 전환되었습니다. (측정 결과는 유지됩니다)', 'info');
          // console.log('[toggleBeforeAfterImage] 처리 전 이미지로 전환');
        }
        
        // 이미지 다시 로드 및 렌더링
        this.$nextTick(() => {
          this.render();
        });
        
      } catch (error) {
        console.error('[toggleBeforeAfterImage] 전후 이미지 전환 중 오류:', error);
        this.showNotification('이미지 전환 중 오류가 발생했습니다.', 'error');
      }
    },

    /**
     * Blob URL을 Base64 데이터 URL로 변환하는 헬퍼 메서드
     */
    async blobToBase64(blobUrl) {
      try {
        // 이미 data URL이면 변환하지 않음
        if (blobUrl.startsWith('data:')) {
          console.log('이미 Data URL 형식입니다. 변환 불필요.');
          return blobUrl;
        }
        
        console.log('Blob URL을 Base64로 변환 시작:', blobUrl.substring(0, 50) + '...');
        const response = await fetch(blobUrl);
        
        if (!response.ok) {
          throw new Error(`Blob URL 가져오기 실패: ${response.status}`);
        }
        
        const blob = await response.blob();
        console.log('Blob 정보:', {
          type: blob.type,
          size: blob.size + ' bytes'
        });
        
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result;
            console.log('Base64 변환 완료, 길이:', result.length);
            resolve(result);
          };
          reader.onerror = (e) => {
            console.error('FileReader 오류:', e);
            reject(new Error('이미지 읽기 오류'));
          };
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        console.error('Base64 변환 중 오류:', error);
        // 오류 발생 시 빈 문자열 반환
        return '';
      }
    }
  },
  created() {
    // 이미지 URL을 로컬 변수에 복사 (prop과 분리)
    this.localImageUrl = this.imageUrl;
  },
  created() {
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
/* 이미지 전환 및 다운로드 버튼 스타일 */
.image-toggle-controls {
  position: fixed;
  bottom: 30px;
  right: 30px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 1000;
}

.toggle-image-btn,
.download-image-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  min-width: 120px;
  justify-content: center;
}

.toggle-image-btn:hover,
.download-image-btn:hover {
  background: rgba(0, 0, 0, 0.9);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
}

.toggle-image-btn:active,
.download-image-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.toggle-image-btn i,
.download-image-btn i {
  font-size: 16px;
}

/* 다운로드 버튼 특별 스타일 */
.download-image-btn {
  background: rgba(76, 175, 80, 0.9);
}

.download-image-btn:hover {
  background: rgba(76, 175, 80, 1);
}
</style>


