from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import List, Dict, Any
import os
import shutil
from datetime import datetime

router = APIRouter()

UPLOAD_DIR = "./uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    try:
        # 원본 파일명 그대로 사용 (타임스탬프 제거)
        filename = file.filename
        file_path = os.path.join(UPLOAD_DIR, filename)
        
        # 같은 이름의 파일이 있으면 덮어쓰기
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

@router.get("/list")
async def get_images():
    try:
        # 업로드된 이미지 목록 조회
        images = []
        for filename in os.listdir(UPLOAD_DIR):
            if filename.endswith(('.jpg', '.jpeg', '.png')):
                images.append({
                    "filename": filename,
                    "path": os.path.join(UPLOAD_DIR, filename),
                    "upload_time": os.path.getctime(os.path.join(UPLOAD_DIR, filename))
                })
        return {"status": "success", "images": images}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 