from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse, Response
from typing import List, Dict, Any
import os
import shutil
from datetime import datetime
from PIL import Image, UnidentifiedImageError
import io

router = APIRouter()


@router.post("/upload")
async def upload_and_convert(
    file: UploadFile = File(...)
):
    """
    - 클라이언트에서 업로드된 어떤 이미지(TIFF, JPEG, PNG 등)를
    - 서버에서 PNG로 변환한 뒤
    - 바로 바이너리 스트림으로 반환합니다.
    """
    # print('접속 성공')
    try:
        # 1) 받는 파일을 메모리 버퍼로 읽기
        contents = await file.read()
        print(f"Debug: content_type={file.content_type}, size={len(contents)} bytes")

        # 2) Pillow로 이미지 열기
        input_buffer = io.BytesIO(contents)
        input_buffer.seek(0)
        with Image.open(input_buffer) as img:
            print(f"Debug: format={img.format}, mode={img.mode}, size={img.size}")

            # 3) 16비트 그레이스케일(I;16) 처리
            if img.mode == "I;16":
                # 픽셀값 i ∈ [0,65535] → i>>8 ∈ [0,255]
                img = img.point(lambda i: i >> 8)
                print("Debug: applied 16→8bit shift via point()")

            # 4) 모든 모드를 RGB로 통일
            img = img.convert("RGB")
            print(f"Debug: final mode={img.mode}")

            # 5) PNG로 저장
            output_buffer = io.BytesIO()
            img.save(output_buffer, format="PNG")
        output_bytes = output_buffer.getvalue()
        print(f"Debug: PNG header={output_bytes[:8]}, length={len(output_bytes)} bytes")

        # 6) 스트리밍 응답
        return Response(content=output_bytes, media_type="image/png")

    except UnidentifiedImageError:
        raise HTTPException(
            status_code=415,
            detail="지원하지 않는 이미지 포맷입니다."
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"이미지 변환 중 오류 발생: {e}"
        )

@router.get("/list")
async def get_images():
    try:
        # 업로드된 이미지 목록 조회
        images = []
        for filename in os.listdir(UPLOAD_DIR):
            if filename.endswith(('.jpg', '.jpeg', '.png')):
                images.append({
                    "filename": filename,
                    "path": os.path.join(UPLOAD_DIR, filename),
                    "upload_time": os.path.getctime(os.path.join(UPLOAD_DIR, filename))
                })
        return {"status": "success", "images": images}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 

