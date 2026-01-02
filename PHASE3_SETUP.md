# Phase 3 設置指南

本文件說明如何設置和運行 Phase 3 的所有功能。

## 已創建的文件

### 後端 API Routes (T043-T048)

1. **backend/src/schemas/food_item.py** - 食材相關的 Pydantic schemas
   - `FoodItemCreate` - 新增食材請求
   - `FoodItemUpdate` - 更新食材請求
   - `FoodItemResponse` - 食材回應
   - `AIRecognitionRequest` - AI 辨識請求
   - `AIRecognitionResponse` - AI 辨識回應

2. **backend/src/schemas/fridge.py** - 冰箱和分區相關的 Pydantic schemas
   - `FridgeCreate`, `FridgeUpdate`, `FridgeResponse`, `FridgeDetailResponse`
   - `FridgeCompartmentCreate`, `FridgeCompartmentUpdate`, `FridgeCompartmentResponse`

3. **backend/src/services/ai_vision.py** - OpenAI Vision API 服務
   - `recognize_food_item()` - 使用 GPT-4 Vision 辨識食材
   - `calculate_expiry_date()` - 計算效期

4. **backend/src/routes/food_items.py** - 食材管理路由
   - `GET /api/v1/food-items` - 列出食材（支援 query 參數篩選）
   - `GET /api/v1/food-items/{id}` - 取得單一食材
   - `POST /api/v1/food-items` - 新增食材
   - `PUT /api/v1/food-items/{id}` - 更新食材
   - `DELETE /api/v1/food-items/{id}` - 刪除食材
   - `POST /api/v1/food-items/recognize` - AI 辨識端點（multipart/form-data）

5. **backend/src/routes/fridges.py** - 冰箱管理路由
   - `GET /api/v1/fridges` - 取得使用者冰箱列表
   - `POST /api/v1/fridges` - 新增冰箱
   - `GET /api/v1/fridges/{id}` - 取得單一冰箱（含分區）
   - `PUT /api/v1/fridges/{id}` - 更新冰箱
   - `POST /api/v1/fridges/{id}/compartments` - 新增分區

6. **backend/src/routes/line_webhook.py** - LINE webhook 端點
   - `POST /webhook/line` - LINE webhook 端點
   - 簽名驗證
   - 處理 message 和 postback 事件

7. **更新 backend/src/main.py** - 註冊所有路由

### 前端 LIFF Pages (T049-T054)

1. **frontend/src/pages/Home.jsx** - 食材清單頁面
   - 顯示所有食材（使用 FoodItemCard）
   - 篩選器（全部/冷藏/冷凍/過期）
   - 搜尋功能
   - 統計數據和進度條
   - 浮動新增按鈕

2. **frontend/src/pages/FridgeSetup.jsx** - 冰箱初始化頁面
   - 冰箱型號和容量設定
   - 簡單模式 vs 細分模式選擇
   - 自動建立預設分區（細分模式）

3. **frontend/src/pages/AddFoodItem.jsx** - 新增食材頁面
   - AI 拍照辨識模式
   - 手動輸入模式
   - ImageUploader 組件
   - CompartmentSelector 組件
   - 完整的表單驗證

4. **frontend/src/pages/EditFoodItem.jsx** - 編輯食材頁面
   - 預填現有資料
   - 顯示圖片（如果有）
   - Popconfirm 刪除確認
   - 更新和刪除功能

5. **frontend/src/pages/FridgeSettings.jsx** - 冰箱設定頁面
   - 顯示冰箱資訊
   - 容量使用率進度條
   - 分區管理（新增/列出）
   - 統計資訊

6. **frontend/src/pages/index.js** - 匯出所有頁面

7. **更新 frontend/src/App.jsx** - 註冊所有路由
   - 首次使用檢查（自動導向 /setup）
   - 路由設定（/, /setup, /add, /edit/:id, /settings）

8. **更新 frontend/src/services/api.js** - 新增 API 方法
   - 冰箱相關：`getFridges()`, `getFridge()`, `createFridge()`, `updateFridge()`, `createCompartment()`
   - 更新 `recognizeFoodImage()` 以支援新的參數

9. **更新 frontend/package.json** - 添加 dayjs 依賴

## 安裝步驟

### 1. 後端設置

```bash
cd backend

# 安裝依賴（如果尚未安裝）
pip install -r requirements.txt

# 確保環境變數已設定（.env 檔案）
# - DATABASE_URL
# - LINE_CHANNEL_SECRET
# - LINE_CHANNEL_ACCESS_TOKEN
# - LIFF_ID
# - OPENAI_API_KEY
# - CLOUDINARY_CLOUD_NAME
# - CLOUDINARY_API_KEY
# - CLOUDINARY_API_SECRET

# 運行資料庫遷移（確保所有 models 已建立）
alembic upgrade head

# 啟動開發伺服器
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. 前端設置

```bash
cd frontend

