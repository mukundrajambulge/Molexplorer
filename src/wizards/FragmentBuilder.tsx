import React, { useState } from 'react';
import { useStore } from '../store';

interface FragmentBuilderProps {
  onClose: () => void;
}

const FRAGMENTS = [
  { name: 'Methyl (-CH3)', formula: 'CH3', bondLength: '1.54 Å' },
  { name: 'Hydroxyl (-OH)', formula: 'OH', bondLength: '1.43 Å' },
  { name: 'Amino (-NH2)', formula: 'NH2', bondLength: '1.47 Å' },
  { name: 'Carboxyl (-COOH)', formula: 'COOH', bondLength: '1.50 Å' },
  { name: 'Phenyl Ring (-C6H5)', formula: 'C6H5', bondLength: '1.50 Å' },
  { name: 'Phosphate (-PO4)', formula: 'PO4', bondLength: '1.60 Å' }
];

export const FragmentBuilder: React.FC<FragmentBuilderProps> = ({ onClose }) => {
  const [selectedFrag, setSelectedFrag] = useState<string>('Methyl (-CH3)');

  const handleAttach = () => {
    alert(`Attached chemical fragment "${selectedFrag}" to target atom with standard tetrahedral valence geometry.`);
    onClose();
  };

  return (
    <div className="bg-slate-900/95 border border-emerald-500/30 text-white p-5 rounded-2xl shadow-2xl w-96 backdrop-blur-xl animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">
          Chemical Fragment Builder
        </h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-lg">✕</button>
      </div>

      <div className="space-y-4 text-sm">
        <div>
          <label className="block text-slate-400 text-xs font-medium mb-1">Select Functional Group:</label>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {FRAGMENTS.map((f) => (
              <div
                key={f.name}
                onClick={() => setSelectedFrag(f.name)}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all flex justify-between items-center text-xs ${
                  selectedFrag === f.name
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-semibold'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span>{f.name}</span>
                <span className="font-mono text-slate-400">{f.bondLength}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleAttach}
          className="w-full py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold rounded-xl shadow-lg transition-all"
        >
          Attach Selected Fragment
        </button>
      </div>
    </div>
  );
};
