from fastapi import APIRouter, HTTPException, UploadFile, File, Query, Body
from typing import List, Dict, Any, Optional
import os
import shutil
from datetime import datetime
import numpy as np
from PIL import Image
import io
import json
from pathlib import Path
import base64
from sklearn.decomposition import PCA
import torch
from torchvision import transforms
from torchvision.models import resnet50, ResNet50_Weights

router = APIRouter()

STORAGE_DIR = "./storage"
VECTORS_DIR = os.path.join(STORAGE_DIR, "vector")
os.makedirs(STORAGE_DIR, exist_ok=True)
os.makedirs(VECTORS_DIR, exist_ok=True)

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
    
    img = Image.open(image_path).convert('RGB')
    img_tensor = transform(img).unsqueeze(0).to(device)
    return img_tensor

# 이미지에서 벡터 추출
def extract_vector(image_path):
    # 이미지 전처리
    img_tensor = preprocess_image(image_path)
    
    # 특징 추출
    features = feature_extractor.get_features(img_tensor)
    
    # NumPy 배열로 변환
    return features.numpy()

@router.post("/store")
async def store_image(file: UploadFile = File(...)):
    try:
        # 파일 저장 (원본 파일명 그대로 사용)
        filename = file.filename
        file_path = os.path.join(STORAGE_DIR, filename)
        
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
        for filename in os.listdir(STORAGE_DIR):
            if filename.endswith(('.jpg', '.jpeg', '.png')):
                images.append({
                    "filename": filename,
                    "path": os.path.join(STORAGE_DIR, filename),
                    "store_time": os.path.getctime(os.path.join(STORAGE_DIR, filename))
                })
        return {"status": "success", "images": images}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/extract-vectors")
