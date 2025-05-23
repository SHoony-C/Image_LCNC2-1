<template>
  <div class="main-view">
    <!-- Server connection error component -->
    <ServerConnectionError v-if="serverError" />
    
    <div v-else>
      <!-- 기존 사용자 아이콘 섹션 제거하고 AppHeader 추가 -->
      <AppHeader pageTitle="I-App Main" />
      
      <div class="mobile-header">
        <button class="hamburger-btn" @click="toggleSidebar">
          <i class="fas fa-bars"></i>
        </button>
      </div>

      <div class="content">
        <div class="sidebar" :class="{ 'sidebar-open': isSidebarOpen }">
          <div class="sidebar-header">
            <h3>메뉴</h3>
            <button class="close-btn" @click="toggleSidebar">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <nav class="sidebar-nav">
            <a href="#" class="nav-item">메뉴 1</a>
            <a href="#" class="nav-item">메뉴 2</a>
            <a href="#" class="nav-item">메뉴 3</a>
          </nav>
        </div>
        <div class="msa-grid">
          <div class="top-row">
            <MSA1ImageInput class="msa-card msa1" />
            <MSA2LLMAnalysis class="msa-card msa2" />
            <MSA3LLMAnalysis2 class="msa-card msa3" />
          </div>
          <div class="bottom-row">
            <MSA4VectorTransform class="msa-card msa4" />
            <MSA5ImageLCNC class="msa-card msa5" />
            <MSA6FinalResult class="msa-card msa6" />
          </div>
        </div>
      </div>
      <MainFooter />
      <div class="sidebar-overlay" v-if="isSidebarOpen" @click="toggleSidebar"></div>
      
      <!-- 로그인 모달 추가 -->
      <LoginModal 
        :show="showLoginModal" 
        @close="showLoginModal = false"
        @login-success="handleLoginSuccess"
      />
    </div>
  </div>
</template>

<script>
import MSA1ImageInput from '@/components/msa1_image_input.vue'
import MSA2LLMAnalysis from '@/components/msa2_llm_analysis.vue'
import MSA3LLMAnalysis2 from '@/components/msa3_llm_analysis2.vue'
import MSA4VectorTransform from '@/components/msa4_vector_transform.vue'
import MSA5ImageLCNC from '@/components/msa5_image_lcnc.vue'
import MSA6FinalResult from '@/components/msa6_final_result.vue'
import MainFooter from '@/views/m0_footer.vue'
import LoginModal from '@/components/login_modal.vue'
import ServerConnectionError from '@/components/ServerConnectionError.vue'
import AppHeader from '@/components/AppHeader.vue'
import axios from 'axios'

// Add click-outside directive
const clickOutside = {
  beforeMount: (el, binding) => {
    el.clickOutsideEvent = (event) => {
      if (!(el === event.target || el.contains(event.target))) {
        binding.value(event);
      }
    };
    document.addEventListener('click', el.clickOutsideEvent);
  },
  unmounted: (el) => {
    document.removeEventListener('click', el.clickOutsideEvent);
  },
};

