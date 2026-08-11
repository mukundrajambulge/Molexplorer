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
  Layers,
  Dna,
  Zap,
  Atom,
  ShieldCheck,
  Eye,
  Sliders
} from 'lucide-react';
import { HeroScene3D } from './HeroScene3D';
import { GlassCard } from './GlassCard';
import { AnimatedCounter } from './AnimatedCounter';

export const Hero: React.FC = () => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050508] font-sans text-slate-100 hud-grid">
      {/* Bioluminescent Ambient Radial Glows */}
      <div className="pointer-events-none absolute -top-40 left-1/4 h-[650px] w-[650px] rounded-full bg-cyan-500/10 blur-[150px]" />
      <div className="pointer-events-none absolute top-1/3 -right-40 h-[600px] w-[600px] rounded-full bg-amber-500/10 blur-[160px]" />
      <div className="pointer-events-none absolute -bottom-40 left-1/3 h-[500px] w-[500px] rounded-full bg-violet-500/10 blur-[140px]" />

      {/* Main Container */}
      <div className="relative z-10 mx-auto max-w-7xl px-4 pt-12 pb-24 sm:px-6 lg:px-8 lg:pt-16">
        
        {/* ========================================================================= */}
        {/* HERO SECTION: Split Screen (Left: Typography & CTAs | Right: 3D Scene)     */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
          
          {/* Left Column: Heading, Subtitle & Action Launchers (7 Cols) */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6 lg:col-span-7"
          >
            {/* Top Tactical Status Badge */}
            <div className="inline-flex items-center gap-2.5 rounded-full border border-cyan-500/30 bg-slate-950/80 px-4 py-1.5 backdrop-blur-xl shadow-[0_0_15px_rgba(0,242,255,0.15)]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500"></span>
              </span>
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              <span className="font-mono text-xs font-medium tracking-wider text-cyan-300">
                v2.0 NEXT-GEN CHEMINFORMATICS SUITE
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl font-extralight tracking-tight text-white sm:text-6xl lg:text-7xl leading-[1.08]">
              Molecular Intelligence <br />
              <span className="font-bold bg-gradient-to-r from-cyan-400 via-teal-300 to-amber-400 bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(0,242,255,0.3)]">
                Redefined in 3D
              </span>
            </h1>

            {/* Subtitle */}
            <p className="max-w-2xl text-base font-light text-slate-300 sm:text-lg leading-relaxed">
              Explore vast chemical libraries, simulate ligand-receptor binding poses, inspect Ramachandran secondary structures, and perform biophysical analytics in an ultra-responsive WebGL environment.
            </p>

            {/* Launch Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-4">
              <Link
                to="/molexplorer"
                className="btn-luminous group relative inline-flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 px-8 py-4 text-sm font-semibold text-slate-950 shadow-[0_0_30px_rgba(0,242,255,0.35)] transition-all hover:shadow-[0_0_40px_rgba(0,242,255,0.5)] hover:-translate-y-0.5"
              >
                <FlaskConical className="h-5 w-5 text-slate-950 transition-transform group-hover:rotate-12" />
                <span>Launch MolExplorer</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1.5" />
              </Link>

              <Link
                to="/molstudio"
                className="btn-luminous group relative inline-flex items-center justify-center gap-3 rounded-xl border border-amber-500/40 bg-slate-950/70 px-8 py-4 text-sm font-semibold text-amber-300 backdrop-blur-xl shadow-[0_0_20px_rgba(242,125,38,0.2)] transition-all hover:border-amber-400 hover:bg-amber-500/10 hover:shadow-[0_0_30px_rgba(242,125,38,0.4)] hover:-translate-y-0.5"
              >
                <Beaker className="h-5 w-5 text-amber-400 transition-transform group-hover:rotate-12" />
                <span>Open MolStudio</span>
                <ArrowRight className="h-4 w-4 opacity-70 transition-all group-hover:opacity-100 group-hover:translate-x-1.5" />
              </Link>
            </div>

            {/* Quick Engine Status Readout */}
            <div className="flex flex-wrap items-center gap-6 pt-3 text-xs font-mono text-slate-400">
              <div className="flex items-center gap-2">
                <Dna className="h-4 w-4 text-cyan-400" />
                <span>RDKit WASM Engine</span>
              </div>
              <div className="flex items-center gap-2">
                <Atom className="h-4 w-4 text-amber-400" />
                <span>3Dmol.js & Three.js</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-400" />
                <span>C++ Drogon Backend</span>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Live 3D WebGL Molecular Viewport (5 Cols) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.0, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative lg:col-span-5"
          >
            {/* Sci-Fi Floating Frame */}
            <div className="relative aspect-square w-full max-w-[520px] mx-auto rounded-3xl border border-cyan-500/30 bg-slate-950/80 p-2 shadow-[0_0_50px_rgba(0,242,255,0.2)] backdrop-blur-2xl">
              
              {/* Outer Glowing Reticle Lines */}
              <div className="pointer-events-none absolute -top-2 -left-2 h-6 w-6 border-t-2 border-l-2 border-cyan-400" />
              <div className="pointer-events-none absolute -top-2 -right-2 h-6 w-6 border-t-2 border-r-2 border-cyan-400" />
              <div className="pointer-events-none absolute -bottom-2 -left-2 h-6 w-6 border-b-2 border-l-2 border-amber-400" />
              <div className="pointer-events-none absolute -bottom-2 -right-2 h-6 w-6 border-b-2 border-r-2 border-amber-400" />

              {/* 3D Scene Viewport */}
              <div className="relative h-full w-full overflow-hidden rounded-2xl bg-black/80">
                <HeroScene3D />
              </div>
            </div>
          </motion.div>

        </div>

        {/* ========================================================================= */}
        {/* STATS TELEMETRY HUD BAR                                                   */}
        {/* ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-20 rounded-2xl border border-white/10 bg-slate-950/70 p-6 backdrop-blur-2xl shadow-2xl"
        >
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 sm:divide-x sm:divide-white/10">
            
            <div className="space-y-1 sm:px-6 first:sm:pl-0">
              <div className="font-mono text-xs uppercase tracking-wider text-slate-400">Chemical Library</div>
              <div className="text-2xl sm:text-3xl font-light text-cyan-400 font-mono">
                <AnimatedCounter to={12480500} suffix="+" />
              </div>
              <div className="text-xs text-slate-500 font-sans">Structures Indexed</div>
            </div>

            <div className="space-y-1 sm:px-6">
              <div className="font-mono text-xs uppercase tracking-wider text-slate-400">Atoms Simulated</div>
              <div className="text-2xl sm:text-3xl font-light text-amber-400 font-mono">
                <AnimatedCounter to={94200000} suffix="+" />
              </div>
              <div className="text-xs text-slate-500 font-sans">Spatial Coordinates</div>
            </div>

            <div className="space-y-1 sm:px-6">
              <div className="font-mono text-xs uppercase tracking-wider text-slate-400">Docking Poses</div>
              <div className="text-2xl sm:text-3xl font-light text-violet-400 font-mono">
                <AnimatedCounter to={4850000} suffix="+" />
              </div>
              <div className="text-xs text-slate-500 font-sans">Empirical Scores</div>
            </div>

            <div className="space-y-1 sm:px-6 last:sm:pr-0">
              <div className="font-mono text-xs uppercase tracking-wider text-slate-400">Compute Latency</div>
              <div className="text-2xl sm:text-3xl font-light text-emerald-400 font-mono">
                &lt; 1.8ms
              </div>
              <div className="text-xs text-slate-500 font-sans">WASM Execution Time</div>
            </div>

          </div>
        </motion.div>

        {/* ========================================================================= */}
        {/* 3D GLASSMORPHIC FEATURE CARDS                                             */}
        {/* ========================================================================= */}
        <div className="mt-20 space-y-8">
          <div className="text-center space-y-3">
            <div className="font-mono text-xs tracking-widest text-cyan-400 uppercase">Interactive Capabilities</div>
            <h2 className="text-3xl sm:text-4xl font-light text-white">
              Engineered for Modern Structural Biology
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Feature 1: MolExplorer */}
            <Link to="/molexplorer" className="block group">
              <GlassCard accentColor="cyan" className="h-full">
                <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-[0_0_20px_rgba(0,242,255,0.2)] group-hover:scale-110 transition-transform">
                  <Database className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-xl font-medium text-white tracking-wide flex items-center justify-between">
                  <span>MolExplorer</span>
                  <ArrowRight className="h-4 w-4 text-cyan-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed font-light mb-4">
                  Import SDF, PDB, and SMILES libraries. Filter by molecular properties, calculate Lipinski RO5 compliance, and inspect 2D topological structures.
                </p>
                <div className="flex flex-wrap gap-2 text-[11px] font-mono text-cyan-300/80">
                  <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">RDKit WASM</span>
                  <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">2D Ketcher</span>
                  <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">Lipinski Filter</span>
                </div>
              </GlassCard>
            </Link>

            {/* Feature 2: MolStudio */}
            <Link to="/molstudio" className="block group">
              <GlassCard accentColor="amber" className="h-full">
                <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-[0_0_20px_rgba(242,125,38,0.2)] group-hover:scale-110 transition-transform">
                  <Cpu className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-xl font-medium text-white tracking-wide flex items-center justify-between">
                  <span>MolStudio 3D</span>
                  <ArrowRight className="h-4 w-4 text-amber-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed font-light mb-4">
                  Full PyMOL-compatible 3D studio. Multi-representation rendering (Cartoon, Sticks, Surfaces, Putty), Ramachandran plots, and CCP4 map isosurfacing.
                </p>
                <div className="flex flex-wrap gap-2 text-[11px] font-mono text-amber-300/80">
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">PyMOL Console</span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">DSSP & Rama</span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">Isosurface 3D</span>
                </div>
              </GlassCard>
            </Link>

            {/* Feature 3: Biophysical Validation */}
            <GlassCard accentColor="violet" className="h-full">
              <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-400 shadow-[0_0_20px_rgba(139,92,246,0.2)]">
                <Activity className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-medium text-white tracking-wide">
                Biophysical Analytics
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed font-light mb-4">
                Hydrogen-bond energy networks, salt bridge spatial verification, molecular dipole vectors, Kabsch SVD alignment, and atomic clash detection.
              </p>
              <div className="flex flex-wrap gap-2 text-[11px] font-mono text-violet-300/80">
                <span className="px-2 py-0.5 rounded bg-violet-500/10 border border-violet-500/20">Kabsch SVD</span>
                <span className="px-2 py-0.5 rounded bg-violet-500/10 border border-violet-500/20">Dipole Debye</span>
                <span className="px-2 py-0.5 rounded bg-violet-500/10 border border-violet-500/20">H-Bond E &lt; 0.5</span>
              </div>
            </GlassCard>

          </div>
        </div>

        {/* ========================================================================= */}
        {/* BOTTOM TERMINAL TELEMETRY STRIP                                           */}
        {/* ========================================================================= */}
        <div className="mt-20 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-slate-500 gap-4">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-cyan-400">
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
              CORE: ACTIVE
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              BUILD: SECURE_WASM
            </span>
            <span>•</span>
            <span className="hidden md:inline text-slate-400">
              HOST: CLIENT-SIDE ACCELERATED
            </span>
          </div>
          <div className="text-slate-400">
            FRAME RATE: <span className="text-cyan-400">60 FPS</span> | ENGINE: THREE.JS + 3DMOL
          </div>
        </div>

      </div>
    </div>
  );
};