import React, { useEffect, useRef } from "react";
import { Maximize2, EyeOff, Ruler, Target, X, Tag } from "lucide-react";

export interface ContextMenuTarget {
  atomId?: number;
  resName?: string;
  resNum?: number;
  chain?: string;
  elem?: string;
  x: number;
  y: number;
}

interface ViewportContextMenuProps {
  target: ContextMenuTarget | null;
  onClose: () => void;
  onCenter: (target: ContextMenuTarget) => void;
  onSelectScope: (scope: "atom" | "residue" | "chain", target: ContextMenuTarget) => void;
  onHideScope: (scope: "residue" | "chain", target: ContextMenuTarget) => void;
  onStartMeasure: (target: ContextMenuTarget) => void;
}

export const ViewportContextMenu: React.FC<ViewportContextMenuProps> = ({
  target,
  onClose,
  onCenter,
  onSelectScope,
  onHideScope,
  onStartMeasure,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  if (!target) return null;

  const hasAtom = target.atomId !== undefined;
  const label = hasAtom
    ? `${target.resName || "RES"} ${target.resNum || ""}:${target.chain || "A"} (${target.elem || "Atom"})`
    : "Viewport Background";

  return (
    <div
      ref={menuRef}
      style={{ top: target.y, left: target.x }}
      className="fixed z-50 bg-[#14141c]/95 backdrop-blur-lg border border-white/20 rounded-xl shadow-2xl p-1.5 min-w-48 text-white/90 font-sans text-xs animate-in fade-in zoom-in-95 duration-100 select-none"
    >
      {/* Target Title Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-white/5 border-b border-white/10 rounded-t-lg font-mono text-[11px] text-[#F27D26]">
        <div className="flex items-center gap-1.5 truncate">
          <Target className="w-3.5 h-3.5 text-[#F27D26]" />
          <span className="truncate font-semibold">{label}</span>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white transition-colors ml-1">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Menu Actions */}
      <div className="flex flex-col gap-0.5 mt-1">
        <button
          onClick={() => { onCenter(target); onClose(); }}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-white/10 text-left text-white/90 transition-colors"
        >
          <Maximize2 className="w-3.5 h-3.5 text-amber-400" /> Center & Zoom Here
        </button>

        {hasAtom && (
          <>
            <div className="h-px bg-white/10 my-0.5" />
            <div className="px-2.5 py-1 text-[10px] text-white/40 font-mono uppercase tracking-wider">Selection Scope</div>
            
            <button
              onClick={() => { onSelectScope("atom", target); onClose(); }}
              className="flex items-center gap-2 px-2.5 py-1 rounded hover:bg-emerald-500/20 text-left text-emerald-300 transition-colors"
            >
              <Tag className="w-3.5 h-3.5 text-emerald-400" /> Select Atom #{target.atomId}
            </button>
            <button
              onClick={() => { onSelectScope("residue", target); onClose(); }}
              className="flex items-center gap-2 px-2.5 py-1 rounded hover:bg-emerald-500/20 text-left text-emerald-300 transition-colors"
            >
              <Tag className="w-3.5 h-3.5 text-emerald-400" /> Select Residue {target.resName} {target.resNum}
            </button>
            <button
              onClick={() => { onSelectScope("chain", target); onClose(); }}
              className="flex items-center gap-2 px-2.5 py-1 rounded hover:bg-emerald-500/20 text-left text-emerald-300 transition-colors"
            >
              <Tag className="w-3.5 h-3.5 text-emerald-400" /> Select Chain {target.chain}
            </button>

            <div className="h-px bg-white/10 my-0.5" />
            <button
              onClick={() => { onHideScope("residue", target); onClose(); }}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-rose-500/20 text-left text-rose-300 transition-colors"
            >
              <EyeOff className="w-3.5 h-3.5 text-rose-400" /> Hide Residue {target.resNum}
            </button>
            <button
              onClick={() => { onStartMeasure(target); onClose(); }}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-cyan-500/20 text-left text-cyan-300 transition-colors"
            >
              <Ruler className="w-3.5 h-3.5 text-cyan-400" /> Measure Distance from Here
            </button>
          </>
        )}
      </div>
    </div>
  );
};
