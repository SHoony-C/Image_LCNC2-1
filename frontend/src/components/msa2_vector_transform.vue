// 데이터 로드 후 시각화 업데이트
updateData() {
  //console.log('Updating visualization with loaded data');
  
  // 시각화 컨테이너 요소 선택
  const container = document.getElementById('plotly-visualization');
  if (!container) {
    //console.log('Visualization container not found');
    return;
  }
  
  // 실제 벡터 데이터가 있는지 확인
  if (!this.projectedVectors || this.projectedVectors.length === 0) {
    //console.log('No projected vectors available for visualization');
    return;
  }
  
  // 태그 기반 그룹 분류
  const tagGroups = this.getTagGroups();
  
  try {
    // I-app 그룹 데이터
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
        color: 'rgba(46, 204, 113, 0.8)',  // 녹색
        opacity: 0.8,
        line: {
          color: 'white',
          width: 0.5
        }
      },
      name: 'I-app 이미지',
      customdata: iAppIndices,  // 원래 인덱스 저장
      showlegend: true
    };
    
    // Analysis 그룹 데이터
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
        color: 'rgba(142, 68, 173, 0.8)',  // 보라색
        opacity: 0.8,
        line: {
          color: 'white',
          width: 0.5
        }
      },
      name: 'Analysis 이미지',
      customdata: analysisIndices,  // 원래 인덱스 저장
      showlegend: true
    };
    
    //console.log('Rendering plot with data:', {
      iAppCount: iAppIndices.length,
      analysisCount: analysisIndices.length
    });
    
    // 그래프 레이아웃 설정
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
      showlegend: true,
      legend: {
        x: 1,
        y: 0.5
      },
      hovermode: 'closest',
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      autosize: true,
      width: container.clientWidth,
      height: container.clientHeight
    };
    
    // Plotly 옵션 설정
    const config = {
      responsive: true,
      displayModeBar: false
    };
    
    // 그래프 업데이트
    window.Plotly.newPlot(container, [iAppData, analysisData], layout, config)
      .then(() => {
        //console.log('Plot created with actual data successfully');
        // 플롯 참조 저장
        this.plot = container;
        
        // 점 클릭 이벤트 리스너 등록
        container.on('plotly_click', (eventData) => {
          //console.log('Plot click event detected:', eventData);
          if (eventData && eventData.points && eventData.points.length > 0) {
            const point = eventData.points[0];
            //console.log('Clicked point details:', point);
            
            // 클릭한 트레이스의 인덱스와 포인트 인덱스 확인
            const traceIndex = point.curveNumber;
            const pointIndex = point.pointIndex;
            
            // 각 트레이스에 저장한 원본 인덱스 접근
            const traceData = eventData.points[0].data;
            if (traceData && traceData.customdata && traceData.customdata[pointIndex] !== undefined) {
              const originalIndex = traceData.customdata[pointIndex];
              //console.log(`원본 인덱스: ${originalIndex}, 라벨: ${this.labels[originalIndex]}`);
              
              // 기존 selectImageByIndex 함수 호출
              this.selectImageByIndex(originalIndex);
              
              // 그래프 스타일 업데이트 (중복 호출 제거 - selectImageByIndex 내에서 이미 호출됨)
              // this.updatePlotMarkers(originalIndex);
            } else {
              console.error('Cannot determine original index from clicked point');
            }
          }
        });
        
        //console.log('Click event listener registered on plot');
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
  // 컨테이너 요소 선택
  const container = document.getElementById('plotly-visualization');
  if (!container) {
    console.error('Visualization container not found for marker update');
    return;
  }
  
  try {
    //console.log(`Vector Transform: 마커 스타일 업데이트 (선택된 인덱스: ${selectedIndex})`);
    
    // 태그 그룹 정보
    const tagGroups = this.getTagGroups();
    const iAppIndices = tagGroups['I-app'] || [];
    const analysisIndices = tagGroups['Analysis'] || [];
    
    // 선택된 점의 그룹 확인
    const isIApp = iAppIndices.includes(selectedIndex);
    const isAnalysis = analysisIndices.includes(selectedIndex);
    
    if (!isIApp && !isAnalysis) {
      console.error(`선택된 인덱스(${selectedIndex})가 어느 그룹에도 속하지 않습니다`);
      return;
    }
    
    // 선택된 점의 좌표
    const selectedPoint = this.projectedVectors[selectedIndex];
    
    // 새 트레이스 정의 - 선택된 점
    const selectedPointTrace = {
      type: 'scatter3d',
      mode: 'markers',
      x: [selectedPoint[0]],
      y: [selectedPoint[1]],
      z: [selectedPoint[2]],
      text: [this.labels[selectedIndex]],
      hoverinfo: 'text',
      marker: {
        size: 12,
        color: 'rgba(255, 0, 0, 1.0)', // 빨간색
        opacity: 1,
        line: {
          color: 'white',
          width: 2
        }
      },
      name: '선택된 이미지',
      showlegend: true
    };
    
    // 기존 데이터 유지하면서 새 트레이스 추가
    if (container.data && container.data.length >= 2) {
      // 기존에 추가된 트레이스가 있으면 제거
      if (container.data.length > 2) {
        const tracesToDelete = Array.from(
          { length: container.data.length - 2 },
          (_, i) => i + 2
        );
        //console.log(`기존 추가 트레이스 ${tracesToDelete.length}개 제거`);
        window.Plotly.deleteTraces(container, tracesToDelete);
      }
      
      // 새 트레이스 추가
      window.Plotly.addTraces(container, [selectedPointTrace]);
      //console.log('선택된 점 트레이스 추가 완료');
      
      // 카메라 위치 조정 (선택된 점 중심으로)
      window.Plotly.relayout(container, {
        'scene.camera.center': {
          x: selectedPoint[0],
          y: selectedPoint[1],
          z: selectedPoint[2]
        }
      });
    }
  } catch (error) {
    console.error('Error updating plot markers:', error);
  }
},

// 인덱스로 이미지 선택 및 관련 함수 호출
selectImageByIndex(index) {
  //console.log(`Vector Transform: 이미지 선택 (인덱스: ${index})`);
  if (index < 0 || index >= this.labels.length) {
    console.error(`Invalid image index: ${index}`);
    return;
  }
  
  // 선택된 이미지 정보 설정
  const selectedLabel = this.labels[index];
  //console.log(`선택된 이미지: ${selectedLabel}`);
  
  // 그래프 마커 스타일 업데이트
  this.updatePlotMarkers(index);
  
  // 이미지 선택 이벤트 발생 (MSA5로 전달)
  this.$emit('image-selected', {
    index: index,
    label: selectedLabel,
    filename: selectedLabel
  });
}