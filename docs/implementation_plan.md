# Molexplorer — Strategic Architecture & Vision Document

> **Codename**: MolecularSuite  
> **Current State**: Browser-only SPA (React + WebAssembly)  
> **Target State**: Full-stack Cheminformatics Platform with Native Docking Engine  

---

## Part 1: What Molexplorer Is Today

### 1.1 The Core Idea

Molexplorer is a **browser-based Computational Aided Drug Design (CADD) and structural biology platform** with two primary workspaces:

| Workspace | Purpose | Key Features |
|---|---|---|
| **MolExplorer** | Small molecule library management | Upload SDF/PDB/MOL files, compute RDKit descriptors (MW, LogP, TPSA, HBD, HBA), Lipinski filtering, Tanimoto similarity, SMARTS substructure search, 2D/3D visualization |
| **MolStudio** | Macromolecular structural biology | Fetch PDB structures, protein preparation (strip water, add H, DSSP), structural alignment (Kabsch + Needleman-Wunsch), interactive molecular docking (AutoDock Vina via WebAssembly), biological assembly generation |

### 1.2 Complete Data Flow

```
[Input Sources]
  ├── Local Files (.pdb, .sdf, .mol, .mmtf)
  ├── External APIs (PubChem REST, NCI Cactus, RCSB PDB)
  └── Manual SMILES Input
         │
         ▼
[Core State (React)] ─────────────────────────────────┐
  ├── MolExplorer: MoleculeData[]                      │
  └── MolStudio: molData, cleaningState, assemblyState │
         │                                             │
    ┌────┴────┐                                        │
    ▼         ▼                                        ▼
[Compute (WASM + JS)]                      [Visualization (3Dmol.js WebGL)]
  ├── RDKit WASM                             ├── Viewer3D (small molecules)
  │    ├── 2D SVG rendering                  │    ├── Stick/Ball/Surface/VDW
  │    ├── SMARTS matching                   │    ├── Distance/Angle/Dihedral
  │    ├── Descriptors (MW, LogP, TPSA)      │    └── SMARTS highlight overlays
  │    └── Morgan Fingerprints / Tanimoto    │
  │                                          ├── MolStudioViewer (macromolecules)
  ├── OpenBabel WASM                         │    ├── Cartoon/Ribbon/Surface
  │    └── PDB → PDBQT conversion            │    ├── Grid box overlay (docking)
  │                                          │    └── Biological assembly rendering
  ├── Webina (Vina WASM)                     │
  │    └── Full docking simulation           │
  │                                          │
  ├── MolProcessor.ts (Native JS)            │
  │    ├── PDB/MMTF parsing                  │
  │    ├── Spatial hash bond perception      │
  │    ├── DSSP secondary structure          │
  │    └── Hydrogen addition (valence-based) │
  │                                          │
  ├── Alignment.ts                           │
  │    ├── Needleman-Wunsch (sequence)       │
  │    └── Kabsch SVD (structural RMSD)      │
  │                                          │
  ├── SelectionParser.ts                     │
  │    └── PyMOL-like query language          │
  │                                          │
  └── Interactions.ts                        │
       └── H-bond / hydrophobic detection    │
```

### 1.3 Module Inventory

#### `src/lib/` — Core Computational Logic

