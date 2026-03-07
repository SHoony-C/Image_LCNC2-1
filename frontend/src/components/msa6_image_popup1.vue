<template>
  <div class="msa6-image-popup-container">
  <Teleport to="body">
      <div class="image-measurement-popup" v-show="isVisible">

      <MSA6PopupOverlays
        :isDefectDetecting="isDefectDetecting"
        :showShortcutHelp="showShortcutHelp"
        :showResetConfirmPopup="showResetConfirmPopup"
        @emergencyStop="emergencyStopDetection"
        @cancelReset="cancelReset"
        @confirmReset="confirmReset"
      />

      <div class="measurement-container" @click.stop>
        <MSA6PopupToolbar
          :scaleMethod="scaleMethod"
          :magnification="magnification"
          :scaleBarValue="scaleBarValue"
          :scaleBarUnit="scaleBarUnit"
          :isDrawingScaleBar="isDrawingScaleBar"
          :measurementMode="measurementMode"
          :referenceLineColor="referenceLineColor"
          :showReferenceColorPicker="showReferenceColorPicker"
          :referenceColorOptions="referenceColorOptions"
          :lineCount="lineCount"
          :isDeleteMode="isDeleteMode"
          :isDefectDetecting="isDefectDetecting"
          @update:scaleMethod="scaleMethod = $event"
          @update:magnification="magnification = $event"
          @update:scaleBarValue="scaleBarValue = $event"
          @update:scaleBarUnit="scaleBarUnit = $event"
          @update:lineCount="lineCount = $event"
          @toggleScaleBarDrawing="toggleScaleBarDrawing"
          @detectScaleBar="detectScaleBar"
          @setMode="setMode"
          @toggleReferenceColorPicker="showReferenceColorPicker = !showReferenceColorPicker"
          @selectReferenceColor="selectReferenceColor"
          @decreaseLineCount="decreaseLineCount"
          @increaseLineCount="increaseLineCount"
          @toggleDeleteMode="toggleDeleteMode"
          @showResetConfirmation="showResetConfirmation"
          @closePopup="closePopup"
        />

        <div class="measurement-content">
          <div class="image-container" ref="container">
            <img ref="sourceImage" :src="currentImageUrl" crossorigin="anonymous"
              style="display: none;" @load="handleImageLoad" />
            <canvas ref="canvas" class="measurement-canvas"
              @mousedown.prevent.stop="startMeasurement"
              @mousemove.prevent.stop="updateMeasurement"
              @mouseup.prevent.stop="endMeasurement"
              @mouseleave.prevent.stop="endMeasurement"
              @click="handleCanvasClick"
              @mousemove="handleMouseMove"></canvas>

            <div class="brightness-tooltip" v-show="showBrightnessTooltip" :style="brightnessTooltipStyle">
              {{ currentBrightness }}
            </div>

            <div class="magnifier-container" v-show="isFKeyPressed" :style="magnifierStyle">
              <canvas ref="magnifierCanvas" class="magnifier-canvas"></canvas>
              <div class="magnifier-crosshair"></div>
              <div class="magnifier-brightness">{{ currentBrightness }}</div>
            </div>

            <div class="image-toggle-controls">
              <button
                v-if="(internalInputImageUrl || inputImageUrl) && (outputImageUrl || imageUrl)"
                class="toggle-image-btn"
                @click="toggleBeforeAfterImage"
                :title="isShowingInputImage ? '처리 후 이미지 보기' : '처리 전 이미지 보기'">
                <i class="fas" :class="isShowingInputImage ? 'fa-arrow-right' : 'fa-arrow-left'"></i>
                <span>{{ isShowingInputImage ? '처리 후' : '처리 전' }}</span>
              </button>
              <button
                v-if="(internalInputImageUrl || inputImageUrl) && (outputImageUrl || imageUrl)"
                class="copy-url-btn"
                @click="copyImageUrl"
                title="이미지 URL 클립보드에 복사">
                <i class="fas fa-copy"></i><span>URL 복사</span>
              </button>
              <button class="download-image-btn" @click="downloadResultImage"
                title="측정 결과 포함 이미지 다운로드">
                <i class="fas fa-download"></i><span>다운로드</span>
              </button>
            </div>
          </div>

          <MSA6PopupResults
            :measurementMode="measurementMode"
            :newItemId="newItemId"
            :newSubId="newSubId"
            :circleOptions="circleOptions"
            :selectedAreaRect="selectedAreaRect"
            :isApiSending="isApiSending"
            :filteredMeasurements="filteredMeasurements"
            :selectedRows="selectedRows"
            :defectMeasurements="defectMeasurements"
            :selectedDefects="selectedDefects"
            :scaleMethod="scaleMethod"
            :scaleBarUnit="scaleBarUnit"
            :currentAverage="currentAverage"
            :currentThreeSigma="currentThreeSigma"
            :showShortcutHelp="showShortcutHelp"
            :isSaving="isSaving"
            :brightnessThreshold="brightnessThreshold"
            :isReversed="isReversed"
            :applyDisabled="(measurementMode === 'defect' ? selectedDefects.length === 0 : selectedRows.length === 0) || (!newItemId && !newSubId)"
            @update:newItemId="newItemId = $event"
            @update:newSubId="newSubId = $event"
            @update:brightnessThreshold="brightnessThreshold = $event"
            @applySelectedIds="applySelectedIds"
            @toggleCircleOption="circleOptions[$event] = !circleOptions[$event]"
            @sendSelectedAreaToApi="sendSelectedAreaToApi"
            @rowMouseDown="handleRowMouseDown"
            @rowMouseEnter="handleRowMouseEnter"
            @rowMouseUp="handleRowMouseUp"
            @defectMouseDown="handleDefectMouseDown"
            @defectMouseEnter="handleDefectMouseEnter"
            @defectMouseUp="handleDefectMouseUp"
            @deleteSegment="deleteSegment"
            @downloadCSV="downloadCSV"
            @showTableSelector="showTableSelector"
            @toggleReverse="toggleReverse"
          />
        </div>
      </div>

      <TableNameSelector
        :show="showTableSelectorPopup"
        :measurementMode="measurementMode"
        @close="showTableSelectorPopup = false"
        @select="saveWithTableName"
      />

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
  </div>
