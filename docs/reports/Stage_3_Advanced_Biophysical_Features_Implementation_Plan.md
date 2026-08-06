# Stage 3 Advanced Biophysical Features Implementation Plan
## Technical + Mathematical Specification for Ramachandran Plots, Dipole Vectors, and DSSP H-Bond Energies

This plan outlines the design, mathematics, visual overlays, and user-facing output channels for implementing the **Advanced Biophysical Features** in MolStudio.

---

## 1. Backbone Ramachandran Plot Analysis

### 1.1 Mathematical Formulation
We calculate backbone dihedral angles $\phi$ (Phi) and $\psi$ (Psi) for each peptide residue $i$:
*   **Phi ($\phi_i$)**: Torsion angle of the four backbone atoms $C_{i-1} - N_i - C\alpha_i - C_i$.
*   **Psi ($\psi_i$)**: Torsion angle of the four backbone atoms $N_i - C\alpha_i - C_i - N_{i+1}$.
*   **Classification Contours** (Lovell et al. 2003):
    *   **Favored Region ($\ge 98\%$)**: Sterically unhindered conformations.
    *   **Allowed Region ($\ge 99.8\%$)**: Conformations within extreme steric limits.
    *   **Outlier Region ($< 0.2\%$)**: conformatinal strain indicating structural errors.

### 1.2 User Interface & Output Presentation
*   **Interactive 2D Scatter Plot Widget**:
    *   Render a SVG-based 2D Cartesian coordinate chart in a new right-hand sidebar tab: **"Ramachandran Validation"**.
    *   **Axes**: X-axis is $\phi$ ($-180^\circ$ to $+180^\circ$); Y-axis is $\psi$ ($-180^\circ$ to $+180^\circ$).
    *   **Background**: Shaded outline representing Lovell's contours (Favored regions in dark gray, Allowed regions in light gray, Outliers in dark background).
    *   **Dots**: Each residue is represented as a clickable circle:
        *   Hovering shows a tooltip: e.g. `VAL-15 | Phi: -57.3°, Psi: -47.1° (Favored)`.
        *   Clicking a dot highlights and focuses the residue in the 3D WebGL viewer.
        *   Outliers are plotted as **glowing red dots**.
    *   **Metrics Summary Card**: Shows general stats:
        *   `Favored: 97.8% | Allowed: 2.2% | Outliers: 0.0%`
*   **Console Command Output (`ramachandran [sel]`)**:
    *   Returns a clean, sorted text log in the query console:
        ```
        Ramachandran Conformation Analysis for "polymer":
        Total residues: 46
        - Favored: 44 residues (95.65%)
        - Allowed: 2 residues (4.35%)
        - Outliers: 0 residues (0.00%)
        
        Outlier Conformations List:
        None.
        ```
    *   If outliers exist, they are listed and automatically highlighted in the 3D viewer.

---

## 2. Net Molecular Dipole Moment Vector

### 2.1 Mathematical Formulation
*   **Gasteiger-Marsili Partial Charges**: We assign partial charges $q_i$ to each atom $i$ (using electronegativity equalization rules).
*   **Center of Mass ($\vec{R}_{\text{com}}$)**:
    \[\vec{R}_{\text{com}} = \frac{\sum m_i \vec{r}_i}{\sum m_i}\]
*   **Dipole Vector ($\vec{\mu}$)**:
    We compute the dipole moment relative to the center of mass:
    \[\vec{\mu} = \sum_{i} q_i (\vec{r}_i - \vec{R}_{\text{com}}) \quad (\text{in Debye, where } 1\text{ D} = 0.2082e \cdot \text{\AA})\]
    *   Magnitude: $\mu = \|\vec{\mu}\|$.
    *   Net Charge: $Q = \sum q_i$.

### 2.2 User Interface & Output Presentation
*   **Metrics Card**:
    *   Renders in the sidebar properties list showing:
        *   `Net charge: +1.00 e`
        *   `Dipole magnitude: 12.83 Debye`
        *   `Dipole vector: (3.12, -8.45, 9.12) D`
*   **3D WebGL Arrow Overlay**:
    *   Draws a 3D glowing vector arrow starting at $\vec{R}_{\text{com}}$. The shaft length represents the magnitude ($0.1\text{ \AA}$ per Debye) and points in the direction of $\vec{\mu}$.
*   **Console Command Output (`dipole [sel]`)**:
    *   Typing `dipole` prints:
        ```
        Molecular Dipole Moment Analysis:
        - Center of Mass: (15.234, 12.451, -8.902)
        - Net Charge: 0.00 e
        - Vector (x,y,z): (2.14, 4.85, -1.22) D
        - Magnitude: 5.44 Debye
        ```
    *   Adds/toggles the visual dipole arrow in the WebGL viewport.

---

## 3. Electrostatic Hydrogen Bond Energies

### 3.1 Mathematical Formulation
Instead of standard distance thresholds, we calculate the electrostatic bond energy using the **Kabsch-Sander equation**:
\[E = q_1 q_2 \left( \frac{1}{r_{ON}} + \frac{1}{r_{CH}} - \frac{1}{r_{OH}} - \frac{1}{r_{CN}} \right) \times 332 \text{ kcal/mol}\]
Where $q_1 = 0.42e$, $q_2 = 0.20e$, and $r_{XY}$ represents distance in Angstroms between atom pairs.
*   **Stability Threshold**: A hydrogen bond is verified if $E < -0.5\text{ kcal/mol}$ (Baker-Hubbard).

### 3.2 User Interface & Output Presentation
*   **Dynamic Labels**:
    *   In the 3D WebGL viewer, hydrogen bond labels display both physical metric and binding strength: e.g. `2.84 Å (-2.4 kcal/mol)`.
    *   **Energy-dependent styles**: Strong hydrogen bonds ($E < -1.5\text{ kcal/mol}$) are rendered as thick dashed lines, while weaker ones are rendered as thin dashed lines.
*   **Console Command Output (`hbond_energy [sel]`)**:
    *   Calculates and prints the H-bond network characteristics:
        ```
        Hydrogen Bond Network Analysis:
        - VAL-12:O --> LEU-16:N | d = 2.84 Å | E = -2.4 kcal/mol (Strong)
        - ALA-15:O --> GLY-19:N | d = 2.91 Å | E = -1.9 kcal/mol (Medium)
        
        Summary:
        - Total Hydrogen Bonds: 2
        - Average Binding Energy: -2.15 kcal/mol
        ```

---

## 4. Proposed Technical Implementation Steps

### 4.1 Zustand State Additions (`src/store/index.ts`)
```typescript
interface BiophysicalState {
  showDipoleArrow: boolean;
  setShowDipoleArrow: (show: boolean) => void;
  ramachandranData: { resName: string; resSeq: number; phi: number; psi: number; region: 'favored'|'allowed'|'outlier' }[];
  setRamachandranData: (data: any[]) => void;
}
```

### 4.2 WebGL Additions (`src/components/MolStudioViewer.tsx`)
*   **Dipole Arrow**: Draws a cylinder and cone tip representing the computed vector.
*   **H-bond thickness**: Integrates Kabsch-Sander energy checks into the cylinder thickness rendering.

### 4.3 Sidebar UI Additions
*   Create a clean, tabbed pane in the right-hand panel swapping between "Parameters", "Docking", and **"Ramachandran & Dipole"** containing the SVG scatter chart and dipole metrics card.
