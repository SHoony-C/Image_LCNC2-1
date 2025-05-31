from fastapi import APIRouter, HTTPException, Body, UploadFile, File, Form
from fastapi.responses import Response, JSONResponse
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
import base64
import io
from PIL import Image
import os
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient
from config import MONGODB_SETTINGS
import json

router = APIRouter()

# MongoDB 연결 설정
mongo_host = MONGODB_SETTINGS['HOST']
mongo_port = MONGODB_SETTINGS['PORT']
mongo_db_name = MONGODB_SETTINGS['DATABASE']
mongo_collection = MONGODB_SETTINGS['lcnc_COLLECTION']

# MongoDB 클라이언트 생성
mongo_client = MongoClient(f"mongodb://{mongo_host}:{mongo_port}")
mongo_db = mongo_client[mongo_db_name]
lcnc_results = mongo_db[mongo_collection]

# 비동기 MongoDB 클라이언트 생성
async_mongo_client = AsyncIOMotorClient(f"mongodb://{mongo_host}:{mongo_port}")
async_mongo_db = async_mongo_client[mongo_db_name]
async_lcnc_results = async_mongo_db[mongo_collection]

class ImageProcessRequest(BaseModel):
    nodeType: Optional[str] = None  # Node type for processing
    params: Dict[str, Any] = {}

class ImageMergeRequest(BaseModel):
    params: Dict[str, Any] = {}

class ImageProcessResponse(BaseModel):
    status: str
    message: Optional[str] = None

LCNC_DIR = "./lcnc"
os.makedirs(LCNC_DIR, exist_ok=True)

# 유틸리티 함수
def decode_image(image_data):
    """바이너리 이미지 데이터를 PIL 이미지로 변환"""
    return Image.open(io.BytesIO(image_data))

def encode_image_to_bytes(image):
    """PIL 이미지를 바이너리로 변환"""
    buffered = io.BytesIO()
    image.save(buffered, format="PNG")
    return buffered.getvalue()

@router.get("/nodes")
async def get_nodes():
    """
    전처리 노드 목록과 기본 파라미터를 반환합니다.
    프론트엔드에서 요청하는 형식에 맞춥니다.
    """
    nodes = [
        # 화소 기반 조정
        {
            "id": "brightness",
            "label": "밝기 조정",
            "icon": "fas fa-sun",
            "type": "image",
            "category": "pixel"
        },
        {
            "id": "contrast",
            "label": "대비 조정",
            "icon": "fas fa-adjust",
            "type": "image",
            "category": "pixel"
        },
        {
            "id": "gamma",
            "label": "감마 보정",
            "icon": "fas fa-sliders-h",
            "type": "image",
            "category": "pixel"
        },
        
        # 히스토그램 기반 처리
        {
            "id": "histogram_equalization",
            "label": "히스토그램 평활화",
            "icon": "fas fa-chart-bar",
            "type": "image",
            "category": "histogram"
        },
        {
            "id": "clahe",
            "label": "CLAHE",
            "icon": "fas fa-chart-line",
            "type": "image",
            "category": "histogram"
        },
        
        # 노이즈 제거
        {
            "id": "gaussian_blur",
            "label": "가우시안 블러",
            "icon": "fas fa-filter",
            "type": "image",
            "category": "noise"
        },
        {
            "id": "median_filter",
            "label": "미디언 필터",
            "icon": "fas fa-brush",
            "type": "image",
            "category": "noise"
        },
        {
            "id": "anisotropic_diffusion",
            "label": "비등방성 확산 필터",
            "icon": "fas fa-wave-square",
            "type": "image",
            "category": "noise"
        },
        
        # 스케일 조정 및 정규화
        {
            "id": "resize",
            "label": "크기 조정",
            "icon": "fas fa-expand",
            "type": "image",
            "category": "scale"
        },
        {
            "id": "normalize",
            "label": "정규화",
            "icon": "fas fa-compress-arrows-alt",
            "type": "image",
            "category": "scale"
        },
        
        # 기타 (병합 노드는 유지)
        {
            "id": "merge",
            "label": "이미지 병합",
            "icon": "fas fa-object-group",
            "type": "image",
            "category": "utility"
        }
    ]
    
    defaultOptions = {
        # 화소 기반 조정
        "brightness": {
            "factor": 1.0  # 1.0은 변화 없음, >1.0은 밝게, <1.0은 어둡게
        },
        "contrast": {
            "factor": 1.0  # 1.0은 변화 없음, >1.0은 대비 증가, <1.0은 대비 감소
        },
        "gamma": {
            "gamma": 1.0  # 1.0은 변화 없음, <1.0은 밝게, >1.0은 어둡게
        },
        
        # 히스토그램 기반 처리
        "histogram_equalization": {
            "enabled": True
        },
        "clahe": {
            "clip_limit": 2.0,
            "tile_grid_size": 8
        },
        
        # 노이즈 제거
        "gaussian_blur": {
            "kernel_size": 5,  # 반드시 홀수여야 함 (3, 5, 7, ...)
            "sigma": 0  # 0은 자동 계산
        },
        "median_filter": {
            "kernel_size": 5  # 반드시 홀수여야 함
        },
        "anisotropic_diffusion": {
            "num_iter": 5,
            "kappa": 50,
            "gamma": 0.1,
            "option": 1  # 1 또는 2
        },
        
        # 스케일 조정 및 정규화
        "resize": {
            "width": 500,
            "height": 500,
            "preserve_aspect_ratio": True
        },
        "normalize": {
            "min_value": 0,
            "max_value": 255
        },
        
        # 병합 노드
        "merge": {
            "merge_type": "horizontal",
            "spacing": 0
        }
    }
    
    return {
        "options": nodes,
        "defaultOptions": defaultOptions
    }

