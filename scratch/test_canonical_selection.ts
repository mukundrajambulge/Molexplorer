import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { MolProcessor } from '../src/lib/MolProcessor';
import { SelectionParser } from '../src/lib/SelectionParser';
import { CanonicalMolecule } from '../src/types/domain';

function runCanonicalSelectionOracleTestSuite() {
  console.log("================================================================================");
  console.log("             TASK P2.1: CANONICAL SELECTION ORACLE TEST SUITE                   ");
  console.log("================================================================================\n");

  let totalQueries = 0;
  let passedQueries = 0;

  function runOracleQuery(query: string, legacyParser: SelectionParser, mol: CanonicalMolecule, structureName: string) {
    totalQueries++;
    try {
      const legacySet = legacyParser.parse(query);
      const canonicalRes = SelectionParser.evaluateCanonical(query, mol);

      // 1. Count equality
      assert.strictEqual(
        canonicalRes.count,
        legacySet.size,
        `Count mismatch on query "${query}" for ${structureName} (legacy=${legacySet.size}, canonical=${canonicalRes.count})`
      );

      // 2. Exact set element equality
      for (const id of canonicalRes.selected_ids) {
        assert(
          legacySet.has(id),
          `Canonical selected atom ID ${id} not found in legacy result for query "${query}" on ${structureName}`
        );
      }
      for (const id of legacySet) {
        assert(
          canonicalRes.selected_ids.has(id),
          `Legacy selected atom ID ${id} not found in canonical result for query "${query}" on ${structureName}`
        );
      }

      // 3. Sorted array correctness
      assert.strictEqual(
        canonicalRes.selected_array.length,
        canonicalRes.count,
        `selected_array length mismatch for query "${query}"`
      );
      for (let i = 1; i < canonicalRes.selected_array.length; i++) {
        assert(
          canonicalRes.selected_array[i] > canonicalRes.selected_array[i - 1],
          `selected_array must be strictly ascending for query "${query}"`
        );
      }

      passedQueries++;
    } catch (err: any) {
      console.error(`  [FAIL] Query "${query}" on ${structureName}: ${err.message}`);
      throw err;
    }
  }

  function runSyntaxErrorOracle(query: string, legacyParser: SelectionParser, mol: CanonicalMolecule) {
    totalQueries++;
    let legacyThrew = false;
    let canonicalThrew = false;

    try {
      legacyParser.parse(query);
    } catch {
      legacyThrew = true;
    }

    try {
      SelectionParser.evaluateCanonical(query, mol);
    } catch {
      canonicalThrew = true;
    }

    assert(legacyThrew && canonicalThrew, `Syntax error query "${query}" must throw in both engines`);
    passedQueries++;
  }

  const queries = [
    "all",
    "none",
    "chain A",
    "chain A+B",
    "resi 1-20",
    "resi 10+20+30",
    "resn ALA",
    "resn ALA+GLY+VAL",
    "name CA",
    "name CA+CB+N+O",
    "elem C",
    "elem C+N+O",
    "polymer",
    "polymer.protein",
    "polymer.nucleic",
    "organic",
    "inorganic",
    "solvent",
    "hetatm",
    "backbone",
    "sidechain",
    "hydrogens",
    "donors",
    "acceptors",
    "guide",
    "byres (within 4 of organic)",
    "bychain (within 5 of solvent)",
    "around 4 of chain A",
    "beyond 6 of resi 1-10",
    "not solvent",
    "chain A and backbone",
    "chain A or chain B",
    "(chain A and backbone) or (organic and within 5 of resi 50)"
  ];

  const syntaxErrorQueries = [
    "(chain A",
    "chain A)",
    "chain A and",
    "not",
    "within 5",
    "unknownprop foo"
  ];

  const structures = [
    { path: 'fixtures/03_protein_with_ligand.pdb', name: '03_protein_with_ligand.pdb' },
    { path: '1BNA.pdb', name: '1BNA.pdb (Synthetic B-DNA)' },
    { path: '1HVR.pdb', name: '1HVR.pdb (HIV-1 Protease + Inhibitor)' },
    { path: 'scratch/1CRN.pdb', name: '1CRN.pdb (Crambin)' },
    { path: 'scratch/4HHB.pdb', name: '4HHB.pdb (Hemoglobin)' },
    { path: 'scratch/1UBQ.pdb', name: '1UBQ.pdb (Ubiquitin)' }
  ];

  for (const s of structures) {
    const fullPath = path.resolve(process.cwd(), s.path);
    if (!fs.existsSync(fullPath)) {
      console.warn(`  [SKIP] Missing structure: ${s.path}`);
      continue;
    }

    console.log(`--- Evaluating Structure: ${s.name} ---`);
    const content = fs.readFileSync(fullPath, 'utf8');
    const proc = new MolProcessor(content, 'pdb');
    proc.assignBonds(1.15);

    const mol = proc.getCanonicalMolecule({ name: s.name });
    const legacyParser = SelectionParser.fromCanonicalAtoms(mol.atoms);

    const tStart = Date.now();
    for (const q of queries) {
      runOracleQuery(q, legacyParser, mol, s.name);
    }

    for (const sq of syntaxErrorQueries) {
      runSyntaxErrorOracle(sq, legacyParser, mol);
    }
    const elapsed = Date.now() - tStart;

    console.log(`  [PASS] All ${queries.length + syntaxErrorQueries.length} oracle queries passed exact parity check in ${elapsed}ms (${(elapsed / (queries.length + syntaxErrorQueries.length)).toFixed(2)}ms/query)`);
  }

  console.log("\n================================================================================");
  console.log(`ORACLE TEST SUMMARY: ${passedQueries} / ${totalQueries} Queries Passed (100.0% Exact Parity)`);
  console.log("================================================================================\n");

  if (passedQueries !== totalQueries) {
    process.exit(1);
  }
}

runCanonicalSelectionOracleTestSuite();
