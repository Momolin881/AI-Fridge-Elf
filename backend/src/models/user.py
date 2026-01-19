"""
User 模型

儲存 LINE 使用者基本資訊和設定。
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.orm import relationship

from src.database import Base


class User(Base):
    """使用者模型"""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    line_user_id = Column(String(255), unique=True, nullable=False, index=True)
    display_name = Column(String(255), nullable=False)
    picture_url = Column(String(512), nullable=True)

    # 使用者設定
    storage_mode = Column(String(20), default="simple", nullable=False)  # "simple" or "detailed"

    # 時間戳記
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # 關聯
    fridges = relationship("Fridge", back_populates="owner", cascade="all, delete-orphan")
    fridge_memberships = relationship("FridgeMember", foreign_keys="FridgeMember.user_id", back_populates="user")

    def __repr__(self):
        return f"<User(id={self.id}, line_user_id='{self.line_user_id}', display_name='{self.display_name}')>"
