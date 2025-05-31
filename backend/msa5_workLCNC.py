from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import Response, JSONResponse
from typing import Dict, Any, List, Optional
import base64
import io
import json
import os
import cv2
import numpy as np
import requests
from PIL import Image, ImageOps, ImageEnhance, ImageFilter
from datetime import datetime
import math

router = APIRouter()

# 결과 저장 디렉토리 설정
PROCESSED_DIR = "./processed"
os.makedirs(PROCESSED_DIR, exist_ok=True)

# 유틸리티 함수
def decode_image(image_data):
    """바이너리 이미지 데이터를 PIL 이미지로 변환"""
    return Image.open(io.BytesIO(image_data))

def encode_image_to_bytes(image, format=None):
    """PIL 이미지를 바이너리로 변환"""
    buffered = io.BytesIO()
    
    # 원본 이미지 형식 감지 (format 파라미터가 없는 경우)
    if format is None:
        # 이미지에 format 속성이 있으면 사용
        if hasattr(image, 'format') and image.format:
            format = image.format
        else:
            # 기본값은 PNG
            format = "PNG"
    
    # 이미지 저장 - 감지된 또는 지정된 형식 사용
    image.save(buffered, format=format)
    return buffered.getvalue()

def pil_to_cv2(pil_image):
    """PIL 이미지를 OpenCV 형식으로 변환"""
    open_cv_image = np.array(pil_image.convert('RGB'))
    # RGB to BGR
    open_cv_image = open_cv_image[:, :, ::-1].copy() 
    return open_cv_image

def cv2_to_pil(cv_image):
    """OpenCV 이미지를 PIL 형식으로 변환"""
    # BGR to RGB
    rgb_image = cv_image[:, :, ::-1]
    return Image.fromarray(rgb_image)

# 객체 감지를 위한 외부 ML API 호출 (예시)
@router.post("/object-detection")
async def process_object_detection(image: UploadFile = File(...), params: str = Form(...)):
    """외부 ML API를 통한 객체 감지 처리"""
    params = json.loads(params)
    
    try:
        # 이미지 데이터 읽기
        image_data = await image.read()
        img = decode_image(image_data)
        
        # 파라미터 추출
        confidence_threshold = params.get("confidence", 0.5)
        model_type = params.get("model", "yolov5")
        
        # 이미지를 base64로 인코딩
        buffered = io.BytesIO()
        img.save(buffered, format="JPEG")
        img_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
        
        # 로깅
        print(f"[외부 API] 객체 감지 요청 준비: 모델={model_type}, 신뢰도 임계값={confidence_threshold}")
        
        # 외부 API 엔드포인트 (예시)
        # 실제로는 환경 변수나 설정 파일에서 로드하는 것이 좋습니다
        api_endpoint = "https://api.example.com/object-detection"
        api_key = "YOUR_API_KEY"  # 실제 키로 대체해야 함
        
        # API 요청 데이터 준비
        api_payload = {
            "image": img_base64,
            "model": model_type,
            "confidence_threshold": confidence_threshold
        }
        
        # API 헤더 준비
        api_headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        
        # 실제 외부 API 호출 (예시 - 실제 구현 시 활성화)
        # response = requests.post(api_endpoint, json=api_payload, headers=api_headers)
        # response.raise_for_status()  # HTTP 오류 발생시 예외 발생
        # result = response.json()
        
        # 테스트용 응답 모의 (외부 API 연동 없이 예시로 반환)
        objects = [
            {"class": "person", "confidence": 0.92, "bbox": [10, 20, 100, 200]},
            {"class": "car", "confidence": 0.87, "bbox": [150, 30, 250, 120]},
            {"class": "dog", "confidence": 0.78, "bbox": [300, 250, 450, 380]}
        ]
        
        # 감지된 객체 시각화 (테스트용)
        cv_image = pil_to_cv2(img)
        for obj in objects:
            if obj["confidence"] >= confidence_threshold:
                label = f"{obj['class']} ({obj['confidence']:.2f})"
                x1, y1, x2, y2 = obj["bbox"]
                
                # OpenCV로 바운딩 박스 그리기
                cv2.rectangle(cv_image, (x1, y1), (x2, y2), (0, 255, 0), 2)
                cv2.putText(cv_image, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
        
        # 결과 이미지 변환
        result_img = cv2_to_pil(cv_image)
        
        # 처리 정보 로깅
        print(f"객체 감지 결과: {len(objects)} 객체 감지됨")
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes = encode_image_to_bytes(result_img)
        return Response(content=img_bytes, media_type="image/png", 
                        headers={"X-Process-Status": "success", "X-Detected-Objects": json.dumps(objects)})
    except Exception as e:
        print(f"객체 감지 오류: {str(e)}")
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": str(e)}
        )

