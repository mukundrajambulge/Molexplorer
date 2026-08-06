# Scientific Audit Report: Dipole Moment & Kabsch Alignment

## 1. Kabsch Structural Superposition
**Reference:** Kabsch, W. (1976). A solution for the best rotation to relate two sets of vectors. *Acta Crystallographica Section A*, 32(5), 922-923. DOI: [10.1107/S0567739476001873](https://doi.org/10.1107/S0567739476001873)
**File:** `src/lib/Alignment.ts` (Method: `calculateKabsch` and `applyTransform`)

### Mathematical Verification
1. **Centroid Shifting:** The algorithm computes the centroids of both coordinate sets `A` (target, $Q$) and `B` (mobile, $P$), translating both sets to the origin. This matches the translational superposition step.
2. **Cross-Covariance Matrix:** The matrix $H$ is computed as $H = P^T Q$. Since $P$ and $Q$ are $N \times 3$ matrices (row vectors of coordinates), $H$ is the correct $3 \times 3$ covariance matrix.
3. **SVD and Rotation Matrix:** 
   - SVD is performed yielding $H = U S V^T$.
   - The rotation matrix is calculated as $R = U \cdot \text{diag}(1, 1, d) \cdot V^T$.
   - $d$ is dynamically computed as $\text{sign}(\text{det}(U V^T))$. This constraint ensures that the determinant of $R$ is exactly $+1$, which prevents improper rotations (reflections).
4. **Transform Application:** The `applyTransform` function calculates the rotated coordinates via a formulation equivalent to row-vector right-multiplication ($P_{\text{rotated}} = P \times R$), satisfying the mathematical requirement to minimize the RMSD.

**Status:** **PASSED**. The implementation mathematically corresponds to the primary literature precisely.

---

## 2. Molecular Dipole Moment Calculation
**Reference:** Debye, P. (1912). Einige Resultate einer kinetischen Theorie der Isolatoren. *Physikalische Zeitschrift*, 13, 97-100.
**File:** `src/lib/SelectionParser.ts` (Command: `dipole`)

### Mathematical Verification
1. **Center of Mass (COM):** The mass-weighted COM is calculated using accurate standard elemental atomic weights.
2. **Translation to Origin:** Atomic coordinates are shifted using $\mathbf{r}'_i = (\mathbf{r}_i - \mathbf{r}_{\text{com}})$. For charged molecular systems (where net ionic charge $\neq 0$), calculating the dipole vector from the Center of Mass is the standard convention in computational chemistry.
3. **Partial Charges:** The logic applies partial charges mapped to atom names (e.g., `N: -0.47`, `C: 0.51`, `O: -0.51`), utilizing generic elemental fallbacks for unmapped atoms.
4. **Unit Conversion:** The vector components are multiplied by `4.8032`. Because coordinates are in Ångströms and charges are in elementary charge units ($e$), this scalar converts $e\cdot\text{\AA}$ to Debyes ($D$).

**Status:** **PASSED**. The mathematics strictly adhere to standard physical theory.
