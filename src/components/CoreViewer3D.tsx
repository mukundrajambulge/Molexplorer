import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import * as $3Dmol from '3dmol';
import { RenderStyle, MoleculeData, FilterState, ViewState } from '../types';
import { SSInfo } from '../lib/MolProcessor';
import { useStore } from '../store';
import { RepresentationStrategyFactory, getColorFunction } from '../rendering/RepresentationStrategy';
import { MolecularPicker } from '../interaction/MolecularPicker';
import { SelectionManager } from '../interaction/SelectionManager';
import { SelectionHighlight } from '../interaction/SelectionHighlight';
import { SelectionLevel, PickedAtom } from '../interaction/types';
import { MousePointer, Layers, Check, X, Sparkles, Ruler } from 'lucide-react';

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
  "#4A90E2", "#50E3C2", "#F5A623", "#E74C3C", "#9B59B6",
  "#1ABC9C", "#2ECC71", "#34495E", "#E67E22", "#D35400"
];

function getStyleObj(style: RenderStyle, colorScheme: string, minResi: number, maxResi: number, chainMap: Record<string, string>, opacity: number = 1.0) {
  const strategy = RepresentationStrategyFactory.getStrategy(style);
  return strategy.getStyleObject({
    colorScheme,
    minResi,
    maxResi,
    chainMap,
    surfaceOpacity: opacity,
    opacity
  });
}

