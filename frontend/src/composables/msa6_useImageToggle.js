/**
 * msa6_useImageToggle.js
 * Before/after image toggling, URL copy, result image download.
 */
import { ref, computed } from 'vue';

export function useImageToggle(deps) {
  // deps: { canvasRef, sourceImageRef, inputImageUrl (prop), imageUrl (prop),
  //          showNotification, render }

  const isShowingInputImage = ref(false);
  const internalInputImageUrl = ref(null);
  const outputImageUrl = ref(null);
  const isToggling = ref(false);

  const currentImageUrl = computed(() => {
    if (isShowingInputImage.value) {
      return internalInputImageUrl.value || deps.inputImageUrl.value;
    } else {
      return outputImageUrl.value || deps.imageUrl.value;
    }
  });

  function toggleBeforeAfterImage() {
    try {
      isToggling.value = true;
      isShowingInputImage.value = !isShowingInputImage.value;

      let targetUrl;
      if (isShowingInputImage.value) {
        targetUrl = internalInputImageUrl.value || deps.inputImageUrl.value;
      } else {
        targetUrl = outputImageUrl.value || deps.imageUrl.value;
      }

      if (!targetUrl) {
        console.error('[toggleBeforeAfterImage] No target URL');
        deps.showNotification('전환할 이미지가 없습니다.', 'error');
        isShowingInputImage.value = !isShowingInputImage.value;
        isToggling.value = false;
        return;
      }

      // Force image reload via nextTick is handled by the caller watching currentImageUrl
      setTimeout(() => {
        isToggling.value = false;
      }, 500);
    } catch (error) {
      console.error('[toggleBeforeAfterImage] Error:', error);
      isToggling.value = false;
      deps.showNotification('이미지 전환 중 오류가 발생했습니다.', 'error');
    }
  }

  function copyImageUrl() {
    try {
      const canvas = deps.canvasRef.value;
      if (!canvas) {
        deps.showNotification('캔버스를 찾을 수 없습니다.', 'error');
        return;
      }

      deps.showNotification('이미지 URL 생성 중...', 'info');
      uploadCanvasAndGetUrl(canvas);
    } catch (error) {
      console.error('[copyImageUrl] Error:', error);
      deps.showNotification('URL 복사 중 오류가 발생했습니다.', 'error');
    }
  }

  async function uploadCanvasAndGetUrl(canvas) {
    try {
      return new Promise((resolve, reject) => {
        canvas.toBlob(async (blob) => {
          if (!blob) {
            deps.showNotification('이미지 변환에 실패했습니다.', 'error');
            reject(new Error('Image conversion failed'));
            return;
          }

          try {
            const formData = new FormData();
            const filename = `measurement_result_${Date.now()}.png`;
            formData.append('file', blob, filename);

            const uploadResponse = await fetch('http://localhost:8000/api/msa6/generate_image_url', {
              method: 'POST',
              body: formData,
            });

            if (!uploadResponse.ok) {
              throw new Error(`HTTP error! status: ${uploadResponse.status}`);
            }

            const result = await uploadResponse.json();

            if (result.status === 'success') {
              const fullUrl = `http://localhost:8000/api/msa6/temp_image_url${result.url.replace('/static/temp_image_url/', '/')}`;

              navigator.clipboard.writeText(fullUrl).then(() => {
                deps.showNotification('측정 결과 포함 이미지 URL이 클립보드에 복사되었습니다.', 'success');
                resolve(fullUrl);
              }).catch(() => {
                fallbackCopyToClipboard(fullUrl);
                resolve(fullUrl);
              });
            } else {
              throw new Error(result.message || 'Image URL generation failed');
            }
          } catch (error) {
            console.error('[uploadCanvasAndGetUrl] Upload failed:', error);
            deps.showNotification(`이미지 URL 생성 실패: ${error.message}`, 'error');
            reject(error);
          }
        }, 'image/png');
      });
    } catch (error) {
      console.error('[uploadCanvasAndGetUrl] Error:', error);
      deps.showNotification(`이미지 URL 생성 실패: ${error.message}`, 'error');
    }
  }

  function fallbackCopyToClipboard(text) {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (successful) {
        deps.showNotification('이미지 URL이 클립보드에 복사되었습니다.', 'success');
      } else {
        deps.showNotification('클립보드 복사를 지원하지 않는 브라우저입니다.', 'warning');
      }
    } catch (error) {
      console.error('[fallbackCopyToClipboard] Error:', error);
      deps.showNotification('클립보드 복사에 실패했습니다.', 'error');
    }
  }

  function downloadResultImage() {
    try {
      const canvas = deps.canvasRef.value;
      if (!canvas) {
        deps.showNotification('캔버스를 찾을 수 없습니다.', 'error');
        return;
      }

      canvas.toBlob((blob) => {
        if (!blob) {
          deps.showNotification('이미지 변환에 실패했습니다.', 'error');
          return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `measurement_result_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);
        deps.showNotification('이미지가 다운로드되었습니다.', 'success');
      }, 'image/png');
    } catch (error) {
      console.error('[downloadResultImage] Error:', error);
      deps.showNotification('다운로드 중 오류가 발생했습니다.', 'error');
    }
  }

  return {
    isShowingInputImage,
    internalInputImageUrl,
    outputImageUrl,
    isToggling,
    currentImageUrl,
    toggleBeforeAfterImage,
    copyImageUrl,
    downloadResultImage,
  };
}
