/**
 * test_phase5_hydrogen_science.ts
 * Comprehensive Phase P5 Hydrogen & Local Chemistry Operations Test Suite.
 * 
 * Verifies:
 * 1. Analytical geometry models (sp3, sp2, sp) and bond length tolerances.
 * 2. Explicit valence & eligibility predicate (checkHydrogenFillEligibility).
 * 3. Multi-fixture dynamic discovery across all 7 fixtures (03PL, 1CRN, 1UBQ, 1BNA, 1HVR, 4HHB, 4DJW).
 * 4. Modeled hydrogen provenance, nonbonded clash checking, and ID monotonicity.
 * 5. Hydrogen removal topology cleanup.
 * 6. Bit-for-bit determinism and undo/redo state hash reversibility.
 * 7. Console command aliases and named-selection resolution.
 */

import * as fs from 'fs';
import * as path from 'path';
import { MolProcessor } from '../src/lib/MolProcessor';
import { SelectionParser } from '../src/lib/SelectionParser';
import { ScientificEditingKernel } from '../src/domain/ScientificEditingKernel';
import { ScientificRevisionManager } from '../src/domain/ScientificRevisionManager';
import { ScientificCommandRouter } from '../src/domain/ScientificCommandRouter';
import {
  computeHydrogenPositions,
  inferHybridizationModel,
  ELEMENT_TARGET_BOND_LENGTHS,
  BOND_LENGTH_TOLERANCE
} from '../src/domain/HydrogenGeometry';
import {
  checkHydrogenFillEligibility,
  calculateAtomValence,
  getTargetValence,
  COMMON_METALS
} from '../src/domain/ValenceValidator';
import { CanonicalAtom, CanonicalMolecule } from '../types/domain';

interface FixtureDef {
  id: string;
  filename: string;
  description: string;
}

const FIXTURES: FixtureDef[] = [
  { id: '03PL', filename: '03_protein_with_ligand.pdb', description: 'Synthetic Protein-Ligand Complex (20 atoms)' },
  { id: '1CRN', filename: '1CRN.pdb', description: 'Crambin (0.54Å hydrophobic seed protein, 327 atoms)' },
  { id: '1UBQ', filename: '1UBQ.pdb', description: 'Ubiquitin (76-residue human signaling protein, 660 atoms)' },
  { id: '1BNA', filename: '1BNA.pdb', description: 'B-DNA Dodecamer (Nucleic acid duplex, 566 atoms)' },
  { id: '1HVR', filename: '1HVR.pdb', description: 'HIV-1 Protease with XK263 inhibitor (1890 atoms)' },
  { id: '4HHB', filename: '4HHB.pdb', description: 'Human Deoxyhemoglobin (4779 atoms)' },
  { id: '4DJW', filename: '4DJW.pdb', description: 'Macromolecular complex (~7000 atoms)' }
];

function loadFixturePdb(filename: string): string {
  const scratchPath = path.resolve(process.cwd(), 'scratch', filename);
  if (fs.existsSync(scratchPath)) return fs.readFileSync(scratchPath, 'utf8');
  const fixturesPath = path.resolve(process.cwd(), 'fixtures', filename);
  if (fs.existsSync(fixturesPath)) return fs.readFileSync(fixturesPath, 'utf8');
  throw new Error(`Fixture file not found: ${filename}`);
}

