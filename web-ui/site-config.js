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
        // Google Gemini API Key (for Nanobanana Pro / Nanobanana 2)
        geminiApiKey: '',

        // OpenRouter API Key (for GPT Image 1, DALL-E 3, Flux, SDXL, etc.)
        openrouterApiKey: '',

        // KGen / MeiGen API Token (legacy)
        KGenToken: '',

        // OpenAI Compatible API (direct, not through OpenRouter)
        openaiKey: '',
        openaiBase: 'https://api.openai.com',
        openaiModel: 'gpt-image-1',
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
            description: 'Dùng thử với 10 ảnh — thêm API key để tiếp tục',
        },
        pro: {
            name: 'Pro',
            imageLimit: 1000,
            price: 39000,
            priceDisplay: '39.000đ/tháng',
            description: '1.000 token / tháng — Cho nhà sáng tạo',
        },
        premium: {
            name: 'Premium',
            imageLimit: 5000,
            price: 199000,
            priceDisplay: '199.000đ/tháng',
            description: '5.000 token / tháng — Cho chuyên gia',
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
