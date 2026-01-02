"""
Cloudinary 圖片儲存服務模組

提供圖片上傳、刪除功能，並自動優化圖片。
"""

import logging
from typing import Optional

import cloudinary
import cloudinary.uploader
from cloudinary.exceptions import Error as CloudinaryError

from src.config import settings

logger = logging.getLogger(__name__)

# 初始化 Cloudinary
cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
    secure=True,
)


def upload_image(image_bytes: bytes, folder: str = "food_items") -> dict:
    """
    上傳圖片至 Cloudinary

    Args:
        image_bytes: 圖片位元組資料
        folder: Cloudinary 資料夾名稱（預設 "food_items"）

    Returns:
        包含 url 和 public_id 的字典:
        {
            "url": str,        # 圖片 URL
            "public_id": str   # Cloudinary public_id（用於刪除）
        }

    Raises:
        Exception: 上傳失敗時拋出

    Examples:
        >>> image_bytes = open("apple.jpg", "rb").read()
        >>> result = upload_image(image_bytes)
        >>> print(result)
        {
            "url": "https://res.cloudinary.com/.../food_items/abc123.jpg",
            "public_id": "food_items/abc123"
        }
    """
    try:
        # 上傳圖片至 Cloudinary
        result = cloudinary.uploader.upload(
            image_bytes,
            folder=folder,
            resource_type="image",
            # 自動優化設定
            transformation=[
                {"width": 800, "height": 800, "crop": "limit"},  # 限制最大尺寸
                {"quality": "auto"},  # 自動品質
                {"fetch_format": "auto"},  # 自動格式（WebP 等）
            ],
        )

        # 返回 URL 和 public_id
        upload_result = {
            "url": result["secure_url"],
            "public_id": result["public_id"],
        }

        logger.info(f"圖片上傳成功: {upload_result['public_id']}")
        return upload_result

    except CloudinaryError as e:
        logger.error(f"Cloudinary 上傳失敗: {e}")
        raise Exception(f"圖片上傳失敗: {str(e)}") from e

    except Exception as e:
        logger.error(f"圖片上傳過程發生錯誤: {e}")
        raise Exception(f"圖片上傳失敗: {str(e)}") from e


def delete_image(public_id: str) -> bool:
    """
    從 Cloudinary 刪除圖片

    Args:
        public_id: Cloudinary public_id（從上傳結果取得）

    Returns:
        bool: 刪除成功返回 True，失敗返回 False

    Examples:
        >>> success = delete_image("food_items/abc123")
        >>> print(success)
        True
    """
    if not public_id:
        logger.warning("嘗試刪除圖片但 public_id 為空")
        return False

    try:
        result = cloudinary.uploader.destroy(public_id)

        # Cloudinary 返回 "ok" 或 "not found"
        if result.get("result") == "ok":
            logger.info(f"圖片刪除成功: {public_id}")
            return True
        elif result.get("result") == "not found":
            logger.warning(f"圖片不存在: {public_id}")
            return False
        else:
            logger.error(f"圖片刪除失敗: {public_id}, result: {result}")
            return False

    except CloudinaryError as e:
        logger.error(f"Cloudinary 刪除失敗: {e}")
        return False

    except Exception as e:
        logger.error(f"圖片刪除過程發生錯誤: {e}")
        return False


def get_optimized_url(public_id: str, width: int = 400, height: int = 400) -> str:
    """
    取得優化後的圖片 URL

    Args:
        public_id: Cloudinary public_id
        width: 目標寬度（預設 400）
        height: 目標高度（預設 400）

    Returns:
        str: 優化後的圖片 URL

    Examples:
        >>> url = get_optimized_url("food_items/abc123", width=200, height=200)
        >>> print(url)
        "https://res.cloudinary.com/.../w_200,h_200,c_fill,q_auto,f_auto/food_items/abc123"
    """
    try:
        url = cloudinary.CloudinaryImage(public_id).build_url(
            width=width,
            height=height,
            crop="fill",
            quality="auto",
            fetch_format="auto",
        )
        return url
    except Exception as e:
        logger.error(f"產生優化 URL 失敗: {e}")
        # 返回原始 URL
        return f"https://res.cloudinary.com/{settings.CLOUDINARY_CLOUD_NAME}/image/upload/{public_id}"
