# MolStudio User Manual & Biophysical Reference Guide

> [!NOTE]
> This guide is an interactive user reference for the MolStudio macromolecular platform. It outlines click-by-click instructions, examples, expected results, physical/chemical principles, and citations for all Stage 1–4 features.

---

## 1. File & Structure Loader (I/O)

### File > Open Local File (.pdb / .sdf)
*   **Action**: Click the `Open File` button in the `File & I/O` tab of the ribbon bar. Select a local structure file.
*   **Scientific Rationale**: Macromolecular coordinates are stored in PDB (Protein Data Bank) format or SDF (Structure Data File) format. The parser decodes lines beginning with `ATOM` and `HETATM` to build the internal molecular graph.
*   **Example**: Load `1CRN.pdb` (crambin) to view its stable folding pattern.
*   **Expected Result**: The structure displays immediately in the 3D viewport, centered automatically, and total atom counts update on the ribbon bar.

### File > Get PDB (RCSB Fetch)
*   **Action**: Type a 4-letter RCSB ID (e.g. `1HVR`) into the search input of the `File & I/O` tab and click `Fetch`.
*   **Scientific Rationale**: Fetches atomic coordinates directly from the worldwide PDB repository via REST APIs, resolving chains, heteroatoms, and Unit Cell headers.
*   **Example**: Fetch `4HHB` to load the human deoxyhemoglobin tetramer.
*   **Expected Result**: Coordinates load dynamically over HTTP; the biological complex is centered on screen.

---

## 2. Display & Representation Styles

### Show > Cartoon (Secondary Structure Extrusion)
*   **Action**: Select the `Display & Render` tab on the ribbon and click `Cartoon`.
*   **Scientific Rationale**: The cartoon ribbon represents the protein backbone conformation. It fits a continuous parametric Catmull-Rom B-spline through the alpha-carbon ($C_\alpha$) coordinates. The tangent $\mathbf{m}_i$ at atom $\mathbf{p}_i$ is computed as:

$$\mathbf{m}_i = \frac{\mathbf{p}_{i+1} - \mathbf{p}_{i-1}}{2}$$

*   **Example**: View the helical packing of crambin (`1CRN`).
*   **Expected Result**: Alpha helices appear as thick spirals, beta strands as flat arrows, and random coils/loops as smooth round tubes.
*   **Citation**: Carson, M. (1991). Ribbons: models of macromolecules. *Journal of Molecular Graphics*, 9(1), 1-6. DOI: [10.1016/0263-7855(91)80031-G](https://doi.org/10.1016/0263-7855(91)80031-G)

### Show > B-factor Putty
*   **Action**: Open the `Display & Render` tab, select representation `Putty`.
*   **Scientific Rationale**: Putty representation scales the tube radius of the protein backbone relative to the crystallographic B-factor (temperature factor) of the residue:

$$B_i = 8\pi^2 \langle u_i^2 \rangle$$

*   **Example**: Identify highly flexible loops in HIV protease (`1HVR`) that flex during inhibitor binding.
*   **Expected Result**: Stable core regions (low B-factor) appear as thin tubes; flexible terminal residues and surface loops (high B-factor) appear as thick tubes.
*   **Citation**: Trueblood, K. N., et al. (1996). Atomic displacement parameter nomenclature. *Acta Crystallographica Section A*, 52(5), 770-781. DOI: [10.1107/S010876739600645X](https://doi.org/10.1107/S010876739600645X)

### Show > Non-Bonded (Ions & Water)
*   **Action**: In the `Display` tab, select `Non-bonded (small spheres)` or toggle water display.
*   **Scientific Rationale**: Highlights solvent molecules (crystallographic water) and ionic species that stabilize the structure. Sphere sizes correspond to their respective van der Waals (VDW) radii (Bondi 1964): Oxygen ($1.52\text{ \AA}$), Magnesium ($1.73\text{ \AA}$).
*   **Expected Result**: Individual water oxygen coordinates appear as red stars/crosses or small spheres.

---

## 3. Biophysical Validation Panels

### Molecular Dipole Moment Vector
*   **Action**: Open the `Biophysical Validation` side panel and tick `Show Dipole Vector`.
*   **Scientific Rationale**: Calculates the net molecular dipole vector based on AMBER partial charge assignments:

$$\boldsymbol{\mu} = \sum_{i} q_i \mathbf{r}_i$$

*   **Example**: Determine the charge distribution across Calmodulin (`1CFC`) to understand its calcium-dependent binding mechanism.
*   **Expected Result**: A cyan 3D vector arrow appears in the viewport, pointing from the negative charge centroid to the positive charge centroid. Net Debye (D) magnitude is reported.

### Ramachandran Dihedral Angle Validation
*   **Action**: Open the `Biophysical Validation` panel and view the Ramachandran scatter plot.
*   **Scientific Rationale**: Evaluates protein backbone torsion angles $\phi$ (C-N-CA-C) and $\psi$ (N-CA-C-N) to identify steric clashes. Standard allowed regions correspond to Lovell empirical boundary limits.
*   **Expected Result**: Residues are plotted on a 2D scatter graph. **Green dots** (Favored, >98% probability), **Yellow dots** (Allowed, >99.9%), **Red dots** (Outliers / steric clashes). Clicking an outlier centers the camera on the respective residue in 3D.
*   **Citation**: Lovell, S. C., et al. (2003). Structure validation by Calpha geometry. *Proteins*, 50(3), 437-450. DOI: [10.1002/prot.10286](https://doi.org/10.1002/prot.10286)

### DSSP Secondary Structure Assignment
*   **Action**: In `Protein Prep` tab, choose secondary structure mode `DSSP`.
*   **Scientific Rationale**: Uses electrostatic hydrogen bond calculations to assign helices/sheets:

$$E = 0.084 \cdot 332 \cdot \left(\frac{1}{r_{ON}} + \frac{1}{r_{CH}} - \frac{1}{r_{OH}} - \frac{1}{r_{CN}}\right)$$

*   **Expected Result**: Secondary structure is updated on the fly; H-bonds with $E < -0.5\text{ kcal/mol}$ are registered.
*   **Citation**: Kabsch, W., & Sander, C. (1983). Dictionary of protein secondary structure. *Biopolymers*, 22(12), 2577-2637. DOI: [10.1002/bip.360221211](https://doi.org/10.1002/bip.360221211)

---

## 4. Measurement & Selection Algebra Console

### Selection Console Queries
*   **Action**: Press the console toggle or `/` key and enter algebra queries.
*   **Example 1**: Select all active site carbons within 5Å of the ligand:
    `select byres (chain A within 5.0 of resn XK2)`
*   **Example 2**: Select all backbone CA atoms with high B-factors:
    `select name CA and b > 35.0`
*   **Expected Result**: Selection indicators (pink squares) highlight selected coordinates; matching atom counts are logged.
