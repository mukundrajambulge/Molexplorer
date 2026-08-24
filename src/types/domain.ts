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

export type ResidueClassification =
  | 'amino_acid'
  | 'nucleic_acid'
  | 'modified_monomer'
  | 'ligand'
  | 'solvent'
  | 'ion'
  | 'other';

/**
 * Authoritative Canonical Residue Model.
 * Formally specified in docs/science/DATA_MODEL_SPEC.yaml.
 */
export interface CanonicalResidue {
  residue_id: string;               // Unique ID within molecule (e.g. "A:10" or "A:10:iA")
  name: string;                     // Three-letter or monomer code (e.g. "ALA", "LIG", "HOH")
  res_seq: number;                  // Integer sequence number from source
  icode?: string;                   // PDB insertion code (e.g. 'A', or undefined)
  chain_ref: string;                // Parent Chain ID reference
  molecule_ref?: string;            // Parent Molecule ID reference
  atom_ids: number[];               // Ordered array of CanonicalAtom IDs belonging to residue
  classification: ResidueClassification;
  is_standard: boolean;             // True if standard amino acid or nucleic acid monomer
  is_hetero: boolean;               // True if non-polymer HETATM
  secondary_structure?: string;     // 'helix' | 'sheet' | 'loop' | 'undetermined'
}

export type ChainClassification =
  | 'protein'
  | 'nucleic'
  | 'hetero'
  | 'mixed'
  | 'solvent'
  | 'unknown';

/**
 * Authoritative Canonical Chain Model.
 * Formally specified in docs/science/DATA_MODEL_SPEC.yaml.
 */
export interface CanonicalChain {
  chain_id: string;                 // Canonical chain identifier (e.g. "A", "B", " ")
  source_chain_id: string;          // Source chain identifier
  molecule_ref?: string;            // Parent Molecule ID reference
  residue_ids: string[];            // Ordered canonical residue IDs belonging to chain
  atom_ids: number[];               // Ordered canonical atom IDs belonging to chain
  classification: ChainClassification;
}

/**
 * Authoritative Canonical Molecule Model.
 * Root of the canonical molecular domain graph.
 */
export interface CanonicalMolecule {
  molecule_id: string;              // Unique molecule identifier (UUID or stable key)
  name: string;                     // Display name / label
  source_format?: 'pdb' | 'mmtf' | 'sdf' | 'mol2' | 'synthetic';
  atoms: CanonicalAtom[];           // CanonicalAtom array (1-indexed sequential)
  topology: CanonicalTopology;      // CanonicalTopology graph
  residues: CanonicalResidue[];     // Ordered array of CanonicalResidues
  chains: CanonicalChain[];         // Ordered array of CanonicalChains
  residue_map: Map<string, CanonicalResidue>; // Fast residue_id -> CanonicalResidue lookup
  chain_map: Map<string, CanonicalChain>;     // Fast chain_id -> CanonicalChain lookup
  atom_map: Map<number, CanonicalAtom>;       // Fast canonical_id -> CanonicalAtom lookup
  raw_pdb?: string;
  metadata?: {
    title?: string;
    resolution?: number;
    method?: string;
    has_cryst1?: boolean;
    debug_remarks?: string[];
  };
}

/**
 * Authoritative Canonical State Model.
 * Represents a single coordinate/conformation state under a CanonicalMolecule or CanonicalObject.
 */
export interface CanonicalState {
  state_id: string;                 // Unique state identifier (e.g. "state-1" or UUID)
  state_index: number;              // 1-indexed state number (1, 2, ...)
  molecule_ref: string;             // Parent CanonicalMolecule ID reference
  coordinates: { x: number; y: number; z: number }[]; // Ordered Cartesian coordinates aligned with molecule.atoms
  name?: string;                    // Optional label (e.g. "Model 1", "Conformation A")
  metadata?: Record<string, any>;   // Optional state metadata
}

/**
 * Authoritative Canonical Object Model.
 * Encapsulates a named scientific entity within a workspace document.
 */
