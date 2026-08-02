import fs from 'fs';
const js = fs.readFileSync('node_modules/3dmol/build/3Dmol.js', 'utf8');
console.log('bgcolor config:', js.includes('backgroundColor'));
