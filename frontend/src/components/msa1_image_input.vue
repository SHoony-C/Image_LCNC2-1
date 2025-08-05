<template>
  <div class="msa-component" :class="{ active: isActive }" @paste="handlePaste" tabindex="0">
    <div class="card-header">
      <div class="header-left">
        <i class="fas fa-cloud-upload-alt"></i>
        <span>Image Import Panel

</span>
      </div>
      <div class="status-badge" :class="status">
        {{ statusText }}
      </div>
    </div>
    <div class="content">
      <div class="title">이미지 입력</div>
      
      <div class="image-input-area" 
           @dragover.prevent 
           @drop.prevent="handleDrop"
           @click="triggerFileInput">
        <input 
          type="file" 
          ref="fileInput" 
          accept="image/*" 
          style="display: none" 
          @change="handleFileSelect"
        >
        <div v-if="!previewImage" class="paste-image-prompt">
          <div class="image-icon-wrapper">
            <i class="fas fa-cloud-upload-alt"></i>
            <i class="fas fa-image"></i>
          </div>
          <h3>이미지를 추가하세요</h3>
          <p>Ctrl+V로 붙여넣거나 이미지를 첨부하세요</p>
        </div>
        <div v-else class="preview-container">
          <img :src="previewImage" alt="Preview" class="preview-image">
          <button class="remove-btn" @click.stop="removeImage">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import LogService from '../utils/logService'

