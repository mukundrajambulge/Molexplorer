# PyMOL vs MolStudio Complete Roadmap

This document provides a comprehensive, click-by-click audit comparing PyMOL's exhaustive feature set with MolStudio, mapping out exactly what is implemented, what is missing, and the future implementation roadmap for Web/Browser feasibility.

---

## 1. File Menu
| Exact Menu/UI Path | PyMOL Functionality | MolStudio Status | Why NOT in Stage 1-3 | Browser Feasibility | Planned Stage | Priority Level |
|---|---|---|---|---|---|---|
| `File > New Window` | Opens new PyMOL instance | Missing | Single-canvas focus initially | YES - via new tab/window | Stage 6 (Multi-view) | Low |
| `File > Open...` | Opens local molecular files | Implemented | N/A | YES - File API | N/A | Critical |
| `File > Get PDB...` | Fetches PDB from rcsb.org | Implemented | N/A | YES - fetch API | N/A | Critical |
| `File > Save Molecule...` | Exports selected state/object | Partial | Export was complex in early WebGL | YES - Blob API | Stage 4 (Advanced Edits) | High |
| `File > Save Session (.pse)` | Saves entire workspace | Missing | Requires custom JSON/serialization | YES - Custom state JSON | Stage 7 (Sessions) | Critical |
| `File > Export Image As...` | High-res ray-traced image out | Partial | Basic canvas export only | YES - WebGL `toDataURL` / WebGPU | Stage 5 (Movie & Ray) | High |

## 2. Edit Menu
| Exact Menu/UI Path | PyMOL Functionality | MolStudio Status | Why NOT in Stage 1-3 | Browser Feasibility | Planned Stage | Priority Level |
|---|---|---|---|---|---|---|
| `Edit > Undo` | Revert last action/edit | Missing | State management overhead | YES - Redo/Undo stack | Stage 4 (Advanced Edits) | High |
| `Edit > Redo` | Redo action | Missing | Dependent on Undo stack | YES - Redo stack | Stage 4 (Advanced Edits) | High |
| `Edit > Copy...` | Copy object/selection | Missing | Clipboard API constraints | YES - Memory store | Stage 4 (Advanced Edits) | Medium |
| `Edit > Remove Waters` | Deletes H2O from selection | Partial | Basic selection parsing prioritized | YES - Atom filtering | Stage 4 (Advanced Edits) | High |

## 3. Build Menu
| Exact Menu/UI Path | PyMOL Functionality | MolStudio Status | Why NOT in Stage 1-3 | Browser Feasibility | Planned Stage | Priority Level |
|---|---|---|---|---|---|---|
| `Build > Fragment > Benzene` | Inserts benzene ring | Missing | Focused on viewing, not building | YES - Coordinate templates | Stage 6 (Wizards) | Medium |
| `Build > Residue > Helix` | Builds ideal alpha helix | Missing | Math heavy, low initial priority | YES - Mathematical generation | Stage 6 (Wizards) | Medium |
| `Build > Sculpting` | Interactive energy minimization | Missing | Needs physics engine (e.g. MMFF) | YES - WASM/WebWorkers | Stage 8 (Simulation) | Low |

## 4. Movie Menu
| Exact Menu/UI Path | PyMOL Functionality | MolStudio Status | Why NOT in Stage 1-3 | Browser Feasibility | Planned Stage | Priority Level |
|---|---|---|---|---|---|---|
| `Movie > Append > 1 second` | Adds frames to timeline | Missing | No timeline UI built yet | YES - RequestAnimationFrame | Stage 5 (Movie Engine) | High |
| `Movie > Program > Rock` | Auto-generates rocking motion | Missing | Requires keyframe interpolation | YES - WebGL rotations | Stage 5 (Movie Engine) | Medium |
| `Movie > Export As...` | Renders MP4/GIF | Missing | In-browser video encoding heavy | YES - WebCodecs API | Stage 5 (Movie Engine) | High |

