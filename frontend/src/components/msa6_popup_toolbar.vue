<template>
  <div class="measurement-header">
    <div class="header-left">
      <h3 class="header-title">이미지 측정 도구</h3>
    </div>

    <div class="header-right">
      <div class="measurement-options">
        <!-- 배율/스케일바 선택 옵션 -->
        <div class="option-group scale-option-group">
          <span class="option-group-label">측정 방식</span>
          <div class="scale-method-selector">
            <button class="option-btn scale-btn" :class="{ active: scaleMethod === 'magnification' }"
              @click="$emit('update:scaleMethod', 'magnification')" title="배율 기반 측정">
              <i class="fas fa-search-plus"></i><span class="btn-text">배율</span>
            </button>
            <button class="option-btn scale-btn" :class="{ active: scaleMethod === 'scaleBar' }"
              @click="$emit('update:scaleMethod', 'scaleBar')" title="스케일바 기반 측정">
              <i class="fas fa-ruler"></i><span class="btn-text">스케일바</span>
            </button>
          </div>
        </div>

        <!-- 스케일바 모드 옵션 -->
        <div class="option-group" v-if="scaleMethod === 'scaleBar'">
          <span class="option-group-label">스케일바 설정</span>
          <button class="option-btn" :class="{ active: isDrawingScaleBar }"
            @click="$emit('toggleScaleBarDrawing')" title="수동 스케일바 그리기">
            <i class="fas fa-pencil-ruler"></i>
          </button>
          <button class="option-btn" @click="$emit('detectScaleBar')" title="자동 스케일바 감지">
            <i class="fas fa-magic"></i>
          </button>
        </div>

        <!-- 배율 설정 -->
        <div class="option-group" v-if="scaleMethod !== 'scaleBar'">
          <span class="option-group-label">배율</span>
          <input type="number" :value="magnification" @input="$emit('update:magnification', Number($event.target.value))"
            min="0.1" step="0.1" class="header-input no-spinners" title="측정 배율 설정" />
        </div>

        <!-- 스케일바 값 입력 -->
        <div class="option-group" v-if="scaleMethod === 'scaleBar'">
          <span class="option-group-label">스케일바 길이</span>
          <input type="number" :value="scaleBarValue" @input="$emit('update:scaleBarValue', Number($event.target.value))"
            min="0.1" step="0.1" class="header-input no-spinners" title="스케일바 길이" />
          <select :value="scaleBarUnit" @change="$emit('update:scaleBarUnit', $event.target.value)" class="unit-selector">
            <option value="nm">nm</option>
            <option value="μm">μm</option>
          </select>
        </div>

        <!-- 기준선 -->
        <div class="option-group">
          <span class="option-group-label">기준선</span>
          <button class="option-btn" :class="{ active: measurementMode === 'reference' }"
            @click="$emit('setMode', 'reference')" title="기준선 그리기">
            <i class="fas fa-ruler"></i>
          </button>
          <button class="option-btn color-palette-btn" @click="$emit('toggleReferenceColorPicker')" title="기준선 색상 선택">
            <i class="fas fa-palette" :style="{ color: referenceLineColor }"></i>
          </button>
          <div v-if="showReferenceColorPicker" class="color-picker-dropdown">
            <div class="color-options">
              <div v-for="color in referenceColorOptions" :key="color"
                class="color-option" :style="{ backgroundColor: color }"
                @click="$emit('selectReferenceColor', color)"></div>
            </div>
          </div>
        </div>

        <!-- 선 측정 -->
        <div class="option-group">
          <span class="option-group-label">선 측정</span>
          <button class="option-btn" :class="{ active: measurementMode === 'line' }"
            @click="$emit('setMode', 'line')" title="단일 선 측정">
            <i class="fas fa-ruler-horizontal"></i>
          </button>
        </div>

        <!-- 선 개수 -->
        <div class="option-group">
          <span class="option-group-label">선 개수</span>
          <div class="line-count-control">
            <button class="count-btn" @click="$emit('decreaseLineCount')" :disabled="lineCount <= 2">
              <i class="fas fa-minus"></i>
            </button>
            <input type="number" :value="lineCount" @input="$emit('update:lineCount', Number($event.target.value))"
              min="2" max="20" class="header-input" title="영역 측정 선 개수" />
            <button class="count-btn" @click="$emit('increaseLineCount')" :disabled="lineCount >= 20">
              <i class="fas fa-plus"></i>
            </button>
          </div>
        </div>

        <!-- 영역 -->
        <div class="option-group">
          <span class="option-group-label">영역</span>
          <button class="option-btn" :class="{ active: measurementMode === 'area-vertical' }"
            @click="$emit('setMode', 'area-vertical')" title="세로 방향 영역 측정">
            <i class="fas fa-grip-lines-vertical"></i>
          </button>
          <button class="option-btn" :class="{ active: measurementMode === 'area-horizontal' }"
            @click="$emit('setMode', 'area-horizontal')" title="가로 방향 영역 측정">
            <i class="fas fa-grip-lines"></i>
          </button>
        </div>

        <!-- 삭제 -->
        <div class="option-group">
          <span class="option-group-label">삭제</span>
          <button class="option-btn" :class="{ active: isDeleteMode }"
            @click="$emit('toggleDeleteMode')" title="측정값 삭제 (D)">
            <i class="fas fa-trash"></i>
          </button>
        </div>

        <!-- 불량 감지 -->
        <div class="option-group">
          <span class="option-group-label">불량 감지</span>
          <button class="option-btn" :class="{ active: measurementMode === 'defect' }"
            :disabled="isDefectDetecting" @click="$emit('setMode', 'defect')" title="불량 감지">
            <i class="fas fa-search"></i>
          </button>
        </div>
      </div>

      <button class="reset-btn" :disabled="isDefectDetecting"
        @click="$emit('showResetConfirmation')" title="모든 측정 결과 초기화">
        <i class="fas fa-trash-alt"></i> <span class="btn-text">초기화</span>
      </button>
      <button class="close-btn" :disabled="isDefectDetecting" @click="$emit('closePopup')">
        <i class="fas fa-times"></i>
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'MSA6PopupToolbar',
  props: {
    scaleMethod: { type: String, default: 'magnification' },
    magnification: { type: Number, default: 1 },
    scaleBarValue: { type: Number, default: 500 },
    scaleBarUnit: { type: String, default: 'nm' },
    isDrawingScaleBar: { type: Boolean, default: false },
    measurementMode: { type: String, default: 'line' },
    referenceLineColor: { type: String, default: '#ff0000' },
    showReferenceColorPicker: { type: Boolean, default: false },
    referenceColorOptions: { type: Array, default: () => [] },
    lineCount: { type: Number, default: 5 },
    isDeleteMode: { type: Boolean, default: false },
    isDefectDetecting: { type: Boolean, default: false },
  },
  emits: [
    'update:scaleMethod', 'update:magnification', 'update:scaleBarValue',
    'update:scaleBarUnit', 'update:lineCount',
    'toggleScaleBarDrawing', 'detectScaleBar', 'setMode',
    'toggleReferenceColorPicker', 'selectReferenceColor',
    'decreaseLineCount', 'increaseLineCount',
    'toggleDeleteMode', 'showResetConfirmation', 'closePopup',
  ],
}
</script>

<style scoped>
</style>
