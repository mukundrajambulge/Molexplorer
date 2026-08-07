import fs from 'fs';
import path from 'path';

// Mock 3Dmol globals for Node tsx environment
const $3Dmol = { Parsers: { mmtf: () => [] } };
(global as any).$3Dmol = $3Dmol;

import { calculateInteractions, Interaction } from '../src/lib/Interactions';

interface TestCase {
  id: string;
  category: 'hbond' | 'saltbridge' | 'pistacking' | 'cationpi';
  description: string;
  literatureRef: string;
  literatureThresholds: string;
  implementedThresholds: string;
  expectedResult: boolean;
  receptorPDB: string;
  ligandPDB: string;
}

function makeAtomLine(
  record: 'ATOM  ' | 'HETATM',
  serial: number,
  name: string,
  resName: string,
  chainID: string,
  resSeq: number,
  x: number,
  y: number,
  z: number,
  elem: string
): string {
  const serialStr = serial.toString().padStart(5, ' ');
  const nameStr = name.padEnd(4, ' ').substring(0, 4);
  const resNameStr = resName.padStart(3, ' ').substring(0, 3);
  const chainStr = chainID.substring(0, 1);
  const resSeqStr = resSeq.toString().padStart(4, ' ');
  const xStr = x.toFixed(3).padStart(8, ' ');
  const yStr = y.toFixed(3).padStart(8, ' ');
  const zStr = z.toFixed(3).padStart(8, ' ');
  const elemStr = elem.padStart(2, ' ').substring(0, 2);
  return `${record}${serialStr} ${nameStr} ${resNameStr} ${chainStr}${resSeqStr}    ${xStr}${yStr}${zStr}  1.00  0.00          ${elemStr}`;
}