## 5. Display Menu
| Exact Menu/UI Path | PyMOL Functionality | MolStudio Status | Why NOT in Stage 1-3 | Browser Feasibility | Planned Stage | Priority Level |
|---|---|---|---|---|---|---|
| `Display > Sequence` | Shows AA sequence at top | Partial | HTML overlay complexities | YES - DOM/React overlay | Stage 4 (Advanced Reps) | High |
| `Display > Background > White`| Changes canvas background | Implemented | N/A | YES - WebGL clearColor | N/A | Medium |
| `Display > Quality > Max` | Increases polygon/mesh count | Partial | Mobile performance concerns | YES - LOD scaling | Stage 4 (Advanced Reps) | Medium |

## 6. Setting Menu
| Exact Menu/UI Path | PyMOL Functionality | MolStudio Status | Why NOT in Stage 1-3 | Browser Feasibility | Planned Stage | Priority Level |
|---|---|---|---|---|---|---|
| `Setting > Transparency` | Adjusts surface alpha | Partial | Depth sorting in WebGL is hard | YES - OIT (Order Indep. Trans) | Stage 4 (Advanced Reps) | High |
| `Setting > Ray Tracing` | Configures shadow/reflection | Missing | Standard WebGL lacks raytracing | YES - WebGPU/WASM Raytracer | Stage 5 (Movie & Ray) | Medium |
| `Setting > Colors` | Edits palette | Implemented | N/A | YES - Standard color arrays | N/A | Low |

## 7. Scene Menu
| Exact Menu/UI Path | PyMOL Functionality | MolStudio Status | Why NOT in Stage 1-3 | Browser Feasibility | Planned Stage | Priority Level |
|---|---|---|---|---|---|---|
| `Scene > Append` | Saves camera/rep state (F1, F2) | Missing | Needs global state snapshotting | YES - Serialized JSON | Stage 5 (Movie Engine) | High |
| `Scene > Recall > F1` | Transitions to saved scene | Missing | Dependent on Scene Append | YES - Camera interpolation | Stage 5 (Movie Engine) | High |

## 8. Mouse Menu
| Exact Menu/UI Path | PyMOL Functionality | MolStudio Status | Why NOT in Stage 1-3 | Browser Feasibility | Planned Stage | Priority Level |
|---|---|---|---|---|---|---|
| `Mouse > Selection Mode > Residue`| Clicks select whole residues | Implemented | N/A | YES - Pointer events | N/A | Critical |
| `Mouse > 3 Button Viewing`| Standard mouse rotation/zoom | Implemented | N/A | YES - OrbitControls | N/A | Critical |
| `Mouse > Virtual Trackball` | Alternative rotation math | Missing | Low demand vs standard orbit | YES - Quaternion math | Stage 7 (UX Polish) | Low |

## 9. Wizard Menu
| Exact Menu/UI Path | PyMOL Functionality | MolStudio Status | Why NOT in Stage 1-3 | Browser Feasibility | Planned Stage | Priority Level |
|---|---|---|---|---|---|---|
| `Wizard > Measurement` | Point-to-point distance/angle | Partial | Basic distance only | YES - 3D Math + DOM Labels | Stage 6 (Wizards) | High |
| `Wizard > Mutagenesis` | Swaps AA and shows rotamers | Missing | Needs rotamer library | YES - Fetch library, overlay UI | Stage 6 (Wizards) | High |
| `Wizard > Density` | Contours electron density | Missing | Heavy parsing (CCP4/MTZ) | YES - WASM for Marching Cubes | Stage 6 (Wizards) | High |

## 10. Plugin Menu
| Exact Menu/UI Path | PyMOL Functionality | MolStudio Status | Why NOT in Stage 1-3 | Browser Feasibility | Planned Stage | Priority Level |
|---|---|---|---|---|---|---|
| `Plugin > Plugin Manager` | Installs Python scripts | Missing | Browsers don't run Python natively | NO - Needs Pyodide or JS API | Stage 8 (Extensions) | Low |
| `Plugin > APBS Electrostatics`| Calculates surface charge | Missing | Requires heavy C/Fortran binaries | YES - via Cloud API / WASM | Stage 8 (Extensions) | Medium |

## 11. Help Menu
| Exact Menu/UI Path | PyMOL Functionality | MolStudio Status | Why NOT in Stage 1-3 | Browser Feasibility | Planned Stage | Priority Level |
|---|---|---|---|---|---|---|
| `Help > Command Reference` | Opens HTML docs | Partial | App still evolving | YES - Iframe/External link | Stage 7 (UX Polish) | Low |
| `Help > About` | Version info | Implemented | N/A | YES - DOM | N/A | Low |

