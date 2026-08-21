# Structural Editing Kernel & Scientific Transaction Specification

**Document Status:** Authoritative Scientific Specification  
**Specification ID:** `MOLEXPLORER-EDITING-KERNEL-SPEC`  
**Version:** 1.0  
**Date:** August 21, 2026  
**Repository:** `mukundrajambulge/Molexplorer`  
**Branch:** `dev`  
**Authority:** Molexplorer Project Owner & Lead Scientific Architect  
**Related Documents:**
- [`MASTER_PLAN.md`](../../MASTER_PLAN.md)
- [`AGENTS.md`](../../AGENTS.md)
- [`.cursorrules`](../../.cursorrules)
- [`docs/science/SCIENTIFIC_FOUNDATION.md`](SCIENTIFIC_FOUNDATION.md)
- [`docs/science/DATA_MODEL_SPEC.yaml`](DATA_MODEL_SPEC.yaml)
- [`docs/science/SELECTION_SPEC.md`](SELECTION_SPEC.md)

---

## 1. Purpose and Scope

### 1.1 Purpose
This specification establishes the authoritative, normative architecture and transaction contract for structural molecular mutations in Molexplorer. It defines the formal lifecycle, atomic transaction boundaries, pre- and post-condition validation tiers, graph topology invariants, revision ledgers, provenance journals, and undo/redo mechanics governing all structural modifications across interactive GUI tools, command-line consoles, and programmatic APIs.

### 1.2 Scope
This specification defines **WHAT** a scientific edit means, **WHEN** it is physically and topologically permissible, **HOW** it is validated and committed, and **WHAT** evidence must be recorded in the revision ledger. It governs:
- Topology alterations (`bond`, `unbond`, `cycle_valence`, `valence`).
- Compositional changes (`remove`, `add_atom`, `h_add`, `h_remove`, `h_fill`).
- Chemical property modifications (`alter`, formal charges, residue names, chain identifiers).
- Coordinate transformations (`translate`, `rotate`, `transform`, `torsion`).
- Atomic transactions, rollback guarantees, and revision lineage tracking.
- Bidirectional integration with the canonical selection engine (`SELECTION_SPEC.md`) and data model (`DATA_MODEL_SPEC.yaml`).

### 1.3 Out of Scope
This document does **NOT** implement the editing kernel engine in code. Concrete engine implementations, database adapters, and WebGL rendering updates are deferred to subsequent phase gates (e.g. Phase P4).

---

## 2. Core Scientific Principle & Transaction Pipeline

### 2.1 Principle of Scientific State Transitions
> **FUNDAMENTAL AXIOM (DM-EDIT-AXIOM):**  
> Structural editing is a formal scientific state transition over an immutable molecular graph. Under no circumstances is an edit a mere in-place mutation of presentation buffers or transient viewer structures.

