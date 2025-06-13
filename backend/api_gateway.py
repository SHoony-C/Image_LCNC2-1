from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from typing import List, Dict, Optional, Any
import httpx
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from fastapi.responses import JSONResponse, Response
from fastapi import Request
import motor.motor_asyncio
import traceback
import re
import uuid

# Load environment variables
load_dotenv()

# Initialize API Router
api_gateway_app = APIRouter(
    prefix="/auth",
    tags=["인증 및 게이트웨이"],
    responses={404: {"description": "Not found"}}
)

# Security settings
SECRET_KEY = os.getenv("SECRET_KEY", "defaultsecretkey")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Password context for hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

# Service URLs
IMAGE_SERVICE_URL = os.getenv("IMAGE_SERVICE_URL", "http://localhost:8001")
LLM_SERVICE_URL = os.getenv("LLM_SERVICE_URL", "http://localhost:8002")
WORKFLOW_SERVICE_URL = os.getenv("WORKFLOW_SERVICE_URL", "http://localhost:8003")

# HTTP Client
http_client = httpx.AsyncClient()

# MongoDB Connection
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
mongodb_client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URL)
db = mongodb_client["image_app"]  # Database name as specified by user
workflow_collection = db["image_workflow"]  # Collection name as specified by user

# Models
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class User(BaseModel):
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    disabled: Optional[bool] = None

class UserInDB(User):
    hashed_password: str

# Mock user database - replace with actual database in production
fake_users_db = {
    "testuser": {
        "username": "testuser",
        "full_name": "Test User",
        "email": "testuser@example.com",
        "hashed_password": pwd_context.hash("testpassword"),
        "disabled": False,
    }
}

# Authentication functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def get_user(db, username: str):
    if username in db:
        user_dict = db[username]
        return UserInDB(**user_dict)

def authenticate_user(fake_db, username: str, password: str):
    user = get_user(fake_db, username)
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = get_user(fake_users_db, username=token_data.username)
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)):
    if current_user.disabled:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

# Authentication endpoints
@api_gateway_app.post("/token", response_model=Token, tags=["인증"])
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(fake_users_db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@api_gateway_app.get("/me", response_model=User, tags=["사용자"])
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    return current_user

# Root endpoint
@api_gateway_app.get("/", tags=["정보"])
async def root():
    return {"message": "Welcome to Authentication and API Gateway Service"}

# Image Service Routes
@api_gateway_app.post("/images/upload", tags=["이미지"])
async def upload_image(current_user: User = Depends(get_current_active_user)):
    response = await http_client.post(f"{IMAGE_SERVICE_URL}/upload")
    return response.json()

@api_gateway_app.get("/images/{image_id}", tags=["이미지"])
async def get_image(image_id: str, current_user: User = Depends(get_current_active_user)):
    response = await http_client.get(f"{IMAGE_SERVICE_URL}/images/{image_id}")
    return response.json()

@api_gateway_app.post("/images/{image_id}/preprocess", tags=["이미지"])
async def preprocess_image(image_id: str, current_user: User = Depends(get_current_active_user)):
    response = await http_client.post(f"{IMAGE_SERVICE_URL}/images/{image_id}/preprocess")
    return response.json()

# LLM Service Routes
@api_gateway_app.post("/llm/analyze", tags=["LLM"])
async def analyze_image(current_user: User = Depends(get_current_active_user)):
    response = await http_client.post(f"{LLM_SERVICE_URL}/analyze")
    return response.json()

@api_gateway_app.get("/llm/results/{analysis_id}", tags=["LLM"])
async def get_llm_results(analysis_id: str, current_user: User = Depends(get_current_active_user)):
    response = await http_client.get(f"{LLM_SERVICE_URL}/results/{analysis_id}")
    return response.json()

# Workflow Service Routes
@api_gateway_app.post("/workflows/create", tags=["워크플로우"])
async def create_workflow(current_user: User = Depends(get_current_active_user)):
    response = await http_client.post(f"{WORKFLOW_SERVICE_URL}/workflows/create")
    return response.json()

@api_gateway_app.get("/workflows", tags=["워크플로우"])
async def list_workflows(current_user: User = Depends(get_current_active_user)):
    response = await http_client.get(f"{WORKFLOW_SERVICE_URL}/workflows")
    return response.json()

@api_gateway_app.get("/workflows/{workflow_id}", tags=["워크플로우"])
async def get_workflow(workflow_id: str, current_user: User = Depends(get_current_active_user)):
    response = await http_client.get(f"{WORKFLOW_SERVICE_URL}/workflows/{workflow_id}")
    return response.json()

@api_gateway_app.put("/workflows/{workflow_id}", tags=["워크플로우"])
async def update_workflow(workflow_id: str, current_user: User = Depends(get_current_active_user)):
    response = await http_client.put(f"{WORKFLOW_SERVICE_URL}/workflows/{workflow_id}")
    return response.json()

@api_gateway_app.delete("/workflows/{workflow_id}", tags=["워크플로우"])
async def delete_workflow(workflow_id: str, current_user: User = Depends(get_current_active_user)):
    response = await http_client.delete(f"{WORKFLOW_SERVICE_URL}/workflows/{workflow_id}")
    return response.json()

# Add a completion endpoint for MSA4
@api_gateway_app.post("/completion")
async def get_completion(request: Request):
    try:
        data = await request.json()
        prompt = data.get("prompt", "")
        context = data.get("context", "")
        
        if not prompt:
            return JSONResponse(
                status_code=400,
                content={"error": "Prompt is required"}
            )
        
        # Construct the full prompt with context
        full_prompt = f"Context information about the image:\n{context}\n\nQuestion: {prompt}\n\nAnswer:"
        
        try:
            # Here you would integrate with your actual LLM service
            # For demonstration, we'll just return a mock response
            
            # Example of how you might call an external API:
            # response = requests.post(
            #     "https://api.openai.com/v1/completions",
            #     headers={
            #         "Authorization": f"Bearer {openai_api_key}",
            #         "Content-Type": "application/json"
            #     },
            #     json={
            #         "model": "gpt-3.5-turbo-instruct",
            #         "prompt": full_prompt,
            #         "max_tokens": 500
            #     }
            # )
            # result = response.json()
            # ai_response = result.get("choices", [{}])[0].get("text", "")
            
            # For now, generate a simple mock response
            mock_responses = [
                f"Based on the image analysis, I can see that this image shows {prompt.lower()}. The image contains features that are commonly associated with this type of content.",
                f"The image you're asking about appears to be related to {prompt.lower()}. According to the context information, there are several key elements visible.",
                f"From analyzing the image data, I can tell you that {prompt.lower()} is present in the image. The context information provides additional details about the specific characteristics."
            ]
            import random
            ai_response = random.choice(mock_responses)
            
            return JSONResponse(
                status_code=200, 
                content={"response": ai_response}
            )
        except Exception as e:
            return JSONResponse(
                status_code=500,
                content={"error": f"LLM service error: {str(e)}"}
            )
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"error": f"Invalid request: {str(e)}"}
        )

