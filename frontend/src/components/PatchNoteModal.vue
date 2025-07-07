<template>
    <Transition name="modal">
      <div v-if="show" class="patch-note-overlay" @click="closeModal">
        <div class="patch-note-modal" @click.stop>
          <div class="modal-header">
            <div class="header-content">
              <div class="version-badge">
                <span class="version-text">패치노트</span>
              </div>
              <h2 class="modal-title">업데이트 내역</h2>
              <button class="close-button" @click="closeModal">
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>
          
          <div class="modal-body">
            <div class="patch-content">
              <!-- v2.1.0 -->
              <div class="version-section">
                <div class="version-header">
                  <h3 class="version-title">v2.1.0</h3>
                  <span class="version-date">2024년 1월 15일</span>
                </div>
                <div class="section">
                  <h4 class="section-title">
                    <i class="fas fa-star"></i>
                    새로운 기능
                  </h4>
                  <ul class="feature-list">
                    <li class="feature-item">
                      <span class="feature-icon">✨</span>
                      <span>이미지 분석 성능 개선</span>
                    </li>
                    <li class="feature-item">
                      <span class="feature-icon">🚀</span>
                      <span>실시간 처리 속도 향상</span>
                    </li>
                    <li class="feature-item">
                      <span class="feature-icon">🎨</span>
                      <span>UI/UX 디자인 개선</span>
                    </li>
                  </ul>
                </div>
                
                <div class="section">
                  <h4 class="section-title">
                    <i class="fas fa-bug"></i>
                    버그 수정
                  </h4>
                  <ul class="feature-list">
                    <li class="feature-item">
                      <span class="feature-icon">🔧</span>
                      <span>이미지 업로드 오류 수정</span>
                    </li>
                    <li class="feature-item">
                      <span class="feature-icon">🔧</span>
                      <span>데이터 처리 중단 문제 해결</span>
                    </li>
                  </ul>
                </div>
                
                <div class="section">
                  <h4 class="section-title">
                    <i class="fas fa-cog"></i>
                    개선사항
                  </h4>
                  <ul class="feature-list">
                    <li class="feature-item">
                      <span class="feature-icon">⚡</span>
                      <span>메모리 사용량 최적화</span>
                    </li>
                    <li class="feature-item">
                      <span class="feature-icon">📱</span>
                      <span>모바일 반응형 개선</span>
                    </li>
                  </ul>
                </div>
              </div>
  
              <!-- v2.0.5 -->
              <div class="version-section">
                <div class="version-header">
                  <h3 class="version-title">v2.0.5</h3>
                  <span class="version-date">2024년 1월 10일</span>
                </div>
                <div class="section">
                  <h4 class="section-title">
                    <i class="fas fa-star"></i>
                    새로운 기능
                  </h4>
                  <ul class="feature-list">
                    <li class="feature-item">
                      <span class="feature-icon">🔍</span>
                      <span>고급 검색 필터 추가</span>
                    </li>
                    <li class="feature-item">
                      <span class="feature-icon">📊</span>
                      <span>데이터 시각화 차트 개선</span>
                    </li>
                  </ul>
                </div>
                
                <div class="section">
                  <h4 class="section-title">
                    <i class="fas fa-bug"></i>
                    버그 수정
                  </h4>
                  <ul class="feature-list">
                    <li class="feature-item">
                      <span class="feature-icon">🔧</span>
                      <span>로그인 세션 관리 개선</span>
                    </li>
                    <li class="feature-item">
                      <span class="feature-icon">🔧</span>
                      <span>파일 업로드 크기 제한 수정</span>
                    </li>
                  </ul>
                </div>
              </div>
  
              <!-- v2.0.0 -->
              <div class="version-section">
                <div class="version-header">
                  <h3 class="version-title">v2.0.0</h3>
                  <span class="version-date">2024년 1월 1일</span>
                </div>
                <div class="section">
                  <h4 class="section-title">
                    <i class="fas fa-star"></i>
                    새로운 기능
                  </h4>
                  <ul class="feature-list">
                    <li class="feature-item">
                      <span class="feature-icon">🎯</span>
                      <span>완전히 새로운 UI/UX 디자인</span>
                    </li>
                    <li class="feature-item">
                      <span class="feature-icon">🔐</span>
                      <span>SSO 로그인 시스템 도입</span>
                    </li>
                    <li class="feature-item">
                      <span class="feature-icon">📈</span>
                      <span>실시간 데이터 분석 기능</span>
                    </li>
                    <li class="feature-item">
                      <span class="feature-icon">🔄</span>
                      <span>자동 데이터 동기화</span>
                    </li>
                  </ul>
                </div>
                
                <div class="section">
                  <h4 class="section-title">
                    <i class="fas fa-cog"></i>
                    개선사항
                  </h4>
                  <ul class="feature-list">
                    <li class="feature-item">
                      <span class="feature-icon">⚡</span>
                      <span>전체적인 성능 최적화</span>
                    </li>
                    <li class="feature-item">
                      <span class="feature-icon">📱</span>
                      <span>모바일 최적화</span>
                    </li>
                    <li class="feature-item">
                      <span class="feature-icon">🌐</span>
                      <span>다국어 지원</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          
          <div class="modal-footer">
            <button class="confirm-button" @click="closeModal">
              확인
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </template>
  
  <script>
  export default {
    name: 'PatchNoteModal',
    props: {
      show: {
        type: Boolean,
        default: false
      }
    },
    methods: {
      closeModal() {
        this.$emit('close');
      }
    }
  }
  </script>
  
  <style scoped>
  .patch-note-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    backdrop-filter: blur(4px);
  }
  
  .patch-note-modal {
    background: white;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    max-width: 600px;
    width: 90%;
    max-height: 85vh;
    overflow: hidden;
    position: relative;
    animation: modalSlideIn 0.3s ease-out;
  }
  
  @keyframes modalSlideIn {
    from {
      opacity: 0;
      transform: translateY(-20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  
  .modal-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 24px;
    position: relative;
  }
  
  .header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  
  .version-badge {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 20px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 600;
    backdrop-filter: blur(10px);
  }
  
  .modal-title {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    flex: 1;
    text-align: center;
  }
  
  .close-button {
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    backdrop-filter: blur(10px);
  }
  
  .close-button:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: scale(1.1);
  }
  
  .modal-body {
    padding: 24px;
    max-height: calc(85vh - 140px);
    overflow-y: auto;
  }
  
  .patch-content {
    display: flex;
    flex-direction: column;
    gap: 32px;
  }
  
  .version-section {
    border-bottom: 2px solid #f0f0f0;
    padding-bottom: 24px;
  }
  
  .version-section:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
  
  .version-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
    padding: 16px 20px;
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    border-radius: 12px;
    border-left: 4px solid #667eea;
  }
  
  .version-title {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: #333;
  }
  
  .version-date {
    font-size: 14px;
    color: #666;
    font-weight: 500;
  }
  
  .section {
    background: #f8f9fa;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 16px;
    border-left: 4px solid #667eea;
  }
  
  .section:last-child {
    margin-bottom: 0;
  }
  
  .section-title {
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 600;
    color: #333;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .section-title i {
    color: #667eea;
  }
  
  .feature-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .feature-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    font-size: 14px;
    color: #555;
    transition: transform 0.2s ease;
  }
  
  .feature-item:hover {
    transform: translateX(4px);
  }
  
  .feature-icon {
    font-size: 16px;
    width: 20px;
    text-align: center;
  }
  
  .modal-footer {
    padding: 20px 24px;
    background: #f8f9fa;
    border-top: 1px solid #e9ecef;
    display: flex;
    justify-content: flex-end;
  }
  
  .confirm-button {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  }
  
  .confirm-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
  }
  
  .confirm-button:active {
    transform: translateY(0);
  }
  
  /* Modal transition animations */
  .modal-enter-active,
  .modal-leave-active {
    transition: all 0.3s ease;
  }
  
  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }
  
  .modal-enter-from .patch-note-modal,
  .modal-leave-to .patch-note-modal {
    transform: translateY(-20px) scale(0.95);
  }
  
  /* Scrollbar styling */
  .modal-body::-webkit-scrollbar {
    width: 8px;
  }
  
  .modal-body::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
  }
  
  .modal-body::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 4px;
  }
  
  .modal-body::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
  }
  
  /* Responsive design */
  @media (max-width: 768px) {
    .patch-note-modal {
      width: 95%;
      max-height: 90vh;
    }
    
    .modal-header {
      padding: 20px;
    }
    
    .modal-title {
      font-size: 20px;
    }
    
    .modal-body {
      padding: 20px;
      max-height: calc(90vh - 120px);
    }
    
    .version-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
    }
    
    .section {
      padding: 16px;
    }
  }
  </style>