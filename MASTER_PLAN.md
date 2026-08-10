# MolExplorer / MolStudio — Master Implementation Plan
## A Custom Molecular Docking Platform: Complete Architecture, Scientific Engine Design, and Execution Roadmap

**Version:** 1.1
**Date:** August 8, 2026
**Audience:** Project owner, and any human or AI coding agent (Antigravity, Claude Code, Cursor, etc.) executing this plan.
**Purpose of this document:** This is the single source of truth for what MolExplorer/MolStudio is, why it is built the way it is, and exactly what to build next, in what order, with what acceptance criteria. Every other architecture document in this repository (`ARCHITECTURE.md`, the various `docs/reports/*.md` files) should be considered **superseded** by this document once it is adopted. Do not create a sixth conflicting architecture narrative — update this file instead.

**Standard applied throughout:** every scientific claim, equation, and design decision in this document is written to the standard a computational biophysicist/bioinformatician would hold it to — correct units, correct physical reasoning, and no hand-waved approximation presented as more rigorous than it is. Where a simplification is made for engineering-pragmatic reasons (e.g., an empirical scoring function instead of full quantum mechanics), that trade-off is stated explicitly rather than hidden.

## Changelog
- **v1.2 (Current revision):** Integrated Phase 3 scientific docking engine benchmarks and UI/UX biophysics enhancements: CPK pure-white hydrogen rendering, 3D atom labeling, illustrative/computed electron cloud density shells, universal 7-format export modal (`.pdb`, `.pdbqt`, `.sdf`, `.xyz`, `.pse.json`, `.png`, `.csv`), AltLoc conformer filtering, dynamic covalent bond tolerance, and mobile touch navigation.
- **v1.1:** Oracle Cloud + Cloudflare Pages provider-agnostic infrastructure abstraction.
- **v1.0:** Initial master plan, reconciling architectural audits.

---

# Table of Contents

1. Executive Summary
2. Reconciling the Two Prior Audits — What's Right, What's Wrong, What's Missing
3. Non-Negotiable Principles
4. Target System Architecture (Five Layers)
5. Domain Model
6. Scientific Engine — Detailed Design
7. Representation System (Rendering Strategy Pattern)
8. State Management Architecture
9. File Parsing Subsystem
10. Asynchronous Job & Compute Architecture
11. Backend Architecture (C++ / Drogon)
12. Infrastructure & Deployment
13. Build System & CI/CD
14. Performance Architecture
15. Error Handling Architecture
16. Security Considerations
17. Scientific Validation & Benchmarking Plan
18. Accuracy Tiers
19. Extensibility Model (Internal Plugin Interface)
20. Phased Delivery Roadmap
21. Glossary of Technical and Scientific Terms
22. Guidelines for Coding Agents Executing This Plan
23. Provider-Agnostic Infrastructure Abstraction
24. Provider Comparison Matrix
25. Testing Strategy
26. Monitoring & Observability
27. Disaster Recovery & Backup
28. API Versioning & Data Migration Strategy
29. Team Onboarding / Contributor Guide
30. Licensing & Attribution Considerations
31. Open Questions for the Project Owner
32. Appendix: Current-State File Reference

---

# 1. Executive Summary

MolExplorer (public molecular viewer/education tool) and MolStudio (authenticated molecular workbench) are two frontends sharing one scientific and computational foundation. The long-term goal is a **custom, self-owned docking and molecular-analysis engine** — not a wrapper around RDKit, Open Babel, AutoDock Vina, PyMOL, or UniDock — deployed as:

- **Two static frontends** on Cloudflare Pages (MolExplorer, MolStudio), running entirely in the user's browser for visualization and interaction.
- **One C++ backend** on an Oracle Cloud server, responsible for authentication, job orchestration, and the actual docking/scientific computation.
- **An asynchronous job model**, so a docking run survives the user closing their laptop or phone, and can be retrieved from any device afterward.

This document defines the complete target architecture, the internal design of the scientific engine (including the actual equations and algorithms involved), the infrastructure plan, and a phased roadmap that a coding agent can execute step by step without ambiguity.

---

# 2. Reconciling the Two Prior Audits — What's Right, What's Wrong, What's Missing

You received two independent architectural reviews of this codebase — one from this assistant (with direct file/line evidence from the uploaded repository), and one from a separate AI session (a more generic, textbook-style architectural checklist). Below is an honest reconciliation, because building on a wrong premise wastes real engineering time.

## 2.1 Where the two audits agree (high confidence — act on these)

| Finding | Status |
|---|---|
| Scientific/domain logic and rendering logic are too tightly mixed (e.g., `CoreViewer3D.tsx` contains color/style logic alongside rendering) | Confirmed by both — fix in Section 4.5 / 7 |
| There is no formally separated "scientific engine" module — calculations are embedded in UI-adjacent files (`SelectionParser.ts`, `Interactions.ts`) | Confirmed by both — fix in Section 6 |
| Global state is scattered/inconsistent between the two apps | Confirmed by both — fix in Section 8 |
| The project should not depend on RDKit/Open Babel/Vina/PyMOL as **runtime** dependencies for its own core engine | Confirmed by both, and by your own explicit instructions |
| Docking should be an asynchronous, queued job, not a synchronous browser computation | Confirmed by both — fix in Section 10 |
| Large molecular structures need explicit performance handling (LOD, workers, caching) — not addressed anywhere in the current code | Confirmed by both — fix in Section 14 |

## 2.2 Where the other audit was not fully accurate — verified against your actual repository

This assistant re-checked every specific technical claim from the other audit directly against your uploaded files before including it here. Two claims did not hold up:

