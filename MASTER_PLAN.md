# MolExplorer / MolStudio — Master Scientific & Implementation Plan

**Version:** 2.0  
**Status:** ACTIVE — repository source of truth  
**Date:** 20 August 2026  
**Audience:** Project owner, researchers, and AI/human coding agents  

## 0. Purpose and authority

This file is the single execution authority for the Molexplorer repository. Agents MUST read this file before making architectural or scientific changes. This plan supersedes conflicting implementation roadmaps while preserving validated existing functionality unless a documented decision explicitly changes it.

The project has two coordinated goals:

1. Maintain and extend the existing MolExplorer/MolStudio molecular visualization, analysis, session, and docking application.
2. Build a scientifically governed, PyMOL-compatible semantic workstation and self-owned scientific backend incrementally, without turning the application into a PyMOL clone or adding PyMOL as a runtime dependency.

The project MUST progress through small, verifiable increments. Documentation, implementation, automated testing, and manual scientific validation advance together.

---

## 1. Operating model: research → specification → implementation → verification

Every capability follows this lifecycle:

**Scientific research → scientific specification → repository mapping → implementation → unit tests → integration/E2E tests → manual validation → acceptance gate → next capability.**

No capability is considered complete because a button exists, code compiles, or a screenshot looks correct. Scientific semantics, state integrity, error handling, persistence, and reproducibility must be verified.

### 1.1 Incremental rule

After approximately 2–3 tightly related documentation/design steps, implement at least one complete user-visible or programmatically testable capability. The capability MUST have a manual test procedure and an automated verification path before the next major capability begins.

### 1.2 Stop conditions

An agent MUST stop and request review when:

- the current specification is ambiguous;
- implementation would require a second competing molecular data model;
- a scientific behavior cannot be validated;
- an operation could silently corrupt or reinterpret molecular data;
- an existing acceptance test would need to be weakened or bypassed;
- a proposed change conflicts with this plan or another accepted ADR.

---

## 2. Non-negotiable scientific principles

1. **Scientific source artifacts remain immutable.** Editing produces a derived state/revision.
2. **Coordinates are stored in Ångström and must be finite.**
3. **Topology changes are explicit and validated.**
4. **Viewer interactions are not scientific mutations.** 3Dmol is a renderer/observer, not the scientific authority.
5. **One canonical molecular data model.** Do not introduce a second competing atom/bond/residue/chain model.
6. **One semantic operation path.** GUI, command console, and typed API should resolve to the same canonical operation when a feature is Core.
7. **Fail closed.** Invalid scientific operations return structured errors without mutating authoritative state.
8. **Determinism matters.** The same scientific input, operation, selection, and configuration must produce the same canonical result where determinism is expected.
9. **Provenance is part of scientific state.** Scientific edits must record parent/operation/parameters/output lineage where the provenance layer supports it.
10. **Third-party scientific packages may be used offline for validation when explicitly approved, but they MUST NOT become hidden runtime dependencies of the self-owned scientific engine.**
11. **Do not silently emulate unsupported PyMOL behavior.** Mark behavior as supported, partial, reference-different, unsupported, or deferred.
12. **Tests compare semantics, not screenshots alone.**

These principles are consistent with the supplied PyMOL compatibility specification, which calls for semantic equivalence, immutable source artifacts, deterministic selection/evaluation, validated transactions, provenance, and multi-layer verification.

---

## 3. Documentation system

The repository SHALL use the following hierarchy.

### 3.1 `MASTER_PLAN.md`

Overall system direction, phase order, gates, non-negotiable rules, and current status.

### 3.2 `AGENTS.md`

Agent operating rules, repository safety, scientific rules, implementation workflow, testing/reporting requirements.

### 3.3 `docs/science/`

Scientific contracts and research-backed implementation specifications.

Initial documents:

