<template>
  <div class="main-view">
    <!-- AppHeader를 최상단으로 이동하여 다른 페이지들과 통일화 -->
    <AppHeader pageTitle="I-Tap Main" />
    
    <!-- Server connection error component -->
    <ServerConnectionError v-if="serverError" />
    
    <div v-else class="main-container">
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
            <MSA2VectorPlot class="msa-card msa2" />
            <div class="msa-card msa3-wrapper">
              <MSA3ImageDisplay 
                v-if="true" 
                class="msa3" 
                @send-analysis-data="handleAnalysisData"
              />
            </div>
          </div>
          <div class="bottom-row">
            <MSA4LLMAnalysis 
              class="msa-card msa4" 
              ref="msa4Component"
            />
            <MSA5ImageLCNC class="msa-card msa5" />
            <MSA6FinalResult class="msa-card msa6" />
          </div>
        </div>
      </div>
      <div class="sidebar-overlay" v-if="isSidebarOpen" @click="toggleSidebar"></div>
      
      <!-- 로그인 모달 추가 -->
      <LoginModal 
        :show="showLoginModal" 
        @close="showLoginModal = false"
        @login-success="handleLoginSuccess"
      />

      <!-- 패치노트 팝업 -->
      <PatchNoteModal 
        :show="showPatchNote" 
        @close="showPatchNote = false"
      />

    </div>
  </div>
</template>

