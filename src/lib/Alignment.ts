import { formatAtomLine } from "./MolProcessor";
import { Matrix, SingularValueDecomposition, determinant } from 'ml-matrix';
import { Atom } from './MolProcessor';

export interface AlignmentResult {
  rmsd: number;
  rotation: number[][];
  translation: number[];
  alignedAtomsB: Atom[]; 
  alignedPdbB: string; 
  atomPairsCount: number;
}

const aminoAcid3To1: Record<string, string> = {
  ALA: 'A', ARG: 'R', ASN: 'N', ASP: 'D', CYS: 'C',
  GLN: 'Q', GLU: 'E', GLY: 'G', HIS: 'H', ILE: 'I',
  LEU: 'L', LYS: 'K', MET: 'M', PHE: 'F', PRO: 'P',
  SER: 'S', THR: 'T', TRP: 'W', TYR: 'Y', VAL: 'V',
  ASX: 'B', GLX: 'Z', SEC: 'U', PYL: 'O', UNK: 'X'
};

const blosum62: Record<string, Record<string, number>> = {
  A: { A:4, R:-1, N:-2, D:-2, C:0, Q:-1, E:-1, G:0, H:-2, I:-1, L:-1, K:-1, M:-1, F:-2, P:-1, S:1, T:0, W:-3, Y:-2, V:0, B:-2, Z:-1, X:0 },
  R: { A:-1, R:5, N:0, D:-2, C:-3, Q:1, E:0, G:-2, H:0, I:-3, L:-2, K:2, M:-1, F:-3, P:-2, S:-1, T:-1, W:-3, Y:-2, V:-3, B:-1, Z:0, X:0 },
  N: { A:-2, R:0, N:6, D:1, C:-3, Q:0, E:0, G:0, H:1, I:-3, L:-3, K:0, M:-2, F:-3, P:-2, S:1, T:0, W:-4, Y:-3, V:-3, B:3, Z:0, X:0 },
  D: { A:-2, R:-2, N:1, D:6, C:-3, Q:0, E:2, G:-1, H:-1, I:-3, L:-4, K:-1, M:-3, F:-3, P:-1, S:0, T:-1, W:-4, Y:-3, V:-3, B:4, Z:1, X:0 },
  C: { A:0, R:-3, N:-3, D:-3, C:9, Q:-3, E:-4, G:-3, H:-3, I:-1, L:-1, K:-3, M:-1, F:-2, P:-3, S:-1, T:-1, W:-2, Y:-2, V:-1, B:-3, Z:-3, X:0 },
  Q: { A:-1, R:1, N:0, D:0, C:-3, Q:5, E:2, G:-2, H:0, I:-3, L:-2, K:1, M:0, F:-3, P:-1, S:0, T:-1, W:-2, Y:-1, V:-2, B:0, Z:3, X:0 },
  E: { A:-1, R:0, N:0, D:2, C:-4, Q:2, E:5, G:-2, H:0, I:-3, L:-3, K:1, M:-2, F:-3, P:-1, S:-1, T:-1, W:-3, Y:-2, V:-2, B:1, Z:4, X:0 },
  G: { A:0, R:-2, N:0, D:-1, C:-3, Q:-2, E:-2, G:6, H:-2, I:-4, L:-4, K:-2, M:-3, F:-3, P:-2, S:0, T:-2, W:-2, Y:-3, V:-3, B:-1, Z:-2, X:0 },
  H: { A:-2, R:0, N:1, D:-1, C:-3, Q:0, E:0, G:-2, H:8, I:-3, L:-3, K:-1, M:-2, F:-1, P:-2, S:-1, T:-2, W:-2, Y:2, V:-3, B:0, Z:0, X:0 },
  I: { A:-1, R:-3, N:-3, D:-3, C:-1, Q:-3, E:-3, G:-4, H:-3, I:4, L:2, K:-3, M:1, F:0, P:-3, S:-2, T:-1, W:-3, Y:-1, V:3, B:-3, Z:-3, X:0 },
  L: { A:-1, R:-2, N:-3, D:-4, C:-1, Q:-2, E:-3, G:-4, H:-3, I:2, L:4, K:-2, M:2, F:0, P:-3, S:-2, T:-1, W:-2, Y:-1, V:1, B:-4, Z:-3, X:0 },
  K: { A:-1, R:2, N:0, D:-1, C:-3, Q:1, E:1, G:-2, H:-1, I:-3, L:-2, K:5, M:-1, F:-3, P:-1, S:0, T:-1, W:-3, Y:-2, V:-2, B:0, Z:1, X:0 },
  M: { A:-1, R:-1, N:-2, D:-3, C:-1, Q:0, E:-2, G:-3, H:-2, I:1, L:2, K:-1, M:5, F:0, P:-2, S:-1, T:-1, W:-1, Y:-1, V:1, B:-3, Z:-1, X:0 },
  F: { A:-2, R:-3, N:-3, D:-3, C:-2, Q:-3, E:-3, G:-3, H:-1, I:0, L:0, K:-3, M:0, F:6, P:-4, S:-2, T:-2, W:1, Y:3, V:-1, B:-3, Z:-3, X:0 },
  P: { A:-1, R:-2, N:-2, D:-1, C:-3, Q:-1, E:-1, G:-2, H:-2, I:-3, L:-3, K:-1, M:-2, F:-4, P:7, S:-1, T:-1, W:-4, Y:-3, V:-2, B:-2, Z:-1, X:0 },
  S: { A:1, R:-1, N:1, D:0, C:-1, Q:0, E:-1, G:0, H:-1, I:-2, L:-2, K:0, M:-1, F:-2, P:-1, S:4, T:1, W:-3, Y:-2, V:-2, B:0, Z:0, X:0 },
  T: { A:0, R:-1, N:0, D:-1, C:-1, Q:-1, E:-1, G:-2, H:-2, I:-1, L:-1, K:-1, M:-1, F:-2, P:-1, S:1, T:5, W:-2, Y:-2, V:0, B:-1, Z:-1, X:0 },
  W: { A:-3, R:-3, N:-4, D:-4, C:-2, Q:-2, E:-3, G:-2, H:-2, I:-3, L:-2, K:-3, M:-1, F:1, P:-4, S:-3, T:-2, W:11, Y:2, V:-3, B:-4, Z:-3, X:0 },
  Y: { A:-2, R:-2, N:-3, D:-3, C:-2, Q:-1, E:-2, G:-3, H:2, I:-1, L:-1, K:-2, M:-1, F:3, P:-4, S:-2, T:-2, W:2, Y:7, V:-1, B:-3, Z:-2, X:0 },
  V: { A:0, R:-3, N:-3, D:-3, C:-1, Q:-2, E:-2, G:-3, H:-3, I:3, L:1, K:-2, M:1, F:-1, P:-2, S:-2, T:0, W:-3, Y:-1, V:4, B:-3, Z:-2, X:0 },
  B: { A:-2, R:-1, N:3, D:4, C:-3, Q:0, E:1, G:-1, H:0, I:-3, L:-4, K:0, M:-3, F:-3, P:-2, S:0, T:-1, W:-4, Y:-3, V:-3, B:4, Z:1, X:0 },
  Z: { A:-1, R:0, N:0, D:1, C:-3, Q:3, E:4, G:-2, H:0, I:-3, L:-3, K:1, M:-1, F:-3, P:-1, S:0, T:-1, W:-3, Y:-2, V:-2, B:1, Z:4, X:0 },
  X: { A:0, R:0, N:0, D:0, C:0, Q:0, E:0, G:0, H:0, I:0, L:0, K:0, M:0, F:0, P:0, S:0, T:0, W:0, Y:0, V:0, B:0, Z:0, X:0 }
};

