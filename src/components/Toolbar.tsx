import React from "react";
import { ViewState, RenderStyle, ColorTheme } from "../types";
import { RotateCw, Settings2 } from "lucide-react";

interface ToolbarProps {
  viewState: ViewState;
  onViewStateChange: (state: ViewState) => void;
}

const RENDER_STYLES: RenderStyle[] = [
  "Line", "Stick", "Ball-and-Stick", "Space-Filling", 
  "Van der Waals Surface", "Solvent-Accessible Surface", 
  "Solvent-Excluded Surface", "Mesh", "Dots", "Non-bonded (small spheres)"
];

const COLOR_THEMES: ColorTheme[] = [
  "Modern/Jmol", "Classic CPK", "By Molecule", "By Formal Charge", 
  "By Partial Charge", "ESP", "Hydrophobicity", "Rainbow", 
  "Monochrome", "SMARTS", "Colourblind-safe"
];

export default function Toolbar({ viewState, onViewStateChange }: ToolbarProps) {
  
  const handleChange = (key: keyof ViewState, value: any) => {
    onViewStateChange({ ...viewState, [key]: value });
  };

  const toggleSpin = () => {
    onViewStateChange({ ...viewState, isSpinning: !viewState.isSpinning });
  };

  return (
    <div className="min-h-[3.5rem] border-b border-white/10 bg-[#0A0A0A]/90 backdrop-blur-md flex items-center px-3 sm:px-6 py-2 gap-2 sm:gap-5 text-[10px] font-mono tracking-[0.08em] uppercase z-10 flex-wrap overflow-x-auto custom-scrollbar whitespace-nowrap">
      
      {/* 3D Spin Toggle Button */}
      <button
        onClick={toggleSpin}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer font-sans font-semibold text-xs ${
          viewState.isSpinning 
            ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300 shadow-sm shadow-cyan-500/20' 
            : 'border-white/10 bg-white/[0.03] text-white/70 hover:text-white hover:bg-white/[0.08]'
        }`}
        title="Toggle Auto-Spin 3D Rotation"
      >
        <RotateCw className={`w-3.5 h-3.5 ${viewState.isSpinning ? 'animate-spin text-cyan-400' : ''}`} />
        <span>{viewState.isSpinning ? 'Spin ON' : 'Spin'}</span>
      </button>

      <div className="h-4 w-px bg-white/10 hidden sm:block" />

      {/* Style Selector */}
      <div className="flex items-center gap-2">
        <span className="opacity-40 text-white">Style</span>
        <select 
          className="bg-white/[0.04] border border-white/10 rounded-md px-2 py-1 outline-none focus:border-[#F27D26]/60 text-[#F0F0F0] appearance-none cursor-pointer hover:bg-white/[0.08] transition-colors"
          value={viewState.renderStyle}
          onChange={(e) => handleChange("renderStyle", e.target.value)}
        >
          {RENDER_STYLES.map(s => <option key={s} value={s} className="bg-[#1a1a1a] text-white">{s}</option>)}
        </select>
      </div>

      {/* Color Theme Selector */}
      <div className="flex items-center gap-2">
        <span className="opacity-40 text-white">Color</span>
        <select 
          className="bg-white/[0.04] border border-white/10 rounded-md px-2 py-1 outline-none focus:border-[#F27D26]/60 text-[#F0F0F0] appearance-none cursor-pointer hover:bg-white/[0.08] transition-colors"
          value={viewState.colorTheme}
          onChange={(e) => {
             const newTheme = e.target.value as ColorTheme;
             let newBg = viewState.canvasBackground;
             if (newTheme === "Classic CPK") newBg = "#f5f5f5";
             else if (newTheme === "Modern/Jmol") newBg = "black";
             
             onViewStateChange({ 
               ...viewState, 
               colorTheme: newTheme,
               canvasBackground: newBg
             });
          }}
        >
          {COLOR_THEMES.map(c => <option key={c} value={c} className="bg-[#1a1a1a] text-white">{c}</option>)}
        </select>
      </div>

      {/* Opacity Slider */}
      <div className="flex items-center gap-2 bg-white/[0.02] border border-white/5 px-2 py-1 rounded-md">
        <div className="flex items-center gap-1.5">
          <span className="opacity-40 text-white">Opacity</span>
          <span className="text-[#F27D26] font-mono text-[9px]">
            {Math.round((viewState.surfaceOpacity ?? 0.8) * 100)}%
          </span>
        </div>
        <input 
          type="range" 
          min="0.1" max="1.0" step="0.05" 
          value={viewState.surfaceOpacity ?? 0.8}
          onChange={(e) => handleChange("surfaceOpacity", parseFloat(e.target.value))}
          className="w-20 accent-[#F27D26] cursor-pointer"
          title="Adjust molecular and surface opacity"
        />
      </div>

      <div className="h-4 w-px bg-white/10" />

      {/* Hydrogens Checkbox */}
      <label className="flex items-center gap-1.5 cursor-pointer hover:text-[#F27D26] transition-colors">
        <input 
          type="checkbox" 
          checked={viewState.showHydrogens}
          onChange={(e) => handleChange("showHydrogens", e.target.checked)}
          className="accent-[#F27D26] cursor-pointer"
        />
        <span>Hydrogens</span>
      </label>

      {/* Labels Checkbox */}
      <label className="flex items-center gap-1.5 cursor-pointer hover:text-[#F27D26] transition-colors">
        <input 
          type="checkbox" 
          checked={viewState.showLabels}
          onChange={(e) => handleChange("showLabels", e.target.checked)}
          className="accent-[#F27D26] cursor-pointer"
        />
        <span>Labels</span>
      </label>

      {/* Performance Mode Checkbox */}
      <label className="flex items-center gap-1.5 cursor-pointer hover:text-[#F27D26] transition-colors hidden sm:flex">
        <input 
          type="checkbox" 
          checked={viewState.performanceMode}
          onChange={(e) => handleChange("performanceMode", e.target.checked)}
          className="accent-[#F27D26] cursor-pointer"
        />
        <span>Performance</span>
      </label>

      <div className="h-4 w-px bg-white/10" />
      
      {/* Canvas Background */}
      <div className="flex items-center gap-2">
        <span className="opacity-40 text-white">Canvas</span>
        <select 
          className="bg-white/[0.04] border border-white/10 rounded-md px-2 py-1 outline-none focus:border-[#F27D26]/60 text-[#F0F0F0] appearance-none cursor-pointer hover:bg-white/[0.08] transition-colors"
          value={viewState.canvasBackground}
          onChange={(e) => handleChange("canvasBackground", e.target.value)}
        >
          <option value="black" className="bg-[#1a1a1a] text-white">Black</option>
          <option value="white" className="bg-[#1a1a1a] text-white">White</option>
          <option value="#f5f5f5" className="bg-[#1a1a1a] text-white">Light Gray</option>
        </select>
      </div>
      
      <div className="h-4 w-px bg-white/10" />
      
      {/* Electron Cloud Mode */}
      <div className="flex items-center gap-2">
        <span className="opacity-40 text-[#F27D26]">e⁻ Cloud</span>
        <select 
          className="bg-transparent border border-[#F27D26]/30 rounded-md px-2 py-1 outline-none focus:border-[#F27D26] text-[#F0F0F0] appearance-none cursor-pointer hover:bg-white/[0.04] transition-colors"
          value={viewState.electronCloudMode}
          onChange={(e) => handleChange("electronCloudMode", e.target.value)}
        >
          <option value="None" className="bg-[#1a1a1a] text-white">Off</option>
          <option value="Illustrative Approximation" className="bg-[#1a1a1a] text-white">Illustrative (VDW)</option>
          <option value="Computed Density (Demo)" className="bg-[#1a1a1a] text-white">Computed (Demo)</option>
        </select>
      </div>
      
    </div>
  );
}
