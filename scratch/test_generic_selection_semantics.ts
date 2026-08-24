/**
 * test_generic_selection_semantics.ts
 * Comprehensive Molecule-Independent Scientific Selection & Measurement Invariant Suite.
 * 
 * Verifies generic selection algebra, named selections, multi-object scopes,
 * and mathematical invariants across 7 diverse macromolecular fixtures:
 * 1. 03_protein_with_ligand.pdb
 * 2. 1CRN.pdb (Hydrophobic plant seed protein)
 * 3. 1UBQ.pdb (Ubiquitin 76-residue signaling protein)
 * 4. 1BNA.pdb (B-DNA dodecamer nucleic acid)
 * 5. 1HVR.pdb (HIV-1 protease with XK263 inhibitor)
 * 6. 4HHB.pdb (Deoxyhemoglobin heterotetramer)
 * 7. 4DJW.pdb (Large multi-chain macromolecular complex)
 */

import * as fs from 'fs';
import * as path from 'path';
import { MolProcessor } from '../src/lib/MolProcessor';
import { SelectionParser } from '../src/lib/SelectionParser';
import { CanonicalSelectionEvaluator } from '../src/domain/CanonicalSelectionEvaluator';
import { ScientificCommandRouter } from '../src/domain/ScientificCommandRouter';
import { ScientificMeasurementEngine } from '../src/domain/ScientificMeasurementEngine';
import { MeasurementParser } from '../src/domain/MeasurementParser';
import {
  CanonicalMolecularDocument,
  CanonicalMolecule,
  CanonicalObject,
  CanonicalState,
  createScopedAtomKey
} from '../src/types/domain';

interface FixtureDef {
  id: string;
  filename: string;
  description: string;
}

const FIXTURES: FixtureDef[] = [
  { id: '03PL', filename: '03_protein_with_ligand.pdb', description: 'Synthetic Protein-Ligand Complex (20 atoms)' },
  { id: '1CRN', filename: '1CRN.pdb', description: 'Crambin (0.54Å hydrophobic seed protein, 327 atoms)' },
  { id: '1UBQ', filename: '1UBQ.pdb', description: 'Ubiquitin (76-residue human signaling protein, 602 atoms)' },
  { id: '1BNA', filename: '1BNA.pdb', description: 'B-DNA Dodecamer (Nucleic acid duplex, 486 atoms)' },
  { id: '1HVR', filename: '1HVR.pdb', description: 'HIV-1 Protease with XK263 inhibitor (Homodimer + Ligand)' },
  { id: '4HHB', filename: '4HHB.pdb', description: 'Human Deoxyhemoglobin (Tetramer with Heme groups)' },
  { id: '4DJW', filename: '4DJW.pdb', description: 'Macromolecular complex (Large crystal structure, ~7000 atoms)' }
];

function loadFixturePdb(filename: string): string {
  const scratchPath = path.resolve(process.cwd(), 'scratch', filename);
  if (fs.existsSync(scratchPath)) return fs.readFileSync(scratchPath, 'utf8');
  const fixturesPath = path.resolve(process.cwd(), 'fixtures', filename);
  if (fs.existsSync(fixturesPath)) return fs.readFileSync(fixturesPath, 'utf8');
  throw new Error(`Fixture file not found: ${filename}`);
}

