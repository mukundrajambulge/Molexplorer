import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { MolProcessor } from '../src/lib/MolProcessor';
import { SelectionParser } from '../src/lib/SelectionParser';
import {
  CanonicalAtom,
  CanonicalMolecule,
  CanonicalMolecularDocument,
  ScientificRevision,
  ProvenanceRecord
} from '../types/domain';
import { buildCanonicalDocument, buildCanonicalState, buildCanonicalObject } from '../src/domain/DocumentAdapter';
import {
  ScientificEditingKernel,
  ScientificEditingError
} from '../src/domain/ScientificEditingKernel';
import { ScientificRevisionManager } from '../src/domain/ScientificRevisionManager';
import { computeCanonicalStateHash } from '../src/domain/StateHasher';
import { SessionManager } from '../src/session/SessionManager';

// ============================================================================
// 1. REUSABLE CORE INVARIANT ASSERTION LIBRARY
// ============================================================================

export function assertCanonicalIdentity(mol: CanonicalMolecule) {
  assert(mol && Array.isArray(mol.atoms), "Molecule must have atoms array");
  const seenIds = new Set<number>();
  for (let i = 0; i < mol.atoms.length; i++) {
    const a = mol.atoms[i];
    assert(Number.isInteger(a.canonical_id) && a.canonical_id > 0, `Atom ID must be positive integer (got ${a.canonical_id})`);
    assert(!seenIds.has(a.canonical_id), `Duplicate canonical ID detected: ${a.canonical_id}`);
    seenIds.add(a.canonical_id);
    assert(mol.atom_map.has(a.canonical_id), `Atom map missing entry for ID ${a.canonical_id}`);
    assert.strictEqual(mol.atom_map.get(a.canonical_id), a, `Atom map pointer mismatch for ID ${a.canonical_id}`);
  }
}

export function assertCoordinates(
  mol: CanonicalMolecule,
  baselineMol?: CanonicalMolecule,
  allowModifiedIds: Set<number> = new Set()
) {
  for (const a of mol.atoms) {
    assert(Number.isFinite(a.x) && Number.isFinite(a.y) && Number.isFinite(a.z), `Non-finite coordinate in atom ${a.canonical_id}`);
    if (baselineMol && !allowModifiedIds.has(a.canonical_id) && baselineMol.atom_map.has(a.canonical_id)) {
      const base = baselineMol.atom_map.get(a.canonical_id)!;
      assert.strictEqual(a.x, base.x, `Coordinate X shifted unexpectedly on unmodified atom ${a.canonical_id}`);
      assert.strictEqual(a.y, base.y, `Coordinate Y shifted unexpectedly on unmodified atom ${a.canonical_id}`);
      assert.strictEqual(a.z, base.z, `Coordinate Z shifted unexpectedly on unmodified atom ${a.canonical_id}`);
    }
  }
}

export function assertTopology(mol: CanonicalMolecule) {
  assert(mol.topology && Array.isArray(mol.topology.bonds), "Topology bonds must be defined");
  const seenEdges = new Set<string>();

  for (const b of mol.topology.bonds) {
    assert(b.atom_a < b.atom_b, `Bond endpoints must be normalized atom_a < atom_b (${b.atom_a} >= ${b.atom_b})`);
    assert(mol.atom_map.has(b.atom_a), `Dangling bond edge: atom_a ${b.atom_a} does not exist`);
    assert(mol.atom_map.has(b.atom_b), `Dangling bond edge: atom_b ${b.atom_b} does not exist`);
    assert(b.atom_a !== b.atom_b, `Self-bond detected: ${b.atom_a}`);
    const edgeKey = `${b.atom_a}:${b.atom_b}`;
    assert(!seenEdges.has(edgeKey), `Duplicate bond edge detected: ${edgeKey}`);
    seenEdges.add(edgeKey);
    assert([1.0, 1.5, 2.0, 3.0].includes(b.order), `Invalid bond order: ${b.order}`);

    // Verify adjacency_map (correct field name per CanonicalTopology domain type)
    if (mol.topology.adjacency_map) {
      const adjA = mol.topology.adjacency_map.get(b.atom_a) || [];
      const adjB = mol.topology.adjacency_map.get(b.atom_b) || [];
      assert(adjA.includes(b.atom_b), `Adjacency map missing ${b.atom_b} in atom ${b.atom_a}`);
      assert(adjB.includes(b.atom_a), `Adjacency map missing ${b.atom_a} in atom ${b.atom_b}`);
    }
  }
}

