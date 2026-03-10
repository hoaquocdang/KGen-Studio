#!/usr/bin/env node
/**
 * KGen Gallery — Multi-Platform Prompt Crawler
 * 
 * Crawls trending AI image generation prompts from:
 *   - X/Twitter
 *   - Threads (Meta)
 *   - Instagram
 * 
 * Uses Apify scrapers, processes results, and merges
 * into the gallery's trending-prompts.json
 * 
 * Usage:
 *   node crawl.js                  # Full crawl + merge
 *   node crawl.js --dry-run        # Preview without saving
 *   node crawl.js --since 7        # Crawl last 7 days (default: 3)
 *   node crawl.js --platform x     # Only crawl X/Twitter
 *   node crawl.js --platform threads  # Only crawl Threads
 *   node crawl.js --platform ig    # Only crawl Instagram
 * 
 * Environment variables:
 *   APIFY_TOKEN          - Apify API token (required)
 *   GEMINI_API_KEY       - Google Gemini API key (for auto-categorization)
 *   PROMPTS_JSON_PATH    - Path to trending-prompts.json
 *   IMAGE_BASE_URL       - Base URL for hosted images
 *   IMAGE_DOWNLOAD_DIR   - Local dir to save downloaded images
 */

import { ApifyClient } from 'apify-client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================
// CONFIGURATION
// ============================================================
const CONFIG = {
    apifyToken: process.env.APIFY_TOKEN || '',
    geminiApiKey: process.env.GEMINI_API_KEY || '',

    promptsJsonPath: process.env.PROMPTS_JSON_PATH ||
        path.resolve(__dirname, '../../web-ui/data/trending-prompts.json'),

    imageBaseUrl: process.env.IMAGE_BASE_URL || 'https://images.meigen.ai/tweets',
    imageDownloadDir: process.env.IMAGE_DOWNLOAD_DIR || '/opt/kgen-gallery/web-ui/data/images',

    // Days to look back
    sinceDays: 3,
    minLikes: 50,
    minViews: 10000,

    // ---- Apify Actor IDs ----
    actors: {
        twitter: 'apidojo/twitter-scraper-v2',
        threads: 'apidojo/threads-scraper',
        instagram: 'apify/instagram-scraper',
    },

    // ---- X/Twitter Config ----
    twitter: {
        searchQueries: [
            '#NanoBanana prompt',
            '#NanoBanana2 prompt',
            '#GPTImage prompt',
            '#imagen3 prompt',
            '#FluxKontext prompt',
            '#Midjourney prompt',
            'nanobanana prompt min_faves:50',
            'gemini image generation prompt min_faves:100',
            '4o image generation prompt min_faves:100',
        ],
        trackedAccounts: [
            'xmliisu', 'NanoBanana', 'AmirMushich', 'TechieBySA',
            'oggii_0', 'Taaruk_', 'azed_ai', 'Arminn_Ai',
            'KeorUnreal', 'bananababydoll', 'mehvishs25',
        ],
        maxTweetsPerQuery: 50,
    },

    // ---- Threads Config ----
    threads: {
        searchQueries: [
            'AI image prompt',
            'nanobanana prompt',
            'midjourney prompt',
            'flux image generation',
            'GPT image prompt',
        ],
        trackedAccounts: [
            // Add Threads accounts that share AI prompts
        ],
        maxPostsPerQuery: 30,
    },

    // ---- Instagram Config ----
    instagram: {
        hashtags: [
            'aiart',
            'aigenerated',
            'midjourney',
            'nanobanana',
            'aiartcommunity',
            'promptsharing',
            'imagen3',
            'gptimage',
        ],
        trackedAccounts: [
            // Add Instagram accounts that share AI prompts
        ],
        maxPostsPerHashtag: 30,
    },

    // Categories for classification
    categories: ['JSON', 'Photograph', 'Girl', 'Boy', 'Product', 'Food', '3D', 'Anime', 'Logo', 'App', 'Other'],
};

