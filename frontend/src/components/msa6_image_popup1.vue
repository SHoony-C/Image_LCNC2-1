<template>
  <div class="msa6-image-popup-container">
  <Teleport to="body">
      <div class="image-measurement-popup" @click.self="closePopup">
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
            <div class="image-toggle-controls" v-if="internalInputImageUrl && imageUrl">
              <button 
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
                title="현재 이미지 다운로드"
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
import LogService from '../utils/logService'
import TableNameSelector from './TableNameSelector.vue';
// 개별 함수를 직접 가져오기
import { patchDetectScaleBar, showScaleDetectionFailurePopup, createScaleChoicePopup } from '../utils/popupOverride';

// 분리된 유틸리티 파일들 import
import { imageHandlers } from '../utils/msa6_imageHandlers';
import { canvasHandlers } from '../utils/msa6_canvasHandlers';
import { measurementHandlers } from '../utils/msa6_measurementHandlers';
import { scaleBarHandlers } from '../utils/msa6_scaleBarHandlers';
import { keyboardHandlers } from '../utils/msa6_keyboardHandlers';
import { utilityHandlers } from '../utils/msa6_utilityHandlers';

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
      localMeasurements: [],
      segmentedMeasurements: [],
      nextId: 1,
      subItemPrefix: 'S',
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
      isVisible: true,
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
      // 스케일바 다이얼로그 관련 변수 추가
      showScaleBarDialog: false,
      tempScaleBarValue: 500,
      tempScaleBarUnit: 'nm'
    };
  },
  
  // 분리된 유틸리티 함수들을 methods에 병합
  methods: {
    // 안전한 함수 바인딩을 위한 헬퍼 함수
    safeBindMethods(handlers, handlerName) {
      const boundMethods = {};
      try {
        if (!handlers || typeof handlers !== 'object') {
          console.warn(`[safeBindMethods] ${handlerName} 핸들러가 유효하지 않음:`, handlers);
          return {};
        }
        
        Object.entries(handlers).forEach(([key, fn]) => {
          if (typeof fn === 'function') {
            boundMethods[key] = function(...args) {
              try {
                return fn.call(this, ...args);
    } catch (error) {
                console.error(`[${handlerName}:${key}] 함수 실행 중 오류:`, error);
                console.error(`[${handlerName}:${key}] 오류 스택:`, error.stack);
                throw error; // 오류를 다시 던져서 상위에서 처리할 수 있도록
              }
            };
        } else {
            console.warn(`[safeBindMethods] ${handlerName}.${key}는 함수가 아님:`, typeof fn);
          }
        });
      } catch (error) {
        console.error(`[safeBindMethods] ${handlerName} 바인딩 중 오류:`, error);
      }
      return boundMethods;
    },

    // 이미지 처리 관련 함수들을 Vue 컴포넌트 컨텍스트에 바인딩
    ...(() => {
      try {
        return Object.fromEntries(
          Object.entries(imageHandlers || {}).map(([key, fn]) => [key, function(...args) {
            try {
              return fn.call(this, ...args);
        } catch (error) {
              console.error(`[imageHandlers:${key}] 함수 실행 중 오류:`, error);
              throw error;
            }
          }])
        );
      } catch (error) {
        console.error('[methods] imageHandlers 바인딩 중 오류:', error);
        return {};
      }
    })(),
    
    // 캔버스 처리 관련 함수들을 Vue 컴포넌트 컨텍스트에 바인딩
    ...(() => {
      try {
        return Object.fromEntries(
          Object.entries(canvasHandlers || {}).map(([key, fn]) => [key, function(...args) {
            try {
              return fn.call(this, ...args);
        } catch (error) {
              console.error(`[canvasHandlers:${key}] 함수 실행 중 오류:`, error);
              throw error;
            }
          }])
        );
      } catch (error) {
        console.error('[methods] canvasHandlers 바인딩 중 오류:', error);
        return {};
      }
    })(),
    
    // 측정 관련 함수들을 Vue 컴포넌트 컨텍스트에 바인딩
    ...(() => {
      try {
        return Object.fromEntries(
          Object.entries(measurementHandlers || {}).map(([key, fn]) => [key, function(...args) {
            try {
              return fn.call(this, ...args);
        } catch (error) {
              console.error(`[measurementHandlers:${key}] 함수 실행 중 오류:`, error);
              throw error;
            }
          }])
        );
      } catch (error) {
        console.error('[methods] measurementHandlers 바인딩 중 오류:', error);
        return {};
      }
    })(),
    
    // 스케일바 관련 함수들을 Vue 컴포넌트 컨텍스트에 바인딩
    ...(() => {
      try {
        return Object.fromEntries(
          Object.entries(scaleBarHandlers || {}).map(([key, fn]) => [key, function(...args) {
            try {
              return fn.call(this, ...args);
        } catch (error) {
              console.error(`[scaleBarHandlers:${key}] 함수 실행 중 오류:`, error);
              throw error;
            }
          }])
        );
      } catch (error) {
        console.error('[methods] scaleBarHandlers 바인딩 중 오류:', error);
        return {};
      }
    })(),
    
    // 키보드 이벤트 관련 함수들을 Vue 컴포넌트 컨텍스트에 바인딩
    ...(() => {
      try {
        return Object.fromEntries(
          Object.entries(keyboardHandlers || {}).map(([key, fn]) => [key, function(...args) {
            try {
              return fn.call(this, ...args);
            } catch (error) {
              console.error(`[keyboardHandlers:${key}] 함수 실행 중 오류:`, error);
              throw error;
            }
          }])
        );
      } catch (error) {
        console.error('[methods] keyboardHandlers 바인딩 중 오류:', error);
        return {};
      }
    })(),
    
    // 유틸리티 함수들을 Vue 컴포넌트 컨텍스트에 바인딩
    ...(() => {
      try {
        return Object.fromEntries(
          Object.entries(utilityHandlers || {}).map(([key, fn]) => [key, function(...args) {
            try {
              return fn.call(this, ...args);
            } catch (error) {
              console.error(`[utilityHandlers:${key}] 함수 실행 중 오류:`, error);
              throw error;
            }
          }])
        );
      } catch (error) {
        console.error('[methods] utilityHandlers 바인딩 중 오류:', error);
        return {};
      }
    })(),

    // 누락된 필수 메서드들 추가
    closePopup() {
      console.log('[closePopup] 팝업 닫기');
      this.isVisible = false;
      this.$emit('close');
      this.$emit('update:showPopup', false);
    },

    openPopup() {
      console.log('[openPopup] 팝업 열기');
      this.isVisible = true;
      this.$emit('update:showPopup', true);
      
      // DOM 업데이트 후 강제로 표시 설정
      this.$nextTick(() => {
        const popupElement = this.$el;
        if (popupElement) {
          popupElement.style.display = 'block';
          popupElement.style.visibility = 'visible';
          console.log('[openPopup] 팝업 DOM 요소 강제 표시 설정 완료');
        }
        
        // 이미지가 있으면 로드
        if (this.imageUrl) {
          console.log('[openPopup] 이미지 로드 시작:', this.imageUrl);
          this.loadImage(this.imageUrl);
        }
      });
    },

    // 테이블 선택기 표시
    showTableSelector() {
      this.showTableSelectorPopup = true;
    },

    // 테이블명과 함께 저장
    saveWithTableName(tableName) {
      console.log('[saveWithTableName] 테이블명과 함께 저장:', tableName);
      this.showTableSelectorPopup = false;
      // 실제 저장 로직은 여기에 구현
    },

    // 행 선택 관련 메서드들
    handleRowMouseDown(segment, index) {
      // 행 선택 처리
    },

    handleRowMouseEnter(segment, index) {
      // 행 호버 처리
    },

    handleRowMouseUp() {
      // 행 선택 완료 처리
    },

    // 불량 감지 관련 메서드들
    handleDefectMouseDown(defect, index) {
      // 불량 행 선택 처리
    },

    handleDefectMouseEnter(defect, index) {
      // 불량 행 호버 처리
    },

    handleDefectMouseUp() {
      // 불량 행 선택 완료 처리
    },

    // 삭제 메서드들
    deleteSegment(segment) {
      const index = this.segmentedMeasurements.indexOf(segment);
      if (index > -1) {
        this.segmentedMeasurements.splice(index, 1);
      this.render();
      }
    },

    deleteDefect(defect) {
      const index = this.defectMeasurements.indexOf(defect);
      if (index > -1) {
        this.defectMeasurements.splice(index, 1);
        this.render();
      }
    },

    // ID 적용 메서드
    applySelectedIds() {
      console.log('[applySelectedIds] 선택된 행에 ID 적용');
      // ID 적용 로직
    },

    // 기준선 색상 선택
    selectReferenceColor(color) {
      this.referenceLineColor = color;
      this.showReferenceColorPicker = false;
    },

    // 스케일바 그리기 토글
    toggleScaleBarDrawing() {
      this.isDrawingScaleBar = !this.isDrawingScaleBar;
      if (this.isDrawingScaleBar) {
        this.measurementMode = 'scaleBar';
      } else {
        this.measurementMode = 'line';
      }
    },

    // 선택 영역 API 전송
    sendSelectedAreaToApi() {
      console.log('[sendSelectedAreaToApi] 선택 영역 API 전송');
      // API 전송 로직
    }
  },
  
  mounted() {
    try {
      console.log('[mounted] 컴포넌트 마운트됨');
      
      // 페이지 새로고침 시 수동 스케일바 설정 항상 초기화
      this.manualScaleBarSet = false;
      console.log('[mounted] 수동 스케일바 설정 초기화: manualScaleBarSet = false');
      
      // prop에서 내부 데이터 초기화
      this.internalInputImageUrl = this.inputImageUrl;
      
      // 키보드 이벤트 리스너 등록
      if (typeof this.setupKeyboardListeners === 'function') {
        this.setupKeyboardListeners();
        } else {
        console.warn('[mounted] setupKeyboardListeners 함수를 찾을 수 없음');
      }
      
      // 윈도우 리사이즈 이벤트 리스너 등록
      if (typeof this.onWindowResize === 'function') {
        window.addEventListener('resize', this.onWindowResize);
      } else {
        console.warn('[mounted] onWindowResize 함수를 찾을 수 없음');
      }
      
      // MSA5 이미지 처리 완료 이벤트 리스너 등록
      if (typeof this.handleMSA5ImageProcessed === 'function') {
        window.addEventListener('msa5-image-processed', this.handleMSA5ImageProcessed);
        window.addEventListener('msa6:imageProcessed', this.handleMSA5ImageProcessed);
          } else {
        console.warn('[mounted] handleMSA5ImageProcessed 함수를 찾을 수 없음');
      }
      
      // 최초 로드 시에만 초기화 플래그 설정
      if (!this.initialLoadDone) {
        this.$_isInitialLoad = true;
        this.isFirstDetectionAttempt = true;
        console.log('[mounted] 최초 로드, 초기화 플래그 설정');

        // 이미 스케일바 값이 있는지 확인 (수동 설정 여부는 고려하지 않음)
        const hasScaleBarValues = this.scaleBarValue && this.scaleBarUnit;

        // 스케일바 모드인 경우 스케일바 값이 없을 때만 팝업 표시 - showPopup이 true일 때만 진행
        if (this.scaleMethod === 'scaleBar' && this.showPopup && !hasScaleBarValues) {
          console.log('[mounted] 스케일바 모드로 첫 마운트, 팝업 표시 시도');
          // 팝업 표시를 위한 플래그 설정
      this.showScaleChoicePopup = true;
      
          // 직접 DOM에 팝업 생성
          setTimeout(() => {
            try {
              if (typeof showScaleDetectionFailurePopup === 'function') {
                showScaleDetectionFailurePopup(this);
              } else {
                console.error('[mounted] showScaleDetectionFailurePopup 함수를 찾을 수 없음');
                // 대체 처리: Vue 컴포넌트 내장 팝업 사용
                this.showScaleChoicePopup = true;
              }
              
              // 내장 팝업도 가시성 확보
      this.$nextTick(() => {
                try {
          const popupElement = document.querySelector('.scale-choice-popup');
          if (popupElement) {
                    console.log('[mounted] 팝업 요소에 스타일 직접 적용');
            popupElement.style.display = 'flex';
            popupElement.style.zIndex = '999999';
                  }
      } catch (e) {
                  console.error('[mounted] 팝업 스타일 적용 중 오류:', e);
                }
              });
            } catch (e) {
              console.error('[mounted] showScaleDetectionFailurePopup 호출 중 오류:', e);
              console.error('[mounted] 오류 상세:', e.message, e.stack);
              
              // 오류 발생 시 대체 처리
              try {
                this.showScaleChoicePopup = true;
                console.log('[mounted] 대체 팝업 표시 완료');
              } catch (fallbackError) {
                console.error('[mounted] 대체 팝업 표시 중에도 오류:', fallbackError);
              }
            }
          }, 100);
                } else {
          console.log('[mounted] 스케일바 모드가 아니거나 이미 값이 있어 팝업 표시하지 않음');
        }
      }
      
      // 이미지 URL이 있으면 로드
      if (this.imageUrl) {
        if (typeof this.loadImage === 'function') {
          this.loadImage(this.imageUrl);
            } else {
          console.warn('[mounted] loadImage 함수를 찾을 수 없음');
        }
      }
      
      // 저장된 스케일바 설정 복원
      if (typeof this.restoreScaleBarSettings === 'function') {
        this.restoreScaleBarSettings();
      } else {
        console.warn('[mounted] restoreScaleBarSettings 함수를 찾을 수 없음');
      }
      
      // 팝업 오버라이드 패치 적용
      if (typeof patchDetectScaleBar === 'function') {
        patchDetectScaleBar();
        } else {
        console.warn('[mounted] patchDetectScaleBar 함수를 찾을 수 없음');
      }
      
      // 컴포넌트를 전역에 노출 (디버깅용)
      window.imageMeasurement = this;
      console.log('[mounted] 컴포넌트를 전역에 노출 (window.imageMeasurement)');
      
      // 전역 오류 핸들러 설정 (디버깅용)
      const originalErrorHandler = window.onerror;
      window.onerror = (message, source, lineno, colno, error) => {
        console.error('[전역 오류 핸들러] 오류 발생:');
        console.error('- 메시지:', message);
        console.error('- 소스:', source);
        console.error('- 라인:', lineno);
        console.error('- 컬럼:', colno);
        console.error('- 오류 객체:', error);
        
        if (originalErrorHandler) {
          return originalErrorHandler(message, source, lineno, colno, error);
        }
        return false;
      };
      
      // Promise rejection 핸들러 설정
      const originalUnhandledRejection = window.onunhandledrejection;
      window.onunhandledrejection = (event) => {
        console.error('[Promise rejection 핸들러] 처리되지 않은 Promise 거부:');
        console.error('- 이유:', event.reason);
        console.error('- Promise:', event.promise);
        
        if (originalUnhandledRejection) {
          return originalUnhandledRejection(event);
        }
      };
      
    } catch (error) {
      console.error('[mounted] 컴포넌트 마운트 중 오류 발생:', error);
      console.error('[mounted] 오류 스택:', error.stack);
      
      // 오류 정보를 더 자세히 로그
      if (error.name) console.error('[mounted] 오류 이름:', error.name);
      if (error.message) console.error('[mounted] 오류 메시지:', error.message);
      if (error.fileName) console.error('[mounted] 오류 파일:', error.fileName);
      if (error.lineNumber) console.error('[mounted] 오류 라인:', error.lineNumber);
    }
  },
  
  beforeUnmount() {
    try {
      console.log('[beforeUnmount] 컴포넌트 언마운트 시작');
      
      // 키보드 이벤트 리스너 제거
      if (typeof this.removeKeyboardListeners === 'function') {
        this.removeKeyboardListeners();
      } else {
        console.warn('[beforeUnmount] removeKeyboardListeners 함수를 찾을 수 없음');
      }
      
      // 윈도우 리사이즈 이벤트 리스너 제거
      if (typeof this.onWindowResize === 'function') {
        window.removeEventListener('resize', this.onWindowResize);
      } else {
        console.warn('[beforeUnmount] onWindowResize 함수를 찾을 수 없음');
      }
      
      // MSA5 이미지 처리 완료 이벤트 리스너 제거
      if (typeof this.handleMSA5ImageProcessed === 'function') {
        window.removeEventListener('msa5-image-processed', this.handleMSA5ImageProcessed);
        window.removeEventListener('msa6:imageProcessed', this.handleMSA5ImageProcessed);
      } else {
        console.warn('[beforeUnmount] handleMSA5ImageProcessed 함수를 찾을 수 없음');
      }
      
      // 이미지 URL 정리
      if (typeof this.cleanupImageUrls === 'function') {
        this.cleanupImageUrls();
      } else {
        console.warn('[beforeUnmount] cleanupImageUrls 함수를 찾을 수 없음');
      }
      
      // 전역 참조 정리
      if (window.imageMeasurement === this) {
        window.imageMeasurement = null;
      }
      
      console.log('[beforeUnmount] 컴포넌트 언마운트 완료');
      
      } catch (error) {
      console.error('[beforeUnmount] 컴포넌트 언마운트 중 오류 발생:', error);
      console.error('[beforeUnmount] 오류 스택:', error.stack);
    }
  },
  
  watch: {
    showPopup: {
      immediate: true,
      handler(newVal) {
        console.log('[watch:showPopup] showPopup 변경:', newVal);
        this.isVisible = newVal;
        
        if (newVal && this.imageUrl) {
      this.$nextTick(() => {
            this.loadImage(this.imageUrl);
          });
        }
      }
    },
    
    imageUrl: {
      immediate: true,
      handler(newVal) {
        console.log('[watch:imageUrl] imageUrl 변경:', newVal);
        if (newVal && this.isVisible) {
          this.loadImage(newVal);
        }
      }
    },
    
    inputImageUrl: {
      immediate: true,
      handler(newVal) {
        console.log('[watch:inputImageUrl] inputImageUrl 변경:', newVal);
        this.internalInputImageUrl = newVal;
      }
    },
    
    scaleMethod(newVal) {
      console.log(`[watch:scaleMethod] 측정 방식 변경: ${newVal}`);
      this.saveScaleBarSettings();
    },
    
    scaleBarValue(newVal) {
      console.log(`[watch:scaleBarValue] 스케일바 값 변경: ${newVal}`);
      this.saveScaleBarSettings();
      this.updateAllMeasurements();
    },
    
    scaleBarUnit(newVal) {
      console.log(`[watch:scaleBarUnit] 스케일바 단위 변경: ${newVal}`);
      this.saveScaleBarSettings();
      this.updateAllMeasurements();
    },
    
    magnification(newVal) {
      console.log(`[watch:magnification] 배율 변경: ${newVal}`);
      this.saveScaleBarSettings();
      this.updateAllMeasurements();
    }
  },
  
  computed: {
    // 필터링된 측정값 반환
    filteredMeasurements() {
      return this.segmentedMeasurements || [];
    },

    brightnessTooltipStyle() {
      return {
        left: `${this.currentMousePos.x + 10}px`,
        top: `${this.currentMousePos.y - 30}px`
      };
    },
    
    magnifierStyle() {
      return {
        left: `${this.currentMousePos.x + 20}px`,
        top: `${this.currentMousePos.y + 20}px`
      };
    }
  }
}
</script>

<style scoped>
@import '../styles/msa6_image_popup1.css';
</style>

