import { ViewState, RenderStyle, ColorTheme } from "../types";
import { Settings2 } from "lucide-react";

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

  return (
    <div className="min-h-[3.5rem] border-b border-white/10 bg-transparent flex items-center px-4 sm:px-8 py-2 gap-3 sm:gap-6 text-[10px] font-mono tracking-[0.1em] uppercase z-10 flex-wrap overflow-x-auto whitespace-nowrap">
      
      <div className="flex items-center gap-3">
        <span className="opacity-40">Style</span>
        <select 
          className="bg-transparent border border-white/10 rounded-md px-2 py-1 outline-none focus:border-[#F27D26]/50 text-[#F0F0F0] appearance-none cursor-pointer hover:bg-white/[0.03] transition-colors"
          value={viewState.renderStyle}
          onChange={(e) => handleChange("renderStyle", e.target.value)}
        >
          {RENDER_STYLES.map(s => <option key={s} value={s} className="bg-[#1a1a1a] text-white">{s}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <span className="opacity-40">Color</span>
        <select 
          className="bg-transparent border border-white/10 rounded-md px-2 py-1 outline-none focus:border-[#F27D26]/50 text-[#F0F0F0] appearance-none cursor-pointer hover:bg-white/[0.03] transition-colors"
          value={viewState.colorTheme}
          onChange={(e) => {
             const newTheme = e.target.value as ColorTheme;
             
             let newBg = viewState.canvasBackground;
             if (newTheme === "Classic CPK") {
                newBg = "#f5f5f5";
             } else if (newTheme === "Modern/Jmol") {
                newBg = "black";
             }
             
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

      <div className="h-4 w-px bg-white/10" />

      <label className="flex items-center gap-2 cursor-pointer hover:text-[#F27D26] transition-colors">
        <input 
          type="checkbox" 
          checked={viewState.showHydrogens}
          onChange={(e) => handleChange("showHydrogens", e.target.checked)}
          className="accent-[#F27D26]"
        />
        Hydrogens
      </label>

      <label className="flex items-center gap-2 cursor-pointer hover:text-[#F27D26] transition-colors">
        <input 
          type="checkbox" 
          checked={viewState.showLabels}
          onChange={(e) => handleChange("showLabels", e.target.checked)}
          className="accent-[#F27D26]"
        />
        Labels
      </label>

      <label className="flex items-center gap-2 cursor-pointer hover:text-[#F27D26] transition-colors">
        <input 
          type="checkbox" 
          checked={viewState.performanceMode}
          onChange={(e) => handleChange("performanceMode", e.target.checked)}
          className="accent-[#F27D26]"
        />
        Performance Mode
      </label>

      {viewState.renderStyle.includes("Surface") && (
        <>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-3">
            <span className="opacity-40">Opacity</span>
            <input 
              type="range" 
              min="0" max="1" step="0.1" 
              value={viewState.surfaceOpacity}
              onChange={(e) => handleChange("surfaceOpacity", parseFloat(e.target.value))}
              className="w-24 accent-[#F27D26]"
            />
          </div>
        </>
      )}

      <div className="h-4 w-px bg-white/10" />
      
      <div className="flex items-center gap-3">
        <span className="opacity-40">Canvas</span>
        <select 
          className="bg-transparent border border-white/10 rounded-md px-2 py-1 outline-none focus:border-[#F27D26]/50 text-[#F0F0F0] appearance-none cursor-pointer hover:bg-white/[0.03] transition-colors"
          value={viewState.canvasBackground}
          onChange={(e) => handleChange("canvasBackground", e.target.value)}
        >
          <option value="black" className="bg-[#1a1a1a] text-white">Black</option>
          <option value="white" className="bg-[#1a1a1a] text-white">White</option>
          <option value="#f5f5f5" className="bg-[#1a1a1a] text-white">Light</option>
        </select>
      </div>
      
      <div className="h-4 w-px bg-white/10" />
      
      <div className="flex items-center gap-3">
        <span className="opacity-40 text-[#F27D26]">e⁻ Cloud</span>
        <select 
          className="bg-transparent border border-[#F27D26]/30 rounded-md px-2 py-1 outline-none focus:border-[#F27D26] text-[#F0F0F0] appearance-none cursor-pointer hover:bg-white/[0.03] transition-colors"
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
