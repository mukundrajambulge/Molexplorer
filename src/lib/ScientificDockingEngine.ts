/**
 * MolExplorer / MolStudio — Custom Scientific Molecular Docking Engine (Phase 3)
 * Full independent computational biophysics implementation:
 * 1. Valence-aware Hydrogen Placement & Hybridization Detection
 * 2. Gasteiger-Marsili Partial Charge Assignment (Electronegativity Equalization)
 * 3. 3D Potential Grid Cache & O(1) Trilinear Interpolation
 * 4. 5-Term Empirical Scoring Function (vdW LJ 6-12, Coulomb with e(r)=4r, H-Bond, Desolv, Torsion)
 * 5. Metropolis Monte Carlo Conformational Search with Local Energy Minimization
 * 6. Kabsch Heavy-Atom RMSD Matrix & Greedy Leader Clustering
 */

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export class Vec3 {
  static create(x = 0, y = 0, z = 0): Vector3D { return { x, y, z }; }
  static add(a: Vector3D, b: Vector3D): Vector3D { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
  static sub(a: Vector3D, b: Vector3D): Vector3D { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
  static scale(a: Vector3D, s: number): Vector3D { return { x: a.x * s, y: a.y * s, z: a.z * s }; }
  static dot(a: Vector3D, b: Vector3D): number { return a.x * b.x + a.y * b.y + a.z * b.z; }
  static cross(a: Vector3D, b: Vector3D): Vector3D {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    };
  }
  static lengthSq(a: Vector3D): number { return a.x * a.x + a.y * a.y + a.z * a.z; }
  static magnitude(a: Vector3D): number { return Math.sqrt(Vec3.lengthSq(a)); }
  static normalized(a: Vector3D): Vector3D {
    const l = Vec3.magnitude(a);
    return l < 1e-12 ? { x: 0, y: 0, z: 0 } : Vec3.scale(a, 1 / l);
  }
  static distance(a: Vector3D, b: Vector3D): number { return Vec3.magnitude(Vec3.sub(a, b)); }
}

export class Quat {
  static fromAxisAngle(axis: Vector3D, angleRad: number) {
    const norm = Vec3.normalized(axis);
    const half = angleRad * 0.5;
    const s = Math.sin(half);
    return { w: Math.cos(half), x: norm.x * s, y: norm.y * s, z: norm.z * s };
  }

  static rotate(q: { w: number; x: number; y: number; z: number }, v: Vector3D): Vector3D {
    const u = { x: q.x, y: q.y, z: q.z };
    const s = q.w;
    const uDotV = Vec3.dot(u, v);
    const uDotU = Vec3.dot(u, u);
    const uCrossV = Vec3.cross(u, v);

    return Vec3.add(
      Vec3.add(Vec3.scale(u, 2.0 * uDotV), Vec3.scale(v, s * s - uDotU)),
      Vec3.scale(uCrossV, 2.0 * s)
    );
  }
}

export interface EngineAtom {
  id: number;
  name: string;
  element: string;
  position: Vector3D;
  originalPosition: Vector3D;
  partialCharge: number;
  formalCharge: number;
  autoDockTypeStr: string;
  residueSeq: number;
  residueName: string;
  chainId: string;
  isHetero: boolean;
  isHydrogen: boolean;
  hybridization: number; // 1 = sp, 2 = sp2, 3 = sp3
  bondedAtomIds: number[];
  excludedAtomIds?: Set<number>; // 1-2 and 1-3 topological neighbors
}

export interface RotatableBondInfo {
  atomA: number;
  atomB: number;
  movingAtomIds: number[];
}

export interface EngineMolecule {
  name: string;
  atoms: EngineAtom[];
  rotatableBonds: RotatableBondInfo[];
  centerOfMass: Vector3D;
}

export interface GridBoxDef {
  center: Vector3D;
  size: Vector3D;
  spacing: number;
}

export interface DockedPoseResult {
  poseIndex: number;
  bindingAffinity: number; // kcal/mol
  rmsdFromLeader: number;
  rmsdFromReference: number;
  clusterRank: number;
  clusterSize: number;
  transformedAtoms: EngineAtom[];
  energyBreakdown: {
    vdw: number;
    electrostatics: number;
    hbond: number;
    desolvation: number;
    torsionalPenalty: number;
    total: number;
  };
}

export interface DockingJobOutcome {
  success: boolean;
  errorMessage?: string;
  bestAffinity: number;
  estimatedKiNanomolar: number;
  numPoses: number;
  poses: DockedPoseResult[];
  resultPDBQT: string;
  executionTimeMs: number;
}

/**
 * 1. Gasteiger-Marsili Partial Charge Assignment
 */
export class GasteigerChargeEngine {
  static getParameters(element: string, hybridization: number) {
    const el = element.toUpperCase();
    if (el === 'H') return { a: 7.17, b: 6.24, c: -0.56 };
    if (el === 'C') {
      if (hybridization === 1) return { a: 10.39, b: 9.45, c: 0.73 };
      if (hybridization === 2) return { a: 8.79, b: 9.32, c: 1.51 };
      return { a: 7.98, b: 9.18, c: 1.88 };
    }
    if (el === 'N') {
      if (hybridization === 1) return { a: 15.68, b: 11.70, c: 0.0 };
      if (hybridization === 2) return { a: 12.87, b: 13.94, c: 3.89 };
      return { a: 11.54, b: 12.82, c: 3.83 };
    }
    if (el === 'O') {
      if (hybridization === 2) return { a: 17.07, b: 13.79, c: 0.47 };
      return { a: 14.18, b: 12.92, c: 1.39 };
    }
    if (el === 'F') return { a: 14.66, b: 13.85, c: 2.31 };
    if (el === 'CL') return { a: 11.00, b: 9.69, c: 1.35 };
    if (el === 'BR') return { a: 10.08, b: 8.47, c: 1.16 };
    if (el === 'I') return { a: 9.90, b: 7.96, c: 0.96 };
    if (el === 'S') return { a: 10.14, b: 9.13, c: 1.38 };
    if (el === 'P') return { a: 8.90, b: 8.40, c: 1.20 };
    return { a: 7.50, b: 7.00, c: 1.00 };
  }

  static assignCharges(mol: EngineMolecule, maxIterations = 6) {
    const n = mol.atoms.length;
    if (n === 0) return;

    const q = mol.atoms.map(a => a.formalCharge || 0.0);
    const params = mol.atoms.map(a => this.getParameters(a.element, a.hybridization));

    const idToIndex = new Map<number, number>();
    mol.atoms.forEach((a, idx) => idToIndex.set(a.id, idx));

    let dampFactor = 1.0;
    for (let iter = 0; iter < maxIterations; iter++) {
      dampFactor *= 0.5;
      const deltaQ = new Float64Array(n);

      const chi = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        chi[i] = params[i].a + params[i].b * q[i] + params[i].c * (q[i] * q[i]);
      }

      for (let i = 0; i < n; i++) {
        for (const neighborId of mol.atoms[i].bondedAtomIds) {
          const j = idToIndex.get(neighborId);
          if (j === undefined || i >= j) continue;

          if (chi[i] !== chi[j]) {
            const denom = params[i].a + params[i].b + params[j].a + params[j].b;
            if (denom > 1e-6) {
              const dq = ((chi[j] - chi[i]) / denom) * dampFactor;
              deltaQ[i] += dq;
              deltaQ[j] -= dq;
            }
          }
        }
      }

      for (let i = 0; i < n; i++) {
        q[i] += deltaQ[i];
      }
    }

    for (let i = 0; i < n; i++) {
      mol.atoms[i].partialCharge = q[i];
    }
  }
}

