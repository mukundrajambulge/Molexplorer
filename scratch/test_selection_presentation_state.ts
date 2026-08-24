/**
 * test_selection_presentation_state.ts
 * Phase SQ3 Presentation State Test Suite.
 *
 * Verifies:
 * - Simultaneous color overrides for multiple named selections
 * - Simultaneous representation overrides
 * - Last-write-wins override precedence
 * - Object isolation
 * - Named selection equivalence in presentation
 * - Read-only scientific invariants
 */

import * as fs from 'fs';
import * as path from 'path';
import { MolProcessor } from '../src/lib/MolProcessor';
import { ScientificCommandRouter } from '../src/domain/ScientificCommandRouter';
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
console.log('       MOLEXPLORER PHASE SQ3 PRESENTATION STATE SUITE                           ');
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
// 1. SIMULTANEOUS COLOR OVERRIDES
// ---------------------------------------------------------------------------------
console.log('--------------------------------------------------------------------------------');
console.log('1. Simultaneous Color Overrides');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('03_protein_with_ligand.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  const parser = new SelectionParser(atoms);
  const ligandSerials = parser.parse('resn LIG');
  const proteinSerials = parser.parse('protein');

  const psm = new PresentationStateManager();
  psm.applyColor('ligand', 'resn LIG', ligandSerials, 'cyan');
  psm.applyColor('protein', 'protein', proteinSerials, 'green');

  // Check an atom in each group
  const ligAtom = atoms.find(a => ligandSerials.has(a.serial))!;
  const protAtom = atoms.find(a => proteinSerials.has(a.serial))!;

  const ligPresentation = psm.resolveAtom(ligAtom.serial);
  const protPresentation = psm.resolveAtom(protAtom.serial);

  assert(ligPresentation.color === 'cyan', 'Ligand atoms resolved color = cyan');
  assert(protPresentation.color === 'green', 'Protein atoms resolved color = green');
  assert(ligPresentation.color !== protPresentation.color, 'Ligand and protein have distinct simultaneous colors');
}

// ---------------------------------------------------------------------------------
// 2. SIMULTANEOUS REPRESENTATION OVERRIDES
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('2. Simultaneous Representation Overrides');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('03_protein_with_ligand.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  const parser = new SelectionParser(atoms);
  const ligandSerials = parser.parse('resn LIG');
  const proteinSerials = parser.parse('protein');

  const psm = new PresentationStateManager();
  psm.applyRepresentation('ligand', 'resn LIG', ligandSerials, 'sticks');
  psm.applyRepresentation('protein', 'protein', proteinSerials, 'cartoon');

  const ligAtom = atoms.find(a => ligandSerials.has(a.serial))!;
  const protAtom = atoms.find(a => proteinSerials.has(a.serial))!;

  const ligPres = psm.resolveAtom(ligAtom.serial);
  const protPres = psm.resolveAtom(protAtom.serial);

  assert(ligPres.representation === 'sticks', 'Ligand atoms resolved representation = sticks');
  assert(protPres.representation === 'cartoon', 'Protein atoms resolved representation = cartoon');
  assert(ligPres.representation !== protPres.representation, 'Ligand and protein have distinct simultaneous representations');
}

// ---------------------------------------------------------------------------------
// 3. LAST-WRITE-WINS PRECEDENCE
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('3. Last-Write-Wins Override Precedence');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('03_protein_with_ligand.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  const parser = new SelectionParser(atoms);
  const ligandSerials = parser.parse('resn LIG');

  const psm = new PresentationStateManager();

  // Apply two color overrides to the same selection key — second must win
  // Simulate different appliedAt by constructing overrides manually via internal access
  psm.applyColor('lig_override', 'resn LIG', ligandSerials, 'red');
  // A tiny busy-loop ensures distinct timestamps; in practice Date.now() granularity is 1ms
  const t0 = Date.now(); while (Date.now() - t0 < 2) { /* spin */ }
  psm.applyColor('lig_override', 'resn LIG', ligandSerials, 'yellow');

  const ligAtom = atoms.find(a => ligandSerials.has(a.serial))!;
  const resolved = psm.resolveAtom(ligAtom.serial);

  // Last write (yellow) should win
  assert(resolved.color === 'yellow', `Last-write-wins: most recent override (yellow) applied over earlier (red), got ${resolved.color}`);
}

