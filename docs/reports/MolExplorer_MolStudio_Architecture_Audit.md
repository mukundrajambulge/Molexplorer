# Architectural Audit: MolExplorer & MolStudio Integration

This report focuses specifically on the architectural discrepancies, state management fragmentation, and rendering pipeline issues between the two primary applications: **MolExplorer** (2D/3D discovery) and **MolStudio** (Advanced Biophysics & Animation).

---

## 1. State Management Mismatch (The "Split Brain" Problem)

### The Issue
Currently, there is no shared platform layer between the two products.
- **MolExplorer (`MolExplorer.tsx`)** relies heavily on local React `useState` hooks and prop drilling.
- **MolStudio (`MolStudio.tsx`)** utilizes a monolithic global store (`zustand` in `src/store/index.ts`), but still manages complex local state for features like timeline, raytracing, and UI panels.

### Root Cause
The two applications were developed in silos. When a user explores a molecule in MolExplorer, that state (e.g., fetched PDB data, selected ligands) exists entirely in local memory. When navigating to MolStudio, this context is lost because MolStudio relies on a completely different state initialization path.

### High-Impact Consequences
- **Data Loss on Navigation**: Users cannot smoothly transition a discovered molecule from MolExplorer into MolStudio for advanced biophysical analysis without re-fetching or re-uploading.
- **State Synchronization Bugs**: Changes made to global configurations in one app do not reflect in the other.

### Proposed Solution
1. **Unified Global Store (`@molexplorer/core-state`)**: Restructure the Zustand store into modular slices:
   - `useMoleculeStore`: Manages the active loaded structure, its atoms, and selections across *both* apps.
   - `useWorkspaceStore`: Manages global settings (rendering mode, background color).
2. **Remove Local State for Core Data**: Refactor `MolExplorer.tsx` to read/write to the unified Zustand store instead of using local `useState` for molecular data.

---

## 2. Duplicate 3D Rendering Pipelines

### The Issue
The application maintains two entirely separate wrappers for the 3Dmol.js canvas:
- `Viewer3D.tsx` (Used by MolExplorer)
- `MolStudioViewer.tsx` (Used by MolStudio)

### Root Cause
MolStudio required complex event handling for selection clicks, context menus, and biophysical labels, leading to the creation of a specialized viewer rather than extending the base viewer.

### High-Impact Consequences
- **Code Duplication**: Both components independently manage 3Dmol.js initialization, resizing, and base color mapping.
- **Inconsistent Features**: Fixes applied to `MolStudioViewer.tsx` (like correct HETATM fallback rendering for ligands) are completely missing in `Viewer3D.tsx`, meaning MolExplorer renders molecules differently and less accurately than MolStudio.

### Proposed Solution
1. **Universal 3D Viewer (`<CoreViewer3D />`)**: Merge both components into a single, highly configurable 3D viewer.
2. **Plugin/Mode Architecture**: Pass a `mode` prop (`mode="explorer" | "studio"`) that dictates which event listeners (e.g., advanced selection clicks vs. simple viewing) are attached, while sharing the core rendering pipeline.

---

## 3. "God Module" Component Architecture

### The Issue
`MolStudio.tsx` has become a "God Component," currently exceeding 900 lines of code. It directly handles:
- Timeline and keyframe logic
- MP4 Export routines and WebGPU Raytracing instantiation
- Ribbon UI state
- PyMOL command console execution

### High-Impact Consequences
- **Maintenance Difficulty**: Extremely difficult to debug or extend. A small UI change in the ribbon bar can inadvertently break the animation timeline state.
- **Performance Degradation**: Massive single components lead to unnecessary re-renders of the entire 3D application whenever a minor state (like a dropdown menu opening) changes.

### Proposed Solution
1. **Feature-Based Decomposition**: Break `MolStudio.tsx` into decoupled feature modules:
   - `src/features/studio/TimelineEngine.tsx`
   - `src/features/studio/ExportManager.tsx`
   - `src/features/studio/RibbonController.tsx`
2. **Context Boundaries**: Use React Context or Zustand selectors to ensure these modular components only re-render when their specific data changes.
