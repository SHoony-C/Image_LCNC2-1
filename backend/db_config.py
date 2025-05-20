"""
MySQL Database Configuration for LCNC App
"""
import os
from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# MySQL connection settings
MYSQL_SETTINGS = {
    'HOST': os.getenv('MYSQL_HOST', 'localhost'),
    'PORT': os.getenv('MYSQL_PORT', '3306'),
    'USER': os.getenv('MYSQL_USER', 'root'),
    'PASSWORD': os.getenv('MYSQL_PASSWORD', 'asdd*963'),
    'DATABASE': os.getenv('MYSQL_DATABASE', 'lcnc_app'),
}

# SQLAlchemy connection string
DATABASE_URL = f"mysql+pymysql://{MYSQL_SETTINGS['USER']}:{MYSQL_SETTINGS['PASSWORD']}@" \
               f"{MYSQL_SETTINGS['HOST']}:{MYSQL_SETTINGS['PORT']}/{MYSQL_SETTINGS['DATABASE']}"

# Create SQLAlchemy engine with echo=True to log all SQL statements
engine = create_engine(DATABASE_URL, echo=True)

# Add SQL query logging
@event.listens_for(engine, "before_cursor_execute")
def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    conn.info.setdefault('query_start_time', []).append(os.times())
    print("\n===== 실행 SQL 쿼리 =====")
    print(statement)
    print("바인딩 파라미터:", parameters)

@event.listens_for(engine, "after_cursor_execute")
def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    print("===== SQL 쿼리 실행 완료 =====\n")

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()

# Function to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Define user roles
USER_ROLES = ['admin', 'sub-admin', 'manager', 'user']

# Authentication settings (from existing config)
AUTH_SETTINGS = {
    'SECRET_KEY': os.getenv('SECRET_KEY', 'your-secret-key-here'),
    'TOKEN_EXPIRE_MINUTES': int(os.getenv('TOKEN_EXPIRE_MINUTES', '60')),
    'REFRESH_TOKEN_EXPIRE_DAYS': int(os.getenv('REFRESH_TOKEN_EXPIRE_DAYS', '7')),
    'ALGORITHM': 'HS256',
}

# Keep existing MongoDB settings for backward compatibility during transition
MONGODB_SETTINGS = {
    'HOST': os.getenv('MONGO_HOST', 'localhost'),
    'PORT': int(os.getenv('MONGO_PORT', '27017')),
    'DATABASE': os.getenv('MONGO_DATABASE', 'lcnc'),
    'AUTH_COLLECTION': 'auth_users',
    'ROLES_COLLECTION': 'user_roles',
} 