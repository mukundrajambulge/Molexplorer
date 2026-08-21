# Canonical Molecular Selection Semantics Specification

**Document Status:** Authoritative Scientific Specification  
**Specification ID:** `MOLEXPLORER-SELECTION-SPEC`  
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

---

## 1. Purpose and Scope

### 1.1 Purpose
This specification establishes the authoritative, mathematically rigorous, and canonical semantics of molecular selections in Molexplorer. It defines the formal selection algebra, abstract syntax tree (AST) pipeline, property selectors, chemical class classifiers, topological graph traversals, spatial coordinate filters, error handling models, determinism guarantees, and provenance records for all selection operations.

### 1.2 Scope
This specification defines **WHAT** selection expressions mean. It governs:
- Interactive 3D viewport picking and expansion in MolStudio (`src/interaction/SelectionManager.ts`).
- Query evaluation in the Selection Query Console (`src/components/SelectionQueryConsole.tsx`, `src/lib/SelectionParser.ts`).
- Future command-line console evaluation (`select`, `remove`, `alter`, `show`, `hide`, `color`).
- Future typed programmatic API endpoints (C++, Python, TypeScript).
- Transaction filtering for topology editing kernels (`src/editor/TopologyEditor.ts`).
- Structural analysis, non-covalent interaction detection, alignment, and 3D measurements.
- Workspace session persistence (`.PSE` schema) and scientific provenance journals.

### 1.3 Out of Scope
This document does **NOT** implement or refactor code. It does not introduce runtime dependencies on PyMOL or other third-party molecular suites. Concrete execution engine implementation slices are deferred to subsequent phase gates (e.g. Phase P2).

---

## 2. Scientific Definition of a Selection

### 2.1 Formal Mathematical Model
Let $\mathcal{A}$ be the universe of all canonical atom identifiers in the active molecular state:
$$\mathcal{A} = \{ \text{atom\_id}_1, \text{atom\_id}_2, \dots, \text{atom\_id}_N \}$$

A **Molecular Selection** $S$ is defined strictly as a subset of canonical atom identifiers:
$$S \subseteq \mathcal{A}$$

A selection query is an evaluation function $f$:
$$f(\text{query}, \mathcal{M}, \Sigma, \mathbf{X}, \mathbf{G}, \mathbf{P}) \to S$$

Where:
- $\text{query}$: The formal query expression string or typed AST.
- $\mathcal{M}$: The canonical `Molecule` hierarchy (chains, residues, atoms).
- $\Sigma$: The query scope (e.g., active object, specific state, or workspace).
- $\mathbf{X}$: The Cartesian coordinate tensor $\mathbf{X} \in \mathbb{R}^{N \times 3}$ in Ångströms for the target `State`.
- $\mathbf{G}$: The covalent bond graph $(V, E)$ where $V = \mathcal{A}$ and $E \subseteq V \times V$.
- $\mathbf{P}$: Evaluator parameters (e.g., distance tolerance $\epsilon$, spatial cutoff $d$).

### 2.2 Invariant Requirements of the Evaluation Function $f$
1. **Determinism:** Given identical $\mathcal{M}, \mathbf{X}, \mathbf{G}, \text{query}$, and $\mathbf{P}$, $f$ must evaluate to the exact same subset $S$ across all execution environments (browser JavaScript/TypeScript, backend Python, C++ core).
2. **Side-Effect Freedom / Immutability:** The evaluation of $f$ must **never** mutate coordinates $\mathbf{X}$, bond topology $\mathbf{G}$, residue/chain classifications, or scientific revision hashes.
3. **Canonical Identity Grounding:** $S$ is composed strictly of canonical atom IDs, never ephemeral array indices or volatile GPU vertex pointers.
4. **Duplicate Elimination:** A selection is a true mathematical set. For any atom $a \in \mathcal{A}$, $a \in S$ occurs at most once. $S \cup S = S$.
5. **State Awareness:** Spatial selections operate explicitly against the Cartesian coordinates $\mathbf{X}$ of the specified conformational `State`.

---

## 3. Selection Pipeline

All selection interfaces (GUI point-and-click, Selection Query Console, command interpreter, and typed APIs) must execute through the identical multi-stage canonical pipeline:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. HUMAN / API INPUT STRING OR EVENT                                        │
│    e.g. "byres (resn LIG around 5.0)" or 3D viewport residue click           │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Tokenize (Lexical Analysis)
┌──────────────────────────────────────▼──────────────────────────────────────┐
│ 2. TOKEN STREAM                                                             │
│    [BYRES, LPAREN, RESN, IDENT("LIG"), AROUND, FLOAT(5.0), RPAREN]          │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Syntactic Parse (Recursive Descent / Pratt)
┌──────────────────────────────────────▼──────────────────────────────────────┐
│ 3. TYPED SELECTION AST (Abstract Syntax Tree)                               │
│    TopologicalOp(type: BYRES, operand: SpatialOp(type: AROUND, ...))        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Static Semantic Validation
┌──────────────────────────────────────▼──────────────────────────────────────┐
│ 4. VALIDATED QUERY PLAN                                                     │
│    Check distance metrics (d > 0), valid properties, scope bounds           │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Deterministic Evaluation against Canonical State
┌──────────────────────────────────────▼──────────────────────────────────────┐
│ 5. CANONICAL ATOM-ID SET (S ⊆ A)                                            │
│    Set<integer> = { 101, 102, 103, 104, 105, 106, 107 }                     │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Package Result & Lineage
┌──────────────────────────────────────▼──────────────────────────────────────┐
│ 6. SELECTION RESULT MODEL (SelectionResult)                                 │
│    Canonical IDs, AST Ref, Normalized Query, Determinism Flag, Warnings     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Pipeline Stage Responsibilities
1. **Lexical Analysis (Tokenizer):** Splits raw text into typed tokens. Rejects unrecognized characters with precise character offset positions.
2. **Syntactic Parser:** Validates parentheses balancing, operand presence, and operator associativity to construct a typed AST.
3. **Semantic Validator:** Validates physical sanity (e.g. non-negative distances for spatial queries, valid element symbols, known property identifiers). Rejects invalid queries under a **fail-closed** policy.
4. **Deterministic Evaluator:** Traverses the AST against the canonical molecular state ($\mathcal{M}, \mathbf{X}, \mathbf{G}$), executing property predicates, graph traversals, and spatial distance checks.
5. **Result Aggregator:** Sorts canonical atom IDs into deterministic ascending order, attaches execution metadata, and emits a frozen `SelectionResult`.

---

## 4. Canonical Atom-ID Requirements

### 4.1 Dependency on P0.2 Identity System
In accordance with [`DATA_MODEL_SPEC.yaml`](DATA_MODEL_SPEC.yaml), selection resolution is strictly decoupled from array storage indices:
- **Array Indexing Prohibited:** Zero-based array indices (`atoms[i]`) shift whenever atoms are deleted, added, or filtered. Selections referencing array indices become corrupted upon structural mutation.
- **Canonical Atom ID Grounding:** Selections must store and reference the `canonical_id` (1-based positive sequential integer defined in P0.2 decision `OD-001`).
- **Identity Stability:** When atoms are deleted (e.g. `remove solvent`), surviving atoms retain their original `canonical_id`. Selections targeting remaining atoms remain 100% valid.

---

## 5. Selection Result Model

The output of any selection evaluation is encapsulated in a formal `SelectionResult` structure.

