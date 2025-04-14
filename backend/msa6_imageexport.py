from fastapi import APIRouter, HTTPException, Response
from typing import List, Dict, Any
import os
import shutil
from datetime import datetime

router = APIRouter()

EXPORT_DIR = "./exports"
os.makedirs(EXPORT_DIR, exist_ok=True)

@router.post("/msa6/export")
async def export_image(image_data: Dict[str, Any]):
    try:
        # 이미지 내보내기 로직
        source_path = image_data.get("path")
        if not source_path or not os.path.exists(source_path):
            raise HTTPException(status_code=400, detail="Invalid image path")

        # 내보내기 파일명 생성
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = os.path.basename(source_path)
        export_filename = f"export_{timestamp}_{filename}"
        export_path = os.path.join(EXPORT_DIR, export_filename)

        # 파일 복사
        shutil.copy2(source_path, export_path)

        return {
            "status": "success",
            "message": "Image exported successfully",
            "export_path": export_path,
            "export_time": timestamp
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/msa6/download/{filename}")
async def download_image(filename: str):
    try:
        # 이미지 다운로드
        file_path = os.path.join(EXPORT_DIR, filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")

        with open(file_path, "rb") as f:
            content = f.read()

        return Response(
            content=content,
            media_type="image/jpeg",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/msa6/exports")
async def get_exported_images():
    try:
        # 내보낸 이미지 목록 조회
        exports = []
        for filename in os.listdir(EXPORT_DIR):
            if filename.startswith('export_') and filename.endswith(('.jpg', '.jpeg', '.png')):
                full_path = os.path.join(EXPORT_DIR, filename)
                exports.append({
                    "filename": filename,
                    "path": full_path,
                    "export_time": os.path.getctime(full_path),
                    "size": os.path.getsize(full_path)
                })
        return {"status": "success", "exports": exports}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 