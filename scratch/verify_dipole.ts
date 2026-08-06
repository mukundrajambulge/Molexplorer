import fs from 'fs';
import path from 'path';

// Define core interfaces for dipole calculations
export interface Atom {
  serial: number;
  name: string;
  resName: string;
  resSeq: number;
  chainID: string;
  elem: string;
  x: number;
  y: number;
  z: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface DipoleResult {
  netCharge: number;
  centerOfMass: Vec3;
  dipoleVectorEAng: Vec3;   // e·Å
  dipoleVectorDebye: Vec3;  // Debye
  magnitudeDebye: number;    // Debye
  atomCount: number;
  totalMass: number;
}

// Atomic mass lookup (g/mol or amu)
export function getAtomicMass(elem: string): number {
  const clean = elem.trim().toUpperCase();
  switch (clean) {
    case 'H': return 1.008;
    case 'C': return 12.011;
    case 'N': return 14.007;
    case 'O': return 15.999;
    case 'P': return 30.974;
    case 'S': return 32.060;
    case 'F': return 18.998;
    case 'CL': return 35.450;
    case 'BR': return 79.904;
    case 'I': return 126.904;
    case 'FE': return 55.845;
    case 'ZN': return 65.380;
    case 'MG': return 24.305;
    case 'CA': return 40.078;
    case 'NA': return 22.990;
    case 'K': return 39.098;
    default: return 12.011;
  }
}

// Partial charge lookup table based on AMBER force field conventions with element fallback
const AMBER_CHARGES: Record<string, number> = {
  "N": -0.47, "H": 0.31, "CA": 0.07, "C": 0.51, "O": -0.51,
  "NZ": 1.00, "NH1": 0.40, "NH2": 0.40, "NE": -0.05,
  "OD1": -0.80, "OD2": -0.80, "OE1": -0.80, "OE2": -0.80,
  "SG": -0.20, "OH": -0.40, "ND1": -0.36, "NE2": -0.36
};

export function getPartialCharge(atomName: string, elem: string, customCharge?: number): number {
  if (customCharge !== undefined) return customCharge;
  const cleanName = atomName.trim().toUpperCase();
  if (AMBER_CHARGES[cleanName] !== undefined) {
    return AMBER_CHARGES[cleanName];
  }
  const cleanElem = elem.trim().toUpperCase();
  if (cleanElem === 'O' || cleanName.startsWith('O')) return -0.40;
  if (cleanElem === 'N' || cleanName.startsWith('N')) return -0.40;
  if (cleanElem === 'C' || cleanName.startsWith('C')) return 0.00;
  if (cleanElem === 'H' || cleanName.startsWith('H')) return 0.10;
  if (cleanElem === 'S') return -0.20;
  if (cleanElem === 'P') return 0.40;
  if (cleanElem === 'F' || cleanElem === 'CL' || cleanElem === 'BR' || cleanElem === 'I') return -0.20;
  return 0.00;
}

const DEBYE_PER_E_ANGSTROM = 4.8032;

// Core physics functions
export function calculateCenterOfMass(atoms: Atom[]): { com: Vec3; totalMass: number } {
  if (atoms.length === 0) {
    return { com: { x: 0, y: 0, z: 0 }, totalMass: 0 };
  }
  let totalMass = 0;
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < atoms.length; i++) {
    const m = getAtomicMass(atoms[i].elem);
    totalMass += m;
    cx += atoms[i].x * m;
    cy += atoms[i].y * m;
    cz += atoms[i].z * m;
  }
  if (totalMass > 0) {
    cx /= totalMass;
    cy /= totalMass;
    cz /= totalMass;
  }
  return { com: { x: cx, y: cy, z: cz }, totalMass };
}

