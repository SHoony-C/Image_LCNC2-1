<template>
  <div class="msa-component" :class="{ active: isActive }" @paste="handlePaste">
    <div class="component-header">
      <h3>MSA1</h3>
      <div class="status-badge" :class="status">
        {{ statusText }}
      </div>
    </div>
    <div class="content">
      <div class="title">이미지 입력</div>
      <div class="description">최초 인풋 이미지 불러넣기/첨부</div>
      
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
          <p>Ctrl+V로 붙여넣거나 이미지를 드래그하세요</p>
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
import { fileHandlers } from '../utils/msa1_fileHandlers'
import { imageManager } from '../utils/msa1_imageManager'

export default {
  name: 'MSA1ImageInput',
  data() {
    return {
      isActive: false,
      status: 'pending', // pending, processing, success, warning
      statusText: '대기중',
      previewImage: null
    }
  },
  methods: {
    ...fileHandlers,
    ...imageManager
  }
}
</script>

<style scoped>
@import '../styles/msa1_image_input.css';
</style> 