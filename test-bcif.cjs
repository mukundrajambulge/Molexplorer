const fs = require('fs');
let file = fs.readFileSync('node_modules/3dmol/build/3Dmol-min.js', 'utf8');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;
eval(file);
const https = require('https');
https.get('https://models.rcsb.org/v1/1crn/full?encoding=bcif', (res) => {
  let chunks = [];
  res.on('data', c => chunks.push(c));
  res.on('end', () => {
    let buf = Buffer.concat(chunks);
    let arr = new Uint8Array(buf);
    let atoms = window.$3Dmol.Parsers.mmtf(arr, {});
    console.log("Atom count:", atoms[0].length);
  });
});
