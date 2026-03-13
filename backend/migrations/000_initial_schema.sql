-- 初始資料庫架構
-- 000_initial_schema.sql

-- 創建 users 表
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    line_user_id VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    picture_url VARCHAR(512),
    storage_mode VARCHAR(20) DEFAULT 'simple' NOT NULL,
    onboarding_progress JSON DEFAULT '{
        "is_completed": false,
        "completed_at": null,
        "tasks": {
            "photo_upload": {
                "completed": false,
                "completed_at": null
            },
            "mark_consumed": {
                "completed": false,
                "completed_at": null  
            },
            "recipe_view": {
                "completed": false,
                "completed_at": null
            }
        },
        "achievement_sent": false
    }',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 創建 fridges 表
CREATE TABLE IF NOT EXISTS fridges (
    id SERIAL PRIMARY KEY,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 創建 fridge_members 表
CREATE TABLE IF NOT EXISTS fridge_members (
    id SERIAL PRIMARY KEY,
    fridge_id INTEGER NOT NULL REFERENCES fridges(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member' NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(fridge_id, user_id)
);

-- 創建 food_items 表
CREATE TABLE IF NOT EXISTS food_items (
    id SERIAL PRIMARY KEY,
    fridge_id INTEGER NOT NULL REFERENCES fridges(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    quantity DECIMAL(10,2),
    unit VARCHAR(20),
    compartment VARCHAR(20),
    compartment_sort_order INTEGER DEFAULT 0,
    expiry_date DATE,
    purchase_date DATE,
    cost DECIMAL(10,2),
    is_expired BOOLEAN DEFAULT false NOT NULL,
    is_consumed BOOLEAN DEFAULT false NOT NULL,
    consumed_at TIMESTAMP,
    image_url VARCHAR(512),
    notes TEXT,
    archive_status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 創建 recipes 表
CREATE TABLE IF NOT EXISTS recipes (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    ingredients TEXT NOT NULL,
    instructions TEXT NOT NULL,
    prep_time INTEGER,
    cook_time INTEGER,
    servings INTEGER,
    difficulty VARCHAR(20),
    cuisine_type VARCHAR(50),
    image_url VARCHAR(512),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 創建 user_recipes 表
CREATE TABLE IF NOT EXISTS user_recipes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    notes TEXT,
    last_cooked DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(user_id, recipe_id)
);

-- 創建 budget_settings 表
CREATE TABLE IF NOT EXISTS budget_settings (
    id SERIAL PRIMARY KEY,
    fridge_id INTEGER NOT NULL REFERENCES fridges(id) ON DELETE CASCADE,
    monthly_budget DECIMAL(10,2),
    warning_threshold DECIMAL(5,2) DEFAULT 80.00,
    is_enabled BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(fridge_id)
);

-- 創建 notification_settings 表
CREATE TABLE IF NOT EXISTS notification_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expiry_reminder BOOLEAN DEFAULT true NOT NULL,
    budget_warning BOOLEAN DEFAULT true NOT NULL,
    weekly_report BOOLEAN DEFAULT true NOT NULL,
    monthly_report BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(user_id)
);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_users_line_user_id ON users(line_user_id);
CREATE INDEX IF NOT EXISTS idx_fridges_owner_id ON fridges(owner_id);
CREATE INDEX IF NOT EXISTS idx_fridge_members_fridge_id ON fridge_members(fridge_id);
CREATE INDEX IF NOT EXISTS idx_fridge_members_user_id ON fridge_members(user_id);
CREATE INDEX IF NOT EXISTS idx_food_items_fridge_id ON food_items(fridge_id);
CREATE INDEX IF NOT EXISTS idx_food_items_expiry_date ON food_items(expiry_date);
CREATE INDEX IF NOT EXISTS idx_user_recipes_user_id ON user_recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_settings_fridge_id ON budget_settings(fridge_id);
CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON notification_settings(user_id);