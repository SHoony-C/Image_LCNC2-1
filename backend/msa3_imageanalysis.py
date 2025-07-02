from fastapi import APIRouter, HTTPException, UploadFile, File, Response
from typing import List, Dict, Any, Optional
import os
import shutil
from datetime import datetime
from fastapi.responses import FileResponse, JSONResponse
import json
import logging
import random
from PIL import Image
import io
import base64
import re  # 정규식 모듈 추가
import motor.motor_asyncio
import traceback
import uuid
from urllib.parse import unquote

router = APIRouter()

# MongoDB 연결 설정
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
mongodb_client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URL)
db = mongodb_client["image_app"]  # 데이터베이스 이름
workflow_collection = db["image_workflow"]  # 컬렉션 이름

ANALYSIS_DIR = "./analysis"
IMAGES_DIR = "./storage/images"  # 이미지 저장 디렉토리 추가
VECTORS_DIR = "./storage/vector"

# 디렉토리 생성
os.makedirs(ANALYSIS_DIR, exist_ok=True)
os.makedirs(IMAGES_DIR, exist_ok=True)
os.makedirs(VECTORS_DIR, exist_ok=True)

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

# 이미지 디렉토리 확인 엔드포인트 추가
@router.get("/check-images")
async def check_images():
    """이미지 디렉토리에 있는 모든 이미지 파일을 확인합니다."""
    try:
        if not os.path.exists(IMAGES_DIR):
            os.makedirs(IMAGES_DIR, exist_ok=True)
            return {
                "status": "warning",
                "message": f"이미지 디렉토리가 존재하지 않아 새로 생성했습니다: {IMAGES_DIR}",
                "images": []
            }
        
        images = []
        for filename in os.listdir(IMAGES_DIR):
            if filename.lower().endswith(('.jpg', '.jpeg', '.png', '.gif')):
                file_path = os.path.join(IMAGES_DIR, filename)
                images.append({
                    "filename": filename,
                    "path": file_path,
                    "size": os.path.getsize(file_path),
                    "created_time": os.path.getctime(file_path)
                })
        
        return {
            "status": "success",
            "message": f"{len(images)}개의 이미지 파일이 있습니다.",
            "images_dir": IMAGES_DIR,
            "images": images
        }
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"이미지 디렉토리 확인 중 오류 발생: {str(e)}\n{error_detail}")
        return {
            "status": "error",
            "message": f"이미지 디렉토리 확인 중 오류 발생: {str(e)}",
            "images_dir": IMAGES_DIR,
            "images": []
        }

# 이미지 조회 API 수정
@router.get("/images/{filename}")
async def get_image(filename: str):
    # URL 디코딩
    try:
        from urllib.parse import unquote
        decoded_filename = unquote(filename)
    except Exception as e:
        decoded_filename = filename
        
    print(f"이미지 요청: {decoded_filename}")
    print(f"이미지 경로: {IMAGES_DIR}")
    
    # 이미지 파일 경로
    image_path = os.path.join(IMAGES_DIR, decoded_filename)
    
    # 파일이 존재하는지 확인
    if os.path.exists(image_path):
        print(f"이미지 로드 성공: {decoded_filename} ({os.path.getsize(image_path)} bytes)")
        return FileResponse(image_path)
    else:
        # 파일을 찾을 수 없음
        error_msg = f"이미지를 찾을 수 없습니다: {decoded_filename}"
        print(error_msg)
        raise HTTPException(status_code=404, detail=error_msg)