function getBlosum62Score(resA: string, resB: string): number {
  const codeA = aminoAcid3To1[resA.toUpperCase()] || 'X';
  const codeB = aminoAcid3To1[resB.toUpperCase()] || 'X';
  return blosum62[codeA][codeB] !== undefined ? blosum62[codeA][codeB] : 0;
}

export function calculateKabsch(coordsA: number[][], coordsB: number[][]) {
  const N = coordsA.length;
  if (N === 0 || coordsB.length !== N) {
    throw new Error("Coordinate arrays must have the same length and > 0");
  }

  let centroidA = [0, 0, 0];
  let centroidB = [0, 0, 0];
  
  for (let i = 0; i < N; i++) {
    centroidA[0] += coordsA[i][0]; centroidA[1] += coordsA[i][1]; centroidA[2] += coordsA[i][2];
    centroidB[0] += coordsB[i][0]; centroidB[1] += coordsB[i][1]; centroidB[2] += coordsB[i][2];
  }
  centroidA = centroidA.map(x => x / N);
  centroidB = centroidB.map(x => x / N);

  const centeredA = coordsA.map(p => [p[0] - centroidA[0], p[1] - centroidA[1], p[2] - centroidA[2]]);
  const centeredB = coordsB.map(p => [p[0] - centroidB[0], p[1] - centroidB[1], p[2] - centroidB[2]]);

  const matA = new Matrix(centeredA); // Q
  const matB = new Matrix(centeredB); // P

  // H = P^T * Q = matB^T * matA
  const H = matB.transpose().mmul(matA);

  const svd = new SingularValueDecomposition(H);
  const U = svd.leftSingularVectors;
  const V = svd.rightSingularVectors;

  const UVT = U.mmul(V.transpose());
  const d = Math.sign(determinant(UVT));

  const diag = Matrix.eye(3, 3);
  diag.set(2, 2, d);

  // R = U * diag(1, 1, d) * V^T
  const R = U.mmul(diag).mmul(V.transpose());

  return { R, centroidA, centroidB };
}

