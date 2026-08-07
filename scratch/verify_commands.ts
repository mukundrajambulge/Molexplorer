import { SelectionParser, Atom } from './src/lib/SelectionParser';

function runTests() {
  console.log("=== Molexplorer PyMOL Console Commands Verification ===\n");
  
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

  const mockAtoms: Atom[] = [
    // Residue 10 (ALA)
    { serial: 1, elem: 'N', name: 'N', resName: 'ALA', resSeq: 10, chainID: 'A', bonds: [1], x: 0.0, y: 0.0, z: 0.0, occupancy: 1.0, bFactor: 20.0, isHetero: false },
    { serial: 2, elem: 'C', name: 'CA', resName: 'ALA', resSeq: 10, chainID: 'A', bonds: [0, 2], x: 1.4, y: 0.0, z: 0.0, occupancy: 1.0, bFactor: 25.0, isHetero: false },
    { serial: 3, elem: 'C', name: 'C', resName: 'ALA', resSeq: 10, chainID: 'A', bonds: [1, 3], x: 2.1, y: 1.2, z: 0.0, occupancy: 0.9, bFactor: 30.0, isHetero: false },
    // Residue 11 (GLY)
    { serial: 4, elem: 'N', name: 'N', resName: 'GLY', resSeq: 11, chainID: 'A', bonds: [2, 5], x: 3.5, y: 1.2, z: 0.0, occupancy: 1.0, bFactor: 35.0, isHetero: false },
    { serial: 5, elem: 'C', name: 'CA', resName: 'GLY', resSeq: 11, chainID: 'A', bonds: [4], x: 4.2, y: 2.4, z: 0.0, occupancy: 1.0, bFactor: 40.0, isHetero: false }
  ];

  mockAtoms[0].bonds = [1];
  mockAtoms[1].bonds = [0, 2];
  mockAtoms[2].bonds = [1, 3];
  mockAtoms[3].bonds = [2, 4];
  mockAtoms[4].bonds = [3];

  const parser = new SelectionParser(mockAtoms);

  // 1. count_atoms
  {
    const res = parser.evaluateCommand("count_atoms resn ALA");
    assert(res.textOutput?.includes("count_atoms: 3 atoms"), "Command count_atoms matches correct count", res.textOutput);
  }

  // 2. get_names
  {
    const res = parser.evaluateCommand("get_names", [{ name: "sele1", query: "all", atomIds: [1] }], "1abc");
    assert(res.textOutput?.includes("1abc") && res.textOutput?.includes("sele1"), "Command get_names matches correct names", res.textOutput);
  }

  // 3. get_chains
  {
    const res = parser.evaluateCommand("get_chains");
    assert(res.textOutput?.includes("[\"A\"]"), "Command get_chains matches correct unique chains", res.textOutput);
  }

  // 4. get_residues
  {
    const res = parser.evaluateCommand("get_residues resn ALA");
    assert(res.textOutput?.includes("/A/10/ALA"), "Command get_residues matches residue list", res.textOutput);
  }

  // 5. select
  {
    const res = parser.evaluateCommand("select active_site, resn ALA");
    assert(res.saveSelection?.name === "active_site" && res.saveSelection?.query === "resn ALA", "Command select sets up correct saveSelection", JSON.stringify(res.saveSelection));
  }

  // 6. get_distance
  {
    // N (1) to CA (2) distance = 1.4 Å
    const res = parser.evaluateCommand("get_distance id 1, id 2");
    assert(res.textOutput?.includes("1.400 Å"), "Command get_distance computes exact Euclidean distance", res.textOutput);
  }

  // 7. get_angle
  {
    // N (1 at 0,0,0) - CA (2 at 1.4,0,0) - C (3 at 2.1,1.2,0)
    // Vectors relative to CA: vA = (-1.4,0,0), vC = (0.7,1.2,0)
    // dot product = -1.4 * 0.7 = -0.98
    // norm A = 1.4, norm C = sqrt(0.49 + 1.44) = sqrt(1.93) ≈ 1.389
    // dot / (norm A * norm C) = -0.98 / (1.4 * 1.389) = -0.98 / 1.9446 ≈ -0.5039
    // acos(-0.5039) ≈ 120.25 degrees
    const res = parser.evaluateCommand("get_angle id 1, id 2, id 3");
    assert(res.textOutput?.includes("120.3 degrees"), "Command get_angle computes exact bond angle", res.textOutput);
  }

  // 8. get_property
  {
    const res = parser.evaluateCommand("get_property b, resn ALA");
    assert(res.textOutput?.includes("Min: 20.00") && res.textOutput?.includes("Max: 30.00") && res.textOutput?.includes("Avg: 25.00"), "Command get_property b evaluates correct stats", res.textOutput);
  }

  // 9. show / hide / color
  {
    const resShow = parser.evaluateCommand("show cartoon, resn ALA");
    assert(resShow.textOutput?.includes("Representation 'cartoon' shown"), "Command show returns correct message", resShow.textOutput);

    const resColor = parser.evaluateCommand("color red, resn ALA");
    assert(resColor.textOutput?.includes("Color 'red' applied"), "Command color returns correct message", resColor.textOutput);
  }

  console.log(`\nVerification Finished: ${passes} passed, ${failures} failed.`);
  if (failures > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
