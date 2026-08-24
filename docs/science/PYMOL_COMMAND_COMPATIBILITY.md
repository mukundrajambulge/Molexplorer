# PyMOL Command Compatibility Matrix (Phase SQ3)

**Status:** `AUTHORITATIVE`  
**Phase:** `SQ3 — Advanced Composition, Presentation Semantics & PyMOL Compatibility`

> [!NOTE]
> Molexplorer is NOT a full PyMOL replacement. This document identifies what is implemented, what deliberately differs, and what is deferred.

---

## Selection Language (SQ1 — Core Algebra)

| Feature | PyMOL | Molexplorer | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `all` / `none` | ✓ | ✓ | **IMPLEMENTED** | Universe invariant $\mathcal{V}$ and $\emptyset$ |
| `name`, `elem`, `resn`, `resi`, `chain` | ✓ | ✓ | **IMPLEMENTED** | Full list and range syntax |
| `segi`, `segid`, `alt`, `altloc` | ✓ | ✓ | **IMPLEMENTED** | |
| `b`, `q` comparisons | ✓ | ✓ | **IMPLEMENTED** | `<`, `>`, `<=`, `>=`, `==`, `!=` |
| `formal_charge`, `fc` | ✓ | ✓ | **IMPLEMENTED** | |
| `id` (source serial) | ✓ | ✓ | **IMPLEMENTED** | Source-format atom ID |
| `index` (0-based runtime) | ✓ | ✓ | **IMPLEMENTED** | |
| `rank` (load order) | ✓ | ✓ | **IMPLEMENTED** | 1-based load index |
| `polymer`, `protein`, `nucleic` | ✓ | ✓ | **IMPLEMENTED** | |
| `organic`, `inorganic` | ✓ | ✓ | **IMPLEMENTED** | |
| `solvent`, `water` | ✓ | ✓ | **IMPLEMENTED** | |
| `metals` | ✓ | ✓ | **IMPLEMENTED** | Extended metals set |
| `hydrogens`, `hydro` | ✓ | ✓ | **IMPLEMENTED** | |
| `backbone`, `sidechain`, `guide` | ✓ | ✓ | **IMPLEMENTED** | |
| `donors`, `acceptors` | ✓ | ✓ | **IMPLEMENTED** | |
| `and`, `or`, `not` / `&`, `\|`, `!` | ✓ | ✓ | **IMPLEMENTED** | Strict precedence tiers |
| `within`, `around`, `beyond`, `expand` | ✓ | ✓ | **IMPLEMENTED** | Spatial hash grid |
| `neighbor`, `bound_to`, `extend` | ✓ | ✓ | **IMPLEMENTED** | Topological operators |
| `byres`, `bychain`, `bymolecule` | ✓ | ✓ | **IMPLEMENTED** | Weak prefix precedence |
| `bycalpha`, `byca` | ✓ | ✓ | **IMPLEMENTED** | |
| `byring`, `byobject`, `bysegi` | ✓ | ✓ | **IMPLEMENTED** | |
| `byfragment` | ✓ | ⚠ | **DEFERRED** | Fail-closed explicit notice |
| `bycell` | ✓ | ⚠ | **DEFERRED** | Fail-closed explicit notice |
| Slash macro `/model/segi/chain/resi/name` | ✓ | ✓ | **IMPLEMENTED** | Structured AST node, zero string splitting |
| Implicit OR (whitespace lists) | ✓ | Partial | **DIFFERENCE** | Whitespace = conjunction in Molexplorer; comma/+ = implicit OR |
| Named selections | ✓ | ✓ | **IMPLEMENTED** | Scope-aware resolution |

---

## Command Language (SQ2/SQ3)

