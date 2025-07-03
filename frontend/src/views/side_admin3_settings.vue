<template>
  <div class="settings-view">
    <AppHeader :pageTitle="'시스템 설정'" />
    <div class="content">
      <div class="settings-section">
        <h2>이미지 벡터 관리</h2>
        <div class="setting-item">
          <div class="setting-info">
            <h3>테스트 이미지 로드 및 벡터 변환</h3>
            <p>지정된 경로에서 이미지를 로드하고 벡터로 변환합니다. 각 이미지당 하나의 벡터만 저장합니다.</p>
            <div class="directory-inputs">
              <div class="directory-input">
                <label>I-TAP 이미지 경로 (_before 필터링):</label>
                <input 
                  type="text" 
                  v-model="imageDirectory" 
                  placeholder="예: D:\image_set_url\workflow_images"
                />
              </div>
              <div class="directory-input">
                <label>Analysis 이미지 경로 (_whole 제외 필터링):</label>
                <input 
                  type="text" 
                  v-model="analysisImageDirectory" 
                  placeholder="예: D:\image_set_url\\additional_images"
                />
              </div>
            </div>
            <div class="actions">
              <button 
                @click="loadAndProcessImages" 
                class="primary-button"
                :disabled="isProcessing"
              >
                <i class="fas fa-sync" :class="{ 'fa-spin': isProcessing }"></i>
                {{ isProcessing ? '처리 중...' : '이미지 로드 및 벡터 변환' }}
              </button>
              <button 
                @click="resetVectorData" 
                class="reset-button"
                :disabled="isProcessing"
              >
                <i class="fas fa-trash"></i>
                벡터 데이터 초기화
              </button>
            </div>
          </div>
          <div class="setting-status" v-if="processingStatus">
            <div class="status-indicator" :class="processingStatus.type">
              <i :class="getStatusIcon(processingStatus.type)"></i>
              <span>{{ processingStatus.message }}</span>
            </div>
            <div class="status-details" v-if="processingStatus.details">
              <div class="processed-count">처리된 이미지: {{ processingStatus.details.processed }} 개</div>
              <div class="vector-count" v-if="processingStatus.details.vectors">
                벡터 변환: {{ processingStatus.details.vectors }} 개 
                <span v-if="processingStatus.details.filtered" class="filter-info">{{ processingStatus.details.filtered }}</span>
              </div>
              <div class="error-count" v-if="processingStatus.details.errors">오류: {{ processingStatus.details.errors }} 개</div>
              
              <!-- 벡터 변환 처리 파일 목록 -->
              <div v-if="processingStatus.details.vectors > 0" class="processed-files-list">
                <h4>처리된 파일 목록 ({{ vectorResults.length }}개)</h4>
                <div class="files-container">
                  <div v-for="(item, index) in loadedOriginalImages" :key="index" class="file-item">
                    <a href="#" @click.prevent="viewImage(item)">
                      {{ index + 1 }}. {{ item }}
                    </a>
                  </div>
                </div>
              </div>
              
              <!-- 이미지 뷰어 팝업 -->
              <div v-if="imageViewerVisible" class="image-viewer-popup">
                <div class="image-viewer-content">
                  <div class="image-viewer-header">
                    <h3>{{ currentImageName }}</h3>
                    <button @click="closeImageViewer" class="close-button">&times;</button>
                  </div>
                  <div class="image-viewer-body">
                    <img :src="currentImageUrl" alt="이미지 미리보기" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import AppHeader from '@/components/AppHeader.vue';

