import { MolProcessor } from './src/lib/MolProcessor.ts';
import fs from 'fs';
const text = fs.readFileSync('1HVR.pdb', 'utf8');
const $3Dmol = { Parsers: { mmtf: () => [] } };
global.$3Dmol = $3Dmol as any;
const processor = new MolProcessor(text, 'pdb');
console.log("Assemblies length:", processor.assemblies.length);
if (processor.assemblies.length > 0) {
    console.log("Operations length:", processor.assemblies[0].operations.length);
}