# 유사 이미지 검색 API (임시 구현)
@router.get("/similar-images/{filename}")
async def find_similar_images(filename: str):
    try:
        # URL 디코딩
        from urllib.parse import unquote
        decoded_filename = unquote(filename)
        print(f"[DEBUG] 유사 이미지 검색 요청: {decoded_filename}")
        
        # 먼저 요청된 이미지가 디렉토리에 존재하는지 확인
        image_path = os.path.join(IMAGES_DIR, decoded_filename)
        image_exists = os.path.exists(image_path)
        
        print(f"[DEBUG] 이미지 경로: {image_path}, 존재여부: {image_exists}")
        
        # 이미지가 존재하지 않으면 404 반환
        if not image_exists:
            # 디렉토리 내 모든 파일 목록 가져오기
            print(f"[DEBUG] 이미지를 직접 찾을 수 없음. 디렉토리 탐색 시작: {IMAGES_DIR}")
            if os.path.exists(IMAGES_DIR):
                all_files = os.listdir(IMAGES_DIR)
                print(f"[DEBUG] 디렉토리 내 파일 수: {len(all_files)}")
                
                # 파일명 비교 - 대소문자 구분 없이, 확장자 구분 없이
                for file in all_files:
                    # 다양한 방식으로 파일명 비교
                    if file.lower() == decoded_filename.lower():
                        print(f"[DEBUG] 대소문자 무시하여 파일 찾음: {file}")
                        image_path = os.path.join(IMAGES_DIR, file)
                        image_exists = True
                        decoded_filename = file  # 찾은 실제 파일명으로 업데이트
                        break
                    
                    # 확장자 무시하고 비교
                    file_without_ext = os.path.splitext(file)[0]
                    decoded_without_ext = os.path.splitext(decoded_filename)[0]
                    if file_without_ext.lower() == decoded_without_ext.lower():
                        print(f"[DEBUG] 확장자 무시하여 파일 찾음: {file}")
                        image_path = os.path.join(IMAGES_DIR, file)
                        image_exists = True
                        decoded_filename = file  # 찾은 실제 파일명으로 업데이트
                        break
            
            # 여전히 파일을 찾지 못한 경우
            if not image_exists:
                error_msg = f"이미지를 찾을 수 없습니다: {decoded_filename}"
                print(f"[ERROR] {error_msg}")
                raise HTTPException(status_code=404, detail=error_msg)
        
        # 벡터 파일 확인 - 오직 processed_ 파일만 사용
        processed_vectors_path = os.path.join(VECTORS_DIR, "processed_vectors.json")
        processed_metadata_path = os.path.join(VECTORS_DIR, "processed_metadata.json")
        tags_path = os.path.join(VECTORS_DIR, "tags.json")
        
        print(f"[DEBUG] 벡터 파일 경로: {processed_vectors_path}")
        print(f"[DEBUG] 메타데이터 파일 경로: {processed_metadata_path}")
        
        # 파일 존재 여부 확인
        vectors_exists = os.path.exists(processed_vectors_path)
        metadata_exists = os.path.exists(processed_metadata_path)
        tags_exists = os.path.exists(tags_path)
        
        print(f"[DEBUG] 벡터 파일 존재: {vectors_exists}")
        print(f"[DEBUG] 메타데이터 파일 존재: {metadata_exists}")
        print(f"[DEBUG] 태그 파일 존재: {tags_exists}")
        
        # 데이터 로드 (processed_ 파일만 사용)
        vectors = []
        metadata = []
        tags = []
        
        # processed_vectors.json과 processed_metadata.json 파일 로드
        if os.path.exists(processed_vectors_path) and os.path.exists(processed_metadata_path):
            try:
                with open(processed_vectors_path, 'r', encoding='utf-8') as f:
                    vectors = json.load(f)
                with open(processed_metadata_path, 'r', encoding='utf-8') as f:
                    metadata = json.load(f)
                print(f"[DEBUG] Loaded processed vectors: {len(vectors)}, metadata: {len(metadata)}")
                print(f"[DEBUG] 첫 번째 벡터 샘플: {vectors[0] if vectors else 'None'}")
                
                # 메타데이터 값이 배열인지 딕셔너리인지 확인
                if metadata:
                    metadata_type = type(metadata[0]) if isinstance(metadata, list) and metadata else type(metadata)
                    print(f"[DEBUG] 메타데이터 타입: {metadata_type}")
                    
                    # 메타데이터 샘플 출력
                    for i, name in enumerate(metadata[:5]):
                        print(f"[DEBUG] 메타데이터 샘플 {i}: '{name}'")
                
                # tags.json 파일이 있으면 로드
                if os.path.exists(tags_path):
                    try:
                        with open(tags_path, 'r', encoding='utf-8') as f:
                            tags = json.load(f)
                        print(f"[DEBUG] Loaded tags: {len(tags)}")
                    except Exception as e:
                        print(f"[ERROR] Error loading tags.json: {str(e)}")
            except Exception as e:
                print(f"[ERROR] Error loading processed vector files: {str(e)}")
                # 파일 내용의 일부를 읽어서 확인
                try:
                    with open(processed_vectors_path, 'r', encoding='utf-8') as f:
                        first_chars = f.read(100)
                    print(f"[DEBUG] 벡터 파일 내용 시작 부분: {first_chars}")
                except Exception as inner_e:
                    print(f"[ERROR] 벡터 파일 읽기 실패: {str(inner_e)}")
        
        # 유사도 계산 함수 정의 (먼저 선언)
        def calculate_distance(vec1, vec2):
            # 유클리드 거리 계산 (3D 벡터인 경우)
            if len(vec1) == 3 and len(vec2) == 3:
                return sum([(a - b) ** 2 for a, b in zip(vec1, vec2)]) ** 0.5
            
            # 코사인 유사도 계산 (고차원 벡터인 경우)
            dot_product = sum([a * b for a, b in zip(vec1, vec2)])
            norm_a = sum([a ** 2 for a in vec1]) ** 0.5
            norm_b = sum([b ** 2 for b in vec2]) ** 0.5
            
            # 0으로 나누기 방지
            if norm_a == 0 or norm_b == 0:
                return 0
                
            similarity = dot_product / (norm_a * norm_b)
            # 거리로 변환 (1 - 유사도)
            return 1 - similarity
        
        # 벡터 데이터 또는 메타데이터가 없는 경우: 디렉토리에서 랜덤 이미지 반환
        if not vectors or not metadata or len(vectors) != len(metadata):
            print(f"[WARN] 벡터 데이터 없음 또는 불일치: vectors={len(vectors)}, metadata={len(metadata)}")
            print("[DEBUG] 벡터 데이터 없음, 디렉토리에서 랜덤 이미지 선택")
            return get_random_similar_images(decoded_filename)
        
        # 요청된 이미지의 인덱스 찾기
        file_index = -1
        
        # 디버깅을 위해 모든 메타데이터 출력
        metadata_sample = metadata[:5] if len(metadata) > 5 else metadata
        print(f"[DEBUG] 메타데이터 파일명 샘플(처음 5개): {metadata_sample}")
        
        # 디렉토리의 실제 파일 목록 가져오기 (한글 파일명 비교를 위해)
        actual_files = []
        if os.path.exists(IMAGES_DIR):
            actual_files = os.listdir(IMAGES_DIR)
            print(f"[DEBUG] 실제 디렉토리 파일 샘플: {actual_files[:5]}")
        
        # 메타데이터의 파일명과 요청된 파일명 비교 (다양한 방식으로)
        for i, name in enumerate(metadata):
            # 타임스탬프를 제외하고 비교
            clean_name = re.sub(r'^\d{8}_\d{6}_', '', name) if isinstance(name, str) else name
            clean_filename = re.sub(r'^\d{8}_\d{6}_', '', decoded_filename)
            
            # 디버깅용
            if i < 5:
                print(f"[DEBUG] 비교 ({i}): '{name}' vs '{decoded_filename}', 정규화: '{clean_name}' vs '{clean_filename}'")
            
            # 1. 정확한 파일명 또는 정규화된 파일명 비교
            if name == decoded_filename or clean_name == clean_filename:
                file_index = i
                print(f"[DEBUG] 일치하는 파일명 찾음: {name}, 인덱스: {i}")
                break
            
            # 2. 확장자를 제외한 파일명 비교
            name_without_ext = os.path.splitext(name)[0] if isinstance(name, str) else name
            filename_without_ext = os.path.splitext(decoded_filename)[0]
            if name_without_ext == filename_without_ext:
                file_index = i
                print(f"[DEBUG] 확장자 제외 일치: {name_without_ext}, 인덱스: {i}")
                break
            
            # 3. 대소문자 구분 없이 비교
            if name.lower() == decoded_filename.lower():
                file_index = i
                print(f"[DEBUG] 대소문자 무시 일치: {name}, 인덱스: {i}")
                break
            
            # 4. 확장자 무시 + 대소문자 무시 비교
            if name_without_ext.lower() == filename_without_ext.lower():
                file_index = i
                print(f"[DEBUG] 확장자+대소문자 무시 일치: {name_without_ext}, 인덱스: {i}")
                break
            
            # 5. 파일 이름에 한글이 포함된 경우 추가 처리
            if any(c > '\u007F' for c in name) or any(c > '\u007F' for c in decoded_filename):
                print(f"[DEBUG] 한글 포함 파일명 비교: '{name}' vs '{decoded_filename}'")
                
                # 실제 디렉토리에서 파일 찾기
                for actual_file in actual_files:
                    if actual_file == decoded_filename:
                        # 실제 파일이 디렉토리에 있고, 현재 처리 중인 메타데이터 항목과 확장자가 동일하면 매칭
                        if os.path.splitext(actual_file)[1] == os.path.splitext(name)[1]:
                            file_index = i
                            print(f"[DEBUG] 실제 파일과 메타데이터 확장자 일치: {actual_file}, 인덱스: {i}")
                            break
        
        # 이미지를 찾지 못했을 경우 - 벡터에는 없지만 디렉토리에 있는 경우
        if file_index == -1 and image_exists:
            print(f"[WARN] 벡터 데이터에서 이미지를 찾지 못했지만 디렉토리에 존재함: {decoded_filename}")
            # 디렉토리에 있는 다른 모든 이미지를 랜덤으로 가져옴
            return get_random_similar_images(decoded_filename)
        
        # 이미지를 찾지 못했고 디렉토리에도 없는 경우
        if file_index == -1:
            error_msg = f"요청한 이미지를 벡터 데이터에서 찾을 수 없습니다: {decoded_filename}"
            print(f"[ERROR] {error_msg}")
            return {
                "status": "error",
                "message": error_msg,
                "filename": decoded_filename
            }
        
        # 현재 이미지의 벡터
        current_vector = vectors[file_index]
        print(f"[DEBUG] 현재 이미지 벡터 ({file_index}): {current_vector[:3]}... (길이: {len(current_vector)})")
        
        # 모든 이미지와의 거리 계산
        distances = []
        for i, vector in enumerate(vectors):
            if i != file_index:  # 자기 자신 제외
                try:
                    dist = calculate_distance(current_vector, vector)
                    # 파일명으로 태그 구분 - _before가 포함된 파일은 I-app 태그로, 그 외는 Analysis 태그로 간주
                    is_iapp = "_before" in metadata[i] if isinstance(metadata[i], str) else False
                    tag_type = "I-app" if is_iapp else "Analysis"
                    
                    distances.append({
                        "index": i,
                        "filename": metadata[i],
                        "distance": dist,
                        "tag_type": tag_type
                    })
                    if i < 3:  # 처음 몇 개만 로그 출력
                        print(f"[DEBUG] 거리 계산 ({i}): filename={metadata[i]}, distance={dist}, tag={tag_type}")
                except Exception as calc_error:
                    print(f"[ERROR] 거리 계산 중 오류 ({i}): {str(calc_error)}")
                    print(f"[DEBUG] 현재 벡터: {current_vector[:3]}..., 비교 벡터: {vector[:3]}...")
        
        # 거리 기준 정렬 (가까운 순)
        distances.sort(key=lambda x: x["distance"])
        print(f"[DEBUG] 계산된 거리 수: {len(distances)}")
        
        # 태그별로 분류
        iapp_images = [item for item in distances if item["tag_type"] == "I-app"]
        analysis_images = [item for item in distances if item["tag_type"] == "Analysis"]
        
        print(f"[DEBUG] I-app 태그 이미지 수: {len(iapp_images)}")
        print(f"[DEBUG] Analysis 태그 이미지 수: {len(analysis_images)}")
        
        # 각 태그별로 상위 3개씩 선택
        iapp_selected = iapp_images[:3]
        analysis_selected = analysis_images[:3]
        
        # 결과 병합
        similar_images = []
        
        # I-app 태그 이미지 추가
        for i, item in enumerate(iapp_selected):
            similarity = max(0, 1 - item["distance"]) * 100  # 거리를 유사도로 변환 (퍼센트)
            similar_images.append({
                "filename": item["filename"],
                "similarity": similarity,
                "distance": item["distance"],
                "index": item["index"],
                "tag_type": "I-app"
            })
            print(f"[DEBUG] I-app 유사 이미지 ({i}): {item['filename']}, 유사도: {similarity:.2f}%")
        
        # Analysis 태그 이미지 추가
        for i, item in enumerate(analysis_selected):
            similarity = max(0, 1 - item["distance"]) * 100  # 거리를 유사도로 변환 (퍼센트)
            similar_images.append({
                "filename": item["filename"],
                "similarity": similarity,
                "distance": item["distance"],
                "index": item["index"],
                "tag_type": "Analysis"
            })
            print(f"[DEBUG] Analysis 유사 이미지 ({i}): {item['filename']}, 유사도: {similarity:.2f}%")
        
        print(f"[DEBUG] 유사 이미지 계산 완료: {len(similar_images)}개 찾음 (I-app: {len(iapp_selected)}, Analysis: {len(analysis_selected)})")
        return {
            "status": "success",
            "filename": decoded_filename,
            "similar_images": similar_images
        }
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"[ERROR] Error finding similar images: {str(e)}\n{error_detail}")
        return {
            "status": "error",
            "message": f"유사 이미지 검색 중 오류 발생: {str(e)}",
            "filename": filename
        }