**Claim: "PyMOL integration" exists as an architectural component, needing a "PyMOL Adapter."**
**Verified finding: this is a mischaracterization.** There is no PyMOL software dependency anywhere in the codebase — no `pymol` package in `package.json`, no import of any PyMOL library in `src/` or `backend/`. What actually exists is a **PyMOL-*inspired* selection query language** — your app has its own native TypeScript parser (`SelectionParser.ts`) that accepts PyMOL-style selection syntax (e.g., `byres (resn LIG around 5)`) as a **familiar syntax choice for users who know PyMOL**, not as a call into real PyMOL software. There is nothing to "adapt" because there is no external PyMOL engine being wrapped. **Correction for this plan:** we keep the PyMOL-style selection *syntax* (it's a good, recognizable DSL choice for your users — see Section 6.3), but we do **not** build a "PyMOL adapter" in the plugin sense, because there is no PyMOL runtime to adapt to.

**Claim: "Cloudflare uses Bun... deployment uses Wrangler," presented as a confirmed build-system inconsistency.**
**Verified finding: partially unsubstantiated.** There is no `wrangler.toml`/`wrangler.jsonc` anywhere in the repository, and the only CI/CD pipeline present (`.github/workflows/ci.yml`) uses `npm ci`/`npm run build` for the frontend and `pip`/`pytest` for the backend — no Bun step anywhere in CI. **What *is* real and worth fixing:** the repository root contains **both** `package-lock.json` and `bun.lock` simultaneously — two different package managers have been used against the same `package.json` at different points, which is a genuine, verifiable inconsistency (dependency resolution can silently differ between the two). The specific "Wrangler" claim appears to be an inference rather than something found in a file — treat it as unconfirmed unless you know of a Wrangler-based deploy step this assistant didn't have access to.

## 2.3 Valuable additions from the other audit not covered in the original review here

These are good, and are folded into this plan:

- **Explicit domain modeling** (`Protein → Chain → Residue → Atom`, rather than loosely-typed `atoms: any[]` as currently exists in the Zustand store) — adopted in Section 5.
- **Representation Strategy Pattern** for render styles (Cartoon/Surface/Stick/Ball-and-stick/Dots) instead of large conditional blocks — adopted in Section 7.
- **Categorized error-handling architecture** (rendering vs. parsing vs. network vs. scientific-validation vs. deployment vs. user-input errors) — adopted in Section 15.
- **Explicit configuration management strategy** — adopted in Section 12.

## 2.4 Where this plan deliberately does *not* follow the other audit

The other audit proposed a full **plugin/adapter architecture for third-party docking engines** (PyMOL adapter, UniDock adapter, AutoDock Vina adapter, "future adapter"). **This plan does not adopt that**, for a direct reason: you have stated, repeatedly and explicitly, that the goal is your *own* engine, independent of third-party docking tools. Building a formal multi-adapter plugin system is solving the opposite problem — *how to support several third-party engines interchangeably* — which is real engineering effort spent on a capability you don't want. Instead, Section 19 defines a much lighter **internal** engine interface: one clean boundary between "the rest of the app" and "the scoring/search implementation," so that *your own* engine's internals can evolve (v1 empirical scoring → v2 your own scoring function → v3 ML-based scoring) without changing any calling code. This gets you the real benefit (swappable internals, testability) without building infrastructure for a multi-vendor scenario you've explicitly rejected.

---

# 3. Non-Negotiable Principles

These constraints apply to every decision in this document and should not be silently violated by any future change:

1. **No third-party engine dependency in the shipped, runtime scoring/search path.** RDKit, Open Babel, and AutoDock Vina may be used *offline*, during development, purely as a **validation baseline** (Section 17) — never invoked in the production request path.
2. **The frontend never computes docking results.** It renders, collects input, and displays output. All docking computation happens server-side.
3. **Every docking job is asynchronous.** No endpoint blocks a request while docking executes. A job's lifecycle must be fully independent of whether the submitting client is still connected.
4. **One state mechanism, not two.** MolExplorer and MolStudio must read/write view state through the same store fields.
5. **One architecture document.** This file is the source of truth; superseded documents get archived, not left contradicting it.

---

# 4. Target System Architecture (Five Layers)

```
┌─────────────────────────────────────────────────────────────┐
│  1. PRESENTATION LAYER                                        │
│     MolExplorer (Cloudflare Pages)  |  MolStudio (Cloudflare Pages) │
│     React + TypeScript UI, no scientific computation           │
└───────────────────────────┬─────────────────────────────────┘
                             │ HTTPS (JSON + file upload)
┌───────────────────────────▼─────────────────────────────────┐
│  2. APPLICATION / ORCHESTRATION LAYER  (Oracle server, C++)   │
│     Auth · Job creation · Status/result endpoints · Rate limits│
└───────────────────────────┬─────────────────────────────────┘
                             │ enqueues
┌───────────────────────────▼─────────────────────────────────┐
│  3. SCIENTIFIC DOMAIN LAYER  ("the engine" — C++)              │
│     Structure Prep │ Measurement │ Interactions │ Docking Core │
│     Validation │ Clustering/Ranking                            │
└───────────────────────────┬─────────────────────────────────┘
                             │ reads/writes
┌───────────────────────────▼─────────────────────────────────┐
│  4. INFRASTRUCTURE LAYER                                       │
│     Object storage (structures, poses) · Database (jobs, users)│
│     Logging/monitoring · Oracle Cloud primitives                │
└─────────────────────────────────────────────────────────────┘

  (separately, client-side only)
┌─────────────────────────────────────────────────────────────┐
│  5. RENDERING LAYER  (inside the Presentation Layer, browser)  │
│     3Dmol-based viewer · Representation strategies · Camera     │
│     Renders what the Scientific Domain Layer computed —         │
│     never computes scientific results itself                    │
└─────────────────────────────────────────────────────────────┘
```

**Layer 5 is deliberately drawn separately from Layer 1** even though both run in the browser: Layer 1 is "the app" (routing, panels, forms, state), Layer 5 is specifically "turning molecule data into pixels." Keeping this distinction in the code (separate modules, not separate deployables) is what prevents the "god component" problem seen in the current `CoreViewer3D.tsx`.

## 4.1 Presentation Layer — responsibilities
- File upload UI, molecule browsing/search, chain/residue/atom selection UI
- Job submission form (docking parameters, accuracy tier selection — Section 18)
- Job status/history dashboard ("My Jobs")
- Result inspection: pose viewer, score table, interaction diagram, export
- **Must not:** compute distances/angles/scores/docking poses itself — it may do trivial, purely cosmetic math (e.g., camera interpolation), but never anything that could be called a "result"

## 4.2 Application/Orchestration Layer — responsibilities
- `POST /auth/login`, `POST /auth/register` (or a suitable auth provider)
- `POST /jobs` — accepts uploaded files + parameters, validates, stores, enqueues, returns `job_id`
- `GET /jobs/{id}` — status + result reference
- `GET /jobs` — user's job history
- `GET /jobs/{id}/download` — result file(s)
- Enforces file-size limits, rate limits, and auth on every route
- **Must not:** run docking computation inline in the request handler

## 4.3 Scientific Domain Layer — responsibilities
The actual engine. Fully detailed in Section 6. Runs inside worker processes, invoked by the orchestration layer, never invoked directly by any client request.

## 4.4 Infrastructure Layer — responsibilities
- Object storage: raw uploads, prepared receptor/ligand files, result poses, logs
- Relational database: users, jobs (status, timestamps, parameters), audit trail
- Structured logging (see Section 15) and basic monitoring/alerting

## 4.5 Rendering Layer — responsibilities
- Given molecule + representation settings, produce the 3D scene
- Implements the Representation Strategy Pattern (Section 7)
- Reacts to selection/highlight state; never derives selection logic itself (that's the domain layer's `SelectionParser`, called via the store, not duplicated in the renderer)

---

# 5. Domain Model

Replace loosely-typed structures (`atoms: any[]`) with an explicit domain model. This is the same data model on both the C++ engine side and the TypeScript frontend side (kept in sync manually or via a shared schema — see Section 12.4).

```typescript
// Conceptual domain model — implement equivalently in C++ structs on the backend

interface Atom {
  id: number;                 // 1-indexed serial number from the source file
  element: string;            // e.g. "C", "N", "O", "Fe"
  name: string;                // PDB atom name, e.g. "CA", "OD1"
  position: Vector3;           // x, y, z in Angstroms
  partialCharge?: number;      // assigned during structure prep (Section 6.1), not guessed from the atom name
  bFactor?: number;
  altLoc?: string;
  isHetatm: boolean;
}

interface Bond {
  atomA: number;                // Atom.id
  atomB: number;                // Atom.id
  order: 1 | 1.5 | 2 | 3;       // aromatic bonds use 1.5
}

interface Residue {
  id: number;                   // sequence number within the chain
  name: string;                 // three-letter code, e.g. "ALA", or ligand code
  atoms: Atom[];
  bonds: Bond[];
  isStandardAminoAcid: boolean;
  isWater: boolean;
  isIon: boolean;
  isLigand: boolean;
}

interface Chain {
  id: string;                   // PDB chain identifier, e.g. "A"
  residues: Residue[];
  secondaryStructure?: SecondaryStructureAssignment[];
}

interface Molecule {
  id: string;
  source: 'upload' | 'rcsb' | 'generated';
  chains: Chain[];
  ligands: Residue[];            // residues flagged isLigand, surfaced separately for convenience
  waters: Residue[];
  ions: Residue[];
  biologicalAssembly?: AssemblyTransform[];
  metadata: { title?: string; resolution?: number; method?: string; };
}
```

**Why this matters:** with this model, a function like "compute interactions between a ligand and a chain" has a real, typed signature (`(ligand: Residue, chain: Chain) => Interaction[]`) instead of receiving two anonymous blobs of JSON and re-discovering their shape at runtime. This alone would have caught the salt-bridge bug identified earlier (comparing a ligand's `Residue.name` against amino-acid names becomes an obviously wrong type-level comparison once ligands and amino-acid residues are distinct, explicitly-flagged types).

---

# 6. Scientific Engine — Detailed Design

This is the heart of the platform and the part that must be scientifically defensible. Each module below states *what it computes*, *the actual method/equation*, and *what "correct" means for it* — this is the level of detail needed both for you to reason about accuracy claims, and for a coding agent to implement it without guessing.

## 6.1 Structure Preparation Module

**Purpose:** turn a raw uploaded structure file into a chemically complete, analysis-ready `Molecule`.

**Steps, in order:**

1. **Parsing** — see Section 9.
2. **Alternate location resolution** — for atoms with multiple `altLoc` records, keep the highest-occupancy conformer only (configurable).
3. **Solvent/ion handling** — flag waters/ions as such (don't discard by default; let the user choose to strip them).
4. **Hydrogen addition** — this must be **valence- and hybridization-aware**, not a generic geometric guess. For each heavy atom, determine hybridization (sp3/sp2/sp) from its bonding pattern, then place hydrogens at the correct idealized geometry (109.5° tetrahedral for sp3, 120° trigonal planar for sp2, 180° for sp). This directly replaces the previous, less rigorous placement approach and is what all downstream hydrogen-bond geometry (Section 6.3) depends on.
5. **Partial charge assignment** — use a real, documented method:
   - **Gasteiger–Marsili charges** (fast, iterative electronegativity equalization — suitable for real-time/interactive use and for docking scoring)
   - **AM1-BCC** (semi-empirical quantum method with bond-charge corrections — more accurate, too slow for interactive use; reserve for the "Rigorous"/"Research" accuracy tiers, Section 18)
   - **Do not** ship a static per-atom-name lookup table as a stand-in for either of these — if a fallback is ever needed, it must be clearly labeled as an approximation in both code comments and any UI that surfaces the resulting numbers.
6. **Atom typing** — assign each atom a docking atom type (following the well-established AutoDock4/Vina type scheme: e.g., `C` non-polar carbon, `A` aromatic carbon, `N`/`NA` nitrogen (H-bond acceptor or not), `OA` hydroxyl/carbonyl oxygen, etc.) — this typing scheme is a published, standard convention, not proprietary to Vina, and adopting it as a baseline is compatible with "own engine" since it's a data convention, not executable third-party code.

## 6.2 Measurement Engine

Pure, stateless, deterministic functions. Given atom positions, compute:

- **Distance** between atoms A and B: `d = sqrt((xA−xB)² + (yA−yB)² + (zA−zB)²)`
- **Angle** at vertex B, formed by A–B–C: `θ = arccos( (BA·BC) / (|BA||BC|) )`
- **Dihedral (torsion) angle** for four atoms A–B–C–D: computed via the standard atan2 formulation using the normal vectors of planes ABC and BCD — this is what the existing `MolProcessor.ts` already does correctly; keep this implementation.
- **Center of mass**: `COM = Σ(mᵢ · rᵢ) / Σ(mᵢ)` — requires real atomic masses per element, not a placeholder.
- **RMSD** (root-mean-square deviation) between two matched atom sets after optimal superposition (Kabsch algorithm): `RMSD = sqrt( (1/N) · Σ|rᵢ − r'ᵢ|² )`. Used both for alignment quality and for docking pose accuracy assessment against a known reference (Section 17).
- **Radius of gyration, solvent-accessible surface area (SASA)** — reserved for a later stage once the core engine is stable; note them here so they aren't forgotten.

## 6.3 Interaction Detection Engine

Detects non-covalent interactions between two molecular entities (e.g., a docked ligand and its receptor). Fix the specific correctness issue identified in the original code review, and generalize each detector as follows:

- **Hydrogen bonds:** donor–acceptor heavy-atom distance between 2.5–3.5 Å, **and** donor–H···acceptor angle ≥ 120° (using the hydrogens placed correctly per Section 6.1 — the geometry of this detector is only as good as that placement).
- **Salt bridges:** detect by **formal/partial charge sign and magnitude on the relevant functional group** (carboxylate oxygens, phosphate oxygens, protonated amines, guanidinium nitrogens), **not** by matching an atom's parent residue name against a fixed amino-acid list. This is the direct fix for the bug where ligand–protein salt bridges never fired, since a ligand's residue name is never `ASP`/`GLU`/`LYS`/etc.
- **Pi-stacking / cation-π:** aromatic ring centroid + normal vector detection (already implemented reasonably for standard aromatic residues; extend the general ring-finding pass — already present via a DFS-based approach — to be the default path for *all* rings, standard or ligand, rather than a residue-specific special case).
- **Hydrophobic contacts:** carbon–carbon distance below a threshold (typically ~4.5 Å) between nonpolar atoms on both sides.
- **Halogen bonds:** directional interaction between a halogen's σ-hole and a Lewis base, distance- and angle-gated similarly to hydrogen bonds.

**Selection syntax:** keep the existing PyMOL-style selection algebra (e.g., `byres (resn LIG around 5)`) as the query language for the console — it is a good, recognizable DSL choice, entirely implemented natively (no PyMOL software involved), and should remain part of the product.

## 6.4 Docking Engine Core

This is the module that most directly represents "our own engine." Internally organized as a pipeline:

```
Receptor + Ligand (prepared, Section 6.1)
        │
        ▼
   Grid/Search-Space Definition
        │
        ▼
   Pose Generation (Search Algorithm)
        │
        ▼
   Scoring (Scoring Function)
        │
        ▼
   Clustering & Ranking
        │
        ▼
   Ranked poses + scores (the job's result)
```

### 6.4.1 Search space definition
A 3D grid box is defined either automatically (centered on a detected binding pocket, or on the co-crystallized ligand's location if present) or manually by the user. Grid spacing is typically 0.375–1.0 Å depending on the accuracy tier (Section 18).

### 6.4.2 Scoring function
Start with an **empirical scoring function** in the Vina tradition — a weighted sum of physically motivated terms — because it's fast enough for interactive use and well-understood enough to validate against:

`Score = W_vdW · vdW_term + W_hbond · Hbond_term + W_elec · Electrostatic_term + W_hydrophobic · Hydrophobic_term + W_torsion · N_rotatable_bonds`

- **Van der Waals term**: modeled via a Lennard-Jones-like potential, `V(r) = 4ε[(σ/r)¹² − (σ/r)⁶]`, capturing short-range repulsion and longer-range attraction between non-bonded atoms.
- **Electrostatic term**: Coulomb's law, `V(r) = (qᵢqⱼ)/(4πε₀·r)`, using the partial charges from Section 6.1 — this is exactly why static/guessed charges are unacceptable: they propagate directly into this scoring term.
- **Hydrogen-bond term**: a directional correction on top of the general interaction potential, favoring the ideal geometry identified in Section 6.3.
- **Torsional/entropy penalty**: penalizes ligand flexibility (more rotatable bonds → larger conformational entropy cost on binding), following the standard Vina-style linear penalty per rotatable bond.

**Path to a genuinely original scoring function** (post-v1, see Section 20): once the empirical baseline is validated (Section 17), an original contribution can come from (a) re-deriving/re-fitting the term weights against your own curated training data rather than reusing published weights, and/or (b) adding a machine-learned correction term (e.g., a gradient-boosted or graph-neural-network rescoring layer trained on PDBbind) layered on top of the physical terms — this is where "our own engine" becomes a genuinely novel contribution rather than a re-implementation of Vina's published formula.

### 6.4.3 Search algorithm
Recommended v1 approach — **Monte Carlo with local minimization** (the same overall strategy Vina popularized, which is fine to use as an *algorithmic strategy*, since algorithms/strategies aren't the copyrighted or dependency-bound part — only the compiled Vina binary is):

```
repeat N times:
    generate a random ligand pose (translation, rotation, torsion angles)
    perform local energy minimization (e.g., BFGS quasi-Newton) from that pose
    if resulting energy is better than the worst kept pose:
        keep this pose
return the set of kept poses, ranked by score
```

**Alternative/complementary:** a **genetic algorithm** (population of poses, crossover/mutation on the torsion/position vector, selection by fitness = score) — worth implementing as a second search strategy behind the same internal interface (Section 19) so the two can be compared empirically on your benchmark set.

### 6.4.4 Pose clustering & ranking
Cluster generated poses by pairwise RMSD (Section 6.2); report the best-scoring pose from each of the top clusters, not simply the top-N raw poses (which are often near-duplicates of the same binding mode).

## 6.5 Validation Layer
Before any result is returned, the engine checks:
- No steric clashes beyond a tolerance (very short interatomic distances between non-bonded atoms)
- Bond lengths/angles within chemically reasonable ranges
- Chain and residue numbering integrity (no gaps that break connectivity assumptions)
- Reproducibility: running the same job twice with the same random seed gives the same result (important for scientific credibility and for debugging)

---

# 7. Representation System (Strategy Pattern)

Replace large conditional blocks (`if style === 'cartoon' ... else if style === 'surface' ...`) with one interface, implemented per representation:

```typescript
interface RenderStrategy {
  readonly id: 'cartoon' | 'surface' | 'stick' | 'ballAndStick' | 'dots';
  build(molecule: Molecule, options: RenderOptions): SceneGeometry;
}

class CartoonStrategy implements RenderStrategy { /* ... */ }
class SurfaceStrategy implements RenderStrategy { /* ... */ }
class StickStrategy implements RenderStrategy { /* ... */ }
// etc.

const STRATEGIES: Record<string, RenderStrategy> = {
  cartoon: new CartoonStrategy(),
  surface: new SurfaceStrategy(),
  stick: new StickStrategy(),
  ballAndStick: new BallAndStickStrategy(),
  dots: new DotsStrategy(),
};

function render(molecule: Molecule, styleId: string, options: RenderOptions) {
  return STRATEGIES[styleId].build(molecule, options);
}
```

Adding a new representation later means adding one new class and one registry entry — never touching the render dispatch logic itself.

---

# 8. State Management Architecture

**One store, one shape, used identically by both apps.** Organize the existing Zustand store into explicit slices:

- `moleculeSlice` — loaded molecule(s), currently active molecule
- `viewSlice` — render style, color scheme, background, surface opacity (the fields currently duplicated between `MolExplorer.tsx`'s local state and the global store — unify into this slice, used by *both* apps)
- `selectionSlice` — selected atoms/chains/residues, active selection query
- `measurementSlice` — active measurements, labels
- `jobSlice` — submitted docking jobs, their statuses, and results (new — supports Section 10)
- `uiSlice` — panel visibility, active tool, modals

Each slice is a plain object with its own actions; the combined store is their union, exactly as Zustand's slice pattern intends. This is an organizational change to the existing store, not a rewrite of it.

---

# 9. File Parsing Subsystem

Isolate format-specific parsing behind one interface:

```typescript
interface StructureParser {
  readonly formats: string[];      // e.g. ['pdb']
  parse(fileContents: string): Molecule;
}
```

Implement `PDBParser`, `MmCIFParser`, `Mol2Parser`, `SDFParser`, `PDBQTParser` (needed for docking-ready receptor/ligand files) each independently, each producing the same `Molecule` domain object from Section 5. A format-detection step picks the right parser by file extension/content sniffing; nothing downstream needs to know which parser ran.

---

# 10. Asynchronous Job & Compute Architecture

*(Full detail already established in the prior conversation; restated here for completeness as part of the single source of truth.)*

**Core principle:** submission, execution, and retrieval are three independent phases. Closing the browser/device affects only phases 1 and 3 — never phase 2.

```
Client submits job  →  Job queued (DB)  →  Worker executes (server-side,
   (uploads files,        (status:            independent of client)
    gets job_id)           "queued")               │
                                                     ▼
                                          Results stored, status: "completed"
                                                     │
                                                     ▼
                              Client checks back anytime, any device,
                                fetches results using job_id
```

**Notification options, layered by robustness against a fully offline device:**
1. Polling + a bookmarkable job-ID URL (baseline — build this regardless of anything else)
2. Email with a results link (best for "closed the laptop, came back two days later")
3. Browser web push (works with tab closed, not with device powered off)
4. WebSocket/SSE live progress (best for the "watching it run" experience, irrelevant to the offline case)

**Recommendation:** build #1 and #2 first.

---

# 11. Backend Architecture (C++ / Drogon)

Per your explicit direction, the backend is **entirely C++**, using the **Drogon** framework for HTTP/routing/JSON, with no secondary language in the request path.

```
backend/
├── CMakeLists.txt
├── src/
│   ├── main.cpp
│   ├── controllers/
│   │   ├── AuthController.cpp/.h
│   │   ├── JobController.cpp/.h        // POST /jobs, GET /jobs/{id}, GET /jobs
│   │   └── DownloadController.cpp/.h
│   ├── models/                          // Drogon ORM models mapped to DB tables
│   │   ├── User.h
│   │   └── Job.h
│   ├── engine/                          // The Scientific Domain Layer, Section 6
│   │   ├── structure_prep/
│   │   ├── measurement/
│   │   ├── interactions/
│   │   ├── docking/
│   │   │   ├── grid.cpp/.h
│   │   │   ├── scoring.cpp/.h
│   │   │   ├── search_monte_carlo.cpp/.h
│   │   │   ├── search_genetic.cpp/.h
│   │   │   └── clustering.cpp/.h
│   │   └── validation/
│   ├── worker/
│   │   └── JobWorker.cpp/.h             // polls the jobs table, invokes engine/
│   └── storage/
│       ├── ObjectStorageClient.cpp/.h
│       └── Database.cpp/.h
└── tests/
```

**API surface:**

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/register`, `/auth/login` | account management |
| POST | `/jobs` | upload receptor+ligand, create job, return `job_id` |
| GET | `/jobs/{id}` | job status + result reference once complete |
| GET | `/jobs` | current user's job history |
| GET | `/jobs/{id}/download` | download result files |

**Database schema (minimum viable):**

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE jobs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  status TEXT CHECK (status IN ('queued','running','completed','failed')) NOT NULL DEFAULT 'queued',
  accuracy_tier TEXT NOT NULL,
  receptor_path TEXT NOT NULL,
  ligand_path TEXT NOT NULL,
  result_path TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);
```

---

# 12. Infrastructure & Deployment

> **Status note (v1.1):** Oracle Cloud + Cloudflare Pages is the current leading candidate, not a finalized decision. Everything below is written as the *current reference implementation*; **Section 23 defines the abstraction layer** that keeps the rest of this document (Sections 1–11, 13–22) valid regardless of which provider is ultimately chosen. If you're implementing this plan, build against the interfaces in Section 23 first, and treat the specifics below as one concrete implementation of those interfaces — not as hardcoded assumptions baked into application code.

## 12.1 Compute
- **Oracle Cloud, Ampere A1 (Always Free), current allocation: 2 OCPU / 12 GB RAM** (reduced from 4 OCPU/24 GB on June 15, 2026; instances above the new limit are being resized/shut down starting **August 18, 2026** — verify your instance's shape against this before that date).
- Two small Always Free AMD micro-instances (1/8 OCPU, 1 GB RAM each) remain available separately — suitable only as a lightweight secondary node (e.g., running the API layer while the Ampere A1 is dedicated to the worker), not for docking compute itself.
- **No GPU is available in the Always Free tier** — the "Research" accuracy tier (Section 18) must be explicitly scoped as a future paid/opt-in capability, not assumed to run on the current infrastructure.

## 12.2 Frontends
Both MolExplorer and MolStudio build to static assets and deploy on **Cloudflare Pages**. They call the Oracle-hosted API over HTTPS; CORS must be configured on the backend to allow both Pages domains explicitly (not a wildcard, for security — see Section 16).

## 12.3 Storage
- Oracle Object Storage: uploaded structures, prepared files, result poses
- A single Postgres instance (or SQLite for the earliest MVP) for job/user metadata

## 12.4 Configuration Management
One `.env`/config schema, documented in one place (a `CONFIG.md` or equivalent), covering: database connection string, object storage credentials, CORS allowed origins, job timeout limits, max upload size, per-tier resource limits. Do not let configuration continue to be implicitly spread across `docker-compose.yml`, `railway.toml`, and ad hoc `.env.example` values with no single explanation of what each one does.

---

# 13. Build System & CI/CD

**Verified current state:** GitHub Actions (`ci.yml`) builds the frontend with `npm ci`/`npm run build` (Node 22) and tests the backend with `pip`/`pytest` (Python 3.12), then builds Docker images for both. **Both `package-lock.json` and `bun.lock` exist simultaneously in the repo root** — a real, confirmed inconsistency.

**Fix:**
1. Pick one package manager (npm, matching what CI already uses) and delete the other lock file; add a `packageManager` field to `package.json` and a CI step that fails the build if the wrong lock file is present.
2. Once the backend is rebuilt in C++ (Section 11), replace the `pip`/`pytest` CI job with a CMake build + C++ test job (e.g., via Catch2 or GoogleTest).
3. Add a Cloudflare Pages deployment step (via the official Cloudflare Pages GitHub Action) for both frontend builds, so deployment is explicit and versioned in CI rather than manual.
4. Add an Oracle deployment step (SSH + systemd service restart, or a container registry push + pull) for the backend, so backend releases are also driven by CI rather than manual server access.

---

# 14. Performance Architecture

For structures with tens to hundreds of thousands of atoms:
- **Level-of-detail (LOD) rendering** — simplified geometry at high zoom-out, full detail on zoom-in
- **Geometry caching** — don't regenerate the same representation's geometry on every re-render if nothing relevant changed
- **Web Workers** for expensive client-side computation (e.g., large selection queries) so the main UI thread never blocks
- **Chunked/streamed loading** for very large files instead of blocking on a single full parse
- **GPU-accelerated rendering** — already partially available via 3Dmol's WebGL usage; ensure representation strategies (Section 7) don't bypass this with CPU-side geometry generation where a GPU approach is available (e.g., surface generation)

---

# 15. Error Handling Architecture

Define distinct error categories instead of one generic error type, so failures are diagnosable at a glance:

```typescript
type AppError =
  | { kind: 'ParsingError'; format: string; detail: string; }
  | { kind: 'ValidationError'; field: string; detail: string; }      // e.g. bad geometry, Section 6.5
  | { kind: 'NetworkError'; endpoint: string; status?: number; }
  | { kind: 'RenderingError'; component: string; detail: string; }
  | { kind: 'JobError'; jobId: string; stage: string; detail: string; }
  | { kind: 'AuthError'; detail: string; }
  | { kind: 'UserInputError'; field: string; detail: string; };
```

Every layer (Section 4) throws/returns errors typed this way; the UI can then render category-appropriate messaging (e.g., a parsing error suggests re-checking the file format; a job error links to job history) instead of one generic "Something went wrong."

---

# 16. Security Considerations

- File upload validation: enforce format allow-lists and size limits *before* any parsing begins (parsing untrusted, unvalidated files is itself a risk surface)
- Authentication on every job-related endpoint; jobs are only retrievable by their owner (or via an unguessable job ID for anonymous use, if you choose to support that tier)
- CORS restricted to the exact Cloudflare Pages domains, not `*`
- Rate limiting on job submission to prevent free-tier resource exhaustion by a single user or bot
- Job timeouts — a stuck/runaway docking job must not block the worker pool indefinitely

---

# 17. Scientific Validation & Benchmarking Plan

An "industry-level" claim requires measured evidence, not just working code:

- **PDBbind** (core + refined sets) — standard protein-ligand complexes with known structures and measured binding affinities; use as training/reference data.
- **CASF-2016** — the standard scoring-function benchmark, testing four capabilities:
  - *Docking power*: can the engine reproduce the correct binding pose? (Standard metric: % of cases with RMSD < 2 Å between predicted and crystallographic pose.)
  - *Scoring power*: does the predicted score correlate with experimentally measured binding affinity? (Pearson/Spearman correlation.)
  - *Ranking power*: for a set of ligands against one target, can the engine correctly order them by potency?
  - *Screening power*: can the engine enrich true binders out of a decoy library? (ROC-AUC, enrichment factor at 1%/5%/10%.)
- **DUD-E / LIT-PCBA** — decoy sets specifically for virtual-screening enrichment testing.

**Practical validation loop:** run the same benchmark structures through both your own engine and a reference (Vina, used here strictly as an *offline validation baseline*, never as a runtime dependency — consistent with Section 3's non-negotiables) and report the comparison honestly. This is what "scientific study backend" means in practice — a documented, reproducible comparison against the field's accepted yardsticks.

---

# 18. Accuracy Tiers

A first-class, user-facing feature rather than a hidden internal parameter:

| Tier | Scoring | Sampling | Typical time | Use case |
|---|---|---|---|---|
| **Fast/Screening** | Empirical (Section 6.4.2) | Low exhaustiveness | Seconds/ligand | Triaging thousands of candidates |
| **Standard** | Empirical | Higher exhaustiveness, multiple seeds | Minutes/ligand | Default single-target docking |
| **Rigorous** | Empirical + physics-based rescoring of top poses | High | Minutes–tens of minutes | Shortlist refinement |
| **Research** | MD-based or free-energy refinement | Very high | Hours | Final candidate validation — **requires GPU, not available on the current free-tier plan; scope as a future paid/opt-in tier** |

---

# 19. Extensibility Model (Internal Plugin Interface)

Not a multi-vendor adapter system (Section 2.4) — a single internal seam so your own engine's components can evolve independently:

```cpp
class IScoringFunction {
public:
    virtual double score(const Pose& pose, const Receptor& receptor) const = 0;
    virtual ~IScoringFunction() = default;
};

class EmpiricalScoringV1 : public IScoringFunction { /* Section 6.4.2 */ };
class MLRescoringV2 : public IScoringFunction { /* future */ };

class ISearchAlgorithm {
public:
    virtual std::vector<Pose> search(const Receptor&, const Ligand&, const SearchParams&) const = 0;
    virtual ~ISearchAlgorithm() = default;
};

class MonteCarloSearch : public ISearchAlgorithm { /* Section 6.4.3 */ };
class GeneticAlgorithmSearch : public ISearchAlgorithm { /* Section 6.4.3 alternative */ };
```

This lets you A/B two search strategies or two scoring versions against the same benchmark set (Section 17) without touching the job orchestration or API layers at all.

---

# 20. Phased Delivery Roadmap

**Phase 0 — Stop active harm (days, not weeks):**
- Stop loading unused OpenBabel/Vina WASM bundles on every page
- Fix the salt-bridge detection logic
- Relabel or fix the mislabeled charge-table-based dipole calculation

**Phase 1 — Frontend consolidation (finish what's in progress):**
- Unify view-state between MolExplorer and MolStudio into one store slice (Section 8)
- Extract the domain model (Section 5) and retrofit existing code to use it instead of loose `any` types
- Split oversized files (`CoreViewer3D.tsx`, `MolStudio.tsx`, `SelectionParser.ts`) along the responsibility lines defined in Sections 6–8

**Phase 2 — Backend v1: async pipeline + existing engine, wired correctly:**
- Stand up the C++/Drogon API skeleton (Section 11) with `/jobs` endpoints
- Worker invokes the *existing* Vina/OpenBabel binaries server-side (not yet your own scoring/search) — the goal here is a correct, honest, end-to-end pipeline first
- Fix the build-system inconsistency (Section 13) as part of this phase, since new CI jobs are being added anyway

**Phase 3 — Your own engine, v1:**
- Implement structure prep (real hydrogens + Gasteiger charges), the empirical scoring function, and Monte Carlo search (Section 6) behind the `IScoringFunction`/`ISearchAlgorithm` interfaces
- Benchmark against CASF-2016 immediately (Section 17); compare honestly against the Vina baseline from Phase 2

**Phase 4 — Differentiation and scale:**
- Add accuracy tiers (Section 18) as a real product surface
- Explore an ML-based rescoring layer trained on PDBbind
- Scale the worker pool and, if justified by usage, move the "Research" tier to a GPU-backed paid offering

---

# 21. Glossary of Technical and Scientific Terms

**AM1-BCC** — A semi-empirical quantum chemistry method (AM1) with bond-charge corrections (BCC), used to estimate partial atomic charges more accurately than simpler methods, at higher computational cost.

**Atom typing** — Assigning each atom a category (e.g., aromatic carbon, hydrogen-bond-accepting oxygen) used by a scoring function to know which physical rules apply to it.

**Binding pocket** — The region of a receptor's surface where a ligand is expected to bind, typically a cavity with favorable shape and chemistry.

**CASF (Comparative Assessment of Scoring Functions)** — A standardized benchmark suite (notably CASF-2016) used across the field to measure docking/scoring/ranking/screening performance on a common, agreed-upon set of structures.

**Cation-π interaction** — A non-covalent attraction between a positively charged group and the electron-rich face of an aromatic ring.

**Center of mass (COM)** — The mass-weighted average position of a set of atoms; used as a reference point for measurements and grid placement.

**Coulomb's law** — The physical law describing the electrostatic force/energy between two charges, inversely proportional to the distance between them.

**Dihedral (torsion) angle** — The angle describing rotation around a bond, defined by four sequentially bonded atoms; determines a molecule's 3D conformation around that bond.

**Drogon** — A high-performance C++ web application framework, used here to implement the backend API without introducing a second programming language.

**Enrichment factor** — In virtual screening, how much better than random a method is at ranking true binders near the top of a candidate list.

**Exhaustiveness** — A docking search parameter controlling how thoroughly the conformational space is sampled; higher values improve accuracy at the cost of speed.

**Force field** — A set of mathematical functions and parameters (e.g., AMBER, CHARMM) describing the potential energy of a molecular system as a function of atomic positions.

**Gasteiger–Marsili charges** — A fast, iterative method for estimating partial atomic charges based on electronegativity equalization; a reasonable default for interactive/real-time use.

**Genetic algorithm** — An optimization method inspired by natural selection: a population of candidate solutions evolves via selection, crossover, and mutation toward better fitness (here, better docking scores).

**Hybridization (sp3/sp2/sp)** — The geometric arrangement of an atom's bonding orbitals, determining ideal bond angles (109.5°, 120°, 180° respectively) — required to place hydrogens correctly.

**Kabsch algorithm** — A method for finding the optimal rotation that minimizes the RMSD between two sets of paired points (e.g., aligning two conformations of the same molecule).

**Lennard-Jones potential** — A mathematical model of the van der Waals interaction between two non-bonded atoms, combining short-range repulsion and longer-range attraction.

**Ligand** — A small molecule (or sometimes a peptide) that binds to a larger biomolecule (the receptor), typically the molecule being "docked."

**Monte Carlo method** — An optimization/sampling strategy that uses repeated random sampling to explore a space of possibilities, often paired with local refinement.

**PDBbind** — A curated database of protein-ligand complexes with both 3D structures and experimentally measured binding affinities, widely used to train and benchmark scoring functions.

**Pi-stacking** — A non-covalent interaction between two aromatic rings, typically stacked face-to-face or edge-to-face.

**Pose** — A specific 3D position, orientation, and conformation of a ligand relative to a receptor, generated during docking.

**Ranking power** — A scoring function's ability to correctly order a set of related ligands by their relative binding strength against one target.

**Receptor** — The larger biomolecule (usually a protein) that a ligand binds to.

**RMSD (root-mean-square deviation)** — A measure of the average distance between corresponding atoms in two structures (or two poses of the same structure); the standard metric for pose accuracy.

**Salt bridge** — An electrostatic interaction between two oppositely charged functional groups (e.g., a carboxylate and a protonated amine) at close range.

**Scoring function** — A mathematical model that estimates the binding affinity or favorability of a given pose; the "judge" of docking quality.

**Search algorithm** — The method used to generate candidate poses to be scored (e.g., Monte Carlo, genetic algorithm).

**Van der Waals interaction** — A relatively weak, distance-dependent attractive/repulsive force between all atoms, arising from transient electron distribution asymmetries.

---

# 22. Guidelines for Coding Agents Executing This Plan

If you are an AI coding agent (Antigravity, Claude Code, or similar) implementing this plan:

1. **Work one phase (Section 20) at a time**, and within a phase, one numbered task at a time. Do not attempt multiple phases in a single pass.
2. **Do not modify** files explicitly marked "keep in place" in prior planning documents (`MolProcessor.ts`'s core parsing/geometry, `Alignment.ts`) unless a specific task in this document says otherwise.
3. **Run `tsc --noEmit` (frontend) or the C++ build (backend) after every change** and treat any new compiler error as a blocking regression before proceeding.
4. **Every task that changes scoring, charges, or interaction detection must include or update a test** that encodes the expected scientific behavior (e.g., "a known salt-bridge-forming pair must be detected"), not just "the code runs without crashing."
5. **When a design choice in this document is ambiguous for your specific implementation context, stop and ask**, rather than silently substituting a different library, framework, or third-party dependency than the ones named here (Drogon, Gasteiger charges, Monte Carlo search, etc.) — those choices were made deliberately and are recorded with their reasoning in this document, not arbitrary defaults to be swapped.
6. **If you discover this document conflicts with the actual repository state**, report the discrepancy rather than silently resolving it in either direction.

---

# 23. Provider-Agnostic Infrastructure Abstraction

**Governing rule:** no application code — not the C++ backend, not the frontend — calls a cloud provider's proprietary SDK directly. Every provider touchpoint goes through a small interface, implemented once per provider. Swapping Oracle for AWS, GCP, Azure, or a plain self-hosted VPS later should be a matter of writing one new implementation of each interface and changing environment variables — never a rewrite of business logic.

### 23.1 Compute abstraction
```cpp
class IComputeHost {
public:
    // Not literally called at runtime by the app — this describes the
    // deployment contract every host must satisfy, documented here so
    // infrastructure-as-code (Terraform/Ansible/shell scripts) for any
    // provider can be written against the same checklist.
    virtual bool providesPersistentLinuxVM() const = 0;
    virtual int  availableCores() const = 0;
    virtual int  availableRamGb() const = 0;
    virtual bool hasGpu() const = 0;
    virtual ~IComputeHost() = default;
};
```
Current implementation: `OracleAmpereA1Host` (2 OCPU / 12 GB, no GPU, Always Free). Equally valid future implementations: `AwsEc2Host`, `GcpComputeEngineHost`, `AzureVmHost`, `SelfHostedVpsHost` (e.g., Hetzner, DigitalOcean). **The requirement any of these must satisfy:** a persistent Linux process that can run 24/7 independent of any client connection (Section 10's non-negotiable). Anything meeting that bar is a valid host.

### 23.2 Object storage abstraction
Standardize on the **S3-compatible API** as the common language, since Oracle Object Storage, AWS S3, Backblaze B2, and self-hosted MinIO all speak it (GCP Cloud Storage supports an S3-compatibility mode too). This means one client library, configured with a different endpoint/credentials per provider — not separate integration code per provider.
```cpp
class IObjectStorage {
public:
    virtual void putObject(const std::string& bucket, const std::string& key, const std::vector<uint8_t>& data) = 0;
    virtual std::vector<uint8_t> getObject(const std::string& bucket, const std::string& key) = 0;
    virtual void deleteObject(const std::string& bucket, const std::string& key) = 0;
    virtual ~IObjectStorage() = default;
};
```

### 23.3 Static frontend hosting abstraction
Keep both frontends as **pure static SPAs with zero platform-specific edge functions**. Cloudflare Pages, Vercel, Netlify, and GitHub Pages all reduce to the same contract: "take this build output folder, serve it over HTTPS, redeploy on push." As long as no code depends on a Cloudflare-specific API (e.g., Cloudflare Workers KV, Durable Objects), moving hosts is a dashboard/config change, not a code change.

### 23.4 Database abstraction
Use standard Postgres wire-protocol connectivity (via Drogon's ORM or a plain client library) rather than a provider-managed database's proprietary extensions. Oracle Autonomous DB, AWS RDS for Postgres, GCP Cloud SQL, a self-hosted Postgres container, and Supabase are all interchangeable from the application's point of view as long as only standard SQL/Postgres features are used.

### 23.5 Configuration as the actual swap mechanism
All provider identity lives in environment variables, read once at startup:
```
COMPUTE_PROVIDER=oracle          # oracle | aws | gcp | azure | self-hosted
OBJECT_STORAGE_ENDPOINT=...
OBJECT_STORAGE_ACCESS_KEY=...
OBJECT_STORAGE_SECRET_KEY=...
DATABASE_URL=postgresql://...
FRONTEND_DEPLOY_TARGET=cloudflare-pages   # or vercel | netlify | github-pages
```
No code should branch on `COMPUTE_PROVIDER`'s value except in the thin adapter layer itself (Sections 23.1–23.4) — the rest of the system just calls the interface.

---

# 24. Provider Comparison Matrix

Evaluated against this project's actual needs: a persistent (not serverless/ephemeral) compute node for the worker pool, generous free compute, and no hard time limit on the free tier.

| Provider | Always-free compute | Free tier duration | GPU on free tier | Object storage free allowance | Notes |
|---|---|---|---|---|---|
| **Oracle Cloud (current pick)** | 2 OCPU / 12 GB Ampere A1 (reduced from 4/24 on Jun 15, 2026; enforcement Aug 18, 2026) + 2 micro AMD VMs | **Indefinite** ("Always Free," not a 12-month trial) | No | 20 GB (Always Free) | Best fit for a long-running worker process at zero cost; the one meaningful risk is Oracle unilaterally changing free-tier terms again, as it just did |
| AWS | 1 `t2.micro`/`t3.micro` equivalent | **12 months only**, then billed | No (free tier) | 5 GB (12 months) | Time-limited — not a fit for an indefinite free deployment without eventually paying |
| GCP | 1 `e2-micro` (US regions only) | **Indefinite**, smaller machine than Oracle's | No | 5 GB | A legitimate fallback if Oracle's terms worsen further; noticeably less compute than Oracle's current offer |
| Azure | `B1s` equivalent | **12 months only**, then billed | No | Limited | Similar time-limit issue to AWS |
| Self-hosted VPS (Hetzner/DigitalOcean) | None free | N/A — paid from day one (~$4–6/month) | No (without add-on) | N/A (pair with backblaze/S3) | Not free, but fully predictable pricing and no risk of a provider silently changing "free tier" terms again |

**Recommendation given the 99%-but-not-100% status:** proceed with Oracle as primary (it remains the strongest free compute offer even after the June 2026 reduction), but build strictly to the Section 23 interfaces so that if Oracle's terms change again, GCP's `e2-micro` (indefinite free tier) or a low-cost VPS are both drop-in fallbacks rather than a redesign.

---

# 25. Testing Strategy

- **Scientific unit tests** — known-answer tests for every Measurement Engine function (Section 6.2): e.g., a hand-calculable distance/angle/dihedral on a small synthetic structure, asserted against the exact expected value, not just "doesn't crash."
- **Interaction-detection regression tests** — specific known salt-bridge, H-bond, and pi-stacking pairs (real PDB examples) that must always be detected, directly guarding against the class of bug found in the original audit.
- **Pipeline integration tests** — submit a job, simulate the client disconnecting mid-job (kill the request without cancelling server-side), assert the job still reaches `completed` and is retrievable in a fresh session.
- **Scientific regression suite (scheduled, not per-commit)** — a CASF-2016 subset run nightly or weekly in CI, tracked over time so a code change that quietly degrades docking accuracy is caught even though it wouldn't fail a normal unit test.
- **Frontend regression** — `tsc --noEmit` on every commit (already true today — preserve this).

---

# 26. Monitoring & Observability

- Structured logs (one JSON line per event, not free-text) tagged by category matching Section 15's error taxonomy, so failures are searchable by kind.
- Per-job timing metrics (queue wait time, execution time, by accuracy tier) — this is what tells you whether the free-tier compute allocation (Section 24) is actually sufficient for real usage.
- A simple external uptime check (e.g., a free-tier uptime monitor pinging `/health`) so an Oracle-side outage or resize event is noticed immediately, not discovered when a user complains.
- Worker health check endpoint distinct from the API's — a stuck worker (Section 16's timeout concern) should be independently detectable.

---

# 27. Disaster Recovery & Backup

- Scheduled database backups (daily is sufficient at this scale), stored in object storage separate from the primary instance.
- Object storage lifecycle policy: define how long raw uploads and result files are retained before automatic deletion, both for cost control and user privacy.
- A documented, tested restore procedure — "we have backups" is not equivalent to "we've verified the backups restore correctly."
- **Directly relevant near-term risk:** the Oracle free-tier reduction enforcement on August 18, 2026 could resize or reclaim an over-allocated instance. Take a full backup and confirm your instance's shape against the new 2 OCPU/12 GB limit *before* that date, independent of anything else in this roadmap.

---

# 28. API Versioning & Data Migration Strategy

- Prefix all endpoints with a version from day one: `/v1/jobs`, `/v1/auth/login`, etc. — this costs nothing now and avoids breaking any existing client (including your own frontend) when the API evolves later.
- Database schema changes go through versioned migration scripts (a simple numbered SQL migration folder is theoretical at this scale — no need for a heavyweight migration framework yet), so the schema's history is reconstructable and repeatable across environments.
- If the underlying provider changes (Section 24), data migration means exporting from one object-storage/database endpoint and importing to another — this is straightforward specifically because Section 23 kept access behind standard interfaces (S3 API, Postgres wire protocol) rather than provider-proprietary formats.

---

# 29. Team Onboarding / Contributor Guide

Minimum viable onboarding documentation (even for a solo project, this pays off the first time you return to the code after a break):
1. How to run the frontend locally (`npm install && npm run dev`).
2. How to build and run the backend locally (CMake build steps, required environment variables).
3. Where this document lives and that it is the single source of truth for architecture decisions.
4. How to run the test suite (Section 25) before committing.
5. A one-paragraph "if in doubt" pointer: check Section 22 (Guidelines for Coding Agents) and Section 31 (Open Questions) before introducing a new dependency or architectural pattern not already described here.

---

# 30. Licensing & Attribution Considerations

Worth addressing explicitly, since "our own engine, independent of RDKit/Open Babel/Vina" is a stated goal with real legal texture, not just a technical preference:

- **Algorithmic strategies are not owned by anyone** — Monte Carlo search, genetic algorithms, Lennard-Jones potentials, and Coulomb's law are general scientific/mathematical knowledge, published in the open literature. Using these *strategies* in your own original implementation is not a licensing concern.
- **Source code is different from strategy.** AutoDock Vina is Apache 2.0 licensed (permissive — can be referenced/learned from freely, but don't copy its source directly into a codebase you intend to call "your own engine" without attribution if any code is actually reused). **Open Babel is GPL-licensed** — GPL code carries copyleft obligations if linked into a distributed product; since the stated goal is independence from Open Babel at runtime anyway (Section 3), this is naturally resolved by not linking against it in the production engine, but be aware if any current utility code was adapted from Open Babel's source, that specific code should not ship in the final "own engine" product without separately satisfying GPL terms.
- **Benchmark datasets** (PDBbind, CASF, DUD-E) typically have their own citation/usage terms for academic use — check each dataset's current license/citation requirement before publishing benchmark results, especially if this work is heading toward a thesis or publication.
- **Standard conventions are not proprietary.** Adopting the AutoDock4/Vina atom-typing scheme (Section 6.1) as a data convention is not a licensing issue — it's using a published, standard vocabulary, the same way using SI units isn't "depending on" whoever first proposed them.

---

# 31. Open Questions for the Project Owner

These materially affect scope and are worth deciding explicitly rather than defaulting silently:

1. **Access model:** should job submission require an account (supports the email-notification path in Section 10, and per-user job history), or should anonymous, job-ID-only access be supported as well (simpler, but weaker for the "come back later" experience)?
2. **Expected scale at launch:** roughly how many concurrent users/jobs should the MVP be designed for? This directly determines whether the single-worker, database-backed queue (Section 20, Phase 2) is sufficient for launch or whether Redis/multiple workers should be pulled forward.
3. **Timeline constraint:** is there a fixed deadline (e.g., a thesis defense date) that should reorder the phased roadmap (Section 20) — for instance, prioritizing a demoable Phase 2 pipeline before investing in Phase 3's original scoring function?
4. **GPU budget:** is any paid GPU compute realistically in scope later (for the "Research" accuracy tier, Section 18), or should that tier be treated as permanently out of scope for this deployment?
5. **Publication intent:** will benchmark results (Section 17) or the engine itself be presented academically or published? This affects how rigorously Section 30's licensing/citation obligations need to be tracked from the start, rather than reconstructed later.

---

# 32. Appendix: Current-State File Reference

| File | Current role | Disposition in this plan |
|---|---|---|
| `src/lib/MolProcessor.ts` | PDB parsing, geometry, assembly transforms | Keep; source for Section 9's `PDBParser` and Section 6.2 |
| `src/lib/Interactions.ts` | Interaction detection | Keep, fix salt-bridge logic per Section 6.3 |
| `src/lib/Alignment.ts` | Structural alignment | Keep as-is |
| `src/lib/SelectionParser.ts` | Selection query parsing + dipole/Ramachandran calc | Split: keep parser, extract biophysics into a dedicated module, fix charge model per Section 6.1 |
| `src/components/CoreViewer3D.tsx` | 3D rendering | Refactor per Section 7 (extract styling/color logic) |
| `src/pages/MolExplorer.tsx`, `MolStudio.tsx` | App pages | Unify state per Section 8 |
| `backend/app/**` (current FastAPI stub) | Mock scaffolding, never called | Replace entirely per Section 11 |
| `public/docking/{vina,openbabel}.*` | Unused WASM bundles loaded on every page | Move server-side per Phase 2; stop loading client-side per Phase 0 |
| `.github/workflows/ci.yml` | CI (npm + pip/pytest + Docker) | Update per Section 13 as the backend moves to C++ |
| `package-lock.json` + `bun.lock` (both present) | Package-manager inconsistency | Resolve to one, per Section 13 |
