# PyMOL Complete Feature Inventory

> **Total estimated clickable actions: ~1,500+**  
> This document catalogs EVERY single menu item, button, sub-menu, right-click option, and interaction point in the PyMOL molecular visualization application.

---

## Summary Table

| Menu / Area | Clickable Actions | Status in MolStudio |
|:---|:---:|:---:|
| **File Menu** | ~25 | ⚠️ Partial |
| **Edit Menu** | ~15 | ❌ Missing |
| **Build Menu** | ~40+ | ❌ Missing |
| **Movie Menu** | ~35 | ❌ Missing |
| **Display Menu** | ~50+ | ⚠️ Partial |
| **Setting Menu** | ~1,000+ (nested) | ⚠️ Partial |
| **Scene Menu** | ~20 | ❌ Missing |
| **Mouse Menu** | ~15 | ⚠️ Partial |
| **Wizard Menu** | ~15 | ⚠️ Partial |
| **Plugin Menu** | ~10 | ❌ Missing |
| **Help Menu** | ~10 | ❌ Missing |
| **Toolbar Buttons** | ~10 | ⚠️ Partial |
| **Right-Click Context** | ~25+ | ❌ Missing |
| **Object Panel (ASHLC)** | ~150+ | ⚠️ Partial |
| **Command Line** | ~100+ commands | ⚠️ Partial |
| **Mouse Controls** | ~15 modes | ⚠️ Partial |
| **Keyboard Shortcuts** | ~30 | ❌ Missing |

---

## 1. File Menu (~25 clicks)

| # | Menu Path | Description |
|:---:|:---|:---|
| 1 | File > New Window | Opens a new PyMOL window instance |
| 2 | File > Open... | Opens file browser to load PDB, SDF, MOL2, CIF, MTZ, CCP4, PSE files |
| 3 | File > Get PDB... | Downloads structure directly by 4-letter PDB code from RCSB |
| 4 | File > Recent Files | Sub-menu listing last 10 opened files |
| 5 | File > Save Session | Overwrites current PyMOL session (.pse) |
| 6 | File > Save Session As... | Save session with new filename |
| 7 | File > Save Molecule... | Export coordinates (PDB, MOL2, SDF, mmCIF) for selected/all objects |
| 8 | File > Save Image As... > PNG | Export viewport as PNG |
| 9 | File > Save Image As... > VRML | Export as VRML 3D model |
| 10 | File > Save Image As... > POV-Ray | Export as POV-Ray scene |
| 11 | File > Save Image As... > COLLADA | Export as COLLADA 3D format |
| 12 | File > Save Movie As... > MPEG | Export movie as MPEG video |
| 13 | File > Save Movie As... > GIF | Export movie as animated GIF |
| 14 | File > Save Movie As... > Frames | Export as individual image frames |
| 15 | File > Export Image As... | Export current view to image format |
| 16 | File > Export Movie As... | Export current movie timeline |
| 17 | File > Working Directory > Change | Change working directory |
| 18 | File > Working Directory > Show | Display current working directory |
| 19 | File > Working Directory > Print | Print working directory path |
| 20 | File > Log > Open | Start logging commands |
| 21 | File > Log > Append | Append to existing log |
| 22 | File > Log > Close | Stop logging |
| 23 | File > Run Script... | Execute a Python (.py) or PyMOL (.pml) script |
| 24 | File > Reinitialize | Resets PyMOL entirely (clears all data) |
| 25 | File > Quit | Exits the application |

---

## 2. Edit Menu (~15 clicks)

| # | Menu Path | Description |
|:---:|:---|:---|
| 1 | Edit > Undo | Reverses the last action |
| 2 | Edit > Redo | Re-applies the last reversed action |
| 3 | Edit > Copy Image | Copies current 3D viewport to clipboard |
| 4 | Edit > Copy | Copies selected atoms/sequences |
| 5 | Edit > Paste | Pastes atoms/sequences |
| 6 | Edit > Find | Opens search for sequences or atoms |
| 7 | Edit > Clear Selection (pk1) | Clears picked atom 1 |
| 8 | Edit > Clear All Selections | Removes all current selections |

---

## 3. Build Menu (~40+ clicks)