// ---------------------------------------------------------------------------------
// 4. OVERRIDE INDEPENDENCE — CHANGING ONE SELECTION DOES NOT AFFECT ANOTHER
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('4. Override Independence (Changing ligand does not affect pocket)');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('03_protein_with_ligand.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  const parser = new SelectionParser(atoms);
  const ligandSerials = parser.parse('resn LIG');
  const proteinSerials = parser.parse('protein');

  const psm = new PresentationStateManager();
  psm.applyColor('ligand', 'resn LIG', ligandSerials, 'cyan');
  psm.applyColor('protein', 'protein', proteinSerials, 'yellow');

  // Now change ligand color
  psm.applyColor('ligand', 'resn LIG', ligandSerials, 'magenta');

  const protAtom = atoms.find(a => proteinSerials.has(a.serial))!;
  const protPres = psm.resolveAtom(protAtom.serial);

  assert(protPres.color === 'yellow', 'Changing ligand color did not affect protein override (still yellow)');
}

// ---------------------------------------------------------------------------------
// 5. NAMED SELECTION EQUIVALENCE IN COMMANDS
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('5. Named Selection Command Equivalence');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('03_protein_with_ligand.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  const namedSelections = [{ name: 'ligand', query: 'resn LIG', atomIds: [] as number[] }];

  const viaName = ScientificCommandRouter.routeAndExecute('colour cyan, ligand', atoms, namedSelections);
  const viaExpr = ScientificCommandRouter.routeAndExecute('colour cyan, (resn LIG)', atoms, namedSelections);

  let setsEqual = viaName.selectedSerials.size === viaExpr.selectedSerials.size;
  if (setsEqual) {
    for (const id of viaName.selectedSerials) {
      if (!viaExpr.selectedSerials.has(id)) { setsEqual = false; break; }
    }
  }
  assert(setsEqual, 'Named selection resolves bit-for-bit identically to parenthesized expression in presentation command');
}

// ---------------------------------------------------------------------------------
// 6. CLEAR OVERRIDE
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('6. Override Clearing and Fallback to Global');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('03_protein_with_ligand.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  const parser = new SelectionParser(atoms);
  const ligandSerials = parser.parse('resn LIG');
  const psm = new PresentationStateManager({ globalColor: 'element' });
  psm.applyColor('ligand', 'resn LIG', ligandSerials, 'red');

  const ligAtom = atoms.find(a => ligandSerials.has(a.serial))!;
  const beforeClear = psm.resolveAtom(ligAtom.serial);
  assert(beforeClear.color === 'red', 'Color override applied correctly before clear');

  psm.clearOverride('ligand');
  const afterClear = psm.resolveAtom(ligAtom.serial);
  assert(afterClear.color === 'element', 'After clear, atom falls back to global color (element)');
}

// ---------------------------------------------------------------------------------
// 7. VISIBILITY OVERRIDE
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('7. Visibility Overrides');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('03_protein_with_ligand.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const atoms = proc.atoms;

  const parser = new SelectionParser(atoms);
  const solventSerials = parser.parse('solvent');
  const psm = new PresentationStateManager();
  psm.applyVisibility('solvent', 'solvent', solventSerials, 'hidden');

  for (const serial of solventSerials) {
    const pres = psm.resolveAtom(serial);
    assert(pres.visibility === 'hidden', `Solvent atom ${serial} is hidden via visibility override`);
    break; // Check first one; structure is clear
  }

  const proteinSerials = parser.parse('protein');
  const protAtom = atoms.find(a => proteinSerials.has(a.serial))!;
  const protPres = psm.resolveAtom(protAtom.serial);
  assert(protPres.visibility === 'visible', 'Non-solvent protein atom is still visible (not affected by solvent override)');
}

// ---------------------------------------------------------------------------------
// 8. READ-ONLY SCIENTIFIC INVARIANT ACROSS PRESENTATION OPERATIONS
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('8. Read-Only Scientific Invariant across Presentation Operations');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('1CRN.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const doc = proc.getCanonicalDocument();
  const molRef = doc.objects.get(doc.active_object_id!)!.molecule_ref;
  const hashBefore = doc.molecules.get(molRef)!.molecule_id;

  const atoms = proc.atoms;
  // Apply multiple presentation commands — none should mutate canonical state
  ScientificCommandRouter.routeAndExecute('color cyan, protein', atoms);
  ScientificCommandRouter.routeAndExecute('show sticks, name CA', atoms);
  ScientificCommandRouter.routeAndExecute('hide cartoon, chain A', atoms);
  ScientificCommandRouter.routeAndExecute('spectrum b, rainbow, protein', atoms);
  ScientificCommandRouter.routeAndExecute('zoom name CA and resi 1-10', atoms);
  ScientificCommandRouter.routeAndExecute('orient protein', atoms);

  const hashAfter = doc.molecules.get(molRef)!.molecule_id;
  assert(hashBefore === hashAfter, `H(before) === H(after) across 6 presentation operations (${hashBefore})`);
}

console.log('\n================================================================================');
console.log(`PHASE SQ3 PRESENTATION STATE SUMMARY: ${passedTests} / ${totalTests} Tests Passed (100.0%)`);
console.log('================================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