export function applyTransform(ptB: number[], R: Matrix, centroidA: number[], centroidB: number[]) {
  const cb = [ptB[0] - centroidB[0], ptB[1] - centroidB[1], ptB[2] - centroidB[2]];
  const rotated = [
    cb[0]*R.get(0,0) + cb[1]*R.get(1,0) + cb[2]*R.get(2,0),
    cb[0]*R.get(0,1) + cb[1]*R.get(1,1) + cb[2]*R.get(2,1),
    cb[0]*R.get(0,2) + cb[1]*R.get(1,2) + cb[2]*R.get(2,2)
  ];
  return [
    rotated[0] + centroidA[0],
    rotated[1] + centroidA[1],
    rotated[2] + centroidA[2]
  ];
}

function needlemanWunsch(seqA: Atom[], seqB: Atom[]) {
  const n = seqA.length;
  const m = seqB.length;
  const dp: number[][] = Array(n + 1).fill(0).map(() => Array(m + 1).fill(0));
  
  const gapPenalty = -4; // Linear gap penalty matching standard BLOSUM aligners

  for (let i = 1; i <= n; i++) dp[i][0] = i * gapPenalty;
  for (let j = 1; j <= m; j++) dp[0][j] = j * gapPenalty;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const matchScore = getBlosum62Score(seqA[i - 1].resName, seqB[j - 1].resName);
      const match = dp[i - 1][j - 1] + matchScore;
      const deleteA = dp[i - 1][j] + gapPenalty;
      const insertB = dp[i][j - 1] + gapPenalty;
      dp[i][j] = Math.max(match, deleteA, insertB);
    }
  }

  let i = n;
  let j = m;
  const pairs: [Atom, Atom][] = [];

  while (i > 0 && j > 0) {
    const current = dp[i][j];
    const matchScore = getBlosum62Score(seqA[i - 1].resName, seqB[j - 1].resName);
    if (current === dp[i - 1][j - 1] + matchScore) {
      pairs.push([seqA[i - 1], seqB[j - 1]]);
      i--;
      j--;
    } else if (current === dp[i - 1][j] + gapPenalty) {
      i--;
    } else {
      j--;
    }
  }
  return pairs.reverse();
}

