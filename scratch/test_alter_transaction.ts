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

function runAlterTransactionTestSuite() {
  console.log("================================================================================");
  console.log("     TASK P3.5: SCIENTIFIC PROPERTY MUTATIONS 'alter' / 'alter_state' SUITE      ");
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

  // --- SECTION 1: PRIMARY VALID ALTER MUTATIONS ---
  console.log("--- 1. Valid Scientific Property Mutations (alter) ---");

  test("1.1 alter atom name (id 17: C -> C99) preserves all coordinates, topology & hierarchy", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);

    const mol0 = proc.getCanonicalMolecule({ name: '03_protein_with_ligand.pdb', moleculeId: 'mol-target' });
    const doc0 = buildCanonicalDocument([mol0], { document_id: 'doc-alter-1', name: 'Editing Workspace' });
    const objId = 'obj-mol-target';

    const rootRev = ScientificEditingKernel.createRootRevision(doc0.document_id, objId, mol0, 'Tester');
    const hash0 = rootRev.canonical_state_hash;

    const result = ScientificEditingKernel.alter(
      doc0,
      [17],
      { property: 'name', value: 'C99' },
      { objectId: objId, author: 'Scientific Agent', currentRevision: rootRev }
    );

    const mol1 = result.updatedMolecule;
    const rev1 = result.revision;
    const prov1 = result.provenance;

    // Invariants
    assert.strictEqual(mol1.atoms.length, 20, "Atom count strictly invariant");
    assert.strictEqual(mol1.topology.bonds.length, 19, "Bond count strictly invariant");
    assert.strictEqual(mol1.residues.length, 4, "Residues strictly invariant");
    assert.strictEqual(mol1.chains.length, 1, "Chains strictly invariant");

    // Coordinates strictly invariant
    for (let i = 0; i < 20; i++) {
      assert.strictEqual(mol1.atoms[i].canonical_id, mol0.atoms[i].canonical_id);
      assert.strictEqual(mol1.atoms[i].x, mol0.atoms[i].x);
      assert.strictEqual(mol1.atoms[i].y, mol0.atoms[i].y);
      assert.strictEqual(mol1.atoms[i].z, mol0.atoms[i].z);
    }

    // Property update
    const atom17 = mol1.atom_map.get(17)!;
    assert.strictEqual(atom17.name, 'C99');

    // Hash & Provenance
    assert.notStrictEqual(rev1.canonical_state_hash, hash0);
    assert.strictEqual(prov1.operation_name, 'alter');
    assert.strictEqual(prov1.parameters.property, 'name');
    assert.strictEqual(prov1.parameters.new_value, 'C99');
    assert.strictEqual(prov1.parameters.old_values[17], mol0.atom_map.get(17)!.name);

    // Presentation sync
    proc.applyScientificRevision(rev1);
    assert.strictEqual(proc.atoms.find(a => a.serial === 17)!.name, 'C99');

    // Restoration
    const restored = ScientificEditingKernel.restoreRevision(result.updatedDocument, rootRev);
    assert.strictEqual(restored.restoredMolecule.atom_map.get(17)!.name, mol0.atom_map.get(17)!.name);
    assert.strictEqual(computeCanonicalStateHash(restored.restoredMolecule), hash0);
  });

  test("1.2 alter residue name (resn ALA -> GLY) updates residue classification and hierarchy", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);
    const mol0 = proc.getCanonicalMolecule();
    const doc0 = buildCanonicalDocument([mol0]);

    // ALA residue atoms are 1..6
    const alaAtomIds = mol0.residues.find(r => r.name === 'ALA')!.atom_ids;

    const result = ScientificEditingKernel.alter(
      doc0,
      alaAtomIds,
      { property: 'resn', value: 'GLY' }
    );

    const mol1 = result.updatedMolecule;
    for (const id of alaAtomIds) {
      assert.strictEqual(mol1.atom_map.get(id)!.residue_name, 'GLY');
    }

    const modifiedRes = mol1.residues.find(r => r.res_seq === 1)!;
    assert.strictEqual(modifiedRes.name, 'GLY');
    assert.strictEqual(modifiedRes.classification, 'amino_acid');
  });

  test("1.3 alter chain (chain A -> B) merges/moves hierarchy cleanly", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);
    const mol0 = proc.getCanonicalMolecule();
    const doc0 = buildCanonicalDocument([mol0]);

    // Move ligand atoms 17..20 to chain 'B'
    const result = ScientificEditingKernel.alter(
      doc0,
      [17, 18, 19, 20],
      { property: 'chain', value: 'B' }
    );

    const mol1 = result.updatedMolecule;
    assert.strictEqual(mol1.chains.length, 2, "Chains count should be 2 (A and B)");
    assert(mol1.chain_map.has('A'));
    assert(mol1.chain_map.has('B'));

    const ligAtom = mol1.atom_map.get(17)!;
    assert.strictEqual(ligAtom.chain_ref, 'B');

    const ligRes = mol1.residues.find(r => r.res_seq === 100)!;
    assert.strictEqual(ligRes.chain_ref, 'B');
  });

  test("1.4 alter formal charge (id 17: 0 -> -1) validates valence and preserves invariants", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);
    const mol0 = proc.getCanonicalMolecule();
    const doc0 = buildCanonicalDocument([mol0]);

    const result = ScientificEditingKernel.alter(
      doc0,
      [17],
      { property: 'formal_charge', value: -1 }
    );

    const mol1 = result.updatedMolecule;
    assert.strictEqual(mol1.atom_map.get(17)!.formal_charge, -1);
  });

  // --- SECTION 2: ALTER_STATE MUTATION ---
  console.log("\n--- 2. State-Scoped Mutation (alter_state) ---");

  test("2.1 alter_state performs property modification scoped to designated state", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);
    const mol0 = proc.getCanonicalMolecule();
    const doc0 = buildCanonicalDocument([mol0]);
    const stateId = Array.from(doc0.states.keys())[0];

    const result = ScientificEditingKernel.alterState(
      doc0,
      stateId,
      [17],
      { property: 'name', value: 'C88' }
    );

    assert.strictEqual(result.provenance.operation_name, 'alter_state');
    assert.strictEqual(result.updatedMolecule.atom_map.get(17)!.name, 'C88');
  });

  // --- SECTION 3: SECURITY & ANTI-INJECTION ---
  console.log("\n--- 3. Security & Anti-Injection Guarantees ---");

  test("3.1 Reject arbitrary code injection in alter expression", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    const mol0 = proc.getCanonicalMolecule();
    const doc0 = buildCanonicalDocument([mol0]);

    // JavaScript injection attempt
    assert.throws(
      () => ScientificEditingKernel.alter(doc0, [17], { property: 'name', value: 'javascript:alert(1)' }),
      /forbidden security pattern/
    );

    // Prototype pollution attempt
    assert.throws(
      () => ScientificEditingKernel.alter(doc0, [17], { property: 'name', value: '__proto__' }),
      /forbidden security pattern/
    );

    // Function constructor injection attempt
    assert.throws(
      () => ScientificEditingKernel.alter(doc0, [17], { property: 'name', value: 'Function("return 1")' }),
      /forbidden security pattern/
    );

    // Process injection attempt
    assert.throws(
      () => ScientificEditingKernel.alter(doc0, [17], { property: 'name', value: 'process.exit(1)' }),
      /forbidden security pattern/
    );
  });

  test("3.2 Reject non-whitelisted property names", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    const mol0 = proc.getCanonicalMolecule();
    const doc0 = buildCanonicalDocument([mol0]);

    assert.throws(
      () => ScientificEditingKernel.alter(doc0, [17], { property: 'unapproved_prop' as any, value: 'foo' }),
      /property "unapproved_prop" is not allowed/
    );
  });

  // --- SECTION 4: NEGATIVE & EDGE CASES ---
  console.log("\n--- 4. Negative & Edge Cases (Fail-Closed Guarantees) ---");

  test("4.1 Reject no-op redundant property mutation", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    const mol0 = proc.getCanonicalMolecule();
    const doc0 = buildCanonicalDocument([mol0]);

    // Atom 17 is already named mol0.atom_map.get(17)!.name
    assert.throws(
      () => ScientificEditingKernel.alter(doc0, [17], { property: 'name', value: mol0.atom_map.get(17)!.name }),
      /no-op mutation/
    );
  });

  test("4.2 Reject invalid value constraints", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    const mol0 = proc.getCanonicalMolecule();
    const doc0 = buildCanonicalDocument([mol0]);

    // Name too long (> 4 chars)
    assert.throws(
      () => ScientificEditingKernel.alter(doc0, [17], { property: 'name', value: 'TOOLONGNAME' }),
      /must be 1 to 4 characters/
    );

    // Formal charge non-integer
    assert.throws(
      () => ScientificEditingKernel.alter(doc0, [17], { property: 'formal_charge', value: 'invalid_num' as any }),
      /must be an integer/
    );
  });

  test("4.3 Reject invalid atom IDs & empty selection", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    const mol0 = proc.getCanonicalMolecule();
    const doc0 = buildCanonicalDocument([mol0]);

    assert.throws(
      () => ScientificEditingKernel.alter(doc0, [], { property: 'name', value: 'C10' }),
      /target selection is empty/
    );

    assert.throws(
      () => ScientificEditingKernel.alter(doc0, [9999], { property: 'name', value: 'C10' }),
      /atom ID 9999 does not exist/
    );
  });

  // --- SECTION 5: COMMAND PARSER ROUTING ---
  console.log("\n--- 5. Selection Parser Command Routing ---");

  test("5.1 SelectionParser routes 'alter id 17, name=C99' and 'alter_state state_1, id 17, name=C99'", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    const parser = new SelectionParser(proc.atoms);

    const resAlter = parser.evaluateCommand('alter id 17, name=C99');
    assert(resAlter.alterRequest);
    assert.strictEqual(resAlter.alterRequest.property, 'name');
    assert.strictEqual(resAlter.alterRequest.value, 'C99');

    const resAlterState = parser.evaluateCommand('alter_state state_1, id 17, name=C99');
    assert(resAlterState.alterStateRequest);
    assert.strictEqual(resAlterState.alterStateRequest.stateId, 'state_1');
    assert.strictEqual(resAlterState.alterStateRequest.property, 'name');
    assert.strictEqual(resAlterState.alterStateRequest.value, 'C99');
  });

  // --- SECTION 6: PSE SESSION PERSISTENCE ---
  console.log("\n--- 6. PSE Session Persistence ---");

  test("6.1 Altered properties persist across MolStudio-PSE save/reload", () => {
    const proc = new MolProcessor(pdbContent, 'pdb');
    proc.assignBonds(1.15);
    const mol0 = proc.getCanonicalMolecule();
    const doc0 = buildCanonicalDocument([mol0]);

    // Alter atom 17 name to C99
    const res1 = ScientificEditingKernel.alter(doc0, [17], { property: 'name', value: 'C99' });
    proc.applyScientificRevision(res1.revision);
    const pdbR1 = proc.toPDB();

    const session = SessionManager.createSession({
      molecules: [{ id: 'mol_main', name: 'altered_edited', format: 'pdb', data: pdbR1, atomCount: 20 }],
      viewerState: { renderStyle: 'Stick', colorScheme: 'Modern/Jmol', surfaceOpacity: 0.8, backgroundColor: '#0A0A0A' },
      selectionState: { selectionLevel: 'atom', selectedAtomSerials: [], namedSelections: [] }
    });

    const pseStr = SessionManager.exportSession(session);
    const imported = SessionManager.importSession(pseStr);
    const reloadedProc = new MolProcessor(imported.molecules[0].data, 'pdb');

    assert.strictEqual(reloadedProc.atoms.length, 20);
    const reloadedAtom17 = reloadedProc.atoms.find(a => a.serial === 17)!;
    assert.strictEqual(reloadedAtom17.name.trim(), 'C99');
  });

  console.log("\n================================================================================");
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} Passed (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log("================================================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runAlterTransactionTestSuite();
