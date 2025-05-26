<template>
  <div class="server-error-container">
    <div class="error-card">
      <div class="error-icon">
        <i class="fas fa-exclamation-triangle"></i>
      </div>
      <h2>서버 연결 오류</h2>
      <p class="error-message">
        백엔드 서버에 연결할 수 없습니다. 다음 사항을 확인해주세요:
      </p>
      <ul class="error-checklist">
        <li>백엔드 서버가 실행 중인지 확인해주세요 (기본 포트: 8000)</li>
        <li>CORS 설정이 올바르게 구성되어 있는지 확인해주세요</li>
        <li>네트워크 연결 상태를 확인해주세요</li>
      </ul>
      <div class="server-command">
        <p>백엔드 서버 시작 명령어:</p>
        <div class="command-box">
          <code>python backend/main.py</code>
          <button class="copy-btn" @click="copyCommand">
            <i class="fas fa-copy"></i>
          </button>
        </div>
      </div>
      <button class="retry-btn" @click="retryConnection">
        <i class="fas fa-sync-alt"></i> 다시 시도
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ServerConnectionError',
  methods: {
    retryConnection() {
      window.location.reload();
    },
    copyCommand() {
      navigator.clipboard.writeText('python backend/main.py')
        .then(() => {
          alert('명령어가 클립보드에 복사되었습니다.');
        })
        .catch(err => {
          console.error('클립보드 복사 실패:', err);
        });
    }
  }
}
</script>

<style scoped>
.server-error-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #f8fafc;
  padding: 1rem;
}

.error-card {
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  padding: 2.5rem;
  width: 100%;
  max-width: 600px;
  text-align: center;
}

.error-icon {
  font-size: 3rem;
  color: #e53e3e;
  margin-bottom: 1rem;
}

h2 {
  color: #2d3748;
  font-size: 1.5rem;
  margin-bottom: 1rem;
}

.error-message {
  color: #4a5568;
  margin-bottom: 1.5rem;
  font-size: 1rem;
  line-height: 1.5;
}

.error-checklist {
  text-align: left;
  margin: 0 auto 2rem;
  max-width: 400px;
  color: #4a5568;
  line-height: 1.6;
}

.error-checklist li {
  margin-bottom: 0.75rem;
  position: relative;
  padding-left: 1.5rem;
}

.error-checklist li::before {
  content: '•';
  position: absolute;
  left: 0;
  color: #e53e3e;
  font-weight: bold;
}

.server-command {
  margin-bottom: 2rem;
}

.server-command p {
  font-weight: 600;
  color: #4a5568;
  margin-bottom: 0.5rem;
}

.command-box {
  background-color: #2d3748;
  color: #fff;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: monospace;
  margin: 0 auto;
  max-width: 400px;
}

.copy-btn {
  background: none;
  border: none;
  color: #a0aec0;
  cursor: pointer;
  font-size: 1rem;
  transition: color 0.2s;
}

.copy-btn:hover {
  color: white;
}

.retry-btn {
  background-color: #7950f2;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.retry-btn:hover {
  background-color: #6741d9;
}

@media (max-width: 480px) {
  .error-card {
    padding: 1.5rem;
  }
  
  .command-box {
    font-size: 0.8rem;
  }
}
</style> 