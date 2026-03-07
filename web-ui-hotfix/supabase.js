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

    if (!isSupabaseEnabled()) {
        // localStorage fallback
        const collection = JSON.parse(localStorage.getItem('kgen_collection') || '[]');
        collection.unshift(entry);
        // Keep max 100 items
        if (collection.length > 100) collection.length = 100;
        localStorage.setItem('kgen_collection', JSON.stringify(collection));
        return entry;
    }

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        // Fallback if not logged in
        const collection = JSON.parse(localStorage.getItem('kgen_collection') || '[]');
        collection.unshift(entry);
        if (collection.length > 100) collection.length = 100;
        localStorage.setItem('kgen_collection', JSON.stringify(collection));
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
        // Fallback to localStorage
        const collection = JSON.parse(localStorage.getItem('kgen_collection') || '[]');
        collection.unshift(entry);
        localStorage.setItem('kgen_collection', JSON.stringify(collection));
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
// STRIPE PAYMENT
// ============================================================

const STRIPE_CONFIG = {
    publishableKey: '', // From settings
    proPriceId: '', // Stripe Price ID for Pro plan
    premiumPriceId: '', // Stripe Price ID for Premium plan
};

function getStripeConfig() {
    const settings = JSON.parse(localStorage.getItem('kgen_settings') || '{}');
    return {
        publishableKey: settings.stripePublishableKey || '',
        proPriceId: settings.stripePriceIdPro || '',
        premiumPriceId: settings.stripePriceIdPremium || '',
    };
}

async function createCheckoutSession(tier) {
    const config = getStripeConfig();

    if (!config.publishableKey) {
        showPricingSetupPrompt();
        return;
    }

    const priceId = tier === 'pro' ? config.proPriceId : config.premiumPriceId;
    if (!priceId) {
        showToast('Chưa cấu hình Stripe Price ID', 'error');
        return;
    }

    // For production, this should call a backend API
    // For now, redirect to Stripe Checkout via Payment Links
    const user = isSupabaseEnabled() ? await supabaseGetUser() :
        JSON.parse(localStorage.getItem('kgen_session') || 'null');

    if (!user) {
        showToast('Vui lòng đăng nhập trước khi nâng cấp', 'error');
        openAuthModal();
        return;
    }

    // Use Stripe Payment Links (no backend needed)
    const paymentLink = tier === 'pro' ? config.proPriceId : config.premiumPriceId;

    // If it's a payment link URL, redirect
    if (paymentLink.startsWith('http')) {
        window.open(`${paymentLink}?prefilled_email=${encodeURIComponent(user.email)}`, '_blank');
    } else {
        // Show instructions to set up Stripe
        showPricingSetupPrompt();
    }
}

function showPricingSetupPrompt() {
    const infoDiv = document.createElement('div');
    infoDiv.id = 'stripe-setup-info';
    infoDiv.innerHTML = `
        <div style="padding:20px 24px">
            <h3>💳 Cấu hình Stripe Payment</h3>
            <p style="margin:8px 0;color:var(--text-secondary)">Để nhận thanh toán, bạn cần:</p>
            <ol style="margin:8px 0;padding-left:20px;font-size:0.85rem;color:var(--text-secondary);line-height:1.8">
                <li>Tạo tài khoản tại <a href="https://dashboard.stripe.com" target="_blank" style="color:var(--accent-blue)">Stripe Dashboard</a></li>
                <li>Tạo 2 Products (Pro & Premium) với giá tương ứng</li>
                <li>Tạo Payment Links cho mỗi sản phẩm</li>
                <li>Dán Payment Link URLs vào <strong>Cài đặt</strong></li>
            </ol>
            <div style="display:flex;gap:8px;margin-top:12px">
                <button class="btn btn-primary btn-sm" onclick="this.closest('#stripe-setup-info').remove();switchTab('settings')">⚙️ Mở Cài đặt</button>
                <button class="btn btn-ghost btn-sm" onclick="this.closest('#stripe-setup-info').remove()">Đóng</button>
            </div>
        </div>
    `;
    infoDiv.style.cssText = `
        position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
        background:var(--bg-elevated);border:1px solid var(--border-color);
        border-radius:16px;max-width:480px;width:90%;z-index:1001;
        box-shadow:0 8px 40px rgba(0,0,0,0.4);animation:toastIn 0.3s var(--ease-spring);
    `;
    document.body.appendChild(infoDiv);
    setTimeout(() => infoDiv.remove(), 20000);
}