# 랜덤 유사 이미지 가져오는 유틸리티 함수
def get_random_similar_images(filename):
    """디렉토리에서 랜덤으로 유사 이미지를 선택합니다."""
    print(f"[DEBUG] 랜덤 이미지 선택 시작: {filename}")
    if os.path.exists(IMAGES_DIR):
        # 이미지 파일 필터링 및 태그별로 분류
        all_image_files = [f for f in os.listdir(IMAGES_DIR) 
                      if f.lower().endswith(('.jpg', '.jpeg', '.png', '.gif')) 
                      and f != filename]
        
        # 태그별로 이미지 분류
        iapp_images = [f for f in all_image_files if "_before" in f]
        analysis_images = [f for f in all_image_files if "_before" not in f]
        
        print(f"[DEBUG] 발견된 이미지 파일: {len(all_image_files)} (I-app: {len(iapp_images)}, Analysis: {len(analysis_images)})")
        
        similar_images = []
        
        # I-app 태그 이미지 선택 (최대 3개)
        if iapp_images:
            iapp_sample_size = min(3, len(iapp_images))
            iapp_selected = random.sample(iapp_images, iapp_sample_size)
            
            print(f"[DEBUG] 선택된 I-app 랜덤 이미지: {iapp_selected}")
            
            for img in iapp_selected:
                # 랜덤 유사도 생성 (50-90%)
                similarity = random.uniform(50, 90)
                similar_images.append({
                    "filename": img,
                    "similarity": similarity,
                    "random_selected": True,
                    "tag_type": "I-app"
                })
        
        # Analysis 태그 이미지 선택 (최대 3개)
        if analysis_images:
            analysis_sample_size = min(3, len(analysis_images))
            analysis_selected = random.sample(analysis_images, analysis_sample_size)
            
            print(f"[DEBUG] 선택된 Analysis 랜덤 이미지: {analysis_selected}")
            
            for img in analysis_selected:
                # 랜덤 유사도 생성 (50-90%)
                similarity = random.uniform(50, 90)
                similar_images.append({
                    "filename": img,
                    "similarity": similarity,
                    "random_selected": True,
                    "tag_type": "Analysis"
                })
        
        if similar_images:
            return {
                "status": "partial_success",
                "message": "벡터 데이터에 없어 랜덤 이미지를 반환합니다",
                "filename": filename,
                "similar_images": similar_images
            }
    
    print(f"[WARN] 디렉토리에 이미지 없음: {IMAGES_DIR}")
    return {
        "status": "error",
        "message": "벡터 데이터를 찾을 수 없고 대체 이미지도 없습니다.",
        "filename": filename
    }

