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
    驗證 LIFF access token 並返回 LINE user_id

    工作流程:
    1. 從 Authorization header 取得 Bearer token
    2. 使用 LINE API 驗證 token
    3. 取得使用者 profile
    4. 返回 user_id

    Args:
        credentials: HTTPBearer 自動解析的認證憑證

    Returns:
        str: LINE user_id

    Raises:
        HTTPException: token 無效或過期時拋出 401 錯誤

    使用範例:
        @app.get("/me")
        def get_me(user_id: str = Depends(get_current_user_id)):
            return {"user_id": user_id}
    """
    try:
        # 使用 LINE API 驗證 access token 並取得使用者資料
        profile = line_bot_api.get_profile(credentials.credentials)
        return profile.user_id
    except LineBotApiError as e:
        # token 無效或已過期
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e
    except Exception as e:
        # 其他錯誤（網路問題等）
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify access token",
        ) from e


# 類型別名（方便在路由中使用）
DBSession = Annotated[Session, Depends(get_db)]
CurrentUserId = Annotated[str, Depends(get_current_user_id)]
