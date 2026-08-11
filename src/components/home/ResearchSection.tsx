import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  FlaskConical,
  Beaker,
  ArrowRight,
  Sparkles,
  Github,
  Globe,
  Share2,
  BookOpen,
  Dna,
  Atom,
  CheckCircle2
} from 'lucide-react';

export const ResearchSection: React.FC = () => {
  return (
    <section className="relative z-10 py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pointer-events-auto">
      
      {/* Container with Glassmorphic Luxury Border */}
      <div className="relative rounded-3xl border border-slate-700/60 bg-gradient-to-b from-slate-900/90 via-slate-900/80 to-slate-950/95 p-8 sm:p-14 backdrop-blur-2xl shadow-2xl overflow-hidden text-center space-y-8">
        
        {/* Subtle Ambient Radial Glow */}
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[600px] rounded-full bg-cyan-500/10 blur-[120px]" />

        <div className="relative z-10 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-400/30 bg-slate-900/80 text-xs font-mono text-cyan-300">
          <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
          <span>RESEARCH & OPEN COMMUNITY</span>
        </div>

        <div className="relative z-10 max-w-3xl mx-auto space-y-4">
          <h2 className="text-3xl sm:text-5xl font-light text-white tracking-tight">
            Accelerating Discovery for <br />
            <span className="font-bold bg-gradient-to-r from-cyan-400 via-teal-300 to-amber-400 bg-clip-text text-transparent">
              Structural Biologists & Chemists
            </span>
          </h2>
          <p className="text-slate-300 text-base sm:text-lg font-normal leading-relaxed">
            Open-source architecture combining high-speed client-side WASM computation with interactive WebGL hardware acceleration.
          </p>
        </div>

        {/* Tech Stack Pillars */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto pt-4 text-left font-mono">
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-700/50 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase">Core WASM</span>
            <div className="text-sm font-semibold text-cyan-300">RDKit C++ Kernel</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-700/50 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase">3D Graphics</span>
            <div className="text-sm font-semibold text-teal-300">3Dmol & Three.js</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-700/50 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase">Frontend</span>
            <div className="text-sm font-semibold text-amber-300">React 19 & TypeScript</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-700/50 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase">State Engine</span>
            <div className="text-sm font-semibold text-emerald-300">Zustand Reactive</div>
          </div>
        </div>

        {/* Final Launch Actions */}
        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
          <Link
            to="/molexplorer"
            className="btn-luminous inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 text-sm font-semibold shadow-[0_0_25px_rgba(0,242,255,0.35)] hover:shadow-[0_0_35px_rgba(0,242,255,0.55)] transition-all"
          >
            <FlaskConical className="h-4 w-4" />
            <span>Launch MolExplorer</span>
            <ArrowRight className="h-4 w-4" />
          </Link>

          <Link
            to="/molstudio"
            className="btn-luminous inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl border border-amber-500/40 bg-slate-900/80 text-amber-300 text-sm font-semibold hover:border-amber-400 hover:bg-amber-500/15 shadow-[0_0_20px_rgba(242,125,38,0.2)] transition-all"
          >
            <Beaker className="h-4 w-4" />
            <span>Launch MolStudio 3D</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

      </div>

    </section>
  );
};