</template>

<script setup>
import '@/assets/css/msa6_image_popup1.css'
import { ref } from 'vue'
import TableNameSelector from './TableNameSelector.vue'
import MSA6PopupOverlays from './msa6_popup_overlays.vue'
import MSA6PopupToolbar from './msa6_popup_toolbar.vue'
import MSA6PopupResults from './msa6_popup_results.vue'
import { useSetup } from '@/composables/msa6_useSetup.js'

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
})

const emit = defineEmits([
  'close',
  'update:showPopup',
  'update:measurements',
  'measurement-added',
  'measurement-deleted',
  'measurements-cleared',
])

const canvas = ref(null)
const container = ref(null)
const sourceImage = ref(null)
const magnifierCanvas = ref(null)

const setupResult = useSetup(props, emit, {
  canvas, container, sourceImage, magnifierCanvas,
})

const {
  notification, referenceLineColor, showReferenceColorPicker, referenceColorOptions,
  selectReferenceColor, isShowingInputImage, internalInputImageUrl, outputImageUrl,
  currentImageUrl, toggleBeforeAfterImage, copyImageUrl, downloadResultImage,
  scaleMethod, magnification, scaleBarValue, scaleBarUnit, isDrawingScaleBar,
  detectScaleBar, toggleScaleBarDrawing,
  brightnessThreshold, isReversed, isFKeyPressed, showBrightnessTooltip,
  currentBrightness, brightnessTooltipStyle, magnifierStyle, toggleReverse,
  handleImageLoad,
  measurementMode, lineCount, isDeleteMode, selectedAreaRect,
  filteredMeasurements, currentAverage, currentThreeSigma,
  increaseLineCount, decreaseLineCount, setMode, toggleDeleteMode,
  startMeasurement, updateMeasurement, endMeasurement,
  defectMeasurements, isDefectDetecting, isApiSending,
  circleOptions, sendSelectedAreaToApi, emergencyStopDetection,
  selectedRows, selectedDefects, newItemId, newSubId,
  handleRowMouseDown, handleRowMouseEnter, handleRowMouseUp,
  handleDefectMouseDown, handleDefectMouseEnter, handleDefectMouseUp,
  applySelectedIds, deleteSegment,
  showShortcutHelp,
  isVisible, showResetConfirmPopup, showTableSelectorPopup,
  openPopup, closePopup, showResetConfirmation, cancelReset, confirmReset,
  showTableSelector,
  isSaving, downloadCSV, saveWithTableName,
  handleMouseMove, handleCanvasClick,
  render,
} = setupResult

const clearMeasurements = setupResult.clearMeasurements

defineExpose({
  openPopup,
  closePopup,
  clearMeasurements,
  render,
  isVisible,
})
</script>

<style scoped>
</style>