| # | Menu Path | Description |
|:---:|:---|:---|
| 1 | Build > Fragment > Benzene | Insert benzene ring fragment |
| 2 | Build > Fragment > Cyclopentane | Insert cyclopentane fragment |
| 3 | Build > Fragment > Cyclohexane | Insert cyclohexane fragment |
| 4 | Build > Fragment > Methane | Insert methane |
| 5 | Build > Fragment > Ethane | Insert ethane |
| 6 | Build > Fragment > ... | ~15 more chemical fragments |
| 7 | Build > Residue > Alanine (ALA) | Add alanine amino acid |
| 8 | Build > Residue > Cysteine (CYS) | Add cysteine |
| 9 | Build > Residue > Aspartate (ASP) | Add aspartate |
| 10 | Build > Residue > Glutamate (GLU) | Add glutamate |
| 11 | Build > Residue > ... | All 20 standard amino acids |
| 12 | Build > Residue > Adenine (A) | Nucleic acid bases |
| 13 | Build > Residue > Cytosine (C) | Nucleic acid bases |
| 14 | Build > Residue > Guanine (G) | Nucleic acid bases |
| 15 | Build > Residue > Thymine (T) | Nucleic acid bases |
| 16 | Build > Residue > Uracil (U) | Nucleic acid bases |
| 17 | Build > Sculpting | Toggle sculpting mode (local energy minimization) |
| 18 | Build > Cycle Valence | Cycle single/double/triple bonds on selected bond |
| 19 | Build > Make Bond | Connect two selected atoms |
| 20 | Build > Remove Bond | Remove bond between two atoms |
| 21 | Build > Invert | Invert stereochemistry at chiral center |
| 22 | Build > Add Hydrogens | Add H atoms to molecule/residue |
| 23 | Build > Remove Hydrogens | Strip H atoms |
| 24 | Build > Remove Atom | Delete selected atom |

---

## 4. Movie Menu (~35 clicks)

| # | Menu Path | Description |
|:---:|:---|:---|
| 1 | Movie > Append > 1 second | Add frames to timeline |
| 2 | Movie > Append > 2 seconds | Add more frames |
| 3 | Movie > Append > ... | Various durations |
| 4 | Movie > Clear | Delete all frames, reset timeline |
| 5 | Movie > Program > Camera Loop | Auto-generate 360° camera rotation |
| 6 | Movie > Program > Y-Roll | Rotate around Y axis |
| 7 | Movie > Program > X-Roll | Rotate around X axis |
| 8 | Movie > Program > Nutate | Wobble/nutate the camera |
| 9 | Movie > Frame Rate > 15 fps | Set playback speed |
| 10 | Movie > Frame Rate > 30 fps | Set playback speed |
| 11 | Movie > Frame Rate > 60 fps | Set playback speed |
| 12 | Movie > Auto-Interpolate | Toggle camera interpolation |
| 13 | Movie > Ray Trace Frames | Toggle ray tracing during export |
| 14 | Movie > Update Scene | Refresh stored scene at current frame |
| 15 | Movie > Draw/Ray | Configure rendering backend for frames |

---

## 5. Display Menu (~50+ clicks)

| # | Menu Path | Description |
|:---:|:---|:---|
| 1 | Display > Sequence | Toggle sequence viewer bar |
| 2 | Display > Sequence Mode > Residues | Show by residues |
| 3 | Display > Sequence Mode > Chains | Show by chains |
| 4 | Display > Sequence Mode > Atoms | Show by atoms |
| 5 | Display > Background > Black | Set background color |
| 6 | Display > Background > White | Set background color |
| 7 | Display > Background > Grey | Set background color |
| 8 | Display > Background > Transparent | Transparent background |
| 9 | Display > Color Space > RGB | Set color space |
| 10 | Display > Color Space > CMYK | Set color space |
| 11 | Display > Quality > Maximum | Maximum polygon count |
| 12 | Display > Quality > High | High polygon count |
| 13 | Display > Quality > Medium | Medium polygon count |
| 14 | Display > Quality > Low | Low polygon count |
| 15 | Display > Grid > Grid Mode | Toggle grid layout |
| 16 | Display > Orthoscopic View | Toggle perspective vs orthographic |
| 17 | Display > Stereo > Cross-Eye | Stereo mode |
| 18 | Display > Stereo > Wall-Eye | Stereo mode |
| 19 | Display > Stereo > Hardware | Hardware stereo |
| 20 | Display > Stereo > Anaglyph | Red/cyan anaglyph 3D |
| 21 | Display > Zoom/Center | Center camera on visible objects |
| 22 | Display > Depth Cue (Fog) | Toggle depth fog effect |
| 23 | Display > Two-Sided Lighting | Toggle two-sided lighting |
| 24 | Display > Specular Highlights | Toggle specular reflections |
| 25 | Display > Animation > Rock | Start continuous wobble |
| 26 | Display > Clipping > Near/Far slabs | Adjust clipping planes |

---

## 6. Setting Menu (~1,000+ nested settings)

