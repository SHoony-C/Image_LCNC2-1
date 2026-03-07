import { ref } from 'vue'

/**
 * Composable for MSA2 data loading, vector projection, normalization, and distance calculation.
 *
 * @param {Object} deps - Dependencies
 * @param {import('vue').Ref} deps.isDataLoaded
 * @param {import('vue').Ref} deps.loadingComplete
 * @param {import('vue').Ref} deps.loadingMessage
 * @param {import('vue').Ref} deps.isLoading
 * @param {Function} deps.showMessage
 * @param {Function} deps.displayErrorMessage
 * @param {Function} deps.updatePlot - function to update the Plotly chart after data load
 * @returns data processing state and functions
 */
export function useDataProcessing(deps) {
  const vectors = ref([])
  const projectedVectors = ref([])
  const labels = ref([])
  const imageLabels = ref([])
  const markerColors = ref([])
  const markerSizes = ref([])
  const similarImages = ref([])

  // ========================================
  // Vector data loading
  // ========================================
  async function checkVectorsData() {
    // Reset all data states before loading
    vectors.value = []
    projectedVectors.value = []
    labels.value = []
    imageLabels.value = []
    markerColors.value = []
    markerSizes.value = []
    similarImages.value = []

    if (vectors.value && vectors.value.length > 0) {
      return
    }

    deps.loadingMessage.value = '벡터 데이터 로딩 중...'
    deps.isLoading.value = true

    try {
      const timestamp = new Date().getTime()
      const processedVectorsResponse = await fetch(`http://localhost:8000/storage/vector/processed_vectors.json?t=${timestamp}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
      const processedMetadataResponse = await fetch(`http://localhost:8000/storage/vector/processed_metadata.json?t=${timestamp}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })

      if (processedVectorsResponse.ok && processedMetadataResponse.ok) {
        const vectorsData = await processedVectorsResponse.json()
        const metadata = await processedMetadataResponse.json()

        if (vectorsData && vectorsData.length > 0 && metadata && metadata.length > 0) {
          const vectorsCopy = JSON.parse(JSON.stringify(vectorsData))
          const metadataCopy = JSON.parse(JSON.stringify(metadata))

          processVectorData(vectorsCopy, metadataCopy)
          deps.isDataLoaded.value = true
          deps.loadingComplete.value = true
          deps.loadingMessage.value = ''
          deps.showMessage('이미지의 고차원 특징 기반 유사도 매핑 완료', 'info')
          return
        }
      }

      throw new Error('직접 파일 접근 실패')
    } catch (fileError) {
      deps.loadingComplete.value = true
      deps.isLoading.value = false
      deps.showMessage('벡터 데이터를 로드할 수 없습니다', 'error')
    }
  }

  async function extractVectors() {
    deps.isProcessing.value = true
    deps.loadingMessage.value = '이미지 벡터 추출 중...'

    try {
      const response = await fetch('/api/msa4/extract-vectors', {
        method: 'POST'
      })

      const data = await response.json()

      if (data.status === 'success') {
        deps.showMessage(`${data.count}개 이미지 벡터 추출 완료`, 'success')
        await checkVectorsData()
      } else {
        deps.showMessage(data.message || '벡터 추출 실패', 'warning')
      }
    } catch (error) {
      console.error('Error extracting vectors:', error)
      deps.showMessage('벡터 추출 중 오류가 발생했습니다', 'error')
    }
  }

  // ========================================
  // Vector projection
  // ========================================
  function projectVectorsWith3DPCA(vecs) {
    if (!vecs || vecs.length === 0) {
      console.error('No vectors to project')
      return []
    }

    try {
      const vectorDim = vecs[0].length
      if (vectorDim < 3) {
        console.warn(`Vector dimension (${vectorDim}) is too small for 3D projection, using fallback`)
        return fallbackVectorProjection(vecs)
      }

      const projected = vecs.map((vec, index) => {
        return processVectorBySize(vec, index)
      })

      const normalized = normalizeVectors(projected)

      const hasNonZeroCoords = normalized.some(vec =>
        vec.some(coord => coord !== 0)
      )

      if (!hasNonZeroCoords) {
        console.warn('All coordinates are zero, using fallback projection')
        return fallbackVectorProjection(vecs)
      }

      return normalized
    } catch (error) {
      console.error('Error in vector projection:', error)
      return fallbackVectorProjection(vecs)
    }
  }

  function processVectorBySize(vec, index) {
    const length = vec.length

    if (!vec || length === 0) {
      return [0.1 + (index * 0.1), 0.2 + (index * 0.05), 0.3 + (index * 0.08)]
    }

    if (length <= 2) {
      return processTinyVector(vec, index)
    }

    if (length <= 10) {
      return processSmallVector(vec)
    }

    if (length <= 100) {
      return processMediumVector(vec)
    }

    return processLargeVector(vec)
  }

  function processTinyVector(vec, index) {
    if (vec.length === 1) {
      const val = parseFloat(vec[0]) || 0
      return [val, val * 0.7, val * 0.3]
    } else if (vec.length === 2) {
      const val1 = parseFloat(vec[0]) || 0
      const val2 = parseFloat(vec[1]) || 0
      return [val1, val2, (val1 + val2) / 2]
    }
    return [0.1 + (index * 0.1), 0.2 + (index * 0.05), 0.3 + (index * 0.08)]
  }

  function processSmallVector(vec) {
    const length = vec.length

    if (length === 3) {
      return [
        parseFloat(vec[0]) || 0,
        parseFloat(vec[1]) || 0,
        parseFloat(vec[2]) || 0
      ]
    }

    if (length <= 5) {
      return [
        parseFloat(vec[0]) || 0,
        parseFloat(vec[1]) || 0,
        parseFloat(vec[2]) || 0
      ]
    }

    const groupSize = Math.floor(length / 3)
    const remainder = length % 3

    const groups = []
    let startIdx = 0

    for (let i = 0; i < 3; i++) {
      if (i < remainder) {
        groups.push(vec.slice(startIdx, startIdx + groupSize + 1))
        startIdx += groupSize + 1
      } else {
        groups.push(vec.slice(startIdx, startIdx + groupSize))
        startIdx += groupSize
      }
    }

    return groups.map(group => {
      const sum = group.reduce((acc, val) => acc + (typeof val === 'number' ? val : 0), 0)
      const avg = group.length > 0 ? sum / group.length : 0
      return isNaN(avg) ? 0 : avg
    })
  }

  function processMediumVector(vec) {
    const length = vec.length

    const weights = []
    for (let i = 0; i < length; i++) {
      weights.push(0.5 + (i / length) * 1.0)
    }

    const weightedVec = vec.map((val, i) => (parseFloat(val) || 0) * weights[i])

    const groupSize = Math.floor(length / 3)
    const remainder = length % 3

    const groups = []
    let startIdx = 0

    for (let i = 0; i < 3; i++) {
      if (i < remainder) {
        groups.push(weightedVec.slice(startIdx, startIdx + groupSize + 1))
        startIdx += groupSize + 1
      } else {
        groups.push(weightedVec.slice(startIdx, startIdx + groupSize))
        startIdx += groupSize
      }
    }

    return groups.map(group => {
      if (group.length === 0) return 0

      const mean = group.reduce((sum, val) => sum + val, 0) / group.length
      const variance = group.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / group.length
      const std = Math.sqrt(variance)

      return mean + std * 0.1
    })
  }

  function processLargeVector(vec) {
    const length = vec.length

    const values = vec.map(val => parseFloat(val) || 0)
    const mean = values.reduce((sum, val) => sum + val, 0) / length
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / length
    const std = Math.sqrt(variance)
    const min = Math.min(...values)
    const max = Math.max(...values)

    const startSize = Math.floor(length / 4)
    const endSize = Math.floor(length / 4)
    const middleSize = length - startSize - endSize

    const startSection = values.slice(0, startSize)
    const middleSection = values.slice(startSize, startSize + middleSize)
    const endSection = values.slice(startSize + middleSize)

    const calculateSectionFeatures = (section) => {
      if (section.length === 0) return 0

      const sectionMean = section.reduce((sum, val) => sum + val, 0) / section.length
      const sectionVariance = section.reduce((sum, val) => sum + Math.pow(val - sectionMean, 2), 0) / section.length
      const sectionStd = Math.sqrt(sectionVariance)
      const sectionMax = Math.max(...section)

      return sectionMean * 0.6 + sectionStd * 0.3 + sectionMax * 0.1
    }

    let xCoord = calculateSectionFeatures(startSection)
    let yCoord = calculateSectionFeatures(middleSection)
    let zCoord = calculateSectionFeatures(endSection)

    if (max !== min) {
      xCoord = (xCoord - min) / (max - min)
      yCoord = (yCoord - min) / (max - min)
      zCoord = (zCoord - min) / (max - min)
    }

    if (isNaN(xCoord)) xCoord = 0
    if (isNaN(yCoord)) yCoord = 0
    if (isNaN(zCoord)) zCoord = 0

    const result = [xCoord, yCoord, zCoord]

    if (result.every(v => v === 0)) {
      return [
        mean || 0.1,
        std || 0.2,
        (max + min) / 2 || 0.3
      ]
    }

    return result
  }

  function normalizeVectors(projected) {
    const dimensions = [0, 1, 2].map(dim => {
      const values = projected
        .map(v => v[dim])
        .filter(val => !isNaN(val) && isFinite(val) && val !== null)

      if (values.length === 0) return { min: 0, max: 1 }

      const min = Math.min(...values)
      const max = Math.max(...values)
      return { min, max }
    })

    return projected.map(vec =>
      vec.map((val, i) => {
        const min = dimensions[i].min
        const max = dimensions[i].max

        if (isNaN(val) || !isFinite(val)) {
          return 0.5
        }

        if (max === min) {
          return 0.5
        }

        return (val - min) / (max - min)
      })
    )
  }

  function fallbackVectorProjection(vecs) {
    console.log('Using fallback vector projection')

    return vecs.map((vec, index) => {
      if (!vec || vec.length === 0) {
        return [0.1 + (index * 0.1), 0.2 + (index * 0.05), 0.3 + (index * 0.08)]
      }

      return processSmallVector(vec)
    })
  }

  // ========================================
  // Distance & similarity
  // ========================================
  function calculate3DDistance(point1, point2) {
    if (!point1 || !point2) return 1

    const dx = point1[0] - point2[0]
    const dy = point1[1] - point2[1]
    const dz = point1[2] - point2[2]

    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  }

  function findSimilarImagesByDistance(selectedIndex) {
    return new Promise((resolve, reject) => {
      try {
        if (!projectedVectors.value || !projectedVectors.value[selectedIndex]) {
          resolve([])
          return
        }

        const selectedVector = projectedVectors.value[selectedIndex]
        const selectedIsIApp = labels.value[selectedIndex] && labels.value[selectedIndex].includes('_before')

        const iAppDistances = []
        const analysisDistances = []

        for (let idx = 0; idx < projectedVectors.value.length; idx++) {
          if (idx === selectedIndex) continue

          const vector = projectedVectors.value[idx]
          if (!vector) continue

          const isIApp = labels.value[idx] && labels.value[idx].includes('_before')
          const distance = calculate3DDistance(selectedVector, vector)

          if (isIApp) {
            iAppDistances.push({
              index: idx,
              filename: labels.value[idx],
              distance: distance,
              tag_type: 'I-TAP'
            })
          } else {
            analysisDistances.push({
              index: idx,
              filename: labels.value[idx],
              distance: distance,
              tag_type: 'Analysis'
            })
          }
        }

        iAppDistances.sort((a, b) => a.distance - b.distance)
        analysisDistances.sort((a, b) => a.distance - b.distance)

        const topIAppImages = iAppDistances.slice(0, 3)
        const topAnalysisImages = analysisDistances.slice(0, 3)

        const transformToSimilarImage = (item) => {
          const maxDistance = 1.732
          const normalizedDistance = Math.min(item.distance / maxDistance, 1)
          const similarity = Math.round((1 - normalizedDistance) * 100)

          return {
            filename: item.filename,
            similarity: similarity,
            url: getImageUrl(item.filename),
            tag_type: item.tag_type
          }
        }

        const iappImages = topIAppImages.map(transformToSimilarImage)
        const analysisImages = topAnalysisImages.map(transformToSimilarImage)
        const result = [...iappImages, ...analysisImages]

        similarImages.value = result

        resolve(result)
      } catch (error) {
        console.error('Error finding similar images by distance:', error)
        resolve([])
      }
    })
  }

  function findSimilarPoints(selectedIndex, count = 5) {
    if (!projectedVectors.value || !projectedVectors.value[selectedIndex]) {
      return []
    }

    const selectedVector = projectedVectors.value[selectedIndex]

    const distances = projectedVectors.value.map((vector, idx) => {
      return {
        index: idx,
        distance: calculate3DDistance(selectedVector, vector),
        isSelf: idx === selectedIndex
      }
    })

    distances.sort((a, b) => a.distance - b.distance)

    return distances
      .filter(item => !item.isSelf)
      .slice(0, count)
  }

  // ========================================
  // URL helpers
  // ========================================
  function getApiEndpoint(path) {
    const baseUrl = 'https://10.172.107.194'
    return `${baseUrl}${path}`
  }

  function getImageUrl(filename) {
    if (!filename) return ''

    if (filename === 'main' || filename.includes('localhost') ||
        filename.includes('undefined') || filename.includes('null')) {
      console.warn(`MSA2: 유효하지 않은 이미지 파일명: ${filename}, 기본 이미지 URL 반환`)
      return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2NjY2NjYyIgc3Ryb2tlLXdpZHRoPSIyIj48cGF0aCBkPSJNMTAgMTQgMTIgMTEuNSAxNCAxNCIvPjxwYXRoIGQ9Ik0yMCAxM3YtNGExIDEgMCAwIDAtMS0xSDVhMSAxIDAgMCAwLTEgMXY0Ii8+PHBhdGggZD0iTTEgMTd2NGExIDEgMCAwIDAgMSAxaDIwYTEgMSAwIDAgMCAxLTF2LTRhMSAxIDAgMCAwLTEtMUgyYTEgMSAwIDAgMC0xIDF6Ii8+PC9zdmc+'
    }

    let imageFilename = encodeURIComponent(filename)

    if (filename.startsWith('http://') || filename.startsWith('https://')) {
      return filename
    }

    return `http://localhost:8000/imageanalysis/images/${imageFilename}`
  }

  function getImageNameFromUrl(url) {
    try {
      const urlObj = new URL(url)
      const pathname = urlObj.pathname
      const filename = pathname.substring(pathname.lastIndexOf('/') + 1)
      return decodeURIComponent(filename)
    } catch (error) {
      return 'unknown_image.jpg'
    }
  }

  function compareFilenames(filename1, filename2) {
    try {
      const name1 = filename1.split('.')[0].toLowerCase()
      const name2 = filename2.split('.')[0].toLowerCase()

      const cleanName1 = name1.replace(/^\d{8}_\d{6}_/, '')
      const cleanName2 = name2.replace(/^\d{8}_\d{6}_/, '')

      return cleanName1 === cleanName2 || name1 === name2
    } catch (error) {
      return false
    }
  }

  // ========================================
  // Process vector data (uses updatePlot from deps)
  // ========================================
  function processVectorData(vectorsData, labelsData) {
    if (!vectorsData || vectorsData.length === 0) {
      deps.displayErrorMessage('유효한 벡터 데이터가 없습니다.')
      return
    }

    vectors.value = [...vectorsData]

    console.log('Original labels received:', labelsData)

    if (labelsData && Array.isArray(labelsData) && labelsData.length > 0) {
      labels.value = [...labelsData]
    } else {
      labels.value = Array(vectorsData.length).fill().map((_, i) => `fallback_${i+1}`)
    }

    imageLabels.value = [...labels.value]

    try {
      projectedVectors.value = projectVectorsWith3DPCA([...vectorsData])

      if (!projectedVectors.value || projectedVectors.value.length === 0) {
        deps.displayErrorMessage('벡터 데이터를 시각화할 수 없습니다.')
        return
      }

      deps.updatePlot()

      deps.isDataLoaded.value = true
      deps.loadingComplete.value = true
      deps.loadingMessage.value = ''
    } catch (error) {
      console.error('Error processing vector data:', error)
      deps.displayErrorMessage('벡터 데이터 처리 중 오류가 발생했습니다')
      deps.loadingComplete.value = true
      deps.loadingMessage.value = ''
    }
  }

  // ========================================
  // Tag groups
  // ========================================
  function getTagGroups() {
    try {
      const tagGroups = {
        'I-TAP': [],
        'Analysis': []
      }

      if (!labels.value || labels.value.length === 0) {
        return tagGroups
      }

      for (let i = 0; i < labels.value.length; i++) {
        const label = labels.value[i]
        if (!label) {
          continue
        }

        if (typeof label === 'string' && label.includes('_before')) {
          tagGroups['I-TAP'].push(i)
        } else {
          tagGroups['Analysis'].push(i)
        }
      }

      return tagGroups
    } catch (error) {
      return { 'I-TAP': [], 'Analysis': [] }
    }
  }

  return {
    vectors,
    projectedVectors,
    labels,
    imageLabels,
    markerColors,
    markerSizes,
    similarImages,
    checkVectorsData,
    extractVectors,
    projectVectorsWith3DPCA,
    processVectorBySize,
    processTinyVector,
    processSmallVector,
    processMediumVector,
    processLargeVector,
    normalizeVectors,
    fallbackVectorProjection,
    calculate3DDistance,
    findSimilarImagesByDistance,
    findSimilarPoints,
    getApiEndpoint,
    getImageUrl,
    getImageNameFromUrl,
    compareFilenames,
    processVectorData,
    getTagGroups
  }
}
