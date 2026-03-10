"""
新手引導相關 API 端點
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict

from src.database import get_db
from src.routes.dependencies import get_current_user_id
from src.services import onboarding_service

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/onboarding",
    tags=["onboarding"],
    responses={404: {"description": "Not found"}},
)


@router.get("/progress", response_model=Dict)
async def get_onboarding_progress(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """獲取當前用戶的新手進度"""
    try:
        progress = onboarding_service.get_user_onboarding_progress(user_id, db)
        
        return {
            "success": True,
            "data": progress
        }
        
    except Exception as e:
        logger.error(f"獲取新手進度失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="獲取新手進度失敗"
        )


@router.post("/initialize", response_model=Dict)
async def initialize_onboarding(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """初始化新手進度"""
    try:
        success = onboarding_service.initialize_onboarding_progress(user_id, db)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="初始化新手進度失敗"
            )
        
        return {
            "success": True,
            "message": "新手進度初始化成功"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"初始化新手進度失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="初始化新手進度失敗"
        )


@router.post("/task/{task_name}/complete", response_model=Dict)
async def complete_task(
    task_name: str,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """標記任務完成"""
    try:
        logger.info(f"📍 路由：完成任務 {task_name}，用戶 {user_id}")
        
        # 檢查任務名稱是否有效
        valid_tasks = ["photo_upload", "mark_consumed", "recipe_view"]
        if task_name not in valid_tasks:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"無效的任務名稱。有效值：{', '.join(valid_tasks)}"
            )
        
        logger.info(f"📍 調用 update_task_progress: 用戶 {user_id}, 任務 {task_name}")
        result = onboarding_service.update_task_progress(user_id, task_name, db)
        
        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="更新任務進度失敗"
            )
        
        response_data = {
            "success": True,
            "message": f"任務 {task_name} 完成",
            "is_all_completed": result["is_all_completed"],
            "progress": result["progress"]
        }
        
        # 如果剛好完成所有任務，標記需要顯示慶典
        if result.get("just_completed_all"):
            response_data["show_celebration"] = True
            response_data["celebration_message"] = "🎊 恭喜完成新手三部曲！"
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"完成任務失敗 (task: {task_name}): {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="完成任務失敗"
        )


@router.post("/celebration/sent", response_model=Dict)
async def mark_celebration_sent(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """標記成就慶典已顯示"""
    try:
        success = onboarding_service.mark_achievement_sent(user_id, db)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="標記慶典狀態失敗"
            )
        
        return {
            "success": True,
            "message": "成就慶典狀態已更新"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"標記慶典狀態失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="標記慶典狀態失敗"
        )


@router.get("/should-show-tutorial", response_model=Dict)
async def should_show_tutorial(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """檢查是否應該顯示新手教學"""
    try:
        should_show = onboarding_service.should_show_onboarding_tutorial(user_id, db)
        
        return {
            "success": True,
            "should_show": should_show
        }
        
    except Exception as e:
        logger.error(f"檢查新手教學顯示狀態失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="檢查教學狀態失敗"
        )


@router.get("/stats", response_model=Dict)
async def get_onboarding_stats(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """獲取新手進度統計"""
    try:
        stats = onboarding_service.get_onboarding_stats(user_id, db)
        
        return {
            "success": True,
            "data": stats
        }
        
    except Exception as e:
        logger.error(f"獲取新手進度統計失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="獲取進度統計失敗"
        )