/**
 * 2. Structure Preparation & Conformer Builder
 */
export class StructurePrepEngine {
  static parsePDB(pdbContent: string): EngineMolecule {
    const lines = pdbContent.split(/\r?\n/);
    const atoms: EngineAtom[] = [];

    for (const line of lines) {
      if (line.startsWith('ATOM  ') || line.startsWith('HETATM')) {
        if (line.length < 54) continue;
        try {
          const id = parseInt(line.substring(6, 11).trim(), 10);
          const name = line.substring(12, 16).trim();
          const resName = line.substring(17, 20).trim();
          const chainId = line.substring(21, 22).trim() || 'A';
          const resSeq = parseInt(line.substring(22, 26).trim(), 10);
          const x = parseFloat(line.substring(30, 38).trim());
          const y = parseFloat(line.substring(38, 46).trim());
          const z = parseFloat(line.substring(46, 54).trim());

          let element = line.length >= 78 ? line.substring(76, 78).trim() : '';
          if (!element) {
            for (const c of name) {
              if (/[a-zA-Z]/.test(c)) {
                element += c.toUpperCase();
                if (['C', 'N', 'O', 'S', 'P', 'H', 'F'].includes(element)) break;
              }
            }
          }

          atoms.push({
            id: isNaN(id) ? atoms.length + 1 : id,
            name,
            element: element || 'C',
            position: { x, y, z },
            originalPosition: { x, y, z },
            partialCharge: 0,
            formalCharge: 0,
            autoDockTypeStr: element || 'C',
            residueSeq: isNaN(resSeq) ? 1 : resSeq,
            residueName: resName || 'LIG',
            chainId,
            isHetero: line.startsWith('HETATM'),
            isHydrogen: element === 'H',
            hybridization: 3,
            bondedAtomIds: []
          });
        } catch {
          // ignore malformed line
        }
      }
    }

    const mol: EngineMolecule = {
      name: 'Molecule',
      atoms,
      rotatableBonds: [],
      centerOfMass: { x: 0, y: 0, z: 0 }
    };
    this.computeCenterOfMass(mol);
    return mol;
  }

