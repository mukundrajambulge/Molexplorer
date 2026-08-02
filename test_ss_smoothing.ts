import fs from 'fs';
import { MolProcessor } from './src/lib/MolProcessor.ts';
// @ts-ignore
global.window = {} as any;
const p = new MolProcessor(fs.readFileSync("1HVR.pdb", "utf-8"));
p.calculateSecondaryStructure('quick');
const runs: any[] = [];
let currentRun: any = null;
p.ss_per_residue.forEach(r => {
   if (!currentRun || currentRun.type !== r.ss_type || currentRun.chain !== r.chainID) {
       if (currentRun) runs.push(currentRun);
       currentRun = { type: r.ss_type, chain: r.chainID, residues: [r] };
   } else {
       currentRun.residues.push(r);
   }
});
if (currentRun) runs.push(currentRun);
console.log(runs.map(r => `${r.chain}:${r.type}:${r.residues.length}`).join(", "));
