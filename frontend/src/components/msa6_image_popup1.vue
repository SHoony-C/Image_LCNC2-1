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
          :class="['notification', notification.type]">
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
import PopupDebug from '../utils/popupDebug';
// 개별 함수를 직접 가져오기
import { patchDetectScaleBar, showScaleDetectionFailurePopup, createScaleChoicePopup } from '../utils/popupOverride';

export default {
  name: 'MSA6ImagePopup',
  props: {
    imageUrl: {
      type: String,
      required: true
    },
    inputImageUrl: {
      type: String,
      default: null
    },
    showPopup: {
      type: Boolean,
      default: false
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
      measurements: [],
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
    };
  },
  mounted() {
    console.log('[mounted] 컴포넌트 마운트됨');
    
    // 페이지 새로고침 시 수동 스케일바 설정 항상 초기화
    this.manualScaleBarSet = false;
    console.log('[mounted] 수동 스케일바 설정 초기화: manualScaleBarSet = false');
    
    // prop에서 내부 데이터 초기화
    this.internalInputImageUrl = this.inputImageUrl;
    
    // 이벤트 리스너 등록
    window.addEventListener('resize', this.onWindowResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    
    // MSA5 이미지 처리 완료 이벤트 리스너 등록
    window.addEventListener('msa5-image-processed', this.handleMSA5ImageProcessed);
    window.addEventListener('msa6:imageProcessed', this.handleMSA5ImageProcessed);
    
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
          this.showScaleDetectionFailurePopup();
          
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
        }, 100);
      } else if (hasScaleBarValues) {
        console.log('[mounted] 스케일바 값이 있어 팝업 표시하지 않음:', 
          'scaleBarValue:', this.scaleBarValue, 
          'scaleBarUnit:', this.scaleBarUnit,
          'manualScaleBarSet:', this.manualScaleBarSet);
      }
    } else {
      console.log('[mounted] 재마운트, 측정 데이터 유지');
    }
    
    // 디버깅용 전역 변수 설정
    window.imageMeasurement = this;
    console.log('Component mounted. Use window.imageMeasurement to access component in console');
    
    // 플래그 초기값 로깅
    console.log('[mounted] 초기 상태 - showScaleChoicePopup:', this.showScaleChoicePopup);
    console.log('[mounted] 초기 상태 - isFirstDetectionAttempt:', this.isFirstDetectionAttempt);
    console.log('[mounted] 초기 상태 - scaleMethod:', this.scaleMethod);
    console.log('[mounted] 초기 상태 - showPopup:', this.showPopup);
    
    // 디버깅 유틸리티 설정
    window.popupDebug = PopupDebug;
    console.log('팝업 디버깅 유틸리티가 콘솔에 window.popupDebug로 노출되었습니다.');
    
    // 팝업 오버라이드 함수 전역으로 노출
    window.showScalePopup = () => this.showScaleDetectionFailurePopup();
    
    // detectScaleBar 함수 패치
    setTimeout(() => {
      console.log('[mounted] 팝업 오버라이드 시스템 적용 시도');
      const patchResult = patchDetectScaleBar(this);
      console.log('[mounted] 패치 결과:', patchResult);
      
      // 스케일바 자동 감지 시도 (이미 이미지가 로드된 경우) - showPopup이 true일 때만 진행
      if (this.image && this.imageData && this.scaleMethod === 'scaleBar' && this.showPopup && !this.initialLoadDone) {
        console.log('[mounted] 이미지 로드됨, 스케일바 감지 시도');
        this.detectScaleBar();
      }
    }, 500);
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.onWindowResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    
    // MSA5 이미지 처리 완료 이벤트 리스너 제거
    window.removeEventListener('msa5-image-processed', this.handleMSA5ImageProcessed);
    window.removeEventListener('msa6:imageProcessed', this.handleMSA5ImageProcessed);
  },
  computed: {
    filteredMeasurements() {
      // 먼저 전체 측정값 로깅
      console.log(`[filteredMeasurements] 모든 세그먼트 측정값: ${this.segmentedMeasurements.length}개`);
      
      // 각 측정값 카테고리별 수 계산
      const brightCount = this.segmentedMeasurements.filter(s => s.isBright).length;
      const darkCount = this.segmentedMeasurements.filter(s => !s.isBright).length;
      const totalCount = this.segmentedMeasurements.filter(s => s.isTotal).length;
      
      console.log(`[filteredMeasurements] 측정값 카테고리: 밝은 영역=${brightCount}, 어두운 영역=${darkCount}, 전체 선=${totalCount}`);
      
      // 원래 필터링 로직에 isTotal이 아닌 항목만 포함하도록 수정
      const filtered = this.segmentedMeasurements.filter(segment => 
        (this.isReversed ? !segment.isBright : segment.isBright) && !segment.isTotal
      );
      
      console.log(`[filteredMeasurements] 필터링된 측정값: ${filtered.length}개`);
      
      // 필터링된 측정값의 ID와 값 간략히 로깅
      filtered.forEach((segment, idx) => {
        if (idx < 10 || idx >= filtered.length - 5) { // 처음 10개와 마지막 5개만 로깅
          console.log(`  측정값 #${idx+1}: ID=${segment.itemId}, SubID=${segment.subItemId}, 값=${segment.value?.toFixed(2)}`);
        } else if (idx === 10) {
          console.log(`  ... 중간 ${filtered.length - 15}개 생략 ...`);
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
          console.log('[watch:imageUrl] 이미지 URL 변경:', newUrl);
          this.$nextTick(() => {
            this.loadImage(newUrl);
            
            // 이미지 로드 후 스케일바 감지 시도 (지연 적용)
            if (this.scaleMethod === 'scaleBar') {
              setTimeout(() => {
                console.log('[watch:imageUrl] 이미지 URL 변경 후 스케일바 감지 시도');
                this.detectScaleBar();
              }, 1000);
            }
          });
        } else {
          // imageUrl이 없는 경우 이미지 초기화 (추가)
          console.log('[watch:imageUrl] 이미지 URL 없음, 이미지 초기화');
          this.clearImage();
        }
      }
    },
    // inputImageUrl prop 변경 감지
    inputImageUrl: {
      immediate: true,
      handler(newUrl) {
        console.log('[watch:inputImageUrl] 입력 이미지 URL 변경:', newUrl);
        if (newUrl) {
          // 내부 데이터 속성 업데이트
          this.internalInputImageUrl = newUrl;
          console.log('[watch:inputImageUrl] 내부 입력 이미지 URL 업데이트됨');
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
        console.log('[watch:showPopup] 팝업 표시 상태 변경:', newVal);
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
          console.log('[watch:showPopup] 팝업 닫힘, 데이터 유지');
          // closePopup은 호출하지 않음 - 사용자가 닫기 버튼을 통해 닫을 때만 호출됨
        }
      }
    },
    // 스케일바 감지 상태 감시
    scaleBarDetected: {
      handler(detected) {
        console.log('[watch:scaleBarDetected] 스케일바 감지 상태 변경:', detected);
        
        // 자동 감지 시 수동 설정 플래그를 변경하지 않도록 수정
        // 스케일바가 감지되었을 때 manualScaleBarSet을 true로 설정하지 않음
        if (detected) {
          console.log('[watch:scaleBarDetected] 스케일바가 감지됨, 설정 저장');
          
          // 설정 즉시 저장
          this.saveScaleBarSettings();
          
          // 팝업 플래그 명시적으로 false로 설정
          this.showScaleChoicePopup = false;
          return;
        }
        
        // 이미 수동 스케일바가 설정되어 있는 경우 팝업 표시하지 않음 - 조건 강화
        if (this.manualScaleBarSet && this.scaleBarValue && this.scaleBarUnit) {
          console.log('[watch:scaleBarDetected] 수동 스케일바가 이미 설정되어 있어 팝업을 표시하지 않음:',
            'manualScaleBarSet:', this.manualScaleBarSet,
            'scaleBarValue:', this.scaleBarValue,
            'scaleBarUnit:', this.scaleBarUnit);
          
          // 팝업 플래그 명시적으로 false로 설정
          this.showScaleChoicePopup = false;
          return;
        }
        
        // 감지 실패 시 팝업 표시 (수동 설정이 없는 경우에만)
        if (!detected && this.scaleMethod === 'scaleBar') {
          console.log('[watch:scaleBarDetected] 감지 실패, 선택 팝업 표시');
          
          // 세션 스토리지에서 팝업 자동 표시 방지 플래그 확인
          const noAutoPopup = sessionStorage.getItem('msa6_no_auto_popup') === 'true';
          
          if (!noAutoPopup) {
            // 팝업 표시
          this.showScaleChoicePopup = true;
            this.showScaleDetectionFailurePopup();
          this.showNotification('스케일바 자동 감지에 실패했습니다. 측정 방식을 선택해주세요.', 'warning');
          } else {
            console.log('[watch:scaleBarDetected] 자동 팝업 방지 플래그가 설정되어 있어 팝업을 표시하지 않음');
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
    async loadImage(url) {
      console.log('[loadImage] 이미지 로드 시작:', url);
      
      if (!url) {
        console.error('[loadImage] 유효한 URL이 제공되지 않음');
        return;
      }
      
      // 이미지 URL 설정
      this.outputImageUrl = url;
        
      // 이전 이미지 제거
      if (this.image) {
        // this.image.src = ''; // 이전 이미지 로드 취소
        console.log('[loadImage] 이전 이미지 정리');
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
        console.log('[loadImage] 유효한 수동 스케일바 설정 확인:', 
          'scaleBarValue:', this.scaleBarValue, 
          'scaleBarUnit:', this.scaleBarUnit);
        this.scaleBarDetected = true;
      }
      
      // 비동기로 이미지 로드 처리
      this.image.onload = async () => {
          console.log('[loadImage] 이미지 로드 완료');
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
        console.log('[loadImage] 수동 스케일바 설정 상태 확인:', 
          'manualScaleBarSet:', this.manualScaleBarSet, 
          'scaleBarValue:', this.scaleBarValue, 
          'scaleBarUnit:', this.scaleBarUnit,
          '유효한 설정:', hasValidManualScaleBar);
        
        // ⚠️ 주의: 이 부분은 MSA5 프로세스 시작 시 스케일바 팝업 방지를 위한 핵심 로직입니다. 수정 시 주의하세요! ⚠️
        // 스케일바 자동 감지 팝업 방지 플래그 확인
        const noScalePopup = sessionStorage.getItem('msa6_no_scale_popup') === 'true';
        if (noScalePopup) {
          console.log('[loadImage] 스케일바 자동 감지 팝업 방지 플래그가 설정되어 있어 팝업을 표시하지 않음');
          // 플래그 제거 (일회성)
          sessionStorage.removeItem('msa6_no_scale_popup');
          return;
        }
        
        // 수동 스케일바가 설정되어 있고 유효한 경우 팝업 표시하지 않음
        if (hasValidManualScaleBar) {
          console.log('[loadImage] 유효한 수동 스케일바가 이미 설정되어 있어 팝업 표시하지 않음');
        }
        // 스케일바 모드이고 수동 설정이 안 된 경우에만 자동 감지 시도
        else if (this.scaleMethod === 'scaleBar' && this.showPopup) {
          console.log('[loadImage] 스케일바 자동 감지 시도');
        // 약간의 지연 후 detectScaleBar 호출 (DOM이 완전히 업데이트되도록)
        setTimeout(() => {
            // 자동 감지 실행 - 감지 성공 여부는 detectScaleBar 내에서 처리
            this.detectScaleBar(true); // true = 감지 실패 시 팝업 표시 강제
        }, 300);
        } else {
          console.log('[loadImage] 자동 감지 미실행:', 
            '방식:', this.scaleMethod, 
            '팝업표시:', this.showPopup, 
            '수동설정여부:', this.manualScaleBarSet);
      }
      
      // 이미지가 로드된 후 기존 측정값 렌더링
      if (this.initialLoadDone && this.measurements.length > 0) {
        console.log('[loadImage] 기존 측정값 렌더링');
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
      
      console.log('[handleImageLoad] 이미지 로드 완료 - 크기:', img.naturalWidth, 'x', img.naturalHeight);
      this.image = img;
      
      // 전환 중인지 확인 (toggleBeforeAfterImage에서 호출된 경우)
      const isToggling = this.isToggling;
      if (isToggling) {
        console.log('[handleImageLoad] 이미지 전환 중, 측정 데이터 유지');
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
      console.log('[handleImageLoad] 수동 스케일바 설정 상태 확인:', 
        'manualScaleBarSet:', this.manualScaleBarSet, 
        'scaleBarValue:', this.scaleBarValue, 
        'scaleBarUnit:', this.scaleBarUnit);
      
      // 스케일바 자동 감지 팝업 방지 플래그 확인
      const noScalePopup = sessionStorage.getItem('msa6_no_scale_popup') === 'true';
      if (noScalePopup) {
        console.log('[handleImageLoad] 스케일바 자동 감지 팝업 방지 플래그가 설정되어 있어 팝업을 표시하지 않음');
        // 플래그 제거 (일회성)
        sessionStorage.removeItem('msa6_no_scale_popup');
        return;
      }
      
      // 스케일바 모드이고 수동 스케일바가 설정되어 있지 않은 경우에만 팝업 표시
      if (this.scaleMethod === 'scaleBar' && this.showPopup && 
          !(this.manualScaleBarSet && this.scaleBarValue && this.scaleBarUnit)) {
          console.log('[handleImageLoad] 스케일바 모드, 수동 스케일바 없음, 선택 팝업 표시');
          
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
                  console.log('[handleImageLoad] 팝업 요소에 스타일 직접 적용');
                  popupElement.style.display = 'flex';
                  popupElement.style.zIndex = '999999';
                }
              } catch (e) {
                console.error('[handleImageLoad] 팝업 스타일 적용 중 오류:', e);
              }
            });
          }, 100);
        } else {
          console.log('[handleImageLoad] 수동 스케일바가 이미 설정되어 있어 팝업 표시하지 않음:', 
          this.scaleBarValue, this.scaleBarUnit, 'manualScaleBarSet:', this.manualScaleBarSet);
      }
      
      // 스케일바 자동 감지 시도 - 최초 로드 시에만 시도, 그리고 수동 스케일바가 없는 경우에만
      if (this.scaleMethod === 'scaleBar' && !this.initialLoadDone && 
          !(this.manualScaleBarSet && this.scaleBarValue && this.scaleBarUnit)) {
        console.log('[handleImageLoad] 이미지 로드 완료, 스케일바 감지 시도, 초기 로드 상태:', this.$_isInitialLoad);
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
      console.log('[updateCanvasSize] 캔버스 크기 조정 시작');
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
      
      console.log(`[updateCanvasSize] 이미지 크기: ${imgWidth}x${imgHeight}, 컨테이너 크기: ${container.clientWidth}x${container.clientHeight}`);
      
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
      
      console.log('[updateCanvasSize] 캔버스 크기 조정 완료');
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
        
        console.log(`[calculateValue] 스케일바 기반 계산: 
          거리=${distance.toFixed(4)} 픽셀,
          스케일바=${scaleBarPixelLength.toFixed(2)} 픽셀 = ${this.scaleBarValue} ${this.scaleBarUnit},
          비율=${(scaleBarRealLength / scaleBarPixelLength).toFixed(4)} ${this.scaleBarUnit === 'μm' ? 'nm' : this.scaleBarUnit}/픽셀,
          최종값=${value.toFixed(2)} nm`);
      } else {
        // 배율 기반 측정 (기존 코드)
        value = distance * this.magnification;
        
        console.log(`[calculateValue] 배율 기반 계산: 
        시작점=(${startX.toFixed(2)}, ${startY.toFixed(2)}), 
        끝점=(${endX.toFixed(2)}, ${endY.toFixed(2)}), 
        dx=${dx.toFixed(2)}, dy=${dy.toFixed(2)}, 
        거리=${distance.toFixed(4)},
        배율=${this.magnification}, 
        최종값=${value.toFixed(2)}`);
      }
      
      // 결과값을 그대로 반환 (반올림하지 않음)
      return value;
    },
    startMeasurement(e) {
      if (this.isAreaSelectionMode) {
        const pos = this.getLocalPos(e);
        this.areaSelectionStart = pos;
        this.areaSelectionEnd = pos;
        this.isMeasuring = true;
        this.render();
        return;
      }

      // 수동 스케일바 그리기 모드인 경우
      if (this.isDrawingScaleBar) {
        e.preventDefault();
        e.stopPropagation();
        const pos = this.getLocalPos(e);
        
        // 스케일바 측정 시작
        this.currentMeasurement = {
          start: {...pos},
          end: {...pos},
          isScaleBar: true
        };
        
        this.isMeasuring = true;
        this.render();
        return;
      }

      // 기존 측정 로직
      e.preventDefault();
      e.stopPropagation();
      const pos = this.getLocalPos(e);

      this.debugInfo.lastAction = `시작: ${this.measurementMode} 모드에서 측정 시작 (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)})`;
      console.log(this.debugInfo.lastAction);
      
      // 측정 시작 시 로깅 추가
      console.log(`[startMeasurement] 모드: ${this.measurementMode}, 기준선 있음: ${!!this.activeReferenceLine}, 위치: (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)})`);

      if (this.measurementMode === 'reference') {
        // 기준선 측정 시작
        this.currentMeasurement = {
          start: {...pos},
          end: {...pos},
          itemId: 'ref-' + this.referenceLines.length,
          subItemId: 'reference',
          value: 0,
          isReference: true,
          brightness: this.calculateBrightness(pos.x, pos.y),
          color: this.referenceLineColor // 선택된 색상 저장
        };
        console.log('기준선 측정 시작', JSON.stringify(this.currentMeasurement));
      } else if (this.measurementMode === 'line') {
        this.currentMeasurement = {
          start: {...pos},
          end: {...pos},
          itemId: this.nextId.toString(),
          subItemId: `${this.nextId}-${this.subItemPrefix}1`,
          value: 0,
          brightness: this.calculateBrightness(pos.x, pos.y)
        };
      } else if (this.measurementMode === 'circle') {
        this.areaStart = {...pos};
        this.areaEnd = {...pos};
      } else {
        this.areaStart = {...pos};
        this.areaEnd = {...pos};
      }
      
      this.isMeasuring = true;
      this.render();
    },
    updateMeasurement(e) {
      if (!this.isMeasuring) return;
      
      if (this.isAreaSelectionMode) {
        const pos = this.getLocalPos(e);
        this.areaSelectionEnd = pos;
        this.render();
        return;
      }

      // 수동 스케일바 그리기 모드인 경우
      if (this.isDrawingScaleBar && this.currentMeasurement) {
        const pos = this.getLocalPos(e);
        this.currentMeasurement.end = {...pos};
        this.render();
        return;
      }

      // 기존 측정 업데이트 로직
      const pos = this.getLocalPos(e);

      // 측정 업데이트 시 로깅 추가 - 너무 많은 로그를 방지하기 위해 샘플링
      if (Math.random() < 0.05) { // 5%의 확률로 로그 출력
        console.log(`[updateMeasurement] 모드: ${this.measurementMode}, 기준선 있음: ${!!this.activeReferenceLine}, 위치: (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)})`);
      }

      if ((this.measurementMode === 'line' || this.measurementMode === 'reference') && this.currentMeasurement) {
        this.currentMeasurement.end = {...pos};
        
        // 실시간으로 선 미리보기를 위한 경계 감지 제거 - 드래그 완료 후에만 경계 감지 적용
        if (this.measurementMode === 'reference') {
          console.log('기준선 업데이트', 
            `시작(${this.currentMeasurement.start.x.toFixed(0)}, ${this.currentMeasurement.start.y.toFixed(0)})`, 
            `끝(${pos.x.toFixed(0)}, ${pos.y.toFixed(0)})`);
        }
      } else if (this.measurementMode === 'circle' || this.areaStart) {
        this.areaEnd = {...pos};
      }
      
      this.render();
    },
    endMeasurement(evt) {
      if (!this.isMeasuring) return;
      
      // 측정 모드 종료
      this.isMeasuring = false;
      
      // 마우스 위치로부터 끝점 설정
      const rect = this.$refs.canvas.getBoundingClientRect();
      const offsetX = evt.clientX - rect.left;
      const offsetY = evt.clientY - rect.top;
          
      if (this.currentMeasurement) {
        this.currentMeasurement.end = { x: offsetX, y: offsetY };
      }

      // 스케일바 모드인 경우
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
          console.log('[endMeasurement] 수동 스케일바 설정 완료, manualScaleBarSet을 true로 설정');
          
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
          
          console.log(`[endMeasurement] 스케일바 측정값 저장:`, JSON.stringify(this.scaleBarMeasurement));
          console.log(`[endMeasurement] 스케일바 픽셀 길이: ${pixelLength}, 단위: ${this.scaleBarUnit}`);
          
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
          console.log(`[endMeasurement] 수동 스케일바 설정 완료, 픽셀 길이: ${pixelLength}, 자동으로 선 측정 모드로 전환`);
          
          // 상태 변경 알림 표시
          this.showNotification('수동 스케일바 설정 완료. 선 측정 모드로 전환되었습니다.', 'info');
        }
        
        this.currentMeasurement = null;
        this.render();
        return;
      }

      // 기존 측정 종료 로직
      if (this.isAreaSelectionMode) {
        if (this.areaSelectionStart && this.areaSelectionEnd) {
          const width = Math.abs(this.areaSelectionEnd.x - this.areaSelectionStart.x);
          const height = Math.abs(this.areaSelectionEnd.y - this.areaSelectionStart.y);
          
          if (width > 10 && height > 10) {
            this.selectedAreaRect = {
              start: { ...this.areaSelectionStart },
              end: { ...this.areaSelectionEnd }
            };
            console.log('Selected area rect set:', this.selectedAreaRect);
          }
        }
        this.render();
        return;
      }

      if (this.measurementMode === 'reference') {
        if (this.currentMeasurement && 
            this.calculateValue(this.currentMeasurement.start, this.currentMeasurement.end) > 5) {
          
          const referenceLine = {
            start: {...this.currentMeasurement.start},
            end: {...this.currentMeasurement.end},
            itemId: this.currentMeasurement.itemId,
            subItemId: this.currentMeasurement.subItemId,
            isReference: true,
            value: this.calculateValue(this.currentMeasurement.start, this.currentMeasurement.end),
            color: this.currentMeasurement.color // 선택된 색상 저장
          };
          
          this.referenceLines.push(referenceLine);
          this.activeReferenceLine = referenceLine;
          
          console.log('기준선 추가 완료', JSON.stringify(referenceLine));
          this.debugInfo.referenceLinesCount = this.referenceLines.length;
          console.log(`총 기준선 개수: ${this.referenceLines.length}`);
        }
      } else if (this.measurementMode === 'line') {
        if (this.currentMeasurement && 
            this.calculateValue(this.currentMeasurement.start, this.currentMeasurement.end) > 5) {
          
          // 측정선의 끝점을 객체 경계에 맞게 조정
          const trimmedMeasurement = this.trimMeasurementToObjectBoundaries(this.currentMeasurement);
          
          const measurement = {
            ...trimmedMeasurement,
            value: this.calculateValue(trimmedMeasurement.start, trimmedMeasurement.end),
            brightness: this.calculateAverageBrightness(trimmedMeasurement.start, trimmedMeasurement.end)
          };
          
          // 기준선 기반 측정인 경우
          if (this.activeReferenceLine) {
            this.applyReferenceToMeasurement(measurement);
          }
          
          this.measurements.push(measurement);
          this.nextId++;
          this.createBoundedSegments(measurement);
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
            console.log('Defect mode - Setting selectedAreaRect');
            this.selectedAreaRect = {
              start: { ...this.areaStart },
              end: { ...this.areaEnd }
            };
            console.log('selectedAreaRect after setting:', this.selectedAreaRect);
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
            this.measurements.push(measurement);
            this.segmentedMeasurements.push(measurement);
            this.nextId++;
          } else if (this.measurementMode.startsWith('area')) {
            console.log(`[endMeasurement] 영역 측정 완료, 영역 측정 생성 시작 - 모드: ${this.measurementMode}, 기준선 있음: ${!!this.activeReferenceLine}`);
            this.createAreaMeasurements();
          }
        }
      }
      
      this.currentMeasurement = null;
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
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    },
    createAreaMeasurements() {
      console.log(`[createAreaMeasurements] >>> 시작 - 모드: ${this.measurementMode}, 기준선 있음: ${!!this.activeReferenceLine}`);
      
      // 기존 측정값 초기화 코드 제거 - 누적 측정을 위해
      
      const startX = Math.min(this.areaStart.x, this.areaEnd.x);
      const endX = Math.max(this.areaStart.x, this.areaEnd.x);
      const startY = Math.min(this.areaStart.y, this.areaEnd.y);
      const endY = Math.max(this.areaStart.y, this.areaEnd.y);
      
      console.log('Creating area measurements:', 
                 `mode=${this.measurementMode}`, 
                 `hasReferenceLine=${!!this.activeReferenceLine}`,
                 `lineCount=${this.lineCount}`,
                 `area=(${startX.toFixed(0)},${startY.toFixed(0)})-(${endX.toFixed(0)},${endY.toFixed(0)})`);
      
      // 기준선 기반 측정인 경우
      if (this.activeReferenceLine) {
        console.log(`[createAreaMeasurements] 기준선 기반 영역 측정 처리 - 모드: ${this.measurementMode}`);
        
        // 기존 회전 로직 제거하고 직사각형 박스 사용
        // 항상 직사각형으로 고정 (기준선 방향 무시)
        console.log(`[createAreaMeasurements] 직사각형 영역 사용 (회전 없음)`);
        
        // 기존 코드와 동일하게 직사각형 코너 포인트 사용
        const cornerPoints = [
          { x: startX, y: startY }, // 좌상
          { x: endX, y: startY },   // 우상
          { x: endX, y: endY },     // 우하
          { x: startX, y: endY }    // 좌하
        ];
        
        console.log(`Rectangle corners:`, 
          `좌상(${cornerPoints[0].x.toFixed(0)},${cornerPoints[0].y.toFixed(0)})`,
          `우상(${cornerPoints[1].x.toFixed(0)},${cornerPoints[1].y.toFixed(0)})`,
          `우하(${cornerPoints[2].x.toFixed(0)},${cornerPoints[2].y.toFixed(0)})`,
          `좌하(${cornerPoints[3].x.toFixed(0)},${cornerPoints[3].y.toFixed(0)})`);
        
        if (this.measurementMode === 'area-vertical') {
          console.log(`[createAreaMeasurements] 수직 방향 영역 측정 생성 (with reference, 회전 없음)`);
          
          // 수직 방향 측정 - 기준선 없을 때와 동일하게 구현
          const width = endX - startX;
          const spacing = width / (this.lineCount - 1);
          
          for (let i = 0; i < this.lineCount; i++) {
            const x = startX + (spacing * i);
            const rawMeasurement = {
              start: { x, y: startY },
              end: { x, y: endY },
              itemId: this.nextId.toString(),
              subItemId: `${this.nextId}-${this.subItemPrefix}${i + 1}`,
              brightness: 0,
              relativeToReference: this.activeReferenceLine.itemId
            };
            
            // 객체 경계에 맞게 선 조정
            const trimmedMeasurement = this.trimMeasurementToObjectBoundaries(rawMeasurement);
            
            // 값 계산
            trimmedMeasurement.value = this.calculateValue(
              trimmedMeasurement.start,
              trimmedMeasurement.end
            );
            
            this.measurements.push(trimmedMeasurement);
            this.createBoundedSegments(trimmedMeasurement);
          }
        } else if (this.measurementMode === 'area-horizontal') {
          console.log(`[createAreaMeasurements] 수평 방향 영역 측정 생성 (with reference, 회전 없음)`);
          
          // 수평 방향 측정 - 기준선 없을 때와 동일하게 구현
          const height = endY - startY;
          const spacing = height / (this.lineCount - 1);
          
          for (let i = 0; i < this.lineCount; i++) {
            const y = startY + (spacing * i);
            
            if (i === 0 || i === this.lineCount - 1) {
              console.log(`Horizontal Line ${i}: (${startX.toFixed(0)},${y.toFixed(0)})-(${endX.toFixed(0)},${y.toFixed(0)})`);
            }
            
            const rawMeasurement = {
              start: { x: startX, y },
              end: { x: endX, y },
              itemId: this.nextId.toString(),
              subItemId: `${this.nextId}-${this.subItemPrefix}${i + 1}`,
              brightness: 0,
              relativeToReference: this.activeReferenceLine.itemId,
              isHorizontal: true // 수평 방향 표시 추가
            };
            
            // 객체 경계에 맞게 선 조정
            const trimmedMeasurement = this.trimMeasurementToObjectBoundaries(rawMeasurement);
            trimmedMeasurement.isHorizontal = true; // 수평 방향 표시 유지
            
            // 값 계산
            trimmedMeasurement.value = this.calculateValue(
              trimmedMeasurement.start,
              trimmedMeasurement.end
            );
            
            this.measurements.push(trimmedMeasurement);
            this.createBoundedSegments(trimmedMeasurement);
          }
        }
        
        this.nextId++;
      } else {
        // 기준선 없는 일반 영역 측정
        console.log(`[createAreaMeasurements] 기준선 없는 일반 영역 측정 처리 - 모드: ${this.measurementMode}`);
        
        if (this.measurementMode === 'area-vertical') {
          console.log(`[createAreaMeasurements] 수직 방향 영역 측정 생성 (without reference)`);
          const width = endX - startX;
          const spacing = width / (this.lineCount - 1);
          
          for (let i = 0; i < this.lineCount; i++) {
            const x = startX + (spacing * i);
            const rawMeasurement = {
              start: { x, y: startY },
              end: { x, y: endY },
              itemId: this.nextId.toString(),
              subItemId: `${this.nextId}-${this.subItemPrefix}${i + 1}`,
              brightness: 0
            };
            
            // 객체 경계에 맞게 선 조정
            const trimmedMeasurement = this.trimMeasurementToObjectBoundaries(rawMeasurement);
            
            // 값 계산
            trimmedMeasurement.value = this.calculateValue(
              trimmedMeasurement.start,
              trimmedMeasurement.end
            );
            
            this.measurements.push(trimmedMeasurement);
            this.createBoundedSegments(trimmedMeasurement);
          }
          this.nextId++;
        } else if (this.measurementMode === 'area-horizontal') {
          console.log(`[createAreaMeasurements] 수평 방향 영역 측정 생성 (without reference)`);
          const height = endY - startY;
          const spacing = height / (this.lineCount - 1);
          
          for (let i = 0; i < this.lineCount; i++) {
            const y = startY + (spacing * i);
            
            if (i === 0 || i === this.lineCount - 1) {
              console.log(`Line ${i}: (${startX.toFixed(0)},${y.toFixed(0)})-(${endX.toFixed(0)},${y.toFixed(0)})`);
            }
            
            const rawMeasurement = {
              start: { x: startX, y },
              end: { x: endX, y },
              itemId: this.nextId.toString(),
              subItemId: `${this.nextId}-${this.subItemPrefix}${i + 1}`,
              brightness: 0,
              isHorizontal: true // 수평 방향 표시 추가
            };
            
            // 객체 경계에 맞게 선 조정
            const trimmedMeasurement = this.trimMeasurementToObjectBoundaries(rawMeasurement);
            trimmedMeasurement.isHorizontal = true; // 수평 방향 표시 유지
            
            // 값 계산
            trimmedMeasurement.value = this.calculateValue(
              trimmedMeasurement.start,
              trimmedMeasurement.end
            );
            
            this.measurements.push(trimmedMeasurement);
            this.createBoundedSegments(trimmedMeasurement);
          }
          this.nextId++;
        }
      }
      
      console.log(`[createAreaMeasurements] <<< 종료 - 생성된 측정값: ${this.measurements.length}개`);
    },
    
    // 새로운 함수: 경계가 있는 세그먼트 생성
    createBoundedSegments(measurement) {
      const samples = 3000; // 샘플링 포인트 수
      const segments = [];
      
      console.log(`[createBoundedSegments] 시작 - 측정값 ID: ${measurement.itemId}, 기존 세그먼트 수: ${this.segmentedMeasurements.length}`);
      
      // 포인트 및 밝기 샘플링
      const points = [];
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const point = {
          x: measurement.start.x + (measurement.end.x - measurement.start.x) * t,
          y: measurement.start.y + (measurement.end.y - measurement.start.y) * t
        };
        const brightness = this.calculateBrightness(point.x, point.y);
        points.push({ ...point, brightness, t });
      }
      
      // 이동 평균으로 노이즈 제거
      const windowSize = 5;
      const smoothedPoints = points.map((point, i) => {
        if (i < windowSize/2 || i > points.length - windowSize/2 - 1) return point;
        
        let sum = 0;
        for (let j = -Math.floor(windowSize/2); j <= Math.floor(windowSize/2); j++) {
          sum += points[i + j].brightness;
        }
        return { ...point, brightness: sum / windowSize };
      });
      
      // 밝기 변경 지점 찾기
      const transitions = [];
      let prevIsBright = null;
      
      smoothedPoints.forEach((point, index) => {
        const isBright = point.brightness > this.brightnessThreshold;
        
        if (prevIsBright === null) {
          prevIsBright = isBright;
        } else if (isBright !== prevIsBright) {
          transitions.push({
            index,
            point,
            fromBright: prevIsBright,
            toBright: isBright
          });
          prevIsBright = isBright;
        }
      });
      
      console.log(`[createBoundedSegments] Found ${transitions.length} brightness transitions`);
      
      // 전체 선 측정값 계산 - 정확한 계산을 위해 직접 계산 함수 호출
      const totalValue = this.calculateValue(measurement.start, measurement.end);
      console.log(`[createBoundedSegments] 전체 선 측정값: ${totalValue}`);
      
      // 전체 선 길이 측정값 저장 코드 제거 (total 값 생성 안함)
      
      // 세그먼트 생성
      if (transitions.length === 0) {
        // 밝기 변화가 없는 경우 전체 라인이 하나의 세그먼트
        const isBright = smoothedPoints[0]?.brightness > this.brightnessThreshold;
        
        // 세그먼트 측정값은 전체 선 길이와 동일하게 설정
        const segmentValue = totalValue;
        console.log(`[createBoundedSegments] 단일 세그먼트 측정값: ${segmentValue} (전체와 동일)`);
        
        const subItemId = `s${isBright ? this.brightSubIdCounter++ : this.darkSubIdCounter++}`;
        
        segments.push({
          start: { ...measurement.start },
          end: { ...measurement.end },
          brightness: isBright ? 255 : 0,
          isBright: isBright,
          itemId: measurement.itemId,
          subItemId: subItemId,
          value: segmentValue
        });
      } else {
        // 첫 세그먼트 (시작점부터 첫 전환점까지)
        const firstTransition = transitions[0];
        const firstIsBright = firstTransition.fromBright;
        
        // 거리에 비례하여 측정값 계산
        const firstSegmentLength = this.getDistanceRatio(
          measurement.start, 
          { x: firstTransition.point.x, y: firstTransition.point.y },
          measurement.start,
          measurement.end
        );
        const firstSegmentValue = totalValue * firstSegmentLength;
        
        console.log(`[createBoundedSegments] 첫 세그먼트 측정값: ${firstSegmentValue} (비율: ${firstSegmentLength.toFixed(4)})`);
        
        const firstSubItemId = `s${firstIsBright ? this.brightSubIdCounter++ : this.darkSubIdCounter++}`;
        
        segments.push({
          start: { ...measurement.start },
          end: { 
            x: firstTransition.point.x, 
            y: firstTransition.point.y 
          },
          brightness: firstIsBright ? 255 : 0,
          isBright: firstIsBright,
          itemId: measurement.itemId,
          subItemId: firstSubItemId,
          value: firstSegmentValue
        });
        
        // 중간 세그먼트들
        for (let i = 0; i < transitions.length - 1; i++) {
          const currentTransition = transitions[i];
          const nextTransition = transitions[i + 1];
          const isBright = currentTransition.toBright;
          
          // 세그먼트 시작/끝점
          const segmentStart = { x: currentTransition.point.x, y: currentTransition.point.y };
          const segmentEnd = { x: nextTransition.point.x, y: nextTransition.point.y };
          
          // 거리에 비례하여 측정값 계산
          const segmentLength = this.getDistanceRatio(
            segmentStart, 
            segmentEnd,
            measurement.start,
            measurement.end
          );
          const segmentValue = totalValue * segmentLength;
          
          console.log(`[createBoundedSegments] 중간 세그먼트 #${i+1} 측정값: ${segmentValue} (비율: ${segmentLength.toFixed(4)})`);
          
          const subItemId = `s${isBright ? this.brightSubIdCounter++ : this.darkSubIdCounter++}`;
          
          segments.push({
            start: segmentStart,
            end: segmentEnd,
            brightness: isBright ? 255 : 0,
            isBright: isBright,
            itemId: measurement.itemId,
            subItemId: subItemId,
            value: segmentValue
          });
        }
        
        // 마지막 세그먼트 (마지막 전환점부터 끝점까지)
        const lastTransition = transitions[transitions.length - 1];
        const lastIsBright = lastTransition.toBright;
        
        // 거리에 비례하여 측정값 계산
        const lastSegmentLength = this.getDistanceRatio(
          { x: lastTransition.point.x, y: lastTransition.point.y },
          measurement.end,
          measurement.start,
          measurement.end
        );
        const lastSegmentValue = totalValue * lastSegmentLength;
        
        console.log(`[createBoundedSegments] 마지막 세그먼트 측정값: ${lastSegmentValue} (비율: ${lastSegmentLength.toFixed(4)})`);
        
        const lastSubItemId = `s${lastIsBright ? this.brightSubIdCounter++ : this.darkSubIdCounter++}`;
        
        segments.push({
          start: { x: lastTransition.point.x, y: lastTransition.point.y },
          end: { ...measurement.end },
          brightness: lastIsBright ? 255 : 0,
          isBright: lastIsBright,
          itemId: measurement.itemId,
          subItemId: lastSubItemId,
          value: lastSegmentValue
        });
      }
      
      // 기준선 관련 속성 복사
      segments.forEach(segment => {
        if (measurement.relativeToReference) {
          segment.relativeToReference = measurement.relativeToReference;
        }
        // 수평/수직 방향 속성 유지
        if (measurement.isHorizontal) {
          segment.isHorizontal = true;
        }
      });
      
      // 총 세그먼트 값의 합과 전체 선 값 비교 (디버깅용)
      const segmentsSum = segments.reduce((sum, segment) => sum + segment.value, 0);
      console.log(`[createBoundedSegments] 세그먼트 값 합계: ${segmentsSum.toFixed(2)}, 전체 선 값: ${totalValue.toFixed(2)}, 차이: ${(totalValue - segmentsSum).toFixed(2)}`);
      
      // 세그먼트 합계가 전체 값과 약간 다를 경우 보정
      if (Math.abs(totalValue - segmentsSum) > 0.01 && segments.length > 0) {
        // 마지막 세그먼트 보정
        const correction = totalValue - segmentsSum;
        const lastSegment = segments[segments.length - 1];
        lastSegment.value += correction;
        
        console.log(`[createBoundedSegments] 보정 적용 - 마지막 세그먼트에 ${correction.toFixed(4)} 추가됨`);
        
        // 보정 후 합계 재확인
        const newSum = segments.reduce((sum, segment) => sum + segment.value, 0);
        console.log(`[createBoundedSegments] 보정 후 세그먼트 합계: ${newSum.toFixed(2)}`);
      }
      
      this.segmentedMeasurements.push(...segments);
      console.log(`[createBoundedSegments] 종료 - 세그먼트 ${segments.length}개 생성, 총 ${this.segmentedMeasurements.length}개`);
      
      // 생성된 세그먼트 정보 요약 로깅
      segments.forEach((segment, idx) => {
        console.log(`  세그먼트 #${idx+1}: ID=${segment.itemId}, SubID=${segment.subItemId}, 값=${segment.value.toFixed(2)}, 밝기=${segment.isBright ? '밝음' : '어두움'}`);
      });
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
        console.log('[render] 이미지 상태:', {
          image: this.image ? '있음' : '없음',
          canvas: this.$refs.canvas ? '있음' : '없음',
          ctx: this.ctx ? '있음' : '없음',
          canvasWidth: this.$refs.canvas?.width,
          canvasHeight: this.$refs.canvas?.height
        });

        // 캔버스 지우기
        this.ctx.clearRect(0, 0, this.$refs.canvas.width, this.$refs.canvas.height);

        // 이미지 그리기 전에 유효성 검사
        if (this.image && this.image.complete && this.image.naturalWidth > 0) {
          try {
            // 이미지 그리기 - 항상 꽉 채우면서 가운데 정렬되도록
            this.ctx.drawImage(this.image, 0, 0, this.$refs.canvas.width, this.$refs.canvas.height);
          } catch (drawError) {
            console.error('[render] 이미지 그리기 오류:', drawError);
            console.log('[render] 오류 발생한 이미지 정보:', {
              src: this.image.src.substring(0, 30) + '...',
              complete: this.image.complete,
              naturalWidth: this.image.naturalWidth,
              naturalHeight: this.image.naturalHeight
            });
            
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
        console.log('Render - mode:', this.measurementMode);
        console.log('Render - referenceLines:', this.referenceLines.length);
        console.log('Render - isMeasuring:', this.isMeasuring);
        
        // 기준선 먼저 그리기
        if (this.referenceLines.length > 0) {
          console.log('Drawing reference lines:', this.referenceLines.length);
          
          this.referenceLines.forEach((refLine, index) => {
            console.log(`Drawing reference line ${index}:`, 
              `시작(${refLine.start.x.toFixed(0)}, ${refLine.start.y.toFixed(0)})`, 
              `끝(${refLine.end.x.toFixed(0)}, ${refLine.end.y.toFixed(0)})`);
            
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
          console.log(`Drawing ${this.segmentedMeasurements.length} segmented measurements`);
          console.log(`Measurements count: ${this.measurements.length}, segmented count: ${this.segmentedMeasurements.length}`);
          
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
          console.log('Drawing selected area rect:', this.selectedAreaRect);
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
          this.measurements = [];
          this.segmentedMeasurements = [];
          this.selectedMeasurement = null;
          this.selectedRows = [];
          this.selectedSegment = null;
          this.nextId = 1;
        }
      }
      
      console.log('모드 변경:', mode);
      this.debugInfo.lastAction = `모드 변경: ${mode}`;
      this.measurementMode = mode;
      
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
      console.log('[closePopup] MSA6 이미지 팝업 닫기');
        
      // 팝업 닫기 전에 현재 스케일바 설정 저장
            this.saveScaleBarSettings();
        
      // 팝업 표시 상태 설정
        this.isVisible = false;
        this.$emit('update:showPopup', false);
        
      // 팝업이 닫힐 때 이벤트 발생
        this.$emit('close');
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
      console.log(`[applySelectedIds] ID 적용 완료 - Item ID: ${this.newItemId || '변경 없음'}, Sub ID: ${this.newSubId || '변경 없음'}`);
      
      this.render();
    },
    editSegment(segment) {
      // 세그먼트 편집 로직 구현
      console.log('Editing segment:', segment);
    },
    deleteSegment(segment) {
      const index = this.segmentedMeasurements.indexOf(segment);
      if (index > -1) {
        // 관련된 모든 세그먼트와 측정값 삭제
        const itemId = segment.itemId;
        this.segmentedMeasurements = this.segmentedMeasurements.filter(s => s.itemId !== itemId);
        this.measurements = this.measurements.filter(m => m.itemId !== itemId);
        
        // 삭제된 항목을 실행 취소 기록에 추가
        const relatedSegments = this.segmentedMeasurements.filter(s => s.itemId === itemId);
        const measurement = this.measurements.find(m => m.itemId === itemId);
        if (measurement) {
          this.undoHistory.push({
            measurement: measurement,
            segments: relatedSegments
          });
        }
        
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
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        this.undoLastMeasurement();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        this.redoLastMeasurement();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.selectedSegment) {
          this.deleteSegment(this.selectedSegment);
          this.selectedSegment = null;
        }
      } else if (e.key && e.key.toLowerCase() === 'f') {
        this.isFKeyPressed = true;
        this.showBrightnessTooltip = true;
        
        console.log('키보드 이벤트 감지: f', this.isFKeyPressed);
        console.log('키보드 이벤트 상세정보:', e);
        
        // 마우스 위치에서 돋보기 초기화
        if (this.currentMousePos.x && this.currentMousePos.y) {
          const pos = this.getLocalPos({ 
            clientX: this.currentMousePos.x, 
            clientY: this.currentMousePos.y 
          });
          
          // 돋보기 즉시 업데이트
          this.$nextTick(() => {
            this.updateMagnifier(pos);
            
            // 돋보기가 보이도록 강제 설정
            const magnifierContainer = document.querySelector('.magnifier-container');
            if (magnifierContainer) {
              magnifierContainer.style.display = 'block';
            }
          });
        }
      } else if (e.key && e.key.toLowerCase() === 'a') {
        // a키: 영역 선 측정 모드 토글 (수평 <-> 수직)
        if (this.measurementMode === 'area-horizontal') {
          this.setMode('area-vertical');
        } else {
          this.setMode('area-horizontal');
        }
      } else if (e.key && e.key.toLowerCase() === 's') {
        // s키: 단일 선 측정 모드 활성화
        this.setMode('line');
      } else if (e.key && e.key.toLowerCase() === 'd') {
        // d키: 선택된 측정 삭제
        if (this.selectedSegment) {
          this.deleteSegment(this.selectedSegment);
          this.selectedSegment = null;
        } else if (this.measurements.length > 0) {
          // 선택된 세그먼트가 없으면 마지막 측정값 삭제
          this.undoLastMeasurement();
        }
      } else if (e.key && e.key.toLowerCase() === 'h') {
        // h키: 도움말 표시 (키를 누르고 있는 동안)
        this.showShortcutHelp = true;
      }
    },
    undoLastMeasurement() {
      if (this.measurements.length > 0) {
        const lastMeasurement = this.measurements.pop();
        this.undoHistory.push(lastMeasurement);
        
        // 관련된 세그먼트들도 함께 저장하고 삭제
        const relatedSegments = this.segmentedMeasurements.filter(
          segment => segment.itemId === lastMeasurement.itemId
        );
        this.redoHistory.push({
          measurement: lastMeasurement,
          segments: relatedSegments
        });
        
        this.segmentedMeasurements = this.segmentedMeasurements.filter(
          segment => segment.itemId !== lastMeasurement.itemId
        );
        
        this.render();
      }
    },
    redoLastMeasurement() {
      if (this.redoHistory.length > 0) {
        const lastState = this.redoHistory.pop();
        this.measurements.push(lastState.measurement);
        this.segmentedMeasurements.push(...lastState.segments);
        this.render();
      }
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
        this.defectMeasurements.splice(index, 1);
        this.render();
      }
    },
    toggleImageSelection(image, selected) {
      // 이미지 선택 토글
      this.selectedImages[image.id] = selected;
    },
    saveMeasurementsToLCNC() {
      if (this.isSaving || (this.measurementMode === 'defect' ? this.defectMeasurements.length === 0 : this.filteredMeasurements.length === 0)) return;
      
      this.isSaving = true;
      
      console.log('[saveMeasurementsToLCNC] 측정 결과 저장 시작...');
      
      // 로그 저장 - 측정 결과 저장
      LogService.logAction('save_measurements', {
        mode: this.measurementMode,
        count: this.measurementMode === 'defect' 
          ? this.defectMeasurements.length 
          : this.filteredMeasurements.length
      })
      
      // 세션 ID 가져오기 (localStorage에서)
      const sessionId = localStorage.getItem('current_workflow_session_id');
      
      if (!sessionId) {
        alert('워크플로우 세션을 찾을 수 없습니다. 먼저 워크플로우를 실행해 주세요.');
        this.isSaving = false;
        return;
      }
      
      // 측정 데이터 준비
      const measurementData = {
        session_id: sessionId,
        measurements: this.measurementMode === 'defect' ? this.defectMeasurements : this.filteredMeasurements,
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
      
      console.log(`[applyReferenceToMeasurement] 기준선 적용 - 모드: ${this.measurementMode}, 측정값 ID: ${measurement.itemId}`);
      
      // 기준선에 상대적인 측정값 설정
      measurement.relativeToReference = this.activeReferenceLine.itemId;
      
      // 가로/세로 방향 설정 유지
      if (this.measurementMode === 'area-horizontal') {
        measurement.isHorizontal = true;
        console.log(`[applyReferenceToMeasurement] 수평 방향 표시 추가`);
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
    // 측정선을 객체 경계에 맞게 조정하는 함수
    trimMeasurementToObjectBoundaries(measurement) {
      console.log(`[trimMeasurementToObjectBoundaries] 호출 - 방향: ${measurement.isHorizontal ? '수평' : '수직'}, 기준선 관련: ${!!measurement.relativeToReference}`);
      
      const result = {
        ...measurement,
        start: { ...measurement.start },
        end: { ...measurement.end }
      };
      
      // 기준선이 있는 경우에만 교차점 계산 및 적용
      // 밝기 변화 감지 로직은 제거하여 여러 영역을 한 번에 측정 가능하게 함
      if (this.activeReferenceLine) {
        // 기준선을 직선으로 가정하고 교차점 계산
        const refLine = this.activeReferenceLine;
        
        // 선분 교차점 계산
        const det = (measurement.end.x - measurement.start.x) * (refLine.end.y - refLine.start.y) - 
                    (measurement.end.y - measurement.start.y) * (refLine.end.x - refLine.start.x);
        
        if (det !== 0) {  // 평행하지 않은 경우만
          const t = ((refLine.start.x - measurement.start.x) * (refLine.end.y - refLine.start.y) - 
                    (refLine.start.y - measurement.start.y) * (refLine.end.x - refLine.start.x)) / det;
          
          const u = -((measurement.start.x - measurement.end.x) * (measurement.start.y - refLine.start.y) - 
                    (measurement.start.y - measurement.end.y) * (measurement.start.x - refLine.start.x)) / det;
          
          if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            // 교차점 좌표
            const intersectionPoint = {
              x: measurement.start.x + t * (measurement.end.x - measurement.start.x),
              y: measurement.start.y + t * (measurement.end.y - measurement.start.y)
            };
            
            console.log(`[trimMeasurementToObjectBoundaries] 기준선 교차점 발견: (${intersectionPoint.x.toFixed(0)}, ${intersectionPoint.y.toFixed(0)})`);
            
            // 시작점과 끝점 중 교차점에 더 가까운 쪽을 교차점으로 설정
            const distToStart = Math.hypot(
              intersectionPoint.x - measurement.start.x,
              intersectionPoint.y - measurement.start.y
            );
            const distToEnd = Math.hypot(
              intersectionPoint.x - measurement.end.x,
              intersectionPoint.y - measurement.end.y
            );
            
            if (distToStart < distToEnd) {
              // 교차점이 시작점에 더 가까우면
              result.start = intersectionPoint;
            } else {
              // 교차점이 끝점에 더 가까우면
              result.end = intersectionPoint;
            }
            
            console.log('[trimMeasurementToObjectBoundaries] 기준선 기준 측정선 조정:', 
              `Start: (${result.start.x.toFixed(0)}, ${result.start.y.toFixed(0)})`, 
              `End: (${result.end.x.toFixed(0)}, ${result.end.y.toFixed(0)})`);
          }
        }
      }
      
      // 수평/수직 방향 속성 유지
      if (measurement.isHorizontal) {
        result.isHorizontal = true;
      }
      
      return result;
    },
    resetMeasurements() {
      if (confirm('모든 측정 결과를 초기화하시겠습니까?')) {
        // 모든 측정값 초기화
        this.measurements = [];
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
        
        console.log('모든 측정 결과가 초기화되었습니다.');
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
        console.log('[saveWithTableName] localStorage 항목:');
        
        // 사용자 정보 추출 시도
        let userName = '측정사용자';
        
        // 객체에서 사용자 이름 추출하는 헬퍼 함수
        const extractUserNameFromObject = (userObject) => {
          // 객체에서 이름 관련 필드 확인
          const nameFields = ['name', 'userName', 'username', 'loginId', 'id', 'email'];
          for(const field of nameFields) {
            if(userObject[field]) {
              return userObject[field];
            }
          }
          return '측정사용자';
        };
        
        // 1. localStorage에서 사용자 정보 찾기
        const userKeys = ['userName', 'user_name', 'username', 'user', 'loginId', 'login_id', 'id', 'email'];
        
        for(const key of userKeys) {
          const value = localStorage.getItem(key);
          if(value && value !== 'undefined' && value !== 'null') {
            try {
              // JSON 데이터 파싱 시도
              const parsed = JSON.parse(value);
              
              // 객체인 경우 필드 확인
              if(typeof parsed === 'object' && parsed !== null) {
                userName = extractUserNameFromObject(parsed);
                console.log(`[saveWithTableName] localStorage[${key}]에서 사용자 이름 찾음: ${userName}`);
                break;
              } else if(typeof parsed === 'string') {
                // 문자열인 경우 그대로 사용
                userName = parsed;
                console.log(`[saveWithTableName] localStorage[${key}]에서 사용자 이름 찾음: ${userName}`);
                break;
              }
            } catch(e) {
              // JSON 파싱 실패하면 문자열로 처리
              if(typeof value === 'string') {
                userName = value;
                console.log(`[saveWithTableName] localStorage[${key}] 문자열로 사용자 이름 찾음: ${userName}`);
                break;
              }
            }
          }
        }
        
        // 2. document.cookie에서 사용자 정보 확인
        if(userName === '측정사용자' && document.cookie) {
          const cookies = document.cookie.split(';');
          for(const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if(['userName', 'user_name', 'username', 'user'].includes(name.toLowerCase())) {
              try {
                userName = decodeURIComponent(value);
                console.log(`[saveWithTableName] 쿠키에서 사용자 이름 찾음: ${userName}`);
                break;
              } catch(e) {
                console.error(`[saveWithTableName] 쿠키 디코딩 오류:`, e);
              }
            }
          }
        }
        
        // 3. sessionStorage에서 사용자 정보 확인
        if(userName === '측정사용자') {
          for(const key of userKeys) {
            const value = sessionStorage.getItem(key);
            if(value && value !== 'undefined' && value !== 'null') {
              try {
                const parsed = JSON.parse(value);
                if(typeof parsed === 'object' && parsed !== null) {
                  userName = extractUserNameFromObject(parsed);
                  console.log(`[saveWithTableName] sessionStorage[${key}]에서 사용자 이름 찾음: ${userName}`);
                  break;
                } else if(typeof parsed === 'string') {
                  userName = parsed;
                  console.log(`[saveWithTableName] sessionStorage[${key}]에서 사용자 이름 찾음: ${userName}`);
                  break;
                }
              } catch(e) {
                if(typeof value === 'string') {
                  userName = value;
                  console.log(`[saveWithTableName] sessionStorage[${key}] 문자열로 사용자 이름 찾음: ${userName}`);
                  break;
                }
              }
            }
          }
        }
        
        // 4. 마지막 수단: window 객체에서 전역 사용자 정보 확인
        if(userName === '측정사용자' && window.currentUser) {
          userName = typeof window.currentUser === 'string' ? 
                     window.currentUser : 
                     (window.currentUser.name || window.currentUser.userName || window.currentUser.username || window.currentUser.id);
          console.log(`[saveWithTableName] window 객체에서 사용자 이름 찾음: ${userName}`);
        }
        
        // 5. 이름만 추출 (이메일 주소인 경우)
        if(userName.includes('@')) {
          userName = userName.split('@')[0];
          console.log(`[saveWithTableName] 이메일에서 사용자 이름 추출: ${userName}`);
        }
        
        console.log(`[saveWithTableName] 최종 결정된 사용자 이름: ${userName}`);
        
        // lot_wafer는 테이블 선택기에서 입력받은 값 사용
        const lot_wafer = selectedTable.lot_wafer;
        if(!lot_wafer) {
          throw new Error('Lot Wafer 정보가 없습니다.');
        }
        
        console.log(`[saveWithTableName] 사용할 lot_wafer 값: ${lot_wafer}`);
        
        // 1. 먼저 이미지 저장
        if(this.imageUrl) {
          try {
            console.log('[saveWithTableName] 이미지 저장 시작');
            console.log('[saveWithTableName] Before 이미지 URL:', this.inputImageUrl);
            console.log('[saveWithTableName] After 이미지 URL:', this.imageUrl);
            
            // 이미지 URL이 유효한지 확인
            if(!this.inputImageUrl || !this.imageUrl) {
              console.warn('[saveWithTableName] 이미지 URL이 없습니다!');
              console.log('[saveWithTableName] Before 이미지 상태:', this.inputImageUrl ? '있음' : '없음');
              console.log('[saveWithTableName] After 이미지 상태:', this.imageUrl ? '있음' : '없음');
            }
            
            // 이미지 저장 요청 데이터 구성
            const requestData = {
              title: `${selectedTable.table_name}_${lot_wafer}`,
              description: `${selectedTable.table_name}에 저장된 ${lot_wafer} 측정 이미지`,
              before_image: this.inputImageUrl,
              after_image: this.imageUrl,
              workflow_id: '',
              tags: ['msa6', '측정'],
              is_result: true,  // MSA6 결과 이미지임을 명시
              table_name: selectedTable.table_name,
              lot_wafer: lot_wafer
            };
            
            console.log('[saveWithTableName] 이미지 저장 요청 데이터:', requestData);
            
            // 외부 이미지 저장 API 호출
            const imageResponse = await fetch('http://localhost:8000/api/external_storage/save-images', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify(requestData)
            });
            
            if (!imageResponse.ok) {
              const errorText = await imageResponse.text();
              console.error('[saveWithTableName] 이미지 저장 API 오류:', imageResponse.status, errorText);
              console.warn('[saveWithTableName] 이미지 저장에 실패했지만 측정 데이터 저장은 계속합니다.');
              
              // FormData 방식으로 재시도
              try {
                console.log('[saveWithTableName] FormData 방식으로 이미지 저장 재시도');
                
                // 이미지를 Blob으로 변환
                const beforeBlob = await (async () => {
                  if (this.inputImageUrl.startsWith('data:')) {
                    const res = await fetch(this.inputImageUrl);
                    return await res.blob();
                  } else if (this.inputImageUrl.startsWith('blob:')) {
                    const res = await fetch(this.inputImageUrl);
                    return await res.blob();
                  } else {
                    const res = await fetch(this.inputImageUrl);
                    return await res.blob();
                  }
                })();
                
                const afterBlob = await (async () => {
                  if (this.imageUrl.startsWith('data:')) {
                    const res = await fetch(this.imageUrl);
                    return await res.blob();
                  } else if (this.imageUrl.startsWith('blob:')) {
                    const res = await fetch(this.imageUrl);
                    return await res.blob();
                  } else {
                    const res = await fetch(this.imageUrl);
                    return await res.blob();
                  }
                })();
                
                console.log('[saveWithTableName] Blob 변환 완료');
                console.log('[saveWithTableName] Before Blob 타입:', beforeBlob.type, 'Size:', beforeBlob.size);
                console.log('[saveWithTableName] After Blob 타입:', afterBlob.type, 'Size:', afterBlob.size);
                
                // FormData 구성
                const formData = new FormData();
                formData.append('title', requestData.title);
                formData.append('description', requestData.description);
                formData.append('before_file', beforeBlob, `before_${lot_wafer}.${beforeBlob.type.split('/')[1] || 'png'}`);
                formData.append('file', afterBlob, `after_${lot_wafer}.${afterBlob.type.split('/')[1] || 'png'}`);
                formData.append('workflow_id', '');
                formData.append('tags', JSON.stringify(['msa6', '측정']));
                formData.append('is_result', 'true');
                formData.append('table_name', selectedTable.table_name);
                formData.append('lot_wafer', lot_wafer);
                
                console.log('[saveWithTableName] FormData 구성 완료, API 요청 시작...');
                
                // FormData API 호출
                const formResponse = await fetch('http://localhost:8000/api/external_storage/upload-file', {
                  method: 'POST',
                  body: formData
                });
                
                if (!formResponse.ok) {
                  const errorText = await formResponse.text();
                  console.error('[saveWithTableName] FormData 방식 API 오류:', formResponse.status, errorText);
                  console.warn('[saveWithTableName] FormData 방식 이미지 저장에도 실패했지만 측정 데이터 저장은 계속합니다.');
                } else {
                  const formResult = await formResponse.json();
                  console.log('[saveWithTableName] FormData 방식 이미지 저장 성공:', formResult);
                }
              } catch (formError) {
                console.error('[saveWithTableName] FormData 방식 이미지 저장 오류:', formError);
                console.warn('[saveWithTableName] 모든 이미지 저장 방식이 실패했지만 측정 데이터 저장은 계속합니다.');
              }
            } else {
              const imageResult = await imageResponse.json();
              console.log('[saveWithTableName] 이미지 저장 성공:', imageResult);
              
              // 저장된 이미지 URL 로깅
              if (imageResult.image_data) {
                console.log('[saveWithTableName] 저장된 Before 이미지 URL:', imageResult.image_data.before_url);
                console.log('[saveWithTableName] 저장된 After 이미지 URL:', imageResult.image_data.after_url);
              }
            }
          } catch (imageError) {
            console.error('[saveWithTableName] 이미지 저장 중 오류:', imageError);
            console.warn('[saveWithTableName] 이미지 저장에 실패했지만 측정 데이터 저장은 계속합니다.');
          }
        }
        
        // 2. 측정 데이터 저장 (기존 로직)
        
        // 중요: 여기서 filteredMeasurements가 아닌 화면에 표시되는 데이터를 사용해야 함
        // 화면에 표시되는 측정 결과와 동일한 데이터 사용
        const displayedMeasurements = [...this.filteredMeasurements].filter(m => !m.isTotal);
        
        // 전체 측정값 로깅
        console.log(`[saveWithTableName] 전체 측정값: ${this.measurements.length}개, 화면 표시값: ${displayedMeasurements.length}개`);
        console.log('측정값 배열:', displayedMeasurements);
        
        // 중요: 측정값 배열 검증 - 항목이 몇 개인지, 중복은 없는지, 값이 정확한지 확인
        console.log('[saveWithTableName] 저장될 측정값 내용:');
        const uniqueValues = new Set();
        displayedMeasurements.forEach((m, idx) => {
          console.log(`  항목 #${idx+1}: ID=${m.itemId}, SubID=${m.subItemId}, 값=${m.value}`);
          uniqueValues.add(m.value);
        });
        console.log(`[saveWithTableName] 고유 값 개수: ${uniqueValues.size}개, 값 목록:`, Array.from(uniqueValues));
        
        if (displayedMeasurements.length === 0) {
          this.showNotification('저장할 유효한 측정 결과가 없습니다.', 'error');
          return;
        }
        
        console.log(`[saveWithTableName] 저장 중... 테이블: ${selectedTable.table_name}, 측정값: ${displayedMeasurements.length}개`);
        
        // 측정값 데이터 정리 - 원본 값을 최대한 보존하고 화면에 표시되는 값 그대로 저장
        const processedMeasurements = displayedMeasurements.map((measurement, idx) => {
          // subItemId에서 "item_id-" 접두사 제거 (예: "1-S1" -> "S1")
          let subItemId = measurement.subItemId || '';
          if (subItemId.includes('-')) {
            subItemId = subItemId.split('-').pop();
          }
          
          // 정확한 측정값 사용 - 화면에 표시되는 값 그대로 저장
          const originalValue = measurement.value;
          
          // 값이 이미 숫자면 그대로 사용하고, 아니면 파싱
          const value = typeof originalValue === 'number' ? 
                        originalValue : 
                        parseFloat(originalValue);
          
          // 값이 숫자로 변환 가능한지 확인
          if (isNaN(value)) {
            console.error(`[saveWithTableName] 측정값 #${idx+1} 값을 숫자로 변환할 수 없음: ${originalValue}`);
          }
          
          console.log(`[saveWithTableName] 측정값 #${idx+1} 변환: 원본=${originalValue}, 변환=${value}, ID=${measurement.itemId}, SubID=${subItemId}`);
          
          return {
            itemId: measurement.itemId || '',
            subItemId: subItemId,
            value: value
          };
        });
        
        console.log(`[saveWithTableName] 정리된 데이터:`, processedMeasurements);
        
        // 측정 결과 저장 API 호출 (모든 측정값을 한 번에 전송)
        this.isSaving = true;
        const response = await fetch('http://localhost:8000/api/msa6/save-with-table-name', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            table_name: selectedTable.table_name,
            username: userName,
            lot_wafer: lot_wafer,
            measurements: processedMeasurements
          })
        });
        
        // 응답이 JSON이 아닐 경우 처리
        let result;
        try {
          result = await response.json();
        } catch (parseError) {
          console.error('[saveWithTableName] JSON 파싱 오류:', parseError);
          const text = await response.text();
          throw new Error(`서버 응답 파싱 오류: ${text.substring(0, 100)}...`);
        }
        
        if (!response.ok) {
          const errorDetail = result.detail || result.message || '알 수 없는 오류';
          throw new Error(`HTTP 오류 ${response.status}: ${errorDetail}`);
        }
        
        if (result.status !== 'success') {
          // 권한 오류 메시지 특별 처리
          if (result.message && result.message.includes('저장 권한이 없습니다')) {
            this.showNotification(result.message, 'error');
            console.error('[saveWithTableName] 권한 오류:', result.message);
            // 로그 저장 - 권한 오류
            LogService.logAction('save_measurements_permission_error', {
              table_name: selectedTable.table_name,
              username: userName,
              error: result.message
            });
            this.isSaving = false;
            return;
          }
          throw new Error(result.detail || result.message || '저장 실패');
        }
        
        // 경고 메시지가 있는 경우 콘솔에 출력
        if (result.warnings && result.warnings.length > 0) {
          console.warn('[saveWithTableName] 저장 경고:', result.warnings);
        }
        
        this.showNotification(`측정 결과 ${result.saved_count}개가 '${selectedTable.table_name}' 테이블에 저장되었습니다.`, 'success');
        
        // 로그 저장 - 측정 결과 저장 완료
        LogService.logAction('save_measurements', {
          table_name: selectedTable.table_name,
          count: result.saved_count,
          total: displayedMeasurements.length
        });
        
      } catch (error) {
        console.error('[saveWithTableName] 측정 결과 저장 중 오류:', error);
        this.showNotification(`측정 결과 저장 중 오류: ${error.message}`, 'error');
        
        // 로그 저장 - 측정 결과 저장 실패
        LogService.logAction('save_measurements_error', {
          error: error.message || '저장 실패'
        });
      } finally {
        this.isSaving = false;
      }
    },
    
    /**
     * 알림 메시지 표시
     */
    showNotification(message, type = 'info') {
      // 기존 타이머 취소
      if (this.notification.timeout) {
        clearTimeout(this.notification.timeout);
      }
      
      // 알림 메시지 설정
      this.notification.message = message;
      this.notification.type = type;
      this.notification.show = true;
      
      // 3초 후 알림 숨기기
      this.notification.timeout = setTimeout(() => {
        this.notification.show = false;
      }, 3000);
    },
    // 기존 createSegments 함수는 단일 선 측정에만 사용
    createSegments(measurement) {
      // 경계가 있는 세그먼트 생성 함수 사용
      this.createBoundedSegments(measurement);
    },
    // 스케일바 감지 함수 업데이트
    detectScaleBar(forceShowPopup = false) {
      console.log('[detectScaleBar] 스케일바 자동 감지 시작, 강제팝업:', forceShowPopup);
      
      // ⚠️ 주의: 이 부분은 스케일바 감지 및 팝업 표시의 핵심 로직입니다. 수정 시 주의하세요! ⚠️
      // 다른 부분과의 충돌을 막기 위해 popupOverride.js와 동기화해야 합니다.
      
      // 팝업이 열려있지 않은 경우 아무 작업도 하지 않음
      if (!this.isVisible) {
        console.log('[detectScaleBar] 팝업이 열려있지 않아 스케일바 감지를 수행하지 않음');
        return;
      }
      
      // 스케일바 자동 감지 팝업 방지 플래그 확인
      const noScalePopup = sessionStorage.getItem('msa6_no_scale_popup') === 'true';
      if (noScalePopup) {
        console.log('[detectScaleBar] 스케일바 자동 감지 팝업 방지 플래그가 설정되어 있어 팝업을 표시하지 않음');
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
        console.log('[detectScaleBar] 유효한 수동 스케일바가 이미 설정되어 있어 감지를 수행하지 않음:', 
          'manualScaleBarSet:', this.manualScaleBarSet,
          'scaleBarValue:', this.scaleBarValue, 
          'scaleBarUnit:', this.scaleBarUnit);
        
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
      console.log('[detectScaleBar] 스케일바 감지 실패, 선택 팝업 표시');
      
      // 팝업 표시 플래그 설정
      this.showScaleChoicePopup = true;
      
        // 새로운 메서드를 사용하여 팝업 표시
        this.showScaleDetectionFailurePopup();
      
      this.render();
    },
    // 스케일바 감지 실패 팝업 표시 메서드 개선
    showScaleDetectionFailurePopup() {
      console.log('[showScaleDetectionFailurePopup] 스케일바 감지 실패 팝업 표시');
      
      // 팝업이 열려있지 않으면 표시하지 않음
      if (!this.isVisible) {
        console.log('[showScaleDetectionFailurePopup] 팝업이 열려있지 않아 스케일바 감지 실패 팝업을 표시하지 않음');
        return;
      }
      
      // 스케일바 자동 감지 팝업 방지 플래그 확인
      const noScalePopup = sessionStorage.getItem('msa6_no_scale_popup') === 'true';
      if (noScalePopup) {
        console.log('[showScaleDetectionFailurePopup] 스케일바 자동 감지 팝업 방지 플래그가 설정되어 있어 팝업을 표시하지 않음');
        // 플래그 제거 (일회성)
        sessionStorage.removeItem('msa6_no_scale_popup');
        return;
      }
      
      // 수동 스케일바 설정 유효성 검증
      const { hasValidManualScaleBar } = this.validateScaleBarSettings();
      
      // 유효한 수동 스케일바가 이미 설정되어 있는 경우 팝업 표시하지 않음
      if (hasValidManualScaleBar) {
        console.log('[showScaleDetectionFailurePopup] 유효한 수동 스케일바가 이미 설정되어 있어 팝업을 표시하지 않음:', 
          'manualScaleBarSet:', this.manualScaleBarSet,
          'scaleBarValue:', this.scaleBarValue,
          'scaleBarUnit:', this.scaleBarUnit);
        
        // 팝업 플래그도 확실히 false로 설정
        this.showScaleChoicePopup = false;
        return;
      }
      
      // 팝업 표시 전에 방식을 scaleBar로 변경 (선택 팝업이 관련성을 가지도록)
      if (this.scaleMethod !== 'scaleBar') {
        console.log('[showScaleDetectionFailurePopup] 현재 방식이 scaleBar가 아님, scaleBar로 변경:', this.scaleMethod);
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
        console.log('[saveScaleBarSettings] 스케일바 설정 저장 시작');
        
        // 현재 상태 로깅
        console.log('[saveScaleBarSettings] 현재 설정 상태:', {
          scaleMethod: this.scaleMethod,
          scaleBarValue: this.scaleBarValue,
          scaleBarUnit: this.scaleBarUnit,
          manualScaleBarSet: this.manualScaleBarSet,
          scaleBarDetected: this.scaleBarDetected,
          magnification: this.magnification
        });
        
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
        
        console.log('[saveScaleBarSettings] 저장할 데이터:', settings);
        
        // 이미지 키 생성 (URL에서 파일명 추출)
        let imageKey = 'default';
        if (this.imageUrl) {
          const urlParts = this.imageUrl.split('/');
          const fileName = urlParts[urlParts.length - 1];
          imageKey = fileName.split('.')[0]; // 확장자 제거
        }
        
        console.log(`[saveScaleBarSettings] 이미지 키: ${imageKey}`);
        
        // 1. 현재 이미지에 대한 설정 저장
        localStorage.setItem(`msa6_scalebar_${imageKey}`, JSON.stringify(settings));
        console.log(`[saveScaleBarSettings] 현재 이미지 설정 저장 완료 -> localStorage[msa6_scalebar_${imageKey}]`);
        
        // 2. 마지막 사용 이미지 키 저장 (다른 이미지에서 재사용하기 위함)
        localStorage.setItem('msa6_last_image_key', imageKey);
        console.log(`[saveScaleBarSettings] 마지막 이미지 키 저장 완료 -> localStorage[msa6_last_image_key] = ${imageKey}`);
        
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
        console.log(`[saveScaleBarSettings] 전역 설정 저장 완료 -> localStorage[msa6_scalebar_global]`);
        
        // 4. 저장된 데이터 검증
        const savedImageSettings = JSON.parse(localStorage.getItem(`msa6_scalebar_${imageKey}`));
        const savedGlobalSettings = JSON.parse(localStorage.getItem('msa6_scalebar_global'));
        
        console.log('[saveScaleBarSettings] 저장된 이미지별 설정:', savedImageSettings);
        console.log('[saveScaleBarSettings] 저장된 전역 설정:', savedGlobalSettings);
        
        // 저장된 manualScaleBarSet 값 확인
        if (savedImageSettings.manualScaleBarSet !== this.manualScaleBarSet) {
          console.error(`[saveScaleBarSettings] 오류: 저장된 manualScaleBarSet 값(${savedImageSettings.manualScaleBarSet})이 현재 값(${this.manualScaleBarSet})과 다릅니다.`);
        }
        
        console.log('[saveScaleBarSettings] 스케일바 설정 저장 완료');
        return true;
      } catch (e) {
        console.error('[saveScaleBarSettings] 저장 오류:', e);
        return false;
      }
    },
    
    // 스케일바 설정 복원 함수 개선
    restoreScaleBarSettings() {
        try {
            console.log('[restoreScaleBarSettings] 스케일바 설정 복원 시작');
            
            // 현재 이미지 키 생성
            let currentImageKey = 'default';
            if (this.imageUrl) {
                const urlParts = this.imageUrl.split('/');
                const fileName = urlParts[urlParts.length - 1];
                currentImageKey = fileName.split('.')[0]; // 확장자 제거
            }
            
            // 마지막으로 사용한 이미지 키 가져오기
            const lastImageKey = localStorage.getItem('msa6_last_image_key');
            
            console.log(`[restoreScaleBarSettings] 현재 이미지 키: ${currentImageKey}`);
            console.log(`[restoreScaleBarSettings] 마지막 이미지 키: ${lastImageKey || '없음'}`);
            
            // 복원 시도할 스토리지 키 목록
            console.log('[restoreScaleBarSettings] 복원 시도 순서: 1) 현재 이미지 설정 -> 2) 마지막 이미지 설정 -> 3) 전역 설정');
            
            // 저장된 설정이 있는지 확인
            let savedSettings = null;
            
            // 1. 현재 이미지 설정 확인
            const currentImageStorageKey = `msa6_scalebar_${currentImageKey}`;
            savedSettings = localStorage.getItem(currentImageStorageKey);
            
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                console.log(`[restoreScaleBarSettings] 1) 현재 이미지 설정 찾음 -> localStorage[${currentImageStorageKey}]`, settings);
                
                // 저장된 측정 방식, 값, 단위 복원
                this.scaleMethod = settings.scaleMethod || 'scaleBar';
                this.scaleBarValue = settings.scaleBarValue || 500;
                this.scaleBarUnit = settings.scaleBarUnit || 'nm';
                
                // 값이 유효한지 확인
                const validScaleBarValue = typeof this.scaleBarValue === 'number' && this.scaleBarValue > 0;
                const validScaleBarUnit = typeof this.scaleBarUnit === 'string' && this.scaleBarUnit.trim() !== '';
                
                // 중요: 저장된 manualScaleBarSet 값을 그대로 복원
                this.manualScaleBarSet = !!settings.manualScaleBarSet;
                console.log(`[restoreScaleBarSettings] 저장된 manualScaleBarSet 값 복원: ${this.manualScaleBarSet}`);
                
                // 배율 설정 복원
                if (settings.magnification) this.magnification = settings.magnification;
                
                // manualScaleBarSet이 true인 경우 scaleBarDetected도 true로 설정
                this.scaleBarDetected = this.manualScaleBarSet;
                
                console.log(`[restoreScaleBarSettings] 현재 이미지 설정 복원 완료:`, {
                    scaleMethod: this.scaleMethod,
                    scaleBarValue: this.scaleBarValue,
                    scaleBarUnit: this.scaleBarUnit,
                    manualScaleBarSet: this.manualScaleBarSet,
                    scaleBarDetected: this.scaleBarDetected,
                    magnification: this.magnification
                });
                
                
                return true;
      } else {
                console.log(`[restoreScaleBarSettings] 1) 현재 이미지 설정 없음 -> localStorage[${currentImageStorageKey}]`);
            }
            
            // 2. 마지막 이미지 설정 확인 (현재 이미지와 다른 경우)
            if (lastImageKey && lastImageKey !== currentImageKey) {
                const lastImageStorageKey = `msa6_scalebar_${lastImageKey}`;
                savedSettings = localStorage.getItem(lastImageStorageKey);
                
                if (savedSettings) {
                    const settings = JSON.parse(savedSettings);
                    console.log(`[restoreScaleBarSettings] 2) 마지막 이미지 설정 찾음 -> localStorage[${lastImageStorageKey}]`, settings);
                    
                    // 저장된 측정 방식, 값, 단위 복원
                    this.scaleMethod = settings.scaleMethod || 'scaleBar';
                    this.scaleBarValue = settings.scaleBarValue || 500;
                    this.scaleBarUnit = settings.scaleBarUnit || 'nm';
                    
                    // 중요: 저장된 manualScaleBarSet 값을 그대로 복원
                    this.manualScaleBarSet = !!settings.manualScaleBarSet;
                    console.log(`[restoreScaleBarSettings] 마지막 이미지의 manualScaleBarSet 값 복원: ${this.manualScaleBarSet}`);
                    
                    // 배율 설정 복원
                    if (settings.magnification) this.magnification = settings.magnification;
                    
                    // manualScaleBarSet이 true인 경우 scaleBarDetected도 true로 설정
                    this.scaleBarDetected = this.manualScaleBarSet;
                    
                    console.log(`[restoreScaleBarSettings] 마지막 이미지 설정 복원 완료:`, {
                        scaleMethod: this.scaleMethod,
                        scaleBarValue: this.scaleBarValue,
                        scaleBarUnit: this.scaleBarUnit,
                        manualScaleBarSet: this.manualScaleBarSet,
                        scaleBarDetected: this.scaleBarDetected,
                        magnification: this.magnification
                    });
                    
                    // 현재 이미지 키를 사용하여 설정 저장 (다음에 열 때 이 설정 사용)
                    this.saveScaleBarSettings();
                    
                    return true;
                } else {
                    console.log(`[restoreScaleBarSettings] 2) 마지막 이미지 설정 없음 -> localStorage[${lastImageStorageKey}]`);
                }
            } else {
                console.log(`[restoreScaleBarSettings] 2) 마지막 이미지 키가 없거나 현재 이미지와 동일하여 확인 건너뜀`);
            }
            
            // 3. 전역 설정 확인
            const globalSettings = localStorage.getItem('msa6_scalebar_global');
            if (globalSettings) {
                const settings = JSON.parse(globalSettings);
                console.log('[restoreScaleBarSettings] 3) 전역 설정 찾음 -> localStorage[msa6_scalebar_global]', settings);
                
                // 저장된 측정 방식, 값, 단위 복원
                this.scaleMethod = settings.lastScaleMethod || 'scaleBar';
                this.scaleBarValue = settings.lastScaleBarValue || 500;
                this.scaleBarUnit = settings.lastScaleBarUnit || 'nm';
                
                // 중요: 전역 설정에서도 manualScaleBarSet 값 복원
                this.manualScaleBarSet = !!settings.lastManualScaleBarSet;
                console.log(`[restoreScaleBarSettings] 전역 설정의 manualScaleBarSet 값 복원: ${this.manualScaleBarSet}`);
                
                // 배율 설정 복원
                if (settings.lastMagnification) this.magnification = settings.lastMagnification;
                
                // manualScaleBarSet이 true인 경우 scaleBarDetected도 true로 설정
                this.scaleBarDetected = this.manualScaleBarSet;
                
                console.log(`[restoreScaleBarSettings] 전역 설정 복원 완료:`, {
                    scaleMethod: this.scaleMethod,
                    scaleBarValue: this.scaleBarValue,
                    scaleBarUnit: this.scaleBarUnit,
                    manualScaleBarSet: this.manualScaleBarSet,
                    scaleBarDetected: this.scaleBarDetected,
                    magnification: this.magnification
                });
                
                
                return true;
            } else {
                console.log(`[restoreScaleBarSettings] 3) 전역 설정 없음 -> localStorage[msa6_scalebar_global]`);
            }
            
            // 설정이 없는 경우 기본값 설정
            this.scaleMethod = 'scaleBar';
            this.scaleBarValue = 500;
            this.scaleBarUnit = 'nm';
            this.manualScaleBarSet = false;
        this.scaleBarDetected = false;
            
            console.log('[restoreScaleBarSettings] 저장된 설정 없음, 기본값 설정:', {
                scaleMethod: this.scaleMethod,
                scaleBarValue: this.scaleBarValue,
                scaleBarUnit: this.scaleBarUnit,
                manualScaleBarSet: this.manualScaleBarSet,
                scaleBarDetected: this.scaleBarDetected
            });
            return false;
        } catch (e) {
            console.error('[restoreScaleBarSettings] 복원 오류:', e);
            
            // 오류 발생 시에도 기본값 설정
            this.scaleMethod = 'scaleBar';
            this.scaleBarValue = 500;
            this.scaleBarUnit = 'nm';
        this.manualScaleBarSet = false;
            this.scaleBarDetected = false;
            
            console.log('[restoreScaleBarSettings] 오류 발생으로 기본값 설정');
            return false;
      }
    },
    
    // 스케일 방식 선택 메서드 수정
    selectScaleMethod(method) {
      console.log(`[selectScaleMethod] 사용자가 선택한 측정 방식: ${method}, 이전 방식: ${this.scaleMethod}`);
      
      // 선택 팝업 닫기 - showScaleChoicePopup 플래그 설정
      this.showScaleChoicePopup = false;
      
      // DOM 요소도 직접 제어하여 확실하게 팝업 숨기기 (v-show 문제 해결)
      this.$nextTick(() => {
        const popupElement = document.querySelector('.scale-choice-popup');
        if (popupElement) {
          popupElement.style.display = 'none';
          console.log('[selectScaleMethod] 팝업 요소 직접 숨김 처리');
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
        console.log('[handleScaleBarValueInput] 스케일바 값 입력 처리');
        
        const numValue = parseFloat(this.tempScaleBarValue);
        if (isNaN(numValue) || numValue <= 0) {
            alert('유효한 양수를 입력해주세요.');
            return;
        }
        
        console.log(`[handleScaleBarValueInput] 입력값: ${numValue} ${this.tempScaleBarUnit}`);
        
        // 스케일바 값 설정
        this.scaleBarValue = numValue;
        this.scaleBarUnit = this.tempScaleBarUnit;
        this.showScaleBarInputDialog = false;
        
        // 수동 스케일바 설정 플래그 업데이트 - 사용자가 직접 그린 경우에만 true로 설정
        if (this.manualScaleBar) {
            this.manualScaleBarSet = true;
            console.log(`[handleScaleBarValueInput] 사용자가 직접 그린 스케일바에 대해 manualScaleBarSet 플래그를 true로 설정`);
            
            // 스케일바 감지 상태도 true로 설정
            this.scaleBarDetected = true;
        } else {
            console.log(`[handleScaleBarValueInput] 사용자가 직접 그린 스케일바가 없어 manualScaleBarSet 플래그를 변경하지 않음`);
        }
        
        // 현재 상태 확인 로깅
        console.log(`[handleScaleBarValueInput] 저장 전 상태 확인:`, {
          scaleMethod: this.scaleMethod,
          scaleBarValue: this.scaleBarValue,
          scaleBarUnit: this.scaleBarUnit,
            manualScaleBarSet: this.manualScaleBarSet,
            scaleBarDetected: this.scaleBarDetected
        });
        
        // 설정 저장
        console.log(`[handleScaleBarValueInput] saveScaleBarSettings 호출하여 설정 저장`);
        this.saveScaleBarSettings();
        
        // 저장 후 상태 확인 로깅
        console.log(`[handleScaleBarValueInput] 설정 저장 후 manualScaleBarSet: ${this.manualScaleBarSet}`);
        
        console.log('[handleScaleBarValueInput] 스케일바 값 설정 완료:', this.scaleBarValue, this.scaleBarUnit);
        this.showNotification(`스케일바 값이 ${this.scaleBarValue} ${this.scaleBarUnit}로 설정되었습니다.`, 'success');
        
        // 측정 모드로 전환 (중요: scaleMethod는 'scaleBar'로 유지하면서 measurementMode만 'line'으로 변경)
        this.isDrawingScaleBar = false;
        this.measurementMode = 'line';
        
        // 추가 알림 표시 - 선 측정 모드 전환 안내
        this.showNotification('선 측정 모드로 자동 전환되었습니다.', 'info');
        
        console.log('[handleScaleBarValueInput] 선 측정 모드로 자동 전환:', 
            'scaleMethod:', this.scaleMethod,
            'measurementMode:', this.measurementMode);
        
        // 캔버스 다시 그리기
        this.render();
    },
    // 스케일바 값 입력 다이얼로그 표시 메소드 추가
    showScaleBarValueDialog() {
        console.log('[showScaleBarValueDialog] 스케일바 값 입력 다이얼로그 표시');
        
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
      if (!this.$refs.magnifierCanvas) return;
      
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
      console.log('[handleMSA5ImageProcessed] MSA5 이미지 처리 완료 이벤트 수신', event.type);
      
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
          console.log('[handleMSA5ImageProcessed] MSA5 프로세스 시작 감지됨, manualScaleBarSet 초기화 (true -> false)');
          this.manualScaleBarSet = false;
          this.scaleBarDetected = false;
          
          // 수동 스케일바 객체도 초기화
          this.manualScaleBar = null;
          
          // 설정 저장하여 초기화된 상태 유지
          this.saveScaleBarSettings();
        }
      
        // 측정 결과 초기화 - Process Start 버튼 누를 때 측정 결과도 함께 초기화
        console.log('[handleMSA5ImageProcessed] 측정 결과 초기화');
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
            console.log('[handleMSA5ImageProcessed] 캔버스 초기화');
            this.render();
          }
        });
      
        // 자동 팝업 열림 방지 플래그 확인
        const noPopup = data.noPopup || sessionStorage.getItem('msa6_no_auto_popup') === 'true';
        
        if (noPopup) {
          console.log('[handleMSA5ImageProcessed] 자동 팝업 열림 방지 플래그가 설정되어 있어 팝업을 열지 않습니다');
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
        console.log(`[handleMSA5ImageProcessed] 이미지 형식: ${imageFormat}`);
        
        // 세션 스토리지에 이미지 형식 저장
        sessionStorage.setItem('msa5_end_image_format', imageFormat);
        
        // ⚠️ 주의: 이 플래그는 MSA5 프로세스 시작 시 스케일바 팝업이 뜨지 않도록 방지합니다. 제거하지 마세요! ⚠️
        // 중요: 스케일바 자동 감지 팝업 방지 플래그 설정
        // MSA5 프로세스 시작 시에는 자동으로 스케일바 감지 팝업이 표시되지 않도록 함
        sessionStorage.setItem('msa6_no_scale_popup', 'true');
        console.log('[handleMSA5ImageProcessed] 스케일바 자동 감지 팝업 방지 플래그 설정');
        
        // 팝업 열기
        this.openPopup(imageUrl);
        
        // 팝업을 열고 이미지 로드가 완료된 후 측정 모드 설정
        setTimeout(() => {
          this.fetchMSA5Images(); // 시작/종료 이미지 가져오기
          
          // 토글 이미지가 가능한지 확인
          if (this.internalInputImageUrl && this.outputImageUrl) {
            console.log('[handleMSA5ImageProcessed] 시작/종료 이미지가 모두 있어 토글 가능');
            
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
        // 현재 표시된 이미지 URL 가져오기
        const imageUrl = this.isShowingInputImage ? this.internalInputImageUrl : this.outputImageUrl;
        
        if (!imageUrl) {
          this.showNotification('다운로드할 이미지가 없습니다.', 'error');
          return;
        }
        
        // 이미지 형식 확인
        let imageFormat = sessionStorage.getItem('msa5_end_image_format') || 'png';
        console.log(`[downloadResultImage] 이미지 형식: ${imageFormat}`);
        
        // 파일명 생성
        const timestamp = new Date().toISOString().replace(/[-:.]/g, '').substring(0, 14);
        const fileName = `image_result_${timestamp}.${imageFormat}`;
        
        // 다운로드 링크 생성
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = fileName;
        link.style.display = 'none';
        
        // 링크를 DOM에 추가하고 클릭
        document.body.appendChild(link);
        link.click();
        
        // 링크 제거
        setTimeout(() => {
          document.body.removeChild(link);
        }, 100);
        
        this.showNotification(`이미지가 ${fileName} 파일로 다운로드되었습니다.`, 'success');
        console.log(`[downloadResultImage] 이미지 다운로드 완료: ${fileName}`);
      } catch (error) {
        console.error('[downloadResultImage] 이미지 다운로드 중 오류:', error);
        this.showNotification('이미지 다운로드 중 오류가 발생했습니다.', 'error');
      }
    },
    // 이미지 팝업을 열기 위한 메소드 수정
    openPopup(imageUrl) {
      console.log('[openPopup] 함수 호출됨, 이미지 URL:', imageUrl);
      
      // Use the local variable instead of the prop directly
      this.isVisible = true;
      
      // Emit an event to let parent know we want to update the prop
      this.$emit('update:showPopup', true);
      
      // 세션 스토리지에서 팝업 자동 표시 방지 플래그 확인 및 초기화
      const noAutoPopup = sessionStorage.getItem('msa6_no_auto_popup') === 'true';
      if (noAutoPopup) {
        console.log('[openPopup] 자동 팝업 방지 플래그가 설정되어 있음, 초기화함');
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
        console.log('[openPopup] $nextTick 실행');
        
        // 팝업 요소들 직접 찾아서 표시
        const measurementPopup = document.querySelector('.image-measurement-popup');
        if (measurementPopup) {
          measurementPopup.style.display = 'flex';
          measurementPopup.style.visibility = 'visible';
          console.log('[openPopup] 측정 팝업 요소 표시 설정 완료');
        } else {
          console.warn('[openPopup] 측정 팝업 요소를 찾을 수 없음');
        }
        
        // Teleport 컨테이너도 표시
        const teleportElements = document.querySelectorAll('.msa6-image-popup-container');
        teleportElements.forEach(element => {
          element.style.display = 'block';
          element.style.visibility = 'visible';
          console.log('[openPopup] Teleport 컨테이너 표시 처리');
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
      
      console.log('[fetchMSA5Images] 세션 스토리지에서 이미지 확인:', 
        '시작=', startImage ? startImage.substring(0, 20) + '...' : '없음', 
        '종료=', endImage ? endImage.substring(0, 20) + '...' : '없음',
        '형식=', imageFormat);
      
      // 세션 스토리지에서 이미지가 없는 경우 로컬 스토리지 확인
      if (!startImage) {
        console.log('[fetchMSA5Images] 세션 스토리지에 시작 이미지 없음, 로컬 스토리지 확인');
        
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
                console.log('[fetchMSA5Images] 로컬 스토리지에서 시작 이미지 찾음');
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
      
      console.log('[fetchMSA5Images] 이미지 URL 설정 - 입력:', 
        this.internalInputImageUrl ? this.internalInputImageUrl.substring(0, 20) + '...' : '없음', 
        '출력:', this.outputImageUrl ? this.outputImageUrl.substring(0, 20) + '...' : '없음',
        '형식:', imageFormat);
      
      // 전환 버튼 표시 여부 결정
      if (this.internalInputImageUrl && this.outputImageUrl) {
        console.log('[fetchMSA5Images] 전환 버튼 표시 가능');
      } else {
        console.log('[fetchMSA5Images] 전환 버튼 표시 불가 - 이미지 부족');
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
      
      console.log(`[toggleScaleBarDrawing] 스케일바 그리기 모드 ${this.isDrawingScaleBar ? '활성화' : '비활성화'}`);
      
      if (this.isDrawingScaleBar) {
        // 스케일바 그리기 모드 활성화 시 측정 모드도 변경
            this.measurementMode = 'scaleBar';
        // 알림 메시지 제거 - UI에 영향을 주지 않도록
        // this.showNotification('수동 스케일바 그리기 모드가 활성화되었습니다. 이미지의 스케일바 위에 선을 그려주세요.', 'info');
        
        // 기존 설정 유지 (그리기 시작 전에 manualScaleBarSet을 변경하지 않음)
        console.log(`[toggleScaleBarDrawing] 그리기 모드 활성화 - 현재 manualScaleBarSet: ${this.manualScaleBarSet}`);
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
      console.log('돋보기 숨기기');
    },
    // 1. First, add the blobToBase64 helper function before the saveWithTableName method
    /**
     * Blob URL을 Base64 데이터 URL로 변환
     */
    async blobToBase64(blobUrl) {
      try {
        // 이미 data URL이면 변환하지 않음
        if (blobUrl.startsWith('data:')) {
          console.log('[blobToBase64] 이미 Data URL 형식입니다. 변환 불필요');
          return blobUrl;
        }
        
        console.log('[blobToBase64] Blob URL을 Base64로 변환 시작:', blobUrl.substring(0, 50) + '...');
        const response = await fetch(blobUrl);
        
        if (!response.ok) {
          throw new Error(`Blob URL 가져오기 실패: ${response.status}`);
        }
        
        const blob = await response.blob();
        console.log('[blobToBase64] Blob 정보:', {
          type: blob.type,
          size: blob.size + ' bytes',
          lastModified: blob.lastModified ? new Date(blob.lastModified).toISOString() : 'N/A'
        });
        
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result;
            console.log('[blobToBase64] Base64 변환 완료 (길이):', result.length);
            resolve(result);
          };
          reader.onerror = (e) => {
            console.error('[blobToBase64] FileReader 오류:', e);
            reject(new Error('이미지 읽기 오류'));
          };
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        console.error('[blobToBase64] Base64 변환 중 오류:', error);
        // 오류 발생 시 원본 URL 반환 (API에서 처리 가능한지 시도)
        return blobUrl;
      }
    },

    // 2. Now update the saveWithTableName method to use base64 conversion
    async saveWithTableName(selectedTable) {
      try {
        console.log('[saveWithTableName] localStorage 항목:');
        
        // 사용자 정보 추출 시도
        let userName = '측정사용자';
        
        // 객체에서 사용자 이름 추출하는 헬퍼 함수
        const extractUserNameFromObject = (userObject) => {
          // 객체에서 이름 관련 필드 확인
          const nameFields = ['name', 'userName', 'username', 'loginId', 'id', 'email'];
          for(const field of nameFields) {
            if(userObject[field]) {
              return userObject[field];
            }
          }
          return '측정사용자';
        };
        
        // 1. localStorage에서 사용자 정보 찾기
        const userKeys = ['userName', 'user_name', 'username', 'user', 'loginId', 'login_id', 'id', 'email'];
        
        for(const key of userKeys) {
          const value = localStorage.getItem(key);
          if(value && value !== 'undefined' && value !== 'null') {
            try {
              // JSON 데이터 파싱 시도
              const parsed = JSON.parse(value);
              
              // 객체인 경우 필드 확인
              if(typeof parsed === 'object' && parsed !== null) {
                userName = extractUserNameFromObject(parsed);
                console.log(`[saveWithTableName] localStorage[${key}]에서 사용자 이름 찾음: ${userName}`);
                break;
              } else if(typeof parsed === 'string') {
                userName = parsed;
                console.log(`[saveWithTableName] localStorage[${key}]에서 사용자 이름 찾음: ${userName}`);
                break;
              }
            } catch(e) {
              // JSON 파싱 실패하면 문자열로 처리
              if(typeof value === 'string') {
                userName = value;
                console.log(`[saveWithTableName] localStorage[${key}] 문자열로 사용자 이름 찾음: ${userName}`);
                break;
              }
            }
          }
        }
        
        // 2. document.cookie에서 사용자 정보 확인
        if(userName === '측정사용자' && document.cookie) {
          const cookies = document.cookie.split(';');
          for(const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if(['userName', 'user_name', 'username', 'user'].includes(name.toLowerCase())) {
              try {
                userName = decodeURIComponent(value);
                console.log(`[saveWithTableName] 쿠키에서 사용자 이름 찾음: ${userName}`);
                break;
              } catch(e) {
                console.error(`[saveWithTableName] 쿠키 디코딩 오류:`, e);
              }
            }
          }
        }
        
        // 3. sessionStorage에서 사용자 정보 확인
        if(userName === '측정사용자') {
          for(const key of userKeys) {
            const value = sessionStorage.getItem(key);
            if(value && value !== 'undefined' && value !== 'null') {
              try {
                const parsed = JSON.parse(value);
                if(typeof parsed === 'object' && parsed !== null) {
                  userName = extractUserNameFromObject(parsed);
                  console.log(`[saveWithTableName] sessionStorage[${key}]에서 사용자 이름 찾음: ${userName}`);
                  break;
                } else if(typeof parsed === 'string') {
                  userName = parsed;
                  console.log(`[saveWithTableName] sessionStorage[${key}]에서 사용자 이름 찾음: ${userName}`);
                  break;
                }
              } catch(e) {
                if(typeof value === 'string') {
                  userName = value;
                  console.log(`[saveWithTableName] sessionStorage[${key}] 문자열로 사용자 이름 찾음: ${userName}`);
                  break;
                }
              }
            }
          }
        }
        
        // 4. 마지막 수단: window 객체에서 전역 사용자 정보 확인
        if(userName === '측정사용자' && window.currentUser) {
          userName = typeof window.currentUser === 'string' ? 
                     window.currentUser : 
                     (window.currentUser.name || window.currentUser.userName || window.currentUser.username || window.currentUser.id);
          console.log(`[saveWithTableName] window 객체에서 사용자 이름 찾음: ${userName}`);
        }
        
        // 5. 이름만 추출 (이메일 주소인 경우)
        if(userName.includes('@')) {
          userName = userName.split('@')[0];
          console.log(`[saveWithTableName] 이메일에서 사용자 이름 추출: ${userName}`);
        }
        
        console.log(`[saveWithTableName] 최종 결정된 사용자 이름: ${userName}`);
        
        // lot_wafer는 테이블 선택기에서 입력받은 값 사용
        const lot_wafer = selectedTable.lot_wafer;
        if(!lot_wafer) {
          throw new Error('Lot Wafer 정보가 없습니다.');
        }
        
        console.log(`[saveWithTableName] 사용할 lot_wafer 값: ${lot_wafer}`);
        
        // 1. 먼저 이미지 저장
        if(this.imageUrl) {
          try {
            console.log('[saveWithTableName] 이미지 저장 시작');
            console.log('[saveWithTableName] Before 이미지 URL:', this.inputImageUrl ? this.inputImageUrl.substring(0, 50) + '...' : 'none');
            console.log('[saveWithTableName] After 이미지 URL:', this.imageUrl ? this.imageUrl.substring(0, 50) + '...' : 'none');
            
            // 이미지 URL이 유효한지 확인
            if(!this.inputImageUrl || !this.imageUrl) {
              console.warn('[saveWithTableName] 이미지 URL이 없습니다!');
              console.log('[saveWithTableName] Before 이미지 상태:', this.inputImageUrl ? '있음' : '없음');
              console.log('[saveWithTableName] After 이미지 상태:', this.imageUrl ? '있음' : '없음');
            }
            
            // *** MSA5 방식과 동일하게 Base64로 변환 ***
            console.log('[saveWithTableName] 이미지를 Base64로 변환 시작');
            const beforeImageBase64 = await this.blobToBase64(this.inputImageUrl || '');
            const afterImageBase64 = await this.blobToBase64(this.imageUrl);
            
            console.log('[saveWithTableName] 이미지 변환 완료');
            console.log('[saveWithTableName] Before 이미지 타입:', beforeImageBase64.startsWith('data:') ? beforeImageBase64.substring(0, 30) + '...' : '일반 URL');
            console.log('[saveWithTableName] After 이미지 타입:', afterImageBase64.startsWith('data:') ? afterImageBase64.substring(0, 30) + '...' : '일반 URL');
            
            // 이미지 저장 요청 데이터 구성
            const requestData = {
              title: `${selectedTable.table_name}_${lot_wafer}`,
              description: `${selectedTable.table_name}에 저장된 ${lot_wafer} 측정 이미지`,
              before_image: beforeImageBase64,
              after_image: afterImageBase64,
              workflow_id: '',
              tags: ['msa6', '측정'],
              is_result: true,  // MSA6 결과 이미지임을 명시
              table_name: selectedTable.table_name,
              lot_wafer: lot_wafer
            };
            
            console.log('[saveWithTableName] 이미지 저장 요청 데이터 준비 완료');
            
            // 외부 이미지 저장 API 호출
            const imageResponse = await fetch('http://localhost:8000/api/external_storage/save-images', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              body: JSON.stringify(requestData)
            });
            
            if (!imageResponse.ok) {
              const errorText = await imageResponse.text();
              console.error('[saveWithTableName] 이미지 저장 API 오류:', imageResponse.status, errorText);
              console.warn('[saveWithTableName] 이미지 저장에 실패했지만 측정 데이터 저장은 계속합니다.');
              
              // FormData 방식으로 재시도
              try {
                console.log('[saveWithTableName] FormData 방식으로 이미지 저장 재시도');
                
                // 이미지를 Blob으로 변환
                const beforeBlob = await (async () => {
                  if (this.inputImageUrl && this.inputImageUrl.startsWith('data:')) {
                    const res = await fetch(this.inputImageUrl);
                    return await res.blob();
                  } else if (this.inputImageUrl && this.inputImageUrl.startsWith('blob:')) {
                    const res = await fetch(this.inputImageUrl);
                    return await res.blob();
                  } else if (this.inputImageUrl) {
                    const res = await fetch(this.inputImageUrl);
                    return await res.blob();
                  } else {
                    // Before 이미지가 없는 경우 빈 Blob 생성
                    return new Blob([''], { type: 'image/png' });
                  }
                })();
                
                const afterBlob = await (async () => {
                  if (this.imageUrl.startsWith('data:')) {
                    const res = await fetch(this.imageUrl);
                    return await res.blob();
                  } else if (this.imageUrl.startsWith('blob:')) {
                    const res = await fetch(this.imageUrl);
                    return await res.blob();
                  } else {
                    const res = await fetch(this.imageUrl);
                    return await res.blob();
                  }
                })();
                
                console.log('[saveWithTableName] Blob 변환 완료');
                console.log('[saveWithTableName] Before Blob 타입:', beforeBlob.type, 'Size:', beforeBlob.size);
                console.log('[saveWithTableName] After Blob 타입:', afterBlob.type, 'Size:', afterBlob.size);
                
                // FormData 구성
                const formData = new FormData();
                formData.append('title', requestData.title);
                formData.append('description', requestData.description);
                
                // Before 이미지가 있는 경우에만 추가
                if (this.inputImageUrl) {
                  formData.append('before_file', beforeBlob, `before_${lot_wafer}.${beforeBlob.type.split('/')[1] || 'png'}`);
                }
                
                // After 이미지 항상 추가 (필수)
                formData.append('file', afterBlob, `after_${lot_wafer}.${afterBlob.type.split('/')[1] || 'png'}`);
                formData.append('workflow_id', '');
                formData.append('tags', JSON.stringify(['msa6', '측정']));
                formData.append('is_result', 'true');
                formData.append('table_name', selectedTable.table_name);
                formData.append('lot_wafer', lot_wafer);
                
                console.log('[saveWithTableName] FormData 구성 완료, API 요청 시작...');
                
                // FormData API 호출
                const formResponse = await fetch('http://localhost:8000/api/external_storage/upload-file', {
                  method: 'POST',
                  body: formData
                });
                
                if (!formResponse.ok) {
                  const errorText = await formResponse.text();
                  console.error('[saveWithTableName] FormData 방식 API 오류:', formResponse.status, errorText);
                  console.warn('[saveWithTableName] FormData 방식 이미지 저장에도 실패했지만 측정 데이터 저장은 계속합니다.');
                } else {
                  const formResult = await formResponse.json();
                  console.log('[saveWithTableName] FormData 방식 이미지 저장 성공:', formResult);
                  
                  // 저장된 이미지 URL 로깅
                  if (formResult.image_data) {
                    console.log('[saveWithTableName] 저장된 Before 이미지 URL:', formResult.image_data.before_url || 'none');
                    console.log('[saveWithTableName] 저장된 After 이미지 URL:', formResult.image_data.after_url || 'none');
                  }
                }
              } catch (formError) {
                console.error('[saveWithTableName] FormData 방식 이미지 저장 오류:', formError);
                console.warn('[saveWithTableName] 모든 이미지 저장 방식이 실패했지만 측정 데이터 저장은 계속합니다.');
              }
            } else {
              const imageResult = await imageResponse.json();
              console.log('[saveWithTableName] 이미지 저장 성공:', imageResult);
              
              // 저장된 이미지 URL 로깅
              if (imageResult.image_data) {
                console.log('[saveWithTableName] 저장된 Before 이미지 URL:', imageResult.image_data.before_url || 'none');
                console.log('[saveWithTableName] 저장된 After 이미지 URL:', imageResult.image_data.after_url || 'none');
              }
            }
          } catch (imageError) {
            console.error('[saveWithTableName] 이미지 저장 중 오류:', imageError);
            console.warn('[saveWithTableName] 이미지 저장에 실패했지만 측정 데이터 저장은 계속합니다.');
          }
        }
        
        // 2. 측정 데이터 저장 (기존 로직)
        // ... existing code ...
      } catch (error) {
        console.error('[saveWithTableName] 측정 결과 저장 중 오류:', error);
        this.showNotification(`측정 결과 저장 중 오류: ${error.message}`, 'error');
        
        // 로그 저장 - 측정 결과 저장 실패
        LogService.logAction('save_measurements_error', {
          error: error.message || '저장 실패'
        });
      } finally {
        this.isSaving = false;
      }
    },
  },
  created() {
    console.log('[created] MSA6 이미지 팝업 컴포넌트 생성');
    
    // 브라우저 이벤트 리스너 등록
    window.addEventListener('resize', this.handleWindowResize);
    
    // 로컬 스토리지에서 스케일바 설정 복원
    this.restoreScaleBarSettings();
    
    // 로그 저장
    LogService.logAction('msa6_popup_created', {
        imageUrl: this.imageUrl ? this.imageUrl.substring(0, 50) + '...' : 'none'
    });
  },
};
</script>

<style scoped>
.image-measurement-popup {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.measurement-container {
  background: #f8f9fa;
  border-radius: 12px;
  width: 95vw;
  height: 95vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
  position: relative;
  height: 100%;
}

.measurement-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: #7950f2;
  border-bottom: 1px solid #6741d9;
  flex-wrap: wrap;
}

.header-left {
  display: flex;
  align-items: center;
}

.header-title {
  margin: 0;
  font-size: 1.25rem;
  color: #fff;
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.measurement-options {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: wrap;
  background: rgba(255, 255, 255, 0.1);
  padding: 0.5rem;
  border-radius: 8px;
}

.option-group {
  display: flex;
  align-items: center;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  margin-right: 0.5rem;
  margin-bottom: 0.25rem;
  border-right: 1px solid rgba(255, 255, 255, 0.2);
}

.option-group:last-child {
  border-right: none;
}

.option-group-label {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.8);
  margin-right: 0.5rem;
  white-space: nowrap;
}

.option-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  width: 2.25rem;
  height: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin: 0 0.125rem;
  transition: all 0.2s;
  color: #fff;
}

.option-btn i {
  font-size: 0.9rem;
}

.btn-text {
  margin-left: 0.25rem;
}

.scale-btn {
  min-width: 4rem;
}

.reset-btn, .close-btn {
  padding: 0.375rem 0.75rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.reset-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #fff;
}

.close-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #fff;
}

/* option-btn 클래스 뒤에 hover와 active 상태 스타일 추가 */

.option-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.5);
}