// ============================================================
// PRICING TIERS DATA
// ============================================================

const PRICING_TIERS = [
    {
        id: 'free',
        name: 'Free',
        emoji: '🆓',
        price: '0đ',
        period: 'mãi mãi',
        features: [
            '10 ảnh miễn phí',
            'Duyệt toàn bộ gallery',
            'Xem hình ảnh preview',
            'Thêm API key cá nhân → không giới hạn',
        ],
        limitations: [
            'Giới hạn 10 ảnh (dùng admin key)',
        ],
        buttonText: 'Gói hiện tại',
        buttonClass: 'btn-ghost',
        popular: false,
    },
    {
        id: 'pro',
        name: 'Pro',
        emoji: '⭐',
        price: '39.000đ',
        period: '/tháng',
        features: [
            '✅ 1.000 token tạo ảnh / tháng',
            '✅ Full nội dung tất cả prompt',
            '✅ Nâng cấp prompt AI',
            '✅ Lưu prompt yêu thích',
            '✅ Ưu tiên hỗ trợ',
        ],
        limitations: [],
        buttonText: 'Nâng cấp Pro',
        buttonClass: 'btn-primary',
        popular: true,
    },
    {
        id: 'premium',
        name: 'Premium',
        emoji: '💎',
        price: '199.000đ',
        period: '/tháng',
        features: [
            '✅ 5.000 token tạo ảnh / tháng',
            '✅ Tất cả tính năng Pro',
            '✅ Unlimited copy & view',
            '✅ API access trực tiếp',
            '✅ Hỗ trợ 24/7 ưu tiên cao',
            '✅ Truy cập model mới sớm nhất',
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

    const overlay = document.createElement('div');
    overlay.id = 'pricing-modal-overlay';
    overlay.className = 'pricing-overlay';
    overlay.innerHTML = `
        <div class="pricing-modal">
            <button class="modal-close" id="pricing-close">&times;</button>
            <div class="pricing-header">
                <h2 class="pricing-title">Chọn gói phù hợp</h2>
                <p class="pricing-subtitle">Mở khóa toàn bộ sức mạnh của KGen Studio</p>
            </div>
            <div class="pricing-grid">
                ${PRICING_TIERS.map(tier => `
                    <div class="pricing-card ${tier.popular ? 'popular' : ''} ${currentTier === tier.id ? 'current' : ''}" data-tier="${tier.id}">
                        ${tier.popular ? '<div class="popular-badge">🔥 Phổ biến nhất</div>' : ''}
                        ${currentTier === tier.id ? '<div class="current-badge">✓ Gói hiện tại</div>' : ''}
                        <div class="pricing-card-header">
                            <span class="tier-emoji">${tier.emoji}</span>
                            <h3 class="tier-name">${tier.name}</h3>
                            <div class="tier-price">
                                <span class="price-amount">${tier.price}</span>
                                <span class="price-period">${tier.period}</span>
                            </div>
                        </div>
                        <ul class="tier-features">
                            ${tier.features.map(f => `<li>${f}</li>`).join('')}
                            ${tier.limitations.map(l => `<li class="limitation">❌ ${l}</li>`).join('')}
                        </ul>
                        <button class="btn ${tier.buttonClass} pricing-btn" 
                            data-tier="${tier.id}"
                            ${currentTier === tier.id ? 'disabled' : ''}>
                            ${currentTier === tier.id ? '✓ Đang sử dụng' : tier.buttonText}
                        </button>
                    </div>
                `).join('')}
            </div>
            <div class="pricing-footer">
                <p>💳 Thanh toán an toàn qua <strong>Stripe</strong> • Hủy bất cứ lúc nào</p>
                <p style="margin-top:4px;font-size:0.78rem;color:var(--text-tertiary)">Hỗ trợ: MoMo, Visa, Mastercard, JCB</p>
            </div>
        </div>
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
        showToast(`🎉 Demo: Đã nâng cấp lên ${tier.toUpperCase()}! (Cấu hình Stripe/Supabase để thanh toán thật)`, 'success');
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
