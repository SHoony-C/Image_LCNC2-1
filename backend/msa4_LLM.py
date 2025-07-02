from fastapi import APIRouter, HTTPException, UploadFile, File, Query, Body
from fastapi.responses import StreamingResponse
from typing import List, Dict, Any, Optional
import os
import shutil
from datetime import datetime
import json
from pathlib import Path
import openai
import asyncio
from pydantic import BaseModel
import requests
import logging

# asyncio 소켓 경고 무시 설정
logging.getLogger('asyncio').setLevel(logging.ERROR)

router = APIRouter()

STORAGE_DIR = "./storage"
IMAGES_DIR = os.path.join(STORAGE_DIR, "images")  # 이미지 저장 디렉토리 추가
os.makedirs(STORAGE_DIR, exist_ok=True)
os.makedirs(IMAGES_DIR, exist_ok=True)  # 이미지 저장 디렉토리 생성


OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "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")
if OPENAI_API_KEY and OPENAI_API_KEY != "your-openai-api-key-here":
    openai.api_key = OPENAI_API_KEY
    USE_OPENAI = True
else:
    USE_OPENAI = False
    print("Warning: OpenAI API key not found. Using dummy responses.")

# 현재 처리 중인 요청을 추적하기 위한 변수
current_processing = False

# 요청 모델 정의
class ChatRequest(BaseModel):
    type: str  # 'single', 'multiple', or 'chat'
    data: Optional[List[Dict[str, Any]]] = None
    message: Optional[str] = None
    history: Optional[List[Dict[str, Any]]] = None
    images: Optional[List[Dict[str, Any]]] = None

@router.post("/store")
async def store_image(file: UploadFile = File(...)):
    try:
        # 파일 저장 (원본 파일명 그대로 사용)
        filename = file.filename
        file_path = os.path.join(IMAGES_DIR, filename)
        
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
        for filename in os.listdir(IMAGES_DIR):
            if filename.endswith(('.jpg', '.jpeg', '.png')):
                images.append({
                    "filename": filename,
                    "path": os.path.join(IMAGES_DIR, filename),
                    "store_time": os.path.getctime(os.path.join(IMAGES_DIR, filename))
                })
        return {"status": "success", "images": images}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 타임스탬프 제거 함수 유지 (다른 함수에서 사용 가능)
def remove_timestamp(filename):
    """파일명에서 타임스탬프(YYYYMMDD_HHMMSS_) 형식만 제거합니다."""
    import re
    return re.sub(r'^\d{8}_\d{6}_', '', filename)

@router.post("/load-local-images")
async def load_local_images(directory_path: Optional[str] = Query(None, description="로컬 이미지가 있는 디렉토리 경로"), 
                            data: Optional[Dict[str, Any]] = Body(None)):
    """
    지정된 로컬 디렉토리에서 이미지를 로드합니다.
    이제 벡터 추출은 side_5_settings.py에서 처리합니다.
    """
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
        
        # 태그 옵션 확인
        tag = "Unknown"
        if data and "tag" in data:
            tag = data["tag"]
        
        print(f"필터링 옵션 상태: includeBeforeImagesOnly = {include_before_only}, tag = {tag}")
        
        if not path:
            raise HTTPException(status_code=400, detail="Directory path is required")
            
        # 지정된 디렉토리가 존재하는지 확인
        if not os.path.exists(path):
            raise HTTPException(status_code=404, detail=f"Directory not found: {path}")
        
        # 이미지 디렉토리 확인 및 생성
        os.makedirs(IMAGES_DIR, exist_ok=True)
        
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
                        # 이미지 파일을 스토리지에 복사
                        destination_path = os.path.join(IMAGES_DIR, filename)
                        shutil.copy2(file_path, destination_path)
                        
                        processed_images.append({
                            "original_path": file_path,
                            "stored_filename": filename,
                            "stored_path": f"/api/imageanalysis/images/{filename}",  # API URL 경로 업데이트
                            "tag": tag
                        })
                        
                        print(f"Processed and saved image: {filename} with tag: {tag}")
                    except Exception as e:
                        errors.append({
                            "filename": filename,
                            "error": str(e)
                        })
                        print(f"Error processing image {filename}: {str(e)}")
        
        # 처리된 결과를 로그로 요약
        print(f"필터링 결과: 선택된 파일 {len(filtered_files)}개, 제외된 파일 {len(skipped_files)}개")
        if filtered_files:
            print(f"필터링 통과 파일: {filtered_files}")
        if skipped_files:
            print(f"필터링 제외 파일: {skipped_files}")
        
        print(f"처리 결과: 총 {len(processed_images)}개 이미지 처리됨, {len(errors)}개 오류 발생")
        if processed_images:
            print(f"처리된 파일: {[img['stored_filename'] for img in processed_images]}")
        
        return {
            "status": "success" if not errors or processed_images else "partial_success" if errors and processed_images else "error",
            "message": f"Processed {len(processed_images)} images with {len(errors)} errors",
            "processed": processed_images,
            "errors": errors,
            "tag": tag
        }
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"Error in load_local_images: {str(e)}\n{error_detail}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/load-test-images")
async def load_test_images():
    """테스트 이미지를 로드합니다. (더미 기능)"""
    return {"status": "success", "message": "Test images loaded successfully"}

