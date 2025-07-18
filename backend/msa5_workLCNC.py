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
    
    # 형식 문자열을 대문자로 표준화
    format = format.upper() if isinstance(format, str) else format
    
    # JPEG 포맷의 특별 처리 - PIL에서는 'JPEG'로 저장되지만 파일 확장자는 'jpg'
    if format == "JPG":
        format = "JPEG"
    
    # 지원되는 형식 확인
    supported_formats = ["JPEG", "PNG", "GIF", "WEBP", "BMP", "TIFF"]
    if format not in supported_formats:
        print(f"지원되지 않는 이미지 형식: {format}, PNG로 대체합니다.")
        format = "PNG"
    
    try:
        # 이미지 저장 - 감지된 또는 지정된 형식 사용
        if format == "JPEG":
            # JPEG의 경우 RGB 모드로 변환 (RGBA는 지원하지 않음)
            if image.mode == 'RGBA':
                # 배경색을 흰색으로 설정하여 변환
                background = Image.new('RGB', image.size, (255, 255, 255))
                background.paste(image, mask=image.split()[3])  # 알파 채널을 마스크로 사용
                image = background
            image.save(buffered, format=format, quality=95)
        else:
            image.save(buffered, format=format)
        
        # 로그 추가
        print(f"이미지 인코딩 완료: 형식={format}, 크기={buffered.getbuffer().nbytes} 바이트")
        
        return buffered.getvalue(), format
    except Exception as e:
        print(f"이미지 인코딩 오류: {str(e)}, PNG로 대체합니다.")
        # 오류 발생 시 PNG로 대체
        buffered = io.BytesIO()
        image.save(buffered, format="PNG")
        return buffered.getvalue(), "PNG"

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
        img_bytes, format_used = encode_image_to_bytes(result_img, format=format_used)
        return Response(content=img_bytes, media_type=f"image/{format_used.lower()}", 
                        headers={"X-Process-Status": "success", "X-Detected-Objects": json.dumps(objects)})
    except Exception as e:
        print(f"객체 감지 오류: {str(e)}")
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
        # 이미지 데이터 읽기
        image_data = await image.read()
        img = decode_image(image_data)
        original_format = img.format  # 원본 이미지 형식 저장
        
        # 파라미터 추출
        factor = float(params.get("factor", 1.0))
        
        # 밝기 조정
        enhancer = ImageEnhance.Brightness(img)
        result_img = enhancer.enhance(factor)
        result_img.format = original_format  # 원본 형식 정보 보존
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes, format_used = encode_image_to_bytes(result_img, format=original_format)
        
        # 적절한 미디어 타입 결정
        media_type = f"image/{format_used.lower()}" if format_used != "JPEG" else "image/jpeg"
        
        return Response(content=img_bytes, media_type=media_type)
    except Exception as e:
        print(f"밝기 조정 오류: {str(e)}")
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
        mime_type = f"image/{original_format.lower()}" if original_format != "JPEG" else "image/jpeg"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes, format_used = encode_image_to_bytes(result_img, format=original_format)
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
        mime_type = f"image/{original_format.lower()}" if original_format != "JPEG" else "image/jpeg"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes, format_used = encode_image_to_bytes(result_img, format=original_format)
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
        mime_type = f"image/{original_format.lower()}" if original_format != "JPEG" else "image/jpeg"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes, format_used = encode_image_to_bytes(result_img, format=original_format)
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
        mime_type = f"image/{original_format.lower()}" if original_format != "JPEG" else "image/jpeg"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes, format_used = encode_image_to_bytes(result_img, format=original_format)
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
        mime_type = f"image/{original_format.lower()}" if original_format != "JPEG" else "image/jpeg"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes, format_used = encode_image_to_bytes(result_img, format=original_format)
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
        mime_type = f"image/{original_format.lower()}" if original_format != "JPEG" else "image/jpeg"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes, format_used = encode_image_to_bytes(result_img, format=original_format)
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
        apply = params.get("apply", True)
        
        if not apply:
            # 처리하지 않고 원본 반환
            img_bytes, format_used = encode_image_to_bytes(img, format=original_format)
            
            # 적절한 MIME 타입 설정
            mime_type = f"image/{format_used.lower()}" if format_used != "JPEG" else "image/jpeg"
                    
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
        mime_type = f"image/{original_format.lower()}" if original_format != "JPEG" else "image/jpeg"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes, format_used = encode_image_to_bytes(result_img, format=original_format)
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
        mime_type = f"image/{original_format.lower()}" if original_format != "JPEG" else "image/jpeg"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes, format_used = encode_image_to_bytes(result_img, format=original_format)
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
        mime_type = f"image/{original_format.lower()}" if original_format != "JPEG" else "image/jpeg"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes, format_used = encode_image_to_bytes(result_img, format=original_format)
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
        mime_type = f"image/{original_format.lower()}" if original_format != "JPEG" else "image/jpeg"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes, format_used = encode_image_to_bytes(result_img, format=original_format)
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
        mime_type = f"image/{original_format.lower()}" if original_format != "JPEG" else "image/jpeg"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes, format_used = encode_image_to_bytes(result_img, format=original_format)
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
        mime_type = f"image/{original_format.lower()}" if original_format != "JPEG" else "image/jpeg"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes, format_used = encode_image_to_bytes(result_img, format=original_format)
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
    """이미지 병합 처리 - 픽셀별 RGB 채널 연산"""
    params = json.loads(params)
    
    try:
        # 모든 이미지를 로드하여 형식 확인
        loaded_images = []
        formats = []
        
        for img_file in images:
            img_data = await img_file.read()
            img = decode_image(img_data)
            loaded_images.append(img)
            
            # 이미지 형식 수집
            if hasattr(img, 'format') and img.format:
                formats.append(img.format)
        
        # 형식 결정
        output_format = None
        if format:
            output_format = format.upper()
        elif len(formats) > 0:
            output_format = formats[0]
        
        # 기본값 설정
        if not output_format:
            output_format = "PNG"
        
        print(f"병합 요청 - 이미지 수: {len(images)}, 감지된 형식: {formats}, 출력 형식: {output_format}")
        
        if len(loaded_images) < 2:
            raise ValueError("병합에는 최소 2개의 이미지가 필요합니다.")
        
        # 병합 연산 파라미터 추출
        operation = params.get('operation', 'average')
        
        if operation not in ['average', 'max', 'min']:
            operation = 'average'
        
        print(f"병합 연산: {operation}")
        
        # 첫 번째 이미지를 기준으로 크기 설정
        base_img = loaded_images[0]
        target_size = base_img.size
        
        # 모든 이미지를 같은 크기로 리사이즈하고 RGB 모드로 변환
        processed_images = []
        for img in loaded_images:
            if img.size != target_size:
                img = img.resize(target_size, Image.LANCZOS)
            if img.mode != 'RGB':
                img = img.convert('RGB')
            processed_images.append(img)
        
        # 이미지들을 numpy 배열로 변환
        image_arrays = []
        for img in processed_images:
            img_array = np.array(img, dtype=np.float32)
            image_arrays.append(img_array)
        
        # 배열을 스택으로 쌓기 (이미지 수, 높이, 너비, 3)
        stacked_arrays = np.stack(image_arrays, axis=0)
        
        # 픽셀별 RGB 채널 연산 수행
        if operation == "max":
            # 각 픽셀에서 RGB 채널별 최대값
            result_array = np.max(stacked_arrays, axis=0)
        elif operation == "min":
            # 각 픽셀에서 RGB 채널별 최소값
            result_array = np.min(stacked_arrays, axis=0)
        else:  # average (기본값)
            # 각 픽셀에서 RGB 채널별 평균값
            result_array = np.mean(stacked_arrays, axis=0)
        
        # 결과를 uint8로 변환
        result_array = np.clip(result_array, 0, 255).astype(np.uint8)
        
        # PIL 이미지로 변환
        result_img = Image.fromarray(result_array, 'RGB')
        
        # 결과 이미지에 원본 형식 설정
        result_img.format = output_format
        
        # 처리 정보 로깅
        print(f"이미지 병합 완료: 연산={operation}, 이미지 수={len(loaded_images)}, 출력 형식={output_format}")
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes, format_used = encode_image_to_bytes(result_img, format=output_format)
        
        # 적절한 MIME 타입 설정
        mime_type = f"image/{format_used.lower()}" if format_used != "JPEG" else "image/jpeg"
        
        # 응답 헤더에 형식 정보 추가
        headers = {
            "X-Process-Status": "success",
            "X-Image-Format": format_used
        }
        
        return Response(content=img_bytes, media_type=mime_type, headers=headers)
    except Exception as e:
        print(f"이미지 병합 오류: {str(e)}")
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": str(e)}
        )

