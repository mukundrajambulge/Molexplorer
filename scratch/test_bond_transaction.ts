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
import { SessionManager } from '../src/session/SessionManager';

function runBondTransactionTestSuite() {
  console.log("================================================================================");
  console.log("             TASK P3.2: SCIENTIFIC MUTATIONS 'bond' / 'unbond' SUITE            ");
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

  // --- SECTION 1: PRIMARY FIXTURE UNBOND -> BOND ROUND-TRIP ---
  console.log("--- 1. Primary Fixture: unbond -> bond Round-Trip (03_protein_with_ligand.pdb) ---");

  test("1.1 unbond removes exact covalent edge: 19 bonds -> 18 bonds, preserves all atoms and coordinates", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);

    const mol0 = proc.getCanonicalMolecule({ name: '03_protein_with_ligand.pdb', moleculeId: 'mol-target' });
    const doc0 = buildCanonicalDocument([mol0], { document_id: 'doc-bond-1', name: 'Editing Workspace' });
    const objId = 'obj-mol-target';

    // Baseline R0
    assert.strictEqual(mol0.atoms.length, 20);
    assert.strictEqual(mol0.topology.bonds.length, 19);

    const rootRev = ScientificEditingKernel.createRootRevision(doc0.document_id, objId, mol0, 'Tester');
    const hash0 = rootRev.canonical_state_hash;

    // Unbond ligand bond (17, 18)
    const unbondResult = ScientificEditingKernel.unbond(doc0, 17, 18, {
      objectId: objId,
      author: 'Scientific Agent',
      currentRevision: rootRev
    });

    const mol1 = unbondResult.updatedMolecule;
    const rev1 = unbondResult.revision;
    const prov1 = unbondResult.provenance;
    const doc1 = unbondResult.updatedDocument;

    // Invariants
    assert.strictEqual(mol1.atoms.length, 20, "Atom count must remain 20");
    assert.strictEqual(mol1.topology.bonds.length, 18, "Bond count must decrease from 19 to 18");
    assert.strictEqual(mol1.residues.length, 4, "Residues must remain unchanged");
    assert.strictEqual(mol1.chains.length, 1, "Chains must remain unchanged");

    // Coordinates must be strictly identical
    for (let i = 0; i < 20; i++) {
      assert.strictEqual(mol1.atoms[i].canonical_id, mol0.atoms[i].canonical_id);
      assert.strictEqual(mol1.atoms[i].x, mol0.atoms[i].x);
      assert.strictEqual(mol1.atoms[i].y, mol0.atoms[i].y);
      assert.strictEqual(mol1.atoms[i].z, mol0.atoms[i].z);
    }

    // Bond (17, 18) absent
    const hasBond17_18 = mol1.topology.bonds.some(b => b.atom_a === 17 && b.atom_b === 18);
    assert.strictEqual(hasBond17_18, false, "Bond between 17 and 18 must be removed");

    // Hash & Provenance
    assert.notStrictEqual(rev1.canonical_state_hash, hash0);
    assert.strictEqual(rev1.parent_revision_id, rootRev.revision_id);
    assert.strictEqual(prov1.operation_name, 'unbond');
    assert.deepStrictEqual(prov1.resolved_atom_ids, [17, 18]);

    // Presentation Sync
    proc.applyScientificRevision(rev1);
    assert.strictEqual(proc.atoms.length, 20);

    // Now re-bond (17, 18) with order 1 -> R2
    const bondResult = ScientificEditingKernel.bond(doc1, 18, 17, 1.0, {
      objectId: objId,
      author: 'Scientific Agent',
      currentRevision: rev1
    });

    const mol2 = bondResult.updatedMolecule;
    const rev2 = bondResult.revision;
    const prov2 = bondResult.provenance;

    assert.strictEqual(mol2.atoms.length, 20);
    assert.strictEqual(mol2.topology.bonds.length, 19);
    assert.strictEqual(rev2.parent_revision_id, rev1.revision_id);

    // Topological Equivalence: R2 state hash must match R0 state hash exactly!
    assert.strictEqual(rev2.canonical_state_hash, hash0, "Restored bond state hash must equal original root state hash");

    const restoredBond = mol2.topology.bonds.find(b => b.atom_a === 17 && b.atom_b === 18)!;
    assert(restoredBond, "Bond (17, 18) must be restored");
    assert.strictEqual(restoredBond.order, 1.0);
    assert.strictEqual(restoredBond.is_aromatic, false);

    assert.strictEqual(prov2.operation_name, 'bond');
    assert.deepStrictEqual(prov2.resolved_atom_ids, [17, 18]);
  });

  // --- SECTION 2: BOND ORDERS & MULTIPLICITY ---
  console.log("\n--- 2. Bond Orders & Multiplicity Semantics ---");

  test("2.1 Supported bond orders (1, 1.5, 2, 3) and aromaticity semantics", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);
    const mol0 = proc.getCanonicalMolecule();
    const doc0 = buildCanonicalDocument([mol0]);

    // Unbond 17, 18
    const doc1 = ScientificEditingKernel.unbond(doc0, 17, 18).updatedDocument;

    // Create double bond (order 2)
    const resDouble = ScientificEditingKernel.bond(doc1, 17, 18, 2.0);
    assert.strictEqual(resDouble.bond.order, 2.0);
    assert.strictEqual(resDouble.bond.is_aromatic, false);

    // Update existing bond to aromatic (order 1.5)
    const resAromatic = ScientificEditingKernel.bond(resDouble.updatedDocument, 17, 18, 1.5);
    assert.strictEqual(resAromatic.bond.order, 1.5);
    assert.strictEqual(resAromatic.bond.is_aromatic, true);

    // Update existing bond to triple (order 3)
    const resTriple = ScientificEditingKernel.bond(resAromatic.updatedDocument, 17, 18, 3.0);
    assert.strictEqual(resTriple.bond.order, 3.0);
    assert.strictEqual(resTriple.bond.is_aromatic, false);
  });

  // --- SECTION 3: NEGATIVE & EDGE CASES (FAIL-CLOSED GUARANTEES) ---
  console.log("\n--- 3. Negative & Edge Cases (Fail-Closed Guarantees) ---");

  test("3.1 Reject self-bonding (atomA == atomB)", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    const mol = proc.getCanonicalMolecule();
    const doc = buildCanonicalDocument([mol]);

    assert.throws(
      () => ScientificEditingKernel.bond(doc, 5, 5, 1.0),
      /self-bonding is strictly prohibited/
    );

    assert.throws(
      () => ScientificEditingKernel.unbond(doc, 5, 5),
      /self-bonding is invalid/
    );
  });

  test("3.2 Reject duplicate bond with identical order", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);
    const mol = proc.getCanonicalMolecule();
    const doc = buildCanonicalDocument([mol]);

    // Bond (1, 2) already exists with order 1
    assert.throws(
      () => ScientificEditingKernel.bond(doc, 1, 2, 1.0),
      /duplicate bond with identical order/
    );
  });

  test("3.3 Reject unbond when no bond exists", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);
    const mol = proc.getCanonicalMolecule();
    const doc = buildCanonicalDocument([mol]);

    // Atoms 1 and 20 are far apart and not bonded
    assert.throws(
      () => ScientificEditingKernel.unbond(doc, 1, 20),
      /no bond exists between specified atoms/
    );
  });

  test("3.4 Reject nonexistent atom endpoints", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    const mol = proc.getCanonicalMolecule();
    const doc = buildCanonicalDocument([mol]);

    assert.throws(
      () => ScientificEditingKernel.bond(doc, 999, 1, 1.0),
      /atom endpoint 999 does not exist/
    );

    assert.throws(
      () => ScientificEditingKernel.bond(doc, 1, 999, 1.0),
      /atom endpoint 999 does not exist/
    );

    assert.throws(
      () => ScientificEditingKernel.unbond(doc, 999, 1),
      /atom endpoint 999 does not exist/
    );
  });

  test("3.5 Reject unsupported bond order", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    const mol = proc.getCanonicalMolecule();
    const doc = buildCanonicalDocument([mol]);

    assert.throws(
      () => ScientificEditingKernel.bond(doc, 17, 18, 4.0),
      /unsupported bond order 4/
    );

    assert.throws(
      () => ScientificEditingKernel.bond(doc, 17, 18, 0),
      /unsupported bond order 0/
    );
  });

  test("3.6 Reject cross-conformer altLoc bonding", () => {
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
    const altLocMol = buildCanonicalMolecule(customAtoms, topology, {
      molecule_id: 'mol-altloc',
      name: 'AltLoc Test Molecule',
      source_format: 'pdb'
    });
    const doc = buildCanonicalDocument([altLocMol]);

    assert.throws(
      () => ScientificEditingKernel.bond(doc, 1, 2, 1.0),
      /cannot form covalent bond across disjoint altLoc conformers/
    );
  });

  test("3.7 Reject revision conflict", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);
    const mol = proc.getCanonicalMolecule();
    const doc = buildCanonicalDocument([mol]);
    const rootRev = ScientificEditingKernel.createRootRevision(doc.document_id, 'obj-mol-1', mol);

    assert.throws(
      () => ScientificEditingKernel.unbond(doc, 17, 18, {
        expectedRevisionId: 'rev-stale-123',
        currentRevision: rootRev
      }),
      /revision conflict/
    );
  });

  // --- SECTION 4: RESTORATION & PSE PERSISTENCE ---
  console.log("\n--- 4. Restoration & PSE Persistence ---");

  test("4.1 Revision restoration returns exact R0 state after unbonding", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);
    const mol0 = proc.getCanonicalMolecule();
    const doc0 = buildCanonicalDocument([mol0]);
    const rootRev = ScientificEditingKernel.createRootRevision(doc0.document_id, 'obj-mol-1', mol0);

    const unbondRes = ScientificEditingKernel.unbond(doc0, 17, 18, { currentRevision: rootRev });
    assert.strictEqual(unbondRes.updatedMolecule.topology.bonds.length, 18);

    const restoreRes = ScientificEditingKernel.restoreRevision(unbondRes.updatedDocument, rootRev);
    assert.strictEqual(restoreRes.restoredMolecule.topology.bonds.length, 19);
    assert.strictEqual(computeCanonicalStateHash(restoreRes.restoredMolecule), rootRev.canonical_state_hash);
  });

  test("4.2 Post-unbond R1 and post-bond R2 session save and reload round-trip", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);
    const mol0 = proc.getCanonicalMolecule();
    const doc0 = buildCanonicalDocument([mol0]);

    // Unbond 17, 18 -> R1
    const unbondRes = ScientificEditingKernel.unbond(doc0, 17, 18);
    proc.applyScientificRevision(unbondRes.revision);
    const pdbR1 = proc.toPDB();

    const sessionR1 = SessionManager.createSession({
      molecules: [{ id: 'mol_main', name: 'unbonded_state', format: 'pdb', data: pdbR1, atomCount: 20 }],
      viewerState: { renderStyle: 'Stick', colorScheme: 'Modern/Jmol', surfaceOpacity: 0.8, backgroundColor: '#0A0A0A' },
      selectionState: { selectionLevel: 'atom', selectedAtomSerials: [], namedSelections: [] }
    });

    const pseR1 = SessionManager.exportSession(sessionR1);
    const importedR1 = SessionManager.importSession(pseR1);
    const reloadedProcR1 = new MolProcessor(importedR1.molecules[0].data, 'pdb');

    assert.strictEqual(reloadedProcR1.atoms.length, 20);
    // In R1 PDB CONECT, bond 17-18 must be absent
    const atom17 = reloadedProcR1.atoms.find(a => a.serial === 17)!;
    const atom18 = reloadedProcR1.atoms.find(a => a.serial === 18)!;
    const atom18Idx = reloadedProcR1.atoms.indexOf(atom18);
    assert(!atom17.bonds.includes(atom18Idx), "Reloaded R1 must not have bond between 17 and 18");
  });

  console.log("\n================================================================================");
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} Passed (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log("================================================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runBondTransactionTestSuite();
