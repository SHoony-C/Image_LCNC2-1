from fastapi import APIRouter, HTTPException, Depends, status, Form, Body
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from typing import List, Dict, Any, Optional
from pymongo import MongoClient
from bson import ObjectId
import uuid
import bcrypt
from datetime import datetime, timedelta
from jose import jwt, JWTError
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from auth_models import UserCreate, User, Token
from config import MONGODB_SETTINGS, AUTH_SETTINGS, USER_ROLES
from db_config import DATABASE_URL, get_db
from models.user_models import User as SQLUser

# MySQL 연결
mysql_engine = create_engine(DATABASE_URL)

# MongoDB connection
client = MongoClient(f"mongodb://{MONGODB_SETTINGS['HOST']}:{MONGODB_SETTINGS['PORT']}")
db = client[MONGODB_SETTINGS['DATABASE']]

# 사용자 및 권한 관리에 MongoDB를 사용하지 않으므로 컬렉션 접근 제거
# users_collection = db[MONGODB_SETTINGS['AUTH_COLLECTION']]
# roles_collection = db[MONGODB_SETTINGS['ROLES_COLLECTION']]

# OAuth2 password bearer for token authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/management/login")

router = APIRouter()

# 서버 시작 시 MySQL 사용자 정보 출력 
try:
    print("\n===== MySQL 사용자 정보 디버그 출력 =====")
    conn = mysql_engine.connect()
    
    # 사용자 정보 조회 SQL 쿼리 출력
    sql_query = "SELECT id, username, department, full_name, permission FROM users"
    print(f"\n실행 SQL 쿼리: {sql_query}")
    
    # 쿼리 실행
    query = text(sql_query)
    result = conn.execute(query)
    
    # 결과 출력 - 로우 데이터 형태로 출력
    print("\n[SQL 쿼리 결과 로우 데이터]")
    rows = [dict(row._mapping) for row in result]
    for row in rows:
        print(row)
    
    conn.close()
    print("\n===== MySQL 사용자 정보 출력 완료 =====\n")
except Exception as e:
    print(f"\n===== MySQL 사용자 정보 조회 실패 =====")
    print(f"오류: {str(e)}")
    print("===================================\n")

# Helper functions
def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(plain_password.encode(), hashed_password)

def get_password_hash(password):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt())

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=AUTH_SETTINGS['TOKEN_EXPIRE_MINUTES']))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, AUTH_SETTINGS['SECRET_KEY'], algorithm=AUTH_SETTINGS['ALGORITHM'])
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, AUTH_SETTINGS['SECRET_KEY'], algorithms=[AUTH_SETTINGS['ALGORITHM']])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    # MongoDB 컬렉션 사용하지 않음
    # user = db.users.find_one({"id": user_id})
    # if user is None:
    #     raise credentials_exception
    
    # 임시 사용자 반환
    return User(
        id=user_id,
        username="temporary_user",
        email="temp@example.com",
        full_name="Temporary User",
        is_active=True,
        roles=["user"]
    )

async def get_current_active_user(current_user: User = Depends(get_current_user)):
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

def get_user_roles(user_id: str) -> List[str]:
    """Get roles for a specific user"""
    # MongoDB 컬렉션 사용하지 않음
    # role_docs = db.roles.find({"user_id": user_id})
    # return [doc["role"] for doc in role_docs]
    return ["user"]  # 기본 역할만 반환

def check_admin_role(user: User):
    """Check if user has admin role"""
    return "admin" in user.roles

# Authentication endpoints
@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    username = form_data.username
    password = form_data.password
    
    # MongoDB 사용하지 않음 - 테스트용 사용자 허용
    # user = db.users.find_one({"username": username})
    # if not user:
    #     raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # if not verify_password(password, user["hashed_password"]):
    #     raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # 간단한 테스트를 위해 모든 로그인 요청 허용
    user_id = "temp-user-id"
    
    # Create access token
    access_token_expires = timedelta(minutes=AUTH_SETTINGS['TOKEN_EXPIRE_MINUTES'])
    access_token = create_access_token(
        data={"sub": user_id}, expires_delta=access_token_expires
    )
    
    # 테스트용 역할 할당
    user_roles = ["user"]
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": AUTH_SETTINGS['TOKEN_EXPIRE_MINUTES'] * 60,
        "user": {
            "id": user_id,
            "username": username,
            "email": f"{username}@example.com",
            "full_name": f"Test User {username}",
            "roles": user_roles
        }
    }

@router.post("/register")
async def register_user(
    username: str = Body(...),
    email: str = Body(...),
    password: str = Body(...),
    full_name: str = Body(None)
):
    # MongoDB를 사용하지 않으므로 임시 구현
    return {"status": "success", "user_id": "temp-user-id", "message": "사용자 등록 기능이 일시적으로 비활성화되었습니다."}

