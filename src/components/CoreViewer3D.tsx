import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import * as $3Dmol from '3dmol';
import { RenderStyle, MoleculeData, FilterState, ViewState } from '../types';
import { SSInfo } from '../lib/MolProcessor';
import { useStore } from '../store';
import { RepresentationStrategyFactory, getColorFunction } from '../rendering/RepresentationStrategy';

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
  assemblyState?: any;
  ligandData?: { data: string, format: string } | null;
  interactions?: any[];
  renderStyle?: RenderStyle;
  colorScheme?: string;
  surfaceOpacity?: number;
  backgroundColor?: string;
  selectedAtomSerials?: Set<number>;
  hiddenObjectIds?: Set<string>;
  onAtomClick?: (atom: any) => void;
  activeMeasurementMode?: string | null;
  showDipoleArrow?: boolean;
  dipoleMoment?: any;
  focusTrigger?: number;
  orthographic?: boolean;
  stereoMode?: 'none' | 'cross-eye' | 'anaglyph';
}

const CHAIN_PALETTE = [
  '#3b82f6', '#f97316', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b',
  '#14b8a6', '#ef4444', '#06b6d4', '#84cc16', '#6366f1', '#d97706'
];

function getStyleObj(
  style: string,
  colorScheme: string = 'spectrum',
  minResi: number = 1,
  maxResi: number = 100,
  chainMap: Record<string, string> = {},
  opacity: number = 1.0
) {
  const strategy = RepresentationStrategyFactory.getStrategy(style as any);
  return strategy.getStyleObject({
    colorScheme,
    minResi,
    maxResi,
    chainMap,
    opacity
  });
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
    clickedAtomBuffer,
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
        const molContent = props.molecule.rawContent;

        // Add main molecule
        viewer.addModel(molContent, format);

        // Add compare molecule
        if (props.compareMolecule?.rawContent) {
          const m2 = viewer.addModel(props.compareMolecule.rawContent, props.compareMolecule.format.toLowerCase());
          m2.setStyle({}, { stick: { colorscheme: 'greenCarbon', radius: 0.15 }, sphere: { hidden: true } });
        }

        // Apply Explorer Styles with full Opacity support
        const vs = props.viewState;
        if (vs) {
          const opacity = typeof vs.surfaceOpacity === 'number' ? vs.surfaceOpacity : 0.8;
          let baseStyle: any = {};

          if (vs.renderStyle === "Line") {
            baseStyle.line = { opacity };
          } else if (vs.renderStyle === "Stick") {
            baseStyle.stick = { opacity, radius: 0.2 };
          } else if (vs.renderStyle === "Ball-and-Stick") {
            baseStyle.stick = { opacity, radius: 0.15 };
            baseStyle.sphere = { scale: 0.3, opacity };
          } else if (vs.renderStyle === "Space-Filling") {
            baseStyle.sphere = { opacity };
          } else if (vs.renderStyle.includes("Surface")) {
            baseStyle.stick = { opacity: Math.min(opacity, 0.4), radius: 0.15 };
            baseStyle.sphere = { hidden: true };
            try {
              viewer.addSurface($3Dmol.SurfaceType.VDW, { opacity, color: 'spectrum' });
            } catch (e) {}
          } else {
            baseStyle.stick = { opacity, radius: 0.2 };
          }

          let colorscheme = 'Jmol';
          if (vs.colorTheme === "Classic CPK") colorscheme = 'rasmol';
          if (vs.colorTheme === "Monochrome") { baseStyle.color = "#B0B0B0"; }
          else { baseStyle.colorscheme = colorscheme; }

          viewer.setStyle({}, baseStyle);
          
          if (!vs.showHydrogens) viewer.setStyle({ elem: 'H' }, { hidden: true });

          // Auto-Spin 3D rotation
          if (typeof viewer.spin === 'function') {
            viewer.spin(vs.isSpinning ? 'y' : false, 1.0);
          }
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

        // 1. Interactive Picking & Measurement Click Handlers
        const handleAtomPicked = (atom: any) => {
          if (!atom) return;
          if (activeMeasurementMode) {
            addClickedAtom({
              serial: atom.serial,
              x: atom.x,
              y: atom.y,
              z: atom.z,
              name: atom.atom || atom.name,
              resName: atom.resn || atom.resName,
              resSeq: atom.resi || atom.resSeq,
              chainID: atom.chain || atom.chainID
            });
          } else if (props.onAtomClick) {
            props.onAtomClick(atom);
          } else {
            const next = new Set(props.selectedAtomSerials);
            if (next.has(atom.serial)) {
              next.delete(atom.serial);
            } else {
              next.add(atom.serial);
            }
            setSelectedAtomSerials(next);
          }
        };

        const setClickStyle = (sel: any, style: any) => {
          viewer.setStyle(sel, {
            ...style,
            clickable: true,
            callback: handleAtomPicked
          });
        };

        const rStyle = props.renderStyle || "Cartoon";
        const cScheme = props.colorScheme || "spectrum";
        const currentOpacity = typeof props.surfaceOpacity === 'number' ? props.surfaceOpacity : 0.8;

        // Base style for protein/nucleic polymers (non-HETATMs)
        setClickStyle({ hetflag: false }, getStyleObj(rStyle, cScheme, minResi, maxResi, chainMap, currentOpacity));

        // Base style for organic ligands/inhibitors (non-water HETATMs) - Render as STICKS for high visibility
        setClickStyle({ hetflag: true, not: { resn: ['HOH', 'WAT', 'DOD', 'SOL'] } }, {
          stick: { colorscheme: 'default', radius: 0.22, opacity: currentOpacity },
          sphere: { colorscheme: 'default', radius: 0.45, opacity: currentOpacity }
        });

        // Base style for solvent waters - Red Crosses
        setClickStyle({ hetflag: true, resn: ['HOH', 'WAT', 'DOD', 'SOL'] }, {
          cross: { radius: 0.5, linewidth: 1.5, color: '#ff4d4d' }
        });

        // Apply Selection Highlighting
        if (props.selectedAtomSerials && props.selectedAtomSerials.size > 0) {
          const selArray = Array.from(props.selectedAtomSerials);
          setClickStyle({ serial: selArray }, { 
            ...getStyleObj(rStyle, '#ec4899', minResi, maxResi, chainMap, 1.0),
            stick: { radius: 0.25, color: '#ec4899' },
            sphere: { radius: 0.5, color: '#ec4899' }
          });
        }

        // Render Surfaces / Mesh / Dots using Representation Strategy Pattern with true opacity
        const strategy = RepresentationStrategyFactory.getStrategy(rStyle);
        strategy.applySurfacesOrShapes(viewer, {
          colorScheme: cScheme,
          minResi,
          maxResi,
          chainMap,
          surfaceOpacity: currentOpacity
        });

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

        // 2. Render Active Measurement Picking Highlights (Glowing Spheres & Labels)
        if (clickedAtomBuffer && clickedAtomBuffer.length > 0) {
          clickedAtomBuffer.forEach((cAtom, idx) => {
            viewer.addSphere({
              center: { x: cAtom.x, y: cAtom.y, z: cAtom.z },
              radius: 0.60,
              color: '#38bdf8',
              opacity: 0.85
            });

            const labelTxt = `Point ${idx + 1}: ${(cAtom.name || '').trim()} #${cAtom.serial}`;
            viewer.addLabel(labelTxt, {
              position: { x: cAtom.x, y: cAtom.y + 0.8, z: cAtom.z },
              backgroundColor: 'rgba(14, 165, 233, 0.95)',
              borderColor: '#38bdf8',
              fontColor: '#ffffff',
              font: 'monospace',
              fontSize: 10,
              backgroundOpacity: 0.95
            });
          });
        }

        // 3. Render Committed Measurements (Distance, Angle, Dihedral, Labels)
        measurements.forEach((m) => {
          const isHighB = m.coordinates.some((coord, idx) => {
            const s = m.atomSerials[idx];
            const atom = atoms.find((a: any) => a.serial === s);
            return atom && (atom.bFactor || 0) > 50;
          });
          const labelColor = isHighB ? '#f59e0b' : '#F2CD5C';

          if (m.type === 'distance' && m.coordinates.length === 2) {
            const [p1, p2] = m.coordinates;
            const steps = 16;
            const dashColor = '#F2CD5C';
            const radius = 0.05;

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
              backgroundColor: 'rgba(10, 10, 12, 0.90)',
              borderColor: labelColor,
              fontColor: labelColor,
              font: 'monospace',
              fontSize: 10,
              backgroundOpacity: 0.95
            });
          }

          if (m.type === 'angle' && m.coordinates.length === 3) {
            const [p1, p2, p3] = m.coordinates;
            viewer.addCylinder({ start: p1, end: p2, radius: 0.04, color: '#38bdf8' });
            viewer.addCylinder({ start: p2, end: p3, radius: 0.04, color: '#38bdf8' });
            viewer.addLabel(m.label, {
              position: p2,
              backgroundColor: 'rgba(10, 10, 12, 0.90)',
              borderColor: '#38bdf8',
              fontColor: '#38bdf8',
              font: 'monospace',
              fontSize: 10,
              backgroundOpacity: 0.95
            });
          }

          if (m.type === 'dihedral' && m.coordinates.length === 4) {
            const [p1, p2, p3, p4] = m.coordinates;
            viewer.addCylinder({ start: p1, end: p2, radius: 0.04, color: '#a855f7' });
            viewer.addCylinder({ start: p2, end: p3, radius: 0.05, color: '#a855f7' });
            viewer.addCylinder({ start: p3, end: p4, radius: 0.04, color: '#a855f7' });
            const midCentral = {
              x: (p2.x + p3.x) / 2,
              y: (p2.y + p3.y) / 2,
              z: (p2.z + p3.z) / 2
            };
            viewer.addLabel(m.label, {
              position: midCentral,
              backgroundColor: 'rgba(10, 10, 12, 0.90)',
              borderColor: '#a855f7',
              fontColor: '#c084fc',
              font: 'monospace',
              fontSize: 10,
              backgroundOpacity: 0.95
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
    props.focusTrigger, showDipoleArrow, dipoleMoment, activeMeasurementMode, clickedAtomBuffer,
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