@router.post("/chats/")
async def process_analysis_chat(request: ChatRequest):
    """
    Analysis 이미지의 txt 파일 내용들을 받아서 ChatGPT API로 분석 요청
    """
    global current_processing
    
    # 이미 처리 중이라면 pass
    if current_processing:
        return {"status": "busy", "message": "Already processing another request"}
    
    try:
        current_processing = True
        
        # 받은 데이터 검증
        if not request.data and not request.message:
            raise HTTPException(status_code=400, detail="No data or message provided")
        
        # 요청 타입에 따른 프롬프트 구성
        if request.type == 'chat':
            # 채팅 요청 처리
            messages = []
            
            # 시스템 메시지
            system_content = "당신은 도움이 되는 AI 어시스턴트입니다."
            if request.images and len(request.images) > 0:
                system_content += " 현재 분석 중인 이미지들의 정보를 참고하여 답변해주세요."
            messages.append({"role": "system", "content": system_content})
            
            # 이전 대화 이력 추가
            if request.history:
                for msg in request.history:
                    role = msg.get('role', 'user')
                    content = msg.get('content', '')
                    if content.strip():
                        messages.append({"role": role, "content": content})
            
            # 현재 이미지 정보가 있다면 컨텍스트에 추가
            if request.images and len(request.images) > 0:
                context_parts = ["\n[현재 분석 중인 이미지 정보]"]
                for img in request.images:
                    img_name = img.get('imageName', '알 수 없는 이미지')
                    similarity = img.get('similarity', 0)
                    text_content = img.get('textContent', '')
                    context_parts.append(f"- {img_name} (유사도: {similarity:.1f}%)")
                    if text_content:
                        context_parts.append(f"  내용: {text_content[:200]}...")
                
                context_message = "\n".join(context_parts)
                current_message = f"{context_message}\n\n사용자 질문: {request.message}"
            else:
                current_message = request.message
            
            messages.append({"role": "user", "content": current_message})
            
        else:
            # 기존 이미지 분석 요청 처리
            prompt_parts = ["다음은 이미지 분석 결과들입니다. 이 내용들을 종합하여 분석해주세요:\n\n"]
            
            if request.data:
                for i, item in enumerate(request.data, 1):
                    image_name = item.get('imageName', f'이미지_{i}')
                    text_content = item.get('textContent', '')
                    similarity = item.get('similarity', 0)
                    
                    prompt_parts.append(f"=== {image_name} (유사도: {similarity:.1f}%) ===")
                    prompt_parts.append(text_content)
                    prompt_parts.append("\n" + "="*50 + "\n")
            
            prompt_parts.append("\n위 분석 결과들을 바탕으로 다음 사항들을 종합적으로 분석해주세요:")
            prompt_parts.append("1. 주요 특징과 패턴")
            prompt_parts.append("2. 공통점과 차이점")
            prompt_parts.append("3. 개선 방향 제안")
            prompt_parts.append("4. 종합 결론")
            
            full_prompt = "\n".join(prompt_parts)
            messages = [
                {"role": "system", "content": "당신은 이미지 분석 전문가입니다. 제공된 분석 데이터를 바탕으로 전문적이고 상세한 분석을 제공해주세요."},
                {"role": "user", "content": full_prompt}
            ]
        
        # ChatGPT API 스트리밍 응답 생성
        async def generate_stream():
            try:
                if USE_OPENAI:
                    # 실제 OpenAI API 호출
                    response = openai.ChatCompletion.create(
                        model="gpt-3.5-turbo",
                        messages=messages,
                        stream=True,
                        max_tokens=2000,
                        temperature=0.7
                    )
                    
                    for chunk in response:
                        if chunk.choices[0].delta.get("content"):
                            content = chunk.choices[0].delta.content
                            try:
                                yield f"data: {json.dumps({'content': content})}\n\n"
                                # 청크 사이에 지연 추가하여 다른 API 처리 가능하도록 함
                                await asyncio.sleep(0.01)
                            except (ConnectionResetError, BrokenPipeError, OSError, ConnectionAbortedError, ConnectionError) as e:
                                # 클라이언트 연결이 끊어진 경우 조용히 종료
                                print(f"Client disconnected during streaming: {type(e).__name__}")
                                return
                            except Exception as e:
                                print(f"Unexpected error during streaming: {str(e)}")
                                return
                else:
                    # 더미 응답 생성
                    if request.type == 'chat':
                        # 채팅 요청에 대한 더미 응답
                        dummy_response = f"""안녕하세요! 저는 이미지 분석 어시스턴트입니다.

현재 질문: {request.message}

"""
                        if request.images and len(request.images) > 0:
                            dummy_response += f"현재 {len(request.images)}개의 이미지가 분석 중입니다:\n"
                            for img in request.images:
                                img_name = img.get('imageName', '알 수 없는 이미지')
                                similarity = img.get('similarity', 0)
                                dummy_response += f"- {img_name} (유사도: {similarity:.1f}%)\n"
                            dummy_response += "\n"
                        
                        dummy_response += """이 질문에 대해 도움을 드리고 싶지만, 현재 OpenAI API 키가 설정되지 않아 더미 응답을 제공하고 있습니다.

실제 환경에서는 다음과 같은 도움을 받으실 수 있습니다:
- 이미지 분석 결과에 대한 상세한 설명
- 분석 데이터를 바탕으로 한 질문 답변
- 개선 방향 및 추천 사항 제공

API 키를 설정하시면 더 정확하고 유용한 답변을 받으실 수 있습니다."""
                    else:
                        # 기존 이미지 분석에 대한 더미 응답
                        data_count = len(request.data) if request.data else 0
                        dummy_response = f"""
## 이미지 분석 결과 종합

### 1. 주요 특징과 패턴
분석된 {data_count}개의 이미지에서 다음과 같은 주요 특징들이 발견되었습니다:

- **공통 특성**: 모든 이미지에서 일관된 품질과 구조적 특성을 보입니다.
- **시각적 패턴**: 색상 분포와 형태적 특성에서 유사한 패턴이 관찰됩니다.
- **기술적 특성**: 해상도와 압축 방식에서 표준화된 특성을 나타냅니다.

### 2. 공통점과 차이점

**공통점:**
- 모든 이미지가 동일한 카테고리에 속하는 특성을 보입니다.
- 유사한 촬영 조건과 환경에서 생성된 것으로 추정됩니다.

**차이점:**
- 각 이미지별로 고유한 세부 특성들이 존재합니다.
- 유사도 점수에 따른 품질 차이가 관찰됩니다.

### 3. 개선 방향 제안

1. **품질 향상**: 낮은 유사도를 보이는 이미지들의 품질 개선이 필요합니다.
2. **표준화**: 이미지 처리 과정의 표준화를 통한 일관성 확보가 권장됩니다.
3. **분류 체계**: 더 정확한 분류를 위한 추가적인 특성 분석이 필요합니다.

### 4. 종합 결론

분석된 이미지들은 전반적으로 양호한 품질을 보이며, 적절한 분류 체계 하에 관리되고 있습니다. 
향후 지속적인 품질 관리와 개선을 통해 더욱 정확한 분석 결과를 얻을 수 있을 것으로 예상됩니다.

*참고: 이 분석은 OpenAI API 키가 설정되지 않아 더미 데이터로 생성된 결과입니다.*
                        """
                    
                    # 더미 응답을 청크 단위로 전송
                    words = dummy_response.split()
                    for i, word in enumerate(words):
                        try:
                            if i > 0 and i % 3 == 0:  # 3단어씩 묶어서 전송
                                await asyncio.sleep(0.05)  # 더미 응답도 적절한 지연으로 조정
                            yield f"data: {json.dumps({'content': word + ' '})}\n\n"
                        except (ConnectionResetError, BrokenPipeError, OSError, ConnectionAbortedError, ConnectionError) as e:
                            # 클라이언트 연결이 끊어진 경우 조용히 종료
                            print(f"Client disconnected during streaming: {type(e).__name__}")
                            return
                        except Exception as e:
                            print(f"Unexpected error during streaming: {str(e)}")
                            return
                
                try:
                    yield f"data: {json.dumps({'done': True})}\n\n"
                except (ConnectionResetError, BrokenPipeError, OSError, ConnectionAbortedError, ConnectionError):
                    # 클라이언트가 이미 연결을 끊은 경우 무시
                    print("Client disconnected before completion")
                    return
                except Exception as e:
                    print(f"Error sending completion signal: {str(e)}")
                    return
                
            except Exception as e:
                try:
                    error_msg = f"분석 처리 오류: {str(e)}"
                    yield f"data: {json.dumps({'error': error_msg})}\n\n"
                except (ConnectionResetError, BrokenPipeError, OSError, ConnectionAbortedError, ConnectionError):
                    # 에러 메시지도 전송할 수 없는 경우 (클라이언트 연결 끊김)
                    print("Client disconnected, cannot send error message")
                except Exception:
                    print(f"Failed to send error message: {str(e)}")
            finally:
                global current_processing
                current_processing = False
        
        return StreamingResponse(
            generate_stream(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*"
            }
        )
        
    except Exception as e:
        current_processing = False
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/chats/status")
async def get_chat_status():
    """현재 채팅 처리 상태 확인"""
    return {"processing": current_processing}

