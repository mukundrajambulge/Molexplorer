import React, { useState } from 'react';
import { 
  Eye, 
  EyeOff, 
  Trash2, 
  Maximize2, 
  Palette, 
  Tag, 
  Layers, 
  Sparkles, 
  Download, 
  ChevronRight,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import { NamedSelection, RenderStyle } from '../types';

export interface ObjectControlItem {
  id: string;
  name: string;
  type: 'master_all' | 'active_sele' | 'structure' | 'named_selection';
  atomCount: number;
  visible: boolean;
  colorHex?: string;
  style?: RenderStyle;
}

export interface ObjectControlPanelProps {
  items: ObjectControlItem[];
  onAction: (id: string, action: string) => void;
  onShow: (id: string, style: RenderStyle) => void;
  onHide: (id: string, target: 'all' | 'ribbon' | 'surface' | 'waters' | 'hydrogens') => void;
  onLabel: (id: string, type: 'resn' | 'resi' | 'name' | 'bfactor' | 'clear') => void;
  onColor: (id: string, schemeOrHex: string) => void;
  onToggleVisibility: (id: string) => void;
  onDeleteObject?: (id: string) => void;
}

export const ObjectControlPanel: React.FC<ObjectControlPanelProps> = ({
  items,
  onAction,
  onShow,
  onHide,
  onLabel,
  onColor,
  onToggleVisibility,
  onDeleteObject
}) => {
  const [activeMenu, setActiveMenu] = useState<{ id: string; col: 'A' | 'S' | 'H' | 'L' | 'C' } | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleMenu = (id: string, col: 'A' | 'S' | 'H' | 'L' | 'C', e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeMenu?.id === id && activeMenu?.col === col) {
      setActiveMenu(null);
    } else {
      setActiveMenu({ id, col });
    }
  };

  // Close menus on outside click
  React.useEffect(() => {
    const handleClose = () => setActiveMenu(null);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  return (
    <div className="flex flex-col bg-[#07070A]/95 border-l border-white/10 text-white font-sans text-xs w-72 shrink-0 select-none shadow-2xl backdrop-blur-xl z-20">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3 h-9 bg-[#0B0B10] border-b border-white/10 text-[11px] font-mono text-slate-300">
        <div className="flex items-center gap-1.5 font-bold text-cyan-300">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>OBJECTS & SELECTIONS</span>
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/10 transition-colors"
          title={isCollapsed ? 'Expand panel' : 'Collapse panel'}
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
        </button>
      </div>

      {/* Object Matrix Table */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04] p-1 space-y-1">
          {items.map((item) => {
            const isMaster = item.id === 'all';
            const isSele = item.id === 'sele';

            return (
              <div 
                key={item.id} 
                className={`relative flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors ${
                  isMaster 
                    ? 'bg-slate-900/60 border border-slate-800' 
                    : isSele 
                      ? 'bg-cyan-950/30 border border-cyan-500/30' 
                      : 'hover:bg-white/[0.04]'
                }`}
              >
                {/* Left: Eye + Object Name */}
                <div className="flex items-center gap-2 truncate pr-2 min-w-0">
                  <button
                    onClick={() => onToggleVisibility(item.id)}
                    className="p-0.5 text-slate-400 hover:text-white rounded transition-colors"
                    title={item.visible ? 'Hide object' : 'Show object'}
                  >
                    {item.visible ? (
                      <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-slate-600" />
                    )}
                  </button>

                  <div className="flex flex-col truncate">
                    <span className={`text-[11px] font-medium truncate ${
                      isMaster 
                        ? 'font-mono text-cyan-300 font-bold' 
                        : isSele 
                          ? 'font-mono text-amber-300 font-bold' 
                          : 'text-slate-200'
                    }`}>
                      {item.name}
                    </span>
                    <span className="text-[9px] font-mono text-slate-500">
                      {item.atomCount} {item.atomCount === 1 ? 'atom' : 'atoms'}
                    </span>
                  </div>
                </div>

                {/* Right: ASHLC 5-Button Matrix */}
                <div className="flex items-center gap-0.5 shrink-0 font-mono text-[10px] font-bold">
                  {/* [A] Action */}
                  <div className="relative">
                    <button
                      onClick={(e) => toggleMenu(item.id, 'A', e)}
                      className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                        activeMenu?.id === item.id && activeMenu?.col === 'A'
                          ? 'bg-cyan-400 text-slate-950 shadow-sm'
                          : 'bg-white/[0.06] text-slate-300 hover:bg-cyan-500/20 hover:text-cyan-300'
                      }`}
                      title="Actions (Zoom, Center, Align, Export)"
                    >
                      A
                    </button>
                    {activeMenu?.id === item.id && activeMenu?.col === 'A' && (
                      <div className="absolute right-0 top-6 z-50 w-44 rounded-xl border border-slate-700 bg-slate-900/98 p-1 shadow-2xl space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
                        <button
                          onClick={() => onAction(item.id, 'zoom')}
                          className="w-full text-left px-2 py-1.5 rounded text-[11px] text-slate-200 hover:bg-cyan-500/20 hover:text-white"
                        >
                          Zoom to Bounding Box
                        </button>
                        <button
                          onClick={() => onAction(item.id, 'center')}
                          className="w-full text-left px-2 py-1.5 rounded text-[11px] text-slate-200 hover:bg-cyan-500/20 hover:text-white"
                        >
                          Center Camera
                        </button>
                        <button
                          onClick={() => onAction(item.id, 'align')}
                          className="w-full text-left px-2 py-1.5 rounded text-[11px] text-slate-200 hover:bg-cyan-500/20 hover:text-white"
                        >
                          Align Kabsch RMSD
                        </button>
                        <button
                          onClick={() => onAction(item.id, 'export')}
                          className="w-full text-left px-2 py-1.5 rounded text-[11px] text-slate-200 hover:bg-cyan-500/20 hover:text-white"
                        >
                          Export as PDB File
                        </button>
                        {onDeleteObject && !isMaster && (
                          <button
                            onClick={() => onDeleteObject(item.id)}
                            className="w-full text-left px-2 py-1.5 rounded text-[11px] text-rose-400 hover:bg-rose-500/20 hover:text-rose-200"
                          >
                            Delete Object
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* [S] Show */}
                  <div className="relative">
                    <button
                      onClick={(e) => toggleMenu(item.id, 'S', e)}
                      className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                        activeMenu?.id === item.id && activeMenu?.col === 'S'
                          ? 'bg-amber-400 text-slate-950 shadow-sm'
                          : 'bg-white/[0.06] text-slate-300 hover:bg-amber-500/20 hover:text-amber-300'
                      }`}
                      title="Show Representation (Cartoon, Sticks, Spheres, Putty, Surface)"
                    >
                      S
                    </button>
                    {activeMenu?.id === item.id && activeMenu?.col === 'S' && (
                      <div className="absolute right-0 top-6 z-50 w-44 rounded-xl border border-slate-700 bg-slate-900/98 p-1 shadow-2xl space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
                        {[
                          'Cartoon', 
                          'Stick', 
                          'Ball-and-Stick', 
                          'Space-Filling', 
                          'Putty', 
                          'Solvent-Accessible Surface', 
                          'Mesh', 
                          'Dots', 
                          'Line'
                        ].map((st) => (
                          <button
                            key={st}
                            onClick={() => onShow(item.id, st as RenderStyle)}
                            className="w-full text-left px-2 py-1.5 rounded text-[11px] text-slate-200 hover:bg-amber-500/20 hover:text-white"
                          >
                            as {st}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* [H] Hide */}
                  <div className="relative">
                    <button
                      onClick={(e) => toggleMenu(item.id, 'H', e)}
                      className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                        activeMenu?.id === item.id && activeMenu?.col === 'H'
                          ? 'bg-rose-400 text-slate-950 shadow-sm'
                          : 'bg-white/[0.06] text-slate-300 hover:bg-rose-500/20 hover:text-rose-300'
                      }`}
                      title="Hide Components (Everything, Ribbon, Surface, Waters, Hydrogens)"
                    >
                      H
                    </button>
                    {activeMenu?.id === item.id && activeMenu?.col === 'H' && (
                      <div className="absolute right-0 top-6 z-50 w-44 rounded-xl border border-slate-700 bg-slate-900/98 p-1 shadow-2xl space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
                        <button
                          onClick={() => onHide(item.id, 'all')}
                          className="w-full text-left px-2 py-1.5 rounded text-[11px] text-slate-200 hover:bg-rose-500/20 hover:text-white"
                        >
                          Hide Everything
                        </button>
                        <button
                          onClick={() => onHide(item.id, 'ribbon')}
                          className="w-full text-left px-2 py-1.5 rounded text-[11px] text-slate-200 hover:bg-rose-500/20 hover:text-white"
                        >
                          Hide Cartoon Ribbon
                        </button>
                        <button
                          onClick={() => onHide(item.id, 'surface')}
                          className="w-full text-left px-2 py-1.5 rounded text-[11px] text-slate-200 hover:bg-rose-500/20 hover:text-white"
                        >
                          Hide Surface
                        </button>
                        <button
                          onClick={() => onHide(item.id, 'waters')}
                          className="w-full text-left px-2 py-1.5 rounded text-[11px] text-slate-200 hover:bg-rose-500/20 hover:text-white"
                        >
                          Hide Solvent Waters
                        </button>
                        <button
                          onClick={() => onHide(item.id, 'hydrogens')}
                          className="w-full text-left px-2 py-1.5 rounded text-[11px] text-slate-200 hover:bg-rose-500/20 hover:text-white"
                        >
                          Hide Non-Polar Hydrogens
                        </button>
                      </div>
                    )}
                  </div>

                  {/* [L] Label */}
                  <div className="relative">
                    <button
                      onClick={(e) => toggleMenu(item.id, 'L', e)}
                      className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                        activeMenu?.id === item.id && activeMenu?.col === 'L'
                          ? 'bg-teal-400 text-slate-950 shadow-sm'
                          : 'bg-white/[0.06] text-slate-300 hover:bg-teal-500/20 hover:text-teal-300'
                      }`}
                      title="Labels (Residue Name, Sequence #, Atom Name, B-Factor)"
                    >
                      L
                    </button>
                    {activeMenu?.id === item.id && activeMenu?.col === 'L' && (
                      <div className="absolute right-0 top-6 z-50 w-44 rounded-xl border border-slate-700 bg-slate-900/98 p-1 shadow-2xl space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
                        <button
                          onClick={() => onLabel(item.id, 'resn')}
                          className="w-full text-left px-2 py-1.5 rounded text-[11px] text-slate-200 hover:bg-teal-500/20 hover:text-white"
                        >
                          Residues (e.g. ALA-12)
                        </button>
                        <button
                          onClick={() => onLabel(item.id, 'name')}
                          className="w-full text-left px-2 py-1.5 rounded text-[11px] text-slate-200 hover:bg-teal-500/20 hover:text-white"
                        >
                          Atom Names (e.g. CA)
                        </button>
                        <button
                          onClick={() => onLabel(item.id, 'bfactor')}
                          className="w-full text-left px-2 py-1.5 rounded text-[11px] text-slate-200 hover:bg-teal-500/20 hover:text-white"
                        >
                          B-Factor Values
                        </button>
                        <button
                          onClick={() => onLabel(item.id, 'clear')}
                          className="w-full text-left px-2 py-1.5 rounded text-[11px] text-rose-400 hover:bg-rose-500/20 hover:text-rose-200"
                        >
                          Clear Labels
                        </button>
                      </div>
                    )}
                  </div>

                  {/* [C] Color */}
                  <div className="relative">
                    <button
                      onClick={(e) => toggleMenu(item.id, 'C', e)}
                      className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                        activeMenu?.id === item.id && activeMenu?.col === 'C'
                          ? 'bg-violet-400 text-slate-950 shadow-sm'
                          : 'bg-white/[0.06] text-slate-300 hover:bg-violet-500/20 hover:text-violet-300'
                      }`}
                      title="Color Palette (Element CPK, Chain, Spectrum, Hydrophobicity, ESP)"
                    >
                      C
                    </button>
                    {activeMenu?.id === item.id && activeMenu?.col === 'C' && (
                      <div className="absolute right-0 top-6 z-50 w-44 rounded-xl border border-slate-700 bg-slate-900/98 p-1 shadow-2xl space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
                        {[
                          { label: 'By Element (CPK)', id: 'Classic CPK' },
                          { label: 'Modern/Jmol', id: 'Modern/Jmol' },
                          { label: 'Spectrum / Rainbow', id: 'spectrum' },
                          { label: 'By Chain', id: 'chain' },
                          { label: 'Secondary Structure', id: 'Secondary Structure (Standard)' },
                          { label: 'Hydrophobicity', id: 'Hydrophobicity' },
                          { label: 'ESP Potential', id: 'ESP' },
                          { label: 'B-Factor Putty', id: 'bfactor' },
                          { label: 'Cyan Swatch', id: '#06b6d4' },
                          { label: 'Amber Swatch', id: '#f59e0b' },
                          { label: 'Magenta Swatch', id: '#ec4899' },
                          { label: 'White', id: '#ffffff' }
                        ].map((c) => (
                          <button
                            key={c.id}
                            onClick={() => onColor(item.id, c.id)}
                            className="w-full text-left px-2 py-1.5 rounded text-[11px] text-slate-200 hover:bg-violet-500/20 hover:text-white flex items-center gap-1.5"
                          >
                            {c.id.startsWith('#') && (
                              <span className="w-2.5 h-2.5 rounded-full border border-white/20" style={{ backgroundColor: c.id }} />
                            )}
                            <span>{c.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
