# Selection Composition, PyMOL Compatibility, and Query Chaining Specification

## 1. Mathematical and Formal Grammar Specification

Molexplorer's Selection and Query Language adheres to formal selection algebra and PyMOL compatibility semantics.

### 1.1 Formal EBNF Grammar

```ebnf
SelectionExpr        ::= DisjunctionExpr ;

DisjunctionExpr      ::= ConjunctionExpr (DisjunctionOperator ConjunctionExpr)* ;
DisjunctionOperator  ::= "or" | "|" | <implicit-whitespace> ;

ConjunctionExpr      ::= SpatialPostfixExpr (ConjunctionOperator SpatialPostfixExpr)* ;
ConjunctionOperator  ::= "and" | "&" ;

SpatialPostfixExpr   ::= UnaryExpr (SpatialPostfixOperator <distance>)* ;
SpatialPostfixOperator ::= "around" | "within" | "beyond" | "expand" ;

UnaryExpr            ::= PrefixOperator UnaryExpr | PrimaryExpr ;
PrefixOperator       ::= "not" | "!" 
                       | "neighbor" | "bound_to" | "extend" <steps> ("of")?
                       | HierarchyOperator
                       | SpatialPrefixOperator <distance> ("of")? ;

HierarchyOperator    ::= "byres" | "bychain" | "bymolecule" 
                       | "bycalpha" | "byca" | "byring" 
                       | "byobject" | "bysegi" ;

SpatialPrefixOperator ::= "around" | "within" | "beyond" | "expand" ;

PrimaryExpr          ::= "(" SelectionExpr ")"
                       | MacroExpr
                       | PropertyExpr
                       | ComparisonExpr
                       | FlagExpr
                       | NamedSelectionExpr ;

MacroExpr            ::= "/" (<model>)? "/" (<segi>)? "/" (<chain>)? "/" (<resi>)? "/" (<name>)? ;
```

### 1.2 Formal Precedence Hierarchy

| Level | Precedence Class | Operators / Constructs | Associativity | AST Representation |
| :--- | :--- | :--- | :--- | :--- |
| **Level 4** | **Primary** | Parentheses `(...)`, Slash Macros `//A/10/CA`, Named Selections, Property Predicates (`chain A`, `resi 1-50`), Comparisons (`b > 30`), Semantic Flags (`polymer`, `ligand`, `solvent`, `metals`, `all`, `none`) | Highest (Inner) | `PrimaryNode` |
| **Level 3** | **Unary & Prefix** | `not`, `!`, `neighbor`, `bound_to`, `extend <N>`, `byres`, `bychain`, `bymolecule`, `bycalpha`/`byca`, `byring`, `byobject`, `bysegi`, prefix `around <d>`, `within <d>`, `beyond <d>`, `expand <d>` | Right-associative | `UnaryNode`, `HierarchyNode`, `SpatialNode` |
| **Level 2** | **Spatial Postfix & Conjunction** | Postfix `<expr> around <d>`, `<expr> within <d>`, `<expr> beyond <d>`, `<expr> expand <d>`; Explicit intersection `and`, `&` | Left-associative | `SpatialNode`, `{ type: 'and', left, right }` |
| **Level 1** | **Disjunction** | Explicit union `or`, `\|`; Implicit whitespace juxtaposition `<expr> <expr>` | Left-associative | `{ type: 'or', left, right }` |

---

## 2. Whitespace Juxtaposition vs Explicit AND Semantics

In accordance with PyMOL selection algebra:
1. **Implicit whitespace juxtaposition is Disjunction (OR)**:
   $$\text{chain A chain B} \equiv \text{chain A or chain B}$$
   $$\text{resn ALA GLY} \equiv \text{resn ALA or resn GLY}$$
   $$\text{name CA CB} \equiv \text{name CA or name CB}$$
2. **Explicit intersection requires `and` or `&`**:
   $$\text{chain A and polymer}$$
   $$\text{chain A \& polymer}$$
   $$\text{chain A and chain B} = \emptyset$$

---

## 3. Spatial Operator Semantics: `within` vs `expand` vs `around`

Molexplorer strictly differentiates spatial candidate filtering, set expansion, and spatial halos:

1. **`within` (Spatial Candidate Predicate)**:
   $$\text{within}(D, S) = \{ a \in \mathcal{U} \mid \min_{b \in S} \| \mathbf{r}_a - \mathbf{r}_b \| \le D \}$$
2. **`expand` (Set Expansion Operator)**:
   $$\text{expand}(D, S) = S \cup \text{around}(D, S)$$
   Strict set inclusion invariant: $$S \subseteq \text{expand}(D, S)$$
3. **`around` (Disjoint Spatial Halo)**:
   $$\text{around}(D, S) = \{ a \in \mathcal{U} \setminus S \mid \min_{b \in S} \| \mathbf{r}_a - \mathbf{r}_b \| \le D \}$$
   Strict disjointness invariant: $$S \cap \text{around}(D, S) = \emptyset$$

---

## 4. Named Selection Resolution and Cycle Detection

### 4.1 Nested Named Selection Evaluation
Named selections are first-class selection operands:
```text
select ligand, organic and not polymer
select pocket, byres (ligand around 5.0) and not ligand
select pocket2, byres (ligand around 4.0) and not (ligand or solvent)
```

### 4.2 Cycle Detection Algorithm
To guarantee termination and fail-closed safety, resolution maintains an active stack `resolvingNamedSelections`:
1. On evaluating named selection $K$, check if $K \in \text{resolvingNamedSelections}$.
2. If true, raise `Selection syntax error: Cyclic named selection reference detected: 'a -> b -> a'`.
3. Otherwise, add $K$ to $\text{resolvingNamedSelections}$, recursively evaluate, and remove $K$ in a `finally` block.

---

## 5. Slash Macro Positional Slot Rules

A canonical selection macro contains 5 positional slots:
$$\text{/model/segment/chain/residue/name}$$

| Macro Format | Slot 0: Model | Slot 1: Segment | Slot 2: Chain | Slot 3: Residue | Slot 4: Name |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `//A/10/CA` | `*` | `*` | `A` | `10` | `CA` |
| `/4DJW//A/10/CA` | `4DJW` | `*` | `A` | `10` | `CA` |
| `/4DJW//A/` | `4DJW` | `*` | `A` | `*` | `*` |
| `///1-50/` | `*` | `*` | `*` | `1-50` | `*` |
| `////CA` | `*` | `*` | `*` | `*` | `CA` |
| `/////` | `*` | `*` | `*` | `*` | `*` (`all`) |

---

## 6. Semicolon Command Sequences and Fail-Fast Execution

Multiple scientific commands can be sequenced with semicolons (`;`):
```text
select ligand, organic and not polymer; show sticks, ligand; color cyan, ligand; zoom ligand
```
Execution semantics:
1. Lexing via `CommandLexer.splitCommandSequences` respects quotes and nested parentheses.
2. Unbalanced delimiters fail closed immediately before execution.
3. Chained statements execute sequentially, registering dynamic named selections into downstream evaluation contexts.
4. Any mid-script syntax error or evaluation failure stops execution immediately (fail-fast), leaving prior applied state clean.

---

## 7. Per-Selection Visual Presentation Invariants

1. Commands targeting specific selections (`show sticks, ligand; color cyan, ligand`) **never** mutate global default representation styles.
2. Presentation states are registered as `SelectionPresentationOverride` entries.
3. Coexistence invariant: Simultaneous representation of different components (e.g. protein as cartoon, ligand as sticks, pocket as yellow surface) is fully preserved without visual collision.
