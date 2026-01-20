"""
預算控管 API 路由

提供預算設定、消費統計、採買建議的 API 端點。
"""

import logging
from typing import List
from fastapi import APIRouter, HTTPException, Query, status

from src.models.user import User
from src.models.budget_settings import BudgetSettings
from src.schemas.budget import (
    BudgetSettingsResponse,
    BudgetSettingsUpdate,
    SpendingStatsResponse,
    ShoppingSuggestion,
)
from src.services.budget_service import BudgetService
from src.routes.dependencies import DBSession, CurrentUserId

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Budget"])


@router.get("/budget/stats", response_model=SpendingStatsResponse)
async def get_spending_stats(
    db: DBSession,
    user_id: CurrentUserId,
    period: str = Query('month', pattern='^(month|year)$', description="統計期間（month 或 year）")
):
    """
    獲取消費統計

    根據指定期間（月度或年度）統計使用者的消費狀況，包括：
    - 總消費金額
    - 預算使用百分比
    - 是否超過警告門檻
    - 分類消費統計
    - 月度趨勢（最近12個月）

    Args:
        period: 統計期間（'month' 或 'year'）
        db: 資料庫 session
        user_id: 使用者 ID（從 token 解析）

    Returns:
        SpendingStatsResponse: 消費統計資料

    Raises:
        HTTPException 400: 參數錯誤
        HTTPException 500: 伺服器內部錯誤
    """
    try:
        # 獲取消費統計
        stats = BudgetService.get_spending_stats(db, user_id, period=period)

        logger.info(f"使用者 {user_id} 獲取 {period} 消費統計: 總消費 {stats.total_spending}")
        return stats

    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"獲取消費統計失敗（參數錯誤）: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"獲取消費統計失敗: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="獲取消費統計失敗"
        )


@router.get("/budget/settings", response_model=BudgetSettingsResponse)
async def get_budget_settings(
    db: DBSession,
    user_id: CurrentUserId
):
    """
    獲取預算設定

    如果使用者尚未設定，則自動建立預設設定。

    Args:
        db: 資料庫 session
        user_id: 使用者 ID（從 token 解析）

    Returns:
        BudgetSettingsResponse: 預算設定

    Raises:
        HTTPException 500: 伺服器內部錯誤
    """
    try:
        # 查詢預算設定
        settings = db.query(BudgetSettings).filter(
            BudgetSettings.user_id == user_id
        ).first()

        # 如果不存在，建立預設設定
        if not settings:
            logger.info(f"為使用者 {user_id} 建立預設預算設定")
            settings = BudgetSettings(
                user_id=user_id,
                monthly_budget=10000.0,
                warning_threshold=80
            )
            db.add(settings)
            db.commit()
            db.refresh(settings)

        return settings

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"獲取預算設定失敗: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="獲取預算設定失敗"
        )


@router.put("/budget/settings", response_model=BudgetSettingsResponse)
async def update_budget_settings(
    settings_update: BudgetSettingsUpdate,
    db: DBSession,
    user_id: CurrentUserId
):
    """
    更新預算設定

    支援部分更新，只更新提供的欄位。

    Args:
        settings_update: 要更新的設定
        db: 資料庫 session
        user_id: 使用者 ID（從 token 解析）

    Returns:
        BudgetSettingsResponse: 更新後的預算設定

    Raises:
        HTTPException 400: 驗證錯誤
        HTTPException 500: 伺服器內部錯誤
    """
    try:
        # 查詢預算設定
        settings = db.query(BudgetSettings).filter(
            BudgetSettings.user_id == user_id
        ).first()

        # 如果不存在，建立預設設定
        if not settings:
            logger.info(f"為使用者 {user_id} 建立預設預算設定")
            settings = BudgetSettings(
                user_id=user_id,
                monthly_budget=10000.0,
                warning_threshold=80
            )
            db.add(settings)

        # 更新欄位（只更新非 None 的欄位）
        update_data = settings_update.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(settings, field, value)

        db.commit()
        db.refresh(settings)

        logger.info(f"使用者 {user_id} 的預算設定已更新: 預算={settings.monthly_budget}, 門檻={settings.warning_threshold}%")
        return settings

    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"更新預算設定失敗（驗證錯誤）: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"更新預算設定失敗: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="更新預算設定失敗"
        )


@router.get("/budget/shopping-suggestions", response_model=List[ShoppingSuggestion])
async def get_shopping_suggestions(
    db: DBSession,
    user_id: CurrentUserId
):
    """
    獲取採買建議

    基於以下條件生成採買建議：
    1. 庫存量低於安全存量的食材
    2. 常用但缺貨的食材（基於歷史記錄）
    3. 即將過期但數量不足的食材類別

    Args:
        db: 資料庫 session
        user_id: 使用者 ID（從 token 解析）

    Returns:
        List[ShoppingSuggestion]: 採買建議清單

    Raises:
        HTTPException 500: 伺服器內部錯誤
    """
    try:
        # 獲取採買建議
        suggestions = BudgetService.get_shopping_suggestions(db, user_id)

        logger.info(f"為使用者 {user_id} 生成 {len(suggestions)} 個採買建議")
        return suggestions

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"獲取採買建議失敗: {e}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="獲取採買建議失敗"
        )
