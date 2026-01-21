"""
通知設定 Pydantic Schemas

提供通知設定的請求和回應驗證。
"""

from datetime import time
from pydantic import BaseModel, Field, field_validator


class NotificationSettingsResponse(BaseModel):
    """通知設定回應 Schema"""

    id: int = Field(..., description="設定 ID")
    user_id: int = Field(..., description="使用者 ID")

    # 效期提醒設定
    expiry_warning_enabled: bool = Field(default=True, description="是否啟用效期提醒")
    expiry_warning_days: int = Field(default=3, ge=1, le=30, description="提前幾天提醒（1-30 天）")

    # 庫存提醒設定
    low_stock_enabled: bool = Field(default=False, description="是否啟用庫存提醒")
    low_stock_threshold: int = Field(default=1, ge=0, description="安全存量門檻")

    # 空間提醒設定
    space_warning_enabled: bool = Field(default=True, description="是否啟用空間提醒")
    space_warning_threshold: int = Field(default=80, ge=50, le=100, description="空間使用率門檻（50-100%）")

    # 預算提醒設定
    budget_warning_enabled: bool = Field(default=False, description="是否啟用預算提醒")
    budget_warning_amount: int = Field(default=5000, ge=0, description="月消費上限")

    # 通知時間設定
    notification_time: str = Field(default="09:00", description="通知時間（HH:MM 格式）")

    @field_validator("notification_time", mode="before")
    @classmethod
    def validate_notification_time(cls, v):
        """驗證並轉換通知時間格式"""
        if isinstance(v, time):
            return v.strftime("%H:%M")
        if isinstance(v, str):
            # 驗證格式 HH:MM
            try:
                time_obj = time.fromisoformat(v)
                return time_obj.strftime("%H:%M")
            except ValueError:
                raise ValueError("notification_time 必須是 HH:MM 格式")
        raise ValueError("notification_time 必須是字串或 time 物件")

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": 1,
                "user_id": 1,
                "expiry_warning_enabled": True,
                "expiry_warning_days": 3,
                "low_stock_enabled": False,
                "low_stock_threshold": 1,
                "space_warning_enabled": True,
                "space_warning_threshold": 80,
                "budget_warning_enabled": False,
                "budget_warning_amount": 5000,
                "notification_time": "09:00"
            }
        }
    }


class NotificationSettingsUpdate(BaseModel):
    """通知設定更新 Schema（部分更新）"""

    # 效期提醒設定
    expiry_warning_enabled: bool | None = Field(None, description="是否啟用效期提醒")
    expiry_warning_days: int | None = Field(None, ge=1, le=30, description="提前幾天提醒（1-30 天）")

    # 庫存提醒設定
    low_stock_enabled: bool | None = Field(None, description="是否啟用庫存提醒")
    low_stock_threshold: int | None = Field(None, ge=0, description="安全存量門檻")

    # 空間提醒設定
    space_warning_enabled: bool | None = Field(None, description="是否啟用空間提醒")
    space_warning_threshold: int | None = Field(None, ge=50, le=100, description="空間使用率門檻（50-100%）")

    # 預算提醒設定
    budget_warning_enabled: bool | None = Field(None, description="是否啟用預算提醒")
    budget_warning_amount: int | None = Field(None, ge=0, description="月消費上限")

    # 通知時間設定
    notification_time: str | None = Field(None, description="通知時間（HH:MM 格式）")

    @field_validator("notification_time")
    @classmethod
    def validate_notification_time(cls, v):
        """驗證通知時間格式"""
        if v is None:
            return v
        # 驗證格式 HH:MM
        try:
            time.fromisoformat(v)
            return v
        except ValueError:
            raise ValueError("notification_time 必須是 HH:MM 格式（例如：09:00）")

    model_config = {
        "json_schema_extra": {
            "example": {
                "expiry_warning_enabled": True,
                "expiry_warning_days": 5,
                "space_warning_threshold": 75,
                "notification_time": "10:30"
            }
        }
    }
