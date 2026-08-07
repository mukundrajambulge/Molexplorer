# MoleExplorer & MolStudio Changelog

## [1.0.0] - 2026-08-07

### Scientific Foundations & Mathematical Rigor
- **Coordinate Metrics & Measurements**: Standardized Euclidean 3D distance, 3-atom bond angle, and 4-atom signed dihedral torsion angle calculations ($\phi, \psi, \omega, \chi$) using standard IUPAC-IUB conventions across all calculation engines (`store/index.ts`, `SelectionParser.ts`, `MolProcessor.ts`).
- **Singular Value Decomposition (SVD) Kabsch Superposition**: Integrated Kabsch 3x3 SVD alignment for optimal rigid body superposition ($R, \mathbf{t}$) and exact root-mean-square deviation ($\text{RMSD}$) calculation.
- **Molecular Dipole Vector Calculations**: Added center-of-mass translation ($\mathbf{R}_{\text{COM}}$) and partial charge vector sums ($\mathbf{\mu} = \sum q_i (\mathbf{r}_i - \mathbf{R}_{\text{COM}})$) in Debye units.
- **Biological Assembly & Crystal Symmetry**: Implemented generic 3x3 rotation $R$ and 3x1 translation $\mathbf{t}$ matrix application for arbitrary macromolecular biological assemblies (monomers, homodimers, heterodimers, trimers, tetramers, hexamers, capsids, protein-DNA/RNA/ligand complexes).
- **Surface Generation**: Integrated solvent-accessible surface area (SASA) via Golden Spiral Shrake-Rupley sphere sampling probe ($r_{\text{probe}} = 1.4\text{ \AA}$) and Solvent-Excluded Surface (SES) mesh generation.

### Generalized N-Chain & Component Management System
- **Dynamic Component Classification**: Automated extraction and categorization of proteins, nucleic acids (DNA/RNA), ligands, cofactors, ions, and solvent water molecules from PDB/mmCIF structures without hardcoded chain count assumptions.
- **Selective Isolation & Restoration**: Added ability to select, isolate, hide, or restore arbitrary combinations of chains and components.
- **Interaction & Selection Integrity**: Ensured 3D distance measurements, bond angles, dihedrals, named selections, and biophysical annotations remain fully intact and interactive after chain filtering or isolation.

### Performance & Dependency Optimization
- **`package.json` Cleanup**: Removed duplicate `vite` entries, cleaned unused dependencies, and updated package metadata to `molexplorer-molstudio`.
- **Zero Build Errors**: Confirmed clean compilation with 0 TypeScript errors (`npx tsc --noEmit`) and successful production bundling with Vite (`npm run build`).

### Documentation & Logs
- Updated master architectural implementation plans and audit reports in `docs/` and synced with project artifacts.
