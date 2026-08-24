# Hydrogen Operations & Local Chemistry Specification

**Document ID:** `MOLEXPLORER-HYDROGEN-SPEC`  
**Milestone:** Phase P5 — Hydrogen and Local Chemistry Operations  
**Date:** August 24, 2026  
**Status:** **AUTHORITATIVE SCIENTIFIC SPECIFICATION**  
**Classification:** `GEOMETRICALLY / RULE-BASED VALIDATED`  
**Repository:** `mukundrajambulge/Molexplorer`  
**Branch:** `dev`  

---

## 1. Scope & Purpose

This specification defines the authoritative mathematical, topological, and chemical models for hydrogen addition (`h_add`), open-valency saturation (`h_fill`), and explicit hydrogen deletion (`h_remove` / `remove_h` / `del_h` / `hdel`) in Molexplorer.

All hydrogen modeling in Molexplorer is governed by:
1. **Explicit Valence & Hybridization Rules**: Geometries are determined by element, formal charge, and bonding topology rather than element identity alone.
2. **Deterministic Geometric Placement**: Given the same canonical state and parameters, hydrogen coordinates are bit-for-bit identical regardless of array ordering.
3. **Collision & Clash Validation**: Placed hydrogens are verified against minimum nonbonded clash thresholds ($d \ge 0.8\text{\AA}$) and standard covalent bond lengths.
4. **Provenance & Identity Preservation**: Modeled hydrogens are assigned new sequential canonical IDs without displacing existing IDs or reusing tombstoned IDs, and are flagged with `modeled_hydrogen: true`.
5. **Reversibility**: Every hydrogen mutation creates a `ScientificRevision` and is 100% reversible via `undo`.

---

## 2. Chemical Valence & Eligibility Model

### 2.1 Target Valence Table
For standard neutral and charged states:

| Element | Formal Charge | Hybridization | Target Valence | Geometry Model | Default Bond Length ($d_0$) |
| :--- | :---: | :---: | :---: | :--- | :---: |
| **C** (Carbon) | 0 | $sp^3$ | 4 | Regular Tetrahedral ($109.47^\circ$) | $1.090\text{ \AA} \pm 0.010\text{ \AA}$ |
| **C** (Carbon) | 0 | $sp^2$ | 4 | Trigonal Planar ($120.00^\circ$) | $1.090\text{ \AA} \pm 0.010\text{ \AA}$ |
| **C** (Carbon) | 0 | $sp$ | 4 | Collinear ($180.00^\circ$) | $1.090\text{ \AA} \pm 0.010\text{ \AA}$ |
| **N** (Nitrogen) | 0 | $sp^3$ | 3 | Trigonal Pyramidal ($107.00^\circ$) | $1.010\text{ \AA} \pm 0.010\text{ \AA}$ |
| **N** (Nitrogen) | 0 | $sp^2$ | 3 | Trigonal Planar ($120.00^\circ$) | $1.010\text{ \AA} \pm 0.010\text{ \AA}$ |
| **N** (Ammonium) | +1 | $sp^3$ | 4 | Regular Tetrahedral ($109.47^\circ$) | $1.010\text{ \AA} \pm 0.010\text{ \AA}$ |
| **O** (Oxygen) | 0 | $sp^3$ | 2 | Bent ($104.50^\circ$) | $0.960\text{ \AA} \pm 0.010\text{ \AA}$ |
| **O** (Oxygen) | 0 | $sp^2$ (Carbonyl) | 2 (Double) | Planar ($120.00^\circ$) | $0.960\text{ \AA} \pm 0.010\text{ \AA}$ |
| **S** (Sulfur) | 0 | $sp^3$ | 2 | Bent ($92.00^\circ$) | $1.340\text{ \AA} \pm 0.010\text{ \AA}$ |
| **P** (Phosphorus)| 0 | $sp^3$ | 3 or 5 | Pyramidal / Tetrahedral | $1.440\text{ \AA} \pm 0.010\text{ \AA}$ |

### 2.2 Formal Eligibility Predicate: `hydrogen_fill_eligibility(atom)`
An atom $u$ is eligible for `h_fill` if and only if:
1. $u.\text{element} \in \{\text{'C'}, \text{'N'}, \text{'O'}, \text{'S'}, \text{'P'}\}$.
2. $u$ is not a metal or inorganic ion ($\text{is\_metal}(u) = \text{false}$).
3. $u$ has a supported formal charge state ($-1 \le q \le +1$).
4. $\text{bond\_order\_sum}(u) < \text{target\_valence}(u)$.
5. $\text{remaining\_valence}(u) = \text{target\_valence}(u) - \text{bond\_order\_sum}(u) > 0$.

If an atom is ineligible, `h_fill` skips the atom cleanly without corrupting the state, logging the explicit scientific reason (e.g. `INELIGIBLE_METAL`, `VALENCE_SATURATED`, `UNSUPPORTED_HYBRIDIZATION`).

---

## 3. Deterministic 3D Coordinate Placement Algorithms

Let $\mathbf{p} \in \mathbb{R}^3$ be the parent atom position and $\mathbf{n}_1, \dots, \mathbf{n}_k$ be the positions of its existing bonded neighbors. Let $\mathbf{v}_i = \frac{\mathbf{n}_i - \mathbf{p}}{\|\mathbf{n}_i - \mathbf{p}\|}$ be the normalized unit neighbor vectors.

