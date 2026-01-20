-- 新增食材封存狀態欄位
-- 用於追蹤食材的處理歷史

-- 新增 status 欄位（預設為 active）
ALTER TABLE food_items
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' NOT NULL;

-- 新增 archived_at 欄位（封存時間）
ALTER TABLE food_items
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;

-- 新增 archived_by 欄位（封存者 ID）
ALTER TABLE food_items
ADD COLUMN IF NOT EXISTS archived_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- 為 status 欄位建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_food_items_status ON food_items(status);