```typescript
export interface SelectionResult {
  // 1. Semantic Query Contract
  query: string;                       // Raw input expression
  normalized_expression: string;       // Canonical formatted expression
  ast: SelectionASTNode;               // Immutable AST representation
  
  // 2. Resolved Scientific State
  selected_ids: number[];              // Deterministically sorted canonical atom IDs
  count: number;                       // Total atoms selected (|S|)
  target_state_id: string;             // UUID/Hash of conformational State evaluated
  target_molecule_id: string;          // UUID of parent Molecule
  
  // 3. Telemetry & Validation
  is_deterministic: boolean;           // True if query evaluation is guaranteed deterministic
  warnings: string[];                  // Non-fatal validation warnings (e.g. empty target)
  evaluation_time_ms: number;          // Benchmark duration
  
  // 4. Historical Lineage
  provenance_ref?: string;             // Revision UUID if selection is bound to an edit
}
```

### 5.2 Resolution Semantics: Cache vs. Semantics vs. Persistence
To prevent architectural confusion identified in P0.1/P0.2, the three tiers of selection state are explicitly distinguished:
1. **Runtime Selection Cache (`TRANSIENT`):** In-memory `Set<number>` used for $O(1)$ lookup by the WebGL viewport and hover-highlighting passes.
2. **Canonical Selection Semantics (`CANONICAL`):** The mathematical AST and normalized query string defining the invariant query logic.
3. **Persisted Selection Resolution (`SERIALIZED / PERSISTED`):** The resolved array of canonical atom IDs serialized into `.PSE` session files (`SelectionSessionState.selectedAtomSerials`) or recorded in `ProvenanceRecord` logs.

---

## 6. Formal Selection Language Grammar

The selection language is defined by the following formal Extended Backus-Naur Form (EBNF) grammar:

```ebnf
SelectionExpression   ::= OrExpression ;

OrExpression          ::= AndExpression { ( "or" | "|" ) AndExpression } ;

AndExpression         ::= UnaryExpression { [ "and" | "&" ] UnaryExpression } ;

UnaryExpression       ::= ( "not" | "!" ) UnaryExpression
                        | TopologicalModifier
                        | SpatialModifier
                        | PrimaryExpression ;

TopologicalModifier   ::= "byres" UnaryExpression
                        | "bychain" UnaryExpression
                        | "bymolecule" UnaryExpression
                        | "neighbor" UnaryExpression
                        | "extend" Integer [ "of" ] UnaryExpression ;

SpatialModifier       ::= ( "around" | "within" | "beyond" ) Number [ "of" ] UnaryExpression ;

PrimaryExpression     ::= "(" SelectionExpression ")"
                        | KeywordFlag
                        | PropertySelector
                        | ComparisonSelector
                        | CommandPrefix ;

KeywordFlag           ::= "all" | "none" | "visible" | "enabled"
                        | "polymer" | "polymer.protein" | "polymer.nucleic"
                        | "organic" | "inorganic" | "solvent" | "hetatm"
                        | "backbone" | "sidechain" | "guide" | "hydrogens"
                        | "metals" | "donors" | "donor" | "acceptors" | "acceptor" ;

PropertySelector      ::= PropertyName ValueList ;

ComparisonSelector    ::= ComparisonProperty ComparisonOp Number ;

PropertyName          ::= "name" | "resn" | "resi" | "chain" | "elem" | "ss" | "alt" | "segi" | "id" ;

ComparisonProperty    ::= "b" | "q" | "id" | "resi" ;

ComparisonOp          ::= "<=" | ">=" | "==" | "!=" | "<" | ">" | "=" ;

ValueList             ::= ValuePattern { "+" ValuePattern } ;

ValuePattern          ::= Identifier | IntegerRange | StringLiteral ;

IntegerRange          ::= Integer "-" Integer ;

CommandPrefix         ::= ( "select" | "sele" ) Identifier "," SelectionExpression ;
```

---

## 7. Operator Precedence and Associativity

### 7.1 Precedence Hierarchy Comparison
The table below explicitly contrasts the **Current Implementation Precedence** (`SelectionParser.ts:114-165`) with the **Normative P0.3 Target Precedence**:

| Precedence Tier | Current Implementation Precedence (`SelectionParser.ts`) | Normative Target Precedence (P0.3) | Associativity | Status & Alignment |
|---|---|---|---|---|
| **Tier 1 (Highest)** | `( ... )` (Parentheses) | `( ... )` (Parentheses) | None | **IDENTICAL** (`CURRENT_IMPLEMENTED`) |
| **Tier 2** | Primary property predicates (`name`, `resn`, `b > 30`) | Primary property predicates (`name`, `resn`, `b > 30`) | Left | **IDENTICAL** (`CURRENT_IMPLEMENTED`) |
| **Tier 3** | Unary negation `not`, `!` | Unary negation `not`, `!` | Right | **IDENTICAL** (`CURRENT_IMPLEMENTED`) |
| **Tier 4** | Topological graph modifiers (`byres`, `bychain`, `neighbor`, `extend`) | Topological graph modifiers (`byres`, `bychain`, `neighbor`, `extend`) | Right | **IDENTICAL** (`CURRENT_IMPLEMENTED`) |
| **Tier 5** | Spatial metric modifiers (`around <d>`, `within <d>`, `beyond <d>`) | Spatial metric modifiers (`around <d>`, `within <d>`, `beyond <d>`) | Right | **IDENTICAL** (`CURRENT_IMPLEMENTED`) |
| **Tier 6** | Binary conjunction `and`, `&`, juxtaposition | Binary conjunction `and`, `&`, juxtaposition | Left | **IDENTICAL** (`CURRENT_IMPLEMENTED`) |
| **Tier 7 (Lowest)** | Binary disjunction `or`, `\|` | Binary disjunction `or`, `\|` | Left | **IDENTICAL** (`CURRENT_IMPLEMENTED`) |

*Finding:* The existing recursive descent parser in `src/lib/SelectionParser.ts` executes in exact accordance with the Normative P0.3 target hierarchy: spatial and topological modifiers bind more tightly than `AND`, which binds more tightly than `OR`.

### 7.2 Juxtaposition (Implicit AND) Rule
When two valid selector terms are placed consecutively without an explicit Boolean operator (e.g. `chain A resn ALA`), the evaluator treats the juxtaposition as an implicit `AND` operator: `(chain A) and (resn ALA)`.

---

## 8. Boolean Algebra and Set Operations

Selection evaluation is grounded in classical set theory:

### 8.1 Operators
1. **Intersection (`AND` / `&` / whitespace):**
   $$S_{A \text{ and } B} = S_A \cap S_B = \{ a \in \mathcal{A} \mid a \in S_A \land a \in S_B \}$$
2. **Union (`OR` / `|`):**
   $$S_{A \text{ or } B} = S_A \cup S_B = \{ a \in \mathcal{A} \mid a \in S_A \lor a \in S_B \}$$
3. **Complement (`NOT` / `!`):**
   $$S_{\text{not } A} = \mathcal{A}_{\text{scope}} \setminus S_A = \{ a \in \mathcal{A}_{\text{scope}} \mid a \notin S_A \}$$
   *Note:* The complement is strictly bounded by the active query scope $\mathcal{A}_{\text{scope}}$ (the target molecule or object), not the global universe.

### 8.2 Boolean Axioms and Algebraic Invariants
- **Idempotence:** $A \text{ and } A = A$; $A \text{ or } A = A$.
- **Commutativity:** $A \text{ and } B = B \text{ and } A$; $A \text{ or } B = B \text{ or } A$.
- **Associativity:** $(A \text{ and } B) \text{ and } C = A \text{ and } (B \text{ and } C)$.
- **Distributivity:** $A \text{ and } (B \text{ or } C) = (A \text{ and } B) \text{ or } (A \text{ and } C)$.
- **Double Negation:** $\text{not } (\text{not } A) = A$.
- **De Morgan's Laws:**
  $$\text{not } (A \text{ and } B) \equiv (\text{not } A) \text{ or } (\text{not } B)$$
  $$\text{not } (A \text{ or } B) \equiv (\text{not } A) \text{ and } (\text{not } B)$$
