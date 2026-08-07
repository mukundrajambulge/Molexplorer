# PyMOL UI Controls and Context Menus Audit

This document provides an exhaustive audit of all non-main-menu interaction points and UI controls in PyMOL, mapping them to MolStudio with implementation feasibility and priority.

## 1. Viewport 3D Right-Click Context Menu

### Scopes (Atom, Residue, Chain, Segment, Object, Molecule, Selection)
*   **PyMOL Functionality**: Right-clicking in the 3D viewport opens a context menu tailored to the selected scope (atom, residue, etc.).
*   **MolStudio Status**: Missing.
*   **Why Missing (Stages 1-3)**: Initial focus was on basic visualization and the top menu bar to establish the core web architecture before handling complex 3D event picking and dynamic menu generation.
*   **Web Browser Feasibility**: High. Using NGL/3Dmol picking events combined with standard DOM/React context menus.
*   **Target Stage**: Stage 4 (Advanced UI/Interactions)
*   **Priority**: High. Crucial for intuitive interaction.

### Sub-options (Zoom, Orient, Center, Origin, Drag, Clean, Color, Show, Hide, Label, Remove, Rename, Duplicate, Extract, Copy)
*   **PyMOL Functionality**: Actions performed specifically on the right-clicked entity or scope.
*   **MolStudio Status**: Partially supported via global commands, but not contextually bound.
*   **Why Missing (Stages 1-3)**: Lacked the context menu trigger system.
*   **Web Browser Feasibility**: High. WebGL viewers support most of these visual updates natively.
*   **Target Stage**: Stage 4
*   **Priority**: High.

## 2. Object Control Panel (A, S, H, L, C Buttons)

### [A] Action Menu
*   **PyMOL Functionality**: zoom, orient, center, origin, presets (simple, publication, ball & stick, b-factor putty), find polar contacts, generate symmetry mates/electrostatics, compute properties, state freeze/thaw, rename/duplicate/delete.
*   **MolStudio Status**: Basic show/hide supported in some panels, but comprehensive presets and complex actions are missing.
*   **Why Missing (Stages 1-3)**: Many actions require complex algorithms (electrostatics, symmetry) or extensive state management.
*   **Web Browser Feasibility**: Medium to High. Visual actions are easy; complex computations (electrostatics) may require WebAssembly or server-side offloading.
*   **Target Stage**: Stage 5 (Computational Features)
*   **Priority**: High for visualization actions; Medium for computational ones.

### [S] Show Menu
*   **PyMOL Functionality**: lines, sticks, ribbon, cartoon, spheres, dots, surface, mesh, nonbonded, cell, disulfide.
*   **MolStudio Status**: Basic representations (cartoon, sticks) implemented.
*   **Why Missing (Stages 1-3)**: Advanced meshes and dot surfaces require higher client-side rendering performance.
*   **Web Browser Feasibility**: High, natively supported by modern WebGL molecular libraries.
*   **Target Stage**: Stage 3/4
*   **Priority**: High.

### [H] Hide Menu
*   **PyMOL Functionality**: everything, lines, sticks, ribbon, cartoon, spheres, surface, etc.
*   **MolStudio Status**: Basic hide supported.
*   **Why Missing (Stages 1-3)**: Full granularity missing due to incomplete representation state tracking.
*   **Web Browser Feasibility**: High.
*   **Target Stage**: Stage 3
*   **Priority**: High.

### [L] Label Menu
*   **PyMOL Functionality**: clear, atom name, element, resn, resi, chain, b-factor, occupancy, formal charge, partial charge.
*   **MolStudio Status**: Missing.
*   **Why Missing (Stages 1-3)**: 3D text rendering in WebGL is computationally heavy and often requires complex sprite/canvas overlays.
*   **Web Browser Feasibility**: Medium. Doable via 2D canvas overlays synced with 3D camera or SDF text rendering in WebGL.
*   **Target Stage**: Stage 4
*   **Priority**: Medium.