# Add an endpoint to fetch workflow data for I-app images
@api_gateway_app.get("/workflow/by-image/{image_filename}")
async def get_workflow_by_image(image_filename: str):
    try:
        print("\n\n======== WORKFLOW API ENDPOINT START ========")
        print(f"Original image filename (encoded): {image_filename}")
        
        # 세션 고유 ID 생성 (로그 추적용)
        session_id = str(uuid.uuid4())[:8]
        print(f"Session ID: {session_id}")
        
        # MongoDB 연결 상태 확인 
        print(f"[{session_id}] 1. MongoDB 연결 상태 확인 중...")
        try:
            # ping 테스트
            ping_result = await db.command({"ping": 1})
            if ping_result.get("ok") == 1:
                print(f"[{session_id}] ✅ MongoDB 연결 성공: {ping_result}")
            else:
                print(f"[{session_id}] ❌ MongoDB 연결 실패: {ping_result}")
        except Exception as ping_error:
            print(f"[{session_id}] ❌ MongoDB 연결 오류: {str(ping_error)}")
            print(traceback.format_exc())
        
        # URL 디코딩 시도
        try:
            from urllib.parse import unquote
            decoded_filename = unquote(image_filename)
            print(f"[{session_id}] Decoded filename: {decoded_filename}")
            # 원본과 디코딩된 결과가 다른 경우 확인
            if decoded_filename != image_filename:
                print(f"[{session_id}] URL was encoded. Original: {image_filename}, Decoded: {decoded_filename}")
                # 디코딩된 이름을 사용
                image_filename = decoded_filename
        except Exception as decode_error:
            print(f"[{session_id}] Error decoding URL: {str(decode_error)}")
        
        print(f"[{session_id}] API endpoint route: /api/workflow/by-image/{image_filename}")
        print(f"[{session_id}] Request time: {datetime.now().isoformat()}")
        
        # 원본 파일명 바이트로 출력 (인코딩 문제 디버깅용)
        print(f"[{session_id}] Filename as bytes: {image_filename.encode('utf-8')}")
        
        # Remove "_before" suffix and file extensions from the filename for MongoDB search
        import re
        search_filename = image_filename
        original_search_filename = search_filename
        # First remove _before suffix if present
        search_filename = search_filename.replace("_before", "")
        if original_search_filename != search_filename:
            print(f"[{session_id}] Removed '_before' suffix: {search_filename}")
        
        # Then remove any file extension (.png, .jpg, etc.) if present
        original_search_filename = search_filename
        search_filename = re.sub(r'\.(png|jpg|jpeg|gif|bmp|tiff|webp)$', '', search_filename, flags=re.IGNORECASE)
        if original_search_filename != search_filename:
            print(f"[{session_id}] Removed file extension: {search_filename}")
        
        print(f"[{session_id}] Final search filename: {search_filename}")
        print(f"[{session_id}] 2. 데이터베이스 및 컬렉션 정보:")
        
        # MongoDB 연결 정보 출력
        print(f"[{session_id}] MongoDB connection: {MONGODB_URL}")
        print(f"[{session_id}] MongoDB database name: {db.name}")
        print(f"[{session_id}] MongoDB collection name: {workflow_collection.name}")
        
        # 컬렉션 존재 확인
        print(f"[{session_id}] 3. 컬렉션 존재 확인 중...")
        try:
            # Additional debugging - show all collections
            collections = await db.list_collection_names()
            print(f"[{session_id}] Available collections in database: {', '.join(collections)}")
            
            # 컬렉션 존재 여부 확인
            if workflow_collection.name in collections:
                print(f"[{session_id}] ✅ 컬렉션 '{workflow_collection.name}' 존재함")
            else:
                print(f"[{session_id}] ❌ 컬렉션 '{workflow_collection.name}' 존재하지 않음")
                return JSONResponse(
                    status_code=500,
                    content={
                        "error": f"Collection '{workflow_collection.name}' does not exist",
                        "is_demo_data": False,
                        "timestamp": datetime.now().isoformat()
                    }
                )
        except Exception as coll_error:
            print(f"[{session_id}] ❌ 컬렉션 확인 오류: {str(coll_error)}")
            print(traceback.format_exc())
        
        # 컬렉션 문서 수 확인
        try:
            print(f"[{session_id}] 4. 컬렉션 문서 수 확인 중...")
            doc_count = await workflow_collection.count_documents({})
            print(f"[{session_id}] Total documents in collection: {doc_count}")
            
            if doc_count == 0:
                print(f"[{session_id}] ⚠️ 컬렉션에 문서가 없음")
            else:
                print(f"[{session_id}] ✅ 컬렉션에 {doc_count}개 문서 존재")
        except Exception as count_error:
            print(f"[{session_id}] ❌ 문서 수 확인 오류: {str(count_error)}")
        
        # Query MongoDB for the workflow data
        workflow_data = None
        
        print(f"[{session_id}] 5. 워크플로우 검색 시작...")
        try:
            # Try to find the workflow by workflow_name field matching the search_filename
            exact_query = {"workflow_name": search_filename}
            print(f"[{session_id}] 5.1. 정확한 일치 검색: db.{workflow_collection.name}.findOne({exact_query})")
            
            # 검색 시작 시간
            search_start = datetime.now()
            workflow_data = await workflow_collection.find_one(exact_query)
            search_duration = (datetime.now() - search_start).total_seconds()
            print(f"[{session_id}] 검색 소요 시간: {search_duration:.4f}초")
            
            # Print query result
            if workflow_data:
                print(f"[{session_id}] ✅ 정확한 일치 검색 성공: _id={workflow_data.get('_id')}")
                print(f"[{session_id}] 문서 필드: {list(workflow_data.keys())}")
                print(f"[{session_id}] workflow_name: {workflow_data.get('workflow_name', 'N/A')}")
            else:
                print(f"[{session_id}] ❌ 정확한 일치 검색 실패")
                
                # 모든 워크플로우 이름 조회 (디버깅용)
                print(f"[{session_id}] 5.2. 전체 워크플로우 이름 목록 조회 중...")
                try:
                    cursor = workflow_collection.find({}, {"workflow_name": 1})
                    workflow_names = []
                    async for doc in cursor:
                        if "workflow_name" in doc:
                            workflow_names.append(doc["workflow_name"])
                    
                    print(f"[{session_id}] 전체 워크플로우 이름 목록 ({len(workflow_names)}개): {workflow_names}")
                    
                    # 검색 키워드와 유사한 워크플로우 찾기
                    similar_names = []
                    for name in workflow_names:
                        if name and search_filename and (
                            search_filename in name or 
                            name in search_filename or
                            (len(name) > 2 and len(search_filename) > 2 and 
                             name[:2] == search_filename[:2])
                        ):
                            similar_names.append(name)
                    
                    if similar_names:
                        print(f"[{session_id}] 유사한 워크플로우 이름: {similar_names}")
                    else:
                        print(f"[{session_id}] 유사한 워크플로우 이름 없음")
                except Exception as list_error:
                    print(f"[{session_id}] ❌ 워크플로우 이름 목록 조회 오류: {str(list_error)}")
                
                # Try case-insensitive search
                print(f"[{session_id}] 5.3. 대소문자 무시 검색 시작...")
                try:
                    case_insensitive_query = {"workflow_name": {"$regex": f"^{re.escape(search_filename)}$", "$options": "i"}}
                    print(f"[{session_id}] 쿼리: {case_insensitive_query}")
                    cursor = workflow_collection.find(case_insensitive_query)
                    
                    docs_found = 0
                    async for doc in cursor:
                        docs_found += 1
                        workflow_data = doc
                        print(f"[{session_id}] ✅ 대소문자 무시 검색 성공: {doc.get('workflow_name')}")
                        break
                    
                    if docs_found == 0:
                        print(f"[{session_id}] ❌ 대소문자 무시 검색 실패")
                except Exception as case_error:
                    print(f"[{session_id}] ❌ 대소문자 무시 검색 오류: {str(case_error)}")
                
                # Try partial match on workflow_name
                if not workflow_data:
                    print(f"[{session_id}] 5.4. 부분 일치 검색 시작...")
                    try:
                        partial_query = {"workflow_name": {"$regex": search_filename, "$options": "i"}}
                        print(f"[{session_id}] 쿼리: {partial_query}")
                        cursor = workflow_collection.find(partial_query)
                        
                        docs_found = 0
                        async for doc in cursor:
                            docs_found += 1
                            if docs_found == 1:  # Use first match
                                workflow_data = doc
                                print(f"[{session_id}] ✅ 부분 일치 검색 성공: {doc.get('workflow_name')}")
                        
                        if docs_found == 0:
                            print(f"[{session_id}] ❌ 부분 일치 검색 실패")
                    except Exception as partial_error:
                        print(f"[{session_id}] ❌ 부분 일치 검색 오류: {str(partial_error)}")
                
                # Try direct collection access
                if not workflow_data:
                    print(f"[{session_id}] 5.5. 직접 컬렉션 접근 테스트...")
                    try:
                        # 아무 문서나 하나 가져오기
                        any_doc = await workflow_collection.find_one({})
                        if any_doc:
                            print(f"[{session_id}] ✅ 컬렉션 접근 성공: _id={any_doc.get('_id')}")
                            print(f"[{session_id}] 문서 필드: {list(any_doc.keys())}")
                        else:
                            print(f"[{session_id}] ❌ 컬렉션 접근 실패: 문서가 없음")
                    except Exception as access_error:
                        print(f"[{session_id}] ❌ 컬렉션 접근 오류: {str(access_error)}")
        except Exception as db_error:
            print(f"[{session_id}] ❌ 워크플로우 검색 오류: {str(db_error)}")
            print(traceback.format_exc())
        
        # If workflow data found, return it
        print(f"[{session_id}] 6. 검색 결과 처리 중...")
        if workflow_data:
            print(f"[{session_id}] ✅ 워크플로우 데이터 찾음")
            # MongoDB returns _id as ObjectId which is not JSON serializable
            if "_id" in workflow_data:
                workflow_data["_id"] = str(workflow_data["_id"])
                
            print(f"[{session_id}] 워크플로우 데이터 키: {workflow_data.keys()}")
            print(f"[{session_id}] 워크플로우 이름: {workflow_data.get('workflow_name', 'N/A')}")
            
            response_data = {
                "workflow": workflow_data,
                "is_demo_data": False,
                "timestamp": datetime.now().isoformat(),
                "search_criteria": {
                    "original_filename": image_filename,
                    "processed_filename": search_filename
                }
            }
            print(f"[{session_id}] ✅ 워크플로우 데이터 반환 완료")
            print(f"[{session_id}] ======== WORKFLOW API ENDPOINT END ========\n")
            return JSONResponse(
                status_code=200,
                content=response_data
            )
        
        # No data found, return 404 error
        print(f"[{session_id}] ❌ 워크플로우 데이터 찾지 못함")
        print(f"[{session_id}] All search attempts exhausted, returning 404 error")
        print(f"[{session_id}] ======== WORKFLOW API ENDPOINT END WITH ERROR ========\n")
        return JSONResponse(
            status_code=404,
            content={
                "error": f"Workflow not found for {search_filename}", 
                "is_demo_data": False,
                "timestamp": datetime.now().isoformat(),
                "search_criteria": {
                    "original_filename": image_filename,
                    "processed_filename": search_filename,
                    "all_attempts_failed": True
                }
            }
        )
    except Exception as e:
        print(f"Error in get_workflow_by_image: {str(e)}")
        print(f"Full error details:")
        print(traceback.format_exc())
        print("======== WORKFLOW API ENDPOINT END WITH ERROR ========\n")
        return JSONResponse(
            status_code=500,
            content={
                "error": f"Failed to fetch workflow data: {str(e)}",
                "is_demo_data": False,
                "timestamp": datetime.now().isoformat(),
                "stack_trace": traceback.format_exc()
            }
        )

