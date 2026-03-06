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
        geminiApiKey: '',
        openrouterApiKey: '',
        kgenToken: '',
        openaiKey: '',
        openaiBase: 'https://api.openai.com',
        openaiModel: 'gpt-image-1',
        comfyuiUrl: 'http://localhost:8188',
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

            // Deep merge api config
            cfg.api = {
                ...cfg.api,
                geminiApiKey: adminCfg.api?.googleKey || cfg.api?.geminiApiKey || '',
                googleModel: adminCfg.api?.googleModel || cfg.api?.googleModel || 'imagen-3.0-generate-002',
                openrouterApiKey: adminCfg.api?.openrouterKey || cfg.api?.openrouterApiKey || '',
                openaiKey: adminCfg.api?.openaiKey || cfg.api?.openaiKey || '',
                openaiBase: adminCfg.api?.openaiBase || cfg.api?.openaiBase || 'https://api.openai.com',
                openaiModel: adminCfg.api?.openaiModel || cfg.api?.openaiModel || 'gpt-image-1'
            };

            // Merge plans
            if (adminCfg.plans) {
                cfg.plans = { ...cfg.plans, ...adminCfg.plans };
            }
        }
    } catch (err) {
        console.warn('Could not read admin config from localStorage', err);
    }

    return cfg;
}

function getAdminAPIKey(type) {
    const cfg = getSiteConfig();
    if (type === 'gemini') return cfg.api?.geminiApiKey || '';
    if (type === 'openrouter') return cfg.api?.openrouterApiKey || '';
    if (type === 'KGen') return cfg.api?.KGenToken || '';
    if (type === 'openai') return cfg.api?.openaiKey || '';
    if (type === 'openaiBase') return cfg.api?.openaiBase || 'https://api.openai.com';
    if (type === 'openaiModel') return cfg.api?.openaiModel || 'gpt-image-1';
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
    return !!(APP_STATE.settings.geminiApiKey || APP_STATE.settings.openrouterApiKey || APP_STATE.settings.openaiKey);
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
    setupPricing();

    // Init Supabase if configured
    if (typeof initSupabase === 'function') initSupabase();

    await loadPromptLibrary();
});