The Setting menu exposes PyMOL's **~600 global variables**. Key categories:

| Category | Examples |
|:---|:---|
| **Transparency** | Surface (Off/20%/50%/80%), Cartoon, Sphere, Stick |
| **Cartoon** | Loop style, Tube radius, Ribbon width, Fancy helices, Flat sheets, B-factor putty, Smooth loops |
| **Surface** | Solvent accessible, Solvent excluded, Dot density, Probe radius, Cavity detection |
| **Label** | Font (Sans/Serif/Mono), Size (10–28pt), Color, Background, Outline, Position offset |
| **Rendering** | Shadows (on/off), Textures, Antialiasing, Ambient occlusion, Ray opaque background |
| **Stick** | Radius (0.1–0.5), Ball-and-stick ratio, Transparency, Color blending |
| **Sphere** | Scale (0.1–1.0), Transparency, Quality |
| **Line** | Width (1–10px), Smooth, Use shaders |
| **Ray** | Trace mode (0–3), Shadow intensity, Ambient light, Direct light, Specular power |

> **Note**: `Setting > Edit All...` opens a master window with ALL ~600 variables searchable and editable.

---

## 7. Scene Menu (~20 clicks)

| # | Menu Path | Description |
|:---:|:---|:---|
| 1 | Scene > Next | Go to next stored scene |
| 2 | Scene > Previous | Go to previous stored scene |
| 3 | Scene > Append | Add current view as new scene (F1, F2, F3...) |
| 4 | Scene > Insert Before | Insert scene before current |
| 5 | Scene > Insert After | Insert scene after current |
| 6 | Scene > Update | Overwrite current scene with current view |
| 7 | Scene > Delete | Remove current scene |
| 8 | Scene > Clear All | Delete all scenes |
| 9 | Scene > Buttons | Toggle scene thumbnail buttons |
| 10 | Scene > Cache | Control scene caching |

---

## 8. Mouse Menu (~15 clicks)

| # | Menu Path | Description |
|:---:|:---|:---|
| 1 | Mouse > 3-Button Viewing | Default mode (Rotate/Zoom/Translate) |
| 2 | Mouse > 3-Button Editing | Mode for dragging atoms, changing torsions |
| 3 | Mouse > 3-Button Motions | For animating trajectories |
| 4 | Mouse > 2-Button Modes | For trackpads |
| 5 | Mouse > Selection Mode > Atoms | Click selects individual atoms |
| 6 | Mouse > Selection Mode > Residues | Click selects entire residues |
| 7 | Mouse > Selection Mode > Chains | Click selects entire chains |
| 8 | Mouse > Selection Mode > Molecules | Click selects entire molecules |
| 9 | Mouse > Selection Mode > Objects | Click selects entire objects |
| 10 | Mouse > Virtual Trackball | Toggle trackball vs spherical rotation |

---

## 9. Wizard Menu (~15 clicks)

| # | Menu Path | Description |
|:---:|:---|:---|
| 1 | Wizard > Measurement | Open distance/angle/dihedral measurement tool |
| 2 | Wizard > Mutagenesis | Select residue → pick rotamer → mutate |
| 3 | Wizard > Pair Fitting | Align specific pairs of atoms manually |
| 4 | Wizard > Density | Map electron density to molecules |
| 5 | Wizard > Charge | Assign formal charges to atoms |
| 6 | Wizard > Appearance | Quick visual style wizard |
| 7 | Wizard > Sculpting | Activate interactive real-time energy minimization |
| 8 | Wizard > Label | Interactive labeling wizard |
| 9 | Wizard > Filter | Filter selection by property |
| 10 | Wizard > Demo > Representations | Built-in tutorial on representations |
| 11 | Wizard > Demo > Sculpting | Built-in tutorial on sculpting |
| 12 | Wizard > Demo > CGO | Built-in tutorial on custom graphics objects |

---

## 10. Plugin Menu (~10 clicks)

| # | Menu Path | Description |
|:---:|:---|:---|
| 1 | Plugin > Plugin Manager | Install/update/remove plugins |
| 2 | Plugin > APBS Electrostatics | Surface electrostatics (Poisson-Boltzmann) |
| 3 | Plugin > PDB Loader Service | Legacy PDB fetching tool |
| 4 | Plugin > Symmetry Mate | Generate crystal symmetry mates |
| 5 | Plugin > Movie Maker | Advanced movie creation |

---

## 11. Help Menu (~10 clicks)

