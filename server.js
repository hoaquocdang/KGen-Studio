const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ============================================================
// KGen Proxy Server
// Bảo mật Kie AI API key phía server
// User gọi /api/generate → proxy gọi Kie AI với admin key
// ============================================================

const PORT = 3456;
const STATIC_DIR = path.join(__dirname, 'web-ui');

// Read config
let SITE_CONFIG = {};
try {
    const configContent = fs.readFileSync(path.join(STATIC_DIR, 'site-config.js'), 'utf8');
    // Extract the JSON from window.SITE_CONFIG = {...};
    const match = configContent.match(/window\.SITE_CONFIG\s*=\s*(\{[\s\S]*\});/);
    if (match) {
        SITE_CONFIG = eval('(' + match[1] + ')');
    }
} catch (e) {
    console.warn('⚠️ Could not load site-config.js, using env vars');
}

const KIE_API_KEY = process.env.KIE_API_KEY || SITE_CONFIG.api?.kieApiKey || '';
const KIE_BASE_URL = process.env.KIE_BASE_URL || SITE_CONFIG.api?.kieApiBase || 'https://api.kie.ai';
const N8N_VEO_GENERATE_URL = process.env.N8N_VEO_GENERATE_URL || SITE_CONFIG.n8nVeo?.generateUrl || '';

if (!KIE_API_KEY) {
    console.warn('⚠️ No KIE_API_KEY configured! Set via env or site-config.js');
}

console.log(`🔑 Kie AI Key: ${KIE_API_KEY ? '***' + KIE_API_KEY.slice(-6) : 'NOT SET'}`);
console.log(`🎬 VEO n8n URL: ${N8N_VEO_GENERATE_URL ? N8N_VEO_GENERATE_URL.replace(/webhook\/.+/, 'webhook/***') : 'NOT SET ❌'}`);

// MIME types
const MIME = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.xml':  'application/xml',
    '.txt':  'text/plain',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.woff':  'font/woff',
    '.mp4':  'video/mp4',
    '.webm': 'video/webm',
};

// Rate limiting (simple in-memory)
const rateLimits = new Map();
const RATE_LIMIT = 120; // requests per minute per IP
const RATE_WINDOW = 60000; // 1 minute

function checkRateLimit(ip) {
    const now = Date.now();
    const entry = rateLimits.get(ip) || { count: 0, resetAt: now + RATE_WINDOW };

    if (now > entry.resetAt) {
        entry.count = 0;
        entry.resetAt = now + RATE_WINDOW;
    }

    entry.count++;
    rateLimits.set(ip, entry);

    return entry.count <= RATE_LIMIT;
}

