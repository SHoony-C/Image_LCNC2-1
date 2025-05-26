"""
SQLAlchemy models for user management - Simplified version with only users table
"""
from sqlalchemy import Boolean, Column, String, DateTime, Integer
from datetime import datetime
import sys
import os

# Add parent directory to path to allow absolute imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db_config import Base

class User(Base):
    """User model for MySQL database"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(255), unique=True, nullable=False, index=True)
    department = Column(String(255), nullable=True)
    hashed_password = Column(String(255), nullable=True)  # Nullable for SSO users
    is_active = Column(Boolean, default=True)
    permission = Column(String(50), default="user")  # 권한 필드 추가 (기본값: user)
    sso_id = Column(String(255), unique=True, nullable=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        """Convert user object to dictionary"""
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "full_name": self.username,
            "department": self.department,
            "permission": self.permission,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None
        } 