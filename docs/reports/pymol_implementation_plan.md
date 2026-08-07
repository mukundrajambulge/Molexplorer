# PyMOL Parity Strategy & Architecture — MolStudio

> **Objective**: Transform **MolStudio** into a web-native, full-capability replacement for **PyMOL**, eliminating feature gaps so structural biologists and computational chemists have no reason to leave the browser.

---

## Part 1: How PyMOL Works (Architecture & Deep Dive)

PyMOL was designed around a **hybrid C/C++ and Python architecture**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    PyMOL Architecture                           │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                 UI Layer (PyQt GUI)                     │   │
│   └────────────────────────────┬────────────────────────────┘   │
│                                │                                │
│   ┌────────────────────────────▼────────────────────────────┐   │
│   │           Python API & Interpreter (pymol.cmd)          │   │
│   │   • Command execution (`color`, `select`, `align`)     │   │
│   │   • Macro scripting (.pml / .py)                        │   │
│   └────────────────────────────┬────────────────────────────┘   │
│                                │                                │
│   ┌────────────────────────────▼────────────────────────────┐   │
│   │           C/C++ Core Engine (Native Performance)        │   │
│   │   • OpenGL / Shader rendering engine                    │   │
│   │   • Ray Tracing (shadows, occlusion, anti-aliasing)     │   │
│   │   • Spatial Hashing & Bond Perception                   │   │
│   │   • Molecular Surfaces (Solvent Accessible / Excluded)  │   │
│   └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Key PyMOL Architectural Insights:
1. **Command-Driven Architecture**: Every GUI click in PyMOL maps directly to a `cmd.<function>()` API call. The GUI is merely a skin over a powerful CLI engine.
2. **PyMOL Selection Algebra**: A custom boolean/spatial algebra language (e.g. `(chain A and resn ALA) around 5 of (resi 100)`).
3. **Session Files (`.pse`)**: Complete serialization of object trees, atomic representations, camera matrices, color schemes, and movie frames.

---

## Part 2: Feature Gap Analysis — PyMOL vs. Current MolStudio

| Feature Domain | PyMOL Standard | Current MolStudio | **Required Enhancements for 100% Parity** |
|---|---|---|---|
| **Representation Modes** | Cartoon, Ribbon, Sticks, Spheres/VDW, Surface, Mesh, Dots, Putty (B-factor), Lines | Cartoon, Stick, Surface, VDW, Mesh | Add **Dots**, **Putty (B-factor width)**, **CA-Trace Lines**, **Non-bonded Spheres** |
| **Selection Engine** | Full algebra (`expand`, `byres`, `bychain`, `neighbor`, `gap`, `around`, `within`, `in`) | Basic (`SelectionParser.ts`) | Upgrade to **Full PyMOL Query Engine** supporting all spatial operators |
| **Non-Covalent Interactions** | Distance & angle H-bonds, $\pi$-$\pi$ stacking, $\pi$-cation, salt bridges, halogen bonds | Basic distance H-bond | Add **Full Interaction Engine**: $\pi$-stacking, salt bridges, halogen bonds, angle-validated H-bonds |
| **Electrostatics** | APBS (Poisson-Boltzmann) & Coulombic surface coloring | Gaussian mock surface | Add **Native Coulombic & APBS Electrostatic Potential Maps** (-5kT to +5kT) |
| **Protein Preparation** | Strip waters, add hydrogens, fix missing loops, alternate locations | `MolProcessor.ts` (basic) | Add **Automated Loop Modeling, Gasteiger/Kollman Charge Assignment, Protonation States (pH 7.4)** |
| **Structural Alignment** | `align` (sequence-aware) & `super` (structural superposition) | Kabsch SVD (`Alignment.ts`) | Add **Per-residue RMSD Heatmaps, Superposition Matrices, Sequence-Independent Super** |
| **UX / Interface** | Dual-window Qt interface + CLI | Single sidebar | Add **MS Office / PyMOL Ribbon Top Action Bar** for instant 1-click access to all tools |

---

