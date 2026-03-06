const fs = require('fs');
let str = fs.readFileSync('web-ui/index.html', 'utf8');

// Replace MeiGen back to KGen (titles, labels)
str = str.replace(/MeiGen Gallery — Trending AI Prompts/g, 'KGen Gallery — Trending AI Prompts');
str = str.replace(/MeiGen Gallery: Browse 1,300\+/g, 'KGen Gallery: Browse 1,300+');
str = str.replace(/<h1 class="splash-title">MeiGen Gallery<\/h1>/g, '<h1 class="splash-title">KGen Gallery</h1>');
str = str.replace(/<span class="logo-text">MeiGen <span class="logo-accent">Gallery<\/span><\/span>/g, '<span class="logo-text">KGen <span class="logo-accent">Gallery</span></span>');
str = str.replace(/<strong>Share MeiGen<\/strong>/g, '<strong>Share KGen</strong>');
str = str.replace(/alt="MeiGen"/g, 'alt="KGen"');
str = str.replace(/cộng đồng sáng tạo MeiGen/g, 'cộng đồng sáng tạo KGen');
str = str.replace(/sức mạnh MeiGen Studio/g, 'sức mạnh KGen Studio');
str = str.replace(/Tận dụng tối đa MeiGen Studio/g, 'Tận dụng tối đa KGen Studio');
str = str.replace(/Nền tảng AI Prompt.*?MeiGen/g, 'Nền tảng AI Prompt & Image Generation #1 Việt Nam');

fs.writeFileSync('web-ui/index.html', str, 'utf8');
console.log('Reverted MeiGen → KGen');
