# PyMOL Selection Compatibility Matrix (Phase SQ3 Verified)

**Document ID:** `DOC-SCIENCE-PYMOL-SEL-COMPAT-2026-08-25`
**Status:** `ACCEPTED & VALIDATED`
**Phase:** `SQ3 — Advanced Selection Composition, PyMOL Compatibility, and Query Chaining`
**Verification:** `69 / 69 SQ3 Integration Tests Passed (100.0%) | 234 / 234 Oracle Tests Passed (100.0%)`

---

## 1. Selection Algebra & Boolean Precedence

| Construct | PyMOL Syntax | Molexplorer Selection Algebra | Evidence Classification | Status | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Whitespace Disjunction** | `chain A chain B` | `chain A chain B` $\equiv$ `chain A or chain B` | `PYMOL VERIFIED` | **IMPLEMENTED** | Implicit whitespace juxtaposition is strictly OR |
| **Property Whitespace** | `resn ALA GLY` | `resn ALA GLY` $\equiv$ `resn ALA or resn GLY` | `PYMOL VERIFIED` | **IMPLEMENTED** | Multi-value property whitespace is union |
| **Explicit Conjunction** | `chain A and polymer` | `chain A and polymer`, `chain A & polymer` | `PYMOL VERIFIED` | **IMPLEMENTED** | Explicit intersection operator |
| **Negation Precedence** | `not chain A and resi 10` | `(not chain A) and resi 10` | `PYMOL VERIFIED` | **IMPLEMENTED** | `not` binds tighter than `and` |
| **Conjunction Precedence** | `chain A or chain B and resi 10` | `chain A or (chain B and resi 10)` | `PYMOL VERIFIED` | **IMPLEMENTED** | `and` binds tighter than `or` |
| **Parenthesized Nesting** | `(chain A or chain B) and not solvent` | `(chain A or chain B) and not solvent` | `PYMOL VERIFIED` | **IMPLEMENTED** | Arbitrary nested parentheses supported |

---

## 2. Selection Syntax Compatibility Matrix

| Category | PyMOL Syntax | Molexplorer Selection Syntax | Evidence Classification | Status | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Universal** | `all`, `*` | `all`, `*` | `PYMOL VERIFIED` | **IMPLEMENTED** | Resolves complete coordinate universe ($\mathcal{V}$) |
| **Universal** | `none` | `none` | `PYMOL VERIFIED` | **IMPLEMENTED** | Resolves empty set ($\emptyset$) |
| **Atom Name** | `name CA+CB`, `name C*` | `name CA,CB`, `name CA+CB`, `name C*` | `PYMOL VERIFIED` | **IMPLEMENTED** | Glob patterns and comma/plus lists supported |
| **Element** | `elem C`, `element FE`, `symbol O` | `elem C`, `element FE`, `symbol O` | `PYMOL VERIFIED` | **IMPLEMENTED** | Aliases `elem`, `element`, `symbol` |
| **Residue Name** | `resn ALA+GLY`, `resn HEM` | `resn ALA,GLY`, `resn ALA+GLY`, `resn HEM` | `PYMOL VERIFIED` | **IMPLEMENTED** | Standard and non-standard residue names |
| **Residue Index** | `resi 1-10`, `resv 1:10` | `resi 1-10`, `resi 1:10`, `resv 1-10`, `resi 10+20` | `PYMOL VERIFIED` | **IMPLEMENTED** | Ranges `1-10`, `1:10`, and plus/comma lists |
| **Chain ID** | `chain A+B`, `chain A` | `chain A,B`, `chain A+B`, `chain A` | `PYMOL VERIFIED` | **IMPLEMENTED** | Multiple chains via comma/plus/whitespace |
| **Source Serial** | `id 100` | `id 100` | `PYMOL VERIFIED` | **IMPLEMENTED** | Resolves source PDB serial |
| **Runtime Index** | `index 100` | `index 100` | `PYMOL VERIFIED` | **IMPLEMENTED** | Resolves 1-indexed runtime atom offset |
| **Load Rank** | `rank 99` | `rank 99` | `PYMOL VERIFIED` | **IMPLEMENTED** | Resolves 0-indexed load order rank |
| **B-Factor** | `b > 30.0`, `bfactor <= 15.0` | `b > 30.0`, `bfactor <= 15.0` | `PYMOL VERIFIED` | **IMPLEMENTED** | Comparison operators `<`, `>`, `<=`, `>=`, `==`, `!=` |
| **Occupancy** | `q < 1.0`, `occupancy == 0.5` | `q < 1.0`, `occupancy == 0.5` | `PYMOL VERIFIED` | **IMPLEMENTED** | Standard crystallographic occupancy comparisons |
| **Formal Charge**| `formal_charge == 1`, `fc < 0` | `formal_charge == 1`, `fc < 0` | `PYMOL VERIFIED` | **IMPLEMENTED** | Chemical formal charge comparison |
| **AltLoc** | `alt A`, `altloc B` | `alt A`, `altloc B` | `PYMOL VERIFIED` | **IMPLEMENTED** | Alternate conformation indicator |
| **Segment ID** | `segi PROT`, `segid SEG1` | `segi PROT`, `segid SEG1` | `PYMOL VERIFIED` | **IMPLEMENTED** | Segment identifier |
| **Secondary Structure** | `ss h`, `ss s`, `ss l` | `ss h`, `ss s`, `ss l`, `ss helix`, `ss sheet` | `PYMOL VERIFIED` | **IMPLEMENTED** | Helix, Sheet/Strand, Loop/Coil |
| **First / Last** | `first`, `last` | `first`, `last` | `PYMOL VERIFIED` | **IMPLEMENTED** | First and last atoms of model |

