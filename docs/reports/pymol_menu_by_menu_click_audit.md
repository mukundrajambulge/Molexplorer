# PyMOL Menu-by-Menu Click Audit for MolStudio

## 1. File Menu
| Exact Menu Path | PyMOL Behavior | Current MolStudio Status | Why NOT in Stages 1-3 | Web Browser Feasibility | Planned Stage & Priority |
|-----------------|----------------|--------------------------|-----------------------|-------------------------|--------------------------|
| File > New Window | Opens a new PyMOL instance | Missing | Stage 1-3 focused on single workspace structure | YES - can open new browser tab/window | Stage 4, Low |
| File > Open | Opens local file browser | Implemented | N/A | YES - using HTML5 File API | N/A |
| File > Get PDB | Fetches PDB by 4-letter ID | Implemented | N/A | YES - CORS fetch from RCSB | N/A |
| File > Save Session | Saves current state (.pse) | Missing | State management was deferred for core visuals | YES - export JSON/custom blob via File API | Stage 5, High |
| File > Save Molecule | Exports coordinate file | Partial | Only basic export supported | YES - generating text blob | Stage 4, Medium |
| File > Save Image | Renders and saves PNG | Partial | Only basic screenshot, missing ray tracing | YES - canvas.toDataURL() | Stage 4, Medium |
| File > Save Movie | Exports frames as video | Missing | No movie rendering pipeline yet | YES - using WebCodecs API or MediaRecorder | Stage 7, Low |
| File > Working Directory | Changes local directory | Missing | Irrelevant for web context | NO - Browser restricts filesystem access | N/A |
| File > Log | Opens log file for commands | Missing | CLI history not fully persisted | YES - LocalStorage or IndexedDB | Stage 6, Low |
| File > Run Script | Executes python/pml script | Missing | Need Python/Pyodide integration | YES - via Pyodide/WebAssembly | Stage 5, High |
| File > Reinitialize | Resets scene completely | Partial | Hard reload needed | YES - state reset function | Stage 4, High |
| File > Quit | Closes application | Missing | Browsers don't allow tab closing scripts easily | NO - User closes tab naturally | N/A |

## 2. Edit Menu
| Exact Menu Path | PyMOL Behavior | Current MolStudio Status | Why NOT in Stages 1-3 | Web Browser Feasibility | Planned Stage & Priority |
|-----------------|----------------|--------------------------|-----------------------|-------------------------|--------------------------|
| Edit > Undo | Reverts last action | Missing | Complex state history needed | YES - Implement undo stack | Stage 6, High |
| Edit > Redo | Applies reverted action | Missing | Depends on Undo | YES - Implement redo stack | Stage 6, High |
| Edit > Copy | Copies selection | Missing | Serialization of objects not done | YES - Clipboard API (text/JSON) | Stage 6, Medium |
| Edit > Paste | Pastes copied selection | Missing | Depends on Copy | YES - Clipboard API | Stage 6, Medium |
| Edit > Find | Finds sequence/atoms | Missing | Advanced querying deferred | YES - text search over atoms | Stage 5, Medium |
| Edit > Clear Selection | Deselects all | Implemented | N/A | YES | N/A |

## 3. Build Menu
| Exact Menu Path | PyMOL Behavior | Current MolStudio Status | Why NOT in Stages 1-3 | Web Browser Feasibility | Planned Stage & Priority |
|-----------------|----------------|--------------------------|-----------------------|-------------------------|--------------------------|
| Build > Fragment library | Inserts predefined fragments | Missing | Building tools not prioritized | YES - load static fragment JSON | Stage 8, Low |
| Build > Residue builder | Adds specific residues | Missing | Building tools not prioritized | YES - internal geometry math | Stage 8, Low |
| Build > Sculpting | Real-time energy minimization | Missing | Requires force-field engine | YES - via WebAssembly (e.g. OpenMM/RDKit) | Stage 8, Low |
| Build > Cycle Valence | Changes bond orders | Missing | Editing coordinates not in scope | YES - update topology | Stage 8, Low |
| Build > Make Bond | Connects two atoms | Missing | Editing topology deferred | YES - update topology | Stage 8, Low |
| Build > Remove Bond | Deletes bond | Missing | Editing topology deferred | YES - update topology | Stage 8, Low |
| Build > Invert | Inverts stereochemistry | Missing | Math-heavy, deferred | YES - matrix transformations | Stage 8, Low |
| Build > Add H | Protonates structure | Missing | Needs pKa/valency logic | YES - via WebAssembly tools | Stage 8, Low |
| Build > Remove H | Deprotonates | Missing | Simple filtering deferred | YES - delete atoms matching H | Stage 4, Low |
| Build > Remove Atom | Deletes selection | Missing | Deletion logic deferred | YES - remove from data structure | Stage 5, Medium |

