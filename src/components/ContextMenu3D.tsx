import React, { useEffect, useRef } from 'react';
import { 
  Target, 
  Eye, 
  EyeOff, 
  Ruler, 
  Sparkles, 
  Maximize2, 
  Tag, 
  Palette, 
  Layers,
  Flame,
  X
} from 'lucide-react';
import { PickedAtom } from '../interaction/types';

export interface ContextMenu3DProps {
  x: number;
  y: number;
  atom: PickedAtom;
  onClose: () => void;
  onSelectPocket: (radius: number) => void;
  onCenterResidue: () => void;
  onMeasureFromAtom: () => void;
  onToggleSticks: () => void;
  onColorResidue: (color: string) => void;
}

export const ContextMenu3D: React.FC<ContextMenu3DProps> = ({
  x,
  y,
  atom,
  onClose,
  onSelectPocket,
  onCenterResidue,
  onMeasureFromAtom,
  onToggleSticks,
  onColorResidue
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click or escape
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Constrain menu inside viewport bounds
  const menuWidth = 260;
  const menuHeight = 360;
  const clampedX = Math.min(Math.max(10, x), window.innerWidth - menuWidth - 10);
  const clampedY = Math.min(Math.max(10, y), window.innerHeight - menuHeight - 10);

  return (
    <div
      ref={menuRef}
      style={{ left: `${clampedX}px`, top: `${clampedY}px` }}
      className="fixed z-50 w-64 rounded-2xl border border-slate-700/80 bg-slate-900/95 p-2.5 font-sans text-xs text-slate-100 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 select-none"
    >
      {/* Header with Atom Telemetry */}
      <div className="flex items-start justify-between border-b border-slate-700/60 pb-2 mb-2">
        <div>
          <div className="flex items-center gap-1.5 font-mono text-cyan-300 font-bold text-[11px]">
            <Target className="w-3.5 h-3.5 text-cyan-400" />
            <span>{atom.atomName} #{atom.serial}</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
              {atom.isHetatm ? 'LIG' : 'ATOM'}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            {atom.residueName} {atom.residueNumber}:{atom.chainId} | B={atom.bFactor !== undefined ? atom.bFactor.toFixed(1) : '20.0'} Å²
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/10"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Action List */}
      <div className="space-y-1 text-[11px]">
        {/* Center & Zoom */}
        <button
          onClick={() => { onCenterResidue(); onClose(); }}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-slate-200 hover:text-white hover:bg-cyan-500/15 transition-all group"
        >
          <Maximize2 className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
          <span>Center on {atom.residueName}-{atom.residueNumber}</span>
        </button>

        {/* Toggle Local Sticks */}
        <button
          onClick={() => { onToggleSticks(); onClose(); }}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-slate-200 hover:text-white hover:bg-cyan-500/15 transition-all group"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
          <span>Toggle Sidechain Sticks</span>
        </button>

        {/* Measure */}
        <button
          onClick={() => { onMeasureFromAtom(); onClose(); }}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-slate-200 hover:text-white hover:bg-cyan-500/15 transition-all group"
        >
          <Ruler className="w-3.5 h-3.5 text-teal-400 group-hover:scale-110 transition-transform" />
          <span>Start Distance Measurement</span>
        </button>

        <div className="h-px bg-slate-700/60 my-1.5" />

        {/* Pocket Expansion Sub-Menu */}
        <div className="px-2.5 py-1 text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
          <Layers className="w-3 h-3 text-cyan-400" />
          <span>Select Pocket Zone</span>
        </div>
        <div className="grid grid-cols-3 gap-1 px-1">
          {[3.5, 5.0, 8.0].map((rad) => (
            <button
              key={rad}
              onClick={() => { onSelectPocket(rad); onClose(); }}
              className="py-1 rounded-md bg-slate-800/80 border border-slate-700/60 text-[10px] font-mono text-center text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-400/40 transition-all"
            >
              {rad.toFixed(1)} Å
            </button>
          ))}
        </div>

        <div className="h-px bg-slate-700/60 my-1.5" />

        {/* Quick Swatch Colors */}
        <div className="px-2.5 py-1 text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
          <Palette className="w-3 h-3 text-amber-400" />
          <span>Color Residue</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5">
          {[
            { name: 'Cyan', hex: '#06b6d4' },
            { name: 'Amber', hex: '#f59e0b' },
            { name: 'Emerald', hex: '#10b981' },
            { name: 'Rose', hex: '#ef4444' },
            { name: 'Purple', hex: '#a855f7' },
            { name: 'White', hex: '#ffffff' }
          ].map((swatch) => (
            <button
              key={swatch.hex}
              onClick={() => { onColorResidue(swatch.hex); onClose(); }}
              style={{ backgroundColor: swatch.hex }}
              title={`Color ${swatch.name}`}
              className="w-5 h-5 rounded-full border border-white/30 hover:scale-125 transition-transform shadow-sm"
            />
          ))}
        </div>
      </div>
    </div>
  );
};
