<template>
  <footer class="dashboard-footer" :class="{ 'sidebar-collapsed': isSidebarCollapsed }">
    <div class="footer-content">
      <div class="footer-info">
        <p>© 2024 MSA Dashboard. All rights reserved.</p>
      </div>
      <div class="footer-links">
        <a href="#" class="footer-link">도움말</a>
        <a href="#" class="footer-link">문의하기</a>
        <a href="#" class="footer-link">API 문서</a>
      </div>
    </div>
  </footer>
</template>

<script>
import { inject } from 'vue'

export default {
  name: 'MainFooter',
  setup() {
    // App.vue로부터 사이드바 상태 주입
    const isSidebarCollapsed = inject('isSidebarCollapsed', false)
    
    return {
      isSidebarCollapsed
    }
  }
}
</script>

<style scoped>
.dashboard-footer {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(5px);
  padding: 0.75rem 0;
  border-top: 1px solid var(--gray-200);
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  z-index: 100;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
}

.footer-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 2rem 0 calc(250px + 2rem); /* 사이드바 너비 고려 */
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: padding 0.3s ease;
}

.sidebar-collapsed .footer-content {
  padding-left: calc(70px + 2rem);
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

@media (max-width: 1200px) {
  .footer-content {
    padding: 0 1.5rem; /* 모바일에서는 사이드바 패딩 제거 */
    flex-direction: column;
    text-align: center;
    gap: 0.5rem;
  }
  
  .sidebar-collapsed .footer-content {
    padding-left: calc(250px + 1.5rem);
  }

  .footer-links {
    justify-content: center;
  }
}

@media (max-width: 768px) {
  .footer-content, .sidebar-collapsed .footer-content {
    padding: 0 1rem;
  }
}
</style>