export interface CanonicalObject {
  object_id: string;                // Unique object identifier (e.g. "obj-1" or UUID)
  name: string;                     // Object display name
  molecule_ref: string;             // Bound CanonicalMolecule ID reference
  state_ids: string[];              // Associated CanonicalState IDs
  active_state_id: string;          // Current active CanonicalState ID
  enabled: boolean;                 // Scientific entity active/enabled status
  metadata?: Record<string, any>;   // Optional object metadata
}

/**
 * Authoritative Canonical Molecular Document Model.
 * Top-level workspace scientific container.
 */
export interface CanonicalMolecularDocument {
  document_id: string;              // Unique document UUID or identifier
  name: string;                     // Workspace title / document name
  object_ids: string[];             // Ordered list of contained CanonicalObject IDs
  active_object_id: string | null;  // Reference to current active CanonicalObject
  objects: Map<string, CanonicalObject>;     // Fast object_id -> CanonicalObject lookup
  molecules: Map<string, CanonicalMolecule>; // Fast molecule_id -> CanonicalMolecule lookup
  states: Map<string, CanonicalState>;       // Fast state_id -> CanonicalState lookup
  created_at: string;               // ISO 8601 creation timestamp
  updated_at: string;               // ISO 8601 update timestamp
  metadata?: Record<string, any>;   // Document-level metadata
}

/**
 * Authoritative Canonical Selection Result Model.
 * Formally specified in docs/science/SELECTION_SPEC.md.
 */
export interface SelectionResult {
  query: string;
  selected_ids: Set<number>;             // Set of CanonicalAtom IDs (canonical_id)
  selected_array: number[];              // Deterministically sorted array of CanonicalAtom IDs
  count: number;                         // Count of selected atoms
  object_id?: string;                    // Scope object identifier where evaluated
  state_id?: string;                     // Scope state identifier where evaluated
  scope_type?: 'active_object' | 'explicit_object' | 'workspace'; // Scope model
  execution_time_ms?: number;            // Evaluation latency in milliseconds
}

/**
 * Scoped Atom Key Helper: Combines object_id with canonical_id to ensure cross-object uniqueness.
 */
export function createScopedAtomKey(objectId: string, canonicalId: number): string {
  return `${objectId}:${canonicalId}`;
}

export function parseScopedAtomKey(key: string): { objectId: string; canonicalId: number } {
  const idx = key.lastIndexOf(':');
  if (idx === -1) {
    throw new Error(`Invalid scoped atom key format: "${key}"`);
  }
  const objectId = key.substring(0, idx);
  const canonicalId = parseInt(key.substring(idx + 1), 10);
  return { objectId, canonicalId };
}

/**
 * Multi-Object Scoped Selection Result.
 * Preserves object-local atom identities and maps them to unambiguous composite keys.
 */
export interface ScopedSelectionResult {
  query: string;
  scoped_keys: Set<string>;                     // Set of `${object_id}:${canonical_id}`
  object_results: Map<string, SelectionResult>; // Partitioned SelectionResult per object
  total_count: number;                          // Total atoms selected across workspace
  execution_time_ms?: number;
}

/**
 * Validation Report emitted during scientific edit transaction validation.
 */
export interface ValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  info?: string[];
}

/**
 * Authoritative Scientific Revision Model.
 * Formally specified in docs/science/EDITING_KERNEL_SPEC.md.
 */
export interface ScientificRevision {
  revision_id: string;               // Unique UUID v4 identifying this revision
  parent_revision_id: string | null; // UUID of parent revision, or null for root R0
  operation_id: string;              // UUID of triggering EditOperation
  document_id: string;               // Workspace document context
  object_id: string;                 // Target workspace Object ID
  state_id?: string;                 // Target coordinate State ID
  canonical_state_hash: string;      // Cryptographic SHA-256 hash of canonical molecular state
  revision_hash: string;             // SHA-256 hash of (parent_revision_id, operation_id, state_hash, timestamp)
  timestamp: string;                 // ISO 8601 creation timestamp
  author: string;                    // Author / trigger entity (e.g. "User", "Molexplorer Agent")
  molecule_snapshot: CanonicalMolecule; // Immutable snapshot of CanonicalMolecule at this revision
  metadata?: Record<string, any>;
}

