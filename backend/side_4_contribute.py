from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
import os
import shutil
from pathlib import Path
import base64
from typing import Optional
import json
import torch
from torchvision import transforms
from torchvision.models import resnet50, ResNet50_Weights
from PIL import Image
import numpy as np

router = APIRouter()

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

@router.post("/submit-analysis")
async def submit_analysis(
    analysis_title: str = Form(...),
    target_image: str = Form(...),
    result_image: str = Form(...),
    analysis_content: str = Form(...)
):
    try:
        # 저장 디렉토리 생성
        save_dir = Path("D:/image_set_url/additional_images")
        save_dir.mkdir(parents=True, exist_ok=True)
        
        # 파일명에서 사용할 수 없는 문자 제거 및 안전한 파일명 생성
        safe_title = "".join(c for c in analysis_title if c.isalnum() or c in (' ', '-', '_')).rstrip()
        safe_title = safe_title.replace(' ', '_')
        
        # 파일 경로 설정
        base_path = save_dir / safe_title
        target_path = base_path.with_suffix('.png')
        result_path = save_dir / f"{safe_title}_whole.png"
        content_path = base_path.with_suffix('.txt')
        
        # 중복 파일 검사 - 더 명확한 메시지
        duplicate_files = []
        if target_path.exists():
            duplicate_files.append(f"대상 이미지: {target_path.name}")
        if result_path.exists():
            duplicate_files.append(f"분석 결과 이미지: {result_path.name}")
        if content_path.exists():
            duplicate_files.append(f"분석 내용: {content_path.name}")
        
        if duplicate_files:
            error_message = f"다음 파일들이 이미 존재합니다:\n" + "\n".join(duplicate_files) + f"\n\n분석 제목 '{analysis_title}'을(를) 다른 이름으로 변경해주세요."
            raise HTTPException(status_code=400, detail=error_message)
        
        # 1. 대상 이미지 저장
        if target_image.startswith('data:image'):
            # base64 데이터에서 이미지 부분 추출
            image_data = target_image.split(',')[1]
            image_bytes = base64.b64decode(image_data)
            
            with open(target_path, 'wb') as f:
                f.write(image_bytes)
        else:
            raise HTTPException(status_code=400, detail="Invalid target image format")
        
        # 2. 분석 결과 이미지 저장
        if result_image.startswith('data:image'):
            # base64 데이터에서 이미지 부분 추출
            image_data = result_image.split(',')[1]
            image_bytes = base64.b64decode(image_data)
            
            with open(result_path, 'wb') as f:
                f.write(image_bytes)
        else:
            raise HTTPException(status_code=400, detail="Invalid result image format")
        
        # 3. 분석 내용 텍스트 저장
        with open(content_path, 'w', encoding='utf-8') as f:
            f.write(analysis_content)
        
        # 4. 이미지 로드 및 벡터 변환 API 호출 (admin/settings와 동일)
        try:
            await process_images_for_vector_conversion(save_dir)
        except Exception as vector_error:
            print(f"벡터 변환 중 오류 발생: {str(vector_error)}")
            # 벡터 변환 실패해도 파일 저장은 성공으로 처리
        
        return JSONResponse({
            "success": True,
            "message": "분석 결과가 성공적으로 저장되었습니다.",
            "files": {
                "target_image": str(target_path),
                "result_image": str(result_path),
                "content": str(content_path)
            }
        })
        
    except HTTPException:
        # HTTPException은 그대로 재발생
        raise
    except Exception as e:
        # 기타 예외는 일반적인 오류로 처리
        print(f"Unexpected error in submit_analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"저장 중 오류가 발생했습니다: {str(e)}")

async def process_images_for_vector_conversion(image_dir: Path):
    """
    admin/settings의 이미지 로드 및 벡터 변환과 동일한 로직
    """
    try:
        # 이미지 파일들 찾기
        image_files = list(image_dir.glob("*.png")) + list(image_dir.glob("*.jpg")) + list(image_dir.glob("*.jpeg"))
        
        if not image_files:
            print("No images found for vector conversion")
            return True
        
        print(f"Found {len(image_files)} images for vector conversion")
        
        # 벡터 저장 디렉토리 설정
        storage_dir = Path("./storage")
        vectors_dir = storage_dir / "vector"
        images_dir = storage_dir / "images"
        
        os.makedirs(storage_dir, exist_ok=True)
        os.makedirs(vectors_dir, exist_ok=True)
        os.makedirs(images_dir, exist_ok=True)
        
        processed_images = []
        vectors = []
        metadata = []
        
        for image_file in image_files:
            try:
                print(f"Processing image: {image_file}")
                
                # 이미지를 스토리지에 복사
                destination_path = images_dir / image_file.name
                shutil.copy2(image_file, destination_path)
                
                # 벡터 추출
                vector = extract_vector(image_file)
                vectors.append(vector.tolist())
                metadata.append(image_file.name)
                
                processed_images.append({
                    "original_path": str(image_file),
                    "stored_filename": image_file.name,
                    "stored_path": f"/api/imageanalysis/images/{image_file.name}",
                    "tag": "contribute"
                })
                
                print(f"Successfully processed: {image_file.name}")
                
            except Exception as e:
                print(f"Error processing image {image_file.name}: {str(e)}")
                continue
        
        # 벡터 데이터 저장
        if vectors and metadata:
            processed_vectors_path = vectors_dir / "processed_vectors.json"
            processed_metadata_path = vectors_dir / "processed_metadata.json"
            
            # 기존 데이터가 있으면 로드하여 병합
            existing_vectors = []
            existing_metadata = []
            
            if processed_vectors_path.exists() and processed_metadata_path.exists():
                try:
                    with open(processed_vectors_path, 'r') as f:
                        existing_vectors = json.load(f)
                    with open(processed_metadata_path, 'r') as f:
                        existing_metadata = json.load(f)
                except:
                    pass
            
            # 새 데이터와 기존 데이터 병합
            all_vectors = existing_vectors + vectors
            all_metadata = existing_metadata + metadata
            
            # 저장
            with open(processed_vectors_path, 'w', encoding='utf-8') as f:
                json.dump(all_vectors, f, ensure_ascii=False, indent=2)
            
            with open(processed_metadata_path, 'w', encoding='utf-8') as f:
                json.dump(all_metadata, f, ensure_ascii=False, indent=2)
            
            print(f"Saved {len(all_vectors)} total vectors (including {len(vectors)} new ones)")
        
        print(f"Vector conversion completed: {len(processed_images)} images processed")
        return True
        
    except Exception as e:
        print(f"Vector conversion error: {e}")
        return False 