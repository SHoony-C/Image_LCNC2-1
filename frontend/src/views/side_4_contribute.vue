<template>
  <div class="contribute-view">
    <AppHeader pageTitle="Contribute" />
    
    <div class="contribute-content">
      <div class="contribute-section">
        <h2>How to Contribute</h2>
        <p>Welcome to our community! Here are several ways you can contribute:</p>
        
        <div class="contribute-cards">
          <div class="contribute-card">
            <div class="card-icon">
              <i class="fas fa-image"></i>
            </div>
            <h3>대표 이미지 추가</h3>
            <p>분석 및 주요 연구 대상인 분석 이미지를 업로드하고 공유하세요.</p>
          </div>
          
          <div class="contribute-card">
            <div class="card-icon">
              <i class="fas fa-chart-bar"></i>
            </div>
            <h3>분석 결과 내용 공유</h3>
            <p>이미지 분석 결과와 인사이트를 사용자들과 공유하여 함께 성장하세요.</p>
          </div>
          
          <div class="contribute-card">
            <div class="card-icon">
              <i class="fas fa-cogs"></i>
            </div>
            <h3>Image 전처리 Process 공유</h3>
            <p>효과적인 이미지 전처리 방법과 워크플로우를 공유하여 모두의 R&D 효율성을 높여가요.</p>
          </div>
        </div>
      </div>
      
      <div class="contribute-section">
        <h2>Why Join? (참여 혜택)</h2>
        <ul class="guidelines-list">
          <li>최신 분석 기법과 전처리 노하우를 빠르게 습득</li>
          <li>여러 제품에서 발생한, 이미 분석이 완료된 불량 사례 이미지와 결과를 공유받아 학습 가능</li>
          <li>다양한 분석 워크플로우와 자동화 프로세스 예시를 참고하여 바로 적용 가능</li>
          <li>다른 연구자의 분석 방법과 비교·검토를 통해 새로운 인사이트 도출</li>
          <li>희귀 불량 사례와 고난도 분석 결과에 접근하여 R&D 경쟁력 강화</li>
          <li>데이터 기반의 의사결정을 위한 벤치마크 자료 확보</li>
          <li>이미지 분석과 전처리 과정에서 발생하는 문제 해결 노하우 공유</li>
        </ul>
      </div>
      
      <div class="contribute-section">
        <h2>분석 결과 공유</h2>
        <p>분석 결과와 노하우를 공유하여 I-TAP과  함께 성장해보세요.</p>
        
        <div class="action-buttons">
          <button class="action-btn primary" @click="showSharePopup = true">
            <i class="fas fa-upload"></i>
            분석 결과 공유
          </button>
          <button class="action-btn secondary" @click="showFeedbackForm = true">
            <i class="fas fa-share-alt"></i>
            Workflow 공유하는 법 알아보기
          </button>
        </div>
      </div>
    </div>

    <!-- 분석 결과 공유 팝업 -->
    <div v-if="showSharePopup" class="popup-overlay" @click="closePopup">
      <div class="popup-content" @click.stop>
        <div class="popup-header">
          <h3>분석 결과 공유</h3>
          <button class="close-btn" @click="closePopup">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div class="popup-body">
          <div class="analysis-title-section">
            <h4>분석 제목</h4>
            <input 
              v-model="analysisTitle" 
              type="text" 
              placeholder="분석 제목을 입력해주세요..."
              class="analysis-title-input"
              :disabled="isSubmitting"
            >
          </div>
          
          <div class="image-upload-section">
            <div class="upload-area">
              <h4>대상 이미지</h4>
              <div class="image-input-area" 
                   @dragover.prevent 
                   @drop.prevent="handleDrop"
                   @click="triggerFileInput('target')"
                   @paste="handlePaste"
                   @focus="currentUploadType = 'target'"
                   tabindex="0"
                   :class="{ 'disabled': isSubmitting }">
                <input 
                  type="file" 
                  ref="targetFileInput" 
                  accept="image/*" 
                  style="display: none" 
                  @change="handleFileSelect"
                  :disabled="isSubmitting"
                >
                <div v-if="!targetImage" class="paste-image-prompt" @paste="handlePaste">
                  <div class="image-icon-wrapper">
                    <i class="fas fa-cloud-upload-alt"></i>
                    <i class="fas fa-image"></i>
                  </div>
                  <h3>대상 이미지를 추가하세요</h3>
                  <p>클릭하거나 Ctrl+V로 붙여넣거나 이미지를 첨부하세요</p>
                </div>
                <div v-else class="preview-container">
                  <img :src="targetImage" alt="Target Preview" class="preview-image">
                  <button class="remove-btn" @click.stop="removeImage('target')" :disabled="isSubmitting">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
              </div>
            </div>
            
            <div class="upload-area">
              <h4>분석 결과 이미지</h4>
              <div class="image-input-area" 
                   @dragover.prevent 
                   @drop.prevent="handleDrop"
                   @click="triggerFileInput('result')"
                   @paste="handlePaste"
                   @focus="currentUploadType = 'result'"
                   tabindex="0"
                   :class="{ 'disabled': isSubmitting }">
                <input 
                  type="file" 
                  ref="resultFileInput" 
                  accept="image/*" 
                  style="display: none" 
                  @change="handleFileSelect"
                  :disabled="isSubmitting"
                >
                <div v-if="!resultImage" class="paste-image-prompt" @paste="handlePaste">
                  <div class="image-icon-wrapper">
                    <i class="fas fa-cloud-upload-alt"></i>
                    <i class="fas fa-image"></i>
                  </div>
                  <h3>분석 결과 이미지를 추가하세요</h3>
                  <p>클릭하거나 Ctrl+V로 붙여넣거나 이미지를 첨부하세요</p>
                </div>
                <div v-else class="preview-container">
                  <img :src="resultImage" alt="Result Preview" class="preview-image">
                  <button class="remove-btn" @click.stop="removeImage('result')" :disabled="isSubmitting">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <div class="analysis-content-section">
            <h4>분석 결과 내용 공유</h4>
            <textarea 
              v-model="analysisContent" 
              placeholder="분석 과정, 결과, 인사이트 등을 자세히 작성해주세요..."
              rows="6"
              class="analysis-textarea"
              :disabled="isSubmitting"
            ></textarea>
          </div>
        </div>
        
        <div class="popup-footer">
          <button class="submit-btn" @click="submitAnalysis" :disabled="!canSubmit || isSubmitting">
            <i v-if="!isSubmitting" class="fas fa-paper-plane"></i>
            <i v-else class="fas fa-spinner fa-spin"></i>
            {{ isSubmitting ? '저장 중...' : '분석 결과 공유하기' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import AppHeader from '@/components/AppHeader.vue'

export default {
  name: 'ContributeView',
  components: {
    AppHeader
  },
  data() {
    return {
      showFeedbackForm: false,
      showSharePopup: false,
      targetImage: null,
      resultImage: null,
      analysisContent: '',
      analysisTitle: '',
      currentUploadType: null,
      isSubmitting: false
    }
  },
  computed: {
    canSubmit() {
      return this.targetImage && this.resultImage && this.analysisTitle.trim() && this.analysisContent.trim();
    }
  },
  mounted() {
    // 전역 paste 이벤트 리스너 등록
    document.addEventListener('paste', this.handlePaste);
    console.log('Paste event listener registered');
  },
  beforeUnmount() {
    document.removeEventListener('paste', this.handlePaste);
  },
  methods: {
    navigateToMain() {
      this.$router.push('/main');
    },
    closePopup() {
      this.showSharePopup = false;
      this.resetForm();
    },
    resetForm() {
      this.targetImage = null;
      this.resultImage = null;
      this.analysisContent = '';
      this.analysisTitle = '';
      this.currentUploadType = null;
    },
    triggerFileInput(type) {
      this.currentUploadType = type;
      if (type === 'target') {
        this.$refs.targetFileInput.click();
      } else {
        this.$refs.resultFileInput.click();
      }
    },
    handleFileSelect(event) {
      const file = event.target.files[0];
      if (file) {
        this.processImage(file);
      }
    },
    handleDrop(event) {
      if (this.isSubmitting) return; // 로딩 중일 때 비활성화
      
      const file = event.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        // 드롭된 요소가 어느 업로드 영역인지 확인
        const uploadArea = event.target.closest('.upload-area');
        if (uploadArea) {
          const isTarget = uploadArea.querySelector('h4').textContent === '대상 이미지';
          this.currentUploadType = isTarget ? 'target' : 'result';
        }
        this.processImage(file);
      }
    },
    handlePaste(event) {
      if (this.isSubmitting) return; // 로딩 중일 때 비활성화
      
      console.log('Paste event triggered');
      event.preventDefault();
      
      const clipboard = event.clipboardData || event.originalEvent.clipboardData;
      if (!clipboard) {
        console.log('No clipboard data available');
        return;
      }
      
      console.log('Clipboard items:', clipboard.items);
      console.log('Clipboard files:', clipboard.files);
      
      let file = null;
      
      // clipboard.items를 통한 이미지 파일 확인
      if (clipboard.items) {
        for (let i = 0; i < clipboard.items.length; i++) {
          const item = clipboard.items[i];
          console.log('Clipboard item:', item.type);
          if (item.type.startsWith('image/')) {
            file = item.getAsFile();
            console.log('Found image file from items:', file);
            break;
          }
        }
      }
      
      // clipboard.files를 통한 이미지 파일 확인
      if (!file && clipboard.files && clipboard.files.length > 0) {
        for (let i = 0; i < clipboard.files.length; i++) {
          const candidate = clipboard.files[i];
          console.log('Checking file:', candidate.name, candidate.type);
          if (candidate.type.startsWith('image/')) {
            file = candidate;
            console.log('Found image file from files:', file);
            break;
          }
        }
      }
      
      if (file) {
        console.log('Processing pasted file:', file.name, file.type);
        
        // 현재 활성화된 업로드 영역 찾기
        let uploadArea = null;
        
        // 1. 현재 포커스된 요소에서 찾기
        const activeElement = document.activeElement;
        if (activeElement && activeElement.closest) {
          uploadArea = activeElement.closest('.upload-area');
          console.log('Found upload area from active element:', uploadArea);
        }
        
        // 2. 이벤트 타겟에서 찾기
        if (!uploadArea && event.target && event.target.closest) {
          uploadArea = event.target.closest('.upload-area');
          console.log('Found upload area from event target:', uploadArea);
        }
        
        // 3. 이벤트 경로에서 찾기
        if (!uploadArea && event.composedPath) {
          for (const pathElement of event.composedPath()) {
            if (pathElement.classList && pathElement.classList.contains('upload-area')) {
              uploadArea = pathElement;
              console.log('Found upload area from composed path:', uploadArea);
              break;
            }
          }
        }
        
        // 4. 팝업이 열려있고 특정 영역이 포커스되지 않은 경우, 기본값으로 target 설정
        if (!uploadArea && this.showSharePopup) {
          console.log('No specific upload area found, defaulting to target');
          this.currentUploadType = 'target';
        } else if (uploadArea) {
          const title = uploadArea.querySelector('h4');
          if (title) {
            const isTarget = title.textContent === '대상 이미지';
            this.currentUploadType = isTarget ? 'target' : 'result';
            console.log('Set upload type to:', this.currentUploadType);
          }
        }
        
        // 이미지 처리
        this.processImage(file);
      } else {
        console.log('No valid image file found in clipboard');
      }
    },
    async processImage(file) {
      console.log('processImage called with file:', file.name, file.type, file.size);
      
      if (!(file && file.type.startsWith('image/'))) {
        console.log('Invalid file type or no file');
        return;
      }

      try {
        console.log('Starting image processing...');
        // msa1의 이미지 처리 방식과 동일하게 구현
        const processedImageData = await this.checkAndResizeImage(file);
        console.log('Image processing completed, result:', processedImageData ? 'success' : 'failed');
        
        if (this.currentUploadType === 'target') {
          console.log('Setting target image');
          this.targetImage = processedImageData;
          console.log('Target image set:', this.targetImage ? 'success' : 'failed');
        } else if (this.currentUploadType === 'result') {
          console.log('Setting result image');
          this.resultImage = processedImageData;
          console.log('Result image set:', this.resultImage ? 'success' : 'failed');
        } else {
          console.log('No upload type set, currentUploadType:', this.currentUploadType);
        }
        
      } catch (error) {
        console.error('이미지 처리 실패:', error);
        alert('이미지 처리에 실패했습니다.');
      }
    },
    async checkAndResizeImage(file) {
      console.log('checkAndResizeImage called with file:', file.name);
      // msa1의 checkAndResizeImage 함수와 동일한 로직
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onerror = (err) => {
          console.error('FileReader error:', err);
          reject(err);
        };
        
        reader.onload = async (e) => {
          try {
            console.log('FileReader completed, starting uploadAndProcessImage');
            // 1) 이미지 용량 체크 및 해상도 조정
            const processedImageData = await this.uploadAndProcessImage(e.target.result, file.name);
            console.log('uploadAndProcessImage completed, result length:', processedImageData ? processedImageData.length : 0);
            resolve(processedImageData);
          } catch (err) {
            console.error('Error in reader.onload:', err);
            reject(err);
          }
        };
        
        console.log('Starting FileReader.readAsDataURL');
        reader.readAsDataURL(file);
      });
    },
    async uploadAndProcessImage(imageDataUrl, filename) {
      console.log('uploadAndProcessImage called with filename:', filename);
      try {
        // 1) Data URL → Blob
        const [header, base64] = imageDataUrl.split(',');
        const mime = header.match(/data:(image\/[^;]+);base64/)[1];
        const bin = atob(base64.replace(/\s/g, ''));
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        const blob = new Blob([arr], { type: mime });
        
        console.log('Created blob:', blob.size, 'bytes, type:', blob.type);

        // 2) 서버에 업로드 & 변환 (msa1 API 사용)
        const form = new FormData();
        form.append('file', blob, filename);
        console.log('Sending to msa1 API...');
        
        const resp = await fetch('http://localhost:8000/api/msa1/upload', {
          method: 'POST',
          body: form,
        });
        
        if (!resp.ok) {
          const errorText = await resp.text();
          console.error('msa1 API failed:', resp.status, errorText);
          throw new Error(`변환 API 실패: ${resp.status}`);
        }
        
        const convertedBlob = await resp.blob();
        console.log('Received converted blob:', convertedBlob.size, 'bytes, type:', convertedBlob.type);

        // 3) 변환된 Blob → Data URL
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            console.log('Converted to Data URL, length:', e.target.result.length);
            resolve(e.target.result);
          };
          reader.readAsDataURL(convertedBlob);
        });
        
      } catch (error) {
        console.error('이미지 업로드 및 변환 실패:', error);
        throw error;
      }
    },
    removeImage(type) {
      if (type === 'target') {
        this.targetImage = null;
      } else if (type === 'result') {
        this.resultImage = null;
      }
    },
    async submitAnalysis() {
      if (!this.canSubmit) {
        alert('모든 필드를 입력해주세요.');
        return;
      }
      
      this.isSubmitting = true; // 로딩 상태 시작
      try {
        // FormData 생성
        const formData = new FormData();
        formData.append('analysis_title', this.analysisTitle);
        formData.append('target_image', this.targetImage);
        formData.append('result_image', this.resultImage);
        formData.append('analysis_content', this.analysisContent);
        
        // 백엔드 API 호출
        const response = await fetch('http://localhost:8000/api/contribute/submit-analysis', {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          const errorMessage = errorData.detail || 'API 호출에 실패했습니다.';
          
          // 중복 파일 오류인지 확인 (더 정확한 검사)
          if (errorMessage.includes('이미 존재합니다') || errorMessage.includes('다음 파일들이 이미 존재합니다')) {
            // 백엔드 메시지에서 분석 제목 부분만 추출
            const titleMatch = errorMessage.match(/분석 제목 '([^']+)'/);
            if (titleMatch) {
              const title = titleMatch[1];
              alert(`파일 중복 오류: 분석 제목 '${title}'을 다른 이름으로 변경해주세요.`);
            } else {
              alert(`파일 중복 오류: ${errorMessage}`);
            }
          } else {
            throw new Error(errorMessage);
          }
          return; // 오류 발생 시 여기서 종료 (팝업 유지)
        }
        
        const result = await response.json();
        
        // 성공 메시지 표시
        alert('분석 결과가 성공적으로 공유되었습니다!');
        console.log('저장된 파일들:', result.files);
        this.closePopup(); // 성공했을 때만 팝업 닫기
        
      } catch (error) {
        console.error('분석 결과 제출 실패:', error);
        alert(`분석 결과 제출에 실패했습니다: ${error.message}`);
        // catch 블록에서는 팝업을 닫지 않음 (오류 시 팝업 유지)
      } finally {
        this.isSubmitting = false; // 로딩 상태 종료
      }
    }
  }
}
</script>

