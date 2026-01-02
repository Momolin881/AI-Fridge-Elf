"""
Pydantic schemas 模組

包含所有 API 請求和回應的資料驗證 schemas。
"""

from src.schemas.food_item import (
    FoodItemCreate,
    FoodItemUpdate,
    FoodItemResponse,
    AIRecognitionRequest,
    AIRecognitionResponse,
)
from src.schemas.fridge import (
    FridgeCreate,
    FridgeUpdate,
    FridgeResponse,
    FridgeDetailResponse,
    FridgeCompartmentCreate,
    FridgeCompartmentUpdate,
    FridgeCompartmentResponse,
)
from src.schemas.notification import (
    NotificationSettingsResponse,
    NotificationSettingsUpdate,
)
from src.schemas.budget import (
    BudgetSettingsResponse,
    BudgetSettingsUpdate,
    SpendingStatsResponse,
    ShoppingSuggestion,
    CategorySpending,
    MonthlyTrend,
)
from src.schemas.recipe import (
    RecipeCreate,
    RecipeResponse,
    UserRecipeCreate,
    UserRecipeResponse,
    RecipeRecommendationRequest,
    RecipeRecommendationResponse,
)

__all__ = [
    "FoodItemCreate",
    "FoodItemUpdate",
    "FoodItemResponse",
    "AIRecognitionRequest",
    "AIRecognitionResponse",
    "FridgeCreate",
    "FridgeUpdate",
    "FridgeResponse",
    "FridgeDetailResponse",
    "FridgeCompartmentCreate",
    "FridgeCompartmentUpdate",
    "FridgeCompartmentResponse",
    "NotificationSettingsResponse",
    "NotificationSettingsUpdate",
    "BudgetSettingsResponse",
    "BudgetSettingsUpdate",
    "SpendingStatsResponse",
    "ShoppingSuggestion",
    "CategorySpending",
    "MonthlyTrend",
    "RecipeCreate",
    "RecipeResponse",
    "UserRecipeCreate",
    "UserRecipeResponse",
    "RecipeRecommendationRequest",
    "RecipeRecommendationResponse",
]
