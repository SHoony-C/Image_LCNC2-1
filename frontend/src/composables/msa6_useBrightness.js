/**
 * msa6_useBrightness.js
 * Brightness calculation, magnifier, and related state.
 */
import { ref, reactive, computed } from 'vue';

export function useBrightness(deps) {
  // deps: { canvasRef, sourceImageRef, magnifierCanvasRef, imageData, showNotification }

  const brightnessThreshold = ref(200);
  const isReversed = ref(true);
  const isFKeyPressed = ref(false);
  const showBrightnessTooltip = ref(false);
  const currentBrightness = ref(0);
  const magnifierSize = ref(150);
  const magnifierZoom = ref(5);
  const currentMousePos = reactive({ x: 0, y: 0 });

  const brightnessTooltipStyle = computed(() => ({
    left: `${currentMousePos.x + 15}px`,
    top: `${currentMousePos.y - 10}px`,
  }));

  const magnifierStyle = computed(() => ({
    left: `${currentMousePos.x + 20}px`,
    top: `${currentMousePos.y - magnifierSize.value - 10}px`,
    width: `${magnifierSize.value}px`,
    height: `${magnifierSize.value}px`,
  }));

  function calculateBrightness(x, y) {
    if (!deps.imageData.value) return 128;

    const canvas = deps.canvasRef.value;
    const img = deps.sourceImageRef.value;
    if (!canvas || !img) return 128;

    const imageX = Math.floor((x / canvas.width) * img.naturalWidth);
    const imageY = Math.floor((y / canvas.height) * img.naturalHeight);

    let totalBrightness = 0;
    let pixelCount = 0;

    const sampleX = imageX;
    const sampleY = imageY;

    if (
      sampleX >= 0 && sampleX < img.naturalWidth &&
      sampleY >= 0 && sampleY < img.naturalHeight
    ) {
      const index = (sampleY * img.naturalWidth + sampleX) * 4;
      if (index >= 0 && index < deps.imageData.value.data.length) {
        totalBrightness += deps.imageData.value.data[index];
        pixelCount++;
      }
    }

    return pixelCount > 0 ? Math.round(totalBrightness / pixelCount) : 128;
  }

  function calculateAverageBrightness(start, end) {
    if (!start || !end) return 0;
    const samples = 3000;
    let totalBrightness = 0;
    let validSamples = 0;

    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const x = start.x + (end.x - start.x) * t;
      const y = start.y + (end.y - start.y) * t;
      const brightness = calculateBrightness(x, y);
      if (brightness !== 128) {
        totalBrightness += brightness;
        validSamples++;
      }
    }

    return validSamples > 0 ? totalBrightness / validSamples : 0;
  }

  function updateBrightnessAtPosition(e) {
    if (!deps.canvasRef.value) return;
    const pos = deps.getLocalPos(e);
    currentBrightness.value = calculateBrightness(pos.x, pos.y);
  }

  function updateMagnifier(e) {
    if (!deps.canvasRef.value || !deps.magnifierCanvasRef.value) return;

    const pos = deps.getLocalPos(e);
    const magnifierCanvas = deps.magnifierCanvasRef.value;
    const magnifierCtx = magnifierCanvas.getContext('2d');

    magnifierCanvas.width = magnifierSize.value;
    magnifierCanvas.height = magnifierSize.value;

    const sourceSize = 50;
    const sourceX = pos.x - sourceSize / 2;
    const sourceY = pos.y - sourceSize / 2;

    try {
      magnifierCtx.clearRect(0, 0, magnifierSize.value, magnifierSize.value);
      magnifierCtx.drawImage(
        deps.canvasRef.value,
        sourceX, sourceY, sourceSize, sourceSize,
        0, 0, magnifierSize.value, magnifierSize.value,
      );
    } catch (error) {
      console.error('Magnifier update error:', error);
    }
  }

  function toggleReverse() {
    isReversed.value = !isReversed.value;
  }

  return {
    brightnessThreshold,
    isReversed,
    isFKeyPressed,
    showBrightnessTooltip,
    currentBrightness,
    magnifierSize,
    magnifierZoom,
    currentMousePos,
    brightnessTooltipStyle,
    magnifierStyle,
    calculateBrightness,
    calculateAverageBrightness,
    updateBrightnessAtPosition,
    updateMagnifier,
    toggleReverse,
  };
}
