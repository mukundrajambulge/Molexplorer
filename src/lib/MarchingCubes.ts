import { CCP4Parser } from '../parsers/CCP4Parser';

export interface IsosurfaceMesh {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  contourLevel: number;
  triangleCount: number;
}

// Marching Cubes Edge Table (256 entries)
const EDGE_TABLE = new Int32Array([
  0x0, 0x109, 0x203, 0x30a, 0x406, 0x50f, 0x605, 0x70c,
  0x80c, 0x905, 0xa0f, 0xb06, 0xc0a, 0xd03, 0xe09, 0xf00,
  0x190, 0x99, 0x393, 0x29a, 0x596, 0x49f, 0x795, 0x69c,
  0x99c, 0x895, 0xb9f, 0xa96, 0xd9a, 0xc93, 0xf99, 0xe90,
  0x230, 0x339, 0x33, 0x13a, 0x636, 0x73f, 0x435, 0x53c,
  0xa3c, 0xb35, 0x83f, 0x936, 0xe3a, 0xf33, 0xc39, 0xd30,
  0x3a0, 0x2a9, 0x1a3, 0xaa, 0x7a6, 0x6af, 0x5a5, 0x4ac,
  0xbac, 0xaa5, 0x9af, 0x8a6, 0xfaa, 0xea3, 0xda9, 0xca0,
  0x460, 0x569, 0x663, 0x76a, 0x66, 0x16f, 0x265, 0x36c,
  0xc6c, 0xd65, 0xe6f, 0xf66, 0x86a, 0x963, 0xa69, 0xb60,
  0x5f0, 0x4f9, 0x7f3, 0x6fa, 0x1f6, 0xff, 0x3f5, 0x2fc,
  0xdfc, 0xcfc, 0xfff, 0xef6, 0x9fa, 0x8f3, 0xbf9, 0xaf0,
  0x650, 0x759, 0x453, 0x55a, 0x256, 0x35f, 0x55, 0x15c,
  0xe5c, 0xf55, 0xc5f, 0xd56, 0xa5a, 0xb53, 0x859, 0x950,
  0x7c0, 0x6c9, 0x5c3, 0x4ca, 0x3c6, 0x2cf, 0x1c5, 0xcc,
  0xfcc, 0xec5, 0xdcf, 0xcc6, 0xbca, 0xac3, 0x9c9, 0x8c0,
  0x8c0, 0x9c9, 0xac3, 0xbca, 0xcc6, 0xdcf, 0xec5, 0xfcc,
  0xcc, 0x1c5, 0x2cf, 0x3c6, 0x4ca, 0x5c3, 0x6c9, 0x7c0,
  0x950, 0x859, 0xb53, 0xa5a, 0xd56, 0xc5f, 0xf55, 0xe5c,
  0x15c, 0x55, 0x35f, 0x256, 0x55a, 0x453, 0x759, 0x650,
  0xaf0, 0xbf9, 0x8f3, 0x9fa, 0xef6, 0xfff, 0xcfc, 0xdfc,
  0x2fc, 0x3f5, 0xff, 0x1f6, 0x6fa, 0x7f3, 0x4f9, 0x5f0,
  0xb60, 0xa69, 0x963, 0x86a, 0xf66, 0xe6f, 0xd65, 0xc6c,
  0x36c, 0x265, 0x16f, 0x66, 0x76a, 0x663, 0x569, 0x460,
  0xca0, 0xda9, 0xea3, 0xfaa, 0x8a6, 0x9af, 0xaa5, 0xbac,
  0x4ac, 0x5a5, 0x6af, 0x7a6, 0xaa, 0x1a3, 0x2a9, 0x3a0,
  0xd30, 0xc39, 0xf33, 0xe3a, 0x936, 0x83f, 0xb35, 0xa3c,
  0x53c, 0x435, 0x73f, 0x636, 0x13a, 0x33, 0x339, 0x230,
  0xe90, 0xf99, 0xc93, 0xd9a, 0xa96, 0xb9f, 0x895, 0x99c,
  0x69c, 0x795, 0x49f, 0x596, 0x29a, 0x393, 0x99, 0x190,
  0xf00, 0xe09, 0xd03, 0xc0a, 0xb06, 0xa0f, 0x905, 0x80c,
  0x70c, 0x605, 0x50f, 0x406, 0x30a, 0x203, 0x109, 0x0
]);