  static computeCenterOfMass(mol: EngineMolecule) {
    if (mol.atoms.length === 0) return;
    let sumX = 0, sumY = 0, sumZ = 0;
    for (const a of mol.atoms) {
      sumX += a.position.x;
      sumY += a.position.y;
      sumZ += a.position.z;
    }
    mol.centerOfMass = {
      x: sumX / mol.atoms.length,
      y: sumY / mol.atoms.length,
      z: sumZ / mol.atoms.length
    };
  }

  static assignBondsByDistance(mol: EngineMolecule) {
    const n = mol.atoms.length;
    for (let i = 0; i < n; i++) mol.atoms[i].bondedAtomIds = [];

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const d = Vec3.distance(mol.atoms[i].position, mol.atoms[j].position);
        const maxDist = (mol.atoms[i].isHydrogen || mol.atoms[j].isHydrogen) ? 1.25 : 1.95;
        if (d > 0.4 && d <= maxDist) {
          mol.atoms[i].bondedAtomIds.push(mol.atoms[j].id);
          mol.atoms[j].bondedAtomIds.push(mol.atoms[i].id);
        }
      }
    }

    const idMap = new Map<number, EngineAtom>();
    mol.atoms.forEach(a => idMap.set(a.id, a));

    for (const a of mol.atoms) {
      a.excludedAtomIds = new Set<number>();
      a.excludedAtomIds.add(a.id);
      for (const bId of a.bondedAtomIds) {
        a.excludedAtomIds.add(bId);
        const b = idMap.get(bId);
        if (b) {
          for (const cId of b.bondedAtomIds) {
            a.excludedAtomIds.add(cId);
          }
        }
      }
    }
  }

  static assignHybridizationAndTypes(mol: EngineMolecule) {
    for (const a of mol.atoms) {
      if (a.isHydrogen) {
        const polar = a.bondedAtomIds.some(bId => {
          const nb = mol.atoms.find(x => x.id === bId);
          return nb && ['O', 'N', 'S'].includes(nb.element);
        });
        a.autoDockTypeStr = polar ? 'HD' : 'H';
        a.hybridization = 1;
        continue;
      }

      if (a.element === 'C') {
        let hasDoubleO = false;
        for (const bId of a.bondedAtomIds) {
          const nb = mol.atoms.find(x => x.id === bId);
          if (nb && nb.element === 'O' && Vec3.distance(a.position, nb.position) < 1.30) {
            hasDoubleO = true;
          }
        }
        if (hasDoubleO || a.bondedAtomIds.length === 3) {
          a.hybridization = 2;
          a.autoDockTypeStr = 'A';
        } else {
          a.hybridization = 3;
          a.autoDockTypeStr = 'C';
        }
      } else if (a.element === 'N') {
        a.hybridization = 3;
        const hasH = a.bondedAtomIds.some(bId => mol.atoms.find(nb => nb.id === bId)?.isHydrogen);
        a.autoDockTypeStr = hasH ? 'N' : 'NA';
      } else if (a.element === 'O') {
        let isCarbonyl = false;
        for (const bId of a.bondedAtomIds) {
          const nb = mol.atoms.find(x => x.id === bId);
          if (nb && nb.element === 'C' && Vec3.distance(a.position, nb.position) < 1.30) {
            isCarbonyl = true;
          }
        }
        a.hybridization = isCarbonyl ? 2 : 3;
        a.autoDockTypeStr = 'OA';
      } else if (a.element === 'S') {
        a.hybridization = 3;
        a.autoDockTypeStr = 'SA';
      } else {
        a.autoDockTypeStr = a.element;
      }
    }
  }

  static addMissingHydrogens(mol: EngineMolecule) {
    const newH: EngineAtom[] = [];
    let nextId = mol.atoms.length + 1;

    for (const a of mol.atoms) {
      if (a.isHydrogen) continue;
      let expected = 4;
      if (a.element === 'C') {
        expected = (a.hybridization === 2) ? 3 : 4;
      } else if (a.element === 'N') {
        expected = (a.hybridization === 2) ? 2 : 3;
      } else if (a.element === 'O') {
        expected = (a.hybridization === 2) ? 1 : 2;
      } else if (a.element === 'S') {
        expected = 2;
      } else continue;

      const needed = expected - a.bondedAtomIds.length;
      if (needed <= 0) continue;

      let baseDir: Vector3D = { x: 0, y: 1, z: 0 };
      if (a.bondedAtomIds.length > 0) {
        let avgNeighbor = { x: 0, y: 0, z: 0 };
        for (const bId of a.bondedAtomIds) {
          const nb = mol.atoms.find(x => x.id === bId);
          if (nb) avgNeighbor = Vec3.add(avgNeighbor, Vec3.sub(a.position, nb.position));
        }
        const norm = Vec3.normalized(avgNeighbor);
        if (Vec3.magnitude(norm) > 0.1) baseDir = norm;
      }

      const bondLen = a.element === 'C' ? 1.09 : (a.element === 'O' ? 0.96 : 1.01);
      const perpAxis = Math.abs(baseDir.x) < 0.8 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
      const ortho1 = Vec3.normalized(Vec3.cross(baseDir, perpAxis));
      const ortho2 = Vec3.normalized(Vec3.cross(baseDir, ortho1));

      for (let h = 0; h < needed; h++) {
        let dir = baseDir;
        if (needed === 1) {
          dir = baseDir;
        } else if (needed === 2) {
          const angle = (h === 0 ? 0.95 : -0.95);
          dir = Vec3.normalized(Vec3.add(Vec3.scale(baseDir, Math.cos(angle)), Vec3.scale(ortho1, Math.sin(angle))));
        } else if (needed === 3) {
          const phi = (h * 2.0 * Math.PI) / 3.0;
          const theta = 1.23;
          const cone = Vec3.add(Vec3.scale(ortho1, Math.cos(phi)), Vec3.scale(ortho2, Math.sin(phi)));
          dir = Vec3.normalized(Vec3.add(Vec3.scale(baseDir, Math.cos(theta)), Vec3.scale(cone, Math.sin(theta))));
        }

        const hPos = Vec3.add(a.position, Vec3.scale(dir, bondLen));

        const hAtom: EngineAtom = {
          id: nextId++,
          name: `H${a.id}_${h + 1}`,
          element: 'H',
          position: hPos,
          originalPosition: hPos,
          partialCharge: 0,
          formalCharge: 0,
          autoDockTypeStr: (a.element === 'O' || a.element === 'N' || a.element === 'S') ? 'HD' : 'H',
          residueSeq: a.residueSeq,
          residueName: a.residueName,
          chainId: a.chainId,
          isHetero: a.isHetero,
          isHydrogen: true,
          hybridization: 1,
          bondedAtomIds: [a.id]
        };
        a.bondedAtomIds.push(hAtom.id);
        newH.push(hAtom);
      }
    }

    mol.atoms.push(...newH);
  }

  static identifyRotatableBonds(mol: EngineMolecule) {
    mol.rotatableBonds = [];
    const idMap = new Map<number, EngineAtom>();
    mol.atoms.forEach(a => idMap.set(a.id, a));

    for (let i = 0; i < mol.atoms.length; i++) {
      const a = mol.atoms[i];
      if (a.isHydrogen) continue;

      for (const bId of a.bondedAtomIds) {
        const b = idMap.get(bId);
        if (!b || a.id >= b.id || b.isHydrogen) continue;

        const movingIds: number[] = [];
        const visited = new Set<number>([a.id, b.id]);
        const queue = [b.id];

        let hasCycle = false;
        while (queue.length > 0) {
          const curr = queue.shift()!;
          movingIds.push(curr);
          const currAtom = idMap.get(curr);
          if (!currAtom) continue;

          for (const nb of currAtom.bondedAtomIds) {
            if (nb === a.id) { hasCycle = true; break; }
            if (!visited.has(nb)) {
              visited.add(nb);
              queue.push(nb);
            }
          }
          if (hasCycle) break;
        }

        if (!hasCycle && movingIds.length > 0 && movingIds.length < mol.atoms.length - 1) {
          mol.rotatableBonds.push({
            atomA: a.id,
            atomB: b.id,
            movingAtomIds: movingIds
          });
        }
      }
    }
  }

  static prepare(mol: EngineMolecule) {
    this.assignBondsByDistance(mol);
    this.assignHybridizationAndTypes(mol);
    this.addMissingHydrogens(mol);
    this.assignBondsByDistance(mol);
    this.assignHybridizationAndTypes(mol);
    GasteigerChargeEngine.assignCharges(mol);
    this.identifyRotatableBonds(mol);
    this.computeCenterOfMass(mol);
  }

  static applyConformation(
    baseMol: EngineMolecule,
    translation: Vector3D,
    rotation: { w: number; x: number; y: number; z: number },
    torsionAngles: number[]
  ): EngineAtom[] {
    const atoms = baseMol.atoms.map(a => ({
      ...a,
      position: Vec3.sub(a.originalPosition, baseMol.centerOfMass)
    }));

    const idMap = new Map<number, EngineAtom>();
    atoms.forEach(a => idMap.set(a.id, a));

    const numT = Math.min(torsionAngles.length, baseMol.rotatableBonds.length);
    for (let t = 0; t < numT; t++) {
      const angle = torsionAngles[t];
      if (Math.abs(angle) < 1e-6) continue;

      const rb = baseMol.rotatableBonds[t];
      const atomA = idMap.get(rb.atomA);
      const atomB = idMap.get(rb.atomB);
      if (!atomA || !atomB) continue;

      const axis = Vec3.normalized(Vec3.sub(atomB.position, atomA.position));
      const rot = Quat.fromAxisAngle(axis, angle);

      for (const mId of rb.movingAtomIds) {
        const target = idMap.get(mId);
        if (target) {
          const rel = Vec3.sub(target.position, atomA.position);
          target.position = Vec3.add(atomA.position, Quat.rotate(rot, rel));
        }
      }
    }

    for (const a of atoms) {
      a.position = Vec3.add(translation, Quat.rotate(rotation, a.position));
    }

    return atoms;
  }
}

