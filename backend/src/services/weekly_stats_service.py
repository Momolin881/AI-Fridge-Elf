"""
週統計服務模組

計算食材使用效率和週報數據。
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, func

from src.models.food_item import FoodItem
from src.models.fridge import Fridge
from src.models.user import User

logger = logging.getLogger(__name__)


def calculate_weekly_usage_stats(user_id: int, db: Session, weeks_back: int = 0) -> Dict:
    """
    計算指定週的食材使用統計
    
    Args:
        user_id: 使用者 ID
        db: 資料庫 session
        weeks_back: 往前幾週 (0=本週, 1=上週)
    
    Returns:
        週統計數據字典
    """
    try:
        # 計算週的開始和結束時間 (週一到週日)
        today = datetime.now().date()
        days_since_monday = today.weekday()  # 0=週一, 6=週日
        
        # 計算目標週的週一和週日
        target_monday = today - timedelta(days=days_since_monday + (weeks_back * 7))
        target_sunday = target_monday + timedelta(days=6)
        
        logger.info(f"計算週統計: {target_monday} 到 {target_sunday}")
        
        # 查詢該週內被標記為已處理的食材
        archived_items = db.query(FoodItem).join(
            Fridge, FoodItem.fridge_id == Fridge.id
        ).filter(
            and_(
                Fridge.user_id == user_id,
                FoodItem.status == 'archived',
                FoodItem.archived_at >= target_monday,
                FoodItem.archived_at <= target_sunday + timedelta(days=1)  # 包含週日整天
            )
        ).all()
        
        # 統計分類
        total_processed = len(archived_items)
        used_items = [item for item in archived_items if item.disposal_reason == 'used']
        wasted_items = [item for item in archived_items if item.disposal_reason == 'wasted']
        
        used_count = len(used_items)
        wasted_count = len(wasted_items)
        
        # 計算使用效率
        usage_rate = (used_count / total_processed * 100) if total_processed > 0 else 0
        
        # 統計價值
        used_value = sum(item.price or 0 for item in used_items)
        wasted_value = sum(item.price or 0 for item in wasted_items)
        total_value = used_value + wasted_value
        
        # 檢查過期情況 (在效期內使用 vs 過期才處理)
        used_before_expiry = 0
        used_after_expiry = 0
        
        for item in used_items:
            if item.expiry_date and item.archived_at:
                if item.archived_at.date() <= item.expiry_date:
                    used_before_expiry += 1
                else:
                    used_after_expiry += 1
            else:
                # 沒有效期資料，假設正常使用
                used_before_expiry += 1
        
        # 計算在效期內使用率
        timely_usage_rate = (used_before_expiry / used_count * 100) if used_count > 0 else 0
        
        stats = {
            "week_start": target_monday.strftime("%Y-%m-%d"),
            "week_end": target_sunday.strftime("%Y-%m-%d"),
            "total_processed": total_processed,
            "used_count": used_count,
            "wasted_count": wasted_count,
            "usage_rate": round(usage_rate, 1),
            "timely_usage_rate": round(timely_usage_rate, 1),
            "used_before_expiry": used_before_expiry,
            "used_after_expiry": used_after_expiry,
            "used_value": used_value,
            "wasted_value": wasted_value,
            "total_value": total_value,
            "saved_money": used_value  # 成功使用的食材價值 = 省下的錢
        }
        
        logger.info(f"週統計完成: {stats}")
        return stats
        
    except Exception as e:
        logger.error(f"計算週統計失敗: {e}")
        return {
            "week_start": "",
            "week_end": "",
            "total_processed": 0,
            "used_count": 0,
            "wasted_count": 0,
            "usage_rate": 0,
            "timely_usage_rate": 0,
            "used_before_expiry": 0,
            "used_after_expiry": 0,
            "used_value": 0,
            "wasted_value": 0,
            "total_value": 0,
            "saved_money": 0
        }


def is_first_week_user(user_id: int, db: Session) -> bool:
    """
    檢測使用者是否為新手（註冊7天內）
    
    Args:
        user_id: 使用者 ID
        db: 資料庫 session
        
    Returns:
        是否為新手使用者
    """
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return False
            
        # 計算註冊天數
        days_since_register = (datetime.now() - user.created_at).days
        return days_since_register <= 7
        
    except Exception as e:
        logger.error(f"檢測新手狀態失敗 (user_id: {user_id}): {e}")
        return False


def detect_first_week_achievements(user_id: int, stats: Dict, db: Session) -> List[str]:
    """
    檢測新手首週成就
    
    Args:
        user_id: 使用者 ID  
        stats: 週統計數據
        db: 資料庫 session
        
    Returns:
        成就列表
    """
    achievements = []
    
    try:
        # 檢查是否有拍照（有食材記錄）
        if stats["total_processed"] > 0:
            achievements.append("📸 食材管理新星 - 你已經開始省錢之路！")
        
        # 檢查是否有使用食材
        if stats["used_count"] > 0:
            achievements.append("🎯 行動派達人 - 立刻使用食材，零拖延！")
        
        # 檢查使用效率
        if stats["usage_rate"] >= 80:
            achievements.append("⭐ 效率大師 - 使用率超高，太厲害了！")
        elif stats["usage_rate"] >= 50:
            achievements.append("⭐ 效率新手 - 使用率超過一半，很棒的開始！")
        
        # 檢查是否有省錢
        if stats["saved_money"] > 0:
            achievements.append("💰 省錢達人 - 成功避免浪費，為自己加分！")
        
        # 檢查及時使用率
        if stats["timely_usage_rate"] >= 90:
            achievements.append("⏰ 時間管理大師 - 在效期內完美使用！")
        
        # 特殊鼓勵（即使數據不多也給成就感）
        if len(achievements) == 0:
            achievements.append("🌟 勇敢開始者 - 踏出食材管理的第一步就是成功！")
            
    except Exception as e:
        logger.error(f"檢測新手成就失敗 (user_id: {user_id}): {e}")
        achievements = ["🌟 新手冰友 - 歡迎加入AI冰箱精靈大家庭！"]
    
    return achievements


def generate_newbie_celebration_report(user_id: int, stats: Dict, db: Session) -> str:
    """
    生成新手專屬慶祝版週報
    
    Args:
        user_id: 使用者 ID
        stats: 週統計數據  
        db: 資料庫 session
        
    Returns:
        新手慶祝版週報訊息
    """
    try:
        # 檢測成就
        achievements = detect_first_week_achievements(user_id, stats, db)
        
        # 組成慶祝訊息
        message_parts = [
            "🎊✨ 【新手專屬】首週成就慶典 ✨🎊",
            f"📅 {stats['week_start']} ~ {stats['week_end']}",
            "",
            "🏆 恭喜解鎖以下成就：",
        ]
        
        # 加入成就列表
        for achievement in achievements:
            message_parts.append(f"   {achievement}")
        
        message_parts.extend([
            "",
            "🌟 本週亮點數據：",
        ])
        
        # 根據數據情況調整顯示
        if stats["total_processed"] > 0:
            message_parts.append(f"• 成功管理 {stats['total_processed']} 項食材")
            message_parts.append(f"• 使用效率 {stats['usage_rate']}% (新手中的佼佼者！)")
            
            if stats["saved_money"] > 0:
                message_parts.append(f"• 省下 ${int(stats['saved_money'])} (超棒的開始！)")
                
            if stats["wasted_count"] == 0:
                message_parts.append("• 零浪費達成！環保小天使就是你！")
        else:
            message_parts.extend([
                "• 已經開始設定食材管理",
                "• 準備迎接精彩的省錢之旅",
            ])
        
        # 新手特殊獎勵和鼓勵
        message_parts.extend([
            "",
            "💎 新手特殊獎勵：",
            "✅ 獲得專屬新手稱號",
            "✅ 解鎖更多進階功能",
            "✅ 下週數據會更精彩！",
            "",
            "👑 你已經超越了很多同期新用戶！",
            "🚀 繼續保持這個好習慣，下週挑戰更多成就！",
            "",
            "🌱 繼續加油，你就是下一個省錢大師！(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧"
        ])
        
        return "\n".join(message_parts)
        
    except Exception as e:
        logger.error(f"生成新手慶祝週報失敗 (user_id: {user_id}): {e}")
        # 失敗時回傳簡單版本
        return "\n".join([
            "🎊 【新手專屬】首週慶祝 🎊",
            "",
            "🌟 恭喜你踏出食材管理的第一步！",
            "雖然數據還在累積中，但開始就是最棒的成就！",
            "",
            "🚀 下週讓我們一起創造更多精彩的省錢故事！",
            "",
            "歡迎來到AI冰箱精靈大家庭！(´∀｀)♡"
        ])


def get_weekly_insights(stats: Dict) -> List[str]:
    """
    根據週統計生成洞察和建議
    
    Args:
        stats: 週統計數據
        
    Returns:
        洞察文字列表
    """
    insights = []
    
    # 基本表現評估
    if stats["total_processed"] == 0:
        insights.append("📊 本週還沒有處理任何食材記錄")
        insights.append("💡 記得標記用完或丟棄的食材，幫助分析使用效率！")
        return insights
    
    usage_rate = stats["usage_rate"]
    timely_rate = stats["timely_usage_rate"]
    
    # 使用率評價
    if usage_rate >= 80:
        insights.append(f"🎉 太棒了！本週 {usage_rate}% 食材成功使用，幾乎零浪費！")
    elif usage_rate >= 60:
        insights.append(f"👍 不錯！本週 {usage_rate}% 食材成功使用")
    else:
        insights.append(f"📈 本週 {usage_rate}% 食材成功使用，還有改進空間")
    
    # 效期內使用率評價
    if timely_rate >= 90:
        insights.append(f"⏰ 完美！{stats['used_before_expiry']}/{stats['used_count']} 項食材在效期內使用")
    elif timely_rate >= 70:
        insights.append(f"⏰ 很好！大部分食材在效期內使用完畢")
    else:
        insights.append(f"⏰ 建議：有 {stats['used_after_expiry']} 項食材過期才使用")
    
    # 金額統計
    if stats["saved_money"] > 0:
        insights.append(f"💰 本週成功使用價值 ${int(stats['saved_money'])} 的食材")
    
    if stats["wasted_value"] > 0:
        insights.append(f"💸 浪費了 ${int(stats['wasted_value'])} 的食材")
    
    # 改進建議
    if usage_rate < 70:
        insights.append("💡 建議：購買前先確認冰箱現有食材，避免重複購買")
    
    if timely_rate < 80:
        insights.append("💡 建議：開啟效期提醒，及時使用即將過期的食材")
    
    return insights


def generate_weekly_report_message(user_id: int, db: Session) -> Optional[str]:
    """
    生成週報推播訊息（支援新手特殊版本）
    
    Args:
        user_id: 使用者 ID
        db: 資料庫 session
        
    Returns:
        完整的週報訊息文字
    """
    try:
        # 獲取本週統計
        stats = calculate_weekly_usage_stats(user_id, db, weeks_back=0)
        
        # 檢查是否為新手用戶
        if is_first_week_user(user_id, db):
            logger.info(f"生成新手專屬週報 (user_id: {user_id})")
            # 新手即使沒有數據也要發送鼓勵週報
            return generate_newbie_celebration_report(user_id, stats, db)
        
        # 一般用戶：沒有數據就不發送
        if stats["total_processed"] == 0:
            return None
        
        # 一般用戶的週報邏輯
        return generate_regular_weekly_report(user_id, stats, db)
        
    except Exception as e:
        logger.error(f"生成週報訊息失敗 (user_id: {user_id}): {e}")
        return None


def generate_regular_weekly_report(user_id: int, stats: Dict, db: Session) -> str:
    """
    生成一般用戶的週報訊息
    
    Args:
        user_id: 使用者 ID
        stats: 週統計數據
        db: 資料庫 session
        
    Returns:
        一般週報訊息文字
    """
    try:
        # 獲取洞察
        insights = get_weekly_insights(stats)
        
        # 組成訊息
        message_parts = [
            "📊 AI 冰箱精靈 - 週報告",
            f"📅 {stats['week_start']} ~ {stats['week_end']}",
            "",
        ]
        
        # 加入洞察
        message_parts.extend(insights)
        
        # 加入詳細數據
        message_parts.extend([
            "",
            "📈 本週數據：",
            f"• 處理食材：{stats['total_processed']} 項",
            f"• 成功使用：{stats['used_count']} 項",
            f"• 不幸浪費：{stats['wasted_count']} 項",
        ])
        
        if stats["total_value"] > 0:
            message_parts.append(f"• 總價值：${int(stats['total_value'])}")
        
        # 鼓勵語句
        message_parts.extend([
            "",
            "🌱 持續記錄，讓我們一起減少食物浪費！"
        ])
        
        return "\n".join(message_parts)
        
    except Exception as e:
        logger.error(f"生成一般週報失敗 (user_id: {user_id}): {e}")
        return None