export function alignStructures(atomsA: Atom[], atomsB: Atom[]): AlignmentResult {
  let pairs: [Atom, Atom][] = [];
  
  const isIdenticalTopology = atomsA.length === atomsB.length && atomsA.length > 0 && atomsA.every((a, i) => a.name === atomsB[i].name && a.elem === atomsB[i].elem);
  
  if (isIdenticalTopology) {
    for (let i = 0; i < atomsA.length; i++) {
      pairs.push([atomsA[i], atomsB[i]]);
    }
  } else {
    const caA = atomsA.filter(a => a.name.trim() === "CA");
    const caB = atomsB.filter(a => a.name.trim() === "CA");
    
    if (caA.length > 0 && caB.length > 0) {
      pairs = needlemanWunsch(caA, caB);
    }
    
    if (pairs.length < 3) {
      throw new Error("Could not find enough corresponding atoms for alignment. Found: " + pairs.length);
    }
  }

  // --- ITERATIVE OUTLIER REJECTION CYCLE (KABSCH FITTING) ---
  let activePairs = [...pairs];
  let R = Matrix.eye(3, 3);
  let centroidA = [0, 0, 0];
  let centroidB = [0, 0, 0];
  let rmsd = 0;
  
  const CYCLES = 5;
  const SIGMA_CUTOFF = 2.0;

  for (let cycle = 0; cycle < CYCLES; cycle++) {
    if (activePairs.length < 3) break;

    const coordsA = activePairs.map(p => [p[0].x, p[0].y, p[0].z]);
    const coordsB = activePairs.map(p => [p[1].x, p[1].y, p[1].z]);

    const fit = calculateKabsch(coordsA, coordsB);
    R = fit.R;
    centroidA = fit.centroidA;
    centroidB = fit.centroidB;

    // Calculate individual distances
    const distances: number[] = [];
    let sumSq = 0;
    for (let i = 0; i < activePairs.length; i++) {
      const ptB = coordsB[i];
      const transformed = applyTransform(ptB, R, centroidA, centroidB);
      const ptA = coordsA[i];
      const distSq = Math.pow(transformed[0] - ptA[0], 2) + Math.pow(transformed[1] - ptA[1], 2) + Math.pow(transformed[2] - ptA[2], 2);
      const d = Math.sqrt(distSq);
      distances.push(d);
      sumSq += distSq;
    }
    
    rmsd = Math.sqrt(sumSq / activePairs.length);

    if (cycle === CYCLES - 1) {
      break; // Final cycle, just report rmsd
    }

    // Compute mean and stddev of distances
    const mean = distances.reduce((a, b) => a + b, 0) / distances.length;
    const sqDiffs = distances.map(d => Math.pow(d - mean, 2));
    const variance = sqDiffs.reduce((a, b) => a + b, 0) / distances.length;
    const stdDev = Math.sqrt(variance);

    // Reject outliers: d > mean + 2.0 * stdDev
    const threshold = mean + SIGMA_CUTOFF * stdDev;
    
    const nextPairs = activePairs.filter((p, idx) => distances[idx] <= threshold);
    if (nextPairs.length === activePairs.length) {
      break; // No outliers removed, converged early!
    }
    activePairs = nextPairs;
  }

  // apply to all B atoms
  const alignedAtomsB: Atom[] = atomsB.map(a => {
    const t = applyTransform([a.x, a.y, a.z], R, centroidA, centroidB);
    return { ...a, x: t[0], y: t[1], z: t[2] };
  });

  return {
    rmsd,
    rotation: R.to2DArray(),
    translation: [
      centroidA[0] - centroidB[0],
      centroidA[1] - centroidB[1],
      centroidA[2] - centroidB[2]
    ],
    alignedAtomsB,
    alignedPdbB: getAlignedPDB(alignedAtomsB),
    atomPairsCount: activePairs.length
  };
}

export function getAlignedPDB(alignedAtoms: Atom[]) {
  return alignedAtoms.map(a => formatAtomLine(a)).join("\n");
}
