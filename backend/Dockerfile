FROM python:3.11-slim

WORKDIR /app

# 安裝系統依賴
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# 安裝 uv
RUN pip install --no-cache-dir uv

# 複製依賴檔案
COPY pyproject.toml uv.lock ./

# 安裝 Python 依賴
RUN uv sync --frozen --no-dev

# 複製專案檔案
COPY src ./src
COPY alembic.ini ./
COPY alembic ./alembic

# 暴露端口
EXPOSE 8000

# 啟動指令（先執行遷移，再啟動應用）
CMD ["sh", "-c", "uv run alembic upgrade head && uv run uvicorn src.main:app --host 0.0.0.0 --port 8000"]