# 이미지 스타일 전이를 위한 외부 API 호출 (예시)
@router.post("/style-transfer")
async def process_style_transfer(image: UploadFile = File(...), style_image: UploadFile = File(None), params: str = Form(...)):
    """외부 ML API를 통한 스타일 전이 처리"""
    params = json.loads(params)
    
    try:
        # 컨텐츠 이미지 데이터 읽기
        content_image_data = await image.read()
        content_img = decode_image(content_image_data)
        original_format = content_img.format  # 원본 이미지 형식 저장
        
        # 파라미터 추출
        style_strength = params.get("strength", 0.8)
        style_name = params.get("style", "starry_night")
        
        # 스타일 이미지가 제공된 경우
        style_img_base64 = None
        if style_image:
            style_image_data = await style_image.read()
            style_img = decode_image(style_image_data)
            
            # 스타일 이미지를 base64로 인코딩
            style_buffered = io.BytesIO()
            style_img.save(style_buffered, format="JPEG")
            style_img_base64 = base64.b64encode(style_buffered.getvalue()).decode('utf-8')
        
        # 컨텐츠 이미지를 base64로 인코딩
        content_buffered = io.BytesIO()
        content_img.save(content_buffered, format="JPEG")
        content_img_base64 = base64.b64encode(content_buffered.getvalue()).decode('utf-8')
        
        # 로깅
        print(f"[외부 API] 스타일 전이 요청 준비: 스타일={style_name}, 강도={style_strength}")
        
        # 외부 API 엔드포인트 (예시)
        api_endpoint = "https://api.example.com/style-transfer"
        api_key = "YOUR_API_KEY"  # 실제 키로 대체해야 함
        
        # API 요청 데이터 준비
        api_payload = {
            "content_image": content_img_base64,
            "style_name": style_name,
            "style_strength": style_strength
        }
        
        # 스타일 이미지가 있는 경우 추가
        if style_img_base64:
            api_payload["style_image"] = style_img_base64
        
        # API 헤더 준비
        api_headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        
        # 실제 외부 API 호출 (예시 - 실제 구현 시 활성화)
        # response = requests.post(api_endpoint, json=api_payload, headers=api_headers)
        # response.raise_for_status()
        # result = response.json()
        # result_img_base64 = result["styled_image"]
        # result_img_data = base64.b64decode(result_img_base64)
        # result_img = Image.open(io.BytesIO(result_img_data))
        
        # 테스트용 응답 모의 (외부 API 연동 없이 예시로 반환)
        # 간단한 필터 효과 적용으로 스타일 전이 시뮬레이션
        if style_name == "sketch":
            # 스케치 효과 적용
            cv_image = pil_to_cv2(content_img)
            gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
            inv = 255 - gray
            blurred = cv2.GaussianBlur(inv, (21, 21), 0)
            inv_blur = 255 - blurred
            result_cv = cv2.divide(gray, inv_blur, scale=256.0)
            result_img = cv2_to_pil(result_cv).convert('RGB')
        elif style_name == "watercolor":
            # 수채화 효과 시뮬레이션
            result_img = content_img.filter(ImageFilter.BLUR).filter(ImageFilter.EDGE_ENHANCE)
            enhancer = ImageEnhance.Color(result_img)
            result_img = enhancer.enhance(1.5)
        else:
            # 기본 세피아 효과
            result_img = content_img.convert('L')
            result_img = ImageOps.colorize(result_img, "#704214", "#C0C080")
            
        # 처리 정보 로깅
        print(f"스타일 전이 완료: 스타일={style_name}")
        
        # 원본 이미지 형식을 유지하여 이미지 반환
        result_img.format = original_format  # 원본 형식 정보 설정
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes = encode_image_to_bytes(result_img, format=original_format)
        
        # 적절한 MIME 타입 설정
        mime_type = "image/png"  # 기본값
        if original_format:
            if original_format.lower() == "jpeg" or original_format.lower() == "jpg":
                mime_type = "image/jpeg"
            elif original_format.lower() == "gif":
                mime_type = "image/gif"
            elif original_format.lower() == "webp":
                mime_type = "image/webp"
        
        return Response(content=img_bytes, media_type=mime_type, 
                        headers={"X-Process-Status": "success"})
    except Exception as e:
        print(f"스타일 전이 오류: {str(e)}")
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": str(e)}
        )

# 크기 조정 처리
@router.post("/resize")
async def process_resize(image: UploadFile = File(...), params: str = Form(...)):
    """이미지 크기 조정 처리"""
    params = json.loads(params)
    
    try:
        image_data = await image.read()
        img = decode_image(image_data)
        original_format = img.format  # 원본 이미지 형식 저장
        
        width = params.get("width", 100)
        height = params.get("height", 100)
        mode = params.get("mode", "stretch")
        
        result_img = None
        if mode == "stretch":
            result_img = img.resize((width, height), Image.LANCZOS)
        elif mode == "fit":
            img.thumbnail((width, height), Image.LANCZOS)
            result_img = img
        elif mode == "fill":
            img_ratio = img.width / img.height
            target_ratio = width / height
            
            if img_ratio > target_ratio:  # 이미지가 더 넓은 경우
                new_height = height
                new_width = int(height * img_ratio)
            else:  # 이미지가 더 높은 경우
                new_width = width
                new_height = int(width / img_ratio)
            
            resized = img.resize((new_width, new_height), Image.LANCZOS)
            
            # 중앙 자르기
            left = (resized.width - width) // 2
            top = (resized.height - height) // 2
            right = left + width
            bottom = top + height
            
            result_img = resized.crop((left, top, right, bottom))
        
        # 원본 이미지 형식 유지
        result_img.format = original_format
        
        # 처리 정보 로깅
        print(f"이미지 크기 조정: {width}x{height}, 모드: {mode}, 형식: {original_format}")
        
        # 적절한 MIME 타입 설정
        mime_type = "image/png"  # 기본값
        if original_format:
            if original_format.lower() == "jpeg" or original_format.lower() == "jpg":
                mime_type = "image/jpeg"
            elif original_format.lower() == "gif":
                mime_type = "image/gif"
            elif original_format.lower() == "webp":
                mime_type = "image/webp"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes = encode_image_to_bytes(result_img, format=original_format)
        return Response(content=img_bytes, media_type=mime_type, 
                        headers={"X-Process-Status": "success"})
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": str(e)}
        )

# 이미지 자르기 처리
@router.post("/crop")
async def process_crop(image: UploadFile = File(...), params: str = Form(...)):
    """이미지 자르기 처리"""
    params = json.loads(params)
    
    try:
        image_data = await image.read()
        img = decode_image(image_data)
        original_format = img.format  # 원본 이미지 형식 저장
        
        x = params.get("x", 0)
        y = params.get("y", 0)
        width = params.get("width", 100)
        height = params.get("height", 100)
        
        # 좌표 범위 검증
        if x < 0 or y < 0 or width <= 0 or height <= 0:
            raise ValueError("잘못된 자르기 좌표 또는 크기입니다.")
        
        if x + width > img.width or y + height > img.height:
            raise ValueError("자르기 영역이 이미지 범위를 벗어납니다.")
        
        # 이미지 자르기
        result_img = img.crop((x, y, x + width, y + height))
        
        # 원본 이미지 형식 유지
        result_img.format = original_format
        
        # 처리 정보 로깅
        print(f"이미지 자르기: x={x}, y={y}, 너비={width}, 높이={height}, 형식: {original_format}")
        
        # 적절한 MIME 타입 설정
        mime_type = "image/png"  # 기본값
        if original_format:
            if original_format.lower() == "jpeg" or original_format.lower() == "jpg":
                mime_type = "image/jpeg"
            elif original_format.lower() == "gif":
                mime_type = "image/gif"
            elif original_format.lower() == "webp":
                mime_type = "image/webp"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes = encode_image_to_bytes(result_img, format=original_format)
        return Response(content=img_bytes, media_type=mime_type, 
                        headers={"X-Process-Status": "success"})
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": str(e)}
        )

