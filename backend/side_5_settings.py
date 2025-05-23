from fastapi import APIRouter, HTTPException, UploadFile, File, Query, Body
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

router = APIRouter()

# 스토리지 경로 설정
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

# 타임스탬프 제거 함수
def remove_timestamp(filename):
    """파일명에서 타임스탬프(YYYYMMDD_HHMMSS_) 형식을 제거합니다."""
    import re
    return re.sub(r'^\d{8}_\d{6}_', '', filename)

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
    여기서는 이미지가 이미 storage 폴더에 저장되어 있다고 가정합니다.
    """
    try:
        # 파일명 목록 확인
        image_files = []
        
        # 전달받은 이미지 파일명 리스트가 있는 경우 사용
        if "images" in data and isinstance(data["images"], list) and data["images"]:
            image_files = data["images"]
            print(f"Using provided image list with {len(image_files)} images")
        else:
            # 저장 디렉토리에서 이미지 파일 목록 가져오기
            for filename in os.listdir(STORAGE_DIR):
                if filename.endswith(('.jpg', '.jpeg', '.png', '.gif')):
                    # '_before' 필터링 옵션 체크
                    if "includeBeforeImagesOnly" in data and data["includeBeforeImagesOnly"]:
                        if '_before' in filename:
                            image_files.append(filename)
                    else:
                        image_files.append(filename)
            
            print(f"Found {len(image_files)} images in storage directory")
        
        if not image_files:
            return {"status": "warning", "message": "No images found to process"}
        
        # 파일명 그룹화 (타임스탬프 제거)
        grouped_images = {}
        for filename in image_files:
            clean_filename = remove_timestamp(filename)
            if clean_filename not in grouped_images:
                grouped_images[clean_filename] = []
            grouped_images[clean_filename].append(filename)
        
        print(f"Grouped into {len(grouped_images)} unique images")
        
        # 각 그룹마다 벡터 추출
        vectors = []
        filenames = []
        errors = []
        
        for clean_filename, filenames_group in grouped_images.items():
            try:
                if len(filenames_group) == 1:
                    # 단일 이미지 처리
                    image_path = os.path.join(STORAGE_DIR, filenames_group[0])
                    vector = extract_vector(image_path)
                    vectors.append(vector.tolist())
                    filenames.append(clean_filename)
                    print(f"Processed single image: {clean_filename}")
                else:
                    # 여러 이미지 처리 (평균 벡터 계산)
                    group_vectors = []
                    for filename in filenames_group:
                        try:
                            image_path = os.path.join(STORAGE_DIR, filename)
                            vector = extract_vector(image_path)
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
                        filenames.append(clean_filename)
                        print(f"Processed group with {len(group_vectors)} vectors: {clean_filename}")
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
        
        # 결과 데이터 저장
        vectors_path = os.path.join(VECTORS_DIR, "vectors.json")
        metadata_path = os.path.join(VECTORS_DIR, "metadata.json")
        
        # 처리된 벡터 데이터도 저장
        processed_vectors_path = os.path.join(VECTORS_DIR, "processed_vectors.json")
        processed_metadata_path = os.path.join(VECTORS_DIR, "processed_metadata.json")
        
        # 벡터 데이터 저장
        with open(vectors_path, 'w') as f:
            json.dump(vectors, f)
        
        with open(metadata_path, 'w') as f:
            json.dump(filenames, f)
        
        # 처리된 벡터도 동일하게 저장 (이미지당 하나의 벡터)
        with open(processed_vectors_path, 'w') as f:
            json.dump(vectors, f)
        
        with open(processed_metadata_path, 'w') as f:
            json.dump(filenames, f)
        
        # 3D 투영 좌표 계산
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
        
        # 결과에 3D 좌표를 포함
        results = []
        for i, filename in enumerate(filenames):
            if i < len(normalized_vectors):
                results.append({
                    "filename": filename,
                    "coordinates": normalized_vectors[i]
                })
        
        # 처리 결과 반환
        return {
            "status": "success",
            "message": f"Transformed {len(vectors)} images into vectors",
            "count": len(vectors),
            "processed": len(vectors),
            "errors": errors,
            "results": results  # 3D 좌표 포함
        }
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"Error in transform_vectors: {str(e)}\n{error_detail}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/vectors")
async def get_vectors():
    """저장된 벡터와 메타데이터를 반환합니다."""
    try:
        vectors_path = os.path.join(VECTORS_DIR, "vectors.json")
        metadata_path = os.path.join(VECTORS_DIR, "metadata.json")
        
        # 벡터 파일이 없으면 실패
        if not os.path.exists(vectors_path) or not os.path.exists(metadata_path):
            raise HTTPException(status_code=404, detail="Vector data not found")
        
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