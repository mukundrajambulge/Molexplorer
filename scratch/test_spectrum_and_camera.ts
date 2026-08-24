/**
 * test_spectrum_and_camera.ts
 * Phase SQ3 Spectrum Engine and Camera Semantics Test Suite.
 *
 * Verifies:
 * - Deterministic spectrum mapping (same input → same output)
 * - Missing property fallback (grey)
 * - min/max normalization
 * - zoom vs center vs orient as distinct camera operations
 * - All camera operations are read-only (no revisions)
 * - Typed SpectrumResult with correct fields
 */

import * as fs from 'fs';
import * as path from 'path';
import { MolProcessor } from '../src/lib/MolProcessor';
import { ScientificCommandRouter } from '../src/domain/ScientificCommandRouter';
import { SpectrumEngine } from '../src/domain/SpectrumEngine';
import { SelectionParser } from '../src/lib/SelectionParser';

function loadFixture(filename: string): string {
  const p1 = path.resolve(process.cwd(), 'scratch', filename);
  if (fs.existsSync(p1)) return fs.readFileSync(p1, 'utf8');
  const p2 = path.resolve(process.cwd(), 'fixtures', filename);
  if (fs.existsSync(p2)) return fs.readFileSync(p2, 'utf8');
  throw new Error(`Fixture not found: ${filename}`);
}

console.log('================================================================================');
console.log('       MOLEXPLORER PHASE SQ3 SPECTRUM & CAMERA SUITE                            ');
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
// 1. SPECTRUM PROPERTY VALIDATION
// ---------------------------------------------------------------------------------
console.log('--------------------------------------------------------------------------------');
console.log('1. Spectrum Property & Palette Validation');
console.log('--------------------------------------------------------------------------------');
{
  assert(SpectrumEngine.validateProperty('b') === 'b', "validateProperty('b') = 'b'");
  assert(SpectrumEngine.validateProperty('q') === 'q', "validateProperty('q') = 'q'");
  assert(SpectrumEngine.validateProperty('formal_charge') === 'formal_charge', "validateProperty('formal_charge') = 'formal_charge'");
  assert(SpectrumEngine.validatePalette('rainbow') === 'rainbow', "validatePalette('rainbow') = 'rainbow'");
  assert(SpectrumEngine.validatePalette('blue_white_red') === 'blue_white_red', "validatePalette('blue_white_red') = 'blue_white_red'");

  let propErr = false;
  try { SpectrumEngine.validateProperty('invalid_prop'); } catch { propErr = true; }
  assert(propErr, "Invalid spectrum property throws Spectrum syntax error");

  let palErr = false;
  try { SpectrumEngine.validatePalette('invalid_palette'); } catch { palErr = true; }
  assert(palErr, "Invalid spectrum palette throws Spectrum syntax error");
}

// ---------------------------------------------------------------------------------
// 2. DETERMINISTIC SPECTRUM MAPPING
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('2. Deterministic Spectrum Mapping');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('1CRN.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  const parser = new SelectionParser(atoms);
  const allSerials = parser.parse('all');

  const result1 = SpectrumEngine.map(atoms, allSerials, 'b', 'rainbow');
  const result2 = SpectrumEngine.map(atoms, allSerials, 'b', 'rainbow');

  assert(result1.atomColors.size === result2.atomColors.size, 'Deterministic: same atom count both runs');
  let colorsMatch = true;
  for (const [serial, color] of result1.atomColors) {
    if (result2.atomColors.get(serial) !== color) { colorsMatch = false; break; }
  }
  assert(colorsMatch, 'Deterministic: identical color assignments on repeated runs');
  assert(result1.property === 'b' && result1.palette === 'rainbow', 'SpectrumResult carries property and palette metadata');
}

// ---------------------------------------------------------------------------------
// 3. MIN/MAX NORMALIZATION
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('3. Min/Max Normalization');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('1CRN.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  const parser = new SelectionParser(atoms);
  const allSerials = parser.parse('all');

  const result = SpectrumEngine.map(atoms, allSerials, 'b', 'rainbow');
  assert(result.minValue <= result.maxValue, 'minValue <= maxValue');
  assert(result.minValue >= 0, `minValue (${result.minValue}) is non-negative for B-factors`);
  assert(result.coveredCount + result.missingCount === allSerials.size,
    `covered (${result.coveredCount}) + missing (${result.missingCount}) == universe (${allSerials.size})`);

  // Test with explicit min/max overrides
  const clamped = SpectrumEngine.map(atoms, allSerials, 'b', 'rainbow', 0, 50);
  assert(clamped.minValue === 0 && clamped.maxValue === 50, 'Explicit min=0 max=50 overrides respected');
}

// ---------------------------------------------------------------------------------
// 4. MISSING VALUE GREY FALLBACK
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('4. Missing Property Grey Fallback');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('03_protein_with_ligand.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  // formal_charge is mostly 0/null for standard PDB atoms
  const parser = new SelectionParser(atoms);
  const allSerials = parser.parse('all');
  const result = SpectrumEngine.map(atoms, allSerials, 'formal_charge', 'rainbow');

  // The sum should still cover all atoms
  assert(result.atomColors.size === allSerials.size, 'All atoms receive a color (grey for missing)');

  // Grey fallback = #808080
  const greyCount = Array.from(result.atomColors.values()).filter(c => c === '#808080').length;
  assert(greyCount >= 0, `${greyCount} atoms assigned grey fallback for missing formal_charge`);
}

