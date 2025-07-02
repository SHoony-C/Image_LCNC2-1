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
            <i class="fas fa-signal"></i>
          </div>
          <div class="stat-info">
            <h3>실시간 사용자 수 (세션 수)</h3>
            <p class="stat-value">{{ statistics.active_sessions || 0 }}</p>
            <p class="stat-change positive" v-if="statistics.active_sessions_change">{{ statistics.active_sessions_change > 0 ? '+' : '' }}{{ statistics.active_sessions_change }}%</p>
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
            <div v-if="filteredActions && filteredActions.length > 0" class="action-chart">
              <div v-for="(action, index) in filteredActions" :key="index" class="action-item">
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

      <div class="visitor-table">
        <h3>최근 접속자 (최근 100명)</h3>
        <div class="table-container">
          <table v-if="statistics.recent_visitors && statistics.recent_visitors.length > 0">
            <thead>
              <tr>
                <th>사용자명</th>
                <th>이메일</th>
                <th>부서</th>
                <th>최근 접속 시간</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="visitor in statistics.recent_visitors" :key="`${visitor.user_id}-${visitor.timestamp}`">
                <td>{{ visitor.full_name || visitor.username || '익명' }}</td>
                <td>{{ visitor.email || '-' }}</td>
                <td>{{ visitor.department || '-' }}</td>
                <td>{{ formatDateTime(visitor.timestamp) }}</td>
              </tr>
            </tbody>
          </table>
          <div v-else class="no-data">
            <i class="fas fa-eye"></i>
            <p>최근 접속자 데이터가 없습니다</p>
          </div>
        </div>
      </div>
      
      <div class="department-section">
        <h3>부서별 사용자 분포 top 7 ({{ getMonthlyDateRange() }})</h3>
        <div class="department-chart-container">
          <div v-if="topDepartmentStats && topDepartmentStats.length > 0" class="department-chart">
            <div v-for="(dept, index) in topDepartmentStats" :key="index" class="department-bar-container">
              <div class="department-bar" :style="{ height: getDepartmentBarHeight(dept.count) + '%' }"></div>
              <span class="department-name">{{ dept.department || '부서 미지정' }}</span>
              <span class="department-count">{{ dept.count }}</span>
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
        active_sessions: 0,
        new_users: 0,
        recent_visitors: [],
        daily_activity: [],
        department_stats: [],
        top_actions: []
      },
      // 임의의 증가율 (실제로는 이전 기간과 비교해야 함)
      total_users_change: 15.2,
      active_sessions_change: 8.5,
      new_users_change: 12.3
    };
  },
  
  computed: {
    maxActivityCount() {
      if (!this.statistics.daily_activity || this.statistics.daily_activity.length === 0) return 1;
      return Math.max(...this.statistics.daily_activity.map(day => day.count)) || 1;
    },
    maxActionCount() {
      if (!this.filteredActions || this.filteredActions.length === 0) return 1;
      return Math.max(...this.filteredActions.map(action => action.count)) || 1;
    },
    maxDepartmentCount() {
      if (!this.statistics.department_stats || this.statistics.department_stats.length === 0) return 1;
      return Math.max(...this.statistics.department_stats.map(dept => dept.count)) || 1;
    },
    filteredActions() {
      if (!this.statistics.top_actions || this.statistics.top_actions.length === 0) return [];
      return this.statistics.top_actions.filter(action => 
        action.action_type && !action.action_type.includes('error')
      );
    },
    topDepartmentStats() {
      if (!this.statistics.department_stats || this.statistics.department_stats.length === 0) return [];
      return this.statistics.department_stats
        .sort((a, b) => b.count - a.count)
        .slice(0, 7);
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
        // 현재 달의 시작일과 종료일 계산
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0);
        
        // 날짜를 YYYY-MM-DD 형식으로 변환
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        
        const response = await axios.get('http://localhost:8000/api/users/user-statistics', {
          params: {
            start_date: startDateStr,
            end_date: endDateStr
          }
        });
        
        if (response.data && response.data.status === 'success') {
          this.statistics = {
            ...response.data.statistics,
            total_users_change: this.total_users_change,
            active_sessions_change: this.active_sessions_change,
            new_users_change: this.new_users_change
          };
          
          // console.log('통계 데이터 로드 완료:', this.statistics);
        } else {
          throw new Error('서버에서 유효한 데이터를 받지 못했습니다');
        }
      } catch (error) {
        // console.error('통계 데이터 로드 실패:', error);
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
             this.padZero(date.getDate()) + ' ' +
             this.padZero(date.getHours()) + ':' +
             this.padZero(date.getMinutes());
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
    },
    
    getMonthlyDateRange() {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);
      
      const formatKoreanDate = (date) => {
        return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
      };
      
      return `${formatKoreanDate(startDate)} ~ ${formatKoreanDate(endDate)}`;
    },
    
    getDepartmentBarHeight(count) {
      if (!this.topDepartmentStats || this.topDepartmentStats.length === 0) return 20;
      
      // 상위 7개 부서 중 최대값을 구함
      const maxCount = Math.max(...this.topDepartmentStats.map(dept => dept.count));
      if (maxCount === 0) return 20;
      
      // 모든 값이 1이면 모두 100% 높이로 표시
      if (maxCount === 1 && this.topDepartmentStats.every(dept => dept.count === 1)) {
        return 100;
      }
      
      // 비율 계산 (최대값을 100%로 설정)
      const percentage = (count / maxCount) * 100;
      
      // 최소 높이 보장 (20% 이상)
      return Math.max(percentage, 20);
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

.visitor-table, .department-section {
  background: white;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.visitor-table .table-container {
  overflow-x: auto;
  max-height: 400px;
  overflow-y: auto;
}

.visitor-table table {
  width: 100%;
  border-collapse: collapse;
  min-width: 600px;
}

.visitor-table th,
.visitor-table td {
  padding: 0.75rem 1rem;
  text-align: left;
  border-bottom: 1px solid var(--gray-200);
  white-space: nowrap;
}

.visitor-table th {
  font-weight: 600;
  color: var(--gray-600);
  font-size: 0.875rem;
  background: var(--gray-50);
  position: sticky;
  top: 0;
  z-index: 1;
}

.visitor-table td {
  color: var(--gray-700);
  font-size: 0.875rem;
}

.visitor-table tr:hover {
  background: var(--gray-50);
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

.action-chart {
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  gap: 1rem;
  height: 100%;
  padding: 1rem 0;
}

.action-item {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.action-name {
  width: 120px;
  font-size: 0.85rem;
  color: var(--gray-700);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.action-bar-container {
  flex: 1;
  height: 24px;
  background: var(--gray-100);
  border-radius: 4px;
  position: relative;
  margin-right: 50px;
}

.action-bar {
  height: 100%;
  background: var(--primary-500);
  border-radius: 4px;
  transition: width 0.5s ease;
}

.action-count {
  position: absolute;
  right: -40px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.75rem;
  color: var(--gray-600);
  font-weight: 500;
  min-width: 30px;
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

.department-chart {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  height: 100%;
  padding: 0 1rem;
  padding-bottom: 3rem;
}

.department-bar-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  height: 85%;
  position: relative;
  justify-content: flex-end;
}

.department-bar {
  width: 40px;
  background: var(--primary-500);
  border-radius: 4px 4px 0 0;
  transition: height 0.5s ease;
  min-height: 10px;
}

.department-name {
  position: absolute;
  bottom: -40px;
  font-size: 0.75rem;
  color: var(--gray-600);
  white-space: nowrap;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}

.department-count {
  position: absolute;
  top: -25px;
  font-size: 0.75rem;
  color: var(--gray-600);
  font-weight: 500;
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
  
  .visitor-table .table-container {
    max-height: 300px;
  }
}
</style> 