# SAM2 모델을 전역 변수로 미리 로드
sam2_models = {}

def load_sam2_model(model_size="large"):
    """SAM2 모델을 미리 로드하는 함수"""
    if model_size in sam2_models:
        return sam2_models[model_size]
    
    try:
        import torch
        from sam2.build_sam import build_sam2
        from sam2.sam2_image_predictor import SAM2ImagePredictor
        from sam2.automatic_mask_generator import SAM2AutomaticMaskGenerator

        import os
        
        model_configs = {
            "tiny": {
                "checkpoint": "./checkpoints/sam2.1_hiera_tiny.pt",
                "model_cfg": "configs/sam2.1/sam2.1_hiera_t.yaml",
                "hf_name": "facebook/sam2-hiera-tiny"
            },
            "small": {
                "checkpoint": "./checkpoints/sam2.1_hiera_small.pt", 
                "model_cfg": "configs/sam2.1/sam2.1_hiera_s.yaml",
                "hf_name": "facebook/sam2-hiera-small"
            },
            "base_plus": {
                "checkpoint": "./checkpoints/sam2.1_hiera_base_plus.pt",
                "model_cfg": "configs/sam2.1/sam2.1_hiera_b+.yaml",
                "hf_name": "facebook/sam2-hiera-base-plus"
            },
            "large": {
                "checkpoint": "./checkpoints/sam2.1_hiera_large.pt",
                "model_cfg": "configs/sam2.1/sam2.1_hiera_l.yaml",
                "hf_name": "facebook/sam2-hiera-large"
            }
        }
        
        config = model_configs.get(model_size, model_configs["large"])
        
        # GPU 사용 가능 여부 확인
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"SAM2 모델 로딩 중 - 크기: {model_size}, 디바이스: {device}")
        
        # 로컬 체크포인트 파일 확인
        checkpoint_path = config["checkpoint"]
        model_cfg_path = config["model_cfg"]
        
        # SAM2 모델 로드 시도
        model = None
        predictor = None
        mask_generator = None
        
        # 1. 로컬 체크포인트 파일로 로드 시도
        if os.path.exists(checkpoint_path) and os.path.exists(model_cfg_path):
            try:
                print(f"로컬 체크포인트에서 모델 로딩: {checkpoint_path}")
                model = build_sam2(model_cfg_path, checkpoint_path, device=device, apply_postprocessing=False)
                predictor = SAM2ImagePredictor(model)
                mask_generator = SAM2AutomaticMaskGenerator(model)
                print(f"로컬 체크포인트에서 모델 로딩 성공")
            except Exception as e:
                print(f"로컬 체크포인트 로딩 실패: {str(e)}")
        
        # 2. Hugging Face에서 로드 시도
        if not predictor:
            try:
                print(f"Hugging Face에서 모델 로딩: {config['hf_name']}")
                predictor = SAM2ImagePredictor.from_pretrained(config['hf_name'])
                if device == "cuda":
                    predictor.model = predictor.model.cuda()
                model = predictor.model
                mask_generator = SAM2AutomaticMaskGenerator(model)
                print(f"Hugging Face에서 모델 로딩 성공")
            except Exception as e:
                print(f"Hugging Face 로딩 실패: {str(e)}")
        
        if not predictor:
            raise Exception(f"SAM2 {model_size} 모델을 로드할 수 없습니다")
        
        sam2_models[model_size] = {
            "model": model,
            "predictor": predictor,
            "mask_generator": mask_generator,
            "device": device
        }
        
        print(f"SAM2 모델 로딩 완료 - {model_size}")
        return sam2_models[model_size]
        
    except Exception as e:
        print(f"SAM2 모델 로딩 실패: {str(e)}")
        return None

