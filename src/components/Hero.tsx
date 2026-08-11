import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  FlaskConical,
  Beaker,
  ArrowRight,
  Sparkles,
  Database,
  Activity,
  Cpu,
  Dna,
  Zap,
  Atom,
  ShieldCheck,
  Layers,
  FileCode2
} from 'lucide-react';
import { HeroScene3D } from './HeroScene3D';
import { GlassCard } from './GlassCard';

export const Hero: React.FC = () => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050508] font-sans text-slate-100 hud-grid">
      {/* Soft Ambient Radial Background Glows */}
      <div className="pointer-events-none absolute -top-40 left-1/4 h-[500px] w-[500px] rounded-full bg-cyan-500/5 blur-[140px]" />
      <div className="pointer-events-none absolute top-1/3 -right-40 h-[500px] w-[500px] rounded-full bg-amber-500/5 blur-[140px]" />

      {/* Main Content Container */}
      <div className="relative z-10 mx-auto max-w-7xl px-4 pt-10 pb-20 sm:px-6 lg:px-8 lg:pt-14">
        
        {/* ========================================================================= */}
        {/* HERO SECTION: Split Screen (Left: Typography & CTAs | Right: 3D Scene)     */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-8">
          
          {/* Left Column: Heading, Subtitle & Action Launchers (7 Cols) */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="space-y-6 lg:col-span-7"
          >
            {/* Top Tagline Badge */}
            <div className="inline-flex items-center gap-2.5 rounded-full border border-cyan-500/30 bg-slate-950/80 px-4 py-1.5 backdrop-blur-xl shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500"></span>
              </span>
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              <span className="font-mono text-xs font-medium tracking-wider text-cyan-300">
                v2.0 CHEMINFORMATICS SUITE
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl font-extralight tracking-tight text-white sm:text-5xl lg:text-6xl leading-[1.1]">
              Explore Chemical Space with <br />
              <span className="font-bold bg-gradient-to-r from-cyan-400 via-teal-300 to-amber-400 bg-clip-text text-transparent">
                Precision & Speed
              </span>
            </h1>

            {/* Subtitle */}
            <p className="max-w-2xl text-base font-light text-slate-300 sm:text-lg leading-relaxed">
              Accelerate molecular discovery workflows with real-time 3D visualization, structure property filtering, descriptor calculations, and biophysical analytics.
            </p>

            {/* Launch Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
              <Link
                to="/molexplorer"
                className="btn-luminous group relative inline-flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 px-7 py-3.5 text-sm font-semibold text-slate-950 shadow-[0_0_25px_rgba(0,242,255,0.25)] transition-all hover:shadow-[0_0_35px_rgba(0,242,255,0.4)] hover:-translate-y-0.5"
              >
                <FlaskConical className="h-5 w-5 text-slate-950" />
                <span>Launch MolExplorer</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1.5" />
              </Link>

              <Link
                to="/molstudio"
                className="btn-luminous group relative inline-flex items-center justify-center gap-3 rounded-xl border border-amber-500/40 bg-slate-950/70 px-7 py-3.5 text-sm font-semibold text-amber-300 backdrop-blur-xl shadow-[0_0_15px_rgba(242,125,38,0.15)] transition-all hover:border-amber-400 hover:bg-amber-500/10 hover:shadow-[0_0_25px_rgba(242,125,38,0.3)] hover:-translate-y-0.5"
              >
                <Beaker className="h-5 w-5 text-amber-400" />
                <span>Open MolStudio</span>
                <ArrowRight className="h-4 w-4 opacity-70 transition-all group-hover:opacity-100 group-hover:translate-x-1.5" />
              </Link>
            </div>

            {/* Quick Engine Status Readout */}
            <div className="flex flex-wrap items-center gap-5 pt-2 text-xs font-mono text-slate-400">
              <div className="flex items-center gap-2">
                <Dna className="h-4 w-4 text-cyan-400" />
                <span>RDKit WebAssembly</span>
              </div>
              <div className="flex items-center gap-2">
                <Atom className="h-4 w-4 text-amber-400" />
                <span>WebGL 3D Engine</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-400" />
                <span>High-Throughput Analytics</span>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Clean 3D Molecular Preview Viewport (5 Cols) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
            className="relative lg:col-span-5"
          >
            {/* Clean Rounded Frame */}
            <div className="relative aspect-square w-full max-w-[460px] mx-auto rounded-2xl border border-white/10 bg-slate-950/80 p-2 shadow-2xl backdrop-blur-xl">
              
              {/* 3D Scene Canvas */}
              <div className="relative h-full w-full overflow-hidden rounded-xl bg-black/70">
                <HeroScene3D />
              </div>
            </div>
          </motion.div>

        </div>

        {/* ========================================================================= */}
        {/* CORE PLATFORM CAPABILITIES                                                */}
        {/* ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-16 rounded-2xl border border-white/10 bg-slate-950/70 p-6 backdrop-blur-xl shadow-xl"
        >
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 sm:divide-x sm:divide-white/10">
            
            <div className="space-y-1 sm:px-6 first:sm:pl-0">
              <div className="font-mono text-xs uppercase tracking-wider text-slate-400">Cheminformatics</div>
              <div className="text-lg sm:text-xl font-medium text-cyan-400">
                RDKit WebAssembly
              </div>
              <div className="text-xs text-slate-500">In-Browser Calculation</div>
            </div>

            <div className="space-y-1 sm:px-6">
              <div className="font-mono text-xs uppercase tracking-wider text-slate-400">Rendering Engine</div>
              <div className="text-lg sm:text-xl font-medium text-amber-400">
                Hardware-Accelerated
              </div>
              <div className="text-xs text-slate-500">Smooth 60 FPS WebGL</div>
            </div>

            <div className="space-y-1 sm:px-6">
              <div className="font-mono text-xs uppercase tracking-wider text-slate-400">Biophysical Tools</div>
              <div className="text-lg sm:text-xl font-medium text-violet-400">
                DSSP & Dihedrals
              </div>
              <div className="text-xs text-slate-500">Ramachandran & SVD</div>
            </div>

            <div className="space-y-1 sm:px-6 last:sm:pr-0">
              <div className="font-mono text-xs uppercase tracking-wider text-slate-400">Formats Supported</div>
              <div className="text-lg sm:text-xl font-medium text-emerald-400">
                SDF, PDB, MMTF
              </div>
              <div className="text-xs text-slate-500">SMILES & Mol Files</div>
            </div>

          </div>
        </motion.div>

        {/* ========================================================================= */}
        {/* 3D GLASSMORPHIC FEATURE CARDS                                             */}
        {/* ========================================================================= */}
        <div className="mt-16 space-y-8">
          <div className="text-center space-y-2">
            <div className="font-mono text-xs tracking-widest text-cyan-400 uppercase">Platform Architecture</div>
            <h2 className="text-2xl sm:text-3xl font-light text-white">
              Built for Modern Structural Biology & Cheminformatics
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Feature 1: MolExplorer */}
            <Link to="/molexplorer" className="block group">
              <GlassCard accentColor="cyan" className="h-full">
                <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-sm group-hover:scale-105 transition-transform">
                  <Database className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-medium text-white tracking-wide flex items-center justify-between">
                  <span>MolExplorer</span>
                  <ArrowRight className="h-4 w-4 text-cyan-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed font-light mb-4">
                  Import SDF, PDB, and SMILES libraries. Filter by molecular properties, calculate Lipinski RO5 compliance, and inspect 2D topological structures.
                </p>
                <div className="flex flex-wrap gap-2 text-[11px] font-mono text-cyan-300/80">
                  <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">RDKit WASM</span>
                  <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">2D Ketcher</span>
                  <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">Property Filters</span>
                </div>
              </GlassCard>
            </Link>

            {/* Feature 2: MolStudio */}
            <Link to="/molstudio" className="block group">
              <GlassCard accentColor="amber" className="h-full">
                <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-sm group-hover:scale-105 transition-transform">
                  <Cpu className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-medium text-white tracking-wide flex items-center justify-between">
                  <span>MolStudio 3D</span>
                  <ArrowRight className="h-4 w-4 text-amber-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed font-light mb-4">
                  Comprehensive 3D molecular studio. Multi-representation rendering (Cartoon, Sticks, Surfaces, Putty), Ramachandran plots, and CCP4 map isosurfacing.
                </p>
                <div className="flex flex-wrap gap-2 text-[11px] font-mono text-amber-300/80">
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">Command Console</span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">DSSP & Rama</span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">Isosurface 3D</span>
                </div>
              </GlassCard>
            </Link>

            {/* Feature 3: Biophysical Validation */}
            <GlassCard accentColor="violet" className="h-full">
              <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-400 shadow-sm">
                <Activity className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-lg font-medium text-white tracking-wide">
                Biophysical Analytics
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed font-light mb-4">
                Hydrogen-bond energy networks, salt bridge spatial verification, molecular dipole vectors, Kabsch SVD alignment, and atomic clash detection.
              </p>
              <div className="flex flex-wrap gap-2 text-[11px] font-mono text-violet-300/80">
                <span className="px-2 py-0.5 rounded bg-violet-500/10 border border-violet-500/20">Kabsch SVD</span>
                <span className="px-2 py-0.5 rounded bg-violet-500/10 border border-violet-500/20">Dipole Debye</span>
                <span className="px-2 py-0.5 rounded bg-violet-500/10 border border-violet-500/20">H-Bond Network</span>
              </div>
            </GlassCard>

          </div>
        </div>

        {/* ========================================================================= */}
        {/* BOTTOM STATUS FOOTER                                                      */}
        {/* ========================================================================= */}
        <div className="mt-16 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-slate-500 gap-4">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-cyan-400">
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
              ENGINE: ACTIVE
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              WASM CLIENT
            </span>
          </div>
          <div className="text-slate-400">
            60 FPS HARDWARE ACCELERATION | WEBGL 2.0
          </div>
        </div>

      </div>
    </div>
  );
};