export default {
  name: 'MSA1ImageInput',
  data() {
    return {
      isActive: false,
      status: 'pending', // pending, processing, success, warning
      statusText: '대기중',
      previewImage: null,
      isProcessingImage: false
    }
  },
  mounted() {
    // 전역 포커스 상태에서도 이미지 붙여넣기를 처리할 수 있도록 리스너 등록
    document.addEventListener('paste', this.handlePaste);
    this.$refs.pasteArea.focus();
  },
  beforeUnmount() {
    document.removeEventListener('paste', this.handlePaste)
  },
  methods: {
    triggerFileInput() {
      if (!this.previewImage) {
        this.$refs.fileInput.click()
      }
    },
    handleFileSelect(event) {
      const file = event.target.files[0]
      if (file) {
        this.processImage(file)
      }
    },
    handleDrop(event) {
      const file = event.dataTransfer.files[0]
      if (file && file.type.startsWith('image/')) {
        this.processImage(file)
      }
    },
    handlePaste(event) {
      event.preventDefault();
      if (this.isProcessingImage) return;

      const clipboard = event.clipboardData || event.originalEvent.clipboardData;
      let file = null;
      if (clipboard.items) {
        for (const item of clipboard.items) {
          if (item.type.startsWith('image/')) {
            file = item.getAsFile();
            break;
          }
        }
      }
      if (!file && clipboard.files?.length) {
        const candidate = clipboard.files[0];
        if (candidate.type.startsWith('image/')) file = candidate;
      }
      if (!file) return;

      this.isProcessingImage = true;
      // processImage가 Promise라면 finally가 정상 동작
      this.processImage(file).finally(() => {
        this.isProcessingImage = false;
      });
    },
    processImage(file) {
      // Promise 반환
      return new Promise((resolve, reject) => {
        if (!(file && file.type.startsWith('image/'))) {
          resolve();
          return;
        }

        const reader = new FileReader();

        reader.onerror = (err) => {
          console.error('[MSA1] FileReader error:', err);
          reject(err);
        };

        reader.onload = async (e) => {
          try {
            // 1) 이미지 용량 체크 및 해상도 조정
            const processedImageData = await this.checkAndResizeImage(e.target.result, file.name);

            // 2) preview/status 업데이트
            this.previewImage  = processedImageData;
            this.status        = 'processing';
            this.statusText    = '유사 이미지 검색 중...';
            this.isActive      = true;

            // 3) 로그 저장
            LogService.logAction('upload_image', {
              filename: file.name,
              filesize: file.size,
              filetype: file.type
            });

            // 4) 유사 이미지 검색
            try {
              await this.searchSimilarImages(file.name, processedImageData);
              this.status     = 'success';
              this.statusText = '이미지 준비됨';
            } catch (err) {
              console.error('[MSA1] 유사 이미지 검색 실패:', err);
              this.status     = 'warning';
              this.statusText = '검색 실패';
            }

            // 5) MSA4, MSA5로 이벤트 발송
            document.dispatchEvent(new CustomEvent('msa1-to-msa4-image', {
              detail: { imageUrl: processedImageData, imageName: file.name }
            }));
            document.dispatchEvent(new CustomEvent('msa1-to-msa5-image', {
              detail: { imageUrl: processedImageData, imageName: file.name }
            }));

            resolve();
          } catch (err) {
            reject(err);
          }
        };

        reader.readAsDataURL(file);
      });
    },
    async searchSimilarImages(filename, imageUrl) {
      try {
        // console.log('[MSA1] 유사 이미지 검색 시작:', filename)
        
        // Base64 데이터 추출 (data:image/...;base64, 부분 제거)
        const base64Data = imageUrl.split(',')[1]
        
        // MSA2의 Base64 유사 이미지 검색 API 호출
        const response = await fetch('http://localhost:8000/api/imageprocess/similar-images-base64', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            image_data: base64Data,
            filename: filename
          })
        })
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data = await response.json()
        // console.log('[MSA1] Base64 유사 이미지 검색 결과:', data)
        
        if (data.status === 'success' && data.similar_images) {
          // 최유사 이미지를 msa2로 전송 (새로 추가)
          if (data.similar_images.length > 0) {
            const mostSimilar = data.similar_images.reduce((prev, current) => 
              (prev.similarity > current.similarity) ? prev : current
            );
            
            const msa2SimilarEvent = new CustomEvent('backend-to-msa2-similar-image', {
              detail: {
                filename: mostSimilar.filename,
                similarity: mostSimilar.similarity,
                source_image: filename,
                tag_type: mostSimilar.tag_type || 'Unknown',
                index: mostSimilar.index
              }
            });
            document.dispatchEvent(msa2SimilarEvent);
            // console.log('[MSA1] 최유사 이미지가 MSA2로 전송됨:', mostSimilar.filename);
          }
          
          // MSA2에 유사 이미지 데이터 전송 (벡터 플롯용)
          const msa2Event = new CustomEvent('msa1-to-msa2-similar-images', {
            detail: {
              mainImage: {
                filename: "temp_image_aaasd.png",
                url: imageUrl
              },
              similarImages: data.similar_images,
              uploadedVector: data.uploaded_vector || [],
              totalCompared: data.total_compared || 0
            }
          })
          document.dispatchEvent(msa2Event)
          // console.log('[MSA1] 유사 이미지 데이터가 MSA2로 전송됨')
          
          // MSA3에 유사 이미지 데이터 전송 (이미지 디스플레이용)
          // 원본 이미지와 동일한 파일명을 가진 이미지 필터링
          const filteredSimilarImages = data.similar_images.filter(img => {
            // 원본 이미지와 동일한 파일명인 경우 제외
            if (img.filename === filename) {
              console.log(`MSA1: 원본 이미지 제외: ${img.filename}`);
              return false;
            }
            
            // 파일명이 유사한 경우도 제외 (확장자 제외한 부분이 동일한 경우)
            const originalName = filename.split('.')[0];
            const similarName = img.filename.split('.')[0];
            if (originalName === similarName) {
              console.log(`MSA1: 원본 이미지와 유사한 파일명 제외: ${img.filename}`);
              return false;
            }
            
            return true;
          });
          
          console.log(`MSA1: 필터링 후 유사 이미지 수: ${filteredSimilarImages.length}개 (원본: ${data.similar_images.length}개)`);
          
          const msa3Event = new CustomEvent('msa1-to-msa3-similar-images', {
            detail: {
              mainImage: {
                filename: "temp_image_aaasd.png",
                url: imageUrl,
                fromMSA1: true
              },
              similarImages: filteredSimilarImages
            }
          })
          document.dispatchEvent(msa3Event)
          // console.log('[MSA1] 유사 이미지 데이터가 MSA3로 전송됨')
          
          // 로그 저장 - 유사 이미지 검색 성공
          LogService.logAction('similar_images_found', {
            filename: filename,
            similar_count: data.similar_images.length,
            total_compared: data.total_compared
          })
        } else {
          console.warn('[MSA1] 유사 이미지 검색 결과가 없습니다')
        }
      } catch (error) {
        console.error('[MSA1] 유사 이미지 검색 실패:', error)
        
        // 로그 저장 - 유사 이미지 검색 실패
        LogService.logAction('similar_images_error', {
          filename: filename,
          error: error.message
        })
        
        throw error
      }
    },
    removeImage() {
      this.previewImage = null
      this.status = 'pending'
      this.statusText = '대기중'
      this.isActive = false
      this.$refs.fileInput.value = ''
    },
    // 이미지 용량 체크 및 해상도 조정 함수 추가
    async checkAndResizeImage(imageDataUrl, filename) {
      try {
        this.statusText = '이미지 용량 최적화 중...'
        // ─── 1) Data URL → Blob ─────────────────────────────────
        const [header, base64] = imageDataUrl.split(',')
        const mime = header.match(/data:(image\/[^;]+);base64/)[1]
        const bin = atob(base64.replace(/\s/g, ''))
        const arr = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
        const blob = new Blob([arr], { type: mime })

        // ─── 2) 서버에 업로드 & 변환 ───────────────────────────────
        const form = new FormData()
        form.append('file', blob, filename)
        const resp = await fetch('http://localhost:8000/api/msa1/upload', {
          method: 'POST',
          body: form,
        })
        if (!resp.ok) throw new Error(`변환 API 실패: ${resp.status}`)
        const convertedBlob = await resp.blob()

        // ─── 3) 변환된 Blob → Data URL ────────────────────────────
        const convertedDataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload  = () => resolve(reader.result)
          reader.onerror = () => reject(new Error('FileReader 실패'))
          reader.readAsDataURL(convertedBlob)
        })

        // 이제 convertedDataUrl은 PNG/JPEG로 변환된 Data URL입니다.
        imageDataUrl = convertedDataUrl
        // console.log('[MSA1] 서버 변환 후 Data URL 헤더:', imageDataUrl.slice(0,30))

        // ─── 4) 기존 용량 체크 & 리사이즈 로직 ─────────────────────
        const sizeInBytes = (imageDataUrl.split(',')[1].length * 3) / 4
        const sizeInMB    = sizeInBytes / (1024 * 1024)
        // console.log(`[MSA1] 이미지 용량: ${sizeInMB.toFixed(2)}MB`)

        // 1MB 미만
        if (sizeInMB < 1) {
          // console.log('[MSA1] 1MB 미만, 압축 생략')
          return imageDataUrl
        }

        // 1MB 이상
        this.statusText = '이미지 용량 최적화 중...'
        const maxSizeMB       = 0.8
        const compressionLevel = 'minimum'
        const resized = await this.resizeImage(imageDataUrl, maxSizeMB, compressionLevel)
        // console.log('[MSA1] resizeImage 완료')
        return resized

      } catch (err) {
        console.error('[checkAndResizeImage] 에러 발생', err)
        // 실패 시 원본 그대로 반환
        return imageDataUrl
      }
  },
    
    // 이미지 해상도 조정 함수
    async resizeImage(imageDataUrl, targetSizeMB, compressionLevel) {
      return new Promise((resolve) => {
        const img = new Image()
        img.onload = () => {
          //console.log('진입1')
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')

          //console.log('진입2')
          
          // 압축 레벨에 따른 설정
          let scaleFactor, initialQuality, minQuality, minDimension
          
          switch (compressionLevel) {
            case 'aggressive':
              // 10MB 이상: 매우 강한 압축
              scaleFactor = Math.sqrt(targetSizeMB / (this.getImageSizeFromDataUrl(imageDataUrl) / (1024 * 1024))) * 0.7
              initialQuality = 0.6
              minQuality = 0.2
              minDimension = 200
              break
            case 'medium':
              // 5MB 이상: 중간 압축
              scaleFactor = Math.sqrt(targetSizeMB / (this.getImageSizeFromDataUrl(imageDataUrl) / (1024 * 1024))) * 0.8
              initialQuality = 0.7
              minQuality = 0.3
              minDimension = 250
              break
            case 'light':
              // 2MB 이상: 미니 압축
              scaleFactor = Math.sqrt(targetSizeMB / (this.getImageSizeFromDataUrl(imageDataUrl) / (1024 * 1024))) * 0.8
              initialQuality = 0.8
              minQuality = 0.4
              minDimension = 300
              break
            case 'minimum':
            default:
              // 1MB 이상: 최소화 압축
              scaleFactor = Math.sqrt(targetSizeMB / (this.getImageSizeFromDataUrl(imageDataUrl) / (1024 * 1024))) * 0.9
              initialQuality = 0.85
              minQuality = 0.7
              minDimension = 300
              break
          }

          //console.log('a')
          
          scaleFactor = Math.min(scaleFactor, 1) // 확대는 하지 않음
          
          let newWidth = Math.floor(img.width * scaleFactor)
          let newHeight = Math.floor(img.height * scaleFactor)
          
          // 최소 크기 보장 (너무 작아지지 않도록)
          if (newWidth < minDimension && newHeight < minDimension) {
            const ratio = Math.max(minDimension / newWidth, minDimension / newHeight)
            newWidth = Math.floor(newWidth * ratio)
            newHeight = Math.floor(newHeight * ratio)
          }

          //console.log('b')
          
          canvas.width = newWidth
          canvas.height = newHeight
          
          // 이미지 그리기
          ctx.drawImage(img, 0, 0, newWidth, newHeight)
          
          // JPEG로 압축 (품질 조정)
          let quality = initialQuality
          let result = canvas.toDataURL('image/jpeg', quality)
          
          // 여전히 크다면 품질을 더 낮춤
          while (this.getImageSizeFromDataUrl(result) > targetSizeMB * 1024 * 1024 && quality > minQuality) {
            quality -= 0.1
            result = canvas.toDataURL('image/jpeg', quality)
          }
          //console.log('c')
          
          //console.log(`[MSA1] 리사이즈 완료: ${img.width}x${img.height} → ${newWidth}x${newHeight}, 품질: ${(quality * 100).toFixed(0)}%`)
          
          resolve(result)
        }
        img.onerror = (e) => {
          console.error('[resizeImage] 이미지 로딩 실패 ❌', e)
          console.error('imageDataUrl 길이:', imageDataUrl?.length)
          console.error('imageDataUrl 시작:', imageDataUrl?.slice?.(0, 50))
          resolve(imageDataUrl)  // 또는 reject(e)로 실패 처리
        }
        img.src = imageDataUrl
      })
    },

    async convertToPng(imageDataUrl) {
      console.log('--- convertToPng(Debug + createImageBitmap) 시작 ---')

      try {
        // 1) Data URL → Blob (fetch 사용)
        console.log('[1] fetch dataURL → blob 시작')
        const resp = await fetch(imageDataUrl)
        console.log('[1] fetch 완료:', resp.status, resp.statusText)
        if (!resp.ok) throw new Error(`Fetch failed ${resp.status}`)
        const blob = await resp.blob()
        console.log('[1] blob:', blob.type, blob.size, 'bytes')

        // 2) Blob → ArrayBuffer → magic bytes 확인
        const ab = await blob.arrayBuffer()
        const header = new Uint8Array(ab.slice(0, 4))
        console.log('[2] magic bytes:', header.map(b=>b.toString(16).padStart(2,'0')).join(' '))
        // JPEG 시작이면 ff d8 ff e0, PNG 시작이면 89 50 4e 47 여야 함

        // 3) createImageBitmap 으로 디코딩
        console.log('[3] createImageBitmap 시작')
        const bitmap = await createImageBitmap(blob)
        console.log('[3] createImageBitmap 완료:', bitmap.width, 'x', bitmap.height)

        // 4) canvas → PNG Data URL
        const canvas = document.createElement('canvas')
        canvas.width  = bitmap.width
        canvas.height = bitmap.height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(bitmap, 0, 0)
        const pngDataUrl = canvas.toDataURL('image/png')
        console.log('[4] PNG Data URL 생성, 길이:', pngDataUrl.length)

        console.log('--- convertToPng 완료 ---')
        return pngDataUrl

      } catch (err) {
        console.error('[convertToPng] 단계별 오류 발생 ❌', err)
        return imageDataUrl
      }
    }
    ,
      // 이미지 데이터 URL에서 파일 크기 계산
      getImageSizeFromDataUrl(dataUrl) {
        const base64Data = dataUrl.split(',')[1]
        return (base64Data.length * 3) / 4
      },
    }
}
</script>