# 安裝新的依賴（dayjs）
npm install

# 確保環境變數已設定（.env 檔案）
# - VITE_API_URL（後端 API URL）
# - VITE_LIFF_ID（LINE LIFF ID）

# 啟動開發伺服器
npm run dev
```

### 3. LINE Bot 設置

1. 登入 [LINE Developers Console](https://developers.line.biz/)
2. 設定 Webhook URL：`https://your-backend-url/webhook/line`
3. 確認 LIFF endpoint URL 正確設定

## API 端點測試

### 健康檢查
```bash
curl http://localhost:8000/health
```

### 冰箱管理
```bash
# 新增冰箱
curl -X POST http://localhost:8000/api/v1/fridges \
  -H "Authorization: Bearer YOUR_LIFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model_name": "Samsung 雙門冰箱", "total_capacity_liters": 300}'

# 取得冰箱列表
curl http://localhost:8000/api/v1/fridges \
  -H "Authorization: Bearer YOUR_LIFF_TOKEN"
```

### 食材管理
```bash
# 新增食材
curl -X POST http://localhost:8000/api/v1/food-items \
  -H "Authorization: Bearer YOUR_LIFF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fridge_id": 1,
    "name": "蘋果",
    "category": "水果",
    "quantity": 3,
    "unit": "個",
    "storage_type": "冷藏",
    "expiry_date": "2026-01-10"
  }'

# 列出所有食材
curl http://localhost:8000/api/v1/food-items \
  -H "Authorization: Bearer YOUR_LIFF_TOKEN"

# 篩選已過期食材
curl "http://localhost:8000/api/v1/food-items?is_expired=true" \
  -H "Authorization: Bearer YOUR_LIFF_TOKEN"
```

### AI 辨識
```bash
# 上傳圖片辨識食材
curl -X POST http://localhost:8000/api/v1/food-items/recognize \
  -H "Authorization: Bearer YOUR_LIFF_TOKEN" \
  -F "image=@apple.jpg" \
  -F "fridge_id=1" \
  -F "storage_type=冷藏"
```

## 前端路由

- `/` - 首頁（食材清單）
- `/setup` - 冰箱初始化
- `/add` - 新增食材
- `/edit/:id` - 編輯食材
- `/settings` - 冰箱設定

## 功能特色

### 後端
- ✅ 完整的 CRUD API（食材、冰箱、分區）
- ✅ AI 圖片辨識（OpenAI GPT-4 Vision）
- ✅ 圖片上傳至 Cloudinary
- ✅ LINE Webhook 處理
- ✅ LIFF Token 認證
- ✅ 查詢參數篩選（compartment, is_expired）
- ✅ 計算屬性（is_expired, days_until_expiry）

### 前端
- ✅ 繁體中文 UI（Ant Design）
- ✅ 首次使用檢查（自動導向設定頁面）
- ✅ AI 拍照辨識 + 手動輸入雙模式
- ✅ 簡單模式 vs 細分模式
- ✅ 食材篩選和搜尋
- ✅ 統計數據和進度條
- ✅ 圖片預覽
- ✅ 刪除確認（Popconfirm）
- ✅ Loading 和 Error 處理
- ✅ 成功訊息提示

## 已知限制

1. AI Vision 需要有效的 OpenAI API Key 和額度
2. Cloudinary 圖片儲存需要有效的帳號
3. LINE Webhook 需要 HTTPS（開發時可用 ngrok）
4. 部分進階功能（如排程通知）將在後續 Phase 實作

## 下一步

Phase 3 完成後，可以開始實作：
- Phase 4: 效期提醒排程和 LINE 推播
- Phase 5: 食譜推薦和預算追蹤
- Phase 6: 進階功能（多冰箱、分享、統計圖表）

## 疑難排解

### 後端錯誤
- 確認所有環境變數已正確設定
- 檢查資料庫連線是否正常
- 查看 console log 錯誤訊息

### 前端錯誤
- 確認 API URL 正確
- 檢查 LIFF ID 是否正確
- 查看瀏覽器 console log

### LIFF 認證失敗
- 確認在 LINE 應用內開啟
- 檢查 LIFF endpoint URL 設定
- 確認 Channel Access Token 有效

## 聯絡支援

如有問題，請查看：
1. 專案文檔（spec.md, plan.md）
2. API 文檔（http://localhost:8000/docs）
3. GitHub Issues
