<template>
  <div class="login-overlay" v-if="show">
    <div class="login-modal">
      <div class="login-header">
        <h2>로그인</h2>
        <button class="close-btn" @click="closeModal">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <div class="login-body">
        <!-- 일반 로그인 폼 -->
        <form @submit.prevent="handleLogin" class="login-form">
          <div class="form-group">
            <label for="username">아이디</label>
            <input
              type="text"
              id="username"
              v-model="loginForm.username"
              placeholder="아이디를 입력하세요"
              required
            >
          </div>
          
          <div class="form-group">
            <label for="password">비밀번호</label>
            <div class="password-input">
              <input
                :type="showPassword ? 'text' : 'password'"
                id="password"
                v-model="loginForm.password"
                placeholder="비밀번호를 입력하세요"
                required
              >
              <button 
                type="button" 
                class="toggle-password"
                @click="showPassword = !showPassword"
              >
                <i :class="showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
              </button>
            </div>
          </div>

          <div class="login-options">
            <div class="remember-me">
              <input type="checkbox" id="remember" v-model="loginForm.remember">
              <label for="remember">로그인 상태 유지</label>
            </div>
            <a href="#" class="forgot-password">비밀번호 찾기</a>
          </div>

          <button type="submit" class="login-btn" :disabled="isLoading">
            <span v-if="isLoading"><i class="fas fa-spinner fa-spin"></i> 로그인 중...</span>
            <span v-else>로그인</span>
          </button>
          
          <!-- SSO 로그인 버튼 -->
          <div class="sso-login-section">
            <div class="divider">또는</div>
            <button type="button" class="sso-btn" @click="handleSSOLogin">
              <i class="fas fa-building"></i> 기업계정으로 로그인
            </button>
            <button type="button" class="google-btn" @click="handleGoogleLogin">
              <i class="fab fa-google"></i> Google 계정으로 로그인
            </button>
          </div>

          <div class="signup-link">
            계정이 없으신가요? <a href="#" @click.prevent="toggleSignup">회원가입</a>
          </div>
        </form>
      </div>

      <div v-if="error" class="login-error">
        <i class="fas fa-exclamation-circle"></i> {{ error }}
      </div>
    </div>

    <!-- 회원가입 폼 -->
    <div class="signup-modal" v-if="showSignup">
      <div class="login-header">
        <h2>회원가입</h2>
        <button class="close-btn" @click="showSignup = false">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <form @submit.prevent="handleSignup" class="login-form">
        <div class="form-group">
          <label for="signup-username">아이디</label>
          <input
            type="text"
            id="signup-username"
            v-model="signupForm.username"
            placeholder="아이디를 입력하세요"
            required
          >
        </div>
        
        <div class="form-group">
          <label for="signup-email">이메일</label>
          <input
            type="email"
            id="signup-email"
            v-model="signupForm.email"
            placeholder="이메일을 입력하세요"
            required
          >
        </div>
        
        <div class="form-group">
          <label for="signup-fullname">이름</label>
          <input
            type="text"
            id="signup-fullname"
            v-model="signupForm.fullName"
            placeholder="이름을 입력하세요"
          >
        </div>
        
        <div class="form-group">
          <label for="signup-password">비밀번호</label>
          <div class="password-input">
            <input
              :type="showSignupPassword ? 'text' : 'password'"
              id="signup-password"
              v-model="signupForm.password"
              placeholder="비밀번호를 입력하세요"
              required
            >
            <button 
              type="button" 
              class="toggle-password"
              @click="showSignupPassword = !showSignupPassword"
            >
              <i :class="showSignupPassword ? 'fas fa-eye-slash' : 'fas fa-eye'"></i>
            </button>
          </div>
        </div>
        
        <div class="form-group">
          <label for="signup-confirm">비밀번호 확인</label>
          <div class="password-input">
            <input
              :type="showSignupPassword ? 'text' : 'password'"
              id="signup-confirm"
              v-model="signupForm.confirmPassword"
              placeholder="비밀번호를 다시 입력하세요"
              required
            >
          </div>
        </div>

        <button type="submit" class="login-btn" :disabled="isSigningUp">
          <span v-if="isSigningUp"><i class="fas fa-spinner fa-spin"></i> 가입 중...</span>
          <span v-else>회원가입</span>
        </button>

        <div class="signup-link">
          이미 계정이 있으신가요? <a href="#" @click.prevent="showSignup = false">로그인</a>
        </div>
      </form>

      <div v-if="signupError" class="login-error">
        <i class="fas fa-exclamation-circle"></i> {{ signupError }}
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'LoginModal',
  props: {
    show: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      loginForm: {
        username: '',
        password: '',
        remember: false
      },
      signupForm: {
        username: '',
        email: '',
        fullName: '',
        password: '',
        confirmPassword: ''
      },
      showPassword: false,
      showSignupPassword: false,
      showSignup: false,
      isLoading: false,
      isSigningUp: false,
      error: '',
      signupError: ''
    };
  },
  methods: {
    closeModal() {
      this.$emit('close');
    },
    toggleSignup() {
      this.showSignup = !this.showSignup;
      this.error = '';
      this.signupError = '';
    },
    async handleLogin() {
      this.isLoading = true;
      this.error = '';
      
      try {
        // Use form data instead of query parameters
        const formData = new FormData();
        formData.append('username', this.loginForm.username);
        formData.append('password', this.loginForm.password);
        
        const response = await axios.post('http://localhost:8000/api/users/login', formData, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
        
        if (response.data.access_token) {
          // 토큰 저장
          localStorage.setItem('token', response.data.access_token);
          localStorage.setItem('user', JSON.stringify(response.data.user));
          
          if (this.loginForm.remember) {
            localStorage.setItem('remember', 'true');
          } else {
            localStorage.removeItem('remember');
          }
          
          // 로그인 성공 이벤트
          this.$emit('login-success', response.data.user);
          this.closeModal();

          // 페이지 리다이렉트 체크 (필요한 경우)
          const redirectPath = sessionStorage.getItem('redirectAfterLogin');
          if (redirectPath) {
            sessionStorage.removeItem('redirectAfterLogin');
            this.$router.push(redirectPath);
          }
        } else {
          this.error = '로그인에 실패했습니다. 다시 시도해주세요.';
        }
      } catch (error) {
        console.error('Login error:', error);
        if (error.code === 'ERR_NETWORK') {
          this.error = '서버 연결에 실패했습니다. 백엔드 서버가 실행 중인지 확인해주세요.';
        } else {
          this.error = error.response?.data?.detail || '로그인 중 오류가 발생했습니다.';
        }
      } finally {
        this.isLoading = false;
      }
    },
    async handleSignup() {
      if (this.signupForm.password !== this.signupForm.confirmPassword) {
        this.signupError = '비밀번호가 일치하지 않습니다.';
        return;
      }
      
      this.isSigningUp = true;
      this.signupError = '';
      
      try {
        const formData = {
          username: this.signupForm.username,
          email: this.signupForm.email,
          full_name: this.signupForm.fullName,
          password: this.signupForm.password
        };
        
        console.log('Sending registration data:', formData);
        
        const response = await axios.post('http://localhost:8000/api/users/register', formData);
        
        if (response.data.status === 'success') {
          this.showSignup = false;
          this.loginForm.username = this.signupForm.username;
          this.signupForm = {
            username: '',
            email: '',
            fullName: '',
            password: '',
            confirmPassword: ''
          };
          alert('회원가입이 완료되었습니다. 로그인해주세요.');
        } else {
          this.signupError = '회원가입에 실패했습니다. 다시 시도해주세요.';
        }
      } catch (error) {
        console.error('Signup error:', error);
        if (error.code === 'ERR_NETWORK') {
          this.signupError = '서버 연결에 실패했습니다. 백엔드 서버가 실행 중인지 확인해주세요.';
        } else {
          this.signupError = error.response?.data?.detail || '회원가입 중 오류가 발생했습니다.';
        }
      } finally {
        this.isSigningUp = false;
      }
    },
    handleSSOLogin() {
      // SSO 로그인 페이지로 리다이렉트
      window.location.href = 'http://localhost:8000/api/auth/google/login';
    },
    handleGoogleLogin() {
      // Google OAuth 로그인 엔드포인트로 리다이렉트
      console.log('Google 로그인 시도: Google OAuth 엔드포인트로 리다이렉트');
      try {
        // 현재 환경에 따라 URL 설정
        const baseUrl = process.env.NODE_ENV === 'production' 
          ? window.location.origin 
          : 'http://localhost:8000';
        
        // 디버깅용 URL 로깅
        const loginUrl = `${baseUrl}/api/auth/google/login`;
        console.log('SSO 로그인 URL:', loginUrl);
        
        // 직접 리다이렉트 (fetch 요청 제거하여 더 간단하게)
        window.location.href = loginUrl;
      } catch (error) {
        console.error('로그인 리다이렉트 오류:', error);
        this.error = 'SSO 로그인 처리 중 오류가 발생했습니다.';
      }
    }
  }
};
</script>

