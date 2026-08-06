# MolExplorer & MolStudio Architecture Unification Task List

- `[x]` **Step 1: Unified State Management (Zustand)**
  - `[x]` Update `src/store/index.ts` to include `MoleculeSlice` (library, active molecule, compare molecule).
  - `[x]` Update `src/store/index.ts` to include `FilterSlice` for search and range parameters.
  - `[x]` Refactor `src/pages/MolExplorer.tsx` to remove local states and use `useStore()`.

- `[x]` **Step 2: Universal 3D Viewer Consolidation**
  - `[x]` Create `src/components/CoreViewer3D.tsx` combining features of both old viewers.
  - `[x]` Update `src/pages/MolExplorer.tsx` to use `<CoreViewer3D mode="explorer" />`.
  - `[x]` Update `src/pages/MolStudio.tsx` to use `<CoreViewer3D mode="studio" />`.
  - `[x]` Delete `src/components/Viewer3D.tsx` and `src/components/MolStudioViewer.tsx`.

- `[x]` **Step 3: Decomposing MolStudio God Module**
  - `[x]` Extract timeline logic into `src/features/studio/TimelineEngine.tsx`.
  - `[x]` Extract validation tools into `src/features/studio/BiophysicalValidation.tsx`.
  - `[x]` Clean up `MolStudio.tsx` to act only as a layout router container.

- `[x]` **Step 4: Final QA & Documentation**
  - `[x]` Run TypeScript lint to ensure no errors.
  - `[x]` Test transitions between MolExplorer and MolStudio.
  - `[x]` Ensure Github is perfectly synced with latest changes.
  - `[x]` Answer user questions regarding C++ absence./IMPLEMENTATION_PLANS.md`.
  - `[ ]` Commit and push to GitHub `dev` branch.