## 4. Movie Menu
| Exact Menu Path | PyMOL Behavior | Current MolStudio Status | Why NOT in Stages 1-3 | Web Browser Feasibility | Planned Stage & Priority |
|-----------------|----------------|--------------------------|-----------------------|-------------------------|--------------------------|
| Movie > Append | Adds frames to movie | Missing | Movie system not started | YES - keyframe timeline | Stage 7, Medium |
| Movie > Clear | Removes movie frames | Missing | Depends on Append | YES - clear timeline | Stage 7, Medium |
| Movie > Program Camera | Sets automated sweeps | Missing | Complex camera interpolation | YES - Three.js camera tweens | Stage 7, Medium |
| Movie > Frame Rate | Sets FPS playback | Missing | No movie playback | YES - requestAnimationFrame control | Stage 7, Low |
| Movie > Auto-Interpolate | Smooths camera path | Missing | Math heavy | YES - spline interpolation | Stage 7, Low |
| Movie > Ray Trace Frames | High quality movie export | Missing | Ray tracing not implemented | YES - slow WebGL/Canvas compute | Stage 7, Low |
| Movie > Update Scene | Updates current keyframe | Missing | No keyframes yet | YES - save camera state | Stage 7, Medium |

## 5. Display Menu
| Exact Menu Path | PyMOL Behavior | Current MolStudio Status | Why NOT in Stages 1-3 | Web Browser Feasibility | Planned Stage & Priority |
|-----------------|----------------|--------------------------|-----------------------|-------------------------|--------------------------|
| Display > Sequence | Shows sequence viewer | Partial | Basic viewer exists | YES - HTML/CSS overlay | Stage 4, High |
| Display > Sequence Mode | Changes seq display format | Missing | Deemed low priority | YES - string manipulation | Stage 4, Medium |
| Display > Background color| Changes canvas background | Implemented | N/A | YES - Three.js scene.background | N/A |
| Display > Color Space | RGB/CMYK etc. | Missing | Not relevant for basic web | YES - color math | Stage 8, Low |
| Display > Quality LOD | Changes geometry detail | Missing | WebGL optimization handles this | YES - dynamic geometry detail | Stage 5, High |
| Display > Grid mode | Displays multi-objects in grid | Missing | Complex layout | YES - multi-viewport WebGL | Stage 6, Medium |
| Display > Orthoscopic | Orthographic camera | Implemented | N/A | YES - THREE.OrthographicCamera | N/A |
| Display > Stereo | 3D stereo modes | Missing | Specialized hardware | YES - WebXR / Anaglyph | Stage 8, Low |
| Display > Zoom/Center | Centers camera on object | Implemented | N/A | YES - bounding box math | N/A |
| Display > Depth Cue | Adds fog/depth fading | Partial | Basic fog exists | YES - WebGL fog | Stage 4, Medium |
| Display > Two-sided lighting| Renders backfaces | Missing | Performance trade-off | YES - WebGL DoubleSide material | Stage 5, Low |

## 6. Setting Menu
| Exact Menu Path | PyMOL Behavior | Current MolStudio Status | Why NOT in Stages 1-3 | Web Browser Feasibility | Planned Stage & Priority |
|-----------------|----------------|--------------------------|-----------------------|-------------------------|--------------------------|
| Setting > Transparency | Sets alpha values | Partial | Global alpha only | YES - WebGL blending | Stage 4, High |
| Setting > Cartoon styles | Modifies ribbon shapes | Missing | Only basic ribbons done | YES - custom tube/ribbon generation | Stage 5, Medium |
| Setting > Surface probe | Adjusts SASA probe size | Missing | Heavy compute deferred | YES - compute shaders/WASM | Stage 6, Medium |
| Setting > Label font | Changes label styling | Missing | Basic text only | YES - Canvas/HTML labels | Stage 4, Medium |
| Setting > Rendering shadows| Toggles shadows | Missing | Performance heavy | YES - WebGL shadow maps | Stage 5, High |
| Setting > Stick/Sphere radii| Adjusts geometry size | Partial | Hardcoded sizes mostly | YES - uniform updates | Stage 4, High |

