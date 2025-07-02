<template>
  <div class="user-management-page">
    <div class="header">
      <h1>User Management</h1>
      <p class="subtitle">Manage system users and permissions</p>
    </div>

    <div class="content-wrapper">
      <div v-if="error" class="error-message">
        <i class="fas fa-exclamation-triangle"></i>
        <span>{{ errorMessage }}</span>
      </div>

      <div v-else class="user-management-content">
        <div class="header-actions">
          <button class="refresh-btn" @click="fetchUsers" :disabled="loading">
            <i class="fas fa-sync" :class="{ 'fa-spin': loading }"></i> 
            {{ loading ? '로딩 중...' : '사용자 목록 Refresh' }}
          </button>
          <button class="add-user-btn" @click="showAddUserModal = true">
            <i class="fas fa-user-plus"></i> 사용자 추가
          </button>
        </div>

        <div class="filters">
          <div class="search-box">
            <i class="fas fa-search"></i>
            <input 
              type="text" 
              v-model="searchQuery"
              placeholder="사용자 검색..."
              @input="filterUsers"
            >
          </div>
          <div class="role-filters">
            <label class="filter-label">역할:</label>
            <div class="filter-options">
              <label class="role-option">
                <input type="checkbox" v-model="roleFilters.admin"> 관리자
              </label>
              <label class="role-option">
                <input type="checkbox" v-model="roleFilters.manager"> 매니저
              </label>
              <label class="role-option">
                <input type="checkbox" v-model="roleFilters.user"> 일반 사용자
              </label>
            </div>
          </div>
        </div>

        <div class="user-table-container">
          <table class="user-table">
            <thead>
              <tr>
                <th>이름</th>
                <th>사용자명</th>
                <th>이메일</th>
                <th>역할</th>
                <th>상태</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="6" class="loading-row">
                  <div class="loading-spinner">
                    <i class="fas fa-spinner fa-spin"></i> 사용자 목록 로딩 중...
                  </div>
                </td>
              </tr>
              <tr v-else-if="users.length === 0 && !error">
                <td colspan="6" class="empty-row">
                  <div class="info-message">
                    <i class="fas fa-info-circle"></i>
                    사용자 목록을 불러오려면 상단의 '사용자 목록 불러오기' 버튼을 클릭하세요.
                  </div>
                </td>
              </tr>
              <tr v-else-if="filteredUsers.length === 0">
                <td colspan="6" class="empty-row">
                  사용자가 없거나 검색 조건에 일치하는 사용자가 없습니다.
                </td>
              </tr>
              <tr v-for="user in filteredUsers" :key="user.id" :class="{ 'inactive-user': !user.is_active }">
                <td>{{ user.full_name || '-' }}</td>
                <td>{{ user.username }}</td>
                <td>{{ user.email || '-' }}</td>
                <td>
                  <div class="role-badges">
                    <span 
                      class="role-badge"
                      :class="getRoleBadgeClass(user.permission)"
                    >
                      {{ getRoleLabel(user.permission) }}
                    </span>
                  </div>
                </td>
                <td>
                  <span 
                    class="status-badge"
                    :class="user.is_active ? 'status-active' : 'status-inactive'"
                  >
                    {{ user.is_active ? '활성' : '비활성' }}
                  </span>
                </td>
                <td>
                  <div class="action-buttons">
                    <button class="action-btn edit-btn" @click="openEditModal(user)">
                      <i class="fas fa-edit"></i>
                    </button>
                    <button 
                      class="action-btn" 
                      :class="user.is_active ? 'deactivate-btn' : 'activate-btn'"
                      @click="toggleUserStatus(user)"
                    >
                      <i :class="user.is_active ? 'fas fa-user-slash' : 'fas fa-user-check'"></i>
                    </button>
                    <button class="action-btn delete-btn" @click="confirmDeleteUser(user)">
                      <i class="fas fa-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 사용자 추가 모달 -->
    <div class="modal" v-if="showAddUserModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>사용자 추가</h2>
          <button class="close-btn" @click="showAddUserModal = false">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="addUser">
            <div class="form-group">
              <label for="username">사용자명 *</label>
              <input 
                type="text" 
                id="username" 
                v-model="newUser.username"
                required
                placeholder="사용자명 입력"
              >
            </div>
            <div class="form-group">
              <label for="email">이메일 *</label>
              <input 
                type="email" 
                id="email" 
                v-model="newUser.email"
                required
                placeholder="이메일 입력"
              >
            </div>
            <div class="form-group">
              <label for="fullName">이름</label>
              <input 
                type="text" 
                id="fullName" 
                v-model="newUser.fullName"
                placeholder="이름 입력"
              >
            </div>
            <div class="form-group">
              <label for="department">부서</label>
              <input 
                type="text" 
                id="department" 
                v-model="newUser.department"
                placeholder="부서 입력"
              >
            </div>
            <div class="form-group">
              <label for="password">비밀번호 *</label>
              <div class="password-input">
                <input 
                  :type="showPassword ? 'text' : 'password'" 
                  id="password" 
                  v-model="newUser.password"
                  required
                  placeholder="비밀번호 입력"
                >
                <button 
                  type="button"
                  class="toggle-password"
                  @click="showPassword = !showPassword"
                >
                  <i :class="showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
                </button>
              </div>
            </div>
            <div class="form-group">
              <label>권한 *</label>
              <select v-model="newUser.permission" class="role-select">
                <option value="user">일반 사용자</option>
                <option value="manager">매니저</option>
                <option value="sub-admin">부관리자</option>
                <option value="admin">관리자</option>
              </select>
            </div>
            <button type="submit" class="submit-btn" :disabled="loading">
              <span v-if="loading"><i class="fas fa-spinner fa-spin"></i> 처리 중...</span>
              <span v-else>사용자 추가</span>
            </button>
          </form>
        </div>
      </div>
    </div>

    <!-- 사용자 편집 모달 -->
    <div class="modal" v-if="showEditModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>사용자 정보 수정</h2>
          <button class="close-btn" @click="showEditModal = false">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <form @submit.prevent="updateUser">
            <div class="form-group">
              <label for="edit-username">사용자명</label>
              <input 
                type="text" 
                id="edit-username" 
                v-model="editingUser.username"
                disabled
              >
            </div>
            <div class="form-group">
              <label for="edit-email">이메일</label>
              <input 
                type="email" 
                id="edit-email" 
                v-model="editingUser.email"
                required
              >
            </div>
            <div class="form-group">
              <label for="edit-fullName">이름</label>
              <input 
                type="text" 
                id="edit-fullName" 
                v-model="editingUser.full_name"
                placeholder="이름 입력"
              >
            </div>
            <div class="form-group">
              <label for="edit-department">부서</label>
              <input 
                type="text" 
                id="edit-department" 
                v-model="editingUser.department"
                placeholder="부서 입력"
              >
            </div>
            <div class="form-group">
              <label for="edit-password">비밀번호 변경 (변경 시에만 입력)</label>
              <div class="password-input">
                <input 
                  :type="showEditPassword ? 'text' : 'password'" 
                  id="edit-password" 
                  v-model="editingUser.password"
                  placeholder="새 비밀번호 입력"
                >
                <button 
                  type="button"
                  class="toggle-password"
                  @click="showEditPassword = !showEditPassword"
                >
                  <i :class="showEditPassword ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
                </button>
              </div>
            </div>
            <div class="form-group">
              <label>권한 *</label>
              <select v-model="editingUser.permission" class="role-select">
                <option value="user">일반 사용자</option>
                <option value="manager">매니저</option>
                <option value="sub-admin">부관리자</option>
                <option value="admin">관리자</option>
              </select>
            </div>
            <button type="submit" class="submit-btn" :disabled="loading">
              <span v-if="loading"><i class="fas fa-spinner fa-spin"></i> 처리 중...</span>
              <span v-else>저장</span>
            </button>
          </form>
        </div>
      </div>
    </div>

    <!-- 삭제 확인 모달 -->
    <div class="modal" v-if="showDeleteModal">
      <div class="modal-content delete-modal">
        <div class="modal-header">
          <h2>사용자 삭제</h2>
          <button class="close-btn" @click="showDeleteModal = false">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <p class="delete-message">
            <i class="fas fa-exclamation-triangle"></i>
            정말 <strong>{{ userToDelete?.username }}</strong> 사용자를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
          </p>
          <div class="confirm-actions">
            <button 
              class="cancel-btn" 
              @click="showDeleteModal = false"
            >
              취소
            </button>
            <button 
              class="confirm-delete-btn" 
              @click="deleteUser"
              :disabled="loading"
            >
              <span v-if="loading"><i class="fas fa-spinner fa-spin"></i> 처리 중...</span>
              <span v-else>삭제</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'UserManagement',
  data() {
    return {
      users: [],
      filteredUsers: [],
      loading: false,
      error: false,
      errorMessage: '',
      searchQuery: '',
      roleFilters: {
        admin: true,
        'sub-admin': true,
        manager: true,
        user: true
      },
      showAddUserModal: false,
      showEditModal: false,
      showDeleteModal: false,
      showPassword: false,
      showEditPassword: false,
      newUser: {
        username: '',
        email: '',
        fullName: '',
        department: '',
        password: '',
        permission: 'user'
      },
      editingUser: {
        id: null,
        username: '',
        email: '',
        full_name: '',
        department: '',
        permission: '',
        is_active: true
      },
      userToDelete: null
    };
  },
  created() {
    // 기본 로그만 남기기
    // console.log("UserManagement component created - SQL debugging enabled");
    // 초기 API 호출 제거 (접속 시 자동 호출하지 않음)
    // this.fetchUsers();
  },
  methods: {
    async fetchUsers() {
      this.loading = true;
      this.error = false;
      
      try {
        // console.log("SQL DEBUG: Fetching users from /api/users/users-noauth (인증 없는 엔드포인트)");
        
        // 인증이 필요 없는 엔드포인트 사용
        const response = await axios.get('http://localhost:8000/api/users/users-noauth', {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });
        
        // console.log("SQL DEBUG: Response received, status:", response.status);
        
        if (response.data.status === 'success') {
          this.users = response.data.users.map(user => {
            return {
              ...user,
              fullName: user.full_name
            };
          });
          this.filterUsers();
          // console.log(`SQL DEBUG: Loaded ${this.users.length} users`);
        } else {
          this.error = true;
          this.errorMessage = '사용자 목록을 불러오는데 실패했습니다.';
          // console.error("API error: Response not successful");
        }
      } catch (error) {
        // console.error('SQL DEBUG ERROR:', error.message);
        if (error.response) {
          // console.error('Error status:', error.response.status);
          // console.error('Error details:', error.response.data);
        } else if (error.request) {
          // console.error('No response received:', error.request);
        } else {
          // console.error('Error in request setup:', error);
        }
        
        this.error = true;
        
        if (error.response && error.response.status === 403) {
          this.errorMessage = '권한이 없습니다. 관리자 계정으로 로그인하세요.';
          this.$router.push('/main');
        } else if (error.response) {
          this.errorMessage = `오류 ${error.response.status}: ${error.response.data?.detail || '알 수 없는 오류'}`;
        } else if (error.request) {
          this.errorMessage = '서버 연결에 실패했습니다. 백엔드 서버가 실행 중인지 확인하세요.';
        } else {
          this.errorMessage = '사용자 목록을 불러오는데 오류가 발생했습니다.';
        }
      } finally {
        this.loading = false;
      }
    },
    filterUsers() {
      if (!this.users) return;
      
      this.filteredUsers = this.users.filter(user => {
        // 검색어 필터링
        const searchMatch = 
          !this.searchQuery || 
          user.username.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
          (user.email && user.email.toLowerCase().includes(this.searchQuery.toLowerCase())) ||
          (user.fullName && user.fullName.toLowerCase().includes(this.searchQuery.toLowerCase()));
        
        // 역할 필터링
        let roleMatch = false;
        if (this.roleFilters.admin && user.permission === 'admin') roleMatch = true;
        else if (this.roleFilters.manager && user.permission === 'manager') roleMatch = true;
        else if (this.roleFilters.user && user.permission === 'user') roleMatch = true;
        
        return searchMatch && roleMatch;
      });
    },
    getRoleBadgeClass(role) {
      if (role === 'admin') return 'role-admin';
      if (role === 'manager') return 'role-manager';
      if (role === 'sub-admin') return 'role-subadmin';
      return 'role-user';
    },
    getRoleLabel(role) {
      if (role === 'admin') return '관리자';
      if (role === 'manager') return '매니저';
      if (role === 'sub-admin') return '부관리자';
      return '일반 사용자';
    },
    openEditModal(user) {
      this.editingUser = {
        id: user.id,
        username: user.username,
        email: user.email || '',
        full_name: user.full_name || '',
        department: user.department || '',
        password: '',
        permission: user.permission,
        is_active: user.is_active
      };
      this.showEditModal = true;
    },
    async updateUser() {
      this.loading = true;
      
      try {
        // console.log("함수 호출: updateUser() - 인증 없는 엔드포인트 사용");
        
        // 사용자 정보 업데이트
        const userData = {
          email: this.editingUser.email,
          full_name: this.editingUser.full_name,
          department: this.editingUser.department,
          permission: this.editingUser.permission
        };
        
        if (this.editingUser.password) {
          userData.password = this.editingUser.password;
        }
        
        // console.log("API Request - Update User:", {
        //   url: `http://localhost:8000/api/users/user-noauth/${this.editingUser.id}`,
        //   method: 'put',
        //   userId: this.editingUser.id
        // });
        
        // 인증 없는 엔드포인트 사용
        const response = await axios.put(`http://localhost:8000/api/users/user-noauth/${this.editingUser.id}`, userData, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });
        
        if (response.data.status === 'success') {
          alert('사용자 정보가 업데이트되었습니다.');
          this.showEditModal = false;
          this.fetchUsers();
        } else {
          throw new Error('업데이트 실패: 서버 응답이 올바르지 않습니다.');
        }
      } catch (error) {
        // console.error('Failed to update user:', error);
        
        // 오류 메시지 정리
        let errorMsg = '사용자 정보 업데이트에 실패했습니다.';
        if (error.response && error.response.data && error.response.data.detail) {
          errorMsg += ` (${error.response.data.detail})`;
        }
        
        alert(errorMsg);
      } finally {
        this.loading = false;
      }
    },
    async addUser() {
      this.loading = true;
      
      try {
        // console.log("------------- SQL 쿼리 디버깅 로그 시작 -------------");
        // console.log("함수 호출: addUser() - 인증 없는 엔드포인트 사용");
        
        // JSON 형식으로 데이터 준비
        const userData = {
          username: this.newUser.username,
          email: this.newUser.email,
          password: this.newUser.password,
          full_name: this.newUser.fullName,
          department: this.newUser.department,
          permission: this.newUser.permission
        };
        
        // 사용자 추가 정보 로깅
        // console.log("API 요청 정보:");
        // console.log("- 엔드포인트: /api/users/user-noauth (인증 없음)");
        // console.log("- 메서드: POST");
        // console.log("- 요청 데이터:");
        // console.log("  username:", this.newUser.username);
        // console.log("  email:", this.newUser.email);
        // console.log("  full_name:", this.newUser.fullName);
        // console.log("  department:", this.newUser.department);
        // console.log("  permission:", this.newUser.permission);
        // console.log("  password: [보안 정보 - 표시하지 않음]");
        // console.log("- 예상 SQL 쿼리: INSERT INTO users (username, email, full_name, department, permission, hashed_password) VALUES (?, ?, ?, ?, ?, ?)");
        // console.log("요청 시작 시간:", new Date().toISOString());
        
        // API 호출 - 인증 필요 없는 엔드포인트 사용
        const response = await axios.post('http://localhost:8000/api/users/user-noauth', userData, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });
        
        // console.log("요청 완료 시간:", new Date().toISOString());
        // console.log("응답 상태 코드:", response.status);
        // console.log("응답 데이터:", JSON.stringify(response.data, null, 2));
        // console.log("------------- SQL 쿼리 디버깅 로그 종료 -------------");
        
        alert('사용자가 성공적으로 추가되었습니다.');
        this.showAddUserModal = false;
        this.resetNewUserForm();
        this.fetchUsers();
      } catch (error) {
        // console.error('------------- SQL 쿼리 디버깅 로그 오류 -------------');
        // console.error('Failed to add user:', error);
        // console.error('Error details:', error.response?.data || error.message);
        // console.error('Error status:', error.response?.status);
        
        let errorMsg = '사용자 추가에 실패했습니다.';
        if (error.response && error.response.data && error.response.data.detail) {
          errorMsg += ` (${error.response.data.detail})`;
        }
        alert(errorMsg);
      } finally {
        this.loading = false;
      }
    },
    async toggleUserStatus(user) {
      this.loading = true;
      
      try {
        const token = localStorage.getItem('token');
        const newStatus = !user.is_active;
        
        // console.log("API Request - Toggle Status:", {
        //   url: `http://localhost:8000/api/users/user/${user.id}`,
        //   method: 'put',
        //   userId: user.id,
        //   newStatus: newStatus
        // });
        
        const response = await axios({
          method: 'put',
          url: `http://localhost:8000/api/users/user/${user.id}`,
          data: { is_active: newStatus },
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.data.status === 'success') {
          user.is_active = newStatus;
          alert(`사용자가 ${newStatus ? '활성화' : '비활성화'}되었습니다.`);
        } else {
          throw new Error('상태 변경 실패: 서버 응답이 올바르지 않습니다.');
        }
      } catch (error) {
        // console.error('Failed to toggle user status:', error);
        
        // 오류 메시지 정리
        let errorMsg = '사용자 상태 변경에 실패했습니다.';
        if (error.response && error.response.data && error.response.data.detail) {
          errorMsg += ` (${error.response.data.detail})`;
        }
        
        alert(errorMsg);
      } finally {
        this.loading = false;
      }
    },
    confirmDeleteUser(user) {
      this.userToDelete = user;
      this.showDeleteModal = true;
    },
    async deleteUser() {
      if (!this.userToDelete) return;
      
      this.loading = true;
      
      try {
        // console.log("함수 호출: deleteUser() - 인증 없는 엔드포인트 사용");
        
        // console.log("API Request - Delete User:", {
        //   url: `http://localhost:8000/api/users/user-noauth/${this.userToDelete.id}`,
        //   method: 'delete',
        //   userId: this.userToDelete.id
        // });
        
        // 인증 없는 엔드포인트 사용
        const response = await axios.delete(`http://localhost:8000/api/users/user-noauth/${this.userToDelete.id}`, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });
        
        if (response.data.status === 'success') {
          this.showDeleteModal = false;
          this.userToDelete = null;
          this.fetchUsers();
          alert('사용자가 삭제되었습니다.');
        } else {
          throw new Error('삭제 실패: 서버 응답이 올바르지 않습니다.');
        }
      } catch (error) {
        // console.error('Failed to delete user:', error);
        
        // 오류 메시지 정리
        let errorMsg = '사용자 삭제에 실패했습니다.';
        if (error.response && error.response.status === 400) {
          errorMsg = error.response.data.detail || '사용자 삭제에 실패했습니다.';
        } else if (error.response && error.response.data && error.response.data.detail) {
          errorMsg += ` (${error.response.data.detail})`;
        }
        
        alert(errorMsg);
      } finally {
        this.loading = false;
      }
    },
    resetNewUserForm() {
      this.newUser = {
        username: '',
        email: '',
        fullName: '',
        department: '',
        password: '',
        permission: 'user'
      };
    }
  }
};
</script>

