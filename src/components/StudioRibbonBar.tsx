import React, { useState } from "react";
import { 
  FileUp, Download, Eye, Palette, Layers, Box, Cpu, Sparkles, 
  Ruler, AlignLeft, ShieldCheck, RefreshCw, Scissors, Plus, 
  Flame, HelpCircle, ChevronDown, Check, Command, Activity, Zap, SlidersHorizontal, Droplet, CheckSquare
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
  onAlignFetch: (id: string) => void;
  onSaveSession: () => void;
  onToggleHelp: () => void;
  
  // Protein Prep Props
  cleaningState: {
    bond_tolerance: number;
    altloc_filtered: boolean;
    solvent_stripped: boolean;
    hydrogens_added: boolean;
    ss_mode: 'pdb' | 'quick' | 'dssp';
  };
  setCleaningState: React.Dispatch<React.SetStateAction<{
    bond_tolerance: number;
    altloc_filtered: boolean;
    solvent_stripped: boolean;
    hydrogens_added: boolean;
    ss_mode: 'pdb' | 'quick' | 'dssp';
  }>>;
  onResetCleaning: () => void;

  // Biophysical Validation Props
  showDipoleArrow: boolean;
  setShowDipoleArrow: (val: boolean) => void;
  dipoleMoment: {
    charge: number;
    magnitude: number;
    vector: { x: number; y: number; z: number };
    com: { x: number; y: number; z: number };
  } | null;
  isValidationOpen: boolean;
  setIsValidationOpen: (val: boolean) => void;

  // Measurement Wizard Props
  activeMeasurementMode: "distance" | "angle" | "dihedral" | "label" | null;
  setMeasurementMode: (mode: "distance" | "angle" | "dihedral" | "label" | null) => void;
  clearMeasurements: () => void;
  measurements: any[];
  onOpenWizard?: (wizard: string) => void;
}