- `SCIENTIFIC_FOUNDATION.md`
- `DATA_MODEL_SPEC.md`
- `SELECTION_SPEC.md`
- `EDITING_KERNEL_SPEC.md`
- `VALIDATION_SPEC.md`
- `PROVENANCE_SPEC.md`
- `COMMAND_API_SPEC.md`
- `PYMOL_COMPATIBILITY_SPEC.md`
- `PYMOL_COMPATIBILITY_MATRIX.md`

### 3.4 `docs/testing/`

- scientific test architecture
- golden fixtures
- oracle definitions
- manual test procedures
- regression and E2E acceptance criteria

### 3.5 `docs/decisions/`

Architecture Decision Records (ADRs) for decisions that materially affect the scientific model, backend, engine boundary, selection semantics, storage, or compatibility contract.

### 3.6 Documentation rule

Do not create competing master architecture documents. New detail belongs in a focused specification or ADR and must link back to this plan.

---

## 4. Agent governance

Every coding agent MUST:

1. Read `MASTER_PLAN.md`.
2. Read `AGENTS.md`.
3. Inspect the relevant existing implementation before creating new modules.
4. Reuse existing canonical state/models where possible.
5. Identify the exact specification section and acceptance criteria for the task.
6. Implement the smallest complete vertical slice.
7. Add/modify automated tests in the same change.
8. Report files changed, scientific behavior, tests run, results, limitations, and manual verification steps.
9. Never claim tests passed without running them.
10. Never weaken or delete scientific tests merely to make a change pass.

### 4.1 Agent task contract

Every implementation task SHOULD be written as:

- **Goal**
- **Scientific definition**
- **Existing repository components to reuse**
- **Required behavior**
- **Non-goals**
- **Acceptance criteria**
- **Automated tests**
- **Manual test**
- **Expected report**

---

## 5. Current validated baseline

The current application already contains and/or has manually validated substantial functionality, including:

- PDB/local structure loading
- RCSB fetching
- 3Dmol-backed molecular visualization
- atom/residue/ligand/chain/molecule selection
- PyMOL-style selection query console foundations
- PDB and related export workflows
- `.PSE` session save/load workflow
- display/representation controls
- substantial scientific/docking backend work
- browser and Python test infrastructure
- scientific immutability and lifecycle telemetry verification in prior work

Existing functionality MUST be preserved unless an accepted architecture decision changes it.

---

# 6. Master execution roadmap

The roadmap is divided into two coordinated tracks:

- **Track A — Scientific foundation and PyMOL-compatible workstation semantics**
- **Track B — Existing/custom docking and computational engine**

Track A and Track B share the canonical model, provenance, validation, persistence, and test infrastructure.

---

# TRACK A — SCIENTIFIC / PYMOL-COMPATIBLE WORKSTATION

## Phase P0 — Governance and research foundation

### Documentation

Create/update:

1. `AGENTS.md`
2. `docs/science/SCIENTIFIC_FOUNDATION.md`
3. `docs/science/DATA_MODEL_SPEC.md`
4. `docs/testing/SCIENTIFIC_TEST_ARCHITECTURE.md`
5. `docs/science/PYMOL_COMPATIBILITY_SPEC.md`
6. `docs/science/PYMOL_COMPATIBILITY_MATRIX.md`

### Output

A clear mapping of scientific requirements to repository modules, tests, and acceptance gates.

### Acceptance gate P0

- Documentation files exist.
- No conflicting master plan exists.
- Agent rules point to this plan.
- Every proposed capability is classified as Core, Advanced, Research, or Deferred.

---

## Phase P1 — Canonical molecular data model

### Research/specification

Define and freeze semantics for:

- Atom
- Bond
- Residue
- Chain
- Molecule/Object
- State
- Selection
- Revision
- Measurement/derived artifact
- Scene/view state

Define stable identity, coordinates, bond order, residue/chain relationships, HETATM/ligand/water/ion classification, and source-vs-derived state boundaries.

### Implementation

Prefer adapters/types around the existing model first. Do NOT perform a wholesale rewrite unless the implementation audit proves it necessary.

### Automated verification

