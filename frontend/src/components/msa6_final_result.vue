<template>
  <div class="msa-component" :class="{ maximized: isMaximized }">
    <div class="card-header">
      <div class="header-left">
        <i class="fas fa-flag-checkered"></i>
        <span>I-TAP Result</span>
      </div>
    </div>

    <div class="result-container">
      <div v-if="showResult" class="result-content">
        <div class="result-image" @click="openMeasurementPopup">
          <img :src="finalImage" alt="Final Result" />
          <div class="measurement-hint">
            <i class="fas fa-ruler"></i>
            <span>이미지를 클릭하여 측정 도구 열기</span>
          </div>
        </div>
      </div>
      <div v-else class="no-result">
        <i class="fas fa-image"></i>
        <span>처리된 이미지가 없습니다</span>
      </div>
    </div>

    <!-- 이미지 측정 팝업 -->
    <MSA6ImagePopup
      ref="measurementPopup"
      v-show="showMeasurementPopup && finalImage"
      :imageUrl="finalImage"
      :inputImageUrl="inputImage"
      :showPopup="showMeasurementPopup"
      :measurements="measurements"
      @update:showPopup="showMeasurementPopup = $event"
      @update:measurements="handleMeasurementsUpdate"
      @close="closeMeasurementPopup"
      @measurement-added="handleMeasurementAdded"
      @measurement-removed="handleMeasurementRemoved"
      @measurements-cleared="handleMeasurementsCleared"
    />
  </div>
</template>

<script>
import '@/assets/css/msa6_final_result.css'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import MSA6ImagePopup from './msa6_image_popup1.vue'
import { useMSA6Methods } from '../composables/msa6_final_useMethods'

export default {
  name: 'MSA6FinalResult',
  components: {
    MSA6ImagePopup
  },
  setup() {
    const measurementPopup = ref(null)

    const isMaximized = ref(false)
    const finalImage = ref('')
    const showResult = ref(false)
    const showMeasurementPopup = ref(false)
    const inputImage = ref(null)
    const msa5ImageAvailable = ref(false)
    const measurements = ref([])

    const state = {
      isMaximized, finalImage, showResult, showMeasurementPopup,
      inputImage, msa5ImageAvailable, measurements
    }
    const refs = { measurementPopup }

    const {
      checkMSA5StatusAndUpdateImage,
      clearImageOnReload,
      handleMSA5ImageProcessed,
      handleMSA5ProcessStart,
      toggleMaximize,
      openMeasurementPopup,
      closeMeasurementPopup,
      handleMeasurementAdded,
      handleMeasurementRemoved,
      handleMeasurementsCleared,
      handleMeasurementsUpdate
    } = useMSA6Methods({ state, refs })

    onMounted(() => {
      window.addEventListener('msa5-image-processed', handleMSA5ImageProcessed)
      window.addEventListener('msa5-process-start', handleMSA5ProcessStart)
      showMeasurementPopup.value = false
      window.addEventListener('load', clearImageOnReload)
      window.addEventListener('msa6-popup-closed', () => {
        showMeasurementPopup.value = false
        closeMeasurementPopup()
      })
      checkMSA5StatusAndUpdateImage()
    })

    onBeforeUnmount(() => {
      window.removeEventListener('msa5-image-processed', handleMSA5ImageProcessed)
      window.removeEventListener('msa5-process-start', handleMSA5ProcessStart)
      window.removeEventListener('load', clearImageOnReload)
      window.removeEventListener('msa6-popup-closed', () => {})
    })

    return {
      measurementPopup,
      isMaximized, finalImage, showResult, showMeasurementPopup,
      inputImage, measurements,
      openMeasurementPopup, closeMeasurementPopup,
      handleMeasurementAdded, handleMeasurementRemoved,
      handleMeasurementsCleared, handleMeasurementsUpdate
    }
  }
}
</script>

<style scoped>
</style>
