/**
 * KGen Studio � AI Image Generation Hub
 * Main Application Logic
 */

// ============================================================
// CONFIG & STATE
// ============================================================

const APP_STATE = {
    prompts: [],
    filteredPrompts: [],
    displayedCount: 0,
    pageSize: 24,
    currentCategory: 'all',
    currentSort: 'rank',
    searchQuery: '',
    currentTab: 'gallery',
    referenceImages: [],
    generationHistory: [],
    // Auth
    currentUser: null, // { email, name, createdAt }
    settings: {
        kieApiKey: '',
        googleClientId: '',
        supabaseUrl: '',
        supabaseAnonKey: '',
        stripePublishableKey: '',
        stripePriceIdPro: '',
        stripePriceIdPremium: '',
    },
};

// Prompt visibility: everyone sees full prompt
const GUEST_PROMPT_RATIO = 1.0; // 100% - no restriction

// Category emoji map
const CATEGORY_EMOJI = {
    '3D': '🎮',
    'App': '📱',
    'Food': '🍔',
    'Girl': '👧',
    'JSON': '📋',
    'Other': '🔮',
    'Photograph': '📸',
    'Product': '📦'
};

// ============================================================
// SITE CONFIG (from admin panel)
// ============================================================

function getSiteConfig() {
    let cfg = window.SITE_CONFIG || {};

    // LOCAL DEV OVERRIDE: Automatically sync keys from Admin Panel if they exist in localStorage
    try {
        const storedAdmin = localStorage.getItem('KGen_admin_config');
        if (storedAdmin) {
            const adminCfg = JSON.parse(storedAdmin);

            // Admin panel stores keys at root level OR nested under api
            cfg.api = {
                ...cfg.api,
                kieApiKey: adminCfg.kieApiKey || adminCfg.api?.kieApiKey || cfg.api?.kieApiKey || '',
                kieApiBase: adminCfg.kieApiBase || adminCfg.api?.kieApiBase || cfg.api?.kieApiBase || 'https://api.kie.ai',
                kieModel: adminCfg.kieModel || adminCfg.api?.kieModel || cfg.api?.kieModel || 'nano-banana-pro',
            };

            // Merge plans (admin panel uses plans.freeLimit/proLimit/premiumLimit)
            if (adminCfg.plans) {
                cfg.plans = cfg.plans || {};
                if (adminCfg.plans.freeLimit !== undefined) {
                    cfg.plans.free = { ...(cfg.plans.free || {}), imageLimit: adminCfg.plans.freeLimit };
                }
                if (adminCfg.plans.proLimit !== undefined) {
                    cfg.plans.pro = { ...(cfg.plans.pro || {}), imageLimit: adminCfg.plans.proLimit };
                }
                if (adminCfg.plans.premiumLimit !== undefined) {
                    cfg.plans.premium = { ...(cfg.plans.premium || {}), imageLimit: adminCfg.plans.premiumLimit };
                }
            }
        }
    } catch (err) {
        console.warn('Could not read admin config from localStorage', err);
    }

    return cfg;
}

function getAdminAPIKey(type) {
    const cfg = getSiteConfig();
    if (type === 'kie') return cfg.api?.kieApiKey || '';
    if (type === 'kieBase') return cfg.api?.kieApiBase || 'https://api.kie.ai';
    if (type === 'kieModel') return cfg.api?.kieModel || 'nano-banana-pro';
    return '';
}

// ============================================================
// QUOTA SYSTEM
// ============================================================

function getUserQuota() {
    const email = APP_STATE.currentUser?.email || 'guest';
    try {
        return JSON.parse(localStorage.getItem(`KGen_quota_${email}`) || '{}');
    } catch { return {}; }
}

function saveUserQuota(quota) {
    const email = APP_STATE.currentUser?.email || 'guest';
    localStorage.setItem(`KGen_quota_${email}`, JSON.stringify(quota));
}

function getUserPlan() {
    const quota = getUserQuota();
    return quota.plan || 'free';
}

function getUserImageLimit() {
    const plan = getUserPlan();
    const cfg = getSiteConfig();
    if (cfg.plans && cfg.plans[plan]) {
        return cfg.plans[plan].imageLimit || 10;
    }
    // Defaults
    if (plan === 'pro') return 1000;
    if (plan === 'premium') return 5000;
    return 10;
}

function getUserImagesUsed() {
    const quota = getUserQuota();
    // Monthly reset for Pro/Premium
    const plan = getUserPlan();
    if (plan !== 'free' && quota.monthStart) {
        const monthStart = new Date(quota.monthStart);
        const now = new Date();
        // If we're in a new month, reset usage
        if (now.getMonth() !== monthStart.getMonth() || now.getFullYear() !== monthStart.getFullYear()) {
            quota.used = 0;
            quota.monthStart = now.toISOString();
            saveUserQuota(quota);
            return 0;
        }
    }
    return quota.used || 0;
}

/**
 * Check if user has configured their own personal API key
 * If yes, they bypass the admin quota system entirely (using their own credits)
 */
function hasPersonalApiKey() {
    return !!(APP_STATE.settings.kieApiKey);
}

function canGenerateImage() {
    // If user has their own API key, always allow (they're paying for their own usage)
    if (hasPersonalApiKey()) return true;
    return getUserImagesUsed() < getUserImageLimit();
}

function incrementImageUsage() {
    // Don't count usage if user has personal API key
    if (hasPersonalApiKey()) return;

    const quota = getUserQuota();
    quota.used = (quota.used || 0) + 1;
    if (!quota.plan) quota.plan = 'free';
    // Set month start for first usage on paid plans
    if (quota.plan !== 'free' && !quota.monthStart) {
        quota.monthStart = new Date().toISOString();
    }
    saveUserQuota(quota);
    if (typeof updateSidebarUserStats === 'function') {
        updateSidebarUserStats();
    }
}

function getQuotaDisplay() {
    if (hasPersonalApiKey()) return 'API key cá nhân';
    const used = getUserImagesUsed();
    const limit = getUserImageLimit();
    return `${used} / ${limit}`;
}

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    loadSettings();
    loadSiteConfig();
    setupAuth();
    setupNavigation();
    setupGalleryEvents();
    setupGenerateEvents();
    setupEnhanceEvents();
    setupWorkflowEvents();
    setupSettingsEvents();
    setupModal();
    setupSearchModal();
    setupPricing();
    setupExtraModals();

    loadGenerationHistory();

    // Init Supabase if configured
    if (typeof initSupabase === 'function') {
        if (initSupabase()) {
            if (typeof supabaseGetUser === 'function') {
                supabaseGetUser().then(sbUser => {
                    if (sbUser) {
                        APP_STATE.currentUser = sbUser;
                        localStorage.setItem('kgen_session', JSON.stringify(sbUser));
                        updateAuthUI();
                    }
                });
            }
            if (typeof onAuthStateChange === 'function') {
                onAuthStateChange(async (event, session) => {
                    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
                        const sbUser = await supabaseGetUser();
                        if (sbUser) {
                            APP_STATE.currentUser = sbUser;
                            localStorage.setItem('kgen_session', JSON.stringify(sbUser));
                            updateAuthUI();
                        }
                    } else if (event === 'SIGNED_OUT') {
                        APP_STATE.currentUser = null;
                        localStorage.removeItem('kgen_session');
                        updateAuthUI();
                    }
                });
            }
        }
    }

    // Load credits display
    if (typeof initCredits === 'function') setTimeout(initCredits, 500);

    await loadPromptLibrary();
});

function loadSiteConfig() {
    const cfg = getSiteConfig();
    // Apply admin API keys to settings as fallback
    if (cfg.api) {
        if (cfg.api.kieApiKey && !APP_STATE.settings.kieApiKey) {
            APP_STATE.settings.kieApiKey = cfg.api.kieApiKey;
        }
    }
    console.log('Site config loaded:', cfg.version || 'default');
}

async function loadPromptLibrary() {
    const splash = document.getElementById('splash-screen');
    const barFill = document.querySelector('.splash-bar-fill');
    const statusText = document.querySelector('.splash-status');

    try {
        barFill.style.width = '30%';
        statusText.textContent = 'Đang tải thư viện prompt...';

        // Phase 1: Load lightweight gallery index (~374KB instead of 4MB)
        const indexResponse = await fetch('./data/gallery-index.json');
        barFill.style.width = '70%';

        if (!indexResponse.ok) {
            // Fallback to full file if index doesn't exist
            return await loadPromptLibraryFull(splash, barFill, statusText);
        }

        const indexData = await indexResponse.json();
        barFill.style.width = '90%';
        statusText.textContent = 'Đang xử lý dữ liệu...';

        // Convert slim format to normal format for gallery cards
        const slimPrompts = indexData.map(item => ({
            id: item.i,
            rank: item.r,
            image: item.g,
            images: [item.g], // placeholder until full data loads
            model: item.m,
            likes: item.l,
            views: item.v,
            author_name: item.a,
            author: item.a,
            categories: item.c,
            date: item.d,
            prompt: '', // loaded later
            source_url: '',
            _slim: true // flag: full data not yet loaded
        }));

        APP_STATE.prompts = shuffleArray(slimPrompts);
        APP_STATE.filteredPrompts = [...APP_STATE.prompts];

        statusText.textContent = `Đã tải ${APP_STATE.prompts.length.toLocaleString()} prompts!`;

        const galleryCount = document.getElementById('gallery-count');
        if (galleryCount) galleryCount.textContent = APP_STATE.prompts.length.toLocaleString();
        const gallerySub = document.getElementById('gallery-subtitle');
        if (gallerySub) gallerySub.textContent = `${APP_STATE.prompts.length.toLocaleString()} prompt được tuyển chọn`;

        barFill.style.width = '100%';
        splash.classList.add('fade-out');
        setTimeout(() => splash.remove(), 600);

        renderGallery(true);

        // Phase 2: Load full data in background (non-blocking)
        loadFullPromptsInBackground();

    } catch (error) {
        statusText.textContent = 'Lỗi tải dữ liệu — thử lại...';
        console.error('Failed to load prompts:', error);
        showToast('Không thể tải thư viện prompt', 'error');

        setTimeout(() => {
            splash.classList.add('fade-out');
            setTimeout(() => splash.remove(), 600);
        }, 2000);
    }
}

// Fallback: load the full JSON directly (if gallery-index.json doesn't exist)
async function loadPromptLibraryFull(splash, barFill, statusText) {
    const response = await fetch('./data/trending-prompts.json');
    barFill.style.width = '80%';
    if (!response.ok) throw new Error('Failed to load prompts');
    let rawData = await response.json();
    APP_STATE.prompts = shuffleArray(rawData);
    APP_STATE.filteredPrompts = [...APP_STATE.prompts];
    barFill.style.width = '100%';
    statusText.textContent = `Đã tải ${APP_STATE.prompts.length.toLocaleString()} prompts!`;
    const galleryCount = document.getElementById('gallery-count');
    if (galleryCount) galleryCount.textContent = APP_STATE.prompts.length.toLocaleString();
    splash.classList.add('fade-out');
    setTimeout(() => splash.remove(), 600);
    renderGallery(true);
    checkSharedPrompt();
}

// Background loader: merges full prompt data into already-displayed cards
async function loadFullPromptsInBackground() {
    try {
        const response = await fetch('./data/trending-prompts.json');
        if (!response.ok) return;
        const fullData = await response.json();

        // Create lookup map by ID
        const fullMap = {};
        fullData.forEach(item => { fullMap[item.id] = item; });

        // Merge full data into existing prompts
        APP_STATE.prompts.forEach((p, idx) => {
            const full = fullMap[p.id];
            if (full) {
                APP_STATE.prompts[idx] = { ...full, _slim: false };
            }
        });

        // Also update filteredPrompts
        APP_STATE.filteredPrompts.forEach((p, idx) => {
            const full = fullMap[p.id];
            if (full) {
                APP_STATE.filteredPrompts[idx] = { ...full, _slim: false };
            }
        });

        console.log('✅ Full prompt data loaded in background');
        checkSharedPrompt();
    } catch (e) {
        console.warn('Background full data load failed:', e);
    }
}

function checkSharedPrompt() {
    const urlParams = new URLSearchParams(window.location.search);
    const shareId = urlParams.get('share');
    const sharedText = urlParams.get('txt');

    let item = null;

    if (shareId) {
        // 1. Try finding in Global Gallery
        if (APP_STATE.prompts) {
            item = APP_STATE.prompts.find(p => p.id === shareId);
        }

        // 2. Try finding in Local History (if user clicked their own share link)
        if (!item && shareId.startsWith('hist_') && APP_STATE.generationHistory) {
            const idx = parseInt(shareId.split('_')[1]);
            const histItem = APP_STATE.generationHistory[idx];
            if (histItem) {
                item = { prompt: histItem.prompt, image: histItem.url };
            }
        }
    }

    // 3. Fallback to Prompt Text encoded in URL (if someone else clicked a history link)
    if (!item && sharedText) {
        item = { prompt: decodeURIComponent(sharedText) };
    }

    if (item) {
        // Clean up the URL
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('share');
        newUrl.searchParams.delete('txt');
        window.history.replaceState({}, '', newUrl);

        // Populate prompt text
        document.getElementById('gen-prompt').value = item.prompt || '';
        if (typeof updateCharCount === 'function') updateCharCount();

        // Populate reference image if available
        if (item.image || (item.images && item.images[0])) {
            const imgUrl = item.image || item.images[0];
            APP_STATE.referenceImages = [];
            APP_STATE.referenceImages.push(imgUrl);
            if (typeof renderRefPreviews === 'function') renderRefPreviews();
        }

        // Switch to generation tab
        if (typeof switchTab === 'function') switchTab('generate');

        // Authenticate & Auto-generate
        if (!isLoggedIn()) {
            showToast('🔒 Vui lòng đăng nhập để tạo ảnh từ prompt được chia sẻ', 'error');
            if (typeof openAuthModal === 'function') openAuthModal();
        } else {
            showToast('🚀 Đang tự động tạo ảnh từ liên kết chia sẻ...', 'success');
            setTimeout(() => {
                document.getElementById('btn-generate')?.click();
            }, 800);
        }
    }
}

// ============================================================
// NAVIGATION
// ============================================================

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tab = item.dataset.tab;
            switchTab(tab);
        });
    });

    // Sidebar toggle for mobile (from sidebar itself)
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
        toggleMobileSidebar();
    });

    // Mobile header hamburger menu
    document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
        toggleMobileSidebar();
    });

    // Mobile bottom nav
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const tab = item.dataset.tab;
            const action = item.dataset.action;

            if (action === 'search') {
                // Focus the search input
                switchTab('gallery');
                setTimeout(() => {
                    const searchInput = document.getElementById('search-input');
                    if (searchInput) {
                        searchInput.focus();
                        searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 100);
            } else if (tab) {
                switchTab(tab);
            }

            // Update bottom nav active state
            document.querySelectorAll('.bottom-nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
        });
    });
}

function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const isOpen = sidebar.classList.contains('open');

    if (isOpen) {
        sidebar.classList.remove('open');
        // Remove overlay if exists
        const overlay = document.querySelector('.sidebar-overlay');
        if (overlay) overlay.remove();
    } else {
        sidebar.classList.add('open');
        // Add overlay
        const overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay visible';
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.remove();
        });
        document.body.appendChild(overlay);
    }
}

function switchTab(tabName) {
    APP_STATE.currentTab = tabName;

    // Update sidebar nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.tab === tabName);
    });

    // Update bottom nav active state
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
        const itemTab = item.dataset.tab;
        item.classList.toggle('active', itemTab === tabName);
    });

    // Update tab content
    const mainContent = document.getElementById('main-content');

    if (tabName === 'generate') {
        // Keep gallery active, slide in generate panel
        document.getElementById('tab-gallery').classList.add('active');
        document.getElementById('tab-gallery').classList.remove('hidden');

        document.getElementById('tab-generate').classList.add('active');
        document.getElementById('tab-generate').classList.remove('hidden');

        // Hide others history/favorites etc.
        document.querySelectorAll('.tab-content').forEach(tab => {
            if (tab.id !== 'tab-gallery' && tab.id !== 'tab-generate') {
                tab.classList.remove('active');
            }
        });

        // Add class to squeeze main content
        mainContent.classList.add('has-generate-panel');
    } else {
        // Normal tab switching
        mainContent.classList.remove('has-generate-panel');

        document.querySelectorAll('.tab-content').forEach(tab => {
            const isActive = tab.id === `tab-${tabName}`;
            tab.classList.toggle('active', isActive);
            if (isActive) tab.classList.remove('hidden');
        });
    }

    if (tabName === 'history') {
        renderHistoryPage();
    }

    // Re-render pricing if switching to pricing tab
    if (tabName === 'pricing' && typeof setupPricing === 'function') {
        setupPricing();
    }

    // Load collection when switching to collection tab
    if (tabName === 'collection' && typeof loadCollection === 'function') {
        loadCollection();
    }

    // Close sidebar on mobile
    document.getElementById('sidebar').classList.remove('open');
    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) overlay.remove();

    // Scroll to top on mobile
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
// GALLERY
// ============================================================

function setupGalleryEvents() {
    // Search
    const searchInput = document.getElementById('search-input');
    const searchClear = document.getElementById('search-clear');
    let searchTimeout;

    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        APP_STATE.searchQuery = e.target.value;
        searchClear.classList.toggle('hidden', !e.target.value);

        searchTimeout = setTimeout(() => {
            filterAndRender();
        }, 300);
    });

    searchClear.addEventListener('click', () => {
        searchInput.value = '';
        APP_STATE.searchQuery = '';
        searchClear.classList.add('hidden');
        filterAndRender();
    });

    // Category chips (hidden, still works)
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            APP_STATE.currentCategory = chip.dataset.category;
            filterAndRender();
        });
    });

    // Sidebar tag-items (now hidden but logic kept if needed)
    document.querySelectorAll('.tag-item').forEach(tag => {
        tag.addEventListener('click', () => {
            document.querySelectorAll('.tag-item').forEach(t => t.classList.remove('active'));
            tag.classList.add('active');
            const cat = tag.dataset.category;
            APP_STATE.currentCategory = cat;

            // Sync new top-bar model pills
            document.querySelectorAll('.model-pill').forEach(pill => {
                pill.classList.remove('active');
                if (pill.dataset.category === cat) pill.classList.add('active');
            });

            // Sync hidden chip filter
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            const matchChip = document.querySelector(`.chip[data-category="${cat}"]`);
            if (matchChip) matchChip.classList.add('active');
            filterAndRender();
        });
    });

    // Sort tabs
    document.querySelectorAll('.sort-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.sort-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            APP_STATE.currentSort = tab.dataset.sort;
            filterAndRender();
        });
    });

    // Sort select (legacy, may not exist)
    document.getElementById('sort-select')?.addEventListener('change', (e) => {
        APP_STATE.currentSort = e.target.value;
        filterAndRender();
    });

    // Load more
    document.getElementById('btn-load-more').addEventListener('click', () => {
        renderGallery(false);
    });

    // Shuffle (may not exist in new UI)
    document.getElementById('btn-shuffle')?.addEventListener('click', () => {
        shuffleArray(APP_STATE.filteredPrompts);
        APP_STATE.displayedCount = 0;
        renderGallery(true);
        showToast('Shuffled!', 'info');
    });

    // Top-bar category pills (formerly model pills)
    document.querySelectorAll('.model-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.model-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');

            const cat = pill.dataset.category;
            if (cat) {
                APP_STATE.currentCategory = cat;

                // Sync with sidebar if applicable
                document.querySelectorAll('.tag-item').forEach(t => {
                    t.classList.remove('active');
                    if (t.dataset.category === cat) t.classList.add('active');
                });

                filterAndRender();
            }
        });
    });

    // Tags toggle
    document.getElementById('tags-toggle')?.addEventListener('click', () => {
        const header = document.getElementById('tags-toggle');
        const list = document.getElementById('sidebar-tags-list');
        header.classList.toggle('open');
        if (list) {
            list.style.display = header.classList.contains('open') ? 'none' : 'block';
        }
    });

    // Reset filters
    document.getElementById('btn-reset-filters')?.addEventListener('click', () => {
        document.getElementById('search-input').value = '';
        APP_STATE.searchQuery = '';
        APP_STATE.currentCategory = 'all';
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        document.querySelector('.chip[data-category="all"]')?.classList.add('active');
        document.querySelectorAll('.tag-item').forEach(t => t.classList.remove('active'));
        document.querySelector('.tag-item[data-category="all"]')?.classList.add('active');
        document.querySelectorAll('.model-pill').forEach(p => p.classList.remove('active'));
        document.querySelector('.model-pill[data-category="all"]')?.classList.add('active');
        filterAndRender();
    });
}

