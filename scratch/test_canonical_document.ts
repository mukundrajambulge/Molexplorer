import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { MolProcessor } from '../src/lib/MolProcessor';
import { CanonicalAtom, CanonicalMolecule } from '../src/types/domain';
import {
  buildCanonicalState,
  buildCanonicalObject,
  buildCanonicalDocument,
  validateCanonicalDocument,
  DocumentIntegrityError
} from '../src/domain/DocumentAdapter';
import { buildCanonicalMolecule } from '../src/domain/HierarchyAdapter';
import { toCanonicalBond, buildCanonicalTopology } from '../src/domain/BondAdapter';

function runCanonicalDocumentTestSuite() {
  console.log("================================================================================");
  console.log("             TASK P1.4: CANONICAL DOCUMENT & CONTAINER TEST SUITE               ");
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

  // --- SUITE 1: CANONICAL DOCUMENT & CONTAINER UNIT TESTS ---
  console.log("--- 1. Document, Object, and State Construction & Validation ---");

  test("1.1 buildCanonicalState extracts aligned coordinate tensor", () => {
    const mockAtoms: CanonicalAtom[] = [
      { canonical_id: 1, element: 'C', name: 'CA', residue_ref: 1, residue_name: 'ALA', chain_ref: 'A', is_hetero: false, x: 10.5, y: 20.25, z: -5.75 } as CanonicalAtom,
      { canonical_id: 2, element: 'N', name: 'N', residue_ref: 1, residue_name: 'ALA', chain_ref: 'A', is_hetero: false, x: 11.2, y: 19.8, z: -4.3 } as CanonicalAtom
    ];
    const mockTopology = buildCanonicalTopology(mockAtoms, [toCanonicalBond(1, 2)]);
    const mol = buildCanonicalMolecule(mockAtoms, mockTopology, { molecule_id: 'mol-unit-1', name: 'UnitMol' });

    const state = buildCanonicalState(mol, 1, 'state-1', 'Active Conformation');
    assert.strictEqual(state.state_id, 'state-1');
    assert.strictEqual(state.state_index, 1);
    assert.strictEqual(state.molecule_ref, 'mol-unit-1');
    assert.strictEqual(state.coordinates.length, 2);
    assert.strictEqual(state.coordinates[0].x, 10.5);
    assert.strictEqual(state.coordinates[1].z, -4.3);
  });

  test("1.2 buildCanonicalObject binds molecule and active state correctly", () => {
    const mockAtoms: CanonicalAtom[] = [
      { canonical_id: 1, element: 'C', name: 'CA', residue_ref: 1, residue_name: 'ALA', chain_ref: 'A', is_hetero: false, x: 0, y: 0, z: 0 } as CanonicalAtom
    ];
    const mockTopology = buildCanonicalTopology(mockAtoms, []);
    const mol = buildCanonicalMolecule(mockAtoms, mockTopology, { molecule_id: 'mol-unit-2', name: 'SingleAtomMol' });
    const state = buildCanonicalState(mol, 1, 'state-active-1');
    const obj = buildCanonicalObject(mol, state, { object_id: 'obj-1', name: 'Object Alpha' });

    assert.strictEqual(obj.object_id, 'obj-1');
    assert.strictEqual(obj.name, 'Object Alpha');
    assert.strictEqual(obj.molecule_ref, 'mol-unit-2');
    assert.strictEqual(obj.active_state_id, 'state-active-1');
    assert.deepStrictEqual(obj.state_ids, ['state-active-1']);
    assert.strictEqual(obj.enabled, true);
  });

  test("1.3 Hierarchy validation catches broken object/state/molecule references", () => {
    const mockAtoms: CanonicalAtom[] = [
      { canonical_id: 1, element: 'C', name: 'CA', residue_ref: 1, residue_name: 'ALA', chain_ref: 'A', is_hetero: false, x: 0, y: 0, z: 0 } as CanonicalAtom
    ];
    const mockTopology = buildCanonicalTopology(mockAtoms, []);
    const mol = buildCanonicalMolecule(mockAtoms, mockTopology, { molecule_id: 'mol-3' });
    const doc = buildCanonicalDocument([mol], { document_id: 'doc-3' });

    // 1. Break object list reference
    doc.object_ids.push('obj-ghost');
    assert.throws(() => validateCanonicalDocument(doc), DocumentIntegrityError);
    doc.object_ids.pop();

    // 2. Break state coordinate alignment
    const state = doc.states.get('mol-3-state-1')!;
    state.coordinates.push({ x: 1, y: 1, z: 1 }); // Mismatched coordinate count
    assert.throws(() => validateCanonicalDocument(doc), DocumentIntegrityError);
  });

  // --- SUITE 2: MOLPROCESSOR INTEGRATION & CACHING ---
  console.log("\n--- 2. MolProcessor getCanonicalDocument() & Cache Invalidation ---");

  test("2.1 MolProcessor.getCanonicalDocument() builds complete workspace container", () => {
    const pdb = `
ATOM      1  N   ALA A   1      10.000  10.000  10.000  1.00 20.00           N  
ATOM      2  CA  ALA A   1      11.450  10.000  10.000  1.00 20.00           C  
CONECT    1    2
END
`;
    const proc = new MolProcessor(pdb.trim(), 'pdb');
    const doc = proc.getCanonicalDocument({ name: 'TestWorkspace' });

    assert.strictEqual(doc.name, 'TestWorkspace');
    assert.strictEqual(doc.object_ids.length, 1);
    assert(doc.objects.has(doc.object_ids[0]));

    const obj = doc.objects.get(doc.object_ids[0])!;
    assert(doc.molecules.has(obj.molecule_ref));
    assert(doc.states.has(obj.active_state_id));

    const mol = doc.molecules.get(obj.molecule_ref)!;
    assert.strictEqual(mol.atoms.length, 2);
    assert.strictEqual(mol.topology.bonds.length, 1);
  });

  test("2.2 Cache invalidation when processor atoms change", () => {
    const pdb = `ATOM      1  N   ALA A   1      10.000  10.000  10.000  1.00 20.00           N  \nEND`;
    const proc = new MolProcessor(pdb, 'pdb');

    const firstDoc = proc.getCanonicalDocument();
    const secondDoc = proc.getCanonicalDocument();
    assert.strictEqual(firstDoc, secondDoc, "Should return cached reference");

    proc.atoms = [...proc.atoms];
    const thirdDoc = proc.getCanonicalDocument();
    assert.notStrictEqual(firstDoc, thirdDoc, "Cache should invalidate on atoms array change");
  });

  // --- SUITE 3: GOLDEN FIXTURE DOCUMENT BENCHMARKS ---
  console.log("\n--- 3. Golden Fixture Exact Document Benchmarks ---");

  const goldenFixtures = [
    {
      path: 'fixtures/03_protein_with_ligand.pdb',
      name: '03_protein_with_ligand.pdb',
      expectedAtoms: 20,
      expectedBonds: 19,
      expectedChains: 1,
      expectedResidues: 4
    },
    {
      path: '1BNA.pdb',
      name: '1BNA.pdb (Synthetic B-DNA)',
      expectedAtoms: 566,
      expectedBonds: 544,
      expectedChains: 2,
      expectedResidues: 104
    },
    {
      path: '1HVR.pdb',
      name: '1HVR.pdb (HIV-1 Protease Dimer + XK263)',
      expectedAtoms: 1890,
      expectedBonds: 1922,
      expectedChains: 2,
      expectedResidues: 199
    },
    {
      path: 'scratch/1CRN.pdb',
      name: '1CRN.pdb (Crambin)',
      expectedAtoms: 327,
      expectedBonds: 337,
      expectedChains: 1,
      expectedResidues: 46
    },
    {
      path: 'scratch/4HHB.pdb',
      name: '4HHB.pdb (Human Deoxyhemoglobin)',
      expectedAtoms: 4779,
      expectedBonds: 4427,
      expectedChains: 4,
      expectedResidues: 801
    },
    {
      path: 'scratch/1UBQ.pdb',
      name: '1UBQ.pdb (Ubiquitin)',
      expectedAtoms: 660,
      expectedBonds: 608,
      expectedChains: 1,
      expectedResidues: 134
    }
  ];

  for (const item of goldenFixtures) {
    const fullPath = path.resolve(process.cwd(), item.path);
    if (!fs.existsSync(fullPath)) {
      console.warn(`  [SKIP] Missing fixture: ${item.path}`);
      continue;
    }

    test(`3.x Document Benchmark: ${item.name}`, () => {
      const content = fs.readFileSync(fullPath, 'utf8');
      const proc = new MolProcessor(content, 'pdb');
      proc.assignBonds(1.15);

      const doc = proc.getCanonicalDocument({ name: item.name });

      // Verify Document level properties
      assert.strictEqual(doc.object_ids.length, 1);
      const objId = doc.object_ids[0];
      const obj = doc.objects.get(objId)!;
      assert(obj, `Object ${objId} must exist`);

      const mol = doc.molecules.get(obj.molecule_ref)!;
      assert(mol, `Molecule ${obj.molecule_ref} must exist`);

      const state = doc.states.get(obj.active_state_id)!;
      assert(state, `Active state ${obj.active_state_id} must exist`);

      // Verify coordinate tensor alignment
      assert.strictEqual(state.coordinates.length, item.expectedAtoms);
      for (let i = 0; i < mol.atoms.length; i++) {
        assert.strictEqual(state.coordinates[i].x, mol.atoms[i].x);
        assert.strictEqual(state.coordinates[i].y, mol.atoms[i].y);
        assert.strictEqual(state.coordinates[i].z, mol.atoms[i].z);
      }

      // Verify Molecule counts
      assert.strictEqual(mol.atoms.length, item.expectedAtoms);
      assert.strictEqual(mol.topology.bonds.length, item.expectedBonds);
      assert.strictEqual(mol.chains.length, item.expectedChains);
      assert.strictEqual(mol.residues.length, item.expectedResidues);

      console.log(`     [Document Stats] Objects: ${doc.objects.size} | Molecules: ${doc.molecules.size} | States: ${doc.states.size} | Atoms: ${mol.atoms.length} | Bonds: ${mol.topology.bonds.length}`);
    });
  }

  console.log("\n================================================================================");
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} Passed (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log("================================================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runCanonicalDocumentTestSuite();