export default {
  name: 'SettingsView',
  components: {
    AppHeader
  },
  data() {
    return {
      isProcessing: false,
      imageDirectory: 'D:\\image_set_url\\workflow_images',
      analysisImageDirectory: 'D:\\image_set_url\\additional_images',
      processingStatus: null,
      vectorResults: [],
      showAllResults: false,
      loadedOriginalImages: [],
      imageViewerVisible: false,
      currentImageName: '',
      currentImageUrl: ''
    }
  },
  methods: {
    getStatusIcon(type) {
      const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-times-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
      };
      return icons[type] || icons.info;
    },
    
    async loadAndProcessImages() {
      if (this.isProcessing) return;
      this.isProcessing = true;
      this.processingStatus = {
        type: 'info',
        message: '이미지 로드 중...'
      };
      
      try {
        // 먼저 I-app 이미지 로드 (_before 필터링)
        const response1 = await fetch('http://localhost:8000/api/settings/load-local-images', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            directory_path: this.imageDirectory,
            includeBeforeImagesOnly: true, // '_before' 접미사 파일만 포함
            tag: 'I-TAP' // 이미지 태그 추가
          })
        });
        
        let data1 = { processed: [], errors: [] };
        try {
          data1 = await response1.json();
        } catch (err) {
          // console.error('Error parsing I-app images response:', err);
          data1 = { status: 'error', message: '응답 파싱 오류', processed: [], errors: [{ error: err.message }] };
        }
        
        this.processingStatus = {
          type: 'info',
          message: 'I-TAP 이미지 로드 완료, Analysis 이미지 로드 중...'
        };
        
        // 그 다음 Analysis 이미지 로드 (필터링 없음)
        let data2 = { processed: [], errors: [] };
        try {
          const response2 = await fetch('http://localhost:8000/api/settings/load-local-images', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
              directory_path: this.analysisImageDirectory,
              includeBeforeImagesOnly: false, // 모든 이미지 포함
              includeWholeImagesOnly: false, // '_whole' 접미사가 없는 파일만 포함
              tag: 'Analysis' // 이미지 태그 추가
            })
          });
          
          data2 = await response2.json();
        } catch (err) {
          // console.error('Error loading Analysis images:', err);
          data2 = { status: 'error', message: '분석 이미지 로드 오류', processed: [], errors: [{ error: err.message }] };
        }
        
        // 두 데이터 결합
        const combinedProcessed = [...(data1.processed || []), ...(data2.processed || [])];
        const combinedErrors = [...(data1.errors || []), ...(data2.errors || [])];
        
        const combinedData = {
          status: (data1.status === 'success' && data2.status === 'success') ? 'success' : 
                 (combinedProcessed.length > 0) ? 'partial_success' : 'error',
          processed: combinedProcessed,
          errors: combinedErrors
        };
        
        if (combinedProcessed.length > 0) {
          this.processingStatus = {
            type: 'info',
            message: `${combinedProcessed.length}개 이미지 로드 완료, 벡터 변환 중...`
          };
          
          // 필터링된 이미지 목록 저장 (로드된 이미지 이름만 추출)
          const loadedImages = combinedProcessed.map(img => img.stored_filename) || [];
          // console.log('로드된 이미지:', loadedImages);
          
          try {
            // 벡터 변환 API 호출 (백엔드로 직접 요청)
            const transformResponse = await fetch('http://localhost:8000/api/settings/vectors/transform', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ 
                images: loadedImages,
                includeBeforeImagesOnly: false, // 모든 이미지 처리
                useUMAP: true, // UMAP 차원 축소 사용
                directory_path: this.imageDirectory,    // I-app 이미지 경로 추가
                analysisDirectory: this.analysisImageDirectory // Analysis 이미지 경로 추가
              })
            });
            
            if (!transformResponse.ok) {
              throw new Error(`벡터 변환 API 오류: ${transformResponse.status}`);
            }
            
            const transformData = await transformResponse.json();
            // console.log('변환 데이터:', transformData);
            
            this.processingStatus = {
              type: transformData.status === 'success' ? 'success' : 'warning',
              message: transformData.message || (transformData.status === 'success' 
                ? '이미지 로드 및 벡터 변환 완료!' 
                : '일부 이미지만 처리되었습니다.'),
              details: {
                processed: combinedProcessed.length || 0,
                vectors: transformData.count || 0,
                filtered: '',
                errors: combinedErrors.length + (transformData.errors?.length || 0)
              }
            };
            
            // 벡터 결과 저장 - 백엔드가 처리한 모든 파일명을 가져옴
            if (transformData.debug_info && transformData.debug_info.processed_filenames) {
              // 디버그 정보에서 처리된 모든 파일명 가져오기
              this.vectorResults = transformData.debug_info.processed_filenames.map(filename => ({
                filename: filename
              }));
              // console.log(`${this.vectorResults.length}개 파일명 로드됨:`, this.vectorResults);
            }
            else if (transformData.results && transformData.results.length > 0) {
              this.vectorResults = transformData.results;
              // console.log(`${this.vectorResults.length}개 결과 로드됨:`, this.vectorResults);
            }
            
            // 원본 이미지 목록 저장
            this.loadedOriginalImages = loadedImages;
          } catch (error) {
            // console.error('Error in vector transformation:', error);
            this.processingStatus = {
              type: 'error',
              message: '벡터 변환 중 오류: ' + (error.message || '알 수 없는 오류'),
              details: {
                processed: combinedProcessed.length || 0,
                vectors: 0,
                errors: combinedErrors.length + 1
              }
            };
          }
        } else {
          this.processingStatus = {
            type: 'error',
            message: combinedData.message || '이미지 로드 실패',
            details: {
              errors: combinedErrors.length || 0
            }
          };
        }
      } catch (error) {
        // console.error('Error loading images:', error);
        this.processingStatus = {
          type: 'error',
          message: '서버 통신 오류: ' + (error.message || '알 수 없는 오류'),
        };
      } finally {
        this.isProcessing = false;
      }
    },
    
    async processVectorData() {
      try {
        // 벡터 데이터를 가져오는 API 호출 - settings 경로로 변경
        const response = await fetch('http://localhost:8000/api/settings/processed-vectors', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          }
        });
        
        if (!response.ok) {
          throw new Error(`API returned status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.vectors || !data.vectors.length) {
          // console.warn('No vector data returned from API');
          return { 
            status: 'warning', 
            message: '벡터 데이터가 없습니다', 
            processed: 0 
          };
        }
        
        // 응답 데이터 확인 및 필드 처리
        if (!data.metadata) {
          // console.warn('API response missing metadata field:', data);
          // metadata 필드가 없는 경우, labels가 있는지 확인
          if (data.labels) {
            data.metadata = data.labels; // labels 필드를 metadata로 사용
            // console.log('Using labels field as metadata');
          } else {
            // 둘 다 없는 경우 빈 배열이나 인덱스 기반 이름 생성
            data.metadata = Array(data.vectors.length).fill().map((_, i) => `image_${i+1}`);
            // console.log('Generated fallback metadata');
          }
        }
        
        // 3D 좌표 계산
        const projectedVectors = this.computeProjectedVectors(data.vectors);
        
        // 결과 데이터 생성 (파일명과 3D 좌표)
        const results = data.metadata.map((filename, index) => ({
          filename,
          coordinates: projectedVectors[index] || [0, 0, 0]
        }));
        
        // 벡터 결과 설정
        this.vectorResults = results;
        
        return {
          status: 'success',
          message: `벡터 데이터 처리 완료: 총 ${data.vectors.length}개`,
          processed: data.vectors.length,
          results: results
        };
      } catch (error) {
        // console.error('Error processing vector data:', error);
        return {
          status: 'error',
          message: '벡터 처리 중 오류가 발생했습니다: ' + error.message,
          processed: 0
        };
      }
    },
    
    // 3D 투영 함수 추가
    computeProjectedVectors(vectors) {
      const projectedVectors = [];
      
      for (const vec of vectors) {
        if (!vec || vec.length < 3) {
          projectedVectors.push([0, 0, 0]);
          continue;
        }
        
        // 벡터를 3개의 그룹으로 나누어 평균 계산
        const vectorLength = vec.length;
        const groupSize = Math.floor(vectorLength / 3);
        
        const groups = [
          vec.slice(0, groupSize),
          vec.slice(groupSize, 2 * groupSize),
          vec.slice(2 * groupSize)
        ];
        
        const projected = [
          groups[0].reduce((sum, val) => sum + val, 0) / groups[0].length,
          groups[1].reduce((sum, val) => sum + val, 0) / groups[1].length,
          groups[2].reduce((sum, val) => sum + val, 0) / groups[2].length
        ];
        
        projectedVectors.push(projected);
      }
      
      // 정규화
      const dimensions = [0, 1, 2].map(dim => ({
        min: Math.min(...projectedVectors.map(v => v[dim])),
        max: Math.max(...projectedVectors.map(v => v[dim]))
      }));
      
      return projectedVectors.map(vec => 
        vec.map((val, i) => {
          const min = dimensions[i].min;
          const max = dimensions[i].max;
          // 분모가 0이 되는 것 방지
          return max > min ? (val - min) / (max - min) : 0.5;
        })
      );
    },
    
    // 벡터 데이터 초기화 함수 수정
    async resetVectorData() {
      if (this.isProcessing) return;
      
      if (!confirm('모든 벡터 데이터를 초기화하시겠습니까? 이 작업은 취소할 수 없습니다.')) {
        return;
      }
      
      this.isProcessing = true;
      this.processingStatus = {
        type: 'info',
        message: '벡터 데이터 초기화 중...'
      };
      
      try {
        // 벡터 데이터 초기화 API 호출 - settings 경로 사용
        const emptyData = {
          vectors: [],
          metadata: []
        };
        
        const response = await fetch('http://localhost:8000/api/settings/save-processed-vectors', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(emptyData)
        });
        
        if (!response.ok) {
          throw new Error(`API returned status: ${response.status}`);
        }
        
        // 벡터 결과 초기화
        this.vectorResults = [];
        
        this.processingStatus = {
          type: 'success',
          message: '벡터 데이터가 초기화되었습니다.',
          details: {
            processed: 0,
            vectors: 0,
            errors: 0
          }
        };
      } catch (error) {
        // console.error('Error resetting vector data:', error);
        this.processingStatus = {
          type: 'error',
          message: '벡터 데이터 초기화 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류')
        };
      } finally {
        this.isProcessing = false;
      }
    },
    viewImage(imageName) {
      this.currentImageName = imageName;
      this.currentImageUrl = `http://localhost:8091/images/${encodeURIComponent(imageName)}`;
      this.imageViewerVisible = true;
    },
    closeImageViewer() {
      this.imageViewerVisible = false;
    }
  }
}
</script>