- canonical model unit tests
- identity tests
- finite-coordinate tests
- topology consistency tests
- serialization round-trip tests

### Manual validation

Use known structures such as `1CRN`, `1UBQ`, `4HHB`, and the existing controlled PDB fixtures.

### Acceptance gate P1

Canonical model behavior is documented, tested, and consumed by at least one real MolStudio workflow.

---

## Phase P2 — Selection Engine v2

This is the first major semantic core and builds directly on the current Selection Query Console.

### Required semantic groups

**Logical:** `and`, `or`, `not`

**Properties:** `name`, `resi`, `resn`, `chain`, `elem`, `id`, `b`, `q`, `alt`, `segi`

**Chemical classes:** `hetatm`, `solvent`, `organic`, `inorganic`, `metals`, `backbone`, `sidechain`, `polymer.protein`, `polymer.nucleic`

**Topological:** `neighbor`, `extend`, `byres`, `bychain`, `bymolecule`

**Spatial:** `within`, `around`, `beyond`, plus approved composite forms

**Lifecycle:** named selections and deterministic replacement/update semantics

### Architecture

`tokenizer → parser → typed AST → validator → deterministic evaluator → canonical SelectionResult`

### Automated verification

Create a selection oracle suite containing exact expected atom IDs and counts for golden fixtures. Include positive, zero-result, syntax-error, and adversarial cases.

### Manual validation

Continue the existing tests and verify semantic equivalence between manual GUI selection and query-based selection.

### Acceptance gate P2

Core selection grammar and evaluator are deterministic, tested, and reusable by downstream editing/analysis code.

---

## Phase P3 — First complete scientific edit: `remove`

This is the first deliberate documentation → implementation → test → manual acceptance vertical slice.

### Research/specification

Define:

- selection resolution
- atom removal
- bond cleanup
- residue/chain consequences
- atom identity policy
- derived-state creation
- provenance
- undo
- serialization
- failure behavior

### Implementation

Implement `remove <selection>` through:

`selection → operation plan → validation → transaction → commit → provenance → renderer`

### Golden fixture

`03_protein_with_ligand.pdb`:

- input = 20 atoms
- ligand = 4 atoms
- expected after ligand removal = 16 atoms

### Manual acceptance

`20 atoms → select ligand (4) → remove → 16 atoms → undo → 20 atoms`

### Gate P3

`remove` is accepted as the first Core scientific editing operation.

---

## Phase P4 — Bond topology editing

Implement and validate:

- `bond`
- `unbond`
- bond-order change
- `valence`
- `cycle_valence`

### Acceptance

Golden topology fixtures, invalid-bond rejection, exact topology changes, undo/redo, export/re-import, and manual MolStudio verification.

---

## Phase P5 — Hydrogen and local chemistry operations

Implement:

- `h_add`
- `h_fill`
- hydrogen removal
- local valence validation

Acceptance includes atom-count, valence, connectivity, and deterministic failure tests.

---

## Phase P6 — Property and coordinate editing

Implement and validate:

- `alter`
- `alter_state`
- coordinate editing
- rename/reindex policy
- approved atom-property changes

Every scientific mutation MUST create a derived state and provenance record where the provenance system is applicable.

---

## Phase P7 — Undo/redo as a revisioned scientific journal

Define revision semantics and implement:

- undo
- redo
- inverse operation equivalence
- state hash/revision checks

Acceptance must prove exact return to prior scientific state, not only visual similarity.

---

## Phase P8 — Provenance and content-addressed lineage

Implement/align:

- parent state/reference hash
- operation name
- normalized arguments
- selection identity
- tool/version metadata
- output hash
- replay metadata

Acceptance includes lineage replay, branch isolation, and no-provenance-loss tests.

---

## Phase P9 — Viewer adapter and state synchronization

Strengthen the existing 3Dmol integration so that:

`authoritative molecular state → viewer adapter → renderer`

and never the reverse.

Implement consistent representation semantics:

- show/hide
- sticks
- spheres
- cartoon
- surface
- labels
- visibility
- camera/view state

Viewer-only operations MUST leave scientific hashes/provenance unchanged.

---

## Phase P10 — Measurements and structural analysis

Unify:

- distance
- angle
- dihedral
- RMS/RMSD
- align
- fit
- pair fitting
- intra-structure RMSD where applicable

Results are derived artifacts with inputs, atom correspondence, algorithm, parameters, and numerical outputs.

---

## Phase P11 — Object/state/session semantics

Extend the already working `.PSE` session system to cover Core object/state behavior:

- create/copy/delete
- group/ungroup where supported
- enable/disable
- multiple states
- session round-trip
- scenes/camera where supported

---

## Phase P12 — Command console and semantic command registry

Generalize the current Selection Query Console into a governed command surface.

Architecture:

`command text → tokenizer/parser → command registry → selection resolver → operation planner → validator → transaction`

GUI, console, and typed API MUST call the same semantic operation layer.

---

## Phase P13 — Compatibility matrix and differential testing

Create a machine-readable compatibility register with:

- command name
- category
- arguments
- selection semantics
- state semantics
- mutation class
- output
- error model
- provenance effects
- GUI affordance
- reference behavior
- test IDs
- status

Statuses:

`IMPLEMENTED | PARTIAL | REFERENCE-DIFFERENT | UNSUPPORTED | DEFERRED`

Where a trustworthy reference implementation is available and licensing permits, perform differential semantic testing. Do not copy proprietary implementation or source.

---

## Phase P14 — Advanced workstation features

Only after the Core track is stable:

- attach/fuse/replace/torsion/rebond
- richer object/state operations
- maps/volumes
- movies/trajectories
- scripting and aliases
- additional PyMOL-compatible commands

Each feature must follow the same incremental gate.

---

# TRACK B — CUSTOM SCIENTIFIC / DOCKING ENGINE

The existing docking architecture remains active and is not replaced by the PyMOL workstream.

## D0 — Scientific backend foundation

Document and verify:

- canonical scientific model
- preparation
- coordinates/units
- interaction model
- scoring/search boundaries
- numerical precision
- backend API contracts
- asynchronous job lifecycle

## D1 — Structure preparation and validation

Build/test deterministic receptor and ligand preparation, validation, normalization, and explicit error handling.

## D2 — Interaction and scoring foundations

Research and document physical/empirical terms separately. Every approximation MUST be identified as such.

## D3 — Search/optimization kernel

Implement the chosen custom search/optimization method behind a stable scientific API.

## D4 — Docking result model

Standardize poses, scores, parameters, provenance, hashes, and result serialization.

## D5 — Scientific benchmark validation

Use frozen benchmark datasets, predefined metrics, numerical oracles, reproducibility tests, and failure analysis. Pilot datasets MUST NOT be presented as final performance evidence unless the benchmark protocol explicitly promotes them.

## D6 — Asynchronous backend execution

Preserve the existing principle that docking computation is server-side and asynchronous. The frontend displays jobs and results; it does not become the scientific compute engine.

---

# 7. Shared architecture between Track A and Track B

Both tracks MUST use the same:

- canonical molecule/data model
- validation policies
- state/revision concepts
- provenance model
- persistence/session model
- test fixtures where scientifically appropriate
- API contracts

Track A MUST NOT create a separate PyMOL molecule model.
Track B MUST NOT create a separate docking-only molecule model when the canonical model is sufficient.

---

# 8. Test architecture

Every Core feature gets four layers where applicable:

1. **Unit test** — pure semantics/math/parser behavior.
2. **Integration test** — module/store/API interaction.
3. **Browser/E2E test** — real UI + viewer path.
4. **Manual scientific test** — owner inspects the actual MolStudio workflow.

### Test categories

- positive cases
- zero-result cases
- malformed-input cases
- adversarial cases
- scientific immutability cases
- serialization round trips
- regression cases
- deterministic replay cases

Tests MUST compare scientific state, not screenshots alone.