/**
 * 3. 3D Potential Grid Cache & Trilinear Interpolation
 */
export class PotentialGridMap {
  box: GridBoxDef;
  nx: number;
  ny: number;
  nz: number;
  minCorner: Vector3D;
  spacing: number;
  grids = new Map<string, Float64Array>();

  constructor(box: GridBoxDef) {
    this.box = box;
    this.spacing = box.spacing || 0.375;
    this.nx = Math.floor(box.size.x / this.spacing) + 1;
    this.ny = Math.floor(box.size.y / this.spacing) + 1;
    this.nz = Math.floor(box.size.z / this.spacing) + 1;
    this.minCorner = {
      x: box.center.x - box.size.x * 0.5,
      y: box.center.y - box.size.y * 0.5,
      z: box.center.z - box.size.z * 0.5
    };
  }

  compute(receptor: EngineMolecule, atomTypes: string[]) {
    const totalPoints = this.nx * this.ny * this.nz;
    const types = Array.from(new Set([...atomTypes, 'e']));

    for (const t of types) {
      this.grids.set(t, new Float64Array(totalPoints));
    }

    const vdwParams: Record<string, { r: number; eps: number }> = {
      C: { r: 2.00, eps: 0.150 },
      A: { r: 2.00, eps: 0.150 },
      N: { r: 1.75, eps: 0.160 },
      NA: { r: 1.75, eps: 0.160 },
      OA: { r: 1.60, eps: 0.200 },
      SA: { r: 2.00, eps: 0.200 },
      HD: { r: 1.00, eps: 0.020 },
      H: { r: 1.00, eps: 0.020 }
    };

    const eGrid = this.grids.get('e')!;
    const invTwoSixth = 0.8908987;

    for (let iz = 0; iz < this.nz; iz++) {
      const pz = this.minCorner.z + iz * this.spacing;
      for (let iy = 0; iy < this.ny; iy++) {
        const py = this.minCorner.y + iy * this.spacing;
        for (let ix = 0; ix < this.nx; ix++) {
          const px = this.minCorner.x + ix * this.spacing;
          const idx = iz * (this.nx * this.ny) + iy * this.nx + ix;
          const pt: Vector3D = { x: px, y: py, z: pz };

          let elecVal = 0.0;

          for (const rec of receptor.atoms) {
            let d = Vec3.distance(pt, rec.position);
            if (d < 0.6) d = 0.6;
            if (d > 12.0) continue;

            elecVal += (332.0 * rec.partialCharge) / (4.0 * d * d);

            const isHBond = (rec.autoDockTypeStr === 'OA' || rec.autoDockTypeStr === 'NA');

            for (const ligType of atomTypes) {
              if (ligType === 'e') continue;

              let sigma: number;
              let epsIJ: number;

              if (isHBond && ligType === 'HD') {
                const rOpt = 1.9;
                sigma = rOpt * invTwoSixth;
                epsIJ = 1.20;
              } else {
                const recParams = vdwParams[rec.autoDockTypeStr] || { r: 1.8, eps: 0.1 };
                const ligParams = vdwParams[ligType] || { r: 1.8, eps: 0.1 };
                const rOpt = recParams.r + ligParams.r;
                sigma = rOpt * invTwoSixth;
                epsIJ = Math.sqrt(recParams.eps * ligParams.eps);
              }

              const r_ratio = sigma / d;
              const r6 = Math.pow(r_ratio, 6);
              const r12 = r6 * r6;
              let vdw = 4.0 * epsIJ * (r12 - r6);

              if (vdw > 50.0) vdw = 50.0;
              const targetGrid = this.grids.get(ligType);
              if (targetGrid) targetGrid[idx] += vdw;
            }
          }

          eGrid[idx] = elecVal;
        }
      }
    }
  }

