"""
FastAPI 依賴注入模組

提供常用的 dependency functions，包括資料庫 session 和使用者認證。
"""

import logging
from typing import Annotated

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from linebot import LineBotApi
from linebot.exceptions import LineBotApiError
from sqlalchemy.orm import Session

from src.config import settings
from src.database import get_db

logger = logging.getLogger(__name__)

# HTTP Bearer token 認證
security = HTTPBearer()

# LINE Bot API 客戶端
line_bot_api = LineBotApi(settings.LINE_CHANNEL_ACCESS_TOKEN)


async def verify_liff_token(access_token: str) -> dict:
    """
    使用 LINE API 驗證 LIFF access token 並獲取使用者資料

    Args:
        access_token: LIFF access token

    Returns:
        dict: 使用者資料，包含 userId, displayName 等

    Raises:
        HTTPException: token 無效時拋出錯誤
    """
    # 開發模式：跳過驗證
    if access_token == "dev-test-token":
        logger.info("開發模式：使用測試 token")
        return {
            "userId": "U_dev_test_user",
            "displayName": "Dev User"
        }

    try:
        async with httpx.AsyncClient() as client:
            # 使用 access token 獲取用戶 profile
            response = await client.get(
                "https://api.line.me/v2/profile",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=10.0
            )

            if response.status_code == 200:
                profile = response.json()
                logger.info(f"LINE token 驗證成功: userId={profile.get('userId')}")
                return profile
            else:
                logger.error(f"LINE API 錯誤: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired LINE token",
                    headers={"WWW-Authenticate": "Bearer"},
                )

    except httpx.RequestError as e:
        logger.error(f"LINE API 請求失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to verify LINE token"
        )


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> int:
    """
    從 Authorization header 取得 LIFF access token，驗證後返回資料庫 User.id

    流程：
    1. 從 header 取得 LIFF access token
    2. 調用 LINE API 驗證 token 並獲取用戶 profile
    3. 用真正的 LINE User ID 查找或創建用戶

    Args:
        credentials: HTTPBearer 自動解析的認證憑證
        db: 資料庫 session

    Returns:
        int: 資料庫中的 User.id

    Raises:
        HTTPException: token 無效或創建失敗時拋出錯誤
    """
    from src.models.user import User

    access_token = credentials.credentials

    if not access_token or len(access_token) < 10:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 驗證 token 並獲取用戶資料
    profile = await verify_liff_token(access_token)
    line_user_id = profile.get("userId")
    display_name = profile.get("displayName", "LINE User")

    if not line_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to get LINE user ID",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 查找用戶（用真正的 LINE User ID）
    user = db.query(User).filter(User.line_user_id == line_user_id).first()

    if not user:
        # 檢查是否有舊的用戶資料（用 access token 當 ID 的）
        # 如果有，更新為正確的 line_user_id
        old_user = db.query(User).filter(User.line_user_id == access_token).first()
        if old_user:
            logger.info(f"更新舊用戶的 line_user_id: {old_user.id}")
            old_user.line_user_id = line_user_id
            old_user.display_name = display_name
            db.commit()
            db.refresh(old_user)
            return old_user.id

        # 創建新用戶
        logger.info(f"創建新用戶: line_user_id={line_user_id}")
        user = User(
            line_user_id=line_user_id,
            display_name=display_name,
            storage_mode="simple"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    return user.id


# 類型別名（方便在路由中使用）
DBSession = Annotated[Session, Depends(get_db)]
CurrentUserId = Annotated[int, Depends(get_current_user_id)]
