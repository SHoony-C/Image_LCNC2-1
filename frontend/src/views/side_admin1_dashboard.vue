<template>
  <div class="admin-dashboard">
    <div class="content">
      <div class="admin-stats">
        <div class="stat-card">
          <div class="stat-icon">
            <i class="fas fa-users"></i>
          </div>
          <div class="stat-info">
            <h3>활성 사용자</h3>
            <p class="stat-value">1,234</p>
            <p class="stat-change positive">+12.5%</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">
            <i class="fas fa-server"></i>
          </div>
          <div class="stat-info">
            <h3>시스템 부하</h3>
            <p class="stat-value">45%</p>
            <p class="stat-change neutral">안정적</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">
            <i class="fas fa-database"></i>
          </div>
          <div class="stat-info">
            <h3>저장 공간</h3>
            <p class="stat-value">2.5TB</p>
            <p class="stat-change warning">75% 사용</p>
          </div>
        </div>
      </div>

      <div class="admin-grid">
        <div class="admin-card">
          <h3>시스템 상태</h3>
          <div class="status-list">
            <div class="status-item">
              <span class="status-dot success"></span>
              <span>API 서버</span>
            </div>
            <div class="status-item">
              <span class="status-dot success"></span>
              <span>데이터베이스</span>
            </div>
            <div class="status-item">
              <span class="status-dot success"></span>
              <span>캐시 서버</span>
            </div>
            <div class="status-item">
              <span class="status-dot warning"></span>
              <span>백업 서버</span>
            </div>
          </div>
        </div>

        <div class="admin-card">
          <h3>최근 활동</h3>
          <div class="activity-list">
            <div class="activity-item" v-for="i in 5" :key="i">
              <div class="activity-icon">
                <i class="fas fa-user"></i>
              </div>
              <div class="activity-info">
                <p>사용자 로그인</p>
                <span class="activity-time">2시간 전</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="admin-actions">
        <h3>빠른 작업</h3>
        <div class="action-buttons">
          <button class="action-button">
            <i class="fas fa-sync"></i>
            <span>시스템 새로고침</span>
          </button>
          <button class="action-button">
            <i class="fas fa-download"></i>
            <span>백업 생성</span>
          </button>
          <button class="action-button">
            <i class="fas fa-cog"></i>
            <span>설정</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AdminDashboard',
  setup() {
    return {
      // Add your component logic here
    }
  }
}
</script>

<style scoped>
.admin-dashboard {
  min-height: 100vh;
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, var(--primary-50) 0%, var(--gray-50) 100%);
  position: relative;
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

.admin-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: clamp(1rem, 2vw, 1.5rem);
  width: 100%;
}

.stat-card {
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.stat-icon {
  width: 48px;
  height: 48px;
  background: var(--primary-50);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon i {
  font-size: 1.5rem;
  color: var(--primary-600);
}

.stat-info h3 {
  font-size: 0.875rem;
  color: var(--gray-500);
  margin-bottom: 0.5rem;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--gray-800);
  margin-bottom: 0.25rem;
}

.stat-change {
  font-size: 0.875rem;
  font-weight: 500;
}

.stat-change.positive {
  color: var(--success);
}

.stat-change.warning {
  color: var(--warning);
}

.stat-change.neutral {
  color: var(--gray-500);
}

.admin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
  gap: clamp(1rem, 2vw, 1.5rem);
  width: 100%;
  flex: 1;
}

.admin-card {
  background: white;
  border-radius: clamp(1rem, 2vw, 1.25rem);
  padding: clamp(1.5rem, 3vw, 2rem);
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.admin-card h3 {
  font-size: 1.125rem;
  color: var(--gray-800);
  margin-bottom: 1rem;
}

.status-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.success {
  background: var(--success);
}

.status-dot.warning {
  background: var(--warning);
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: var(--gray-50);
  border-radius: 0.5rem;
}

.activity-icon {
  width: 32px;
  height: 32px;
  background: var(--primary-50);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.activity-icon i {
  font-size: 1rem;
  color: var(--primary-600);
}

.activity-info {
  flex: 1;
}

.activity-info p {
  margin: 0;
  color: var(--gray-800);
}

.activity-time {
  font-size: 0.75rem;
  color: var(--gray-500);
}

.admin-actions {
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.action-buttons {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
}

.action-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: var(--primary-50);
  color: var(--primary-600);
  border: none;
  border-radius: 0.5rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.action-button:hover {
  background: var(--primary-100);
}

@media (max-width: 1200px) {
  .admin-dashboard {
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
</style> 