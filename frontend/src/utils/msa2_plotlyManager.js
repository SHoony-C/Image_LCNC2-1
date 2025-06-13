import Plotly from 'plotly.js-dist';

// Plotly를 전역 객체로 설정 (window.Plotly 참조용)
window.Plotly = Plotly;

export const plotlyManager = {
  // 3D 시각화 생성
  createVisualization() {
    const container = document.getElementById('plotly-visualization');
    if (!container) {
      console.error('Plotly visualization container not found');
      return;
    }

    // 기본 빈 그래프 생성 (범례 없이)
    const data = [{
      type: 'scatter3d',
      mode: 'markers',
      x: [],
      y: [],
      z: [],
      marker: {
        size: 6,
        color: '#1f77b4',
        opacity: 0.8
      }
    }];

    const layout = {
      margin: { l: 0, r: 0, b: 0, t: 0 },
      scene: {
        xaxis: { title: '' },
        yaxis: { title: '' },
        zaxis: { title: '' },
        aspectratio: { x: 1, y: 1, z: 1 },
        camera: {
          eye: { x: 1.5, y: 1.5, z: 1.5 }
        }
      },
      showlegend: false,
      hovermode: 'closest',
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      autosize: true,
      width: container.clientWidth,
      height: container.clientHeight
    };

    const config = {
      responsive: true,
      displayModeBar: false
    };

    try {
      Plotly.newPlot(container, data, layout, config)
        .then(() => {
          console.log('Empty Plotly visualization created without legend');
          this.plot = container;
        })
        .catch(error => {
          console.error('Error creating Plotly visualization:', error);
        });
    } catch (error) {
      console.error('Error creating Plotly visualization:', error);
    }
  },

  // 데이터 로드 후 시각화 업데이트
  updateData() {
    const container = document.getElementById('plotly-visualization');
    if (!container) {
      return;
    }
    
    if (!this.projectedVectors || this.projectedVectors.length === 0) {
      return;
    }
    
    const tagGroups = this.getTagGroups();
    
    try {
      const iAppIndices = tagGroups['I-app'] || [];
      const iAppData = {
        type: 'scatter3d',
        mode: 'markers',
        x: iAppIndices.map(idx => this.projectedVectors[idx][0]),
        y: iAppIndices.map(idx => this.projectedVectors[idx][1]),
        z: iAppIndices.map(idx => this.projectedVectors[idx][2]),
        text: iAppIndices.map(idx => this.labels[idx]),
        hoverinfo: 'text',
        marker: {
          size: 4,
          color: 'rgba(46, 204, 113, 0.8)',
          opacity: 0.8,
          line: {
            color: 'white',
            width: 0.5
          }
        },
        name: 'I-app 이미지',
        customdata: iAppIndices,
        showlegend: false
      };
      
      const analysisIndices = tagGroups['Analysis'] || [];
      const analysisData = {
        type: 'scatter3d',
        mode: 'markers',
        x: analysisIndices.map(idx => this.projectedVectors[idx][0]),
        y: analysisIndices.map(idx => this.projectedVectors[idx][1]),
        z: analysisIndices.map(idx => this.projectedVectors[idx][2]),
        text: analysisIndices.map(idx => this.labels[idx]),
        hoverinfo: 'text',
        marker: {
          size: 4,
          color: 'rgba(142, 68, 173, 0.8)',
          opacity: 0.8,
          line: {
            color: 'white',
            width: 0.5
          }
        },
        name: 'Analysis 이미지',
        customdata: analysisIndices,
        showlegend: false
      };
      
      // 표준화된 레이아웃 설정 (범례 제거)
      const layout = {
        margin: { l: 0, r: 0, b: 0, t: 0 },
        scene: {
          xaxis: { title: '' },
          yaxis: { title: '' },
          zaxis: { title: '' },
          aspectratio: { x: 1, y: 1, z: 1 },
          camera: {
            eye: { x: 1.5, y: 1.5, z: 1.5 }
          }
        },
        showlegend: false,
        hovermode: 'closest',
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        autosize: true,
        width: container.clientWidth,
        height: container.clientHeight
      };
      
      const config = {
        responsive: true,
        displayModeBar: false
      };
      
      window.Plotly.newPlot(container, [iAppData, analysisData], layout, config)
        .then(() => {
          this.plot = container;
          
          container.on('plotly_click', (eventData) => {
            if (eventData && eventData.points && eventData.points.length > 0) {
              const point = eventData.points[0];
              const traceIndex = point.curveNumber;
              const pointIndex = point.pointIndex !== undefined ? point.pointIndex : point.pointNumber;
              
              console.log(`Plotly 클릭 이벤트: 트레이스 ${traceIndex}, 포인트 ${pointIndex}`);
              console.log('Point object:', point);
              
              // pointIndex가 여전히 undefined인 경우 처리 중단
              if (pointIndex === undefined || pointIndex === null) {
                console.error('Point index is undefined, cannot process click event');
                return;
              }
              
              // customdata에서 원본 인덱스 가져오기
              let originalIndex;
              if (point.customdata !== undefined) {
                originalIndex = point.customdata;
              } else {
                // fallback: 트레이스별로 인덱스 계산
                const tagGroups = this.getTagGroups();
                if (traceIndex === 0) {
                  // I-app 트레이스
                  const iAppIndices = tagGroups['I-app'] || [];
                  originalIndex = iAppIndices[pointIndex];
                } else if (traceIndex === 1) {
                  // Analysis 트레이스
                  const analysisIndices = tagGroups['Analysis'] || [];
                  originalIndex = analysisIndices[pointIndex];
                }
              }
              
              console.log(`클릭된 포인트의 원본 인덱스: ${originalIndex}`);
              
              if (originalIndex !== undefined && originalIndex >= 0 && originalIndex < this.labels.length) {
                // 중복 클릭 방지
                if (this.selectedIndex === originalIndex) {
                  console.log('Same image already selected, ignoring click');
                  return;
                }
                this.selectImageByIndex(originalIndex);
              } else {
                console.error('Cannot determine original index from clicked point');
              }
            }
          });
        })
        .catch(error => {
          console.error('Error updating plot with actual data:', error);
        });
    } catch (error) {
      console.error('Error creating visualization with actual data:', error);
    }
  },

  // 선택된 이미지 인덱스로 마커 스타일 업데이트
  updatePlotMarkers(selectedIndex) {
    const container = document.getElementById('plotly-visualization');
    if (!container) {
      console.error('Visualization container not found for marker update');
      return;
    }
    
    try {
      const tagGroups = this.getTagGroups();
      const iAppIndices = tagGroups['I-app'] || [];
      const analysisIndices = tagGroups['Analysis'] || [];
      
      const isIApp = iAppIndices.includes(selectedIndex);
      const isAnalysis = analysisIndices.includes(selectedIndex);
      
      if (!isIApp && !isAnalysis) {
        console.error(`선택된 인덱스(${selectedIndex})가 어느 그룹에도 속하지 않습니다`);
        return;
      }
      
      const selectedPoint = this.projectedVectors[selectedIndex];
      
      // 선택된 점 트레이스
      const selectedPointTrace = {
        type: 'scatter3d',
        mode: 'markers',
        x: [selectedPoint[0]],
        y: [selectedPoint[1]],
        z: [selectedPoint[2]],
        text: [this.labels[selectedIndex]],
        hoverinfo: 'text',
        marker: {
          size: 8,
          color: 'rgba(255, 0, 0, 1.0)',
          opacity: 1,
          line: {
            color: 'white',
            width: 2
          }
        },
        name: '선택된 이미지',
        customdata: [selectedIndex],
        showlegend: false
      };
      
      // 가장 가까운 점들 찾기 (각 태그별로 3개씩)
      const iAppDistances = [];
      const analysisDistances = [];
      
      for (let i = 0; i < this.projectedVectors.length; i++) {
        if (i === selectedIndex) continue;
        
        const distance = this.calculate3DDistance(selectedPoint, this.projectedVectors[i]);
        const isCurrentIApp = iAppIndices.includes(i);
        
        if (isCurrentIApp) {
          iAppDistances.push({ index: i, distance });
        } else {
          analysisDistances.push({ index: i, distance });
        }
      }
      
      // 거리순 정렬 후 상위 3개씩 선택
      iAppDistances.sort((a, b) => a.distance - b.distance);
      analysisDistances.sort((a, b) => a.distance - b.distance);
      
      const topIApp = iAppDistances.slice(0, 3);
      const topAnalysis = analysisDistances.slice(0, 3);
      
      // 유사 이미지들을 MSA3에 전송
      const similarImages = [...topIApp, ...topAnalysis].map(p => ({
        filename: this.labels[p.index],
        index: p.index,
        url: this.getImageUrl(this.labels[p.index]),
        distance: p.distance,
        similarity: (1 - Math.min(p.distance, 1)) * 100,
        tag_type: topIApp.includes(p) ? 'I-app' : 'Analysis'
      }));
      
      // MSA3에 유사 이미지들을 배열로 한 번에 전송
      if (similarImages.length > 0) {
        const msa3SimilarEvent = new CustomEvent('msa2-to-msa3-similar-images', {
          detail: similarImages
        });
        document.dispatchEvent(msa3SimilarEvent);
        console.log(`[MSA2] 유사 이미지 ${similarImages.length}개가 MSA3로 전송됨:`, similarImages.map(img => img.filename));
      }
      
      // 유사 점들 트레이스 (I-app)
      const similarIAppTrace = {
        type: 'scatter3d',
        mode: 'markers',
        x: topIApp.map(p => this.projectedVectors[p.index][0]),
        y: topIApp.map(p => this.projectedVectors[p.index][1]),
        z: topIApp.map(p => this.projectedVectors[p.index][2]),
        text: topIApp.map(p => `${this.labels[p.index]} (거리: ${p.distance.toFixed(3)})`),
        hoverinfo: 'text',
        marker: {
          size: 6,
          color: 'rgba(46, 204, 113, 1.0)',
          opacity: 1,
          line: {
            color: 'white',
            width: 1
          }
        },
        name: '유사 I-app 이미지',
        customdata: topIApp.map(p => p.index),
        showlegend: false
      };
      
      // 유사 점들 트레이스 (Analysis)
      const similarAnalysisTrace = {
        type: 'scatter3d',
        mode: 'markers',
        x: topAnalysis.map(p => this.projectedVectors[p.index][0]),
        y: topAnalysis.map(p => this.projectedVectors[p.index][1]),
        z: topAnalysis.map(p => this.projectedVectors[p.index][2]),
        text: topAnalysis.map(p => `${this.labels[p.index]} (거리: ${p.distance.toFixed(3)})`),
        hoverinfo: 'text',
        marker: {
          size: 6,
          color: 'rgba(142, 68, 173, 1.0)',
          opacity: 1,
          line: {
            color: 'white',
            width: 1
          }
        },
        name: '유사 Analysis 이미지',
        customdata: topAnalysis.map(p => p.index),
        showlegend: false
      };
      
      // 선 연결 트레이스들
      const lineTraces = [];
      
      // I-app 점들과 선택된 점 연결
      topIApp.forEach(p => {
        lineTraces.push({
          type: 'scatter3d',
          mode: 'lines',
          x: [selectedPoint[0], this.projectedVectors[p.index][0]],
          y: [selectedPoint[1], this.projectedVectors[p.index][1]],
          z: [selectedPoint[2], this.projectedVectors[p.index][2]],
          line: {
            color: 'rgba(46, 204, 113, 0.6)',
            width: 4
          },
          hoverinfo: 'none',
          showlegend: false
        });
      });
      
      // Analysis 점들과 선택된 점 연결
      topAnalysis.forEach(p => {
        lineTraces.push({
          type: 'scatter3d',
          mode: 'lines',
          x: [selectedPoint[0], this.projectedVectors[p.index][0]],
          y: [selectedPoint[1], this.projectedVectors[p.index][1]],
          z: [selectedPoint[2], this.projectedVectors[p.index][2]],
          line: {
            color: 'rgba(142, 68, 173, 0.6)',
            width: 4
          },
          hoverinfo: 'none',
          showlegend: false
        });
      });
      
      if (container.data && container.data.length >= 2) {
        // 기존 추가 트레이스들 제거 (원본 I-app, Analysis 트레이스는 유지)
        if (container.data.length > 2) {
          const tracesToDelete = Array.from(
            { length: container.data.length - 2 },
            (_, i) => i + 2
          );
          window.Plotly.deleteTraces(container, tracesToDelete);
        }
        
        // 새 트레이스들 추가 (범례 없이 간단하게)
        const newTraces = [selectedPointTrace];
        if (topIApp.length > 0) newTraces.push(similarIAppTrace);
        if (topAnalysis.length > 0) newTraces.push(similarAnalysisTrace);
        newTraces.push(...lineTraces);
        
        window.Plotly.addTraces(container, newTraces);
        
        // 범례가 없으므로 레이아웃 복원 불필요
      }
    } catch (error) {
      console.error('Error updating plot markers:', error);
    }
  },

  // 3D 그래프 점 클릭 이벤트 처리기
  handlePointClick(data) {
    try {
      const point = data.points[0];
      if (!point) {
        return;
      }
      
      const pointIndex = point.pointIndex;
      const pointNumber = point.pointNumber;
      const curveNumber = point.curveNumber;
      
      this.selectImageByIndex(pointIndex);
      this.updatePlotMarkers(pointIndex);
    } catch (error) {
      console.error('Error handling point click:', error);
    }
  },

  // 이벤트 리스너 초기화
  initPlotEventListeners(container) {
    try {
      container.on('plotly_click', (data) => {
        if (!data || !data.points || data.points.length === 0) return;
        
        try {
          const point = data.points[0];
          const pointIndex = point.pointIndex;
          const curveNumber = point.curveNumber;
          
          console.log(`Plotly 점 클릭 이벤트: 트레이스 ${curveNumber}, 포인트 ${pointIndex}`);
          
          let actualIndex;
          if (point.customdata !== undefined) {
            actualIndex = point.customdata;
          } else {
            const tagGroups = this.getTagGroups();
            const groupKey = curveNumber === 0 ? 'I-app' : 'Analysis';
            actualIndex = tagGroups[groupKey][pointIndex];
          }
          
          console.log(`클릭된 포인트의 실제 인덱스: ${actualIndex}`);
          
          if (actualIndex !== undefined && actualIndex >= 0) {
            this.selectImageByIndex(actualIndex);
          }
        } catch (error) {
          console.error('점 클릭 이벤트 처리 오류:', error);
        }
      });
      
      container.on('plotly_doubleclick', () => {
        console.log('그래프 더블클릭: 원래 뷰로 재설정합니다.');
      });
      
      console.log('Plotly 이벤트 리스너 등록 완료');
    } catch (error) {
      console.error('이벤트 리스너 초기화 오류:', error);
    }
  }
} 