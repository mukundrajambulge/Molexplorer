import { SelectionParser, Atom } from './src/lib/SelectionParser';

function runTests() {
  console.log("=== Stage 3 Advanced Biophysical Calculations Regression Tests ===\n");
  
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

  // 1. Setup exact mock coordinates with known geometric outcomes
  // A = (1, 0, 0)
  // B = (0, 0, 0)
  // C = (0, 1, 0)
  // D = (0, 1, 1)
  // We place a Nitrogen at B, CA at C, C at D, and a previous residue C at A.
  // This lets us test Backbone Torsion math inside Ramachandran commands.
  const mockAtoms: Atom[] = [
    { serial: 1, elem: 'C', name: 'C', resName: 'ALA', resSeq: 9, chainID: 'A', bonds: [2], x: 1.0, y: 0.0, z: 0.0, occupancy: 1.0, bFactor: 20.0, isHetero: false },
    { serial: 2, elem: 'N', name: 'N', resName: 'ALA', resSeq: 10, chainID: 'A', bonds: [1, 3], x: 0.0, y: 0.0, z: 0.0, occupancy: 1.0, bFactor: 30.0, isHetero: false },
    { serial: 3, elem: 'C', name: 'CA', resName: 'ALA', resSeq: 10, chainID: 'A', bonds: [2, 4], x: 0.0, y: 1.0, z: 0.0, occupancy: 0.9, bFactor: 40.0, isHetero: false },
    { serial: 4, elem: 'C', name: 'C', resName: 'ALA', resSeq: 10, chainID: 'A', bonds: [3, 5], x: 0.0, y: 1.0, z: 1.0, occupancy: 1.0, bFactor: 35.0, isHetero: false },
    { serial: 5, elem: 'N', name: 'N', resName: 'GLY', resSeq: 11, chainID: 'A', bonds: [4], x: 0.5, y: 2.0, z: 1.0, occupancy: 1.0, bFactor: 25.0, isHetero: false }
  ];

  const parser = new SelectionParser(mockAtoms);

  // 2. Test Ramachandran Command
  {
    const res = parser.evaluateCommand("ramachandran resi 10");
    assert(res.textOutput?.includes("evaluated: 1"), "Evaluated correct count of sequential residues", res.textOutput);
    assert(res.ramachandranReport?.length === 1 && Math.abs(res.ramachandranReport[0].phi - 90.0) < 1e-4, "Evaluates backbone torsion angle phi accurately", JSON.stringify(res.ramachandranReport));
  }

  // 3. Test Molecular Dipole calculations
  // Atoms: 1 CA (charge 0.07), 1 N (charge -0.47)
  // Let's run dipole command
  {
    const res = parser.evaluateCommand("dipole all");
    assert(res.textOutput?.includes("Ionic Charge") && res.textOutput?.includes("Debye"), "Dipole command executes successfully", res.textOutput);
    assert(res.dipoleResult !== undefined && res.dipoleResult.magnitude > 0, "Computes non-zero dipole magnitude", JSON.stringify(res.dipoleResult));
  }

  // 4. Test H-Bond energy calculation (DSSP)
  // We place a donor N at (0,0,0) and acceptor O at (2.8,0,0) with standard peptide carbonyl C at (2.8,1.2,0)
  // Hydrogen is placed at (1.0,0,0)
  const hbondAtoms: Atom[] = [
    { serial: 1, elem: 'N', name: 'N', resName: 'ALA', resSeq: 2, chainID: 'A', bonds: [2], x: 0.0, y: 0.0, z: 0.0, occupancy: 1.0, bFactor: 20.0, isHetero: false },
    { serial: 2, elem: 'H', name: 'H', resName: 'ALA', resSeq: 2, chainID: 'A', bonds: [1], x: 1.05, y: 0.0, z: 0.0, occupancy: 1.0, bFactor: 20.0, isHetero: false },
    { serial: 3, elem: 'O', name: 'O', resName: 'GLY', resSeq: 6, chainID: 'A', bonds: [4], x: 2.85, y: 0.0, z: 0.0, occupancy: 1.0, bFactor: 20.0, isHetero: false },
    { serial: 4, elem: 'C', name: 'C', resName: 'GLY', resSeq: 6, chainID: 'A', bonds: [3], x: 2.85, y: 1.22, z: 0.0, occupancy: 1.0, bFactor: 20.0, isHetero: false }
  ];

  const parserHb = new SelectionParser(hbondAtoms);
  {
    const res = parserHb.evaluateCommand("hbond_energy all");
    assert(res.textOutput?.includes("E="), "DSSP H-Bond energy calculated successfully", res.textOutput);
    assert(res.addHBonds?.length === 1 && res.addHBonds[0].energy < -0.5, "Detects stable H-bond matching DSSP energy thresholds", JSON.stringify(res.addHBonds));
  }

  console.log(`\nVerification Finished: ${passes} passed, ${failures} failed.`);
  if (failures > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
