"""
BudgetSettings 模型

儲存使用者的預算設定（月度預算、警告門檻）。
"""

from datetime import datetime
from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from src.database import Base


class BudgetSettings(Base):
    """預算設定模型"""

    __tablename__ = "budget_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    # 預算設定
    monthly_budget = Column(Float, default=10000.0, nullable=False)  # 月度預算金額（台幣）
    warning_threshold = Column(Integer, default=80, nullable=False)  # 警告門檻百分比（0-100）

    # 時間戳記
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # 關聯
    user = relationship("User", backref="budget_settings")

    def __repr__(self):
        return f"<BudgetSettings(user_id={self.user_id}, monthly_budget={self.monthly_budget}, threshold={self.warning_threshold}%)>"
