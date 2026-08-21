import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { MolProcessor } from '../src/lib/MolProcessor';
import { SelectionParser } from '../src/lib/SelectionParser';
import {
  CanonicalMolecule,
  ScientificRevision,
  ProvenanceRecord
} from '../src/types/domain';
import { buildCanonicalDocument } from '../src/domain/DocumentAdapter';
import {
  ScientificEditingKernel,
  ScientificEditingError
} from '../src/domain/ScientificEditingKernel';
import { SessionManager } from '../src/session/SessionManager';

function runRemoveTransactionTestSuite() {
  console.log("================================================================================");
  console.log("             TASK P3.1: SCIENTIFIC MUTATION 'remove <selection>' SUITE          ");
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

  // --- SECTION 1: PRIMARY FIXTURE REMOVE LIGAND VERTICAL SLICE ---
  console.log("--- 1. Primary Fixture: remove ligand (03_protein_with_ligand.pdb) ---");

  test("1.1 Full remove vertical slice: 20 atoms / 19 bonds -> 16 atoms / 15 bonds", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);

    const mol0 = proc.getCanonicalMolecule({ name: '03_protein_with_ligand.pdb', moleculeId: 'mol-target' });
    const doc0 = buildCanonicalDocument([mol0], { document_id: 'doc-edit-1', name: 'Editing Workspace' });
    const objId = 'obj-mol-target';

    // Baseline assertions
    assert.strictEqual(mol0.atoms.length, 20);
    assert.strictEqual(mol0.topology.bonds.length, 19);
    assert.strictEqual(mol0.residues.length, 4);
    assert.strictEqual(mol0.chains.length, 1);

    // Initial Root Revision R0
    const rootRev = ScientificEditingKernel.createRootRevision(doc0.document_id, objId, mol0, 'Tester');
    assert.strictEqual(rootRev.parent_revision_id, null);
    assert(rootRev.canonical_state_hash.length === 64);

    // Resolve selection
    const selection = SelectionParser.evaluateCanonical("hetatm and not resn HOH", mol0, { objectId: objId });
    assert.strictEqual(selection.count, 4);
    assert.deepStrictEqual(selection.selected_array, [17, 18, 19, 20]);

    // Execute atomic remove transaction
    const result = ScientificEditingKernel.remove(doc0, selection, {
      objectId: objId,
      author: 'Scientific Agent',
      currentRevision: rootRev
    });

    const mol1 = result.updatedMolecule;
    const rev1 = result.revision;
    const prov1 = result.provenance;

    // Invariant 1: Surviving atom count and absence of ligand atoms
    assert.strictEqual(mol1.atoms.length, 16);
    assert.strictEqual(mol1.atoms.every(a => !a.is_hetero), true, "All HETATM ligand atoms must be removed");

    // Invariant 2: Surviving atom IDs are strictly preserved (1..16)
    for (let i = 0; i < 16; i++) {
      assert.strictEqual(mol1.atoms[i].canonical_id, i + 1);
      // Coordinates must be strictly identical
      assert.strictEqual(mol1.atoms[i].x, mol0.atoms[i].x);
      assert.strictEqual(mol1.atoms[i].y, mol0.atoms[i].y);
      assert.strictEqual(mol1.atoms[i].z, mol0.atoms[i].z);
    }

    // Invariant 3: Incident bonds are purged (19 initial bonds - 3 ligand bonds = 16 remaining)
    assert.strictEqual(mol1.topology.bonds.length, 16);
    for (const b of mol1.topology.bonds) {
      assert(b.atom_a <= 16 && b.atom_b <= 16, "No bond may reference deleted ligand atoms");
    }

    // Invariant 4: Dangling residue pruning (4 initial residues - 1 ligand residue = 3 remaining)
    assert.strictEqual(mol1.residues.length, 3);
    assert.strictEqual(mol1.residues.every(r => r.classification === 'amino_acid'), true);

    // Invariant 5: Chain remains intact
    assert.strictEqual(mol1.chains.length, 1);
    assert.strictEqual(mol1.chains[0].atom_ids.length, 16);
    assert.strictEqual(mol1.chains[0].residue_ids.length, 3);

    // Invariant 6: State hashes are differentiated
    assert.notStrictEqual(rev1.canonical_state_hash, rootRev.canonical_state_hash);
    assert.strictEqual(rev1.parent_revision_id, rootRev.revision_id);

    // Invariant 7: Provenance record
    assert.strictEqual(prov1.operation_name, 'remove');
    assert.deepStrictEqual(prov1.resolved_atom_ids, [17, 18, 19, 20]);
    assert.strictEqual(prov1.parameters.removed_count, 4);
    assert.strictEqual(prov1.parameters.surviving_count, 16);

    // Invariant 8: MolProcessor unidirectional sync
    proc.applyScientificRevision(rev1);
    assert.strictEqual(proc.atoms.length, 16);
    const updatedPdb = proc.toPDB();
    assert(!updatedPdb.split('\n').some(l => l.startsWith('HETATM')), "PDB string must not contain HETATM atom records");
  });

  // --- SECTION 2: PRECONDITIONS, CONCURRENCY & EDGE CASES ---
  console.log("\n--- 2. Preconditions, Concurrency & Edge Cases ---");

  test("2.1 Empty selection throws precondition error without creating revision", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    const mol = proc.getCanonicalMolecule();
    const doc = buildCanonicalDocument([mol], { document_id: 'doc-empty' });
    const emptySel = SelectionParser.evaluateCanonical("none", mol);

    assert.throws(
      () => ScientificEditingKernel.remove(doc, emptySel),
      /selection is empty/
    );
  });

  test("2.2 Stale / non-existent atom ID fails closed", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    const mol = proc.getCanonicalMolecule();
    const doc = buildCanonicalDocument([mol], { document_id: 'doc-stale' });

    const corruptedSel = {
      query: "corrupted",
      selected_ids: new Set([999]),
      selected_array: [999],
      count: 1
    };

    assert.throws(
      () => ScientificEditingKernel.remove(doc, corruptedSel),
      /target atom ID 999 does not exist/
    );
  });

  test("2.3 Revision conflict detection fails closed", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    const mol = proc.getCanonicalMolecule();
    const doc = buildCanonicalDocument([mol], { document_id: 'doc-conflict' });
    const rootRev = ScientificEditingKernel.createRootRevision(doc.document_id, 'obj-mol-1', mol);
    const sel = SelectionParser.evaluateCanonical("id 1", mol);

    assert.throws(
      () => ScientificEditingKernel.remove(doc, sel, {
        expectedRevisionId: 'rev-outdated-uuid',
        currentRevision: rootRev
      }),
      /revision conflict/
    );
  });

  test("2.4 Remove single atom leaves residue intact with updated atom list", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);
    const mol = proc.getCanonicalMolecule();
    const doc = buildCanonicalDocument([mol], { document_id: 'doc-single' });

    // Remove atom 1 (N of ALA 1)
    const sel = SelectionParser.evaluateCanonical("id 1", mol);
    const res = ScientificEditingKernel.remove(doc, sel);

    assert.strictEqual(res.updatedMolecule.atoms.length, 19);
    assert.strictEqual(res.updatedMolecule.atoms.find(a => a.canonical_id === 1), undefined);
    // Residue 1 should still exist with remaining atoms
    const res1 = res.updatedMolecule.residues.find(r => r.res_seq === 1)!;
    assert(res1, "Residue 1 must remain");
    assert(!res1.atom_ids.includes(1));
  });

  // --- SECTION 3: REVISION RESTORATION & PSE SESSION PERSISTENCE ---
  console.log("\n--- 3. Revision Restoration & Session Persistence ---");

  test("3.1 Revision restoration recovers original R0 state exactly", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);
    const mol0 = proc.getCanonicalMolecule();
    const doc0 = buildCanonicalDocument([mol0], { document_id: 'doc-restore' });
    const objId = 'obj-mol-1';

    const rootRev = ScientificEditingKernel.createRootRevision(doc0.document_id, objId, mol0);
    const sel = SelectionParser.evaluateCanonical("hetatm", mol0);
    const removeRes = ScientificEditingKernel.remove(doc0, sel, { currentRevision: rootRev });

    assert.strictEqual(removeRes.updatedMolecule.atoms.length, 16);

    // Restore R0
    const restoreRes = ScientificEditingKernel.restoreRevision(removeRes.updatedDocument, rootRev);
    const restoredMol = restoreRes.restoredMolecule;

    assert.strictEqual(restoredMol.atoms.length, 20);
    assert.strictEqual(restoredMol.topology.bonds.length, 19);
    assert.strictEqual(restoredMol.residues.length, 4);
  });

  test("3.2 Post-remove R1 state round-trip through MolStudio-PSE persistence", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);
    const mol0 = proc.getCanonicalMolecule();
    const doc0 = buildCanonicalDocument([mol0], { document_id: 'doc-pse' });
    const objId = 'obj-mol-1';

    const sel = SelectionParser.evaluateCanonical("hetatm", mol0);
    const removeRes = ScientificEditingKernel.remove(doc0, sel);
    const mol1 = removeRes.updatedMolecule;

    proc.applyScientificRevision(removeRes.revision);
    const pdbR1 = proc.toPDB();

    // Export PSE session with R1 state
    const session = SessionManager.createSession({
      molecules: [
        { id: objId, name: '03_protein_with_ligand_R1', format: 'pdb', data: pdbR1, atomCount: 16 }
      ],
      viewerState: {
        renderStyle: 'Ball-and-Stick',
        colorScheme: 'Modern/Jmol',
        surfaceOpacity: 0.8,
        backgroundColor: '#0A0A0A',
        orthographic: true,
        stereoMode: 'none'
      },
      selectionState: {
        selectionLevel: 'atom',
        selectedAtomSerials: [],
        namedSelections: []
      }
    });

    const exportedPse = SessionManager.exportSession(session);
    const importedSession = SessionManager.importSession(exportedPse);

    assert.strictEqual(importedSession.molecules.length, 1);
    assert.strictEqual(importedSession.molecules[0].atomCount, 16);

    const reloadedProc = new MolProcessor(importedSession.molecules[0].data, 'pdb');
    assert.strictEqual(reloadedProc.atoms.length, 16);
    assert.strictEqual(reloadedProc.atoms.every(a => !a.isHetero), true);
  });

  console.log("\n================================================================================");
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} Passed (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log("================================================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runRemoveTransactionTestSuite();