// ============================================================
// CLI ARGS
// ============================================================
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const sinceIdx = args.indexOf('--since');
if (sinceIdx !== -1 && args[sinceIdx + 1]) {
    CONFIG.sinceDays = parseInt(args[sinceIdx + 1]);
}
const platformIdx = args.indexOf('--platform');
const PLATFORM_FILTER = platformIdx !== -1 ? args[platformIdx + 1] : 'all';

// ============================================================
// LOGGING
// ============================================================
const log = {
    info: (...a) => console.log(`[${ts()}] ℹ️`, ...a),
    success: (...a) => console.log(`[${ts()}] ✅`, ...a),
    warn: (...a) => console.warn(`[${ts()}] ⚠️`, ...a),
    error: (...a) => console.error(`[${ts()}] ❌`, ...a),
    section: (title) => console.log(`\n${'═'.repeat(50)}\n  ${title}\n${'═'.repeat(50)}`),
};
function ts() { return new Date().toISOString().replace('T', ' ').substring(0, 19); }

// ============================================================
// PLATFORM: X/TWITTER
// ============================================================
async function crawlTwitter(client) {
    log.section('🐦 X/Twitter');
    const results = [];
    const sinceStr = getSinceDate();

    // Search queries
    for (const query of CONFIG.twitter.searchQueries) {
        log.info(`Search: "${query}"`);
        try {
            const run = await client.actor(CONFIG.actors.twitter).call({
                searchTerms: [query],
                searchMode: 'live',
                maxTweets: CONFIG.twitter.maxTweetsPerQuery,
                since: sinceStr,
                addUserInfo: true,
            });
            const { items } = await client.dataset(run.defaultDatasetId).listItems();
            log.info(`  → ${items.length} tweets`);
            results.push(...items.map(t => ({ ...t, _platform: 'twitter' })));
        } catch (err) {
            log.warn(`  Failed: ${err.message}`);
        }
    }

    // Tracked accounts
    for (const account of CONFIG.twitter.trackedAccounts) {
        log.info(`Account: @${account}`);
        try {
            const run = await client.actor(CONFIG.actors.twitter).call({
                searchTerms: [`from:${account} has:media min_faves:${CONFIG.minLikes}`],
                searchMode: 'live',
                maxTweets: 20,
                since: sinceStr,
                addUserInfo: true,
            });
            const { items } = await client.dataset(run.defaultDatasetId).listItems();
            log.info(`  → ${items.length} tweets`);
            results.push(...items.map(t => ({ ...t, _platform: 'twitter' })));
        } catch (err) {
            log.warn(`  Failed: ${err.message}`);
        }
    }

    return results;
}

// ============================================================
// PLATFORM: THREADS
// ============================================================
async function crawlThreads(client) {
    log.section('🧵 Threads');
    const results = [];

    // Search queries
    for (const query of CONFIG.threads.searchQueries) {
        log.info(`Search: "${query}"`);
        try {
            const run = await client.actor(CONFIG.actors.threads).call({
                searchQueries: [query],
                maxItems: CONFIG.threads.maxPostsPerQuery,
                searchType: 'top',
            });
            const { items } = await client.dataset(run.defaultDatasetId).listItems();
            log.info(`  → ${items.length} posts`);
            results.push(...items.map(t => ({ ...t, _platform: 'threads' })));
        } catch (err) {
            log.warn(`  Failed: ${err.message}`);
        }
    }

    // Tracked accounts
    for (const account of CONFIG.threads.trackedAccounts) {
        log.info(`Account: @${account}`);
        try {
            const run = await client.actor(CONFIG.actors.threads).call({
                usernames: [account],
                maxItems: 20,
            });
            const { items } = await client.dataset(run.defaultDatasetId).listItems();
            log.info(`  → ${items.length} posts`);
            results.push(...items.map(t => ({ ...t, _platform: 'threads' })));
        } catch (err) {
            log.warn(`  Failed: ${err.message}`);
        }
    }

    return results;
}