| Command | PyMOL | Molexplorer | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `select <name>, <expr>` | ✓ | ✓ | **IMPLEMENTED** | |
| `delete <name>` | ✓ | ✓ | **IMPLEMENTED** | |
| `disable` / `enable` | ✓ | ✓ | **IMPLEMENTED** | Signals only; viewer state |
| `color <color> [, <sel>]` | ✓ | ✓ | **IMPLEMENTED** | Validated via ColorRegistry |
| `colour <color> [, <sel>]` | ✓ | ✓ | **IMPLEMENTED** | 100% parity with `color` |
| `set_color` | ✓ | ✓ | **IMPLEMENTED** | Routes to color command |
| `recolor` | ✓ | ✓ | **IMPLEMENTED** | Resets to `element` scheme |
| `show <rep> [, <sel>]` | ✓ | ✓ | **IMPLEMENTED** | Validated via RepresentationRegistry |
| `hide <rep> [, <sel>]` | ✓ | ✓ | **IMPLEMENTED** | |
| `show_as <rep> [, <sel>]` | ✓ | ✓ | **IMPLEMENTED** | |
| `zoom [<sel>]` | ✓ | ✓ | **IMPLEMENTED** | Read-only; frames selected region |
| `center [<sel>]` | ✓ | ✓ | **IMPLEMENTED** | Read-only; resets rotation pivot only |
| `orient [<sel>]` | ✓ | ✓ | **IMPLEMENTED** | Read-only; distinct from zoom |
| `label <sel>, <expr>` | ✓ | ✓ | **IMPLEMENTED** | Sandboxed allow-listed AST; zero `eval()` |
| `spectrum [prop, pal, sel]` | ✓ | ✓ | **IMPLEMENTED** | Typed SpectrumEngine; SOFTWARE VERIFIED |
| `set <name> [, <val> [, <sel>]]` | ✓ | ✓ | **IMPLEMENTED** | Parsed to settingResult; viewer applies |
| `unset <name>` | ✓ | ✓ | **IMPLEMENTED** | Clears named setting |
| `bg_color <color>` | ✓ | ✓ | **IMPLEMENTED** | Routes through set pipeline |
| `fetch <pdb_id>` | ✓ | ✓ | **IMPLEMENTED** | Issues fetchPdbId signal to viewer |
| `distance` / `angle` / `dihedral` | ✓ | ✓ | **IMPLEMENTED** | MeasurementParser + ScientificMeasurementEngine |
| `polar_contacts`, `salt_bridges`, etc. | ✓ | ✓ | **IMPLEMENTED** | ScientificMeasurementEngine analysis |
| Semicolon command chaining (`;`) | ✓ | ✓ | **IMPLEMENTED** | Fail-fast; named selection propagation |

---

## Intentional Molexplorer Differences

| Feature | PyMOL Behavior | Molexplorer Behavior | Rationale |
| :--- | :--- | :--- | :--- |
| **Implicit whitespace OR** | Whitespace lists → implicit OR (`resn ALA GLY` = `resn ALA or resn GLY`) | Whitespace → conjunction in some contexts | Scientific explicitness; use `+` or `,` for OR |
| **Identity fields** | `id`, `index`, `rank` can overlap | Strictly distinct: `id` = source serial, `index` = 0-based offset, `rank` = load order | Prevents ambiguity in multi-state documents |
| **Selection security** | `label` allows Python expression evaluation | Molexplorer uses allow-listed AST only; zero `eval()` | SECURITY VERIFIED |
| **`byfragment`** | Connected non-covalent fragments | Deferred: fail-closed notice | Pending formal fragment definition |
| **`bycell` / crystal symmetry** | Crystal packing support | Deferred | No crystallographic coordinate model yet |
| **Per-atom representation** | Full per-atom rep state | Signaled via `setStyle` / per-selection overrides; viewer merges | SQ3 presentation model; viewer integration in SQ4 |

---

## Not Yet Implemented (Deferred to SQ4 or Future)

- `cartoon_cylindrical_helices`, `cartoon_fancy_helices` (render settings)
- `ray` (raytracing integration)
- `map_new`, `isomesh`, `isosurface` (volumetric data)
- `align`, `super` (structure alignment; separate pathway)
- `create` (copying/merging objects)
- Full PyMOL session (`.pse`) round-trip beyond current snapshot
- `pairs` / `find_pairs` (contact pair queries)
