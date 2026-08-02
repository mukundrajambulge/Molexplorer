import fs from 'fs';
global.window = { navigator: { userAgent: "Node" } } as any;
import { MolProcessor } from './src/lib/MolProcessor.ts';
const text = fs.readFileSync("1HVR.pdb", "utf-8");
const p = new MolProcessor(text, "pdb");
console.log("SMTRY count:", p.symmetry_matrices.length);
console.log("BIOMT assemblies:", p.assemblies.length);
if (p.assemblies.length > 0) {
  console.log("BIOMT matrices:", p.assemblies[0].operations[0].matrices.length);
}
