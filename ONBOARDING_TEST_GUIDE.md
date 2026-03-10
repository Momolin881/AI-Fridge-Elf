# 🎯 新手三部曲功能測試指引

## 📋 測試前準備

### 1. 後端設置
```bash
cd backend

# 1. 確保 PostgreSQL 運行中
# 2. 執行數據庫遷移（新增 onboarding_progress 欄位）
psql -d your_database -f migrations/006_add_onboarding_progress.sql

# 3. 啟動後端服務
uvicorn src.main:app --reload --port 8000
```

### 2. 前端設置
```bash
cd frontend

# 1. 安裝依賴（如需要）
npm install

# 2. 啟動前端開發服務器
npm run dev
```

## 🧪 測試流程

### Step 1: 新手用戶測試
1. **創建全新用戶**
   - 使用未註冊過的 LINE 帳號
   - 或清空現有用戶的 `onboarding_progress` 欄位：
     ```sql
     UPDATE users SET onboarding_progress = NULL WHERE line_user_id = 'your_line_user_id';
     ```

2. **驗證新手三部曲卡片顯示**
   - 開啟 LIFF 首頁
   - 應該看到新手三部曲卡片在最上方
   - 顯示 3 個未完成任務：📸 拍照入庫、✅ 標記用完、🍳 AI食譜

### Step 2: 任務 1 - 拍照入庫 📸
1. **觸發任務**
   - 點擊首頁右下角 ➕ 新增食材按鈕
   - 上傳任意食材照片
   - 完成 AI 辨識並儲存食材

2. **驗證結果**
   - 回到首頁，新手三部曲卡片中
   - 📸 拍照入庫任務應顯示為已完成（綠色圓圈 + ✓ 標記）
   - 進度條更新為 1/3

### Step 3: 任務 2 - 標記用完 ✅
1. **觸發任務**
   - 在首頁點擊任一食材卡片
   - 點擊「用完」按鈕
   - 選擇「✅ 用完」並確認

2. **驗證結果**
   - 回到首頁，新手三部曲卡片中
   - ✅ 標記用完任務應顯示為已完成
   - 進度條更新為 2/3

### Step 4: 任務 3 - AI食譜 🍳
1. **觸發任務**
   - 在首頁點擊導航欄「食譜推薦」
   - 或點擊首頁的「💡 食譜推薦」按鈕
   - 進入食譜推薦頁面

2. **驗證結果**
   - 回到首頁，新手三部曲卡片中
   - 🍳 AI食譜任務應顯示為已完成
   - 進度條更新為 3/3

### Step 5: 成就慶典測試 🎊
1. **觸發慶典**
   - 完成第三個任務後
   - 應自動跳出成就慶典彈窗

2. **驗證效果**
   - ✨ Confetti 動畫（彩色紙花從上方飄落）
   - 🎵 成功音效播放
   - 🏆 金色獎盃圖示動畫
   - 💬 欣梅爾台詞：「如果是勇者欣梅爾的話一定會繼續這麼做的」
   - 🎯 成就描述：「你已經解鎖達人模式！」

3. **慶典結束**
   - 點擊「開始達人之旅」按鈕
   - 慶典關閉，新手三部曲卡片消失

## 🔧 API 測試端點

### 手動 API 測試
```bash
# 1. 獲取進度
GET /api/v1/onboarding/progress

# 2. 完成任務
POST /api/v1/onboarding/task/photo_upload/complete
POST /api/v1/onboarding/task/mark_consumed/complete
POST /api/v1/onboarding/task/recipe_view/complete

# 3. 標記慶典已顯示
POST /api/v1/onboarding/celebration/sent

# 4. 檢查教學顯示狀態
GET /api/v1/onboarding/should-show-tutorial
```

## ❌ 常見問題排解

### 1. 卡片不顯示
- 檢查用戶是否為新手（onboarding_progress 為 null 或未完成）
- 確認前端 API 調用正常

### 2. 任務無法標記完成
- 檢查後端 API 端點是否正常運作
- 查看瀏覽器開發者工具的 Network 標籤

### 3. 慶典動畫無效果
- 確認瀏覽器支援 Web Audio API
- 檢查 CSS 動畫是否載入正確

### 4. 資料庫問題
- 確保 onboarding_progress 欄位已正確新增
- 檢查 JSON 資料格式是否正確

## 📝 測試檢查清單

- [ ] 新手三部曲卡片正確顯示
- [ ] 任務 1：拍照入庫可觸發並完成
- [ ] 任務 2：標記用完可觸發並完成  
- [ ] 任務 3：AI食譜可觸發並完成
- [ ] 成就慶典正常顯示（confetti + 音效 + 台詞）
- [ ] 完成後卡片正確消失
- [ ] 已完成用戶不再顯示卡片
- [ ] 關閉按鈕功能正常
- [ ] 響應式設計在手機端正常

## 🚀 測試完成後

確認所有功能正常後，準備部署：
1. 建立部署分支
2. 更新版本標籤
3. 準備線上部署