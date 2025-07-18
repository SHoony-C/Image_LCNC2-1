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







opening/closing
1. 기능
# Opening 처리
@router.post("/opening")
async def process_opening(image: UploadFile = File(...), params: str = Form(...)):
    """Opening 처리 (Erosion + Dilation)"""
    params = json.loads(params)
    
    try:
        # 이미지 데이터 읽기
        image_data = await image.read()
        img = decode_image(image_data)
        original_format = img.format  # 원본 이미지 형식 저장
        
        # 파라미터 추출
        kernel_size = int(params.get("kernel_size", 5))
        kernel_type = params.get("kernel_type", "rect")  # rect, ellipse, cross
        
        # 커널 크기가 홀수인지 확인
        if kernel_size % 2 == 0:
            kernel_size += 1  # 짝수면 홀수로 만들기
        
        # PIL 이미지를 OpenCV로 변환
        cv_image = pil_to_cv2(img)
        
        # 커널 타입에 따른 커널 생성
        if kernel_type == "ellipse":
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
        elif kernel_type == "cross":
            kernel = cv2.getStructuringElement(cv2.MORPH_CROSS, (kernel_size, kernel_size))
        else:  # rect (기본값)
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_size, kernel_size))
        
        # Opening 적용 (Erosion + Dilation)
        result = cv2.morphologyEx(cv_image, cv2.MORPH_OPEN, kernel)
        
        # 결과 이미지 반환
        result_img = cv2_to_pil(result)
        
        # 원본 이미지 형식 유지
        result_img.format = original_format
        
        # 처리 정보 로깅
        print(f"Opening 처리: 커널크기={kernel_size}, 커널타입={kernel_type}, 형식: {original_format}")
        
        # 적절한 MIME 타입 설정
        mime_type = f"image/{original_format.lower()}" if original_format != "JPEG" else "image/jpeg"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes, format_used = encode_image_to_bytes(result_img, format=original_format)
        return Response(content=img_bytes, media_type=mime_type)
    except Exception as e:
        print(f"Opening 처리 오류: {str(e)}")
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": str(e)}
        )

# Closing 처리
@router.post("/closing")
async def process_closing(image: UploadFile = File(...), params: str = Form(...)):
    """Closing 처리 (Dilation + Erosion)"""
    params = json.loads(params)
    
    try:
        # 이미지 데이터 읽기
        image_data = await image.read()
        img = decode_image(image_data)
        original_format = img.format  # 원본 이미지 형식 저장
        
        # 파라미터 추출
        kernel_size = int(params.get("kernel_size", 5))
        kernel_type = params.get("kernel_type", "rect")  # rect, ellipse, cross
        
        # 커널 크기가 홀수인지 확인
        if kernel_size % 2 == 0:
            kernel_size += 1  # 짝수면 홀수로 만들기
        
        # PIL 이미지를 OpenCV로 변환
        cv_image = pil_to_cv2(img)
        
        # 커널 타입에 따른 커널 생성
        if kernel_type == "ellipse":
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
        elif kernel_type == "cross":
            kernel = cv2.getStructuringElement(cv2.MORPH_CROSS, (kernel_size, kernel_size))
        else:  # rect (기본값)
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_size, kernel_size))
        
        # Closing 적용 (Dilation + Erosion)
        result = cv2.morphologyEx(cv_image, cv2.MORPH_CLOSE, kernel)
        
        # 결과 이미지 반환
        result_img = cv2_to_pil(result)
        
        # 원본 이미지 형식 유지
        result_img.format = original_format
        
        # 처리 정보 로깅
        print(f"Closing 처리: 커널크기={kernel_size}, 커널타입={kernel_type}, 형식: {original_format}")
        
        # 적절한 MIME 타입 설정
        mime_type = f"image/{original_format.lower()}" if original_format != "JPEG" else "image/jpeg"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes, format_used = encode_image_to_bytes(result_img, format=original_format)
        return Response(content=img_bytes, media_type=mime_type)
    except Exception as e:
        print(f"Closing 처리 오류: {str(e)}")
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": str(e)}
        )
