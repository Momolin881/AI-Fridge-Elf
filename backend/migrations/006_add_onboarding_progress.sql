-- 新增用戶新手引導進度追蹤欄位
-- 006_add_onboarding_progress.sql

ALTER TABLE users 
ADD COLUMN onboarding_progress JSON DEFAULT '{
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
}';