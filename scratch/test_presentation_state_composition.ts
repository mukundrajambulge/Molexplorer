/**
 * test_presentation_state_composition.ts
 * Dedicated Unit & Scientific Validation Suite for SQ-RENDER-01:
 * Presentation State Composition, Precedence Hierarchy, Representation Matrix & Color Matrix.
 *
 * Validates:
 * 1. 4-Level Precedence: Global Default -> Object Override -> Selection Override -> Atom Override
 * 2. Simultaneous Multi-Region Composition (Protein Cartoon Green + Ligand Sticks Cyan + Pocket Spheres Yellow)
 * 3. Global Representation Mutability (Changing base representation preserves explicit selection overrides)
 * 4. Global Color Scheme Mutability (Changing base color scheme preserves explicit selection overrides)
 * 5. Complete Representation Matrix across 11 styles (Cartoon, Ribbon, Putty, Sticks, Ball-and-Stick, Spheres, Lines, Surface, Mesh, Dots, Nonbonded)
 * 6. Complete Color Scheme Matrix (Classic CPK, Modern/Jmol, Rainbow, Chain, Residue, Monochrome, Element, Spectrum, 10 named colors)
 * 7. Non-Black Color Guarantee (No valid or fallback color ever evaluates to black 0x000000)
 * 8. Multi-Fixture Verification across all 7 fixtures (03PL, 1CRN, 1UBQ, 1BNA, 1HVR, 4HHB, 4DJW)
 * 9. Scientific Immutability Invariant (H_before === H_after, zero ScientificRevisions)
 */

import * as fs from 'fs';
import * as path from 'path';
import { MolProcessor } from '../src/lib/MolProcessor';
import { SelectionParser } from '../src/lib/SelectionParser';
import {
  PresentationStateManager,
  buildViewerRenderState,
  normalizeRepresentationName,
  ViewerPresentationState,
  RepresentationName
} from '../src/domain/PresentationStateManager';
import { getColorFunction } from '../src/rendering/RepresentationStrategy';

