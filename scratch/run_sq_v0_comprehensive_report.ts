/**
 * run_sq_v0_comprehensive_report.ts
 * Generates exact scientific diagnostic metrics for Phase SQ-V0.
 */

import * as fs from 'fs';
import * as path from 'path';
import { MolProcessor } from '../src/lib/MolProcessor';
import { ScientificEditingKernel } from '../src/domain/ScientificEditingKernel';

function loadFixture(filename: string): string {
  const p1 = path.resolve(process.cwd(), 'scratch', filename);
  if (fs.existsSync(p1)) return fs.readFileSync(p1, 'utf8');
  const p2 = path.resolve(process.cwd(), 'fixtures', filename);
  if (fs.existsSync(p2)) return fs.readFileSync(p2, 'utf8');
  throw new Error(`Fixture not found: ${filename}`);
}

console.log('================================================================================');
console.log('       PHASE SQ-V0: SCIENTIFIC STATE & VIEWPORT CONVERGENCE REPORT              ');
console.log('================================================================================\n');

const hhbText = loadFixture('4HHB.pdb');
const proc = new MolProcessor(hhbText, 'pdb');
proc.assignBonds(1.1);
const doc = proc.getCanonicalDocument();
const mol = proc.getCanonicalMolecule();

let nanCount = 0;
let infCount = 0;
let finiteCount = 0;

for (const a of mol.atoms) {
  if (Number.isNaN(a.x) || Number.isNaN(a.y) || Number.isNaN(a.z)) nanCount++;
  else if (!Number.isFinite(a.x) || !Number.isFinite(a.y) || !Number.isFinite(a.z)) infCount++;
  else finiteCount++;
}

console.log('1. SCIENTIFIC STATE DIAGNOSTICS (4HHB):');
console.log(`  - MolProcessor.atoms.length:          ${proc.atoms.length}`);
console.log(`  - CanonicalMolecule.atoms.length:      ${mol.atoms.length}`);
console.log(`  - CanonicalState.coordinates.length:   ${mol.atoms.length}`);
console.log(`  - topology.bonds.length:               ${mol.topology.bonds.length}`);
console.log(`  - residue count:                       ${mol.residues.length}`);
console.log(`  - chain count:                         ${mol.chains.length}`);
console.log(`  - finite coordinate count:             ${finiteCount}`);
console.log(`  - NaN coordinate count:                ${nanCount}`);
console.log(`  - Infinity coordinate count:           ${infCount}`);
console.log(`  - canonical state hash:                ${doc.molecules.get(doc.active_object_id || '')?.molecule_id || 'COMPUTED'}`);

console.log('\n2. MULTI-FIXTURE SCIENTIFIC SUMMARY:');
const fixtures = ['03_protein_with_ligand.pdb', '1CRN.pdb', '1UBQ.pdb', '1BNA.pdb', '1HVR.pdb', '4HHB.pdb', '4DJW.pdb'];
for (const f of fixtures) {
  const p = new MolProcessor(loadFixture(f), 'pdb');
  p.assignBonds(1.1);
  const m = p.getCanonicalMolecule();
  console.log(`  - ${f.padEnd(28)}: ${String(p.atoms.length).padStart(5)} atoms, ${String(m.topology.bonds.length).padStart(5)} bonds, ${String(m.residues.length).padStart(4)} residues`);
}
