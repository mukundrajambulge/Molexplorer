const fs = require('fs');
let content = fs.readFileSync('src/pages/MolExplorer.tsx', 'utf8');
const target = `} else if (m.rawContent && m.rawContent.split("$$$$").length > 2) {`;
const replacement = `} else if (typeof m.rawContent === "string" && m.rawContent.split("$$$$").length > 2) {`;
fs.writeFileSync('src/pages/MolExplorer.tsx', content.replace(target, replacement));