export const StudioRibbonBar: React.FC<StudioRibbonBarProps & { onOpenWizard?: (wizard: string) => void }> = ({
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
  onAlignFetch,
  onSaveSession,
  onToggleHelp,
  cleaningState,
  setCleaningState,
  onResetCleaning,
  showDipoleArrow,
  setShowDipoleArrow,
  dipoleMoment,
  isValidationOpen,
  setIsValidationOpen,
  activeMeasurementMode,
  setMeasurementMode,
  clearMeasurements,
  measurements,
  onOpenWizard
}) => {
  const [activeTab, setActiveTab] = useState<"file" | "display" | "select" | "prep" | "align" | "analysis" | "wizards" | "movie">("display");
  const [pdbInput, setPdbInput] = useState("");
  const [alignInput, setAlignInput] = useState("");

  const representations: { id: RenderStyle; label: string }[] = [
    { id: "Line", label: "Line" },
    { id: "Stick", label: "Stick" },
    { id: "Ball-and-Stick", label: "Ball-and-Stick" },
    { id: "Space-Filling", label: "Space-Filling" },
    { id: "Van der Waals Surface", label: "Van der Waals Surface" },
    { id: "Solvent-Accessible Surface", label: "Solvent-Accessible Surface" },
    { id: "Solvent-Excluded Surface", label: "Solvent-Excluded Surface" },
    { id: "Mesh", label: "Mesh" },
    { id: "Dots", label: "Dots" },
    { id: "Dot Surface", label: "Dot Surface" },
    { id: "Cartoon", label: "Cartoon" },
    { id: "Putty", label: "Putty" },
    { id: "Non-bonded (crosses)", label: "Non-bonded (crosses)" },
    { id: "Non-bonded (small spheres)", label: "Non-bonded (spheres)" }
  ];

  const colorSchemes = [
    { id: "Classic CPK", label: "Classic CPK" },
    { id: "Modern/Jmol", label: "Modern/Jmol" },
    { id: "By Molecule", label: "By Molecule" },
    { id: "By Formal Charge", label: "By Formal Charge" },
    { id: "By Partial Charge", label: "By Partial Charge" },
    { id: "ESP", label: "ESP" },
    { id: "Hydrophobicity", label: "Hydrophobicity" },
    { id: "Rainbow", label: "Rainbow" },
    { id: "Monochrome", label: "Monochrome" },
    { id: "Colourblind-safe", label: "Colourblind-safe" },
    { id: "ssPyMol", label: "Secondary Structure (PyMOL)" },
    { id: "ssJmol", label: "Secondary Structure (Jmol)" },
    { id: "chain", label: "By Chain" },
    { id: "element", label: "By Element (CPK)" },
    { id: "white", label: "White" }
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
    <div className="w-full bg-[#0E0E12] border-b border-white/10 select-none flex flex-col shrink-0 text-white z-30">
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
              { id: "align", label: "Structural Alignment" },
              { id: "analysis", label: "Structure Analysis" },
              { id: "wizards", label: "Wizards & Maps" },
              { id: "movie", label: "Movie & Animation" }
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
        <div className="flex items-center gap-4 text-[11px] font-mono text-white/50 shrink-0 pr-2">
          <button 
            onClick={onToggleHelp}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#F27D26]/10 hover:bg-[#F27D26]/20 text-[#F27D26] border border-[#F27D26]/20 transition-all font-sans cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Science & FAQ</span>
          </button>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Atoms: <strong className="text-white">{totalAtomCount}</strong></span>
          </div>
          {selectedAtomCount > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#F27D26]/20 text-[#F27D26] border border-[#F27D26]/30 whitespace-nowrap">
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
              <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Representation Style</span>
              <select
                value={renderStyle}
                onChange={(e) => setRenderStyle(e.target.value as RenderStyle)}
                className="bg-white/[0.04] border border-white/10 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#4A90E2]"
              >
                {representations.map(rep => (
                  <option key={rep.id} value={rep.id} className="bg-[#0E0E12]">{rep.label}</option>
                ))}
              </select>
            </div>

            <div className="h-8 w-[1px] bg-white/10"></div>

            {/* Color Scheme */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Color Scheme</span>
              <select
                value={colorScheme}
                onChange={(e) => setColorScheme(e.target.value)}
                className="bg-white/[0.04] border border-white/10 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#4A90E2]"
              >
                {colorSchemes.map(cs => (
                  <option key={cs.id} value={cs.id} className="bg-[#0E0E12]">{cs.label}</option>
                ))}
              </select>
            </div>

            <div className="h-8 w-[1px] bg-white/10"></div>

            {/* Surface Opacity */}
            <div className="flex flex-col gap-1 w-32">
              <div className="flex justify-between text-[10px] font-mono text-white/40 uppercase tracking-wider">
                <span>Opacity</span>
                <span>{(surfaceOpacity * 100).toFixed(0)}%</span>
              </div>
              <input 
                type="range" min="0.1" max="1.0" step="0.05"
                value={surfaceOpacity}
                onChange={(e) => setSurfaceOpacity(parseFloat(e.target.value))}
                className="w-full accent-[#4A90E2]"
              />
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
                {presetQueries.slice(0, 4).map(q => (
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

        {/* PROTEIN PREP TAB */}
        {activeTab === "prep" && (
          <div className="flex items-center gap-6">
            {/* Toggles */}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cleaningState.solvent_stripped}
                  onChange={(e) => setCleaningState(s => ({ ...s, solvent_stripped: e.target.checked }))}
                  className="accent-[#4A90E2]"
                />
                <span>Strip Solvent (H2O)</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cleaningState.hydrogens_added}
                  onChange={(e) => setCleaningState(s => ({ ...s, hydrogens_added: e.target.checked }))}
                  className="accent-[#4A90E2]"
                />
                <span>Add Hydrogens</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cleaningState.altloc_filtered}
                  onChange={(e) => setCleaningState(s => ({ ...s, altloc_filtered: e.target.checked }))}
                  className="accent-[#4A90E2]"
                />
                <span>Filter AltLocs</span>
              </label>
            </div>

            <div className="h-8 w-[1px] bg-white/10"></div>

            {/* Secondary Structure Mode */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">SS Mode</span>
              <select
                value={cleaningState.ss_mode}
                onChange={(e) => setCleaningState(s => ({ ...s, ss_mode: e.target.value as any }))}
                className="bg-white/[0.04] border border-white/10 rounded-md px-2 py-1 text-xs text-white focus:outline-none"
              >
                <option value="pdb" className="bg-[#0E0E12]">PDB Original</option>
                <option value="quick" className="bg-[#0E0E12]">Quick Geometric</option>
                <option value="dssp" className="bg-[#0E0E12]">Full DSSP Engine</option>
              </select>
            </div>

            <div className="h-8 w-[1px] bg-white/10"></div>

            {/* Bond Tolerance */}
            <div className="flex flex-col gap-1 w-28">
              <div className="flex justify-between text-[10px] font-mono text-white/40 uppercase tracking-wider">
                <span>Bond Tol</span>
                <span>{cleaningState.bond_tolerance.toFixed(2)}</span>
              </div>
              <input
                type="range" min="0.8" max="1.5" step="0.05"
                value={cleaningState.bond_tolerance}
                onChange={(e) => setCleaningState(s => ({ ...s, bond_tolerance: parseFloat(e.target.value) }))}
                className="w-full accent-[#4A90E2]"
              />
            </div>

            <div className="h-8 w-[1px] bg-white/10"></div>

            <button
              onClick={onResetCleaning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset</span>
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

        {/* STRUCTURE ANALYSIS TAB */}
        {activeTab === "analysis" && (
          <div className="flex items-center gap-6">
            {/* Measurement Wizard Block */}
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-mono text-white/40 uppercase tracking-wider">Measure Mode</span>
                <div className="flex items-center gap-1">
                  {(['distance', 'angle', 'dihedral', 'label'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setMeasurementMode(activeMeasurementMode === mode ? null : mode)}
                      className={`px-2 py-1 rounded text-[11px] font-medium transition-all capitalize cursor-pointer ${
                        activeMeasurementMode === mode
                          ? "bg-[#4A90E2] text-white font-semibold"
                          : "bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white"
                      }`}
                    >
                      {mode === 'dihedral' ? 'Dihed' : mode}
                    </button>
                  ))}
                </div>
              </div>

              {measurements.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-mono text-white/40 uppercase tracking-wider">Actions</span>
                  <button
                    onClick={clearMeasurements}
                    className="px-2 py-1 text-[10px] font-mono bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded transition-all border border-rose-500/20 cursor-pointer"
                  >
                    Clear ({measurements.length})
                  </button>
                </div>
              )}
            </div>

            <div className="h-8 w-[1px] bg-white/10"></div>

            {/* Biophysical Validation Block */}
            <div className="flex items-center gap-5">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-mono text-white/40 uppercase tracking-wider">Biophysical Options</span>
                <div className="flex items-center gap-4 h-6">
                  <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showDipoleArrow}
                      onChange={(e) => setShowDipoleArrow(e.target.checked)}
                      className="accent-[#4A90E2] cursor-pointer"
                    />
                    <span>Show Dipole Arrow</span>
                  </label>

                  {dipoleMoment !== null && (
                    <div className="flex items-center gap-1.5 text-xs text-white/60 font-mono">
                      <span>Dipole:</span>
                      <strong className="text-white bg-white/10 px-1.5 py-0.5 rounded font-mono">
                        {dipoleMoment.magnitude.toFixed(1)} D
                      </strong>
                    </div>
                  )}
                </div>
              </div>

              <div className="h-8 w-[1px] bg-white/10"></div>

              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-mono text-white/40 uppercase tracking-wider">Validation Details</span>
                <button
                  onClick={() => setIsValidationOpen(!isValidationOpen)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-[11px] h-6 cursor-pointer"
                >
                  <SlidersHorizontal className="w-3 h-3 text-[#4A90E2]" />
                  <span>{isValidationOpen ? "Close Panel" : "Open Panel"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* WIZARDS & MAPS TAB */}
        {activeTab === "wizards" && (
          <div className="flex items-center gap-4">
            <button
              onClick={() => onOpenWizard && onOpenWizard('mutagenesis')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs transition-all cursor-pointer font-medium"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Mutagenesis Wizard</span>
            </button>

            <button
              onClick={() => onOpenWizard && onOpenWizard('mapUpload')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 text-xs transition-all cursor-pointer font-medium"
            >
              <Box className="w-4 h-4 text-blue-400" />
              <span>CCP4 Map Isosurfacing</span>
            </button>

            <button
              onClick={() => onOpenWizard && onOpenWizard('pairfit')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs transition-all cursor-pointer font-medium"
            >
              <Scissors className="w-4 h-4 text-cyan-400" />
              <span>Atom-Pair Superposition</span>
            </button>

            <button
              onClick={() => onOpenWizard && onOpenWizard('fragment')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs transition-all cursor-pointer font-medium"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Fragment Builder</span>
            </button>
          </div>
        )}

        {/* MOVIE & ANIMATION TAB */}
        {activeTab === "movie" && (
          <div className="flex items-center gap-6">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-mono text-white/40 uppercase tracking-wider">Animation Timeline</span>
              <div className="flex items-center gap-2">
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#4A90E2]/20 hover:bg-[#4A90E2]/40 text-[#4A90E2] text-[11px] font-semibold cursor-pointer border border-[#4A90E2]/30 transition-all"
                  onClick={() => document.dispatchEvent(new CustomEvent("toggle-timeline"))}
                >
                  Toggle Timeline UI
                </button>
              </div>
            </div>

            <div className="h-8 w-[1px] bg-white/10"></div>

            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-mono text-white/40 uppercase tracking-wider">Export</span>
              <div className="flex items-center gap-2">
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-[11px] font-semibold cursor-pointer border border-amber-500/20 transition-all"
                  onClick={() => document.dispatchEvent(new CustomEvent("export-mp4"))}
                >
                  Export MP4 (FFmpeg)
                </button>
              </div>
            </div>

            <div className="h-8 w-[1px] bg-white/10"></div>

            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-mono text-white/40 uppercase tracking-wider">Experimental</span>
              <div className="flex items-center gap-2">
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px] font-semibold cursor-pointer border border-emerald-500/20 transition-all"
                  onClick={() => document.dispatchEvent(new CustomEvent("toggle-raytrace"))}
                >
                  <Zap className="w-3.5 h-3.5" />
                  WebGPU Raytrace
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

function queryToSelector(query: string): string {
  return query;
}
