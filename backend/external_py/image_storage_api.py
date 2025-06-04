from fastapi import APIRouter, Body, HTTPException, File, Form, UploadFile
from typing import Dict, Any, Optional
from datetime import datetime
import os
import base64
import re
import shutil
import requests
import io
from urllib.parse import urlparse
from pymongo import MongoClient
from bson import ObjectId
from config import MONGODB_SETTINGS
from PIL import Image
import json
import time

# 라우터 설정
router = APIRouter()

# MongoDB 연결 설정 - image_store 사용 대신 lcnc_result로 통합
mongo_host = MONGODB_SETTINGS['HOST']
mongo_port = MONGODB_SETTINGS['PORT']
mongo_db_name = MONGODB_SETTINGS['DATABASE']
mongo_collection = MONGODB_SETTINGS['lcnc_COLLECTION']

# MongoDB 클라이언트 생성
mongo_client = MongoClient(f"mongodb://{mongo_host}:{mongo_port}")
mongo_db = mongo_client[mongo_db_name]
lcnc_results = mongo_db[mongo_collection]

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
    """파일명에 사용할 수 없는 문자를 제거하고 안전한 파일명 생성"""
    # 파일명에 사용할 수 없는 문자 제거
    sanitized = re.sub(r'[^\w\s-]', '', filename).strip().replace(' ', '_')
    if not sanitized:
        sanitized = f"image_{int(time.time())}"
    return sanitized

# noname_숫자 패턴의 다음 번호 생성 함수
def get_next_noname_number():
    """MongoDB에서 noname_ 패턴의 문서를 조회하여 다음 번호를 생성"""
    try:
        # noname_ 패턴으로 시작하는 모든 이미지 제목 조회
        pattern = re.compile(r'^noname_\d+$')
        cursor = lcnc_results.find({"title": pattern})
        
        # 번호 추출 및 최대값 찾기
        max_num = 0
        for doc in cursor:
            try:
                num = int(doc["title"].split("_")[1])
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

# 고유한 제목 생성 함수
def generate_unique_title():
    """타임스탬프 기반의 고유한 제목 생성"""
    return f"image_{int(time.time())}"

