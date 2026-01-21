"""
食譜 API 路由

提供食譜推薦和管理相關的 API 端點。
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException, status, Query
from sqlalchemy.orm import Session

from src.models.user import User
from src.routes.dependencies import DBSession, CurrentUserId
from src.schemas.recipe import (
    RecipeRecommendationRequest,
    RecipeRecommendationResponse,
    UserRecipeCreate,
    UserRecipeResponse,
)
from src.services.recipe_service import RecipeService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/recipes", tags=["recipes"])


@router.post(
    "/recommendations",
    response_model=List[RecipeRecommendationResponse],
    summary="根據食材推薦食譜",
    description="使用 GPT-4 根據使用者現有食材推薦適合的食譜"
)
async def get_recipe_recommendations(
    request: RecipeRecommendationRequest,
    db: DBSession,
    user_id: CurrentUserId,
):
    """
    根據現有食材推薦食譜

    - **item_ids**: 食材 ID 清單（可選，空陣列表示使用所有食材）

    Returns:
        推薦食譜清單，每個食譜包含：
        - name: 食譜名稱
        - description: 描述
        - ingredients: 材料清單
        - steps: 烹飪步驟
        - cooking_time: 烹飪時間（分鐘）
        - difficulty: 難度
        - cuisine_type: 料理類型
        - matched_ingredients: 符合的現有食材
        - missing_ingredients: 缺少的食材
    """
    try:
        # 查詢使用者
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="使用者不存在"
            )

        # 呼叫服務層推薦食譜
        recommendations = RecipeService.recommend_recipes_by_ingredients(
            db=db,
            user_id=user_id,
            item_ids=request.item_ids if request.item_ids else None
        )

        # 記錄回傳結果
        logger.info(f"使用者 {user_id} 食譜推薦成功，回傳 {len(recommendations)} 個食譜")
        for i, rec in enumerate(recommendations):
            logger.info(f"  食譜 {i+1}: {rec.name}")

        return recommendations

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"食譜推薦失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"食譜推薦失敗: {str(e)}"
        )


@router.get(
    "",
    response_model=List[UserRecipeResponse],
    summary="獲取使用者食譜",
    description="獲取使用者收藏的食譜，支援按分類篩選"
)
async def get_user_recipes(
    db: DBSession,
    user_id: CurrentUserId,
    category: Optional[str] = Query(None, description="類別篩選：favorites, pro, 常煮")
):
    """
    獲取使用者食譜

    - **category**: 分類篩選（可選）
      - favorites: 收藏的食譜
      - pro: 黑白大廚 Pro
      - 常煮: 常煮的食譜

    Returns:
        使用者食譜清單
    """
    try:
        # 查詢使用者
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="使用者不存在"
            )

        # 獲取使用者食譜
        user_recipes = RecipeService.get_user_recipes(
            db=db,
            user_id=user_id,
            category=category
        )

        return user_recipes

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"獲取使用者食譜失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"獲取使用者食譜失敗: {str(e)}"
        )


@router.post(
    "",
    response_model=UserRecipeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="新增食譜到收藏",
    description="將推薦的食譜新增到使用者收藏"
)
async def create_user_recipe(
    recipe_data: dict,
    db: DBSession,
    user_id: CurrentUserId,
    category: str = Query("favorites", description="分類：favorites, pro, 常煮")
):
    """
    新增食譜到使用者收藏

    - **recipe_data**: 食譜資料（來自推薦結果的完整物件）
    - **category**: 分類（預設為 favorites）

    Returns:
        新增的使用者食譜關聯
    """
    try:
        # 查詢使用者
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="使用者不存在"
            )

        # 驗證分類
        if category not in ["favorites", "pro", "常煮"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="分類必須是 favorites、pro 或 常煮"
            )

        # 新增到收藏
        user_recipe = RecipeService.add_to_favorites(
            db=db,
            user_id=user_id,
            recipe_data=recipe_data,
            category=category
        )

        return user_recipe

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"新增使用者食譜失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"新增使用者食譜失敗: {str(e)}"
        )


@router.delete(
    "/{user_recipe_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="刪除使用者食譜",
    description="從收藏中刪除食譜"
)
async def delete_user_recipe(
    user_recipe_id: int,
    db: DBSession,
    user_id: CurrentUserId,
):
    """
    刪除使用者食譜

    - **user_recipe_id**: 使用者食譜 ID

    Returns:
        204 No Content（成功刪除）
    """
    try:
        # 查詢使用者
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="使用者不存在"
            )

        # 刪除使用者食譜
        success = RecipeService.delete_user_recipe(
            db=db,
            user_id=user_id,
            user_recipe_id=user_recipe_id
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="食譜不存在或無權限刪除"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"刪除使用者食譜失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"刪除使用者食譜失敗: {str(e)}"
        )