# Add a proxy endpoint for additional images to bypass CORS issues
@api_gateway_app.get("/proxy/additional_images/{filename}")
async def proxy_additional_image(filename: str):
    try:
        # The original target URL
        target_url = f"http://localhost:8091/additional_images/{filename}"
        print(f"Proxying request to: {target_url}")
        
        # Create an async HTTP client
        async with httpx.AsyncClient() as client:
            # Forward the request
            response = await client.get(target_url)
            
            # Return the content with appropriate headers
            # For text files
            if filename.endswith('.txt'):
                return Response(
                    content=response.content,
                    media_type="text/plain",
                    headers={"Access-Control-Allow-Origin": "*"}
                )
            # For image files
            elif filename.endswith(('.png', '.jpg', '.jpeg', '.gif')):
                return Response(
                    content=response.content,
                    media_type=f"image/{filename.split('.')[-1]}",
                    headers={"Access-Control-Allow-Origin": "*"}
                )
            # For other files
            else:
                return Response(
                    content=response.content,
                    headers={"Access-Control-Allow-Origin": "*"}
                )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to proxy additional image: {str(e)}"}
        )

# Add a debug endpoint to list all workflows in the MongoDB collection
@api_gateway_app.get("/debug/workflows")
async def list_all_workflows():
    try:
        print("\n======== DEBUG: LISTING ALL WORKFLOWS ========")
        print(f"MongoDB URL: {MONGODB_URL}")
        print(f"Database: {db.name}")
        print(f"Collection: {workflow_collection.name}")
        
        # Query MongoDB for all workflow data
        all_workflows = []
        
        try:
            # Get all documents from the workflow collection
            print("Executing MongoDB query: db.image_workflow.find({})")
            cursor = workflow_collection.find({})
            count = 0
            async for doc in cursor:
                count += 1
                # MongoDB returns _id as ObjectId which is not JSON serializable
                if "_id" in doc:
                    doc["_id"] = str(doc["_id"])
                
                # Extract key fields for console logging
                workflow_name = doc.get('workflow_name', 'unknown')
                description = doc.get('description', 'no description')
                all_workflows.append(doc)
                print(f"Found workflow {count}: name='{workflow_name}', description='{description}'")
            
            print(f"Total workflows found: {count}")
            
            if count == 0:
                # If no workflows found, add a sample workflow for testing
                print("No workflows found in collection, adding a sample workflow for testing")
                sample_workflow = {
                    "workflow_name": "sample_workflow",
                    "description": "Sample workflow for testing",
                    "created_at": datetime.now().isoformat(),
                    "nodes": [
                        {
                            "id": "node-1",
                            "type": "input",
                            "label": "Image Input",
                            "position": {"x": 100, "y": 100}
                        },
                        {
                            "id": "node-2",
                            "type": "process",
                            "label": "Sample Process",
                            "position": {"x": 300, "y": 100}
                        }
                    ]
                }
                # Insert the sample workflow
                await workflow_collection.insert_one(sample_workflow)
                print("Sample workflow added")
                
                # Add the sample workflow to the response with _id converted to string
                sample_workflow["_id"] = "sample_id"
                all_workflows.append(sample_workflow)
            
        except Exception as db_error:
            print(f"MongoDB query error: {str(db_error)}")
            print(traceback.format_exc())
        
        print("======== DEBUG: LISTING WORKFLOWS END ========\n")
        return JSONResponse(
            status_code=200,
            content={"workflows": all_workflows}
        )
    except Exception as e:
        print(f"Error in list_all_workflows: {str(e)}")
        print(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to list workflows: {str(e)}"}
        )