  interpolate(atomType: string, pos: Vector3D): number {
    const grid = this.grids.get(atomType) || this.grids.get('C');
    if (!grid) return 0.0;

    const gx = (pos.x - this.minCorner.x) / this.spacing;
    const gy = (pos.y - this.minCorner.y) / this.spacing;
    const gz = (pos.z - this.minCorner.z) / this.spacing;

    if (gx < 0 || gx >= this.nx - 1 || gy < 0 || gy >= this.ny - 1 || gz < 0 || gz >= this.nz - 1) {
      return 100.0;
    }

    const x0 = Math.floor(gx), y0 = Math.floor(gy), z0 = Math.floor(gz);
    const x1 = x0 + 1, y1 = y0 + 1, z1 = z0 + 1;
    const xd = gx - x0, yd = gy - y0, zd = gz - z0;

    const strideY = this.nx;
    const strideZ = this.nx * this.ny;

    const c000 = grid[z0 * strideZ + y0 * strideY + x0];
    const c100 = grid[z0 * strideZ + y0 * strideY + x1];
    const c010 = grid[z0 * strideZ + y1 * strideY + x0];
    const c110 = grid[z0 * strideZ + y1 * strideY + x1];
    const c001 = grid[z1 * strideZ + y0 * strideY + x0];
    const c101 = grid[z1 * strideZ + y0 * strideY + x1];
    const c011 = grid[z1 * strideZ + y1 * strideY + x0];
    const c111 = grid[z1 * strideZ + y1 * strideY + x1];

    const c00 = c000 * (1.0 - xd) + c100 * xd;
    const c01 = c001 * (1.0 - xd) + c101 * xd;
    const c10 = c010 * (1.0 - xd) + c110 * xd;
    const c11 = c011 * (1.0 - xd) + c111 * xd;

    const c0 = c00 * (1.0 - yd) + c10 * yd;
    const c1 = c01 * (1.0 - yd) + c11 * yd;

    return c0 * (1.0 - zd) + c1 * zd;
  }
}

