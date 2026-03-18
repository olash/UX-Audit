const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    fs.statSync(dirPath).isDirectory() ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

const targetHtml = 'href="/pages/Labs.html"';

walkDir('./frontend', (filepath) => {
  if (filepath.endsWith('.html')) {
    let content = fs.readFileSync(filepath, 'utf8');
    let original = content;

    // Check if Labs.html is already mostly added except this script
    // To be safe we only add it if the specific text-sm class string is missing 
    // or if the link is completely absent. Wait, Labs.html (the file itself) has it!
    // But we don't want to duplicate it inside Labs.html since we hardcoded it!
    
    if (filepath.includes('Labs.html')) {
       return; // we manually added the nav to Labs.html
    }

    if (!content.includes(targetHtml)) {
        // Replace globally inside this file
        content = content.replace(
            /(<a href="\/pages\/blog\.html"[^>]*>Blog<\/a>)/g,
            '$1\n                    <a href="/pages/Labs.html" class="text-sm font-medium text-slate-600 hover:text-slate-900">Labs</a>'
        );
    }
    
    if (content !== original) {
      fs.writeFileSync(filepath, content);
      console.log('Updated', filepath);
    }
  }
});
