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


class LineBot:
    """LINE Bot 類別，提供各種推播功能"""
    
    def __init__(self):
        self.api = line_bot_api
    
    async def send_monthly_stats_notification(self, user_id: int, stats: dict) -> bool:
        """
        發送月度省錢統計推播
        
        Args:
            user_id: 用戶 ID
            stats: 月度統計資料
            
        Returns:
            bool: 發送成功返回 True，失敗返回 False
        """
        try:
            # 構建推播訊息
            message = self._build_monthly_stats_message(stats)
            
            # 發送推播（需要轉換為 LINE User ID）
            line_user_id = await self._get_line_user_id(user_id)
            if not line_user_id:
                logger.error(f"找不到用戶的 LINE User ID: {user_id}")
                return False
            
            return send_text_message(line_user_id, message)
            
        except Exception as e:
            logger.error(f"發送月度統計推播失敗 (user_id: {user_id}): {e}")
            return False
    
    def _build_monthly_stats_message(self, stats: dict) -> str:
        """構建月度統計推播訊息"""
        month = stats.get('month', '上個月')
        saved_money = stats.get('saved_money', 0)
        save_rate = stats.get('save_rate', 0)
        wasted_money = stats.get('wasted_money', 0)
        used_count = stats.get('used_count', 0)
        wasted_count = stats.get('wasted_count', 0)
        suggestions = stats.get('suggestions', [])
        
        # 構建主要訊息
        message_parts = [
            f"🎉✨ {month} 省錢報告 ✨🎉",
            "",
            "📊 本月成果：",
            f"💰 省錢金額：${saved_money:,.0f}",
            f"📈 省錢率：{save_rate:.1f}%",
            f"✅ 用完食材：{used_count} 項",
        ]
        
        # 如果有浪費，加入浪費資訊
        if wasted_count > 0:
            message_parts.extend([
                f"❌ 浪費食材：{wasted_count} 項 (${wasted_money:,.0f})"
            ])
        
        message_parts.append("")
        
        # 加入個人化建議
        if suggestions:
            message_parts.append("💡 專屬建議：")
            for suggestion in suggestions:
                message_parts.append(f"• {suggestion}")
        
        message_parts.extend([
            "",
            "🌟 繼續加油，下個月一起達成更好的成績吧！",
            "",
            f"👉 點此查看詳細: https://liff.line.me/{settings.LIFF_ID}"
        ])
        
        return "\n".join(message_parts)
    
    async def _get_line_user_id(self, user_id: int) -> Optional[str]:
        """
        根據系統 user_id 獲取對應的 LINE User ID
        
        這裡需要查詢資料庫中的用戶 LINE ID 映射
        目前暫時返回測試用的 LINE User ID
        """
        # TODO: 實作從資料庫查詢 LINE User ID 的邏輯
        # 現在先返回測試用 ID
        if user_id == 1:
            return "U1234567890abcdef"  # 測試用 LINE User ID
        
        logger.warning(f"找不到用戶 {user_id} 的 LINE User ID")
        return None
    
    async def send_monthly_stats_flex_message(self, user_id: int, stats: dict) -> bool:
        """
        發送月度統計 Flex Message（更豐富的視覺效果）
        
        Args:
            user_id: 用戶 ID
            stats: 月度統計資料
            
        Returns:
            bool: 發送成功返回 True，失敗返回 False
        """
        try:
            line_user_id = await self._get_line_user_id(user_id)
            if not line_user_id:
                return False
            
            contents = self._build_monthly_stats_flex_content(stats)
            alt_text = f"🎉 {stats.get('month', '上個月')} 省錢報告"
            
            return send_flex_message(line_user_id, alt_text, contents)
            
        except Exception as e:
            logger.error(f"發送月度統計 Flex Message 失敗 (user_id: {user_id}): {e}")
            return False
    
    def _build_monthly_stats_flex_content(self, stats: dict) -> dict:
        """構建月度統計 Flex Message 內容"""
        month = stats.get('month', '上個月')
        saved_money = stats.get('saved_money', 0)
        save_rate = stats.get('save_rate', 0)
        wasted_money = stats.get('wasted_money', 0)
        used_count = stats.get('used_count', 0)
        wasted_count = stats.get('wasted_count', 0)
        suggestions = stats.get('suggestions', [])
        
        # 根據省錢率決定顏色
        if save_rate >= 80:
            header_color = "#00C851"  # 綠色
            emoji = "🌟"
        elif save_rate >= 60:
            header_color = "#ffbb33"  # 橙色
            emoji = "👍"
        else:
            header_color = "#ff4444"  # 紅色
            emoji = "💪"
        
        contents = {
            "type": "bubble",
            "header": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {
                        "type": "text",
                        "text": f"{emoji} {month} 省錢報告",
                        "weight": "bold",
                        "size": "lg",
                        "color": "#ffffff"
                    }
                ],
                "backgroundColor": header_color,
                "paddingAll": "20px"
            },
            "body": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    # 主要數據區域
                    {
                        "type": "box",
                        "layout": "horizontal",
                        "contents": [
                            {
                                "type": "box",
                                "layout": "vertical",
                                "contents": [
                                    {
                                        "type": "text",
                                        "text": f"${saved_money:,.0f}",
                                        "size": "xl",
                                        "weight": "bold",
                                        "color": "#00C851"
                                    },
                                    {
                                        "type": "text",
                                        "text": "省錢金額",
                                        "size": "sm",
                                        "color": "#999999"
                                    }
                                ],
                                "flex": 1
                            },
                            {
                                "type": "box",
                                "layout": "vertical",
                                "contents": [
                                    {
                                        "type": "text",
                                        "text": f"{save_rate:.1f}%",
                                        "size": "xl",
                                        "weight": "bold",
                                        "color": header_color
                                    },
                                    {
                                        "type": "text",
                                        "text": "省錢率",
                                        "size": "sm",
                                        "color": "#999999"
                                    }
                                ],
                                "flex": 1
                            }
                        ],
                        "margin": "md"
                    },
                    {
                        "type": "separator",
                        "margin": "lg"
                    },
                    # 詳細統計
                    {
                        "type": "box",
                        "layout": "vertical",
                        "contents": [
                            {
                                "type": "box",
                                "layout": "horizontal",
                                "contents": [
                                    {
                                        "type": "text",
                                        "text": "✅ 用完食材",
                                        "size": "sm",
                                        "color": "#555555",
                                        "flex": 2
                                    },
                                    {
                                        "type": "text",
                                        "text": f"{used_count} 項",
                                        "size": "sm",
                                        "color": "#00C851",
                                        "align": "end",
                                        "flex": 1
                                    }
                                ]
                            }
                        ],
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
                            "label": "查看詳細報告",
                            "uri": f"https://liff.line.me/{settings.LIFF_ID}"
                        },
                        "style": "primary",
                        "color": header_color
                    }
                ]
            }
        }
        
        # 如果有浪費，加入浪費統計
        if wasted_count > 0:
            waste_item = {
                "type": "box",
                "layout": "horizontal",
                "contents": [
                    {
                        "type": "text",
                        "text": "❌ 浪費食材",
                        "size": "sm",
                        "color": "#555555",
                        "flex": 2
                    },
                    {
                        "type": "text",
                        "text": f"{wasted_count} 項",
                        "size": "sm",
                        "color": "#ff4444",
                        "align": "end",
                        "flex": 1
                    }
                ],
                "margin": "md"
            }
            contents["body"]["contents"][3]["contents"].append(waste_item)
        
        return contents
