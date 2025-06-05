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
from db_config import get_db, AUTH_SETTINGS, USER_ROLES, MONGODB_SETTINGS
from sqlalchemy.exc import IntegrityError
from pymongo import MongoClient

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
    print("\n===== 토큰 인증 시작 =====")
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        print(f"토큰 디코딩 시작: {token[:20]}...")
        payload = jwt.decode(token, AUTH_SETTINGS['SECRET_KEY'], algorithms=[AUTH_SETTINGS['ALGORITHM']])
        print(f"토큰 디코딩 성공: {payload}")
        user_id_or_username: str = payload.get("sub")
        if user_id_or_username is None:
            print("토큰에 'sub' 필드가 없음")
            raise credentials_exception
        print(f"토큰의 sub 값: {user_id_or_username}")
    except JWTError as e:
        print(f"JWT 디코딩 오류: {str(e)}")
        raise credentials_exception
    
    # 먼저 ID로 사용자 조회 시도
    user = None
    try:
        # ID가 숫자인 경우
        if user_id_or_username.isdigit():
            print(f"sub를 ID로 해석하여 사용자 조회: {user_id_or_username}")
            user = db.query(User).filter(User.id == int(user_id_or_username)).first()
    except Exception as e:
        print(f"ID로 사용자 조회 중 오류: {str(e)}")
        
    # ID로 찾지 못했으면 사용자명으로 조회
    if user is None:
        print(f"sub를 사용자명으로 해석하여 사용자 조회: {user_id_or_username}")
        user = db.query(User).filter(User.username == user_id_or_username).first()
    
    # 사용자를 찾지 못한 경우
    if user is None:
        print(f"사용자를 찾을 수 없음: {user_id_or_username}")
        raise credentials_exception
    
    print(f"사용자 인증 성공: ID={user.id}, 사용자명={user.username}")
    print("===== 토큰 인증 완료 =====\n")
    
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
            permission=user.permission if hasattr(user, 'permission') else 'user',  # permission 필드 추가
            roles=[user.permission if hasattr(user, 'permission') and user.permission else 'user']  # permission 필드를 roles 배열에 추가
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
            permission=user.permission if hasattr(user, 'permission') else 'user',  # permission 필드 추가
            roles=[user.permission if hasattr(user, 'permission') and user.permission else 'user']
        )

async def get_current_active_user(current_user: UserSchema = Depends(get_current_user)):
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

def check_admin_user(user: UserSchema):
    """Check if user is admin based on permission"""
    if not user:
        print(f"권한 확인 실패: 사용자 정보 없음")
        return False
    
    # permission 필드가 'admin'인지 확인
    is_admin_role = user.permission == 'admin'
    print(f"사용자 {user.username}의 권한: {user.permission}, 관리자 여부: {is_admin_role}")
    return is_admin_role

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

# 인증 없이 사용자 목록을 조회할 수 있는 테스트용 엔드포인트
@router.get("/users-noauth", response_model=Dict[str, Any])
async def get_users_no_auth(db: Session = Depends(get_db)):
    print("\n----- GET /users-noauth 엔드포인트 호출됨 (인증 없음) -----")
    
    try:
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
        print("----- 사용자 목록 반환 완료 (인증 없음) -----\n")
        
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

@router.post("/logout")
async def logout():
    """사용자 로그아웃 처리
    
    클라이언트에서 로컬 스토리지의 토큰을 제거하는 것이 주요 로그아웃 메커니즘이지만,
    서버에서도 로그아웃 이벤트를 기록하고 응답을 반환합니다.
    """
    print("로그아웃 요청 처리됨")
    return {"status": "success", "message": "Successfully logged out"}

# 인증 없이 사용자를 추가할 수 있는 테스트용 엔드포인트
@router.post("/user-noauth", response_model=Dict[str, Any])
async def create_user_no_auth(username: str = Body(...), 
                    email: str = Body(...), 
                    password: str = Body(...),
                    full_name: str = Body(None),
                    department: str = Body(None),
                    permission: str = Body("user"),
                    db: Session = Depends(get_db)):
    try:
        print("\n----- POST /user-noauth 엔드포인트 호출됨 (인증 없음) -----")
        
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
        
        print(f"사용자 추가 완료: ID={new_user.id}, 사용자명={username}")
        return {"status": "success", "user_id": new_user.id}
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="User creation failed - database integrity error")
    except Exception as e:
        db.rollback()
        print(f"User creation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"User creation failed: {str(e)}")

# 인증 없이 사용자를 수정할 수 있는 테스트용 엔드포인트
@router.put("/user-noauth/{user_id}", response_model=Dict[str, Any])
async def update_user_no_auth(user_id: int, user_data: Dict[str, Any], db: Session = Depends(get_db)):
    print(f"\n----- PUT /user-noauth/{user_id} 엔드포인트 호출됨 (인증 없음) -----")
    
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
    
    if "permission" in user_data:
        user.permission = user_data["permission"]
    
    if "is_active" in user_data:
        user.is_active = user_data["is_active"]
    
    if "password" in user_data:
        user.hashed_password = get_password_hash(user_data["password"])
    
    try:
        db.commit()
        print(f"사용자 정보 수정 완료: ID={user_id}")
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"User update failed: {str(e)}")