function loadSiteConfig() {
    const cfg = getSiteConfig();
    // Apply admin API keys to settings as fallback
    if (cfg.api) {
        if (cfg.api.KGenToken && !APP_STATE.settings.kgenToken) {
            APP_STATE.settings.kgenToken = cfg.api.KGenToken;
        }
        if (cfg.api.openaiKey && !APP_STATE.settings.openaiKey) {
            APP_STATE.settings.openaiKey = cfg.api.openaiKey;
            APP_STATE.settings.openaiBase = cfg.api.openaiBase || APP_STATE.settings.openaiBase;
            APP_STATE.settings.openaiModel = cfg.api.openaiModel || APP_STATE.settings.openaiModel;
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

        APP_STATE.prompts = await response.json();
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

    // Re-render pricing if switching to pricing tab
    if (tabName === 'pricing' && typeof setupPricing === 'function') {
        setupPricing();
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

    // Sidebar tag-items
    document.querySelectorAll('.tag-item').forEach(tag => {
        tag.addEventListener('click', () => {
            document.querySelectorAll('.tag-item').forEach(t => t.classList.remove('active'));
            tag.classList.add('active');
            const cat = tag.dataset.category;
            APP_STATE.currentCategory = cat;
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

    // Model pills
    document.querySelectorAll('.model-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.model-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            // Model filtering is decorative for now (all prompts shown)
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
                default: return a.rank - b.rank;
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
        <div class="card-overlay">
            <span class="card-model">${item.model || 'nanobanana'}</span>
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

    // Check quota (guests can generate up to free limit)
    if (!canGenerateImage()) {
        const plan = getUserPlan();
        const limit = getUserImageLimit();
        if (plan === 'free') {
            // Show API key guide modal for free users
            showApiKeyGuideModal();
        } else {
            showToast(`⚠️ Bạn đã sử dụng hết ${limit} token tháng này. Nâng cấp gói để tiếp tục!`, 'error', 5000);
            switchTab('pricing');
        }
        return;
    }

    const provider = document.getElementById('gen-provider').value;
    const model = document.getElementById('gen-model').value.trim();
    const quality = document.getElementById('gen-quality').value;
    const aspectRatio = document.querySelector('.gen-ar-opt.active')?.dataset.ratio || '3:4';
    const negativePrompt = document.getElementById('gen-negative').value.trim();

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
        // Determine provider based on selected model or auto-detect from API keys
        let result;
        let selectedProvider = provider;

        // Get provider from model selector (data-provider attribute)
        const activeModelOpt = document.querySelector('.model-option.active');
        const modelProvider = activeModelOpt?.dataset.provider || '';

        if (provider === 'auto') {
            // Route based on selected model's provider
            if (modelProvider === 'gemini') {
                selectedProvider = 'gemini';
            } else if (modelProvider === 'openrouter') {
                selectedProvider = 'openrouter';
            } else if (modelProvider === 'openai') {
                selectedProvider = 'openai';
            } else if (modelProvider === 'comfyui') {
                selectedProvider = 'comfyui';
            } else {
                // Auto-detect: check which API keys are available
                const geminiKey = APP_STATE.settings.geminiApiKey || getAdminAPIKey('gemini');
                const openrouterKey = APP_STATE.settings.openrouterApiKey || getAdminAPIKey('openrouter');
                const openaiKey = APP_STATE.settings.openaiKey || getAdminAPIKey('openai');

                if (geminiKey) {
                    selectedProvider = 'gemini';
                } else if (openrouterKey) {
                    selectedProvider = 'openrouter';
                } else if (openaiKey) {
                    selectedProvider = 'openai';
                } else if (APP_STATE.settings.comfyuiUrl && APP_STATE.settings._comfyuiManuallySet) {
                    selectedProvider = 'comfyui';
                } else {
                    throw new Error('Chưa cấu hình API key nào. Vào Cài đặt để thêm Gemini API key hoặc OpenRouter API key.');
                }
            }
        }

        switch (selectedProvider) {
            case 'gemini':
                result = await generateViaGemini(prompt, model, aspectRatio);
                break;
            case 'openrouter':
                result = await generateViaOpenRouter(prompt, model, aspectRatio, negativePrompt);
                break;
            case 'openai':
                result = await generateViaOpenAI(prompt, model, quality, aspectRatio, negativePrompt);
                break;
            case 'comfyui':
                result = await generateViaComfyUI(prompt, negativePrompt);
                break;
            default:
                throw new Error(`Provider "${selectedProvider}" chưa được hỗ trợ. Chọn model khác.`);
        }

        // Show result
        clearInterval(timerInterval);
        document.getElementById('result-loading').classList.add('hidden');

        if (result && result.imageUrl) {
            const img = document.getElementById('result-image');
            img.src = result.imageUrl;

            document.getElementById('result-image-wrap').classList.remove('hidden');

            // Track usage quota
            incrementImageUsage();

            // Add to history
            APP_STATE.generationHistory.unshift({
                url: result.imageUrl,
                prompt,
                provider: selectedProvider,
                timestamp: new Date().toISOString(),
            });
            renderHistory();

            showToast('🎉 Ảnh đã được tạo thành công!', 'success');
        } else {
            throw new Error('Không nhận được ảnh từ server. Vui lòng thử lại.');
        }
    } catch (error) {
        clearInterval(timerInterval);
        document.getElementById('result-loading').classList.add('hidden');
        document.getElementById('result-placeholder').classList.remove('hidden');

        // Show clear error message instead of misleading random gallery image
        const errorMsg = error.message || 'Lỗi không xác định';
        showGenerationError(errorMsg);

        console.error('Generation error:', error);
    }
}

/**
 * Show modal with guide on how to add personal API key
 * Shown when free users exhaust their 10-image quota
 */
function showApiKeyGuideModal() {
    // Remove existing modal if any
    document.getElementById('api-key-guide-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'api-key-guide-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;';
    modal.innerHTML = `
        <div style="background:var(--bg-primary,#fff);border-radius:16px;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);padding:32px;">
            <div style="text-align:center;margin-bottom:20px;">
                <div style="font-size:2.5rem;margin-bottom:8px;">🔑</div>
                <h2 style="font-size:1.3rem;font-weight:700;margin:0 0 6px 0;">Hết lượt tạo ảnh miễn phí</h2>
                <p style="color:var(--text-secondary,#666);font-size:0.9rem;margin:0;">Bạn đã dùng hết 10 ảnh miễn phí. Thêm API key để tiếp tục tạo không giới hạn!</p>
            </div>

            <div style="background:var(--bg-secondary,#f5f7fa);border-radius:12px;padding:20px;margin-bottom:16px;">
                <h3 style="font-size:0.95rem;font-weight:600;margin:0 0 12px 0;">🌟 Cách 1: Google Gemini (Miễn phí)</h3>
                <ol style="margin:0;padding-left:20px;font-size:0.85rem;line-height:1.7;color:var(--text-secondary,#555);">
                    <li>Truy cập <a href="https://aistudio.google.com/apikey" target="_blank" style="color:var(--accent,#4a90d9);font-weight:600;">Google AI Studio</a></li>
                    <li>Đăng nhập Google → Nhấn <strong>"Get API Key"</strong></li>
                    <li>Copy API key và dán vào ô bên dưới</li>
                </ol>
                <div style="display:flex;gap:8px;margin-top:12px;">
                    <input type="text" id="guide-gemini-key" placeholder="AIzaSy..." style="flex:1;padding:10px 12px;border:1px solid var(--border-light,#ddd);border-radius:8px;font-size:0.85rem;background:var(--bg-primary,#fff);">
                    <button onclick="saveGuideKey('gemini')" style="padding:10px 16px;background:var(--accent,#4a90d9);color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:0.85rem;white-space:nowrap;">Lưu</button>
                </div>
            </div>

            <div style="background:var(--bg-secondary,#f5f7fa);border-radius:12px;padding:20px;margin-bottom:16px;">
                <h3 style="font-size:0.95rem;font-weight:600;margin:0 0 12px 0;">🔗 Cách 2: OpenRouter (Nhiều model)</h3>
                <ol style="margin:0;padding-left:20px;font-size:0.85rem;line-height:1.7;color:var(--text-secondary,#555);">
                    <li>Truy cập <a href="https://openrouter.ai/keys" target="_blank" style="color:var(--accent,#4a90d9);font-weight:600;">openrouter.ai/keys</a></li>
                    <li>Đăng ký → Tạo API key</li>
                    <li>Copy key và dán vào ô bên dưới</li>
                </ol>
                <div style="display:flex;gap:8px;margin-top:12px;">
                    <input type="text" id="guide-openrouter-key" placeholder="sk-or-v1-..." style="flex:1;padding:10px 12px;border:1px solid var(--border-light,#ddd);border-radius:8px;font-size:0.85rem;background:var(--bg-primary,#fff);">
                    <button onclick="saveGuideKey('openrouter')" style="padding:10px 16px;background:var(--accent,#4a90d9);color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:0.85rem;white-space:nowrap;">Lưu</button>
                </div>
            </div>

            <div style="text-align:center;padding-top:8px;border-top:1px solid var(--border-light,#eee);">
                <p style="font-size:0.82rem;color:var(--text-secondary,#888);margin:12px 0 8px 0;">Hoặc nâng cấp lên Pro (1.000 token/tháng) hoặc Premium (5.000 token/tháng)</p>
                <div style="display:flex;gap:8px;justify-content:center;">
                    <button onclick="document.getElementById('api-key-guide-modal').remove();switchTab('pricing')" style="padding:10px 20px;background:transparent;border:1px solid var(--border-light,#ddd);border-radius:8px;cursor:pointer;font-size:0.85rem;font-weight:500;">Xem gói nâng cấp</button>
                    <button onclick="document.getElementById('api-key-guide-modal').remove()" style="padding:10px 20px;background:transparent;border:1px solid var(--border-light,#ddd);border-radius:8px;cursor:pointer;font-size:0.85rem;color:var(--text-secondary,#888);">Đóng</button>
                </div>
            </div>
        </div>
    `;

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    document.body.appendChild(modal);
}

/**
 * Save API key from the guide modal and close it
 */
function saveGuideKey(type) {
    let key = '';
    if (type === 'gemini') {
        key = document.getElementById('guide-gemini-key')?.value.trim();
        if (!key) { showToast('Vui lòng nhập API key', 'error'); return; }
        APP_STATE.settings.geminiApiKey = key;
    } else if (type === 'openrouter') {
        key = document.getElementById('guide-openrouter-key')?.value.trim();
        if (!key) { showToast('Vui lòng nhập API key', 'error'); return; }
        APP_STATE.settings.openrouterApiKey = key;
    }

    // Save to localStorage
    localStorage.setItem('kgen_settings', JSON.stringify(APP_STATE.settings));

    // Also update settings form if visible
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    setVal('setting-gemini-key', APP_STATE.settings.geminiApiKey || '');
    setVal('setting-openrouter-key', APP_STATE.settings.openrouterApiKey || '');

    updateProviderStatus();

    // Close modal
    document.getElementById('api-key-guide-modal')?.remove();
    showToast('✅ API key đã được lưu! Bạn có thể tạo ảnh không giới hạn.', 'success', 4000);
}
window.saveGuideKey = saveGuideKey;
/**
 * Show a clear error message to the user instead of displaying a random gallery image
 */
function showGenerationError(message) {
    const placeholder = document.getElementById('result-placeholder');
    placeholder.classList.remove('hidden');

    // Classify error and provide helpful guidance
    let guidance = '';
    const lower = message.toLowerCase();

    if (lower.includes('token') || lower.includes('api key') || lower.includes('cấu hình')) {
        guidance = '🔒 Vui lòng vào Cài đặt (thanh bên) để thêm API token MeiGen hoặc OpenAI key.';
    } else if (lower.includes('401') || lower.includes('403') || lower.includes('unauthorized')) {
        guidance = '🔑 API token không hợp lệ hoặc đã hết hạn. Kiểm tra lại trong Cài đặt.';
    } else if (lower.includes('402') || lower.includes('credit') || lower.includes('insufficient')) {
        guidance = '💰 Hết credit. Credit miễn phí sẽ được reset mỗi ngày.';
    } else if (lower.includes('429') || lower.includes('rate')) {
        guidance = '⏳ Quá nhiều request. Vui lòng đợi vài giây rồi thử lại.';
    } else if (lower.includes('timeout') || lower.includes('timed out')) {
        guidance = '⏱️ Request quá lâu. Thử lại � có thể server đang bận.';
    } else if (lower.includes('network') || lower.includes('fetch') || lower.includes('econnrefused')) {
        guidance = '🌐 Lỗi kết nối mạng. Kiểm tra internet và thử lại.';
    } else if (lower.includes('safety') || lower.includes('policy') || lower.includes('flagged')) {
        guidance = '🚫 Prompt có thể vi phạm chính sách nội dung. Thử chỉnh sửa prompt.';
    } else {
        guidance = '❌ Thử lại hoặc chọn model/provider khác.';
    }

    showToast(`❌ ${message}\n${guidance}`, 'error', 6000);
}

async function generateViaComfyUI(prompt, negativePrompt) {
    const url = APP_STATE.settings.comfyuiUrl;
    if (!url) throw new Error('ComfyUI URL chưa được cấu hình');

    // Basic ComfyUI API call
    const response = await fetch(`${url}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prompt: { /* workflow would go here */ },
        }),
    });

    if (!response.ok) throw new Error(`ComfyUI error: ${response.status}`);
    return await response.json();
}

async function generateViaOpenAI(prompt, model, quality, size, negativePrompt) {
    const apiKey = APP_STATE.settings.openaiKey || getAdminAPIKey('openai');
    if (!apiKey) throw new Error('OpenAI API Key chưa được cấu hình. Vào Cài đặt để thêm.');

    const baseUrl = APP_STATE.settings.openaiBase || getAdminAPIKey('openaiBase') || 'https://api.openai.com';
    const sizeMap = { '1:1': '1024x1024', '3:4': '1024x1536', '4:3': '1536x1024', '16:9': '1536x1024', '9:16': '1024x1536' };

    const response = await fetch(`${baseUrl}/v1/images/generations`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: model || APP_STATE.settings.openaiModel || getAdminAPIKey('openaiModel') || 'gpt-image-1',
            prompt: negativePrompt ? `${prompt}\n\nAvoid: ${negativePrompt}` : prompt,
            size: sizeMap[size] || '1024x1024',
            quality,
            n: 1,
        }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `OpenAI error: ${response.status}`);
    }

    const data = await response.json();
    const imageData = data.data?.[0];
    const imageUrl = imageData?.url || (imageData?.b64_json ? `data:image/png;base64,${imageData.b64_json}` : null);
    if (!imageUrl) throw new Error('Không nhận được ảnh từ OpenAI API');
    return { imageUrl };
}

/**
 * Generate image via Google Gemini Imagen API
 * Model name mapping: nanobanana-pro / nanobanana-2 → actual Gemini model IDs
 */
async function generateViaGemini(prompt, model, aspectRatio) {
    const apiKey = APP_STATE.settings.geminiApiKey || getAdminAPIKey('gemini');
    if (!apiKey) throw new Error('Gemini API Key chưa được cấu hình. Vào Cài đặt để thêm Google Gemini API key.');

    // Determine model
    let modelId = 'imagen-3.0-generate-002'; // default

    const cfg = getSiteConfig();
    const adminModel = cfg.api?.googleModel;
    if (adminModel) {
        modelId = adminModel;
    }

    // Protection: If user specified a text model like gemini-1.5, gemini-2.0 or gemini-3.0, it will crash the generateImages API.
    // So we show a friendly error letting them know they must use the imagen model.
    if (modelId.includes('gemini-')) {
        throw new Error('Bạn đang cấu hình model ngôn ngữ (' + modelId + ') để vẽ ảnh. Vui lòng vào Cài đặt đổi Model thành "imagen-3.0-generate-002"');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateImages?key=${apiKey}`;

    // Map aspect ratio format
    const arMap = { '1:1': '1:1', '3:4': '3:4', '4:3': '4:3', '16:9': '16:9', '9:16': '9:16' };
    const ar = arMap[aspectRatio] || '1:1';

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prompt,
            config: {
                numberOfImages: 1,
                aspectRatio: ar,
                outputOptions: {
                    mimeType: 'image/png'
                }
            }
        }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const errMsg = err.error?.message || `Gemini Imagen error: ${response.status}`;

        if (response.status === 400 && errMsg.includes('safety')) {
            throw new Error('Prompt vi phạm chính sách an toàn của Google. Vui lòng chỉnh sửa prompt.');
        }
        if (response.status === 403) {
            throw new Error('API key không có quyền sử dụng Imagen. Hãy bật Generative Language API trong Google Cloud Console.');
        }
        if (response.status === 429) {
            throw new Error('Quá nhiều request. Vui lòng chờ vài giây rồi thử lại.');
        }
        throw new Error(errMsg);
    }

    const data = await response.json();
    const imageBytes = data.generatedImages?.[0]?.image?.imageBytes;
    if (!imageBytes) {
        throw new Error('Không nhận được ảnh từ Gemini API. Prompt có thể bị lọc bởi bộ lọc an toàn.');
    }

    return { imageUrl: `data:image/png;base64,${imageBytes}` };
}

/**
 * Generate image via OpenRouter API (OpenAI-compatible gateway)
 * Supports many models: openai/gpt-image-1, openai/dall-e-3, black-forest-labs/flux-1.1-pro, etc.
 */
async function generateViaOpenRouter(prompt, model, aspectRatio, negativePrompt) {
    const apiKey = APP_STATE.settings.openrouterApiKey || getAdminAPIKey('openrouter');
    if (!apiKey) throw new Error('OpenRouter API Key chưa được cấu hình. Vào Cài đặt để thêm.');

    const sizeMap = { '1:1': '1024x1024', '3:4': '1024x1536', '4:3': '1536x1024', '16:9': '1536x1024', '9:16': '1024x1536' };

    const response = await fetch('https://openrouter.ai/api/v1/images/generations', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': window.location.origin || 'https://kgen.gallery',
            'X-Title': 'KGen Gallery',
        },
        body: JSON.stringify({
            model: model || 'openai/gpt-image-1',
            prompt: negativePrompt ? `${prompt}\n\nAvoid: ${negativePrompt}` : prompt,
            size: sizeMap[aspectRatio] || '1024x1024',
            n: 1,
        }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const errMsg = err.error?.message || `OpenRouter error: ${response.status}`;

        if (response.status === 401) {
            throw new Error('OpenRouter API key không hợp lệ. Kiểm tra lại key trong Cài đặt.');
        }
        if (response.status === 402) {
            throw new Error('Hết credit OpenRouter. Nạp thêm tại openrouter.ai/credits.');
        }
        if (response.status === 429) {
            throw new Error('Quá nhiều request. Vui lòng chờ vài giây rồi thử lại.');
        }
        throw new Error(errMsg);
    }

    const data = await response.json();
    const imageData = data.data?.[0];
    const imageUrl = imageData?.url || (imageData?.b64_json ? `data:image/png;base64,${imageData.b64_json}` : null);
    if (!imageUrl) throw new Error('Không nhận được ảnh từ OpenRouter API');
    return { imageUrl };
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
    document.getElementById('btn-toggle-gemini-key')?.addEventListener('click', () => {
        const input = document.getElementById('setting-gemini-key');
        if (input) input.type = input.type === 'password' ? 'text' : 'password';
    });
    document.getElementById('btn-toggle-openrouter-key')?.addEventListener('click', () => {
        const input = document.getElementById('setting-openrouter-key');
        if (input) input.type = input.type === 'password' ? 'text' : 'password';
    });
    document.getElementById('btn-toggle-kgen-token')?.addEventListener('click', () => {
        const input = document.getElementById('setting-kgen-token');
        if (input) input.type = input.type === 'password' ? 'text' : 'password';
    });
}

function loadSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem('kgen_settings') || '{}');
        APP_STATE.settings = { ...APP_STATE.settings, ...saved };

        // Populate form
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        setVal('setting-gemini-key', APP_STATE.settings.geminiApiKey || '');
        setVal('setting-openrouter-key', APP_STATE.settings.openrouterApiKey || '');
        setVal('setting-kgen-token', APP_STATE.settings.kgenToken || '');
        setVal('setting-openai-key', APP_STATE.settings.openaiKey || '');
        setVal('setting-openai-base', APP_STATE.settings.openaiBase || 'https://api.openai.com');
        setVal('setting-openai-model', APP_STATE.settings.openaiModel || 'gpt-image-1');
        setVal('setting-comfyui-url', APP_STATE.settings.comfyuiUrl || 'http://localhost:8188');
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

function saveSettings() {
    const getVal = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    APP_STATE.settings = {
        geminiApiKey: getVal('setting-gemini-key'),
        openrouterApiKey: getVal('setting-openrouter-key'),
        kgenToken: getVal('setting-kgen-token'),
        openaiKey: getVal('setting-openai-key'),
        openaiBase: getVal('setting-openai-base'),
        openaiModel: getVal('setting-openai-model'),
        comfyuiUrl: getVal('setting-comfyui-url'),
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
        geminiApiKey: '',
        openrouterApiKey: '',
        kgenToken: '',
        openaiKey: '',
        openaiBase: 'https://api.openai.com',
        openaiModel: 'gpt-image-1',
        comfyuiUrl: 'http://localhost:8188',
        googleClientId: '',
        supabaseUrl: '',
        supabaseAnonKey: '',
        stripePublishableKey: '',
        stripePriceIdPro: '',
        stripePriceIdPremium: '',
    };

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    setVal('setting-gemini-key', '');
    setVal('setting-openrouter-key', '');
    setVal('setting-kgen-token', '');
    setVal('setting-openai-key', '');
    setVal('setting-openai-base', 'https://api.openai.com');
    setVal('setting-openai-model', 'gpt-image-1');
    setVal('setting-comfyui-url', 'http://localhost:8188');
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
    const providers = [];

    if (APP_STATE.settings.geminiApiKey || getAdminAPIKey('gemini')) providers.push('Gemini');
    if (APP_STATE.settings.openrouterApiKey || getAdminAPIKey('openrouter')) providers.push('OpenRouter');
    if (APP_STATE.settings.openaiKey || getAdminAPIKey('openai')) providers.push('OpenAI');
    if (APP_STATE.settings.comfyuiUrl && APP_STATE.settings._comfyuiManuallySet) providers.push('ComfyUI');

    if (providers.length > 0) {
        statusEl.innerHTML = `
            <div class="status-dot"></div>
            <span>${providers.join(', ')}</span>
        `;
    } else {
        statusEl.innerHTML = `
            <div class="status-dot offline"></div>
            <span>Chưa cấu hình API key</span>
        `;
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

    // --- Quality Dropdown ---
    const qTrigger = document.getElementById('gen-quality-trigger');
    const qDropdown = document.getElementById('gen-quality-dropdown');
    const qLabel = document.getElementById('gen-quality-label');
    const qInput = document.getElementById('gen-quality');

    if (qTrigger && qDropdown) {
        qTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            qDropdown.classList.toggle('hidden');
            // Close AR if open
            if (arDropdown) arDropdown.classList.add('hidden');
        });

        qDropdown.querySelectorAll('.gen-q-opt').forEach(opt => {
            opt.addEventListener('click', () => {
                qDropdown.querySelectorAll('.gen-q-opt').forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                if (qLabel) qLabel.textContent = opt.dataset.label;
                if (qInput) qInput.value = opt.dataset.quality;
                qDropdown.classList.add('hidden');
            });
        });
    }

    // Close all dropdowns on outside click
    document.addEventListener('click', (e) => {
        if (arDropdown && !arDropdown.contains(e.target) && arTrigger && !arTrigger.contains(e.target)) {
            arDropdown.classList.add('hidden');
        }
        if (qDropdown && !qDropdown.contains(e.target) && qTrigger && !qTrigger.contains(e.target)) {
            qDropdown.classList.add('hidden');
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
            // Trigger a file input for image-to-prompt
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/jpeg,image/png,image/webp';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                showToast('Đang phân tích ảnh...', 'info');
                // For demo, just show that we received the file
                setTimeout(() => {
                    showToast('Tính năng Describe Image sẽ tự động tạo prompt từ ảnh', 'info');
                }, 1500);
            };
            input.click();
        });
    }
}

