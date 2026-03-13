const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('./frontend', (filepath) => {
  if (filepath.endsWith('.html')) {
    let content = fs.readFileSync(filepath, 'utf8');
    let original = content;
    
    // Replace href="/pages/index.html#pricing" (or similar) -> href="/pages/Pricing.html"
    // Using regex to catch variations just in case
    content = content.replace(/href="(?:\/pages)?\/index\.html#pricing"/g, 'href="/pages/Pricing.html"');
    content = content.replace(/href="\/#pricing"/g, 'href="/pages/Pricing.html"');
    content = content.replace(/href="#pricing"/g, 'href="/pages/Pricing.html"');
    
    // Replace href="/pages/index.html#community" (or similar) -> href="/pages/Community.html"
    content = content.replace(/href="(?:\/pages)?\/index\.html#community"/g, 'href="/pages/Community.html"');
    content = content.replace(/href="\/#community"/g, 'href="/pages/Community.html"');
    content = content.replace(/href="#community"/g, 'href="/pages/Community.html"');

    if (content !== original) {
      fs.writeFileSync(filepath, content);
      console.log('Updated', filepath);
    }
  }
});
