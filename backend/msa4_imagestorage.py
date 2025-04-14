from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
import os
import shutil
from datetime import datetime

router = APIRouter()

STORAGE_DIR = "./storage"
os.makedirs(STORAGE_DIR, exist_ok=True)

@router.post("/msa4/store")
async def store_image(image_data: Dict[str, Any]):
    try:
        # 이미지 저장 로직
        source_path = image_data.get("path")
        if not source_path or not os.path.exists(source_path):
            raise HTTPException(status_code=400, detail="Invalid image path")

        # 파일명 생성 및 저장
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = os.path.basename(source_path)
        stored_filename = f"stored_{timestamp}_{filename}"
        target_path = os.path.join(STORAGE_DIR, stored_filename)

        # 파일 복사
        shutil.copy2(source_path, target_path)

        return {
            "status": "success",
            "message": "Image stored successfully",
            "stored_path": target_path,
            "metadata": {
                "original_filename": filename,
                "stored_filename": stored_filename,
                "storage_time": timestamp,
                "file_size": os.path.getsize(target_path)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/msa4/stored")
async def get_stored_images():
    try:
        # 저장된 이미지 목록 조회
        images = []
        for filename in os.listdir(STORAGE_DIR):
            if filename.startswith('stored_') and filename.endswith(('.jpg', '.jpeg', '.png')):
                full_path = os.path.join(STORAGE_DIR, filename)
                images.append({
                    "filename": filename,
                    "path": full_path,
                    "storage_time": os.path.getctime(full_path),
                    "file_size": os.path.getsize(full_path)
                })
        return {"status": "success", "images": images}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 