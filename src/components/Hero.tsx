import React from "react";
import { Link } from "react-router-dom";
import { FlaskConical, Beaker, ArrowRight, Sparkles, Database, Activity, Compass, Cpu, Layers } from "lucide-react";

export const Hero: React.FC = () => {
  return (
    <div className="relative overflow-hidden pt-12 pb-24 lg:pt-20 lg:pb-32">
      {/* Glow Effects */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-[#F27D26]/20 via-[#4A90E2]/15 to-transparent rounded-full blur-[140px] pointer-events-none z-0"></div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Tagline Pill */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-md text-xs font-mono text-white/80">
            <Sparkles className="w-3.5 h-3.5 text-[#F27D26] animate-pulse" />
            <span>Next-Gen Web-Based Molecular Intelligence</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#F27D26]"></span>
          </div>
        </div>

        {/* Hero Title */}
        <div className="text-center max-w-4xl mx-auto space-y-6">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-light tracking-tight text-white leading-[1.1]">
            Explore Chemical Space with <br />
            <span className="font-serif italic bg-gradient-to-r from-[#F27D26] via-[#FF9F1C] to-[#4A90E2] bg-clip-text text-transparent font-normal">
              Precision & Speed
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-white/60 font-light max-w-2xl mx-auto leading-relaxed">
            Accelerate drug discovery workflows with real-time 3D molecular visualization, structure filtering, descriptor analysis, and docking simulations.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              to="/molexplorer"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 rounded-2xl bg-gradient-to-r from-[#F27D26] to-[#E85D04] hover:from-[#f48434] hover:to-[#f16712] text-white text-sm font-medium tracking-wide shadow-xl shadow-[#F27D26]/20 hover:shadow-[#F27D26]/40 hover:-translate-y-0.5 transition-all group"
            >
              <FlaskConical className="w-4 h-4 mr-2.5" />
              <span>Launch MolExplorer</span>
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              to="/molstudio"
              className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-white text-sm font-medium tracking-wide transition-all hover:-translate-y-0.5 group"
            >
              <Beaker className="w-4 h-4 mr-2.5 text-[#4A90E2]" />
              <span>Open MolStudio</span>
              <ArrowRight className="w-4 h-4 ml-2 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </Link>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md hover:border-[#F27D26]/40 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-[#F27D26]/10 flex items-center justify-center text-[#F27D26] mb-4 group-hover:scale-110 transition-transform">
              <Database className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Library Search</h3>
            <p className="text-sm text-white/50 leading-relaxed">
              Parse SDF, PDB, and SMILES files directly in the browser with RDKit WebAssembly integration.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md hover:border-[#4A90E2]/40 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-[#4A90E2]/10 flex items-center justify-center text-[#4A90E2] mb-4 group-hover:scale-110 transition-transform">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Interactive 3D Studio</h3>
            <p className="text-sm text-white/50 leading-relaxed">
              High-performance WebGL rendering for macromolecular structures, cartoons, surface meshes, and ligands.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-md hover:border-emerald-500/40 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition-transform">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Real-time Analytics</h3>
            <p className="text-sm text-white/50 leading-relaxed">
              Compute Lipinski parameters, QED scores, SAS cores, and molecular weight distributions instantaneously.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
