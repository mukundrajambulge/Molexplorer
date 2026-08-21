import { CanonicalAtom, CanonicalBond, CanonicalTopology, CanonicalMolecule, CanonicalMolecularDocument } from '../types/domain';
import { toCanonicalAtomSet } from '../domain/AtomAdapter';
import { toCanonicalBondSet, buildCanonicalTopology } from '../domain/BondAdapter';
import { buildCanonicalMolecule } from '../domain/HierarchyAdapter';
import { buildCanonicalDocument } from '../domain/DocumentAdapter';

// Safe non-top-level-await import for 3dmol
let $3Dmol: any = { Parsers: { mmtf: () => [] } };
if (typeof window !== 'undefined') {
  import('3dmol').then(m => { $3Dmol = m.default || m; });
}

export type SSType = 'helix' | 'sheet' | 'loop' | 'undetermined';

export interface SSInfo {
  resi: number;
  chainID: string;
  resName: string;
  ss_type: SSType;
  confidence_or_undetermined: boolean;
}


export interface Transformation {
  r: number[][];
  t: number[];
}

export interface BiologicalAssembly {
  id: string;
  isIdentityOnly: boolean;
  operations: {
    chains: string[];
    matrices: Transformation[];
  }[];
}

export interface Atom {
  serial: number;
  name: string;
  resName: string;
  chainID: string;
  resSeq: number;
  x: number;
  y: number;
  z: number;
  elem: string;
  altLoc: string;
  isHetero: boolean;
  bonds: number[]; // indices of bonded atoms
  isModeledH?: boolean;
  ss?: string; // secondary structure: 'helix' | 'sheet' | 'loop'
  bFactor?: number;
  occupancy?: number;
}

const COVALENT_RADII: Record<string, number> = {
  H: 0.31, C: 0.76, N: 0.71, O: 0.66, S: 1.05, P: 1.07, F: 0.57, CL: 1.02, BR: 1.20, I: 1.39,
  MG: 1.41, ZN: 1.22, FE: 1.32, CA: 1.76, NA: 1.66, K: 2.03
};

function getRadius(elem: string) {
  return COVALENT_RADII[elem.toUpperCase()] || 0.75;
}

interface Vec3 { x: number, y: number, z: number }

