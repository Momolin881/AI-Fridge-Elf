"""
FridgeMember 模型

儲存冰箱成員資訊，支援冰箱共享功能。
一個冰箱可以有多個成員，每個成員有不同的權限等級。
"""

from datetime import datetime, timedelta
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
import secrets

from src.database import Base


class FridgeMember(Base):
    """冰箱成員模型"""

    __tablename__ = "fridge_members"

    id = Column(Integer, primary_key=True, index=True)
    fridge_id = Column(Integer, ForeignKey("fridges.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # 權限角色: "owner" | "editor" | "viewer"
    role = Column(String(20), nullable=False, default="editor")
    
    # 邀請者（誰邀請此成員加入的）
    invited_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # 時間戳記
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # 唯一約束：一個使用者在一個冰箱只能有一個角色
    __table_args__ = (
        UniqueConstraint('fridge_id', 'user_id', name='uq_fridge_member'),
    )

    # 關聯
    fridge = relationship("Fridge", back_populates="members")
    user = relationship("User", foreign_keys=[user_id], back_populates="fridge_memberships")
    inviter = relationship("User", foreign_keys=[invited_by])

    # 權限等級（用於權限比較）
    ROLE_LEVELS = {
        "owner": 3,
        "editor": 2,
        "viewer": 1,
    }

    def has_permission(self, required_role: str) -> bool:
        """
        檢查是否有足夠權限
        
        Args:
            required_role: 需要的權限等級 ("owner", "editor", "viewer")
            
        Returns:
            bool: 是否有足夠權限
        """
        return self.ROLE_LEVELS.get(self.role, 0) >= self.ROLE_LEVELS.get(required_role, 0)

    def __repr__(self):
        return f"<FridgeMember(id={self.id}, fridge_id={self.fridge_id}, user_id={self.user_id}, role='{self.role}')>"


class FridgeInvite(Base):
    """冰箱邀請碼模型"""

    __tablename__ = "fridge_invites"

    id = Column(Integer, primary_key=True, index=True)
    fridge_id = Column(Integer, ForeignKey("fridges.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # 邀請碼（6 位數英數字）
    invite_code = Column(String(10), unique=True, nullable=False, index=True)
    
    # 邀請設定
    default_role = Column(String(20), nullable=False, default="editor")  # 加入後的預設角色
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # 有效期限（預設 7 天）
    expires_at = Column(DateTime, nullable=False)
    
    # 使用次數限制（null = 無限制）
    max_uses = Column(Integer, nullable=True)
    use_count = Column(Integer, default=0, nullable=False)
    
    # 時間戳記
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # 關聯
    fridge = relationship("Fridge", back_populates="invites")
    creator = relationship("User", foreign_keys=[created_by])

    @classmethod
    def generate_code(cls) -> str:
        """產生 6 位數邀請碼"""
        return secrets.token_urlsafe(4)[:6].upper()

    @classmethod
    def create_invite(cls, fridge_id: int, created_by: int, default_role: str = "editor", expires_days: int = 7, max_uses: int = None):
        """建立新的邀請碼"""
        return cls(
            fridge_id=fridge_id,
            invite_code=cls.generate_code(),
            default_role=default_role,
            created_by=created_by,
            expires_at=datetime.utcnow() + timedelta(days=expires_days),
            max_uses=max_uses,
        )

    def is_valid(self) -> bool:
        """檢查邀請碼是否有效"""
        if datetime.utcnow() > self.expires_at:
            return False
        if self.max_uses is not None and self.use_count >= self.max_uses:
            return False
        return True

    def __repr__(self):
        return f"<FridgeInvite(id={self.id}, code='{self.invite_code}', fridge_id={self.fridge_id})>"