# 이미지 회전 처리
@router.post("/rotate")
async def process_rotate(image: UploadFile = File(...), params: str = Form(...)):
    print(f'rotate 진입')
    """이미지 회전 처리"""
    params = json.loads(params)
    
    try:
        image_data = await image.read()
        img = decode_image(image_data)
        original_format = img.format  # 원본 이미지 형식 저장
        
        angle = params.get("angle", 0)
        
        # 이미지 회전
        result_img = img.rotate(angle, expand=True, resample=Image.BICUBIC)
        
        # 원본 이미지 형식 유지
        result_img.format = original_format
        
        # 처리 정보 로깅
        print(f"이미지 회전: 각도={angle}, 형식: {original_format}")
        
        # 적절한 MIME 타입 설정
        mime_type = "image/png"  # 기본값
        if original_format:
            if original_format.lower() == "jpeg" or original_format.lower() == "jpg":
                mime_type = "image/jpeg"
            elif original_format.lower() == "gif":
                mime_type = "image/gif"
            elif original_format.lower() == "webp":
                mime_type = "image/webp"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes = encode_image_to_bytes(result_img, format=original_format)
        return Response(content=img_bytes, media_type=mime_type, 
                        headers={"X-Process-Status": "success"})
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": str(e)}
        )

# 이미지 뒤집기 처리
@router.post("/flip")
async def process_flip(image: UploadFile = File(...), params: str = Form(...)):
    """이미지 뒤집기 처리"""
    params = json.loads(params)
    
    try:
        image_data = await image.read()
        img = decode_image(image_data)
        original_format = img.format  # 원본 이미지 형식 저장
        
        direction = params.get("direction", "horizontal")
        
        # 이미지 뒤집기
        if direction == "horizontal":
            result_img = ImageOps.mirror(img)
        elif direction == "vertical":
            result_img = ImageOps.flip(img)
        else:
            raise ValueError("유효하지 않은 뒤집기 방향입니다.")
        
        # 원본 이미지 형식 유지
        result_img.format = original_format
        
        # 처리 정보 로깅
        print(f"이미지 뒤집기: 방향={direction}, 형식: {original_format}")
        
        # 적절한 MIME 타입 설정
        mime_type = "image/png"  # 기본값
        if original_format:
            if original_format.lower() == "jpeg" or original_format.lower() == "jpg":
                mime_type = "image/jpeg"
            elif original_format.lower() == "gif":
                mime_type = "image/gif"
            elif original_format.lower() == "webp":
                mime_type = "image/webp"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes = encode_image_to_bytes(result_img, format=original_format)
        return Response(content=img_bytes, media_type=mime_type, 
                        headers={"X-Process-Status": "success"})
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": str(e)}
        )

# 밝기 조정 처리
@router.post("/brightness")
async def process_brightness(image: UploadFile = File(...), params: str = Form(...)):
    """밝기 조정 처리"""
    params = json.loads(params)
    
    try:
        image_data = await image.read()
        img = decode_image(image_data)
        original_format = img.format  # 원본 이미지 형식 저장
        
        factor = params.get("factor", 1.0)
        
        # 밝기 조정
        enhancer = ImageEnhance.Brightness(img)
        result_img = enhancer.enhance(factor)
        
        # 원본 이미지 형식 유지
        result_img.format = original_format
        
        # 처리 정보 로깅
        print(f"밝기 조정: 계수={factor}, 형식: {original_format}")
        
        # 적절한 MIME 타입 설정
        mime_type = "image/png"  # 기본값
        if original_format:
            if original_format.lower() == "jpeg" or original_format.lower() == "jpg":
                mime_type = "image/jpeg"
            elif original_format.lower() == "gif":
                mime_type = "image/gif"
            elif original_format.lower() == "webp":
                mime_type = "image/webp"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes = encode_image_to_bytes(result_img, format=original_format)
        return Response(content=img_bytes, media_type=mime_type, 
                        headers={"X-Process-Status": "success"})
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": str(e)}
        )

# 대비 조정 처리
@router.post("/contrast")
async def process_contrast(image: UploadFile = File(...), params: str = Form(...)):
    """대비 조정 처리"""
    params = json.loads(params)
    
    try:
        image_data = await image.read()
        img = decode_image(image_data)
        original_format = img.format  # 원본 이미지 형식 저장
        
        factor = params.get("factor", 1.0)
        
        # 대비 조정
        enhancer = ImageEnhance.Contrast(img)
        result_img = enhancer.enhance(factor)
        
        # 원본 이미지 형식 유지
        result_img.format = original_format
        
        # 처리 정보 로깅
        print(f"대비 조정: 계수={factor}, 형식: {original_format}")
        
        # 적절한 MIME 타입 설정
        mime_type = "image/png"  # 기본값
        if original_format:
            if original_format.lower() == "jpeg" or original_format.lower() == "jpg":
                mime_type = "image/jpeg"
            elif original_format.lower() == "gif":
                mime_type = "image/gif"
            elif original_format.lower() == "webp":
                mime_type = "image/webp"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes = encode_image_to_bytes(result_img, format=original_format)
        return Response(content=img_bytes, media_type=mime_type, 
                        headers={"X-Process-Status": "success"})
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": str(e)}
        )

