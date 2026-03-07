import { ref } from 'vue'

/**
 * Composable for MSA1 image state management.
 * Manages core reactive state: isActive, status, statusText, previewImage, isProcessingImage.
 *
 * @param {import('vue').Ref} fileInputRef - Template ref to the file input element
 * @returns Core image state refs and reset function
 */
export function useImageState(fileInputRef) {
  const isActive = ref(false)
  const status = ref('pending') // pending, processing, success, warning
  const statusText = ref('대기중')
  const previewImage = ref(null)
  const isProcessingImage = ref(false)

  // 이미지 제거 및 상태 초기화
  const removeImage = () => {
    previewImage.value = null
    status.value = 'pending'
    statusText.value = '대기중'
    isActive.value = false
    if (fileInputRef.value) {
      fileInputRef.value.value = ''
    }
  }

  return {
    isActive,
    status,
    statusText,
    previewImage,
    isProcessingImage,
    removeImage
  }
}
