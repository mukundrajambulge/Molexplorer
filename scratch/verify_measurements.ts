import fs from 'fs';
import path from 'path';
import { useStore, Measurement } from '../src/store/index';

/**
 * Geometric Measurement Verification Suite
 * Validates distance, angle, and dihedral calculations in the measurement wizard.
 * Tests edge cases, state store buffer transitions, real PDB coordinates (1HVR.pdb),
 * and benchmarks execution latency.
 */

interface Point3D {
  x: number;
  y: number;
  z: number;
}

// -------------------------------------------------------------------
// Pure Reference Calculation Functions
// -------------------------------------------------------------------

function calculateDistance(A: Point3D, B: Point3D): number {
  const dx = A.x - B.x;
  const dy = A.y - B.y;
  const dz = A.z - B.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function calculateAngle(A: Point3D, B: Point3D, C: Point3D): number {
  const vA = { x: A.x - B.x, y: A.y - B.y, z: A.z - B.z };
  const vC = { x: C.x - B.x, y: C.y - B.y, z: C.z - B.z };
  const dot = vA.x * vC.x + vA.y * vC.y + vA.z * vC.z;
  const lenA = Math.sqrt(vA.x * vA.x + vA.y * vA.y + vA.z * vA.z);
  const lenC = Math.sqrt(vC.x * vC.x + vC.y * vC.y + vC.z * vC.z);
  if (lenA === 0 || lenC === 0) return 0;
  const cosTheta = Math.max(-1, Math.min(1, dot / (lenA * lenC)));
  return Math.acos(cosTheta) * (180.0 / Math.PI);
}

function calculateDihedral(A: Point3D, B: Point3D, C: Point3D, D: Point3D): number {
  const b1 = { x: B.x - A.x, y: B.y - A.y, z: B.z - A.z };
  const b2 = { x: C.x - B.x, y: C.y - B.y, z: C.z - B.z };
  const b3 = { x: D.x - C.x, y: D.y - C.y, z: D.z - C.z };

  const n1 = {
    x: b1.y * b2.z - b1.z * b2.y,
    y: b1.z * b2.x - b1.x * b2.z,
    z: b1.x * b2.y - b1.y * b2.x
  };
  const n2 = {
    x: b2.y * b3.z - b2.z * b3.y,
    y: b2.z * b3.x - b2.x * b3.z,
    z: b2.x * b3.y - b2.y * b3.x
  };

  const lenB2 = Math.sqrt(b2.x * b2.x + b2.y * b2.y + b2.z * b2.z);
  const m1 = {
    x: n1.y * b2.z - n1.z * b2.y,
    y: n1.z * b2.x - n1.x * b2.z,
    z: n1.x * b2.y - n1.y * b2.x
  };

  const dotN = n1.x * n2.x + n1.y * n2.y + n1.z * n2.z;
  const dotM = lenB2 > 0 ? (m1.x * n2.x + m1.y * n2.y + m1.z * n2.z) / lenB2 : 0;
  const angle = Math.atan2(dotM, dotN) * (180.0 / Math.PI);
  return isNaN(angle) ? 0 : angle;
}

// Helper to check floating point equality
function isCloseTo(val: number, expected: number, tolerance: number = 1e-4): boolean {
  if (isNaN(val)) return false;
  return Math.abs(val - expected) <= tolerance;
}

// PDB Atom parser helper for 1HVR verification
interface PDBAtom {
  serial: number;
  name: string;
  resName: string;
  chainID: string;
  resSeq: number;
  x: number;
  y: number;
  z: number;
}

function parsePDBAtoms(pdbContent: string): PDBAtom[] {
  const atoms: PDBAtom[] = [];
  const lines = pdbContent.split('\n');
  for (const line of lines) {
    if (line.startsWith('ATOM  ') || line.startsWith('HETATM')) {
      const serial = parseInt(line.substring(6, 11).trim(), 10);
      const name = line.substring(12, 16).trim();
      const resName = line.substring(17, 20).trim();
      const chainID = line.substring(21, 22).trim();
      const resSeq = parseInt(line.substring(22, 26).trim(), 10);
      const x = parseFloat(line.substring(30, 38).trim());
      const y = parseFloat(line.substring(38, 46).trim());
      const z = parseFloat(line.substring(46, 54).trim());
      atoms.push({ serial, name, resName, chainID, resSeq, x, y, z });
    }
  }
  return atoms;
}

// -------------------------------------------------------------------
// MAIN TEST RUNNER
// -------------------------------------------------------------------

async function runMeasurementVerification() {
  console.log('========================================================');
  console.log(' GEOMETRIC MEASUREMENT WIZARD VERIFICATION SUITE       ');
  console.log('========================================================\n');

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  [PASS] ${testName}${detail ? ` (${detail})` : ''}`);
    } else {
      console.error(`  [FAIL] ${testName}${detail ? ` (${detail})` : ''}`);
    }
  }

  // -----------------------------------------------------------------
  // 1. ANALYTICAL GEOMETRY ACCURACY TESTS
  // -----------------------------------------------------------------
  console.log('--- 1. Analytical Geometry Calculations Verification ---');

  // Distance Tests
  const d1 = calculateDistance({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 });
  assert(isCloseTo(d1, 5.0), '3D Distance (3-4-5 right triangle leg)', `expected 5.0, got ${d1.toFixed(4)}`);

  const d2 = calculateDistance({ x: 1, y: 2, z: 3 }, { x: 4, y: 6, z: 8 });
  const expectedD2 = Math.sqrt(3*3 + 4*4 + 5*5); // sqrt(50) = 7.0710678
  assert(isCloseTo(d2, expectedD2), '3D Diagonal Distance', `expected ${expectedD2.toFixed(4)}, got ${d2.toFixed(4)}`);

  const dCoincident = calculateDistance({ x: 2.5, y: -1.2, z: 8.4 }, { x: 2.5, y: -1.2, z: 8.4 });
  assert(isCloseTo(dCoincident, 0.0), 'Coincident Points Distance', `expected 0.0, got ${dCoincident}`);

  // Distance Translation Invariance
  const shift = { x: 100.5, y: -200.3, z: 50.1 };
  const dShifted = calculateDistance(
    { x: 1 + shift.x, y: 2 + shift.y, z: 3 + shift.z },
    { x: 4 + shift.x, y: 6 + shift.y, z: 8 + shift.z }
  );
  assert(isCloseTo(dShifted, d2), 'Distance Rigid Translation Invariance', `dShifted = ${dShifted.toFixed(4)}`);

  // Angle Tests
  const a90 = calculateAngle({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
  assert(isCloseTo(a90, 90.0), 'Orthogonal Angle (90.0°)', `expected 90.0°, got ${a90.toFixed(4)}°`);

  const a60 = calculateAngle({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0.5, y: Math.sqrt(3)/2, z: 0 });
  assert(isCloseTo(a60, 60.0), 'Equilateral Triangle Angle (60.0°)', `expected 60.0°, got ${a60.toFixed(4)}°`);

  const a180 = calculateAngle({ x: -5, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0 });
  assert(isCloseTo(a180, 180.0), 'Collinear Opposite Angle (180.0°)', `expected 180.0°, got ${a180.toFixed(4)}°`);

  const a0 = calculateAngle({ x: 3, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0 });
  assert(isCloseTo(a0, 0.0), 'Collinear Same Ray Angle (0.0°)', `expected 0.0°, got ${a0.toFixed(4)}°`);

  const aTetra = calculateAngle({ x: 1, y: 1, z: 1 }, { x: 0, y: 0, z: 0 }, { x: 1, y: -1, z: -1 });
  const expectedTetraAngle = Math.acos(-1/3) * (180 / Math.PI); // 109.47122°
  assert(isCloseTo(aTetra, expectedTetraAngle), 'Ideal Tetrahedral Angle', `expected ${expectedTetraAngle.toFixed(4)}°, got ${aTetra.toFixed(4)}°`);

  // Dihedral Tests
  const dihCis = calculateDihedral({ x: 1, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
  assert(isCloseTo(dihCis, 0.0), 'Planar Cis Dihedral Angle (0.0°)', `expected 0.0°, got ${dihCis.toFixed(4)}°`);

  const dihTrans = calculateDihedral({ x: 1, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  assert(isCloseTo(Math.abs(dihTrans), 180.0), 'Planar Trans Dihedral Angle (180.0°)', `expected 180.0°, got ${dihTrans.toFixed(4)}°`);

  const dihPlus90 = calculateDihedral({ x: 1, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
  assert(isCloseTo(dihPlus90, 90.0), 'Right-handed +90.0° Torsion Angle', `expected 90.0°, got ${dihPlus90.toFixed(4)}°`);

  const dihMinus90 = calculateDihedral({ x: 1, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 });
  assert(isCloseTo(dihMinus90, -90.0), 'Left-handed -90.0° Torsion Angle', `expected -90.0°, got ${dihMinus90.toFixed(4)}°`);

  // Gauche Conformation (+60.0°)
  const dihGauche = calculateDihedral(
    { x: 1, y: 1, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 0, y: Math.cos(Math.PI/3), z: Math.sin(Math.PI/3) }
  );
  assert(isCloseTo(dihGauche, 60.0), 'Gauche +60.0° Torsion Angle', `expected 60.0°, got ${dihGauche.toFixed(4)}°`);

  // Regular Tetrahedron Dihedral Angle (acos(1/3) = 70.52878°)
  // Vertices of regular tetrahedron: (1,1,1), (1,-1,-1), (-1,1,-1), (-1,-1,1)
  const tetA = { x: 1, y: 1, z: 1 };
  const tetB = { x: 1, y: -1, z: -1 };
  const tetC = { x: -1, y: 1, z: -1 };
  const tetD = { x: -1, y: -1, z: 1 };
  const dihTetrahedron = calculateDihedral(tetA, tetB, tetC, tetD);
  const expectedTetraDih = Math.acos(1/3) * (180 / Math.PI); // 70.52878°
  assert(isCloseTo(Math.abs(dihTetrahedron), expectedTetraDih), 'Regular Tetrahedron Face Dihedral', `expected ${expectedTetraDih.toFixed(4)}°, got ${Math.abs(dihTetrahedron).toFixed(4)}°`);

  // -----------------------------------------------------------------
  // 2. MEASUREMENT WIZARD STORE STATE MACHINE SIMULATION
  // -----------------------------------------------------------------
  console.log('\n--- 2. Measurement Wizard Store State Machine Simulation ---');

  const store = useStore.getState();
  store.clearMeasurements();

  // Test 2.1: Distance Mode Buffer & Creation (2 Clicks)
  store.setMeasurementMode('distance');
  assert(useStore.getState().activeMeasurementMode === 'distance', 'Set mode to distance');
  assert(useStore.getState().clickedAtomBuffer.length === 0, 'Buffer initially empty');

  // Click Atom 1
  store.addClickedAtom({ serial: 101, x: 0, y: 0, z: 0 });
  assert(useStore.getState().clickedAtomBuffer.length === 1, 'Distance mode 1st click buffers atom 1');
  assert(useStore.getState().measurements.length === 0, 'No measurement created after 1 click');

  // Click Atom 2
  store.addClickedAtom({ serial: 102, x: 3, y: 4, z: 0 });
  const measurementsAfterDist = useStore.getState().measurements;
  assert(useStore.getState().clickedAtomBuffer.length === 0, 'Distance mode 2nd click flushes buffer');
  assert(measurementsAfterDist.length === 1, 'Distance measurement created');
  assert(measurementsAfterDist[0].type === 'distance', 'Measurement type is distance');
  assert(isCloseTo(measurementsAfterDist[0].value, 5.0), 'Measurement value is 5.0 Å');
  assert(measurementsAfterDist[0].label === '5.000 Å', `Label formatted as "5.000 Å" (got "${measurementsAfterDist[0].label}")`);
  assert(JSON.stringify(measurementsAfterDist[0].atomSerials) === JSON.stringify([101, 102]), 'Atom serials recorded correctly');

  // Test 2.2: Angle Mode Buffer & Creation (3 Clicks)
  store.clearMeasurements();
  store.setMeasurementMode('angle');
  assert(useStore.getState().activeMeasurementMode === 'angle', 'Set mode to angle');

  store.addClickedAtom({ serial: 201, x: 1, y: 0, z: 0 });
  store.addClickedAtom({ serial: 202, x: 0, y: 0, z: 0 }); // Vertex
  assert(useStore.getState().clickedAtomBuffer.length === 2, 'Angle mode 2nd click buffers atom 2');
  assert(useStore.getState().measurements.length === 0, 'No measurement created after 2 clicks');

  store.addClickedAtom({ serial: 203, x: 0, y: 1, z: 0 });
  const measurementsAfterAngle = useStore.getState().measurements;
  assert(useStore.getState().clickedAtomBuffer.length === 0, 'Angle mode 3rd click flushes buffer');
  assert(measurementsAfterAngle.length === 1, 'Angle measurement created');
  assert(measurementsAfterAngle[0].type === 'angle', 'Measurement type is angle');
  assert(isCloseTo(measurementsAfterAngle[0].value, 90.0), 'Angle value is 90.0°');
  assert(measurementsAfterAngle[0].label === '90.0°', `Label formatted as "90.0°" (got "${measurementsAfterAngle[0].label}")`);
  assert(JSON.stringify(measurementsAfterAngle[0].atomSerials) === JSON.stringify([201, 202, 203]), 'Angle atom serials recorded');

  // Test 2.3: Dihedral Mode Buffer & Creation (4 Clicks)
  store.clearMeasurements();
  store.setMeasurementMode('dihedral');
  store.addClickedAtom({ serial: 301, x: 1, y: 1, z: 0 });
  store.addClickedAtom({ serial: 302, x: 1, y: 0, z: 0 });
  store.addClickedAtom({ serial: 303, x: 0, y: 0, z: 0 });
  assert(useStore.getState().clickedAtomBuffer.length === 3, 'Dihedral mode 3rd click buffers atom 3');

  store.addClickedAtom({ serial: 304, x: 0, y: 0, z: 1 });
  const measurementsAfterDih = useStore.getState().measurements;
  assert(useStore.getState().clickedAtomBuffer.length === 0, 'Dihedral mode 4th click flushes buffer');
  assert(measurementsAfterDih.length === 1, 'Dihedral measurement created');
  assert(measurementsAfterDih[0].type === 'dihedral', 'Measurement type is dihedral');
  assert(isCloseTo(measurementsAfterDih[0].value, 90.0), 'Dihedral value is 90.0°');
  assert(measurementsAfterDih[0].label === '90.0°', `Label formatted as "90.0°" (got "${measurementsAfterDih[0].label}")`);
  assert(JSON.stringify(measurementsAfterDih[0].atomSerials) === JSON.stringify([301, 302, 303, 304]), 'Dihedral atom serials recorded');

  // Test 2.4: Label Mode Buffer & Creation (1 Click)
  store.clearMeasurements();
  store.setMeasurementMode('label');
  store.addClickedAtom({ serial: 401, x: 10, y: 20, z: 30 });
  const measurementsAfterLabel = useStore.getState().measurements;
  assert(useStore.getState().clickedAtomBuffer.length === 0, 'Label mode 1st click flushes buffer');
  assert(measurementsAfterLabel.length === 1, 'Label measurement created');
  assert(measurementsAfterLabel[0].type === 'label', 'Measurement type is label');
  assert(measurementsAfterLabel[0].label === 'Atom 401', 'Label text generated correctly');

  // Test 2.5: Buffer Auto-Reset on Mode Switch
  store.clearMeasurements();
  store.setMeasurementMode('angle');
  store.addClickedAtom({ serial: 501, x: 0, y: 0, z: 0 });
  store.addClickedAtom({ serial: 502, x: 1, y: 0, z: 0 });
  assert(useStore.getState().clickedAtomBuffer.length === 2, 'Buffer holds 2 atoms in angle mode');

  // Switch mode to distance -> buffer should reset to empty
  store.setMeasurementMode('distance');
  assert(useStore.getState().clickedAtomBuffer.length === 0, 'Buffer automatically cleared on mode switch');

  // Test 2.6: Removal & Clearing Operations
  store.clearMeasurements();
  store.setMeasurementMode('distance');
  store.addClickedAtom({ serial: 601, x: 0, y: 0, z: 0 });
  store.addClickedAtom({ serial: 602, x: 1, y: 0, z: 0 });
  store.addClickedAtom({ serial: 603, x: 0, y: 0, z: 0 });
  store.addClickedAtom({ serial: 604, x: 0, y: 2, z: 0 });
  assert(useStore.getState().measurements.length === 2, 'Added 2 distance measurements');

  const firstId = useStore.getState().measurements[0].id;
  store.removeMeasurement(firstId);
  assert(useStore.getState().measurements.length === 1, 'removeMeasurement removes target measurement');
  assert(useStore.getState().measurements[0].id !== firstId, 'Remaining measurement is second item');

  store.clearMeasurements();
  assert(useStore.getState().measurements.length === 0, 'clearMeasurements resets measurements array to empty');

  // -----------------------------------------------------------------
  // 3. EDGE CASE GEOMETRIES & NUMERICAL STABILITY
  // -----------------------------------------------------------------
  console.log('\n--- 3. Edge Case Geometries & Numerical Robustness ---');

  // Coincident Points Angle (zero-length leg)
  const angleZeroLeg = calculateAngle({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
  assert(!isNaN(angleZeroLeg), 'Angle with zero-length leg returns non-NaN', `got ${angleZeroLeg}`);

  // Degenerate Parallel Vectors Angle (cos = 1.0000000000000002 roundoff)
  const A_col = { x: 1.0000000000000002, y: 0, z: 0 };
  const B_col = { x: 0, y: 0, z: 0 };
  const C_col = { x: 2, y: 0, z: 0 };
  const angleCollinear = calculateAngle(A_col, B_col, C_col);
  assert(!isNaN(angleCollinear) && isCloseTo(angleCollinear, 0.0), 'Collinear vectors with roundoff float ratio return 0.0° without NaN', `got ${angleCollinear}°`);

  // Degenerate Collinear Dihedral (points A, B, C collinear -> normal n1 = 0)
  const dihDegenerate = calculateDihedral(
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 },
    { x: 2, y: 1, z: 0 }
  );
  assert(!isNaN(dihDegenerate), 'Collinear A-B-C Dihedral angle handles zero normal without NaN', `got ${dihDegenerate}`);

  // Extreme Microscopic & Macroscopic Coordinate Scale Invariance
  const microScale = 1e-6;
  const macroScale = 1e6;

  const dMicro = calculateDistance({ x: 0, y: 0, z: 0 }, { x: 3 * microScale, y: 4 * microScale, z: 0 });
  assert(isCloseTo(dMicro, 5 * microScale), 'Microscopic Distance Scale (1e-6)', `expected ${5 * microScale}, got ${dMicro}`);

  const dMacro = calculateDistance({ x: 0, y: 0, z: 0 }, { x: 3 * macroScale, y: 4 * macroScale, z: 0 });
  assert(isCloseTo(dMacro, 5 * macroScale), 'Macroscopic Distance Scale (1e6)', `expected ${5 * macroScale}, got ${dMacro}`);

  const aMacro = calculateAngle(
    { x: 1 * macroScale, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 1 * macroScale, z: 0 }
  );
  assert(isCloseTo(aMacro, 90.0), 'Macroscopic Scale Angle Invariance', `expected 90.0°, got ${aMacro.toFixed(4)}°`);

  const dihMacro = calculateDihedral(
    { x: 1 * macroScale, y: 1 * macroScale, z: 0 },
    { x: 1 * macroScale, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 1 * macroScale, z: 0 }
  );
  assert(isCloseTo(dihMacro, 0.0), 'Macroscopic Scale Dihedral Invariance', `expected 0.0°, got ${dihMacro.toFixed(4)}°`);

  // -----------------------------------------------------------------
  // 4. REAL PDB STRUCTURE COORDINATE VERIFICATION (1HVR.pdb)
  // -----------------------------------------------------------------
  console.log('\n--- 4. Real PDB Coordinate Verification (1HVR.pdb) ---');

  const pdbPath = path.resolve(process.cwd(), '1HVR.pdb');
  assert(fs.existsSync(pdbPath), '1HVR.pdb file exists in workspace root');

  const pdbContent = fs.readFileSync(pdbPath, 'utf8');
  const pdbAtoms = parsePDBAtoms(pdbContent);
  assert(pdbAtoms.length > 0, `1HVR.pdb parsed successfully (${pdbAtoms.length} atoms found)`);

  // Extract Residue 1 (VAL 1 Chain A) backbone atoms: N, CA, C, O
  const val1_N = pdbAtoms.find(a => a.chainID === 'A' && a.resSeq === 1 && a.name === 'N');
  const val1_CA = pdbAtoms.find(a => a.chainID === 'A' && a.resSeq === 1 && a.name === 'CA');
  const val1_C = pdbAtoms.find(a => a.chainID === 'A' && a.resSeq === 1 && a.name === 'C');
  const val1_O = pdbAtoms.find(a => a.chainID === 'A' && a.resSeq === 1 && a.name === 'O');

  // Extract Residue 2 (GLN 2 Chain A) backbone atoms: N, CA
  const gln2_N = pdbAtoms.find(a => a.chainID === 'A' && a.resSeq === 2 && a.name === 'N');
  const gln2_CA = pdbAtoms.find(a => a.chainID === 'A' && a.resSeq === 2 && a.name === 'CA');

  assert(Boolean(val1_N && val1_CA && val1_C && gln2_N && gln2_CA), 'Extracted backbone atoms for 1HVR Val1 & Gln2');

  if (val1_N && val1_CA && val1_C && val1_O && gln2_N && gln2_CA) {
    console.log('\n  [Coordinate Audit Log - 1HVR.pdb Backbone Atoms]');
    console.log(`    VAL 1 Chain A N : (${val1_N.x.toFixed(3)}, ${val1_N.y.toFixed(3)}, ${val1_N.z.toFixed(3)})`);
    console.log(`    VAL 1 Chain A CA: (${val1_CA.x.toFixed(3)}, ${val1_CA.y.toFixed(3)}, ${val1_CA.z.toFixed(3)})`);
    console.log(`    VAL 1 Chain A C : (${val1_C.x.toFixed(3)}, ${val1_C.y.toFixed(3)}, ${val1_C.z.toFixed(3)})`);
    console.log(`    GLN 2 Chain A N : (${gln2_N.x.toFixed(3)}, ${gln2_N.y.toFixed(3)}, ${gln2_N.z.toFixed(3)})`);
    console.log(`    GLN 2 Chain A CA: (${gln2_CA.x.toFixed(3)}, ${gln2_CA.y.toFixed(3)}, ${gln2_CA.z.toFixed(3)})`);

    // Verify 1HVR distances
    const dVal1C_Gln2N = calculateDistance(val1_C, gln2_N);
    // Typical C-N peptide bond length is ~1.33 Å
    assert(isCloseTo(dVal1C_Gln2N, 1.33, 0.15), '1HVR Val1 C - Gln2 N Peptide Bond Distance', `${dVal1C_Gln2N.toFixed(3)} Å`);

    const dVal1CA_Gln2CA = calculateDistance(val1_CA, gln2_CA);
    // Typical CA-CA distance in C-alpha backbone is ~3.8 Å
    assert(isCloseTo(dVal1CA_Gln2CA, 3.8, 0.4), '1HVR Val1 CA - Gln2 CA Distance', `${dVal1CA_Gln2CA.toFixed(3)} Å`);

    // Verify 1HVR Bond Angle (N - CA - C of Val1)
    const angleVal1_N_CA_C = calculateAngle(val1_N, val1_CA, val1_C);
    // Typical N-CA-C tetrahedral angle in protein backbone is ~110° - 112°
    assert(isCloseTo(angleVal1_N_CA_C, 111.0, 10.0), '1HVR Val1 N-CA-C Backbone Bond Angle', `${angleVal1_N_CA_C.toFixed(2)}°`);

    // Verify 1HVR Psi Dihedral Angle (N1 - CA1 - C1 - N2)
    const psiVal1 = calculateDihedral(val1_N, val1_CA, val1_C, gln2_N);
    assert(!isNaN(psiVal1), '1HVR Val1 Psi Dihedral Torsion Angle calculated', `psi = ${psiVal1.toFixed(2)}°`);

    // Verify 1HVR Omega Dihedral Angle (CA1 - C1 - N2 - CA2) (Peptide bond, should be ~180° for trans)
    const omegaVal1 = calculateDihedral(val1_CA, val1_C, gln2_N, gln2_CA);
    assert(isCloseTo(Math.abs(omegaVal1), 180.0, 25.0), '1HVR Val1-Gln2 Omega Trans Peptide Bond Dihedral', `omega = ${omegaVal1.toFixed(2)}°`);
  }

  // -----------------------------------------------------------------
  // 5. PERFORMANCE LATENCY & THROUGHPUT BENCHMARKS
  // -----------------------------------------------------------------
  console.log('\n--- 5. Execution Latency & Throughput Benchmarks ---');

  const numOps = 100000;
  const pA = { x: 12.34, y: -56.78, z: 90.12 };
  const pB = { x: 34.56, y: 78.90, z: -12.34 };
  const pC = { x: -56.78, y: 12.34, z: 45.67 };
  const pD = { x: 89.01, y: -23.45, z: -67.89 };

  // Benchmark Distance Calculations
  const tDistStart = performance.now();
  let dummyDist = 0;
  for (let i = 0; i < numOps; i++) {
    dummyDist += calculateDistance(pA, pB);
  }
  const tDistEnd = performance.now();
  const distDuration = tDistEnd - tDistStart;
  const distOpsPerSec = Math.round((numOps / distDuration) * 1000);
  console.log(`  -> Distance Latency (${numOps.toLocaleString()} ops): ${distDuration.toFixed(2)} ms (${distOpsPerSec.toLocaleString()} ops/sec)`);
  assert(distDuration < 100, `Distance throughput > 1,000,000 ops/sec (${distOpsPerSec.toLocaleString()} ops/sec)`);

  // Benchmark Angle Calculations
  const tAngleStart = performance.now();
  let dummyAngle = 0;
  for (let i = 0; i < numOps; i++) {
    dummyAngle += calculateAngle(pA, pB, pC);
  }
  const tAngleEnd = performance.now();
  const angleDuration = tAngleEnd - tAngleStart;
  const angleOpsPerSec = Math.round((numOps / angleDuration) * 1000);
  console.log(`  -> Angle Latency    (${numOps.toLocaleString()} ops): ${angleDuration.toFixed(2)} ms (${angleOpsPerSec.toLocaleString()} ops/sec)`);
  assert(angleDuration < 200, `Angle throughput > 500,000 ops/sec (${angleOpsPerSec.toLocaleString()} ops/sec)`);

  // Benchmark Dihedral Calculations
  const tDihStart = performance.now();
  let dummyDih = 0;
  for (let i = 0; i < numOps; i++) {
    dummyDih += calculateDihedral(pA, pB, pC, pD);
  }
  const tDihEnd = performance.now();
  const dihDuration = tDihEnd - tDihStart;
  const dihOpsPerSec = Math.round((numOps / dihDuration) * 1000);
  console.log(`  -> Dihedral Latency (${numOps.toLocaleString()} ops): ${dihDuration.toFixed(2)} ms (${dihOpsPerSec.toLocaleString()} ops/sec)`);
  assert(dihDuration < 300, `Dihedral throughput > 300,000 ops/sec (${dihOpsPerSec.toLocaleString()} ops/sec)`);

  // Benchmark Store Buffer Operations (10,000 sequential clicks)
  const storeOps = 10000;
  store.clearMeasurements();
  store.setMeasurementMode('distance');
  const tStoreStart = performance.now();
  for (let i = 0; i < storeOps; i++) {
    store.addClickedAtom({ serial: i, x: i * 0.1, y: i * 0.2, z: i * 0.3 });
  }
  const tStoreEnd = performance.now();
  const storeDuration = tStoreEnd - tStoreStart;
  const storeOpsPerSec = Math.round((storeOps / storeDuration) * 1000);
  console.log(`  -> Store Buffer Latency (${storeOps.toLocaleString()} clicks): ${storeDuration.toFixed(2)} ms (${storeOpsPerSec.toLocaleString()} ops/sec)`);
  assert(storeDuration < 500, `Store buffer high frequency clicks completed in < 500ms (${storeDuration.toFixed(2)}ms)`);
  assert(useStore.getState().measurements.length === storeOps / 2, `Store contains ${storeOps / 2} distance measurements after ${storeOps} clicks`);

  // -----------------------------------------------------------------
  // FINAL TEST SUMMARY REPORT
  // -----------------------------------------------------------------
  console.log('\n========================================================');
  console.log(` TEST SUMMARY: ${passedTests} / ${totalTests} ASSERTIONS PASSED`);
  console.log('========================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runMeasurementVerification().catch((err) => {
  console.error('Unhandled error in test runner:', err);
  process.exit(1);
});
