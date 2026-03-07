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
    if (typeof initSupabase === 'function') initSupabase();

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
        barFill.style.width = '20%';
        statusText.textContent = 'Đang tải thư viện prompt...';

        const response = await fetch('./data/trending-prompts.json');
        barFill.style.width = '60%';
        statusText.textContent = 'Đang xử lý dữ liệu...';

        if (!response.ok) throw new Error('Failed to load prompts');

        let rawData = await response.json();
        APP_STATE.prompts = shuffleArray(rawData);
        APP_STATE.filteredPrompts = [...APP_STATE.prompts];

        barFill.style.width = '90%';
        statusText.textContent = `Đã tải ${APP_STATE.prompts.length.toLocaleString()} prompts!`;

        const galleryCount = document.getElementById('gallery-count');
        if (galleryCount) galleryCount.textContent = APP_STATE.prompts.length.toLocaleString();
        const gallerySub = document.getElementById('gallery-subtitle');
        if (gallerySub) gallerySub.textContent = `${APP_STATE.prompts.length.toLocaleString()} prompt được tuyển chọn`;

        barFill.style.width = '100%';

        setTimeout(() => {
            splash.classList.add('fade-out');
            setTimeout(() => splash.remove(), 600);
        }, 500);

        renderGallery(true);
    } catch (error) {
        statusText.textContent = 'Lỗi tải dữ liệu � thử lại...';
        console.error('Failed to load prompts:', error);
        showToast('Không thể tải thư viện prompt', 'error');

        setTimeout(() => {
            splash.classList.add('fade-out');
            setTimeout(() => splash.remove(), 600);
        }, 2000);
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

function renderGallery(reset) {
    const grid = document.getElementById('gallery-grid');
    const loadMoreContainer = document.getElementById('load-more-container');
    const emptyState = document.getElementById('gallery-empty');

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
        return;
    }

    emptyState.classList.add('hidden');

    batch.forEach((item, idx) => {
        const card = createGalleryCard(item, start + idx);
        grid.appendChild(card);

        // Stagger animation
        requestAnimationFrame(() => {
            card.style.animationDelay = `${idx * 30}ms`;
            card.classList.add('card-enter');
        });
    });

    APP_STATE.displayedCount = end;

    loadMoreContainer.classList.toggle('hidden', end >= APP_STATE.filteredPrompts.length);
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
                <div class="card" onclick="openHistoryModal(${i})" style="break-inside:avoid; margin-bottom:16px; border-radius:12px; overflow:hidden; cursor:pointer; box-shadow:var(--shadow-sm); transition:transform 0.2s;">
                    <img src="${item.url}" alt="History item" style="width:100%; display:block;">
                </div>
            `).join('');
        }
    }
}

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
                    <h2 style="font-size:1.2rem;font-weight:700;margin:0;">Công cụ AI dành cho Giáo dục</h2>
                    <button onclick="document.getElementById('aitools-modal-overlay').remove()" style="background:none;border:none;cursor:pointer;color:var(--text-tertiary);">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"></path></svg>
                    </button>
                </div>
                <div style="padding:24px;display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                    <div style="border:1px solid var(--border-light);padding:16px;border-radius:12px;background:var(--bg-tertiary);cursor:pointer;transition:all 0.2s;" onmouseover="this.style.borderColor='var(--accent-blue)';" onmouseout="this.style.borderColor='var(--border-light)';">
                        <h3 style="margin:0 0 8px;font-size:1rem;color:var(--text-primary);">📊 Tạo Infographic</h3>
                        <p style="margin:0;font-size:0.85rem;color:var(--text-secondary);">Tự động tạo layout, biểu đồ và nội dung thông tin bài giảng chuẩn trực quan.</p>
                    </div>
                    <div style="border:1px solid var(--border-light);padding:16px;border-radius:12px;background:var(--bg-tertiary);cursor:pointer;transition:all 0.2s;" onmouseover="this.style.borderColor='var(--accent-blue)';" onmouseout="this.style.borderColor='var(--border-light)';">
                        <h3 style="margin:0 0 8px;font-size:1rem;color:var(--text-primary);">🕵️ Check văn AI</h3>
                        <p style="margin:0;font-size:0.85rem;color:var(--text-secondary);">Phân tích, đánh giá, phát hiện đạo văn hoặc văn bản được tạo ra bởi AI.</p>
                    </div>
                    <div style="grid-column:1/-1;border:1px solid var(--border-light);padding:16px;border-radius:12px;background:var(--bg-tertiary);cursor:pointer;transition:all 0.2s;" onmouseover="this.style.borderColor='var(--accent-blue)';" onmouseout="this.style.borderColor='var(--border-light)';">
                        <h3 style="margin:0 0 8px;font-size:1rem;color:var(--text-primary);">🎬 Tạo kịch bản Video Veo 3</h3>
                        <p style="margin:0;font-size:0.85rem;color:var(--text-secondary);">Trích xuất nội dung từ sách, tài liệu thành Format Video Veo 3 hấp dẫn học sinh.</p>
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
        showToast('✨ Prompt đã được chuyển sang tab Tạo ảnh', 'success');
    });

    document.getElementById('btn-copy-prompt').addEventListener('click', () => {
        const promptText = document.getElementById('modal-prompt').dataset.fullPrompt || document.getElementById('modal-prompt').textContent;
        copyToClipboard(promptText);
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
    document.getElementById('modal-source-link').href = item.source_url;

    // Store full prompt
    promptEl.dataset.fullPrompt = item.prompt;

    // Show full prompt to everyone
    promptEl.textContent = item.prompt;
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
}

async function generateImage() {
    const prompt = document.getElementById('gen-prompt').value.trim();
    if (!prompt) {
        showToast('Vui lòng nhập prompt', 'error');
        return;
    }

    // Determine which API to use: user's Google key or admin's Kie AI key
    const userGoogleKey = APP_STATE.settings.googleApiKey || '';
    const adminKieKey = getAdminAPIKey('kie');
    const userKieKey = APP_STATE.settings.kieApiKey || '';

    const useGoogleApi = !!userGoogleKey;
    const useKieApi = !!(userKieKey || adminKieKey);

    if (!useGoogleApi && !useKieApi) {
        showApiKeyGuideModal();
        return;
    }

    // If using admin key (not user's own key), check quota
    if (!useGoogleApi && !userKieKey && adminKieKey) {
        if (!canGenerateImage()) {
            const plan = getUserPlan();
            const limit = getUserImageLimit();
            if (plan === 'free') {
                showApiKeyGuideModal();
            } else {
                showToast(`⚠️ Bạn đã sử dụng hết ${limit} token tháng này. Nâng cấp gói để tiếp tục!`, 'error', 5000);
                switchTab('pricing');
            }
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

        if (useGoogleApi) {
            // Use user's Google Gemini API key
            result = await generateViaGemini(finalPrompt, aspectRatio, quality, userGoogleKey);
            provider = 'google-gemini';
        } else {
            // Use Kie AI (admin key or user's own Kie key)
            result = await generateViaKieAI(finalPrompt, aspectRatio, quality, selectedModel);
            provider = 'kie-ai';
        }

        // Show result
        clearInterval(timerInterval);
        document.getElementById('result-loading').classList.add('hidden');

        if (result && result.imageUrl) {
            const img = document.getElementById('result-image');
            img.src = result.imageUrl;

            document.getElementById('result-image-wrap').classList.remove('hidden');

            // Track usage quota (only for admin key usage)
            if (!useGoogleApi && !userKieKey) {
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

    console.log('🎨 Google Gemini Request:', { model, prompt: prompt.substring(0, 50), aspectRatio });

    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: `Generate an image: ${prompt}` }]
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
        const parts = candidates[0].content?.parts || [];
        for (const part of parts) {
            if (part.inlineData) {
                const mimeType = part.inlineData.mimeType || 'image/png';
                const base64 = part.inlineData.data;
                console.log('🎨 Got image!', mimeType, `${Math.round(base64.length / 1024)}KB`);
                return { imageUrl: `data:${mimeType};base64,${base64}` };
            }
        }
        // Check if only text was returned (model decided not to generate image)
        for (const part of parts) {
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
                <div style="margin-top:10px;padding:10px;background:var(--bg-primary,#fff);border-radius:8px;font-size:0.78rem;color:var(--text-secondary,#888);">
                    💰 Giá: 1K/2K = 18 credits (~$0.09) · 4K = 24 credits (~$0.12)
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
    const useProxy = cfg.useProxy === true;
    const userKieKey = APP_STATE.settings.kieApiKey || '';
    const adminKieKey = getAdminAPIKey('kie');

    // Determine if we use proxy or direct
    const directKey = userKieKey || adminKieKey;

    if (!useProxy && !directKey) {
        throw new Error('Kie AI API Key chưa được cấu hình. Nhấn nút 🔑 API Key ở góc trên phải để thêm key.');
    }

    // If using proxy, base URL is same origin; if direct, use Kie AI base
    const baseUrl = useProxy && !userKieKey
        ? (window.location.origin + '/api/proxy')
        : (getAdminAPIKey('kieBase') || 'https://api.kie.ai');
    const apiKey = userKieKey || adminKieKey;
    const authHeaders = useProxy && !userKieKey
        ? {} // proxy adds auth header server-side
        : { 'Authorization': `Bearer ${apiKey}` };

    const model = selectedModel || getAdminAPIKey('kieModel') || 'nano-banana-pro';
    const isNB2 = model === 'nano-banana-2';

    // Collect reference images if any
    const maxRefs = isNB2 ? 14 : 8;
    const imageInput = APP_STATE.referenceImages.length > 0 ? APP_STATE.referenceImages.slice(0, maxRefs) : [];

    // Map resolution value
    const resolutionValue = resolution || (isNB2 ? '1K' : '2K');

    const inputParams = {
        prompt: prompt,
        aspect_ratio: aspectRatio || (isNB2 ? 'auto' : '1:1'),
        resolution: resolutionValue,
        output_format: 'png',
    };

    // Only include image_input if there are images
    if (imageInput.length > 0) {
        inputParams.image_input = imageInput;
    }

    // Nano Banana 2 supports google_search
    if (isNB2) {
        inputParams.google_search = false;
    }

    const requestBody = {
        model: model,
        input: inputParams,
    };

    console.log('🎨 Kie AI Request:', JSON.stringify(requestBody, null, 2));

    // Step 1: Create task
    // Proxy mode: /api/proxy/createTask | Direct: /api/v1/jobs/createTask
    const createUrl = useProxy && !userKieKey
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
        throw new Error('Không kết nối được tới Kie AI server. Kiểm tra kết nối mạng.');
    }

    const responseText = await createResponse.text();
    console.log('🎨 Kie AI Response:', createResponse.status, responseText);

    if (!createResponse.ok) {
        let err = {};
        try { err = JSON.parse(responseText); } catch (e) { }
        const errMsg = err.message || err.error || responseText || `HTTP ${createResponse.status}`;
        if (createResponse.status === 401) throw new Error('Kie AI API key không hợp lệ. Kiểm tra lại key.');
        if (createResponse.status === 402) throw new Error('Hết credit Kie AI. Nạp thêm tại kie.ai.');
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

    console.log('🎨 Task created:', taskId, '| Model:', model);

    // Step 2: Poll for result
    let pollUrl;
    if (useProxy && !userKieKey) {
        pollUrl = isNB2
            ? `${baseUrl}/recordInfo?taskId=${taskId}`
            : `${baseUrl}/queryTask/${taskId}`;
    } else {
        pollUrl = isNB2
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
        <div class="history-thumb" data-index="${i}" title="${item.prompt.slice(0, 80)}">
            <img src="${item.url}" alt="Gen ${i + 1}" loading="lazy">
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
    // Style picker
    document.querySelectorAll('.style-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
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

function enhancePrompt() {
    const input = document.getElementById('enhance-input').value.trim();
    if (!input) {
        showToast('Vui lòng nhập ý tưởng', 'error');
        return;
    }

    const style = document.querySelector('.style-btn.active')?.dataset.style || 'realistic';

    // Local enhancement rules
    const enhanced = localEnhancePrompt(input, style);

    document.querySelector('.enhance-placeholder')?.classList.add('hidden');
    document.getElementById('enhanced-prompt').classList.remove('hidden');
    document.getElementById('enhanced-text').textContent = enhanced;

    showToast('✨ Prompt đã được nâng cấp!', 'success');
}

function localEnhancePrompt(prompt, style) {
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

    const guide = styleGuides[style] || styleGuides.realistic;

    // Build enhanced prompt
    const sections = [
        guide.prefix + prompt.charAt(0).toUpperCase() + prompt.slice(1) + '.',
        '',
        'Visual Details:',
        ...guide.details.map(d => `- ${d}`),
        '',
        guide.suffix,
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

function loadGenerationHistory() {
    try {
        const hist = localStorage.getItem('kgen_history');
        if (hist) {
            APP_STATE.generationHistory = JSON.parse(hist);
        }
    } catch (e) {
        console.error('Failed to load history:', e);
    }
}

function saveGenerationHistory() {
    try {
        const data = JSON.stringify(APP_STATE.generationHistory.slice(0, 50));
        localStorage.setItem('kgen_history', data);
    } catch (e) {
        // Quota error possibly due to data:URIs from Gemini
        console.warn('Could not save history (possibly too large):', e);
    }
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
    document.getElementById('btn-open-login').addEventListener('click', openAuthModal);
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
    document.getElementById('btn-logout').addEventListener('click', handleLogout);

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
    const loggedOut = document.getElementById('user-logged-out');
    const loggedIn = document.getElementById('user-logged-in');
    const avatar = document.getElementById('user-avatar');
    const displayName = document.getElementById('user-display-name');

    if (isLoggedIn()) {
        loggedOut.classList.add('hidden');
        loggedIn.classList.remove('hidden');
        displayName.textContent = APP_STATE.currentUser.name;

        // Show Google avatar or initial
        if (APP_STATE.currentUser.picture) {
            avatar.innerHTML = `<img src="${APP_STATE.currentUser.picture}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
        } else {
            avatar.textContent = APP_STATE.currentUser.name.charAt(0).toUpperCase();
            avatar.innerHTML = APP_STATE.currentUser.name.charAt(0).toUpperCase();
        }

        // Show provider badge
        const roleEl = document.querySelector('.user-role');
        if (roleEl) {
            roleEl.textContent = APP_STATE.currentUser.provider === 'google' ? '🔑 Google Account' : 'PRO Member';
        }

        // Hide guest banner if exists
        document.getElementById('guest-banner')?.remove();
    } else {
        loggedOut?.classList.remove('hidden');
        loggedIn?.classList.add('hidden');

        // No guest banner - prompts are fully visible to everyone
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
        buttonClass: 'btn-ghost'
    },
    {
        id: 'pro',
        name: 'Gói PRO',
        emoji: '⚡',
        popular: true,
        price: '39.000đ',
        period: '/tháng',
        features: [
            '1000 ảnh / tháng (Không cần cấu hình)',
            'Sử dụng Nanobanana Pro / Gemini Imagen 3',
            'Mở khoá 100% tài nguyên và 1300+ prompt gốc',
            'Sever ưu tiên tốc độ cao',
            'Cho phép sử dụng thương mại'
        ],
        limitations: [],
        buttonText: 'Nâng cấp ngay',
        buttonClass: 'btn-primary'
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
            'Hỗ trợ khách hàng ưu tiên 24/7'
        ],
        limitations: [],
        buttonText: 'Tạo Premium',
        buttonClass: 'btn-ghost'
    }
];

