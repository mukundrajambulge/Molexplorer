import React, { useState } from "react";
import { 
  FileUp, Download, Eye, Palette, Layers, Box, Cpu, Sparkles, 
  Ruler, AlignLeft, ShieldCheck, RefreshCw, Scissors, Plus, 
  Flame, HelpCircle, ChevronDown, Check, Command, Activity, Zap
} from "lucide-react";
import { RenderStyle } from "../types";

interface StudioRibbonBarProps {
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFetchPdb: (id: string) => void;
  renderStyle: RenderStyle;
  setRenderStyle: (style: RenderStyle) => void;
  colorScheme: string;
  setColorScheme: (scheme: string) => void;
  surfaceOpacity: number;
  setSurfaceOpacity: (opacity: number) => void;
  backgroundColor: string;
  setBackgroundColor: (color: string) => void;
  onRunQuery: (query: string) => void;
  onClearSelection: () => void;
  selectedAtomCount: number;
  totalAtomCount: number;
  isDocking: boolean;
  onStartDocking: () => void;
  onAutoSuggestBox: () => void;
  onAlignFetch: (id: string) => void;
  onSaveSession: () => void;
}

export const StudioRibbonBar: React.FC<StudioRibbonBarProps> = ({
  onFileUpload,
  onFetchPdb,
  renderStyle,
  setRenderStyle,
  colorScheme,
  setColorScheme,
  surfaceOpacity,
  setSurfaceOpacity,
  backgroundColor,
  setBackgroundColor,
  onRunQuery,
  onClearSelection,
  selectedAtomCount,
  totalAtomCount,
  isDocking,
  onStartDocking,
  onAutoSuggestBox,
  onAlignFetch,
  onSaveSession
}) => {
  const [activeTab, setActiveTab] = useState<"file" | "display" | "select" | "prep" | "docking" | "align">("display");
  const [pdbInput, setPdbInput] = useState("");
  const [alignInput, setAlignInput] = useState("");

  const representations: { id: RenderStyle; label: string; icon: any }[] = [
    { id: "cartoon", label: "Cartoon", icon: RibbonIcon },
    { id: "stick", label: "Sticks", icon: StickIcon },
    { id: "sphere", label: "Spheres / VDW", icon: SphereIcon },
    { id: "surface", label: "Solid Surface", icon: SurfaceIcon },
    { id: "mesh", label: "Mesh Surface", icon: MeshIcon }
  ];

  const colorSchemes = [
    { id: "spectrum", label: "Rainbow Spectrum" },
    { id: "element", label: "CPK Element" },
    { id: "chain", label: "By Chain" },
    { id: "ss", label: "Secondary Structure" },
    { id: "b_factor", label: "B-Factor Heatmap" }
  ];

  const presetQueries = [
    { label: "All Atoms", query: "all" },
    { label: "Ligands & HETATM", query: "hetatm and not resn HOH" },
    { label: "Water Molecules", query: "resn HOH" },
    { label: "Alpha Helices", query: "ss h" },
    { label: "Beta Sheets", query: "ss s" },
    { label: "Binding Pocket (<5Å)", query: "around 5 of (hetatm and not resn HOH)" }
  ];

  return (
    <div className="w-full bg-[#0E0E12] border-b border-white/10 select-none flex flex-col shrink-0 text-white">
      {/* Top Menu Bar Tabs (Word / PyMOL Ribbon style) */}
      <div className="flex items-center justify-between px-3 border-b border-white/[0.06] bg-[#070709] h-9 text-xs">
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-2 pr-4 border-r border-white/10 font-bold tracking-tight text-[#4A90E2] text-sm">
            <Activity className="w-4 h-4 text-[#F27D26]" />
            <span>MolStudio</span>
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-white/70">PyMOL Web</span>
          </div>

          <div className="flex items-center gap-0.5 ml-2">
            {[
              { id: "file", label: "File & I/O" },
              { id: "display", label: "Display & Render" },
              { id: "select", label: "Selection & Query" },
              { id: "prep", label: "Protein Prep" },
              { id: "docking", label: "Molecular Docking" },
              { id: "align", label: "Structural Alignment" }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-t-lg text-xs font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-[#0E0E12] text-white border-t-2 border-[#4A90E2] shadow-sm"
                    : "text-white/50 hover:text-white hover:bg-white/[0.03]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Global Quick Action Stats */}
        <div className="flex items-center gap-4 text-[11px] font-mono text-white/50">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Atoms: <strong className="text-white">{totalAtomCount}</strong></span>
          </div>
          {selectedAtomCount > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#F27D26]/20 text-[#F27D26] border border-[#F27D26]/30">
              <span>Selected: <strong>{selectedAtomCount}</strong></span>
              <button onClick={onClearSelection} className="hover:text-white ml-1">×</button>
            </div>
          )}
        </div>
      </div>

      {/* Action Toolbar Ribbon Area (Dynamically changes based on Active Tab) */}
      <div className="h-16 px-4 py-2 flex items-center gap-6 overflow-x-auto custom-scrollbar">
        
        {/* FILE TAB */}
        {activeTab === "file" && (
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] cursor-pointer text-xs transition-all">
              <FileUp className="w-4 h-4 text-[#F27D26]" />
              <span>Open File (.PDB / .SDF)</span>
              <input type="file" onChange={onFileUpload} className="hidden" accept=".pdb,.sdf,.mol,.mmtf" />
            </label>

            <form onSubmit={(e) => { e.preventDefault(); if (pdbInput) onFetchPdb(pdbInput); }} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="RCSB PDB ID (e.g. 1HVR)"
                value={pdbInput}
                onChange={(e) => setPdbInput(e.target.value)}
                className="w-44 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-xs font-mono focus:outline-none focus:border-[#4A90E2]"
              />
              <button type="submit" className="px-3 py-1.5 rounded-lg bg-[#4A90E2] text-white text-xs font-medium hover:bg-[#357abd]">
                Fetch
              </button>
            </form>

            <div className="h-8 w-[1px] bg-white/10"></div>

            <button onClick={onSaveSession} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-xs">
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Save Session (.PSE)</span>
            </button>
          </div>
        )}

        {/* DISPLAY & RENDER TAB */}
        {activeTab === "display" && (
          <div className="flex items-center gap-6">
            {/* Representation Presets */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Representation</span>
              <div className="flex items-center gap-1">
                {representations.map(rep => (
                  <button
                    key={rep.id}
                    onClick={() => setRenderStyle(rep.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                      renderStyle === rep.id
                        ? "bg-[#4A90E2] text-white shadow"
                        : "bg-white/[0.04] text-white/70 hover:text-white hover:bg-white/[0.08]"
                    }`}
                  >
                    <span>{rep.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="h-8 w-[1px] bg-white/10"></div>

            {/* Color Scheme */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Color Scheme</span>
              <select
                value={colorScheme}
                onChange={(e) => setColorScheme(e.target.value)}
                className="bg-white/[0.04] border border-white/10 rounded-md px-2 py-1 text-xs text-white focus:outline-none"
              >
                {colorSchemes.map(cs => (
                  <option key={cs.id} value={cs.id} className="bg-[#0E0E12]">{cs.label}</option>
                ))}
              </select>
            </div>

            <div className="h-8 w-[1px] bg-white/10"></div>

            {/* Background Color */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Canvas BG</span>
              <div className="flex items-center gap-1">
                {["#0A0A0A", "#FFFFFF", "#1E1E24", "#0D1117"].map(c => (
                  <button
                    key={c}
                    onClick={() => setBackgroundColor(c)}
                    className={`w-5 h-5 rounded-full border ${backgroundColor === c ? 'border-[#4A90E2] scale-110' : 'border-white/20'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SELECTION & QUERY TAB */}
        {activeTab === "select" && (
          <div className="flex items-center gap-4 w-full">
            <div className="flex flex-col gap-1 flex-1 max-w-md">
              <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">PyMOL Selection Query</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="e.g. resn ALA and chain A around 5 of (resi 10)"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onRunQuery((e.target as HTMLInputElement).value);
                  }}
                  className="w-full px-3 py-1 rounded-md bg-white/[0.04] border border-white/10 text-xs font-mono text-white focus:outline-none focus:border-[#4A90E2]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Preset Quick Select</span>
              <div className="flex items-center gap-1">
                {presetQueries.slice(0, 3).map(q => (
                  <button
                    key={q.label}
                    onClick={() => onRunQuery(queryToSelector(q.query))}
                    className="px-2 py-1 bg-white/[0.04] hover:bg-white/[0.08] rounded text-xs text-white/80"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* DOCKING TAB */}
        {activeTab === "docking" && (
          <div className="flex items-center gap-4">
            <button
              onClick={onAutoSuggestBox}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs"
            >
              <Box className="w-4 h-4 text-[#F27D26]" />
              <span>Auto-Detect Grid Box</span>
            </button>

            <button
              onClick={onStartDocking}
              disabled={isDocking}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#F27D26] to-[#E85D04] hover:from-[#f48434] hover:to-[#f16712] text-white text-xs font-medium shadow-lg shadow-[#F27D26]/20 disabled:opacity-50"
            >
              <Zap className="w-4 h-4" />
              <span>{isDocking ? "Running Docking..." : "Launch Docking Engine"}</span>
            </button>
          </div>
        )}

        {/* ALIGNMENT TAB */}
        {activeTab === "align" && (
          <div className="flex items-center gap-4">
            <form onSubmit={(e) => { e.preventDefault(); if (alignInput) onAlignFetch(alignInput); }} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Target PDB ID to align"
                value={alignInput}
                onChange={(e) => setAlignInput(e.target.value)}
                className="w-44 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-xs font-mono text-white focus:outline-none"
              />
              <button type="submit" className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium">
                Superimpose (Kabsch RMSD)
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
};

function queryToSelector(query: string): string {
  return query;
}

// Dummy icon components for representations
function RibbonIcon(props: any) { return <span {...props}>🎗️</span>; }
function StickIcon(props: any) { return <span {...props}>🥢</span>; }
function SphereIcon(props: any) { return <span {...props}>⚪</span>; }
function SurfaceIcon(props: any) { return <span {...props}>🗻</span>; }
function MeshIcon(props: any) { return <span {...props}>🌐</span>; }
