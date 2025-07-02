from fastapi import APIRouter, HTTPException, Depends, File, UploadFile, Form, Body, Query
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import os
import json
import shutil
from datetime import datetime
from pymongo import MongoClient
from bson import ObjectId
import logging
from sqlalchemy import text

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 라우터 정의
router = APIRouter()

# MongoDB 연결 설정
from db_config import MONGODB_SETTINGS

# MongoDB 클라이언트 생성
mongo_client = MongoClient(f"mongodb://{MONGODB_SETTINGS['HOST']}:{MONGODB_SETTINGS['PORT']}")
lcnc_results = mongo_client[MONGODB_SETTINGS['DATABASE']]['lcnc_result']

# MySQL 연결 설정 추가
from db_config import lcnc_sql

# 워크플로우 정보 가져오기
@router.get("/get-by-image")
async def get_workflow_by_image(filename: str):
    try:
        # 파일명에서 확장자 제거 (확장자가 있는 경우)
        base_filename = filename
        if '.' in filename:
            base_filename = filename.rsplit('.', 1)[0]  # 확장자 제거
        
        # "_before" 및 "_after" 접미사 제거
        clean_filename = base_filename
        for suffix in ["_before", "_after"]:
            if clean_filename.endswith(suffix):
                clean_filename = clean_filename[:-len(suffix)]
                break
        
        logger.info(f"Searching for workflow with clean filename: {clean_filename}, base: {base_filename}, original: {filename}")
        
        # 확장자 유무와 접미사 유무에 관계없이 MongoDB 쿼리 수행
        workflow = lcnc_results.find_one({
            "$or": [
                {"image_filename": filename},
                {"image_filename": base_filename},
                {"image_filename": clean_filename},
                {"input_image": filename},
                {"input_image": base_filename},
                {"input_image": clean_filename},
                {"output_image": filename},
                {"output_image": base_filename},
                {"output_image": clean_filename},
                {"images": {"$in": [filename, base_filename, clean_filename]}},
                {"processed_images": {"$in": [filename, base_filename, clean_filename]}},
                {"workflow_name": {"$regex": clean_filename, "$options": "i"}},
                {"workflow_name": {"$regex": base_filename, "$options": "i"}}
            ]
        })
        
        if workflow:
            # ObjectId를 문자열로 변환 (JSON 직렬화를 위해)
            workflow['_id'] = str(workflow['_id'])
            
            return {
                "status": "success",
                "workflow": workflow
            }
        else:
            # 데이터베이스에서 사용 가능한 워크플로우 목록 로깅 (디버깅용)
            sample_workflows = list(lcnc_results.find().limit(5))
            logger.info(f"No workflow found for {filename}. Sample workflows in DB: {[w.get('workflow_name', 'unknown') for w in sample_workflows]}")
            
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

# ===============================
# 테이블 관리 API 엔드포인트들
# ===============================