### 3.1 Tetrahedral ($sp^3$) Placement Rules
1. **$k = 0$ (Isolated Atom, e.g. Methane precursor):**
   Place 4 hydrogens along deterministic tetrahedral vertices:
   $$\mathbf{r}_1 = \frac{d_0}{\sqrt{3}}(+1, +1, +1), \quad \mathbf{r}_2 = \frac{d_0}{\sqrt{3}}(-1, -1, +1), \quad \mathbf{r}_3 = \frac{d_0}{\sqrt{3}}(-1, +1, -1), \quad \mathbf{r}_4 = \frac{d_0}{\sqrt{3}}(+1, -1, -1)$$
2. **$k = 1$ (One Neighbor, e.g. Methyl $-\text{CH}_3$ or Hydroxyl $-\text{OH}$):**
   - Reference axis $\mathbf{a} = -\mathbf{v}_1$.
   - Construct deterministic orthonormal basis $(\mathbf{e}_1, \mathbf{e}_2)$ perpendicular to $\mathbf{a}$.
   - Cone angle $\theta_{\text{tet}} = 180^\circ - 109.47^\circ = 70.53^\circ$.
   - Place $m$ hydrogens evenly distributed along the cone at azimuths $\phi_j = j \cdot \frac{2\pi}{m}$:
     $$\mathbf{h}_j = \mathbf{p} + d_0 \left( \mathbf{a} \cos\theta_{\text{tet}} + \sin\theta_{\text{tet}} (\mathbf{e}_1 \cos\phi_j + \mathbf{e}_2 \sin\phi_j) \right)$$
3. **$k = 2$ (Two Neighbors, e.g. Methylene $-\text{CH}_2-$ or Water $\text{H}_2\text{O}$):**
   - Bisector $\mathbf{b} = -\text{normalize}(\mathbf{v}_1 + \mathbf{v}_2)$.
   - Normal to neighbor plane $\mathbf{n} = \text{normalize}(\mathbf{v}_1 \times \mathbf{v}_2)$.
   - Half-out-of-plane angle $\psi = \arcsin\left(\frac{\sin(109.47^\circ / 2)}{\sin(180^\circ - \theta_{12} / 2)}\right) \approx 54.74^\circ$.
   - If 2 hydrogens needed:
     $$\mathbf{h}_1 = \mathbf{p} + d_0 (\mathbf{b}\cos\psi + \mathbf{n}\sin\psi), \quad \mathbf{h}_2 = \mathbf{p} + d_0 (\mathbf{b}\cos\psi - \mathbf{n}\sin\psi)$$
   - If 1 hydrogen needed: $\mathbf{h} = \mathbf{p} + d_0 \mathbf{b}$.
4. **$k = 3$ (Three Neighbors, e.g. Methine $>\text{CH}-$ or Pyramidal Amine):**
   - Vector opposite umbrella centroid:
     $$\mathbf{h} = \mathbf{p} - d_0 \cdot \text{normalize}(\mathbf{v}_1 + \mathbf{v}_2 + \mathbf{v}_3)$$

### 3.2 Trigonal Planar ($sp^2$) Placement Rules
1. **$k = 1$:** In-plane vectors at $\pm 120^\circ$ to $\mathbf{v}_1$.
2. **$k = 2$:** In-plane bisector opposite neighbors $\mathbf{h} = \mathbf{p} - d_0 \cdot \text{normalize}(\mathbf{v}_1 + \mathbf{v}_2)$.

### 3.3 Linear ($sp$) Placement Rules
- $\mathbf{h} = \mathbf{p} - d_0 \cdot \mathbf{v}_1$.

---

## 4. Collision & Topology Validation Rules

Before committing any modeled hydrogen $\mathbf{h}_j$:
1. **Finite Coordinates:** Check $\text{isFinite}(\mathbf{h}_j.x) \land \text{isFinite}(\mathbf{h}_j.y) \land \text{isFinite}(\mathbf{h}_j.z)$.
2. **Bond Length Verification:** $|\|\mathbf{h}_j - \mathbf{p}\| - d_0| \le 0.010\text{\AA}$.
3. **No Duplicate or Self Bonds:** $\text{parent} \ne \text{hydrogen}$, no existing bond between parent and new ID.
4. **Nonbonded Clash Check:** For all non-parent atoms $a \in \mathcal{A} \setminus \{\text{parent}\}$, $\|\mathbf{h}_j - \mathbf{x}_a\| \ge 0.80\text{\AA}$.
5. **Hierarchical Ownership:** The new hydrogen inherits $\text{chain\_ref}$, $\text{residue\_ref}$, and $\text{residue\_name}$ directly from the parent atom.

---

## 5. Hydrogen Removal Semantics

- **`h_remove [<selection>]`** / **`remove_h`** / **`del_h`** / **`hdel`**:
  1. Resolves target hydrogen atoms matching the query expression. If omitted, defaults to all hydrogens (`elem H`) in the active object.
  2. For every matched hydrogen:
     - Removes all incident covalent bonds from the topology graph.
     - Decrements neighbor adjacency degree in connected heavy atoms.
     - Removes the hydrogen atom from the molecule atom list and maps.
  3. Emits a new `ScientificRevision` and `ProvenanceRecord`.
  4. Preserves all other atom canonical IDs strictly unchanged.

---

## 6. Scientific Classification & Evidence Tier

- **Classification:** `GEOMETRICALLY / RULE-BASED VALIDATED`
- **Validation Evidence:** Verified across analytical trigonometric proofs and empirical multi-fixture macromolecular benchmarks (`03PL`, `1CRN`, `1UBQ`, `1BNA`, `1HVR`, `4HHB`, `4DJW`).
