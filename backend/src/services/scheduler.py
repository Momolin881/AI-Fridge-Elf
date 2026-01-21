"""
排程器服務模組

使用 APScheduler 管理定時任務，包含效期提醒和空間警告。
"""

import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import func

from src.database import SessionLocal
from src.models.notification_settings import NotificationSettings
from src.models.food_item import FoodItem
from src.models.fridge import Fridge, FridgeCompartment
from src.services.line_bot import send_expiry_notification, send_space_warning

logger = logging.getLogger(__name__)

# 台灣時區
TAIWAN_TZ = ZoneInfo("Asia/Taipei")

# 建立背景排程器（使用台灣時區）
scheduler = BackgroundScheduler(timezone=TAIWAN_TZ)


def start_scheduler():
    """
    啟動排程器並註冊所有定時任務
    """
    if scheduler.running:
        logger.warning("排程器已經在運行中")
        return

    try:
        # 註冊每日任務：檢查即將過期食材（每天早上 9:00 執行）
        scheduler.add_job(
            check_expiring_items,
            trigger=CronTrigger(hour=9, minute=0),
            id="check_expiring_items",
            name="檢查即將過期食材",
            replace_existing=True
        )

        # 註冊每日任務：檢查空間使用率（每天早上 9:00 執行）
        scheduler.add_job(
            check_space_usage,
            trigger=CronTrigger(hour=9, minute=0),
            id="check_space_usage",
            name="檢查冰箱空間使用率",
            replace_existing=True
        )

        scheduler.start()
        logger.info("排程器已啟動，已註冊 2 個定時任務")

    except Exception as e:
        logger.error(f"啟動排程器失敗: {e}")
        raise


def stop_scheduler():
    """
    停止排程器
    """
    if not scheduler.running:
        logger.warning("排程器未運行")
        return

    try:
        scheduler.shutdown(wait=True)
        logger.info("排程器已停止")

    except Exception as e:
        logger.error(f"停止排程器失敗: {e}")
        raise


def check_expiring_items():
    """
    檢查所有使用者的即將過期食材並發送通知

    遍歷所有啟用效期提醒的使用者，檢查其食材是否即將過期。
    """
    logger.info("開始執行：檢查即將過期食材")
    db = SessionLocal()

    try:
        # 查詢所有啟用效期提醒的通知設定
        settings_list = db.query(NotificationSettings).filter(
            NotificationSettings.expiry_warning_enabled == True
        ).all()

        logger.info(f"找到 {len(settings_list)} 位使用者啟用效期提醒")

        for settings in settings_list:
            try:
                # 使用台灣時間計算提醒日期
                today_taiwan = datetime.now(TAIWAN_TZ).date()
                warning_date = today_taiwan + timedelta(days=settings.expiry_warning_days)

                # 查詢該使用者即將過期或已過期的食材
                expiring_items = db.query(FoodItem).join(
                    Fridge, FoodItem.fridge_id == Fridge.id
                ).filter(
                    Fridge.user_id == settings.user_id,
                    FoodItem.expiry_date.isnot(None),
                    FoodItem.expiry_date <= warning_date,
                    FoodItem.status == 'active'  # 只查詢未處理的食材
                ).all()

                if expiring_items:
                    # 準備通知資料
                    items_data = []
                    for item in expiring_items:
                        days_remaining = (item.expiry_date - today_taiwan).days
                        items_data.append({
                            "name": item.name,
                            "expiry_date": item.expiry_date.isoformat(),
                            "days_remaining": days_remaining
                        })

                    # 發送通知
                    logger.info(f"使用者 {settings.user_id} 有 {len(items_data)} 項食材即將過期")
                    send_expiry_notification(settings.user.line_user_id, items_data)

            except Exception as e:
                logger.error(f"處理使用者 {settings.user_id} 的效期提醒時發生錯誤: {e}")
                continue

        logger.info("完成：檢查即將過期食材")

    except Exception as e:
        logger.error(f"檢查即將過期食材時發生錯誤: {e}")

    finally:
        db.close()


def check_space_usage():
    """
    檢查所有使用者的冰箱空間使用率並發送警告

    遍歷所有啟用空間提醒的使用者，檢查其冰箱空間使用率。
    """
    logger.info("開始執行：檢查冰箱空間使用率")
    db = SessionLocal()

    try:
        # 查詢所有啟用空間提醒的通知設定
        settings_list = db.query(NotificationSettings).filter(
            NotificationSettings.space_warning_enabled == True
        ).all()

        logger.info(f"找到 {len(settings_list)} 位使用者啟用空間提醒")

        for settings in settings_list:
            try:
                # 查詢該使用者的所有冰箱
                fridges = db.query(Fridge).filter(
                    Fridge.user_id == settings.user_id
                ).all()

                for fridge in fridges:
                    # 計算總容量和已使用容量
                    compartments = db.query(FridgeCompartment).filter(
                        FridgeCompartment.fridge_id == fridge.id
                    ).all()

                    total_capacity = sum(c.total_slots for c in compartments)
                    if total_capacity == 0:
                        continue

                    # 計算已使用的格子數
                    used_slots = db.query(func.count(FoodItem.id)).filter(
                        FoodItem.fridge_id == fridge.id
                    ).scalar()

                    # 計算使用率
                    usage_percentage = (used_slots / total_capacity) * 100

                    # 如果超過門檻，發送警告
                    if usage_percentage >= settings.space_warning_threshold:
                        logger.info(
                            f"冰箱 {fridge.id} 空間使用率 {usage_percentage:.1f}% "
                            f"超過門檻 {settings.space_warning_threshold}%"
                        )
                        send_space_warning(settings.user.line_user_id, usage_percentage)

            except Exception as e:
                logger.error(f"處理使用者 {settings.user_id} 的空間提醒時發生錯誤: {e}")
                continue

        logger.info("完成：檢查冰箱空間使用率")

    except Exception as e:
        logger.error(f"檢查冰箱空間使用率時發生錯誤: {e}")

    finally:
        db.close()
