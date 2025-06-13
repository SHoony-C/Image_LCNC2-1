export const imageManager = {
  removeImage() {
    this.previewImage = null
    this.status = 'pending'
    this.statusText = '대기중'
    this.isActive = false
    this.$refs.fileInput.value = ''
  }
} 