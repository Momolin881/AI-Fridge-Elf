"""
冰箱成員 API 路由

提供冰箱共享功能的成員管理 API。
"""

import logging
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from src.models.user import User
from src.models.fridge import Fridge
from src.models.fridge_member import FridgeMember, FridgeInvite
from src.routes.dependencies import DBSession, CurrentUserId

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/fridges", tags=["Fridge Members"])


# ============ Pydantic Schemas ============

class FridgeMemberResponse(BaseModel):
    id: int
    user_id: int
    display_name: str
    picture_url: Optional[str]
    role: str
    created_at: datetime

    class Config:
        from_attributes = True


class FridgeMemberCreate(BaseModel):
    role: str = "editor"  # "editor" or "viewer"


class FridgeMemberUpdate(BaseModel):
    role: str  # "editor" or "viewer"


class FridgeInviteResponse(BaseModel):
    id: int
    invite_code: str
    default_role: str
    expires_at: datetime
    max_uses: Optional[int]
    use_count: int
    is_valid: bool

    class Config:
        from_attributes = True


class FridgeInviteCreate(BaseModel):
    default_role: str = "editor"
    expires_days: int = 7
    max_uses: Optional[int] = None


class JoinFridgeResponse(BaseModel):
    message: str
    fridge_id: int
    role: str


# ============ Helper Functions ============

def get_user_membership(db: Session, fridge_id: int, user_id: int) -> Optional[FridgeMember]:
    """取得使用者在冰箱的成員資料"""
    return db.query(FridgeMember).filter(
        FridgeMember.fridge_id == fridge_id,
        FridgeMember.user_id == user_id
    ).first()


def require_fridge_permission(db: Session, fridge_id: int, user_id: int, required_role: str) -> FridgeMember:
    """
    檢查使用者是否有足夠權限
    
    Raises:
        HTTPException 403: 權限不足
        HTTPException 404: 冰箱不存在或非成員
    """
    # 先檢查冰箱是否存在
    fridge = db.query(Fridge).filter(Fridge.id == fridge_id).first()
    if not fridge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="冰箱不存在"
        )
    
    # 檢查是否為冰箱擁有者（自動有 owner 權限）
    if fridge.user_id == user_id:
        # 建立或取得 owner membership
        membership = get_user_membership(db, fridge_id, user_id)
        if not membership:
            membership = FridgeMember(
                fridge_id=fridge_id,
                user_id=user_id,
                role="owner"
            )
            db.add(membership)
            db.commit()
            db.refresh(membership)
        return membership
    
    # 檢查成員權限
    membership = get_user_membership(db, fridge_id, user_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="您不是此冰箱的成員"
        )
    
    if not membership.has_permission(required_role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"權限不足，需要 {required_role} 權限"
        )
    
    return membership


# ============ API Endpoints ============

@router.get(
    "/{fridge_id}/members",
    response_model=List[FridgeMemberResponse],
    summary="取得冰箱成員清單"
)
async def get_fridge_members(
    fridge_id: int,
    db: DBSession,
    user_id: CurrentUserId,
):
    """取得冰箱的所有成員（需為成員才能查看）"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="使用者不存在")
    
    # 檢查權限（viewer 也可以查看成員）
    require_fridge_permission(db, fridge_id, user_id, "viewer")
    
    # 取得所有成員
    members = db.query(FridgeMember).filter(
        FridgeMember.fridge_id == fridge_id
    ).all()
    
    # 轉換回應格式
    result = []
    for member in members:
        member_user = db.query(User).filter(User.id == member.user_id).first()
        if member_user:
            result.append(FridgeMemberResponse(
                id=member.id,
                user_id=member.user_id,
                display_name=member_user.display_name,
                picture_url=member_user.picture_url,
                role=member.role,
                created_at=member.created_at,
            ))
    
    return result


@router.put(
    "/{fridge_id}/members/{member_id}",
    response_model=FridgeMemberResponse,
    summary="更新成員權限"
)
async def update_member_role(
    fridge_id: int,
    member_id: int,
    update_data: FridgeMemberUpdate,
    db: DBSession,
    user_id: CurrentUserId,
):
    """更新成員權限（僅 owner 可操作）"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="使用者不存在")
    
    # 檢查是否為 owner
    require_fridge_permission(db, fridge_id, user_id, "owner")
    
    # 取得要更新的成員
    member = db.query(FridgeMember).filter(
        FridgeMember.id == member_id,
        FridgeMember.fridge_id == fridge_id
    ).first()
    
    if not member:
        raise HTTPException(status_code=404, detail="成員不存在")
    
    # 不能更改 owner 的權限
    if member.role == "owner":
        raise HTTPException(status_code=400, detail="無法更改擁有者的權限")
    
    # 驗證角色值
    if update_data.role not in ["editor", "viewer"]:
        raise HTTPException(status_code=400, detail="角色必須是 editor 或 viewer")
    
    member.role = update_data.role
    db.commit()
    db.refresh(member)
    
    member_user = db.query(User).filter(User.id == member.user_id).first()
    return FridgeMemberResponse(
        id=member.id,
        user_id=member.user_id,
        display_name=member_user.display_name if member_user else "未知",
        picture_url=member_user.picture_url if member_user else None,
        role=member.role,
        created_at=member.created_at,
    )


