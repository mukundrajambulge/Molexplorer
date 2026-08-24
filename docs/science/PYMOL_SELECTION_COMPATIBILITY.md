# PyMOL Selection Compatibility Matrix (Phase SQ4 Final)

**Document ID:** `DOC-SCIENCE-PYMOL-SEL-COMPAT-2026-08-24`  
**Status:** `ACCEPTED & VALIDATED`  
**Phase:** `SQ4 — Scientific Validation, Full Query QA & Final Selection/Presentation Convergence`  
**Verification:** `85 / 85 Scientific Validation Tests Passed (100.0%)`

---

## 1. Selection Syntax Compatibility Matrix

| Category | PyMOL Syntax | Molexplorer Selection Syntax | Evidence Classification | Status | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Universal** | `all`, `*` | `all`, `*` | `GEOMETRICALLY / RULE-BASED VALIDATED` | **IMPLEMENTED** | Resolves complete coordinate universe ($\mathcal{V}$) |
| **Universal** | `none` | `none` | `GEOMETRICALLY / RULE-BASED VALIDATED` | **IMPLEMENTED** | Resolves empty set ($\emptyset$) |
| **Atom Name** | `name CA+CB`, `name C*` | `name CA,CB`, `name CA+CB`, `name C*` | `SCIENTIFICALLY VALIDATED` | **IMPLEMENTED** | Glob patterns and comma/plus lists supported |
| **Element** | `elem C`, `element FE`, `symbol O` | `elem C`, `element FE`, `symbol O` | `SCIENTIFICALLY VALIDATED` | **IMPLEMENTED** | Aliases `elem`, `element`, `symbol` |
| **Residue Name** | `resn ALA+GLY`, `resn HEM` | `resn ALA,GLY`, `resn ALA+GLY`, `resn HEM` | `SCIENTIFICALLY VALIDATED` | **IMPLEMENTED** | Standard and non-standard residue names |
| **Residue Index** | `resi 1-10`, `resv 1:10` | `resi 1-10`, `resi 1:10`, `resv 1-10` | `SCIENTIFICALLY VALIDATED` | **IMPLEMENTED** | Ranges `1-10` and `1:10` supported |
| **Chain ID** | `chain A+B`, `chain A` | `chain A,B`, `chain A+B`, `chain A` | `SCIENTIFICALLY VALIDATED` | **IMPLEMENTED** | Multiple chains via comma/plus |
| **Source Serial** | `id 100` | `id 100` | `SCIENTIFICALLY VALIDATED` | **IMPLEMENTED** | Resolves source PDB serial |
| **Runtime Index** | `index 100` | `index 100` | `SCIENTIFICALLY VALIDATED` | **IMPLEMENTED** | Resolves 1-indexed runtime atom offset |
| **Load Rank** | `rank 99` | `rank 99` | `SCIENTIFICALLY VALIDATED` | **IMPLEMENTED** | Resolves 0-indexed load order rank |
| **B-Factor** | `b > 30.0`, `bfactor <= 15.0` | `b > 30.0`, `bfactor <= 15.0` | `SCIENTIFICALLY VALIDATED` | **IMPLEMENTED** | Comparison operators `<`, `>`, `<=`, `>=`, `==`, `!=` |
| **Occupancy** | `q < 1.0`, `occupancy == 0.5` | `q < 1.0`, `occupancy == 0.5` | `SCIENTIFICALLY VALIDATED` | **IMPLEMENTED** | Standard crystallographic occupancy comparisons |
| **Formal Charge**| `formal_charge == 1`, `fc < 0` | `formal_charge == 1`, `fc < 0` | `SCIENTIFICALLY VALIDATED` | **IMPLEMENTED** | Chemical formal charge comparison |
| **AltLoc** | `alt A`, `altloc B` | `alt A`, `altloc B` | `SCIENTIFICALLY VALIDATED` | **IMPLEMENTED** | Alternate conformation indicator |
| **Segment ID** | `segi PROT`, `segid SEG1` | `segi PROT`, `segid SEG1` | `SCIENTIFICALLY VALIDATED` | **IMPLEMENTED** | Segment identifier |
| **Secondary Structure** | `ss h`, `ss s`, `ss l` | `ss h`, `ss s`, `ss l`, `ss helix`, `ss sheet` | `SCIENTIFICALLY VALIDATED` | **IMPLEMENTED** | Helix, Sheet/Strand, Loop/Coil |
| **First / Last** | `first`, `last` | `first`, `last` | `GEOMETRICALLY / RULE-BASED VALIDATED` | **IMPLEMENTED** | First and last atoms of model |

---

## 2. Classification & Biological Selectors