## 7. Scene Menu
| Exact Menu Path | PyMOL Behavior | Current MolStudio Status | Why NOT in Stages 1-3 | Web Browser Feasibility | Planned Stage & Priority |
|-----------------|----------------|--------------------------|-----------------------|-------------------------|--------------------------|
| Scene > Next | Goes to next scene | Missing | Scene management deferred | YES - state arrays | Stage 5, High |
| Scene > Previous | Goes to prev scene | Missing | Scene management deferred | YES - state arrays | Stage 5, High |
| Scene > Append F1-F12 | Saves scene to hotkey | Missing | Scene management deferred | YES - keyboard listeners + state | Stage 5, High |
| Scene > Insert | Inserts scene | Missing | Scene management deferred | YES - array splice | Stage 5, Medium |
| Scene > Update | Overwrites scene | Missing | Scene management deferred | YES - object replacement | Stage 5, Medium |
| Scene > Delete | Removes scene | Missing | Scene management deferred | YES - array removal | Stage 5, Medium |
| Scene > Clear All | Removes all scenes | Missing | Scene management deferred | YES - array clear | Stage 5, Medium |
| Scene > Buttons | Toggles scene UI buttons | Missing | UI deferred | YES - React components | Stage 5, Low |

## 8. Mouse Menu
| Exact Menu Path | PyMOL Behavior | Current MolStudio Status | Why NOT in Stages 1-3 | Web Browser Feasibility | Planned Stage & Priority |
|-----------------|----------------|--------------------------|-----------------------|-------------------------|--------------------------|
| Mouse > 3-Button | Standard controls | Implemented | N/A | YES - Pointer events | N/A |
| Mouse > 2-Button | Trackpad controls | Partial | Default OrbitControls | YES - Pointer events | Stage 4, Medium |
| Mouse > Selection Mode | Atom/Res/Chain level | Partial | Atom/Res level mostly | YES - traversing hierarchy | Stage 4, High |
| Mouse > Virtual Trackball | Alternative rotation | Missing | OrbitControls preferred | YES - custom math | Stage 8, Low |

## 9. Wizard Menu
| Exact Menu Path | PyMOL Behavior | Current MolStudio Status | Why NOT in Stages 1-3 | Web Browser Feasibility | Planned Stage & Priority |
|-----------------|----------------|--------------------------|-----------------------|-------------------------|--------------------------|
| Wizard > Measurement | Distance/Angle clicks | Missing | UI/math combo deferred | YES - distance math + labels | Stage 5, High |
| Wizard > Mutagenesis | Swaps sidechains | Missing | Structural editing deferred | YES - rotamer libraries in WASM | Stage 8, Low |
| Wizard > Pair Fitting | Aligns two structures | Missing | RMSD math deferred | YES - SVD matrix math | Stage 6, High |
| Wizard > Density | Maps electron density | Missing | Volumetric rendering hard | YES - WebGL 3D textures | Stage 7, Medium |
| Wizard > Charge | Visualizes APBS/charges | Missing | No charge data processed | YES - vertex coloring | Stage 6, Medium |
| Wizard > Appearance | Quick visual presets | Missing | Focus on core first | YES - preset state macros | Stage 5, Medium |
| Wizard > Sculpting | Interactive minimization | Missing | Needs forcefield | YES - WASM | Stage 8, Low |
| Wizard > Demos | Built-in tutorials | Missing | Unnecessary for core | YES - scripted macros | Stage 8, Low |

## 10. Plugin Menu
| Exact Menu Path | PyMOL Behavior | Current MolStudio Status | Why NOT in Stages 1-3 | Web Browser Feasibility | Planned Stage & Priority |
|-----------------|----------------|--------------------------|-----------------------|-------------------------|--------------------------|
| Plugin > Plugin Manager | Installs 3rd party scripts | Missing | Extensibility deferred | YES - WASM or JS modules | Stage 8, Low |
| Plugin > APBS | Poisson-Boltzmann electrostatics | Missing | Heavy compute | YES - WASM compilation of APBS | Stage 8, Low |
| Plugin > PDB Loader | Alternative loaders | Implemented | N/A (Web native fetch) | YES | N/A |
| Plugin > Symmetry Mate | Generates crystal packing | Missing | Matrix expansion deferred | YES - parsing CRYST1 + matrices | Stage 6, Medium |

## 11. Help Menu
| Exact Menu Path | PyMOL Behavior | Current MolStudio Status | Why NOT in Stages 1-3 | Web Browser Feasibility | Planned Stage & Priority |
|-----------------|----------------|--------------------------|-----------------------|-------------------------|--------------------------|
| Help > About | Shows version info | Missing | Low priority | YES - simple modal | Stage 4, Low |
| Help > Online Docs | Opens wiki | Missing | External link | YES - target="_blank" | Stage 4, Low |
| Help > Commands | Shows CLI ref | Missing | CLI incomplete | YES - static HTML/JSON | Stage 5, Low |
| Help > Hotkeys | Shows shortcuts | Missing | Keymap incomplete | YES - simple modal | Stage 4, Medium |
