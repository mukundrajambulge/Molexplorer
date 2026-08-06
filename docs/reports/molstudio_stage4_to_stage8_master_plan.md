# MolStudio: Master Implementation Roadmap & Technical Execution Plan (Stages 4-8)

## Stage 4: Advanced Representations, Per-Object Controls & Editing
**Objective**: Introduce advanced visual styles, granular object control, and undo/redo state management.
**Key Features**:
- B-factor putty, non-bonded sphere representations.
- Toggleable solvent/water display.
- Per-object Action/Show/Hide/Label/Color (ASHLC) control panel.
- Viewport right-click context menus.
- Undo/redo state stack.
**Implementation Details**:
- **Representation Engine Updates**: Modify existing representation pipelines to map B-factor values to tube radii (putty). Add shaders for non-bonded spheres using instanced impostors.
- **ASHLC Panel**: Implement a React/Vue component representing a PyMOL-style object list.
- **State Management**: Integrate a command pattern or Redux-style store where each structural modification or visual change pushes a diff/action to an undo/redo stack.
- **Files to Modify/Create**:
  - `src/components/ObjectControlPanel.tsx` (New)
  - `src/rendering/shaders/putty.vert`, `putty.frag` (New)
  - `src/state/historyStore.ts` (New)
  - `src/rendering/RepresentationManager.ts` (Modify)

## Stage 5: Movie & Keyframing Engine & WebGPU Raytracing
**Objective**: Enable cinematic animation, presentation tools, and photorealistic rendering.
**Key Features**:
- Timeline UI and keyframe interpolation.
- Rock/roll/nutate auto-programs.
- WebCodecs MP4/GIF export.
- WebGPU compute shader raytracer.
**Implementation Details**:
- **Animation Pipeline**: Create a KeyframeManager that interpolates camera matrices, object visibilities, and colors over time using Catmull-Rom or spherical linear interpolation (Slerp) for rotations.
- **Export**: Capture WebGL/WebGPU canvas frames via `requestVideoFrameCallback`, encode using WebCodecs API into mp4 or use a WASM-based GIF encoder.
- **Raytracing**: Implement a hybrid rendering path. A WebGPU compute pipeline that traverses a bounding volume hierarchy (BVH) built from the molecular geometry.
- **Files to Modify/Create**:
  - `src/animation/Timeline.tsx`, `KeyframeManager.ts` (New)
  - `src/export/VideoEncoder.ts` (New)
  - `src/rendering/webgpu/Raytracer.ts`, `bvh.wgsl`, `raytrace.wgsl` (New)

## Stage 6: Interactive Wizards Suite & Electron Density Maps
**Objective**: Provide professional structural biology tools and experimental data visualization.
**Key Features**:
- Mutagenesis rotamer library wizard.
- CCP4/MTZ electron density map parser.
- Marching Cubes WASM isosurfacing.
- Pair fitting wizard & Fragment builder library.
**Implementation Details**:
- **Electron Density Maps**: Parse CCP4 binary format. Implement Marching Cubes in Rust/C++ compiled to WASM for fast mesh generation from 3D grids.
- **Mutagenesis Wizard**: Load a curated backbone-dependent rotamer library (e.g., Dunbrack). Implement UI for stepping through rotamers and calculating clashes.
- **Pair Fitting**: Kabsch algorithm implementation (in JS or WASM) to superimpose structures based on selected atom pairs.
- **Files to Modify/Create**:
  - `src/parsers/CCP4Parser.ts`, `MTZParser.ts` (New)
  - `src/wasm/marching_cubes.rs` (New)
  - `src/wizards/MutagenesisWizard.tsx`, `PairFitWizard.tsx` (New)

## Stage 7: Session System (.pse equivalent) & UX Polish
**Objective**: Allow saving/loading of the complete workspace state and improve user experience.
**Key Features**:
- Workspace state serialization (JSON session files).
- Sequence viewer bar overlay.
- Orthoscopic/perspective toggle, stereo modes.
- Custom hotkeys.
**Implementation Details**:
- **Session Schema**: Define a comprehensive JSON schema capturing loaded molecules, representations, camera state, scenes, and UI settings. Convert complex objects (like ArrayBuffers for maps) into base64 or separate zip entries if creating a multi-file `.msz` (MolStudio Zip) format.
- **Sequence Viewer**: A horizontal scrollable component aligned with the 3D viewport, linking 1D sequence selections to 3D atom selections.
- **Camera Controls**: Modify camera projection matrices for orthographic/perspective and implement cross-eye/hardware stereo rendering by splitting the viewport.
- **Files to Modify/Create**:
  - `src/session/SessionManager.ts`, `SessionSchema.ts` (New)
  - `src/components/SequenceViewer.tsx` (New)
  - `src/input/HotkeyManager.ts` (New)

## Stage 8: Interactive Structure Sculpting & Simulation
**Objective**: Real-time energy minimization and interactive structure modification.
**Key Features**:
- MMFF94 WASM force-field energy minimization engine.
- Mouse-driven atom dragging with real-time geometric constraints.
- Zero-copy buffer sharing between WASM and JS.
**Implementation Details**:
- **Simulation Engine**: Compile a lightweight molecular dynamics engine (like OpenBabel's MMFF94 implementation or a custom Rust engine) to WASM.
- **Memory Management**: Use `SharedArrayBuffer` (if cross-origin isolated) or direct WASM memory views for zero-copy sharing of atom coordinates between the rendering loop and the physics engine.
- **Interaction**: Implement raycasting for atom picking, apply spring forces towards the mouse cursor, and let the WASM engine resolve constraints/clashes.
- **Files to Modify/Create**:
  - `src/wasm/forcefield/` (New Rust/C++ project)
  - `src/simulation/SculptingEngine.ts` (New)
  - `src/interaction/DragController.ts` (Modify)
