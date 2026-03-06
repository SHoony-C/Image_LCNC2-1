/**
 * msa6_useCanvas.js
 * Canvas setup, image loading, rendering, resize, coordinate helpers.
 */
import { ref, nextTick } from 'vue';
import { MSA6ScalebarManager } from '@/utils/msa6_scalebar_manager.js';
import { patchDetectScaleBar } from '@/utils/popupOverride';
import PopupDebug from '@/utils/popupDebug';

export function useCanvas(deps) {
  // deps: { canvasRef, containerRef, sourceImageRef, magnifierCanvasRef,
  //          emit, props,
  //          // Refs from other composables:
  //          isMeasuring, currentMeasurement, segmentedMeasurements, localMeasurements,
  //          defectMeasurements, referenceLines, activeReferenceLine, referenceLineColor,
  //          measurementMode, isReversed, brightnessThreshold,
  //          scaleMethod, scaleBarValue, scaleBarUnit, scaleBarDetected, scaleBarMeasurement,
  //          magnification, manualScaleBar, manualScaleBarSet, isDrawingScaleBar,
  //          selectedAreaRect, areaStart, areaEnd, areaSelectionStart, areaSelectionEnd,
  //          deleteStart, deleteEnd, isDeleteMode, isAreaSelectionMode, tempDragLine,
  //          isToggling, isShowingInputImage, internalInputImageUrl, outputImageUrl,
  //          showNotification, showScaleDetectionFailurePopup,
  //          lineCount }

  const image = ref(null);
  const ctx = ref(null);
  const imageData = ref(null);
  const imageRatio = ref(1);
  const prevWidth = ref(1);
  const prevHeight = ref(1);
  const scalebarManager = ref(null);
  const _renderRetryCount = ref(0);
  const _isInitialLoad = ref(true);
  const isFirstDetectionAttempt = ref(true);
  const initialLoadDone = ref(false);

  function getLocalPos(e) {
    const canvas = deps.canvasRef.value;
    if (!canvas) {
      console.warn('getLocalPos: Canvas reference is null');
      return { x: 0, y: 0 };
    }
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function calculateValue(start, end) {
    if (!start || !end) return 0;
    const img = deps.sourceImageRef.value;
    const canvas = deps.canvasRef.value;
    if (!img || !canvas) return 0;

    const startX = (start.x / canvas.width) * img.naturalWidth;
    const startY = (start.y / canvas.height) * img.naturalHeight;
    const endX = (end.x / canvas.width) * img.naturalWidth;
    const endY = (end.y / canvas.height) * img.naturalHeight;

    const dx = endX - startX;
    const dy = endY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    let value;

    if (
      deps.scaleMethod.value === 'scaleBar' &&
      deps.scaleBarDetected.value &&
      deps.scaleBarMeasurement.value
    ) {
      const scaleBarPixelLength = deps.scaleBarMeasurement.value.pixelLength;
      let scaleBarRealLength = deps.scaleBarValue.value;

      if (deps.scaleBarUnit.value === '\u03bcm') {
        scaleBarRealLength *= 1000;
      }

      value = (distance / scaleBarPixelLength) * scaleBarRealLength;
    } else {
      value = distance * deps.magnification.value;
    }

    return value;
  }

  function updateCanvasSize() {
    const container = deps.containerRef.value;
    if (!container) {
      console.error('[updateCanvasSize] No container ref');
      return;
    }

    const img = deps.sourceImageRef.value;
    const canvas = deps.canvasRef.value;
    if (!canvas) {
      console.error('[updateCanvasSize] No canvas ref');
      return;
    }

    const canvasWidth = container.clientWidth;
    const canvasHeight = container.clientHeight;

    if (canvasWidth <= 0 || canvasHeight <= 0) {
      nextTick(() => {
        setTimeout(() => {
          if (container.clientWidth > 0 && container.clientHeight > 0) {
            updateCanvasSize();
          } else {
            canvas.width = 800;
            canvas.height = 600;
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            ctx.value = canvas.getContext('2d');
          }
        }, 100);
      });
      return;
    }

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.margin = '0';
    canvas.style.padding = '0';

    ctx.value = canvas.getContext('2d', { willReadFrequently: true });

    if (img && image.value && img.complete && image.value.complete && image.value.width > 0) {
      try {
        ctx.value.drawImage(image.value, 0, 0, canvas.width, canvas.height);
      } catch (error) {
        console.error('[updateCanvasSize] Draw error:', error);
      }
    }

    if (prevWidth.value !== 1 && prevHeight.value !== 1) {
      adjustMeasurements(canvasWidth / prevWidth.value, canvasHeight / prevHeight.value);
    }

    prevWidth.value = canvasWidth;
    prevHeight.value = canvasHeight;

    render();
  }

  function adjustMeasurements(scaleX, scaleY) {
    if (!isFinite(scaleX) || !isFinite(scaleY)) return;

    deps.localMeasurements.value.forEach((m) => {
      m.start.x *= scaleX; m.start.y *= scaleY;
      m.end.x *= scaleX; m.end.y *= scaleY;
    });

    deps.segmentedMeasurements.value.forEach((s) => {
      s.start.x *= scaleX; s.start.y *= scaleY;
      s.end.x *= scaleX; s.end.y *= scaleY;
    });

    if (deps.defectMeasurements.value && deps.defectMeasurements.value.length > 0) {
      deps.defectMeasurements.value.forEach((defect) => {
        if (defect.start && defect.end) {
          defect.start.x *= scaleX; defect.start.y *= scaleY;
          defect.end.x *= scaleX; defect.end.y *= scaleY;
        }
        if (defect.center) { defect.center.x *= scaleX; defect.center.y *= scaleY; }
        if (defect.centerX !== undefined) defect.centerX *= scaleX;
        if (defect.centerY !== undefined) defect.centerY *= scaleY;
        if (defect.radiusX !== undefined) defect.radiusX *= scaleX;
        if (defect.radiusY !== undefined) defect.radiusY *= scaleY;
        if (defect.x !== undefined) defect.x *= scaleX;
        if (defect.y !== undefined) defect.y *= scaleY;
        if (defect.width !== undefined) defect.width *= scaleX;
        if (defect.height !== undefined) defect.height *= scaleY;
        if (defect.edgePixels && defect.edgePixels.length > 0) {
          defect.edgePixels.forEach((px) => {
            if (px.x !== undefined) px.x *= scaleX;
            if (px.y !== undefined) px.y *= scaleY;
          });
        }
      });
    }

    if (deps.selectedAreaRect.value) {
      deps.selectedAreaRect.value.start.x *= scaleX; deps.selectedAreaRect.value.start.y *= scaleY;
      deps.selectedAreaRect.value.end.x *= scaleX; deps.selectedAreaRect.value.end.y *= scaleY;
    }

    if (deps.areaStart.value) { deps.areaStart.value.x *= scaleX; deps.areaStart.value.y *= scaleY; }
    if (deps.areaEnd.value) { deps.areaEnd.value.x *= scaleX; deps.areaEnd.value.y *= scaleY; }
    if (deps.areaSelectionStart.value) { deps.areaSelectionStart.value.x *= scaleX; deps.areaSelectionStart.value.y *= scaleY; }
    if (deps.areaSelectionEnd.value) { deps.areaSelectionEnd.value.x *= scaleX; deps.areaSelectionEnd.value.y *= scaleY; }

    if (deps.referenceLines.value && deps.referenceLines.value.length > 0) {
      deps.referenceLines.value.forEach((refLine) => {
        if (refLine.start && refLine.end) {
          refLine.start.x *= scaleX; refLine.start.y *= scaleY;
          refLine.end.x *= scaleX; refLine.end.y *= scaleY;
        }
      });
    }

    if (deps.currentMeasurement.value && deps.currentMeasurement.value.start && deps.currentMeasurement.value.end) {
      deps.currentMeasurement.value.start.x *= scaleX; deps.currentMeasurement.value.start.y *= scaleY;
      deps.currentMeasurement.value.end.x *= scaleX; deps.currentMeasurement.value.end.y *= scaleY;
    }

    if (deps.manualScaleBar.value && deps.manualScaleBar.value.start && deps.manualScaleBar.value.end) {
      deps.manualScaleBar.value.start.x *= scaleX; deps.manualScaleBar.value.start.y *= scaleY;
      deps.manualScaleBar.value.end.x *= scaleX; deps.manualScaleBar.value.end.y *= scaleY;
    }

    if (deps.scaleBarMeasurement.value && deps.scaleBarMeasurement.value.start && deps.scaleBarMeasurement.value.end) {
      deps.scaleBarMeasurement.value.start.x *= scaleX; deps.scaleBarMeasurement.value.start.y *= scaleY;
      deps.scaleBarMeasurement.value.end.x *= scaleX; deps.scaleBarMeasurement.value.end.y *= scaleY;
    }

    if (deps.deleteStart.value) { deps.deleteStart.value.x *= scaleX; deps.deleteStart.value.y *= scaleY; }
    if (deps.deleteEnd.value) { deps.deleteEnd.value.x *= scaleX; deps.deleteEnd.value.y *= scaleY; }

    if (deps.tempDragLine.value && deps.tempDragLine.value.start && deps.tempDragLine.value.end) {
      deps.tempDragLine.value.start.x *= scaleX; deps.tempDragLine.value.start.y *= scaleY;
      deps.tempDragLine.value.end.x *= scaleX; deps.tempDragLine.value.end.y *= scaleY;
    }
  }

  function onWindowResize() {
    if (deps.canvasRef.value) {
      updateCanvasSize();
    }
  }

  function render() {
    if (!deps.canvasRef.value) {
      console.error('[render] No canvas element');
      return;
    }

    if (!ctx.value) {
      ctx.value = deps.canvasRef.value.getContext('2d', { willReadFrequently: true });
      if (!ctx.value) {
        console.error('[render] Context init failed');
        return;
      }
    }

    try {
      const canvas = deps.canvasRef.value;
      if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
        if (_renderRetryCount.value < 3) {
          _renderRetryCount.value++;
          nextTick(() => {
            updateCanvasSize();
            setTimeout(() => render(), 100);
          });
        } else {
          _renderRetryCount.value = 0;
        }
        return;
      }

      _renderRetryCount.value = 0;
      ctx.value.clearRect(0, 0, canvas.width, canvas.height);

      if (image.value && image.value.complete && image.value.naturalWidth > 0) {
        try {
          ctx.value.drawImage(image.value, 0, 0, canvas.width, canvas.height);
        } catch (drawError) {
          console.error('[render] Image draw error:', drawError);
          ctx.value.fillStyle = '#f8f9fa';
          ctx.value.fillRect(0, 0, canvas.width, canvas.height);
          ctx.value.fillStyle = '#dc3545';
          ctx.value.font = '16px Arial';
          ctx.value.textAlign = 'center';
          ctx.value.fillText('이미지를 로드할 수 없습니다', canvas.width / 2, canvas.height / 2);
        }
      } else {
        ctx.value.fillStyle = '#f8f9fa';
        ctx.value.fillRect(0, 0, canvas.width, canvas.height);
        ctx.value.fillStyle = '#6c757d';
        ctx.value.font = '16px Arial';
        ctx.value.textAlign = 'center';
        ctx.value.fillText('이미지 로딩 중...', canvas.width / 2, canvas.height / 2);
      }

      // Reference lines
      if (deps.referenceLines.value.length > 0) {
        deps.referenceLines.value.forEach((refLine) => {
          ctx.value.beginPath();
          ctx.value.strokeStyle = refLine.color || deps.referenceLineColor.value;
          ctx.value.lineWidth = 4;
          ctx.value.setLineDash([]);
          ctx.value.moveTo(refLine.start.x, refLine.start.y);
          ctx.value.lineTo(refLine.end.x, refLine.end.y);
          ctx.value.stroke();
        });
      }

      // Segmented measurements
      if (deps.measurementMode.value !== 'defect') {
        deps.segmentedMeasurements.value.forEach((segment) => {
          const shouldDisplay = deps.isReversed.value ? segment.isBright : !segment.isBright;

          ctx.value.beginPath();
          if (shouldDisplay) {
            ctx.value.strokeStyle = 'blue';
            ctx.value.setLineDash([5, 5]);
          } else {
            ctx.value.strokeStyle = 'red';
            ctx.value.setLineDash([]);
          }

          ctx.value.lineWidth = 2;
          ctx.value.moveTo(segment.start.x, segment.start.y);
          ctx.value.lineTo(segment.end.x, segment.end.y);
          ctx.value.stroke();

          if (segment.value && !shouldDisplay) {
            const midX = (segment.start.x + segment.end.x) / 2;
            const midY = (segment.start.y + segment.end.y) / 2;

            ctx.value.fillStyle = 'rgba(0, 0, 0, 0.7)';
            const text = `${segment.value.toFixed(2)}nm`;
            ctx.value.font = '12px Arial';
            const textMetrics = ctx.value.measureText(text);
            const textWidth = textMetrics.width;
            const textHeight = 12;

            ctx.value.fillRect(midX + 5, midY - textHeight - 5, textWidth + 6, textHeight + 4);
            ctx.value.fillStyle = 'white';
            ctx.value.font = '12px Arial';
            ctx.value.textAlign = 'left';
            ctx.value.fillText(text, midX + 8, midY - 8);
          }
        });
      }

      // Current measurement being drawn
      if (deps.isMeasuring.value && deps.currentMeasurement.value) {
        ctx.value.beginPath();
        ctx.value.strokeStyle = deps.measurementMode.value === 'reference'
          ? deps.referenceLineColor.value
          : 'blue';
        ctx.value.lineWidth = deps.measurementMode.value === 'reference' ? 4 : 2;
        ctx.value.setLineDash([5, 5]);
        ctx.value.moveTo(deps.currentMeasurement.value.start.x, deps.currentMeasurement.value.start.y);
        ctx.value.lineTo(deps.currentMeasurement.value.end.x, deps.currentMeasurement.value.end.y);
        ctx.value.stroke();
      }

      // Manual scale bar
      if (deps.manualScaleBar.value && deps.scaleMethod.value === 'scaleBar') {
        ctx.value.beginPath();
        ctx.value.strokeStyle = '#FF6600';
        ctx.value.lineWidth = 3;
        ctx.value.setLineDash([8, 4]);
        ctx.value.moveTo(deps.manualScaleBar.value.start.x, deps.manualScaleBar.value.start.y);
        ctx.value.lineTo(deps.manualScaleBar.value.end.x, deps.manualScaleBar.value.end.y);
        ctx.value.stroke();

        if (deps.scaleBarValue.value && deps.scaleBarUnit.value) {
          ctx.value.fillStyle = '#FF6600';
          ctx.value.font = '12px Arial';
          ctx.value.textAlign = 'center';
          const midX = (deps.manualScaleBar.value.start.x + deps.manualScaleBar.value.end.x) / 2;
          const midY = (deps.manualScaleBar.value.start.y + deps.manualScaleBar.value.end.y) / 2 - 10;
          ctx.value.fillText(`${deps.scaleBarValue.value} ${deps.scaleBarUnit.value}`, midX, midY);
        }
      }

      // Defect measurements
      if (deps.defectMeasurements.value && deps.defectMeasurements.value.length > 0) {
        deps.defectMeasurements.value.forEach((defect) => {
          ctx.value.save();

          const centerX = defect.centerX || (defect.x + defect.width / 2);
          const centerY = defect.centerY || (defect.y + defect.height / 2);
          const radiusX = defect.radiusX || defect.width / 2;
          const radiusY = defect.radiusY || defect.height / 2;

          if (defect.edgePixels && defect.edgePixels.length > 0) {
            ctx.value.fillStyle = '#ff0000';
            for (const ep of defect.edgePixels) {
              ctx.value.fillRect(ep.x - 1, ep.y - 1, 2, 2);
            }
          }

          ctx.value.beginPath();
          ctx.value.strokeStyle = '#00ff00';
          ctx.value.lineWidth = 2;
          ctx.value.setLineDash([]);
          ctx.value.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
          ctx.value.stroke();

          ctx.value.fillStyle = '#00ff00';
          ctx.value.font = 'bold 12px Arial';
          ctx.value.textAlign = 'center';
          ctx.value.fillText(`${defect.id}`, centerX, centerY + 4);

          ctx.value.restore();
        });
      }

      // Selected area rect (defect)
      if (deps.selectedAreaRect.value) {
        ctx.value.beginPath();
        ctx.value.strokeStyle = '#ffff00';
        ctx.value.lineWidth = 2;
        ctx.value.setLineDash([5, 5]);

        const x = Math.min(deps.selectedAreaRect.value.start.x, deps.selectedAreaRect.value.end.x);
        const y = Math.min(deps.selectedAreaRect.value.start.y, deps.selectedAreaRect.value.end.y);
        const w = Math.abs(deps.selectedAreaRect.value.end.x - deps.selectedAreaRect.value.start.x);
        const h = Math.abs(deps.selectedAreaRect.value.end.y - deps.selectedAreaRect.value.start.y);

        ctx.value.strokeRect(x, y, w, h);
        ctx.value.fillStyle = 'rgba(255, 255, 0, 0.1)';
        ctx.value.fillRect(x, y, w, h);
      }

      // Current drag area box (defect mode)
      if (deps.measurementMode.value === 'defect' && deps.isMeasuring.value && deps.areaStart.value && deps.areaEnd.value) {
        ctx.value.beginPath();
        ctx.value.strokeStyle = '#ff00ff';
        ctx.value.lineWidth = 2;
        ctx.value.setLineDash([3, 3]);

        const x = Math.min(deps.areaStart.value.x, deps.areaEnd.value.x);
        const y = Math.min(deps.areaStart.value.y, deps.areaEnd.value.y);
        const w = Math.abs(deps.areaEnd.value.x - deps.areaStart.value.x);
        const h = Math.abs(deps.areaEnd.value.y - deps.areaStart.value.y);

        ctx.value.strokeRect(x, y, w, h);
      }

      // Current drag area box (area measurement mode)
      if (deps.measurementMode.value && deps.measurementMode.value.startsWith('area') && deps.isMeasuring.value && deps.areaStart.value && deps.areaEnd.value) {
        const x = Math.min(deps.areaStart.value.x, deps.areaEnd.value.x);
        const y = Math.min(deps.areaStart.value.y, deps.areaEnd.value.y);
        const w = Math.abs(deps.areaEnd.value.x - deps.areaStart.value.x);
        const h = Math.abs(deps.areaEnd.value.y - deps.areaStart.value.y);

        if (deps.measurementMode.value === 'area-vertical') {
          const lineSpacing = w / (deps.lineCount.value - 1);
          for (let i = 0; i < deps.lineCount.value; i++) {
            const lineX = x + i * lineSpacing;
            ctx.value.beginPath();
            ctx.value.strokeStyle = 'blue';
            ctx.value.lineWidth = 2;
            ctx.value.setLineDash([5, 5]);
            ctx.value.moveTo(lineX, y);
            ctx.value.lineTo(lineX, y + h);
            ctx.value.stroke();
          }
        } else if (deps.measurementMode.value === 'area-horizontal') {
          const lineSpacing = h / (deps.lineCount.value - 1);
          for (let i = 0; i < deps.lineCount.value; i++) {
            const lineY = y + i * lineSpacing;
            ctx.value.beginPath();
            ctx.value.strokeStyle = 'blue';
            ctx.value.lineWidth = 2;
            ctx.value.setLineDash([5, 5]);
            ctx.value.moveTo(x, lineY);
            ctx.value.lineTo(x + w, lineY);
            ctx.value.stroke();
          }
        }
      }

      // Area selection mode current drag box
      if (deps.isAreaSelectionMode.value && deps.isMeasuring.value && deps.areaSelectionStart.value && deps.areaSelectionEnd.value) {
        ctx.value.beginPath();
        ctx.value.strokeStyle = '#00ffff';
        ctx.value.lineWidth = 2;
        ctx.value.setLineDash([5, 3]);

        const x = Math.min(deps.areaSelectionStart.value.x, deps.areaSelectionEnd.value.x);
        const y = Math.min(deps.areaSelectionStart.value.y, deps.areaSelectionEnd.value.y);
        const w = Math.abs(deps.areaSelectionEnd.value.x - deps.areaSelectionStart.value.x);
        const h = Math.abs(deps.areaSelectionEnd.value.y - deps.areaSelectionStart.value.y);

        ctx.value.strokeRect(x, y, w, h);
        ctx.value.fillStyle = 'rgba(0, 255, 255, 0.1)';
        ctx.value.fillRect(x, y, w, h);
      }

      // Delete mode drag line
      if (deps.isDeleteMode.value && deps.isMeasuring.value && deps.deleteStart.value && deps.deleteEnd.value) {
        ctx.value.beginPath();
        ctx.value.strokeStyle = '#ff0000';
        ctx.value.lineWidth = 3;
        ctx.value.setLineDash([5, 5]);

        ctx.value.moveTo(deps.deleteStart.value.x, deps.deleteStart.value.y);
        ctx.value.lineTo(deps.deleteEnd.value.x, deps.deleteEnd.value.y);
        ctx.value.stroke();

        ctx.value.setLineDash([]);
        ctx.value.fillStyle = '#ff0000';

        ctx.value.beginPath();
        ctx.value.arc(deps.deleteStart.value.x, deps.deleteStart.value.y, 4, 0, 2 * Math.PI);
        ctx.value.fill();

        ctx.value.beginPath();
        ctx.value.arc(deps.deleteEnd.value.x, deps.deleteEnd.value.y, 4, 0, 2 * Math.PI);
        ctx.value.fill();
      }
    } catch (error) {
      console.error('[render] Error:', error);
    }
  }

  function drawMeasurementsOnCanvas(drawCtx, canvasWidth, canvasHeight) {
    try {
      const currentCanvas = deps.canvasRef.value;
      if (!currentCanvas) return;

      const scaleX = canvasWidth / currentCanvas.width;
      const scaleY = canvasHeight / currentCanvas.height;

      // Reference lines
      if (deps.referenceLines.value.length > 0) {
        deps.referenceLines.value.forEach((refLine) => {
          drawCtx.beginPath();
          drawCtx.strokeStyle = refLine.color || deps.referenceLineColor.value;
          drawCtx.lineWidth = 4 * Math.min(scaleX, scaleY);
          drawCtx.setLineDash([]);
          drawCtx.moveTo(refLine.start.x * scaleX, refLine.start.y * scaleY);
          drawCtx.lineTo(refLine.end.x * scaleX, refLine.end.y * scaleY);
          drawCtx.stroke();
        });
      }

      // Segmented measurements
      if (deps.measurementMode.value !== 'defect') {
        deps.segmentedMeasurements.value.forEach((segment) => {
          const shouldDisplay = deps.isReversed.value ? segment.isBright : !segment.isBright;

          drawCtx.beginPath();
          if (shouldDisplay) {
            drawCtx.strokeStyle = 'blue';
            drawCtx.setLineDash([5 * Math.min(scaleX, scaleY), 5 * Math.min(scaleX, scaleY)]);
          } else {
            drawCtx.strokeStyle = 'red';
            drawCtx.setLineDash([]);
          }

          drawCtx.lineWidth = 2 * Math.min(scaleX, scaleY);
          drawCtx.moveTo(segment.start.x * scaleX, segment.start.y * scaleY);
          drawCtx.lineTo(segment.end.x * scaleX, segment.end.y * scaleY);
          drawCtx.stroke();

          if (segment.value && !shouldDisplay) {
            const midX = (segment.start.x + segment.end.x) / 2 * scaleX;
            const midY = (segment.start.y + segment.end.y) / 2 * scaleY;

            drawCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            const text = `${segment.value.toFixed(2)}nm`;
            drawCtx.font = `${12 * Math.min(scaleX, scaleY)}px Arial`;
            const textMetrics = drawCtx.measureText(text);
            const textWidth = textMetrics.width;
            const textHeight = 12 * Math.min(scaleX, scaleY);

            drawCtx.fillRect(midX + 5 * scaleX, midY - textHeight - 5 * scaleY, textWidth + 6 * scaleX, textHeight + 4 * scaleY);
            drawCtx.fillStyle = 'white';
            drawCtx.font = `${12 * Math.min(scaleX, scaleY)}px Arial`;
            drawCtx.textAlign = 'left';
            drawCtx.fillText(text, midX + 8 * scaleX, midY - 8 * scaleY);
          }
        });
      }

      // Local measurements
      if (deps.localMeasurements.value.length > 0) {
        deps.localMeasurements.value.forEach((measurement) => {
          if (measurement.start && measurement.end) {
            drawCtx.beginPath();
            drawCtx.strokeStyle = 'blue';
            drawCtx.lineWidth = 2 * Math.min(scaleX, scaleY);
            drawCtx.setLineDash([]);
            drawCtx.moveTo(measurement.start.x * scaleX, measurement.start.y * scaleY);
            drawCtx.lineTo(measurement.end.x * scaleX, measurement.end.y * scaleY);
            drawCtx.stroke();

            if (measurement.value) {
              const midX = (measurement.start.x + measurement.end.x) / 2 * scaleX;
              const midY = (measurement.start.y + measurement.end.y) / 2 * scaleY;

              drawCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
              const text = `${measurement.value.toFixed(2)}nm`;
              drawCtx.font = `${12 * Math.min(scaleX, scaleY)}px Arial`;
              const textMetrics = drawCtx.measureText(text);
              const textWidth = textMetrics.width;
              const textHeight = 12 * Math.min(scaleX, scaleY);

              drawCtx.fillRect(midX + 5 * scaleX, midY - textHeight - 5 * scaleY, textWidth + 6 * scaleX, textHeight + 4 * scaleY);
              drawCtx.fillStyle = 'white';
              drawCtx.font = `${12 * Math.min(scaleX, scaleY)}px Arial`;
              drawCtx.textAlign = 'left';
              drawCtx.fillText(text, midX + 8 * scaleX, midY - 8 * scaleY);
            }
          }
        });
      }

      // Defect measurements
      if (deps.defectMeasurements.value && deps.defectMeasurements.value.length > 0) {
        deps.defectMeasurements.value.forEach((defect) => {
          const centerX = (defect.centerX || (defect.x + defect.width / 2)) * scaleX;
          const centerY = (defect.centerY || (defect.y + defect.height / 2)) * scaleY;
          const radiusX = (defect.radiusX || defect.width / 2) * scaleX;
          const radiusY = (defect.radiusY || defect.height / 2) * scaleY;

          if (defect.edgePixels && defect.edgePixels.length > 0) {
            drawCtx.fillStyle = 'rgba(0, 255, 0, 0.8)';
            for (const ep of defect.edgePixels) {
              drawCtx.beginPath();
              drawCtx.arc(ep.x * scaleX, ep.y * scaleY, 0.8 * Math.min(scaleX, scaleY), 0, 2 * Math.PI);
              drawCtx.fill();
            }
          }

          drawCtx.beginPath();
          drawCtx.strokeStyle = '#00ff00';
          drawCtx.lineWidth = 2 * Math.min(scaleX, scaleY);
          drawCtx.setLineDash([]);
          drawCtx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
          drawCtx.stroke();

          drawCtx.fillStyle = '#00ff00';
          drawCtx.font = `bold ${12 * Math.min(scaleX, scaleY)}px Arial`;
          drawCtx.textAlign = 'center';
          drawCtx.fillText(`${defect.id}`, centerX, centerY + 4 * Math.min(scaleX, scaleY));
        });
      }

      // Manual scale bar
      if (deps.manualScaleBar.value && deps.scaleMethod.value === 'scaleBar') {
        drawCtx.beginPath();
        drawCtx.strokeStyle = '#FF6600';
        drawCtx.lineWidth = 3 * Math.min(scaleX, scaleY);
        drawCtx.setLineDash([8 * Math.min(scaleX, scaleY), 4 * Math.min(scaleX, scaleY)]);
        drawCtx.moveTo(deps.manualScaleBar.value.start.x * scaleX, deps.manualScaleBar.value.start.y * scaleY);
        drawCtx.lineTo(deps.manualScaleBar.value.end.x * scaleX, deps.manualScaleBar.value.end.y * scaleY);
        drawCtx.stroke();

        if (deps.scaleBarValue.value && deps.scaleBarUnit.value) {
          drawCtx.fillStyle = '#FF6600';
          drawCtx.font = `${12 * Math.min(scaleX, scaleY)}px Arial`;
          drawCtx.textAlign = 'center';
          const midX = (deps.manualScaleBar.value.start.x + deps.manualScaleBar.value.end.x) / 2 * scaleX;
          const midY = (deps.manualScaleBar.value.start.y + deps.manualScaleBar.value.end.y) / 2 * scaleY - 10 * Math.min(scaleX, scaleY);
          drawCtx.fillText(`${deps.scaleBarValue.value} ${deps.scaleBarUnit.value}`, midX, midY);
        }
      }
    } catch (error) {
      console.error('[drawMeasurementsOnCanvas] Error:', error);
    }
  }

  async function loadImage(url) {
    if (!url) return;

    deps.outputImageUrl.value = url;

    image.value = new Image();
    image.value.crossOrigin = 'anonymous';
    image.value.src = url;

    scalebarManager.value.restoreScaleBarSettings();
    const { hasValidManualScaleBar } = scalebarManager.value.validateScaleBarSettings();

    if (hasValidManualScaleBar) {
      deps.scaleBarDetected.value = true;
    }

    image.value.onload = async () => {
      updateCanvasSize();

      const canvas = deps.canvasRef.value;
      if (canvas) {
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.margin = '0';
        canvas.style.padding = '0';
        void canvas.offsetHeight;
      }

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = image.value.naturalWidth;
      tempCanvas.height = image.value.naturalHeight;
      const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
      tempCtx.drawImage(image.value, 0, 0);
      imageData.value = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);

      const noScalePopup = sessionStorage.getItem('msa6_no_scale_popup') === 'true';
      if (noScalePopup) {
        sessionStorage.removeItem('msa6_no_scale_popup');
        return;
      }

      const needScaleDetection = sessionStorage.getItem('msa6_need_scale_detection') === 'true';

      if (hasValidManualScaleBar && !needScaleDetection) {
        // Valid manual scale bar, skip popup
      } else if (
        deps.scaleMethod.value === 'scaleBar' &&
        deps.props.showPopup &&
        (!hasValidManualScaleBar || needScaleDetection)
      ) {
        if (needScaleDetection) {
          sessionStorage.removeItem('msa6_need_scale_detection');
        }
        scalebarManager.value.detectScaleBar(true);
      }

      if (initialLoadDone.value && deps.localMeasurements.value.length > 0) {
        nextTick(() => render());
      }
    };

    image.value.onerror = (error) => {
      console.error('[loadImage] Image load failed:', error);
      deps.showNotification('이미지를 불러오는데 실패했습니다. 다시 시도해주세요.', 'error');
    };
  }

  function handleImageLoad(event) {
    const img = event.target || deps.sourceImageRef.value;
    image.value = img;
    imageRatio.value = img.naturalWidth / img.naturalHeight;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = img.naturalWidth;
    tempCanvas.height = img.naturalHeight;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    tempCtx.drawImage(img, 0, 0);
    imageData.value = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);

    updateCanvasSize();

    if (deps.isToggling.value) {
      nextTick(() => render());
      return;
    }

    const noScalePopup = sessionStorage.getItem('msa6_no_scale_popup') === 'true';
    if (noScalePopup) {
      sessionStorage.removeItem('msa6_no_scale_popup');
      return;
    }

    if (
      deps.scaleMethod.value === 'scaleBar' &&
      deps.props.showPopup &&
      !(deps.manualScaleBarSet.value && deps.scaleBarValue.value && deps.scaleBarUnit.value)
    ) {
      setTimeout(() => {
        nextTick(() => {
          try {
            const popupElement = document.querySelector('.scale-choice-popup');
            if (popupElement) {
              popupElement.style.display = 'flex';
              popupElement.style.zIndex = '999999';
            }
          } catch (e) {
            console.error('[handleImageLoad] Popup style error:', e);
          }
        });
      }, 100);
    }

    if (
      deps.scaleMethod.value === 'scaleBar' &&
      !initialLoadDone.value &&
      !(deps.manualScaleBarSet.value && deps.scaleBarValue.value && deps.scaleBarUnit.value)
    ) {
      scalebarManager.value.detectScaleBar();
    }

    if (!initialLoadDone.value) {
      initialLoadDone.value = true;
      _isInitialLoad.value = false;
    }

    nextTick(() => render());
  }

  function cleanupImageUrls() {
    try {
      if (deps.outputImageUrl.value && deps.outputImageUrl.value.startsWith('blob:')) {
        URL.revokeObjectURL(deps.outputImageUrl.value);
      }
      if (deps.internalInputImageUrl.value && deps.internalInputImageUrl.value.startsWith('blob:')) {
        URL.revokeObjectURL(deps.internalInputImageUrl.value);
      }
      if (image.value) {
        if (image.value.src && image.value.src.startsWith('blob:')) {
          URL.revokeObjectURL(image.value.src);
        }
        image.value = null;
      }
      if (ctx.value) {
        ctx.value = null;
      }
    } catch (error) {
      console.error('[cleanupImageUrls] Error:', error);
    }
  }

  // Build a component-like interface for scalebarManager
  function initScalebarManager(componentInterface) {
    scalebarManager.value = new MSA6ScalebarManager(componentInterface);

    window.imageMeasurement = componentInterface;
    window.popupDebug = PopupDebug;
    window.showScalePopup = () => deps.showScaleDetectionFailurePopup();

    setTimeout(() => {
      patchDetectScaleBar(componentInterface);

      if (
        image.value &&
        imageData.value &&
        deps.scaleMethod.value === 'scaleBar' &&
        deps.props.showPopup &&
        !initialLoadDone.value
      ) {
        scalebarManager.value.detectScaleBar();
      }
    }, 500);
  }

  return {
    image,
    ctx,
    imageData,
    imageRatio,
    prevWidth,
    prevHeight,
    scalebarManager,
    _isInitialLoad,
    isFirstDetectionAttempt,
    initialLoadDone,
    getLocalPos,
    calculateValue,
    updateCanvasSize,
    adjustMeasurements,
    onWindowResize,
    render,
    drawMeasurementsOnCanvas,
    loadImage,
    handleImageLoad,
    cleanupImageUrls,
    initScalebarManager,
  };
}
