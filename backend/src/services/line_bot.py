"""
LINE Bot 服務模組

提供 LINE Bot 訊息發送功能，包含文字訊息和 Flex Message。
"""

import logging
from typing import Optional

from linebot import LineBotApi
from linebot.exceptions import LineBotApiError
from linebot.models import TextSendMessage, FlexSendMessage

from src.config import settings

logger = logging.getLogger(__name__)

# 初始化 LINE Bot API 客戶端
line_bot_api = LineBotApi(settings.LINE_CHANNEL_ACCESS_TOKEN)


def send_text_message(user_id: str, text: str) -> bool:
    """
    發送文字訊息給指定使用者

    Args:
        user_id: LINE User ID
        text: 要發送的文字訊息

    Returns:
        bool: 發送成功返回 True，失敗返回 False

    Examples:
        >>> success = send_text_message("U1234567890abcdef", "您好！")
        >>> print(success)
        True
    """
    try:
        line_bot_api.push_message(
            user_id,
            TextSendMessage(text=text)
        )
        logger.info(f"文字訊息發送成功: user_id={user_id}")
        return True

    except LineBotApiError as e:
        logger.error(f"LINE Bot API 錯誤: {e.status_code} - {e.error.message}")
        return False

    except Exception as e:
        logger.error(f"發送文字訊息失敗: {e}")
        return False


def send_flex_message(user_id: str, alt_text: str, contents: dict) -> bool:
    """
    發送 Flex Message 給指定使用者

    Args:
        user_id: LINE User ID
        alt_text: 替代文字（在通知中顯示）
        contents: Flex Message 內容（JSON 格式）

    Returns:
        bool: 發送成功返回 True，失敗返回 False

    Examples:
        >>> contents = {
        ...     "type": "bubble",
        ...     "body": {
        ...         "type": "box",
        ...         "layout": "vertical",
        ...         "contents": [
        ...             {"type": "text", "text": "效期提醒", "weight": "bold"}
        ...         ]
        ...     }
        ... }
        >>> success = send_flex_message("U1234567890abcdef", "效期提醒", contents)
        >>> print(success)
        True
    """
    try:
        line_bot_api.push_message(
            user_id,
            FlexSendMessage(alt_text=alt_text, contents=contents)
        )
        logger.info(f"Flex Message 發送成功: user_id={user_id}, alt_text={alt_text}")
        return True

    except LineBotApiError as e:
        logger.error(f"LINE Bot API 錯誤: {e.status_code} - {e.error.message}")
        return False

    except Exception as e:
        logger.error(f"發送 Flex Message 失敗: {e}")
        return False


def send_expiry_notification(user_id: str, items: list[dict]) -> bool:
    """
    發送效期提醒通知

    Args:
        user_id: LINE User ID
        items: 即將過期的食材清單，每個 item 包含 name, expiry_date, days_remaining

    Returns:
        bool: 發送成功返回 True，失敗返回 False

    Examples:
        >>> items = [
        ...     {"name": "牛奶", "expiry_date": "2026-01-05", "days_remaining": 2},
        ...     {"name": "蘋果", "expiry_date": "2026-01-04", "days_remaining": 1}
        ... ]
        >>> success = send_expiry_notification("U1234567890abcdef", items)
    """
    if not items:
        logger.warning("沒有即將過期的食材，不發送通知")
        return False

    # 建立 Flex Message 內容
    item_contents = []
    for item in items[:5]:  # 最多顯示 5 個
        days = item.get("days_remaining", 0)
        
        # 根據天數決定顯示文字和顏色
        if days < 0:
            days_text = f"已過期 {abs(days)} 天"
            color = "#ff0000"  # 紅色
        elif days == 0:
            days_text = "今天到期"
            color = "#ff0000"  # 紅色
        else:
            days_text = f"{days} 天後到期"
            color = "#ff9900"  # 橙色

        item_contents.append({
            "type": "box",
            "layout": "horizontal",
            "contents": [
                {
                    "type": "text",
                    "text": item["name"],
                    "size": "sm",
                    "color": "#555555",
                    "flex": 2
                },
                {
                    "type": "text",
                    "text": days_text,
                    "size": "sm",
                    "color": color,
                    "align": "end",
                    "flex": 1
                }
            ],
            "margin": "md"
        })

    contents = {
        "type": "bubble",
        "body": {
            "type": "box",
            "layout": "vertical",
            "contents": [
                {
                    "type": "text",
                    "text": "⏰ 效期提醒",
                    "weight": "bold",
                    "size": "lg",
                    "color": "#1DB446"
                },
                {
                    "type": "text",
                    "text": f"您有 {len(items)} 項食材需要注意",
                    "size": "sm",
                    "color": "#999999",
                    "margin": "md"
                },
                {
                    "type": "separator",
                    "margin": "lg"
                },
                {
                    "type": "box",
                    "layout": "vertical",
                    "contents": item_contents,
                    "margin": "lg"
                }
            ]
        },
        "footer": {
            "type": "box",
            "layout": "vertical",
            "contents": [
                {
                    "type": "button",
                    "action": {
                        "type": "uri",
                        "label": "查看冰箱",
                        "uri": f"https://liff.line.me/{settings.LIFF_ID}"
                    },
                    "style": "primary",
                    "color": "#1DB446"
                }
            ]
        }
    }

    return send_flex_message(user_id, f"⏰ 您有 {len(items)} 項食材即將過期", contents)


def send_low_stock_notification(user_id: str, items: list[dict]) -> bool:
    """
    發送庫存不足提醒

    Args:
        user_id: LINE User ID
        items: 庫存不足的食材清單

    Returns:
        bool: 發送成功返回 True，失敗返回 False
    """
    if not items:
        return False

    item_names = ", ".join([item["name"] for item in items[:5]])
    text = f"📦 庫存提醒\n\n以下食材數量不足：\n{item_names}"

    if len(items) > 5:
        text += f"\n...等共 {len(items)} 項"

    return send_text_message(user_id, text)


def send_space_warning(user_id: str, usage_percentage: float) -> bool:
    """
    發送空間占用警告

    Args:
        user_id: LINE User ID
        usage_percentage: 空間使用率（0-100）

    Returns:
        bool: 發送成功返回 True，失敗返回 False
    """
    text = f"🧊 空間提醒\n\n冰箱空間使用率已達 {usage_percentage:.1f}%，建議整理冰箱或消耗部分食材。"
    return send_text_message(user_id, text)
