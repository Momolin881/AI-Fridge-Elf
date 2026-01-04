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
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> int:
    """
    從 Authorization header 取得 LINE user_id，並返回資料庫 User.id (MVP 簡化版)

    TODO: 完整版應該：
    1. 解析並驗證 LIFF access token
    2. 從 token 中獲取 LINE user_id
    3. 調用 LINE API 獲取用戶 profile

    目前為了 MVP，直接從 header 取得 LINE user_id

    Args:
        credentials: HTTPBearer 自動解析的認證憑證
        db: 資料庫 session

    Returns:
        int: 資料庫中的 User.id

    Raises:
        HTTPException: user_id 不存在或創建失敗時拋出錯誤
    """
    from src.models.user import User

    line_user_id = credentials.credentials

    if not line_user_id or len(line_user_id) < 10:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid LINE user ID",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 查找或創建用戶
    user = db.query(User).filter(User.line_user_id == line_user_id).first()

    if not user:
        # 創建新用戶（MVP：使用簡化的資料）
        user = User(
            line_user_id=line_user_id,
            display_name="LINE User",  # TODO: 從 LINE API 獲取真實姓名
            storage_mode="simple"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    return user.id


# 類型別名（方便在路由中使用）
DBSession = Annotated[Session, Depends(get_db)]
CurrentUserId = Annotated[int, Depends(get_current_user_id)]