# User management endpoints
@router.get("/users")
async def get_users(current_user: User = Depends(get_current_active_user)):
    # MongoDB를 사용하지 않으므로 임시 구현
    return {"status": "success", "users": [], "message": "사용자 목록 기능이 일시적으로 비활성화되었습니다."}

@router.post("/user")
async def create_user(user_data: UserCreate, current_user: User = Depends(get_current_active_user)):
    # MongoDB를 사용하지 않으므로 임시 구현
    return {"status": "success", "user_id": "temp-user-id", "message": "사용자 생성 기능이 일시적으로 비활성화되었습니다."}

@router.put("/user/{user_id}")
async def update_user(user_id: str, user_data: Dict[str, Any], current_user: User = Depends(get_current_active_user)):
    # MongoDB를 사용하지 않으므로 임시 구현
    return {"status": "success", "message": "사용자 업데이트 기능이 일시적으로 비활성화되었습니다."}

@router.delete("/user/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(get_current_active_user)):
    # MongoDB를 사용하지 않으므로 임시 구현
    return {"status": "success", "message": "사용자 삭제 기능이 일시적으로 비활성화되었습니다."}

@router.get("/user/{user_id}/roles")
async def get_user_role_list(user_id: str, current_user: User = Depends(get_current_active_user)):
    # MongoDB를 사용하지 않으므로 임시 구현
    return {"status": "success", "roles": ["user"], "message": "역할 조회 기능이 일시적으로 비활성화되었습니다."}

@router.post("/user/{user_id}/roles")
async def assign_role(user_id: str, role: str, current_user: User = Depends(get_current_active_user)):
    # MongoDB를 사용하지 않으므로 임시 구현
    return {"status": "success", "message": "역할 할당 기능이 일시적으로 비활성화되었습니다."}

@router.delete("/user/{user_id}/roles/{role}")
async def remove_role(user_id: str, role: str, current_user: User = Depends(get_current_active_user)):
    # MongoDB를 사용하지 않으므로 임시 구현
    return {"status": "success", "message": "역할 제거 기능이 일시적으로 비활성화되었습니다."}

@router.get("/sql-users")
async def get_sql_users():
    """MySQL 데이터베이스에서 사용자 정보 조회"""
    print("\n===== MySQL 사용자 정보 디버그 출력 =====")
    
    try:
        # 데이터베이스 연결
        conn = mysql_engine.connect()
        
        # 사용자 정보 조회 SQL 쿼리 출력
        sql_query = "SELECT id, username, department, full_name, permission FROM users"
        print(f"\n실행 SQL 쿼리: {sql_query}")
        
        # 쿼리 파라미터 정보 출력 (이 경우 없음)
        print("바인딩 파라미터: 없음")
        
        # 쿼리 실행
        query = text(sql_query)
        result = conn.execute(query)
        
        # 결과 출력 - 로우 데이터 형태로 출력
        print("\n[SQL 쿼리 결과 로우 데이터]")
        users = []
        for row in result:
            row_dict = dict(row._mapping)
            print(row_dict)
            users.append(row_dict)
        
        conn.close()
        print(f"\n총 {len(users)}명의 사용자 정보 조회 완료")
        print("\n===== MySQL 사용자 정보 출력 완료 =====\n")
        
        return {"status": "success", "users": users}
        
    except Exception as e:
        print(f"\n===== MySQL 사용자 정보 조회 실패 =====")
        print(f"오류: {str(e)}")
        print("===================================\n")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.get("/sql-users-orm")
async def get_sql_users_orm(db: Session = Depends(get_db)):
    """SQLAlchemy ORM을 사용하여 MySQL 데이터베이스에서 사용자 정보 조회"""
    print("\n----- MySQL 사용자 정보 조회 (ORM) -----")
    
    try:
        # 실행할 SQL 쿼리 로깅 (SQL 쿼리 생성)
        from sqlalchemy.dialects import mysql
        query = db.query(SQLUser)
        sql_query = str(query.statement.compile(dialect=mysql.dialect(), compile_kwargs={"literal_binds": True}))
        print(f"\n실행할 SQL 쿼리: {sql_query}")
        
        # ORM을 사용하여 모든 사용자 가져오기
        users = query.all()
        
        # 결과 로우 데이터 형태로 출력
        print("\n[SQL 쿼리 결과 - 로우 데이터]")
        user_list = []
        for user in users:
            user_dict = user.to_dict()
            print(user_dict)
            user_list.append(user_dict)
        
        print(f"\n총 {len(users)}명의 사용자 정보 조회 완료")
        print("\n----- 사용자 정보 조회 완료 -----\n")
        
        return {"status": "success", "users": user_list}
        
    except Exception as e:
        print(f"오류 발생: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") 