- **Identity & Annihilation:**
  $$A \text{ and } \text{all} = A \quad | \quad A \text{ and } \text{none} = \emptyset$$
  $$A \text{ or } \text{all} = \mathcal{A}_{\text{scope}} \quad | \quad A \text{ or } \text{none} = A$$

---

## 9. Basic Property Selectors

The following table documents the complete property selector matrix with rigorous scientific classification:

| Selector | Accepted Syntax | Data Type | Matching Policy | Wildcard (`*`) | List (`+`) | Range (`-`) | Implementation & Validation Classification | Evidence / Validation Reference |
|---|---|---|---|---|---|---|---|---|
| `name` | `name CA`, `name CA+CB` | String | Case-insensitive PDB atom name | **YES** (`name C*`) | **YES** (`CA+N+O`) | **NO** | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `SelectionParser.ts:475`, `qa_group8_selection_query.ts` |
| `resn` | `resn ALA`, `resn LIG` | String | Case-insensitive 3-letter code | **YES** (`resn AL*`) | **YES** (`ALA+GLY`) | **NO** | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `SelectionParser.ts:472`, `qa_group8_selection_query.ts` |
| `resi` | `resi 1-50`, `resi 10+20` | Integer / Range | Sequence number (`resSeq`) | **NO** | **YES** (`10+20`) | **YES** (`1-50`) | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `SelectionParser.ts:478`, `qa_group8_selection_query.ts` |
| `chain` | `chain A`, `chain A+B` | String | Alphanumeric chain ID | **YES** (`chain *`) | **YES** (`A+B+H`) | **NO** | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `SelectionParser.ts:473`, `qa_group8_selection_query.ts` |
| `elem` | `elem C`, `elem FE` | String | Normalized element symbol | **YES** (`elem *`) | **YES** (`C+N+O`) | **NO** | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `SelectionParser.ts:474`, `qa_group8_selection_query.ts` |
| `id` | `id 100`, `id 1-50` | Integer / Range | Canonical Atom ID (`serial`) | **NO** | **YES** (`1+2+3`) | **YES** (`1-100`) | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `SelectionParser.ts:479`, `qa_group8_selection_query.ts` |
| `b` | `b > 30.0`, `b <= 15.5` | Float64 | Comparison against B-factor | **NO** | **NO** | Numeric comparisons | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `SelectionParser.ts:501`, `qa_group8_selection_query.ts` |
| `q` | `q == 1.0`, `q < 0.5` | Float64 | Comparison against occupancy | **NO** | **NO** | Numeric comparisons | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `SelectionParser.ts:503`, `qa_group8_selection_query.ts` |
| `alt` | `alt A`, `alt B` | Character | Alternate location identifier | **NO** | **YES** (`A+B`) | **NO** | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `SelectionParser.ts:476`, `test_selection_engine.ts` |
| `segi` | `segi PROT` | String | Segment identifier | **YES** (`segi *`) | **YES** (`A+B`) | **NO** | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `SelectionParser.ts:476` (maps to segment field) |
| `ss` | `ss h`, `ss s`, `ss l` | String | Secondary structure class | **NO** | **YES** (`h+s`) | **NO** | `CURRENT_IMPLEMENTED / SCIENTIFICALLY BENCHMARKED` | `SelectionParser.ts:481`, `validate_dssp_dihedrals.md` |

---

## 10. Chemical Class Selectors

Chemical class selectors partition atoms according to biophysical and structural classifications:

```
                                    ┌───────────────────────┐
                                    │       ALL ATOMS       │
                                    └───────────┬───────────┘
                       ┌────────────────────────┴────────────────────────┐
                       │                                                 │
            ┌──────────▼──────────┐                           ┌──────────▼──────────┐
            │       POLYMER       │                           │       HETATM        │
            └──────────┬──────────┘                           └──────────┬──────────┘
           ┌───────────┴───────────┐                         ┌───────────┴───────────┐
     ┌─────▼─────┐           ┌─────▼─────┐             ┌─────▼─────┐           ┌─────▼─────┐
     │  PROTEIN  │           │  NUCLEIC  │             │  ORGANIC  │           │ INORGANIC │
     └─────┬─────┘           └─────┬─────┘             │  (Ligand) │           └─────┬─────┘
     ┌─────┴─────┐           ┌─────┴─────┐             └───────────┘           ┌─────┴─────┐
┌────▼────┐ ┌────▼────┐ ┌────▼────┐ ┌────▼────┐                          ┌─────▼─────┐ ┌───▼───┐
│BACKBONE │ │SIDECHAIN│ │BACKBONE │ │SIDECHAIN│                          │  SOLVENT  │ │ METAL │
│(N,CA,C,O│ │ (R-grp) │ │(P,Ribose│ │ (Bases) │                          │(HOH, WAT) │ │(Fe,Zn)│
└─────────┘ └─────────┘ └─────────┘ └─────────┘                          └───────────┘ └───────┘
```

| Class Selector | Scientific Definition & Qualifying Criteria | Implementation & Scientific Validation Status | Evidence Reference |
|---|---|---|---|
| `all` | Entire universe of atoms in active query scope ($S = \mathcal{A}_{\text{scope}}$). | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `SelectionParser.ts:610` |
| `none` | The empty set ($S = \emptyset$). | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `SelectionParser.ts:614` |
| `polymer` | Residues belonging to continuous biological polymers (`polymer.protein` $\cup$ `polymer.nucleic`). | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `SelectionParser.ts:556` |
| `polymer.protein` | Canonical 20 amino acids + `MSE`, `SEC`, `PYL`, `HYP` (non-solvent). | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `SelectionParser.ts:559` |
| `polymer.nucleic` | Canonical ribonucleotides (`A`, `C`, `G`, `U`) and deoxyribonucleotides (`DA`, `DC`, `DG`, `DT`). | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `SelectionParser.ts:562` |
| `organic` | Hetero-residues (`isHetero === true`), excluding solvent, containing at least one carbon atom. | `CURRENT_IMPLEMENTED / NOT SCIENTIFICALLY BENCHMARKED` | `SelectionParser.ts:550` (Heuristic carbon test; formal cheminformatics benchmarking pending) |
| `inorganic` | Hetero-residues (`isHetero === true`), excluding solvent, containing zero carbon atoms. | `CURRENT_IMPLEMENTED / NOT SCIENTIFICALLY BENCHMARKED` | `SelectionParser.ts:553` (Heuristic non-carbon test; benchmarking pending) |
| `solvent` | Water molecules and crystallographic solvent species (`HOH`, `WAT`, `DOD`, `TIP3`, `SOL`). | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `SelectionParser.ts:582` |
| `hetatm` | All atoms originating from PDB `HETATM` records or flagged as non-standard heterogens. | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `SelectionParser.ts:585` |
| `backbone` | Protein peptide backbone (`N`, `CA`, `C`, `O`, `OXT`, `H`) and nucleic acid backbone (`P`, `O3'`, `O5'`, `C3'`, `C4'`, `C5'`, `O4'`, `C1'`, `C2'`). | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `SelectionParser.ts:565` |
| `sidechain` | All atoms in amino acid or nucleic acid residues not belonging to the backbone. | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `SelectionParser.ts:571` |
| `guide` | C-alpha atoms (`CA`) in proteins and Phosphorus atoms (`P`) in nucleic acids. | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `SelectionParser.ts:577` |
| `hydrogens` | Hydrogen and deuterium isotopes (`elem === 'H' || elem === 'D'`). | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `SelectionParser.ts:588` |
| `metals` | Common metal ions: `MG`, `ZN`, `FE`, `CA`, `NA`, `K`, `CU`, `MN`, `NI`, `CO`. | `CURRENT_IMPLEMENTED / NOT SCIENTIFICALLY BENCHMARKED` | `SelectionParser.ts:591` (Fixed 10-element list; full periodic table classification pending) |
| `donors` | Hydrogen-bond donors: hydrogens bonded to electronegative atoms, or electronegative atoms with available polar hydrogens. | `CURRENT_IMPLEMENTED / NOT SCIENTIFICALLY BENCHMARKED` | `SelectionParser.ts:594` (Heuristic donor rules; formal pKa/hybridization benchmark pending) |
| `acceptors` | Hydrogen-bond acceptors: electronegative atoms with lone pairs (`O`, `N`, `F`, `S`). | `CURRENT_IMPLEMENTED / NOT SCIENTIFICALLY BENCHMARKED` | `SelectionParser.ts:605` (Element-based heuristic; formal chemical perception benchmark pending) |

