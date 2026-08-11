import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  FlaskConical,
  Beaker,
  ArrowRight,
  Sparkles,
  Dna,
  Atom,
  Zap,
  Play,
  ChevronDown
} from 'lucide-react';

interface HeroContentProps {
  onScrollToExplore?: () => void;
}

export const HeroContent: React.FC<HeroContentProps> = ({ onScrollToExplore }) => {
  return (
    <section className="relative min-h-[92vh] flex flex-col justify-between pt-16 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto z-10 pointer-events-auto">
      
      {/* Top Tagline Badge */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center"
      >
        <div className="inline-flex items-center gap-2.5 rounded-full border border-cyan-400/30 bg-slate-900/80 px-4 py-1.5 backdrop-blur-xl shadow-lg">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400"></span>
          </span>
          <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
          <span className="font-mono text-xs font-semibold tracking-wider text-cyan-300">
            NEXT-GEN COMPUTATIONAL SUITE
          </span>
        </div>
      </motion.div>

      {/* Center Main Typography */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
        className="max-w-3xl space-y-6 my-auto"
      >
        <h1 className="text-5xl sm:text-7xl lg:text-8xl font-light tracking-tighter text-white leading-[1.02]">
          Explore. <br />
          <span className="font-bold bg-gradient-to-r from-cyan-400 via-teal-300 to-amber-400 bg-clip-text text-transparent">
            Dock.
          </span> <br />
          Discover.
        </h1>

        <p className="text-lg sm:text-xl font-normal text-slate-300 max-w-2xl leading-relaxed">
          Mol Explorer is an all-in-one platform for molecular visualization, docking, and analysis.
        </p>

        {/* Action Button Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-4">
          <Link
            to="/molexplorer"
            className="btn-luminous group inline-flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 px-8 py-4 text-sm font-semibold text-slate-950 shadow-[0_0_30px_rgba(0,242,255,0.35)] transition-all hover:shadow-[0_0_40px_rgba(0,242,255,0.55)] hover:-translate-y-0.5"
          >
            <FlaskConical className="h-5 w-5 text-slate-950" />
            <span>Explore Molecules</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1.5" />
          </Link>

          <Link
            to="/molstudio"
            className="btn-luminous group inline-flex items-center justify-center gap-3 rounded-xl border border-amber-500/40 bg-slate-900/80 px-8 py-4 text-sm font-semibold text-amber-300 backdrop-blur-xl shadow-[0_0_20px_rgba(242,125,38,0.2)] transition-all hover:border-amber-400 hover:bg-amber-500/15 hover:shadow-[0_0_30px_rgba(242,125,38,0.4)] hover:-translate-y-0.5"
          >
            <Beaker className="h-5 w-5 text-amber-400" />
            <span>Watch Demo</span>
            <Play className="h-4 w-4 opacity-80 transition-all group-hover:opacity-100 group-hover:translate-x-1" />
          </Link>
        </div>
      </motion.div>

      {/* Bottom Telemetry & Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.3 }}
        className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-700/40"
      >
        <div className="flex flex-wrap items-center gap-6 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <Dna className="h-4 w-4 text-cyan-400" />
            <span className="text-slate-300">RDKit In-Memory WASM</span>
          </div>
          <div className="flex items-center gap-2">
            <Atom className="h-4 w-4 text-amber-400" />
            <span className="text-slate-300">WebGL 3D Engine</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-emerald-400" />
            <span className="text-slate-300">Interactive Picking</span>
          </div>
        </div>

        <button
          onClick={onScrollToExplore}
          className="flex items-center gap-2 text-xs font-mono text-cyan-400 hover:text-cyan-300 transition-colors animate-bounce"
        >
          <span>SCROLL TO DOCK</span>
          <ChevronDown className="h-4 w-4" />
        </button>
      </motion.div>

    </section>
  );
};