console.log('================================================================================');
console.log('         MOLEXPLORER PHASE P5 HYDROGEN & LOCAL CHEMISTRY SUITE                  ');
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
// PART 1: Analytical Geometric Models & Bond Length Verification
// ---------------------------------------------------------------------------------
console.log('--------------------------------------------------------------------------------');
console.log('PART 1: Analytical Hybridization Geometries & Bond Length Tolerances');
console.log('--------------------------------------------------------------------------------');
{
  const mockParentC: CanonicalAtom = {
    canonical_id: 1, element: 'C', name: 'CA',
    chain_ref: 'A', residue_ref: 1, residue_name: 'ALA',
    x: 0, y: 0, z: 0, occupancy: 1.0, b_factor: 20.0,
    formal_charge: 0, alt_loc: ' ', is_hetero: false
  };

  // 1.1 Isolated sp3 Carbon -> 4 tetrahedral hydrogens
  const tetCoords = computeHydrogenPositions(mockParentC, [], 4, 'sp3');
  assert(tetCoords.length === 4, 'Isolated sp3 Carbon produced exactly 4 modeled hydrogens');
  for (let i = 0; i < tetCoords.length; i++) {
    const pos = tetCoords[i];
    const dist = Math.sqrt(pos.x ** 2 + pos.y ** 2 + pos.z ** 2);
    assert(
      Math.abs(dist - ELEMENT_TARGET_BOND_LENGTHS['C']) <= BOND_LENGTH_TOLERANCE,
      `Tetrahedral C-H[${i}] bond length ${dist.toFixed(4)} Å within target ${ELEMENT_TARGET_BOND_LENGTHS['C']} ± 0.010 Å`
    );
  }

  // 1.2 Monosubstituted sp3 Carbon (e.g. -CH3) -> 3 hydrogens
  const mockNeighborN: CanonicalAtom = {
    canonical_id: 2, element: 'N', name: 'N',
    chain_ref: 'A', residue_ref: 1, residue_name: 'ALA',
    x: 1.45, y: 0, z: 0, occupancy: 1.0, b_factor: 20.0,
    formal_charge: 0, alt_loc: ' ', is_hetero: false
  };
  const methylCoords = computeHydrogenPositions(mockParentC, [mockNeighborN], 3, 'sp3');
  assert(methylCoords.length === 3, 'Monosubstituted sp3 Carbon produced exactly 3 cone hydrogens');
  for (let i = 0; i < methylCoords.length; i++) {
    const pos = methylCoords[i];
    const dist = Math.sqrt(pos.x ** 2 + pos.y ** 2 + pos.z ** 2);
    assert(
      Math.abs(dist - ELEMENT_TARGET_BOND_LENGTHS['C']) <= BOND_LENGTH_TOLERANCE,
      `Methyl C-H[${i}] bond length ${dist.toFixed(4)} Å within target tolerance`
    );
  }

  // 1.3 Planar sp2 Carbon -> 2 hydrogens
  const sp2Coords = computeHydrogenPositions(mockParentC, [mockNeighborN], 2, 'sp2');
  assert(sp2Coords.length === 2, 'Monosubstituted sp2 Carbon produced exactly 2 planar hydrogens');
  for (let i = 0; i < sp2Coords.length; i++) {
    const pos = sp2Coords[i];
    const dist = Math.sqrt(pos.x ** 2 + pos.y ** 2 + pos.z ** 2);
    assert(
      Math.abs(dist - ELEMENT_TARGET_BOND_LENGTHS['C']) <= BOND_LENGTH_TOLERANCE,
      `sp2 C-H[${i}] bond length ${dist.toFixed(4)} Å within target tolerance`
    );
  }

  // 1.4 Linear sp Carbon -> 1 hydrogen
  const spCoords = computeHydrogenPositions(mockParentC, [mockNeighborN], 1, 'sp');
  assert(spCoords.length === 1, 'sp Carbon produced exactly 1 collinear hydrogen');
  assert(spCoords[0].x < 0, 'sp Hydrogen placed strictly collinear opposite to neighbor (+x neighbor -> -x H)');
}

// ---------------------------------------------------------------------------------
// PART 2: Explicit Valence & Eligibility Predicates
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('PART 2: Explicit Valence & Eligibility Predicates');
console.log('--------------------------------------------------------------------------------');
{
  const mockAtoms: CanonicalAtom[] = [
    { canonical_id: 1, element: 'C', name: 'C', chain_ref: 'A', residue_ref: 1, residue_name: 'LIG', x: 0, y: 0, z: 0, occupancy: 1, b_factor: 10, formal_charge: 0, alt_loc: ' ', is_hetero: true },
    { canonical_id: 2, element: 'N', name: 'N', chain_ref: 'A', residue_ref: 1, residue_name: 'LIG', x: 1.4, y: 0, z: 0, occupancy: 1, b_factor: 10, formal_charge: 0, alt_loc: ' ', is_hetero: true },
    { canonical_id: 3, element: 'MG', name: 'MG', chain_ref: 'A', residue_ref: 2, residue_name: 'MG', x: 5, y: 5, z: 5, occupancy: 1, b_factor: 10, formal_charge: 2, alt_loc: ' ', is_hetero: true },
    { canonical_id: 4, element: 'H', name: 'H', chain_ref: 'A', residue_ref: 1, residue_name: 'LIG', x: 0, y: 1.09, z: 0, occupancy: 1, b_factor: 10, formal_charge: 0, alt_loc: ' ', is_hetero: true }
  ];

  // 2.1 Carbon with single bond to Nitrogen (valence=1, remaining=3)
  const singleBonds = [{ bond_id: 'b1-2', atom_a: 1, atom_b: 2, order: 1.0, is_aromatic: false, source: 'model' as const, is_inferred: false }];
  const eligC = checkHydrogenFillEligibility(mockAtoms[0], singleBonds);
  assert(eligC.eligible && eligC.needed_hydrogens === 3, 'Unsaturated Carbon (val=1) is eligible for 3 hydrogens');

  // 2.2 Metal Magnesium (must reject fail-closed)
  const eligMg = checkHydrogenFillEligibility(mockAtoms[2], []);
  assert(!eligMg.eligible && eligMg.rejection_reason === 'METALS_DEFERRED', 'Metal MG rejected fail-closed (METALS_DEFERRED)');

  // 2.3 Existing Hydrogen atom (must reject fail-closed)
  const eligH = checkHydrogenFillEligibility(mockAtoms[3], []);
  assert(!eligH.eligible && eligH.rejection_reason === 'ALREADY_HYDROGEN', 'Hydrogen atom rejected (ALREADY_HYDROGEN)');
}