# 인증 없이 사용자를 삭제할 수 있는 테스트용 엔드포인트
@router.delete("/user-noauth/{user_id}", response_model=Dict[str, Any])
async def delete_user_no_auth(user_id: int, db: Session = Depends(get_db)):
    print(f"\n----- DELETE /user-noauth/{user_id} 엔드포인트 호출됨 (인증 없음) -----")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        db.delete(user)
        db.commit()
        print(f"사용자 삭제 완료: ID={user_id}")
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"User deletion failed: {str(e)}")

# 사용자 액션 로그 엔드포인트
@router.post("/log-action", response_model=Dict[str, Any])
async def log_user_action(
    username: str = Body(...),
    department: str = Body(None),
    useraction: str = Body(...),
    db: Session = Depends(get_db)
):
    """사용자 액션을 로그로 저장합니다"""
    try:
        # SQL 쿼리 실행 (ORM 대신 직접 SQL 쿼리 사용)
        from sqlalchemy import text
        
        # 현재 시간 가져오기
        from datetime import datetime
        current_time = datetime.now()
        
        # 쿼리 준비
        query = text("""
            INSERT INTO image_app.user_count 
            (username, department, useraction, action_time) 
            VALUES (:username, :department, :useraction, :action_time)
        """)
        
        # 파라미터 준비
        params = {
            "username": username,
            "department": department,
            "useraction": useraction,
            "action_time": current_time
        }
        
        # 쿼리 실행
        result = db.execute(query, params)
        db.commit()
        
        print(f"사용자 액션 로그 저장 완료: {username}, {useraction}, {current_time}")
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        print(f"사용자 액션 로그 저장 실패: {str(e)}")
        # 로깅 실패는 사용자 경험에 영향을 주지 않도록 예외를 발생시키지 않고 성공으로 응답
        return {"status": "error", "detail": str(e)}

