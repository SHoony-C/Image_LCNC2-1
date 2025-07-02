"""
MySQL Database Configuration for LCNC App
"""
import os
import datetime
from sqlalchemy import create_engine, event, MetaData, Table, Column, Integer, String, Float, Boolean, DateTime, Text, SmallInteger
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
    'DATABASE': os.getenv('MYSQL_DATABASE', 'image_app'),
}

# SQLAlchemy connection string
DATABASE_URL = f"mysql+pymysql://{MYSQL_SETTINGS['USER']}:{MYSQL_SETTINGS['PASSWORD']}@" \
               f"{MYSQL_SETTINGS['HOST']}:{MYSQL_SETTINGS['PORT']}/{MYSQL_SETTINGS['DATABASE']}"

# Create SQLAlchemy engine with echo=True to log all SQL statements
engine = create_engine(DATABASE_URL, echo=False)

# Add SQL query logging
@event.listens_for(engine, "before_cursor_execute")
def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    conn.info.setdefault('query_start_time', []).append(os.times())
    # print("\n===== 실행 SQL 쿼리 =====")
    # print(statement)
    # print("바인딩 파라미터:", parameters)

@event.listens_for(engine, "after_cursor_execute")
def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    # print("===== SQL 쿼리 실행 완료 =====\n")
    pass

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()

# LCNC 데이터베이스용 메타데이터 객체 생성
lcnc_metadata = MetaData()

# MSA6 측정 결과 테이블 정의
# 일반 측정 결과 테이블
msa6_result_cd = Table(
    'msa6_result_cd',
    lcnc_metadata,
    Column('pk_id', Integer, primary_key=True, autoincrement=True),
    Column('table_name', String(45)),
    Column('username', String(45)),
    Column('lot_wafer', String(255)),
    Column('item_id', String(45)),
    Column('subitem_id', String(45)),
    Column('value', Float),
    Column('create_time', DateTime, default=datetime.datetime.now),
    Column('is_deleted', SmallInteger, default=0)

)

# 불량 감지 결과 테이블
msa6_result_defect = Table(
    'msa6_result_defect',
    lcnc_metadata,
    Column('id', Integer, primary_key=True, autoincrement=True),
    Column('table_name', String(45)),
    Column('username', String(45)),
    Column('lot_wafer', String(255)),
    Column('item_id', String(255)),
    Column('subitem_id', String(255)),
    Column('major_axis', Float),
    Column('minor_axis', Float),
    Column('area', Float),
    Column('striated_ratio', Float, default=0.0),  # 줄무늬 비율 (0~1)
    Column('distorted_ratio', Float, default=0.0),  # 왜곡 비율 (0~1)
    Column('created_at', DateTime, default=datetime.datetime.now),
    Column('is_deleted', SmallInteger, default=0)  

)

# LCNC 데이터베이스 연결 설정
LCNC_SETTINGS = {
    'HOST': os.getenv('LCNC_HOST', MYSQL_SETTINGS['HOST']),
    'PORT': os.getenv('LCNC_PORT', MYSQL_SETTINGS['PORT']),
    'USER': os.getenv('LCNC_USER', MYSQL_SETTINGS['USER']),
    'PASSWORD': os.getenv('LCNC_PASSWORD', MYSQL_SETTINGS['PASSWORD']),
    'DATABASE': os.getenv('LCNC_DATABASE', MYSQL_SETTINGS['DATABASE']),
}

# LCNC 데이터베이스 연결 문자열
LCNC_DATABASE_URL = f"mysql+pymysql://{LCNC_SETTINGS['USER']}:{LCNC_SETTINGS['PASSWORD']}@" \
               f"{LCNC_SETTINGS['HOST']}:{LCNC_SETTINGS['PORT']}/{LCNC_SETTINGS['DATABASE']}"

# LCNC 데이터베이스용 엔진 생성
lcnc_engine = create_engine(LCNC_DATABASE_URL, echo=False)

# 테이블 생성 함수 (없는 경우에만)
def create_lcnc_tables():
    lcnc_metadata.create_all(lcnc_engine)
    print("LCNC 테이블이 성공적으로 생성되었습니다.")

# 서버 시작 시 테이블 생성 실행
create_lcnc_tables()

# LCNC SQL 객체
lcnc_sql = {
    "engine": lcnc_engine,
    "metadata": lcnc_metadata,
    "tables": {
        "msa6_result_cd": msa6_result_cd,
        "msa6_result_defect": msa6_result_defect
    }
}

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
    'DATABASE': os.getenv('MONGO_DATABASE', 'image_app'),
    'AUTH_COLLECTION': 'auth_users',
    'ROLES_COLLECTION': 'user_roles',
} 