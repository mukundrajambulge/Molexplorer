import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Database,
  Cpu,
  Activity,
  ArrowRight,
  Sparkles,
  Calculator,
  CheckCircle2,
  AlertCircle,
  Eye,
  Layers,
  MousePointer,
  Ruler,
  Compass,
  Zap,
  Dna
} from 'lucide-react';
import { GlassCard } from '../GlassCard';
import { getRDKit } from '../../lib/rdkit';

const DEMO_MOLECULES = [
  { name: 'Aspirin', smiles: 'CC(=O)Oc1ccccc1C(=O)O', formula: 'C9H8O4', type: 'NSAID Analgesic' },
  { name: 'Caffeine', smiles: 'CN1C=NC2=C1C(=O)N(C(=O)N2C)C', formula: 'C8H10N4O2', type: 'Alkaloid Stimulant' },
  { name: 'Paracetamol', smiles: 'CC(=O)Nc1ccc(O)cc1', formula: 'C8H9NO2', type: 'Antipyretic' },
  { name: 'Penicillin G', smiles: 'CC1(C(N2C(S1)C(C2=O)NC(=O)Cc3ccccc3)C(=O)O)C', formula: 'C16H18N2O4S', type: 'Antibiotic' },
  { name: 'Dopamine', smiles: 'NCCc1ccc(O)c(O)c1', formula: 'C8H11NO2', type: 'Neurotransmitter' },
  { name: 'ATP', smiles: 'Nc1ncnc2n(cnc12)C3OC(COP(=O)(O)OP(=O)(O)OP(=O)(O)O)C(O)C3O', formula: 'C10H16N5O13P3', type: 'Energy Currency' }
];