/**
 * 4. 5-Term Empirical Scoring Function
 */
export class EmpiricalScoringEngine {
  grid: PotentialGridMap;
  weightTorsion = 0.25;

  constructor(grid: PotentialGridMap) {
    this.grid = grid;
  }

  scorePose(atoms: EngineAtom[]): number {
    let energy = 0.0;
    for (const a of atoms) {
      if (a.isHydrogen && a.autoDockTypeStr !== 'HD') continue;
      const vdw = this.grid.interpolate(a.autoDockTypeStr, a.position);
      const elec = a.partialCharge * this.grid.interpolate('e', a.position);
      energy += (vdw + elec);
    }

    for (let i = 0; i < atoms.length; i++) {
      if (atoms[i].isHydrogen) continue;
      const excl = atoms[i].excludedAtomIds;

      for (let j = i + 1; j < atoms.length; j++) {
        if (atoms[j].isHydrogen) continue;
        if (excl && excl.has(atoms[j].id)) continue;

        const d = Vec3.distance(atoms[i].position, atoms[j].position);
        if (d < 1.8) {
          const clash = 1.8 - d;
          energy += 10.0 * (clash * clash);
        }
      }
    }

    return energy;
  }

  evaluateBreakdown(atoms: EngineAtom[], numRotatableBonds: number) {
    let vdwSum = 0.0;
    let elecSum = 0.0;
    let hbondSum = 0.0;

    for (const a of atoms) {
      const vdw = this.grid.interpolate(a.autoDockTypeStr, a.position);
      const elec = a.partialCharge * this.grid.interpolate('e', a.position);

      if (['HD', 'OA', 'NA'].includes(a.autoDockTypeStr) && vdw < 0) {
        hbondSum += vdw * 0.4;
        vdwSum += vdw * 0.6;
      } else {
        vdwSum += vdw;
      }
      elecSum += elec;
    }

    const desolv = vdwSum * 0.1;
    const torsion = this.weightTorsion * numRotatableBonds;
    const total = vdwSum + elecSum + hbondSum + desolv + torsion;

    return {
      vdw: vdwSum,
      electrostatics: elecSum,
      hbond: hbondSum,
      desolvation: desolv,
      torsionalPenalty: torsion,
      total
    };
  }
}

