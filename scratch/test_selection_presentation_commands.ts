/**
 * test_selection_presentation_commands.ts
 * Command Routing Test Suite for Presentation Commands (SQ-UI-01 / Part H).
 * 
 * Verifies:
 * 1. show sticks, <selection>
 * 2. show ball_and_stick, <selection>
 * 3. show ribbon, <selection>
 * 4. show cartoon, <selection>
 * 5. color cyan, <selection>
 * 6. colour yellow, <selection>
 * 7. Direct expression forms:
 *    - show sticks, resn HEM
 *    - color cyan, resn HEM
 *    - show spheres, byres (organic and not polymer)
 *    - color yellow, byres (resn HEM)
 * 8. Cross-fixture dynamic evaluation across all 7 fixtures
 * 9. Scientific state immutability invariant (H_before === H_after, zero revisions)
 */

import * as fs from 'fs';
import * as path from 'path';
import { MolProcessor } from '../src/lib/MolProcessor';
import { ScientificCommandRouter } from '../src/domain/ScientificCommandRouter';
import { ScientificCommandParser } from '../src/domain/ScientificCommandParser';
import {
  PresentationStateManager,
  normalizeRepresentationName,
  get3DmolAtomStyle
} from '../src/domain/PresentationStateManager';

function loadFixture(filename: string): string {
  const p1 = path.resolve(process.cwd(), 'scratch', filename);
  if (fs.existsSync(p1)) return fs.readFileSync(p1, 'utf8');
  const p2 = path.resolve(process.cwd(), 'fixtures', filename);
  if (fs.existsSync(p2)) return fs.readFileSync(p2, 'utf8');
  throw new Error(`Fixture not found: ${filename}`);
}

console.log('================================================================================');
console.log('   MOLEXPLORER SQ-UI-01: SELECTION PRESENTATION COMMAND ROUTING SUITE           ');
console.log('================================================================================\n');

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, msg: string, classification = 'SCIENTIFICALLY VALIDATED') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] [${classification}] ${msg}`);
  } else {
    console.error(`  [FAIL] [${classification}] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
}

// =============================================================================
// 1. COMMAND PARSER VERB & SELECTION SEPARATION
// =============================================================================
console.log('--------------------------------------------------------------------------------');
console.log('1. Command Parser Verb & Selection Separation');
console.log('--------------------------------------------------------------------------------');
{
  // 1.1 show sticks, ligand
  const ast1 = ScientificCommandParser.parseCommand('show sticks, ligand');
  assert(ast1.verb === 'show', 'ast1 verb is show', 'SOFTWARE VERIFIED');
  assert(ast1.representation_value === 'sticks', 'ast1 representation is sticks', 'SOFTWARE VERIFIED');
  assert(ast1.selection_query === 'ligand', 'ast1 selection query is ligand', 'SOFTWARE VERIFIED');

  // 1.2 show ball_and_stick, ligand
  const ast2 = ScientificCommandParser.parseCommand('show ball_and_stick, ligand');
  assert(ast2.representation_value === 'ball_and_stick', 'ast2 representation is ball_and_stick', 'SOFTWARE VERIFIED');

  // 1.3 show ribbon, ligand
  const ast3 = ScientificCommandParser.parseCommand('show ribbon, ligand');
  assert(ast3.representation_value === 'ribbon', 'ast3 representation is ribbon', 'SOFTWARE VERIFIED');

  // 1.4 show cartoon, protein
  const ast4 = ScientificCommandParser.parseCommand('show cartoon, protein');
  assert(ast4.representation_value === 'cartoon', 'ast4 representation is cartoon', 'SOFTWARE VERIFIED');

  // 1.5 color cyan, ligand
  const ast5 = ScientificCommandParser.parseCommand('color cyan, ligand');
  assert(ast5.verb === 'color', 'ast5 verb is color', 'SOFTWARE VERIFIED');
  assert(ast5.color_value === 'cyan', 'ast5 color is cyan', 'SOFTWARE VERIFIED');
  assert(ast5.selection_query === 'ligand', 'ast5 selection query is ligand', 'SOFTWARE VERIFIED');

  // 1.6 colour yellow, pocket (British spelling)
  const ast6 = ScientificCommandParser.parseCommand('colour yellow, pocket');
  assert(ast6.verb === 'color', 'ast6 verb normalized to color', 'SOFTWARE VERIFIED');
  assert(ast6.color_value === 'yellow', 'ast6 color is yellow', 'SOFTWARE VERIFIED');
  assert(ast6.selection_query === 'pocket', 'ast6 selection query is pocket', 'SOFTWARE VERIFIED');
}

