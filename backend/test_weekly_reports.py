#!/usr/bin/env python3
"""
測試週報功能的簡單腳本
在本地端驗證週報統計和訊息生成功能
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from src.database import SessionLocal
from src.services.weekly_stats_service import calculate_weekly_usage_stats, generate_weekly_report_message
from src.models.user import User
from src.models.fridge import Fridge

def test_weekly_stats():
    """測試週統計功能"""
    print("🧪 測試週報功能...")
    
    db = SessionLocal()
    try:
        # 獲取第一個有冰箱的使用者來測試
        user_with_fridge = db.query(User).join(Fridge).first()
        
        if not user_with_fridge:
            print("❌ 資料庫中沒有找到有冰箱的使用者")
            return
            
        user_id = user_with_fridge.id
        print(f"📝 測試使用者 ID: {user_id}")
        
        # 測試週統計計算
        print("\n1️⃣ 測試週統計計算...")
        stats = calculate_weekly_usage_stats(user_id, db, weeks_back=0)
        print(f"本週統計: {stats}")
        
        # 測試上週統計
        print("\n2️⃣ 測試上週統計計算...")
        last_week_stats = calculate_weekly_usage_stats(user_id, db, weeks_back=1)
        print(f"上週統計: {last_week_stats}")
        
        # 測試週報訊息生成
        print("\n3️⃣ 測試週報訊息生成...")
        weekly_message = generate_weekly_report_message(user_id, db)
        
        if weekly_message:
            print("📊 週報訊息內容:")
            print("=" * 50)
            print(weekly_message)
            print("=" * 50)
        else:
            print("📭 本週無數據，週報訊息為 None")
            
        print("\n✅ 週報功能測試完成！")
        
    except Exception as e:
        print(f"❌ 測試失敗: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_weekly_stats()