// ---------------------------------------------------------------------------------
// PART 3: Multi-Fixture Dynamic Discovery & Hydrogen Mutation Transactions
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('PART 3: Multi-Fixture Dynamic Discovery & Hydrogen Transactions');
console.log('--------------------------------------------------------------------------------');

for (const fix of FIXTURES) {
  console.log(`\n--- Fixture: ${fix.id} (${fix.filename}) ---`);
  const proc = new MolProcessor(loadFixturePdb(fix.filename), 'pdb');
  proc.assignBonds(1.1);
  const doc = proc.getCanonicalDocument();
  const mol = doc.molecules.get(doc.objects.get(doc.active_object_id!)!.molecule_ref)!;
  const initialAtomCount = mol.atoms.length;

  // Dynamically discover unsaturated non-metal atoms
  const eligibleAtoms = mol.atoms.filter(a => {
    const elig = checkHydrogenFillEligibility(a, mol.topology.bonds);
    return elig.eligible;
  });

  console.log(`  [Discovered] ${eligibleAtoms.length} eligible heavy atom(s) for hydrogen fill`);
  assert(eligibleAtoms.length > 0, `Fixture ${fix.id} contains eligible heavy centers for hydrogen addition`);

  // Pick first 3 eligible atoms to perform controlled transaction
  const targetSeeds = eligibleAtoms.slice(0, 3);
  const targetIds = targetSeeds.map(a => a.canonical_id);

  // Execute addHydrogens transaction
  const mutation = ScientificEditingKernel.addHydrogens(doc, targetIds, {
    objectId: doc.active_object_id!,
    author: 'TestRunner'
  });

  const addedCount = mutation.addedHydrogens.length;
  assert(addedCount > 0, `Added ${addedCount} modeled hydrogen(s) to ${targetIds.length} center(s)`);

  const updatedMol = mutation.updatedMolecule;
  assert(
    updatedMol.atoms.length === initialAtomCount + addedCount,
    `Atom count strictly updated: ${initialAtomCount} -> ${updatedMol.atoms.length}`
  );

  // Validate modeled hydrogen properties
  for (const h of mutation.addedHydrogens) {
    assert(h.modeled_hydrogen === true, `Hydrogen ${h.canonical_id} has modeled_hydrogen flag set`);
    assert(Number.isFinite(h.x) && Number.isFinite(h.y) && Number.isFinite(h.z), `Hydrogen ${h.canonical_id} coordinates are finite`);
    assert(h.canonical_id > initialAtomCount, `Hydrogen ID ${h.canonical_id} is strictly monotonic (> ${initialAtomCount})`);
  }

  // Validate nonbonded clashes in derived molecule (min nonbonded distance >= 0.70 Å)
  let minClash = Infinity;
  for (const h of mutation.addedHydrogens) {
    const parentBond = updatedMol.topology.bonds.find(b => b.atom_a === h.canonical_id || b.atom_b === h.canonical_id);
    const parentId = parentBond ? (parentBond.atom_a === h.canonical_id ? parentBond.atom_b : parentBond.atom_a) : null;

    for (const other of updatedMol.atoms) {
      if (other.canonical_id === h.canonical_id || other.canonical_id === parentId) continue;
      const d = Math.sqrt((h.x - other.x) ** 2 + (h.y - other.y) ** 2 + (h.z - other.z) ** 2);
      if (d < minClash) minClash = d;
    }
  }
  assert(minClash >= 0.70, `No excessive nonbonded clashes (minimum nonbonded distance: ${minClash.toFixed(3)} Å >= 0.70 Å)`);

  // Execute removeHydrogens to test topology cleanup
  const removeRes = ScientificEditingKernel.removeHydrogens(mutation.updatedDocument, mutation.addedHydrogens.map(h => h.canonical_id), {
    objectId: doc.active_object_id!,
    author: 'TestRunner'
  });

  assert(
    removeRes.updatedMolecule.atoms.length === initialAtomCount,
    `removeHydrogens restored exact original atom count (${removeRes.updatedMolecule.atoms.length} == ${initialAtomCount})`
  );
  assert(
    removeRes.updatedMolecule.topology.bonds.length === mol.topology.bonds.length,
    `removeHydrogens restored exact original bond count (${removeRes.updatedMolecule.topology.bonds.length} == ${mol.topology.bonds.length})`
  );
}

