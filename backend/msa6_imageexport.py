from fastapi import APIRouter, HTTPException, UploadFile, File, Body
from typing import List, Dict, Any
import os
import io
import traceback
import base64
import shutil
from datetime import datetime
from fastapi.responses import FileResponse, JSONResponse
from db_config import lcnc_sql
import json
from sqlalchemy.sql import text

router = APIRouter()

EXPORT_DIR = "./exports"
os.makedirs(EXPORT_DIR, exist_ok=True)

@router.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    try:
        # 원본 파일명 사용 (타임스탬프 제거)
        filename = file.filename
        file_path = os.path.join(EXPORT_DIR, filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        return {
            "status": "success",
            "message": "Image uploaded successfully",
            "filename": filename,
            "path": file_path
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/download/{filename}")
async def download_image(filename: str):
    try:
        file_path = os.path.join(EXPORT_DIR, filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        return FileResponse(file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list")
async def get_exports():
    try:
        # 내보내기된 이미지 목록 조회
        images = []
        for filename in os.listdir(EXPORT_DIR):
            if filename.endswith(('.jpg', '.jpeg', '.png')):
                images.append({
                    "filename": filename,
                    "path": os.path.join(EXPORT_DIR, filename),
                    "export_time": os.path.getctime(os.path.join(EXPORT_DIR, filename))
                })
        return {"status": "success", "images": images}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 

@router.post("/save-measurement")
async def save_measurement_legacy(measurement_data: Dict[str, Any] = Body(...)):
    """
    이전 버전과의 호환성을 위한 측정 데이터 저장 엔드포인트입니다.
    이제 SQL 데이터베이스를 사용합니다.
    """
    # 새로운 엔드포인트로 리디렉션
    return await save_measurement_to_lcnc(measurement_data)

@router.post("/save-measurement-lcnc")
async def save_measurement_to_lcnc(measurement_data: Dict[str, Any] = Body(...)):
    """
    측정 데이터를 LCNC 스키마에 저장합니다.
    일반 측정은 msa6_result_cd 테이블에, 불량 감지는 msa6_result_defect 테이블에 저장됩니다.
    """
    try:
        # 세션 ID 확인
        session_id = measurement_data.get("session_id")
        if not session_id:
            raise HTTPException(status_code=400, detail="세션 ID가 필요합니다")
            
        # 측정 결과 데이터
        measurements = measurement_data.get("measurements", [])
        measurement_mode = measurement_data.get("measurement_mode", "line")
        
        # 허용된 테이블 목록으로 테이블 검증
        allowed_tables = ["msa6_result_cd", "msa6_result_defect"]
        target_table = "msa6_result_cd"  # 기본값
        
        # 테이블 선택 (기본값은 msa6_result_cd)
        if measurement_mode == "defect":
            target_table = "msa6_result_defect"
        
        # 제공된 테이블이 있으면 해당 값 검증 후 사용
        requested_table = measurement_data.get("target_table")
        if requested_table and requested_table in allowed_tables:
            target_table = requested_table
        
        print(f"[save_measurement_to_lcnc] 저장 시작: 테이블={target_table}, 세션ID={session_id}, 데이터 개수={len(measurements)}")
        
        # 현재 시간
        now = datetime.now()
        
        # SQL 커넥션 가져오기
        conn = lcnc_sql["engine"].connect()
        
        try:
            # 트랜잭션 시작
            trans = conn.begin()
            
            # 불량 감지 모드인 경우
            if target_table == "msa6_result_defect":
                print(f"[save_measurement_to_lcnc] 불량 감지 결과 저장 중... ({len(measurements)}개)")
                
                for defect in measurements:
                    # SQL 삽입 쿼리 생성
                    query = text("""
                    INSERT INTO """ + target_table + """ (
                        session_id, item_id, sub_item_id, 
                        x_pos, y_pos, value, 
                        is_bright, is_striated, is_distorted,
                        created_at
                    ) VALUES (
                        :session_id, :itemId, :subItemId,
                        :xPos, :yPos, :value,
                        :isBright, :isStriated, :isDistorted,
                        :createdAt
                    )
                    """)
                    
                    print(f"[save_measurement_to_lcnc] 불량 감지 결과 저장: ID={defect.get('itemId', '')}, SubID={defect.get('subItemId', '')}")
                    conn.execute(query, {
                        "session_id": session_id,
                        "itemId": defect.get('itemId', ''),
                        "subItemId": defect.get('subItemId', ''),
                        "xPos": defect.get('x', 0),
                        "yPos": defect.get('y', 0),
                        "value": defect.get('value', 0),
                        "isBright": 1 if defect.get('isBright', False) else 0,
                        "isStriated": 1 if defect.get('isStriated', False) else 0,
                        "isDistorted": 1 if defect.get('isDistorted', False) else 0,
                        "createdAt": now
                    })
            
            # 일반 측정 모드인 경우
            else:
                print(f"[save_measurement_to_lcnc] 일반 측정 결과 저장 중... ({len(measurements)}개)")
                
                for measurement in measurements:
                    # SQL 삽입 쿼리 생성
                    query = text("""
                    INSERT INTO """ + target_table + """ (
                        table_name, username, lot_wafer, 
                        item_id, subitem_id, value, create_time
                    ) VALUES (
                        :table_name, :username, :lot_wafer,
                        :item_id, :subitem_id, :value, :create_time
                    )
                    """)
                    
                    print(f"[save_measurement_to_lcnc] 일반 측정 결과 저장: ID={measurement.get('itemId', '')}, SubID={measurement.get('subItemId', '')}, 값={measurement.get('value', 0)}")
                    conn.execute(query, {
                        "table_name": f"측정테이블_{measurement_mode}",
                        "username": "측정사용자",
                        "lot_wafer": session_id,
                        "item_id": measurement.get('itemId', ''),
                        "subitem_id": measurement.get('subItemId', ''),
                        "value": measurement.get('value', 0),
                        "create_time": now
                    })
            
            # 트랜잭션 커밋
            trans.commit()
            print(f"[save_measurement_to_lcnc] 트랜잭션 커밋 완료")
            
            # 응답 반환
            return {
                "status": "success",
                "message": f"측정 결과가 성공적으로 '{target_table}' 테이블에 저장되었습니다",
                "data": {
                    "table": target_table,
                    "count": len(measurements),
                    "session_id": session_id
                }
            }
            
        except Exception as sql_error:
            # 트랜잭션 롤백
            trans.rollback()
            print(f"[save_measurement_to_lcnc] SQL 오류로 트랜잭션 롤백: {str(sql_error)}")
            raise sql_error
            
        finally:
            # 커넥션 닫기
            conn.close()
            print(f"[save_measurement_to_lcnc] SQL 연결 종료")
            
    except Exception as e:
        print(f"[save_measurement_to_lcnc] 오류 발생: {str(e)}")
        print(f"[save_measurement_to_lcnc] 오류 타입: {type(e).__name__}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"측정 결과 저장 중 오류 발생: {str(e)}") 

@router.post("/transfer-table-names")
async def transfer_table_names():
    """
    lcnc.table_names 테이블에서 테이블 이름을 조회하여 
    msa6_result_cd 테이블에 데이터를 추가합니다.
    """
    try:
        print("[transfer_table_names] 테이블 이름 데이터 전송 시작")
        
        # SQL 커넥션 가져오기
        conn = lcnc_sql["engine"].connect()
        
        try:
            # 트랜잭션 시작
            trans = conn.begin()
            
            # 1. table_names 테이블에서 데이터 조회
            query_select = text("""
            SELECT idx, table_name, department 
            FROM table_names
            """)
            
            print("[transfer_table_names] 테이블 이름 조회 중...")
            result = conn.execute(query_select)
            table_data = result.fetchall()
            
            print(f"[transfer_table_names] 조회된 테이블 데이터: {len(table_data)}개")
            
            # 현재 시간
            now = datetime.now()
            
            # 2. 각 테이블 이름을 msa6_result_cd에 삽입
            for row in table_data:
                idx = row[0]
                table_name = row[1]
                department = row[2]
                
                # 기본 샘플 데이터 생성
                query_insert = text("""
                INSERT INTO msa6_result_cd (
                    table_name, username, lot_wafer, 
                    item_id, subitem_id, value, create_time
                ) VALUES (
                    :table_name, :username, :lot_wafer,
                    :item_id, :subitem_id, :value, :create_time
                )
                """)
                
                print(f"[transfer_table_names] '{table_name}' 데이터 삽입 중...")
                conn.execute(query_insert, {
                    "table_name": table_name,
                    "username": f"User_{department}" if department else "Default_User",
                    "lot_wafer": f"LOT_{idx}",
                    "item_id": f"ITEM_{idx}",
                    "subitem_id": f"SUB_{idx}",
                    "value": float(idx) * 1.5,  # 샘플 값
                    "create_time": now
                })
            
            # 트랜잭션 커밋
            trans.commit()
            print(f"[transfer_table_names] 트랜잭션 커밋 완료, {len(table_data)}개 데이터 삽입됨")
            
            # 응답 반환
            return {
                "status": "success",
                "message": f"테이블 이름 데이터가 성공적으로 msa6_result_cd 테이블에 저장되었습니다",
                "data": {
                    "count": len(table_data),
                    "tables": [row[1] for row in table_data]
                }
            }
            
        except Exception as sql_error:
            # 트랜잭션 롤백
            trans.rollback()
            print(f"[transfer_table_names] SQL 오류로 트랜잭션 롤백: {str(sql_error)}")
            raise sql_error
            
        finally:
            # 커넥션 닫기
            conn.close()
            print(f"[transfer_table_names] SQL 연결 종료")
            
    except Exception as e:
        print(f"[transfer_table_names] 오류 발생: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"테이블 이름 데이터 전송 중 오류 발생: {str(e)}") 

@router.get("/table-names")
async def get_table_names(search: str = ""):
    """
    lcnc.table_names 테이블에서 테이블 이름 목록을 조회합니다.
    검색어가 제공되면 해당 검색어로 필터링합니다.
    """
    try:
        print("[get_table_names] 테이블 이름 조회 시작")
        
        # SQL 커넥션 가져오기
        conn = lcnc_sql["engine"].connect()
        
        try:
            # 검색어가 있는 경우 WHERE 절 추가
            where_clause = ""
            params = {}
            
            if search:
                where_clause = "WHERE table_name LIKE :search"
                params["search"] = f"%{search}%"
            
            # 테이블 이름 조회 쿼리
            query = text(f"""
            SELECT idx, table_name, department 
            FROM table_names
            {where_clause}
            ORDER BY table_name ASC
            """)
            
            print(f"[get_table_names] 테이블 이름 조회 쿼리 실행: {where_clause}")
            result = conn.execute(query, params)
            rows = result.fetchall()
            
            # 결과를 JSON 형식으로 변환
            table_names = []
            for row in rows:
                table_names.append({
                    "idx": row[0],
                    "table_name": row[1],
                    "department": row[2]
                })
            
            print(f"[get_table_names] 조회된 테이블 이름: {len(table_names)}개")
            
            return {
                "status": "success",
                "data": table_names
            }
            
        except Exception as sql_error:
            print(f"[get_table_names] SQL 오류: {str(sql_error)}")
            raise sql_error
            
        finally:
            # 커넥션 닫기
            conn.close()
            print(f"[get_table_names] SQL 연결 종료")
            
    except Exception as e:
        print(f"[get_table_names] 오류 발생: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"테이블 이름 조회 중 오류 발생: {str(e)}")

@router.get("/table-schema")
async def get_table_schema(table_name: str = "msa6_result_cd"):
    """
    지정된 테이블의 스키마 정보를 조회합니다.
    """
    try:
        print(f"[get_table_schema] 테이블 스키마 조회 시작: {table_name}")
        
        # SQL 커넥션 가져오기
        conn = lcnc_sql["engine"].connect()
        
        try:
            # 테이블 컬럼 정보 조회 쿼리
            query = text(f"""
            SELECT 
                COLUMN_NAME, 
                DATA_TYPE, 
                IS_NULLABLE, 
                COLUMN_DEFAULT,
                CHARACTER_MAXIMUM_LENGTH
            FROM 
                INFORMATION_SCHEMA.COLUMNS 
            WHERE 
                TABLE_NAME = :table_name
            ORDER BY 
                ORDINAL_POSITION
            """)
            
            print(f"[get_table_schema] 테이블 스키마 조회 쿼리 실행: {table_name}")
            result = conn.execute(query, {"table_name": table_name})
            columns = result.fetchall()
            
            # 결과를 JSON 형식으로 변환
            schema = []
            for col in columns:
                schema.append({
                    "column_name": col[0],
                    "data_type": col[1],
                    "is_nullable": col[2],
                    "default_value": col[3],
                    "max_length": col[4]
                })
            
            print(f"[get_table_schema] 조회된 컬럼 수: {len(schema)}")
            
            return {
                "status": "success",
                "table_name": table_name,
                "schema": schema
            }
            
        except Exception as sql_error:
            print(f"[get_table_schema] SQL 오류: {str(sql_error)}")
            raise sql_error
            
        finally:
            # 커넥션 닫기
            conn.close()
            print(f"[get_table_schema] SQL 연결 종료")
            
    except Exception as e:
        print(f"[get_table_schema] 오류 발생: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"테이블 스키마 조회 중 오류 발생: {str(e)}")

@router.post("/check-table-permission")
async def check_table_permission(data: Dict[str, Any] = Body(...)):
    """
    table_user 테이블에서 사용자의 테이블 접근 권한을 확인합니다.
    """
    try:
        table_name = data.get("table_name")
        username = data.get("username")
        
        if not table_name or not username:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "table_name과 username 파라미터가 필요합니다."}
            )
        
        print(f"[check_table_permission] 권한 확인: 사용자={username}, 테이블={table_name}")
        
        # SQL 커넥션 가져오기
        conn = lcnc_sql["engine"].connect()
        
        try:
            # table_user 테이블에서 권한 확인
            query = text("""
            SELECT COUNT(*) as count FROM table_user
            WHERE table_name = :table_name AND username = :username
            """)
            
            result = conn.execute(query, {"table_name": table_name, "username": username}).fetchone()
            
            has_permission = result and result[0] > 0
            
            print(f"[check_table_permission] 권한 확인 결과: {has_permission}")
            
            return {
                "status": "success",
                "has_permission": has_permission,
                "message": "권한이 있습니다." if has_permission else "권한이 없습니다."
            }
                
        except Exception as sql_error:
            print(f"[check_table_permission] SQL 오류: {str(sql_error)}")
            return JSONResponse(
                status_code=500,
                content={"status": "error", "message": f"권한 확인 중 오류: {str(sql_error)}"}
            )
            
        finally:
            conn.close()
            
    except Exception as e:
        print(f"[check_table_permission] 오류: {str(e)}")
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"권한 확인 중 오류가 발생했습니다: {str(e)}"}
        )

@router.options("/check-table-permission")
async def options_check_table_permission():
    """CORS preflight 요청을 처리하기 위한 OPTIONS 메소드 핸들러"""
    response = JSONResponse(content={"message": "CORS preflight request handled"})
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response

@router.post("/save-with-table-name")
async def save_with_table_name(data: Dict[str, Any] = Body(...)):
    """
    측정 데이터를 선택한 테이블 이름과 함께 msa6_result_cd 테이블에 저장합니다.
    단일 측정값 또는 측정값 배열을 받을 수 있습니다.
    측정 결과가 표시된 before/after 이미지도 함께 저장합니다.
    """
    # CORS 헤더 추가 (응답 커스터마이징 지원)
    response = JSONResponse(content={"status": "pending"})
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    
    # 변수를 미리 선언하고 초기화
    trans = None
    conn = None
    
    try:
        print("[save_with_table_name] 측정 데이터 저장 시작")
        print(f"[save_with_table_name] 요청 데이터 타입: {type(data)}")
        
        # 디버깅을 위한 더 자세한 요청 데이터 출력
        for key, value in data.items():
            if key in ['before_image_data', 'after_image_data']:
                print(f"[save_with_table_name] 요청 키: {key}, 값 길이: {len(str(value)) if value else 0}")
            else:
                print(f"[save_with_table_name] 요청 키: {key}, 값 타입: {type(value)}")
                if key == "measurements" and isinstance(value, list):
                    print(f"[save_with_table_name] 측정값 개수: {len(value)}")
                    if value and len(value) > 0:
                        print(f"[save_with_table_name] 첫 번째 측정값 샘플: {value[0]}")
        
        # 요청 데이터 확인
        table_name = data.get("table_name")
        username = data.get("username") or data.get("user_name", "")
        lot_wafer = data.get("lot_wafer", "")
        measurements = data.get("measurements", [])
        before_image_data = data.get("before_image_data")
        after_image_data = data.get("after_image_data")
        
        # 단일 측정값인 경우 리스트로 변환
        if "measurement" in data and data["measurement"]:
            measurements = [data["measurement"]]
        
        if not table_name:
            print("[save_with_table_name] 오류: 테이블 이름이 없음")
            raise HTTPException(status_code=400, detail="테이블 이름이 필요합니다")
        
        if not username:
            print("[save_with_table_name] 오류: 사용자명이 없음")
            raise HTTPException(status_code=400, detail="사용자명이 필요합니다")
        
        if not measurements:
            print("[save_with_table_name] 오류: 측정 데이터가 없음")
            raise HTTPException(status_code=400, detail="측정 데이터가 필요합니다")
        
        print(f"[save_with_table_name] 저장할 데이터: 테이블={table_name}, 사용자={username}, 측정값 수={len(measurements)}")
        
        # 이미지 저장 처리
        saved_images = {}
        if before_image_data or after_image_data:
            print("[save_with_table_name] 이미지 저장 시작")
            
            # 파일명 생성 (lot_wafer 기반)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            base_filename = f"{lot_wafer}_{timestamp}" if lot_wafer else f"measurement_{timestamp}"
            
            # Before 이미지 저장
            if before_image_data:
                try:
                    # base64 데이터에서 헤더 제거
                    if before_image_data.startswith('data:image/'):
                        before_image_data = before_image_data.split(',')[1]
                    
                    # base64 디코딩
                    before_image_bytes = base64.b64decode(before_image_data)
                    before_filename = f"{base_filename}_before.png"
                    before_filepath = os.path.join(EXPORT_DIR, before_filename)
                    
                    with open(before_filepath, 'wb') as f:
                        f.write(before_image_bytes)
                    
                    saved_images['before'] = before_filename
                    print(f"[save_with_table_name] Before 이미지 저장 완료: {before_filename}")
                except Exception as e:
                    print(f"[save_with_table_name] Before 이미지 저장 실패: {str(e)}")
            
            # After 이미지 저장
            if after_image_data:
                try:
                    print(f"[save_with_table_name] After 이미지 저장 시작")
                    print(f"[save_with_table_name] After 이미지 데이터 길이: {len(after_image_data)}")
                    print(f"[save_with_table_name] After 이미지 데이터 시작 부분: {after_image_data[:50]}...")
                    
                    # base64 데이터에서 헤더 제거
                    if after_image_data.startswith('data:image/'):
                        header_part = after_image_data.split(',')[0]
                        after_image_data = after_image_data.split(',')[1]
                        print(f"[save_with_table_name] After 이미지 헤더 제거: {header_part}")
                    
                    print(f"[save_with_table_name] After 이미지 Base64 데이터 길이: {len(after_image_data)}")
                    
                    # base64 디코딩
                    after_image_bytes = base64.b64decode(after_image_data)
                    after_filename = f"{base_filename}_after.png"
                    after_filepath = os.path.join(EXPORT_DIR, after_filename)
                    
                    print(f"[save_with_table_name] After 이미지 저장 경로: {after_filepath}")
                    print(f"[save_with_table_name] After 이미지 바이트 크기: {len(after_image_bytes)} bytes")
                    
                    with open(after_filepath, 'wb') as f:
                        f.write(after_image_bytes)
                    
                    # 저장된 파일 확인
                    if os.path.exists(after_filepath):
                        file_size = os.path.getsize(after_filepath)
                        print(f"[save_with_table_name] After 이미지 저장 완료: {after_filename} (크기: {file_size} bytes)")
                        
                        # 파일이 실제로 유효한 이미지인지 간단히 확인
                        try:
                            from PIL import Image
                            with Image.open(after_filepath) as img:
                                print(f"[save_with_table_name] After 이미지 검증 성공: {img.size} 크기, {img.mode} 모드")
                        except Exception as img_verify_error:
                            print(f"[save_with_table_name] After 이미지 검증 실패: {str(img_verify_error)}")
                    else:
                        print(f"[save_with_table_name] After 이미지 파일이 생성되지 않음: {after_filepath}")
                    
                    saved_images['after'] = after_filename
                except Exception as e:
                    print(f"[save_with_table_name] After 이미지 저장 실패: {str(e)}")
                    import traceback
                    print(f"[save_with_table_name] After 이미지 저장 오류 상세: {traceback.format_exc()}")
            else:
                print(f"[save_with_table_name] After 이미지 데이터가 없음")
        
        # 데이터베이스 연결 테스트
        try:
            print("[save_with_table_name] 데이터베이스 연결 테스트 시작")
            test_conn = lcnc_sql["engine"].connect()
            test_conn.execute(text("SELECT 1"))
            test_conn.close()
            print("[save_with_table_name] 데이터베이스 연결 테스트 성공")
        except Exception as db_test_error:
            print(f"[save_with_table_name] 데이터베이스 연결 테스트 실패: {str(db_test_error)}")
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"데이터베이스 연결 실패: {str(db_test_error)}")
        
        # 권한 확인 - table_user 테이블에서 실제 권한 확인
        print(f"[save_with_table_name] 권한 확인 시작: 사용자={username}, 테이블={table_name}")
        
        # 권한 확인용 연결 생성
        permission_conn = lcnc_sql["engine"].connect()
        try:
            permission_query = text("""
            SELECT COUNT(*) as count FROM table_user
            WHERE table_name = :table_name AND username = :username
            """)
            
            permission_result = permission_conn.execute(permission_query, {
                "table_name": table_name, 
                "username": username
            }).fetchone()
            
            has_permission = permission_result and permission_result[0] > 0
            
            print(f"[save_with_table_name] 권한 확인 결과: {has_permission}")
            
            if not has_permission:
                print(f"[save_with_table_name] 권한 없음: 사용자={username}, 테이블={table_name}")
                error_response = {
                    "status": "error",
                    "message": f"사용자 '{username}'은 테이블 '{table_name}'에 대한 저장 권한이 없습니다."
                }
                cors_response = JSONResponse(content=error_response, status_code=403)
                cors_response.headers["Access-Control-Allow-Origin"] = "*"
                cors_response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
                cors_response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
                return cors_response
                
        except Exception as permission_error:
            print(f"[save_with_table_name] 권한 확인 중 오류: {str(permission_error)}")
            error_response = {
                "status": "error",
                "message": f"권한 확인 중 오류가 발생했습니다: {str(permission_error)}"
            }
            cors_response = JSONResponse(content=error_response, status_code=500)
            cors_response.headers["Access-Control-Allow-Origin"] = "*"
            cors_response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
            cors_response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            return cors_response
        finally:
            permission_conn.close()
        
        print(f"[save_with_table_name] 권한 확인 완료: 저장 권한 있음")
        
        # 데이터 저장용 연결 생성
        conn = lcnc_sql["engine"].connect()
        
        try:
            # 현재 시간
            now = datetime.now()
            
            # 트랜잭션 시작
            trans = conn.begin()
            print("[save_with_table_name] 트랜잭션 시작됨")
            
            # 측정 데이터 삽입 쿼리 미리 정의
            query_str = """
            INSERT INTO msa6_result_cd (
                table_name, username, lot_wafer, 
                item_id, subitem_id, value, create_time
            ) VALUES (
                :table_name, :username, :lot_wafer,
                :item_id, :subitem_id, :value, :create_time
            )
            """
            
            # 쿼리 준비
            query = text(query_str)
            
            # 각 측정값 저장
            saved_count = 0
            errors = []
            
            for idx, measurement in enumerate(measurements):
                try:
                    # 유효한 측정값인지 확인 - dict 타입만 확인
                    if not isinstance(measurement, dict):
                        print(f"[save_with_table_name] 측정값 #{idx+1}: dict 타입이 아님, 건너뜀 (타입: {type(measurement)})")
                        continue
                    
                    # 필수 필드 확인
                    item_id = measurement.get("itemId", "")
                    subitem_id = measurement.get("subItemId", "")
                    raw_value = measurement.get("value", 0)
                    
                    # 원본 데이터 출력
                    print(f"[save_with_table_name] 측정값 #{idx+1} 원본: itemId={item_id}, subItemId={subitem_id}, value={raw_value}")
                    print(f"[save_with_table_name] 측정값 #{idx+1} 전체 객체: {measurement}")
                    
                    # 값이 없거나 0인 측정값도 저장하도록 변경 (실제 측정값이 0일 수 있음)
                    if raw_value is None:
                        print(f"[save_with_table_name] 측정값 #{idx+1}: 값이 None임, 0으로 설정")
                        raw_value = 0
                    
                    # float 변환 확인
                    try:
                        float_value = float(raw_value)
                        print(f"[save_with_table_name] 측정값 #{idx+1}: float 변환 성공: {float_value}")
                    except (ValueError, TypeError) as e:
                        print(f"[save_with_table_name] 측정값 #{idx+1}: 값({raw_value})을 float로 변환할 수 없음, 0으로 설정: {str(e)}")
                        float_value = 0.0
                    
                    # item_id, subitem_id는 원본 값 그대로 사용 (빈 값이어도 그대로 저장)
                    print(f"[save_with_table_name] 측정값 #{idx+1}: 원본 값 사용 - item_id='{item_id}', subitem_id='{subitem_id}'")
                    
                    # 파라미터 준비
                    params = {
                        "table_name": str(table_name)[:45] if table_name else "",  # varchar(45) 제한
                        "username": str(username)[:45] if username else "",  # varchar(45) 제한
                        "lot_wafer": str(lot_wafer)[:45] if lot_wafer else "",              # varchar(45) 제한
                        "item_id": str(item_id)[:45],           # varchar(45) 제한 - 원본 값 그대로 사용
                        "subitem_id": str(subitem_id)[:45],  # varchar(45) 제한 - 원본 값 그대로 사용
                        "value": float_value,                                      # double 타입
                        "create_time": now                                         # datetime 타입
                    }
                    
                    # 상세 로깅 추가 - 모든 값 정확히 확인
                    print(f"[save_with_table_name] 측정값 #{idx+1} 저장 파라미터:")
                    for key, value in params.items():
                        print(f"  - {key}: '{value}' (타입: {type(value).__name__}, 길이: {len(str(value)) if isinstance(value, str) else 'N/A'})")
                    
                    # 측정 데이터 삽입
                    print(f"[save_with_table_name] SQL 쿼리 실행: {query_str}")
                    try:
                        insert_result = conn.execute(query, params)
                        print(f"[save_with_table_name] SQL 실행 결과: {insert_result.rowcount} 행 영향 받음")
                        
                        # 실제로 데이터가 삽입되었는지 확인
                        if insert_result.rowcount > 0:
                            saved_count += 1
                            print(f"[save_with_table_name] 측정값 #{idx+1} 저장 성공 (총 {saved_count}개 저장됨)")
                        else:
                            print(f"[save_with_table_name] 측정값 #{idx+1} 저장 실패: 영향받은 행이 0개")
                            errors.append(f"측정값 #{idx+1}: 데이터베이스에 저장되지 않음")
                            
                    except Exception as exec_error:
                        print(f"[save_with_table_name] SQL 실행 오류: {str(exec_error)}")
                        print(f"[save_with_table_name] SQL 오류 상세:", traceback.format_exc())
                        errors.append(f"측정값 #{idx+1} SQL 오류: {str(exec_error)}")
                        # 단일 항목 오류는 무시하고 계속 진행
                        continue
                
                except Exception as item_error:
                    error_msg = f"측정값 #{idx+1} 저장 중 오류: {str(item_error)}"
                    print(f"[save_with_table_name] {error_msg}")
                    print(f"[save_with_table_name] 오류 상세 정보:", traceback.format_exc())
                    errors.append(error_msg)
            
            # 저장 결과 확인
            print(f"[save_with_table_name] 저장 완료: 성공 {saved_count}개, 실패 {len(errors)}개")
            
            if saved_count == 0 and errors:
                # 모든 측정값 저장에 실패한 경우
                if trans:
                    trans.rollback()
                    print("[save_with_table_name] 모든 저장 실패로 트랜잭션 롤백")
                error_detail = "; ".join(errors[:3])
                if len(errors) > 3:
                    error_detail += f"; 외 {len(errors)-3}개 오류"
                    
                # 오류 응답 반환
                error_response = {
                    "status": "error",
                    "message": f"모든 측정값 저장에 실패했습니다: {error_detail}"
                }
                return JSONResponse(content=error_response, status_code=500)
            
            # 트랜잭션 커밋
            if trans:
                try:
                    trans.commit()
                    print(f"[save_with_table_name] 트랜잭션 커밋 완료, {saved_count}개 저장됨")
                    
                    # 커밋 후 실제 저장된 데이터 확인
                    verify_conn = lcnc_sql["engine"].connect()
                    try:
                        verify_query = text("""
                        SELECT COUNT(*) as count FROM msa6_result_cd 
                        WHERE table_name = :table_name AND username = :username AND lot_wafer = :lot_wafer
                        ORDER BY create_time DESC
                        """)
                        verify_result = verify_conn.execute(verify_query, {
                            "table_name": table_name,
                            "username": username,
                            "lot_wafer": lot_wafer
                        }).fetchone()
                        
                        actual_count = verify_result[0] if verify_result else 0
                        print(f"[save_with_table_name] 데이터베이스 확인: 실제 저장된 레코드 수 = {actual_count}")
                        
                    except Exception as verify_error:
                        print(f"[save_with_table_name] 저장 확인 중 오류: {str(verify_error)}")
                    finally:
                        verify_conn.close()
                    
                except Exception as commit_error:
                    print(f"[save_with_table_name] 트랜잭션 커밋 오류: {str(commit_error)}")
                    trans.rollback()
                    print("[save_with_table_name] 트랜잭션 롤백됨")
                    raise commit_error
            
            # 응답 반환
            response = {
                "status": "success",
                "message": f"{saved_count}개의 측정 데이터가 성공적으로 '{table_name}' 테이블 이름으로 저장되었습니다",
                "saved_count": saved_count,
                "total_sent": len(measurements)
            }
            
            # 이미지 저장 정보 추가
            if saved_images:
                response["saved_images"] = saved_images
                image_info = []
                if 'before' in saved_images:
                    image_info.append(f"처리 전 이미지: {saved_images['before']}")
                if 'after' in saved_images:
                    image_info.append(f"처리 후 이미지: {saved_images['after']}")
                response["message"] += f". {', '.join(image_info)}도 저장되었습니다"
            
            if errors:
                response["warnings"] = errors
                
            # CORS 헤더가 포함된 성공 응답 반환
            cors_response = JSONResponse(content=response, status_code=200)
            cors_response.headers["Access-Control-Allow-Origin"] = "*"
            cors_response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
            cors_response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            return cors_response
            
        except Exception as sql_error:
            print(f"[save_with_table_name] SQL 오류: {str(sql_error)}")
            print(f"[save_with_table_name] SQL 오류 타입: {type(sql_error).__name__}")
            print(f"[save_with_table_name] SQL 오류 상세 정보:", traceback.format_exc())
            
            if trans:
                try:
                    trans.rollback()
                    print("[save_with_table_name] 트랜잭션 롤백됨")
                except Exception as rollback_error:
                    print(f"[save_with_table_name] 트랜잭션 롤백 중 오류: {str(rollback_error)}")
            
            error_response = {
                "status": "error",
                "message": f"SQL 오류: {str(sql_error)}",
                "detail": str(sql_error)
            }
            
            # CORS 헤더가 포함된 응답 반환
            cors_response = JSONResponse(content=error_response, status_code=500)
            cors_response.headers["Access-Control-Allow-Origin"] = "*"
            cors_response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
            cors_response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            return cors_response
        
        finally:
            # 커넥션 닫기 - conn이 존재할 때만 닫기
            if conn:
                try:
                    conn.close()
                    print(f"[save_with_table_name] SQL 연결 종료")
                except Exception as close_error:
                    print(f"[save_with_table_name] 연결 종료 중 오류: {str(close_error)}")
            
    except HTTPException as http_ex:
        print(f"[save_with_table_name] HTTP 예외: {http_ex.detail}")
        raise http_ex
    except Exception as e:
        print(f"[save_with_table_name] 예외 발생: {str(e)}")
        print(f"[save_with_table_name] 예외 유형: {type(e).__name__}")
        traceback.print_exc()
        
        error_response = {
            "status": "error",
            "message": f"측정 데이터 저장 중 오류 발생: {str(e)}"
        }
        
        # CORS 헤더가 포함된 응답 반환
        cors_response = JSONResponse(content=error_response, status_code=500)
        cors_response.headers["Access-Control-Allow-Origin"] = "*"
        cors_response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        cors_response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return cors_response

@router.options("/save-with-table-name")
async def options_save_with_table_name():
    """CORS preflight 요청을 처리하기 위한 OPTIONS 메소드 핸들러"""
    response = JSONResponse(content={"message": "CORS preflight request handled"})
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response

@router.post("/test-connection")
async def test_connection():
    """연결 테스트용 간단한 API 엔드포인트"""
    response = JSONResponse(content={
        "status": "success",
        "message": "API 서버가 정상적으로 동작 중입니다.",
        "timestamp": str(datetime.now())
    })
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS, GET"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response

@router.post("/check-lot-wafer")
async def check_lot_wafer_duplicate(data: Dict[str, Any] = Body(...)):
    """
    지정된 테이블에서 lot_wafer 값이 이미 존재하는지 확인합니다.
    존재하는 경우 'duplicate'를 반환하고, 그렇지 않은 경우 'available'을 반환합니다.
    """
    try:
        # 필수 파라미터 확인
        table_name = data.get("table_name")
        lot_wafer = data.get("lot_wafer")
        
        if not table_name or not lot_wafer:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "table_name과 lot_wafer 파라미터가 필요합니다."}
            )
        
        print(f"[check_lot_wafer_duplicate] 중복 확인: 테이블={table_name}, lot_wafer={lot_wafer}")
        
        # SQL 커넥션 가져오기
        conn = lcnc_sql["engine"].connect()
        
        try:
            # 안전한 쿼리 실행을 위해 text() 사용
            query = text("""
            SELECT COUNT(*) as count FROM msa6_result_cd
            WHERE table_name = :table_name AND lot_wafer = :lot_wafer
            """)
            
            result = conn.execute(query, {"table_name": table_name, "lot_wafer": lot_wafer}).fetchone()
            
            if result and result[0] > 0:
                print(f"[check_lot_wafer_duplicate] 중복 발견: {result[0]}개의 레코드가 있습니다.")
                return {
                    "status": "duplicate",
                    "message": f"이미 '{table_name}' 테이블에 '{lot_wafer}' Lot Wafer가 존재합니다."
                }
            else:
                print(f"[check_lot_wafer_duplicate] 중복 없음: 사용 가능")
                return {
                    "status": "available",
                    "message": "사용 가능한 Lot Wafer입니다."
                }
                
        except Exception as sql_error:
            print(f"[check_lot_wafer_duplicate] SQL 오류: {str(sql_error)}")
            return JSONResponse(
                status_code=500,
                content={"status": "error", "message": f"데이터베이스 쿼리 오류: {str(sql_error)}"}
            )
            
        finally:
            # 커넥션 닫기
            conn.close()
            print(f"[check_lot_wafer_duplicate] SQL 연결 종료")
            
    except Exception as e:
        print(f"[check_lot_wafer_duplicate] 일반 오류: {str(e)}")
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"중복 확인 중 오류가 발생했습니다: {str(e)}"}
        ) 

@router.options("/check-lot-wafer")
async def options_check_lot_wafer():
    """
    CORS 프리플라이트 요청을 처리하기 위한 OPTIONS 메소드 핸들러
    """
    response = JSONResponse(content={"status": "ok"})
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response 