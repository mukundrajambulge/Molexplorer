import React from "react";
import { FilterState } from "../types";
import { Search, Settings2, Hash, Zap } from "lucide-react";

interface FilterPanelProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
}

const SMARTS_TEMPLATES = [
  { name: "Alcohol", smarts: "[CX4][OH]" },
  { name: "Primary Amine", smarts: "[NX3H2]" },
  { name: "Carboxylic Acid", smarts: "C(=O)[OH]" },
  { name: "Ester", smarts: "C(=O)O[C]" },
  { name: "Amide", smarts: "C(=O)N" },
  { name: "Aromatic Ring", smarts: "a1aaaaa1" },
  { name: "Halogen", smarts: "[F,Cl,Br,I]" },
  { name: "Nitro", smarts: "[NX3](=O)=O" }
];

export default function FilterPanel({ filters, setFilters }: FilterPanelProps) {
  
  const updateRange = (key: keyof FilterState, min: string, max: string) => {
    const minVal = parseFloat(min);
    const maxVal = parseFloat(max);
    setFilters(prev => ({
      ...prev,
      [key]: [isNaN(minVal) ? 0 : minVal, isNaN(maxVal) ? 1000 : maxVal]
    }));
  };

  return (
    <div className="flex flex-col gap-8 h-full">
      {/* Library Text Search */}
      <div>
        <h2 className="text-[10px] tracking-[0.3em] uppercase opacity-50 mb-3 flex items-center gap-2">
          <Search size={12} /> Text Search
        </h2>
        <input 
          type="text"
          placeholder="Name, Formula, SMILES..."
          className="w-full text-[11px] font-mono bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-[#F0F0F0] placeholder:opacity-30 focus:outline-none focus:border-[#F27D26]/50 transition-colors"
          value={filters.searchQuery}
          onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
        />
      </div>

      {/* Property Filters */}
      <div>
        <h2 className="text-[10px] tracking-[0.3em] uppercase opacity-50 mb-3 flex items-center gap-2">
          <Settings2 size={12} /> Property Ranges
        </h2>
        <div className="flex flex-col gap-4 text-[10px] font-mono">
          <div className="flex flex-col gap-1">
            <label className="opacity-60">Molecular Weight</label>
            <div className="flex items-center gap-2">
              <input type="number" value={filters.massRange[0]} onChange={(e) => updateRange('massRange', e.target.value, filters.massRange[1].toString())} className="w-1/2 bg-white/[0.03] border border-white/10 rounded px-2 py-1" />
              <span>-</span>
              <input type="number" value={filters.massRange[1]} onChange={(e) => updateRange('massRange', filters.massRange[0].toString(), e.target.value)} className="w-1/2 bg-white/[0.03] border border-white/10 rounded px-2 py-1" />
            </div>
          </div>
          
          <div className="flex flex-col gap-1">
            <label className="opacity-60">cLogP</label>
            <div className="flex items-center gap-2">
              <input type="number" value={filters.logpRange[0]} onChange={(e) => updateRange('logpRange', e.target.value, filters.logpRange[1].toString())} className="w-1/2 bg-white/[0.03] border border-white/10 rounded px-2 py-1" />
              <span>-</span>
              <input type="number" value={filters.logpRange[1]} onChange={(e) => updateRange('logpRange', filters.logpRange[0].toString(), e.target.value)} className="w-1/2 bg-white/[0.03] border border-white/10 rounded px-2 py-1" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="opacity-60">Lipinski Ro5 Violations</label>
            <select 
              value={filters.maxRo5Violations === null ? "any" : filters.maxRo5Violations} 
              onChange={(e) => setFilters(prev => ({ ...prev, maxRo5Violations: e.target.value === "any" ? null : parseInt(e.target.value) }))}
              className="w-full bg-white/[0.03] border border-white/10 rounded px-2 py-1 text-white"
            >
              <option value="any">Any (0-4)</option>
              <option value="0">0 (Strict)</option>
              <option value="1">≤ 1 (Relaxed)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Substructure Filters */}
      <div>
        <h2 className="text-[10px] tracking-[0.3em] uppercase opacity-50 mb-3 flex items-center gap-2">
          <Hash size={12} /> Substructure (SMARTS)
        </h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {SMARTS_TEMPLATES.map(t => (
            <button
              key={t.name}
              onClick={() => setFilters(prev => ({ 
                ...prev, 
                visualSmarts: prev.visualSmarts === t.smarts ? "" : t.smarts 
              }))}
              className={`text-[9px] px-2 py-1 rounded border transition-colors ${
                filters.visualSmarts === t.smarts 
                  ? 'bg-[#F27D26]/20 border-[#F27D26] text-[#F27D26]' 
                  : 'bg-white/[0.03] border-white/10 hover:border-white/30 text-white'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[9px] opacity-60 font-mono">Advanced Custom SMARTS</label>
          <input 
            type="text"
            placeholder="e.g. c1ccccc1"
            className="w-full text-[11px] font-mono bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-[#F0F0F0] placeholder:opacity-30 focus:outline-none focus:border-[#F27D26]/50 transition-colors"
            value={filters.visualSmarts}
            onChange={(e) => setFilters(prev => ({ ...prev, visualSmarts: e.target.value }))}
          />
        </div>
      </div>

      {/* Visual Modifiers */}
      <div>
        <h2 className="text-[10px] tracking-[0.3em] uppercase opacity-50 mb-3 flex items-center gap-2">
          <Zap size={12} /> Visual Filters
        </h2>
        <div className="flex flex-col gap-3 text-[10px] font-mono">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${filters.showStereoCenters ? 'bg-[#F27D26] border-[#F27D26]' : 'border-white/20 group-hover:border-white/40'}`}>
              {filters.showStereoCenters && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
            </div>
            <span className="group-hover:text-white transition-colors">Highlight Stereocenters (R/S)</span>
          </label>
          
          <div className="flex flex-col gap-1 mt-2">
            <label className="opacity-60">Hide Elements (comma-separated)</label>
            <input 
              type="text"
              placeholder="e.g. C, N, P"
              className="w-full text-[11px] font-mono bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-[#F0F0F0] placeholder:opacity-30 focus:outline-none focus:border-[#F27D26]/50 transition-colors"
              value={filters.hiddenElements.join(', ')}
              onChange={(e) => setFilters(prev => ({ 
                ...prev, 
                hiddenElements: e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(s => s) 
              }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