<style scoped>
.login-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.login-modal, .signup-modal {
  background-color: white;
  border-radius: 12px;
  width: 400px;
  max-width: 90%;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  position: relative;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.signup-modal {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  max-height: 90vh;
  overflow-y: auto;
}

.login-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background-color: #7950f2;
  color: white;
  flex-shrink: 0;
}

.login-header h2 {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0;
  transition: transform 0.2s;
}

.close-btn:hover {
  transform: scale(1.1);
}

.login-body {
  padding: 20px;
  overflow-y: auto;
  flex-grow: 1;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 14px;
  font-weight: 500;
  color: #4a5568;
}

.form-group input {
  padding: 12px;
  border: 1px solid #cbd5e0;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s;
  width: 100%;
  box-sizing: border-box;
}

.form-group input:focus {
  border-color: #7950f2;
  outline: none;
  box-shadow: 0 0 0 2px rgba(121, 80, 242, 0.1);
}

.password-input {
  position: relative;
  width: 100%;
}

.toggle-password {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #a0aec0;
  cursor: pointer;
  padding: 0;
  z-index: 2;
}

.login-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  font-size: 14px;
}

.remember-me {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #4a5568;
}

.forgot-password {
  color: #7950f2;
  text-decoration: none;
  font-weight: 500;
}