# 블러 효과 처리
@router.post("/blur")
async def process_blur(image: UploadFile = File(...), params: str = Form(...)):
    """블러 효과 처리"""
    params = json.loads(params)
    
    try:
        image_data = await image.read()
        img = decode_image(image_data)
        original_format = img.format  # 원본 이미지 형식 저장
        
        radius = params.get("radius", 2)
        
        # 블러 적용
        result_img = img.filter(ImageFilter.GaussianBlur(radius=radius))
        
        # 원본 이미지 형식 유지
        result_img.format = original_format
        
        # 처리 정보 로깅
        print(f"블러 효과: 반경={radius}, 형식: {original_format}")
        
        # 적절한 MIME 타입 설정
        mime_type = "image/png"  # 기본값
        if original_format:
            if original_format.lower() == "jpeg" or original_format.lower() == "jpg":
                mime_type = "image/jpeg"
            elif original_format.lower() == "gif":
                mime_type = "image/gif"
            elif original_format.lower() == "webp":
                mime_type = "image/webp"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes = encode_image_to_bytes(result_img, format=original_format)
        return Response(content=img_bytes, media_type=mime_type, 
                        headers={"X-Process-Status": "success"})
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": str(e)}
        )

# 선명도 조정 처리
@router.post("/sharpen")
async def process_sharpen(image: UploadFile = File(...), params: str = Form(...)):
    """선명도 조정 처리"""
    params = json.loads(params)
    
    try:
        image_data = await image.read()
        img = decode_image(image_data)
        original_format = img.format  # 원본 이미지 형식 저장
        
        # 선명도 향상을 위한 언샤프 마스크 필터 적용
        result_img = img.filter(ImageFilter.UnsharpMask(radius=params.get("radius", 2), 
                                                       percent=params.get("percent", 150)))
        
        # 원본 이미지 형식 유지
        result_img.format = original_format
        
        # 처리 정보 로깅
        print(f"선명도 조정: 반경={params.get('radius', 2)}, 강도={params.get('percent', 150)}%, 형식: {original_format}")
        
        # 적절한 MIME 타입 설정
        mime_type = "image/png"  # 기본값
        if original_format:
            if original_format.lower() == "jpeg" or original_format.lower() == "jpg":
                mime_type = "image/jpeg"
            elif original_format.lower() == "gif":
                mime_type = "image/gif"
            elif original_format.lower() == "webp":
                mime_type = "image/webp"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes = encode_image_to_bytes(result_img, format=original_format)
        return Response(content=img_bytes, media_type=mime_type, 
                        headers={"X-Process-Status": "success"})
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": str(e)}
        )

# 흑백 변환 처리
@router.post("/grayscale")
async def process_grayscale(image: UploadFile = File(...), params: str = Form(...)):
    """흑백 변환 처리"""
    params = json.loads(params)
    
    try:
        image_data = await image.read()
        img = decode_image(image_data)
        original_format = img.format  # 원본 이미지 형식 저장
        
        # 흑백 변환
        result_img = ImageOps.grayscale(img)
        
        # 원본 이미지 형식 유지
        result_img.format = original_format
        
        # 처리 정보 로깅
        print(f"흑백 변환 적용, 형식: {original_format}")
        
        # 적절한 MIME 타입 설정
        mime_type = "image/png"  # 기본값
        if original_format:
            if original_format.lower() == "jpeg" or original_format.lower() == "jpg":
                mime_type = "image/jpeg"
            elif original_format.lower() == "gif":
                mime_type = "image/gif"
            elif original_format.lower() == "webp":
                mime_type = "image/webp"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes = encode_image_to_bytes(result_img, format=original_format)
        return Response(content=img_bytes, media_type=mime_type, 
                        headers={"X-Process-Status": "success"})
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": str(e)}
        )

# 이진화 처리
@router.post("/threshold")
async def process_threshold(image: UploadFile = File(...), params: str = Form(...)):
    """이진화 처리"""
    params = json.loads(params)
    
    try:
        image_data = await image.read()
        img = decode_image(image_data)
        original_format = img.format  # 원본 이미지 형식 저장
        
        # 그레이스케일 변환 후 이진화
        gray_img = ImageOps.grayscale(img)
        threshold_value = params.get("threshold", 128)
        result_img = gray_img.point(lambda p: 255 if p > threshold_value else 0)
        
        # 원본 이미지 형식 유지
        result_img.format = original_format
        
        # 처리 정보 로깅
        print(f"이진화: 임계값={threshold_value}, 형식: {original_format}")
        
        # 적절한 MIME 타입 설정
        mime_type = "image/png"  # 기본값
        if original_format:
            if original_format.lower() == "jpeg" or original_format.lower() == "jpg":
                mime_type = "image/jpeg"
            elif original_format.lower() == "gif":
                mime_type = "image/gif"
            elif original_format.lower() == "webp":
                mime_type = "image/webp"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes = encode_image_to_bytes(result_img, format=original_format)
        return Response(content=img_bytes, media_type=mime_type, 
                        headers={"X-Process-Status": "success"})
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": str(e)}
        )

# 엣지 검출 처리
@router.post("/edge")
async def process_edge(image: UploadFile = File(...), params: str = Form(...)):
    """엣지 검출 처리"""
    params = json.loads(params)
    
    try:
        image_data = await image.read()
        img = decode_image(image_data)
        original_format = img.format  # 원본 이미지 형식 저장
        
        method = params.get("method", "canny")
        
        # PIL에서 OpenCV로 변환
        cv_img = pil_to_cv2(img)
        
        if method == "canny":
            # 그레이스케일 변환
            gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)
            
            # 가우시안 블러로 노이즈 제거
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
            
            # Canny 엣지 검출
            low_threshold = params.get("low_threshold", 50)
            high_threshold = params.get("high_threshold", 150)
            edges = cv2.Canny(blurred, low_threshold, high_threshold)
            
            # 3채널 이미지로 변환
            result_cv = cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR)
        elif method == "sobel":
            # 그레이스케일 변환
            gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)
            
            # Sobel 엣지 검출
            sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
            sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
            
            # 결과 합치기
            sobel_combined = cv2.magnitude(sobelx, sobely)
            
            # 정규화 및 8비트 이미지로 변환
            sobel_8u = cv2.normalize(sobel_combined, None, 0, 255, cv2.NORM_MINMAX, cv2.CV_8U)
            
            # 3채널 이미지로 변환
            result_cv = cv2.cvtColor(sobel_8u, cv2.COLOR_GRAY2BGR)
        else:
            raise ValueError("지원하지 않는 엣지 검출 방법입니다.")
        
        # OpenCV에서 PIL로 변환
        result_img = cv2_to_pil(result_cv)
        
        # 원본 이미지 형식 유지
        result_img.format = original_format
        
        # 처리 정보 로깅
        print(f"엣지 검출: 방법={method}, 형식: {original_format}")
        
        # 적절한 MIME 타입 설정
        mime_type = "image/png"  # 기본값
        if original_format:
            if original_format.lower() == "jpeg" or original_format.lower() == "jpg":
                mime_type = "image/jpeg"
            elif original_format.lower() == "gif":
                mime_type = "image/gif"
            elif original_format.lower() == "webp":
                mime_type = "image/webp"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes = encode_image_to_bytes(result_img, format=original_format)
        return Response(content=img_bytes, media_type=mime_type, 
                        headers={"X-Process-Status": "success"})
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": str(e)}
        )

