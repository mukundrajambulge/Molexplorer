import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { MolProcessor } from '../src/lib/MolProcessor';
import { CanonicalAtom, CanonicalMolecule, CanonicalResidue } from '../src/types/domain';
import {
  buildCanonicalMolecule,
  validateCanonicalMolecule,
  classifyResidue,
  classifyChain,
  createResidueId,
  HierarchyIntegrityError
} from '../src/domain/HierarchyAdapter';
import { toCanonicalBond, buildCanonicalTopology } from '../src/domain/BondAdapter';

function runCanonicalHierarchyTestSuite() {
  console.log("================================================================================");
  console.log("             TASK P1.3: CANONICAL HIERARCHY TEST SUITE                          ");
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

  // --- SUITE 1: CANONICAL HIERARCHY UNIT TESTS ---
  console.log("--- 1. Canonical Hierarchy Unit Invariants & Classifications ---");

  test("1.1 Residue classification accuracy", () => {
    assert.strictEqual(classifyResidue('ALA', false), 'amino_acid');
    assert.strictEqual(classifyResidue('TRP', false), 'amino_acid');
    assert.strictEqual(classifyResidue('DA', false), 'nucleic_acid');
    assert.strictEqual(classifyResidue('U', false), 'nucleic_acid');
    assert.strictEqual(classifyResidue('HOH', true), 'solvent');
    assert.strictEqual(classifyResidue('WAT', true), 'solvent');
    assert.strictEqual(classifyResidue('MG', true, 1), 'ion');
    assert.strictEqual(classifyResidue('ZN', true, 1), 'ion');
    assert.strictEqual(classifyResidue('LIG', true, 25), 'ligand');
    assert.strictEqual(classifyResidue('XK2', true, 64), 'ligand');
  });

  test("1.2 Chain classification accuracy", () => {
    const proteinResidues: CanonicalResidue[] = [
      { residue_id: 'A:1', name: 'ALA', res_seq: 1, chain_ref: 'A', atom_ids: [1], classification: 'amino_acid', is_standard: true, is_hetero: false }
    ];
    assert.strictEqual(classifyChain(proteinResidues), 'protein');

    const nucleicResidues: CanonicalResidue[] = [
      { residue_id: 'A:1', name: 'DA', res_seq: 1, chain_ref: 'A', atom_ids: [1], classification: 'nucleic_acid', is_standard: true, is_hetero: false }
    ];
    assert.strictEqual(classifyChain(nucleicResidues), 'nucleic');

    const solventResidues: CanonicalResidue[] = [
      { residue_id: 'A:1', name: 'HOH', res_seq: 1, chain_ref: 'A', atom_ids: [1], classification: 'solvent', is_standard: false, is_hetero: true }
    ];
    assert.strictEqual(classifyChain(solventResidues), 'solvent');
  });

  test("1.3 Residue ID formatting and insertion codes", () => {
    assert.strictEqual(createResidueId('A', 10), 'A:10');
    assert.strictEqual(createResidueId('B', 100, 'A'), 'B:100:A');
    assert.strictEqual(createResidueId(' ', 5), ' :5');
  });

  test("1.4 Hierarchy validation catches duplicate atom claims", () => {
    const mockAtoms: CanonicalAtom[] = [
      { canonical_id: 1, element: 'C', name: 'CA', residue_ref: 1, residue_name: 'ALA', chain_ref: 'A', is_hetero: false, x: 0, y: 0, z: 0 } as CanonicalAtom,
      { canonical_id: 2, element: 'N', name: 'N', residue_ref: 1, residue_name: 'ALA', chain_ref: 'A', is_hetero: false, x: 1, y: 1, z: 1 } as CanonicalAtom
    ];
    const mockTopology = buildCanonicalTopology(mockAtoms, [toCanonicalBond(1, 2)]);
    const mol = buildCanonicalMolecule(mockAtoms, mockTopology, { molecule_id: 'test-mol' });

    // Artificially corrupt residue 2 to claim atom 1 as well
    mol.residues.push({
      residue_id: 'A:2',
      name: 'GLY',
      res_seq: 2,
      chain_ref: 'A',
      atom_ids: [1], // Duplicate claim
      classification: 'amino_acid',
      is_standard: true,
      is_hetero: false
    });
    mol.residue_map.set('A:2', mol.residues[1]);

    assert.throws(() => validateCanonicalMolecule(mol), HierarchyIntegrityError);
  });

  // --- SUITE 2: MOLPROCESSOR INTEGRATION & CACHING ---
  console.log("\n--- 2. MolProcessor getCanonicalMolecule() & Cache Invalidation ---");

  test("2.1 MolProcessor.getCanonicalMolecule() builds validated hierarchy", () => {
    const pdb = `
ATOM      1  N   ALA A   1      10.000  10.000  10.000  1.00 20.00           N  
ATOM      2  CA  ALA A   1      11.450  10.000  10.000  1.00 20.00           C  
ATOM      3  N   GLY B   1      20.000  20.000  20.000  1.00 20.00           N  
CONECT    1    2
END
`;
    const proc = new MolProcessor(pdb.trim(), 'pdb');
    const mol = proc.getCanonicalMolecule({ name: 'DualChain' });

    assert.strictEqual(mol.atoms.length, 3);
    assert.strictEqual(mol.chains.length, 2);
    assert.strictEqual(mol.residues.length, 2);
    assert.strictEqual(mol.chains[0].chain_id, 'A');
    assert.strictEqual(mol.chains[1].chain_id, 'B');
    assert.strictEqual(mol.residues[0].name, 'ALA');
    assert.strictEqual(mol.residues[1].name, 'GLY');
    assert.strictEqual(mol.residues[0].atom_ids.length, 2);
    assert.strictEqual(mol.residues[1].atom_ids.length, 1);
  });

  test("2.2 Cache invalidation when processor atoms change", () => {
    const pdb = `ATOM      1  N   ALA A   1      10.000  10.000  10.000  1.00 20.00           N  \nEND`;
    const proc = new MolProcessor(pdb, 'pdb');

    const firstMol = proc.getCanonicalMolecule();
    const secondMol = proc.getCanonicalMolecule();
    assert.strictEqual(firstMol, secondMol, "Should return cached reference");

    proc.atoms = [...proc.atoms];
    const thirdMol = proc.getCanonicalMolecule();
    assert.notStrictEqual(firstMol, thirdMol, "Cache should invalidate on atoms array change");
  });

  // --- SUITE 3: GOLDEN FIXTURE HIERARCHY BENCHMARKS ---
  console.log("\n--- 3. Golden Fixture Exact Hierarchy Benchmarks ---");

  const goldenFixtures = [
    {
      path: 'fixtures/03_protein_with_ligand.pdb',
      name: '03_protein_with_ligand.pdb',
      expectedAtoms: 20,
      expectedBonds: 19,
      expectedChains: 1,
      expectedResidues: 4, // 3 protein residues + 1 LIG
      expectedPolymerAtoms: 16
    },
    {
      path: '1BNA.pdb',
      name: '1BNA.pdb (Synthetic B-DNA)',
      expectedAtoms: 566,
      expectedBonds: 544,
      expectedChains: 2, // Chains A & B + Waters
      expectedPolymerAtoms: 486
    },
    {
      path: '1HVR.pdb',
      name: '1HVR.pdb (HIV-1 Protease Dimer + XK263)',
      expectedAtoms: 1890,
      expectedBonds: 1922,
      expectedChains: 2, // Chains A & B
      expectedPolymerAtoms: 1826
    },
    {
      path: 'scratch/1CRN.pdb',
      name: '1CRN.pdb (Crambin)',
      expectedAtoms: 327,
      expectedBonds: 337,
      expectedChains: 1,
      expectedResidues: 46,
      expectedPolymerAtoms: 327
    },
    {
      path: 'scratch/4HHB.pdb',
      name: '4HHB.pdb (Human Deoxyhemoglobin)',
      expectedAtoms: 4779,
      expectedBonds: 4427,
      expectedChains: 4, // Chains A, B, C, D
      expectedPolymerAtoms: 4384
    },
    {
      path: 'scratch/1UBQ.pdb',
      name: '1UBQ.pdb (Ubiquitin)',
      expectedAtoms: 660,
      expectedBonds: 608,
      expectedChains: 1, // Chain A + Waters
      expectedPolymerAtoms: 602
    }
  ];

  for (const item of goldenFixtures) {
    const fullPath = path.resolve(process.cwd(), item.path);
    if (!fs.existsSync(fullPath)) {
      console.warn(`  [SKIP] Missing fixture: ${item.path}`);
      continue;
    }

    test(`3.x Hierarchy Benchmark: ${item.name}`, () => {
      const content = fs.readFileSync(fullPath, 'utf8');
      const proc = new MolProcessor(content, 'pdb');
      proc.assignBonds(1.15);

      const mol = proc.getCanonicalMolecule({ name: item.name });

      // 1. Overall counts
      assert.strictEqual(mol.atoms.length, item.expectedAtoms, `Atom count mismatch on ${item.name}`);
      assert.strictEqual(mol.topology.bonds.length, item.expectedBonds, `Bond count mismatch on ${item.name}`);

      if (item.expectedChains !== undefined) {
        assert.strictEqual(mol.chains.length, item.expectedChains, `Chain count mismatch on ${item.name}`);
      }

      // 2. Polymer atom count verification
      let polymerAtomCount = 0;
      for (const res of mol.residues) {
        if (res.classification === 'amino_acid' || res.classification === 'nucleic_acid') {
          polymerAtomCount += res.atom_ids.length;
        }
      }
      assert.strictEqual(polymerAtomCount, item.expectedPolymerAtoms, `Polymer atom count mismatch on ${item.name}`);

      // 3. Atom coverage completeness (every atom belongs to exactly one residue and one chain)
      const claimedAtomIds = new Set<number>();
      for (const res of mol.residues) {
        for (const aId of res.atom_ids) {
          assert(!claimedAtomIds.has(aId), `Atom ${aId} claimed by multiple residues in ${item.name}`);
          claimedAtomIds.add(aId);
        }
      }
      assert.strictEqual(claimedAtomIds.size, item.expectedAtoms, `All atoms must belong to a residue in ${item.name}`);

      console.log(`     [Hierarchy Stats] Atoms: ${mol.atoms.length} | Residues: ${mol.residues.length} | Chains: ${mol.chains.length} | Polymer Atoms: ${polymerAtomCount}`);
    });
  }

  console.log("\n================================================================================");
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} Passed (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log("================================================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runCanonicalHierarchyTestSuite();