| # | Menu Path | Description |
|:---:|:---|:---|
| 1 | Help > About PyMOL | Version, license, build info |
| 2 | Help > Online Documentation | Opens PyMOL wiki in browser |
| 3 | Help > Commands | Lists all CLI commands |
| 4 | Help > Keyboard | Shows keyboard shortcut reference |
| 5 | Help > Mouse | Shows mouse control reference |

---

## 12. Toolbar Buttons (~10 clicks)

| # | Button | Description |
|:---:|:---|:---|
| 1 | **Zoom** | Auto-frame the entire view |
| 2 | **Orient** | Align principal axes to screen X/Y |
| 3 | **Rock** | Start continuous camera wobble animation |
| 4 | **Presets** | Dropdown: Simple, Publication, Ball-and-Stick, B-factor, Ligand Cartoon |
| 5 | **Builder** | Opens molecule builder/sketcher window |
| 6 | **Scene** | Quick dropdown to jump between scenes |
| 7 | **Draw** | Renders current viewport (fast, GPU-based) |
| 8 | **Ray** | Renders current viewport (CPU ray-traced, publication quality) |

---

## 13. Right-Click Context Menu on Viewport (~25+ clicks)

When right-clicking on an atom/residue in the 3D canvas:

| # | Option | Sub-options |
|:---:|:---|:---|
| 1 | Zoom | Zoom to clicked atom/residue |
| 2 | Center | Center view on clicked atom |
| 3 | Origin | Set rotation origin here |
| 4 | Action > Rename | Rename the object |
| 5 | Action > Duplicate | Duplicate the object |
| 6 | Action > Delete | Delete the object |
| 7 | Action > Find > Polar Contacts | Show H-bonds to/from this residue |
| 8 | Action > Find > Pi Interactions | Show π–π and cation–π interactions |
| 9 | Show > Lines / Sticks / Cartoon / Surface / Spheres / Dots / Mesh | Toggle representations |
| 10 | Hide > Lines / Sticks / Cartoon / Surface / etc. | Hide representations |
| 11 | Color > By Element / By Chain / By SS / Spectrum / Custom | Recolor |
| 12 | Label > Atom Name / Element / Residue / B-factor / Charge | Add labels |

---

## 14. Object Panel — ASHLC Buttons (~150+ clicks)

For each loaded object, 5 buttons appear: **[A] [S] [H] [L] [C]**

### [A] Action Button (~40 sub-items)
| Option | Sub-options |
|:---|:---|
| zoom / orient / center / origin | Camera controls |
| preset > simple | Quick visual style |
| preset > b factor putty | Tube scaled by B-factor |
| preset > publication | Publication-quality rendering |
| preset > ball and stick | Standard ball-and-stick |
| preset > ligand cartoon | Cartoon with ligand sticks |
| find > polar contacts | Detect and show H-bonds |
| find > any contacts | Show all close contacts |
| align > to object | Kabsch structural alignment |
| generate > vacuum electrostatics | Compute electrostatic surface |
| compute > atom count / charge / SASA | Computed properties |
| state > freeze / thaw | Multi-state object controls |
| rename / duplicate / delete | Object management |

### [S] Show Button (~15 sub-items)
`lines` | `sticks` | `ribbon` | `cartoon` | `spheres` | `dots` | `surface` | `mesh` | `nonbonded` | `nb_spheres` | `cell` | `disulfide` | `cgo` | `everything`

### [H] Hide Button (~15 sub-items)
Same as Show — `everything` | `lines` | `sticks` | `ribbon` | `cartoon` | `spheres` | `dots` | `surface` | `mesh` | `nonbonded` | `cell`

### [L] Label Button (~15 sub-items)
`clear` | `atom name` | `element symbol` | `residue name` | `residue identifier` | `chain ID` | `segment ID` | `b-factor` | `occupancy` | `formal charge` | `partial charge` | `text type` | `vdw radius`

### [C] Color Button (~50+ sub-items)
| Category | Options |
|:---|:---|
| by element | C-gray, C-green, C-cyan, C-yellow, C-white, C-pink, C-orange |
| by chain | Auto-color by chain ID |
| by ss | Helix=red, Sheet=yellow, Loop=green (or Jmol scheme) |
| spectrum | Rainbow (N→C by residue number), by b-factor, by occupancy |
| specific colors | ~30 named colors (red, green, blue, yellow, cyan, magenta, orange, purple, white, gray, teal, salmon, slate, violet, limegreen, deepteal, hotpink, chocolate, firebrick, forest, density, etc.) |

---

## 15. Command Line — Key Commands (~100+)