@router.post("/save-images")
async def save_images(data: Dict[str, Any] = Body(...)):
    """
    외부 저장소에 이미지 저장 API
    
    시작 이미지(before_image)와 결과 이미지(after_image)를 
    외부 저장소에 저장하고 결과를 반환합니다.
    
    이미지는 Base64 인코딩된 데이터 URL 또는 HTTP URL 형태로 제공될 수 있습니다.
    """
    # 요청 데이터 로깅
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_debug(f"이미지 저장 요청 수신 - {timestamp}")
    
    # 필수 필드 확인
    required_fields = ["title", "before_image", "after_image"]
    for field in required_fields:
        if field not in data:
            raise HTTPException(status_code=400, detail=f"필수 필드 누락: {field}")
    
    title = data.get("title", "").strip()
    description = data.get("description", "").strip()
    before_image = data.get("before_image", "")
    after_image = data.get("after_image", "")
    workflow_id = data.get("workflow_id", "")
    tags = data.get("tags", [])
    
    # 이미지 형식 정보 (명시적으로 전달된 경우 사용)
    image_format = data.get("image_format", "").lower()
    if image_format:
        log_debug(f"클라이언트에서 전달된 이미지 형식: {image_format}")
        
    # 제목 길이 및 형식 검증
    if not title:
        raise HTTPException(status_code=400, detail="제목이 비어있습니다.")
    
    if len(title) > 100:
        raise HTTPException(status_code=400, detail="제목이 너무 깁니다 (최대 100자).")
    
    # 설명 길이 검증
    if len(description) > 500:
        raise HTTPException(status_code=400, detail="설명이 너무 깁니다 (최대 500자).")
    
    # 이미지 URL 검증
    if not before_image:
        raise HTTPException(status_code=400, detail="시작 이미지 URL이 비어있습니다.")
    
    if not after_image:
        raise HTTPException(status_code=400, detail="결과 이미지 URL이 비어있습니다.")
    
    # 파일 이름에 사용할 안전한 제목 생성
    sanitized_title = re.sub(r'[^\w\s-]', '', title).strip().replace(' ', '_')
    if not sanitized_title:
        sanitized_title = f"image_{timestamp.replace(' ', '_').replace(':', '-')}"
    
    # 이미지 저장 디렉토리 확인
    if not os.path.exists(IMAGE_STORE_PATH):
        os.makedirs(IMAGE_STORE_PATH, exist_ok=True)
    
    # 동일한 제목의 이미지가 이미 존재하는지 확인
    existing_images = []
    for filename in os.listdir(IMAGE_STORE_PATH):
        if filename.startswith(f"{sanitized_title}_"):
            existing_images.append(filename)
    
    is_update = len(existing_images) > 0
    
    log_debug(f"저장 모드: {'업데이트' if is_update else '신규 생성'}")
    
    # 이미지 형식 결정
    before_ext = "png"  # 기본값
    after_ext = "png"   # 기본값
    
    # 명시적으로 전달된 이미지 형식 사용
    if image_format:
        after_ext = image_format
        log_debug(f"클라이언트에서 전달된 형식 사용: {after_ext}")
    
    # 데이터 URL에서 이미지 형식 추출
    if before_image.startswith('data:image/'):
                mime_part = before_image.split(",")[0]
                if "image/jpeg" in mime_part:
                    before_ext = "jpg"
                elif "image/png" in mime_part:
                    before_ext = "png"
                elif "image/gif" in mime_part:
                    before_ext = "gif"
                elif "image/webp" in mime_part:
                    before_ext = "webp"
        # 추가 이미지 형식 지원
        elif "image/bmp" in mime_part:
            before_ext = "bmp"
        elif "image/tiff" in mime_part:
            before_ext = "tiff"
        
    # after_image URL에서 형식 정보 추출 (명시적 형식이 없는 경우만)
    if not image_format and after_image.startswith('data:image/'):
                mime_part = after_image.split(",")[0]
                if "image/jpeg" in mime_part:
                    after_ext = "jpg"
                elif "image/png" in mime_part:
                    after_ext = "png"
                elif "image/gif" in mime_part:
                    after_ext = "gif"
                elif "image/webp" in mime_part:
                    after_ext = "webp"
        # 추가 이미지 형식 지원
        elif "image/bmp" in mime_part:
            after_ext = "bmp"
        elif "image/tiff" in mime_part:
            after_ext = "tiff"
                    
        # URL에서 파일 확장자 추출 시도
        elif after_image.startswith(('http://', 'https://')):
            try:
                path = urlparse(after_image).path
                ext = os.path.splitext(path)[1].lower()
                if ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
                    after_ext = ext.lstrip('.')
            except:
                # 확장자 추출 실패 시 기본값 유지
                pass
                
        log_debug(f"결정된 이미지 확장자 - 시작: {before_ext}, 종료: {after_ext}")
        
        before_filename = f"{sanitized_title}_before.{before_ext}"
        after_filename = f"{sanitized_title}_after.{after_ext}"
        
        # 이미지 저장 경로
        before_path = os.path.join(IMAGE_STORE_PATH, before_filename)
        after_path = os.path.join(IMAGE_STORE_PATH, after_filename)
        
        # URL 또는 Base64 이미지를 파일로 저장하는 함수
    def save_image(image_data, file_path, format_hint=None):
        log_debug(f"이미지 저장 시작: {file_path}, 형식 힌트: {format_hint}")
            # URL인지 Base64인지 확인
            if image_data.startswith(('http://', 'https://', '/')):
            # Blob URL 처리 (blob:http://...)
            if image_data.startswith('blob:'):
                log_debug(f"Blob URL 감지: {image_data}")
                # Blob URL은 클라이언트에서만 액세스 가능하므로 별도 처리 필요
                # 형식 힌트가 있는 경우 파일 경로 조정
                if format_hint:
                    adjusted_file_path = os.path.splitext(file_path)[0] + f".{format_hint}"
                    log_debug(f"형식 힌트에 따른 파일 경로 조정: {adjusted_file_path}")
                    return False, os.path.basename(adjusted_file_path)  # 실제 저장은 클라이언트에서 수행
                else:
                    return False, os.path.basename(file_path)
            
                # URL에서 이미지 다운로드
                try:
                    if image_data.startswith('/'):
                        log_debug(f"로컬 경로에서 이미지 복사: {image_data} -> {file_path}")
                        # 절대 경로인 경우 로컬 파일 복사
                        if os.path.exists(image_data):
                            # 폴더가 존재하는지 확인
                            os.makedirs(os.path.dirname(file_path), exist_ok=True)
                            
                            # 원본 이미지 확장자 가져오기
                            original_ext = os.path.splitext(image_data)[1].lower()
                            adjusted_file_path = file_path
                            
                            # 확장자가 다른 경우 조정
                            if original_ext and os.path.splitext(file_path)[1].lower() != original_ext:
                                adjusted_file_path = os.path.splitext(file_path)[0] + original_ext
                                log_debug(f"로컬 파일 확장자 불일치. 경로 조정: {adjusted_file_path}")
                            
                            # 파일 확장자 확인을 위해 이미지 형식 검사
                            try:
                                with Image.open(image_data) as img:
                                    detected_format = img.format
                                    if detected_format:
                                        # 실제 형식에 맞는 확장자 얻기
                                        format_ext = f".{detected_format.lower()}"
                                        if format_ext == ".jpeg":
                                            format_ext = ".jpg"
                                        
                                        # 확장자 불일치 확인
                                        current_ext = os.path.splitext(adjusted_file_path)[1].lower()
                                        if current_ext != format_ext:
                                            adjusted_file_path = os.path.splitext(adjusted_file_path)[0] + format_ext
                                            log_debug(f"이미지 형식 감지: {detected_format}, 파일 경로 조정: {adjusted_file_path}")
                            except Exception as img_error:
                                log_debug(f"이미지 형식 감지 중 오류: {str(img_error)}")
                            
                            shutil.copy(image_data, adjusted_file_path)
                            log_debug(f"파일 복사 완료: {adjusted_file_path}")
                            return os.path.exists(adjusted_file_path), os.path.basename(adjusted_file_path)
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
                            
                            # Content-Type 헤더 확인하여 실제 형식 판별
                            content_type = response.headers.get('content-type', '')
                            original_extension = os.path.splitext(file_path)[1].lower()
                            adjusted_file_path = file_path
                            
                        # 명시적 형식 힌트가 있는 경우 이를 우선 사용
                        if format_hint:
                            adjusted_file_path = os.path.splitext(file_path)[0] + f".{format_hint}"
                            log_debug(f"형식 힌트를 사용하여 파일 경로 조정: {adjusted_file_path}")
                            # 컨텐츠 타입에 따른 확장자 조정
                        elif 'image/jpeg' in content_type and not original_extension.endswith(('.jpg', '.jpeg')):
                                adjusted_file_path = os.path.splitext(file_path)[0] + '.jpg'
                                log_debug(f"JPEG 이미지지만 다른 확장자로 저장하려고 했습니다. 경로 조정: {adjusted_file_path}")
                            elif 'image/png' in content_type and not original_extension.endswith('.png'):
                                adjusted_file_path = os.path.splitext(file_path)[0] + '.png'
                                log_debug(f"PNG 이미지지만 다른 확장자로 저장하려고 했습니다. 경로 조정: {adjusted_file_path}")
                            elif 'image/gif' in content_type and not original_extension.endswith('.gif'):
                                adjusted_file_path = os.path.splitext(file_path)[0] + '.gif'
                                log_debug(f"GIF 이미지지만 다른 확장자로 저장하려고 했습니다. 경로 조정: {adjusted_file_path}")
                            elif 'image/webp' in content_type and not original_extension.endswith('.webp'):
                                adjusted_file_path = os.path.splitext(file_path)[0] + '.webp'
                                log_debug(f"WebP 이미지지만 다른 확장자로 저장하려고 했습니다. 경로 조정: {adjusted_file_path}")
                                
                            # 이미지 데이터 읽기 (전체 다운로드)
                            image_bytes = response.content
                            log_debug(f"이미지 다운로드 완료: {len(image_bytes)} 바이트")
                            
                            # 메모리에서 이미지 열기
                            try:
                                img = Image.open(io.BytesIO(image_bytes))
                                detected_format = img.format
                                log_debug(f"메모리에서 이미지 형식 감지: {detected_format}")
                                
                                if detected_format:
                                    # 실제 형식에 맞는 확장자 얻기
                                    format_ext = f".{detected_format.lower()}"
                                    if format_ext == ".jpeg":
                                        format_ext = ".jpg"
                                    
                                # 형식 힌트가 있으면 그것을 우선적으로 사용
                                if format_hint:
                                    final_format = format_hint.upper()
                                    if final_format == "JPG":
                                        final_format = "JPEG"
                                    adjusted_file_path = os.path.splitext(file_path)[0] + f".{format_hint}"
                                    img.save(adjusted_file_path, format=final_format)
                                    log_debug(f"이미지를 형식 힌트에 따라 저장: {final_format}, 경로: {adjusted_file_path}")
                                # 감지된 형식을 사용
                                else:
                                    # 확장자 불일치 확인
                                    current_ext = os.path.splitext(adjusted_file_path)[1].lower()
                                    if current_ext != format_ext:
                                        adjusted_file_path = os.path.splitext(adjusted_file_path)[0] + format_ext
                                        log_debug(f"이미지 형식 감지: {detected_format}, 파일 경로 조정: {adjusted_file_path}")
                                    
                                    # 이미지를 올바른 형식으로 저장
                                    img.save(adjusted_file_path, format=detected_format)
                                    log_debug(f"이미지를 감지된 형식({detected_format})으로 저장: {adjusted_file_path}")
                                else:
                                    # 형식이 감지되지 않은 경우
                                    with open(adjusted_file_path, "wb") as f:
                                        f.write(image_bytes)
                                    log_debug(f"형식 감지 실패, 원본 바이트 저장: {adjusted_file_path}")
                            except Exception as img_error:
                                log_debug(f"이미지 처리 중 오류, 원본 바이트 저장: {str(img_error)}")
                                # 오류 발생 시 원본 바이트 저장
                                with open(adjusted_file_path, "wb") as f:
                                    f.write(image_bytes)
                            
                            log_debug(f"URL 다운로드 및 저장 완료: {adjusted_file_path}")
                            
                            # 실제 저장된 파일명 반환
                            return os.path.exists(adjusted_file_path), os.path.basename(adjusted_file_path)
                        else:
                            log_debug(f"URL 다운로드 실패: {response.status_code}")
                            raise HTTPException(status_code=response.status_code, 
                                              detail=f"이미지 다운로드 실패: {response.status_code}")
                except requests.exceptions.RequestException as e:
                    log_debug(f"요청 중 오류: {str(e)}")
                    raise HTTPException(status_code=500, detail=f"이미지 다운로드 중 오류: {str(e)}")
                
                file_exists = os.path.exists(file_path)
                log_debug(f"이미지 저장 결과: {file_path} - {'성공' if file_exists else '실패'}")
                return file_exists, os.path.basename(file_path)
            else:
            # Base64 인코딩된 이미지 처리
                try:
                # data:image/jpeg;base64, 형식의 URI에서 Base64 데이터 추출
                    mime_type = None
                image_data_b64 = image_data
                
                if ',' in image_data:
                    mime_part, image_data_b64 = image_data.split(',', 1)
                    mime_type = mime_part
                    log_debug(f"MIME 타입 추출: {mime_type}")
                
                    try:
                        # 이미지 데이터 디코딩
                    image_bytes = base64.b64decode(image_data_b64)
                        log_debug(f"Base64 디코딩 완료: {len(image_bytes)} 바이트")
                        
                        # 이미지 파일 저장 전 적절한 확장자 확인
                        adjusted_file_path = file_path
                        orig_extension = os.path.splitext(file_path)[1].lower()
                        
                    # 명시적 형식 힌트 사용
                    if format_hint:
                        adjusted_file_path = os.path.splitext(file_path)[0] + f".{format_hint}"
                        log_debug(f"형식 힌트를 사용하여 파일 경로 조정: {adjusted_file_path}")
                        # MIME 타입에서 확장자 추론
                    elif mime_type:
                        mime_extension = None
                            if 'image/jpeg' in mime_type:
                                mime_extension = '.jpg'
                            elif 'image/png' in mime_type:
                                mime_extension = '.png'
                            elif 'image/gif' in mime_type:
                                mime_extension = '.gif'
                            elif 'image/webp' in mime_type:
                                mime_extension = '.webp'
                        elif 'image/bmp' in mime_type:
                            mime_extension = '.bmp'
                        elif 'image/tiff' in mime_type:
                            mime_extension = '.tiff'
                        
                        if mime_extension and orig_extension != mime_extension:
                            adjusted_file_path = os.path.splitext(file_path)[0] + mime_extension
                            log_debug(f"MIME 타입에 따라 파일 경로 조정: {adjusted_file_path}")
                        
                        # 매직 바이트로 파일 형식 확인
                        is_png = len(image_bytes) > 8 and image_bytes.startswith(b'\x89PNG\r\n\x1a\n')
                        is_jpeg = len(image_bytes) > 2 and image_bytes.startswith(b'\xff\xd8')
                        is_gif = len(image_bytes) > 6 and (image_bytes.startswith(b'GIF87a') or image_bytes.startswith(b'GIF89a'))
                        is_webp = len(image_bytes) > 12 and image_bytes.startswith(b'RIFF') and b'WEBP' in image_bytes[0:12]
                        
                        detected_extension = None
                        detected_format = None
                    
                        if is_png:
                            detected_extension = '.png'
                            detected_format = 'PNG'
                        elif is_jpeg:
                            detected_extension = '.jpg'
                            detected_format = 'JPEG'
                        elif is_gif:
                            detected_extension = '.gif'
                            detected_format = 'GIF'
                        elif is_webp:
                            detected_extension = '.webp'
                            detected_format = 'WEBP'
                        
                    # 매직 바이트로 감지된 형식이 있고, 명시적 형식 힌트가 없는 경우
                    if detected_extension and not format_hint and orig_extension != detected_extension:
                        adjusted_file_path = os.path.splitext(file_path)[0] + detected_extension
                        log_debug(f"매직 바이트로 감지된 형식에 따라 파일 경로 조정: {adjusted_file_path}")
                    
                    # 폴더가 존재하는지 확인
                    os.makedirs(os.path.dirname(adjusted_file_path), exist_ok=True)
                        
                        try:
                            # 메모리에서 이미지 열기 시도 - 형식 확인 및 올바른 형식으로 저장
                            img = Image.open(io.BytesIO(image_bytes))
                            img_format = img.format
                            log_debug(f"이미지 열기 성공, 감지된 형식: {img_format}")
                            
                            if img_format:
                            # 명시적 형식 힌트가 있는 경우 사용
                            if format_hint:
                                final_format = format_hint.upper()
                                if final_format == "JPG":
                                    final_format = "JPEG"
                                adjusted_file_path = os.path.splitext(file_path)[0] + f".{format_hint}"
                                img.save(adjusted_file_path, format=final_format)
                                log_debug(f"이미지를 형식 힌트에 따라 저장: {final_format}, 경로: {adjusted_file_path}")
                            else:
                                # 이미지 확장자와 형식 일치시키기
                                format_ext = f".{img_format.lower()}"
                                if format_ext == ".jpeg":
                                    format_ext = ".jpg"
                                
                                current_ext = os.path.splitext(adjusted_file_path)[1].lower()
                                if current_ext != format_ext:
                                    adjusted_file_path = os.path.splitext(adjusted_file_path)[0] + format_ext
                                    log_debug(f"PIL에서 감지된 형식에 맞게 경로 조정: {adjusted_file_path}")
                                
                                # 올바른 형식으로 저장
                                img.save(adjusted_file_path, format=img_format)
                                log_debug(f"이미지를 감지된 형식({img_format})으로 저장: {adjusted_file_path}")
                            else:
                                # 형식이 감지되지 않은 경우
                                with open(adjusted_file_path, "wb") as f:
                                    f.write(image_bytes)
                                log_debug(f"PIL 형식 감지 실패, 원본 바이트로 저장: {adjusted_file_path}")
                        except Exception as img_error:
                            log_debug(f"이미지 처리 중 오류, 원본 바이트로 저장: {str(img_error)}")
                            # 이미지 처리 오류 시 원본 바이트 저장
                            with open(adjusted_file_path, "wb") as f:
                                f.write(image_bytes)
                        
                        # 파일이 실제로 저장되었는지 확인
                        if os.path.exists(adjusted_file_path):
                            log_debug(f"파일 저장 확인: {adjusted_file_path}, 크기: {os.path.getsize(adjusted_file_path)} 바이트")
                        else:
                            log_debug(f"파일이 생성되지 않음: {adjusted_file_path}")
                            raise Exception(f"파일이 생성되지 않았습니다: {adjusted_file_path}")
                            
                        # 파일 확장자 변경이 있었는지 확인하고 반환 경로 업데이트
                        return os.path.exists(adjusted_file_path), os.path.basename(adjusted_file_path)
                    except Exception as write_error:
                        log_debug(f"파일 쓰기 오류: {str(write_error)}")
                        raise Exception(f"파일 쓰기 오류: {str(write_error)}")
                except Exception as e:
                    log_debug(f"Base64 처리 중 오류: {str(e)}")
                    raise HTTPException(status_code=400, detail=f"유효하지 않은 Base64 데이터 또는 파일 쓰기 오류: {str(e)}")
            
            file_exists = os.path.exists(file_path)
            log_debug(f"이미지 저장 결과: {file_path} - {'성공' if file_exists else '실패'}")
            return file_exists, os.path.basename(file_path)
        
        # 이미지 파일 저장
        before_saved, before_actual_filename = save_image(before_image, before_path)
    # 명시적 형식 정보가 있는 경우 이를 힌트로 전달
    after_saved, after_actual_filename = save_image(after_image, after_path, format_hint=image_format)
        
        log_debug(f"이미지 저장 결과 - 전: {before_saved}({before_actual_filename}), 후: {after_saved}({after_actual_filename})")
        
        # 저장 여부 확인
        if not before_saved or not after_saved:
            log_debug("이미지 저장 실패 감지")
            raise HTTPException(status_code=500, detail="이미지 파일이 정상적으로 저장되지 않았습니다.")
        
        # 이미지 데이터 구성 (MongoDB에 저장하지 않고 응답으로만 반환)
        image_data = {
            "title": title,
        "description": description,
        "workflow_id": workflow_id,
        "tags": tags,
            "before_image_path": before_actual_filename,
            "after_image_path": after_actual_filename,
            "before_image_url": f"http://localhost:8000/images/{before_actual_filename}",
            "after_image_url": f"http://localhost:8000/images/{after_actual_filename}",
            "created_at": datetime.now().isoformat(),  # 문자열로 변환
        }
        
        # 성공 결과 구성
        result = {
            "status": "success", 
            "message": "이미지가 성공적으로 저장되었습니다.",
            "image_data": {
                "title": title,
                "before_url": image_data["before_image_url"],
                "after_url": image_data["after_image_url"],
            }
        }
        
        return result

