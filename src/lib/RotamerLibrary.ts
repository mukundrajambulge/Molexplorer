import { Atom } from './MolProcessor';

export interface RotamerConformation {
  id: string;
  resName: string;
  probability: number;
  chi1: number;
  chi2: number;
  chi3?: number;
  chi4?: number;
}

export interface StericClashReport {
  clashCount: number;
  totalPenalty: number;
  clashingPairs: { atom1: Atom; atom2: Atom; distance: number; overlap: number }[];
}

const CANONICAL_ROTAMERS: Record<string, RotamerConformation[]> = {
  PHE: [
    { id: 'phe_1', resName: 'PHE', probability: 0.48, chi1: -65.0, chi2: 80.0 },
    { id: 'phe_2', resName: 'PHE', probability: 0.32, chi1: 60.0, chi2: 90.0 },
    { id: 'phe_3', resName: 'PHE', probability: 0.18, chi1: 180.0, chi2: 75.0 }
  ],
  TYR: [
    { id: 'tyr_1', resName: 'TYR', probability: 0.50, chi1: -65.0, chi2: 80.0 },
    { id: 'tyr_2', resName: 'TYR', probability: 0.30, chi1: 60.0, chi2: 90.0 },
    { id: 'tyr_3', resName: 'TYR', probability: 0.18, chi1: 180.0, chi2: 75.0 }
  ],
  TRP: [
    { id: 'trp_1', resName: 'TRP', probability: 0.45, chi1: -65.0, chi2: 90.0 },
    { id: 'trp_2', resName: 'TRP', probability: 0.35, chi1: 60.0, chi2: -90.0 },
    { id: 'trp_3', resName: 'TRP', probability: 0.15, chi1: 180.0, chi2: 80.0 }
  ],
  LEU: [
    { id: 'leu_1', resName: 'LEU', probability: 0.60, chi1: -60.0, chi2: 175.0 },
    { id: 'leu_2', resName: 'LEU', probability: 0.25, chi1: 180.0, chi2: 60.0 },
    { id: 'leu_3', resName: 'LEU', probability: 0.12, chi1: 60.0, chi2: 175.0 }
  ],
  VAL: [
    { id: 'val_1', resName: 'VAL', probability: 0.72, chi1: 175.0, chi2: 0.0 },
    { id: 'val_2', resName: 'VAL', probability: 0.18, chi1: -60.0, chi2: 0.0 },
    { id: 'val_3', resName: 'VAL', probability: 0.08, chi1: 60.0, chi2: 0.0 }
  ],
  ILE: [
    { id: 'ile_1', resName: 'ILE', probability: 0.65, chi1: -60.0, chi2: 170.0 },
    { id: 'ile_2', resName: 'ILE', probability: 0.22, chi1: 170.0, chi2: 165.0 }
  ],
  MET: [
    { id: 'met_1', resName: 'MET', probability: 0.55, chi1: -65.0, chi2: 180.0, chi3: 75.0 },
    { id: 'met_2', resName: 'MET', probability: 0.30, chi1: 180.0, chi2: 180.0, chi3: -75.0 }
  ]
};

const VDW_RADII: Record<string, number> = {
  H: 1.20, C: 1.70, N: 1.55, O: 1.52, F: 1.47, P: 1.80, S: 1.80, CL: 1.75, BR: 1.85, I: 1.98
};

function getVdwRadius(elem: string): number {
  return VDW_RADII[(elem || '').toUpperCase().trim()] || 1.70;
}

// Rodrigues' 3D Rotation Formula: Rotates point P around axis U anchored at origin A by theta
export function rotateAroundAxis(
  p: { x: number; y: number; z: number },
  a: { x: number; y: number; z: number },
  u: { x: number; y: number; z: number },
  angleRad: number
): { x: number; y: number; z: number } {
  const len = Math.sqrt(u.x * u.x + u.y * u.y + u.z * u.z);
  if (len === 0) return p;
  const ux = u.x / len, uy = u.y / len, uz = u.z / len;

  const px = p.x - a.x, py = p.y - a.y, pz = p.z - a.z;
  const cosT = Math.cos(angleRad);
  const sinT = Math.sin(angleRad);

  const dot = ux * px + uy * py + uz * pz;
  const crossX = uy * pz - uz * py;
  const crossY = uz * px - ux * pz;
  const crossZ = ux * py - uy * px;

  const rx = px * cosT + crossX * sinT + ux * dot * (1 - cosT);
  const ry = py * cosT + crossY * sinT + uy * dot * (1 - cosT);
  const rz = pz * cosT + crossZ * sinT + uz * dot * (1 - cosT);

  return { x: a.x + rx, y: a.y + ry, z: a.z + rz };
}

export function getRotamersForResidue(resName: string): RotamerConformation[] {
  const name = resName.trim().toUpperCase();
  return CANONICAL_ROTAMERS[name] || [
    { id: `${name.toLowerCase()}_default`, resName: name, probability: 1.0, chi1: 60.0, chi2: 180.0 }
  ];
}

export function detectStericClashes(
  mutatedAtoms: Atom[],
  surroundingAtoms: Atom[],
  clashCutoff: number = 0.4
): StericClashReport {
  const report: StericClashReport = { clashCount: 0, totalPenalty: 0, clashingPairs: [] };

  for (const a1 of mutatedAtoms) {
    const r1 = getVdwRadius(a1.elem);
    for (const a2 of surroundingAtoms) {
      if (a1.chainID === a2.chainID && a1.resSeq === a2.resSeq) continue;

      const dx = a1.x - a2.x;
      const dy = a1.y - a2.y;
      const dz = a1.z - a2.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const r2 = getVdwRadius(a2.elem);

      const overlap = (r1 + r2) - dist;
      if (overlap > clashCutoff) {
        report.clashCount++;
        const penalty = Math.pow(overlap - clashCutoff, 2);
        report.totalPenalty += penalty;
        report.clashingPairs.push({ atom1: a1, atom2: a2, distance: dist, overlap });
      }
    }
  }

  return report;
}
