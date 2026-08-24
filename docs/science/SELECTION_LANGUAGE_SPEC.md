# Selection Language Specification (Phase SQ1)

**Status:** `AUTHORITATIVE`  
**Phase:** `SQ1 — Core Selection Algebra Completion`  
**Evaluator Architecture:** AST-Driven Canonical Selection Evaluator  

---

## 1. Abstract & Mathematical Foundation

The Molexplorer Selection Language is a formal, deterministic, domain-native query algebra designed to isolate subsets of atomic coordinates and topological entities from an active `CanonicalMolecularDocument` or `CanonicalMolecule`.

Formally, a selection query $Q$ maps a molecular state $\mathcal{S} = (\mathcal{V}, \mathcal{E}, \mathbf{X})$ and an evaluation scope $\Omega$ to a subset of canonical atom identifiers $\Sigma \subseteq \mathcal{V}$:

$$Q: (\mathcal{S}, \Omega) \longrightarrow \Sigma = \{ v \in \mathcal{V} \mid \mathcal{P}(v) = \text{true} \}$$

### Core Scientific Invariants
1. **Read-Only Invariant:** Selection evaluation never mutates coordinates, covalent topology, or history DAGs:
   $$\mathcal{H}(\mathcal{S}_{\text{after}}) \equiv \mathcal{H}(\mathcal{S}_{\text{before}}), \quad |\Delta \text{Revisions}| = 0$$
2. **Universe Boundedness:** 
   $$\text{eval}(\text{"all"}, \mathcal{S}) = \mathcal{V}_{\Omega}, \quad \text{eval}(\text{"none"}, \mathcal{S}) = \emptyset$$
3. **Double Complement Parity:**
   $$\text{eval}(\text{"not (not } S \text{)"}) \equiv \text{eval}(S)$$
4. **Expansion Subset Invariant:**
   $$S \subseteq \text{expand}(d, S) \quad \forall d \ge 0$$
5. **Separation of Concerns:** Selection expressions are evaluated independently of visual display commands (`color`, `show`, `hide`, `label`).

---

## 2. Formal Grammar & Precedence Hierarchy

The grammar is structured into strict mathematical precedence levels (evaluated from highest binding strength to lowest):

| Level | Operator Category | Operators / Syntax | Associativity / Behavior |
| :--- | :--- | :--- | :--- |
| **6 (Highest)** | **Primary Expressions** | `(...)`, `/[model]/[segi]/[chain]/[resi]/[name]`, literals, flags, named selection references | Enclosed / Atomic |
| **5** | **Unary & Prefix Proximity** | `not`, `!`, `neighbor`, `bound_to`, `extend <N> [of]`, `within <d> of`, `around <d> of`, `beyond <d> of`, `expand <d> of` | Right-associative prefix |
| **4** | **Postfix Spatial Modifiers** | `<S> expand <d>`, `<S> around <d>`, `<S> within <d>`, `<S> beyond <d>` | Left-associative postfix |
| **3** | **Logical Conjunction** | `and`, `&`, whitespace juxtaposition (`name CA resi 10`) | Left-associative binary |
| **2** | **Logical Disjunction** | `or`, `\|` | Left-associative binary |
| **1 (Lowest)** | **Hierarchical Closure** | `byres`, `bychain`, `bymolecule`, `bycalpha` (`byca`), `byring`, `byobject`, `bysegi` | Weak prefix unary (binds entire trailing expression unless parenthesized) |

---

## 3. Selector Inventory & Behavioral Semantics

### 3.1. Identity Selectors
- `id <number | range | list>`: Matches source-format atom serial numbers (e.g. `id 100-200`, `id 1,5,10`).
- `index <number | range | list>`: Matches 0-based runtime atom offsets in the object array (e.g. `index 0`, `index 0-4`).
- `rank <number | range | list>`: Matches 1-based load-order entry indices (e.g. `rank 1-10`).
- `first`: Selects the first atom in the active object (`index 0`).
- `last`: Selects the final atom in the active object (`index N-1`).

### 3.2. Atom & Residue Properties
- `name` / `atom <pattern | list>`: Atom names with glob wildcard matching (e.g. `name CA`, `name C*`, `name H*`, `name CA+CB+CG`).
- `elem` / `element` / `symbol <element | list>`: Chemical elements (e.g. `elem S`, `elem FE+ZN+MG`).
- `resi` / `resv <number | range | list>`: Residue sequence numbers (e.g. `resi 10-25`, `resi 10:25`, `resi 10+12+15`, `resi 52A` insertion codes).
- `resn` / `res <name | list>`: Residue names (e.g. `resn ALA`, `resn ALA+GLY+CYS`, `resn HEM`).
- `chain <id | list>`: Chain identifiers (e.g. `chain A`, `chain A+B`).
- `segi` / `segid <id | list>`: Segment identifiers.
- `alt` / `altloc <id>`: Alternate conformation identifiers (e.g. `alt A`, `alt B`).
- `b` / `bfactor <op> <value>`: Isotropic temperature factors (e.g. `b < 20.0`, `b >= 15.5`).
- `q` / `occupancy <op> <value>`: Crystallographic occupancy (e.g. `q == 1.0`, `q < 0.5`).
- `formal_charge` / `fc <op> <value>`: Formal charges (e.g. `fc > 0`, `fc == -1`).
- `ss <type>`: Secondary structure (`ss h` helix, `ss s` sheet, `ss l` loop).