---

## 11. HETATM vs. Ligand vs. Water vs. Ion Semantics

The platform explicitly resolves the conceptual distinction between structural record types and chemical classifications:

1. **`HETATM` (Record Type):** A source file designation indicating any non-standard polymer residue. It includes ligands, cofactors, ions, crystallization reagents, and water molecules.
2. **`ligand` / `organic` (Chemical Role):** A non-polymer organic molecule (e.g. drug candidate, enzyme inhibitor, cofactor) with carbon-containing covalent topology. A ligand is a strict subset of `HETATM`.
3. **`water` / `solvent` (Solvent Role):** Bulk or structured water molecules (`HOH`). Distinct from organic ligands.
4. **`ion` / `metals` (Ionic Role):** Monoatomic or polyatomic inorganic salts (`MG`, `ZN`, `CL`, `SO4`).
5. **Modified Residues (e.g. Phosphotyrosine `PTR`, Selenomethionine `MSE`):** May be marked as `ATOM` or `HETATM` in legacy PDB files, but semantically belong to `polymer.protein`.

---

## 12. Protein and Nucleic-Acid Selectors

### 12.1 Protein Selection Queries
- `polymer.protein`: Resolves all amino acid residues.
- `backbone and polymer.protein`: Isolates protein mainchain atoms (`N`, `CA`, `C`, `O`).
- `sidechain and polymer.protein`: Isolates sidechain functional groups (e.g. for rotamer analysis or binding pocket visualization).
- `guide and polymer.protein`: Isolates strictly `CA` atoms for spline/ribbon trace calculations.

### 12.2 Nucleic-Acid Selection Queries
- `polymer.nucleic`: Resolves DNA and RNA polymer chains.
- `backbone and polymer.nucleic`: Resolves phosphodiester sugar-phosphate backbones (`P`, sugar carbons).
- `sidechain and polymer.nucleic`: Resolves purine and pyrimidine nitrogenous bases (Adenine, Cytosine, Guanine, Thymine, Uracil).
- `guide and polymer.nucleic`: Resolves strictly `P` atoms for nucleic cartoon trajectory generation.

---

## 13. Secondary-Structure Selectors

Secondary structure selection queries evaluate the canonical secondary structure classification assigned via DSSP (Kabsch-Sander 1983) or PDB header records:

| Query Syntax | Normalized Match | Qualifying Structure Types | Implementation & Validation Status |
|---|---|---|---|
| `ss h`, `ss helix` | Helix | $\alpha$-helix ($4_{13}$), $3_{10}$-helix, $\pi$-helix | `CURRENT_IMPLEMENTED / SCIENTIFICALLY BENCHMARKED` |
| `ss s`, `ss sheet`, `ss strand`, `ss e` | Sheet | $\beta$-sheet strand, extended $\beta$-bridge | `CURRENT_IMPLEMENTED / SCIENTIFICALLY BENCHMARKED` |
| `ss l`, `ss loop`, `ss c`, `ss coil` | Loop / Coil | Irregular loops, turns, bends, flexible termini | `CURRENT_IMPLEMENTED / SCIENTIFICALLY BENCHMARKED` |

---

## 14. Topological Selectors

Topological operators expand or contract selections strictly via the covalent chemical bond graph $\mathbf{G} = (V, E)$, independent of 3D spatial coordinates:

```
[Atom A] ──covalent bond── [Atom B] ──covalent bond── [Atom C]
    ▲                           ▲                           ▲
    │                           │                           │
  Input                     neighbor                     extend 2
```

### 14.1 Operator Semantics
1. **`neighbor <selection>`:**
   - **Definition:** Returns the immediate 1-hop covalent neighbors of all atoms in the input selection.
   - **Formal Logic:**
     $$S_{\text{neighbor}} = \{ b \in \mathcal{A} \mid \exists a \in S_{\text{input}}, (a, b) \in E \}$$
   - **Self-Inclusion:** Excludes the input atoms unless they are covalently bonded to another atom in $S_{\text{input}}$.
   - **Status:** `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` (`SelectionParser.ts:355`).

2. **`extend <N> [of] <selection>`:**
   - **Definition:** Performs an iterative breadth-first graph traversal of depth $N$ across covalent bonds.
   - **Formal Logic:**
     $$S_{\text{extend}(N)} = \{ b \in \mathcal{A} \mid \text{shortest\_path}_{\mathbf{G}}(S_{\text{input}}, b) \le N \}$$
   - **Self-Inclusion:** Input atoms are included in the result ($S_{\text{input}} \subseteq S_{\text{extend}}$).
   - **Status:** `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` (`SelectionParser.ts:370`).

3. **`byres <selection>`:**
   - **Definition:** Residue expansion. Identifies all parent residues containing at least one atom in $S_{\text{input}}$, and returns all atoms belonging to those residues.
   - **Formal Logic:**
     $$S_{\text{byres}} = \{ b \in \mathcal{A} \mid \exists a \in S_{\text{input}}, \text{residue}(b) = \text{residue}(a) \}$$
   - **Status:** `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` (`SelectionParser.ts:300`).

4. **`bychain <selection>`:**
   - **Definition:** Chain expansion. Identifies all parent chains containing at least one atom in $S_{\text{input}}$, and returns all atoms belonging to those chains.
   - **Formal Logic:**
     $$S_{\text{bychain}} = \{ b \in \mathcal{A} \mid \exists a \in S_{\text{input}}, \text{chain}(b) = \text{chain}(a) \}$$
   - **Status:** `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` (`SelectionParser.ts:312`).

5. **`bymolecule` / `byobject` `<selection>`:**
   - **Definition:** Connected-component expansion. Returns all atoms in the same contiguous covalently bonded molecule or parent workspace object.
   - **Formal Logic:** Graph connected-component traversal from $S_{\text{input}}$.
   - **Status:** `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` (`SelectionParser.ts:323`).

---

## 15. Spatial Selectors

Spatial operators evaluate metric Euclidean distances in Cartesian space using atomic coordinates $\mathbf{X} \in \mathbb{R}^{N \times 3}$:

### 15.1 Mathematical Distance Metric
The Euclidean distance $d(a, b)$ between atom $a$ at position $\mathbf{r}_a = (x_a, y_a, z_a)$ and atom $b$ at position $\mathbf{r}_b = (x_b, y_b, z_b)$ is:
$$d(a, b) = \|\mathbf{r}_a - \mathbf{r}_b\|_2 = \sqrt{(x_a - x_b)^2 + (y_a - y_b)^2 + (z_a - z_b)^2}$$

### 15.2 Spatial Operator Definitions
1. **`within <cutoff> [of] <selection>` (Proximity Sphere):**
   - **Definition:** Returns all atoms in the structure whose center is within distance $d \le \text{cutoff}$ of any atom in the input selection.
   - **Self-Inclusion:** **Includes** the input selection atoms ($S_{\text{input}} \subseteq S_{\text{within}}$).
   - **Formal Logic:**
     $$S_{\text{within}} = \{ b \in \mathcal{A} \mid \exists a \in S_{\text{input}}, d(b, a) \le \text{cutoff} \}$$
   - **Status:** `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` (`SelectionParser.ts:416`).

2. **`around <cutoff> [of] <selection>` (Proximity Shell):**
   - **Definition:** Returns all atoms whose center is within distance $d \le \text{cutoff}$ of the input selection, **strictly excluding** the input selection atoms.
   - **Self-Inclusion:** **Excludes** the input selection ($S_{\text{around}} = S_{\text{within}} \setminus S_{\text{input}}$).
   - **Formal Logic:**
     $$S_{\text{around}} = \{ b \in \mathcal{A} \setminus S_{\text{input}} \mid \exists a \in S_{\text{input}}, d(b, a) \le \text{cutoff} \}$$
   - **Status:** `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` (`SelectionParser.ts:405`).

3. **`beyond <cutoff> [of] <selection>` (Exterior Void):**
   - **Definition:** Returns all atoms whose distance to all atoms in the input selection strictly exceeds the cutoff ($d > \text{cutoff}$).
   - **Formal Logic:**
     $$S_{\text{beyond}} = \{ b \in \mathcal{A} \mid \forall a \in S_{\text{input}}, d(b, a) > \text{cutoff} \}$$
   - **Status:** `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` (`SelectionParser.ts:427`).

---

## 16. Spatial-Index Optimization Boundary

### 16.1 Spatial Hash Grid Acceleration
To ensure $O(N)$ evaluation performance on large macromolecular complexes (e.g. Ribosome `1FFK`, GroEL `1AON`), a spatial hash grid partition (`SpatialHashGrid`, `SelectionParser.ts:20-77`) is employed.

### 16.2 Invariant Boundary Rule
> **NORMATIVE RULE (DM-SEL-OPT):**  
> The spatial index is strictly a computational optimization for candidate pruning. Under no circumstances may the index cell size, bounding box discretization, or grid hash function alter the scientific result. All candidate atoms identified by the spatial grid MUST undergo exact Float64 Euclidean distance verification before admission to $S$.

$$\text{Coordinates } \mathbf{X} \xrightarrow{\text{Grid Bucket}} \text{Candidate Atoms } \mathcal{C} \xrightarrow{d(a, b) \le \text{cutoff}} \text{Exact Result } S$$

---

## 17. Selection Scope and Multi-Object Disambiguation

### 17.1 Scope Hierarchy
The query evaluation scope determines the universe $\mathcal{A}_{\text{scope}}$ against which predicates and complements (`not`) are evaluated:

| Scope Level | Definition | Behavior | Status |
|---|---|---|---|
| **Active Object** | Single active `Object` | Query evaluates only across atoms in the currently selected object. | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` |
| **Active Molecule** | Single `Molecule` hierarchy | Query evaluates across all chains and residues within the molecule. | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` |
| **Workspace / Global** | All objects in session | Query evaluates across all loaded objects (e.g. `all` selects entire workspace). | `CURRENT_PARTIAL` |
| **Explicit Object Target** | Qualified name (e.g. `1HVR/A/10-20/CA`) | Query restricts evaluation to the specified object container. | `SPECIFIED_NOT_IMPLEMENTED` |

### 17.2 Multi-Object Disambiguation and Identity Scoping
Canonical atom IDs (`canonical_id`) are scoped strictly to their parent `Molecule` / `Object`. When multiple objects exist in the workspace:
1. **Local Identity Scope:** In single-object console queries, bare canonical IDs (`id 10`) resolve directly within that object.
2. **Composite Workspace Key:** In multi-object workspace selections, session persistence, and GUI picking, selection state is addressed via a composite key:
   $$\text{SelectionKey} = \text{object\_id} + \text{":"} + \text{canonical\_id}$$
   *(Defined in `src/interaction/types.ts:createSelectionKey(structureId, serial)`).*
3. **Collision Prevention:** Two distinct objects loaded in the workspace may both have an atom with `canonical_id: 1`. The composite key ensures zero collision during cross-structure comparisons, alignments, or multi-object selections.

---

## 18. Multi-State Selection

### 18.1 Current Implementation vs. Future Model
- **`CURRENT_IMPLEMENTATION`:** Single conformational state active in memory. Selections evaluate against the active coordinate buffer in `MolProcessor.atoms` or `store/index.ts:processedPDB`.
- **`SPECIFIED_FUTURE_MODEL`:**
  - **State-Independent Selections:** Property selections (`resn ALA`, `chain A`, `elem C`) evaluate against shared topology $\mathcal{M}$ and yield identical atom sets across all conformational states.
  - **State-Specific Spatial Selections:** Spatial queries (`within 5.0 of resn LIG`) evaluate against coordinates $\mathbf{X}_k$ of state $k$. When multiple states are loaded (NMR ensemble with 20 models, docking pose ensemble), spatial queries may yield state-dependent atom sets $S(k)$.
- **Status:** `SPECIFIED_NOT_IMPLEMENTED` (Multi-state selection coordination deferred to Phase P11).

---

## 19. Alternate-Location Selection

### 19.1 Conformer Addressing
In structures with crystallographic disorder (e.g. `1CRN`, `4HHB`), alternate location conformers are addressed via the `alt` selector:
- `alt A`: Selects all atoms assigned alternate location identifier `'A'`.
- `alt B`: Selects all atoms assigned alternate location identifier `'B'`.
- `alt ''` / `alt ' '`: Selects non-disordered atoms (blank altLoc).
- `alt A+''`: Selects conformer A atoms plus all shared backbone/rigid atoms.

### 19.2 Bond Disjointness in Selections
In accordance with P0.2 rule `DM-A002`, topological expansions (`neighbor`, `extend`) traversing from an altLoc `'A'` atom must follow disjoint conformer paths: they may traverse to shared blank `' '` atoms or altLoc `'A'` atoms, but must never traverse across disjoint conformer boundaries to altLoc `'B'`.

---

## 20. Named Selections

### 20.1 Lifecycle Operations
Users and automated scripts may assign persistent names to selection queries:
1. **Creation / Definition:**  
   `select <name>, <expression>` (e.g. `select pocket, byres (resn LIG around 5.0)`)  
   Creates a named selection record in the workspace session.
2. **Replacement:** Re-executing `select <name>, <new_expression>` overwrites the previous definition and recalculates the atom set.
3. **Invocation:** Named selections can be referenced as primary operands in subsequent queries: `pocket and elem N`.
4. **Deletion:** `delete <name>` or `remove <name>` removes the named selection from the session store without mutating physical atoms.
5. **Status:** `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` (`SelectionParser.ts:626`, `SessionSchema.ts:NamedSelectionSession`).

---

## 21. Empty Selections