# 서버 시작 시 기본 모델 로드
try:
    load_sam2_model("large")  # 기본으로 large 모델 로드
except Exception as e:
    print(f"서버 시작 시 SAM2 모델 로딩 실패: {str(e)}")

# SAM2 세그멘테이션 처리
@router.post("/sam2")
async def process_sam2(image: UploadFile = File(...), params: str = Form(...)):
    """SAM2를 사용한 이미지 세그멘테이션 처리"""
    try:
        params = json.loads(params)
        print(f"[SAM2] 요청 파라미터: {params}")
    except json.JSONDecodeError as e:
        print(f"[SAM2] 파라미터 파싱 오류: {str(e)}")
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": f"파라미터 파싱 오류: {str(e)}"}
        )
    
    try:
        # 이미지 데이터 읽기
        image_data = await image.read()
        print(f"[SAM2] 이미지 데이터 크기: {len(image_data)} bytes")
        
        img = decode_image(image_data)
        original_format = img.format or "PNG"
        print(f"[SAM2] 이미지 형식: {original_format}, 크기: {img.size}")
        
        # 파라미터 추출
        alpha = float(params.get("alpha", 0.6))  # 알파 블렌딩 값 추가
        mask_color_mode = params.get("mask_color_mode", "Multi-Color")  # 마스크 색상 모드 추가

        points = params.get("points", [])
        point_labels = params.get("point_labels", [])
        boxes = params.get("boxes", [])
        
        print(f"[SAM2] 처리 시작 - 알파: {alpha}, 포인트: {len(points)}, 포인트 라벨: {len(point_labels)}, 박스: {len(boxes)}")
        # SAM2 관련 라이브러리 임포트
        try:
            import torch
            import numpy as np
            print(f"[SAM2] PyTorch 버전: {torch.__version__}")
            print(f"[SAM2] CUDA 사용 가능: {torch.cuda.is_available()}")
            if torch.cuda.is_available():
                print(f"[SAM2] CUDA 디바이스 수: {torch.cuda.device_count()}")
        except ImportError as e:
            print(f"[SAM2] 필수 라이브러리 임포트 오류: {str(e)}")
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": f"필수 라이브러리가 설치되지 않았습니다: {str(e)}"}
            )
        
        # 모델 로드 (캐시된 모델 사용 또는 새로 로드)
        model_data = sam2_models.get("large")  # 고정된 large 모델 사용
        if not model_data:
            model_data = load_sam2_model("large")
            
        if not model_data:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "SAM2 large 모델을 로드할 수 없습니다"}
            )
        
        predictor = model_data["predictor"]
        mask_generator = model_data["mask_generator"]
        device = model_data["device"]
        
        # 이미지를 numpy 배열로 변환
        img_rgb = img.convert('RGB')
        image_array = np.array(img_rgb)
        
        # 추론 모드에서 실행
        with torch.inference_mode():
            if device == "cuda":
                with torch.autocast("cuda", dtype=torch.bfloat16):
                    # 자동 마스크 생성 모드 - SAM2AutomaticMaskGenerator 사용
                    print("자동 마스크 생성 모드 실행 (SAM2AutomaticMaskGenerator)")
                    
                    # SAM2AutomaticMaskGenerator로 마스크 생성
                    masks = mask_generator.generate(image_array)
                    
                    height, width = image_array.shape[:2]
                    colored_mask = np.zeros((height, width, 3), dtype=np.uint8)
                    
                    # 색상 팔레트
                    if mask_color_mode == "All-White":
                        # All White 모드: 모든 마스크를 흰색으로
                        colors = [[255, 255, 255]]  # 흰색만
                    else:
                        # Multi Color 모드: 기존 다색 팔레트
                        colors = [
                            [255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0], [255, 0, 255],
                            [0, 255, 255], [255, 128, 0], [255, 0, 128], [128, 255, 0], [0, 255, 128],
                            [128, 0, 255], [0, 128, 255], [255, 128, 128], [128, 255, 128], [128, 128, 255]
                        ]
                    
                    # 생성된 마스크들을 색상으로 표시
                    for i, mask_data in enumerate(masks):
                        if mask_color_mode == "All-White":
                            # All White 모드: 모든 마스크를 흰색으로
                            mask = mask_data['segmentation']
                            colored_mask[mask] = [255, 255, 255]  # 흰색
                        else:
                            # Multi Color 모드: 기존 로직
                            if i >= len(colors):
                                break
                            mask = mask_data['segmentation']
                            color = colors[i % len(colors)]
                            colored_mask[mask] = color
                    
                    # 원본 이미지와 마스크 오버레이 (사용자 지정 알파 값 사용)
                    result_array = (image_array * (1 - alpha) + colored_mask * alpha).astype(np.uint8)
                    
            else:
                # CPU 모드
                # CPU에서 자동 마스크 생성
                print("자동 마스크 생성 모드 실행 (CPU)")
                
                # SAM2AutomaticMaskGenerator로 마스크 생성
                masks = mask_generator.generate(image_array)
                
                height, width = image_array.shape[:2]
                colored_mask = np.zeros((height, width, 3), dtype=np.uint8)
                
                # 색상 팔레트
                colors = [
                    [255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0], [255, 0, 255],
                    [0, 255, 255], [255, 128, 0], [255, 0, 128], [128, 255, 0], [0, 255, 128],
                    [128, 0, 255], [0, 128, 255], [255, 128, 128], [128, 255, 128], [128, 128, 255]
                ]
                
                # 생성된 마스크들을 색상으로 표시
                for i, mask_data in enumerate(masks):
                    if i >= len(colors):
                        break
                    mask = mask_data['segmentation']
                    color = colors[i % len(colors)]
                    colored_mask[mask] = color
                
                # 원본 이미지와 마스크 오버레이 (사용자 지정 알파 값 사용)
                result_array = (image_array * (1 - alpha) + colored_mask * alpha).astype(np.uint8)
        
        # 결과 이미지 생성
        result_img = Image.fromarray(result_array, 'RGB')
        result_img.format = original_format
        
        # 처리 정보 로깅
        print(f"SAM2 세그멘테이션 완료 - 모델: large, 디바이스: {device}, 알파: {alpha}")
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes, format_used = encode_image_to_bytes(result_img, format=original_format)
        
        # 적절한 MIME 타입 설정
        mime_type = f"image/{format_used.lower()}" if format_used != "JPEG" else "image/jpeg"
        
        # 응답 헤더에 처리 정보 추가
        headers = {
            "X-Process-Status": "success",
            "X-SAM2-Model": "large",
            "X-SAM2-Device": device,
            "X-SAM2-Alpha": str(alpha),
            "X-Image-Format": format_used
        }
        
        return Response(content=img_bytes, media_type=mime_type, headers=headers)
        
    except Exception as e:
        print(f"SAM2 세그멘테이션 오류: {str(e)}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"SAM2 처리 중 오류가 발생했습니다: {str(e)}"}
        ) 
    

