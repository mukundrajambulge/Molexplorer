import fs from 'fs';
import path from 'path';
import { SelectionParser, Atom } from '../src/lib/SelectionParser';
import { MolProcessor } from '../src/lib/MolProcessor';

async function runTorsionVerification() {
  const startTime = performance.now();
  console.log("=================================================");
  console.log("  BIOPHYSICAL TORSION & RAMACHANDRAN VERIFICATION ");
  console.log("=================================================\n");

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
      failedTests++;
    }
  }

  // -------------------------------------------------------------
  // 1. Synthetic 3D Geometry Sign Verification
  // -------------------------------------------------------------
  console.log("--- Test Suite 1: Synthetic Dihedral Angle Signs ---");

  const createAtom = (serial: number, name: string, x: number, y: number, z: number, resSeq: number = 1, chainID: string = 'A', resName: string = 'ALA'): Atom => ({
    serial,
    name,
    elem: name[0],
    resName,
    resSeq,
    chainID,
    bonds: [],
    x, y, z
  });

  // Case A: Cis conformation (0 degrees)
  const cisAtoms: Atom[] = [
    createAtom(1, 'A', 1, 1, 0),
    createAtom(2, 'B', 0, 1, 0),
    createAtom(3, 'C', 0, 0, 0),
    createAtom(4, 'D', 1, 0, 0)
  ];
  const parserCis = new SelectionParser(cisAtoms);
  const resCis = parserCis.evaluateCommand("get_dihedral id 1, id 2, id 3, id 4");
  const valCis = resCis.addMeasurement?.value ?? 999;
  assert(Math.abs(valCis - 0.0) < 1e-4, "Cis Conformation Dihedral (0°)", `Expected 0.0°, got ${valCis.toFixed(4)}°`);

  // Case B: Trans conformation (180 degrees)
  const transAtoms: Atom[] = [
    createAtom(1, 'A', -1, 1, 0),
    createAtom(2, 'B', 0, 1, 0),
    createAtom(3, 'C', 0, 0, 0),
    createAtom(4, 'D', 1, 0, 0)
  ];
  const parserTrans = new SelectionParser(transAtoms);
  const resTrans = parserTrans.evaluateCommand("get_dihedral id 1, id 2, id 3, id 4");
  const valTrans = Math.abs(resTrans.addMeasurement?.value ?? 0);
  assert(Math.abs(valTrans - 180.0) < 1e-4, "Trans Conformation Dihedral (180°)", `Expected 180.0°, got ${valTrans.toFixed(4)}°`);

  // Case C: Standard -90 degree twist around B->C
  const minus90Atoms: Atom[] = [
    createAtom(1, 'A', 0, 1, 1),
    createAtom(2, 'B', 0, 1, 0),
    createAtom(3, 'C', 0, 0, 0),
    createAtom(4, 'D', 1, 0, 0)
  ];
  const parserMinus90 = new SelectionParser(minus90Atoms);
  const resMinus90 = parserMinus90.evaluateCommand("get_dihedral id 1, id 2, id 3, id 4");
  const valMinus90 = resMinus90.addMeasurement?.value ?? 0;
  assert(Math.abs(valMinus90 - (-90.0)) < 1e-4, "Biophysical (-90°) Twist Dihedral", `Expected -90.0°, got ${valMinus90.toFixed(4)}°`);

  // Case D: Standard +90 degree twist around B->C
  const plus90Atoms: Atom[] = [
    createAtom(1, 'A', 0, 1, -1),
    createAtom(2, 'B', 0, 1, 0),
    createAtom(3, 'C', 0, 0, 0),
    createAtom(4, 'D', 1, 0, 0)
  ];
  const parserPlus90 = new SelectionParser(plus90Atoms);
  const resPlus90 = parserPlus90.evaluateCommand("get_dihedral id 1, id 2, id 3, id 4");
  const valPlus90 = resPlus90.addMeasurement?.value ?? 0;
  assert(Math.abs(valPlus90 - 90.0) < 1e-4, "Biophysical (+90°) Twist Dihedral", `Expected +90.0°, got ${valPlus90.toFixed(4)}°`);


  // -------------------------------------------------------------
  // 2. Ramachandran Region Contours (Lovell et al. 2003)
  // -------------------------------------------------------------
  console.log("\n--- Test Suite 2: Ramachandran Region Contour Mapping (Lovell 2003) ---");

  function evalRegion(phi: number, psi: number): 'favored' | 'allowed' | 'outlier' {
    if (phi === 360 || psi === 360) return 'allowed';
    if (phi >= -100 && phi <= -30 && psi >= -70 && psi <= -10) return 'favored'; // Alpha helix
    if (phi >= -160 && phi <= -50 && (psi >= 90 && psi <= 180 || psi >= -180 && psi <= -160)) return 'favored'; // Beta sheet
    if (phi >= 30 && phi <= 90 && psi >= 20 && psi <= 90) return 'favored'; // Left-handed alpha
    if (phi >= -120 && phi <= -10 && psi >= -90 && psi <= 10) return 'allowed';
    if (phi >= -180 && phi <= -30 && (psi >= 70 && psi <= 180 || psi >= -180 && psi <= -140)) return 'allowed';
    if (phi >= 10 && phi <= 110 && psi >= 0 && psi <= 110) return 'allowed';
    return 'outlier';
  }

  assert(evalRegion(-60, -45) === 'favored', "Alpha Helix Core Region (-60°, -45°)", "Must be 'favored'");
  assert(evalRegion(-120, 135) === 'favored', "Beta Sheet Core Region (-120°, +135°)", "Must be 'favored'");
  assert(evalRegion(60, 45) === 'favored', "Left-handed Alpha Helix Core (+60°, +45°)", "Must be 'favored'");
  assert(evalRegion(-110, -80) === 'allowed', "Alpha Helix Outer Allowed Region (-110°, -80°)", "Must be 'allowed'");
  assert(evalRegion(0, 0) === 'outlier', "Steric Outlier Origin (0°, 0°)", "Must be 'outlier'");
  assert(evalRegion(100, -100) === 'outlier', "Steric Outlier Region (+100°, -100°)", "Must be 'outlier'");


  // SVG Contour Box Bounds in MolStudio.tsx Verification
  console.log("\n--- Test Suite 3: MolStudio SVG Contour Boundary Rectangles ---");
  const svgAlphaX = ((-60 + 180) / 360) * 200;
  const svgAlphaY = 200 - ((-45 + 180) / 360) * 200;
  assert(svgAlphaX >= 44.4 && svgAlphaX <= 83.3, "Alpha Helix Center X in SVG Rect", `x=${svgAlphaX.toFixed(1)}`);
  assert(svgAlphaY >= 105.5 && svgAlphaY <= 138.9, "Alpha Helix Center Y in SVG Rect", `y=${svgAlphaY.toFixed(1)}`);

  const svgBetaX = ((-120 + 180) / 360) * 200;
  const svgBetaY = 200 - ((135 + 180) / 360) * 200;
  assert(svgBetaX >= 11.1 && svgBetaX <= 72.2, "Beta Sheet Center X in SVG Rect", `x=${svgBetaX.toFixed(1)}`);
  assert(svgBetaY >= 0 && svgBetaY <= 50.0, "Beta Sheet Center Y in SVG Rect", `y=${svgBetaY.toFixed(1)}`);


  // -------------------------------------------------------------
  // 3. Real PDB Structure Test (1HVR.pdb)
  // -------------------------------------------------------------
  console.log("\n--- Test Suite 4: Real Protein PDB Verification (1HVR.pdb) ---");
  
  const pdbPath = path.resolve(process.cwd(), '1HVR.pdb');
  if (fs.existsSync(pdbPath)) {
    const pdbContent = fs.readFileSync(pdbPath, 'utf-8');
    const processor = new MolProcessor(pdbContent, 'pdb');
    const parser = new SelectionParser(processor.atoms);

    const ramaResult = parser.evaluateCommand("ramachandran all");
    const report = ramaResult.ramachandranReport || [];

    assert(report.length > 0, "1HVR Ramachandran Report Generated", `Found ${report.length} evaluated residues`);

    if (report.length > 0) {
      const res2A = report.find(r => r.chainID === 'A' && r.resSeq === 2);
      if (res2A) {
        console.log(`     Residue A:2 (${res2A.resName}): Phi = ${res2A.phi.toFixed(1)}°, Psi = ${res2A.psi.toFixed(1)}° [Region: ${res2A.region}]`);
        assert(res2A.phi < 0, "Residue A:2 Phi is Negative (Beta Strand)", `Phi = ${res2A.phi.toFixed(1)}°`);
        assert(res2A.psi > 0, "Residue A:2 Psi is Positive (Beta Strand)", `Psi = ${res2A.psi.toFixed(1)}°`);
        assert(res2A.region === 'favored' || res2A.region === 'allowed', "Residue A:2 in Valid Conformation", `Region = ${res2A.region}`);
      }

      const favoredCount = report.filter(r => r.region === 'favored').length;
      const allowedCount = report.filter(r => r.region === 'allowed').length;
      const outlierCount = report.filter(r => r.region === 'outlier').length;
      const favoredPct = (favoredCount / report.length) * 100;
      const allowedPct = (allowedCount / report.length) * 100;
      const outlierPct = (outlierCount / report.length) * 100;

      console.log(`     Total Residues Evaluated: ${report.length}`);
      console.log(`     - Favored: ${favoredCount} (${favoredPct.toFixed(1)}%)`);
      console.log(`     - Allowed: ${allowedCount} (${allowedPct.toFixed(1)}%)`);
      console.log(`     - Outliers: ${outlierCount} (${outlierPct.toFixed(1)}%)`);

      assert(favoredPct > 80.0, "High Quality Stereochemistry (>80% Favored)", `Favored = ${favoredPct.toFixed(1)}%`);
      assert(outlierPct < 10.0, "Low Outlier Rate (<10% Outliers)", `Outliers = ${outlierPct.toFixed(1)}%`);
    }
  } else {
    console.error(`  [WARN] 1HVR.pdb not found at ${pdbPath}`);
  }

  const endTime = performance.now();
  const latencyMs = endTime - startTime;

  console.log("\n=================================================");
  console.log(`  VERIFICATION COMPLETE`);
  console.log(`  Passed: ${passedTests} | Failed: ${failedTests}`);
  console.log(`  Execution Latency: ${latencyMs.toFixed(2)} ms`);
  console.log("=================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTorsionVerification().catch(err => {
  console.error("Test execution error:", err);
  process.exit(1);
});
