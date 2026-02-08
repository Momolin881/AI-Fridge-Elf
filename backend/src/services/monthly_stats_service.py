"""
月度統計服務

計算用戶每月的省錢統計數據，包括：
- 省錢金額
- 省錢率
- 浪費分析
- 月度建議
"""

import logging
from datetime import datetime, timedelta
from calendar import monthrange
from sqlalchemy.orm import Session
from sqlalchemy import and_, func

from src.models.food_item import FoodItem
from src.models.fridge import Fridge
from src.models.fridge_member import FridgeMember
from src.database import SessionLocal

logger = logging.getLogger(__name__)


class MonthlyStatsService:
    """月度統計服務類"""
    
    @staticmethod
    def get_last_month_date_range():
        """獲取上個月的日期範圍"""
        today = datetime.now()
        
        # 計算上個月
        if today.month == 1:
            last_month = 12
            last_year = today.year - 1
        else:
            last_month = today.month - 1
            last_year = today.year
        
        # 上個月第一天和最後一天
        last_month_start = datetime(last_year, last_month, 1)
        _, last_day = monthrange(last_year, last_month)
        last_month_end = datetime(last_year, last_month, last_day, 23, 59, 59)
        
        return last_month_start, last_month_end
    
    @staticmethod
    def calculate_user_monthly_stats(user_id: int, target_month: datetime = None):
        """
        計算用戶的月度統計
        
        Args:
            user_id: 用戶 ID
            target_month: 目標月份，None 則使用上個月
            
        Returns:
            dict: 統計結果
        """
        db = SessionLocal()
        try:
            # 確定統計月份範圍
            if target_month:
                year, month = target_month.year, target_month.month
                month_start = datetime(year, month, 1)
                _, last_day = monthrange(year, month)
                month_end = datetime(year, month, last_day, 23, 59, 59)
            else:
                month_start, month_end = MonthlyStatsService.get_last_month_date_range()
            
            # 獲取用戶的冰箱
            fridge = db.query(Fridge).filter(Fridge.user_id == user_id).first()
            if not fridge:
                return None
            
            # 查詢該月份處理的食材 (archived_at 在目標月份內)
            archived_items = db.query(FoodItem).filter(
                and_(
                    FoodItem.fridge_id == fridge.id,
                    FoodItem.status == 'archived',
                    FoodItem.archived_at.between(month_start, month_end)
                )
            ).all()
            
            # 查詢該月份購買的所有食材 (purchase_date 在目標月份內)
            purchased_items = db.query(FoodItem).filter(
                and_(
                    FoodItem.fridge_id == fridge.id,
                    FoodItem.purchase_date.between(month_start, month_end)
                )
            ).all()
            
            # 計算統計數據
            stats = MonthlyStatsService._calculate_stats(archived_items, purchased_items)
            stats['month'] = month_start.strftime('%Y年%m月')
            stats['user_id'] = user_id
            stats['fridge_id'] = fridge.id
            
            return stats
            
        except Exception as e:
            logger.error(f"計算月度統計失敗 (user_id: {user_id}): {e}")
            return None
        finally:
            db.close()
    
    @staticmethod
    def _calculate_stats(archived_items, purchased_items):
        """計算統計數據"""
        # 已用完的食材（省錢）- 包括在效期內使用的
        used_items = []
        # 浪費的食材（包括過期丟棄和效期內丟棄）
        wasted_items = []
        
        for item in archived_items:
            if item.disposal_reason == 'used':
                # 標記為"用完"的都算省錢
                used_items.append(item)
            elif item.disposal_reason == 'wasted':
                # 標記為"丟棄"的都算浪費
                wasted_items.append(item)
            else:
                # 沒有標記 disposal_reason 的，根據是否過期判斷
                if item.expiry_date and item.archived_at:
                    if item.archived_at.date() <= item.expiry_date:
                        # 在效期內處理 = 用完 = 省錢
                        used_items.append(item)
                    else:
                        # 過期後處理 = 浪費
                        wasted_items.append(item)
                else:
                    # 沒有效期資料，預設為用完
                    used_items.append(item)
        
        # 計算金額
        saved_money = sum(item.price or 0 for item in used_items)
        wasted_money = sum(item.price or 0 for item in wasted_items)
        total_purchased = sum(item.price or 0 for item in purchased_items)
        total_archived = saved_money + wasted_money
        
        # 計算比率
        save_rate = (saved_money / total_purchased * 100) if total_purchased > 0 else 0
        waste_rate = (wasted_money / total_purchased * 100) if total_purchased > 0 else 0
        
        # 分析最常浪費的食材類型
        wasted_categories = {}
        for item in wasted_items:
            category = item.category or '未分類'
            wasted_categories[category] = wasted_categories.get(category, 0) + 1
        
        most_wasted_category = max(wasted_categories, key=wasted_categories.get) if wasted_categories else None
        
        # 生成建議
        suggestions = MonthlyStatsService._generate_suggestions(save_rate, waste_rate, most_wasted_category)
        
        return {
            'saved_money': round(saved_money, 2),
            'wasted_money': round(wasted_money, 2), 
            'total_purchased': round(total_purchased, 2),
            'save_rate': round(save_rate, 1),
            'waste_rate': round(waste_rate, 1),
            'used_count': len(used_items),
            'wasted_count': len(wasted_items),
            'purchased_count': len(purchased_items),
            'most_wasted_category': most_wasted_category,
            'suggestions': suggestions
        }
    
    @staticmethod
    def _generate_suggestions(save_rate, waste_rate, most_wasted_category):
        """生成個人化建議（充滿情緒價值）"""
        suggestions = []
        
        # 根據省錢率給予滿滿的稱讚 ♡(˃͈ દ ˂͈ ༶ )
        if save_rate >= 90:
            suggestions.append("🌟✨ 哇！你是省錢達人耶！(๑>◡<๑) 完美的食材管理！")
        elif save_rate >= 80:
            suggestions.append("👏🎉 超棒的！你真的很會管理食材呢！(´∀｀)♡ 繼續保持！")
        elif save_rate >= 70:
            suggestions.append("👍💯 做得很好！你的食材幾乎沒浪費 (*´∀`*) 太厲害了！")
        elif save_rate >= 60:
            suggestions.append("😊✨ 不錯的省錢表現！再加把勁就是完美了 (´･ᴗ･` )")
        elif save_rate >= 40:
            suggestions.append("💪🌱 進步空間很大哦！加油管理食材 (๑•̀ㅂ•́)و✧")
        elif save_rate >= 20:
            suggestions.append("📚💡 建議多注意食材效期，你一定可以做得更好 (•‾⌣‾•)")
        else:
            suggestions.append("🤗💝 沒關係，每個人都在學習！從現在開始更用心吧 (´▽`ʃƪ)")
        
        # 特殊成就稱讚
        if waste_rate == 0:
            suggestions.append("🏆👑 完全零浪費！你是環保小天使 (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧")
        elif waste_rate <= 5:
            suggestions.append("🌟🌿 幾乎零浪費！地球會感謝你的 ✧(๑•̀ᄇ•́)و ✧")
        elif waste_rate <= 15:
            suggestions.append("💚🌱 浪費很少！你的環保意識很棒 (♡´▽`♡)")
        
        # 針對浪費情況給溫暖建議
        if waste_rate > 30:
            if most_wasted_category:
                suggestions.append(f"🤔💭「{most_wasted_category}」常浪費？試試分裝保存吧！(´｡• ᵕ •｡`) ♡")
        elif waste_rate > 15:
            if most_wasted_category:
                suggestions.append(f"📝✨ 購買「{most_wasted_category}」時記得確認用量哦 (◡ ‿ ◡)")
        
        # 鼓勵性的未來建議
        if save_rate >= 70:
            suggestions.append("🎯🚀 下個月也要保持這個好習慣！你最棒了 (｡♥‿♥｡)")
        else:
            suggestions.append("🌈💪 下個月一起努力達到更高省錢率吧 ٩(◕‿◕)۶")
        
        return suggestions[:3]  # 最多返回3個建議
    
    @staticmethod
    def get_all_users_monthly_stats():
        """獲取所有用戶的月度統計（用於批量推播）"""
        db = SessionLocal()
        try:
            # 獲取所有有冰箱的用戶
            users = db.query(Fridge.user_id).distinct().all()
            
            results = []
            for (user_id,) in users:
                stats = MonthlyStatsService.calculate_user_monthly_stats(user_id)
                if stats:
                    results.append(stats)
            
            return results
            
        except Exception as e:
            logger.error(f"獲取所有用戶月度統計失敗: {e}")
            return []
        finally:
            db.close()


# 快速測試函數
def test_monthly_stats():
    """測試月度統計功能"""
    # 假設用戶 ID 為 1
    stats = MonthlyStatsService.calculate_user_monthly_stats(1)
    if stats:
        print("月度統計結果:")
        for key, value in stats.items():
            print(f"  {key}: {value}")
    else:
        print("無統計資料")


if __name__ == "__main__":
    test_monthly_stats()