export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface AtomDomain {
  id: number;                 // 1-indexed serial number
  element: string;            // e.g. "C", "N", "O", "Fe"
  name: string;               // PDB atom name, e.g. "CA", "OD1"
  x: number;
  y: number;
  z: number;
  formalCharge?: number;
  partialCharge?: number;
  bFactor?: number;
  altLoc?: string;
  isHetatm: boolean;
  bonds: number[];            // Neighboring atom IDs
}

export interface BondDomain {
  atomA: number;              // Atom.id
  atomB: number;              // Atom.id
  order: 1 | 1.5 | 2 | 3;     // 1.5 for aromatic bonds
}

export interface ResidueDomain {
  id: number;                 // sequence number within chain
  name: string;               // three-letter code, e.g. "ALA", "LIG"
  chainID: string;
  atoms: AtomDomain[];
  isStandardAminoAcid: boolean;
  isWater: boolean;
  isIon: boolean;
  isLigand: boolean;
}

export interface ChainDomain {
  id: string;                 // PDB chain identifier, e.g. "A"
  residues: ResidueDomain[];
  secondaryStructure?: string;
}

export interface MoleculeDomain {
  id: string;
  name: string;
  source: 'upload' | 'rcsb' | 'generated';
  chains: ChainDomain[];
  ligands: ResidueDomain[];
  waters: ResidueDomain[];
  ions: ResidueDomain[];
  rawPDB?: string;
  metadata?: {
    title?: string;
    resolution?: number;
    method?: string;
  };
}
