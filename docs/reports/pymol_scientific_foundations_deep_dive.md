# PyMOL Scientific Foundations Deep Dive

PyMOL is a comprehensive molecular visualization system that integrates numerous concepts from physics, chemistry, structural biology, and computer graphics. This document details the mathematical equations, algorithms, and scientific literature behind its primary representations and features.

## 1. Secondary Structure Assignment (DSSP)
**Physics / Geometry:**
The Dictionary of Protein Secondary Structure (DSSP) algorithm determines secondary structure by identifying hydrogen bonds between backbone carbonyl and amide groups. The electrostatic energy $E$ between the C, O atoms of one residue and the N, H atoms of another is calculated to define a hydrogen bond if $E < -0.5 \text{ kcal/mol}$.

**Equation:**
$$ E = 0.084 \cdot 332 \cdot \left( \frac{1}{r_{ON}} + \frac{1}{r_{CH}} - \frac{1}{r_{OH}} - \frac{1}{r_{CN}} \right) $$

**Citation:**
- Kabsch, W., & Sander, C. (1983). Dictionary of protein secondary structure: pattern recognition of hydrogen-bonded and geometrical features. *Biopolymers*, 22(12), 2577-2637. DOI: [10.1002/bip.360221211](https://doi.org/10.1002/bip.360221211)

## 2. Solvent-Accessible Surface Area (SASA) & Solvent-Excluded Surface (SES)
**Physics / Geometry:**
Lee and Richards defined SASA by rolling a spherical probe (typically representing water, $r = 1.4\text{ \AA}$) over the van der Waals surface. Connolly defined the SES (or molecular surface) as the topological boundary formed by the inward-facing surface of the probe.

**Equation:**
$$ A = \sum \text{arc} \times \Delta z $$
(Z-plane slice method approximation used in algorithmic implementations).

**Citations:**
- Lee, B., & Richards, F. M. (1971). The interpretation of protein structures: estimation of static accessibility. *Journal of Molecular Biology*, 55(3), 379-400. DOI: [10.1016/0022-2836(71)90324-X](https://doi.org/10.1016/0022-2836(71)90324-X)
- Connolly, M. L. (1983). Solvent-accessible surfaces of proteins and nucleic acids. *Science*, 221(4612), 709-713. DOI: [10.1126/science.6879170](https://doi.org/10.1126/science.6879170)

## 3. Marching Cubes 3D Isosurface Extraction
**Physics / Computer Graphics:**
Extracting isosurfaces from 3D scalar fields (such as electron density maps or electrostatic potentials) is typically done using the Marching Cubes algorithm. It interpolates exact intersection coordinates on grid edges.

**Equation (Linear Interpolation for Edge Intersection):**
$$ \mathbf{p} = \mathbf{v}_1 + \frac{c - f(\mathbf{v}_1)}{f(\mathbf{v}_2) - f(\mathbf{v}_1)} \cdot (\mathbf{v}_2 - \mathbf{v}_1) $$
*(Where $c$ is the isovalue, and $\mathbf{v}_1$, $\mathbf{v}_2$ are voxel vertices).*

**Citation:**
- Lorensen, W. E., & Cline, H. E. (1987). Marching cubes: A high resolution 3D surface construction algorithm. *ACM SIGGRAPH Computer Graphics*, 21(4), 163-169. DOI: [10.1145/37402.37422](https://doi.org/10.1145/37402.37422)

## 4. Cartoon Ribbon Interpolation (B-Splines / Hermite)
**Physics / Computer Graphics:**
To create smooth continuous cartoon representations of polymer backbones, PyMOL fits a spline (such as Catmull-Rom or B-spline) through the $C_\alpha$ atoms (or P atoms for nucleic acids).

**Equations:**
For a Catmull-Rom spline, the tangent at point $\mathbf{p}_i$ is estimated as:
$$ \mathbf{m}_i = \frac{\mathbf{p}_{i+1} - \mathbf{p}_{i-1}}{2} $$
The position $\mathbf{p}(t)$ between $\mathbf{p}_i$ and $\mathbf{p}_{i+1}$ is evaluated via Hermite basis functions.

**Citation:**
- Carson, M. (1991). Ribbons: models of macromolecules. *Journal of Molecular Graphics*, 9(1), 1-6. DOI: [10.1016/0263-7855(91)80031-G](https://doi.org/10.1016/0263-7855(91)80031-G)

## 5. Kabsch Optimal Rotation & RMSD
**Biophysics / Math:**
Structural alignment involves translating centroids to the origin and computing the optimal rotation matrix to minimize the Root Mean Square Deviation (RMSD).

**Equation (Singular Value Decomposition):**
Covariance matrix $H = P^T Q = U \Sigma V^T$
Optimal Rotation Matrix $R$:
$$ R = V \text{diag}(1, 1, \det(V U^T)) U^T $$

**Citation:**
- Kabsch, W. (1976). A solution for the best rotation to relate two sets of vectors. *Acta Crystallographica Section A*, 32(5), 922-923. DOI: [10.1107/S056773947600187X](https://doi.org/10.1107/S056773947600187X)

## 6. Ramachandran Dihedral Angles
**Structural Biology:**
Protein backbone geometry is evaluated via $\phi$ (C-N-CA-C) and $\psi$ (N-CA-C-N) dihedral angles, mapping steric clash boundaries.

**Citation:**
- Lovell, S. C., Davis, I. W., Arendall, W. B., de Bakker, P. I., Word, J. M., Prisant, M. G., Richardson, J. S., & Richardson, D. C. (2003). Structure validation by Calpha geometry: phi,psi and Cbeta deviation. *Proteins: Structure, Function, and Bioinformatics*, 50(3), 437-450. DOI: [10.1002/prot.10286](https://doi.org/10.1002/prot.10286)

## 7. Electrostatic Potential Mapping
**Biophysics:**
PyMOL interfaces with tools like APBS to compute solvent-screened electrostatics via the Poisson-Boltzmann equation or Debye-Hückel approximation.

**Equation (Poisson-Boltzmann):**
$$ \nabla \cdot [\epsilon(\mathbf{r}) \nabla \phi(\mathbf{r})] - \kappa^2(\mathbf{r}) \phi(\mathbf{r}) = -\frac{4\pi \rho(\mathbf{r})}{\epsilon(\mathbf{r})} $$

**Citation:**
- Baker, N. A., Sept, D., Joseph, S., Holst, M. J., & McCammon, J. A. (2001). Electrostatics of nanosystems: application to microtubules and the ribosome. *Proceedings of the National Academy of Sciences*, 98(18), 10037-10041. DOI: [10.1073/pnas.181342398](https://doi.org/10.1073/pnas.181342398)

## 8. Molecular Dipole Moment
**Chemistry:**
Calculated from partial charges on atomic coordinates.
**Equation:**
$$ \boldsymbol{\mu} = \sum q_i \mathbf{r}_i $$

**Citation:**
- Debye, P. (1912). Einige Resultate einer kinetischen Theorie der Isolatoren. *Physikalische Zeitschrift*, 13, 97-100. (General context of dipole moments).

## 9. Van der Waals Radii & CPK Coloring
**Chemistry:**
Atomic spheres are rendered using accepted van der Waals radii, frequently colored via the Corey-Pauling-Koltun (CPK) convention.

**Citation:**
- Bondi, A. (1964). van der Waals Volumes and Radii. *The Journal of Physical Chemistry*, 68(3), 441-451. DOI: [10.1021/j100785a001](https://doi.org/10.1021/j100785a001)

## 10. B-factor Putty Tube Scaling
**Structural Biology:**
Temperature factors (B-factors, denoting atomic thermal displacement) are visualized by scaling the radius of a cartoon tube.

**Equation:**
$$ r_i = r_{\text{min}} + (r_{\text{max}} - r_{\text{min}}) f(B_i) $$
where $f(B_i)$ normalizes the B-factor data.

**Citation:**
- Trueblood, K. N., Bürgi, H. B., Burzlaff, H., Dunitz, J. D., Hargittai, I., Mak, T. C. W., ... & Willis, B. T. M. (1996). Atomic displacement parameter nomenclature. Report of a subcommittee on atomic displacement parameter nomenclature. *Acta Crystallographica Section A: Foundations of Crystallography*, 52(5), 770-781. DOI: [10.1107/S010876739600645X](https://doi.org/10.1107/S010876739600645X)

## 11. Electron Density Map Isosurfacing
**Physics / Crystallography:**
PyMOL displays 2Fo-Fc and Fo-Fc Fourier synthesis maps generated by X-ray crystallography (often stored in CCP4/MRC format). Maps are constructed from structure factor amplitudes and phases.

**Equation:**
$$ \rho(\mathbf{r}) = \frac{1}{V} \sum_{\mathbf{h}} |F(\mathbf{h})| e^{i\phi(\mathbf{h})} e^{-2\pi i \mathbf{h} \cdot \mathbf{r}} $$

**Citation:**
- Winn, M. D., et al. (2011). Overview of the CCP4 suite and current developments. *Acta Crystallographica Section D: Biological Crystallography*, 67(4), 235-242. DOI: [10.1107/S090744491004574X](https://doi.org/10.1107/S090744491004574X)

## 12. Non-covalent Interactions
**Chemistry / Biophysics:**
Distance and angle criteria are used in PyMOL to define interactions:
- Hydrogen bonds ($\sim 2.7-3.3 \text{ \AA}$)
- Salt bridges (charged pairs, $< 4.0 \text{ \AA}$)
- $\pi$--$\pi$ stacking (centroid distance and parallel angles)
- Cation--$\pi$ / Halogen bonds.

**Citation:**
- Bissantz, C., Kuhn, B., & Zerbe, O. (2010). A medicinal chemist's guide to molecular interactions. *Journal of Medicinal Chemistry*, 53(14), 5061-5084. DOI: [10.1021/jm100112j](https://doi.org/10.1021/jm100112j)

## 13. MMFF94 Force Field for Sculpting
**Biochemistry / Molecular Mechanics:**
Real-time structure sculpting relies on molecular mechanics force fields like MMFF94 to energy-minimize modified conformations.

**Equation:**
$$ E_{\text{total}} = E_{\text{bond}} + E_{\text{angle}} + E_{\text{torsion}} + E_{\text{vdW}} + E_{\text{elec}} $$

**Citation:**
- Halgren, T. A. (1996). Merck molecular force field. I. Basis, form, scope, parameterization, and performance of MMFF94. *Journal of Computational Chemistry*, 17(5-6), 490-519. DOI: [10.1002/(SICI)1096-987X(199604)17:5/6<490::AID-JCC1>3.0.CO;2-P](https://doi.org/10.1002/(SICI)1096-987X(199604)17:5/6<490::AID-JCC1>3.0.CO;2-P)
