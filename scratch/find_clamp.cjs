const fs = require('fs');
const path = require('path');

function walk(dir) {
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'build', '.gemini'].includes(file)) return;
      walk(fullPath);
    } else if (stat.isFile() && (file.endsWith('.cpp') || file.endsWith('.hpp') || file.endsWith('.h'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('std::clamp')) {
          console.log(`${fullPath}:${idx + 1}: ${line.trim()}`);
        }
      });
    }
  });
}

walk('.');
console.log("Walk complete");