<style scoped>
.contribute-view {
  background: var(--primary-50);
  min-height: calc(100vh - 70px);
  height: 100%;
  width: calc(100% - 250px);
  margin-left: 250px;
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow-y: auto;
}

.contribute-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  flex: 1;
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.contribute-section {
  background: white;
  border-radius: 1rem;
  padding: 2rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.contribute-section h2 {
  color: var(--primary-700);
  margin-bottom: 1rem;
  font-size: 1.5rem;
  font-weight: 600;
}

.contribute-section p {
  color: var(--gray-700);
  line-height: 1.6;
  margin-bottom: 1.5rem;
}

.contribute-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin: 2rem 0;
}

.contribute-card {
  background: var(--primary-50);
  padding: 2rem;
  border-radius: 12px;
  text-align: center;
  border: 1px solid var(--primary-100);
  transition: all 0.3s ease;
}

.contribute-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.card-icon {
  width: 60px;
  height: 60px;
  background: var(--primary-600);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1rem;
}

.card-icon i {
  font-size: 1.5rem;
  color: white;
}

.contribute-card h3 {
  color: var(--primary-700);
  margin-bottom: 1rem;
  font-size: 1.2rem;
  font-weight: 600;
}

.contribute-card p {
  color: var(--gray-600);
  font-size: 0.95rem;
  line-height: 1.5;
}