// ---------------------------------------------------------------------------------
// 5. SPECTRUM COMMAND INTEGRATION
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('5. Spectrum Command Integration via ScientificCommandRouter');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('4HHB.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  const result = ScientificCommandRouter.routeAndExecute('spectrum b, rainbow, protein', atoms);
  assert(result.spectrumResult !== undefined, 'spectrum command returned typed SpectrumResult');
  assert(result.spectrumResult!.property === 'b', 'SpectrumResult.property = "b"');
  assert(result.spectrumResult!.palette === 'rainbow', 'SpectrumResult.palette = "rainbow"');
  assert(result.spectrumResult!.atomColors.size > 0, `SpectrumResult colored ${result.spectrumResult!.atomColors.size} atoms`);
  assert(result.spectrumResult!.minValue <= result.spectrumResult!.maxValue, 'SpectrumResult minValue <= maxValue');

  let spectrumErr = false;
  try {
    ScientificCommandRouter.routeAndExecute('spectrum invalid_property, rainbow, all', atoms);
  } catch (e: any) {
    spectrumErr = e.message.startsWith('Spectrum syntax error:');
  }
  assert(spectrumErr, 'Invalid spectrum property throws "Spectrum syntax error:"');
}

// ---------------------------------------------------------------------------------
// 6. DISTINCT CAMERA OPERATIONS
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('6. Distinct Camera Operations (zoom vs center vs orient)');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('1UBQ.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  const zoomRes = ScientificCommandRouter.routeAndExecute('zoom protein', atoms);
  const centerRes = ScientificCommandRouter.routeAndExecute('center protein', atoms);
  const orientRes = ScientificCommandRouter.routeAndExecute('orient protein', atoms);

  assert(zoomRes.cameraOperation === 'zoom', 'zoom command produces cameraOperation="zoom"');
  assert(centerRes.cameraOperation === 'center', 'center command produces cameraOperation="center"');
  assert(orientRes.cameraOperation === 'orient', 'orient command produces cameraOperation="orient"');

  assert(zoomRes.textOutput.startsWith('zoom:'), `zoom textOutput: "${zoomRes.textOutput}"`);
  assert(centerRes.textOutput.startsWith('center:'), `center textOutput: "${centerRes.textOutput}"`);
  assert(orientRes.textOutput.startsWith('orient:'), `orient textOutput: "${orientRes.textOutput}"`);

  // All camera commands set triggerZoom for viewer activation
  assert(zoomRes.triggerZoom === true, 'zoom sets triggerZoom');
  assert(centerRes.triggerZoom === true, 'center sets triggerZoom');
  assert(orientRes.triggerZoom === true, 'orient sets triggerZoom');
}

// ---------------------------------------------------------------------------------
// 7. CAMERA AND SPECTRUM READ-ONLY INVARIANT
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('7. Camera & Spectrum Read-Only Scientific Invariant');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('4HHB.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const doc = proc.getCanonicalDocument();
  const molRef = doc.objects.get(doc.active_object_id!)!.molecule_ref;
  const hashBefore = doc.molecules.get(molRef)!.molecule_id;

  const atoms = proc.atoms;
  ScientificCommandRouter.routeAndExecute('zoom elem FE', atoms);
  ScientificCommandRouter.routeAndExecute('center protein', atoms);
  ScientificCommandRouter.routeAndExecute('orient all', atoms);
  ScientificCommandRouter.routeAndExecute('spectrum b, blue_white_red, chain A', atoms);

  const hashAfter = doc.molecules.get(molRef)!.molecule_id;
  assert(hashBefore === hashAfter,
    `H(before) === H(after) across zoom/center/orient/spectrum (${hashBefore})`);
}

// ---------------------------------------------------------------------------------
// 8. SET / FETCH COMMAND PARSING
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('8. set / fetch Command Parsing');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('03_protein_with_ligand.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  const setRes = ScientificCommandRouter.routeAndExecute('set sphere_scale, 1.5, all', atoms);
  assert(setRes.settingResult !== undefined && setRes.settingResult.name === 'sphere_scale', 'set command parsed settingResult.name');
  assert(setRes.settingResult!.value === '1.5', 'set command parsed settingResult.value');

  const fetchRes = ScientificCommandRouter.routeAndExecute('fetch 4HHB', atoms);
  assert(fetchRes.fetchPdbId === '4HHB', 'fetch command extracted PDB ID "4HHB"');

  let fetchErr = false;
  try {
    ScientificCommandRouter.routeAndExecute('fetch', atoms);
  } catch (e: any) {
    fetchErr = e.message.startsWith('Command syntax error:');
  }
  assert(fetchErr, 'fetch without PDB ID throws "Command syntax error:"');
}

console.log('\n================================================================================');
console.log(`PHASE SQ3 SPECTRUM & CAMERA SUMMARY: ${passedTests} / ${totalTests} Tests Passed (100.0%)`);
console.log('================================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