<script>
import MSA1ImageInput from '@/components/msa1_image_input.vue'
import MSA2VectorPlot from '@/components/msa2_vector_plot.vue'
import MSA3ImageDisplay from '@/components/msa3_image_display.vue'
import MSA4LLMAnalysis from '@/components/msa4_llm_analysis.vue'
import MSA5ImageLCNC from '@/components/msa5_image_lcnc.vue'
import MSA6FinalResult from '@/components/msa6_final_result.vue'
import LoginModal from '@/components/login_modal.vue'
import ServerConnectionError from '@/components/ServerConnectionError.vue'
import AppHeader from '@/components/AppHeader.vue'
import axios from 'axios'
import PatchNoteModal from '@/components/PatchNoteModal.vue'


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
    MSA2VectorPlot,
    MSA3ImageDisplay,
    MSA4LLMAnalysis,
    MSA5ImageLCNC,
    MSA6FinalResult,
    LoginModal,
    ServerConnectionError,
    AppHeader,
    PatchNoteModal
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
      showUserMenu: false,
      resizeObserverTimeout: null,
      showPatchNote: false
    }
  },
  created() {

    window.addEventListener('showPatchNote', () => {
      this.showPatchNote = true;
    });
    // Add event listener for clicks outside dropdown
    document.addEventListener('click', this.closeOnOutsideClick);
    
    // URL 파라미터에서 토큰 확인 (SSO 리다이렉트 처리)
    const urlParams = new URLSearchParams(window.location.search);
    const id_token = urlParams.get('id_token');
    const userId = urlParams.get('user_id');
    const errorParam = urlParams.get('error');
    
    if (id_token && userId) {
      // SSO로부터 받은 토큰 저장
      localStorage.setItem('id_token', id_token);
      
      // URL에서 파라미터 제거 (보안을 위해)
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);

      // SSO 로그인 성공 시 패치노트 표시
      const hasSeenPatchNote = localStorage.getItem('patchNoteSeen');
      console.log('패치노트 체크');
      if (!hasSeenPatchNote) {
        console.log('패치노트 표시');
        this.showPatchNote = true;
        localStorage.setItem('patchNoteSeen', 'true');
      }
      
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
    
    // ResizeObserver 오류 방지를 위한 글로벌 핸들러
    window.addEventListener('error', (event) => {
      if (event.message && event.message.includes('ResizeObserver loop')) {
        event.stopPropagation();
        event.preventDefault();
      }
    });
  },

  beforeDestroy() {
    // 이벤트 리스너 정리
    window.removeEventListener('showPatchNote', () => {
      this.showPatchNote = true;
    });
    document.removeEventListener('click', this.closeOnOutsideClick);
  },

  mounted() {
    window.addEventListener('showPatchNote', this.openPatchNote)
    // 레이아웃 안정화를 위한 지연 처리
    this.$nextTick(() => {
      // MSA 컴포넌트 간 통신을 위한 전역 객체 확인 및 생성
      if (!window.MSASharedData) {
        console.log('전역 MSASharedData 객체가 없습니다. 생성합니다.');
        window.MSASharedData = {
          currentImage: null,
          similarImages: []
        };
      }
      
      // 전역 이벤트 버스 확인 및 생성
      if (!window.MSAEventBus) {
        console.log('전역 MSAEventBus 객체가 없습니다. 생성합니다.');
        // 간단한 이벤트 버스 구현
        window.MSAEventBus = {
          events: {},
          on(event, callback) {
            if (!this.events[event]) {
              this.events[event] = [];
            }
            this.events[event].push(callback);
          },
          off(event, callback) {
            if (this.events[event]) {
              this.events[event] = this.events[event].filter(cb => cb !== callback);
            }
          },
          emit(event, data) {
            if (this.events[event]) {
              this.events[event].forEach(callback => {
                try {
                  callback(data);
                } catch (e) {
                  console.error('Error in event handler:', e);
                }
              });
            }
          }
        };
      }
      
      // 컴포넌트가 마운트된 후 약간의 지연을 두고 레이아웃 안정화
      setTimeout(() => {
        const msa3El = document.querySelector('.msa3');
        if (msa3El) {
          // MSA3 컴포넌트의 명시적 크기 설정으로 ResizeObserver 루프 방지
          const parent = msa3El.parentElement;
          if (parent) {
            const parentHeight = parent.offsetHeight;
            const parentWidth = parent.offsetWidth;
            msa3El.style.height = `${parentHeight}px`;
            msa3El.style.width = `${parentWidth}px`;
          }
        }
      }, 100);
    });
  },
  beforeUnmount() {
    // Clean up event listener
    document.removeEventListener('click', this.closeOnOutsideClick);
    window.removeEventListener('showPatchNote', this.openPatchNote);
  },
  methods: {
    openPatchNote() {
      console.log('[MainPage] showPatchNote 이벤트 수신 → 모달 열기')
      this.showPatchNote = true
    },
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
        await axios.get('https://10.172.107.194/api/health');
        this.serverError = false;
      } catch (error) {
        console.error('Server connection test failed:', error);
        if (error.code === 'ERR_NETWORK') {
          this.serverError = true;
        }
      }
    },
    async checkAuthentication() {
      const useSSO = process.env.VUE_APP_USE_SSO === 'true'
      const id_token = localStorage.getItem('id_token');

      // API 호출
        const response_ssd = await fetch('https://ssd.pds.samsungds.net/api/v0/count/add', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept' : '*/*'
          },
          body:  JSON.stringify({"appId": "8d190441-6458-43f8-bb3e-c98d411b0911"})
        });

      // API 호출
        const response = await fetch('https://10.172.107.194/api/msa6/save-with-table-name', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestData)
        });
      
      if (!id_token) {
        if (useSSO) {
          this.isAuthenticated = false;
          this.currentUser = null;
          this.authChecked = true;
          // /main 경로이므로 바로 SSO 로그인으로 리다이렉트
          window.location.href = 'https://10.172.107.194/api/auth/samsung/login';
          return;
        } else {
          // 개발 환경에서는 개발용 토큰 설정
          console.log('개발 환경: 토큰이 없음, 개발용 토큰 설정')
          const devToken = 'dev-token-' + Date.now()
          const devUser = {
            id: 'dev-user',
            username: '개발자',
            email: 'dev@example.com',
            full_name: '개발자',
            permission: 'admin',
            is_active: true
          }
          localStorage.setItem('token', devToken)
          localStorage.setItem('user', JSON.stringify(devUser))
          this.isAuthenticated = true;
          this.currentUser = devUser;
          this.authChecked = true;
          const hasSeenPatchNote = localStorage.getItem('patchNoteSeen');
          if (!hasSeenPatchNote) {
            console.log('패치노트 표시 (개발 환경) → 최초 표시');  // ← 여기에 로그 추가
            this.showPatchNote = true;
            localStorage.setItem('patchNoteSeen', 'true');
          }
          return;
        }
      }
      
      try {
        const response = await axios.get('https://10.172.107.194/api/auth/check-auth', {
          params: {
              id_token: id_token,
              username: JSON.parse(localStorage.getItem('user'))?.username,
              mail: JSON.parse(localStorage.getItem('user'))?.mail,
              department: JSON.parse(localStorage.getItem('user'))?.department
          },
        });
        
        if (response.data.authenticated) {
          this.isAuthenticated = true;
          this.currentUser = response.data.user;
          // 로그인 상태가 확인되면 로그인 모달이 표시되지 않도록 설정
          this.showLoginModal = false;
          // 최초 로그인 시에만 패치노트 표시 (localStorage로 확인)
          const hasSeenPatchNote = localStorage.getItem('patchNoteSeen');
          if (!hasSeenPatchNote) {
            console.log('패치노트 표시 (개발 환경) → 최초 표시');  // ← 여기에 로그 추가
            this.showPatchNote = true;
            localStorage.setItem('patchNoteSeen', 'true');
          }
        } else {
          if (useSSO) {
            this.isAuthenticated = false;
            this.currentUser = null;
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            // /main 경로이므로 바로 SSO 로그인으로 리다이렉트
            window.location.href = 'https://10.172.107.194/api/auth/samsung/login';
          } else {
            // 개발 환경에서는 개발용 토큰 재설정
            console.log('개발 환경: 토큰 검증 실패, 개발용 토큰 재설정')
            const devToken = 'dev-token-' + Date.now()
            const devUser = {
              id: 'dev-user',
              username: '개발용 승훈',
              department:'개발부서1',
              mail: 'dev@example.com',
              full_name: '개발자',
              permission: 'admin',
              is_active: true
            }
            localStorage.setItem('token', devToken)
            localStorage.setItem('user', JSON.stringify(devUser))
            this.isAuthenticated = true;
            this.currentUser = devUser;
          }
        }
      } catch (error) {
        console.error('Authentication check error:', error);
        if (useSSO) {
          this.isAuthenticated = false;
          this.currentUser = null;
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          
          // Check if it's a network error
          if (error.code === 'ERR_NETWORK') {
            this.serverError = true;
          } else {
            // /main 경로이므로 바로 SSO 로그인으로 리다이렉트
            window.location.href = 'https://10.172.107.194/api/auth/samsung/login';
          }
        } else {
          // 개발 환경에서는 네트워크 오류 시에도 개발용 토큰 설정
          console.log('개발 환경: 네트워크 오류, 개발용 토큰 설정')
          const devToken = 'dev-token-' + Date.now()
          const devUser = {
            id: 'dev-user',
            username: '개발자',
            email: 'dev@example.com',
            full_name: '개발자',
            permission: 'admin',
            is_active: true
          }
          localStorage.setItem('token', devToken)
          localStorage.setItem('user', JSON.stringify(devUser))
          this.isAuthenticated = true;
          this.currentUser = devUser;
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
        await axios.get('https://10.172.107.194/api/auth/slo');
        localStorage.removeItem('id_token');
        localStorage.removeItem('user');
        localStorage.removeItem('remember');
        localStorage.removeItem('patchNoteSeen');
        
        this.isAuthenticated = false;
        this.currentUser = null;
        this.showUserMenu = false;
      } catch (error) {
        console.error('Logout error:', error);
        
        // Force logout even if server request fails
        localStorage.removeItem('id_token');
        localStorage.removeItem('user');
        localStorage.removeItem('remember');
        localStorage.removeItem('patchNoteSeen');
        
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
    },
    handleAnalysisData(data) {
      // Handle the analysis data from MSA3 and pass it to MSA4
      this.$refs.msa4Component.handleAnalysisData(data);
    }
  }
}
</script>

<style scoped>
/* Global container styles */
html, body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  height: 100%;
  box-sizing: border-box;
}

*, *:before, *:after {
  box-sizing: inherit;
}

.main-view {
  position: relative;
  height: 100vh;
  overflow: hidden;
  box-sizing: border-box;
}

.main-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
}