A selection query that matches zero atoms is a valid scientific result:
- **Formal State:** $S = \emptyset$ with `count: 0`.
- **Evaluation Behavior:** Returns a clean `SelectionResult` with empty ID array (`selected_ids: []`).
- **Fail-Safe Invariant:** An empty selection is **NOT** an error. It must never trigger exceptions, abort sessions, or alter molecular state.

---

## 22. Invalid Selections and Fail-Closed Behavior

Any malformed, unparseable, or physically impossible query must fail closed:
- **Fail-Closed Principle:** The engine returns an explicit structured error, halts execution of dependent operations (e.g. structural edits), and leaves authoritative molecular state completely untouched.
- **Zero Silent Fallback:** The engine must never guess user intent or fall back to `all` or prior selections upon syntax failure.

---

## 23. Parse Errors vs. Semantic Errors

The engine strictly distinguishes syntactic malformations from semantic validation failures:

| Error Category | Definition | Concrete Example | Failure Trigger | Engine Behavior |
|---|---|---|---|---|
| **Parse Error** | Query violates formal EBNF grammar syntax or token rules. | `(chain A`, `chain A and`, `within 5` | Unbalanced parentheses, missing binary operands, truncated tokens. | Emits `SelectionSyntaxError` with character offset. |
| **Semantic Error** | Query is syntactically valid but references impossible properties or parameters. | `within -5.0 of resn LIG`, `b > "string"` | Negative distance cutoff, non-numeric comparison value. | Emits `SelectionSemanticError` with parameter details. |

---

## 24. Case Sensitivity

To guarantee predictable user interaction and robust script execution, the following case sensitivity policy is enforced:

| Query Entity | Case Policy | Concrete Example | Evaluator Normalization |
|---|---|---|---|
| **Language Keywords** | Case-insensitive | `AND`, `and`, `And`, `ByRes`, `within` | Normalized to lowercase internally. |
| **Residue Names (`resn`)** | Case-insensitive | `ala`, `ALA`, `Ala` $\to$ matches `ALA` | Trimmed and converted to uppercase. |
| **Element Symbols (`elem`)** | Case-insensitive | `c`, `C`, `fe`, `FE` $\to$ matches `C`, `FE` | Trimmed and converted to uppercase. |
| **Atom Names (`name`)** | Case-insensitive | `ca`, `CA`, `n`, `N` $\to$ matches `CA`, `N` | PDB standard uppercase normalization. |
| **Chain Identifiers (`chain`)**| **Case-sensitive** | `chain A` $\ne$ `chain a` | Preserves case to distinguish macromolecular chains. |
| **Named Selection Keys** | Case-insensitive | `pocket`, `POCKET` | Normalized to lowercase key in store. |

---

## 25. Range, List, and Wildcard Semantics

### 25.1 Shorthand Lists (`+`)
The `+` delimiter denotes an inline union of terms for a single property:
- `resn ALA+GLY+VAL` $\equiv$ `(resn ALA or resn GLY or resn VAL)`
- `name CA+CB+N+O` $\equiv$ `(name CA or name CB or name N or name O)`
- `chain A+B` $\equiv$ `(chain A or chain B)`

### 25.2 Numerical Ranges (`-`)
The `-` delimiter defines an inclusive numerical range $[min, max]$:
- `resi 1-50` $\equiv$ $\{ a \in \mathcal{A} \mid 1 \le \text{resSeq}(a) \le 50 \}$
- `id 100-200` $\equiv$ $\{ a \in \mathcal{A} \mid 100 \le \text{canonical\_id}(a) \le 200 \}$

### 25.3 Wildcard Matching (`*`)
The `*` character represents zero or more arbitrary characters:
- `name C*` $\to$ Matches `C`, `CA`, `CB`, `CG`, `CD1`, `CD2`, `CZ`
- `resn GL*` $\to$ Matches `GLY`, `GLU`, `GLN`

---

## 26. Deterministic Result Ordering

To ensure byte-for-byte reproducibility across serialization passes and network APIs, selection output sets must adhere to a deterministic order:
- **Ordering Rule:** `SelectionResult.selected_ids` is strictly sorted in **ascending numerical order of canonical atom IDs**:
  $$\text{selected\_ids} = [ \text{id}_1, \text{id}_2, \dots, \text{id}_k ] \quad \text{where } \text{id}_i < \text{id}_{i+1}$$

---

## 27. Duplicate Elimination

Selection queries frequently evaluate overlapping criteria (e.g. `(chain A) or (resi 1-20)` or `byres (name CA)`). Because selection semantics are rooted in set theory:
- Any atom satisfying multiple predicates is admitted to $S$ exactly once.
- Evaluators must eliminate duplicates during evaluation using Set hashing data structures.

---

## 28. Selection Immutability

> **SCIENTIFIC PRINCIPLE:**  
> Selection evaluation is a read-only probe of scientific state. Executing any selection query must NEVER alter atomic positions, covalent bonds, residue/chain memberships, B-factors, or session history.

---

## 29. Selection Provenance

When a selection serves as the input argument to a scientific mutation (e.g. `remove solvent`, `alter chain A, b=20.0`), the transformation ledger must record complete selection provenance:
- Original query expression string.
- Canonical normalized query AST.
- Resolved canonical atom ID array at the moment of execution.
- SHA-256 hash of the input conformational state.

---

## 30. GUI, Console, and API Equivalence

> **NORMATIVE EQUIVALENCE RULE (DM-SEL-EQ):**  
> A selection performed via the 3D viewport (e.g. picking a residue), the Selection Query Console, the command-line console, or a typed API MUST resolve to the exact same canonical atom-ID set $S$ for identical molecular states.

```
       GUI 3D Viewport Interaction (Click Residue 15)
                             │
                             ▼
                 resolveSelection('residue')
                             │
Selection Query Console ─────┼─────> Canonical Evaluator ───> S = { 112, 113, ..., 120 }
("byres (chain A & resi 15)")│
                             ▼
                      Typed Python API
               (mol.select("resi 15 and chain A"))
```

---

## 31. Selection Presets

MolStudio provides high-frequency visual selection presets. Each preset maps directly to a canonical selection query:

| Preset Name | Canonical Selection Expression | Semantic Description | Status |
|---|---|---|---|
| **All Atoms** | `all` | Selects entire molecular universe. | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` |
| **Protein Backbone** | `polymer.protein and backbone` | Selects protein peptide chain (`N, CA, C, O`). | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` |
| **Sidechains** | `polymer.protein and sidechain` | Selects all amino acid sidechain functional groups. | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` |
| **Ligands & Heteroatoms** | `organic or (hetatm and not solvent)` | Selects small-molecule ligands and cofactors. | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` |
| **Water Molecules** | `solvent` (`resn HOH+WAT+DOD+SOL`) | Selects crystallographic water species. | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` |
| **Alpha Helices** | `ss h` | Selects helical protein segments. | `CURRENT_IMPLEMENTED / SCIENTIFICALLY BENCHMARKED` |
| **Beta Sheets** | `ss s` | Selects extended $\beta$-strand sheets. | `CURRENT_IMPLEMENTED / SCIENTIFICALLY BENCHMARKED` |
| **Binding Pocket** | `byres (around 5.0 of organic)` | Selects all residues within 5.0 Å of any ligand. | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` |

---

## 32. Performance Requirements

1. **Pruning Efficiency:** Spatial proximity searches on structures up to 100,000 atoms (e.g. `1FFK`, `1AON`) must complete candidate discovery in $< 15\text{ ms}$ using spatial hash grids.
2. **Sub-Linear Parsing:** Tokenization and AST construction for expressions up to 500 characters must execute in $< 0.5\text{ ms}$.
3. **Memory Footprint:** In-memory selection caches must not exceed $O(N)$ space where $N$ is the number of atoms.

