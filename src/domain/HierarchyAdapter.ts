import {
  CanonicalAtom,
  CanonicalBond,
  CanonicalTopology,
  CanonicalResidue,
  CanonicalChain,
  CanonicalMolecule,
  ResidueClassification,
  ChainClassification
} from '../types/domain';

export class HierarchyIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HierarchyIntegrityError';
  }
}

export const STANDARD_AMINO_ACIDS = new Set<string>([
  'ALA', 'ARG', 'ASN', 'ASP', 'CYS', 'GLN', 'GLU', 'GLY', 'HIS', 'ILE',
  'LEU', 'LYS', 'MET', 'PHE', 'PRO', 'SER', 'THR', 'TRP', 'TYR', 'VAL',
  'SEC', 'PYL', 'MSE'
]);

export const STANDARD_NUCLEIC_ACIDS = new Set<string>([
  'A', 'C', 'G', 'T', 'U', 'DA', 'DC', 'DG', 'DT', 'DU',
  '+A', '+C', '+G', '+T', '+U'
]);

export const SOLVENT_NAMES = new Set<string>([
  'HOH', 'WAT', 'DOD', 'SOL', 'TIP', 'TIP3', 'TIP4', 'SPC'
]);

export const ION_NAMES = new Set<string>([
  'NA', 'K', 'MG', 'CA', 'ZN', 'FE', 'CL', 'BR', 'MN', 'CO', 'NI', 'CU',
  'LI', 'CS', 'RB', 'SR', 'BA', 'CD', 'HG', 'PB', 'I', 'F', 'SO4', 'PO4'
]);

/**
 * Classifies a residue based on its chemical identity and HETATM status.
 */
export function classifyResidue(
  name: string,
  isHetero: boolean,
  atomCount: number = 1
): ResidueClassification {
  const normName = (name || '').trim().toUpperCase();

  if (SOLVENT_NAMES.has(normName)) {
    return 'solvent';
  }

  if (STANDARD_AMINO_ACIDS.has(normName)) {
    return 'amino_acid';
  }

  if (STANDARD_NUCLEIC_ACIDS.has(normName)) {
    return 'nucleic_acid';
  }

  if (isHetero) {
    if (ION_NAMES.has(normName) || (atomCount === 1 && ION_NAMES.has(normName))) {
      return 'ion';
    }
    return 'ligand';
  }

  return 'other';
}

/**
 * Determines whether a residue is a standard biological monomer.
 */
export function isStandardResidue(name: string, classification: ResidueClassification): boolean {
  if (classification === 'amino_acid') {
    return STANDARD_AMINO_ACIDS.has(name.trim().toUpperCase());
  }
  if (classification === 'nucleic_acid') {
    return STANDARD_NUCLEIC_ACIDS.has(name.trim().toUpperCase());
  }
  return false;
}

/**
 * Classifies a chain based on the constituent residue classifications.
 */
export function classifyChain(residues: CanonicalResidue[]): ChainClassification {
  if (residues.length === 0) return 'unknown';

  let proteinCount = 0;
  let nucleicCount = 0;
  let heteroCount = 0;
  let solventCount = 0;

  for (const res of residues) {
    if (res.classification === 'amino_acid') proteinCount++;
    else if (res.classification === 'nucleic_acid') nucleicCount++;
    else if (res.classification === 'solvent') solventCount++;
    else if (res.classification === 'ligand' || res.classification === 'ion') heteroCount++;
  }

  const total = residues.length;
  if (proteinCount === total) return 'protein';
  if (nucleicCount === total) return 'nucleic';
  if (solventCount === total) return 'solvent';
  if (heteroCount === total) return 'hetero';
  if (proteinCount > 0 && nucleicCount === 0 && heteroCount === 0) return 'protein';
  if (nucleicCount > 0 && proteinCount === 0 && heteroCount === 0) return 'nucleic';

  return 'mixed';
}

/**
 * Generates a deterministic canonical residue ID within a molecule.
 */
export function createResidueId(chainId: string, resSeq: number, icode?: string): string {
  const cleanChain = chainId || ' ';
  const cleanIcode = (icode || '').trim();
  if (cleanIcode.length > 0) {
    return `${cleanChain}:${resSeq}:${cleanIcode}`;
  }
  return `${cleanChain}:${resSeq}`;
}

/**
 * Validates the complete molecular hierarchy against structural integrity rules.
 */
export function validateCanonicalMolecule(molecule: CanonicalMolecule): void {
  if (!molecule.molecule_id || molecule.molecule_id.trim().length === 0) {
    throw new HierarchyIntegrityError('Invalid molecule_id: must be a non-empty string.');
  }

  const atomMap = molecule.atom_map;
  const residueMap = molecule.residue_map;
  const chainMap = molecule.chain_map;

  // 1. Verify atom map matches atoms array
  if (atomMap.size !== molecule.atoms.length) {
    throw new HierarchyIntegrityError(
      `Atom map size (${atomMap.size}) does not match atoms array length (${molecule.atoms.length}).`
    );
  }

  // 2. Verify all topology bond endpoints exist in atom map
  for (const bond of molecule.topology.bonds) {
    if (!atomMap.has(bond.atom_a)) {
      throw new HierarchyIntegrityError(`Topology bond references non-existent atom_a (${bond.atom_a}).`);
    }
    if (!atomMap.has(bond.atom_b)) {
      throw new HierarchyIntegrityError(`Topology bond references non-existent atom_b (${bond.atom_b}).`);
    }
  }

  // 3. Verify residues and atom references
  const claimedAtoms = new Set<number>();
  for (const res of molecule.residues) {
    if (!residueMap.has(res.residue_id)) {
      throw new HierarchyIntegrityError(`Residue ${res.residue_id} missing from residue_map.`);
    }

    if (!chainMap.has(res.chain_ref)) {
      throw new HierarchyIntegrityError(
        `Residue ${res.residue_id} references non-existent parent chain (${res.chain_ref}).`
      );
    }

    for (const atomId of res.atom_ids) {
      if (!atomMap.has(atomId)) {
        throw new HierarchyIntegrityError(
          `Residue ${res.residue_id} references non-existent atom ID ${atomId}.`
        );
      }
      if (claimedAtoms.has(atomId)) {
        throw new HierarchyIntegrityError(
          `Atom ID ${atomId} is claimed by multiple residues simultaneously.`
        );
      }
      claimedAtoms.add(atomId);
    }
  }

  // 4. Verify chains and residue references
  for (const chain of molecule.chains) {
    if (!chainMap.has(chain.chain_id)) {
      throw new HierarchyIntegrityError(`Chain ${chain.chain_id} missing from chain_map.`);
    }

    for (const resId of chain.residue_ids) {
      const res = residueMap.get(resId);
      if (!res) {
        throw new HierarchyIntegrityError(`Chain ${chain.chain_id} references non-existent residue ${resId}.`);
      }
      if (res.chain_ref !== chain.chain_id) {
        throw new HierarchyIntegrityError(
          `Hierarchy mismatch: Chain ${chain.chain_id} contains residue ${resId} whose chain_ref is ${res.chain_ref}.`
        );
      }
    }
  }
}