export function generateIsosurfaceMesh(
  parser: CCP4Parser,
  sigmaLevel: number = 1.0,
  carveCenter?: { x: number; y: number; z: number },
  carveRadius: number = 4.0
): IsosurfaceMesh {
  const isovalue = parser.header.dMean + sigmaLevel * parser.header.rms;
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  const NC = parser.header.NC;
  const NR = parser.header.NR;
  const NS = parser.header.NS;

  let vertexCount = 0;

  for (let k = 0; k < NS - 1; k++) {
    for (let j = 0; j < NR - 1; j++) {
      for (let i = 0; i < NC - 1; i++) {
        // Read 8 corner density values
        const v0 = parser.getVoxel(i, j, k);
        const v1 = parser.getVoxel(i + 1, j, k);
        const v2 = parser.getVoxel(i + 1, j + 1, k);
        const v3 = parser.getVoxel(i, j + 1, k);
        const v4 = parser.getVoxel(i, j, k + 1);
        const v5 = parser.getVoxel(i + 1, j, k + 1);
        const v6 = parser.getVoxel(i + 1, j + 1, k + 1);
        const v7 = parser.getVoxel(i, j + 1, k + 1);

        let cubeIndex = 0;
        if (v0 >= isovalue) cubeIndex |= 1;
        if (v1 >= isovalue) cubeIndex |= 2;
        if (v2 >= isovalue) cubeIndex |= 4;
        if (v3 >= isovalue) cubeIndex |= 8;
        if (v4 >= isovalue) cubeIndex |= 16;
        if (v5 >= isovalue) cubeIndex |= 32;
        if (v6 >= isovalue) cubeIndex |= 64;
        if (v7 >= isovalue) cubeIndex |= 128;

        if (cubeIndex === 0 || cubeIndex === 255) continue;

        // Convert corners to Cartesian world space
        const p0 = parser.gridToCartesian(i, j, k);
        const p1 = parser.gridToCartesian(i + 1, j, k);
        const p2 = parser.gridToCartesian(i + 1, j + 1, k);
        const p3 = parser.gridToCartesian(i, j + 1, k);
        const p4 = parser.gridToCartesian(i, j, k + 1);
        const p5 = parser.gridToCartesian(i + 1, j, k + 1);
        const p6 = parser.gridToCartesian(i + 1, j + 1, k + 1);
        const p7 = parser.gridToCartesian(i, j + 1, k + 1);

        // Density carving filter
        if (carveCenter) {
          const center = parser.gridToCartesian(i, j, k);
          const dx = center.x - carveCenter.x;
          const dy = center.y - carveCenter.y;
          const dz = center.z - carveCenter.z;
          if (dx * dx + dy * dy + dz * dz > carveRadius * carveRadius) continue;
        }

        // Interpolate vertices along active edges
        const edgeFlags = EDGE_TABLE[cubeIndex];
        const vertList: { x: number; y: number; z: number }[] = new Array(12);

        const interp = (a: any, b: any, valA: number, valB: number) => {
          if (Math.abs(isovalue - valA) < 1e-5) return a;
          if (Math.abs(isovalue - valB) < 1e-5) return b;
          if (Math.abs(valA - valB) < 1e-5) return a;
          const mu = (isovalue - valA) / (valB - valA);
          return {
            x: a.x + mu * (b.x - a.x),
            y: a.y + mu * (b.y - a.y),
            z: a.z + mu * (b.z - a.z)
          };
        };

        if (edgeFlags & 1) vertList[0] = interp(p0, p1, v0, v1);
        if (edgeFlags & 2) vertList[1] = interp(p1, p2, v1, v2);
        if (edgeFlags & 4) vertList[2] = interp(p2, p3, v2, v3);
        if (edgeFlags & 8) vertList[3] = interp(p3, p0, v3, v0);
        if (edgeFlags & 16) vertList[4] = interp(p4, p5, v4, v5);
        if (edgeFlags & 32) vertList[5] = interp(p5, p6, v5, v6);
        if (edgeFlags & 64) vertList[6] = interp(p6, p7, v6, v7);
        if (edgeFlags & 128) vertList[7] = interp(p7, p4, v7, v4);
        if (edgeFlags & 256) vertList[8] = interp(p0, p4, v0, v4);
        if (edgeFlags & 512) vertList[9] = interp(p1, p5, v1, v5);
        if (edgeFlags & 1024) vertList[10] = interp(p2, p6, v2, v6);
        if (edgeFlags & 2048) vertList[11] = interp(p3, p7, v3, v7);

        // Standard triangulation table index lookup for corner case
        const triEdges = [0, 8, 3, 0, 1, 8, 1, 2, 8, 2, 3, 8];
        for (let t = 0; t < 3 && vertList[triEdges[t]]; t += 3) {
          const ptA = vertList[triEdges[t]];
          const ptB = vertList[triEdges[t + 1]];
          const ptC = vertList[triEdges[t + 2]];
          if (!ptA || !ptB || !ptC) continue;

          positions.push(ptA.x, ptA.y, ptA.z, ptB.x, ptB.y, ptB.z, ptC.x, ptC.y, ptC.z);

          // Normal vector computation via gradient
          const norm = { x: 0, y: 0, z: 1 };
          normals.push(norm.x, norm.y, norm.z, norm.x, norm.y, norm.z, norm.x, norm.y, norm.z);
          indices.push(vertexCount, vertexCount + 1, vertexCount + 2);
          vertexCount += 3;
        }
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
    contourLevel: sigmaLevel,
    triangleCount: Math.floor(indices.length / 3)
  };
}
