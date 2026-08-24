import { CanonicalAtom } from '../types/domain';

export type HybridizationModel = 'sp3' | 'sp2' | 'sp';

export interface HydrogenPosition {
  x: number;
  y: number;
  z: number;
  target_length: number;
  actual_length: number;
  geometry_model: HybridizationModel;
  chemical_context: string;
}

export const ELEMENT_TARGET_BOND_LENGTHS: Record<string, number> = {
  C: 1.090,
  N: 1.010,
  O: 0.960,
  S: 1.340,
  P: 1.440
};

export const BOND_LENGTH_TOLERANCE = 0.010; // ± 0.010 Å

/**
 * Normalizes a 3D vector. Returns fallback unit vector [0, 0, 1] if magnitude is near zero.
 */
function normalizeVector(x: number, y: number, z: number): [number, number, number] {
  const len = Math.sqrt(x * x + y * y + z * z);
  if (len < 1e-6) return [0, 0, 1];
  return [x / len, y / len, z / len];
}

/**
 * Constructs a deterministic orthonormal basis (e1, e2) perpendicular to unit vector v.
 */
function constructOrthonormalBasis(vx: number, vy: number, vz: number): {
  e1: [number, number, number];
  e2: [number, number, number];
} {
  // Deterministic seed axis that is not parallel to v
  let ax = 0, ay = 1, az = 0;
  if (Math.abs(vy) > 0.9) {
    ax = 1; ay = 0; az = 0;
  }
  // e1 = normalize(a - (a . v) * v)
  const dot = ax * vx + ay * vy + az * vz;
  const e1x = ax - dot * vx;
  const e1y = ay - dot * vy;
  const e1z = az - dot * vz;
  const e1 = normalizeVector(e1x, e1y, e1z);

  // e2 = v x e1
  const e2x = vy * e1[2] - vz * e1[1];
  const e2y = vz * e1[0] - vx * e1[2];
  const e2z = vx * e1[1] - vy * e1[0];
  const e2 = normalizeVector(e2x, e2y, e2z);

  return { e1, e2 };
}

/**
 * Infers default hybridization model based on element and neighbor count/incident bond orders.
 */
export function inferHybridizationModel(
  element: string,
  existingNeighborCount: number,
  neededHydrogens: number
): HybridizationModel {
  const totalCoordination = existingNeighborCount + neededHydrogens;
  const elem = element.toUpperCase();

  if (totalCoordination <= 2) {
    return 'sp';
  } else if (totalCoordination === 3) {
    return 'sp2';
  }
  return 'sp3';
}

/**
 * Computes deterministic 3D Cartesian coordinates for modeled hydrogens
 * based on parent atom position, sorted incident neighbor vectors, and explicit hybridization geometry model.
 */
