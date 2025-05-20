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
users_collection = db[MONGODB_SETTINGS['AUTH_COLLECTION']]
roles_collection = db[MONGODB_SETTINGS['ROLES_COLLECTION']]

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
    
    user = users_collection.find_one({"id": user_id})
    if user is None:
        raise credentials_exception
    
    # Convert MongoDB document to User model
    user_roles = get_user_roles(user_id)
    return User(
        id=user["id"],
        username=user["username"],
        email=user.get("email"),
        full_name=user.get("full_name"),
        is_active=user.get("is_active", True),
        roles=user_roles
    )

async def get_current_active_user(current_user: User = Depends(get_current_user)):
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

def get_user_roles(user_id: str) -> List[str]:
    """Get roles for a specific user"""
    role_docs = roles_collection.find({"user_id": user_id})
    return [doc["role"] for doc in role_docs]

def check_admin_role(user: User):
    """Check if user has admin role"""
    return "admin" in user.roles

# Authentication endpoints
@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    username = form_data.username
    password = form_data.password
    
    user = users_collection.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    if not verify_password(password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Create access token
    access_token_expires = timedelta(minutes=AUTH_SETTINGS['TOKEN_EXPIRE_MINUTES'])
    access_token = create_access_token(
        data={"sub": user["id"]}, expires_delta=access_token_expires
    )
    
    user_roles = get_user_roles(user["id"])
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": AUTH_SETTINGS['TOKEN_EXPIRE_MINUTES'] * 60,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user.get("email"),
            "full_name": user.get("full_name"),
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
    # Check if username already exists
    existing_user = users_collection.find_one({"username": username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # Create new user
    user_id = str(uuid.uuid4())
    hashed_password = get_password_hash(password)
    
    new_user = {
        "id": user_id,
        "username": username,
        "email": email,
        "full_name": full_name,
        "hashed_password": hashed_password,
        "is_active": True,
        "created_at": datetime.utcnow()
    }
    
    users_collection.insert_one(new_user)
    
    # Assign default role
    roles_collection.insert_one({
        "user_id": user_id,
        "role": "user"
    })
    
    return {"status": "success", "user_id": user_id}

# User management endpoints
@router.get("/users")
async def get_users(current_user: User = Depends(get_current_active_user)):
    # Check if user has admin role
    if not check_admin_role(current_user):
        raise HTTPException(status_code=403, detail="Not authorized to access user list")
    
    # Get all users with their roles
    user_list = []
    for user in users_collection.find():
        roles = get_user_roles(user["id"])
        user_data = {
            "id": user["id"],
            "username": user["username"],
            "email": user.get("email"),
            "full_name": user.get("full_name"),
            "is_active": user.get("is_active", True),
            "roles": roles,
            "created_at": user.get("created_at")
        }
        user_list.append(user_data)
    
    return {"status": "success", "users": user_list}

@router.post("/user")
async def create_user(user_data: UserCreate, current_user: User = Depends(get_current_active_user)):
    # Check if user has admin role
    if not check_admin_role(current_user):
        raise HTTPException(status_code=403, detail="Not authorized to create users")
    
    # Check if username already exists
    existing_user = users_collection.find_one({"username": user_data.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # Create new user
    user_id = str(uuid.uuid4())
    hashed_password = get_password_hash(user_data.password)
    
    new_user = {
        "id": user_id,
        "username": user_data.username,
        "email": user_data.email,
        "full_name": user_data.full_name,
        "hashed_password": hashed_password,
        "is_active": True,
        "created_at": datetime.utcnow()
    }
    
    users_collection.insert_one(new_user)
    
    # Assign default role
    roles_collection.insert_one({
        "user_id": user_id,
        "role": "user"
    })
    
    return {"status": "success", "user_id": user_id}

@router.put("/user/{user_id}")
async def update_user(user_id: str, user_data: Dict[str, Any], current_user: User = Depends(get_current_active_user)):
    # Check if user has admin role or is the user being updated
    if not check_admin_role(current_user) and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this user")
    
    # Prepare update fields
    update_data = {}
    
    if "email" in user_data:
        update_data["email"] = user_data["email"]
    
    if "full_name" in user_data:
        update_data["full_name"] = user_data["full_name"]
    
    if "is_active" in user_data and check_admin_role(current_user):
        update_data["is_active"] = user_data["is_active"]
    
    if "password" in user_data:
        update_data["hashed_password"] = get_password_hash(user_data["password"])
    
    if update_data:
        result = users_collection.update_one(
            {"id": user_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
    
    return {"status": "success"}

@router.delete("/user/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(get_current_active_user)):
    # Check if user has admin role
    if not check_admin_role(current_user):
        raise HTTPException(status_code=403, detail="Not authorized to delete users")
    
    # Don't allow admin to delete themselves
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    # Delete user
    result = users_collection.delete_one({"id": user_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Also delete roles
    roles_collection.delete_many({"user_id": user_id})
    
    return {"status": "success"}

@router.get("/user/{user_id}/roles")
async def get_user_role_list(user_id: str, current_user: User = Depends(get_current_active_user)):
    # Check if user has admin role or is getting their own roles
    if not check_admin_role(current_user) and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to view roles")
    
    roles = get_user_roles(user_id)
    return {"status": "success", "roles": roles}

@router.post("/user/{user_id}/roles")
async def assign_role(user_id: str, role: str, current_user: User = Depends(get_current_active_user)):
    # Check if user has admin role
    if not check_admin_role(current_user):
        raise HTTPException(status_code=403, detail="Not authorized to assign roles")
    
    # Validate role
    if role not in USER_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Available roles: {', '.join(USER_ROLES)}")
    
    # Check if user exists
    user = users_collection.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if role already assigned
    existing_role = roles_collection.find_one({"user_id": user_id, "role": role})
    if existing_role:
        return {"status": "success", "message": "Role already assigned"}
    
    # Assign role
    roles_collection.insert_one({
        "user_id": user_id,
        "role": role,
        "assigned_at": datetime.utcnow(),
        "assigned_by": current_user.id
    })
    
    return {"status": "success"}

@router.delete("/user/{user_id}/roles/{role}")
async def remove_role(user_id: str, role: str, current_user: User = Depends(get_current_active_user)):
    # Check if user has admin role
    if not check_admin_role(current_user):
        raise HTTPException(status_code=403, detail="Not authorized to remove roles")
    
    # Validate role
    if role not in USER_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Available roles: {', '.join(USER_ROLES)}")
    
    # Check if user exists
    user = users_collection.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Remove role
    result = roles_collection.delete_one({"user_id": user_id, "role": role})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Role not found for this user")
    
    return {"status": "success"}

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