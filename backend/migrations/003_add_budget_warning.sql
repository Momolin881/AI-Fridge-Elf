-- 新增預算提醒欄位
-- 用於儲存月消費上限設定

-- 新增 budget_warning_enabled 欄位（預設為 false）
ALTER TABLE notification_settings
ADD COLUMN IF NOT EXISTS budget_warning_enabled BOOLEAN DEFAULT FALSE NOT NULL;

-- 新增 budget_warning_amount 欄位（預設為 5000）
ALTER TABLE notification_settings
ADD COLUMN IF NOT EXISTS budget_warning_amount INTEGER DEFAULT 5000 NOT NULL;
