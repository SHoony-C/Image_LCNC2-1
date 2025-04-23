from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import List, Dict, Any
import os
import shutil
from datetime import datetime

router = APIRouter()

PROCESS_DIR = "./processed"
os.makedirs(PROCESS_DIR, exist_ok=True)

@router.post("/process")
async def process_image(file: UploadFile = File(...)):
    try:
        # 파일 저장
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{timestamp}_{file.filename}"
        file_path = os.path.join(PROCESS_DIR, filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        return {
            "status": "success",
            "message": "Image processed successfully",
            "filename": filename,
            "path": file_path
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list")
async def get_processed_images():
    try:
        # 처리된 이미지 목록 조회
        images = []
        for filename in os.listdir(PROCESS_DIR):
            if filename.endswith(('.jpg', '.jpeg', '.png')):
                images.append({
                    "filename": filename,
                    "path": os.path.join(PROCESS_DIR, filename),
                    "process_time": os.path.getctime(os.path.join(PROCESS_DIR, filename))
                })
        return {"status": "success", "images": images}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 