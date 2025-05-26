# 이미지 처리 백엔드 서비스

이 프로젝트는 FastAPI를 기반으로 하는 이미지 처리 및 워크플로우 관리 백엔드 서비스입니다.

## 구성 요소

1. **API Gateway (포트: 8000)**
   - 인증 및 권한 관리
   - 모든 서비스의 통합 API 제공
   - 클라이언트와의 통신 담당

2. **Image Service (포트: 8001)**
   - 이미지 업로드 및 저장
   - 이미지 전처리 (그레이스케일, 리사이즈, 블러, 임계값 처리, 엣지 감지 등)
   - 이미지 메타데이터 관리

3. **LLM Service (포트: 8002)**
   - OpenAI API를 활용한 이미지 분석
   - 비전-언어 모델 통합
   - 이미지 분석 결과 저장 및 관리

4. **Workflow Service (포트: 8003)**
   - 이미지 처리 워크플로우 생성 및 관리
   - 워크플로우 단계별 실행
   - 워크플로우 결과 저장 및 추적

## 설치 및 실행

### 1. 요구 사항 설치

```bash
cd backend
pip install -r requirements.txt
```

### 2. 환경 변수 설정

`.env` 파일에서 다음 설정을 확인하거나 수정하세요:

```
# 서비스 포트 설정
API_GATEWAY_PORT=8000
IMAGE_SERVICE_PORT=8001
LLM_SERVICE_PORT=8002
WORKFLOW_SERVICE_PORT=8003

# 보안 설정
SECRET_KEY=your_secret_key_here

# API 키 설정
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. 서버 실행

모든 서비스를 한 번에 실행하려면:

```bash
python main.py
```

각 서비스를 개별적으로 실행하려면:

```bash
# API Gateway
uvicorn api_gateway:api_gateway_app --host 0.0.0.0 --port 8000 --reload

# Image Service
uvicorn image_service:image_service_app --host 0.0.0.0 --port 8001 --reload

# LLM Service
uvicorn llm_service:llm_service_app --host 0.0.0.0 --port 8002 --reload

# Workflow Service
uvicorn workflow_service:workflow_service_app --host 0.0.0.0 --port 8003 --reload
```

## API 문서

각 서비스의 API 문서는 Swagger UI를 통해 확인할 수 있습니다:

- API Gateway: http://localhost:8000/docs
- Image Service: http://localhost:8001/docs
- LLM Service: http://localhost:8002/docs
- Workflow Service: http://localhost:8003/docs

## 기본 인증 정보

테스트용 계정:
- 사용자명: testuser
- 비밀번호: testpassword 