export default {
  name: 'MSADashboard',
  components: {
    MSA1ImageInput,
    MSA2LLMAnalysis,
    MSA3LLMAnalysis2,
    MSA4VectorTransform,
    MSA5ImageLCNC,
    MSA6FinalResult,
    MainFooter,
    LoginModal,
    ServerConnectionError,
    AppHeader
  },
  directives: {
    clickOutside
  },
  data() {
    return {
      isSidebarOpen: false,
      showLoginModal: false,
      isAuthenticated: false,
      currentUser: null,
      authChecked: false,
      serverError: false,
      showUserMenu: false
    }
  },
  created() {
    // Add event listener for clicks outside dropdown
    document.addEventListener('click', this.closeOnOutsideClick);
    
    // URL 파라미터에서 토큰 확인 (SSO 리다이렉트 처리)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const userId = urlParams.get('user_id');
    const errorParam = urlParams.get('error');
    
    if (token && userId) {
      // SSO로부터 받은 토큰 저장
      localStorage.setItem('token', token);
      
      // URL에서 파라미터 제거 (보안을 위해)
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      
      // 사용자 정보 조회
      this.checkAuthentication();
    } else if (errorParam) {
      alert('로그인 중 오류가 발생했습니다. 다시 시도해주세요.');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      // 기존 로그인 세션 확인
      this.checkAuthentication();
    }
    
    // Test server connection
    this.testServerConnection();
  },
  beforeUnmount() {
    // Clean up event listener
    document.removeEventListener('click', this.closeOnOutsideClick);
  },
  methods: {
    toggleSidebar() {
      this.isSidebarOpen = !this.isSidebarOpen;
    },
    toggleUserMenu(event) {
      // Stop event propagation to prevent immediate closing
      if (event) {
        event.stopPropagation();
      }
      console.log("Toggling user menu, current state:", this.showUserMenu);
      this.showUserMenu = !this.showUserMenu;
    },
    closeOnOutsideClick(event) {
      const dropdown = document.querySelector('.user-dropdown');
      const avatar = document.querySelector('.user-avatar-circle');
      
      if (this.showUserMenu && 
          dropdown && 
          avatar && 
          !dropdown.contains(event.target) && 
          !avatar.contains(event.target)) {
        this.showUserMenu = false;
      }
    },
    async testServerConnection() {
      try {
        // Try to connect to the health endpoint
        await axios.get('/health');
        this.serverError = false;
      } catch (error) {
        console.error('Server connection test failed:', error);
        if (error.code === 'ERR_NETWORK') {
          this.serverError = true;
        }
      }
    },
    async checkAuthentication() {
      const token = localStorage.getItem('token');
      
      if (!token) {
        this.isAuthenticated = false;
        this.currentUser = null;
        this.authChecked = true;
        // Automatically show login modal if not authenticated
        this.showLoginModal = true;
        return;
      }
      
      try {
        const response = await axios.get('/api/auth/check-auth', {
          params: { token }
        });
        
        if (response.data.authenticated) {
          this.isAuthenticated = true;
          this.currentUser = response.data.user;
          // 로그인 상태가 확인되면 로그인 모달이 표시되지 않도록 설정
          this.showLoginModal = false;
        } else {
          this.isAuthenticated = false;
          this.currentUser = null;
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          // Automatically show login modal if authentication check fails
          this.showLoginModal = true;
        }
      } catch (error) {
        console.error('Authentication check error:', error);
        this.isAuthenticated = false;
        this.currentUser = null;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Automatically show login modal if authentication check errors
        this.showLoginModal = true;
        
        // Check if it's a network error
        if (error.code === 'ERR_NETWORK') {
          this.serverError = true;
        }
      }
      
      this.authChecked = true;
    },
    handleLoginSuccess(user) {
      this.isAuthenticated = true;
      this.currentUser = user;
    },
    async handleLogout() {
      try {
        await axios.get('/api/auth/slo');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('remember');
        
        this.isAuthenticated = false;
        this.currentUser = null;
        this.showUserMenu = false;
      } catch (error) {
        console.error('Logout error:', error);
        
        // Force logout even if server request fails
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('remember');
        
        this.isAuthenticated = false;
        this.currentUser = null;
        
        // Check if it's a network error
        if (error.code === 'ERR_NETWORK') {
          this.serverError = true;
        }
      }
    },
    getRoleClass(roles) {
      if (roles && roles.includes('admin')) return 'role-admin';
      if (roles && roles.includes('manager')) return 'role-manager';
      return 'role-user';
    },
    getRoleLabel(roles) {
      if (roles && roles.includes('admin')) return '관리자';
      if (roles && roles.includes('manager')) return '매니저';
      return '사용자';
    },
    hasRole(roleName) {
      return this.currentUser && this.currentUser.roles && this.currentUser.roles.includes(roleName);
    },
    goToManagement() {
      this.$router.push('/admin/users');
    },
    viewProfile() {
      // Implement profile view functionality
      alert('프로필 기능은 개발 중입니다.');
      this.showUserMenu = false;
    }
  }
}
</script>

<style scoped>
.main-view {
  padding: clamp(1.5rem, 3vw, 2.5rem);
  background: var(--primary-50);
  min-height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  position: relative;
}

.page-title {
  width: 100%;
  text-align: center;
  margin-top: 3rem; /* Add space for the user icon at the top */
  margin-bottom: 1rem;
}

.page-title h1 {
  font-size: 2rem;
  font-weight: 700;
  color: var(--primary-800);
  margin: 0;
  letter-spacing: -0.5px;
}

.title-underline {
  width: 50px;
  height: 3px;
  background: var(--primary-600);
  margin: 0.5rem auto 0;
  border-radius: 2px;
}

.content {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  flex: 1;
}

.msa-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
  width: 100%;
  height: 100%;
  flex: 1;
  margin-bottom: 1rem;
  overflow: hidden !important;
  position: relative;
}

.top-row {
  display: grid;
  grid-template-columns: 1.2fr 2fr 2fr;
  gap: 0.5rem;
  width: 100%;
  height: 35% !important;
  min-height: 200px;
  max-height: 35% !important;
  overflow: hidden !important;
  position: relative;
}

.bottom-row {
  display: grid;
  grid-template-columns: 1.5fr 3.5fr 1fr;
  gap: 0.5rem;
  width: 100%;
  height: 65% !important;
  min-height: 200px;
  max-height: 65% !important;
  overflow: hidden !important;
  position: relative;
}

.msa-card {
  background: white;
  border-radius: 15px;
  padding: 0.75rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  overflow: hidden !important;
  height: [MSA4] No vector data available, creating dummy visualization
  !important;
  width: 100% !important;
  position: relative;
}

.msa1, .msa2, .msa3, .msa4, .msa5, .msa6 {
  height: 100% !important;
  width: 100% !important;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden !important;
  position: relative;
}

.msa-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