---

# 9. Golden fixture policy

Create a stable fixture collection for:

- small single-chain protein
- multi-chain protein
- ligand complex
- metal/water/heteroatom case
- nucleic acid
- bond-editing molecule
- hydrogen/valence case
- large real protein
- docking benchmark cases

Each fixture SHALL have a documented expected atom/bond/selection/topology result where relevant.

---

# 10. Feature completion contract

A feature may be labeled **COMPLETE** only when:

- scientific behavior is defined;
- repository implementation is documented;
- automated tests pass;
- negative/error behavior is tested;
- viewer state is synchronized correctly;
- authoritative scientific state remains intact under viewer-only interactions;
- persistence/export round trips succeed where relevant;
- a manual test has passed;
- limitations are documented;
- the compatibility matrix status is updated.

---

# 11. Versioning and change control

Use this plan versioning model:

- **Major:** roadmap/architecture/phase-order change.
- **Minor:** new milestone, capability family, or acceptance rule.
- **Patch:** clarification with no execution-order change.

Any architectural change MUST be recorded in an ADR and referenced from this file.

---

# 12. Immediate execution queue

The next work SHALL be executed in this exact order:

### Step 1 — Documentation foundation

Create/update:

- `AGENTS.md`
- `docs/science/SCIENTIFIC_FOUNDATION.md`
- `docs/science/DATA_MODEL_SPEC.md`
- `docs/testing/SCIENTIFIC_TEST_ARCHITECTURE.md`
- `docs/science/PYMOL_COMPATIBILITY_SPEC.md`
- `docs/science/PYMOL_COMPATIBILITY_MATRIX.md`

### Step 2 — Repository architecture audit

Map each document requirement to existing files/modules/functions. Mark each item:

`REUSE | REFACTOR | EXTEND | NEW | DEFER`

Do not implement broad changes during the audit.

### Step 3 — Canonical data model implementation slice

Implement only the smallest safe canonical-model adapter/types needed to support the next selection work.

### Step 4 — Selection engine hardening

Freeze the Core grammar and evaluator and complete the oracle suite.

### Step 5 — First complete feature

Implement and validate `remove` end-to-end.

### Step 6 onward

Proceed P4 → P14 one gate at a time, maintaining manual verification after each meaningful feature.

---

# 13. Agent output contract for every milestone

Every coding-agent completion report MUST contain:

```text
MILESTONE:
STATUS:

1. Scientific specification used:
2. Repository files inspected:
3. Files changed:
4. Scientific behavior implemented:
5. Automated tests added:
6. Commands executed:
7. Test results:
8. Manual test procedure:
9. Manual result (if performed):
10. Scientific invariants checked:
11. Known limitations:
12. Compatibility status:
13. Next approved step:
```

The agent MUST NOT automatically start the next milestone unless the previous acceptance gate is satisfied or the owner explicitly authorizes an exception.

---

# 14. Definition of project success

The target is not a visual PyMOL clone.

Success means Mole Explorer provides a scientifically governed molecular workstation with:

- high-value PyMOL-compatible semantics;
- one canonical molecular state model;
- deterministic selection and editing;
- validated transactions;
- undo/redo;
- provenance and reproducibility;
- robust session/file round trips;
- 3Dmol-backed visualization as a downstream renderer;
- a stable command/API surface;
- and a self-owned scientific/docking backend whose approximations are explicit and testable.

The supplied scientific specification emphasizes exactly this distinction: semantic compatibility rather than superficial cloning, with immutable scientific state, provenance, fail-closed validation, and layered verification.

---

# 15. Current status

**Plan status:** ACTIVE  
**Current strategic stage:** P0 — governance/documentation foundation  
**Next gate:** create the documentation foundation and agent rules  
**First implementation target after documentation:** canonical scientific data model + Selection Engine v2  
**First end-to-end scientific editing target:** `remove`  

Do not skip phases or silently reorder them. If the order must change, update this file and record an ADR first.