// Proxy request to Kie AI
function proxyToKieAI(reqPath, method, body, res) {
    const url = new URL(reqPath, KIE_BASE_URL);

    const options = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${KIE_API_KEY}`,
        },
    };

    const proxyReq = https.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        });
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (e) => {
        console.error('Proxy error:', e.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Proxy error', message: e.message }));
    });

    if (body) proxyReq.write(body);
    proxyReq.end();
}

// Serve static files
function serveStatic(filePath, res) {
    let fullPath = path.join(STATIC_DIR, filePath === '/' ? 'index.html' : filePath);

    // Block site-config.js from being served raw (security: hide admin API key)
    const basename = path.basename(filePath);
    if (basename === 'site-config.js' || filePath.includes('site-config')) {
        console.log(`🔐 Serving sanitized site-config.js`);
        // Serve a sanitized version: hide kieApiKey but keep public configs
        const safePlans = JSON.stringify(SITE_CONFIG.plans || {});
        const safeSupabase = JSON.stringify(SITE_CONFIG.supabase || {});
        const safeN8n = JSON.stringify(SITE_CONFIG.n8nGateway || {});
        const safePayment = JSON.stringify(SITE_CONFIG.payment || {});
        res.writeHead(200, {
            'Content-Type': 'application/javascript',
            'Cache-Control': 'no-cache',
        });
        res.end(`window.SITE_CONFIG = {
    api: { kieApiKey: '', kieApiBase: '', kieModel: '${SITE_CONFIG.api?.kieModel || 'nano-banana-pro'}', geminiApiKey: '${SITE_CONFIG.api?.geminiApiKey || ''}' },
    plans: ${safePlans},
    supabase: ${safeSupabase},
    n8nGateway: ${safeN8n},
    payment: ${safePayment},
    useProxy: true,
    version: '2.1.0',
};`);
        return;
    }

    fs.stat(fullPath, (err, stats) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
            return;
        }

        // If directory, append index.html and recursively serve it
        if (stats.isDirectory()) {
            return serveStatic(path.join(filePath, 'index.html'), res);
        }

        const ext = path.extname(fullPath);

        fs.readFile(fullPath, (readErr, data) => {
            if (readErr) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not Found');
                return;
            }
            res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
            res.end(data);
        });
    });
}

// Create server
const server = http.createServer((req, res) => {
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const url = new URL(req.url, `http://localhost:${PORT}`);

    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        });
        res.end();
        return;
    }

    // API Proxy routes
    if (url.pathname.startsWith('/api/proxy/')) {
        // Rate limit check
        if (!checkRateLimit(clientIP)) {
            res.writeHead(429, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Quá nhiều request. Đợi 1 phút.' }));
            return;
        }

        if (!KIE_API_KEY) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'API key chưa được cấu hình trên server.' }));
            return;
        }

        // Strip /api/proxy prefix → forward to Kie AI
        const kieApiPath = url.pathname.replace('/api/proxy', '/api/v1/jobs');

        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                console.log(`📡 Proxy POST ${kieApiPath} from ${clientIP}`);
                proxyToKieAI(kieApiPath, 'POST', body, res);
            });
        } else if (req.method === 'GET') {
            const fullPath = kieApiPath + url.search;
            console.log(`📡 Proxy GET ${fullPath} from ${clientIP}`);
            proxyToKieAI(fullPath, 'GET', null, res);
        }
        return;
    }

    // ===== VEO GENERATE → n8n webhook (URL ẩn trong site-config.js) =====
    if (url.pathname === '/api/veo/generate' && req.method === 'POST') {
        if (!checkRateLimit(clientIP)) {
            res.writeHead(429, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ code: 429, msg: 'Quá nhiều request. Đợi 1 phút.' }));
            return;
        }

        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const N8N_VEO_URL = N8N_VEO_GENERATE_URL;

            // Helper: gọi kie.ai trực tiếp (fallback)
            const callKieDirect = () => {
                console.log(`🎬 VEO Generate → kie.ai DIRECT from ${clientIP}`);
                proxyToKieAI('/api/v1/veo/generate', 'POST', body, res);
            };

            // Nếu chưa config n8n → gọi kie.ai trực tiếp
            if (!N8N_VEO_URL) {
                console.warn('⚠️ n8n VEO URL not set, falling back to kie.ai direct');
                callKieDirect();
                return;
            }

            // Gọi n8n webhook
            console.log(`🎬 VEO Generate → n8n from ${clientIP}`);
            const n8nUrl = new URL(N8N_VEO_URL);
            const options = {
                hostname: n8nUrl.hostname,
                port: n8nUrl.port || 443,
                path: n8nUrl.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body),
                },
            };
            const proto = n8nUrl.protocol === 'https:' ? https : http;
            let n8nBody = '';
            const n8nReq = proto.request(options, (n8nRes) => {
                n8nRes.on('data', chunk => n8nBody += chunk);
                n8nRes.on('end', () => {
                    // Kiểm tra n8n có trả lỗi không (4xx/5xx hoặc text không phải JSON)
                    const isErrorStatus = n8nRes.statusCode >= 400;
                    let parsed = null;
                    try { parsed = JSON.parse(n8nBody); } catch {}
                    const isN8nError = !parsed || parsed.message || (typeof n8nBody === 'string' && n8nBody.toLowerCase().includes('not supported'));

                    if (isErrorStatus || isN8nError) {
                        console.warn(`⚠️ n8n returned error (${n8nRes.statusCode}): ${n8nBody.substring(0, 100)}`);
                        console.warn('↩️  Falling back to kie.ai direct');
                        callKieDirect();
                    } else {
                        res.writeHead(n8nRes.statusCode, {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                        });
                        res.end(n8nBody);
                    }
                });
            });
            n8nReq.on('error', (e) => {
                console.error('n8n VEO error:', e.message, '→ falling back to kie.ai');
                callKieDirect();
            });
            n8nReq.write(body);
            n8nReq.end();
        });
        return;
    }

    // ===== VEO STATUS → kie.ai trực tiếp (key ẩn trong server) =====
    if (url.pathname.startsWith('/api/veo/status/') && req.method === 'GET') {
        // Không rate-limit status polling
        if (!KIE_API_KEY) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ code: 500, msg: 'API key chưa được cấu hình.' }));
            return;
        }
        const taskId = url.pathname.replace('/api/veo/status/', '');
        console.log(`🎬 VEO Status check: ${taskId} from ${clientIP}`);
        proxyToKieAI(`/api/v1/veo/${taskId}`, 'GET', null, res);
        return;
    }


    // Health check
    if (url.pathname === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            hasKey: !!KIE_API_KEY,
            timestamp: new Date().toISOString(),
        }));
        return;
    }

    // Admin URL rewrites: /admin, /adminkgen → serve admin.html
    if (url.pathname === '/admin' || url.pathname === '/adminkgen') {
        serveStatic('/admin.html', res);
        return;
    }

    // Static files
    serveStatic(url.pathname, res);
});

server.listen(PORT, () => {
    console.log(`\n🚀 KGen Gallery Server running on http://localhost:${PORT}`);
    console.log(`📁 Serving static files from: ${STATIC_DIR}`);
    console.log(`🔐 API proxy: /api/proxy/* → ${KIE_BASE_URL}`);
    console.log(`🔑 Admin key: ${KIE_API_KEY ? 'Configured ✅' : 'NOT SET ❌'}\n`);
});
