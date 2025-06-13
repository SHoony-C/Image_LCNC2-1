from fastapi import FastAPI, APIRouter, Request, Response
import uvicorn
import os
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

# MSA 모듈 라우터 임포트
from msa1_imageload import router as msa1_router
from msa2_imageprocess import router as msa2_router
from msa3_imageanalysis import router as msa3_router
from msa4_imagestorage import router as msa4_router
from msa6_imageexport import router as msa6_router
from msa5_imageLCNC import router as msa5_router
from msa5_workLCNC import router as msa5_work_router

# 사이드 모듈 라우터 임포트
from side_2_analysis import router as side_2_router
from side_3_workflow import router as workflow_router
from side_4_management import router as management_router
from side_5_settings import router as settings_router
from side_6_help import router as help_router

# API Gateway import
from api_gateway import api_gateway_app

# 외부 이미지 저장 API 임포트
from external_py.image_storage_api import router as external_storage_router

# Authentication router import
from auth import router as auth_router
# SQLAlchemy based user router
from user_routes import router as user_router

# 환경 변수 로드
load_dotenv()

# 메인 FastAPI 앱 생성
app = FastAPI(
    title="이미지 처리 통합 API",
    description="이미지 처리, LLM 분석, 워크플로우 관리를 위한 통합 API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 모든 오리진 허용
    allow_credentials=True,
    allow_methods=["*"],  # 모든 HTTP 메소드 허용
    allow_headers=["*"],  # 모든 헤더 허용
)

# 정적 파일 서빙 설정
app.mount("/storage", StaticFiles(directory="./storage"), name="storage")
# images 디렉토리는 사용하지 않음
# app.mount("/images", StaticFiles(directory="./images"), name="images")
# 벡터 디렉토리 경로 변경 (더 이상 필요없음, storage 마운트로 접근 가능)
# app.mount("/vectors", StaticFiles(directory="./vectors"), name="vectors")

# 외부 이미지 디렉토리 마운트 
app.mount("/images", StaticFiles(directory=r"D:\image_set_url\workflow_images"), name="external_images")

# 시작 이벤트: 필요한 디렉토리 생성
@app.on_event("startup")
async def startup_event():
    # 필요한 디렉토리 생성
    os.makedirs("./uploads", exist_ok=True)
    os.makedirs("./processed", exist_ok=True)
    os.makedirs("./results", exist_ok=True)
    os.makedirs("./storage", exist_ok=True)
    os.makedirs("./exports", exist_ok=True)
    os.makedirs("./certs", exist_ok=True)
    os.makedirs("./certificates", exist_ok=True)  # 인증서 디렉토리 추가
    
    print("=== 이미지 처리 MSA API 서버가 시작되었습니다 ===")

# 루트 엔드포인트
@app.get("/", tags=["시스템"])
async def root():
    return {
        "message": "이미지 처리 MSA API에 오신 것을 환영합니다",
        "services": {
            "msa": {
                "msa1": "이미지 업로드",
                "msa2": "이미지 처리",
                "msa3": "이미지 분석",
                "msa4": "이미지 저장",
                "msa5": "이미지 검색",
                "msa6": "이미지 내보내기"
            },
            "side": {
                "side2": "분석 (관리자)",
                "side3": "워크플로우",
                "side4": "관리 (관리자)",
                "side5": "설정",
                "side6": "도움말"
            },
            "auth": {
                "login": "로그인",
                "sso": "Single Sign-On (SSO)",
                "management": "사용자 관리"
            }
        },
        "documentation": "/docs"
    }

# 상태 확인 엔드포인트
@app.get("/health", tags=["시스템"])
async def health():
    return {
        "status": "healthy",
        "services": {
            "msa": {
                "msa1": "up",
                "msa2": "up",
                "msa3": "up",
                "msa4": "up",
                "msa5": "up",
                "msa6": "up"
            },
            "side": {
                "side2": "up (관리자)",
                "side3": "up",
                "side4": "up (관리자)",
                "side5": "up",
                "side6": "up"
            },
            "auth": "up"
        }
    }

# MSA 모듈 라우터 등록
app.include_router(msa1_router, prefix="/api/msa1", tags=["msa1"])
app.include_router(msa2_router, prefix="/api/msa4", tags=["msa2"])
app.include_router(msa3_router, prefix="/api/imageanalysis", tags=["msa3"])

# 추가 라우팅: similar-images API를 imageanalysis 라우터에 연결
app.include_router(msa3_router, prefix="/api", tags=["msa3"])

app.include_router(msa4_router, prefix="/api/msa2", tags=["msa4"])
app.include_router(msa5_router, prefix="/api/msa5", tags=["msa5"])
app.include_router(msa5_work_router, prefix="/api/msa5/work", tags=["msa5_work"])
app.include_router(msa6_router, prefix="/api/msa6", tags=["msa6"])

# 사이드 모듈 라우터 등록
app.include_router(side_2_router, prefix="/api/side2", tags=["side2"])
app.include_router(workflow_router, prefix="/api/workflow", tags=["workflow"])
app.include_router(management_router, prefix="/api/management", tags=["management"])
app.include_router(settings_router, prefix="/api/settings", tags=["settings"])
app.include_router(help_router, prefix="/api/help", tags=["help"])

# 인증 라우터 등록
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
# SQL 기반 사용자 라우터 등록
app.include_router(user_router, prefix="/api/users", tags=["users"])

# 외부 이미지 저장 API 등록
app.include_router(
    external_storage_router,
    prefix="/api/external_storage",
    tags=["external_storage"],
    responses={404: {"description": "Not found"}},
)

# API Gateway 라우터 등록 - 최상위 경로로 설정
app.include_router(
    api_gateway_app,
    prefix="/api",
    tags=["api_gateway"],
    responses={404: {"description": "Not found"}}
)

# 전역 예외 처리기 추가
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """전역 예외 처리기 - 모든 처리되지 않은 예외를 잡아서 로깅합니다."""
    import traceback
    print(f"=== 처리되지 않은 예외 발생 ===")
    print(f"요청 URL: {request.url}")
    print(f"요청 방법: {request.method}")
    print(f"예외 타입: {type(exc).__name__}")
    print(f"예외 메시지: {str(exc)}")
    print("스택 트레이스:")
    traceback.print_exc()
    print("=== 예외 처리 종료 ===")
    
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "message": f"서버 내부 오류: {str(exc)}",
            "error_type": type(exc).__name__
        }
    )

# 서버 시작
if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    print(f"=== 이미지 처리 MSA API 서버 시작 중 (포트: {port}) ===")
    print(f"API 문서: http://localhost:{port}/docs")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True) 