.guidelines-list {
  list-style: none;
  padding: 0;
}

.guidelines-list li {
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--gray-200);
  color: var(--gray-700);
  position: relative;
  padding-left: 1.5rem;
}

.guidelines-list li:before {
  content: "✓";
  color: var(--primary-600);
  font-weight: bold;
  position: absolute;
  left: 0;
}

.guidelines-list li:last-child {
  border-bottom: none;
}

.action-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.action-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.3s ease;
  text-decoration: none;
  font-weight: 600;
}

.action-btn.primary {
  background: var(--primary-600);
  color: white;
}

.action-btn.primary:hover {
  background: var(--primary-700);
  transform: translateY(-2px);
}

.action-btn.secondary {
  background: var(--gray-100);
  color: var(--gray-700);
  border: 1px solid var(--gray-300);
}

.action-btn.secondary:hover {
  background: var(--gray-200);
  transform: translateY(-2px);
}

@media (max-width: 1200px) {
  .contribute-view {
    width: 100%;
    margin-left: 0;
  }
}

@media (max-width: 768px) {
  .contribute-content {
    padding: 1rem;
  }
  
  .contribute-cards {
    grid-template-columns: 1fr;
  }
  
  .action-buttons {
    flex-direction: column;
    align-items: center;
  }
  
  .action-btn {
    width: 100%;
    max-width: 300px;
    justify-content: center;
  }
}

