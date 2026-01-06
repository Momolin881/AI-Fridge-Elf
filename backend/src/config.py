"""
配置管理模組

使用 pydantic-settings 管理環境變數和應用配置。
所有環境變數從 .env 檔案或系統環境變數載入。
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """應用配置類別"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # 資料庫設定
    DATABASE_URL: str

    # LINE Bot 設定
    LINE_CHANNEL_SECRET: str
    LINE_CHANNEL_ACCESS_TOKEN: str
    LIFF_ID: str

    # OpenAI 設定
    OPENAI_API_KEY: str

    # Cloudinary 設定
    CLOUDINARY_CLOUD_NAME: str
    CLOUDINARY_API_KEY: str
    CLOUDINARY_API_SECRET: str

    # 應用設定
    APP_NAME: str = "AI Fridge Elf"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    # CORS 設定
    CORS_ORIGINS: list[str] = [
        "https://liff.line.me",
        "https://ai-fridge.zeabur.app",
        "http://localhost:5173",  # 本地開發
    ]

    # 排程設定
    EXPIRY_WARNING_DAYS: int = 3  # 效期提醒天數（預設提前 3 天）
    NOTIFICATION_TIME_HOUR: int = 9  # 通知時間（小時，預設早上 9 點）
    NOTIFICATION_TIME_MINUTE: int = 0  # 通知時間（分鐘）

    # AI Vision 設定
    AI_VISION_MODEL: str = "gpt-4o"  # 更新為新版本模型（gpt-4-vision-preview 已棄用）
    AI_VISION_MAX_TOKENS: int = 300
    AI_VISION_TEMPERATURE: float = 0.2
    IMAGE_MAX_SIZE: int = 1024  # 圖片壓縮最大尺寸（像素）

    @property
    def cloudinary_url(self) -> str:
        """組合 Cloudinary URL（用於 SDK 初始化）"""
        return f"cloudinary://{self.CLOUDINARY_API_KEY}:{self.CLOUDINARY_API_SECRET}@{self.CLOUDINARY_CLOUD_NAME}"


# 全域設定實例
settings = Settings()
