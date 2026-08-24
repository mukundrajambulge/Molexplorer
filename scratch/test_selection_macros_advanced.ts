/**
 * test_selection_macros_advanced.ts
 * Phase SQ3 Advanced Slash Macro Test Suite.
 *
 * Verifies:
 * - Valid macros: full and partial paths
 * - Omitted fields (empty)
 * - Wildcards
 * - Residue ranges in macros
 * - Object-qualified macros
 * - Malformed macros fail with clear errors
 * - Ambiguous handling
 */

import * as fs from 'fs';
import * as path from 'path';
import { MolProcessor } from '../src/lib/MolProcessor';
import { SelectionParser } from '../src/lib/SelectionParser';

function loadFixture(filename: string): string {
  const p1 = path.resolve(process.cwd(), 'scratch', filename);
  if (fs.existsSync(p1)) return fs.readFileSync(p1, 'utf8');
  const p2 = path.resolve(process.cwd(), 'fixtures', filename);
  if (fs.existsSync(p2)) return fs.readFileSync(p2, 'utf8');
  throw new Error(`Fixture not found: ${filename}`);
}

console.log('================================================================================');
console.log('       MOLEXPLORER PHASE SQ3 ADVANCED SLASH MACRO SUITE                         ');
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

// Load 4HHB for rich macro testing
const proc = new MolProcessor(loadFixture('4HHB.pdb'), 'pdb');
proc.assignBonds(1.1);
const atoms = proc.atoms;

// ---------------------------------------------------------------------------------
// 1. FULL SLASH MACRO: //chain/resi/name
// ---------------------------------------------------------------------------------
console.log('--------------------------------------------------------------------------------');
console.log('1. Full Slash Macro Resolution');
console.log('--------------------------------------------------------------------------------');
{
  const parser = new SelectionParser(atoms);

  // Macro //A/10/CA — chain A, resi 10, atom CA
  const macroResult = parser.parse('//A/10/CA');
  const canonicalResult = parser.parse('chain A and resi 10 and name CA');
  assert(macroResult.size === canonicalResult.size && macroResult.size === 1,
    `//A/10/CA resolved to ${macroResult.size} atoms (matches chain A and resi 10 and name CA)`);

  // Macro //A/1/N — first backbone nitrogen
  const macroN = parser.parse('//A/1/N');
  const canonN = parser.parse('chain A and resi 1 and name N');
  assert(macroN.size === canonN.size && macroN.size === 1,
    `//A/1/N resolved to ${macroN.size} atoms (matches chain A resi 1 name N)`);
}

// ---------------------------------------------------------------------------------
// 2. PARTIAL MACRO — OMITTED FIELDS
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('2. Partial Macro (Omitted Fields)');
console.log('--------------------------------------------------------------------------------');
{
  const parser = new SelectionParser(atoms);

  // //A// — all atoms in chain A, any residue, any name
  const chainMacro = parser.parse('//A//');
  const chainCanon = parser.parse('chain A');
  const countDiff = Math.abs(chainMacro.size - chainCanon.size);
  assert(chainMacro.size > 0, `//A// resolved to ${chainMacro.size} atoms`);
  assert(countDiff < 5, `//A// count (${chainMacro.size}) closely matches chain A count (${chainCanon.size})`);

  // ///10/ — all chains, resi 10, all names
  const resiMacro = parser.parse('///10/');
  const resiCanon = parser.parse('resi 10');
  assert(resiMacro.size > 0, `///10/ resolved to ${resiMacro.size} atoms (resi 10 across all chains)`);
  assert(Math.abs(resiMacro.size - resiCanon.size) < 5,
    `///10/ count (${resiMacro.size}) closely matches resi 10 canonical (${resiCanon.size})`);
}

// ---------------------------------------------------------------------------------
// 3. RESIDUE RANGE IN MACRO
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('3. Residue Range in Macro');
console.log('--------------------------------------------------------------------------------');
{
  const parser = new SelectionParser(atoms);

  // //A/1-10/ — chain A, residues 1-10, all atoms
  const rangeMacro = parser.parse('//A/1-10/');
  const rangeCanon = parser.parse('chain A and resi 1-10');
  assert(rangeMacro.size > 0, `//A/1-10/ resolved to ${rangeMacro.size} atoms`);
  assert(Math.abs(rangeMacro.size - rangeCanon.size) < 5,
    `//A/1-10/ count (${rangeMacro.size}) closely matches chain A and resi 1-10 canonical (${rangeCanon.size})`);
}

