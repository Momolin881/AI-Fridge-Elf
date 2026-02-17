-- 新增週報和月報設定欄位到 notification_settings 表

-- 週報設定
ALTER TABLE notification_settings 
ADD COLUMN weekly_report_enabled BOOLEAN DEFAULT TRUE NOT NULL;

ALTER TABLE notification_settings 
ADD COLUMN weekly_report_frequency VARCHAR(20) DEFAULT 'weekly' NOT NULL;

-- 月報設定
ALTER TABLE notification_settings 
ADD COLUMN monthly_report_enabled BOOLEAN DEFAULT TRUE NOT NULL;

-- 為現有用戶設定預設值
UPDATE notification_settings 
SET 
    weekly_report_enabled = TRUE,
    weekly_report_frequency = 'weekly',
    monthly_report_enabled = TRUE
WHERE weekly_report_enabled IS NULL;