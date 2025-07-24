from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import List, Dict, Any, Optional
import os
import shutil
from datetime import datetime
import json
import base64
import io
from PIL import Image
import numpy as np
import torch
from torchvision import transforms
from torchvision.models import resnet50, ResNet50_Weights
import tempfile

# UMAP import (선택적)
UMAP_AVAILABLE = False
try:
    import umap
    import umap.umap_ as umap
    UMAP_AVAILABLE = True
    # print("[DEBUG] UMAP successfully imported")
except ImportError:
    print("[DEBUG] UMAP not available, using fallback method")

router = APIRouter()

PROCESS_DIR = "./processed"
IMAGES_DIR = "./storage/images"
VECTORS_DIR = "./storage/vector"
os.makedirs(PROCESS_DIR, exist_ok=True)
os.makedirs(IMAGES_DIR, exist_ok=True)
os.makedirs(VECTORS_DIR, exist_ok=True)

# ResNet50 모델 전역 변수
resnet_model = None
resnet_transform = None

def initialize_resnet():
    """ResNet50 모델을 초기화합니다."""
    global resnet_model, resnet_transform
    
    if resnet_model is None:
        # print("[RESNET] ResNet50 모델 로딩 중...")
        resnet_model = resnet50(weights=ResNet50_Weights.IMAGENET1K_V2)
        resnet_model.eval()
        
        # 전처리 파이프라인
        resnet_transform = transforms.Compose([
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
        # print("[RESNET] ResNet50 모델 로딩 완료")

class ResNetFeatureExtractor:
    def __init__(self, model):
        self.model = model
        self.features = None
        
    def get_features(self, input_tensor):
        def hook(module, input, output):
            self.features = output.detach()
        
        # avgpool 레이어에 훅 등록
        handle = self.model.avgpool.register_forward_hook(hook)
        
        with torch.no_grad():
            _ = self.model(input_tensor)
        
        handle.remove()
        return self.features

def extract_resnet_features_from_base64(base64_data):
    """Base64 이미지 데이터에서 ResNet50 특징을 추출합니다."""
    try:
        initialize_resnet()
        
        # Base64 디코딩
        image_data = base64.b64decode(base64_data)
        image = Image.open(io.BytesIO(image_data)).convert('RGB')
        
        # 전처리
        input_tensor = resnet_transform(image).unsqueeze(0)
        
        # 특징 추출
        feature_extractor = ResNetFeatureExtractor(resnet_model)
        features = feature_extractor.get_features(input_tensor)
        
        # 2048차원 벡터로 변환
        features_flat = features.view(-1).numpy()
        
        # print(f"[RESNET] Base64 이미지에서 특징 추출 완료: {len(features_flat)}차원")
        return features_flat
        
    except Exception as e:
        print(f"[ERROR] Base64 이미지 특징 추출 실패: {str(e)}")
        return None

def reduce_to_3d_with_umap(high_dim_vector, reference_vectors=None):
    """UMAP을 사용하여 고차원 벡터를 3차원으로 축소합니다."""
    try:
        if not UMAP_AVAILABLE:
            # print("[UMAP] UMAP 사용 불가, 폴백 방법 사용")
            return reduce_to_3d_fallback(high_dim_vector)
        
        if reference_vectors is None or len(reference_vectors) == 0:
            # print("[UMAP] 참조 벡터 없음, 폴백 방법 사용")
            return reduce_to_3d_fallback(high_dim_vector)
        
        # print(f"[UMAP] 3D 축소 시작: {len(high_dim_vector)}차원 -> 3차원")
        
        # 참조 벡터들과 함께 UMAP 적용
        all_vectors = reference_vectors + [high_dim_vector]
        all_vectors_array = np.array(all_vectors)
        
        # UMAP 설정
        reducer = umap.UMAP(
            n_components=3,
            n_neighbors=min(15, len(all_vectors) - 1),
            min_dist=0.1,
            metric='cosine',
            random_state=42
        )
        
        # 3D 축소
        reduced_vectors = reducer.fit_transform(all_vectors_array)
        
        # 마지막 벡터가 입력 벡터의 3D 좌표
        result_3d = reduced_vectors[-1].tolist()
        
        # print(f"[UMAP] 3D 축소 완료: {result_3d}")
        return result_3d
        
    except Exception as e:
        print(f"[ERROR] UMAP 축소 실패: {str(e)}, 폴백 방법 사용")
        return reduce_to_3d_fallback(high_dim_vector)

def reduce_to_3d_fallback(high_dim_vector):
    """UMAP이 사용 불가능할 때의 폴백 방법"""
    try:
        # 벡터를 3개 그룹으로 나누어 평균 계산
        vector_array = np.array(high_dim_vector)
        group_size = len(vector_array) // 3
        
        if group_size == 0:
            # 벡터가 너무 짧은 경우
            padded = np.pad(vector_array, (0, 3 - len(vector_array)), 'constant')
            return padded[:3].tolist()
        
        group1 = np.mean(vector_array[:group_size])
        group2 = np.mean(vector_array[group_size:2*group_size])
        group3 = np.mean(vector_array[2*group_size:])
        
        result = [float(group1), float(group2), float(group3)]
        # print(f"[FALLBACK] 3D 축소 완료: {result}")
        return result
        
    except Exception as e:
        print(f"[ERROR] 폴백 3D 축소 실패: {str(e)}")
        return [0.0, 0.0, 0.0]

def calculate_base64_image_vector(base64_data):
    """Base64 이미지 데이터에서 3차원 벡터를 계산합니다."""
    try:
        # print(f"[RESNET] Base64 이미지 벡터 계산 시작")
        
        # ResNet50 특징 추출
        features = extract_resnet_features_from_base64(base64_data)
        if features is None:
            # print(f"[ERROR] 특징 추출 실패")
            return None
        
        # 기존 벡터 데이터 로드 (참조용)
        vectors_path = os.path.join(VECTORS_DIR, "processed_vectors.json")
        reference_vectors = []
        
        if os.path.exists(vectors_path):
            try:
                with open(vectors_path, 'r', encoding='utf-8') as f:
                    existing_vectors = json.load(f)
                    # 3D 벡터들을 고차원으로 확장 (참조용)
                    reference_vectors = [v + [0.0] * (len(features) - len(v)) for v in existing_vectors if len(v) >= 3]
                # print(f"[RESNET] 참조 벡터 로드: {len(reference_vectors)}개")
            except Exception as e:
                print(f"[ERROR] 참조 벡터 로드 실패: {str(e)}")
        
        # 3차원으로 축소
        vector_3d = reduce_to_3d_with_umap(features.tolist(), reference_vectors)
        
        # print(f"[RESNET] Base64 이미지 3D 벡터 계산 완료: {vector_3d}")
        return vector_3d
        
    except Exception as e:
        print(f"[ERROR] Base64 이미지 벡터 계산 실패: {str(e)}")
        return None

@router.post("/process")
async def process_image(file: UploadFile = File(...)):
    try:
        # 파일 저장
        filename = file.filename
        file_path = os.path.join(PROCESS_DIR, filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        return {
            "status": "success",
            "message": "Image processed successfully",
            "filename": filename,
            "path": file_path
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list")
async def get_processed_images():
    try:
        # 처리된 이미지 목록 조회
        images = []
        for filename in os.listdir(PROCESS_DIR):
            if filename.endswith(('.jpg', '.jpeg', '.png')):
                images.append({
                    "filename": filename,
                    "path": os.path.join(PROCESS_DIR, filename),
                    "process_time": os.path.getctime(os.path.join(PROCESS_DIR, filename))
                })
        return {"status": "success", "images": images}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/similar-images-base64")
async def find_similar_images_base64(request_data: dict):
    """Base64 이미지 데이터를 받아서 유사 이미지를 검색합니다."""
    try:
        base64_data = request_data.get("image_data")
        filename = request_data.get("filename", "clipboard_image.png")
        
        if not base64_data:
            raise HTTPException(status_code=400, detail="image_data가 필요합니다")
        
        # print(f"[MAIN] Base64 유사 이미지 검색 시작: {filename}")
        
        # Base64 이미지에서 3D 벡터 계산
        uploaded_vector = calculate_base64_image_vector(base64_data)
        if uploaded_vector is None:
            raise HTTPException(status_code=500, detail="이미지 벡터 계산 실패")
        
        # print(f"[RESNET] 계산된 3D 벡터: {uploaded_vector}")
        
        # 기존 벡터 데이터 로드
        vectors_path = os.path.join(VECTORS_DIR, "processed_vectors.json")
        metadata_path = os.path.join(VECTORS_DIR, "processed_metadata.json")
        
        vectors = []
        metadata = []
        
        if os.path.exists(vectors_path) and os.path.exists(metadata_path):
            try:
                with open(vectors_path, 'r', encoding='utf-8') as f:
                    vectors = json.load(f)
                with open(metadata_path, 'r', encoding='utf-8') as f:
                    metadata = json.load(f)
                # print(f"[MAIN] 벡터 데이터 로드 완료: {len(vectors)}개 벡터, {len(metadata)}개 메타데이터")
            except Exception as e:
                print(f"[ERROR] 벡터 데이터 로드 실패: {str(e)}")
                raise HTTPException(status_code=500, detail="벡터 데이터 로드 실패")
        else:
            raise HTTPException(status_code=500, detail="벡터 데이터 파일이 없습니다")
        
        # 벡터 데이터 검증
        if not vectors or not metadata or len(vectors) != len(metadata):
            raise HTTPException(status_code=500, detail="벡터 데이터가 없거나 손상되었습니다")
        
        # 유사도 계산 함수
        def calculate_distance(vec1, vec2):
            """3D 벡터 거리 계산"""
            try:
                if len(vec1) != len(vec2):
                    return float('inf')
                
                # 3D 벡터인 경우 유클리드 거리 계산
                if len(vec1) == 3 and len(vec2) == 3:
                    distance = sum([(a - b) ** 2 for a, b in zip(vec1, vec2)]) ** 0.5
                    return distance
                
                return float('inf')
                
            except Exception as e:
                print(f"[ERROR] 거리 계산 오류: {str(e)}")
                return float('inf')
        
        # 모든 벡터와의 거리 계산
        distances = []
        for i, vector in enumerate(vectors):
            try:
                dist = calculate_distance(uploaded_vector, vector)
                filename_meta = metadata[i] if isinstance(metadata[i], str) else str(metadata[i])
                is_iapp = "_before" in filename_meta.lower() or "before" in filename_meta.lower()
                tag_type = "I-TAP" if is_iapp else "Analysis"
                
                distances.append({
                    "index": i,
                    "filename": filename_meta,
                    "distance": dist,
                    "tag_type": tag_type
                })
                
                # print(f"[RESNET] {filename_meta}: 거리={dist:.6f}, 태그={tag_type}")
                
            except Exception as calc_error:
                print(f"[ERROR] 거리 계산 오류 ({i}): {str(calc_error)}")
        
        # 거리 기준 정렬 (가까운 순)
        distances.sort(key=lambda x: x["distance"])
        # print(f"[RESNET] 거리 계산 완료: {len(distances)}개")
        
        # 상위 5개 출력
        # print(f"[RESNET] 상위 5개 가장 유사한 이미지:")
        for i, item in enumerate(distances[:5]):
            similarity = max(0, min(100, 100 * (1 / (1 + item["distance"]))))
            # print(f"  {i+1}. {item['filename']}: 거리={item['distance']:.6f}, 유사도={similarity:.2f}%, 태그={item['tag_type']}")
        
        # 태그별로 분류
        iapp_images = [item for item in distances if item["tag_type"] == "I-TAP"]
        analysis_images = [item for item in distances if item["tag_type"] == "Analysis"]
        
        # 각 태그별로 상위 3개씩 선택
        iapp_selected = iapp_images[:3]
        analysis_selected = analysis_images[:3]
        
        # 결과 병합
        similar_images = []
        
        # I-app 태그 이미지 추가
        for i, item in enumerate(iapp_selected):
            similarity = max(0, min(100, 100 * (1 / (1 + item["distance"]))))
            
            similar_images.append({
                "filename": item["filename"],
                "similarity": round(similarity, 2),
                "distance": round(item["distance"], 6),
                "index": item["index"],
                "tag_type": "I-TAP"
            })
        
        # Analysis 태그 이미지 추가
        for i, item in enumerate(analysis_selected):
            similarity = max(0, min(100, 100 * (1 / (1 + item["distance"]))))
            
            similar_images.append({
                "filename": item["filename"],
                "similarity": round(similarity, 2),
                "distance": round(item["distance"], 6),
                "index": item["index"],
                "tag_type": "Analysis"
            })
        
        # 전체 결과를 유사도 순으로 정렬
        similar_images.sort(key=lambda x: x["similarity"], reverse=True)
        
        # print(f"[RESNET] ✅ Base64 이미지 유사도 계산 완료: {len(similar_images)}개 결과")
        
        return {
            "status": "success",
            "message": "Base64 이미지 유사도 계산 완료",
            "filename": filename,
            "similar_images": similar_images,
            "uploaded_vector": uploaded_vector,
            "total_compared": len(distances)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"[ERROR] Base64 유사 이미지 검색 실패: {str(e)}\n{error_detail}")
        raise HTTPException(status_code=500, detail=str(e))

# 기존 유사 이미지 수신 엔드포인트 (MSA3에서 호출용)
@router.post("/receive-similar-image")
async def receive_similar_image(data: dict):
    """MSA3에서 전송한 유사 이미지 데이터를 수신합니다."""
    try:
        filename = data.get("filename")
        similarity = data.get("similarity")
        source_filename = data.get("source_filename")
        
        # print(f"[MSA2] 최유사 이미지 수신됨: {filename} (유사도: {similarity}%, 원본: {source_filename})")
        
        # 프론트엔드로 이벤트 전송 (WebSocket 또는 다른 방법으로 구현 가능)
        # 여기서는 로그만 출력
        
        return {
            "status": "success",
            "message": "유사 이미지 데이터 수신 완료",
            "received_data": data
        }
        
    except Exception as e:
        print(f"[ERROR] 유사 이미지 수신 실패: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) 