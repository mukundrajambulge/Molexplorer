# Command & Query Language Architecture Specification (Phase SQ2)

**Status:** `AUTHORITATIVE`  
**Phase:** `SQ2 — Selection-Aware Command Language`  
**Engine:** `ScientificCommandRouter` + `ScientificCommandParser` + `CommandLexer` + `CanonicalSelectionEvaluator`  

---

## 1. Architectural Pipeline & Boundary Contract

Phase SQ2 establishes a strict separation between command syntax and selection algebra. Raw command expressions are never routed directly through the selection parser.

```
Raw Console / Script Input (e.g. "select lig, resn HEM; colour cyan, lig; zoom lig")
  ↓
Command Lexer (CommandLexer.ts)
  - Semicolon (;) command boundary recognition
  - Nested parenthesis & quote preservation
  - Comma-delimited argument splitting
  ↓
Command AST (CommandAST.ts)
  - Verb classification
  - Typed positional & named arguments
  - Raw provenance preservation
  ↓
Dedicated Command Parser (ScientificCommandParser.ts)
  - Color validation (ColorRegistry)
  - Representation validation (RepresentationRegistry)
  - Sandboxed label AST parsing (LabelExpressionEvaluator)
  ↓
Selection Argument Extraction
  - Isolates selection queries from command arguments
  ↓
SQ1 Canonical Selection Engine (CanonicalSelectionEvaluator.ts)
  - Generates authoritative Set<canonical_id>
  ↓
Command Execution & Routing (ScientificCommandRouter.ts)
  - Dispatches visual/display state changes or transaction mutations
```

---

## 2. Command Categories & Syntax

### 2.1. Selection Lifecycle
- `select <name>, <selection>`: Evaluates `<selection>` via SQ1 engine and registers named selection `<name>`.
- `delete <name>` / `del <name>`: Removes named selection `<name>`.
- `disable <name>` / `enable <name>`: Toggles visibility/active state for selection `<name>`.

### 2.2. Coloring Commands (100% Parity)
- `color <color> [, <selection>]`
- `colour <color> [, <selection>]`
- `set_color <color> [, <selection>]`
- `recolor`

*Supported Colors:* `yellow`, `cyan`, `green`, `forest`, `lime`, `red`, `blue`, `deepblue`, `marine`, `orange`, `magenta`, `purple`, `violet`, `pink`, `hotpink`, `teal`, `gold`, `silver`, `white`, `black`, `gray`, `grey`, `#RRGGBB`, `#RGB`, `element`, `bfactor`, `chain`, `spectrum`.

### 2.3. Representation Commands
- `show <representation> [, <selection>]`
- `hide <representation> [, <selection>]`
- `show_as <representation> [, <selection>]`

*Supported Representations:* `lines`, `sticks`, `spheres`, `surface`, `cartoon`, `ribbon`, `mesh`, `dots`, `nonbonded`, `nb_spheres`, `labels`.

### 2.4. View & Camera Commands
- `zoom [<selection>]`: Reframes camera view on target atoms.
- `center [<selection>]`: Sets rotation center to centroid of target atoms.
- `orient [<selection>]`: Aligns principal axes of inertia to viewport.

### 2.5. Label Command (Strict Security Invariant)
- `label <selection>, <expression>`

*Allow-Listed Properties:* `name`, `resn`, `resi`, `chain`, `elem`, `b`, `q`, `formal_charge`, `id`, `index`, `rank`.  
*Concatenation & Templates:* `resn + " " + resi`, `"%s-%s" % (resn, resi)`.  
*Security Invariant:* Zero `eval()`, zero `new Function()`, zero arbitrary code execution.

### 2.6. Spectrum Color Mapping
- `spectrum [property] [, palette] [, selection]`
  - Maps numeric atom properties (`b`, `q`, `formal_charge`) across color ramps (`rainbow`, `red_white_blue`, etc.).

---

## 3. Strict Command Error Taxonomy

| Error Category | Prefix | Trigger Condition |
| :--- | :--- | :--- |
| **Command Syntax Error** | `Command syntax error:` | Missing arguments or malformed command structure |
| **Selection Syntax Error** | `Selection syntax error:` | Malformed query or unknown named selection reference |
| **Color Syntax Error** | `Color syntax error:` | Unknown color name or invalid hex format |
| **Representation Syntax Error** | `Representation syntax error:` | Unknown representation name |
| **Label Expression Error** | `Label expression error:` | Unsafe or non-allowlisted property in label expression |
| **Measurement Syntax Error** | `Measurement syntax error:` | Malformed geometric measurement query |
| **Analysis Syntax Error** | `Analysis syntax error:` | Malformed interaction analysis query |

---

## 4. Scientific Immutability Invariant

Presentation, display, and camera commands are strictly read-only:

$$\mathcal{H}(\mathcal{S}_{\text{after}}) \equiv \mathcal{H}(\mathcal{S}_{\text{before}})$$
$$|\Delta \text{ScientificRevisions}| = 0$$

- Zero coordinate modifications
- Zero covalent topology modifications
- Zero history ledger pollution
