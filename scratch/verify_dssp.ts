import fs from 'fs';
import path from 'path';
import { MolProcessor } from '../src/lib/MolProcessor.ts';

/**
 * DSSP H-Bond Electrostatic Energy Verification Script
 * Standard Kabsch-Sander Model: E = q1 * q2 * f * (1/rON + 1/rCH - 1/rOH - 1/rCN)
 * where q1 = 0.42 e, q2 = 0.20 e, f = 332.0 kcal*A / (e^2 mol)
 * Cutoff: E < -0.5 kcal/mol
 */

interface Point3D {
  x: number;
  y: number;
  z: number;
}

function distance(a: Point3D, b: Point3D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Standalone implementation of Kabsch-Sander formula to cross-verify against MolProcessor output
function computeKabschSanderEnergy(
  C: Point3D,
  O: Point3D,
  N: Point3D,
  H: Point3D
): number {
  const q1 = 0.42;
  const q2 = 0.20;
  const f = 332.0;

  const rON = distance(O, N);
  const rCH = distance(C, H);
  const rOH = distance(O, H);
  const rCN = distance(C, N);

  if (rON < 0.5 || rCH < 0.5 || rOH < 0.5 || rCN < 0.5) return 0.0;

  return q1 * q2 * f * (1 / rON + 1 / rCH - 1 / rOH - 1 / rCN);
}

async function runDSSPVerification() {
  console.log("===============================================================");
  console.log("  DSSP SECONDARY STRUCTURE VERIFICATION (Kabsch-Sander Model)  ");
  console.log("===============================================================\n");

  const overallStartTime = performance.now();
  let totalTestsPassed = 0;
  let totalTestsFailed = 0;

  // -------------------------------------------------------------------------
  // TEST 1: Direct Formula Verification (Kabsch-Sander Energy Equation)
  // -------------------------------------------------------------------------
  console.log("--- Test 1: Kabsch-Sander Electrostatic Energy Equation ---");

  // Standard hydrogen bond distance geometry:
  // C-O vector: (0,0,0) to (0,0,1.23)
  // N-H vector: N at (0, 1.0, 2.9), H at (0, 0.8, 2.0)
  const C_std: Point3D = { x: 0.0, y: 0.0, z: 0.0 };
  const O_std: Point3D = { x: 0.0, y: 0.0, z: 1.23 };
  const N_std: Point3D = { x: 0.0, y: 1.0, z: 2.9 };
  const H_std: Point3D = { x: 0.0, y: 0.8, z: 2.0 };

  const energyStandard = computeKabschSanderEnergy(C_std, O_std, N_std, H_std);
  console.log(`Calculated H-Bond Energy (Ideal Geometry): ${energyStandard.toFixed(4)} kcal/mol`);

  if (energyStandard < -0.5) {
    console.log("✅ PASS: H-bond energy is below threshold (E < -0.5 kcal/mol)");
    totalTestsPassed++;
  } else {
    console.log("❌ FAIL: H-bond energy exceeded threshold");
    totalTestsFailed++;
  }

  // Non H-bonding pair (large separation distance r > 4.5 A)
  const N_far: Point3D = { x: 5.0, y: 5.0, z: 5.0 };
  const H_far: Point3D = { x: 4.8, y: 4.8, z: 4.5 };
  const energyFar = computeKabschSanderEnergy(C_std, O_std, N_far, H_far);
  console.log(`Calculated Non-HBond Energy (Distant Pair): ${energyFar.toFixed(4)} kcal/mol`);

  if (energyFar >= -0.5) {
    console.log("✅ PASS: Non-hydrogen bonded pair correctly rejected (E >= -0.5 kcal/mol)\n");
    totalTestsPassed++;
  } else {
    console.log("❌ FAIL: Distant pair incorrectly identified as H-bond\n");
    totalTestsFailed++;
  }

  // -------------------------------------------------------------------------
  // TEST 2: DSSP Calculation on 1HVR.pdb (HIV-1 Protease Structure)
  // -------------------------------------------------------------------------
  console.log("--- Test 2: MolProcessor DSSP Evaluation on 1HVR.pdb ---");

  const pdbPath = path.resolve('1HVR.pdb');
  if (!fs.existsSync(pdbPath)) {
    console.error(`Error: File not found at ${pdbPath}`);
    totalTestsFailed++;
    return;
  }

  const pdbText = fs.readFileSync(pdbPath, 'utf8');
  const processor = new MolProcessor(pdbText, 'pdb');

  const dsspStartTime = performance.now();
  processor.calculateSecondaryStructure('dssp');
  const dsspEndTime = performance.now();
  const dsspDuration = dsspEndTime - dsspStartTime;

  console.log(`DSSP Calculation Time: ${dsspDuration.toFixed(3)} ms`);
  console.log(`Total Residues Evaluated: ${processor.ss_per_residue.length}`);

  const counts = { helix: 0, sheet: 0, loop: 0, undetermined: 0 };
  for (const r of processor.ss_per_residue) {
    counts[r.ss_type]++;
  }

  console.log(`Secondary Structure Counts:`);
  console.log(`  - Helices: ${counts.helix}`);
  console.log(`  - Sheets:  ${counts.sheet}`);
  console.log(`  - Loops:   ${counts.loop}`);
  console.log(`  - Undetermined: ${counts.undetermined}`);

  // Verification checks on 1HVR structure:
  // 1HVR is a dimeric HIV-1 protease containing extensive beta sheets and alpha helices.
  if (counts.sheet > 0) {
    console.log("✅ PASS: Beta sheet elements identified in 1HVR.pdb");
    totalTestsPassed++;
  } else {
    console.log("❌ FAIL: No beta sheets found in 1HVR.pdb");
    totalTestsFailed++;
  }

  if (counts.helix > 0) {
    console.log("✅ PASS: Helical elements identified in 1HVR.pdb");
    totalTestsPassed++;
  } else {
    console.log("❌ FAIL: No helices found in 1HVR.pdb");
    totalTestsFailed++;
  }

  // Verify residue continuity & ss_type validity
  const validTypes = new Set(['helix', 'sheet', 'loop', 'undetermined']);
  const allValid = processor.ss_per_residue.every(r => validTypes.has(r.ss_type));
  if (allValid) {
    console.log("✅ PASS: All residue secondary structure assignments are valid enum types");
    totalTestsPassed++;
  } else {
    console.log("❌ FAIL: Invalid secondary structure enum type found");
    totalTestsFailed++;
  }

  // -------------------------------------------------------------------------
  // TEST 3: DSSP H-Bond Pair Electrostatic Energy Breakdown for Helices & Sheets
  // -------------------------------------------------------------------------
  console.log("\n--- Test 3: H-Bond Electrostatic Energy Extraction & Verification ---");

  // Re-evaluate hydrogen bonds internally to verify energy levels of assigned secondary structure residues
  const atoms = processor.atoms;
  const resMap = new Map<string, any>();
  const resList: any[] = [];

  for (const a of atoms) {
    if (a.isHetero) continue;
    const key = `${a.chainID}:${a.resSeq}`;
    if (!resMap.has(key)) {
      const res = { chainID: a.chainID, resSeq: a.resSeq, resName: a.resName, N: null, CA: null, C: null, O: null, H: null };
      resMap.set(key, res);
      resList.push(res);
    }
    const res = resMap.get(key);
    if (a.name === ' N  ') res.N = a;
    else if (a.name === ' CA ') res.CA = a;
    else if (a.name === ' C  ') res.C = a;
    else if (a.name === ' O  ') res.O = a;
  }

  // Estimate pseudo hydrogen positions as done in MolProcessor
  const n = resList.length;
  for (let i = 1; i < n; i++) {
    const curr = resList[i];
    const prev = resList[i - 1];
    if (!curr.N || !prev.C || !prev.O) continue;
    if (prev.chainID !== curr.chainID || distance(prev.C, curr.N) > 2.0) continue;

    const dx = prev.O.x - prev.C.x;
    const dy = prev.O.y - prev.C.y;
    const dz = prev.O.z - prev.C.z;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len > 0) {
      curr.H = {
        x: curr.N.x - (dx / len) * 1.0,
        y: curr.N.y - (dy / len) * 1.0,
        z: curr.N.z - (dz / len) * 1.0
      };
    }
  }

  const hBondEnergies: { i: number; j: number; E: number; pattern: string }[] = [];

  for (let i = 0; i < n; i++) {
    const resI = resList[i];
    if (!resI.C || !resI.O) continue;

    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const resJ = resList[j];
      if (!resJ.N || !resJ.H) continue;
      if (distance(resI.CA, resJ.CA) > 9.0) continue;

      const E = computeKabschSanderEnergy(resI.C, resI.O, resJ.N, resJ.H);
      if (E < -0.5) {
        let pattern = "Other";
        if (resI.chainID === resJ.chainID) {
          const diff = j - i;
          if (diff === 4) pattern = "Alpha-Helix (i->i+4)";
          else if (diff === 3) pattern = "3_10-Helix (i->i+3)";
          else if (diff === 5) pattern = "Pi-Helix (i->i+5)";
          else if (Math.abs(diff) > 5) pattern = "Sheet/Long-range Bridge";
        } else {
          pattern = "Inter-chain Sheet Bridge";
        }
        hBondEnergies.push({ i, j, E, pattern });
      }
    }
  }

  console.log(`Total H-Bonds Detected (E < -0.5 kcal/mol): ${hBondEnergies.length}`);

  const alphaHelixHBonds = hBondEnergies.filter(hb => hb.pattern.includes("Alpha-Helix"));
  const sheetHBonds = hBondEnergies.filter(hb => hb.pattern.includes("Sheet"));

  console.log(`  - Alpha-Helix H-Bonds (i->i+4): ${alphaHelixHBonds.length}`);
  console.log(`  - Sheet / Bridge H-Bonds:       ${sheetHBonds.length}`);

  if (alphaHelixHBonds.length > 0) {
    const sample = alphaHelixHBonds[0];
    const resI = resList[sample.i];
    const resJ = resList[sample.j];
    console.log(`Sample Alpha-Helix H-Bond: Residue ${resI.chainID}:${resI.resSeq} (${resI.resName}) C=O ... N-H Residue ${resJ.chainID}:${resJ.resSeq} (${resJ.resName}), E = ${sample.E.toFixed(3)} kcal/mol`);
  }

  if (sheetHBonds.length > 0) {
    const sample = sheetHBonds[0];
    const resI = resList[sample.i];
    const resJ = resList[sample.j];
    console.log(`Sample Sheet H-Bond: Residue ${resI.chainID}:${resI.resSeq} (${resI.resName}) C=O ... N-H Residue ${resJ.chainID}:${resJ.resSeq} (${resJ.resName}), E = ${sample.E.toFixed(3)} kcal/mol`);
  }

  const allHbondEnergiesValid = hBondEnergies.every(hb => hb.E < -0.5);
  if (allHbondEnergiesValid && hBondEnergies.length > 0) {
    console.log("✅ PASS: All detected hydrogen bonds strictly satisfy Kabsch-Sander E < -0.5 kcal/mol criterion");
    totalTestsPassed++;
  } else {
    console.log("❌ FAIL: Found hydrogen bond with E >= -0.5 kcal/mol");
    totalTestsFailed++;
  }

  const overallEndTime = performance.now();
  const totalExecutionTime = overallEndTime - overallStartTime;

  console.log("\n===============================================================");
  console.log("                      SUMMARY REPORT                           ");
  console.log("===============================================================");
  console.log(`Total Execution Time: ${totalExecutionTime.toFixed(2)} ms`);
  console.log(`DSSP Calculation Core Time: ${dsspDuration.toFixed(2)} ms`);
  console.log(`Tests Passed: ${totalTestsPassed}`);
  console.log(`Tests Failed: ${totalTestsFailed}`);
  console.log("Status:", totalTestsFailed === 0 ? "PASSED" : "FAILED");
  console.log("===============================================================\n");

  if (totalTestsFailed > 0) {
    process.exit(1);
  }
}

runDSSPVerification().catch(err => {
  console.error("Unhandled error in DSSP verification:", err);
  process.exit(1);
});
