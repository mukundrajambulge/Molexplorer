import { SelectionParser, Atom } from './src/lib/SelectionParser';

function runTests() {
  console.log("=== Molexplorer Stage 2 Selection Algebra Verification ===\n");
  
  let passes = 0;
  let failures = 0;

  function assert(condition: boolean, message: string, extraInfo: string = "") {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passes++;
    } else {
      console.log(`[FAIL] ${message} \n  ${extraInfo}\n`);
      failures++;
    }
  }

  // Set up mock atom dataset
  // Chain A: Protein Residue 10 (ALA) and 11 (GLY)
  // Chain B: Ligand Residue 100 (LIG) and Solvent Water (HOH)
  const mockAtoms: Atom[] = [
    // Residue 10 (ALA)
    { serial: 1, elem: 'N', name: 'N', resName: 'ALA', resSeq: 10, chainID: 'A', bonds: [1], x: 0.0, y: 0.0, z: 0.0, occupancy: 1.0, bFactor: 20.0, isHetero: false },
    { serial: 2, elem: 'C', name: 'CA', resName: 'ALA', resSeq: 10, chainID: 'A', bonds: [0, 2], x: 1.4, y: 0.0, z: 0.0, occupancy: 1.0, bFactor: 25.0, isHetero: false },
    { serial: 3, elem: 'C', name: 'C', resName: 'ALA', resSeq: 10, chainID: 'A', bonds: [1, 3], x: 2.1, y: 1.2, z: 0.0, occupancy: 0.9, bFactor: 30.0, isHetero: false },
    // Residue 11 (GLY)
    { serial: 4, elem: 'N', name: 'N', resName: 'GLY', resSeq: 11, chainID: 'A', bonds: [2, 5], x: 3.5, y: 1.2, z: 0.0, occupancy: 1.0, bFactor: 35.0, isHetero: false },
    { serial: 5, elem: 'C', name: 'CA', resName: 'GLY', resSeq: 11, chainID: 'A', bonds: [4], x: 4.2, y: 2.4, z: 0.0, occupancy: 1.0, bFactor: 40.0, isHetero: false },
    
    // Residue 100 (LIG) - Organic ligand
    { serial: 6, elem: 'C', name: 'C1', resName: 'LIG', resSeq: 100, chainID: 'B', bonds: [6], x: 10.0, y: 10.0, z: 10.0, occupancy: 0.5, bFactor: 50.0, isHetero: true },
    { serial: 7, elem: 'O', name: 'O1', resName: 'LIG', resSeq: 100, chainID: 'B', bonds: [5], x: 11.2, y: 10.0, z: 10.0, occupancy: 1.0, bFactor: 45.0, isHetero: true },

    // Water Solvent
    { serial: 8, elem: 'O', name: 'O', resName: 'HOH', resSeq: 200, chainID: 'W', bonds: [], x: 1.4, y: 0.0, z: 3.0, occupancy: 1.0, bFactor: 60.0, isHetero: true },
    
    // Metal Zinc Ion
    { serial: 9, elem: 'ZN', name: 'ZN', resName: 'ZN', resSeq: 300, chainID: 'Z', bonds: [], x: 0.0, y: 3.0, z: 0.0, occupancy: 1.0, bFactor: 15.0, isHetero: true }
  ];

  // Set up double bond mapping for indices (since bonds stores array indices)
  mockAtoms[0].bonds = [1];
  mockAtoms[1].bonds = [0, 2];
  mockAtoms[2].bonds = [1, 3];
  mockAtoms[3].bonds = [2, 4];
  mockAtoms[4].bonds = [3];
  mockAtoms[5].bonds = [6];
  mockAtoms[6].bonds = [5];

  const parser = new SelectionParser(mockAtoms);

  // Helper to run query and check
  function checkQuery(query: string, expectedSerials: number[], message: string) {
    const tokens = parser.tokenize(query);
    const expr = parser.buildExpression(tokens);
    const res = parser.evaluate(expr);
    const resArr = Array.from(res).sort((a,b)=>a-b);
    const expArr = expectedSerials.sort((a,b)=>a-b);
    const isOk = JSON.stringify(resArr) === JSON.stringify(expArr);
    assert(isOk, message, `Query: "${query}" \n  Tokens: ${JSON.stringify(tokens)} \n  Expr: ${JSON.stringify(expr)} \n  Expected: ${JSON.stringify(expArr)} \n  Got: ${JSON.stringify(resArr)}`);
  }

  // Test 1: Wildcards
  checkQuery("resn AL*", [1, 2, 3], "Wildcard resn matching (AL*) works");

  // Test 2: Ranges
  checkQuery("resi 10-11", [1, 2, 3, 4, 5], "Sequence range (resi 10-11) works");

  // Test 3: Relational Comparisons (bFactor, occupancy, id, resi)
  checkQuery("b > 35", [5, 6, 8], "B-factor comparison (b > 35) works");
  checkQuery("q < 1.0", [3, 6], "Occupancy comparison (q < 1.0) works");

  // Test 4: Flags (polymer, organic, solvent, metals, hydrogens)
  checkQuery("polymer", [1, 2, 3, 4, 5], "Flag 'polymer' works");
  checkQuery("organic", [6, 7], "Flag 'organic' matches ligand LIG");
  checkQuery("solvent", [8], "Flag 'solvent' matches water HOH");
  checkQuery("metals", [9], "Flag 'metals' matches ZN ion");

  // Test 5: Proximity Operators (around, within, beyond)
  checkQuery("around 3.1 of resn ALA", [8], "Operator 'around' works (water detected, target excluded)");
  checkQuery("within 3.1 of resn ALA", [1, 2, 3, 8], "Operator 'within' works (water detected, target included)");
  checkQuery("beyond 3.1 of resn ALA", [4, 5, 6, 7, 9], "Operator 'beyond' works");

  // Test 6: Modifiers (byres, bychain, bymolecule, neighbor, extend)
  checkQuery("byres id 6", [6, 7], "Modifier 'byres' works");
  checkQuery("bychain id 6", [6, 7], "Modifier 'bychain' works");
  checkQuery("neighbor id 2", [1, 3], "Modifier 'neighbor' works");
  checkQuery("extend 2 of id 1", [1, 2, 3], "Modifier 'extend 2' works");
  checkQuery("bymolecule id 1", [1, 2, 3, 4, 5], "Modifier 'bymolecule' traces entire connected chain segment");

  console.log(`\nVerification Finished: ${passes} passed, ${failures} failed.`);
  if (failures > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
