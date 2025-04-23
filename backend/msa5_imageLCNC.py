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

router = APIRouter()

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
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{timestamp}_{file.filename}"
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