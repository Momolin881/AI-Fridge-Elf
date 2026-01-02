"""
BudgetService 服務模組

提供預算控管和消費分析功能，包括消費統計、採買建議、預算警告檢查。
"""

import logging
from datetime import datetime, date
from dateutil.relativedelta import relativedelta
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, extract

from src.models.food_item import FoodItem
from src.models.fridge import Fridge
from src.models.budget_settings import BudgetSettings
from src.models.notification_settings import NotificationSettings
from src.schemas.budget import (
    SpendingStatsResponse,
    CategorySpending,
    MonthlyTrend,
    ShoppingSuggestion,
)

logger = logging.getLogger(__name__)


class BudgetService:
    """預算控管服務類別"""

    @staticmethod
    def get_spending_stats(
        db: Session,
        user_id: int,
        period: str = 'month'
    ) -> SpendingStatsResponse:
        """
        獲取消費統計

        Args:
            db: 資料庫 session
            user_id: 使用者 ID
            period: 統計期間（'month' 或 'year'）

        Returns:
            SpendingStatsResponse: 消費統計資料

        Raises:
            ValueError: 期間參數錯誤
        """
        if period not in ['month', 'year']:
            raise ValueError("period 必須是 'month' 或 'year'")

        # 獲取預算設定
        budget_settings = db.query(BudgetSettings).filter(
            BudgetSettings.user_id == user_id
        ).first()

        if not budget_settings:
            # 如果沒有設定，使用預設值
            budget_amount = 10000.0
            warning_threshold = 80
        else:
            budget_amount = budget_settings.monthly_budget
            warning_threshold = budget_settings.warning_threshold

        # 計算期間範圍
        today = date.today()
        if period == 'month':
            start_date = date(today.year, today.month, 1)
            budget_for_period = budget_amount
        else:  # year
            start_date = date(today.year, 1, 1)
            budget_for_period = budget_amount * 12

        # 查詢該期間的食材消費
        query = db.query(FoodItem).join(FoodItem.fridge).filter(
            FoodItem.fridge.has(user_id=user_id),
            FoodItem.purchase_date >= start_date,
            FoodItem.purchase_date <= today,
            FoodItem.price.isnot(None)
        )

        food_items = query.all()

        # 計算總消費
        total_spending = sum(item.price for item in food_items if item.price)

        # 計算預算使用百分比
        budget_used_percentage = (total_spending / budget_for_period * 100) if budget_for_period > 0 else 0

        # 檢查是否超過警告門檻
        is_over_threshold = budget_used_percentage >= warning_threshold

        # 分類統計
        category_stats = {}
        for item in food_items:
            category = item.category or '未分類'
            if category not in category_stats:
                category_stats[category] = {'amount': 0.0, 'count': 0}
            category_stats[category]['amount'] += item.price or 0.0
            category_stats[category]['count'] += 1

        category_breakdown = [
            CategorySpending(
                category=cat,
                amount=round(stats['amount'], 2),
                count=stats['count']
            )
            for cat, stats in category_stats.items()
        ]

        # 排序（金額由高到低）
        category_breakdown.sort(key=lambda x: x.amount, reverse=True)

        # 月度趨勢（最近12個月）
        monthly_trend = BudgetService._calculate_monthly_trend(db, user_id)

        return SpendingStatsResponse(
            period=period,
            total_spending=round(total_spending, 2),
            budget=budget_for_period,
            budget_used_percentage=round(budget_used_percentage, 2),
            is_over_threshold=is_over_threshold,
            category_breakdown=category_breakdown,
            monthly_trend=monthly_trend
        )

    @staticmethod
    def _calculate_monthly_trend(
        db: Session,
        user_id: int,
        months: int = 12
    ) -> List[MonthlyTrend]:
        """
        計算月度消費趨勢

        Args:
            db: 資料庫 session
            user_id: 使用者 ID
            months: 統計月數

        Returns:
            List[MonthlyTrend]: 月度趨勢清單
        """
        today = date.today()
        trends = []

        for i in range(months - 1, -1, -1):
            # 計算該月份的起始和結束日期
            target_month = today - relativedelta(months=i)
            start_date = date(target_month.year, target_month.month, 1)

            # 計算該月的最後一天
            if target_month.month == 12:
                end_date = date(target_month.year + 1, 1, 1) - relativedelta(days=1)
            else:
                end_date = date(target_month.year, target_month.month + 1, 1) - relativedelta(days=1)

            # 查詢該月的消費
            monthly_spending = db.query(func.sum(FoodItem.price)).join(FoodItem.fridge).filter(
                FoodItem.fridge.has(user_id=user_id),
                FoodItem.purchase_date >= start_date,
                FoodItem.purchase_date <= end_date,
                FoodItem.price.isnot(None)
            ).scalar() or 0.0

            trends.append(MonthlyTrend(
                month=target_month.strftime('%Y-%m'),
                amount=round(monthly_spending, 2)
            ))

        return trends

    @staticmethod
    def get_shopping_suggestions(
        db: Session,
        user_id: int
    ) -> List[ShoppingSuggestion]:
        """
        生成採買建議

        基於以下條件：
        1. 庫存量低於安全存量的食材
        2. 常用但缺貨的食材（基於歷史記錄）
        3. 即將過期但數量不足的食材類別

        Args:
            db: 資料庫 session
            user_id: 使用者 ID

        Returns:
            List[ShoppingSuggestion]: 採買建議清單
        """
        suggestions = []

        # 獲取使用者的低庫存門檻設定
        notification_settings = db.query(NotificationSettings).filter(
            NotificationSettings.user_id == user_id
        ).first()

        low_stock_threshold = notification_settings.low_stock_threshold if notification_settings else 1

        # 1. 檢查低庫存食材
        low_stock_items = db.query(
            FoodItem.name,
            FoodItem.category,
            func.sum(FoodItem.quantity).label('total_quantity')
        ).join(FoodItem.fridge).filter(
            FoodItem.fridge.has(user_id=user_id)
        ).group_by(FoodItem.name, FoodItem.category).having(
            func.sum(FoodItem.quantity) <= low_stock_threshold
        ).all()

        for item in low_stock_items:
            suggestions.append(ShoppingSuggestion(
                food_name=item.name,
                category=item.category,
                current_quantity=int(item.total_quantity),
                suggested_quantity=max(5, low_stock_threshold * 2),
                reason='庫存量低於安全存量',
                priority='高'
            ))

        # 2. 檢查常用但缺貨的食材（基於歷史記錄）
        # 查詢過去3個月內購買次數超過3次的食材
        three_months_ago = date.today() - relativedelta(months=3)

        frequent_items = db.query(
            FoodItem.name,
            FoodItem.category,
            func.count(FoodItem.id).label('purchase_count')
        ).join(FoodItem.fridge).filter(
            FoodItem.fridge.has(user_id=user_id),
            FoodItem.purchase_date >= three_months_ago
        ).group_by(FoodItem.name, FoodItem.category).having(
            func.count(FoodItem.id) >= 3
        ).all()

        for item in frequent_items:
            # 檢查該食材目前的庫存
            current_stock = db.query(func.sum(FoodItem.quantity)).join(FoodItem.fridge).filter(
                FoodItem.fridge.has(user_id=user_id),
                FoodItem.name == item.name
            ).scalar() or 0

            # 如果庫存為0，建議採購
            if current_stock == 0:
                # 檢查是否已經在建議清單中
                if not any(s.food_name == item.name for s in suggestions):
                    suggestions.append(ShoppingSuggestion(
                        food_name=item.name,
                        category=item.category,
                        current_quantity=0,
                        suggested_quantity=5,
                        reason=f'常用食材缺貨（過去3個月購買 {item.purchase_count} 次）',
                        priority='中'
                    ))

        # 3. 檢查即將過期但數量不足的類別
        # 查詢7天內會過期的食材類別
        seven_days_later = date.today() + relativedelta(days=7)

        expiring_categories = db.query(
            FoodItem.category,
            func.sum(FoodItem.quantity).label('total_quantity')
        ).join(FoodItem.fridge).filter(
            FoodItem.fridge.has(user_id=user_id),
            FoodItem.expiry_date.isnot(None),
            FoodItem.expiry_date <= seven_days_later,
            FoodItem.expiry_date >= date.today(),
            FoodItem.category.isnot(None)
        ).group_by(FoodItem.category).all()

        for cat_item in expiring_categories:
            # 如果該類別總量少於3，建議採購
            if cat_item.total_quantity < 3:
                # 找出該類別最常購買的食材
                most_common_item = db.query(
                    FoodItem.name,
                    func.count(FoodItem.id).label('count')
                ).join(FoodItem.fridge).filter(
                    FoodItem.fridge.has(user_id=user_id),
                    FoodItem.category == cat_item.category
                ).group_by(FoodItem.name).order_by(
                    func.count(FoodItem.id).desc()
                ).first()

                if most_common_item and not any(s.food_name == most_common_item.name for s in suggestions):
                    suggestions.append(ShoppingSuggestion(
                        food_name=most_common_item.name,
                        category=cat_item.category,
                        current_quantity=int(cat_item.total_quantity),
                        suggested_quantity=5,
                        reason=f'{cat_item.category}類食材即將用完',
                        priority='低'
                    ))

        # 排序：優先級（高>中>低）
        priority_order = {'高': 0, '中': 1, '低': 2}
        suggestions.sort(key=lambda x: priority_order.get(x.priority, 3))

        logger.info(f"為使用者 {user_id} 生成 {len(suggestions)} 個採買建議")
        return suggestions

    @staticmethod
    def check_budget_warning(
        db: Session,
        user_id: int
    ) -> Dict[str, Any]:
        """
        檢查預算警告

        Args:
            db: 資料庫 session
            user_id: 使用者 ID

        Returns:
            Dict: 包含 is_warning, budget_used_percentage, threshold 的字典
        """
        # 獲取本月消費統計
        stats = BudgetService.get_spending_stats(db, user_id, period='month')

        return {
            'is_warning': stats.is_over_threshold,
            'budget_used_percentage': stats.budget_used_percentage,
            'threshold': stats.budget_used_percentage,
            'total_spending': stats.total_spending,
            'budget': stats.budget
        }
