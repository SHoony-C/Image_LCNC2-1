import LogService from './logService';

export const measurementHandlers = {
  calculateValue(start, end) {
    if (!start || !end) return 0;
    const img = this.$refs.sourceImage;
    const canvas = this.$refs.canvas;
    
    // 캔버스 좌표를 원본 이미지 좌표로 변환
    const startX = (start.x / canvas.width) * img.naturalWidth;
    const startY = (start.y / canvas.height) * img.naturalHeight;
    const endX = (end.x / canvas.width) * img.naturalWidth;
    const endY = (end.y / canvas.height) * img.naturalHeight;
    
    // 원본 이미지 좌표에서의 거리 계산
    const dx = endX - startX;
    const dy = endY - startY;
    
    // 피타고라스 정리로 거리 계산
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    let value;
    
    if (this.scaleMethod === 'scaleBar' && this.scaleBarDetected && this.scaleBarMeasurement) {
      // 스케일바 기반 측정
      const scaleBarPixelLength = this.scaleBarMeasurement.pixelLength;
      let scaleBarRealLength = this.scaleBarValue;
      
      // 단위 변환 (μm -> nm)
      if (this.scaleBarUnit === 'μm') {
        scaleBarRealLength *= 1000; // 1μm = 1000nm
      }
      
      // 픽셀 거리에 스케일 적용
      value = (distance / scaleBarPixelLength) * scaleBarRealLength;
      
      console.log(`[calculateValue] 스케일바 기반 계산: 
        거리=${distance.toFixed(4)} 픽셀,
        스케일바=${scaleBarPixelLength.toFixed(2)} 픽셀 = ${this.scaleBarValue} ${this.scaleBarUnit},
        비율=${(scaleBarRealLength / scaleBarPixelLength).toFixed(4)} ${this.scaleBarUnit === 'μm' ? 'nm' : this.scaleBarUnit}/픽셀,
        최종값=${value.toFixed(2)} nm`);
    } else {
      // 배율 기반 측정 (기존 코드)
      value = distance * this.magnification;
      
      console.log(`[calculateValue] 배율 기반 계산: 
      시작점=(${startX.toFixed(2)}, ${startY.toFixed(2)}), 
      끝점=(${endX.toFixed(2)}, ${endY.toFixed(2)}), 
      dx=${dx.toFixed(2)}, dy=${dy.toFixed(2)}, 
      거리=${distance.toFixed(4)},
      배율=${this.magnification}, 
      최종값=${value.toFixed(2)}`);
    }
    
    // 결과값을 그대로 반환 (반올림하지 않음)
    return value;
  },

  startMeasurement(e) {
    if (!this.$refs.canvas) {
      console.warn('[startMeasurement] Canvas element not found');
      return;
    }

    if (this.isDeleteMode) {
      try {
        const pos = this.getLocalPos(e);
        if (!pos) return;
        this.deleteStart = pos;
        this.deleteEnd = null;
        this.isMeasuring = true;
        this.render();
      } catch (error) {
        console.error('[startMeasurement] Error in delete mode:', error);
      }
      return;
    }

    const pos = this.getLocalPos(e);
    if (!pos) return;

    if (this.isAreaSelectionMode) {
      this.areaSelectionStart = pos;
      this.areaSelectionEnd = null;
      this.isMeasuring = true;
      this.render();
      return;
    }

    // d키가 눌린 상태에서 클릭한 경우
    if (this.isDKeyPressed) {
      this.tempDragLine = {
        start: {...pos},
        end: {...pos}
      };
      this.render();
      return;
    }

    // 수동 스케일바 그리기 모드인 경우
    if (this.isDrawingScaleBar) {
      this.currentMeasurement = {
        start: {...pos},
        end: {...pos},
        isScaleBar: true
      };
      this.isMeasuring = true;
      this.render();
      return;
    }

    this.isMeasuring = true;

    // 기존 측정 시작 로직
    if (this.measurementMode === 'line' || this.measurementMode === 'reference') {
      this.currentMeasurement = {
        start: {...pos},
        end: {...pos}
      };
    } else if (this.measurementMode === 'circle' || this.measurementMode.startsWith('area')) {
      this.areaStart = {...pos};
      this.areaEnd = {...pos};
    }
    
    this.render();
  },

  updateMeasurement(e) {
    if (!this.$refs.canvas) {
      console.warn('[updateMeasurement] Canvas element not found');
      return;
    }

    if (this.isDeleteMode) {
      // 삭제 모드에서는 isMeasuring이 true이고 시작점이 있을 때만 업데이트
      if (!this.isMeasuring || !this.deleteStart) {
        return;
      }
      try {
        const pos = this.getLocalPos(e);
        if (!pos) return;
        this.deleteEnd = pos;
        this.render();
      } catch (error) {
        console.error('[updateMeasurement] Error in delete mode:', error);
      }
      return;
    }

    if (!this.isMeasuring) return;

    const pos = this.getLocalPos(e);
    if (!pos) return;

    if (this.isAreaSelectionMode) {
      this.areaSelectionEnd = pos;
      this.render();
      return;
    }

    // d키가 눌린 상태에서 드래그 중인 경우
    if (this.isDKeyPressed && this.tempDragLine) {
      this.tempDragLine.end = {...pos};
      this.render();
      return;
    }

    // 수동 스케일바 그리기 모드인 경우
    if (this.isDrawingScaleBar && this.currentMeasurement) {
      this.currentMeasurement.end = {...pos};
      this.render();
      return;
    }

    // 기존 측정 업데이트 로직
    if ((this.measurementMode === 'line' || this.measurementMode === 'reference') && this.currentMeasurement) {
      this.currentMeasurement.end = {...pos};
    } else if (this.measurementMode === 'circle' || this.measurementMode.startsWith('area')) {
      this.areaEnd = {...pos};
    }
    
    this.render();
  },

  endMeasurement(e) {
    if (!this.$refs.canvas) {
      console.warn('[endMeasurement] Canvas element not found');
      return;
    }

    if (this.isDeleteMode) {
      try {
        if (this.isMeasuring && this.deleteStart && this.deleteEnd) {
          this.deleteMeasurementsInPath();
        }
      } catch (error) {
        console.error('[endMeasurement] Error in delete mode:', error);
      } finally {
        // 삭제 모드의 모든 상태 초기화
        this.deleteStart = null;
        this.deleteEnd = null;
        this.isMeasuring = false;
        this.render();
      }
      return;
    }

    if (!this.isMeasuring) return;

    if (this.isAreaSelectionMode) {
      if (this.areaSelectionStart && this.areaSelectionEnd) {
        // 영역 선택 처리
        const width = Math.abs(this.areaSelectionEnd.x - this.areaSelectionStart.x);
        const height = Math.abs(this.areaSelectionEnd.y - this.areaSelectionStart.y);
        
        if (width > 10 && height > 10) {
          this.selectedAreaRect = {
            start: { ...this.areaSelectionStart },
            end: { ...this.areaSelectionEnd }
          };
          console.log('Selected area rect set:', this.selectedAreaRect);
        }
      }
      this.areaSelectionStart = null;
      this.areaSelectionEnd = null;
      this.isMeasuring = false;
      this.render();
      return;
    }

    // d키가 눌린 상태에서 드래그가 끝난 경우
    if (this.isDKeyPressed && this.tempDragLine) {
      this.handleDragEnd();
      return;
    }

    // 수동 스케일바 그리기 모드인 경우
    if (this.isDrawingScaleBar && this.currentMeasurement) {
      const distance = Math.sqrt(
        Math.pow(this.currentMeasurement.end.x - this.currentMeasurement.start.x, 2) +
        Math.pow(this.currentMeasurement.end.y - this.currentMeasurement.start.y, 2)
      );
      
      // 최소 길이 체크
      if (distance > 10) {
        // 그린 선을 스케일바로 설정
        this.manualScaleBar = { ...this.currentMeasurement };
        
        // 중요: 수동 스케일바 설정 플래그를 즉시 true로 설정
        this.manualScaleBarSet = true;
        console.log('[endMeasurement] 수동 스케일바 설정 완료, manualScaleBarSet을 true로 설정');
        
        // 캔버스 좌표를 이미지 좌표로 변환
        const img = this.$refs.sourceImage;
        const canvas = this.$refs.canvas;
        
        const startX = (this.manualScaleBar.start.x / canvas.width) * img.naturalWidth;
        const startY = (this.manualScaleBar.start.y / canvas.height) * img.naturalHeight;
        const endX = (this.manualScaleBar.end.x / canvas.width) * img.naturalWidth;
        const endY = (this.manualScaleBar.end.y / canvas.height) * img.naturalHeight;
        
        // 스케일바 픽셀 길이 계산
        const pixelLength = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        
        // 스케일바 측정값 저장
        this.scaleBarMeasurement = {
          start: this.manualScaleBar.start,
          end: this.manualScaleBar.end,
          pixelLength: pixelLength,
          unit: this.scaleBarUnit
        };
        
        console.log(`[endMeasurement] 스케일바 측정값 저장:`, JSON.stringify(this.scaleBarMeasurement));
        console.log(`[endMeasurement] 스케일바 픽셀 길이: ${pixelLength}, 단위: ${this.scaleBarUnit}`);
        
        // 스케일바 감지 상태 업데이트
        this.scaleBarDetected = true;
        
        // 현재 상태 저장
        this.saveScaleBarSettings();
        
        // 스케일바 값 입력 다이얼로그 표시
        this.showScaleBarValueDialog();
        
        // 수동 스케일바 설정 완료 후 바로 측정 모드로 전환
        // isDrawingScaleBar 플래그를 false로 변경하여 다음 드래그는 측정으로 처리되게 함
        this.isDrawingScaleBar = false;
        this.measurementMode = 'line';
        
        // 로그 기록 추가
        console.log(`[endMeasurement] 수동 스케일바 설정 완료, 픽셀 길이: ${pixelLength}, 자동으로 선 측정 모드로 전환`);
        
        // 상태 변경 알림 표시
        this.showNotification('수동 스케일바 설정 완료. 선 측정 모드로 전환되었습니다.', 'info');
      }
      
      this.currentMeasurement = null;
      this.isMeasuring = false;
      this.render();
      return;
    }

    // 기존 측정 종료 로직
    if ((this.measurementMode === 'line' || this.measurementMode === 'reference') && this.currentMeasurement) {
      const width = Math.abs(this.currentMeasurement.end.x - this.currentMeasurement.start.x);
      const height = Math.abs(this.currentMeasurement.end.y - this.currentMeasurement.start.y);
      
      if (width > 10 || height > 10) {
        const measurement = {
          ...this.currentMeasurement,
          itemId: this.nextId.toString(),
          subItemId: `${this.nextId}-${this.subItemPrefix}1`,
          isReference: this.measurementMode === 'reference',
          color: this.referenceLineColor,
          value: this.calculateValue(this.currentMeasurement.start, this.currentMeasurement.end)
        };
        
        if (this.measurementMode === 'reference') {
          this.referenceLines.push(measurement);
          this.activeReferenceLine = measurement;
        } else {
          this.measurements.push(measurement);
          this.segmentedMeasurements.push(measurement);
        }
        this.nextId++;
      }
    } else if (this.areaStart && this.areaEnd) {
      const width = Math.abs(this.areaEnd.x - this.areaStart.x);
      const height = Math.abs(this.areaEnd.y - this.areaStart.y);
      
      if (width > 10 && height > 10) {
        this.selectedArea = {
          start: { ...this.areaStart },
          end: { ...this.areaEnd }
        };
        
        if (this.measurementMode === 'defect') {
          console.log('Defect mode - Setting selectedAreaRect');
          this.selectedAreaRect = {
            start: { ...this.areaStart },
            end: { ...this.areaEnd }
          };
          console.log('selectedAreaRect after setting:', this.selectedAreaRect);
        } else if (this.measurementMode === 'circle') {
          const measurement = {
            start: { ...this.areaStart },
            end: { ...this.areaEnd },
            itemId: this.nextId.toString(),
            subItemId: `${this.nextId}-${this.subItemPrefix}1`,
            value: Math.max(width, height),
            brightness: this.calculateAverageBrightness(this.areaStart, this.areaEnd),
            isStriated: this.circleOptions.striation,
            isDistorted: this.circleOptions.distortion,
            isBright: this.calculateBrightness(
              (this.areaStart.x + this.areaEnd.x) / 2,
              (this.areaStart.y + this.areaEnd.y) / 2
            ) > this.brightnessThreshold
          };
          this.measurements.push(measurement);
          this.segmentedMeasurements.push(measurement);
          this.nextId++;
        } else if (this.measurementMode.startsWith('area')) {
          console.log(`[endMeasurement] 영역 측정 완료, 영역 측정 생성 시작 - 모드: ${this.measurementMode}, 기준선 있음: ${!!this.activeReferenceLine}`);
          this.createAreaMeasurements();
        }
      }
    }
    
    // 모든 상태 초기화
    this.currentMeasurement = null;
    this.areaStart = null;
    this.areaEnd = null;
    this.isMeasuring = false;
    this.render();
  },

  calculateBrightness(x, y) {
    if (!this.imageData) return 128;
    
    const canvas = this.$refs.canvas;
    const img = this.$refs.sourceImage;
    
    // 캔버스 좌표를 원본 이미지 좌표로 변환
    const imageX = Math.floor((x / canvas.width) * img.naturalWidth);
    const imageY = Math.floor((y / canvas.height) * img.naturalHeight);
    
    // 주변 픽셀을 포함한 밝기 계산 (3x3 영역)
    let totalBrightness = 0;
    let pixelCount = 0;
    
    for (let offsetY = -1; offsetY <= 1; offsetY++) {
      for (let offsetX = -1; offsetX <= 1; offsetX++) {
        const sampleX = imageX + offsetX;
        const sampleY = imageY + offsetY;
        
        if (sampleX >= 0 && sampleX < img.naturalWidth && 
            sampleY >= 0 && sampleY < img.naturalHeight) {
          const index = (sampleY * img.naturalWidth + sampleX) * 4;
          if (index >= 0 && index < this.imageData.data.length) {
            // 흑백 이미지의 경우 R 채널만 사용
            totalBrightness += this.imageData.data[index];
            pixelCount++;
          }
        }
      }
    }
    
    return pixelCount > 0 ? Math.round(totalBrightness / pixelCount) : 128;
  },

  calculateAverageBrightness(start, end) {
    if (!start || !end) return 0;
    const samples = 3000; // 샘플링 포인트 수 증가
    let totalBrightness = 0;
    let validSamples = 0;
    
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const x = start.x + (end.x - start.x) * t;
      const y = start.y + (end.y - start.y) * t;
      const brightness = this.calculateBrightness(x, y);
      if (brightness !== 128) { // 유효한 픽셀만 계산에 포함
        totalBrightness += brightness;
        validSamples++;
      }
    }
    
    return validSamples > 0 ? totalBrightness / validSamples : 0;
  },

  updateAllMeasurements() {
    // 모든 측정값 업데이트
    this.measurements.forEach(measurement => {
      measurement.value = this.calculateValue(measurement.start, measurement.end);
    });
    
    this.segmentedMeasurements.forEach(segment => {
      segment.value = this.calculateValue(segment.start, segment.end);
    });
    
    this.render();
  },

  resetMeasurements() {
    console.log('[resetMeasurements] 모든 측정 결과 초기화');
    
    // 모든 측정 데이터 초기화
    this.measurements = [];
    this.segmentedMeasurements = [];
    this.defectMeasurements = [];
    this.referenceLines = [];
    this.activeReferenceLine = null;
    this.selectedRows = [];
    this.selectedDefects = [];
    this.selectedAreaRect = null;
    this.manualScaleBar = null;
    this.scaleBarMeasurement = null;
    
    // ID 카운터 초기화
    this.nextId = 1;
    this.brightSubIdCounter = 1;
    this.darkSubIdCounter = 1;
    
    // 히스토리 초기화
    this.undoHistory = [];
    this.redoHistory = [];
    
    // 캔버스 다시 그리기
    this.render();
    
    // 알림 표시
    this.showNotification('모든 측정 결과가 초기화되었습니다.', 'info');
    
    // 로그 저장
    LogService.logAction('reset_measurements', {
      timestamp: new Date().toISOString()
    });
  },

  setMode(mode) {
    console.log(`[setMode] 측정 모드 변경: ${this.measurementMode} -> ${mode}`);
    
    // 이전 모드 정리
    this.isDeleteMode = false;
    this.isDrawingScaleBar = false;
    this.isAreaSelectionMode = false;
    
    // 새 모드 설정
    this.measurementMode = mode;
    
    // 모드별 특별 처리
    if (mode === 'defect') {
      this.isAreaSelectionMode = true;
    }
    
    // 현재 측정 중인 작업 취소
    this.currentMeasurement = null;
    this.areaStart = null;
    this.areaEnd = null;
    this.isMeasuring = false;
    
    this.render();
    
    // 로그 저장
    LogService.logAction('change_measurement_mode', {
      mode: mode
    });
  },

  toggleDeleteMode() {
    this.isDeleteMode = !this.isDeleteMode;
    console.log(`[toggleDeleteMode] 삭제 모드: ${this.isDeleteMode ? '활성화' : '비활성화'}`);
    
    if (!this.isDeleteMode) {
      // 삭제 모드 비활성화 시 상태 초기화
      this.deleteStart = null;
      this.deleteEnd = null;
      this.isMeasuring = false;
    }
    
    this.render();
  },

  toggleReverse() {
    this.isReversed = !this.isReversed;
    console.log(`[toggleReverse] 밝기 반전: ${this.isReversed ? '어두운 영역' : '밝은 영역'}`);
    this.render();
  },

  increaseLineCount() {
    if (this.lineCount < 20) {
      this.lineCount++;
      console.log(`[increaseLineCount] 선 개수 증가: ${this.lineCount}`);
    }
  },

  decreaseLineCount() {
    if (this.lineCount > 2) {
      this.lineCount--;
      console.log(`[decreaseLineCount] 선 개수 감소: ${this.lineCount}`);
    }
  },

  // 영역 측정 생성 함수
  createAreaMeasurements() {
    console.log('[createAreaMeasurements] 영역 측정 생성 시작');
    
    if (!this.areaStart || !this.areaEnd) {
      console.warn('[createAreaMeasurements] 영역이 선택되지 않음');
      return;
    }

    const isVertical = this.measurementMode === 'area-vertical';
    const lineCount = this.lineCount;
    
    // 영역 크기 계산
    const width = Math.abs(this.areaEnd.x - this.areaStart.x);
    const height = Math.abs(this.areaEnd.y - this.areaStart.y);
    
    // 선 간격 계산
    const spacing = isVertical ? width / (lineCount - 1) : height / (lineCount - 1);
    
    console.log(`[createAreaMeasurements] ${isVertical ? '세로' : '가로'} 방향, 선 개수: ${lineCount}, 간격: ${spacing.toFixed(2)}`);
    
    // 기준선이 있는 경우 기준선 기반으로 측정
    if (this.activeReferenceLine) {
      console.log('[createAreaMeasurements] 기준선 기반 측정');
      this.createReferenceBasedMeasurements(isVertical, lineCount, spacing);
    } else {
      console.log('[createAreaMeasurements] 일반 영역 측정');
      this.createRegularAreaMeasurements(isVertical, lineCount, spacing);
    }
  },

  // 기준선 기반 측정 생성
  createReferenceBasedMeasurements(isVertical, lineCount, spacing) {
    // 기준선 기반 측정 로직
    console.log('[createReferenceBasedMeasurements] 기준선 기반 측정 생성');
  },

  // 일반 영역 측정 생성
  createRegularAreaMeasurements(isVertical, lineCount, spacing) {
    // 일반 영역 측정 로직
    console.log('[createRegularAreaMeasurements] 일반 영역 측정 생성');
    
    for (let i = 0; i < lineCount; i++) {
      let start, end;
      
      if (isVertical) {
        // 세로 방향 선들
        const x = this.areaStart.x + (spacing * i);
        start = { x: x, y: this.areaStart.y };
        end = { x: x, y: this.areaEnd.y };
      } else {
        // 가로 방향 선들
        const y = this.areaStart.y + (spacing * i);
        start = { x: this.areaStart.x, y: y };
        end = { x: this.areaEnd.x, y: y };
      }
      
      const measurement = {
        start: start,
        end: end,
        itemId: this.nextId.toString(),
        subItemId: `${this.nextId}-${this.subItemPrefix}${i + 1}`,
        value: this.calculateValue(start, end)
      };
      
      this.measurements.push(measurement);
      this.segmentedMeasurements.push(measurement);
    }
    
    this.nextId++;
    console.log(`[createRegularAreaMeasurements] ${lineCount}개의 측정선 생성 완료`);
  },

  // 경로 내 측정값 삭제
  deleteMeasurementsInPath() {
    if (!this.deleteStart || !this.deleteEnd) return;
    
    console.log('[deleteMeasurementsInPath] 경로 내 측정값 삭제 시작');
    
    const toDelete = [];
    
    // 모든 측정값을 확인하여 삭제 경로와 교차하는지 검사
    this.measurements.forEach((measurement, index) => {
      if (this.isLineIntersectingPath(measurement.start, measurement.end)) {
        toDelete.push(index);
      }
    });
    
    // 역순으로 삭제 (인덱스 변경 방지)
    toDelete.reverse().forEach(index => {
      this.measurements.splice(index, 1);
    });
    
    // segmentedMeasurements에서도 삭제
    const segmentedToDelete = [];
    this.segmentedMeasurements.forEach((segment, index) => {
      if (this.isLineIntersectingPath(segment.start, segment.end)) {
        segmentedToDelete.push(index);
      }
    });
    
    segmentedToDelete.reverse().forEach(index => {
      this.segmentedMeasurements.splice(index, 1);
    });
    
    console.log(`[deleteMeasurementsInPath] ${toDelete.length}개의 측정값 삭제 완료`);
  },

  // 선이 삭제 경로와 교차하는지 확인
  isLineIntersectingPath(lineStart, lineEnd) {
    // 간단한 교차 검사 - 실제로는 더 정교한 알고리즘 필요
    const pathRect = {
      left: Math.min(this.deleteStart.x, this.deleteEnd.x),
      right: Math.max(this.deleteStart.x, this.deleteEnd.x),
      top: Math.min(this.deleteStart.y, this.deleteEnd.y),
      bottom: Math.max(this.deleteStart.y, this.deleteEnd.y)
    };
    
    // 선의 시작점이나 끝점이 삭제 영역 내에 있는지 확인
    const startInPath = (lineStart.x >= pathRect.left && lineStart.x <= pathRect.right &&
                        lineStart.y >= pathRect.top && lineStart.y <= pathRect.bottom);
    const endInPath = (lineEnd.x >= pathRect.left && lineEnd.x <= pathRect.right &&
                      lineEnd.y >= pathRect.top && lineEnd.y <= pathRect.bottom);
    
    return startInPath || endInPath;
  }
} 