/**
 * Composable for MSA1 image processing utilities.
 * Handles image size checking, resizing, format conversion.
 *
 * @param {Object} deps - Dependencies
 * @param {import('vue').Ref} deps.statusText - Reactive ref to status text
 * @returns Image processing utility functions
 */
export function useImageProcessing(deps) {
  const { statusText } = deps

  // 이미지 데이터 URL에서 파일 크기 계산
  const getImageSizeFromDataUrl = (dataUrl) => {
    const base64Data = dataUrl.split(',')[1]
    return (base64Data.length * 3) / 4
  }

  // 이미지 해상도 조정 함수
  const resizeImage = async (imageDataUrl, targetSizeMB, compressionLevel) => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        // 압축 레벨에 따른 설정
        let scaleFactor, initialQuality, minQuality, minDimension

        switch (compressionLevel) {
          case 'aggressive':
            // 10MB 이상: 매우 강한 압축
            scaleFactor = Math.sqrt(targetSizeMB / (getImageSizeFromDataUrl(imageDataUrl) / (1024 * 1024))) * 0.7
            initialQuality = 0.6
            minQuality = 0.2
            minDimension = 200
            break
          case 'medium':
            // 5MB 이상: 중간 압축
            scaleFactor = Math.sqrt(targetSizeMB / (getImageSizeFromDataUrl(imageDataUrl) / (1024 * 1024))) * 0.8
            initialQuality = 0.7
            minQuality = 0.3
            minDimension = 250
            break
          case 'light':
            // 2MB 이상: 미니 압축
            scaleFactor = Math.sqrt(targetSizeMB / (getImageSizeFromDataUrl(imageDataUrl) / (1024 * 1024))) * 0.8
            initialQuality = 0.8
            minQuality = 0.4
            minDimension = 300
            break
          case 'minimum':
          default:
            // 1MB 이상: 최소화 압축
            scaleFactor = Math.sqrt(targetSizeMB / (getImageSizeFromDataUrl(imageDataUrl) / (1024 * 1024))) * 0.9
            initialQuality = 0.85
            minQuality = 0.7
            minDimension = 300
            break
        }

        scaleFactor = Math.min(scaleFactor, 1) // 확대는 하지 않음

        let newWidth = Math.floor(img.width * scaleFactor)
        let newHeight = Math.floor(img.height * scaleFactor)

        // 최소 크기 보장 (너무 작아지지 않도록)
        if (newWidth < minDimension && newHeight < minDimension) {
          const ratio = Math.max(minDimension / newWidth, minDimension / newHeight)
          newWidth = Math.floor(newWidth * ratio)
          newHeight = Math.floor(newHeight * ratio)
        }

        canvas.width = newWidth
        canvas.height = newHeight

        // 이미지 그리기
        ctx.drawImage(img, 0, 0, newWidth, newHeight)

        // JPEG로 압축 (품질 조정)
        let quality = initialQuality
        let result = canvas.toDataURL('image/jpeg', quality)

        // 여전히 크다면 품질을 더 낮춤
        while (getImageSizeFromDataUrl(result) > targetSizeMB * 1024 * 1024 && quality > minQuality) {
          quality -= 0.1
          result = canvas.toDataURL('image/jpeg', quality)
        }

        resolve(result)
      }
      img.onerror = (e) => {
        console.error('[resizeImage] 이미지 로딩 실패', e)
        console.error('imageDataUrl 길이:', imageDataUrl?.length)
        console.error('imageDataUrl 시작:', imageDataUrl?.slice?.(0, 50))
        resolve(imageDataUrl)  // 실패 시 원본 반환
      }
      img.src = imageDataUrl
    })
  }

  // 이미지 용량 체크 및 해상도 조정 함수
  const checkAndResizeImage = async (imageDataUrl, filename) => {
    try {
      statusText.value = '이미지 용량 최적화 중...'
      // 1) Data URL -> Blob
      const [header, base64] = imageDataUrl.split(',')
      const mime = header.match(/data:(image\/[^;]+);base64/)[1]
      const bin = atob(base64.replace(/\s/g, ''))
      const arr = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
      const blob = new Blob([arr], { type: mime })

      // 2) 서버에 업로드 & 변환
      const form = new FormData()
      form.append('file', blob, filename)
      const resp = await fetch('http://localhost:8000/api/msa1/upload', {
        method: 'POST',
        body: form,
      })
      if (!resp.ok) throw new Error(`변환 API 실패: ${resp.status}`)
      const convertedBlob = await resp.blob()

      // 3) 변환된 Blob -> Data URL
      const convertedDataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload  = () => resolve(reader.result)
        reader.onerror = () => reject(new Error('FileReader 실패'))
        reader.readAsDataURL(convertedBlob)
      })

      imageDataUrl = convertedDataUrl

      // 4) 기존 용량 체크 & 리사이즈 로직
      const sizeInBytes = (imageDataUrl.split(',')[1].length * 3) / 4
      const sizeInMB    = sizeInBytes / (1024 * 1024)

      // 1MB 미만
      if (sizeInMB < 1) {
        return imageDataUrl
      }

      // 1MB 이상
      statusText.value = '이미지 용량 최적화 중...'
      const maxSizeMB       = 0.8
      const compressionLevel = 'minimum'
      const resized = await resizeImage(imageDataUrl, maxSizeMB, compressionLevel)
      return resized

    } catch (err) {
      console.error('[checkAndResizeImage] 에러 발생', err)
      // 실패 시 원본 그대로 반환
      return imageDataUrl
    }
  }

  // PNG 변환 함수
  const convertToPng = async (imageDataUrl) => {
    console.log('--- convertToPng(Debug + createImageBitmap) 시작 ---')

    try {
      // 1) Data URL -> Blob (fetch 사용)
      console.log('[1] fetch dataURL -> blob 시작')
      const resp = await fetch(imageDataUrl)
      console.log('[1] fetch 완료:', resp.status, resp.statusText)
      if (!resp.ok) throw new Error(`Fetch failed ${resp.status}`)
      const blob = await resp.blob()
      console.log('[1] blob:', blob.type, blob.size, 'bytes')

      // 2) Blob -> ArrayBuffer -> magic bytes 확인
      const ab = await blob.arrayBuffer()
      const header = new Uint8Array(ab.slice(0, 4))
      console.log('[2] magic bytes:', header.map(b=>b.toString(16).padStart(2,'0')).join(' '))

      // 3) createImageBitmap 으로 디코딩
      console.log('[3] createImageBitmap 시작')
      const bitmap = await createImageBitmap(blob)
      console.log('[3] createImageBitmap 완료:', bitmap.width, 'x', bitmap.height)

      // 4) canvas -> PNG Data URL
      const canvas = document.createElement('canvas')
      canvas.width  = bitmap.width
      canvas.height = bitmap.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(bitmap, 0, 0)
      const pngDataUrl = canvas.toDataURL('image/png')
      console.log('[4] PNG Data URL 생성, 길이:', pngDataUrl.length)

      console.log('--- convertToPng 완료 ---')
      return pngDataUrl

    } catch (err) {
      console.error('[convertToPng] 단계별 오류 발생', err)
      return imageDataUrl
    }
  }

  return {
    getImageSizeFromDataUrl,
    resizeImage,
    checkAndResizeImage,
    convertToPng
  }
}
