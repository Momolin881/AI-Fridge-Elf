"""
冰箱管理 API 路由

提供冰箱和分區的 CRUD 操作。
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.models.fridge import Fridge, FridgeCompartment
from src.schemas.fridge import (
    FridgeCreate,
    FridgeUpdate,
    FridgeResponse,
    FridgeDetailResponse,
    FridgeCompartmentCreate,
    FridgeCompartmentResponse,
)
from src.routes.dependencies import DBSession, CurrentUserId

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Fridges"])


@router.get("/fridges", response_model=list[FridgeResponse])
async def list_fridges(db: DBSession, user_id: CurrentUserId):
    """取得使用者的所有冰箱"""
    fridges = db.query(Fridge).filter(Fridge.user_id == user_id).all()

    # 為每個冰箱計算 compartment_mode
    result = []
    for fridge in fridges:
        fridge_dict = {
            "id": fridge.id,
            "user_id": fridge.user_id,
            "model_name": fridge.model_name,
            "total_capacity_liters": fridge.total_capacity_liters,
            "created_at": fridge.created_at,
            "updated_at": fridge.updated_at,
            "compartment_mode": "detailed" if len(fridge.compartments) > 0 else "simple",
        }
        result.append(fridge_dict)

    return result


@router.post("/fridges", response_model=FridgeResponse, status_code=status.HTTP_201_CREATED)
async def create_fridge(data: FridgeCreate, db: DBSession, user_id: CurrentUserId):
    """新增冰箱"""
    # 建立冰箱
    fridge = Fridge(user_id=user_id, **data.model_dump())
    db.add(fridge)
    db.commit()
    db.refresh(fridge)

    logger.info(f"使用者 {user_id} 新增冰箱 (ID: {fridge.id})")

    # 返回包含 compartment_mode 的結果
    return {
        "id": fridge.id,
        "user_id": fridge.user_id,
        "model_name": fridge.model_name,
        "total_capacity_liters": fridge.total_capacity_liters,
        "created_at": fridge.created_at,
        "updated_at": fridge.updated_at,
        "compartment_mode": "detailed" if len(fridge.compartments) > 0 else "simple",
    }


@router.get("/fridges/{id}", response_model=FridgeDetailResponse)
async def get_fridge(id: int, db: DBSession, user_id: CurrentUserId):
    """取得單一冰箱（含分區）"""
    # 查詢冰箱
    fridge = db.query(Fridge).filter(Fridge.id == id, Fridge.user_id == user_id).first()

    if not fridge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="冰箱不存在或無權限存取"
        )

    # 查詢分區並按 sort_order 排序
    compartments = db.query(FridgeCompartment).filter(
        FridgeCompartment.fridge_id == id
    ).order_by(FridgeCompartment.sort_order, FridgeCompartment.created_at).all()

    # 返回包含 compartment_mode 的結果
    return {
        "id": fridge.id,
        "user_id": fridge.user_id,
        "model_name": fridge.model_name,
        "total_capacity_liters": fridge.total_capacity_liters,
        "created_at": fridge.created_at,
        "updated_at": fridge.updated_at,
        "compartment_mode": "detailed" if len(compartments) > 0 else "simple",
        "compartments": compartments,
    }


@router.put("/fridges/{id}", response_model=FridgeResponse)
async def update_fridge(id: int, data: FridgeUpdate, db: DBSession, user_id: CurrentUserId):
    """更新冰箱"""
    # 查詢冰箱
    fridge = db.query(Fridge).filter(Fridge.id == id, Fridge.user_id == user_id).first()

    if not fridge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="冰箱不存在或無權限存取"
        )

    # 更新欄位（只更新有提供的欄位）
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(fridge, field, value)

    db.commit()
    db.refresh(fridge)

    logger.info(f"使用者 {user_id} 更新冰箱 (ID: {fridge.id})")

    # 返回包含 compartment_mode 的結果
    return {
        "id": fridge.id,
        "user_id": fridge.user_id,
        "model_name": fridge.model_name,
        "total_capacity_liters": fridge.total_capacity_liters,
        "created_at": fridge.created_at,
        "updated_at": fridge.updated_at,
        "compartment_mode": "detailed" if len(fridge.compartments) > 0 else "simple",
    }


@router.post("/fridges/{id}/compartments", response_model=FridgeCompartmentResponse, status_code=status.HTTP_201_CREATED)
async def create_compartment(id: int, data: FridgeCompartmentCreate, db: DBSession, user_id: CurrentUserId):
    """新增分區"""
    # 驗證冰箱所有權
    fridge = db.query(Fridge).filter(Fridge.id == id, Fridge.user_id == user_id).first()

    if not fridge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="冰箱不存在或無權限存取"
        )

    # 建立分區
    compartment = FridgeCompartment(fridge_id=id, **data.model_dump())
    db.add(compartment)
    db.commit()
    db.refresh(compartment)

    logger.info(f"使用者 {user_id} 在冰箱 {id} 新增分區: {compartment.name} (ID: {compartment.id})")
    return compartment


@router.put("/fridges/{id}/compartments/reorder", status_code=status.HTTP_200_OK)
async def reorder_compartments(id: int, compartment_orders: list[dict], db: DBSession, user_id: CurrentUserId):
    """重新排序分區"""
    # 驗證冰箱所有權
    fridge = db.query(Fridge).filter(Fridge.id == id, Fridge.user_id == user_id).first()

    if not fridge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="冰箱不存在或無權限存取"
        )

    # 更新分區排序
    try:
        for order_data in compartment_orders:
            compartment_id = order_data.get("id")
            sort_order = order_data.get("sort_order")
            
            if compartment_id is None or sort_order is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, 
                    detail="每個分區必須包含 id 和 sort_order"
                )
            
            # 更新分區排序
            compartment = db.query(FridgeCompartment).filter(
                FridgeCompartment.id == compartment_id,
                FridgeCompartment.fridge_id == id
            ).first()
            
            if compartment:
                compartment.sort_order = sort_order

        db.commit()
        logger.info(f"使用者 {user_id} 重新排序冰箱 {id} 的分區")
        
        return {"message": "分區排序更新成功"}
        
    except Exception as e:
        db.rollback()
        logger.error(f"更新分區排序失敗: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="更新分區排序失敗"
        )