# UNet + Attention 처리
@router.post("/unet_attention")
async def process_unet_attention(image: UploadFile = File(...), params: str = Form(...)):
    """UNet + Attention을 사용한 이미지 세그멘테이션 처리"""
    params = json.loads(params)
    
    try:
        # 이미지 데이터 읽기
        image_data = await image.read()
        img = decode_image(image_data)
        original_format = img.format  # 원본 이미지 형식 저장
        
        # 파라미터 추출
        attention_type = params.get("attention_type", "self")  # self, cross, spatial
        attention_heads = int(params.get("attention_heads", 8))
        dropout_rate = float(params.get("dropout_rate", 0.1))
        alpha = float(params.get("alpha", 0.6))  # 추가
        
        # PIL 이미지를 OpenCV로 변환
        cv_image = pil_to_cv2(img)
        
        # UNet + Attention 처리 시뮬레이션
        print(f"UNet + Attention 처리: 어텐션타입={attention_type}, 헤드수={attention_heads}, 드롭아웃={dropout_rate}, 알파={alpha}")
        
        # 어텐션 맵 시뮬레이션 생성
        height, width = cv_image.shape[:2]
        
        # 어텐션 타입에 따른 다른 처리
        if attention_type == "self":
            # Self-attention 시뮬레이션
            attention_map = np.random.rand(height, width).astype(np.float32)
            attention_map = cv2.GaussianBlur(attention_map, (15, 15), 0)
            attention_map = (attention_map * 255).astype(np.uint8)
            attention_colored = cv2.applyColorMap(attention_map, cv2.COLORMAP_HOT)
        elif attention_type == "cross":
            # Cross-attention 시뮬레이션
            attention_map = np.random.rand(height, width).astype(np.float32)
            attention_map = cv2.GaussianBlur(attention_map, (21, 21), 0)
            attention_map = (attention_map * 255).astype(np.uint8)
            attention_colored = cv2.applyColorMap(attention_map, cv2.COLORMAP_VIRIDIS)
        else:  # spatial
            # Spatial attention 시뮬레이션
            attention_map = np.random.rand(height, width).astype(np.float32)
            attention_map = cv2.GaussianBlur(attention_map, (25, 25), 0)
            attention_map = (attention_map * 255).astype(np.uint8)
            attention_colored = cv2.applyColorMap(attention_map, cv2.COLORMAP_PLASMA)
        
        # 원본 이미지와 어텐션 맵 블렌딩 (alpha 파라미터 사용)
        result = cv2.addWeighted(cv_image, 1-alpha, attention_colored, alpha, 0)
        
        # 결과 이미지 반환
        result_img = cv2_to_pil(result)
        
        # 원본 이미지 형식 유지
        result_img.format = original_format
        
        # 처리 정보 로깅
        print(f"UNet + Attention 처리 완료: 어텐션타입={attention_type}, 알파={alpha}, 형식: {original_format}")
        
        # 적절한 MIME 타입 설정
        mime_type = f"image/{original_format.lower()}" if original_format != "JPEG" else "image/jpeg"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes, format_used = encode_image_to_bytes(result_img, format=original_format)
        return Response(content=img_bytes, media_type=mime_type)
    except Exception as e:
        print(f"UNet + Attention 처리 오류: {str(e)}")
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": str(e)}
        )

