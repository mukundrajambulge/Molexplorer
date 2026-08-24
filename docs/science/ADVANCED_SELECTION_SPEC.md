# Advanced Molecular Selection Semantics Specification

**Document ID:** `MOLEXPLORER-ADV-SELECTION-SPEC`  
**Milestone:** Phase 4.6 Advanced Scientific Query & Analysis Layer  
**Date:** August 22, 2026  
**Status:** **AUTHORITATIVE SCIENTIFIC SPECIFICATION**  
**Repository:** `mukundrajambulge/Molexplorer`  
**Branch:** `dev`  

---

## 1. Scope & Purpose

This specification establishes the authoritative mathematical, graph-theoretical, and spatial definitions for all advanced molecular selection operators supported in Molexplorer. It formally extends the foundational [`SELECTION_SPEC.md`](SELECTION_SPEC.md) by defining precise semantics, AST representations, evaluation algorithms, boundary behaviors, computational complexity, and scientific classification tiers for every operator.

---

## 2. Advanced Selection Operator Catalog & Mathematical Definitions

Let $\mathcal{A}$ be the universe of all canonical atom identifiers in the active molecular state:
$$\mathcal{A} = \{ a_1, a_2, \dots, a_N \}$$
Let $\mathbf{X} \in \mathbb{R}^{N \times 3}$ denote the Cartesian coordinates in Ångströms, and $G = (\mathcal{A}, E)$ denote the covalent bond topology graph.

### 2.1 Topological Operators

#### 1. `neighbor <expr>` (Direct Bond Neighbors, Excluding Operand)
- **Syntax:** `neighbor <expr>`
- **AST Node:** `{ type: 'neighbor', operand: SelectionASTNode }`
- **Mathematical Definition:**
  $$S_{\text{neighbor}} = \{ v \in \mathcal{A} \setminus S_{\text{operand}} \mid \exists u \in S_{\text{operand}}, (u, v) \in E \}$$
- **Semantics:** Selects all atoms directly covalently bonded (1 topological hop) to any atom in the operand, **strictly excluding** the atoms in the operand itself.
- **Complexity:** $\mathcal{O}(|S| \cdot \bar{d})$ where $\bar{d}$ is the average covalent valency (typically $\le 4$).
- **Status:** `GEOMETRICALLY / RULE-BASED VALIDATED`.

#### 2. `bound_to <expr>` (Direct Bond Neighbors, Including Operand)
- **Syntax:** `bound_to <expr>`
- **AST Node:** `{ type: 'bound_to', operand: SelectionASTNode }`
- **Mathematical Definition:**
  $$S_{\text{bound\_to}} = \{ v \in \mathcal{A} \mid \exists u \in S_{\text{operand}}, (u, v) \in E \}$$
- **Semantics:** Selects all atoms directly covalently bonded to any atom in the operand, **allowing source atoms** if they form mutual bonds with other selected atoms or are connected to the target subgraph.
- **Distinction from `neighbor`:** Unlike `neighbor`, `bound_to` does not subtract $S_{\text{operand}}$ from the resulting set ($S_{\text{bound\_to}} = S_{\text{neighbor}} \cup \{ u \in S_{\text{operand}} \mid \exists v \in S_{\text{operand}}, (u, v) \in E \}$).
- **Complexity:** $\mathcal{O}(|S| \cdot \bar{d})$.
- **Status:** `GEOMETRICALLY / RULE-BASED VALIDATED`.

#### 3. `extend <N> [of] <expr>` (Multi-Hop Bond Traversal)
- **Syntax:** `extend <N> [of] <expr>`
- **AST Node:** `{ type: 'extend', steps: number, operand: SelectionASTNode }`
- **Mathematical Definition:**
  $$S_{\text{extend}} = \{ v \in \mathcal{A} \mid \exists u \in S_{\text{operand}}, d_G(u, v) \le N \}$$
  where $d_G(u, v)$ is the shortest path graph distance in covalent bond graph $G$.
- **Semantics:** Traverses up to $N$ covalent bond steps from the operand atoms.
- **Complexity:** $\mathcal{O}(|V| + |E|)$ via Breadth-First Search (BFS).
- **Status:** `GEOMETRICALLY / RULE-BASED VALIDATED`.

#### 4. `bymolecule <expr>` (Covalently Connected Component Closure)
- **Syntax:** `bymolecule <expr>`
- **AST Node:** `{ type: 'bymolecule', operand: SelectionASTNode }`
- **Mathematical Definition:**
  $$S_{\text{bymolecule}} = \bigcup_{u \in S_{\text{operand}}} \text{ConnectedComponent}_G(u)$$
- **Semantics:** Expands operand to the entire covalently connected subgraph.
- **Status:** `GEOMETRICALLY / RULE-BASED VALIDATED`.

---

### 2.2 Hierarchical & Chemical Class Operators

#### 5. `byres <expr>` (Residue Closure)
- **Syntax:** `byres <expr>`
- **AST Node:** `{ type: 'byres', operand: SelectionASTNode }`
- **Mathematical Definition:**
  $$S_{\text{byres}} = \{ a \in \mathcal{A} \mid \text{Residue}(a) \in \{ \text{Residue}(u) \mid u \in S_{\text{operand}} \} \}$$
