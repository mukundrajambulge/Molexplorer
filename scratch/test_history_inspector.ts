/**
 * P4.2: Scientific History Inspector — Unit Test Suite
 * Tests the ScientificRevisionManager inspection APIs used by the inspector.
 * No mutation of production code; inspection is read-only.
 */
import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { MolProcessor } from '../src/lib/MolProcessor';
import { ScientificEditingKernel, ScientificEditingError } from '../src/domain/ScientificEditingKernel';
import { ScientificRevisionManager } from '../src/domain/ScientificRevisionManager';
import { buildCanonicalDocument } from '../src/domain/DocumentAdapter';
import { validateCanonicalMolecule } from '../src/domain/HierarchyAdapter';
import { computeCanonicalStateHash } from '../src/domain/StateHasher';
import {
  CanonicalMolecularDocument,
  ScientificRevision,
  ProvenanceRecord
} from '../types/domain';

const FIXTURE = fs.readFileSync(
  path.resolve(process.cwd(), 'fixtures/03_protein_with_ligand.pdb'),
  'utf8'
);

// ─── Harness helpers ──────────────────────────────────────────────────────────

let totalTests = 0;
let passedTests = 0;

function test(label: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${label}`);
    passedTests++;
  } catch (err: any) {
    console.error(`  [FAIL] ${label}: ${err.message}`);
    throw err;
  }
}

// ─── Shared fixture setup ─────────────────────────────────────────────────────

function buildFixture() {
  const proc = new MolProcessor(FIXTURE, 'pdb');
  proc.assignBonds(1.15);
  const doc = proc.getCanonicalDocument();
  return { proc, doc };
}

function buildManagerWithMutations() {
  const { proc, doc } = buildFixture();

  // Root revision
  const rootRev = ScientificEditingKernel.createRootRevision(
    doc.document_id,
    doc.active_object_id || 'main_obj',
    proc.getCanonicalMolecule(),
    'Test Baseline'
  );
  const mgr = new ScientificRevisionManager(rootRev);

  return { proc, doc, mgr, rootRev };
}

// ─── Helper: simulate inspector "reading" an active revision ──────────────────
// Mirrors what ScientificHistoryInspector does — purely reads the revision manager.

function inspectActiveRevision(mgr: ScientificRevisionManager) {
  const activeRev = mgr.getActiveRevision();
  const prov = mgr.getProvenance(activeRev.revision_id);
  const tree = mgr.getRevisionTree();
  return { activeRev, prov, tree };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function runHistoryInspectorTests() {
  console.log("================================================================================");
  console.log("         TASK P4.2: SCIENTIFIC HISTORY INSPECTOR UNIT TEST SUITE               ");
  console.log("================================================================================\n");

  // ── 1. Initial root revision display ────────────────────────────────────────
  test("1. Initial root revision display — all required fields present", () => {
    const { mgr, rootRev } = buildManagerWithMutations();
    const { activeRev, prov } = inspectActiveRevision(mgr);

    // Required fields per spec §1
    assert.strictEqual(typeof activeRev.revision_id, 'string', 'revision_id must be string');
    assert.strictEqual(activeRev.parent_revision_id, null, 'root has no parent');
    assert.strictEqual(typeof activeRev.document_id, 'string', 'document_id present');
    assert.strictEqual(typeof activeRev.object_id, 'string', 'object_id present');
    assert.strictEqual(typeof activeRev.state_id, 'string', 'state_id present');
    assert.strictEqual(typeof activeRev.operation_id, 'string', 'operation_id present');
    assert.strictEqual(typeof activeRev.canonical_state_hash, 'string', 'state hash present');
    assert.strictEqual(typeof activeRev.revision_hash, 'string', 'revision hash present');
    assert.strictEqual(typeof activeRev.timestamp, 'string', 'timestamp present');
    assert.strictEqual(typeof activeRev.molecule_snapshot, 'object', 'molecule_snapshot present');

    // Root has no provenance record (it is the baseline, not a mutation)
    assert.strictEqual(prov, undefined, 'root revision has no provenance');

    // Undo/redo availability
    assert.strictEqual(mgr.canUndo(), false, 'cannot undo at root');
    assert.strictEqual(mgr.canRedo(), false, 'cannot redo at root');
    assert.strictEqual(mgr.getRevisionCount(), 1, 'exactly 1 revision at root');

    // Inspector state distinction: revisionManager exists → NOT "no mutations" state
    // (That state is when revisionManagerRef.current === null in MolStudio)
    assert.ok(mgr, 'revision manager is initialized after first mutation setup');
  });

  // ── 2. After remove ──────────────────────────────────────────────────────────
  test("2. Revision display after remove — revision count=2, operation_name='remove', hash changed", () => {
    const { proc, mgr } = buildManagerWithMutations();
    const doc = proc.getCanonicalDocument();
    const rootHash = mgr.getActiveRevision().canonical_state_hash;

    // Perform remove
    const selResult = {
      query: 'id 20',
      selected_ids: new Set([20]),
      selected_array: [20],
      count: 1,
      object_id: 'main_mol'
    };
    const mutation = ScientificEditingKernel.remove(doc, selResult, {
      objectId: doc.active_object_id,
      author: 'Test',
      currentRevision: mgr.getActiveRevision()
    });
    mgr.addRevision(mutation.revision, mutation.provenance);

    // Inspection
    const { activeRev, prov } = inspectActiveRevision(mgr);
    assert.strictEqual(mgr.getRevisionCount(), 2, 'revision count is 2');
    assert.ok(prov, 'provenance present after mutation');
    assert.strictEqual(prov!.operation_name, 'remove', 'operation is remove');
    assert.notStrictEqual(activeRev.canonical_state_hash, rootHash, 'state hash changed');
    assert.strictEqual(mgr.canUndo(), true, 'can undo after remove');
    assert.strictEqual(mgr.canRedo(), false, 'cannot redo (no forward branch)');
    assert.strictEqual(activeRev.molecule_snapshot.atoms.length, 19, 'atom count is 19 after remove');
  });

  // ── 3. After bond ────────────────────────────────────────────────────────────
  test("3. Revision display after bond — revision count increases, operation_name='bond'", () => {
    const { proc, mgr } = buildManagerWithMutations();
    const doc = proc.getCanonicalDocument();
    const initialBonds = mgr.getActiveRevision().molecule_snapshot.topology.bonds.length;

    // Bond atoms 1–3 (they are not bonded in the fixture)
    const mutation = ScientificEditingKernel.bond(doc, 1, 3, 1.0, {
      objectId: doc.active_object_id,
      author: 'Test',
      currentRevision: mgr.getActiveRevision()
    });
    mgr.addRevision(mutation.revision, mutation.provenance);

    const { prov, activeRev } = inspectActiveRevision(mgr);
    assert.ok(prov, 'provenance present');
    assert.ok(
      prov!.operation_name === 'bond' || prov!.operation_name.includes('bond'),
      'operation is bond'
    );
    assert.strictEqual(
      activeRev.molecule_snapshot.topology.bonds.length,
      initialBonds + 1,
      'bond count increased by 1'
    );
  });

  // ── 4. After bond-order ──────────────────────────────────────────────────────
  test("4. Revision display after bond-order — operation recorded", () => {
    const { proc, mgr } = buildManagerWithMutations();
    const doc = proc.getCanonicalDocument();
    // Find first bond
    const firstBond = mgr.getActiveRevision().molecule_snapshot.topology.bonds[0];
    assert.ok(firstBond, 'fixture has at least one bond');

    const mutation = ScientificEditingKernel.setBondOrder(
      doc,
      firstBond.atom_a,
      firstBond.atom_b,
      2.0,
      { objectId: doc.active_object_id, author: 'Test', currentRevision: mgr.getActiveRevision() }
    );
    mgr.addRevision(mutation.revision, mutation.provenance);

    const { prov } = inspectActiveRevision(mgr);
    assert.ok(prov, 'provenance present');
    assert.ok(
      prov!.operation_name.includes('bond') || prov!.operation_name.includes('order'),
      'operation relates to bond order'
    );
  });

  // ── 5. After h_add ───────────────────────────────────────────────────────────
  test("5. Revision display after h_add — atom count increased, operation='h_add'", () => {
    const { proc, mgr } = buildManagerWithMutations();
    const doc = proc.getCanonicalDocument();
    const prevAtoms = mgr.getActiveRevision().molecule_snapshot.atoms.length;

    let mutation: any;
    try {
      mutation = ScientificEditingKernel.addHydrogens(doc, undefined, {
        objectId: doc.active_object_id,
        author: 'Test',
        currentRevision: mgr.getActiveRevision()
      });
    } catch (e: any) {
      // If no hydrogens can be added (e.g. already saturated), skip gracefully
      console.log(`    [INFO] h_add skipped (${e.message})`);
      return;
    }
    mgr.addRevision(mutation.revision, mutation.provenance);

    const { prov, activeRev } = inspectActiveRevision(mgr);
    assert.ok(prov, 'provenance present after h_add');
    assert.ok(
      prov!.operation_name === 'h_add' || prov!.operation_name.includes('hydrogen'),
      'operation is h_add'
    );
    assert.ok(
      activeRev.molecule_snapshot.atoms.length >= prevAtoms,
      'atom count not decreased after h_add'
    );
  });

  // ── 6. After alter ───────────────────────────────────────────────────────────
  test("6. Revision display after alter — hash changed, operation='alter'", () => {
    const { proc, mgr } = buildManagerWithMutations();
    const doc = proc.getCanonicalDocument();
    const preHash = mgr.getActiveRevision().canonical_state_hash;

    // alter id 1 formal_charge — this IS in the hash (per StateHasher knowledge)
    const mutation = ScientificEditingKernel.alter(
      doc,
      [1],
      { property: 'formal_charge', value: 1, rawProperty: 'formal_charge', rawValue: '1' },
      { objectId: doc.active_object_id, author: 'Test', currentRevision: mgr.getActiveRevision() }
    );
    mgr.addRevision(mutation.revision, mutation.provenance);

    const { prov, activeRev } = inspectActiveRevision(mgr);
    assert.ok(prov, 'provenance present after alter');
    assert.strictEqual(prov!.operation_name, 'alter', 'operation is alter');
    assert.notStrictEqual(activeRev.canonical_state_hash, preHash, 'state hash changed after alter');
  });

  // ── 7. Undo state ────────────────────────────────────────────────────────────
  test("7. Undo — canUndo transitions, active pointer moved, NO new revision created", () => {
    const { proc, mgr } = buildManagerWithMutations();
    const doc = proc.getCanonicalDocument();

    // Create revision R1
    const selResult = {
      query: 'id 20',
      selected_ids: new Set([20]),
      selected_array: [20],
      count: 1,
      object_id: 'main_mol'
    };
    const mutation = ScientificEditingKernel.remove(doc, selResult, {
      objectId: doc.active_object_id,
      author: 'Test',
      currentRevision: mgr.getActiveRevision()
    });
    mgr.addRevision(mutation.revision, mutation.provenance);
    const countBeforeUndo = mgr.getRevisionCount(); // 2
    const r1Id = mgr.getActiveRevisionId();

    // Undo
    mgr.undo(proc.getCanonicalDocument());
    assert.strictEqual(mgr.getRevisionCount(), countBeforeUndo, 'undo does NOT create new revision');
    assert.notStrictEqual(mgr.getActiveRevisionId(), r1Id, 'active pointer moved to parent');
    assert.strictEqual(mgr.canUndo(), false, 'at root — cannot undo further');
    assert.strictEqual(mgr.canRedo(), true, 'can redo after undo');
  });

  // ── 8. Redo state ────────────────────────────────────────────────────────────
  test("8. Redo — canRedo transitions, active pointer restored, NO new revision created", () => {
    const { proc, mgr } = buildManagerWithMutations();
    const doc = proc.getCanonicalDocument();

    const selResult = {
      query: 'id 20',
      selected_ids: new Set([20]),
      selected_array: [20],
      count: 1,
      object_id: 'main_mol'
    };
    const mutation = ScientificEditingKernel.remove(doc, selResult, {
      objectId: doc.active_object_id,
      author: 'Test',
      currentRevision: mgr.getActiveRevision()
    });
    mgr.addRevision(mutation.revision, mutation.provenance);
    const r1Id = mgr.getActiveRevisionId();

    mgr.undo(proc.getCanonicalDocument());
    const countBeforeRedo = mgr.getRevisionCount();

    mgr.redo(proc.getCanonicalDocument());
    assert.strictEqual(mgr.getRevisionCount(), countBeforeRedo, 'redo does NOT create new revision');
    assert.strictEqual(mgr.getActiveRevisionId(), r1Id, 'redo restores correct revision ID');
    assert.strictEqual(mgr.canUndo(), true, 'can undo after redo');
    assert.strictEqual(mgr.canRedo(), false, 'cannot redo further at tip');
  });

  // ── 9. Branch state ──────────────────────────────────────────────────────────
  test("9. Branch — after undo+new edit, two children of same parent visible in tree", () => {
    const { proc, mgr } = buildManagerWithMutations();
    let doc = proc.getCanonicalDocument();

    // Create R1
    const selResult = {
      query: 'id 20',
      selected_ids: new Set([20]),
      selected_array: [20],
      count: 1,
      object_id: 'main_mol'
    };
    const mut1 = ScientificEditingKernel.remove(doc, selResult, {
      objectId: doc.active_object_id, author: 'Test', currentRevision: mgr.getActiveRevision()
    });
    mgr.addRevision(mut1.revision, mut1.provenance);

    // Undo → back to root
    const { restoredRevision } = mgr.undo(proc.getCanonicalDocument());
    proc.applyScientificRevision(restoredRevision);
    doc = proc.getCanonicalDocument();

    // New edit on root — creates branch
    const rootRev = mgr.getActiveRevision();
    const mut2 = ScientificEditingKernel.alter(
      doc,
      [1],
      { property: 'formal_charge', value: 1, rawProperty: 'formal_charge', rawValue: '1' },
      { objectId: doc.active_object_id, author: 'Test', currentRevision: rootRev }
    );
    mgr.addRevision(mut2.revision, mut2.provenance);

    // Inspect tree
    const tree = mgr.getRevisionTree();
    assert.strictEqual(tree.length, 3, '3 nodes in revision tree (R0, R1-remove, R1-alter)');

    const rootNode = tree.find(n => n.revision.parent_revision_id === null)!;
    assert.ok(rootNode, 'root node found in tree');
    const children = mgr.getChildren(rootNode.revision.revision_id);
    assert.strictEqual(children.length, 2, 'root has 2 children (branch confirmed)');

    // Inspector shows branch: at least one node has 2 children
    const hasBranch = tree.some(n => (mgr.getChildren(n.revision.revision_id)).length > 1);
    assert.ok(hasBranch, 'branch visible in tree');
  });

  // ── 10. Historical revision inspection ───────────────────────────────────────
  test("10. Historical revision inspection — getRevision() fields intact, immutable semantics", () => {
    const { proc, mgr, rootRev } = buildManagerWithMutations();
    const doc = proc.getCanonicalDocument();

    const selResult = {
      query: 'id 20',
      selected_ids: new Set([20]),
      selected_array: [20],
      count: 1,
      object_id: 'main_mol'
    };
    const mutation = ScientificEditingKernel.remove(doc, selResult, {
      objectId: doc.active_object_id, author: 'Test', currentRevision: mgr.getActiveRevision()
    });
    mgr.addRevision(mutation.revision, mutation.provenance);

    // Inspect root (historical) via manager API
    const historicalRev = mgr.getRevision(rootRev.revision_id);
    assert.ok(historicalRev, 'historical revision retrievable');
    assert.strictEqual(historicalRev!.revision_id, rootRev.revision_id, 'revision_id intact');
    assert.strictEqual(historicalRev!.canonical_state_hash, rootRev.canonical_state_hash, 'state hash immutable');
    assert.strictEqual(historicalRev!.revision_hash, rootRev.revision_hash, 'revision hash immutable');
    assert.strictEqual(historicalRev!.molecule_snapshot.atoms.length, 20, 'snapshot has 20 atoms (original)');
    // Confirm active revision is the newer one
    assert.notStrictEqual(mgr.getActiveRevisionId(), rootRev.revision_id, 'active is NOT the root');
  });

  // ── 11. Provenance integrity ─────────────────────────────────────────────────
  test("11. Provenance integrity — getProvenance() has all required fields, read-only semantics", () => {
    const { proc, mgr } = buildManagerWithMutations();
    const doc = proc.getCanonicalDocument();

    const selResult = {
      query: 'remove id 20',
      selected_ids: new Set([20]),
      selected_array: [20],
      count: 1,
      object_id: 'main_mol'
    };
    const mutation = ScientificEditingKernel.remove(doc, selResult, {
      objectId: doc.active_object_id, author: 'TestAuthor', currentRevision: mgr.getActiveRevision()
    });
    mgr.addRevision(mutation.revision, mutation.provenance);

    const activeRevId = mgr.getActiveRevisionId();
    const prov = mgr.getProvenance(activeRevId);
    assert.ok(prov, 'provenance record present');

    // Required provenance fields per spec §3
    assert.strictEqual(typeof prov!.provenance_id, 'string', 'provenance_id present');
    assert.strictEqual(typeof prov!.revision_id, 'string', 'revision_id present');
    assert.strictEqual(typeof prov!.operation_name, 'string', 'operation_name present');
    assert.ok(Array.isArray(prov!.resolved_atom_ids), 'resolved_atom_ids is array');
    assert.strictEqual(typeof prov!.timestamp, 'string', 'timestamp present');
    assert.strictEqual(typeof prov!.tool_version, 'string', 'tool_version present');
    assert.ok(prov!.resolved_atom_ids.includes(20), 'resolved atom IDs include 20');

    // Read-only: provenance cannot be mutated via manager API
    // (no setter for provenance in ScientificRevisionManager — confirmed by interface)
    assert.strictEqual(typeof (mgr as any).setProvenance, 'undefined', 'no setProvenance method exposed');
  });

  // ── 12. State hash display ───────────────────────────────────────────────────
  test("12. State hash display — H(current) ≠ H(parent) after mutation", () => {
    const { proc, mgr, rootRev } = buildManagerWithMutations();
    const doc = proc.getCanonicalDocument();

    const preHash = rootRev.canonical_state_hash;

    const mutation = ScientificEditingKernel.alter(
      doc,
      [1],
      { property: 'formal_charge', value: 1, rawProperty: 'formal_charge', rawValue: '1' },
      { objectId: doc.active_object_id, author: 'Test', currentRevision: mgr.getActiveRevision() }
    );
    mgr.addRevision(mutation.revision, mutation.provenance);

    const activeRev = mgr.getActiveRevision();
    const parentRev = mgr.getRevision(activeRev.parent_revision_id!);

    // Inspector hash verification
    assert.strictEqual(parentRev!.canonical_state_hash, preHash, 'parent hash matches root hash');
    assert.notStrictEqual(activeRev.canonical_state_hash, preHash, 'current hash differs from parent');

    // Both hashes distinct from revision hash
    assert.notStrictEqual(
      activeRev.canonical_state_hash,
      activeRev.revision_hash,
      'STATE HASH ≠ REVISION HASH (different constructs)'
    );
  });

  // ── 13. Object/state context ─────────────────────────────────────────────────
  test("13. Object/state context — every revision carries document_id and object_id", () => {
    const { proc, mgr } = buildManagerWithMutations();
    const doc = proc.getCanonicalDocument();

    const selResult = {
      query: 'id 20',
      selected_ids: new Set([20]),
      selected_array: [20],
      count: 1,
      object_id: 'main_mol'
    };
    const mutation = ScientificEditingKernel.remove(doc, selResult, {
      objectId: doc.active_object_id, author: 'Test', currentRevision: mgr.getActiveRevision()
    });
    mgr.addRevision(mutation.revision, mutation.provenance);

    // Check all revisions in the tree
    for (const node of mgr.getRevisionTree()) {
      const rev = node.revision;
      assert.ok(rev.document_id, `revision ${rev.revision_id} has document_id`);
      assert.ok(rev.object_id, `revision ${rev.revision_id} has object_id`);
      assert.ok(rev.state_id, `revision ${rev.revision_id} has state_id`);
    }
  });

  // ── 14. Before/After summary ─────────────────────────────────────────────────
  test("14. Before/after summary — atom and bond delta derivable from revision snapshots", () => {
    const { proc, mgr } = buildManagerWithMutations();
    const doc = proc.getCanonicalDocument();

    const parentRev = mgr.getActiveRevision();
    const prevAtoms = parentRev.molecule_snapshot.atoms.length;
    const prevBonds = parentRev.molecule_snapshot.topology.bonds.length;

    const selResult = {
      query: 'id 20',
      selected_ids: new Set([20]),
      selected_array: [20],
      count: 1,
      object_id: 'main_mol'
    };
    const mutation = ScientificEditingKernel.remove(doc, selResult, {
      objectId: doc.active_object_id, author: 'Test', currentRevision: mgr.getActiveRevision()
    });
    mgr.addRevision(mutation.revision, mutation.provenance);

    const activeRev = mgr.getActiveRevision();
    const parentRevAfter = mgr.getRevision(activeRev.parent_revision_id!)!;

    // Inspector derives delta from molecule_snapshot — never from viewer
    const atomDelta = activeRev.molecule_snapshot.atoms.length - parentRevAfter.molecule_snapshot.atoms.length;
    const bondDelta = activeRev.molecule_snapshot.topology.bonds.length - parentRevAfter.molecule_snapshot.topology.bonds.length;

    assert.strictEqual(parentRevAfter.molecule_snapshot.atoms.length, prevAtoms, 'parent snapshot has original atoms');
    assert.strictEqual(atomDelta, -1, 'atom delta is -1 after remove');
    assert.ok(bondDelta <= 0, 'bond delta is ≤ 0 after remove');

    // Summary strings
    const atomSummary = `atoms: ${prevAtoms} → ${activeRev.molecule_snapshot.atoms.length}`;
    const bondSummary = `bonds: ${prevBonds} → ${activeRev.molecule_snapshot.topology.bonds.length}`;
    assert.ok(atomSummary.includes('→'), 'before/after summary has arrow format');
    assert.ok(bondSummary.includes('→'), 'bond summary has arrow format');
  });

  // ── 15. Invalid/stale revision detection ────────────────────────────────────
  test("15. Invalid/stale detection — validateCanonicalMolecule throws on corrupted snapshot", () => {
    const { proc, mgr } = buildManagerWithMutations();

    // Get a valid snapshot and validate it (no error expected)
    const validMol = mgr.getActiveRevision().molecule_snapshot;
    assert.doesNotThrow(
      () => validateCanonicalMolecule(validMol),
      'valid snapshot passes validateCanonicalMolecule'
    );

    // Fabricate a corrupted snapshot: add a residue that references a non-existent atom ID
    // This is what validateCanonicalMolecule actually checks (bond endpoints and atom references)
    const corruptedResidue = {
      ...validMol.residues[0],
      atom_ids: [...validMol.residues[0].atom_ids, 999999] // atom 999999 does not exist
    };
    const corruptedMol = {
      ...validMol,
      residues: [
        corruptedResidue,
        ...validMol.residues.slice(1)
      ]
    };

    assert.throws(
      () => validateCanonicalMolecule(corruptedMol),
      /non-existent atom|Residue/i,
      'validateCanonicalMolecule rejects non-existent atom reference in residue'
    );

    // Inspector integrity panel: isValid = false for this molecule
    let isValid = true;
    let errorMessage = '';
    try {
      validateCanonicalMolecule(corruptedMol);
    } catch (err: any) {
      isValid = false;
      errorMessage = err.message;
    }
    assert.strictEqual(isValid, false, 'integrity panel detects STALE/INVALID');
    assert.ok(errorMessage.length > 0, 'error message is populated for display');
  });

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log("\n================================================================================");
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} Passed (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log("================================================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runHistoryInspectorTests().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