.option-btn.active {
  background: #fff;
  color: #7950f2;
  border-color: #fff;
}

/* reset-btn 및 close-btn hover 상태 추가 */
.reset-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.5);
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.5);
}

.measurement-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.image-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #000;
}

.measurement-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
}

.right-panel {
  width: 400px;
  background: #fff;
  border-left: 1px solid #e9ecef;
  display: flex;
  flex-direction: column;
  height: 100%;
  /* 고정 너비 설정 - 스크롤바 너비(17px) 포함 */
  min-width: 400px;
  max-width: 400px;
  flex-shrink: 0; /* 사이드바 크기 고정 */
  overflow: hidden; /* 내부 콘텐츠 오버플로우 숨김 처리 */
}

.results-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden; /* 내부 컨텐츠가 넘칠 경우 숨김 처리 */
}

.results-table-container {
  border: 1px solid #e9ecef;
  border-radius: 8px;
  overflow: auto;
  height: 600px;
  max-height: 65vh;
  /* 스크롤바 너비를 고려한 width 설정 */
  width: calc(100% - 2px); /* 테두리 고려 */
  box-sizing: border-box; /* 테두리와 패딩을 너비에 포함 */
}

.results-bottom-bar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  gap: 1.5rem;
  padding: 1.25rem 1.5rem 1.5rem 1.5rem;
  background: #fff;
  border-top: 1px solid #e9ecef;
  flex-shrink: 0;
  position: static;
  margin-top: auto;
}

