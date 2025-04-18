from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from typing import List, Dict, Any
from datetime import datetime, timedelta
import random
import math
import os
import pandas as pd
import numpy as np

router = APIRouter()

# 데모 데이터 생성
def generate_demo_data():
    """데모 데이터 생성"""
    dates = pd.date_range(start='2023-01-01', end='2023-12-31', freq='D')
    data = []
    
    for item_id in ['item1', 'item2', 'item3']:
        for subitem_id in ['sub1', 'sub2']:
            # 기본값 설정
            base_value = np.random.normal(50, 10)
            
            # 사인파 패턴 추가
            sine_wave = 20 * np.sin(np.linspace(0, 4*np.pi, len(dates)))
            
            # 랜덤 노이즈 추가
            noise = np.random.normal(0, 5, len(dates))
            
            # 최종 값 계산
            values = base_value + sine_wave + noise
            
            # flag 값 설정 (1: 정상, 0: 경고, -1: 위험)
            for i, value in enumerate(values):
                if value > 80:  # 위험
                    flag = -1
                elif value > 70:  # 경고
                    flag = 0
                else:  # 정상
                    flag = 1
                
                data.append({
                    'date': dates[i].strftime('%Y-%m-%d'),
                    'item_id': item_id,
                    'subitem_id': subitem_id,
                    'value': float(value),
                    'flag': flag
                })
    
    return data

# 데모 이미지 URL 생성
def generate_image_url(item_id: str, subitem_id: str):
    # 실제로는 이미지 URL을 생성하거나 데이터베이스에서 조회
    return f"https://picsum.photos/200/200?random={hash(item_id + subitem_id)}"

# 데모 데이터 저장
demo_data = generate_demo_data()

@router.get("/data")
async def get_analysis_data():
    """분석 데이터 전체 조회"""
    return {
        "status": "success",
        "data": demo_data
    }

@router.get("/images/{item_id}")
async def get_image(item_id: str):
    """이미지 조회"""
    # item_id에서 숫자만 추출 (예: "item1" -> "1")
    item_number = item_id.replace("item", "")
    
    # 테스트 이미지 경로
    image_path = f"frontend/public/test_image/{item_number}.png"
    
    if os.path.exists(image_path):
        return FileResponse(image_path)
    else:
        # 이미지가 없으면 기본 이미지 반환
        default_image = "frontend/public/test_image/1.png"
        return FileResponse(default_image)

@router.get("/data/{item_id}")
async def get_item_data(item_id: str):
    """특정 아이템의 데이터 조회"""
    item_data = [d for d in demo_data if d['item_id'] == item_id]
    if not item_data:
        raise HTTPException(status_code=404, detail="Item not found")
    return {
        "status": "success",
        "data": item_data
    }

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
        'items': list(set(d['item_id'] for d in demo_data))
    }
    
    # 날짜별로 데이터 정리
    for data in demo_data:
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