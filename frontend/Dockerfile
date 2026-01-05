# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# 複製 package files
COPY package*.json ./

# 安裝依賴（使用 ci 更快更可靠）
RUN npm ci --only=production=false

# 複製原始碼
COPY . .

# 建置應用（環境變數會在 runtime 透過 nginx 注入）
RUN npm run build

# Production stage
FROM nginx:alpine

# 複製建置好的檔案
COPY --from=builder /app/dist /usr/share/nginx/html

# 複製 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 8080

# 啟動 nginx
CMD ["nginx", "-g", "daemon off;"]
