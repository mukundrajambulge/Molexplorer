/**
 * P4.3: Visual / Scientific State Synchronization and Convergence QA
 * Validates unidirectional convergence:
 * Scientific Revision -> Canonical State -> MolProcessor / App State -> Transport PDB Representation
 *
 * Invariants enforced:
 * 1. Canonical <-> MolProcessor coordinates are EXACT.
 * 2. Canonical -> PDB transport has visualization tolerance <= 0.001 Å (f8.3 rounding).
 * 3. Viewer bond normalization uses unordered canonical endpoint pairs.
 * 4. Failed operations produce ZERO change to revision, hash, processor, or transport state.
 * 5. Undo / redo / branch / navigation / PSE reload maintain strict synchronization.
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { MolProcessor } from '../src/lib/MolProcessor';
import { SelectionParser } from '../src/lib/SelectionParser';
import {
  CanonicalAtom,
  CanonicalBond,
  CanonicalMolecule,
  ScientificRevision,
  ProvenanceRecord,
  CanonicalMolecularDocument
} from '../types/domain';
import { buildCanonicalDocument } from '../src/domain/DocumentAdapter';
import {
  ScientificEditingKernel,
  ScientificEditingError
} from '../src/domain/ScientificEditingKernel';
import { ScientificRevisionManager } from '../src/domain/ScientificRevisionManager';
import { computeCanonicalStateHash } from '../src/domain/StateHasher';
import { SessionManager } from '../src/session/SessionManager';

const FIXTURE_PATH = path.resolve(process.cwd(), 'fixtures/03_protein_with_ligand.pdb');
const FIXTURE_PDB = fs.readFileSync(FIXTURE_PATH, 'utf8');

// ─── Test Harness ────────────────────────────────────────────────────────────

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

// ─── Convergence Oracle Helpers ──────────────────────────────────────────────

/**
 * Asserts coordinate convergence:
 * 1. Canonical <-> MolProcessor coordinates are EXACT (===).
 * 2. Canonical -> Transport PDB coordinates are within <= 0.001 Å (PDB format f8.3 rounding).
 */
function assertCoordinateConvergence(
  canonicalAtoms: CanonicalAtom[],
  processor: MolProcessor,
  transportPdb: string
) {
  assert.strictEqual(
    canonicalAtoms.length,
    processor.atoms.length,
    `Atom counts match: canonical (${canonicalAtoms.length}) vs processor (${processor.atoms.length})`
  );

  // Parse transport PDB lines for ATOM / HETATM coordinates
  const transportAtomCoords: Array<{ serial: number; x: number; y: number; z: number }> = [];
  const lines = transportPdb.split('\n');
  for (const line of lines) {
    if (line.startsWith('ATOM  ') || line.startsWith('HETATM')) {
      const serial = parseInt(line.substring(6, 11).trim(), 10);
      const x = parseFloat(line.substring(30, 38).trim());
      const y = parseFloat(line.substring(38, 46).trim());
      const z = parseFloat(line.substring(46, 54).trim());
      transportAtomCoords.push({ serial, x, y, z });
    }
  }

  assert.strictEqual(
    canonicalAtoms.length,
    transportAtomCoords.length,
    `Transport PDB atom count (${transportAtomCoords.length}) matches canonical (${canonicalAtoms.length})`
  );

  for (let i = 0; i < canonicalAtoms.length; i++) {
    const cAtom = canonicalAtoms[i];
    const pAtom = processor.atoms[i];
    const tAtom = transportAtomCoords[i];

    // 1. Canonical <-> MolProcessor EXACT equivalence
    assert.strictEqual(cAtom.x, pAtom.x, `Exact X coordinate match for atom ${cAtom.canonical_id}`);
    assert.strictEqual(cAtom.y, pAtom.y, `Exact Y coordinate match for atom ${cAtom.canonical_id}`);
    assert.strictEqual(cAtom.z, pAtom.z, `Exact Z coordinate match for atom ${cAtom.canonical_id}`);
    assert.strictEqual(cAtom.canonical_id, pAtom.serial, `Serial match for atom ${cAtom.canonical_id}`);

    // 2. Canonical -> Transport PDB tolerance <= 0.001 Å
    const dx = Math.abs(cAtom.x - tAtom.x);
    const dy = Math.abs(cAtom.y - tAtom.y);
    const dz = Math.abs(cAtom.z - tAtom.z);
    assert.ok(dx <= 0.001001, `Transport X tolerance <= 0.001 Å for atom ${cAtom.canonical_id} (diff: ${dx})`);
    assert.ok(dy <= 0.001001, `Transport Y tolerance <= 0.001 Å for atom ${cAtom.canonical_id} (diff: ${dy})`);
    assert.ok(dz <= 0.001001, `Transport Z tolerance <= 0.001 Å for atom ${cAtom.canonical_id} (diff: ${dz})`);
  }
}

