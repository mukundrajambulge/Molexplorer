global.window = { navigator: { userAgent: '' } } as any;
global.$3Dmol = { Parsers: { mmtf: () => ({}) } } as any;
import { MolProcessor } from './src/lib/MolProcessor.ts';
async function test() {
  const res = await fetch('https://files.rcsb.org/download/1HVR.pdb');
  const text = await res.text();
  const processor = new MolProcessor(text, 'pdb');
  console.log("Assemblies:", JSON.stringify(processor.assemblies, null, 2));
}
test();