# 벡터 파일 목록 제공 API
@router.get("/vectors-info")
async def get_vectors_info():
    try:
        # 확인할 파일 목록 (processed_ 파일과 tags 파일만 확인)
        file_paths = {
            "processed_vectors": os.path.join(VECTORS_DIR, "processed_vectors.json"),
            "processed_metadata": os.path.join(VECTORS_DIR, "processed_metadata.json"),
            "tags": os.path.join(VECTORS_DIR, "tags.json")
        }
        
        # 각 파일의 존재 여부와 크기 확인
        file_info = {}
        for name, path in file_paths.items():
            exists = os.path.exists(path)
            size = os.path.getsize(path) if exists else 0
            file_info[name] = {
                "exists": exists,
                "path": path,
                "size": size,
                "size_formatted": f"{size/1024:.2f} KB" if exists else "0 KB"
            }
            
        # 벡터 디렉토리 내 모든 파일 목록 추가
        all_files = []
        if os.path.exists(VECTORS_DIR):
            all_files = [f for f in os.listdir(VECTORS_DIR) if os.path.isfile(os.path.join(VECTORS_DIR, f))]
        
        return {
            "status": "success",
            "vector_dir": VECTORS_DIR,
            "files": file_info,
            "all_vector_files": all_files
        }
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"Error in get_vectors_info: {str(e)}\n{error_detail}")
        raise HTTPException(status_code=500, detail=str(e))

