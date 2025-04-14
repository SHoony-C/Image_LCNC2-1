<template>
  <div class="addon-view">
    <div class="page-title">
      <h1>추가 기능</h1>
      <div class="title-underline"></div>
    </div>
    <div class="content">
      <div class="addon-grid">
        <div class="addon-card">
          <div class="addon-icon">
            <i class="fas fa-image"></i>
          </div>
          <div class="addon-info">
            <h3>이미지 향상</h3>
            <p>이미지 품질 개선 및 최적화</p>
            <button class="addon-button">활성화</button>
          </div>
        </div>
        <div class="addon-card">
          <div class="addon-icon">
            <i class="fas fa-language"></i>
          </div>
          <div class="addon-info">
            <h3>다국어 지원</h3>
            <p>다국어 번역 및 분석</p>
            <button class="addon-button">활성화</button>
          </div>
        </div>
        <div class="addon-card">
          <div class="addon-icon">
            <i class="fas fa-chart-bar"></i>
          </div>
          <div class="addon-info">
            <h3>고급 분석</h3>
            <p>심층 데이터 분석 도구</p>
            <button class="addon-button">활성화</button>
          </div>
        </div>
        <div class="addon-card">
          <div class="addon-icon">
            <i class="fas fa-shield-alt"></i>
          </div>
          <div class="addon-info">
            <h3>보안 강화</h3>
            <p>고급 보안 기능</p>
            <button class="addon-button">활성화</button>
          </div>
        </div>
      </div>

      <div class="addon-settings">
        <h3>설정</h3>
        <div class="settings-grid">
          <div class="setting-item">
            <div class="setting-info">
              <h4>자동 업데이트</h4>
              <p>새로운 기능 자동 설치</p>
            </div>
            <label class="switch">
              <input type="checkbox" checked>
              <span class="slider"></span>
            </label>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <h4>백업 설정</h4>
              <p>주간 데이터 백업</p>
            </div>
            <label class="switch">
              <input type="checkbox">
              <span class="slider"></span>
            </label>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <h4>알림 설정</h4>
              <p>새로운 기능 알림</p>
            </div>
            <label class="switch">
              <input type="checkbox" checked>
              <span class="slider"></span>
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AddonView',
  setup() {
    return {
      // Add your component logic here
    }
  }
}
</script>

<style scoped>
.addon-view {
  padding: clamp(1.5rem, 3vw, 2.5rem);
  background: var(--primary-50);
  min-height: calc(100vh - 70px); /* 탑바 높이 제외 */
  height: 100%;
  width: calc(100% - 250px); /* 사이드바 너비만큼 제외 */
  margin-left: 250px; /* 사이드바 너비만큼 여백 */
  display: flex;
  flex-direction: column;
  gap: clamp(1.5rem, 3vw, 2.5rem);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow-y: auto;
}

.view-header {
  text-align: left;
  margin-bottom: clamp(2rem, 4vw, 3rem);
  width: 100%;
  padding: 1.5rem 2rem;
  background: white;
  border-radius: 0;
  box-shadow: 0 2px 4px rgba(124, 58, 237, 0.1);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  position: relative;
  z-index: 1;
  margin-left: -2.5rem;
  margin-right: -2.5rem;
  padding-left: 2.5rem;
  padding-right: 2.5rem;
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
  display: flex;
  flex-direction: column;
  gap: clamp(1.5rem, 3vw, 2.5rem);
  flex: 1;
  width: 100%;
  height: 100%;
  max-width: 1400px; /* 탑바와 동일한 최대 너비 */
  margin: 0 auto;
}

.addon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
  gap: clamp(1rem, 2vw, 1.5rem);
  width: 100%;
  flex: 1;
}

.addon-card {
  background: white;
  border-radius: clamp(1rem, 2vw, 1.25rem);
  padding: clamp(1.5rem, 3vw, 2rem);
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.addon-card:hover {
  transform: translateY(-5px);
}

.addon-icon {
  width: 48px;
  height: 48px;
  background: var(--primary-50);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.addon-icon i {
  font-size: 1.5rem;
  color: var(--primary-600);
}

.addon-info h3 {
  font-size: 1.125rem;
  color: var(--gray-800);
  margin-bottom: 0.5rem;
}

.addon-info p {
  color: var(--gray-500);
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

.addon-button {
  background: var(--primary-600);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.addon-button:hover {
  background: var(--primary-700);
}

.addon-settings {
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.settings-grid {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-radius: 0.5rem;
  background: var(--gray-50);
}

.setting-info h4 {
  font-size: 1rem;
  color: var(--gray-800);
  margin-bottom: 0.25rem;
}

.setting-info p {
  color: var(--gray-500);
  font-size: 0.875rem;
}

.switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--gray-300);
  transition: .4s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: var(--primary-600);
}

input:checked + .slider:before {
  transform: translateX(26px);
}

@media (max-width: 1200px) {
  .addon-view {
    width: 100%;
    margin-left: 0;
  }

  .content {
    padding: 0 1rem;
  }
  
  .view-header {
    margin-left: -1.5rem;
    margin-right: -1.5rem;
    padding-left: 1.5rem;
    padding-right: 1.5rem;
  }
}

.page-title {
  width: 100%;
  text-align: center;
  padding: 2rem 0;
  margin-bottom: 2rem;
  position: relative;
}

.page-title h1 {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--primary-800);
  margin: 0;
  letter-spacing: -0.5px;
  position: relative;
  display: inline-block;
}

.title-underline {
  width: 60px;
  height: 4px;
  background: var(--primary-600);
  margin: 1rem auto 0;
  border-radius: 2px;
}
</style> 