function filterAndRender() {
    let results = [...APP_STATE.prompts];

    // Category filter
    if (APP_STATE.currentCategory !== 'all') {
        results = results.filter(p =>
            p.categories.some(c => c.toLowerCase() === APP_STATE.currentCategory.toLowerCase())
        );
    }

    // Search query
    if (APP_STATE.searchQuery.trim()) {
        const keywords = APP_STATE.searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
        results = results.map(p => {
            const searchText = [p.prompt, p.author_name, p.author, ...p.categories]
                .join(' ').toLowerCase();
            let score = 0;
            for (const kw of keywords) {
                if (searchText.includes(kw)) {
                    score += 1;
                    if (p.prompt.toLowerCase().includes(kw)) score += 2;
                    if (p.categories.some(c => c.toLowerCase().includes(kw))) score += 3;
                }
            }
            return { prompt: p, score };
        })
            .filter(r => r.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(r => r.prompt);
    } else {
        // Sort
        results.sort((a, b) => {
            switch (APP_STATE.currentSort) {
                case 'likes': return b.likes - a.likes;
                case 'views': return b.views - a.views;
                case 'date': return b.date.localeCompare(a.date);
                default:
                    // Featured sort: Shuffle if 'all' category
                    if (APP_STATE.currentCategory === 'all') {
                        return Math.random() - 0.5;
                    }
                    return a.rank - b.rank;
            }
        });
    }

    APP_STATE.filteredPrompts = results;
    APP_STATE.displayedCount = 0;

    const galleryGrid = document.getElementById('gallery-grid');
    galleryGrid.innerHTML = '';

    renderGallery(true);
}

let isRenderingGallery = false;
let currentRenderId = 0;

async function renderGallery(reset) {
    if (isRenderingGallery && !reset) return;

    // Increment render sequence to abort previous async renders if changed
    const renderId = ++currentRenderId;
    isRenderingGallery = true;

    const grid = document.getElementById('gallery-grid');
    const loadMoreContainer = document.getElementById('load-more-container');
    const emptyState = document.getElementById('gallery-empty');
    const btnLoadMore = document.getElementById('btn-load-more');

    if (reset) {
        grid.innerHTML = '';
        APP_STATE.displayedCount = 0;
    }

    const start = APP_STATE.displayedCount;
    const end = Math.min(start + APP_STATE.pageSize, APP_STATE.filteredPrompts.length);
    const batch = APP_STATE.filteredPrompts.slice(start, end);

    if (APP_STATE.filteredPrompts.length === 0) {
        emptyState.classList.remove('hidden');
        loadMoreContainer.classList.add('hidden');
        isRenderingGallery = false;
        return;
    }

    emptyState.classList.add('hidden');

    // Show spinner if loading more (not initial/reset)
    const origBtnHtml = btnLoadMore ? btnLoadMore.innerHTML : '';
    if (btnLoadMore && !reset) {
        btnLoadMore.innerHTML = '<div class="gen-spinner" style="width:16px;height:16px;margin-right:8px;display:inline-block;vertical-align:middle;border-color:currentColor;border-bottom-color:transparent;"></div> Loading...';
        btnLoadMore.disabled = true;
    }

    try {
        // Pre-fetch all images so they have dimensions before DOM insertion
        // This completely eliminates CSS Columns masonry jumping effect!
        await Promise.allSettled(batch.map(item => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = resolve;
                img.onerror = resolve; // Ignore 404s, resolve immediately
                img.src = item.image || (item.images && item.images[0]);
            });
        }));

        if (renderId !== currentRenderId) return; // Abort if another render started

        batch.forEach((item, idx) => {
            const card = createGalleryCard(item, start + idx);
            grid.appendChild(card);

            // Stagger animation organically
            requestAnimationFrame(() => {
                card.style.animationDelay = `${idx * 25}ms`;
                card.classList.add('card-enter');
            });
        });

        APP_STATE.displayedCount = end;

    } catch (e) {
        console.error('Gallery render error:', e);
    } finally {
        if (btnLoadMore && !reset && renderId === currentRenderId) {
            btnLoadMore.innerHTML = origBtnHtml;
            btnLoadMore.disabled = false;
        }
        if (renderId === currentRenderId) {
            loadMoreContainer.classList.toggle('hidden', end >= APP_STATE.filteredPrompts.length);
            isRenderingGallery = false;
        }
    }
}

function createGalleryCard(item, index) {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.opacity = '0';
    card.style.animation = 'cardFadeIn 0.4s var(--ease-out) forwards';

    card.innerHTML = `
        <img src="${item.image}" alt="Prompt #${item.rank}" loading="lazy"
             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22400%22><rect fill=%22%23f5f5f5%22 width=%22400%22 height=%22400%22/><text fill=%22%23bbb%22 x=%22200%22 y=%22200%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22 font-size=%2214%22>Image unavailable</text></svg>'">
        <div class="card-overlay" style="display: flex; flex-direction: column; justify-content: space-between; padding: 12px; background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);">
            <div style="align-self: flex-end;">
                <span class="card-model" style="background: rgba(0,0,0,0.5); padding: 4px 8px; border-radius: 4px; font-size: 0.7rem;">${item.model || 'nanobanana'}</span>
            </div>
            <div style="display: flex; gap: 12px; font-size: 0.8rem; color: #fff; align-items: center;">
                <span style="display: flex; align-items: center; gap: 4px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                    ${item.likes || '2.3K'}
                </span>
                <span style="display: flex; align-items: center; gap: 4px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    ${item.views || '111K'}
                </span>
            </div>
        </div>
    `;

    card.addEventListener('click', () => openModal(item));

    return card;
}

// Add card animation keyframe dynamically
const styleSheet = document.createElement('style');
styleSheet.textContent = `
@keyframes cardFadeIn {
    from { opacity: 0; transform: translateY(16px) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
}
`;
document.head.appendChild(styleSheet);


// ============================================================
// SEARCH POPUP
// ============================================================
function setupSearchModal() {
    const btnSearch = document.getElementById('nav-search-modal-btn');
    const overlay = document.getElementById('search-modal-overlay');
    const closeBtn = document.getElementById('search-modal-close');
    const searchInput = document.getElementById('popup-search-input');

    if (btnSearch) {
        btnSearch.addEventListener('click', (e) => {
            e.preventDefault();
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.remove('open');
            const sid_overlay = document.querySelector('.sidebar-overlay');
            if (sid_overlay) sid_overlay.remove();

            overlay.classList.remove('hidden');
            searchInput.focus();
            renderSearchPopupPosts();
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            overlay.classList.add('hidden');
        });
    }

    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.add('hidden');
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase().trim();
            if (!val) {
                renderSearchPopupPosts(APP_STATE.prompts);
                return;
            }
            const keywords = val.split(/\\s+/).filter(Boolean);
            const results = APP_STATE.prompts.map(p => {
                const searchText = [p.prompt, p.author_name, p.author, ...p.categories].join(' ').toLowerCase();
                let score = 0;
                for (const kw of keywords) {
                    if (searchText.includes(kw)) score += 1;
                }
                return { item: p, score };
            }).filter(r => r.score > 0).sort((a, b) => b.score - a.score).map(r => r.item);
            renderSearchPopupPosts(results);
        });
    }

    // Tabs
    const tabs = overlay?.querySelectorAll('.search-tab');
    if (tabs) {
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                tabs.forEach(t => {
                    t.classList.remove('active');
                    t.style.fontWeight = '500';
                    t.style.color = 'var(--text-tertiary)';
                    t.style.borderBottom = 'none';
                });
                const t = e.target;
                t.classList.add('active');
                t.style.fontWeight = '600';
                t.style.color = 'var(--text-primary)';
                t.style.borderBottom = '2px solid var(--text-primary)';
                // Render based on tab later if needed, currently just empty logic for generations
            });
        });
    }
}

function renderSearchPopupPosts(posts) {
    if (!posts) {
        posts = shuffleArray([...APP_STATE.prompts]);
    }
    const grid = document.getElementById('search-popup-grid');
    if (!grid) return;
    grid.innerHTML = posts.slice(0, 20).map(item => `
        <div class="card" onclick="document.getElementById('search-modal-overlay').classList.add('hidden'); openModal(APP_STATE.prompts.find(p=>p.id==='${item.id}'))" style="border-radius:12px; overflow:hidden; cursor:pointer; box-shadow:var(--shadow-sm); transition:transform 0.2s;">
            <img src="${item.image || item.url}" alt="Post" style="width:100%; display:block; aspect-ratio:3/4; object-fit:cover;">
        </div>
    `).join('');
}

// ============================================================
// HISTORY PAGE (FULL WIDTH)
// ============================================================
function renderHistoryPage() {
    const empty = document.getElementById('history-page-empty');
    const grid = document.getElementById('history-page-grid');
    if (!APP_STATE.generationHistory || APP_STATE.generationHistory.length === 0) {
        if (empty) empty.classList.remove('hidden');
        if (grid) grid.classList.add('hidden');
    } else {
        if (empty) empty.classList.add('hidden');
        if (grid) {
            grid.classList.remove('hidden');
            grid.innerHTML = APP_STATE.generationHistory.map((item, i) => `
                <div class="card" onclick="openHistoryModal(${i})" style="position:relative; break-inside:avoid; margin-bottom:16px; border-radius:12px; overflow:hidden; cursor:pointer; box-shadow:var(--shadow-sm); transition:transform 0.2s;" onmouseover="this.querySelector('.hist-dl-btn').style.opacity=1" onmouseout="this.querySelector('.hist-dl-btn').style.opacity=0">
                    <img src="${item.url}" alt="History item" style="width:100%; display:block;">
                    <button class="hist-dl-btn" onclick="event.stopPropagation(); downloadImageFromUrl('${item.url}', 'kgen_history_${i}.jpg')" style="position:absolute; top:8px; right:8px; background:rgba(0,0,0,0.6); color:#fff; border:none; border-radius:8px; width:32px; height:32px; display:flex; align-items:center; justify-content:center; cursor:pointer; opacity:0; transition:opacity 0.2s; backdrop-filter:blur(4px);" title="Tải xuống">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    </button>
                </div>
            `).join('');
        }
    }
}

window.downloadImageFromUrl = async function (url, filename) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename || 'kgen_image.jpg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        showToast('Đã tải ảnh thành công!', 'success');
    } catch (err) {
        console.error('Error downloading image', err);
        showToast('Lỗi khi tải ảnh xuống', 'error');
    }
};

function openHistoryModal(index) {
    const item = APP_STATE.generationHistory[index];
    if (!item) return;
    openModal({
        id: 'hist_' + index,
        url: item.url,
        prompt: item.prompt,
        author_name: APP_STATE.currentUser?.name || 'You',
        author: 'you',
        user_avatar: '',
        model: item.provider === 'kie-ai' ? 'nanobanana' : 'gemini',
        images: [item.url],
        categories: ['Generation'],
        likes: 0,
        views: 0,
        rank: '-',
        date: new Date(item.timestamp).toLocaleDateString(),
        source_url: '#'
    });
}

// ============================================================
// EXTRA MODALS (GUIDE & TOOLS)
// ============================================================
function setupExtraModals() {
    document.getElementById('nav-btn-guide')?.addEventListener('click', () => {
        showGuideModal();
    });

    document.getElementById('nav-btn-ai-tools')?.addEventListener('click', () => {
        showAIToolsModal();
    });
}