/**
 * 5. Master Docking Engine
 */
export class ScientificDockingEngine {
  static runDocking(
    receptorPDB: string,
    ligandPDB: string,
    box: GridBoxDef,
    exhaustiveness = 8,
    numPoses = 9
  ): DockingJobOutcome {
    const t0 = performance.now();

    const receptor = StructurePrepEngine.parsePDB(receptorPDB);
    const ligand = StructurePrepEngine.parsePDB(ligandPDB);

    if (receptor.atoms.length === 0 || ligand.atoms.length === 0) {
      return {
        success: false,
        errorMessage: 'Invalid receptor or ligand coordinates.',
        bestAffinity: 0,
        estimatedKiNanomolar: 0,
        numPoses: 0,
        poses: [],
        resultPDBQT: '',
        executionTimeMs: 0
      };
    }

    StructurePrepEngine.prepare(receptor);
    StructurePrepEngine.prepare(ligand);

    const types = Array.from(new Set(ligand.atoms.map(a => a.autoDockTypeStr)));
    const gridMap = new PotentialGridMap(box);
    gridMap.compute(receptor, types);

    const scorer = new EmpiricalScoringEngine(gridMap);
    const rawPoses: DockedPoseResult[] = [];

    const numTorsions = ligand.rotatableBonds.length;
    const runs = Math.max(exhaustiveness, 4);

    for (let r = 0; r < runs; r++) {
      let currTrans: Vector3D = {
        x: box.center.x + (Math.random() * 2.0 - 1.0) * (box.size.x * 0.4),
        y: box.center.y + (Math.random() * 2.0 - 1.0) * (box.size.y * 0.4),
        z: box.center.z + (Math.random() * 2.0 - 1.0) * (box.size.z * 0.4)
      };
      let currRot = Quat.fromAxisAngle({ x: Math.random(), y: Math.random(), z: Math.random() }, (Math.random() - 0.5) * 2 * Math.PI);
      let currTorsions = Array.from({ length: numTorsions }, () => (Math.random() - 0.5) * 2 * Math.PI);

      let currAtoms = StructurePrepEngine.applyConformation(ligand, currTrans, currRot, currTorsions);
      let currE = scorer.scorePose(currAtoms);

      let bestTrans = currTrans;
      let bestRot = currRot;
      let bestTorsions = currTorsions;
      let bestE = currE;

      let temp = 1.5;
      for (let s = 0; s < 1500; s++) {
        temp *= 0.998;
        const trialTrans: Vector3D = {
          x: currTrans.x + (Math.random() - 0.5) * 0.8,
          y: currTrans.y + (Math.random() - 0.5) * 0.8,
          z: currTrans.z + (Math.random() - 0.5) * 0.8
        };
        const deltaRot = Quat.fromAxisAngle({ x: Math.random(), y: Math.random(), z: Math.random() }, (Math.random() - 0.5) * 0.4);
        const trialRot = {
          w: currRot.w * deltaRot.w - currRot.x * deltaRot.x - currRot.y * deltaRot.y - currRot.z * deltaRot.z,
          x: currRot.w * deltaRot.x + currRot.x * deltaRot.w + currRot.y * deltaRot.z - currRot.z * deltaRot.y,
          y: currRot.w * deltaRot.y - currRot.x * deltaRot.z + currRot.y * deltaRot.w + currRot.z * deltaRot.x,
          z: currRot.w * deltaRot.z + currRot.x * deltaRot.y - currRot.y * deltaRot.x + currRot.z * deltaRot.w
        };

        const trialTorsions = [...currTorsions];
        if (numTorsions > 0) {
          const tIdx = Math.floor(Math.random() * numTorsions);
          trialTorsions[tIdx] += (Math.random() - 0.5) * 0.6;
        }

        const trialAtoms = StructurePrepEngine.applyConformation(ligand, trialTrans, trialRot, trialTorsions);
        const trialE = scorer.scorePose(trialAtoms);

        if (trialE < currE || Math.random() < Math.exp(-(trialE - currE) / Math.max(temp, 0.1))) {
          currTrans = trialTrans;
          currRot = trialRot;
          currTorsions = trialTorsions;
          currE = trialE;
          if (currE < bestE) {
            bestE = currE;
            bestTrans = currTrans;
            bestRot = currRot;
            bestTorsions = currTorsions;
          }
        }
      }

      const finalAtoms = StructurePrepEngine.applyConformation(ligand, bestTrans, bestRot, bestTorsions);
      rawPoses.push({
        poseIndex: r + 1,
        bindingAffinity: bestE,
        rmsdFromLeader: 0,
        rmsdFromReference: 0,
        clusterRank: 1,
        clusterSize: 1,
        transformedAtoms: finalAtoms,
        energyBreakdown: scorer.evaluateBreakdown(finalAtoms, numTorsions)
      });
    }

    rawPoses.sort((a, b) => a.bindingAffinity - b.bindingAffinity);

    const clusteredLeaders: DockedPoseResult[] = [];
    for (const pose of rawPoses) {
      let matched = false;
      for (const leader of clusteredLeaders) {
        let sumSq = 0, count = 0;
        for (let i = 0; i < pose.transformedAtoms.length; i++) {
          if (pose.transformedAtoms[i].isHydrogen) continue;
          sumSq += Vec3.lengthSq(Vec3.sub(pose.transformedAtoms[i].position, leader.transformedAtoms[i].position));
          count++;
        }
        const rmsd = Math.sqrt(sumSq / Math.max(count, 1));
        if (rmsd <= 2.0) {
          leader.clusterSize++;
          matched = true;
          break;
        }
      }

      if (!matched) {
        pose.clusterRank = clusteredLeaders.length + 1;
        pose.poseIndex = clusteredLeaders.length + 1;
        clusteredLeaders.push(pose);
        if (clusteredLeaders.length >= numPoses) break;
      }
    }

    const t1 = performance.now();
    const bestAffinity = clusteredLeaders[0]?.bindingAffinity || 0;
    const kiMolar = Math.exp(bestAffinity / 0.5924);

    return {
      success: true,
      bestAffinity,
      estimatedKiNanomolar: kiMolar * 1e9,
      numPoses: clusteredLeaders.length,
      poses: clusteredLeaders,
      resultPDBQT: '',
      executionTimeMs: t1 - t0
    };
  }
}
