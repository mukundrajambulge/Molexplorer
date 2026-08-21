import { CanonicalAtom } from '../types/domain';

export interface HydrogenPosition {
  x: number;
  y: number;
  z: number;
}

const ELEMENT_BOND_LENGTHS: Record<string, number> = {
  C: 1.09,
  N: 1.01,
  O: 0.96,
  S: 1.34,
  P: 1.44
};

/**
 * Computes deterministic 3D Cartesian coordinates for modeled hydrogens
 * based on parent atom position and incident neighbor vectors.
 */
export function computeHydrogenPositions(
  parent: CanonicalAtom,
  neighbors: CanonicalAtom[],
  neededCount: number
): HydrogenPosition[] {
  const bondLength = ELEMENT_BOND_LENGTHS[parent.element.toUpperCase()] || 1.09;
  const positions: HydrogenPosition[] = [];

  if (neededCount <= 0) return positions;

  // Case 1: Parent has 0 neighbors (isolated atom, e.g. methane C or water O)
  if (neighbors.length === 0) {
    if (neededCount === 1) {
      positions.push({ x: parent.x + bondLength, y: parent.y, z: parent.z });
    } else if (neededCount === 2) {
      // Bent tetrahedral (109.5 deg)
      const halfAngle = (109.5 * Math.PI) / 360;
      positions.push({
        x: parent.x + bondLength * Math.cos(halfAngle),
        y: parent.y + bondLength * Math.sin(halfAngle),
        z: parent.z
      });
      positions.push({
        x: parent.x + bondLength * Math.cos(halfAngle),
        y: parent.y - bondLength * Math.sin(halfAngle),
        z: parent.z
      });
    } else if (neededCount === 3) {
      // Trigonal pyramidal
      for (let i = 0; i < 3; i++) {
        const theta = (i * 2 * Math.PI) / 3;
        positions.push({
          x: parent.x + bondLength * Math.cos(theta) * 0.94,
          y: parent.y + bondLength * Math.sin(theta) * 0.94,
          z: parent.z + bondLength * 0.34
        });
      }
    } else if (neededCount === 4) {
      // Regular tetrahedron
      const a = bondLength / Math.sqrt(3);
      positions.push({ x: parent.x + a, y: parent.y + a, z: parent.z + a });
      positions.push({ x: parent.x - a, y: parent.y - a, z: parent.z + a });
      positions.push({ x: parent.x - a, y: parent.y + a, z: parent.z - a });
      positions.push({ x: parent.x + a, y: parent.y - a, z: parent.z - a });
    }
    return positions;
  }

  // Case 2: Parent has existing neighbors. Compute opposite centroid vector
  let sumX = 0, sumY = 0, sumZ = 0;
  for (let i = 0; i < neighbors.length; i++) {
    const n = neighbors[i];
    const vx = n.x - parent.x;
    const vy = n.y - parent.y;
    const vz = n.z - parent.z;
    const len = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
    sumX += vx / len;
    sumY += vy / len;
    sumZ += vz / len;
  }

  let oppX = -sumX;
  let oppY = -sumY;
  let oppZ = -sumZ;
  let oppLen = Math.sqrt(oppX * oppX + oppY * oppY + oppZ * oppZ);

  if (oppLen < 1e-4) {
    // Neighbors are collinear (e.g. trans-disubstituted), pick perpendicular axis
    const n0 = neighbors[0];
    let perpX = -(n0.y - parent.y);
    let perpY = (n0.x - parent.x);
    let perpZ = 0;
    let perpLen = Math.sqrt(perpX * perpX + perpY * perpY + perpZ * perpZ);
    if (perpLen < 1e-4) {
      perpX = 0; perpY = 1; perpZ = 0; perpLen = 1;
    }
    oppX = perpX / perpLen;
    oppY = perpY / perpLen;
    oppZ = perpZ / perpLen;
    oppLen = 1;
  } else {
    oppX /= oppLen;
    oppY /= oppLen;
    oppZ /= oppLen;
  }

  if (neededCount === 1) {
    positions.push({
      x: parent.x + bondLength * oppX,
      y: parent.y + bondLength * oppY,
      z: parent.z + bondLength * oppZ
    });
  } else if (neededCount === 2) {
    // Generate two vectors branching symmetrically around opp vector
    let uX = -oppY, uY = oppX, uZ = 0;
    let uLen = Math.sqrt(uX * uX + uY * uY + uZ * uZ);
    if (uLen < 1e-4) {
      uX = 0; uY = -oppZ; uZ = oppY;
      uLen = Math.sqrt(uX * uX + uY * uY + uZ * uZ);
    }
    if (uLen < 1e-4) {
      uX = 1; uY = 0; uZ = 0; uLen = 1;
    }
    uX /= uLen; uY /= uLen; uZ /= uLen;

    const angle = 0.6; // ~35 degrees split
    const fwdScale = Math.cos(angle);
    const sideScale = Math.sin(angle);

    positions.push({
      x: parent.x + bondLength * (fwdScale * oppX + sideScale * uX),
      y: parent.y + bondLength * (fwdScale * oppY + sideScale * uY),
      z: parent.z + bondLength * (fwdScale * oppZ + sideScale * uZ)
    });
    positions.push({
      x: parent.x + bondLength * (fwdScale * oppX - sideScale * uX),
      y: parent.y + bondLength * (fwdScale * oppY - sideScale * uY),
      z: parent.z + bondLength * (fwdScale * oppZ - sideScale * uZ)
    });
  } else if (neededCount === 3) {
    // Tetrahedral tripod around opp vector (e.g. -CH3 methyl group)
    let uX = -oppY, uY = oppX, uZ = 0;
    let uLen = Math.sqrt(uX * uX + uY * uY + uZ * uZ);
    if (uLen < 1e-4) {
      uX = 0; uY = 1; uZ = 0; uLen = 1;
    }
    uX /= uLen; uY /= uLen; uZ /= uLen;

    const vX = oppY * uZ - oppZ * uY;
    const vY = oppZ * uX - oppX * uZ;
    const vZ = oppX * uY - oppY * uX;

    const fwd = Math.cos(1.23); // ~70.5 deg off parent bond
    const rad = Math.sin(1.23);

    for (let i = 0; i < 3; i++) {
      const theta = (i * 2 * Math.PI) / 3;
      const dirX = fwd * oppX + rad * (Math.cos(theta) * uX + Math.sin(theta) * vX);
      const dirY = fwd * oppY + rad * (Math.cos(theta) * uY + Math.sin(theta) * vY);
      const dirZ = fwd * oppZ + rad * (Math.cos(theta) * uZ + Math.sin(theta) * vZ);
      positions.push({
        x: parent.x + bondLength * dirX,
        y: parent.y + bondLength * dirY,
        z: parent.z + bondLength * dirZ
      });
    }
  }

  return positions;
}
