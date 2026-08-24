# Advanced Query & Scientific Measurement Catalog

**Document ID:** `MOLEXPLORER-ADV-QUERY-CATALOG`  
**Milestone:** Phase 4.6 Advanced Scientific Query & Analysis Layer  
**Date:** August 24, 2026  
**Status:** **AUTHORITATIVE CATALOG**  
**Repository:** `mukundrajambulge/Molexplorer`  
**Branch:** `dev`  

---

## 1. Selection Operators Catalog

Every selection operator accepts:
1. **Universal Built-in Predicates** (e.g. `all`, `none`, `polymer`, `organic`, `hetatm`, `elem C`)
2. **Raw Subgraph / Metric Expressions** (e.g. `bychain (resi 1)`, `byres (id 50)`)
3. **Named Selection References** (e.g. `select active_site, <expr>` followed by `byres active_site`)

| Operator | Syntax & Universal Example `[UNIVERSAL]` | Fixture-Specific Example `[FIXTURE-SPECIFIC]` | Expected Output | Scientific Meaning | Current Validation Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `neighbor` | `neighbor (elem C and not solvent)` | `neighbor (chain A and resi 1)` / `neighbor ligand` | Directly bonded atoms excluding operand | 1-hop covalent bond neighborhood excluding operand | `GEOMETRICALLY VALIDATED` |
| `bound_to` | `bound_to (elem C and not solvent)` | `bound_to (chain A and resi 1)` / `bound_to ligand` | Directly bonded atoms allowing source atoms | 1-hop covalent bond neighborhood without operand subtraction | `GEOMETRICALLY VALIDATED` |
| `extend` | `extend 2 of (organic)` | `extend 2 of (resn LIG)` / `extend 2 of ligand` | Atoms within 2 bond hops of operand | Multi-hop BFS covalent graph traversal | `GEOMETRICALLY VALIDATED` |
| `byres` | `byres (name CA around 4.0 of organic)` | `byres (name CA and resi 1)` / `byres ligand` | Full residues containing operand atoms | Residue hierarchical closure | `SOFTWARE VERIFIED` |
| `bychain` | `bychain (polymer)` | `bychain (chain A)` / `bychain ligand` | All atoms on the chain containing operand | Chain hierarchical closure | `SOFTWARE VERIFIED` |
| `bymolecule` | `bymolecule (elem C and not solvent)` | `bymolecule (resi 1)` / `bymolecule ligand` | Full covalently connected molecule/polymer | Graph connected component closure | `GEOMETRICALLY VALIDATED` |
| `bycalpha` / `byca` | `bycalpha polymer` | `bycalpha (chain A and resi 1-10)` / `bycalpha protein` | Alpha-carbon atoms (CA) of containing residues | Residue backbone alpha-carbon extraction | `GEOMETRICALLY VALIDATED` |
| `byring` | `byring (elem C and not polymer)` | `byring (resn PHE and name CZ)` / `byring aromatic_ligand` | All ring atoms of containing cyclic rings | Cyclic chemical ring closure (3-7 membered) | `GEOMETRICALLY VALIDATED` |
| `within` | `within 3.5 of organic` | `within 5.0 of (resn LIG)` / `within 5.0 of ligand` | Atoms within distance including operand | Spatial proximity envelope with source | `GEOMETRICALLY VALIDATED` |
| `around` | `around 3.5 of organic` | `around 5.0 of (resn LIG)` / `around 5.0 of ligand` | Atoms within distance excluding operand | Spatial proximity envelope without source | `GEOMETRICALLY VALIDATED` |
| `beyond` | `beyond 10.0 of organic` | `beyond 10.0 of (resn LIG)` / `beyond 10.0 of ligand` | Atoms farther than distance from operand | Spatial exclusion envelope | `GEOMETRICALLY VALIDATED` |
| `expand` | `(polymer and name CA) expand 4.0` | `(resn ALA and name CA) expand 4.0` / `ligand expand 5.0` | Operand atoms plus all atoms within distance | Explicit self-expanding spatial envelope ($S \subseteq S_{\text{expand}}$) | `GEOMETRICALLY VALIDATED` |
| `byfragment` | `byfragment polymer` | `byfragment (chain A)` | *Fail-closed error (Deferred)* | Sub-fragment partition (*DEFERRED / RESEARCH*) | `DEFERRED / RESEARCH` |
| `bycell` | `bycell all` | `bycell (chain A)` | *Fail-closed error (Deferred)* | Crystallographic unit cell (*DEFERRED / RESEARCH*) | `DEFERRED / RESEARCH` |

---

## 2. Geometric Measurement Commands Catalog

