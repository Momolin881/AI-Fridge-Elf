# AI Fridge Elf 部署檢查清單

## ✅ 已完成

- [x] **Git Commit** - 所有程式碼已提交（76 個檔案，10,351 行程式碼）
  - Commit: `a512dec`
  - 包含 Phases 1-6 所有核心功能
  - 包含 Docker 部署配置

- [x] **部署檔案創建**
  - [x] `backend/Dockerfile`
  - [x] `frontend/Dockerfile`
  - [x] `frontend/nginx.conf`
  - [x] `docker-compose.yml`
  - [x] `.dockerignore` (backend/frontend)
  - [x] `DEPLOYMENT.md` 部署指南

---

## 📋 接下來要做的事

### 第一步：推送到 GitHub（5 分鐘）

```bash
cd "/Users/momo/Desktop/AI Fridge Elf/AI FRIDGE ELF/ai-fridge-elf"

# 如果還沒有 GitHub repository，先建立一個
# 然後執行：

# 加入 remote
git remote add origin https://github.com/你的帳號/ai-fridge-elf.git

# 推送到 GitHub
git branch -M main
git push -u origin main
```

**檢查點：** GitHub repository 上可以看到所有檔案 ✅

---

### 第二步：LINE Developers 設定（20 分鐘）

#### 2.1 創建 Messaging API Channel

1. 前往 https://developers.line.biz/console/
2. 選擇或創建 Provider
3. 點擊 "Create a new channel" → "Messaging API"
4. 填寫資訊：
   - Channel name: `AI Fridge Elf`
   - Channel description: `智慧冰箱管理系統`
   - Category: `Food & Dining`
   - Subcategory: 選擇適合的

#### 2.2 取得 Credentials

**Channel Secret:**
```
位置：Basic settings → Channel secret
複製：___________________________________
```

**Channel Access Token:**
```
位置：Messaging API → Channel access token
點擊 "Issue" 按鈕生成
複製：___________________________________
```

#### 2.3 基本設定

在 "Messaging API" 頁籤：
- [ ] 關閉 "Auto-reply messages"
- [ ] 關閉 "Greeting messages"（或自訂歡迎訊息）
- [ ] Webhook URL 設定（**先留空，等 Zeabur 部署後再設**）

#### 2.4 創建 LIFF App

1. 在同一個 Channel 中，進入 "LIFF" 頁籤
2. 點擊 "Add" 創建新 LIFF app
3. 填寫設定：
   ```
   LIFF app name: AI Fridge Elf
   Size: Full
   Endpoint URL: https://暫時留空.zeabur.app （稍後更新）
   Scope:
     ✅ profile
     ✅ openid
     ✅ chat_message.write
   Module mode: Off
   ```
4. 複製 LIFF ID（格式：1234567890-AbCdEfGh）

**LIFF ID:**
```
複製：___________________________________
```

**檢查點：** 已取得 Channel Secret, Access Token, LIFF ID ✅

---

### 第三步：第三方服務設定（15 分鐘）

#### 3.1 OpenAI API

1. 前往 https://platform.openai.com/
2. 建立 API Key
3. 確認有足夠額度

**OpenAI API Key:**
```
複製：sk-___________________________________
```

#### 3.2 Cloudinary

1. 前往 https://cloudinary.com/
2. 註冊並登入
3. 從 Dashboard 取得：

**Cloudinary Credentials:**
```
Cloud Name：___________________________________
API Key：___________________________________
API Secret：___________________________________
```

**檢查點：** 已取得 OpenAI 和 Cloudinary credentials ✅

---

### 第四步：Zeabur 部署（30 分鐘）

#### 4.1 創建 Zeabur 專案

1. 前往 https://zeabur.com/
2. 使用 GitHub 登入
3. 點擊 "New Project"
4. 選擇 "Deploy from GitHub"
5. 選擇 `ai-fridge-elf` repository
6. Zeabur 會自動偵測 `docker-compose.yml`

#### 4.2 設定環境變數

在 Zeabur 專案設定中，新增以下環境變數：

**資料庫：**
```
變數名稱：POSTGRES_PASSWORD
值：___________________________________（隨機生成強密碼）
```

**OpenAI：**
```
變數名稱：OPENAI_API_KEY
值：sk-___________________________________
```

**Cloudinary：**
```
變數名稱：CLOUDINARY_CLOUD_NAME
值：___________________________________

變數名稱：CLOUDINARY_API_KEY
值：___________________________________

變數名稱：CLOUDINARY_API_SECRET
值：___________________________________
```

**LINE（從步驟 2 取得）：**
```
變數名稱：LINE_CHANNEL_SECRET
值：___________________________________

變數名稱：LINE_CHANNEL_ACCESS_TOKEN
值：___________________________________

變數名稱：LIFF_ID
值：___________________________________
```

**JWT Secret（生成隨機密鑰）：**
```bash
# 在終端機執行：
openssl rand -hex 32

# 複製輸出結果
變數名稱：JWT_SECRET
值：___________________________________
```

#### 4.3 開始部署

- [ ] 所有環境變數都已設定
- [ ] 點擊 "Deploy" 開始部署
- [ ] 等待建置完成（約 5-10 分鐘）

#### 4.4 取得部署網址

```
部署完成後的網址：
https://___________________________________
```

**檢查點：** Zeabur 部署成功，取得網址 ✅

---

### 第五步：更新 LINE 設定（10 分鐘）

#### 5.1 更新 Webhook URL

回到 LINE Developers Console：

1. 進入你的 Messaging API Channel
2. 前往 "Messaging API" 頁籤
3. Webhook URL 設定：
   ```
   https://你的zeabur網址.zeabur.app/webhook
   ```