<style scoped>
.settings-view {
  padding: 2rem;
}

.view-header {
  margin-bottom: 2rem;
}

h1 {
  color: var(--primary-700);
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: var(--gray-500);
  font-size: 1rem;
}

.content {
  background: white;
  border-radius: 1rem;
  padding: 2rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.settings-section {
  margin-bottom: 2rem;
}

.settings-section h2 {
  color: var(--gray-800);
  font-size: 1.5rem;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--gray-200);
}

.setting-item {
  border: 1px solid var(--gray-200);
  border-radius: 0.5rem;
  padding: 1.5rem;
  margin-bottom: 1rem;
  background-color: var(--gray-50);
}

.setting-info h3 {
  font-size: 1.2rem;
  margin-bottom: 0.5rem;
  color: var(--gray-900);
}

.setting-info p {
  color: var(--gray-600);
  margin-bottom: 1rem;
}

.directory-inputs {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1rem;
}

.directory-input {
  margin-bottom: 0.5rem;
  display: flex;
  flex-direction: column;
}

.directory-input label {
  font-weight: 500;
  margin-bottom: 0.25rem;
  color: var(--gray-700);
}

.directory-input input {
  padding: 0.5rem;
  border: 1px solid var(--gray-300);
  border-radius: 0.25rem;
  font-size: 0.9rem;
  width: 100%;
}

