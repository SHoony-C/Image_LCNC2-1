/**
 * Composable for MSA3 image loading, URL construction, and error handling.
 *
 * @param {Object} deps - Dependencies
 * @param {Function} deps.isIAppTag - Function to check I-TAP tag
 * @returns Image loading functions
 */
export function useImageLoader(deps) {
  const { isIAppTag } = deps

  // 이미지 URL 생성
  function getImageUrl(filename) {
    if (!filename) {
      console.warn('MSA3: filename이 비어있음')
      return ''
    }

    // 유효하지 않은 이미지 파일명 필터링
    if (filename === 'main' ||
        filename === 'image' ||
        filename.includes('localhost') ||
        filename.includes('undefined') ||
        filename.includes('null')) {
      console.warn(`MSA3: 유효하지 않은 이미지 파일명: ${filename}, 기본 이미지 URL 반환`)
      return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2NjY2NjYyIgc3Ryb2tlLXdpZHRoPSIyIj48cGF0aCBkPSJNMTAgMTQgMTIgMTEuNSAxNCAxNCIvPjxwYXRoIGQ9Ik0yMCAxM3YtNGExIDEgMCAwIDAtMS0xSDVhMSAxIDAgMCAwLTEgMXY0Ii8+PHBhdGggZD0iTTEgMTd2NGExIDEgMCAwIDAgMSAxaDIwYTEgMSAwIDAgMCAxLTF2LTRhMSAxIDAgMCAwLTEtMUgyYTEgMSAwIDAgMC0xIDF6Ii8+PC9zdmc+'
    }

    // 이미 완전한 URL인 경우 그대로 반환
    if (filename.startsWith('http://') || filename.startsWith('https://')) {
      console.log(`MSA3: 이미 완전한 URL이므로 그대로 사용: ${filename}`)
      return filename
    }

    // I-TAP 태그 이미지인지 확인
    const isIAppImage = isIAppTag(filename)

    let finalUrl

    if (isIAppImage) {
      // I-TAP 이미지: workflow_images 디렉토리에서 직접 접근
      finalUrl = `https://10.172.107.194/raw_images/image_set_url/workflow_images/${filename}`
    } else {
      // Analysis 이미지: additional_images 디렉토리에서 직접 접근
      // 파일명에서 확장자 제거하고 .png 강제 적용
      const imageName = filename.includes('.') ? filename.split('.')[0] : filename
      finalUrl = `https://10.172.107.194/raw_images/image_set_url/additional_images/${imageName}.png`
    }

    return finalUrl
  }

  // 이미지 로드 오류 처리
  function handleImageError(event) {
    const img = event.target
    const failedUrl = img.src

    console.error(`MSA3: 이미지 로드 실패 - URL: ${failedUrl}`)

    // 실패한 URL이 IIS 서버 직접 접근인 경우, 백엔드 프록시로 재시도
    if (failedUrl.includes('localhost:8091')) {
      const filename = failedUrl.split('/').pop()
      const backupUrl = `http://localhost:8000/api/imageanalysis/images/${filename}`

      console.log(`MSA3: 백엔드 프록시로 재시도: ${backupUrl}`)

      // 한 번만 재시도하도록 플래그 설정
      if (!img.dataset.retried) {
        img.dataset.retried = 'true'
        img.src = backupUrl
        return
      }
    }

    // 최종적으로 실패한 경우 기본 이미지로 대체
    console.error(`MSA3: 모든 시도 실패, 기본 이미지로 대체: ${failedUrl}`)
    img.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2NjY2NjYyIgc3Ryb2tlLXdpZHRoPSIyIj48cGF0aCBkPSJNMTAgMTQgMTIgMTEuNSAxNCAxNCIvPjxwYXRoIGQ9Ik0yMCAxM3YtNGExIDEgMCAwIDAtMS0xSDVhMSAxIDAgMCAwLTEgMXY0Ii8+PHBhdGggZD0iTTEgMTd2NGExIDEgMCAwIDAgMSAxaDIwYTEgMSAwIDAgMCAxLTF2LTRhMSAxIDAgMCAwLTEtMUgyYTEgMSAwIDAgMC0xIDF6Ii8+PC9zdmc+'
    img.alt = '이미지 로드 실패'
  }

  // 이미지 로드 성공 처리
  function handleImageLoad(event) {
    const img = event.target
    // console.log(`MSA3: 이미지 로드 성공 - URL: ${img.src}, 크기: ${img.naturalWidth}x${img.naturalHeight}`)
  }

  return {
    getImageUrl,
    handleImageError,
    handleImageLoad
  }
}
