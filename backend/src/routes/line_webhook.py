"""
LINE Webhook 路由

處理 LINE Bot 的 webhook 事件（訊息、Postback 等）。
"""

import logging
import hmac
import hashlib
import base64

from fastapi import APIRouter, Request, HTTPException, status
from linebot import LineBotApi, WebhookHandler
from linebot.exceptions import InvalidSignatureError, LineBotApiError
from linebot.models import MessageEvent, TextMessage, TextSendMessage

from src.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["LINE"])

# LINE Bot API 和 WebhookHandler
line_bot_api = LineBotApi(settings.LINE_CHANNEL_ACCESS_TOKEN)
handler = WebhookHandler(settings.LINE_CHANNEL_SECRET)


def verify_signature(body: bytes, signature: str) -> bool:
    """
    驗證 LINE webhook 簽名

    Args:
        body: 請求 body（bytes）
        signature: X-Line-Signature header 值

    Returns:
        bool: 簽名是否有效
    """
    hash_value = hmac.new(
        settings.LINE_CHANNEL_SECRET.encode("utf-8"),
        body,
        hashlib.sha256,
    ).digest()

    expected_signature = base64.b64encode(hash_value).decode('utf-8')
    return hmac.compare_digest(expected_signature, signature)


@router.post("/webhook/line")
async def line_webhook(request: Request):
    """
    LINE Webhook 端點

    處理 LINE Bot 的 webhook 事件，包含：
    - MessageEvent: 使用者傳送訊息
    - PostbackEvent: 使用者點擊互動按鈕（未來擴充）
    """
    # 取得請求 body 和簽名
    body = await request.body()
    signature = request.headers.get("X-Line-Signature", "")

    # 驗證簽名
    if not verify_signature(body, signature):
        logger.warning("LINE webhook 簽名驗證失敗")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature"
        )

    # 解析事件
    try:
        events = handler.parse(body.decode("utf-8"), signature)
    except InvalidSignatureError:
        logger.error("LINE webhook 簽名解析失敗")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature"
        ) from None

    # 處理每個事件
    for event in events:
        try:
            if isinstance(event, MessageEvent) and isinstance(event.message, TextMessage):
                # 處理文字訊息事件
                await handle_text_message(event)
        except Exception as e:
            logger.error(f"處理 LINE 事件時發生錯誤: {e}")
            # 不拋出錯誤，避免 LINE 重送 webhook

    return {"status": "ok"}


async def handle_text_message(event: MessageEvent):
    """
    處理文字訊息事件

    根據使用者訊息內容回覆適當的訊息。
    未來可擴充為指令處理（如「查詢過期食材」、「新增食材」等）。

    Args:
        event: LINE MessageEvent
    """
    user_id = event.source.user_id
    user_message = event.message.text.strip()

    logger.info(f"使用者 {user_id} 傳送訊息: {user_message}")

    # 簡易回應邏輯（未來可擴充）
    if user_message in ["你好", "Hello", "Hi", "嗨"]:
        reply_text = "你好！歡迎使用 AI Fridge Elf。\n\n請使用 LIFF 應用管理你的冰箱食材。"
    elif user_message in ["幫助", "help", "說明"]:
        reply_text = (
            "AI Fridge Elf 功能說明：\n\n"
            "1. 使用 LIFF 應用新增、編輯食材\n"
            "2. AI 自動辨識食材圖片\n"
            "3. 自動提醒即將過期的食材\n"
            "4. 追蹤冰箱容量使用率\n\n"
            "點選下方選單開始使用！"
        )
    else:
        reply_text = f"你說：「{user_message}」\n\n目前此訊息功能尚未實作，請使用 LIFF 應用管理食材。"

    # 回覆訊息
    try:
        line_bot_api.reply_message(event.reply_token, TextSendMessage(text=reply_text))
    except LineBotApiError as e:
        logger.error(f"LINE Bot API 錯誤: {e}")