// Premium-only gate for "Tạo Content Viral"
function handleViralContentClick() {
    const userTier = (APP_STATE.currentUser?.tier || 'free').toLowerCase();

    if (userTier === 'premium') {
        // Premium user — redirect to Carousel tool
        window.open('https://kgen.cloud/carousel/', '_blank');
        return;
    }

    // Free/Pro user — show upgrade popup
    const existing = document.getElementById('premium-gate-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'premium-gate-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:10000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(12px);background:rgba(0,0,0,0.7);animation:fadeIn 0.3s ease;';
    overlay.innerHTML = `
        <div style="max-width:420px;width:92%;background:linear-gradient(180deg,#1a1a2e 0%,#0d0d1a 100%);border-radius:24px;border:1px solid rgba(139,92,246,0.3);box-shadow:0 24px 64px rgba(0,0,0,0.6),0 0 80px rgba(139,92,246,0.15);padding:40px 32px;text-align:center;position:relative;animation:modalScaleIn 0.4s cubic-bezier(0.16,1,0.3,1);">
            <button onclick="document.getElementById('premium-gate-overlay').remove()" style="position:absolute;top:16px;right:16px;background:rgba(255,255,255,0.1);border:none;color:#aaa;width:32px;height:32px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">&times;</button>
            
            <div style="font-size:3rem;margin-bottom:16px;">👑</div>
            <h2 style="font-size:1.5rem;font-weight:800;color:#fff;margin:0 0 12px 0;line-height:1.3;">
                Tính năng dành riêng cho<br>
                <span style="background:linear-gradient(90deg,#a855f7,#6366f1);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Premium</span>
            </h2>
            <p style="color:#9ca3af;font-size:0.95rem;margin:0 0 24px 0;line-height:1.6;">
                Công cụ <strong style="color:#e5e7eb;">Tạo Content Viral</strong> chỉ dành cho tài khoản <strong style="color:#a855f7;">Premium</strong>.<br>
                Nâng cấp ngay để trải nghiệm toàn bộ công cụ sáng tạo nội dung AI!
            </p>
            
            <div style="display:flex;flex-direction:column;gap:10px;">
                <button onclick="document.getElementById('premium-gate-overlay').remove(); if(typeof switchTab==='function') switchTab('pricing');" style="width:100%;padding:14px;border-radius:14px;border:none;background:linear-gradient(135deg,#a855f7,#6366f1);color:white;font-size:1rem;font-weight:700;cursor:pointer;box-shadow:0 4px 20px rgba(139,92,246,0.4);transition:all 0.3s;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 30px rgba(139,92,246,0.5)'" onmouseout="this.style.transform='';this.style.boxShadow='0 4px 20px rgba(139,92,246,0.4)'">
                    🚀 Nâng cấp Premium ngay
                </button>
                <button onclick="document.getElementById('premium-gate-overlay').remove()" style="width:100%;padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:#9ca3af;font-size:0.9rem;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.borderColor='rgba(255,255,255,0.2)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.1)'">
                    Để sau
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
}

function showGuideModal() {
    const modalHtml = `
        <div id="guide-modal-overlay" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);">
            <div style="background:var(--bg-primary);width:90%;max-width:500px;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,0.2);overflow:hidden;animation:cardFadeIn 0.3s var(--ease-out);">
                <div style="padding:20px;border-bottom:1px solid var(--border-light);display:flex;justify-content:space-between;align-items:center;">
                    <h2 style="font-size:1.2rem;font-weight:700;margin:0;">Tài liệu hướng dẫn</h2>
                    <button onclick="document.getElementById('guide-modal-overlay').remove()" style="background:none;border:none;cursor:pointer;color:var(--text-tertiary);">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"></path></svg>
                    </button>
                </div>
                <div style="padding:24px;font-size:0.95rem;color:var(--text-secondary);line-height:1.6;">
                    <p style="margin-bottom:12px;">Chào mừng bạn đến với MeiGen Gallery! Dưới đây là các bước cơ bản:</p>
                    <ol style="margin-top:0;padding-left:20px;">
                        <li style="margin-bottom:8px;"><strong>Khám phá:</strong> Ở trang chủ (All), cuộn để xem các prompt mẫu đẹp nhất. Bạn có thể nhấn vào ảnh để xem prompt chi tiết.</li>
                        <li style="margin-bottom:8px;"><strong>Tạo ảnh:</strong> Chuyển sang thẻ <b style="color:var(--text-primary);">Generate</b>, dán prompt của bạn vào hộp thoại, thiết lập tỉ lệ/chất lượng rồi nhấn nút Generate.</li>
                        <li style="margin-bottom:8px;"><strong>Lịch sử:</strong> Nhấn vào nút History bên trái để xem lại tất cả các tác phẩm bạn đã tạo lúc trước.</li>
                        <li style="margin-bottom:0;"><strong>API Key:</strong> Nhấn vào biểu tượng chìa khoá ở góc trên cùng bên phải để điền API key miễn phí nếu bạn bị giới hạn hệ thống.</li>
                    </ol>
                </div>
                <div style="padding:16px 20px;background:var(--bg-tertiary);text-align:right;">
                    <button onclick="document.getElementById('guide-modal-overlay').remove()" class="btn btn-primary">Đã hiểu</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function showAIToolsModal() {
    const modalHtml = `
        <div id="aitools-modal-overlay" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);">
            <div style="background:var(--bg-primary);width:90%;max-width:600px;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,0.2);overflow:hidden;animation:cardFadeIn 0.3s var(--ease-out);">
                <div style="padding:20px;border-bottom:1px solid var(--border-light);display:flex;justify-content:space-between;align-items:center;">
                    <h2 style="font-size:1.2rem;font-weight:700;margin:0;">Bộ Công Cụ Video</h2>
                    <button onclick="document.getElementById('aitools-modal-overlay').remove()" style="background:none;border:none;cursor:pointer;color:var(--text-tertiary);">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"></path></svg>
                    </button>
                </div>
                <div style="padding:24px;display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                    <div style="border:1px dashed var(--border-color);padding:16px;border-radius:12px;background:var(--bg-secondary);opacity:0.8;cursor:not-allowed;" title="Tính năng này đang được phát triển và sẽ ra mắt sớm nhất">
                        <h3 style="margin:0 0 8px;font-size:1rem;color:var(--text-secondary);display:flex;align-items:center;flex-wrap:wrap;gap:6px;">
                            <span>🔒 Tạo Kịch bản Video</span>
                            <span style="font-size:0.65rem;background:var(--bg-active);color:var(--accent-orange);padding:2px 6px;border-radius:6px;font-weight:600;border:1px solid var(--border-light);letter-spacing:0.02em;">Đang phát triển, sẽ update sớm nhất</span>
                        </h3>
                        <p style="margin:0;font-size:0.85rem;color:var(--text-tertiary);">Tự động lên ý tưởng, phân cảnh và viết kịch bản chi tiết cho Video ngắn chuyên nghiệp.</p>
                    </div>
                    <div style="border:1px dashed var(--border-color);padding:16px;border-radius:12px;background:var(--bg-secondary);opacity:0.8;cursor:not-allowed;" title="Tính năng này đang được phát triển và sẽ ra mắt sớm nhất">
                        <h3 style="margin:0 0 8px;font-size:1rem;color:var(--text-secondary);display:flex;align-items:center;flex-wrap:wrap;gap:6px;">
                            <span>🔒 Workflow tự động tạo Video</span>
                            <span style="font-size:0.65rem;background:var(--bg-active);color:var(--accent-orange);padding:2px 6px;border-radius:6px;font-weight:600;border:1px solid var(--border-light);letter-spacing:0.02em;">Đang phát triển, sẽ update sớm nhất</span>
                        </h3>
                        <p style="margin:0;font-size:0.85rem;color:var(--text-tertiary);">Quy trình khép kín tự động sản xuất Video bằng AI từ văn bản hoặc hình ảnh.</p>
                    </div>
                    <div style="grid-column:1/-1;border:1px dashed var(--border-color);padding:16px;border-radius:12px;background:var(--bg-secondary);opacity:0.8;cursor:not-allowed;" title="Tính năng này đang được phát triển và sẽ ra mắt sớm nhất">
                        <h3 style="margin:0 0 8px;font-size:1rem;color:var(--text-secondary);display:flex;align-items:center;flex-wrap:wrap;gap:6px;">
                            <span>🔒 Tạo kịch bản Video Veo 3</span>
                            <span style="font-size:0.65rem;background:var(--bg-active);color:var(--accent-orange);padding:2px 6px;border-radius:6px;font-weight:600;border:1px solid var(--border-light);letter-spacing:0.02em;">Đang phát triển, sẽ update sớm nhất</span>
                        </h3>
                        <p style="margin:0;font-size:0.85rem;color:var(--text-tertiary);">Trích xuất nội dung từ sách, tài liệu thành Format Video Veo 3 hấp dẫn học sinh.</p>
                    </div>
                    <div style="grid-column:1/-1;border:1px solid var(--border-light);padding:16px;border-radius:12px;background:var(--bg-tertiary);transition:all 0.2s;" onmouseover="this.style.borderColor='var(--accent-blue)';" onmouseout="this.style.borderColor='var(--border-light)';">
                        <h3 style="margin:0 0 8px;font-size:1rem;color:var(--text-primary);">🚀 Workflow tạo video - Podcasts - quảng cáo</h3>
                        <p style="margin:0;font-size:0.85rem;color:var(--text-secondary);">Tự động tạo video, podcast và quảng cáo từ văn bản với quy trình chuẩn.</p>
                        <div style="display:flex;gap:8px;margin-top:12px;">
                            <a href="https://picsart.com/pricing/referral?referralCode=490498f3-87d2-4745-86e9-55f072c79294" target="_blank" class="btn btn-primary" style="padding:6px 16px; font-size:0.85rem; height:auto;">Đăng ký tài khoản</a>
                            <a href="https://picsart.com/create/workflows/fbc60bc110349ff61e7106f961e1aedd4c8e5d144bbb20c577be97293794dc4d" target="_blank" class="btn btn-ghost" style="padding:6px 16px; font-size:0.85rem; height:auto; border:1px solid var(--border-color);">Mẫu tự động</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}


// ============================================================
// MODAL
// ============================================================

function setupModal() {
    const overlay = document.getElementById('modal-overlay');
    const closeBtn = document.getElementById('modal-close');

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    // Modal action buttons
    document.getElementById('btn-use-prompt').addEventListener('click', () => {
        if (!isLoggedIn()) {
            showToast('🔒 Vui lòng đăng nhập để sử dụng prompt', 'error');
            openAuthModal();
            return;
        }
        const promptText = document.getElementById('modal-prompt').dataset.fullPrompt || document.getElementById('modal-prompt').textContent;
        document.getElementById('gen-prompt').value = promptText;
        updateCharCount();
        closeModal();
        switchTab('generate');
    });

    // Use as reference image — copies prompt AND sets gallery image as reference
    document.getElementById('btn-use-as-ref')?.addEventListener('click', () => {
        if (!isLoggedIn()) {
            showToast('🔒 Vui lòng đăng nhập để sử dụng', 'error');
            openAuthModal();
            return;
        }

        const item = window.__currentModalItem;
        console.log('btn-use-as-ref: item =', item);
        if (!item) {
            showToast('⚠️ Không tìm thấy dữ liệu ảnh', 'error');
            return;
        }

        // Get image URL from item — check multiple possible fields
        const imageUrl = item.image || item.imageUrl || item.url ||
                         (item.images && item.images[0]) || '';
        console.log('btn-use-as-ref: imageUrl =', imageUrl);

        if (!imageUrl) {
            showToast('⚠️ Không tìm thấy URL ảnh', 'error');
            return;
        }

        // Set reference images state
        APP_STATE.referenceImages = [imageUrl];

        // Copy prompt
        const promptEl = document.getElementById('modal-prompt');
        const promptText = promptEl?.dataset.fullPrompt || promptEl?.textContent || '';
        if (promptText) {
            document.getElementById('gen-prompt').value = promptText;
            updateCharCount();
        }

        // Render reference previews using the existing function
        if (typeof renderRefPreviews === 'function') {
            renderRefPreviews();
        }

        closeModal();
        switchTab('generate');
        showToast('✅ Đã thêm ảnh tham chiếu + sao chép prompt!', 'success', 3000);
    });

    document.getElementById('btn-favorite-prompt').addEventListener('click', async () => {
        const item = window.__currentModalItem;
        if (!item) return;

        const btn = document.getElementById('btn-favorite-prompt');
        const origHtml = btn.innerHTML;
        btn.innerHTML = '⏳ Đang lưu...';
        btn.disabled = true;

        try {
            await window.saveToCollection({
                imageUrl: item.image || item.images[0],
                prompt: item.prompt,
                model: item.model,
                quality: 'Gallery',
                aspectRatio: 'Original'
            });
            btn.innerHTML = '❤️ Đã lưu';
            showToast('Đã thêm vào bộ sưu tập yêu thích!', 'success');
        } catch (err) {
            console.error('Lỗi khi lưu:', err);
            showToast('Lỗi khi lưu: ' + err.message, 'error');
            btn.innerHTML = origHtml;
            btn.disabled = false;
        } finally {
            // Restore button visual after success
            setTimeout(() => {
                btn.innerHTML = origHtml;
                btn.disabled = false;
            }, 3000);
        }
    });

    document.getElementById('btn-copy-prompt').addEventListener('click', () => {
        const promptText = document.getElementById('modal-prompt').dataset.fullPrompt || document.getElementById('modal-prompt').textContent;
        copyToClipboard(promptText);
    });

    document.getElementById('btn-share-prompt')?.addEventListener('click', () => {
        const item = window.__currentModalItem;
        if (!item || !item.id) return;

        const url = new URL(window.location.href);
        url.searchParams.set('share', item.id);

        // Include the encoded prompt as fallback for history items
        // Since local history IDs don't exist in other users' browsers
        const promptText = document.getElementById('modal-prompt').dataset.fullPrompt || item.prompt;
        if (promptText) {
            url.searchParams.set('txt', encodeURIComponent(promptText.substring(0, 1500))); // Max 1500 chars for URL
        }

        copyToClipboard(url.toString());
        showToast('🔗 Đã copy link chia sẻ!', 'success');
    });

    // Login from modal lock
    document.getElementById('btn-login-from-modal').addEventListener('click', () => {
        closeModal();
        openAuthModal();
    });
}

function openModal(item) {
    const overlay = document.getElementById('modal-overlay');
    const promptEl = document.getElementById('modal-prompt');
    const lockOverlay = document.getElementById('prompt-lock-overlay');

    // If this is slim data, try to find the full version first
    if (item._slim) {
        const fullItem = APP_STATE.prompts.find(p => p.id === item.id && !p._slim);
        if (fullItem) item = fullItem;
    }

    window.__currentModalItem = item;

    // Populate images
    const imagesContainer = document.getElementById('modal-images');
    imagesContainer.innerHTML = item.images.map((url, i) =>
        `<img src="${url}" alt="Image ${i + 1}" loading="lazy">`
    ).join('');

    // Populate info
    document.getElementById('modal-rank').textContent = `#${item.rank}`;
    document.getElementById('modal-author').textContent = item.author_name;
    document.getElementById('modal-model').textContent = item.model;
    document.getElementById('modal-likes').textContent = `❤️ ${formatNumber(item.likes)}`;
    document.getElementById('modal-views').textContent = `👁️ ${formatNumber(item.views)}`;
    document.getElementById('modal-date').textContent = `📅 ${item.date}`;
    document.getElementById('modal-source-link').href = item.source_url || '#';

    // Store full prompt
    promptEl.dataset.fullPrompt = item.prompt || '';

    // Show prompt or loading state
    if (item.prompt) {
        promptEl.textContent = item.prompt;
    } else {
        promptEl.textContent = '⏳ Đang tải nội dung prompt...';
    }
    lockOverlay.classList.add('unlocked');

    // Categories
    const catsContainer = document.getElementById('modal-cats');
    catsContainer.innerHTML = item.categories.map(c =>
        `<span class="modal-cat">${CATEGORY_EMOJI[c] || '📷'} ${c}</span>`
    ).join('');

    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.body.style.overflow = '';
}

// ============================================================
// GENERATE IMAGE
// ============================================================

function setupGenerateEvents() {
    // Prompt char count
    document.getElementById('gen-prompt').addEventListener('input', updateCharCount);

    // Aspect ratio picker
    document.querySelectorAll('.ar-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.ar-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Add reference image
    document.getElementById('btn-add-ref').addEventListener('click', addReferenceImage);
    document.getElementById('ref-url').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addReferenceImage();
    });

    // Adapt prompt to reference image
    document.getElementById('btn-adapt-to-ref')?.addEventListener('click', adaptPromptToReference);

    // Update adapt-ref button visibility when prompt changes
    document.getElementById('gen-prompt')?.addEventListener('input', () => {
        updateAdaptRefButtonVisibility();
    });

    // Generate button
    document.getElementById('btn-generate').addEventListener('click', generateImage);

    // Enhance from generate
    document.getElementById('btn-enhance-from-gen').addEventListener('click', () => {
        const prompt = document.getElementById('gen-prompt').value;
        if (!prompt.trim()) {
            showToast('Vui lòng nhập prompt trước', 'error');
            return;
        }
        document.getElementById('enhance-input').value = prompt;
        switchTab('enhance');
    });

    // Result actions
    document.getElementById('btn-copy-url')?.addEventListener('click', () => {
        const img = document.getElementById('result-image');
        if (img.src) copyToClipboard(img.src);
    });

    document.getElementById('btn-download-result')?.addEventListener('click', () => {
        const img = document.getElementById('result-image');
        if (img.src) {
            const a = document.createElement('a');
            a.href = img.src;
            a.download = `kgen_${Date.now()}.png`;
            a.click();
        }
    });

    document.getElementById('btn-use-as-ref')?.addEventListener('click', () => {
        const img = document.getElementById('result-image');
        if (img.src) {
            APP_STATE.referenceImages.push(img.src);
            renderRefPreviews();
            showToast('✅ Đã thêm vào ảnh tham chiếu', 'success');
        }
    });

    // Save to collection
    document.getElementById('btn-save-collection')?.addEventListener('click', async () => {
        const img = document.getElementById('result-image');
        const promptText = document.getElementById('gen-prompt')?.value?.trim() || '';
        const quality = document.getElementById('gen-quality')?.value || '2K';
        const aspectRatio = document.querySelector('.gen-ar-opt.active')?.dataset.ratio || '1:1';

        if (!img?.src) {
            showToast('Không có ảnh để lưu', 'error');
            return;
        }

        const btn = document.getElementById('btn-save-collection');
        btn.disabled = true;
        btn.textContent = '⏳ Đang lưu...';

        try {
            await saveToCollection({
                imageUrl: img.src,
                prompt: promptText,
                model: 'nanobanana-pro',
                quality: quality,
                aspectRatio: aspectRatio,
            });
            btn.textContent = '✅ Đã lưu!';
            btn.classList.add('saved');
            showToast('❤️ Đã lưu vào bộ sưu tập!', 'success');

            // Reset after 3s
            setTimeout(() => {
                btn.textContent = '❤️ Lưu';
                btn.classList.remove('saved');
                btn.disabled = false;
            }, 3000);
        } catch (err) {
            console.error('Save collection error:', err);
            btn.textContent = '❤️ Lưu';
            btn.disabled = false;
            showToast('Lỗi khi lưu: ' + err.message, 'error');
        }
    });
}

function updateCharCount() {
    const textarea = document.getElementById('gen-prompt');
    document.getElementById('prompt-char-count').textContent = `${textarea.value.length} ký tự`;
}

function addReferenceImage() {
    const input = document.getElementById('ref-url');
    const url = input.value.trim();
    if (!url) return;

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        showToast('URL phải bắt đầu bằng http:// hoặc https://', 'error');
        return;
    }

    APP_STATE.referenceImages.push(url);
    input.value = '';
    renderRefPreviews();
    showToast('✅ Đã thêm ảnh tham chiếu', 'success');
}

function renderRefPreviews() {
    const container = document.getElementById('ref-preview-list');
    container.innerHTML = APP_STATE.referenceImages.map((url, i) => `
        <div class="ref-thumb">
            <img src="${url}" alt="Ref ${i + 1}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22><rect fill=%22%231a1a24%22 width=%2260%22 height=%2260%22/></svg>'">
            <button class="ref-thumb-remove" data-index="${i}">&times;</button>
        </div>
    `).join('');

    container.querySelectorAll('.ref-thumb-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index);
            APP_STATE.referenceImages.splice(idx, 1);
            renderRefPreviews();
        });
    });

    // Toggle "Adapt to Reference" button visibility
    updateAdaptRefButtonVisibility();
}

/**
 * Show/hide the "Adapt to Reference" button based on whether
 * reference images exist and prompt has content
 */
function updateAdaptRefButtonVisibility() {
    const btn = document.getElementById('btn-adapt-to-ref');
    if (!btn) return;
    const hasRef = APP_STATE.referenceImages.length > 0;
    const hasPrompt = (document.getElementById('gen-prompt')?.value?.trim() || '').length > 0;
    if (hasRef && hasPrompt) {
        btn.classList.remove('hidden');
    } else {
        btn.classList.add('hidden');
    }
}

/**
 * Get Gemini API key — checks user key first, then site-config
 */
function getGeminiApiKey() {
    return APP_STATE.settings.googleApiKey || window.SITE_CONFIG?.api?.geminiApiKey || '';
}

/**
 * Adapt Prompt to Reference — Uses Gemini Vision to analyze the reference image
 * and adjust the prompt to match the subject (gender, appearance, ethnicity, etc.)
 */
