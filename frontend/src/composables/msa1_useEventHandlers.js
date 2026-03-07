import LogService from '../utils/logService'

/**
 * Composable for MSA1 cross-component event dispatching and similar image search.
 * Dispatches events to MSA2, MSA3, MSA4, MSA5 and handles similar image search API calls.
 *
 * @returns Event dispatching and similar image search functions
 */
export function useEventHandlers() {

  // MSA4, MSA5로 이미지 이벤트 발송
  const dispatchImageEvents = (processedImageData, filename) => {
    document.dispatchEvent(new CustomEvent('msa1-to-msa4-image', {
      detail: { imageUrl: processedImageData, imageName: filename }
    }))
    document.dispatchEvent(new CustomEvent('msa1-to-msa5-image', {
      detail: { imageUrl: processedImageData, imageName: filename }
    }))
  }

  // 유사 이미지 검색
  const searchSimilarImages = async (filename, imageUrl) => {
    try {
      // Base64 데이터 추출 (data:image/...;base64, 부분 제거)
      const base64Data = imageUrl.split(',')[1]

      // MSA2의 Base64 유사 이미지 검색 API 호출
      const response = await fetch('http://localhost:8000/api/imageprocess/similar-images-base64', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image_data: base64Data,
          filename: filename
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.status === 'success' && data.similar_images) {
        // 최유사 이미지를 msa2로 전송
        if (data.similar_images.length > 0) {
          const mostSimilar = data.similar_images.reduce((prev, current) =>
            (prev.similarity > current.similarity) ? prev : current
          )

          const msa2SimilarEvent = new CustomEvent('backend-to-msa2-similar-image', {
            detail: {
              filename: mostSimilar.filename,
              similarity: mostSimilar.similarity,
              source_image: filename,
              tag_type: mostSimilar.tag_type || 'Unknown',
              index: mostSimilar.index
            }
          })
          document.dispatchEvent(msa2SimilarEvent)
        }

        // MSA2에 유사 이미지 데이터 전송 (벡터 플롯용)
        const msa2Event = new CustomEvent('msa1-to-msa2-similar-images', {
          detail: {
            mainImage: {
              filename: "temp_image_aaasd.png",
              url: imageUrl
            },
            similarImages: data.similar_images,
            uploadedVector: data.uploaded_vector || [],
            totalCompared: data.total_compared || 0
          }
        })
        document.dispatchEvent(msa2Event)

        // MSA3에 유사 이미지 데이터 전송 (이미지 디스플레이용)
        // 원본 이미지와 동일한 파일명을 가진 이미지 필터링
        const filteredSimilarImages = data.similar_images.filter(img => {
          // 원본 이미지와 동일한 파일명인 경우 제외
          if (img.filename === filename) {
            console.log(`MSA1: 원본 이미지 제외: ${img.filename}`)
            return false
          }

          // 파일명이 유사한 경우도 제외 (확장자 제외한 부분이 동일한 경우)
          const originalName = filename.split('.')[0]
          const similarName = img.filename.split('.')[0]
          if (originalName === similarName) {
            console.log(`MSA1: 원본 이미지와 유사한 파일명 제외: ${img.filename}`)
            return false
          }

          return true
        })

        console.log(`MSA1: 필터링 후 유사 이미지 수: ${filteredSimilarImages.length}개 (원본: ${data.similar_images.length}개)`)

        const msa3Event = new CustomEvent('msa1-to-msa3-similar-images', {
          detail: {
            mainImage: {
              filename: "temp_image_aaasd.png",
              url: imageUrl,
              fromMSA1: true
            },
            similarImages: filteredSimilarImages
          }
        })
        document.dispatchEvent(msa3Event)

        // 로그 저장 - 유사 이미지 검색 성공
        LogService.logAction('similar_images_found', {
          filename: filename,
          similar_count: data.similar_images.length,
          total_compared: data.total_compared
        })
      } else {
        console.warn('[MSA1] 유사 이미지 검색 결과가 없습니다')
      }
    } catch (error) {
      console.error('[MSA1] 유사 이미지 검색 실패:', error)

      // 로그 저장 - 유사 이미지 검색 실패
      LogService.logAction('similar_images_error', {
        filename: filename,
        error: error.message
      })

      throw error
    }
  }

  return {
    dispatchImageEvents,
    searchSimilarImages
  }
}
