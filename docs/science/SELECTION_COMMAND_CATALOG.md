# Selection Command Catalog (Phase SQ3 Verified)

**Status:** `AUTHORITATIVE`  
**Phase:** `SQ3 — Advanced Selection Composition, PyMOL Compatibility, and Query Chaining`

---

## Command Reference

### `select`
```
select <name>, <selection>
```
Evaluates `<selection>` via SQ1 engine and registers a named selection under `<name>`.

**Examples:**
```
select ligand, resn LIG
select pocket, byres (ligand around 5.0) and not ligand
select backbone_A, backbone and chain A
```

---

### `color` / `colour`
```
color <color> [, <selection>]
colour <color> [, <selection>]
```
Applies a color to the specified atoms. `color` and `colour` are **100% semantically identical**.

**Examples:**
```
color cyan, ligand
colour green, byres (elem FE around 5.0)
color yellow, pocket
colour element, all
color #FF6600, resi 10-20 and chain A
```

---

### `show`
```
show <representation> [, <selection>]
```
Activates a visual representation style for the specified atoms.

**Examples:**
```
show sticks, ligand
show cartoon, protein
show spheres, elem FE
show surface, chain A
show lines, all
```

---

### `hide`
```
hide <representation> [, <selection>]
```
Deactivates a visual representation style for the specified atoms.

**Examples:**
```
hide cartoon, chain B
hide sticks, solvent
hide lines, all
```

---

### `zoom`
```
zoom [<selection>]
```
Reframes the camera to center on the target atom set. Defaults to `all`.

**Examples:**
```
zoom ligand
zoom elem FE
zoom pocket
zoom
```

---

### `center`
```
center [<selection>]
```
Sets the rotation center to the geometric centroid of the target atoms.

---

### `orient`
```
orient [<selection>]
```
Aligns the principal inertia axes of the target atoms with the viewport axes.

---

### `label`
```
label <selection>, <expression>
```
Attaches per-atom text labels using a sandboxed, allow-listed expression AST.

**Allow-listed properties:** `name`, `resn`, `resi`, `chain`, `elem`, `b`, `q`, `formal_charge`, `id`, `index`, `rank`

**Examples:**
```
label ligand, name
label resi 50, resn + "-" + resi
label all, "%s %s" % (chain, resi)
label name CA, resi
```

---

### `spectrum`
```
spectrum [property] [, palette] [, selection]
```
Maps a numeric atom property through a color ramp.

**Supported properties:** `b`, `q`, `formal_charge`  
**Supported palettes:** `rainbow`, `red_white_blue`, `blue_white_red`

**Examples:**
```
spectrum b, rainbow, all
spectrum q, blue_white_red, protein
spectrum b
```

---

### `delete`
```
delete <name>
del <name>
```
Removes a named selection from the workspace.

---

### `disable` / `enable`
```
disable <name>
enable <name>
```
Toggles display state of a named selection.

---

## Command Chaining (`;`)

Multiple commands may be chained with semicolons. Execution is **fail-fast** — a failure in command N prevents execution of command N+1.

```
select ligand, organic and not polymer;
show sticks, ligand;
colour cyan, ligand;
zoom ligand
```

Named selections created in command N are available to command N+1 within the same sequence.

---

## Named Selection Equivalence Guarantee

For every command that accepts a selection:

```
command(named_selection) ≡ command(parenthesized_original_expression)
```

Example:
```
select lig, resn HEM
colour cyan, lig           -- identical to: colour cyan, (resn HEM)
show sticks, lig           -- identical to: show sticks, (resn HEM)
zoom lig                   -- identical to: zoom (resn HEM)
```

---

## Single-Word Semantic Selectors & Precedence

Molexplorer commands accept direct built-in single-word semantic selectors without requiring `select <name>`:

```
show sticks, ligand
show cartoon, protein
color cyan, ligand
colour yellow, protein
zoom ligand
center ligand
orient ligand
label ligand, name
spectrum b, rainbow, protein
select pocket, byres (ligand around 5.0) and not ligand
```

### Identifier Resolution Precedence:
1. **Built-in Semantic Selectors:** `protein`, `ligand`, `polymer`, `nucleic`, `organic`, `inorganic`, `ion`, `solvent`, `waters`, `metals`, `backbone`, `sidechain`, `hetatm`, `hydrogens`, `all`, `none`, `first`, `last`, `guide`.
2. **Property Selectors with Operands:** `name CA`, `elem FE`, `resi 1-50`, `chain A`, `resn HEM`, `b > 20`.
3. **Registered Named Selections:** Dynamically defined user selections (`pocket`, `active_site`).
4. **Fail Closed:** Unknown identifiers fail closed with structured error `Selection syntax error: Unknown selection reference '<name>'`.

Built-in semantic selectors are immutable keywords that take strict precedence over named selections and are never shadowed.

---

## Read-Only Scientific Invariant

All display commands (`color`, `colour`, `show`, `hide`, `zoom`, `center`, `orient`, `label`, `spectrum`) are strictly read-only:

- Zero coordinate mutations
- Zero covalent topology mutations
- Zero scientific revisions emitted
- `H(before) == H(after)` across all display operations

