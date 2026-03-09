const sharp = require('sharp');

async function processLogo() {
    try {
        const imgPath = 'web-ui/logo.png';
        const { data, info } = await sharp(imgPath)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            const lightness = Math.round((r + g + b) / 3);

            // Black lines, white transparent
            data[i] = 0;
            data[i + 1] = 0;
            data[i + 2] = 0;
            data[i + 3] = Math.max(0, 255 - lightness);
        }

        await sharp(data, {
            raw: { width: info.width, height: info.height, channels: 4 }
        })
            .png()
            .toFile('web-ui/logo_transparent.png');

        console.log("Created web-ui/logo_transparent.png successfully.");
    } catch (err) {
        console.error(err);
    }
}

processLogo();