# Opening 처리
@router.post("/opening")
async def process_opening(image: UploadFile = File(...), params: str = Form(...)):
    """Opening 처리 (Erosion + Dilation)"""
    params = json.loads(params)
    
    try:
        # 이미지 데이터 읽기
        image_data = await image.read()
        img = decode_image(image_data)
        original_format = img.format  # 원본 이미지 형식 저장
        
        # 파라미터 추출
        kernel_size = int(params.get("kernel_size", 5))
        kernel_type = params.get("kernel_type", "rect")  # rect, ellipse, cross
        
        # 커널 크기가 홀수인지 확인
        if kernel_size % 2 == 0:
            kernel_size += 1  # 짝수면 홀수로 만들기
        
        # PIL 이미지를 OpenCV로 변환
        cv_image = pil_to_cv2(img)
        
        # 커널 타입에 따른 커널 생성
        if kernel_type == "ellipse":
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
        elif kernel_type == "cross":
            kernel = cv2.getStructuringElement(cv2.MORPH_CROSS, (kernel_size, kernel_size))
        else:  # rect (기본값)
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_size, kernel_size))
        
        # Opening 적용 (Erosion + Dilation)
        result = cv2.morphologyEx(cv_image, cv2.MORPH_OPEN, kernel)
        
        # 결과 이미지 반환
        result_img = cv2_to_pil(result)
        
        # 원본 이미지 형식 유지
        result_img.format = original_format
        
        # 처리 정보 로깅
        print(f"Opening 처리: 커널크기={kernel_size}, 커널타입={kernel_type}, 형식: {original_format}")
        
        # 적절한 MIME 타입 설정
        mime_type = f"image/{original_format.lower()}" if original_format != "JPEG" else "image/jpeg"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes, format_used = encode_image_to_bytes(result_img, format=original_format)
        return Response(content=img_bytes, media_type=mime_type)
    except Exception as e:
        print(f"Opening 처리 오류: {str(e)}")
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": str(e)}
        )