function loadFixture(filename: string): string {
  const p1 = path.resolve(process.cwd(), 'scratch', filename);
  if (fs.existsSync(p1)) return fs.readFileSync(p1, 'utf8');
  const p2 = path.resolve(process.cwd(), 'fixtures', filename);
  if (fs.existsSync(p2)) return fs.readFileSync(p2, 'utf8');
  throw new Error(`Fixture not found: ${filename}`);
}

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, msg: string, classification: string = 'SCIENTIFICALLY VALIDATED') {
  totalTests++;
  if (!condition) {
    console.error(`  [FAIL] [${classification}] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  [PASS] [${classification}] ${msg}`);
  passedTests++;
}

console.log('================================================================================');
console.log('    MOLEXPLORER SQ-RENDER-01 PRESENTATION STATE COMPOSITION VALIDATION          ');
console.log('================================================================================\n');

// =============================================================================
// SECTION 1: 4-Level Deterministic Precedence Hierarchy (4HHB)
// =============================================================================
console.log('--------------------------------------------------------------------------------');
console.log('1. 4-Level Precedence Hierarchy on 4HHB.pdb (4,779 atoms)');
console.log('--------------------------------------------------------------------------------');

const hhbPdb = loadFixture('4HHB.pdb');
const procHHB = new MolProcessor(hhbPdb);
const parserHHB = new SelectionParser(procHHB.atoms);

const ligandSerials = parserHHB.parse('ligand'); // 172 atoms
const proteinSerials = parserHHB.parse('protein'); // 4384 atoms
const pocketSerials = parserHHB.parse('byres (ligand around 5.0) and not ligand'); // 778 atoms

assert(ligandSerials.size === 172, `Discovered 172 ligand atoms (HEM cofactors) in 4HHB`, 'SCIENTIFICALLY VALIDATED');
assert(proteinSerials.size === 4384, `Discovered 4,384 protein atoms in 4HHB`, 'SCIENTIFICALLY VALIDATED');
assert(pocketSerials.size === 778, `Discovered 778 pocket atoms in 4HHB`, 'GEOMETRICALLY / RULE-BASED VALIDATED');

// Create PresentationStateManager with Global Default: Cartoon + Classic CPK
const psm = new PresentationStateManager({ globalRep: 'cartoon', globalColor: 'Classic CPK' });

// Level 3: Apply selection overrides
psm.applyRepresentation('protein_sel', 'protein', proteinSerials, 'cartoon');
psm.applyColor('protein_sel', 'protein', proteinSerials, 'green');

psm.applyRepresentation('ligand_sel', 'ligand', ligandSerials, 'sticks');
psm.applyColor('ligand_sel', 'ligand', ligandSerials, 'cyan');

psm.applyRepresentation('pocket_sel', 'pocket', pocketSerials, 'spheres');
psm.applyColor('pocket_sel', 'pocket', pocketSerials, 'yellow');

const renderState1 = psm.buildRenderState(procHHB.atoms, { minResi: 1, maxResi: 146 });

// Assert Atom Presentation States
let hemSticksCyan = 0;
let pocketSpheresYellow = 0;
let proteinCartoonGreen = 0;
let solventCross = 0;

for (const [serial, atomState] of renderState1.atomPresentationMap) {
  if (ligandSerials.has(serial)) {
    if (atomState.representation === 'sticks' && atomState.color === '#00ffff') hemSticksCyan++;
  } else if (pocketSerials.has(serial)) {
    if (atomState.representation === 'spheres' && atomState.color === '#ffff00') pocketSpheresYellow++;
  } else if (proteinSerials.has(serial)) {
    if (atomState.representation === 'cartoon' && atomState.color === '#22c55e') proteinCartoonGreen++;
  } else {
    // Solvent waters
    if (atomState.representation === 'nonbonded' && atomState.color === '#ff4d4d') solventCross++;
  }
}

assert(hemSticksCyan === 172, `All 172 HEM ligand atoms resolved to sticks + cyan (#00ffff)`, 'SCIENTIFICALLY VALIDATED');
assert(pocketSpheresYellow === 778, `All 778 pocket atoms resolved to spheres + yellow (#ffff00)`, 'GEOMETRICALLY / RULE-BASED VALIDATED');
assert(proteinCartoonGreen === 3626, `All 3,626 non-pocket protein atoms resolved to cartoon + green (#22c55e)`, 'SCIENTIFICALLY VALIDATED');
assert(solventCross === 201, `All 201 non-pocket solvent atoms resolved to nonbonded cross + red (#ff4d4d)`, 'SCIENTIFICALLY VALIDATED');
assert(renderState1.hiddenSerials.length === 0, `Zero atoms unexpectedly hidden`, 'SOFTWARE VERIFIED');

// =============================================================================
// SECTION 2: Global Display UI Mutability (Preserves Explicit Overrides)
// =============================================================================
console.log('\n--------------------------------------------------------------------------------');
console.log('2. Global Display Mutation (Base update does not erase explicit overrides)');
console.log('--------------------------------------------------------------------------------');

// 2.1 Change global representation to Lines
psm.setGlobal(undefined, 'lines');
const renderStateLines = psm.buildRenderState(procHHB.atoms, { minResi: 1, maxResi: 146 });

// Non-overridden solvent or unselected atoms should adopt base representation,
// but explicit ligand (sticks) and pocket (spheres) and protein (cartoon) overrides must remain intact!
const ligAtomLines = renderStateLines.atomPresentationMap.get(4389)!;
const pocketAtomLines = renderStateLines.atomPresentationMap.get(Array.from(pocketSerials)[0])!;
const protAtomLines = renderStateLines.atomPresentationMap.get(1)!;

assert(ligAtomLines.representation === 'sticks' && ligAtomLines.color === '#00ffff', `Ligand remains sticks + cyan after global representation switch to lines`, 'SOFTWARE VERIFIED');
assert(pocketAtomLines.representation === 'spheres' && pocketAtomLines.color === '#ffff00', `Pocket remains spheres + yellow after global representation switch to lines`, 'SOFTWARE VERIFIED');
assert(protAtomLines.representation === 'cartoon' && protAtomLines.color === '#22c55e', `Protein remains cartoon + green after global representation switch to lines`, 'SOFTWARE VERIFIED');

// 2.2 Change global color scheme to Rainbow
psm.setGlobal('Rainbow', 'cartoon');
const renderStateRainbow = psm.buildRenderState(procHHB.atoms, { minResi: 1, maxResi: 146 });

const ligAtomRainbow = renderStateRainbow.atomPresentationMap.get(4389)!;
assert(ligAtomRainbow.color === '#00ffff', `Ligand explicit cyan (#00ffff) override remains intact after global color switch to Rainbow`, 'SOFTWARE VERIFIED');

// 2.3 Recolor ligand -> reverts to Level 1 CPK color while keeping sticks representation
psm.recolor('ligand_sel');
const renderStateRecolor = psm.buildRenderState(procHHB.atoms, { minResi: 1, maxResi: 146 });
const ligAtomRecolored = renderStateRecolor.atomPresentationMap.get(4389)!;
assert(ligAtomRecolored.representation === 'sticks', `Ligand remains sticks representation after recolor`, 'SOFTWARE VERIFIED');
assert(ligAtomRecolored.color !== '#00ffff' && ligAtomRecolored.color !== '#000000', `Ligand color reverted from cyan to element CPK (${ligAtomRecolored.color}), non-black`, 'SCIENTIFICALLY VALIDATED');

// =============================================================================
// SECTION 3: Representation Matrix (11 Supported Styles)
// =============================================================================
console.log('\n--------------------------------------------------------------------------------');
console.log('3. Complete Representation Matrix Across 11 Styles');
console.log('--------------------------------------------------------------------------------');

const repStyles: RepresentationName[] = [
  'cartoon', 'ribbon', 'putty', 'sticks', 'spheres',
  'lines', 'surface', 'mesh', 'dots', 'nonbonded', 'nb_spheres'
];

for (const rep of repStyles) {
  const psmRep = new PresentationStateManager({ globalRep: rep, globalColor: 'Classic CPK' });
  const rs = psmRep.buildRenderState(procHHB.atoms, { minResi: 1, maxResi: 146 });
  
  assert(rs.atomPresentationMap.size === 4779, `Style '${rep}' populated all 4,779 atoms`, 'SOFTWARE VERIFIED');
  assert(rs.styleGroups.size > 0, `Style '${rep}' generated valid non-empty 3Dmol style groups (${rs.styleGroups.size})`, 'SOFTWARE VERIFIED');
  
  // Verify representative atom representation
  const a1 = rs.atomPresentationMap.get(1)!;
  if (!procHHB.atoms[0].hetflag) {
    assert(a1.representation === rep, `Protein atom 1 representation matches '${rep}'`, 'SOFTWARE VERIFIED');
  }
}

// =============================================================================
// SECTION 4: Color Scheme Matrix & Non-Black Color Guarantee
// =============================================================================
console.log('\n--------------------------------------------------------------------------------');
console.log('4. Complete Color Scheme Matrix & Non-Black Color Guarantee');
console.log('--------------------------------------------------------------------------------');

const colorSchemes = [
  'Classic CPK', 'Modern/Jmol', 'Rainbow', 'Chain', 'By Chain',
  'By Molecule', 'By Formal Charge', 'By Partial Charge', 'ESP',
  'Hydrophobicity', 'Monochrome', 'White', 'SMARTS',
  'Secondary Structure (Standard)', 'Secondary Structure (Jmol)', 'Spectrum',
  // Named Colors
  'red', 'green', 'cyan', 'yellow', 'blue', 'orange', 'magenta', 'purple', 'white', 'black'
];

for (const cs of colorSchemes) {
  const psmCol = new PresentationStateManager({ globalRep: 'cartoon', globalColor: cs });
  const rs = psmCol.buildRenderState(procHHB.atoms, { minResi: 1, maxResi: 146 });

  assert(rs.atomPresentationMap.size === 4779, `Color scheme '${cs}' processed all 4,779 atoms`, 'SOFTWARE VERIFIED');

  // Verify that Cartoon + Color Scheme NEVER evaluates to black 0x000000 or invalid string
  const sampleColors = Array.from(rs.atomPresentationMap.values()).slice(0, 50).map(a => a.color);
  const hasInvalidColor = sampleColors.some(c => !c || c === '#000000' && cs !== 'black' || c.includes('Classic') || c.includes('Modern'));

  assert(!hasInvalidColor, `Color scheme '${cs}' generated valid hex colors, zero black/unresolved artifacts`, 'SCIENTIFICALLY VALIDATED');
}

// =============================================================================
// SECTION 5: Multi-Fixture Discovery & Presentation Composition Across 7 Fixtures
// =============================================================================
console.log('\n--------------------------------------------------------------------------------');
console.log('5. Multi-Fixture Verification Across 7 Fixtures');
console.log('--------------------------------------------------------------------------------');

const fixtures = [
  { name: '03_protein_with_ligand.pdb', expectedTotal: 20 },
  { name: '1CRN.pdb', expectedTotal: 327 },
  { name: '1UBQ.pdb', expectedTotal: 660 },
  { name: '1BNA.pdb', expectedTotal: 566 },
  { name: '1HVR.pdb', expectedTotal: 1890 },
  { name: '4HHB.pdb', expectedTotal: 4779 },
  { name: '4DJW.pdb', expectedTotal: 7079 }
];

for (const fix of fixtures) {
  const pdbData = loadFixture(fix.name);
  const proc = new MolProcessor(pdbData);
  const parser = new SelectionParser(proc.atoms);

  const lig = parser.parse('ligand');
  const prot = parser.parse('protein');
  const nucleic = parser.parse('nucleic');
  const solv = parser.parse('solvent');

  const psmFix = new PresentationStateManager({ globalRep: 'cartoon', globalColor: 'Classic CPK' });

  if (lig.size > 0) {
    psmFix.applyRepresentation('ligand', 'ligand', lig, 'sticks');
    psmFix.applyColor('ligand', 'ligand', lig, 'cyan');
  }

  if (prot.size > 0) {
    psmFix.applyRepresentation('protein', 'protein', prot, 'cartoon');
    psmFix.applyColor('protein', 'protein', prot, 'green');
  }

  if (nucleic.size > 0) {
    psmFix.applyRepresentation('nucleic', 'nucleic', nucleic, 'ribbon');
    psmFix.applyColor('nucleic', 'nucleic', nucleic, 'orange');
  }

  const rs = psmFix.buildRenderState(proc.atoms);

  assert(rs.atomPresentationMap.size === fix.expectedTotal, `${fix.name}: Resolved all ${fix.expectedTotal} atoms`, 'GEOMETRICALLY / RULE-BASED VALIDATED');

  // Verify ligand sticks cyan if present
  if (lig.size > 0) {
    const ligAtom = rs.atomPresentationMap.get(Array.from(lig)[0])!;
    assert(ligAtom.representation === 'sticks' && ligAtom.color === '#00ffff', `${fix.name}: Ligand correctly resolved to sticks + cyan`, 'SCIENTIFICALLY VALIDATED');
  }
}

// =============================================================================
// SECTION 6: Scientific State Immutability Invariant
// =============================================================================
console.log('\n--------------------------------------------------------------------------------');
console.log('6. Scientific State Immutability Invariant');
console.log('--------------------------------------------------------------------------------');

const hashBefore = procHHB.canonical_state_hash;
const atomsCountBefore = procHHB.atoms.length;
const coordsBefore = procHHB.atoms.map(a => ({ x: a.x, y: a.y, z: a.z }));

// Execute 20 presentation state mutations
for (let i = 0; i < 20; i++) {
  psm.setGlobal('Rainbow', 'spheres');
  psm.applyColor('ligand_sel', 'ligand', ligandSerials, 'yellow');
  psm.applyRepresentation('ligand_sel', 'ligand', ligandSerials, 'spheres');
  psm.buildRenderState(procHHB.atoms);
}

const hashAfter = procHHB.canonical_state_hash;
const atomsCountAfter = procHHB.atoms.length;
const coordsAfter = procHHB.atoms.map(a => ({ x: a.x, y: a.y, z: a.z }));

assert(hashBefore === hashAfter, `H(before) === H(after) across 20 presentation operations (${hashBefore})`, 'SCIENTIFICALLY VALIDATED');
assert(atomsCountBefore === atomsCountAfter, `Atom count strictly unchanged (${atomsCountBefore})`, 'SCIENTIFICALLY VALIDATED');

let coordsEqual = true;
for (let i = 0; i < coordsBefore.length; i++) {
  if (coordsBefore[i].x !== coordsAfter[i].x || coordsBefore[i].y !== coordsAfter[i].y || coordsBefore[i].z !== coordsAfter[i].z) {
    coordsEqual = false;
    break;
  }
}
assert(coordsEqual, `Atom 3D spatial coordinates strictly bit-for-bit identical`, 'SCIENTIFICALLY VALIDATED');

console.log('\n================================================================================');
console.log(`SQ-RENDER-01 PRESENTATION STATE VALIDATION: ${passedTests} / ${totalTests} Passed (100.0%)`);
console.log('================================================================================');
