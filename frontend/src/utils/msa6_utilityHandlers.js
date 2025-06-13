export const utilityHandlers = {
  // 알림 표시 함수
  showNotification(message, type = 'info') {
    console.log(`[showNotification] ${type}: ${message}`);
    
    // 기존 알림 제거
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
      existingNotification.remove();
    }
    
    // 새 알림 생성
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // 스타일 설정
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 4px;
      color: white;
      font-weight: bold;
      z-index: 10000;
      max-width: 300px;
      word-wrap: break-word;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;
    
    // 타입별 색상 설정
    switch (type) {
      case 'success':
        notification.style.backgroundColor = '#4CAF50';
        break;
      case 'error':
        notification.style.backgroundColor = '#f44336';
        break;
      case 'warning':
        notification.style.backgroundColor = '#ff9800';
        break;
      default:
        notification.style.backgroundColor = '#2196F3';
    }
    
    // DOM에 추가
    document.body.appendChild(notification);
    
    // 3초 후 자동 제거
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 3000);
  },

  // 이미지 URL 검증 함수
  validateImageUrl(url) {
    console.log('[validateImageUrl] 이미지 URL 검증:', url);
    
    if (!url || typeof url !== 'string') {
      return { isValid: false, error: '유효하지 않은 URL입니다.' };
    }
    
    // Data URL 검증
    if (url.startsWith('data:')) {
      return this.validateDataUrl(url);
    }
    
    // HTTP/HTTPS URL 검증
    if (url.startsWith('http://') || url.startsWith('https://')) {
      try {
        new URL(url);
        return { isValid: true };
      } catch (error) {
        return { isValid: false, error: '잘못된 URL 형식입니다.' };
      }
    }
    
    // 상대 경로 또는 기타 URL
    return { isValid: true };
  },

  // Data URL 검증 함수
  validateDataUrl(dataUrl) {
    console.log('[validateDataUrl] Data URL 검증');
    
    try {
      // Data URL 형식 검증
      const parts = dataUrl.split(',');
      if (parts.length !== 2) {
        return { isValid: false, error: 'Data URL 형식이 올바르지 않습니다.' };
      }
      
      const [header, data] = parts;
      
      // SVG Data URL 특별 처리
      if (header.includes('image/svg+xml')) {
        return this.validateSvgDataUrl(header, data);
      }
      
      // Base64 데이터 검증
      if (header.includes('base64')) {
        if (!data || data.length === 0) {
          return { isValid: false, error: 'Base64 데이터가 비어있습니다.' };
        }
        
        // Base64 디코딩 테스트
        try {
          atob(data);
          return { isValid: true };
        } catch (error) {
          return { isValid: false, error: 'Base64 데이터가 손상되었습니다.' };
        }
      }
      
      return { isValid: true };
    } catch (error) {
      console.error('[validateDataUrl] 검증 오류:', error);
      return { isValid: false, error: 'Data URL 검증 중 오류가 발생했습니다.' };
    }
  },

  // SVG Data URL 검증 함수
  validateSvgDataUrl(header, data) {
    console.log('[validateSvgDataUrl] SVG Data URL 검증');
    
    try {
      let svgContent;
      
      if (header.includes('base64')) {
        // Base64 인코딩된 SVG
        if (!data || data.length === 0) {
          return { isValid: false, error: 'SVG Base64 데이터가 비어있습니다.' };
        }
        
        try {
          svgContent = atob(data);
        } catch (error) {
          return { isValid: false, error: 'SVG Base64 데이터 디코딩에 실패했습니다.' };
        }
      } else {
        // URL 인코딩된 SVG
        svgContent = decodeURIComponent(data);
      }
      
      // SVG 태그 존재 확인
      if (!svgContent.includes('<svg')) {
        return { isValid: false, error: '유효한 SVG 데이터가 아닙니다.' };
      }
      
      // 기본적인 SVG 구조 검증
      if (!svgContent.includes('</svg>')) {
        return { isValid: false, error: 'SVG 태그가 올바르게 닫히지 않았습니다.' };
      }
      
      return { isValid: true, svgContent };
    } catch (error) {
      console.error('[validateSvgDataUrl] SVG 검증 오류:', error);
      return { isValid: false, error: 'SVG 데이터 검증 중 오류가 발생했습니다.' };
    }
  },

  // 플레이스홀더 이미지 생성 함수
  createPlaceholderImage(width = 200, height = 200, message = '이미지 없음') {
    console.log('[createPlaceholderImage] 플레이스홀더 이미지 생성');
    
    const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="#E5E5E5"/>
      <path d="M${width*0.375} ${height*0.45}L${width*0.45} ${height*0.55}L${width*0.55} ${height*0.45}L${width*0.65} ${height*0.6}L${width*0.35} ${height*0.6}L${width*0.375} ${height*0.45}Z" fill="#999"/>
      <circle cx="${width*0.6}" cy="${height*0.4}" r="${width*0.05}" fill="#999"/>
      <path d="M${width*0.8} ${height*0.25}H${width*0.2}V${height*0.75}H${width*0.8}V${height*0.25}Z" stroke="#999" stroke-width="4"/>
      <text x="${width/2}" y="${height*0.85}" text-anchor="middle" fill="#666" font-family="Arial" font-size="${Math.max(12, width/16)}">${message}</text>
    </svg>`;
    
    // SVG를 Base64로 인코딩
    const base64Svg = btoa(unescape(encodeURIComponent(svg)));
    return `data:image/svg+xml;base64,${base64Svg}`;
  },

  // 이미지 로드 오류 처리 함수
  handleImageError(imageElement, originalUrl = null) {
    console.warn('[handleImageError] 이미지 로드 오류 처리');
    
    // 원본 URL 저장 (디버깅용)
    if (originalUrl && !imageElement.dataset.originalSrc) {
      imageElement.dataset.originalSrc = originalUrl;
    }
    
    // 플레이스홀더 이미지로 교체
    const placeholderUrl = this.createPlaceholderImage(200, 200, '이미지 로드 실패');
    imageElement.src = placeholderUrl;
    imageElement.alt = '이미지 로드 실패';
    
    // 오류 로그
    console.error('[handleImageError] 이미지 로드 실패:', {
      originalUrl: originalUrl || imageElement.dataset.originalSrc || 'unknown',
      currentSrc: imageElement.src
    });
  },

  // 로딩 상태 표시
  showLoading(message = '처리 중...') {
    console.log(`[showLoading] ${message}`);
    
    // 기존 로딩 제거
    this.hideLoading();
    
    // 로딩 오버레이 생성
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 99999;
    `;
    
    // 로딩 컨텐츠 생성
    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    
    // 스피너 생성
    const spinner = document.createElement('div');
    spinner.style.cssText = `
      width: 40px;
      height: 40px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #3498db;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 10px;
    `;
    
    // 스피너 애니메이션 CSS 추가
    if (!document.querySelector('#spinner-style')) {
      const style = document.createElement('style');
      style.id = 'spinner-style';
      style.textContent = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
    
    // 메시지 생성
    const messageEl = document.createElement('div');
    messageEl.textContent = message;
    messageEl.style.cssText = `
      font-size: 14px;
      color: #333;
    `;
    
    // 요소 조립
    content.appendChild(spinner);
    content.appendChild(messageEl);
    overlay.appendChild(content);
    document.body.appendChild(overlay);
  },

  // 로딩 상태 숨기기
  hideLoading() {
    const overlay = document.querySelector('#loading-overlay');
    if (overlay) {
      overlay.remove();
    }
  },

  // 파일 다운로드 함수
  downloadFile(data, filename, type = 'text/plain') {
    console.log(`[downloadFile] 파일 다운로드: ${filename}`);
    
    try {
      const blob = new Blob([data], { type });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      window.URL.revokeObjectURL(url);
      
      this.showNotification(`파일이 다운로드되었습니다: ${filename}`, 'success');
    } catch (error) {
      console.error('[downloadFile] 다운로드 오류:', error);
      this.showNotification('파일 다운로드 중 오류가 발생했습니다.', 'error');
    }
  },

  // 이미지 데이터 추출 함수
  extractImageData() {
    console.log('[extractImageData] 이미지 데이터 추출 시작');
    
    if (!this.image || !this.image.complete) {
      console.warn('[extractImageData] 이미지가 로드되지 않음');
      return null;
    }
    
    try {
      // 임시 캔버스 생성
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      
      // 캔버스 크기를 원본 이미지 크기로 설정
      tempCanvas.width = this.image.naturalWidth;
      tempCanvas.height = this.image.naturalHeight;
      
      // 이미지를 캔버스에 그리기
      tempCtx.drawImage(this.image, 0, 0);
      
      // 이미지 데이터 추출
      const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      
      console.log(`[extractImageData] 이미지 데이터 추출 완료: ${imageData.width}x${imageData.height}`);
      
      return imageData;
    } catch (error) {
      console.error('[extractImageData] 이미지 데이터 추출 오류:', error);
      return null;
    }
  },

  // 좌표 변환 함수
  canvasToImageCoords(canvasX, canvasY) {
    const canvas = this.$refs.canvas;
    const img = this.$refs.sourceImage;
    
    if (!canvas || !img) return { x: 0, y: 0 };
    
    const imageX = (canvasX / canvas.width) * img.naturalWidth;
    const imageY = (canvasY / canvas.height) * img.naturalHeight;
    
    return { x: imageX, y: imageY };
  },

  // 이미지 좌표를 캔버스 좌표로 변환
  imageToCanvasCoords(imageX, imageY) {
    const canvas = this.$refs.canvas;
    const img = this.$refs.sourceImage;
    
    if (!canvas || !img) return { x: 0, y: 0 };
    
    const canvasX = (imageX / img.naturalWidth) * canvas.width;
    const canvasY = (imageY / img.naturalHeight) * canvas.height;
    
    return { x: canvasX, y: canvasY };
  },

  // 거리 계산 함수
  calculateDistance(point1, point2) {
    if (!point1 || !point2) return 0;
    
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    
    return Math.sqrt(dx * dx + dy * dy);
  },

  // 각도 계산 함수
  calculateAngle(point1, point2) {
    if (!point1 || !point2) return 0;
    
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    
    return Math.atan2(dy, dx) * (180 / Math.PI);
  },

  // 점이 선분 근처에 있는지 확인
  isPointNearLine(point, lineStart, lineEnd, threshold = 10) {
    if (!point || !lineStart || !lineEnd) return false;
    
    // 점과 선분 사이의 최단 거리 계산
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    if (lenSq === 0) {
      // 선분의 길이가 0인 경우 (점과 점 사이의 거리)
      return this.calculateDistance(point, lineStart) <= threshold;
    }
    
    let param = dot / lenSq;
    
    let xx, yy;
    
    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }
    
    const dx = point.x - xx;
    const dy = point.y - yy;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return distance <= threshold;
  },

  // 점이 사각형 내부에 있는지 확인
  isPointInRect(point, rectStart, rectEnd) {
    if (!point || !rectStart || !rectEnd) return false;
    
    const minX = Math.min(rectStart.x, rectEnd.x);
    const maxX = Math.max(rectStart.x, rectEnd.x);
    const minY = Math.min(rectStart.y, rectEnd.y);
    const maxY = Math.max(rectStart.y, rectEnd.y);
    
    return point.x >= minX && point.x <= maxX && 
           point.y >= minY && point.y <= maxY;
  },

  // 배열 깊은 복사
  deepCopy(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => this.deepCopy(item));
    if (typeof obj === 'object') {
      const copy = {};
      Object.keys(obj).forEach(key => {
        copy[key] = this.deepCopy(obj[key]);
      });
      return copy;
    }
  },

  // 숫자 포맷팅
  formatNumber(num, decimals = 2) {
    if (typeof num !== 'number' || isNaN(num)) return '0';
    return num.toFixed(decimals);
  },

  // 시간 포맷팅
  formatTime(date = new Date()) {
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  },

  // 파일명 생성
  generateFileName(prefix = 'measurement', extension = 'json') {
    const timestamp = new Date().toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .split('.')[0];
    
    return `${prefix}_${timestamp}.${extension}`;
  },

  // 디바운스 함수
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // 스로틀 함수
  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
} 