# 벡터 초기화 API 추가
@router.post("/initialize-vectors")
async def initialize_vectors():
    """이미지 디렉토리에 있는 모든 이미지를 스캔하여 기본 벡터 데이터를 생성합니다."""
    try:
        if not os.path.exists(IMAGES_DIR):
            return {
                "status": "error",
                "message": "이미지 디렉토리가 존재하지 않습니다"
            }
        
        # 이미지 디렉토리에서 모든 이미지 파일 수집
        image_files = []
        for filename in os.listdir(IMAGES_DIR):
            if filename.lower().endswith(('.jpg', '.jpeg', '.png', '.gif')):
                image_files.append(filename)
        
        if not image_files:
            return {
                "status": "error",
                "message": "이미지 디렉토리에 이미지 파일이 없습니다"
            }
        
        print(f"총 {len(image_files)}개 이미지 파일 발견")
        
        # 더미 벡터 생성 (3차원)
        vectors = []
        for _ in range(len(image_files)):
            # 3차원 랜덤 벡터 (0~1 사이 값)
            vector = [random.random() for _ in range(3)]
            vectors.append(vector)
        
        # 벡터 파일 저장 경로 (오직 processed_ 파일만 사용)
        processed_vectors_path = os.path.join(VECTORS_DIR, "processed_vectors.json")
        processed_metadata_path = os.path.join(VECTORS_DIR, "processed_metadata.json")
        tags_path = os.path.join(VECTORS_DIR, "tags.json")
        
        # 디렉토리 확인
        os.makedirs(VECTORS_DIR, exist_ok=True)
        
        # 벡터 데이터 저장 (processed_ 파일만 생성)
        with open(processed_vectors_path, 'w', encoding='utf-8') as f:
            json.dump(vectors, f, ensure_ascii=False, indent=2)
        
        with open(processed_metadata_path, 'w', encoding='utf-8') as f:
            json.dump(image_files, f, ensure_ascii=False, indent=2)
        
        # 빈 태그 생성
        empty_tags = [[] for _ in range(len(image_files))]
        with open(tags_path, 'w', encoding='utf-8') as f:
            json.dump(empty_tags, f, ensure_ascii=False, indent=2)
        
        return {
            "status": "success",
            "message": f"{len(image_files)}개 이미지에 대한 기본 벡터 데이터가 생성되었습니다",
            "vectors_count": len(vectors),
            "files": image_files[:10] + (["..."] if len(image_files) > 10 else [])
        }
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"Error initializing vectors: {str(e)}\n{error_detail}")
        return {
            "status": "error",
            "message": f"벡터 초기화 중 오류 발생: {str(e)}"
        }

