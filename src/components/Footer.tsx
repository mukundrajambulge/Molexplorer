import React from "react";
import { Link } from "react-router-dom";
import { Dna, Github, Cpu, Atom, Sparkles } from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer className="relative w-full border-t border-white/[0.08] bg-[#050508] text-slate-400 text-xs py-12 overflow-hidden">
      {/* Top glowing line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(0,242,255,0.2)]">
              <Dna className="w-4 h-4" />
            </div>
            <span className="text-white font-medium text-sm">Molexplorer</span>
            <span className="text-white/20">|</span>
            <span className="text-slate-400">Web-based Cheminformatics & Structural Biology</span>
          </div>

          <div className="flex items-center gap-6 font-mono text-xs">
            <Link to="/molexplorer" className="hover:text-cyan-400 transition-colors">
              MolExplorer
            </Link>
            <Link to="/molstudio" className="hover:text-amber-400 transition-colors">
              MolStudio 3D
            </Link>
            <a
              href="https://github.com/mukundrajambulge/Molexplorer"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <Github className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </a>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/[0.05] flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500 font-mono text-[11px]">
          <div>
            © {new Date().getFullYear()} Mukundraj Ambulge. Open Source Cheminformatics Tools.
          </div>
          <div className="flex items-center gap-4 text-[10px]">
            <span className="flex items-center gap-1 text-cyan-400/80">
              <Cpu className="w-3 h-3" /> THREE.JS + 3DMOL
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-amber-400/80">
              <Atom className="w-3 h-3" /> RDKIT WASM
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

