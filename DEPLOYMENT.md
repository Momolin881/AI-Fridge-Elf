# AI Fridge Elf 部署指南

## 📋 部署前準備

### 必要的第三方服務

1. **OpenAI API** - AI 圖像辨識和食譜推薦
   - 註冊：https://platform.openai.com/
   - 取得 API Key

2. **Cloudinary** - 圖片儲存
   - 註冊：https://cloudinary.com/
   - 取得 Cloud Name, API Key, API Secret

3. **LINE Developers** - 聊天機器人和 LIFF
   - 註冊：https://developers.line.biz/
   - 創建 Messaging API Channel
   - 創建 LIFF App

4. **Zeabur** - 部署平台（或其他如 Railway, Render）
   - 註冊：https://zeabur.com/

---

## 🚀 Zeabur 快速部署

### 步驟 1: 推送程式碼到 GitHub

```bash
# 確認目前在專案根目錄
cd /path/to/ai-fridge-elf

# 初始化 Git（如果還沒有）
git init
git add .
git commit -m "feat: 完成 AI Fridge Elf 核心功能"

# 推送到 GitHub
git remote add origin https://github.com/你的帳號/ai-fridge-elf.git
git branch -M main
git push -u origin main
```

### 步驟 2: 在 Zeabur 創建專案

1. 前往 [Zeabur Dashboard](https://dash.zeabur.com/)
2. 點擊 "New Project"
3. 選擇 "Deploy from GitHub"
4. 選擇 `ai-fridge-elf` repository
5. Zeabur 會自動偵測 `docker-compose.yml`

### 步驟 3: 設定環境變數

在 Zeabur 專案設定中，新增以下環境變數：

```bash
# 資料庫
POSTGRES_PASSWORD=你的資料庫密碼（隨機生成）

# OpenAI
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx

# Cloudinary
CLOUDINARY_CLOUD_NAME=你的cloud名稱
CLOUDINARY_API_KEY=你的api_key
CLOUDINARY_API_SECRET=你的api_secret

# LINE (稍後從 LINE Developers Console 取得)
LINE_CHANNEL_SECRET=xxxxxxxxxxxxxxxx
LINE_CHANNEL_ACCESS_TOKEN=xxxxxxxxxxxxxxxx

# LIFF (稍後從 LINE Developers Console 取得)
LIFF_ID=1234567890-AbCdEfGh

# JWT Secret (使用以下指令生成)
# openssl rand -hex 32
JWT_SECRET=你的隨機密鑰至少32字元
```

### 步驟 4: 部署

1. 點擊 "Deploy"
2. 等待建置完成（約 5-10 分鐘）
3. 取得部署網址，例如：`https://ai-fridge-elf.zeabur.app`

---

## 📱 LINE 整合設定

### 步驟 1: 創建 Messaging API Channel

1. 前往 [LINE Developers Console](https://developers.line.biz/console/)
2. 創建新的 Provider（如果還沒有）
3. 創建 Messaging API channel
4. 填寫基本資訊

### 步驟 2: 取得 LINE Credentials

**Channel Secret:**
- 位置：Basic settings → Channel secret
- 複製後填入 Zeabur 環境變數 `LINE_CHANNEL_SECRET`

**Channel Access Token:**
- 位置：Messaging API → Channel access token
- 點擊 "Issue" 生成 (如果還沒有)
- 複製後填入 Zeabur 環境變數 `LINE_CHANNEL_ACCESS_TOKEN`

### 步驟 3: 設定 Webhook

1. 在 Messaging API 頁籤
2. Webhook URL: `https://你的zeabur網址.zeabur.app/webhook`
3. 點擊 "Verify" 驗證
4. 啟用 "Use webhook"
5. 關閉 "Auto-reply messages"

### 步驟 4: 創建 LIFF App

1. 在同一個 Channel 中，進入 "LIFF" 頁籤
2. 點擊 "Add" 創建新 LIFF app

**LIFF 設定:**
```
LIFF app name: AI Fridge Elf
Size: Full
Endpoint URL: https://你的zeabur網址.zeabur.app
Scope:
  ✅ profile
  ✅ openid
  ✅ chat_message.write
Module mode: Off
```

3. 取得 LIFF ID（格式：1234567890-AbCdEfGh）
4. 填入 Zeabur 環境變數 `LIFF_ID`

### 步驟 5: 更新部署

在 Zeabur 設定完 LINE 相關環境變數後：
1. 點擊 "Redeploy" 重新部署
2. 等待重新啟動完成

---

## ✅ 測試部署

### 1. 健康檢查

```bash
curl https://你的zeabur網址.zeabur.app/health
# 應該回傳: {"status":"healthy"}
```

### 2. API 文件

開啟：`https://你的zeabur網址.zeabur.app/docs`

### 3. LIFF 測試

1. 掃描 LINE Bot QR Code 加入好友
2. 在聊天室中點擊 Rich Menu 開啟 LIFF
3. 測試以下功能：
   - ✅ 冰箱設定
   - ✅ 新增食材（拍照辨識）
   - ✅ 查看食材列表
   - ✅ 效期提醒
   - ✅ 食譜推薦
   - ✅ 預算統計

---

## 🐛 常見問題

### 資料庫連線失敗

確認：
- `POSTGRES_PASSWORD` 環境變數已設定
- PostgreSQL 容器啟動成功
- 查看 Zeabur logs

### LINE Webhook 驗證失敗

確認：
- Webhook URL 正確
- 後端服務已啟動
- `LINE_CHANNEL_SECRET` 正確

### LIFF 無法開啟

確認：
- `LIFF_ID` 環境變數正確
- LIFF Endpoint URL 設定正確
- Frontend 建置成功

### AI 辨識失敗

確認：
- `OPENAI_API_KEY` 正確且有效
- OpenAI 帳戶有足夠額度

### 圖片上傳失敗

確認：
- Cloudinary 環境變數正確
- Cloudinary 帳戶狀態正常

---

## 📊 監控與日誌

### 查看日誌

在 Zeabur Dashboard:
1. 選擇服務（backend/frontend/postgres）
2. 點擊 "Logs" 查看即時日誌

### 資料庫管理

使用 Zeabur 提供的資料庫管理工具：
1. 進入 postgres 服務
2. 點擊 "Console" 連線

或使用本地工具：
```bash
# 取得資料庫連線資訊
psql postgresql://postgres:密碼@zeabur提供的host:port/ai_fridge_elf
```

---

## 🔄 更新部署

### 推送新版本

```bash
git add .
git commit -m "feat: 新功能說明"
git push origin main
```

Zeabur 會自動偵測並重新部署。

### 執行資料庫遷移

如果有新的資料表：
1. 本地測試遷移
2. 推送到 GitHub
3. Zeabur 會在啟動時自動執行 `alembic upgrade head`

---

## 💰 成本估算

### Zeabur 免費額度
- ✅ 1 個免費專案
- ✅ 基本資源配額

### 超過免費額度後
- Backend: ~$5-10/月
- Frontend: ~$3-5/月
- PostgreSQL: ~$5-10/月

### 第三方服務
- OpenAI: 依用量計費（GPT-4 Vision 約 $0.01/image）
- Cloudinary: 免費額度 25GB 儲存
- LINE: 免費

---

## 📚 相關文件

- [Zeabur 文件](https://zeabur.com/docs)
- [LINE Messaging API 文件](https://developers.line.biz/en/docs/messaging-api/)
- [LIFF 文件](https://developers.line.biz/en/docs/liff/)
- [FastAPI 部署](https://fastapi.tiangolo.com/deployment/)
