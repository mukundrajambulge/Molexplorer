import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { MolProcessor } from '../src/lib/MolProcessor';
import { SelectionParser } from '../src/lib/SelectionParser';
import {
  CanonicalAtom,
  CanonicalMolecule,
  ScientificRevision,
  ProvenanceRecord
} from '../types/domain';
import { buildCanonicalDocument } from '../src/domain/DocumentAdapter';
import {
  ScientificEditingKernel,
  ScientificEditingError
} from '../src/domain/ScientificEditingKernel';
import { ScientificRevisionManager } from '../src/domain/ScientificRevisionManager';
import { computeCanonicalStateHash } from '../src/domain/StateHasher';
import { SessionManager } from '../src/session/SessionManager';

function runRevisionNavigationTestSuite() {
  console.log("================================================================================");
  console.log("     TASK P3.6: SCIENTIFIC REVISION NAVIGATION & UNDO / REDO TEST SUITE         ");
  console.log("================================================================================\n");

  let totalTests = 0;
  let passedTests = 0;

  function test(name: string, fn: () => void) {
    totalTests++;
    try {
      fn();
      console.log(`  [PASS] ${name}`);
      passedTests++;
    } catch (err: any) {
      console.error(`  [FAIL] ${name}: ${err.message}`);
      throw err;
    }
  }

  // Load Primary Fixture
  const fixturePath = path.resolve(process.cwd(), 'fixtures/03_protein_with_ligand.pdb');
  const pdbContent = fs.readFileSync(fixturePath, 'utf8');

  // --- SECTION 1: BOUNDARY CONDITIONS & EMPTY HISTORY ---
  console.log("--- 1. Boundary Conditions & Fail-Closed Invariants ---");

  test("1.1 undo at root revision fails closed without creating fake revisions", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);
    const mol0 = proc.getCanonicalMolecule({ name: '03_protein_with_ligand.pdb', moleculeId: 'mol-target' });
    const doc0 = buildCanonicalDocument([mol0], { document_id: 'doc-nav-1' });
    const objId = 'obj-mol-target';

    const rootRev = ScientificEditingKernel.createRootRevision(doc0.document_id, objId, mol0, 'Tester');
    const mgr = new ScientificRevisionManager(rootRev);

    assert.strictEqual(mgr.canUndo(), false, "canUndo must be false at root");
    assert.strictEqual(mgr.canRedo(), false, "canRedo must be false at root");

    assert.throws(
      () => mgr.undo(doc0),
      /cannot undo at root revision/
    );

    assert.strictEqual(mgr.getAllRevisions().length, 1, "Revision ledger count must remain exactly 1");
    assert.strictEqual(mgr.getActiveRevisionId(), rootRev.revision_id);
  });

  test("1.2 redo when no child revision exists fails closed", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);
    const mol0 = proc.getCanonicalMolecule({ name: '03_protein_with_ligand.pdb', moleculeId: 'mol-target' });
    const doc0 = buildCanonicalDocument([mol0], { document_id: 'doc-nav-2' });
    const objId = 'obj-mol-target';

    const rootRev = ScientificEditingKernel.createRootRevision(doc0.document_id, objId, mol0, 'Tester');
    const mgr = new ScientificRevisionManager(rootRev);

    assert.throws(
      () => mgr.redo(doc0),
      /cannot redo when no child revision exists/
    );
  });

  // --- SECTION 2: SINGLE-STEP UNDO & REDO ---
  console.log("\n--- 2. Single-Step Undo & Redo Navigation ---");

  test("2.1 Single edit -> undo -> redo cycle restores exact state hashes without creating revisions", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);
    const mol0 = proc.getCanonicalMolecule({ name: '03_protein_with_ligand.pdb', moleculeId: 'mol-target' });
    const doc0 = buildCanonicalDocument([mol0], { document_id: 'doc-nav-3' });
    const objId = 'obj-mol-target';

    const rootRev = ScientificEditingKernel.createRootRevision(doc0.document_id, objId, mol0, 'Tester');
    const hash0 = rootRev.canonical_state_hash;
    const mgr = new ScientificRevisionManager(rootRev);

    // Apply mutation: remove id 20
    const mut1 = ScientificEditingKernel.remove(
      doc0,
      { query: 'id 20', selected_ids: new Set([20]), selected_array: [20], count: 1 },
      { objectId: objId, author: 'Scientist', currentRevision: rootRev }
    );
    const rev1 = mut1.revision;
    const hash1 = rev1.canonical_state_hash;
    mgr.addRevision(rev1, mut1.provenance);

    assert.strictEqual(mgr.canUndo(), true);
    assert.strictEqual(mgr.canRedo(), false);
    assert.strictEqual(mgr.getAllRevisions().length, 2);

    // UNDO: R1 -> R0
    const undoRes = mgr.undo(mut1.updatedDocument);
    assert.strictEqual(undoRes.restoredRevision.revision_id, rootRev.revision_id);
    assert.strictEqual(computeCanonicalStateHash(undoRes.restoredMolecule), hash0);
    assert.strictEqual(undoRes.restoredMolecule.atoms.length, 20);
    assert.strictEqual(mgr.getActiveRevisionId(), rootRev.revision_id);
    assert.strictEqual(mgr.canUndo(), false);
    assert.strictEqual(mgr.canRedo(), true);
    assert.strictEqual(mgr.getAllRevisions().length, 2, "Undo MUST NOT create a new revision");

    // REDO: R0 -> R1
    const redoRes = mgr.redo(undoRes.updatedDocument);
    assert.strictEqual(redoRes.restoredRevision.revision_id, rev1.revision_id);
    assert.strictEqual(computeCanonicalStateHash(redoRes.restoredMolecule), hash1);
    assert.strictEqual(redoRes.restoredMolecule.atoms.length, 19);
    assert.strictEqual(mgr.getActiveRevisionId(), rev1.revision_id);
    assert.strictEqual(mgr.canUndo(), true);
    assert.strictEqual(mgr.canRedo(), false);
    assert.strictEqual(mgr.getAllRevisions().length, 2, "Redo MUST NOT create a new revision");
  });

  // --- SECTION 3: MULTI-STEP MIXED-OPERATION REVISION CHAIN ---
  console.log("\n--- 3. Multi-Step Mixed-Operation Revision Chain ---");

  test("3.1 5-Step Mixed Revision Chain (remove -> bond -> order -> h_add -> alter) with stepwise undo/redo", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);
    let currentMol = proc.getCanonicalMolecule({ name: '03_protein_with_ligand.pdb', moleculeId: 'mol-target' });
    let currentDoc = buildCanonicalDocument([currentMol], { document_id: 'doc-mixed-chain' });
    const objId = 'obj-mol-target';

    const rootRev = ScientificEditingKernel.createRootRevision(currentDoc.document_id, objId, currentMol, 'Tester');
    const mgr = new ScientificRevisionManager(rootRev);
    const hashes: string[] = [rootRev.canonical_state_hash];
    const revisions: ScientificRevision[] = [rootRev];

    // R1: remove id 20
    const mut1 = ScientificEditingKernel.remove(
      currentDoc,
      { query: 'id 20', selected_ids: new Set([20]), selected_array: [20], count: 1 },
      { objectId: objId, author: 'Tester', currentRevision: mgr.getActiveRevision() }
    );
    mgr.addRevision(mut1.revision, mut1.provenance);
    currentDoc = mut1.updatedDocument;
    hashes.push(mut1.revision.canonical_state_hash);
    revisions.push(mut1.revision);

    // R2: unbond id 1, id 2
    const mut2 = ScientificEditingKernel.unbond(
      currentDoc,
      1,
      2,
      { objectId: objId, author: 'Tester', currentRevision: mgr.getActiveRevision() }
    );
    mgr.addRevision(mut2.revision, mut2.provenance);
    currentDoc = mut2.updatedDocument;
    hashes.push(mut2.revision.canonical_state_hash);
    revisions.push(mut2.revision);

    // R3: bond id 1, id 2, 2.0 (rebond with double bond)
    const mut3 = ScientificEditingKernel.bond(
      currentDoc,
      1,
      2,
      2.0,
      { objectId: objId, author: 'Tester', currentRevision: mgr.getActiveRevision() }
    );
    mgr.addRevision(mut3.revision, mut3.provenance);
    currentDoc = mut3.updatedDocument;
    hashes.push(mut3.revision.canonical_state_hash);
    revisions.push(mut3.revision);

    // R4: addHydrogens id 19
    const mut4 = ScientificEditingKernel.addHydrogens(
      currentDoc,
      [19],
      { objectId: objId, author: 'Tester', currentRevision: mgr.getActiveRevision() }
    );
    mgr.addRevision(mut4.revision, mut4.provenance);
    currentDoc = mut4.updatedDocument;
    hashes.push(mut4.revision.canonical_state_hash);
    revisions.push(mut4.revision);

    // R5: alter id 17, name=C99
    const mut5 = ScientificEditingKernel.alter(
      currentDoc,
      [17],
      { property: 'name', value: 'C99' },
      { objectId: objId, author: 'Tester', currentRevision: mgr.getActiveRevision() }
    );
    mgr.addRevision(mut5.revision, mut5.provenance);
    currentDoc = mut5.updatedDocument;
    hashes.push(mut5.revision.canonical_state_hash);
    revisions.push(mut5.revision);

    assert.strictEqual(mgr.getAllRevisions().length, 6);
    assert.strictEqual(mgr.getActiveRevisionId(), revisions[5].revision_id);

    // STEPWISE UNDO: R5 -> R4 -> R3 -> R2 -> R1 -> R0
    for (let k = 5; k >= 1; k--) {
      const undoRes = mgr.undo(currentDoc);
      currentDoc = undoRes.updatedDocument;
      assert.strictEqual(undoRes.restoredRevision.revision_id, revisions[k - 1].revision_id);
      assert.strictEqual(computeCanonicalStateHash(undoRes.restoredMolecule), hashes[k - 1]);
    }

    assert.strictEqual(mgr.canUndo(), false);
    assert.strictEqual(mgr.getActiveRevisionId(), rootRev.revision_id);
    assert.strictEqual(mgr.getAllRevisions().length, 6, "All 6 revisions must remain preserved in DAG");

    // STEPWISE REDO: R0 -> R1 -> R2 -> R3 -> R4 -> R5
    for (let k = 1; k <= 5; k++) {
      const redoRes = mgr.redo(currentDoc);
      currentDoc = redoRes.updatedDocument;
      assert.strictEqual(redoRes.restoredRevision.revision_id, revisions[k].revision_id);
      assert.strictEqual(computeCanonicalStateHash(redoRes.restoredMolecule), hashes[k]);
    }

    assert.strictEqual(mgr.canRedo(), false);
    assert.strictEqual(mgr.getActiveRevisionId(), revisions[5].revision_id);
  });

  // --- SECTION 4: BRANCHING POLICY & INVARIANCE ---
  console.log("\n--- 4. Deterministic Branching & Invalidation Policy ---");

  test("4.1 New edit after undo creates active child branch and preserves historical branch", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);
    const mol0 = proc.getCanonicalMolecule({ name: '03_protein_with_ligand.pdb', moleculeId: 'mol-target' });
    let doc = buildCanonicalDocument([mol0], { document_id: 'doc-branch-test' });
    const objId = 'obj-mol-target';

    const rootRev = ScientificEditingKernel.createRootRevision(doc.document_id, objId, mol0, 'Tester');
    const mgr = new ScientificRevisionManager(rootRev);

    // R1: remove id 20
    const mut1 = ScientificEditingKernel.remove(
      doc,
      { query: 'id 20', selected_ids: new Set([20]), selected_array: [20], count: 1 },
      { objectId: objId, author: 'Tester', currentRevision: rootRev }
    );
    mgr.addRevision(mut1.revision, mut1.provenance);
    doc = mut1.updatedDocument;
    const r1 = mut1.revision;

    // R2: unbond id 1, id 2 (old branch)
    const mut2 = ScientificEditingKernel.unbond(
      doc,
      1,
      2,
      { objectId: objId, author: 'Tester', currentRevision: r1 }
    );
    mgr.addRevision(mut2.revision, mut2.provenance);
    doc = mut2.updatedDocument;
    const r2 = mut2.revision;

    // UNDO: R2 -> R1
    const undoRes = mgr.undo(doc);
    doc = undoRes.updatedDocument;
    assert.strictEqual(mgr.getActiveRevisionId(), r1.revision_id);

    // NEW EDIT on R1: alter id 17, name=C99 -> R3 (new branch)
    const mut3 = ScientificEditingKernel.alter(
      doc,
      [17],
      { property: 'name', value: 'C99' },
      { objectId: objId, author: 'Tester', currentRevision: r1 }
    );
    mgr.addRevision(mut3.revision, mut3.provenance);
    doc = mut3.updatedDocument;
    const r3 = mut3.revision;

    // Verify DAG State
    assert.strictEqual(mgr.getAllRevisions().length, 4, "DAG contains R0, R1, R2, R3");
    assert.strictEqual(mgr.getActiveRevisionId(), r3.revision_id);

    // Historical R2 remains preserved
    assert(mgr.getRevision(r2.revision_id) !== undefined, "R2 must still exist in graph");
    assert.strictEqual(mgr.getChildren(r1.revision_id).length, 2, "R1 has 2 children: R2 and R3");

    // Redo from R3 has no child and fails closed
    assert.strictEqual(mgr.canRedo(), false);
    assert.throws(
      () => mgr.redo(doc),
      /cannot redo when no child revision exists/
    );

    // Undo from R3 returns to R1
    const undoToR1 = mgr.undo(doc);
    doc = undoToR1.updatedDocument;
    assert.strictEqual(mgr.getActiveRevisionId(), r1.revision_id);

    // Redo from R1 follows active forward branch to R3 (NOT R2)
    const redoToR3 = mgr.redo(doc);
    doc = redoToR3.updatedDocument;
    assert.strictEqual(redoToR3.restoredRevision.revision_id, r3.revision_id);

    // Explicit navigation to historical branch R2
    const navToR2 = mgr.navigateToRevision(doc, r2.revision_id);
    doc = navToR2.updatedDocument;
    assert.strictEqual(navToR2.restoredRevision.revision_id, r2.revision_id);
    assert.strictEqual(mgr.getActiveRevisionId(), r2.revision_id);
  });

  // --- SECTION 5: PROVENANCE IMMUTABILITY ---
  console.log("\n--- 5. Provenance Immutability Across Navigation ---");

  test("5.1 Provenance records remain strictly immutable after undo and redo", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    const mol0 = proc.getCanonicalMolecule();
    let doc = buildCanonicalDocument([mol0]);

    const rootRev = ScientificEditingKernel.createRootRevision(doc.document_id, doc.active_object_id!, mol0, 'Tester');
    const mgr = new ScientificRevisionManager(rootRev);

    const mut1 = ScientificEditingKernel.remove(
      doc,
      { query: 'id 20', selected_ids: new Set([20]), selected_array: [20], count: 1 },
      { objectId: doc.active_object_id!, author: 'Agent', currentRevision: rootRev }
    );
    mgr.addRevision(mut1.revision, mut1.provenance);
    doc = mut1.updatedDocument;

    const originalProv = mgr.getProvenance(mut1.revision.revision_id)!;
    assert.strictEqual(originalProv.operation_name, 'remove');
    assert.strictEqual(originalProv.parameters.removed_count, 1);

    // Undo
    const undoRes = mgr.undo(doc);
    doc = undoRes.updatedDocument;

    // Provenance of R1 must still be intact
    const postUndoProv = mgr.getProvenance(mut1.revision.revision_id)!;
    assert.strictEqual(postUndoProv.operation_name, 'remove');
    assert.strictEqual(postUndoProv.provenance_id, originalProv.provenance_id);

    // Redo
    const redoRes = mgr.redo(doc);
    doc = redoRes.updatedDocument;

    const postRedoProv = mgr.getProvenance(mut1.revision.revision_id)!;
    assert.strictEqual(postRedoProv.operation_name, 'remove');
  });

  // --- SECTION 6: SCOPE & SECURITY VALIDATION ---
  console.log("\n--- 6. Scope & Security Fail-Closed Protection ---");

  test("6.1 Reject navigation to nonexistent or cross-document revision", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    const mol0 = proc.getCanonicalMolecule();
    const doc1 = buildCanonicalDocument([mol0], { document_id: 'doc-1' });
    const doc2 = buildCanonicalDocument([mol0], { document_id: 'doc-2' });

    const rootRev1 = ScientificEditingKernel.createRootRevision(doc1.document_id, 'obj-1', mol0, 'Tester');
    const mgr1 = new ScientificRevisionManager(rootRev1);

    // Nonexistent revision
    assert.throws(
      () => mgr1.navigateToRevision(doc1, 'nonexistent-rev-id'),
      /not found in revision graph/
    );

    // Cross-document scope mismatch
    assert.throws(
      () => mgr1.navigateToRevision(doc2, rootRev1.revision_id),
      /document scope mismatch/
    );
  });

  // --- SECTION 7: PSE ACTIVE SNAPSHOT PERSISTENCE ---
  console.log("\n--- 7. PSE Active Snapshot Persistence ---");

  test("7.1 Active scientific snapshot at non-root revision persists accurately in MolStudio-PSE", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);
    const mol0 = proc.getCanonicalMolecule();
    let doc = buildCanonicalDocument([mol0]);

    const rootRev = ScientificEditingKernel.createRootRevision(doc.document_id, doc.active_object_id!, mol0, 'Tester');
    const mgr = new ScientificRevisionManager(rootRev);

    // R1: alter id 17, name=C99
    const mut1 = ScientificEditingKernel.alter(
      doc,
      [17],
      { property: 'name', value: 'C99' },
      { objectId: doc.active_object_id!, author: 'Tester', currentRevision: rootRev }
    );
    mgr.addRevision(mut1.revision, mut1.provenance);
    proc.applyScientificRevision(mut1.revision);

    // Export active snapshot to PSE
    const pdbR1 = proc.toPDB();
    const session = SessionManager.createSession({
      molecules: [{ id: 'mol_active', name: 'active_at_r1', format: 'pdb', data: pdbR1, atomCount: 20 }],
      viewerState: { renderStyle: 'Stick', colorScheme: 'Modern/Jmol', surfaceOpacity: 0.8, backgroundColor: '#0A0A0A' },
      selectionState: { selectionLevel: 'atom', selectedAtomSerials: [], namedSelections: [] }
    });

    const pseStr = SessionManager.exportSession(session);
    const imported = SessionManager.importSession(pseStr);
    const reloadedProc = new MolProcessor(imported.molecules[0].data, 'pdb');

    assert.strictEqual(reloadedProc.atoms.length, 20);
    const reloadedAtom17 = reloadedProc.atoms.find(a => a.serial === 17)!;
    assert.strictEqual(reloadedAtom17.name.trim(), 'C99', "Altered atom name in active snapshot survived PSE round-trip");

    // Initialize fresh baseline R0 from reloaded state
    const reloadedMol = reloadedProc.getCanonicalMolecule();
    const reloadedDoc = buildCanonicalDocument([reloadedMol]);
    const reloadedRootRev = ScientificEditingKernel.createRootRevision(reloadedDoc.document_id, reloadedDoc.active_object_id!, reloadedMol, 'Session Loader');
    const reloadedMgr = new ScientificRevisionManager(reloadedRootRev);

    assert.strictEqual(reloadedMgr.canUndo(), false);
    assert.strictEqual(reloadedMgr.getActiveRevision().molecule_snapshot.atom_map.get(17)!.name.trim(), 'C99');
  });

  // --- SECTION 8: SELECTION PARSER COMMAND ROUTING ---
  console.log("\n--- 8. Selection Parser Command Routing ---");

  test("8.1 SelectionParser routes 'undo', 'redo', and 'history' commands", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    const parser = new SelectionParser(proc.atoms);

    const resUndo = parser.evaluateCommand('undo');
    assert.strictEqual(resUndo.undoRequest, true);

    const resRedo = parser.evaluateCommand('redo');
    assert.strictEqual(resRedo.redoRequest, true);

    const resHist = parser.evaluateCommand('history');
    assert.strictEqual(resHist.historyRequest, true);
  });

  console.log("\n================================================================================");
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} Passed (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log("================================================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runRevisionNavigationTestSuite();
