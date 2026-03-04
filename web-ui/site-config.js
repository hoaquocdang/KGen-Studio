/**
 * KGen Gallery — Site Configuration
 * ====================================
 * This file is generated from the Admin Panel (admin.html).
 * Upload this file to your hosting after configuring via admin.
 *
 * DO NOT share this file publicly — it contains API keys.
 */

window.SITE_CONFIG = {
    // ============================================================
    // API KEYS — Set these from the Admin Panel
    // ============================================================
    api: {
        // KGen / KGen API Token (primary)
        KGenToken: '',

        // OpenAI Compatible API
        openaiKey: '',
        openaiBase: 'https://api.openai.com',
        openaiModel: 'gpt-image-1.5',
    },

    // ============================================================
    // SUBSCRIPTION PLANS
    // ============================================================
    plans: {
        free: {
            name: 'Miễn phí',
            imageLimit: 10,
            price: 0,
            priceDisplay: 'Miễn phí',
            description: 'Dùng thử với 10 ảnh miễn phí',
        },
        pro: {
            name: 'Pro',
            imageLimit: 1000,
            price: 39000,
            priceDisplay: '39.000đ',
            description: '1.000 ảnh — Phù hợp cho nhà sáng tạo',
        },
        premium: {
            name: 'Premium',
            imageLimit: 99999,
            price: 199000,
            priceDisplay: '199.000đ',
            description: 'Không giới hạn — Cho chuyên gia',
        },
    },

    // ============================================================
    // ADMIN SETTINGS
    // ============================================================
    admin: {
        // SHA-256 hash of admin password (default: "admin2026")
        passwordHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        // Site name
        siteName: 'KGen Gallery',
    },

    // Version — used for cache busting
    version: '1.0.0',
    lastUpdated: '',
};
