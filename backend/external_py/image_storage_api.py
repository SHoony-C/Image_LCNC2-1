from fastapi import APIRouter, Body, HTTPException
from typing import Dict, Any, Optional
from datetime import datetime
import os
import base64
import re
import shutil
import requests
from urllib.parse import urlparse
from pymongo import MongoClient
from bson import ObjectId

# 라우터 설정
router = APIRouter()

# MongoDB 연결 설정
mongo_client = MongoClient("mongodb://localhost:27017")
mongo_db = mongo_client["lcnc"]
image_collection = mongo_db["image_store"]

# 이미지 저장 경로 설정
IMAGE_STORE_PATH = r"D:\image_set_url\images"

# 경로가 없으면 생성
os.makedirs(IMAGE_STORE_PATH, exist_ok=True)

# 로그 경로도 생성 (디버깅용)
LOG_PATH = os.path.join(IMAGE_STORE_PATH, "logs")
os.makedirs(LOG_PATH, exist_ok=True)

# 디버그 로그 생성 함수
def log_debug(message):
    """디버그 로그를 저장"""
    try:
        log_file = os.path.join(LOG_PATH, "debug.log")
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(f"[{timestamp}] {message}\n")
    except Exception as e:
        print(f"로그 저장 오류: {e}")

# 파일명에 사용할 수 없는 문자 제거 함수
def sanitize_filename(filename):
    """파일명에서 사용할 수 없는 문자를 제거하고 공백을 언더스코어로 변환"""
    # 윈도우에서 사용할 수 없는 문자 제거: \ / : * ? " < > |
    sanitized = re.sub(r'[\\/*?:"<>|]', "", filename)
    # 공백을 언더스코어로 변환
    sanitized = sanitized.replace(' ', '_')
    return sanitized

# noname_숫자 패턴의 다음 번호 생성 함수
def get_next_noname_number():
    """MongoDB에서 Unknown_Image_ 패턴의 문서를 조회하여 다음 번호를 생성"""
    try:
        # Unknown_Image_ 패턴으로 시작하는 모든 이미지 제목 조회
        pattern = re.compile(r'^noname_\d+$')
        cursor = image_collection.find({"title": pattern})
        
        # 번호 추출 및 최대값 찾기
        max_num = 0
        for doc in cursor:
            try:
                num = int(doc["title"].split("_")[1])  # Unknown_Image_숫자 형식이므로 인덱스 2
                if num > max_num:
                    max_num = num
            except (IndexError, ValueError):
                continue
        
        # 다음 번호 반환
        return max_num + 1
    except Exception as e:
        # 에러 발생 시 1부터 시작
        print(f"번호 생성 중 오류: {str(e)}")
        return 1

# 제목이 없을 때 고유한 이름 생성
def generate_unique_title(provided_title=None):
    """이미지 제목이 없거나 기본값일 때 고유한 이름 생성"""
    if not provided_title or provided_title == "이미지 제목 없음":
        next_num = get_next_noname_number()
        return f"noname_{next_num}"
    
    # 제공된 제목에 공백이 있으면 언더스코어로 변환
    sanitized_title = provided_title.replace(" ", "_")
    
    # 이미 동일한 제목이 있는지 확인
    existing = image_collection.find_one({"title": sanitized_title})
    if existing:
        # 중복된 경우 처리 방식 변경 - 자동 변경이 아닌 중복 응답 제공
        return {"is_duplicate": True, "title": sanitized_title}
    
    return sanitized_title

