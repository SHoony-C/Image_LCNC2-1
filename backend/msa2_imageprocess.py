from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
import os
from PIL import Image
import numpy as np

router = APIRouter()

PROCESSED_DIR = "./processed"
os.makedirs(PROCESSED_DIR, exist_ok=True)

@router.post("/msa2/process")
async def process_image(image_data: Dict[str, Any]):
    try:
        # 이미지 처리 로직
        input_path = image_data.get("path")
        if not input_path or not os.path.exists(input_path):
            raise HTTPException(status_code=400, detail="Invalid image path")

        # 이미지 처리 예시 (실제로는 더 복잡한 처리 필요)
        with Image.open(input_path) as img:
            # 이미지 처리 작업
            processed_img = img.convert('L')  # 그레이스케일 변환 예시
            
            # 처리된 이미지 저장
            filename = os.path.basename(input_path)
            output_path = os.path.join(PROCESSED_DIR, f"processed_{filename}")
            processed_img.save(output_path)

        return {
            "status": "success",
            "message": "Image processed successfully",
            "output_path": output_path
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/msa2/processed")
async def get_processed_images():
    try:
        # 처리된 이미지 목록 조회
        images = []
        for filename in os.listdir(PROCESSED_DIR):
            if filename.startswith('processed_') and filename.endswith(('.jpg', '.jpeg', '.png')):
                images.append({
                    "filename": filename,
                    "path": os.path.join(PROCESSED_DIR, filename),
                    "process_time": os.path.getctime(os.path.join(PROCESSED_DIR, filename))
                })
        return {"status": "success", "images": images}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 