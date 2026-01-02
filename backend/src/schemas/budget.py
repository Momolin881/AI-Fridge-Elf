"""
預算控管 Pydantic Schemas

提供預算設定、消費統計、採買建議的請求和回應驗證。
"""

from typing import List, Dict, Any
from pydantic import BaseModel, Field, field_validator


class BudgetSettingsResponse(BaseModel):
    """預算設定回應 Schema"""

    id: int = Field(..., description="設定 ID")
    user_id: int = Field(..., description="使用者 ID")
    monthly_budget: float = Field(..., ge=0, description="月度預算金額（台幣）")
    warning_threshold: int = Field(..., ge=0, le=100, description="警告門檻百分比（0-100%）")

    @field_validator('monthly_budget')
    @classmethod
    def validate_budget(cls, v):
        """驗證預算金額"""
        if v < 0:
            raise ValueError('預算不能為負數')
        return v

    @field_validator('warning_threshold')
    @classmethod
    def validate_threshold(cls, v):
        """驗證警告門檻"""
        if not 0 <= v <= 100:
            raise ValueError('警告門檻必須在 0-100 之間')
        return v

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": 1,
                "user_id": 1,
                "monthly_budget": 10000.0,
                "warning_threshold": 80
            }
        }
    }


class BudgetSettingsUpdate(BaseModel):
    """預算設定更新 Schema（部分更新）"""

    monthly_budget: float | None = Field(None, ge=0, description="月度預算金額（台幣）")
    warning_threshold: int | None = Field(None, ge=0, le=100, description="警告門檻百分比（0-100%）")

    @field_validator('monthly_budget')
    @classmethod
    def validate_budget(cls, v):
        """驗證預算金額"""
        if v is not None and v < 0:
            raise ValueError('預算不能為負數')
        return v

    @field_validator('warning_threshold')
    @classmethod
    def validate_threshold(cls, v):
        """驗證警告門檻"""
        if v is not None and not 0 <= v <= 100:
            raise ValueError('警告門檻必須在 0-100 之間')
        return v

    model_config = {
        "json_schema_extra": {
            "example": {
                "monthly_budget": 15000.0,
                "warning_threshold": 75
            }
        }
    }


class CategorySpending(BaseModel):
    """分類消費統計"""

    category: str = Field(..., description="食材類別")
    amount: float = Field(..., description="消費金額")
    count: int = Field(..., description="食材數量")


class MonthlyTrend(BaseModel):
    """月度趨勢數據"""

    month: str = Field(..., description="月份（YYYY-MM 格式）")
    amount: float = Field(..., description="消費金額")


class SpendingStatsResponse(BaseModel):
    """消費統計回應 Schema"""

    period: str = Field(..., description="統計期間（month 或 year）")
    total_spending: float = Field(..., description="總消費金額")
    budget: float = Field(..., description="預算金額")
    budget_used_percentage: float = Field(..., description="預算使用百分比")
    is_over_threshold: bool = Field(..., description="是否超過警告門檻")
    category_breakdown: List[CategorySpending] = Field(default=[], description="分類統計")
    monthly_trend: List[MonthlyTrend] = Field(default=[], description="月度趨勢（最近12個月）")

    model_config = {
        "json_schema_extra": {
            "example": {
                "period": "month",
                "total_spending": 8500.0,
                "budget": 10000.0,
                "budget_used_percentage": 85.0,
                "is_over_threshold": True,
                "category_breakdown": [
                    {"category": "蔬菜", "amount": 2000.0, "count": 15},
                    {"category": "肉類", "amount": 3500.0, "count": 8}
                ],
                "monthly_trend": [
                    {"month": "2025-12", "amount": 8500.0},
                    {"month": "2025-11", "amount": 7200.0}
                ]
            }
        }
    }


class ShoppingSuggestion(BaseModel):
    """採買建議 Schema"""

    food_name: str = Field(..., description="食材名稱")
    category: str | None = Field(None, description="食材類別")
    current_quantity: int = Field(..., description="目前庫存數量")
    suggested_quantity: int = Field(..., description="建議採購數量")
    reason: str = Field(..., description="建議原因")
    priority: str = Field(..., description="優先級（高、中、低）")

    @field_validator('priority')
    @classmethod
    def validate_priority(cls, v):
        """驗證優先級"""
        allowed_priorities = ['高', '中', '低']
        if v not in allowed_priorities:
            raise ValueError(f'優先級必須是 {allowed_priorities} 之一')
        return v

    model_config = {
        "json_schema_extra": {
            "example": {
                "food_name": "雞蛋",
                "category": "蛋奶",
                "current_quantity": 2,
                "suggested_quantity": 12,
                "reason": "庫存量低於安全存量",
                "priority": "高"
            }
        }
    }