# 사용자 통계 데이터 API 엔드포인트 추가
@router.get("/user-statistics", response_model=Dict[str, Any])
async def get_user_statistics(db: Session = Depends(get_db)):
    """사용자 통계 데이터를 반환합니다"""
    try:
        from sqlalchemy import text, func
        from datetime import datetime, timedelta
        
        # 1. 총 사용자 수
        total_users_query = text("SELECT COUNT(*) as count FROM image_app.users")
        total_users_result = db.execute(total_users_query).fetchone()
        total_users = total_users_result.count if total_users_result else 0
        
        # 2. 최근 30일 내 활동한 사용자 수 (유니크 유저)
        thirty_days_ago = datetime.now() - timedelta(days=30)
        active_users_query = text("""
            SELECT COUNT(DISTINCT username) as count 
            FROM image_app.user_count 
            WHERE action_time > :thirty_days_ago
        """)
        active_users_result = db.execute(active_users_query, {"thirty_days_ago": thirty_days_ago}).fetchone()
        active_users = active_users_result.count if active_users_result else 0
        
        # 3. 최근 30일 내 새로 가입한 사용자 수
        new_users_query = text("""
            SELECT COUNT(*) as count 
            FROM image_app.users 
            WHERE created_at > :thirty_days_ago
        """)
        new_users_result = db.execute(new_users_query, {"thirty_days_ago": thirty_days_ago}).fetchone()
        new_users = new_users_result.count if new_users_result else 0
        
        # 3-1. 최근 30일 내 액션(활동) 수 추가
        action_count_query = text("""
            SELECT COUNT(*) as count 
            FROM image_app.user_count 
            WHERE action_time > :thirty_days_ago
        """)
        action_count_result = db.execute(action_count_query, {"thirty_days_ago": thirty_days_ago}).fetchone()
        action_count = action_count_result.count if action_count_result else 0
        
        # 4. 최근 가입 사용자 5명
        recent_users_query = text("""
            SELECT id, username, email, full_name, department, 
                   created_at, is_active
            FROM image_app.users 
            ORDER BY created_at DESC 
            LIMIT 5
        """)
        recent_users_result = db.execute(recent_users_query).fetchall()
        recent_users = [
            {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "full_name": user.full_name,
                "department": user.department,
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "is_active": user.is_active
            }
            for user in recent_users_result
        ]
        
        # 5. 최근 7일간 일별 활동 수
        seven_days_ago = datetime.now() - timedelta(days=7)
        daily_activity_query = text("""
            SELECT DATE(action_time) as date, COUNT(*) as count
            FROM image_app.user_count
            WHERE action_time > :seven_days_ago
            GROUP BY DATE(action_time)
            ORDER BY date ASC
        """)
        daily_activity_result = db.execute(daily_activity_query, {"seven_days_ago": seven_days_ago}).fetchall()
        daily_activity = [
            {
                "date": str(activity.date),
                "count": activity.count
            }
            for activity in daily_activity_result
        ]
        
        # 6. 부서별 사용자 수
        department_stats_query = text("""
            SELECT department, COUNT(*) as count
            FROM image_app.users
            WHERE department IS NOT NULL
            GROUP BY department
            ORDER BY count DESC
        """)
        department_stats_result = db.execute(department_stats_query).fetchall()
        department_stats = [
            {
                "department": stats.department,
                "count": stats.count
            }
            for stats in department_stats_result
        ]
        
        # 7. 가장 많이 발생한 액션 TOP 5
        top_actions_query = text("""
            SELECT SUBSTRING_INDEX(useraction, ':', 1) as action_type, COUNT(*) as count
            FROM image_app.user_count
            GROUP BY action_type
            ORDER BY count DESC
            LIMIT 5
        """)
        top_actions_result = db.execute(top_actions_query).fetchall()
        top_actions = [
            {
                "action_type": action.action_type,
                "count": action.count
            }
            for action in top_actions_result
        ]
        
        # 통계 데이터 반환
        return {
            "status": "success",
            "statistics": {
                "total_users": total_users,
                "active_users": active_users,
                "new_users": new_users,
                "action_count": action_count,
                "recent_users": recent_users,
                "daily_activity": daily_activity,
                "department_stats": department_stats,
                "top_actions": top_actions
            }
        }
    except Exception as e:
        print(f"사용자 통계 데이터 조회 중 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=f"통계 데이터 조회 실패: {str(e)}")
        
# 인증 없이 사용자 액션 로그를 저장하는 엔드포인트 (프론트엔드 사용 용도)
@router.post("/log-action-noauth", response_model=Dict[str, Any])
async def log_user_action_noauth(
    username: str = Body(...),
    department: str = Body(None),
    useraction: str = Body(...),
    db: Session = Depends(get_db)
):
    """인증 없이 사용자 액션을 로그로 저장합니다"""
    try:
        # SQL 쿼리 실행 (ORM 대신 직접 SQL 쿼리 사용)
        from sqlalchemy import text
        
        # 현재 시간 가져오기
        from datetime import datetime
        current_time = datetime.now()
        
        # 쿼리 준비
        query = text("""
            INSERT INTO image_app.user_count 
            (username, department, useraction, action_time) 
            VALUES (:username, :department, :useraction, :action_time)
        """)
        
        # 파라미터 준비
        params = {
            "username": username,
            "department": department,
            "useraction": useraction,
            "action_time": current_time
        }
        
        # 쿼리 실행
        result = db.execute(query, params)
        db.commit()
        
        print(f"사용자 액션 로그 저장 완료 (인증 없음): {username}, {useraction}, {current_time}")
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        print(f"사용자 액션 로그 저장 실패: {str(e)}")
        # 로깅 실패는 사용자 경험에 영향을 주지 않도록 예외를 발생시키지 않고 성공으로 응답
        return {"status": "error", "detail": str(e)}

# Add this route to get workflow information by image filename
@router.get("/workflow/get-by-image")
async def get_workflow_by_image(filename: str):
    try:
        # Find workflow in MongoDB where the image filename is referenced
        mongo_client = MongoClient(f"mongodb://{MONGODB_SETTINGS['HOST']}:{MONGODB_SETTINGS['PORT']}")
        lcnc_results = mongo_client[MONGODB_SETTINGS['DATABASE']]['lcnc_result']
        
        # Query MongoDB collection for workflow that contains this image
        workflow = lcnc_results.find_one({"image_filename": filename})
        
        # If not found by direct image_filename, try checking inside workflow data
        if not workflow:
            workflow = lcnc_results.find_one({"$or": [
                {"input_image": filename},
                {"output_image": filename}
            ]})
        
        if workflow:
            # Convert ObjectId to string for JSON serialization
            workflow['_id'] = str(workflow['_id'])
            
            return {
                "status": "success",
                "workflow": workflow
            }
        else:
            return {
                "status": "not_found",
                "message": f"No workflow found for image: {filename}"
            }
    except Exception as e:
        logger.error(f"Error fetching workflow for image {filename}: {str(e)}")
        return {
            "status": "error",
            "message": str(e)
        }

# Add this route to get workflow by name
@router.get("/workflow/{workflow_name}")
async def get_workflow_by_name(workflow_name: str):
    try:
        # Retrieve workflow from MongoDB by name
        mongo_client = MongoClient(f"mongodb://{MONGODB_SETTINGS['HOST']}:{MONGODB_SETTINGS['PORT']}")
        lcnc_results = mongo_client[MONGODB_SETTINGS['DATABASE']]['lcnc_result']
        
        # Query MongoDB collection for workflow by name
        workflow = lcnc_results.find_one({"workflow_name": workflow_name})
        
        if workflow:
            # Convert ObjectId to string for JSON serialization
            workflow['_id'] = str(workflow['_id'])
            
            return {
                "status": "success",
                "workflow": workflow
            }
        else:
            return {
                "status": "not_found",
                "message": f"No workflow found with name: {workflow_name}"
            }
    except Exception as e:
        logger.error(f"Error fetching workflow {workflow_name}: {str(e)}")
        return {
            "status": "error",
            "message": str(e)
        } 