| Selector | PyMOL Behavior | Molexplorer Implementation | Evidence Classification | Status |
| :--- | :--- | :--- | :--- | :--- |
| **`polymer` / `protein`** | Amino acid polymers | Standard 20 AA + common modified residues | `SCIENTIFICALLY VALIDATED` | **IMPLEMENTED** |
| **`nucleic`** | RNA / DNA | Standard ribonucleotides and deoxyribonucleotides | `SCIENTIFICALLY VALIDATED` | **IMPLEMENTED** |
| **`ligand` / `ligands`** | Bound non-polymer ligands | Non-polymer, non-solvent, non-ion components (`CanonicalResidue.classification === 'ligand'`) | `SCIENTIFICALLY VALIDATED` | **IMPLEMENTED** |
| **`ion` / `ions`** | Solvent and metal ions | Inorganic and monoatomic metal/halogen ions (`CanonicalResidue.classification === 'ion'`) | `SCIENTIFICALLY VALIDATED` | **IMPLEMENTED** |
| **`organic`** | Non-polymer organic ligands | Carbon-containing non-polymer molecules (e.g. HEM, XK263) | `SCIENTIFICALLY VALIDATED` | **IMPLEMENTED** |
| **`inorganic`** | Non-carbon inorganic molecules | Non-carbon, non-solvent ligands (e.g. PO4, SO4) | `SCIENTIFICALLY VALIDATED` | **IMPLEMENTED** |
| **`solvent` / `waters`** | Water molecules | HOH, WAT, DOD, SOL, TIP3, TIP4, SPC | `SCIENTIFICALLY VALIDATED` | **IMPLEMENTED** |
| **`metals`** | Metal ions | Transition metals and metal ions (FE, ZN, MG, CA, MN, NA, K, etc.) | `SCIENTIFICALLY VALIDATED` | **IMPLEMENTED** |
| **`backbone`** | Polymer backbone atoms | Protein (`N`, `CA`, `C`, `O`, `OXT`, `H`, `HA`, `H1..H3`) and nucleic phosphate-sugar backbone | `SCIENTIFICALLY VALIDATED` | **IMPLEMENTED** |
| **`sidechain`** | Amino acid sidechains | `protein and not backbone` | `SCIENTIFICALLY VALIDATED` | **IMPLEMENTED** |
| **`guide`** | Guide atoms | $\mathrm{C}_\alpha$ for proteins, $\mathrm{P}$ for nucleic acids | `SCIENTIFICALLY VALIDATED` | **IMPLEMENTED** |

---

## 3. Topological & Spatial Operators

| Operator | PyMOL Syntax | Molexplorer Syntax | Evidence Classification | Status |
| :--- | :--- | :--- | :--- | :--- |
| **`byres`** | `byres <sel>` | `byres <sel>` | `GEOMETRICALLY / RULE-BASED VALIDATED` | **IMPLEMENTED** |
| **`bychain`** | `bychain <sel>` | `bychain <sel>` | `GEOMETRICALLY / RULE-BASED VALIDATED` | **IMPLEMENTED** |
| **`bymolecule`** | `bymolecule <sel>` | `bymolecule <sel>` | `GEOMETRICALLY / RULE-BASED VALIDATED` | **IMPLEMENTED** |
| **`bycalpha` / `byca`** | `bycalpha <sel>`, `byca <sel>` | `bycalpha <sel>`, `byca <sel>` | `GEOMETRICALLY / RULE-BASED VALIDATED` | **IMPLEMENTED** |
| **`neighbor`** | `neighbor <sel>` | `neighbor <sel>` | `GEOMETRICALLY / RULE-BASED VALIDATED` | **IMPLEMENTED** |
| **`bound_to`** | `bound_to <sel>` | `bound_to <sel>` | `GEOMETRICALLY / RULE-BASED VALIDATED` | **IMPLEMENTED** |
| **`extend`** | `extend <n>, <sel>` | `extend <n> of <sel>`, `extend <n> <sel>` | `GEOMETRICALLY / RULE-BASED VALIDATED` | **IMPLEMENTED** |
| **`within`** | `within <d> of <sel>` | `within <d> of <sel>` | `GEOMETRICALLY / RULE-BASED VALIDATED` | **IMPLEMENTED** |
| **`around`** | `around <d> of <sel>` | `around <d> of <sel>` | `GEOMETRICALLY / RULE-BASED VALIDATED` | **IMPLEMENTED** |
| **`beyond`** | `beyond <d> of <sel>` | `beyond <d> of <sel>` | `GEOMETRICALLY / RULE-BASED VALIDATED` | **IMPLEMENTED** |
| **`expand`** | `<sel> expand <d>` | `<sel> expand <d>`, `expand <d> of <sel>` | `GEOMETRICALLY / RULE-BASED VALIDATED` | **IMPLEMENTED** |
| **Slash Macros** | `/model/segi/chain/resi/name` | `//A/10/CA`, `///1-10/`, etc. | `IMPLEMENTED` | **IMPLEMENTED** |
| **`byfragment`** | `byfragment <sel>` | `byfragment <sel>` | `DEFERRED / RESEARCH` | **DEFERRED (Fail-Closed)** |
| **`bycell`** | `bycell <sel>` | `bycell <sel>` | `DEFERRED / RESEARCH` | **DEFERRED (Fail-Closed)** |

---

## 4. Summary & Verification

All implemented operators pass 100% of the 85-test scientific validation matrix and the 9-step automated browser E2E QA suite. Deferred operators (`byfragment`, `bycell`) fail closed with descriptive structured research errors.
