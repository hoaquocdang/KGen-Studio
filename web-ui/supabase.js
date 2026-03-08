/**
 * KGen Studio — Supabase Backend & Stripe Payment Module
 * Handles: Auth, Database, Subscriptions, Payments
 */

// ============================================================
// SUPABASE CONFIG
// ============================================================

const SUPABASE_CONFIG = {
    url: '', // Will be loaded from settings
    anonKey: '', // Will be loaded from settings
};

let supabaseClient = null;

function getSupabaseConfig() {
    const settings = JSON.parse(localStorage.getItem('kgen_settings') || '{}');
    return {
        url: settings.supabaseUrl || '',
        anonKey: settings.supabaseAnonKey || '',
    };
}

function initSupabase() {
    const config = getSupabaseConfig();
    if (!config.url || !config.anonKey) {
        console.log('Supabase not configured. Using localStorage fallback.');
        return false;
    }

    if (typeof window.supabase === 'undefined') {
        console.warn('Supabase SDK not loaded yet.');
        return false;
    }

    try {
        supabaseClient = window.supabase.createClient(config.url, config.anonKey);
        console.log('✅ Supabase initialized');
        return true;
    } catch (error) {
        console.error('Supabase init error:', error);
        return false;
    }
}

function isSupabaseEnabled() {
    return supabaseClient !== null;
}

// ============================================================
// SUPABASE AUTH
// ============================================================

async function supabaseSignUp(email, password, name) {
    if (!isSupabaseEnabled()) return { error: 'Supabase not configured' };

    const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
            data: { name, tier: 'free' },
        },
    });

    if (error) return { error: error.message };

    // Create profile
    if (data.user) {
        await supabaseClient.from('profiles').upsert({
            id: data.user.id,
            email: data.user.email,
            name: name,
            tier: 'free',
            created_at: new Date().toISOString(),
        });
    }

    return { data };
}

async function supabaseSignIn(email, password) {
    if (!isSupabaseEnabled()) return { error: 'Supabase not configured' };

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
    });

    if (error) return { error: error.message };
    return { data };
}

async function supabaseSignInWithGoogle() {
    if (!isSupabaseEnabled()) return { error: 'Supabase not configured' };

    const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin + window.location.pathname,
        },
    });

    if (error) return { error: error.message };
    return { data };
}

async function supabaseSignOut() {
    if (!isSupabaseEnabled()) return;
    await supabaseClient.auth.signOut();
}

async function supabaseGetUser() {
    if (!isSupabaseEnabled()) return null;

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return null;

    // Get profile with subscription info
    const { data: profile } = await supabaseClient
        .from('profiles')
        .select('*, subscriptions(*)')
        .eq('id', user.id)
        .single();

    return {
        id: user.id,
        email: user.email,
        name: profile?.name || user.user_metadata?.name || user.email.split('@')[0],
        picture: user.user_metadata?.avatar_url || profile?.avatar_url || '',
        tier: profile?.tier || 'free',
        provider: user.app_metadata?.provider || 'email',
        subscription: profile?.subscriptions?.[0] || null,
    };
}

// Listen for auth changes
function onAuthStateChange(callback) {
    if (!isSupabaseEnabled()) return;

    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
            // Auto-create profile on first login
            const { data: existing } = await supabaseClient
                .from('profiles')
                .select('id')
                .eq('id', session.user.id)
                .single();

            if (!existing) {
                await supabaseClient.from('profiles').insert({
                    id: session.user.id,
                    email: session.user.email,
                    name: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
                    avatar_url: session.user.user_metadata?.avatar_url || '',
                    tier: 'free',
                });
            }
        }
        callback(event, session);
    });
}

// ============================================================
// USER PROFILE & SUBSCRIPTION
// ============================================================

async function getUserTier() {
    if (!isSupabaseEnabled()) {
        // Fallback to localStorage
        const session = JSON.parse(localStorage.getItem('kgen_session') || 'null');
        return session?.tier || 'free';
    }

    const user = await supabaseGetUser();
    return user?.tier || 'free';
}

async function updateUserTier(userId, tier) {
    if (!isSupabaseEnabled()) return;

    await supabaseClient
        .from('profiles')
        .update({ tier })
        .eq('id', userId);
}

// ============================================================
// PROMPT FAVORITES
// ============================================================

