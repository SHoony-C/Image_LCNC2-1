from fastapi import APIRouter, HTTPException, Depends, status, Form, Body
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import uuid
import bcrypt
from datetime import datetime, timedelta
from jose import jwt, JWTError
from pydantic import BaseModel, ValidationError

from models.user_models import User
from auth_models import UserCreate, User as UserSchema, Token
from db_config import get_db, AUTH_SETTINGS, USER_ROLES
from sqlalchemy.exc import IntegrityError

# OAuth2 password bearer for token authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/users/login")

router = APIRouter()

# Pydantic model for role update
class RoleUpdate(BaseModel):
    role: str

# Helper functions
def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())

def get_password_hash(password):
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=AUTH_SETTINGS['TOKEN_EXPIRE_MINUTES']))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, AUTH_SETTINGS['SECRET_KEY'], algorithm=AUTH_SETTINGS['ALGORITHM'])
    return encoded_jwt

# Check if user is admin based on permission field
def is_admin(permission: str):
    return permission == 'admin'

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
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
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    
    # Convert SQLAlchemy model to Pydantic schema
    # Handle potentially invalid email by using a try-except block
    try:
        return UserSchema(
            id=user.id,
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            department=user.department,
            is_active=user.is_active,
            roles=[user.permission]  # permission 필드를 roles 배열에 추가
        )
    except ValidationError:
        # If there's a validation error (likely with email), set email to None
        return UserSchema(
            id=user.id,
            username=user.username,
            email=None,  # Set email to None if it's invalid
            full_name=user.full_name,
            department=user.department,
            is_active=user.is_active,
            roles=[user.permission]
        )

async def get_current_active_user(current_user: UserSchema = Depends(get_current_user)):
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

def check_admin_user(user: UserSchema):
    """Check if user is admin based on permission"""
    return is_admin(user.roles[0]) if user.roles else False

# Authentication endpoints
@router.post("/login", response_model=Dict[str, Any])
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    username = form_data.username
    password = form_data.password
    
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    if not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Create access token
    access_token_expires = timedelta(minutes=AUTH_SETTINGS['TOKEN_EXPIRE_MINUTES'])
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": AUTH_SETTINGS['TOKEN_EXPIRE_MINUTES'] * 60,
        "user": user.to_dict()
    }

