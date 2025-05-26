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
import LogService from '../utils/logService'

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
    triggerFileInput() {
      if (!this.previewImage) {
        this.$refs.fileInput.click()
      }
    },
    handleFileSelect(event) {
      const file = event.target.files[0]
      if (file) {
        this.processImage(file)
      }
    },
    handleDrop(event) {
      const file = event.dataTransfer.files[0]
      if (file && file.type.startsWith('image/')) {
        this.processImage(file)
      }
    },
    handlePaste(event) {
      const items = (event.clipboardData || event.originalEvent.clipboardData).items
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          this.processImage(file)
          break
        }
      }
    },
    processImage(file) {
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          this.previewImage = e.target.result
          this.status = 'success'
          this.statusText = '이미지 준비됨'
          this.isActive = true
          
          // 로그 저장 - 이미지 업로드
          LogService.logAction('upload_image', {
            filename: file.name,
            filesize: file.size,
            filetype: file.type
          })
          
          // MSA4로 이미지 전송
          const msa4Event = new CustomEvent('msa1-to-msa4-image', { 
            detail: { 
              imageUrl: e.target.result,
              imageName: file.name
            }
          })
          document.dispatchEvent(msa4Event)
          console.log('[MSA1] 이미지가 MSA4로 전송됨:', file.name)
          
          // 로그 저장 - MSA4 전송
          LogService.logAction('send_to_msa4', {
            filename: file.name
          })
          
          // MSA5로 이미지 전송
          const msa5Event = new CustomEvent('msa1-to-msa5-image', { 
            detail: { 
              imageUrl: e.target.result,
              imageName: file.name
            }
          })
          document.dispatchEvent(msa5Event)
          console.log('[MSA1] 이미지가 MSA5로 전송됨:', file.name)
          
          // 로그 저장 - MSA5 전송
          LogService.logAction('send_to_msa5', {
            filename: file.name
          })
        }
        reader.readAsDataURL(file)
      }
    },
    removeImage() {
      this.previewImage = null
      this.status = 'pending'
      this.statusText = '대기중'
      this.isActive = false
      this.$refs.fileInput.value = ''
    }
  }
}
</script>

<style scoped>
.msa-component {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  padding: 1.5rem;
  height: 100%;
  transition: all 0.3s ease;
  border: 1px solid rgba(124, 58, 237, 0.1);
  box-shadow: 
    0 4px 6px -1px rgba(0, 0, 0, 0.05),
    0 2px 4px -1px rgba(0, 0, 0, 0.03);
}

.msa-component:hover {
  box-shadow: 
    0 10px 15px -3px rgba(124, 58, 237, 0.1),
    0 4px 6px -2px rgba(124, 58, 237, 0.05);
  border-color: rgba(124, 58, 237, 0.3);
}

.msa-component.active {
  background: rgba(124, 58, 237, 0.03);
  border-color: rgba(124, 58, 237, 0.5);
  box-shadow: 
    0 0 0 3px rgba(124, 58, 237, 0.1),
    0 10px 15px -3px rgba(124, 58, 237, 0.1),
    0 4px 6px -2px rgba(124, 58, 237, 0.05);
}

.component-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #4c1d95;
  margin: 0;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 500;
}

.status-badge.pending {
  background-color: rgba(124, 58, 237, 0.1);
  color: #6d28d9;
}

.status-badge.processing {
  background-color: rgba(59, 130, 246, 0.1);
  color: #2563eb;
}

.status-badge.success {
  background-color: rgba(16, 185, 129, 0.1);
  color: #059669;
}

.status-badge.warning {
  background-color: rgba(245, 158, 11, 0.1);
  color: #d97706;
}

.content {
  text-align: left;
}

.title {
  font-weight: 600;
  color: #6d28d9;
  margin-bottom: 0.5rem;
  font-size: 1.1rem;
}

.description {
  color: #6b7280;
  font-size: 0.95rem;
  line-height: 1.5;
}

.image-input-area {
  margin-top: 1rem;
  border: 2px dashed rgba(124, 58, 237, 0.3);
  border-radius: 12px;
  padding: 1rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  min-height: 170px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-input-area:hover {
  border-color: rgba(124, 58, 237, 0.5);
  background: rgba(124, 58, 237, 0.02);
}

.upload-placeholder {
  color: #6b7280;
}

.upload-placeholder i {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  color: rgba(124, 58, 237, 0.5);
}

.upload-placeholder p {
  margin: 0.5rem 0;
}

.sub-text {
  font-size: 0.9rem;
  color: #9ca3af;
}

.preview-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 170px;
}

.preview-image {
  max-width: 100%;
  max-height: 170px;
  object-fit: contain;
  border-radius: 8px;
}

.remove-btn {
  position: absolute;
  top: -0.5rem;
  right: -0.5rem;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.remove-btn:hover {
  background: #dc2626;
  transform: scale(1.1);
}

.paste-image-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 25px;
  background: linear-gradient(135deg, #f5f7fa, #e4edf9);
  border-radius: 12px;
  border: 2px dashed #c3d0e6;
  text-align: center;
  transition: all 0.3s ease;
  cursor: pointer;
}

.paste-image-prompt:hover {
  border-color: #8b5cf6;
  box-shadow: 0 5px 15px rgba(139, 92, 246, 0.15);
  transform: translateY(-2px);
}

.image-icon-wrapper {
  position: relative;
  margin-bottom: 20px;
}

.image-icon-wrapper i.fa-cloud-upload-alt {
  font-size: 42px;
  color: #8b5cf6;
  margin-bottom: 10px;
}

.image-icon-wrapper i.fa-image {
  position: absolute;
  bottom: -5px;
  right: -10px;
  font-size: 24px;
  color: #4ade80;
  background: white;
  padding: 5px;
  border-radius: 50%;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}

.paste-image-prompt h3 {
  font-size: 20px;
  font-weight: 600;
  color: #4b5563;
  margin: 0 0 8px 0;
}

.paste-image-prompt p {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}
</style> 