export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Authoritative Canonical Atom Model.
 * Formally specified in docs/science/DATA_MODEL_SPEC.yaml.
 *
 * IDENTITY POLICY STATUS:
 * Implemented against the PROPOSED P0.2 identity policy (OD-001):
 * - canonical_id is a 1-indexed strictly positive sequential integer assigned on canonicalization.
 * - Stable, deterministic, and unique within the parent Molecule/Object scope.
 * - Explicitly decoupled from volatile memory array indices.
 */
export interface CanonicalAtom {
  // --- CANONICAL IDENTITY & SCOPE ---
  canonical_id: number;           // 1-indexed positive sequential identifier (unique in Molecule)
  source_serial: number | null;   // Original file record serial number (e.g. PDB cols 7-11)
  molecule_ref?: string;          // Parent Molecule / Object UUID or ID reference
  chain_ref: string;              // Parent Chain identifier (e.g. "A", " ")
  residue_ref: number;            // Parent Residue sequence number (resSeq)
  residue_name: string;           // Three-letter or custom residue code (e.g. "ALA", "LIG")

  // --- CHEMICAL & TOPOLOGICAL IDENTITY ---
  element: string;                // Uppercase normalized element symbol (e.g. "C", "N", "FE")
  atomic_number: number;          // Standard IUPAC atomic number (Z) (e.g. 6, 7, 26)
  name: string;                   // Original standard PDB atom name (e.g. "CA", "OD1")
  normalized_name: string;        // Standardized trimmed naming (e.g. "CA", "N")
  is_hetero: boolean;             // True for HETATM / non-polymer; False for ATOM polymer

  // --- CARTESIAN COORDINATES (Physical Metric: Ångströms) ---
  x: number;                      // Float64 coordinate X in Å
  y: number;                      // Float64 coordinate Y in Å
  z: number;                      // Float64 coordinate Z in Å

  // --- CRYSTALLOGRAPHIC & BIOPHYSICAL PROPERTIES ---
  occupancy: number;              // Crystallographic occupancy [0.0, 1.0]
  b_factor: number;               // Temperature isotropic B-factor (Å^2)
  alt_loc: string;                // Alternate location conformer indicator (e.g. 'A', 'B', or ' ')
  formal_charge: number;          // Integer formal charge in elementary charge units [-8, +8]
  partial_charge?: number | null; // Electrostatic partial charge in elementary charge e

  // --- DERIVED METADATA ---
  modeled_hydrogen: boolean;      // True if placed computationally; False if experimental
  secondary_structure?: string;   // 'helix' | 'sheet' | 'loop' (from DSSP or source header)
}

/**
 * Authoritative Canonical Bond Model.
 * Formally specified in docs/science/DATA_MODEL_SPEC.yaml.
 *
 * IDENTITY & TOPOLOGY POLICY:
 * - atom_a and atom_b refer strictly to CanonicalAtom IDs (canonical_id).
 * - Normalized with atom_a < atom_b for deterministic unordered edge representation.
 * - Explicitly decoupled from volatile memory array indices.
 */
export interface CanonicalBond {
  // --- CANONICAL IDENTITY & ENDPOINTS ---
  bond_id: string;                // Unique UUID or deterministic identifier (e.g. "b-1-2")
  atom_a: number;                 // CanonicalAtom ID (canonical_id) for endpoint A (min endpoint)
  atom_b: number;                 // CanonicalAtom ID (canonical_id) for endpoint B (max endpoint)

  // --- CHEMICAL TOPOLOGY ---
  order: 1 | 1.5 | 2 | 3;         // Multiplicity: 1 (single), 1.5 (aromatic), 2 (double), 3 (triple)
  is_aromatic: boolean;           // True if participating in an aromatic conjugated ring system

  // --- SOURCE & PROVENANCE ---
  source: 'file' | 'inferred' | 'editor'; // Origin of bond definition
  is_inferred: boolean;           // True if generated computationally by distance algorithm
  confidence?: number;            // Derived confidence metric [0.0, 1.0]
  provenance?: string;            // Optional revision UUID
}

/**
 * Authoritative Canonical Topology Graph.
 * Encapsulates complete covalent bond topology and fast lookup structures.
 */
export interface CanonicalTopology {
  bonds: CanonicalBond[];                 // Deterministically sorted array of canonical bonds
  adjacency_map: Map<number, number[]>;   // CanonicalAtom ID -> neighbor CanonicalAtom IDs
  bond_map: Map<string, CanonicalBond>;   // Composite key `${atom_a}:${atom_b}` -> CanonicalBond
}

/**
 * Legacy Atom representation retained for backward compatibility with existing consumers.
 */
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