# 워크플로우 데이터 조회 API 추가
@router.get("/workflow/by-image/{image_filename}")
async def get_workflow_by_image(image_filename: str):
    try:
        print("\n\n======== WORKFLOW API ENDPOINT START ========")
        print(f"Original image filename (encoded): {image_filename}")
        
        # 세션 고유 ID 생성 (로그 추적용)
        session_id = str(uuid.uuid4())[:8]
        print(f"Session ID: {session_id}")
        
        # MongoDB 연결 상태 확인 
        print(f"[{session_id}] 1. MongoDB 연결 상태 확인 중...")
        try:
            # ping 테스트
            ping_result = await db.command({"ping": 1})
            if ping_result.get("ok") == 1:
                print(f"[{session_id}] ✅ MongoDB 연결 성공: {ping_result}")
            else:
                print(f"[{session_id}] ❌ MongoDB 연결 실패: {ping_result}")
        except Exception as ping_error:
            print(f"[{session_id}] ❌ MongoDB 연결 오류: {str(ping_error)}")
            print(traceback.format_exc())
        
        # URL 디코딩 시도
        try:
            decoded_filename = unquote(image_filename)
            print(f"[{session_id}] Decoded filename: {decoded_filename}")
            # 원본과 디코딩된 결과가 다른 경우 확인
            if decoded_filename != image_filename:
                print(f"[{session_id}] URL was encoded. Original: {image_filename}, Decoded: {decoded_filename}")
                # 디코딩된 이름을 사용
                image_filename = decoded_filename
        except Exception as decode_error:
            print(f"[{session_id}] Error decoding URL: {str(decode_error)}")
        
        print(f"[{session_id}] API endpoint route: /api/workflow/by-image/{image_filename}")
        print(f"[{session_id}] Request time: {datetime.now().isoformat()}")
        
        # 원본 파일명 바이트로 출력 (인코딩 문제 디버깅용)
        print(f"[{session_id}] Filename as bytes: {image_filename.encode('utf-8')}")
        
        # Remove "_before" suffix and file extensions from the filename for MongoDB search
        import re
        search_filename = image_filename
        original_search_filename = search_filename
        # First remove _before suffix if present
        search_filename = search_filename.replace("_before", "")
        if original_search_filename != search_filename:
            print(f"[{session_id}] Removed '_before' suffix: {search_filename}")
        
        # Then remove any file extension (.png, .jpg, etc.) if present
        original_search_filename = search_filename
        search_filename = re.sub(r'\.(png|jpg|jpeg|gif|bmp|tiff|webp)$', '', search_filename, flags=re.IGNORECASE)
        if original_search_filename != search_filename:
            print(f"[{session_id}] Removed file extension: {search_filename}")
        
        print(f"[{session_id}] Final search filename: {search_filename}")
        print(f"[{session_id}] 2. 데이터베이스 및 컬렉션 정보:")
        
        # MongoDB 연결 정보 출력
        print(f"[{session_id}] MongoDB connection: {MONGODB_URL}")
        print(f"[{session_id}] MongoDB database name: {db.name}")
        print(f"[{session_id}] MongoDB collection name: {workflow_collection.name}")
        
        # 컬렉션 존재 확인
        print(f"[{session_id}] 3. 컬렉션 존재 확인 중...")
        try:
            # Additional debugging - show all collections
            collections = await db.list_collection_names()
            print(f"[{session_id}] Available collections in database: {', '.join(collections)}")
            
            # 컬렉션 존재 여부 확인
            if workflow_collection.name in collections:
                print(f"[{session_id}] ✅ 컬렉션 '{workflow_collection.name}' 존재함")
            else:
                print(f"[{session_id}] ❌ 컬렉션 '{workflow_collection.name}' 존재하지 않음")
                return JSONResponse(
                    status_code=500,
                    content={
                        "error": f"Collection '{workflow_collection.name}' does not exist",
                        "timestamp": datetime.now().isoformat()
                    }
                )
        except Exception as coll_error:
            print(f"[{session_id}] ❌ 컬렉션 확인 오류: {str(coll_error)}")
            print(traceback.format_exc())
        
        # 컬렉션 문서 수 확인
        try:
            print(f"[{session_id}] 4. 컬렉션 문서 수 확인 중...")
            doc_count = await workflow_collection.count_documents({})
            print(f"[{session_id}] Total documents in collection: {doc_count}")
            
            if doc_count == 0:
                print(f"[{session_id}] ⚠️ 컬렉션에 문서가 없음")
            else:
                print(f"[{session_id}] ✅ 컬렉션에 {doc_count}개 문서 존재")
        except Exception as count_error:
            print(f"[{session_id}] ❌ 문서 수 확인 오류: {str(count_error)}")
        
        # Query MongoDB for the workflow data
        workflow_data = None
        
        print(f"[{session_id}] 5. 워크플로우 검색 시작...")
        try:
            # Try to find the workflow by workflow_name field matching the search_filename
            exact_query = {"workflow_name": search_filename}
            print(f"[{session_id}] 5.1. 정확한 일치 검색: db.{workflow_collection.name}.findOne({exact_query})")
            
            # 검색 시작 시간
            search_start = datetime.now()
            workflow_data = await workflow_collection.find_one(exact_query)
            search_duration = (datetime.now() - search_start).total_seconds()
            print(f"[{session_id}] 검색 소요 시간: {search_duration:.4f}초")
            
            # Print query result
            if workflow_data:
                print(f"[{session_id}] ✅ 정확한 일치 검색 성공: _id={workflow_data.get('_id')}")
                print(f"[{session_id}] 문서 필드: {list(workflow_data.keys())}")
                print(f"[{session_id}] workflow_name: {workflow_data.get('workflow_name', 'N/A')}")
            else:
                print(f"[{session_id}] ❌ 정확한 일치 검색 실패")
                
                # 모든 워크플로우 이름 조회 (디버깅용)
                print(f"[{session_id}] 5.2. 전체 워크플로우 이름 목록 조회 중...")
                try:
                    cursor = workflow_collection.find({}, {"workflow_name": 1})
                    workflow_names = []
                    async for doc in cursor:
                        if "workflow_name" in doc:
                            workflow_names.append(doc["workflow_name"])
                    
                    print(f"[{session_id}] 전체 워크플로우 이름 목록 ({len(workflow_names)}개): {workflow_names}")
                    
                    # 검색 키워드와 유사한 워크플로우 찾기
                    similar_names = []
                    for name in workflow_names:
                        if name and search_filename and (
                            search_filename in name or 
                            name in search_filename or
                            (len(name) > 2 and len(search_filename) > 2 and 
                             name[:2] == search_filename[:2])
                        ):
                            similar_names.append(name)
                    
                    if similar_names:
                        print(f"[{session_id}] 유사한 워크플로우 이름: {similar_names}")
                    else:
                        print(f"[{session_id}] 유사한 워크플로우 이름 없음")
                except Exception as list_error:
                    print(f"[{session_id}] ❌ 워크플로우 이름 목록 조회 오류: {str(list_error)}")
                
                # Try case-insensitive search
                print(f"[{session_id}] 5.3. 대소문자 무시 검색 시작...")
                try:
                    case_insensitive_query = {"workflow_name": {"$regex": f"^{re.escape(search_filename)}$", "$options": "i"}}
                    print(f"[{session_id}] 쿼리: {case_insensitive_query}")
                    cursor = workflow_collection.find(case_insensitive_query)
                    
                    docs_found = 0
                    async for doc in cursor:
                        docs_found += 1
                        workflow_data = doc
                        print(f"[{session_id}] ✅ 대소문자 무시 검색 성공: {doc.get('workflow_name')}")
                        break
                    
                    if docs_found == 0:
                        print(f"[{session_id}] ❌ 대소문자 무시 검색 실패")
                except Exception as case_error:
                    print(f"[{session_id}] ❌ 대소문자 무시 검색 오류: {str(case_error)}")
                
                # Try partial match on workflow_name
                if not workflow_data:
                    print(f"[{session_id}] 5.4. 부분 일치 검색 시작...")
                    try:
                        partial_query = {"workflow_name": {"$regex": search_filename, "$options": "i"}}
                        print(f"[{session_id}] 쿼리: {partial_query}")
                        cursor = workflow_collection.find(partial_query)
                        
                        docs_found = 0
                        async for doc in cursor:
                            docs_found += 1
                            if docs_found == 1:  # Use first match
                                workflow_data = doc
                                print(f"[{session_id}] ✅ 부분 일치 검색 성공: {doc.get('workflow_name')}")
                        
                        if docs_found == 0:
                            print(f"[{session_id}] ❌ 부분 일치 검색 실패")
                    except Exception as partial_error:
                        print(f"[{session_id}] ❌ 부분 일치 검색 오류: {str(partial_error)}")
                
                # Try direct collection access
                if not workflow_data:
                    print(f"[{session_id}] 5.5. 직접 컬렉션 접근 테스트...")
                    try:
                        # 아무 문서나 하나 가져오기
                        any_doc = await workflow_collection.find_one({})
                        if any_doc:
                            print(f"[{session_id}] ✅ 컬렉션 접근 성공: _id={any_doc.get('_id')}")
                            print(f"[{session_id}] 문서 필드: {list(any_doc.keys())}")
                        else:
                            print(f"[{session_id}] ❌ 컬렉션 접근 실패: 문서가 없음")
                    except Exception as access_error:
                        print(f"[{session_id}] ❌ 컬렉션 접근 오류: {str(access_error)}")
        except Exception as db_error:
            print(f"[{session_id}] ❌ 워크플로우 검색 오류: {str(db_error)}")
            print(traceback.format_exc())
        
        # If workflow data found, return it
        print(f"[{session_id}] 6. 검색 결과 처리 중...")
        if workflow_data:
            print(f"[{session_id}] ✅ 워크플로우 데이터 찾음")
            # MongoDB returns _id as ObjectId which is not JSON serializable
            if "_id" in workflow_data:
                workflow_data["_id"] = str(workflow_data["_id"])
                
            print(f"[{session_id}] 워크플로우 데이터 키: {workflow_data.keys()}")
            print(f"[{session_id}] 워크플로우 이름: {workflow_data.get('workflow_name', 'N/A')}")
            
            response_data = {
                "workflow": workflow_data,
                "timestamp": datetime.now().isoformat(),
                "search_criteria": {
                    "original_filename": image_filename,
                    "processed_filename": search_filename
                }
            }
            print(f"[{session_id}] ✅ 워크플로우 데이터 반환 완료")
            print(f"[{session_id}] ======== WORKFLOW API ENDPOINT END ========\n")
            return JSONResponse(
                status_code=200,
                content=response_data
            )
        
        # No data found, return 404 error
        print(f"[{session_id}] ❌ 워크플로우 데이터 찾지 못함")
        print(f"[{session_id}] All search attempts exhausted, returning 404 error")
        print(f"[{session_id}] ======== WORKFLOW API ENDPOINT END WITH ERROR ========\n")
        return JSONResponse(
            status_code=404,
            content={
                "error": f"Workflow not found for {search_filename}", 
                "timestamp": datetime.now().isoformat(),
                "search_criteria": {
                    "original_filename": image_filename,
                    "processed_filename": search_filename,
                    "all_attempts_failed": True
                }
            }
        )
    except Exception as e:
        print(f"Error in get_workflow_by_image: {str(e)}")
        print(f"Full error details:")
        print(traceback.format_exc())
        print("======== WORKFLOW API ENDPOINT END WITH ERROR ========\n")
        return JSONResponse(
            status_code=500,
            content={
                "error": f"Failed to fetch workflow data: {str(e)}",
                "timestamp": datetime.now().isoformat(),
                "stack_trace": traceback.format_exc()
            }
        )

