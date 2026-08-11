const fs = require('fs');
const path = require('path');

function searchInDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (['node_modules', '.git', 'dist', 'build'].includes(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      searchInDir(fullPath);
    } else if (entry.isFile()) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('Rajambulge') || content.includes('Mukund Raj')) {
          console.log('Found in:', fullPath);
        }
      } catch (e) {}
    }
  }
}

searchInDir('.');
