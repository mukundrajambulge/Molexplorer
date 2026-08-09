import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import * as $3Dmol from '3dmol';
import { RenderStyle, MoleculeData, FilterState, ViewState } from '../types';
import { SSInfo } from '../lib/MolProcessor';
import { useStore } from '../store';

export interface CoreViewer3DRef {
  getView: () => any;
  setView: (view: any) => void;
  resetView: () => void;
  centerSelection: (sel: any) => void;
  getViewer: () => any;
}

interface CoreViewer3DProps {
  mode: 'explorer' | 'studio';
  
  // Explorer Props
  molecule?: MoleculeData | null;
  compareMolecule?: MoleculeData | null;
  filters?: FilterState;
  viewState?: ViewState;

  // Studio Props
  pdbData?: string;
  ssData?: SSInfo[];
  ssMode?: 'pdb' | 'quick' | 'dssp';
  assemblyPDB?: string | null;
  symmetryPDB?: string | null;
  alignmentPDB?: string | null;
  ligandData?: { data: string, format: string } | null;
  interactions?: any[];
  renderStyle?: RenderStyle;
  colorScheme?: string;
  surfaceOpacity?: number;
  backgroundColor?: string;
  selectedAtomSerials?: Set<number>;
  focusTrigger?: number;
  orthographic?: boolean;
  stereoMode?: 'none' | 'cross-eye' | 'anaglyph';
}

