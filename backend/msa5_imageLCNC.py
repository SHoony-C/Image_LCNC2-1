from fastapi import APIRouter, HTTPException, Body, UploadFile, File, Form
from fastapi.responses import Response, JSONResponse
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
import base64
import io
from PIL import Image, ImageOps, ImageEnhance, ImageFilter
import numpy as np
import os
import shutil
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
        {
            "id": "resize",
            "label": "이미지 크기 조정",
            "icon": "fas fa-expand",
            "type": "image"
        },
        {
            "id": "crop",
            "label": "이미지 자르기",
            "icon": "fas fa-crop",
            "type": "image"
        },
        {
            "id": "rotate",
            "label": "이미지 회전",
            "icon": "fas fa-sync",
            "type": "image"
        },
        {
            "id": "flip",
            "label": "이미지 뒤집기",
            "icon": "fas fa-exchange-alt",
            "type": "image"
        },
        {
            "id": "brightness",
            "label": "밝기 조정",
            "icon": "fas fa-sun",
            "type": "image"
        },
        {
            "id": "contrast",
            "label": "대비 조정",
            "icon": "fas fa-adjust",
            "type": "image"
        },
        {
            "id": "blur",
            "label": "블러 효과",
            "icon": "fas fa-blur",
            "type": "image"
        },
        {
            "id": "sharpen",
            "label": "선명도 조정",
            "icon": "fas fa-cut",
            "type": "image"
        },
        {
            "id": "grayscale",
            "label": "흑백 변환",
            "icon": "fas fa-image",
            "type": "image"
        },
        {
            "id": "threshold",
            "label": "이진화",
            "icon": "fas fa-tachometer-alt",
            "type": "image"
        },
        {
            "id": "edge",
            "label": "엣지 검출",
            "icon": "fas fa-border-style",
            "type": "image"
        },
        {
            "id": "hue",
            "label": "색상 조정",
            "icon": "fas fa-palette",
            "type": "image"
        },
        {
            "id": "merge",
            "label": "이미지 병합",
            "icon": "fas fa-object-group",
            "type": "image"
        }
    ]
    
    defaultOptions = {
        "resize": {
            "width": 500,
            "height": 500
        },
        "crop": {
            "x": 0,
            "y": 0,
            "width": 100,
            "height": 100
        },
        "rotate": {
            "angle": 0
        },
        "flip": {
            "direction": "horizontal"
        },
        "brightness": {
            "factor": 1.0
        },
        "contrast": {
            "factor": 1.0
        },
        "blur": {
            "radius": 2
        },
        "sharpen": {
            "radius": 2,
            "percent": 150
        },
        "grayscale": {
            "enabled": True
        },
        "threshold": {
            "threshold": 128
        },
        "edge": {
            "method": "canny",
            "low_threshold": 50,
            "high_threshold": 150
        },
        "hue": {
            "hue_factor": 0
        },
        "merge": {
            "merge_type": "horizontal",
            "spacing": 0
        }
    }
    
    return {
        "options": nodes,
        "defaultOptions": defaultOptions
    }

@router.post("/process/resize")
async def process_resize(image: UploadFile = File(...), params: str = Form(...)):
    """Resize an image"""
    import json
    params = json.loads(params)
    
    try:
        image_data = await image.read()
        img = decode_image(image_data)
        
        width = params.get("width", 100)
        height = params.get("height", 100)
        mode = params.get("mode", "stretch")
        
        result_img = None
        if mode == "stretch":
            result_img = img.resize((width, height), Image.LANCZOS)
        elif mode == "fit":
            img.thumbnail((width, height), Image.LANCZOS)
            result_img = img
        elif mode == "fill":
            img_ratio = img.width / img.height
            target_ratio = width / height
            
            if img_ratio > target_ratio:  # Image is wider
                new_height = height
                new_width = int(height * img_ratio)
            else:  # Image is taller
                new_width = width
                new_height = int(width / img_ratio)
            
            resized = img.resize((new_width, new_height), Image.LANCZOS)
            
            # Center crop
            left = (resized.width - width) // 2
            top = (resized.height - height) // 2
            right = left + width
            bottom = top + height
            
            result_img = resized.crop((left, top, right, bottom))
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes = encode_image_to_bytes(result_img)
        return Response(content=img_bytes, media_type="image/png", 
                        headers={"X-Process-Status": "success"})
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": str(e)}
        )