## 12. Toolbar Buttons
| Exact Menu/UI Path | PyMOL Functionality | MolStudio Status | Why NOT in Stage 1-3 | Browser Feasibility | Planned Stage | Priority Level |
|---|---|---|---|---|---|---|
| `Toolbar > Ray` | Triggers immediate raytrace | Missing | No raytracer yet | YES - WebGPU compute shader | Stage 5 (Movie & Ray) | Medium |
| `Toolbar > Builder` | Opens build pane | Missing | Not a priority for pure viewer | YES - React UI pane | Stage 6 (Wizards) | Medium |

## 13. Viewport Right-Click Menu
| Exact Menu/UI Path | PyMOL Functionality | MolStudio Status | Why NOT in Stage 1-3 | Browser Feasibility | Planned Stage | Priority Level |
|---|---|---|---|---|---|---|
| `R-Click > Center` | Centers camera on atom | Implemented | N/A | YES - Camera target translation | N/A | High |
| `R-Click > Mask` | Hides surrounding objects | Missing | Needs dynamic selection algebra | YES - Vis flags | Stage 4 (Advanced Reps) | Medium |

## 14. Object Panel (A/S/H/L/C)
| Exact Menu/UI Path | PyMOL Functionality | MolStudio Status | Why NOT in Stage 1-3 | Browser Feasibility | Planned Stage | Priority Level |
|---|---|---|---|---|---|---|
| `[A]ction > preset > b factor putty` | Styles as putty mapped to B-fact | Missing | Tube generation complex | YES - Custom geometry generation | Stage 4 (Advanced Reps) | High |
| `[S]how > cartoon` | Secondary structure ribbon | Implemented | N/A | YES - Spline extrusion | N/A | Critical |
| `[H]ide > lines` | Hides wireframe | Implemented | N/A | YES - Visibility toggles | N/A | Critical |
| `[L]abel > residues` | Adds C-alpha text labels | Partial | Canvas 2D text slow in 3D | YES - SDF Text Rendering / DOM | Stage 4 (Advanced Reps) | High |
| `[C]olor > spectrum > rainbow`| Colors N to C terminus | Implemented | N/A | YES - Vertex colors | N/A | High |

## 15. Selection Algebra Keywords
| Exact Menu/UI Path | PyMOL Functionality | MolStudio Status | Why NOT in Stage 1-3 | Browser Feasibility | Planned Stage | Priority Level |
|---|---|---|---|---|---|---|
| `select byres (chain A within 5 of resn LIG)` | Spatial queries | Missing | Spatial hashing/KD-Trees complex | YES - KD-Tree JS Implementation | Stage 4 (Advanced Edits) | Critical |
| `select (name CA+CB)` | Boolean atom name matching | Implemented | N/A | YES - Simple array filtering | N/A | Critical |

## 16. CLI Commands
| Exact Menu/UI Path | PyMOL Functionality | MolStudio Status | Why NOT in Stage 1-3 | Browser Feasibility | Planned Stage | Priority Level |
|---|---|---|---|---|---|---|
| `align obj1, obj2` | Superimposes structures | Missing | SVD Math required | YES - JS Math libraries (e.g., numeric.js) | Stage 6 (Wizards) | Critical |
| `symexp sym, obj1, (obj1), 5.0`| Generates symmetry mates | Missing | Requires parsing BIOMT/Spacegroup | YES - Matrix math applied to coordinates | Stage 6 (Wizards) | High |

## 17. Hotkeys
| Exact Menu/UI Path | PyMOL Functionality | MolStudio Status | Why NOT in Stage 1-3 | Browser Feasibility | Planned Stage | Priority Level |
|---|---|---|---|---|---|---|
| `PageUp / PageDown` | Cycle through scenes | Missing | Scenes not implemented | YES - DOM KeyboardEvent | Stage 5 (Movie Engine) | Medium |
| `Shift + Click` | Add/Remove from selection | Implemented | N/A | YES - PointerEvent modifiers | N/A | High |
