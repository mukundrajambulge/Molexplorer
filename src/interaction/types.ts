export type SelectionLevel = 'atom' | 'residue' | 'ligand' | 'chain' | 'molecule';

export interface AtomSelectionKey {
  structureId: string;
  atomSerial: number;
}

export interface PickedAtom {
  structureId: string;
  serial: number;
  atomName: string;
  element: string;
  residueName: string;
  residueNumber: number;
  chainId: string;
  x: number;
  y: number;
  z: number;
  isHetatm?: boolean;
  bFactor?: number;
  occupancy?: number;
  modelId?: number;
}

export interface MolecularSelection {
  level: SelectionLevel;
  atoms: PickedAtom[];
  selectedKeys: Set<string>; // Format: `${structureId}:${serial}`
}

export interface SelectionSummary {
  totalAtoms: number;
  residues: string[];
  chains: string[];
  ligands: string[];
  structures: string[];
  centroid?: { x: number; y: number; z: number };
}

export function createSelectionKey(structureId: string, serial: number): string {
  return `${structureId}:${serial}`;
}
