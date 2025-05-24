from fastapi import APIRouter, HTTPException, Depends, File, UploadFile, Form, Body, Query
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import os
import json
import shutil
from datetime import datetime
from pymongo import MongoClient
from bson import ObjectId
import logging

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 라우터 정의
router = APIRouter()

# MongoDB 연결 설정
from db_config import MONGODB_SETTINGS

# MongoDB 클라이언트 생성
mongo_client = MongoClient(f"mongodb://{MONGODB_SETTINGS['HOST']}:{MONGODB_SETTINGS['PORT']}")
lcnc_results = mongo_client[MONGODB_SETTINGS['DATABASE']]['lcnc_result']

# 워크플로우 정보 가져오기
@router.get("/get-by-image")
async def get_workflow_by_image(filename: str):
    try:
        # 파일명에서 확장자 제거 (확장자가 있는 경우)
        base_filename = filename
        if '.' in filename:
            base_filename = filename.rsplit('.', 1)[0]  # 확장자 제거
        
        # "_before" 및 "_after" 접미사 제거
        clean_filename = base_filename
        for suffix in ["_before", "_after"]:
            if clean_filename.endswith(suffix):
                clean_filename = clean_filename[:-len(suffix)]
                break
        
        logger.info(f"Searching for workflow with clean filename: {clean_filename}, base: {base_filename}, original: {filename}")
        
        # 확장자 유무와 접미사 유무에 관계없이 MongoDB 쿼리 수행
        workflow = lcnc_results.find_one({
            "$or": [
                {"image_filename": filename},
                {"image_filename": base_filename},
                {"image_filename": clean_filename},
                {"input_image": filename},
                {"input_image": base_filename},
                {"input_image": clean_filename},
                {"output_image": filename},
                {"output_image": base_filename},
                {"output_image": clean_filename},
                {"images": {"$in": [filename, base_filename, clean_filename]}},
                {"processed_images": {"$in": [filename, base_filename, clean_filename]}},
                {"workflow_name": {"$regex": clean_filename, "$options": "i"}},
                {"workflow_name": {"$regex": base_filename, "$options": "i"}}
            ]
        })
        
        if workflow:
            # ObjectId를 문자열로 변환 (JSON 직렬화를 위해)
            workflow['_id'] = str(workflow['_id'])
            
            return {
                "status": "success",
                "workflow": workflow
            }
        else:
            # 데이터베이스에서 사용 가능한 워크플로우 목록 로깅 (디버깅용)
            sample_workflows = list(lcnc_results.find().limit(5))
            logger.info(f"No workflow found for {filename}. Sample workflows in DB: {[w.get('workflow_name', 'unknown') for w in sample_workflows]}")
            
            return {
                "status": "not_found",
                "message": f"No workflow found for image: {filename}"
            }
    except Exception as e:
        logger.error(f"Error fetching workflow for image {filename}: {str(e)}")
        return {
            "status": "error", 
            "message": str(e)
        }

@router.get("/workflow/tasks")
async def get_workflow_tasks():
    try:
        # 워크플로우 태스크 조회 로직
        return {
            "status": "success",
            "tasks": [
                {
                    "id": 1,
                    "name": "Task 1",
                    "status": "pending",
                    "created_at": "2024-03-01"
                }
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/workflow/task")
async def create_workflow_task(task: Dict[str, Any]):
    try:
        # 워크플로우 태스크 생성 로직
        return {"status": "success", "task_id": 1}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 