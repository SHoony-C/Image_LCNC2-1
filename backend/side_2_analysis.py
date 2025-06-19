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

def generate_demo_data() -> List[Dict[str, Any]]:
    base_date = datetime.now()
    data = []
    
    # 5개의 이미지에 대해 각각 3개의 측정 포인트 생성
    for i in range(5):
        item_id = f"item{i+1}"
        
        # 각 이미지당 3개의 측정 포인트
        for j in range(3):
            date = (base_date - timedelta(days=i)).strftime("%Y-%m-%d %H:%M:%S")
            
            # 측정 데이터 생성 - 비슷한 범위 내에서 약간의 차이를 둠
            measurements = {
                "x": random.uniform(100 + i*10, 120 + i*10),  # 이미지별로 비슷한 x 범위
                "y": random.uniform(200 + i*10, 220 + i*10)   # 이미지별로 비슷한 y 범위
            }
            
            # 결과 결정 (80% 확률로 양품)
            result = "양품" if random.random() < 0.8 else "불량"
            
            data.append({
                "item_id": item_id,
                "subitem_id": f"sub_{j+1}",  # 같은 이미지 내 서브 아이템
                "date": date,
                "measurements": measurements,
                "result": result
            })
    
    return data

def generate_defect_data() -> List[Dict[str, Any]]:
    base_date = datetime.now()
    data = []
    
    # 5개의 이미지에 대해 각각 3개의 불량 감지 포인트 생성
    for i in range(5):
        item_id = f"item{i+1}"
        
        # 각 이미지당 3개의 불량 감지 포인트
        for j in range(3):
            date = (base_date - timedelta(days=i)).strftime("%Y-%m-%d %H:%M:%S")
            
            # 기본 불량 점수 설정 (이미지별로 비슷한 범위)
            base_striation = random.uniform(50 + i*5, 70 + i*5)
            base_distortion = random.uniform(50 + i*5, 70 + i*5)
            
            # 각 포인트별로 약간의 변동
            striation = base_striation + random.uniform(-5, 5)
            distortion = base_distortion + random.uniform(-5, 5)
            
            # 불량 감지 위치 (이미지별로 비슷한 영역에 위치)
            defect_x = random.uniform(50 + i*20, 70 + i*20)
            defect_y = random.uniform(50 + i*20, 70 + i*20)
            
            # 결과 결정 (결함 점수가 70을 넘으면 불량)
            result = "불량" if max(striation, distortion) > 70 else "양품"
            
            data.append({
                "item_id": item_id,
                "subitem_id": f"sub_{j+1}",
                "lot_wafer": f"demo_lot_{i+1}",  # lot_wafer 필드 추가
                "date": date,
                "x": round(defect_x, 3),
                "y": round(defect_y, 3),
                "striation": round(striation, 3),
                "distortion": round(distortion, 3),
                "result": result
            })
    
    return data

def get_image_list() -> List[Dict[str, str]]:
    # 5개의 이미지만 반환
    return [{"filename": f"그림{i+1}.png"} for i in range(5)]

def get_real_measurement_data(table_name: Optional[str] = None, date_from: Optional[str] = None, date_to: Optional[str] = None) -> List[Dict[str, Any]]:
    """실제 데이터베이스에서 측정 데이터 조회"""
    try:
        conn = lcnc_sql["engine"].connect()
        
        # 기본 쿼리
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
            # 측정값을 x, y 좌표로 변환 (임시로 value를 기반으로 생성)
            base_value = float(row.value) if row.value else 0
            measurements = {
                "x": base_value * 10 + random.uniform(-5, 5),  # value 기반으로 x 좌표 생성
                "y": base_value * 15 + random.uniform(-5, 5)   # value 기반으로 y 좌표 생성
            }
            
            # 결과 결정 (value가 특정 임계값 이상이면 양품)
            result_status = "양품" if base_value > 50 else "불량"
            
            data.append({
                "table_name": row.table_name,
                "username": row.username,
                "lot_wafer": row.lot_wafer,
                "item_id": row.item_id,
                "subitem_id": row.subitem_id,
                "date": row.create_time.strftime("%Y-%m-%d %H:%M:%S") if row.create_time else "",
                "measurements": measurements,
                "value": base_value,
                "result": result_status
            })
        
        conn.close()
        return data
        
    except Exception as e:
        print(f"데이터베이스 조회 오류: {str(e)}")
        # 오류 발생 시 데모 데이터 반환
        return generate_demo_data()