/* 팝업 스타일 */
.popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.popup-content {
  padding:10px !important;
  background: white;
  border-radius: 1rem;
  width: 100%;
  max-width: 1200px;
  max-height: 90vh;
  overflow-y: auto;
  overflow-x: hidden;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 0.75rem 2rem;
  border-bottom: 1px solid var(--gray-200);
  min-height: auto;
  height: auto;
  flex-direction: row;
}

.popup-header h3 {
  color: var(--primary-700);
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
  line-height: 1.2;
  display: inline-block;
  vertical-align: baseline;
  padding: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1rem;
  color: var(--gray-500);
  cursor: pointer;
  padding: 0.4rem;
  border-radius: 0.5rem;
  transition: all 0.2s ease;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin: 0;
  line-height: 1;
  vertical-align: baseline;
  position: relative;
  top: 0;
  right: 0 !important; 
}

.close-btn:hover {
  background: var(--gray-100);
  color: var(--gray-700);
}

.popup-body {
  padding: 2rem;
}

.analysis-title-section {
  margin-bottom: 2rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.analysis-title-section h4 {
  color: var(--primary-700);
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  min-width: 120px;
  flex-shrink: 0;
}

.analysis-title-input {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 2px solid var(--gray-200);
  border-radius: 8px;
  font-size: 1rem;
  line-height: 1.5;
  transition: border-color 0.2s ease;
  font-family: inherit;
}

.analysis-title-input:focus {
  outline: none;
  border-color: var(--primary-500);
}

.analysis-title-input::placeholder {
  color: var(--gray-400);
}

.image-upload-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-bottom: 2rem;
  align-items: start;
  width: 100%;
  box-sizing: border-box;
}

