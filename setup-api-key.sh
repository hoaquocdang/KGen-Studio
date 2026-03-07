#!/bin/bash
# ==================================================
# KGen Gallery — Setup API Key trên VPS
# Chạy trên VPS sau khi SSH vào
# ==================================================

echo "🔑 KGen Gallery — Cấu hình API Key"
echo "=================================="
echo ""

read -p "Nhập Kie AI API Key: " KIE_KEY

if [ -z "$KIE_KEY" ]; then
    echo "❌ Bạn chưa nhập key. Thoát."
    exit 1
fi

# Tìm thư mục web-ui
WEB_DIR="/opt/kgen-gallery/web-ui"
if [ ! -d "$WEB_DIR" ]; then
    WEB_DIR=$(find /opt -name "web-ui" -type d 2>/dev/null | head -1)
fi
if [ ! -d "$WEB_DIR" ]; then
    echo "❌ Không tìm thấy thư mục web-ui. Nhập đường dẫn:"
    read -p "Đường dẫn: " WEB_DIR
fi

CONFIG_FILE="$WEB_DIR/site-config.js"

cat > "$CONFIG_FILE" << ENDOFFILE
/**
 * KGen Gallery — Site Configuration
 * ====================================
 * ⚠️  File này chứa API key thật.
 * - KHÔNG commit lên GitHub
 * - Chỉ đặt trực tiếp trên server
 */

window.SITE_CONFIG = {
    api: {
        kieApiKey: '${KIE_KEY}',
        kieApiBase: 'https://api.kie.ai',
        kieModel: 'nano-banana-pro',
    },

    plans: {
        free: {
            name: 'Miễn phí',
            imageLimit: 10,
            price: 0,
            priceDisplay: 'Miễn phí',
            description: 'Dùng thử 10 ảnh — thêm Google API key để tạo không giới hạn',
        },
        pro: {
            name: 'Pro',
            imageLimit: 1000,
            price: 39000,
            priceDisplay: '39.000đ/tháng',
            description: '1.000 ảnh / tháng',
        },
        premium: {
            name: 'Premium',
            imageLimit: 5000,
            price: 199000,
            priceDisplay: '199.000đ/tháng',
            description: '5.000 ảnh / tháng',
        },
    },

    admin: {
        siteName: 'KGen Gallery',
    },

    version: '2.1.0',
    lastUpdated: '$(date +%Y-%m-%d)',
};
ENDOFFILE

echo ""
echo "✅ Đã tạo file: $CONFIG_FILE"
echo "📦 Restart container..."
cd /opt/kgen-gallery && docker compose restart
echo "🎉 Hoàn tất! Kiểm tra tại https://kgen.cloud"
