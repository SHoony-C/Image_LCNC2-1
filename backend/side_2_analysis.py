from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import random
import math
import os
import pandas as pd
import numpy as np
from sqlalchemy import text
from db_config import lcnc_sql

router = APIRouter()

def get_real_measurement_data(table_name: Optional[str] = None, date_from: Optional[str] = None, date_to: Optional[str] = None) -> List[Dict[str, Any]]:
    """실제 데이터베이스에서 측정 데이터 조회"""
    try:
        conn = lcnc_sql["engine"].connect()
        
        # 기본 쿼리 - is_deleted = 0 조건 추가
        query_str = """
        SELECT 
            table_name,
            username,
            lot_wafer,
            item_id,
            subitem_id,
            value,
            create_time
        FROM msa6_result_cd
        WHERE 1=1
        AND is_deleted = 0
        """
        
        params = {}
        
        # 테이블명 필터
        if table_name:
            query_str += " AND table_name = :table_name"
            params["table_name"] = table_name
        
        # 날짜 범위 필터
        if date_from:
            query_str += " AND DATE(create_time) >= :date_from"
            params["date_from"] = date_from
        
        if date_to:
            query_str += " AND DATE(create_time) <= :date_to"
            params["date_to"] = date_to
        
        query_str += " ORDER BY create_time DESC LIMIT 100"
        
        query = text(query_str)
        result = conn.execute(query, params)
        
        data = []
        for row in result:
            # 측정값 기본 정보
            base_value = float(row.value) if row.value else 0
            
            data.append({
                "table_name": row.table_name,
                "username": row.username,
                "lot_wafer": row.lot_wafer,
                "item_id": row.item_id,
                "subitem_id": row.subitem_id,
                "date": row.create_time.strftime("%Y-%m-%d %H:%M:%S") if row.create_time else "",
                "value": base_value
            })
        
        conn.close()
        return data
        
    except Exception as e:
        print(f"데이터베이스 조회 오류: {str(e)}")
        return []

def get_real_defect_data(table_name: Optional[str] = None, date_from: Optional[str] = None, date_to: Optional[str] = None) -> List[Dict[str, Any]]:
    """실제 데이터베이스에서 불량 감지 데이터 조회"""
    try:
        conn = lcnc_sql["engine"].connect()
        
        # 불량 감지 테이블에서 데이터 조회 - is_deleted = 0 조건 추가
        query_str = """
        SELECT 
            pk_id,
            table_name,
            username,
            lot_wafer,
            item_id,
            subitem_id,
            major_axis,
            minor_axis,
            area,
            striated_ratio,
            distorted_ratio,
            created_at
        FROM msa6_result_defect
        WHERE 1=1
        AND is_deleted = 0
        """
        
        params = {}
        
        # 테이블명 필터
        if table_name:
            query_str += " AND table_name = :table_name"
            params["table_name"] = table_name
        
        # 날짜 범위 필터
        if date_from:
            query_str += " AND DATE(created_at) >= :date_from"
            params["date_from"] = date_from
        
        if date_to:
            query_str += " AND DATE(created_at) <= :date_to"
            params["date_to"] = date_to
        
        query_str += " ORDER BY created_at DESC LIMIT 100"
        
        query = text(query_str)
        result = conn.execute(query, params)
        
        data = []
        for row in result:
            # 불량 감지 결과를 기반으로 좌표 생성 (major_axis, minor_axis 활용)
            major_axis = float(row.major_axis) if row.major_axis else 0
            minor_axis = float(row.minor_axis) if row.minor_axis else 0
            area = float(row.area) if row.area else 0
            
            data.append({
                "pk_id": row.pk_id,
                "table_name": row.table_name,
                "username": row.username,
                "lot_wafer": row.lot_wafer,
                "item_id": row.item_id,
                "subitem_id": row.subitem_id,
                "date": row.created_at.strftime("%Y-%m-%d %H:%M:%S") if row.created_at else "",
                "major_axis": major_axis,
                "minor_axis": minor_axis,
                "area": area,
                "striated_ratio": float(row.striated_ratio) if row.striated_ratio else 0,
                "distorted_ratio": float(row.distorted_ratio) if row.distorted_ratio else 0,
                "value": area,  # area를 value로 사용
                "is_bright": False,  # 기본값 설정
                "is_striated": (float(row.striated_ratio) if row.striated_ratio else 0) > 0.1,
                "is_distorted": (float(row.distorted_ratio) if row.distorted_ratio else 0) > 0.1
            })
        
        conn.close()
        return data
        
    except Exception as e:
        print(f"불량 감지 데이터 조회 오류: {str(e)}")
        return []

@router.get("/data")
async def get_side2_data(
    table_name: Optional[str] = Query(None, description="테이블명"),
    date_from: Optional[str] = Query(None, description="시작 날짜 (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="종료 날짜 (YYYY-MM-DD)")
):
    try:
        # 실제 데이터베이스에서 측정 데이터 조회
        measurement_data = get_real_measurement_data(table_name, date_from, date_to)
        return {
            "status": "success",
            "data": measurement_data,
            "images": []
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/data_defect")
async def get_side2_defect_data(
    table_name: Optional[str] = Query(None, description="테이블명"),
    date_from: Optional[str] = Query(None, description="시작 날짜 (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="종료 날짜 (YYYY-MM-DD)")
):
    try:
        # 실제 데이터베이스에서 불량 감지 데이터 조회
        defect_data = get_real_defect_data(table_name, date_from, date_to)
        return {
            "status": "success",
            "data": defect_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/authorized-tables")
async def get_authorized_tables(username: str = Query(..., description="사용자명")):
    """사용자가 권한을 가진 테이블 목록 조회"""
    try:
        conn = lcnc_sql["engine"].connect()
        
        # table_user 테이블에서 사용자가 권한을 가진 테이블 목록 조회
        query_str = """
        SELECT DISTINCT table_name 
        FROM table_user 
        WHERE username = :username
        AND table_name IS NOT NULL 
        AND table_name != ''
        ORDER BY table_name
        """
        
        query = text(query_str)
        result = conn.execute(query, {"username": username})
        
        tables = [row.table_name for row in result if row.table_name]
        
        conn.close()
        
        return {
            "status": "success",
            "data": tables
        }
        
    except Exception as e:
        print(f"테이블 목록 조회 오류: {str(e)}")
        return {
            "status": "error",
            "message": f"테이블 목록 조회 중 오류가 발생했습니다: {str(e)}"
        } 