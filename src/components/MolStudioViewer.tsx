import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import * as $3Dmol from '3dmol';
import { RenderStyle } from '../types';
import { SSInfo } from '../lib/MolProcessor';

import { handleBoxPointerDown, handleBoxPointerMove, handleBoxPointerUp } from '../lib/BoxDragLogic';
export interface MolStudioViewerRef {
  getView: () => any;
  setView: (view: any) => void;
  resetView: () => void;
  centerSelection: (sel: any) => void;
}

const CHAIN_PALETTE = [
  '#3b82f6', // Blue
  '#f97316', // Orange
  '#10b981', // Emerald Green
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#f59e0b', // Amber/Yellow
  '#14b8a6', // Teal
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#6366f1', // Indigo
  '#d97706', // Dark Amber
];

const VDW_RADII: Record<string, number> = {
  H: 1.20, C: 1.70, N: 1.55, O: 1.52, F: 1.47, P: 1.80, S: 1.80, CL: 1.75, BR: 1.85, I: 1.98
};

function getAtomVdwRadius(elem: string): number {
  const e = (elem || '').toUpperCase().trim();
  return VDW_RADII[e] || 1.70;
}

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

function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Returns a universal color function for 3Dmol atoms.
 * Guarantees distinct, consistent coloring across Cartoon, Stick, Ball-and-Stick, Space-Filling, Line, Surface, Mesh, Dots!
 */
function getColorFunction(
  colorScheme: string,
  minResi: number,
  maxResi: number,
  chainMap: Record<string, string>
) {
  const resiRange = Math.max(maxResi - minResi, 1);

  return (atom: any): string => {
    if (!atom) return '#ffffff';

    if (colorScheme === 'white') {
      return '#ffffff';
    }

    if (colorScheme === 'element') {
      const elem = (atom.elem || '').toUpperCase();
      switch (elem) {
        case 'C': return '#909090'; // Carbon: Gray
        case 'N': return '#3050f8'; // Nitrogen: Blue
        case 'O': return '#ff0d0d'; // Oxygen: Red
        case 'S': return '#ffff30'; // Sulfur: Yellow
        case 'P': return '#ff8000'; // Phosphorus: Orange
        case 'H': return '#ffffff'; // Hydrogen: White
        case 'F': case 'CL': return '#1ff01f'; // Halogens: Green
        case 'FE': return '#e06633'; // Iron: Orange-Brown
        case 'ZN': return '#7d80b0'; // Zinc: Slate
        case 'CA': return '#3dff00'; // Calcium: Green
        case 'MG': return '#8a99c7'; // Magnesium: Blue-Gray
        default: return '#b8b8b8';
      }
    }

    if (colorScheme === 'chain') {
      const ch = atom.chain || 'A';
      return chainMap[ch] || chainMap[ch.toUpperCase()] || chainMap[''] || '#3b82f6';
    }

    if (colorScheme === 'ssJmol') {
      // Jmol Secondary Structure: Helix = Magenta, Sheet = Yellow, Loop = White
      const ss = (atom.ss || '').toLowerCase();
      if (ss === 'h') return '#ff0080'; // Magenta
      if (ss === 's' || ss === 'e') return '#ffc800'; // Gold/Yellow
      return '#ffffff'; // White loop
    }

    if (colorScheme === 'ssPyMol') {
      // PyMOL Secondary Structure: Helix = Red, Sheet = Yellow, Loop = Green
      const ss = (atom.ss || '').toLowerCase();
      if (ss === 'h') return '#ff0000'; // Red
      if (ss === 's' || ss === 'e') return '#ffff00'; // Yellow
      return '#22c55e'; // Green loop
    }

    if (colorScheme === 'spectrum') {
      // Continuous Rainbow spectrum from N-terminus (Blue) to C-terminus (Red)
      const resi = typeof atom.resi === 'number' ? atom.resi : minResi;
      const t = Math.max(0, Math.min(1, (resi - minResi) / resiRange));
      const hue = (1 - t) * 240; // 240 (blue) down to 0 (red)
      return hslToHex(hue, 100, 48);
    }

    // Custom or fallback color string (e.g. 'magenta', 'cyan', 'orange')
    return colorScheme || '#3b82f6';
  };
}

