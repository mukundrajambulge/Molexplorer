import React, { useState } from "react";
import { Eye, EyeOff, Layers, ChevronRight, ChevronDown, Trash2, Maximize2 } from "lucide-react";
import { RenderStyle } from "../types";

export interface ObjectItem {
  id: string;
  name: string;
  type: "molecule" | "selection" | "alignment" | "assembly";
  atomCount: number;
  visible: boolean;
  color?: string;
  style?: RenderStyle;
}

interface ObjectControlPanelProps {
  objects: ObjectItem[];
  onToggleVisibility: (id: string) => void;
  onDeleteObject: (id: string) => void;
  onZoomObject: (id: string) => void;
  onSetStyle: (id: string, style: RenderStyle) => void;
  onSetColor: (id: string, colorScheme: string) => void;
  onHideStyle: (id: string, styleCategory: string) => void;
  onLabelObject: (id: string, labelType: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const ObjectControlPanel: React.FC<ObjectControlPanelProps> = ({
  objects,
  onToggleVisibility,
  onDeleteObject,
  onZoomObject,
  onSetStyle,
  onSetColor,
  onHideStyle,
  onLabelObject,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [activeMenu, setActiveMenu] = useState<{ id: string; menu: "A" | "S" | "H" | "L" | "C" } | null>(null);

  const toggleMenu = (id: string, menu: "A" | "S" | "H" | "L" | "C") => {
    if (activeMenu?.id === id && activeMenu.menu === menu) {
      setActiveMenu(null);
    } else {
      setActiveMenu({ id, menu });
    }
  };

  return (
    <div className="bg-[#111116]/90 backdrop-blur-md border border-white/10 rounded-xl text-white/90 text-xs w-72 shadow-2xl overflow-hidden font-sans select-none">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-white/10 font-medium">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-[#F27D26]" />
          <span className="font-semibold tracking-wide text-white">Objects & Selections</span>
          <span className="px-1.5 py-0.2 text-[10px] bg-white/10 rounded text-white/60 font-mono">
            {objects.length}
          </span>
        </div>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="text-white/40 hover:text-white transition-colors"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Objects List */}
      {!isCollapsed && (
        <div className="divide-y divide-white/5 max-h-80 overflow-y-auto custom-scrollbar">
          {objects.length === 0 ? (
            <div className="p-4 text-center text-white/40 italic text-[11px]">
              No loaded objects or active selections
            </div>
          ) : (
            objects.map((obj) => (
              <div key={obj.id} className="relative p-2 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center justify-between gap-1.5">
                  {/* Object Name & Visibility */}
                  <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
                    <button
                      onClick={() => onToggleVisibility(obj.id)}
                      className={`p-0.5 rounded transition-colors ${
                        obj.visible ? "text-emerald-400 hover:text-emerald-300" : "text-white/30 hover:text-white/60"
                      }`}
                      title={obj.visible ? "Hide Object" : "Show Object"}
                    >
                      {obj.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    <span
                      className={`truncate font-mono text-[11px] ${
                        obj.type === "selection" ? "text-pink-400 italic" : "text-white font-medium"
                      }`}
                      title={`${obj.name} (${obj.atomCount} atoms)`}
                    >
                      {obj.name}
                    </span>
                    <span className="text-[10px] text-white/30 font-mono">({obj.atomCount})</span>
                  </div>

                  {/* Action Control Buttons */}
                  <div className="flex items-center gap-0.5 shrink-0 font-mono text-[10px]">
                    {/* A - Action */}
                    <button
                      onClick={() => toggleMenu(obj.id, "A")}
                      className={`px-1.5 py-0.5 rounded font-bold transition-all border ${
                        activeMenu?.id === obj.id && activeMenu.menu === "A"
                          ? "bg-amber-500/30 text-amber-300 border-amber-500/50"
                          : "bg-white/5 hover:bg-white/10 text-amber-400 border-white/10"
                      }`}
                      title="Action Menu"
                    >
                      A
                    </button>

                    {/* S - Show */}
                    <button
                      onClick={() => toggleMenu(obj.id, "S")}
                      className={`px-1.5 py-0.5 rounded font-bold transition-all border ${
                        activeMenu?.id === obj.id && activeMenu.menu === "S"
                          ? "bg-emerald-500/30 text-emerald-300 border-emerald-500/50"
                          : "bg-white/5 hover:bg-white/10 text-emerald-400 border-white/10"
                      }`}
                      title="Show Representation"
                    >
                      S
                    </button>

                    {/* H - Hide */}
                    <button
                      onClick={() => toggleMenu(obj.id, "H")}
                      className={`px-1.5 py-0.5 rounded font-bold transition-all border ${
                        activeMenu?.id === obj.id && activeMenu.menu === "H"
                          ? "bg-rose-500/30 text-rose-300 border-rose-500/50"
                          : "bg-white/5 hover:bg-white/10 text-rose-400 border-white/10"
                      }`}
                      title="Hide Representation"
                    >
                      H
                    </button>

                    {/* L - Label */}
                    <button
                      onClick={() => toggleMenu(obj.id, "L")}
                      className={`px-1.5 py-0.5 rounded font-bold transition-all border ${
                        activeMenu?.id === obj.id && activeMenu.menu === "L"
                          ? "bg-cyan-500/30 text-cyan-300 border-cyan-500/50"
                          : "bg-white/5 hover:bg-white/10 text-cyan-400 border-white/10"
                      }`}
                      title="Label Options"
                    >
                      L
                    </button>

                    {/* C - Color */}
                    <button
                      onClick={() => toggleMenu(obj.id, "C")}
                      className={`px-1.5 py-0.5 rounded font-bold transition-all border ${
                        activeMenu?.id === obj.id && activeMenu.menu === "C"
                          ? "bg-purple-500/30 text-purple-300 border-purple-500/50"
                          : "bg-white/5 hover:bg-white/10 text-purple-400 border-white/10"
                      }`}
                      title="Color Options"
                    >
                      C
                    </button>
                  </div>
                </div>

                {/* Dropdown Popup Menu */}
                {activeMenu?.id === obj.id && (
                  <div className="mt-1.5 p-1.5 bg-[#181820] border border-white/15 rounded-lg shadow-xl animate-in fade-in slide-in-from-top-1 duration-150 text-[11px] z-20 relative">
                    {/* A - Action Sub-Menu */}
                    {activeMenu.menu === "A" && (
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => { onZoomObject(obj.id); setActiveMenu(null); }}
                          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/10 text-left text-white/80"
                        >
                          <Maximize2 className="w-3 h-3 text-amber-400" /> Center & Zoom
                        </button>
                        <button
                          onClick={() => { onDeleteObject(obj.id); setActiveMenu(null); }}
                          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-rose-500/20 text-left text-rose-300"
                        >
                          <Trash2 className="w-3 h-3 text-rose-400" /> Delete Object
                        </button>
                      </div>
                    )}

                    {/* S - Show Sub-Menu */}
                    {activeMenu.menu === "S" && (
                      <div className="grid grid-cols-2 gap-0.5">
                        {[
                          { label: "Cartoon", style: "Cartoon" },
                          { label: "B-factor Putty", style: "Putty" },
                          { label: "Lines", style: "Line" },
                          { label: "Sticks", style: "Stick" },
                          { label: "Spheres (VDW)", style: "Space-Filling" },
                          { label: "Non-bonded (crosses)", style: "Non-bonded (crosses)" },
                          { label: "Non-bonded (spheres)", style: "Non-bonded (small spheres)" },
                          { label: "Surface (VDW)", style: "Van der Waals Surface" },
                          { label: "Surface (SES)", style: "Solvent-Excluded Surface" },
                          { label: "Dot Surface", style: "Dots" },
                        ].map((item) => (
                          <button
                            key={item.style}
                            onClick={() => {
                              onSetStyle(obj.id, item.style as RenderStyle);
                              setActiveMenu(null);
                            }}
                            className="px-2 py-1 rounded hover:bg-emerald-500/20 text-left text-emerald-200 text-[10px] truncate"
                          >
                            + {item.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* H - Hide Sub-Menu */}
                    {activeMenu.menu === "H" && (
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => { onHideStyle(obj.id, "everything"); setActiveMenu(null); }}
                          className="px-2 py-1 rounded hover:bg-rose-500/20 text-left text-rose-300 font-semibold"
                        >
                          Hide Everything
                        </button>
                        <button
                          onClick={() => { onHideStyle(obj.id, "cartoon"); setActiveMenu(null); }}
                          className="px-2 py-1 rounded hover:bg-white/10 text-left text-white/70"
                        >
                          Hide Cartoon
                        </button>
                        <button
                          onClick={() => { onHideStyle(obj.id, "nonbonded"); setActiveMenu(null); }}
                          className="px-2 py-1 rounded hover:bg-white/10 text-left text-white/70"
                        >
                          Hide Non-bonded / Solvent
                        </button>
                      </div>
                    )}

                    {/* L - Label Sub-Menu */}
                    {activeMenu.menu === "L" && (
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => { onLabelObject(obj.id, "clear"); setActiveMenu(null); }}
                          className="px-2 py-1 rounded hover:bg-white/10 text-left text-white/50"
                        >
                          Clear Labels
                        </button>
                        <button
                          onClick={() => { onLabelObject(obj.id, "resn"); setActiveMenu(null); }}
                          className="px-2 py-1 rounded hover:bg-cyan-500/20 text-left text-cyan-200"
                        >
                          Label Residue Name (e.g. VAL)
                        </button>
                        <button
                          onClick={() => { onLabelObject(obj.id, "resi"); setActiveMenu(null); }}
                          className="px-2 py-1 rounded hover:bg-cyan-500/20 text-left text-cyan-200"
                        >
                          Label Residue Index (e.g. 99)
                        </button>
                        <button
                          onClick={() => { onLabelObject(obj.id, "name"); setActiveMenu(null); }}
                          className="px-2 py-1 rounded hover:bg-cyan-500/20 text-left text-cyan-200"
                        >
                          Label Atom Name (e.g. CA)
                        </button>
                        <button
                          onClick={() => { onLabelObject(obj.id, "bfactor"); setActiveMenu(null); }}
                          className="px-2 py-1 rounded hover:bg-cyan-500/20 text-left text-cyan-200"
                        >
                          Label B-Factor
                        </button>
                      </div>
                    )}

                    {/* C - Color Sub-Menu */}
                    {activeMenu.menu === "C" && (
                      <div className="grid grid-cols-2 gap-0.5">
                        {[
                          { label: "CPK (by element)", scheme: "Classic CPK" },
                          { label: "By Chain", scheme: "By Chain" },
                          { label: "By Secondary Structure", scheme: "By SS" },
                          { label: "Rainbow Spectrum", scheme: "Rainbow" },
                          { label: "By Partial Charge", scheme: "By Partial Charge" },
                          { label: "Hydrophobicity", scheme: "Hydrophobicity" },
                        ].map((item) => (
                          <button
                            key={item.scheme}
                            onClick={() => {
                              onSetColor(obj.id, item.scheme);
                              setActiveMenu(null);
                            }}
                            className="px-2 py-1 rounded hover:bg-purple-500/20 text-left text-purple-200 text-[10px] truncate"
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
