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
import { computeCanonicalStateHash } from '../src/domain/StateHasher';
import { SessionManager } from '../src/session/SessionManager';

function runHydrogenTransactionTestSuite() {
  console.log("================================================================================");
  console.log("    TASK P3.4: SCIENTIFIC MUTATIONS 'h_add' / 'h_remove' / 'h_fill' SUITE       ");
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

  // --- SECTION 1: PRIMARY TARGET TRANSACTIONAL h_add -> h_remove ---
  console.log("--- 1. Primary Fixture: Transactional h_add -> h_remove Round-Trip ---");

  test("1.1 h_add on unsaturated ligand atom 17 models 2 hydrogens (20 -> 22 atoms, 19 -> 21 bonds)", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);

    const mol0 = proc.getCanonicalMolecule({ name: '03_protein_with_ligand.pdb', moleculeId: 'mol-target' });
    const doc0 = buildCanonicalDocument([mol0], { document_id: 'doc-h-1', name: 'Editing Workspace' });
    const objId = 'obj-mol-target';

    // Baseline R0
    assert.strictEqual(mol0.atoms.length, 20);
    assert.strictEqual(mol0.topology.bonds.length, 19);

    const rootRev = ScientificEditingKernel.createRootRevision(doc0.document_id, objId, mol0, 'Tester');
    const hash0 = rootRev.canonical_state_hash;

    // Atom 17 is Carbon bonded to 18 and 20 (valence = 2.0). Needed = 4 - 2 = 2 hydrogens.
    const addResult = ScientificEditingKernel.addHydrogens(doc0, [17], {
      objectId: objId,
      author: 'Scientific Agent',
      currentRevision: rootRev
    });

    const mol1 = addResult.updatedMolecule;
    const rev1 = addResult.revision;
    const prov1 = addResult.provenance;
    const doc1 = addResult.updatedDocument;

    // Invariants
    assert.strictEqual(mol1.atoms.length, 22, "Atom count must increase from 20 to 22");
    assert.strictEqual(mol1.topology.bonds.length, 21, "Bond count must increase from 19 to 21");
    assert.strictEqual(mol1.residues.length, 4, "Residues must remain unchanged");
    assert.strictEqual(mol1.chains.length, 1, "Chains must remain unchanged");

    // Existing atoms 1..20 must be 100% identical in ID and coordinates
    for (let i = 0; i < 20; i++) {
      assert.strictEqual(mol1.atoms[i].canonical_id, mol0.atoms[i].canonical_id);
      assert.strictEqual(mol1.atoms[i].x, mol0.atoms[i].x);
      assert.strictEqual(mol1.atoms[i].y, mol0.atoms[i].y);
      assert.strictEqual(mol1.atoms[i].z, mol0.atoms[i].z);
    }

    // New Hydrogens verification (DM-H-DISTINCTION)
    const h1 = mol1.atoms[20];
    const h2 = mol1.atoms[21];
    assert.strictEqual(h1.canonical_id, 21);
    assert.strictEqual(h1.element, 'H');
    assert.strictEqual(h1.modeled_hydrogen, true, "Must be flagged modeled_hydrogen: true");
    assert.strictEqual(h1.b_factor, 99.90, "Must have modeled B-factor 99.90");
    assert.strictEqual(h1.residue_ref, 100);
    assert.strictEqual(h1.chain_ref, 'A');

    assert.strictEqual(h2.canonical_id, 22);
    assert.strictEqual(h2.element, 'H');
    assert.strictEqual(h2.modeled_hydrogen, true);
    assert.strictEqual(h2.b_factor, 99.90);

    // Parent Residue hierarchy membership updated
    const ligRes = mol1.residues.find(r => r.res_seq === 100)!;
    assert(ligRes, "Ligand residue must exist in molecule");
    assert(ligRes.atom_ids.includes(21), "Residue must contain new atom ID 21");
    assert(ligRes.atom_ids.includes(22), "Residue must contain new atom ID 22");

    // New Bonds verification
    const bond17_21 = mol1.topology.bonds.find(b => b.atom_a === 17 && b.atom_b === 21);
    const bond17_22 = mol1.topology.bonds.find(b => b.atom_a === 17 && b.atom_b === 22);
    assert(bond17_21, "Bond (17, 21) must exist");
    assert(bond17_22, "Bond (17, 22) must exist");

    // State Hash & Provenance
    assert.notStrictEqual(rev1.canonical_state_hash, hash0);
    assert.strictEqual(rev1.parent_revision_id, rootRev.revision_id);
    assert.strictEqual(prov1.operation_name, 'h_add');
    assert.deepStrictEqual(prov1.parameters.new_hydrogen_ids, [21, 22]);

    // Presentation Sync
    proc.applyScientificRevision(rev1);
    assert.strictEqual(proc.atoms.length, 22);

    // Now execute h_remove on the newly added hydrogens -> R2
    const removeResult = ScientificEditingKernel.removeHydrogens(doc1, [21, 22], {
      objectId: objId,
      author: 'Scientific Agent',
      currentRevision: rev1
    });

    const mol2 = removeResult.updatedMolecule;
    const rev2 = removeResult.revision;
    const prov2 = removeResult.provenance;

    assert.strictEqual(mol2.atoms.length, 20);
    assert.strictEqual(mol2.topology.bonds.length, 19);
    assert.strictEqual(computeCanonicalStateHash(mol2), hash0, "Restored state hash after h_remove must match R0 exactly");
    assert.strictEqual(prov2.operation_name, 'h_remove');
    assert.deepStrictEqual(prov2.parameters.removed_hydrogen_ids, [21, 22]);
  });

  // --- SECTION 2: GLOBAL h_fill MUTATION ---
  console.log("\n--- 2. Global h_fill Mutation ---");

  test("2.1 h_fill populates modeled hydrogens across all unsaturated valencies", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);
    const mol0 = proc.getCanonicalMolecule();
    const doc0 = buildCanonicalDocument([mol0]);

    const fillResult = ScientificEditingKernel.fillHydrogens(doc0);
    const molFilled = fillResult.updatedMolecule;

    assert(molFilled.atoms.length > 20, "Atom count must increase after global h_fill");
    assert(molFilled.topology.bonds.length > 19, "Bond count must increase after global h_fill");

    // Verify all newly added atoms are marked modeled_hydrogen: true
    const modeledHydrogens = molFilled.atoms.filter(a => a.canonical_id > 20);
    assert(modeledHydrogens.length > 0);
    for (const h of modeledHydrogens) {
      assert.strictEqual(h.element, 'H');
      assert.strictEqual(h.modeled_hydrogen, true);
      assert.strictEqual(h.b_factor, 99.90);
    }
  });

  // --- SECTION 3: NEGATIVE & EDGE CASES ---
  console.log("\n--- 3. Negative & Edge Cases (Fail-Closed Guarantees) ---");

  test("3.1 Reject h_add on fully saturated atoms", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);
    const mol0 = proc.getCanonicalMolecule();
    const doc0 = buildCanonicalDocument([mol0]);

    // Fill all hydrogens to reach 100% saturation
    const docFilled = ScientificEditingKernel.fillHydrogens(doc0).updatedDocument;

    // Attempting h_add on fully saturated structure must fail closed
    assert.throws(
      () => ScientificEditingKernel.addHydrogens(docFilled),
      /no unsaturated valencies eligible/
    );
  });

  test("3.2 Reject h_remove when no hydrogens exist in selection", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);
    const mol0 = proc.getCanonicalMolecule();
    const doc0 = buildCanonicalDocument([mol0]);

    // 03_protein_with_ligand.pdb has zero hydrogens in baseline
    assert.throws(
      () => ScientificEditingKernel.removeHydrogens(doc0),
      /no hydrogen atoms found/
    );

    // Explicit selection containing only heavy atoms (e.g. [1, 2, 3])
    assert.throws(
      () => ScientificEditingKernel.removeHydrogens(doc0, [1, 2, 3]),
      /no hydrogen atoms found/
    );
  });

  test("3.3 Reject h_add with invalid atom ID", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    const mol0 = proc.getCanonicalMolecule();
    const doc0 = buildCanonicalDocument([mol0]);

    assert.throws(
      () => ScientificEditingKernel.addHydrogens(doc0, [999]),
      /atom ID 999 does not exist/
    );
  });

  test("3.4 Reject revision concurrency conflict", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    const mol0 = proc.getCanonicalMolecule();
    const doc0 = buildCanonicalDocument([mol0]);
    const rootRev = ScientificEditingKernel.createRootRevision(doc0.document_id, 'obj-mol-1', mol0);

    assert.throws(
      () => ScientificEditingKernel.addHydrogens(doc0, [17], {
        expectedRevisionId: 'rev-stale-conflict',
        currentRevision: rootRev
      }),
      /revision conflict/
    );
  });

  // --- SECTION 4: COMMAND PARSER ROUTING ---
  console.log("\n--- 4. Selection Parser Command Routing ---");

  test("4.1 SelectionParser routes 'h_add id 17', 'h_fill', and 'h_remove elem H'", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    const parser = new SelectionParser(proc.atoms);

    const resAdd = parser.evaluateCommand('h_add id 17');
    assert.strictEqual(resAdd.addHydrogens, true);
    assert(resAdd.selectedSerials.has(17));

    const resFill = parser.evaluateCommand('h_fill');
    assert.strictEqual(resFill.addHydrogens, true);

    const resRemove = parser.evaluateCommand('h_remove');
    assert.strictEqual(resRemove.removeHydrogens, true);

    const resRemoveSel = parser.evaluateCommand('remove_h resn LIG');
    assert.strictEqual(resRemoveSel.removeHydrogens, true);
  });

  // --- SECTION 5: RESTORATION & HIERARCHY INTEGRITY ---
  console.log("\n--- 5. Revision Restoration & Hierarchy Integrity ---");

  test("5.1 Revision snapshot restoration cleanly recovers R0 state from h_add revision", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);
    const mol0 = proc.getCanonicalMolecule();
    const doc0 = buildCanonicalDocument([mol0]);
    const rootRev = ScientificEditingKernel.createRootRevision(doc0.document_id, 'obj-mol-1', mol0);

    const addRes = ScientificEditingKernel.addHydrogens(doc0, [17], { currentRevision: rootRev });
    assert.strictEqual(addRes.updatedMolecule.atoms.length, 22);

    const restoreRes = ScientificEditingKernel.restoreRevision(addRes.updatedDocument, rootRev);
    assert.strictEqual(restoreRes.restoredMolecule.atoms.length, 20);
    assert.strictEqual(restoreRes.restoredMolecule.topology.bonds.length, 19);
    assert.strictEqual(computeCanonicalStateHash(restoreRes.restoredMolecule), rootRev.canonical_state_hash);
  });

  // --- SECTION 6: PSE SESSION PERSISTENCE ---
  console.log("\n--- 6. PSE Session Persistence ---");

  test("6.1 Modeled hydrogens persist across MolStudio-PSE save/reload", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);
    const mol0 = proc.getCanonicalMolecule();
    const doc0 = buildCanonicalDocument([mol0]);

    // Add 2 hydrogens to atom 17 -> 22 atoms
    const res1 = ScientificEditingKernel.addHydrogens(doc0, [17]);
    proc.applyScientificRevision(res1.revision);
    const pdbR1 = proc.toPDB();

    const session = SessionManager.createSession({
      molecules: [{ id: 'mol_main', name: 'hydrogen_edited', format: 'pdb', data: pdbR1, atomCount: 22 }],
      viewerState: { renderStyle: 'Stick', colorScheme: 'Modern/Jmol', surfaceOpacity: 0.8, backgroundColor: '#0A0A0A' },
      selectionState: { selectionLevel: 'atom', selectedAtomSerials: [], namedSelections: [] }
    });

    const pseStr = SessionManager.exportSession(session);
    const imported = SessionManager.importSession(pseStr);
    const reloadedProc = new MolProcessor(imported.molecules[0].data, 'pdb');

    assert.strictEqual(reloadedProc.atoms.length, 22, "Reloaded structure must contain 22 atoms");
    const hAtoms = reloadedProc.atoms.filter(a => a.elem === 'H');
    assert.strictEqual(hAtoms.length, 2, "Must contain 2 hydrogen atoms");
  });

  console.log("\n================================================================================");
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} Passed (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log("================================================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runHydrogenTransactionTestSuite();
