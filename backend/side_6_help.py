from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any

router = APIRouter()

@router.get("/help/articles")
async def get_help_articles():
    try:
        # 도움말 문서 조회 로직
        return {
            "status": "success",
            "articles": [
                {
                    "id": 1,
                    "title": "Getting Started",
                    "content": "Welcome to the help section..."
                }
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/help/search")
async def search_help(query: str):
    try:
        # 도움말 검색 로직
        return {
            "status": "success",
            "results": [
                {
                    "id": 1,
                    "title": "Search Result",
                    "content": f"Results for: {query}"
                }
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 