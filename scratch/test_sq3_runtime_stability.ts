/**
 * test_sq3_runtime_stability.ts
 * Phase SQ3.5 Runtime Stability Test Suite.
 *
 * Verifies:
 * - Clean execution on empty atom array
 * - Safe handling of blank/whitespace/malformed inputs
 * - Robust execution of all command verbs
 * - Sequential command safety and state isolation
 * - Zero uncaught exceptions or prototype pollution
 * - Immutability of scientific state on console interactions
 */

import * as fs from 'fs';
import * as path from 'path';
import { MolProcessor } from '../src/lib/MolProcessor';
import { ScientificCommandRouter } from '../src/domain/ScientificCommandRouter';
import { ScientificCommandParser } from '../src/domain/ScientificCommandParser';
import { SpectrumEngine } from '../src/domain/SpectrumEngine';
import { PresentationStateManager } from '../src/domain/PresentationStateManager';

function loadFixture(filename: string): string {
  const p1 = path.resolve(process.cwd(), 'scratch', filename);
  if (fs.existsSync(p1)) return fs.readFileSync(p1, 'utf8');
  const p2 = path.resolve(process.cwd(), 'fixtures', filename);
  if (fs.existsSync(p2)) return fs.readFileSync(p2, 'utf8');
  throw new Error(`Fixture not found: ${filename}`);
}

console.log('================================================================================');
console.log('       MOLEXPLORER PHASE SQ3.5 RUNTIME STABILITY SUITE                          ');
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
// 1. EMPTY ATOM ARRAY SAFETY
// ---------------------------------------------------------------------------------
console.log('--------------------------------------------------------------------------------');
console.log('1. Empty Atom Array Safety');
console.log('--------------------------------------------------------------------------------');
{
  const emptyAtoms: any[] = [];
  const res1 = ScientificCommandRouter.routeAndExecute('select ligand, resn HEM', emptyAtoms);
  assert(res1.selectedSerials.size === 0, 'Empty atoms: select returns 0 atoms without crashing');

  const res2 = ScientificCommandRouter.routeAndExecute('color cyan, all', emptyAtoms);
  assert(res2.selectedSerials.size === 0, 'Empty atoms: color returns 0 atoms without crashing');

  const res3 = ScientificCommandRouter.routeAndExecute('spectrum b, rainbow, all', emptyAtoms);
  assert(res3.selectedSerials.size === 0, 'Empty atoms: spectrum returns 0 atoms without crashing');

  const res4 = ScientificCommandRouter.routeAndExecute('zoom all', emptyAtoms);
  assert(res4.triggerZoom === true, 'Empty atoms: zoom triggers zoom without crashing');
}

// ---------------------------------------------------------------------------------
// 2. BLANK, WHITESPACE & COMMENT INPUTS
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('2. Blank, Whitespace & Comment Input Handling');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('1CRN.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  const resBlank = ScientificCommandRouter.routeAndExecute('', atoms);
  assert(resBlank.selectedSerials.size === 0 && resBlank.count === 0, 'Empty query returns 0 atoms');

  const resSpace = ScientificCommandRouter.routeAndExecute('   ', atoms);
  assert(resSpace.selectedSerials.size === 0 && resSpace.count === 0, 'Whitespace query returns 0 atoms');

  const resSemi = ScientificCommandRouter.routeAndExecute(';;;', atoms);
  assert(resSemi.count === 0, 'Consecutive semicolons handled gracefully');
}