/**
 * Immutable Provenance Record appended to the revision ledger.
 * Formally specified in docs/science/EDITING_KERNEL_SPEC.md.
 */
export interface ProvenanceRecord {
  provenance_id: string;             // Unique UUID v4
  revision_id: string;               // Output revision UUID
  parent_revision_id: string | null; // Input revision UUID
  operation_name: string;            // Canonical operation name (e.g. "remove", "bond")
  selection_query?: string;          // Source selection expression
  resolved_atom_ids: number[];       // Exact canonical atom IDs targeted by edit
  parameters: Record<string, any>;   // Exact execution parameters
  timestamp: string;                 // ISO 8601 timestamp
  tool_version: string;              // "Molexplorer 1.0"
  validation_summary: string;        // e.g. "PASSED"
}

/**
 * Strongly-typed Edit Operation Transaction Contract.
 * Formally specified in docs/science/EDITING_KERNEL_SPEC.md.
 */
export interface EditOperation {
  operation_id: string;              // Unique UUID v4
  operation_name: string;            // "remove" | "bond" | "unbond" | etc.
  input_revision_id: string;         // Input base revision UUID
  target_object_id: string;          // Target Object ID
  target_state_index?: number;       // Target State index (default 1)
  selection_query?: string;          // Selection query string
  resolved_atom_ids: number[];       // Targeted canonical atom IDs
  parameters: Record<string, any>;   // Operation arguments
  validation_results?: ValidationReport;
  output_revision_id?: string;
  provenance_id?: string;
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

/**
 * P4.6 Measurement and Biophysical Interaction Types
 */
export interface MeasurementPairRecord {
  atom1_id: number;
  atom2_id: number;
  atom1_name: string;
  atom2_name: string;
  atom1_resSeq: number;
  atom2_resSeq: number;
  atom1_chain: string;
  atom2_chain: string;
  distance: number; // in Ångströms
}

export interface AngleRecord {
  atom1_id: number;
  vertex_id: number;
  atom3_id: number;
  atom1_name: string;
  vertex_name: string;
  atom3_name: string;
  vertex_resSeq: number;
  vertex_chain: string;
  angle: number; // in degrees [0, 180]
}

export interface DihedralRecord {
  atom1_id: number;
  atom2_id: number;
  atom3_id: number;
  atom4_id: number;
  atom1_name: string;
  atom2_name: string;
  atom3_name: string;
  atom4_name: string;
  dihedral: number; // in degrees [-180, 180]
}

export interface PolarContactRecord {
  id: string;
  type: 'putative_hydrogen_bond' | 'polar_contact' | 'ambiguous_polar_contact';
  donor_atom: { id: number; name: string; resSeq: number; chain: string };
  acceptor_atom: { id: number; name: string; resSeq: number; chain: string };
  distance: number;
  angle?: number;
  criteria: string;
  validation_status: 'GEOMETRICALLY_VALIDATED';
}

export interface MeasurementResult {
  measurement_id: string;
  measurement_type: 'distance' | 'angle' | 'dihedral' | 'mode2_polar_contacts';
  name?: string;
  selection1_query: string;
  selection2_query?: string;
  selection3_query?: string;
  selection4_query?: string;
  distances?: MeasurementPairRecord[];
  angle?: AngleRecord;
  dihedral?: DihedralRecord;
  polar_contacts?: PolarContactRecord[];
  count: number;
  text_output: string;
  is_read_only: true;
  visual_measurement?: {
    type: 'distance' | 'angle' | 'dihedral';
    atomSerials: number[];
    label: string;
    value: number;
  };
}

export interface InteractionAnalysisRecord {
  type: 'hbond' | 'hydrophobic' | 'pistacking' | 'saltbridge' | 'halogen' | 'cationpi';
  atom1: { serial: number; name: string; resName: string; resSeq: number; chainID: string };
  atom2: { serial: number; name: string; resName: string; resSeq: number; chainID: string };
  distance: number;
  angle?: number;
  classification: string;
}

export interface InteractionAnalysisResult {
  analysis_type: string;
  selection1_query?: string;
  selection2_query?: string;
  interactions: InteractionAnalysisRecord[];
  count: number;
  text_output: string;
  is_read_only: true;
}
