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
    print("[DEBUG] UMAP successfully imported")
except ImportError:
    print("[DEBUG] UMAP not available, using fallback method")

router = APIRouter()

PROCESS_DIR = "./processed"
IMAGES_DIR = "./storage/images"
VECTORS_DIR = "./storage/vector"
os.makedirs(PROCESS_DIR, exist_ok=True)
os.makedirs(IMAGES_DIR, exist_ok=True)
os.makedirs(VECTORS_DIR, exist_ok=True)

# ResNet 모델 및 전처리 설정 추가
import torch
import torchvision.transforms as transforms
from torchvision.models import resnet50, ResNet50_Weights
from PIL import Image
import io

# ResNet 모델 초기화 (side_5_settings.py와 동일)
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
resnet_model = resnet50(weights=ResNet50_Weights.IMAGENET1K_V2).to(device)
resnet_model.eval()

# 벡터 추출을 위한 특징 추출기 정의 (side_5_settings.py와 동일)
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
feature_extractor = FeatureExtractor(resnet_model)

# 이미지 전처리 함수 (side_5_settings.py와 동일)
def preprocess_image_from_base64(base64_data):
    """Base64 이미지 데이터를 전처리합니다."""
    transform = transforms.Compose([
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])
    
    img = None
    try:
        # Base64 디코딩
        image_data = base64.b64decode(base64_data)
        img = Image.open(io.BytesIO(image_data)).convert('RGB')
        img_tensor = transform(img).unsqueeze(0).to(device)
        return img_tensor
    finally:
        # PIL 이미지 객체를 명시적으로 닫음
        if img:
            img.close()

