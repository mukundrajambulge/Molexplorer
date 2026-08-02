import { JSDOM } from 'jsdom';
const dom = new JSDOM();
global.window = dom.window as any;
global.document = dom.window.document as any;
global.navigator = dom.window.navigator;

import { MolProcessor } from './src/lib/MolProcessor.ts';
async function test() {
  const res = await fetch('https://files.rcsb.org/download/1HVR.pdb');
  const text = await res.text();
  const processor = new MolProcessor(text, 'pdb');
  processor.calculateSecondaryStructure('pdb');
  const sheets = processor.ss_per_residue.filter(r => r.ss_type === 'sheet').slice(0, 5);
  const helices = processor.ss_per_residue.filter(r => r.ss_type === 'helix').slice(0, 5);
  console.log("Sheets:", sheets);
  console.log("Helices:", helices);
}
test();