<style scoped>
.msa-component {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  height: 100%;
  transition: all 0.3s ease;
  border: 1px solid rgba(124, 58, 237, 0.1);
  box-shadow: 
    0 4px 6px -1px rgba(0, 0, 0, 0.05),
    0 2px 4px -1px rgba(0, 0, 0, 0.03);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.msa-component:hover {
  box-shadow: 
    0 10px 15px -3px rgba(124, 58, 237, 0.1),
    0 4px 6px -2px rgba(124, 58, 237, 0.05);
  border-color: rgba(124, 58, 237, 0.3);
}

.msa-component.active {
  background: rgba(124, 58, 237, 0.03);
  border-color: rgba(124, 58, 237, 0.5);
  box-shadow: 
    0 0 0 3px rgba(124, 58, 237, 0.1),
    0 10px 15px -3px rgba(124, 58, 237, 0.1),
    0 4px 6px -2px rgba(124, 58, 237, 0.05);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #6c5ce7;
  color: white;
  padding: 12px 16px;
  height: 30px !important;
  min-height: 30px;
  max-height: 30px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px 8px 0 0;
  flex: 0 0 48px;
  flex-shrink: 0;
  flex-grow: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.header-left i {
  font-size: 1rem;
  color: white;
}

.header-left span {
  font-size: 0.7rem;
  font-weight: 600;
  color: white;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.675rem;
  font-weight: 500;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.status-badge.pending {
  background-color: rgba(255, 255, 255, 0.2);
  color: white;
  border-color: rgba(255, 255, 255, 0.4);
}

.status-badge.processing {
  background-color: rgba(59, 130, 246, 0.8);
  color: white;
  border-color: rgba(59, 130, 246, 1);
}

.status-badge.success {
  background-color: rgba(16, 185, 129, 0.8);
  color: white;
  border-color: rgba(16, 185, 129, 1);
}

.status-badge.warning {
  background-color: rgba(245, 158, 11, 0.8);
  color: white;
  border-color: rgba(245, 158, 11, 1);
}

.content {
  text-align: left;
  padding: 1.5rem;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.title {
  font-weight: 600;
  color: #6d28d9;
  margin-bottom: 0.5rem;
  font-size: 1.1rem;
}

.description {
  color: #6b7280;
  font-size: 0.95rem;
  line-height: 1.5;
}

.image-input-area {
  margin-top: 1rem;
  border: 2px dashed rgba(124, 58, 237, 0.3);
  border-radius: 12px;
  padding: 1rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  min-height: 170px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-input-area:hover {
  border-color: rgba(124, 58, 237, 0.5);
  background: rgba(124, 58, 237, 0.02);
}

.upload-placeholder {
  color: #6b7280;
}

.upload-placeholder i {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  color: rgba(124, 58, 237, 0.5);
}

.upload-placeholder p {
  margin: 0.5rem 0;
}

.sub-text {
  font-size: 0.9rem;
  color: #9ca3af;
}

.preview-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 170px;
}

.preview-image {
  max-width: 100%;
  max-height: 170px;
  object-fit: contain;
  border-radius: 8px;
}

.remove-btn {
  position: absolute;
  top: -0.5rem;
  right: -0.5rem;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.remove-btn:hover {
  background: #dc2626;
  transform: scale(1.1);
}

.paste-image-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10px;
  background: linear-gradient(135deg, #f5f7fa, #e4edf9);
  border-radius: 12px;
  border: 2px dashed #c3d0e6;
  text-align: center;
  transition: all 0.3s ease;
  cursor: pointer;
}

.paste-image-prompt:hover {
  border-color: #8b5cf6;
  box-shadow: 0 5px 15px rgba(139, 92, 246, 0.15);
  transform: translateY(-2px);
}

.image-icon-wrapper {
  position: relative;
  margin-bottom: 20px;
}

.image-icon-wrapper i.fa-cloud-upload-alt {
  font-size: 42px;
  color: #8b5cf6;
  margin-bottom: 10px;
}

.image-icon-wrapper i.fa-image {
  position: absolute;
  bottom: -5px;
  right: -10px;
  font-size: 24px;
  color: #4ade80;
  background: white;
  padding: 5px;
  border-radius: 50%;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}

.paste-image-prompt h3 {
  font-size: 20px;
  font-weight: 600;
  color: #4b5563;
  margin: 0 0 8px 0;
}

.paste-image-prompt p {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}
</style> 
