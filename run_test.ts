import './test_real2';
import { MolProcessor } from './src/lib/MolProcessor';

async function test() {
  const res = await fetch('https://files.rcsb.org/download/1HVR.pdb');
  const text = await res.text();
  const processor = new MolProcessor(text, 'pdb');
  processor.calculateSecondaryStructure('pdb');
  
  const ssData = processor.ss_per_residue;
  const filtered = ssData.filter(d => d.chainID === 'A' && (d.ss_type === 'helix' || d.ss_type === 'sheet'));
  console.log('Filtered length:', filtered.length);
  console.log('REMARK 350 assemblies:', processor.assemblies.length);
  console.log('CRYST1 hasCryst1:', processor.hasCryst1);
}
test();