### [C] Color Menu
*   **PyMOL Functionality**: by element, by chain, by ss, spectrum (rainbow, b-factor), 30+ solid colors.
*   **MolStudio Status**: Basic solid colors and limited schemes supported.
*   **Why Missing (Stages 1-3)**: Complex spectrum mapping requires parsing molecular data attributes continuously.
*   **Web Browser Feasibility**: High.
*   **Target Stage**: Stage 4
*   **Priority**: High.

## 3. Selection Algebra

### Keywords (~50 keywords)
*   **PyMOL Functionality**: e.g., name, resn, resi, chain, elem, alt, segi, model, index, ss, b, q, formal_charge, polymer, organic, inorganic, solvent, hetatm, hydrogens, metals, donors, acceptors, all, none, visible.
*   **MolStudio Status**: Limited string matching implemented.
*   **Why Missing (Stages 1-3)**: Parsing a complete custom domain-specific language (DSL) requires building an AST and evaluation engine in JS/TS.
*   **Web Browser Feasibility**: High. Can be built with a parser generator (like nearley.js or ANTLR) compiling to JS.
*   **Target Stage**: Stage 5 (Advanced Selections)
*   **Priority**: High. It is the defining feature of PyMOL's power.

### Spatial Expansion Operators
*   **PyMOL Functionality**: `byres`, `bychain`, `bymolecule`, `byobject`, `neighbor`, `extend`, `within`, `around`, `near_to`, `beyond`.
*   **MolStudio Status**: Missing.
*   **Why Missing (Stages 1-3)**: Requires spatial indexing (e.g., KD-trees, grid hashing) to be performant on the client-side for thousands of atoms.
*   **Web Browser Feasibility**: High. Using spatial hashing in JavaScript.
*   **Target Stage**: Stage 5
*   **Priority**: Medium.

## 4. Toolbar Buttons & Quick Controls

*   **PyMOL Functionality**: Zoom, Orient, Rock, Presets, Builder, Scene, Draw, Ray.
*   **MolStudio Status**: Missing, mostly replaced by native mouse controls.
*   **Why Missing (Stages 1-3)**: Prioritized core architecture over floating toolbars. "Ray" tracing is inherently difficult in standard WebGL.
*   **Web Browser Feasibility**: High for basic views (Zoom, Orient, Rock, Scene). Low for "Ray" without server-side rendering or WebGPU path tracing.
*   **Target Stage**: Stage 4
*   **Priority**: Medium.

## 5. Command Line Interface (CLI)

*   **PyMOL Functionality**: Direct typing of commands for Loading, Selection, Visualization, Manipulation, Alignment, Camera, Rendering, Movie, Editing, Settings.
*   **MolStudio Status**: Basic text input available but lacks comprehensive command dictionary.
*   **Why Missing (Stages 1-3)**: Mapping hundreds of PyMOL commands to JS equivalents is highly labor-intensive.
*   **Web Browser Feasibility**: High. A console panel is standard web UI.
*   **Target Stage**: Stage 5/6
*   **Priority**: High (for power users).

## 6. Mouse Controls & Keyboard Hotkeys

### Mouse Interactions
*   **PyMOL Functionality**: Left click (rotate/select), right click (zoom/menu), middle click (translate), scroll wheel (slab/zoom), shift+click (add selection), ctrl+click.
*   **MolStudio Status**: Standard viewer defaults (NGL/3Dmol defaults) which do not necessarily mimic PyMOL.
*   **Why Missing (Stages 1-3)**: Default library bindings were kept to avoid overriding complex event listeners prematurely.
*   **Web Browser Feasibility**: High. Requires custom event handler mapping overriding the base WebGL viewer.
*   **Target Stage**: Stage 4
*   **Priority**: High. Needed for muscle-memory familiarity for PyMOL users.

### Keyboard Hotkeys
*   **PyMOL Functionality**: F1-F12 scenes, page up/down (states), esc (deselect), space (play movie).
*   **MolStudio Status**: Missing.
*   **Why Missing (Stages 1-3)**: Browser hijacking of F-keys and page keys makes this tricky to implement natively without breaking accessibility.
*   **Web Browser Feasibility**: Medium. Some keys (F5, F11, F12) are reserved by browsers and require `preventDefault()`, which users might dislike.
*   **Target Stage**: Stage 4
*   **Priority**: Medium. Requires careful mapping to avoid browser conflicts.
