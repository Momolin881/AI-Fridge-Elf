"""
FoodItem 模型

儲存食材資訊，包含名稱、數量、效期、價格、圖片等。
"""

from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from src.database import Base


class FoodItem(Base):
    """食材模型"""

    __tablename__ = "food_items"

    id = Column(Integer, primary_key=True, index=True)
    fridge_id = Column(Integer, ForeignKey("fridges.id", ondelete="CASCADE"), nullable=False, index=True)
    compartment_id = Column(
        Integer,
        ForeignKey("fridge_compartments.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )  # nullable: 簡單模式不使用，細分模式必填

    # 食材基本資訊
    name = Column(String(255), nullable=False, index=True)
    category = Column(String(100), nullable=True)  # 食材類別（如「蔬菜」、「肉類」）
    quantity = Column(Integer, default=1, nullable=False)  # 數量
    unit = Column(String(50), nullable=True)  # 單位（如「個」、「包」、「公斤」）

    # 效期和價格
    expiry_date = Column(Date, nullable=True, index=True)  # 效期
    purchase_date = Column(Date, default=date.today, nullable=False)  # 購買日期
    price = Column(Float, nullable=True)  # 價格（台幣）

    # 體積和儲存
    volume_liters = Column(Float, nullable=True)  # 體積（公升）
    storage_type = Column(String(50), nullable=False)  # 「冷藏」或「冷凍」（簡單模式使用）

    # 圖片
    image_url = Column(String(512), nullable=True)  # Cloudinary URL
    cloudinary_public_id = Column(String(255), nullable=True)  # Cloudinary public_id（用於刪除）

    # AI 辨識相關
    recognized_by_ai = Column(Integer, default=0, nullable=False)  # 是否由 AI 辨識（0: 手動, 1: AI）

    # 狀態（用於封存/已處理功能）
    status = Column(String(20), default='active', nullable=False, index=True)  # active / archived
    archived_at = Column(DateTime, nullable=True)  # 封存時間
    archived_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)  # 封存者

    # 時間戳記
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # 關聯
    fridge = relationship("Fridge", back_populates="food_items")
    compartment = relationship("FridgeCompartment", back_populates="food_items")

    def __repr__(self):
        return f"<FoodItem(id={self.id}, name='{self.name}', quantity={self.quantity}, expiry={self.expiry_date})>"

    @property
    def is_expired(self) -> bool:
        """檢查是否已過期"""
        if not self.expiry_date:
            return False
        return self.expiry_date < date.today()

    @property
    def days_until_expiry(self) -> int | None:
        """計算距離過期還有幾天"""
        if not self.expiry_date:
            return None
        delta = self.expiry_date - date.today()
        return delta.days