/**
 * Pure, deterministic builder that constructs a CanonicalMolecule from CanonicalAtoms and CanonicalTopology.
 */
export function buildCanonicalMolecule(
  atoms: CanonicalAtom[],
  topology: CanonicalTopology,
  options?: {
    molecule_id?: string;
    name?: string;
    source_format?: 'pdb' | 'mmtf' | 'sdf' | 'mol2' | 'synthetic';
    raw_pdb?: string;
    metadata?: any;
  }
): CanonicalMolecule {
  const moleculeId = options?.molecule_id || 'mol-canonical-1';
  const moleculeName = options?.name || 'Molecule';

  const atomMap = new Map<number, CanonicalAtom>();
  for (const atom of atoms) {
    atomMap.set(atom.canonical_id, atom);
  }

  // Group atoms into ordered residues and chains preserving discovery order
  const chainOrder: string[] = [];
  const chainResidueMap = new Map<string, string[]>(); // chain_id -> residue_id[]
  const residueMap = new Map<string, CanonicalResidue>();
  const residueAtomMap = new Map<string, number[]>(); // residue_id -> canonical_id[]
  const residueMetaMap = new Map<string, {
    name: string;
    resSeq: number;
    icode?: string;
    chainID: string;
    isHetero: boolean;
    ss?: string;
  }>();

  for (const atom of atoms) {
    const chainID = atom.chain_ref || 'A';
    const resSeq = atom.residue_ref;
    const resName = atom.residue_name || 'UNK';
    const resId = createResidueId(chainID, resSeq, undefined);

    if (!chainResidueMap.has(chainID)) {
      chainOrder.push(chainID);
      chainResidueMap.set(chainID, []);
    }

    if (!residueAtomMap.has(resId)) {
      chainResidueMap.get(chainID)!.push(resId);
      residueAtomMap.set(resId, []);
      residueMetaMap.set(resId, {
        name: resName,
        resSeq: resSeq,
        icode: undefined,
        chainID: chainID,
        isHetero: atom.is_hetero,
        ss: atom.secondary_structure
      });
    }

    residueAtomMap.get(resId)!.push(atom.canonical_id);
  }

  // Construct CanonicalResidue records
  const residues: CanonicalResidue[] = [];
  for (const [resId, atomIds] of residueAtomMap.entries()) {
    const meta = residueMetaMap.get(resId)!;
    const classification = classifyResidue(meta.name, meta.isHetero, atomIds.length);
    const isStandard = isStandardResidue(meta.name, classification);

    const canonicalResidue: CanonicalResidue = {
      residue_id: resId,
      name: meta.name,
      res_seq: meta.resSeq,
      icode: meta.icode,
      chain_ref: meta.chainID,
      molecule_ref: moleculeId,
      atom_ids: atomIds,
      classification: classification,
      is_standard: isStandard,
      is_hetero: meta.isHetero,
      secondary_structure: meta.ss
    };

    residueMap.set(resId, canonicalResidue);
    residues.push(canonicalResidue);
  }

  // Construct CanonicalChain records
  const chains: CanonicalChain[] = [];
  const chainMap = new Map<string, CanonicalChain>();

  for (const chainID of chainOrder) {
    const resIds = chainResidueMap.get(chainID)!;
    const chainResidues = resIds.map(id => residueMap.get(id)!);
    const chainAtomIds: number[] = [];

    for (const res of chainResidues) {
      for (const aId of res.atom_ids) {
        chainAtomIds.push(aId);
      }
    }

    const classification = classifyChain(chainResidues);

    const canonicalChain: CanonicalChain = {
      chain_id: chainID,
      source_chain_id: chainID,
      molecule_ref: moleculeId,
      residue_ids: resIds,
      atom_ids: chainAtomIds,
      classification: classification
    };

    chainMap.set(chainID, canonicalChain);
    chains.push(canonicalChain);
  }

  const canonicalMolecule: CanonicalMolecule = {
    molecule_id: moleculeId,
    name: moleculeName,
    source_format: options?.source_format || 'pdb',
    atoms: atoms,
    topology: topology,
    residues: residues,
    chains: chains,
    residue_map: residueMap,
    chain_map: chainMap,
    atom_map: atomMap,
    raw_pdb: options?.raw_pdb,
    metadata: options?.metadata
  };

  validateCanonicalMolecule(canonicalMolecule);
  return canonicalMolecule;
}