# 색상 조정 처리
@router.post("/hue")
async def process_hue(image: UploadFile = File(...), params: str = Form(...)):
    """색상 조정 처리"""
    params = json.loads(params)
    
    try:
        image_data = await image.read()
        img = decode_image(image_data)
        original_format = img.format  # 원본 이미지 형식 저장
        
        hue_factor = params.get("hue_factor", 0)
        
        # HSV 변환 및 색상 조정
        cv_img = pil_to_cv2(img)
        hsv = cv2.cvtColor(cv_img, cv2.COLOR_BGR2HSV)
        
        # 색상 채널 조정 (0-179 범위)
        hsv[:, :, 0] = (hsv[:, :, 0] + int(hue_factor * 179)) % 180
        
        # 다시 BGR로 변환
        result_cv = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
        
        # OpenCV에서 PIL로 변환
        result_img = cv2_to_pil(result_cv)
        
        # 원본 이미지 형식 유지
        result_img.format = original_format
        
        # 처리 정보 로깅
        print(f"색상 조정: 색상 계수={hue_factor}, 형식: {original_format}")
        
        # 적절한 MIME 타입 설정
        mime_type = "image/png"  # 기본값
        if original_format:
            if original_format.lower() == "jpeg" or original_format.lower() == "jpg":
                mime_type = "image/jpeg"
            elif original_format.lower() == "gif":
                mime_type = "image/gif"
            elif original_format.lower() == "webp":
                mime_type = "image/webp"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes = encode_image_to_bytes(result_img, format=original_format)
        return Response(content=img_bytes, media_type=mime_type, 
                        headers={"X-Process-Status": "success"})
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": str(e)}
        )

# 감마 보정
@router.post("/gamma")
async def process_gamma(image: UploadFile = File(...), params: str = Form(...)):
    """감마 보정 처리"""
    params = json.loads(params)
    
    try:
        # 이미지 데이터 읽기
        image_data = await image.read()
        img = decode_image(image_data)
        original_format = img.format  # 원본 이미지 형식 저장
        
        # 파라미터 추출
        gamma_value = float(params.get("gamma", 1.0))
        
        # PIL 이미지를 OpenCV로 변환
        cv_image = pil_to_cv2(img)
        
        # 감마 보정 적용
        # 먼저 이미지를 0-1 범위로 정규화
        normalized = cv_image.astype(np.float32) / 255.0
        # 감마 보정 적용
        corrected = np.power(normalized, gamma_value)
        # 다시 0-255 범위로 변환
        output = (corrected * 255.0).astype(np.uint8)
        
        # 결과 이미지 반환
        result_img = cv2_to_pil(output)
        
        # 원본 이미지 형식 유지
        result_img.format = original_format
        
        # 처리 정보 로깅
        print(f"감마 보정: 감마값={gamma_value}, 형식: {original_format}")
        
        # 적절한 MIME 타입 설정
        mime_type = "image/png"  # 기본값
        if original_format:
            if original_format.lower() == "jpeg" or original_format.lower() == "jpg":
                mime_type = "image/jpeg"
            elif original_format.lower() == "gif":
                mime_type = "image/gif"
            elif original_format.lower() == "webp":
                mime_type = "image/webp"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes = encode_image_to_bytes(result_img, format=original_format)
        return Response(content=img_bytes, media_type=mime_type)
    except Exception as e:
        print(f"감마 보정 처리 오류: {str(e)}")
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": str(e)}
        )

# 히스토그램 평활화
@router.post("/histogram_equalization")
async def process_histogram_equalization(image: UploadFile = File(...), params: str = Form(...)):
    """히스토그램 평활화 처리"""
    params = json.loads(params)
    
    try:
        # 이미지 데이터 읽기
        image_data = await image.read()
        img = decode_image(image_data)
        original_format = img.format  # 원본 이미지 형식 저장
        
        # 파라미터 추출
        enabled = params.get("enabled", True)
        
        if not enabled:
            # 처리하지 않고 원본 반환
            img_bytes = encode_image_to_bytes(img, format=original_format)
            
            # 적절한 MIME 타입 설정
            mime_type = "image/png"  # 기본값
            if original_format:
                if original_format.lower() == "jpeg" or original_format.lower() == "jpg":
                    mime_type = "image/jpeg"
                elif original_format.lower() == "gif":
                    mime_type = "image/gif"
                elif original_format.lower() == "webp":
                    mime_type = "image/webp"
                    
            return Response(content=img_bytes, media_type=mime_type)
        
        # PIL 이미지를 OpenCV로 변환
        cv_image = pil_to_cv2(img)
        
        # 컬러 이미지인 경우
        if len(cv_image.shape) == 3:
            # YUV 색 공간으로 변환 (Y: 밝기 채널)
            yuv_image = cv2.cvtColor(cv_image, cv2.COLOR_BGR2YUV)
            
            # Y 채널에 대해 히스토그램 평활화 적용
            yuv_image[:,:,0] = cv2.equalizeHist(yuv_image[:,:,0])
            
            # RGB 색 공간으로 다시 변환
            result = cv2.cvtColor(yuv_image, cv2.COLOR_YUV2BGR)
        else:
            # 그레이스케일 이미지인 경우 직접 적용
            result = cv2.equalizeHist(cv_image)
        
        # 결과 이미지 반환
        result_img = cv2_to_pil(result)
        
        # 원본 이미지 형식 유지
        result_img.format = original_format
        
        # 처리 정보 로깅
        print(f"히스토그램 평활화 적용, 형식: {original_format}")
        
        # 적절한 MIME 타입 설정
        mime_type = "image/png"  # 기본값
        if original_format:
            if original_format.lower() == "jpeg" or original_format.lower() == "jpg":
                mime_type = "image/jpeg"
            elif original_format.lower() == "gif":
                mime_type = "image/gif"
            elif original_format.lower() == "webp":
                mime_type = "image/webp"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes = encode_image_to_bytes(result_img, format=original_format)
        return Response(content=img_bytes, media_type=mime_type)
    except Exception as e:
        print(f"히스토그램 평활화 처리 오류: {str(e)}")
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": str(e)}
        )

