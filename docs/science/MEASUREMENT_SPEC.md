# Scientific Measurement & Biophysical Interaction Specification

**Document ID:** `MOLEXPLORER-MEASUREMENT-SPEC`  
**Milestone:** Phase 4.6 Advanced Scientific Query & Analysis Layer  
**Date:** August 22, 2026  
**Status:** **AUTHORITATIVE SCIENTIFIC SPECIFICATION**  
**Repository:** `mukundrajambulge/Molexplorer`  
**Branch:** `dev`  

---

## 1. Scope & Mathematical Foundations

This specification defines the formal mathematics, selection cardinality rules, pairing algorithms, duplicate suppression, boundary error handling, and scientific validation tiers for geometric measurements (`distance`, `angle`, `dihedral`) and structured non-covalent interaction perceptions.

---

## 2. Geometric Measurements

### 2.1 Euclidean Distance Measurement

#### Mathematical Definition
Given two 3D Cartesian points $\mathbf{x}_1 = (x_1, y_1, z_1)$ and $\mathbf{x}_2 = (x_2, y_2, z_2)$ in Ångströms:
$$d(\mathbf{x}_1, \mathbf{x}_2) = \sqrt{(x_1 - x_2)^2 + (y_1 - y_2)^2 + (z_1 - z_2)^2} \quad [\text{\AA}]$$

#### Syntax
- `distance [name,] <selection1>, <selection2> [, cutoff=<D>]`
- `dist [name,] <selection1>, <selection2> [, cutoff=<D>]`

#### Cardinality & Pairing Rules
1. **$1 \times 1$ Single Pair:**
   If $|S_1| = 1$ and $|S_2| = 1$, evaluates single distance $d(a_1, a_2)$.
2. **$N \times M$ Multi-Atom Distance Matrix:**
   If $|S_1| > 1$ or $|S_2| > 1$, evaluates all pairs $(a_i, a_j) \in S_1 \times S_2$.
3. **Duplicate Suppression & Symmetry:**
   Pairs are canonically ordered such that $i < j$. Symmetrical pairs $((a_i, a_j)$ and $(a_j, a_i))$ are evaluated once. Self-distances ($a_i = a_j$, $d=0.0\text{\AA}$) are excluded unless explicitly requested.
4. **Cutoff Threshold:**
   When `cutoff = D` is specified, only pairs with $d(a_i, a_j) \le D$ are returned.

---

### 2.2 Planar Angle Measurement

#### Mathematical Definition
Given three 3D points $\mathbf{x}_1$ (terminal 1), $\mathbf{x}_2$ (central vertex), and $\mathbf{x}_3$ (terminal 2):
$$\vec{u} = \mathbf{x}_1 - \mathbf{x}_2, \quad \vec{v} = \mathbf{x}_3 - \mathbf{x}_2$$
$$\theta = \arccos\left(\frac{\vec{u} \cdot \vec{v}}{\|\vec{u}\| \|\vec{v}\|}\right) \times \frac{180}{\pi} \quad [^\circ], \quad \theta \in [0, 180]^\circ$$

#### Syntax
- `angle [name,] <selection1>, <selection2>, <selection3>`

#### Strict Cardinality & Fail-Closed Rules
1. **Mandatory $1 \times 1 \times 1$ Cardinality:**
   Angle measurement requires **strictly 1 atom per selection position** ($|S_1| = 1, |S_2| = 1, |S_3| = 1$).
2. **Ambiguity Rejection:**
   If any selection resolves to 0 atoms or $> 1$ atoms without explicit single-atom scoping, the engine throws:
   `Measurement syntax error: Angle measurement requires exactly 1 atom per selection (got sel1=${|S_1|}, vertex=${|S_2|}, sel3=${|S_3|})`.
3. **Degenerate Point Check:**
   If $\|\vec{u}\| = 0$ or $\|\vec{v}\| = 0$ (colocated atoms), the angle is undefined and returns an explicit error.

---

### 2.3 Signed Torsional Dihedral Measurement

#### Mathematical Definition
Given four 3D points $\mathbf{x}_1, \mathbf{x}_2, \mathbf{x}_3, \mathbf{x}_4$ defining three bond vectors:
$$\vec{b}_1 = \mathbf{x}_2 - \mathbf{x}_1, \quad \vec{b}_2 = \mathbf{x}_3 - \mathbf{x}_2, \quad \vec{b}_3 = \mathbf{x}_4 - \mathbf{x}_3$$
$$\vec{n}_1 = \vec{b}_1 \times \vec{b}_2, \quad \vec{n}_2 = \vec{b}_2 \times \vec{b}_3, \quad \vec{m} = \vec{n}_1 \times \hat{b}_2$$
$$\phi = \text{atan2}(-\vec{m} \cdot \vec{n}_2, \ \vec{n}_1 \cdot \vec{n}_2) \times \frac{180}{\pi} \quad [^\circ], \quad \phi \in [-180, 180]^\circ$$