.results-bottom-bar .results-summary {
  margin: 0;
  padding: 0;
  background: none;
  font-size: 1rem;
  color: #7950f2;
  font-weight: 600;
}

.save-measurements-btn {
  padding: 12px 28px;
  background-color: #7950f2;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1.1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 4px 16px rgba(121, 80, 242, 0.12);
  transition: background 0.2s, box-shadow 0.2s;
}

.save-measurements-btn:hover:not(:disabled) {
  background-color: #6741d9;
  box-shadow: 0 6px 20px rgba(121, 80, 242, 0.18);
}

.save-measurements-btn:disabled {
  background-color: #b197fc;
  cursor: not-allowed;
}

.save-measurements-btn i {
  font-size: 20px;
}

.panel-section {
  padding: 1.5rem;
}

.id-input-panel {
  background: #f8f0ff;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 2px 8px rgba(121, 80, 242, 0.1);
}

.id-input-panel h5 {
  color: #7950f2;
  margin: 0 0 1rem 0;
  font-size: 1rem;
}

.id-input-container {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.input-group {
  flex: 1;
}

.input-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: #495057;
  font-size: 0.9rem;
  font-weight: 500;
}

.form-control {
  width: 100%;
  padding: 0.625rem;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.form-control:focus {
  border-color: #7950f2;
  outline: none;
  box-shadow: 0 0 0 3px rgba(121, 80, 242, 0.1);
}

.btn-apply {
  width: 100%;
  padding: 0.75rem;
  background: #7950f2;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-apply:hover {
  background: #6741d9;
}

.btn-apply:disabled {
  background: #dee2e6;
  cursor: not-allowed;
}

.results-table {
  width: 100%;
  border-collapse: collapse;
}

.results-table th {
  background: #f8f0ff;
  padding: 0.75rem 1rem;
  text-align: left;
  font-weight: 600;
  color: #495057;
  border-bottom: 2px solid #e9ecef;
  position: sticky;
  top: 0;
}

.results-table td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e9ecef;
  color: #495057;
}