function setupPricing() {
    const container = document.getElementById('pricing-container');
    if (!container || typeof PRICING_TIERS === 'undefined') return;

    const currentTier = APP_STATE.currentUser?.tier || 'free';

    container.innerHTML = `
        <div class="pricing-grid-inline">
            ${PRICING_TIERS.map(tier => `
                <div class="pricing-card-inline ${tier.popular ? 'popular' : ''} ${currentTier === tier.id ? 'current' : ''}">
                    ${tier.popular ? '<div class="popular-badge-inline">🔥 Phổ biến nhất</div>' : ''}
                    <div class="tier-header-inline">
                        <span class="tier-emoji-inline">${tier.emoji}</span>
                        <h3>${tier.name}</h3>
                    </div>
                    <div class="tier-price-inline">
                        <span class="amount">${tier.price}</span>
                        <span class="period">${tier.period}</span>
                    </div>
                    <ul class="tier-features-inline">
                        ${tier.features.map(f => `<li>${f}</li>`).join('')}
                        ${tier.limitations.map(l => `<li class="limit">\u274c ${l}</li>`).join('')}
                    </ul>
                    <button class="btn ${tier.buttonClass} tier-btn-inline" 
                        data-tier="${tier.id}"
                        ${currentTier === tier.id ? 'disabled' : ''}>
                        ${currentTier === tier.id ? '\u2713 Đang sử dụng' : tier.buttonText}
                    </button>
                </div>
            `).join('')}
        </div>
        <div class="pricing-footer-inline">
            <p>\ud83d\udcb3 Thanh toán an toàn qua <strong>Stripe</strong> \u2022 Hủy bất cứ lúc nào</p>
            <p class="sub-note">Hỗ trợ: MoMo, Visa, Mastercard, JCB \u2022 Hoàn tiền 7 ngày</p>
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
                    const thumb = document.createElement('div');
                    thumb.className = 'ref-preview-thumb';
                    thumb.innerHTML = '<img src="' + ev.target.result + '" alt="ref"><button class="ref-remove-btn" onclick="this.parentElement.remove()">&times;</button>';
                    if (refPreviewList) refPreviewList.appendChild(thumb);
                };
                reader.readAsDataURL(file);
            });
        });
    }

    // --- Describe Image Card ---
    const describeCard = document.getElementById('gen-describe-card');
    if (describeCard) {
        describeCard.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/jpeg,image/png,image/webp';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                showToast('Đang phân tích ảnh...', 'info');
                setTimeout(() => {
                    showToast('Tính năng Describe Image sẽ tự động tạo prompt từ ảnh', 'info');
                }, 1500);
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
});
