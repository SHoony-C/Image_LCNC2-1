from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
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
        input_buffer = io.BytesIO(contents)

        # 2) Pillow로 열기 (TIFF 포함 대부분 포맷 지원)
        img = Image.open(input_buffer)

        # 3) RGBA 모드로 변환 (투명도 필요시)
        if img.mode not in ("RGBA", "RGB"):
            img = img.convert("RGBA")

        # 4) PNG 포맷으로 다시 메모리 버퍼에 저장
        output_buffer = io.BytesIO()
        img.save(output_buffer, format="PNG")
        output_buffer.seek(0)

        # 5) 클라이언트에 스트리밍으로 반환
        return StreamingResponse(output_buffer, media_type="image/png")

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

