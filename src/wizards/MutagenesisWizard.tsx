import React, { useState } from 'react';
import { useStore } from '../store';
import { getRotamersForResidue, detectStericClashes, RotamerConformation, StericClashReport } from '../lib/RotamerLibrary';

interface MutagenesisWizardProps {
  onClose: () => void;
}

const AMINO_ACIDS = [
  'ALA', 'ARG', 'ASN', 'ASP', 'CYS', 'GLN', 'GLU', 'GLY', 'HIS', 'ILE',
  'LEU', 'LYS', 'MET', 'PHE', 'PRO', 'SER', 'THR', 'TRP', 'TYR', 'VAL'
];

export const MutagenesisWizard: React.FC<MutagenesisWizardProps> = ({ onClose }) => {
  const { currentMolecule, setMolecule, selectedAtomSerials } = useStore();
  const [targetResidue, setTargetResidue] = useState<string>('Residue 1 (Chain A)');
  const [selectedMutant, setSelectedMutant] = useState<string>('PHE');
  const [rotamerIdx, setRotamerIdx] = useState<number>(0);

  if (!currentMolecule || currentMolecule.atoms.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-700 text-white p-4 rounded-xl shadow-2xl w-96 backdrop-blur-md">
        <h3 className="text-lg font-bold text-amber-400 mb-2">Mutagenesis Wizard</h3>
        <p className="text-sm text-slate-400">Please load a molecule structure first.</p>
        <button onClick={onClose} className="mt-4 px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-sm text-slate-300">Close</button>
      </div>
    );
  }

  const rotamers = getRotamersForResidue(selectedMutant);
  const currentRotamer = rotamers[rotamerIdx] || rotamers[0];

  // Dummy clash detection calculation for UI demonstration
  const dummyMutatedAtoms = currentMolecule.atoms.slice(0, 5);
  const dummySurrounding = currentMolecule.atoms.slice(5, 50);
  const clashReport: StericClashReport = detectStericClashes(dummyMutatedAtoms, dummySurrounding);

  const handleApplyMutation = () => {
    alert(`Mutated ${targetResidue} to ${selectedMutant} (Rotamer ${rotamerIdx + 1}/${rotamers.length})`);
    onClose();
  };

  return (
    <div className="bg-slate-900/95 border border-amber-500/30 text-white p-5 rounded-2xl shadow-2xl w-96 backdrop-blur-xl animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
          In Silico Mutagenesis Wizard
        </h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-lg">✕</button>
      </div>

      <div className="space-y-4 text-sm">
        <div>
          <label className="block text-slate-400 text-xs font-medium mb-1">Target Residue:</label>
          <input
            type="text"
            value={targetResidue}
            onChange={(e) => setTargetResidue(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <label className="block text-slate-400 text-xs font-medium mb-1">Mutate To:</label>
          <select
            value={selectedMutant}
            onChange={(e) => { setSelectedMutant(e.target.value); setRotamerIdx(0); }}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500"
          >
            {AMINO_ACIDS.map((aa) => (
              <option key={aa} value={aa}>{aa}</option>
            ))}
          </select>
        </div>

        <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400">Dunbrack Rotamer ({rotamerIdx + 1}/{rotamers.length}):</span>
            <span className="text-amber-400 font-mono">P = {(currentRotamer.probability * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={rotamers.length - 1}
            value={rotamerIdx}
            onChange={(e) => setRotamerIdx(parseInt(e.target.value))}
            className="w-full accent-amber-500"
          />
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 font-mono mt-2">
            <div>χ₁: {currentRotamer.chi1.toFixed(1)}°</div>
            <div>χ₂: {currentRotamer.chi2.toFixed(1)}°</div>
          </div>
        </div>

        <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Steric Clash Analysis:</span>
            <span className={clashReport.clashCount > 0 ? 'text-rose-400 font-semibold' : 'text-emerald-400 font-semibold'}>
              {clashReport.clashCount} Clashes
            </span>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            VdW Penalty Score: <span className="font-mono text-slate-200">{clashReport.totalPenalty.toFixed(2)}</span>
          </div>
        </div>

        <button
          onClick={handleApplyMutation}
          className="w-full py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold rounded-xl shadow-lg transition-all"
        >
          Apply Point Mutation
        </button>
      </div>
    </div>
  );
};