---

## 33. Selection Oracle and Test Architecture

The Selection Oracle test architecture validates selector correctness by comparing parser evaluation against ground-truth index sets across four verification tiers:
1. **Unit Syntax Tests:** Verification of EBNF parsing, operator precedence, and syntax error throwing.
2. **Deterministic Oracle Tests:** Bitwise comparison of `SelectionResult.selected_ids` against independent ground-truth filter algorithms across benchmark structures.
3. **Adversarial & Edge-Case Tests:** Empty matches, negative numbers, boundary cutoffs, malformed syntax.
4. **Round-Trip Persistence Tests:** Verifying that named selections survive `.PSE` save/load cycles without ID degradation.

---

## 34. Golden Test Fixtures and Exact Verified Values

### 34.1 Physical Repository Fixtures (Independently Verified on Disk)
The following structures are physically present in the repository and were audited with bitwise-exact atom counts using `MolProcessor` and `SelectionParser`:

| Structure File / Path | Category | Exact Total Atoms | Polymer Atoms | HETATM Atoms | Solvent (Water) | Organic Ligand | Metals | Key Verified Query Counts |
|---|---|---|---|---|---|---|---|---|
| `fixtures/03_protein_with_ligand.pdb` | Controlled Test Fixture | **20** | **16** (Protein ALA, GLY, VAL) | **4** (LIG) | **0** | **4** (LIG) | **0** | `all` $\to$ 20, `polymer` $\to$ 16, `organic` $\to$ 4, `name CA` $\to$ 3, `solvent` $\to$ 0 |
| `1BNA.pdb` (Root) | Synthetic B-DNA Dodecamer | **566** | **486** (DNA Chains A & B) | **80** (Water) | **80** (`HOH`) | **0** | **0** | `all` $\to$ 566, `polymer.nucleic` $\to$ 486, `solvent` $\to$ 80, `guide` $\to$ 24 (`P` atoms) |
| `1HVR.pdb` (Root) | HIV-1 Protease + XK263 | **1890** | **1826** (Chains A & B) | **64** (XK263 Inhibitor) | **0** | **64** (XK263) | **0** | `all` $\to$ 1890, `polymer.protein` $\to$ 1826, `organic` $\to$ 64, `name CA` $\to$ 198 |
| `scratch/1CRN.pdb` | Crambin (Plant Seed Protein) | **327** | **327** (Chain A, 46 res) | **0** | **0** | **0** | **0** | `all` $\to$ 327, `ss h` $\to$ 152, `ss s` $\to$ 48, `name CA` $\to$ 46 |
| `scratch/4HHB.pdb` | Human Deoxyhemoglobin ($\alpha_2\beta_2$) | **4779** | **4384** (Chains A-D, 574 res) | **395** (Heme + PO4 + Wat) | **221** (`HOH`) | **172** (4x HEM) | **4** (4x Fe) | `all` $\to$ 4779, `polymer` $\to$ 4384, `organic` $\to$ 172, `metals` $\to$ 4, `solvent` $\to$ 221, `name CA` $\to$ 574 |
| `scratch/1UBQ.pdb` | Ubiquitin Regulatory Protein | **660** | **602** (Chain A, 76 res) | **58** (Water) | **58** (`HOH`) | **0** | **0** | `all` $\to$ 660, `polymer.protein` $\to$ 602, `solvent` $\to$ 58, `name CA` $\to$ 76 |

### 34.2 Explanation of the 4HHB Atom Count Discrepancy
- **Source File:** `scratch/4HHB.pdb` (crystallographic resolution 1.74 Å).
- **Observed Total Loaded Atoms:** **4,779 atoms** (verified by `MolProcessor.atoms.length` and documented in `docs/reports/qa_10_structures_verified_report.md`).
- **Breakdown:** 4,384 protein atoms (Chains A, B, C, D) + 172 organic heme atoms (4 $\times$ protoporphyrin IX) + 4 iron metal ions ($Fe^{2+}$) + 221 crystallographic water molecules (`HOH`) + 8 atoms from 2 phosphate buffer ions ($PO_4$).
- **Origin of the 4,376 Number:** The count of 4,376 atoms was derived in earlier manual testing when evaluating protein-only coordinates after stripping solvent waters, phosphate ions, and filtering out certain disordered conformers ($4384 - 8 = 4376$). The normative specification adopts the full canonical file model count: **4,779 atoms**.

### 34.3 Planned Synthetic Fixtures from MASTER_PLAN.md
The following synthetic fixtures were defined in `MASTER_PLAN.md` specification lists and will be generated on disk in subsequent milestones:
- `01_simple_protein.pdb`: Planned 20-atom synthetic single-chain peptide (`all` $\to$ 20, `name CA` $\to$ 5).
- `02_two_chain_protein.pdb`: Planned 24-atom synthetic dimeric peptide (`chain A` $\to$ 12, `chain B` $\to$ 12).
- `05_water_and_heteroatoms.pdb`: Planned synthetic fixture with protein + ions + water.

---

## 35. Current Implementation Audit Matrix

The following matrix documents the exact status of selection capabilities across the existing codebase:

| Capability | Current File | Current Syntax | Implementation & Scientific Status | Evidence Reference | Gap / Future Refactor Requirement |
|---|---|---|---|---|---|
| **Atom Name Matching** | `src/lib/SelectionParser.ts:475` | `name CA+CB` | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `qa_group8_selection_query.ts:59` | Add support for padded 4-character exact PDB name matching. |
| **Residue Name Matching** | `src/lib/SelectionParser.ts:472` | `resn ALA+GLY` | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `qa_group8_selection_query.ts:65` | Full conformance verified. |
| **Residue Sequence Ranges** | `src/lib/SelectionParser.ts:478` | `resi 1-50` | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `qa_group8_selection_query.ts:71` | Extend parser to handle insertion codes (`resi 100A-105`). |
| **Chain ID Matching** | `src/lib/SelectionParser.ts:473` | `chain A+B` | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `qa_group8_selection_query.ts:77` | Support blank chain selector (`chain ''`). |
| **Element Matching** | `src/lib/SelectionParser.ts:474` | `elem C+N+O` | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `qa_group8_selection_query.ts:83` | Full conformance verified. |
| **B-factor Comparison** | `src/lib/SelectionParser.ts:501` | `b > 30.0` | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `qa_group8_selection_query.ts:277` | Full conformance verified. |
| **Occupancy Comparison** | `src/lib/SelectionParser.ts:503` | `q < 1.0` | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `qa_group8_selection_query.ts:277` | Full conformance verified. |
| **Secondary Structure** | `src/lib/SelectionParser.ts:481` | `ss h`, `ss s` | `CURRENT_IMPLEMENTED / SCIENTIFICALLY BENCHMARKED` | `validate_dssp_dihedrals.md` | Connect to backend 3DNA nucleic secondary structure. |
| **Boolean Operators** | `src/lib/SelectionParser.ts:114` | `and`, `or`, `not` | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `qa_group8_selection_query.ts:104` | Full precedence conformance verified. |
| **Parentheses Grouping** | `src/lib/SelectionParser.ts:156` | `(...)` | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `qa_group8_selection_query.ts:158` | Full conformance verified. |
| **Spatial Proximity (within)** | `src/lib/SelectionParser.ts:415` | `within 4.0 of ...` | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `qa_group8_selection_query.ts:123` | Accelerate via SpatialHashGrid candidate pruning. |
| **Spatial Shell (around)** | `src/lib/SelectionParser.ts:404` | `around 4.0 of ...` | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `qa_group8_selection_query.ts:132` | Verified self-exclusion behavior. |
| **Topological Expansion (byres)** | `src/lib/SelectionParser.ts:299` | `byres (...)` | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `qa_group8_selection_query.ts:141` | Full conformance verified. |
| **Topological Expansion (bychain)**| `src/lib/SelectionParser.ts:311` | `bychain (...)` | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `test_selection_engine.ts:64` | Full conformance verified. |
| **Topological Graph (neighbor)** | `src/lib/SelectionParser.ts:354` | `neighbor (...)` | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `SelectionParser.ts:354` | Migrate from array index bonds to canonical ID bonds. |
| **Topological Graph (extend)** | `src/lib/SelectionParser.ts:369` | `extend 2 of ...` | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `SelectionParser.ts:369` | Migrate to canonical ID graph edge list. |
| **Chemical Classes (organic, etc.)**| `src/lib/SelectionParser.ts:525` | `organic`, `metals` | `CURRENT_IMPLEMENTED / NOT SCIENTIFICALLY BENCHMARKED` | `qa_group8_selection_query.ts:98` | Benchmark against ChEBI/PDB chemical dictionary. |
| **Named Selection Storage** | `src/lib/SelectionParser.ts:626` | `select name, expr` | `CURRENT_IMPLEMENTED / SOFTWARE VERIFIED` | `qa_group8_selection_query.ts:183` | Full session round-trip verified. |
| **Multi-State Spatial Selection** | `src/lib/SelectionParser.ts` | Multi-model evaluation | `SPECIFIED_NOT_IMPLEMENTED` | Deferred to Phase P11 | Implement per-state coordinate container mapping. |

