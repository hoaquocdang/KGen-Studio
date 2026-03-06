const fs = require('fs');

const cp1252 = {
    0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84,
    0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88,
    0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C,
    0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93,
    0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
    0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B,
    0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F
};

function fixMojibake(file) {
    let str = fs.readFileSync(file, 'utf8');

    // First revert safe words that were modified in recent commits
    str = str.replace(/Chỉ hiển thị/g, 'Ch? hiển thị');

    // We create a regex to match sequences of characters that map to 0x80-0xFF in Windows-1252.
    // That includes typical latin-1 0x80-0xFF AND the specific unicode chars in cp1252.
    let reBuf = [];
    for (let i = 0x80; i <= 0xFF; i++) {
        reBuf.push(String.fromCharCode(i));
    }
    for (let k in cp1252) {
        reBuf.push(String.fromCharCode(k));
    }
    // Any character matching these
    let re = new RegExp(`[${reBuf.join('')}]+`, 'g');

    let fixed = str.replace(re, (match) => {
        let bytes = [];
        for (let i = 0; i < match.length; i++) {
            let code = match.charCodeAt(i);
            if (cp1252[code]) {
                bytes.push(cp1252[code]);
            } else if (code <= 0xFF) {
                bytes.push(code);
            } else {
                return match; // If it's a completely different char, abort this match
            }
        }
        let mDec = Buffer.from(bytes).toString('utf8');
        // If the utf8 string is valid, use it!
        if (mDec.includes('\uFFFD')) {
            return match;
        }
        return mDec;
    });

    // Fix manual replacements
    fixed = fixed.replace(/Ch\? /g, 'Chỉ ')
        .replace(/d\?y/g, 'đầy')
        .replace(/d\?/g, 'dủ')
        .replace(/đểm/g, 'điểm')
        .replace(/để /g, 'để ')
        .replace(/để™/g, 'độ')
        .replace(/để‹/g, 'ị')
        .replace(/đểƒ/g, 'để');

    fs.writeFileSync(file, fixed, 'utf8');
    console.log(`Fixed ${file}`);
}

try {
    fixMojibake('web-ui/index.html');
} catch (e) { console.error(e); }
