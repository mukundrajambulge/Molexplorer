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

  const VUT = V.mmul(U.transpose());
  const d = Math.sign(determinant(VUT));

  const diag = Matrix.eye(3, 3);
  diag.set(2, 2, d);

  // R = V * diag(1, 1, d) * U^T
  const R = V.mmul(diag).mmul(U.transpose());

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

// ... more to come
function needlemanWunsch(seqA: Atom[], seqB: Atom[]) {
  const n = seqA.length;
  const m = seqB.length;
  const dp: number[][] = Array(n + 1).fill(0).map(() => Array(m + 1).fill(0));
  
  const matchScore = 1;
  const mismatchScore = -1;
  const gapPenalty = -1;

  for (let i = 1; i <= n; i++) dp[i][0] = i * gapPenalty;
  for (let j = 1; j <= m; j++) dp[0][j] = j * gapPenalty;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const match = dp[i - 1][j - 1] + (seqA[i - 1].resName === seqB[j - 1].resName ? matchScore : mismatchScore);
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
    if (current === dp[i - 1][j - 1] + (seqA[i - 1].resName === seqB[j - 1].resName ? matchScore : mismatchScore)) {
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

  const coordsA = pairs.map(p => [p[0].x, p[0].y, p[0].z]);
  const coordsB = pairs.map(p => [p[1].x, p[1].y, p[1].z]);

  const { R, centroidA, centroidB } = calculateKabsch(coordsA, coordsB);

  // calculate RMSD
  let sumSq = 0;
  for (let i = 0; i < pairs.length; i++) {
    const ptB = coordsB[i];
    const transformed = applyTransform(ptB, R, centroidA, centroidB);
    const ptA = coordsA[i];
    sumSq += Math.pow(transformed[0] - ptA[0], 2) + Math.pow(transformed[1] - ptA[1], 2) + Math.pow(transformed[2] - ptA[2], 2);
  }
  const rmsd = Math.sqrt(sumSq / pairs.length);

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
    atomPairsCount: pairs.length
  };
}

export function getAlignedPDB(alignedAtoms: Atom[]) {
  return alignedAtoms.map(a => formatAtomLine(a)).join("\n");
}