@router.post("/save-images")
async def save_images(data: Dict[str, Any] = Body(...)):
    """
    Before/After 이미지를 저장하는 API
    
    요청 데이터:
    - title: 이미지 제목 (필수)
    - before_image: 이미지 URL 또는 Base64 이미지 (필수)
    - after_image: 이미지 URL 또는 Base64 이미지 (필수)
    - description: 이미지 설명 (선택)
    - workflow_id: 관련 워크플로우 ID (선택)
    - tags: 이미지 태그 목록 (선택)
    """
    try:
        # 필드 검증
        title = data.get("title")
        before_image = data.get("before_image")
        after_image = data.get("after_image")
        
        # 제목 필수 검증
        if not title:
            raise HTTPException(status_code=400, detail="이미지 제목은 필수 항목입니다.")
        
        # 이름에 공백이 있는지 확인
        if title and " " in title:
            # 오류 대신 자동 변환하고 경고 메시지 포함
            original_title = title
            title = title.replace(" ", "_")
            warning_message = f"제목에 공백이 포함되어 있어 '{original_title}'에서 '{title}'로 자동 변환되었습니다."
        else:
            warning_message = None
        
        # 이미지 제목이 없으면 고유한 이름 생성
        title_result = generate_unique_title(title)
        
        # 중복 체크 결과가 딕셔너리로 반환된 경우
        if isinstance(title_result, dict) and title_result.get("is_duplicate"):
            return {
                "status": "duplicate_name",
                "message": f"이미 사용 중인 이름입니다: {title_result['title']}",
                "duplicate_title": title_result["title"]
            }
        
        # 중복이 아니면 제목 사용
        title = title_result
        
        if not before_image or not after_image:
            raise HTTPException(status_code=400, detail="처리 전/후 이미지는 필수 항목입니다.")
        
        # 파일명 생성 및 정리
        sanitized_title = title
        before_filename = f"{sanitized_title}_before.png"
        after_filename = f"{sanitized_title}_after.png"
        
        # MongoDB에서 같은 제목의 이미지가 있는지 확인
        existing_image = image_collection.find_one({"title": title})
        
        # 이미지 저장 경로
        before_path = os.path.join(IMAGE_STORE_PATH, before_filename)
        after_path = os.path.join(IMAGE_STORE_PATH, after_filename)
        
        # URL 또는 Base64 이미지를 파일로 저장하는 함수
        def save_image(image_data, file_path):
            log_debug(f"이미지 저장 시작: {file_path}")
            # URL인지 Base64인지 확인
            if image_data.startswith(('http://', 'https://', '/')):
                # URL에서 이미지 다운로드
                try:
                    if image_data.startswith('/'):
                        log_debug(f"로컬 경로에서 이미지 복사: {image_data} -> {file_path}")
                        # 절대 경로인 경우 로컬 파일 복사
                        if os.path.exists(image_data):
                            # 폴더가 존재하는지 확인
                            os.makedirs(os.path.dirname(file_path), exist_ok=True)
                            shutil.copy(image_data, file_path)
                            log_debug(f"파일 복사 완료: {file_path}")
                        else:
                            log_debug(f"로컬 파일을 찾을 수 없음: {image_data}")
                            raise HTTPException(status_code=404, detail=f"로컬 파일을 찾을 수 없습니다: {image_data}")
                    else:
                        log_debug(f"URL에서 다운로드: {image_data}")
                        # 외부 URL에서 다운로드
                        response = requests.get(image_data, stream=True)
                        if response.status_code == 200:
                            # 폴더가 존재하는지 확인
                            os.makedirs(os.path.dirname(file_path), exist_ok=True)
                            with open(file_path, 'wb') as f:
                                for chunk in response.iter_content(1024):
                                    f.write(chunk)
                            log_debug(f"URL 다운로드 완료: {file_path}")
                        else:
                            log_debug(f"URL 다운로드 실패: {response.status_code}")
                            raise HTTPException(status_code=response.status_code, 
                                              detail=f"이미지 다운로드 실패: {response.status_code}")
                except requests.exceptions.RequestException as e:
                    log_debug(f"요청 중 오류: {str(e)}")
                    raise HTTPException(status_code=500, detail=f"이미지 다운로드 중 오류: {str(e)}")
            else:
                # Base64 데이터로 간주하고 처리
                try:
                    log_debug("Base64 이미지 처리 시작")
                    # Base64 데이터 부분 추출
                    if "," in image_data:
                        log_debug("Base64 데이터에서 헤더 제거")
                        image_data = image_data.split(",")[1]
                    
                    # 디렉토리 확인 및 생성
                    try:
                        os.makedirs(os.path.dirname(file_path), exist_ok=True)
                        log_debug(f"디렉토리 확인/생성 완료: {os.path.dirname(file_path)}")
                    except Exception as dir_error:
                        log_debug(f"디렉토리 생성 중 오류: {str(dir_error)}")
                        raise Exception(f"디렉토리 생성 실패: {str(dir_error)}")
                    
                    log_debug(f"Base64 디코딩 및 파일 저장: {file_path}")
                    try:
                        # 이미지 데이터 디코딩
                        image_bytes = base64.b64decode(image_data)
                        log_debug(f"Base64 디코딩 완료: {len(image_bytes)} 바이트")
                        
                        # 이미지 데이터 저장
                        with open(file_path, "wb") as f:
                            f.write(image_bytes)
                        
                        # 파일이 실제로 저장되었는지 확인
                        if os.path.exists(file_path):
                            log_debug(f"파일 저장 확인: {file_path}, 크기: {os.path.getsize(file_path)} 바이트")
                        else:
                            log_debug(f"파일이 생성되지 않음: {file_path}")
                            raise Exception(f"파일이 생성되지 않았습니다: {file_path}")
                    except Exception as write_error:
                        log_debug(f"파일 쓰기 오류: {str(write_error)}")
                        raise Exception(f"파일 쓰기 오류: {str(write_error)}")
                except Exception as e:
                    log_debug(f"Base64 처리 중 오류: {str(e)}")
                    raise HTTPException(status_code=400, detail=f"유효하지 않은 Base64 데이터 또는 파일 쓰기 오류: {str(e)}")
            
            file_exists = os.path.exists(file_path)
            log_debug(f"이미지 저장 결과: {file_path} - {'성공' if file_exists else '실패'}")
            return file_exists
        
        # 이미지 파일 저장
        before_saved = save_image(before_image, before_path)
        after_saved = save_image(after_image, after_path)
        
        log_debug(f"이미지 저장 결과 - 전: {before_saved}, 후: {after_saved}")
        
        # 저장 여부 확인
        if not before_saved or not after_saved:
            log_debug("이미지 저장 실패 감지")
            raise HTTPException(status_code=500, detail="이미지 파일이 정상적으로 저장되지 않았습니다.")
        
        # 저장 정보 구성
        image_data = {
            "title": title,
            "description": data.get("description", ""),
            "workflow_id": data.get("workflow_id", ""),
            "tags": data.get("tags", []),
            "before_image_path": before_filename,
            "after_image_path": after_filename,
            "before_image_url": f"http://localhost:8000/images/{before_filename}",
            "after_image_url": f"http://localhost:8000/images/{after_filename}",
            "created_at": datetime.now(),
        }
        
        # MongoDB에 저장 또는 업데이트
        if existing_image:
            # 기존 문서 업데이트
            image_collection.update_one(
                {"_id": existing_image["_id"]}, 
                {"$set": image_data}
            )
            result = {"status": "updated", "message": "이미지가 성공적으로 업데이트되었습니다."}
        else:
            # 새 문서 추가
            insert_result = image_collection.insert_one(image_data)
            image_data["_id"] = str(insert_result.inserted_id)
            result = {"status": "created", "message": "이미지가 성공적으로 저장되었습니다."}
        
        # 결과에 이미지 정보 추가
        result["image_data"] = {
            "title": title,
            "before_url": image_data["before_image_url"],
            "after_url": image_data["after_image_url"],
        }
        
        # 경고 메시지가 있으면 응답에 포함
        if warning_message:
            result["warning"] = warning_message
        
        return result
    
    except Exception as e:
        # 오류 발생 시 임시 파일 정리
        try:
            if os.path.exists(before_path):
                os.remove(before_path)
            if os.path.exists(after_path):
                os.remove(after_path)
        except:
            pass
        
        raise HTTPException(status_code=500, detail=f"이미지 저장 중 오류 발생: {str(e)}")

