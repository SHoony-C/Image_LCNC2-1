from fastapi import APIRouter, HTTPException, UploadFile, File, Query, Body
from typing import List, Dict, Any, Optional
import os
import shutil
from datetime import datetime
import json
from pathlib import Path

router = APIRouter()

STORAGE_DIR = "./storage"
IMAGES_DIR = os.path.join(STORAGE_DIR, "images")  # 이미지 저장 디렉토리 추가
os.makedirs(STORAGE_DIR, exist_ok=True)
os.makedirs(IMAGES_DIR, exist_ok=True)  # 이미지 저장 디렉토리 생성

@router.post("/store")
async def store_image(file: UploadFile = File(...)):
    try:
        # 파일 저장 (원본 파일명 그대로 사용)
        filename = file.filename
        file_path = os.path.join(IMAGES_DIR, filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        return {
            "status": "success",
            "message": "Image stored successfully",
            "filename": filename,
            "path": file_path
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list")
async def get_stored_images():
    try:
        # 저장된 이미지 목록 조회
        images = []
        for filename in os.listdir(IMAGES_DIR):
            if filename.endswith(('.jpg', '.jpeg', '.png')):
                images.append({
                    "filename": filename,
                    "path": os.path.join(IMAGES_DIR, filename),
                    "store_time": os.path.getctime(os.path.join(IMAGES_DIR, filename))
                })
        return {"status": "success", "images": images}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 타임스탬프 제거 함수 유지 (다른 함수에서 사용 가능)
def remove_timestamp(filename):
    """파일명에서 타임스탬프(YYYYMMDD_HHMMSS_) 형식만 제거합니다."""
    import re
    return re.sub(r'^\d{8}_\d{6}_', '', filename)

@router.post("/load-local-images")
async def load_local_images(directory_path: Optional[str] = Query(None, description="로컬 이미지가 있는 디렉토리 경로"), 
                            data: Optional[Dict[str, Any]] = Body(None)):
    """
    지정된 로컬 디렉토리에서 이미지를 로드합니다.
    이제 벡터 추출은 side_5_settings.py에서 처리합니다.
    """
    try:
        processed_images = []
        errors = []
        
        # 디렉토리 경로 결정 (Query 파라미터 또는 JSON 바디에서)
        path = directory_path
        if not path and data and "directory_path" in data:
            path = data["directory_path"]
        
        # '_before' 접미사 필터 옵션 확인
        include_before_only = False
        if data and "includeBeforeImagesOnly" in data:
            include_before_only = data["includeBeforeImagesOnly"]
        
        # 태그 옵션 확인
        tag = "Unknown"
        if data and "tag" in data:
            tag = data["tag"]
        
        print(f"필터링 옵션 상태: includeBeforeImagesOnly = {include_before_only}, tag = {tag}")
        
        if not path:
            raise HTTPException(status_code=400, detail="Directory path is required")
            
        # 지정된 디렉토리가 존재하는지 확인
        if not os.path.exists(path):
            raise HTTPException(status_code=404, detail=f"Directory not found: {path}")
        
        # 이미지 디렉토리 확인 및 생성
        os.makedirs(IMAGES_DIR, exist_ok=True)
        
        # 디렉토리에서 이미지 파일 찾기 
        filtered_files = []
        skipped_files = []
        for filename in os.listdir(path):
            if filename.lower().endswith(('.jpg', '.jpeg', '.png', '.gif')):
                # 정확히 '_before'가 포함된 파일만 필터링
                if include_before_only:
                    if '_before' in filename:
                        filtered_files.append(filename)
                    else:
                        skipped_files.append(filename)
                        continue  # '_before'가 없는 이미지는 건너뜀
                else:
                    filtered_files.append(filename)
                
                # 파일이 필터링을 통과한 경우에만 처리
                if (not include_before_only) or (include_before_only and '_before' in filename):
                    file_path = os.path.join(path, filename)
                    
                    try:
                        # 이미지 파일을 스토리지에 복사
                        destination_path = os.path.join(IMAGES_DIR, filename)
                        shutil.copy2(file_path, destination_path)
                        
                        processed_images.append({
                            "original_path": file_path,
                            "stored_filename": filename,
                            "stored_path": f"/api/imageanalysis/images/{filename}",  # API URL 경로 업데이트
                            "tag": tag
                        })
                        
                        print(f"Processed and saved image: {filename} with tag: {tag}")
                    except Exception as e:
                        errors.append({
                            "filename": filename,
                            "error": str(e)
                        })
                        print(f"Error processing image {filename}: {str(e)}")
        
        # 처리된 결과를 로그로 요약
        print(f"필터링 결과: 선택된 파일 {len(filtered_files)}개, 제외된 파일 {len(skipped_files)}개")
        if filtered_files:
            print(f"필터링 통과 파일: {filtered_files}")
        if skipped_files:
            print(f"필터링 제외 파일: {skipped_files}")
        
        print(f"처리 결과: 총 {len(processed_images)}개 이미지 처리됨, {len(errors)}개 오류 발생")
        if processed_images:
            print(f"처리된 파일: {[img['stored_filename'] for img in processed_images]}")
        
        return {
            "status": "success" if not errors or processed_images else "partial_success" if errors and processed_images else "error",
            "message": f"Processed {len(processed_images)} images with {len(errors)} errors",
            "processed": processed_images,
            "errors": errors,
            "tag": tag
        }
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"Error in load_local_images: {str(e)}\n{error_detail}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/load-test-images")
async def load_test_images():
    """테스트 이미지를 로드합니다. (더미 기능)"""
    return {"status": "success", "message": "Test images loaded successfully"} 