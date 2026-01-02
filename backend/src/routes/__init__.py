"""
API 路由模組

包含所有 FastAPI 路由定義。
"""

from src.routes import food_items, fridges, line_webhook, notifications, budget, recipes

__all__ = [
    "food_items",
    "fridges",
    "line_webhook",
    "notifications",
    "budget",
    "recipes",
]