const CHAIN_PALETTE = [
  '#3b82f6', '#f97316', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b',
  '#14b8a6', '#ef4444', '#06b6d4', '#84cc16', '#6366f1', '#d97706'
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

function getColorFunction(
  colorScheme: string,
  minResi: number,
  maxResi: number,
  chainMap: Record<string, string>
) {
  const resiRange = Math.max(maxResi - minResi, 1);

  return (atom: any): string => {
    if (!atom) return '#ffffff';

    const csLower = (colorScheme || '').toLowerCase();

    if (csLower === 'white' || csLower === 'monochrome') {
      return '#ffffff';
    }

    if (csLower === 'element' || csLower === 'classic cpk') {
      const elem = (atom.elem || '').toUpperCase();
      switch (elem) {
        case 'C': return '#909090';
        case 'N': return '#3050f8';
        case 'O': return '#ff0d0d';
        case 'S': return '#ffff30';
        case 'P': return '#ff8000';
        case 'H': return '#ffffff';
        case 'F': case 'CL': return '#1ff01f';
        case 'FE': return '#e06633';
        case 'ZN': return '#7d80b0';
        case 'CA': return '#3dff00';
        case 'MG': return '#8a99c7';
        default: return '#b8b8b8';
      }
    }

    if (csLower === 'modern/jmol') {
      const elem = (atom.elem || '').toUpperCase();
      switch (elem) {
        case 'C': return '#909090';
        case 'N': return '#3050f8';
        case 'O': return '#ff0d0d';
        case 'H': return '#ffffff';
        default: return '#b8b8b8';
      }
    }

    if (csLower === 'chain' || csLower === 'by chain') {
      const ch = atom.chain || 'A';
      return chainMap[ch] || chainMap[ch.toUpperCase()] || chainMap[''] || '#3b82f6';
    }

    if (csLower === 'ssjmol') {
      const ss = (atom.ss || '').toLowerCase();
      if (ss === 'h') return '#ff0080';
      if (ss === 's' || ss === 'e') return '#ffc800';
      return '#ffffff';
    }

    if (csLower === 'sspymol' || csLower === 'by ss') {
      const ss = (atom.ss || '').toLowerCase();
      if (ss === 'h') return '#ff0000';
      if (ss === 's' || ss === 'e') return '#ffff00';
      return '#22c55e';
    }

    if (csLower === 'spectrum' || csLower === 'rainbow') {
      const resi = typeof atom.resi === 'number' ? atom.resi : minResi;
      const t = Math.max(0, Math.min(1, (resi - minResi) / resiRange));
      const hue = (1 - t) * 240;
      return hslToHex(hue, 100, 48);
    }

    if (csLower === 'by formal charge') {
      const charge = atom.formalCharge || 0;
      if (charge < 0) return '#ef4444';
      if (charge > 0) return '#3b82f6';
      return '#ffffff';
    }

    if (csLower === 'by partial charge' || csLower === 'esp') {
      const elem = (atom.elem || '').toUpperCase();
      if (elem === 'O' || elem === 'F' || elem === 'CL') return '#ef4444';
      if (elem === 'N' || elem === 'H') return '#3b82f6';
      return '#f3f4f6';
    }

    if (csLower === 'hydrophobicity') {
      const resn = (atom.resname || '').toUpperCase();
      const hydrophobic = ['ALA', 'VAL', 'LEU', 'ILE', 'MET', 'PHE', 'TYR', 'TRP', 'PRO'];
      if (hydrophobic.includes(resn)) return '#eab308';
      return '#3b82f6';
    }

    if (csLower === 'colourblind-safe') {
      const cbPalette = ['#0072B2', '#E69F00', '#009E73', '#F0E442', '#56B4E9', '#D55E00', '#CC79A7'];
      const ch = atom.chain || 'A';
      const idx = ch.charCodeAt(0) % cbPalette.length;
      return cbPalette[idx];
    }

    const isHex = /^#[0-9A-F]{6}$/i.test(colorScheme);
    return isHex ? colorScheme : '#3b82f6';
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
  const csLower = (colorScheme || '').toLowerCase();
  const base: any = { opacity };

  if (csLower === 'spectrum' || csLower === 'rainbow') {
    base.color = 'spectrum';
  } else if (csLower === 'chain' || csLower === 'by chain') {
    base.color = 'chain';
  } else if (csLower === 'ssjmol') {
    base.colorscheme = 'ssJmol';
  } else if (csLower === 'sspymol' || csLower === 'by ss') {
    base.colorscheme = 'ssPyMOL';
  } else if (csLower === 'element' || csLower === 'classic cpk' || csLower === 'modern/jmol') {
    base.colorscheme = 'default';
  } else {
    const isNamedColor = ['white', 'cyan', 'orange', 'red', 'green', 'blue', 'yellow', 'magenta', 'gray', 'purple'].includes(csLower);
    if (colorScheme.startsWith('#') || isNamedColor) {
      base.color = colorScheme;
    } else {
      base.colorfunc = colorfunc;
    }
  }

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
    case "Putty":
      return { cartoon: { ...base, tubes: true, thickness: 0.5 } };
    case "Non-bonded (crosses)":
      return { cross: { ...base, radius: 0.8, linewidth: 2 } };
    case "Non-bonded (small spheres)":
      return { sphere: { ...base, radius: 0.5 } };
    default:
      return { line: { hidden: true } };
  }
}

export const CoreViewer3D = forwardRef<CoreViewer3DRef, CoreViewer3DProps>((props, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [isRendering, setIsRendering] = useState(false);
  const lastZoomedData = useRef<string | null>(null);
  
  const { mode } = props;

  // Studio-specific state from Zustand
  const {
    measurements,
    activeMeasurementMode,
    addClickedAtom,
    setSelectedAtomSerials,
    showDipoleArrow,
    dipoleMoment
  } = useStore();

  useImperativeHandle(ref, () => ({
    getView: () => viewerRef.current?.getView(),
    setView: (view: any) => viewerRef.current?.setView(view),
    resetView: () => viewerRef.current?.zoomTo(),
    centerSelection: (sel: any) => {
      if (viewerRef.current) viewerRef.current.zoomTo(sel);
    },
    getViewer: () => viewerRef.current
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    // Determine background color
    const bgColor = mode === 'explorer' 
      ? (props.viewState?.canvasBackground || '#0A0A0A')
      : (props.backgroundColor || '#f0f0f0');

    if (!viewerRef.current) {
      viewerRef.current = $3Dmol.createViewer(containerRef.current, {
        backgroundColor: bgColor,
        antialias: true
      });
    }

    const resizeObserver = new ResizeObserver(() => {
      if (viewerRef.current) {
        viewerRef.current.resize();
        viewerRef.current.render();
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, [mode]);

  // Main rendering effect
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const renderTimer = setTimeout(async () => {
      const bgColor = mode === 'explorer' 
        ? (props.viewState?.canvasBackground || '#0A0A0A')
        : (props.backgroundColor || '#f0f0f0');
      viewer.setBackgroundColor(bgColor);
      if (typeof viewer.setProjection === 'function') {
        try { viewer.setProjection(props.orthographic ? 'orthographic' : 'perspective'); } catch (e) {}
      }

      viewer.clear();
      viewer.removeAllSurfaces();
      viewer.removeAllShapes();
      viewer.removeAllLabels();

      if (mode === 'explorer' && props.molecule?.rawContent) {
        // EXPLORER MODE RENDERING
        const format = props.molecule.format.toLowerCase();
        let molContent = props.molecule.rawContent;

        // Add main molecule
        viewer.addModel(molContent, format);

        // Add compare molecule
        if (props.compareMolecule?.rawContent) {
          const m2 = viewer.addModel(props.compareMolecule.rawContent, props.compareMolecule.format.toLowerCase());
          m2.setStyle({}, { stick: { colorscheme: 'greenCarbon', radius: 0.15 }, sphere: { hidden: true } });
        }

        // Apply Explorer Styles (simplified for unification)
        const vs = props.viewState;
        if (vs) {
          let baseStyle: any = {};
          if (vs.renderStyle === "Line") baseStyle.line = {};
          else if (vs.renderStyle === "Stick") baseStyle.stick = {};
          else if (vs.renderStyle === "Ball-and-Stick") { baseStyle.stick = {}; baseStyle.sphere = { scale: 0.3 }; }
          else if (vs.renderStyle === "Space-Filling") baseStyle.sphere = {};
          else baseStyle.stick = {};

          let colorscheme = 'Jmol';
          if (vs.colorTheme === "Classic CPK") colorscheme = 'rasmol';
          if (vs.colorTheme === "Monochrome") { baseStyle.color = "#B0B0B0"; }
          else { baseStyle.colorscheme = colorscheme; }

          viewer.setStyle({}, baseStyle);
          
          if (!vs.showHydrogens) viewer.setStyle({elem: 'H'}, {hidden: true});
        }

        viewer.zoomTo();
        viewer.render();

      } else if (mode === 'studio' && props.pdbData) {
        // STUDIO MODE RENDERING
        setIsRendering(true);
        const m = viewer.addModel(props.pdbData, "pdb");
        
        try { m.computeSecondaryStructure(); } catch (e) {}

        const atoms = m.selectedAtoms({});
        
        // DSSP Secondary Structure Mapping Override
        if (props.ssData && props.ssData.length > 0) {
          const ssMap = new Map();
          for (let i = 0; i < props.ssData.length; i++) {
             const ss = props.ssData[i];
             const prev = props.ssData[i-1];
             const next = props.ssData[i+1];
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

        // 1. Style Click Handlers & State Updates
        const setClickStyle = (sel: any, style: any) => {
          viewer.setStyle(sel, {
            ...style,
            clickable: true,
            callback: (atom: any) => {
              if (!atom) return;
              if (activeMeasurementMode) {
                addClickedAtom({ serial: atom.serial, x: atom.x, y: atom.y, z: atom.z });
              } else {
                const next = new Set(props.selectedAtomSerials);
                if (next.has(atom.serial)) {
                  next.delete(atom.serial);
                } else {
                  next.add(atom.serial);
                }
                setSelectedAtomSerials(next);
              }
            }
          });
        };

        const rStyle = props.renderStyle || "Cartoon";
        const cScheme = props.colorScheme || "spectrum";

        // Base style for protein/nucleic polymers (non-HETATMs)
        setClickStyle({ hetflag: false }, getStyleObj(rStyle, cScheme, minResi, maxResi, chainMap, 1.0));

        // Base style for organic ligands/inhibitors (non-water HETATMs) - Render as STICKS for high visibility
        setClickStyle({ hetflag: true, not: { resn: ['HOH', 'WAT', 'DOD', 'SOL'] } }, {
          stick: { colorscheme: 'default', radius: 0.22 },
          sphere: { colorscheme: 'default', radius: 0.45 }
        });

        // Base style for solvent waters - Red Crosses
        setClickStyle({ hetflag: true, resn: ['HOH', 'WAT', 'DOD', 'SOL'] }, {
          cross: { radius: 0.5, linewidth: 1.5, color: '#ff4d4d' }
        });

        // Apply Selection Highlighting
        if (props.selectedAtomSerials && props.selectedAtomSerials.size > 0) {
          // Dim the unselected protein atoms to make selection stand out
          setClickStyle({ hetflag: false }, getStyleObj(rStyle, 'white', minResi, maxResi, chainMap, 0.25));
          const selArray = Array.from(props.selectedAtomSerials);
          setClickStyle({ serial: selArray }, { 
            ...getStyleObj(rStyle, '#ec4899', minResi, maxResi, chainMap, 1.0),
            stick: { radius: 0.22, color: '#ec4899' }
          });
        }

        // Render Surfaces / Mesh / Dots
        if (rStyle.includes("Surface") || rStyle === "Mesh") {
           let surfType = $3Dmol.SurfaceType.VDW;
           if (rStyle === "Solvent-Accessible Surface") surfType = $3Dmol.SurfaceType.SAS;
           if (rStyle === "Solvent-Excluded Surface") surfType = $3Dmol.SurfaceType.SES;
           const surfOpts: any = {
             opacity: props.surfaceOpacity || 0.7,
             wireframe: rStyle === "Mesh",
             colorfunc: getColorFunction(cScheme, minResi, maxResi, chainMap)
           };
           viewer.addSurface(surfType, surfOpts);
        } else if (rStyle === "Dots") {
          const colorfunc = getColorFunction(cScheme, minResi, maxResi, chainMap);
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

        // Assembly, Symmetry, Alignment & Ligand overlays
        if (props.assemblyPDB) {
          viewer.addModel(props.assemblyPDB, "pdb");
          setClickStyle({ model: 1 }, getStyleObj(rStyle, 'cyan', minResi, maxResi, chainMap, 1.0));
        }

        if (props.symmetryPDB) {
          const sm = viewer.addModel(props.symmetryPDB, "pdb");
          setClickStyle({ model: sm.getID() }, getStyleObj(rStyle, '#FFD700', minResi, maxResi, chainMap, 0.7));
        }

        if (props.alignmentPDB) {
          const am = viewer.addModel(props.alignmentPDB, "pdb");
          setClickStyle({ model: am.getID() }, { cartoon: { color: 'orange' } });
        }
        
        if (props.ligandData) {
           const lm = viewer.addModel(props.ligandData.data, props.ligandData.format);
           setClickStyle({ model: lm.getID() }, { stick: { colorscheme: 'greenCarbon' } });
        }

        // Render Dipole Arrow
        if (showDipoleArrow && dipoleMoment && dipoleMoment.magnitude > 0) {
          const com = dipoleMoment.com;
          const vec = dipoleMoment.vector;
          const mag = dipoleMoment.magnitude;
          const scale = 0.5;
          const end = {
            x: com.x + vec.x * scale,
            y: com.y + vec.y * scale,
            z: com.z + vec.z * scale
          };
          
          viewer.addCylinder({
            start: com,
            end: end,
            radius: 0.12,
            color: '#06b6d4',
            fromCap: true,
            toCap: false
          });

          const norm = { x: vec.x / mag, y: vec.y / mag, z: vec.z / mag };
          const tip = {
            x: end.x + norm.x * 0.8,
            y: end.y + norm.y * 0.8,
            z: end.z + norm.z * 0.8
          };
          
          viewer.addCylinder({
            start: end,
            end: tip,
            radius: 0.30,
            toRadius: 0.0,
            color: '#06b6d4',
            fromCap: true,
            toCap: true
          });

          viewer.addLabel(`μ = ${mag.toFixed(2)} D`, {
            position: tip,
            backgroundColor: 'rgba(6, 182, 212, 0.85)',
            borderColor: '#06b6d4',
            fontColor: '#ffffff',
            font: 'monospace',
            fontSize: 10,
            backgroundOpacity: 0.9
          });
        }

        // Render Measurements
        measurements.forEach((m) => {
          const isHighB = m.coordinates.some((coord, idx) => {
            const s = m.atomSerials[idx];
            const atom = atoms.find((a: any) => a.serial === s);
            return atom && (atom.bFactor || 0) > 50;
          });
          const labelColor = isHighB ? '#f59e0b' : '#F2CD5C';

          if (m.type === 'distance' && m.coordinates.length === 2) {
            const [p1, p2] = m.coordinates;
            const steps = 15;
            const dashColor = '#F2CD5C';
            const isHBond = m.label.includes('kcal/mol');
            const radius = isHBond ? 0.06 : 0.04;

            for (let i = 0; i < steps; i += 2) {
              const tStart = i / steps;
              const tEnd = (i + 1) / steps;
              const ptStart = {
                x: p1.x + (p2.x - p1.x) * tStart,
                y: p1.y + (p2.y - p1.y) * tStart,
                z: p1.z + (p2.z - p1.z) * tStart
              };
              const ptEnd = {
                x: p1.x + (p2.x - p1.x) * tEnd,
                y: p1.y + (p2.y - p1.y) * tEnd,
                z: p1.z + (p2.z - p1.z) * tEnd
              };
              viewer.addCylinder({
                start: ptStart,
                end: ptEnd,
                radius,
                color: dashColor,
                fromCap: true,
                toCap: true
              });
            }
            const mid = {
              x: (p1.x + p2.x) / 2,
              y: (p1.y + p2.y) / 2,
              z: (p1.z + p2.z) / 2
            };
            viewer.addLabel(m.label, {
              position: mid,
              backgroundColor: 'rgba(10, 10, 12, 0.85)',
              borderColor: labelColor,
              fontColor: labelColor,
              font: 'monospace',
              fontSize: 10,
              backgroundOpacity: 0.9
            });
          }

          if (m.type === 'angle' && m.coordinates.length === 3) {
            const [p1, p2, p3] = m.coordinates;
            viewer.addCylinder({ start: p1, end: p2, radius: 0.03, color: '#ffffff' });
            viewer.addCylinder({ start: p3, end: p2, radius: 0.03, color: '#ffffff' });
            const v1 = { x: p1.x - p2.x, y: p1.y - p2.y, z: p1.z - p2.z };
            const v2 = { x: p3.x - p2.x, y: p3.y - p2.y, z: p3.z - p2.z };
            const len1 = Math.sqrt(v1.x*v1.x + v1.y*v1.y + v1.z*v1.z);
            const len2 = Math.sqrt(v2.x*v2.x + v2.y*v2.y + v2.z*v2.z);
            if (len1 > 0 && len2 > 0) {
              const u1 = { x: v1.x / len1, y: v1.y / len1, z: v1.z / len1 };
              const u2 = { x: v2.x / len2, y: v2.y / len2, z: v2.z / len2 };
              const bisector = { x: u1.x + u2.x, y: u1.y + u2.y, z: u1.z + u2.z };
              const lenB = Math.sqrt(bisector.x*bisector.x + bisector.y*bisector.y + bisector.z*bisector.z);
              const labelPos = {
                x: p2.x + (lenB > 0 ? (bisector.x / lenB) * 1.2 : 0),
                y: p2.y + (lenB > 0 ? (bisector.y / lenB) * 1.2 : 0),
                z: p2.z + (lenB > 0 ? (bisector.z / lenB) * 1.2 : 0)
              };
              viewer.addLabel(m.label, {
                position: labelPos,
                backgroundColor: 'rgba(10, 10, 12, 0.85)',
                borderColor: labelColor,
                fontColor: labelColor,
                font: 'monospace',
                fontSize: 10,
                backgroundOpacity: 0.9
              });
              const arcSteps = 10;
              const arcRadius = 0.5;
              let prevPt = { x: p2.x + u1.x * arcRadius, y: p2.y + u1.y * arcRadius, z: p2.z + u1.z * arcRadius };
              for (let i = 1; i <= arcSteps; i++) {
                const t = i / arcSteps;
                const interp = {
                  x: u1.x * (1 - t) + u2.x * t,
                  y: u1.y * (1 - t) + u2.y * t,
                  z: u1.z * (1 - t) + u2.z * t
                };
                const lenI = Math.sqrt(interp.x*interp.x + interp.y*interp.y + interp.z*interp.z);
                const nextPt = {
                  x: p2.x + (lenI > 0 ? (interp.x / lenI) * arcRadius : 0),
                  y: p2.y + (lenI > 0 ? (interp.y / lenI) * arcRadius : 0),
                  z: p2.z + (lenI > 0 ? (interp.z / lenI) * arcRadius : 0)
                };
                viewer.addCylinder({ start: prevPt, end: nextPt, radius: 0.02, color: '#F2CD5C' });
                prevPt = nextPt;
              }
            }
          }

          if (m.type === 'dihedral' && m.coordinates.length === 4) {
            const [p1, p2, p3, p4] = m.coordinates;
            viewer.addCylinder({ start: p1, end: p2, radius: 0.03, color: '#ffffff' });
            viewer.addCylinder({ start: p2, end: p3, radius: 0.04, color: '#ffffff' });
            viewer.addCylinder({ start: p3, end: p4, radius: 0.03, color: '#ffffff' });
            const midCentral = {
              x: (p2.x + p3.x) / 2,
              y: (p2.y + p3.y) / 2,
              z: (p2.z + p3.z) / 2
            };
            viewer.addLabel(m.label, {
              position: midCentral,
              backgroundColor: 'rgba(10, 10, 12, 0.85)',
              borderColor: labelColor,
              fontColor: labelColor,
              font: 'monospace',
              fontSize: 10,
              backgroundOpacity: 0.9
            });
          }

          if (m.type === 'label' && m.coordinates.length === 1) {
            const [p1] = m.coordinates;
            viewer.addLabel(m.label, {
              position: p1,
              backgroundColor: 'rgba(10, 10, 12, 0.85)',
              borderColor: '#60a5fa',
              fontColor: '#ffffff',
              font: 'monospace',
              fontSize: 9,
              backgroundOpacity: 0.85
            });
          }
        });

        // Render Interactions (HBonds, Salt Bridges, etc.)
        if (props.interactions && props.interactions.length > 0) {
          props.interactions.forEach(int => {
            viewer.addCylinder({
              start: { x: int.atom1.x, y: int.atom1.y, z: int.atom1.z },
              end: { x: int.atom2.x, y: int.atom2.y, z: int.atom2.z },
              radius: 0.05,
              color: int.type === 'hbond' ? 'yellow' :
                     int.type === 'hydrophobic' ? '#a855f7' :
                     int.type === 'pistacking' ? '#06b6d4' :
                     int.type === 'saltbridge' ? '#ef4444' :
                     int.type === 'halogen' ? '#f97316' :
                     int.type === 'cationpi' ? '#ec4899' :
                     '#10b981',
              dashed: true,
              fromCap: 1,
              toCap: 1
            });
          });
        }

        // Apply Zoom / Center Focus
        if (props.pdbData !== lastZoomedData.current) {
          viewer.zoomTo();
          lastZoomedData.current = props.pdbData;
        } else if (props.focusTrigger) {
          if (props.selectedAtomSerials && props.selectedAtomSerials.size > 0) {
             viewer.zoomTo({ serial: Array.from(props.selectedAtomSerials) });
          } else {
             viewer.zoomTo();
          }
        }
        
        viewer.render();
        setIsRendering(false);
      }
    }, 10);

    return () => clearTimeout(renderTimer);
  }, [
    mode, props.molecule, props.compareMolecule, props.viewState, props.filters,
    props.pdbData, props.renderStyle, props.colorScheme, props.selectedAtomSerials, props.ligandData,
    props.focusTrigger, showDipoleArrow, dipoleMoment, activeMeasurementMode,
    props.backgroundColor, props.surfaceOpacity, props.ssData, props.ssMode,
    props.assemblyPDB, props.symmetryPDB, props.alignmentPDB, props.interactions, measurements
  ]);

  return (
    <div className="w-full h-full relative" ref={containerRef}>
      {isRendering && mode === 'studio' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-3 p-6 bg-[#111111] rounded-xl border border-white/10 shadow-2xl">
            <div className="w-8 h-8 border-4 border-[#4A90E2]/30 border-t-[#4A90E2] rounded-full animate-spin"></div>
            <div className="text-sm font-medium text-white/90 tracking-wide">Computing Representation...</div>
          </div>
        </div>
      )}
    </div>
  );
});
