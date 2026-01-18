"""
Fridge 和 FridgeCompartment Pydantic schemas

包含冰箱和分區相關的請求和回應驗證 schemas。
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


# ==================== FridgeCompartment Schemas ====================


class FridgeCompartmentBase(BaseModel):
    """分區基礎欄位"""

    name: str = Field(..., min_length=1, max_length=100, description="分區名稱（如「冷藏上層」、「冷凍抽屜」）")
    parent_type: str = Field(..., description="父類別：「冷藏」或「冷凍」")
    capacity_liters: Optional[float] = Field(None, ge=0, description="分區容量（公升）")

    @field_validator("parent_type")
    @classmethod
    def validate_parent_type(cls, v: str) -> str:
        """驗證 parent_type 必須是「冷藏」或「冷凍」"""
        if v not in ["冷藏", "冷凍"]:
            raise ValueError("parent_type 必須是「冷藏」或「冷凍」")
        return v


class FridgeCompartmentCreate(FridgeCompartmentBase):
    """新增分區請求"""

    pass


class FridgeCompartmentUpdate(BaseModel):
    """更新分區請求（所有欄位可選）"""

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    parent_type: Optional[str] = None
    capacity_liters: Optional[float] = Field(None, ge=0)

    @field_validator("parent_type")
    @classmethod
    def validate_parent_type(cls, v: Optional[str]) -> Optional[str]:
        """驗證 parent_type 必須是「冷藏」或「冷凍」"""
        if v is not None and v not in ["冷藏", "冷凍"]:
            raise ValueError("parent_type 必須是「冷藏」或「冷凍」")
        return v


class FridgeCompartmentResponse(FridgeCompartmentBase):
    """分區回應"""

    id: int
    fridge_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ==================== Fridge Schemas ====================


class FridgeBase(BaseModel):
    """冰箱基礎欄位"""

    model_name: Optional[str] = Field(None, max_length=255, description="冰箱型號（可選）")
    total_capacity_liters: float = Field(..., gt=0, description="總容量（公升）")


class FridgeCreate(FridgeBase):
    """新增冰箱請求"""

    pass


class FridgeUpdate(BaseModel):
    """更新冰箱請求（所有欄位可選）"""

    model_name: Optional[str] = Field(None, max_length=255)
    total_capacity_liters: Optional[float] = Field(None, gt=0)


class FridgeResponse(FridgeBase):
    """冰箱回應"""

    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    compartment_mode: str = Field(default="simple", description="分區模式：simple 或 detailed")

    model_config = {"from_attributes": True}


class FridgeDetailResponse(FridgeResponse):
    """冰箱詳細資訊回應（含分區）"""

    compartments: list[FridgeCompartmentResponse] = []

    model_config = {"from_attributes": True}
