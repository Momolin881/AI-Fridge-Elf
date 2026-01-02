# Phase 4: User Story 2 驗證清單

## 文件驗證

### 新建文件
- [x] `/backend/src/schemas/notification.py` - 3.86 KB
- [x] `/backend/src/services/scheduler.py` - 6.79 KB  
- [x] `/backend/src/routes/notifications.py` - 5.30 KB
- [x] `/frontend/src/pages/NotificationSettings.jsx` - 10.4 KB

### 更新文件
- [x] `/backend/src/schemas/__init__.py` - 匯出 notification schemas
- [x] `/backend/src/routes/__init__.py` - 匯出 notifications router
- [x] `/backend/src/main.py` - 匯入並註冊 scheduler 和 notifications
- [x] `/frontend/src/pages/index.js` - 匯出 NotificationSettings
- [x] `/frontend/src/App.jsx` - 新增路由

## 依賴驗證

### Backend
- [x] APScheduler >= 3.10.0 (已在 pyproject.toml)
- [x] line-bot-sdk >= 3.7.0 (已在 pyproject.toml)

### Frontend  
- [x] dayjs >= 1.11.10 (已在 package.json)
- [x] antd >= 5.12.0 (已在 package.json)

## 功能驗證

### Backend API
- [x] GET /api/v1/notifications/settings
  - [x] 回傳 NotificationSettingsResponse
  - [x] 自動創建預設設定
  - [x] 需要認證

- [x] PUT /api/v1/notifications/settings
  - [x] 接受 NotificationSettingsUpdate
  - [x] 支援部分更新
  - [x] 驗證欄位範圍
  - [x] 需要認證

### Scheduler
- [x] start_scheduler() 函數
- [x] stop_scheduler() 函數
- [x] check_expiring_items() 每日任務
- [x] check_space_usage() 每日任務
- [x] Cron 觸發器設定

### Frontend UI
- [x] 效期提醒設定區塊
- [x] 庫存提醒設定區塊
- [x] 空間提醒設定區塊
- [x] 通知時間設定
- [x] 返回按鈕
- [x] 儲存按鈕
- [x] 載入狀態顯示
- [x] 錯誤處理

## Schema 驗證

### NotificationSettingsResponse
- [x] id: int
- [x] user_id: int
- [x] expiry_warning_enabled: bool
- [x] expiry_warning_days: int (1-30)
- [x] low_stock_enabled: bool
- [x] low_stock_threshold: int (>= 0)
- [x] space_warning_enabled: bool
- [x] space_warning_threshold: int (50-100)
- [x] notification_time: str (HH:MM)

### NotificationSettingsUpdate
- [x] 所有欄位為 Optional
- [x] 使用 exclude_unset=True
- [x] notification_time 格式驗證

## 整合驗證

### Backend 整合
- [x] scheduler 在 main.py lifespan 中啟動
- [x] scheduler 在 main.py lifespan 中停止
- [x] notifications router 已註冊
- [x] schemas 已匯出

### Frontend 整合
- [x] NotificationSettings 已匯出
- [x] 路由已註冊
- [x] API 函數存在

## 語法檢查
- [x] notification.py - Python 編譯通過
- [x] scheduler.py - Python 編譯通過
- [x] notifications.py - Python 編譯通過
- [x] NotificationSettings.jsx - JSX 語法正確

## 測試建議

### 手動測試步驟
1. [ ] 啟動後端服務
2. [ ] 確認排程器啟動日誌
3. [ ] 測試 GET /api/v1/notifications/settings
4. [ ] 測試 PUT /api/v1/notifications/settings
5. [ ] 啟動前端服務
6. [ ] 訪問 /settings/notifications
7. [ ] 測試各項設定的啟用/停用
8. [ ] 測試滑桿和數值輸入
9. [ ] 測試時間選擇器
10. [ ] 測試儲存功能

### 自動化測試
- [ ] 單元測試：notification schemas
- [ ] 單元測試：scheduler 函數
- [ ] 整合測試：notifications API
- [ ] E2E 測試：前端頁面

---

**狀態:** ✅ 所有必需項目已完成
**建議:** 進行手動測試驗證功能正常運作
