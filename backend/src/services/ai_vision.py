"""
OpenAI Vision API 服務模組

使用 GPT-4 Vision 辨識食材圖片，返回食材名稱、類別、效期預估等資訊。
"""

import logging
import json
import base64
from datetime import date, timedelta
from typing import Optional

from openai import OpenAI

from src.config import settings

logger = logging.getLogger(__name__)

# 初始化 OpenAI client
client = OpenAI(api_key=settings.OPENAI_API_KEY)


def recognize_food_item(image_bytes: bytes) -> dict:
    """
    使用 OpenAI Vision API 辨識食材圖片

    Args:
        image_bytes: 圖片位元組資料

    Returns:
        包含辨識結果的字典:
        {
            "name": str,              # 食材名稱
            "category": str,          # 食材類別（如「蔬菜」、「肉類」）
            "quantity": int,          # 數量（預設 1）
            "unit": str,              # 單位（如「個」、「包」）
            "expiry_days": int,       # 預估保存天數
        }

    Raises:
        Exception: AI 辨識失敗時拋出

    Examples:
        >>> image_bytes = open("apple.jpg", "rb").read()
        >>> result = recognize_food_item(image_bytes)
        >>> print(result)
        {
            "name": "蘋果",
            "category": "水果",
            "quantity": 3,
            "unit": "個",
            "expiry_days": 14
        }
    """
    try:
        # 將圖片轉為 base64
        base64_image = base64.b64encode(image_bytes).decode("utf-8")

        # 建立 prompt
        prompt = """
請辨識圖片中的食材，並以 JSON 格式返回以下資訊（使用繁體中文）：

{
  "name": "食材名稱（如：蘋果、雞胸肉、牛奶）",
  "category": "食材類別（如：水果、肉類、乳製品、蔬菜、海鮮、調味料、飲料、其他）",
  "quantity": 數量（整數，如果無法判斷則為 1）,
  "unit": "單位（如：個、包、瓶、公斤、片，如果無法判斷可為 null）",
  "expiry_days": 預估保存天數（整數，考慮一般冷藏或冷凍保存）
}

注意事項：
1. 如果圖片中有多個相同食材，quantity 應為總數
2. expiry_days 應根據食材特性和常見保存方式估算（例如：新鮮蔬菜 3-7 天、肉類 2-3 天、冷凍肉類 30-90 天）
3. 只返回 JSON，不要包含其他說明文字
4. 如果無法辨識食材，name 設為「未知食材」，category 設為「其他」，expiry_days 設為 7
"""

        # 呼叫 OpenAI Vision API
        response = client.chat.completions.create(
            model=settings.AI_VISION_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}",
                                "detail": "auto",
                            },
                        },
                    ],
                }
            ],
            max_tokens=settings.AI_VISION_MAX_TOKENS,
            temperature=settings.AI_VISION_TEMPERATURE,
        )

        # 解析回應
        content = response.choices[0].message.content.strip()
        logger.info(f"OpenAI Vision API 回應: {content}")

        # 解析 JSON（移除可能的 markdown 代碼區塊標記）
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

        result = json.loads(content)

        # 驗證必要欄位
        required_fields = ["name", "category", "quantity", "expiry_days"]
        for field in required_fields:
            if field not in result:
                raise ValueError(f"AI 回應缺少必要欄位: {field}")

        logger.info(f"食材辨識成功: {result['name']}")
        return result

    except json.JSONDecodeError as e:
        logger.error(f"AI 回應 JSON 解析失敗: {e}, content: {content}")
        raise Exception("AI 辨識結果格式錯誤") from e

    except Exception as e:
        logger.error(f"AI 辨識失敗: {e}")
        raise Exception(f"AI 辨識失敗: {str(e)}") from e


def calculate_expiry_date(expiry_days: int, purchase_date: Optional[date] = None) -> date:
    """
    根據預估保存天數計算效期

    Args:
        expiry_days: 預估保存天數
        purchase_date: 購買日期（預設為今天）

    Returns:
        date: 效期日期

    Examples:
        >>> calculate_expiry_date(7)
        datetime.date(2026, 1, 9)  # 假設今天是 2026-01-02
    """
    if purchase_date is None:
        purchase_date = date.today()

    return purchase_date + timedelta(days=expiry_days)
