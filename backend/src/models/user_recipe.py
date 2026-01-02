"""
UserRecipe 模型

儲存使用者與食譜的關聯，支援收藏和分類功能。
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from src.database import Base


class UserRecipe(Base):
    """使用者食譜關聯模型"""

    __tablename__ = "user_recipes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False, index=True)

    # 分類：favorites（收藏）、pro（黑白大廚 Pro）、常煮
    category = Column(String(50), nullable=False, default="favorites", index=True)

    # 時間戳記
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # 關聯
    user = relationship("User", backref="user_recipes")
    recipe = relationship("Recipe", back_populates="user_recipes")

    # 確保每個使用者對同一食譜只能有一個分類
    __table_args__ = (
        UniqueConstraint('user_id', 'recipe_id', name='uq_user_recipe'),
    )

    def __repr__(self):
        return f"<UserRecipe(user_id={self.user_id}, recipe_id={self.recipe_id}, category='{self.category}')>"
