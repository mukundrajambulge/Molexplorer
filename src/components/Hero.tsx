import React, { useState, useEffect } from 'react';
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
  CheckCircle2,
  AlertCircle,
  Layers,
  ChevronRight,
  Calculator,
  Compass,
  Search
} from 'lucide-react';
import { HeroScene3D } from './HeroScene3D';
import { GlassCard } from './GlassCard';
import { getRDKit } from '../lib/rdkit';

// Preset sample molecules for live home page calculator demo
const DEMO_MOLECULES = [
  { name: 'Aspirin', smiles: 'CC(=O)Oc1ccccc1C(=O)O', formula: 'C9H8O4', type: 'NSAID / Analgesic' },
  { name: 'Caffeine', smiles: 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C', formula: 'C8H10N4O2', type: 'Alkaloid Stimulant' },
  { name: 'Paracetamol', smiles: 'CC(=O)Nc1ccc(O)cc1', formula: 'C8H9NO2', type: 'Antipyretic' },
  { name: 'Penicillin G', smiles: 'CC1(C(N2C(S1)C(C2=O)NC(=O)Cc3ccccc3)C(=O)O)C', formula: 'C16H18N2O4S', type: 'Beta-lactam Antibiotic' },
  { name: 'Dopamine', smiles: 'NCCc1ccc(O)c(O)c1', formula: 'C8H11NO2', type: 'Neurotransmitter' },
  { name: 'ATP', smiles: 'Nc1ncnc2n(cnc12)C3OC(COP(=O)(O)OP(=O)(O)OP(=O)(O)O)C(O)C3O', formula: 'C10H16N5O13P3', type: 'Energy Currency' }
];

export const Hero: React.FC = () => {
  const [selectedDemo, setSelectedDemo] = useState(DEMO_MOLECULES[0]);
  const [customSmiles, setCustomSmiles] = useState(DEMO_MOLECULES[0].smiles);
  const [computedStats, setComputedStats] = useState<{
    mw: string;
    logp: string;
    tpsa: string;
    hba: string;
    hbd: string;
    rot: string;
    lipinski: boolean;
  } | null>(null);

  // Compute RDKit properties live in-browser on home page
  useEffect(() => {
    let isMounted = true;
    const compute = async () => {
      try {
        const rdkit = await getRDKit();
        const mol = rdkit.get_mol(customSmiles);
        if (mol && isMounted) {
          const desc = JSON.parse(mol.get_descriptors());
          const mw = desc.amw || 0;
          const logp = desc.CrippenClogP || 0;
          const hba = desc.NumHBA || 0;
          const hbd = desc.NumHBD || 0;
          const tpsa = desc.tpsa || 0;
          const rot = desc.NumRotatableBonds || 0;

          const lipinski = mw <= 500 && logp <= 5 && hbd <= 5 && hba <= 10;

          setComputedStats({
            mw: mw.toFixed(2),
            logp: logp.toFixed(2),
            tpsa: tpsa.toFixed(1),
            hba: hba.toString(),
            hbd: hbd.toString(),
            rot: rot.toString(),
            lipinski
          });
          mol.delete();
        }
      } catch (e) {
        if (isMounted) setComputedStats(null);
      }
    };
    compute();
    return () => { isMounted = false; };
  }, [customSmiles]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 font-sans text-slate-100">
      
      {/* Soft Ambient Radial Background Glows */}
      <div className="pointer-events-none absolute -top-40 left-1/4 h-[600px] w-[600px] rounded-full bg-cyan-500/10 blur-[150px]" />
      <div className="pointer-events-none absolute top-1/3 -right-40 h-[600px] w-[600px] rounded-full bg-amber-500/10 blur-[150px]" />
      <div className="pointer-events-none absolute bottom-10 left-10 h-[500px] w-[500px] rounded-full bg-indigo-500/10 blur-[150px]" />

      {/* Main Content Container */}
      <div className="relative z-10 mx-auto max-w-7xl px-4 pt-10 pb-20 sm:px-6 lg:px-8 lg:pt-16">
        
        {/* ========================================================================= */}
        {/* HERO SECTION: Split Screen (Left: Typography & CTAs | Right: 3D Scene)     */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
          
          {/* Left Column: Heading, Subtitle & Action Launchers (7 Cols) */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="space-y-6 lg:col-span-7"
          >
            {/* Top Tagline Badge */}
            <div className="inline-flex items-center gap-2.5 rounded-full border border-cyan-400/30 bg-slate-900/90 px-4 py-1.5 backdrop-blur-xl shadow-md">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400"></span>
              </span>
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              <span className="font-mono text-xs font-semibold tracking-wider text-cyan-300">
                v2.0 CHEMINFORMATICS & 3D STUDIO
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl font-light tracking-tight text-white sm:text-5xl lg:text-6xl leading-[1.1]">
              Explore Chemical Space with <br />
              <span className="font-bold bg-gradient-to-r from-cyan-400 via-teal-300 to-amber-400 bg-clip-text text-transparent">
                Precision & Speed
              </span>
            </h1>

            {/* Subtitle */}
            <p className="max-w-2xl text-base font-normal text-slate-300 sm:text-lg leading-relaxed">
              Accelerate molecular discovery workflows with real-time 3D visualization, interactive atom picking, multi-level selection expansion, and biophysical analytics.
            </p>

            {/* Launch Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
              <Link
                to="/molexplorer"
                className="btn-luminous group relative inline-flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 px-7 py-3.5 text-sm font-semibold text-slate-950 shadow-[0_0_25px_rgba(0,242,255,0.3)] transition-all hover:shadow-[0_0_35px_rgba(0,242,255,0.5)] hover:-translate-y-0.5"
              >
                <FlaskConical className="h-5 w-5 text-slate-950" />
                <span>Launch MolExplorer</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1.5" />
              </Link>

              <Link
                to="/molstudio"
                className="btn-luminous group relative inline-flex items-center justify-center gap-3 rounded-xl border border-amber-500/40 bg-slate-900/80 px-7 py-3.5 text-sm font-semibold text-amber-300 backdrop-blur-xl shadow-[0_0_20px_rgba(242,125,38,0.2)] transition-all hover:border-amber-400 hover:bg-amber-500/15 hover:shadow-[0_0_30px_rgba(242,125,38,0.4)] hover:-translate-y-0.5"
              >
                <Beaker className="h-5 w-5 text-amber-400" />
                <span>Open MolStudio</span>
                <ArrowRight className="h-4 w-4 opacity-80 transition-all group-hover:opacity-100 group-hover:translate-x-1.5" />
              </Link>
            </div>

            {/* Quick Engine Status Readout */}
            <div className="flex flex-wrap items-center gap-6 pt-2 text-xs font-mono text-slate-400">
              <div className="flex items-center gap-2">
                <Dna className="h-4 w-4 text-cyan-400" />
                <span className="text-slate-300">RDKit In-Memory WASM</span>
              </div>
              <div className="flex items-center gap-2">
                <Atom className="h-4 w-4 text-amber-400" />
                <span className="text-slate-300">60 FPS WebGL 3D</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-400" />
                <span className="text-slate-300">Picking & Measurements</span>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Clean 3D Molecular Preview Viewport (5 Cols) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
            className="relative lg:col-span-5"
          >
            {/* Clean Rounded Glass Frame */}
            <div className="relative aspect-square w-full max-w-[480px] mx-auto rounded-2xl border border-slate-700/60 bg-slate-900/80 p-2 shadow-2xl backdrop-blur-2xl">
              
              {/* 3D Scene Canvas */}
              <div className="relative h-full w-full overflow-hidden rounded-xl bg-slate-950/90">
                <HeroScene3D />
              </div>
            </div>
          </motion.div>

        </div>

        {/* ========================================================================= */}
        {/* LIVE IN-BROWSER CHEMINFORMATICS COMPUTATION WIDGET                        */}
        {/* ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-16 rounded-2xl border border-slate-700/60 bg-slate-900/80 p-6 sm:p-8 backdrop-blur-2xl shadow-2xl"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-700/60">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-cyan-400 mb-1">
                <Calculator className="h-4 w-4" />
                <span>Live In-Browser Calculation Engine</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-medium text-white">
                Interactive Chemical Property Calculator
              </h2>
            </div>

            {/* Preset Selector Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              {DEMO_MOLECULES.map((m) => (
                <button
                  key={m.name}
                  onClick={() => {
                    setSelectedDemo(m);
                    setCustomSmiles(m.smiles);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedDemo.name === m.name
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-sm'
                      : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700/80 border border-slate-700/40'
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          {/* SMILES Input Bar */}
          <div className="mt-6 flex flex-col sm:flex-row items-stretch gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs text-slate-500 uppercase">SMILES:</span>
              <input
                type="text"
                value={customSmiles}
                onChange={(e) => setCustomSmiles(e.target.value)}
                placeholder="Enter SMILES notation (e.g. CC(=O)Oc1ccccc1C(=O)O)"
                className="w-full pl-20 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/60 font-mono text-xs text-cyan-300 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition-all shadow-inner"
              />
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-700/60 text-xs font-mono text-slate-400">
              <span>Formula:</span>
              <span className="text-amber-300 font-bold">{selectedDemo.formula}</span>
            </div>
          </div>

          {/* Computed Metrics Display */}
          {computedStats && (
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-700/40 space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400">Molecular Weight</span>
                <div className="text-lg font-mono font-bold text-white">{computedStats.mw} <span className="text-xs text-slate-400 font-normal">g/mol</span></div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-700/40 space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400">cLogP Partition</span>
                <div className="text-lg font-mono font-bold text-cyan-300">{computedStats.logp}</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-700/40 space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400">TPSA Surface</span>
                <div className="text-lg font-mono font-bold text-teal-300">{computedStats.tpsa} <span className="text-xs text-slate-400 font-normal">Å²</span></div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-700/40 space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400">H-Bond Donors</span>
                <div className="text-lg font-mono font-bold text-amber-300">{computedStats.hbd}</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-700/40 space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400">H-Bond Acceptors</span>
                <div className="text-lg font-mono font-bold text-violet-300">{computedStats.hba}</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-700/40 space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400">Lipinski Compliance</span>
                <div className="flex items-center gap-1.5 pt-0.5">
                  {computedStats.lipinski ? (
                    <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" /> PASSED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-rose-400">
                      <AlertCircle className="h-4 w-4" /> VIOLATED
                    </span>
                  )}
                </div>
              </div>

            </div>
          )}
        </motion.div>

        {/* ========================================================================= */}
        {/* 3D FEATURE CARDS                                                          */}
        {/* ========================================================================= */}
        <div className="mt-16 space-y-8">
          <div className="text-center space-y-2">
            <div className="font-mono text-xs tracking-widest text-cyan-400 uppercase font-semibold">Modular Platform Architecture</div>
            <h2 className="text-2xl sm:text-3xl font-light text-white">
              Built for Modern Structural Biology & Drug Discovery
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Feature 1: MolExplorer */}
            <Link to="/molexplorer" className="block group">
              <GlassCard accentColor="cyan" className="h-full">
                <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-400/40 text-cyan-400 shadow-sm group-hover:scale-105 transition-transform">
                  <Database className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-white tracking-wide flex items-center justify-between">
                  <span>MolExplorer</span>
                  <ArrowRight className="h-4 w-4 text-cyan-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed font-normal mb-4">
                  Import SDF, PDB, and SMILES libraries. Filter by molecular properties, calculate Lipinski RO5 compliance, and inspect 2D topological structures.
                </p>
                <div className="flex flex-wrap gap-2 text-[11px] font-mono text-cyan-300">
                  <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/30">RDKit WASM</span>
                  <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/30">2D Sketcher</span>
                  <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/30">Property Filters</span>
                </div>
              </GlassCard>
            </Link>

            {/* Feature 2: MolStudio */}
            <Link to="/molstudio" className="block group">
              <GlassCard accentColor="amber" className="h-full">
                <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-400 shadow-sm group-hover:scale-105 transition-transform">
                  <Cpu className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-white tracking-wide flex items-center justify-between">
                  <span>MolStudio 3D</span>
                  <ArrowRight className="h-4 w-4 text-amber-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed font-normal mb-4">
                  Full 3D molecular studio. Interactive atom picking, distance/angle/dihedral measurement wizard, DSSP secondary structure assignment, and CCP4 map isosurfaces.
                </p>
                <div className="flex flex-wrap gap-2 text-[11px] font-mono text-amber-300">
                  <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-400/30">Interactive Picking</span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-400/30">3D Measurements</span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-400/30">DSSP & Rama</span>
                </div>
              </GlassCard>
            </Link>

            {/* Feature 3: Biophysical Validation */}
            <GlassCard accentColor="violet" className="h-full">
              <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/15 border border-violet-400/40 text-violet-400 shadow-sm">
                <Activity className="h-5 w-5" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-white tracking-wide">
                Biophysical Analytics
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed font-normal mb-4">
                Hydrogen-bond energy networks, salt bridge spatial verification, molecular dipole vectors, Kabsch SVD alignment, and atomic clash detection.
              </p>
              <div className="flex flex-wrap gap-2 text-[11px] font-mono text-violet-300">
                <span className="px-2 py-0.5 rounded bg-violet-500/15 border border-violet-400/30">Kabsch SVD</span>
                <span className="px-2 py-0.5 rounded bg-violet-500/15 border border-violet-400/30">Dipole Debye</span>
                <span className="px-2 py-0.5 rounded bg-violet-500/15 border border-violet-400/30">H-Bond Network</span>
              </div>
            </GlassCard>

          </div>
        </div>

      </div>
    </div>
  );
};