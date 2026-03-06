const fs = require('fs');

function fixMojibake(file) {
    let content = fs.readFileSync(file, 'utf8');

    // Mappings for broken characters
    const mappings = [
        ['Bß║ín dang ? ch? ─æß╗â xem tr╞░ß╗¢c', 'Bạn đang ở chế độ xem trước'],
        ['Ch? hiß╗ân thß╗ï', 'Chỉ hiển thị'],
        ['─É─âng nhß║¡p miß╗àn ph├¡ ─æß╗â xem ─æß║ºy ─æß╗º', 'Đăng nhập miễn phí để xem đầy đủ'],
        ['?? ─É─âng nhß║¡p ngay', '🔐 Đăng nhập ngay'],
        ['?? C?u hình Google Sign-In', '⚙️ Cấu hình Google Sign-In'],
        ['?? Prompt có thể', '🚫 Prompt có thể'],
        ['?? Thử lại hoặc', '❌ Thử lại hoặc'],
        ['?? ${formatNumber', '❤️ ${formatNumber'],
        ['?? ${item.date', '📅 ${item.date'],
        ['Ä Äƒng nháº­p d? xem prompt d?y d?', 'Đăng nhập để xem prompt đầy đủ'],
        ['?? Ä Äƒng nháº­p ngay', '🔐 Đăng nhập ngay'],
        ['?? Ä Äƒng nháº­p', '🔐 Đăng Nhập'],
        ['Ä Äƒng nháº­p', 'Đăng nhập'],
        ['?? Đăng nhập ngay', '🔐 Đăng nhập ngay'],
        ['?? Đăng nhập', '🔐 Đăng Nhập'],
        ['Đăng nhập d? xem prompt d?y d?', 'Đăng nhập để xem prompt đầy đủ'],
        ['Bạn dang ? ch? để xem trước', 'Bạn đang ở chế độ xem trước'],
        ['Ch? hiển thị', 'Chỉ hiển thị'],
        ['C?u hình Google', 'Cấu hình Google']
    ];

    for (const [bad, good] of mappings) {
        content = content.split(bad).join(good);
    }

    fs.writeFileSync(file, content, 'utf8');
    console.log(`Fixed ${file}`);
}

fixMojibake('web-ui/app.js');
fixMojibake('web-ui/index.html');
fixMojibake('web-ui/admin.html');
