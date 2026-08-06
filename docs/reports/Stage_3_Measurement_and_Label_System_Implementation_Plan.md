# Stage 3: Measurement and Label System Implementation Plan
## Technical + Scientific + UI Specification for Distance, Angle, and Dihedral Modeling

This document outlines the detailed architecture, mathematical equations, visual rendering schemas, and scientific trust limits for implementing the **Measurement and Label System (Stage 3)** in MolStudio.

---

## 1. Scientific Foundations & Literature Citations

Every geometric and physical calculation in MolStudio is traced to established peer-reviewed literature in biophysics and structural chemistry:

1.  **Bond & Coordinate Definitions**:
    *   *IUPAC-IUB Commission on Biochemical Nomenclature (1970)*. "Abbreviations and symbols for the description of the conformation of polypeptide chains." *Biochemistry*, 9(18), 3480-3487. [DOI: 10.1021/bi00820a001](https://doi.org/10.1021/bi00820a001)
    *   Establishes the sign conventions (right-handed torsion rules) and vectors for defining backbone $\phi$, $\psi$, $\omega$, and sidechain $\chi_n$ dihedral coordinates.
2.  **Hydrogen Bond Geometry & Thresholds**:
    *   *Baker, E. N., & Hubbard, R. E. (1984)*. "Hydrogen bonding in globular proteins." *Progress in Biophysics and Molecular Biology*, 44(2), 97-179. [DOI: 10.1016/0079-6107(84)90007-5](https://doi.org/10.1016/0079-6107(84)90007-5)
    *   Defines the physical limits for polar distance ($d \le 3.2\text{ \AA}$) and angle ($\theta \ge 120.0^\circ$) metrics in protein tertiary folds.
3.  **Secondary Structure Torsions**:
    *   *Kabsch, W., & Sander, C. (1983)*. "Dictionary of protein secondary structure: pattern recognition of hydrogen-bonded and geometrical features." *Biopolymers*, 22(12), 2577-2637. [DOI: 10.1002/bip.360221211](https://doi.org/10.1002/bip.360221211)
    *   Formulates the electrostatic distance energy threshold for hydrogen bonds ($E < -0.5\text{ kcal/mol}$).

---

## 2. Scientific Trust, Coordinate Uncertainty & Verification

### 2.1 Quantifying Coordinate Error (Cruickshank DPI)
To verify how much a scientist can trust calculated distances/angles, we must assess the structural precision of the source PDB file. We calculate the coordinate error using the **Cruickshank Diffraction Precision Index (DPI)**:
\[\sigma(x, B) = \left( \frac{N_{\text{atoms}}}{N_{\text{obs}} - N_{\text{params}}} \right)^{1/2} C^{-1/3} R_{\text{free}} \, d_{\text{min}}\]
Where $d_{\text{min}}$ is resolution, $R_{\text{free}}$ is the refinement index, and $C$ is completeness. 
*   **Coordinate Uncertainty**:
    *   **High-Resolution Structures ($< 1.5\text{ \AA}$)**: Coordinate error is typically $< \pm 0.05\text{ \AA}$. Measurements are extremely reliable.
    *   **Medium-Resolution Structures ($1.5\text{--}2.5\text{ \AA}$)**: Coordinate error is $\approx \pm 0.15\text{ \AA}$.
    *   **Low-Resolution Structures ($> 2.5\text{ \AA}$)**: Coordinate error is $\approx \pm 0.30\text{ \AA}$. Distance measurements should be treated as qualitative.
*   **B-factor Filtering**: Atoms with $B > 50.0\text{ \AA}^2$ represent high-vibrational spatial distributions, yielding a calculated uncertainty of:
    \[\sigma_{\text{pos}} \approx \sqrt{\frac{3B}{8\pi^2}} \approx 1.38\text{ \AA}\]
    *   **UI Alert**: Any measurement involving an atom with B-factor $> 50.0\text{ \AA}^2$ will render in **amber/yellow text** with a warning tooltip.

### 2.2 Verification Protocol (Golden File Parity)
We will implement an automated regression test script `verify_stage3.ts`:
1.  **Reference Dataset**: Load high-resolution reference PDB [1CRN](file:///d:/Projects/Molexplorer/public/1crn.pdb) (Crambin, $1.5\text{ \AA}$).
2.  **PyMOL Comparisons**: Retrieve distance/angle/dihedral metrics directly from PyMOL for key coordinates:
    *   Distance: `/1crn//A/1/N` to `/1crn//A/1/CA` (Expected: $1.470\text{ \AA}$)
    *   Angle: `/1crn//A/1/N` - `/1crn//A/1/CA` - `/1crn//A/1/C` (Expected: $111.4^\circ$)
    *   Dihedral (Phi): `/1crn//A/1/C` - `/1crn//A/2/N` - `/1crn//A/2/CA` - `/1crn//A/2/C` (Expected: $-68.4^\circ$)
3.  **Precision Guard**: Assert that our calculated results match PyMOL exactly within a strict tolerance of **$\epsilon = \pm 10^{-4}$**.

---

## 3. UI and CLI Command Parity with PyMOL

We will implement **both** the console-command parser interface and the visual mouse-click Wizard controls.

### 3.1 Selection Query Console CLI Parity
We will extend the query console interpreter to process all PyMOL measurement and label command structures:
*   **`distance [name, ]sel1, sel2`** (or `dist`): Computes Euclidean separation and adds a yellow dashed connection in the WebGL viewport.
*   **`angle [name, ]sel1, sel2, sel3`**: Computes bond angle and renders solid white lines meeting at the vertex with an arc.
*   **`dihedral [name, ]sel1, sel2, sel3, sel4`**: Computes torsion angle and renders connections.
*   **`label selection, expression`**: Sets a custom text label on matching atoms (e.g. `label name CA, "%s-%s" % (resn, resi)`). Support variables: `name`, `resn`, `resi`, `chain`, `elem`, `b`, `q`.
*   **`unlabel selection`**: Removes all custom text labels from the selected atoms.

### 3.2 Mouse-Click Wizard UI
*   **Activation Toggles**: Toolbar buttons for `📐 Distance`, `📐 Angle`, `📐 Dihedral`, and `🏷️ Custom Label` wizard states.
*   **Interactions**: Clicking atoms in the 3D viewer adds them to a temporary array.
    *   Once selection count matches the mode (2, 3, or 4), the calculation runs, updates the Zustand store, adds WebGL line/label shapes, and resets the clicks array.

---

## 4. Advanced Biophysical Features (Stage 3 Extensions)

After implementing the core system, we will introduce several advanced geometric calculations:

### 4.1 Backbone Ramachandran Plot Analysis
*   **Calculations**: Calculate backbone $\phi$ (Phi) and $\psi$ (Psi) torsion angles for every residue.
*   **Citations**: *Lovell, S. C., et al. (2003)*. "Structure validation by Calpha geometry: phi, psi and Cbeta deviation." *Proteins*, 50(3), 437-450. [DOI: 10.1002/prot.10286](https://doi.org/10.1002/prot.10286)
*   **Application**: Display interactive scatter plots mapping $(\phi, \psi)$ coordinates. Outline Lovell's contours (Favored $\ge 98\%$, Allowed $\ge 99.8\%$, Outliers $< 0.2\%$). Render outlier residues with red labels in the 3D viewport.

### 4.2 Net Molecular Dipole Moment Vector
*   **Calculations**: Using Gasteiger-Marsili partial charges $q_i$ and coordinates $\vec{r}_i$, compute net dipole:
    \[\vec{\mu} = \sum_{i} q_i \vec{r}_i \quad (\text{in Debye, where } 1\text{ D} = 0.2082e \cdot \text{\AA})\]
*   **Citations**: *Gasteiger, J., & Marsili, M. (1980)*. "Iterative partial equalization of orbital electronegativity—a rapid access to atomic charges." *Tetrahedron*, 36(22), 3219-3228. [DOI: 10.1016/0040-4020(80)80168-2](https://doi.org/10.1016/0040-4020(80)80168-2)
*   **Application**: Draw a 3D arrow representing the dipole vector starting at the center of mass, showing direction and magnitude in Debye.

### 4.3 Electrostatic H-Bond Energy Labels (DSSP Potential)
*   **Calculations**: For detected hydrogen bonds, calculate the binding energy using the Kabsch-Sander Coulomb term:
    \[E = 0.084 \left( \frac{1}{r_{ON}} + \frac{1}{r_{CH}} - \frac{1}{r_{OH}} - \frac{1}{r_{CN}} \right) \times 332 \text{ kcal/mol}\]
*   **Citations**: *Kabsch & Sander (1983)*. dictionary of secondary structures.
*   **Application**: Renders the calculated bond strength (e.g. `-2.4 kcal/mol`) as text directly below the distance label on the H-bond dashed cylinder.
