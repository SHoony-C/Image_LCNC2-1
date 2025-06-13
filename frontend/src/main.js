import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import store from './store'
import './assets/main.css'
import LogService from './utils/logService'
import mitt from 'mitt'

// 전역 이벤트 버스 생성
const eventBus = mitt()

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
axios.interceptors.request.use(function (config) {
  // 요청 보내기 전에 수행할 로직
  return config;
}, function (error) {
  // 요청 에러 처리
  return Promise.reject(error);
});

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

// 전역 이벤트 버스와 MSA 간 통신을 위한 전역 객체 설정
window.MSAEventBus = eventBus
window.MSASharedData = {
  currentImage: null,
  similarImages: []
}

// ResizeObserver 루프 오류를 무시하는 글로벌 핸들러 추가
const originalError = window.console.error;
window.console.error = function(...args) {
  if (args[0] && typeof args[0] === 'string' && args[0].includes('ResizeObserver loop')) {
    // ResizeObserver 루프 오류 무시
    return;
  }
  originalError.apply(console, args);
};

// 전역 에러 이벤트 핸들러 추가
window.addEventListener('error', (event) => {
  if (event.message && event.message.includes('ResizeObserver loop')) {
    event.stopPropagation();
    event.preventDefault();
    return false;
  }
}, true);

// Vue 프로덕션 하이드레이션 경고 해결
window.__VUE_PROD_HYDRATION_MISMATCH_DETAILS__ = false

const app = createApp(App)
const pinia = createPinia()

// 전역 이벤트 버스를 앱 인스턴스에 추가
app.config.globalProperties.$eventBus = eventBus

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