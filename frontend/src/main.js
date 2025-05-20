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

app.use(pinia)
app.use(store)
app.use(router)
app.mount('#app') 