<style scoped>
.user-management-page {
  padding: 2rem;
  max-width: 100%;
  margin: 0 auto;
  min-height: 100vh;
  background-color: #f8f9fa;
}

.header {
  margin-bottom: 2rem;
}

.header h1 {
  font-size: 2rem;
  color: #7950f2;
  margin: 0 0 0.5rem 0;
  font-weight: 700;
}

.subtitle {
  color: #718096;
  margin: 0;
  font-size: 1rem;
}

.error-message {
  background-color: #fff5f5;
  border-left: 4px solid #e53e3e;
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  color: #c53030;
}

.error-message i {
  margin-right: 0.5rem;
  font-size: 1.2rem;
}

.info-message {
  background-color: #ebf8ff;
  border-left: 4px solid #4299e1;
  padding: 1rem;
  border-radius: 4px;
  margin: 1rem;
  display: flex;
  align-items: center;
  color: #2b6cb0;
}

.info-message i {
  margin-right: 0.5rem;
  font-size: 1.2rem;
}

.content-wrapper {
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  padding: 2rem;
}

.user-management-content {
  width: 100%;
}

.header-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1.5rem;
}

.refresh-btn {
  background-color: #7950f2;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.75rem 1.25rem;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: background-color 0.2s;
}

.refresh-btn:hover {
  background-color: #6741d9;
}

