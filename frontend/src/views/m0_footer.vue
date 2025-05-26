<template>
  <footer class="dashboard-footer">
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
export default {
  name: 'MainFooter'
}
</script>

<style scoped>
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

@media (max-width: 1200px) {
  .footer-content {
    flex-direction: column;
    text-align: center;
    gap: 1rem;
  }

  .footer-links {
    justify-content: center;
  }
}
</style>