.actions {
  display: flex;
  gap: 10px;
  margin-bottom: 1rem;
}

.primary-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background-color: #8b5cf6;
  color: white;
  border: none;
  border-radius: 0.25rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.primary-button:hover:not(:disabled) {
  background-color: #7c3aed;
}

.primary-button:disabled {
  background-color: #c4b5fd;
  cursor: not-allowed;
}

.reset-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background-color: #ef4444;
  color: white;
  border: none;
  border-radius: 0.25rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.reset-button:hover:not(:disabled) {
  background-color: #dc2626;
}

.reset-button:disabled {
  background-color: #fca5a5;
  cursor: not-allowed;
}

.primary-button i {
  font-size: 0.9rem;
}

.setting-status {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px dashed var(--gray-300);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: 0.25rem;
  margin-bottom: 0.5rem;
}

.status-indicator.success {
  background-color: #ecfdf5;
  color: #065f46;
}

.status-indicator.error {
  background-color: #fef2f2;
  color: #991b1b;
}

.status-indicator.warning {
  background-color: #fffbeb;
  color: #92400e;
}

.status-indicator.info {
  background-color: #eff6ff;
  color: #1e40af;
}

.status-details {
  padding: 0.75rem;
  background-color: var(--gray-100);
  border-radius: 0.25rem;
  font-size: 0.9rem;
}

