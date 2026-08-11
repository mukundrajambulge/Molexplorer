const fs = require('fs');
const content = fs.readFileSync('src/components/LibraryTable.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('custom-scrollbar') || line.includes('overflow')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