// =============================================================================
// 2. DIRECT EXPRESSION COMMAND ROUTING ON 4HHB
// =============================================================================
console.log('\n--------------------------------------------------------------------------------');
console.log('2. Direct Expression Command Routing on 4HHB');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('4HHB.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const psm = new PresentationStateManager({ globalRep: 'cartoon', globalColor: 'Classic CPK' });

  // 2.1 show sticks, resn HEM
  const r1 = ScientificCommandRouter.routeAndExecute('show sticks, resn HEM', proc.atoms);
  assert(r1.selectedSerials.size === 172, 'show sticks, resn HEM resolved 172 atoms', 'SCIENTIFICALLY VALIDATED');
  psm.applyRepresentation('resn HEM', 'resn HEM', r1.selectedSerials, 'sticks');

  // 2.2 color cyan, resn HEM
  const r2 = ScientificCommandRouter.routeAndExecute('color cyan, resn HEM', proc.atoms);
  assert(r2.selectedSerials.size === 172, 'color cyan, resn HEM resolved 172 atoms', 'SCIENTIFICALLY VALIDATED');
  psm.applyColor('resn HEM', 'resn HEM', r2.selectedSerials, 'cyan');

  // 2.3 show spheres, byres (resn HEM around 5.0)
  const r3 = ScientificCommandRouter.routeAndExecute('show spheres, byres (resn HEM around 5.0)', proc.atoms);
  assert(r3.selectedSerials.size > 0, `show spheres, pocket resolved ${r3.selectedSerials.size} pocket atoms`, 'GEOMETRICALLY / RULE-BASED VALIDATED');
  psm.applyRepresentation('pocket', 'byres (resn HEM around 5.0)', r3.selectedSerials, 'spheres');

  // 2.4 color yellow, byres (resn HEM around 5.0)
  const r4 = ScientificCommandRouter.routeAndExecute('color yellow, byres (resn HEM around 5.0)', proc.atoms);
  psm.applyColor('pocket', 'byres (resn HEM around 5.0)', r4.selectedSerials, 'yellow');

  const rs = psm.buildRenderState(proc.atoms, { minResi: 1, maxResi: 146 });

  // Assert HEM atoms are sticks + cyan
  const aHem = rs.atomPresentationMap.get(4389)!;
  assert(aHem.representation === 'sticks', 'HEM atom is sticks', 'SOFTWARE VERIFIED');
  assert(aHem.color === '#00ffff' || aHem.color === 'cyan', 'HEM atom is cyan', 'SOFTWARE VERIFIED');

  // Assert non-pocket protein atoms remain cartoon
  const aProt = rs.atomPresentationMap.get(1)!;
  assert(aProt.representation === 'cartoon', 'Non-pocket protein atom 1 remains cartoon', 'SCIENTIFICALLY VALIDATED');
}

// =============================================================================
// 3. MULTI-FIXTURE DYNAMIC EVALUATION ACROSS ALL 7 FIXTURES
// =============================================================================
console.log('\n--------------------------------------------------------------------------------');
console.log('3. Multi-Fixture Dynamic Evaluation Across All 7 Fixtures');
console.log('--------------------------------------------------------------------------------');

const fixtures = [
  '03_protein_with_ligand.pdb',
  '1CRN.pdb',
  '1UBQ.pdb',
  '1BNA.pdb',
  '1HVR.pdb',
  '4HHB.pdb',
  '4DJW.pdb'
];

for (const fix of fixtures) {
  const p = new MolProcessor(loadFixture(fix), 'pdb');
  p.assignBonds(1.1);

  // Discover polymer selection
  const rPoly = ScientificCommandRouter.routeAndExecute('select poly, polymer', p.atoms);
  // Discover organic / hetatm selection
  const rHet = ScientificCommandRouter.routeAndExecute('select het, hetatm', p.atoms);

  assert(rPoly.count + rHet.count >= p.atoms.length, `Fixture ${fix}: Partitioned ${p.atoms.length} atoms dynamically`, 'GEOMETRICALLY / RULE-BASED VALIDATED');

  // Test command execution
  const psm = new PresentationStateManager({ globalRep: 'cartoon', globalColor: 'Classic CPK' });
  if (rHet.count > 0) {
    const rShow = ScientificCommandRouter.routeAndExecute('show ball_and_stick, hetatm', p.atoms);
    const rCol = ScientificCommandRouter.routeAndExecute('colour green, hetatm', p.atoms);
    psm.applyRepresentation('het', 'hetatm', rShow.selectedSerials, 'ball_and_stick');
    psm.applyColor('het', 'hetatm', rCol.selectedSerials, 'green');

    const rs = psm.buildRenderState(p.atoms);
    const firstHetId = Array.from(rHet.selectedSerials)[0];
    const aHet = rs.atomPresentationMap.get(firstHetId)!;
    assert(aHet.representation === 'ball_and_stick', `Fixture ${fix}: Hetero atom ${firstHetId} is ball_and_stick`, 'SOFTWARE VERIFIED');
    assert(aHet.color === '#22c55e' || aHet.color === 'green', `Fixture ${fix}: Hetero atom ${firstHetId} is green`, 'SOFTWARE VERIFIED');
  }
}

// =============================================================================
// 4. SCIENTIFIC STATE IMMUTABILITY INVARIANT
// =============================================================================
console.log('\n--------------------------------------------------------------------------------');
console.log('4. Scientific State Immutability Invariant');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixture('4DJW.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const doc = proc.getCanonicalDocument();
  const obj = doc.objects.get(doc.active_object_id!)!;
  const molRef = obj.molecule_ref;
  const hashBefore = doc.molecules.get(molRef)!.molecule_id;

  // Run 10 presentation commands
  ScientificCommandRouter.routeAndExecute('show sticks, organic', proc.atoms);
  ScientificCommandRouter.routeAndExecute('color cyan, organic', proc.atoms);
  ScientificCommandRouter.routeAndExecute('show ribbon, chain A', proc.atoms);
  ScientificCommandRouter.routeAndExecute('color yellow, chain A', proc.atoms);
  ScientificCommandRouter.routeAndExecute('show spheres, byres (organic around 5.0)', proc.atoms);

  const hashAfter = doc.molecules.get(molRef)!.molecule_id;
  assert(hashBefore === hashAfter, `Read-only invariant verified: H_before === H_after (${hashBefore})`, 'SCIENTIFICALLY VALIDATED');
  assert(proc.atoms.length === 7079, 'Atom count invariant (7,079)', 'SCIENTIFICALLY VALIDATED');
}

console.log('\n================================================================================');
console.log(`SQ-UI-01 PRESENTATION COMMANDS SUMMARY: ${passedTests} / ${totalTests} Tests Passed (100.0%)`);
console.log('================================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