# Closing 처리
@router.post("/closing")
async def process_closing(image: UploadFile = File(...), params: str = Form(...)):
    """Closing 처리 (Dilation + Erosion)"""
    params = json.loads(params)
    
    try:
        # 이미지 데이터 읽기
        image_data = await image.read()
        img = decode_image(image_data)
        original_format = img.format  # 원본 이미지 형식 저장
        
        # 파라미터 추출
        kernel_size = int(params.get("kernel_size", 5))
        kernel_type = params.get("kernel_type", "rect")  # rect, ellipse, cross
        
        # 커널 크기가 홀수인지 확인
        if kernel_size % 2 == 0:
            kernel_size += 1  # 짝수면 홀수로 만들기
        
        # PIL 이미지를 OpenCV로 변환
        cv_image = pil_to_cv2(img)
        
        # 커널 타입에 따른 커널 생성
        if kernel_type == "ellipse":
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
        elif kernel_type == "cross":
            kernel = cv2.getStructuringElement(cv2.MORPH_CROSS, (kernel_size, kernel_size))
        else:  # rect (기본값)
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_size, kernel_size))
        
        # Closing 적용 (Dilation + Erosion)
        result = cv2.morphologyEx(cv_image, cv2.MORPH_CLOSE, kernel)
        
        # 결과 이미지 반환
        result_img = cv2_to_pil(result)
        
        # 원본 이미지 형식 유지
        result_img.format = original_format
        
        # 처리 정보 로깅
        print(f"Closing 처리: 커널크기={kernel_size}, 커널타입={kernel_type}, 형식: {original_format}")
        
        # 적절한 MIME 타입 설정
        mime_type = f"image/{original_format.lower()}" if original_format != "JPEG" else "image/jpeg"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes, format_used = encode_image_to_bytes(result_img, format=original_format)
        return Response(content=img_bytes, media_type=mime_type)
    except Exception as e:
        print(f"Closing 처리 오류: {str(e)}")
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": str(e)}
        )
    