---

## 3. Classification & Biological Selectors

| Selector | PyMOL Behavior | Molexplorer Implementation | Evidence Classification | Status |
| :--- | :--- | :--- | :--- | :--- |
| **`polymer` / `protein`** | Amino acid polymers | Standard 20 AA + common modified residues | `PYMOL VERIFIED` | **IMPLEMENTED** |
| **`nucleic`** | RNA / DNA | Standard ribonucleotides and deoxyribonucleotides | `PYMOL VERIFIED` | **IMPLEMENTED** |
| **`ligand` / `ligands`** | Bound non-polymer ligands | Non-polymer, non-solvent, non-ion components | `PYMOL VERIFIED` | **IMPLEMENTED** |
| **`ion` / `ions`** | Solvent and metal ions | Inorganic and monoatomic metal/halogen ions | `PYMOL VERIFIED` | **IMPLEMENTED** |
| **`organic`** | Non-polymer organic ligands | Carbon-containing non-polymer molecules (e.g. HEM, XK263) | `PYMOL VERIFIED` | **IMPLEMENTED** |
| **`inorganic`** | Non-carbon inorganic molecules | Non-carbon, non-solvent ligands (e.g. PO4, SO4) | `PYMOL VERIFIED` | **IMPLEMENTED** |
| **`solvent` / `waters`** | Water molecules | HOH, WAT, DOD, SOL, TIP3, TIP4, SPC | `PYMOL VERIFIED` | **IMPLEMENTED** |
| **`metals`** | Metal ions | Transition metals and metal ions (FE, ZN, MG, CA, etc.) | `PYMOL VERIFIED` | **IMPLEMENTED** |
| **`backbone`** | Polymer backbone atoms | Protein (`N`, `CA`, `C`, `O`, `OXT`, `H`, `HA`) and nucleic phosphate-sugar | `PYMOL VERIFIED` | **IMPLEMENTED** |
| **`sidechain`** | Amino acid sidechains | `protein and not backbone` | `PYMOL VERIFIED` | **IMPLEMENTED** |
| **`guide`** | Guide atoms | $\mathrm{C}_\alpha$ for proteins, $\mathrm{P}$ for nucleic acids | `PYMOL VERIFIED` | **IMPLEMENTED** |

---

## 4. Slash Macro Positional Slot Rules

Molexplorer adheres to PyMOL 5-slot positional macros `/model/segi/chain/resi/name`:

