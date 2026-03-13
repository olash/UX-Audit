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
    
    // Replace href="/index.html" -> href="/pages/index.html"
    content = content.replace(/href="\/index\.html"/g, 'href="/pages/index.html"');
    
    // Replace href="/index.html#pricing" -> href="/pages/index.html#pricing"
    content = content.replace(/href="\/index\.html#pricing"/g, 'href="/pages/index.html#pricing"');
    
    // Replace href="/index.html#community" -> href="/pages/index.html#community"
    content = content.replace(/href="\/index\.html#community"/g, 'href="/pages/index.html#community"');

    if (content !== original) {
      fs.writeFileSync(filepath, content);
      console.log('Updated', filepath);
    }
  }
});
