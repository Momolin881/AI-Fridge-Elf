#!/usr/bin/env python3
"""
測試新手首週特殊週報功能
驗證新手檢測和慶祝版週報生成
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from datetime import datetime, timedelta
from src.database import SessionLocal
from src.services.weekly_stats_service import (
    is_first_week_user,
    generate_weekly_report_message,
    generate_newbie_celebration_report,
    detect_first_week_achievements,
    calculate_weekly_usage_stats
)
from src.models.user import User

def test_newbie_detection():
    """測試新手檢測功能"""
    print("🧪 測試新手檢測功能...")
    
    db = SessionLocal()
    try:
        # 找一個用戶來測試
        users = db.query(User).limit(3).all()
        
        if not users:
            print("❌ 資料庫中沒有用戶")
            return
        
        for user in users:
            is_newbie = is_first_week_user(user.id, db)
            days_since_register = (datetime.now() - user.created_at).days
            
            print(f"👤 用戶 {user.id}:")
            print(f"   註冊時間: {user.created_at}")
            print(f"   註冊天數: {days_since_register} 天")
            print(f"   是否新手: {'✅ 是' if is_newbie else '❌ 否'}")
            print()
            
    finally:
        db.close()

def test_newbie_weekly_report():
    """測試新手週報生成"""
    print("🎊 測試新手週報生成...")
    
    db = SessionLocal()
    try:
        # 找一個用戶測試
        user = db.query(User).first()
        
        if not user:
            print("❌ 資料庫中沒有用戶")
            return
            
        user_id = user.id
        print(f"📝 測試用戶 ID: {user_id}")
        
        # 測試統計數據獲取
        print("\n1️⃣ 測試統計數據獲取...")
        stats = calculate_weekly_usage_stats(user_id, db)
        print(f"統計數據: {stats}")
        
        # 測試成就檢測
        print("\n2️⃣ 測試成就檢測...")
        achievements = detect_first_week_achievements(user_id, stats, db)
        print("檢測到的成就:")
        for achievement in achievements:
            print(f"   🏆 {achievement}")
        
        # 測試新手慶祝週報
        print("\n3️⃣ 測試新手慶祝週報生成...")
        newbie_report = generate_newbie_celebration_report(user_id, stats, db)
        print("🎊 新手慶祝週報內容:")
        print("=" * 60)
        print(newbie_report)
        print("=" * 60)
        
        # 測試完整週報邏輯（包含新手檢測）
        print("\n4️⃣ 測試完整週報邏輯...")
        full_report = generate_weekly_report_message(user_id, db)
        if full_report:
            print("📊 完整週報內容:")
            print("=" * 60)
            print(full_report)
            print("=" * 60)
        else:
            print("📭 週報為空（可能用戶不是新手且無數據）")
            
        print("\n✅ 新手週報功能測試完成！")
        
    except Exception as e:
        print(f"❌ 測試失敗: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

def test_mock_newbie_scenario():
    """模擬新手場景測試"""
    print("🎮 模擬新手場景測試...")
    
    # 模擬不同情況的新手數據
    mock_scenarios = [
        {
            "name": "完全新手（無數據）",
            "stats": {
                "week_start": "2024-02-12",
                "week_end": "2024-02-18",
                "total_processed": 0,
                "used_count": 0,
                "wasted_count": 0,
                "usage_rate": 0,
                "timely_usage_rate": 0,
                "saved_money": 0
            }
        },
        {
            "name": "積極新手（有行動）",
            "stats": {
                "week_start": "2024-02-12",
                "week_end": "2024-02-18", 
                "total_processed": 3,
                "used_count": 2,
                "wasted_count": 1,
                "usage_rate": 66.7,
                "timely_usage_rate": 100,
                "saved_money": 120
            }
        },
        {
            "name": "超棒新手（效率很高）",
            "stats": {
                "week_start": "2024-02-12",
                "week_end": "2024-02-18",
                "total_processed": 5,
                "used_count": 5,
                "wasted_count": 0,
                "usage_rate": 100,
                "timely_usage_rate": 90,
                "saved_money": 250
            }
        }
    ]
    
    db = SessionLocal()
    try:
        for i, scenario in enumerate(mock_scenarios, 1):
            print(f"\n🎯 場景 {i}: {scenario['name']}")
            print("-" * 40)
            
            # 模擬檢測成就
            achievements = detect_first_week_achievements(999, scenario['stats'], db)
            print("🏆 檢測成就:")
            for achievement in achievements:
                print(f"   {achievement}")
                
            # 生成慶祝報告
            report = generate_newbie_celebration_report(999, scenario['stats'], db)
            print("\n📋 週報內容預覽:")
            # 只顯示前幾行避免太長
            preview_lines = report.split('\n')[:8]
            for line in preview_lines:
                print(f"   {line}")
            print("   ... (還有更多內容)")
            
    finally:
        db.close()

if __name__ == "__main__":
    print("🚀 新手首週特殊週報功能測試")
    print("=" * 50)
    
    test_newbie_detection()
    print()
    test_newbie_weekly_report()
    print()
    test_mock_newbie_scenario()
    
    print("\n🎉 所有測試完成！")