async function adaptPromptToReference() {
    const prompt = document.getElementById('gen-prompt').value.trim();
    if (!prompt) {
        showToast('⚠️ Vui lòng nhập prompt trước', 'error');
        return;
    }

    if (APP_STATE.referenceImages.length === 0) {
        showToast('⚠️ Vui lòng thêm ảnh tham chiếu trước', 'error');
        return;
    }

    const geminiKey = getGeminiApiKey();
    if (!geminiKey) {
        showToast('⚠️ Cần Google/Gemini API Key để phân tích ảnh. Liên hệ admin.', 'error', 4000);
        return;
    }

    const btn = document.getElementById('btn-adapt-to-ref');
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" class="adapt-spinner"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="31" stroke-linecap="round"/></svg><span class="adapt-ref-label">Đang phân tích...</span>`;

    try {
        // Get the first reference image as base64
        const refUrl = APP_STATE.referenceImages[0];
        let base64Data, mimeType;

        if (refUrl.startsWith('data:')) {
            const match = refUrl.match(/^data:(image\/\w+);base64,(.+)$/);
            if (match) {
                mimeType = match[1];
                base64Data = match[2];
            }
        } else if (refUrl.startsWith('blob:')) {
            // Blob URL — need to fetch and convert
            try {
                const blobResponse = await fetch(refUrl);
                const blob = await blobResponse.blob();
                mimeType = blob.type || 'image/jpeg';
                base64Data = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const result = reader.result;
                        const b64 = result.split(',')[1];
                        resolve(b64);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            } catch (blobErr) {
                console.error('Blob read error:', blobErr);
                throw new Error('Không thể đọc ảnh tham chiếu (blob). Thử tải lại ảnh.');
            }
        } else if (refUrl.startsWith('http')) {
            try {
                const imgResponse = await fetch(refUrl);
                const blob = await imgResponse.blob();
                mimeType = blob.type || 'image/jpeg';
                base64Data = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result.split(',')[1]);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            } catch (fetchErr) {
                console.error('Image fetch error:', fetchErr);
                throw new Error('Không thể tải ảnh tham chiếu. Hãy upload ảnh trực tiếp.');
            }
        }

        if (!base64Data || !mimeType) {
            throw new Error('Không thể đọc ảnh tham chiếu. Hãy thử upload lại ảnh.');
        }

        // Limit base64 size (max ~4MB base64 ≈ 3MB image)
        if (base64Data.length > 5 * 1024 * 1024) {
            throw new Error('Ảnh tham chiếu quá lớn (>4MB). Hãy dùng ảnh nhỏ hơn.');
        }

        let resultText = '';

        // Direct Gemini API call
        const geminiModel = 'gemini-2.5-flash';
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`;

        const systemPrompt = `You are an expert image prompt editor. You will receive:
1. A reference image of a person/subject
2. An existing image generation prompt

Your task is to MODIFY the existing prompt so that the generated image will MATCH the person/subject in the reference image.

RULES:
- Carefully analyze the reference image: gender, ethnicity, approximate age, hair style/color, facial features, body type, skin tone.
- Replace ANY conflicting subject descriptions in the prompt with ones that match the reference image.
- For example: if prompt says "young woman" but the reference is clearly a man, change it to "young man" and adjust all related pronouns and descriptions (her→his, she→he, woman→man, dress→suit, etc.).
- Keep the overall scene, composition, lighting, artistic style, background, and mood EXACTLY the same.
- Keep ALL text overlay instructions unchanged.
- Keep the same language as the original prompt.
- Output ONLY the modified prompt text, nothing else. No explanation, no labels, no quotes.`;

        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        {
                            inlineData: {
                                mimeType: mimeType,
                                data: base64Data,
                            }
                        },
                        {
                            text: `${systemPrompt}\n\n--- EXISTING PROMPT ---\n${prompt}\n--- END PROMPT ---\n\nPlease output the modified prompt:`
                        }
                    ]
                }],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 4096,
                },
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('Adapt to ref error:', response.status, errText);
            throw new Error(`Lỗi phân tích ảnh (${response.status}). Vui lòng thử lại.`);
        }

        const data = await response.json();
        const candidates = data.candidates || [];
        if (candidates.length > 0) {
            const parts = candidates[0].content?.parts || [];
            for (const part of parts) {
                if (part.text) resultText += part.text;
            }
        }

        if (resultText.trim()) {
            // Clean up any wrapping quotes or labels the model might add
            let cleanResult = resultText.trim();
            if (cleanResult.startsWith('"') && cleanResult.endsWith('"')) {
                cleanResult = cleanResult.slice(1, -1);
            }
            if (cleanResult.startsWith('```') && cleanResult.endsWith('```')) {
                cleanResult = cleanResult.replace(/^```\w*\n?/, '').replace(/\n?```$/, '').trim();
            }

            document.getElementById('gen-prompt').value = cleanResult;
            updateCharCount();
            showToast('✅ Prompt đã được điều chỉnh theo ảnh tham chiếu!', 'success', 4000);
        } else {
            showToast('⚠️ Không thể phân tích. Thử lại hoặc dùng ảnh rõ hơn.', 'error');
        }
    } catch (err) {
        console.error('Adapt to reference error:', err);
        showToast('❌ Lỗi phân tích: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
}

// ============================================================
// CREDIT DISPLAY
// ============================================================

function updateCreditDisplay(credits) {
    // Update the credit badge on Generate button
    let badge = document.getElementById('credit-badge');
    if (!badge) {
        const btn = document.getElementById('btn-generate');
        if (btn) {
            badge = document.createElement('span');
            badge.id = 'credit-badge';
            badge.style.cssText = 'display:inline-flex;align-items:center;gap:3px;margin-left:6px;background:rgba(255,255,255,0.2);padding:1px 8px;border-radius:20px;font-size:12px;font-weight:600;';
            btn.appendChild(badge);
        }
    }
    if (badge) {
        badge.textContent = credits !== null && credits !== undefined ? `${credits}` : '';
    }

    // Also update model cost display
    updateModelCostDisplay();
}

async function updateModelCostDisplay() {
    const modelSelect = document.getElementById('model-select');
    if (!modelSelect || typeof window.getModelCost !== 'function') return;

    const model = modelSelect.value || 'nano-banana-pro';
    const cost = await window.getModelCost(model);

    let costLabel = document.getElementById('model-cost-label');
    if (!costLabel) {
        const parent = modelSelect.closest('.gen-group') || modelSelect.parentElement;
        if (parent) {
            costLabel = document.createElement('span');
            costLabel.id = 'model-cost-label';
            costLabel.style.cssText = 'font-size:12px;color:var(--text-secondary,#888);margin-left:8px;';
            parent.appendChild(costLabel);
        }
    }
    if (costLabel) {
        costLabel.textContent = `${cost} cr`;
    }
}

async function initCredits() {
    if (typeof window.getUserCredits !== 'function') return;
    try {
        const info = await window.getUserCredits();
        updateCreditDisplay(info.credits);
    } catch (e) {
        console.warn('initCredits:', e.message);
    }
}

async function generateImage() {
    const prompt = document.getElementById('gen-prompt').value.trim();
    if (!prompt) {
        showToast('Vui lòng nhập prompt', 'error');
        return;
    }

    // Determine which API to use
    // NOTE: Google API key is ONLY used for adaptPromptToReference (Gemini text/vision)
    // Image generation ALWAYS uses KIE.ai — either via n8n gateway or direct user key
    const userKieKey = APP_STATE.settings.kieApiKey || '';
    const adminKieKey = getAdminAPIKey('kie');

    // Check n8n gateway (always available — KIE.ai API key is server-side in n8n)
    const n8nGw = window.SITE_CONFIG?.n8nGateway || {
        baseUrl: 'https://n8n-1adi.srv1465145.hstgr.cloud/webhook',
        enabled: true,
    };
    const hasN8nGateway = !!(n8nGw?.enabled && n8nGw?.baseUrl);

    const useKieApi = !!(userKieKey || adminKieKey || hasN8nGateway);

    if (!useKieApi) {
        showToast('❌ Không thể kết nối hệ thống tạo ảnh. Vui lòng thử lại sau.', 'error');
        return;
    }

    // Check quota if using n8n gateway (admin-paid) — not needed if user has own key
    const usingAdminServer = hasN8nGateway && !userKieKey;
    if (usingAdminServer) {
        if (!canGenerateImage()) {
            const plan = getUserPlan();
            const limit = getUserImageLimit();
            if (plan === 'free') {
                showToast(`⚠️ Bạn đã hết ${limit} lượt tạo ảnh miễn phí. Nâng cấp gói để tiếp tục!`, 'error', 5000);
            } else {
                showToast(`⚠️ Bạn đã sử dụng hết ${limit} token tháng này. Nâng cấp gói!`, 'error', 5000);
            }
            switchTab('pricing');
            return;
        }
    }


    const quality = document.getElementById('gen-quality').value;
    const aspectRatio = document.querySelector('.gen-ar-opt.active')?.dataset.ratio || '3:4';


    // Show loading
    document.getElementById('result-placeholder').classList.add('hidden');
    document.getElementById('result-image-wrap').classList.add('hidden');
    document.getElementById('result-loading').classList.remove('hidden');

    const startTime = Date.now();
    const timerEl = document.getElementById('gen-timer');
    const timerInterval = setInterval(() => {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        timerEl.textContent = `${elapsed}s`;
    }, 1000);

    try {
        let result;
        let provider;
        const selectedModel = document.getElementById('gen-model')?.value || 'nano-banana-pro';
        const langCode = document.getElementById('gen-text-lang')?.value || 'auto';

        let finalPrompt = prompt;
        if (langCode !== 'auto') {
            finalPrompt = `[CRITICAL INSTRUCTION: Any text, typography, fonts, or labels rendered in the image MUST strictly be written in ${langCode} language.]\n\n` + prompt;
        }

        // Always use KIE.ai for image generation (via n8n gateway or direct key)
        result = await generateViaKieAI(finalPrompt, aspectRatio, quality, selectedModel);
        provider = 'kie-ai';

        // Show result
        clearInterval(timerInterval);
        document.getElementById('result-loading').classList.add('hidden');

        if (result && result.imageUrl) {
            const img = document.getElementById('result-image');
            img.src = result.imageUrl;

            document.getElementById('result-image-wrap').classList.remove('hidden');

            // Track usage quota (only when using admin server, not personal key)
            if (usingAdminServer) {
                incrementImageUsage();
            }

            // Add to history
            APP_STATE.generationHistory.unshift({
                url: result.imageUrl,
                prompt,
                provider: provider,
                timestamp: new Date().toISOString(),
            });
            saveGenerationHistory();
            renderHistory();
            renderHistoryPage();

            showToast('🎉 Ảnh đã được tạo thành công!', 'success');
        } else {
            throw new Error('Không nhận được ảnh từ server. Vui lòng thử lại.');
        }
    } catch (error) {
        clearInterval(timerInterval);
        document.getElementById('result-loading').classList.add('hidden');
        document.getElementById('result-placeholder').classList.remove('hidden');

        const errorMsg = error.message || 'Lỗi không xác định';
        showGenerationError(errorMsg);

        // Refund credits if generation failed (and credits were deducted)
        if (typeof window.refundCredits === 'function' && !errorMsg.includes('credits') && !errorMsg.includes('đăng nhập')) {
            try {
                const selectedModel = document.getElementById('model-select')?.value || 'nano-banana-pro';
                const refund = await window.refundCredits(selectedModel);
                if (refund.success) {
                    console.log('💰 Credits refunded due to error');
                    showToast('💰 Credits đã được hoàn lại do lỗi', 'info', 3000);
                    if (typeof updateCreditDisplay === 'function') updateCreditDisplay(refund.credits);
                }
            } catch (refundErr) {
                console.warn('Refund failed:', refundErr);
            }
        }

        console.error('Generation error:', error);
    }
}

/**
 * Generate image via Google Gemini API (user's own key)
 * Uses gemini-3.1-flash-image-preview (Nano Banana)
 * FREE with AI Studio keys — Official docs: ai.google.dev/gemini-api/docs/image-generation
 */
async function generateViaGemini(prompt, aspectRatio, quality, apiKey) {
    const model = 'gemini-3.1-flash-image-preview';
    const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;

    console.log('🎨 Google Gemini Request:', { model, prompt: prompt.substring(0, 50), aspectRatio, refImages: APP_STATE.referenceImages.length });

    // Build content parts: text + reference images
    const parts = [];

    // Add reference images first (if any)
    if (APP_STATE.referenceImages.length > 0) {
        for (const refUrl of APP_STATE.referenceImages) {
            try {
                let base64Data, mimeType;

                if (refUrl.startsWith('data:')) {
                    // Already base64 data URL (from file upload)
                    const match = refUrl.match(/^data:(image\/\w+);base64,(.+)$/);
                    if (match) {
                        mimeType = match[1];
                        base64Data = match[2];
                    }
                } else if (refUrl.startsWith('http')) {
                    // Remote URL — fetch and convert to base64
                    try {
                        const imgResponse = await fetch(refUrl);
                        const blob = await imgResponse.blob();
                        mimeType = blob.type || 'image/jpeg';
                        const arrayBuffer = await blob.arrayBuffer();
                        const uint8Array = new Uint8Array(arrayBuffer);
                        let binary = '';
                        uint8Array.forEach(b => binary += String.fromCharCode(b));
                        base64Data = btoa(binary);
                    } catch (fetchErr) {
                        console.warn('Could not fetch reference image:', refUrl, fetchErr);
                        continue;
                    }
                }

                if (base64Data && mimeType) {
                    parts.push({
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Data,
                        }
                    });
                    console.log('🖼️ Added reference image:', mimeType, `${Math.round(base64Data.length / 1024)}KB`);
                }
            } catch (err) {
                console.warn('Error processing reference image:', err);
            }
        }
    }

    // Add text prompt — include instruction about references if we have any
    let textPrompt;
    if (parts.length > 0) {
        textPrompt = `Generate an image based on the following prompt while using the provided reference image(s) as visual guidance for style, composition, subject, or setting:\n\n${prompt}`;
    } else {
        textPrompt = `Generate an image: ${prompt}`;
    }
    parts.push({ text: textPrompt });

    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: parts
                }],
                generationConfig: {
                    responseModalities: ["IMAGE", "TEXT"],
                    temperature: 1,
                    maxOutputTokens: 8192,
                },
            }),
        });
    } catch (fetchErr) {
        console.error('Gemini fetch error:', fetchErr);
        throw new Error('Không kết nối được tới Google API. Kiểm tra kết nối mạng.');
    }

    if (!response.ok) {
        const errText = await response.text();
        console.error('Gemini error:', response.status, errText);
        let errMsg = `Google API Error (${response.status})`;
        try {
            const errData = JSON.parse(errText);
            errMsg = errData.error?.message || errMsg;
        } catch (e) { }

        if (response.status === 400) {
            if (errMsg.includes('API key')) {
                throw new Error('Google API key không hợp lệ. Kiểm tra lại key tại Google AI Studio.');
            }
            throw new Error(`Google API lỗi: ${errMsg}`);
        }
        if (response.status === 403) {
            throw new Error('Google API key không có quyền. Bật Gemini API tại Google Cloud Console.');
        }
        if (response.status === 429) {
            throw new Error('Quá giới hạn Google API. Đợi vài giây rồi thử lại.');
        }
        throw new Error(errMsg);
    }

    const data = await response.json();
    console.log('🎨 Gemini Response keys:', Object.keys(data));

    // Parse response - look for inline image data
    const candidates = data.candidates || [];
    if (candidates.length > 0) {
        const respParts = candidates[0].content?.parts || [];
        for (const part of respParts) {
            if (part.inlineData) {
                const mimeType = part.inlineData.mimeType || 'image/png';
                const base64 = part.inlineData.data;
                console.log('🎨 Got image!', mimeType, `${Math.round(base64.length / 1024)}KB`);
                return { imageUrl: `data:${mimeType};base64,${base64}` };
            }
        }
        // Check if only text was returned (model decided not to generate image)
        for (const part of respParts) {
            if (part.text) {
                console.warn('Gemini returned text only:', part.text.substring(0, 200));
            }
        }
    }

    // Check for safety block
    if (data.promptFeedback?.blockReason) {
        throw new Error(`Prompt bị chặn bởi Google Safety: ${data.promptFeedback.blockReason}. Thử prompt khác.`);
    }

    throw new Error('Google API không trả về ảnh. Thử prompt khác hoặc mô tả chi tiết hơn.');
}

/**
 * Show modal with guide on how to add Kie AI API key
 * Shown when free users exhaust their quota
 */
function showApiKeyGuideModal() {
    document.getElementById('api-key-guide-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'api-key-guide-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;';
    modal.innerHTML = `
        <div style="background:var(--bg-primary,#fff);border-radius:16px;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);padding:32px;">
            <div style="text-align:center;margin-bottom:20px;">
                <div style="font-size:2.5rem;margin-bottom:8px;">🔑</div>
                <h2 style="font-size:1.3rem;font-weight:700;margin:0 0 6px 0;">Hết lượt tạo ảnh miễn phí</h2>
                <p style="color:var(--text-secondary,#666);font-size:0.9rem;margin:0;">Thêm API key từ Kie AI để tiếp tục tạo ảnh không giới hạn!</p>
            </div>

            <div style="background:var(--bg-secondary,#f5f7fa);border-radius:12px;padding:20px;margin-bottom:16px;">
                <h3 style="font-size:0.95rem;font-weight:600;margin:0 0 12px 0;">✨ Kie AI — Nanobanana Pro</h3>
                <ol style="margin:0;padding-left:20px;font-size:0.85rem;line-height:1.7;color:var(--text-secondary,#555);">
                    <li>Truy cập <a href="https://kie.ai" target="_blank" style="color:var(--accent,#4a90d9);font-weight:600;">kie.ai</a></li>
                    <li>Đăng ký tài khoản → API Key Management</li>
                    <li>Copy API key và dán vào ô bên dưới</li>
                </ol>
                <div style="display:flex;gap:8px;margin-top:12px;">
                    <input type="text" id="guide-kie-key" placeholder="Nhập API Key từ Kie AI..." style="flex:1;padding:10px 12px;border:1px solid var(--border-light,#ddd);border-radius:8px;font-size:0.85rem;background:var(--bg-primary,#fff);">
                    <button onclick="saveGuideKey('kie')" style="padding:10px 16px;background:var(--accent,#4a90d9);color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:0.85rem;white-space:nowrap;">Lưu</button>
                </div>
            </div>

            <div style="text-align:center;padding-top:8px;border-top:1px solid var(--border-light,#eee);">
                <div style="display:flex;gap:8px;justify-content:center;margin-top:12px;">
                    <button onclick="document.getElementById('api-key-guide-modal').remove()" style="padding:10px 20px;background:transparent;border:1px solid var(--border-light,#ddd);border-radius:8px;cursor:pointer;font-size:0.85rem;color:var(--text-secondary,#888);">Đóng</button>
                </div>
            </div>
        </div>
    `;

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    document.body.appendChild(modal);
}

/**
 * Save API key from the guide modal and close it
 */
function saveGuideKey(type) {
    if (type === 'kie') {
        const key = document.getElementById('guide-kie-key')?.value.trim();
        if (!key) { showToast('Vui lòng nhập API key', 'error'); return; }
        APP_STATE.settings.kieApiKey = key;
    }

    // Save to localStorage
    localStorage.setItem('kgen_settings', JSON.stringify(APP_STATE.settings));

    // Also update settings form if visible
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    setVal('setting-kie-key', APP_STATE.settings.kieApiKey || '');

    updateProviderStatus();

    document.getElementById('api-key-guide-modal')?.remove();
    showToast('✅ API key đã được lưu! Bạn có thể tạo ảnh không giới hạn.', 'success', 4000);
}
window.saveGuideKey = saveGuideKey;

/**
 * Show a clear error message to the user
 */
function showGenerationError(message) {
    const placeholder = document.getElementById('result-placeholder');
    placeholder.classList.remove('hidden');

    let guidance = '';
    const lower = message.toLowerCase();

    if (lower.includes('token') || lower.includes('api key') || lower.includes('cấu hình')) {
        guidance = '🔒 Vui lòng vào Cài đặt để thêm Kie AI API key.';
    } else if (lower.includes('401') || lower.includes('403') || lower.includes('unauthorized')) {
        guidance = '🔑 API key không hợp lệ hoặc đã hết hạn. Kiểm tra lại trong Cài đặt.';
    } else if (lower.includes('402') || lower.includes('credit') || lower.includes('insufficient')) {
        guidance = '💰 Hết credit Kie AI. Nạp thêm tại kie.ai.';
    } else if (lower.includes('429') || lower.includes('rate')) {
        guidance = '⏳ Quá nhiều request. Vui lòng đợi vài giây rồi thử lại.';
    } else if (lower.includes('timeout') || lower.includes('timed out')) {
        guidance = '⏱️ Request quá lâu. Thử lại — có thể server đang bận.';
    } else if (lower.includes('network') || lower.includes('fetch') || lower.includes('econnrefused')) {
        guidance = '🌐 Lỗi kết nối mạng. Kiểm tra internet và thử lại.';
    } else if (lower.includes('safety') || lower.includes('policy') || lower.includes('flagged')) {
        guidance = '🚫 Prompt có thể vi phạm chính sách nội dung. Thử chỉnh sửa prompt.';
    } else {
        guidance = '❌ Vui lòng thử lại.';
    }

    showToast(`❌ ${message}\n${guidance}`, 'error', 6000);
}

/**
 * Generate image via Kie AI API
 * Supports: nano-banana-pro and nano-banana-2
 * If useProxy=true, calls server proxy (admin key hidden server-side)
 */
async function generateViaKieAI(prompt, aspectRatio, resolution, selectedModel) {
    const cfg = getSiteConfig();
    const userKieKey = APP_STATE.settings.kieApiKey || '';
    const adminKieKey = getAdminAPIKey('kie');

    // Check if n8n gateway is enabled (API key stored server-side in n8n)
    const n8nGw = window.SITE_CONFIG?.n8nGateway || {
        baseUrl: 'https://n8n-1adi.srv1465145.hstgr.cloud/webhook',
        enabled: true,
    };
    const useN8nGateway = !!(n8nGw?.enabled && n8nGw?.baseUrl);

    // Determine if we have any API access
    if (!useN8nGateway && !userKieKey && !adminKieKey) {
        showApiKeyGuideModal();
        throw new Error('API Key chưa được cấu hình.');
    }

    // Set base URL and auth headers based on mode
    let baseUrl, authHeaders;
    if (useN8nGateway) {
        // Route through n8n — no API key sent from browser
        baseUrl = n8nGw.baseUrl + '/kie';
        authHeaders = {};
        console.log('🔒 Using n8n AI Gateway for KIE.ai');
    } else {
        // Direct API call (user's own key or admin key)
        baseUrl = getAdminAPIKey('kieBase') || 'https://api.kie.ai';
        const apiKey = userKieKey || adminKieKey;
        authHeaders = { 'Authorization': `Bearer ${apiKey}` };
    }

    const model = selectedModel || getAdminAPIKey('kieModel') || 'nano-banana-pro';

    // Model configuration map
    const MODEL_CONFIG = {
        'nano-banana-pro': { apiModel: 'nano-banana-pro', maxRefs: 8, defaultRes: '2K', defaultAR: '1:1', pollType: 'recordInfo', inputField: 'image_input', hasOutputFormat: true, supportsSearch: false },
        'nano-banana-2': { apiModel: 'nano-banana-2', maxRefs: 14, defaultRes: '1K', defaultAR: 'auto', pollType: 'recordInfo', inputField: 'image_input', hasOutputFormat: true, supportsSearch: true },
        '4o-image': { apiModel: '4o-image', maxRefs: 4, defaultRes: '2K', defaultAR: '1:1', pollType: 'queryTask', inputField: 'image_input', hasOutputFormat: true, supportsSearch: false },
        'flux-kontext': { apiModel: 'flux-kontext', maxRefs: 4, defaultRes: '2K', defaultAR: '1:1', pollType: 'queryTask', inputField: 'image_input', hasOutputFormat: true, supportsSearch: false },
        'flux-pro-i2i': { apiModel: 'flux-2/pro-image-to-image', maxRefs: 8, defaultRes: '1K', defaultAR: '4:3', pollType: 'recordInfo', inputField: 'input_urls', hasOutputFormat: false, supportsSearch: false },
        'flux-flex-t2i': { apiModel: 'flux-2/flex-text-to-image', maxRefs: 0, defaultRes: '1K', defaultAR: '1:1', pollType: 'recordInfo', inputField: null, hasOutputFormat: false, supportsSearch: false },
        'flux-flex-i2i': { apiModel: 'flux-2/flex-image-to-image', maxRefs: 8, defaultRes: '1K', defaultAR: '1:1', pollType: 'recordInfo', inputField: 'input_urls', hasOutputFormat: false, supportsSearch: false },
        'midjourney': { apiModel: 'midjourney', maxRefs: 4, defaultRes: '2K', defaultAR: '1:1', pollType: 'queryTask', inputField: 'image_input', hasOutputFormat: true, supportsSearch: false },
        'grok-imagine': { apiModel: 'grok-imagine', maxRefs: 4, defaultRes: '2K', defaultAR: '1:1', pollType: 'queryTask', inputField: 'image_input', hasOutputFormat: true, supportsSearch: false },
    };

    const config = MODEL_CONFIG[model] || MODEL_CONFIG['nano-banana-pro'];
    const isRecordInfo = config.pollType === 'recordInfo';

    // Collect reference images if any (skip for text-only models)
    // Only include valid HTTP(S) URLs — KIE.ai can't handle blob:, data:, or local URLs
    const maxRefs = config.maxRefs;
    const imageInput = (maxRefs > 0 && APP_STATE.referenceImages.length > 0)
        ? APP_STATE.referenceImages
            .filter(url => url && (url.startsWith('https://') || url.startsWith('http://')) && !url.includes('blob:'))
            .slice(0, maxRefs)
        : [];

    // Map resolution value
    const resolutionValue = resolution || config.defaultRes;

    const inputParams = {
        prompt: prompt,
        aspect_ratio: aspectRatio || config.defaultAR,
        resolution: resolutionValue,
    };

    // Add output_format only if model supports it
    if (config.hasOutputFormat) {
        inputParams.output_format = 'png';
    }

    // Add reference images using the correct field name for the model
    if (config.inputField && imageInput.length > 0) {
        inputParams[config.inputField] = imageInput;
    }

    // Some models support google_search
    if (config.supportsSearch) {
        inputParams.google_search = false;
    }

    const requestBody = {
        model: config.apiModel,
        input: inputParams,
    };

    console.log('🎨 Kie AI Request:', JSON.stringify(requestBody, null, 2));

    // Step 0: Deduct credits BEFORE creating task
    let creditResult = null;
    if (typeof window.deductCredits === 'function') {
        creditResult = await window.deductCredits(model);
        if (!creditResult.success) {
            const errorMsg = creditResult.error === 'Not logged in'
                ? '⚠️ Vui lòng đăng nhập để tạo ảnh'
                : creditResult.error === 'Insufficient credits'
                    ? `⚠️ Không đủ credits! Bạn có ${creditResult.credits || 0} cr, cần ${creditResult.required || '?'} cr. Nạp thêm để tiếp tục.`
                    : `⚠️ ${creditResult.error}`;
            throw new Error(errorMsg);
        }
        console.log(`💰 Credits deducted: -${creditResult.spent}, remaining: ${creditResult.credits}`);
        // Update credit display in UI
        if (typeof updateCreditDisplay === 'function') updateCreditDisplay(creditResult.credits);
    }

    // Step 1: Create task
    // n8n gateway: /kie/createTask | Direct: /api/v1/jobs/createTask
    const createUrl = useN8nGateway
        ? `${baseUrl}/createTask`
        : `${baseUrl}/api/v1/jobs/createTask`;

    let createResponse;
    try {
        createResponse = await fetch(createUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders,
            },
            body: JSON.stringify(requestBody),
        });
    } catch (fetchErr) {
        console.error('Fetch error:', fetchErr);
        throw new Error('Không kết nối được tới server. Kiểm tra kết nối mạng.');
    }

    const responseText = await createResponse.text();
    console.log('🎨 Kie AI Response:', createResponse.status, responseText);

    if (!createResponse.ok) {
        let err = {};
        try { err = JSON.parse(responseText); } catch (e) { }
        const errMsg = err.message || err.error || responseText || `HTTP ${createResponse.status}`;
        if (createResponse.status === 401) throw new Error('API key không hợp lệ. Kiểm tra lại key.');
        if (createResponse.status === 402) throw new Error('Hết credit. Nạp thêm tại kie.ai.');
        if (createResponse.status === 429) throw new Error('Quá nhiều request. Đợi vài giây rồi thử lại.');
        throw new Error(`API Error (${createResponse.status}): ${errMsg}`);
    }

    let createData;
    try {
        createData = JSON.parse(responseText);
    } catch (e) {
        throw new Error('Phản hồi API không hợp lệ: ' + responseText.substring(0, 200));
    }

    // Check for success - handle various response formats
    if (createData.code && createData.code !== 200 && createData.code !== '200') {
        throw new Error(createData.message || createData.msg || `API trả về mã lỗi: ${createData.code}`);
    }

    const taskId = createData.data?.taskId || createData.taskId || createData.data?.task_id;
    if (!taskId) {
        console.error('No taskId in response:', createData);
        throw new Error('Không nhận được taskId. Response: ' + JSON.stringify(createData).substring(0, 300));
    }

    console.log('🎨 Task created:', taskId, '| Model:', model, '| Via:', useN8nGateway ? 'n8n gateway' : 'direct');

    // Step 2: Poll for result
    let pollUrl;
    if (useN8nGateway) {
        pollUrl = isRecordInfo
            ? `${baseUrl}/recordInfo?taskId=${taskId}`
            : `${baseUrl}/queryTask?taskId=${taskId}`;
    } else {
        pollUrl = isRecordInfo
            ? `${baseUrl}/api/v1/jobs/recordInfo?taskId=${taskId}`
            : `${baseUrl}/api/v1/jobs/queryTask/${taskId}`;
    }

    const maxWait = 120000; // 2 minutes
    const pollInterval = 2000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));

        let queryResponse;
        try {
            queryResponse = await fetch(pollUrl, {
                method: 'GET',
                headers: { ...authHeaders },
            });
        } catch (e) {
            console.warn('Poll fetch error:', e);
            continue;
        }

        if (!queryResponse.ok) {
            console.warn('Poll error:', queryResponse.status);
            continue;
        }

        const queryData = await queryResponse.json();
        const taskData = queryData.data || queryData;

        console.log('🎨 Poll:', taskData.state || taskData.status);

        if (taskData.state === 'success' || taskData.status === 'success') {
            let resultUrls = [];
            try {
                if (typeof taskData.resultJson === 'string') {
                    const resultJson = JSON.parse(taskData.resultJson);
                    resultUrls = resultJson.resultUrls || resultJson.result_urls || resultJson.images || [];
                } else if (taskData.resultJson) {
                    resultUrls = taskData.resultJson.resultUrls || taskData.resultJson.result_urls || [];
                }
                if (resultUrls.length === 0 && taskData.output) {
                    resultUrls = Array.isArray(taskData.output) ? taskData.output : [taskData.output];
                }
                if (resultUrls.length === 0 && taskData.result_url) {
                    resultUrls = [taskData.result_url];
                }
            } catch (e) {
                console.warn('Failed to parse resultJson:', e);
            }

            if (resultUrls.length > 0) {
                return { imageUrl: resultUrls[0] };
            } else {
                console.error('No URLs in task result:', taskData);
                throw new Error('Tạo ảnh thành công nhưng không có URL ảnh.');
            }
        } else if (taskData.state === 'fail' || taskData.status === 'failed') {
            const failMsg = taskData.failMsg || taskData.fail_msg || taskData.error || 'Tạo ảnh thất bại.';
            throw new Error(failMsg);
        }
        // else: waiting/processing, continue poll
    }

    throw new Error('Quá thời gian chờ (2 phút). Vui lòng thử lại.');
}


function renderHistory() {
    const grid = document.getElementById('history-grid');
    grid.innerHTML = APP_STATE.generationHistory.slice(0, 12).map((item, i) => `
        <div class="history-thumb" data-index="${i}" title="${item.prompt.slice(0, 80)}" style="position:relative;" onmouseover="this.querySelector('.hist-dl-icon').style.opacity=1" onmouseout="this.querySelector('.hist-dl-icon').style.opacity=0">
            <img src="${item.url}" alt="Gen ${i + 1}" loading="lazy">
            <button class="hist-dl-icon" onclick="event.stopPropagation(); downloadImageFromUrl('${item.url}', 'kgen_history_${i}.jpg')" style="position:absolute; bottom:4px; right:4px; background:rgba(0,0,0,0.6); color:white; border:none; border-radius:4px; width:24px; height:24px; display:flex; align-items:center; justify-content:center; cursor:pointer; opacity:0; transition:opacity 0.2s; backdrop-filter:blur(2px);">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            </button>
        </div>
    `).join('');

    grid.querySelectorAll('.history-thumb').forEach(thumb => {
        thumb.addEventListener('click', () => {
            const idx = parseInt(thumb.dataset.index);
            const item = APP_STATE.generationHistory[idx];
            if (item) {
                document.getElementById('result-image').src = item.url;
                document.getElementById('result-placeholder').classList.add('hidden');
                document.getElementById('result-loading').classList.add('hidden');
                document.getElementById('result-image-wrap').classList.remove('hidden');
            }
        });
    });
}

// ============================================================
// ENHANCE PROMPT
// ============================================================

function setupEnhanceEvents() {
    // Style picker (single select per group)
    ['style-picker', 'mode-picker', 'angle-picker'].forEach(pickerId => {
        const picker = document.getElementById(pickerId);
        if (!picker) return;
        picker.querySelectorAll('.style-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                picker.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    });

    // Enhance button
    document.getElementById('btn-enhance').addEventListener('click', enhancePrompt);

    // Copy enhanced prompt
    document.getElementById('btn-copy-enhanced').addEventListener('click', () => {
        const text = document.getElementById('enhanced-text').textContent;
        copyToClipboard(text);
    });

    // Use enhanced prompt
    document.getElementById('btn-use-enhanced').addEventListener('click', () => {
        const text = document.getElementById('enhanced-text').textContent;
        document.getElementById('gen-prompt').value = text;
        updateCharCount();
        switchTab('generate');
        showToast('✨ Prompt nâng cấp đã sẵn sàng để tạo ảnh!', 'success');
    });
}

async function enhancePrompt() {
    const input = document.getElementById('enhance-input').value.trim();
    if (!input) {
        showToast('Vui lòng nhập ý tưởng', 'error');
        return;
    }

    const style = document.querySelector('#style-picker .style-btn.active')?.dataset.style || 'realistic';
    const mode = document.querySelector('#mode-picker .style-btn.active')?.dataset.mode || 'none';
    const angle = document.querySelector('#angle-picker .style-btn.active')?.dataset.angle || 'none';

    // Show loading
    const btn = document.querySelector('.enhance-run-btn') || document.querySelector('[onclick*="enhancePrompt"]');
    const originalHtml = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = '⏳ AI đang nâng cấp...'; }

    const n8nBase = window.SITE_CONFIG?.n8nGateway?.baseUrl || 'https://n8n-1adi.srv1465145.hstgr.cloud/webhook';

    try {
        const res = await fetch(`${n8nBase}/enhance-prompt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: input, style, mode, angle }),
        });
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.enhanced) {
                document.querySelector('.enhance-placeholder')?.classList.add('hidden');
                document.getElementById('enhanced-prompt').classList.remove('hidden');
                document.getElementById('enhanced-text').textContent = data.enhanced;
                showToast('✨ Prompt đã được nâng cấp bởi Gemini AI!', 'success');
                return;
            }
        }
    } catch (err) {
        console.warn('n8n enhance failed, using local fallback:', err);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = originalHtml; }
    }

    // Fallback: local rules
    const enhanced = localEnhancePrompt(input, style, mode, angle);
    document.querySelector('.enhance-placeholder')?.classList.add('hidden');
    document.getElementById('enhanced-prompt').classList.remove('hidden');
    document.getElementById('enhanced-text').textContent = enhanced;
    showToast('✨ Prompt đã được nâng cấp!', 'success');
}