### 3.3. Classification Flags
- `all`: Universal set $\mathcal{V}$.
- `none`: Empty set $\emptyset$.
- `polymer`: All standard amino acids and nucleic acids.
- `protein` / `polymer.protein`: Standard and modified amino acid residues.
- `nucleic` / `polymer.nucleic`: Ribonucleotide and deoxyribonucleotide residues.
- `organic`: Non-solvent hetero groups containing carbon.
- `inorganic`: Non-solvent hetero groups lacking carbon (e.g. metal clusters, sulfate ions).
- `solvent` / `waters` / `water`: Water molecules (`HOH`, `WAT`, `DOD`, `SOL`, `TIP3`, `TIP4`).
- `hetatm`: Non-polymer hetero atoms.
- `hydrogens` / `hydro` / `h`: Hydrogen and deuterium isotopes (`H`, `D`).
- `metals`: Metallic elements (`MG`, `ZN`, `FE`, `CA`, `NA`, `K`, `CU`, `MN`, `NI`, `CO`, `CD`, `HG`, `PT`, `AU`, `AG`).
- `backbone`: Peptide backbone (`N, CA, C, O, OXT, H, HA`) and nucleic backbone (`P, OP1, OP2, OP3, O3', O5', C3', C4', C5', O4', C1', C2'`).
- `sidechain`: Amino acid and nucleotide atoms excluding backbone and solvent.
- `guide`: Alpha carbons (`CA`) for proteins and phosphorus (`P`) for nucleic acids.
- `donor` / `donors`: Hydrogen bond donors (electronegative atoms bonded to H).
- `acceptor` / `acceptors`: Hydrogen bond acceptors (`O, N, F, S`).

### 3.4. Topological Operators
- `neighbor <S>`: Directly bonded atoms strictly outside $S$:
  $$\text{neighbor}(S) = \{ v \in \mathcal{V} \setminus S \mid \exists u \in S : (u, v) \in \mathcal{E} \}$$
- `bound_to <S>`: Atoms directly bonded to atoms in $S$:
  $$\text{bound\_to}(S) = \{ v \in \mathcal{V} \mid \exists u \in S : (u, v) \in \mathcal{E} \}$$
- `extend <N> [of] <S>`: Atoms reachable within $N$ covalent bond steps from $S$.
- `byres <S>`: Full residue closure of all residues containing at least one atom in $S$.
- `bychain <S>`: Full chain closure of all chains containing at least one atom in $S$.
- `bymolecule <S>`: Covalent connected component closure containing atoms in $S$.
- `bycalpha` / `byca <S>`: Alpha carbon atoms of all residues in $S$.
- `byring <S>`: Aromatic ring closure for residues in $S$ (`PHE, TYR, TRP, HIS, PRO`).
- `byobject <S>`: Object closure for all atoms in objects containing $S$.
- `bysegi <S>`: Segment closure for all atoms sharing segment IDs with $S$.
- `byfragment`, `bycell`: Explicitly **DEFERRED** pending fragment partition and crystallographic unit-cell specifications.

### 3.5. Spatial Proximity Operators
- `within <d> [of] <S>`: Atoms within Euclidean distance $d$ of any atom in $S$:
  $$\text{within}(d, S) = \{ v \in \mathcal{V} \mid \exists u \in S : \|\mathbf{x}_v - \mathbf{x}_u\| \le d \}$$
- `around <d> [of] <S>`: Atoms within Euclidean distance $d$ of $S$, strictly excluding $S$:
  $$\text{around}(d, S) = \text{within}(d, S) \setminus S$$
- `beyond <d> [of] <S>`: Atoms strictly further than distance $d$ from every atom in $S$:
  $$\text{beyond}(d, S) = \mathcal{V} \setminus \text{within}(d, S)$$
- `<S> expand <d>` / `expand <d> [of] <S>`: Expansion closure guaranteeing $S \subseteq \text{expand}(d, S)$:
  $$\text{expand}(d, S) = S \cup \text{within}(d, S)$$

### 3.6. PyMOL Slash Path Macros
Structured AST representation for standard PyMOL 5-tuple slash paths:
`/[model]/[segi]/[chain]/[resi]/[name]`
- `//A/10/CA` $\implies$ `chain A and resi 10 and name CA`
- `///1-50/` $\implies$ `resi 1-50`
- `/4HHB//A/` $\implies$ `model 4HHB and chain A`

---

## 4. Multi-Object & Multi-State Scoping

1. **`ACTIVE_OBJECT` Scope:** Evaluates strictly over the currently selected object in the workspace.
2. **`EXPLICIT_OBJECT` Scope:** Evaluates over a targeted object identified by `objectId`.
3. **`WORKSPACE` Scope:** Evaluates across all active enabled objects, returning globally scoped keys:
   $$\text{ScopedKey} = \text{"<object\_id>:<canonical\_id>"}$$
4. **Coordinate Multi-State Evaluation:** When evaluating spatial predicates (`within`, `around`, `beyond`, `expand`), the coordinates from the active `CanonicalState` ($\mathbf{X}_{\text{state}}$) are used unconditionally.

---

## 5. Error Taxonomy & Fail-Closed Behavior

| Error Condition | Behavior | Error Message Format |
| :--- | :--- | :--- |
| **Empty Query** | Returns empty selection | `SelectionResult { count: 0 }` |
| **Unknown Selection** | Throws fail-closed exception | `Unknown selection reference '<name>'` |
| **Unmatched Parentheses** | Throws syntax error | `Syntax error: unmatched opening parenthesis '('` |
| **Missing Operand** | Throws syntax error | `Syntax error: missing expression after '<op>'` |
| **Invalid Distance** | Throws syntax error | `Syntax error: invalid distance for '<op>' query` |
| **Deferred Feature** | Throws explicit deferred notice | `Selection syntax error: '<op>' is currently DEFERRED / RESEARCH...` |