# HRNet 처리
@router.post("/hrnet")
async def process_hrnet(image: UploadFile = File(...), params: str = Form(...)):
    """HRNet을 사용한 이미지 세그멘테이션 처리"""
    params = json.loads(params)
    
    try:
        # 이미지 데이터 읽기
        image_data = await image.read()
        img = decode_image(image_data)
        original_format = img.format  # 원본 이미지 형식 저장
        
        # 파라미터 추출
        confidence_threshold = float(params.get("confidence_threshold", 0.5))
        output_mode = params.get("output_mode", "segmentation")  # segmentation, keypoints, pose
        alpha = float(params.get("alpha", 0.7))  # 추가
        
        # PIL 이미지를 OpenCV로 변환
        cv_image = pil_to_cv2(img)
        
        # HRNet 모델 로드 (실제 구현에서는 모델 파일이 필요)
        # 여기서는 시뮬레이션된 결과를 반환
        print(f"HRNet 처리: 신뢰도={confidence_threshold}, 출력모드={output_mode}, 알파={alpha}")
        
        # HRNet 처리 시뮬레이션 (실제 구현 시에는 실제 모델 사용)
        if output_mode == "segmentation":
            # 세그멘테이션 결과 시뮬레이션
            height, width = cv_image.shape[:2]
            # 랜덤한 세그멘테이션 마스크 생성 (실제로는 모델 예측 결과)
            mask = np.random.randint(0, 256, (height, width), dtype=np.uint8)
            # 마스크를 컬러로 변환
            colored_mask = cv2.applyColorMap(mask, cv2.COLORMAP_JET)
            # 원본 이미지와 마스크 블렌딩 (alpha 파라미터 사용)
            result = cv2.addWeighted(cv_image, 1-alpha, colored_mask, alpha, 0)
        elif output_mode == "keypoints":
            # 키포인트 감지 시뮬레이션
            result = cv_image.copy()
            # 랜덤한 키포인트 생성
            num_keypoints = 17
            for i in range(num_keypoints):
                x = np.random.randint(50, width-50)
                y = np.random.randint(50, height-50)
                cv2.circle(result, (x, y), 3, (0, 255, 0), -1)
        else:  # pose
            # 포즈 추정 시뮬레이션
            result = cv_image.copy()
            # 랜덤한 포즈 라인 생성
            for i in range(5):
                x1, y1 = np.random.randint(50, width-50), np.random.randint(50, height-50)
                x2, y2 = np.random.randint(50, width-50), np.random.randint(50, height-50)
                cv2.line(result, (x1, y1), (x2, y2), (0, 255, 0), 2)
        
        # 결과 이미지 반환
        result_img = cv2_to_pil(result)
        
        # 원본 이미지 형식 유지
        result_img.format = original_format
        
        # 처리 정보 로깅
        print(f"HRNet 처리 완료: 출력모드={output_mode}, 알파={alpha}, 형식: {original_format}")
        
        # 적절한 MIME 타입 설정
        mime_type = f"image/{original_format.lower()}" if original_format != "JPEG" else "image/jpeg"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes, format_used = encode_image_to_bytes(result_img, format=original_format)
        return Response(content=img_bytes, media_type=mime_type)
    except Exception as e:
        print(f"HRNet 처리 오류: {str(e)}")
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": str(e)}
        )

2. 노드 추가
{
    "id": "opening",
    "label": "Opening",
    "icon": "fas fa-expand-arrows-alt",
    "type": "image",
    "category": "morphological"
},
{
    "id": "closing",
    "label": "Closing",
    "icon": "fas fa-compress-arrows-alt",
    "type": "image",
    "category": "morphological"
},
# AI 기반 세그멘테이션 섹션에 추가
{
    "id": "hrnet",
    "label": "HRNet 세그멘테이션",
    "icon": "fas fa-network-wired",
    "type": "image",
    "category": "segmentation"
},
{
    "id": "unet_attention",
    "label": "UNet + Attention",
    "icon": "fas fa-brain",
    "type": "image",
    "category": "segmentation"
},


3. 기본 옵션 추가
# morphological operations 섹션에 추가
"opening": {
    "kernel_size": 5,
    "kernel_type": "rect",
    "options": {
        "kernel_size": [3, 5, 7, 9, 11, 13, 15],
        "kernel_type": ["rect", "ellipse", "cross"]
    }
},
"closing": {
    "kernel_size": 5,
    "kernel_type": "rect",
    "options": {
        "kernel_size": [3, 5, 7, 9, 11, 13, 15],
        "kernel_type": ["rect", "ellipse", "cross"]
    }
},
"unet_attention": {
    "attention_type": "self",
    "attention_heads": 8,
    "dropout_rate": 0.1,
    "alpha": 0.6,  # 추가
    "options": {
        "attention_type": ["self", "cross", "spatial"],
        "attention_heads": [1, 2, 4, 8, 16],
        "dropout_rate": [0.0, 0.1, 0.2, 0.3, 0.4, 0.5],
        "alpha": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]  # 추가
    }
},
"hrnet": {
    "confidence_threshold": 0.5,
    "output_mode": "segmentation",
    "alpha": 0.7,  # 추가
    "options": {
        "output_mode": ["segmentation", "keypoints", "pose"],
        "confidence_threshold": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
        "alpha": [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]  # 추가
    }
},


