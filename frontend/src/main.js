import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import store from './store'
import './assets/main.css'
import LogService from './utils/logService'

// Font Awesome
import '@fortawesome/fontawesome-free/css/all.css'

// 전역 스타일 파일
import './assets/css/global.css'

// Material Icons
import '@mdi/font/css/materialdesignicons.css'

// axios 글로벌 설정
import axios from 'axios'
axios.defaults.baseURL = process.env.VUE_APP_API_URL || 'http://localhost:8000'
axios.defaults.headers.common['Content-Type'] = 'application/json'

// axios 요청 인터셉터
axios.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  },
  error => Promise.reject(error)
)

// axios 응답 인터셉터 - 인증 오류 처리
axios.interceptors.response.use(
  response => response,
  error => {
    // 401 에러를 처리 (인증 만료)
    if (error.response && error.response.status === 401) {
      // 토큰 만료 또는 인증 오류
      console.warn('인증 오류 발생, 인증 상태 초기화')
      store.commit('auth/CLEAR_AUTH')
      
      // 401 오류 로깅
      LogService.logAction('auth_error', {
        status: 401,
        path: window.location.pathname
      }).catch(e => console.error('로깅 실패:', e))
      
      // 로그인 페이지로 리다이렉트
      if (router.currentRoute.value.path !== '/') {
        router.push('/')
      }
    }
    return Promise.reject(error)
  }
)

// Vue 프로덕션 하이드레이션 경고 해결
window.__VUE_PROD_HYDRATION_MISMATCH_DETAILS__ = false

const app = createApp(App)
const pinia = createPinia()

// 글로벌 에러 핸들러
app.config.errorHandler = (err, vm, info) => {
  console.error('App Error:', err)
  console.log('Vue Instance:', vm)
  console.log('Error Info:', info)
  
  // 애플리케이션 오류 로깅
  LogService.logAction('app_error', {
    error: err.message,
    info: info,
    component: vm?.$options?.name || 'unknown'
  }).catch(e => console.error('로깅 실패:', e))
}

// 앱 마운트 전 인증 확인 및 앱 시작 로깅
Promise.all([
  store.dispatch('auth/checkAuth'),
  LogService.logAction('app_start', {
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString()
  }).catch(e => console.error('시작 로깅 실패:', e))
]).then(() => {
  app.use(pinia)
  app.use(store)
  app.use(router)
  app.mount('#app')
}).catch(err => {
  console.error('앱 초기화 오류:', err)
  // 에러가 발생해도 앱은 시작
  app.use(pinia)
  app.use(store)
  app.use(router)
  app.mount('#app')
}) 