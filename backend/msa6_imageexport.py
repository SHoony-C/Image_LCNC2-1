from fastapi import APIRouter, HTTPException, UploadFile, File, Body
from typing import List, Dict, Any
import os
import shutil
from datetime import datetime
from fastapi.responses import FileResponse
from database import lcnc_results, async_lcnc_results
import json

router = APIRouter()

EXPORT_DIR = "./exports"
os.makedirs(EXPORT_DIR, exist_ok=True)

@router.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    try:
        # 원본 파일명 사용 (타임스탬프 제거)
        filename = file.filename
        file_path = os.path.join(EXPORT_DIR, filename)
        
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

@router.get("/download/{filename}")
async def download_image(filename: str):
    try:
        file_path = os.path.join(EXPORT_DIR, filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        return FileResponse(file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list")
async def get_exports():
    try:
        # 내보내기된 이미지 목록 조회
        images = []
        for filename in os.listdir(EXPORT_DIR):
            if filename.endswith(('.jpg', '.jpeg', '.png')):
                images.append({
                    "filename": filename,
                    "path": os.path.join(EXPORT_DIR, filename),
                    "export_time": os.path.getctime(os.path.join(EXPORT_DIR, filename))
                })
        return {"status": "success", "images": images}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 

@router.post("/save-measurement")
async def save_measurement_to_mongodb(measurement_data: Dict[str, Any] = Body(...)):
    """
    측정 데이터를 MongoDB에 저장합니다.
    """
    try:
        # 세션 ID 확인
        session_id = measurement_data.get("session_id")
        if not session_id:
            raise HTTPException(status_code=400, detail="세션 ID가 필요합니다")
            
        # 측정 결과 데이터
        measurements = measurement_data.get("measurements", [])
        
        # MongoDB에서 기존 워크플로우 조회
        workflow_data = await async_lcnc_results.find_one({"session_id": session_id})
        
        if not workflow_data:
            return HTTPException(status_code=404, detail=f"세션 ID {session_id}에 해당하는 워크플로우를 찾을 수 없습니다")
        
        # 측정 결과 추가
        if "measurements" not in workflow_data:
            workflow_data["measurements"] = []
            
        # 새 측정 결과 추가
        workflow_data["measurements"] = measurements
        workflow_data["measurement_timestamp"] = datetime.now()
        
        # MongoDB 업데이트
        result = await async_lcnc_results.replace_one(
            {"session_id": session_id}, 
            workflow_data
        )
        
        # 응답 반환
        return {
            "status": "success",
            "message": "측정 결과가 성공적으로 저장되었습니다",
            "modified": result.modified_count > 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"측정 결과 저장 중 오류 발생: {str(e)}") 