export function calculateDipoleMoment(
  atoms: (Atom & { partialCharge?: number })[]
): DipoleResult {
  if (atoms.length === 0) {
    return {
      netCharge: 0,
      centerOfMass: { x: 0, y: 0, z: 0 },
      dipoleVectorEAng: { x: 0, y: 0, z: 0 },
      dipoleVectorDebye: { x: 0, y: 0, z: 0 },
      magnitudeDebye: 0,
      atomCount: 0,
      totalMass: 0
    };
  }

  const { com, totalMass } = calculateCenterOfMass(atoms);

  let netCharge = 0;
  let mux = 0, muy = 0, muz = 0;

  for (let i = 0; i < atoms.length; i++) {
    const a = atoms[i];
    const q = getPartialCharge(a.name, a.elem, a.partialCharge);
    netCharge += q;
    const dx = a.x - com.x;
    const dy = a.y - com.y;
    const dz = a.z - com.z;
    mux += q * dx;
    muy += q * dy;
    muz += q * dz;
  }

  const dipoleVectorEAng: Vec3 = { x: mux, y: muy, z: muz };
  const dipoleVectorDebye: Vec3 = {
    x: mux * DEBYE_PER_E_ANGSTROM,
    y: muy * DEBYE_PER_E_ANGSTROM,
    z: muz * DEBYE_PER_E_ANGSTROM
  };

  const magDebye = Math.sqrt(
    dipoleVectorDebye.x * dipoleVectorDebye.x +
    dipoleVectorDebye.y * dipoleVectorDebye.y +
    dipoleVectorDebye.z * dipoleVectorDebye.z
  );

  return {
    netCharge,
    centerOfMass: com,
    dipoleVectorEAng,
    dipoleVectorDebye,
    magnitudeDebye: magDebye,
    atomCount: atoms.length,
    totalMass
  };
}

// Simple PDB parser for testing
export function parsePDBAtoms(pdbContent: string): Atom[] {
  const atoms: Atom[] = [];
  const lines = pdbContent.split('\n');
  for (const line of lines) {
    if (line.startsWith('ATOM  ') || line.startsWith('HETATM')) {
      const serial = parseInt(line.substring(6, 11).trim() || '0', 10);
      const name = line.substring(12, 16);
      const resName = line.substring(17, 20).trim();
      const chainID = line.substring(21, 22).trim();
      const resSeq = parseInt(line.substring(22, 26).trim() || '0', 10);
      const x = parseFloat(line.substring(30, 38));
      const y = parseFloat(line.substring(38, 46));
      const z = parseFloat(line.substring(46, 54));
      let elem = line.substring(76, 78).trim().toUpperCase();
      if (!elem) {
        elem = name.replace(/[0-9]/g, '').trim().substring(0, 1);
      }
      atoms.push({ serial, name, resName, chainID, resSeq, x, y, z, elem });
    }
  }
  return atoms;
}

