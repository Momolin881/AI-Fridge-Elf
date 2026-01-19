"""
FastAPI 主應用程式

初始化 FastAPI 應用、設定 CORS、註冊路由、管理 scheduler 生命週期。
"""

from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from src.config import settings
from src.database import Base, engine
from src import models  # 確保所有 models 都被導入
from src.services import scheduler
from src.routes import food_items, fridges, line_webhook, notifications, budget, recipes, fridge_members, fridge_export

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    應用程式生命週期管理

    啟動時: 建立資料庫表格、啟動排程器
    關閉時: 關閉排程器
    """
    # Startup
    # 建立所有資料庫表格（如果不存在）
    Base.metadata.create_all(bind=engine)
    print("資料庫表格初始化完成")

    # 啟動排程器
    scheduler.start_scheduler()
    print(f"{settings.APP_NAME} v{settings.APP_VERSION} started")
    yield
    # Shutdown
    scheduler.stop_scheduler()
    print(f"{settings.APP_NAME} stopped")


# 建立 FastAPI 應用實例
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI Fridge Elf - 數位冰箱管理系統 API",
    lifespan=lifespan,
)

# 設定 CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 全局異常處理器：記錄詳細的 422 驗證錯誤
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    捕獲並記錄詳細的請求驗證錯誤（422）
    """
    errors = exc.errors()
    logger.error(f"❌ 422 Validation Error on {request.method} {request.url.path}")
    logger.error(f"Validation errors: {errors}")

    # 返回標準的 422 錯誤回應
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": errors},
    )


# 健康檢查端點
@app.get("/health")
async def health_check():
    """健康檢查端點（用於 Zeabur 和監控）"""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


# 註冊路由
app.include_router(line_webhook.router, tags=["LINE"])
app.include_router(fridges.router, prefix="/api/v1", tags=["Fridges"])
app.include_router(food_items.router, prefix="/api/v1", tags=["Food Items"])
app.include_router(notifications.router, prefix="/api/v1", tags=["Notifications"])
app.include_router(budget.router, prefix="/api/v1", tags=["Budget"])
app.include_router(recipes.router, prefix="/api/v1", tags=["Recipes"])
app.include_router(fridge_members.router, prefix="/api/v1", tags=["Fridge Members"])
app.include_router(fridge_export.router, prefix="/api/v1", tags=["Fridge Export"])
