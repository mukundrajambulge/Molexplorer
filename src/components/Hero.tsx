import React from "react";
import { Link } from "react-router-dom";
import { FlaskConical, Beaker, ArrowRight, Sparkles, Database, Activity, Compass, Cpu, Layers } from "lucide-react";

export const Hero: React.FC = () => {
  return (
    <div className="relative min-h-screen bg-[#07090E] text-slate-100 overflow-hidden font-sans border-b border-white/5">
      
      {/* Soft Ambient Radial Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-tr from-cyan-500/10 via-indigo-500/10 to-transparent rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Elegant Dot Grid Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.2] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px)`,
          backgroundSize: '24px 24px'
        }}
      />

      {/* Main Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-28 lg:pt-28 lg:pb-36">
        
        {/* Top Tagline Pill */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-xl text-xs font-medium text-slate-300 shadow-2xl">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="tracking-wide">Next-Gen Web-Based Molecular Intelligence</span>
          </div>
        </div>

        {/* Hero Title */}
        <div className="text-center max-w-4xl mx-auto space-y-6">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-light tracking-tight text-white leading-[1.1]">
            Explore Chemical Space with <br />
            <span className="font-semibold bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
              Precision & Speed
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 font-light max-w-2xl mx-auto leading-relaxed">
            Accelerate drug discovery workflows with real-time 3D molecular visualization, structure filtering, descriptor analysis, and docking simulations.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
            <Link
              to="/molexplorer"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 text-sm font-semibold tracking-wide shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 hover:-translate-y-0.5 transition-all group"
            >
              <FlaskConical className="w-4.5 h-4.5 mr-2.5" />
              <span>Launch MolExplorer</span>
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              to="/molstudio"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-white text-sm font-medium tracking-wide transition-all hover:-translate-y-0.5 group backdrop-blur-md"
            >
              <Beaker className="w-4.5 h-4.5 mr-2.5 text-cyan-400" />
              <span>Open MolStudio</span>
              <ArrowRight className="w-4 h-4 ml-2 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </Link>
          </div>
        </div>

        {/* Modern Polished Feature Cards */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1 */}
          <div className="p-7 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl hover:border-cyan-500/40 hover:bg-white/[0.04] transition-all duration-300 group shadow-xl">
            <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-5 group-hover:scale-110 transition-transform">
              <Database className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2 tracking-wide">Library Search</h3>
            <p className="text-sm text-slate-400 leading-relaxed font-light">
              Parse SDF, PDB, and SMILES files directly in the browser with RDKit WebAssembly integration.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-7 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl hover:border-teal-500/40 hover:bg-white/[0.04] transition-all duration-300 group shadow-xl">
            <div className="w-11 h-11 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mb-5 group-hover:scale-110 transition-transform">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2 tracking-wide">Interactive 3D Studio</h3>
            <p className="text-sm text-slate-400 leading-relaxed font-light">
              High-performance WebGL rendering for macromolecular structures, cartoons, surface meshes, and ligands.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-7 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl hover:border-emerald-500/40 hover:bg-white/[0.04] transition-all duration-300 group shadow-xl">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-5 group-hover:scale-110 transition-transform">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2 tracking-wide">Real-time Analytics</h3>
            <p className="text-sm text-slate-400 leading-relaxed font-light">
              Compute Lipinski parameters, QED scores, SAS cores, and molecular weight distributions instantaneously.
            </p>
          </div>

        </div>

        {/* Minimal Footer Telemetry Strip */}
        <div className="mt-16 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-slate-500 gap-4">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5"><Compass className="w-3.5 h-3.5 text-cyan-400" /> POS: 0x48.22A</span>
            <span>•</span>
            <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5 text-emerald-400" /> RDKIT: WASM_ACTIVE</span>
          </div>
          <div>LATENCY: &lt; 2ms</div>
        </div>

      </div>
    </div>
  );
};