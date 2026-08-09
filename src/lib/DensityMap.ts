import { generateIsosurfaceMesh, IsosurfaceMesh } from './MarchingCubes';

export interface DensityGrid {
  dimensions: { x: number; y: number; z: number };
  origin: { x: number; y: number; z: number };
  stepSize: number;
  data: Float32Array;
}

export class DensityMap {
  public static generateSyntheticMap(atoms: any[], stepSize: number = 1.0): DensityGrid {
    if (!atoms || atoms.length === 0) {
      return {
        dimensions: { x: 10, y: 10, z: 10 },
        origin: { x: 0, y: 0, z: 0 },
        stepSize,
        data: new Float32Array(1000)
      };
    }

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    atoms.forEach(a => {
      if (a.x < minX) minX = a.x;
      if (a.y < minY) minY = a.y;
      if (a.z < minZ) minZ = a.z;
      if (a.x > maxX) maxX = a.x;
      if (a.y > maxY) maxY = a.y;
      if (a.z > maxZ) maxZ = a.z;
    });

    const padding = 4.0;
    const origin = { x: minX - padding, y: minY - padding, z: minZ - padding };
    const dimX = Math.ceil((maxX - minX + 2 * padding) / stepSize);
    const dimY = Math.ceil((maxY - minY + 2 * padding) / stepSize);
    const dimZ = Math.ceil((maxZ - minZ + 2 * padding) / stepSize);

    const gridData = new Float32Array(dimX * dimY * dimZ);

    atoms.forEach(a => {
      const gx = Math.floor((a.x - origin.x) / stepSize);
      const gy = Math.floor((a.y - origin.y) / stepSize);
      const gz = Math.floor((a.z - origin.z) / stepSize);
      const radius = 3;

      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dz = -radius; dz <= radius; dz++) {
            const ix = gx + dx;
            const iy = gy + dy;
            const iz = gz + dz;
            if (ix >= 0 && ix < dimX && iy >= 0 && iy < dimY && iz >= 0 && iz < dimZ) {
              const r2 = dx * dx + dy * dy + dz * dz;
              const val = Math.exp(-r2 / 2.0);
              const idx = ix + iy * dimX + iz * dimX * dimY;
              gridData[idx] += val;
            }
          }
        }
      }
    });

    return {
      dimensions: { x: dimX, y: dimY, z: dimZ },
      origin,
      stepSize,
      data: gridData
    };
  }

  public static marchingCubes(grid: DensityGrid, isovalue: number): IsosurfaceMesh {
    const fakeParser: any = {
      header: {
        NC: grid.dimensions.x,
        NR: grid.dimensions.y,
        NS: grid.dimensions.z,
        dMean: 0.5,
        rms: 0.2
      },
      getVoxel: (x: number, y: number, z: number) => {
        if (x < 0 || x >= grid.dimensions.x || y < 0 || y >= grid.dimensions.y || z < 0 || z >= grid.dimensions.z) return 0;
        const idx = x + y * grid.dimensions.x + z * grid.dimensions.x * grid.dimensions.y;
        return grid.data[idx] || 0;
      },
      gridToCartesian: (i: number, j: number, k: number) => ({
        x: grid.origin.x + i * grid.stepSize,
        y: grid.origin.y + j * grid.stepSize,
        z: grid.origin.z + k * grid.stepSize
      })
    };
    return generateIsosurfaceMesh(fakeParser, isovalue);
  }
}
