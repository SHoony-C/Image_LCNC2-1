/**
 * Composable for processing individual workflow nodes (including merge nodes).
 * Handles API calls to the backend for image processing, node type resolution,
 * and blob URL lifecycle management (revoking old URLs to prevent memory leaks).
 *
 * @param {import('vue').Ref} elements - Reactive ref to workflow elements array
 * @param {Object} processedImages - Reactive object mapping nodeId -> processed image URL
 * @param {import('vue').Ref} defaultOptions - Reactive ref to default node options from backend
 * @param {Object} errorDialogState - Object with refs for error dialog UI state
 * @returns Node processing functions
 */
export function useNodeProcessor(elements, processedImages, defaultOptions, errorDialogState) {
  const {
    showWorkflowErrorDialog,
    workflowErrorTitle,
    workflowErrorMessage,
    workflowErrorDetails
  } = errorDialogState

  /**
   * Get default parameters for a given node type using backend-provided options.
   */
  const getDefaultParams = (nodeType, defaultOpts) => {
    if (!defaultOpts || !nodeType) {
      return {}
    }

    const params = defaultOpts[nodeType] || {}
    const result = {}
    const backendOptions = params.options || {}

    Object.entries(params).forEach(([key, value]) => {
      if (key === 'options') {
        return
      }

      let paramConfig = {
        value: value,
        label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
        min: 0,
        max: 1000,
        step: 1
      }

      if (backendOptions[key] && Array.isArray(backendOptions[key])) {
        paramConfig.options = backendOptions[key]
      } else {
        if (key.includes('factor')) {
          paramConfig.min = 0
          paramConfig.max = 2
          paramConfig.step = 0.1
        } else if (key.includes('angle')) {
          paramConfig.min = -360
          paramConfig.max = 360
          paramConfig.step = 1
        } else if (key.includes('threshold')) {
          paramConfig.min = 0
          paramConfig.max = 255
          paramConfig.step = 1
        } else if (key.includes('radius')) {
          paramConfig.min = 0
          paramConfig.max = 50
          paramConfig.step = 1
        } else if (key.includes('direction') || key.includes('method') || key.includes('model')) {
          paramConfig.options = Array.isArray(value) ? value :
            key === 'direction' ? ['horizontal', 'vertical'] :
            key === 'method' ? ['canny', 'sobel', 'laplacian'] :
            key === 'model' ? ['yolov5', 'yolov8', 'faster_rcnn'] :
            [value]
        }
      }

      result[key] = paramConfig
    })

    return result
  }

  /**
   * Resolve the backend API node type from node metadata.
   * Handles ID parsing, Korean label mapping, and compatibility mapping.
   */
  const resolveNodeType = (node) => {
    let nodeType = node.data?.nodeId || node.data?.id || node.data?.type || 'custom'
    let originalNodeType = nodeType

    // SAM2 노드 특별 처리 - 조기 감지
    if (node.data?.label && (node.data.label.includes('SAM2') || node.data.label.includes('세그멘테이션'))) {
      return { nodeType: 'sam2', originalNodeType: node.data.label }
    }

    // 1. 노드 ID에서 타입 추출 시도
    if (typeof node.id === 'string' && node.id.includes('_')) {
      const idParts = node.id.split('_')
      const lastPart = idParts[idParts.length - 1]
      const secondLastPart = idParts[idParts.length - 2]

      if (/^\d+$/.test(lastPart) && /^\d+$/.test(secondLastPart)) {
        const typeFromId = idParts.slice(0, -2).join('_')
        if (typeFromId) nodeType = typeFromId
      } else if (/^\d+$/.test(lastPart)) {
        const typeFromId = idParts.slice(0, -1).join('_')
        if (typeFromId) nodeType = typeFromId
      } else {
        nodeType = node.id
      }
    }

    // 2. 노드 이름에서 타입 복구
    if (nodeType === 'custom' || !nodeType || nodeType === 'undefined') {
      if (node.name && typeof node.name === 'string') {
        if (node.name.includes('_')) {
          const nameParts = node.name.split('_')
          const lastPart = nameParts[nameParts.length - 1]
          if (/^\d+$/.test(lastPart)) {
            const typeFromName = nameParts.slice(0, -1).join('_')
            if (typeFromName) nodeType = typeFromName
          }
        } else {
          nodeType = node.name
        }
      }
    }

    // 3. 노드 ID에서 추가 추출
    if ((nodeType === 'custom' || !nodeType) && typeof node.id === 'string' && node.id.includes('_')) {
      const idParts = node.id.split('_')
      const lastPart = idParts[idParts.length - 1]
      if (/^\d+$/.test(lastPart)) {
        const typeFromId = idParts.slice(0, -1).join('_')
        if (typeFromId) nodeType = typeFromId
      }
    }

    // 한글 라벨에서 타입 추출
    if ((nodeType === 'custom' || !nodeType) && node.data?.label) {
      const koreanLabelMap = {
        '미디언 필터': 'median_filter',
        '미디안 필터': 'median_filter',
        '감마 보정': 'gamma',
        '히스토그램 평활화': 'histogram_equalization',
        '히스토그램': 'histogram_equalization',
        '가우시안 블러': 'gaussian_blur',
        '블러': 'gaussian_blur',
        '비등방성 확산': 'anisotropic_diffusion',
        '비등방성 확산 필터': 'anisotropic_diffusion',
        '비등방성 필터': 'anisotropic_diffusion',
        '비등방성': 'anisotropic_diffusion',
        '이진화': 'threshold',
        '밝기 조정': 'brightness',
        '밝기': 'brightness',
        '대비 조정': 'contrast',
        '대비': 'contrast',
        '객체 검출': 'object_detection',
        '객체 감지': 'object_detection',
        '적응형 히스토그램 평활화': 'clahe',
        'CLAHE': 'clahe',
        '샤프닝': 'sharpen',
        '샤프': 'sharpen',
        '그레이스케일': 'grayscale',
        '회색조': 'grayscale',
        '정규화': 'normalize',
        '이미지 병합': 'merge',
        '병합': 'merge',
        'SAM2 세그멘테이션': 'sam2',
        'SAM2': 'sam2',
        '세그멘테이션': 'sam2'
      }

      if (koreanLabelMap[node.data.label]) {
        nodeType = koreanLabelMap[node.data.label]
      }
    }

    // 호환성 매핑
    const basicTypeMap = {
      'median': 'median_filter',
      'blur': 'gaussian_blur',
      'gaussian': 'gaussian_blur',
      'gamma_correction': 'gamma',
      'gamma': 'gamma',
      'anisotropic': 'anisotropic_diffusion',
      'anisotropic_diffusion_filter': 'anisotropic_diffusion',
      'anisotropic_filter': 'anisotropic_diffusion',
      'histogram_eq': 'histogram_equalization',
      'hist_eq': 'histogram_equalization',
      'histogram': 'histogram_equalization',
      'histogram_equalization': 'histogram_equalization',
      'threshold': 'threshold',
      'brightness': 'brightness',
      'contrast': 'contrast',
      'clahe': 'clahe',
      'object_detection': 'object_detection',
      'object-detection': 'object_detection',
      'object': 'object_detection',
      'sharpen': 'sharpen',
      'grayscale': 'grayscale',
      'normalize': 'normalize',
      'merge': 'merge',
      'sam2': 'sam2',
      'segmentation': 'sam2',
      'segment': 'sam2',
      'SAM2': 'sam2',
      'opening': 'opening',
      'closing': 'closing',
      'hrnet': 'hrnet',
      'unet_attention': 'unet_attention',
      'unet-attention': 'unet_attention',
      'unet+attention': 'unet_attention',
    }

    if (basicTypeMap[nodeType]) {
      nodeType = basicTypeMap[nodeType]
    }

    return { nodeType, originalNodeType }
  }

  /**
   * Revoke an old blob URL stored in processedImages for a given node,
   * preventing memory leaks from accumulated blob URLs.
   */
  const revokeOldBlobUrl = (nodeId) => {
    const oldUrl = processedImages[nodeId]
    if (oldUrl && typeof oldUrl === 'string' && oldUrl.startsWith('blob:')) {
      URL.revokeObjectURL(oldUrl)
    }
  }

  /**
   * Store a processed image URL for a node, revoking any previous blob URL first.
   */
  const setProcessedImage = (nodeId, url) => {
    revokeOldBlobUrl(nodeId)
    processedImages[nodeId] = url
  }

  /**
   * Revoke all blob URLs stored in processedImages.
   * Should be called on component unmount to prevent memory leaks.
   */
  const revokeAllProcessedImages = () => {
    for (const key of Object.keys(processedImages)) {
      const url = processedImages[key]
      if (url && typeof url === 'string' && url.startsWith('blob:')) {
        URL.revokeObjectURL(url)
      }
      delete processedImages[key]
    }
  }

  /**
   * Clean up processedImages entries for nodes that no longer exist in elements.
   */
  const cleanupDeletedNodeImages = () => {
    const existingNodeIds = new Set(
      elements.value
        .filter(el => el.type !== 'smoothstep')
        .map(el => el.id)
    )
    for (const key of Object.keys(processedImages)) {
      if (!existingNodeIds.has(key)) {
        revokeOldBlobUrl(key)
        delete processedImages[key]
      }
    }
  }

  /**
   * Detect image format from various sources (URL, headers, blob type).
   */
  const detectImageFormat = (url) => {
    if (!url) return null
    try {
      const fileExtMatch = url.match(/\.([^.?]+)(?:\?|$)/)
      if (fileExtMatch && fileExtMatch[1]) {
        return fileExtMatch[1].toLowerCase()
      }
    } catch (e) {
      // ignore
    }
    return null
  }

  /**
   * Process a single workflow node by calling the backend API.
   * Handles node type resolution, FormData construction, API call, and blob URL creation.
   *
   * @param {Object} node - The node element to process
   * @param {string} inputImageUrl - The input image URL to process
   * @returns {Promise<string>} The processed image blob URL
   */
  const processNode = async (node, inputImageUrl) => {
    try {
      if (!node.data?.params) {
        console.warn(`[processNode] 노드 ${node.id}에 파라미터가 없습니다. 기본값 사용`)
        node.data.params = getDefaultParams(node.data?.nodeId || node.data?.id || node.type, defaultOptions.value)
      }

      const { nodeType, originalNodeType } = resolveNodeType(node)

      console.log(`[processNode] 최종 API 요청 타입: ${nodeType} (원본: ${originalNodeType})`)

      const supportedNodeTypes = [
        'median_filter', 'gaussian_blur', 'gamma', 'anisotropic_diffusion',
        'histogram_equalization', 'threshold', 'brightness', 'contrast',
        'clahe', 'object_detection', 'blur', 'sharpen', 'grayscale', 'normalize', 'merge', 'sam2',
        'opening', 'closing', 'hrnet', 'unet_attention'
      ]

      if (!supportedNodeTypes.includes(nodeType)) {
        throw new Error(`지원되지 않는 노드 타입: ${nodeType}. 지원되는 타입: ${supportedNodeTypes.join(', ')}`)
      }

      if (!nodeType || nodeType === 'undefined' || nodeType === 'null') {
        throw new Error(`유효하지 않은 노드 타입: ${nodeType}`)
      }

      const params = {}
      if (node.data?.params) {
        Object.entries(node.data.params).forEach(([key, param]) => {
          params[key] = param.value
        })
      }

      let imageFormat = detectImageFormat(inputImageUrl)

      const formData = new FormData()
      const response = await fetch(inputImageUrl)

      const contentType = response.headers.get('Content-Type')
      if (contentType && contentType.startsWith('image/') && !imageFormat) {
        const formatFromHeader = contentType.split('/')[1]
        if (formatFromHeader) imageFormat = formatFromHeader.toLowerCase()
      }

      const blob = await response.blob()

      if (blob.type && blob.type.startsWith('image/') && (!imageFormat || blob.type !== `image/${imageFormat}`)) {
        const formatFromBlob = blob.type.split('/')[1]
        if (formatFromBlob) imageFormat = formatFromBlob.toLowerCase()
      }

      const fileName = imageFormat ? `image.${imageFormat}` : 'image.png'
      formData.append('image', blob, fileName)
      formData.append('params', JSON.stringify(params))

      if (imageFormat) {
        formData.append('format', imageFormat)
      }

      const apiUrl = `http://localhost:8000/api/msa5/work/${nodeType}`

      // SAM2 파라미터 검증 및 로깅
      if (nodeType === 'sam2') {
        console.log(`[processNode] SAM2 API 요청:`, { url: apiUrl, params, fileName, imageFormat })
      }

      try {
        const apiResponse = await fetch(apiUrl, {
          method: 'POST',
          body: formData
        })

        if (!apiResponse.ok) {
          const errorText = await apiResponse.text()
          console.error(`[processNode] API 응답 오류 (${apiResponse.status}): ${errorText}`)

          if (nodeType === 'sam2') {
            if (apiResponse.status === 500) {
              throw new Error(`SAM2 모델 로딩 오류: ${errorText}. SAM2 모델이 설치되어 있는지 확인하세요.`)
            } else if (apiResponse.status === 422) {
              throw new Error(`SAM2 파라미터 오류: ${errorText}. 노드 설정을 확인하세요.`)
            }
          }

          throw new Error(`API 응답 오류 (${apiResponse.status}): ${errorText}`)
        }

        // 출력 형식 감지
        let outputFormat = 'png'
        const formatHeader = apiResponse.headers.get('X-Image-Format')
        if (formatHeader) {
          outputFormat = formatHeader.toLowerCase()
          if (outputFormat === 'jpeg') outputFormat = 'jpg'
        }

        const responseContentType = apiResponse.headers.get('Content-Type')
        if (responseContentType && !formatHeader) {
          const formatMap = {
            'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
            'image/webp': 'webp', 'image/bmp': 'bmp', 'image/tiff': 'tiff'
          }
          for (const [mime, fmt] of Object.entries(formatMap)) {
            if (responseContentType.includes(mime)) {
              outputFormat = fmt
              break
            }
          }
        }

        const imageBlob = await apiResponse.blob()

        if (imageBlob.type && imageBlob.type.startsWith('image/')) {
          const blobFormat = imageBlob.type.split('/')[1]
          if (blobFormat) {
            outputFormat = blobFormat.toLowerCase()
            if (outputFormat === 'jpeg') outputFormat = 'jpg'
          }
        }

        const processedImageUrl = URL.createObjectURL(imageBlob)

        sessionStorage.setItem(`msa5_node_${node.id}_format`, outputFormat)

        return processedImageUrl
      } catch (apiError) {
        console.error(`[processNode] API 호출 중 오류 발생:`, apiError)

        if (apiError.name === 'TypeError' && apiError.message.includes('fetch')) {
          const serverMsg = nodeType === 'sam2' ? 'SAM2 API 서버' : 'API 서버'
          throw new Error(`${serverMsg}에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인하세요. (${apiUrl})`)
        }

        if (apiError.message.includes('CORS')) {
          throw new Error('CORS 오류: 백엔드 서버의 CORS 설정을 확인하세요.')
        }

        throw apiError
      }
    } catch (error) {
      console.error(`[processNode] 노드 ${node.id} 처리 중 오류:`, error)
      showWorkflowErrorDialog.value = true
      workflowErrorTitle.value = '노드 처리 오류'
      workflowErrorMessage.value = `노드 '${node.data?.label || node.id}' (타입: ${node.data?.nodeId || node.data?.id}) 처리 중 오류가 발생했습니다.`
      workflowErrorDetails.value = error.message || '알 수 없는 오류'
      throw error
    }
  }

  /**
   * Process a merge node by collecting images from all input edges and sending to the merge API.
   *
   * @param {Object} node - The merge node element
   * @returns {Promise<string>} The merged image blob URL
   */
  const processMergeNode = async (node) => {
    try {
      const inputEdges = elements.value.filter(
        el => el.type === 'smoothstep' && el.target === node.id
      )

      const imagePromises = []
      let primaryImageFormat = null

      for (const edge of inputEdges) {
        const sourceNodeId = edge.source
        const sourceImage = processedImages[sourceNodeId]

        if (sourceImage) {
          const nodeFormat = sessionStorage.getItem(`msa5_node_${sourceNodeId}_format`)
          if (nodeFormat && !primaryImageFormat) {
            primaryImageFormat = nodeFormat
          }

          if (!primaryImageFormat) {
            primaryImageFormat = detectImageFormat(sourceImage)
          }

          const response = await fetch(sourceImage)

          const contentType = response.headers.get('Content-Type')
          if (contentType && contentType.startsWith('image/') && !primaryImageFormat) {
            const formatFromHeader = contentType.split('/')[1]
            if (formatFromHeader) primaryImageFormat = formatFromHeader.toLowerCase()
          }

          const blob = await response.blob()

          if (blob.type && blob.type.startsWith('image/')) {
            const formatFromBlob = blob.type.split('/')[1]
            if (formatFromBlob && primaryImageFormat === null) {
              primaryImageFormat = formatFromBlob.toLowerCase()
            }
          }

          imagePromises.push({ sourceNodeId, blob })
        }
      }

      if (imagePromises.length < 2) {
        throw new Error('병합에는 최소 2개의 이미지가 필요합니다.')
      }

      const params = {}
      if (node.data?.params) {
        Object.entries(node.data.params).forEach(([key, param]) => {
          params[key] = param.value
        })
      }

      const formData = new FormData()

      for (let i = 0; i < imagePromises.length; i++) {
        const { sourceNodeId, blob } = imagePromises[i]
        const imageFormat = blob.type && blob.type.startsWith('image/')
          ? blob.type.split('/')[1]
          : (primaryImageFormat || 'png')
        formData.append('images', blob, `image_${i}.${imageFormat}`)
      }

      formData.append('params', JSON.stringify(params))

      if (primaryImageFormat) {
        formData.append('format', primaryImageFormat)
      }

      const apiUrl = 'http://localhost:8000/api/msa5/work/merge'
      const apiResponse = await fetch(apiUrl, {
        method: 'POST',
        body: formData
      })

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text()
        throw new Error(`병합 API 응답 오류 (${apiResponse.status}): ${errorText}`)
      }

      let outputFormat = primaryImageFormat || 'png'
      const formatHeader = apiResponse.headers.get('X-Image-Format')
      if (formatHeader) {
        outputFormat = formatHeader.toLowerCase()
        if (outputFormat === 'jpeg') outputFormat = 'jpg'
      }

      const responseContentType = apiResponse.headers.get('Content-Type')
      if (responseContentType && !formatHeader) {
        const formatMap = {
          'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
          'image/webp': 'webp', 'image/bmp': 'bmp', 'image/tiff': 'tiff'
        }
        for (const [mime, fmt] of Object.entries(formatMap)) {
          if (responseContentType.includes(mime)) {
            outputFormat = fmt
            break
          }
        }
      }

      const imageBlob = await apiResponse.blob()

      if (imageBlob.type && imageBlob.type.startsWith('image/')) {
        const blobFormat = imageBlob.type.split('/')[1]
        if (blobFormat) {
          outputFormat = blobFormat.toLowerCase()
          if (outputFormat === 'jpeg') outputFormat = 'jpg'
        }
      }

      const processedImageUrl = URL.createObjectURL(imageBlob)

      sessionStorage.setItem(`msa5_node_${node.id}_format`, outputFormat)

      return processedImageUrl
    } catch (error) {
      console.error(`[processMergeNode] 병합 노드 ${node.id} 처리 중 오류:`, error)
      throw error
    }
  }

  return {
    getDefaultParams,
    resolveNodeType,
    processNode,
    processMergeNode,
    setProcessedImage,
    revokeAllProcessedImages,
    cleanupDeletedNodeImages,
    detectImageFormat
  }
}