function sub(a: Vec3, b: Vec3): Vec3 { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
function dot(a: Vec3, b: Vec3): number { return a.x * b.x + a.y * b.y + a.z * b.z; }
function norm(a: Vec3): number { return Math.sqrt(dot(a, a)); }

function dihedral(p1: Vec3, p2: Vec3, p3: Vec3, p4: Vec3): number {
  const b1 = sub(p2, p1);
  const b2 = sub(p3, p2);
  const b3 = sub(p4, p3);

  const n1 = cross(b1, b2);
  const n2 = cross(b2, b3);

  const b2Norm = norm(b2);
  if (b2Norm === 0) return 0;
  const b2Unit = { x: b2.x / b2Norm, y: b2.y / b2Norm, z: b2.z / b2Norm };

  const x = dot(n1, n2);
  const y = dot(cross(n1, n2), b2Unit);

  return Math.atan2(-y, x) * 180 / Math.PI;
}

export function formatAtomLine(a: Atom): string {
  const record = a.isHetero ? "HETATM" : "ATOM  ";
  const serial = a.serial.toString().padStart(5, ' ');
  const name = a.name.padEnd(4, ' ').substring(0, 4);
  const altLoc = a.altLoc || ' ';
  const resName = a.resName.padStart(3, ' ').substring(0, 3);
  const chain = (a.chainID || ' ').substring(0, 1);
  const resSeq = a.resSeq.toString().padStart(4, ' ');
  const x = a.x.toFixed(3).padStart(8, ' ');
  const y = a.y.toFixed(3).padStart(8, ' ');
  const z = a.z.toFixed(3).padStart(8, ' ');
  const elem = a.elem.padStart(2, ' ').substring(0, 2);
  const bFactor = a.bFactor !== undefined ? a.bFactor.toFixed(2).padStart(6, ' ') : (a.isModeledH ? " 99.90" : "  0.00");
  const occ = a.occupancy !== undefined ? a.occupancy.toFixed(2).padStart(6, ' ') : "  1.00";
  return `${record}${serial} ${name}${altLoc}${resName} ${chain}${resSeq}    ${x}${y}${z}${occ}${bFactor}          ${elem}  `;
}

export class MolProcessor {
  atoms: Atom[] = [];
  rawPDB: string = "";
  
  ss_mode: 'pdb' | 'quick' | 'dssp' = 'quick';
  ss_per_residue: SSInfo[] = [];

  assemblies: BiologicalAssembly[] = [];
  symmetry_matrices: Transformation[] = [];
  hasCryst1: boolean = false;
  debug_remarks: string[] = [];

  private _cachedCanonicalAtoms: CanonicalAtom[] | null = null;
  private _cachedCanonicalSource: Atom[] | null = null;
  private _cachedCanonicalBonds: CanonicalBond[] | null = null;
  private _cachedCanonicalBondsSource: Atom[] | null = null;
  private _cachedCanonicalTopology: CanonicalTopology | null = null;
  private _cachedCanonicalMolecule: CanonicalMolecule | null = null;
  private _cachedCanonicalDocument: CanonicalMolecularDocument | null = null;

  /**
   * Retrieves the canonical Atom domain representation of parsed atoms.
   * Derived deterministically via AtomAdapter, strictly matching DATA_MODEL_SPEC.yaml.
   * Caches the result and automatically invalidates if processor atoms array reference changes.
   */
  public getCanonicalAtoms(moleculeRef?: string): CanonicalAtom[] {
    if (!this._cachedCanonicalAtoms || this._cachedCanonicalSource !== this.atoms) {
      this._cachedCanonicalAtoms = toCanonicalAtomSet(this.atoms, { moleculeRef });
      this._cachedCanonicalSource = this.atoms;
    }
    return this._cachedCanonicalAtoms;
  }

  /**
   * Retrieves the canonical Bond domain representation of molecular connectivity.
   * Endpoints reference CanonicalAtom IDs (canonical_id), strictly normalized with atom_a < atom_b.
   * Caches the result and automatically invalidates if processor atoms array reference changes.
   */
  public getCanonicalBonds(moleculeRef?: string): CanonicalBond[] {
    if (!this._cachedCanonicalBonds || this._cachedCanonicalBondsSource !== this.atoms) {
      const canonicalAtoms = this.getCanonicalAtoms(moleculeRef);
      this._cachedCanonicalBonds = toCanonicalBondSet(canonicalAtoms, this.atoms, {
        defaultSource: 'inferred'
      });
      this._cachedCanonicalBondsSource = this.atoms;
      this._cachedCanonicalTopology = null; // Invalidate topology cache
      this._cachedCanonicalMolecule = null; // Invalidate molecule cache
      this._cachedCanonicalDocument = null; // Invalidate document cache
    }
    return this._cachedCanonicalBonds;
  }

  /**
   * Retrieves the complete CanonicalTopology graph containing sorted bonds,
   * adjacency lists, and fast composite-key bond lookups.
   */
  public getCanonicalTopology(moleculeRef?: string): CanonicalTopology {
    if (!this._cachedCanonicalTopology || this._cachedCanonicalBondsSource !== this.atoms) {
      const canonicalAtoms = this.getCanonicalAtoms(moleculeRef);
      const canonicalBonds = this.getCanonicalBonds(moleculeRef);
      this._cachedCanonicalTopology = buildCanonicalTopology(canonicalAtoms, canonicalBonds);
      this._cachedCanonicalMolecule = null; // Invalidate molecule cache
      this._cachedCanonicalDocument = null; // Invalidate document cache
    }
    return this._cachedCanonicalTopology;
  }

  /**
   * Retrieves the complete CanonicalMolecule domain hierarchy.
   * Builds canonical chains, residues, atoms, and topology deterministically.
   * Caches the result and automatically invalidates if processor atoms array changes.
   */
  public getCanonicalMolecule(options?: { name?: string; moleculeId?: string }): CanonicalMolecule {
    if (!this._cachedCanonicalMolecule || this._cachedCanonicalBondsSource !== this.atoms) {
      const moleculeId = options?.moleculeId || 'mol-1';
      const canonicalAtoms = this.getCanonicalAtoms(moleculeId);
      const canonicalTopology = this.getCanonicalTopology(moleculeId);
      this._cachedCanonicalMolecule = buildCanonicalMolecule(canonicalAtoms, canonicalTopology, {
        molecule_id: moleculeId,
        name: options?.name || 'Molecule',
        source_format: 'pdb',
        raw_pdb: this.rawPDB,
        metadata: {
          has_cryst1: this.hasCryst1,
          debug_remarks: this.debug_remarks
        }
      });
      this._cachedCanonicalDocument = null; // Invalidate document cache
    }
    return this._cachedCanonicalMolecule;
  }

  /**
   * Retrieves the top-level CanonicalMolecularDocument workspace container.
   * Assembles the document, canonical object, molecule, and active coordinate state.
   * Caches the result and automatically invalidates if processor atoms change.
   */
  public getCanonicalDocument(options?: { name?: string; documentId?: string; moleculeId?: string }): CanonicalMolecularDocument {
    if (!this._cachedCanonicalDocument || this._cachedCanonicalBondsSource !== this.atoms) {
      const mol = this.getCanonicalMolecule({
        name: options?.name,
        moleculeId: options?.moleculeId
      });
      this._cachedCanonicalDocument = buildCanonicalDocument([mol], {
        document_id: options?.documentId || 'doc-default',
        name: options?.name || mol.name
      });
    }
    return this._cachedCanonicalDocument;
  }

  constructor(input: string | Uint8Array, format: 'pdb' | 'mmtf' = 'pdb') {
    if (format === 'pdb') {
      this.rawPDB = input as string;
      this.parsePDB(this.rawPDB);
      this.parseMatrices(this.rawPDB);
    } else if (format === 'mmtf') {
      this.rawPDB = "";
      this.parseMMTF(input as Uint8Array);
    }
  }

  parseMMTF(bindata: Uint8Array) {
    // 3Dmol's MMTF parser can be used directly
    // @ts-ignore
    const models = $3Dmol.Parsers.mmtf(bindata, { keepH: true, doAssembly: false, assignBonds: false, noComputeSecondaryStructure: true });
    
    this.atoms = [];
    const mmtfAtoms = models[0] || [];
    
    for (const a of mmtfAtoms) {
      let rawName = a.atom || "";
      const elem = (a.elem || "").trim().toUpperCase();
      if (rawName.length < 4 && elem.length === 1) {
         rawName = (" " + rawName).padEnd(4, ' ');
      } else {
         rawName = rawName.padEnd(4, ' ');
      }
      
      this.atoms.push({
        serial: a.serial || 0,
        name: rawName,
        resName: a.resn || "",
        chainID: a.chain || "",
        resSeq: a.resi || 0,
        x: a.x || 0,
        y: a.y || 0,
        z: a.z || 0,
        elem: elem,
        altLoc: a.altLoc || " ",
        isHetero: !!a.hetflag,
        bonds: [],
        isModeledH: false
      });
    }

    if (models.modelData && models.modelData[0]) {
      const md = models.modelData[0];
      
      // If 3Dmol extracts symmetry/biomt data, we can optionally parse it here.
      // Currently, we will just clear them to avoid errors if not present,
      // as MMTF biomt parsing in 3Dmol has a specific format.
      if (md.biomt) {
         // md.biomt is an object mapping chain IDs to an array of matrices
         // this is different from our BiologicalAssembly format, but we can reconstruct it.
         let biomtId = "1";
         this.assemblies = [{ id: biomtId, isIdentityOnly: false, operations: [] }];
         
         for (const [chainListStr, matrices] of Object.entries(md.biomt) as [string, any][]) {
            const chains = chainListStr.split(',');
            const opsMatrices = matrices.map((m: any) => {
               const r = [
                 [m.elements[0], m.elements[4], m.elements[8]],
                 [m.elements[1], m.elements[5], m.elements[9]],
                 [m.elements[2], m.elements[6], m.elements[10]]
               ];
               const t = [m.elements[12], m.elements[13], m.elements[14]];
               return { r, t };
            });
            this.assemblies[0].operations.push({ chains, matrices: opsMatrices });
         }
      }

      if (md.symmetries && Array.isArray(md.symmetries)) {
         this.symmetry_matrices = md.symmetries.map((m: any) => {
            const r = [
              [m.elements[0], m.elements[4], m.elements[8]],
              [m.elements[1], m.elements[5], m.elements[9]],
              [m.elements[2], m.elements[6], m.elements[10]]
            ];
            const t = [m.elements[12], m.elements[13], m.elements[14]];
            return { r, t };
         });
      }
    }
  }

  parseMatrices(pdbText: string) {
    const lines = pdbText.split('\n');
    
    let currentAssembly: BiologicalAssembly | null = null;
    let currentChains: string[] = [];
    let currentMatrices: Transformation[] = [];
    let currentMatrix: Transformation = { r: [[1,0,0],[0,1,0],[0,0,1]], t: [0,0,0] };
    let currentSmtryMatrix: Transformation = { r: [[1,0,0],[0,1,0],[0,0,1]], t: [0,0,0] };

    for (let line of lines) {
      line = line.trimEnd();
      if (line.includes("REMARK 350")) {
        this.debug_remarks.push(line);
      }
      if (line.startsWith("CRYST1") || line.includes("_cell.length_a") || line.includes("_symmetry.space_group_name_H_M")) {
         this.hasCryst1 = true;
      }
      else if (line.startsWith("REMARK 350 BIOMOLECULE:")) {
        if (currentAssembly && currentMatrices.length > 0) {
          currentAssembly.operations.push({ chains: [...currentChains], matrices: [...currentMatrices] });
          currentMatrices = [];
        }
        const id = line.substring(23).trim();
        currentAssembly = { id, isIdentityOnly: false, operations: [] };
        this.assemblies.push(currentAssembly);
      }
      else if (line.startsWith("REMARK 350 APPLY THE FOLLOWING TO CHAINS:")) {
        if (currentAssembly && currentMatrices.length > 0) {
          currentAssembly.operations.push({ chains: [...currentChains], matrices: [...currentMatrices] });
          currentMatrices = [];
        }
        const chainsPart = line.substring(41).trim();
        currentChains = chainsPart.split(/[, ]+/).filter(s => s && s !== 'AND');
      }
      else if (line.startsWith("REMARK 350   BIOMT")) {
        const match = line.match(/BIOMT([123])\s+\d+\s+([-.\d]+)\s+([-.\d]+)\s+([-.\d]+)\s+([-.\d]+)/);
        if (match) {
          const row = parseInt(match[1]) - 1;
          currentMatrix.r[row] = [parseFloat(match[2]), parseFloat(match[3]), parseFloat(match[4])];
          currentMatrix.t[row] = parseFloat(match[5]);
          if (row === 2) {
            currentMatrices.push(JSON.parse(JSON.stringify(currentMatrix)));
            currentMatrix = { r: [[1,0,0],[0,1,0],[0,0,1]], t: [0,0,0] };
          }
        }
      }
      else if (line.startsWith("REMARK 290   SMTRY")) {
        const match = line.match(/SMTRY([123])\s+\d+\s+([-.\d]+)\s+([-.\d]+)\s+([-.\d]+)\s+([-.\d]+)/);
        if (match) {
          const row = parseInt(match[1]) - 1;
          currentSmtryMatrix.r[row] = [parseFloat(match[2]), parseFloat(match[3]), parseFloat(match[4])];
          currentSmtryMatrix.t[row] = parseFloat(match[5]);
          if (row === 2) {
            this.symmetry_matrices.push(JSON.parse(JSON.stringify(currentSmtryMatrix)));
            currentSmtryMatrix = { r: [[1,0,0],[0,1,0],[0,0,1]], t: [0,0,0] };
          }
        }
      }
    }
    
    if (currentAssembly && currentMatrices.length > 0) {
      currentAssembly.operations.push({ chains: [...currentChains], matrices: [...currentMatrices] });
    }

    for (const assembly of this.assemblies) {
      assembly.isIdentityOnly = assembly.operations.every(op => 
        op.matrices.every(mat => 
          Math.abs(mat.r[0][0]-1)<1e-4 && Math.abs(mat.r[1][1]-1)<1e-4 && Math.abs(mat.r[2][2]-1)<1e-4 && 
          Math.abs(mat.t[0])<1e-4 && Math.abs(mat.t[1])<1e-4 && Math.abs(mat.t[2])<1e-4
        )
      );
    }
  }

  generateAssemblyPDB(assemblyId: string): { pdb: string, generated_chains: string[] } {
      const assembly = this.assemblies.find(a => a.id === assemblyId);
      if (!assembly) return { pdb: "", generated_chains: [] };

      let outPdb = "";
      const generatedChains = new Set<string>();

      for (const op of assembly.operations) {
          for (const mat of op.matrices) {
              const isIdentity = Math.abs(mat.r[0][0]-1)<1e-4 && Math.abs(mat.r[1][1]-1)<1e-4 && Math.abs(mat.r[2][2]-1)<1e-4 && Math.abs(mat.t[0])<1e-4 && Math.abs(mat.t[1])<1e-4 && Math.abs(mat.t[2])<1e-4;
              if (isIdentity) continue;

              for (const atom of this.atoms) {
                  if (op.chains.includes(atom.chainID)) {
                      const x = mat.r[0][0]*atom.x + mat.r[0][1]*atom.y + mat.r[0][2]*atom.z + mat.t[0];
                      const y = mat.r[1][0]*atom.x + mat.r[1][1]*atom.y + mat.r[1][2]*atom.z + mat.t[1];
                      const z = mat.r[2][0]*atom.x + mat.r[2][1]*atom.y + mat.r[2][2]*atom.z + mat.t[2];
                      outPdb += formatAtomLine({...atom, x, y, z}) + "\n";
                      generatedChains.add(atom.chainID);
                  }
              }
              outPdb += "TER\n";
          }
      }
      return { pdb: outPdb, generated_chains: Array.from(generatedChains) };
  }

  generateSymmetryPDB(): { pdb: string, count: number } {
      if (this.symmetry_matrices.length === 0) return { pdb: "", count: 0 };
      
      let outPdb = "";
      let count = 0;
      
      for (const mat of this.symmetry_matrices) {
          const isIdentity = Math.abs(mat.r[0][0]-1)<1e-4 && Math.abs(mat.r[1][1]-1)<1e-4 && Math.abs(mat.r[2][2]-1)<1e-4 && Math.abs(mat.t[0])<1e-4 && Math.abs(mat.t[1])<1e-4 && Math.abs(mat.t[2])<1e-4;
          if (isIdentity) continue;
          
          count++;
          for (const atom of this.atoms) {
              const x = mat.r[0][0]*atom.x + mat.r[0][1]*atom.y + mat.r[0][2]*atom.z + mat.t[0];
              const y = mat.r[1][0]*atom.x + mat.r[1][1]*atom.y + mat.r[1][2]*atom.z + mat.t[1];
              const z = mat.r[2][0]*atom.x + mat.r[2][1]*atom.y + mat.r[2][2]*atom.z + mat.t[2];
              outPdb += formatAtomLine({...atom, x, y, z}) + "\n";
          }
          outPdb += "TER\n";
      }
      return { pdb: outPdb, count };
  }

  pdb_ss_records: string[] = [];

  parsePDB(pdb: string) {
    this.atoms = [];
    this.pdb_ss_records = [];
    const lines = pdb.split('\n');
    for (const line of lines) {
      const cleanLine = line.replace(/\r/g, '');
      if (cleanLine.startsWith('HELIX') || cleanLine.startsWith('SHEET')) {
          this.pdb_ss_records.push(cleanLine);
      } else if (cleanLine.startsWith('ATOM  ') || cleanLine.startsWith('HETATM')) {
        const isHetero = cleanLine.startsWith('HETATM');
        const serial = parseInt(cleanLine.substring(6, 11).trim() || "0");
        let name = cleanLine.substring(12, 16);
        const altLoc = cleanLine.substring(16, 17);
        let resName = cleanLine.substring(17, 20);
        const chainID = cleanLine.substring(21, 22);
        const resSeq = parseInt(cleanLine.substring(22, 26).trim() || "0");
        const x = parseFloat(cleanLine.substring(30, 38));
        const y = parseFloat(cleanLine.substring(38, 46));
        const z = parseFloat(cleanLine.substring(46, 54));
        let elem = cleanLine.substring(76, 78).trim().toUpperCase();
        if (!elem) {
          elem = name.replace(/[0-9]/g, '').trim().substring(0, 1);
        }
        this.atoms.push({
          serial, name, resName, chainID, resSeq, x, y, z, elem, altLoc, isHetero, bonds: []
        });
      }
    }

    const serialToIdx = new Map<number, number>();
    this.atoms.forEach((a, i) => serialToIdx.set(a.serial, i));

    for (const line of lines) {
      const cleanLine = line.replace(/\r/g, '');
      if (cleanLine.startsWith('CONECT')) {
        const serial = parseInt(cleanLine.substring(6, 11).trim() || "0", 10);
        const sourceIdx = serialToIdx.get(serial);
        if (sourceIdx !== undefined) {
          const sourceAtom = this.atoms[sourceIdx];
          for (let col = 11; col + 5 <= cleanLine.length; col += 5) {
            const targetSerial = parseInt(cleanLine.substring(col, col + 5).trim() || "0", 10);
            if (targetSerial > 0) {
              const targetIdx = serialToIdx.get(targetSerial);
              if (targetIdx !== undefined && !sourceAtom.bonds.includes(targetIdx)) {
                sourceAtom.bonds.push(targetIdx);
              }
            }
          }
        }
      }
    }
  }

  filterAltlocs() {
    this.atoms = this.atoms.filter(a => a.altLoc === ' ' || a.altLoc === 'A' || a.altLoc === '1');
  }

  stripSolvent() {
    const solventNames = ['HOH', 'WAT', 'DOD'];
    this.atoms = this.atoms.filter(a => !solventNames.includes(a.resName.trim()));
  }

  stripLigandsIons() {
    const solventNames = ['HOH', 'WAT', 'DOD'];
    this.atoms = this.atoms.filter(a => {
       if (!a.isHetero) return true;
       if (solventNames.includes(a.resName.trim())) return true;
       return false;
    });
  }

  getLigands() {
    const solventNames = ['HOH', 'WAT', 'DOD'];
    const ligands = new Map<string, Atom[]>();
    
    this.atoms.forEach(a => {
      if (a.isHetero && !solventNames.includes(a.resName.trim())) {
        const key = `${a.resName.trim()}_${a.chainID}_${a.resSeq}`;
        if (!ligands.has(key)) ligands.set(key, []);
        ligands.get(key)!.push(a);
      }
    });
    return Array.from(ligands.values());
  }

  assignBonds(tolerance: number, keepExistingBonds: boolean = true) {
    if (!keepExistingBonds) {
      this.atoms.forEach(a => a.bonds = []);
    }
    
    // Spatial hashing for O(N) performance
    const cellSize = 3.0;
    const grid: Record<string, number[]> = {};
    const hash = (x: number, y: number, z: number) => {
      return `${Math.floor(x/cellSize)},${Math.floor(y/cellSize)},${Math.floor(z/cellSize)}`;
    };

    for (let i = 0; i < this.atoms.length; i++) {
      const h = hash(this.atoms[i].x, this.atoms[i].y, this.atoms[i].z);
      if (!grid[h]) grid[h] = [];
      grid[h].push(i);
    }

    const getNeighbors = (x: number, y: number, z: number) => {
      const cx = Math.floor(x/cellSize);
      const cy = Math.floor(y/cellSize);
      const cz = Math.floor(z/cellSize);
      const neighbors: number[] = [];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            const h = `${cx+dx},${cy+dy},${cz+dz}`;
            if (grid[h]) neighbors.push(...grid[h]);
          }
        }
      }
      return neighbors;
    };

    for (let i = 0; i < this.atoms.length; i++) {
      const a1 = this.atoms[i];
      const r1 = getRadius(a1.elem);
      const neighbors = getNeighbors(a1.x, a1.y, a1.z);
      
      for (const j of neighbors) {
        if (j <= i) continue;
        const a2 = this.atoms[j];
        
        // Skip bonds between different altlocs unless one is blank
        if (a1.altLoc !== ' ' && a2.altLoc !== ' ' && a1.altLoc !== a2.altLoc) continue;

        const r2 = getRadius(a2.elem);
        const maxDist = (r1 + r2) * tolerance;
        const maxDistSq = maxDist * maxDist;
        
        const dx = a1.x - a2.x;
        const dy = a1.y - a2.y;
        const dz = a1.z - a2.z;
        const distSq = dx*dx + dy*dy + dz*dz;
        
        // Min distance to avoid 0-distance bugs
        if (distSq > 0.16 && distSq <= maxDistSq) {
          if (!a1.bonds.includes(j)) a1.bonds.push(j);
          if (!a2.bonds.includes(i)) a2.bonds.push(i);
        }
      }
    }
  }

  calculateSecondaryStructure(mode: 'pdb' | 'quick' | 'dssp') {
    this.ss_mode = mode;
    this.ss_per_residue = [];

    const residuesMap = new Map<string, any>();
    const residuesList: any[] = [];
    
    for (const a of this.atoms) {
      if (a.isHetero) continue;
      
      const key = `${a.chainID}:${a.resSeq}`;
      if (!residuesMap.has(key)) {
        const newRes = { chainID: a.chainID, resSeq: a.resSeq, resName: a.resName, N: null, CA: null, C: null, O: null, key };
        residuesMap.set(key, newRes);
        residuesList.push(newRes);
      }
      
      const res = residuesMap.get(key);
      const nameClean = a.name.trim().toUpperCase();
      if (nameClean === 'N') res.N = a;
      else if (nameClean === 'CA') res.CA = a;
      else if (nameClean === 'C') res.C = a;
      else if (nameClean === 'O') res.O = a;
    }
    
    const dist = (p1: any, p2: any) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) + Math.pow(p1.z - p2.z, 2));
    
    const n = residuesList.length;
    for (let i = 0; i < n; i++) {
        residuesList[i].ss = 'loop';
        if (mode !== 'pdb' && (!residuesList[i].N || !residuesList[i].CA || !residuesList[i].C || !residuesList[i].O)) {
            residuesList[i].ss = 'undetermined';
        }
    }
    
    if (mode === 'pdb') {
        const ssRecords = [...this.pdb_ss_records];
        if (ssRecords.length === 0 && this.rawPDB) {
            const lines = this.rawPDB.split('\n');
            for (let l of lines) {
                l = l.replace(/\r/g, '');
                if (l.startsWith('HELIX') || l.startsWith('SHEET')) {
                    ssRecords.push(l);
                }
            }
        }

        for (const line of ssRecords) {
            const recName = line.substring(0, 6);
            if (recName.startsWith('HELIX')) {
                const initChainID = line.substring(19, 20).trim();
                const initSeqNum = parseInt(line.substring(21, 25).trim(), 10);
                const endChainID = line.substring(31, 32).trim();
                const endSeqNum = parseInt(line.substring(33, 37).trim(), 10);

                if (!isNaN(initSeqNum) && !isNaN(endSeqNum)) {
                    for (let j = 0; j < n; j++) {
                        const resChain = (residuesList[j].chainID || "").trim();
                        const chainMatches = (resChain === initChainID) || (!resChain && !initChainID) || (resChain === endChainID);
                        if (chainMatches && residuesList[j].resSeq >= initSeqNum && residuesList[j].resSeq <= endSeqNum) {
                            residuesList[j].ss = 'helix';
                        }
                    }
                }
            } else if (recName.startsWith('SHEET')) {
                const initChainID = line.substring(21, 22).trim();
                const initSeqNum = parseInt(line.substring(22, 26).trim(), 10);
                const endChainID = line.substring(32, 33).trim();
                const endSeqNum = parseInt(line.substring(33, 37).trim(), 10);

                if (!isNaN(initSeqNum) && !isNaN(endSeqNum)) {
                    for (let j = 0; j < n; j++) {
                        const resChain = (residuesList[j].chainID || "").trim();
                        const chainMatches = (resChain === initChainID) || (!resChain && !initChainID) || (resChain === endChainID);
                        if (chainMatches && residuesList[j].resSeq >= initSeqNum && residuesList[j].resSeq <= endSeqNum) {
                            residuesList[j].ss = 'sheet';
                        }
                    }
                }
            }
        }
    } else if (mode === 'quick') {
        for (let i = 1; i < n - 1; i++) {
            const prev = residuesList[i-1];
            const curr = residuesList[i];
            const next = residuesList[i+1];
            
            if (curr.ss === 'undetermined' || prev.ss === 'undetermined' || next.ss === 'undetermined') continue;
            if (prev.chainID !== curr.chainID || next.chainID !== curr.chainID) continue;
            if (dist(prev.C, curr.N) > 2.0 || dist(curr.C, next.N) > 2.0) continue;
            const phi = dihedral(prev.C, curr.N, curr.CA, curr.C);
            const psi = dihedral(curr.N, curr.CA, curr.C, next.N);
            
            if (phi >= -140 && phi <= -40 && psi >= -70 && psi <= 20) {
                curr.ss = 'helix';
            } 
            else if ((phi <= -40 || phi >= 140) && (psi >= 90 || psi <= -140)) {
                curr.ss = 'sheet';
            }
        }
    } else {
        for (let i = 1; i < n; i++) {
            const curr = residuesList[i];
            const prev = residuesList[i-1];
            
            if (curr.ss === 'undetermined' || prev.ss === 'undetermined') continue;
            if (prev.chainID !== curr.chainID || dist(prev.C, curr.N) > 2.0) continue;
            
            const c_prev = prev.C;
            const o_prev = prev.O;
            const n_curr = curr.N;
            
            const dx = o_prev.x - c_prev.x;
            const dy = o_prev.y - c_prev.y;
            const dz = o_prev.z - c_prev.z;
            const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
            if (len > 0) {
                curr.H = {
                    x: n_curr.x - (dx/len) * 1.0,
                    y: n_curr.y - (dy/len) * 1.0,
                    z: n_curr.z - (dz/len) * 1.0
                };
            }
        }
        
        const hBonds = new Set<string>();
        const q1 = 0.42;
        const q2 = 0.20;
        const f = 332;
        const e_cutoff = -0.5;
        
        for (let i = 0; i < n; i++) {
            const resI = residuesList[i];
            if (resI.ss === 'undetermined' || !resI.C || !resI.O) continue;
            
            for (let j = 0; j < n; j++) {
                if (i === j) continue;
                
                const resJ = residuesList[j];
                if (resJ.ss === 'undetermined' || !resJ.N || !resJ.H) continue;
                
                if (dist(resI.CA, resJ.CA) > 9.0) continue;
                
                const ron = dist(resI.O, resJ.N);
                const rch = dist(resI.C, resJ.H);
                const roh = dist(resI.O, resJ.H);
                const rcn = dist(resI.C, resJ.N);
                
                if (ron < 0.5 || rch < 0.5 || roh < 0.5 || rcn < 0.5) continue;
                
                const E = q1 * q2 * f * (1/ron + 1/rch - 1/roh - 1/rcn);
                if (E < e_cutoff) {
                    hBonds.add(`${i}->${j}`);
                }
            }
        }
        
        const isHelixAny = new Array(n).fill(false);
        for (let i = 0; i < n; i++) {
            if (hBonds.has(`${i}->${i+4}`)) {
                for (let k = i; k <= i+4; k++) isHelixAny[k] = true;
            } else if (hBonds.has(`${i}->${i+3}`)) {
                for (let k = i; k <= i+3; k++) isHelixAny[k] = true;
            } else if (hBonds.has(`${i}->${i+5}`)) {
                for (let k = i; k <= i+5; k++) isHelixAny[k] = true;
            }
        }
        
        const isBridge = new Array(n).fill(false);
        for (let i = 0; i < n; i++) {
            for (let j = i + 3; j < n; j++) {
                const ap1 = hBonds.has(`${i}->${j}`) && hBonds.has(`${j}->${i}`);
                const ap2 = hBonds.has(`${i-1}->${j+1}`) && hBonds.has(`${j-1}->${i+1}`);
                if (ap1 || ap2) {
                    isBridge[i] = true;
                    isBridge[j] = true;
                    if (ap2) { isBridge[i-1] = true; isBridge[j+1] = true; isBridge[j-1] = true; isBridge[i+1] = true; }
                }
                
                const p1 = hBonds.has(`${i-1}->${j}`) && hBonds.has(`${j}->${i+1}`);
                const p2 = hBonds.has(`${j-1}->${i}`) && hBonds.has(`${i}->${j+1}`);
                if (p1 || p2) {
                    isBridge[i] = true;
                    isBridge[j] = true;
                    if (p1) { isBridge[i-1] = true; isBridge[i+1] = true; }
                    if (p2) { isBridge[j-1] = true; isBridge[j+1] = true; }
                }
            }
        }
        
        for (let i = 0; i < n; i++) {
            if (residuesList[i].ss === 'undetermined') continue;
            
            if (isHelixAny[i]) residuesList[i].ss = 'helix';
            else if (isBridge[i]) residuesList[i].ss = 'sheet';
            else residuesList[i].ss = 'loop';
        }
    }
    
    if (mode !== 'pdb') {
        // Smoothing pass for both quick and dssp
        for (let iter = 0; iter < 2; iter++) {
            for (let i = 1; i < n - 1; i++) {
                if (residuesList[i-1].chainID !== residuesList[i].chainID || residuesList[i].chainID !== residuesList[i+1].chainID) continue;
                
                // 1-residue gap smoothing
                if (residuesList[i-1].ss === residuesList[i+1].ss && residuesList[i-1].ss !== 'loop' && residuesList[i].ss === 'loop') {
                    residuesList[i].ss = residuesList[i-1].ss;
                }
            }
            for (let i = 1; i < n - 2; i++) {
                if (residuesList[i-1].chainID !== residuesList[i+2].chainID) continue;
                
                // 2-residue gap smoothing
                if (residuesList[i-1].ss === residuesList[i+2].ss && residuesList[i-1].ss !== 'loop' && residuesList[i].ss === 'loop' && residuesList[i+1].ss === 'loop') {
                    residuesList[i].ss = residuesList[i-1].ss;
                    residuesList[i+1].ss = residuesList[i-1].ss;
                }
            }
        }
        
        // Remove isolated short elements (helices < 4, sheets < 3)
        let currentRunType = 'loop';
        let currentRunLength = 0;
        let currentRunStart = 0;
        
        for (let i = 0; i <= n; i++) {
            const isEnd = i === n || residuesList[i].chainID !== residuesList[currentRunStart]?.chainID;
            const type = i < n ? residuesList[i].ss : 'loop';
            
            if (isEnd || type !== currentRunType) {
                if (currentRunType === 'helix' && currentRunLength < 4) {
                    for (let j = currentRunStart; j < i; j++) residuesList[j].ss = 'loop';
                } else if (currentRunType === 'sheet' && currentRunLength < 3) {
                    for (let j = currentRunStart; j < i; j++) residuesList[j].ss = 'loop';
                }
                
                if (i < n) {
                    currentRunType = type;
                    currentRunStart = i;
                    currentRunLength = 1;
                }
            } else {
                currentRunLength++;
            }
        }
    }

    for (const res of residuesList) {
        this.ss_per_residue.push({
            resi: res.resSeq,
            chainID: res.chainID,
            resName: res.resName,
            ss_type: res.ss,
            confidence_or_undetermined: res.ss !== 'undetermined'
        });
    }

    // Map computed SS back to atoms
    for (let i = 0; i < this.atoms.length; i++) {
        const a = this.atoms[i];
        if (a.isHetero) continue;
        const key = `${a.chainID}:${a.resSeq}`;
        const res = residuesMap.get(key);
        if (res && res.ss && res.ss !== 'undetermined') {
            a.ss = res.ss;
        }
    }
  }

  addHydrogens() {
    const valences: Record<string, number> = { C: 4, N: 3, O: 2, S: 2 };
    const newHydrogens: Atom[] = [];
    let nextSerial = Math.max(...this.atoms.map(a => a.serial)) + 1;

    for (let i = 0; i < this.atoms.length; i++) {
      const a = this.atoms[i];
      const targetValence = valences[a.elem];
      if (!targetValence) continue;
      
      const currentBonds = a.bonds.length;
      const toAdd = targetValence - currentBonds;
      
      if (toAdd > 0) {
        const p0 = {x: a.x, y: a.y, z: a.z};
        const bondVecs = a.bonds.map(j => {
          const b = this.atoms[j];
          const dx = b.x - p0.x;
          const dy = b.y - p0.y;
          const dz = b.z - p0.z;
          const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
          return {x: dx/len, y: dy/len, z: dz/len};
        });

        for (let k = 0; k < toAdd; k++) {
          let hx = 0, hy = 0, hz = 0;
          if (bondVecs.length === 0) {
            hx = 1; hy = 0; hz = 0; // arbitrary
          } else if (bondVecs.length === 1) {
            const v1 = bondVecs[0];
            if (k === 0) { hx = -v1.x; hy = -v1.y; hz = -v1.z; }
            else if (k === 1) { 
               const ortho = Math.abs(v1.x) < 0.9 ? {x: 1, y: 0, z: 0} : {x: 0, y: 1, z: 0};
               hx = v1.y*ortho.z - v1.z*ortho.y;
               hy = v1.z*ortho.x - v1.x*ortho.z;
               hz = v1.x*ortho.y - v1.y*ortho.x;
               const l = Math.sqrt(hx*hx + hy*hy + hz*hz);
               hx/=l; hy/=l; hz/=l;
            } else {
               hx = -v1.x + 0.5; hy = -v1.y + 0.5; hz = -v1.z + 0.5;
            }
          } else {
            let sx = 0, sy = 0, sz = 0;
            for (const v of bondVecs) { sx += v.x; sy += v.y; sz += v.z; }
            const len = Math.sqrt(sx*sx + sy*sy + sz*sz);
            if (len > 0.001) {
              hx = -sx/len; hy = -sy/len; hz = -sz/len;
            } else {
              hx = 1; hy = 0; hz = 0;
            }
          }

          const hlen = Math.sqrt(hx*hx + hy*hy + hz*hz);
          hx /= hlen; hy /= hlen; hz /= hlen;

          const bl = 1.09;
          
          const newIdx = this.atoms.length + newHydrogens.length;
          
          const newH: Atom = {
            serial: nextSerial++,
            name: ' H  ',
            resName: a.resName,
            chainID: a.chainID,
            resSeq: a.resSeq,
            x: p0.x + hx * bl,
            y: p0.y + hy * bl,
            z: p0.z + hz * bl,
            elem: 'H',
            altLoc: a.altLoc,
            isHetero: a.isHetero,
            bonds: [i], // bond to parent
            isModeledH: true
          };
          
          // Also add bond from parent to this new H
          a.bonds.push(newIdx);
          
          newHydrogens.push(newH);
          bondVecs.push({x: hx, y: hy, z: hz});
        }
      }
    }
    
    this.atoms = this.atoms.concat(newHydrogens);
  }

  toPDB(): string {
    let out = "";
    if (this.rawPDB) {
        const lines = this.rawPDB.split('\n');
        for (const line of lines) {
            if (line.startsWith("HEADER") || 
                line.startsWith("TITLE") || 
                line.startsWith("COMPND") || 
                line.startsWith("SOURCE") || 
                line.startsWith("KEYWDS") || 
                line.startsWith("EXPDTA") || 
                line.startsWith("AUTHOR") || 
                line.startsWith("REVDAT") || 
                line.startsWith("JRNL") || 
                line.startsWith("REMARK") || 
                line.startsWith("CRYST1") || 
                line.startsWith("HELIX") || 
                line.startsWith("SHEET") ||
                line.startsWith("LINK") ||
                line.startsWith("SSBOND") ||
                line.startsWith("SEQRES")) {
                out += line + (line.endsWith('\r') ? "\n" : "\r\n");
            }
        }
    }

    for (const a of this.atoms) {
      const record = a.isHetero ? "HETATM" : "ATOM  ";
      const serial = a.serial.toString().padStart(5, ' ');
      const name = a.name.padEnd(4, ' ').substring(0, 4);
      const altLoc = a.altLoc;
      const resName = a.resName.padStart(3, ' ').substring(0, 3);
      const chain = a.chainID;
      const resSeq = a.resSeq.toString().padStart(4, ' ');
      const x = a.x.toFixed(3).padStart(8, ' ');
      const y = a.y.toFixed(3).padStart(8, ' ');
      const z = a.z.toFixed(3).padStart(8, ' ');
      const elem = a.elem.padStart(2, ' ').substring(0, 2);
      
      // Use b-factor 99.90 to flag modeled hydrogens
      const bFactor = a.isModeledH ? " 99.90" : "  0.00";
      
      out += `${record}${serial} ${name}${altLoc}${resName} ${chain}${resSeq}    ${x}${y}${z}  1.00${bFactor}          ${elem}\n`;
    }
    
    for (let i = 0; i < this.atoms.length; i++) {
      const a = this.atoms[i];
      if (a.bonds.length > 0) {
        for (let j = 0; j < a.bonds.length; j += 4) {
          const chunk = a.bonds.slice(j, j + 4);
          let line = `CONECT${a.serial.toString().padStart(5, ' ')}`;
          for (const targetIdx of chunk) {
            line += this.atoms[targetIdx].serial.toString().padStart(5, ' ');
          }
          out += line + "\n";
        }
      }
    }
    
    return out;
  }

  getChainSummary(): {
    chainID: string;
    type: 'protein' | 'nucleic' | 'ligand' | 'ion' | 'water' | 'other';
    atomCount: number;
    residueCount: number;
    residueTypes: string[];
  }[] {
    const chainMap = new Map<string, {
      typeCounts: Record<string, number>;
      atomCount: number;
      residues: Set<number>;
      resNames: Set<string>;
    }>();

    const solventNames = new Set(['HOH', 'WAT', 'DOD', 'TIP', 'SOL']);
    const ionElems = new Set(['NA', 'K', 'MG', 'CA', 'ZN', 'FE', 'CL', 'BR', 'MN', 'CO', 'NI', 'CU']);
    const nucleicRes = new Set(['A', 'C', 'G', 'T', 'U', 'DA', 'DC', 'DG', 'DT', 'DU']);

    for (const a of this.atoms) {
      const ch = a.chainID || 'A';
      if (!chainMap.has(ch)) {
        chainMap.set(ch, {
          typeCounts: { protein: 0, nucleic: 0, ligand: 0, ion: 0, water: 0, other: 0 },
          atomCount: 0,
          residues: new Set(),
          resNames: new Set()
        });
      }
      const entry = chainMap.get(ch)!;
      entry.atomCount++;
      entry.residues.add(a.resSeq);
      const resn = a.resName.trim().toUpperCase();
      entry.resNames.add(resn);

      if (solventNames.has(resn)) {
        entry.typeCounts.water++;
      } else if (ionElems.has(a.elem.toUpperCase()) && a.isHetero && entry.resNames.size === 1) {
        entry.typeCounts.ion++;
      } else if (nucleicRes.has(resn)) {
        entry.typeCounts.nucleic++;
      } else if (!a.isHetero) {
        entry.typeCounts.protein++;
      } else {
        entry.typeCounts.ligand++;
      }
    }

    return Array.from(chainMap.entries()).map(([chainID, data]) => {
      let mainType: 'protein' | 'nucleic' | 'ligand' | 'ion' | 'water' | 'other' = 'protein';
      let maxCount = -1;
      for (const [t, count] of Object.entries(data.typeCounts)) {
        if (count > maxCount) {
          maxCount = count;
          mainType = t as any;
        }
      }
      return {
        chainID,
        type: mainType,
        atomCount: data.atomCount,
        residueCount: data.residues.size,
        residueTypes: Array.from(data.resNames)
      };
    });
  }

  filterAtomsByChains(chainIDs: string[]): Atom[] {
    const chainSet = new Set(chainIDs);
    return this.atoms.filter(a => chainSet.has(a.chainID));
  }

  filterAtomsByComponentType(options: {
    protein?: boolean;
    nucleic?: boolean;
    ligand?: boolean;
    ion?: boolean;
    water?: boolean;
  }): Atom[] {
    const solventNames = new Set(['HOH', 'WAT', 'DOD', 'TIP', 'SOL']);
    const ionElems = new Set(['NA', 'K', 'MG', 'CA', 'ZN', 'FE', 'CL', 'BR', 'MN', 'CO', 'NI', 'CU']);
    const nucleicRes = new Set(['A', 'C', 'G', 'T', 'U', 'DA', 'DC', 'DG', 'DT', 'DU']);

    const showProtein = options.protein ?? true;
    const showNucleic = options.nucleic ?? true;
    const showLigand = options.ligand ?? true;
    const showIon = options.ion ?? true;
    const showWater = options.water ?? true;

    return this.atoms.filter(a => {
      const resn = a.resName.trim().toUpperCase();
      if (solventNames.has(resn)) return showWater;
      if (ionElems.has(a.elem.toUpperCase()) && a.isHetero) return showIon;
      if (nucleicRes.has(resn)) return showNucleic;
      if (!a.isHetero) return showProtein;
      return showLigand;
    });
  }
}

