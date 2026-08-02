import { JSDOM } from 'jsdom';
const dom = new JSDOM();
global.window = dom.window as any;
global.document = dom.window.document as any;
global.navigator = dom.window.navigator;

import fs from 'fs';
const text = fs.readFileSync('1HVR.pdb', 'utf8');

import * as $3Dmol from '3dmol';

const viewer = $3Dmol.createViewer(dom.window.document.createElement('div'));
const m = viewer.addModel(text, 'pdb');
const atoms = m.selectedAtoms({});

const a = atoms.find(atom => atom.resi === 86 && atom.chain === 'A' && atom.atom === 'CA');
console.log("Found atom:", a ? `${a.chain}:${a.resi} ss=${a.ss} ssbegin=${a.ssbegin} ssend=${a.ssend}` : "No atom");
