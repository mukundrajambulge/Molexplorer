import fs from 'fs';
import { MolProcessor } from './src/lib/MolProcessor.ts';
// @ts-ignore
global.window = {} as any;
const text = fs.readFileSync("1HVR.pdb", "utf-8");
const p = new MolProcessor(text, "pdb");
console.log(p.assemblies.map(a => {
  const allIdentity = a.operations.every(op => op.matrices.every(mat => {
    return Math.abs(mat.r[0][0]-1)<1e-4 && Math.abs(mat.r[1][1]-1)<1e-4 && Math.abs(mat.r[2][2]-1)<1e-4 && Math.abs(mat.t[0])<1e-4 && Math.abs(mat.t[1])<1e-4 && Math.abs(mat.t[2])<1e-4;
  }));
  return { id: a.id, allIdentity };
}));