// ============================================================
// PLATFORM: INSTAGRAM
// ============================================================
async function crawlInstagram(client) {
    log.section('📸 Instagram');
    const results = [];

    // Hashtag search
    for (const hashtag of CONFIG.instagram.hashtags) {
        log.info(`Hashtag: #${hashtag}`);
        try {
            const run = await client.actor(CONFIG.actors.instagram).call({
                search: hashtag,
                searchType: 'hashtag',
                resultsLimit: CONFIG.instagram.maxPostsPerHashtag,
                searchLimit: 1,
            });
            const { items } = await client.dataset(run.defaultDatasetId).listItems();
            log.info(`  → ${items.length} posts`);
            results.push(...items.map(t => ({ ...t, _platform: 'instagram' })));
        } catch (err) {
            log.warn(`  Failed: ${err.message}`);
        }
    }

    // Tracked accounts
    for (const account of CONFIG.instagram.trackedAccounts) {
        log.info(`Account: @${account}`);
        try {
            const run = await client.actor(CONFIG.actors.instagram).call({
                directUrls: [`https://www.instagram.com/${account}/`],
                resultsLimit: 20,
                resultsType: 'posts',
            });
            const { items } = await client.dataset(run.defaultDatasetId).listItems();
            log.info(`  → ${items.length} posts`);
            results.push(...items.map(t => ({ ...t, _platform: 'instagram' })));
        } catch (err) {
            log.warn(`  Failed: ${err.message}`);
        }
    }

    return results;
}

// ============================================================
// UNIFIED DATA EXTRACTION
// ============================================================
function extractPromptData(item) {
    const platform = item._platform;

    switch (platform) {
        case 'twitter':
            return extractTwitter(item);
        case 'threads':
            return extractThreads(item);
        case 'instagram':
            return extractInstagram(item);
        default:
            return null;
    }
}

function extractTwitter(tweet) {
    const id = tweet.id || tweet.id_str || '';
    const text = tweet.full_text || tweet.text || '';
    const author = tweet.user?.screen_name || tweet.author?.userName || '';
    const authorName = tweet.user?.name || tweet.author?.name || '';
    const likes = tweet.favorite_count || tweet.likeCount || 0;
    const views = tweet.views_count || tweet.viewCount || 0;
    const date = tweet.created_at ? new Date(tweet.created_at).toISOString().split('T')[0] : today();

    const images = [];
    // Standard Twitter API format
    if (tweet.entities?.media) {
        for (const m of tweet.entities.media) {
            if (m.media_url_https) images.push(m.media_url_https);
        }
    }
    if (tweet.extended_entities?.media) {
        for (const m of tweet.extended_entities.media) {
            if (m.media_url_https && !images.includes(m.media_url_https)) images.push(m.media_url_https);
        }
    }
    // Apify v2 format
    if (tweet.media?.photos) {
        for (const p of tweet.media.photos) {
            if (p.url && !images.includes(p.url)) images.push(p.url);
        }
    }

    return {
        id: `tw_${id}`, prompt: cleanPrompt(text), author, authorName,
        likes, views, date, images, platform: 'twitter',
        sourceUrl: `https://x.com/${author}/status/${id}`,
        _raw: tweet,
    };
}

function extractThreads(post) {
    const id = post.id || post.pk || '';
    const text = post.text || post.caption || '';
    const author = post.username || post.user?.username || '';
    const authorName = post.user?.full_name || post.user?.name || author;
    const likes = post.like_count || post.likeCount || 0;
    const views = post.view_count || 0;
    const date = post.taken_at ? new Date(post.taken_at * 1000).toISOString().split('T')[0] : today();

    const images = [];
    if (post.image_urls) images.push(...post.image_urls);
    if (post.carousel_media) {
        for (const m of post.carousel_media) {
            if (m.image_url || m.url) images.push(m.image_url || m.url);
        }
    }
    if (post.image_versions2?.candidates?.[0]?.url) {
        images.push(post.image_versions2.candidates[0].url);
    }
    if (post.displayUrl) images.push(post.displayUrl);

    return {
        id: `th_${id}`, prompt: cleanPrompt(text), author, authorName,
        likes, views, date, images, platform: 'threads',
        sourceUrl: post.url || `https://www.threads.net/@${author}/post/${id}`,
        _raw: post,
    };
}