export function computeHydrogenPositions(
  parent: CanonicalAtom,
  neighbors: CanonicalAtom[],
  neededCount: number,
  hybridization?: HybridizationModel
): HydrogenPosition[] {
  const elem = parent.element.toUpperCase();
  const targetBondLength = ELEMENT_TARGET_BOND_LENGTHS[elem] || 1.090;
  const positions: HydrogenPosition[] = [];

  if (neededCount <= 0) return positions;

  // Enforce deterministic neighbor ordering by canonical ID to eliminate array order dependence
  const sortedNeighbors = [...neighbors].sort((a, b) => a.canonical_id - b.canonical_id);
  const model = hybridization || inferHybridizationModel(elem, sortedNeighbors.length, neededCount);
  const contextDesc = `${elem}-${model}-coord${sortedNeighbors.length}+${neededCount}H`;

  // -------------------------------------------------------------------------
  // Case 1: Parent has 0 neighbors (isolated heavy atom)
  // -------------------------------------------------------------------------
  if (sortedNeighbors.length === 0) {
    if (neededCount === 1) {
      const px = parent.x + targetBondLength;
      const py = parent.y;
      const pz = parent.z;
      positions.push({
        x: px, y: py, z: pz,
        target_length: targetBondLength,
        actual_length: targetBondLength,
        geometry_model: model,
        chemical_context: contextDesc
      });
    } else if (neededCount === 2) {
      // 109.47 deg bent
      const halfAngle = (109.4712 * Math.PI) / 360;
      const c = Math.cos(halfAngle);
      const s = Math.sin(halfAngle);
      positions.push({
        x: parent.x + targetBondLength * c,
        y: parent.y + targetBondLength * s,
        z: parent.z,
        target_length: targetBondLength,
        actual_length: targetBondLength,
        geometry_model: model,
        chemical_context: contextDesc
      });
      positions.push({
        x: parent.x + targetBondLength * c,
        y: parent.y - targetBondLength * s,
        z: parent.z,
        target_length: targetBondLength,
        actual_length: targetBondLength,
        geometry_model: model,
        chemical_context: contextDesc
      });
    } else if (neededCount === 3) {
      // Trigonal pyramidal
      for (let i = 0; i < 3; i++) {
        const theta = (i * 2 * Math.PI) / 3;
        positions.push({
          x: parent.x + targetBondLength * Math.cos(theta) * 0.94,
          y: parent.y + targetBondLength * Math.sin(theta) * 0.94,
          z: parent.z + targetBondLength * 0.34,
          target_length: targetBondLength,
          actual_length: targetBondLength,
          geometry_model: model,
          chemical_context: contextDesc
        });
      }
    } else if (neededCount >= 4) {
      // Regular tetrahedron
      const a = targetBondLength / Math.sqrt(3);
      const tetVertices = [
        [+a, +a, +a],
        [-a, -a, +a],
        [-a, +a, -a],
        [+a, -a, -a]
      ];
      for (let i = 0; i < Math.min(neededCount, 4); i++) {
        const [dx, dy, dz] = tetVertices[i];
        positions.push({
          x: parent.x + dx,
          y: parent.y + dy,
          z: parent.z + dz,
          target_length: targetBondLength,
          actual_length: targetBondLength,
          geometry_model: model,
          chemical_context: contextDesc
        });
      }
    }
    return positions;
  }

  // -------------------------------------------------------------------------
  // Case 2: Parent has existing neighbors
  // -------------------------------------------------------------------------
  const neighborUnitVectors: [number, number, number][] = sortedNeighbors.map(n => {
    return normalizeVector(n.x - parent.x, n.y - parent.y, n.z - parent.z);
  });

  // Calculate sum of unit vectors pointing toward existing neighbors
  let sumX = 0, sumY = 0, sumZ = 0;
  for (const [vx, vy, vz] of neighborUnitVectors) {
    sumX += vx;
    sumY += vy;
    sumZ += vz;
  }

  // Opposite vector direction
  let [oppX, oppY, oppZ] = normalizeVector(-sumX, -sumY, -sumZ);

  // Degeneracy handling: if neighbors are collinear opposite (sum ≈ 0)
  if (Math.abs(sumX) < 1e-4 && Math.abs(sumY) < 1e-4 && Math.abs(sumZ) < 1e-4) {
    const [n0x, n0y, n0z] = neighborUnitVectors[0];
    const { e1 } = constructOrthonormalBasis(n0x, n0y, n0z);
    oppX = e1[0];
    oppY = e1[1];
    oppZ = e1[2];
  }

  if (model === 'sp') {
    // Linear collinear placement (180 deg)
    const [n0x, n0y, n0z] = neighborUnitVectors[0];
    positions.push({
      x: parent.x - targetBondLength * n0x,
      y: parent.y - targetBondLength * n0y,
      z: parent.z - targetBondLength * n0z,
      target_length: targetBondLength,
      actual_length: targetBondLength,
      geometry_model: 'sp',
      chemical_context: contextDesc
    });
    return positions;
  }

  if (model === 'sp2') {
    // Trigonal planar (120 deg)
    if (sortedNeighbors.length === 1 && neededCount === 2) {
      const [n0x, n0y, n0z] = neighborUnitVectors[0];
      const { e1 } = constructOrthonormalBasis(n0x, n0y, n0z);
      const cos120 = -0.5;
      const sin120 = Math.sqrt(3) / 2;

      const h1x = cos120 * n0x + sin120 * e1[0];
      const h1y = cos120 * n0y + sin120 * e1[1];
      const h1z = cos120 * n0z + sin120 * e1[2];

      const h2x = cos120 * n0x - sin120 * e1[0];
      const h2y = cos120 * n0y - sin120 * e1[1];
      const h2z = cos120 * n0z - sin120 * e1[2];

      positions.push({
        x: parent.x + targetBondLength * h1x,
        y: parent.y + targetBondLength * h1y,
        z: parent.z + targetBondLength * h1z,
        target_length: targetBondLength,
        actual_length: targetBondLength,
        geometry_model: 'sp2',
        chemical_context: contextDesc
      });
      positions.push({
        x: parent.x + targetBondLength * h2x,
        y: parent.y + targetBondLength * h2y,
        z: parent.z + targetBondLength * h2z,
        target_length: targetBondLength,
        actual_length: targetBondLength,
        geometry_model: 'sp2',
        chemical_context: contextDesc
      });
    } else {
      // 1 hydrogen needed in plane
      positions.push({
        x: parent.x + targetBondLength * oppX,
        y: parent.y + targetBondLength * oppY,
        z: parent.z + targetBondLength * oppZ,
        target_length: targetBondLength,
        actual_length: targetBondLength,
        geometry_model: 'sp2',
        chemical_context: contextDesc
      });
    }
    return positions;
  }

  // -------------------------------------------------------------------------
  // Default: sp3 (Tetrahedral, 109.47 deg)
  // -------------------------------------------------------------------------
  if (neededCount === 1) {
    positions.push({
      x: parent.x + targetBondLength * oppX,
      y: parent.y + targetBondLength * oppY,
      z: parent.z + targetBondLength * oppZ,
      target_length: targetBondLength,
      actual_length: targetBondLength,
      geometry_model: 'sp3',
      chemical_context: contextDesc
    });
  } else if (neededCount === 2) {
    const { e1 } = constructOrthonormalBasis(oppX, oppY, oppZ);
    const halfAngle = 0.61548; // ~35.26 deg out of bisector (109.47 deg overall angle)
    const fwdScale = Math.cos(halfAngle);
    const sideScale = Math.sin(halfAngle);

    const h1x = fwdScale * oppX + sideScale * e1[0];
    const h1y = fwdScale * oppY + sideScale * e1[1];
    const h1z = fwdScale * oppZ + sideScale * e1[2];

    const h2x = fwdScale * oppX - sideScale * e1[0];
    const h2y = fwdScale * oppY - sideScale * e1[1];
    const h2z = fwdScale * oppZ - sideScale * e1[2];

    positions.push({
      x: parent.x + targetBondLength * h1x,
      y: parent.y + targetBondLength * h1y,
      z: parent.z + targetBondLength * h1z,
      target_length: targetBondLength,
      actual_length: targetBondLength,
      geometry_model: 'sp3',
      chemical_context: contextDesc
    });
    positions.push({
      x: parent.x + targetBondLength * h2x,
      y: parent.y + targetBondLength * h2y,
      z: parent.z + targetBondLength * h2z,
      target_length: targetBondLength,
      actual_length: targetBondLength,
      geometry_model: 'sp3',
      chemical_context: contextDesc
    });
  } else if (neededCount === 3) {
    const { e1, e2 } = constructOrthonormalBasis(oppX, oppY, oppZ);
    const fwd = Math.cos(1.23096); // ~70.53 deg cone angle
    const rad = Math.sin(1.23096);

    for (let i = 0; i < 3; i++) {
      const theta = (i * 2 * Math.PI) / 3;
      const dirX = fwd * oppX + rad * (Math.cos(theta) * e1[0] + Math.sin(theta) * e2[0]);
      const dirY = fwd * oppY + rad * (Math.cos(theta) * e1[1] + Math.sin(theta) * e2[1]);
      const dirZ = fwd * oppZ + rad * (Math.cos(theta) * e1[2] + Math.sin(theta) * e2[2]);

      positions.push({
        x: parent.x + targetBondLength * dirX,
        y: parent.y + targetBondLength * dirY,
        z: parent.z + targetBondLength * dirZ,
        target_length: targetBondLength,
        actual_length: targetBondLength,
        geometry_model: 'sp3',
        chemical_context: contextDesc
      });
    }
  }

  return positions;
}
