import { Link } from "react-router-dom";
import { ArrowRight, Beaker, FlaskConical } from "lucide-react";

export default function Home() {
  return (
    <div className="h-screen w-screen flex flex-col font-sans bg-[#0A0A0A] text-[#F0F0F0] items-center justify-center relative overflow-hidden px-4">
      {/* Background decoration */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-gradient-to-br from-[#1a1a1a] to-transparent rounded-full blur-[100px] opacity-40 pointer-events-none z-0"></div>
      
      <div className="z-10 max-w-4xl w-full">
        <div className="text-center mb-16">
          <div className="w-16 h-16 border-2 border-white/20 rounded-full flex items-center justify-center text-white/80 text-2xl font-serif italic mx-auto mb-6">M</div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-light tracking-tighter mb-4">
            Molecular<span className="font-serif italic text-white/50">Suite</span>
          </h1>
          <p className="text-white/50 text-sm sm:text-base md:text-lg max-w-xl mx-auto font-light">
            Choose your tool. Explore chemical space or design new molecules with our advanced web-based applications.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* MolExplorer Card */}
          <Link 
            to="/molexplorer" 
            className="group relative flex flex-col p-8 rounded-3xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-[#F27D26]/50 transition-all duration-500 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#F27D26]/0 to-[#F27D26]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            
            <div className="mb-6 w-12 h-12 rounded-2xl bg-[#F27D26]/10 text-[#F27D26] flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
              <FlaskConical size={24} strokeWidth={1.5} />
            </div>
            
            <h2 className="text-2xl font-light tracking-tighter mb-3">
              Mol<span className="font-serif italic text-[#F27D26]">Explorer</span>
            </h2>
            
            <p className="text-white/50 text-sm font-light leading-relaxed mb-8 flex-1">
              Visualize, filter, and analyze chemical libraries. A lightweight, browser-based tool for computational drug design workflows.
            </p>
            
            <div className="flex items-center text-[#F27D26] text-xs uppercase tracking-widest font-medium opacity-80 group-hover:opacity-100 transition-opacity">
              <span>Launch App</span>
              <ArrowRight size={14} className="ml-2 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* MolStudio Card */}
          <Link 
            to="/molstudio" 
            className="group relative flex flex-col p-8 rounded-3xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-[#4A90E2]/50 transition-all duration-500 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#4A90E2]/0 to-[#4A90E2]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            
            <div className="mb-6 w-12 h-12 rounded-2xl bg-[#4A90E2]/10 text-[#4A90E2] flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
              <Beaker size={24} strokeWidth={1.5} />
            </div>
            
            <h2 className="text-2xl font-light tracking-tighter mb-3">
              Mol<span className="font-serif italic text-[#4A90E2]">Studio</span>
            </h2>
            
            <p className="text-white/50 text-sm font-light leading-relaxed mb-8 flex-1">
              Advanced molecular modeling, docking visualization, and structural editing environment.
            </p>
            
            <div className="flex items-center text-[#4A90E2] text-xs uppercase tracking-widest font-medium opacity-80 group-hover:opacity-100 transition-opacity">
              <span>Launch App</span>
              <ArrowRight size={14} className="ml-2 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
