# Scientific Audit Report: DSSP & Dihedral Torsion Calculations

## 1. DSSP Secondary Structure Electrostatic Model
**Reference:** Kabsch, W., & Sander, C. (1983). Dictionary of protein secondary structure: pattern recognition of hydrogen-bonded and geometrical features. *Biopolymers*, 22(12), 2577-2637. DOI: [10.1002/bip.360221211](https://doi.org/10.1002/bip.360221211)
**File:** `src/lib/MolProcessor.ts` (Method: `calcDsspHbonds` and `assignSecondaryDssp`)

### Mathematical Verification
1. **Electrostatic Formula:** The code calculates hydrogen bond interaction energy $E$ between $C=O$ of residue $i$ and $N-H$ of residue $j$:

$$E = q_1 q_2 f \left( \frac{1}{r_{ON}} + \frac{1}{r_{CH}} - \frac{1}{r_{OH}} - \frac{1}{r_{CN}} \right)$$

where partial charges $q_1 = 0.42 e$, $q_2 = 0.20 e$, and dimensional constant $f = 332.0 \text{ kcal}\cdot\text{\AA/mol}$.
2. **Cutoff Criterion:** An electrostatic hydrogen bond is assigned if $E < -0.5 \text{ kcal/mol}$.
3. **Pattern Recognition:**
   - **Alpha-helix ($\alpha$):** $i \to i+4$ H-bonding pattern over consecutive residues.
   - **Beta-strand ($\beta$):** Inter-strand $i \to j$ H-bonding pattern creating parallel or antiparallel bridges.

**Status:** **PASSED**. The implementation mathematically corresponds to the Kabsch-Sander paper.

---

## 2. Ramachandran Backbone Torsion Angles ($\phi, \psi$)
**Reference:** Lovell, S. C., et al. (2003). Structure validation by Calpha geometry: phi, psi and Cbeta deviation. *Proteins: Structure, Function, and Bioinformatics*, 50(3), 437-450. DOI: [10.1002/prot.10286](https://doi.org/10.1002/prot.10286)
**File:** `src/lib/MolProcessor.ts` & `src/lib/SelectionParser.ts`

### Mathematical Verification & Fix Summary
1. **Dihedral Definitions:**
   - $\phi_i$: Torsion around $N_i - C_{\alpha i}$ bond defined by atoms $C'_{i-1} - N_i - C_{\alpha i} - C'_i$.
   - $\psi_i$: Torsion around $C_{\alpha i} - C'_i$ bond defined by atoms $N_i - C_{\alpha i} - C'_i - N_{i+1}$.
2. **Right-Hand Sign Calibration**:
   - The helper function `dihedral` in `src/lib/MolProcessor.ts` was audited and updated to ensure that `atan2(-y, x)` uses the proper triple-scalar product $(\mathbf{n}_1 \times \mathbf{n}_2) \cdot \mathbf{\hat{b}}_2$, resolving a sign inversion that affected the 'quick' secondary structure dihedral bounds.
3. **Lovell Boundary Contours:**
   - **Alpha-Helix Core:** $\phi \in [-100^\circ, -30^\circ], \psi \in [-70^\circ, -10^\circ]$ (Favored).
   - **Beta-Sheet Core:** $\phi \in [-160^\circ, -50^\circ], \psi \in [90^\circ, 180^\circ] \cup [-180^\circ, -160^\circ]$ (Favored).

**Status:** **PASSED (CALIBRATED)**. Sign vectors and boundary contours match empirical structural biology standards.