.selected-row {
  background-color: #f3f0ff !important;
}

.results-table tr {
  cursor: pointer;
  user-select: none;
}

.results-table tr:hover {
  background-color: #f8f0ff;
}

.total-measurement {
  background-color: #e6f7ff !important;
  font-weight: bold;
}

.total-measurement td {
  border-bottom: 2px solid #7950f2;
}

.measurement-controls {
  position: absolute;
  bottom: 1.5rem;
  left: 1.5rem;
  background: rgba(0, 0, 0, 0.85);
  padding: 1rem 1.5rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  gap: 1.5rem;
  white-space: nowrap;
  max-width: calc(100% - 3rem);
  overflow-x: auto;
  z-index: 1000;
}

.measurement-controls .option-btn {
  background: #7950f2;
  color: #fff;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 120px;
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.measurement-controls .option-btn i {
  font-size: 1.2rem;
  color: #fff;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
}

.measurement-controls .option-btn:hover {
  background: #6741d9;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.measurement-controls .option-btn.active {
  background: #fff;
  color: #7950f2;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.measurement-controls .option-btn.active i {
  color: #7950f2;
  text-shadow: none;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
}

.control-label {
  color: #fff;
  font-size: 1rem;
  font-weight: 500;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
  min-width: max-content;
}

.threshold-slider {
  width: 200px;
  height: 6px;
  -webkit-appearance: none;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  outline: none;
}

.threshold-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  background: #fff;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.threshold-slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.results-summary {
  display: flex;
  justify-content: space-between;
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: #f8f0ff;
  border-radius: 6px;
  font-size: 0.9rem;
  color: #495057;
  font-weight: 500;
}

