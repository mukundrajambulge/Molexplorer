import { MolProcessor } from "./src/lib/MolProcessor";
const p = new MolProcessor("REMARK 350 BIOMOLECULE: 1\n");
console.log(p.assemblies);
