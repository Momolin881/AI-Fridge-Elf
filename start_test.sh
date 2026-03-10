#!/bin/bash

echo "🎯 新手三部曲功能測試啟動腳本"
echo "================================"

# 檢查當前目錄
if [ ! -f "ONBOARDING_TEST_GUIDE.md" ]; then
    echo "❌ 請在專案根目錄執行此腳本"
    exit 1
fi

echo ""
echo "📋 測試前準備檢查："

# 1. 檢查後端目錄
if [ -d "backend" ]; then
    echo "✅ 後端目錄存在"
else
    echo "❌ 找不到後端目錄"
    exit 1
fi

# 2. 檢查前端目錄  
if [ -d "frontend" ]; then
    echo "✅ 前端目錄存在"
else
    echo "❌ 找不到前端目錄"
    exit 1
fi

# 3. 檢查遷移檔案
if [ -f "backend/migrations/006_add_onboarding_progress.sql" ]; then
    echo "✅ 數據庫遷移檔案存在"
else
    echo "❌ 找不到遷移檔案"
    exit 1
fi

echo ""
echo "🚀 開始啟動服務..."

# 建立終端機分割視窗的指令
echo ""
echo "請手動執行以下指令："
echo ""
echo "# 終端機1 - 啟動後端"
echo "cd backend"
echo "uvicorn src.main:app --reload --port 8000"
echo ""
echo "# 終端機2 - 啟動前端"  
echo "cd frontend"
echo "npm run dev"
echo ""
echo "# 終端機3 - 執行數據庫遷移（如需要）"
echo "psql -d your_database_name -f backend/migrations/006_add_onboarding_progress.sql"
echo ""
echo "🎯 然後按照 ONBOARDING_TEST_GUIDE.md 進行測試"