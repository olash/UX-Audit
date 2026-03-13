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
    
    // Specifically target nav tags if needed, but doing it globally for these specific links 
    // ensures footers and sidebars on sub-pages also don't break.
    content = content.replace(/href="[^"]*(Pricing\.html)[^"]*"/g, 'href="/index.html#pricing"');
    content = content.replace(/href="[^"]*(Community\.html)[^"]*"/g, 'href="/index.html#community"');
    
    // Also remove How it works and Features if they still exist somehow
    // Not strictly needed globally, but just in case
    content = content.replace(/<a[^>]*>(How it works|Features)<\/a>/gi, '');
    content = content.replace(/<li[^>]*>\s*<a[^>]*>(How it works|Features)<\/a>\s*<\/li>/gi, '');

    if (content !== original) {
      fs.writeFileSync(filepath, content);
      console.log('Updated', filepath);
    }
  }
});
