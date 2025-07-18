import axios from 'axios'

const state = {
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user')) || null,
  isAuthChecked: false
}

const mutations = {
  SET_TOKEN(state, token) {
    state.token = token
    localStorage.setItem('token', token)
  },
  SET_USER(state, user) {
    state.user = user
    localStorage.setItem('user', JSON.stringify(user))
  },
  CLEAR_AUTH(state) {
    state.token = null
    state.user = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  },
  SET_AUTH_CHECKED(state, value) {
    state.isAuthChecked = value
  }
}

const actions = {
  async login({ commit }, credentials) {
    try {
      console.log('로그인 시도:', credentials.username)
      const response = await axios.post('http://localhost:8000/api/auth/login', credentials)
      console.log('로그인 성공:', response.data)
      commit('SET_TOKEN', response.data.token)
      commit('SET_USER', response.data.user)
      return response.data
    } catch (error) {
      console.error('로그인 실패:', error)
      throw error.response ? error.response.data : error
    }
  },
  async logout({ commit }) {
    console.log('로그아웃 실행')
    try {
      // 백엔드 로그아웃 API 호출 - auth/slo 엔드포인트 사용
      await axios.get('http://localhost:8000/api/auth/slo')
      console.log('백엔드 로그아웃 성공')
    } catch (error) {
      console.error('백엔드 로그아웃 요청 실패:', error)
      // 백엔드 로그아웃이 실패해도 로컬 로그아웃은 진행
    }
    
    // 로컬 스토리지에서 인증 정보 제거
    commit('CLEAR_AUTH')
    return true
  },
  async checkAuth({ commit, state }) {
    commit('SET_AUTH_CHECKED', true)
    
    // 환경변수 기반 SSO 조건부 처리
    const useSSO = process.env.VUE_APP_USE_SSO === 'true'
    
    if (!state.token) {
      if (useSSO) {
        console.log('운영 환경: 토큰이 없음, SSO 로그인 필요')
        return false
      } else {
        console.log('개발 환경: 토큰이 없음, 개발용 토큰 설정')
        // 개발 환경에서는 임의의 토큰과 사용자 정보 설정
        const devToken = 'dev-token-' + Date.now()
        const devUser = {
          id: 'dev-user',
          username: '개발자',
          email: 'dev@example.com',
          full_name: '개발자',
          permission: 'admin',
          is_active: true
        }
        commit('SET_TOKEN', devToken)
        commit('SET_USER', devUser)
        return true
      }
    }
    
    try {
      console.log('인증 상태 확인 요청 시작')
      const response = await axios.get('http://localhost:8000/api/auth/check-auth', {
        params: { token: state.token }
      })
      
      console.log('인증 확인 응답:', response.data)
      
      if (response.data.authenticated) {
        console.log('인증 성공, 사용자 정보 저장:', response.data.user)
        commit('SET_USER', response.data.user)
        return true
      } else {
        console.error('인증 실패: 유효하지 않은 토큰')
        commit('CLEAR_AUTH')
        
        if (useSSO) {
          console.log('운영 환경: SSO 로그인으로 리다이렉트')
          window.location.href = 'http://localhost:8000/api/auth/google/login'
        } else {
          console.log('개발 환경: 개발용 토큰 재설정')
          // 개발 환경에서는 다시 개발용 토큰 설정
          const devToken = 'dev-token-' + Date.now()
          const devUser = {
            id: 'dev-user',
            username: '개발자',
            email: 'dev@example.com',
            full_name: '개발자',
            permission: 'admin',
            is_active: true
          }
          commit('SET_TOKEN', devToken)
          commit('SET_USER', devUser)
          return true
        }
        return false
      }
    } catch (error) {
      console.error('인증 확인 오류:', error)
      commit('CLEAR_AUTH')
      
      if (useSSO) {
        console.log('운영 환경: 네트워크 오류로 SSO 로그인으로 리다이렉트')
        window.location.href = 'http://localhost:8000/api/auth/google/login'
      } else {
        console.log('개발 환경: 네트워크 오류로 개발용 토큰 설정')
        // 개발 환경에서는 네트워크 오류 시에도 개발용 토큰 설정
        const devToken = 'dev-token-' + Date.now()
        const devUser = {
          id: 'dev-user',
          username: '개발자',
          email: 'dev@example.com',
          full_name: '개발자',
          permission: 'admin',
          is_active: true
        }
        commit('SET_TOKEN', devToken)
        commit('SET_USER', devUser)
        return true
      }
      return false
    }
  },
  // Function to handle query parameters for OAuth redirects
  handleAuthRedirect({ commit }) {
    console.log('OAuth 리다이렉트 처리 시작');
    console.log('현재 URL:', window.location.href);
    
    // 환경변수 기반 SSO 조건부 처리
    const useSSO = process.env.VUE_APP_USE_SSO === 'true'
    
    if (!useSSO) {
      console.log('개발 환경: SSO 리다이렉트 처리 건너뜀')
      // 개발 환경에서는 개발용 토큰 설정
      const devToken = 'dev-token-' + Date.now()
      const devUser = {
        id: 'dev-user',
        username: '개발자',
        email: 'dev@example.com',
        full_name: '개발자',
        permission: 'admin',
        is_active: true
      }
      commit('SET_TOKEN', devToken)
      commit('SET_USER', devUser)
      return Promise.resolve(true)
    }
    
    // 전체 URL 정보 로깅
    console.log('URL 정보:', {
      href: window.location.href,
      origin: window.location.origin,
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash
    });
    
    // 먼저 URL에 인증 관련 파라미터가 있는지 빠르게 확인
    const urlParams = new URLSearchParams(window.location.search);
    const hasSearch = window.location.search.length > 0;
    const hasHash = window.location.hash.length > 0;
    
    // 쿼리 파라미터나 해시가 없으면 즉시 종료
    if (!hasSearch && !hasHash) {
      console.log('인증 관련 URL 파라미터 없음, 리다이렉트 처리 건너뜀');
      return Promise.resolve(false);
    }
    
    // URL 해시에서 토큰 추출 시도 (Google Implicit Flow)
    if (hasHash) {
      console.log('URL 해시에서 토큰 추출 시도:', window.location.hash);
      
      // 해시(#) 이후의 문자열 파싱
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const hash_id_token = hashParams.get('id_token');
      const hash_access_token = hashParams.get('access_token');
      
      // 해시에서 추출한 토큰 값 로깅
      console.log('해시에서 추출한 토큰:', {
        id_token: hash_id_token ? `${hash_id_token.substring(0, 10)}...` : '없음',
        access_token: hash_access_token ? `${hash_access_token.substring(0, 10)}...` : '없음'
      });
      
      // 토큰이 있으면 저장하고 사용자 정보 조회
      if (hash_id_token || hash_access_token) {
        console.log('해시에서 토큰 발견, 저장 후 API 호출');
        
        // ID 토큰 또는 액세스 토큰을 저장 (ID 토큰 우선)
        const token = hash_id_token || hash_access_token;
        commit('SET_TOKEN', token);
        
        // 토큰 검증 API 호출 (id_token과 access_token이 모두 있으면 함께 전달)
        const params = {};
        if (hash_id_token) params.id_token = hash_id_token;
        if (hash_access_token) params.access_token = hash_access_token;
        
        return axios.get('http://localhost:8000/api/auth/check-auth', { params })
        .then(response => {
          console.log('토큰 검증 응답:', response.data);
          if (response.data.authenticated) {
            console.log('토큰 검증 성공, 사용자 정보 저장:', response.data.user);
            commit('SET_USER', response.data.user);
            
            // 해시 제거 (클린 URL)
            if (window.history.replaceState) {
              window.history.replaceState(null, null, window.location.pathname);
            }
            
            return true;
          }
          console.error('토큰 검증 실패');
          commit('CLEAR_AUTH');  // 인증 실패 시 토큰 제거
          return false;
        })
        .catch(error => {
          console.error('토큰 검증 요청 오류:', error);
          commit('CLEAR_AUTH');  // 오류 시 토큰 제거
          return false;
        });
      }
    }
    
    // URL 쿼리 파라미터 확인 (기존 로직)
    if (hasSearch) {
      // 모든 URL 파라미터 로깅
      console.log('모든 URL 파라미터:');
      for (const [key, value] of urlParams.entries()) {
        console.log(`${key}: ${value}`);
      }
      
      const id_token = urlParams.get('id_token');
      const access_token = urlParams.get('access_token');
      const user = urlParams.get('user');
      const token = urlParams.get('token');
      const error = urlParams.get('error');
      const errorMessage = urlParams.get('message');
      
      // 추출된 URL 파라미터 로깅
      console.log('URL 파라미터 확인:', {
        token: token || '없음',
        id_token: id_token || '없음',
        access_token: access_token || '없음',
        user: user || '없음',
        error: error || '없음',
        message: errorMessage || '없음'
      });
      
      // 오류 파라미터가 있는지 확인
      if (error) {
        console.error('로그인 오류 발생:', error);
        console.error('오류 상세:', errorMessage);
        return Promise.resolve(false);
      }
      
      // 사용자 이름과 토큰이 있는 경우 (성공적인 로그인 - 새로운 로직)
      if (token && user) {
        console.log('JWT 토큰과 사용자 이름 발견, 인증 진행');
        commit('SET_TOKEN', token);
        
        // 사용자 정보 구성
        const userInfo = {
          id: user,
          username: user,
          email: `${user}@example.com`,  // 이메일 정보가 없으면 임시 생성
          full_name: user,
          permission: 'user',
          is_active: true
        }
        
        console.log('설정할 사용자 정보:', userInfo);
        commit('SET_USER', userInfo);
        return Promise.resolve(true);
      }
      
      // ID 토큰이나 액세스 토큰이 있는 경우 (암시적 흐름에서 반환됨)
      if (id_token || access_token) {
        console.log('URL 파라미터에서 OAuth 토큰 발견, 인증 진행');
        
        // ID 토큰 또는 액세스 토큰을 저장 (ID 토큰 우선)
        const tokenValue = id_token || access_token;
        commit('SET_TOKEN', tokenValue);
        
        // 토큰 검증 API 호출
        console.log('토큰 검증 API 호출');
        const params = {};
        if (id_token) params.id_token = id_token;
        if (access_token) params.access_token = access_token;
        
        return axios.get('http://localhost:8000/api/auth/check-auth', { params })
        .then(response => {
          console.log('토큰 검증 응답:', response.data);
          if (response.data.authenticated) {
            console.log('토큰 검증 성공, 사용자 정보 저장:', response.data.user);
            commit('SET_USER', response.data.user);
            return true;
          }
          console.error('토큰 검증 실패');
          commit('CLEAR_AUTH');  // 인증 실패 시 토큰 제거
          return false;
        })
        .catch(error => {
          console.error('토큰 검증 요청 오류:', error);
          commit('CLEAR_AUTH');  // 오류 시 토큰 제거
          return false;
        });
      }

      // 일반 JWT 토큰 처리 (기존 로직)
      if (token) {
        console.log('JWT 토큰 발견, 인증 진행');
        commit('SET_TOKEN', token);
        
        // 토큰 검증 API 호출
        console.log('토큰 검증 API 호출');
        return axios.get('http://localhost:8000/api/auth/check-auth', {
          params: { token }
        })
        .then(response => {
          console.log('토큰 검증 응답:', response.data);
          if (response.data.authenticated) {
            console.log('토큰 검증 성공, 사용자 정보 저장:', response.data.user);
            commit('SET_USER', response.data.user);
            return true;
          }
          console.error('토큰 검증 실패');
          commit('CLEAR_AUTH');  // 인증 실패 시 토큰 제거
          return false;
        })
        .catch(error => {
          console.error('토큰 검증 요청 오류:', error);
          commit('CLEAR_AUTH');  // 오류 시 토큰 제거
          return false;
        });
      }
    }
    
    console.log('인증 관련 파라미터가 없음, 리다이렉트 처리 실패');
    return Promise.resolve(false);
  }
}

const getters = {
  isAuthenticated: state => !!state.token,
  currentUser: state => state.user,
  isAuthChecked: state => state.isAuthChecked
}

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
} 