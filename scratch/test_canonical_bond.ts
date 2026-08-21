import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { MolProcessor } from '../src/lib/MolProcessor';
import { CanonicalAtom, CanonicalBond } from '../src/types/domain';
import {
  toCanonicalBond,
  toCanonicalBondSet,
  buildCanonicalTopology,
  validateCanonicalBond,
  validateCanonicalBondSet,
  createBondKey,
  BondEndpointError,
  SelfBondError,
  DuplicateBondError,
  BondValenceError,
  ConformerDisjointnessError
} from '../src/domain/BondAdapter';

function runCanonicalBondTestSuite() {
  console.log("================================================================================");
  console.log("             TASK P1.2: CANONICAL BOND & TOPOLOGY TEST SUITE                    ");
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

  // --- SUITE 1: CANONICAL BOND UNIT TESTS ---
  console.log("--- 1. Canonical Bond Conversion, Normalization & Invariants ---");

  test("1.1 Endpoint normalization (atom_a < atom_b) and unique ID generation", () => {
    const bond1 = toCanonicalBond(10, 5, { order: 1, source: 'file' });
    assert.strictEqual(bond1.atom_a, 5);
    assert.strictEqual(bond1.atom_b, 10);
    assert.strictEqual(bond1.bond_id, 'b-5-10');
    assert.strictEqual(bond1.order, 1);
    assert.strictEqual(bond1.is_aromatic, false);
    assert.strictEqual(bond1.source, 'file');
    assert.strictEqual(bond1.is_inferred, false);
  });

  test("1.2 Aromatic bond order (1.5) and explicit aromaticity semantics", () => {
    const bond = toCanonicalBond(1, 2, { order: 1.5 });
    assert.strictEqual(bond.order, 1.5);
    assert.strictEqual(bond.is_aromatic, true);

    const kekuleAromatic = toCanonicalBond(1, 2, { order: 2, is_aromatic: true });
    assert.strictEqual(kekuleAromatic.order, 2);
    assert.strictEqual(kekuleAromatic.is_aromatic, true);
  });

  test("1.3 Rejection of self-bonding (atom_a == atom_b)", () => {
    assert.throws(() => toCanonicalBond(7, 7), SelfBondError);
  });

  test("1.4 Rejection of unsupported bond orders", () => {
    assert.throws(() => toCanonicalBond(1, 2, { order: 4 as any }), BondValenceError);
    assert.throws(() => toCanonicalBond(1, 2, { order: 0 as any }), BondValenceError);
  });

  test("1.5 Rejection of missing / non-existent endpoints", () => {
    const validIds = new Set([1, 2, 3]);
    const validBond = toCanonicalBond(1, 2);
    validateCanonicalBond(validBond, validIds);

    const invalidBond = toCanonicalBond(1, 99);
    assert.throws(() => validateCanonicalBond(invalidBond, validIds), BondEndpointError);
  });

  test("1.6 Rejection of duplicate unordered edges", () => {
    const validIds = new Set([1, 2, 3]);
    const duplicateSet: CanonicalBond[] = [
      toCanonicalBond(1, 2),
      toCanonicalBond(2, 1) // normalized to 1:2
    ];
    assert.throws(() => validateCanonicalBondSet(duplicateSet, validIds), DuplicateBondError);
  });

  test("1.7 Enforcement of altLoc conformer disjointness", () => {
    const validIds = new Set([1, 2, 3]);
    const atomMap = new Map<number, CanonicalAtom>([
      [1, { canonical_id: 1, alt_loc: 'A' } as CanonicalAtom],
      [2, { canonical_id: 2, alt_loc: 'B' } as CanonicalAtom],
      [3, { canonical_id: 3, alt_loc: ' ' } as CanonicalAtom]
    ]);

    // Bond between altLoc 'A' and altLoc 'B' MUST fail
    const crossConformerBond = toCanonicalBond(1, 2);
    assert.throws(
      () => validateCanonicalBond(crossConformerBond, validIds, atomMap),
      ConformerDisjointnessError
    );

    // Bond between altLoc 'A' and shared ' ' MUST succeed
    const sharedBond = toCanonicalBond(1, 3);
    validateCanonicalBond(sharedBond, validIds, atomMap);
  });

  // --- SUITE 2: CANONICAL TOPOLOGY GRAPH BUILDER ---
  console.log("\n--- 2. Canonical Topology Graph & Adjacency Map ---");

  test("2.1 buildCanonicalTopology produces consistent adjacency and fast lookup", () => {
    const mockAtoms: CanonicalAtom[] = [
      { canonical_id: 1, alt_loc: ' ' } as CanonicalAtom,
      { canonical_id: 2, alt_loc: ' ' } as CanonicalAtom,
      { canonical_id: 3, alt_loc: ' ' } as CanonicalAtom
    ];

    const mockBonds: CanonicalBond[] = [
      toCanonicalBond(1, 2),
      toCanonicalBond(2, 3)
    ];

    const topology = buildCanonicalTopology(mockAtoms, mockBonds);
    assert.strictEqual(topology.bonds.length, 2);
    assert.deepStrictEqual(topology.adjacency_map.get(1), [2]);
    assert.deepStrictEqual(topology.adjacency_map.get(2), [1, 3]);
    assert.deepStrictEqual(topology.adjacency_map.get(3), [2]);

    assert(topology.bond_map.has(createBondKey(1, 2)));
    assert(topology.bond_map.has(createBondKey(2, 3)));
    assert(!topology.bond_map.has(createBondKey(1, 3)));
  });

  // --- SUITE 3: MOLPROCESSOR INTEGRATION & CACHING ---
  console.log("\n--- 3. MolProcessor Canonical Bond Accessors & Caching ---");

  test("3.1 MolProcessor.getCanonicalBonds() and getCanonicalTopology() return valid structures", () => {
    const pdb = `
ATOM      1  N   ALA A   1      10.000  10.000  10.000  1.00 20.00           N  
ATOM      2  CA  ALA A   1      11.450  10.000  10.000  1.00 20.00           C  
CONECT    1    2
END
`;
    const proc = new MolProcessor(pdb.trim(), 'pdb');
    const canonicalBonds = proc.getCanonicalBonds('test-mol');
    const topology = proc.getCanonicalTopology('test-mol');

    assert.strictEqual(canonicalBonds.length, 1);
    assert.strictEqual(canonicalBonds[0].atom_a, 1);
    assert.strictEqual(canonicalBonds[0].atom_b, 2);
    assert.strictEqual(topology.bonds.length, 1);
    assert.deepStrictEqual(topology.adjacency_map.get(1), [2]);
    assert.deepStrictEqual(topology.adjacency_map.get(2), [1]);
  });

  test("3.2 Cache invalidation on processor mutation", () => {
    const pdb = `ATOM      1  N   ALA A   1      10.000  10.000  10.000  1.00 20.00           N  \nATOM      2  CA  ALA A   1      11.450  10.000  10.000  1.00 20.00           C  \nCONECT    1    2\nEND`;
    const proc = new MolProcessor(pdb, 'pdb');

    const firstBonds = proc.getCanonicalBonds();
    const secondBonds = proc.getCanonicalBonds();
    assert.strictEqual(firstBonds, secondBonds, "Should return cached reference");

    // Mutate atoms array
    proc.atoms = [...proc.atoms];
    const thirdBonds = proc.getCanonicalBonds();
    assert.notStrictEqual(firstBonds, thirdBonds, "Cache should automatically invalidate when atoms array changes");
  });

  // --- SUITE 4: GOLDEN FIXTURE TOPOLOGY BENCHMARKS ---
  console.log("\n--- 4. Golden Fixture Exact Topology & Bond Benchmarks ---");

  const goldenFixtures = [
    { path: 'fixtures/03_protein_with_ligand.pdb', name: '03_protein_with_ligand.pdb' },
    { path: '1BNA.pdb', name: '1BNA.pdb (Root Synthetic B-DNA)' },
    { path: '1HVR.pdb', name: '1HVR.pdb (Root HIV-1 Protease + XK263)' },
    { path: 'scratch/1CRN.pdb', name: '1CRN.pdb (Crambin)' },
    { path: 'scratch/4HHB.pdb', name: '4HHB.pdb (Human Deoxyhemoglobin)' },
    { path: 'scratch/1UBQ.pdb', name: '1UBQ.pdb (Ubiquitin)' }
  ];

  for (const item of goldenFixtures) {
    const fullPath = path.resolve(process.cwd(), item.path);
    if (!fs.existsSync(fullPath)) {
      console.warn(`  [SKIP] Missing fixture: ${item.path}`);
      continue;
    }

    test(`4.x Benchmark Topology: ${item.name}`, () => {
      const content = fs.readFileSync(fullPath, 'utf8');
      const proc = new MolProcessor(content, 'pdb');
      proc.assignBonds(1.15); // Assign standard covalent distance bonds

      const canonicalAtoms = proc.getCanonicalAtoms(item.name);
      const canonicalBonds = proc.getCanonicalBonds(item.name);
      const topology = proc.getCanonicalTopology(item.name);

      assert(canonicalBonds.length > 0, `Structure ${item.name} must contain covalent bonds`);

      // 1. All bond endpoints must strictly be valid 1-indexed CanonicalAtom IDs
      const validAtomIds = new Set(canonicalAtoms.map(a => a.canonical_id));
      for (const b of canonicalBonds) {
        assert(validAtomIds.has(b.atom_a), `Bond endpoint atom_a ${b.atom_a} must exist in canonical atoms`);
        assert(validAtomIds.has(b.atom_b), `Bond endpoint atom_b ${b.atom_b} must exist in canonical atoms`);
        assert(b.atom_a < b.atom_b, `Bond ${b.bond_id} must have atom_a < atom_b`);
        assert([1, 1.5, 2, 3].includes(b.order), `Bond ${b.bond_id} order must be 1, 1.5, 2, or 3`);
      }

      // 2. Adjacency map neighbor symmetry check
      for (const [id, neighbors] of topology.adjacency_map.entries()) {
        for (const n of neighbors) {
          const backNeighbors = topology.adjacency_map.get(n);
          assert(backNeighbors && backNeighbors.includes(id), `Symmetric graph edge violation between ${id} and ${n}`);
        }
      }

      // 3. Exact connectivity preservation: sum of neighbor degrees == 2 * total bonds
      let totalDegree = 0;
      for (const neighbors of topology.adjacency_map.values()) {
        totalDegree += neighbors.length;
      }
      assert.strictEqual(totalDegree, 2 * canonicalBonds.length, `Handshaking lemma check: total degree must equal 2 * bonds`);

      console.log(`     [Topology Stats] Atoms: ${canonicalAtoms.length} | Unique Covalent Bonds: ${canonicalBonds.length}`);
    });
  }

  console.log("\n================================================================================");
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} Passed (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log("================================================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runCanonicalBondTestSuite();
