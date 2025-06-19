from fastapi import APIRouter, HTTPException, UploadFile, File, Query, Body, Response
from typing import List, Dict, Any, Optional
import os
import shutil
from datetime import datetime
import numpy as np
from PIL import Image
import json
from pathlib import Path
import torch
from torchvision import transforms
from torchvision.models import resnet50, ResNet50_Weights
import sys

# Try to import UMAP but handle case when it's not available
UMAP_AVAILABLE = False
try:
    import umap
    import umap.umap_ as umap
    UMAP_AVAILABLE = True
    print("UMAP successfully imported")
except ImportError:
    print("UMAP not available, using fallback dimensionality reduction method")

# Import msa4_imagestorage's load_local_images function
from msa4_LLM import load_local_images as msa4_load_local_images

router = APIRouter()

# 스토리지 경로 설정
STORAGE_DIR = "./storage"
VECTORS_DIR = os.path.join(STORAGE_DIR, "vector")
IMAGES_DIR = os.path.join(STORAGE_DIR, "images")  # 이미지 저장 디렉토리 추가
os.makedirs(STORAGE_DIR, exist_ok=True)
os.makedirs(VECTORS_DIR, exist_ok=True)
os.makedirs(IMAGES_DIR, exist_ok=True)  # 이미지 저장 디렉토리 생성

# ResNet50 모델 로드 (전역 변수로 초기화)
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = resnet50(weights=ResNet50_Weights.IMAGENET1K_V2).to(device)
model.eval()

# 벡터 추출을 위한 특징 추출기 정의
class FeatureExtractor:
    def __init__(self, model):
        self.model = model
        self.features = []
        self.hook_registered = False
        
    def get_features(self, input_tensor):
        self.features = []
        
        # 훅 등록이 안 되어있으면 등록
        if not self.hook_registered:
            def hook(module, input, output):
                self.features.append(output.cpu().detach())
            
            # ResNet의 avgpool 레이어에 훅 등록
            self.model.avgpool.register_forward_hook(hook)
            self.hook_registered = True
        
        # 모델 추론
        with torch.no_grad():
            self.model(input_tensor)
        
        # 추출된 특징 반환
        return self.features[0].squeeze()

# 특징 추출기 초기화
feature_extractor = FeatureExtractor(model)

# 이미지 전처리 함수
def preprocess_image(image_path):
    transform = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])
    
    img = None
    try:
        img = Image.open(image_path).convert('RGB')
        img_tensor = transform(img).unsqueeze(0).to(device)
        return img_tensor
    finally:
        # PIL 이미지 객체를 명시적으로 닫음
        if img:
            img.close()

# 이미지에서 벡터 추출
def extract_vector(image_path):
    # 이미지 전처리
    img_tensor = preprocess_image(image_path)
    
    # 특징 추출
    features = feature_extractor.get_features(img_tensor)
    
    # NumPy 배열로 변환
    return features.numpy()

# 타임스탬프 제거 함수
def remove_timestamp(filename):
    """파일명에서 타임스탬프(YYYYMMDD_HHMMSS_) 형식만 제거합니다. _before 접미사는 유지합니다."""
    import re
    # 타임스탬프 제거
    return re.sub(r'^\d{8}_\d{6}_', '', filename)

# 이미지 저장 함수 추가
def save_image_to_storage(source_path, filename):
    """이미지를 스토리지 디렉토리에 저장합니다."""
    try:
        destination_path = os.path.join(IMAGES_DIR, filename)
        shutil.copy2(source_path, destination_path)
        return True
    except Exception as e:
        print(f"Error saving image {filename}: {str(e)}")
        return False

# 이미지 디렉토리 초기화 함수 추가
def clear_image_directory():
    """이미지 디렉토리의 모든 이미지를 삭제합니다."""
    try:
        for filename in os.listdir(IMAGES_DIR):
            file_path = os.path.join(IMAGES_DIR, filename)
            if os.path.isfile(file_path):
                os.remove(file_path)
        print(f"모든 이미지가 삭제되었습니다. ({IMAGES_DIR})")
        return True
    except Exception as e:
        print(f"이미지 디렉토리 초기화 중 오류 발생: {str(e)}")
        return False

