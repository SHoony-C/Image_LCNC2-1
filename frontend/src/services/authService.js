import apiClient from './api';

const authService = {
  /**
   * 로그인 요청
   * @param {string} username 사용자명
   * @param {string} password 비밀번호
   * @returns {Promise} 로그인 결과 및 토큰
   */
  login(username, password) {
    return apiClient.post('/auth/login', { username, password })
      .then(response => {
        if (response.data.token) {
          localStorage.setItem('token', response.data.token);
          localStorage.setItem('user', JSON.stringify(response.data.user));
        }
        return response.data;
      });
  },

  /**
   * 로그아웃
   */
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return apiClient.post('/auth/logout');
  },

  /**
   * 회원가입 요청
   * @param {Object} user 사용자 정보
   * @returns {Promise} 회원가입 결과
   */
  register(user) {
    return apiClient.post('/auth/register', user);
  },

  /**
   * 현재 로그인한 사용자 정보 조회
   * @returns {Promise} 사용자 정보
   */
  getCurrentUser() {
    return apiClient.get('/auth/me');
  },

  /**
   * 토큰 갱신
   * @returns {Promise} 새로운 토큰
   */
  refreshToken() {
    return apiClient.post('/auth/refresh-token')
      .then(response => {
        if (response.data.token) {
          localStorage.setItem('token', response.data.token);
        }
        return response.data;
      });
  },

  /**
   * 비밀번호 재설정 요청
   * @param {string} email 이메일
   * @returns {Promise} 요청 결과
   */
  requestPasswordReset(email) {
    return apiClient.post('/auth/forgot-password', { email });
  },

  /**
   * 비밀번호 재설정
   * @param {string} token 인증 토큰
   * @param {string} newPassword 새 비밀번호
   * @returns {Promise} 재설정 결과
   */
  resetPassword(token, newPassword) {
    return apiClient.post('/auth/reset-password', { token, newPassword });
  }
};

export default authService; 