from fastapi import APIRouter, HTTPException, UploadFile, File, Body
from typing import List, Dict, Any
import os
import shutil
from datetime import datetime
from fastapi.responses import FileResponse
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
                        table_name, user_name, lot_id, 
                        item_id, subitem_id, value, create_time
                    ) VALUES (
                        :table_name, :user_name, :lot_id,
                        :item_id, :subitem_id, :value, :create_time
                    )
                    """)
                    
                    print(f"[save_measurement_to_lcnc] 일반 측정 결과 저장: ID={measurement.get('itemId', '')}, SubID={measurement.get('subItemId', '')}, 값={measurement.get('value', 0)}")
                    conn.execute(query, {
                        "table_name": f"측정테이블_{measurement_mode}",
                        "user_name": "측정사용자",
                        "lot_id": session_id,
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
        import traceback
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
                    table_name, user_name, lot_id, 
                    item_id, subitem_id, value, create_time
                ) VALUES (
                    :table_name, :user_name, :lot_id,
                    :item_id, :subitem_id, :value, :create_time
                )
                """)
                
                print(f"[transfer_table_names] '{table_name}' 데이터 삽입 중...")
                conn.execute(query_insert, {
                    "table_name": table_name,
                    "user_name": f"User_{department}" if department else "Default_User",
                    "lot_id": f"LOT_{idx}",
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
        import traceback
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
        import traceback
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
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"테이블 스키마 조회 중 오류 발생: {str(e)}")

@router.post("/save-with-table-name")
async def save_with_table_name(data: Dict[str, Any] = Body(...)):
    """
    측정 데이터를 선택한 테이블 이름과 함께 msa6_result_cd 테이블에 저장합니다.
    단일 측정값 또는 측정값 배열을 받을 수 있습니다.
    """
    # 변수를 미리 선언하고 초기화
    trans = None
    conn = None
    query_str = ""
    query = None
    schema_conn = None
    
    try:
        print("[save_with_table_name] 측정 데이터 저장 시작")
        print(f"[save_with_table_name] 요청 데이터: {json.dumps(data, default=str)}")
        
        # 요청 데이터 확인
        table_name = data.get("table_name")
        user_name = data.get("user_name", "측정사용자")
        lot_id = data.get("lot_id", "")
        measurements = data.get("measurements", [])
        
        # 단일 측정값인 경우 리스트로 변환
        if "measurement" in data and data["measurement"]:
            measurements = [data["measurement"]]
        
        if not table_name:
            raise HTTPException(status_code=400, detail="테이블 이름이 필요합니다")
        
        if not measurements:
            raise HTTPException(status_code=400, detail="측정 데이터가 필요합니다")
        
        print(f"[save_with_table_name] 저장할 데이터: 테이블={table_name}, 측정값 수={len(measurements)}")
        
        # 테이블 구조 조회용 별도 연결 사용
        try:
            schema_conn = lcnc_sql["engine"].connect()
            schema_query = text("""
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'msa6_result_cd'
            ORDER BY ORDINAL_POSITION
            """)
            result = schema_conn.execute(schema_query)
            columns = result.fetchall()
            print("[save_with_table_name] msa6_result_cd 테이블 구조:")
            for col in columns:
                print(f"  - {col[0]}: {col[1]} {'(NULL 허용)' if col[2] == 'YES' else '(NULL 불가)'}")
            
            # 조회용 연결 닫기
            schema_conn.close()
            schema_conn = None
        except Exception as schema_error:
            print(f"[save_with_table_name] 테이블 구조 조회 실패: {str(schema_error)}")
            if schema_conn:
                schema_conn.close()
                schema_conn = None
        
        # 측정 데이터 삽입 쿼리 미리 정의
        query_str = """
        INSERT INTO msa6_result_cd (
            table_name, user_name, lot_id, 
            item_id, subitem_id, value, create_time
        ) VALUES (
            :table_name, :user_name, :lot_id,
            :item_id, :subitem_id, :value, :create_time
        )
        """
        
        # 데이터 저장용 연결 생성
        conn = lcnc_sql["engine"].connect()
        
        try:
            # 현재 시간
            now = datetime.now()
            
            # 트랜잭션 시작
            trans = conn.begin()
            
            # 쿼리 준비
            query = text(query_str)
            
            # 각 측정값 저장
            saved_count = 0
            errors = []
            
            for idx, measurement in enumerate(measurements):
                try:
                    # 유효한 측정값인지 확인
                    if not measurement or not isinstance(measurement, dict):
                        print(f"[save_with_table_name] 측정값 #{idx+1}: 유효하지 않은 형식, 건너뜀")
                        continue
                    
                    # 필수 필드 확인
                    item_id = measurement.get("itemId", "")
                    subitem_id = measurement.get("subItemId", "")
                    raw_value = measurement.get("value", 0)
                    
                    # 원본 데이터 출력
                    print(f"[save_with_table_name] 측정값 #{idx+1} 원본: itemId={item_id}, subItemId={subitem_id}, value={raw_value}")
                    
                    # 값이 없거나 0인 측정값은 건너뛰기
                    if not raw_value:
                        print(f"[save_with_table_name] 측정값 #{idx+1}: 값이 0이거나 없음, 건너뜀")
                        continue
                    
                    # float 변환 확인
                    try:
                        float_value = float(raw_value)
                        if float_value <= 0:
                            print(f"[save_with_table_name] 측정값 #{idx+1}: 값({raw_value})이 0보다 작거나 같음, 건너뜀")
                            continue
                    except (ValueError, TypeError) as e:
                        print(f"[save_with_table_name] 측정값 #{idx+1}: 값({raw_value})을 float로 변환할 수 없음, 건너뜀: {str(e)}")
                        continue
                    
                    # 파라미터 준비
                    params = {
                        "table_name": str(table_name)[:45] if table_name else "",  # varchar(45) 제한
                        "user_name": str(user_name)[:45] if user_name else "측정사용자",  # varchar(45) 제한
                        "lot_id": str(lot_id)[:45] if lot_id else "",              # varchar(45) 제한
                        "item_id": str(item_id)[:45] if item_id else "",           # varchar(45) 제한
                        "subitem_id": str(subitem_id)[:45] if subitem_id else "",  # varchar(45) 제한
                        "value": float_value,                                      # double 타입
                        "create_time": now                                         # datetime 타입
                    }
                    
                    # 상세 로깅 추가 - 모든 값 정확히 확인
                    print(f"[save_with_table_name] 측정값 #{idx+1} 저장 파라미터:")
                    for key, value in params.items():
                        print(f"  - {key}: {value} (타입: {type(value).__name__})")
                    
                    # 측정 데이터 삽입
                    conn.execute(query, params)
                    saved_count += 1
                    print(f"[save_with_table_name] 측정값 #{idx+1} 저장 성공")
                
                except Exception as item_error:
                    error_msg = f"측정값 #{idx+1} 저장 중 오류: {str(item_error)}"
                    print(f"[save_with_table_name] {error_msg}")
                    errors.append(error_msg)
            
            if saved_count == 0 and errors:
                # 모든 측정값 저장에 실패한 경우
                if trans:
                    trans.rollback()
                    print("[save_with_table_name] 모든 저장 실패로 트랜잭션 롤백")
                error_detail = "; ".join(errors[:3])
                if len(errors) > 3:
                    error_detail += f"; 외 {len(errors)-3}개 오류"
                raise HTTPException(status_code=500, detail=f"모든 측정값 저장에 실패했습니다: {error_detail}")
            
            # 트랜잭션 커밋
            if trans:
                trans.commit()
                print(f"[save_with_table_name] 트랜잭션 커밋 완료, {saved_count}개 저장됨")
            
            # 응답 반환
            response = {
                "status": "success",
                "message": f"{saved_count}개의 측정 데이터가 성공적으로 '{table_name}' 테이블 이름으로 저장되었습니다",
                "saved_count": saved_count,
                "total_sent": len(measurements)
            }
            
            if errors:
                response["warnings"] = errors
                
            return response
            
        except Exception as sql_error:
            # 트랜잭션 롤백 - trans가 존재할 때만 롤백
            if trans:
                try:
                    trans.rollback()
                    print(f"[save_with_table_name] SQL 오류로 트랜잭션 롤백: {str(sql_error)}")
                except Exception as rollback_error:
                    print(f"[save_with_table_name] 롤백 중 오류 발생: {str(rollback_error)}")
            else:
                print(f"[save_with_table_name] SQL 오류 발생(트랜잭션 없음): {str(sql_error)}")
            
            # SQL 쿼리 로깅 - query_str이 있을 때만 출력
            if query_str:
                print(f"[save_with_table_name] 실행 시도한 SQL 쿼리:")
                print(query_str)
            
            raise HTTPException(status_code=500, detail=f"SQL 오류: {str(sql_error)}")
            
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
        import traceback
        print("[save_with_table_name] 스택 트레이스:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"측정 데이터 저장 중 오류 발생: {str(e)}") 