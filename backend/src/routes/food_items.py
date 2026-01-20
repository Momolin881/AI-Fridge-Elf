"""
食材管理 API 路由

提供食材的 CRUD 操作和 AI 辨識功能。
"""

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session

from src.models.food_item import FoodItem
from src.models.fridge import Fridge
from src.schemas.food_item import (
    FoodItemCreate,
    FoodItemUpdate,
    FoodItemResponse,
    AIRecognitionResponse,
)
from src.routes.dependencies import DBSession, CurrentUserId
from src.services import ai_vision, storage

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Food Items"])


def _build_food_item_response(item: FoodItem) -> FoodItemResponse:
    """將 FoodItem ORM 物件轉換為 FoodItemResponse"""
    return FoodItemResponse(
        id=item.id,
        fridge_id=item.fridge_id,
        compartment_id=item.compartment_id,
        compartment=item.compartment.name if item.compartment else None,
        name=item.name,
        category=item.category,
        quantity=item.quantity,
        unit=item.unit,
        expiry_date=item.expiry_date,
        purchase_date=item.purchase_date,
        price=item.price,
        volume_liters=item.volume_liters,
        storage_type=item.storage_type,
        image_url=item.image_url,
        cloudinary_public_id=item.cloudinary_public_id,
        recognized_by_ai=item.recognized_by_ai,
        created_at=item.created_at,
        updated_at=item.updated_at,
        status=item.status or 'active',
        archived_at=item.archived_at,
        archived_by=item.archived_by,
        is_expired=item.is_expired,
        days_until_expiry=item.days_until_expiry,
    )


@router.get("/food-items", response_model=list[FoodItemResponse])
async def list_food_items(
    db: DBSession,
    user_id: CurrentUserId,
    compartment: Optional[str] = None,
    is_expired: Optional[bool] = None,
    status: Optional[str] = 'active',  # active / archived / all
):
    """
    列出使用者的所有食材

    Query 參數:
    - compartment: 篩選分區（如「冷藏」、「冷凍」或分區名稱）
    - is_expired: 篩選是否過期（true/false）
    - status: 篩選狀態（active: 進行中, archived: 已處理, all: 全部）
    """
    # 查詢使用者的所有食材
    query = (
        db.query(FoodItem)
        .join(Fridge, FoodItem.fridge_id == Fridge.id)
        .filter(Fridge.user_id == user_id)
    )

    # 篩選狀態
    if status and status != 'all':
        query = query.filter(FoodItem.status == status)

    # 篩選條件
    if compartment:
        if compartment in ["冷藏", "冷凍"]:
            query = query.filter(FoodItem.storage_type == compartment)
        # 若指定分區名稱，可擴充篩選邏輯

    # 取得所有食材
    food_items = query.all()

    # 篩選過期狀態
    if is_expired is not None:
        food_items = [item for item in food_items if item.is_expired == is_expired]

    # 組裝回應（包含計算屬性和分區名稱）
    return [_build_food_item_response(item) for item in food_items]


@router.get("/food-items/{id}", response_model=FoodItemResponse)
async def get_food_item(id: int, db: DBSession, user_id: CurrentUserId):
    """取得單一食材"""
    # 查詢食材
    food_item = (
        db.query(FoodItem)
        .join(Fridge, FoodItem.fridge_id == Fridge.id)
        .filter(FoodItem.id == id, Fridge.user_id == user_id)
        .first()
    )

    if not food_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="食材不存在或無權限存取"
        )

    return _build_food_item_response(food_item)


@router.post("/food-items", response_model=FoodItemResponse, status_code=status.HTTP_201_CREATED)
async def create_food_item(data: FoodItemCreate, db: DBSession, user_id: CurrentUserId):
    """新增食材"""
    # 驗證冰箱所有權
    fridge = db.query(Fridge).filter(
        Fridge.id == data.fridge_id, Fridge.user_id == user_id
    ).first()

    if not fridge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="冰箱不存在或無權限存取"
        )

    # 建立食材
    food_item = FoodItem(**data.model_dump())
    db.add(food_item)
    db.commit()
    db.refresh(food_item)

    logger.info(f"使用者 {user_id} 新增食材: {food_item.name} (ID: {food_item.id})")

    return _build_food_item_response(food_item)


