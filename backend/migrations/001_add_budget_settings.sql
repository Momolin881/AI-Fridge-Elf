-- Migration: Add budget_settings table
-- Date: 2026-01-02
-- Description: 創建預算設定表，用於儲存使用者的月度預算和警告門檻設定

CREATE TABLE IF NOT EXISTS budget_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    monthly_budget REAL NOT NULL DEFAULT 10000.0,
    warning_threshold INTEGER NOT NULL DEFAULT 80,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 創建索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_budget_settings_user_id ON budget_settings(user_id);

-- 註解
-- monthly_budget: 月度預算金額（台幣），預設 10000.0
-- warning_threshold: 警告門檻百分比（0-100），預設 80