@router.get("/images")
async def get_saved_images(limit: int = 20, skip: int = 0):
    """저장된 이미지 목록을 가져오는 API"""
    try:
        # lcnc_results에서 이미지 목록 조회
        cursor = lcnc_results.find({"before_image_path": {"$exists": True}, "after_image_path": {"$exists": True}}).sort("created_at", -1).skip(skip).limit(limit)
        
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
        # lcnc_results에서 이미지 정보 조회
        image = lcnc_results.find_one({"_id": ObjectId(image_id)})
        
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
        lcnc_results.delete_one({"_id": ObjectId(image_id)})
        
        return {"status": "success", "message": "이미지가 성공적으로 삭제되었습니다."}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"이미지 삭제 중 오류 발생: {str(e)}")

@router.post("/check-title")
async def check_title(data: Dict[str, Any] = Body(...)):
    """제목 중복 여부를 확인하는 API"""
    try:
        title = data.get("title", "")
        if not title:
            return {"status": "error", "message": "제목이 제공되지 않았습니다."}
        
        # 공백을 언더스코어로 변환
        sanitized_title = title.replace(" ", "_")
        
        # 중복 확인 - 파일 이름으로 확인
        existing_file = lcnc_results.find_one({"title": sanitized_title})
        
        # 워크플로우 이름으로도 확인 (워크플로우 저장 시 사용하는 필드)
        existing_workflow = lcnc_results.find_one({"workflow_name": title})
        
        if existing_file or existing_workflow:
            return {"status": "duplicate_name", "message": f"이미 사용 중인 이름입니다: {title}"}
        else:
            return {"status": "available", "message": f"사용 가능한 이름입니다: {title}"}
            
    except Exception as e:
        return {"status": "error", "message": f"제목 확인 중 오류 발생: {str(e)}"} 

