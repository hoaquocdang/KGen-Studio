const fs = require('fs');

function fixMojibake(file) {
    let str = fs.readFileSync(file, 'utf8');

    // Mappings for specific mojibake strings to skip complex decode that might fail
    let fixed = str.replace(/Ã¢â‚¬â€/g, '—')
        .replace(/â€”/g, '—')
        .replace(/Ä Äƒng nháº­p/g, 'Đăng nhập')
        .replace(/Ä‘á»/g, 'để')
        .replace(/áº£nh/g, 'ảnh')
        .replace(/tuá»³/g, 'tuỳ')
        .replace(/chá» n/g, 'chọn')
        .replace(/d\?y d\?/g, 'đầy đủ')  // "d?y d?" -> đầy đủ
        .replace(/cáº¥u hÃ¬nh/g, 'cấu hình')
        .replace(/nÃ¢ng cáº¥p/gi, 'Nâng cấp')
        .replace(/Náº¿u/g, 'Nếu')
        .replace(/táº£i/g, 'tải')
        .replace(/KÃ©o tháº£/g, 'Kéo thả')
        .replace(/hoáº·c/g, 'hoặc')
        .replace(/tham chiáº¿u/g, 'tham chiếu')
        .replace(/d\? xem prompt/g, 'để xem prompt') // "d? xem" -> để xem
        .replace(/\?\? Đăng nhập/g, '🔐 Đăng nhập')
        .replace(/\?\? C\?u hình/g, '⚙️ Cấu hình')
        .replace(/\?\? Prompt có thể/g, '🚫 Prompt có thể')
        .replace(/\?\? Thử lại hoặc/g, '❌ Thử lại hoặc')
        .replace(/C\?u hình/g, 'Cấu hình')
        .replace(/Bạn dang \? ch\? để xem trước/g, 'Bạn đang ở chế độ xem trước')
        .replace(/Ch\? hiển thị/g, 'Chỉ hiển thị');

    // Universal regex decoding for UTF-8 misread as Latin-1
    // Only decodes sequences of 2-4 Latin-1 extended chars that form a valid UTF-8 char
    fixed = fixed.replace(/[\x80-\xFF]{2,4}/g, (match) => {
        let dec = Buffer.from(match, 'latin1').toString('utf8');
        return dec.includes('\uFFFD') ? match : dec;
    });

    // Additional manual replacements just in case
    fixed = fixed.replace(/Ch\? /g, 'Chỉ ')
        .replace(/d\?y/g, 'đầy')
        .replace(/d\?/g, 'dủ');

    fs.writeFileSync(file, fixed, 'utf8');
}

fixMojibake('web-ui/index.html');
fixMojibake('web-ui/app.js');
fixMojibake('web-ui/admin.html');
console.log("Done");