async function toggleFavorite(promptId) {
    if (!isSupabaseEnabled()) {
        // localStorage fallback
        const favs = JSON.parse(localStorage.getItem('kgen_favorites') || '[]');
        const idx = favs.indexOf(promptId);
        if (idx >= 0) favs.splice(idx, 1);
        else favs.push(promptId);
        localStorage.setItem('kgen_favorites', JSON.stringify(favs));
        return favs.includes(promptId);
    }

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return false;

    const { data: existing } = await supabaseClient
        .from('prompt_favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('prompt_id', promptId)
        .single();

    if (existing) {
        await supabaseClient.from('prompt_favorites').delete().eq('id', existing.id);
        return false;
    } else {
        await supabaseClient.from('prompt_favorites').insert({
            user_id: user.id,
            prompt_id: promptId,
        });
        return true;
    }
}

async function getFavorites() {
    if (!isSupabaseEnabled()) {
        return JSON.parse(localStorage.getItem('kgen_favorites') || '[]');
    }

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return [];

    const { data } = await supabaseClient
        .from('prompt_favorites')
        .select('prompt_id')
        .eq('user_id', user.id);

    return (data || []).map(f => f.prompt_id);
}


// ============================================================
// USAGE TRACKING
// ============================================================

async function logUsage(action, promptId) {
    if (!isSupabaseEnabled()) {
        // localStorage fallback
        const today = new Date().toISOString().split('T')[0];
        const key = `kgen_usage_${today}`;
        const usage = JSON.parse(localStorage.getItem(key) || '{"copies":0,"views":0}');
        if (action === 'copy') usage.copies++;
        if (action === 'view') usage.views++;
        localStorage.setItem(key, JSON.stringify(usage));
        return usage;
    }

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;

    await supabaseClient.from('usage_logs').insert({
        user_id: user.id,
        action,
        prompt_id: promptId,
    });
}

async function getDailyUsage() {
    if (!isSupabaseEnabled()) {
        const today = new Date().toISOString().split('T')[0];
        const key = `kgen_usage_${today}`;
        return JSON.parse(localStorage.getItem(key) || '{"copies":0,"views":0}');
    }

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return { copies: 0, views: 0 };

    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabaseClient
        .from('usage_logs')
        .select('action')
        .eq('user_id', user.id)
        .gte('created_at', today);

    const copies = (data || []).filter(l => l.action === 'copy').length;
    const views = (data || []).filter(l => l.action === 'view').length;
    return { copies, views };
}

function getUsageLimit(tier) {
    const limits = {
        free: { copies: 5, views: 50 },
        pro: { copies: 50, views: 500 },
        premium: { copies: -1, views: -1 }, // -1 = unlimited
    };
    return limits[tier] || limits.free;
}

// ============================================================
// USER COLLECTION (Saved Images & Prompts)
// ============================================================

/**
 * Save an image + prompt to user's collection
 * @param {Object} item - { imageUrl, prompt, model, quality, aspectRatio }
 */
async function saveToCollection(item) {
    const entry = {
        id: 'col_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        image_url: item.imageUrl,
        prompt: item.prompt,
        model: item.model || 'nanobanana-pro',
        quality: item.quality || '2K',
        aspect_ratio: item.aspectRatio || '1:1',
        saved_at: new Date().toISOString(),
    };

    function saveToLocal(entryObj) {
        let collection = JSON.parse(localStorage.getItem('kgen_collection') || '[]');
        collection.unshift(entryObj);

        let saved = false;
        // Limit base64 images aggressively to 5 items, normal URLs to 100
        const maxItems = (entryObj.image_url && entryObj.image_url.startsWith('data:')) ? 5 : 100;

        while (!saved && collection.length > 0) {
            if (collection.length > maxItems) {
                collection.length = maxItems;
            }
            try {
                localStorage.setItem('kgen_collection', JSON.stringify(collection));
                saved = true;
            } catch (e) {
                // Remove oldest item on quota exception and try again
                collection.pop();
            }
        }
        if (collection.length === 0) {
            throw new Error('Bộ nhớ trình duyệt đầy, vui lòng đăng nhập để lưu trực tuyến.');
        }
    }

    if (!isSupabaseEnabled()) {
        saveToLocal(entry);
        return entry;
    }

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        saveToLocal(entry);
        return entry;
    }

    const { data, error } = await supabaseClient.from('user_collections').insert({
        user_id: user.id,
        image_url: entry.image_url,
        prompt: entry.prompt,
        model: entry.model,
        quality: entry.quality,
        aspect_ratio: entry.aspect_ratio,
    }).select().single();

    if (error) {
        console.error('Supabase save error:', error);
        saveToLocal(entry);
    }

    return data || entry;
}

/**
 * Remove an item from collection
 */
