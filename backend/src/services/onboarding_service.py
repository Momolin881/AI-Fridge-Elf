"""
新手引導服務模組

管理新手三部曲進度追蹤和成就慶典。
"""

import logging
from datetime import datetime
from typing import Dict, Optional
from zoneinfo import ZoneInfo
from sqlalchemy.orm import Session

from src.models.user import User

logger = logging.getLogger(__name__)

# 台灣時區
TAIWAN_TZ = ZoneInfo("Asia/Taipei")

# 預設新手進度結構
DEFAULT_ONBOARDING_PROGRESS = {
    "is_completed": False,
    "completed_at": None,
    "tasks": {
        "photo_upload": {
            "completed": False,
            "completed_at": None
        },
        "mark_consumed": {
            "completed": False,
            "completed_at": None  
        },
        "recipe_view": {
            "completed": False,
            "completed_at": None
        }
    },
    "achievement_sent": False
}


def get_user_onboarding_progress(user_id: int, db: Session) -> Dict:
    """
    獲取用戶新手進度
    
    Args:
        user_id: 用戶 ID
        db: 資料庫 session
        
    Returns:
        新手進度字典
    """
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            logger.error(f"找不到用戶 {user_id}")
            return DEFAULT_ONBOARDING_PROGRESS.copy()
        
        # 如果沒有進度記錄，返回預設值
        try:
            if user.onboarding_progress is None:
                logger.info(f"用戶 {user_id} 沒有新手進度，返回預設值")
                return DEFAULT_ONBOARDING_PROGRESS.copy()
            
            return user.onboarding_progress
        except AttributeError:
            # 如果資料庫欄位不存在，返回預設值
            logger.warning(f"用戶 {user_id} 沒有 onboarding_progress 欄位，返回預設值")
            return DEFAULT_ONBOARDING_PROGRESS.copy()
        
    except Exception as e:
        logger.error(f"獲取新手進度失敗 (user_id: {user_id}): {e}")
        return DEFAULT_ONBOARDING_PROGRESS.copy()


def initialize_onboarding_progress(user_id: int, db: Session) -> bool:
    """
    初始化用戶新手進度
    
    Args:
        user_id: 用戶 ID
        db: 資料庫 session
        
    Returns:
        是否初始化成功
    """
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            logger.error(f"找不到用戶 {user_id}")
            return False
        
        # 如果已經有進度記錄，不重複初始化
        if user.onboarding_progress is not None:
            logger.info(f"用戶 {user_id} 已有新手進度記錄")
            return True
        
        # 初始化進度
        user.onboarding_progress = DEFAULT_ONBOARDING_PROGRESS.copy()
        db.commit()
        
        logger.info(f"用戶 {user_id} 新手進度初始化成功")
        return True
        
    except Exception as e:
        logger.error(f"初始化新手進度失敗 (user_id: {user_id}): {e}")
        db.rollback()
        return False


