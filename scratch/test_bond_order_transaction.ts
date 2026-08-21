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
import { buildCanonicalTopology } from '../src/domain/BondAdapter';
import { buildCanonicalMolecule } from '../src/domain/HierarchyAdapter';
import { buildCanonicalDocument } from '../src/domain/DocumentAdapter';
import {
  ScientificEditingKernel,
  ScientificEditingError
} from '../src/domain/ScientificEditingKernel';
import { computeCanonicalStateHash } from '../src/domain/StateHasher';
import { validateMolecularValence } from '../src/domain/ValenceValidator';
import { SessionManager } from '../src/session/SessionManager';

function runBondOrderTransactionTestSuite() {
  console.log("================================================================================");
  console.log("       TASK P3.3: SCIENTIFIC MUTATIONS 'setBondOrder' / 'cycleValence' SUITE    ");
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

  // --- SECTION 1: PRIMARY TEST (03_protein_with_ligand.pdb) ---
  console.log("--- 1. Primary Fixture: Transactional Bond Order Modification (03_protein_with_ligand.pdb) ---");

  test("1.1 setBondOrder modifies bond (17, 20) 1.0 -> 2.0 (C=O carbonyl) with exact invariant preservation", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);

    const mol0 = proc.getCanonicalMolecule({ name: '03_protein_with_ligand.pdb', moleculeId: 'mol-target' });
    const doc0 = buildCanonicalDocument([mol0], { document_id: 'doc-order-1', name: 'Editing Workspace' });
    const objId = 'obj-mol-target';

    // Baseline R0
    assert.strictEqual(mol0.atoms.length, 20);
    assert.strictEqual(mol0.topology.bonds.length, 19);

    const rootRev = ScientificEditingKernel.createRootRevision(doc0.document_id, objId, mol0, 'Tester');
    const hash0 = rootRev.canonical_state_hash;

    const initialBond = mol0.topology.bonds.find(b => b.atom_a === 17 && b.atom_b === 20)!;
    assert(initialBond, "Bond (17, 20) must exist in baseline");
    assert.strictEqual(initialBond.order, 1.0);

    // Modify bond order 1.0 -> 2.0
    const result1 = ScientificEditingKernel.setBondOrder(doc0, 17, 20, 2.0, {
      objectId: objId,
      author: 'Scientific Agent',
      currentRevision: rootRev
    });

    const mol1 = result1.updatedMolecule;
    const rev1 = result1.revision;
    const prov1 = result1.provenance;
    const doc1 = result1.updatedDocument;

    // Invariants
    assert.strictEqual(mol1.atoms.length, 20, "Atom count must remain 20");
    assert.strictEqual(mol1.topology.bonds.length, 19, "Total bond count must remain 19");
    assert.strictEqual(mol1.residues.length, 4, "Residues must remain unchanged");
    assert.strictEqual(mol1.chains.length, 1, "Chains must remain unchanged");

    // Coordinates must remain strictly identical
    for (let i = 0; i < 20; i++) {
      assert.strictEqual(mol1.atoms[i].canonical_id, mol0.atoms[i].canonical_id);
      assert.strictEqual(mol1.atoms[i].x, mol0.atoms[i].x);
      assert.strictEqual(mol1.atoms[i].y, mol0.atoms[i].y);
      assert.strictEqual(mol1.atoms[i].z, mol0.atoms[i].z);
    }

    // Endpoints unchanged, order updated to 2.0
    const updatedBond = mol1.topology.bonds.find(b => b.atom_a === 17 && b.atom_b === 20)!;
    assert.strictEqual(updatedBond.order, 2.0, "Bond order must be updated to 2.0");
    assert.strictEqual(updatedBond.is_aromatic, false, "Bond must not be aromatic");

    // Cryptographic hash differentiation
    assert.notStrictEqual(rev1.canonical_state_hash, hash0, "State hash must change when bond order changes");
    assert.strictEqual(rev1.parent_revision_id, rootRev.revision_id);

    // Provenance verification
    assert.strictEqual(prov1.operation_name, 'set_bond_order');
    assert.deepStrictEqual(prov1.resolved_atom_ids, [17, 20]);
    assert.strictEqual(prov1.parameters.original_order, 1.0);
    assert.strictEqual(prov1.parameters.target_order, 2.0);

    // Presentation Sync
    proc.applyScientificRevision(rev1);
    assert.strictEqual(proc.atoms.length, 20);

    // Restoration verification: restore R0 snapshot
    const restored = ScientificEditingKernel.restoreRevision(doc1, rootRev);
    assert.strictEqual(restored.restoredMolecule.topology.bonds.length, 19);
    assert.strictEqual(computeCanonicalStateHash(restored.restoredMolecule), hash0, "Restored state hash must match R0 exactly");
  });

  // --- SECTION 2: CYCLE VALENCE SEQUENCE ---
  console.log("\n--- 2. Cycle Valence Progression (1 -> 1.5 -> 2 -> 3 -> 1) ---");

  test("2.1 cycleValence traverses bond multiplicities deterministically", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);
    const mol0 = proc.getCanonicalMolecule();
    let doc = buildCanonicalDocument([mol0]);

    // Initial order is 1.0 on bond (17, 18)
    const bond0 = mol0.topology.bonds.find(b => b.atom_a === 17 && b.atom_b === 18)!;
    assert.strictEqual(bond0.order, 1.0);

    // 1 -> 1.5 (Aromatic)
    const step1 = ScientificEditingKernel.cycleValence(doc, 17, 18);
    assert.strictEqual(step1.modifiedBond.order, 1.5);
    assert.strictEqual(step1.modifiedBond.is_aromatic, true);
    doc = step1.updatedDocument;

    // 1.5 -> 2.0 (Double)
    const step2 = ScientificEditingKernel.cycleValence(doc, 17, 18);
    assert.strictEqual(step2.modifiedBond.order, 2.0);
    assert.strictEqual(step2.modifiedBond.is_aromatic, false);
    doc = step2.updatedDocument;

    // 2.0 -> 3.0 (Triple)
    const step3 = ScientificEditingKernel.cycleValence(doc, 17, 18);
    assert.strictEqual(step3.modifiedBond.order, 3.0);
    assert.strictEqual(step3.modifiedBond.is_aromatic, false);
    doc = step3.updatedDocument;

    // 3.0 -> 1.0 (Single wrap-around)
    const step4 = ScientificEditingKernel.cycleValence(doc, 17, 18);
    assert.strictEqual(step4.modifiedBond.order, 1.0);
    assert.strictEqual(step4.modifiedBond.is_aromatic, false);
  });

  // --- SECTION 3: VALENCE VALIDATION & CHEMICAL LIMITS ---
  console.log("\n--- 3. Chemical Valence Validation & Fail-Closed Errors ---");

  test("3.1 Hard error on exceeding Hydrogen valence limit (V > 1.0)", () => {
    const customAtoms: CanonicalAtom[] = [
      {
        canonical_id: 1, element: 'C', name: 'CA', x: 0, y: 0, z: 0,
        occupancy: 1, b_factor: 20, alt_loc: ' ', is_hetero: false,
        formal_charge: 0, residue_ref: 1, residue_name: 'ALA', chain_ref: 'A',
        modeled_hydrogen: false
      },
      {
        canonical_id: 2, element: 'H', name: 'HA', x: 1, y: 0, z: 0,
        occupancy: 1, b_factor: 20, alt_loc: ' ', is_hetero: false,
        formal_charge: 0, residue_ref: 1, residue_name: 'ALA', chain_ref: 'A',
        modeled_hydrogen: false
      }
    ];
    const initialBonds = [{
      bond_id: 'bond-1-2', atom_a: 1, atom_b: 2, order: 1.0, is_aromatic: false, source: 'model' as const, is_inferred: false
    }];
    const topology = buildCanonicalTopology(customAtoms, initialBonds);
    const mol = buildCanonicalMolecule(customAtoms, topology, {
      molecule_id: 'mol-h-test',
      name: 'Hydrogen Valence Test',
      source_format: 'pdb'
    });
    const doc = buildCanonicalDocument([mol]);

    // Attempt to make C=H double bond (valence 2 on H)
    assert.throws(
      () => ScientificEditingKernel.setBondOrder(doc, 1, 2, 2.0),
      /valence load 2 exceeds hard chemical limit of 1/
    );
  });

  test("3.2 Hard error on exceeding Carbon hard valence limit (V > 4.5)", () => {
    const customAtoms: CanonicalAtom[] = [
      {
        canonical_id: 1, element: 'C', name: 'C1', x: 0, y: 0, z: 0,
        occupancy: 1, b_factor: 20, alt_loc: ' ', is_hetero: false,
        formal_charge: 0, residue_ref: 1, residue_name: 'LIG', chain_ref: 'A',
        modeled_hydrogen: false
      },
      {
        canonical_id: 2, element: 'C', name: 'C2', x: 1.4, y: 0, z: 0,
        occupancy: 1, b_factor: 20, alt_loc: ' ', is_hetero: false,
        formal_charge: 0, residue_ref: 1, residue_name: 'LIG', chain_ref: 'A',
        modeled_hydrogen: false
      },
      {
        canonical_id: 3, element: 'C', name: 'C3', x: 0, y: 1.4, z: 0,
        occupancy: 1, b_factor: 20, alt_loc: ' ', is_hetero: false,
        formal_charge: 0, residue_ref: 1, residue_name: 'LIG', chain_ref: 'A',
        modeled_hydrogen: false
      }
    ];
    // Atom 1 already has bond with atom 2 (order 3.0) and atom 3 (order 1.0) -> valence = 4.0
    const initialBonds = [
      { bond_id: 'bond-1-2', atom_a: 1, atom_b: 2, order: 3.0, is_aromatic: false, source: 'model' as const, is_inferred: false },
      { bond_id: 'bond-1-3', atom_a: 1, atom_b: 3, order: 1.0, is_aromatic: false, source: 'model' as const, is_inferred: false }
    ];
    const topology = buildCanonicalTopology(customAtoms, initialBonds);
    const mol = buildCanonicalMolecule(customAtoms, topology, {
      molecule_id: 'mol-c-test',
      name: 'Carbon Valence Test',
      source_format: 'pdb'
    });
    const doc = buildCanonicalDocument([mol]);

    // Increasing bond (1, 3) to 2.0 gives C1 valence 3.0 + 2.0 = 5.0 > 4.5 (pentavalent carbon)
    assert.throws(
      () => ScientificEditingKernel.setBondOrder(doc, 1, 3, 2.0),
      /valence load 5 exceeds hard chemical limit of 4.5/
    );
  });

  // --- SECTION 4: NEGATIVE & EDGE CASES ---
  console.log("\n--- 4. Negative & Edge Cases (Fail-Closed Guarantees) ---");

  test("4.1 Reject invalid atom IDs", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    const mol = proc.getCanonicalMolecule();
    const doc = buildCanonicalDocument([mol]);

    assert.throws(
      () => ScientificEditingKernel.setBondOrder(doc, 999, 1, 2.0),
      /atom endpoint 999 does not exist/
    );

    assert.throws(
      () => ScientificEditingKernel.setBondOrder(doc, 1, 999, 2.0),
      /atom endpoint 999 does not exist/
    );
  });

  test("4.2 Reject nonexistent bond", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);
    const mol = proc.getCanonicalMolecule();
    const doc = buildCanonicalDocument([mol]);

    // Atoms 1 and 20 are not bonded
    assert.throws(
      () => ScientificEditingKernel.setBondOrder(doc, 1, 20, 2.0),
      /no bond exists between specified atoms/
    );
  });

  test("4.3 Reject self-bond modification", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    const mol = proc.getCanonicalMolecule();
    const doc = buildCanonicalDocument([mol]);

    assert.throws(
      () => ScientificEditingKernel.setBondOrder(doc, 5, 5, 2.0),
      /self-bonding is invalid/
    );
  });

  test("4.4 Reject redundant identical order modification", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);
    const mol = proc.getCanonicalMolecule();
    const doc = buildCanonicalDocument([mol]);

    // Bond (1, 2) already has order 1.0
    assert.throws(
      () => ScientificEditingKernel.setBondOrder(doc, 1, 2, 1.0),
      /already has order 1/
    );
  });

  test("4.5 Reject unsupported bond order", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);
    const mol = proc.getCanonicalMolecule();
    const doc = buildCanonicalDocument([mol]);

    assert.throws(
      () => ScientificEditingKernel.setBondOrder(doc, 17, 18, 4.0),
      /unsupported bond order 4/
    );
  });

  test("4.6 Reject revision conflict", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);
    const mol = proc.getCanonicalMolecule();
    const doc = buildCanonicalDocument([mol]);
    const rootRev = ScientificEditingKernel.createRootRevision(doc.document_id, 'obj-mol-1', mol);

    assert.throws(
      () => ScientificEditingKernel.setBondOrder(doc, 17, 18, 2.0, {
        expectedRevisionId: 'rev-stale-999',
        currentRevision: rootRev
      }),
      /revision conflict/
    );
  });

  test("4.7 Reject cross-altLoc bond order modification", () => {
    const customAtoms: CanonicalAtom[] = [
      {
        canonical_id: 1, element: 'C', name: 'CA', x: 0, y: 0, z: 0,
        occupancy: 0.5, b_factor: 20, alt_loc: 'A', is_hetero: false,
        formal_charge: 0, residue_ref: 1, residue_name: 'ALA', chain_ref: 'A',
        modeled_hydrogen: false
      },
      {
        canonical_id: 2, element: 'C', name: 'CA', x: 1, y: 0, z: 0,
        occupancy: 0.5, b_factor: 20, alt_loc: 'B', is_hetero: false,
        formal_charge: 0, residue_ref: 1, residue_name: 'ALA', chain_ref: 'A',
        modeled_hydrogen: false
      }
    ];
    const topology = buildCanonicalTopology(customAtoms, []);
    const mol = buildCanonicalMolecule(customAtoms, topology, {
      molecule_id: 'mol-altloc',
      name: 'AltLoc Test Molecule',
      source_format: 'pdb'
    });
    const doc = buildCanonicalDocument([mol]);

    assert.throws(
      () => ScientificEditingKernel.setBondOrder(doc, 1, 2, 2.0),
      /cannot modify bond across disjoint altLoc conformers/
    );
  });

  // --- SECTION 5: SELECTION PARSER & COMMAND ROUTING ---
  console.log("\n--- 5. Selection Parser & Command Routing ---");

  test("5.1 SelectionParser routes 'order id 19, id 20, 2' and 'cycle_valence id 17, id 18'", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    const parser = new SelectionParser(proc.atoms);

    const resOrder = parser.evaluateCommand('order id 19, id 20, 2');
    assert(resOrder.setBondOrderRequest, "Must have setBondOrderRequest");
    assert.strictEqual(resOrder.setBondOrderRequest.atomA, 19);
    assert.strictEqual(resOrder.setBondOrderRequest.atomB, 20);
    assert.strictEqual(resOrder.setBondOrderRequest.order, 2);

    const resValence = parser.evaluateCommand('valence 2, id 19, id 20');
    assert(resValence.setBondOrderRequest, "Must have setBondOrderRequest");
    assert.strictEqual(resValence.setBondOrderRequest.order, 2);

    const resCycle = parser.evaluateCommand('cycle_valence id 17, id 18');
    assert(resCycle.cycleValenceRequest, "Must have cycleValenceRequest");
    assert.strictEqual(resCycle.cycleValenceRequest.atomA, 17);
    assert.strictEqual(resCycle.cycleValenceRequest.atomB, 18);
  });

  // --- SECTION 6: PSE SESSION PERSISTENCE ---
  console.log("\n--- 6. PSE Session Persistence ---");

  test("6.1 Modified bond order persists accurately across MolStudio-PSE save/reload", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);
    const mol0 = proc.getCanonicalMolecule();
    const doc0 = buildCanonicalDocument([mol0]);

    // Change bond (17, 20) to order 2.0 -> R1
    const res1 = ScientificEditingKernel.setBondOrder(doc0, 17, 20, 2.0);
    proc.applyScientificRevision(res1.revision);
    const pdbR1 = proc.toPDB();

    const session = SessionManager.createSession({
      molecules: [{ id: 'mol_main', name: 'bond_order_edited', format: 'pdb', data: pdbR1, atomCount: 20 }],
      viewerState: { renderStyle: 'Ball-and-Stick', colorScheme: 'Modern/Jmol', surfaceOpacity: 0.8, backgroundColor: '#0A0A0A' },
      selectionState: { selectionLevel: 'atom', selectedAtomSerials: [], namedSelections: [] }
    });

    const pseStr = SessionManager.exportSession(session);
    const imported = SessionManager.importSession(pseStr);
    const reloadedProc = new MolProcessor(imported.molecules[0].data, 'pdb');

    assert.strictEqual(reloadedProc.atoms.length, 20);
    // In reloaded atoms, bond connection is preserved
    const atom17 = reloadedProc.atoms.find(a => a.serial === 17)!;
    const atom20 = reloadedProc.atoms.find(a => a.serial === 20)!;
    const atom20Idx = reloadedProc.atoms.indexOf(atom20);
    assert(atom17.bonds.includes(atom20Idx), "Bond between 17 and 20 must persist");
  });

  console.log("\n================================================================================");
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} Passed (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log("================================================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runBondOrderTransactionTestSuite();