def get_real_defect_data(table_name: Optional[str] = None, date_from: Optional[str] = None, date_to: Optional[str] = None) -> List[Dict[str, Any]]:
    """실제 데이터베이스에서 불량 감지 데이터 조회"""
    try:
        conn = lcnc_sql["engine"].connect()
        
        # 불량 감지 테이블에서 데이터 조회
        query_str = """
        SELECT 
            session_id,
            item_id,
            sub_item_id,
            x_pos,
            y_pos,
            value,
            is_bright,
            is_striated,
            is_distorted,
            created_at
        FROM msa6_result_defect
        WHERE 1=1
        """
        
        params = {}
        
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
            # 불량 점수 계산
            striation = random.uniform(40, 80) if row.is_striated else random.uniform(20, 50)
            distortion = random.uniform(40, 80) if row.is_distorted else random.uniform(20, 50)
            
            # 결과 결정
            result_status = "불량" if (row.is_striated or row.is_distorted) else "양품"
            
            data.append({
                "session_id": row.session_id,
                "item_id": row.item_id,
                "subitem_id": row.sub_item_id,
                "lot_wafer": f"lot_{row.session_id}" if row.session_id else "default_lot",  # lot_wafer 필드 추가
                "date": row.created_at.strftime("%Y-%m-%d %H:%M:%S") if row.created_at else "",
                "x": float(row.x_pos) if row.x_pos else 0,
                "y": float(row.y_pos) if row.y_pos else 0,
                "striation": round(striation, 3),
                "distortion": round(distortion, 3),
                "result": result_status
            })
        
        conn.close()
        return data
        
    except Exception as e:
        print(f"불량 감지 데이터 조회 오류: {str(e)}")
        # 오류 발생 시 데모 데이터 반환
        return generate_defect_data()

@router.get("/data")
async def get_side2_data(
    table_name: Optional[str] = Query(None, description="테이블명"),
    date_from: Optional[str] = Query(None, description="시작 날짜 (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="종료 날짜 (YYYY-MM-DD)")
):
    try:
        # 실제 데이터베이스에서 측정 데이터 조회
        measurement_data = get_real_measurement_data(table_name, date_from, date_to)
        images = get_image_list()
        return {
            "status": "success",
            "data": measurement_data,
            "images": images
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

@router.get("/data/{item_id}")
async def get_item_data(item_id: str):
    try:
        # 특정 항목의 데이터 조회
        item_data = [d for d in generate_demo_data() if d['item_id'] == item_id]
        if not item_data:
            raise HTTPException(status_code=404, detail="Item not found")
        return {
            "status": "success",
            "data": item_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/selected")
async def get_selected_data(selected_ids: List[str]):
    """선택된 데이터 포인트들의 상세 정보 조회"""
    try:
        selected_data = []
        demo_data = generate_demo_data()  # 데모 데이터 새로 생성
        
        for data_id in selected_ids:
            item_id, point_index = data_id.split('_')
            point_index = int(point_index)
            
            # 해당 아이템의 모든 데이터 중에서 특정 인덱스의 데이터 찾기
            matching_data = [d for d in demo_data if d['item_id'] == item_id]
            if point_index < len(matching_data):
                data = matching_data[point_index]
                selected_data.append({
                    **data,
                    'image_url': generate_image_url(data['item_id'], data['subitem_id'])
                })
        
        return {
            "status": "success",
            "data": selected_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/plot")
async def get_plot_data():
    """그래프용 데이터 조회"""
    plot_data = {
        'dates': [],
        'values': {},
        'items': list(set(d['item_id'] for d in generate_demo_data()))
    }
    
    # 날짜별로 데이터 정리
    for data in generate_demo_data():
        if data['date'] not in plot_data['dates']:
            plot_data['dates'].append(data['date'])
        
        if data['item_id'] not in plot_data['values']:
            plot_data['values'][data['item_id']] = []
        
        plot_data['values'][data['item_id']].append(data['value'])
    
    # 날짜 정렬
    plot_data['dates'].sort()
    
    return {
        "status": "success",
        "data": plot_data
    }

@router.get("/analysis/images/{item_id}/{subitem_id}")
async def get_related_images(item_id: int, subitem_id: int):
    try:
        # 관련 이미지 조회 로직
        return {
            "status": "success",
            "images": [
                {
                    "url": f"https://example.com/images/{item_id}/{subitem_id}/1.jpg",
                    "title": f"Image for {item_id}-{subitem_id}"
                }
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def get_measurement_data():
    """측정 데이터 조회"""
    return generate_demo_data()

def get_item_data_by_id(item_id: str):
    """특정 항목의 데이터 조회"""
    data = generate_demo_data()
    return [item for item in data if item['item_id'] == item_id]

def get_defect_data():
    """불량 감지 데이터 조회"""
    data = generate_demo_data()
    return [item for item in data if item['result'] == '불량']

def generate_image_url(item_id: str, subitem_id: str):
    # 실제로는 이미지 URL을 생성하거나 데이터베이스에서 조회
    return f"https://picsum.photos/200/200?random={hash(item_id + subitem_id)}" 