# HRNet 처리
@router.post("/hrnet")
async def process_hrnet(image: UploadFile = File(...), params: str = Form(...)):
    """HRNet을 사용한 이미지 세그멘테이션 처리"""
    params = json.loads(params)
    
    try:
        # 이미지 데이터 읽기
        image_data = await image.read()
        img = decode_image(image_data)
        original_format = img.format  # 원본 이미지 형식 저장
        
        # 파라미터 추출
        model_size = params.get("model_size", "hrnet18")
        confidence_threshold = float(params.get("confidence_threshold", 0.5))
        output_mode = params.get("output_mode", "segmentation")  # segmentation, keypoints, pose
        
        # PIL 이미지를 OpenCV로 변환
        cv_image = pil_to_cv2(img)
        
        # HRNet 모델 로드 (실제 구현에서는 모델 파일이 필요)
        # 여기서는 시뮬레이션된 결과를 반환
        print(f"HRNet 처리: 모델={model_size}, 신뢰도={confidence_threshold}, 출력모드={output_mode}")
        
        # HRNet 처리 시뮬레이션 (실제 구현 시에는 실제 모델 사용)
        if output_mode == "segmentation":
            # 세그멘테이션 결과 시뮬레이션
            height, width = cv_image.shape[:2]
            # 랜덤한 세그멘테이션 마스크 생성 (실제로는 모델 예측 결과)
            mask = np.random.randint(0, 256, (height, width), dtype=np.uint8)
            # 마스크를 컬러로 변환
            colored_mask = cv2.applyColorMap(mask, cv2.COLORMAP_JET)
            # 원본 이미지와 마스크 블렌딩
            alpha = 0.7
            result = cv2.addWeighted(cv_image, 1-alpha, colored_mask, alpha, 0)
        elif output_mode == "keypoints":
            # 키포인트 감지 시뮬레이션
            result = cv_image.copy()
            # 랜덤한 키포인트 생성
            num_keypoints = 17
            for i in range(num_keypoints):
                x = np.random.randint(50, width-50)
                y = np.random.randint(50, height-50)
                cv2.circle(result, (x, y), 3, (0, 255, 0), -1)
        else:  # pose
            # 포즈 추정 시뮬레이션
            result = cv_image.copy()
            # 랜덤한 포즈 라인 생성
            for i in range(5):
                x1, y1 = np.random.randint(50, width-50), np.random.randint(50, height-50)
                x2, y2 = np.random.randint(50, width-50), np.random.randint(50, height-50)
                cv2.line(result, (x1, y1), (x2, y2), (0, 255, 0), 2)
        
        # 결과 이미지 반환
        result_img = cv2_to_pil(result)
        
        # 원본 이미지 형식 유지
        result_img.format = original_format
        
        # 처리 정보 로깅
        print(f"HRNet 처리 완료: 모델={model_size}, 출력모드={output_mode}, 형식: {original_format}")
        
        # 적절한 MIME 타입 설정
        mime_type = f"image/{original_format.lower()}" if original_format != "JPEG" else "image/jpeg"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes, format_used = encode_image_to_bytes(result_img, format=original_format)
        return Response(content=img_bytes, media_type=mime_type)
    except Exception as e:
        print(f"HRNet 처리 오류: {str(e)}")
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": str(e)}
        )

