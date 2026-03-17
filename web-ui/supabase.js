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
    const siteCfg = (window.SITE_CONFIG && window.SITE_CONFIG.supabase) || {};
    let settings = {};
    try {
        settings = JSON.parse(localStorage.getItem('kgen_settings') || '{}');
    } catch (e) {
        console.warn('localStorage unavailable for Supabase config, using defaults');
    }
    return {
        url: siteCfg.url || settings.supabaseUrl || '',
        anonKey: siteCfg.anonKey || settings.supabaseAnonKey || '',
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
    const pCfg = (window.SITE_CONFIG && window.SITE_CONFIG.payment) || { bankId: 'TPB', accountNo: '00002035456', accountName: 'TRAN DANG QUOC HOA' };
    const webhookBase = (window.SITE_CONFIG && window.SITE_CONFIG.payment && window.SITE_CONFIG.payment.webhookBase) || 'https://n8n-1adi.srv1465145.hstgr.cloud';
    const user = APP_STATE.currentUser;

    if (!user) {
        showToast('Vui lòng đăng nhập trước khi mua gói', 'error');
        openAuthModal();
        return;
    }

    // Find package in both arrays
    const isTopup = tier.startsWith('topup_');
    const packTiers = [...PRICING_TIERS, ...(typeof TOPUP_PACKAGES !== 'undefined' ? TOPUP_PACKAGES : [])];
    const pack = packTiers.find(t => t.id === tier);

    // Default fallback if not found
    let priceVnd = tier === 'member' ? 199000 : 199000;

    // Process price
    if (pack) {
        if (typeof pack.price === 'number') {
            priceVnd = pack.price;
        } else if (typeof pack.price === 'string') {
            const num = parseInt(pack.price.replace(/\D/g, ''));
            if (!isNaN(num)) priceVnd = num;
        }
    }

    const rndCode = Math.floor(Math.random() * 90000) + 10000;
    const orderPrefix = isTopup ? 'NAP' : 'KGEN ' + tier.toUpperCase();
    const orderCode = `${orderPrefix} ${rndCode}`;
    const qrUrl = `https://img.vietqr.io/image/${pCfg.bankId}-${pCfg.accountNo}-compact2.png?amount=${priceVnd}&addInfo=${encodeURIComponent(orderCode)}&accountName=${encodeURIComponent(pCfg.accountName)}`;

    // Save order to localStorage for tracking
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

    // Also save to Supabase for cross-device sync
    if (isSupabaseEnabled()) {
        supabaseClient.from('orders').insert({
            user_email: user.email,
            order_code: orderCode,
            tier: tier,
            amount: priceVnd,
            status: 'pending',
        }).then(({ error }) => {
            if (error) console.warn('Order creation on Supabase failed:', error.message);
            else console.log('✅ Pending order saved to Supabase');
        });
    }

    // Generate Modal HTML
    const existing = document.getElementById('qr-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'qr-modal-overlay';
    overlay.className = 'pricing-overlay';
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:10000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(16px); background-color:rgba(0,0,0,0.85); opacity:1;';

    // Brand accent color tracking tier
    const accentColor = tier === 'member' ? '#4a90e2' : '#f59e0b';
    const accentGlow = tier === 'member' ? 'rgba(74, 144, 226, 0.3)' : 'rgba(245, 158, 11, 0.3)';

    // Modern animated timer script logic wrapper
    const countdownId = 'qr-countdown-' + Date.now();
    const statusId = 'payment-status-' + Date.now();

    overlay.innerHTML = `
        <div class="pricing-modal" style="position:relative; max-width:440px; width:100%; border-radius:24px; padding:0; background:linear-gradient(180deg, #18181b 0%, #09090b 100%); border:1px solid rgba(255,255,255,0.08); box-shadow:0 32px 64px rgba(0,0,0,0.5), 0 0 120px ${accentGlow}; overflow-y:auto; max-height:90vh; animation:modalScaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);">
            <!-- Glow background -->
            <div style="position:absolute; top:-100px; left:-100px; right:-100px; height:200px; background:${accentColor}; filter:blur(100px); opacity:0.15; z-index:0; border-radius:50%; pointer-events:none;"></div>
            
            <button class="modal-close" id="qr-close" style="z-index:10; background:rgba(255,255,255,0.1); backdrop-filter:blur(4px); top:16px; right:16px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; border-radius:50%; transition:all 0.2s; color:white;">&times;</button>
            
            <div style="position:relative; z-index:1; padding:32px 32px 24px;">
                <div style="text-align:center; margin-bottom:24px;">
                    <div style="display:inline-flex; align-items:center; justify-content:center; padding:6px 16px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:100px; gap:8px; margin-bottom:16px;">
                        <span style="display:block; width:8px; height:8px; border-radius:50%; background:${accentColor}; box-shadow:0 0 10px ${accentColor}; animation:pulse 2s infinite;"></span>
                        <span style="font-size:0.85rem; font-weight:600; letter-spacing:1px; color:white;">BẢO MẬT SSL KGEN</span>
                    </div>
                    <h2 style="font-size:1.8rem; font-weight:800; text-transform:uppercase; letter-spacing:-0.5px; background:linear-gradient(135deg, #fff 0%, #a1a1aa 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; margin:0 0 8px 0;">Nâng Cấp ${tier}</h2>
                    <p style="color:var(--text-secondary); font-size:1rem;">Mở khóa sức mạnh AI không giới hạn</p>
                </div>
                
                <div style="background:white; padding:20px; border-radius:20px; margin-bottom:24px; box-shadow:0 12px 32px rgba(0,0,0,0.3); position:relative; overflow:hidden;">
                    <div style="position:absolute; top:0; left:0; right:0; padding:6px 0; background:#f4f4f5; text-align:center; font-size:0.75rem; font-weight:700; color:#52525b; letter-spacing:1px;">QUÉT MÃ ĐỂ THANH TOÁN</div>
                    <img src="${qrUrl}" style="width:100%; max-width:300px; height:auto; display:block; margin:24px auto 0; border-radius:8px;" alt="VietQR">
                    
                    <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px dashed #e4e4e7; margin-top:20px; padding-top:16px;">
                        <span style="color:#52525b; font-size:0.9rem; font-weight:500;">Số tiền</span>
                        <span style="color:#18181b; font-size:1.4rem; font-weight:800;">${priceVnd.toLocaleString('vi')}đ</span>
                    </div>
                </div>

                <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); padding:20px; border-radius:16px; margin-bottom:24px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <span style="color:var(--text-tertiary); font-size:0.85rem;">Ngân hàng thụ hưởng</span>
                        <strong style="color:white; font-size:0.9rem;">${pCfg.bankId}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <span style="color:var(--text-tertiary); font-size:0.85rem;">Số tài khoản</span>
                        <strong style="color:white; font-size:0.9rem; letter-spacing:1px;">${pCfg.accountNo}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                        <span style="color:var(--text-tertiary); font-size:0.85rem;">Tên người nhận</span>
                        <strong style="color:white; font-size:0.9rem;">${pCfg.accountName}</strong>
                    </div>
                    
                    <div style="background:rgba(255,255,255,0.05); padding:16px; border-radius:12px; display:flex; justify-content:space-between; align-items:center; border:1px dashed ${accentColor};">
                        <div>
                            <span style="display:block; color:var(--text-tertiary); font-size:0.75rem; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Nội dung chuyển khoản (Bắt buộc)</span>
                            <strong style="color:${accentColor}; font-size:1.1rem; letter-spacing:1px;">${orderCode}</strong>
                        </div>
                        <button class="btn btn-sm" onclick="navigator.clipboard.writeText('${orderCode}'); showToast('Đã sao chép mã đơn', 'success')" style="background:${accentColor}; color:white; border:none; border-radius:8px; padding:8px 16px; font-weight:600; cursor:pointer;">Copy</button>
                    </div>
                </div>

                <!-- Payment status indicator -->
                <div id="${statusId}" style="display:none; text-align:center; padding:16px; background:rgba(59,130,246,0.1); border:1px solid rgba(59,130,246,0.2); border-radius:14px; margin-bottom:16px;">
                    <div style="display:flex; align-items:center; justify-content:center; gap:10px;">
                        <div style="width:20px; height:20px; border:2px solid ${accentColor}; border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite;"></div>
                        <span style="color:white; font-weight:600; font-size:0.95rem;">Đang chờ xác nhận thanh toán...</span>
                    </div>
                    <p style="color:var(--text-tertiary); font-size:0.8rem; margin-top:8px;">Hệ thống tự động kiểm tra mỗi 5 giây</p>
                </div>

                <button class="btn" id="btn-confirm-paid" style="width:100%; padding:16px; border-radius:16px; background:white; color:black; font-size:1.05rem; font-weight:700; letter-spacing:0.5px; border:none; cursor:pointer; box-shadow:0 4px 12px rgba(255,255,255,0.15); transition:transform 0.2s;">
                    Tôi đã chuyển khoản xong
                </button>
                
                <div style="text-align:center; margin-top:16px; font-size:0.85rem; color:var(--text-tertiary); display:flex; align-items:center; justify-content:center; gap:8px;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    <span>Mã QR sẽ hết hạn sau <strong id="${countdownId}" style="color:white;">15:00</strong></span>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Add spin keyframe if not exists
    if (!document.getElementById('kgen-payment-keyframes')) {
        const style = document.createElement('style');
        style.id = 'kgen-payment-keyframes';
        style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
        document.head.appendChild(style);
    }

    // Payment polling variables
    let paymentPoller = null;
    let isPolling = false;

    // Function to check payment status via webhook endpoint
    function startPaymentPolling() {
        if (isPolling) return;
        isPolling = true;
        const statusEl = document.getElementById(statusId);
        if (statusEl) statusEl.style.display = 'block';

        paymentPoller = setInterval(async () => {
            try {
                // Check local order status (updated by webhook → n8n → or manual)
                const storedOrders = JSON.parse(localStorage.getItem('kgen_orders') || '[]');
                const currentOrder = storedOrders.find(o => o.orderCode === orderCode);

                // Also try to check via webhook endpoint if configured
                if (webhookBase) {
                    try {
                        const resp = await fetch(`${webhookBase}/webhook/check-payment?code=${encodeURIComponent(orderCode)}`);
                        if (resp.ok) {
                            const data = await resp.json();
                            if (data.status === 'paid') {
                                // Update local order
                                if (currentOrder) currentOrder.status = 'paid';
                                localStorage.setItem('kgen_orders', JSON.stringify(storedOrders));
                                onPaymentConfirmed();
                                return;
                            }
                        }
                    } catch (e) {
                        // Webhook check failed, continue polling
                    }
                }

                // Check if order was manually confirmed
                if (currentOrder && currentOrder.status === 'paid') {
                    onPaymentConfirmed();
                }
            } catch (e) {
                console.warn('Payment poll error:', e);
            }
        }, 5000); // Poll every 5 seconds
    }

    // Function called when payment is confirmed
    function onPaymentConfirmed() {
        clearInterval(paymentPoller);
        clearInterval(cntTimer);
        isPolling = false;

        // Activate tier locally
        if (APP_STATE.currentUser) {
            APP_STATE.currentUser.tier = tier;
            localStorage.setItem('kgen_session', JSON.stringify(APP_STATE.currentUser));

            // ✅ CRITICAL: Sync tier to Supabase so it persists across devices
            if (isSupabaseEnabled() && APP_STATE.currentUser.id) {
                updateUserTier(APP_STATE.currentUser.id, tier).then(() => {
                    console.log('✅ Tier updated on Supabase:', tier);
                }).catch(err => {
                    console.error('⚠️ Failed to sync tier to Supabase:', err);
                });

                // Also save order to Supabase for cross-device order history
                supabaseClient.from('orders').upsert({
                    user_email: APP_STATE.currentUser.email,
                    order_code: orderCode,
                    tier: tier,
                    amount: priceVnd,
                    status: 'paid',
                    confirmed_at: new Date().toISOString(),
                }, { onConflict: 'order_code' }).then(({ error }) => {
                    if (error) console.warn('Order sync to Supabase failed:', error.message);
                    else console.log('✅ Order synced to Supabase');
                });
            }
        }

        // Show success animation
        overlay.innerHTML = `
            <div class="pricing-modal" style="position:relative; max-width:400px; width:100%; border-radius:24px; padding:48px 32px 40px; text-align:center; background:linear-gradient(180deg, #18181b 0%, #09090b 100%); border:1px solid rgba(255,255,255,0.08); box-shadow:0 32px 64px rgba(0,0,0,0.5);">
                <!-- Animated success circle -->
                <div style="width:80px; height:80px; border-radius:50%; background:rgba(16, 185, 129, 0.1); display:flex; align-items:center; justify-content:center; margin:0 auto 24px; position:relative;">
                    <div style="position:absolute; inset:0; border-radius:50%; border:2px solid #10b981; animation:ping 2s cubic-bezier(0, 0, 0.2, 1) infinite; opacity:0.5;"></div>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="animation:scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1);"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                
                <h2 style="font-size:1.5rem; font-weight:700; color:white; margin-bottom:12px;">🎉 Thanh toán thành công!</h2>
                <p style="color:#10b981; font-size:1.1rem; font-weight:600; margin-bottom:8px;">Gói ${tier.toUpperCase()} đã được kích hoạt!</p>
                <p style="color:var(--text-secondary); font-size:0.9rem; line-height:1.6; margin-bottom:32px;">Đơn hàng <strong style="color:white; background:rgba(255,255,255,0.1); padding:2px 8px; border-radius:4px;">${orderCode}</strong> đã được xác nhận tự động. Hãy tận hưởng sức mạnh AI không giới hạn!</p>
                
                <button class="btn" style="width:100%; padding:14px; border-radius:14px; background:white; color:black; font-weight:700; cursor:pointer;" onclick="document.getElementById('qr-modal-overlay').remove(); if(typeof updateAuthUI==='function') updateAuthUI(); if(typeof refreshGalleryForAuth==='function') refreshGalleryForAuth(); if(typeof closePricingModal==='function') closePricingModal();">
                    ✨ Bắt đầu sử dụng
                </button>
            </div>
        `;

        showToast(`🎉 Gói ${tier.toUpperCase()} đã được kích hoạt thành công!`, 'success');
    }

    // Setup countdown
    let timeLeft = 15 * 60; // 15 minutes
    const cntTimer = setInterval(() => {
        timeLeft--;
        const el = document.getElementById(countdownId);
        if (!el) {
            clearInterval(cntTimer);
            clearInterval(paymentPoller);
            return;
        }
        if (timeLeft <= 0) {
            clearInterval(cntTimer);
            clearInterval(paymentPoller);
            el.innerHTML = "Hết hạn";
            overlay.innerHTML = `<div class="pricing-modal" style="text-align:center; padding:40px; background:linear-gradient(180deg, #18181b 0%, #09090b 100%); border-radius:24px;"><h2 style="margin-bottom:16px; color:white;">⏰ Mã QR đã hết hạn</h2><p style="color:var(--text-secondary); margin-bottom:20px;">Vui lòng tạo mã thanh toán mới</p><button class="btn btn-primary" onclick="document.getElementById('qr-modal-overlay').remove()">Đóng</button></div>`;
            return;
        }
        const m = Math.floor(timeLeft / 60);
        const s = timeLeft % 60;
        el.innerText = `${m}:${s.toString().padStart(2, '0')}`;
    }, 1000);

    // Close button
    document.getElementById('qr-close').addEventListener('click', () => {
        clearInterval(cntTimer);
        clearInterval(paymentPoller);
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 300);
    });

    // "Tôi đã chuyển khoản xong" button - start polling
    document.getElementById('btn-confirm-paid').addEventListener('click', () => {
        const btn = document.getElementById('btn-confirm-paid');
        btn.innerHTML = '⏳ Đang xác nhận thanh toán...';
        btn.disabled = true;
        btn.style.opacity = '0.6';
        btn.style.cursor = 'not-allowed';

        startPaymentPolling();

        // Fallback: after 2 minutes of polling with no confirmation, show manual message
        setTimeout(() => {
            if (isPolling) {
                clearInterval(paymentPoller);
                isPolling = false;

                // Update local order status
                const storedOrders = JSON.parse(localStorage.getItem('kgen_orders') || '[]');
                const currentOrder = storedOrders.find(o => o.orderCode === orderCode);
                if (currentOrder) currentOrder.status = 'awaiting_review';
                localStorage.setItem('kgen_orders', JSON.stringify(storedOrders));

                overlay.innerHTML = `
                    <div class="pricing-modal" style="position:relative; max-width:400px; width:100%; border-radius:24px; padding:48px 32px 40px; text-align:center; background:linear-gradient(180deg, #18181b 0%, #09090b 100%); border:1px solid rgba(255,255,255,0.08); box-shadow:0 32px 64px rgba(0,0,0,0.5);">
                        <div style="width:64px; height:64px; border-radius:50%; background:rgba(245, 158, 11, 0.1); display:flex; align-items:center; justify-content:center; margin:0 auto 20px;">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        </div>
                        <h2 style="font-size:1.3rem; font-weight:700; color:white; margin-bottom:12px;">Đang chờ xác nhận</h2>
                        <p style="color:var(--text-secondary); font-size:0.9rem; line-height:1.6; margin-bottom:24px;">
                            Đơn hàng <strong style="color:white;">${orderCode}</strong> đã được ghi nhận.<br>
                            Hệ thống sẽ tự động kích hoạt gói <strong style="color:${accentColor}">${tier.toUpperCase()}</strong> khi nhận được tiền (thường 1-5 phút).<br><br>
                            Bạn có thể đóng cửa sổ này và tiếp tục sử dụng.
                        </p>
                        <button class="btn" style="width:100%; padding:14px; border-radius:14px; background:white; color:black; font-weight:700; cursor:pointer;" onclick="document.getElementById('qr-modal-overlay').remove()">
                            Đã hiểu
                        </button>
                    </div>
                `;
            }
        }, 120000); // 2 minutes timeout
    });

    // Auto-start polling immediately (passive background check)
    startPaymentPolling();
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
        period: '/mãi mãi',
        features: [
            'Tặng kèm 10 Token ban đầu',
            'Tự nạp API Key cá nhân để dùng',
            'Truy cập 100% thư viện prompt'
        ],
        limitations: [
            'Chưa mở khoá bộ công cụ Video'
        ],
        buttonText: 'Đang sử dụng',
        buttonClass: 'btn-ghost',
        popular: false,
    },
    {
        id: 'member',
        name: 'Gói THÀNH VIÊN',
        emoji: '💎',
        price: '199.000đ',
        period: '/tháng',
        features: [
            'Mở khoá Chatbot tạo Video AI',
            'Truy cập Bộ công cụ Video chuyên sâu',
            'Sử dụng chung nền tảng Hệ sinh thái',
            'Trợ lý Kỹ thuật Hỗ trợ riêng'
        ],
        limitations: [],
        buttonText: 'Nâng cấp Thành Viên',
        buttonClass: 'btn-primary',
        popular: true,
    }
];

const TOPUP_PACKAGES = [
    {
        id: 'topup_50',
        name: 'Nạp Tiêu Chuẩn',
        emoji: '🪙',
        price: '50.000đ',
        credits: 500,
        bonus: '+0%',
        best: false
    },
    {
        id: 'topup_100',
        name: 'Nạp Phổ Biến',
        emoji: '💰',
        price: '100.000đ',
        credits: 1200,
        bonus: '+20% (Khuyên dùng)',
        best: true
    },
    {
        id: 'topup_200',
        name: 'Nạp Cao Cấp',
        emoji: '💎',
        price: '200.000đ',
        credits: 2800,
        bonus: '+40% (Tiết kiệm nhất)',
        best: false
    }
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
        <div class="pricing-modal">
            <button class="modal-close" id="pricing-close">&times;</button>
            <div class="pricing-header">
                <h2 class="pricing-title">${typeof t === 'function' ? t('pricing.title') : 'Chọn gói phù hợp'}</h2>
                <p class="pricing-subtitle">${typeof t === 'function' ? t('home.subtitle') : 'Mở khóa toàn bộ sức mạnh của KGen Studio'}</p>
            </div>
            
            <div style="margin-bottom: 24px;">
                <h3 style="text-align:center; font-size:1.4rem; font-weight:700; margin-bottom: 16px;">Đăng ký Gói Nền tảng</h3>
                <div class="pricing-grid" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));">
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
            </div>

            <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.05);">
                <h3 style="text-align:center; font-size:1.4rem; font-weight:700; margin-bottom: 8px;">Nạp thêm <span style="color:var(--accent-blue)">Credits</span></h3>
                <p style="text-align:center; color:var(--text-secondary); font-size: 0.9rem; margin-bottom: 24px; max-width:80%; margin-left:auto; margin-right:auto;">Dùng cho khách hàng đã xài hết Credit trong Gói Tháng mà vẫn còn nhu cầu sinh ảnh/bài viết.</p>
                
                <div class="pricing-grid" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));">
                    ${(typeof TOPUP_PACKAGES !== 'undefined' ? TOPUP_PACKAGES : []).map(pack => `
                        <div class="pricing-card" style="padding:20px; text-align:center;">
                            ${pack.best ? '<div class="popular-badge" style="background:#10b981; color:#fff; top:-12px;">' + pack.bonus + '</div>' : ''}
                            <div style="font-size:2.5rem; margin-bottom:12px;">${pack.emoji}</div>
                            <h3 style="font-size:1.1rem; margin-bottom:4px;">${pack.name}</h3>
                            <div style="color:var(--accent-blue); font-size:1.6rem; font-weight:800; margin-bottom:12px;">
                                ${pack.credits} <span style="font-size:0.9rem; font-weight:600; color:var(--text-secondary);">Token</span>
                            </div>
                            <div style="font-size:1.2rem; font-weight:700; margin-bottom:20px;">${pack.price}</div>
                            <button class="btn ${pack.best ? 'btn-primary' : 'btn-outline'} topup-pricing-btn" style="width:100%; border-radius:12px;" data-pack="${pack.id}">
                                Nạp ngay
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="pricing-footer">
                <p>${typeof t === 'function' ? t('pricing.footer') : '🔒 Thanh toán tự động KGen Guard'}</p>
                <p style="margin-top:4px;font-size:0.78rem;color:var(--text-tertiary)">${typeof t === 'function' ? t('pricing.footer_sub') : 'Kích hoạt ngay khi nhận thanh toán. Quản lý dễ dàng.'}</p>
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

    // Topup buttons
    overlay.querySelectorAll('.topup-pricing-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!APP_STATE.currentUser) {
                closePricingModal();
                showToast("Vui lòng đăng nhập trước khi nạp thêm Credit");
                return;
            }
            const packId = btn.dataset.pack;
            handleUpgrade(packId);
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

    // Always show the QR payment modal, regardless of Supabase status.
    await createCheckoutSession(tier);

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
window.TOPUP_PACKAGES = TOPUP_PACKAGES;

// ============================================================
// CENTRALIZED CREDITS SYSTEM (via Supabase RPC)
// ============================================================

let _centralConfig = null;

async function loadCentralConfig(forceRefresh = false) {
    if (_centralConfig && !forceRefresh && (Date.now() - _centralConfig._loadedAt < 5 * 60 * 1000)) {
        return _centralConfig;
    }
    if (!isSupabaseEnabled()) {
        return {
            model_costs: {
                'nano-banana-pro': 18, 'nano-banana-2': 18, '4o-image': 25,
                'flux-kontext': 20, 'flux-pro-i2i': 20, 'flux-flex-t2i': 15,
                'flux-flex-i2i': 15, 'midjourney': 30, 'grok-imagine': 22,
            },
            plan_prices: window.SITE_CONFIG?.plans || {},
            topup_packages: window.TOPUP_PACKAGES || [],
        };
    }
    try {
        const { data, error } = await supabaseClient.rpc('get_public_config');
        if (error) throw error;
        _centralConfig = { ...data, _loadedAt: Date.now() };
        console.log('✅ Central config loaded from Supabase');
        return _centralConfig;
    } catch (err) {
        console.warn('⚠️ Central config fallback:', err.message);
        return { model_costs: { 'nano-banana-pro': 18 }, plan_prices: {}, topup_packages: [] };
    }
}

async function getModelCost(modelName) {
    const config = await loadCentralConfig();
    return config.model_costs?.[modelName] || 18;
}

async function getUserCredits() {
    if (!isSupabaseEnabled()) {
        const session = JSON.parse(localStorage.getItem('kgen_session') || 'null');
        return { credits: session?.credits || 0, credits_used: session?.credits_used || 0, tier: session?.tier || 'free' };
    }
    try {
        const { data } = await supabaseClient.auth.getSession();
        const user = data?.session?.user;
        if (!user) return { credits: 0, credits_used: 0, tier: 'free' };
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('credits, credits_used, tier, plan_expires_at')
            .eq('id', user.id)
            .single();
        return {
            credits: profile?.credits || 0,
            credits_used: profile?.credits_used || 0,
            tier: profile?.tier || 'free',
            plan_expires_at: profile?.plan_expires_at,
        };
    } catch (err) {
        console.warn('getUserCredits error:', err.message);
        return { credits: 0, credits_used: 0, tier: 'free' };
    }
}

async function deductCredits(model, source = 'kgen-gallery') {
    if (!isSupabaseEnabled()) {
        return { success: true, credits: 999, spent: 0 };
    }
    try {
        let user = null;
        try {
            const { data } = await supabaseClient.auth.getSession();
            user = data?.session?.user;
        } catch (e) {
            console.warn('Supabase auth session error (bypassing):', e.message);
        }

        if (!user) {
            // User is not logged in via Supabase Auth, but may be logged in via localStorage
            // Allow generation without credit deduction (fallback mode)
            const localSession = JSON.parse(localStorage.getItem('kgen_session') || 'null');
            if (localSession) {
                console.log('⚠️ User logged in via localStorage, skipping Supabase credit deduction');
                return { success: true, credits: 999, spent: 0 };
            }
            return { success: false, error: 'Not logged in' };
        }
        const cost = await getModelCost(model);
        const { data, error } = await supabaseClient.rpc('deduct_tokens', {
            p_user_id: user.id,
            p_amount: cost,
            p_action: 'generate',
            p_model: model,
            p_source: source,
        });
        if (error) throw error;
        return data;
    } catch (err) {
        console.error('deductCredits error:', err);
        return { success: false, error: err.message };
    }
}

async function refundCredits(model, source = 'kgen-gallery') {
    if (!isSupabaseEnabled()) return { success: true };
    try {
        const { data } = await supabaseClient.auth.getSession();
        const user = data?.session?.user;
        if (!user) return { success: false };
        const cost = await getModelCost(model);
        const { data: rpcData, error } = await supabaseClient.rpc('add_credits', {
            p_user_id: user.id,
            p_amount: cost,
            p_source: source + '-refund',
        });
        if (error) throw error;
        return rpcData;
    } catch (err) {
        console.error('refundCredits error:', err);
        return { success: false, error: err.message };
    }
}

window.loadCentralConfig = loadCentralConfig;
window.getModelCost = getModelCost;
window.getUserCredits = getUserCredits;
window.deductCredits = deductCredits;
window.refundCredits = refundCredits;