@router.post("/upload-end-image")
async def upload_end_image(
    file: UploadFile = File(...),
    title: str = Form(...),
    description: str = Form(""),
    before_image: str = Form(""),
    workflow_id: str = Form(""),
    tags: str = Form("[]"),
    image_format: str = Form("png")
):
    """
    이미지 파일을 직접 업로드 받아 저장합니다 (Blob URL 전송에 사용)
    """
    try:
        log_debug(f"[upload-end-image] 요청 받음 - 제목: {title}, 파일명: {file.filename}, 형식: {image_format}")
        
        # 제목 준비 (없으면 생성)
        if not title or title.strip() == "":
            title = generate_unique_title()
        else:
            # 타이틀 정리 (공백은 언더스코어로 변환)
            title = title.strip().replace(" ", "_")
        
        # 파일 이름 생성
        image_storage_dir = IMAGE_STORE_PATH
        
        # 디렉토리 확인
        os.makedirs(image_storage_dir, exist_ok=True)
        
        # 파일 이름 추출
        filename = file.filename
        if not filename:
            # 기본 파일명 생성
            timestamp = int(time.time())
            filename = f"upload_{timestamp}.{image_format}"
        
        # 파일 확장자 확인/수정
        if '.' not in filename:
            filename = f"{filename}.{image_format}"
        elif filename.split('.')[-1].lower() not in ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']:
            # 확장자가 없거나 이미지 확장자가 아니면 지정된 형식으로 변경
            filename = f"{filename.split('.')[0]}.{image_format}"
        
        # 최종 저장 경로
        sanitized_title = sanitize_filename(title)
        file_path = os.path.join(image_storage_dir, f"{sanitized_title}_{filename}")
        
        # 파일 존재 확인 및 처리
        if os.path.exists(file_path):
            # 파일이 존재하면 타임스탬프 추가
            timestamp = int(time.time())
            base_name, ext = os.path.splitext(filename)
            file_path = os.path.join(image_storage_dir, f"{sanitized_title}_{base_name}_{timestamp}{ext}")
        
        # 파일 저장
        contents = await file.read()
        with open(file_path, "wb") as f:
            f.write(contents)
        
        # 상대 URL 생성
        relative_path = os.path.relpath(file_path, IMAGE_STORE_PATH).replace("\\", "/")
        file_url = f"/images/{relative_path}"
        
        # 태그 처리
        try:
            tag_list = json.loads(tags)
        except:
            tag_list = ["lcnc", "이미지 처리"]
        
        # before_image 처리 (URL인 경우)
        before_url = None
        if before_image and before_image.startswith(('http://', 'https://', '/')):
            before_url = before_image
        
        # 결과 반환
        result = {
            "status": "success", 
            "message": "이미지가 성공적으로 업로드되었습니다.",
            "image_data": {
                "title": title,
                "after_url": file_url
            }
        }
        
        # before_image 추가
        if before_url:
            result["image_data"]["before_url"] = before_url
        
        # 응답에 Access-Control-Allow-Origin 헤더 추가 (CORS 지원)
        return result
    except Exception as e:
        log_debug(f"[upload-end-image] 오류 발생: {str(e)}")
        return {"status": "error", "message": f"이미지 업로드 실패: {str(e)}"} 