/* Content area styles */
.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
  margin: 0;
  height: calc(100vh - 55px); /* Account for header height */
  width: 100%;
  position: relative;
  box-sizing: border-box;
  overflow-y: auto;
}

/* MSA Grid layout - exact height calculation */
.msa-grid {
  display: grid;
  gap: 16px;
  grid-template-rows: minmax(300px, 1fr) minmax(300px, 1fr); /* 최소 높이 설정 */
  height: calc(100vh - 120px);
  width: 100%;
  padding: 16px;
  box-sizing: border-box;
  position: relative;
  contain: layout style; /* 레이아웃 계산 최적화 */
}

.top-row, .bottom-row {
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(200px, 1fr) minmax(400px, 2fr) minmax(200px, 1fr); /* 최소 너비 설정 */
  height: 100%;
  width: 100%;
  position: relative;
  contain: layout style; /* 레이아웃 계산 최적화 */
}

.msa-card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
  width: 100%;
  box-sizing: border-box; /* 박스 크기 계산 방식 명확히 */
}

.msa3 {
  display: block !important; /* flex에서 block으로 변경하여 크기 계산 방식 단순화 */
  background-color: white !important;
  height: 100% !important;
  width: 100% !important;
  z-index: 1;
  position: relative;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  /* 레이아웃 계산 안정화를 위한 추가 속성 */
  contain: layout style; /* 성능 최적화 및 리플로우 제한 */
  box-sizing: border-box;
}

.msa3-wrapper {
  height: 100%;
  width: 100%;
  overflow: hidden;
  display: block; /* flex에서 block으로 변경 */
  position: relative;
  padding: 0 !important;
  margin: 0 !important;
  /* 레이아웃 계산 안정화를 위한 추가 속성 */
  contain: layout style; /* 성능 최적화 및 리플로우 제한 */
  box-sizing: border-box;
}

/* Sidebar styles */
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
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #eee;
}

.sidebar-header h3 {
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
}

.sidebar-nav {
  padding: 0.5rem;
}

.nav-item {
  display: block;
  padding: 0.75rem;
  color: #333;
  text-decoration: none;
  transition: background 0.2s;
  border-radius: 4px;
}

.nav-item:hover {
  background: #f5f5f5;
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

/* Mobile header */
.mobile-header {
  display: none;
  padding: 0.75rem;
  background: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.hamburger-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.25rem;
}

/* Mobile responsive styles */
@media (max-width: 1200px) {
  .mobile-header {
    display: block;
  }
  
  .top-row,
  .bottom-row {
    grid-template-columns: 1fr;
  }
  
  .msa-grid {
    grid-template-rows: 1fr;
    height: auto;
  }
}
</style> 