#### Syntax
- `dihedral [name,] <selection1>, <selection2>, <selection3>, <selection4>`

#### Strict Cardinality & Fail-Closed Rules
1. **Mandatory $1 \times 1 \times 1 \times 1$ Cardinality:**
   Must resolve to exactly 1 atom per selection ($|S_1| = 1, |S_2| = 1, |S_3| = 1, |S_4| = 1$).
2. **Ambiguity Rejection:**
   If any cardinality $\ne 1$, throws:
   `Measurement syntax error: Dihedral measurement requires exactly 1 atom per selection (got |S1|=${|S_1|}, |S2|=${|S_2|}, |S3|=${|S_3|}, |S4|=${|S_4|})`.

---

## 3. PyMOL-Compatible Mode=2 Polar Contacts & Structured Interactions

### 3.1 Mode=2 Polar Contact Detection
- **Syntax:** `distance <name>, <selection1>, <selection2>, mode=2 [, cutoff=<D>]`
- **Scientific Rationale & Terminology:**
  Mode 2 represents geometric polar-contact perception. In accordance with strict validation guidelines, results are categorized as:
  - `putative_hydrogen_bond`: Satisfies donor-acceptor distance ($2.5\text{\AA} \le d \le 3.5\text{\AA}$) and angle ($\ge 120.0^\circ$ when modeled H present).
  - `polar_contact`: Satisfies donor-acceptor heavy atom distance without explicit hydrogen coordinates.
  - `ambiguous_polar_contact`: Satisfies distance cutoff but exhibits borderline geometry ($100^\circ \le \theta < 120^\circ$).
- **Validation Tier:** `GEOMETRICALLY / RULE-BASED VALIDATED`.

### 3.2 Structured Biophysical Interaction Analysis Commands
| Command | Physical Phenomenon | Geometric Criteria & Standard | Validation Tier |
| :--- | :--- | :--- | :---: |
| `polar_contacts [s1, s2]` | Polar donor-acceptor contacts | $d(D, A) \le 3.5\text{\AA}, \ \theta(D\text{-}H\cdots A) \ge 120^\circ$ | `GEOMETRICALLY VALIDATED` |
| `salt_bridges [s1, s2]` | Cationic-anionic electrostatic pairs | $d(\text{Cation}, \text{Anion}) \le 4.0\text{\AA}$ (Lys/Arg/His vs Asp/Glu) | `GEOMETRICALLY VALIDATED` |
| `pi_stack [s1, s2]` | Aromatic ring stacking | $d(\text{centroid}_1, \text{centroid}_2) \le 5.5\text{\AA}, \ \theta \le 30^\circ \lor \theta \ge 60^\circ$ | `GEOMETRICALLY VALIDATED` |
| `cation_pi [s1, s2]` | Aromatic ring to metal/cation | $d(\text{centroid}, \text{cation}) \le 6.0\text{\AA}, \ \theta_{\text{normal}} \le 45^\circ$ | `GEOMETRICALLY VALIDATED` |
| `halogen_bonds [s1, s2]` | Halogen sigma-hole bonding | $d(X, A) \le 3.5\text{\AA}, \ \theta(C\text{-}X\cdots A) \ge 140^\circ$ (F/Cl/Br/I) | `GEOMETRICALLY VALIDATED` |
| `hydrophobic_contacts [s1, s2]` | Non-polar carbon-carbon contacts | $3.5\text{\AA} \le d(C, C) \le 4.0\text{\AA}$ | `GEOMETRICALLY VALIDATED` |

---

## 4. Immutability & Determinism Invariants

1. **Read-Only Assurance:** Measurement and analysis operations **never** mutate coordinates, alter covalent topology, generate `ScientificRevision` records, or alter workspace revision hashes.
2. **Determinism:** Pairs and interaction records are deterministically sorted by `(atom1.canonical_id, atom2.canonical_id)` in ascending order.
3. **Float64 Metric Precision:** All vector operations and trigonometric functions operate in 64-bit IEEE 754 floating-point arithmetic.