- **Semantics:** Expands selection to all atoms sharing the same residue identifier `(chainID, resSeq, resName)`.
- **Status:** `SOFTWARE VERIFIED`.

#### 6. `bychain <expr>` (Chain Closure)
- **Syntax:** `bychain <expr>`
- **AST Node:** `{ type: 'bychain', operand: SelectionASTNode }`
- **Mathematical Definition:**
  $$S_{\text{bychain}} = \{ a \in \mathcal{A} \mid \text{Chain}(a) \in \{ \text{Chain}(u) \mid u \in S_{\text{operand}} \} \}$$
- **Semantics:** Expands selection to all atoms belonging to chains containing at least one operand atom.
- **Status:** `SOFTWARE VERIFIED`.

#### 7. `bycalpha <expr>` / `byca <expr>` (Residue C-alpha Extraction)
- **Syntax:** `bycalpha <expr>` or `byca <expr>`
- **AST Node:** `{ type: 'bycalpha', operand: SelectionASTNode }`
- **Mathematical Definition:**
  $$S_{\text{bycalpha}} = \{ a \in \mathcal{A} \mid \text{name}(a) = \text{'CA'} \land \text{Residue}(a) \in \{ \text{Residue}(u) \mid u \in S_{\text{operand}} \} \}$$
- **Semantics:** For every residue represented in the operand, selects the alpha-carbon ($C_\alpha$) atom. For nucleic acids or non-protein residues without a CA atom, selects the standard backbone trace atom if defined, or returns empty for that residue.
- **Status:** `GEOMETRICALLY / RULE-BASED VALIDATED`.

#### 8. `byring <expr>` (Cyclic Ring Closure)
- **Syntax:** `byring <expr>`
- **AST Node:** `{ type: 'byring', operand: SelectionASTNode }`
- **Mathematical Definition:**
  $$S_{\text{byring}} = \bigcup \{ \text{Atoms}(R) \mid R \in \mathcal{R} \land (\text{Atoms}(R) \cap S_{\text{operand}} \ne \emptyset) \}$$
  where $\mathcal{R}$ is the set of all perceived 3–7 membered chemical rings in the structure.
- **Semantics:** Expands selection to include all atoms of any cyclic ring that contains at least one atom from the operand.
- **Status:** `GEOMETRICALLY / RULE-BASED VALIDATED`.

---

### 2.3 Spatial Metric Operators

#### 9. `within <d> of <expr>` (Spatial Proximity Filter)
- **Syntax:** `within <d> [of] <expr>`
- **AST Node:** `{ type: 'within', distance: number, operand: SelectionASTNode }`
- **Mathematical Definition:**
  $$S_{\text{within}} = \{ a \in \mathcal{A} \mid \exists u \in S_{\text{operand}}, \|\mathbf{x}_a - \mathbf{x}_u\| \le d \}$$
- **Semantics:** Evaluates all atoms in the universe $\mathcal{A}$ within Euclidean distance $d$ of any operand atom, **including the operand atoms themselves** (since $\|\mathbf{x}_u - \mathbf{x}_u\| = 0 \le d$).
- **Complexity:** $\mathcal{O}(|\mathcal{A}|)$ with uniform spatial grid hashing.
- **Status:** `GEOMETRICALLY / RULE-BASED VALIDATED`.

#### 10. `around <d> of <expr>` (Spatial Proximity Excluding Operand)
- **Syntax:** `around <d> [of] <expr>`
- **AST Node:** `{ type: 'around', distance: number, operand: SelectionASTNode }`
- **Mathematical Definition:**
  $$S_{\text{around}} = \{ a \in \mathcal{A} \setminus S_{\text{operand}} \mid \exists u \in S_{\text{operand}}, \|\mathbf{x}_a - \mathbf{x}_u\| \le d \}$$
- **Semantics:** Selects all surrounding atoms within distance $d$, strictly **excluding** the reference operand atoms.
- **Status:** `GEOMETRICALLY / RULE-BASED VALIDATED`.

#### 11. `beyond <d> of <expr>` (Spatial Exclusion)
- **Syntax:** `beyond <d> [of] <expr>`
- **AST Node:** `{ type: 'beyond', distance: number, operand: SelectionASTNode }`
- **Mathematical Definition:**
  $$S_{\text{beyond}} = \{ a \in \mathcal{A} \mid \forall u \in S_{\text{operand}}, \|\mathbf{x}_a - \mathbf{x}_u\| > d \}$$
- **Semantics:** Selects all atoms that are farther than distance $d$ from all operand atoms.
- **Status:** `GEOMETRICALLY / RULE-BASED VALIDATED`.

#### 12. `expand <d> [of] <expr>` (Self-Expanding Spatial Envelope)
- **Syntax:** `expand <d> [of] <expr>`
- **AST Node:** `{ type: 'expand', distance: number, operand: SelectionASTNode }`
- **Mathematical Definition:**
  $$S_{\text{expand}} = S_{\text{operand}} \cup \{ a \in \mathcal{A} \mid \exists u \in S_{\text{operand}}, \|\mathbf{x}_a - \mathbf{x}_u\| \le d \}$$