// Generate PDB for a standard PHE ring with centroid at target location and specified X-rotation around centroid
function makePheRingPDB(chainID: string, resSeq: number, centroidTarget: { x: number; y: number; z: number }, rotateXDeg = 0): string {
  const rad = (rotateXDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Standard benzene ring atoms centered at local centroid (0, 0, 0)
  const baseAtoms = [
    { name: 'N', elem: 'N', x: 0, y: -2.5, z: 0 },
    { name: 'CA', elem: 'C', x: 0, y: -1.5, z: 0 },
    { name: 'CB', elem: 'C', x: 0, y: -0.8, z: 0 },
    { name: 'CG', elem: 'C', x: 0, y: -1.39, z: 0 },
    { name: 'CD1', elem: 'C', x: 1.204, y: -0.695, z: 0 },
    { name: 'CD2', elem: 'C', x: -1.204, y: -0.695, z: 0 },
    { name: 'CE1', elem: 'C', x: 1.204, y: 0.695, z: 0 },
    { name: 'CE2', elem: 'C', x: -1.204, y: 0.695, z: 0 },
    { name: 'CZ', elem: 'C', x: 0, y: 1.39, z: 0 },
  ];

  let pdb = '';
  let serial = 1;
  for (const a of baseAtoms) {
    // Rotation around local centroid (0,0,0)
    const yRot = a.y * cos - a.z * sin;
    const zRot = a.y * sin + a.z * cos;

    const x = a.x + centroidTarget.x;
    const y = yRot + centroidTarget.y;
    const z = zRot + centroidTarget.z;

    pdb += makeAtomLine('ATOM  ', serial++, a.name, 'PHE', chainID, resSeq, x, y, z, a.elem) + '\n';
  }
  return pdb;
}

// Generate PDB for TYR ring centered at target location
function makeTyrRingPDB(chainID: string, resSeq: number, centroidTarget: { x: number; y: number; z: number }, rotateXDeg = 0): string {
  const rad = (rotateXDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const baseAtoms = [
    { name: 'N', elem: 'N', x: 0, y: -2.5, z: 0 },
    { name: 'CA', elem: 'C', x: 0, y: -1.5, z: 0 },
    { name: 'CB', elem: 'C', x: 0, y: -0.8, z: 0 },
    { name: 'CG', elem: 'C', x: 0, y: -1.39, z: 0 },
    { name: 'CD1', elem: 'C', x: 1.204, y: -0.695, z: 0 },
    { name: 'CD2', elem: 'C', x: -1.204, y: -0.695, z: 0 },
    { name: 'CE1', elem: 'C', x: 1.204, y: 0.695, z: 0 },
    { name: 'CE2', elem: 'C', x: -1.204, y: 0.695, z: 0 },
    { name: 'CZ', elem: 'C', x: 0, y: 1.39, z: 0 },
    { name: 'OH', elem: 'O', x: 0, y: 2.75, z: 0 },
  ];

  let pdb = '';
  let serial = 1;
  for (const a of baseAtoms) {
    const yRot = a.y * cos - a.z * sin;
    const zRot = a.y * sin + a.z * cos;

    const x = a.x + centroidTarget.x;
    const y = yRot + centroidTarget.y;
    const z = zRot + centroidTarget.z;

    pdb += makeAtomLine('ATOM  ', serial++, a.name, 'TYR', chainID, resSeq, x, y, z, a.elem) + '\n';
  }
  return pdb;
}

// Construct test cases
function createTestCases(): TestCase[] {
  const cases: TestCase[] = [
    // -------------------------------------------------------------------------
    // 1. HYDROGEN BONDS
    // Literature: Baker & Hubbard (1984); Jeffrey (1997); PLIP (Salentin 2015)
    // Criteria: D...A dist 2.5 - 3.5 Å, angle D-H...A >= 120°
    // -------------------------------------------------------------------------
    {
      id: 'HB-01',
      category: 'hbond',
      description: 'Ideal backbone N-H...O Hydrogen Bond (2.8Å dist, 180° angle)',
      literatureRef: 'Baker & Hubbard (1984) Prog. Biophys. Mol. Biol. 44:97-179; Jeffrey (1997)',
      literatureThresholds: 'D...A dist: 2.5-3.5Å; Angle D-H...A >= 120°',
      implementedThresholds: 'd in [2.5, 3.5]Å; polar elements (N,O,S); D-H...A angle >= 120°',
      expectedResult: true,
      receptorPDB: [
        makeAtomLine('ATOM  ', 1, 'CA  ', 'ALA', 'A', 1, 0.0, -1.4, 0.0, 'C'),
        makeAtomLine('ATOM  ', 2, 'N   ', 'ALA', 'A', 1, 0.0, 0.0, 0.0, 'N'),
        makeAtomLine('ATOM  ', 3, 'H   ', 'ALA', 'A', 1, 1.01, 0.0, 0.0, 'H'),
      ].join('\n'),
      ligandPDB: [
        makeAtomLine('ATOM  ', 1, 'O   ', 'LIG', 'B', 1, 2.8, 0.0, 0.0, 'O'),
      ].join('\n'),
    },
    {
      id: 'HB-02',
      category: 'hbond',
      description: 'H-Bond with distance too long (3.8Å > 3.5Å threshold)',
      literatureRef: 'Baker & Hubbard (1984); Jeffrey (1997)',
      literatureThresholds: 'D...A dist <= 3.5Å',
      implementedThresholds: 'd in [2.5, 3.5]Å',
      expectedResult: false,
      receptorPDB: [
        makeAtomLine('ATOM  ', 1, 'N   ', 'ALA', 'A', 1, 0.0, 0.0, 0.0, 'N'),
        makeAtomLine('ATOM  ', 2, 'H   ', 'ALA', 'A', 1, 1.01, 0.0, 0.0, 'H'),
      ].join('\n'),
      ligandPDB: [
        makeAtomLine('ATOM  ', 1, 'O   ', 'LIG', 'B', 1, 3.8, 0.0, 0.0, 'O'),
      ].join('\n'),
    },
    {
      id: 'HB-03',
      category: 'hbond',
      description: 'H-Bond with distance too short (2.1Å < 2.5Å threshold)',
      literatureRef: 'Jeffrey (1997); PLIP (2015)',
      literatureThresholds: 'D...A dist >= 2.5Å',
      implementedThresholds: 'd in [2.5, 3.5]Å',
      expectedResult: false,
      receptorPDB: [
        makeAtomLine('ATOM  ', 1, 'N   ', 'ALA', 'A', 1, 0.0, 0.0, 0.0, 'N'),
        makeAtomLine('ATOM  ', 2, 'H   ', 'ALA', 'A', 1, 0.80, 0.0, 0.0, 'H'),
      ].join('\n'),
      ligandPDB: [
        makeAtomLine('ATOM  ', 1, 'O   ', 'LIG', 'B', 1, 2.1, 0.0, 0.0, 'O'),
      ].join('\n'),
    },
    {
      id: 'HB-04',
      category: 'hbond',
      description: 'Non-polar pair (C-H...C) at 3.0Å distance (non-hbond)',
      literatureRef: 'Baker & Hubbard (1984)',
      literatureThresholds: 'Must involve electronegative polar atoms (N, O, S)',
      implementedThresholds: 'isLpolar && isRpolar (N, O, S)',
      expectedResult: false,
      receptorPDB: [
        makeAtomLine('ATOM  ', 1, 'CA  ', 'ALA', 'A', 1, 0.0, 0.0, 0.0, 'C'),
        makeAtomLine('ATOM  ', 2, 'HA  ', 'ALA', 'A', 1, 1.0, 0.0, 0.0, 'H'),
      ].join('\n'),
      ligandPDB: [
        makeAtomLine('ATOM  ', 1, 'C1  ', 'LIG', 'B', 1, 3.0, 0.0, 0.0, 'C'),
      ].join('\n'),
    },

    // -------------------------------------------------------------------------
    // 2. SALT BRIDGES
    // Literature: Barlow & Thornton (1983) J. Mol. Biol.; Kumar & Nussinov (2002)
    // Criteria: Distance <= 4.0 Å between cationic N (Lys/Arg/His) and anionic O (Asp/Glu)
    // -------------------------------------------------------------------------
    {
      id: 'SB-01',
      category: 'saltbridge',
      description: 'Lys NZ ... Asp OD1 Salt Bridge (3.8Å distance - avoids H-bond 3.5Å overlap)',
      literatureRef: 'Barlow & Thornton (1983) JMB 168:867; Kumar & Nussinov (2002)',
      literatureThresholds: 'Distance(cationic N ... anionic O) <= 4.0Å',
      implementedThresholds: 'd <= 4.0Å; basicResidues & basicAtoms vs acidicResidues & acidicAtoms',
      expectedResult: true,
      receptorPDB: [
        makeAtomLine('ATOM  ', 1, 'NZ  ', 'LYS', 'A', 10, 0.0, 0.0, 0.0, 'N'),
      ].join('\n'),
      ligandPDB: [
        makeAtomLine('ATOM  ', 1, 'OD1 ', 'ASP', 'B', 20, 3.8, 0.0, 0.0, 'O'),
      ].join('\n'),
    },
    {
      id: 'SB-02',
      category: 'saltbridge',
      description: 'Arg NH1 ... Glu OE1 Salt Bridge (3.7Å distance)',
      literatureRef: 'Barlow & Thornton (1983); Kumar & Nussinov (2002)',
      literatureThresholds: 'Distance <= 4.0Å',
      implementedThresholds: 'd <= 4.0Å',
      expectedResult: true,
      receptorPDB: [
        makeAtomLine('ATOM  ', 1, 'NH1 ', 'ARG', 'A', 15, 0.0, 0.0, 0.0, 'N'),
      ].join('\n'),
      ligandPDB: [
        makeAtomLine('ATOM  ', 1, 'OE1 ', 'GLU', 'B', 25, 3.7, 0.0, 0.0, 'O'),
      ].join('\n'),
    },
    {
      id: 'SB-03',
      category: 'saltbridge',
      description: 'Salt Bridge pair with distance too large (4.5Å > 4.0Å)',
      literatureRef: 'Barlow & Thornton (1983)',
      literatureThresholds: 'Distance <= 4.0Å',
      implementedThresholds: 'd <= 4.0Å',
      expectedResult: false,
      receptorPDB: [
        makeAtomLine('ATOM  ', 1, 'NZ  ', 'LYS', 'A', 10, 0.0, 0.0, 0.0, 'N'),
      ].join('\n'),
      ligandPDB: [
        makeAtomLine('ATOM  ', 1, 'OD1 ', 'ASP', 'B', 20, 4.5, 0.0, 0.0, 'O'),
      ].join('\n'),
    },
    {
      id: 'SB-04',
      category: 'saltbridge',
      description: 'Non-charged polar pair (Ser OG ... Asp OD1 at 3.8Å)',
      literatureRef: 'Barlow & Thornton (1983); Kumar & Nussinov (2002)',
      literatureThresholds: 'Requires basic cationic N and acidic anionic O',
      implementedThresholds: 'Must match basic & acidic residue/atom definitions',
      expectedResult: false,
      receptorPDB: [
        makeAtomLine('ATOM  ', 1, 'OG  ', 'SER', 'A', 12, 0.0, 0.0, 0.0, 'O'),
      ].join('\n'),
      ligandPDB: [
        makeAtomLine('ATOM  ', 1, 'OD1 ', 'ASP', 'B', 20, 3.8, 0.0, 0.0, 'O'),
      ].join('\n'),
    },

    // -------------------------------------------------------------------------
    // 3. PI-PI STACKING
    // Literature: Hunter & Sanders (1990) JACS; McGaughey et al. (1998) JBC; PLIP
    // Criteria: Centroid dist 3.3 - 5.5 Å; Normal angle theta <= 30° (parallel) OR theta >= 60° (T-shaped)
    // -------------------------------------------------------------------------
    {
      id: 'PS-01',
      category: 'pistacking',
      description: 'Parallel Face-to-Face Pi-Stacking (Phe-Tyr, 3.8Å centroid dist, theta = 0°)',
      literatureRef: 'Hunter & Sanders (1990) JACS 112:5525; McGaughey (1998); PLIP',
      literatureThresholds: 'Centroid dist 3.3-5.5Å; angle theta <= 30° (parallel) or >= 60° (T-shaped)',
      implementedThresholds: 'd in [3.3, 5.5]Å; theta <= 30.0° or theta >= 60.0°',
      expectedResult: true,
      receptorPDB: makePheRingPDB('A', 1, { x: 0, y: 0, z: 0 }, 0),
      ligandPDB: makeTyrRingPDB('B', 1, { x: 0, y: 0, z: 3.8 }, 0),
    },
    {
      id: 'PS-02',
      category: 'pistacking',
      description: 'T-Shaped Edge-to-Face Pi-Stacking (Phe-Tyr, 4.8Å centroid dist, theta = 90°)',
      literatureRef: 'Hunter & Sanders (1990); McGaughey (1998)',
      literatureThresholds: 'Centroid dist 3.3-5.5Å; theta >= 60°',
      implementedThresholds: 'd in [3.3, 5.5]Å; theta >= 60.0°',
      expectedResult: true,
      receptorPDB: makePheRingPDB('A', 1, { x: 0, y: 0, z: 0 }, 0),
      ligandPDB: makeTyrRingPDB('B', 1, { x: 0, y: 0, z: 4.8 }, 90),
    },
    {
      id: 'PS-03',
      category: 'pistacking',
      description: 'Oblique Ring Angle (45° between normals, 4.2Å dist - dead zone 30°-60°)',
      literatureRef: 'Hunter & Sanders (1990); McGaughey (1998)',
      literatureThresholds: 'Excluded non-stacking geometry (30° < theta < 60°)',
      implementedThresholds: 'theta <= 30° or theta >= 60° (excludes 30°-60°)',
      expectedResult: false,
      receptorPDB: makePheRingPDB('A', 1, { x: 0, y: 0, z: 0 }, 0),
      ligandPDB: makeTyrRingPDB('B', 1, { x: 0, y: 0, z: 4.2 }, 45),
    },
    {
      id: 'PS-04',
      category: 'pistacking',
      description: 'Pi-Stacking rings too far apart (6.0Å > 5.5Å threshold)',
      literatureRef: 'Hunter & Sanders (1990)',
      literatureThresholds: 'Centroid dist <= 5.5Å',
      implementedThresholds: 'd in [3.3, 5.5]Å',
      expectedResult: false,
      receptorPDB: makePheRingPDB('A', 1, { x: 0, y: 0, z: 0 }, 0),
      ligandPDB: makeTyrRingPDB('B', 1, { x: 0, y: 0, z: 6.0 }, 0),
    },

    // -------------------------------------------------------------------------
    // 4. CATION-PI INTERACTIONS
    // Literature: Gallivan & Dougherty (1999) PNAS; Ma & Dougherty (1997) Chem. Rev.; PLIP
    // Criteria: Centroid-Cation dist <= 6.0 Å; Offset angle from normal alpha <= 45°
    // -------------------------------------------------------------------------
    {
      id: 'CP-01',
      category: 'cationpi',
      description: 'Lys NZ Cation over Phe Ring (4.5Å dist, angle 0° from normal)',
      literatureRef: 'Gallivan & Dougherty (1999) PNAS 96:9459; Ma & Dougherty (1997); PLIP',
      literatureThresholds: 'Centroid-Cation dist <= 6.0Å; Offset angle <= 45°',
      implementedThresholds: 'd <= 6.0Å; angle from ring normal <= 45.0°',
      expectedResult: true,
      receptorPDB: makePheRingPDB('A', 1, { x: 0, y: 0, z: 0 }, 0),
      ligandPDB: [
        makeAtomLine('ATOM  ', 1, 'NZ  ', 'LYS', 'B', 10, 0.0, 0.0, 4.5, 'N'),
      ].join('\n'),
    },
    {
      id: 'CP-02',
      category: 'cationpi',
      description: 'Metal Cation (MG) over Tyr Ring (5.0Å dist, offset angle ~ 21°)',
      literatureRef: 'Gallivan & Dougherty (1999); PLIP (2015)',
      literatureThresholds: 'Dist <= 6.0Å; Offset angle <= 45°',
      implementedThresholds: 'd <= 6.0Å; angle <= 45°',
      expectedResult: true,
      receptorPDB: makeTyrRingPDB('A', 1, { x: 0, y: 0, z: 0 }, 0),
      ligandPDB: [
        makeAtomLine('HETATM', 1, 'MG  ', 'MG ', 'B', 90, 0.0, 1.79, 4.67, 'MG'),
      ].join('\n'),
    },
    {
      id: 'CP-03',
      category: 'cationpi',
      description: 'Cation in Ring Plane / Large Offset Angle (75° > 45° threshold)',
      literatureRef: 'Gallivan & Dougherty (1999); Ma & Dougherty (1997)',
      literatureThresholds: 'Requires cation positioned over ring face (offset angle <= 45°)',
      implementedThresholds: 'angle <= 45.0° (fails when cation is in-plane)',
      expectedResult: false,
      receptorPDB: makePheRingPDB('A', 1, { x: 0, y: 0, z: 0 }, 0),
      ligandPDB: [
        makeAtomLine('ATOM  ', 1, 'NZ  ', 'LYS', 'B', 10, 4.35, 0.0, 1.16, 'N'),
      ].join('\n'),
    },
    {
      id: 'CP-04',
      category: 'cationpi',
      description: 'Cation too far from ring (7.0Å > 6.0Å threshold)',
      literatureRef: 'Gallivan & Dougherty (1999)',
      literatureThresholds: 'Centroid-Cation dist <= 6.0Å',
      implementedThresholds: 'd <= 6.0Å',
      expectedResult: false,
      receptorPDB: makePheRingPDB('A', 1, { x: 0, y: 0, z: 0 }, 0),
      ligandPDB: [
        makeAtomLine('ATOM  ', 1, 'NZ  ', 'LYS', 'B', 10, 0.0, 0.0, 7.0, 'N'),
      ].join('\n'),
    },
  ];

  return cases;
}

// Run single test case and return evaluation
function evaluateTestCase(tc: TestCase) {
  const startTime = performance.now();
  const interactions = calculateInteractions(tc.receptorPDB, tc.ligandPDB);
  const durationMs = performance.now() - startTime;

  const foundTargetInteraction = interactions.some(i => i.type === tc.category);
  const isCorrect = foundTargetInteraction === tc.expectedResult;

  return {
    id: tc.id,
    category: tc.category,
    description: tc.description,
    literatureRef: tc.literatureRef,
    literatureThresholds: tc.literatureThresholds,
    implementedThresholds: tc.implementedThresholds,
    expectedResult: tc.expectedResult,
    detectedResult: foundTargetInteraction,
    detectedInteractions: interactions,
    isCorrect,
    durationMs,
  };
}

// Main execution
function main() {
  console.log('='.repeat(90));
  console.log('       BIO-PHYSICAL INTERACTION THRESHOLD VERIFICATION & PERFORMANCE BENCHMARK');
  console.log('       Target: src/lib/Interactions.ts against Structural Biology Literature');
  console.log('='.repeat(90));
  console.log(`Execution Timestamp: ${new Date().toISOString()}`);
  console.log();

  const testCases = createTestCases();
  const results = testCases.map(evaluateTestCase);

  // Group metrics by category
  const categories = ['hbond', 'saltbridge', 'pistacking', 'cationpi'] as const;
  const categoryNames: Record<string, string> = {
    hbond: 'Hydrogen Bonds',
    saltbridge: 'Salt Bridges',
    pistacking: 'Pi-Pi Stacking',
    cationpi: 'Cation-Pi Interactions',
  };

  let totalTP = 0, totalFP = 0, totalTN = 0, totalFN = 0;
  let totalTimeMs = 0;

  console.log('--- INDIVIDUAL TEST CASE RESULTS ---');
  results.forEach(r => {
    totalTimeMs += r.durationMs;
    const status = r.isCorrect ? '[PASS]' : '[FAIL]';
    console.log(`${status} ${r.id} (${r.category.toUpperCase()}): ${r.description}`);
    console.log(`      Lit Ref: ${r.literatureRef}`);
    console.log(`      Lit Thresholds: ${r.literatureThresholds}`);
    console.log(`      Impl Thresholds: ${r.implementedThresholds}`);
    console.log(`      Expected: ${r.expectedResult} | Detected: ${r.detectedResult} | Time: ${r.durationMs.toFixed(3)} ms`);
    if (r.detectedInteractions.length > 0) {
      r.detectedInteractions.forEach(i => {
        console.log(`      -> Detected ${i.type}: ${i.atom1.resName} ${i.atom1.name} <-> ${i.atom2.resName} ${i.atom2.name} (d=${i.distance.toFixed(2)}Å)`);
      });
    }
    console.log();

    if (r.expectedResult && r.detectedResult) totalTP++;
    else if (!r.expectedResult && r.detectedResult) totalFP++;
    else if (!r.expectedResult && !r.detectedResult) totalTN++;
    else if (r.expectedResult && !r.detectedResult) totalFN++;
  });

  console.log('='.repeat(90));
  console.log('--- CATEGORY BREAKDOWN & LITERATURE ALIGNMENT ---');
  console.log('='.repeat(90));

  categories.forEach(cat => {
    const catResults = results.filter(r => r.category === cat);
    const catTP = catResults.filter(r => r.expectedResult && r.detectedResult).length;
    const catFP = catResults.filter(r => !r.expectedResult && r.detectedResult).length;
    const catTN = catResults.filter(r => !r.expectedResult && !r.detectedResult).length;
    const catFN = catResults.filter(r => r.expectedResult && !r.detectedResult).length;
    const catAcc = (catResults.filter(r => r.isCorrect).length / catResults.length) * 100;
    const catAvgTime = catResults.reduce((acc, r) => acc + r.durationMs, 0) / catResults.length;

    console.log(`Category: ${categoryNames[cat].toUpperCase()}`);
    console.log(`  Tests Count: ${catResults.length} | Accuracy: ${catAcc.toFixed(1)}% | Avg Speed: ${catAvgTime.toFixed(3)} ms/test`);
    console.log(`  Confusion Matrix: TP=${catTP}, TN=${catTN}, FP=${catFP}, FN=${catFN}`);
    console.log();
  });

  // Overall metrics
  const totalTests = results.length;
  const accuracy = ((totalTP + totalTN) / totalTests) * 100;
  const precision = totalTP + totalFP > 0 ? (totalTP / (totalTP + totalFP)) * 100 : 100;
  const recall = totalTP + totalFN > 0 ? (totalTP / (totalTP + totalFN)) * 100 : 100;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  console.log('='.repeat(90));
  console.log('--- OVERALL ACCURACY METRICS ---');
  console.log('='.repeat(90));
  console.log(`Total Test Cases: ${totalTests}`);
  console.log(`True Positives (TP):  ${totalTP}`);
  console.log(`True Negatives (TN):  ${totalTN}`);
  console.log(`False Positives (FP): ${totalFP}`);
  console.log(`False Negatives (FN): ${totalFN}`);
  console.log(`Accuracy:             ${accuracy.toFixed(2)}%`);
  console.log(`Precision:            ${precision.toFixed(2)}%`);
  console.log(`Recall:               ${recall.toFixed(2)}%`);
  console.log(`F1-Score:             ${f1.toFixed(2)}%`);
  console.log();

  // Benchmark speed on real PDB structure (1HVR.pdb) if available
  console.log('='.repeat(90));
  console.log('--- REAL-WORLD PDB BENCHMARK & THROUGHPUT TEST ---');
  console.log('='.repeat(90));

  const pdbPath = path.join(process.cwd(), '1HVR.pdb');
  if (fs.existsSync(pdbPath)) {
    const pdbContent = fs.readFileSync(pdbPath, 'utf8');
    
    // Split 1HVR into Chain A (receptor) and Chain B (ligand)
    const lines = pdbContent.split('\n');
    const chainALines = lines.filter(l => (l.startsWith('ATOM') || l.startsWith('HETATM')) && l.substring(21, 22) === 'A');
    const chainBLines = lines.filter(l => (l.startsWith('ATOM') || l.startsWith('HETATM')) && l.substring(21, 22) === 'B');

    const chainAPDB = chainALines.join('\n');
    const chainBPDB = chainBLines.join('\n');

    console.log(`Loaded 1HVR.pdb: Chain A (${chainALines.length} atoms), Chain B (${chainBLines.length} atoms)`);

    // Warm-up run
    const warmUpInteractions = calculateInteractions(chainAPDB, chainBPDB);
    console.log(`Detected ${warmUpInteractions.length} total interactions in 1HVR Chain A vs Chain B:`);

    const typeCounts: Record<string, number> = {};
    warmUpInteractions.forEach(i => {
      typeCounts[i.type] = (typeCounts[i.type] || 0) + 1;
    });
    Object.entries(typeCounts).forEach(([type, count]) => {
      console.log(`  - ${type.toUpperCase()}: ${count}`);
    });

    // Benchmark loop: 50 iterations
    const iterations = 50;
    const benchStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      calculateInteractions(chainAPDB, chainBPDB);
    }
    const benchTotalMs = performance.now() - benchStart;
    const avgMsPerCall = benchTotalMs / iterations;
    const callsPerSec = 1000 / avgMsPerCall;
    const totalAtomPairsPerCall = chainALines.length * chainBLines.length;
    const atomPairsPerSec = (totalAtomPairsPerCall * iterations) / (benchTotalMs / 1000);

    console.log();
    console.log('Benchmark Execution Speed:');
    console.log(`  Iterations:             ${iterations}`);
    console.log(`  Total Benchmark Time:   ${benchTotalMs.toFixed(2)} ms`);
    console.log(`  Average Time / Call:    ${avgMsPerCall.toFixed(3)} ms`);
    console.log(`  Throughput (Calls/sec): ${callsPerSec.toFixed(2)} ops/sec`);
    console.log(`  Atom Pair Rate:         ${(atomPairsPerSec / 1e6).toFixed(2)} M pairs/sec`);
  } else {
    console.log('1HVR.pdb not found for real-world benchmark.');
  }

  console.log('='.repeat(90));
  console.log('VERIFICATION COMPLETE.');
  console.log('='.repeat(90));
}

main();
