import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { MolProcessor } from '../src/lib/MolProcessor';
import { SelectionParser } from '../src/lib/SelectionParser';
import { CanonicalAtom } from '../src/types/domain';
import {
  toCanonicalAtom,
  toCanonicalAtomSet,
  validateCanonicalAtom,
  validateCanonicalAtomSet,
  normalizeElementSymbol,
  normalizeAtomName,
  getAtomicNumber,
  CoordinateSanityError,
  CanonicalIdentityError
} from '../src/domain/AtomAdapter';

function runCanonicalAtomTestSuite() {
  console.log("================================================================================");
  console.log("             TASK P1.1: CANONICAL ATOM MODEL & ADAPTER TEST SUITE               ");
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

  // --- SUITE 1: CANONICAL ATOM ADAPTER UNIT TESTS ---
  console.log("--- 1. Canonical Atom Conversion & Invariant Validation ---");

  test("1.1 Deterministic conversion & 1-based sequential ID assignment", () => {
    const rawAtoms = [
      { serial: 105, name: ' CA ', resName: 'ALA', chainID: 'A', resSeq: 10, x: 1.234, y: 2.345, z: 3.456, elem: 'C', bFactor: 20.5, occupancy: 1.0, isHetero: false, altLoc: 'A' },
      { serial: 106, name: ' N  ', resName: 'ALA', chainID: 'A', resSeq: 10, x: 4.567, y: 5.678, z: 6.789, elem: 'N', bFactor: 21.0, occupancy: 0.9, isHetero: false, altLoc: ' ' }
    ];

    const canonical1 = toCanonicalAtomSet(rawAtoms, { moleculeRef: 'mol-1' });
    const canonical2 = toCanonicalAtomSet(rawAtoms, { moleculeRef: 'mol-1' });

    assert.strictEqual(canonical1.length, 2);
    assert.strictEqual(canonical1[0].canonical_id, 1);
    assert.strictEqual(canonical1[1].canonical_id, 2);
    assert.strictEqual(canonical1[0].source_serial, 105);
    assert.strictEqual(canonical1[1].source_serial, 106);
    assert.strictEqual(canonical1[0].element, 'C');
    assert.strictEqual(canonical1[0].atomic_number, 6);
    assert.strictEqual(canonical1[1].element, 'N');
    assert.strictEqual(canonical1[1].atomic_number, 7);
    assert.strictEqual(canonical1[0].normalized_name, 'CA');
    assert.strictEqual(canonical1[1].normalized_name, 'N');
    assert.strictEqual(canonical1[0].molecule_ref, 'mol-1');

    // Deep equality across consecutive runs (determinism)
    assert.deepStrictEqual(canonical1, canonical2);
  });

  test("1.2 Coordinate fidelity in Float64 Ångströms", () => {
    const rawAtom = { serial: 1, name: 'CA', resName: 'GLY', chainID: 'A', resSeq: 1, x: -12.345678, y: 0.000001, z: 987.654321, elem: 'C' };
    const ca = toCanonicalAtom(rawAtom, 0);

    assert.strictEqual(ca.x, -12.345678);
    assert.strictEqual(ca.y, 0.000001);
    assert.strictEqual(ca.z, 987.654321);
  });

  test("1.3 Rejection of non-finite coordinates (NaN, +Inf, -Inf)", () => {
    const nanAtom = { serial: 1, name: 'CA', resName: 'GLY', chainID: 'A', resSeq: 1, x: NaN, y: 1.0, z: 2.0, elem: 'C' };
    assert.throws(() => toCanonicalAtom(nanAtom, 0), CoordinateSanityError);

    const infAtom = { serial: 1, name: 'CA', resName: 'GLY', chainID: 'A', resSeq: 1, x: Infinity, y: 1.0, z: 2.0, elem: 'C' };
    assert.throws(() => toCanonicalAtom(infAtom, 0), CoordinateSanityError);
  });

  test("1.4 Detection and rejection of duplicate canonical IDs", () => {
    const duplicateList: CanonicalAtom[] = [
      {
        canonical_id: 1, source_serial: 1, chain_ref: 'A', residue_ref: 1, residue_name: 'ALA',
        element: 'C', atomic_number: 6, name: 'CA', normalized_name: 'CA', is_hetero: false,
        x: 0, y: 0, z: 0, occupancy: 1, b_factor: 20, alt_loc: ' ', formal_charge: 0, modeled_hydrogen: false
      },
      {
        canonical_id: 1, source_serial: 2, chain_ref: 'A', residue_ref: 1, residue_name: 'ALA',
        element: 'N', atomic_number: 7, name: 'N', normalized_name: 'N', is_hetero: false,
        x: 1, y: 1, z: 1, occupancy: 1, b_factor: 20, alt_loc: ' ', formal_charge: 0, modeled_hydrogen: false
      }
    ];

    assert.throws(() => validateCanonicalAtomSet(duplicateList), CanonicalIdentityError);
  });

  test("1.5 Element symbol normalization and atomic number mapping", () => {
    assert.strictEqual(normalizeElementSymbol('c'), 'C');
    assert.strictEqual(normalizeElementSymbol('Fe'), 'FE');
    assert.strictEqual(normalizeElementSymbol('ZN'), 'ZN');
    assert.strictEqual(normalizeElementSymbol('', 'CA'), 'CA');
    assert.strictEqual(getAtomicNumber('FE'), 26);
    assert.strictEqual(getAtomicNumber('H'), 1);
    assert.strictEqual(getAtomicNumber('D'), 1);
  });

  // --- SUITE 2: MOLPROCESSOR INTEGRATION & CACHING ---
  console.log("\n--- 2. MolProcessor Integration & Cache Invalidation ---");

  test("2.1 MolProcessor.getCanonicalAtoms() produces valid CanonicalAtoms", () => {
    const fixturePdb = `
ATOM      1  N   ALA A   1      10.000  10.000  10.000  1.00 20.00           N  
ATOM      2  CA  ALA A   1      11.450  10.000  10.000  1.00 20.00           C  
HETATM    3  C1  LIG A 100      20.000  20.000  20.000  1.00 25.00           C  
END
`;
    const proc = new MolProcessor(fixturePdb.trim(), 'pdb');
    const canonical = proc.getCanonicalAtoms('test-mol-1');

    assert.strictEqual(canonical.length, 3);
    assert.strictEqual(canonical[0].canonical_id, 1);
    assert.strictEqual(canonical[0].name, ' N  ');
    assert.strictEqual(canonical[0].normalized_name, 'N');
    assert.strictEqual(canonical[0].is_hetero, false);
    assert.strictEqual(canonical[2].is_hetero, true);
    assert.strictEqual(canonical[2].residue_name, 'LIG');
    assert.strictEqual(canonical[2].canonical_id, 3);
  });

  test("2.2 Cache consistency: returns same cached instance until modified", () => {
    const fixturePdb = `ATOM      1  CA  ALA A   1      11.450  10.000  10.000  1.00 20.00           C  \nEND`;
    const proc = new MolProcessor(fixturePdb, 'pdb');

    const firstCall = proc.getCanonicalAtoms();
    const secondCall = proc.getCanonicalAtoms();
    assert.strictEqual(firstCall, secondCall, "Cache should return identical array reference");

    // Modify proc.atoms (e.g. adding an atom)
    proc.atoms = [...proc.atoms, { ...proc.atoms[0], serial: 2, name: 'CB' }];
    const thirdCall = proc.getCanonicalAtoms();
    assert.notStrictEqual(firstCall, thirdCall, "Cache should automatically invalidate when atoms array changes");
    assert.strictEqual(thirdCall.length, 2);
    assert.strictEqual(thirdCall[1].canonical_id, 2);
  });

  // --- SUITE 3: GOLDEN FIXTURE EXACT COUNTS & BENCHMARKS ---
  console.log("\n--- 3. Golden Fixture Exact Canonical Benchmarks ---");

  const goldenFixtures = [
    {
      path: 'fixtures/03_protein_with_ligand.pdb',
      name: '03_protein_with_ligand.pdb',
      expectedAll: 20,
      expectedPolymer: 16,
      expectedOrganic: 4,
      expectedCA: 3,
      expectedSolvent: 0,
      expectedMetals: 0
    },
    {
      path: '1BNA.pdb',
      name: '1BNA.pdb (Root Synthetic B-DNA)',
      expectedAll: 566,
      expectedPolymer: 486,
      expectedOrganic: 0,
      expectedCA: 0,
      expectedSolvent: 80,
      expectedMetals: 0
    },
    {
      path: '1HVR.pdb',
      name: '1HVR.pdb (Root HIV-1 Protease + XK263)',
      expectedAll: 1890,
      expectedPolymer: 1826,
      expectedOrganic: 64,
      expectedCA: 198,
      expectedSolvent: 0,
      expectedMetals: 0
    },
    {
      path: 'scratch/1CRN.pdb',
      name: '1CRN.pdb (Crambin)',
      expectedAll: 327,
      expectedPolymer: 327,
      expectedOrganic: 0,
      expectedCA: 46,
      expectedSolvent: 0,
      expectedMetals: 0
    },
    {
      path: 'scratch/4HHB.pdb',
      name: '4HHB.pdb (Human Deoxyhemoglobin)',
      expectedAll: 4779,
      expectedPolymer: 4384,
      expectedOrganic: 172,
      expectedCA: 574,
      expectedSolvent: 221,
      expectedMetals: 4
    },
    {
      path: 'scratch/1UBQ.pdb',
      name: '1UBQ.pdb (Ubiquitin)',
      expectedAll: 660,
      expectedPolymer: 602,
      expectedOrganic: 0,
      expectedCA: 76,
      expectedSolvent: 58,
      expectedMetals: 0
    }
  ];

  for (const item of goldenFixtures) {
    const fullPath = path.resolve(process.cwd(), item.path);
    if (!fs.existsSync(fullPath)) {
      console.warn(`  [SKIP] Missing fixture: ${item.path}`);
      continue;
    }

    test(`3.x Benchmark Structure: ${item.name}`, () => {
      const content = fs.readFileSync(fullPath, 'utf8');
      const proc = new MolProcessor(content, 'pdb');
      const canonicalAtoms = proc.getCanonicalAtoms(item.name);

      // 1. Atom count equality between parser and canonical model
      assert.strictEqual(proc.atoms.length, item.expectedAll, `Parser count mismatch for ${item.name}`);
      assert.strictEqual(canonicalAtoms.length, item.expectedAll, `Canonical count mismatch for ${item.name}`);

      // 2. Canonical IDs strictly 1..N and unique
      for (let i = 0; i < canonicalAtoms.length; i++) {
        assert.strictEqual(canonicalAtoms[i].canonical_id, i + 1, `Canonical ID must be strictly 1-indexed sequential at position ${i}`);
        assert(Number.isFinite(canonicalAtoms[i].x), `Atom ${i} x coordinate non-finite`);
        assert(Number.isFinite(canonicalAtoms[i].y), `Atom ${i} y coordinate non-finite`);
        assert(Number.isFinite(canonicalAtoms[i].z), `Atom ${i} z coordinate non-finite`);
      }

      // 3. Selection Parser evaluation directly against canonical atoms
      const canonicalParser = SelectionParser.fromCanonicalAtoms(canonicalAtoms);
      const selAll = canonicalParser.parse('all');
      const selNone = canonicalParser.parse('none');
      const selCA = canonicalParser.parse('name CA');
      const selPolymer = canonicalParser.parse('polymer');
      const selOrganic = canonicalParser.parse('organic');
      const selSolvent = canonicalParser.parse('solvent');
      const selMetals = canonicalParser.parse('metals');

      assert.strictEqual(selAll.size, item.expectedAll, `Selection 'all' count mismatch`);
      assert.strictEqual(selNone.size, 0, `Selection 'none' must return 0 atoms`);
      assert.strictEqual(selCA.size, item.expectedCA, `Selection 'name CA' count mismatch`);
      assert.strictEqual(selPolymer.size, item.expectedPolymer, `Selection 'polymer' count mismatch`);
      assert.strictEqual(selOrganic.size, item.expectedOrganic, `Selection 'organic' count mismatch`);
      assert.strictEqual(selSolvent.size, item.expectedSolvent, `Selection 'solvent' count mismatch`);
      assert.strictEqual(selMetals.size, item.expectedMetals, `Selection 'metals' count mismatch`);
    });
  }

  console.log("\n================================================================================");
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} Passed (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log("================================================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runCanonicalAtomTestSuite();