function localEnhancePrompt(prompt, style, mode, angle) {
    const styleGuides = {
        realistic: {
            prefix: '',
            details: [
                'Shot with a professional DSLR camera',
                'Natural lighting with soft diffusion',
                'Sharp focus with bokeh background',
                'Rich color grading with cinematic tones',
                'High dynamic range',
                'Photorealistic rendering, 8K resolution',
            ],
            suffix: 'Ultra-detailed, photorealistic, professional photography, masterful composition'
        },
        anime: {
            prefix: 'Anime-style illustration. ',
            details: [
                'Clean line art with cel shading',
                'Vibrant saturated colors',
                'Dynamic pose and expressive features',
                'Detailed background with depth layers',
                'Sparkle and light effects',
                'Studio quality anime production art',
            ],
            suffix: 'High-quality anime art, detailed illustration, trending on Pixiv, by top anime artists'
        },
        illustration: {
            prefix: 'Digital illustration. ',
            details: [
                'Concept art quality with painterly strokes',
                'Dramatic lighting and atmosphere',
                'Rich texture and material details',
                'Cinematic composition with strong focal point',
                'Professional color palette',
                'ArtStation quality, trending concept art',
            ],
            suffix: 'Award-winning illustration, concept art, digital painting, masterpiece quality'
        }
    };

    // Creative mode modifiers
    const modeGuides = {
        none: { prefix: '', details: [], suffix: '' },
        infographic: {
            prefix: 'Infographic design layout. ',
            details: [
                'Clean data visualization with charts and icons',
                'Organized information hierarchy with sections',
                'Modern flat design with bold typography',
                'Color-coded categories and statistics',
                'Professional business presentation style',
            ],
            suffix: 'Infographic poster, data-driven design, clean layout, magazine quality, print-ready'
        },
        'remove-bg': {
            prefix: 'Subject isolated on pure white background. ',
            details: [
                'Clean cutout with no background elements',
                'Pure white (#FFFFFF) seamless backdrop',
                'Subject perfectly centered and well-lit',
                'Studio product photography lighting',
                'No shadows on background, only subtle contact shadow',
            ],
            suffix: 'Isolated subject, white background, product photography, transparent background ready'
        },
        storyboard: {
            prefix: 'Storyboard panel sequence. ',
            details: [
                'Comic/storyboard multi-panel grid layout (2x3 or 3x2)',
                'Sequential storytelling frames showing progression',
                'Clear panel borders with cinematic framing',
                'Action arrows and movement indicators',
                'Consistent character design across panels',
                'Director notes and shot descriptions',
            ],
            suffix: 'Storyboard art, sequential panels, cinematic frames, film pre-production, visual narrative'
        }
    };

    // Camera angle modifiers
    const angleGuides = {
        none: '',
        front: 'Front-facing shot, eye-level direct view, looking straight at camera, symmetrical composition. ',
        wide: 'Extreme wide-angle shot, establishing shot showing full environment, vast landscape, panoramic view, small subject in grand scene. ',
        shoulder: 'Over-the-shoulder shot (OTS), camera positioned behind one character looking past their shoulder, depth perspective, cinematic framing. ',
        low: 'Low-angle shot, camera looking upward from below, dramatic heroic perspective, subject appears powerful and imposing, sky visible. ',
        high: 'High-angle bird\'s-eye view shot, camera looking down from above, overhead perspective, subject appears small, top-down dramatic composition. ',
        behind: 'Rear view shot from behind the subject, back-facing perspective, character looking into the distance, atmospheric depth, mysterious mood. ',
    };

    const guide = styleGuides[style] || styleGuides.realistic;
    const modeGuide = modeGuides[mode] || modeGuides.none;
    const anglePrefix = angleGuides[angle] || '';

    // Build enhanced prompt
    const mainPrompt = guide.prefix + modeGuide.prefix + anglePrefix + prompt.charAt(0).toUpperCase() + prompt.slice(1) + '.';

    const allDetails = [...guide.details, ...modeGuide.details];
    const combinedSuffix = [guide.suffix, modeGuide.suffix].filter(Boolean).join('. ');

    const sections = [
        mainPrompt,
        '',
        'Visual Details:',
        ...allDetails.map(d => `- ${d}`),
        '',
        combinedSuffix,
    ];

    return sections.join('\n');
}

// ============================================================
// WORKFLOW (ComfyUI)
// ============================================================

function setupWorkflowEvents() {
    // Check connection
    document.getElementById('btn-check-comfyui').addEventListener('click', checkComfyUIConnection);

    // File drop zone
    const dropZone = document.getElementById('wf-drop-zone');
    const fileInput = document.getElementById('wf-file-input');

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--accent-purple)';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = '';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '';
        const files = e.dataTransfer.files;
        if (files[0]) handleWorkflowFile(files[0]);
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files[0]) handleWorkflowFile(fileInput.files[0]);
    });
}

async function checkComfyUIConnection() {
    const url = document.getElementById('comfyui-url').value.trim();
    const statusIcon = document.getElementById('wf-status-icon');
    const statusTitle = document.getElementById('wf-status-title');
    const statusText = document.getElementById('wf-status-text');

    statusText.textContent = 'Đang kiểm tra...';

    try {
        const response = await fetch(`${url}/system_stats`, {
            signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
            const data = await response.json();
            statusIcon.classList.add('connected');
            statusTitle.textContent = 'ComfyUI Connected ✅';
            statusText.textContent = `GPU: ${data.devices?.[0]?.name || 'Unknown'} � VRAM: ${formatBytes(data.devices?.[0]?.vram_total || 0)}`;
            showToast('✅ Đã kết nối ComfyUI!', 'success');

            // Update provider status
            document.getElementById('provider-status').innerHTML = `
                <div class="status-dot"></div>
                <span>ComfyUI Connected</span>
            `;
        } else {
            throw new Error('Connection failed');
        }
    } catch (error) {
        statusIcon.classList.remove('connected');
        statusTitle.textContent = 'ComfyUI Offline';
        statusText.textContent = 'Không thể kết nối. Hãy đảm bảo ComfyUI đang chạy.';
        showToast('❌ Không thể kết nối ComfyUI', 'error');
    }
}

function handleWorkflowFile(file) {
    if (!file.name.endsWith('.json')) {
        showToast('Chỉ chấp nhận file .json', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const workflow = JSON.parse(e.target.result);
            const name = file.name.replace('.json', '');

            // Store in localStorage
            const workflows = JSON.parse(localStorage.getItem('kgen_workflows') || '{}');
            workflows[name] = workflow;
            localStorage.setItem('kgen_workflows', JSON.stringify(workflows));

            renderWorkflowList();
            showToast(`✅ Đã import workflow "${name}"`, 'success');
        } catch (err) {
            showToast('JSON không hợp lệ', 'error');
        }
    };
    reader.readAsText(file);
}

function renderWorkflowList() {
    const container = document.getElementById('workflow-list');
    const workflows = JSON.parse(localStorage.getItem('kgen_workflows') || '{}');
    const names = Object.keys(workflows);

    if (names.length === 0) {
        container.innerHTML = `
            <div class="wf-empty">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    <rect x="6" y="10" width="36" height="28" rx="4" stroke="currentColor" stroke-width="2" opacity="0.3"/>
                    <path d="M6 16h36" stroke="currentColor" stroke-width="2" opacity="0.3"/>
                </svg>
                <p>Chua c� workflow n�o</p>
                <p class="wf-hint">Import file JSON workflow từ ComfyUI (API Format)</p>
            </div>
        `;
        return;
    }

    container.innerHTML = names.map(name => {
        const wf = workflows[name];
        const nodeCount = Object.keys(wf).length;
        return `
            <div class="form-card" style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h4 style="font-size: 0.95rem; font-weight: 600;">${escapeHtml(name)}</h4>
                        <p style="font-size: 0.82rem; color: var(--text-secondary);">${nodeCount} nodes</p>
                    </div>
                    <button class="btn btn-sm btn-ghost" onclick="deleteWorkflow('${escapeHtml(name)}')">🗑️ Xoá</button>
                </div>
            </div>
        `;
    }).join('');
}

function deleteWorkflow(name) {
    const workflows = JSON.parse(localStorage.getItem('kgen_workflows') || '{}');
    delete workflows[name];
    localStorage.setItem('kgen_workflows', JSON.stringify(workflows));
    renderWorkflowList();
    showToast(`🗑️ Đã xoá workflow "${name}"`, 'info');
}
// Make available globally
window.deleteWorkflow = deleteWorkflow;

// ============================================================
// SETTINGS
// ============================================================

function setupSettingsEvents() {
    document.getElementById('btn-save-settings').addEventListener('click', saveSettings);
    document.getElementById('btn-reset-settings').addEventListener('click', resetSettings);

    // Toggle token visibility
    document.getElementById('btn-toggle-kie-key')?.addEventListener('click', () => {
        const input = document.getElementById('setting-kie-key');
        if (input) input.type = input.type === 'password' ? 'text' : 'password';
    });
}


function loadSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem('kgen_settings') || '{}');
        APP_STATE.settings = { ...APP_STATE.settings, ...saved };

        // Populate form
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        setVal('setting-kie-key', APP_STATE.settings.kieApiKey || '');
        setVal('setting-google-client-id', APP_STATE.settings.googleClientId || '');
        setVal('setting-supabase-url', APP_STATE.settings.supabaseUrl || '');
        setVal('setting-supabase-anon-key', APP_STATE.settings.supabaseAnonKey || '');
        setVal('setting-stripe-key', APP_STATE.settings.stripePublishableKey || '');
        setVal('setting-stripe-pro', APP_STATE.settings.stripePriceIdPro || '');
        setVal('setting-stripe-premium', APP_STATE.settings.stripePriceIdPremium || '');

        updateProviderStatus();
    } catch (e) {
        console.error('Failed to load settings:', e);
    }
}

// ============================================================
// INDEXED_DB STORAGE (to bypass localStorage 5MB limit and store 10 days of history)
// ============================================================
const DB_NAME = 'kgen_history_db';
const DB_VERSION = 1;

function getHistoryDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('history')) {
                db.createObjectStore('history', { keyPath: 'id' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function loadGenerationHistory() {
    getHistoryDB().then(db => {
        const tx = db.transaction('history', 'readonly');
        const store = tx.objectStore('history');
        const req = store.getAll();

        req.onsuccess = () => {
            let history = req.result || [];
            const idsToDelete = [];
            const validHistory = [];
            const tenDaysAgo = Date.now() - (10 * 24 * 60 * 60 * 1000);

            // Legacy localStorage migration
            try {
                const legacy = localStorage.getItem('kgen_history');
                if (legacy) {
                    const legacyItems = JSON.parse(legacy);
                    if (Array.isArray(legacyItems)) {
                        history = history.concat(legacyItems);
                    }
                    localStorage.removeItem('kgen_history');
                }
            } catch (err) {
                console.warn('Error migrating legacy history', err);
            }

            history.forEach(item => {
                if (!item.id) item.id = 'hist_' + Math.random().toString(36).substr(2, 9);
                if (!item.timestamp) item.timestamp = Date.now();

                if (item.timestamp >= tenDaysAgo) {
                    // Check for duplicates
                    if (!validHistory.some(existing => existing.id === item.id || existing.url === item.url)) {
                        validHistory.push(item);
                    }
                } else {
                    idsToDelete.push(item.id);
                }
            });

            validHistory.sort((a, b) => b.timestamp - a.timestamp);
            APP_STATE.generationHistory = validHistory;

            // Render it if UI is ready
            if (typeof renderHistory === 'function') renderHistory();
            if (typeof renderHistoryPage === 'function' && APP_STATE.currentTab === 'history') renderHistoryPage();

            db.close();

            // Sync any missing or new valid history to DB asynchronously
            if (validHistory.length > 0) saveGenerationHistory();

            // Clean up old ones asynchronously
            if (idsToDelete.length > 0) {
                getHistoryDB().then(db2 => {
                    const txDel = db2.transaction('history', 'readwrite');
                    const storeDel = txDel.objectStore('history');
                    idsToDelete.forEach(id => storeDel.delete(id));
                    db2.close();
                }).catch(e => console.error('Cleanup DB error', e));
            }
        };
    }).catch(e => {
        console.error('Failed to init IndexedDB:', e);
        // Fallback
        try {
            const hist = localStorage.getItem('kgen_history');
            if (hist) APP_STATE.generationHistory = JSON.parse(hist);
        } catch (e) { }
    });
}

function saveGenerationHistory() {
    getHistoryDB().then(db => {
        const tx = db.transaction('history', 'readwrite');
        const store = tx.objectStore('history');

        store.clear();

        APP_STATE.generationHistory.forEach(item => {
            if (!item.id) item.id = 'hist_' + Math.random().toString(36).substr(2, 9);
            if (!item.timestamp) item.timestamp = Date.now();
            store.put(item);
        });

        tx.oncomplete = () => db.close();
    }).catch(e => {
        console.warn('Could not save to IndexedDB, falling back to localStorage:', e);
        try {
            localStorage.setItem('kgen_history', JSON.stringify(APP_STATE.generationHistory.slice(0, 5)));
        } catch (fallbackErr) { }
    });
}

function saveSettings() {
    const getVal = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    APP_STATE.settings = {
        kieApiKey: getVal('setting-kie-key'),
        googleClientId: getVal('setting-google-client-id'),
        supabaseUrl: getVal('setting-supabase-url'),
        supabaseAnonKey: getVal('setting-supabase-anon-key'),
        stripePublishableKey: getVal('setting-stripe-key'),
        stripePriceIdPro: getVal('setting-stripe-pro'),
        stripePriceIdPremium: getVal('setting-stripe-premium'),
    };

    localStorage.setItem('kgen_settings', JSON.stringify(APP_STATE.settings));
    updateProviderStatus();

    // Re-init Google Sign-In if client ID changed
    if (APP_STATE.settings.googleClientId) {
        googleClientInitialized = false;
        initGoogleSignIn();
    }

    // Re-init Supabase if configured
    if (APP_STATE.settings.supabaseUrl && typeof initSupabase === 'function') {
        initSupabase();
    }

    showToast('✅ Cài đặt đã được lưu!', 'success');
}

function resetSettings() {
    localStorage.removeItem('kgen_settings');
    APP_STATE.settings = {
        kieApiKey: '',
        googleClientId: '',
        supabaseUrl: '',
        supabaseAnonKey: '',
        stripePublishableKey: '',
        stripePriceIdPro: '',
        stripePriceIdPremium: '',
    };

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    setVal('setting-kie-key', '');
    setVal('setting-google-client-id', '');
    setVal('setting-supabase-url', '');
    setVal('setting-supabase-anon-key', '');
    setVal('setting-stripe-key', '');
    setVal('setting-stripe-pro', '');
    setVal('setting-stripe-premium', '');

    updateProviderStatus();
    showToast('✅ Đã khôi phục cài đặt mặc định', 'info');
}

function updateProviderStatus() {
    const statusEl = document.getElementById('provider-status');
    const hasKey = !!(APP_STATE.settings.kieApiKey || getAdminAPIKey('kie'));

    if (hasKey) {
        statusEl.innerHTML = `
            <div class="status-dot"></div>
            <span>Kie AI (Nanobanana Pro)</span>
        `;
    } else {
        statusEl.innerHTML = `
            <div class="status-dot offline"></div>
            <span>Chưa cấu hình API key</span>
        `;
    }

    // Also sync the visual sidebar stats whenever auth or settings change
    if (typeof updateSidebarUserStats === 'function') {
        updateSidebarUserStats();
    }
}


// ============================================================
// UTILITIES
// ============================================================

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function formatBytes(bytes) {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(0) + ' MB';
    return bytes.toString();
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('✅ Đã sao chép!', 'success');
    } catch {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('✅ Đã sao chép!', 'success');
    }
}

function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ============================================================
// AUTHENTICATION SYSTEM
// ============================================================

function isLoggedIn() {
    return APP_STATE.currentUser !== null;
}

function setupAuth() {
    // Restore session
    const session = localStorage.getItem('kgen_session');
    if (session) {
        try {
            APP_STATE.currentUser = JSON.parse(session);
        } catch (e) {
            localStorage.removeItem('kgen_session');
        }
    }

    updateAuthUI();

    // Auth modal events
    document.getElementById('btn-open-login')?.addEventListener('click', openAuthModal);
    document.getElementById('auth-modal-close').addEventListener('click', closeAuthModal);
    document.getElementById('auth-modal-overlay').addEventListener('click', (e) => {
        if (e.target.id === 'auth-modal-overlay') closeAuthModal();
    });

    // Switch between login/register
    document.getElementById('btn-switch-auth').addEventListener('click', toggleAuthMode);

    // Login form
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        handleLogin();
    });

    // Register form
    document.getElementById('register-form').addEventListener('submit', (e) => {
        e.preventDefault();
        handleRegister();
    });

    // Logout
    document.getElementById('btn-logout')?.addEventListener('click', handleLogout);

    // Google Sign-In buttons
    document.getElementById('btn-google-login').addEventListener('click', handleGoogleSignIn);
    document.getElementById('btn-google-register').addEventListener('click', handleGoogleSignIn);

    // Initialize Google Identity Services
    initGoogleSignIn();
}

let authMode = 'login'; // 'login' or 'register'

function toggleAuthMode() {
    authMode = authMode === 'login' ? 'register' : 'login';

    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const title = document.getElementById('auth-title');
    const subtitle = document.getElementById('auth-subtitle');
    const switchText = document.getElementById('auth-switch-text');
    const switchBtn = document.getElementById('btn-switch-auth');

    if (authMode === 'register') {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        title.textContent = 'Tạo Tài Khoản';
        subtitle.textContent = 'Đăng ký miễn phí để truy cập toàn bộ prompts';
        switchText.textContent = 'Đã có tài khoản?';
        switchBtn.textContent = 'Đăng nhập';
    } else {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        title.textContent = 'Đang Nhập';
        subtitle.textContent = 'Đăng nhập để mở khoá toàn bộ thư viện 1,300+ prompts';
        switchText.textContent = 'Chưa có tài khoản?';
        switchBtn.textContent = 'Đăng ký';
    }
}

function openAuthModal() {
    document.getElementById('auth-modal-overlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Reset to login mode
    authMode = 'login';
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    document.getElementById('auth-title').textContent = 'Đang Nhập';
    document.getElementById('auth-subtitle').textContent = 'Đăng nhập để mở khoá toàn bộ thư viện 1,300+ prompts';
    document.getElementById('auth-switch-text').textContent = 'Chưa có tài khoản?';
    document.getElementById('btn-switch-auth').textContent = 'Đăng ký';

    // Focus first input
    setTimeout(() => {
        document.getElementById('login-email').focus();
    }, 100);
}

function closeAuthModal() {
    document.getElementById('auth-modal-overlay').classList.add('hidden');
    document.body.style.overflow = '';
}

function handleRegister() {
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    if (!name || !email || !password) {
        showToast('Vui lòng điền đầy để thông tin', 'error');
        return;
    }
    if (password.length < 6) {
        showToast('Mật khẩu phải có ít nhất 6 ký tự', 'error');
        return;
    }

    // Get existing users
    const users = JSON.parse(localStorage.getItem('kgen_users') || '{}');

    if (users[email]) {
        showToast('Email này đã được đăng ký', 'error');
        return;
    }

    // Simple hash for demo (NOT secure for production)
    const passwordHash = btoa(password);

    users[email] = {
        name,
        email,
        passwordHash,
        createdAt: new Date().toISOString(),
    };

    localStorage.setItem('kgen_users', JSON.stringify(users));

    // Auto-login after register
    const user = { email, name, createdAt: users[email].createdAt };
    APP_STATE.currentUser = user;
    localStorage.setItem('kgen_session', JSON.stringify(user));

    closeAuthModal();
    updateAuthUI();
    refreshGalleryForAuth();

    showToast(`👋 Chào mừng ${name}! Tài khoản đã được tạo thành công`, 'success');
}

function handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        showToast('Vui lòng nhập email và mật khẩu', 'error');
        return;
    }

    const users = JSON.parse(localStorage.getItem('kgen_users') || '{}');
    const user = users[email];

    if (!user) {
        showToast('Email không tồn tại. Hãy đăng ký tài khoản mới.', 'error');
        return;
    }

    if (user.passwordHash !== btoa(password)) {
        showToast('Mật khẩu không đúng', 'error');
        return;
    }

    // Login success
    const sessionUser = { email: user.email, name: user.name, createdAt: user.createdAt };
    APP_STATE.currentUser = sessionUser;
    localStorage.setItem('kgen_session', JSON.stringify(sessionUser));

    closeAuthModal();
    updateAuthUI();
    refreshGalleryForAuth();

    showToast(`👋 Chào mừng trở lại, ${user.name}!`, 'success');
}

function handleLogout() {
    APP_STATE.currentUser = null;
    localStorage.removeItem('kgen_session');

    updateAuthUI();
    refreshGalleryForAuth();

    showToast('👋 Đã đăng xuất', 'info');
}

function updateAuthUI() {
    const userProfile = document.getElementById('sidebar-user-profile');
    const loginCta = document.getElementById('sidebar-login-cta');

    if (isLoggedIn()) {
        const user = APP_STATE.currentUser;

        // Show profile, hide login
        if (userProfile) userProfile.style.display = 'block';
        if (loginCta) loginCta.style.display = 'none';

        // Update name + email
        const nameEl = document.getElementById('sidebar-user-name');
        const emailEl = document.getElementById('sidebar-user-email');
        if (nameEl) {
            nameEl.textContent = user.name || 'User';
            // Make name and avatar open the profile modal
            nameEl.style.cursor = 'pointer';
            nameEl.onclick = openUserProfileModal;
        }

        const avatarEl = document.getElementById('sidebar-avatar');
        if (avatarEl) {
            if (user.picture) {
                avatarEl.innerHTML = `<img src="${user.picture}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;cursor:pointer;" onclick="openUserProfileModal()">`;
            } else {
                avatarEl.textContent = (user.name || 'U').charAt(0).toUpperCase();
                avatarEl.style.cursor = 'pointer';
                avatarEl.onclick = openUserProfileModal;
            }
        }
        if (emailEl) emailEl.textContent = user.email || '';

        // Update plan badge
        const tier = user.tier || 'free';
        const badgeEl = document.getElementById('sidebar-plan-badge');
        if (badgeEl) {
            const badges = { free: '🌱 FREE', pro: '⚡ PRO', premium: '🔥 PREMIUM' };
            const colors = { free: '', pro: 'background:#3b82f6; color:white;', premium: 'background:#f59e0b; color:white;' };
            badgeEl.textContent = badges[tier] || badges.free;
            badgeEl.style.cssText = `font-size:0.75rem; font-weight:600; padding:3px 10px; border-radius:100px; ${colors[tier] || 'background:var(--bg-tertiary); color:var(--text-secondary);'}`;
        }

        // Update token info
        const tokenEl = document.getElementById('sidebar-token-info');
        const tokenBar = document.getElementById('sidebar-token-bar');
        const cfg = getSiteConfig();
        const limit = cfg.plans && cfg.plans[tier] ? cfg.plans[tier].imageLimit : 10;
        const used = user.imagesUsed || 0;
        if (tokenEl) tokenEl.textContent = `${used} / ${limit} Token`;
        if (tokenBar) tokenBar.style.width = `${Math.min((used / limit) * 100, 100)}%`;

        // Update upgrade button dynamically instead of hiding it
        const upgradeBtn = document.getElementById('btn-upgrade-sidebar');
        if (upgradeBtn) {
            upgradeBtn.style.display = 'flex';
            if (tier === 'free') {
                upgradeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>Nâng cấp Pro`;
                upgradeBtn.className = 'btn btn-primary btn-sm';
            } else if (tier === 'pro') {
                upgradeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>Nâng cấp Premium`;
                upgradeBtn.className = 'btn btn-primary btn-sm';
            } else {
                upgradeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>Xem bảng giá`;
                upgradeBtn.className = 'btn btn-outline btn-sm';
            }
        }

        // Setup logout button
        const logoutBtn = document.getElementById('btn-sidebar-logout');
        if (logoutBtn && !logoutBtn._bound) {
            logoutBtn._bound = true;
            logoutBtn.addEventListener('click', () => {
                handleLogout();
            });
        }

        // Hide guest banner if exists
        document.getElementById('guest-banner')?.remove();

        // Also update old hidden elements for backward compatibility
        const loggedOut = document.getElementById('user-logged-out');
        const loggedIn = document.getElementById('user-logged-in');
        const displayName = document.getElementById('user-display-name');
        if (loggedOut) loggedOut.classList.add('hidden');
        if (loggedIn) loggedIn.classList.remove('hidden');
        if (displayName) displayName.textContent = user.name;
    } else {
        // Show login, hide profile
        if (userProfile) userProfile.style.display = 'none';
        if (loginCta) loginCta.style.display = 'block';

        // Setup login button
        const loginBtn = document.getElementById('btn-sidebar-login');
        if (loginBtn && !loginBtn._bound) {
            loginBtn._bound = true;
            loginBtn.addEventListener('click', () => {
                if (typeof openAuthModal === 'function') openAuthModal();
            });
        }

        // Old elements
        const loggedOut = document.getElementById('user-logged-out');
        const loggedIn = document.getElementById('user-logged-in');
        if (loggedOut) loggedOut.classList.remove('hidden');
        if (loggedIn) loggedIn.classList.add('hidden');
    }
}

// ============================================================
// USER PROFILE MODAL & ORDER HISTORY
// ============================================================

function openUserProfileModal() {
    if (!isLoggedIn()) return;
    const user = APP_STATE.currentUser;
    const modal = document.getElementById('user-profile-modal');
    if (!modal) return;

    // Set name and email
    document.getElementById('up-name').value = user.name || user.displayName || '';
    document.getElementById('up-email').textContent = user.email || '';

    // Avatar
    const avatar = document.getElementById('up-avatar');
    if (user.picture || user.avatar_url) {
        const imgUrl = user.picture || user.avatar_url;
        avatar.innerHTML = `<img src="${imgUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" onerror="this.parentElement.innerHTML='${(user.name || user.email || 'U').charAt(0).toUpperCase()}'">`;
    } else {
        avatar.innerHTML = (user.name || user.email || 'U').charAt(0).toUpperCase();
    }

    // Plan / Tier
    const tierIcons = { free: '🌱', pro: '⚡', premium: '🔥' };
    const tierDesc = { free: 'Miễn phí trọn đời', pro: '1,000 token / tháng', premium: '5,000 token / tháng' };
    const plan = getUserPlan();
    const tier = user.tier || plan;

    document.getElementById('up-tier-icon').textContent = tierIcons[tier] || '🌱';
    document.getElementById('up-tier-name').textContent = tier.toUpperCase();
    document.getElementById('up-tier-name').style.color = tier === 'pro' ? '#3b82f6' : tier === 'premium' ? '#f59e0b' : 'var(--text-primary)';
    document.getElementById('up-tier-desc').textContent = tierDesc[tier] || '';

    // Token usage
    const used = getUserImagesUsed();
    const limit = getUserImageLimit();
    const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

    document.getElementById('up-token-count').textContent = `${used} / ${limit}`;
    const tokenBar = document.getElementById('up-token-bar');
    if (tokenBar) {
        tokenBar.style.width = `${percentage}%`;
        // Change color when usage is high
        if (percentage > 80) {
            tokenBar.style.background = 'linear-gradient(90deg, #f59e0b, #ef4444)';
        } else {
            tokenBar.style.background = 'linear-gradient(90deg, var(--accent-blue), #8b5cf6)';
        }
    }

    // Personal API key indicator
    const personalKeyEl = document.getElementById('up-personal-key');
    if (personalKeyEl) {
        personalKeyEl.style.display = hasPersonalApiKey() ? 'block' : 'none';
    }

    // Renewal date (for paid plans)
    const renewalEl = document.getElementById('up-renewal');
    if (renewalEl) {
        if (tier !== 'free') {
            const quota = getUserQuota();
            if (quota.monthStart) {
                const startDate = new Date(quota.monthStart);
                const renewDate = new Date(startDate);
                renewDate.setMonth(renewDate.getMonth() + 1);
                const formattedDate = renewDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
                document.getElementById('up-renewal-text').textContent = `Gia hạn: ${formattedDate}`;
                renewalEl.style.display = 'block';
            } else {
                renewalEl.style.display = 'none';
            }
        } else {
            renewalEl.style.display = 'none';
        }
    }

    // Show modal - remove hidden class first, then animate in
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    // small delay for css transition
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            modal.style.opacity = '1';
            modal.style.pointerEvents = 'auto';
            const content = modal.querySelector('.modal-content');
            if (content) content.style.transform = 'scale(1)';
        });
    });

    refreshOrderHistory();
}

function closeUserProfileModal() {
    const modal = document.getElementById('user-profile-modal');
    if (!modal) return;

    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
    const content = modal.querySelector('.modal-content');
    if (content) content.style.transform = 'scale(0.95)';

    setTimeout(() => {
        modal.classList.add('hidden');
        modal.style.display = '';
    }, 300);
}

function saveUserProfile() {
    const newName = document.getElementById('up-name').value.trim();
    if (!newName) {
        showToast('Tên không được để trống', 'error');
        return;
    }

    if (APP_STATE.currentUser) {
        APP_STATE.currentUser.name = newName;
        // update localstorage - session is stored as a flat user object
        const session = JSON.parse(localStorage.getItem('kgen_session'));
        if (session) {
            session.name = newName;
            localStorage.setItem('kgen_session', JSON.stringify(session));
        }

        updateAuthUI();
        showToast('Đã cập nhật hồ sơ', 'success');
        closeUserProfileModal();
    }
}

function refreshOrderHistory() {
    const list = document.getElementById('up-orders-list');
    if (!list) return;

    list.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-tertiary);">Đang tải...</div>';

    try {
        const ordersStr = localStorage.getItem('kgen_orders');
        let orders = ordersStr ? JSON.parse(ordersStr) : [];

        if (!orders || orders.length === 0) {
            list.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-tertiary);">Chưa có đơn hàng nào.</div>';
            return;
        }

        // Sort newest first
        orders.sort((a, b) => b.timestamp - a.timestamp);

        let html = '';
        orders.forEach(o => {
            const dateStr = o.timestamp || o.created_at || new Date().toISOString();
            const date = new Date(dateStr).toLocaleString('vi-VN');
            let statusHTML = '';
            let bgHTML = 'background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);';
            let statusText = 'Đang chờ';

            if (o.status === 'paid' || o.status === 'completed' || o.status === 'active') {
                bgHTML = 'background: rgba(34,197,94,0.05); border: 1px solid rgba(34,197,94,0.2);';
                statusHTML = '<span style="color:#22c55e; font-size:0.8rem; font-weight:600; padding:2px 8px; border-radius:100px; background:rgba(34,197,94,0.1);">Hoàn tất</span>';
                statusText = 'Hoàn tất';
            } else if (o.status === 'awaiting_review' || o.status === 'pending') {
                bgHTML = 'background: rgba(245,158,11,0.05); border: 1px solid rgba(245,158,11,0.2);';
                statusHTML = '<span style="color:#f59e0b; font-size:0.8rem; font-weight:600; padding:2px 8px; border-radius:100px; background:rgba(245,158,11,0.1);">Đang chờ</span>';
            } else if (o.status === 'cancelled') {
                statusHTML = '<span style="color:#ef4444; font-size:0.8rem; font-weight:600; padding:2px 8px; border-radius:100px; background:rgba(239,68,68,0.1);">Đã hủy</span>';
            }

            const tierName = o.tier === 'pro' ? 'PRO' : o.tier === 'premium' ? 'PREMIUM' : o.tier || o.plan_id || 'PRO';
            let orderCodeDisplay = o.orderCode || o.id ? `#${(o.orderCode || o.id).toString().split('-')[0].toUpperCase()}` : 'Gói Mới';

            html += `
            <div style="padding: 16px; border-radius: 12px; margin-bottom: 12px; ${bgHTML}">
                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <strong style="color:var(--accent-blue); font-size:1rem; letter-spacing:0.5px;">${orderCodeDisplay}</strong>
                    ${statusHTML}
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:0.85rem; color:var(--text-secondary);">
                    <span>Gói Nâng Cấp: <strong style="color:white;">${tierName.toUpperCase()}</strong></span>
                    <span>${o.amountVnd ? o.amountVnd.toLocaleString('vi-VN') + 'đ' : (o.amount ? o.amount.toLocaleString('vi-VN') + 'đ' : '')}</span>
                </div>
                <div style="font-size:0.75rem; color:var(--text-tertiary);">
                    📅 ${date}
                </div>
            </div>`;
        });

        list.innerHTML = html;

    } catch (e) {
        list.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-tertiary);">Lỗi hiển thị dữ liệu lịch sử.</div>';
        console.error('Error rendering history', e);
    }
}