@router.put("/food-items/{id}", response_model=FoodItemResponse)
async def update_food_item(id: int, data: FoodItemUpdate, db: DBSession, user_id: CurrentUserId):
    """更新食材"""
    # 查詢食材
    food_item = (
        db.query(FoodItem)
        .join(Fridge, FoodItem.fridge_id == Fridge.id)
        .filter(FoodItem.id == id, Fridge.user_id == user_id)
        .first()
    )

    if not food_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="食材不存在或無權限存取"
        )

    # 更新欄位（只更新有提供的欄位）
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(food_item, field, value)

    db.commit()
    db.refresh(food_item)

    logger.info(f"使用者 {user_id} 更新食材: {food_item.name} (ID: {food_item.id})")

    return _build_food_item_response(food_item)


@router.delete("/food-items/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_food_item(id: int, db: DBSession, user_id: CurrentUserId):
    """刪除食材"""
    # 查詢食材
    food_item = (
        db.query(FoodItem)
        .join(Fridge, FoodItem.fridge_id == Fridge.id)
        .filter(FoodItem.id == id, Fridge.user_id == user_id)
        .first()
    )

    if not food_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="食材不存在或無權限存取"
        )

    # 刪除 Cloudinary 圖片（如果有）
    if food_item.cloudinary_public_id:
        try:
            storage.delete_image(food_item.cloudinary_public_id)
        except Exception as e:
            logger.warning(f"刪除 Cloudinary 圖片失敗: {e}")

    # 刪除食材
    db.delete(food_item)
    db.commit()

    logger.info(f"使用者 {user_id} 刪除食材: {food_item.name} (ID: {food_item.id})")


@router.post("/food-items/{id}/archive", response_model=FoodItemResponse)
async def archive_food_item(id: int, db: DBSession, user_id: CurrentUserId):
    """
    封存食材（標記為已處理）

    將食材從冰箱清單移除，進入「已處理」歷史紀錄。
    記錄處理時間和處理人。
    """
    # 查詢食材
    food_item = (
        db.query(FoodItem)
        .join(Fridge, FoodItem.fridge_id == Fridge.id)
        .filter(FoodItem.id == id, Fridge.user_id == user_id)
        .first()
    )

    if not food_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="食材不存在或無權限存取"
        )

    if food_item.status == 'archived':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="此食材已被處理"
        )

    # 更新狀態
    food_item.status = 'archived'
    food_item.archived_at = datetime.utcnow()
    food_item.archived_by = user_id

    db.commit()
    db.refresh(food_item)

    logger.info(f"使用者 {user_id} 封存食材: {food_item.name} (ID: {food_item.id})")

    return _build_food_item_response(food_item)


@router.post("/food-items/recognize", response_model=AIRecognitionResponse)
async def recognize_food_item(
    db: DBSession,
    user_id: CurrentUserId,
    fridge_id: int = Form(...),
    storage_type: str = Form(...),
    compartment_id: Optional[int] = Form(None),
    image: UploadFile = File(...),
):
    """
    AI 辨識食材圖片

    接收 multipart/form-data:
    - fridge_id: 冰箱 ID
    - storage_type: 儲存類型（「冷藏」或「冷凍」）
    - compartment_id: 分區 ID（可選）
    - image: 圖片檔案
    """
    # 驗證 storage_type
    if storage_type not in ["冷藏", "冷凍"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="storage_type 必須是「冷藏」或「冷凍」",
        )

    # 驗證冰箱所有權
    fridge = db.query(Fridge).filter(
        Fridge.id == fridge_id, Fridge.user_id == user_id
    ).first()

    if not fridge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="冰箱不存在或無權限存取"
        )

    # 驗證圖片格式
    if not image.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="檔案必須是圖片格式"
        )

    try:
        # 讀取圖片
        image_bytes = await image.read()

        # 上傳至 Cloudinary
        upload_result = storage.upload_image(image_bytes, folder="food_items")

        # AI 辨識
        ai_result = ai_vision.recognize_food_item(image_bytes)

        # 計算效期
        expiry_date = ai_vision.calculate_expiry_date(ai_result["expiry_days"])

        # 組裝回應
        response = AIRecognitionResponse(
            name=ai_result["name"],
            category=ai_result.get("category"),
            quantity=ai_result.get("quantity", 1),
            unit=ai_result.get("unit"),
            expiry_date=expiry_date,
            storage_type=storage_type,
            image_url=upload_result["url"],
            cloudinary_public_id=upload_result["public_id"],
        )

        logger.info(f"使用者 {user_id} AI 辨識食材成功: {response.name}")
        return response

    except Exception as e:
        logger.error(f"AI 辨識失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI 辨識失敗: {str(e)}",
        ) from e
