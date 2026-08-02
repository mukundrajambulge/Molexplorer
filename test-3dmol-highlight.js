import fs from 'fs';
const js = fs.readFileSync('node_modules/3dmol/build/3Dmol.js', 'utf8');
console.log('setStyle:', js.includes('setStyle'));
console.log('addStyle:', js.includes('addStyle'));
