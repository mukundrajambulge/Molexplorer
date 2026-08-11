import React from "react";
import { Link } from "react-router-dom";
import { Dna, Github } from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-white/[0.08] bg-[#070709] text-white/50 text-xs py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-white">
              <Dna className="w-4 h-4 text-[#F27D26]" />
            </div>
            <span className="text-white font-medium text-sm">Molexplorer</span>
            <span className="text-white/30">|</span>
            <span>Web-based Cheminformatics & Structural Biology</span>
          </div>

          <div className="flex items-center gap-6">
            <Link to="/molexplorer" className="hover:text-white transition-colors">
              MolExplorer
            </Link>
            <Link to="/molstudio" className="hover:text-white transition-colors">
              MolStudio
            </Link>
            <a
              href="https://github.com/mukundrajambulge/Molexplorer"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:text-white transition-colors"
            >
              <Github className="w-3.5 h-3.5" />
              <span>GitHub</span>
            </a>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/[0.05] text-center text-white/30 font-mono text-[11px]">
          © {new Date().getFullYear()} Mukundraj Ambulge. Open Source Cheminformatics Tools.
        </div>
      </div>
    </footer>
  );
};