4. 點擊 "Verify" 按鈕（應該顯示成功）
5. 啟用 "Use webhook"

**檢查點：** Webhook 驗證成功 ✅

#### 5.2 更新 LIFF Endpoint URL

1. 前往 "LIFF" 頁籤
2. 編輯你的 LIFF app
3. Endpoint URL 更新為：
   ```
   https://你的zeabur網址.zeabur.app
   ```
4. 儲存

**檢查點：** LIFF Endpoint URL 已更新 ✅

---

### 第六步：測試與驗證（30 分鐘）

#### 6.1 後端健康檢查

```bash
# 測試健康檢查 API
curl https://你的zeabur網址.zeabur.app/health

# 預期回應：{"status":"healthy"}
```

- [ ] 健康檢查通過

#### 6.2 API 文件檢查

開啟瀏覽器訪問：
```
https://你的zeabur網址.zeabur.app/docs
```

- [ ] 可以看到 FastAPI Swagger 文件
- [ ] 可以看到所有 API 端點

#### 6.3 LINE Bot 測試

1. 打開 LINE Developers Console
2. 找到你的 Bot 的 QR Code
3. 用手機 LINE 掃描加入好友
4. 在聊天室中測試：
   - [ ] Bot 有回應
   - [ ] Webhook 正常運作

#### 6.4 LIFF App 測試

**方式一：從聊天室開啟**
1. 在 Bot 聊天室中輸入任何訊息
2. Bot 回覆中應該會有開啟 LIFF 的選項

**方式二：直接開啟 LIFF URL**
```
line://app/你的LIFF_ID
```

**測試項目：**
- [ ] LIFF 初始化成功
- [ ] 可以看到登入畫面
- [ ] 進入冰箱設定頁面
- [ ] 可以創建冰箱

#### 6.5 完整功能測試

**Phase 3 - 食材管理：**
- [ ] 新增食材（手動輸入）
- [ ] 拍照辨識食材（測試 GPT-4 Vision）
- [ ] 查看食材列表
- [ ] 編輯食材
- [ ] 刪除食材

**Phase 4 - 通知設定：**
- [ ] 進入通知設定頁面
- [ ] 修改效期提醒設定
- [ ] 修改庫存警報設定
- [ ] 儲存設定

**Phase 5 - 食譜推薦：**
- [ ] 查看食譜推薦
- [ ] 測試 GPT-4 推薦食譜
- [ ] 收藏食譜
- [ ] 查看我的食譜庫

**Phase 6 - 預算控管：**
- [ ] 查看消費統計
- [ ] 查看圖表（趨勢圖、圓餅圖）
- [ ] 設定月度預算
- [ ] 查看採買建議

---

## 🐛 除錯指南

### 問題：Zeabur 建置失敗

**檢查：**
1. 查看 Zeabur logs
2. 確認 Docker 檔案格式正確
3. 確認所有環境變數已設定

**解決方法：**
```bash
# 本地測試 Docker 建置
cd backend
docker build -t ai-fridge-backend .

cd ../frontend
docker build -t ai-fridge-frontend .
```

### 問題：資料庫連線失敗

**檢查：**
1. `POSTGRES_PASSWORD` 環境變數是否正確
2. PostgreSQL 容器是否啟動
3. Backend logs 是否有錯誤訊息

**解決方法：**
- 重新部署 PostgreSQL 服務
- 檢查資料庫連線字串格式

### 問題：LINE Webhook 驗證失敗

**檢查：**
1. Webhook URL 是否正確
2. Backend 是否已啟動
3. `LINE_CHANNEL_SECRET` 是否正確

**解決方法：**
```bash
# 測試 webhook endpoint
curl -X POST https://你的zeabur網址.zeabur.app/webhook \
  -H "Content-Type: application/json" \
  -d '{"events":[]}'
```

### 問題：LIFF 初始化失敗

**檢查：**
1. `LIFF_ID` 是否正確
2. LIFF Endpoint URL 是否正確
3. Frontend 是否建置成功

**解決方法：**
- 重新檢查 LIFF 設定
- 查看瀏覽器 Console 錯誤訊息

### 問題：AI 辨識失敗

**檢查：**
1. `OPENAI_API_KEY` 是否正確
2. OpenAI 帳戶額度是否足夠
3. Backend logs 是否有 API 錯誤

**解決方法：**
- 檢查 OpenAI API 狀態
- 確認 API Key 有效

### 問題：圖片上傳失敗

**檢查：**
1. Cloudinary 環境變數是否正確
2. Cloudinary 帳戶狀態
3. 圖片大小是否超過限制

---

## 📊 部署完成檢查表

- [ ] **步驟 1：** GitHub 推送完成
- [ ] **步驟 2：** LINE Developers 設定完成
- [ ] **步驟 3：** 第三方服務 credentials 取得
- [ ] **步驟 4：** Zeabur 部署成功
- [ ] **步驟 5：** LINE 設定更新完成
- [ ] **步驟 6：** 所有功能測試通過

---

## 🎉 部署成功！

恭喜！AI Fridge Elf 已成功部署並可以使用了。

**下一步：**
1. 邀請使用者加入 LINE Bot 測試
2. 收集使用者回饋
3. 根據需求決定是否執行 Phase 7 (Polish)

**重要連結：**
- 部署網址：https://___________________________________
- API 文件：https://___________________________________/docs
- LINE Bot：https://line.me/R/ti/p/@___________________________________
- LIFF App：line://app/___________________________________

**監控與維護：**
- Zeabur Dashboard：定期查看服務狀態
- Logs：監控錯誤和異常
- 成本：追蹤使用量和費用
