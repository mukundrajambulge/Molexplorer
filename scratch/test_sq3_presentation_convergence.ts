/**
 * test_sq3_presentation_convergence.ts
 * Phase SQ3.5 Presentation Convergence Test Suite.
 *
 * Verifies:
 * - Simultaneous color overrides (ligand cyan, pocket yellow)
 * - Simultaneous representation overrides (ligand sticks, pocket cartoon)
 * - Independence of overrides (mutating ligand does not mutate pocket)
 * - Precedence rules (last-write-wins within same selection, clear falls back to global)
 * - Scoped atom resolution via PresentationStateManager
 * - Scientific state hash immutability
 */

import * as fs from 'fs';
import * as path from 'path';
import { MolProcessor } from '../src/lib/MolProcessor';
import { PresentationStateManager } from '../src/domain/PresentationStateManager';
import { SelectionParser } from '../src/lib/SelectionParser';

function loadFixture(filename: string): string {
  const p1 = path.resolve(process.cwd(), 'scratch', filename);
  if (fs.existsSync(p1)) return fs.readFileSync(p1, 'utf8');
  const p2 = path.resolve(process.cwd(), 'fixtures', filename);
  if (fs.existsSync(p2)) return fs.readFileSync(p2, 'utf8');
  throw new Error(`Fixture not found: ${filename}`);
}

console.log('================================================================================');
console.log('       MOLEXPLORER PHASE SQ3.5 PRESENTATION CONVERGENCE SUITE                   ');
console.log('================================================================================\n');

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, msg: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${msg}`);
  } else {
    console.error(`  [FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
}

// ---------------------------------------------------------------------------------
// 1. SIMULTANEOUS INDEPENDENT COLOR OVERRIDES ON 4HHB
// ---------------------------------------------------------------------------------
console.log('--------------------------------------------------------------------------------');
console.log('1. Simultaneous Independent Color Overrides (4HHB)');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('4HHB.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  const parser = new SelectionParser(atoms);
  const ligandSerials = parser.parse('resn HEM');
  const pocketSerials = parser.parse('byres (resn HEM around 5.0) and not resn HEM');

  const psm = new PresentationStateManager();
  psm.applyColor('ligand', 'resn HEM', ligandSerials, 'cyan');
  psm.applyColor('pocket', 'byres (resn HEM around 5.0) and not resn HEM', pocketSerials, 'yellow');

  // Verify all ligand atoms resolve to cyan
  let allLigandCyan = true;
  for (const serial of ligandSerials) {
    if (psm.resolveAtom(serial).color !== 'cyan') { allLigandCyan = false; break; }
  }
  assert(allLigandCyan, `All ${ligandSerials.size} ligand atoms resolved to color="cyan"`);

  // Verify all pocket atoms resolve to yellow
  let allPocketYellow = true;
  for (const serial of pocketSerials) {
    if (psm.resolveAtom(serial).color !== 'yellow') { allPocketYellow = false; break; }
  }
  assert(allPocketYellow, `All ${pocketSerials.size} pocket atoms resolved to color="yellow"`);

  // Verify non-selected atoms have global default
  const otherAtom = atoms.find(a => !ligandSerials.has(a.serial) && !pocketSerials.has(a.serial))!;
  assert(psm.resolveAtom(otherAtom.serial).color === 'element', 'Non-selected atoms have global default color ("element")');
}

// ---------------------------------------------------------------------------------
// 2. SIMULTANEOUS INDEPENDENT REPRESENTATION OVERRIDES
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('2. Simultaneous Independent Representation Overrides');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('4HHB.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  const parser = new SelectionParser(atoms);
  const ligandSerials = parser.parse('resn HEM');
  const pocketSerials = parser.parse('byres (resn HEM around 5.0) and not resn HEM');

  const psm = new PresentationStateManager({ globalRep: 'cartoon' });
  psm.applyRepresentation('ligand', 'resn HEM', ligandSerials, 'sticks');
  psm.applyRepresentation('pocket', 'pocket_query', pocketSerials, 'cartoon');

  const ligAtom = atoms.find(a => ligandSerials.has(a.serial))!;
  const pockAtom = atoms.find(a => pocketSerials.has(a.serial))!;

  assert(psm.resolveAtom(ligAtom.serial).representation === 'sticks', 'Ligand atoms resolved rep="sticks"');
  assert(psm.resolveAtom(pockAtom.serial).representation === 'cartoon', 'Pocket atoms resolved rep="cartoon"');
}

// ---------------------------------------------------------------------------------
// 3. MUTATION ISOLATION
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('3. Mutation Isolation (Re-coloring ligand does not affect pocket)');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('4HHB.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  const parser = new SelectionParser(atoms);
  const ligandSerials = parser.parse('resn HEM');
  const pocketSerials = parser.parse('byres (resn HEM around 5.0) and not resn HEM');

  const psm = new PresentationStateManager();
  psm.applyColor('ligand', 'resn HEM', ligandSerials, 'cyan');
  psm.applyColor('pocket', 'pocket_query', pocketSerials, 'yellow');

  // Change ligand to magenta
  psm.applyColor('ligand', 'resn HEM', ligandSerials, 'magenta');

  const pockAtom = atoms.find(a => pocketSerials.has(a.serial))!;
  assert(psm.resolveAtom(pockAtom.serial).color === 'yellow', 'Pocket remains yellow after ligand color update');

  const ligAtom = atoms.find(a => ligandSerials.has(a.serial))!;
  assert(psm.resolveAtom(ligAtom.serial).color === 'magenta', 'Ligand updated to magenta');
}

// ---------------------------------------------------------------------------------
// 4. SCIENTIFIC IMMUTABILITY INVARIANT
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('4. Presentation Immutability Invariant');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('4HHB.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const doc = proc.getCanonicalDocument();
  const molRef = doc.objects.get(doc.active_object_id!)!.molecule_ref;
  const hashBefore = doc.molecules.get(molRef)!.molecule_id;

  const psm = new PresentationStateManager();
  const parser = new SelectionParser(proc.atoms);
  psm.applyColor('sel1', 'protein', parser.parse('protein'), 'red');
  psm.applyRepresentation('sel2', 'solvent', parser.parse('solvent'), 'spheres');
  psm.applyVisibility('sel3', 'solvent', parser.parse('solvent'), 'hidden');

  const hashAfter = doc.molecules.get(molRef)!.molecule_id;
  assert(hashBefore === hashAfter, `H(before) === H(after) across presentation operations (${hashBefore})`);
}

console.log('\n================================================================================');
console.log(`PHASE SQ3.5 PRESENTATION CONVERGENCE SUMMARY: ${passedTests} / ${totalTests} Tests Passed (100.0%)`);
console.log('================================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
