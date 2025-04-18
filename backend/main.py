from fastapi import FastAPI, APIRouter
import uvicorn
import os
import httpx
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

# MSA 모듈 라우터 임포트
from msa1_imageload import router as msa1_router
from msa2_imageprocess import router as msa2_router
from msa3_imageanalysis import router as msa3_router
from msa4_imagestorage import router as msa4_router
from msa6_imageexport import router as msa6_router
from msa5_imageLCNC import router as msa5_router

# 사이드 모듈 라우터 임포트
from side_2_analysis import router as side_2_router
from side_3_workflow import router as workflow_router
from side_4_management import router as management_router
from side_5_settings import router as settings_router
from side_6_help import router as help_router

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
    allow_origins=["*"],  # 개발 환경에서는 모든 origin 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 시작 이벤트: 필요한 디렉토리 생성
@app.on_event("startup")
async def startup_event():
    # 필요한 디렉토리 생성
    os.makedirs("./uploads", exist_ok=True)
    os.makedirs("./processed", exist_ok=True)
    os.makedirs("./results", exist_ok=True)
    os.makedirs("./storage", exist_ok=True)
    os.makedirs("./exports", exist_ok=True)
    
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
            }
        }
    }

# MSA 모듈 라우터 등록
app.include_router(msa1_router, prefix="/api/msa1", tags=["MSA1"])
app.include_router(msa2_router, prefix="/api/msa2", tags=["MSA2"])
app.include_router(msa3_router, prefix="/api/msa3", tags=["MSA3"])
app.include_router(msa4_router, prefix="/api/msa4", tags=["MSA4"])
app.include_router(msa5_router, prefix="/api/msa5", tags=["MSA5"])
app.include_router(msa6_router, prefix="/api/msa6", tags=["MSA6"])

# 사이드 모듈 라우터 등록
app.include_router(side_2_router, prefix="/api/side2", tags=["Side2"])
app.include_router(workflow_router, prefix="/api/workflow", tags=["Workflow"])
app.include_router(management_router, prefix="/api/management", tags=["Management"])
app.include_router(settings_router, prefix="/api/settings", tags=["Settings"])
app.include_router(help_router, prefix="/api/help", tags=["Help"])

# 서버 시작
if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    print(f"=== 이미지 처리 MSA API 서버 시작 중 (포트: {port}) ===")
    print(f"API 문서: http://localhost:{port}/docs")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True) 