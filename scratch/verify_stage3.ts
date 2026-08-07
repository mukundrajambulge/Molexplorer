import { SelectionParser, Atom } from './src/lib/SelectionParser';

function runTests() {
  console.log("=== Stage 3 (Measurement & Label System) Regression Tests ===\n");
  
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
  // A is at (0,0,0)
  // B is at (1.5,0,0) -> distance A-B is 1.5
  // C is at (1.5,1.5,0) -> angle A-B-C is 90 degrees
  // D is at (0,1.5,0) -> dihedral A-B-C-D is flat cis / 0 or 180 degrees depending on vectors
  // Let's configure exact dihedral atoms:
  // A = (1, 0, 0)
  // B = (0, 0, 0)
  // C = (0, 1, 0)
  // D = (0, 1, 1)
  // This forms three perpendicular bonds:
  // B-A vector is along +X.
  // C-B vector is along +Y.
  // D-C vector is along +Z.
  // The plane normals are n1 = BA x CB = (+X) x (+Y) = +Z.
  // n2 = CB x DC = (+Y) x (+Z) = +X.
  // The angle between +Z and +X is 90 degrees.
  const mockAtoms: Atom[] = [
    { serial: 1, elem: 'N', name: 'N', resName: 'ALA', resSeq: 1, chainID: 'A', bonds: [2], x: 1.0, y: 0.0, z: 0.0, occupancy: 1.0, bFactor: 20.0, isHetero: false },
    { serial: 2, elem: 'C', name: 'CA', resName: 'ALA', resSeq: 1, chainID: 'A', bonds: [1, 3], x: 0.0, y: 0.0, z: 0.0, occupancy: 1.0, bFactor: 30.0, isHetero: false },
    { serial: 3, elem: 'C', name: 'C', resName: 'ALA', resSeq: 1, chainID: 'A', bonds: [2, 4], x: 0.0, y: 1.0, z: 0.0, occupancy: 0.9, bFactor: 40.0, isHetero: false },
    { serial: 4, elem: 'O', name: 'O', resName: 'ALA', resSeq: 1, chainID: 'A', bonds: [3], x: 0.0, y: 1.0, z: 1.0, occupancy: 1.0, bFactor: 65.0, isHetero: false }
  ];

  const parser = new SelectionParser(mockAtoms);

  // 2. Test get_distance CLI execution
  {
    const res = parser.evaluateCommand("distance id 1, id 2");
    assert(res.textOutput?.includes("1.000 Å"), "Distance calculation matches exact geometry", res.textOutput);
    assert(res.addMeasurement?.type === 'distance' && res.addMeasurement.value === 1.0, "Returns correct addMeasurement object for distance", JSON.stringify(res.addMeasurement));
  }

  // 3. Test get_angle CLI execution (A-B-C at CA vertex is 90 degrees)
  {
    const res = parser.evaluateCommand("angle id 1, id 2, id 3");
    assert(res.textOutput?.includes("90.0 degrees"), "Angle calculation matches exact geometry", res.textOutput);
    assert(res.addMeasurement?.type === 'angle' && Math.abs(res.addMeasurement.value - 90.0) < 1e-4, "Returns correct addMeasurement object for angle", JSON.stringify(res.addMeasurement));
  }

  // 4. Test get_dihedral CLI execution (90 degrees torsion)
  {
    const res = parser.evaluateCommand("dihedral id 1, id 2, id 3, id 4");
    assert(res.textOutput?.includes("90.0 degrees"), "Dihedral calculation matches exact torsion geometry", res.textOutput);
    assert(res.addMeasurement?.type === 'dihedral' && Math.abs(res.addMeasurement.value - 90.0) < 1e-4, "Returns correct addMeasurement object for dihedral", JSON.stringify(res.addMeasurement));
  }

  // 5. Test label command execution
  {
    const res = parser.evaluateCommand("label id 1, resn+resi");
    assert(res.textOutput?.includes("custom label applied"), "Label command executes correctly", res.textOutput);
    assert(res.addLabels?.length === 1 && res.addLabels[0].text === "ALA1", "Generates correct compile label format", JSON.stringify(res.addLabels));
  }

  // 6. Test unlabel command execution
  {
    const res = parser.evaluateCommand("unlabel id 1");
    assert(res.textOutput?.includes("removed labels"), "Unlabel command executes correctly", res.textOutput);
    assert(res.clearLabels?.includes(1), "Returns correct clearLabels list", JSON.stringify(res.clearLabels));
  }

  console.log(`\nVerification Finished: ${passes} passed, ${failures} failed.`);
  if (failures > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
