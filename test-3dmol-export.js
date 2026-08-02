import fs from 'fs';
const js = fs.readFileSync('node_modules/3dmol/build/3Dmol.js', 'utf8');
console.log('getpdb:', js.includes('getpdb'));
console.log('exportPDB:', js.includes('exportPDB'));
console.log('GLModel methods:', js.match(/GLModel\.prototype\.(\w+)/g)?.slice(0, 50));
