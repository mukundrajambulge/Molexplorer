# MolStudio User Manual

Welcome to **MolStudio**, the professional-grade molecular visualization and biophysical analysis suite. This manual covers all features implemented up through Stage 5.

---

## Stage 1: File & I/O 
MolStudio supports natively loading molecules from the Protein Data Bank (PDB).

- **Fetch from PDB**: Navigate to the `File & I/O` tab in the ribbon. Enter a valid 4-character PDB ID (e.g., `1CRN`, `1HVR`) in the input box and click **Fetch**. The molecule will automatically download and render in the 3D viewport.
- **Auto-Parsing**: The application automatically parses atoms, residues, secondary structure (via DSSP algorithms), and biological assemblies.

---

## Stage 2: Selection & Query Algebra
The PyMOL-inspired Selection Query Console allows you to perform advanced selections.

- **Opening the Console**: Navigate to the `Selection & Query` tab and click **Query Console**.
- **Supported Syntax**:
  - `resn ALA and chain A`: Selects all Alanine residues in Chain A.
  - `elem C*`: Selects all Carbon, Calcium, etc. atoms using wildcards.
  - `within 5.0 of resi 45`: Selects all atoms within a 5-Angstrom radius of residue 45.
  - `ss h and not resn HOH`: Selects all alpha-helix residues excluding water molecules.
- **Saving Selections**: After running a query, click **Save Selection** to give it a custom name for easy retrieval.

---

## Stage 3: Biophysical Validations
Perform scientific calculations directly within the browser. These features are located under the `Structure Analysis` tab.

- **Dipole Moment**: Calculates the net molecular dipole vector based on partial charges. Toggle the **Show Dipole Arrow** checkbox to visualize the 3D vector.
- **Ramachandran Plot Data**: Open the Query Console and run `ramachandran all`. The console will output a detailed analysis of Phi ($\phi$) and Psi ($\psi$) torsions, categorizing them into Favored, Allowed, and Outlier regions.
- **Measurement Wizard**: Click `distance`, `angle`, or `dihedral` to measure geometry by clicking on 2, 3, or 4 atoms in the viewport, respectively.

---

## Stage 4: Representations & Object Control
Control how your molecules look with granular representation settings.

- **Object Panel (Left Sidebar)**: Manage all loaded molecules and active selections.
- **ASHLC Controls**:
  - **A** (Action): Zoom to object, delete object.
  - **S** (Show): Toggle representations (Cartoon, Stick, Sphere, Line, Cross).
  - **H** (Hide): Hide specific representations or everything.
  - **L** (Label): Toggle atom/residue labels.
  - **C** (Color): Apply color schemes (Spectrum, Chain, Secondary Structure, Element).

---

## Stage 5: Movie & Animation Engine
Create cinematic presentations and export them to `.mp4`.

- **Timeline Controls**: Navigate to the `Movie & Animation` tab. Use the bottom timeline to control playback.
- **Auto-Programs**: Click **Rock**, **Roll**, or **Nutate** to apply automatic cinematic camera movements to the viewport.
- **Exporting to MP4**: Click the **Render MP4** button to record the animation and download a high-quality video file using WebCodecs/FFmpeg.
- **Photorealistic Raytracing**: (Experimental) Toggle **WebGPU Raytrace** to switch the renderer to a photorealistic engine utilizing ambient occlusion and soft shadows. (Note: Requires a WebGPU-compatible browser like modern Chrome/Edge).

---
*End of Manual.*