# CLAHE (Contrast Limited Adaptive Histogram Equalization)
@router.post("/clahe")
async def process_clahe(image: UploadFile = File(...), params: str = Form(...)):
    """CLAHE 처리"""
    params = json.loads(params)
    
    try:
        # 이미지 데이터 읽기
        image_data = await image.read()
        img = decode_image(image_data)
        original_format = img.format  # 원본 이미지 형식 저장
        
        # 파라미터 추출
        clip_limit = float(params.get("clip_limit", 2.0))
        tile_grid_size = int(params.get("tile_grid_size", 8))
        
        # PIL 이미지를 OpenCV로 변환
        cv_image = pil_to_cv2(img)
        
        # CLAHE 객체 생성
        clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(tile_grid_size, tile_grid_size))
        
        # 컬러 이미지인 경우
        if len(cv_image.shape) == 3:
            # Lab 색 공간으로 변환 (L: 밝기 채널)
            lab_image = cv2.cvtColor(cv_image, cv2.COLOR_BGR2LAB)
            
            # L 채널에 대해 CLAHE 적용
            lab_image[:,:,0] = clahe.apply(lab_image[:,:,0])
            
            # BGR 색 공간으로 다시 변환
            result = cv2.cvtColor(lab_image, cv2.COLOR_LAB2BGR)
        else:
            # 그레이스케일 이미지인 경우 직접 적용
            result = clahe.apply(cv_image)
        
        # 결과 이미지 반환
        result_img = cv2_to_pil(result)
        
        # 원본 이미지 형식 유지
        result_img.format = original_format
        
        # 처리 정보 로깅
        print(f"CLAHE 처리: clip_limit={clip_limit}, tile_grid_size={tile_grid_size}, 형식: {original_format}")
        
        # 적절한 MIME 타입 설정
        mime_type = "image/png"  # 기본값
        if original_format:
            if original_format.lower() == "jpeg" or original_format.lower() == "jpg":
                mime_type = "image/jpeg"
            elif original_format.lower() == "gif":
                mime_type = "image/gif"
            elif original_format.lower() == "webp":
                mime_type = "image/webp"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes = encode_image_to_bytes(result_img, format=original_format)
        return Response(content=img_bytes, media_type=mime_type)
    except Exception as e:
        print(f"CLAHE 처리 오류: {str(e)}")
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": str(e)}
        )

# 가우시안 블러 (이미 blur 함수가 있다면 수정하거나 새로 추가)
@router.post("/gaussian_blur")
async def process_gaussian_blur(image: UploadFile = File(...), params: str = Form(...)):
    """가우시안 블러 처리"""
    params = json.loads(params)
    
    try:
        # 이미지 데이터 읽기
        image_data = await image.read()
        img = decode_image(image_data)
        original_format = img.format  # 원본 이미지 형식 저장
        
        # 파라미터 추출
        kernel_size = int(params.get("kernel_size", 5))
        sigma = float(params.get("sigma", 0))  # 0이면 자동 계산
        
        # 커널 크기가 홀수인지 확인
        if kernel_size % 2 == 0:
            kernel_size += 1  # 짝수면 홀수로 만들기
        
        # PIL 이미지를 OpenCV로 변환
        cv_image = pil_to_cv2(img)
        
        # 가우시안 블러 적용
        result = cv2.GaussianBlur(cv_image, (kernel_size, kernel_size), sigma)
        
        # 결과 이미지 반환
        result_img = cv2_to_pil(result)
        
        # 원본 이미지 형식 유지
        result_img.format = original_format
        
        # 처리 정보 로깅
        print(f"가우시안 블러: 커널크기={kernel_size}, 시그마={sigma}, 형식: {original_format}")
        
        # 적절한 MIME 타입 설정
        mime_type = "image/png"  # 기본값
        if original_format:
            if original_format.lower() == "jpeg" or original_format.lower() == "jpg":
                mime_type = "image/jpeg"
            elif original_format.lower() == "gif":
                mime_type = "image/gif"
            elif original_format.lower() == "webp":
                mime_type = "image/webp"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes = encode_image_to_bytes(result_img, format=original_format)
        return Response(content=img_bytes, media_type=mime_type)
    except Exception as e:
        print(f"가우시안 블러 처리 오류: {str(e)}")
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": str(e)}
        )