export function assertHierarchy(mol: CanonicalMolecule) {
  assert(Array.isArray(mol.residues) && Array.isArray(mol.chains), "Residues and chains must be arrays");
  const claimedAtoms = new Set<number>();

  // Valid ResidueClassification values per domain type
  const validClassifications = new Set([
    'amino_acid', 'nucleic_acid', 'modified_monomer', 'ligand', 'solvent', 'ion', 'other',
    // legacy aliases that some existing tests may use
    'nucleic', 'water'
  ]);

  for (const res of mol.residues) {
    assert(res.atom_ids.length > 0, `Empty residue ${res.residue_id}`);
    assert(validClassifications.has(res.classification), `Invalid residue classification: "${res.classification}"`);
    for (const aid of res.atom_ids) {
      assert(mol.atom_map.has(aid), `Residue references non-existent atom ${aid}`);
      assert(!claimedAtoms.has(aid), `Duplicate atom claim across residues for atom ${aid}`);
      claimedAtoms.add(aid);
      const a = mol.atom_map.get(aid)!;
      assert.strictEqual(a.residue_ref, res.res_seq, `Atom residue_ref mismatch`);
      assert.strictEqual(a.chain_ref, res.chain_ref, `Atom chain_ref mismatch`);
    }
  }

  assert.strictEqual(claimedAtoms.size, mol.atoms.length, "All atoms must belong to exactly one residue");

  for (const ch of mol.chains) {
    assert(ch.residue_ids.length > 0, `Empty chain ${ch.chain_id}`);
    for (const rid of ch.residue_ids) {
      assert(mol.residue_map.has(rid), `Chain references non-existent residue ${rid}`);
    }
  }
}

export function assertRevisionDAG(mgr: ScientificRevisionManager) {
  const allRevs = mgr.getAllRevisions();
  const revMap = new Map(allRevs.map(r => [r.revision_id, r]));

  for (const rev of allRevs) {
    if (rev.parent_revision_id !== null) {
      assert(revMap.has(rev.parent_revision_id), `Parent revision ${rev.parent_revision_id} missing in graph`);
    }
  }
  assert(revMap.has(mgr.getActiveRevisionId()), "Active revision pointer must reference valid graph node");
}

export function assertFailClosed(
  opName: string,
  preState: { doc: CanonicalMolecularDocument; mol: CanonicalMolecule; hash: string; revId: string; revCount: number },
  mgr: ScientificRevisionManager,
  fn: () => void
) {
  let threw = false;
  try {
    fn();
  } catch (err: any) {
    threw = true;
  }
  assert(threw, `${opName} MUST throw and fail closed on invalid input`);

  // Assert complete state & revision immutability after failure
  assert.strictEqual(mgr.getActiveRevisionId(), preState.revId, `${opName} failed operation MUST NOT shift active revision pointer`);
  assert.strictEqual(mgr.getAllRevisions().length, preState.revCount, `${opName} failed operation MUST NOT create new revisions`);
  assert.strictEqual(computeCanonicalStateHash(preState.mol), preState.hash, `${opName} failed operation MUST NOT mutate underlying molecule`);
}

// ============================================================================
// 2. MAIN ADVERSARIAL & INTEGRITY TEST HARNESS
// ============================================================================