# 기존 통합 엔드포인트 수정 - 모든 노드 타입 지원
@router.post("/process")
async def process_image(image: UploadFile = File(...), nodeType: str = Form(...), params: str = Form(...)):
    """Process an image based on the node type and parameters"""
    import json
    params_dict = json.loads(params)
    
    try:
        image_data = await image.read()
        img = decode_image(image_data)
        
        node_type = nodeType
        
        # 노드 타입에 따라 처리 로직 실행
        result_img = None
        
        if node_type == "resize":
            width = params_dict.get("width", 100)
            height = params_dict.get("height", 100)
            result_img = img.resize((width, height), Image.LANCZOS)
            
        elif node_type == "crop":
            x = params_dict.get("x", 0)
            y = params_dict.get("y", 0)
            width = params_dict.get("width", 100)
            height = params_dict.get("height", 100)
            
            right = min(x + width, img.width)
            bottom = min(y + height, img.height)
            
            result_img = img.crop((x, y, right, bottom))
            
        elif node_type == "rotate":
            angle = params_dict.get("angle", 0)
            result_img = img.rotate(angle, Image.BICUBIC, expand=True)
            
        elif node_type == "flip":
            direction = params_dict.get("direction", "horizontal")
            
            if direction == "horizontal":
                result_img = ImageOps.mirror(img)
            elif direction == "vertical":
                result_img = ImageOps.flip(img)
            elif direction == "both":
                result_img = ImageOps.flip(ImageOps.mirror(img))
            else:
                result_img = img
                
        elif node_type == "brightness":
            factor = params_dict.get("factor", 1.0)
            enhancer = ImageEnhance.Brightness(img)
            result_img = enhancer.enhance(factor)
            
        elif node_type == "contrast":
            factor = params_dict.get("factor", 1.0)
            enhancer = ImageEnhance.Contrast(img)
            result_img = enhancer.enhance(factor)
            
        elif node_type == "blur":
            radius = params_dict.get("radius", 2)
            result_img = img.filter(ImageFilter.GaussianBlur(radius=radius))
            
        elif node_type == "sharpen":
            radius = params_dict.get("radius", 2)
            percent = params_dict.get("percent", 150)
            enhancer = ImageEnhance.Sharpness(img)
            factor = 1.0 + (percent / 100.0)
            result_img = enhancer.enhance(factor)
            
        elif node_type == "grayscale":
            result_img = ImageOps.grayscale(img)
            if result_img.mode == 'L':
                result_img = result_img.convert('RGB')
                
        elif node_type == "threshold":
            threshold_value = params_dict.get("threshold", 128)
            gray_img = ImageOps.grayscale(img)
            result_img = gray_img.point(lambda x: 255 if x > threshold_value else 0)
            result_img = result_img.convert('RGB')
            
        elif node_type == "edge":
            method = params_dict.get("method", "find_edges")
            if method == "find_edges":
                result_img = img.filter(ImageFilter.FIND_EDGES)
            elif method == "contour":
                result_img = img.filter(ImageFilter.CONTOUR)
            elif method == "emboss":
                result_img = img.filter(ImageFilter.EMBOSS)
            else:
                result_img = img
                
        elif node_type == "hue":
            shift = params_dict.get("shift", 0)
            img_array = np.array(img.convert('HSV'))
            img_array[:, :, 0] = (img_array[:, :, 0] + shift) % 180
            result_img = Image.fromarray(img_array, 'HSV').convert('RGB')
            
        else:
            # 지원하지 않는 노드 타입
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": f"Unsupported node type: {node_type}"}
            )
        
        # 결과 이미지가 없으면 오류
        if result_img is None:
            raise ValueError(f"Failed to process image with node type: {node_type}")
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes = encode_image_to_bytes(result_img)
        return Response(content=img_bytes, media_type="image/png", 
                        headers={"X-Process-Status": "success"})
        
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": str(e)}
        )

