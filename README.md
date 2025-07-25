###복사
#수정 msa6_image_popup1.css 
.results-table tr {
  cursor: pointer;
  /* user-select: none; 제거하거나 아래로 변경 */
}

/* 또는 선택적으로 적용 */
.results-table tr:not(.selectable-text) {
  user-select: none;
}

#수정 msa6_image_popup1.vue
handleKeyDown(e) {
  try {
    // 텍스트 입력 영역에서는 단축키 비활성화
    const activeElement = document.activeElement;
    if (activeElement && (
      activeElement.tagName === 'INPUT' || 
      activeElement.tagName === 'TEXTAREA' || 
      activeElement.contentEditable === 'true' ||
      activeElement.isContentEditable
    )) {
      return; // 텍스트 입력 중에는 단축키 처리하지 않음
    }

    const key = e.key.toLowerCase();

    // 기본 텍스트 조작 키는 허용 (추가 필요)
    if (e.ctrlKey && ['c', 'a', 'v', 'x'].includes(key)) {
      return; // 기본 복사/붙여넣기/전체선택/잘라내기 허용
    }


#수정2
const handleKeyDown = (event) => {
  // 기본 텍스트 조작 키는 허용 (추가 필요)
  if ((event.ctrlKey || event.metaKey) && ['c', 'a', 'v', 'x'].includes(event.key.toLowerCase())) {
    return; // 기본 복사/붙여넣기/전체선택/잘라내기 허용
  }


###패치노트

#auth.js
#수정1
CLEAR_AUTH(state) {
  state.token = null
  state.user = null
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  localStorage.removeItem('patchNoteSeen')  // 이 줄 추가
},

#수정2
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
  
  // SSO 로그인 성공 시 패치노트 표시 로직 추가
  const hasSeenPatchNote = localStorage.getItem('patchNoteSeen');
  if (!hasSeenPatchNote) {
    // Vue 컴포넌트가 아닌 store에서는 직접 DOM 조작이 어려우므로
    // 전역 이벤트를 발생시켜 main 컴포넌트에서 처리하도록 함
    window.dispatchEvent(new CustomEvent('showPatchNote'));
    localStorage.setItem('patchNoteSeen', 'true');
  }
  
  return Promise.resolve(true);
}





#side_1_main.vue #side_1_main.vue #side_1_main.vue
#수정3
async handleLogout() {
  try {
    await axios.get('http://localhost:8000/api/auth/slo');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('remember');
    localStorage.removeItem('patchNoteSeen');  // 이 줄 추가
    
    this.isAuthenticated = false;
    this.currentUser = null;
    this.showUserMenu = false;
  } catch (error) {
    console.error('Logout error:', error);
    
    // Force logout even if server request fails
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('remember');
    localStorage.removeItem('patchNoteSeen');  // 이 줄 추가
    
    this.isAuthenticated = false;
    this.currentUser = null;
    
    // Check if it's a network error
    if (error.code === 'ERR_NETWORK') {
      this.serverError = true;
    }
  }
},


#수정4
async checkAuthentication() {
  // 환경변수 기반 SSO 조건부 처리
  const useSSO = process.env.VUE_APP_USE_SSO === 'true'
  
  const token = localStorage.getItem('token');
  
  if (!token) {
    if (useSSO) {
      this.isAuthenticated = false;
      this.currentUser = null;
      this.authChecked = true;
      // /main 경로이므로 바로 SSO 로그인으로 리다이렉트
      window.location.href = 'http://localhost:8000/api/auth/google/login';
      return;
    } else {
      // 개발 환경에서는 개발용 토큰 설정
      console.log('개발 환경: 토큰이 없음, 개발용 토큰 설정')
      const devToken = 'dev-token-' + Date.now()
      const devUser = {
        id: 'dev-user',
        username: '개발자',
        email: 'dev@example.com',
        full_name: '개발자',
        permission: 'admin',
        is_active: true
      }
      localStorage.setItem('token', devToken)
      localStorage.setItem('user', JSON.stringify(devUser))
      this.isAuthenticated = true;
      this.currentUser = devUser;
      this.authChecked = true;
      
      // 개발 환경에서도 패치노트 표시 로직 추가
      const hasSeenPatchNote = localStorage.getItem('patchNoteSeen');
      if (!hasSeenPatchNote) {
        this.showPatchNote = true;
        localStorage.setItem('patchNoteSeen', 'true');
      }
      return;
    }
  }
  
  try {
    const response = await axios.get('http://localhost:8000/api/auth/check-auth', {
      params: { token }
    });
    
    if (response.data.authenticated) {
      this.isAuthenticated = true;
      this.currentUser = response.data.user;
      // 로그인 상태가 확인되면 로그인 모달이 표시되지 않도록 설정
      this.showLoginModal = false;

      // 최초 로그인 시에만 패치노트 표시 (localStorage로 확인)
      const hasSeenPatchNote = localStorage.getItem('patchNoteSeen');
      if (!hasSeenPatchNote) {
        this.showPatchNote = true;
        localStorage.setItem('patchNoteSeen', 'true');
      }
    } else {
      if (useSSO) {
        this.isAuthenticated = false;
        this.currentUser = null;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // /main 경로이므로 바로 SSO 로그인으로 리다이렉트
        window.location.href = 'http://localhost:8000/api/auth/google/login';
      } else {
        // 개발 환경에서는 개발용 토큰 재설정
        console.log('개발 환경: 토큰 검증 실패, 개발용 토큰 재설정')
        const devToken = 'dev-token-' + Date.now()
        const devUser = {
          id: 'dev-user',
          username: '개발자',
          email: 'dev@example.com',
          full_name: '개발자',
          permission: 'admin',
          is_active: true
        }
        localStorage.setItem('token', devToken)
        localStorage.setItem('user', JSON.stringify(devUser))
        this.isAuthenticated = true;
        this.currentUser = devUser;
        
        // 개발 환경에서도 패치노트 표시 로직 추가
        const hasSeenPatchNote = localStorage.getItem('patchNoteSeen');
        if (!hasSeenPatchNote) {
          this.showPatchNote = true;
          localStorage.setItem('patchNoteSeen', 'true');
        }
      }
    }
  } catch (error) {
    // ... 기존 에러 처리 코드
  }
  
  this.authChecked = true;
},


#수정5
created() {
  // Add event listener for clicks outside dropdown
  document.addEventListener('click', this.closeOnOutsideClick);
  
  // URL 파라미터에서 토큰 확인 (SSO 리다이렉트 처리)
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  const userId = urlParams.get('user_id') || urlParams.get('user'); // user 파라미터도 확인
  const errorParam = urlParams.get('error');
  
  if (token && userId) {
    // SSO로부터 받은 토큰 저장
    localStorage.setItem('token', token);
    
    // URL에서 파라미터 제거 (보안을 위해)
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
    
    // SSO 로그인 성공 시 패치노트 표시
    const hasSeenPatchNote = localStorage.getItem('patchNoteSeen');
    if (!hasSeenPatchNote) {
      this.showPatchNote = true;
      localStorage.setItem('patchNoteSeen', 'true');
    }
    
    // 사용자 정보 조회
    this.checkAuthentication();
  } else if (errorParam) {
    alert('로그인 중 오류가 발생했습니다. 다시 시도해주세요.');
    window.history.replaceState({}, document.title, window.location.pathname);
  } else {
    // 기존 로그인 세션 확인
    this.checkAuthentication();
  }
  
  // ... 나머지 코드
},

#수정6
created() {
  // ... 기존 코드

  // 전역 패치노트 표시 이벤트 리스너 추가
  window.addEventListener('showPatchNote', () => {
    this.showPatchNote = true;
  });
  
  // ... 나머지 코드
},

beforeDestroy() {
  // 이벤트 리스너 정리
  window.removeEventListener('showPatchNote', () => {
    this.showPatchNote = true;
  });
  document.removeEventListener('click', this.closeOnOutsideClick);
},



--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------





#이거 msa3 업데이트 완료

// ... existing code ...
          // MSA3에 유사 이미지 데이터 전송 (이미지 디스플레이용)
          const msa3Event = new CustomEvent('msa1-to-msa3-similar-images', {
            detail: {
              mainImage: {
                filename: filename,
                url: imageUrl,
                fromMSA1: true  // MSA1에서 온 이미지임을 명시
              },
              similarImages: data.similar_images
            }
          })
          document.dispatchEvent(msa3Event)
// ... existing code ...



------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------






// ... existing code ...
    // MSA1에서 보내는 유사 이미지 커스텀 이벤트 핸들러 (새로 추가)
    handleMSA1SimilarImages(event) {
      try {
        console.log('[MSA3] MSA1에서 유사 이미지 데이터 수신:', event.detail);
        
        if (event.detail) {
          const { mainImage, similarImages } = event.detail;
          
          // 메인 이미지 설정 - MSA1에서 온 이미지는 새로운 이미지이므로 특별 처리
          if (mainImage) {
            // MSA1에서 온 메인 이미지는 fromMSA1 플래그를 true로 설정하여 처리
            // 이미 fromMSA1이 설정되어 있으면 그대로 사용, 없으면 추가
            const processedMainImage = {
              ...mainImage,
              fromMSA1: mainImage.fromMSA1 !== undefined ? mainImage.fromMSA1 : true
            };
            this.handleImageSelected(processedMainImage);
          }
          
          // 유사 이미지 설정 - 각 유사 이미지에도 fromMSA1 플래그 추가
          if (similarImages && Array.isArray(similarImages)) {
            const processedSimilarImages = similarImages.map(img => ({
              ...img,
              fromMSA1: img.fromMSA1 !== undefined ? img.fromMSA1 : true
            }));
            this.handleSimilarImagesFound(processedSimilarImages);
          }
          
          console.log('[MSA3] MSA1 유사 이미지 데이터 처리 완료');
        }
      } catch (error) {
        console.error('[MSA3] MSA1 유사 이미지 데이터 처리 오류:', error);
      }
    },
// ... existing code ...