.upload-area {
  border: 2px solid var(--primary-200);
  border-radius: 16px;
  padding: 1.5rem;
  background: var(--primary-25);
  transition: all 0.3s ease;
  min-height: 300px;
  width: 100%;
  box-sizing: border-box;
  flex-shrink: 0;
  overflow: hidden;
}

.upload-area:hover {
  border-color: var(--primary-300);
  background: var(--primary-50);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.1);
}

.upload-area h4 {
  color: var(--primary-700);
  margin-bottom: 1rem;
  font-size: 1.1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.upload-area h4::after {
  content: '👆';
  font-size: 0.9rem;
  opacity: 0.7;
  animation: bounce 2s infinite;
}

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-5px);
  }
  60% {
    transform: translateY(-3px);
  }
}

.image-input-area {
  border: 2px dashed var(--primary-300);
  border-radius: 12px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: var(--primary-50);
  min-height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  user-select: none;
  overflow: hidden;
  width: 100%;
  box-sizing: border-box;
  max-width: 100%;
}

.image-input-area:hover {
  border-color: var(--primary-500);
  background: var(--primary-100);
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

.image-input-area:active {
  transform: translateY(0);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.image-input-area:focus {
  outline: none;
  border-color: var(--primary-600);
  background: var(--primary-100);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.image-input-area:focus-within {
  border-color: var(--primary-600);
  background: var(--primary-100);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* 포커스 힌트 추가 */
.image-input-area:focus::after {
  content: 'Ctrl+V로 이미지 붙여넣기 가능';
  position: absolute;
  bottom: -25px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--primary-600);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  white-space: nowrap;
  z-index: 10;
}

/* 비활성화 상태 스타일 */
.image-input-area.disabled {
  opacity: 0.6;
  cursor: not-allowed;
  pointer-events: none;
}

.image-input-area.disabled:hover {
  border-color: var(--primary-300);
  background: var(--primary-50);
  transform: none;
  box-shadow: none;
}

.image-input-area.disabled:focus::after {
  display: none;
}

/* 비활성화된 입력 필드 스타일 */
.analysis-title-input:disabled,
.analysis-textarea:disabled {
  background-color: var(--gray-100);
  color: var(--gray-500);
  cursor: not-allowed;
}

/* 비활성화된 제거 버튼 스타일 */
.remove-btn:disabled {
  background: var(--gray-400);
  cursor: not-allowed;
  transform: none;
}

.remove-btn:disabled:hover {
  background: var(--gray-400);
  transform: none;
}

.paste-image-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  width: 100%;
  height: 100%;
  justify-content: center;
  pointer-events: none;
}

.image-icon-wrapper {
  position: relative;
  width: 80px;
  height: 80px;
  opacity: 0.8;
  transition: opacity 0.3s ease;
}

.image-input-area:hover .image-icon-wrapper {
  opacity: 1;
}

.image-icon-wrapper i:first-child {
  position: absolute;
  top: 0;
  left: 0;
  font-size: 2.5rem;
  color: var(--primary-400);
}

.image-icon-wrapper i:last-child {
  position: absolute;
  top: 12px;
  left: 12px;
  font-size: 2rem;
  color: var(--primary-600);
}

/* 클릭 가능함을 나타내는 추가 시각적 요소 */
.image-input-area::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, transparent 0%, rgba(59, 130, 246, 0.05) 100%);
  border-radius: 12px;
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.image-input-area:hover::before {
  opacity: 1;
}

/* 클릭 힌트 텍스트 스타일 개선 */
.paste-image-prompt p {
  color: var(--gray-600);
  margin: 0;
  font-size: 1rem;
  text-align: center;
  max-width: 200px;
  line-height: 1.4;
  font-weight: 500;
}

.preview-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  max-width: 100%;
  box-sizing: border-box;
}

