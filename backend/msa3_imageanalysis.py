from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
import os
import cv2
import numpy as np
from datetime import datetime

router = APIRouter()

ANALYSIS_DIR = "./analysis"
os.makedirs(ANALYSIS_DIR, exist_ok=True)

@router.post("/msa3/analyze")
async def analyze_image(image_data: Dict[str, Any]):
    try:
        # 이미지 분석 로직
        input_path = image_data.get("path")
        if not input_path or not os.path.exists(input_path):
            raise HTTPException(status_code=400, detail="Invalid image path")

        # OpenCV를 사용한 이미지 분석 예시
        img = cv2.imread(input_path)
        if img is None:
            raise HTTPException(status_code=400, detail="Failed to read image")

        # 기본적인 이미지 분석 (실제로는 더 복잡한 분석 필요)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 100, 200)
        
        # 분석 결과 저장
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        result_path = os.path.join(ANALYSIS_DIR, f"analysis_{timestamp}.jpg")
        cv2.imwrite(result_path, edges)

        return {
            "status": "success",
            "message": "Image analyzed successfully",
            "result_path": result_path,
            "analysis": {
                "edges_detected": np.sum(edges > 0),
                "image_size": img.shape,
                "analysis_time": timestamp
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/msa3/results")
async def get_analysis_results():
    try:
        # 분석 결과 목록 조회
        results = []
        for filename in os.listdir(ANALYSIS_DIR):
            if filename.startswith('analysis_') and filename.endswith('.jpg'):
                results.append({
                    "filename": filename,
                    "path": os.path.join(ANALYSIS_DIR, filename),
                    "analysis_time": os.path.getctime(os.path.join(ANALYSIS_DIR, filename))
                })
        return {"status": "success", "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 