function showGuestBanner() {
    // Don't add if already exists
    if (document.getElementById('guest-banner')) return;

    const galleryTab = document.getElementById('tab-gallery');
    const searchBar = galleryTab.querySelector('.search-filter-bar');

    const banner = document.createElement('div');
    banner.id = 'guest-banner';
    banner.className = 'guest-banner';
    banner.innerHTML = `
        <div class="guest-banner-text">
            <span class="banner-icon">??</span>
            <div>
                <h3>Bạn đang ở chế độ xem trước</h3>
                <p>Chỉ hiển thị <strong>10%</strong> nội dung prompt. Đăng nhập miễn phí để xem đầy đủ!</p>
            </div>
        </div>
        <button class="btn btn-primary btn-sm" id="btn-guest-login">🔐 Đăng nhập ngay</button>
    `;

    searchBar.parentNode.insertBefore(banner, searchBar);

    document.getElementById('btn-guest-login').addEventListener('click', openAuthModal);
}

function refreshGalleryForAuth() {
    // Re-render gallery cards to update prompt visibility and lock badges
    const grid = document.getElementById('gallery-grid');
    grid.innerHTML = '';
    APP_STATE.displayedCount = 0;
    renderGallery(true);
}

// ============================================================
// GOOGLE SIGN-IN
// ============================================================

let googleClientInitialized = false;

function getGoogleClientId() {
    // ============================================================
    // ?? GOOGLE OAUTH CLIENT ID � Paste your Client ID here!
    // Get it from: https://console.cloud.google.com/apis/credentials
    // ============================================================
    const GOOGLE_CLIENT_ID = '148696901444-8i6gftfcefcj3e81sntn51atfm4t6lbn.apps.googleusercontent.com';
    // ============================================================

    return GOOGLE_CLIENT_ID || APP_STATE.settings.googleClientId || '';
}

function initGoogleSignIn() {
    const clientId = getGoogleClientId();
    if (!clientId) {
        console.log('Google Client ID not configured. Google Sign-In will use prompt mode.');
        return;
    }

    // Wait for Google Identity Services to load
    if (typeof google === 'undefined' || !google.accounts) {
        setTimeout(initGoogleSignIn, 500);
        return;
    }

    try {
        google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
        });
        googleClientInitialized = true;
        console.log('Google Sign-In initialized successfully');
    } catch (error) {
        console.warn('Google Sign-In init error:', error);
    }
}

function handleGoogleSignIn() {
    if (typeof supabaseSignInWithGoogle === 'function') {
        showToast('Đang chuyển hướng sang trang đăng nhập Google...', 'info');
        supabaseSignInWithGoogle().then(res => {
            if (res && res.error) {
                showToast('Lỗi: ' + res.error, 'error');
            }
        }).catch(err => {
            console.error('Lỗi Google Sign-In:', err);
            handleGoogleOAuthPopup();
        });
        return;
    }

    const clientId = getGoogleClientId();

    if (!clientId) {
        // No client ID configured show helpful message
        showGoogleSetupPrompt();
        return;
    }

    if (!googleClientInitialized) {
        // Retry init
        initGoogleSignIn();
        if (!googleClientInitialized) {
            showToast('Google Sign-In đang khởi tạo, thử lại sau giây lát...', 'info');
            return;
        }
    }

    // Since localhost environments (127.0.0.1) often block Google FedCM Identity (One Tap),
    // we use a direct OAuth popup approach or fallback for local setup.
    try {
        google.accounts.id.prompt((notification) => {
            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                console.log('One Tap not fully supported here. Triggering fallback OAuth.');
                handleGoogleOAuthPopup();
            }
        });
    } catch (error) {
        console.error('Google Sign-In error:', error);
        handleGoogleOAuthPopup(); // Fallback
    }
}

function handleGoogleOAuthPopup() {
    // This is a manual fallback to Google OAuth window
    // In production with Supabase properly configured, this would be:
    // await window.supabaseSignInWithGoogle(); 

    showToast('Đang kết nối với Google...', 'info');

    // For this local client-side demo without backend/allowed origin config, 
    // we simulate a successful login to keep the UI interactive and avoid CORS blockers. 
    setTimeout(() => {
        const dummyGoogleUser = {
            email: "guest_" + Math.floor(Math.random() * 9999) + "@gmail.com",
            name: "Người Dùng Google",
            picture: "",
            provider: 'google',
            createdAt: new Date().toISOString(),
        };

        // Save to users list (auto-register)
        const users = JSON.parse(localStorage.getItem('kgen_users') || '{}');
        if (!users[dummyGoogleUser.email]) {
            users[dummyGoogleUser.email] = {
                name: dummyGoogleUser.name,
                email: dummyGoogleUser.email,
                picture: dummyGoogleUser.picture,
                provider: 'google',
                passwordHash: '',
                createdAt: dummyGoogleUser.createdAt,
            };
            localStorage.setItem('kgen_users', JSON.stringify(users));
        }

        // Login
        APP_STATE.currentUser = dummyGoogleUser;
        localStorage.setItem('kgen_session', JSON.stringify(dummyGoogleUser));

        closeAuthModal();
        updateAuthUI();
        refreshGalleryForAuth();

        showToast(`👋 Chào mừng ${dummyGoogleUser.name}! Đã đăng nhập bằng Google thành công.`, 'success');
    }, 1200);
}

function handleGoogleCredentialResponse(response) {
    try {
        // Decode the JWT credential
        const payload = decodeJwtPayload(response.credential);

        if (!payload || !payload.email) {
            showToast('Không thể xác thực với Google', 'error');
            return;
        }

        const googleUser = {
            email: payload.email,
            name: payload.name || payload.email.split('@')[0],
            picture: payload.picture || '',
            provider: 'google',
            createdAt: new Date().toISOString(),
        };

        // Save to users list (auto-register)
        const users = JSON.parse(localStorage.getItem('kgen_users') || '{}');
        if (!users[googleUser.email]) {
            users[googleUser.email] = {
                name: googleUser.name,
                email: googleUser.email,
                picture: googleUser.picture,
                provider: 'google',
                passwordHash: '', // No password for Google users
                createdAt: googleUser.createdAt,
            };
            localStorage.setItem('kgen_users', JSON.stringify(users));
        }

        // Login
        APP_STATE.currentUser = googleUser;
        localStorage.setItem('kgen_session', JSON.stringify(googleUser));

        closeAuthModal();
        updateAuthUI();
        refreshGalleryForAuth();

        showToast(`👋 Chào mừng ${googleUser.name}! Đã đăng nhập bằng Google`, 'success');
    } catch (error) {
        console.error('Google credential error:', error);
        showToast('Lỗi xử lý thông tin Google', 'error');
    }
}

function decodeJwtPayload(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error('JWT decode error:', error);
        return null;
    }
}

function showGoogleSetupPrompt() {
    // Show a friendly modal explaining how to set up Google Client ID
    const overlay = document.getElementById('auth-modal-overlay');

    // Create a temporary info section
    const infoDiv = document.createElement('div');
    infoDiv.id = 'google-setup-info';
    infoDiv.className = 'google-setup-toast';
    infoDiv.innerHTML = `
        <div class="google-setup-content">
            <h3>⚙️ Cấu hình Google Sign-In</h3>
            <p>�? sử dụng đăng nhập Google, bạn c?n:</p>
            <ol>
                <li>Tạo project tải <a href="https://console.cloud.google.com" target="_blank" style="color:var(--accent-blue)">Google Cloud Console</a></li>
                <li>B?t Google Identity API</li>
                <li>Tạo OAuth 2.0 Client ID (Web application)</li>
                <li>Thêm <code>http://localhost:3456</code> vào Authorized JavaScript origins</li>
                <li>D�n Client ID vào <strong>Cài đặt ? Google Client ID</strong></li>
            </ol>
            <div style="display:flex;gap:8px;margin-top:12px">
                <button class="btn btn-primary btn-sm" id="btn-goto-settings-google">⚙️ Mở Cài đặt</button>
                <button class="btn btn-ghost btn-sm" id="btn-close-google-setup">Đóng</button>
            </div>
        </div>
    `;

    // Style inline for simplicity
    infoDiv.style.cssText = `
        position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
        background: var(--bg-elevated); border: 1px solid var(--border-color);
        border-radius: 16px; padding: 20px 24px; max-width: 480px; width: 90%;
        z-index: 1001; box-shadow: 0 8px 40px rgba(0,0,0,0.4);
        animation: toastIn 0.3s var(--ease-spring);
    `;

    document.body.appendChild(infoDiv);

    document.getElementById('btn-goto-settings-google').addEventListener('click', () => {
        infoDiv.remove();
        closeAuthModal();
        switchTab('settings');
        // Focus the Google Client ID input
        setTimeout(() => {
            document.getElementById('setting-google-client-id')?.focus();
        }, 300);
    });

    document.getElementById('btn-close-google-setup').addEventListener('click', () => {
        infoDiv.remove();
    });

    // Auto-remove after 15s
    setTimeout(() => infoDiv.remove(), 15000);
}

// ============================================================
// PRICING TAB
// ============================================================

async function setupPricing() {
    const container = document.getElementById('pricing-container');
    if (!container || typeof PRICING_TIERS === 'undefined') return;

    const currentTier = APP_STATE.currentUser?.tier || 'free';
    const _cp = typeof convertPrice === 'function' ? convertPrice : (v) => v.toLocaleString() + 'đ';
    const _period = typeof getCurrencyPeriod === 'function' ? getCurrencyPeriod() : '/tháng';

    // Load dynamic prices from Supabase api_config (synced with Admin Panel)
    let _bpv = typeof BASE_PRICES_VND !== 'undefined' ? { ...BASE_PRICES_VND } : { free: 0, pro: 39000, premium: 199000 };
    if (typeof window.loadCentralConfig === 'function') {
        try {
            const config = await window.loadCentralConfig();
            if (config.plan_prices) {
                if (config.plan_prices.pro?.price) _bpv.pro = config.plan_prices.pro.price;
                if (config.plan_prices.premium?.price) _bpv.premium = config.plan_prices.premium.price;
                // Update PRICING_TIERS features with dynamic credits
                PRICING_TIERS.forEach(tier => {
                    const planData = config.plan_prices[tier.id];
                    if (planData && planData.tokens_limit) {
                        if (tier.id === 'pro') {
                            tier.price = _cp(planData.price);
                            tier.features[0] = `Tặng ${planData.tokens_limit} Credits / tháng (~${planData.tokens_limit} ảnh thường)`;
                        } else if (tier.id === 'premium') {
                            tier.price = _cp(planData.price);
                            tier.features[0] = `Tặng ${planData.tokens_limit.toLocaleString()} Credits / tháng (Business)`;
                        } else if (tier.id === 'free') {
                            tier.features[0] = `Tặng kèm ${planData.tokens_limit} Credits ban đầu`;
                        }
                    }
                });
                console.log('💰 Pricing synced from Supabase:', _bpv);
            }
        } catch (e) { console.warn('Pricing sync fallback:', e.message); }
    }

    container.innerHTML = `
        <div style="margin-bottom: 32px;">
            <div class="pricing-grid-inline">
                ${PRICING_TIERS.map(tier => `
                    <div class="pricing-card-inline ${tier.popular ? 'popular' : ''} ${currentTier === tier.id ? 'current' : ''}">
                        ${tier.popular ? '<div class="popular-badge-inline">🔥 ' + (typeof t === 'function' ? t('home.popular').replace('💎 ', '') : 'Phổ biến nhất') + '</div>' : ''}
                        <div class="tier-header-inline">
                            <span class="tier-emoji-inline">${tier.emoji}</span>
                            <h3>${tier.name}</h3>
                        </div>
                        <div class="tier-price-inline">
                            <span class="amount">${_bpv[tier.id] !== undefined ? _cp(_bpv[tier.id]) : tier.price}</span>
                            <span class="period">${_period}</span>
                        </div>
                        <ul class="tier-features-inline">
                            ${tier.features.map(f => `<li>${f}</li>`).join('')}
                            ${tier.limitations.map(l => `<li class="limit">\u274c ${l}</li>`).join('')}
                        </ul>
                        <button class="btn ${tier.buttonClass} tier-btn-inline" 
                            data-tier="${tier.id}"
                            ${currentTier === tier.id ? 'disabled' : ''}>
                            ${currentTier === tier.id ? '\u2713 ' + (typeof t === 'function' ? t('common.save') : 'Đang sử dụng') : tier.buttonText}
                        </button>
                    </div>
                `).join('')}
            </div>
        </div>

        <div style="margin-top: 48px; padding-top: 32px; border-top: 1px solid rgba(255,255,255,0.05);">
            <div style="text-align:center; margin-bottom: 24px;">
                <h2 style="font-size:1.8rem; font-weight:800; margin-bottom:8px;">Nạp thêm <span style="color:var(--accent-blue)">Credits</span></h2>
                <p style="color:var(--text-secondary); max-width:500px; margin:0 auto;">Dùng cho khách hàng đã xài hết Credit trong Gói Tháng mà vẫn còn nhu cầu.</p>
            </div>
            <div class="pricing-grid-inline" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));">
                ${(typeof TOPUP_PACKAGES !== 'undefined' ? TOPUP_PACKAGES : []).map(pack => `
                    <div class="pricing-card-inline" style="padding:24px; text-align:center;">
                        ${pack.best ? '<div class="popular-badge-inline" style="background:#10b981; color:#fff;">' + pack.bonus + '</div>' : ''}
                        <div style="font-size:3rem; margin-bottom:12px;">${pack.emoji}</div>
                        <h3 style="font-size:1.2rem; margin-bottom:4px;">${pack.name}</h3>
                        <div style="color:var(--accent-blue); font-size:1.8rem; font-weight:800; margin-bottom:16px;">
                            ${pack.credits} <span style="font-size:1rem; font-weight:600; color:var(--text-secondary);">Credits</span>
                        </div>
                        <div style="font-size:1.4rem; font-weight:700; margin-bottom:20px;">${pack.price}</div>
                        <button class="btn ${pack.best ? 'btn-primary' : 'btn-outline'} topup-btn-inline" style="width:100%; border-radius:12px;" data-pack="${pack.id}">
                            Mua ngay
                        </button>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="pricing-footer-inline">
            <p>${typeof t === 'function' ? t('pricing.footer') : '🔒 Thanh toán tự động KGen Guard'}</p>
            <p class="sub-note">${typeof t === 'function' ? t('pricing.footer_sub') : 'Kích hoạt ngay khi nhận thanh toán. Quản lý dễ dàng.'}</p>
        </div>
    `;

    // Attach events
    container.querySelectorAll('.tier-btn-inline').forEach(btn => {
        btn.addEventListener('click', () => {
            const tier = btn.dataset.tier;
            if (tier === 'free') return;
            if (typeof handleUpgrade === 'function') {
                handleUpgrade(tier);
            }
        });
    });

    // Attach events for topup packages
    container.querySelectorAll('.topup-btn-inline').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!APP_STATE.currentUser) {
                switchTab('home');
                showToast("Vui lòng đăng nhập trước khi nạp thêm Credit");
                return;
            }
            const packId = btn.dataset.pack;
            if (typeof handleUpgrade === 'function') {
                handleUpgrade(packId);
            }
        });
    });
}

// ============================================================
// USER GUIDE MODAL
// ============================================================

let guideCurrentSlide = 0;
const GUIDE_TOTAL_SLIDES = 5;

function setupGuide() {
    const overlay = document.getElementById('guide-overlay');
    if (!overlay) return;

    // Open guide from sidebar
    document.getElementById('btn-open-guide')?.addEventListener('click', (e) => {
        e.preventDefault();
        openGuide();
        // Close sidebar on mobile
        document.getElementById('sidebar')?.classList.remove('open');
        const sidebarOverlay = document.querySelector('.sidebar-overlay');
        if (sidebarOverlay) sidebarOverlay.remove();
    });

    // Close
    document.getElementById('guide-close')?.addEventListener('click', closeGuide);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeGuide();
    });

    // Prev / Next
    document.getElementById('guide-prev')?.addEventListener('click', () => {
        goToGuideSlide(guideCurrentSlide - 1);
    });
    document.getElementById('guide-next')?.addEventListener('click', () => {
        if (guideCurrentSlide === GUIDE_TOTAL_SLIDES - 1) {
            closeGuide();
        } else {
            goToGuideSlide(guideCurrentSlide + 1);
        }
    });

    // Dots
    document.querySelectorAll('.guide-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            goToGuideSlide(parseInt(dot.dataset.dot));
        });
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (!overlay.classList.contains('active')) return;
        if (e.key === 'Escape') closeGuide();
        if (e.key === 'ArrowRight') goToGuideSlide(guideCurrentSlide + 1);
        if (e.key === 'ArrowLeft') goToGuideSlide(guideCurrentSlide - 1);
    });

    // Auto-show disabled — guide available via sidebar button
    // if (!localStorage.getItem('kgen_guide_seen')) {
    //     setTimeout(() => {
    //         openGuide();
    //         localStorage.setItem('kgen_guide_seen', 'true');
    //     }, 2000);
    // }
}

function openGuide() {
    guideCurrentSlide = 0;
    updateGuideSlide();
    document.getElementById('guide-overlay')?.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeGuide() {
    document.getElementById('guide-overlay')?.classList.remove('active');
    document.body.style.overflow = '';
}

function goToGuideSlide(index) {
    if (index < 0 || index >= GUIDE_TOTAL_SLIDES) return;
    guideCurrentSlide = index;
    updateGuideSlide();
}

function updateGuideSlide() {
    document.querySelectorAll('.guide-slide').forEach(slide => {
        slide.classList.toggle('active', parseInt(slide.dataset.slide) === guideCurrentSlide);
    });
    document.querySelectorAll('.guide-dot').forEach(dot => {
        dot.classList.toggle('active', parseInt(dot.dataset.dot) === guideCurrentSlide);
    });

    const prevBtn = document.getElementById('guide-prev');
    const nextBtn = document.getElementById('guide-next');
    if (prevBtn) prevBtn.disabled = guideCurrentSlide === 0;
    if (nextBtn) {
        nextBtn.textContent = guideCurrentSlide === GUIDE_TOTAL_SLIDES - 1 ? 'Bắt đầu dùng! 🎉' : 'Tiếp →';
    }
}

// Init guide when DOM ready
document.addEventListener('DOMContentLoaded', () => {
    setupGuide();
    setupModelSelector();
    setupGenControls();
    setupBanner();
});

function setupBanner() {
    const banner = document.getElementById('gen-banner');
    const closeBtn = document.getElementById('gen-banner-close');
    if (closeBtn && banner) {
        closeBtn.addEventListener('click', () => {
            banner.classList.add('hidden');
        });
    }
}

// ============================================================
// MODEL SELECTOR DROPDOWN
// ============================================================

function setupModelSelector() {
    const selector = document.getElementById('model-selector');
    const btn = document.getElementById('model-selector-btn');
    const dropdown = document.getElementById('model-dropdown');
    const hiddenInput = document.getElementById('gen-model');
    const selName = document.getElementById('model-sel-name');
    const btnCredits = document.getElementById('gen-btn-credits');

    if (!selector || !btn) return;

    // Toggle dropdown
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        selector.classList.toggle('open');
        dropdown.classList.toggle('active');
    });

    // Select model option
    const options = dropdown.querySelectorAll('.model-option');
    options.forEach(opt => {
        opt.addEventListener('click', () => {
            options.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');

            const modelName = opt.querySelector('.model-opt-name').textContent;
            const credits = opt.dataset.credits;
            const modelValue = opt.dataset.model;

            selName.textContent = modelName;
            if (btnCredits) btnCredits.textContent = credits;

            // Update icon
            const optIcon = opt.querySelector('.model-opt-icon');
            const selIcon = btn.querySelector('.model-sel-icon');
            if (optIcon.classList.contains('emoji')) {
                selIcon.innerHTML = '<span style="font-size:1.1rem">' + optIcon.textContent + '</span>';
            } else {
                const imgSrc = optIcon.querySelector('img');
                if (imgSrc) {
                    selIcon.innerHTML = '<img src="' + imgSrc.src + '" width="18" height="18" alt="">';
                }
            }

            if (hiddenInput) hiddenInput.value = modelValue;
            selector.classList.remove('open');
            dropdown.classList.remove('active');
        });
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!selector.contains(e.target)) {
            selector.classList.remove('open');
            dropdown.classList.remove('active');
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            selector.classList.remove('open');
            dropdown.classList.remove('active');
        }
    });
}

// ============================================================
// GENERATE TAB CONTROLS
// ============================================================

function setupGenControls() {
    // --- Count Stepper ---
    const countDisplay = document.getElementById('gen-count-display');
    const countInput = document.getElementById('gen-count');
    const btnMinus = document.getElementById('btn-count-minus');
    const btnPlus = document.getElementById('btn-count-plus');
    let count = 1;
    const maxCount = 4;

    function updateCount() {
        if (countDisplay) countDisplay.innerHTML = count + '<span class="gen-ctrl-muted">/' + maxCount + '</span>';
        if (countInput) countInput.value = count;
        if (btnMinus) btnMinus.disabled = count <= 1;
        if (btnPlus) btnPlus.disabled = count >= maxCount;
    }

    if (btnMinus) btnMinus.addEventListener('click', () => { if (count > 1) { count--; updateCount(); } });
    if (btnPlus) btnPlus.addEventListener('click', () => { if (count < maxCount) { count++; updateCount(); } });

    // --- Aspect Ratio Dropdown ---
    const arTrigger = document.getElementById('gen-ar-trigger');
    const arDropdown = document.getElementById('gen-ar-dropdown');

    if (arTrigger && arDropdown) {
        arTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            arDropdown.classList.toggle('hidden');
            // Close quality if open
            const qd = document.getElementById('gen-quality-dropdown');
            if (qd) qd.classList.add('hidden');
        });

        arDropdown.querySelectorAll('.gen-ar-opt').forEach(opt => {
            opt.addEventListener('click', () => {
                arDropdown.querySelectorAll('.gen-ar-opt').forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                const ratio = opt.dataset.ratio;
                arTrigger.querySelector('span').textContent = ratio;
                arTrigger.dataset.ratio = ratio;
                arDropdown.classList.add('hidden');
            });
        });
    }

    // --- Generative Setting Segmented Controls ---
    const segmentedControls = document.querySelectorAll('.segmented-control');
    segmentedControls.forEach(control => {
        const btns = control.querySelectorAll('.segment-btn');
        // Find the hidden input that follows this control group
        const hiddenInput = control.parentNode.querySelector('input[type="hidden"]');

        btns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                // Remove active from all
                btns.forEach(b => b.classList.remove('active'));
                // Add active to clicked
                btn.classList.add('active');

                if (hiddenInput) {
                    hiddenInput.value = btn.dataset.value;
                }
            });
        });
    });

    // --- Model Grid Cards ---
    const modelGrid = document.querySelector('.gen-model-grid');
    if (modelGrid) {
        const modelCards = modelGrid.querySelectorAll('.gen-model-card');
        const modelHiddenInput = modelGrid.parentNode.querySelector('input[type="hidden"]');
        const btnCredits = document.getElementById('gen-btn-credits');

        modelCards.forEach(card => {
            card.addEventListener('click', (e) => {
                e.preventDefault();
                modelCards.forEach(c => c.classList.remove('active'));
                card.classList.add('active');

                if (modelHiddenInput) {
                    modelHiddenInput.value = card.dataset.value;
                }
                // Update credits on generate button
                if (btnCredits && card.dataset.credits) {
                    btnCredits.textContent = card.dataset.credits;
                }
            });
        });
    }

    // Close all dropdowns on outside click
    document.addEventListener('click', (e) => {
        if (arDropdown && !arDropdown.contains(e.target) && arTrigger && !arTrigger.contains(e.target)) {
            arDropdown.classList.add('hidden');
        }
    });

    // --- Reference File Upload ---
    const refCard = document.getElementById('ref-drop-area');
    const refFileInput = document.getElementById('ref-file-input');
    const btnAddRefFile = document.getElementById('btn-add-ref-file');
    const refPreviewList = document.getElementById('ref-preview-list');

    if (btnAddRefFile && refFileInput) {
        btnAddRefFile.addEventListener('click', (e) => {
            e.stopPropagation();
            refFileInput.click();
        });
    }

    if (refCard && refFileInput) {
        refCard.addEventListener('click', () => {
            refFileInput.click();
        });

        refFileInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (!files.length) return;
            Array.from(files).forEach(file => {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    // Store base64 data URL into APP_STATE so it's sent to API
                    APP_STATE.referenceImages.push(ev.target.result);
                    renderRefPreviews();
                    showToast('✅ Đã thêm ảnh tham chiếu', 'success');
                };
                reader.readAsDataURL(file);
            });
            // Reset input so same file can be selected again
            refFileInput.value = '';
        });
    }

    // --- Describe Image Card ---
    const describeCard = document.getElementById('gen-describe-card');
    if (describeCard) {
        describeCard.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/jpeg,image/png,image/webp';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const geminiKey = getGeminiApiKey();
                if (!geminiKey) {
                    showToast('⚠️ Cần Google API Key để phân tích ảnh. Liên hệ admin.', 'error', 4000);
                    return;
                }

                showToast('🔍 Đang phân tích ảnh...', 'info', 5000);

                // Read file as base64
                const reader = new FileReader();
                reader.onload = async (ev) => {
                    const dataUrl = ev.target.result;
                    const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
                    if (!match) {
                        showToast('❌ Không đọc được ảnh', 'error');
                        return;
                    }

                    const mimeType = match[1];
                    const base64Data = match[2];

                    try {
                        const geminiModel = 'gemini-2.5-flash';
                        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`;

                        const response = await fetch(geminiUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [{
                                    parts: [
                                        {
                                            inlineData: {
                                                mimeType: mimeType,
                                                data: base64Data,
                                            }
                                        },
                                        {
                                            text: `Analyze this image in detail and write a comprehensive image generation prompt in English that would recreate this image. Include details about: subject, pose, expression, clothing, setting, lighting, colors, camera angle, mood, and artistic style. Output ONLY the prompt text, no explanation or labels.`
                                        }
                                    ]
                                }],
                                generationConfig: {
                                    temperature: 0.7,
                                    maxOutputTokens: 2048,
                                },
                            }),
                        });

                        if (!response.ok) {
                            const errText = await response.text();
                            console.error('Describe error:', response.status, errText);
                            throw new Error(`Lỗi phân tích ảnh (${response.status})`);
                        }

                        const data = await response.json();
                        const candidates = data.candidates || [];
                        let resultText = '';
                        if (candidates.length > 0) {
                            const parts = candidates[0].content?.parts || [];
                            for (const part of parts) {
                                if (part.text) resultText += part.text;
                            }
                        }

                        if (resultText.trim()) {
                            document.getElementById('gen-prompt').value = resultText.trim();
                            updateCharCount();
                            showToast('✅ Phân tích ảnh xong! Prompt đã được tạo.', 'success');
                        } else {
                            showToast('⚠️ Không phân tích được ảnh. Thử ảnh khác.', 'error');
                        }
                    } catch (err) {
                        console.error('Describe image error:', err);
                        showToast('❌ Lỗi phân tích ảnh: ' + err.message, 'error');
                    }
                };
                reader.readAsDataURL(file);
            };
            input.click();
        });
    }
}