@router.get("/images")
async def get_saved_images(limit: int = 20, skip: int = 0):
    """저장된 이미지 목록을 가져오는 API"""
    try:
        # MongoDB에서 이미지 목록 조회
        cursor = image_collection.find().sort("created_at", -1).skip(skip).limit(limit)
        
        # 결과 변환
        images = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])  # ObjectId를 문자열로 변환
            images.append(doc)
        
        return {"status": "success", "count": len(images), "images": images}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"이미지 목록 조회 중 오류 발생: {str(e)}")

@router.delete("/images/{image_id}")
async def delete_image(image_id: str):
    """저장된 이미지를 삭제하는 API"""
    try:
        # MongoDB에서 이미지 정보 조회
        image = image_collection.find_one({"_id": ObjectId(image_id)})
        
        if not image:
            raise HTTPException(status_code=404, detail="이미지를 찾을 수 없습니다.")
        
        # 파일 삭제
        before_path = os.path.join(IMAGE_STORE_PATH, image.get("before_image_path", ""))
        after_path = os.path.join(IMAGE_STORE_PATH, image.get("after_image_path", ""))
        
        if os.path.exists(before_path):
            os.remove(before_path)
        
        if os.path.exists(after_path):
            os.remove(after_path)
        
        # MongoDB에서 삭제
        image_collection.delete_one({"_id": ObjectId(image_id)})
        
        return {"status": "success", "message": "이미지가 성공적으로 삭제되었습니다."}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"이미지 삭제 중 오류 발생: {str(e)}")

@router.post("/check-title")
async def check_title(data: Dict[str, Any] = Body(...)):
    """이미지 제목 중복 여부를 확인하는 API"""
    try:
        title = data.get("title")
        
        if not title:
            return {
                "status": "error",
                "is_duplicate": False,
                "message": "이름을 입력해야 합니다."
            }
        
        # 공백을 언더스코어로 변환 (프론트엔드에서도 동일하게 처리되지만 백엔드에서도 보장)
        sanitized_title = title.replace(" ", "_")
        
        # 이미 동일한 제목이 있는지 확인
        existing = image_collection.find_one({"title": sanitized_title})
        
        if existing:
            return {
                "status": "duplicate_name",
                "is_duplicate": True,
                "duplicate_title": sanitized_title,
                "message": f"이미 사용 중인 이름입니다: {sanitized_title}"
            }
        
        return {
            "status": "success",
            "is_duplicate": False,
            "message": "사용 가능한 이름입니다."
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"이름 중복 확인 중 오류 발생: {str(e)}") 