| File | Lines | Purpose |
|---|---|---|
| [MolProcessor.ts](file:///d:/Projects/Molexplorer/src/lib/MolProcessor.ts) | ~849 | **The powerhouse.** PDB/MMTF parsing, spatial hash bond perception, DSSP secondary structure, hydrogen addition, solvent stripping, PDB regeneration |
| [Docking.ts](file:///d:/Projects/Molexplorer/src/lib/Docking.ts) | ~312 | Orchestrates molecular docking: PDB→PDBQT conversion (direct + OpenBabel fallback), Webina WASM initialization, Virtual File System for I/O |
| [Alignment.ts](file:///d:/Projects/Molexplorer/src/lib/Alignment.ts) | ~150 | Needleman-Wunsch sequence alignment + Kabsch SVD structural alignment (via `ml-matrix`) |
| [BoxDragLogic.ts](file:///d:/Projects/Molexplorer/src/lib/BoxDragLogic.ts) | ~150 | 3D mouse interaction → grid box resize/translate in the 3Dmol viewer |
| [SelectionParser.ts](file:///d:/Projects/Molexplorer/src/lib/SelectionParser.ts) | ~150 | Recursive descent parser for PyMOL-style atom selection queries |
| [Interactions.ts](file:///d:/Projects/Molexplorer/src/lib/Interactions.ts) | ~70 | Geometric heuristics for H-bond and hydrophobic contact detection |
| [rdkit.ts](file:///d:/Projects/Molexplorer/src/lib/rdkit.ts) | ~30 | Singleton async loader for RDKit WASM from CDN |
| [utils.ts](file:///d:/Projects/Molexplorer/src/lib/utils.ts) | ~5 | Tailwind `cn()` utility |

#### `src/components/` — UI Components

| File | Size | Purpose |
|---|---|---|
| [Viewer3D.tsx](file:///d:/Projects/Molexplorer/src/components/Viewer3D.tsx) | 47KB | 3Dmol.js wrapper for small molecules — styles, colors, measurements, density surfaces |
| [MolStudioViewer.tsx](file:///d:/Projects/Molexplorer/src/components/MolStudioViewer.tsx) | 22KB | 3Dmol.js wrapper for macromolecules — cartoon rendering, grid box, biological assemblies |
| [SidebarLeft.tsx](file:///d:/Projects/Molexplorer/src/components/SidebarLeft.tsx) | 9KB | Input panel: file upload, SMILES entry, PubChem/PDB fetch |
| [SidebarRight.tsx](file:///d:/Projects/Molexplorer/src/components/SidebarRight.tsx) | 8KB | Molecule details, property display, style controls |
| [FilterPanel.tsx](file:///d:/Projects/Molexplorer/src/components/FilterPanel.tsx) | 7.5KB | Property range sliders for Lipinski filtering |
| [LibraryTable.tsx](file:///d:/Projects/Molexplorer/src/components/LibraryTable.tsx) | 9.6KB | Sortable molecule table with Tanimoto similarity |
| [ExportModal.tsx](file:///d:/Projects/Molexplorer/src/components/ExportModal.tsx) | 18.5KB | PDF/CSV/SDF/PNG export of results |
| [SketcherModal.tsx](file:///d:/Projects/Molexplorer/src/components/SketcherModal.tsx) | 4.4KB | 2D molecule sketcher integration |
| [QueryBar.tsx](file:///d:/Projects/Molexplorer/src/components/QueryBar.tsx) | 2.2KB | Selection query input bar |
| [Toolbar.tsx](file:///d:/Projects/Molexplorer/src/components/Toolbar.tsx) | 6.2KB | Viewer control toolbar |

#### `src/pages/` — Application Pages

| File | Size | Purpose |
|---|---|---|
| [MolExplorer.tsx](file:///d:/Projects/Molexplorer/src/pages/MolExplorer.tsx) | 15KB | Small molecule workspace orchestrator |
| [MolStudio.tsx](file:///d:/Projects/Molexplorer/src/pages/MolStudio.tsx) | **68KB** | Macromolecular workspace — protein prep, docking, alignment, assembly. **The single largest file.** |

#### External Service Dependencies

| Service | Used For | Risk Level |
|---|---|---|
| **RCSB PDB** (`files.rcsb.org`) | Fetching macromolecular structures | 🟢 Low — stable public infrastructure |
| **PubChem PUG REST** | Fetching small molecule SDFs by CID/Name | 🟢 Low — NIH infrastructure |
| **NCI Cactus** | SMILES → 3D coordinate generation | 🟡 Medium — sometimes unreliable/slow |
| **RDKit WASM** (CDN `unpkg.com`) | Core cheminformatics engine | 🔴 High — CDN dependency for core functionality |
| **Webina/Vina WASM** | Molecular docking engine | 🔴 High — third-party WASM, if discontinued = no docking |
| **OpenBabel WASM** | PDBQT format conversion | 🔴 High — WASM from local assets, but still external dependency |

---

## Part 2: Architectural Issues & Technical Debt

### 2.1 Critical Architectural Flaws

> [!CAUTION]
> **Flaw #1: God-Object Anti-Pattern**
> [MolStudio.tsx](file:///d:/Projects/Molexplorer/src/pages/MolStudio.tsx) is **68KB / ~1800+ lines** in a single file. It manages protein preparation state, docking state, visualization state, biological assembly logic, structure fetching, and UI rendering all in one component. This is unmaintainable.

> [!CAUTION]
> **Flaw #2: Zero Backend = Zero Scalability**
> ALL computation (docking, descriptor calculation, DSSP, alignment) runs on the user's browser thread. A single docking run on a moderately-sized protein can freeze the browser for 5-10 minutes. This cannot scale to virtual screening of 1000+ ligands.

> [!WARNING]
> **Flaw #3: CDN Dependency for Core Compute**
> RDKit WASM is loaded from `unpkg.com`. If that CDN goes down, the entire application's cheminformatics engine is dead. Same risk with Webina. These should be self-hosted or bundled.

> [!WARNING]
> **Flaw #4: No State Management**
> All state lives in React component `useState` hooks, with massive prop-drilling chains. There is no global state management (no Zustand, no Redux, no Context pattern). Refactoring any data flow requires touching 5+ files.

> [!WARNING]
> **Flaw #5: Weak Type Safety**
> Heavy use of `any` types throughout, particularly in `Viewer3D.tsx`, `MolStudioViewer.tsx`, and `Docking.ts`. This defeats TypeScript's purpose and makes refactoring dangerous.

### 2.2 Additional Issues

| Issue | Severity | Description |
|---|---|---|
| **No Web Workers** | High | All CPU-intensive tasks (MolProcessor parsing, DSSP, alignment) run on the main UI thread, causing freezes |
| **No Error Boundaries** | Medium | A single failed molecule parse can crash the entire app |
| **Mock Electron Density** | Medium | The "volumetric density" rendering is a Gaussian approximation, not real quantum mechanical density |
| **Fragile Interaction Detection** | Medium | `Interactions.ts` uses only distance-based heuristics — no angle constraints, no π-stacking, no salt bridges |
| **No Testing** | High | Zero unit tests, zero integration tests. The test files at project root are all experimental scratch scripts |
| **No CI/CD** | High | No GitHub Actions, no automated builds, no linting pipeline |
| **No Authentication** | Medium | No user accounts, no saved sessions, no shareable links |

---

## Part 3: The Competitive Landscape

### 3.1 Open-Source Docking Engines

| Engine | Language | Scoring Method | Speed | Accuracy (RMSD) | License | GPU? |
|---|---|---|---|---|---|---|
| **AutoDock Vina** | C++ | Empirical (gauss + hydrophobic + HBond) | Baseline | Industry standard | Apache 2.0 | ❌ |
| **Uni-Dock** | C++/CUDA | Vina/AD4 scoring on GPU | **1000-2000x Vina** | Equivalent to Vina | Open-source | ✅ |
| **AutoDock-GPU** | C++/OpenCL/CUDA | AD4 on GPU | 100-300x | Equivalent | GPL | ✅ |
| **GNINA** | C++ (Caffe/CUDA) | CNN rescoring over Vina search | ~Vina speed | **Better pose ranking** | GPL | ✅ |
| **Smina** | C++ | Customizable Vina potentials | ~Vina | Tunable per target | GPL | ❌ |
| **rDock** | C++ | Empirical + solvation + pharmacophore | Fast | Very good for HTS | LGPL | ❌ |
| **DiffDock** | Python (PyTorch) | Diffusion model (generative) | Very fast | High but physically invalid poses | MIT | ✅ |
| **Boltz-2** | Python | AI structure prediction + docking | Fast | State of art (2025-2026) | Open | ✅ |

### 3.2 How AutoDock Vina Actually Works

Understanding this is critical for building our own engine:

1. **Search Algorithm**: Iterated Local Search (ILS)
   - Generate random ligand pose (translation + rotation + torsion angles)
   - Run **BFGS quasi-Newton** local optimization (gradient descent on energy surface)
   - Accept/reject via Metropolis criterion
   - Repeat `exhaustiveness` times

2. **Scoring Function** (5 terms):
   $$E_{total} = w_1 \cdot E_{gauss1} + w_2 \cdot E_{gauss2} + w_3 \cdot E_{repulsion} + w_4 \cdot E_{hydrophobic} + w_5 \cdot E_{HBond} + w_6 \cdot N_{rot}$$
   
   - $E_{gauss1}, E_{gauss2}$: Attractive VdW (Gaussian decay at different widths)
   - $E_{repulsion}$: Steric clash penalty (quadratic repulsion below cutoff)
   - $E_{hydrophobic}$: Favorable overlap of hydrophobic atoms
   - $E_{HBond}$: Directional hydrogen bonding (distance + angle)
   - $N_{rot}$: Flexibility penalty (entropy cost of freezing rotatable bonds)

3. **Grid Maps**: Pre-computed 3D grids of receptor atom potentials. Instead of calculating N×M atom-atom interactions per evaluation, you look up the grid value at the ligand atom's position → O(M) instead of O(N×M).

### 3.3 Business Landscape

| Company | Annual License | Market Position |
|---|---|---|
| **Schrödinger** | $50K–$100K+ enterprise | Dominant full-stack CADD platform |
| **OpenEye (Cadence)** | $30K–$80K | Cloud-native physics-based tools |
| **Chemical Computing Group (MOE)** | $40K–$60K | Integrated medicinal chemistry suite |
| **Certara** | $20K–$50K | ADMET/PK focused |
| **BioSolveIT** | $15K–$30K | FlexX docking, SeeSAR visualization |

**Market Size**: Drug Discovery Informatics is ~$4B in 2025, projected $7–8B by 2034. The broader computational drug discovery market is $10B+.

> [!IMPORTANT]
> **The Gap**: There is NO open-source, full-stack, web-accessible platform that combines: molecular visualization + native docking engine + descriptor analytics + library management + protein preparation — all in one unified product. Molexplorer is uniquely positioned to fill this gap.

---

## Part 4: C++ vs Python — The Engine Decision

### 4.1 Performance Reality

| Operation | Python (RDKit) | C++ (Native) | Ratio |
|---|---|---|---|
| Parse 10K molecules (SDF) | ~8 sec | ~0.3 sec | **27x** |
| Single docking (Vina-like) | N/A (calls C++ binary) | ~30-120 sec | — |
| 1000 ligand virtual screen | ~24 hours (serial) | ~2 hours (8-core) | **12x** |
| GPU batch dock (Uni-Dock) | N/A | ~2 minutes for 10K | **720x vs serial** |

### 4.2 Recommendation: Hybrid Architecture

> [!TIP]
> **The answer is BOTH.** This is what every successful computational chemistry platform does.

```
┌─────────────────────────────────────────────────┐
│                  C++ Layer                       │
│  ┌───────────────┐  ┌────────────────────────┐  │
│  │ Docking Engine │  │ RDKit C++ (descriptors,│  │
│  │ (Custom Vina-  │  │  fingerprints, SMARTS, │  │
│  │  like scoring) │  │  conformer generation) │  │
│  └───────┬───────┘  └──────────┬─────────────┘  │
│          │                     │                 │
│          └──────────┬──────────┘                 │
│                     │                            │
│            C++ Shared Libraries (.so/.dll)        │
└─────────────────────┬───────────────────────────┘
                      │ Python bindings (pybind11)
┌─────────────────────┴───────────────────────────┐
│                  Python Layer                     │
│  ┌──────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │ FastAPI       │  │ Celery      │  │ NumPy/  │ │
│  │ REST API      │  │ Task Queue  │  │ Pandas  │ │
│  │ + WebSockets  │  │ + Redis     │  │ Analysis│ │
│  └──────────────┘  └─────────────┘  └─────────┘ │
└─────────────────────────────────────────────────┘
```

**C++ for**: The docking engine core, scoring function evaluation, BFGS optimization, grid map computation, conformer generation. These are inner-loop operations called millions of times per docking run — they MUST be native.

**Python for**: The API server (FastAPI), job orchestration (Celery/Redis), data pipeline (preparing inputs, collecting results), machine learning integration (PyTorch for CNN rescoring), database operations, and analysis/reporting.

---

## Part 5: The Vision — What We're Building

### 5.1 Product Definition

**MolecularSuite** is an **open-source, self-hosted, full-stack computational drug discovery platform** that provides:

1. **MolExplorer** — Chemical library management, descriptor computation, similarity search, SMARTS filtering, and 2D/3D visualization
2. **MolStudio** — Protein structure preparation, visualization (cartoon/surface/ribbon), structural alignment, and secondary structure analysis
3. **MolDock** ⭐ *(NEW — The Native Docking Engine)* — A custom-built molecular docking engine written in C++ with Python bindings, deployable as a standalone server or embedded WASM module
4. **MolAnalytics** *(NEW)* — Statistical analysis dashboard: PCA, clustering, random forests for SAR, ADMET prediction
5. **MolAI** *(NEW)* — Gemini/LLM-powered natural language molecular queries, automated report generation, de novo molecule suggestion

### 5.2 Business Prospect

**As a company**, MolecularSuite addresses the following market realities:

| Problem | Our Solution |
|---|---|
| Schrödinger costs $50K+/year | **Free and open-source** core with optional hosted/enterprise tier |
| Existing tools are desktop-only (PyMOL, ChimeraX) | **Web-native** — accessible from any browser, any device |
| Docking requires CLI expertise (Vina, GNINA) | **GUI-first** — drag-and-drop docking with visual grid box |
| No single platform does visualization + docking + analytics | **Unified platform** — one product, one login, one workflow |
| Academic labs can't afford cloud compute | **Self-hosted** — deploy on your own server or Railway for $5/mo |

**Revenue Model** (future):
- **Open Core**: Free self-hosted version, paid cloud-hosted version
- **Enterprise**: GPU-accelerated virtual screening, priority support, SSO
- **Marketplace**: Plugin ecosystem for custom scoring functions, forcefields
- **API-as-a-Service**: Per-docking-run pricing for pharma companies

### 5.3 Competitive Differentiation

| Feature | Schrödinger | PyMOL | SwissDock | Galaxy | **MolecularSuite** |
|---|---|---|---|---|---|
| Web-based | ❌ | ❌ | Partial | ✅ | ✅ |
| 3D Visualization | ✅ | ✅ | ❌ | ❌ | ✅ |
| Molecular Docking | ✅ | ❌ | ✅ | ✅ (via tools) | ✅ (native engine) |
| Library Analytics | ✅ | ❌ | ❌ | Partial | ✅ |
| Protein Preparation | ✅ | Partial | ❌ | Partial | ✅ |
| AI-Assisted | ✅ | ❌ | ❌ | ❌ | ✅ |
| Open Source | ❌ | Partial | ❌ | ✅ | ✅ |
| Self-Hosted | ❌ | ✅ | ❌ | ✅ | ✅ |
| Cost | $50K+ | Free | Free | Free | **Free** |

---

## Part 6: Proposed Production Architecture

### 6.1 System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                  │
│  React + Vite + TailwindCSS + 3Dmol.js + RDKit WASM (bundled)   │
│  Deployed: Vercel / Railway / Cloudflare Pages                    │
│  Features: Visualization, basic client-side descriptors,          │
│            real-time 3D interaction, selection queries             │
└───────────────────────────┬──────────────────────────────────────┘
                            │ REST API + WebSocket (SSE for jobs)
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                      API GATEWAY                                  │
│  Python FastAPI + Uvicorn                                         │
│  Deployed: Railway / Docker                                       │
│                                                                   │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────────────────────┐ │
│  │ /api/v1/    │ │ /api/v1/     │ │ /api/v1/                   │ │
│  │ molecules   │ │ structures   │ │ docking                    │ │
│  │             │ │              │ │                            │ │
│  │ • Upload SDF│ │ • Fetch PDB  │ │ • Submit docking job       │ │
│  │ • Compute   │ │ • Prep       │ │ • Poll status (WebSocket)  │ │
│  │   descriptors│ │   protein   │ │ • Retrieve results         │ │
│  │ • Similarity│ │ • DSSP       │ │ • Cancel job               │ │
│  │   search    │ │ • Alignment  │ │                            │ │
│  └──────┬──────┘ └──────┬──────┘ └────────────┬───────────────┘ │
│         │               │                      │                 │
└─────────┼───────────────┼──────────────────────┼─────────────────┘
          │               │                      │
          ▼               ▼                      ▼
┌──────────────┐ ┌──────────────┐  ┌─────────────────────────────┐
│  PostgreSQL  │ │  Redis       │  │  COMPUTE WORKERS            │
│  + pgvector  │ │  (Job Queue) │  │  Celery + C++ Engine        │
│              │ │              │  │                             │
│  • Molecules │ │  • Job queue │  │  ┌───────────────────────┐  │
│  • Libraries │ │  • Caching   │  │  │ MolDock Engine (C++)  │  │
│  • Users     │ │  • Sessions  │  │  │ • Vina-like scoring   │  │
│  • Results   │ │              │  │  │ • BFGS optimization   │  │
│  • Projects  │ │              │  │  │ • Grid map generation │  │
│              │ │              │  │  │ • pybind11 → Python   │  │
│              │ │              │  │  └───────────────────────┘  │
│              │ │              │  │                             │
│              │ │              │  │  ┌───────────────────────┐  │
│              │ │              │  │  │ RDKit C++ / Python    │  │
│              │ │              │  │  │ • Conformer gen       │  │
│              │ │              │  │  │ • Descriptor compute  │  │
│              │ │              │  │  │ • Fingerprints        │  │
│              │ │              │  │  └───────────────────────┘  │
└──────────────┘ └──────────────┘  └─────────────────────────────┘
```

### 6.2 Railway Deployment (Multi-Service)

| Service | Runtime | Purpose | Railway Cost |
|---|---|---|---|
| `web` | Node.js / Static | Serve React frontend | ~$5/mo |
| `api` | Python (FastAPI) | REST API + WebSocket gateway | ~$5/mo |
| `worker` | Python + C++ libs | Celery workers for docking/computation | ~$10-20/mo |
| `postgres` | PostgreSQL 16 | Persistent storage | ~$5/mo |
| `redis` | Redis 7 | Job queue + caching | ~$5/mo |
| **Total** | | | **~$25-40/mo** |

### 6.3 The MolDock Engine — Building Our Own Docking Engine

#### Phase 1: Minimum Viable Engine (C++)

```cpp
// Pseudocode for the core scoring function
struct ScoringParams {
    double w_gauss1 = -0.035579;
    double w_gauss2 = -0.005156;
    double w_repulsion = 0.840245;
    double w_hydrophobic = -0.035069;
    double w_hbond = -0.587439;
    double w_nrot = 0.05846;
};

double score(const Ligand& lig, const GridMap& grid) {
    double E = 0.0;
    for (const Atom& a : lig.atoms) {
        // Trilinear interpolation on pre-computed grid
        E += grid.interpolate(a.position, a.type);
    }
    // Intramolecular terms
    E += intramolecular_energy(lig);
    // Flexibility penalty
    E += params.w_nrot * lig.num_rotatable_bonds;
    return E;
}
```

**Core components to implement:**

1. **Molecule I/O** — Parse PDBQT, MOL2, SDF formats (or use RDKit C++ API)
2. **Grid Map Generator** — Pre-compute receptor potential on a 3D grid (0.375Å spacing)
3. **Scoring Function** — 5-term Vina-like empirical function (above)
4. **BFGS Optimizer** — Quasi-Newton local optimizer with analytical gradients
5. **Conformational Sampler** — Monte Carlo / Iterated Local Search
6. **Output** — Ranked poses with binding affinities (kcal/mol)

#### Phase 2: Validation & Accuracy

To ensure results are **comparable to AutoDock Vina**:

1. **PDBbind Benchmark** — Test on the refined set (~5000 protein-ligand complexes)
2. **RMSD Analysis** — Compare re-docking RMSD to crystal poses (target: <2.0Å for >70% cases)
3. **Correlation** — Plot our predicted binding affinity vs. experimental $K_d$ values
4. **PCA + Random Forest** — Analyze which scoring terms contribute most to accuracy, tune weights
5. **Cross-validate** against Vina, GNINA, and Smina on the same test set

#### Phase 3: GPU Acceleration (Future)

Following the Uni-Dock model, batch-process thousands of ligands in parallel using CUDA:
- Move grid map lookups to GPU shared memory
- Parallelize independent Monte Carlo restarts across CUDA blocks
- Target: 1000x speedup over CPU Vina

---

## Part 7: Immediate Refactoring Roadmap

### 7.1 Frontend Architecture Fixes

| Priority | Fix | Effort |
|---|---|---|
| 🔴 P0 | **Break up MolStudio.tsx** — Extract into `useDocking()`, `useProteinPrep()`, `useAlignment()`, `useAssembly()` hooks + child components | 2-3 days |
| 🔴 P0 | **Add global state management** — Zustand store for molecule data, viewer state, docking state | 1-2 days |
| 🔴 P0 | **Bundle WASM locally** — Self-host RDKit WASM, OpenBabel WASM, remove CDN dependency | 1 day |
| 🟡 P1 | **Move compute to Web Workers** — MolProcessor parsing, DSSP, alignment in dedicated workers | 2 days |
| 🟡 P1 | **Add TypeScript strict mode** — Eliminate `any` types, add proper interfaces | 2-3 days |
| 🟡 P1 | **Add Error Boundaries** — React error boundaries around each workspace | 0.5 days |
| 🟢 P2 | **Add unit tests** — Vitest for lib/ functions, React Testing Library for components | 3-5 days |
| 🟢 P2 | **CI/CD** — GitHub Actions for lint, type-check, test, build | 1 day |

### 7.2 Backend Build Sequence

| Phase | Deliverable | Duration |
|---|---|---|
| **Phase 1** | FastAPI server with molecule upload, RDKit descriptor computation, PostgreSQL storage | 1-2 weeks |
| **Phase 2** | Celery + Redis job queue, integrate existing Vina CLI as subprocess docking backend | 1 week |
| **Phase 3** | Build MolDock C++ scoring function + BFGS optimizer, expose via pybind11 | 4-6 weeks |
| **Phase 4** | Validate MolDock against PDBbind, tune scoring weights, publish benchmarks | 2-3 weeks |
| **Phase 5** | Deploy on Railway (multi-service), connect frontend API calls | 1 week |
| **Phase 6** | GPU acceleration (CUDA), virtual screening mode | 4-8 weeks |

---

## Part 8: Key Research References

1. **Trott, O. & Olson, A.J. (2010)**. "AutoDock Vina: Improving the speed and accuracy of docking with a new scoring function." *Journal of Computational Chemistry*, 31(2), 455-461.
2. **McNutt, A.T. et al. (2021)**. "GNINA 1.0: molecular docking with deep learning." *Journal of Cheminformatics*, 13, 43.
3. **Corso, G. et al. (2023)**. "DiffDock: Diffusion Steps, Twists, and Turns for Molecular Docking." *ICLR 2023*.
4. **Yu, Y. et al. (2023)**. "Uni-Dock: GPU-Accelerated Docking Enables Ultralarge Virtual Screening." *JCTC*, 19(11), 3336-3345.
5. **Buttenschoen, M. et al. (2024)**. "PoseBusters: AI-based docking is no substitute for physics." *Chemical Science*.
6. **Paggi, J.M. et al. (2024)**. "The Art and Science of Molecular Docking." *Annual Review of Biochemistry*.

---

## Open Questions for Your Review

> [!IMPORTANT]
> **Q1: Engine First or Platform First?**  
> Do you want to build the C++ docking engine (MolDock) first and then integrate it into the platform? Or deploy the current app with a Vina CLI backend first, then replace Vina with our engine later?

> [!IMPORTANT]
> **Q2: Target Users — Academic or Enterprise?**  
> Academic-first (free, open-source, publish papers) or enterprise-first (SaaS, paid tiers, pharma partnerships)?

> [!IMPORTANT]
> **Q3: GPU from Day One?**  
> Should we design the C++ engine with CUDA from the start, or build CPU-first and add GPU later?

> [!IMPORTANT]
> **Q4: Branding — Keep "Molexplorer" or Rebrand?**  
> The current codebase uses "MolecularSuite" on the home page. Should the company/product use a unified brand name?

## Verification Plan

### Automated Tests
- `pytest` for backend API endpoints
- `vitest` for frontend lib/ unit tests
- PDBbind re-docking benchmarks for MolDock engine validation

### Manual Verification
- Deploy staging environment on Railway
- Test end-to-end docking workflow (upload PDB → prepare → dock → view results)
- Compare MolDock RMSD results against Vina on 50 test cases