Measurements accept both raw expressions and dynamically declared named selection identifiers:

| Command | Syntax & Universal Example `[UNIVERSAL]` | Fixture-Specific Example `[FIXTURE-SPECIFIC]` | Cardinality Rules | Expected Output | Scientific Meaning & Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `distance` / `dist` | `distance d1, id 1, id 2` | `distance d1, res1_ca, res2_ca` | $1 \times 1$ or $N \times M$ with optional cutoff | Pair distance in Ångströms (e.g. `3.787 Å`) | 3D Euclidean distance $d = \|\mathbf{x}_1 - \mathbf{x}_2\|$ (`SCIENTIFICALLY VALIDATED`) |
| `distance mode=2` | `distance hbonds, organic, polymer, mode=2` | `distance hbonds, ligand, protein, mode=2` | $N \times M$ candidate polar sets | Structured records of putative H-bonds / polar contacts | Geometric polar-contact perception (`GEOMETRICALLY VALIDATED`) |
| `angle` | `angle a1, id 1, id 2, id 3` | `angle a1, res1_n, res1_ca, res1_c` | Strictly $1 \times 1 \times 1$ (vertex at center) | Planar angle in degrees (e.g. `110.77°`) | 3-point angle $\theta \in [0, 180]^\circ$ (`GEOMETRICALLY VALIDATED`) |
| `dihedral` | `dihedral dih1, id 1, id 2, id 3, id 4` | `dihedral dih1, res1_n, res1_ca, res1_c, res2_n` | Strictly $1 \times 1 \times 1 \times 1$ | Torsional angle in degrees (e.g. `-180.00°`) | IUPAC 4-point signed torsion $\phi \in [-180, 180]^\circ$ (`GEOMETRICALLY VALIDATED`) |

---

## 3. Biophysical Interaction Analysis Catalog

| Command | Syntax & Universal Example `[UNIVERSAL]` | Fixture-Specific Example `[FIXTURE-SPECIFIC]` | Physical Mechanism | Detected Criteria | Scientific Validation Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `polar_contacts` | `polar_contacts organic, polymer` | `polar_contacts ligand, protein` | Polar donor-acceptor interactions | $d(D, A) \le 3.5\text{\AA}, \ \theta \ge 120^\circ$ | `GEOMETRICALLY VALIDATED` |
| `salt_bridges` | `salt_bridges all, all` | `salt_bridges protein, protein` | Cationic-anionic electrostatic pairs | $d \le 4.0\text{\AA}$ (Lys/Arg/His vs Asp/Glu) | `GEOMETRICALLY VALIDATED` |
| `pi_stack` | `pi_stack all, all` | `pi_stack ligand, protein` | Aromatic ring stacking | $d \le 5.5\text{\AA}, \ \theta \le 30^\circ \lor \theta \ge 60^\circ$ | `GEOMETRICALLY VALIDATED` |
| `cation_pi` | `cation_pi all, all` | `cation_pi protein, protein` | Aromatic ring to metal/cation | $d \le 6.0\text{\AA}, \ \theta_{\text{normal}} \le 45^\circ$ | `GEOMETRICALLY VALIDATED` |
| `halogen_bonds` | `halogen_bonds all, all` | `halogen_bonds ligand, protein` | Halogen sigma-hole interactions | $d \le 3.5\text{\AA}, \ \theta \ge 140^\circ$ (F/Cl/Br/I) | `GEOMETRICALLY VALIDATED` |
| `hydrophobic_contacts` | `hydrophobic_contacts organic, polymer` | `hydrophobic_contacts ligand, protein` | Non-polar carbon-carbon contacts | $3.5\text{\AA} \le d \le 4.0\text{\AA}$ | `GEOMETRICALLY VALIDATED` |

---

## 4. Generic Named Selection Workflow & Error Semantics

```text
Query Token / Operand
       │
       ▼
Is it a built-in keyword or property (e.g. resn, elem, polymer, backbone)?
       ├── YES ──► Evaluate property predicate / flag normally
       │
       └── NO  ──► Does token match a registered Named Selection (case-insensitive)?
                     ├── YES ──► Resolve to Named Selection atom IDs
                     │
                     └── NO  ──► Throw typed error: "Selection syntax error: Unknown selection reference '<token>'"
```

### Universal Named Selection Usage Pattern:
1. Define a named selection dynamically:
   ```text
   select active_site, byres (name CA around 5.0 of organic)
   ```
2. Compose with advanced operators:
   ```text
   bychain active_site
   neighbor active_site
   active_site expand 4.0
   ```
3. Execute measurements:
   ```text
   polar_contacts active_site, organic
   ```