# 미디언 필터
@router.post("/median_filter")
async def process_median_filter(image: UploadFile = File(...), params: str = Form(...)):
    """미디언 필터 처리"""
    params = json.loads(params)
    
    try:
        # 이미지 데이터 읽기
        image_data = await image.read()
        img = decode_image(image_data)
        original_format = img.format  # 원본 이미지 형식 저장
        
        # 파라미터 추출
        kernel_size = int(params.get("kernel_size", 5))
        
        # 커널 크기가 홀수인지 확인
        if kernel_size % 2 == 0:
            kernel_size += 1  # 짝수면 홀수로 만들기
        
        # PIL 이미지를 OpenCV로 변환
        cv_image = pil_to_cv2(img)
        
        # 미디언 필터 적용
        result = cv2.medianBlur(cv_image, kernel_size)
        
        # 결과 이미지 반환
        result_img = cv2_to_pil(result)
        
        # 원본 이미지 형식 유지
        result_img.format = original_format
        
        # 처리 정보 로깅
        print(f"미디언 필터: 커널크기={kernel_size}, 형식: {original_format}")
        
        # 적절한 MIME 타입 설정
        mime_type = "image/png"  # 기본값
        if original_format:
            if original_format.lower() == "jpeg" or original_format.lower() == "jpg":
                mime_type = "image/jpeg"
            elif original_format.lower() == "gif":
                mime_type = "image/gif"
            elif original_format.lower() == "webp":
                mime_type = "image/webp"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes = encode_image_to_bytes(result_img, format=original_format)
        return Response(content=img_bytes, media_type=mime_type)
    except Exception as e:
        print(f"미디언 필터 처리 오류: {str(e)}")
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": str(e)}
        )

# 비등방성 확산 필터
@router.post("/anisotropic_diffusion")
async def process_anisotropic_diffusion(image: UploadFile = File(...), params: str = Form(...)):
    """비등방성 확산 필터 처리"""
    params = json.loads(params)
    
    try:
        # 이미지 데이터 읽기
        image_data = await image.read()
        img = decode_image(image_data)
        original_format = img.format  # 원본 이미지 형식 저장
        
        # 파라미터 추출
        num_iter = int(params.get("num_iter", 5))
        kappa = float(params.get("kappa", 50))
        gamma = float(params.get("gamma", 0.1))
        option = int(params.get("option", 1))
        
        # PIL 이미지를 OpenCV로 변환
        cv_image = pil_to_cv2(img)
        
        # 그레이스케일로 변환 (비등방성 확산은 일반적으로 그레이스케일에서 수행)
        if len(cv_image.shape) == 3:
            gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
        else:
            gray = cv_image.copy()
        
        # 비등방성 확산 필터 구현
        # 초기 이미지를 float32로 변환
        img_float = gray.astype(np.float32)
        
        # 각 반복마다 필터 적용
        for t in range(num_iter):
            # 그라디언트 계산
            north = np.roll(img_float, -1, axis=0) - img_float
            south = np.roll(img_float, 1, axis=0) - img_float
            east = np.roll(img_float, 1, axis=1) - img_float
            west = np.roll(img_float, -1, axis=1) - img_float
            
            # 디퓨젼 계수 계산
            if option == 1:
                # Perona-Malik diffusion equation 1
                cn = np.exp(-(north**2) / (kappa**2))
                cs = np.exp(-(south**2) / (kappa**2))
                ce = np.exp(-(east**2) / (kappa**2))
                cw = np.exp(-(west**2) / (kappa**2))
            else:
                # Perona-Malik diffusion equation 2
                cn = 1 / (1 + (north/kappa)**2)
                cs = 1 / (1 + (south/kappa)**2)
                ce = 1 / (1 + (east/kappa)**2)
                cw = 1 / (1 + (west/kappa)**2)
            
            # 업데이트 수식 적용
            img_float = img_float + gamma * (cn*north + cs*south + ce*east + cw*west)
        
        # 결과 이미지를 uint8로 변환
        result_gray = np.clip(img_float, 0, 255).astype(np.uint8)
        
        # 원본이 컬러였던 경우, 컬러 이미지 복원
        if len(cv_image.shape) == 3:
            # 히스토그램 매칭으로 원본 이미지의 컬러 톤 보존
            result = cv_image.copy()
            for i in range(3):  # BGR 각 채널에 대해
                result[:,:,i] = cv2.createCLAHE(clipLimit=4.0, tileGridSize=(8,8)).apply(
                    cv2.normalize(result_gray, None, 0, 255, cv2.NORM_MINMAX)
                )
        else:
            result = result_gray
        
        # 결과 이미지 반환
        result_img = cv2_to_pil(result)
        
        # 원본 이미지 형식 유지
        result_img.format = original_format
        
        # 처리 정보 로깅
        print(f"비등방성 확산: 반복={num_iter}, kappa={kappa}, gamma={gamma}, 형식: {original_format}")
        
        # 적절한 MIME 타입 설정
        mime_type = "image/png"  # 기본값
        if original_format:
            if original_format.lower() == "jpeg" or original_format.lower() == "jpg":
                mime_type = "image/jpeg"
            elif original_format.lower() == "gif":
                mime_type = "image/gif"
            elif original_format.lower() == "webp":
                mime_type = "image/webp"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes = encode_image_to_bytes(result_img, format=original_format)
        return Response(content=img_bytes, media_type=mime_type)
    except Exception as e:
        print(f"비등방성 확산 필터 처리 오류: {str(e)}")
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": str(e)}
        )

# 정규화
@router.post("/normalize")
async def process_normalize(image: UploadFile = File(...), params: str = Form(...)):
    """이미지 정규화 처리"""
    params = json.loads(params)
    
    try:
        # 이미지 데이터 읽기
        image_data = await image.read()
        img = decode_image(image_data)
        original_format = img.format  # 원본 이미지 형식 저장
        
        # 파라미터 추출
        min_value = int(params.get("min_value", 0))
        max_value = int(params.get("max_value", 255))
        
        # PIL 이미지를 OpenCV로 변환
        cv_image = pil_to_cv2(img)
        
        # 정규화 적용 - 문제 해결
        if len(cv_image.shape) == 3:
            # 컬러 이미지인 경우 각 채널별로 정규화
            result = np.zeros_like(cv_image)
            for i in range(3):
                # 각 채널을 개별적으로 정규화
                channel = cv_image[:,:,i].astype(np.float32)
                # None을 dst로 사용하여 새 배열을 반환받음
                normalized_channel = cv2.normalize(channel, None, min_value, max_value, cv2.NORM_MINMAX)
                # 결과를 결과 배열에 할당
                result[:,:,i] = normalized_channel
        else:
            # 그레이스케일 이미지인 경우
            cv_image_float = cv_image.astype(np.float32)
            result = cv2.normalize(cv_image_float, None, min_value, max_value, cv2.NORM_MINMAX)
            result = result.astype(np.uint8)
        
        # 결과 이미지 반환
        result_img = cv2_to_pil(result)
        
        # 원본 이미지 형식 유지
        result_img.format = original_format
        
        # 처리 정보 로깅
        print(f"정규화: min={min_value}, max={max_value}, 형식: {original_format}")
        
        # 적절한 MIME 타입 설정
        mime_type = "image/png"  # 기본값
        if original_format:
            if original_format.lower() == "jpeg" or original_format.lower() == "jpg":
                mime_type = "image/jpeg"
            elif original_format.lower() == "gif":
                mime_type = "image/gif"
            elif original_format.lower() == "webp":
                mime_type = "image/webp"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes = encode_image_to_bytes(result_img, format=original_format)
        return Response(content=img_bytes, media_type=mime_type)
    except Exception as e:
        print(f"정규화 처리 오류: {str(e)}")
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": str(e)}
        )