@router.get("/list")
async def get_lcnc_images():
    """저장된 LCNC 결과 이미지 목록 반환"""
    image_list = []
    try:
        if os.path.exists(LCNC_DIR):
            for file in os.listdir(LCNC_DIR):
                if file.endswith(('.png', '.jpg', '.jpeg')):
                    image_path = os.path.join(LCNC_DIR, file)
                    image_list.append({
                        "name": file,
                        "url": f"/lcnc/{file}",
                        "created": datetime.fromtimestamp(os.path.getctime(image_path)).isoformat()
                    })
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(e)}
        )
    
    return {"images": image_list}

@router.post("/save-workflow")
async def save_workflow_to_mongodb(workflow_data: Dict[str, Any] = Body(...)):
    """워크플로우 데이터를 MongoDB에 저장"""
    try:
        # 필수 필드 검증
        session_id = workflow_data.get('session_id')
        if not session_id:
            session_id = f"workflow_{datetime.now().strftime('%Y%m%d%H%M%S')}"
            workflow_data['session_id'] = session_id
        
        # 워크플로우 이름 필드 확인
        workflow_name = workflow_data.get('workflow_name')
        if not workflow_name:
            return JSONResponse(
                status_code=400,
                content={
                    "status": "error",
                    "message": "워크플로우 이름은 필수 항목입니다."
                }
            )
        
        # 타임스탬프 추가
        workflow_data['timestamp'] = datetime.now().isoformat()
        
        # 중복 확인 (워크플로우 이름으로)
        existing_workflow = await async_lcnc_results.find_one({"workflow_name": workflow_name})
        
        # 덮어쓰기 여부 확인
        overwrite = workflow_data.get('overwrite', False)
        
        if existing_workflow and not overwrite:
            return JSONResponse(
                status_code=409,  # Conflict
                content={
                    "status": "duplicate",
                    "message": f"'{workflow_name}' 이름의 워크플로우가 이미 존재합니다.",
                    "existing_id": str(existing_workflow.get("_id"))
                }
            )
        
        # 저장 방식 결정 (업데이트 또는 새로 생성)
        if existing_workflow and overwrite:
            # 기존 워크플로우 업데이트
            result = await async_lcnc_results.update_one(
                {"workflow_name": workflow_name},
                {"$set": workflow_data}
            )
            
            return {
                "status": "success",
                "message": "워크플로우가 성공적으로 업데이트되었습니다.",
                "session_id": session_id,
                "id": str(existing_workflow.get("_id"))
            }
        else:
            # 새 워크플로우 삽입
            result = await async_lcnc_results.insert_one(workflow_data)
            
            return {
                "status": "success",
                "message": "워크플로우가 성공적으로 저장되었습니다.",
                "session_id": session_id,
                "id": str(result.inserted_id)
            }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"워크플로우 저장 중 오류가 발생했습니다: {str(e)}"
            }
        )