async function removeFromCollection(itemId) {
    if (!isSupabaseEnabled()) {
        const collection = JSON.parse(localStorage.getItem('kgen_collection') || '[]');
        const filtered = collection.filter(c => c.id !== itemId);
        localStorage.setItem('kgen_collection', JSON.stringify(filtered));
        return true;
    }

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return false;

    await supabaseClient
        .from('user_collections')
        .delete()
        .eq('id', itemId)
        .eq('user_id', user.id);

    return true;
}

/**
 * Get user's saved collection
 * @param {number} limit - Max items to return
 */
async function getCollection(limit = 50) {
    if (!isSupabaseEnabled()) {
        const collection = JSON.parse(localStorage.getItem('kgen_collection') || '[]');
        return collection.slice(0, limit);
    }

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        return JSON.parse(localStorage.getItem('kgen_collection') || '[]').slice(0, limit);
    }

    const { data, error } = await supabaseClient
        .from('user_collections')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Supabase fetch error:', error);
        return JSON.parse(localStorage.getItem('kgen_collection') || '[]').slice(0, limit);
    }

    return data || [];
}

/**
 * Check if an image URL is already in collection
 */
async function isInCollection(imageUrl) {
    if (!isSupabaseEnabled()) {
        const collection = JSON.parse(localStorage.getItem('kgen_collection') || '[]');
        return collection.some(c => c.image_url === imageUrl);
    }

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return false;

    const { data } = await supabaseClient
        .from('user_collections')
        .select('id')
        .eq('user_id', user.id)
        .eq('image_url', imageUrl)
        .limit(1);

    return (data || []).length > 0;
}


// ============================================================
// VIETQR PAYMENT
// ============================================================

