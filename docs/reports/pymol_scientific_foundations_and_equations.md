# PyMOL Scientific Foundations and Equations

## 1. DSSP Secondary Structure
**Concept:** Dictionary of Protein Secondary Structure (DSSP) based on hydrogen bonding.
**Equation:** Electrostatic interaction energy between two peptide groups:
$E = 0.084 \cdot 332 \cdot \left(\frac{1}{r_{ON}} + \frac{1}{r_{CH}} - \frac{1}{r_{OH}} - \frac{1}{r_{CN}}\right)$
**Citation:** Kabsch, W., & Sander, C. (1983). Dictionary of protein secondary structure: pattern recognition of hydrogen-bonded and geometrical features. *Biopolymers*, 22(12), 2577-2637. DOI: [10.1002/bip.360221211](https://doi.org/10.1002/bip.360221211)

## 2. Solvent Accessible Surface Areas (SASA & SES)
**Concept:** Accessible surface area and solvent-excluded surface.
**Equations:**
- Lee-Richards SASA: $A = \sum \text{arc} \times \Delta z$
- Connolly SES probe rolling radius: $r = 1.4\text{ \AA}$
**Citations:**
- Lee, B., & Richards, F. M. (1971). The interpretation of protein structures: estimation of static accessibility. *Journal of Molecular Biology*, 55(3), 379-400. DOI: [10.1016/0022-2836(71)90324-X](https://doi.org/10.1016/0022-2836(71)90324-X)
- Connolly, M. L. (1983). Solvent-accessible surfaces of proteins and nucleic acids. *Science*, 221(4612), 709-713. DOI: [10.1126/science.6867721](https://doi.org/10.1126/science.6867721)

## 3. Marching Cubes Isosurfacing
**Concept:** Extracting polygonal mesh of an isosurface from a 3D scalar field.
**Equation:** Voxel edge linear interpolation:
$\mathbf{p} = \mathbf{v}_1 + \frac{c - f(\mathbf{v}_1)}{f(\mathbf{v}_2) - f(\mathbf{v}_1)} (\mathbf{v}_2 - \mathbf{v}_1)$
**Citation:** Lorensen, W. E., & Cline, H. E. (1987). Marching cubes: A high resolution 3D surface construction algorithm. *ACM SIGGRAPH Computer Graphics*, 21(4), 163-169. DOI: [10.1145/37402.37422](https://doi.org/10.1145/37402.37422)

## 4. Cartoon Ribbon Interpolation
**Concept:** Smooth curves representing protein backbones.
**Equation:** Catmull-Rom & Hermite B-spline tangent calculation:
$\mathbf{m}_i = \frac{\mathbf{p}_{i+1} - \mathbf{p}_{i-1}}{2}$
**Citation:** Carson, M. (1991). Ribbons: models of macromolecules in computer graphics. *Journal of Molecular Graphics*, 9(1), 1-6. DOI: [10.1016/0263-7855(91)80045-8](https://doi.org/10.1016/0263-7855(91)80045-8)

## 5. Kabsch Structural Alignment
**Concept:** Optimal rotation matrix to minimize RMSD between two paired sets of points.
**Equation:** Covariance matrix SVD decomposition:
$H = P^T Q = U \Sigma V^T \implies R = V \text{diag}(1,1,\det(VU^T)) U^T$
**Citation:** Kabsch, W. (1976). A solution for the best rotation to relate two sets of vectors. *Acta Crystallographica Section A*, 32(5), 922-923. DOI: [10.1107/S056773947600187X](https://doi.org/10.1107/S056773947600187X)

## 6. Ramachandran Dihedral Angles
**Concept:** Allowed backbone $\phi$ and $\psi$ torsional angles in proteins.
**Definition:** Torsional definitions & empirical probability contours from high-resolution crystal structures.
**Citation:** Lovell, S. C., et al. (2003). Structure validation by C$\alpha$ geometry: $\phi$,$\psi$ and C$\beta$ deviation. *Proteins: Structure, Function, and Bioinformatics*, 50(3), 437-450. DOI: [10.1002/prot.10286](https://doi.org/10.1002/prot.10286)

## 7. Poisson-Boltzmann Electrostatics
**Concept:** Modeling electrostatic potentials of molecules in ionic solutions (via APBS plugin).
**Equation:** Non-linear PB equation:
$\nabla \cdot [\epsilon(\mathbf{r}) \nabla \phi(\mathbf{r})] - \kappa^2(\mathbf{r}) \phi(\mathbf{r}) = -\frac{4\pi \rho(\mathbf{r})}{\epsilon(\mathbf{r})}$
**Citation:** Baker, N. A., et al. (2001). Electrostatics of nanosystems: application to microtubules and the ribosome. *Proceedings of the National Academy of Sciences*, 98(18), 10037-10041. DOI: [10.1073/pnas.181342398](https://doi.org/10.1073/pnas.181342398)

## 8. Molecular Dipole Moment
**Concept:** Electric dipole moment of a molecule.
**Equation:** $\boldsymbol{\mu} = \sum q_i \mathbf{r}_i$
**Citation:** Debye, P. (1912). Einige Resultate einer kinetischen Theorie der Isolatoren. *Physikalische Zeitschrift*, 13, 97-100.

## 9. VDW Radii & CPK Colors
**Concept:** Space-filling models based on van der Waals radii and Corey-Pauling-Koltun coloring.
**Definition:** Bondi VDW atomic radii parameters for space-filling spheres.
**Citation:** Bondi, A. (1964). van der Waals volumes and radii. *The Journal of Physical Chemistry*, 68(3), 441-451. DOI: [10.1021/j100785a001](https://doi.org/10.1021/j100785a001)

## 10. B-Factor Putty Tube Scaling
**Concept:** Visualization of atomic displacement parameters (B-factors/temperature factors).
**Equation:** $r_i = r_{\text{min}} + (r_{\text{max}} - r_{\text{min}}) f(B_i)$
**Citation:** Trueblood, K. N., et al. (1996). Atomic displacement parameter nomenclature. *Acta Crystallographica Section A*, 52(5), 770-781. DOI: [10.1107/S010876739600645X](https://doi.org/10.1107/S010876739600645X)

## 11. Electron Density Map Isosurfacing
**Concept:** Visualizing crystallographic electron density maps.
**Equation:** 2Fo-Fc & Fo-Fc Fourier synthesis:
$\rho(\mathbf{r}) = \frac{1}{V} \sum |F(\mathbf{h})| e^{i\phi(\mathbf{h})} e^{-2\pi i \mathbf{h} \cdot \mathbf{r}}$
**Citation:** Winn, M. D., et al. (2011). Overview of the CCP4 suite and current developments. *Acta Crystallographica Section D*, 67(4), 235-242. DOI: [10.1107/S090744491005118X](https://doi.org/10.1107/S090744491005118X)

## 12. Non-covalent Interactions
**Concept:** Criteria for identifying non-covalent structural interactions (e.g., in polar contacts).
**Definition:** H-bond distance/angle criteria, salt bridges, $\pi$--$\pi$ stacking, cation--$\pi$, and halogen bonds.
**Citation:** Bissantz, C., Kuhn, B., & Zerbe, M. (2010). A medicinal chemist's guide to molecular interactions. *Journal of Medicinal Chemistry*, 53(14), 5061-5084. DOI: [10.1021/jm100112j](https://doi.org/10.1021/jm100112j)

## 13. MMFF94 Force Field for Sculpting
**Concept:** Molecular mechanics force field used in PyMOL's sculpting tool to interactively minimize structures.
**Equation:** Energy terms:
$E_{\text{total}} = E_{\text{bond}} + E_{\text{angle}} + E_{\text{torsion}} + E_{\text{vdW}} + E_{\text{elec}}$
**Citation:** Halgren, T. A. (1996). Merck molecular force field. I. Basis, form, scope, parameterization, and performance of MMFF94. *Journal of Computational Chemistry*, 17(5-6), 490-519. DOI: [10.1002/(SICI)1096-987X(199604)17:5/6<490::AID-JCC1>3.0.CO;2-P](https://doi.org/10.1002/(SICI)1096-987X(199604)17:5/6<490::AID-JCC1>3.0.CO;2-P)