# Add a simpler endpoint to insert a test workflow directly with the name in the URL
@api_gateway_app.get("/debug/insert-workflow/{workflow_name}")
async def insert_named_test_workflow(workflow_name: str):
    try:
        print(f"\n======== DEBUG: INSERTING TEST WORKFLOW: {workflow_name} ========")
        
        # Create a sample workflow with the given name
        sample_workflow = {
            "workflow_name": workflow_name,
            "description": f"Test workflow for {workflow_name}",
            "created_at": datetime.now().isoformat(),
            "elements": [
                {
                    "id": "element-1",
                    "type": "input",
                    "label": "Image Input"
                },
                {
                    "id": "element-2",
                    "type": "process",
                    "label": "Image Processing"
                },
                {
                    "id": "element-3",
                    "type": "output",
                    "label": "Final Output"
                }
            ],
            "nodes": [
                {
                    "id": "node-1",
                    "type": "input",
                    "label": "Image Input",
                    "position": {"x": 100, "y": 100}
                },
                {
                    "id": "node-2",
                    "type": "process",
                    "label": "Image Processing",
                    "position": {"x": 300, "y": 100}
                }
            ]
        }
        
        # Check if workflow with this name already exists
        existing = await workflow_collection.find_one({"workflow_name": workflow_name})
        if existing:
            # Update the existing workflow
            print(f"Workflow with name '{workflow_name}' already exists, updating...")
            result = await workflow_collection.replace_one({"workflow_name": workflow_name}, sample_workflow)
            if result.modified_count:
                print(f"Workflow updated successfully")
                sample_workflow["_id"] = str(existing["_id"])
            else:
                print(f"No changes made to existing workflow")
                sample_workflow = existing
                if "_id" in sample_workflow:
                    sample_workflow["_id"] = str(sample_workflow["_id"])
        else:
            # Insert new workflow
            print(f"Creating new workflow with name '{workflow_name}'")
            result = await workflow_collection.insert_one(sample_workflow)
            inserted_id = str(result.inserted_id)
            print(f"Workflow inserted with ID: {inserted_id}")
            sample_workflow["_id"] = inserted_id
        
        print("======== DEBUG: WORKFLOW INSERTION COMPLETE ========\n")
        return JSONResponse(
            status_code=200,
            content={"message": "Workflow created/updated successfully", "workflow": sample_workflow}
        )
    except Exception as e:
        print(f"Error inserting test workflow: {str(e)}")
        print(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to insert workflow: {str(e)}"}
        )

