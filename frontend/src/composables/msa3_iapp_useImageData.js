import { computed } from 'vue'

/**
 * Composable for image data management in the I-APP popup.
 * Handles before/after image URLs and related computed properties.
 *
 * @param {Object} props - Component props (imageUrl, imageName, image)
 * @returns Image data computed properties
 */
export function useImageData(props) {
  const hasAfterImage = computed(() => {
    return !!props.imageName && props.imageName.includes('_before')
  })

  const afterImageName = computed(() => {
    if (!props.imageName) return ''
    return props.imageName.replace('_before', '_after')
  })

  const afterImageUrl = computed(() => {
    if (!hasAfterImage.value) return ''

    // 원본 파일명에서 _before를 _after로 변경
    const afterName = afterImageName.value

    // 8091 포트 사용하여 후처리 이미지 URL 생성
    // noname_before이미지면 localhost:8091/image_set_url/workflow_images/name_after.png
    if (afterName.includes('/')) {
      // 경로가 포함된 경우 전체 경로 변경
      const filename = afterName.substring(afterName.lastIndexOf('/') + 1)
      return `http://localhost:8091/workflow_images/${filename}`
    } else {
      // 경로 없이 파일명만 있는 경우
      return `http://localhost:8091/workflow_images/${afterName}`
    }
  })

  return {
    hasAfterImage,
    afterImageName,
    afterImageUrl
  }
}
