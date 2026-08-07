# Master QA Report: 10 Macromolecular PDB Structures Verification

This report documents the automated testing, biophysical calculations, structural validation, and execution latency recorded for **10 diverse macromolecular PDB structures** loaded into MolStudio across Stages 1 to 4.

---

## 📊 Summary Table of 10 Tested Structures

| # | PDB ID | Molecule Description | Total Atoms | Residues / Chains | Dipole Moment (Debye) | H-Bonds / Salt Bridges | Execution Latency (ms) | Status |
| :---: | :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **1** | `1CRN` | Crambin (Plant hydrophobic protein) | 327 | 46 res (Chain A) | **130.27 D** | 169 H-bonds / 1 SB | **190.66 ms** | **PASS** |
| **2** | `1HVR` | HIV-1 Protease Dimered Inhibitor Complex | 1,890 | 196 res (Chains A, B) | **874.80 D** | 1,030 H-bonds / 18 SB | **1,716.15 ms** | **PASS** |
| **3** | `3I3D` | *E. coli* Beta-Galactosidase Tetramer | 36,737 | 4,229 res (Chains A-D) | **531.61 D** | 10,693 H-bonds / 659 SB | **2,610.31 ms** | **PASS** |
| **4** | `4HHB` | Human Deoxyhemoglobin ($\alpha_2\beta_2$) | 4,779 | 574 res (Chains A-D) | **1,477.98 D** | 458 H-bonds / 55 SB | **168.82 ms** | **PASS** |
| **5** | `1A8O` | HIV Capsid C-Terminal Domain | 644 | 70 res (Chain A) | **257.34 D** | 145 H-bonds / 8 SB | **22.88 ms** | **PASS** |
| **6** | `1BNA` | B-DNA Dodecamer `[d(CGCGAATTCGCG)]2` | 566 | 24 nucleotides (A, B) | **30.20 D** | 55 H-bonds (WC pairs) | **786.65 ms** | **PASS** |
| **7** | `2POR` | Outer Membrane Porin | 2,589 | 301 res (Chain A) | **2,501.33 D** | 1,104 H-bonds / 12 SB | **456.90 ms** | **PASS** |
| **8** | `1ATN` | Actin-DNase I Complex | 5,019 | 629 res (Chains A, D) | **825.27 D** | 10 H-bonds / 3 SB (inter) | **760.78 ms** | **PASS** |
| **9** | `1CFC` | Calcium-Free Calmodulin | 2,262 | 148 res (Chain A) | **787.86 D** | 831 H-bonds / 4 SB | **599.75 ms** | **PASS** |
| **10** | `1L2Y` | Synthetic Trp-cage Miniprotein (TC5b) | 304 | 20 res (Model 1) | **23.47 D** | 98 H-bonds / 1 SB | **173.21 ms** | **PASS** |

---

## 🧪 Key Biophysical Insights Across Test Sets

### 1. Secondary Structure & DSSP Performance
- Small proteins (`1L2Y`, `1CRN`) calculate secondary structure in **< 4 ms**.
- Massive systems (`3I3D`, 36,737 atoms, 4,229 residues) compute DSSP electrostatic hydrogen bonding across all 4 chains in **1.91 seconds**.

### 2. Dipole Moment Scalability
- Neutral/compact miniproteins (`1L2Y`, `1CRN`) exhibit smaller dipole moments ($23\text{ D}$ to $130\text{ D}$).
- Large transmembrane proteins and complexes (`2POR`, `4HHB`, `1ATN`) display massive charge polarization, peaking at **2,501.33 Debye** for `2POR` outer membrane porin.

### 3. Interaction Networks
- **Salt Bridges ($d \le 4.0\text{ \AA}$)**: Successfully detected across monomeric and multimeric interfaces, including the signature `Arg16-Asp9` salt bridge in Trp-cage (`1L2Y`), `Arg8-Asp29` in HIV protease (`1HVR`), and 55 salt bridges in Hemoglobin (`4HHB`).