function extractInstagram(post) {
    const id = post.id || post.pk || post.shortCode || '';
    const text = post.caption || post.alt || '';
    const author = post.ownerUsername || post.owner?.username || '';
    const authorName = post.ownerFullName || post.owner?.full_name || author;
    const likes = post.likesCount || post.like_count || 0;
    const views = post.videoViewCount || post.view_count || 0;
    const date = post.timestamp ? new Date(post.timestamp).toISOString().split('T')[0] : today();

    const images = [];
    if (post.displayUrl) images.push(post.displayUrl);
    if (post.images) images.push(...post.images);
    if (post.childPosts) {
        for (const child of post.childPosts) {
            if (child.displayUrl) images.push(child.displayUrl);
        }
    }
    // Carousel
    if (post.sidecarImages) {
        for (const img of post.sidecarImages) {
            if (img.url) images.push(img.url);
        }
    }

    return {
        id: `ig_${id}`, prompt: cleanPrompt(text), author, authorName,
        likes, views, date, images, platform: 'instagram',
        sourceUrl: post.url || `https://www.instagram.com/p/${post.shortCode || id}/`,
        _raw: post,
    };
}

// ============================================================
// HELPERS
// ============================================================
function getSinceDate() {
    const d = new Date();
    d.setDate(d.getDate() - CONFIG.sinceDays);
    return d.toISOString().split('T')[0];
}
function today() { return new Date().toISOString().split('T')[0]; }

