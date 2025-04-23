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
        # 파일 저장
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{timestamp}_{file.filename}"
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
        
        for image in images:
            try:
                vector = extract_vector(image["path"])
                vectors.append(vector.tolist())
                filenames.append(image["filename"])
            except Exception as e:
                print(f"Error extracting vector from {image['filename']}: {str(e)}")
        
        # 벡터와 메타데이터 저장
        vectors_path = os.path.join(VECTORS_DIR, "vectors.json")
        metadata_path = os.path.join(VECTORS_DIR, "metadata.json")
        
        with open(vectors_path, 'w') as f:
            json.dump(vectors, f)
        
        with open(metadata_path, 'w') as f:
            json.dump(filenames, f)
        
        return {
            "status": "success",
            "message": f"Extracted vectors from {len(vectors)} images",
            "count": len(vectors)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/vectors")
async def get_vectors():
    """저장된 벡터 데이터를 조회합니다."""
    try:
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
            metadata = json.load(f)
        
        return {
            "status": "success",
            "vectors": vectors,
            "metadata": metadata,
            "count": len(vectors)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/similar-images/{image_name}")
async def find_similar_images(image_name: str, count: int = 5):
    """특정 이미지와 가장 유사한 이미지를 찾습니다."""
    try:
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
        
        # 입력 이미지 인덱스 찾기
        try:
            query_idx = filenames.index(image_name)
        except ValueError:
            return {
                "status": "error",
                "message": f"Image '{image_name}' not found in the dataset"
            }
        
        query_vector = vectors[query_idx]
        
        # 유사도 계산 (코사인 유사도)
        similarities = []
        for i, vec in enumerate(vectors):
            if i == query_idx:  # 자기 자신은 건너뛰기
                continue
                
            # 코사인 유사도 계산
            dot_product = sum(a * b for a, b in zip(query_vector, vec))
            norm_a = sum(a * a for a in query_vector) ** 0.5
            norm_b = sum(b * b for b in vec) ** 0.5
            similarity = dot_product / (norm_a * norm_b)
            
            similarities.append({
                "filename": filenames[i],
                "similarity": similarity,
                "index": i
            })
        
        # 유사도 기준으로 정렬
        similarities.sort(key=lambda x: x["similarity"], reverse=True)
        
        # 상위 N개 결과 반환
        top_results = similarities[:count]
        
        # 이미지 URL 생성
        for result in top_results:
            result["image_url"] = f"/storage/{result['filename']}"
        
        return {
            "status": "success",
            "query_image": image_name,
            "query_image_url": f"/storage/{image_name}",
            "similar_images": top_results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/load-local-images")
async def load_local_images(directory_path: Optional[str] = Query(None, description="로컬 이미지가 있는 디렉토리 경로"), 
                            data: Optional[Dict[str, Any]] = Body(None)):
    """지정된 로컬 디렉토리에서 이미지를 자동으로 로드하고 벡터를 추출합니다."""
    try:
        # 경로 결정 (Query 파라미터 또는 JSON 바디에서)
        path = directory_path
        if not path and data and "directory_path" in data:
            path = data["directory_path"]
        
        if not path:
            raise HTTPException(status_code=400, detail="Directory path is required")
            
        processed_images = []
        errors = []
        
        # 지정된 디렉토리가 존재하는지 확인
        if not os.path.exists(path):
            raise HTTPException(status_code=404, detail=f"Directory not found: {path}")
            
        # 디렉토리에서 이미지 파일 찾기
        for filename in os.listdir(path):
            if filename.lower().endswith(('.jpg', '.jpeg', '.png', '.gif')):
                file_path = os.path.join(path, filename)
                
                try:
                    # 파일 복사 및 저장
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    new_filename = f"{timestamp}_{filename}"
                    dest_path = os.path.join(STORAGE_DIR, new_filename)
                    
                    shutil.copy2(file_path, dest_path)
                    
                    processed_images.append({
                        "original_path": file_path,
                        "stored_filename": new_filename,
                        "stored_path": dest_path
                    })
                    
                    print(f"Loaded image: {filename} -> {new_filename}")
                except Exception as e:
                    errors.append({
                        "filename": filename,
                        "error": str(e)
                    })
                    print(f"Error loading image {filename}: {str(e)}")
        
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