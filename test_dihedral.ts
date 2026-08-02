import { MolProcessor } from './src/lib/MolProcessor.ts';
import fs from 'fs';
const text = fs.readFileSync('1HVR.pdb', 'utf8');
const $3Dmol = { Parsers: { mmtf: () => [] } };
global.$3Dmol = $3Dmol as any;
const processor = new MolProcessor(text, 'pdb');
// Let's just print phi and psi for first few residues
const residuesList: any[] = [];
// ... wait, I can just copy the quick logic ...
