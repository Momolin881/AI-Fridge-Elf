"""
資料庫連線管理

使用 SQLAlchemy 2.0 的 declarative base 和 session 管理。
提供 get_db() dependency function 供 FastAPI 路由使用。
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

from src.config import settings

# 建立資料庫引擎
engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,  # 開發模式下印出 SQL 語句
    pool_pre_ping=True,  # 連線前檢查有效性
    pool_size=5,  # 連線池大小
    max_overflow=10,  # 最大溢出連線數
)

# 建立 Session 工廠
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# 建立 Base 類別（所有 model 繼承此類別）
Base = declarative_base()


def get_db() -> Session:
    """
    FastAPI dependency function

    提供資料庫 session，使用完畢後自動關閉。

    使用方式:
        @app.get("/items")
        def read_items(db: Session = Depends(get_db)):
            return db.query(Item).all()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
