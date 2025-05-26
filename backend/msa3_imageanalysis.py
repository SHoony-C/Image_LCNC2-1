from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import List, Dict, Any
import os
import shutil
from datetime import datetime

router = APIRouter()

ANALYSIS_DIR = "./analysis"
os.makedirs(ANALYSIS_DIR, exist_ok=True)

@router.post("/analyze")
async def analyze_image(file: UploadFile = File(...)):
    try:
        # 파일 저장
        filename = file.filename
        file_path = os.path.join(ANALYSIS_DIR, filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        return {
            "status": "success",
            "message": "Image analyzed successfully",
            "filename": filename,
            "path": file_path
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list")
async def get_analyzed_images():
    try:
        # 분석된 이미지 목록 조회
        images = []
        for filename in os.listdir(ANALYSIS_DIR):
            if filename.endswith(('.jpg', '.jpeg', '.png')):
                images.append({
                    "filename": filename,
                    "path": os.path.join(ANALYSIS_DIR, filename),
                    "analysis_time": os.path.getctime(os.path.join(ANALYSIS_DIR, filename))
                })
        return {"status": "success", "images": images}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 