::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #f8f0ff;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #7950f2;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #6741d9;
}

.measurement-controls .control-group label {
  color: #fff;
  font-size: 1rem;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
}

.results-table td.action-buttons .option-btn {
  color: #7950f2;
  background: #fff;
  border: 1px solid #7950f2;
  padding: 8px 12px;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.results-table td.action-buttons .option-btn i {
  color: #7950f2;
  text-shadow: none;
}

.results-table td.action-buttons .option-btn:hover {
  background: #7950f2;
  color: #fff;
  transform: scale(1.05);
  transition: all 0.2s ease;
}

.results-table td.action-buttons .option-btn:hover i {
  color: #fff;
}

.circle-options-panel {
  background: #f8f0ff;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
  display: flex;
  gap: 1rem;
}

.circle-option-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px solid #7950f2;
  border-radius: 6px;
  background: #fff;
  color: #7950f2;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.circle-option-btn i {
  font-size: 1.1rem;
}

.circle-option-btn:hover {
  background: #f8f0ff;
}

.circle-option-btn.active {
  background: #7950f2;
  color: #fff;
}

.send-api-btn {
  background: #2b8a3e;
  color: #fff;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 140px;
  white-space: nowrap;
}

.send-api-btn i {
  font-size: 1.2rem;
}

.send-api-btn:hover:not(:disabled) {
  background-color: #2f9e44;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.send-api-btn:disabled {
  background: #adb5bd;
  cursor: not-allowed;
  transform: none;
}