@router.delete(
    "/{fridge_id}/members/{member_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="移除成員"
)
async def remove_member(
    fridge_id: int,
    member_id: int,
    db: DBSession,
    user_id: CurrentUserId,
):
    """移除成員（僅 owner 可操作）"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="使用者不存在")
    
    # 檢查是否為 owner
    require_fridge_permission(db, fridge_id, user_id, "owner")
    
    # 取得要移除的成員
    member = db.query(FridgeMember).filter(
        FridgeMember.id == member_id,
        FridgeMember.fridge_id == fridge_id
    ).first()
    
    if not member:
        raise HTTPException(status_code=404, detail="成員不存在")
    
    # 不能移除 owner
    if member.role == "owner":
        raise HTTPException(status_code=400, detail="無法移除擁有者")
    
    db.delete(member)
    db.commit()
    
    logger.info(f"成員 {member_id} 已從冰箱 {fridge_id} 移除")


# ============ 邀請功能 ============

@router.post(
    "/{fridge_id}/invites",
    response_model=FridgeInviteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="產生邀請碼"
)
async def create_invite(
    fridge_id: int,
    invite_data: FridgeInviteCreate,
    db: DBSession,
    user_id: CurrentUserId,
):
    """產生冰箱邀請碼（僅 owner 可操作）"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="使用者不存在")
    
    # 檢查是否為 owner
    require_fridge_permission(db, fridge_id, user_id, "owner")
    
    # 驗證角色值
    if invite_data.default_role not in ["editor", "viewer"]:
        raise HTTPException(status_code=400, detail="角色必須是 editor 或 viewer")
    
    # 建立邀請碼
    invite = FridgeInvite.create_invite(
        fridge_id=fridge_id,
        created_by=user_id,
        default_role=invite_data.default_role,
        expires_days=invite_data.expires_days,
        max_uses=invite_data.max_uses,
    )
    
    db.add(invite)
    db.commit()
    db.refresh(invite)
    
    logger.info(f"冰箱 {fridge_id} 產生邀請碼: {invite.invite_code}")
    
    return FridgeInviteResponse(
        id=invite.id,
        invite_code=invite.invite_code,
        default_role=invite.default_role,
        expires_at=invite.expires_at,
        max_uses=invite.max_uses,
        use_count=invite.use_count,
        is_valid=invite.is_valid(),
    )


@router.get(
    "/{fridge_id}/invites",
    response_model=List[FridgeInviteResponse],
    summary="取得邀請碼清單"
)
async def get_invites(
    fridge_id: int,
    db: DBSession,
    user_id: CurrentUserId,
):
    """取得冰箱的所有邀請碼（僅 owner 可查看）"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="使用者不存在")
    
    # 檢查是否為 owner
    require_fridge_permission(db, fridge_id, user_id, "owner")
    
    invites = db.query(FridgeInvite).filter(
        FridgeInvite.fridge_id == fridge_id
    ).order_by(FridgeInvite.created_at.desc()).all()
    
    return [
        FridgeInviteResponse(
            id=inv.id,
            invite_code=inv.invite_code,
            default_role=inv.default_role,
            expires_at=inv.expires_at,
            max_uses=inv.max_uses,
            use_count=inv.use_count,
            is_valid=inv.is_valid(),
        )
        for inv in invites
    ]


@router.post(
    "/join/{invite_code}",
    response_model=JoinFridgeResponse,
    summary="透過邀請碼加入冰箱"
)
async def join_fridge(
    invite_code: str,
    db: DBSession,
    user_id: CurrentUserId,
):
    """透過邀請碼加入冰箱"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="使用者不存在")
    
    # 查詢邀請碼
    invite = db.query(FridgeInvite).filter(
        FridgeInvite.invite_code == invite_code.upper()
    ).first()
    
    if not invite:
        raise HTTPException(status_code=404, detail="邀請碼不存在")
    
    if not invite.is_valid():
        raise HTTPException(status_code=400, detail="邀請碼已過期或已達使用上限")
    
    # 檢查是否已經是成員
    existing = get_user_membership(db, invite.fridge_id, user_id)
    if existing:
        raise HTTPException(status_code=400, detail="您已經是此冰箱的成員")
    
    # 加入冰箱
    member = FridgeMember(
        fridge_id=invite.fridge_id,
        user_id=user_id,
        role=invite.default_role,
        invited_by=invite.created_by,
    )
    
    db.add(member)
    
    # 更新邀請碼使用次數
    invite.use_count += 1
    
    db.commit()
    
    logger.info(f"使用者 {user_id} 透過邀請碼 {invite_code} 加入冰箱 {invite.fridge_id}")
    
    return JoinFridgeResponse(
        message="成功加入冰箱",
        fridge_id=invite.fridge_id,
        role=invite.default_role,
    )
