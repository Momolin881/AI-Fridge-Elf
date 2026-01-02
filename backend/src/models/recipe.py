"""
Recipe 模型

儲存食譜資訊，包含名稱、描述、材料、步驟、烹飪時間等。
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, JSON, DateTime
from sqlalchemy.orm import relationship

from src.database import Base


class Recipe(Base):
    """食譜模型"""

    __tablename__ = "recipes"

    id = Column(Integer, primary_key=True, index=True)

    # 食譜基本資訊
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)

    # 材料和步驟（JSON 格式）
    ingredients = Column(JSON, nullable=False)  # [{"name": "雞胸肉", "amount": "200g"}, ...]
    steps = Column(JSON, nullable=False)  # ["步驟1", "步驟2", ...]

    # 烹飪資訊
    cooking_time = Column(Integer, nullable=True)  # 烹飪時間（分鐘）
    difficulty = Column(String(50), nullable=True)  # 難度：簡單、中等、困難
    cuisine_type = Column(String(100), nullable=True)  # 料理類型：中式、西式、日式等

    # 圖片
    image_url = Column(String(512), nullable=True)

    # 時間戳記
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # 關聯
    user_recipes = relationship("UserRecipe", back_populates="recipe", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Recipe(id={self.id}, name='{self.name}', difficulty='{self.difficulty}')>"