| Category | Commands |
|:---|:---|
| **Loading** | `load`, `fetch`, `save`, `export`, `import`, `delete`, `reinitialize` |
| **Selection** | `select`, `indicate`, `deselect`, `enable`, `disable`, `group` |
| **Visualization** | `show`, `hide`, `color`, `set`, `get`, `set_color`, `bg_color`, `label`, `unlabel` |
| **Manipulation** | `alter`, `iterate`, `iterate_state`, `remove`, `h_add`, `h_fill`, `fuse`, `bond`, `unbond` |
| **Alignment** | `align`, `super`, `cealign`, `rms_cur`, `pair_fit`, `intra_rms`, `intra_fit` |
| **Camera** | `zoom`, `orient`, `center`, `origin`, `turn`, `rotate`, `move`, `translate`, `clip`, `reset` |
| **Rendering** | `ray`, `draw`, `png`, `mpng`, `viewport`, `stereo` |
| **Movie** | `mset`, `mdo`, `mplay`, `mstop`, `frame`, `rewind`, `ending`, `mview`, `scene` |
| **Object** | `create`, `extract`, `copy`, `split_states`, `join_states`, `sort` |
| **Editing** | `undo`, `redo`, `protect`, `deprotect`, `mask`, `unmask`, `sculpt_activate`, `clean`, `rebuild` |
| **Measurement** | `distance`, `angle`, `dihedral`, `get_distance`, `get_angle`, `get_dihedral` |
| **Properties** | `count_atoms`, `get_names`, `get_chains`, `get_model`, `get_position`, `get_area` |
| **Settings** | `set` (600+ variable names), `get`, `unset` |

---

## 16. Mouse Controls

| Action | 3-Button Viewing Mode |
|:---|:---|
| **Left Click + Drag** | Rotate camera |
| **Right Click + Drag** | Zoom in/out (Z-axis translate) |
| **Middle Click + Drag** | Translate (X/Y pan) |
| **Scroll Wheel** | Move clipping planes (Z-slab depth) |
| **Shift + Left Click** | Box selection |
| **Shift + Middle Click** | Center on clicked atom |
| **Ctrl + Left Click** | Pick atom/residue (depends on selection mode) |
| **Ctrl + Shift + Left Click** | Add to current selection |
| **Double Click** | Toggle atom label |

---

## 17. Keyboard Shortcuts

| Key | Action |
|:---|:---|
| Arrow Keys | Frame forward/backward in multi-state objects |
| Page Up / Page Down | Switch scenes |
| ESC | Toggle between command line and 3D viewer |
| F1–F12 | Jump to scenes (if saved) |
| Space | Play/pause movie |
| Home | Reset view |
| Delete | Delete picked atom (in editing mode) |

---

## What MolStudio Currently Has vs What's Missing

### ✅ Features We Have (Stages 1–3)
- File loading (PDB, SDF, MMTF, fetch from RCSB)
- Representation styles: Lines, Sticks, Ball-and-Stick, Space-Filling, Cartoon, VDW Surface, SAS, SES, Mesh, Dots
- Color schemes: Element/CPK, Chain, ssJmol, ssPyMol, Spectrum/Rainbow, White, B-factor
- Selection algebra (PyMOL-compatible parser)
- Distance, Angle, Dihedral measurements
- Structural alignment (Kabsch + BLOSUM62)
- Interaction detection (H-bonds, salt bridges, π–π, cation–π, halogen bonds)
- Ramachandran plot validation
- Dipole moment calculation
- DSSP H-bond energy
- Biological assemblies and crystal symmetry
- Background color options
- Opacity control
- Protein preparation (strip water, add H, DSSP)

### ❌ Major Features Missing
- **Build Menu**: Fragment builder, residue builder, sculpting, bond editing
- **Movie/Animation**: Timeline, keyframes, camera interpolation, export
- **Scene System**: Store/recall views
- **Edit Menu**: Undo/redo, copy/paste, find
- **Electron Density Maps**: CCP4/MTZ loading, isomesh/isosurface
- **Mutagenesis Wizard**: Residue mutation with rotamer library
- **Electrostatics**: APBS/vacuum electrostatics surface mapping
- **Ray Tracing**: Publication-quality CPU rendering
- **Right-Click Context**: Per-atom/residue interactive menus
- **Object Panel**: ASHLC buttons for per-object control
- **Label System**: Rich label formatting (font, size, color, position)
- **Display Modes**: Sequence viewer, stereo modes, grid layout
- **Settings Panel**: Master settings editor with 600+ variables
- **Mouse Modes**: Editing mode, motion mode, selection level control
- **Water Molecules**: Currently stripped — should be toggleable display
- **Non-bonded Representation**: Small cross markers for water/ions
