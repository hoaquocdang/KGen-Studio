const fs = require('fs');

function fixMojibake(file) {
    let str = fs.readFileSync(file, 'utf8');

    // We will look for sequences of characters in the range 128-255 that form valid UTF-8 when converted to bytes.
    // Instead of parsing perfectly, we can just find any contiguous substring of characters where code <= 255.
    // Actually, ASCII characters (0-127) form valid UTF-8 too, so we can group them together.

    let result = '';
    let i = 0;
    while (i < str.length) {
        if (str.charCodeAt(i) > 255) {
            result += str[i];
            i++;
        } else {
            let j = i;
            while (j < str.length && str.charCodeAt(j) <= 255) {
                j++;
            }
            let block = str.substring(i, j);
            let buf = Buffer.from(block, 'latin1');
            let decoded = buf.toString('utf8');

            // If the decoded string contains replacement character (invalid utf8),
            // it means this block wasn't purely a corrupted utf8 string.
            // But wait, the block might contain a mix of valid ASCII and isolated corrupted sequences.
            // A better way: iterate through regex matches of [\x80-\xFF]+
            let blockFixed = block.replace(/[\x80-\xFF]+/g, (match) => {
                let mBuf = Buffer.from(match, 'latin1');
                let mDec = mBuf.toString('utf8');
                if (mDec.includes('\uFFFD')) {
                    // It had invalid utf8 bytes, meaning it either isn't mojibake or is incomplete.
                    // Let's just return the match as is.
                    return match;
                }
                return mDec;
            });

            result += blockFixed;
            i = j;
        }
    }

    fs.writeFileSync(file, result, 'utf8');
    console.log(`Fixed ${file}`);
}

try {
    fixMojibake('web-ui/index.html');
    fixMojibake('web-ui/app.js');
    fixMojibake('web-ui/admin.html');
} catch (e) { console.error(e); }
