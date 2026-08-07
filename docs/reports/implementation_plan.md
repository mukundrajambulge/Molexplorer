# MolExplorer & MolStudio Unified Architecture Implementation Plan

This document details the architectural refactor required to solve the "Split Brain" state management issue, eliminate duplicated rendering pipelines, and decouple the `MolStudio.tsx` God Module.

## User Review Required
> [!IMPORTANT]
> The unified state architecture requires modifying how MolExplorer handles its molecule library. Are you okay with MolExplorer's library and filters moving to the global Zustand store so they persist when navigating between MolExplorer and MolStudio?

## Proposed Changes

### 1. Unified State Management (Zustand)

#### [MODIFY] `src/store/index.ts`
We will redesign the Zustand store into modular slices to serve both applications:
- **`MoleculeSlice`**: Manage `molecule` (active), `compareMolecule`, and `library` (array of `MoleculeData`).
- **`StudioSlice`**: Move the Studio-specific logic (measurements, biophysical state) into a dedicated slice.
- **`ViewerSlice`**: Unified configuration for `RenderStyle`, `ColorTheme`, background, etc.
- **`FilterSlice`**: Store `MolExplorer` filters (`searchQuery`, `massRange`, etc.) globally.

#### [MODIFY] `src/pages/MolExplorer.tsx`
- Replace local `useState` for `molecule`, `library`, `filters`, and `viewState` with `useStore()` hooks.
- Ensures seamless state transfer when navigating to `/studio`.

---

### 2. Universal 3D Viewer Consolidation

#### [NEW] `src/components/CoreViewer3D.tsx`
- Create a unified wrapper around `3Dmol.js` that accepts a `mode="explorer" | "studio"` prop.
- Consolidates viewer lifecycle, resize observers, and rendering style application.
- Supports both simple ligand rendering (Explorer mode) and complex biophysical event listeners (Studio mode).

#### [DELETE] `src/components/Viewer3D.tsx`
#### [DELETE] `src/components/MolStudioViewer.tsx`
- Deprecate both fragmented viewers.

#### [MODIFY] `src/pages/MolExplorer.tsx` & `src/pages/MolStudio.tsx`
- Update both pages to use `<CoreViewer3D />`.

---

### 3. Decomposing the MolStudio "God Module"

`MolStudio.tsx` is currently >900 lines. We will extract its massive inline sub-components into modular files.

#### [NEW] `src/features/studio/TimelineEngine.tsx`
- Move the `isRecordingMp4` state, `handleExportMp4` logic, and `Timeline` rendering here.

#### [NEW] `src/features/studio/StudioOverlayManager.tsx`
- Move the WebGPU Raytrace Viewer rendering and MP4 Export overlay here.

#### [MODIFY] `src/pages/MolStudio.tsx`
- Refactor to act only as the main layout container, importing `<StudioRibbonBar />`, `<CoreViewer3D />`, `<TimelineEngine />`, and `<StudioOverlayManager />`.

## Verification Plan

### Automated Tests
- Run `npm run lint` and `tsc --noEmit` to ensure type safety across the new Zustand store and generic Viewer props.
- Run `node scratch/test_visualizations.cjs` to ensure the unified `CoreViewer3D` still passes the visual regression tests for both small molecules and macromolecular proteins.

### Manual Verification
- Load a molecule in MolExplorer. Switch to MolStudio. Verify the molecule is still loaded.
- Run the MP4 export in MolStudio to ensure the decomposed `TimelineEngine` still captures the canvas correctly.
