import { createRouter, createWebHistory } from 'vue-router'
import MainView from '@/views/side_1_main.vue'
import AnalysisView from '@/views/side_2_analysis.vue'
import AddonView from '@/views/side_3_addon.vue'
import AdminDashboard from '@/views/side_admin1_dashboard.vue'
import UserManagement from '@/views/side_admin2_users.vue'
import SettingsView from '@/views/side_admin3_settings.vue'
import UserCountView from '@/views/side_admin4_user-count.vue'
import UserManagementView from '@/views/side_4_management.vue'
import store from '@/store'

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
    path: '/addon',
    name: 'Addon',
    component: AddonView
  },
  {
    path: '/admin/dashboard',
    name: 'AdminDashboard',
    component: AdminDashboard,
    meta: { requiresAuth: true, requiresAdmin: true }
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
  // Check if route requires authentication
  if (to.matched.some(record => record.meta.requiresAuth)) {
    // Ensure auth state is checked
    if (!store.getters['auth/isAuthChecked']) {
      await store.dispatch('auth/checkAuth')
    }
    
    const isAuthenticated = store.getters['auth/isAuthenticated']
    const user = store.state.auth.user
    
    if (!isAuthenticated) {
      // Store intended destination for after login
      sessionStorage.setItem('redirectAfterLogin', to.fullPath)
      
      // Allow navigation to continue to root route where login modal will show
      next({ path: '/' })
      return
    }
    
    // Check if route requires admin role
    if (to.matched.some(record => record.meta.requiresAdmin)) {
      // Check if user has admin role
      const hasAdminRole = user && 
        (user.roles?.includes('admin') || user.permission === 'admin')
      
      if (!hasAdminRole) {
        next({ path: '/' })
        return
      }
    }
  }
  
  next()
})

export default router 