4. 매핑
##4-1  msa5_image_lcnc.vue
const basicTypeMap = {
  // ... 기존 매핑들 ...
  'opening': 'opening',
  'closing': 'closing',
  'hrnet': 'hrnet',
  'unet_attention': 'unet_attention',
  'unet-attention': 'unet_attention',
  'unet+attention': 'unet_attention',
};

##4-2  msa5_image_lcnc.vue
const supportedNodeTypes = [
  'median_filter', 'gaussian_blur', 'gamma', 'anisotropic_diffusion',
  'histogram_equalization', 'threshold', 'brightness', 'contrast',
  'clahe', 'object_detection', 'blur', 'sharpen', 'grayscale', 'normalize', 'merge', 'sam2',
  'opening', 'closing', 'hrnet', 'unet_attention'
];

##4-3 msa3_image_iapp_popup.vue
const apiCompatibilityMap = {
  // ... 기존 매핑들 ...
  'opening': 'opening',
  'closing': 'closing',
  'hrnet': 'hrnet',
  'unet_attention': 'unet_attention',
  'unet-attention': 'unet_attention',
  'unet+attention': 'unet_attention',
};



a 단축키
msa6 .vue
if (key === 'a') {
          e.preventDefault();
          if (this.measurementMode === 'area' || this.measurementMode === 'area-vertical' || this.measurementMode === 'area-horizontal') {
            // 이미 영역 모드인 경우 방향 전환
            this.areaDirection = this.areaDirection === 'horizontal' ? 'vertical' : 'horizontal';
            
            // 방향에 따라 구체적인 모드 설정
            if (this.areaDirection === 'horizontal') {
              this.measurementMode = 'area-horizontal';
            } else {
              this.measurementMode = 'area-vertical';
            }
            
            this.showNotification(`영역 측정 방향: ${this.areaDirection === 'horizontal' ? '수평' : '수직'}`, 'info');
          } else {
            // 영역 모드 활성화
            this.setMode('area');
            this.showNotification('영역 선 측정 모드 활성화', 'info');
          }
          return;
        }



몽고 db 이름 저장은
msa5 .py
백엔드에서 덮어쓰기로 실행


msa5 실행취소 방지
msa5 .vue
const undo = () => {
  // MSA6 팝업이 열려있는지 확인
  const msa6Popup = document.querySelector('.image-measurement-popup');
  const isMSA6PopupVisible = msa6Popup && msa6Popup.style.display !== 'none' && msa6Popup.style.visibility !== 'hidden';
  
  // MSA6 팝업이 열려있으면 실행 취소 방지
  if (isMSA6PopupVisible) {
    console.log('MSA6 팝업이 열려있어 실행 취소가 차단되었습니다.');
    return;
  }
  
  if (undoStack.value.length === 0) return
  
  // 현재 상태를 redo 스택에 저장
  redoStack.value.push(JSON.parse(JSON.stringify(elements.value)))
  
  // 마지막 저장된 상태로 되돌림
  const lastState = undoStack.value.pop()
  elements.value = lastState
  
  // 실행 취소 후 입력/출력 연결 상태 업데이트
  updateConnections()
}



###패치노트 표시side_1_main.vue
// 최초 로그인 시에만 패치노트 표시 (localStorage로 확인)
          const hasSeenPatchNote = localStorage.getItem('patchNoteSeen');
          if (!hasSeenPatchNote) {
            this.showPatchNote = true;
            localStorage.setItem('patchNoteSeen', 'true');
          }






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



