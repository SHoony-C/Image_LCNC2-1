from fastapi import APIRouter, Depends, HTTPException, status
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