# Add an endpoint to get database info
@api_gateway_app.get("/debug/db-info")
async def get_database_info():
    try:
        print("\n======== DEBUG: GETTING DATABASE INFO ========")
        
        # Get database information
        db_info = {}
        db_info["mongodb_url"] = MONGODB_URL
        db_info["database_name"] = db.name
        db_info["collections"] = []
        
        # List all collections in the database
        collections = await db.list_collection_names()
        print(f"Collections in database {db.name}: {collections}")
        
        # Get counts for each collection
        for collection_name in collections:
            collection = db[collection_name]
            count = await collection.count_documents({})
            db_info["collections"].append({
                "name": collection_name,
                "document_count": count
            })
            print(f"Collection {collection_name} has {count} documents")
        
        print("======== DEBUG: DATABASE INFO COMPLETE ========\n")
        return JSONResponse(
            status_code=200,
            content={"database_info": db_info}
        )
    except Exception as e:
        print(f"Error getting database info: {str(e)}")
        print(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to get database info: {str(e)}"}
        )

# Add an endpoint to insert a test workflow
@api_gateway_app.post("/debug/insert-workflow")
async def insert_test_workflow(workflow: dict = Body(...)):
    try:
        print("\n======== DEBUG: INSERTING TEST WORKFLOW ========")
        print(f"Workflow data: {workflow}")
        
        # Insert the workflow into MongoDB
        if "_id" in workflow:
            del workflow["_id"]  # Remove any _id field if present
            
        result = await workflow_collection.insert_one(workflow)
        inserted_id = str(result.inserted_id)
        print(f"Workflow inserted with ID: {inserted_id}")
        
        # Return the inserted workflow with the generated ID
        workflow["_id"] = inserted_id
        
        print("======== DEBUG: WORKFLOW INSERTION COMPLETE ========\n")
        return JSONResponse(
            status_code=200,
            content={"message": "Workflow inserted successfully", "workflow": workflow}
        )
    except Exception as e:
        print(f"Error inserting test workflow: {str(e)}")
        print(traceback.format_exc())
        return JSONResponse(
            status_code=500,
            content={"error": f"Failed to insert workflow: {str(e)}"}
        )

