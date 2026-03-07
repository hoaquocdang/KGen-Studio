#!/bin/bash
# ============================================================
# KGen Gallery — Auto Deploy Script
# Chạy trên VPS: bash deploy.sh
# ============================================================

set -e

APP_DIR="/opt/kgen-gallery"
REPO_URL="https://github.com/hoaquocdang/KGen-Studio.git"

echo "🚀 Đang deploy KGen Gallery..."

# 1. Tạo thư mục app nếu chưa có
if [ ! -d "$APP_DIR" ]; then
    echo "📁 Tạo thư mục $APP_DIR..."
    mkdir -p "$APP_DIR"
fi

# 2. Clone hoặc Pull code mới nhất
if [ -d "$APP_DIR/.git" ]; then
    echo "📥 Pulling code mới nhất..."
    cd "$APP_DIR"
    git pull origin main
else
    echo "📥 Cloning repository..."
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# 3. Copy deploy files vào đúng chỗ
echo "📋 Copy cấu hình deploy..."
cp -f deploy/docker-compose.yml docker-compose.yml
cp -f deploy/nginx.conf nginx.conf

# 4. Kiểm tra Traefik network
if ! docker network ls | grep -q traefik-network; then
    echo "🌐 Tạo traefik network..."
    docker network create traefik-network
fi

# 5. Build & Deploy
echo "🐳 Khởi động container..."
docker compose down 2>/dev/null || true
docker compose up -d

echo ""
echo "✅ Deploy thành công!"
echo "📊 Trạng thái:"
docker compose ps
echo ""
echo "🔗 Website sẽ hoạt động tại domain đã cấu hình"
