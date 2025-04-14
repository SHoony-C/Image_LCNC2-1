import { createRouter, createWebHistory } from 'vue-router'
import MainView from '@/views/side_1_main.vue'
import AnalysisView from '@/views/side_2_analysis.vue'
import AddonView from '@/views/side_3_addon.vue'
import AdminDashboard from '@/views/side_admin1_dashboard.vue'
import UserManagement from '@/views/side_admin2_users.vue'
import SettingsView from '@/views/side_admin3_settings.vue'
import UserCountView from '@/views/side_admin4_user-count.vue'

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
    component: AdminDashboard
  },
  {
    path: '/admin/users',
    name: 'UserManagement',
    component: UserManagement
  },
  {
    path: '/admin/settings',
    name: 'Settings',
    component: SettingsView
  },
  {
    path: '/admin/user-count',
    name: 'UserCount',
    component: UserCountView
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

export default router 