.add-user-btn {
  background-color: #7950f2;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.75rem 1.25rem;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: background-color 0.2s;
}

.add-user-btn:hover {
  background-color: #6741d9;
}

.filters {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem;
  background-color: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.search-box {
  position: relative;
  width: 300px;
}

.search-box i {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #a0aec0;
}

.search-box input {
  width: 100%;
  padding: 10px 10px 10px 35px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.9rem;
}

.role-filters {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.filter-label {
  font-weight: 600;
  color: #4a5568;
}

.filter-options {
  display: flex;
  gap: 1rem;
}

.role-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.user-table-container {
  overflow: auto;
  max-height: 70vh;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin-top: 1rem;
}

.user-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.user-table th {
  background-color: #f8f9fa;
  padding: 1rem;
  text-align: left;
  font-weight: 600;
  color: #4a5568;
  border-bottom: 2px solid #e9ecef;
  position: sticky;
  top: 0;
}

.user-table td {
  padding: 1rem;
  border-bottom: 1px solid #e9ecef;
  color: #2d3748;
}

.loading-row, .empty-row {
  text-align: center;
  color: #718096;
  padding: 2rem !important;
}

.loading-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.role-badges {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.role-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.role-admin {
  background-color: #fed7d7;
  color: #c53030;
}

.role-manager {
  background-color: #c3dafe;
  color: #4c51bf;
}

.role-user {
  background-color: #c6f6d5;
  color: #276749;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-active {
  background-color: #c6f6d5;
  color: #276749;
}

.status-inactive {
  background-color: #e2e8f0;
  color: #718096;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  background: #f7fafc;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #edf2f7;
}

.edit-btn {
  color: #4299e1;
}

.deactivate-btn {
  color: #ed8936;
}

.activate-btn {
  color: #38a169;
}

.delete-btn {
  color: #e53e3e;
}

.inactive-user {
  background-color: #f7fafc;
  opacity: 0.7;
}

/* 모달 스타일 */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background-color: white;
  border-radius: 12px;
  width: 500px;
  max-width: 90%;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.delete-modal {
  width: 400px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem;
  background-color: #7950f2;
  color: white;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0;
}

.modal-body {
  padding: 1.5rem;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #4a5568;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.9rem;
}

.password-input {
  position: relative;
}

.toggle-password {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #a0aec0;
  cursor: pointer;
  padding: 0;
}

.role-select {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.9rem;
}

.submit-btn {
  width: 100%;
  padding: 0.75rem;
  background-color: #7950f2;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.submit-btn:hover {
  background-color: #6741d9;
}

.submit-btn:disabled {
  background-color: #b794f4;
  cursor: not-allowed;
}

.delete-message {
  text-align: center;
  font-size: 1rem;
  line-height: 1.5;
  margin-bottom: 1.5rem;
  color: #4a5568;
}

.delete-message i {
  color: #e53e3e;
  font-size: 1.5rem;
  margin-right: 0.5rem;
}

.confirm-actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
}

.cancel-btn {
  padding: 0.75rem 1.5rem;
  border: 1px solid #e2e8f0;
  background-color: white;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  color: #4a5568;
}

.cancel-btn:hover {
  background-color: #f7fafc;
}

.confirm-delete-btn {
  padding: 0.75rem 1.5rem;
  background-color: #e53e3e;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.confirm-delete-btn:hover {
  background-color: #c53030;
}

.confirm-delete-btn:disabled {
  background-color: #feb2b2;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .filters {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  
  .search-box {
    width: 100%;
  }
  
  .role-filters {
    width: 100%;
  }
  
  .action-buttons {
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .role-select {
    width: 100%;
  }
}
</style> 