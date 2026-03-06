"""
排程器服務模組

使用 APScheduler 管理定時任務，包含效期提醒和空間警告。
"""

import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import func, or_
from sqlalchemy.orm import joinedload

from src.database import SessionLocal
from src.models.notification_settings import NotificationSettings
from src.models.food_item import FoodItem
from src.models.fridge import Fridge, FridgeCompartment
from src.models.fridge_member import FridgeMember
from src.services.line_bot import send_expiry_notification, send_space_warning, LineBot
from src.services.monthly_stats_service import MonthlyStatsService
from src.services.weekly_stats_service import generate_weekly_report_message

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

        # 註冊週報任務：發送週統計報告（每週日早上 9:30 台灣時間執行）
        scheduler.add_job(
            send_weekly_reports_to_all_users,
            trigger=CronTrigger(day_of_week=6, hour=9, minute=30, timezone=TAIWAN_TZ),  # 6=週日
            id="send_weekly_reports", 
            name="發送週統計報告",
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
        logger.info("排程器已啟動，已註冊 4 個定時任務")

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
        # 自動為沒有通知設定的使用者建立預設設定
        from src.models.user import User
        users_without_settings = db.query(User).outerjoin(
            NotificationSettings, User.id == NotificationSettings.user_id
        ).filter(NotificationSettings.id.is_(None)).all()

        if users_without_settings:
            logger.info(f"為 {len(users_without_settings)} 位使用者建立預設通知設定")
            for user in users_without_settings:
                default_settings = NotificationSettings(user_id=user.id)
                db.add(default_settings)
            db.commit()

        # 查詢所有啟用效期提醒的通知設定（eager load user 以避免 lazy loading 問題）
        settings_list = db.query(NotificationSettings).options(
            joinedload(NotificationSettings.user)
        ).filter(
            NotificationSettings.expiry_warning_enabled == True
        ).all()

        logger.info(f"找到 {len(settings_list)} 位使用者啟用效期提醒")

        for settings in settings_list:
            try:
                # 使用台灣時間計算提醒日期
                today_taiwan = datetime.now(TAIWAN_TZ).date()
                warning_date = today_taiwan + timedelta(days=settings.expiry_warning_days)

                # 查詢該使用者可存取的所有冰箱 ID（自有 + 共享）
                owned_fridge_ids = db.query(Fridge.id).filter(
                    Fridge.user_id == settings.user_id
                )
                member_fridge_ids = db.query(FridgeMember.fridge_id).filter(
                    FridgeMember.user_id == settings.user_id
                )
                accessible_fridge_ids = owned_fridge_ids.union(member_fridge_ids).subquery()

                # 查詢即將過期或已過期的食材（包含自有和共享冰箱）
                expiring_items = db.query(FoodItem).filter(
                    FoodItem.fridge_id.in_(
                        db.query(accessible_fridge_ids.c.id)
                    ),
                    FoodItem.expiry_date.isnot(None),
                    FoodItem.expiry_date <= warning_date,
                    FoodItem.status == 'active'  # 只查詢未處理的食材
                ).all()

                if expiring_items:
                    # 檢查 user 是否存在
                    if not settings.user:
                        logger.error(f"使用者 {settings.user_id} 的 User 記錄不存在，跳過通知")
                        continue
                    
                    if not settings.user.line_user_id:
                        logger.error(f"使用者 {settings.user_id} 沒有 LINE User ID，跳過通知")
                        continue

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
                    line_user_id = settings.user.line_user_id
                    logger.info(
                        f"使用者 {settings.user_id} (LINE: {line_user_id}) "
                        f"有 {len(items_data)} 項食材即將過期，準備發送通知"
                    )
                    success = send_expiry_notification(line_user_id, items_data)
                    if success:
                        logger.info(f"使用者 {settings.user_id} 的效期通知發送成功")
                    else:
                        logger.error(f"使用者 {settings.user_id} 的效期通知發送失敗")

            except Exception as e:
                logger.error(f"處理使用者 {settings.user_id} 的效期提醒時發生錯誤: {e}", exc_info=True)
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
        # 查詢所有啟用空間提醒的通知設定（eager load user 以避免 lazy loading 問題）
        settings_list = db.query(NotificationSettings).options(
            joinedload(NotificationSettings.user)
        ).filter(
            NotificationSettings.space_warning_enabled == True
        ).all()

        logger.info(f"找到 {len(settings_list)} 位使用者啟用空間提醒")

        for settings in settings_list:
            try:
                # 查詢該使用者可存取的所有冰箱（自有 + 共享）
                owned_fridges = db.query(Fridge).filter(
                    Fridge.user_id == settings.user_id
                ).all()
                
                member_fridge_ids = db.query(FridgeMember.fridge_id).filter(
                    FridgeMember.user_id == settings.user_id
                ).all()
                member_fridge_id_list = [fid for (fid,) in member_fridge_ids]
                
                shared_fridges = db.query(Fridge).filter(
                    Fridge.id.in_(member_fridge_id_list)
                ).all() if member_fridge_id_list else []
                
                # 合併去重
                all_fridges = {f.id: f for f in owned_fridges}
                for f in shared_fridges:
                    all_fridges[f.id] = f

                for fridge in all_fridges.values():
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


def send_weekly_reports_to_all_users():
    """
    發送週報給所有啟用週報的用戶
    
    遍歷所有啟用週報的用戶，根據其頻率設定決定是否發送週報。
    """
    logger.info("開始執行：發送週統計報告")
    db = SessionLocal()
    
    try:
        # 查詢所有啟用週報的通知設定（eager load user 以避免 lazy loading 問題）
        settings_list = db.query(NotificationSettings).options(
            joinedload(NotificationSettings.user)
        ).filter(
            NotificationSettings.weekly_report_enabled == True
        ).all()
        
        if not settings_list:
            logger.info("沒有用戶啟用週報")
            return
            
        logger.info(f"找到 {len(settings_list)} 位用戶啟用週報")
        
        # 初始化 LINE Bot
        line_bot = LineBot()
        
        success_count = 0
        today_taiwan = datetime.now(TAIWAN_TZ).date()
        iso_week = today_taiwan.isocalendar()[1]  # ISO 週數
        
        for settings in settings_list:
            try:
                user_id = settings.user_id
                
                # 根據頻率設定決定是否發送
                frequency = settings.weekly_report_frequency
                logger.info(f"用戶 {user_id} 的週報頻率設定: {frequency}")
                
                if frequency == "biweekly" and iso_week % 2 != 0:
                    # 雙週發送：只在偶數 ISO 週發送
                    logger.info(f"用戶 {user_id} 設定雙週發送，本週(第{iso_week}週)為奇數週，跳過")
                    continue
                elif frequency == "monthly" and today_taiwan.day > 7:
                    # 每月發送：只在每月第一個週日發送（日期 <= 7）
                    logger.info(f"用戶 {user_id} 設定每月發送，本週非當月第一個週日，跳過")
                    continue
                
                # 生成週報訊息
                weekly_message = generate_weekly_report_message(user_id, db)
                
                if weekly_message:
                    # 發送週報通知
                    success = line_bot.send_text_message(settings.user.line_user_id, weekly_message)
                    
                    if success:
                        success_count += 1
                        logger.info(f"週報推播發送成功 (user_id: {user_id})")
                    else:
                        logger.error(f"週報推播發送失敗 (user_id: {user_id})")
                else:
                    logger.info(f"用戶 {user_id} 本週無數據，跳過發送")
                    
            except Exception as e:
                logger.error(f"處理用戶 {user_id} 的週報推播時發生錯誤: {e}")
                continue
        
        logger.info(f"完成：發送週統計報告，成功 {success_count}/{len(settings_list)} 位用戶")
        
    except Exception as e:
        logger.error(f"發送週報時發生錯誤: {e}")
    
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
