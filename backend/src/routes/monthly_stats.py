"""
月度統計 API 路由

提供月度省錢統計查詢和推播功能。
"""

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session

from src.services.monthly_stats_service import MonthlyStatsService
from src.services.line_bot import LineBot
from src.routes.dependencies import DBSession, CurrentUserId

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Monthly Stats"])


@router.get("/stats/monthly")
async def get_monthly_stats(
    db: DBSession,
    user_id: CurrentUserId,
    month: Optional[str] = None
):
    """
    獲取用戶月度統計
    
    Args:
        month: 查詢月份 (格式: YYYY-MM，可選，預設為上個月)
        
    Returns:
        dict: 月度統計結果
    """
    try:
        # 解析月份參數
        target_month = None
        if month:
            try:
                target_month = datetime.strptime(month, "%Y-%m")
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="月份格式錯誤，請使用 YYYY-MM 格式"
                )
        
        # 計算統計
        stats = MonthlyStatsService.calculate_user_monthly_stats(user_id, target_month)
        
        if not stats:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="找不到統計資料，可能該月份沒有食材記錄"
            )
        
        return {
            "success": True,
            "data": stats
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"獲取月度統計失敗 (user_id: {user_id}): {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="獲取統計資料失敗"
        )


@router.post("/stats/monthly/send-notification")
async def send_monthly_notification(
    background_tasks: BackgroundTasks,
    user_id: CurrentUserId
):
    """
    手動發送月度統計推播給當前用戶
    
    Returns:
        dict: 發送結果
    """
    try:
        # 獲取統計資料
        stats = MonthlyStatsService.calculate_user_monthly_stats(user_id)
        
        if not stats:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="無統計資料可推播"
            )
        
        # 背景發送推播
        background_tasks.add_task(_send_monthly_stats_notification, user_id, stats)
        
        return {
            "success": True,
            "message": "月度統計推播已排程發送",
            "data": stats
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"發送月度統計推播失敗 (user_id: {user_id}): {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="推播發送失敗"
        )


@router.post("/stats/monthly/send-all")
async def send_all_monthly_notifications(
    background_tasks: BackgroundTasks,
    db: DBSession,
    user_id: CurrentUserId
):
    """
    發送月度統計推播給所有用戶（管理員功能）
    
    Returns:
        dict: 批量發送結果
    """
    try:
        # 獲取所有用戶統計
        all_stats = MonthlyStatsService.get_all_users_monthly_stats()
        
        if not all_stats:
            return {
                "success": True,
                "message": "沒有用戶需要發送推播",
                "sent_count": 0
            }
        
        # 背景批量發送
        for stats in all_stats:
            background_tasks.add_task(
                _send_monthly_stats_notification, 
                stats['user_id'], 
                stats
            )
        
        return {
            "success": True,
            "message": f"已排程發送 {len(all_stats)} 個月度統計推播",
            "sent_count": len(all_stats)
        }
        
    except Exception as e:
        logger.error(f"批量發送月度統計推播失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="批量推播發送失敗"
        )


async def _send_monthly_stats_notification(user_id: int, stats: dict):
    """背景任務：發送月度統計推播"""
    try:
        line_bot = LineBot()
        success = await line_bot.send_monthly_stats_notification(user_id, stats)
        
        if success:
            logger.info(f"月度統計推播發送成功 (user_id: {user_id})")
        else:
            logger.error(f"月度統計推播發送失敗 (user_id: {user_id})")
            
    except Exception as e:
        logger.error(f"月度統計推播發送異常 (user_id: {user_id}): {e}")


@router.get("/stats/monthly/test")
async def test_monthly_stats():
    """
    測試月度統計功能
    
    Returns:
        dict: 測試結果
    """
    try:
        # 假設用戶 ID 為 1 進行測試
        test_user_id = 1
        stats = MonthlyStatsService.calculate_user_monthly_stats(test_user_id)
        
        return {
            "success": True,
            "message": "月度統計測試完成",
            "test_user_id": test_user_id,
            "data": stats
        }
        
    except Exception as e:
        logger.error(f"月度統計測試失敗: {e}")
        return {
            "success": False,
            "message": f"測試失敗: {str(e)}",
            "data": None
        }