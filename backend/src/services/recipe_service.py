"""
RecipeService 服務模組

提供食譜推薦和管理功能，使用 GPT-4 根據現有食材推薦食譜。
"""

import logging
import json
from typing import List, Optional
from sqlalchemy.orm import Session
from openai import OpenAI

from src.config import settings
from src.models.food_item import FoodItem
from src.models.recipe import Recipe
from src.models.user_recipe import UserRecipe
from src.schemas.recipe import RecipeRecommendationResponse

logger = logging.getLogger(__name__)

# 初始化 OpenAI client
client = OpenAI(api_key=settings.OPENAI_API_KEY)


class RecipeService:
    """食譜服務類別"""

    @staticmethod
    def recommend_recipes_by_ingredients(
        db: Session,
        user_id: int,
        item_ids: List[int] = None
    ) -> List[RecipeRecommendationResponse]:
        """
        根據現有食材推薦食譜

        Args:
            db: 資料庫 session
            user_id: 使用者 ID
            item_ids: 食材 ID 清單（如果為空或 None，使用所有食材）

        Returns:
            List[RecipeRecommendationResponse]: 推薦食譜清單

        Raises:
            Exception: AI 推薦失敗時拋出
        """
        try:
            # 查詢食材（只查詢 active 狀態，排除已處理的）
            query = db.query(FoodItem).join(FoodItem.fridge).filter(
                FoodItem.fridge.has(user_id=user_id),
                FoodItem.status == 'active'
            )

            if item_ids:
                query = query.filter(FoodItem.id.in_(item_ids))

            food_items = query.all()

            if not food_items:
                logger.warning(f"使用者 {user_id} 沒有食材可用於推薦")
                return []

            # 整理食材清單
            ingredients_list = [
                f"{item.name}（{item.quantity}{item.unit or '個'}）"
                for item in food_items
            ]
            ingredients_text = "、".join(ingredients_list)

            logger.info(f"使用食材推薦食譜: {ingredients_text}")

            # 建立 GPT-4 prompt
            prompt = f"""
你是一位專業的料理顧問。請根據以下現有食材，推薦 3 個適合的食譜。

現有食材：
{ingredients_text}

請以 JSON 格式返回推薦食譜清單，每個食譜包含以下資訊（使用繁體中文）：

{{
  "recipes": [
    {{
      "name": "食譜名稱",
      "description": "簡短描述（1-2 句話）",
      "ingredients": [
        {{"name": "材料名稱", "amount": "數量"}},
        ...
      ],
      "steps": ["步驟1", "步驟2", ...],
      "cooking_time": 烹飪時間（分鐘，整數）,
      "difficulty": "簡單 或 中等 或 困難",
      "cuisine_type": "料理類型（如：中式、西式、日式、韓式等）",
      "matched_ingredients": ["符合的現有食材1", "符合的現有食材2", ...],
      "missing_ingredients": ["缺少的食材1", "缺少的食材2", ...]
    }},
    ...
  ]
}}

注意事項：
1. 優先推薦能使用最多現有食材的食譜
2. 推薦的食譜應該是實用且容易製作的
3. matched_ingredients 應列出食譜中用到的現有食材名稱
4. missing_ingredients 應列出還需要購買的食材名稱
5. 難度必須是「簡單」、「中等」或「困難」其中之一
6. 只返回 JSON，不要包含其他說明文字
"""

            # 呼叫 GPT API（加入重試邏輯和備用模型）
            models_to_try = ["gpt-4o-mini", "gpt-3.5-turbo"]  # 優先用快速模型
            max_retries = 2
            last_error = None
            content = None

            for model in models_to_try:
                for attempt in range(max_retries):
                    try:
                        logger.info(f"嘗試使用 {model} 推薦食譜 (第 {attempt + 1} 次)")
                        response = client.chat.completions.create(
                            model=model,
                            messages=[
                                {"role": "system", "content": "你是一位專業的料理顧問，擅長根據現有食材推薦食譜。"},
                                {"role": "user", "content": prompt}
                            ],
                            temperature=0.7,
                            max_tokens=2000,
                            timeout=30,  # 30 秒 timeout
                        )
                        content = response.choices[0].message.content.strip()
                        logger.info(f"GPT 回應成功: {content[:100]}...")
                        break  # 成功就跳出重試迴圈
                    except Exception as e:
                        last_error = e
                        logger.warning(f"{model} 第 {attempt + 1} 次呼叫失敗: {e}")
                        continue
                
                if content:
                    break  # 成功就跳出模型迴圈

            if not content:
                raise Exception(f"所有 AI 模型呼叫都失敗: {last_error}")

            # 移除可能的 markdown 代碼區塊標記
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

            # 解析 JSON
            result = json.loads(content)

            if "recipes" not in result:
                raise ValueError("AI 回應缺少 'recipes' 欄位")

            # 轉換為 RecipeRecommendationResponse
            recommendations = []
            for recipe_data in result["recipes"]:
                recommendation = RecipeRecommendationResponse(
                    name=recipe_data["name"],
                    description=recipe_data["description"],
                    ingredients=recipe_data["ingredients"],
                    steps=recipe_data["steps"],
                    cooking_time=recipe_data.get("cooking_time"),
                    difficulty=recipe_data["difficulty"],
                    cuisine_type=recipe_data.get("cuisine_type"),
                    matched_ingredients=recipe_data.get("matched_ingredients", []),
                    missing_ingredients=recipe_data.get("missing_ingredients", []),
                )
                recommendations.append(recommendation)

            logger.info(f"成功推薦 {len(recommendations)} 個食譜")
            return recommendations

        except json.JSONDecodeError as e:
            logger.error(f"AI 回應 JSON 解析失敗: {e}, content: {content}")
            raise Exception("AI 食譜推薦結果格式錯誤") from e

        except Exception as e:
            logger.error(f"食譜推薦失敗: {e}")
            raise Exception(f"食譜推薦失敗: {str(e)}") from e

    @staticmethod
    def get_user_recipes(
        db: Session,
        user_id: int,
        category: Optional[str] = None
    ) -> List[UserRecipe]:
        """
        獲取使用者的食譜

        Args:
            db: 資料庫 session
            user_id: 使用者 ID
            category: 類別篩選（favorites, pro, 常煮）

        Returns:
            List[UserRecipe]: 使用者食譜清單
        """
        query = db.query(UserRecipe).filter(UserRecipe.user_id == user_id)

        if category:
            query = query.filter(UserRecipe.category == category)

        return query.order_by(UserRecipe.created_at.desc()).all()

    @staticmethod
    def add_to_favorites(
        db: Session,
        user_id: int,
        recipe_data: dict,
        category: str = "favorites"
    ) -> UserRecipe:
        """
        新增食譜到使用者收藏

        Args:
            db: 資料庫 session
            user_id: 使用者 ID
            recipe_data: 食譜資料（來自推薦結果）
            category: 分類（favorites, pro, 常煮）

        Returns:
            UserRecipe: 新增的使用者食譜關聯
        """
        # 檢查食譜是否已存在
        existing_recipe = db.query(Recipe).filter(
            Recipe.name == recipe_data["name"]
        ).first()

        if existing_recipe:
            recipe = existing_recipe
        else:
            # 創建新食譜
            recipe = Recipe(
                name=recipe_data["name"],
                description=recipe_data.get("description"),
                ingredients=recipe_data["ingredients"],
                steps=recipe_data["steps"],
                cooking_time=recipe_data.get("cooking_time"),
                difficulty=recipe_data.get("difficulty"),
                cuisine_type=recipe_data.get("cuisine_type"),
                image_url=recipe_data.get("image_url"),
            )
            db.add(recipe)
            db.flush()

        # 檢查是否已收藏
        existing_user_recipe = db.query(UserRecipe).filter(
            UserRecipe.user_id == user_id,
            UserRecipe.recipe_id == recipe.id
        ).first()

        if existing_user_recipe:
            # 更新分類
            existing_user_recipe.category = category
            db.commit()
            db.refresh(existing_user_recipe)
            return existing_user_recipe
        else:
            # 新增收藏
            user_recipe = UserRecipe(
                user_id=user_id,
                recipe_id=recipe.id,
                category=category
            )
            db.add(user_recipe)
            db.commit()
            db.refresh(user_recipe)
            return user_recipe

    @staticmethod
    def delete_user_recipe(
        db: Session,
        user_id: int,
        user_recipe_id: int
    ) -> bool:
        """
        刪除使用者食譜

        Args:
            db: 資料庫 session
            user_id: 使用者 ID
            user_recipe_id: 使用者食譜 ID

        Returns:
            bool: 是否成功刪除
        """
        user_recipe = db.query(UserRecipe).filter(
            UserRecipe.id == user_recipe_id,
            UserRecipe.user_id == user_id
        ).first()

        if not user_recipe:
            return False

        db.delete(user_recipe)
        db.commit()
        return True