.preview-image {
  max-width: 100%;
  max-height: 240px;
  width: auto;
  height: auto;
  border-radius: 8px;
  object-fit: contain;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  display: block;
  flex-shrink: 0;
  box-sizing: border-box;
}

.remove-btn {
  position: absolute;
  top: -10px;
  right: -10px;
  background: var(--red-500);
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.2s ease;
}

.remove-btn:hover {
  background: var(--red-600);
  transform: scale(1.1);
}

.analysis-content-section {
  margin-top: 2rem;
}

.analysis-content-section h4 {
  color: var(--primary-700);
  margin-bottom: 1rem;
  font-size: 1.1rem;
  font-weight: 600;
}

.analysis-textarea {
  width: 100%;
  padding: 1rem;
  border: 2px solid var(--gray-200);
  border-radius: 8px;
  font-size: 1rem;
  line-height: 1.6;
  resize: vertical;
  transition: border-color 0.2s ease;
  font-family: inherit;
}

.analysis-textarea:focus {
  outline: none;
  border-color: var(--primary-500);
}

.analysis-textarea::placeholder {
  color: var(--gray-400);
}

.popup-footer {
  padding: 1.5rem 2rem;
  border-top: 1px solid var(--gray-200);
  display: flex;
  justify-content: center;
}