export const CoreViewer3D = forwardRef<CoreViewer3DRef, CoreViewer3DProps>((props, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [isRendering, setIsRendering] = useState(false);
  const lastZoomedData = useRef<string | null>(null);
  
  const { mode } = props;

  // Interaction & Measurement state from Zustand
  const {
    measurements,
    activeMeasurementMode,
    clickedAtomBuffer,
    addClickedAtom,
    selectedAtomSerials,
    setSelectedAtomSerials,
    selectionLevel,
    setSelectionLevel,
    molecularSelection,
    setMolecularSelection,
    hoveredAtom,
    setHoveredAtom,
    clearSelection,
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
      ? (props.viewState?.canvasBackground || '#0b0f19')
      : (props.backgroundColor || '#0b0f19');

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
        ? (props.viewState?.canvasBackground || '#0b0f19')
        : (props.backgroundColor || '#0b0f19');
      viewer.setBackgroundColor(bgColor);
      if (typeof viewer.setProjection === 'function') {
        try { viewer.setProjection(props.orthographic ? 'orthographic' : 'perspective'); } catch (e) {}
      }

      viewer.clear();
      viewer.removeAllSurfaces();
      viewer.removeAllShapes();
      viewer.removeAllLabels();

      // Unified Atom Picking & Hover Handlers
      const handleAtomPicked = (rawAtom: any, _viewer?: any, event?: any) => {
        if (!rawAtom) return;
        const structureId = mode === 'explorer'
          ? (props.molecule?.id || props.molecule?.name || 'explorer_mol')
          : 'studio_mol';

        const pickedAtom = MolecularPicker.normalizeAtom(rawAtom, structureId);

        // 1. Measurement mode intercept
        if (activeMeasurementMode) {
          addClickedAtom({
            serial: pickedAtom.serial,
            x: pickedAtom.x,
            y: pickedAtom.y,
            z: pickedAtom.z,
            name: pickedAtom.atomName,
            resName: pickedAtom.residueName,
            resSeq: pickedAtom.residueNumber,
            chainID: pickedAtom.chainId
          });
          return;
        }

        // 2. Custom onAtomClick prop callback
        if (props.onAtomClick) {
          props.onAtomClick(pickedAtom);
        }

        // 3. Selection expansion & toggle
        const allAtoms = MolecularPicker.extractAllAtoms(viewer, structureId);
        const isMulti = Boolean(event?.shiftKey || event?.ctrlKey || event?.metaKey);
        const nextSelection = SelectionManager.toggle(
          pickedAtom,
          selectionLevel,
          allAtoms,
          molecularSelection,
          isMulti
        );

        setMolecularSelection(nextSelection);
      };

      const handleAtomHovered = (rawAtom: any) => {
        if (!rawAtom) {
          setHoveredAtom(null);
          return;
        }
        const structureId = mode === 'explorer'
          ? (props.molecule?.id || props.molecule?.name || 'explorer_mol')
          : 'studio_mol';
        const pickedAtom = MolecularPicker.normalizeAtom(rawAtom, structureId);
        setHoveredAtom(pickedAtom);
      };

      const handleAtomUnhovered = () => {
        setHoveredAtom(null);
      };

      const wrapInteractiveStyle = (baseStyle: any) => {
        return {
          ...baseStyle,
          clickable: true,
          callback: handleAtomPicked,
          hoverable: true,
          hover_callback: handleAtomHovered,
          unhover_callback: handleAtomUnhovered
        };
      };

      if (mode === 'explorer' && props.molecule?.rawContent) {
        // EXPLORER MODE RENDERING
        const format = props.molecule.format.toLowerCase();
        const molContent = props.molecule.rawContent;

        // Add main molecule
        const m1 = viewer.addModel(molContent, format);
        if (m1 && typeof m1.setClickable === 'function') {
          m1.setClickable({}, true, handleAtomPicked);
          m1.setHoverable({}, true, handleAtomHovered, handleAtomUnhovered);
        }

        // Add compare molecule
        if (props.compareMolecule?.rawContent) {
          const m2 = viewer.addModel(props.compareMolecule.rawContent, props.compareMolecule.format.toLowerCase());
          m2.setStyle({}, { stick: { colorscheme: 'greenCarbon', radius: 0.15 }, sphere: { hidden: true } });
          if (m2 && typeof m2.setClickable === 'function') {
            m2.setClickable({}, true, handleAtomPicked);
          }
        }

        // Apply Explorer Styles with full Opacity, Hydrogen, Label, and Electron Cloud support
        const vs = props.viewState;
        if (vs) {
          const rawOpacity = typeof vs.surfaceOpacity === 'number' ? vs.surfaceOpacity : 0.8;
          const opacity = vs.performanceMode ? Math.min(rawOpacity, 0.9) : rawOpacity;
          const isStickRadius = vs.performanceMode ? 0.12 : 0.20;
          const isSphereScale = vs.performanceMode ? 0.22 : 0.30;
          let baseStyle: any = {};

          if (vs.renderStyle === "Line") {
            baseStyle.line = { opacity };
          } else if (vs.renderStyle === "Stick") {
            baseStyle.stick = { opacity, radius: isStickRadius };
          } else if (vs.renderStyle === "Ball-and-Stick") {
            baseStyle.stick = { opacity, radius: isStickRadius * 0.8 };
            baseStyle.sphere = { scale: isSphereScale, opacity };
          } else if (vs.renderStyle === "Space-Filling") {
            baseStyle.sphere = { opacity };
          } else if (vs.renderStyle.includes("Surface")) {
            baseStyle.stick = { opacity: Math.min(opacity, 0.4), radius: isStickRadius * 0.7 };
            baseStyle.sphere = { hidden: true };
            try {
              viewer.addSurface($3Dmol.SurfaceType.VDW, { opacity, color: 'spectrum' });
            } catch (e) {}
          } else {
            baseStyle.stick = { opacity, radius: isStickRadius };
          }

          let colorscheme = 'Jmol';
          if (vs.colorTheme === "Classic CPK") colorscheme = 'rasmol';
          if (vs.colorTheme === "Monochrome") { baseStyle.color = "#B0B0B0"; }
          else { baseStyle.colorscheme = colorscheme; }

          viewer.setStyle({}, wrapInteractiveStyle(baseStyle));
          
          // 1. Hydrogen Styling (Standard pure white CPK convention)
          if (vs.showHydrogens) {
            const hStyle: any = {};
            if (baseStyle.line) hStyle.line = { color: '#FFFFFF', opacity };
            if (baseStyle.stick) hStyle.stick = { color: '#FFFFFF', radius: isStickRadius * 0.75, opacity };
            if (baseStyle.sphere) hStyle.sphere = { color: '#FFFFFF', scale: isSphereScale * 0.75, opacity };
            viewer.setStyle({ elem: 'H' }, wrapInteractiveStyle(hStyle));
          } else {
            viewer.setStyle({ elem: 'H' }, { hidden: true });
          }

          // 2. Electron Cloud Rendering Mode
          if (vs.electronCloudMode === "Illustrative Approximation") {
            try {
              viewer.addSurface($3Dmol.SurfaceType.VDW, {
                opacity: 0.32 * opacity,
                color: '#38bdf8'
              });
            } catch (e) {}
          } else if (vs.electronCloudMode === "Computed Density (Demo)") {
            try {
              viewer.addSurface($3Dmol.SurfaceType.SAS, {
                opacity: 0.42 * opacity,
                color: '#c084fc'
              });
            } catch (e) {}
          }

          // 3. Atom Labels Display
          if (vs.showLabels) {
            const model = viewer.getModel();
            const atoms = model ? model.selectedAtoms({}) : [];
            atoms.forEach((a: any) => {
              if (!vs.showHydrogens && (a.elem === 'H' || a.element === 'H')) return;
              const sym = a.elem || a.element || (a.atom || '').replace(/[0-9]/g, '').trim() || 'C';
              const num = a.serial !== undefined ? a.serial : (a.index !== undefined ? a.index + 1 : '');
              const labelText = `${sym}${num}`;
              viewer.addLabel(labelText, {
                position: { x: a.x, y: a.y + 0.35, z: a.z },
                backgroundColor: 'rgba(15, 23, 42, 0.90)',
                borderColor: '#00f2ff',
                fontColor: '#FFFFFF',
                font: 'monospace',
                fontSize: 10,
                backgroundOpacity: 0.90
              });
            });
          }

          // 4. Selection Highlighting Overlay
          if (molecularSelection && molecularSelection.atoms.length > 0) {
            SelectionHighlight.applySelectionOverlay(viewer, molecularSelection, '#00f2ff');
          }

          // 5. Active Measurement Markers in Viewport
          if (clickedAtomBuffer && clickedAtomBuffer.length > 0) {
            SelectionHighlight.applyMeasurementMarkers(viewer, clickedAtomBuffer, activeMeasurementMode as any);
          }

          // 6. Auto-Spin 3D rotation
          if (typeof viewer.spin === 'function') {
            viewer.spin(vs.isSpinning ? 'y' : false, 1.0);
          }
        }

        // Attach viewer level click/hover listeners
        if (typeof viewer.setClickable === 'function') {
          viewer.setClickable({}, true, handleAtomPicked);
          viewer.setHoverable({}, true, handleAtomHovered, handleAtomUnhovered);
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

        const setClickStyle = (sel: any, style: any) => {
          viewer.setStyle(sel, wrapInteractiveStyle(style));
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

        // Render Surfaces / Mesh / Dots using Representation Strategy Pattern with true opacity
        const strategy = RepresentationStrategyFactory.getStrategy(rStyle);
        strategy.applySurfacesOrShapes(viewer, {
          colorScheme: cScheme,
          minResi,
          maxResi,
          chainMap,
          surfaceOpacity: currentOpacity
        });

        // Apply Selection Highlighting Overlay (Glowing Luminous Markers)
        if (molecularSelection && molecularSelection.atoms.length > 0) {
          SelectionHighlight.applySelectionOverlay(viewer, molecularSelection, '#00f2ff');
        } else if (props.selectedAtomSerials && props.selectedAtomSerials.size > 0) {
          const selArray = Array.from(props.selectedAtomSerials);
          setClickStyle({ serial: selArray }, { 
            ...getStyleObj(rStyle, '#00f2ff', minResi, maxResi, chainMap, 1.0),
            stick: { radius: 0.26, color: '#00f2ff' },
            sphere: { radius: 0.52, color: '#00f2ff' }
          });
        }

        // Active Measurement In-Progress Markers (P1, P2, P3, P4)
        if (clickedAtomBuffer && clickedAtomBuffer.length > 0) {
          SelectionHighlight.applyMeasurementMarkers(viewer, clickedAtomBuffer, activeMeasurementMode as any);
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
        }

        // Render Committed 3D Measurements
        measurements.forEach((m: any) => {
          if (m.type === 'distance' && m.coordinates.length >= 2) {
            const [p1, p2] = m.coordinates;
            viewer.addCylinder({
              start: p1,
              end: p2,
              radius: 0.08,
              color: '#00f2ff',
              dashed: true,
              fromCap: 1,
              toCap: 1
            });
            const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2, z: (p1.z + p2.z) / 2 };
            viewer.addLabel(m.label, {
              position: mid,
              backgroundColor: 'rgba(15, 23, 42, 0.90)',
              borderColor: '#00f2ff',
              fontColor: '#ffffff',
              font: 'monospace',
              fontSize: 10,
              backgroundOpacity: 0.90
            });
          } else if (m.type === 'angle' && m.coordinates.length >= 3) {
            const [p1, p2, p3] = m.coordinates;
            viewer.addCylinder({ start: p1, end: p2, radius: 0.06, color: '#f59e0b', dashed: true });
            viewer.addCylinder({ start: p2, end: p3, radius: 0.06, color: '#f59e0b', dashed: true });
            viewer.addLabel(m.label, {
              position: p2,
              backgroundColor: 'rgba(15, 23, 42, 0.90)',
              borderColor: '#f59e0b',
              fontColor: '#ffffff',
              font: 'monospace',
              fontSize: 10,
              backgroundOpacity: 0.90
            });
          } else if (m.type === 'dihedral' && m.coordinates.length >= 4) {
            const [p1, p2, p3, p4] = m.coordinates;
            viewer.addCylinder({ start: p1, end: p2, radius: 0.05, color: '#a855f7', dashed: true });
            viewer.addCylinder({ start: p2, end: p3, radius: 0.08, color: '#a855f7', dashed: false });
            viewer.addCylinder({ start: p3, end: p4, radius: 0.05, color: '#a855f7', dashed: true });
            const mid = { x: (p2.x + p3.x) / 2, y: (p2.y + p3.y) / 2, z: (p2.z + p3.z) / 2 };
            viewer.addLabel(m.label, {
              position: mid,
              backgroundColor: 'rgba(15, 23, 42, 0.90)',
              borderColor: '#a855f7',
              fontColor: '#ffffff',
              font: 'monospace',
              fontSize: 10,
              backgroundOpacity: 0.90
            });
          } else if (m.type === 'label' && m.coordinates.length >= 1) {
            const p = m.coordinates[0];
            viewer.addLabel(m.label, {
              position: { x: p.x, y: p.y + 0.3, z: p.z },
              backgroundColor: 'rgba(15, 23, 42, 0.90)',
              borderColor: '#60a5fa',
              fontColor: '#ffffff',
              font: 'monospace',
              fontSize: 9,
              backgroundOpacity: 0.90
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

        // Attach viewer & model picking listeners
        if (typeof m.setClickable === 'function') {
          m.setClickable({}, true, handleAtomPicked);
          m.setHoverable({}, true, handleAtomHovered, handleAtomUnhovered);
        }
        if (typeof viewer.setClickable === 'function') {
          viewer.setClickable({}, true, handleAtomPicked);
          viewer.setHoverable({}, true, handleAtomHovered, handleAtomUnhovered);
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
    props.assemblyPDB, props.symmetryPDB, props.alignmentPDB, props.interactions, measurements,
    selectionLevel, molecularSelection
  ]);

  const granularityLevels: { id: SelectionLevel; label: string }[] = [
    { id: 'atom', label: 'Atom' },
    { id: 'residue', label: 'Residue' },
    { id: 'ligand', label: 'Ligand' },
    { id: 'chain', label: 'Chain' },
    { id: 'molecule', label: 'Molecule' }
  ];

  return (
    <div className="w-full h-full relative" ref={containerRef}>
      {/* Floating Selection Granularity Bar (Visible in both Explorer and Studio when not in active measurement) */}
      {!activeMeasurementMode && (
        <div className="absolute top-3 left-4 z-30 pointer-events-auto flex items-center gap-1.5 rounded-xl border border-slate-700/60 bg-slate-900/85 p-1 backdrop-blur-xl shadow-xl">
          <div className="flex items-center gap-1 px-2 text-[10px] font-mono text-cyan-400">
            <MousePointer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline font-semibold">PICK:</span>
          </div>
          {granularityLevels.map((lvl) => (
            <button
              key={lvl.id}
              onClick={() => setSelectionLevel(lvl.id)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
                selectionLevel === lvl.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_10px_rgba(0,242,255,0.2)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {lvl.label}
            </button>
          ))}

          {molecularSelection && molecularSelection.atoms.length > 0 && (
            <>
              <div className="h-3.5 w-px bg-white/20 mx-1" />
              <div className="flex items-center gap-1.5 px-2">
                <span className="font-mono text-[10px] text-cyan-300 font-bold">
                  {molecularSelection.atoms.length} {molecularSelection.atoms.length === 1 ? 'atom' : 'atoms'}
                </span>
                <button
                  onClick={clearSelection}
                  className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                  title="Clear selection"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Floating Active Measurement Banner in Viewport */}
      {activeMeasurementMode && (
        <div className="absolute top-3 left-4 z-30 pointer-events-auto flex items-center gap-3 rounded-xl border border-cyan-400/50 bg-slate-900/90 px-4 py-2 shadow-2xl backdrop-blur-xl animate-fadeIn">
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-cyan-300 uppercase">
            <Ruler className="h-4 w-4 animate-pulse text-cyan-400" />
            <span>{activeMeasurementMode}:</span>
          </div>
          <span className="text-[11px] font-mono text-slate-300">
            {clickedAtomBuffer.length === 0
              ? 'Click atom in 3D canvas...'
              : clickedAtomBuffer.map((a, i) => `[P${i+1}: ${(a.name || '').trim()} #${a.serial}]`).join(' → ')}
          </span>
          <div className="h-3.5 w-px bg-white/20" />
          <button
            onClick={() => useStore.getState().setMeasurementMode(null)}
            className="text-[10px] font-mono text-slate-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-white/10"
            title="Cancel measurement mode"
          >
            Cancel ✕
          </button>
        </div>
      )}

      {/* Floating Hover Atom Telemetry Tooltip */}
      {hoveredAtom && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-30 flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-slate-900/90 px-3 py-1.5 font-mono text-[11px] text-cyan-300 backdrop-blur-xl shadow-lg">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
          <span>{SelectionHighlight.formatAtomTooltip(hoveredAtom)}</span>
        </div>
      )}

      {isRendering && mode === 'studio' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-3 p-6 bg-slate-900/90 rounded-xl border border-slate-700/60 shadow-2xl">
            <div className="w-8 h-8 border-4 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin"></div>
            <div className="text-sm font-medium text-slate-100 tracking-wide">Computing Representation...</div>
          </div>
        </div>
      )}
    </div>
  );
});