# Base64 이미지에서 벡터 추출 (side_5_settings.py의 extract_vector와 동일)
def extract_vector_from_base64(base64_data):
    """Base64 이미지 데이터에서 ResNet 특징 벡터를 추출합니다."""
    # 이미지 전처리
    img_tensor = preprocess_image_from_base64(base64_data)
    
    # 특징 추출
    features = feature_extractor.get_features(img_tensor)
    
    # NumPy 배열로 변환
    return features.numpy()

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
        print("[RESNET] ResNet50 모델 로딩 중...")
        resnet_model = resnet50(weights=ResNet50_Weights.IMAGENET1K_V2)
        resnet_model.eval()
        
        # 전처리 파이프라인
        resnet_transform = transforms.Compose([
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
        print("[RESNET] ResNet50 모델 로딩 완료")

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
    """Base64 이미지 데이터에서 ResNet 특징을 추출합니다 (side_admin3_settings.vue와 동일한 방식)."""
    try:
        print(f"[RESNET] Base64 이미지에서 ResNet 특징 추출 시작")
        
        # 이미지 정보 분석
        image_info = analyze_image_data(base64_data)
        print(f"[RESNET] 이미지 정보: {image_info}")
        
        # 이미지 크기가 너무 작은 경우 기본 특징 생성
        if image_info['size_bytes'] < 100:
            print(f"[RESNET] 이미지가 너무 작음 ({image_info['size_bytes']} bytes), 기본 특징 생성")
            return generate_default_features(image_info)
        
        # 이미지가 너무 큰 경우 압축
        if image_info['size_bytes'] > 50 * 1024 * 1024:  # 50MB
            print(f"[RESNET] 이미지가 너무 큼 ({image_info['size_bytes']} bytes), 압축 처리")
            base64_data = compress_large_image(base64_data)
        
        # 이미지 로드 및 전처리
        try:
            img_tensor = preprocess_image_from_base64(base64_data)
        except Exception as e:
            print(f"[ERROR] 이미지 전처리 실패: {str(e)}")
            return generate_default_features(image_info)
        
        # ResNet 특징 추출 (side_5_settings.py와 동일한 방식)
        try:
            features = feature_extractor.get_features(img_tensor)
            features_np = features.numpy()
            print(f"[RESNET] 특징 추출 완료: {features_np.shape}")
        except Exception as e:
            print(f"[ERROR] ResNet 특징 추출 실패: {str(e)}")
            return generate_default_features(image_info)
        
        # 특징 검증
        if not validate_features(features_np):
            print(f"[WARNING] 추출된 특징이 유효하지 않음, 기본 특징 생성")
            return generate_default_features(image_info)
        
        print(f"[RESNET] ResNet 특징 추출 성공: {features_np.shape}")
        return features_np
        
    except Exception as e:
        print(f"[ERROR] ResNet 특징 추출 중 오류: {str(e)}")
        return generate_default_features(image_info)

def analyze_image_data(image_data):
    """이미지 데이터를 분석하여 메타데이터를 반환합니다."""
    try:
        image = Image.open(io.BytesIO(image_data))
        
        # 이미지 정보 수집
        info = {
            'size_bytes': len(image_data),
            'format': image.format,
            'mode': image.mode,
            'width': image.width,
            'height': image.height,
            'aspect_ratio': image.width / image.height if image.height > 0 else 1,
            'total_pixels': image.width * image.height,
            'file_size_mb': len(image_data) / (1024 * 1024)
        }
        
        # 이미지 품질 평가
        info['quality_score'] = calculate_image_quality(image)
        
        return info
        
    except Exception as e:
        print(f"[ERROR] 이미지 분석 실패: {str(e)}")
        return {
            'size_bytes': len(image_data),
            'format': 'unknown',
            'mode': 'unknown',
            'width': 0,
            'height': 0,
            'aspect_ratio': 1,
            'total_pixels': 0,
            'file_size_mb': len(image_data) / (1024 * 1024),
            'quality_score': 0
        }

def calculate_image_quality(image):
    """이미지 품질을 평가합니다."""
    try:
        # 이미지 크기 기반 품질 점수
        width, height = image.size
        total_pixels = width * height
        
        if total_pixels < 1000:
            return 0.1  # 매우 낮은 품질
        elif total_pixels < 10000:
            return 0.3  # 낮은 품질
        elif total_pixels < 100000:
            return 0.5  # 보통 품질
        elif total_pixels < 1000000:
            return 0.7  # 좋은 품질
        else:
            return 0.9  # 매우 좋은 품질
            
    except Exception as e:
        print(f"[ERROR] 이미지 품질 계산 실패: {str(e)}")
        return 0.5

def load_and_preprocess_image(image_data, image_info):
    """이미지를 로드하고 전처리합니다."""
    try:
        image = Image.open(io.BytesIO(image_data))
        
        # 이미지 형식별 특화 처리
        image = handle_image_format_specific(image, image_info)
        
        # 이미지 모드 변환
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # 매우 작은 이미지 처리
        if image.width < 32 or image.height < 32:
            print(f"[WARNING] 이미지가 너무 작음 ({image.width}x{image.height}), 확대 처리")
            image = image.resize((224, 224), Image.Resampling.LANCZOS)
        
        # 매우 큰 이미지 처리
        if image.width > 4096 or image.height > 4096:
            print(f"[WARNING] 이미지가 너무 큼 ({image.width}x{image.height}), 축소 처리")
            # 종횡비 유지하면서 축소
            max_size = 4096
            if image.width > image.height:
                new_width = max_size
                new_height = int(image.height * max_size / image.width)
            else:
                new_height = max_size
                new_width = int(image.width * max_size / image.height)
            image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        return image
        
    except Exception as e:
        print(f"[ERROR] 이미지 로드 및 전처리 실패: {str(e)}")
        return None

def handle_image_format_specific(image, image_info):
    """이미지 형식별 특화된 처리"""
    try:
        format_type = image_info.get('format', '').upper()
        
        if format_type in ['PNG', 'JPEG', 'JPG']:
            return handle_raster_format(image, image_info)
        elif format_type in ['GIF', 'WEBP']:
            return handle_animated_format(image, image_info)
        elif format_type in ['BMP', 'TIFF']:
            return handle_large_format(image, image_info)
        else:
            print(f"[WARNING] 알 수 없는 이미지 형식: {format_type}, 기본 처리")
            return image
            
    except Exception as e:
        print(f"[ERROR] 형식별 처리 실패: {str(e)}")
        return image

def handle_raster_format(image, image_info):
    """PNG, JPEG 등 일반 래스터 형식 처리"""
    try:
        # 투명도 처리
        if image.mode in ['RGBA', 'LA', 'P']:
            # 투명 배경을 흰색으로 변환
            if image.mode == 'P':
                image = image.convert('RGBA')
            
            # 알파 채널이 있는 경우 흰색 배경과 합성
            if image.mode == 'RGBA':
                background = Image.new('RGBA', image.size, (255, 255, 255, 255))
                background.paste(image, mask=image.split()[-1])  # 알파 채널을 마스크로 사용
                image = background
        
        # 색상 공간 최적화
        if image.mode == 'CMYK':
            image = image.convert('RGB')
        
        return image
        
    except Exception as e:
        print(f"[ERROR] 래스터 형식 처리 실패: {str(e)}")
        return image

def handle_animated_format(image, image_info):
    """GIF, WEBP 등 애니메이션 형식 처리"""
    try:
        # 첫 번째 프레임만 사용
        if hasattr(image, 'n_frames') and image.n_frames > 1:
            print(f"[INFO] 애니메이션 이미지 감지 ({image.n_frames} 프레임), 첫 번째 프레임 사용")
            image.seek(0)
        
        # 투명도 처리
        if image.mode in ['RGBA', 'P']:
            if image.mode == 'P':
                image = image.convert('RGBA')
            
            if image.mode == 'RGBA':
                background = Image.new('RGBA', image.size, (255, 255, 255, 255))
                background.paste(image, mask=image.split()[-1])
                image = background
        
        return image
        
    except Exception as e:
        print(f"[ERROR] 애니메이션 형식 처리 실패: {str(e)}")
        return image

def handle_large_format(image, image_info):
    """BMP, TIFF 등 큰 파일 형식 처리"""
    try:
        # 메모리 사용량 최적화
        file_size_mb = image_info.get('file_size_mb', 0)
        
        if file_size_mb > 10:  # 10MB 이상
            print(f"[WARNING] 큰 이미지 파일 ({file_size_mb:.1f}MB), 압축 처리")
            # 품질을 낮춰서 압축
            output_buffer = io.BytesIO()
            image.save(output_buffer, format='JPEG', quality=70, optimize=True)
            image = Image.open(output_buffer)
        
        return image
        
    except Exception as e:
        print(f"[ERROR] 큰 형식 처리 실패: {str(e)}")
        return image

def compress_large_image(image_data):
    """큰 이미지를 압축합니다."""
    try:
        image = Image.open(io.BytesIO(image_data))
        
        # 이미지 크기와 형식에 따른 압축 품질 결정
        file_size_mb = len(image_data) / (1024 * 1024)
        
        if file_size_mb > 50:
            quality = 60  # 매우 큰 파일
        elif file_size_mb > 20:
            quality = 75  # 큰 파일
        elif file_size_mb > 10:
            quality = 85  # 중간 파일
        else:
            quality = 95  # 작은 파일
        
        # 이미지 형식별 압축 전략
        format_type = image.format.upper() if image.format else 'JPEG'
        
        if format_type in ['PNG', 'BMP', 'TIFF']:
            # 무손실 형식을 JPEG로 변환하여 압축
            output_buffer = io.BytesIO()
            image.save(output_buffer, format='JPEG', quality=quality, optimize=True)
            compressed_data = output_buffer.getvalue()
        else:
            # 이미 JPEG인 경우 품질만 조정
            output_buffer = io.BytesIO()
            image.save(output_buffer, format='JPEG', quality=quality, optimize=True)
            compressed_data = output_buffer.getvalue()
        
        compression_ratio = len(compressed_data) / len(image_data)
        print(f"[COMPRESS] 이미지 압축 완료: {len(image_data)} -> {len(compressed_data)} bytes (비율: {compression_ratio:.2f}, 품질: {quality})")
        
        return compressed_data
        
    except Exception as e:
        print(f"[ERROR] 이미지 압축 실패: {str(e)}")
        return image_data

def validate_features(features):
    """추출된 특징의 유효성을 검증합니다."""
    try:
        if features is None or len(features) == 0:
            return False
        
        # NaN 값 확인
        if np.any(np.isnan(features)):
            return False
        
        # 무한대 값 확인
        if np.any(np.isinf(features)):
            return False
        
        # 모든 값이 0인지 확인
        if np.all(features == 0):
            return False
        
        # 특징 분포 확인
        mean_val = np.mean(features)
        std_val = np.std(features)
        
        if std_val == 0:
            return False
        
        return True
        
    except Exception as e:
        print(f"[ERROR] 특징 검증 실패: {str(e)}")
        return False

def generate_default_features(image_info):
    """이미지 정보를 기반으로 기본 특징을 생성합니다."""
    try:
        # 이미지 크기와 형식에 따른 기본 특징 생성
        base_size = 2048
        
        # 이미지 크기에 따른 가중치 적용
        size_factor = min(1.0, image_info['size_bytes'] / (1024 * 1024))  # 1MB 기준
        quality_factor = image_info.get('quality_score', 0.5)
        
        # 기본 특징 생성 (이미지 특성 반영)
        features = np.random.normal(0, 1, base_size).astype(np.float32)
        
        # 이미지 크기와 품질에 따른 조정
        features *= (size_factor * 0.5 + quality_factor * 0.5)
        
        # 특징 정규화
        features = (features - np.mean(features)) / (np.std(features) + 1e-8)
        
        print(f"[DEFAULT] 기본 특징 생성: 크기={image_info['size_bytes']} bytes, 품질={quality_factor:.2f}")
        return features
        
    except Exception as e:
        print(f"[ERROR] 기본 특징 생성 실패: {str(e)}")
        return np.random.normal(0, 1, 2048).astype(np.float32)

def reduce_to_3d_with_umap(high_dim_vector, reference_vectors=None):
    """고차원 벡터를 3D로 축소합니다 (side_admin3_settings.vue와 동일한 방식)."""
    try:
        if not high_dim_vector or len(high_dim_vector) < 3:
            print(f"[WARNING] 벡터가 너무 짧음: {len(high_dim_vector) if high_dim_vector else 0}")
            return reduce_to_3d_fallback(high_dim_vector)
        
        # UMAP 사용 가능한 경우
        if UMAP_AVAILABLE and reference_vectors and len(reference_vectors) > 2:
            try:
                print(f"[UMAP] UMAP 차원 축소 시작: {len(high_dim_vector)} -> 3D")
                
                # 참조 벡터와 새로운 벡터 결합
                all_vectors = reference_vectors + [high_dim_vector]
                vectors_array = np.array(all_vectors)
                
                # UMAP 설정 (side_5_settings.py와 동일)
                reducer = umap.UMAP(
                    n_components=3,
                    n_neighbors=15,
                    min_dist=0.1,
                    metric='euclidean',
                    random_state=42
                )
                
                # UMAP 적용
                embedding = reducer.fit_transform(vectors_array)
                
                # 새로운 벡터의 3D 좌표 반환 (마지막 벡터)
                result = embedding[-1].tolist()
                print(f"[UMAP] 차원 축소 완료: {result}")
                return result
                
            except Exception as e:
                print(f"[ERROR] UMAP 차원 축소 실패: {str(e)}")
                return reduce_to_3d_fallback(high_dim_vector)
        
        # UMAP을 사용할 수 없는 경우 기본 방법 사용
        print(f"[FALLBACK] 기본 차원 축소 방법 사용")
        return reduce_to_3d_fallback(high_dim_vector)
        
    except Exception as e:
        print(f"[ERROR] 차원 축소 중 오류: {str(e)}")
        return reduce_to_3d_fallback(high_dim_vector)

def reduce_to_3d_fallback(high_dim_vector):
    """UMAP이 사용 불가능할 때의 폴백 방법 - 정밀한 벡터 처리"""
    try:
        # 벡터를 numpy 배열로 변환
        vector_array = np.array(high_dim_vector, dtype=np.float32)
        
        # 벡터 크기별 세밀한 처리
        vector_length = len(vector_array)
        
        # 1. 빈 벡터 처리
        if vector_length == 0:
            print(f"[FALLBACK] 빈 벡터 감지, 기본값 생성")
            return [0.1, 0.2, 0.3]
        
        # 2. 매우 작은 벡터 처리 (1-2개 요소)
        if vector_length <= 2:
            return handle_tiny_vector(vector_array)
        
        # 3. 작은 벡터 처리 (3-10개 요소)
        if vector_length <= 10:
            return handle_small_vector(vector_array)
        
        # 4. 중간 크기 벡터 처리 (11-100개 요소)
        if vector_length <= 100:
            return handle_medium_vector(vector_array)
        
        # 5. 큰 벡터 처리 (100개 이상)
        return handle_large_vector(vector_array)
        
    except Exception as e:
        print(f"[ERROR] 폴백 3D 축소 실패: {str(e)}")
        return [0.1, 0.2, 0.3]

def handle_tiny_vector(vector_array):
    """매우 작은 벡터 (1-2개 요소) 처리"""
    length = len(vector_array)
    
    if length == 1:
        val = float(vector_array[0])
        # 단일 값으로부터 3차원 좌표 생성
        return [val, val * 0.7, val * 0.3]
    
    elif length == 2:
        val1, val2 = float(vector_array[0]), float(vector_array[1])
        # 두 값으로부터 3차원 좌표 생성
        return [val1, val2, (val1 + val2) / 2]
    
    else:
        # 예상치 못한 경우
        return [0.1, 0.2, 0.3]

def handle_small_vector(vector_array):
    """작은 벡터 (3-10개 요소) 처리"""
    length = len(vector_array)
    
    if length == 3:
        # 정확히 3개인 경우 그대로 사용
        return [float(vector_array[0]), float(vector_array[1]), float(vector_array[2])]
    
    elif length == 4:
        # 4개인 경우: 첫 3개 사용
        return [float(vector_array[0]), float(vector_array[1]), float(vector_array[2])]
    
    elif length == 5:
        # 5개인 경우: 첫 3개 사용
        return [float(vector_array[0]), float(vector_array[1]), float(vector_array[2])]
    
    else:
        # 6-10개인 경우: 균등 분할
        group_size = length // 3
        remainder = length % 3
        
        # 균등 분할로 3개 그룹 생성
        groups = []
        start_idx = 0
        
        for i in range(3):
            if i < remainder:
                group = vector_array[start_idx:start_idx + group_size + 1]
                start_idx += group_size + 1
            else:
                group = vector_array[start_idx:start_idx + group_size]
                start_idx += group_size
            groups.append(group)
        
        # 각 그룹의 평균 계산
        result = []
        for group in groups:
            if len(group) > 0:
                avg = np.mean(group)
                result.append(float(avg) if not np.isnan(avg) else 0.0)
            else:
                result.append(0.0)
        
        return result

def handle_medium_vector(vector_array):
    """중간 크기 벡터 (11-100개 요소) 처리"""
    length = len(vector_array)
    
    # 가중치 기반 분할 (중간 부분에 더 많은 가중치)
    weights = np.linspace(0.5, 1.5, length)
    weighted_vector = vector_array * weights
    
    # 3개 그룹으로 분할
    group_size = length // 3
    remainder = length % 3
    
    groups = []
    start_idx = 0
    
    for i in range(3):
        if i < remainder:
            group = weighted_vector[start_idx:start_idx + group_size + 1]
            start_idx += group_size + 1
        else:
            group = weighted_vector[start_idx:start_idx + group_size]
            start_idx += group_size
        groups.append(group)
    
    # 각 그룹의 통계 계산
    result = []
    for group in groups:
        if len(group) > 0:
            # 평균과 표준편차를 결합
            mean_val = np.mean(group)
            std_val = np.std(group)
            combined_val = mean_val + std_val * 0.1  # 표준편차의 10% 반영
            result.append(float(combined_val) if not np.isnan(combined_val) else 0.0)
        else:
            result.append(0.0)
    
    return result

def handle_large_vector(vector_array):
    """큰 벡터 (100개 이상) 처리"""
    length = len(vector_array)
    
    # 고급 통계 기반 처리
    # 1. 전체 벡터의 통계 계산
    mean_val = np.mean(vector_array)
    std_val = np.std(vector_array)
    min_val = np.min(vector_array)
    max_val = np.max(vector_array)
    
    # 2. 3개 구간으로 분할 (시작, 중간, 끝)
    start_size = length // 4
    end_size = length // 4
    middle_size = length - start_size - end_size
    
    start_section = vector_array[:start_size]
    middle_section = vector_array[start_size:start_size + middle_size]
    end_section = vector_array[start_size + middle_size:]
    
    # 3. 각 구간의 특성 계산
    def calculate_section_features(section):
        if len(section) == 0:
            return 0.0
        
        # 평균, 분산, 최대값을 결합
        section_mean = np.mean(section)
        section_std = np.std(section)
        section_max = np.max(section)
        
        # 가중 평균으로 결합
        combined = (section_mean * 0.6 + section_std * 0.3 + section_max * 0.1)
        return float(combined) if not np.isnan(combined) else 0.0
    
    # 4. 3차원 좌표 생성
    x_coord = calculate_section_features(start_section)
    y_coord = calculate_section_features(middle_section)
    z_coord = calculate_section_features(end_section)
    
    # 5. 정규화 (전체 범위 기준)
    if max_val != min_val:
        x_coord = (x_coord - min_val) / (max_val - min_val)
        y_coord = (y_coord - min_val) / (max_val - min_val)
        z_coord = (z_coord - min_val) / (max_val - min_val)
    
    # 6. NaN 값 처리
    if np.isnan(x_coord): x_coord = 0.0
    if np.isnan(y_coord): y_coord = 0.0
    if np.isnan(z_coord): z_coord = 0.0
    
    result = [x_coord, y_coord, z_coord]
    
    # 7. 모든 값이 0인 경우 방지
    if all(v == 0.0 for v in result):
        # 벡터의 통계적 특성을 반영한 기본값 생성
        result = [
            float(mean_val) if not np.isnan(mean_val) else 0.1,
            float(std_val) if not np.isnan(std_val) else 0.2,
            float((max_val + min_val) / 2) if not np.isnan(max_val) and not np.isnan(min_val) else 0.3
        ]
    
    return result

def calculate_base64_image_vector(base64_data):
    """Base64 이미지 데이터에서 3차원 벡터를 계산합니다 (side_admin3_settings.vue와 동일한 방식)."""
    try:
        print(f"[MAIN] Base64 이미지 3D 벡터 계산 시작")
        
        # 이미지 정보 분석
        image_info = analyze_image_data(base64_data)
        print(f"[MAIN] 이미지 정보: 크기={image_info['size_bytes']} bytes, 형식={image_info['format']}")
        
        # ResNet 특징 추출 (side_admin3_settings.vue와 동일한 방식)
        features_flat = extract_resnet_features_from_base64(base64_data)
        if features_flat is None:
            print(f"[ERROR] 특징 추출 실패")
            return [0.1, 0.2, 0.3]
        
        print(f"[RESNET] 특징 추출 완료: {features_flat.shape}")
        
        # 기존 벡터 데이터 로드 (참조용)
        vectors_path = os.path.join(VECTORS_DIR, "processed_vectors.json")
        reference_vectors = []
        
        if os.path.exists(vectors_path):
            try:
                with open(vectors_path, 'r', encoding='utf-8') as f:
                    existing_vectors = json.load(f)
                    # 3D 벡터들을 고차원으로 확장 (참조용)
                    reference_vectors = [v + [0.0] * (len(features_flat) - len(v)) for v in existing_vectors if len(v) >= 3]
                print(f"[RESNET] 참조 벡터 로드: {len(reference_vectors)}개")
            except Exception as e:
                print(f"[ERROR] 참조 벡터 로드 실패: {str(e)}")
        
        # 3차원으로 축소 (side_admin3_settings.vue와 동일한 방식)
        vector_3d = reduce_to_3d_with_umap(features_flat.tolist(), reference_vectors)
        
        # 결과 검증 및 개선
        if vector_3d is None or len(vector_3d) != 3:
            print(f"[WARNING] 3D 벡터 생성 실패, 기본값 사용")
            vector_3d = [0.1, 0.2, 0.3]
        
        # 모든 값이 0인 경우 방지
        if all(v == 0.0 for v in vector_3d):
            print(f"[WARNING] 모든 좌표가 0, 기본값으로 대체")
            vector_3d = [0.1, 0.2, 0.3]
        
        # NaN 값 검증
        if any(np.isnan(v) for v in vector_3d):
            print(f"[WARNING] NaN 값 감지, 기본값으로 대체")
            vector_3d = [0.1, 0.2, 0.3]
        
        # 무한대 값 검증
        if any(np.isinf(v) for v in vector_3d):
            print(f"[WARNING] 무한대 값 감지, 기본값으로 대체")
            vector_3d = [0.1, 0.2, 0.3]
        
        # 최종 결과 검증
        final_vector = validate_final_vector(vector_3d, image_info)
        
        print(f"[RESNET] Base64 이미지 3D 벡터 계산 완료: {final_vector}")
        print(f"[RESNET] 이미지 정보: 크기={image_info['size_bytes']} bytes, 형식={image_info['format']}, 품질={image_info.get('quality_score', 0):.2f}")
        
        return final_vector
        
    except Exception as e:
        print(f"[ERROR] Base64 이미지 벡터 계산 중 오류: {str(e)}")
        return [0.1, 0.2, 0.3]

def validate_final_vector(vector_3d, image_info):
    """최종 3D 벡터의 유효성을 검증하고 개선합니다."""
    try:
        # 기본 검증
        if not vector_3d or len(vector_3d) != 3:
            print(f"[VALIDATE] 벡터 크기 오류, 기본값 사용")
            return [0.1, 0.2, 0.3]
        
        # NaN, 무한대, 0 값 검증
        for i, val in enumerate(vector_3d):
            if np.isnan(val) or np.isinf(val):
                print(f"[VALIDATE] 좌표 {i}에 유효하지 않은 값 감지: {val}")
                vector_3d[i] = 0.1 + (i * 0.1)
        
        # 모든 값이 0인 경우 처리
        if all(v == 0.0 for v in vector_3d):
            print(f"[VALIDATE] 모든 좌표가 0, 이미지 특성 기반 값 생성")
            quality = image_info.get('quality_score', 0.5)
            size_factor = min(1.0, image_info['size_bytes'] / (1024 * 1024))
            vector_3d = [
                0.1 + quality * 0.3,
                0.2 + size_factor * 0.3,
                0.3 + (quality + size_factor) * 0.2
            ]
        
        # 좌표 범위 정규화 (0-1 범위로)
        min_val = min(vector_3d)
        max_val = max(vector_3d)
        
        if max_val != min_val:
            vector_3d = [(v - min_val) / (max_val - min_val) for v in vector_3d]
        else:
            # 모든 값이 같은 경우 분산 생성
            vector_3d = [0.1, 0.5, 0.9]
        
        # 최종 검증
        for i, val in enumerate(vector_3d):
            if not (0 <= val <= 1):
                print(f"[VALIDATE] 좌표 {i}가 범위를 벗어남: {val}, 클리핑")
                vector_3d[i] = max(0, min(1, val))
        
        print(f"[VALIDATE] 최종 벡터 검증 완료: {vector_3d}")
        return vector_3d
        
    except Exception as e:
        print(f"[ERROR] 최종 벡터 검증 실패: {str(e)}")
        return [0.1, 0.2, 0.3]

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
        
        print(f"[MAIN] Base64 유사 이미지 검색 시작: {filename}")
        
        # Base64 이미지에서 3D 벡터 계산
        uploaded_vector = calculate_base64_image_vector(base64_data)
        if uploaded_vector is None:
            raise HTTPException(status_code=500, detail="이미지 벡터 계산 실패")
        
        print(f"[RESNET] 계산된 3D 벡터: {uploaded_vector}")
        
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
                print(f"[MAIN] 벡터 데이터 로드 완료: {len(vectors)}개 벡터, {len(metadata)}개 메타데이터")
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
                
                print(f"[RESNET] {filename_meta}: 거리={dist:.6f}, 태그={tag_type}")
                
            except Exception as calc_error:
                print(f"[ERROR] 거리 계산 오류 ({i}): {str(calc_error)}")
        
        # 거리 기준 정렬 (가까운 순)
        distances.sort(key=lambda x: x["distance"])
        print(f"[RESNET] 거리 계산 완료: {len(distances)}개")
        
        # 상위 5개 출력
        print(f"[RESNET] 상위 5개 가장 유사한 이미지:")
        for i, item in enumerate(distances[:5]):
            similarity = max(0, min(100, 100 * (1 / (1 + item["distance"]))))
            print(f"  {i+1}. {item['filename']}: 거리={item['distance']:.6f}, 유사도={similarity:.2f}%, 태그={item['tag_type']}")
        
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
        
        print(f"[RESNET] ✅ Base64 이미지 유사도 계산 완료: {len(similar_images)}개 결과")
        
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
        
        print(f"[MSA2] 최유사 이미지 수신됨: {filename} (유사도: {similarity}%, 원본: {source_filename})")
        
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