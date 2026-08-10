import React, { useState } from 'react';
import { DockingJobOutcome, DockedPoseResult } from '../../lib/ScientificDockingEngine';

interface DockingResultsViewerProps {
  outcome: DockingJobOutcome;
  onSelectPose?: (pose: DockedPoseResult) => void;
  onClose?: () => void;
}

export const DockingResultsViewer: React.FC<DockingResultsViewerProps> = ({
  outcome,
  onSelectPose,
  onClose
}) => {
  const [selectedPoseIndex, setSelectedPoseIndex] = useState(0);

  if (!outcome.success || outcome.poses.length === 0) {
    return (
      <div className="bg-slate-900 border border-red-500/50 rounded-xl p-5 text-slate-200 shadow-2xl backdrop-blur-md">
        <h3 className="text-red-400 font-bold text-lg mb-2">Docking Execution Failed</h3>
        <p className="text-sm text-slate-400">{outcome.errorMessage || 'No valid binding poses converged.'}</p>
      </div>
    );
  }

  const currentPose = outcome.poses[selectedPoseIndex] || outcome.poses[0];
  const { energyBreakdown } = currentPose;

  const handlePoseChange = (idx: number) => {
    setSelectedPoseIndex(idx);
    if (onSelectPose) {
      onSelectPose(outcome.poses[idx]);
    }
  };

  const formatKi = (kiNano: number) => {
    if (kiNano < 1000) return `${kiNano.toFixed(1)} nM`;
    if (kiNano < 1000000) return `${(kiNano / 1000).toFixed(2)} µM`;
    return `${(kiNano / 1000000).toFixed(2)} mM`;
  };

  return (
    <div className="bg-slate-900/95 border border-cyan-500/30 rounded-2xl p-6 text-slate-100 shadow-2xl backdrop-blur-xl max-w-xl w-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-cyan-400 animate-pulse"></span>
            <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
              Docking Results (Phase 3 Engine)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Computed in {outcome.executionTimeMs.toFixed(1)} ms • {outcome.numPoses} Binding Mode Clusters
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            ✕
          </button>
        )}
      </div>

      {/* Primary Metrics Card */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3 text-center">
          <span className="text-[11px] text-slate-400 uppercase tracking-wider block mb-1">Binding Affinity</span>
          <span className="text-2xl font-black text-cyan-300">
            {currentPose.bindingAffinity.toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-400 block">kcal/mol</span>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3 text-center">
          <span className="text-[11px] text-slate-400 uppercase tracking-wider block mb-1">Estimated Ki</span>
          <span className="text-2xl font-black text-emerald-400">
            {formatKi(outcome.estimatedKiNanomolar)}
          </span>
          <span className="text-[10px] text-slate-400 block">Inhibition Constant</span>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-3 text-center">
          <span className="text-[11px] text-slate-400 uppercase tracking-wider block mb-1">Cluster Size</span>
          <span className="text-2xl font-black text-purple-400">
            {currentPose.clusterSize}
          </span>
          <span className="text-[10px] text-slate-400 block">Conformations</span>
        </div>
      </div>

      {/* Pose Selector Tabs */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span>Select Ranked Pose:</span>
          <span>Rank #{selectedPoseIndex + 1} of {outcome.poses.length}</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {outcome.poses.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handlePoseChange(idx)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
                selectedPoseIndex === idx
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-lg shadow-cyan-500/20'
                  : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              Pose #{idx + 1} ({p.bindingAffinity.toFixed(1)} kcal/mol)
            </button>
          ))}
        </div>
      </div>

      {/* 5-Term Energy Decomposition */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 mb-5">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
          5-Term Empirical Energy Decomposition
        </h4>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Van der Waals (LJ 6-12)</span>
            <span className="font-mono text-cyan-400">{energyBreakdown.vdw.toFixed(2)} kcal/mol</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Directional H-Bond</span>
            <span className="font-mono text-emerald-400">{energyBreakdown.hbond.toFixed(2)} kcal/mol</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Coulomb Electrostatics</span>
            <span className="font-mono text-amber-400">{energyBreakdown.electrostatics.toFixed(2)} kcal/mol</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Hydrophobic Desolvation</span>
            <span className="font-mono text-blue-400">{energyBreakdown.desolvation.toFixed(2)} kcal/mol</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Torsional Entropy Penalty</span>
            <span className="font-mono text-rose-400">+{energyBreakdown.torsionalPenalty.toFixed(2)} kcal/mol</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => {
            const blob = new Blob([outcome.resultPDBQT || ''], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `docking_poses_rank${selectedPoseIndex + 1}.pdbqt`;
            a.click();
          }}
          className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg transition"
        >
          Export Ranked PDBQT
        </button>
      </div>
    </div>
  );
};
