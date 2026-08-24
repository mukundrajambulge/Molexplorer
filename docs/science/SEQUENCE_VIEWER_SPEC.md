# Sequence Viewer Specification (SQ-UI-03)

## 1. Overview & Architecture

The **Sequence Viewer** provides an interactive 1D primary structure residue strip mapped dynamically to the 3D molecular canvas. It enables structural biologists to inspect peptide sequences, secondary structure motifs, and select individual or multiple residues across chains.

```
+-------------------------------------------------------------------------+
|                              MolStudio                                  |
|                                                                         |
|   +-----------------------+              +--------------------------+   |
|   |   StudioRibbonBar     |              |   ObjectControlPanel     |   |
|   |  (Analyze -> Sequence)|              |   (sele: N atoms)        |   |
|   +-----------------------+              +--------------------------+   |
|               |                                      ^                  |
|               v                                      |                  |
|   +-----------------------------------------------------------------+   |
|   |                     SequenceViewer Overlay                      |   |
|   |   Chain A: [V1] [L2] [S3] [P4] [A5] [D6] ... [R141]             |   |
|   |   Chain B: [V1] [H2] [L3] [T4] [P5] [E6] ... [H146]             |   |
|   +-----------------------------------------------------------------+   |
|                               | (bi-directional sync)                   |
|                               v                                         |
|   +-----------------------------------------------------------------+   |
|   |                     CoreViewer3D (WebGL)                        |   |
|   |   Highlighted residues in 3D canvas with amber bounding glow   |   |
|   +-----------------------------------------------------------------+   |
+-------------------------------------------------------------------------+
```

---

## 2. Multi-Chain Data Organization

Residues are extracted dynamically from the canonical atom set and partitioned by chain ID:

1. **Chain Normalization:** Atoms evaluate `chainID || chain || 'A'`. Chains are sorted alphabetically.
2. **Residue Grouping:** Atoms sharing the same `(chainID, resSeq)` tuple are grouped into a discrete residue block.
3. **Amino Acid Nomenclature:** 3-letter codes (`ALA`, `VAL`, `PHE`) are mapped to IUPAC 1-letter codes (`A`, `V`, `F`) with special handling for waters (`w`) and hetero residues (`?` or full text).
4. **Secondary Structure Annotations:** Each residue card displays an indicator bar at the bottom:
   - **Helix ($\alpha$, $3_{10}$, $\pi$):** Pink indicator (`#ec4899`)
   - **Beta Sheet / Strand:** Yellow indicator (`#eab308`)
   - **Loop / Turn / Coil:** Slate indicator (`#475569`)

---

## 3. Interaction Semantics

The sequence viewer supports standard desktop selection gestures:

| Gesture | Action | Semantic Behavior |
| :--- | :--- | :--- |
| **Click** | Single Residue Select | Clears prior selection and selects only atoms belonging to the clicked residue. |
| **Shift + Click** | Additive Multi-Select | Adds all atoms of the clicked residue to the existing selection set. |
| **Ctrl / Cmd + Click** | Toggle Residue | If residue is already selected, removes its atoms from selection; otherwise adds them. |
| **Close [X]** | Dismiss Overlay | Collapses sequence viewer strip without modifying existing 3D selections. |

---

## 4. UI Discoverability & Access Points

1. **Analyze Ribbon Tab:** A prominent "Sequence Viewer (ON/OFF)" button in the `Analyze` tab of the ribbon bar.
2. **Session Ribbon Tab:** Direct toggle in the workspace session bar.
3. **Bi-directional Synchronization:** Clicking residues immediately updates:
   - 3D Viewport atom highlight bounding boxes
   - HUD Selection counter (`Sel: N`)
   - Objects & Selections panel active selection row (`sele: N atoms`)
