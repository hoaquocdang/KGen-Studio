const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('index.html')) {
      let content = fs.readFileSync(fullPath, 'utf8');

      // Tính url tiếng Việt và tiếng Anh dựa trên format "web-ui/blog/"
      let pUrl = fullPath.replace(/\\/g, '/');
      const match = pUrl.match(/web-ui\/((en\/)?blog\/.*)/);
      if (!match) continue;

      let relativePath = match[1];
      // Nếu là tiếng Anh
      let slug = relativePath;
      if (relativePath.startsWith('en/')) {
        slug = relativePath.substring(3); // bỏ "en/"
      }

      slug = slug.replace('index.html', '');
      if (slug.endsWith('/')) slug = slug.substring(0, slug.length - 1);
      
      const viUrl = `https://kgen.cloud/${slug || 'blog'}/`;
      const enUrl = `https://kgen.cloud/en/${slug || 'blog'}/`;

      let changed = false;

      // 1. Thêm language-switcher script
      if (!content.includes('language-switcher.js')) {
        content = content.replace('</head>', `  <script src="/blog/language-switcher.js"></script>\n</head>`);
        changed = true;
      }

      // 2. Thêm Hreflang
      if (!content.includes('hreflang="vi"')) {
        const hreflangVi = `<link rel="alternate" hreflang="vi" href="${viUrl}" />`;
        const hreflangEn = `<link rel="alternate" hreflang="en" href="${enUrl}" />`;
        content = content.replace('</head>', `  ${hreflangVi}\n  ${hreflangEn}\n</head>`);
        changed = true;
      }

      // 3. Update header nav with language toggle (If have nav and lang btn missing)
      if (content.includes('<nav class="header-nav"') && !content.includes('lang-switch-btn')) {
        const langBtnHTML = `<a href="#" id="lang-switch-btn" class="lang-btn" style="display:flex;align-items:center;gap:4px;background:rgba(255,255,255,0.1);padding:4px 10px;border-radius:12px;font-size:0.8rem;font-weight:700;" title="Switch Language">🌐 EN/VI</a>`;
        content = content.replace('</nav>', `  ${langBtnHTML}\n      </nav>`);
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(fullPath, content);
        console.log(`Updated DOM setup in: ${fullPath}`);
      }
    }
  }
}

// Chạy script
console.log('Running script over blog + en/blog directories...');
processDir(path.join(__dirname, 'blog'));
processDir(path.join(__dirname, 'en', 'blog'));
console.log('Done.');