// Verification suite runner
function runVerificationSuite() {
  console.log("===============================================================");
  console.log("         MOLECULAR DIPOLE MOMENT VERIFICATION SUITE           ");
  console.log("===============================================================\n");

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      if (detail) console.log(`    ↳ ${detail}`);
      passedTests++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`);
      if (detail) console.error(`    ↳ ${detail}`);
      failedTests++;
    }
  }

  function approxEquals(a: number, b: number, tolerance = 1e-4): boolean {
    return Math.abs(a - b) <= tolerance;
  }

  // -------------------------------------------------------------------------
  // TEST 1: PARTIAL CHARGE ASSIGNMENTS
  // -------------------------------------------------------------------------
  console.log("--- TEST 1: Partial Charge Assignments ---");

  const amberN = getPartialCharge(" N  ", "N");
  const amberH = getPartialCharge(" H  ", "H");
  const amberCA = getPartialCharge(" CA ", "C");
  const amberC = getPartialCharge(" C  ", "C");
  const amberO = getPartialCharge(" O  ", "O");

  assert(amberN === -0.47, "AMBER Backbone N partial charge", `N = ${amberN} e (expected -0.47)`);
  assert(amberH === 0.31, "AMBER Backbone H partial charge", `H = ${amberH} e (expected 0.31)`);
  assert(amberCA === 0.07, "AMBER Backbone CA partial charge", `CA = ${amberCA} e (expected 0.07)`);
  assert(amberC === 0.51, "AMBER Backbone C partial charge", `C = ${amberC} e (expected 0.51)`);
  assert(amberO === -0.51, "AMBER Backbone O partial charge", `O = ${amberO} e (expected -0.51)`);

  const backboneSum = amberN + amberH + amberCA + amberC + amberO;
  assert(approxEquals(backboneSum, -0.09), "Peptide backbone unit net charge balance", `Sum = ${backboneSum.toFixed(4)} e (expected -0.09)`);

  const fallbackO = getPartialCharge(" O1 ", "O");
  const fallbackN = getPartialCharge(" N2 ", "N");
  const fallbackC = getPartialCharge(" C1 ", "C");
  const fallbackH = getPartialCharge(" H1 ", "H");
  assert(fallbackO === -0.40, "Element fallback O partial charge", `O = ${fallbackO} e`);
  assert(fallbackN === -0.40, "Element fallback N partial charge", `N = ${fallbackN} e`);
  assert(fallbackC === 0.00, "Element fallback C partial charge", `C = ${fallbackC} e`);
  assert(fallbackH === 0.10, "Element fallback H partial charge", `H = ${fallbackH} e`);
  console.log();

  // -------------------------------------------------------------------------
  // TEST 2: CENTER-OF-MASS & CENTROID TRANSLATION
  // -------------------------------------------------------------------------
  console.log("--- TEST 2: Center-of-Mass Translation & Origin Invariance ---");

  // Asymmetric test system: Carbon (12.011) at (0,0,0) and Oxygen (15.999) at (10,0,0)
  const coTestAtoms: (Atom & { partialCharge?: number })[] = [
    { serial: 1, name: " C  ", resName: "MOL", resSeq: 1, chainID: "A", elem: "C", x: 0, y: 0, z: 0, partialCharge: 0.15 },
    { serial: 2, name: " O  ", resName: "MOL", resSeq: 1, chainID: "A", elem: "O", x: 10, y: 0, z: 0, partialCharge: -0.15 }
  ];

  const mC = getAtomicMass("C");
  const mO = getAtomicMass("O");
  const expectedComX = (0 * mC + 10 * mO) / (mC + mO); // ~5.7118 Å

  const { com: rawCom } = calculateCenterOfMass(coTestAtoms);
  assert(approxEquals(rawCom.x, expectedComX, 1e-4), "Mass-weighted COM X-coordinate", `COM.x = ${rawCom.x.toFixed(4)} Å (expected ${expectedComX.toFixed(4)})`);
  assert(approxEquals(rawCom.y, 0), "Mass-weighted COM Y-coordinate", `COM.y = ${rawCom.y.toFixed(4)} Å`);
  assert(approxEquals(rawCom.z, 0), "Mass-weighted COM Z-coordinate", `COM.z = ${rawCom.z.toFixed(4)} Å`);

  // Translate coordinates by -COM
  const translatedAtoms = coTestAtoms.map(a => ({
    ...a,
    x: a.x - rawCom.x,
    y: a.y - rawCom.y,
    z: a.z - rawCom.z
  }));

  const { com: shiftedCom } = calculateCenterOfMass(translatedAtoms);
  assert(approxEquals(shiftedCom.x, 0, 1e-10) && approxEquals(shiftedCom.y, 0, 1e-10) && approxEquals(shiftedCom.z, 0, 1e-10),
    "COM after translation to origin",
    `Shifted COM = (${shiftedCom.x.toExponential(2)}, ${shiftedCom.y.toExponential(2)}, ${shiftedCom.z.toExponential(2)})`
  );

  // Origin shift invariance test for neutral molecule
  const origDipole = calculateDipoleMoment(coTestAtoms);
  const shiftedAtoms = coTestAtoms.map(a => ({
    ...a,
    x: a.x + 123.456,
    y: a.y - 789.012,
    z: a.z + 345.678
  }));
  const shiftedDipole = calculateDipoleMoment(shiftedAtoms);

  assert(approxEquals(origDipole.magnitudeDebye, shiftedDipole.magnitudeDebye, 1e-4),
    "Dipole magnitude origin shift invariance",
    `Original = ${origDipole.magnitudeDebye.toFixed(4)} D, Shifted = ${shiftedDipole.magnitudeDebye.toFixed(4)} D`
  );
  assert(
    approxEquals(origDipole.dipoleVectorDebye.x, shiftedDipole.dipoleVectorDebye.x, 1e-4) &&
    approxEquals(origDipole.dipoleVectorDebye.y, shiftedDipole.dipoleVectorDebye.y, 1e-4) &&
    approxEquals(origDipole.dipoleVectorDebye.z, shiftedDipole.dipoleVectorDebye.z, 1e-4),
    "Dipole vector component origin shift invariance",
    `Original vector = (${origDipole.dipoleVectorDebye.x.toFixed(3)}, ${origDipole.dipoleVectorDebye.y.toFixed(3)}, ${origDipole.dipoleVectorDebye.z.toFixed(3)}) D`
  );
  console.log();

  // -------------------------------------------------------------------------
  // TEST 3: NET DIPOLE VECTOR MAGNITUDE & REFERENCE MOLECULES
  // -------------------------------------------------------------------------
  console.log("--- TEST 3: Net Dipole Vector Magnitude & Reference Models ---");

  // Reference Model A: Point Dipole (+1e at x=1.0, -1e at x=-1.0)
  // Distance = 2.0 Å. Dipole moment = 2.0 e·Å = 2.0 * 4.8032 = 9.6064 Debye.
  const pointDipoleAtoms: (Atom & { partialCharge?: number })[] = [
    { serial: 1, name: " POS", resName: "ION", resSeq: 1, chainID: "A", elem: "C", x: 1.0, y: 0, z: 0, partialCharge: 1.0 },
    { serial: 2, name: " NEG", resName: "ION", resSeq: 1, chainID: "A", elem: "C", x: -1.0, y: 0, z: 0, partialCharge: -1.0 }
  ];
  const pointRes = calculateDipoleMoment(pointDipoleAtoms);
  const expectedPointMag = 2.0 * DEBYE_PER_E_ANGSTROM; // 9.6064 D

  assert(approxEquals(pointRes.magnitudeDebye, expectedPointMag, 1e-4),
    "Point dipole magnitude (2.0 Å separation, ±1.0e)",
    `Calculated = ${pointRes.magnitudeDebye.toFixed(4)} D (expected ${expectedPointMag.toFixed(4)} D)`
  );
  assert(approxEquals(pointRes.dipoleVectorDebye.x, expectedPointMag, 1e-4),
    "Point dipole vector direction (+X axis)",
    `Vector X = ${pointRes.dipoleVectorDebye.x.toFixed(4)} D`
  );

  // Reference Model B: Water Molecule (H2O)
  // O at (0, 0, 0) with q = -0.82e
  // H1 at (0.757, 0.586, 0) with q = +0.41e
  // H2 at (-0.757, 0.586, 0) with q = +0.41e
  const h2oAtoms: (Atom & { partialCharge?: number })[] = [
    { serial: 1, name: " O  ", resName: "HOH", resSeq: 1, chainID: "A", elem: "O", x: 0.000, y: 0.000, z: 0.000, partialCharge: -0.82 },
    { serial: 2, name: " H1 ", resName: "HOH", resSeq: 1, chainID: "A", elem: "H", x: 0.757, y: 0.586, z: 0.000, partialCharge: 0.41 },
    { serial: 3, name: " H2 ", resName: "HOH", resSeq: 1, chainID: "A", elem: "H", x: -0.757, y: 0.586, z: 0.000, partialCharge: 0.41 }
  ];

  const h2oRes = calculateDipoleMoment(h2oAtoms);
  // Analytical calculation:
  // COM_y = (15.999*0 + 1.008*0.586*2)/(15.999 + 2*1.008) = 1.181376 / 18.015 = 0.065577 Å
  // mu_y = -0.82 * (0 - COM_y) + 0.41 * (0.586 - COM_y) * 2
  //      = 0.41 * 0.586 * 2 = 0.48052 e·Å
  // In Debye: 0.48052 * 4.8032 = 2.3080 Debye.
  const expectedH2OMag = 0.48052 * DEBYE_PER_E_ANGSTROM;

  assert(approxEquals(h2oRes.magnitudeDebye, expectedH2OMag, 1e-3),
    "Water (H2O) model dipole magnitude",
    `Calculated = ${h2oRes.magnitudeDebye.toFixed(4)} D (expected ${expectedH2OMag.toFixed(4)} D)`
  );
  assert(h2oRes.dipoleVectorDebye.y > 0 && approxEquals(h2oRes.dipoleVectorDebye.x, 0, 1e-4),
    "Water dipole vector alignment along +Y axis",
    `Vector = (${h2oRes.dipoleVectorDebye.x.toFixed(4)}, ${h2oRes.dipoleVectorDebye.y.toFixed(4)}, ${h2oRes.dipoleVectorDebye.z.toFixed(4)}) D`
  );
  console.log();

  // -------------------------------------------------------------------------
  // TEST 4: REFERENCE PDB STRUCTURE VALIDATION (1HVR.pdb)
  // -------------------------------------------------------------------------
  console.log("--- TEST 4: Reference Structure Validation (1HVR.pdb) ---");

  const pdbPath = path.resolve(process.cwd(), '1HVR.pdb');
  if (fs.existsSync(pdbPath)) {
    const pdbContent = fs.readFileSync(pdbPath, 'utf-8');
    const pdbAtoms = parsePDBAtoms(pdbContent);

    assert(pdbAtoms.length > 0, "PDB atom parsing", `Parsed ${pdbAtoms.length} atoms from 1HVR.pdb`);

    const pdbDipole = calculateDipoleMoment(pdbAtoms);

    assert(!isNaN(pdbDipole.magnitudeDebye) && isFinite(pdbDipole.magnitudeDebye),
      "1HVR Dipole magnitude validity",
      `Magnitude = ${pdbDipole.magnitudeDebye.toFixed(3)} D`
    );

    assert(!isNaN(pdbDipole.netCharge) && isFinite(pdbDipole.netCharge),
      "1HVR Net charge validity",
      `Net Charge = ${pdbDipole.netCharge.toFixed(2)} e`
    );

    assert(!isNaN(pdbDipole.centerOfMass.x) && !isNaN(pdbDipole.centerOfMass.y) && !isNaN(pdbDipole.centerOfMass.z),
      "1HVR Center-of-Mass validity",
      `COM = (${pdbDipole.centerOfMass.x.toFixed(3)}, ${pdbDipole.centerOfMass.y.toFixed(3)}, ${pdbDipole.centerOfMass.z.toFixed(3)}) Å`
    );

    console.log(`  ℹ 1HVR Dipole Vector: (${pdbDipole.dipoleVectorDebye.x.toFixed(2)}, ${pdbDipole.dipoleVectorDebye.y.toFixed(2)}, ${pdbDipole.dipoleVectorDebye.z.toFixed(2)}) Debye`);
    console.log(`  ℹ Total Mass: ${pdbDipole.totalMass.toFixed(2)} amu`);
  } else {
    console.log(`  ⚠ Skip PDB file check: 1HVR.pdb not found at ${pdbPath}`);
  }
  console.log();

  // -------------------------------------------------------------------------
  // TEST 5: CALCULATION SPEED & BENCHMARK LOGGING
  // -------------------------------------------------------------------------
  console.log("--- TEST 5: Calculation Speed & Performance Benchmarks ---");

  // Small molecule benchmark (Water, 3 atoms)
  const SMALL_ITERATIONS = 100000;
  const startSmall = performance.now();
  for (let i = 0; i < SMALL_ITERATIONS; i++) {
    calculateDipoleMoment(h2oAtoms);
  }
  const endSmall = performance.now();
  const durationSmallMs = endSmall - startSmall;
  const opsPerSecSmall = (SMALL_ITERATIONS / durationSmallMs) * 1000;
  const usPerOpSmall = (durationSmallMs * 1000) / SMALL_ITERATIONS;

  console.log(`  Small Molecule Benchmark (H2O, 3 atoms):`);
  console.log(`    - Total Iterations : ${SMALL_ITERATIONS.toLocaleString()}`);
  console.log(`    - Duration         : ${durationSmallMs.toFixed(2)} ms`);
  console.log(`    - Throughput       : ${opsPerSecSmall.toLocaleString(undefined, { maximumFractionDigits: 0 })} ops/sec`);
  console.log(`    - Speed per op     : ${usPerOpSmall.toFixed(3)} μs/op`);
  assert(durationSmallMs < 1000, "Small molecule benchmark speed < 1s for 100k ops");

  // Macromolecule benchmark (1HVR, ~2352 atoms)
  const pdbPathBench = path.resolve(process.cwd(), '1HVR.pdb');
  if (fs.existsSync(pdbPathBench)) {
    const pdbContent = fs.readFileSync(pdbPathBench, 'utf-8');
    const pdbAtoms = parsePDBAtoms(pdbContent);

    const MACRO_ITERATIONS = 2000;
    const startMacro = performance.now();
    for (let i = 0; i < MACRO_ITERATIONS; i++) {
      calculateDipoleMoment(pdbAtoms);
    }
    const endMacro = performance.now();
    const durationMacroMs = endMacro - startMacro;
    const opsPerSecMacro = (MACRO_ITERATIONS / durationMacroMs) * 1000;
    const usPerOpMacro = (durationMacroMs * 1000) / MACRO_ITERATIONS;

    console.log(`\n  Macromolecule Benchmark (1HVR, ${pdbAtoms.length} atoms):`);
    console.log(`    - Total Iterations : ${MACRO_ITERATIONS.toLocaleString()}`);
    console.log(`    - Duration         : ${durationMacroMs.toFixed(2)} ms`);
    console.log(`    - Throughput       : ${opsPerSecMacro.toLocaleString(undefined, { maximumFractionDigits: 0 })} ops/sec`);
    console.log(`    - Speed per op     : ${usPerOpMacro.toFixed(3)} μs/op`);
    assert(durationMacroMs < 2000, "Macromolecule benchmark speed < 2s for 2,000 ops");
  }
  console.log();

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log("===============================================================");
  console.log(`SUMMARY: ${passedTests} passed, ${failedTests} failed.`);
  console.log("===============================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

// Run test suite if invoked directly
runVerificationSuite();