- **Semantics:** Explicitly expands the reference selection set $S_{\text{operand}}$ by radius $d\text{ \AA}$, guaranteeing that $S_{\text{operand}} \subseteq S_{\text{expand}}$.
- **Distinction from `within`:** In combined predicate expressions (e.g. `(resn ALA and name CA) expand 3.5`), `expand` denotes an active set expansion transform on the preceding sub-selection rather than a candidate proximity mask.
- **Status:** `GEOMETRICALLY / RULE-BASED VALIDATED`.

---

## 3. Deferred / Research Operators

### 3.1 `byfragment <expr>`
- **Classification:** `DEFERRED / RESEARCH`
- **Scientific Rationale:** In PyMOL and other molecular suites, "fragment" semantics vary widely: some treat it as a connected component under covalent bonds, others split across peptide bonds, disulfide linkages, or non-covalent complexes. Until formal fragment graph-partitioning rules are standardized, `byfragment` is deferred. Users should use `bymolecule` for covalent connected components.
- **Error Behavior:** Throws `Selection syntax error: 'byfragment' is currently DEFERRED / RESEARCH pending fragment partition specification. Use 'bymolecule' for covalent connected components.`

### 3.2 `bycell <expr>`
- **Classification:** `DEFERRED / RESEARCH`
- **Scientific Rationale:** Selection of atoms in crystallographic unit cells requires rigorous definition of `CRYST1` unit cell parameters $(a, b, c, \alpha, \beta, \gamma)$, space group symmetry operations, fractional-to-Cartesian orthogonalization matrices, periodic boundary wrapping, and provenance tracking for symmetry-generated coordinates. Approximating unit cells without explicit symmetry models is scientifically unsound.
- **Error Behavior:** Throws `Selection syntax error: 'bycell' is currently DEFERRED / RESEARCH pending crystallographic symmetry infrastructure.`

---

## 4. Determinism, Immutability & Mathematical Invariants

1. **Determinism:** All selection operations sort canonical atom IDs into strict ascending order before returning (`selected_array = Array.from(selected_ids).sort((a, b) => a - b)`).
2. **Immutability:** Selection evaluation is strictly read-only and side-effect free. It never creates a `ScientificRevision` or modifies coordinates, properties, or graph connectivity.
3. **Fail-Closed Validation:** Unrecognized tokens, negative distances ($d < 0$), or unbalanced parentheses throw explicit typed `Selection syntax error` with character position offsets.
4. **Mathematical Invariants:**
   - **Universe Identity:** `evaluate("all", M) == U(scope, state)`.
   - **Empty Set Identity:** `evaluate("none", M) == ∅`.
   - **Involutive Complement:** $\mathcal{A} \setminus (\mathcal{A} \setminus S) = S \iff \text{not}(\text{not } S) = S$.
   - **Idempotence:** $S \lor S = S$, $S \land S = S$.
   - **Spatial Envelope Growth:** $S \subseteq \text{expand}(d, S)$ for all $d \ge 0$.
   - **Boundary Exclusion:** $\text{neighbor}(S) \cap S = \emptyset$.
   - **Boundary Inclusion:** $\text{bound\_to}(S) = \text{neighbor}(S) \cup \{ u \in S \mid \exists v \in S, (u, v) \in E \}$.

---

## 5. Scope, Identity Model & Named-Selection Lifecycle

### 5.1 Identity Model
Selections operate strictly on **Canonical Atom IDs** (`canonical_id`: positive 1-indexed integers). Under no circumstances are viewer-local indices, array buffer offsets, or WebGL rendering handles used for scientific selection identity.

### 5.2 Scoping & Multi-Object Isolation
- **ACTIVE_OBJECT:** Query evaluates against the active `CanonicalObject` and its active `CanonicalState`. Atoms outside the active object are excluded from the complement universe $\mathcal{U}$.
- **EXPLICIT_OBJECT:** Query evaluates strictly within the designated object `objectId`.
- **WORKSPACE:** Query evaluates across all active/enabled objects, emitting composite scoped keys `${object_id}:${canonical_id}` to prevent collision between objects sharing identical local canonical IDs.

### 5.3 Named-Selection Resolution Hierarchy
```text
Query Token / Operand
       │
       ▼
Is it a built-in property or keyword (e.g. resn, elem, polymer, backbone)?
       ├── YES ──► Evaluate property predicate / flag normally
       │
       └── NO  ──► Does token match a registered Named Selection (case-insensitive)?
                     ├── YES ──► Resolve to Named Selection canonical atom IDs
                     │
                     └── NO  ──► Throw typed error: "Selection syntax error: Unknown selection reference '<token>'"
```

- **Stale References:** When a named selection is deleted (`delete <name>`), all subsequent references fail closed immediately with a typed error.
- **Object Isolation:** Named selections defined within `Object A` cannot be accessed within `Object B` scope.