function createCheckoutSession(tier) {
    const pCfg = (window.SITE_CONFIG && window.SITE_CONFIG.payment) || { bankId: 'MB', accountNo: '3333333333', accountName: 'TEST' };
    const user = APP_STATE.currentUser;

    if (!user) {
        showToast('Vui lòng đăng nhập trước khi mua gói', 'error');
        openAuthModal();
        return;
    }

    const priceVnd = tier === 'pro' ? 39000 : 199000;
    const rndCode = Math.floor(Math.random() * 90000) + 10000;
    const orderCode = `KGEN ${tier.toUpperCase()} ${rndCode}`;
    const qrUrl = `https://img.vietqr.io/image/${pCfg.bankId}-${pCfg.accountNo}-compact2.png?amount=${priceVnd}&addInfo=${encodeURIComponent(orderCode)}&accountName=${encodeURIComponent(pCfg.accountName)}`;

    // Generate Modal HTML
    const existing = document.getElementById('qr-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'qr-modal-overlay';
    overlay.className = 'pricing-overlay'; // reuse styling
    overlay.style.zIndex = '10000';

    overlay.innerHTML = `
        <div class="pricing-modal" style="max-width:400px; text-align:center;">
            <button class="modal-close" id="qr-close">&times;</button>
            <div class="pricing-header" style="margin-bottom:16px;">
                <h2 class="pricing-title">Thanh Toán VietQR</h2>
                <p class="pricing-subtitle" style="margin-top:8px;">Gói <strong>${tier.toUpperCase()}</strong> - ${priceVnd.toLocaleString('vi')}đ</p>
            </div>
            
            <div style="background:white; padding:16px; border-radius:16px; margin-bottom:20px; box-shadow:0 4px 12px rgba(0,0,0,0.1)">
                <img src="${qrUrl}" style="width:100%; max-width:280px; height:auto; display:block; margin:0 auto; border-radius:8px;" alt="VietQR">
            </div>

            <div style="background:var(--bg-elevated); padding:16px; border-radius:12px; margin-bottom:20px; text-align:left; border:1px solid var(--border-color);">
                <div style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:4px;">Ngân hàng: <strong style="color:var(--text-primary);">${pCfg.bankId}</strong></div>
                <div style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:4px;">Số tài khoản: <strong style="color:var(--text-primary);">${pCfg.accountNo}</strong></div>
                <div style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:8px;">Chủ TK: <strong style="color:var(--text-primary);">${pCfg.accountName}</strong></div>
                <div style="font-size:0.85rem; color:var(--text-secondary); display:flex; justify-content:space-between; align-items:center;">
                    <span>Lời nhắn: <strong id="qr-order-code" style="color:var(--accent-blue); font-size:1rem;">${orderCode}</strong></span>
                    <button class="btn btn-sm btn-ghost" onclick="navigator.clipboard.writeText('${orderCode}'); showToast('Đã copy mã đơn', 'success')" style="padding:4px 8px;">Copy</button>
                </div>
            </div>

            <p style="font-size:0.85rem; color:var(--text-tertiary); margin-bottom:16px;">
                Vui lòng <strong>giữ nguyên lời nhắn</strong> (${orderCode}) khi chuyển khoản.
            </p>

            <button class="btn btn-primary" id="btn-confirm-paid" style="width:100%;">
                Tôi đã thanh toán
            </button>
        </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('qr-close').addEventListener('click', () => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
    });

    document.getElementById('btn-confirm-paid').addEventListener('click', () => {
        // Save local order to simulate for admin check
        const orders = JSON.parse(localStorage.getItem('kgen_orders') || '[]');
        orders.push({
            user: user.email,
            orderCode,
            tier,
            amount: priceVnd,
            date: new Date().toISOString(),
            status: 'pending'
        });
        localStorage.setItem('kgen_orders', JSON.stringify(orders));

        overlay.innerHTML = `
            <div class="pricing-modal" style="max-width:400px; text-align:center; padding:40px 20px;">
                <div style="font-size:48px; margin-bottom:16px;">⏳</div>
                <h2 style="margin-bottom:16px;">Đang xác nhận thanh toán</h2>
                <p style="color:var(--text-secondary); font-size:0.9rem; line-height:1.6; margin-bottom:24px;">Hệ thống đã ghi nhận mã <strong>${orderCode}</strong>. Quản trị viên sẽ kích hoạt gói <strong>${tier.toUpperCase()}</strong> cho tài khoản <strong>${user.email}</strong> trong vài phút nữa.</p>
                <button class="btn btn-primary" onclick="window.location.reload()" style="width:100%">Đóng</button>
            </div>
        `;
    });

    requestAnimationFrame(() => overlay.classList.add('active'));
}

// ============================================================
// PRICING TIERS DATA
// ============================================================

const PRICING_TIERS = [
    {
        id: 'free',
        name: 'Gói FREE',
        emoji: '🌱',
        price: '0đ',
        period: '/tháng',
        features: [
            'Dùng thử trải nghiệm tính năng',
            'Thêm API Key cá nhân (ẩn giới hạn)',
            'Khám phá 10% thư viện mẫu'
        ],
        limitations: [
            'Chỉ sử dụng hình ảnh tạo ra cá nhân',
        ],
        buttonText: 'Đang sử dụng',
        buttonClass: 'btn-ghost',
        popular: false,
    },
    {
        id: 'pro',
        name: 'Gói PRO',
        emoji: '⚡',
        price: '39.000đ',
        period: '/tháng',
        features: [
            '1000 ảnh / tháng (Không cần cấu hình)',
            'Sử dụng Nanobanana Pro / Gemini Imagen 3',
            'Mở khoá 100% tài nguyên và 1300+ prompt gốc',
            'Server ưu tiên tốc độ cao',
            'Cho phép sử dụng thương mại'
        ],
        limitations: [],
        buttonText: 'Nâng cấp ngay',
        buttonClass: 'btn-primary',
        popular: true,
    },
    {
        id: 'premium',
        name: 'Gói PREMIUM',
        emoji: '🔥',
        price: '199.000đ',
        period: '/tháng',
        features: [
            '5000 ảnh / tháng (Gói doanh nghiệp/đội nhóm)',
            'Bao gồm tất cả đặc quyền PRO',
            'Hỗ trợ khách hàng ưu tiên 24/7',
            'Truy cập model mới sớm nhất',
            'API access trực tiếp'
        ],
        limitations: [],
        buttonText: 'Nâng cấp Premium',
        buttonClass: 'btn-premium',
        popular: false,
    },
];

// ============================================================
// PRICING UI
// ============================================================

function renderPricingModal() {
    const existing = document.getElementById('pricing-modal-overlay');
    if (existing) existing.remove();

    const currentTier = APP_STATE.currentUser?.tier || 'free';
    const _cp = typeof convertPrice === 'function' ? convertPrice : (v) => v.toLocaleString() + 'đ';
    const _period = typeof getCurrencyPeriod === 'function' ? getCurrencyPeriod() : '/tháng';
    const _bpv = typeof BASE_PRICES_VND !== 'undefined' ? BASE_PRICES_VND : { free: 0, pro: 39000, premium: 199000 };

    const overlay = document.createElement('div');
    overlay.id = 'pricing-modal-overlay';
    overlay.className = 'pricing-overlay';
    overlay.innerHTML = `
            < div class="pricing-modal" >
            <button class="modal-close" id="pricing-close">&times;</button>
            <div class="pricing-header">
                <h2 class="pricing-title">${typeof t === 'function' ? t('pricing.title') : 'Chọn gói phù hợp'}</h2>
                <p class="pricing-subtitle">${typeof t === 'function' ? t('home.subtitle') : 'Mở khóa toàn bộ sức mạnh của KGen Studio'}</p>
            </div>
            <div class="pricing-grid">
                ${PRICING_TIERS.map(tier => `
                    <div class="pricing-card ${tier.popular ? 'popular' : ''} ${currentTier === tier.id ? 'current' : ''}" data-tier="${tier.id}">
                        ${tier.popular ? '<div class="popular-badge">🔥 ' + (typeof t === 'function' ? t('home.popular').replace('💎 ', '') : 'Phổ biến nhất') + '</div>' : ''}
                        ${currentTier === tier.id ? '<div class="current-badge">✓ ' + (typeof t === 'function' ? t('common.save') : 'Gói hiện tại') + '</div>' : ''}
                        <div class="pricing-card-header">
                            <span class="tier-emoji">${tier.emoji}</span>
                            <h3 class="tier-name">${tier.name}</h3>
                            <div class="tier-price">
                                <span class="price-amount">${_bpv[tier.id] !== undefined ? _cp(_bpv[tier.id]) : tier.price}</span>
                                <span class="price-period">${_period}</span>
                            </div>
                        </div>
                        <ul class="tier-features">
                            ${tier.features.map(f => `<li>${f}</li>`).join('')}
                            ${tier.limitations.map(l => `<li class="limitation">❌ ${l}</li>`).join('')}
                        </ul>
                        <button class="btn ${tier.buttonClass} pricing-btn" 
                            data-tier="${tier.id}"
                            ${currentTier === tier.id ? 'disabled' : ''}>
                            ${currentTier === tier.id ? '✓ ' + (typeof t === 'function' ? t('common.save') : 'Đang sử dụng') : tier.buttonText}
                        </button>
                    </div>
                `).join('')}
            </div>
            <div class="pricing-footer">
                <p>${typeof t === 'function' ? t('pricing.footer') : '💳 Thanh toán an toàn qua Stripe'}</p>
                <p style="margin-top:4px;font-size:0.78rem;color:var(--text-tertiary)">${typeof t === 'function' ? t('pricing.footer_sub') : 'Hỗ trợ: MoMo, Visa, Mastercard, JCB'}</p>
            </div>
        </div >
            `;

    document.body.appendChild(overlay);

    // Events
    document.getElementById('pricing-close').addEventListener('click', closePricingModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closePricingModal();
    });

    // Pricing buttons
    overlay.querySelectorAll('.pricing-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tier = btn.dataset.tier;
            if (tier === 'free') return;
            handleUpgrade(tier);
        });
    });

    // Animate in
    requestAnimationFrame(() => overlay.classList.add('active'));
}

function closePricingModal() {
    const overlay = document.getElementById('pricing-modal-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
    }
}

async function handleUpgrade(tier) {
    const user = APP_STATE.currentUser;
    if (!user) {
        closePricingModal();
        openAuthModal();
        showToast('Vui lòng đăng nhập trước', 'info');
        return;
    }

    if (isSupabaseEnabled()) {
        await createCheckoutSession(tier);
    } else {
        // Demo mode: simulate upgrade
        showToast(`🎉 Demo: Đã nâng cấp lên ${tier.toUpperCase()} !(Cấu hình Stripe / Supabase để thanh toán thật)`, 'success');
        APP_STATE.currentUser.tier = tier;
        localStorage.setItem('kgen_session', JSON.stringify(APP_STATE.currentUser));
        closePricingModal();
        updateAuthUI();
        refreshGalleryForAuth();
    }
}

// Make functions globally available
window.renderPricingModal = renderPricingModal;
window.closePricingModal = closePricingModal;
window.handleUpgrade = handleUpgrade;
window.initSupabase = initSupabase;
window.isSupabaseEnabled = isSupabaseEnabled;
window.supabaseSignUp = supabaseSignUp;
window.supabaseSignIn = supabaseSignIn;
window.supabaseSignInWithGoogle = supabaseSignInWithGoogle;
window.supabaseSignOut = supabaseSignOut;
window.supabaseGetUser = supabaseGetUser;
window.onAuthStateChange = onAuthStateChange;
window.getUserTier = getUserTier;
window.toggleFavorite = toggleFavorite;
window.getFavorites = getFavorites;
window.logUsage = logUsage;
window.getDailyUsage = getDailyUsage;
window.getUsageLimit = getUsageLimit;
window.saveToCollection = saveToCollection;
window.removeFromCollection = removeFromCollection;
window.getCollection = getCollection;
window.isInCollection = isInCollection;
window.PRICING_TIERS = PRICING_TIERS;
