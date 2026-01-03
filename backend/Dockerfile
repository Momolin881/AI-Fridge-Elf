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
COPY pyproject.toml ./

# 安裝 Python 依賴
RUN uv sync --no-dev

# 複製專案檔案
COPY src ./src

# 暴露端口
EXPOSE 8080

# 啟動指令
CMD ["sh", "-c", "uv run uvicorn src.main:app --host 0.0.0.0 --port 8080"]
