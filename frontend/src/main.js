import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import store from './store'
import './assets/main.css'

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
}

// 앱 마운트 전 인증 확인
store.dispatch('auth/checkAuth').then(() => {
  app.use(pinia)
  app.use(store)
  app.use(router)
  app.mount('#app')
}) 