@media (max-width: 1600px) {
  .top-row {
    grid-template-columns: 1fr 1.5fr 1.5fr;
  }
}

@media (max-width: 1400px) {
  .top-row {
    grid-template-columns: 1fr 1fr 1fr;
    height: 35% !important;
  }

  .bottom-row {
    height: 65% !important;
  }
}

@media (max-width: 1200px) {
  .content {
    height: auto;
  }

  .top-row {
    grid-template-columns: 1fr;
    height: auto;
  }
  
  .bottom-row {
    grid-template-columns: 1fr;
    height: auto;
  }

  .msa1, .msa2, .msa3, .msa4, .msa5, .msa6 {
    min-height: 300px;
    height: auto;
  }

  .msa5-6-container {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .msa-card {
    margin-bottom: 1rem;
  }

  .mobile-header {
    display: block;
  }

  .main-view {
    padding-top: 0;
  }
}

@media (max-width: 768px) {
  .msa-grid {
    gap: 1rem;
    padding: 0.5rem;
  }
}

.dashboard-footer {
  background: rgba(255, 255, 255, 0.8);
  padding: 0.75rem 0;
  border-top: 1px solid var(--gray-200);
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
}

.footer-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer-info {
  color: var(--gray-500);
}

.footer-info p {
  margin: 0;
  font-size: 0.85rem;
}

.footer-links {
  display: flex;
  gap: 1.5rem;
}

.footer-link {
  color: var(--primary-600);
  text-decoration: none;
  font-size: 0.85rem;
  transition: color 0.3s ease;
}

.footer-link:hover {
  color: var(--primary-700);
}

.mobile-header {
  display: none;
  padding: 1rem;
  background: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

.hamburger-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--primary-600);
  cursor: pointer;
  padding: 0.5rem;
}

.sidebar {
  position: fixed;
  top: 0;
  left: -300px;
  width: 300px;
  height: 100vh;
  background: white;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
  transition: left 0.3s ease;
  z-index: 1000;
}

.sidebar-open {
  left: 0;
}

.sidebar-header {
  padding: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--gray-200);
}

.sidebar-header h3 {
  margin: 0;
  color: var(--primary-800);
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.25rem;
  color: var(--gray-600);
  cursor: pointer;
}

.sidebar-nav {
  padding: 1rem;
}

.nav-item {
  display: block;
  padding: 1rem;
  color: var(--gray-800);
  text-decoration: none;
  transition: background 0.2s;
  border-radius: 8px;
}

.nav-item:hover {
  background: var(--primary-50);
  color: var(--primary-600);
}

.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
}

.msa4-container {
  height: calc(100vh - 200px); /* 뷰포트 높이에서 헤더와 여백을 뺀 크기 */
  min-height: 500px;
}

/* Plotly and SVG elements styles to ensure fixed heights */
:deep(.js-plotly-plot),
:deep(.plotly), 
:deep(.plot-container),
:deep(.svg-container),
:deep(.main-svg) {
  width: 100% !important;
  height: 100% !important;
  max-height: 100% !important;
  overflow: hidden !important;
}

/* Ensure all components maintain fixed size */
:deep(.msa-component),
:deep(.msa-container),
:deep(.main-layout) {
  height: 100% !important;
  max-height: 100% !important;
  overflow: hidden !important;
  display: flex !important;
  flex-direction: column !important;
}

/* Fixed size for msa4 component */
:deep(.msa4) .msa-component {
  height: 100% !important;
  max-height: 100% !important;
  overflow: hidden !important;
}

/* User auth section */
.user-auth-section {
  display: none; /* 기존 사용자 인증 섹션 숨김 */
}

.user-icon-container {
  position: relative;
}

.user-avatar-circle {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background-color: #4a5568;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: white;
  font-size: 1.2rem;
  transition: background-color 0.2s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.user-avatar-circle:hover {
  background-color: #2d3748;
}

/* User dropdown menu */
.user-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  width: 280px;
  background: #1a202c;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  overflow: hidden;
  animation: slideDown 0.2s ease-out;
  color: #e2e8f0;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dropdown-header {
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  background-color: #2d3748;
}

.user-avatar-large {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  background-color: #4a5568;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.5rem;
}

.user-details {
  flex: 1;
}

.user-email {
  font-weight: 500;
  color: #e2e8f0;
  margin-bottom: 0.25rem;
}

.user-id {
  font-size: 0.875rem;
  color: #a0aec0;
}

.dropdown-divider {
  height: 1px;
  background-color: #4a5568;
  margin: 0;
}

.dropdown-menu-items {
  padding: 0.5rem 0;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  color: #cbd5e0;
  text-decoration: none;
  transition: background-color 0.2s;
}

.dropdown-item:hover {
  background-color: #2d3748;
}

.dropdown-item i {
  width: 1.5rem;
  text-align: center;
  color: #a0aec0;
}

.logout-item {
  color: #fc8181;
}

.logout-item i {
  color: #fc8181;
}

/* Hide the previous user bar */
.user-auth-bar {
  display: none;
}
</style> 