/**
 * test_sq3_camera_convergence.ts
 * Phase SQ3.5 Camera Convergence Test Suite.
 *
 * Verifies:
 * - Distinct camera operations: zoom, center, orient
 * - triggerZoom flag set for all camera commands
 * - Degenerate selection handling (empty selection returns 0 atoms gracefully)
 * - Read-only scientific state invariant
 */

import * as fs from 'fs';
import * as path from 'path';
import { MolProcessor } from '../src/lib/MolProcessor';
import { ScientificCommandRouter } from '../src/domain/ScientificCommandRouter';

function loadFixture(filename: string): string {
  const p1 = path.resolve(process.cwd(), 'scratch', filename);
  if (fs.existsSync(p1)) return fs.readFileSync(p1, 'utf8');
  const p2 = path.resolve(process.cwd(), 'fixtures', filename);
  if (fs.existsSync(p2)) return fs.readFileSync(p2, 'utf8');
  throw new Error(`Fixture not found: ${filename}`);
}

console.log('================================================================================');
console.log('       MOLEXPLORER PHASE SQ3.5 CAMERA CONVERGENCE SUITE                         ');
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
// 1. DISTINCT CAMERA OPERATIONS ON 4HHB
// ---------------------------------------------------------------------------------
console.log('--------------------------------------------------------------------------------');
console.log('1. Distinct Camera Operations (4HHB)');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('4HHB.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  const namedSelections = [
    { name: 'ligand', query: 'resn HEM', atomIds: [] },
    { name: 'pocket', query: 'byres (resn HEM around 5.0) and not resn HEM', atomIds: [] }
  ];

  // zoom
  const zoomRes = ScientificCommandRouter.routeAndExecute('zoom pocket', atoms, namedSelections);
  assert(zoomRes.cameraOperation === 'zoom', 'zoom produces cameraOperation="zoom"');
  assert(zoomRes.triggerZoom === true, 'zoom sets triggerZoom=true');
  assert(zoomRes.selectedSerials.size > 0, `zoom targeted ${zoomRes.selectedSerials.size} pocket atoms`);
  assert(zoomRes.textOutput.startsWith('zoom:'), `zoom textOutput: "${zoomRes.textOutput}"`);

  // center
  const centerRes = ScientificCommandRouter.routeAndExecute('center ligand', atoms, namedSelections);
  assert(centerRes.cameraOperation === 'center', 'center produces cameraOperation="center"');
  assert(centerRes.triggerZoom === true, 'center sets triggerZoom=true');
  assert(centerRes.selectedSerials.size > 0, `center targeted ${centerRes.selectedSerials.size} ligand atoms`);
  assert(centerRes.textOutput.startsWith('center:'), `center textOutput: "${centerRes.textOutput}"`);

  // orient
  const orientRes = ScientificCommandRouter.routeAndExecute('orient ligand', atoms, namedSelections);
  assert(orientRes.cameraOperation === 'orient', 'orient produces cameraOperation="orient"');
  assert(orientRes.triggerZoom === true, 'orient sets triggerZoom=true');
  assert(orientRes.selectedSerials.size > 0, `orient targeted ${orientRes.selectedSerials.size} ligand atoms`);
  assert(orientRes.textOutput.startsWith('orient:'), `orient textOutput: "${orientRes.textOutput}"`);
}

// ---------------------------------------------------------------------------------
// 2. DEGENERATE SELECTION HANDLING
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('2. Degenerate Selection Handling (Empty / Non-Existent Target)');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('1CRN.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  const emptyZoom = ScientificCommandRouter.routeAndExecute('zoom resn NONEXISTENT', atoms);
  assert(emptyZoom.count === 0, 'zoom non-existent target returns count=0');
  assert(emptyZoom.triggerZoom === true, 'zoom non-existent target still triggers focus safely');

  const emptyCenter = ScientificCommandRouter.routeAndExecute('center resn NONEXISTENT', atoms);
  assert(emptyCenter.count === 0, 'center non-existent target returns count=0');

  const emptyOrient = ScientificCommandRouter.routeAndExecute('orient resn NONEXISTENT', atoms);
  assert(emptyOrient.count === 0, 'orient non-existent target returns count=0');
}

// ---------------------------------------------------------------------------------
// 3. READ-ONLY SCIENTIFIC INVARIANT
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('3. Camera Scientific Immutability Invariant');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('4HHB.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const doc = proc.getCanonicalDocument();
  const molRef = doc.objects.get(doc.active_object_id!)!.molecule_ref;
  const hashBefore = doc.molecules.get(molRef)!.molecule_id;

  const atoms = proc.atoms;
  ScientificCommandRouter.routeAndExecute('zoom all', atoms);
  ScientificCommandRouter.routeAndExecute('center name CA', atoms);
  ScientificCommandRouter.routeAndExecute('orient protein', atoms);

  const hashAfter = doc.molecules.get(molRef)!.molecule_id;
  assert(hashBefore === hashAfter, `H(before) === H(after) across zoom/center/orient (${hashBefore})`);
}

console.log('\n================================================================================');
console.log(`PHASE SQ3.5 CAMERA CONVERGENCE SUMMARY: ${passedTests} / ${totalTests} Tests Passed (100.0%)`);
console.log('================================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
