/**
 * Generate a lightweight gallery-index.json from the full trending-prompts.json
 * Only keeps fields needed for gallery card display
 */
const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '..', 'web-ui', 'data', 'trending-prompts.json');
const outputPath = path.join(__dirname, '..', 'web-ui', 'data', 'gallery-index.json');

const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

// Only keep what's needed for gallery cards
const slim = raw.map(item => ({
    i: item.id,          // id
    r: item.rank,        // rank
    g: item.image,       // image (gallery thumbnail)
    m: item.model,       // model
    l: item.likes,       // likes
    v: item.views,       // views
    a: item.author_name, // author name
    c: item.categories,  // categories
    d: item.date         // date
}));

fs.writeFileSync(outputPath, JSON.stringify(slim));

const origSize = fs.statSync(inputPath).size;
const newSize = fs.statSync(outputPath).size;
console.log(`Original: ${(origSize / 1024).toFixed(0)} KB`);
console.log(`Slim:     ${(newSize / 1024).toFixed(0)} KB`);
console.log(`Reduction: ${((1 - newSize / origSize) * 100).toFixed(1)}%`);
console.log(`Items: ${slim.length}`);