@router.get("/table-data")
async def get_table_data(
    table_name: str = Query(..., description="테이블명"),
    analysis_type: str = Query(..., description="분석 타입 (measurement 또는 defect)"),
    date_from: Optional[str] = Query(None, description="시작 날짜 (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="종료 날짜 (YYYY-MM-DD)"),
    lot_wafer_search: Optional[str] = Query(None, description="Lot Wafer 검색어"),
    username: Optional[str] = Query(None, description="사용자명 (선택사항)")
):
    """
    테이블 데이터를 조회합니다.
    """
    try:
        logger.info(f"Table data request - selected_table: {table_name}, type: {analysis_type}, user: {username}")
        logger.info(f"Date range: {date_from} ~ {date_to}, lot_wafer: {lot_wafer_search}")
        
        # 분석 타입에 따라 실제 SQL 테이블명 결정
        if analysis_type == "measurement":
            actual_table_name = "msa6_result_cd"
        elif analysis_type == "defect":
            actual_table_name = "msa6_result_defect"
        else:
            return {
                "status": "error",
                "message": f"지원되지 않는 분석 타입입니다: '{analysis_type}'"
            }
        
        logger.info(f"Using actual SQL table: {actual_table_name}")
        
        # 권한 확인 제거 - 모든 사용자가 같은 데이터 조회 가능
        # 분석 타입에 따른 데이터 조회
        if analysis_type == "measurement":
            data = get_measurement_table_data(actual_table_name, date_from, date_to, lot_wafer_search)
        elif analysis_type == "defect":
            data = get_defect_table_data(actual_table_name, date_from, date_to, lot_wafer_search)
        
        logger.info(f"Retrieved {len(data)} records from {actual_table_name}")
        
        return {
            "status": "success",
            "data": data,
            "count": len(data)
        }
        
    except Exception as e:
        logger.error(f"Error fetching table data: {str(e)}")
        return {
            "status": "error",
            "message": str(e)
        }

def update_generic_record(conn, table_name: str, columns: List[str], update_data: Dict[str, Any]) -> int:
    """범용 레코드 업데이트 함수"""
    logger.info(f"update_generic_record called with table: {table_name}")
    logger.info(f"Available columns: {columns}")
    logger.info(f"Update data: {update_data}")
    
    # ID 컬럼 결정 - 우선순위: pk_id > id
    id_column = None
    record_id = None
    
    if 'pk_id' in columns and 'pk_id' in update_data and update_data['pk_id'] is not None:
        id_column = 'pk_id'
        record_id = update_data.get("pk_id")
        logger.info(f"Using pk_id column: {record_id}")
    elif 'id' in columns and 'id' in update_data and update_data['id'] is not None:
        id_column = 'id'
        record_id = update_data.get("id")
        logger.info(f"Using id column: {record_id}")
    
    logger.info(f"ID column: {id_column}, Record ID: {record_id}")
    
    if not id_column or not record_id:
        logger.error(f"No valid ID found. ID column: {id_column}, Record ID: {record_id}")
        logger.error(f"Available columns: {columns}")
        logger.error(f"Update data keys: {list(update_data.keys())}")
        return 0
    
    # 레코드 존재 확인
    check_query = text(f"SELECT COUNT(*) FROM {table_name} WHERE {id_column} = :{id_column}")
    check_result = conn.execute(check_query, {id_column: record_id}).fetchone()
    
    if check_result[0] == 0:
        logger.error(f"Record with {id_column}={record_id} not found in table {table_name}")
        return 0
    
    logger.info(f"Found record with {id_column}={record_id}")
    
    # 업데이트 불가능한 필드들 (시스템 컬럼들)
    non_updatable_fields = {
        'pk_id', 'id', 'create_time', 'created_at', 'update_time', 'updated_at',
        'session_id', 'username', 'table_name'
    }
    
    # 업데이트 가능한 필드들 동적 생성
    updatable_fields = []
    params = {id_column: record_id}
    
    # 테이블에 존재하고 업데이트 데이터에 포함된 모든 컬럼을 처리
    for field_name, field_value in update_data.items():
        if (field_name in columns and 
            field_name not in non_updatable_fields and 
            field_name != id_column):
            
            logger.info(f"Processing field: {field_name} = {field_value}")
            
            # 특별한 처리가 필요한 필드들
            if field_name == "is_deleted":
                updatable_fields.append("is_deleted = :is_deleted")
                params["is_deleted"] = 1 if field_value else 0
            else:
                # 일반 필드들
                updatable_fields.append(f"{field_name} = :{field_name}")
                params[field_name] = field_value
    
    logger.info(f"Updatable fields: {updatable_fields}")
    logger.info(f"Final params: {params}")
    
    if not updatable_fields:
        logger.warning(f"No updatable fields found for record {record_id} in table {table_name}")
        return 0
    
    # 업데이트 쿼리 실행
    query_str = f"UPDATE {table_name} SET {', '.join(updatable_fields)} WHERE {id_column} = :{id_column}"
    logger.info(f"Update query: {query_str}")
    
    try:
        query = text(query_str)
        result = conn.execute(query, params)
        
        logger.info(f"Update result rowcount: {result.rowcount}")
        
        # 업데이트 후 레코드 확인
        verify_query = text(f"SELECT {', '.join(params.keys())} FROM {table_name} WHERE {id_column} = :{id_column}")
        verify_result = conn.execute(verify_query, {id_column: record_id}).fetchone()
        logger.info(f"Updated record verification: {dict(zip(params.keys(), verify_result)) if verify_result else 'Not found'}")
        
        return result.rowcount
    except Exception as e:
        logger.error(f"Error executing update query: {str(e)}")
        logger.error(f"Query: {query_str}")
        logger.error(f"Params: {params}")
        return 0

def get_measurement_table_data(table_name: str, date_from: Optional[str] = None, date_to: Optional[str] = None, lot_wafer_search: Optional[str] = None) -> List[Dict[str, Any]]:
    """측정 데이터 조회 (범용) - 모든 사용자 데이터 조회"""
    try:
        logger.info(f"=== get_measurement_table_data START ===")
        logger.info(f"Parameters: table_name={table_name}, date_from={date_from}, date_to={date_to}, lot_wafer_search={lot_wafer_search}")
        
        conn = lcnc_sql["engine"].connect()
        
        # 테이블 존재 여부 확인
        try:
            table_exists_query = text(f"SHOW TABLES LIKE '{table_name}'")
            logger.info(f"Table existence check query: {table_exists_query}")
            table_exists_result = conn.execute(table_exists_query)
            table_exists = table_exists_result.fetchone()
            logger.info(f"Table exists result: {table_exists}")
            
            if not table_exists:
                logger.error(f"Table {table_name} does not exist")
                conn.close()
                return []
        except Exception as e:
            logger.error(f"Error checking table existence for {table_name}: {str(e)}")
            conn.close()
            return []
        
        # 테이블 컬럼 정보 확인
        columns_query = text(f"SHOW COLUMNS FROM {table_name}")
        logger.info(f"Columns query: {columns_query}")
        columns_result = conn.execute(columns_query)
        columns = [row[0] for row in columns_result]
        logger.info(f"Table {table_name} columns: {columns}")
        
        # 기본 SELECT 절 구성
        select_fields = []
        for col in columns:
            if col == 'is_deleted':
                select_fields.append("COALESCE(is_deleted, 0) as is_deleted")
            else:
                select_fields.append(col)
        
        query_str = f"SELECT {', '.join(select_fields)} FROM {table_name} WHERE 1=1"
        params = {}
        
        # 날짜 컬럼 확인 및 필터 적용
        date_column = None
        if 'create_time' in columns:
            date_column = 'create_time'
        elif 'created_at' in columns:
            date_column = 'created_at'
        
        logger.info(f"Date column for {table_name}: {date_column}")
        
        if date_column:
            if date_from:
                query_str += f" AND DATE({date_column}) >= :date_from"
                params["date_from"] = date_from
            
            if date_to:
                query_str += f" AND DATE({date_column}) <= :date_to"
                params["date_to"] = date_to
        
        # 정렬 및 제한 - 최신 데이터부터
        if date_column:
            query_str += f" ORDER BY {date_column} DESC LIMIT 1000"
        else:
            # ID 컬럼이 있으면 ID 기준으로 정렬
            if 'pk_id' in columns:
                query_str += " ORDER BY pk_id DESC LIMIT 1000"
            elif 'id' in columns:
                query_str += " ORDER BY id DESC LIMIT 1000"
            else:
                query_str += " LIMIT 1000"
        
        logger.info(f"=== FINAL SQL QUERY ===")
        logger.info(f"Query: {query_str}")
        logger.info(f"Parameters: {params}")
        logger.info(f"========================")
        
        query = text(query_str)
        result = conn.execute(query, params)
        
        data = []
        row_count = 0
        for row in result:
            row_count += 1
            row_dict = {}
            for i, col in enumerate(columns):
                value = row[i]
                if col in ['value', 'major_axis', 'minor_axis', 'area', 'striated_ratio', 'distorted_ratio'] and value is not None:
                    row_dict[col] = float(value)
                elif col == 'is_deleted':
                    row_dict[col] = bool(value) if value is not None else False
                else:
                    row_dict[col] = value
            data.append(row_dict)
            
            # 처음 3개 행만 로그로 출력
            if row_count <= 3:
                logger.info(f"Sample row {row_count}: {row_dict}")
        
        conn.close()
        logger.info(f"Retrieved {len(data)} records from {table_name}")
        logger.info(f"=== get_measurement_table_data END ===")
        return data
        
    except Exception as e:
        logger.error(f"Error retrieving data from {table_name}: {str(e)}")
        logger.error(f"Exception details: {type(e).__name__}: {str(e)}")
        return []

def get_defect_table_data(table_name: str, date_from: Optional[str] = None, date_to: Optional[str] = None, lot_wafer_search: Optional[str] = None) -> List[Dict[str, Any]]:
    """불량 감지 데이터 조회 (범용) - measurement와 동일한 로직 사용"""
    return get_measurement_table_data(table_name, date_from, date_to, lot_wafer_search)

@router.get("/tables")
async def get_available_tables():
    """사용 가능한 테이블 목록을 반환합니다."""
    try:
        # 허용된 테이블 목록
        tables = ["msa6_result_cd", "msa6_result_defect"]
        
        # 각 테이블의 레코드 수도 함께 반환
        table_info = []
        for table in tables:
            try:
                conn = lcnc_sql["engine"].connect()
                query = text(f"SELECT COUNT(*) FROM {table}")
                result = conn.execute(query)
                count = result.fetchone()[0]
                conn.close()
                
                table_info.append({
                    "name": table,
                    "count": count,
                    "type": "measurement" if table == "msa6_result_cd" else "defect"
                })
            except Exception as e:
                logger.warning(f"Could not get count for table {table}: {str(e)}")
                table_info.append({
                    "name": table,
                    "count": 0,
                    "type": "measurement" if table == "msa6_result_cd" else "defect"
                })
        
        return {
            "status": "success",
            "tables": table_info
        }
        
    except Exception as e:
        logger.error(f"Error getting table list: {str(e)}")
        return {
            "status": "error",
            "message": str(e)
        }

@router.delete("/table-data/{table_name}")
async def delete_table_data(
    table_name: str,
    ids: List[int] = Body(..., description="삭제할 레코드 ID 목록"),
    username: str = Query(..., description="사용자명")
):
    """
    테이블에서 특정 레코드들을 삭제합니다.
    """
    try:
        # 사용자 권한 확인
        conn = lcnc_sql["engine"].connect()
        
        try:
            # 사용자가 해당 테이블에 대한 권한이 있는지 확인
            auth_query = text("""
            SELECT COUNT(*) FROM table_user 
            WHERE username = :username AND table_name = :table_name
            """)
            
            auth_result = conn.execute(auth_query, {"username": username, "table_name": table_name}).fetchone()
            
            if auth_result[0] == 0:
                return {
                    "status": "error",
                    "message": f"사용자 '{username}'는 테이블 '{table_name}'에 대한 권한이 없습니다."
                }
            
            if not ids:
                return {
                    "status": "error",
                    "message": "삭제할 ID가 없습니다."
                }
            
            # 트랜잭션 시작 - Connection 상태 확인 후 안전하게 처리
            if not conn.in_transaction():
                trans = conn.begin()
            else:
                # 이미 트랜잭션이 시작된 경우 새로운 Connection 생성
                conn.close()
                conn = lcnc_sql["engine"].connect()
                trans = conn.begin()
            
            try:
                # 테이블의 컬럼 정보 확인
                columns_query = text(f"SHOW COLUMNS FROM {table_name}")
                columns_result = conn.execute(columns_query)
                columns = [row[0] for row in columns_result]
                
                # ID 컬럼 결정
                if 'pk_id' in columns:
                    id_column = 'pk_id'
                elif 'id' in columns:
                    id_column = 'id'
                else:
                    return {
                        "status": "error",
                        "message": "삭제할 수 있는 ID 컬럼을 찾을 수 없습니다."
                    }
                
                # 각 ID에 대해 삭제 처리
                deleted_count = 0
                for record_id in ids:
                    query_str = f"DELETE FROM {table_name} WHERE {id_column} = :{id_column}"
                    query = text(query_str)
                    result = conn.execute(query, {id_column: record_id})
                    deleted_count += result.rowcount
                
                trans.commit()
                
                logger.info(f"Deleted {deleted_count} records from {table_name} by user {username}")
                
                return {
                    "status": "success",
                    "message": f"{deleted_count}개의 레코드가 삭제되었습니다.",
                    "deleted_count": deleted_count
                }
                
            except Exception as e:
                trans.rollback()
                logger.error(f"Transaction error in delete_table_data: {str(e)}")
                raise e
            
        finally:
            conn.close()
            
    except Exception as e:
        logger.error(f"Error deleting records from {table_name}: {str(e)}")
        return {
            "status": "error",
            "message": str(e)
        }

@router.put("/table-data/{table_name}")
async def update_table_data(
    table_name: str,
    updates: List[Dict[str, Any]] = Body(..., description="업데이트할 데이터 목록"),
    username: str = Query(..., description="사용자명")
):
    """
    테이블 데이터를 업데이트합니다.
    """
    try:
        # 연결 생성
        conn = lcnc_sql["engine"].connect()
        
        try:
            if not updates:
                return {
                    "status": "error",
                    "message": "업데이트할 데이터가 없습니다."
                }
            
            # 트랜잭션 시작 - Connection 상태 확인 후 안전하게 처리
            if not conn.in_transaction():
                trans = conn.begin()
            else:
                # 이미 트랜잭션이 시작된 경우 새로운 Connection 생성
                conn.close()
                conn = lcnc_sql["engine"].connect()
                trans = conn.begin()
            
            try:
                updated_count = 0
                
                # 테이블 구조에 따른 업데이트 처리
                # 먼저 테이블의 컬럼 정보를 확인
                columns_query = text(f"SHOW COLUMNS FROM {table_name}")
                columns_result = conn.execute(columns_query)
                columns = [row[0] for row in columns_result]
                
                for update_data in updates:
                    updated_count += update_generic_record(conn, table_name, columns, update_data)
                
                trans.commit()
                
                logger.info(f"Updated {updated_count} records in {table_name} by user {username}")
                
                return {
                    "status": "success",
                    "message": f"{updated_count}개의 레코드가 업데이트되었습니다.",
                    "updated_count": updated_count
                }
                
            except Exception as e:
                trans.rollback()
                logger.error(f"Transaction error in update_table_data: {str(e)}")
                raise e
            
        finally:
            conn.close()
            
    except Exception as e:
        logger.error(f"Error updating records in {table_name}: {str(e)}")
        return {
            "status": "error",
            "message": str(e)
        }

@router.get("/authorized-tables")
async def get_authorized_tables(username: str = Query(..., description="사용자명")):
    """
    사용자가 권한을 가진 테이블 목록을 조회합니다.
    table_user 테이블에서 권한을 확인합니다.
    """
    try:
        conn = lcnc_sql["engine"].connect()
        
        # table_user 테이블에서 사용자가 권한을 가진 테이블 목록 조회
        query = text("""
        SELECT DISTINCT tu.table_name, tn.table_desc
        FROM table_user tu
        LEFT JOIN table_names tn ON tu.table_name = tn.table_name
        WHERE tu.username = :username
        ORDER BY tu.table_name
        """)
        
        result = conn.execute(query, {"username": username})
        tables = []
        
        for row in result:
            tables.append({
                "table_name": row[0],
                "table_desc": row[1] if row[1] else ""
            })
        
        conn.close()
        
        return {
            "status": "success",
            "data": tables
        }
        
    except Exception as e:
        logger.error(f"Error fetching authorized tables for user {username}: {str(e)}")
        return {
            "status": "error",
            "message": str(e)
        }

@router.get("/table-description")
async def get_table_description(
    table_name: str = Query(..., description="테이블명")
):
    """
    테이블 설명을 조회합니다.
    """
    try:
        conn = lcnc_sql["engine"].connect()
        
        query = text("""
        SELECT table_desc
        FROM table_names
        WHERE table_name = :table_name
        """)
        
        result = conn.execute(query, {"table_name": table_name}).fetchone()
        
        conn.close()
        
        if result:
            return {
                "status": "success",
                "table_desc": result[0] if result[0] else ""
            }
        else:
            return {
                "status": "error",
                "message": "테이블을 찾을 수 없습니다."
            }
        
    except Exception as e:
        logger.error(f"Error fetching table description for {table_name}: {str(e)}")
        return {
            "status": "error",
            "message": str(e)
        }

@router.put("/table-description")
async def update_table_description(
    data: Dict[str, Any] = Body(..., description="테이블명과 설명")
):
    """
    테이블 설명을 업데이트합니다.
    """
    try:
        table_name = data.get("table_name")
        table_desc = data.get("table_desc", "")
        
        if not table_name:
            return {
                "status": "error",
                "message": "table_name이 필요합니다."
            }
        
        conn = lcnc_sql["engine"].connect()
        
        # 테이블이 table_names에 존재하는지 확인
        check_query = text("""
        SELECT COUNT(*) FROM table_names WHERE table_name = :table_name
        """)
        
        result = conn.execute(check_query, {"table_name": table_name}).fetchone()
        
        if result[0] == 0:
            # 없으면 새로 추가
            insert_query = text("""
            INSERT INTO table_names (table_name, table_desc) 
            VALUES (:table_name, :table_desc)
            """)
            conn.execute(insert_query, {"table_name": table_name, "table_desc": table_desc})
        else:
            # 있으면 업데이트
            update_query = text("""
            UPDATE table_names 
            SET table_desc = :table_desc
            WHERE table_name = :table_name
            """)
            conn.execute(update_query, {"table_name": table_name, "table_desc": table_desc})
        
        # 트랜잭션 커밋
        conn.commit()
        conn.close()
        
        return {
            "status": "success",
            "message": "테이블 설명이 성공적으로 업데이트되었습니다."
        }
        
    except Exception as e:
        logger.error(f"Error updating table description: {str(e)}")
        return {
            "status": "error",
            "message": str(e)
        } 