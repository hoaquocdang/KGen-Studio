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

if (!KIE_API_KEY) {
    console.warn('⚠️ No KIE_API_KEY configured! Set via env or site-config.js');
}

console.log(`🔑 Kie AI Key: ${KIE_API_KEY ? '***' + KIE_API_KEY.slice(-6) : 'NOT SET'}`);

// MIME types
const MIME = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
};

// Rate limiting (simple in-memory)
const rateLimits = new Map();
const RATE_LIMIT = 10; // requests per minute per IP
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
    const fullPath = path.join(STATIC_DIR, filePath === '/' ? 'index.html' : filePath);
    const ext = path.extname(fullPath);

    // Block site-config.js from being served (security!)
    if (filePath.includes('site-config.js')) {
        // Serve a sanitized version without the API key
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(`
            window.SITE_CONFIG = {
                api: { kieApiKey: '', kieApiBase: '', kieModel: 'nano-banana-pro' },
                plans: ${JSON.stringify(SITE_CONFIG.plans || {})},
                useProxy: true,
                version: '2.1.0',
            };
        `);
        return;
    }

    fs.readFile(fullPath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
            return;
        }
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
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

    // Static files
    serveStatic(url.pathname, res);
});

server.listen(PORT, () => {
    console.log(`\n🚀 KGen Gallery Server running on http://localhost:${PORT}`);
    console.log(`📁 Serving static files from: ${STATIC_DIR}`);
    console.log(`🔐 API proxy: /api/proxy/* → ${KIE_BASE_URL}`);
    console.log(`🔑 Admin key: ${KIE_API_KEY ? 'Configured ✅' : 'NOT SET ❌'}\n`);
});