# UNet + Attention 처리
@router.post("/unet_attention")
async def process_unet_attention(image: UploadFile = File(...), params: str = Form(...)):
    """UNet + Attention을 사용한 이미지 세그멘테이션 처리"""
    params = json.loads(params)
    
    try:
        # 이미지 데이터 읽기
        image_data = await image.read()
        img = decode_image(image_data)
        original_format = img.format  # 원본 이미지 형식 저장
        
        # 파라미터 추출
        attention_type = params.get("attention_type", "self")  # self, cross, spatial
        attention_heads = int(params.get("attention_heads", 8))
        dropout_rate = float(params.get("dropout_rate", 0.1))
        output_channels = int(params.get("output_channels", 1))
        
        # PIL 이미지를 OpenCV로 변환
        cv_image = pil_to_cv2(img)
        
        # UNet + Attention 처리 시뮬레이션
        print(f"UNet + Attention 처리: 어텐션타입={attention_type}, 헤드수={attention_heads}, 드롭아웃={dropout_rate}")
        
        # 어텐션 맵 시뮬레이션 생성
        height, width = cv_image.shape[:2]
        
        # 어텐션 타입에 따른 다른 처리
        if attention_type == "self":
            # Self-attention 시뮬레이션
            attention_map = np.random.rand(height, width).astype(np.float32)
            attention_map = cv2.GaussianBlur(attention_map, (15, 15), 0)
            attention_map = (attention_map * 255).astype(np.uint8)
            attention_colored = cv2.applyColorMap(attention_map, cv2.COLORMAP_HOT)
        elif attention_type == "cross":
            # Cross-attention 시뮬레이션
            attention_map = np.random.rand(height, width).astype(np.float32)
            attention_map = cv2.GaussianBlur(attention_map, (21, 21), 0)
            attention_map = (attention_map * 255).astype(np.uint8)
            attention_colored = cv2.applyColorMap(attention_map, cv2.COLORMAP_VIRIDIS)
        else:  # spatial
            # Spatial attention 시뮬레이션
            attention_map = np.random.rand(height, width).astype(np.float32)
            attention_map = cv2.GaussianBlur(attention_map, (25, 25), 0)
            attention_map = (attention_map * 255).astype(np.uint8)
            attention_colored = cv2.applyColorMap(attention_map, cv2.COLORMAP_PLASMA)
        
        # 원본 이미지와 어텐션 맵 블렌딩
        alpha = 0.6
        result = cv2.addWeighted(cv_image, 1-alpha, attention_colored, alpha, 0)
        
        # 세그멘테이션 결과 오버레이 (시뮬레이션)
        if output_channels > 1:
            # 다중 클래스 세그멘테이션
            segmentation_mask = np.random.randint(0, output_channels, (height, width), dtype=np.uint8)
            segmentation_colored = cv2.applyColorMap(segmentation_mask * (255 // output_channels), cv2.COLORMAP_TAB20)
            result = cv2.addWeighted(result, 0.7, segmentation_colored, 0.3, 0)
        
        # 결과 이미지 반환
        result_img = cv2_to_pil(result)
        
        # 원본 이미지 형식 유지
        result_img.format = original_format
        
        # 처리 정보 로깅
        print(f"UNet + Attention 처리 완료: 어텐션타입={attention_type}, 출력채널={output_channels}, 형식: {original_format}")
        
        # 적절한 MIME 타입 설정
        mime_type = f"image/{original_format.lower()}" if original_format != "JPEG" else "image/jpeg"
        
        # 이미지를 바이너리로 변환하여 반환
        img_bytes, format_used = encode_image_to_bytes(result_img, format=original_format)
        return Response(content=img_bytes, media_type=mime_type)
    except Exception as e:
        print(f"UNet + Attention 처리 오류: {str(e)}")
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": str(e)}
        )