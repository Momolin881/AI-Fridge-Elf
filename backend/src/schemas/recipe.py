"""
Recipe Pydantic schemas

包含食譜相關的請求和回應驗證 schemas。
"""

from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field, field_validator, ConfigDict


class RecipeBase(BaseModel):
    """食譜基礎欄位"""

    name: str = Field(..., min_length=1, max_length=200, description="食譜名稱")
    description: Optional[str] = Field(None, description="食譜描述")
    ingredients: List[dict] = Field(..., description="材料清單，格式: [{'name': '雞胸肉', 'amount': '200g'}, ...]")
    steps: List[str] = Field(..., description="烹飪步驟清單")
    cooking_time: Optional[int] = Field(None, ge=0, description="烹飪時間（分鐘）")
    difficulty: Optional[str] = Field(None, description="難度：簡單、中等、困難")
    cuisine_type: Optional[str] = Field(None, max_length=100, description="料理類型：中式、西式、日式等")
    image_url: Optional[str] = Field(None, max_length=512, description="食譜圖片 URL")

    @field_validator("difficulty")
    @classmethod
    def validate_difficulty(cls, v: Optional[str]) -> Optional[str]:
        """驗證難度必須是「簡單」、「中等」或「困難」"""
        if v is not None and v not in ["簡單", "中等", "困難"]:
            raise ValueError("difficulty 必須是「簡單」、「中等」或「困難」")
        return v

    @field_validator("ingredients")
    @classmethod
    def validate_ingredients(cls, v: List[dict]) -> List[dict]:
        """驗證材料清單格式"""
        if not v:
            raise ValueError("ingredients 不能為空")
        for ingredient in v:
            if not isinstance(ingredient, dict):
                raise ValueError("每個 ingredient 必須是字典格式")
            if "name" not in ingredient:
                raise ValueError("每個 ingredient 必須包含 'name' 欄位")
        return v

    @field_validator("steps")
    @classmethod
    def validate_steps(cls, v: List[str]) -> List[str]:
        """驗證步驟清單不能為空"""
        if not v:
            raise ValueError("steps 不能為空")
        return v


class RecipeCreate(RecipeBase):
    """新增食譜請求"""
    pass


class RecipeResponse(RecipeBase):
    """食譜回應"""

    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserRecipeCreate(BaseModel):
    """新增使用者食譜請求"""

    recipe_id: int = Field(..., description="食譜 ID")
    category: str = Field("favorites", description="分類：favorites（收藏）、pro（黑白大廚 Pro）、常煮")

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        """驗證分類必須是 favorites、pro 或 常煮"""
        if v not in ["favorites", "pro", "常煮"]:
            raise ValueError("category 必須是「favorites」、「pro」或「常煮」")
        return v


class UserRecipeResponse(BaseModel):
    """使用者食譜回應"""

    id: int
    user_id: int
    recipe_id: int
    category: str
    created_at: datetime
    recipe: RecipeResponse

    model_config = ConfigDict(from_attributes=True)


class RecipeRecommendationRequest(BaseModel):
    """食譜推薦請求"""

    item_ids: List[int] = Field(default_factory=list, description="食材 ID 清單（空陣列表示使用所有食材）")


class RecipeRecommendationResponse(BaseModel):
    """食譜推薦回應（單個食譜）"""

    name: str = Field(..., description="食譜名稱")
    description: str = Field(..., description="食譜描述")
    ingredients: List[dict] = Field(..., description="材料清單")
    steps: List[str] = Field(..., description="烹飪步驟")
    cooking_time: Optional[int] = Field(None, description="烹飪時間（分鐘）")
    difficulty: str = Field(..., description="難度")
    cuisine_type: Optional[str] = Field(None, description="料理類型")
    matched_ingredients: List[str] = Field(default_factory=list, description="符合的現有食材")
    missing_ingredients: List[str] = Field(default_factory=list, description="缺少的食材")