.status-details div {
  margin-bottom: 0.25rem;
}

.vector-results {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px dashed var(--gray-300);
}

.vector-results-explanation {
  margin-bottom: 0.5rem;
}

.vector-table-container {
  margin-bottom: 1rem;
}

.vector-table {
  width: 100%;
  border-collapse: collapse;
}

.vector-table th,
.vector-table td {
  padding: 0.75rem;
  text-align: left;
}

.vector-table th {
  background-color: var(--gray-200);
}

.image-name {
  font-weight: 500;
}

.coordinate {
  text-align: right;
}

.more-results {
  text-align: right;
}

.toggle-button {
  padding: 0.25rem 0.5rem;
  background-color: #8b5cf6;
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
}

.all-results-dialog {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
}

.dialog-content {
  background-color: white;
  padding: 2rem;
  border-radius: 1rem;
  max-width: 80%;
  max-height: 80%;
  overflow: auto;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.dialog-header h3 {
  font-size: 1.5rem;
  font-weight: 700;
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--gray-500);
  cursor: pointer;
}

.dialog-body {
  overflow: auto;
}

.vector-table.full-table {
  width: 100%;
}

.vector-table.full-table th,
.vector-table.full-table td {
  padding: 0.75rem;
  text-align: left;
}

.vector-table.full-table th {
  background-color: var(--gray-200);
}

.error-count {
  color: var(--error-700);
}

.filter-info {
  display: inline-block;
  background-color: #e9ecef;
  color: #495057;
  font-size: 0.8rem;
  padding: 0.1rem 0.4rem;
  border-radius: 0.25rem;
  margin-left: 0.5rem;
  font-style: italic;
}

.processed-files-list {
  margin-top: 1rem;
  padding-top: 0.5rem;
}

.processed-files-list h4 {
  margin-bottom: 0.5rem;
  font-size: 1rem;
  color: var(--gray-700);
}

.files-container {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  max-height: 300px;
  overflow-y: auto;
  padding: 0.5rem;
  background-color: var(--gray-50);
  border-radius: 0.25rem;
  border: 1px solid var(--gray-200);
}

.file-item {
  padding: 0.25rem 0.5rem;
  background-color: white;
  border-radius: 0.25rem;
  border: 1px solid var(--gray-200);
  font-size: 0.9rem;
}

.file-item a {
  text-decoration: none;
  color: #4f46e5;
  display: block;
  width: 100%;
}

.file-item a:hover {
  color: #3730a3;
  text-decoration: underline;
}

.image-viewer-popup {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.image-viewer-content {
  background-color: white;
  border-radius: 0.5rem;
  max-width: 90%;
  max-height: 90%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
}

.image-viewer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background-color: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.image-viewer-header h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: #1f2937;
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.close-button:hover {
  color: #1f2937;
}

.image-viewer-body {
  padding: 1rem;
  overflow: auto;
  text-align: center;
  max-height: 80vh;
}

.image-viewer-body img {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
}
</style> 