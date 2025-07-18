import { createRouter, createWebHistory } from 'vue-router'
import MainView from '@/views/side_1_main.vue'
import AnalysisView from '@/views/side_2_analysis.vue'
import TableManagementView from '@/views/side_3_Table Management.vue'
import login_modal from '@/components/login_modal.vue'
import UserManagement from '@/views/side_admin2_users.vue'
import SettingsView from '@/views/side_admin3_settings.vue'
import UserCountView from '@/views/side_admin4_user-count.vue'
import UserManagementView from '@/views/side_4_management.vue'
import store from '@/store'
import LogService from '../utils/logService'

const routes = [
  {
    path: '/',
    redirect: '/main'
  },
  {
    path: '/main',
    name: 'Main',
    component: MainView
  },
  {
    path: '/analysis',
    name: 'Analysis',
    component: AnalysisView
  },
  {
    path: '/table-management',
    name: 'TableManagementView',
    component: TableManagementView
  },
  {
    path: '/admin',
    name: 'Admin',
    component: login_modal
  },
  {
    path: '/admin/login',
    name: 'self_login',
    component: login_modal,
  },
  {
    path: '/admin/users',
    name: 'UserManagement',
    component: UserManagement,
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/admin/settings',
    name: 'Settings',
    component: SettingsView,
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/admin/user-count',
    name: 'UserCount',
    component: UserCountView,
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/management',
    name: 'UserManagementView',
    component: UserManagementView,
    meta: { requiresAuth: true, requiresAdmin: true }
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

// Navigation guard for authentication
router.beforeEach(async (to, from, next) => {
  // 페이지 타이틀 설정
  document.title = to.meta.title || 'Image - Total AI Platform'
  
  // 페이지 접근 로깅 (비동기 실행, 페이지 로딩 속도에 영향 없도록)
  setTimeout(() => {
    try {
      LogService.logPageVisit(to.name || to.path);
    } catch (error) {
      console.error('페이지 방문 로깅 실패:', error);
    }
  }, 0);
  
  // 환경변수 기반 SSO 조건부 처리
  const useSSO = process.env.VUE_APP_USE_SSO === 'true'
  
  // 원래 인증 체크 로직
  // Ensure auth state is checked
  if (!store.getters['auth/isAuthChecked']) {
    await store.dispatch('auth/checkAuth')
  }
  
  const isAuthenticated = store.getters['auth/isAuthenticated']
  const user = store.state.auth.user
  
  // Check if route requires authentication
  if (to.matched.some(record => record.meta.requiresAuth)) {
    if (!isAuthenticated) {
      if (useSSO) {
        // Store intended destination for after login
        sessionStorage.setItem('redirectAfterLogin', to.fullPath)
        
        // 바로 SSO 로그인으로 리다이렉트
        window.location.href = 'http://localhost:8000/api/auth/google/login'
        return
      } else {
        // 개발 환경에서는 인증 없이 패스
        console.log('개발 환경: 인증 없이 페이지 접근 허용')
        next()
        return
      }
    }
  }
  
  // Check if route requires admin role
  if (to.matched.some(record => record.meta.requiresAdmin)) {
    // Check if user has admin permission
    const hasAdminRole = user && user.permission === 'admin'
    
    if (!hasAdminRole) {
      if (useSSO) {
        console.log('Admin 권한이 필요한 페이지 접근 차단:', to.path)
        next({ path: '/' })
        return
      } else {
        // 개발 환경에서는 관리자 권한 없이도 패스
        console.log('개발 환경: 관리자 권한 없이 페이지 접근 허용')
        next()
        return
      }
    }
  }
  
  next()
})

export default router 