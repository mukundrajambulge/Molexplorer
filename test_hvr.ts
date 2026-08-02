import './test_hvr2';
import { MolProcessor } from './src/lib/MolProcessor';

async function test() {
   const res = await fetch('https://files.rcsb.org/download/1HVR.pdb');
   const text = await res.text();
   const proc = new MolProcessor(text, 'pdb');
   proc.calculateSecondaryStructure('pdb');
   console.log('atoms:', proc.atoms.length);
   console.log('ss len:', proc.ss_per_residue.length);
   console.log('pdb_ss_records len:', proc.pdb_ss_records.length);
   console.log('hasCryst1:', proc.hasCryst1);
   console.log('assemblies:', proc.assemblies.length);
}
test();