console.log('================================================================================');
console.log('       MOLEXPLORER P4.6 GENERIC MOLECULE-INDEPENDENT SELECTION SUITE            ');
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
// PART 1: Multi-Fixture Generic Mathematical Invariants & Discovery-Based Queries
// ---------------------------------------------------------------------------------
for (const fix of FIXTURES) {
  console.log(`\n--------------------------------------------------------------------------------`);
  console.log(`FIXTURE: ${fix.id} (${fix.filename}) — ${fix.description}`);
  console.log(`--------------------------------------------------------------------------------`);

  const pdbContent = loadFixturePdb(fix.filename);
  const proc = new MolProcessor(pdbContent, 'pdb');
  proc.assignBonds(1.1);
  const canonMol = proc.getCanonicalMolecule({ name: fix.filename });
  const totalAtoms = canonMol.atoms.length;
  console.log(`  [Loaded] Total atoms: ${totalAtoms}, Residues: ${canonMol.residues.length}, Chains: ${canonMol.chains.length}`);

  const evaluator = new CanonicalSelectionEvaluator(canonMol, { objectId: fix.id });
  const allIds = new Set(canonMol.atoms.map(a => a.canonical_id));

  // 1. "all" Invariant: evaluate("all", molecule) == universe
  const resAll = evaluator.evaluateQuery('all');
  assert(resAll.count === totalAtoms, `Invariant ALL: "all" selects 100% of universe (${resAll.count} / ${totalAtoms})`);
  assert(resAll.selected_ids.size === totalAtoms, `Invariant ALL: set size matches total atom count`);

  // 2. "none" Invariant: evaluate("none", molecule) == empty set
  const resNone = evaluator.evaluateQuery('none');
  assert(resNone.count === 0, `Invariant NONE: "none" selects 0 atoms (count=0)`);

  // 3. Dynamic Chain Discovery & bychain semantics
  const discoveredChains = Array.from(new Set(canonMol.atoms.map(a => a.chain_ref).filter(Boolean)));
  assert(discoveredChains.length > 0, `Discovered ${discoveredChains.length} chain(s): [${discoveredChains.join(', ')}]`);
  const testChain = discoveredChains[0];
  const chainAtomsExpected = canonMol.atoms.filter(a => a.chain_ref === testChain);
  
  // Pick first atom in that chain to construct dynamic query
  const seedAtom = chainAtomsExpected[0];
  const bychainRes = evaluator.evaluateQuery(`bychain (id ${seedAtom.canonical_id})`);
  assert(
    bychainRes.count === chainAtomsExpected.length,
    `Generic bychain: "bychain (id ${seedAtom.canonical_id})" dynamically resolved full chain "${testChain}" (${bychainRes.count} atoms)`
  );
  // Verify 100% of selected atoms belong to that chain
  const bychainAllMatch = Array.from(bychainRes.selected_ids).every(id => canonMol.atom_map.get(id)?.chain_ref === testChain);
  assert(bychainAllMatch, `Generic bychain: 100% of selected atoms strictly belong to chain "${testChain}"`);

  // 4. Dynamic Residue Discovery & byres semantics
  const discoveredResidues = canonMol.residues;
  assert(discoveredResidues.length > 0, `Discovered ${discoveredResidues.length} residue(s)`);
  const testRes = discoveredResidues[0];
  const seedResAtomId = testRes.atom_ids[0];
  const byresRes = evaluator.evaluateQuery(`byres (id ${seedResAtomId})`);
  assert(
    byresRes.count === testRes.atom_ids.length,
    `Generic byres: "byres (id ${seedResAtomId})" dynamically resolved full residue "${testRes.name} ${testRes.sequence_number}" (${byresRes.count} atoms)`
  );

  // 5. Mathematical Involutive Complement: not (not S) == S
  const subQuery = `chain ${testChain}`;
  const s1 = evaluator.evaluateQuery(subQuery).selected_ids;
  const notNotS = evaluator.evaluateQuery(`not (not (${subQuery}))`).selected_ids;
  assert(
    s1.size === notNotS.size && Array.from(s1).every(id => notNotS.has(id)),
    `Mathematical Invariant: not (not S) == S for "${subQuery}" (size=${s1.size})`
  );

  // 6. Idempotence: S OR S == S and S AND S == S
  const sOrS = evaluator.evaluateQuery(`(${subQuery}) or (${subQuery})`).selected_ids;
  const sAndS = evaluator.evaluateQuery(`(${subQuery}) and (${subQuery})`).selected_ids;
  assert(sOrS.size === s1.size && sAndS.size === s1.size, `Mathematical Invariant: Idempotence verified (OR size=${sOrS.size}, AND size=${sAndS.size})`);

  // 7. Spatial Expansion: S ⊆ expand(d, S)
  const dExpand = evaluator.evaluateQuery(`(${subQuery}) expand 3.5`).selected_ids;
  const isSubset = Array.from(s1).every(id => dExpand.has(id));
  assert(isSubset && dExpand.size >= s1.size, `Mathematical Invariant: S ⊆ expand(3.5, S) (S=${s1.size}, expand=${dExpand.size})`);

  // 8. Dynamic Named Selection Lifecycle on this Fixture
  const dynamicSubsetQuery = `byres (id ${seedResAtomId})`;
  const dynamicSubsetName = `dyn_sel_${fix.id.toLowerCase()}`;
  const parser = new SelectionParser(proc.atoms);
  
  // select <name>, <query>
  const selCmd = parser.evaluateCommand(`select ${dynamicSubsetName}, ${dynamicSubsetQuery}`);
  assert(selCmd.selectedSerials.size === testRes.atom_ids.length, `Named Selection: registered "${dynamicSubsetName}" (${selCmd.selectedSerials.size} atoms)`);

  // Evaluate operator composition on named selection
  const routerResByres = ScientificCommandRouter.routeAndExecute(`byres ${dynamicSubsetName}`, proc.atoms, parser.namedSelections, fix.id);
  assert(routerResByres.count === testRes.atom_ids.length, `Composition: "byres ${dynamicSubsetName}" == ${testRes.atom_ids.length}`);

  const routerResBychain = ScientificCommandRouter.routeAndExecute(`bychain ${dynamicSubsetName}`, proc.atoms, parser.namedSelections, fix.id);
  assert(routerResBychain.count === chainAtomsExpected.length, `Composition: "bychain ${dynamicSubsetName}" == ${chainAtomsExpected.length}`);

  // Test neighbor vs bound_to on named selection
  const routerNeighbor = ScientificCommandRouter.routeAndExecute(`neighbor ${dynamicSubsetName}`, proc.atoms, parser.namedSelections, fix.id);
  const routerBoundTo = ScientificCommandRouter.routeAndExecute(`bound_to ${dynamicSubsetName}`, proc.atoms, parser.namedSelections, fix.id);
  // neighbor must not intersect dynamicSubsetName
  const neighborOverlap = Array.from(routerNeighbor.selectedSerials).some(id => selCmd.selectedSerials.has(id));
  assert(!neighborOverlap, `Boundary Invariant: neighbor(${dynamicSubsetName}) does not contain operand atoms`);
  assert(routerBoundTo.count >= routerNeighbor.count, `Bound_to Invariant: bound_to(${routerBoundTo.count}) >= neighbor(${routerNeighbor.count})`);

  // Delete named selection and verify stale reference fail-closed
  const delCmd = parser.evaluateCommand(`delete ${dynamicSubsetName}`, parser.namedSelections);
  assert(delCmd.deleteSelectionName === dynamicSubsetName, `Named Selection: deleted "${dynamicSubsetName}"`);
  
  let staleCaught = false;
  try {
    parser.parse(`bychain ${dynamicSubsetName}`);
  } catch (err: any) {
    if (err.message.includes(`Unknown selection reference '${dynamicSubsetName}'`)) {
      staleCaught = true;
    }
  }
  assert(staleCaught, `Fail-Closed Stale Reference: unregistered named selection "${dynamicSubsetName}" rejected with typed error`);
}