The canonical editing pipeline enforces a strict unidirectional flow:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. CANONICAL SELECTION RESOLUTION (P0.3 Selection Engine)                   │
│    Resolve query to canonical atom IDs: S = { id_1, id_2, ..., id_k }       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Construct Intent
┌──────────────────────────────────────▼──────────────────────────────────────┐
│ 2. OPERATION PLANNING (Dry-Run / Preview)                                   │
│    Identify target entities, affected bonds, and parameter mutations        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Verify Preconditions
┌──────────────────────────────────────▼──────────────────────────────────────┐
│ 3. PRECONDITION VALIDATION                                                  │
│    Check revision currency (R_input == R_current), entity existence, scope  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Stage Proposed State
┌──────────────────────────────────────▼──────────────────────────────────────┐
│ 4. TRANSACTION CONSTRUCTION                                                 │
│    Build candidate derived Molecule M' and coordinate tensor X'             │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Execute Scientific Rules
┌──────────────────────────────────────▼──────────────────────────────────────┐
│ 5. SCIENTIFIC VALIDATION (Topology, Valence, Geometry)                      │
│    Validate endpoint integrity, bond order limits, clash sanity (Fail-Closed│
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Atomic Commit / Rollback
┌──────────────────────────────────────▼──────────────────────────────────────┐
│ 6. TRANSACTION COMMIT                                                       │
│    Emit new immutable ScientificRevision (R_new) & SHA-256 State Hash      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Record Lineage
┌──────────────────────────────────────▼──────────────────────────────────────┐
│ 7. PROVENANCE RECORDING                                                     │
│    Log operation, selection AST, resolved IDs, parameters, and author info  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Downstream Presentation
┌──────────────────────────────────────▼──────────────────────────────────────┐
│ 8. DERIVED VIEWER SYNCHRONIZATION                                           │
│    Unidirectional push to WebGL render buffers (3Dmol / WebGL Canvas)       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Scientific Source Immutability

### 3.1 Invariant Model
Raw input molecular artifacts (`SourceArtifact`, $S_0$) represent immutable crystallographic or computational ground truth. Any successful editing operation generates a derived scientific state in a strictly append-only lineage tree:

$$S_0 \xrightarrow{\text{op}_1} S_1 \xrightarrow{\text{op}_2} S_2 \xrightarrow{\text{op}_3} S_3$$

- **$S_0$ Preservation:** The raw input file payload, cryptographic hash (SHA-256), and original header records are never overwritten or mutated in place.
- **Export Lineage:** Exporting a modified structure generates a derived artifact referencing the parent $S_0$ SHA-256 digest in its `REMARK` / provenance metadata.

---

## 4. Edit Operation Model

Every editing action is formalized as a strongly-typed `EditOperation` contract:

```typescript
export interface EditOperation {
  // 1. Transaction Identity
  operation_id: string;               // Unique UUID v4 for this edit transaction
  operation_name: string;             // Canonical name (e.g. "remove", "bond", "h_add")
  category: OperationCategory;        // COMPOSITIONAL | TOPOLOGICAL | PROPERTY | GEOMETRIC
  
  // 2. State & Revision Boundary
  input_revision_id: string;          // Revision UUID this edit is based upon (Precondition)
  target_object_id: string;           // Target workspace Object ID
  target_state_index: number;         // 0-indexed coordinate State (or -1 for all states)
  
  // 3. Selection & Arguments
  selection_query?: string;           // Original P0.3 selection string
  resolved_atom_ids: number[];        // Exact canonical atom IDs targeted by this operation
  parameters: Record<string, any>;    // Operation-specific arguments (e.g. { order: 2 })
  
  // 4. Staged Mutation Plan
  planned_changes: {
    added_atoms?: CanonicalAtom[];
    removed_atom_ids?: number[];
    modified_atoms?: Partial<CanonicalAtom>[];
    added_bonds?: CanonicalBond[];
    removed_bond_ids?: string[];
    modified_bonds?: Partial<CanonicalBond>[];
    coordinate_deltas?: Float64Array;
  };
  
  // 5. Validation & Outcome
  validation_results: ValidationReport;
  output_revision_id?: string;        // Assigned upon successful commit
  provenance_id?: string;             // Linked provenance record UUID
}
```

---

## 5. Operation Classes

Operations are strictly classified by their biophysical scope and mutation impact:

| Operation Class | Scientific Scope | Structural Impact | Validation Severity | Generates Revision? | Examples |
|---|---|---|---|---|---|
| **A. COMPOSITIONAL** | Adding/removing physical atoms or residues | Alters atom universe $\mathcal{A}$ and covalent graph $\mathbf{G}$ | **MUST** (Topology + Valency) | **YES** | `remove`, `delete`, `h_add`, `h_remove`, `h_fill` |
| **B. TOPOLOGICAL** | Creating, deleting, or altering covalent bonds | Alters covalent edge set $E \subset \mathbf{G}$ and bond orders | **MUST** (Graph Integrity + Valency) | **YES** | `bond`, `unbond`, `cycle_valence`, `valence` |
| **C. PROPERTY** | Modifying non-geometric chemical metadata | Alters chemical annotations (formal charge, resName, chainID) | **MUST** (Chemical Naming / Charge) | **YES** | `alter`, `rename_chain`, `set_charge` |
| **D. GEOMETRIC** | Modifying Cartesian coordinates $\mathbf{X}$ | Alters 3D coordinates without modifying connectivity $\mathbf{G}$ | **MUST** (Finiteness + Clashes) | **YES** | `translate`, `rotate`, `torsion_set`, `align` |
| **E. STATE / STRUCTURAL**| Creating or duplicating conformational states | Adds new coordinate frame $\mathbf{X}_{k+1}$ to multi-state container | **MUST** (State Consistency) | **YES** | `create_state`, `split_states` |
| **F. VIEWER-ONLY** | Adjusting presentation or rendering styles | Adjusts visual appearance; zero effect on chemistry or coordinates | **NONE** (Presentation Only) | **NO** | `show cartoon`, `color red`, `zoom`, camera pan |

> **CRITICAL RULE:** Class F (Viewer-Only) operations MUST NOT generate a scientific revision or alter state hashes.

---

## 6. Core Editing Commands

The table below defines the normative core editing commands, their parameter contracts, and implementation statuses:

| Command | Canonical Syntax | Class | Intended Semantics | Implementation Status | Evidence / Validation Reference |
|---|---|---|---|---|---|
| `remove` | `remove <selection>` | Compositional | Deletes selected atoms and all incident covalent bonds. | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `TopologyEditor.ts:128`, `SelectionParser.ts:669` |
| `bond` | `bond <selA>, <selB> [, <order>]` | Topological | Creates or updates a covalent bond edge between atom pairs. | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `TopologyEditor.ts:7` |
| `unbond` | `unbond <selA>, <selB>` | Topological | Removes the covalent bond edge between atom pairs. | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `TopologyEditor.ts:22` |
| `cycle_valence`| `cycle_valence <selA>, <selB>` | Topological | Cycles bond multiplicity: $1 \to 1.5 \to 2 \to 3 \to 1$. | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `TopologyEditor.ts:37` |
| `valence` | `valence <order>, <selA>, <selB>` | Topological | Explicitly sets bond order to 1, 1.5, 2, or 3. | `SPECIFIED_NOT_IMPLEMENTED` | Planned for Phase P4 |
| `h_add` | `h_add [<selection>]` | Compositional | Adds modeled hydrogens to satisfy standard neutral valencies. | `CURRENT_IMPLEMENTED / NOT SCIENTIFICALLY BENCHMARKED` | `TopologyEditor.ts:46` (Heuristic geometry; benchmarking pending) |
| `h_remove` | `h_remove [<selection>]` | Compositional | Strips hydrogen atoms from the structure. | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `TopologyEditor.ts:97` |
| `h_fill` | `h_fill [<selection>]` | Compositional | Fills missing hydrogen atoms on unsaturated valency centers. | `CURRENT_PARTIAL` | `TopologyEditor.ts:46` (Shares `h_add` logic) |
| `alter` | `alter <selection>, <expr>` | Property | Modifies atom attributes (e.g. `b=20.0`, `formal_charge=+1`). | `SPECIFIED_NOT_IMPLEMENTED` | Planned for Phase P4 |
| `alter_state` | `alter_state <state>, <sel>, <expr>` | Geometric | Modifies coordinates of a specific conformational state. | `SPECIFIED_NOT_IMPLEMENTED` | Planned for Phase P11 |

---

## 7. Remove Operation Semantics

### 7.1 Input & Preconditions
- **Input:** Target `Molecule`, target `State`, and resolved canonical selection $S = \{ \text{id}_1, \dots, \text{id}_k \}$.
- **Precondition:** $S \subseteq \mathcal{A}$. If $S = \emptyset$, operation returns a no-op warning without generating an empty revision.

### 7.2 Execution Process
1. **Atom Removal:** The targeted atoms are removed from their parent `Residue` and `Molecule` atom containers.
2. **Cascade Bond Cleanup:** All bonds $e = (u, v) \in E$ where $u \in S \lor v \in S$ are automatically identified and purged from the molecule-level bond list.
3. **Dangling Hierarchy Pruning:**
   - If all atoms of a `Residue` are deleted, the residue record is pruned from the parent `Chain`.
   - If all residues of a `Chain` are deleted, the chain record is pruned from the `Molecule`.
   - If all atoms in the `Molecule` are deleted, the molecule enters an empty state ($\mathcal{A} = \emptyset, E = \emptyset$).
4. **Coordinate Buffer Compaction:** Coordinate arrays $\mathbf{X}'$ are compacted while preserving the stable `canonical_id` mappings of surviving atoms.

---

## 8. Bond Operation Semantics

### 8.1 Input & Preconditions
- **Syntax:** `bond <selectionA>, <selectionB> [, <order>]`
- **Selection Resolution:** $S_A$ and $S_B$ must each resolve to exactly one canonical atom ($|S_A| = 1, |S_B| = 1$), yielding atom pair $(a, b)$.
- **Preconditions:**
  - $a \in \mathcal{A}$ and $b \in \mathcal{A}$ (Endpoints must exist).
  - $a \ne b$ (Self-bonding is strictly prohibited).
  - $a$ and $b$ must belong to compatible alternate location sets (e.g. altLoc `'A'` cannot bond to altLoc `'B'`).
  - Distance check: $d(a, b) \le 4.0\text{ \AA}$ (Issues warning if distance exceeds standard covalent thresholds).

### 8.2 State Mutation
- If no bond exists between $(a, b)$, a new `CanonicalBond` record is created with specified `order` (default `1.0`), `is_aromatic: false`, and assigned a new UUID `bond_id`.
- If a bond already exists, its `order` is updated to the specified value.

---

## 9. Unbond Operation Semantics

### 9.1 Input & Preconditions
- **Syntax:** `unbond <selectionA>, <selectionB>`
- **Selection Resolution:** Resolves atom pair $(a, b)$.
- **Preconditions:** A covalent bond edge between $a$ and $b$ must exist in the active graph $\mathbf{G}$.
- **Failure Behavior:** If no bond exists between $(a, b)$, the transaction fails with `TOPOLOGY_VALIDATION_ERROR: No bond exists between specified atoms`. Silent success is strictly prohibited.

---

## 10. Bond Order & Valence Operations

### 10.1 Standard Valency Model
Molexplorer evaluates valence load $V(a)$ for atom $a$ as the sum of bond orders incident to $a$:
$$V(a) = \sum_{e \in \text{inc}(a)} \text{order}(e)$$

| Element | Standard Neutral Valency | Maximum Allowable Valency | Allowed Formal Charges |
|---|---|---|---|
| **H (Hydrogen)** | 1 | 1 | 0, +1 |
| **C (Carbon)** | 4 | 4 | -1, 0, +1 |
| **N (Nitrogen)** | 3 | 4 (quaternary ammonium) | -1, 0, +1 |
| **O (Oxygen)** | 2 | 3 (oxonium) | -1, 0, +1 |
| **P (Phosphorus)** | 3, 5 (phosphate) | 6 | -1, 0, +1 |
| **S (Sulfur)** | 2, 4, 6 (sulfate/sulfone) | 6 | -1, 0, +1 |
| **Halogens (F, Cl, Br, I)** | 1 | 1 (hypervalent in specialized complexes) | -1, 0 |

### 10.2 Valency Violation Policy
- If an edit causes $V(a) > V_{\max}(a)$, the kernel emits `VALENCE_VALIDATION_WARNING`.
- Physical plausibility checks inform the user via console telemetry, but do not block user-driven exploratory modeling unless configured in **Strict Chemistry Mode**.

---

## 11. Hydrogen Operations

### 11.1 Scientific Distinction
> **NORMATIVE DISTINCTION (DM-H-DISTINCTION):**  
> The system must strictly distinguish **Experimentally Resolved Hydrogens** (from high-resolution neutron/X-ray diffraction, $B < 90$) from **Computationally Modeled Hydrogens** (placed via geometric heuristics, flagged with `modeled_hydrogen: true` and $B = 99.90\text{ \AA}^2$).

### 11.2 Geometry & Placement Algorithm (`h_add`)
1. For each non-hydrogen atom $a \in S$, compute missing hydrogen count:
   $$N_{\text{missing}} = \max(0, V_{\text{standard}}(a) - V_{\text{current}}(a))$$
2. Position new hydrogen atoms using standardized ideal geometries:
   - **$sp^3$ (Tetrahedral):** Bond angle $109.47^\circ$, bond length $d(\text{C-H}) = 1.09\text{ \AA}$.
   - **$sp^2$ (Trigonal Planar):** Bond angle $120.0^\circ$, bond length $d(\text{C-H}) = 1.08\text{ \AA}$.
   - **$sp$ (Linear):** Bond angle $180.0^\circ$, bond length $d(\text{C-H}) = 1.06\text{ \AA}$.
3. Create new `CanonicalAtom` records with new sequentially strictly increasing `canonical_id` integers.

---

## 12. Property Editing (`alter`)

The table below governs the legal mutability of atomic and residue properties via `alter`:

| Property | Target Entity | Legal Mutation Values | Creates Revision? | Provenance Logged? | Validation Rule |
|---|---|---|---|---|---|
| `name` | Atom | PDB atom name string (1-4 chars) | **YES** | **YES** | Cannot be empty string |
| `resName` | Residue / Atom | 1-4 character alphanumeric string | **YES** | **YES** | Standard residue naming checks |
| `chainID` | Chain / Atom | 1-4 character alphanumeric string | **YES** | **YES** | Updates parent chain hierarchy |
| `formal_charge`| Atom | Integer $[-8, +8]$ | **YES** | **YES** | Integer sanity bounds |
| `b_factor` | Atom | Float64 $\ge 0.0$ | **YES** | **YES** | Must be non-negative finite number |
| `occupancy` | Atom | Float64 $[0.0, 1.0]$ | **YES** | **YES** | Clipped to valid range with warning |
| `custom_meta` | Molecule / Object | JSON-serializable key-value pair | **YES** | **YES** | Persistent user metadata |

---

## 13. Coordinate Editing & Geometric Transformations

### 13.1 Transformation Model
Scientific coordinate modifications apply rigid-body or internal coordinate operations:
$$\mathbf{r}'_i = \mathbf{R} \mathbf{r}_i + \mathbf{t}$$

Where $\mathbf{R} \in \mathbb{R}^{3 \times 3}$ is an orthogonal rotation matrix ($\det(\mathbf{R}) = +1$) and $\mathbf{t} \in \mathbb{R}^3$ is a translation vector in Ångströms.

### 13.2 Viewer Camera vs. Scientific Coordinate Transformation
> **NORMATIVE BOUNDARY RULE (DM-GEO-BOUNDARY):**  
> Rotating or panning the viewer camera modifies only the WebGL view-matrix. It MUST NEVER alter atomic coordinates $\mathbf{X}$ or create a scientific revision.  
> Conversely, a scientific translation/rotation (`transform`, `align`, `translate`) modifies the underlying coordinate tensor $\mathbf{X}$, validates geometric sanity, and emits an immutable `ScientificRevision`.

---

## 14. Topology Validation Rules

Before any topology-modifying transaction is committed, the transaction plan must pass all normative topology rules:

| Rule ID | Severity | Validation Condition | Failure Action | Engine Behavior |
|---|---|---|---|---|
| **DM-TOP-001** | **MUST** (Hard Error) | Both bond endpoints $u, v$ must exist in $\mathcal{A}$. | Abort Transaction | Raises `TOPOLOGY_VALIDATION_ERROR` |
| **DM-TOP-002** | **MUST** (Hard Error) | No self-bonding ($u \ne v$). | Abort Transaction | Raises `TOPOLOGY_VALIDATION_ERROR` |
| **DM-TOP-003** | **MUST** (Hard Error) | No duplicate edges between identical unordered pairs $\{u, v\}$. | Abort Transaction | Raises `TOPOLOGY_VALIDATION_ERROR` |
| **DM-TOP-004** | **MUST** (Hard Error) | No cross-conformer bonding between disjoint altLocs (altLoc A to altLoc B). | Abort Transaction | Raises `TOPOLOGY_VALIDATION_ERROR` |
| **DM-TOP-005** | **SHOULD** (Warning) | Covalent bond distance must satisfy $0.4\text{ \AA} \le d(u, v) \le 4.0\text{ \AA}$. | Emit Warning | Records warning in `ValidationReport` |

---

## 15. Chemical Validation Rules

Chemical validation evaluates biophysical sanity:
1. **Valence Saturation:** Flag atoms exceeding physical valence limits.
2. **Formal Charge Conservation:** Verify net formal charge matches sum of atomic charges.
3. **Aromaticity Perception:** Re-evaluate cyclic conjugation after bond creation/deletion to maintain `is_aromatic` consistency.
4. **Validation Status:** `IMPLEMENTED / NOT SCIENTIFICALLY BENCHMARKED` (Heuristic valency tables are verified in software, but quantum-mechanical benchmarking is pending).

---

## 16. Geometric Validation Rules

Coordinate updates must satisfy geometric sanity:
1. **Finite Float64:** All coordinates must be finite real numbers (no `NaN`, `+Inf`, `-Inf`).
2. **Clash Detection:** Flag severe non-bonded atomic overlaps ($d(a, b) < 0.8\text{ \AA}$ for non-bonded pairs).
3. **Chirality Preservation:** Verify that rigid-body transformations preserve chiral stereocenter determinants ($\det(\mathbf{R}) = +1$).

---

## 17. Atomic Transaction Model

All editing operations execute inside an atomic transaction wrapper:

$$\text{Transaction}(\text{op}) \to \begin{cases} \text{COMMIT}(M', \mathbf{X}', R_{\text{new}}, \text{Prov}) & \text{if all validations pass} \\ \text{ROLLBACK}(M_0, \mathbf{X}_0, R_0, \text{Error}) & \text{if any hard error occurs} \end{cases}$$

- **Atomicity:** The state transition is all-or-nothing. Partial application of atom/bond modifications is strictly prohibited.
- **Fail-Closed Guarantee:** Upon validation failure, the memory state and active revision pointer remain 100% unaltered.

---

## 18. Preview vs. Commit Pipeline

To support interactive UI previews (e.g. hover-previewing bond cuts, hydrogen additions, or deletions):
- **Operation Planning (Dry-Run):** The kernel computes candidate changes and returns a non-authoritative `StagedChangeSet`.
- **Preview Rendering:** The UI may render the `StagedChangeSet` using transient highlight overlays.
- **Commit Phase:** Only upon explicit user confirmation is the transaction validated and committed to the revision ledger.

---

## 19. Revision DAG Model

Revisions form an immutable Directed Acyclic Graph (DAG):

```
       R0 (Initial Load)
        │
        ▼ remove solvent
       R1 (Desolvated)
        │
        ▼ bond C1-O2
       R2 (Edited Topology)
      ┌─┴─────────────┐
      │ (undo to R2)  │ (branch)
      ▼ h_add         ▼ alter formal_charge
     R3              R4
```

Every revision record stores:
- `revision_id`: UUID v4 string.
- `parent_revision_id`: UUID of the parent revision (or `null` for root $R_0$).
- `operation_id`: UUID of the triggering `EditOperation`.
- `canonical_state_hash`: Cryptographic SHA-256 digest of the canonical state.
- `timestamp`: Epoch millisecond timestamp.
- `author`: User or automated agent identifier.

---

## 20. Content Hashing Boundaries

To ensure reproducible equality comparisons across revisions, three distinct hash digests are maintained:

1. **Source Artifact Hash (`SourceArtifact.hash`):** SHA-256 of the raw unparsed input bytes/string.
2. **Canonical State Hash (`ScientificRevision.canonical_state_hash`):** Deterministic SHA-256 calculated over canonical atom IDs, elements, normalized names, sorted bond edge lists, and Float64 coordinate arrays.
3. **Revision Hash (`ScientificRevision.hash`):** SHA-256 calculated over `(parent_revision_id, operation_id, canonical_state_hash, timestamp)`.

---

## 21. Provenance Contract

For every committed revision, an immutable `ProvenanceRecord` is appended to the session ledger:

```typescript
export interface ProvenanceRecord {
  provenance_id: string;              // Unique UUID
  revision_id: string;                // Output revision UUID
  parent_revision_id: string;         // Input revision UUID
  operation_name: string;             // "remove" | "bond" | "h_add" | etc.
  selection_query?: string;           // "resn HOH"
  resolved_atom_ids: number[];        // [501, 502, ..., 628]
  parameters: Record<string, any>;    // Exact execution parameters
  timestamp: string;                  // ISO 8601 string
  tool_version: string;               // "Molexplorer 1.0"
  validation_summary: string;         // "PASSED (0 errors, 1 warning)"
}
```

---

## 22. Undo / Redo Mechanics

Undo and redo operations are modeled strictly as **Revision Pointer Navigation** rather than destructive mutations:

- **`undo()`:** Moves active revision pointer $R_{\text{current}} \to R_{\text{current}}.\text{parent\_revision\_id}$.
- **`redo()`:** Moves active revision pointer forward along the active branch lineage.
- **New Edit After Undo (Branching):** If a user performs a new edit after undoing ($R_2 \to R_1 \xrightarrow{\text{new edit}} R_3'$), the previous forward branch ($R_2$) remains archived in the revision DAG, while the active branch pointer follows the newly created lineage branch $R_3'$.
- **Source Invariance:** Undo/redo operations never alter or delete the immutable $S_0$ source artifact.

---

## 23. Failure & Rollback Model

The kernel guarantees clean failure isolation across all execution phases:

| Failure Phase | Failure Trigger | Recovery Action | Scientific State Result |
|---|---|---|---|
| **Selection Failure** | Selection expression syntax error | Abort before staging | Authoritative state untouched |
| **Validation Failure** | Graph invariant or coordinate violation | Rollback staged changes | Authoritative state untouched |
| **Commit Failure** | Storage or memory exhaustion | Transaction abort | Rollback to $R_{\text{input}}$ |
| **Viewer Sync Failure**| WebGL shader or rendering glitch | Surface UI error alert | **Scientific state remains committed and valid** |

> **IMPORTANT:** A WebGL rendering failure after a successful scientific commit MUST NOT roll back the valid scientific state. The scientific state is authoritative; the presentation layer is derived.

---

## 24. Error Taxonomy

The table below establishes the normative editing error taxonomy:

| Error Code | Error Category | Severity | State Mutated? | User Action / Retry Allowed? |
|---|---|---|---|---|
| `EDIT_SELECTION_ERROR` | Malformed selection expression | Error | **NO** | Correct selection query syntax and retry. |
| `EDIT_PRECONDITION_ERROR` | Revision mismatch ($R_{\text{input}} \ne R_{\text{curr}}$) | Error | **NO** | Re-fetch active revision and re-stage edit. |
| `TOPOLOGY_VALIDATION_ERROR`| Endpoint missing, self-bond, duplicate | Error | **NO** | Correct atom pair indices and retry. |
| `VALENCE_VALIDATION_ERROR` | Severe physical valence violation | Error/Warn | Configurable | Adjust bond multiplicity or override with force. |
| `COORDINATE_VALIDATION_ERROR`| Non-finite float, NaN, extreme clash | Error | **NO** | Correct displacement parameters and retry. |
| `CHEMICAL_VALIDATION_ERROR` | Incompatible formal charge / atom type | Warning | **YES** (with warn) | Review chemical formula warnings. |
| `REVISION_CONFLICT` | Concurrent mutation on outdated base | Error | **NO** | Rebase edit on latest revision. |
| `VIEWER_SYNC_ERROR` | WebGL canvas buffer upload failure | Warning | **YES** (committed) | Re-initialize viewer context; science is safe. |

---

## 25. Concurrency & Revision Conflict Rules

To guarantee transaction consistency across asynchronous background workers (e.g. automated docking preparation agents or background minimization):
- **Optimistic Concurrency Control:** Every edit operation must explicitly declare its target `input_revision_id`.
- **Conflict Rule:** If $R_{\text{target}} \ne R_{\text{current}}$, the kernel rejects the operation with `REVISION_CONFLICT`. Silent overwrites of interleaved edits are strictly prohibited.

---

## 26. Selection Engine Integration

The editing kernel directly consumes the canonical `SelectionResult` emitted by the P0.3 selection engine:
$$\text{SELECTION\_SPEC.md} \xrightarrow{\text{SelectionResult.selected\_ids}} \text{Editing Kernel (Target Atoms)}$$
The editing kernel **never** re-parses selection strings independently, ensuring 100% semantic consistency between queries and edit targets.

---

## 27. Object and State Scope

1. **Object Scope:** Edits target a specific workspace `Object`. Modifying Object A has zero impact on Object B.
2. **State Scope vs. Topology Scope:**
   - **Topology Edits (`bond`, `remove`, `h_add`):** Mutate the shared `Molecule` topology graph, affecting all coordinate states associated with that molecule.
   - **Coordinate Edits (`alter_state`, `translate`, `rotate`):** Mutate coordinates strictly within the target `State` frame without altering shared graph connectivity.

---

## 28. Alternate-Conformer Editing Constraints

Editing disordered crystallographic conformers (`altLoc`) adheres to strict rules:
1. **Bond Disjointness:** Covalent bonds cannot be formed between atoms belonging to mutually exclusive conformers (e.g. altLoc `'A'` to altLoc `'B'`).
2. **Conformer Deletion:** Deleting an altLoc `'A'` atom leaves altLoc `'B'` and shared blank `' '` atoms intact.
3. **Occupancy Invariance:** Deleting a conformer atom does not automatically re-scale occupancy of remaining conformers unless explicitly requested via `alter occupancy`.

---

## 29. Atom Identity During Editing

In accordance with P0.2 rules:
- **Stable Sequential IDs:** Surviving atoms strictly preserve their original `canonical_id`.
- **Strict ID Reuse Prohibition:** Deleted `canonical_id` numbers are permanently tombstoned within that revision lineage and never recycled.
- **Added Atom Numbering:** Newly created atoms (e.g. via `h_add` or `add_atom`) receive new, strictly increasing sequential integers:
  $$\text{canonical\_id}_{\text{new}} = \max(\mathcal{A}_{\text{history}}) + 1$$

---

## 30. Export and Round-Trip Contract

Any state resulting from scientific editing must remain serializable to standard molecular formats:
- **PDB Export:** Re-maps canonical atom IDs to sequential 1-based PDB serials, generates clean `ATOM`/`HETATM` records, writes `CONECT` records for non-standard bonds, and includes parent revision hash in `REMARK`.
- **SDF / MOL2 Export:** Preserves bond orders (1, 1.5, 2, 3) and formal charges.
- **Semantic Equivalence Requirement:** Re-importing an exported PDB/SDF must yield an identical chemical graph $\mathbf{G}$ and coordinates $\mathbf{X}$ within Float64 numerical precision.

---

## 31. Session Persistence Interaction

When saving a workspace session (`.PSE` schema):
- The active `ScientificRevision` DAG, `ProvenanceRecord` ledger, `Measurement` records, and `NamedSelection` definitions are serialized into the JSON session envelope.
- Loading a session restores the complete revision history, allowing users to execute `undo()` back to the initial imported state.

---

## 32. Testing & Verification Contract

Every core editing operation must satisfy an 8-tier verification suite:
1. **Positive Unit Test:** Successful mutation on simple test peptide.
2. **Negative / Adversarial Test:** Rejection of self-bonds, duplicate bonds, invalid endpoints, and revision conflicts.
3. **Transaction Atomicity Test:** Verifying zero partial mutation upon simulated mid-transaction failure.
4. **Provenance Test:** Verifying complete parameter and selection logging in revision ledger.
5. **Undo / Redo Test:** Exact bitwise coordinate and topology restoration after undo/redo cycles.
6. **Integration Test:** Editing complex macromolecular assemblies (`1HVR`, `4HHB`).
7. **Viewer Sync Test:** Confirming correct unidirectional render updates post-commit.
8. **Export Round-Trip Test:** Verifying PDB/SDF export and re-import fidelity.

---

## 33. Golden Editing Test Fixtures

| Fixture Path | Structure Category | Baseline Atoms | Target Editing Test Scenario | Expected Outcome |
|---|---|---|---|---|
| `fixtures/03_protein_with_ligand.pdb` | Controlled Ligand Complex | 20 atoms (16 prot + 4 lig) | `remove organic` / `remove resn LIG` | Leaves 16 protein atoms; removes 4 ligand atoms and 4 ligand bonds. |
| `1BNA.pdb` | Nucleic Acid (DNA) | 566 atoms (486 DNA + 80 wat) | `remove solvent` | Leaves 486 DNA atoms; purges all 80 water molecules. |
| `1HVR.pdb` | Protease + Inhibitor Complex | 1890 atoms (1826 prot + 64 lig)| `bond` creation between active site Asp25 and ligand | Adds validated single covalent bond edge. |
| `scratch/1CRN.pdb` | Plant Seed Protein | 327 atoms | `h_add` | Adds modeled hydrogens; increases total atom count to saturated valence. |
| `scratch/4HHB.pdb` | Multi-Chain Complex + Disorder | 4779 atoms | `remove chain D` | Prunes Chain D (141 res) and incident heme bonds cleanly. |

---

## 34. Current Implementation Audit Matrix

The table below audits existing editing implementations in `src/editor/TopologyEditor.ts` against target normative semantics:

| Operation | Current Implementation File | Implementation Status | Validation Status | Gap / Required Refactoring |
|---|---|---|---|---|
| **`remove` / `deleteAtoms`** | `src/editor/TopologyEditor.ts:128` | `CURRENT_IMPLEMENTED` | `SOFTWARE VERIFIED` | Operates via array index filtering; must migrate to stable `canonical_id` graph model. |
| **`bond` / `addBond`** | `src/editor/TopologyEditor.ts:7` | `CURRENT_IMPLEMENTED` | `SOFTWARE VERIFIED` | Takes raw array indices; must accept canonical atom ID pairs and validate conformer disjointness. |
| **`unbond` / `removeBond`** | `src/editor/TopologyEditor.ts:22` | `CURRENT_IMPLEMENTED` | `SOFTWARE VERIFIED` | Must raise explicit error when bond does not exist instead of silent return. |
| **`cycle_valence`** | `src/editor/TopologyEditor.ts:37` | `CURRENT_IMPLEMENTED` | `SOFTWARE VERIFIED` | Add explicit support for aromatic 1.5 bond order cycling. |
| **`valence`** | None | `SPECIFIED_NOT_IMPLEMENTED` | `NOT YET IMPLEMENTED` | Implement explicit order assignment command (`valence <order>`). |
| **`h_add` / `addHydrogens`** | `src/editor/TopologyEditor.ts:46` | `CURRENT_IMPLEMENTED` | `NOT SCIENTIFICALLY BENCHMARKED` | Heuristic geometry placement; needs formal $sp^3/sp^2$ vector math and stereochemistry benchmark. |
| **`h_remove`** | `src/editor/TopologyEditor.ts:97` | `CURRENT_IMPLEMENTED` | `SOFTWARE VERIFIED` | Re-index bond arrays; migrate to canonical ID edge list. |
| **`h_fill`** | None (uses `h_add`) | `CURRENT_PARTIAL` | `SOFTWARE VERIFIED` | Provide selective hydrogen filling on unsaturated valence centers. |
| **`alter`** | None | `SPECIFIED_NOT_IMPLEMENTED` | `NOT YET IMPLEMENTED` | Implement generic atomic property modification engine. |
| **`alter_state`** | None | `SPECIFIED_NOT_IMPLEMENTED` | `NOT YET IMPLEMENTED` | Deferred to Phase P11 multi-state architecture. |
| **`undo` / `redo`** | `src/types.ts:EditHistory` | `CURRENT_PARTIAL` | `SOFTWARE VERIFIED` | Upgrade simple action-log into formal immutable `ScientificRevision` DAG. |

---

## 35. PyMOL Semantic Compatibility Classification

Molexplorer maintains independent execution engines with native semantic correspondence classified as follows:

- **`CORE` Compatibility:**  
  `remove <selection>`, `delete <name>`, `bond <selA>, <selB>`, `unbond <selA>, <selB>`, `cycle_valence`, `h_add`, `h_remove`, `h_fill`, `alter <sel>, <expr>`.
- **`ADVANCED` Compatibility:**  
  `alter_state <state>, <sel>, <expr>`, `transform_selection`, custom valency tables.
- **`RESEARCH` Compatibility:**  
  Interactive real-time molecular dynamics / energy minimization during editing.
- **`DEFERRED` Compatibility:**  
  Arbitrary Python script hooks executed inside edit transactions.
- **`REFERENCE-DIFFERENT`:**  
  PyMOL allows edits that produce silent valence or geometric anomalies without warning; Molexplorer enforces explicit validation telemetry and fail-closed transaction boundaries.

---

## 36. Viewer Boundary Enforcement

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ AUTHORITATIVE SCIENTIFIC KERNEL                                             │
│ - Canonical Molecular Graph M = (V, E)                                      │
│ - Cartesian Coordinate Tensor X (in Angstroms)                              │
│ - ScientificRevision DAG & Provenance Records                               │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Read-Only State Push
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PRESENTATION / VIEWER ADAPTER (3Dmol / WebGL Canvas)                        │
│ - Camera View / Projection Matrices                                         │
│ - Color Schemes (CPK, secondary structure)                                  │
│ - Render Representations (Cartoon, Stick, Surface)                          │
│ - Hover / Click Highlight Overlays                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

1. **Unidirectional State Flow:** Scientific Kernel $\to$ Viewer Adapter. The viewer never pushes coordinate or chemical mutations back into the kernel without passing through a formal `EditOperation` transaction.
2. **Presentation Independence:** Hiding an object (`hide cartoon`) or adjusting camera view does not alter atomic coordinates $\mathbf{X}$ or create a scientific revision.

---

## 37. Performance Contract

1. **Sub-Second Transaction Commit:** Topology mutations (`remove`, `bond`, `unbond`) on structures up to 10,000 atoms must validate and commit in $< 10\text{ ms}$.
2. **Immutable Copy-on-Write:** Revision state cloning must leverage structural sharing or efficient Float64 buffer slicing to avoid full memory duplication on localized edits.
3. **Deterministic Memory Scaling:** Memory overhead per revision must scale with the size of the delta ($\Delta$), not $O(N)$ full copies.

---

## 38. Security & Safety

1. **Parameter Sanitization:** String inputs for `alter` and property modifications are sanitized against script injection.
2. **Memory Safety:** Float64 coordinate offsets and array index pointers are strictly bounds-checked to prevent out-of-bounds memory corruption in native C++/WASM acceleration modules.
3. **Fail-Closed Security:** Unauthenticated or unauthorized editing operations across multi-tenant server sessions are rejected before staging.

---

## 39. Open Scientific & Architectural Decisions

The following open decisions are formally registered with `status: PROPOSED` and explicit decision gates:

### `OD-EDIT-001`: Canonical Atom ID Recycling Policy
- **Question:** When an atom is deleted, should its sequential `canonical_id` ever be recycled during subsequent atom additions within the same revision lineage?
- **Current Behavior:** `TopologyEditor.ts:51` computes `nextSerial = max(serial) + 1`, effectively forbidding ID recycling.
- **Options:**
  - *Option A:* Permanent tombstoning (deleted IDs are never reused in that lineage; new atoms strictly use increasing IDs).
  - *Option B:* ID recycling (lowest available positive integer reused).
- **Recommended Option:** *Option A (Permanent tombstoning)* to prevent historical provenance confusion and dangling selection references.
- **Evidence Required:** Stress test multi-cycle undo/redo and selective deletion workflows.
- **Decision Gate:** Phase P4 Topology Editing Gate.
- **Status:** `PROPOSED`  
- **Owner:** Lead Scientific Architect

### `OD-EDIT-002`: Automatic Bond Re-Inference After Coordinate Translation
- **Question:** When coordinates are edited (e.g. manual atom drag or rigid-body rotation), should covalent bonds be automatically re-inferred based on distance thresholds?
- **Current Behavior:** Covalent bonds remain static until an explicit bonding algorithm or edit is invoked.
- **Options:**
  - *Option A:* Covalent graph $\mathbf{G}$ is strictly preserved; bonds never change automatically during coordinate movement.
  - *Option B:* Automatic distance-based bond re-calculation on every coordinate edit.
- **Recommended Option:** *Option A (Strict topology preservation).* Covalent bonds represent chemical identity and must only change via explicit topological operations.
- **Evidence Required:** Benchmark interactive ligand docking and active site remodeling workflows.
- **Decision Gate:** Phase P4 Topology Editing Gate.
- **Status:** `PROPOSED`  
- **Owner:** Lead Scientific Architect

### `OD-EDIT-003`: Revision History Branching Strategy
- **Question:** When a user executes `undo()` to an earlier revision $R_1$ and performs a new edit $R_3'$, how should the abandoned branch $R_2$ be managed?
- **Current Behavior:** Single linear history array in `src/types.ts:EditHistory` (overwrites redo branch).
- **Options:**
  - *Option A:* Full Revision DAG tree (preserves all historical branches; supports branch switching).
  - *Option B:* Linear undo stack with destructive overwrite of future redo items.
- **Recommended Option:** *Option A (Full DAG in scientific core, with linear default view in UI).*
- **Evidence Required:** Session persistence size benchmarks with complex edit histories.
- **Decision Gate:** Phase P4 Topology Editing Gate.
- **Status:** `PROPOSED`  
- **Owner:** Lead Scientific Architect

---

## 40. Acceptance Criteria

This specification satisfies all normative requirements for Phase P0.4:
- [x] Scientific edit model and atomic transaction lifecycle are formally defined.
- [x] Source-artifact immutability ($S_0 \to S_1 \to S_2$) is guaranteed.
- [x] Full operation taxonomy (Compositional, Topological, Property, Geometric, State, Viewer) is established.
- [x] Core editing commands (`remove`, `bond`, `unbond`, `cycle_valence`, `valence`, `h_add`, `h_remove`, `h_fill`, `alter`, `alter_state`) are specified.
- [x] Topology, chemical, and geometric validation boundaries are defined with hard error vs. warning policies.
- [x] Preview vs. Commit pipeline and all-or-nothing rollback mechanics are specified.
- [x] Revision DAG model, parent linkage, and content hashing boundaries (Source, State, Revision) are defined.
- [x] Provenance recording schema and undo/redo revision navigation are detailed.
- [x] Concurrency rules, multi-object/state scoping, and altLoc editing constraints are established.
- [x] Export round-trip contract, session persistence, and testing contracts are detailed.
- [x] Complete codebase audit matrix (`TopologyEditor.ts`) and PyMOL compatibility classifications are documented.
- [x] Open decisions (`OD-EDIT-001` through `OD-EDIT-003`) are formally registered with `status: PROPOSED`.
- [x] Executed as a **DOCUMENTATION-ONLY** milestone with zero application source code mutations.
