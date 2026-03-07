<template>
  <div class="msa-component" :class="{ active: isActive }" @paste="handlePaste" tabindex="0">
    <div class="card-header">
      <div class="header-left">
        <i class="fas fa-cloud-upload-alt"></i>
        <span>Image Import Panel

</span>
      </div>
      <div class="status-badge" :class="status">
        {{ statusText }}
      </div>
    </div>
    <div class="content">
      <div class="title">이미지 입력</div>
      
      <div class="image-input-area" 
           @dragover.prevent 
           @drop.prevent="handleDrop"
           @click="triggerFileInput">
        <input 
          type="file" 
          ref="fileInput" 
          accept="image/*" 
          style="display: none" 
          @change="handleFileSelect"
        >
        <div v-if="!previewImage" class="paste-image-prompt">
          <div class="image-icon-wrapper">
            <i class="fas fa-cloud-upload-alt"></i>
            <i class="fas fa-image"></i>
          </div>
          <h3>이미지를 추가하세요</h3>
          <p>Ctrl+V로 붙여넣거나 이미지를 첨부하세요</p>
        </div>
        <div v-else class="preview-container">
          <img :src="previewImage" alt="Preview" class="preview-image">
          <button class="remove-btn" @click.stop="removeImage">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import '@/assets/css/msa1_image_input.css'
import { ref, onMounted, onBeforeUnmount } from 'vue'

// Composables
import { useImageState } from '../composables/msa1_useImageState'
import { useImageProcessing } from '../composables/msa1_useImageProcessing'
import { useEventHandlers } from '../composables/msa1_useEventHandlers'
import { useImageUpload } from '../composables/msa1_useImageUpload'

export default {
  name: 'MSA1ImageInput',
  setup() {
    // =============================================
    // Template ref
    // =============================================
    const fileInput = ref(null)

    // =============================================
    // 1. Image State
    // =============================================
    const {
      isActive,
      status,
      statusText,
      previewImage,
      isProcessingImage,
      removeImage
    } = useImageState(fileInput)

    // =============================================
    // 2. Image Processing (resize, convert)
    // =============================================
    const {
      checkAndResizeImage,
      convertToPng,
      getImageSizeFromDataUrl
    } = useImageProcessing({ statusText })

    // =============================================
    // 3. Event Handlers (cross-component dispatch, similar image search)
    // =============================================
    const {
      dispatchImageEvents,
      searchSimilarImages
    } = useEventHandlers()

    // =============================================
    // 4. Image Upload (file input, drag & drop, paste, process pipeline)
    // =============================================
    const {
      triggerFileInput,
      handleFileSelect,
      handleDrop,
      handlePaste,
      processImage
    } = useImageUpload({
      fileInputRef: fileInput,
      previewImage,
      status,
      statusText,
      isActive,
      isProcessingImage,
      checkAndResizeImage,
      searchSimilarImages,
      dispatchImageEvents
    })

    // =============================================
    // Lifecycle hooks
    // =============================================
    onMounted(() => {
      // 전역 포커스 상태에서도 이미지 붙여넣기를 처리할 수 있도록 리스너 등록
      document.addEventListener('paste', handlePaste)
    })

    onBeforeUnmount(() => {
      document.removeEventListener('paste', handlePaste)
    })

    // =============================================
    // Return all template bindings
    // =============================================
    return {
      // Template ref
      fileInput,

      // Image state
      isActive,
      status,
      statusText,
      previewImage,

      // Upload handlers
      triggerFileInput,
      handleFileSelect,
      handleDrop,
      handlePaste,
      removeImage
    }
  }
}
</script>

<style scoped>
</style>