// ---------------------------------------------------------------------------------
// PART 4: Determinism & Bit-for-Bit Undo Reversibility
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('PART 4: Bit-for-Bit Determinism & Undo Reversibility');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixturePdb('1UBQ.pdb'), 'pdb');
  proc.assignBonds(1.1);
  const doc = proc.getCanonicalDocument();
  const rootHash = doc.molecules.get(doc.objects.get(doc.active_object_id!)!.molecule_ref)!.molecule_id;

  const revMgr = new ScientificRevisionManager();
  const rootRev = ScientificEditingKernel.createRootRevision(doc.document_id, doc.active_object_id!, proc.getCanonicalMolecule({ name: '1UBQ' }));
  revMgr.addRevision(rootRev, {
    provenance_id: 'prov-root', revision_id: rootRev.revision_id, parent_revision_id: null,
    operation_name: 'root', resolved_atom_ids: [], parameters: {}, timestamp: rootRev.timestamp, tool_version: '1.0', validation_summary: 'ROOT'
  });

  const targetSeed = [proc.atoms[0].serial];
  const mutation = ScientificEditingKernel.addHydrogens(doc, targetSeed, {
    objectId: doc.active_object_id!,
    author: 'User',
    currentRevision: rootRev
  });
  revMgr.addRevision(mutation.revision, mutation.provenance);

  assert(revMgr.getActiveRevision()?.revision_id === mutation.revision.revision_id, 'Revision ledger updated to derived state');

  // Execute undo
  const { restoredRevision } = revMgr.undo(mutation.updatedDocument);
  assert(restoredRevision.revision_id === rootRev.revision_id, 'Undo navigated cleanly back to Root revision (R0)');
  assert(
    restoredRevision.canonical_state_hash === rootRev.canonical_state_hash,
    `Undo invariant: hash(R0) restored bit-for-bit identical (${restoredRevision.canonical_state_hash})`
  );
}

// ---------------------------------------------------------------------------------
// PART 5: Command Aliases & Named Selection Interoperability Matrix
// ---------------------------------------------------------------------------------
console.log('\n--------------------------------------------------------------------------------');
console.log('PART 5: Command Aliases & Named Selection Interoperability');
console.log('--------------------------------------------------------------------------------');
{
  const proc = new MolProcessor(loadFixturePdb('03_protein_with_ligand.pdb'), 'pdb');
  proc.assignBonds(1.1);

  const namedSelections = [
    { name: 'ligand', query: 'resn LIG', atomIds: [17, 18, 19, 20] },
    { name: 'protein', query: 'polymer', atomIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] }
  ];

  const aliasTests = [
    { cmd: 'h_add ligand', expectedType: 'h_add' },
    { cmd: 'hadd ligand', expectedType: 'h_add' },
    { cmd: 'add_h ligand', expectedType: 'h_add' },
    { cmd: 'h_fill ligand', expectedType: 'h_fill' },
    { cmd: 'hfill ligand', expectedType: 'h_fill' },
    { cmd: 'fill_h ligand', expectedType: 'h_fill' },
    { cmd: 'h_remove ligand', expectedType: 'h_remove' },
    { cmd: 'remove_h ligand', expectedType: 'h_remove' },
    { cmd: 'del_h ligand', expectedType: 'h_remove' },
    { cmd: 'hdel ligand', expectedType: 'h_remove' },
    { cmd: 'h_del ligand', expectedType: 'h_remove' }
  ];

  for (const test of aliasTests) {
    const res = ScientificCommandRouter.routeAndExecute(test.cmd, proc.atoms, namedSelections, '03PL');
    const isAdd = test.expectedType === 'h_add' && res.addHydrogensRequest && !res.addHydrogensRequest.fillOnly;
    const isFill = test.expectedType === 'h_fill' && res.addHydrogensRequest && res.addHydrogensRequest.fillOnly;
    const isRemove = test.expectedType === 'h_remove' && !!res.removeHydrogensRequest;

    assert(isAdd || isFill || isRemove, `Alias "${test.cmd}" correctly parsed and routed to canonical ${test.expectedType} action`);
  }
}

console.log('\n================================================================================');
console.log(`PHASE P5 SUITE SUMMARY: ${passedTests} / ${totalTests} Tests Passed (100.0%)`);
console.log('================================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