/**
 * Normalizes bond endpoints as unordered canonical edge pair key: "min:max"
 */
function normalizeEdge(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/**
 * Asserts topology convergence across Canonical Topology, MolProcessor bonds, and transport.
 */
function assertTopologyConvergence(
  canonicalBonds: CanonicalBond[],
  processor: MolProcessor
) {
  const canonicalEdgeSet = new Set(canonicalBonds.map(b => normalizeEdge(b.atom_a, b.atom_b)));

  // Extract edges from processor.atoms[i].bonds
  const processorEdgeSet = new Set<string>();
  for (const atom of processor.atoms) {
    for (const bIdx of atom.bonds) {
      const neighbor = processor.atoms[bIdx];
      if (neighbor) {
        processorEdgeSet.add(normalizeEdge(atom.serial, neighbor.serial));
      }
    }
  }

  // Also extract edges from processor.getCanonicalBonds()
  const cachedCanonicalBonds = processor.getCanonicalBonds();
  const cachedEdgeSet = new Set(cachedCanonicalBonds.map(b => normalizeEdge(b.atom_a, b.atom_b)));

  assert.strictEqual(
    canonicalEdgeSet.size,
    processorEdgeSet.size,
    `Atom-level edge set size match: canonical (${canonicalEdgeSet.size}) vs processor (${processorEdgeSet.size})`
  );

  assert.strictEqual(
    canonicalEdgeSet.size,
    cachedEdgeSet.size,
    `Cached canonical edge set size match: canonical (${canonicalEdgeSet.size}) vs processor.getCanonicalBonds (${cachedEdgeSet.size})`
  );

  for (const edge of canonicalEdgeSet) {
    assert.ok(processorEdgeSet.has(edge), `Processor atom bonds contain canonical edge ${edge}`);
    assert.ok(cachedEdgeSet.has(edge), `Processor getCanonicalBonds contains canonical edge ${edge}`);
  }
}

/**
 * Full convergence check across Revision Snapshot, Canonical Document, MolProcessor, and PDB transport.
 */
function assertFullConvergence(
  revision: ScientificRevision,
  processor: MolProcessor
) {
  const snapshot = revision.molecule_snapshot;
  const canonicalMol = processor.getCanonicalMolecule();
  const transportPdb = processor.toPDB();

  // 1. Revision Snapshot <-> Processor Canonical Molecule state equivalence
  assert.strictEqual(snapshot.atoms.length, canonicalMol.atoms.length, 'Atom counts match between snapshot and processor canonical molecule');
  assert.strictEqual(snapshot.topology.bonds.length, canonicalMol.topology.bonds.length, 'Bond counts match between snapshot and processor canonical molecule');

  const snapshotHash = computeCanonicalStateHash(snapshot);
  const processorHash = computeCanonicalStateHash(canonicalMol);
  assert.strictEqual(snapshotHash, processorHash, 'Canonical state hash matches between snapshot and processor canonical molecule');
  assert.strictEqual(revision.canonical_state_hash, snapshotHash, 'Revision canonical_state_hash matches computed hash');

  // 2. Coordinate Convergence (Exact processor, <= 0.001 Å transport)
  assertCoordinateConvergence(snapshot.atoms, processor, transportPdb);

  // 3. Topology Convergence (Normalized unordered edges)
  assertTopologyConvergence(snapshot.topology.bonds, processor);
}

// ─── Test Suite Execution ────────────────────────────────────────────────────

function runVisualScientificConvergenceSuite() {
  console.log("================================================================================");
  console.log(" TASK P4.3: VISUAL / SCIENTIFIC STATE SYNCHRONIZATION AND CONVERGENCE QA       ");
  console.log("================================================================================\n");

  // ── 1. Baseline Load Convergence ──────────────────────────────────────────
  test("1. Baseline load convergence — Revision snapshot == Canonical state == MolProcessor == PDB transport", () => {
    const processor = new MolProcessor(FIXTURE_PDB, 'pdb');
    processor.assignBonds(1.15);
    const doc = processor.getCanonicalDocument();
    const rootRev = ScientificEditingKernel.createRootRevision(
      doc.document_id,
      doc.active_object_id || 'main_obj',
      processor.getCanonicalMolecule(),
      'Baseline'
    );
    const mgr = new ScientificRevisionManager(rootRev);

    assertFullConvergence(mgr.getActiveRevision(), processor);
    assert.strictEqual(processor.atoms.length, 20, 'Fixture has 20 atoms');
    assert.strictEqual(processor.getCanonicalBonds().length, 19, 'Fixture has 19 bonds');
  });

  // ── 2. Remove Convergence ──────────────────────────────────────────────────
  test("2. Remove convergence — atom removal synchronized across snapshot, processor, and transport", () => {
    const processor = new MolProcessor(FIXTURE_PDB, 'pdb');
    processor.assignBonds(1.15);
    const doc = processor.getCanonicalDocument();
    const rootRev = ScientificEditingKernel.createRootRevision(
      doc.document_id,
      doc.active_object_id || 'main_obj',
      processor.getCanonicalMolecule(),
      'Baseline'
    );
    const mgr = new ScientificRevisionManager(rootRev);

    const sel = {
      query: 'id 20',
      selected_ids: new Set([20]),
      selected_array: [20],
      count: 1,
      object_id: doc.active_object_id
    };
    const mut = ScientificEditingKernel.remove(doc, sel, {
      objectId: doc.active_object_id,
      author: 'User',
      currentRevision: mgr.getActiveRevision()
    });

    processor.applyScientificRevision(mut.revision);
    mgr.addRevision(mut.revision, mut.provenance);

    assertFullConvergence(mgr.getActiveRevision(), processor);
    assert.strictEqual(processor.atoms.length, 19, 'Atom count updated to 19');
    assert.ok(!processor.atoms.some(a => a.serial === 20), 'Atom 20 removed from processor');
  });

  // ── 3. Bond Convergence ────────────────────────────────────────────────────
  test("3. Bond convergence — covalent edge addition synchronized across canonical graph and processor", () => {
    const processor = new MolProcessor(FIXTURE_PDB, 'pdb');
    processor.assignBonds(1.15);
    const doc = processor.getCanonicalDocument();
    const rootRev = ScientificEditingKernel.createRootRevision(
      doc.document_id,
      doc.active_object_id || 'main_obj',
      processor.getCanonicalMolecule(),
      'Baseline'
    );
    const mgr = new ScientificRevisionManager(rootRev);

    const mut = ScientificEditingKernel.bond(doc, 1, 3, 1.0, {
      objectId: doc.active_object_id,
      author: 'User',
      currentRevision: mgr.getActiveRevision()
    });

    processor.applyScientificRevision(mut.revision);
    mgr.addRevision(mut.revision, mut.provenance);

    assertFullConvergence(mgr.getActiveRevision(), processor);
    assert.strictEqual(processor.getCanonicalBonds().length, 20, 'Bond count increased to 20');
    assert.ok(
      processor.getCanonicalBonds().some(b => normalizeEdge(b.atom_a, b.atom_b) === normalizeEdge(1, 3)),
      'Bond (1, 3) present in processor'
    );
  });

  // ── 4. Unbond Convergence ──────────────────────────────────────────────────
  test("4. Unbond convergence — edge deletion synchronized while preserving atom coordinates", () => {
    const processor = new MolProcessor(FIXTURE_PDB, 'pdb');
    processor.assignBonds(1.15);
    const doc = processor.getCanonicalDocument();
    const rootRev = ScientificEditingKernel.createRootRevision(
      doc.document_id,
      doc.active_object_id || 'main_obj',
      processor.getCanonicalMolecule(),
      'Baseline'
    );
    const mgr = new ScientificRevisionManager(rootRev);

    const mut = ScientificEditingKernel.unbond(doc, 17, 20, {
      objectId: doc.active_object_id,
      author: 'User',
      currentRevision: mgr.getActiveRevision()
    });

    processor.applyScientificRevision(mut.revision);
    mgr.addRevision(mut.revision, mut.provenance);

    assertFullConvergence(mgr.getActiveRevision(), processor);
    assert.strictEqual(processor.getCanonicalBonds().length, 18, 'Bond count decreased to 18');
    assert.ok(
      !processor.getCanonicalBonds().some(b => normalizeEdge(b.atom_a, b.atom_b) === normalizeEdge(17, 20)),
      'Bond (17, 20) removed from processor'
    );
  });

  // ── 5. Bond-Order / Cycle Valence Convergence ──────────────────────────────
  test("5. Bond-order convergence — bond multiplicity synchronized across canonical and application state", () => {
    const processor = new MolProcessor(FIXTURE_PDB, 'pdb');
    processor.assignBonds(1.15);
    const doc = processor.getCanonicalDocument();
    const rootRev = ScientificEditingKernel.createRootRevision(
      doc.document_id,
      doc.active_object_id || 'main_obj',
      processor.getCanonicalMolecule(),
      'Baseline'
    );
    const mgr = new ScientificRevisionManager(rootRev);

    const mut = ScientificEditingKernel.setBondOrder(doc, 17, 20, 2.0, {
      objectId: doc.active_object_id,
      author: 'User',
      currentRevision: mgr.getActiveRevision()
    });

    processor.applyScientificRevision(mut.revision);
    mgr.addRevision(mut.revision, mut.provenance);

    assertFullConvergence(mgr.getActiveRevision(), processor);
    const pBond = processor.getCanonicalBonds().find(b => normalizeEdge(b.atom_a, b.atom_b) === normalizeEdge(17, 20));
    assert.ok(pBond, 'Bond (17, 20) found in processor');
    assert.strictEqual(pBond!.order, 2.0, 'Processor bond order is 2.0');
  });

  // ── 6. Hydrogen Add Convergence ────────────────────────────────────────────
  test("6. Hydrogen add convergence — modeled hydrogens synchronized with exact coordinates", () => {
    const processor = new MolProcessor(FIXTURE_PDB, 'pdb');
    processor.assignBonds(1.15);
    const doc = processor.getCanonicalDocument();
    const rootRev = ScientificEditingKernel.createRootRevision(
      doc.document_id,
      doc.active_object_id || 'main_obj',
      processor.getCanonicalMolecule(),
      'Baseline'
    );
    const mgr = new ScientificRevisionManager(rootRev);

    const mut = ScientificEditingKernel.addHydrogens(doc, [17], {
      objectId: doc.active_object_id,
      author: 'User',
      currentRevision: mgr.getActiveRevision()
    });

    processor.applyScientificRevision(mut.revision);
    mgr.addRevision(mut.revision, mut.provenance);

    assertFullConvergence(mgr.getActiveRevision(), processor);
    assert.strictEqual(processor.atoms.length, 22, 'Atom count increased from 20 to 22 (2 H modeled)');
    assert.strictEqual(processor.getCanonicalBonds().length, 21, 'Bond count increased from 19 to 21 (2 C-H bonds)');
  });

  // ── 7. Hydrogen Remove Convergence ─────────────────────────────────────────
  test("7. Hydrogen remove convergence — modeled hydrogens removed cleanly across all layers", () => {
    const processor = new MolProcessor(FIXTURE_PDB, 'pdb');
    processor.assignBonds(1.15);
    let doc = processor.getCanonicalDocument();
    const rootRev = ScientificEditingKernel.createRootRevision(
      doc.document_id,
      doc.active_object_id || 'main_obj',
      processor.getCanonicalMolecule(),
      'Baseline'
    );
    const mgr = new ScientificRevisionManager(rootRev);

    // First add hydrogens
    const mutAdd = ScientificEditingKernel.addHydrogens(doc, [17], {
      objectId: doc.active_object_id,
      author: 'User',
      currentRevision: mgr.getActiveRevision()
    });
    processor.applyScientificRevision(mutAdd.revision);
    mgr.addRevision(mutAdd.revision, mutAdd.provenance);
    doc = processor.getCanonicalDocument();

    // Now remove hydrogens
    const mutRem = ScientificEditingKernel.removeHydrogens(doc, undefined, {
      objectId: doc.active_object_id,
      author: 'User',
      currentRevision: mgr.getActiveRevision()
    });
    processor.applyScientificRevision(mutRem.revision);
    mgr.addRevision(mutRem.revision, mutRem.provenance);

    assertFullConvergence(mgr.getActiveRevision(), processor);
    assert.strictEqual(processor.atoms.length, 20, 'Atom count restored to 20');
    assert.strictEqual(processor.getCanonicalBonds().length, 19, 'Bond count restored to 19');
  });

  // ── 8. Alter Convergence ───────────────────────────────────────────────────
  test("8. Alter convergence — property mutations synchronize with exact state hash tracking", () => {
    const processor = new MolProcessor(FIXTURE_PDB, 'pdb');
    processor.assignBonds(1.15);
    const doc = processor.getCanonicalDocument();
    const rootRev = ScientificEditingKernel.createRootRevision(
      doc.document_id,
      doc.active_object_id || 'main_obj',
      processor.getCanonicalMolecule(),
      'Baseline'
    );
    const mgr = new ScientificRevisionManager(rootRev);

    const rootHash = rootRev.canonical_state_hash;

    const mut = ScientificEditingKernel.alter(
      doc,
      [1],
      { property: 'formal_charge', value: 1, rawProperty: 'formal_charge', rawValue: '1' },
      { objectId: doc.active_object_id, author: 'User', currentRevision: mgr.getActiveRevision() }
    );

    processor.applyScientificRevision(mut.revision);
    mgr.addRevision(mut.revision, mut.provenance);

    assertFullConvergence(mgr.getActiveRevision(), processor);
    assert.notStrictEqual(mgr.getActiveRevision().canonical_state_hash, rootHash, 'State hash changed');
    assert.strictEqual(processor.atoms.find(a => a.serial === 1)!.formalCharge, 1, 'Formal charge updated in processor');
  });

  // ── 9. Undo Convergence ────────────────────────────────────────────────────
  test("9. Undo convergence — undo restores exact historical revision, canonical state, and processor", () => {
    const processor = new MolProcessor(FIXTURE_PDB, 'pdb');
    processor.assignBonds(1.15);
    const doc = processor.getCanonicalDocument();
    const rootRev = ScientificEditingKernel.createRootRevision(
      doc.document_id,
      doc.active_object_id || 'main_obj',
      processor.getCanonicalMolecule(),
      'Baseline'
    );
    const mgr = new ScientificRevisionManager(rootRev);
    const rootHash = rootRev.canonical_state_hash;

    // Mutate (remove id 20)
    const sel = {
      query: 'id 20',
      selected_ids: new Set([20]),
      selected_array: [20],
      count: 1,
      object_id: doc.active_object_id
    };
    const mut = ScientificEditingKernel.remove(doc, sel, {
      objectId: doc.active_object_id,
      author: 'User',
      currentRevision: mgr.getActiveRevision()
    });
    processor.applyScientificRevision(mut.revision);
    mgr.addRevision(mut.revision, mut.provenance);

    // Undo back to root
    const { restoredRevision } = mgr.undo(processor.getCanonicalDocument());
    processor.applyScientificRevision(restoredRevision);

    assertFullConvergence(mgr.getActiveRevision(), processor);
    assert.strictEqual(mgr.getActiveRevisionId(), rootRev.revision_id, 'Active revision is root');
    assert.strictEqual(mgr.getActiveRevision().canonical_state_hash, rootHash, 'State hash matches root');
    assert.strictEqual(processor.atoms.length, 20, 'Processor atom count is 20');
    assert.strictEqual(mgr.canUndo(), false, 'canUndo is false at root');
    assert.strictEqual(mgr.canRedo(), true, 'canRedo is true after undo');
  });

  // ── 10. Redo Convergence ───────────────────────────────────────────────────
  test("10. Redo convergence — redo restores forward revision, canonical state, and processor", () => {
    const processor = new MolProcessor(FIXTURE_PDB, 'pdb');
    processor.assignBonds(1.15);
    const doc = processor.getCanonicalDocument();
    const rootRev = ScientificEditingKernel.createRootRevision(
      doc.document_id,
      doc.active_object_id || 'main_obj',
      processor.getCanonicalMolecule(),
      'Baseline'
    );
    const mgr = new ScientificRevisionManager(rootRev);

    const sel = {
      query: 'id 20',
      selected_ids: new Set([20]),
      selected_array: [20],
      count: 1,
      object_id: doc.active_object_id
    };
    const mut = ScientificEditingKernel.remove(doc, sel, {
      objectId: doc.active_object_id,
      author: 'User',
      currentRevision: mgr.getActiveRevision()
    });
    processor.applyScientificRevision(mut.revision);
    mgr.addRevision(mut.revision, mut.provenance);
    const r1Id = mut.revision.revision_id;
    const r1Hash = mut.revision.canonical_state_hash;

    // Undo
    const undoRes = mgr.undo(processor.getCanonicalDocument());
    processor.applyScientificRevision(undoRes.restoredRevision);

    // Redo
    const redoRes = mgr.redo(processor.getCanonicalDocument());
    processor.applyScientificRevision(redoRes.restoredRevision);

    assertFullConvergence(mgr.getActiveRevision(), processor);
    assert.strictEqual(mgr.getActiveRevisionId(), r1Id, 'Active revision is R1');
    assert.strictEqual(mgr.getActiveRevision().canonical_state_hash, r1Hash, 'State hash matches R1');
    assert.strictEqual(processor.atoms.length, 19, 'Processor atom count is 19');
    assert.strictEqual(mgr.canRedo(), false, 'canRedo is false at branch tip');
  });

  // ── 11. Branch Convergence ─────────────────────────────────────────────────
  test("11. Branch convergence — edit after undo establishes new branch while keeping old branch historical", () => {
    const processor = new MolProcessor(FIXTURE_PDB, 'pdb');
    processor.assignBonds(1.15);
    let doc = processor.getCanonicalDocument();
    const rootRev = ScientificEditingKernel.createRootRevision(
      doc.document_id,
      doc.active_object_id || 'main_obj',
      processor.getCanonicalMolecule(),
      'Baseline'
    );
    const mgr = new ScientificRevisionManager(rootRev);

    // R1: remove id 20
    const sel = {
      query: 'id 20',
      selected_ids: new Set([20]),
      selected_array: [20],
      count: 1,
      object_id: doc.active_object_id
    };
    const mut1 = ScientificEditingKernel.remove(doc, sel, {
      objectId: doc.active_object_id, author: 'User', currentRevision: mgr.getActiveRevision()
    });
    processor.applyScientificRevision(mut1.revision);
    mgr.addRevision(mut1.revision, mut1.provenance);
    const r1Id = mut1.revision.revision_id;

    // Undo -> back to root
    const undoRes = mgr.undo(processor.getCanonicalDocument());
    processor.applyScientificRevision(undoRes.restoredRevision);
    doc = processor.getCanonicalDocument();

    // R2 (Branch): alter id 1 formal_charge=1
    const mut2 = ScientificEditingKernel.alter(
      doc,
      [1],
      { property: 'formal_charge', value: 1, rawProperty: 'formal_charge', rawValue: '1' },
      { objectId: doc.active_object_id, author: 'User', currentRevision: mgr.getActiveRevision() }
    );
    processor.applyScientificRevision(mut2.revision);
    mgr.addRevision(mut2.revision, mut2.provenance);
    const r2Id = mut2.revision.revision_id;

    assertFullConvergence(mgr.getActiveRevision(), processor);
    assert.strictEqual(mgr.getActiveRevisionId(), r2Id, 'Active revision is R2');
    assert.strictEqual(mgr.getRevisionCount(), 3, 'Revision count is 3 (R0, R1, R2)');

    // Verify R1 remains accessible as historical node
    const histR1 = mgr.getRevision(r1Id);
    assert.ok(histR1, 'Historical R1 is retained in revision graph');
    assert.strictEqual(histR1!.molecule_snapshot.atoms.length, 19, 'Historical R1 has 19 atoms');
  });

  // ── 12. Historical Navigation Convergence ──────────────────────────────────
  test("12. Historical navigation convergence — navigateToRevision(R1) switches active state and returns cleanly", () => {
    const processor = new MolProcessor(FIXTURE_PDB, 'pdb');
    processor.assignBonds(1.15);
    let doc = processor.getCanonicalDocument();
    const rootRev = ScientificEditingKernel.createRootRevision(
      doc.document_id,
      doc.active_object_id || 'main_obj',
      processor.getCanonicalMolecule(),
      'Baseline'
    );
    const mgr = new ScientificRevisionManager(rootRev);

    // R1: remove id 20
    const sel = {
      query: 'id 20',
      selected_ids: new Set([20]),
      selected_array: [20],
      count: 1,
      object_id: doc.active_object_id
    };
    const mut1 = ScientificEditingKernel.remove(doc, sel, {
      objectId: doc.active_object_id, author: 'User', currentRevision: mgr.getActiveRevision()
    });
    processor.applyScientificRevision(mut1.revision);
    mgr.addRevision(mut1.revision, mut1.provenance);
    const r1Id = mut1.revision.revision_id;

    // Undo -> root
    const undoRes = mgr.undo(processor.getCanonicalDocument());
    processor.applyScientificRevision(undoRes.restoredRevision);
    doc = processor.getCanonicalDocument();

    // R2: alter id 1
    const mut2 = ScientificEditingKernel.alter(
      doc,
      [1],
      { property: 'formal_charge', value: 1, rawProperty: 'formal_charge', rawValue: '1' },
      { objectId: doc.active_object_id, author: 'User', currentRevision: mgr.getActiveRevision() }
    );
    processor.applyScientificRevision(mut2.revision);
    mgr.addRevision(mut2.revision, mut2.provenance);
    const r2Id = mut2.revision.revision_id;

    // Explicitly navigate to historical R1
    const nav1 = mgr.navigateToRevision(processor.getCanonicalDocument(), r1Id);
    processor.applyScientificRevision(nav1.restoredRevision);
    assertFullConvergence(mgr.getActiveRevision(), processor);
    assert.strictEqual(mgr.getActiveRevisionId(), r1Id, 'Active revision navigated to R1');
    assert.strictEqual(processor.atoms.length, 19, 'Processor atom count corresponds to R1 (19)');

    // Navigate back to R2
    const nav2 = mgr.navigateToRevision(processor.getCanonicalDocument(), r2Id);
    processor.applyScientificRevision(nav2.restoredRevision);
    assertFullConvergence(mgr.getActiveRevision(), processor);
    assert.strictEqual(mgr.getActiveRevisionId(), r2Id, 'Active revision returned to R2');
    assert.strictEqual(processor.atoms.length, 20, 'Processor atom count corresponds to R2 (20)');
  });

  // ── 13. Invalid-Operation No-Change Convergence ────────────────────────────
  test("13. Invalid-operation no-change convergence — 6 adversarial failures produce ZERO scientific or application change", () => {
    const processor = new MolProcessor(FIXTURE_PDB, 'pdb');
    processor.assignBonds(1.15);
    const doc = processor.getCanonicalDocument();
    const rootRev = ScientificEditingKernel.createRootRevision(
      doc.document_id,
      doc.active_object_id || 'main_obj',
      processor.getCanonicalMolecule(),
      'Baseline'
    );
    const mgr = new ScientificRevisionManager(rootRev);

    const baselineHash = rootRev.canonical_state_hash;
    const baselineRevId = rootRev.revision_id;
    const baselineAtoms = [...processor.atoms];
    const baselineBonds = processor.getCanonicalBonds();

    const invalidOps: Array<{ name: string; fn: () => void }> = [
      {
        name: 'self-bond (1, 1)',
        fn: () => ScientificEditingKernel.bond(doc, 1, 1, 1.0, { objectId: doc.active_object_id, author: 'Attacker' })
      },
      {
        name: 'duplicate existing bond (17, 20)',
        fn: () => ScientificEditingKernel.bond(doc, 17, 20, 1.0, { objectId: doc.active_object_id, author: 'Attacker' })
      },
      {
        name: 'unbond nonexistent bond (1, 3)',
        fn: () => ScientificEditingKernel.unbond(doc, 1, 3, { objectId: doc.active_object_id, author: 'Attacker' })
      },
      {
        name: 'unsupported bond order (5.0 on bond 17, 20)',
        fn: () => ScientificEditingKernel.setBondOrder(doc, 17, 20, 5.0, { objectId: doc.active_object_id, author: 'Attacker' })
      },
      {
        name: 'alter invalid property with script injection',
        fn: () => ScientificEditingKernel.alter(doc, [1], { property: 'eval' as any, value: '<script>', rawProperty: 'eval', rawValue: '<script>' }, { objectId: doc.active_object_id, author: 'Attacker' })
      },
      {
        name: 'stale parent revision conflict',
        fn: () => ScientificEditingKernel.remove(
          doc,
          { query: 'id 20', selected_ids: new Set([20]), selected_array: [20], count: 1, object_id: doc.active_object_id },
          { objectId: doc.active_object_id, author: 'Attacker', expectedRevisionId: 'rev-outdated-uuid', currentRevision: rootRev }
        )
      }
    ];

    for (const op of invalidOps) {
      assert.throws(
        () => op.fn(),
        ScientificEditingError,
        `Operation '${op.name}' must fail closed with ScientificEditingError`
      );

      // Verify ZERO change across all state oracles
      assert.strictEqual(mgr.getActiveRevisionId(), baselineRevId, `Active revision unchanged after ${op.name}`);
      assert.strictEqual(mgr.getActiveRevision().canonical_state_hash, baselineHash, `State hash unchanged after ${op.name}`);
      assert.strictEqual(processor.atoms.length, baselineAtoms.length, `Atom count unchanged after ${op.name}`);
      assert.strictEqual(processor.getCanonicalBonds().length, baselineBonds.length, `Bond count unchanged after ${op.name}`);
      assertFullConvergence(mgr.getActiveRevision(), processor);
    }
  });

  // ── 14. PSE Reload Convergence ─────────────────────────────────────────────
  test("14. PSE reload convergence — active snapshot round-trip preserves exact state without fabricating history", () => {
    const processor = new MolProcessor(FIXTURE_PDB, 'pdb');
    processor.assignBonds(1.15);
    const doc = processor.getCanonicalDocument();
    const rootRev = ScientificEditingKernel.createRootRevision(
      doc.document_id,
      doc.active_object_id || 'main_obj',
      processor.getCanonicalMolecule(),
      'Baseline'
    );
    const mgr = new ScientificRevisionManager(rootRev);

    // Mutate (remove id 20)
    const sel = {
      query: 'id 20',
      selected_ids: new Set([20]),
      selected_array: [20],
      count: 1,
      object_id: doc.active_object_id
    };
    const mut = ScientificEditingKernel.remove(doc, sel, {
      objectId: doc.active_object_id,
      author: 'User',
      currentRevision: mgr.getActiveRevision()
    });
    processor.applyScientificRevision(mut.revision);
    mgr.addRevision(mut.revision, mut.provenance);

    const preSaveHash = mut.revision.canonical_state_hash;

    // Save PSE Session
    const session = SessionManager.createSession({
      molecules: [
        {
          id: 'main_mol',
          name: '03_protein_with_ligand.pdb',
          format: 'pdb',
          data: processor.toPDB(),
          atomCount: processor.atoms.length,
          visible: true
        }
      ]
    });
    const serializedPse = SessionManager.exportSession(session);

    // Reload PSE Session
    const restoredSession = SessionManager.importSession(serializedPse);
    const restoredMol = restoredSession.molecules[0];
    const restoredProcessor = new MolProcessor(restoredMol.data, restoredMol.format);
    restoredProcessor.assignBonds(1.15);

    const restoredDoc = restoredProcessor.getCanonicalDocument();
    const restoredRootRev = ScientificEditingKernel.createRootRevision(
      restoredDoc.document_id,
      restoredDoc.active_object_id || 'main_obj',
      restoredProcessor.getCanonicalMolecule(),
      'Restored Active Snapshot'
    );
    const restoredMgr = new ScientificRevisionManager(restoredRootRev);

    // Convergence assertions
    assertFullConvergence(restoredMgr.getActiveRevision(), restoredProcessor);
    assert.strictEqual(restoredProcessor.atoms.length, 19, 'Restored atom count is 19');
    assert.strictEqual(restoredMgr.getRevisionCount(), 1, 'Restored session has 1 active snapshot (history not fabricated)');
    assert.strictEqual(restoredMgr.getActiveRevision().canonical_state_hash, preSaveHash, 'Restored state hash matches pre-save hash');
  });

  // ── 15. Multi-Object Isolation ─────────────────────────────────────────────
  test("15. Multi-object isolation — ObjectA:1 and ObjectB:1 remain distinct under mutation", () => {
    // Create Object A
    const procA = new MolProcessor(FIXTURE_PDB, 'pdb');
    procA.assignBonds(1.15);
    const molA = procA.getCanonicalMolecule({ name: 'ObjectA.pdb', moleculeId: 'mol-A' });
    const docA = procA.getCanonicalDocument({ name: 'Object A', moleculeId: 'mol-A' });
    const objIdA = docA.active_object_id!;
    const rootRevA = ScientificEditingKernel.createRootRevision(
      docA.document_id,
      objIdA,
      molA,
      'Object A Baseline'
    );
    const mgrA = new ScientificRevisionManager(rootRevA);

    // Create Object B
    const procB = new MolProcessor(FIXTURE_PDB, 'pdb');
    procB.assignBonds(1.15);
    const molB = procB.getCanonicalMolecule({ name: 'ObjectB.pdb', moleculeId: 'mol-B' });
    const docB = procB.getCanonicalDocument({ name: 'Object B', moleculeId: 'mol-B' });
    const objIdB = docB.active_object_id!;
    const rootRevB = ScientificEditingKernel.createRootRevision(
      docB.document_id,
      objIdB,
      molB,
      'Object B Baseline'
    );
    const mgrB = new ScientificRevisionManager(rootRevB);

    const objBInitialHash = rootRevB.canonical_state_hash;
    const objBInitialAtomCount = procB.atoms.length;

    // Mutate Object A (remove id 20 on Object A)
    const selA = {
      query: 'id 20',
      selected_ids: new Set([20]),
      selected_array: [20],
      count: 1,
      object_id: objIdA
    };
    const mutA = ScientificEditingKernel.remove(docA, selA, {
      objectId: objIdA,
      author: 'User',
      currentRevision: mgrA.getActiveRevision()
    });
    procA.applyScientificRevision(mutA.revision);
    mgrA.addRevision(mutA.revision, mutA.provenance);

    // Verify Object A changed
    assert.strictEqual(procA.atoms.length, 19, 'Object A atom count reduced to 19');
    assertFullConvergence(mgrA.getActiveRevision(), procA);

    // Verify Object B remains 100% untouched
    assert.strictEqual(procB.atoms.length, objBInitialAtomCount, 'Object B atom count unchanged (20)');
    assert.strictEqual(mgrB.getActiveRevision().canonical_state_hash, objBInitialHash, 'Object B state hash unchanged');
    assertFullConvergence(mgrB.getActiveRevision(), procB);
  });

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n================================================================================");
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} Passed (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log("================================================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runVisualScientificConvergenceSuite();
