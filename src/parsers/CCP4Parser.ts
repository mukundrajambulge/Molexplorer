export interface CCP4Header {
  NC: number;        // Number of columns (fastest axis)
  NR: number;        // Number of rows (medium axis)
  NS: number;        // Number of sections (slowest axis)
  mode: number;      // Data type: 0=char, 1=short, 2=float32
  NCSTART: number;   // Start column
  NRSTART: number;   // Start row
  NSSTART: number;   // Start section
  NX: number;        // Grid sampling along X
  NY: number;        // Grid sampling along Y
  NZ: number;        // Grid sampling along Z
  xLength: number;   // Cell A in Ångströms
  yLength: number;   // Cell B in Ångströms
  zLength: number;   // Cell C in Ångströms
  alpha: number;     // Cell Alpha in degrees
  beta: number;      // Cell Beta in degrees
  gamma: number;     // Cell Gamma in degrees
  MAPC: number;      // Axis corresponding to cols (1=X, 2=Y, 3=Z)
  MAPR: number;      // Axis corresponding to rows (1=X, 2=Y, 3=Z)
  MAPS: number;      // Axis corresponding to sections (1=X, 2=Y, 3=Z)
  dMin: number;      // Min density
  dMax: number;      // Max density
  dMean: number;     // Mean density
  ISPG: number;      // Space group
  nSymBytes: number; // Symmetry bytes count
  rms: number;       // RMS deviation of density (sigma)
}

export class CCP4Parser {
  header: CCP4Header;
  data: Float32Array;
  fracToCart: number[][]; // 3x3 matrix

  constructor(buffer: ArrayBuffer) {
    const dataView = new DataView(buffer);

    // 1. Read 1024-byte CCP4 / MRC header
    this.header = {
      NC: dataView.getInt32(0, true),
      NR: dataView.getInt32(4, true),
      NS: dataView.getInt32(8, true),
      mode: dataView.getInt32(12, true),
      NCSTART: dataView.getInt32(16, true),
      NRSTART: dataView.getInt32(20, true),
      NSSTART: dataView.getInt32(24, true),
      NX: dataView.getInt32(28, true),
      NY: dataView.getInt32(32, true),
      NZ: dataView.getInt32(36, true),
      xLength: dataView.getFloat32(40, true),
      yLength: dataView.getFloat32(44, true),
      zLength: dataView.getFloat32(48, true),
      alpha: dataView.getFloat32(52, true),
      beta: dataView.getFloat32(56, true),
      gamma: dataView.getFloat32(60, true),
      MAPC: dataView.getInt32(64, true),
      MAPR: dataView.getInt32(68, true),
      MAPS: dataView.getInt32(72, true),
      dMin: dataView.getFloat32(76, true),
      dMax: dataView.getFloat32(80, true),
      dMean: dataView.getFloat32(84, true),
      ISPG: dataView.getInt32(88, true),
      nSymBytes: dataView.getInt32(92, true),
      rms: dataView.getFloat32(216, true)
    };

    // Calculate Fractional to Cartesian transformation matrix
    this.fracToCart = this.computeFracToCartMatrix();

    // 2. Parse voxel grid values
    const headerByteOffset = 1024 + this.header.nSymBytes;
    const totalVoxels = this.header.NC * this.header.NR * this.header.NS;
    this.data = new Float32Array(totalVoxels);

    if (this.header.mode === 2) {
      // Float32 Mode
      const floatView = new Float32Array(buffer, headerByteOffset, totalVoxels);
      this.data.set(floatView);
    } else if (this.header.mode === 0) {
      // Int8 / Uint8 Mode
      const byteView = new Uint8Array(buffer, headerByteOffset, totalVoxels);
      for (let i = 0; i < totalVoxels; i++) {
        this.data[i] = byteView[i];
      }
    } else if (this.header.mode === 1) {
      // Int16 Mode
      const shortView = new Int16Array(buffer, headerByteOffset, totalVoxels);
      for (let i = 0; i < totalVoxels; i++) {
        this.data[i] = shortView[i];
      }
    }

    // Auto-calculate RMS (sigma) if missing
    if (this.header.rms <= 0) {
      let sum = 0;
      for (let i = 0; i < this.data.length; i++) sum += this.data[i];
      const mean = sum / this.data.length;
      let varSum = 0;
      for (let i = 0; i < this.data.length; i++) {
        const diff = this.data[i] - mean;
        varSum += diff * diff;
      }
      this.header.dMean = mean;
      this.header.rms = Math.sqrt(varSum / this.data.length);
    }
  }

  private computeFracToCartMatrix(): number[][] {
    const d2r = Math.PI / 180.0;
    const a = this.header.xLength;
    const b = this.header.yLength;
    const c = this.header.zLength;
    const alpha = this.header.alpha * d2r;
    const beta = this.header.beta * d2r;
    const gamma = this.header.gamma * d2r;

    const cosAlpha = Math.cos(alpha);
    const cosBeta = Math.cos(beta);
    const cosGamma = Math.cos(gamma);
    const sinGamma = Math.sin(gamma);

    const v = Math.sqrt(1 - cosAlpha * cosAlpha - cosBeta * cosBeta - cosGamma * cosGamma + 2 * cosAlpha * cosBeta * cosGamma);

    return [
      [a, b * cosGamma, c * cosBeta],
      [0, b * sinGamma, c * (cosAlpha - cosBeta * cosGamma) / sinGamma],
      [0, 0, c * v / sinGamma]
    ];
  }

  // Get density voxel value at grid index (i, j, k)
  getVoxel(i: number, j: number, k: number): number {
    if (i < 0 || i >= this.header.NC || j < 0 || j >= this.header.NR || k < 0 || k >= this.header.NS) {
      return 0;
    }
    const idx = i + j * this.header.NC + k * this.header.NC * this.header.NR;
    return this.data[idx] || 0;
  }

  // Convert grid index (i, j, k) to Cartesian world coordinate (x, y, z)
  gridToCartesian(i: number, j: number, k: number): { x: number; y: number; z: number } {
    const gridX = (i + this.header.NCSTART) / this.header.NX;
    const gridY = (j + this.header.NRSTART) / this.header.NY;
    const gridZ = (k + this.header.NSSTART) / this.header.NZ;

    const M = this.fracToCart;
    const x = M[0][0] * gridX + M[0][1] * gridY + M[0][2] * gridZ;
    const y = M[1][0] * gridX + M[1][1] * gridY + M[1][2] * gridZ;
    const z = M[2][0] * gridX + M[2][1] * gridY + M[2][2] * gridZ;

    return { x, y, z };
  }
}