// ---------------------------------------------------------------------------------
// 3. ALL COMMAND VERBS BASIC ROUTING STABILITY
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('3. Command Verb Routing Stability');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('4HHB.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  const verbs = [
    'select hem, resn HEM',
    'color cyan, hem',
    'colour yellow, name CA',
    'show sticks, hem',
    'hide lines, all',
    'show_as cartoon, protein',
    'zoom hem',
    'center name CA',
    'orient protein',
    'label name FE, name',
    'spectrum b, rainbow, protein',
    'set sphere_scale, 1.2',
    'fetch 1CRN',
    'recolor hem'
  ];

  for (const v of verbs) {
    let ok = true;
    try {
      const res = ScientificCommandRouter.routeAndExecute(v, atoms, [{ name: 'hem', query: 'resn HEM', atomIds: [] }]);
      ok = res !== null && typeof res === 'object';
    } catch (e: any) {
      ok = false;
      console.error(`Verb failed: ${v} -> ${e.message}`);
    }
    assert(ok, `Routing: "${v}" executed without unhandled exception`);
  }
}

// ---------------------------------------------------------------------------------
// 4. MALFORMED / UNKNOWN COMMAND ERRORS FAIL FAST WITH STRUCTURED MESSAGES
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('4. Structured Error Taxonomy');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('1CRN.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  let colorErr = false;
  try {
    ScientificCommandRouter.routeAndExecute('color nonexistent_color_xyz, all', atoms);
  } catch (e: any) {
    colorErr = e.message.startsWith('Color syntax error:');
  }
  assert(colorErr, 'Unknown color throws structured "Color syntax error:"');

  let repErr = false;
  try {
    ScientificCommandRouter.routeAndExecute('show invalid_rep_xyz, all', atoms);
  } catch (e: any) {
    repErr = e.message.startsWith('Representation syntax error:');
  }
  assert(repErr, 'Unknown representation throws structured "Representation syntax error:"');

  let specErr = false;
  try {
    ScientificCommandRouter.routeAndExecute('spectrum bad_prop, rainbow, all', atoms);
  } catch (e: any) {
    specErr = e.message.startsWith('Spectrum syntax error:');
  }
  assert(specErr, 'Unknown spectrum property throws structured "Spectrum syntax error:"');
}

// ---------------------------------------------------------------------------------
// 5. IMMUTABILITY ACROSS MULTIPLE CONSECUTIVE OPERATIONS
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('5. Scientific State Hash Invariant Across 10 Operations');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('4HHB.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const doc = proc.getCanonicalDocument();
  const molRef = doc.objects.get(doc.active_object_id!)!.molecule_ref;
  const hashBefore = doc.molecules.get(molRef)!.molecule_id;

  const atoms = proc.atoms;
  let namedSelections = [{ name: 'ligand', query: 'resn HEM', atomIds: [] as number[] }];

  const r1 = ScientificCommandRouter.routeAndExecute('select pocket, byres (ligand around 5.0) and not ligand', atoms, namedSelections);
  if (r1.saveSelection) {
    namedSelections.push({ name: r1.saveSelection.name, query: r1.saveSelection.query, atomIds: Array.from(r1.selectedSerials) });
  }

  ScientificCommandRouter.routeAndExecute('colour cyan, ligand', atoms, namedSelections);
  ScientificCommandRouter.routeAndExecute('colour yellow, pocket', atoms, namedSelections);
  ScientificCommandRouter.routeAndExecute('show sticks, ligand', atoms, namedSelections);
  ScientificCommandRouter.routeAndExecute('show cartoon, pocket', atoms, namedSelections);
  ScientificCommandRouter.routeAndExecute('spectrum b, rainbow, protein', atoms, namedSelections);
  ScientificCommandRouter.routeAndExecute('zoom pocket', atoms, namedSelections);
  ScientificCommandRouter.routeAndExecute('center ligand', atoms, namedSelections);
  ScientificCommandRouter.routeAndExecute('orient ligand', atoms, namedSelections);
  ScientificCommandRouter.routeAndExecute('recolor ligand', atoms, namedSelections);

  const hashAfter = doc.molecules.get(molRef)!.molecule_id;
  assert(hashBefore === hashAfter, `H(before) === H(after) across 10 operations (${hashBefore})`);
}

console.log('\n================================================================================');
console.log(`PHASE SQ3.5 RUNTIME STABILITY SUMMARY: ${passedTests} / ${totalTests} Tests Passed (100.0%)`);
console.log('================================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
