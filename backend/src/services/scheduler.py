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
from src.services.line_bot import send_expiry_notification, send_space_warning, LineBot
from src.services.monthly_stats_service import MonthlyStatsService

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
        # 註冊每日任務：檢查即將過期食材（每天早上 9:00 台灣時間執行）
        scheduler.add_job(
            check_expiring_items,
            trigger=CronTrigger(hour=9, minute=0, timezone=TAIWAN_TZ),
            id="check_expiring_items",
            name="檢查即將過期食材",
            replace_existing=True
        )

        # 註冊每日任務：檢查空間使用率（每天早上 9:00 台灣時間執行）
        scheduler.add_job(
            check_space_usage,
            trigger=CronTrigger(hour=9, minute=0, timezone=TAIWAN_TZ),
            id="check_space_usage",
            name="檢查冰箱空間使用率",
            replace_existing=True
        )

        # 註冊每月任務：發送月度省錢統計（每月 1 號早上 10:00 台灣時間執行）
        scheduler.add_job(
            send_monthly_stats_to_all_users,
            trigger=CronTrigger(day=1, hour=10, minute=0, timezone=TAIWAN_TZ),
            id="send_monthly_stats",
            name="發送月度省錢統計",
            replace_existing=True
        )

        scheduler.start()
        logger.info("排程器已啟動，已註冊 3 個定時任務")

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
    使用食材數量來估算空間使用率（假設每個冰箱最多存放 50 項食材）。
    """
    logger.info("開始執行：檢查冰箱空間使用率")
    db = SessionLocal()

    # 預設每個冰箱的最大食材數量（用於估算使用率）
    DEFAULT_MAX_ITEMS = 50

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
                    # 計算已存放的食材數量（只計算 active 狀態）
                    item_count = db.query(func.count(FoodItem.id)).filter(
                        FoodItem.fridge_id == fridge.id,
                        FoodItem.status == 'active'
                    ).scalar()

                    # 計算使用率（以食材數量估算）
                    usage_percentage = (item_count / DEFAULT_MAX_ITEMS) * 100

                    # 如果超過門檻，發送警告
                    if usage_percentage >= settings.space_warning_threshold:
                        logger.info(
                            f"冰箱 {fridge.id} 空間使用率 {usage_percentage:.1f}% "
                            f"({item_count}/{DEFAULT_MAX_ITEMS} 項) "
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


def send_monthly_stats_to_all_users():
    """
    發送月度統計給所有用戶
    
    遍歷所有有冰箱的用戶，計算月度統計並發送 LINE 推播通知。
    """
    logger.info("開始執行：發送月度省錢統計")
    
    try:
        # 獲取所有用戶的月度統計
        all_stats = MonthlyStatsService.get_all_users_monthly_stats()
        
        if not all_stats:
            logger.info("沒有用戶需要發送月度統計")
            return
        
        logger.info(f"找到 {len(all_stats)} 位用戶需要發送月度統計")
        
        # 初始化 LINE Bot
        line_bot = LineBot()
        
        success_count = 0
        for stats in all_stats:
            try:
                user_id = stats['user_id']
                
                # 發送月度統計通知
                success = line_bot.send_monthly_stats_notification(user_id, stats)
                
                if success:
                    success_count += 1
                    logger.info(f"月度統計推播發送成功 (user_id: {user_id})")
                else:
                    logger.error(f"月度統計推播發送失敗 (user_id: {user_id})")
                    
            except Exception as e:
                logger.error(f"處理用戶 {user_id} 的月度統計推播時發生錯誤: {e}")
                continue
        
        logger.info(f"完成：發送月度省錢統計，成功 {success_count}/{len(all_stats)} 位用戶")
        
    except Exception as e:
        logger.error(f"發送月度統計時發生錯誤: {e}")