# "ㅁㅁㅁ" 한글 워크플로우 생성 API
@router.get("/workflow/create-mmm-test")
async def create_mmm_workflow_test():
    try:
        print("\n\n======== CREATING MMM WORKFLOW TEST DATA ========")
        
        # 한글 파일명 테스트 (ㅁㅁㅁ)
        workflow_name = "ㅁㅁㅁ"
        print(f"Creating workflow with Korean name: {workflow_name}")
        print(f"Name as bytes: {workflow_name.encode('utf-8')}")
        
        # 현재 시간 저장
        current_time = datetime.now().isoformat()
        
        # 워크플로우 데이터 생성
        test_workflow = {
            "workflow_name": workflow_name,
            "description": "테스트 워크플로우 (ㅁㅁㅁ)",
            "created_at": current_time,
            "elements": [
                {
                    "id": "element-1",
                    "type": "input",
                    "label": "입력 이미지"
                },
                {
                    "id": "element-2", 
                    "type": "process",
                    "label": "이미지 처리"
                },
                {
                    "id": "element-3",
                    "type": "output",
                    "label": "출력 결과"
                }
            ],
            "nodes": [
                {
                    "id": "node-1",
                    "type": "input",
                    "label": "입력 이미지",
                    "position": {"x": 100, "y": 100}
                },
                {
                    "id": "node-2",
                    "type": "process",
                    "label": "이미지 처리",
                    "position": {"x": 300, "y": 100}
                }
            ],
            "input_image_filename": f"{workflow_name}_before.png",
            "output_image_filename": f"{workflow_name}_after.png",
            "test_field": "테스트 필드 값"
        }
        
        # 기존 워크플로우 검색
        existing = await workflow_collection.find_one({"workflow_name": workflow_name})
        
        if existing:
            # 이미 존재하는 경우 업데이트
            print(f"Workflow with name '{workflow_name}' already exists, updating...")
            result = await workflow_collection.replace_one(
                {"workflow_name": workflow_name}, 
                test_workflow
            )
            
            success = result.modified_count > 0
            print(f"Update result: modified_count={result.modified_count}")
            
            if success:
                print(f"Workflow updated successfully")
                test_workflow["_id"] = str(existing["_id"])
            else:
                print(f"No changes made to existing workflow")
                test_workflow = existing
                if "_id" in test_workflow:
                    test_workflow["_id"] = str(test_workflow["_id"])
        else:
            # 새 워크플로우 삽입
            print(f"Creating new workflow with name '{workflow_name}'")
            result = await workflow_collection.insert_one(test_workflow)
            inserted_id = result.inserted_id
            print(f"Workflow inserted with ID: {inserted_id}")
            test_workflow["_id"] = str(inserted_id)
        
        # 실제로 데이터베이스에 저장되었는지 확인
        verification = await workflow_collection.find_one({"workflow_name": workflow_name})
        verification_status = "성공" if verification else "실패"
        
        if verification:
            print(f"Verification successful: found workflow with _id={verification['_id']}")
            if "_id" in verification:
                verification["_id"] = str(verification["_id"])
        else:
            print(f"Verification failed: could not find workflow named '{workflow_name}'")
        
        print("======== MMM WORKFLOW CREATION COMPLETE ========\n")
        
        return JSONResponse(
            status_code=200,
            content={
                "message": f"MMM 워크플로우 생성 {verification_status}",
                "workflow": test_workflow,
                "verification": verification is not None,
                "verification_data": verification if verification else None,
                "timestamp": datetime.now().isoformat()
            }
        )
    except Exception as e:
        print(f"Error creating MMM workflow: {str(e)}")
        print(traceback.format_exc())
        print("======== MMM WORKFLOW CREATION FAILED ========\n")
        
        return JSONResponse(
            status_code=500,
            content={
                "error": f"Failed to create MMM workflow: {str(e)}",
                "stack_trace": traceback.format_exc(),
                "timestamp": datetime.now().isoformat()
            }
        ) 