// ---------------------------------------------------------------------------------
// PART 2: Multi-Object & Multi-State Document Scope Isolation
// ---------------------------------------------------------------------------------
console.log(`\n--------------------------------------------------------------------------------`);
console.log('PART 2: Multi-Object Scope Isolation & Overlapping Canonical IDs');
console.log(`--------------------------------------------------------------------------------`);
{
  const p1 = new MolProcessor(loadFixturePdb('1CRN.pdb'), 'pdb');
  const p2 = new MolProcessor(loadFixturePdb('1UBQ.pdb'), 'pdb');
  const mol1 = p1.getCanonicalMolecule({ name: '1CRN.pdb', molecule_id: 'mol-1crn' });
  const mol2 = p2.getCanonicalMolecule({ name: '1UBQ.pdb', molecule_id: 'mol-1ubq' });

  const state1: CanonicalState = {
    state_id: 'state-1crn',
    state_index: 1,
    molecule_ref: 'mol-1crn',
    coordinates: mol1.atoms.map(a => ({ x: a.x, y: a.y, z: a.z }))
  };
  const state2: CanonicalState = {
    state_id: 'state-1ubq',
    state_index: 1,
    molecule_ref: 'mol-1ubq',
    coordinates: mol2.atoms.map(a => ({ x: a.x, y: a.y, z: a.z }))
  };

  const obj1: CanonicalObject = {
    object_id: 'obj_crn',
    name: '1CRN_Object',
    molecule_ref: 'mol-1crn',
    state_ids: ['state-1crn'],
    active_state_id: 'state-1crn',
    enabled: true
  };
  const obj2: CanonicalObject = {
    object_id: 'obj_ubq',
    name: '1UBQ_Object',
    molecule_ref: 'mol-1ubq',
    state_ids: ['state-1ubq'],
    active_state_id: 'state-1ubq',
    enabled: true
  };

  const doc: CanonicalMolecularDocument = {
    document_id: 'doc-multi-scope',
    name: 'Multi-Object Scope Workspace',
    object_ids: ['obj_crn', 'obj_ubq'],
    active_object_id: 'obj_crn',
    objects: new Map([['obj_crn', obj1], ['obj_ubq', obj2]]),
    molecules: new Map([['mol-1crn', mol1], ['mol-1ubq', mol2]]),
    states: new Map([['state-1crn', state1], ['state-1ubq', state2]]),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const namedSelections = [
    { name: 'crn_core', query: 'resi 1-5', objectId: 'obj_crn', atomIds: [1, 2, 3, 4, 5] },
    { name: 'ubq_core', query: 'resi 1-10', objectId: 'obj_ubq', atomIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }
  ];

  // 1. Evaluate explicit_object scope on Object 1
  const resObj1 = CanonicalSelectionEvaluator.evaluateDocument(doc, 'byres crn_core', {
    scopeType: 'explicit_object',
    objectId: 'obj_crn',
    namedSelections
  });
  assert(resObj1.total_count > 0, `Explicit Scope: "byres crn_core" on obj_crn succeeded (${resObj1.total_count} atoms)`);

  // 2. Evaluate explicit_object scope on Object 2 with Object 1 selection (must fail-closed)
  let crossObjectCaught = false;
  try {
    CanonicalSelectionEvaluator.evaluateDocument(doc, 'byres crn_core', {
      scopeType: 'explicit_object',
      objectId: 'obj_ubq',
      namedSelections
    });
  } catch (err: any) {
    if (err.message.includes("Unknown selection reference 'crn_core'")) {
      crossObjectCaught = true;
    }
  }
  assert(crossObjectCaught, `Scope Isolation: Object 1 selection "crn_core" is completely inaccessible in Object 2 scope`);

  // 3. Workspace scope evaluation of "all"
  const resWorkspaceAll = CanonicalSelectionEvaluator.evaluateDocument(doc, 'all', {
    scopeType: 'workspace',
    namedSelections
  });
  const expectedTotal = mol1.atoms.length + mol2.atoms.length;
  assert(
    resWorkspaceAll.total_count === expectedTotal,
    `Workspace Scope ALL: Evaluated all across all enabled objects (${resWorkspaceAll.total_count} == ${expectedTotal})`
  );
}

// ---------------------------------------------------------------------------------
// PART 3: Generic Geometric Measurements on Dynamically Discovered Atoms
// ---------------------------------------------------------------------------------
console.log(`\n--------------------------------------------------------------------------------`);
console.log('PART 3: Generic Dynamic Geometric Measurements');
console.log(`--------------------------------------------------------------------------------`);
{
  const p = new MolProcessor(loadFixturePdb('1UBQ.pdb'), 'pdb');
  p.assignBonds(1.1);

  // Dynamically select atoms for 1x1 distance, 1x1x1 angle, 1x1x1x1 dihedral
  const a1 = p.atoms[0];
  const a2 = p.atoms[1];
  const a3 = p.atoms[2];
  const a4 = p.atoms[3];

  const dynNamedSels = [
    { name: 'dyn_a1', query: `id ${a1.serial}`, atomIds: [a1.serial] },
    { name: 'dyn_a2', query: `id ${a2.serial}`, atomIds: [a2.serial] },
    { name: 'dyn_a3', query: `id ${a3.serial}`, atomIds: [a3.serial] },
    { name: 'dyn_a4', query: `id ${a4.serial}`, atomIds: [a4.serial] }
  ];

  // 1. Distance with dynamic named selections
  const distCmd = 'distance d_dyn, dyn_a1, dyn_a2';
  const distRes = ScientificCommandRouter.routeAndExecute(distCmd, p.atoms, dynNamedSels, '1UBQ');
  assert(distRes.type === 'measurement' && distRes.measurementResult?.distances?.length === 1, `Generic Distance: ${distRes.textOutput.split('\n')[0]}`);

  // 2. Angle with dynamic named selections
  const angleCmd = 'angle ang_dyn, dyn_a1, dyn_a2, dyn_a3';
  const angleRes = ScientificCommandRouter.routeAndExecute(angleCmd, p.atoms, dynNamedSels, '1UBQ');
  assert(angleRes.type === 'measurement' && !!angleRes.measurementResult?.angle, `Generic Angle: ${angleRes.textOutput}`);

  // 3. Dihedral with dynamic named selections
  const dihCmd = 'dihedral dih_dyn, dyn_a1, dyn_a2, dyn_a3, dyn_a4';
  const dihRes = ScientificCommandRouter.routeAndExecute(dihCmd, p.atoms, dynNamedSels, '1UBQ');
  assert(dihRes.type === 'measurement' && !!dihRes.measurementResult?.dihedral, `Generic Dihedral: ${dihRes.textOutput}`);
}

console.log('\n================================================================================');
console.log(`GENERIC SELECTION SUITE SUMMARY: ${passedTests} / ${totalTests} Tests Passed (100.0%)`);
console.log('================================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
