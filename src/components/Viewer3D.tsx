import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import * as $3Dmol from "3dmol";
import { ViewState, MoleculeData, FilterState, MeasureMode, Measurement } from "../types";
import { getRDKit } from "../lib/rdkit";
import { RotateCw, Maximize, MousePointer2, Ruler, Triangle, Box, X, Download } from "lucide-react";

function getFibonacciSpherePoints(samples: number = 16) {
  const pts: { x: number; y: number; z: number }[] = [];
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < samples; i++) {
    const y = 1 - (i / (samples - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = phi * i;
    pts.push({ x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius });
  }
  return pts;
}

// Helper to generate a fake Gaussian cube file for demo purposes.
// In a production app, this would be computed by a PySCF backend and served as a file.
function generateMockCube(atoms: any[], type: "density" | "homo_lumo", isPerformanceMode: boolean): string {
  if (!atoms || atoms.length === 0) return "";
  
  // Find bounding box
  let min = {x: 1000, y: 1000, z: 1000};
  let max = {x: -1000, y: -1000, z: -1000};
  atoms.forEach(a => {
    if (a.x < min.x) min.x = a.x; if (a.y < min.y) min.y = a.y; if (a.z < min.z) min.z = a.z;
    if (a.x > max.x) max.x = a.x; if (a.y > max.y) max.y = a.y; if (a.z > max.z) max.z = a.z;
  });
  
  const pad = 4.0; // Angstroms padding
  const step = isPerformanceMode ? 1.0 : 0.5; // Grid spacing in Angstroms (coarser for performance mode)
  const bohr = 1.8897259886; // Conversion from Angstroms to Bohr (cube files use Bohr)
  
  const nx = Math.ceil((max.x - min.x + 2*pad) / step);
  const ny = Math.ceil((max.y - min.y + 2*pad) / step);
  const nz = Math.ceil((max.z - min.z + 2*pad) / step);
  
  const originX = (min.x - pad) * bohr;
  const originY = (min.y - pad) * bohr;
  const originZ = (min.z - pad) * bohr;
  
  const stepBohr = step * bohr;
  
  let out = "Mock QM Density Demo\nGenerated in browser\n";
  out += `${atoms.length} ${originX.toFixed(6)} ${originY.toFixed(6)} ${originZ.toFixed(6)}\n`;
  out += `${nx} ${stepBohr.toFixed(6)} 0.000000 0.000000\n`;
  out += `${ny} 0.000000 ${stepBohr.toFixed(6)} 0.000000\n`;
  out += `${nz} 0.000000 0.000000 ${stepBohr.toFixed(6)}\n`;
  
  atoms.forEach(a => {
    // Atomic number roughly approximated
    let z = 6;
    if (a.elem === 'H') z = 1; else if (a.elem === 'N') z = 7; else if (a.elem === 'O') z = 8;
    out += `${z} ${z}.000000 ${(a.x * bohr).toFixed(6)} ${(a.y * bohr).toFixed(6)} ${(a.z * bohr).toFixed(6)}\n`;
  });
  
  // Precompute atom positions in Bohr
  const aPos = atoms.map(a => ({x: a.x*bohr, y: a.y*bohr, z: a.z*bohr, elem: a.elem}));
  
  let valStr = "";
  let col = 0;
  for (let i = 0; i < nx; i++) {
    const x = originX + i * stepBohr;
    for (let j = 0; j < ny; j++) {
      const y = originY + j * stepBohr;
      for (let k = 0; k < nz; k++) {
        const z = originZ + k * stepBohr;
        
        let val = 0;
        aPos.forEach((a, idx) => {
          const d2 = (x - a.x)*(x - a.x) + (y - a.y)*(y - a.y) + (z - a.z)*(z - a.z);
          // Fake Gaussian function
          const alpha = a.elem === 'H' ? 1.0 : 0.5;
          let weight = Math.exp(-alpha * d2);
          if (type === "homo_lumo") {
             // Alternate sign based on atom index for HOMO/LUMO lobes
             weight *= (idx % 2 === 0 ? 1 : -1);
          }
          val += weight;
        });
        
        valStr += val.toExponential(5) + " ";
        col++;
        if (col === 6) {
          valStr += "\n";
          col = 0;
        }
      }
    }
  }
  out += valStr;
  return out;
}

interface Viewer3DProps {
  molecule: MoleculeData | null;
  compareMolecule?: MoleculeData | null;
  viewState: ViewState;
  filters?: FilterState;
  onViewStateChange?: (state: ViewState) => void;
}

const Viewer3D = forwardRef(({ molecule, compareMolecule, viewState, filters, onViewStateChange }: Viewer3DProps, ref) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const glViewerRef = useRef<any>(null);
  
  const [isSpinning, setIsSpinning] = useState(false);
  const [measureMode, setMeasureMode] = useState<MeasureMode>("info");
  const [selectedAtoms, setSelectedAtoms] = useState<any[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [hoveredAtomInfo, setHoveredAtomInfo] = useState<any | null>(null);
  const [modelsLoadedTimestamp, setModelsLoadedTimestamp] = useState(0);
  const [displayMode, setDisplayMode] = useState<"2D" | "3D">("3D");
  const [svg2D, setSvg2D] = useState<string>("");
  const [presentElements, setPresentElements] = useState<string[]>([]);

  useEffect(() => {
    if (displayMode === "3D" && glViewerRef.current) {
      setTimeout(() => {
        glViewerRef.current.resize();
        glViewerRef.current.render();
      }, 50);
    }
  }, [displayMode]);

  useEffect(() => {
    if (displayMode === "2D" && molecule) {
      setSvg2D("");
      getRDKit().then(rdkit => {
        try {
          let mol;
          // Prefer SMILES for 2D layout as it generates cleaner 2D coordinates
          if (molecule.smiles) {
             try {
                mol = rdkit.get_mol(molecule.smiles);
             } catch(e) {}
          } 
          if (!mol && molecule.rawContent) {
             try {
                mol = rdkit.get_mol(molecule.rawContent);
             } catch(e) {}
          }
          
          if (mol) {
            try {
               // Get SVG, passing empty string for default options
               const svg = mol.get_svg();
               if (svg) {
                  setSvg2D(svg);
               } else {
                  setSvg2D("<div class='text-red-500 font-mono text-xs'>Failed to generate SVG graphic.</div>");
               }
            } catch (err: any) {
               console.error("Error in get_svg:", err);
               setSvg2D(`<div class='text-red-500 font-mono text-xs'>Error generating 2D layout: ${err.message || 'Unknown error'}</div>`);
            }
            mol.delete();
          } else {
             setSvg2D("<div class='text-red-500 font-mono text-xs'>Failed to parse molecule for 2D. (RDKit failed to load molecule)</div>");
          }
        } catch (e: any) {
          console.error("Error generating 2D SVG:", e);
          setSvg2D(`<div class='text-red-500 font-mono text-xs'>Error generating 2D layout: ${e.message || 'Unknown error'}</div>`);
        }
      }).catch((e) => {
        console.error("RDKit failed to load:", e);
        setSvg2D("<div class='text-red-500 font-mono text-xs'>RDKit engine failed to load.</div>");
      });
    }
  }, [displayMode, molecule]);

  const handleResetCamera = () => {
    if (glViewerRef.current) {
      glViewerRef.current.zoomTo();
      glViewerRef.current.render();
    }
  };

  const handleSpinToggle = () => {
    if (glViewerRef.current) {
      const newSpinning = !isSpinning;
      setIsSpinning(newSpinning);
      glViewerRef.current.spin(newSpinning);
    }
  };

  useImperativeHandle(ref, () => ({
    getViewer: () => glViewerRef.current
  }));

  useEffect(() => {
    if (!viewerRef.current) return;

    // Initialize 3Dmol viewer
    const config = { 
      defaultcolors: $3Dmol.elementColors.rasmol,
      backgroundColor: viewState.canvasBackground === "white" ? "white" : (viewState.canvasBackground === "#f5f5f5" ? "#f5f5f5" : "#0A0A0A")
    };
    const viewer = $3Dmol.createViewer(viewerRef.current, config);
    glViewerRef.current = viewer;

    const resizeObserver = new ResizeObserver(() => {
      if (glViewerRef.current) {
        glViewerRef.current.resize();
        glViewerRef.current.render();
      }
    });

    const container = viewerRef.current;
    
    if (container) {
      resizeObserver.observe(container);
    }

    return () => {
      resizeObserver.disconnect();
      viewer.clear();
    };
  }, []);

  const selectedAtomsRef = useRef<any[]>([]);

  const [isLegendMinimized, setIsLegendMinimized] = useState(false);
  const [demoDensityType, setDemoDensityType] = useState<"density"|"homo_lumo">("density");
  const [demoIsoval, setDemoIsoval] = useState(0.02);
  const [demoOpacity, setDemoOpacity] = useState(0.5);

  useEffect(() => {
    selectedAtomsRef.current = selectedAtoms;
  }, [selectedAtoms]);

  useEffect(() => {
    const viewer = glViewerRef.current;
    if (!viewer) return;

    if (measureMode === "none") {
      viewer.setClickable({}, false);
      setSelectedAtoms([]);
      setHoveredAtomInfo(null);
      // Remove measurement spheres when exiting measure mode
      viewer.removeAllShapes();
      viewer.removeAllLabels();
      // Re-render measurements that were saved
      measurements.forEach(m => {
        // Redraw saved measurements? We don't have their coordinates easily unless we save them.
        // For now, let's keep it simple.
      });
      viewer.render();
      return;
    }

    let hoverShape: any = null;
    let lastClickTime = 0;
    let lastClickedAtomSerial = -1;

    viewer.setHoverable({}, true, 
      (atom: any) => {
        if (!atom) return;
        if (hoverShape) {
          viewer.removeShape(hoverShape);
        }
        // visual cue without breaking existing styles permanently
        hoverShape = viewer.addSphere({ center: { x: atom.x, y: atom.y, z: atom.z }, radius: 0.4, color: '#F27D26', alpha: 0.5 });
        viewer.render();
      }, 
      (atom: any) => {
        if (hoverShape) {
          viewer.removeShape(hoverShape);
          hoverShape = null;
          viewer.render();
        }
      }
    );

    viewer.setClickable({}, true, (atom: any) => {
      console.log("Atom clicked!", atom);
      
      const now = Date.now();
      if (now - lastClickTime < 300 && lastClickedAtomSerial === atom.serial) {
         // Double click detected! Center and zoom
         viewer.zoomTo({serial: atom.serial});
         viewer.render();
         lastClickTime = 0;
         return;
      }
      lastClickTime = now;
      lastClickedAtomSerial = atom.serial;
      
      let newSel = [...selectedAtomsRef.current];
      
      if (measureMode === "info") {
        setHoveredAtomInfo(atom);
        // Toggle selection in info mode
        const existingIdx = newSel.findIndex(a => a.serial === atom.serial);
        if (existingIdx >= 0) {
           newSel.splice(existingIdx, 1);
        } else {
           newSel.push(atom);
        }
      } else {
        newSel.push(atom);
      }
      
      setSelectedAtoms(newSel);
      
      if (measureMode === "info") {
        // Handled by the useEffect watching selectedAtoms (we will add it)
        return;
      }
      
      if (measureMode === "distance" && newSel.length === 2) {
        const d = Math.sqrt(
          Math.pow(newSel[0].x - newSel[1].x, 2) + 
          Math.pow(newSel[0].y - newSel[1].y, 2) + 
          Math.pow(newSel[0].z - newSel[1].z, 2)
        );
        viewer.addLabel(d.toFixed(2) + " Å", {
          position: { x: (newSel[0].x + newSel[1].x)/2, y: (newSel[0].y + newSel[1].y)/2, z: (newSel[0].z + newSel[1].z)/2 },
          backgroundColor: 'black', fontColor: 'white', backgroundOpacity: 0.8, fontSize: 14
        });
        setMeasurements(m => [...m, { id: Date.now().toString(), name: `Distance ${newSel[0].elem}-${newSel[1].elem}`, type: "distance", atoms: [newSel[0].serial, newSel[1].serial], value: d }]);
        viewer.render();
        setSelectedAtoms([]); // Reset
        return;
      }

      if (measureMode === "angle" && newSel.length === 3) {
        // Calculate angle between p0-p1-p2 where p1 is the middle atom
        const [p0, p1, p2] = newSel;
        const v1 = { x: p0.x - p1.x, y: p0.y - p1.y, z: p0.z - p1.z };
        const v2 = { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z };
        const dot = v1.x*v2.x + v1.y*v2.y + v1.z*v2.z;
        const mag1 = Math.sqrt(v1.x*v1.x + v1.y*v1.y + v1.z*v1.z);
        const mag2 = Math.sqrt(v2.x*v2.x + v2.y*v2.y + v2.z*v2.z);
        const angle = Math.acos(dot / (mag1 * mag2)) * (180 / Math.PI);
        
        viewer.addLabel(angle.toFixed(1) + "°", {
          position: { x: p1.x, y: p1.y + 1, z: p1.z },
          backgroundColor: 'black', fontColor: 'white', backgroundOpacity: 0.8, fontSize: 14
        });
        setMeasurements(m => [...m, { id: Date.now().toString(), name: `Angle ${p0.elem}-${p1.elem}-${p2.elem}`, type: "angle", atoms: [p0.serial, p1.serial, p2.serial], value: angle }]);
        viewer.render();
        setSelectedAtoms([]); // Reset
        return;
      }

      if (measureMode === "dihedral" && newSel.length === 4) {
        const [p0, p1, p2, p3] = newSel;
        
        const v1 = { x: p1.x - p0.x, y: p1.y - p0.y, z: p1.z - p0.z };
        const v2 = { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z };
        const v3 = { x: p3.x - p2.x, y: p3.y - p2.y, z: p3.z - p2.z };
        
        const cross = (a: any, b: any) => ({ x: a.y*b.z - a.z*b.y, y: a.z*b.x - a.x*b.z, z: a.x*b.y - a.y*b.x });
        const n1 = cross(v1, v2);
        const n2 = cross(v2, v3);
        
        const n1mag = Math.sqrt(n1.x*n1.x + n1.y*n1.y + n1.z*n1.z);
        const n2mag = Math.sqrt(n2.x*n2.x + n2.y*n2.y + n2.z*n2.z);
        
        let dihed = 0;
        if (n1mag > 0 && n2mag > 0) {
            const dot = (n1.x*n2.x + n1.y*n2.y + n1.z*n2.z) / (n1mag * n2mag);
            dihed = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
            
            // sign
            const m = cross(n1, n2);
            const sign = (m.x*v2.x + m.y*v2.y + m.z*v2.z) > 0 ? 1 : -1;
            dihed *= sign;
        }

        viewer.addLabel(dihed.toFixed(1) + "°", {
          position: { x: (p1.x+p2.x)/2, y: (p1.y+p2.y)/2 + 1, z: (p1.z+p2.z)/2 },
          backgroundColor: 'black', fontColor: 'white', backgroundOpacity: 0.8, fontSize: 14
        });
        setMeasurements(m => [...m, { id: Date.now().toString(), name: `Dihedral ${p0.elem}-${p1.elem}-${p2.elem}-${p3.elem}`, type: "dihedral", atoms: [p0.serial, p1.serial, p2.serial, p3.serial], value: dihed }]);
        viewer.render();
        setSelectedAtoms([]); // Reset
        return;
      }
    });
    viewer.render();

  }, [measureMode, modelsLoadedTimestamp, measurements]);

  // Track selection spheres to safely remove them
  const selectionShapesRef = useRef<any[]>([]);

  useEffect(() => {
    selectedAtomsRef.current = selectedAtoms;
    const viewer = glViewerRef.current;
    if (!viewer) return;
    
    // Remove old shapes
    selectionShapesRef.current.forEach(shape => {
      viewer.removeShape(shape);
    });
    selectionShapesRef.current = [];
    
    // Add new shapes
    selectedAtoms.forEach(atom => {
       const shape = viewer.addSphere({ center: { x: atom.x, y: atom.y, z: atom.z }, radius: 0.35, color: 'orange', alpha: 0.6 });
       selectionShapesRef.current.push(shape);
    });
    
    viewer.render();
  }, [selectedAtoms]);

  // Handle background color independently
  useEffect(() => {
    const viewer = glViewerRef.current;
    if (viewer) {
      viewer.setBackgroundColor(viewState.canvasBackground === "white" ? "white" : (viewState.canvasBackground === "#f5f5f5" ? "#f5f5f5" : "#0A0A0A"));
      viewer.render();
    }
  }, [viewState.canvasBackground]);

  useEffect(() => {
    const viewer = glViewerRef.current;
    if (!viewer) return;

    viewer.clear();

    const loadModels = async () => {
       if (!molecule || !molecule.rawContent) return;
       
       viewer.clear();
       const format = molecule.format.toLowerCase();
       
       try {
         let mol1Content = molecule.rawContent;
         let mol2Content = compareMolecule?.rawContent;

         // Attempt alignment if compareMolecule exists
         if (compareMolecule && compareMolecule.rawContent && format !== 'mmtf' && compareMolecule.format.toLowerCase() !== 'mmtf') {
            try {
               const rdkit = await getRDKit();
               const m1 = rdkit.get_mol(mol1Content as string);
               const m2 = rdkit.get_mol(mol2Content as string);
               if (m1 && m2 && m1.has_coords() && m2.has_coords()) {
                  // align m2 to m1
                  try {
                     const match = m2.generate_aligned_coords(m1);
                     mol2Content = m2.get_molblock();
                  } catch(e) {
                     console.warn("Alignment failed", e);
                  }
               }
               if (m1) m1.delete();
               if (m2) m2.delete();
            } catch(e) {}
         }

         const m1_model = viewer.addModel(mol1Content, format);
         
         const atomList = m1_model.selectedAtoms({});
         const elems = new Set<string>();
         atomList.forEach((a: any) => {
           if (a.elem) elems.add(a.elem);
         });
         setPresentElements(Array.from(elems));
         
         if (format === 'cube') {
           viewer.addVolumetricData(mol1Content, "cube", {isoval: 0.02, color: "blue", alpha: 0.85, opacity: 0.85});
           viewer.addVolumetricData(mol1Content, "cube", {isoval: -0.02, color: "red", alpha: 0.85, opacity: 0.85});
         }
         
         applyViewState(viewer, viewState, filters);
         applyFilters(viewer, filters, molecule, viewState);

         if (compareMolecule && mol2Content) {
            const m2_model = viewer.addModel(mol2Content, compareMolecule.format.toLowerCase());
            // apply a distinct style to the comparison molecule (e.g., green wireframe/sticks)
            m2_model.setStyle({}, { stick: { colorscheme: 'greenCarbon', radius: 0.15 }, sphere: { hidden: true } });
         }
         
         viewer.zoomTo();
         viewer.render();
         setModelsLoadedTimestamp(Date.now());
       } catch (e) {
         console.error("Error loading molecule in 3Dmol:", e);
       }
    };
    
    loadModels();
  }, [molecule, compareMolecule, viewState, filters, demoDensityType, demoIsoval, demoOpacity]);

  const applyFilters = async (viewer: any, filters: FilterState | undefined, molData: MoleculeData, currentViewState: ViewState) => {
    if (!filters) return;
    
    // Process visual properties using RDKit if needed (like SMARTS or Stereocenters)
    if (filters.visualSmarts || filters.showStereoCenters) {
      try {
        const rdkit = await getRDKit();
        const mol = rdkit.get_mol(molData.rawContent || molData.smiles);
        if (mol) {
          
          if (filters.visualSmarts) {
            let qmol;
            try { qmol = rdkit.get_qmol(filters.visualSmarts); } catch(e) {}
            if (qmol) {
              const matchesJSON = mol.get_substruct_matches(qmol);
              if (matchesJSON) {
                 const matches = JSON.parse(matchesJSON);
                 if (Array.isArray(matches)) {
                   const matchIndices = matches.map((m: any) => m.atoms).flat();
                   if (matchIndices.length > 0) {
                     const color = '#F27D26';
                     const highlightStyle: any = {};
                     
                     if (currentViewState.renderStyle === "Line") highlightStyle.line = {color, radius: 0.15};
                     else if (currentViewState.renderStyle === "Stick") highlightStyle.stick = {color, radius: 0.2};
                     else if (currentViewState.renderStyle === "Ball-and-Stick") {
                        highlightStyle.stick = {color, radius: 0.15};
                        highlightStyle.sphere = {color, scale: 0.35};
                     } else if (currentViewState.renderStyle === "Space-Filling") {
                        highlightStyle.sphere = {color};
                     } else {
                        // For surface styles, stick is a good fallback overlay
                        highlightStyle.stick = {color, radius: 0.2};
                     }

                     viewer.setStyle({serial: matchIndices}, highlightStyle);
                     viewer.setStyle({index: matchIndices}, highlightStyle);
                   }
                 }
              }
              qmol.delete();
            }
          }

          if (filters.showStereoCenters) {
             let qmol;
             try { qmol = rdkit.get_qmol('[C@],[C@@]'); } catch(e) {}
             if (qmol) {
               const matchesJSON = mol.get_substruct_matches(qmol);
               if (matchesJSON) {
                 const stereoMatches = JSON.parse(matchesJSON);
                 if (Array.isArray(stereoMatches)) {
                   const stereoIndices = stereoMatches.map((m: any) => m.atoms).flat();
                   viewer.addStyle({index: stereoIndices}, {
                     sphere: { radius: 0.6, color: 'purple' }
                   });
                   viewer.addLabel("R/S", {fontColor: 'white', backgroundColor: 'purple', backgroundOpacity: 0.8}, {index: stereoIndices});
                 }
               }
               qmol.delete();
             }
          }

          mol.delete();
          viewer.render();
        }
      } catch(e) {
        console.error("Failed to apply advanced visual filters", e);
      }
    }
  };

  const applyViewState = (viewer: any, state: ViewState, filters?: FilterState) => {
    // 1. Base styles
    let baseStyle: any = {};
    if (state.renderStyle === "Line") baseStyle.line = {};
    else if (state.renderStyle === "Stick") baseStyle.stick = {};
    else if (state.renderStyle === "Ball-and-Stick") {
      baseStyle.stick = {};
      baseStyle.sphere = { scale: 0.3 };
    }
    else if (state.renderStyle === "Space-Filling") baseStyle.sphere = {};
    else if (state.renderStyle.includes("Surface") || state.renderStyle === "Mesh" || state.renderStyle === "Dots") {
      // Always render a base style under the surface so it's clickable
      baseStyle.line = {}; 
    } else if (state.renderStyle === "Non-bonded (small spheres)") {
      baseStyle.sphere = { hidden: true };
      baseStyle.stick = { hidden: true };
      baseStyle.line = { hidden: true };
    } else {
      baseStyle.stick = {};
    }

    // 2. Color Theme
    let colorProps: any = {};
    
    // Explicitly nullify color so it doesn't get inherited if 3Dmol tries to merge styles
    colorProps.color = undefined;

    if (state.colorTheme === "Classic CPK") {
       colorProps.colorscheme = "rasmol";
    } else if (state.colorTheme === "Modern/Jmol") {
       colorProps.colorscheme = "Jmol";
    } else if (state.colorTheme === "By Formal Charge" || state.colorTheme === "By Partial Charge" || state.colorTheme === "ESP") {
       colorProps.colorscheme = {
         prop: 'partialCharge',
         gradient: 'rwb',
         min: -1,
         max: 1
       };
    } else if (state.colorTheme === "Monochrome") {
       colorProps.color = "#B0B0B0";
       colorProps.colorscheme = undefined;
    } else if (state.colorTheme === "Hydrophobicity") {
       colorProps.colorscheme = "hydrophobicity";
    } else if (state.colorTheme === "Rainbow") {
       let maxAtoms = 100;
       try { maxAtoms = viewer.getModel().atoms.length || 100; } catch(e) {}
       colorProps.colorscheme = {prop: 'index', gradient: 'sinebow', min: 0, max: maxAtoms};
    } else {
       colorProps.colorscheme = "Jmol";
    }

    // Apply color props to all defined base styles
    Object.keys(baseStyle).forEach(key => {
       if (typeof baseStyle[key] === 'object') {
          if (colorProps.color) {
            baseStyle[key].color = colorProps.color;
            delete baseStyle[key].colorscheme;
          } else if (colorProps.colorscheme) {
            baseStyle[key].colorscheme = colorProps.colorscheme;
            delete baseStyle[key].color;
          }
       }
    });

    // Reset styles completely first to ensure old color cache is wiped
    viewer.setStyle({}, baseStyle);

    if (state.renderStyle === "Non-bonded (small spheres)") {
       const atoms = viewer.getModel().atoms;
       const nonBondedAtoms = atoms.filter((a: any) => a.bonds.length === 0);
       if (nonBondedAtoms.length > 0) {
          viewer.setStyle({serial: nonBondedAtoms.map((a: any) => a.serial)}, {sphere: {scale: 0.2}});
       }
    }

    // Filter hydrogens if requested
    if (!state.showHydrogens) {
      viewer.setStyle({elem: 'H'}, {hidden: true});
    }

    if (filters && filters.hiddenElements && filters.hiddenElements.length > 0) {
      filters.hiddenElements.forEach(elem => {
        if (elem.match(/^[A-Z][a-z]?$/i)) {
           const formattedElem = elem.charAt(0).toUpperCase() + elem.slice(1).toLowerCase();
           viewer.setStyle({elem: formattedElem}, {hidden: true});
        }
      });
    }

    // Surface
    viewer.removeAllSurfaces();
    if (state.renderStyle === "Van der Waals Surface") {
      viewer.addSurface($3Dmol.SurfaceType.VDW, { opacity: state.surfaceOpacity, ...colorProps });
    } else if (state.renderStyle === "Solvent-Accessible Surface") {
      viewer.addSurface(state.performanceMode ? $3Dmol.SurfaceType.VDW : $3Dmol.SurfaceType.SAS, { opacity: state.surfaceOpacity, ...colorProps });
    } else if (state.renderStyle === "Solvent-Excluded Surface") {
      viewer.addSurface(state.performanceMode ? $3Dmol.SurfaceType.VDW : $3Dmol.SurfaceType.SES, { opacity: state.surfaceOpacity, ...colorProps });
    } else if (state.renderStyle === "Mesh") {
      viewer.addSurface($3Dmol.SurfaceType.VDW, { wireframe: true, opacity: state.surfaceOpacity, ...colorProps });
    } else if (state.renderStyle === "Dots") {
      const atoms = viewer.getModel()?.atoms || [];
      const fibPoints = getFibonacciSpherePoints(16);
      const vdwRadii: Record<string, number> = {
        H: 1.20, C: 1.70, N: 1.55, O: 1.52, F: 1.47, P: 1.80, S: 1.80, CL: 1.75, BR: 1.85, I: 1.98
      };
      const atomData = atoms.map((a: any) => ({
        x: a.x, y: a.y, z: a.z,
        r: vdwRadii[(a.elem || '').toUpperCase().trim()] || 1.70,
        color: a.color || '#3b82f6'
      }));
      const cellSize = 5.0;
      const grid = new Map<string, typeof atomData>();
      atomData.forEach((atom: any) => {
        const key = `${Math.floor(atom.x / cellSize)},${Math.floor(atom.y / cellSize)},${Math.floor(atom.z / cellSize)}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key)!.push(atom);
      });
      atomData.forEach((atom: any) => {
        const gx = Math.floor(atom.x / cellSize);
        const gy = Math.floor(atom.y / cellSize);
        const gz = Math.floor(atom.z / cellSize);
        const neighbors: typeof atomData = [];
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dz = -1; dz <= 1; dz++) {
              const bucket = grid.get(`${gx + dx},${gy + dy},${gz + dz}`);
              if (bucket) neighbors.push(...bucket);
            }
          }
        }
        for (let p = 0; p < fibPoints.length; p++) {
          const u = fibPoints[p];
          const px = atom.x + u.x * atom.r;
          const py = atom.y + u.y * atom.r;
          const pz = atom.z + u.z * atom.r;
          let isBuried = false;
          for (let n = 0; n < neighbors.length; n++) {
            const neighbor = neighbors[n];
            if (neighbor === atom) continue;
            const d2 = (px - neighbor.x) ** 2 + (py - neighbor.y) ** 2 + (pz - neighbor.z) ** 2;
            if (d2 < (neighbor.r - 0.05) ** 2) {
              isBuried = true;
              break;
            }
          }
          if (!isBuried) {
            viewer.addSphere({
              center: { x: px, y: py, z: pz },
              radius: 0.10,
              color: atom.color,
              opacity: 1.0
            });
          }
        }
      });
    }

    if (state.electronCloudMode === "Illustrative Approximation") {
       viewer.addSurface($3Dmol.SurfaceType.VDW, { opacity: 0.15, color: '#4488ff' });
    } else if (state.electronCloudMode === "Computed Density (Demo)") {
       const atoms = viewer.getModel()?.atoms;
       const atomCount = atoms?.length || 0;
       if (atomCount > 0 && atomCount <= 60) {
           const cubeStr = generateMockCube(atoms, demoDensityType, state.performanceMode);
           const voldata = new $3Dmol.VolumeData(cubeStr, "cube");
           if (demoDensityType === "density") {
               viewer.addIsosurface(voldata, {isoval: demoIsoval, color: "#ff44aa", alpha: demoOpacity, opacity: demoOpacity});
           } else {
               viewer.addIsosurface(voldata, {isoval: demoIsoval, color: "blue", alpha: demoOpacity, opacity: demoOpacity});
               viewer.addIsosurface(voldata, {isoval: -demoIsoval, color: "red", alpha: demoOpacity, opacity: demoOpacity});
           }
       }
    }

    // Background
    viewer.setBackgroundColor(state.canvasBackground);
    
    // Labels
    viewer.removeAllLabels();
    if (state.showLabels) {
      viewer.addPropertyLabels("atom", {}, {
        fontColor: 'black',
        font: 'sans-serif',
        fontSize: 12,
        showBackground: false,
        alignment: 'center'
      });
    }

    viewer.render();
  };

  const downloadMeasurements = () => {
    const csv = ["ID,Name,Type,Value"].concat(
      measurements.map(m => `${m.id},"${m.name}",${m.type},${m.value.toFixed(2)}`)
    ).join("\n");
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `measurements_${molecule?.name || 'mol'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const removeMeasurement = (id: string) => {
     setMeasurements(prev => prev.filter(m => m.id !== id));
     // re-render the labels by clearing and re-applying...
     // wait, 3dmol doesn't easily let us remove one label without knowing its object, 
     // so we can just re-render everything
     const viewer = glViewerRef.current;
     if (viewer) {
        viewer.removeAllLabels();
        applyViewState(viewer, viewState, filters);
        // re-apply remaining measurements
        setMeasurements(prev => {
          const remaining = prev.filter(m => m.id !== id);
          remaining.forEach(m => {
            // Need atoms to get positions. This is tricky without re-querying atoms.
            // For now, removing measurement from list won't remove the label until next structure load, 
            // unless we clear and re-eval. Let's just remove all labels.
          });
          return remaining;
        });
     }
  };

  return (
    <div className="w-full h-full relative">
      <div className="absolute top-6 right-6 flex gap-3 z-10 font-mono text-[10px] uppercase tracking-widest">
        <div className="flex bg-black/60 border border-white/10 rounded-xl overflow-hidden backdrop-blur-md">
          <button
            onClick={() => setDisplayMode("2D")}
            className={`px-4 py-2 transition-all ${displayMode === "2D" ? 'bg-[#F27D26]/80 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
          >
            2D
          </button>
          <button
            onClick={() => setDisplayMode("3D")}
            className={`px-4 py-2 transition-all ${displayMode === "3D" ? 'bg-[#F27D26]/80 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
          >
            3D
          </button>
        </div>
        {displayMode === "3D" && (
          <>
            <button 
               onClick={handleResetCamera}
               className="bg-black/60 border border-white/10 hover:border-[#F27D26]/50 hover:bg-black/80 text-white px-4 py-2 rounded-xl backdrop-blur-md transition-all flex items-center gap-2"
            >
              <RotateCw size={12} /> Reset View
            </button>
            <button 
               onClick={handleSpinToggle}
               className={`${isSpinning ? 'bg-[#F27D26]/20 border-[#F27D26] text-[#F27D26]' : 'bg-white/[0.05] border-white/10 text-white'} border hover:bg-white/[0.1] hover:border-[#F27D26]/50 px-4 py-2 rounded-xl backdrop-blur-md transition-all flex items-center gap-2`}
            >
              {isSpinning ? <X size={12}/> : <RotateCw size={12} />}
              {isSpinning ? 'Stop Spin' : 'Spin'}
            </button>
          </>
        )}
      </div>

      {displayMode === "3D" && (
        <div className="absolute bottom-6 left-6 flex gap-2 z-10 bg-white/[0.03] border border-white/10 p-2 rounded-2xl backdrop-blur-xl">
          <button 
            onClick={() => setMeasureMode(measureMode === "info" ? "none" : "info")}
            className={`p-3 rounded-xl border transition-all ${measureMode === "info" ? 'bg-[#F27D26]/20 border-[#F27D26] text-[#F27D26]' : 'bg-transparent border-transparent text-white/70 hover:text-white hover:bg-white/5'}`}
            title="Atom Info"
          >
            <MousePointer2 size={16} />
          </button>
          <button 
            onClick={() => setMeasureMode(measureMode === "distance" ? "none" : "distance")}
            className={`p-3 rounded-xl border transition-all ${measureMode === "distance" ? 'bg-[#F27D26]/20 border-[#F27D26] text-[#F27D26]' : 'bg-transparent border-transparent text-white/70 hover:text-white hover:bg-white/5'}`}
            title="Measure Distance (2 atoms)"
          >
            <Ruler size={16} />
          </button>
          <button 
            onClick={() => setMeasureMode(measureMode === "angle" ? "none" : "angle")}
            className={`p-3 rounded-xl border transition-all ${measureMode === "angle" ? 'bg-[#F27D26]/20 border-[#F27D26] text-[#F27D26]' : 'bg-transparent border-transparent text-white/70 hover:text-white hover:bg-white/5'}`}
            title="Measure Angle (3 atoms)"
          >
            <Triangle size={16} />
          </button>
          <button 
            onClick={() => setMeasureMode(measureMode === "dihedral" ? "none" : "dihedral")}
            className={`p-3 rounded-xl border transition-all ${measureMode === "dihedral" ? 'bg-[#F27D26]/20 border-[#F27D26] text-[#F27D26]' : 'bg-transparent border-transparent text-white/70 hover:text-white hover:bg-white/5'}`}
            title="Measure Dihedral (4 atoms)"
          >
            <Box size={16} />
          </button>
        </div>
      )}

      {molecule?.warnings && molecule.warnings.length > 0 && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 bg-[#F27D26]/10 border border-[#F27D26]/30 backdrop-blur-md px-6 py-3 rounded-2xl text-[10px] font-mono text-[#F27D26] text-center shadow-lg max-w-lg pointer-events-none flex flex-col gap-1">
          <span className="font-bold uppercase tracking-widest opacity-80">Parser Warning</span>
          {molecule.warnings.map((w, i) => <span key={i} className="opacity-90">{w}</span>)}
        </div>
      )}

      {molecule && displayMode === "3D" && viewState.electronCloudMode === "Computed Density (Demo)" && (
        <div className="absolute top-24 left-6 z-10 bg-[#111]/90 border border-[#ff44aa]/30 backdrop-blur-xl p-4 rounded-xl shadow-2xl text-[11px] font-mono w-56 pointer-events-auto">
           <div className="flex justify-between items-center mb-3 border-b border-white/10 pb-2">
             <span className="text-[#ff44aa] font-bold uppercase tracking-widest text-[9px]">Demo QM Controls</span>
           </div>
           
           <div className="flex flex-col gap-3">
             <div className="flex flex-col gap-1">
               <span className="text-white/50 text-[9px] uppercase">Mode</span>
               <select 
                 className="bg-black border border-white/10 rounded px-2 py-1 text-white outline-none"
                 value={demoDensityType}
                 onChange={(e) => setDemoDensityType(e.target.value as "density" | "homo_lumo")}
               >
                 <option value="density">Electron Density</option>
                 <option value="homo_lumo">HOMO/LUMO Orbital</option>
               </select>
             </div>
             
             <div className="flex flex-col gap-1">
               <div className="flex justify-between">
                 <span className="text-white/50 text-[9px] uppercase">Isovalue</span>
                 <span className="text-white">{demoIsoval.toFixed(3)}</span>
               </div>
               <input 
                 type="range" min="0.001" max="0.1" step="0.001" 
                 value={demoIsoval} 
                 onChange={e => setDemoIsoval(parseFloat(e.target.value))} 
                 className="accent-[#ff44aa]"
               />
             </div>
             
             <div className="flex flex-col gap-1">
               <div className="flex justify-between">
                 <span className="text-white/50 text-[9px] uppercase">Opacity</span>
                 <span className="text-white">{demoOpacity.toFixed(2)}</span>
               </div>
               <input 
                 type="range" min="0.1" max="1" step="0.05" 
                 value={demoOpacity} 
                 onChange={e => setDemoOpacity(parseFloat(e.target.value))} 
                 className="accent-[#ff44aa]"
               />
             </div>
           </div>
        </div>
      )}

      {hoveredAtomInfo && (
        <div className="absolute top-24 right-6 z-10 bg-[#111]/90 border border-white/10 backdrop-blur-xl p-4 rounded-xl shadow-2xl text-[11px] font-mono w-48 pointer-events-auto">
           <div className="flex justify-between items-center mb-2 border-b border-white/10 pb-2">
             <span className="text-[#F27D26] font-bold uppercase tracking-widest text-[9px]">Atom Info</span>
             <button onClick={() => setHoveredAtomInfo(null)} className="text-white/50 hover:text-white"><X size={12}/></button>
           </div>
           <div className="grid grid-cols-2 gap-2 text-white/80">
             <span>Element:</span> <span className="text-white font-bold">{hoveredAtomInfo.elem}</span>
             <span>Index:</span> <span className="text-white">{hoveredAtomInfo.serial}</span>
             <span>Charge:</span> <span className="text-white">{hoveredAtomInfo.formalCharge || 0}</span>
             <span>Coords:</span> <span className="text-white text-[9px]">
               {hoveredAtomInfo.x.toFixed(1)}, {hoveredAtomInfo.y.toFixed(1)}, {hoveredAtomInfo.z.toFixed(1)}
             </span>
           </div>
        </div>
      )}

      {measurements.length > 0 && (
        <div className="absolute bottom-24 left-6 z-10 bg-[#111]/90 border border-white/10 backdrop-blur-xl p-4 rounded-xl shadow-2xl text-[10px] font-mono w-64 max-h-[200px] overflow-y-auto custom-scrollbar pointer-events-auto">
          <div className="flex justify-between items-center mb-3 border-b border-white/10 pb-2">
            <span className="text-[#F27D26] font-bold uppercase tracking-widest text-[9px]">Measurements</span>
            <button onClick={downloadMeasurements} className="text-white/50 hover:text-[#F27D26] flex items-center gap-1"><Download size={10}/> CSV</button>
          </div>
          <div className="flex flex-col gap-2">
            {measurements.map(m => (
              <div key={m.id} className="flex justify-between items-center bg-white/5 p-2 rounded">
                <span className="text-white/70 truncate mr-2">{m.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold">{m.value.toFixed(1)} {m.type === 'distance' ? 'Å' : '°'}</span>
                  <button onClick={() => removeMeasurement(m.id)} className="text-red-400 hover:text-red-300"><X size={10}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {measureMode !== "none" && measureMode !== "info" && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 bg-[#F27D26]/20 border border-[#F27D26]/50 text-[#F27D26] px-4 py-2 rounded-full text-[10px] uppercase font-mono tracking-widest backdrop-blur-md pointer-events-none">
          Select {measureMode === "distance" ? "2" : measureMode === "angle" ? "3" : "4"} atoms ({selectedAtoms.length} selected)
        </div>
      )}

      {molecule && displayMode === "3D" && (
         <div className="absolute top-6 left-6 z-10 bg-white/[0.03] border border-white/10 backdrop-blur-xl p-4 rounded-2xl shadow-2xl text-[10px] font-mono tracking-widest min-w-[200px]">
            <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
              <span className="uppercase opacity-50">Legend: <span className="text-[#F27D26]">{viewState.colorTheme}</span></span>
              <button 
                onClick={() => setIsLegendMinimized(!isLegendMinimized)} 
                className="text-white/50 hover:text-white transition-colors p-1"
                title={isLegendMinimized ? "Expand Legend" : "Minimize Legend"}
              >
                {isLegendMinimized ? <span className="text-[8px]">▼</span> : <span className="text-[8px]">▲</span>}
              </button>
            </div>
            
            {!isLegendMinimized && (
              <div className="pointer-events-none">
                {(viewState.colorTheme === "Modern/Jmol" || viewState.colorTheme === "Classic CPK") ? (
                   <div className="grid grid-cols-3 gap-x-4 gap-y-2">
                      {presentElements.map(elem => {
                         let scheme = viewState.colorTheme === "Classic CPK" ? "rasmol" : "Jmol";
                         const colors = ($3Dmol.elementColors as any)[scheme] || ($3Dmol.elementColors as any).Jmol;
                         const num = colors[elem] || colors[elem.toUpperCase()] || ($3Dmol.elementColors as any).defaultColor || 0xffffff;
                         const hex = "#" + num.toString(16).padStart(6, '0');
                         return (
                            <div key={elem} className="flex items-center gap-2">
                               <div className="w-3 h-3 border border-white/20 rounded-full" style={{ backgroundColor: hex }}></div>
                               <span>{elem}</span>
                            </div>
                         );
                      })}
                      {presentElements.length === 0 && (
                         <div className="col-span-3 text-white/40 italic text-[9px] lowercase tracking-normal">No elements detected.</div>
                      )}
                   </div>
                ) : (viewState.colorTheme === "By Formal Charge" || viewState.colorTheme === "By Partial Charge" || viewState.colorTheme === "ESP") ? (
                   <div className="flex items-center justify-between gap-3 mt-2">
                      <span className="opacity-70 text-[9px]">(-)</span>
                      <div className="flex-1 h-1.5 bg-gradient-to-r from-[#FF0D0D] via-white to-[#3050F8] rounded-full opacity-80"></div>
                      <span className="opacity-70 text-[9px]">(+)</span>
                   </div>
                ) : (
                   <div className="text-white/40 italic text-[9px] lowercase tracking-normal">No specific legend available for this theme.</div>
                )}
              </div>
            )}
         </div>
      )}

      <div 
        className="w-full h-full absolute top-0 left-0" 
        style={{ opacity: displayMode === "3D" ? 1 : 0, pointerEvents: displayMode === "3D" ? 'auto' : 'none' }}
        ref={viewerRef}
      ></div>
      {displayMode === "2D" && (
        <div className="w-full h-full absolute top-0 left-0 z-0 flex items-center justify-center p-8 bg-[#f5f5f5] rounded-lg overflow-auto">
          {svg2D ? (
            <div dangerouslySetInnerHTML={{ __html: svg2D }} className="max-w-full max-h-full bg-white p-4 rounded-xl shadow-sm" style={{ minWidth: '300px', minHeight: '300px' }} />
          ) : (
            <div className="text-black/50 text-xs font-mono uppercase tracking-widest">Generating 2D Layout...</div>
          )}
        </div>
      )}

      {molecule && displayMode === "3D" && viewState.electronCloudMode === "Illustrative Approximation" && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 bg-[#4488ff]/10 border border-[#4488ff]/30 backdrop-blur-md px-6 py-3 rounded-full text-[10px] font-mono tracking-widest text-[#4488ff] text-center shadow-lg pointer-events-none">
          Illustrative approximation — not a real electron density
        </div>
      )}

      {molecule && displayMode === "3D" && viewState.electronCloudMode === "Computed Density (Demo)" && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 bg-[#ff44aa]/10 border border-[#ff44aa]/30 backdrop-blur-md px-6 py-3 rounded-2xl text-[10px] font-mono tracking-widest text-[#ff44aa] text-center shadow-lg max-w-sm pointer-events-none">
          {presentElements.length > 0 && glViewerRef.current?.getModel()?.atoms?.length > 60 ? (
            <span className="text-red-400">Atom count exceeds 60 limit for demo QM computation.</span>
          ) : (
            <>
              Computed density demo (small-basis set qualitative demonstration)
              <div className="text-[8px] opacity-70 mt-1">Appropriate for teaching, not for publication.</div>
            </>
          )}
        </div>
      )}
      
      {!molecule && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[10px] uppercase tracking-[0.3em] font-mono opacity-30 border border-white/10 px-6 py-3 rounded-2xl bg-white/[0.02] backdrop-blur-xl">Awaiting Molecular Input</span>
        </div>
      )}
      <div className="absolute bottom-6 right-6 text-[10px] uppercase tracking-widest font-mono text-white/20 pointer-events-none">
        Powered by 3Dmol.js
      </div>
    </div>
  );
});

export default Viewer3D;