export const ScrollSections: React.FC = () => {
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

  // In-memory RDKit calculator
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
    <div className="relative z-10 space-y-36 py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pointer-events-auto">
      
      {/* ========================================================================= */}
      {/* SECTION 2: 3D MOLECULAR VISUALIZATION & INTERACTIVE PICKING                */}
      {/* ========================================================================= */}
      <motion.section
        initial={{ opacity: 0, y: 35 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
      >
        <div className="lg:col-span-6 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-400/30 bg-slate-900/80 text-xs font-mono text-cyan-300 backdrop-blur-xl">
            <Eye className="h-3.5 w-3.5 text-cyan-400" />
            <span>STAGE 01 • VISUALIZATION & PICKING</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-light text-white leading-tight">
            Dynamic 3D Viewport with <br />
            <span className="font-bold bg-gradient-to-r from-cyan-400 to-teal-300 bg-clip-text text-transparent">
              Multi-Level Picking
            </span>
          </h2>

          <p className="text-slate-300 text-base leading-relaxed font-normal">
            Interact with complex biomolecular assemblies at 60 FPS. Seamlessly switch between Cartoon ribbons, Sticks, van der Waals Surfaces, and DSSP secondary structure assignments with persistent luminous picking highlights.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2 font-mono text-xs">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-700/60 backdrop-blur-xl space-y-1 hover:border-cyan-400/40 transition-colors shadow-lg">
              <span className="text-cyan-400 font-semibold flex items-center gap-1.5">
                <MousePointer className="h-3.5 w-3.5" /> 5 Granularities
              </span>
              <p className="text-slate-400 text-[11px] leading-normal">Atom, Residue, Ligand, Chain & Molecule expansion.</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-700/60 backdrop-blur-xl space-y-1 hover:border-amber-400/40 transition-colors shadow-lg">
              <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                <Ruler className="h-3.5 w-3.5" /> 3D Measurement
              </span>
              <p className="text-slate-400 text-[11px] leading-normal">Distance (Å), bond angles (°) & dihedral torsions.</p>
            </div>
          </div>

          <div className="pt-2">
            <Link
              to="/molstudio"
              className="btn-luminous inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 text-xs font-semibold hover:bg-cyan-500/30 transition-all shadow-md"
            >
              <span>Explore MolStudio 3D</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="p-6 sm:p-8 rounded-2xl border border-slate-700/60 bg-slate-900/80 backdrop-blur-2xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 pb-3 border-b border-slate-700/50">
              <span className="text-cyan-400 font-semibold">VIEWPORT CAPABILITIES</span>
              <span>HARDWARE ACCELERATED</span>
            </div>

            <div className="space-y-3">
              {[
                { title: 'Ribbon & Cartoon Engine', desc: 'DSSP secondary structure recognition (α-helices, β-sheets, loops) with color spectrums.', color: 'text-cyan-400' },
                { title: 'Electrostatic SAS & VDW Surfaces', desc: 'Real-time marching cubes isosurfacing with adjustable transparency and mesh grids.', color: 'text-teal-400' },
                { title: 'Interactive Picking & Measurement', desc: 'Instant raycasting feedback with real-time Ångström distance, angle, and dihedral calculations.', color: 'text-amber-400' }
              ].map((cap, i) => (
                <div key={i} className="p-4 rounded-xl bg-slate-950/60 border border-slate-700/40 space-y-1 hover:border-slate-600 transition-colors">
                  <div className={`text-xs font-semibold ${cap.color}`}>{cap.title}</div>
                  <div className="text-xs text-slate-300 font-normal leading-relaxed">{cap.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      {/* ========================================================================= */}
      {/* SECTION 3: IN-BROWSER CHEMINFORMATICS & CHEMICAL CALCULATOR                */}
      {/* ========================================================================= */}
      <motion.section
        initial={{ opacity: 0, y: 35 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-2xl border border-slate-700/60 bg-slate-900/80 p-6 sm:p-8 backdrop-blur-2xl shadow-2xl space-y-6"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-700/60">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-cyan-400 mb-1">
              <Calculator className="h-4 w-4" />
              <span>STAGE 02 • IN-MEMORY RDKIT WASM</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-light text-white">
              Instant Chemical Property Screening
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
        <div className="flex flex-col sm:flex-row items-stretch gap-3">
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
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-950/60 border border-slate-700/60 text-xs font-mono text-slate-400">
            <span>Formula:</span>
            <span className="text-amber-300 font-bold">{selectedDemo.formula}</span>
          </div>
        </div>

        {/* Computed Metrics Display */}
        {computedStats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            
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
      </motion.section>

      {/* ========================================================================= */}
      {/* SECTION 4: BIOPHYSICAL ANALYSIS & DOCKING ALIGNMENT                       */}
      {/* ========================================================================= */}
      <motion.section
        initial={{ opacity: 0, y: 35 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        <GlassCard accentColor="cyan" className="h-full">
          <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-400/40 text-cyan-400 shadow-sm">
            <Database className="h-5 w-5" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white tracking-wide">
            Library Screening
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed font-normal mb-4">
            Upload custom SDF and SMILES libraries. Filter thousands of compounds by MW, cLogP, and substructure matching with 2D Ketcher editor integration.
          </p>
          <div className="flex flex-wrap gap-2 text-[11px] font-mono text-cyan-300">
            <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/30">Library Table</span>
            <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/30">2D Sketcher</span>
          </div>
        </GlassCard>

        <GlassCard accentColor="amber" className="h-full">
          <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-400 shadow-sm">
            <Cpu className="h-5 w-5" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white tracking-wide">
            Kabsch Superimposition
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed font-normal mb-4">
            Rigorous SVD rotation matrix calculation for optimal structural alignment. Calculate all-atom and $C_\alpha$ RMSD differences between conformers.
          </p>
          <div className="flex flex-wrap gap-2 text-[11px] font-mono text-amber-300">
            <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-400/30">SVD Algorithm</span>
            <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-400/30">RMSD Fitting</span>
          </div>
        </GlassCard>

        <GlassCard accentColor="violet" className="h-full">
          <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/15 border border-violet-400/40 text-violet-400 shadow-sm">
            <Activity className="h-5 w-5" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-white tracking-wide">
            Biophysical Diagnostics
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed font-normal mb-4">
            Ramachandran phi/psi distributions, molecular dipole moment vectors in Debye, hydrogen-bond networks, and steric clash detection.
          </p>
          <div className="flex flex-wrap gap-2 text-[11px] font-mono text-violet-300">
            <span className="px-2 py-0.5 rounded bg-violet-500/15 border border-violet-400/30">Dipole Debye</span>
            <span className="px-2 py-0.5 rounded bg-violet-500/15 border border-violet-400/30">Ramachandran</span>
          </div>
        </GlassCard>
      </motion.section>

    </div>
  );
};