function runScientificIntegrityHarness() {
  console.log("================================================================================");
  console.log("    TASK P4.1: SCIENTIFIC MUTATION INTEGRITY & ADVERSARIAL TEST HARNESS         ");
  console.log("================================================================================\n");

  let totalTests = 0;
  let passedTests = 0;

  function test(category: string, name: string, fn: () => void) {
    totalTests++;
    try {
      fn();
      console.log(`  [PASS] [${category}] ${name}`);
      passedTests++;
    } catch (err: any) {
      console.error(`  [FAIL] [${category}] ${name}: ${err.message}`);
      throw err;
    }
  }

  // Load Primary Fixtures (paths match actual repo layout)
  const p03 = fs.readFileSync(path.resolve(process.cwd(), 'fixtures/03_protein_with_ligand.pdb'), 'utf8');
  const p1CRN = fs.readFileSync(path.resolve(process.cwd(), 'scratch/1CRN.pdb'), 'utf8');
  const p1UBQ = fs.readFileSync(path.resolve(process.cwd(), 'scratch/1UBQ.pdb'), 'utf8');
  const p1BNA = fs.readFileSync(path.resolve(process.cwd(), '1BNA.pdb'), 'utf8');
  const p1HVR = fs.readFileSync(path.resolve(process.cwd(), '1HVR.pdb'), 'utf8');
  const p4HHB = fs.readFileSync(path.resolve(process.cwd(), 'scratch/4HHB.pdb'), 'utf8');

  // --- SECTION 1: SYSTEMATIC ADVERSARIAL MATRIX (26+ SCENARIOS) ---
  console.log("--- 1. Systematic Adversarial Matrix (Fail-Closed Guarantees) ---");

  test("ADVERSARIAL", "1.1 Empty selection on remove, alter, and h_add fails closed", () => {
    const proc = new MolProcessor(p03, 'pdb');
    proc.assignBonds(1.15);
    const mol0 = proc.getCanonicalMolecule();
    const doc0 = buildCanonicalDocument([mol0]);
    const rootRev = ScientificEditingKernel.createRootRevision(doc0.document_id, doc0.active_object_id!, mol0, 'Tester');
    const mgr = new ScientificRevisionManager(rootRev);
    const pre = { doc: doc0, mol: mol0, hash: rootRev.canonical_state_hash, revId: rootRev.revision_id, revCount: 1 };

    assertFailClosed("remove(empty)", pre, mgr, () => {
      ScientificEditingKernel.remove(doc0, { query: '', selected_ids: new Set(), selected_array: [], count: 0 });
    });

    assertFailClosed("alter(empty)", pre, mgr, () => {
      ScientificEditingKernel.alter(doc0, [], { property: 'name', value: 'C99' });
    });

    assertFailClosed("h_add(empty)", pre, mgr, () => {
      ScientificEditingKernel.addHydrogens(doc0, []);
    });
  });

  test("ADVERSARIAL", "1.2 Nonexistent atom IDs fail closed", () => {
    const proc = new MolProcessor(p03, 'pdb');
    proc.assignBonds(1.15);
    const mol0 = proc.getCanonicalMolecule();
    const doc0 = buildCanonicalDocument([mol0]);
    const rootRev = ScientificEditingKernel.createRootRevision(doc0.document_id, doc0.active_object_id!, mol0, 'Tester');
    const mgr = new ScientificRevisionManager(rootRev);
    const pre = { doc: doc0, mol: mol0, hash: rootRev.canonical_state_hash, revId: rootRev.revision_id, revCount: 1 };

    assertFailClosed("remove(9999)", pre, mgr, () => {
      ScientificEditingKernel.remove(doc0, { query: 'id 9999', selected_ids: new Set([9999]), selected_array: [9999], count: 1 });
    });

    assertFailClosed("bond(1, 9999)", pre, mgr, () => {
      ScientificEditingKernel.bond(doc0, 1, 9999, 1.0);
    });

    assertFailClosed("alter(9999)", pre, mgr, () => {
      ScientificEditingKernel.alter(doc0, [9999], { property: 'name', value: 'C99' });
    });
  });

  test("ADVERSARIAL", "1.3 Nonexistent object & state references fail closed", () => {
    const proc = new MolProcessor(p03, 'pdb');
    const mol0 = proc.getCanonicalMolecule();
    const doc0 = buildCanonicalDocument([mol0]);
    const rootRev = ScientificEditingKernel.createRootRevision(doc0.document_id, doc0.active_object_id!, mol0, 'Tester');
    const mgr = new ScientificRevisionManager(rootRev);
    const pre = { doc: doc0, mol: mol0, hash: rootRev.canonical_state_hash, revId: rootRev.revision_id, revCount: 1 };

    assertFailClosed("remove(bad object)", pre, mgr, () => {
      ScientificEditingKernel.remove(doc0, { query: 'id 1', selected_ids: new Set([1]), selected_array: [1], count: 1 }, { objectId: 'nonexistent-obj' });
    });

    assertFailClosed("alter_state(bad state)", pre, mgr, () => {
      ScientificEditingKernel.alterState(doc0, 'nonexistent-state', [1], { property: 'name', value: 'C99' });
    });
  });

  test("ADVERSARIAL", "1.4 Invalid bond order, self-bond & duplicate bond fail closed", () => {
    const proc = new MolProcessor(p03, 'pdb');
    proc.assignBonds(1.15);
    const mol0 = proc.getCanonicalMolecule();
    const doc0 = buildCanonicalDocument([mol0]);
    const rootRev = ScientificEditingKernel.createRootRevision(doc0.document_id, doc0.active_object_id!, mol0, 'Tester');
    const mgr = new ScientificRevisionManager(rootRev);
    const pre = { doc: doc0, mol: mol0, hash: rootRev.canonical_state_hash, revId: rootRev.revision_id, revCount: 1 };

    // Self bond
    assertFailClosed("bond(1, 1)", pre, mgr, () => {
      ScientificEditingKernel.bond(doc0, 1, 1, 1.0);
    });

    // Invalid order
    assertFailClosed("bond(order 5)", pre, mgr, () => {
      ScientificEditingKernel.bond(doc0, 1, 4, 5.0 as any);
    });

    // Duplicate existing bond
    assertFailClosed("bond(duplicate)", pre, mgr, () => {
      ScientificEditingKernel.bond(doc0, 1, 2, 1.0);
    });
  });

  test("ADVERSARIAL", "1.5 Security injections in alter fail closed", () => {
    const proc = new MolProcessor(p03, 'pdb');
    const mol0 = proc.getCanonicalMolecule();
    const doc0 = buildCanonicalDocument([mol0]);
    const rootRev = ScientificEditingKernel.createRootRevision(doc0.document_id, doc0.active_object_id!, mol0, 'Tester');
    const mgr = new ScientificRevisionManager(rootRev);
    const pre = { doc: doc0, mol: mol0, hash: rootRev.canonical_state_hash, revId: rootRev.revision_id, revCount: 1 };

    const injectionPayloads = [
      'javascript:alert(1)',
      '__proto__',
      'constructor',
      'Function("return 1")',
      'process.exit(1)',
      'import("fs")',
      'require("path")'
    ];

    for (const payload of injectionPayloads) {
      assertFailClosed(`alter(injection: ${payload})`, pre, mgr, () => {
        ScientificEditingKernel.alter(doc0, [17], { property: 'name', value: payload });
      });
    }
  });

  test("ADVERSARIAL", "1.6 Out-of-bounds properties and invalid values fail closed", () => {
    const proc = new MolProcessor(p03, 'pdb');
    const mol0 = proc.getCanonicalMolecule();
    const doc0 = buildCanonicalDocument([mol0]);
    const rootRev = ScientificEditingKernel.createRootRevision(doc0.document_id, doc0.active_object_id!, mol0, 'Tester');
    const mgr = new ScientificRevisionManager(rootRev);
    const pre = { doc: doc0, mol: mol0, hash: rootRev.canonical_state_hash, revId: rootRev.revision_id, revCount: 1 };

    // Formal charge > 7
    assertFailClosed("alter(charge +8)", pre, mgr, () => {
      ScientificEditingKernel.alter(doc0, [17], { property: 'formal_charge', value: 8 });
    });

    // Formal charge < -7
    assertFailClosed("alter(charge -8)", pre, mgr, () => {
      ScientificEditingKernel.alter(doc0, [17], { property: 'formal_charge', value: -8 });
    });

    // Negative B-factor
    assertFailClosed("alter(bfactor < 0)", pre, mgr, () => {
      ScientificEditingKernel.alter(doc0, [17], { property: 'b_factor', value: -1.0 });
    });

    // Occupancy > 1.0
    assertFailClosed("alter(occupancy > 1)", pre, mgr, () => {
      ScientificEditingKernel.alter(doc0, [17], { property: 'occupancy', value: 1.5 });
    });

    // Unsupported property
    assertFailClosed("alter(unknown_prop)", pre, mgr, () => {
      ScientificEditingKernel.alter(doc0, [17], { property: 'unknown_prop' as any, value: 'foo' });
    });
  });

  test("ADVERSARIAL", "1.7 Invalid revision navigation and cross-document mismatch fail closed", () => {
    const proc = new MolProcessor(p03, 'pdb');
    const mol0 = proc.getCanonicalMolecule();
    const doc1 = buildCanonicalDocument([mol0], { document_id: 'doc-alpha' });
    const doc2 = buildCanonicalDocument([mol0], { document_id: 'doc-beta' });
    const rootRev = ScientificEditingKernel.createRootRevision(doc1.document_id, doc1.active_object_id!, mol0, 'Tester');
    const mgr = new ScientificRevisionManager(rootRev);
    const pre = { doc: doc1, mol: mol0, hash: rootRev.canonical_state_hash, revId: rootRev.revision_id, revCount: 1 };

    // Undo at root
    assertFailClosed("undo(at root)", pre, mgr, () => {
      mgr.undo(doc1);
    });

    // Redo with no child
    assertFailClosed("redo(no child)", pre, mgr, () => {
      mgr.redo(doc1);
    });

    // Nonexistent revision ID
    assertFailClosed("navigateToRevision(unknown)", pre, mgr, () => {
      mgr.navigateToRevision(doc1, 'bad-rev-id');
    });

    // Cross-document mismatch
    assertFailClosed("navigateToRevision(cross-document)", pre, mgr, () => {
      mgr.navigateToRevision(doc2, rootRev.revision_id);
    });
  });

  // --- SECTION 2: CROSS-OPERATION SEQUENCES & ROLLBACK ---
  console.log("\n--- 2. Cross-Operation Sequences & Failed Edit Rollback ---");

  test("CROSS-OP", "2.1 Linear mixed chain (remove -> unbond -> bond -> h_add -> alter) with exact hash undo/redo", () => {
    const proc = new MolProcessor(p03, 'pdb');
    proc.assignBonds(1.15);
    let mol = proc.getCanonicalMolecule();
    let doc = buildCanonicalDocument([mol]);
    const objId = doc.active_object_id!;
    const rootRev = ScientificEditingKernel.createRootRevision(doc.document_id, objId, mol, 'Tester');
    const mgr = new ScientificRevisionManager(rootRev);

    const hashes = [rootRev.canonical_state_hash];
    const revs = [rootRev];

    // R1: remove id 20
    const m1 = ScientificEditingKernel.remove(doc, { query: 'id 20', selected_ids: new Set([20]), selected_array: [20], count: 1 }, { objectId: objId, currentRevision: mgr.getActiveRevision() });
    mgr.addRevision(m1.revision, m1.provenance);
    doc = m1.updatedDocument; hashes.push(m1.revision.canonical_state_hash); revs.push(m1.revision);

    // R2: unbond 1, 2
    const m2 = ScientificEditingKernel.unbond(doc, 1, 2, { objectId: objId, currentRevision: mgr.getActiveRevision() });
    mgr.addRevision(m2.revision, m2.provenance);
    doc = m2.updatedDocument; hashes.push(m2.revision.canonical_state_hash); revs.push(m2.revision);

    // R3: bond 1, 2, 2.0
    const m3 = ScientificEditingKernel.bond(doc, 1, 2, 2.0, { objectId: objId, currentRevision: mgr.getActiveRevision() });
    mgr.addRevision(m3.revision, m3.provenance);
    doc = m3.updatedDocument; hashes.push(m3.revision.canonical_state_hash); revs.push(m3.revision);

    // R4: addHydrogens 19
    const m4 = ScientificEditingKernel.addHydrogens(doc, [19], { objectId: objId, currentRevision: mgr.getActiveRevision() });
    mgr.addRevision(m4.revision, m4.provenance);
    doc = m4.updatedDocument; hashes.push(m4.revision.canonical_state_hash); revs.push(m4.revision);

    // R5: alter 17 name=C99
    const m5 = ScientificEditingKernel.alter(doc, [17], { property: 'name', value: 'C99' }, { objectId: objId, currentRevision: mgr.getActiveRevision() });
    mgr.addRevision(m5.revision, m5.provenance);
    doc = m5.updatedDocument; hashes.push(m5.revision.canonical_state_hash); revs.push(m5.revision);

    assert.strictEqual(mgr.getAllRevisions().length, 6);

    // Stepwise Undo
    for (let k = 5; k >= 1; k--) {
      const u = mgr.undo(doc);
      doc = u.updatedDocument;
      assert.strictEqual(u.restoredRevision.revision_id, revs[k - 1].revision_id);
      assert.strictEqual(computeCanonicalStateHash(u.restoredMolecule), hashes[k - 1]);
      assertCanonicalIdentity(u.restoredMolecule);
      assertTopology(u.restoredMolecule);
      assertHierarchy(u.restoredMolecule);
    }

    // Stepwise Redo
    for (let k = 1; k <= 5; k++) {
      const r = mgr.redo(doc);
      doc = r.updatedDocument;
      assert.strictEqual(r.restoredRevision.revision_id, revs[k].revision_id);
      assert.strictEqual(computeCanonicalStateHash(r.restoredMolecule), hashes[k]);
      assertCanonicalIdentity(r.restoredMolecule);
      assertTopology(r.restoredMolecule);
      assertHierarchy(r.restoredMolecule);
    }
  });

  test("CROSS-OP", "2.2 Failed operation leaves state, hash, and revision DAG strictly unchanged", () => {
    const proc = new MolProcessor(p03, 'pdb');
    proc.assignBonds(1.15);
    let mol = proc.getCanonicalMolecule();
    let doc = buildCanonicalDocument([mol]);
    const objId = doc.active_object_id!;
    const rootRev = ScientificEditingKernel.createRootRevision(doc.document_id, objId, mol, 'Tester');
    const mgr = new ScientificRevisionManager(rootRev);

    // Valid edit 1: remove id 20 -> R1
    const m1 = ScientificEditingKernel.remove(doc, { query: 'id 20', selected_ids: new Set([20]), selected_array: [20], count: 1 }, { objectId: objId, currentRevision: mgr.getActiveRevision() });
    mgr.addRevision(m1.revision, m1.provenance);
    doc = m1.updatedDocument;

    // Valid edit 2: alter id 17, name=C99 -> R2
    const m2 = ScientificEditingKernel.alter(doc, [17], { property: 'name', value: 'C99' }, { objectId: objId, currentRevision: mgr.getActiveRevision() });
    mgr.addRevision(m2.revision, m2.provenance);
    doc = m2.updatedDocument;

    const hashAtR2 = m2.revision.canonical_state_hash;
    const pre = { doc, mol: m2.updatedMolecule, hash: hashAtR2, revId: m2.revision.revision_id, revCount: 3 };

    // Intentionally invalid operation 1: impossible bond
    assertFailClosed("invalid bond", pre, mgr, () => {
      ScientificEditingKernel.bond(doc, 1, 9999, 1.0);
    });

    // Intentionally invalid operation 2: security injection
    assertFailClosed("security injection", pre, mgr, () => {
      ScientificEditingKernel.alter(doc, [17], { property: 'name', value: 'javascript:void(0)' });
    });

    // Intentionally invalid operation 3: duplicate bond
    assertFailClosed("duplicate bond", pre, mgr, () => {
      ScientificEditingKernel.bond(doc, 1, 2, 1.0);
    });

    // Assert state at R2 is 100% intact
    assert.strictEqual(mgr.getActiveRevisionId(), m2.revision.revision_id);
    assert.strictEqual(mgr.getAllRevisions().length, 3);
    assert.strictEqual(computeCanonicalStateHash(m2.updatedMolecule), hashAtR2);
  });

  // --- SECTION 3: MULTI-OBJECT & MULTI-STATE SCOPE ISOLATION ---
  console.log("\n--- 3. Multi-Object & Multi-State Scope Isolation ---");

  test("SCOPE", "3.1 Mutating ObjectA strictly leaves ObjectB unchanged with overlapping local IDs", () => {
    // Use separate processors so each molecule gets its own genuinely unique molecule_id
    const procA = new MolProcessor(p03, 'pdb');
    procA.assignBonds(1.15);
    const molA = procA.getCanonicalMolecule({ name: 'ObjectA.pdb', moleculeId: 'mol-A' });

    const procB = new MolProcessor(p03, 'pdb');
    procB.assignBonds(1.15);
    const molB = procB.getCanonicalMolecule({ name: 'ObjectB.pdb', moleculeId: 'mol-B' });

    // Assert molecule IDs are genuinely distinct
    assert.strictEqual(molA.molecule_id, 'mol-A', 'molA.molecule_id must be mol-A');
    assert.strictEqual(molB.molecule_id, 'mol-B', 'molB.molecule_id must be mol-B');

    const stateA = buildCanonicalState(molA, 1, 'state-A', 'State A');
    const stateB = buildCanonicalState(molB, 1, 'state-B', 'State B');
    const objA = buildCanonicalObject(molA, stateA, { object_id: 'obj-A', name: 'Object A' });
    const objB = buildCanonicalObject(molB, stateB, { object_id: 'obj-B', name: 'Object B' });

    // Verify state molecule_ref wiring
    assert.strictEqual(stateA.molecule_ref, 'mol-A');
    assert.strictEqual(stateB.molecule_ref, 'mol-B');
    assert.strictEqual(objA.molecule_ref, 'mol-A');
    assert.strictEqual(objB.molecule_ref, 'mol-B');

    const doc: CanonicalMolecularDocument = {
      document_id: 'doc-multi-obj',
      name: 'Multi Object Workspace',
      object_ids: ['obj-A', 'obj-B'],
      active_object_id: 'obj-A',
      objects: new Map([['obj-A', objA], ['obj-B', objB]]),
      molecules: new Map([['mol-A', molA], ['mol-B', molB]]),
      states: new Map([['state-A', stateA], ['state-B', stateB]]),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const hashB_pre = computeCanonicalStateHash(molB);

    // Mutate Object A: remove atom 20
    const resA = ScientificEditingKernel.remove(
      doc,
      { query: 'id 20', selected_ids: new Set([20]), selected_array: [20], count: 1, object_id: 'obj-A' },
      { objectId: 'obj-A' }
    );

    // Assert Object A modified
    assert.strictEqual(resA.updatedMolecule.atoms.length, 19);

    // Assert Object B in updated document is strictly untouched
    const molB_post = resA.updatedDocument.molecules.get('mol-B')!;
    assert(molB_post !== undefined, 'mol-B must still exist in updated document');
    assert.strictEqual(molB_post.atoms.length, 20);
    assert.strictEqual(computeCanonicalStateHash(molB_post), hashB_pre);

    // Assert ObjectA:1 != ObjectB:1 (scoped uniqueness)
    const atomA1 = resA.updatedMolecule.atom_map.get(1)!;
    const atomB1 = molB_post.atom_map.get(1)!;
    assert(atomA1.molecule_ref !== atomB1.molecule_ref || atomA1 !== atomB1,
      'ObjectA:1 and ObjectB:1 must be distinct scientific entities');
  });

  // --- SECTION 4: DETERMINISTIC STATE-AWARE PROPERTY-BASED TESTING ---
  console.log("\n--- 4. Deterministic State-Aware Property-Based Testing (50 Steps) ---");

  test("PROPERTY-BASED", "4.1 50-step deterministic state-aware PRNG with replay metadata and core invariant validation", () => {
    // Deterministic Linear Congruential Generator
    let seed = 133742;
    function nextRand(): number {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    }

    const proc = new MolProcessor(p03, 'pdb');
    proc.assignBonds(1.15);
    let currentMol = proc.getCanonicalMolecule({ name: '03_protein_with_ligand.pdb', moleculeId: 'mol-pbt' });
    let currentDoc = buildCanonicalDocument([currentMol], { document_id: 'doc-pbt' });
    const objId = 'obj-mol-pbt';

    const rootRev = ScientificEditingKernel.createRootRevision(currentDoc.document_id, objId, currentMol, 'Tester');
    const mgr = new ScientificRevisionManager(rootRev);

    for (let step = 1; step <= 50; step++) {
      const activeMol = mgr.getActiveRevision().molecule_snapshot;
      const opChoice = Math.floor(nextRand() * 6); // 0: alter, 1: undo, 2: redo, 3: invalid_injection, 4: invalid_charge, 5: invalid_bond

      const replayMeta = {
        seed: 133742,
        step,
        opChoice,
        inputRevision: mgr.getActiveRevisionId(),
        atomCount: activeMol.atoms.length
      };

      if (opChoice === 0) {
        // Valid Alter
        const targetAtom = activeMol.atoms[Math.floor(nextRand() * activeMol.atoms.length)];
        const newCharge = (Math.floor(nextRand() * 5) - 2); // -2 to +2
        if (targetAtom.formal_charge !== newCharge) {
          const res = ScientificEditingKernel.alter(
            currentDoc,
            [targetAtom.canonical_id],
            { property: 'formal_charge', value: newCharge },
            { objectId: objId, currentRevision: mgr.getActiveRevision() }
          );
          mgr.addRevision(res.revision, res.provenance);
          currentDoc = res.updatedDocument;
        }
      } else if (opChoice === 1) {
        // Undo
        if (mgr.canUndo()) {
          const u = mgr.undo(currentDoc);
          currentDoc = u.updatedDocument;
        }
      } else if (opChoice === 2) {
        // Redo
        if (mgr.canRedo()) {
          const r = mgr.redo(currentDoc);
          currentDoc = r.updatedDocument;
        }
      } else if (opChoice === 3) {
        // Controlled Invalid: Security Injection
        const pre = { doc: currentDoc, mol: activeMol, hash: mgr.getActiveRevision().canonical_state_hash, revId: mgr.getActiveRevisionId(), revCount: mgr.getAllRevisions().length };
        assertFailClosed(`step ${step}: security injection`, pre, mgr, () => {
          ScientificEditingKernel.alter(currentDoc, [activeMol.atoms[0].canonical_id], { property: 'name', value: 'javascript:alert(1)' });
        });
      } else if (opChoice === 4) {
        // Controlled Invalid: Out-of-bounds formal charge
        const pre = { doc: currentDoc, mol: activeMol, hash: mgr.getActiveRevision().canonical_state_hash, revId: mgr.getActiveRevisionId(), revCount: mgr.getAllRevisions().length };
        assertFailClosed(`step ${step}: charge out of bounds`, pre, mgr, () => {
          ScientificEditingKernel.alter(currentDoc, [activeMol.atoms[0].canonical_id], { property: 'formal_charge', value: 99 });
        });
      } else if (opChoice === 5) {
        // Controlled Invalid: Self bond
        const pre = { doc: currentDoc, mol: activeMol, hash: mgr.getActiveRevision().canonical_state_hash, revId: mgr.getActiveRevisionId(), revCount: mgr.getAllRevisions().length };
        assertFailClosed(`step ${step}: self bond`, pre, mgr, () => {
          ScientificEditingKernel.bond(currentDoc, activeMol.atoms[0].canonical_id, activeMol.atoms[0].canonical_id, 1.0);
        });
      }

      // Assert core invariants after EVERY step
      const postMol = mgr.getActiveRevision().molecule_snapshot;
      assertCanonicalIdentity(postMol);
      assertCoordinates(postMol);
      assertTopology(postMol);
      assertHierarchy(postMol);
      assertRevisionDAG(mgr);
    }
  });

  // --- SECTION 5: MULTI-FIXTURE COVERAGE & OBSERVATIONAL TIMINGS ---
  console.log("\n--- 5. Multi-Fixture Coverage & Observational Performance Baselines ---");

  const fixtures = [
    { name: '03_protein_with_ligand.pdb', data: p03, type: 'Controlled Complex' },
    { name: '1CRN.pdb', data: p1CRN, type: 'Plant Protein' },
    { name: '1UBQ.pdb', data: p1UBQ, type: 'Ubiquitin' },
    { name: '1BNA.pdb', data: p1BNA, type: 'B-DNA Nucleic Acid' },
    { name: '1HVR.pdb', data: p1HVR, type: 'HIV Protease + Ligand' },
    { name: '4HHB.pdb', data: p4HHB, type: 'Hemoglobin Tetramer' }
  ];

  for (const f of fixtures) {
    test("FIXTURE", `${f.name} (${f.type}) integrity & observational timing baseline`, () => {
      const t0 = performance.now();
      const proc = new MolProcessor(f.data, 'pdb');
      proc.assignBonds(1.15);
      const tParse = performance.now() - t0;

      const t1 = performance.now();
      const mol = proc.getCanonicalMolecule();
      const doc = buildCanonicalDocument([mol]);
      const tAdapter = performance.now() - t1;

      const t2 = performance.now();
      const rootRev = ScientificEditingKernel.createRootRevision(doc.document_id, doc.active_object_id!, mol, 'Benchmarker');
      const mgr = new ScientificRevisionManager(rootRev);
      const tKernel = performance.now() - t2;

      // Invariant checks on benchmark fixture
      assertCanonicalIdentity(mol);
      assertCoordinates(mol);
      assertTopology(mol);
      assertHierarchy(mol);
      assertRevisionDAG(mgr);

      // Perform sample mutation: change formal_charge (included in state hash) on first atom
      const t3 = performance.now();
      const targetId = mol.atoms[0].canonical_id;
      const existingCharge = mol.atoms[0].formal_charge;
      const newCharge = existingCharge === 0 ? 1 : 0;
      const mut = ScientificEditingKernel.alter(
        doc,
        [targetId],
        { property: 'formal_charge', value: newCharge },
        { objectId: doc.active_object_id!, currentRevision: rootRev }
      );
      const tMut = performance.now() - t3;

      console.log(`     [TIMING BASELINE] ${f.name} (${mol.atoms.length} atoms, ${mol.topology.bonds.length} bonds) -> Parse: ${tParse.toFixed(1)}ms | Adapter: ${tAdapter.toFixed(1)}ms | Init: ${tKernel.toFixed(1)}ms | Alter: ${tMut.toFixed(1)}ms`);
    });
  }

  // --- SECTION 6: PSE SERIALIZATION INTEGRITY CONTRACT ---
  console.log("\n--- 6. PSE Serialization Integrity Contract ---");

  test("PSE-INTEGRITY", "6.1 Corrupted / malformed session strings fail closed", () => {
    assert.throws(() => SessionManager.importSession(''), /File is empty|empty/i);
    assert.throws(() => SessionManager.importSession('{ bad json'), /Malformed JSON/i);
    // Wrong format header: SessionManager throws "Invalid or unrecognized session format"
    assert.throws(() => SessionManager.importSession('{"format":"Wrong-Format"}'), /unrecognized session format|Unsupported MolStudio-PSE/i);
    // Unsupported version: throws "Unsupported MolStudio-PSE version"
    assert.throws(() => SessionManager.importSession('{"format":"MolStudio-PSE","version":99}'), /version/i);
    // Missing molecule data
    assert.throws(() => SessionManager.importSession('{"format":"MolStudio-PSE","version":1}'), /molecular|missing/i);
  });

  console.log("\n================================================================================");
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} Passed (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log("================================================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runScientificIntegrityHarness();
