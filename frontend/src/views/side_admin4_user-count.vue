<template>
  <div class="user-count-view">
    <div class="view-header">
      <h1>사용자 통계</h1>
      <p class="subtitle">사용자 수 및 활동 분석</p>
    </div>
    <div class="content">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">
            <i class="fas fa-users"></i>
          </div>
          <div class="stat-info">
            <h3>총 사용자 수</h3>
            <p class="stat-value">5,678</p>
            <p class="stat-change positive">+15.2%</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">
            <i class="fas fa-user-clock"></i>
          </div>
          <div class="stat-info">
            <h3>활성 사용자</h3>
            <p class="stat-value">1,234</p>
            <p class="stat-change positive">+8.5%</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">
            <i class="fas fa-user-plus"></i>
          </div>
          <div class="stat-info">
            <h3>신규 등록</h3>
            <p class="stat-value">234</p>
            <p class="stat-change positive">+12.3%</p>
          </div>
        </div>
      </div>

      <div class="charts-section">
        <div class="chart-card">
          <h3>일별 사용자 추이</h3>
          <div class="chart-container">
            <!-- 차트 컴포넌트가 들어갈 자리 -->
            <div class="chart-placeholder"></div>
          </div>
        </div>
        <div class="chart-card">
          <h3>사용자 유입 경로</h3>
          <div class="chart-container">
            <!-- 차트 컴포넌트가 들어갈 자리 -->
            <div class="chart-placeholder"></div>
          </div>
        </div>
      </div>

      <div class="user-table">
        <h3>최근 가입 사용자</h3>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>이름</th>
                <th>이메일</th>
                <th>가입일</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="i in 5" :key="i">
                <td>user{{i}}</td>
                <td>사용자 {{i}}</td>
                <td>user{{i}}@example.com</td>
                <td>2024-03-{{i}}</td>
                <td><span class="status-badge success">활성</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'UserCountView',
  setup() {
    return {
      // Add your component logic here
    }
  }
}
</script>

<style scoped>
.user-count-view {
  padding: 2rem;
  background: var(--gray-50);
  min-height: 100vh;
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
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.stat-card {
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-5px);
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

.charts-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.5rem;
}

.chart-card {
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.chart-card h3 {
  font-size: 1rem;
  color: var(--gray-700);
  margin-bottom: 1rem;
}

.chart-container {
  height: 300px;
  position: relative;
}

.chart-placeholder {
  width: 100%;
  height: 100%;
  background: var(--gray-100);
  border-radius: 0.5rem;
}

.user-table {
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.table-container {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid var(--gray-200);
}

th {
  font-weight: 600;
  color: var(--gray-600);
  font-size: 0.875rem;
}

td {
  color: var(--gray-700);
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge.success {
  background: var(--success);
  color: white;
}

@media (max-width: 768px) {
  .user-count-view {
    padding: 1rem;
  }

  .charts-section {
    grid-template-columns: 1fr;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style> 