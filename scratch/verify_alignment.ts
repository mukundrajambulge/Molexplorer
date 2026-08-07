import fs from 'fs';
import path from 'path';
import { Matrix, determinant } from 'ml-matrix';
import { calculateKabsch, alignStructures, applyTransform } from '../src/lib/Alignment';
import { MolProcessor, Atom } from '../src/lib/MolProcessor';

/**
 * Verification Script for Kabsch Alignment Algorithm
 * Validates:
 * 1. SVD rotation matrix orthogonality (R * R^T = I, det(R) = +1)
 * 2. Reflection handling (Chirality conservation)
 * 3. RMSD calculation on reference and perturbed structures
 * 4. PDB alignment performance on real protein structures (1HVR.pdb)
 * 5. Needleman-Wunsch sequence alignment on non-identical topologies
 * 6. Execution latency logging
 */

function matrixMaxDiff(A: Matrix, B: Matrix): number {
  let maxDiff = 0;
  for (let i = 0; i < A.rows; i++) {
    for (let j = 0; j < A.columns; j++) {
      const diff = Math.abs(A.get(i, j) - B.get(i, j));
      if (diff > maxDiff) maxDiff = diff;
    }
  }
  return maxDiff;
}

function runTests() {
  console.log("==========================================================");
  console.log("        KABSCH ALIGNMENT ALGORITHM VERIFICATION           ");
  console.log("==========================================================");

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
  // 1. ROTATION MATRIX ORTHOGONALITY & DETERMINANT TEST
  // -----------------------------------------------------------------
  console.log("\n--- 1. SVD Rotation Matrix Orthogonality & Determinant ---");

  // Reference points A
  const pointsA: number[][] = [
    [1.2, 2.3, 3.4],
    [-4.5, 5.6, 6.7],
    [7.8, -8.9, 9.0],
    [-1.1, -2.2, -3.3],
    [4.4, 0.0, -5.5],
    [0.0, 6.6, 7.7],
    [-8.8, 9.9, -1.0],
    [2.1, -3.2, 4.3]
  ];

  // Rotate pointsA around Z-axis by 90 deg and translate by [15, -20, 30]
  // Forward transform from A to B: xB = -yA + 15, yB = xA - 20, zB = zA + 30
  const pointsB: number[][] = pointsA.map(p => [
    -p[1] + 15.0,
    p[0] - 20.0,
    p[2] + 30.0
  ]);

  const fit1 = calculateKabsch(pointsA, pointsB);
  const R1 = fit1.R;

  // Check R * R^T = I
  const R_RT = R1.mmul(R1.transpose());
  const I3 = Matrix.eye(3, 3);
  const orthError = matrixMaxDiff(R_RT, I3);
  assert(orthError < 1e-10, "Rotation Orthogonality (R * R^T = I)", `Max diff: ${orthError.toExponential(4)}`);

  // Check det(R) = +1
  const detR1 = determinant(R1);
  const detError = Math.abs(detR1 - 1.0);
  assert(detError < 1e-10, "Rotation Determinant (det(R) = +1)", `det(R): ${detR1.toFixed(8)}, Error: ${detError.toExponential(4)}`);

  // -----------------------------------------------------------------
  // 2. CHIRALITY / REFLECTION CORRECTION TEST
  // -----------------------------------------------------------------
  console.log("\n--- 2. Reflection Handling (Chirality Preservation) ---");

  // Invert X coordinates of pointsB (improper rotation / mirror)
  const pointsB_reflected = pointsB.map(p => [-p[0], p[1], p[2]]);
  const fitReflect = calculateKabsch(pointsA, pointsB_reflected);
  const R_reflect = fitReflect.R;
  const detR_reflect = determinant(R_reflect);
  const orthError_reflect = matrixMaxDiff(R_reflect.mmul(R_reflect.transpose()), I3);

  assert(orthError_reflect < 1e-10, "Reflected Matrix Orthogonality", `Max diff: ${orthError_reflect.toExponential(4)}`);
  assert(Math.abs(detR_reflect - 1.0) < 1e-10, "Reflected Matrix Determinant enforced +1", `det(R): ${detR_reflect.toFixed(8)}`);

  // -----------------------------------------------------------------
  // 3. RMSD CALCULATION ON REFERENCE STRUCTURES
  // -----------------------------------------------------------------
  console.log("\n--- 3. RMSD Verification on Reference Structures ---");

  // Case A: Rigid Transformation (zero noise)
  let sumSq1 = 0;
  for (let i = 0; i < pointsA.length; i++) {
    const transformed = applyTransform(pointsB[i], fit1.R, fit1.centroidA, fit1.centroidB);
    const dx = transformed[0] - pointsA[i][0];
    const dy = transformed[1] - pointsA[i][1];
    const dz = transformed[2] - pointsA[i][2];
    sumSq1 += dx*dx + dy*dy + dz*dz;
  }
  const rmsd1 = Math.sqrt(sumSq1 / pointsA.length);
  assert(rmsd1 < 1e-10, "Rigid Transformation RMSD = 0", `Calculated RMSD: ${rmsd1.toExponential(4)}`);

  // Case B: Known noise / Perturbations
  const pointsB_noisy = pointsB.map(p => [...p]);
  pointsB_noisy[0][0] += 0.5; // shift point 0 by 0.5
  pointsB_noisy[1][1] -= 0.5; // shift point 1 by 0.5

  const fitNoisy = calculateKabsch(pointsA, pointsB_noisy);
  let sumSqNoisy = 0;
  for (let i = 0; i < pointsA.length; i++) {
    const transformed = applyTransform(pointsB_noisy[i], fitNoisy.R, fitNoisy.centroidA, fitNoisy.centroidB);
    const dx = transformed[0] - pointsA[i][0];
    const dy = transformed[1] - pointsA[i][1];
    const dz = transformed[2] - pointsA[i][2];
    sumSqNoisy += dx*dx + dy*dy + dz*dz;
  }
  const rmsdNoisy = Math.sqrt(sumSqNoisy / pointsA.length);
  assert(rmsdNoisy > 0 && rmsdNoisy < 0.5, "Perturbed Structure RMSD Non-zero & Bounded", `Calculated RMSD: ${rmsdNoisy.toFixed(6)} Å`);

  // -----------------------------------------------------------------
  // 4. REAL PDB STRUCTURE ALIGNMENT (1HVR.pdb)
  // -----------------------------------------------------------------
  console.log("\n--- 4. Real PDB Structure Alignment (1HVR.pdb) ---");

  const pdbPath = path.resolve(process.cwd(), '1HVR.pdb');
  let pdbAtoms: Atom[] = [];
  if (fs.existsSync(pdbPath)) {
    const pdbContent = fs.readFileSync(pdbPath, 'utf8');
    const processor = new MolProcessor(pdbContent, 'pdb');
    pdbAtoms = processor.atoms;
    console.log(`  Loaded 1HVR.pdb successfully (${pdbAtoms.length} total atoms)`);
  } else {
    console.warn(`  1HVR.pdb not found at ${pdbPath}`);
  }

  if (pdbAtoms.length > 0) {
    // Create structure B by translating and rotating structure A
    const rotatedAtomsB: Atom[] = pdbAtoms.map(a => {
      const rad = Math.PI / 3; // 60 deg rotation
      const cosX = Math.cos(rad);
      const sinX = Math.sin(rad);
      const rx = a.x + 50.0;
      const ry = a.y * cosX - a.z * sinX - 25.0;
      const rz = a.y * sinX + a.z * cosX + 10.0;
      return { ...a, x: rx, y: ry, z: rz };
    });

    const alignResult = alignStructures(pdbAtoms, rotatedAtomsB);
    const R_pdb = new Matrix(alignResult.rotation);
    const orthErr_pdb = matrixMaxDiff(R_pdb.mmul(R_pdb.transpose()), I3);
    const det_pdb = determinant(R_pdb);

    assert(alignResult.rmsd < 1e-4, "Full PDB Structure Alignment RMSD < 1e-4", `RMSD: ${alignResult.rmsd.toExponential(4)} Å`);
    assert(orthErr_pdb < 1e-10, "PDB Alignment Rotation Orthogonality", `Max diff: ${orthErr_pdb.toExponential(4)}`);
    assert(Math.abs(det_pdb - 1.0) < 1e-10, "PDB Alignment Determinant = 1.0", `det(R): ${det_pdb.toFixed(8)}`);
    assert(alignResult.alignedAtomsB.length === pdbAtoms.length, "Aligned Atom Count Preserved", `Count: ${alignResult.alignedAtomsB.length}`);
  }

  // -----------------------------------------------------------------
  // 5. NEEDLEMAN-WUNSCH NON-IDENTICAL SEQUENCE ALIGNMENT
  // -----------------------------------------------------------------
  console.log("\n--- 5. Needleman-Wunsch Alignment (Different Topologies) ---");

  const mockChainA: Atom[] = [
    { serial: 1, name: "CA", resName: "ALA", chainID: "A", resSeq: 1, x: 0.0, y: 0.0, z: 0.0, elem: "C", altLoc: " ", isHetero: false, bonds: [] },
    { serial: 2, name: "CA", resName: "GLY", chainID: "A", resSeq: 2, x: 3.8, y: 0.0, z: 0.0, elem: "C", altLoc: " ", isHetero: false, bonds: [] },
    { serial: 3, name: "CA", resName: "VAL", chainID: "A", resSeq: 3, x: 7.6, y: 1.0, z: 0.0, elem: "C", altLoc: " ", isHetero: false, bonds: [] },
    { serial: 4, name: "CA", resName: "LEU", chainID: "A", resSeq: 4, x: 11.4, y: 0.0, z: 1.0, elem: "C", altLoc: " ", isHetero: false, bonds: [] },
  ];

  const mockChainB: Atom[] = [
    { serial: 1, name: "CA", resName: "MET", chainID: "B", resSeq: 10, x: -5.0, y: 0.0, z: 0.0, elem: "C", altLoc: " ", isHetero: false, bonds: [] },
    { serial: 2, name: "CA", resName: "ALA", chainID: "B", resSeq: 11, x: 10.0, y: 10.0, z: 10.0, elem: "C", altLoc: " ", isHetero: false, bonds: [] },
    { serial: 3, name: "CA", resName: "GLY", chainID: "B", resSeq: 12, x: 13.8, y: 10.0, z: 10.0, elem: "C", altLoc: " ", isHetero: false, bonds: [] },
    { serial: 4, name: "CA", resName: "VAL", chainID: "B", resSeq: 13, x: 17.6, y: 11.0, z: 10.0, elem: "C", altLoc: " ", isHetero: false, bonds: [] },
    { serial: 5, name: "CA", resName: "LEU", chainID: "B", resSeq: 14, x: 21.4, y: 10.0, z: 11.0, elem: "C", altLoc: " ", isHetero: false, bonds: [] },
  ];

  const nwResult = alignStructures(mockChainA, mockChainB);
  const R_nw = new Matrix(nwResult.rotation);
  const orthErr_nw = matrixMaxDiff(R_nw.mmul(R_nw.transpose()), I3);
  const det_nw = determinant(R_nw);

  assert(nwResult.atomPairsCount >= 4, "Sequence Alignment Paired Atom Count", `Matched pairs: ${nwResult.atomPairsCount}`);
  assert(nwResult.rmsd < 1e-4, "Aligned Sequence RMSD < 1e-4", `RMSD: ${nwResult.rmsd.toExponential(4)} Å`);
  assert(orthErr_nw < 1e-10, "Sequence Alignment Rotation Orthogonality", `Max diff: ${orthErr_nw.toExponential(4)}`);
  assert(Math.abs(det_nw - 1.0) < 1e-10, "Sequence Alignment Determinant = 1.0", `det(R): ${det_nw.toFixed(8)}`);

  // -----------------------------------------------------------------
  // 6. BENCHMARK & EXECUTION LATENCY LOGGING
  // -----------------------------------------------------------------
  console.log("\n--- 6. Performance Benchmarking & Latency ---");

  const ITERATIONS = 1000;
  const startPerf = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    calculateKabsch(pointsA, pointsB);
  }
  const endPerf = performance.now();
  const totalMs = endPerf - startPerf;
  const avgMs = totalMs / ITERATIONS;

  console.log(`  Iterations:           ${ITERATIONS}`);
  console.log(`  Total Execution Time: ${totalMs.toFixed(2)} ms`);
  console.log(`  Average Latency:      ${(avgMs * 1000).toFixed(2)} µs per alignment`);

  assert(avgMs < 1.0, "Execution Latency < 1ms per alignment", `Latency: ${(avgMs * 1000).toFixed(2)} µs`);

  // -----------------------------------------------------------------
  // SUMMARY
  // -----------------------------------------------------------------
  console.log("\n==========================================================");
  console.log(`SUMMARY: Passed ${passedTests}/${totalTests} tests.`);
  console.log("==========================================================");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests();