def update_task_progress(user_id: int, task_name: str, db: Session) -> Dict:
    """
    更新任務進度
    
    Args:
        user_id: 用戶 ID
        task_name: 任務名稱 ('photo_upload', 'mark_consumed', 'recipe_view')
        db: 資料庫 session
        
    Returns:
        更新後的進度和是否完成所有任務
    """
    try:
        logger.info(f"🔄 開始更新任務進度: 用戶 {user_id}, 任務 {task_name}")
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            logger.error(f"找不到用戶 {user_id}")
            return {"success": False, "is_all_completed": False}
        
        # 確保有進度記錄
        try:
            if user.onboarding_progress is None:
                initialize_onboarding_progress(user_id, db)
                user = db.query(User).filter(User.id == user_id).first()
            
            progress = user.onboarding_progress.copy()
        except AttributeError:
            # 如果資料庫欄位不存在，返回預設進度
            logger.warning(f"用戶 {user_id} 沒有 onboarding_progress 欄位，使用預設進度")
            return {
                "success": True,
                "is_all_completed": False,
                "progress": DEFAULT_ONBOARDING_PROGRESS.copy(),
                "show_celebration": False
            }
        
        # 檢查任務是否存在
        if task_name not in progress["tasks"]:
            logger.error(f"未知任務名稱: {task_name}")
            return {"success": False, "is_all_completed": False}
        
        # 如果任務已完成，不重複更新
        if progress["tasks"][task_name]["completed"]:
            logger.info(f"用戶 {user_id} 任務 {task_name} 已完成")
            return {
                "success": True, 
                "is_all_completed": progress["is_completed"],
                "progress": progress
            }
        
        # 更新任務狀態
        current_time = datetime.now(TAIWAN_TZ).isoformat()
        progress["tasks"][task_name]["completed"] = True
        progress["tasks"][task_name]["completed_at"] = current_time
        
        # 檢查是否完成所有任務
        all_completed = all(
            task["completed"] for task in progress["tasks"].values()
        )
        
        if all_completed and not progress["is_completed"]:
            progress["is_completed"] = True
            progress["completed_at"] = current_time
            logger.info(f"🎊 用戶 {user_id} 完成所有新手任務！")
        
        # 保存到資料庫
        user.onboarding_progress = progress
        db.commit()
        
        logger.info(f"用戶 {user_id} 任務 {task_name} 完成")
        return {
            "success": True,
            "is_all_completed": all_completed,
            "progress": progress,
            "just_completed_all": all_completed and not progress.get("achievement_sent", False)
        }
        
    except Exception as e:
        logger.error(f"更新任務進度失敗 (user_id: {user_id}, task: {task_name}): {e}")
        db.rollback()
        return {"success": False, "is_all_completed": False}


def mark_achievement_sent(user_id: int, db: Session) -> bool:
    """
    標記成就慶典已發送
    
    Args:
        user_id: 用戶 ID
        db: 資料庫 session
        
    Returns:
        是否標記成功
    """
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user or user.onboarding_progress is None:
            logger.error(f"找不到用戶或進度記錄 {user_id}")
            return False
        
        progress = user.onboarding_progress.copy()
        progress["achievement_sent"] = True
        user.onboarding_progress = progress
        db.commit()
        
        logger.info(f"用戶 {user_id} 成就慶典標記為已發送")
        return True
        
    except Exception as e:
        logger.error(f"標記成就慶典失敗 (user_id: {user_id}): {e}")
        db.rollback()
        return False


def should_show_onboarding_tutorial(user_id: int, db: Session) -> bool:
    """
    檢查是否應該顯示新手教學
    
    Args:
        user_id: 用戶 ID
        db: 資料庫 session
        
    Returns:
        是否應該顯示新手教學
    """
    try:
        # 封測階段：所有用戶都顯示新手教學（可透過點 X 關閉）
        # TODO: 正式上線後改為檢查用戶完成狀態
        return True
        
        # 正式版邏輯（暫時註解）：
        # progress = get_user_onboarding_progress(user_id, db)
        # 
        # # 如果已完成所有任務，不顯示教學
        # if progress["is_completed"]:
        #     return False
        # 
        # # 如果是新用戶（沒有進度記錄），顯示教學
        # user = db.query(User).filter(User.id == user_id).first()
        # if not user or user.onboarding_progress is None:
        #     return True
        # 
        # # 如果有未完成的任務，顯示教學
        # return not progress["is_completed"]
        
    except Exception as e:
        logger.error(f"檢查新手教學顯示狀態失敗 (user_id: {user_id}): {e}")
        return False


def get_onboarding_stats(user_id: int, db: Session) -> Dict:
    """
    獲取新手進度統計
    
    Args:
        user_id: 用戶 ID
        db: 資料庫 session
        
    Returns:
        進度統計
    """
    try:
        progress = get_user_onboarding_progress(user_id, db)
        
        completed_tasks = [
            task_name for task_name, task_data in progress["tasks"].items()
            if task_data["completed"]
        ]
        
        return {
            "total_tasks": len(progress["tasks"]),
            "completed_count": len(completed_tasks),
            "completed_tasks": completed_tasks,
            "is_completed": progress["is_completed"],
            "completion_rate": len(completed_tasks) / len(progress["tasks"]) * 100
        }
        
    except Exception as e:
        logger.error(f"獲取新手進度統計失敗 (user_id: {user_id}): {e}")
        return {
            "total_tasks": 3,
            "completed_count": 0,
            "completed_tasks": [],
            "is_completed": False,
            "completion_rate": 0
        }