@router.get("/get-workflow/{session_id}")
async def get_workflow_from_mongodb(session_id: str):
    """MongoDB에서 세션 ID로 워크플로우 데이터 조회"""
    try:
        # 세션 ID로 워크플로우 검색
        workflow = await async_lcnc_results.find_one({"session_id": session_id})
        
        if workflow:
            # MongoDB의 _id 필드는 직렬화 불가능하므로 제거
            workflow['_id'] = str(workflow['_id'])
            return workflow
        else:
            return JSONResponse(
                status_code=404,
                content={
                    "status": "error",
                    "message": f"세션 ID '{session_id}'에 해당하는 워크플로우를 찾을 수 없습니다."
                }
            )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"워크플로우 조회 중 오류가 발생했습니다: {str(e)}"
            }
        )

@router.get("/get-workflow-by-hash/{image_hash}")
async def get_workflow_by_hash(image_hash: str):
    """이미지 해시로 워크플로우 데이터 조회"""
    try:
        # 이미지 해시로 워크플로우 검색
        workflow = await async_lcnc_results.find_one({"input_image_hash": image_hash})
        
        if workflow:
            # MongoDB의 _id 필드는 직렬화 불가능하므로 제거
            workflow['_id'] = str(workflow['_id'])
            return workflow
        else:
            return JSONResponse(
                status_code=404,
                content={
                    "status": "error",
                    "message": f"이미지 해시 '{image_hash}'에 해당하는 워크플로우를 찾을 수 없습니다."
                }
            )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"워크플로우 조회 중 오류가 발생했습니다: {str(e)}"
            }
        )

@router.get("/available-nodes")
async def get_available_nodes():
    """
    처리 가능한 노드 목록을 반환합니다.
    프론트엔드 LCNC 컴포넌트에서 사용됩니다.
    """
    print("available-nodes 엔드포인트 호출됨")
    
    try:
        nodes = [
            # 화소 기반 조정
            {
                "id": "brightness",
                "label": "밝기 조정",
                "icon": "fas fa-sun",
                "category": "pixel"
            },
            {
                "id": "contrast",
                "label": "대비 조정",
                "icon": "fas fa-adjust",
                "category": "pixel"
            },
            {
                "id": "gamma",
                "label": "감마 보정",
                "icon": "fas fa-sliders-h",
                "category": "pixel"
            },
            
            # 히스토그램 기반 처리
            {
                "id": "histogram_equalization",
                "label": "히스토그램 평활화",
                "icon": "fas fa-chart-bar",
                "category": "histogram"
            },
            {
                "id": "clahe",
                "label": "CLAHE",
                "icon": "fas fa-chart-line",
                "category": "histogram"
            },
            
            # 노이즈 제거
            {
                "id": "gaussian_blur",
                "label": "가우시안 블러",
                "icon": "fas fa-filter",
                "category": "noise"
            },
            {
                "id": "median_filter",
                "label": "미디언 필터",
                "icon": "fas fa-brush",
                "category": "noise"
            },
            {
                "id": "anisotropic_diffusion",
                "label": "비등방성 확산 필터",
                "icon": "fas fa-wave-square",
                "category": "noise"
            },
            
            # 스케일 조정 및 정규화
            {
                "id": "resize",
                "label": "크기 조정",
                "icon": "fas fa-expand",
                "category": "scale"
            },
            {
                "id": "normalize",
                "label": "정규화",
                "icon": "fas fa-compress-arrows-alt",
                "category": "scale"
            },
            
            # 기타 (병합 노드는 유지)
            {
                "id": "merge",
                "label": "이미지 병합",
                "icon": "fas fa-object-group",
                "category": "utility"
            }
        ]
        
        print(f"available-nodes 응답: {nodes}")
        
        # CORS 헤더가 포함된 JSONResponse 반환
        return JSONResponse(
            content={"status": "success", "nodes": nodes},
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization"
            }
        )
    except Exception as e:
        print(f"available-nodes 에러: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(e)},
            headers={
                "Access-Control-Allow-Origin": "*"
            }
        ) 