function getStyleObj(
  style: string,
  colorScheme: string = 'spectrum',
  minResi: number = 1,
  maxResi: number = 100,
  chainMap: Record<string, string> = {},
  opacity: number = 1.0
) {
  const colorfunc = getColorFunction(colorScheme, minResi, maxResi, chainMap);
  const base: any = { opacity, colorfunc };

  switch (style) {
    case "Line":
      return { line: base };
    case "Stick":
      return { stick: base };
    case "Ball-and-Stick":
      return { stick: { ...base, radius: 0.15 }, sphere: { ...base, radius: 0.4 } };
    case "Space-Filling":
      return { sphere: base };
    case "Cartoon":
      return { cartoon: { ...base, arrows: true, tubes: false } };
    case "Non-bonded (small spheres)":
      return { sphere: { ...base, radius: 0.5 } };
    default:
      return { line: { hidden: true } };
  }
}

export default forwardRef<MolStudioViewerRef, {
  pdbData: string,
  ssData: SSInfo[],
  ssMode: 'pdb' | 'quick' | 'dssp',
  assemblyPDB?: string | null,
  symmetryPDB?: string | null,
  alignmentPDB?: string | null,
  ligandData?: { data: string, format: string } | null,
  dockingPDBQT?: string | null,
  dockingBox?: { center: {x: number, y: number, z: number}, size: {x: number, y: number, z: number} } | null,
  onDockingBoxChange?: (box: { center: {x: number, y: number, z: number}, size: {x: number, y: number, z: number} }) => void,
  gridBoxThickness?: number,
  gridBoxOpacity?: number,
  interactions?: any[],
  renderStyle: RenderStyle,
  colorScheme?: string,
  surfaceOpacity?: number,
  backgroundColor?: string,
  selectedAtomSerials: Set<number>,
  focusTrigger?: number
}>(({ 
  pdbData, ssData, ssMode, assemblyPDB, symmetryPDB, alignmentPDB, ligandData, dockingPDBQT, dockingBox, onDockingBoxChange,
  gridBoxThickness = 0.2, gridBoxOpacity = 1.0,
  interactions, renderStyle, colorScheme = "spectrum", surfaceOpacity = 0.7, backgroundColor = '#f0f0f0', 
  selectedAtomSerials, focusTrigger = 0 
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const lastZoomedPdbData = useRef<string | null>(null);
  const lastFocusTrigger = useRef<number>(0);
  const [isRendering, setIsRendering] = useState(false);
  const dragState = useRef({ active: false, mode: 'none', cornerIdx: -1, startX: 0, startY: 0, startBox: null as any, axes2d: null as any });

  const onPointerDown = (e: React.PointerEvent) => {
    if (handleBoxPointerDown(e, viewerRef.current, dockingBox, onDockingBoxChange, dragState)) {
       e.stopPropagation();
       (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragState.current.active) {
       handleBoxPointerMove(e, viewerRef.current, onDockingBoxChange, dragState);
       e.stopPropagation();
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (handleBoxPointerUp(dragState)) {
       e.stopPropagation();
    }
  };

  useImperativeHandle(ref, () => ({
    getView: () => viewerRef.current?.getView(),
    setView: (view: any) => viewerRef.current?.setView(view),
    resetView: () => viewerRef.current?.zoomTo(),
    centerSelection: (sel: any) => {
      if (viewerRef.current) {
        viewerRef.current.zoomTo(sel);
      }
    }
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    if (!viewerRef.current) {
      viewerRef.current = $3Dmol.createViewer(containerRef.current, {
        backgroundColor,
        antialias: true
      });
    }

    // Determine if this is a heavy render operation
    const isHeavy = pdbData && pdbData.length > 50000 && (renderStyle === 'Cartoon' || renderStyle.includes('Surface'));
    
    if (isHeavy) {
      setIsRendering(true);
    }

    const timer = setTimeout(() => {
      const viewer = viewerRef.current;
      viewer.setBackgroundColor(backgroundColor);
      
      // IMPORTANT: must remove surfaces otherwise they linger when switching away from Surface representations
      viewer.removeAllSurfaces();
      viewer.clear();
      viewer.removeAllShapes();

      if (pdbData) {
        // Base Molecule
        const m = viewer.addModel(pdbData, "pdb");
        
        // Ensure secondary structure is computed on the 3Dmol model
        try {
          m.computeSecondaryStructure();
        } catch (e) {
          // Ignore if 3Dmol structure calculation encounters non-standard residues
        }
        
        const atoms = m.selectedAtoms({});

        // Secondary Structure Override if ssData supplied
        if (ssData.length > 0) {
          const ssMap = new Map();
          
          for (let i = 0; i < ssData.length; i++) {
             const ss = ssData[i];
             const prev = ssData[i-1];
             const next = ssData[i+1];
             
             let ssbegin = false;
             let ssend = false;
             
             if (ss.ss_type !== 'loop' && ss.ss_type !== 'undetermined') {
                 if (!prev || prev.chainID !== ss.chainID || prev.ss_type !== ss.ss_type) {
                     ssbegin = true;
                 }
                 if (!next || next.chainID !== ss.chainID || next.ss_type !== ss.ss_type) {
                     ssend = true;
                 }
             }
             
             ssMap.set(`${ss.chainID}:${ss.resi}`, { type: ss.ss_type, ssbegin, ssend });
          }
          
          atoms.forEach((a: any) => {
             const key = `${a.chain}:${a.resi}`;
             if (ssMap.has(key)) {
                const info = ssMap.get(key);
                if (info.type === 'helix') a.ss = 'h';
                else if (info.type === 'sheet') a.ss = 's';
                else a.ss = 'c';
                
                if (info.ssbegin) a.ssbegin = true; else delete a.ssbegin;
                if (info.ssend) a.ssend = true; else delete a.ssend;
             }
          });
        }

        // Calculate residue range and chain palette map
        let minResi = Infinity;
        let maxResi = -Infinity;
        const presentChains = new Set<string>();

        atoms.forEach((a: any) => {
          if (typeof a.resi === 'number' && !a.hetflag) {
            if (a.resi < minResi) minResi = a.resi;
            if (a.resi > maxResi) maxResi = a.resi;
          }
          if (a.chain) {
            presentChains.add(a.chain);
          }
        });

        if (minResi === Infinity) minResi = 1;
        if (maxResi === -Infinity) maxResi = 100;

        const chainArray = Array.from(presentChains).sort();
        const chainMap: Record<string, string> = {};
        chainArray.forEach((ch, idx) => {
          chainMap[ch] = CHAIN_PALETTE[idx % CHAIN_PALETTE.length];
        });
        chainMap[''] = CHAIN_PALETTE[0];
        chainMap[' '] = CHAIN_PALETTE[0];

        // Base style
        viewer.setStyle({}, getStyleObj(renderStyle, colorScheme, minResi, maxResi, chainMap, 1.0));

        // Apply selection styling
        if (selectedAtomSerials.size > 0) {
          // Dim unselected
          viewer.setStyle({}, getStyleObj(renderStyle, 'white', minResi, maxResi, chainMap, 0.25));
          
          // Highlight selected
          const selArray = Array.from(selectedAtomSerials);
          viewer.setStyle({ serial: selArray }, { 
            ...getStyleObj(renderStyle, '#ec4899', minResi, maxResi, chainMap, 1.0),
            stick: { radius: 0.2, color: '#ec4899' }
          });
        }

        // Add surfaces or point cloud if requested by renderStyle
        if (renderStyle.includes("Surface") || renderStyle === "Mesh") {
           let surfType = $3Dmol.SurfaceType.VDW;
           if (renderStyle === "Solvent-Accessible Surface") surfType = $3Dmol.SurfaceType.SAS;
           if (renderStyle === "Solvent-Excluded Surface") surfType = $3Dmol.SurfaceType.SES;
           
           const surfOpts: any = {
             opacity: surfaceOpacity,
             wireframe: renderStyle === "Mesh",
             colorfunc: getColorFunction(colorScheme, minResi, maxResi, chainMap)
           };
           
           viewer.addSurface(surfType, surfOpts);
        } else if (renderStyle === "Dots") {
          const colorfunc = getColorFunction(colorScheme, minResi, maxResi, chainMap);
          const fibPoints = getFibonacciSpherePoints(16);

          const atomData = atoms.map((a: any) => ({
            x: a.x, y: a.y, z: a.z,
            r: getAtomVdwRadius(a.elem),
            color: colorfunc(a)
          }));

          const cellSize = 5.0;
          const grid = new Map<string, typeof atomData>();

          atomData.forEach((atom: any) => {
            const gx = Math.floor(atom.x / cellSize);
            const gy = Math.floor(atom.y / cellSize);
            const gz = Math.floor(atom.z / cellSize);
            const key = `${gx},${gy},${gz}`;
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
                  if (bucket) {
                    for (let k = 0; k < bucket.length; k++) {
                      neighbors.push(bucket[k]);
                    }
                  }
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
        // 3. Biological Assemblies
        if (assemblyPDB) {
          viewer.addModel(assemblyPDB, "pdb");
          viewer.setStyle({ model: 1 }, getStyleObj(renderStyle, 'cyan', minResi, maxResi, chainMap, 1.0));
        }

        // 4. Crystal Symmetry Mates
        if (symmetryPDB) {
          const sm = viewer.addModel(symmetryPDB, "pdb");
          viewer.setStyle({ model: sm.getID() }, getStyleObj(renderStyle, '#FFD700', minResi, maxResi, chainMap, 0.7));
        }

        // 5. Alignment B (Reference)
        if (alignmentPDB) {
          const am = viewer.addModel(alignmentPDB, "pdb");
          viewer.setStyle({ model: am.getID() }, { cartoon: { color: 'orange' } });
        }
        
        // 6. Docking Ligand Input
        if (ligandData) {
           const lm = viewer.addModel(ligandData.data, ligandData.format);
           viewer.setStyle({ model: lm.getID() }, { stick: { colorscheme: 'greenCarbon' } });
        }
        
        // 7. Docking Result Poses
        if (dockingPDBQT) {
           const dm = viewer.addModel(dockingPDBQT, "pdb"); // Can parse PDBQT as PDB
           viewer.setStyle({ model: dm.getID() }, { stick: { colorscheme: 'cyanCarbon' } });
        }

        // 8. Docking Grid Box
        gridShapesRef.current = [];
        if (dockingBox) {
          const cx = dockingBox.center.x;
          const cy = dockingBox.center.y;
          const cz = dockingBox.center.z;
          const hx = dockingBox.size.x / 2;
          const hy = dockingBox.size.y / 2;
          const hz = dockingBox.size.z / 2;
             
          const p = [
             { x: cx - hx, y: cy - hy, z: cz - hz }, // 0
             { x: cx + hx, y: cy - hy, z: cz - hz }, // 1
             { x: cx + hx, y: cy + hy, z: cz - hz }, // 2
             { x: cx - hx, y: cy + hy, z: cz - hz }, // 3
             { x: cx - hx, y: cy - hy, z: cz + hz }, // 4
             { x: cx + hx, y: cy - hy, z: cz + hz }, // 5
             { x: cx + hx, y: cy + hy, z: cz + hz }, // 6
             { x: cx - hx, y: cy + hy, z: cz + hz }  // 7
          ];
             
          const edges = [
             [0,1], [1,2], [2,3], [3,0], // bottom face
             [4,5], [5,6], [6,7], [7,4], // top face
             [0,4], [1,5], [2,6], [3,7]  // vertical edges
          ];
             
          edges.forEach(([i, j]) => {
             const shape = viewer.addCylinder({
                start: p[i], 
                end: p[j],
                radius: gridBoxThickness,
                color: 'red',
                opacity: gridBoxOpacity, alpha: gridBoxOpacity,
                fromCap: 1, 
                toCap: 1
             });
             gridShapesRef.current.push(shape);
          });
        }

        // 9. Interactions
        if (interactions && interactions.length > 0) {
          interactions.forEach(int => {
            viewer.addCylinder({
              start: { x: int.atom1.x, y: int.atom1.y, z: int.atom1.z },
              end: { x: int.atom2.x, y: int.atom2.y, z: int.atom2.z },
              radius: 0.05,
              color: int.type === 'hbond' ? 'yellow' : int.type === 'hydrophobic' ? 'purple' : 'green',
              dashed: true,
              fromCap: 1,
              toCap: 1
            });
          });
        }

        if (pdbData !== lastZoomedPdbData.current) {
          viewer.zoomTo();
          lastZoomedPdbData.current = pdbData;
        } else if (focusTrigger !== lastFocusTrigger.current) {
          if (selectedAtomSerials.size > 0) {
             viewer.zoomTo({ serial: Array.from(selectedAtomSerials) });
          } else {
             viewer.zoomTo();
          }
          lastFocusTrigger.current = focusTrigger;
        }
        
        viewer.render();
      }
      
      if (isHeavy) {
        setIsRendering(false);
      }
    }, 10); // Small delay to allow React to paint the loading state

    return () => clearTimeout(timer);
  }, [pdbData, ssData, ssMode, assemblyPDB, symmetryPDB, alignmentPDB, ligandData, dockingPDBQT, dockingBox, gridBoxThickness, gridBoxOpacity, interactions, renderStyle, colorScheme, surfaceOpacity, selectedAtomSerials, backgroundColor, focusTrigger]);
  const gridShapesRef = useRef<any[]>([]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    // Remove previous grid shapes
    if (gridShapesRef.current.length > 0) {
      gridShapesRef.current.forEach(shape => viewer.removeShape(shape));
      gridShapesRef.current = [];
    }

    if (dockingBox) {
      const cx = dockingBox.center.x;
      const cy = dockingBox.center.y;
      const cz = dockingBox.center.z;
      const hx = dockingBox.size.x / 2;
      const hy = dockingBox.size.y / 2;
      const hz = dockingBox.size.z / 2;
         
      const p = [
         { x: cx - hx, y: cy - hy, z: cz - hz }, // 0
         { x: cx + hx, y: cy - hy, z: cz - hz }, // 1
         { x: cx + hx, y: cy + hy, z: cz - hz }, // 2
         { x: cx - hx, y: cy + hy, z: cz - hz }, // 3
         { x: cx - hx, y: cy - hy, z: cz + hz }, // 4
         { x: cx + hx, y: cy - hy, z: cz + hz }, // 5
         { x: cx + hx, y: cy + hy, z: cz + hz }, // 6
         { x: cx - hx, y: cy + hy, z: cz + hz }  // 7
      ];
         
      const edges = [
         [0,1], [1,2], [2,3], [3,0], // bottom face
         [4,5], [5,6], [6,7], [7,4], // top face
         [0,4], [1,5], [2,6], [3,7]  // vertical edges
      ];
         
      edges.forEach(([i, j]) => {
         const shape = viewer.addCylinder({
            start: p[i], 
            end: p[j],
            radius: gridBoxThickness,
            color: 'red',
            opacity: gridBoxOpacity, alpha: gridBoxOpacity,
            fromCap: 1, 
            toCap: 1
         });
         gridShapesRef.current.push(shape);
      });
      viewer.render();
    }
  }, [dockingBox, gridBoxThickness, gridBoxOpacity]);

  return (
    <div className="w-full h-full relative" onPointerDownCapture={onPointerDown} onPointerMoveCapture={onPointerMove} onPointerUpCapture={onPointerUp}>
      <div ref={containerRef} className="w-full h-full" />
      {isRendering && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-3 p-6 bg-[#111111] rounded-xl border border-white/10 shadow-2xl">
            <div className="w-8 h-8 border-4 border-[#4A90E2]/30 border-t-[#4A90E2] rounded-full animate-spin"></div>
            <div className="text-sm font-medium text-white/90 tracking-wide">Computing Representation...</div>
            <div className="text-xs text-white/50">This may take a moment for large structures</div>
          </div>
        </div>
      )}
    </div>
  );
});
