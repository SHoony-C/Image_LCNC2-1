import { ref } from 'vue'
import Plotly from 'plotly.js-dist'

/**
 * Composable for MSA2 Plotly 3D chart initialization, rendering, updating, and marker highlighting.
 *
 * @param {Object} deps - Dependencies
 * @param {import('vue').Ref} deps.plotlyContainer - template ref for plotly container div
 * @param {import('vue').Ref} deps.projectedVectors
 * @param {import('vue').Ref} deps.labels
 * @param {import('vue').Ref} deps.selectedIndex
 * @param {Function} deps.calculate3DDistance
 * @param {Function} deps.findSimilarPoints
 * @param {Function} deps.selectImageByIndex
 * @returns chart state and functions
 */
export function usePlotlyChart(deps) {
  const plot = ref(null)
  const resizeObserver = ref(null)
  const resizeHandler = ref(null)
  const containerObserver = ref(null)
  const containerWidth = ref(0)
  const containerHeight = ref(0)
  const plotSizeObserver = ref(null)
  const plotData = ref([])
  const plotColors = ref([])
  const plotOriginalColors = ref([])
  const plotPointTypes = ref([])
  const plotOriginalIndices = ref([])
  const plotPointSizes = ref([])
  const plotCenter = ref(null)
  const currentCameraPosition = ref({
    eye: { x: 1.5, y: 1.5, z: 1.5 },
    up: { x: 0, y: 0, z: 1 }
  })
  const plotLayout = ref({
    scene: {
      xaxis: { title: 'X' },
      yaxis: { title: 'Y' },
      zaxis: { title: 'Z' }
    },
    showlegend: false,
    margin: { l: 0, r: 0, t: 0, b: 0 },
    hovermode: 'closest'
  })
  const lastHighlightIndex = ref(-1)

  // ========================================
  // ResizeObserver
  // ========================================
  function setupResizeObserver(el) {
    if (resizeObserver.value) {
      resizeObserver.value.disconnect()
    }

    const container = el.querySelector('.content-container')
    if (!container) {
      return
    }

    let resizeTimeout = null
    let lastResizeTime = 0
    const RESIZE_DELAY = 300

    resizeObserver.value = new ResizeObserver(entries => {
      if (resizeTimeout) {
        clearTimeout(resizeTimeout)
      }

      const now = Date.now()
      if (now - lastResizeTime < RESIZE_DELAY) {
        resizeTimeout = setTimeout(() => {
          handleResize(entries)
          lastResizeTime = Date.now()
        }, RESIZE_DELAY)
        return
      }

      handleResize(entries)
      lastResizeTime = now
    })

    resizeObserver.value.observe(container)
  }

  function handleResize(entries) {
    try {
      for (const entry of entries) {
        const { width, height } = entry.contentRect

        const plotDiv = deps.plotlyContainer.value
        if (plotDiv && plotDiv.innerHTML !== '' && plotDiv.clientWidth > 0) {
          requestAnimationFrame(() => {
            try {
              Plotly.Plots.resize(plotDiv)
            } catch (error) {
              console.error('Error resizing plot:', error)
            }
          })
        }
      }
    } catch (err) {
      console.error('Error in handleResize:', err)
    }
  }

  // ========================================
  // Initialize empty plot
  // ========================================
  function initializePlot() {
    const container = deps.plotlyContainer.value
    if (!container) {
      return
    }

    if (container.clientWidth === 0 || container.clientHeight === 0) {
      setTimeout(() => initializePlot(), 100)
      return
    }

    const emptyData = [{
      type: 'scatter3d',
      mode: 'markers',
      x: [],
      y: [],
      z: [],
      text: [],
      marker: {
        size: 5,
        color: '#cccccc',
        opacity: 0.7
      }
    }]

    const layout = {
      margin: { l: 0, r: 0, b: 0, t: 0 },
      scene: {
        xaxis: { title: '' },
        yaxis: { title: '' },
        zaxis: { title: '' },
        aspectratio: { x: 1, y: 1, z: 1 },
        camera: {
          eye: currentCameraPosition.value ? currentCameraPosition.value.eye : { x: 1.5, y: 1.5, z: 1.5 },
          center: { x: 0.5, y: 0.5, z: 0.5 },
          up: currentCameraPosition.value ? currentCameraPosition.value.up : { x: 0, y: 0, z: 1 }
        }
      },
      showlegend: false,
      hovermode: 'closest',
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      autosize: true,
      width: container.clientWidth,
      height: container.clientHeight
    }

    try {
      if (container.innerHTML !== '') {
        Plotly.purge(container)
      }
      Plotly.newPlot(container, emptyData, layout, { displayModeBar: false, responsive: true })
    } catch (error) {
      console.error('Error creating Plotly visualization:', error)
    }
  }

  // ========================================
  // Point click handler
  // ========================================
  function handlePointClick(data) {
    try {
      const point = data.points[0]
      if (!point) {
        return
      }

      const pointIndex = point.pointIndex

      deps.selectImageByIndex(pointIndex)

      updatePlotMarkers(pointIndex)
    } catch (error) {
      console.error('Error handling point click:', error)
    }
  }

  // ========================================
  // Update plot markers (highlight selected)
  // ========================================
  function updatePlotMarkers(selectedIndex) {
    try {
      const container = deps.plotlyContainer.value
      if (!container) {
        console.error('시각화 컨테이너를 찾을 수 없습니다')
        return
      }

      if (selectedIndex === undefined || selectedIndex < 0 || selectedIndex >= deps.labels.value.length) {
        console.error(`유효하지 않은 선택 인덱스: ${selectedIndex}, 범위: 0-${deps.labels.value.length - 1}`)
        return
      }

      if (!window.Plotly) {
        console.error('Plotly 객체를 찾을 수 없습니다')
        return
      }

      try {
        if (!container.data || container.data.length === 0) {
          updatePlot()
          return
        }

        const prevSelectedIndex = deps.selectedIndex.value !== selectedIndex ? deps.selectedIndex.value : -1

        const existingTraces = container.data || []

        let baseTraceCount = 0
        for (const trace of existingTraces) {
          if (trace.name === 'I-TAP' || trace.name === 'Analysis' || trace.name === '모든 포인트' || trace.name === 'All Points') {
            baseTraceCount++
          }
        }

        if (existingTraces.length > baseTraceCount) {
          const tracesToDelete = []
          for (let i = baseTraceCount; i < existingTraces.length; i++) {
            tracesToDelete.push(i)
          }

          const deleteTracesAsync = () => {
            return new Promise((resolve, reject) => {
              try {
                if (tracesToDelete.length > 0) {
                  Plotly.deleteTraces(container, tracesToDelete)
                    .then(resolve)
                    .catch(e => {
                      console.error('트레이스 삭제 오류:', e)
                      resolve()
                    })
                } else {
                  resolve()
                }
              } catch (error) {
                console.error('트레이스 삭제 처리 오류:', error)
                resolve()
              }
            })
          }

          deleteTracesAsync()
            .then(() => {
              setTimeout(() => {
                addSelectedPointTraces(container, selectedIndex, prevSelectedIndex)
              }, 100)
            })
            .catch(error => {
              console.error('트레이스 삭제 후처리 오류:', error)
              setTimeout(() => {
                addSelectedPointTraces(container, selectedIndex, prevSelectedIndex)
              }, 100)
            })
        } else {
          addSelectedPointTraces(container, selectedIndex, prevSelectedIndex)
        }
      } catch (error) {
        console.error('마커 업데이트 처리 오류:', error)

        try {
          updatePlot()

          setTimeout(() => {
            const retryContainer = deps.plotlyContainer.value
            if (retryContainer && retryContainer.data) {
              addSelectedPointTraces(retryContainer, selectedIndex, -1)
            }
          }, 500)
        } catch (recoveryError) {
          console.error('그래프 복구 시도 실패:', recoveryError)
        }
      }
    } catch (outerError) {
      console.error('전체 마커 업데이트 프로세스 오류:', outerError)
    }
  }

  // ========================================
  // Add selected point traces
  // ========================================
  function addSelectedPointTraces(container, selectedIndex, prevSelectedIndex) {
    try {
      if (!container) {
        console.error('시각화 컨테이너가 유효하지 않습니다')
        return
      }

      if (typeof Plotly === 'undefined' || !Plotly.addTraces) {
        console.error('Plotly 라이브러리가 초기화되지 않았습니다')
        return
      }

      if (!deps.projectedVectors.value || !deps.projectedVectors.value[selectedIndex] ||
          !Array.isArray(deps.projectedVectors.value[selectedIndex]) ||
          deps.projectedVectors.value[selectedIndex].length !== 3) {
        console.error('선택된 점의 좌표 데이터가 없거나 유효하지 않습니다')
        return
      }

      const coords = deps.projectedVectors.value[selectedIndex]
      const x = coords[0] || 0
      const y = coords[1] || 0
      const z = coords[2] || 0

      const isIApp = deps.labels.value[selectedIndex] && deps.labels.value[selectedIndex].includes('_before')
      const selectedTag = isIApp ? 'I-TAP' : 'Analysis'

      const selectedPointTrace = {
        type: 'scatter3d',
        mode: 'markers',
        x: [x],
        y: [y],
        z: [z],
        text: [`${deps.labels.value[selectedIndex] || '알 수 없음'} (선택됨)`],
        hoverinfo: 'text',
        marker: {
          size: 12,
          color: 'rgba(255, 0, 0, 1)',
          symbol: 'circle',
          opacity: 1,
          line: {
            color: 'white',
            width: 2
          }
        },
        name: '선택된 이미지',
        showlegend: true
      }

      const traces = [selectedPointTrace]

      try {
        const similarPoints = deps.findSimilarPoints(selectedIndex, 5)

        if (similarPoints && similarPoints.length > 0) {
          const validSimilarPoints = similarPoints.filter(p =>
            deps.projectedVectors.value[p.index] &&
            Array.isArray(deps.projectedVectors.value[p.index]) &&
            deps.projectedVectors.value[p.index].length === 3
          )

          if (validSimilarPoints.length > 0) {
            const similarPointsTrace = {
              type: 'scatter3d',
              mode: 'markers',
              x: validSimilarPoints.map(p => deps.projectedVectors.value[p.index][0]),
              y: validSimilarPoints.map(p => deps.projectedVectors.value[p.index][1]),
              z: validSimilarPoints.map(p => deps.projectedVectors.value[p.index][2]),
              text: validSimilarPoints.map(p => `${deps.labels.value[p.index] || '알 수 없음'} (유사도: ${Math.round((1 - p.distance) * 100)}%)`),
              hoverinfo: 'text',
              marker: {
                size: 8,
                color: 'rgba(255, 165, 0, 1)',
                opacity: 1,
                line: {
                  color: 'white',
                  width: 1
                }
              },
              name: '유사 이미지',
              showlegend: true
            }

            traces.push(similarPointsTrace)

            for (const point of validSimilarPoints) {
              const lineTrace = {
                type: 'scatter3d',
                mode: 'lines',
                x: [x, deps.projectedVectors.value[point.index][0]],
                y: [y, deps.projectedVectors.value[point.index][1]],
                z: [z, deps.projectedVectors.value[point.index][2]],
                line: {
                  color: 'rgba(255, 165, 0, 0.8)',
                  width: 3
                },
                opacity: 0.8,
                hoverinfo: 'none',
                showlegend: false
              }

              traces.push(lineTrace)
            }
          }
        }
      } catch (similarError) {
        console.error('유사한 점들 표시 오류:', similarError)
      }

      try {
        Plotly.addTraces(container, traces)
          .then(() => {
            // trace added
          })
          .catch(err => {
            console.error('트레이스 추가 오류:', err)

            if (traces.length > 1) {
              Plotly.addTraces(container, [selectedPointTrace])
                .catch(e => console.error('단순 선택 트레이스 추가도 실패:', e))
            }
          })
      } catch (addError) {
        console.error('트레이스 추가 시도 오류:', addError)
      }
    } catch (error) {
      console.error('선택된 점 트레이스 추가 오류:', error)
    }
  }

  // ========================================
  // Update plot (full re-render)
  // ========================================
  function updatePlot() {
    console.warn('Update Plot')

    const container = deps.plotlyContainer.value

    containerWidth.value = container.clientWidth
    containerHeight.value = container.clientHeight

    cleanupWebGLContexts()

    try {
      if (container.data) {
        Plotly.purge(container)
      }
    } catch (e) {
      // ignore
    }

    if (!deps.projectedVectors.value || !deps.projectedVectors.value.length) {
      console.error('벡터 데이터가 없습니다.')
      return
    }

    const validIndices = []
    const x = []
    const y = []
    const z = []
    const text = []
    const originalIndices = []
    const pointTypes = []

    for (let i = 0; i < deps.projectedVectors.value.length; i++) {
      const vector = deps.projectedVectors.value[i]
      if (!vector || !Array.isArray(vector) || vector.length < 3) {
        continue
      }

      validIndices.push(i)
      x.push(vector[0] || 0)
      y.push(vector[1] || 0)
      z.push(vector[2] || 0)
      text.push(deps.labels.value[i] || `Point ${i}`)
      originalIndices.push(i)

      const isIApp = (deps.labels.value[i] && deps.labels.value[i].includes('_before'))
      pointTypes.push(isIApp ? 0 : 1)
    }

    const NORMAL_POINT_SIZE = 7.5
    const SELECTED_POINT_SIZE = 12
    const SIMILAR_POINT_SIZE = 9

    plotColors.value = Array(pointTypes.length).fill('rgba(30, 144, 255, 0.6)')
    plotOriginalColors.value = [...plotColors.value]
    plotPointTypes.value = [...pointTypes]
    plotOriginalIndices.value = [...originalIndices]

    plotPointSizes.value = Array(pointTypes.length).fill(NORMAL_POINT_SIZE)

    const layout = {
      scene: {
        xaxis: { title: 'X', range: [-0.1, 1.1], autorange: false },
        yaxis: { title: 'Y', range: [-0.1, 1.1], autorange: false },
        zaxis: { title: 'Z', range: [-0.1, 1.1], autorange: false },
        camera: {
          eye: currentCameraPosition.value ? { ...currentCameraPosition.value.eye } : { x: 1.5, y: 1.5, z: 1.5 },
          center: { x: 0.5, y: 0.5, z: 0.5 },
          up: currentCameraPosition.value ? { ...currentCameraPosition.value.up } : { x: 0, y: 0, z: 1 },
          projection: { type: 'perspective' }
        },
        aspectratio: { x: 1, y: 1, z: 1 },
        aspectmode: 'manual',
        dragmode: 'orbit'
      },
      margin: { l: 0, r: 0, t: 0, b: 0, pad: 0, autoexpand: false },
      paper_bgcolor: 'rgba(255,255,255,0.8)',
      plot_bgcolor: 'rgba(255,255,255,0.8)',
      width: containerWidth.value,
      height: containerHeight.value,
      autosize: false,
      dragmode: 'orbit',
      hovermode: 'closest',
      uirevision: 'true'
    }

    const data = [{
      type: 'scatter3d',
      mode: 'markers',
      x: [...x],
      y: [...y],
      z: [...z],
      text: [...text],
      hoverinfo: 'text',
      marker: {
        size: [...plotPointSizes.value],
        color: [...plotColors.value],
        opacity: 0.8,
        line: {
          color: 'rgba(255,255,255,0.5)',
          width: 0.5
        }
      },
      customdata: [...originalIndices],
      _center: plotCenter.value ? { ...plotCenter.value } : { x: 0.5, y: 0.5, z: 0.5 }
    }]

    try {
      const centerX = x.length > 0 ? x.reduce((sum, val) => sum + val, 0) / x.length : 0.5
      const centerY = y.length > 0 ? y.reduce((sum, val) => sum + val, 0) / y.length : 0.5
      const centerZ = z.length > 0 ? z.reduce((sum, val) => sum + val, 0) / z.length : 0.5

      plotCenter.value = { x: centerX, y: centerY, z: centerZ }

      layout.scene.camera.center = plotCenter.value

      const plotConfig = {
        responsive: false,
        displayModeBar: false,
        scrollZoom: true,
        displaylogo: false,
        showSendToCloud: false,
        staticPlot: false,
        modeBarButtonsToRemove: ['resetCameraDefault3d', 'resetCameraLastSave3d', 'toImage', 'sendDataToCloud'],
        toImageButtonOptions: {
          format: 'png',
          width: 800,
          height: 600
        },
        doubleClick: false
      }

      Plotly.newPlot(container, data, layout, plotConfig)
        .then(() => {
          container.removeAllListeners && container.removeAllListeners('plotly_click')
          container.on('plotly_click', (eventData) => {
            if (!eventData || !eventData.points || !eventData.points[0]) return

            const pointIndex = eventData.points[0].pointNumber
            const customIndex = eventData.points[0].customdata

            if (customIndex !== undefined) {
              deps.selectImageByIndex(customIndex)
            }
          })

          container.on('plotly_doubleclick', (eventData) => {
            if (eventData) eventData.preventDefault()
            return false
          })

          container.on('plotly_relayout', (eventData) => {
            if (eventData['scene.camera']) {
              if (eventData['scene.camera'].eye) {
                currentCameraPosition.value.eye = eventData['scene.camera'].eye
              }
              if (eventData['scene.camera'].up) {
                currentCameraPosition.value.up = eventData['scene.camera'].up
              }

              if (plotCenter.value && eventData['scene.camera'].center) {
                setTimeout(() => {
                  Plotly.relayout(container, {
                    'scene.camera.center': plotCenter.value
                  }).catch(e => console.warn('회전 중심 유지 오류:', e))
                }, 10)
              }
              return
            }

            if (eventData.width !== containerWidth.value ||
                eventData.height !== containerHeight.value) {
              Plotly.relayout(container, {
                width: containerWidth.value,
                height: containerHeight.value,
                autosize: false
              }).catch(e => console.warn('크기 복원 오류:', e))
            }
          })

          if (deps.selectedIndex.value >= 0) {
            setTimeout(() => {
              highlightPointByColor(deps.selectedIndex.value)
            }, 300)
          }
        })
        .catch(error => {
          console.error('Plotly 초기화 오류:', error)
        })
    } catch (error) {
      console.error('플롯 생성 중 치명적 오류:', error)
    }
  }

  // ========================================
  // Color-based highlight
  // ========================================
  function highlightPointByColor(index) {
    try {
      const container = deps.plotlyContainer.value
      if (!container || !container.data || !container.data[0]) {
        console.warn('플롯 컨테이너가 초기화되지 않았습니다.')
        return
      }

      if (!plotColors.value || !plotOriginalColors.value || !plotOriginalIndices.value) {
        console.warn('색상 배열이 초기화되지 않았습니다.')
        return
      }

      const plotIndex = plotOriginalIndices.value.findIndex(i => i === index)
      if (plotIndex === -1) {
        console.warn(`인덱스 ${index}에 해당하는 점이 플롯에 없습니다.`)
        return
      }

      const NORMAL_POINT_SIZE = 7.5
      const SELECTED_POINT_SIZE = 12
      const SIMILAR_POINT_SIZE = 9

      const newColors = Array(plotOriginalIndices.value.length).fill('rgba(30, 144, 255, 0.6)')
      const newSizes = Array(plotOriginalIndices.value.length).fill(NORMAL_POINT_SIZE)

      newColors[plotIndex] = 'rgb(255, 0, 0)'
      newSizes[plotIndex] = SELECTED_POINT_SIZE

      const selectedPointType = plotPointTypes.value[plotIndex]
      const selectedVector = deps.projectedVectors.value[index]

      const lineTraces = []

      const selectedX = selectedVector[0]
      const selectedY = selectedVector[1]
      const selectedZ = selectedVector[2]

      if (selectedVector) {
        const iAppDistances = []
        const analysisDistances = []

        for (let i = 0; i < plotOriginalIndices.value.length; i++) {
          if (i === plotIndex) continue

          const origIndex = plotOriginalIndices.value[i]
          const vector = deps.projectedVectors.value[origIndex]
          const pointType = plotPointTypes.value[i]

          if (vector) {
            const distance = deps.calculate3DDistance(selectedVector, vector)

            if (pointType === 0) {
              iAppDistances.push({ index: i, distance, vector })
            } else {
              analysisDistances.push({ index: i, distance, vector })
            }
          }
        }

        iAppDistances.sort((a, b) => a.distance - b.distance)
        analysisDistances.sort((a, b) => a.distance - b.distance)

        const nearestIApp = iAppDistances.slice(0, 3)
        for (const point of nearestIApp) {
          newColors[point.index] = 'rgb(46, 204, 113)'
          newSizes[point.index] = SIMILAR_POINT_SIZE

          lineTraces.push({
            x: [selectedX, point.vector[0]],
            y: [selectedY, point.vector[1]],
            z: [selectedZ, point.vector[2]],
            color: 'rgba(46, 204, 113, 0.7)',
            width: 6
          })
        }

        const nearestAnalysis = analysisDistances.slice(0, 3)
        for (const point of nearestAnalysis) {
          newColors[point.index] = 'rgb(255, 165, 0)'
          newSizes[point.index] = SIMILAR_POINT_SIZE

          lineTraces.push({
            x: [selectedX, point.vector[0]],
            y: [selectedY, point.vector[1]],
            z: [selectedZ, point.vector[2]],
            color: 'rgba(255, 165, 0, 0.7)',
            width: 6
          })
        }
      }

      // Step 1: Update marker styles
      Plotly.restyle(container, {
        'marker.color': [newColors],
        'marker.size': [newSizes]
      }, [0]).catch(error => {
        console.warn('플롯 색상 업데이트 오류 (무시됨):', error)
      })

      // Step 2: Delete existing line traces
      let tracesToDelete = []
      if (container.data && container.data.length > 1) {
        for (let i = 1; i < container.data.length; i++) {
          tracesToDelete.push(i)
        }

        if (tracesToDelete.length > 0) {
          try {
            Plotly.deleteTraces(container, tracesToDelete)
          } catch (error) {
            console.warn('선 트레이스 삭제 중 오류 (무시됨):', error)
          }
        }
      }

      // Step 3: Add line traces
      if (lineTraces.length > 0) {
        const lines = {
          type: 'scatter3d',
          mode: 'lines',
          x: [],
          y: [],
          z: [],
          line: {
            color: [],
            width: []
          },
          hoverinfo: 'none',
          showlegend: false
        }

        for (let i = 0; i < lineTraces.length; i++) {
          const line = lineTraces[i]

          lines.x.push(line.x[0])
          lines.y.push(line.y[0])
          lines.z.push(line.z[0])
          lines.line.color.push(line.color)
          lines.line.width.push(line.width)

          lines.x.push(line.x[1])
          lines.y.push(line.y[1])
          lines.z.push(line.z[1])
          lines.line.color.push(line.color)
          lines.line.width.push(line.width)

          if (i < lineTraces.length - 1) {
            lines.x.push(null)
            lines.y.push(null)
            lines.z.push(null)
            lines.line.color.push('rgba(0,0,0,0)')
            lines.line.width.push(0)
          }
        }

        Plotly.addTraces(container, [lines])
          .catch(error => {
            console.warn('선 트레이스 추가 오류 (무시됨):', error)
          })
      }

      // Step 4: Fix camera position
      Plotly.relayout(container, {
        'scene.camera.center': plotCenter.value || { x: 0.5, y: 0.5, z: 0.5 }
      }).catch(error => {
        console.warn('카메라 위치 고정 오류 (무시됨):', error)
      })

      plotColors.value = newColors
      plotPointSizes.value = newSizes

    } catch (error) {
      console.error('점 하이라이트 오류:', error)
    }
  }

  // ========================================
  // WebGL cleanup
  // ========================================
  function cleanupWebGLContexts() {
    const canvases = document.querySelectorAll('canvas')
    const container = deps.plotlyContainer.value
    const plotlyCanvases = Array.from(canvases).filter(canvas => {
      const insidePlot = container && container.contains(canvas)
      return !insidePlot && canvas.id.includes('gl-canvas')
    })

    plotlyCanvases.forEach(canvas => {
      try {
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
        if (gl) {
          gl.getExtension('WEBGL_lose_context')?.loseContext()

          if (canvas.parentNode) {
            canvas.parentNode.removeChild(canvas)
          }
        }
      } catch (e) {
        console.warn('WebGL 컨텍스트 정리 중 오류:', e)
      }
    })
  }

  // ========================================
  // Cleanup
  // ========================================
  function cleanup() {
    if (containerObserver.value) {
      containerObserver.value.disconnect()
    }
    if (resizeObserver.value) {
      resizeObserver.value.disconnect()
    }
    if (resizeHandler.value) {
      window.removeEventListener('resize', resizeHandler.value)
    }
    const container = deps.plotlyContainer.value
    if (container) {
      Plotly.purge(container)
    }
    cleanupWebGLContexts()
  }

  return {
    plot,
    resizeObserver,
    resizeHandler,
    containerObserver,
    containerWidth,
    containerHeight,
    plotSizeObserver,
    plotData,
    plotColors,
    plotOriginalColors,
    plotPointTypes,
    plotOriginalIndices,
    plotPointSizes,
    plotCenter,
    currentCameraPosition,
    plotLayout,
    lastHighlightIndex,
    setupResizeObserver,
    handleResize,
    initializePlot,
    handlePointClick,
    updatePlotMarkers,
    addSelectedPointTraces,
    updatePlot,
    highlightPointByColor,
    cleanupWebGLContexts,
    cleanup
  }
}