# Add a specific debugging endpoint for MongoDB connection check
@api_gateway_app.get("/debug/mongodb-check")
async def check_mongodb_connection():
    try:
        print("\n\n======== MONGODB CONNECTION CHECK START ========")
        result = {
            "connection_status": "unknown",
            "server_info": None,
            "database_info": {
                "name": db.name,
                "collections": []
            },
            "workflow_collection": {
                "name": workflow_collection.name,
                "count": 0,
                "samples": []
            },
            "raw_connection_string": MONGODB_URL.replace(
                # Replace any password in the connection string with ***
                re.sub(r'//(.+?):(.+?)@', '//\\1:***@', MONGODB_URL) 
                if '@' in MONGODB_URL else MONGODB_URL
            ),
            "timestamp": datetime.now().isoformat()
        }
        
        # Step 1: Check MongoDB server connection
        try:
            print("Testing MongoDB server connection...")
            server_info = await mongodb_client.server_info()
            result["connection_status"] = "connected"
            result["server_info"] = {
                "version": server_info.get("version", "unknown"),
                "uptime": server_info.get("uptime", 0),
                "localTime": server_info.get("localTime", None),
                "ok": server_info.get("ok", 0)
            }
            print(f"MongoDB connection successful. Server version: {server_info.get('version', 'unknown')}")
        except Exception as e:
            result["connection_status"] = "error"
            result["connection_error"] = str(e)
            print(f"MongoDB connection error: {str(e)}")
            print(traceback.format_exc())
            return JSONResponse(
                status_code=500,
                content=result
            )
        
        # Step 2: List all collections in the database
        try:
            print(f"Listing collections in database '{db.name}'...")
            collections = await db.list_collection_names()
            result["database_info"]["collections"] = collections
            print(f"Found {len(collections)} collections: {collections}")
        except Exception as e:
            result["database_info"]["error"] = str(e)
            print(f"Error listing collections: {str(e)}")
        
        # Step 3: Check workflow collection
        if workflow_collection.name in collections:
            try:
                print(f"Checking workflow collection '{workflow_collection.name}'...")
                count = await workflow_collection.count_documents({})
                result["workflow_collection"]["count"] = count
                print(f"Collection has {count} documents")
                
                # Get sample documents
                if count > 0:
                    print("Retrieving sample documents...")
                    samples = []
                    cursor = workflow_collection.find().limit(5)
                    idx = 0
                    async for doc in cursor:
                        idx += 1
                        # Convert ObjectId to string
                        if "_id" in doc:
                            doc["_id"] = str(doc["_id"])
                        
                        # Extract key information for the sample
                        sample = {
                            "id": doc.get("_id", "unknown"),
                            "workflow_name": doc.get("workflow_name", "unknown"),
                            "fields": list(doc.keys())
                        }
                        
                        # Add a few important fields if they exist
                        for important_field in ["description", "created_at", "input_image_filename"]:
                            if important_field in doc:
                                sample[important_field] = doc[important_field]
                        
                        samples.append(sample)
                        print(f"Sample {idx}: workflow_name='{sample['workflow_name']}'")
                    
                    result["workflow_collection"]["samples"] = samples
            except Exception as e:
                result["workflow_collection"]["error"] = str(e)
                print(f"Error checking workflow collection: {str(e)}")
                print(traceback.format_exc())
        else:
            result["workflow_collection"]["error"] = f"Collection '{workflow_collection.name}' does not exist"
            print(f"WARNING: Collection '{workflow_collection.name}' does not exist")
        
        # Step 4: Attempt a simple query to confirm database functionality
        try:
            print("Attempting a test query...")
            test_result = await db.command({"ping": 1})
            result["ping_test"] = test_result
            print(f"Ping test result: {test_result}")
        except Exception as e:
            result["ping_test_error"] = str(e)
            print(f"Ping test error: {str(e)}")
        
        print("======== MONGODB CONNECTION CHECK END ========\n")
        return JSONResponse(
            status_code=200,
            content=result
        )
    except Exception as e:
        print(f"Overall error in MongoDB check: {str(e)}")
        print(traceback.format_exc())
        print("======== MONGODB CONNECTION CHECK END WITH ERROR ========\n")
        return JSONResponse(
            status_code=500,
            content={
                "connection_status": "error",
                "error": str(e),
                "stack_trace": traceback.format_exc(),
                "timestamp": datetime.now().isoformat()
            }
        )

