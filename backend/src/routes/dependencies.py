"""
FastAPI 依賴注入模組

提供常用的 dependency functions，包括資料庫 session 和使用者認證。
"""

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from linebot import LineBotApi
from linebot.exceptions import LineBotApiError
from sqlalchemy.orm import Session

from src.config import settings
from src.database import get_db

# HTTP Bearer token 認證
security = HTTPBearer()

# LINE Bot API 客戶端
line_bot_api = LineBotApi(settings.LINE_CHANNEL_ACCESS_TOKEN)


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> str:
    """
    從 Authorization header 取得 LINE user_id (MVP 簡化版)

    TODO: 完整版應該驗證 LIFF access token 的有效性
    目前為了 MVP，直接從 header 取得 user_id

    Args:
        credentials: HTTPBearer 自動解析的認證憑證

    Returns:
        str: LINE user_id

    Raises:
        HTTPException: user_id 不存在時拋出 401 錯誤
    """
    user_id = credentials.credentials

    if not user_id or len(user_id) < 10:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid LINE user ID",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user_id


# 類型別名（方便在路由中使用）
DBSession = Annotated[Session, Depends(get_db)]
CurrentUserId = Annotated[str, Depends(get_current_user_id)]