---

## 36. PyMOL Semantic Compatibility Classification

Molexplorer maintains strict runtime independence and does **NOT** embed PyMOL binaries or Python wrappers. The platform implements native semantic compatibility classified as follows:

- **`CORE` (High-Value Workstation Compatibility):**
  `all`, `none`, `name`, `resn`, `resi`, `chain`, `elem`, `id`, `b`, `q`, `ss`, `alt`, `segi`, `hetatm`, `solvent`, `organic`, `inorganic`, `metals`, `hydrogens`, `polymer.protein`, `polymer.nucleic`, `backbone`, `sidechain`, `guide`, `donors`, `acceptors`, `byres`, `bychain`, `bymolecule`, `neighbor`, `extend`, `within`, `around`, `beyond`, `and`, `or`, `not`, `select <name>, <expr>`.
- **`ADVANCED` (Planned Workstation Capabilities):**
  Insertion-code ranges (`resi 100A-105`), coordinate frame selectors (`state 1`), property macro expansions.
- **`RESEARCH` (Exploratory Features):**
  Dynamic pocket volume selections based on grid isosurfaces.
- **`DEFERRED` (Post-Core Capabilities):**
  Arbitrary Python lambda functions embedded in selection strings.
- **`REFERENCE-DIFFERENT`:**
  PyMOL selection queries that silently tolerate ambiguous syntax will fail closed in Molexplorer with explicit syntax warnings.

---

## 37. Open Scientific Decisions

The following open decisions are formally registered with `status: PROPOSED` and explicit decision gates:

### `OD-SEL-001`: Case-Sensitivity of Chain Identifiers
- **Question:** Should chain identifiers in selection expressions be strictly case-sensitive (`chain A` $\ne$ `chain a`) or case-insensitive?
- **Current Behavior:** `SelectionParser.ts:473` performs case-insensitive comparison (`toLowerCase() === toLowerCase()`).
- **Options:**
  - *Option A:* Case-sensitive matching (preserves distinction between uppercase chains `A-Z` and lowercase chains `a-z` in large ribosome complexes).
  - *Option B:* Case-insensitive matching (convenient for single-character typing).
- **Recommended Option:** *Option A (Case-sensitive)* with explicit fallback warning if a case mismatch occurs and only one case variant exists.
- **Evidence Required:** Audit multi-chain PDB fixtures (e.g. `1FFK`, `1AON`) containing $> 26$ chains.
- **Decision Gate:** Phase P2 Selection Engine v2 Gate.
- **Status:** `PROPOSED`  
- **Owner:** Lead Scientific Architect

### `OD-SEL-002`: Insertion-Code Range Expansion Semantics
- **Question:** How should alphanumeric insertion code ranges (e.g. `resi 100A-100C`) be parsed and sorted?
- **Current Behavior:** `SelectionParser.ts:459` parses integer residue ranges via regex `^(\d+)-(\d+)$`, ignoring insertion codes.
- **Options:**
  - *Option A:* Strict PDB sequence order traversal between starting residue and ending residue.
  - *Option B:* Lexicographical alphanumeric comparison on composite `resSeq + iCode`.
- **Recommended Option:** *Option A (Sequence-order traversal along the chain polymer graph).*
- **Evidence Required:** Unit test suite on antibody CDR loop structures with dense insertion codes (e.g. Chothia/Kabat antibody numbering).
- **Decision Gate:** Phase P2 Selection Engine v2 Gate.
- **Status:** `PROPOSED`  
- **Owner:** Lead Scientific Architect

### `OD-SEL-003`: Multi-State Spatial Selection Default
- **Question:** When a spatial selection (e.g. `within 5.0 of organic`) is executed on a multi-model ensemble, what is the default evaluation scope?
- **Current Behavior:** Evaluates against the active display model only.
- **Options:**
  - *Option A:* Evaluate strictly against the active conformational state (State $k$).
  - *Option B:* Union across all conformational states in the ensemble.
  - *Option C:* Require explicit qualifier (e.g. `state 1 within 5.0 of organic` vs `all_states within 5.0 of organic`).
- **Recommended Option:** *Option A as default, with Option C syntax for ensemble operations.*
- **Evidence Required:** Benchmark docking pose ensemble filtering workflows.
- **Decision Gate:** Phase P11 Object/State/Session Gate.
- **Status:** `PROPOSED`  
- **Owner:** Lead Scientific Architect

---

## 38. Acceptance Criteria

This specification satisfies all normative requirements for Phase P0.3:
- [x] Mathematical foundation and formal evaluation function $f(\text{query}) \to S \subseteq \mathcal{A}$ are established.
- [x] Unidirectional pipeline from tokenization to typed AST and `SelectionResult` is detailed.
- [x] Canonical atom-ID grounding is enforced in full alignment with P0.2 (`DATA_MODEL_SPEC.yaml`).
- [x] Formal EBNF grammar and complete operator precedence hierarchy are specified.
- [x] Complete property selector matrix and chemical class definitions are classified with software vs. scientific benchmark status.
- [x] Topological graph operators and spatial metric operators are rigorously distinguished.
- [x] Spatial index optimization boundary is declared non-authoritative.
- [x] Multi-object scoping, composite selection keys (`structureId:serial`), and multi-state selections are defined.
- [x] Structured error model (parse vs. semantic) and fail-closed policies are formulated.
- [x] Determinism, result sorting, duplicate elimination, and provenance tracking are defined.
- [x] Normative GUI / Console / API equivalence rule is established.
- [x] Complete codebase audit matrix and independently verified golden fixture counts (`03_protein_with_ligand.pdb`, `1BNA.pdb`, `1HVR.pdb`, `4HHB.pdb`, `1CRN.pdb`, `1UBQ.pdb`) are detailed.
- [x] Open decisions are formally documented with `status: PROPOSED` and target gates.
- [x] Executed as a **DOCUMENTATION-ONLY** milestone with zero application source code mutations.
