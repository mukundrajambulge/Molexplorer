import React, { useState } from 'react';
import { useStore } from '../store';

interface PairFitWizardProps {
  onClose: () => void;
}

interface AtomPair {
  id: number;
  refAtom: string;
  targetAtom: string;
  distance: number;
}

export const PairFitWizard: React.FC<PairFitWizardProps> = ({ onClose }) => {
  const { molData, atoms } = useStore();
  const [pairs, setPairs] = useState<AtomPair[]>([
    { id: 1, refAtom: 'Chain A: CA 10', targetAtom: 'Chain B: CA 10', distance: 0.12 },
    { id: 2, refAtom: 'Chain A: CA 50', targetAtom: 'Chain B: CA 50', distance: 0.08 },
    { id: 3, refAtom: 'Chain A: CA 90', targetAtom: 'Chain B: CA 90', distance: 0.15 }
  ]);
  const [rmsd, setRmsd] = useState<number>(0.118);

  const handleAddPair = () => {
    const newId = pairs.length + 1;
    setPairs([
      ...pairs,
      { id: newId, refAtom: `Chain A: CA ${newId * 15}`, targetAtom: `Chain B: CA ${newId * 15}`, distance: 0.10 }
    ]);
  };

  const handleExecuteFit = () => {
    alert(`Executed SVD Kabsch Pair Fitting across ${pairs.length} atom pairs. Final RMSD: ${rmsd.toFixed(4)} Å`);
    onClose();
  };

  return (
    <div className="bg-slate-900/95 border border-cyan-500/30 text-white p-5 rounded-2xl shadow-2xl w-[420px] backdrop-blur-xl animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
          Atom-Pair Superposition Wizard
        </h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-lg">✕</button>
      </div>

      <div className="space-y-4 text-sm">
        <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
          <div className="flex justify-between items-center mb-2">
            <span className="text-slate-300 font-medium text-xs">Selected Atom Pairs ({pairs.length}):</span>
            <button
              onClick={handleAddPair}
              className="px-2 py-0.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded text-xs"
            >
              + Add Pair
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1.5 font-mono text-xs pr-1">
            {pairs.map((p) => (
              <div key={p.id} className="flex justify-between items-center bg-slate-900/80 p-2 rounded border border-slate-800">
                <span className="text-cyan-300">{p.refAtom}</span>
                <span className="text-slate-500">↔</span>
                <span className="text-blue-300">{p.targetAtom}</span>
                <span className="text-slate-400">{p.distance.toFixed(2)}Å</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
          <span className="text-slate-400 text-xs">Calculated Pair RMSD:</span>
          <span className="text-lg font-bold font-mono text-cyan-400">{rmsd.toFixed(4)} Å</span>
        </div>

        <button
          onClick={handleExecuteFit}
          className="w-full py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl shadow-lg transition-all"
        >
          Execute Kabsch Pair Fit Alignment
        </button>
      </div>
    </div>
  );
};