@router.post("/process/merge")
async def process_merge(images: List[UploadFile] = File(...), params: str = Form(...)):
    """Merge multiple images into one"""
    import json
    params_dict = json.loads(params)
    
    try:
        # 모든 이미지 읽기
        pil_images = []
        for img_file in images:
            image_data = await img_file.read()
            pil_images.append(decode_image(image_data))
        
        if not pil_images:
            raise ValueError("No valid images provided for merging")
        
        # 병합 파라미터 처리
        merge_type = params_dict.get("merge_type", "horizontal")
        spacing = params_dict.get("spacing", 0)
        
        # 병합 처리 로직
        if len(pil_images) == 1:
            # 이미지가 하나면 그대로 반환
            result_img = pil_images[0]
        elif merge_type == "horizontal":
            # 가로 병합
            width = sum(img.width for img in pil_images) + spacing * (len(pil_images) - 1)
            height = max(img.height for img in pil_images)
            merged_img = Image.new('RGBA', (width, height), (255, 255, 255, 0))
            
            x_offset = 0
            for img in pil_images:
                merged_img.paste(img, (x_offset, (height - img.height) // 2), img if img.mode == 'RGBA' else None)
                x_offset += img.width + spacing
                
            result_img = merged_img
        elif merge_type == "vertical":
            # 세로 병합
            width = max(img.width for img in pil_images)
            height = sum(img.height for img in pil_images) + spacing * (len(pil_images) - 1)
            
            merged_img = Image.new('RGBA', (width, height), (255, 255, 255, 0))
            
            y_offset = 0
            for img in pil_images:
                merged_img.paste(img, ((width - img.width) // 2, y_offset), img if img.mode == 'RGBA' else None)
                y_offset += img.height + spacing
                
            result_img = merged_img
        else:
            # 기본 가로 병합
            width = sum(img.width for img in pil_images) + spacing * (len(pil_images) - 1)
            height = max(img.height for img in pil_images)
            
            merged_img = Image.new('RGBA', (width, height), (255, 255, 255, 0))
            
            x_offset = 0
            for img in pil_images:
                merged_img.paste(img, (x_offset, (height - img.height) // 2), img if img.mode == 'RGBA' else None)
                x_offset += img.width + spacing
                
            result_img = merged_img
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes = encode_image_to_bytes(result_img)
        return Response(content=img_bytes, media_type="image/png", 
                       headers={"X-Process-Status": "success"})
        
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": str(e)}
        )

@router.post("/process")
async def process_lcnc(file: UploadFile = File(...)):
    try:
        # 파일 저장
        filename = file.filename
        file_path = os.path.join(LCNC_DIR, filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        return {
            "status": "success",
            "message": "LCNC processed successfully",
            "filename": filename,
            "path": file_path
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list")
async def get_lcnc_images():
    try:
        # LCNC 처리된 이미지 목록 조회
        images = []
        for filename in os.listdir(LCNC_DIR):
            if filename.endswith(('.jpg', '.jpeg', '.png')):
                images.append({
                    "filename": filename,
                    "path": os.path.join(LCNC_DIR, filename),
                    "process_time": os.path.getctime(os.path.join(LCNC_DIR, filename))
                })
        return {"status": "success", "images": images}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    try:
        # 원본 파일명 사용 (타임스탬프 제거)
        filename = file.filename
        file_path = os.path.join(UPLOAD_DIR, filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        return {
            "status": "success",
            "message": "Image uploaded successfully",
            "filename": filename,
            "path": file_path
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 

# 워크플로우 결과 MongoDB에 저장
@router.post("/save-workflow")
async def save_workflow_to_mongodb(workflow_data: Dict[str, Any] = Body(...)):
    """
    워크플로우 데이터를 MongoDB에 저장합니다.
    이미지 데이터는 제외하고 노드 옵션 정보만 저장합니다.
    같은 세션의 같은 입력 이미지에 대해서는 덮어쓰기를 수행합니다.
    """
    try:
        print(f"[API] 워크플로우 저장 요청 수신 - 세션 ID: {workflow_data.get('session_id')}")
        print(f"[API] MongoDB 연결 정보: {mongo_host}:{mongo_port}, DB: {mongo_db_name}, Collection: {mongo_collection}")
        
        # 필수 데이터 검증
        if not workflow_data.get("session_id"):
            print("[API] 오류: 세션 ID 누락")
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "세션 ID가 필요합니다."}
            )
            
        if not workflow_data.get("elements"):
            print("[API] 오류: 워크플로우 요소 누락")
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "워크플로우 요소가 필요합니다."}
            )
        
        # 현재 타임스탬프 추가
        workflow_data["timestamp"] = datetime.now()
        
        print(f"[API] 워크플로우 데이터 추출 시작 - 요소 수: {len(workflow_data.get('elements', []))}")
        
        # 노드 데이터 추출 및 구조화
        nodes_data = []
        for element in workflow_data.get("elements", []):
            element_type = element.get("type")
            element_id = element.get("id")
            
            if element_type not in ["smoothstep", "start", "end"]:
                print(f"[API] 처리 노드 발견 - ID: {element_id}, 타입: {element_type}")
                
                # 기본 노드 데이터
                node_data = {
                    "id": element_id,
                    "type": element_type,
                    "label": element.get("data", {}).get("label", "Unnamed Node"),
                    "position": element.get("position", {"x": 0, "y": 0})
                }
                
                # 데이터 객체가 존재하는지 확인
                if "data" in element and element["data"]:
                    node_data["data"] = element["data"]
                    
                    # params를 상위 레벨로 이동
                    if "params" in element["data"] and element["data"]["params"]:
                        params = element["data"]["params"]
                        for param_key, param_value in params.items():
                            # 값 추출 (객체인 경우 값만 추출)
                            if isinstance(param_value, dict) and "value" in param_value:
                                node_data[param_key] = param_value["value"]
                            else:
                                node_data[param_key] = param_value
                
                nodes_data.append(node_data)
                
        print(f"[API] 추출된 노드 수: {len(nodes_data)}")
        
        # 워크플로우 이름 및 설명 검증
        workflow_name = workflow_data.get("workflow_name", "").strip()
        if not workflow_name:
            workflow_name = f"워크플로우 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
            print(f"[API] 워크플로우 이름 자동 생성: {workflow_name}")
        
        # 저장할 데이터 구성
        save_data = {
            "session_id": workflow_data.get("session_id"),
            "input_image_hash": workflow_data.get("input_image_hash"),
            "workflow_name": workflow_name,
            "workflow_description": workflow_data.get("workflow_description", ""),
            "nodes": nodes_data,
            "connections": [e for e in workflow_data.get("elements", []) if e.get("type") == "smoothstep"],
            "timestamp": workflow_data["timestamp"],
            "has_start_image": "start_image" in workflow_data and workflow_data["start_image"] is not None,
            "has_end_image": "end_image" in workflow_data and workflow_data["end_image"] is not None
        }
        
        # 실제 이미지 데이터는 저장하지 않음 (데이터베이스 크기 감소)
        if "start_image" in save_data:
            del save_data["start_image"]
        if "end_image" in save_data:
            del save_data["end_image"]
            
        print(f"[API] MongoDB 저장 시도 - 세션 ID: {save_data['session_id']}")
        
        # 입력 이미지 해시로 기존 문서 찾기
        existing_doc = None
        if save_data.get("input_image_hash"):
            existing_doc = await async_lcnc_results.find_one({
                "input_image_hash": save_data["input_image_hash"]
            })
            
            if existing_doc:
                print(f"[API] 기존 워크플로우 발견 - ID: {existing_doc.get('_id')}")
        
        if existing_doc:
            # 기존 문서 업데이트
            result = await async_lcnc_results.update_one(
                {"_id": existing_doc["_id"]},
                {"$set": save_data}
            )
            print(f"[API] 워크플로우 업데이트 완료 - 수정된 문서 수: {result.modified_count}")
            return {
                "status": "success",
                "message": "워크플로우가 성공적으로 업데이트되었습니다",
                "modified": result.modified_count > 0,
                "document_id": str(existing_doc["_id"])
            }
        else:
            # 새 문서 추가
            result = await async_lcnc_results.insert_one(save_data)
            print(f"[API] 새 워크플로우 저장 완료 - 문서 ID: {result.inserted_id}")
            return {
                "status": "success",
                "message": "워크플로우가 성공적으로 저장되었습니다",
                "inserted_id": str(result.inserted_id)
            }
            
    except Exception as e:
        error_message = f"워크플로우 저장 중 오류 발생: {str(e)}"
        print(f"[API 오류] {error_message}")
        import traceback
        print(f"[API 오류 상세] {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=error_message)

# 워크플로우 결과 MongoDB에서 조회
@router.get("/get-workflow/{session_id}")
async def get_workflow_from_mongodb(session_id: str):
    """
    MongoDB에서 워크플로우 데이터를 조회합니다.
    """
    try:
        # MongoDB에서 조회
        workflow_data = await async_lcnc_results.find_one({"session_id": session_id})
        
        if not workflow_data:
            return JSONResponse(
                status_code=404,
                content={"status": "error", "message": f"세션 ID {session_id}에 해당하는 워크플로우를 찾을 수 없습니다"}
            )
        
        # _id 필드 제거 (JSON 직렬화 불가)
        workflow_data.pop("_id", None)
        
        # 응답 반환
        return {
            "status": "success",
            "data": workflow_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"워크플로우 조회 중 오류 발생: {str(e)}")

# 워크플로우 결과 MongoDB에서 해시 기반 조회
@router.get("/get-workflow-by-hash/{image_hash}")
async def get_workflow_by_hash(image_hash: str):
    """
    MongoDB에서 이미지 해시로 워크플로우 데이터를 조회합니다.
    """
    try:
        # MongoDB에서 조회
        workflow_data = await async_lcnc_results.find_one({"input_image_hash": image_hash})
        
        if not workflow_data:
            return JSONResponse(
                status_code=404,
                content={"status": "error", "message": f"이미지 해시 {image_hash}에 해당하는 워크플로우를 찾을 수 없습니다"}
            )
        
        # _id 필드 제거 (JSON 직렬화 불가)
        workflow_data.pop("_id", None)
        
        # 응답 반환
        return {
            "status": "success",
            "data": workflow_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"워크플로우 조회 중 오류 발생: {str(e)}")

# 이미지 업로드 및 유사 이미지 검색 API
@router.post("/upload-and-find-similar")
async def upload_and_find_similar(file: UploadFile = File(...)):
    """
    이미지를 업로드하고 유사 이미지를 검색합니다.
    임시 파일로 저장 후 벡터 검색 API를 호출합니다.
    """
    try:
        # 임시 파일로 저장
        temp_dir = "./temp"
        os.makedirs(temp_dir, exist_ok=True)
        
        file_path = os.path.join(temp_dir, file.filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 이미지 벡터 추출
        # 실제 서비스에서는 ML 모델을 사용하여 벡터 추출
        # 이 예시에서는 임의의 유사 이미지 결과를 반환
        
        # 가상 유사 이미지 결과 생성
        similar_images = []
        
        # 디렉토리에서 이미지 파일 목록 가져오기
        image_dir = "./images"
        if os.path.exists(image_dir):
            image_files = [f for f in os.listdir(image_dir) 
                         if f.lower().endswith(('.jpg', '.jpeg', '.png', '.gif'))]
            
            # 최대 4개 이미지 선택
            import random
            selected_images = random.sample(image_files, min(4, len(image_files)))
            
            for img_file in selected_images:
                # 유사도 임의 생성 (0.6 ~ 0.95)
                similarity = random.uniform(0.6, 0.95)
                similar_images.append({
                    "filename": img_file,
                    "similarity": round(similarity, 2),
                    "url": f"http://localhost:8091/images/{img_file}"
                })
        
        # 임시 파일 삭제
        os.remove(file_path)
        
        return {
            "status": "success",
            "message": "유사 이미지 검색 완료",
            "original_filename": file.filename,
            "similar_images": similar_images
        }
        
    except Exception as e:
        # 오류 발생 시 임시 파일 삭제 시도
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except:
            pass
            
        raise HTTPException(status_code=500, detail=f"유사 이미지 검색 중 오류 발생: {str(e)}") 