@router.get("/fetch-txt/{image_name}")
async def fetch_txt_from_iis(image_name: str):
    """
    IIS 서버(8091 포트)에서 txt 파일을 프록시로 가져옵니다.
    CORS 문제를 해결하기 위한 백엔드 프록시 엔드포인트입니다.
    """
    try:
        # 유효하지 않은 이미지명 필터링
        if not image_name or image_name == 'image':
            print(f"MSA4 Backend: Invalid image name: {image_name}")
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid image name: {image_name}"
            )
        
        # IIS 서버의 txt 파일 URL
        txt_url = f"http://localhost:8091/additional_images/{image_name}.txt"
        
        print(f"MSA4 Backend: Fetching txt from IIS server: {txt_url}")
        
        # IIS 서버에서 txt 파일 가져오기
        response = requests.get(txt_url, timeout=10)
        
        if response.status_code == 200:
            text_content = response.text
            print(f"MSA4 Backend: Successfully fetched txt for {image_name}")
            return {
                "status": "success",
                "imageName": f"{image_name}.png",  # 확장자 추가
                "textContent": text_content
            }
        else:
            print(f"MSA4 Backend: IIS server returned {response.status_code} for {txt_url}")
            raise HTTPException(
                status_code=response.status_code, 
                detail=f"IIS server returned {response.status_code}"
            )
            
    except requests.exceptions.RequestException as e:
        print(f"MSA4 Backend: Failed to fetch txt from IIS server: {str(e)}")
        raise HTTPException(
            status_code=503, 
            detail=f"Failed to connect to IIS server: {str(e)}"
        )
    except HTTPException:
        # HTTPException은 그대로 다시 발생시킴
        raise
    except Exception as e:
        print(f"MSA4 Backend: Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) 