@router.get("/settings")
async def get_settings():
    try:
        # 설정 조회 로직
        return {
            "status": "success",
            "settings": {
                "theme": "dark",
                "language": "en",
                "notifications": True
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/settings")
async def update_settings(settings: Dict[str, Any]):
    try:
        # 설정 업데이트 로직
        return {"status": "success", "message": "Settings updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/vectors/transform")
async def transform_vectors(data: Dict[str, Any]):
    """
    지정된 경로의 이미지를 로드하고 벡터로 변환합니다.
    이미지는 지정된, 로컬 파일 경로에서 직접 처리합니다.
    """
    try:
        # 필요한 벡터 데이터 디렉토리 확인
        os.makedirs(VECTORS_DIR, exist_ok=True)
        os.makedirs(IMAGES_DIR, exist_ok=True)
        
        # 이미지 디렉토리 초기화 (모든 이미지 삭제)
        clear_image_directory()
        print("이미지 디렉토리가 초기화되었습니다.")
        
        # 필요한 파일만 남기고 기존 파일 삭제
        processed_vectors_path = os.path.join(VECTORS_DIR, "processed_vectors.json")
        processed_metadata_path = os.path.join(VECTORS_DIR, "processed_metadata.json")
        tags_path = os.path.join(VECTORS_DIR, "tags.json")
        
        # 기존 파일 삭제
        for file_path in [processed_vectors_path, processed_metadata_path, tags_path]:
            if os.path.exists(file_path):
                os.remove(file_path)
                print(f"Reset: Deleted existing vector file {file_path}")
        
        print("모든 기존 벡터 데이터가 초기화되었습니다.")
        
        # 원본 디렉토리 경로 확인
        directory_paths = []
        if "directory_path" in data:
            directory_paths.append(data["directory_path"])
        if "analysisDirectory" in data:
            directory_paths.append(data["analysisDirectory"])
        
        # 프론트엔드에서 사용하는 변수명과 일치시키기
        # 디버깅 정보 출력
        print(f"전달받은 데이터: {data}")
        print(f"원본 디렉토리 경로: {directory_paths}")
            
        # 파일명 목록 확인
        image_files = []
        
        # 전달받은 이미지 파일명 리스트가 있는 경우 사용
        if "images" in data and isinstance(data["images"], list) and data["images"]:
            # 전달받은 이미지 목록에서 _before만 필터링
            original_count = len(data["images"])
            if "includeBeforeImagesOnly" in data and data["includeBeforeImagesOnly"]:
                image_files = [filename for filename in data["images"] if '_before' in filename]
                print(f"Filtered {len(image_files)}/{original_count} images with '_before' suffix from provided list")
            else:
                image_files = data["images"]
                print(f"Using all {len(image_files)} images from provided list")
        else:
            # 이미지 파일 목록이 없는 경우 경고
            print("Warning: No image list provided in data")
            return {"status": "warning", "message": "No image list provided in data"}
            
        print(f"Final image list for processing: {len(image_files)} images")
        if image_files:
            print(f"Sample filenames: {image_files[:5]}")
        
        if not image_files:
            return {"status": "warning", "message": "No images found to process (_before filter applied)"}
        
        # 파일명 그룹화 (타임스탬프 제거, 원본 파일명 맵핑 유지)
        grouped_images = {}
        original_to_clean = {}  # 원본 파일명 -> 정리된 파일명 매핑
        
        for filename in image_files:
            # 타임스탬프만 제거 (_before는 유지)
            clean_filename = remove_timestamp(filename)
            # 원본 파일명과 정리된 파일명 매핑 저장
            original_to_clean[filename] = clean_filename
            
            # 디버깅을 위한 로깅
            print(f"Original filename: {filename} -> Cleaned: {clean_filename}")
            
            if clean_filename not in grouped_images:
                grouped_images[clean_filename] = []
            grouped_images[clean_filename].append(filename)
        
        print(f"Grouped into {len(grouped_images)} unique images")
        # 디버깅: 그룹화 결과 로깅
        for clean_name, group in grouped_images.items():
            print(f"Group '{clean_name}': {group}")
        
        # 각 그룹마다 벡터 추출
        vectors = []
        filenames = []  # 원본 파일명 저장
        tags = []  # 파일 태그 저장 배열 추가
        errors = []
        saved_images = []  # 저장된 이미지 추적용 배열 추가
        
        for clean_filename, filenames_group in grouped_images.items():
            try:
                if len(filenames_group) == 1:
                    # 단일 이미지 처리 - 원본 파일 경로에서 직접 처리
                    original_filename = filenames_group[0]  # 원본 파일명 저장
                    original_path = None
                    
                    # 여러 디렉토리에서 파일 찾기
                    for dir_path in directory_paths:
                        test_path = os.path.join(dir_path, original_filename)
                        if os.path.exists(test_path):
                            original_path = test_path
                            break
                    
                    if original_path is None:
                        # 파일을 찾을 수 없는 경우
                        raise Exception(f"파일을 찾을 수 없음: {original_filename}")
                    
                    print(f"Processing image from: {original_path}")
                    
                    # 이미지를 스토리지에 저장
                    if save_image_to_storage(original_path, original_filename):
                        saved_images.append(original_filename)
                        print(f"Saved image to storage: {original_filename}")
                    
                    # 벡터 추출
                    vector = extract_vector(original_path)
                    vectors.append(vector.tolist())
                    filenames.append(original_filename)  # 원본 파일명 저장
                    
                    # 태그 설정: _before 포함 여부에 따라 태그 부여
                    if '_before' in original_filename:
                        tags.append('I-app')
                    else:
                        tags.append('Analysis')
                        
                    print(f"Processed single image: {original_filename}")
                else:
                    # 여러 이미지 처리 (평균 벡터 계산)
                    group_vectors = []
                    has_before = any('_before' in f for f in filenames_group)
                    
                    # 그룹의 대표 파일명 선택 (우선순위: _before 포함 파일)
                    representative_filename = next((f for f in filenames_group if '_before' in f), filenames_group[0])
                    
                    for filename in filenames_group:
                        try:
                            # 원본 파일 경로 찾기
                            original_path = None
                            for dir_path in directory_paths:
                                test_path = os.path.join(dir_path, filename)
                                if os.path.exists(test_path):
                                    original_path = test_path
                                    break
                            
                            if original_path is None:
                                # 파일을 찾을 수 없는 경우
                                print(f"Warning: 파일을 찾을 수 없음: {filename}")
                                continue
                            
                            print(f"Processing group image from: {original_path}")
                            
                            # 이미지를 스토리지에 저장
                            if save_image_to_storage(original_path, filename):
                                saved_images.append(filename)
                                print(f"Saved image to storage: {filename}")
                            
                            # 벡터 추출
                            vector = extract_vector(original_path)
                            group_vectors.append(vector.tolist())
                        except Exception as e:
                            print(f"Error extracting vector from {filename}: {str(e)}")
                    
                    if group_vectors:
                        # 평균 벡터 계산
                        vector_length = len(group_vectors[0])
                        avg_vector = [0] * vector_length
                        
                        for vec in group_vectors:
                            for i in range(vector_length):
                                avg_vector[i] += vec[i]
                        
                        avg_vector = [val / len(group_vectors) for val in avg_vector]
                        vectors.append(avg_vector)
                        filenames.append(representative_filename)  # 대표 파일명 저장
                        
                        # 태그 설정: _before 포함 여부에 따라 태그 부여
                        if has_before:
                            tags.append('I-app')
                        else:
                            tags.append('Analysis')
                            
                        print(f"Processed group with {len(group_vectors)} vectors: {representative_filename}")
                    else:
                        errors.append({
                            "filename": clean_filename,
                            "error": "모든 그룹 이미지에서 벡터 추출 실패"
                        })
            except Exception as e:
                errors.append({
                    "filename": clean_filename,
                    "error": str(e)
                })
                print(f"Error processing image group {clean_filename}: {str(e)}")
        
        # 처리된 벡터 데이터 저장 (metadata.json과 vectors.json은 저장하지 않음)
        tags_path = os.path.join(VECTORS_DIR, "tags.json")
        processed_vectors_path = os.path.join(VECTORS_DIR, "processed_vectors.json")
        processed_metadata_path = os.path.join(VECTORS_DIR, "processed_metadata.json")
        
        # 태그 데이터 저장
        with open(tags_path, 'w', encoding='utf-8') as f:
            json.dump(tags, f, ensure_ascii=False, indent=2)
        
        # 처리된 벡터 데이터 저장 (이미지당 하나의 벡터)
        with open(processed_vectors_path, 'w', encoding='utf-8') as f:
            json.dump(vectors, f, ensure_ascii=False, indent=2)
        
        with open(processed_metadata_path, 'w', encoding='utf-8') as f:
            json.dump(filenames, f, ensure_ascii=False, indent=2)
        
        # 벡터 차원 축소 방법 결정
        use_umap = data.get("useUMAP", False) and UMAP_AVAILABLE
        
        # 3D 투영 좌표 계산
        projected_vectors = []
        
        if use_umap and len(vectors) > 2:
            # UMAP 차원 축소 사용
            try:
                print("UMAP 차원 축소 사용 중...")
                # numpy 배열로 변환
                vectors_array = np.array(vectors)
                
                # UMAP 설정
                reducer = umap.UMAP(
                    n_components=3,  # 3차원으로 축소
                    n_neighbors=15,  # 이웃 수 (클수록 글로벌 구조를 더 많이 보존)
                    min_dist=0.1,    # 점들 사이의 최소 거리
                    metric='euclidean',
                    random_state=42  # 재현성을 위한 랜덤 시드
                )
                
                # UMAP 적용
                embedding = reducer.fit_transform(vectors_array)
                
                # 결과를 projected_vectors에 저장
                for i in range(len(embedding)):
                    projected_vectors.append(embedding[i].tolist())
                    
                print(f"UMAP 차원 축소 완료: {len(vectors)} 벡터 -> {len(projected_vectors)} 3D 좌표")
            except Exception as e:
                print(f"UMAP 차원 축소 중 오류 발생: {str(e)}")
                print("기본 차원 축소 방법으로 전환합니다.")
                use_umap = False
                
        if not use_umap or len(projected_vectors) == 0:
            # 기존 차원 축소 방법 사용 (벡터 그룹화)
            print("기본 차원 축소 방법 사용 중...")
            for vec in vectors:
                if not vec or len(vec) < 3:
                    projected_vectors.append([0, 0, 0])
                    continue
                    
                # 벡터를 3개의 그룹으로 나누어 평균 계산
                vector_length = len(vec)
                group_size = vector_length // 3
                
                groups = [
                    vec[:group_size],
                    vec[group_size:2*group_size],
                    vec[2*group_size:]
                ]
                
                projected = [
                    sum(groups[0]) / len(groups[0]) if groups[0] else 0,
                    sum(groups[1]) / len(groups[1]) if groups[1] else 0,
                    sum(groups[2]) / len(groups[2]) if groups[2] else 0
                ]
                
                projected_vectors.append(projected)
        
        # 3D 좌표 정규화
        dimensions = [0, 1, 2]
        normalized_coords = []
        
        for dim in dimensions:
            values = [v[dim] for v in projected_vectors]
            min_val = min(values) if values else 0
            max_val = max(values) if values else 1
            
            # 0으로 나누는 것 방지
            if max_val == min_val:
                normalized_coords.append([(v - min_val) for v in values])
            else:
                normalized_coords.append([(v - min_val) / (max_val - min_val) for v in values])
        
        # 정규화된 좌표로 벡터 재구성
        normalized_vectors = []
        for i in range(len(projected_vectors)):
            normalized_vectors.append([
                normalized_coords[0][i],
                normalized_coords[1][i],
                normalized_coords[2][i]
            ])
        
        # processed_vectors.json 업데이트 (정규화된 좌표로)
        with open(processed_vectors_path, 'w', encoding='utf-8') as f:
            json.dump(normalized_vectors, f, ensure_ascii=False, indent=2)
        
        # 결과에 3D 좌표를 포함
        results = []
        for i, filename in enumerate(filenames):
            if i < len(normalized_vectors):
                results.append({
                    "filename": filename,
                    "coordinates": normalized_vectors[i],
                    "tag": tags[i] if i < len(tags) else "Unknown"
                })
        
        # 성공 응답
        dimension_reduction_method = "UMAP" if use_umap else "그룹 평균"
        return {
            "status": "success",
            "message": f"벡터 데이터 초기화 후 {len(vectors)}개 이미지에서 벡터 추출 완료 (차원 축소: {dimension_reduction_method})",
            "count": len(vectors),
            "saved_images_count": len(saved_images),
            "dimension_reduction": {
                "method": dimension_reduction_method,
                "success": True
            },
            "tags": {
                "i_app_count": tags.count('I-app'),
                "analysis_count": tags.count('Analysis')
            },
            "debug_info": {
                "grouped_images_count": len(grouped_images),
                "raw_image_files": image_files[:20] if len(image_files) > 20 else image_files,  # 처음 20개만
                "processed_filenames": filenames
            },
            "errors": errors,
            "results": [
                {"filename": filename, "coordinates": coords, "tag": tag}
                for filename, coords, tag in zip(filenames, normalized_vectors, tags)
            ]
        }
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"Error in transform_vectors: {str(e)}\n{error_detail}")
        raise HTTPException(status_code=500, detail=str(e))

# load-local-images 함수 수정 (이미지 복사 기능 추가)
@router.post("/load-local-images")
async def load_local_images(directory_path: Optional[str] = Query(None), data: Optional[Dict[str, Any]] = Body(None)):
    """
    지정된 로컬 디렉토리에서 이미지를 로드하고 벡터를 추출합니다.
    이제 이미지를 서버 스토리지에 직접 저장하는 기능이 추가되었습니다.
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
        
        # '_whole' 접미사 필터 옵션 확인
        include_whole_only = False
        if data and "includeWholeImagesOnly" in data:
            include_whole_only = data["includeWholeImagesOnly"]
        
        # 태그 옵션 확인
        tag = "Unknown"
        if data and "tag" in data:
            tag = data["tag"]
        
        print(f"필터링 옵션 상태: includeBeforeImagesOnly = {include_before_only}, includeWholeImagesOnly = {include_whole_only}, tag = {tag}")
        
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
                # 필터링 로직
                should_include = True
                
                # '_before' 필터링 체크 - true일 때 _before가 있는 파일만 포함
                if include_before_only and data and "includeBeforeImagesOnly" in data:
                    if '_before' not in filename:
                        should_include = False
                
                # '_whole' 필터링 체크 - false일 때 _whole로 끝나지 않는 파일만 포함
                if not include_whole_only and data and "includeWholeImagesOnly" in data:
                    if filename.lower().endswith('_whole.png'):
                        should_include = False
                
                if should_include:
                    filtered_files.append(filename)
                else:
                    skipped_files.append(filename)
                    continue  # 필터링 조건에 맞지 않는 이미지는 건너뜀
                
                # 파일이 필터링을 통과한 경우에만 처리
                file_path = os.path.join(path, filename)
                
                try:
                    # 이미지 파일을 스토리지에 복사
                    destination_path = os.path.join(IMAGES_DIR, filename)
                    shutil.copy2(file_path, destination_path)
                    
                    processed_images.append({
                        "original_path": file_path,
                        "stored_filename": filename,
                        "stored_path": f"/api/imageanalysis/images/{filename}",  # API URL 경로 변경
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
        
        result = {
            "status": "success" if not errors or processed_images else "partial_success" if errors and processed_images else "error",
            "message": f"Processed {len(processed_images)} images with {len(errors)} errors",
            "processed": processed_images,
            "errors": errors,
            "tag": tag
        }
        
        # 이미지가 로드되었다면 자동으로 벡터 추출 수행
        if processed_images:
            try:
                extract_result = {"status": "not_performed", "message": "Vector extraction was skipped"}
                result["vector_extraction"] = extract_result
            except Exception as e:
                result["vector_extraction"] = {
                    "status": "error",
                    "message": f"Vector extraction failed: {str(e)}"
                }
        
        return result
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"Error in load_local_images: {str(e)}\n{error_detail}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/vectors")
async def get_vectors():
    """저장된 벡터와 메타데이터를 반환합니다."""
    try:
        # 오직 processed_ 파일만 사용
        processed_vectors_path = os.path.join(VECTORS_DIR, "processed_vectors.json")
        processed_metadata_path = os.path.join(VECTORS_DIR, "processed_metadata.json")
        
        # 벡터 파일이 없으면 실패
        if not os.path.exists(processed_vectors_path) or not os.path.exists(processed_metadata_path):
            raise HTTPException(status_code=404, detail="Vector data not found")
        
        # 벡터와 메타데이터 로드
        try:
            with open(processed_vectors_path, 'r') as f:
                vectors = json.load(f)
            with open(processed_metadata_path, 'r') as f:
                labels = json.load(f)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="Vector data not found")
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail="Error decoding vector data")
        
        if not vectors or not labels or len(vectors) != len(labels):
            raise HTTPException(status_code=500, detail="Invalid vector data format")
        
        return {
            "vectors": vectors,
            "metadata": labels
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/save-processed-vectors")
async def save_processed_vectors(data: Dict[str, Any]):
    """전처리된 벡터 데이터를 저장합니다 (각 이미지당 하나의 벡터만 포함)."""
    try:
        # 데이터 유효성 검사
        if not data.get("vectors") or not data.get("metadata"):
            raise HTTPException(status_code=400, detail="Vectors and metadata are required")
        
        # 벡터와 메타데이터 길이 확인
        if len(data["vectors"]) != len(data["metadata"]):
            raise HTTPException(
                status_code=400, 
                detail=f"Vectors and metadata length mismatch: {len(data['vectors'])} vectors vs {len(data['metadata'])} metadata items"
            )
        
        # 처리된 벡터 데이터 저장 경로 설정
        processed_vectors_path = os.path.join(VECTORS_DIR, "processed_vectors.json")
        processed_metadata_path = os.path.join(VECTORS_DIR, "processed_metadata.json")
        
        # 데이터 저장
        with open(processed_vectors_path, 'w', encoding='utf-8') as f:
            json.dump(data["vectors"], f, ensure_ascii=False, indent=2)
        
        with open(processed_metadata_path, 'w', encoding='utf-8') as f:
            json.dump(data["metadata"], f, ensure_ascii=False, indent=2)
        
        # 성공 응답
        return {
            "status": "success",
            "message": f"Saved {len(data['vectors'])} processed vectors",
            "count": len(data["vectors"]),
            "filenames": data["metadata"][:5] + (["..."] if len(data["metadata"]) > 5 else [])  # 처음 5개만 샘플로 표시
        }
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"Error in save_processed_vectors: {str(e)}\n{error_detail}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/processed-vectors")
async def get_processed_vectors():
    """저장된 처리된 벡터 데이터를 조회합니다 (각 이미지당 하나의 벡터만 포함)."""
    try:
        processed_vectors_path = os.path.join(VECTORS_DIR, "processed_vectors.json")
        processed_metadata_path = os.path.join(VECTORS_DIR, "processed_metadata.json")
        
        if not os.path.exists(processed_vectors_path) or not os.path.exists(processed_metadata_path):
            # 처리된 벡터가 없으면 404 반환
            raise HTTPException(status_code=404, detail="Processed vector data not found")
        
        with open(processed_vectors_path, 'r') as f:
            vectors = json.load(f)
        
        with open(processed_metadata_path, 'r') as f:
            metadata = json.load(f)
        
        return {
            "status": "success",
            "vectors": vectors,
            "metadata": metadata,
            "count": len(vectors),
            "is_processed": True
        }
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"Error in get_processed_vectors: {str(e)}\n{error_detail}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/vector-files-info")
async def get_vector_files_info():
    """벡터 관련 파일들의 존재 여부와 경로 정보를 제공합니다."""
    try:
        # 확인할 파일 목록 (processed_ 파일과 tags 파일만 사용)
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
        print(f"Error in get_vector_files_info: {str(e)}\n{error_detail}")
        raise HTTPException(status_code=500, detail=str(e)) 