@router.post("/register", response_model=Dict[str, Any])
async def register_user(
    username: str = Body(...), 
    email: str = Body(...), 
    password: str = Body(...),
    full_name: str = Body(None),
    department: str = Body(None),
    db: Session = Depends(get_db)
):
    try:
        # Check if username already exists
        existing_user = db.query(User).filter(User.username == username).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Username already registered")
        
        # Create user object with permission=user
        new_user = User(
            username=username,
            email=email,
            full_name=full_name,
            department=department,
            permission="user",  # 기본 권한은 user
            hashed_password=get_password_hash(password),
            is_active=True
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)  # to get the auto-generated ID
        
        return {"status": "success", "user_id": new_user.id}
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Registration failed - database integrity error")
    except Exception as e:
        db.rollback()
        print(f"Registration error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

# User management endpoints
@router.get("/users", response_model=Dict[str, Any])
async def get_users(current_user: UserSchema = Depends(get_current_active_user), db: Session = Depends(get_db)):
    print("\n----- GET /users 엔드포인트 호출됨 -----")
    print(f"요청한 사용자: {current_user.username}")
    
    try:
        # Check if user is admin
        is_admin_user = check_admin_user(current_user)
        print(f"관리자 권한 여부: {is_admin_user}")
        
        if not is_admin_user:
            print("권한 없음: 관리자가 아닙니다")
            raise HTTPException(status_code=403, detail="Not authorized to access user list")
        
        # 실행할 SQL 쿼리 로깅
        from sqlalchemy.dialects import mysql
        query = db.query(User)
        
        try:
            sql_query = str(query.statement.compile(dialect=mysql.dialect(), compile_kwargs={"literal_binds": True}))
            print(f"\n실행할 SQL 쿼리: {sql_query}")
        except Exception as sql_error:
            print(f"SQL 쿼리 로깅 오류: {str(sql_error)}")
        
        # Get all users
        print("사용자 목록 쿼리 실행 중...")
        users = query.all()
        user_count = len(users)
        print(f"전체 사용자 수: {user_count}")
        
        # 결과 로우 데이터 형태로 출력
        print("\n[SQL 쿼리 결과 - 로우 데이터]")
        for user in users:
            print(user.to_dict())
        
        user_list = [user.to_dict() for user in users]
        print("----- 사용자 목록 반환 완료 -----\n")
        
        return {"status": "success", "users": user_list}
    except Exception as e:
        print(f"\n===== 사용자 목록 조회 중 오류 발생 =====")
        print(f"오류 유형: {type(e).__name__}")
        print(f"오류 내용: {str(e)}")
        print(f"===== 오류 내용 출력 완료 =====\n")
        raise

@router.post("/user", response_model=Dict[str, Any])
async def create_user(username: str = Body(...), 
                    email: str = Body(...), 
                    password: str = Body(...),
                    full_name: str = Body(None),
                    department: str = Body(None),
                    permission: str = Body("user"),
                    current_user: UserSchema = Depends(get_current_active_user), 
                    db: Session = Depends(get_db)):
    try:
        # Check if user is admin
        if not check_admin_user(current_user):
            raise HTTPException(status_code=403, detail="Not authorized to create users")
        
        # Check if username already exists
        existing_user = db.query(User).filter(User.username == username).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Username already registered")
        
        # Create user object
        new_user = User(
            username=username,
            email=email,
            full_name=full_name,
            department=department,
            permission=permission,  # 권한 설정
            hashed_password=get_password_hash(password),
            is_active=True
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)  # to get the auto-generated ID
        
        return {"status": "success", "user_id": new_user.id}
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="User creation failed - database integrity error")
    except Exception as e:
        db.rollback()
        print(f"User creation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"User creation failed: {str(e)}")

@router.put("/user/{user_id}", response_model=Dict[str, Any])
async def update_user(user_id: int, user_data: Dict[str, Any], current_user: UserSchema = Depends(get_current_active_user), db: Session = Depends(get_db)):
    # Check if user is admin or is updating their own profile
    if not check_admin_user(current_user) and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this user")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update fields
    if "email" in user_data:
        user.email = user_data["email"]
    
    if "full_name" in user_data:
        user.full_name = user_data["full_name"]
    
    if "department" in user_data:
        user.department = user_data["department"]
    
    if "permission" in user_data and check_admin_user(current_user):
        user.permission = user_data["permission"]
    
    if "is_active" in user_data and check_admin_user(current_user):
        user.is_active = user_data["is_active"]
    
    if "password" in user_data:
        user.hashed_password = get_password_hash(user_data["password"])
    
    try:
        db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"User update failed: {str(e)}")

@router.delete("/user/{user_id}", response_model=Dict[str, Any])
async def delete_user(user_id: int, current_user: UserSchema = Depends(get_current_active_user), db: Session = Depends(get_db)):
    # Check if user is admin
    if not check_admin_user(current_user):
        raise HTTPException(status_code=403, detail="Not authorized to delete users")
    
    # Don't allow admin to delete themselves
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        db.delete(user)
        db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"User deletion failed: {str(e)}")

@router.get("/user/{user_id}/role", response_model=Dict[str, Any])
async def get_user_role(user_id: int, current_user: UserSchema = Depends(get_current_active_user), db: Session = Depends(get_db)):
    # Check if user has admin role or is getting their own role
    if not check_admin_user(current_user) and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to view role")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"status": "success", "role": user.permission}

@router.put("/user/{user_id}/role", response_model=Dict[str, Any])
async def update_user_role(user_id: int, role_update: RoleUpdate, current_user: UserSchema = Depends(get_current_active_user), db: Session = Depends(get_db)):
    # Check if user has admin role
    if not check_admin_user(current_user):
        raise HTTPException(status_code=403, detail="Not authorized to change roles")
    
    # Validate role
    if role_update.role not in USER_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(USER_ROLES)}")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        user.permission = role_update.role
        db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Role update failed: {str(e)}") 