| Macro Syntax | Model (Slot 0) | Segi (Slot 1) | Chain (Slot 2) | Resi (Slot 3) | Name (Slot 4) | Classification | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `//A/10/CA` | `*` | `*` | `A` | `10` | `CA` | `PYMOL VERIFIED` | **IMPLEMENTED** |
| `/4DJW//A/10/CA` | `4DJW` | `*` | `A` | `10` | `CA` | `PYMOL VERIFIED` | **IMPLEMENTED** |
| `/4DJW//A/` | `4DJW` | `*` | `A` | `*` | `*` | `PYMOL VERIFIED` | **IMPLEMENTED** |
| `///1-50/` | `*` | `*` | `*` | `1-50` | `*` | `PYMOL VERIFIED` | **IMPLEMENTED** |
| `////CA` | `*` | `*` | `*` | `*` | `CA` | `PYMOL VERIFIED` | **IMPLEMENTED** |
| `/////` | `*` | `*` | `*` | `*` | `*` (`all`) | `PYMOL VERIFIED` | **IMPLEMENTED** |
| `//A/10/*` | `*` | `*` | `A` | `10` | `*` | `PYMOL VERIFIED` | **IMPLEMENTED** |
| `//A/10+20/CA` | `*` | `*` | `A` | `10,20` | `CA` | `PYMOL VERIFIED` | **IMPLEMENTED** |

---

## 5. Topological & Spatial Operators

| Operator | PyMOL Syntax | Molexplorer Syntax | Mathematical Definition | Classification | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`byres`** | `byres <sel>` | `byres <sel>` | Residue closure | `PYMOL VERIFIED` | **IMPLEMENTED** |
| **`bychain`** | `bychain <sel>` | `bychain <sel>` | Chain closure | `PYMOL VERIFIED` | **IMPLEMENTED** |
| **`bymolecule`** | `bymolecule <sel>` | `bymolecule <sel>` | Covalent component closure | `PYMOL VERIFIED` | **IMPLEMENTED** |
| **`bycalpha` / `byca`** | `byca <sel>` | `byca <sel>`, `bycalpha <sel>` | $\mathrm{C}_\alpha$ guide atom closure | `PYMOL VERIFIED` | **IMPLEMENTED** |
| **`neighbor`** | `neighbor <sel>` | `neighbor <sel>` | 1-hop bonded neighbors ($S \cap \text{neighbor}(S) = \emptyset$) | `PYMOL VERIFIED` | **IMPLEMENTED** |
| **`bound_to`** | `bound_to <sel>` | `bound_to <sel>` | $S \cup \text{neighbor}(S)$ | `PYMOL VERIFIED` | **IMPLEMENTED** |
| **`extend`** | `extend <n>, <sel>` | `extend <n> of <sel>` | N-hop bonded graph traversal | `PYMOL VERIFIED` | **IMPLEMENTED** |
| **`within`** | `within <d> of <sel>` | `within <d> of <sel>`, `<sel> within <d>` | Spatial predicate candidate filter | `PYMOL VERIFIED` | **IMPLEMENTED** |
| **`around`** | `around <d> of <sel>` | `around <d> of <sel>`, `<sel> around <d>` | Spatial halo ($S \cap \text{around}(d, S) = \emptyset$) | `PYMOL VERIFIED` | **IMPLEMENTED** |
| **`beyond`** | `beyond <d> of <sel>` | `beyond <d> of <sel>`, `<sel> beyond <d>` | Distance complement | `PYMOL VERIFIED` | **IMPLEMENTED** |
| **`expand`** | `<sel> expand <d>` | `<sel> expand <d>`, `expand <d> of <sel>` | $S \cup \text{around}(d, S)$ where $S \subseteq \text{expand}(d, S)$ | `PYMOL VERIFIED` | **IMPLEMENTED** |
| **`byfragment`** | `byfragment <sel>` | `byfragment <sel>` | Non-covalent fragment partition | `DEFERRED / RESEARCH` | **DEFERRED (Fail-Closed)** |
| **`bycell`** | `bycell <sel>` | `bycell <sel>` | Crystallographic unit cell closure | `DEFERRED / RESEARCH` | **DEFERRED (Fail-Closed)** |

---

## 6. Semicolon Command Sequences & Fail-Fast Execution

| Sequence Syntax | Behavior | Classification | Status |
| :--- | :--- | :--- | :--- |
| `select lig, resn LIG; show sticks, lig; color cyan, lig; zoom lig` | Sequential execution, dynamic named selection propagation, visual override updates | `MOLEXPLORER EXTENSION` | **IMPLEMENTED** |
| `select lig, resn LIG; bad_cmd; zoom lig` | Fail-fast: halted at `bad_cmd`, subsequent commands not executed | `MOLEXPLORER EXTENSION` | **IMPLEMENTED** |
| `select lig, (organic and not polymer; color cyan, lig` | Fail-closed: unbalanced parenthesis rejected before execution | `MOLEXPLORER EXTENSION` | **IMPLEMENTED** |