.login-btn {
  margin-top: 16px;
  padding: 14px;
  background-color: #7950f2;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
  width: 100%;
}

.login-btn:hover {
  background-color: #6742d1;
}

.login-btn:disabled {
  background-color: #b794f4;
  cursor: not-allowed;
}

.signup-link {
  text-align: center;
  margin-top: 16px;
  font-size: 14px;
  color: #4a5568;
}

.signup-link a {
  color: #7950f2;
  text-decoration: none;
  font-weight: 500;
}

.login-error {
  padding: 12px 20px;
  background-color: #fff5f5;
  color: #e53e3e;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-top: 1px solid #fed7d7;
}

/* SSO 로그인 스타일 */
.sso-login-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
}

.divider {
  position: relative;
  text-align: center;
  margin: 15px 0;
  color: #718096;
  font-size: 14px;
}

.divider::before,
.divider::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 40%;
  height: 1px;
  background-color: #e2e8f0;
}

.divider::before {
  left: 0;
}

.divider::after {
  right: 0;
}

.sso-btn, .google-btn {
  padding: 12px;
  background-color: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.sso-btn:hover {
  background-color: #e2e8f0;
}

.google-btn {
  background-color: #ffffff;
  border: 1px solid #dadce0;
  color: #3c4043;
}

.google-btn:hover {
  background-color: #f8f9fa;
  box-shadow: 0 1px 2px rgba(60, 64, 67, 0.3);
}

.google-btn i {
  color: #4285F4;
  font-size: 18px;
}

@media (max-width: 480px) {
  .login-modal, .signup-modal {
    width: 95%;
    border-radius: 8px;
    max-height: 80vh;
  }
  
  .login-header {
    padding: 12px 16px;
  }
  
  .login-header h2 {
    font-size: 1.2rem;
  }
  
  .login-body {
    padding: 16px;
  }
  
  .form-group input {
    padding: 10px;
  }
  
  .login-btn {
    padding: 12px;
  }
  
  .toggle-password {
    right: 8px;
  }
}
</style> 