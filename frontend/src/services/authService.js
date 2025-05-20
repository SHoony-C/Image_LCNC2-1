import apiClient from './api';

const authService = {
  /**
   * 로그인 요청
   * @param {string} username 사용자명
   * @param {string} password 비밀번호
   * @returns {Promise} 로그인 결과 및 토큰
   */
  login(username, password) {
    // Use management login for backward compatibility
    return apiClient.post('/management/login', { username, password })
      .then(response => {
        if (response.data.access_token) {
          localStorage.setItem('token', response.data.access_token);
          localStorage.setItem('user', JSON.stringify(response.data.user));
        }
        return response.data;
      })
      .catch(() => {
        // Try the new SQL-based login if management login fails
        return apiClient.post('/users/login', { username, password })
          .then(response => {
            if (response.data.access_token) {
              localStorage.setItem('token', response.data.access_token);
              localStorage.setItem('user', JSON.stringify(response.data.user));
            }
            return response.data;
          });
      });
  },

  /**
   * 로그아웃
   */
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return Promise.resolve();
  },

  /**
   * 회원가입 요청
   * @param {Object} user 사용자 정보
   * @returns {Promise} 회원가입 결과
   */
  register(user) {
    // Try new SQL-based registration
    return apiClient.post('/users/register', user)
      .catch(() => {
        // Fall back to the old endpoint if new one fails
        console.log('SQL registration failed, trying MongoDB fallback');
        return apiClient.post('/management/register', user);
      });
  },

  /**
   * 현재 로그인한 사용자 정보 조회
   * @returns {Promise} 사용자 정보
   */
  getCurrentUser() {
    return apiClient.get('/auth/check-auth', {
      params: { token: localStorage.getItem('token') }
    });
  },

  /**
   * 토큰 갱신
   * @returns {Promise} 새로운 토큰
   */
  refreshToken() {
    return apiClient.post('/users/refresh-token')
      .then(response => {
        if (response.data.access_token) {
          localStorage.setItem('token', response.data.access_token);
        }
        return response.data;
      })
      .catch(() => {
        // Fall back to old endpoint if new one fails
        return apiClient.post('/auth/refresh-token')
          .then(response => {
            if (response.data.token) {
              localStorage.setItem('token', response.data.token);
            }
            return response.data;
          });
      });
  },

  /**
   * 비밀번호 재설정 요청
   * @param {string} email 이메일
   * @returns {Promise} 요청 결과
   */
  requestPasswordReset(email) {
    return apiClient.post('/users/forgot-password', { email })
      .catch(() => {
        // Fall back to old endpoint if new one fails
        return apiClient.post('/auth/forgot-password', { email });
      });
  },

  /**
   * 비밀번호 재설정
   * @param {string} token 인증 토큰
   * @param {string} newPassword 새 비밀번호
   * @returns {Promise} 재설정 결과
   */
  resetPassword(token, newPassword) {
    return apiClient.post('/users/reset-password', { token, newPassword })
      .catch(() => {
        // Fall back to old endpoint if new one fails
        return apiClient.post('/auth/reset-password', { token, newPassword });
      });
  }
};

export default authService; 