## Part 3: Proposed Architecture for MolStudio

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MolStudio Architecture                          │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                Top Ribbon Action Bar (UI Layer)                  │  │
│  │  [File & I/O] [Display & Render] [Selection] [Prep] [Docking]    │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     │                                  │
│  ┌──────────────────────────────────▼───────────────────────────────┐  │
│  │             PyMOL Command Interpreter (cmd.ts)                   │  │
│  │  • Maps UI clicks & CLI to PyMOL-compatible command calls        │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     │                                  │
│  ┌──────────────────────────────────▼───────────────────────────────┐  │
│  │            Web-Native Compute & Visualization Layer              │  │
│  │  ├── 3Dmol.js (WebGL rendering)                                  │  │
│  │  ├── Extended SelectionParser.ts (Full PyMOL Algebra)            │  │
│  │  ├── Advanced Interactions.ts (H-bonds, π-stacking, salt-bridges)│  │
│  │  └── Extended MolProcessor.ts (Full DSSP, Loop Repair, Prep)    │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     │ REST / WebSocket                 │
│  ┌──────────────────────────────────▼───────────────────────────────┐  │
│  │            Backend C++ / Python Compute Engine                   │  │
│  │  ├── RDKit Python (Gasteiger charges, 3D conformers)             │  │
│  │  └── MolDock C++ Engine (Native Vina-like scoring + BFGS)        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Part 4: Detailed Module-by-Module Implementation Plan

### Module 1: The Top Ribbon Bar (MS Office / PyMOL Style UI)
- **File**: [StudioRibbonBar.tsx](file:///d:/Projects/Molexplorer/src/components/StudioRibbonBar.tsx)
- **Tab 1: File & I/O** — Open PDB/SDF/MMTF, fetch from RCSB PDB, export PDB, save session (`.pse`).
- **Tab 2: Display & Render** — 1-click toggle for Cartoon, Sticks, Spheres, Surface, Mesh, Dots, Putty. Color schemes (Spectrum, Element, Chain, SS, B-Factor).
- **Tab 3: Selection & Query** — PyMOL query bar + quick preset buttons (`hetatm`, `water`, `helices`, `sheets`, `pocket`).
- **Tab 4: Protein Prep** — Water stripping, hydrogen addition, bond tolerance slider, DSSP mode selector.
- **Tab 5: Docking** — Auto-suggest grid box, box dimension controls, launch docking.
- **Tab 6: Alignment** — PDB fetch target, Kabsch alignment, RMSD readout.

### Module 2: Enhanced Selection Engine (`SelectionParser.ts`)
Upgrade `SelectionParser.ts` to support full PyMOL query keywords:
- `around <dist> of <sel>` (atoms within distance, excluding selection)
- `within <dist> of <sel>` (atoms within distance, including selection)
- `byres <sel>` (expand selection to complete residues)
- `bychain <sel>` (expand selection to complete chains)
- `ss <h|s|l>` (select by secondary structure)

### Module 3: Advanced Interaction Engine (`Interactions.ts`)
Expand contact detection beyond simple distance:
- **Hydrogen Bonds**: Distance ($\le 3.5\text{\AA}$) AND Donor-Hydrogen-Acceptor angle ($\ge 120^\circ$).
- **Salt Bridges**: Anionic (Asp/Glu) to Cationic (Lys/Arg/His) distance ($\le 4.0\text{\AA}$).
- **$\pi$-$\pi$ Stacking**: Centroid-to-centroid distance of aromatic rings ($\le 5.5\text{\AA}$) + ring plane angle (parallel vs. T-shaped).
- **Halogen Bonds**: Distance ($\le 3.8\text{\AA}$) to Lewis base acceptors.

### Module 4: Complete Protein Prep (`MolProcessor.ts`)
- Full implementation of Kabsch & Sander DSSP algorithm for hydrogen-bond energy matrix calculation.
- Valence-based hydrogen perception for all 20 standard amino acids + nucleic acids.
- Alternate location (altloc) filtering choosing highest occupancy.

---

## Part 5: Verification & Testing Plan

### Automated Tests
1. **Selection Parser Test**: Verify queries like `resn ALA and chain A around 5 of (resi 10)` return identical atom sets to PyMOL.
2. **Interaction Engine Test**: Validate H-bond and salt-bridge counts against known PDB benchmark complexes (e.g. 1HVR).
3. **PDBQT Generation Test**: Verify native PDBQT text format compatibility with AutoDock Vina inputs.

### Manual Verification
1. Load `1HVR.pdb` into MolStudio.
2. Test Ribbon Bar tab switches, representation toggles, and color scheme changes.
3. Test auto-suggest grid box around co-crystallized ligand.
4. Verify non-covalent interaction overlays render accurately.
