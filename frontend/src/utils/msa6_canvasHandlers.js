export const canvasHandlers = {
  updateCanvasSize() {
    console.log('[updateCanvasSize] 캔버스 크기 조정 시작');
    const container = this.$refs.container;
    if (!container) {
      console.error('[updateCanvasSize] 캔버스 컨테이너 참조 없음');
      return;
    }

    const img = this.$refs.sourceImage;
    const canvas = this.$refs.canvas;
    
    if (!canvas) {
      console.error('[updateCanvasSize] 캔버스 참조 없음');
      return;
    }
    
    // 이미지 요소의 크기 확인
    let imgWidth = img ? img.clientWidth : 0;
    let imgHeight = img ? img.clientHeight : 0;
    
    console.log(`[updateCanvasSize] 이미지 크기: ${imgWidth}x${imgHeight}, 컨테이너 크기: ${container.clientWidth}x${container.clientHeight}`);
    
    // 컨테이너 크기에 맞게 캔버스 크기 조정
    const canvasWidth = container.clientWidth;
    const canvasHeight = container.clientHeight;
    
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    // 캔버스를 컨테이너에 맞게 항상 꽉 채움 (마진 없이)
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.margin = '0';
    canvas.style.padding = '0';
    
    // 컨텍스트 재설정 및 이미지 다시 그리기
    this.ctx = canvas.getContext('2d');
    
    // 이미지가 있는 경우에만 그리기 - 이미지 유효성 검증 추가
    if (img && this.image && img.complete && this.image.complete && this.image.width > 0) {
      try {
        this.ctx.drawImage(this.image, 0, 0, canvas.width, canvas.height);
      } catch (error) {
        console.error('[updateCanvasSize] 이미지 그리기 실패:', error);
      }
    } else {
      console.warn('[updateCanvasSize] 유효한 이미지 없음, 이미지 그리기 건너뜀');
    }
    
    // 기존 측정값들의 좌표 조정
    this.adjustMeasurements(canvasWidth / this.prevWidth, canvasHeight / this.prevHeight);
    
    this.prevWidth = canvasWidth;
    this.prevHeight = canvasHeight;
    
    // 모든 측정 데이터 렌더링
    this.render();
    
    console.log('[updateCanvasSize] 캔버스 크기 조정 완료');
  },

  adjustMeasurements(scaleX, scaleY) {
    if (!isFinite(scaleX) || !isFinite(scaleY)) return;
    
    // 모든 측정값의 좌표 조정
    this.measurements.forEach(measurement => {
      measurement.start.x *= scaleX;
      measurement.start.y *= scaleY;
      measurement.end.x *= scaleX;
      measurement.end.y *= scaleY;
    });

    this.segmentedMeasurements.forEach(segment => {
      segment.start.x *= scaleX;
      segment.start.y *= scaleY;
      segment.end.x *= scaleX;
      segment.end.y *= scaleY;
    });
  },

  onWindowResize() {
    if (this.$refs.canvas) {
      this.updateCanvasSize();
    }
  },

  getLocalPos(e) {
    const canvas = this.$refs.canvas;
    if (!canvas) {
      console.warn('getLocalPos: Canvas reference is null');
      return { x: 0, y: 0 };
    }
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  },

  handleCanvasClick(e) {
    // 캔버스 클릭 이벤트 처리
    console.log('[handleCanvasClick] 캔버스 클릭');
    
    // 현재 측정 모드에 따라 처리
    if (this.measurementMode === 'defect') {
      // 불량 감지 모드에서는 클릭 위치에 원 그리기
      const pos = this.getLocalPos(e);
      this.addDefectMeasurement(pos);
    }
  },

  handleMouseMove(e) {
    // 마우스 이동 이벤트 처리
    const pos = this.getLocalPos(e);
    this.currentMousePos = pos;
    
    // F키가 눌린 상태에서 밝기 값 표시
    if (this.isFKeyPressed) {
      this.showBrightnessTooltip = true;
      this.currentBrightness = this.calculateBrightness(pos.x, pos.y);
      this.updateMagnifier(pos);
    } else {
      this.showBrightnessTooltip = false;
    }
  },

  updateMagnifier(pos) {
    // 돋보기 업데이트
    const magnifierCanvas = this.$refs.magnifierCanvas;
    if (!magnifierCanvas || !this.image) return;
    
    const ctx = magnifierCanvas.getContext('2d');
    const canvas = this.$refs.canvas;
    
    // 돋보기 캔버스 크기 설정
    magnifierCanvas.width = this.magnifierSize;
    magnifierCanvas.height = this.magnifierSize;
    
    // 원본 이미지에서 해당 위치의 픽셀 데이터 가져오기
    const img = this.$refs.sourceImage;
    const imageX = (pos.x / canvas.width) * img.naturalWidth;
    const imageY = (pos.y / canvas.height) * img.naturalHeight;
    
    // 돋보기 영역 크기 계산
    const sourceSize = this.magnifierSize / this.magnifierZoom;
    const sourceX = imageX - sourceSize / 2;
    const sourceY = imageY - sourceSize / 2;
    
    // 이미지를 돋보기 캔버스에 확대하여 그리기
    try {
      ctx.drawImage(
        this.image,
        sourceX, sourceY, sourceSize, sourceSize,
        0, 0, this.magnifierSize, this.magnifierSize
      );
    } catch (error) {
      console.error('[updateMagnifier] 돋보기 업데이트 실패:', error);
    }
  },

  render() {
    const canvas = this.$refs.canvas;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 캔버스 초기화
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 이미지 그리기
    if (this.image) {
      try {
        ctx.drawImage(this.image, 0, 0, canvas.width, canvas.height);
      } catch (error) {
        console.error('[render] 이미지 그리기 실패:', error);
        return;
      }
    }
    
    // 현재 측정 중인 선 그리기
    if (this.currentMeasurement) {
      this.drawLine(ctx, this.currentMeasurement.start, this.currentMeasurement.end, '#ff0000', 2);
    }
    
    // 영역 선택 그리기
    if (this.areaStart && this.areaEnd) {
      this.drawRectangle(ctx, this.areaStart, this.areaEnd, '#ff0000', 2);
    }
    
    // 영역 선택 모드 그리기
    if (this.areaSelectionStart && this.areaSelectionEnd) {
      this.drawRectangle(ctx, this.areaSelectionStart, this.areaSelectionEnd, '#00ff00', 2);
    }
    
    // 선택된 영역 그리기
    if (this.selectedAreaRect) {
      this.drawRectangle(ctx, this.selectedAreaRect.start, this.selectedAreaRect.end, '#0000ff', 3);
    }
    
    // 수동 스케일바 그리기
    if (this.manualScaleBar) {
      this.drawLine(ctx, this.manualScaleBar.start, this.manualScaleBar.end, '#ffff00', 3);
      this.drawText(ctx, 'Scale Bar', this.manualScaleBar.start.x, this.manualScaleBar.start.y - 10, '#ffff00');
    }
    
    // 기준선들 그리기
    this.referenceLines.forEach(line => {
      this.drawLine(ctx, line.start, line.end, line.color || this.referenceLineColor, 2);
    });
    
    // 모든 측정값 그리기
    this.measurements.forEach(measurement => {
      if (measurement.isReference) {
        this.drawLine(ctx, measurement.start, measurement.end, measurement.color || this.referenceLineColor, 2);
      } else {
        this.drawLine(ctx, measurement.start, measurement.end, '#00ff00', 1);
      }
    });
    
    // 세그먼트 측정값 그리기
    this.segmentedMeasurements.forEach(segment => {
      const color = segment.isBright ? '#00ff00' : '#ff0000';
      this.drawLine(ctx, segment.start, segment.end, color, 1);
      
      // 측정값 텍스트 표시
      const midX = (segment.start.x + segment.end.x) / 2;
      const midY = (segment.start.y + segment.end.y) / 2;
      this.drawText(ctx, segment.value?.toFixed(1) || '0', midX, midY - 10, color);
    });
    
    // 불량 측정값 그리기
    this.defectMeasurements.forEach(defect => {
      const color = defect.isBright ? '#ffff00' : '#ff00ff';
      this.drawCircle(ctx, defect.x, defect.y, 10, color, 2);
    });
    
    // 삭제 모드 드래그 선 그리기
    if (this.deleteStart && this.deleteEnd) {
      this.drawLine(ctx, this.deleteStart, this.deleteEnd, '#ff0000', 3, [5, 5]);
    }
    
    // 임시 드래그 선 그리기 (D키 누른 상태)
    if (this.tempDragLine) {
      this.drawLine(ctx, this.tempDragLine.start, this.tempDragLine.end, '#ff0000', 2, [3, 3]);
    }
  },

  drawLine(ctx, start, end, color = '#ff0000', width = 2, dash = null) {
    if (!start || !end) return;
    
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    
    if (dash) {
      ctx.setLineDash(dash);
    }
    
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    
    ctx.restore();
  },

  drawRectangle(ctx, start, end, color = '#ff0000', width = 2) {
    if (!start || !end) return;
    
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);
    
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  },

  drawCircle(ctx, x, y, radius, color = '#ff0000', width = 2) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.stroke();
    
    ctx.restore();
  },

  drawText(ctx, text, x, y, color = '#ffffff') {
    ctx.fillStyle = color;
    ctx.font = '12px Arial';
    ctx.fillText(text, x, y);
  },

  // 불량 측정 추가 함수
  addDefectMeasurement(pos) {
    console.log('[addDefectMeasurement] 불량 측정 추가:', pos);
    
    if (!pos) return;
    
    // 밝기 계산
    const brightness = this.calculateBrightness(pos.x, pos.y);
    const isBright = brightness > this.brightnessThreshold;
    
    // 불량 측정 데이터 생성
    const defectMeasurement = {
      x: pos.x,
      y: pos.y,
      itemId: this.nextId.toString(),
      subItemId: `${this.nextId}-D${this.defectMeasurements.length + 1}`,
      value: brightness,
      isBright: isBright,
      isStriated: this.circleOptions.striation,
      isDistorted: this.circleOptions.distortion,
      brightness: brightness
    };
    
    // 불량 측정 배열에 추가
    this.defectMeasurements.push(defectMeasurement);
    this.nextId++;
    
    // 캔버스 다시 그리기
    this.render();
    
    console.log('[addDefectMeasurement] 불량 측정 추가 완료:', defectMeasurement);
  },

  // D키 드래그 종료 처리
  handleDragEnd() {
    if (!this.tempDragLine) return;
    
    console.log('[handleDragEnd] D키 드래그 종료');
    
    // 드래그 선을 실제 측정으로 변환
    const measurement = {
      start: { ...this.tempDragLine.start },
      end: { ...this.tempDragLine.end },
      itemId: this.nextId.toString(),
      subItemId: `${this.nextId}-${this.subItemPrefix}1`,
      value: this.calculateValue(this.tempDragLine.start, this.tempDragLine.end)
    };
    
    this.measurements.push(measurement);
    this.segmentedMeasurements.push(measurement);
    this.nextId++;
    
    // 임시 드래그 선 초기화
    this.tempDragLine = null;
    this.isMeasuring = false;
    
    this.render();
    
    console.log('[handleDragEnd] D키 드래그 측정 완료:', measurement);
  }
} 