/**
 * KGen Studio — AI Image Generation Hub
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
        kgenToken: '',
        openaiKey: '',
        openaiBase: 'https://api.openai.com',
        openaiModel: 'gpt-image-1.5',
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
    '3D': '🧊',
    'App': '📱',
    'Food': '🍔',
    'Girl': '👩',
    'JSON': '📋',
    'Other': '✨',
    'Photograph': '📸',
    'Product': '🛍️'
};

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    loadSettings();
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

        document.getElementById('gallery-count').textContent = APP_STATE.prompts.length.toLocaleString();
        document.getElementById('gallery-subtitle').textContent =
            `${APP_STATE.prompts.length.toLocaleString()} prompt được tuyển chọn từ cộng đồng sáng tạo`;

        barFill.style.width = '100%';

        setTimeout(() => {
            splash.classList.add('fade-out');
            setTimeout(() => splash.remove(), 600);
        }, 500);

        renderGallery(true);
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

    // Sidebar toggle for mobile
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });
}

function switchTab(tabName) {
    APP_STATE.currentTab = tabName;

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(tab => {
        const isActive = tab.id === `tab-${tabName}`;
        tab.classList.toggle('active', isActive);
        tab.classList.remove('hidden'); // Remove hidden so CSS active works
    });

    // Re-render pricing if switching to pricing tab
    if (tabName === 'pricing' && typeof setupPricing === 'function') {
        setupPricing();
    }

    // Close sidebar on mobile
    document.getElementById('sidebar').classList.remove('open');
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

    // Category chips
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            APP_STATE.currentCategory = chip.dataset.category;
            filterAndRender();
        });
    });

    // Sort
    document.getElementById('sort-select').addEventListener('change', (e) => {
        APP_STATE.currentSort = e.target.value;
        filterAndRender();
    });

    // Load more
    document.getElementById('btn-load-more').addEventListener('click', () => {
        renderGallery(false);
    });

    // Shuffle
    document.getElementById('btn-shuffle').addEventListener('click', () => {
        shuffleArray(APP_STATE.filteredPrompts);
        APP_STATE.displayedCount = 0;
        renderGallery(true);
        showToast('🎲 Đã xáo trộn thứ tự!', 'info');
    });

    // Reset filters
    document.getElementById('btn-reset-filters')?.addEventListener('click', () => {
        document.getElementById('search-input').value = '';
        APP_STATE.searchQuery = '';
        APP_STATE.currentCategory = 'all';
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        document.querySelector('.chip[data-category="all"]').classList.add('active');
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
    card.className = 'gallery-card';
    card.style.opacity = '0';
    card.style.animation = 'cardFadeIn 0.4s var(--ease-out) forwards';

    const catBadges = item.categories.map(c =>
        `<span class="card-cat">${CATEGORY_EMOJI[c] || '📌'} ${c}</span>`
    ).join('');

    // Show prompt preview (truncated for card)
    const promptPreview = item.prompt.length > 120
        ? item.prompt.slice(0, 120).replace(/\n/g, ' ') + '...'
        : item.prompt.replace(/\n/g, ' ');

    card.innerHTML = `
        <div class="gallery-card-image">
            <img src="${item.image}" alt="Prompt #${item.rank}" loading="lazy"
                 onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22400%22><rect fill=%22%231a1a24%22 width=%22400%22 height=%22400%22/><text fill=%22%2355556a%22 x=%22200%22 y=%22200%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22 font-size=%2216%22>Image unavailable</text></svg>'">

            <div class="gallery-card-overlay">
                <div class="overlay-stats">
                    <span>❤️ ${formatNumber(item.likes)}</span>
                    <span>👁️ ${formatNumber(item.views)}</span>
                </div>
            </div>
        </div>
        <div class="gallery-card-body">
            <span class="card-rank">#${item.rank} • ${item.model}</span>
            <p class="card-prompt">${escapeHtml(promptPreview)}</p>
            <div class="card-footer">
                <span class="card-author">by ${escapeHtml(item.author_name)}</span>
                <div class="card-cats">${catBadges}</div>
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
        showToast('✅ Prompt đã được chuyển sang tab Tạo Ảnh', 'success');
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
        `<span class="modal-cat">${CATEGORY_EMOJI[c] || '📌'} ${c}</span>`
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

    const provider = document.getElementById('gen-provider').value;
    const model = document.getElementById('gen-model').value.trim();
    const quality = document.getElementById('gen-quality').value;
    const aspectRatio = document.querySelector('.ar-btn.active')?.dataset.ratio || '1:1';
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
        // Determine endpoint based on provider
        let result;

        if (provider === 'comfyui' || (provider === 'auto' && APP_STATE.settings.comfyuiUrl)) {
            result = await generateViaComfyUI(prompt, negativePrompt);
        } else if (provider === 'openai' || (provider === 'auto' && APP_STATE.settings.openaiKey)) {
            result = await generateViaOpenAI(prompt, model, quality, aspectRatio, negativePrompt);
        } else if (provider === 'kgen' || (provider === 'auto' && APP_STATE.settings.kgenToken)) {
            result = await generateViaKGen(prompt, model, aspectRatio);
        } else {
            throw new Error('Chưa cấu hình provider nào. Vui lòng vào Cài đặt để thêm API key.');
        }

        // Show result
        clearInterval(timerInterval);
        document.getElementById('result-loading').classList.add('hidden');

        if (result && result.imageUrl) {
            const img = document.getElementById('result-image');
            img.src = result.imageUrl;

            document.getElementById('result-image-wrap').classList.remove('hidden');

            // Add to history
            APP_STATE.generationHistory.unshift({
                url: result.imageUrl,
                prompt,
                provider,
                timestamp: new Date().toISOString(),
            });
            renderHistory();

            showToast('🎨 Ảnh đã được tạo thành công!', 'success');
        } else {
            // Simulated result for demo
            showDemoResult(prompt);
        }
    } catch (error) {
        clearInterval(timerInterval);
        document.getElementById('result-loading').classList.add('hidden');
        document.getElementById('result-placeholder').classList.remove('hidden');

        // Show demo with gallery image as demo
        showDemoResult(prompt);

        console.error('Generation error:', error);
    }
}

function showDemoResult(prompt) {
    // Use a random prompt library image as demo
    const randomPrompt = APP_STATE.prompts[Math.floor(Math.random() * APP_STATE.prompts.length)];
    if (!randomPrompt) return;

    const img = document.getElementById('result-image');
    img.src = randomPrompt.image;

    document.getElementById('result-loading').classList.add('hidden');
    document.getElementById('result-image-wrap').classList.remove('hidden');

    APP_STATE.generationHistory.unshift({
        url: randomPrompt.image,
        prompt,
        provider: 'demo',
        timestamp: new Date().toISOString(),
    });
    renderHistory();

    showToast('🎨 Demo — Kết nối provider để tạo ảnh thật!', 'info');
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
    const apiKey = APP_STATE.settings.openaiKey;
    if (!apiKey) throw new Error('OpenAI API Key chưa được cấu hình');

    const baseUrl = APP_STATE.settings.openaiBase || 'https://api.openai.com';
    const sizeMap = { '1:1': '1024x1024', '3:4': '1024x1536', '4:3': '1536x1024', '16:9': '1536x1024', '9:16': '1024x1536' };

    const response = await fetch(`${baseUrl}/v1/images/generations`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: model || APP_STATE.settings.openaiModel || 'gpt-image-1.5',
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
    return { imageUrl: data.data?.[0]?.url };
}

async function generateViaKGen(prompt, model, aspectRatio) {
    const token = APP_STATE.settings.kgenToken;
    if (!token) throw new Error('KGen Token chưa được cấu hình');

    const response = await fetch('https://www.kgen.ai/api/generate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            prompt,
            modelId: model || 'nanobanana-2',
            aspectRatio: aspectRatio || '1:1',
            referenceImages: APP_STATE.referenceImages.length > 0 ? APP_STATE.referenceImages : undefined,
        }),
    });

    if (!response.ok) throw new Error(`KGen error: ${response.status}`);

    const data = await response.json();
    return { imageUrl: data.imageUrl };
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
        showToast('✅ Prompt nâng cấp đã sẵn sàng để tạo ảnh!', 'success');
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
            statusText.textContent = `GPU: ${data.devices?.[0]?.name || 'Unknown'} • VRAM: ${formatBytes(data.devices?.[0]?.vram_total || 0)}`;
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
                <p>Chưa có workflow nào</p>
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
    document.getElementById('btn-toggle-kgen-token').addEventListener('click', () => {
        const input = document.getElementById('setting-kgen-token');
        input.type = input.type === 'password' ? 'text' : 'password';
    });
}

function loadSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem('kgen_settings') || '{}');
        APP_STATE.settings = { ...APP_STATE.settings, ...saved };

        // Populate form
        document.getElementById('setting-kgen-token').value = APP_STATE.settings.kgenToken || '';
        document.getElementById('setting-openai-key').value = APP_STATE.settings.openaiKey || '';
        document.getElementById('setting-openai-base').value = APP_STATE.settings.openaiBase || 'https://api.openai.com';
        document.getElementById('setting-openai-model').value = APP_STATE.settings.openaiModel || 'gpt-image-1.5';
        document.getElementById('setting-comfyui-url').value = APP_STATE.settings.comfyuiUrl || 'http://localhost:8188';
        document.getElementById('setting-google-client-id').value = APP_STATE.settings.googleClientId || '';
        document.getElementById('setting-supabase-url').value = APP_STATE.settings.supabaseUrl || '';
        document.getElementById('setting-supabase-anon-key').value = APP_STATE.settings.supabaseAnonKey || '';
        document.getElementById('setting-stripe-key').value = APP_STATE.settings.stripePublishableKey || '';
        document.getElementById('setting-stripe-pro').value = APP_STATE.settings.stripePriceIdPro || '';
        document.getElementById('setting-stripe-premium').value = APP_STATE.settings.stripePriceIdPremium || '';

        updateProviderStatus();
    } catch (e) {
        console.error('Failed to load settings:', e);
    }
}

function saveSettings() {
    APP_STATE.settings = {
        kgenToken: document.getElementById('setting-kgen-token').value.trim(),
        openaiKey: document.getElementById('setting-openai-key').value.trim(),
        openaiBase: document.getElementById('setting-openai-base').value.trim(),
        openaiModel: document.getElementById('setting-openai-model').value.trim(),
        comfyuiUrl: document.getElementById('setting-comfyui-url').value.trim(),
        googleClientId: document.getElementById('setting-google-client-id').value.trim(),
        supabaseUrl: document.getElementById('setting-supabase-url').value.trim(),
        supabaseAnonKey: document.getElementById('setting-supabase-anon-key').value.trim(),
        stripePublishableKey: document.getElementById('setting-stripe-key').value.trim(),
        stripePriceIdPro: document.getElementById('setting-stripe-pro').value.trim(),
        stripePriceIdPremium: document.getElementById('setting-stripe-premium').value.trim(),
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

    showToast('💾 Cài đặt đã được lưu!', 'success');
}

function resetSettings() {
    localStorage.removeItem('kgen_settings');
    APP_STATE.settings = {
        kgenToken: '',
        openaiKey: '',
        openaiBase: 'https://api.openai.com',
        openaiModel: 'gpt-image-1.5',
        comfyuiUrl: 'http://localhost:8188',
        googleClientId: '',
        supabaseUrl: '',
        supabaseAnonKey: '',
        stripePublishableKey: '',
        stripePriceIdPro: '',
        stripePriceIdPremium: '',
    };

    document.getElementById('setting-kgen-token').value = '';
    document.getElementById('setting-openai-key').value = '';
    document.getElementById('setting-openai-base').value = 'https://api.openai.com';
    document.getElementById('setting-openai-model').value = 'gpt-image-1.5';
    document.getElementById('setting-comfyui-url').value = 'http://localhost:8188';
    document.getElementById('setting-google-client-id').value = '';
    document.getElementById('setting-supabase-url').value = '';
    document.getElementById('setting-supabase-anon-key').value = '';
    document.getElementById('setting-stripe-key').value = '';
    document.getElementById('setting-stripe-pro').value = '';
    document.getElementById('setting-stripe-premium').value = '';

    updateProviderStatus();
    showToast('🔄 Đã khôi phục cài đặt mặc định', 'info');
}

function updateProviderStatus() {
    const statusEl = document.getElementById('provider-status');
    const providers = [];

    if (APP_STATE.settings.kgenToken) providers.push('KGen');
    if (APP_STATE.settings.openaiKey) providers.push('OpenAI');
    if (APP_STATE.settings.comfyuiUrl) providers.push('ComfyUI');

    if (providers.length > 0) {
        statusEl.innerHTML = `
            <div class="status-dot"></div>
            <span>${providers.join(', ')}</span>
        `;
    } else {
        statusEl.innerHTML = `
            <div class="status-dot offline"></div>
            <span>Chưa kết nối</span>
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
        showToast('📋 Đã sao chép!', 'success');
    } catch {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('📋 Đã sao chép!', 'success');
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
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
        title.textContent = 'Đăng Nhập';
        subtitle.textContent = 'Đăng nhập để mở khóa toàn bộ thư viện 1,300+ prompts';
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
    document.getElementById('auth-title').textContent = 'Đăng Nhập';
    document.getElementById('auth-subtitle').textContent = 'Đăng nhập để mở khóa toàn bộ thư viện 1,300+ prompts';
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
        showToast('Vui lòng điền đầy đủ thông tin', 'error');
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

    showToast(`🎉 Chào mừng ${name}! Tài khoản đã được tạo thành công`, 'success');
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
            roleEl.textContent = APP_STATE.currentUser.provider === 'google' ? '🔵 Google Account' : 'PRO Member';
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
            <span class="banner-icon">🔐</span>
            <div>
                <h3>Bạn đang ở chế độ xem trước</h3>
                <p>Chỉ hiển thị <strong>10%</strong> nội dung prompt. Đăng nhập miễn phí để xem đầy đủ!</p>
            </div>
        </div>
        <button class="btn btn-primary btn-sm" id="btn-guest-login">🔓 Đăng nhập ngay</button>
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
    // Check settings first, then fallback to env
    return APP_STATE.settings.googleClientId || '';
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
        // No client ID configured — show helpful message
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

    // Use Google One Tap / Prompt
    try {
        google.accounts.id.prompt((notification) => {
            if (notification.isNotDisplayed()) {
                // Fallback: render a sign-in button in-place
                console.log('One Tap not displayed, reason:', notification.getNotDisplayedReason());
                showToast('Vui lòng cho phép popup từ Google', 'info');
            }
            if (notification.isSkippedMoment()) {
                console.log('One Tap skipped, reason:', notification.getSkippedReason());
            }
        });
    } catch (error) {
        console.error('Google Sign-In error:', error);
        showToast('Lỗi Google Sign-In. Vui lòng thử lại.', 'error');
    }
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

        showToast(`🎉 Chào mừng ${googleUser.name}! Đã đăng nhập bằng Google`, 'success');
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
            <p>Để sử dụng đăng nhập Google, bạn cần:</p>
            <ol>
                <li>Tạo project tại <a href="https://console.cloud.google.com" target="_blank" style="color:var(--accent-blue)">Google Cloud Console</a></li>
                <li>Bật Google Identity API</li>
                <li>Tạo OAuth 2.0 Client ID (Web application)</li>
                <li>Thêm <code>http://localhost:3456</code> vào Authorized JavaScript origins</li>
                <li>Dán Client ID vào <strong>Cài đặt → Google Client ID</strong></li>
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
