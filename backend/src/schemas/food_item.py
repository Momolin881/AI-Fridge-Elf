"""
FoodItem Pydantic schemas

包含食材相關的請求和回應驗證 schemas。
"""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class FoodItemBase(BaseModel):
    """食材基礎欄位"""

    name: str = Field(..., min_length=1, max_length=255, description="食材名稱")
    category: Optional[str] = Field(None, max_length=100, description="食材類別（如「蔬菜」、「肉類」）")
    quantity: int = Field(1, ge=1, description="數量")
    unit: Optional[str] = Field(None, max_length=50, description="單位（如「個」、「包」、「公斤」）")
    expiry_date: Optional[date] = Field(None, description="效期（YYYY-MM-DD）")
    purchase_date: date = Field(default_factory=date.today, description="購買日期（YYYY-MM-DD）")
    price: Optional[float] = Field(None, ge=0, description="價格（台幣）")
    volume_liters: Optional[float] = Field(None, ge=0, description="體積（公升）")
    storage_type: str = Field(..., description="儲存類型：「冷藏」或「冷凍」")

    @field_validator("storage_type")
    @classmethod
    def validate_storage_type(cls, v: str) -> str:
        """驗證 storage_type 必須是「冷藏」或「冷凍」"""
        if v not in ["冷藏", "冷凍"]:
            raise ValueError("storage_type 必須是「冷藏」或「冷凍」")
        return v


class FoodItemCreate(FoodItemBase):
    """新增食材請求"""

    fridge_id: int = Field(..., description="冰箱 ID")
    compartment_id: Optional[int] = Field(None, description="分區 ID（細分模式使用）")
    image_url: Optional[str] = Field(None, max_length=512, description="圖片 URL（AI 辨識使用）")
    cloudinary_public_id: Optional[str] = Field(None, max_length=255, description="Cloudinary public_id")
    recognized_by_ai: int = Field(0, description="是否由 AI 辨識（0: 手動, 1: AI）")


class FoodItemUpdate(BaseModel):
    """更新食材請求（所有欄位可選）"""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    category: Optional[str] = Field(None, max_length=100)
    quantity: Optional[int] = Field(None, ge=1)
    unit: Optional[str] = Field(None, max_length=50)
    expiry_date: Optional[date] = None
    purchase_date: Optional[date] = None
    price: Optional[float] = Field(None, ge=0)
    volume_liters: Optional[float] = Field(None, ge=0)
    storage_type: Optional[str] = None
    compartment_id: Optional[int] = None

    @field_validator("storage_type")
    @classmethod
    def validate_storage_type(cls, v: Optional[str]) -> Optional[str]:
        """驗證 storage_type 必須是「冷藏」或「冷凍」"""
        if v is not None and v not in ["冷藏", "冷凍"]:
            raise ValueError("storage_type 必須是「冷藏」或「冷凍」")
        return v


class FoodItemResponse(FoodItemBase):
    """食材回應"""

    id: int
    fridge_id: int
    compartment_id: Optional[int] = None
    compartment: Optional[str] = None  # 分區名稱（供前端顯示）
    image_url: Optional[str] = None
    cloudinary_public_id: Optional[str] = None
    recognized_by_ai: int
    created_at: datetime
    updated_at: datetime

    # 狀態（封存/已處理）
    status: str = 'active'  # active / archived
    archived_at: Optional[datetime] = None
    archived_by: Optional[int] = None

    # 計算屬性（由後端填入）
    is_expired: bool = False
    days_until_expiry: Optional[int] = None

    model_config = {"from_attributes": True}


class FoodItemArchive(BaseModel):
    """封存食材請求"""

    # 目前不需要額外參數，未來可擴展 reason 欄位
    pass


class AIRecognitionRequest(BaseModel):
    """AI 辨識請求（multipart/form-data）"""

    fridge_id: int
    compartment_id: Optional[int] = None
    storage_type: str  # 「冷藏」或「冷凍」


class AIRecognitionResponse(BaseModel):
    """AI 辨識回應"""

    name: str
    category: Optional[str] = None
    quantity: int = 1
    unit: Optional[str] = None
    expiry_date: Optional[date] = None
    storage_type: str
    image_url: str
    cloudinary_public_id: str
    confidence: str = "辨識完成，請確認資訊是否正確"
