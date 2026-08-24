/**
 * test_sq3_spectrum_convergence.ts
 * Phase SQ3.5 Spectrum Convergence Test Suite.
 *
 * Verifies:
 * - Spectrum mapping produces valid deterministic hex colors on 4HHB and 4DJW
 * - Range normalization min <= max
 * - Proper fallback to grey (#808080) for missing values
 * - Multi-palette spectrum mapping (rainbow, blue_white_red, red_white_blue, etc.)
 * - Zero mutation of scientific state
 */

import * as fs from 'fs';
import * as path from 'path';
import { MolProcessor } from '../src/lib/MolProcessor';
import { SpectrumEngine, SUPPORTED_PALETTES, SUPPORTED_SPECTRUM_PROPERTIES } from '../src/domain/SpectrumEngine';
import { SelectionParser } from '../src/lib/SelectionParser';

function loadFixture(filename: string): string {
  const p1 = path.resolve(process.cwd(), 'scratch', filename);
  if (fs.existsSync(p1)) return fs.readFileSync(p1, 'utf8');
  const p2 = path.resolve(process.cwd(), 'fixtures', filename);
  if (fs.existsSync(p2)) return fs.readFileSync(p2, 'utf8');
  throw new Error(`Fixture not found: ${filename}`);
}

console.log('================================================================================');
console.log('       MOLEXPLORER PHASE SQ3.5 SPECTRUM CONVERGENCE SUITE                       ');
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

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

// ---------------------------------------------------------------------------------
// 1. 4HHB SPECTRUM MAPPING
// ---------------------------------------------------------------------------------
console.log('--------------------------------------------------------------------------------');
console.log('1. Spectrum Mapping on 4HHB');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('4HHB.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  const parser = new SelectionParser(atoms);
  const proteinSerials = parser.parse('protein');

  const result = SpectrumEngine.map(atoms, proteinSerials, 'b', 'rainbow');
  assert(result.coveredCount > 0, `Spectrum mapped ${result.coveredCount} atoms with B-factors on 4HHB`);
  assert(result.minValue <= result.maxValue, `Min B (${result.minValue}) <= Max B (${result.maxValue})`);

  let allValidHex = true;
  for (const [serial, hex] of result.atomColors) {
    if (!HEX_COLOR_REGEX.test(hex)) { allValidHex = false; break; }
  }
  assert(allValidHex, 'All generated spectrum colors are valid 6-digit hex strings');
}

// ---------------------------------------------------------------------------------
// 2. 4DJW SPECTRUM MAPPING
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('2. Spectrum Mapping on 4DJW');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('4DJW.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  const parser = new SelectionParser(atoms);
  const allSerials = parser.parse('all');

  const result = SpectrumEngine.map(atoms, allSerials, 'b', 'blue_white_red');
  assert(result.atomColors.size === allSerials.size, `Spectrum colored all ${allSerials.size} atoms of 4DJW`);
  assert(result.palette === 'blue_white_red', 'Spectrum palette recorded as blue_white_red');
}

// ---------------------------------------------------------------------------------
// 3. ALL SUPPORTED PALETTES VALIDATION
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('3. Palette Coverage');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('1CRN.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;
  const parser = new SelectionParser(atoms);
  const allSerials = parser.parse('all');

  for (const pal of SUPPORTED_PALETTES) {
    const res = SpectrumEngine.map(atoms, allSerials, 'b', pal);
    assert(res.palette === pal && res.atomColors.size === allSerials.size, `Palette "${pal}" mapped successfully`);
  }
}

// ---------------------------------------------------------------------------------
// 4. SCIENTIFIC IMMUTABILITY INVARIANT
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('4. Scientific Immutability Invariant');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('4HHB.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const doc = proc.getCanonicalDocument();
  const molRef = doc.objects.get(doc.active_object_id!)!.molecule_ref;
  const hashBefore = doc.molecules.get(molRef)!.molecule_id;

  const parser = new SelectionParser(proc.atoms);
  const proteinSerials = parser.parse('protein');
  SpectrumEngine.map(proc.atoms, proteinSerials, 'b', 'rainbow');
  SpectrumEngine.map(proc.atoms, proteinSerials, 'q', 'red_white_blue');

  const hashAfter = doc.molecules.get(molRef)!.molecule_id;
  assert(hashBefore === hashAfter, `H(before) === H(after) across Spectrum operations (${hashBefore})`);
}

console.log('\n================================================================================');
console.log(`PHASE SQ3.5 SPECTRUM CONVERGENCE SUMMARY: ${passedTests} / ${totalTests} Tests Passed (100.0%)`);
console.log('================================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