.control-input {
  width: 60px;
  padding: 4px 8px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 0.9rem;
  text-align: center;
}

.control-input:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.2);
}

.header-input {
  width: 60px;
  padding: 4px 8px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 0.9rem;
  text-align: center;
}

.header-input:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.2);
}

.header-input.no-spinners::-webkit-inner-spin-button,
.header-input.no-spinners::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.header-input.no-spinners {
  -moz-appearance: textfield;
}

.line-count-control {
  display: flex;
  align-items: center;
  gap: 4px;
}

.count-btn {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.count-btn i {
  font-size: 0.8rem;
}

.count-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.5);
}

.count-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.reset-btn {
  padding: 0 15px;
  height: 36px;
  margin-right: 10px;
  background: #dc3545;
  color: #fff;
  border: 1px solid #dc3545;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.9rem;
}

.reset-btn i {
  margin-right: 6px;
  font-size: 1rem;
}

.reset-btn:hover {
  background: #c82333;
  border-color: #bd2130;
}

.color-palette-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.color-palette-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.5);
}

.color-picker-dropdown {
  position: absolute;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
  padding: 12px;
  z-index: 1000;
  margin-top: 5px;
  border: 1px solid #e9ecef;
}

.color-options {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.color-option {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid #dee2e6;
  transition: transform 0.2s, box-shadow 0.2s;
}

/* 단축키 도움말 관련 스타일 */
.shortcut-help-overlay {
  position: fixed;
  top: 0;
    left: 0;
  right: 0;
    bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  z-index: 9999;
  display: none;
  justify-content: center;
  align-items: center;
}

.shortcut-help-overlay.show {
  display: flex;
}

.shortcut-help-content {
  background-color: #fff;
  border-radius: 12px;
  padding: 30px;
  max-width: 600px;
  width: 90%;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  transform: translateY(50px);
    opacity: 0;
  transition: transform 0.3s, opacity 0.3s;
  pointer-events: none;
  }

.shortcut-help-content.show {
  transform: translateY(0);
    opacity: 1;
  pointer-events: auto;
}

.shortcut-help-content h2 {
  color: #7950f2;
  margin-top: 0;
  margin-bottom: 20px;
  text-align: center;
  font-size: 1.5rem;
}

.shortcut-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 15px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 10px;
  border-radius: 8px;
  background-color: #f8f0ff;
}

