![image](https://github.com/user-attachments/assets/e1fbfc5c-7b05-4338-921b-a1b4d64b29a4)
![image](https://github.com/user-attachments/assets/cb6d3b57-c44d-44ed-9aa6-289a0c8d34a0)


<style scoped>
/* Global container styles */
html, body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  height: 100%;
  box-sizing: border-box;
}

*, *:before, *:after {
  box-sizing: inherit;
}

.main-view {
  position: relative;
  height: 100vh;
  overflow: hidden;
  box-sizing: border-box;
}

.main-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
}

/* Content area styles */
.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
  margin: 0;
  height: calc(100vh - 55px); /* Account for header height */
  width: 100%;
  position: relative;
  box-sizing: border-box;
}

/* MSA Grid layout - exact height calculation */
.msa-grid {
  display: grid;
  gap: 16px;
  grid-template-rows: minmax(300px, 1fr) minmax(300px, 1fr); /* 최소 높이 설정 */
  height: calc(100vh - 180px);
  width: 100%;
  padding: 16px;
  box-sizing: border-box;
  position: relative;
  contain: layout style; /* 레이아웃 계산 최적화 */
}

.top-row, .bottom-row {
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(200px, 1fr) minmax(400px, 2fr) minmax(200px, 1fr); /* 최소 너비 설정 */
  height: 100%;
  width: 100%;
  position: relative;
  contain: layout style; /* 레이아웃 계산 최적화 */
}

.msa-card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
  width: 100%;
  box-sizing: border-box; /* 박스 크기 계산 방식 명확히 */
}

.msa3 {
  display: block !important; /* flex에서 block으로 변경하여 크기 계산 방식 단순화 */
  background-color: white !important;
  height: 100% !important;
  width: 100% !important;
  z-index: 1;
  position: relative;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  /* 레이아웃 계산 안정화를 위한 추가 속성 */
  contain: layout style; /* 성능 최적화 및 리플로우 제한 */
  box-sizing: border-box;
}

.msa3-wrapper {
  height: 100%;
  width: 100%;
  overflow: hidden;
  display: block; /* flex에서 block으로 변경 */
  position: relative;
  padding: 0 !important;
  margin: 0 !important;
  /* 레이아웃 계산 안정화를 위한 추가 속성 */
  contain: layout style; /* 성능 최적화 및 리플로우 제한 */
  box-sizing: border-box;
}

/* Sidebar styles */
.sidebar {
  position: fixed;
  top: 0;
  left: -300px;
  width: 300px;
  height: 100vh;
  background: white;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
  transition: left 0.3s ease;
  z-index: 1000;
}

.sidebar-open {
  left: 0;
}

.sidebar-header {
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #eee;
}

.sidebar-header h3 {
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
}

.sidebar-nav {
  padding: 0.5rem;
}

.nav-item {
  display: block;
  padding: 0.75rem;
  color: #333;
  text-decoration: none;
  transition: background 0.2s;
  border-radius: 4px;
}

.nav-item:hover {
  background: #f5f5f5;
}

.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
}

/* Mobile header */
.mobile-header {
  display: none;
  padding: 0.75rem;
  background: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.hamburger-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.25rem;
}

/* Mobile responsive styles */
@media (max-width: 1200px) {
  .mobile-header {
    display: block;
  }
  
  .top-row,
  .bottom-row {
    grid-template-columns: 1fr;
  }
  
  .msa-grid {
    grid-template-rows: 1fr;
    height: auto;
  }
}
</style> 







## Done List
```
로그인 페이지 / sso 다이렉트로
활성 사용자 제거 다른거로
그래프 우상단 모드 삭제
sam 구현
llm 프롬프트 추가
상단 사용자님 환영합니다.
lcnc 노드 후보 영역 스크롤
마지막 workflow 저장만 테스트
최근 가입 말고 최근 접속 10개 스크롤로 - 액션 유형으로 필터링
액션 유형은 error 제거
analysis 탭 드롭다운 선택하자마자 바로 데이터 업데이트돼
그래프 데이터 변경
그래프 포인트 호버 시에 IIS 링크
불량감지 스케일바 설정한 기준으로
창 크기 변경하면 불량감지 이상해짐
불량감지 x,y값이상해
팝업 아래쪽 잘려
불량 영역 누르면 기준선 안보이게
단축키
선 개수 동작 안해
삭제 안돼
색상 변경 안돼 
스케일 바 설정 안돼
초기화 안돼
 - 마지막 기준선으로만 잘려 선측정
 - 기준선 기준으로 잘리던거 다시 구현
 - 기준선 단축키
 - LLM 기능 async로
 - LLM 기능 구현
 - 측정 결과에서 전후 이미지 전환 기능
 - 측정 결과 ctrl z,y 안돼
 - process start 누르면 결과들 다 초기화
 - (지금 item id 다 유지돼)
 - 초기화 버튼으로 초기화 안돼
 - 이미지 붙여넣으면 바로 연관 이미지 검색 안돼
 - msa6 - 스케일 바 변환
 - msa6 팝업 - 전/후 이미지 전환 기능
 - msa6 팝업 - 결과에 total값이 나와
 - setting api에서 이미지/벡터 저장할 때
   -> 기존 data 없애고 저장되게
   -> 벡터 변환할 때 애초에 3차원으로 구성하기 (UMAP으로)
   -> 저장 경로 하나 더 추가 여기는 before로 필터링 안하기 
         D:\image_set_url\additional_images   
 - workflow 저장을 누르면
   -> 저장할 때, 성분분석이미지들도 색 다르게 보여주기? tag 설정?
   -> 설명은 workflow이름.txt 로 저장되도록
   -> 3차원 그래프에서 점 누르면,
      -> 유사 이미지 띄워지고, 유사 텍스트도 LLM에서 보여지게
 - 전처리 하면 이미지 저장 뻑나
 - msa6 팝업 - 결과 저장 - lot_wafer 이름으로 저장하고, 중복 검사
   -> 이미지가 유니크한 이름으로 저장되게
   -> images 폴더 말고 image_measure 폴더에 저장

 ```
 


## Version - 오류 확인
node -v
v20.13.1
 npm -v
10.5.2
vue --version
@vue/cli 5.0.8