# Add a debug endpoint to create a Korean workflow named "ㅁㅁㅁ"
@api_gateway_app.get("/debug/create-mmm-workflow")
async def create_mmm_workflow():
    try:
        print("\n\n======== CREATING MMM WORKFLOW TEST DATA ========")
        
        # 한글 파일명 테스트 (ㅁㅁㅁ)
        workflow_name = "ㅁㅁㅁ"
        print(f"Creating workflow with Korean name: {workflow_name}")
        print(f"Name as bytes: {workflow_name.encode('utf-8')}")
        
        # 현재 시간 저장
        current_time = datetime.now().isoformat()
        
        # 워크플로우 데이터 생성
        test_workflow = {
            "workflow_name": workflow_name,
            "description": "테스트 워크플로우 (ㅁㅁㅁ)",
            "created_at": current_time,
            "elements": [
                {
                    "id": "element-1",
                    "type": "input",
                    "label": "입력 이미지"
                },
                {
                    "id": "element-2", 
                    "type": "process",
                    "label": "이미지 처리"
                },
                {
                    "id": "element-3",
                    "type": "output",
                    "label": "출력 결과"
                }
            ],
            "nodes": [
                {
                    "id": "node-1",
                    "type": "input",
                    "label": "입력 이미지",
                    "position": {"x": 100, "y": 100}
                },
                {
                    "id": "node-2",
                    "type": "process",
                    "label": "이미지 처리",
                    "position": {"x": 300, "y": 100}
                }
            ],
            "input_image_filename": f"{workflow_name}_before.png",
            "output_image_filename": f"{workflow_name}_after.png",
            "test_field": "테스트 필드 값"
        }
        
        # 기존 워크플로우 검색
        existing = await workflow_collection.find_one({"workflow_name": workflow_name})
        
        if existing:
            # 이미 존재하는 경우 업데이트
            print(f"Workflow with name '{workflow_name}' already exists, updating...")
            result = await workflow_collection.replace_one(
                {"workflow_name": workflow_name}, 
                test_workflow
            )
            
            success = result.modified_count > 0
            print(f"Update result: modified_count={result.modified_count}")
            
            if success:
                print(f"Workflow updated successfully")
                test_workflow["_id"] = str(existing["_id"])
            else:
                print(f"No changes made to existing workflow")
                test_workflow = existing
                if "_id" in test_workflow:
                    test_workflow["_id"] = str(test_workflow["_id"])
        else:
            # 새 워크플로우 삽입
            print(f"Creating new workflow with name '{workflow_name}'")
            result = await workflow_collection.insert_one(test_workflow)
            inserted_id = result.inserted_id
            print(f"Workflow inserted with ID: {inserted_id}")
            test_workflow["_id"] = str(inserted_id)
        
        # 실제로 데이터베이스에 저장되었는지 확인
        verification = await workflow_collection.find_one({"workflow_name": workflow_name})
        verification_status = "성공" if verification else "실패"
        
        if verification:
            print(f"Verification successful: found workflow with _id={verification['_id']}")
            if "_id" in verification:
                verification["_id"] = str(verification["_id"])
        else:
            print(f"Verification failed: could not find workflow named '{workflow_name}'")
        
        # API 엔드포인트에서 실제로 조회되는지 테스트
        print(f"Testing API endpoint with the workflow name")
        # GET 요청을 시뮬레이션
        api_result = await get_workflow_by_image(workflow_name)
        api_status = "성공" if (isinstance(api_result, JSONResponse) and api_result.status_code == 200) else "실패"
        print(f"API endpoint test {api_status}")
        
        print("======== MMM WORKFLOW CREATION COMPLETE ========\n")
        
        return JSONResponse(
            status_code=200,
            content={
                "message": f"MMM 워크플로우 생성 {verification_status}",
                "workflow": test_workflow,
                "verification": verification is not None,
                "verification_data": verification if verification else None,
                "api_test": api_status == "성공",
                "timestamp": datetime.now().isoformat()
            }
        )
    except Exception as e:
        print(f"Error creating MMM workflow: {str(e)}")
        print(traceback.format_exc())
        print("======== MMM WORKFLOW CREATION FAILED ========\n")
        
        return JSONResponse(
            status_code=500,
            content={
                "error": f"Failed to create MMM workflow: {str(e)}",
                "stack_trace": traceback.format_exc(),
                "timestamp": datetime.now().isoformat()
            }
        )