.shortcut-key {
  background-color: #7950f2;
  color: white;
  padding: 5px 10px;
  border-radius: 5px;
  font-weight: bold;
  min-width: 40px;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.shortcut-desc {
  color: #495057;
  font-size: 0.9rem;
}

/* 알림 메시지 스타일 개선 */
.notification {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 20px;
  border-radius: 6px;
  color: white;
  font-weight: 500;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
  z-index: 10000;
  max-width: 90%;
  text-align: center;
  pointer-events: none;
  animation: fadeInOut 3s ease-in-out;
}

.notification.info {
  background-color: rgba(25, 118, 210, 0.9);
}

.notification.success {
  background-color: rgba(46, 125, 50, 0.9);
}

.notification.warning {
  background-color: rgba(237, 108, 2, 0.9);
}

.notification.error {
  background-color: rgba(211, 47, 47, 0.9);
}

@keyframes fadeInOut {
  0%, 100% { opacity: 0; }
  10%, 90% { opacity: 1; }
}

/* 돋보기 관련 스타일 */
.brightness-tooltip {
  position: absolute;
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 12px;
  z-index: 1000;
  pointer-events: none;
}

.magnifier-container {
  position: absolute;
  z-index: 1001;
  border: 2px solid #ff9900;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
  pointer-events: none;
  background-color: white;
}

.magnifier-canvas {
    width: 100%;
  height: 100%;
}

.magnifier-crosshair {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20px;
  height: 20px;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.magnifier-crosshair::before,
.magnifier-crosshair::after {
  content: '';
  position: absolute;
  background-color: rgba(255, 0, 0, 0.7);
}

.magnifier-crosshair::before {
  top: 50%;
  left: 0;
    width: 100%;
  height: 1px;
  transform: translateY(-50%);
}

.magnifier-crosshair::after {
  top: 0;
  left: 50%;
  width: 1px;
  height: 100%;
  transform: translateX(-50%);
}

.magnifier-brightness {
  position: absolute;
  bottom: 5px;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

</style>

