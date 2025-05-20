from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
import uuid


class UserBase(BaseModel):
    username: str
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    department: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class User(UserBase):
    id: int
    is_active: bool = True
    roles: List[str] = ["user"]  # 호환성을 위해 유지, permission 필드값이 여기에 저장됨


class SSOModel(BaseModel):
    id_token: str
    code: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_token: Optional[str] = None
    user: User


class TokenPayload(BaseModel):
    sub: str
    exp: int


class RefreshToken(BaseModel):
    refresh_token: str 