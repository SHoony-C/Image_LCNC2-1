<template>
  <div class="user-count-view">
    <div class="view-header">
      <h1>사용자 통계</h1>
      <p class="subtitle">사용자 수 및 활동 분석</p>
    </div>
    
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner">
        <i class="fas fa-spinner fa-spin"></i>
      </div>
      <p>통계 데이터를 불러오는 중...</p>
    </div>
    
    <div v-else-if="error" class="error-container">
      <div class="error-icon">
        <i class="fas fa-exclamation-circle"></i>
      </div>
      <p>{{ error }}</p>
      <button @click="fetchUserStatistics" class="retry-btn">
        <i class="fas fa-sync"></i> 다시 시도
      </button>
    </div>
    
    <div v-else class="content">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">
            <i class="fas fa-users"></i>
          </div>
          <div class="stat-info">
            <h3>총 사용자 수</h3>
            <p class="stat-value">{{ statistics.total_users }}</p>
            <p class="stat-change positive" v-if="statistics.total_users_change">{{ statistics.total_users_change > 0 ? '+' : '' }}{{ statistics.total_users_change }}%</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">
            <i class="fas fa-user-clock"></i>
          </div>
          <div class="stat-info">
            <h3>활성 사용자</h3>
            <p class="stat-value">{{ statistics.active_users }}</p>
            <p class="stat-change positive" v-if="statistics.active_users_change">{{ statistics.active_users_change > 0 ? '+' : '' }}{{ statistics.active_users_change }}%</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">
            <i class="fas fa-bolt"></i>
          </div>
          <div class="stat-info">
            <h3>신규 action</h3>
            <p class="stat-value">{{ statistics.action_count }}</p>
            <p class="stat-change positive" v-if="statistics.new_users_change">{{ statistics.new_users_change > 0 ? '+' : '' }}{{ statistics.new_users_change }}%</p>
          </div>
        </div>
      </div>

      <div class="charts-section">
        <div class="chart-card">
          <h3>일별 활동</h3>
          <div class="chart-container">
            <div v-if="statistics.daily_activity && statistics.daily_activity.length > 0" class="activity-chart">
              <div v-for="(day, index) in statistics.daily_activity" :key="index" class="activity-bar-container">
                <div class="activity-bar" :style="{ height: (day.count / maxActivityCount * 100) + '%' }"></div>
                <span class="activity-day">{{ formatDate(day.date) }}</span>
                <span class="activity-count">{{ day.count }}</span>
              </div>
            </div>
            <div v-else class="no-data">
              <i class="fas fa-chart-line"></i>
              <p>활동 데이터가 없습니다</p>
            </div>
          </div>
        </div>
        <div class="chart-card">
          <h3>액션 유형 통계</h3>
          <div class="chart-container">
            <div v-if="statistics.top_actions && statistics.top_actions.length > 0" class="action-chart">
              <div v-for="(action, index) in statistics.top_actions" :key="index" class="action-item">
                <div class="action-name">{{ formatActionName(action.action_type) }}</div>
                <div class="action-bar-container">
                  <div class="action-bar" :style="{ width: (action.count / maxActionCount * 100) + '%' }"></div>
                  <span class="action-count">{{ action.count }}</span>
                </div>
              </div>
            </div>
            <div v-else class="no-data">
              <i class="fas fa-chart-pie"></i>
              <p>액션 데이터가 없습니다</p>
            </div>
          </div>
        </div>
      </div>

      <div class="user-table">
        <h3>최근 가입 사용자</h3>
        <div class="table-container">
          <table v-if="statistics.recent_users && statistics.recent_users.length > 0">
            <thead>
              <tr>
                <th>ID</th>
                <th>이름</th>
                <th>이메일</th>
                <th>부서</th>
                <th>가입일</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in statistics.recent_users" :key="user.id">
                <td>{{ user.id }}</td>
                <td>{{ user.full_name || user.username }}</td>
                <td>{{ user.email }}</td>
                <td>{{ user.department || '-' }}</td>
                <td>{{ formatDateTime(user.created_at) }}</td>
                <td>
                  <span :class="['status-badge', user.is_active ? 'success' : 'inactive']">
                    {{ user.is_active ? '활성' : '비활성' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else class="no-data">
            <i class="fas fa-users"></i>
            <p>최근 가입자 데이터가 없습니다</p>
          </div>
        </div>
      </div>
      
      <div class="department-section">
        <h3>부서별 사용자 분포</h3>
        <div class="department-chart-container">
          <div v-if="statistics.department_stats && statistics.department_stats.length > 0" class="department-chart">
            <div v-for="(dept, index) in statistics.department_stats" :key="index" class="department-item">
              <div class="department-name">{{ dept.department || '부서 미지정' }}</div>
              <div class="department-bar-container">
                <div class="department-bar" :style="{ width: (dept.count / maxDepartmentCount * 100) + '%' }"></div>
                <span class="department-count">{{ dept.count }}</span>
              </div>
            </div>
          </div>
          <div v-else class="no-data">
            <i class="fas fa-building"></i>
            <p>부서 데이터가 없습니다</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'UserCountView',
  
  data() {
    return {
      loading: true,
      error: null,
      statistics: {
        total_users: 0,
        active_users: 0,
        new_users: 0,
        recent_users: [],
        daily_activity: [],
        department_stats: [],
        top_actions: []
      },
      // 임의의 증가율 (실제로는 이전 기간과 비교해야 함)
      total_users_change: 15.2,
      active_users_change: 8.5,
      new_users_change: 12.3
    };
  },
  
  computed: {
    maxActivityCount() {
      if (!this.statistics.daily_activity || this.statistics.daily_activity.length === 0) return 1;
      return Math.max(...this.statistics.daily_activity.map(day => day.count)) || 1;
    },
    maxActionCount() {
      if (!this.statistics.top_actions || this.statistics.top_actions.length === 0) return 1;
      return Math.max(...this.statistics.top_actions.map(action => action.count)) || 1;
    },
    maxDepartmentCount() {
      if (!this.statistics.department_stats || this.statistics.department_stats.length === 0) return 1;
      return Math.max(...this.statistics.department_stats.map(dept => dept.count)) || 1;
    }
  },
  
  created() {
    this.fetchUserStatistics();
  },
  
  methods: {
    async fetchUserStatistics() {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await axios.get('http://localhost:8000/api/users/user-statistics');
        
        if (response.data && response.data.status === 'success') {
          this.statistics = {
            ...response.data.statistics,
            total_users_change: this.total_users_change,
            active_users_change: this.active_users_change,
            new_users_change: this.new_users_change
          };
          
          console.log('통계 데이터 로드 완료:', this.statistics);
        } else {
          throw new Error('서버에서 유효한 데이터를 받지 못했습니다');
        }
      } catch (error) {
        console.error('통계 데이터 로드 실패:', error);
        this.error = '통계 데이터를 불러오는 데 실패했습니다. 다시 시도해주세요.';
      } finally {
        this.loading = false;
      }
    },
    
    formatDate(dateStr) {
      if (!dateStr) return '-';
      
      const date = new Date(dateStr);
      if (isNaN(date)) return dateStr;
      
      return date.getMonth() + 1 + '/' + date.getDate();
    },
    
    formatDateTime(dateTimeStr) {
      if (!dateTimeStr) return '-';
      
      const date = new Date(dateTimeStr);
      if (isNaN(date)) return dateTimeStr;
      
      return date.getFullYear() + '-' + 
             this.padZero(date.getMonth() + 1) + '-' + 
             this.padZero(date.getDate());
    },
    
    padZero(num) {
      return num < 10 ? '0' + num : num;
    },
    
    formatActionName(actionType) {
      const actionMap = {
        'page_visit': '페이지 방문',
        'button_click': '버튼 클릭',
        'process_start': '프로세스 시작',
        'data_save': '데이터 저장',
        'image_select': '이미지 선택',
        'save_workflow': '워크플로우 저장',
        'workflow_saved': '워크플로우 저장됨',
        'login': '로그인'
      };
      
      return actionMap[actionType] || actionType;
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

.user-table, .department-section {
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

.status-badge.inactive {
  background: var(--gray-400);
  color: white;
}

/* 로딩 및 에러 스타일 */
.loading-container,
.error-container,
.no-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
  color: var(--gray-500);
  height: 100%;
  min-height: 300px;
}

.loading-spinner,
.error-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  color: var(--primary-500);
}

.error-icon {
  color: var(--error);
}

.retry-btn {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  background: var(--primary-500);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s ease;
}

.retry-btn:hover {
  background: var(--primary-600);
}

/* 차트 스타일 */
.activity-chart {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  height: 100%;
  padding: 0 1rem;
  padding-bottom: 2rem;
}

.activity-bar-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  height: 85%;
  position: relative;
}

.activity-bar {
  width: 30px;
  background: var(--primary-400);
  border-radius: 4px 4px 0 0;
  transition: height 0.5s ease;
}

.activity-day {
  position: absolute;
  bottom: -25px;
  font-size: 0.75rem;
  color: var(--gray-600);
}

.activity-count {
  position: absolute;
  top: -25px;
  font-size: 0.75rem;
  color: var(--gray-600);
}

.action-chart,
.department-chart {
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  gap: 1rem;
  height: 100%;
  padding: 1rem 0;
}

.action-item,
.department-item {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.action-name,
.department-name {
  width: 120px;
  font-size: 0.85rem;
  color: var(--gray-700);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.action-bar-container,
.department-bar-container {
  flex: 1;
  height: 24px;
  background: var(--gray-100);
  border-radius: 4px;
  position: relative;
}

.action-bar,
.department-bar {
  height: 100%;
  background: var(--primary-500);
  border-radius: 4px;
  transition: width 0.5s ease;
}

.action-count,
.department-count {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.75rem;
  color: white;
  font-weight: 500;
}

.no-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--gray-400);
}

.no-data i {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.department-section h3 {
  font-size: 1rem;
  color: var(--gray-700);
  margin-bottom: 1rem;
}

.department-chart-container {
  height: 300px;
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