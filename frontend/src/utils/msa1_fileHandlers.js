import LogService from './logService'

export const fileHandlers = {
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
  }
} 