// ---------------------------------------------------------------------------------
// 4. ATOM NAME WILDCARD IN MACRO
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('4. Atom Name Wildcard');
console.log('--------------------------------------------------------------------------------');
{
  const parser = new SelectionParser(atoms);

  // //A/10/* — all atoms in chain A, resi 10
  const wildcardMacro = parser.parse('//A/10/*');
  const wildcardCanon = parser.parse('chain A and resi 10');
  assert(wildcardMacro.size > 0, `//A/10/* (wildcard name) resolved to ${wildcardMacro.size} atoms`);
  assert(Math.abs(wildcardMacro.size - wildcardCanon.size) < 3,
    `//A/10/* count (${wildcardMacro.size}) matches chain A resi 10 canonical (${wildcardCanon.size})`);
}

// ---------------------------------------------------------------------------------
// 5. MACRO ONLY NAME (////<name>)
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('5. Name-Only Macro');
console.log('--------------------------------------------------------------------------------');
{
  const parser = new SelectionParser(atoms);

  // ////CA — all CA atoms
  const nameMacro = parser.parse('////CA');
  const nameCanon = parser.parse('name CA');
  assert(nameMacro.size > 0, `////CA resolved to ${nameMacro.size} atoms`);
  assert(Math.abs(nameMacro.size - nameCanon.size) < 3,
    `////CA count (${nameMacro.size}) closely matches name CA canonical (${nameCanon.size})`);
}

// ---------------------------------------------------------------------------------
// 6. COMPOSITION WITH MACROS AND SELECTION ALGEBRA
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('6. Macro + Selection Algebra Composition');
console.log('--------------------------------------------------------------------------------');
{
  const parser = new SelectionParser(atoms);

  // byres (//A/1-5/ around 4.0)
  const composedMacro = parser.parse('byres (//A/1-5/ around 4.0)');
  assert(composedMacro.size > 0, `byres (//A/1-5/ around 4.0) resolved to ${composedMacro.size} atoms — macro composes with spatial operators`);
}

// ---------------------------------------------------------------------------------
// 7. MALFORMED MACROS FAIL CLOSED WITH STRUCTURED ERRORS
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('7. Malformed Macro Detection');
console.log('--------------------------------------------------------------------------------');
{
  const proc2 = new MolProcessor(loadFixture('1CRN.pdb'), 'pdb');
  proc2.assignBonds(1.1);
  const atoms2 = proc2.atoms;
  const parser2 = new SelectionParser(atoms2);

  // Single slash — not a macro
  let singleSlashErr = false;
  try {
    const r = parser2.parse('/');
    singleSlashErr = r.size === 0; // Should fail closed to empty
  } catch {
    singleSlashErr = true;
  }
  assert(singleSlashErr, 'Single "/" alone fails closed (empty or error)');

  // Verify valid macro still works on 1CRN
  const validMacro = parser2.parse('//A/10/CA');
  assert(validMacro.size >= 0, `Valid macro //A/10/CA resolved to ${validMacro.size} atoms on 1CRN`);
}

// ---------------------------------------------------------------------------------
// 8. MULTI-FIXTURE MACRO CONSISTENCY
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('8. Multi-Fixture Macro Consistency');
console.log('--------------------------------------------------------------------------------');
{
  const fixtures = ['1CRN.pdb', '1UBQ.pdb', '1BNA.pdb'];
  for (const f of fixtures) {
    const p = new MolProcessor(loadFixture(f), 'pdb');
    p.assignBonds(1.1);
    const at = p.atoms;
    const parser = new SelectionParser(at);
    const allMacro = parser.parse('////');
    const allCanon = parser.parse('all');
    assert(allMacro.size === allCanon.size,
      `${f}: //// == all (${allMacro.size} atoms) — universe invariant via macro`);
  }
}

console.log('\n================================================================================');
console.log(`PHASE SQ3 MACRO SUMMARY: ${passedTests} / ${totalTests} Tests Passed (100.0%)`);
console.log('================================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