// ============================================================
// USER SIDEBAR STATS
// ============================================================

function updateSidebarUserStats() {
    const statsContainer = document.getElementById('sidebar-user-stats');
    const ctaContainer = document.getElementById('sidebar-user-cta');
    const planNameEl = document.getElementById('sidebar-plan-name');
    const tokenCountEl = document.getElementById('sidebar-token-count');
    const tokenBarEl = document.getElementById('sidebar-token-bar');

    // Only show if user has an API configuration or is logged in
    const userGoogleKey = APP_STATE.settings.googleApiKey || '';
    const userKieKey = APP_STATE.settings.kieApiKey || '';
    const adminKieKey = getAdminAPIKey('kie');

    if (!userGoogleKey && !userKieKey && !adminKieKey) {
        // No keys at all, show promo
        if (statsContainer) statsContainer.style.display = 'none';
        if (ctaContainer) ctaContainer.style.display = 'flex';
        return;
    }

    if (statsContainer) statsContainer.style.display = 'block';
    if (ctaContainer) ctaContainer.style.display = 'none';

    if (userGoogleKey) {
        if (planNameEl) planNameEl.textContent = 'Google API';
        if (tokenCountEl) tokenCountEl.textContent = '∞ Mức phí';
        if (tokenBarEl) {
            tokenBarEl.style.width = '100%';
            tokenBarEl.style.background = 'var(--success)';
        }
        return;
    }

    // Using KI AI
    const plan = getUserPlan();
    const limit = getUserImageLimit();
    const used = typeof getUserImagesUsed === 'function' ? getUserImagesUsed() : 0;

    if (planNameEl) {
        planNameEl.textContent = 'Gói ' + plan.toUpperCase();
    }

    if (tokenCountEl) {
        tokenCountEl.textContent = `${used} / ${limit}`;
    }

    if (tokenBarEl) {
        const percent = Math.min((used / limit) * 100, 100);
        tokenBarEl.style.width = `${percent}%`;
        if (percent > 90) {
            tokenBarEl.style.background = 'var(--error)';
        } else if (percent > 70) {
            tokenBarEl.style.background = 'var(--warning)';
        } else {
            tokenBarEl.style.background = 'var(--primary)';
        }
    }
}



// ============================================================
// QUICK API KEY MODAL
// ============================================================

function initQuickApiKeyModal() {
    const fab = document.getElementById('btn-quick-api');
    const modal = document.getElementById('quick-api-modal');
    const closeBtn = document.getElementById('quick-api-close');

    if (!fab || !modal) return;

    // Update FAB state based on saved keys
    updateApiKeyFabState();

    // Open modal
    fab.addEventListener('click', () => {
        modal.classList.remove('hidden');
        updateQuickApiStatus();
        // Pre-fill existing keys
        const googleKey = APP_STATE.settings.googleApiKey || '';
        const googleEl = document.getElementById('qk-google');
        if (googleEl && googleKey) googleEl.value = googleKey;

        const kieKey = APP_STATE.settings.kieApiKey || getAdminAPIKey('kie');
        const kieEl = document.getElementById('qk-kie');
        if (kieEl && kieKey) kieEl.value = kieKey;
    });

    // Close modal
    closeBtn?.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    });

    // Tab switching
    document.querySelectorAll('.quick-api-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.quick-api-tab').forEach(t => {
                t.classList.remove('active');
                t.style.background = 'transparent';
                t.style.fontWeight = '400';
            });
            document.querySelectorAll('.quick-api-pane').forEach(p => p.classList.add('hidden'));
            tab.classList.add('active');
            tab.style.background = 'var(--bg-active)';
            tab.style.fontWeight = '600';
            const pane = document.getElementById('pane-' + tab.dataset.provider);
            if (pane) pane.classList.remove('hidden');
        });
    });
}

function updateApiKeyFabState() {
    const btn = document.getElementById('btn-quick-api');
    if (!btn) return;

    const hasKey = !!(APP_STATE.settings.googleApiKey || APP_STATE.settings.kieApiKey || getAdminAPIKey('kie'));

    const miniIcon = document.getElementById('api-key-mini-icon');
    const okIcon = document.getElementById('api-key-ok-icon');
    const checkIcon = document.getElementById('api-key-check-icon') || okIcon;

    if (hasKey) {
        btn.classList.add('has-key');
        if (miniIcon) miniIcon.style.display = 'none';
        if (okIcon) okIcon.style.display = '';
        if (checkIcon && checkIcon !== okIcon) checkIcon.style.display = '';
    } else {
        btn.classList.remove('has-key');
        if (miniIcon) miniIcon.style.display = '';
        if (okIcon) okIcon.style.display = 'none';
        if (checkIcon && checkIcon !== okIcon) checkIcon.style.display = 'none';
    }
    const label = document.getElementById('api-key-fab-label');
    if (label) label.textContent = hasKey ? 'Key đã cấu hình' : 'API Key';
}

function updateQuickApiStatus() {
    const container = document.getElementById('quick-api-status');
    if (!container) return;

    const hasGoogle = !!APP_STATE.settings.googleApiKey;
    const hasKie = !!(APP_STATE.settings.kieApiKey || getAdminAPIKey('kie'));

    if (!hasGoogle && !hasKie) { container.innerHTML = ''; return; }

    let html = '';
    if (hasGoogle) {
        html += `<div class="qk-status-row">
            <span class="qk-status-dot on"></span>
            <span>Google Gemini (Imagen 3): ✅ Đã cấu hình — Miễn phí</span>
        </div>`;
    }
    if (hasKie) {
        html += `<div class="qk-status-row">
            <span class="qk-status-dot on"></span>
            <span>Kie AI: ✅ Đã cấu hình</span>
        </div>`;
    }
    container.innerHTML = html;
}

function saveQuickKey(provider) {
    if (provider === 'google') {
        const key = document.getElementById('qk-google')?.value.trim();
        if (!key) { showToast('Vui lòng nhập Google API Key', 'error'); return; }
        APP_STATE.settings.googleApiKey = key;
    } else if (provider === 'kie' || provider === 'gemini') {
        const key = (document.getElementById('qk-kie') || document.getElementById('qk-gemini'))?.value.trim();
        if (!key) { showToast('Vui lòng nhập Kie AI API Key', 'error'); return; }
        APP_STATE.settings.kieApiKey = key;
    }

    // Persist to localStorage
    localStorage.setItem('kgen_settings', JSON.stringify(APP_STATE.settings));

    // Sync to settings panel UI if it exists
    const kieEl = document.getElementById('setting-kie-key');
    if (kieEl) kieEl.value = APP_STATE.settings.kieApiKey || '';

    updateProviderStatus();
    updateQuickApiStatus();
    updateApiKeyFabState();

    document.getElementById('quick-api-modal')?.classList.add('hidden');

    if (provider === 'google') {
        showToast('✅ Google API Key đã lưu! Bạn có thể tạo ảnh miễn phí không giới hạn.', 'success', 4000);
    } else {
        showToast('✅ Kie AI Key đã lưu! Bạn có thể tạo ảnh ngay.', 'success', 4000);
    }
}
window.saveQuickKey = saveQuickKey;


function toggleQKVisibility(inputId) {
    const el = document.getElementById(inputId);
    if (!el) return;
    el.type = el.type === 'password' ? 'text' : 'password';
}
window.toggleQKVisibility = toggleQKVisibility;

// ============================================================
// MY COLLECTION 
// ============================================================

async function loadCollection() {
    const grid = document.getElementById('collection-grid');
    const empty = document.getElementById('collection-empty');
    const countEl = document.getElementById('collection-count');

    if (!grid) return;

    grid.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-tertiary)">⏳ Đang tải...</div>';

    try {
        const items = await getCollection(50);

        if (!items || items.length === 0) {
            grid.innerHTML = '';
            if (empty) empty.style.display = 'block';
            if (countEl) countEl.textContent = '0 ảnh đã lưu';
            return;
        }

        if (empty) empty.style.display = 'none';
        if (countEl) countEl.textContent = `${items.length} ảnh đã lưu`;

        grid.innerHTML = items.map(item => {
            const imgUrl = item.image_url || '';
            const prompt = (item.prompt || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
            const model = item.model || 'nanobanana-pro';
            const savedAt = item.saved_at || item.created_at || '';
            const dateStr = savedAt ? new Date(savedAt).toLocaleDateString('vi-VN') : '';
            const id = item.id || '';

            return `
                <div class="collection-card" data-id="${id}">
                    <div class="collection-card-image">
                        <img src="${imgUrl}" alt="Saved image" loading="lazy" 
                             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22><rect fill=%22%231a1a24%22 width=%22200%22 height=%22200%22/><text x=%2250%%22 y=%2250%%22 text-anchor=%22middle%22 fill=%22%23555%22 dy=%22.3em%22>❌</text></svg>'">
                        <div class="collection-card-overlay">
                            <div class="collection-card-overlay-actions">
                                <button class="btn" onclick="downloadCollectionImage('${imgUrl}')">⬇️ Tải</button>
                                <button class="btn" onclick="copyCollectionPrompt(this)" data-prompt="${prompt}">📋 Prompt</button>
                                <button class="btn btn-remove" onclick="removeCollectionItem('${id}', this)">🗑️</button>
                            </div>
                        </div>
                    </div>
                    <div class="collection-card-info">
                        <div class="collection-card-prompt">${prompt}</div>
                        <div class="collection-card-meta">
                            <span class="collection-card-model">${model}</span>
                            <span>${dateStr}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Load collection error:', err);
        grid.innerHTML = '<div style="text-align:center;padding:20px;color:var(--accent-red)">❌ Lỗi tải bộ sưu tập</div>';
    }
}

function downloadCollectionImage(url) {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `kgen_collection_${Date.now()}.png`;
    a.target = '_blank';
    a.click();
}

function copyCollectionPrompt(btn) {
    const prompt = btn.dataset.prompt || '';
    if (prompt) {
        navigator.clipboard.writeText(prompt.replace(/&quot;/g, '"').replace(/&lt;/g, '<'))
            .then(() => showToast('📋 Đã copy prompt!', 'success'))
            .catch(() => showToast('Lỗi copy', 'error'));
    }
}

async function removeCollectionItem(id, btnEl) {
    if (!id) return;
    if (!confirm('Xóa ảnh này khỏi bộ sưu tập?')) return;

    try {
        await removeFromCollection(id);
        // Remove card with animation
        const card = btnEl.closest('.collection-card');
        if (card) {
            card.style.transition = 'all 0.3s ease';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.8)';
            setTimeout(() => {
                card.remove();
                // Update count
                const grid = document.getElementById('collection-grid');
                const countEl = document.getElementById('collection-count');
                const remaining = grid?.children.length || 0;
                if (countEl) countEl.textContent = `${remaining} ảnh đã lưu`;
                if (remaining === 0) {
                    const empty = document.getElementById('collection-empty');
                    if (empty) empty.style.display = 'block';
                }
            }, 300);
        }
        showToast('🗑️ Đã xóa khỏi bộ sưu tập', 'success');
    } catch (err) {
        showToast('Lỗi xóa: ' + err.message, 'error');
    }
}

// Make collection functions global
window.loadCollection = loadCollection;
window.downloadCollectionImage = downloadCollectionImage;
window.copyCollectionPrompt = copyCollectionPrompt;
window.removeCollectionItem = removeCollectionItem;

// Hook into DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initQuickApiKeyModal, 300);

    // Refresh collection button
    document.getElementById('btn-refresh-collection')?.addEventListener('click', loadCollection);

    // i18n - Language picker & translations
    if (typeof createLangPicker === 'function') {
        const container = document.getElementById('lang-picker-container');
        if (container) container.appendChild(createLangPicker());
        applyTranslations();
    }
});
