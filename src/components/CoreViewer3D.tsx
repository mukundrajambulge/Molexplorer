import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import * as $3Dmol from '3dmol';
import { RenderStyle, MoleculeData, FilterState, ViewState } from '../types';
import { SSInfo } from '../lib/MolProcessor';
import { useStore } from '../store';
import { getRDKit } from '../lib/rdkit';

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
}

const CHAIN_PALETTE = [
  '#3b82f6', '#f97316', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b',
  '#14b8a6', '#ef4444', '#06b6d4', '#84cc16', '#6366f1', '#d97706'
];

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
      viewer.clear();
      viewer.removeAllSurfaces();
      viewer.removeAllShapes();
      viewer.removeAllLabels();

      const bgColor = mode === 'explorer' 
        ? (props.viewState?.canvasBackground || '#0A0A0A')
        : (props.backgroundColor || '#f0f0f0');
      viewer.setBackgroundColor(bgColor);

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
        
        // Dynamic Chain Coloring
        const presentChains = new Set<string>();
        atoms.forEach((a: any) => {
          if (a.chain && !a.hetflag) presentChains.add(a.chain);
        });
        const chainArray = Array.from(presentChains).sort();
        const chainMap: Record<string, string> = {};
        chainArray.forEach((ch, idx) => { chainMap[ch] = CHAIN_PALETTE[idx % CHAIN_PALETTE.length]; });

        // Base Styles
        const setClickStyle = (sel: any, style: any) => {
          viewer.setStyle(sel, {
            ...style,
            clickable: true,
            callback: (atom: any) => {
              if (activeMeasurementMode) addClickedAtom({ serial: atom.serial, x: atom.x, y: atom.y, z: atom.z });
              else {
                const next = new Set(props.selectedAtomSerials);
                if (next.has(atom.serial)) next.delete(atom.serial);
                else next.add(atom.serial);
                setSelectedAtomSerials(next);
              }
            }
          });
        };

        const rStyle = props.renderStyle || "Cartoon";
        if (rStyle === "Cartoon") {
          setClickStyle({ hetflag: false }, { cartoon: { color: 'spectrum', arrows: true } });
        } else if (rStyle === "Stick") {
          setClickStyle({ hetflag: false }, { stick: { color: 'spectrum' } });
        } else if (rStyle === "Space-Filling") {
          setClickStyle({ hetflag: false }, { sphere: { color: 'spectrum' } });
        } else {
          setClickStyle({ hetflag: false }, { cartoon: { color: 'spectrum' } });
        }

        // Selection Highlighting
        if (props.selectedAtomSerials && props.selectedAtomSerials.size > 0) {
          const selArray = Array.from(props.selectedAtomSerials);
          setClickStyle({ serial: selArray }, { 
            stick: { radius: 0.2, color: '#ec4899' },
            sphere: { radius: 0.4, color: '#ec4899' }
          });
        }

        if (props.ligandData) {
           const lm = viewer.addModel(props.ligandData.data, props.ligandData.format);
           setClickStyle({ model: lm.getID() }, { stick: { colorscheme: 'greenCarbon' } });
        }

        // Dipole
        if (showDipoleArrow && dipoleMoment && dipoleMoment.magnitude > 0) {
          viewer.addCylinder({
            start: dipoleMoment.com,
            end: {
              x: dipoleMoment.com.x + dipoleMoment.vector.x * 0.5,
              y: dipoleMoment.com.y + dipoleMoment.vector.y * 0.5,
              z: dipoleMoment.com.z + dipoleMoment.vector.z * 0.5
            },
            radius: 0.12,
            color: '#06b6d4',
          });
        }

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
    props.focusTrigger, showDipoleArrow, dipoleMoment, activeMeasurementMode
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