# Add a special test endpoint to create a specific Korean workflow "ㅕㅑㅐ"
@api_gateway_app.get("/debug/create-specific-korean-workflow")
async def create_specific_korean_workflow():
    try:
        print("\n\n======== CREATING SPECIFIC KOREAN WORKFLOW TEST DATA ========")
        
        # 특정 한글 파일명 테스트 (ㅕㅑㅐ)
        workflow_name = "ㅕㅑㅐ"
        print(f"Creating workflow with specific Korean name: {workflow_name}")
        print(f"Name as bytes: {workflow_name.encode('utf-8')}")
        
        # URL 인코딩 테스트
        from urllib.parse import quote, unquote
        encoded_name = quote(workflow_name)
        print(f"URL encoded name: {encoded_name}")
        print(f"URL decoded back: {unquote(encoded_name)}")
        
        # 현재 시간 저장
        current_time = datetime.now().isoformat()
        
        # 워크플로우 데이터 생성
        test_workflow = {
            "workflow_name": workflow_name,
            "description": "특정 한글 테스트 워크플로우",
            "created_at": current_time,
            "elements": [
                {
                    "id": "element-1",
                    "type": "input",
                    "label": "입력 이미지"
                },
                {
                    "id": "element-2", 
                    "type": "process",
                    "label": "이미지 처리"
                },
                {
                    "id": "element-3",
                    "type": "output",
                    "label": "출력 결과"
                }
            ],
            "nodes": [
                {
                    "id": "node-1",
                    "type": "input",
                    "label": "입력 이미지",
                    "position": {"x": 100, "y": 100}
                },
                {
                    "id": "node-2",
                    "type": "process",
                    "label": "이미지 처리",
                    "position": {"x": 300, "y": 100}
                }
            ],
            "input_image_filename": f"{workflow_name}_before.png",
            "output_image_filename": f"{workflow_name}_after.png",
            "test_field": "테스트 필드 값"
        }
        
        # 기존 워크플로우 검색
        existing = await workflow_collection.find_one({"workflow_name": workflow_name})
        
        if existing:
            # 이미 존재하는 경우 업데이트
            print(f"Workflow with name '{workflow_name}' already exists, updating...")
            result = await workflow_collection.replace_one(
                {"workflow_name": workflow_name}, 
                test_workflow
            )
            
            success = result.modified_count > 0
            print(f"Update result: modified_count={result.modified_count}")
            
            if success:
                print(f"Workflow updated successfully")
                test_workflow["_id"] = str(existing["_id"])
            else:
                print(f"No changes made to existing workflow")
                test_workflow = existing
                if "_id" in test_workflow:
                    test_workflow["_id"] = str(test_workflow["_id"])
        else:
            # 새 워크플로우 삽입
            print(f"Creating new workflow with name '{workflow_name}'")
            result = await workflow_collection.insert_one(test_workflow)
            inserted_id = result.inserted_id
            print(f"Workflow inserted with ID: {inserted_id}")
            test_workflow["_id"] = str(inserted_id)
        
        # 실제로 데이터베이스에 저장되었는지 확인
        verification = await workflow_collection.find_one({"workflow_name": workflow_name})
        verification_status = "성공" if verification else "실패"
        
        if verification:
            print(f"Verification successful: found workflow with _id={verification['_id']}")
            if "_id" in verification:
                verification["_id"] = str(verification["_id"])
        else:
            print(f"Verification failed: could not find workflow named '{workflow_name}'")
        
        # 인코딩된 이름으로도 검색 테스트
        print(f"Testing search with encoded name: {encoded_name}")
        encoded_verification = await workflow_collection.find_one({"workflow_name": unquote(encoded_name)})
        if encoded_verification:
            print(f"Encoded name search successful")
        else:
            print(f"Encoded name search failed")
        
        # API 엔드포인트에서 실제로 조회되는지 테스트
        print(f"Testing API endpoint with the workflow name")
        # GET 요청을 시뮬레이션
        api_result = await get_workflow_by_image(workflow_name)
        if isinstance(api_result, JSONResponse) and api_result.status_code == 200:
            print(f"API endpoint test successful")
        else:
            print(f"API endpoint test failed with status code: {getattr(api_result, 'status_code', 'unknown')}")
        
        print("======== SPECIFIC KOREAN WORKFLOW CREATION COMPLETE ========\n")
        
        return JSONResponse(
            status_code=200,
            content={
                "message": f"특정 한글 워크플로우 생성 {verification_status}",
                "workflow": test_workflow,
                "verification": verification is not None,
                "verification_data": verification if verification else None,
                "encoded_name": encoded_name,
                "encoded_verification": encoded_verification is not None,
                "api_test": isinstance(api_result, JSONResponse) and api_result.status_code == 200,
                "timestamp": datetime.now().isoformat()
            }
        )
    except Exception as e:
        print(f"Error creating specific Korean workflow: {str(e)}")
        print(traceback.format_exc())
        print("======== SPECIFIC KOREAN WORKFLOW CREATION FAILED ========\n")
        
        return JSONResponse(
            status_code=500,
            content={
                "error": f"Failed to create specific Korean workflow: {str(e)}",
                "stack_trace": traceback.format_exc(),
                "timestamp": datetime.now().isoformat()
            }
        ) 