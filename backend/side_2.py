from fastapi import APIRouter, HTTPException

router = APIRouter()

@router.get("/data")
async def get_side2_data():
    try:
        # 측정 데이터 조회
        measurement_data = get_measurement_data()
        # 이미지 목록 조회
        images = get_image_list()
        return {
            "data": measurement_data,
            "images": images,
            "status": "success"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/data/{item_id}")
async def get_item_data(item_id: str):
    try:
        # 특정 항목의 데이터 조회
        item_data = get_item_data_by_id(item_id)
        return {
            "data": item_data,
            "status": "success"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/defect")
async def get_side2_defect_data():
    try:
        # 불량 감지 데이터 조회
        defect_data = get_defect_data()
        return {
            "data": defect_data,
            "status": "success"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 