async def extract_vectors():
    """모든 저장된 이미지에서 벡터를 추출하고 저장합니다."""
    try:
        # 이미지 목록 가져오기
        images = []
        for filename in os.listdir(STORAGE_DIR):
            if filename.endswith(('.jpg', '.jpeg', '.png')):
                images.append({
                    "filename": filename,
                    "path": os.path.join(STORAGE_DIR, filename)
                })
        
        if not images:
            return {"status": "warning", "message": "No images found in storage"}
        
        # 모든 이미지에서 벡터 추출
        vectors = []
        filenames = []
        errors = []
        
        # 파일명 기준 그룹화 (타임스탬프 제거)
        grouped_images = {}
        for image in images:
            clean_filename = remove_timestamp(image["filename"])
            if clean_filename not in grouped_images:
                grouped_images[clean_filename] = []
            grouped_images[clean_filename].append(image)
        
        # 각 그룹(이미지)당 하나의 벡터만 저장
        for clean_filename, image_group in grouped_images.items():
            try:
                if len(image_group) == 1:
                    # 단일 이미지인 경우 직접 추출
                    image = image_group[0]
                    vector = extract_vector(image["path"])
                    vectors.append(vector.tolist())
                    filenames.append(clean_filename)  # 정리된 파일명 사용
                else:
                    # 여러 이미지가 같은 이름을 가진 경우 (타임스탬프만 다른 경우)
                    # 각 이미지에서 벡터 추출 후 평균 계산
                    group_vectors = []
                    for image in image_group:
                        try:
                            vector = extract_vector(image["path"])
                            group_vectors.append(vector.tolist())
                        except Exception as e:
                            print(f"Error extracting vector from group member {image['filename']}: {str(e)}")
                    
                    if group_vectors:
                        # 벡터 평균 계산
                        vector_length = len(group_vectors[0])
                        avg_vector = [0] * vector_length
                        
                        for vec in group_vectors:
                            for i in range(vector_length):
                                avg_vector[i] += vec[i]
                        
                        avg_vector = [val / len(group_vectors) for val in avg_vector]
                        vectors.append(avg_vector)
                        filenames.append(clean_filename)
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
        
        # 벡터와 메타데이터 저장
        vectors_path = os.path.join(VECTORS_DIR, "vectors.json")
        metadata_path = os.path.join(VECTORS_DIR, "metadata.json")
        
        with open(vectors_path, 'w') as f:
            json.dump(vectors, f)
        
        with open(metadata_path, 'w') as f:
            json.dump(filenames, f)
        
        # 바로 processed-vectors에도 동일하게 저장 (이미지당 하나의 벡터)
        processed_vectors_path = os.path.join(VECTORS_DIR, "processed_vectors.json")
        processed_metadata_path = os.path.join(VECTORS_DIR, "processed_metadata.json")
        
        with open(processed_vectors_path, 'w') as f:
            json.dump(vectors, f)
        
        with open(processed_metadata_path, 'w') as f:
            json.dump(filenames, f)
        
        # 3D 투영 좌표 계산 (간단한 PCA 유사 방식)
        projected_vectors = []
        
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
        
        # 결과에 3D 좌표를 포함하여 반환
        results = []
        for i, filename in enumerate(filenames):
            if i < len(projected_vectors):
                results.append({
                    "filename": filename,
                    "coordinates": projected_vectors[i]
                })
        
        return {
            "status": "success",
            "message": f"Extracted vectors from {len(vectors)} images",
            "count": len(vectors),
            "filenames": filenames[:10] if len(filenames) > 10 else filenames,  # 처음 10개만 반환
            "errors": errors,  # 에러 정보도 함께 반환
            "results": results  # 3D 좌표 포함
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/vectors")
async def get_vectors():
    """저장된 벡터와 메타데이터를 반환합니다."""
    try:
        vectors_path = os.path.join(VECTORS_DIR, "vectors.json")
        metadata_path = os.path.join(VECTORS_DIR, "metadata.json")
        
        # 벡터 파일이 없으면 벡터 추출 실행
        if not os.path.exists(vectors_path) or not os.path.exists(metadata_path):
            extract_result = await extract_vectors()
            if extract_result.get("status") == "warning":
                raise HTTPException(status_code=404, detail="No images found to extract vectors from")
        
        # 벡터와 메타데이터 로드
        try:
            with open(vectors_path, 'r') as f:
                vectors = json.load(f)
            with open(metadata_path, 'r') as f:
                labels = json.load(f)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="Vector data not found")
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail="Error decoding vector data")
        
        if not vectors or not labels or len(vectors) != len(labels):
            raise HTTPException(status_code=500, detail="Invalid vector data format")
        
        return {
            "vectors": vectors,
            "labels": labels
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 타임스탬프 제거 함수 추가
def remove_timestamp(filename):
    """파일명에서 타임스탬프(YYYYMMDD_HHMMSS_) 형식을 제거합니다."""
    import re
    return re.sub(r'^\d{8}_\d{6}_', '', filename)

@router.get("/similar-images/{image_name}")
async def find_similar_images(image_name: str, count: int = 5):
    """특정 이미지와 가장 유사한 이미지를 찾습니다."""
    try:
        # 타임스탬프 제거한 원본 이미지 이름
        print(f"Finding similar images for: {image_name} )")
        
        # 벡터 데이터 로드
        vectors_path = os.path.join(VECTORS_DIR, "vectors.json")
        metadata_path = os.path.join(VECTORS_DIR, "metadata.json")
        
        if not os.path.exists(vectors_path) or not os.path.exists(metadata_path):
            return {
                "status": "warning",
                "message": "Vectors not yet extracted, please run extract-vectors first"
            }
        with open(vectors_path, 'r') as f:
            vectors = json.load(f)
        
        with open(metadata_path, 'r') as f:
            filenames = json.load(f)
        
        # 모든 파일명에서 타임스탬프 제거한 버전 맵 생성
        clean_filenames = [fname for fname in filenames]
        
        # 원본 이름으로 인덱스 찾기 시도 (타임스탬프 제거 후)
        matching_indices = []
        for i, (fname, clean_fname) in enumerate(zip(filenames, clean_filenames)):
            if clean_fname == image_name:
                matching_indices.append(i)
                print(f"Found matching index {i}: {fname} -> {clean_fname}")
        
        if not matching_indices:
            return {
                "status": "error",
                "message": f"Image '{image_name}' not found in the dataset"
            }
        
        # 첫 번째 매칭 인덱스 사용
        query_idx = matching_indices[0]
        query_vector = vectors[query_idx]
        
        # 유사도 계산 (코사인 유사도)
        similarities = []
        for i, vec in enumerate(vectors):
            # 자기 자신 및 동일 원본 이미지는 건너뛰기
            if i == query_idx or (i in matching_indices):
                continue
                
            # 코사인 유사도 계산
            dot_product = sum(a * b for a, b in zip(query_vector, vec))
            norm_a = sum(a * a for a in query_vector) ** 0.5
            norm_b = sum(b * b for b in vec) ** 0.5
            similarity = dot_product / (norm_a * norm_b)
            
            # 동일한 원본 이미지(타임스탬프만 다른)는 제외
            if clean_filenames[i] == image_name:
                print(f"Skipping same original image: {filenames[i]} -> {clean_filenames[i]}")
                continue
                
            similarities.append({
                "filename": filenames[i],
                "clean_filename": clean_filenames[i],
                "similarity": similarity,
                "index": i
            })
        
        # 유사도 기준으로 정렬
        similarities.sort(key=lambda x: x["similarity"], reverse=True)
        
        # 중복 제거 (동일 원본 이름은 가장 유사도가 높은 것만 유지)
        seen_clean_names = set()
        unique_results = []
        
        for item in similarities:
            clean_name = item["clean_filename"]
            if clean_name not in seen_clean_names:
                seen_clean_names.add(clean_name)
                unique_results.append(item)
                if len(unique_results) >= count:
                    break
        
        # 상위 N개 결과 반환
        top_results = unique_results[:count]
        
        # 이미지 URL 생성 및 불필요한 필드 제거
        for result in top_results:
            # 실제 이미지 경로인 /images/를 사용
            result["image_url"] = f"/images/{result['filename']}"
            # 원본 파일명으로 대체
            result["filename"] = result["clean_filename"]
            # 임시 필드 제거
            result.pop("clean_filename", None)
        
        return {
            "status": "success",
            "query_image": image_name,
            "query_image_url": f"/images/{image_name}",
            "similar_images": top_results
        }
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"Error in find_similar_images: {str(e)}\n{error_detail}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/load-local-images")
async def load_local_images(directory_path: Optional[str] = Query(None, description="로컬 이미지가 있는 디렉토리 경로"), 
                            data: Optional[Dict[str, Any]] = Body(None)):
    """지정된 로컬 디렉토리에서 이미지를 자동으로 로드하고 벡터를 추출합니다."""
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
        
        print(f"필터링 옵션 상태: includeBeforeImagesOnly = {include_before_only}")
        
        if not path:
            raise HTTPException(status_code=400, detail="Directory path is required")
            
        # 지정된 디렉토리가 존재하는지 확인
        if not os.path.exists(path):
            raise HTTPException(status_code=404, detail=f"Directory not found: {path}")
        
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
                        # 파일 복사 및 저장 (원본 파일명 그대로 사용)
                        dest_path = os.path.join(STORAGE_DIR, filename)
                        shutil.copy2(file_path, dest_path)
                        
                        processed_images.append({
                            "original_path": file_path,
                            "stored_filename": filename,
                            "stored_path": dest_path
                        })
                        
                        print(f"Loaded image: {filename}")
                    except Exception as e:
                        errors.append({
                            "filename": filename,
                            "error": str(e)
                        })
                        print(f"Error loading image {filename}: {str(e)}")
        
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
            "errors": errors
        }
        
        # 이미지가 로드되었다면 자동으로 벡터 추출 수행
        if processed_images:
            try:
                extract_result = await extract_vectors()
                result["vector_extraction"] = extract_result
            except Exception as e:
                result["vector_extraction"] = {
                    "status": "error",
                    "message": f"Vector extraction failed: {str(e)}"
                }
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/load-test-images")
async def load_test_images():
    """테스트 이미지 디렉토리에서 이미지를 자동으로 로드합니다."""
    directory_path = "D:\\홈피\\image_lcnc_msa2\\frontend\\public\\test_image"
    return await load_local_images(directory_path=directory_path)

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
        with open(processed_vectors_path, 'w') as f:
            json.dump(data["vectors"], f)
        
        with open(processed_metadata_path, 'w') as f:
            json.dump(data["metadata"], f)
        
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
            # 처리된 벡터가 없으면 일반 벡터 API 호출
            return await get_vectors()
        
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