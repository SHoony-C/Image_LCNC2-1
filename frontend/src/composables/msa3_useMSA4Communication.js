/**
 * Composable for MSA3 to MSA4 communication.
 * Handles sending analysis data and workflow info fetching.
 *
 * @param {Object} deps - Dependencies
 * @param {import('vue').Ref} deps.mainImage - Main image ref
 * @param {import('vue').Ref} deps.selectedImage - Selected image ref
 * @param {import('vue').Ref} deps.abortController - AbortController ref
 * @param {Function} deps.isIAppTag - Function to check I-TAP tag
 * @param {Function} deps.getImageUrl - Function to get image URL
 * @param {Function} deps.emit - Vue emit function
 * @returns Communication functions
 */
export function useMSA4Communication(deps) {
  const {
    mainImage, selectedImage, abortController,
    isIAppTag, getImageUrl, emit
  } = deps

  // Analysis 태그 이미지들의 txt 파일 내용을 MSA4로 전송
  async function sendAnalysisImagesToMSA4(analysisImages) {
    if (!analysisImages || analysisImages.length === 0) {
      return
    }

    try {
      const textContents = []

      // 각 Analysis 이미지의 txt 파일 내용을 가져옴 (백엔드 프록시를 통해 IIS 서버 8091 포트)
      for (const image of analysisImages) {
        try {
          // 유효하지 않은 파일명 필터링
          if (!image.filename ||
              image.filename === 'image' ||
              image.filename === 'main' ||
              image.filename.includes('localhost') ||
              image.filename.includes('undefined') ||
              image.filename.includes('null')) {
            continue
          }

          const imageName = image.filename.split('.')[0]

          // 백엔드 프록시를 통해 IIS 서버의 txt 파일 가져오기
          const proxyUrl = `http://localhost:8000/api/imagestorage/fetch-txt/${imageName}`

          const response = await fetch(proxyUrl, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            signal: abortController.value ? abortController.value.signal : undefined
          })

          if (response.ok) {
            const result = await response.json()
            if (result.status === 'success' && result.textContent) {
              textContents.push({
                imageName: image.filename,
                textContent: result.textContent,
                similarity: image.similarity || 0,
                fromMSA1: image.fromMSA1 || false // MSA1에서 온 데이터임을 명시
              })
            }
          }
        } catch (error) {
          // 개별 이미지 처리 실패 시 계속 진행
        }
      }

      // MSA4로 전송
      if (textContents.length > 0) {
        // 부모 컴포넌트로 이벤트 발생
        emit('send-analysis-data', {
          type: 'multiple',
          data: textContents
        })
      }
    } catch (error) {
      // console.error('MSA3: Error sending analysis data to MSA4:', error)
    }
  }

  // 메인 이미지 변경 시에도 Analysis 태그라면 MSA4로 전송
  function handleMainImageChanged(image) {
    if (!image) return

    mainImage.value = image

    // 워크플로우 정보 요청 - 유효한 파일명인 경우에만
    if (image && image.filename &&
        !image.filename.includes('localhost') &&
        image.filename !== 'main' &&
        image.filename !== 'image' &&
        !image.filename.includes('undefined') &&
        !image.filename.includes('null')) {
      fetchWorkflowInfo(image.filename)
    }

    // MSA1에서 온 이미지가 아닌 경우에만 Analysis 태그 이미지를 MSA4로 전송
    if (!image.fromMSA1 &&
        !isIAppTag(image.filename) &&
        image.filename &&
        image.filename !== 'image' &&
        image.filename !== 'main' &&
        !image.filename.includes('localhost') &&
        !image.filename.includes('undefined') &&
        !image.filename.includes('null')) {
      sendSingleAnalysisImageToMSA4(image)
    }
  }

  // 단일 Analysis 이미지의 txt 파일 내용을 MSA4로 전송
  async function sendSingleAnalysisImageToMSA4(image) {
    try {
      // MSA1에서 온 이미지는 새로운 이미지이므로 txt 파일이 존재하지 않음 - 스킵
      if (image.fromMSA1) {
        return
      }

      // 유효하지 않은 파일명 필터링
      if (!image.filename ||
          image.filename === 'image' ||
          image.filename === 'main' ||
          image.filename.includes('localhost') ||
          image.filename.includes('undefined') ||
          image.filename.includes('null')) {
        return
      }

      const imageName = image.filename.split('.')[0]

      // 이미지명이 너무 짧거나 의미없는 경우도 스킵
      if (!imageName || imageName.length < 2) {
        return
      }

      // 백엔드 프록시를 통해 IIS 서버의 txt 파일 가져오기
      const proxyUrl = `http://localhost:8000/api/imagestorage/fetch-txt/${imageName}`

      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        signal: abortController.value ? abortController.value.signal : undefined
      })

      if (response.ok) {
        const result = await response.json()
        if (result.status === 'success' && result.textContent) {
          emit('send-analysis-data', {
            type: 'single',
            data: [{
              imageName: image.filename,
              textContent: result.textContent,
              similarity: image.similarity || 0
            }]
          })
        }
      }
    } catch (error) {
      // console.warn(`MSA3: Failed to fetch single txt via backend proxy for ${image.filename}:`, error)
    }
  }

  // 워크플로우 정보 가져오기
  function fetchWorkflowInfo(filename) {
    if (!filename) {
      return
    }

    // 이미지에 워크플로우 정보 로딩 상태 설정
    if (selectedImage.value) {
      selectedImage.value = {
        ...selectedImage.value,
        isLoading: true,
        workflowStatus: 'loading'
      }
    }

    // I-app 태그 이미지인지 확인
    const isIAppImage = isIAppTag(filename)

    if (!isIAppImage) {
      // Analysis 이미지는 워크플로우 정보가 필요 없음
      if (selectedImage.value) {
        selectedImage.value = {
          ...selectedImage.value,
          isLoading: false,
          workflowStatus: 'not_applicable'
        }
      }
      return
    }

    // 워크플로우 검색용 파일명 - _before 및 확장자(.png, .jpg 등) 제거
    const searchFilename = filename
      .replace("_before", "")  // _before 제거
      .replace(/\.(png|jpg|jpeg|gif)$/i, "")  // 파일 확장자 제거

    // URL 인코딩 처리 - 한글 및 특수문자 처리
    const encodedSearchFilename = encodeURIComponent(searchFilename)

    // 직접 워크플로우 이름만 사용하는 방식으로 변경 (MongoDB workflow_name 필드와 일치)
    const apiUrl = `http://localhost:8000/api/imageanalysis/workflow/by-image/${encodedSearchFilename}`

    // API 요청 - I-app 이미지 워크플로우 정보
    const fetchOptions = abortController.value ? { signal: abortController.value.signal } : {}
    fetch(apiUrl, fetchOptions)
      .then(response => {
        const responseHeaders = {}
        response.headers.forEach((value, name) => {
          responseHeaders[name] = value
        })

        if (!response.ok) {
          if (response.status === 404) {
            // 404 오류 처리 - 워크플로우를 찾을 수 없음
            if (selectedImage.value) {
              selectedImage.value = {
                ...selectedImage.value,
                isLoading: false,
                workflowStatus: 'not_found',
                workflow: null  // 명시적으로 null 설정
              }
            }

            // 대체 방법으로 직접 이름만 사용해서 다시 시도
            const simpleNameUrl = `http://localhost:8000/api/imageanalysis/workflow/by-image/${searchFilename}`
            return fetch(simpleNameUrl, fetchOptions)
              .then(altResponse => {
                return altResponse
              })
          }
          throw new Error(`HTTP 오류 ${response.status}: ${response.statusText}`)
        }
        return response.json()
          .then(data => {
            if (data && typeof data === 'object') {
              Object.keys(data).forEach(key => {
                const value = data[key]
                if (key === 'workflow' && value) {
                  // workflow 내부 구조 처리
                }
                if (key === 'elements' && Array.isArray(value)) {
                  // elements 배열 처리
                }
              })
            }

            // 응답이 HTTP 오류 객체인 경우
            if (data && data.status && data.status >= 400) {
              if (selectedImage.value) {
                selectedImage.value = {
                  ...selectedImage.value,
                  isLoading: false,
                  workflowStatus: 'error',
                  workflow: null
                }
              }
              return
            }

            // 워크플로우 정보 업데이트
            if (selectedImage.value && data && (data.workflow || data)) {
              const workflowData = data.workflow || data

              selectedImage.value = {
                ...selectedImage.value,
                workflow: workflowData,
                isLoading: false,
                workflowStatus: 'found'
              }
            } else {
              if (selectedImage.value) {
                selectedImage.value = {
                  ...selectedImage.value,
                  isLoading: false,
                  workflowStatus: 'error'
                }
              }
            }
          })
          .catch(error => {
            // 두 번째 시도까지 실패한 경우
            if (selectedImage.value && selectedImage.value.workflowStatus !== 'not_found') {
              selectedImage.value = {
                ...selectedImage.value,
                isLoading: false,
                workflowStatus: 'error',
                workflow: null  // 명시적으로 null 설정
              }
            }
          })
          .finally(() => {
            // fetch 완료
          })
      })
      .catch(error => {
        // 두 번째 시도까지 실패한 경우
        if (selectedImage.value && selectedImage.value.workflowStatus !== 'not_found') {
          selectedImage.value = {
            ...selectedImage.value,
            isLoading: false,
            workflowStatus: 'error',
            workflow: null  // 명시적으로 null 설정
          }
        }
      })
      .finally(() => {
        // fetch 완료
      })
  }

  // Analysis popup에서의 분석 요청 핸들러
  function handleAnalyzeRequest(data) {
    // MSA4로 단일 이미지 분석 데이터 직접 전송
    try {
      if (data.textContent && data.imageName) {
        // 부모 컴포넌트로 이벤트 발생하여 MSA4로 전송
        emit('send-analysis-data', {
          type: 'single',
          data: [{
            imageName: data.imageName,
            textContent: data.textContent,
            similarity: 100 // 직접 선택한 이미지이므로 100%
          }]
        })
      }
    } catch (error) {
      // console.error('MSA3: Analysis popup 데이터 처리 중 오류:', error)
    }
  }

  return {
    sendAnalysisImagesToMSA4,
    handleMainImageChanged,
    sendSingleAnalysisImageToMSA4,
    fetchWorkflowInfo,
    handleAnalyzeRequest
  }
}