function cleanPrompt(text) {
    return text
        .replace(/https?:\/\/\S+/g, '')          // Remove URLs
        .replace(/\n{3,}/g, '\n\n')               // Collapse newlines
        .replace(/(\n\s*#\w+\s*)+$/g, '')         // Remove trailing hashtags
        .trim();
}

// ============================================================
// DETECT MODEL
// ============================================================
function detectModel(data) {
    const text = (data._raw?.full_text || data._raw?.text || data._raw?.caption || data.prompt || '').toLowerCase();
    const hashtags = (data._raw?.entities?.hashtags?.map(h => h.text.toLowerCase()) || []);
    const allText = text + ' ' + hashtags.join(' ');

    if (/gpt.?image|4o.?image|chatgpt.*image/i.test(allText)) return 'gptimage';
    if (/midjourney/i.test(allText)) return 'midjourney';
    if (/flux.*kontext/i.test(allText)) return 'flux';
    if (/nano.?banana.?2/i.test(allText)) return 'nanobanana2';
    if (/nano.?banana/i.test(allText)) return 'nanobanana';
    if (/imagen/i.test(allText)) return 'imagen';
    if (/grok.?imagine/i.test(allText)) return 'grok';
    if (/seedream/i.test(allText)) return 'seedream';
    if (/stable.?diffusion/i.test(allText)) return 'stablediffusion';

    return 'nanobanana'; // default
}

// ============================================================
// AUTO-CATEGORIZE
// ============================================================
async function categorizePrompt(prompt) {
    if (CONFIG.geminiApiKey) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${CONFIG.geminiApiKey}`;
            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `Categorize this AI image prompt. Return ONLY a JSON array from: ${CONFIG.categories.join(', ')}\n\nRules: "JSON" if structured/JSON format. "Photograph" if photorealistic. "Girl"/"Boy" for gender. "Product" for commercial. "Food" for food. "3D" for 3D. "Anime" for anime. "Other" if none fit.\n\nPrompt:\n${prompt.substring(0, 1500)}\n\nJSON array only:` }] }]
                })
            });
            const data = await resp.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const match = text.match(/\[.*\]/s);
            if (match) return JSON.parse(match[0]);
        } catch (err) {
            log.warn(`Gemini categorization failed: ${err.message}`);
        }
    }
    return keywordCategorize(prompt);
}

function keywordCategorize(prompt) {
    const lower = prompt.toLowerCase();
    const cats = [];
    if (prompt.includes('{') && prompt.includes('}')) cats.push('JSON');

    const map = {
        'Photograph': ['photo', 'portrait', 'camera', 'lens', 'f/', 'aperture', 'cinematic', 'photorealistic', 'dslr'],
        'Girl': ['woman', 'girl', 'female', 'she ', 'her ', 'blonde', 'brunette'],
        'Boy': ['man', 'boy', 'male', 'he ', 'his ', 'beard'],
        'Product': ['product', 'bottle', 'packaging', 'brand', 'mockup', 'commercial'],
        'Food': ['food', 'dish', 'recipe', 'cuisine', 'ingredient', 'cooking'],
        '3D': ['3d', 'render', 'isometric', 'voxel', 'blender'],
        'Anime': ['anime', 'manga', 'chibi', 'kawaii'],
        'Logo': ['logo', 'branding', 'emblem'],
        'App': ['app', 'ui ', 'interface', 'dashboard'],
    };
    for (const [cat, kws] of Object.entries(map)) {
        if (kws.some(kw => lower.includes(kw))) cats.push(cat);
    }
    if (cats.length === 0) cats.push('Other');
    return cats;
}

// ============================================================
// FILTER VALIDITY
// ============================================================
function isValidPrompt(data) {
    if (!data) return false;
    if (data.images.length === 0) return false;
    if (data.prompt.length < 50) return false;
    if (data.likes < CONFIG.minLikes) return false;
    if (data.prompt.startsWith('RT @')) return false;
    return true;
}

// ============================================================
// DOWNLOAD IMAGES
// ============================================================
async function downloadImages(entryId, imageUrls) {
    const hostedUrls = [];
    const tweetDir = path.join(CONFIG.imageDownloadDir, entryId);

    if (!DRY_RUN) {
        fs.mkdirSync(tweetDir, { recursive: true });
    }

    for (let i = 0; i < imageUrls.length; i++) {
        const filename = `${i}.jpg`;
        const hostedUrl = `${CONFIG.imageBaseUrl}/${entryId}/${filename}`;

        if (!DRY_RUN) {
            try {
                const resp = await fetch(imageUrls[i]);
                if (resp.ok) {
                    const buf = Buffer.from(await resp.arrayBuffer());
                    fs.writeFileSync(path.join(tweetDir, filename), buf);
                    log.info(`    📥 ${filename} (${(buf.length / 1024).toFixed(0)}KB)`);
                }
            } catch (err) {
                hostedUrls.push(imageUrls[i]); // fallback to original
                continue;
            }
        }
        hostedUrls.push(hostedUrl);
    }
    return hostedUrls;
}

// ============================================================
// MERGE
// ============================================================
function mergePrompts(existing, newEntries) {
    const existingIds = new Set(existing.map(p => p.id));
    const added = newEntries.filter(p => !existingIds.has(p.id));

    if (added.length === 0) return { merged: existing, added: [] };

    const merged = [...existing, ...added];
    merged.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    merged.forEach((p, i) => p.rank = i + 1);

    return { merged, added };
}

// ============================================================
// MAIN
// ============================================================
async function main() {
    log.section('🚀 KGen Multi-Platform Prompt Crawler');
    log.info(`Mode: ${DRY_RUN ? '🔬 DRY RUN' : '🔴 PRODUCTION'}`);
    log.info(`Platforms: ${PLATFORM_FILTER}`);
    log.info(`Since: ${CONFIG.sinceDays} days ago (${getSinceDate()})`);

    if (!CONFIG.apifyToken) {
        log.error('APIFY_TOKEN is required! Set it as environment variable.');
        process.exit(1);
    }

    const client = new ApifyClient({ token: CONFIG.apifyToken });
    let allRawItems = [];

    // ---- Crawl each platform ----
    if (PLATFORM_FILTER === 'all' || PLATFORM_FILTER === 'x' || PLATFORM_FILTER === 'twitter') {
        const items = await crawlTwitter(client);
        allRawItems.push(...items);
    }

    if (PLATFORM_FILTER === 'all' || PLATFORM_FILTER === 'threads') {
        const items = await crawlThreads(client);
        allRawItems.push(...items);
    }

    if (PLATFORM_FILTER === 'all' || PLATFORM_FILTER === 'ig' || PLATFORM_FILTER === 'instagram') {
        const items = await crawlInstagram(client);
        allRawItems.push(...items);
    }

    log.section('🔍 Processing Results');
    log.info(`Total raw items: ${allRawItems.length}`);

    // ---- Extract & deduplicate ----
    const extracted = allRawItems.map(extractPromptData).filter(Boolean);
    const deduped = new Map();
    for (const item of extracted) {
        if (!deduped.has(item.id)) deduped.set(item.id, item);
    }
    const unique = Array.from(deduped.values());
    log.info(`Unique items: ${unique.length}`);

    // ---- Filter valid prompts ----
    const valid = unique.filter(isValidPrompt);
    log.info(`Valid prompts: ${valid.length}`);

    // ---- Process each ----
    log.section('🏷️ Processing Prompts');
    const processed = [];

    for (const data of valid) {
        const platformIcon = { twitter: '🐦', threads: '🧵', instagram: '📸' }[data.platform] || '📄';
        log.info(`${platformIcon} @${data.author} (${data.likes}❤️): "${data.prompt.substring(0, 50)}..."`);

        const model = detectModel(data);
        const categories = await categorizePrompt(data.prompt);
        const hostedUrls = await downloadImages(data.id, data.images);

        processed.push({
            rank: 0,
            id: data.id,
            prompt: data.prompt,
            author: data.author,
            author_name: data.authorName,
            likes: data.likes,
            views: data.views,
            image: hostedUrls[0] || data.images[0] || '',
            images: hostedUrls.length > 0 ? hostedUrls : data.images,
            model,
            categories,
            date: data.date,
            source_url: data.sourceUrl,
            platform: data.platform,
        });

        log.success(`  → [${model}] [${categories.join(', ')}]`);
    }

    // ---- Merge ----
    log.section('📦 Merging');
    let existing = [];
    try {
        existing = JSON.parse(fs.readFileSync(CONFIG.promptsJsonPath, 'utf-8'));
        log.info(`Existing prompts: ${existing.length}`);
    } catch (err) {
        log.warn(`Could not load existing: ${err.message}`);
    }

    const { merged, added } = mergePrompts(existing, processed);

    if (DRY_RUN) {
        log.section('🔬 DRY RUN Results');
        for (const p of added) {
            const icon = { twitter: '🐦', threads: '🧵', instagram: '📸' }[p.platform] || '📄';
            console.log(`  ${icon} [${p.model}] @${p.author}: "${p.prompt.substring(0, 70)}..." (${p.likes}❤️)`);
        }
    } else {
        fs.writeFileSync(CONFIG.promptsJsonPath, JSON.stringify(merged, null, 2), 'utf-8');
        log.success(`Saved! ${merged.length} total (${added.length} new)`);
    }

    // ---- Summary ----
    log.section('📊 Summary');
    const platCounts = {};
    for (const p of processed) {
        platCounts[p.platform] = (platCounts[p.platform] || 0) + 1;
    }
    log.info(`Raw items crawled: ${allRawItems.length}`);
    log.info(`Valid prompts: ${valid.length}`);
    log.info(`New added: ${added.length}`);
    log.info(`Total gallery: ${merged.length}`);
    for (const [plat, count] of Object.entries(platCounts)) {
        const icon = { twitter: '🐦', threads: '🧵', instagram: '📸' }[plat] || '📄';
        log.info(`  ${icon} ${plat}: ${count}`);
    }
}

main().catch(err => {
    log.error('Fatal:', err);
    process.exit(1);
});
