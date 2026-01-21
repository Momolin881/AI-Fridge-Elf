"""
NotificationSettings 模型

儲存使用者的通知設定（效期提醒、庫存警報、空間提醒）。
"""

from datetime import datetime, time
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Time
from sqlalchemy.orm import relationship

from src.database import Base


class NotificationSettings(Base):
    """通知設定模型"""

    __tablename__ = "notification_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    # 效期提醒設定
    expiry_warning_enabled = Column(Boolean, default=True, nullable=False)
    expiry_warning_days = Column(Integer, default=3, nullable=False)  # 提前幾天提醒（預設 3 天）

    # 庫存提醒設定
    low_stock_enabled = Column(Boolean, default=False, nullable=False)
    low_stock_threshold = Column(Integer, default=1, nullable=False)  # 安全存量門檻（預設 1）

    # 空間提醒設定
    space_warning_enabled = Column(Boolean, default=True, nullable=False)
    space_warning_threshold = Column(Integer, default=80, nullable=False)  # 空間使用率門檻（預設 80%）

    # 預算提醒設定
    budget_warning_enabled = Column(Boolean, default=False, nullable=False)
    budget_warning_amount = Column(Integer, default=5000, nullable=False)  # 月消費上限（預設 5000）

    # 通知時間設定
    notification_time = Column(Time, default=time(9, 0), nullable=False)  # 預設早上 9:00

    # 時間戳記
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # 關聯
    user = relationship("User", backref="notification_settings")

    def __repr__(self):
        return f"<NotificationSettings(user_id={self.user_id}, expiry_days={self.expiry_warning_days})>"
