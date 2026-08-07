# MolExplorer & MolStudio Central Implementation Plans & Artifacts Registry

Central repository of all technical design documents, architectural proposals, and stage implementation plans.

---

## 📑 Registry of Stage Implementation Plans

### 1. Unified Application Architecture Refactoring
- **File**: `docs/reports/MolExplorer_MolStudio_Architecture_Audit.md` & `docs/reports/implementation_plan.md`
- **Objective**: Detailed architectural audit and step-by-step refactoring plan to eliminate the "Split Brain" state isolation between MolExplorer and MolStudio by transitioning to a unified Zustand global state and consolidated `CoreViewer3D.tsx`.

### 2. Stage 5: Movie & Keyframing Engine & WebGPU Raytracing
- **File**: `docs/reports/implementation_plan.md`
- **Objective**: Enable cinematic animation timeline, spherical linear interpolation (SLERP) keyframing, real H.264 MP4 video encoding, WebGPU compute shader raytracing with software fallback, and in-app User Manual modal.

### 2. Stage 4 to 8 Master Implementation Roadmap
- **File**: `docs/reports/molstudio_stage4_to_stage8_master_plan.md`
- **Objective**: Master multi-stage plan outlining Object Controls (Stage 4), Animation & WebGPU (Stage 5), Mutagenesis & CCP4 Density Maps (Stage 6), Session Serialization (Stage 7), and MMFF94 WASM Structure Sculpting (Stage 8).

### 3. Stage 3: Advanced Biophysical Features Plan
- **File**: `docs/reports/Stage_3_Advanced_Biophysical_Features_Implementation_Plan.md`
- **Objective**: Mathematical foundation design for Dipole Moment calculation, Ramachandran Torsion plots, DSSP electrostatic hydrogen bond detection, and Kabsch structural alignment.

### 4. Stage 3: Measurement & Label System Plan
- **File**: `docs/reports/Stage_3_Measurement_and_Label_System_Implementation_Plan.md`
- **Objective**: Distance, angle, dihedral, and atom label state machine design for viewport interactions.

### 5. Consolidated QA Verification Report
- **File**: `docs/reports/qa_verification_consolidated_report.md`
- **Objective**: Detailed performance benchmarks and mathematical verification outcomes across 10 core modules.

### 6. Scientific Foundations & Equations Audit
- **File**: `docs/reports/pymol_scientific_foundations_and_equations.md`
- **Objective**: Theoretical physics & biophysics equations reference (Debye dipole equations, Kabsch SVD rotation matrix proof, Lovell Ramachandran region boundaries, Kabsch-Sander hydrogen bond energy formula).
