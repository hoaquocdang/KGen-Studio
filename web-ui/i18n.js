// ============================================================
// KGen Gallery — Internationalization (i18n)
// Supported: en, vi, ja, es, hi
// ============================================================

const SUPPORTED_LANGS = [
    { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
];

const TRANSLATIONS = {
    // ===== SIDEBAR =====
    'nav.home': { vi: 'Trang chủ', en: 'Home', ja: 'ホーム', es: 'Inicio', hi: 'होम' },
    'nav.search': { vi: 'Tìm kiếm', en: 'Search', ja: '検索', es: 'Buscar', hi: 'खोज' },
    'nav.history': { vi: 'Lịch sử', en: 'History', ja: '履歴', es: 'Historial', hi: 'इतिहास' },
    'nav.enhance': { vi: 'Nâng cấp Prompt', en: 'Upgrade Prompt', ja: 'プロンプト強化', es: 'Mejorar Prompt', hi: 'प्रॉम्प्ट अपग्रेड' },
    'nav.collection': { vi: 'Bộ sưu tập', en: 'My Collection', ja: 'コレクション', es: 'Mi Colección', hi: 'मेरा संग्रह' },
    'nav.recent': { vi: 'Cập nhật mới', en: 'Recent Updates', ja: '最新', es: 'Recientes', hi: 'हाल के' },
    'nav.aitools': { vi: 'Công cụ AI khác', en: 'Other AI Tools', ja: '他のAIツール', es: 'Otras Herramientas IA', hi: 'अन्य AI टूल' },
    'nav.seo': { vi: 'Công cụ SEO - AIO', en: 'SEO-AIO Tools', ja: 'SEOツール', es: 'Herramientas SEO', hi: 'SEO टूल' },
    'nav.docs': { vi: 'Tài liệu hướng dẫn', en: 'Documentation', ja: 'ドキュメント', es: 'Documentación', hi: 'दस्तावेज़' },
    'nav.categories': { vi: 'DANH MỤC', en: 'CATEGORIES', ja: 'カテゴリー', es: 'CATEGORÍAS', hi: 'श्रेणियाँ' },
    'nav.guide': { vi: 'HƯỚNG DẪN', en: 'GUIDE', ja: 'ガイド', es: 'GUÍA', hi: 'गाइड' },

    // ===== HOME TAB =====
    'home.title': { vi: 'AI Prompt', en: 'AI Prompt', ja: 'AIプロンプト', es: 'AI Prompt', hi: 'AI प्रॉम्प्ट' },
    'home.title2': { vi: 'Gallery', en: 'Gallery', ja: 'ギャラリー', es: 'Galería', hi: 'गैलरी' },
    'home.subtitle': { vi: 'Khám phá hàng ngàn prompt tạo ảnh chuyên nghiệp', en: 'Discover thousands of professional image prompts', ja: '何千ものプロフェッショナルな画像プロンプトを発見', es: 'Descubre miles de prompts profesionales', hi: 'हजारों पेशेवर इमेज प्रॉम्प्ट खोजें' },
    'home.search_placeholder': { vi: 'Tìm prompt theo từ khoá...', en: 'Search prompts by keyword...', ja: 'キーワードでプロンプトを検索...', es: 'Buscar prompts por palabra clave...', hi: 'कीवर्ड से प्रॉम्प्ट खोजें...' },
    'home.trending': { vi: '🔥 Trending', en: '🔥 Trending', ja: '🔥 トレンド', es: '🔥 Tendencias', hi: '🔥 ट्रेंडिंग' },
    'home.newest': { vi: '✨ Mới nhất', en: '✨ Newest', ja: '✨ 最新', es: '✨ Más nuevos', hi: '✨ नवीनतम' },
    'home.popular': { vi: '💎 Phổ biến', en: '💎 Popular', ja: '💎 人気', es: '💎 Popular', hi: '💎 लोकप्रिय' },

    // ===== GENERATE TAB =====
    'gen.title': { vi: 'Tạo ảnh', en: 'Generate', ja: '画像生成', es: 'Generar', hi: 'बनाएं' },
    'gen.title_accent': { vi: 'AI', en: 'AI', ja: 'AI', es: 'IA', hi: 'AI' },
    'gen.subtitle': { vi: 'Tạo ảnh từ prompt bằng AI', en: 'Create images from prompts with AI', ja: 'AIでプロンプトから画像を生成', es: 'Crea imágenes con IA', hi: 'AI से प्रॉम्प्ट से इमेज बनाएं' },
    'gen.prompt_label': { vi: 'Prompt của bạn', en: 'Your Prompt', ja: 'プロンプト', es: 'Tu Prompt', hi: 'आपका प्रॉम्प्ट' },
    'gen.prompt_placeholder': { vi: 'Mô tả hình ảnh bạn muốn tạo...', en: 'Describe the image you want to create...', ja: '作りたい画像を説明してください...', es: 'Describe la imagen que quieres crear...', hi: 'जो इमेज बनानी है उसका वर्णन करें...' },
    'gen.btn_generate': { vi: '✨ Tạo ảnh', en: '✨ Generate', ja: '✨ 生成', es: '✨ Generar', hi: '✨ बनाएं' },
    'gen.btn_enhance': { vi: '⬆ Nâng cấp prompt', en: '⬆ Enhance Prompt', ja: '⬆ プロンプト強化', es: '⬆ Mejorar Prompt', hi: '⬆ प्रॉम्प्ट सुधारें' },
    'gen.model': { vi: 'Model', en: 'Model', ja: 'モデル', es: 'Modelo', hi: 'मॉडल' },
    'gen.ratio': { vi: 'Tỷ lệ', en: 'Ratio', ja: '比率', es: 'Proporción', hi: 'अनुपात' },
    'gen.api_key': { vi: 'API Key', en: 'API Key', ja: 'APIキー', es: 'Clave API', hi: 'API कुंजी' },

    // ===== ENHANCE TAB =====
    'enhance.title': { vi: 'Nâng Cấp', en: 'Upgrade', ja: '強化', es: 'Mejorar', hi: 'अपग्रेड' },
    'enhance.title_accent': { vi: 'Prompt', en: 'Prompt', ja: 'プロンプト', es: 'Prompt', hi: 'प्रॉम्प्ट' },
    'enhance.subtitle': { vi: 'Biến ý tưởng đơn giản thành prompt chuyên nghiệp', en: 'Transform simple ideas into professional prompts', ja: 'シンプルなアイデアをプロのプロンプトに変換', es: 'Transforma ideas simples en prompts profesionales', hi: 'सरल विचारों को पेशेवर प्रॉम्प्ट में बदलें' },
    'enhance.input_label': { vi: 'Ý tưởng của bạn', en: 'Your idea', ja: 'あなたのアイデア', es: 'Tu idea', hi: 'आपका विचार' },
    'enhance.input_placeholder': { vi: 'VD: a cat in a garden, sunset portrait, product on marble table...', en: 'E.g.: a cat in a garden, sunset portrait, product on marble table...', ja: '例：庭の猫、夕日のポートレート、大理石のテーブルの製品...', es: 'Ej.: un gato en un jardín, retrato al atardecer...', hi: 'उदा.: बगीचे में बिल्ली, सूर्यास्त पोर्ट्रेट...' },
    'enhance.style_label': { vi: 'Phong cách', en: 'Style', ja: 'スタイル', es: 'Estilo', hi: 'शैली' },
    'enhance.mode_label': { vi: 'Chế độ sáng tạo', en: 'Creative Mode', ja: 'クリエイティブモード', es: 'Modo Creativo', hi: 'क्रिएटिव मोड' },
    'enhance.angle_label': { vi: 'Góc máy', en: 'Camera Angle', ja: 'カメラアングル', es: 'Ángulo de Cámara', hi: 'कैमरा एंगल' },
    'enhance.optional': { vi: '(tuỳ chọn)', en: '(optional)', ja: '（オプション）', es: '(opcional)', hi: '(वैकल्पिक)' },
    'enhance.btn': { vi: '✨ Nâng Cấp Prompt', en: '✨ Upgrade Prompt', ja: '✨ プロンプト強化', es: '✨ Mejorar Prompt', hi: '✨ प्रॉम्प्ट अपग्रेड' },
    'enhance.placeholder_text': { vi: 'Prompt nâng cấp sẽ hiển thị ở đây', en: 'Enhanced prompt will appear here', ja: '強化されたプロンプトがここに表示されます', es: 'El prompt mejorado aparecerá aquí', hi: 'अपग्रेड प्रॉम्प्ट यहाँ दिखेगा' },
    'enhance.use_btn': { vi: '🚀 Dùng prompt này để tạo ảnh', en: '🚀 Use this prompt to generate', ja: '🚀 このプロンプトで生成', es: '🚀 Usar este prompt para generar', hi: '🚀 इस प्रॉम्प्ट से बनाएं' },

    // Style options
    'style.realistic': { vi: 'Realistic', en: 'Realistic', ja: 'リアル', es: 'Realista', hi: 'रियलिस्टिक' },
    'style.anime': { vi: 'Anime', en: 'Anime', ja: 'アニメ', es: 'Anime', hi: 'एनीमे' },
    'style.illustration': { vi: 'Illustration', en: 'Illustration', ja: 'イラスト', es: 'Ilustración', hi: 'इलस्ट्रेशन' },

    // Mode options
    'mode.default': { vi: 'Mặc định', en: 'Default', ja: 'デフォルト', es: 'Predeterminado', hi: 'डिफ़ॉल्ट' },
    'mode.infographic': { vi: 'Infographic', en: 'Infographic', ja: 'インフォグラフィック', es: 'Infografía', hi: 'इन्फोग्राफिक' },
    'mode.removebg': { vi: 'Tách nền', en: 'Remove BG', ja: '背景除去', es: 'Quitar Fondo', hi: 'बैकग्राउंड हटाएं' },
    'mode.storyboard': { vi: 'Storyboard', en: 'Storyboard', ja: 'ストーリーボード', es: 'Guión Gráfico', hi: 'स्टोरीबोर्ड' },

    // Angle options
    'angle.auto': { vi: 'Tự động', en: 'Auto', ja: '自動', es: 'Auto', hi: 'ऑटो' },
    'angle.front': { vi: 'Chính diện', en: 'Front', ja: '正面', es: 'Frontal', hi: 'सामने' },
    'angle.wide': { vi: 'Toàn cảnh', en: 'Wide', ja: 'ワイド', es: 'Panorámica', hi: 'वाइड' },
    'angle.shoulder': { vi: 'Ngang vai', en: 'Over Shoulder', ja: '肩越し', es: 'Sobre Hombro', hi: 'कंधे से' },
    'angle.low': { vi: 'Dưới lên', en: 'Low Angle', ja: 'ローアングル', es: 'Contrapicado', hi: 'लो एंगल' },
    'angle.high': { vi: 'Trên xuống', en: 'High Angle', ja: 'ハイアングル', es: 'Picado', hi: 'हाई एंगल' },
    'angle.behind': { vi: 'Sau lưng', en: 'Behind', ja: '背後', es: 'Detrás', hi: 'पीछे से' },

    // ===== SEARCH TAB =====
    'search.title': { vi: 'Tìm kiếm', en: 'Search', ja: '検索', es: 'Buscar', hi: 'खोज' },
    'search.title_accent': { vi: 'Prompt', en: 'Prompts', ja: 'プロンプト', es: 'Prompts', hi: 'प्रॉम्प्ट' },
    'search.placeholder': { vi: 'Tìm theo từ khoá, phong cách, chủ đề...', en: 'Search by keyword, style, topic...', ja: 'キーワード、スタイル、トピックで検索...', es: 'Buscar por palabra clave, estilo, tema...', hi: 'कीवर्ड, स्टाइल, विषय से खोजें...' },

    // ===== HISTORY TAB =====
    'history.title': { vi: 'Lịch sử', en: 'History', ja: '履歴', es: 'Historial', hi: 'इतिहास' },
    'history.title_accent': { vi: 'tạo ảnh', en: 'Generation', ja: '生成', es: 'Generación', hi: 'जेनरेशन' },

    // ===== MODAL =====
    'modal.copy': { vi: '📋 Copy Prompt', en: '📋 Copy Prompt', ja: '📋 コピー', es: '📋 Copiar', hi: '📋 कॉपी' },
    'modal.generate': { vi: '🎨 Tạo ảnh từ prompt', en: '🎨 Generate from prompt', ja: '🎨 プロンプトから生成', es: '🎨 Generar desde prompt', hi: '🎨 प्रॉम्प्ट से बनाएं' },
    'modal.prompt_label': { vi: 'Prompt', en: 'Prompt', ja: 'プロンプト', es: 'Prompt', hi: 'प्रॉम्प्ट' },
    'modal.locked': { vi: '🔒 Nội dung dành cho thành viên Pro', en: '🔒 Pro members only', ja: '🔒 Proメンバー限定', es: '🔒 Solo miembros Pro', hi: '🔒 केवल Pro सदस्य' },

    // ===== PRICING =====
    'pricing.title': { vi: 'Nâng cấp tài khoản', en: 'Upgrade Account', ja: 'アカウントアップグレード', es: 'Mejorar Cuenta', hi: 'अकाउंट अपग्रेड' },
    'pricing.footer': { vi: '🔒 Thanh toán an toàn qua Stripe', en: '🔒 Secure payment via Stripe', ja: '🔒 Stripeによる安全な決済', es: '🔒 Pago seguro con Stripe', hi: '🔒 Stripe से सुरक्षित भुगतान' },
    'pricing.footer_sub': { vi: 'Hủy bất kỳ lúc nào. Không cam kết dài hạn.', en: 'Cancel anytime. No long-term commitment.', ja: 'いつでもキャンセル可能。', es: 'Cancela cuando quieras.', hi: 'कभी भी रद्द करें।' },

    // ===== COMMON =====
    'common.copy': { vi: 'Copy', en: 'Copy', ja: 'コピー', es: 'Copiar', hi: 'कॉपी' },
    'common.close': { vi: 'Đóng', en: 'Close', ja: '閉じる', es: 'Cerrar', hi: 'बंद' },
    'common.save': { vi: 'Lưu', en: 'Save', ja: '保存', es: 'Guardar', hi: 'सेव' },
    'common.cancel': { vi: 'Huỷ', en: 'Cancel', ja: 'キャンセル', es: 'Cancelar', hi: 'रद्द' },
    'common.loading': { vi: 'Đang tải...', en: 'Loading...', ja: '読み込み中...', es: 'Cargando...', hi: 'लोड हो रहा है...' },
    'common.login': { vi: 'Đăng nhập', en: 'Sign In', ja: 'ログイン', es: 'Iniciar Sesión', hi: 'साइन इन' },
    'common.signup': { vi: 'Đăng ký', en: 'Sign Up', ja: '登録', es: 'Registrarse', hi: 'साइन अप' },
    'common.upgrade': { vi: 'Nâng cấp Pro', en: 'Upgrade Pro', ja: 'Proにアップグレード', es: 'Mejorar a Pro', hi: 'Pro अपग्रेड' },
    'common.language': { vi: 'Ngôn ngữ', en: 'Language', ja: '言語', es: 'Idioma', hi: 'भाषा' },

    // ===== TOASTS =====
    'toast.copied': { vi: '📋 Đã copy prompt!', en: '📋 Prompt copied!', ja: '📋 コピーしました！', es: '📋 ¡Prompt copiado!', hi: '📋 प्रॉम्प्ट कॉपी हुआ!' },
    'toast.enhanced': { vi: '✨ Prompt đã được nâng cấp!', en: '✨ Prompt enhanced!', ja: '✨ プロンプトが強化されました！', es: '✨ ¡Prompt mejorado!', hi: '✨ प्रॉम्प्ट अपग्रेड हुआ!' },
    'toast.generating': { vi: '⏳ Đang tạo ảnh...', en: '⏳ Generating image...', ja: '⏳ 画像生成中...', es: '⏳ Generando imagen...', hi: '⏳ इमेज बन रही है...' },
    'toast.error_input': { vi: 'Vui lòng nhập ý tưởng', en: 'Please enter an idea', ja: 'アイデアを入力してください', es: 'Por favor ingresa una idea', hi: 'कृपया एक विचार दर्ज करें' },
};

// ============================================================
// CURRENCY CONVERSION (Frankfurter API — ECB data, free)
// ============================================================

// Base prices in VND
const BASE_PRICES_VND = {
    free: 0,
    pro: 39000,
    premium: 199000,
};

// Lang → Currency mapping
const LANG_CURRENCY = {
    vi: { code: 'VND', symbol: 'đ', position: 'after', decimals: 0, locale: 'vi-VN' },
    en: { code: 'USD', symbol: '$', position: 'before', decimals: 2, locale: 'en-US' },
    ja: { code: 'JPY', symbol: '¥', position: 'before', decimals: 0, locale: 'ja-JP' },
    es: { code: 'EUR', symbol: '€', position: 'after', decimals: 2, locale: 'es-ES' },
    hi: { code: 'INR', symbol: '₹', position: 'before', decimals: 0, locale: 'hi-IN' },
};

// Fallback rates (VND → X), updated manually as backup
const FALLBACK_RATES = {
    VND: 1,
    USD: 1 / 25500,
    JPY: 1 / 170,
    EUR: 1 / 27500,
    INR: 1 / 305,
};

const RATES_CACHE_KEY = 'kgen_fx_rates';
const RATES_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

let _cachedRates = null;

async function fetchExchangeRates() {
    // Check cache first
    try {
        const cached = JSON.parse(localStorage.getItem(RATES_CACHE_KEY) || 'null');
        if (cached && (Date.now() - cached.timestamp) < RATES_CACHE_TTL) {
            _cachedRates = cached.rates;
            return cached.rates;
        }
    } catch (e) { /* ignore */ }

    // Fetch from Frankfurter API (ECB data)
    try {
        const res = await fetch('https://api.frankfurter.app/latest?from=VND&to=USD,JPY,EUR');
        if (res.ok) {
            const data = await res.json();
            // Frankfurter doesn't support VND as base, so use USD as base and convert
            // Alternative: fetch USD-based rates and inverse
        }
    } catch (e) { /* API might not support VND directly */ }

    // Better approach: use USD as base (Frankfurter supports it well)
    try {
        const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=EUR,JPY,INR');
        if (res.ok) {
            const data = await res.json();
            // 1 USD = X of target currency
            const rates = {
                VND: 1,
                USD: 1 / 25500, // VND → USD
                EUR: (1 / 25500) * data.rates.EUR, // VND → USD → EUR
                JPY: (1 / 25500) * data.rates.JPY, // VND → USD → JPY
                INR: (1 / 25500) * data.rates.INR, // VND → USD → INR
            };
            _cachedRates = rates;
            localStorage.setItem(RATES_CACHE_KEY, JSON.stringify({
                rates,
                timestamp: Date.now(),
                source: 'frankfurter.app (ECB)'
            }));
            return rates;
        }
    } catch (e) {
        console.warn('FX API unavailable, using fallback rates');
    }

    _cachedRates = FALLBACK_RATES;
    return FALLBACK_RATES;
}

function convertPrice(vndAmount) {
    const lang = getCurrentLang();
    const currency = LANG_CURRENCY[lang] || LANG_CURRENCY.vi;
    const rates = _cachedRates || FALLBACK_RATES;
    const rate = rates[currency.code] || 1;

    const converted = vndAmount * rate;

    // Format number
    let formatted;
    if (currency.decimals === 0) {
        formatted = Math.round(converted).toLocaleString(currency.locale);
    } else {
        formatted = converted.toFixed(currency.decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    // Position symbol
    if (currency.position === 'before') {
        return currency.symbol + formatted;
    } else {
        return formatted + currency.symbol;
    }
}

function getPriceForLang(tierPriceVND) {
    return convertPrice(tierPriceVND);
}

function getCurrencyPeriod() {
    const lang = getCurrentLang();
    const periods = {
        vi: '/tháng',
        en: '/month',
        ja: '/月',
        es: '/mes',
        hi: '/महीना',
    };
    return periods[lang] || '/month';
}

// Update setLang to also refresh pricing
const _originalSetLang = setLang;
function setLangWithPricing(langCode) {
    _originalSetLang(langCode);
    // Re-render pricing if visible
    if (typeof setupPricing === 'function') setupPricing();
    if (typeof renderPricingModal === 'function') {
        const modal = document.getElementById('pricing-modal-overlay');
        if (modal) renderPricingModal();
    }
}

// Init: fetch rates on load
fetchExchangeRates();

// Export
window.t = t;
window.setLang = setLangWithPricing;
window.getCurrentLang = getCurrentLang;
window.applyTranslations = applyTranslations;
window.createLangPicker = createLangPicker;
window.toggleLangMenu = toggleLangMenu;
window.selectLang = function (code) {
    setLangWithPricing(code);
    document.querySelectorAll('.lang-option').forEach(opt => {
        opt.classList.toggle('active', opt.textContent.trim().includes(SUPPORTED_LANGS.find(l => l.code === code)?.name || ''));
    });
    toggleLangMenu();
};
window.convertPrice = convertPrice;
window.getPriceForLang = getPriceForLang;
window.getCurrencyPeriod = getCurrencyPeriod;
window.BASE_PRICES_VND = BASE_PRICES_VND;
window.LANG_CURRENCY = LANG_CURRENCY;
window.fetchExchangeRates = fetchExchangeRates;
