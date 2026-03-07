/**
 * Composable for MSA3 popup display logic.
 *
 * @param {Object} deps - Dependencies
 * @param {import('vue').Ref} deps.mainImage - Main image ref
 * @param {import('vue').Ref} deps.selectedImage - Selected image ref
 * @param {import('vue').Ref} deps.showImagePopup - Show popup flag ref
 * @param {Function} deps.isIAppTag - Function to check I-TAP tag
 * @param {Function} deps.getImageUrl - Function to get image URL
 * @param {Function} deps.fetchWorkflowInfo - Function to fetch workflow info
 * @returns Popup management functions
 */
export function usePopupManager(deps) {
  const {
    mainImage, selectedImage, showImagePopup,
    isIAppTag, getImageUrl, fetchWorkflowInfo
  } = deps

  // 이미지 상세 팝업 표시
  function showImageDetailsPopup(filename) {
    // 현재 메인 이미지 정보를 기반으로 선택된 이미지 설정
    selectedImage.value = {
      ...mainImage.value,
      filename: filename,
      url: getImageUrl(filename)
    }

    // 워크플로우 정보 요청 - 팝업 표시 전에 처리
    fetchWorkflowInfo(filename)

    // 팝업 표시
    showImagePopup.value = true
  }

  // 유사 이미지 클릭 시 해당 이미지를 주 이미지로 변경
  function selectSimilarImage(image) {
    // 선택된 이미지 정보를 팝업용으로 설정 (메인 이미지는 변경하지 않음)
    selectedImage.value = {
      ...image,
      url: image.url || getImageUrl(image.filename)
    }

    // 워크플로우 정보 요청 - I-app 태그이고 유효한 파일명인 경우에만
    if (isIAppTag(image.filename) && image.filename &&
        !image.filename.includes('localhost') &&
        image.filename !== 'main' &&
        image.filename !== 'image' &&
        !image.filename.includes('undefined') &&
        !image.filename.includes('null')) {
      fetchWorkflowInfo(image.filename)
    }

    // 팝업 표시
    showImagePopup.value = true
  }

  // 팝업 닫기
  function closeImagePopup() {
    showImagePopup.value = false
  }

  return {
    showImageDetailsPopup,
    selectSimilarImage,
    closeImagePopup
  }
}
