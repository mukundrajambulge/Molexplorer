# Viewer Presentation Invariants Specification (SQ-UI-04)

## 1. Overview

This document specifies the scientific and software invariants governing the presentation layer in Molexplorer. These invariants are verified through automated unit tests and continuous browser visual QA.

---

## 2. Invariant Specifications

### Invariant 1: Scientific Immutability ($H_{\text{before}} \equiv H_{\text{after}}$)
- **Definition:** Display commands (`show`, `color`, `colour`, `hide`, `label`, `spectrum`) and GUI visualization adjustments (style drop-downs, color swatches, visibility toggles) are strictly read-only presentation transforms.
- **Guarantee:** 
  $$\Delta \text{RevisionCount} = 0$$
  $$\text{MoleculeHash}(\text{before}) \equiv \text{MoleculeHash}(\text{after})$$
- **Verification:** Tested across all 7 benchmark fixtures (03PL, 1CRN, 1UBQ, 1BNA, 1HVR, 4HHB, 4DJW).

### Invariant 2: Scoped Isolation
- **Definition:** Applying a representation or color override to selection $S \subset A$ must not alter the presentation of atoms $a \in A \setminus S$.
- **Guarantee:** Atoms outside the specified selection retain their previous representation, color scheme, and opacity without global style reset.
- **Example:** Running `show sticks, ligand` on a cartoon protein leaves all protein atoms in cartoon representation while rendering ligand atoms as sticks.

### Invariant 3: Deterministic Precedence (LWW)
- **Definition:** When multiple selection overrides $O_1, O_2, \dots, O_k$ overlap on an atom $a$, the effective style and color are resolved deterministically using Last-Write-Wins (LWW) based on monotonic application timestamps:
  $$\text{EffectiveOverride}(a) = \arg\max_{O_i \ni a} O_i.\text{appliedAt}$$

### Invariant 4: Structural Menu Visibility (Unclipped Popovers)
- **Definition:** All Action (A), Show (S), Hide (H), Label (L), and Color (C) dropdown menus in the Objects & Selections panel must remain 100% visible inside the browser viewport regardless of container scroll positions or panel boundaries.
- **Guarantee:**
  1. Positioned using fixed coordinates computed relative to trigger bounding box.
  2. Vertically flips upward if space below trigger is less than estimated menu height.
  3. Horizontally clamped within viewport boundaries ($8\text{px} \le x \le \text{viewportWidth} - \text{menuWidth} - 8\text{px}$).
  4. Mounted via React Portal into `.hud-grid` or `document.body` to eliminate container clipping.

### Invariant 5: Closed Representation & Color Vocabulary
- **Definition:** Representation styles and color schemes must resolve to strictly validated registry entries.
- **Guarantee:** Unsupported representations or colors fail closed with informative syntax errors rather than corrupting viewer state into dark/black fallback geometries.
