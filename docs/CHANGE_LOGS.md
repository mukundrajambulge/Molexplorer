# MolExplorer & MolStudio Change Logs

Comprehensive record of all feature implementations, bug fixes, software updates, and file modifications across development sessions.

---

## [2026-08-06 20:45:00 IST] - Stage 5 Engine Completion & Real-Time Media Upgrades
### 🚀 Features Implemented
- **WebGPU Raytracer & Software Raymarching Engine**:
  - Implemented `WebGPURaytracer` (`src/rendering/webgpu/Raytracer.ts`) with compute shader WGSL ray-sphere intersection, Lambertian diffuse, and Phong specular highlights.
  - Added a high-performance **Software Raytracer Fallback Engine** (`renderSoftware()`) using Canvas2D radial gradients and depth-sorted painter's algorithm. If WebGPU hardware adapter is unavailable in browser settings, the raytracing feature seamlessly falls back to software mode without blocking error popups.
  - Updated `RaytraceViewer.tsx` UI with active engine status badge ("WebGPU Hardware" vs "Software Raytracer").
- **Real MP4 Video Recording & Export**:
  - Implemented canvas frame recording pipeline in `MolStudio.tsx` using `MediaRecorder` + `@ffmpeg/ffmpeg` WASM encoding.
  - Added 360-degree rotational movie render pass that captures 60 frames of animation and automatically prompts the user to download `molstudio_movie_[timestamp].mp4`.
  - Added real-time encoding progress modal overlay with percentage progress bar.
- **In-App User Manual Modal**:
  - Built `UserManualModal.tsx` rendering Markdown via `react-markdown` and `remark-gfm`.
  - Created `public/UserManual.md` detailing operational instructions for Stages 1 through 5.

### 🐛 Bug Fixes & Refactoring
- Corrected secondary structure mapping in `MolProcessor.ts` by ensuring residue-level `ss` properties (`helix`, `sheet`, `loop`) copy to individual `Atom` objects.
- Resolved PyMOL Selection Query Console issue where `ss h` returned 0 atoms.
- Fixed TypeScript type definitions in `tsconfig.json` to include `@webgpu/types`.

---

## [2026-08-05 19:30:00 IST] - Stage 3 & Stage 4 UI Consolidation
### 🚀 Features Implemented
- **Consolidated Ribbon Bar**:
  - Unified "Measurement Wizard" and "Biophysical Validation" under a single `Structure Analysis` ribbon tab in `StudioRibbonBar.tsx`.
- **PyMOL ASHLC Control Panel**:
  - Created `ObjectControlPanel.tsx` providing PyMOL-style Action (A), Show (S), Hide (H), Label (L), and Color (C) controls for loaded structures and active selections.
- **Visual Regression Testing**:
  - Built Puppeteer test suite (`scratch/test_visualizations.cjs`) to validate rendering modes (Cartoon, Putty, Sticks, CPK color schemes).

---

## [2026-08-04 18:00:00 IST] - Scientific Foundations & Biophysical Calculations
### 🚀 Features Implemented
- **Molecular Dipole Moment**: Implemented partial charge translation and mass-weighted center of mass vector calculation in `SelectionParser.ts`. Added 3D vector arrow visualization in viewer.
- **Ramachandran Torsion Analysis**: Implemented backbone dihedral ($\phi$, $\psi$) computation and Ramachandran quadrant classification (Favored, Allowed, Outliers).
- **DSSP Hydrogen Bonding Engine**: Implemented electrostatic hydrogen bond energy calculation ($E < -0.5 \text{ kcal/mol}$).
- **Kabsch Structural Alignment**: Implemented SVD matrix rotation for superimposing two molecular structures (`Alignment.ts`).