.submit-btn {
  background: var(--primary-600);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.75rem 2rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.3s ease;
}

.submit-btn:hover:not(:disabled) {
  background: var(--primary-700);
  transform: translateY(-2px);
}

.submit-btn:disabled {
  background: var(--gray-400);
  cursor: not-allowed;
  transform: none;
}

/* 반응형 디자인 */
@media (max-width: 1200px) {
  .popup-content {
    max-width: 95vw;
    margin: 1rem;
  }
}

@media (max-width: 768px) {
  .popup-content {
    margin: 0.5rem;
    max-height: calc(100vh - 1rem);
  }
  
  .popup-header {
    padding: 0.5rem 1rem;
  }
  
  .popup-header h3 {
    font-size: 1.1rem;
  }
  
  .close-btn {
    width: 22px;
    height: 22px;
    font-size: 0.9rem;
    padding: 0.3rem;
  }
  
  .popup-body,
  .popup-footer {
    padding: 1rem;
  }
  
  .analysis-title-section {
    margin-bottom: 1.5rem;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
  
  .analysis-title-section h4 {
    min-width: auto;
  }
  
  .image-upload-section {
    grid-template-columns: 1fr;
    gap: 1.5rem;
    margin-bottom: 1.5rem;
  }
  
  .upload-area {
    min-height: 250px;
    padding: 1rem;
  }
  
  .image-input-area {
    min-height: 220px;
    padding: 1.5rem;
  }
  
  .image-input-area:hover {
    transform: translateY(-1px);
  }
  
  .preview-image {
    max-height: 180px;
    max-width: 100%;
  }
  
  .paste-image-prompt h3 {
    color: var(--primary-700);
    margin: 0;
    font-size: 1.2rem;
    font-weight: 600;
  }
  
  .paste-image-prompt p {
    font-size: 0.9rem;
    max-width: 180px;
    font-weight: 500;
  }
  
  .image-icon-wrapper {
    width: 60px;
    height: 60px;
  }
  
  .image-icon-wrapper i:first-child {
    font-size: 2rem;
  }
  
  .image-icon-wrapper i:last-child {
    font-size: 1.5rem;
    top: 8px;
    left: 8px;
  }
  
  .upload-area h4::after {
    font-size: 0.8rem;
  }
}
</style> 