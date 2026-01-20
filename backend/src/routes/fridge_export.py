"""
冰箱匯出/匯入 API 路由

提供冰箱資料的匯出和匯入功能。
"""

import logging
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, status, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from src.models.user import User
from src.models.fridge import Fridge, FridgeCompartment
from src.models.food_item import FoodItem
from src.models.fridge_member import FridgeMember
from src.routes.dependencies import DBSession, CurrentUserId
from src.routes.fridge_members import require_fridge_permission

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/fridges", tags=["Fridge Export/Import"])


# ============ Pydantic Schemas ============

class FoodItemExport(BaseModel):
    name: str
    quantity: int
    unit: Optional[str]
    category: Optional[str]
    storage_type: str
    compartment_name: Optional[str]
    expiry_date: Optional[str]
    purchase_date: Optional[str]
    price: Optional[float]
    image_url: Optional[str]


class CompartmentExport(BaseModel):
    name: str
    parent_type: str
    capacity_liters: Optional[float]


class FridgeExportData(BaseModel):
    version: str = "1.0"
    exported_at: str
    fridge: dict
    compartments: List[CompartmentExport]
    food_items: List[FoodItemExport]


class ImportOptions(BaseModel):
    clear_existing: bool = False  # 是否清除現有食材


# ============ API Endpoints ============

@router.get(
    "/{fridge_id}/export",
    response_model=FridgeExportData,
    summary="匯出冰箱資料"
)
async def export_fridge(
    fridge_id: int,
    db: DBSession,
    user_id: CurrentUserId,
):
    """
    匯出冰箱資料為 JSON 格式
    
    包含：冰箱設定、分區、所有食材
    權限：viewer, editor, owner 皆可匯出
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="使用者不存在")
    
    # 檢查權限（viewer 也可以匯出）
    require_fridge_permission(db, fridge_id, user_id, "viewer")
    
    # 取得冰箱
    fridge = db.query(Fridge).filter(Fridge.id == fridge_id).first()
    if not fridge:
        raise HTTPException(status_code=404, detail="冰箱不存在")
    
    # 取得分區
    compartments = db.query(FridgeCompartment).filter(
        FridgeCompartment.fridge_id == fridge_id
    ).all()
    
    # 取得食材
    food_items = db.query(FoodItem).filter(
        FoodItem.fridge_id == fridge_id
    ).all()
    
    # 建立分區名稱對照表
    compartment_map = {c.id: c.name for c in compartments}
    
    # 轉換為匯出格式
    export_data = FridgeExportData(
        version="1.0",
        exported_at=datetime.utcnow().isoformat() + "Z",
        fridge={
            "model_name": fridge.model_name,
            "total_capacity_liters": fridge.total_capacity_liters,
        },
        compartments=[
            CompartmentExport(
                name=c.name,
                parent_type=c.parent_type,
                capacity_liters=c.capacity_liters,
            )
            for c in compartments
        ],
        food_items=[
            FoodItemExport(
                name=item.name,
                quantity=item.quantity,
                unit=item.unit,
                category=item.category,
                storage_type=item.storage_type,
                compartment_name=compartment_map.get(item.compartment_id) if item.compartment_id else None,
                expiry_date=item.expiry_date.isoformat() if item.expiry_date else None,
                purchase_date=item.purchase_date.isoformat() if item.purchase_date else None,
                price=item.price,
                image_url=item.image_url,
            )
            for item in food_items
        ],
    )
    
    logger.info(f"冰箱 {fridge_id} 匯出成功，共 {len(food_items)} 項食材")
    
    return export_data


@router.post(
    "/{fridge_id}/import",
    summary="匯入冰箱資料"
)
async def import_fridge(
    fridge_id: int,
    import_data: FridgeExportData,
    db: DBSession,
    user_id: CurrentUserId,
    clear_existing: bool = False,
):
    """
    匯入冰箱資料
    
    - clear_existing=True: 清除現有食材後匯入
    - clear_existing=False: 合併匯入（新增到現有食材）
    
    權限：editor, owner 可匯入
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="使用者不存在")
    
    # 檢查權限（需要 editor 以上）
    require_fridge_permission(db, fridge_id, user_id, "editor")
    
    # 取得冰箱
    fridge = db.query(Fridge).filter(Fridge.id == fridge_id).first()
    if not fridge:
        raise HTTPException(status_code=404, detail="冰箱不存在")
    
    try:
        # 如果要清除現有食材
        if clear_existing:
            db.query(FoodItem).filter(FoodItem.fridge_id == fridge_id).delete()
            logger.info(f"冰箱 {fridge_id} 現有食材已清除")
        
        # 取得分區對照表（名稱 -> ID）
        compartments = db.query(FridgeCompartment).filter(
            FridgeCompartment.fridge_id == fridge_id
        ).all()
        compartment_map = {c.name: c.id for c in compartments}
        
        # 匯入食材
        imported_count = 0
        for item_data in import_data.food_items:
            # 解析日期
            expiry_date = None
            if item_data.expiry_date:
                try:
                    expiry_date = datetime.fromisoformat(item_data.expiry_date.replace("Z", "")).date()
                except ValueError:
                    pass
            
            purchase_date = None
            if item_data.purchase_date:
                try:
                    purchase_date = datetime.fromisoformat(item_data.purchase_date.replace("Z", "")).date()
                except ValueError:
                    pass
            
            # 解析分區
            compartment_id = None
            if item_data.compartment_name and item_data.compartment_name in compartment_map:
                compartment_id = compartment_map[item_data.compartment_name]
            
            # 建立食材
            food_item = FoodItem(
                fridge_id=fridge_id,
                name=item_data.name,
                quantity=item_data.quantity,
                unit=item_data.unit,
                category=item_data.category,
                storage_type=item_data.storage_type,
                compartment_id=compartment_id,
                expiry_date=expiry_date,
                purchase_date=purchase_date,
                price=item_data.price,
                image_url=item_data.image_url,
            )
            
            db.add(food_item)
            imported_count += 1
        
        db.commit()
        
        logger.info(f"冰箱 {fridge_id} 匯入成功，共 {imported_count} 項食材")
        
        return {
            "message": "匯入成功",
            "imported_count": imported_count,
            "cleared_existing": clear_existing,
        }
    
    except Exception as e:
        db.rollback()
        logger.error(f"冰箱 {fridge_id} 匯入失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"匯入失敗: {str(e)}"
        )