# 이미지 병합 처리
@router.post("/merge")
async def process_merge(images: List[UploadFile] = File(...), params: str = Form(...), format: str = Form(None)):
    """이미지 병합 처리"""
    params = json.loads(params)
    
    try:
        # 형식 지정이 없으면 기본 PNG 사용
        output_format = format or "PNG"
        print(f"병합 요청 - 이미지 수: {len(images)}, 출력 형식: {output_format}")
        
        if len(images) < 2:
            raise ValueError("병합에는 최소 2개의 이미지가 필요합니다.")
        
        # 첫 번째 이미지를 기본으로 사용
        base_image_data = await images[0].read()
        base_img = decode_image(base_image_data)
        
        # 저장된 원본 형식 확인
        original_format = base_img.format
        if not output_format and original_format:
            output_format = original_format
        
        # 병합 방식 확인
        mode = params.get("mode", "overlay")
        
        # 모드에 따른 병합 처리
        if mode == "horizontal":
            # 가로로 나열
            total_width = sum(img.width for img in [base_img] + [decode_image(await img.read()) for img in images[1:]])
            max_height = max(img.height for img in [base_img] + [decode_image(await img.read()) for img in images[1:]])
            
            # 새 이미지 생성
            result_img = Image.new('RGB', (total_width, max_height))
            
            # 이미지 나열
            x_offset = 0
            result_img.paste(base_img, (x_offset, 0))
            x_offset += base_img.width
            
            for img_file in images[1:]:
                img_data = await img_file.read()
                img = decode_image(img_data)
                result_img.paste(img, (x_offset, 0))
                x_offset += img.width
        
        elif mode == "vertical":
            # 세로로 나열
            max_width = max(img.width for img in [base_img] + [decode_image(await img.read()) for img in images[1:]])
            total_height = sum(img.height for img in [base_img] + [decode_image(await img.read()) for img in images[1:]])
            
            # 새 이미지 생성
            result_img = Image.new('RGB', (max_width, total_height))
            
            # 이미지 나열
            y_offset = 0
            result_img.paste(base_img, (0, y_offset))
            y_offset += base_img.height
            
            for img_file in images[1:]:
                img_data = await img_file.read()
                img = decode_image(img_data)
                result_img.paste(img, (0, y_offset))
                y_offset += img.height
        
        elif mode == "grid":
            # 그리드 형태로 배치
            grid_size = int(math.ceil(math.sqrt(len(images) + 1)))
            
            # 모든 이미지 로드
            all_images = [base_img]
            for img_file in images[1:]:
                img_data = await img_file.read()
                all_images.append(decode_image(img_data))
            
            # 각 이미지의 최대 크기 계산
            max_width = max(img.width for img in all_images)
            max_height = max(img.height for img in all_images)
            
            # 결과 이미지 크기
            result_width = max_width * grid_size
            result_height = max_height * ((len(all_images) + grid_size - 1) // grid_size)
            
            # 새 이미지 생성
            result_img = Image.new('RGB', (result_width, result_height), color=(255, 255, 255))
            
            # 이미지 배치
            for i, img in enumerate(all_images):
                x = (i % grid_size) * max_width
                y = (i // grid_size) * max_height
                result_img.paste(img, (x, y))
        
        else:  # overlay 모드 (기본값)
            # 두 번째 이미지부터 첫 번째 이미지 위에 오버레이
            result_img = base_img.copy()
            
            # 투명도 파라미터
            opacity = params.get("opacity", 0.5)
            
            for img_file in images[1:]:
                img_data = await img_file.read()
                overlay_img = decode_image(img_data)
                
                # 크기 조정 (첫 번째 이미지에 맞춤)
                if overlay_img.size != result_img.size:
                    overlay_img = overlay_img.resize(result_img.size, Image.LANCZOS)
                
                # 이미지가 RGBA 모드가 아니면 변환
                if overlay_img.mode != 'RGBA':
                    overlay_img = overlay_img.convert('RGBA')
                
                # 투명도 적용
                overlay_array = np.array(overlay_img)
                overlay_array[:, :, 3] = (overlay_array[:, :, 3] * opacity).astype(np.uint8)
                overlay_img = Image.fromarray(overlay_array)
                
                # 이미지 합성
                if result_img.mode != 'RGBA':
                    result_img = result_img.convert('RGBA')
                
                result_img = Image.alpha_composite(result_img, overlay_img)
        
        # 결과 이미지에 원본 형식 설정
        result_img.format = output_format
        
        # 처리 정보 로깅
        print(f"이미지 병합 완료: 모드={mode}, 이미지 수={len(images)}, 출력 형식={output_format}")
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes = encode_image_to_bytes(result_img, format=output_format)
        
        # 적절한 MIME 타입 설정
        mime_type = "image/png"  # 기본값
        if output_format:
            if output_format.lower() == "jpeg" or output_format.lower() == "jpg":
                mime_type = "image/jpeg"
            elif output_format.lower() == "gif":
                mime_type = "image/gif"
            elif output_format.lower() == "webp":
                mime_type = "image/webp"
        
        return Response(content=img_bytes, media_type=mime_type, 
                        headers={"X-Process-Status": "success"})
    except Exception as e:
        print(f"이미지 병합 오류: {str(e)}")
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": str(e)}
        ) 