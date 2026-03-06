const fs = require('fs');
let str = fs.readFileSync('web-ui/index.html', 'utf8');

const replacements = [
    ['KGen Gallery — Trending AI Prompts', 'MeiGen Gallery — Trending AI Prompts'],
    ['KGen Gallery: Browse 1,300+', 'MeiGen Gallery: Browse 1,300+'],
    ['<h1 class="splash-title">KGen Gallery</h1>', '<h1 class="splash-title">MeiGen Gallery</h1>'],
    ['<span class="logo-text">KGen <span class="logo-accent">Gallery</span></span>', '<span class="logo-text">MeiGen <span class="logo-accent">Gallery</span></span>'],
    ['<strong>Share KGen</strong>', '<strong>Share MeiGen</strong>'],
    ['<img src="logo.png" alt="KGen"', '<img src="logo.png" alt="MeiGen"'],
    ['cộng đồng sáng tạo\n                    KGen', 'cộng đồng sáng tạo MeiGen'],
    ['sức mạnh KGen Studio', 'sức mạnh MeiGen Studio'],
    ['Tận dụng tối đa KGen Studio', 'Tận dụng tối đa MeiGen Studio'],
    ['<img src="logo.png" alt="KGen"', '<img src="logo.png" alt="MeiGen"']
];

for (const [search, replace] of replacements) {
    str = str.replace(new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replace);
}

// One more check for the gallery subtitle because of whitespace
str = str.replace(/cộng đồng sáng tạo\s*KGen/g, 'cộng đồng sáng tạo MeiGen');

fs.writeFileSync('web-ui/index.html', str, 'utf8');
console.log('Rebranded successfully');
