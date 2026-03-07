/**
 * KGen Gallery — Site Configuration
 * ====================================
 * ⚠️  QUAN TRỌNG: File này chứa API key thật.
 * - File này ĐÃ ĐƯỢC thêm vào .gitignore — KHÔNG bao giờ lên GitHub
 * - Chỉ upload trực tiếp lên hosting khi deploy
 */

window.SITE_CONFIG = {
    // ============================================================
    // API KEYS — Kie AI (Nanobanana Pro)
    // ============================================================
    api: {
        // Kie AI API Key (for Nanobanana Pro image generation)
        kieApiKey: '',

        // Kie AI API Base URL
        kieApiBase: 'https://api.kie.ai',

        // Model name
        kieModel: 'nano-banana-pro',
    },

    // ============================================================
    // QUOTA — Giới hạn sử dụng theo gói
    // ============================================================
    plans: {
        free: {
            name: 'Miễn phí',
            imageLimit: 5,
            price: 0,
            priceDisplay: 'Miễn phí',
            description: 'Dùng thử 5 ảnh — thêm API key riêng để tạo không giới hạn',
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

    // ============================================================
    // ADMIN SETTINGS
    // ============================================================
    admin: {
        passwordHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        siteName: 'KGen Gallery',
    },

    version: '2.0.0',
    lastUpdated: '2026-03-07',
};
