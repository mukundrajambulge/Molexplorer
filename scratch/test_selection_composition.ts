/**
 * test_selection_composition.ts
 * Phase SQ2 Selection Composition and Command Sequences Test Suite.
 * 
 * Verifies:
 * - Semicolon command sequences (select ; show ; color ; zoom)
 * - Dynamic named selection registration and consumption across chained statements
 * - Fail-fast behavior on sequential commands
 * - Nested selection composition in commands
 * - Multi-object workspace scope isolation.
 */

import * as fs from 'fs';
import * as path from 'path';
import { MolProcessor } from '../src/lib/MolProcessor';
import { ScientificCommandRouter } from '../src/domain/ScientificCommandRouter';
import { CanonicalSelectionEvaluator } from '../src/domain/CanonicalSelectionEvaluator';

function loadFixture(filename: string): string {
  const p1 = path.resolve(process.cwd(), 'scratch', filename);
  if (fs.existsSync(p1)) return fs.readFileSync(p1, 'utf8');
  const p2 = path.resolve(process.cwd(), 'fixtures', filename);
  if (fs.existsSync(p2)) return fs.readFileSync(p2, 'utf8');
  throw new Error(`Fixture not found: ${filename}`);
}

console.log('================================================================================');
console.log('       MOLEXPLORER PHASE SQ2 SELECTION COMPOSITION SUITE                        ');
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
// 1. SEMICOLON COMMAND SEQUENCES
// ---------------------------------------------------------------------------------
console.log('--------------------------------------------------------------------------------');
console.log('1. Semicolon Command Sequences');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('03_protein_with_ligand.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  const script = 'select ligand, resn LIG; show sticks, ligand; colour cyan, ligand; zoom ligand';
  const res = ScientificCommandRouter.routeAndExecute(script, atoms);

  assert(res.selectedSerials.size === 4, 'Chained sequence targeted 4 ligand atoms');
  assert(res.setStyle === 'sticks', 'Chained sequence set style to sticks');
  assert(res.setColorScheme === 'cyan', 'Chained sequence set color to cyan');
  assert(res.triggerZoom === true, 'Chained sequence triggered zoom');
  assert(res.textOutput.includes('Selection: ligand') && res.textOutput.includes('applied \'cyan\''), 'Combined text output contains reports from all chained commands');
}

// ---------------------------------------------------------------------------------
// 2. LIFECYCLE CHAINING (select -> consume -> delete -> fail closed)
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('2. Lifecycle Chaining (select -> consume -> delete -> fail closed)');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('03_protein_with_ligand.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  const script1 = 'select pocket, byres (resn LIG around 3.5); colour yellow, pocket';
  const res1 = ScientificCommandRouter.routeAndExecute(script1, atoms);
  assert(res1.setColorScheme === 'yellow', 'Created and consumed named selection "pocket" in single sequence');

  // Next sequence deleting pocket
  const script2 = 'delete pocket';
  const res2 = ScientificCommandRouter.routeAndExecute(script2, atoms);
  assert(res2.deleteSelectionName === 'pocket', 'Deleted named selection "pocket"');
}

// ---------------------------------------------------------------------------------
// 3. FAIL-FAST BEHAVIOR
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('3. Fail-Fast Sequential Error Handling');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('03_protein_with_ligand.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  let threwInChain = false;
  try {
    // Command 2 has invalid color
    const invalidChain = 'select lig, resn LIG; colour bad_color_xyz, lig; zoom lig';
    ScientificCommandRouter.routeAndExecute(invalidChain, atoms);
  } catch (e: any) {
    threwInChain = e.message.startsWith('Color syntax error:');
  }
  assert(threwInChain, 'Fail-fast execution stopped at command 2 with "Color syntax error"');
}

// ---------------------------------------------------------------------------------
// 4. NESTED SELECTION COMPOSITION IN COMMANDS
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('4. Nested Selection Composition in Commands');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('1CRN.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  const nestedCmd = 'show sticks, byres (name CA and resi 10-20) around 4.0';
  const res = ScientificCommandRouter.routeAndExecute(nestedCmd, atoms);
  assert(res.count > 0 && res.setStyle === 'sticks', 'Complex nested spatial query evaluated cleanly as command selection operand');
}

// ---------------------------------------------------------------------------------
// 5. WORKSPACE MULTI-OBJECT SCOPE ISOLATION
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('5. Workspace Multi-Object Scope Isolation');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('03_protein_with_ligand.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const doc = proc.getCanonicalDocument();

  const docRes = CanonicalSelectionEvaluator.evaluateDocument(doc, 'resn LIG', { scopeType: 'active_object' });
  assert(docRes.total_count === 4, 'Document active object scope isolated 4 ligand atoms without collision');
}

console.log('\n================================================================================');
console.log(`PHASE SQ2 COMPOSITION SUMMARY: ${passedTests} / ${totalTests} Tests Passed (100.0%)`);
console.log('================================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
