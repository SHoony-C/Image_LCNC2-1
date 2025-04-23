<template>
  <div class="settings-view">
    <div class="view-header">
      <h1>System Settings</h1>
      <p class="subtitle">Configure system preferences and options</p>
    </div>
    <div class="content">
      <div class="settings-section">
        <h2>이미지 벡터 관리</h2>
        <div class="setting-item">
          <div class="setting-info">
            <h3>테스트 이미지 로드 및 벡터 변환</h3>
            <p>지정된 경로에서 이미지를 로드하고 벡터로 변환합니다.</p>
            <div class="directory-input">
              <label>이미지 경로:</label>
              <input 
                type="text" 
                v-model="imageDirectory" 
                placeholder="예: D:\홈피\image_lcnc_msa2\frontend\public\test_image"
              />
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
            </div>
          </div>
          <div class="setting-status" v-if="processingStatus">
            <div class="status-indicator" :class="processingStatus.type">
              <i :class="getStatusIcon(processingStatus.type)"></i>
              <span>{{ processingStatus.message }}</span>
            </div>
            <div class="status-details" v-if="processingStatus.details">
              <div class="processed-count">처리된 이미지: {{ processingStatus.details.processed }} 개</div>
              <div class="vector-count" v-if="processingStatus.details.vectors">벡터 변환: {{ processingStatus.details.vectors }} 개</div>
              <div class="error-count" v-if="processingStatus.details.errors">오류: {{ processingStatus.details.errors }} 개</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SettingsView',
  data() {
    return {
      isProcessing: false,
      imageDirectory: 'D:\\홈피\\image_lcnc_msa2\\frontend\\public\\test_image',
      processingStatus: null
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
        // 이미지 로드 API 호출
        const response = await fetch('http://localhost:8000/api/msa4/load-local-images', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ directory_path: this.imageDirectory })
        });
        
        const data = await response.json();
        
        if (data.status === 'success' || data.status === 'partial_success') {
          this.processingStatus = {
            type: data.status === 'success' ? 'success' : 'warning',
            message: data.status === 'success' 
              ? '이미지 로드 및 벡터 변환 완료!' 
              : '일부 이미지만 처리되었습니다.',
            details: {
              processed: data.processed?.length || 0,
              vectors: data.vector_extraction?.count || 0,
              errors: data.errors?.length || 0
            }
          };
        } else {
          this.processingStatus = {
            type: 'error',
            message: data.message || '이미지 로드 실패',
            details: {
              errors: data.errors?.length || 0
            }
          };
        }
      } catch (error) {
        console.error('Error loading images:', error);
        this.processingStatus = {
          type: 'error',
          message: '서버 통신 오류: ' + (error.message || '알 수 없는 오류'),
        };
      } finally {
        this.isProcessing = false;
      }
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

.directory-input {
  margin-bottom: 1rem;
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
</style> 