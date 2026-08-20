# Molexplorer Agent Rules

## 1. Mandatory first read

Before any architectural, scientific, backend, frontend, viewer, selection, editing, docking, or persistence change:

1. Read `MASTER_PLAN.md`.
2. Read the relevant document under `docs/science/`, `docs/testing/`, or `docs/decisions/`.
3. Inspect the existing repository implementation before creating new abstractions.

`MASTER_PLAN.md` is the execution source of truth. Do not invent a competing roadmap.

## 2. Scientific authority

The authoritative scientific state is the molecular/domain model, not React state and not the 3D renderer.

- 3Dmol is a downstream renderer.
- Viewer-only interactions MUST NOT mutate authoritative scientific coordinates, topology, hashes, or provenance.
- GUI, command-console, and typed-API paths for Core operations MUST resolve to the same semantic operation.

## 3. Scientific integrity rules

- Coordinates are in Ångström.
- Coordinates must be finite.
- Topology changes must be explicit and validated.
- Source artifacts are immutable.
- Scientific edits create derived state/revision when the architecture supports revisioned state.
- Invalid scientific operations must fail closed and leave authoritative state unchanged.
- Do not silently drop atoms, bonds, conformers, or metadata.
- Do not silently reinterpret malformed or ambiguous scientific input.
- Do not label an approximation as an exact physical result.
- Unsupported or version-dependent PyMOL-compatible behavior must be labeled explicitly.

## 4. Architecture rules

- Do not introduce a second competing molecular data model.
- Reuse/refactor existing canonical modules before creating replacements.
- Keep scientific computation out of presentation components.
- Keep renderer concerns in the rendering adapter/layer.
- Keep selection semantics in the selection engine, not duplicated in UI components.
- Keep editing semantics in the transactional editing kernel, not button handlers.
- Keep provenance attached to scientific operations, not screenshots or UI events alone.

Preferred operation pipeline:

`input → parser/normalizer → selection/AST → operation planner → validator → commit → provenance → renderer`

## 5. Incremental implementation rule

Do not implement the entire PyMOL-compatibility program in one change.

Use the project lifecycle:

`research → specification → repository mapping → implementation → unit tests → integration/E2E → manual scientific validation → acceptance gate`

After roughly 2–3 tightly related documentation/design steps, deliver at least one complete, testable capability.

Do not begin the next major milestone until the current acceptance gate is satisfied or the project owner explicitly authorizes an exception.

## 6. Testing rules

Every Core capability should have, where applicable:

- unit tests;
- integration tests;
- browser/E2E tests;
- manual scientific tests.

Tests MUST include negative/error cases for parsing or mutation features.

Prefer exact semantic assertions:

- atom IDs;
- atom counts;
- bond topology;
- coordinates;
- selections;
- state/revision hashes;
- provenance lineage;
- numerical outputs.

Screenshots may support a test but are never sufficient scientific evidence by themselves.

## 7. Repository safety

Before editing:

- inspect the working tree/status;
- identify the branch;
- inspect the relevant current files and tests;
- avoid unrelated formatting or refactors;
- keep changes feature-scoped.

Do not delete or weaken existing scientific regression tests merely to make a new feature pass.

## 8. Third-party tools

Third-party scientific packages may be used for offline validation when explicitly approved.

They MUST NOT become hidden runtime dependencies of the self-owned scientific engine unless the project owner updates `MASTER_PLAN.md` and records the decision in an ADR.

Do not introduce a PyMOL runtime dependency. The target is PyMOL-compatible semantics, not a PyMOL wrapper.

## 9. Agent completion report

Every implementation task must report:

1. Milestone and status.
2. Scientific specification used.
3. Relevant repository files inspected.
4. Files changed.
5. Scientific behavior implemented.
6. Tests added/updated.
7. Exact commands executed.
8. Exact test results.
9. Manual test procedure.
10. Scientific invariants checked.
11. Known limitations.
12. Compatibility status.
13. Next approved milestone.

Never claim a test passed unless it was actually executed.

## 10. Scope discipline

Do not silently expand a task.

If implementation exposes a missing architectural dependency:

- document it;
- propose the smallest required change;
- stop if the change alters the milestone order or scientific contract.

## 11. Change-control rule

Changes to scientific semantics, canonical data identity, engine boundaries, compatibility classification, persistence contracts, or phase order require:

1. an update to the relevant specification;
2. an ADR when the decision is architectural;
3. an update to `MASTER_PLAN.md` when execution order/status changes.
