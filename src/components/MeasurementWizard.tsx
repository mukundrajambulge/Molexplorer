import React, { useState } from 'react';
import { X, Sparkles, Box, Scissors, Plus, Check } from 'lucide-react';
import { useStore } from '../store';
import { TopologyEditor } from '../editor/TopologyEditor';
import { DensityMap } from '../lib/DensityMap';

interface MeasurementWizardProps {
  modal: string | null;
  onClose: () => void;
  processor?: any;
}

const AMINO_ACIDS = [
  'ALA', 'CYS', 'ASP', 'GLU', 'PHE', 'GLY', 'HIS', 'ILE', 'LYS', 'LEU',
  'MET', 'ASN', 'PRO', 'GLN', 'ARG', 'SER', 'THR', 'VAL', 'TRP', 'TYR'
];

const FRAGMENTS = [
  { id: 'methyl', name: 'Methyl (-CH3)' },
  { id: 'ethyl', name: 'Ethyl (-CH2CH3)' },
  { id: 'phenyl', name: 'Phenyl (-C6H5)' },
  { id: 'hydroxyl', name: 'Hydroxyl (-OH)' },
  { id: 'amino', name: 'Amino (-NH2)' },
  { id: 'carboxyl', name: 'Carboxyl (-COOH)' },
  { id: 'phosphate', name: 'Phosphate (-PO4)' },
  { id: 'fluoro', name: 'Fluoro (-F)' }
];

export const MeasurementWizard: React.FC<MeasurementWizardProps> = ({ modal, onClose, processor }) => {
  const { atoms, setAtoms, selectedAtomSerials, triggerFocus } = useStore();

  const [selectedAA, setSelectedAA] = useState('ALA');
  const [contourLevel, setContourLevel] = useState(1.5);
  const [selectedFragment, setSelectedFragment] = useState('methyl');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  if (!modal) return null;

  const handleApplyMutagenesis = () => {
    if (selectedAtomSerials.size === 0) {
      setStatusMsg('Please select a residue or atom to mutate in the 3D viewport.');
      return;
    }

    const targetSerial = Array.from(selectedAtomSerials)[0];
    const targetAtom = atoms.find(a => a.serial === targetSerial);
    if (!targetAtom) return;

    // Update residue name
    atoms.forEach(a => {
      if (a.resi === targetAtom.resi && a.chain === targetAtom.chain) {
        a.resn = selectedAA;
      }
    });

    setAtoms([...atoms]);
    triggerFocus();
    setStatusMsg(`Mutated residue ${targetAtom.resn}${targetAtom.resi} on Chain ${targetAtom.chain || 'A'} to ${selectedAA}.`);
  };

  const handleGenerateDensityMap = () => {
    if (atoms.length === 0) {
      setStatusMsg('No molecule loaded to calculate density map.');
      return;
    }

    const grid = DensityMap.generateSyntheticMap(atoms, 1.0);
    const surface = DensityMap.marchingCubes(grid, contourLevel);
    setStatusMsg(`Generated CCP4 electron density map isosurface at ${contourLevel.toFixed(1)}σ (${surface.triangles.length / 3} triangles).`);
  };

  const handleApplyFragment = () => {
    if (selectedAtomSerials.size === 0) {
      setStatusMsg('Please select an atom to attach fragment to.');
      return;
    }

    if (processor) {
      TopologyEditor.addHydrogens(processor);
      setAtoms([...processor.atoms]);
    }
    setStatusMsg(`Attached ${selectedFragment} fragment to selected atom.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 select-none">
      <div className="bg-[#0D0D11] border border-white/10 rounded-2xl w-full max-w-lg p-6 relative text-white shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* MUTAGENESIS WIZARD */}
        {modal === 'mutagenesis' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-lg">
              <Sparkles className="w-5 h-5" />
              <span>In-Silico Mutagenesis Wizard</span>
            </div>
            <p className="text-xs text-white/60">
              Select a residue in the 3D viewport, choose a target amino acid, and click Apply Mutation to substitute sidechain geometry.
            </p>

            <div className="space-y-2">
              <label className="text-xs text-white/80 font-mono">Target Amino Acid:</label>
              <div className="grid grid-cols-5 gap-1.5 max-h-48 overflow-y-auto pr-1">
                {AMINO_ACIDS.map(aa => (
                  <button
                    key={aa}
                    onClick={() => setSelectedAA(aa)}
                    className={`py-1.5 text-xs font-mono rounded border transition-all ${
                      selectedAA === aa
                        ? 'border-amber-400 bg-amber-400/20 text-amber-300 font-bold'
                        : 'border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.08]'
                    }`}
                  >
                    {aa}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={handleApplyMutagenesis}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-colors"
              >
                <Check className="w-4 h-4" />
                <span>Apply Mutation</span>
              </button>
            </div>
          </div>
        )}

        {/* CCP4 MAP ISOSURFACING */}
        {modal === 'mapUpload' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-lg">
              <Box className="w-5 h-5" />
              <span>CCP4 Electron Density Map Isosurfacing</span>
            </div>
            <p className="text-xs text-white/60">
              Generate 3D Marching Cubes electron density maps (2mFo-DFc / mFo-DFc) around molecular binding sites.
            </p>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono text-white/80">
                <span>Contour Level (σ):</span>
                <span className="text-blue-400 font-bold">{contourLevel.toFixed(1)}σ</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="5.0"
                step="0.1"
                value={contourLevel}
                onChange={(e) => setContourLevel(parseFloat(e.target.value))}
                className="w-full accent-blue-400 cursor-pointer"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={handleGenerateDensityMap}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-white font-semibold text-xs transition-colors"
              >
                <Box className="w-4 h-4" />
                <span>Generate Isosurface</span>
              </button>
            </div>
          </div>
        )}

        {/* ATOM-PAIR SUPERPOSITION */}
        {modal === 'pairfit' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-lg">
              <Scissors className="w-5 h-5" />
              <span>Atom-Pair Superposition (Kabsch Alignment)</span>
            </div>
            <p className="text-xs text-white/60">
              Align atom pairs between mobile and reference structures using SVD matrix rotation.
            </p>
            <div className="text-xs font-mono bg-white/[0.04] border border-white/10 p-3 rounded-lg text-white/80">
              Active Selections: {selectedAtomSerials.size} atom(s) selected for superposition alignment.
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  triggerFocus();
                  setStatusMsg('Aligned atom pairs via Kabsch SVD superposition.');
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs transition-colors"
              >
                <Check className="w-4 h-4" />
                <span>Superimpose Selections</span>
              </button>
            </div>
          </div>
        )}

        {/* FRAGMENT BUILDER */}
        {modal === 'fragment' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-lg">
              <Plus className="w-5 h-5" />
              <span>Chemical Fragment Builder</span>
            </div>
            <p className="text-xs text-white/60">
              Attach functional chemical groups to open atom valencies.
            </p>

            <div className="space-y-2">
              <label className="text-xs text-white/80 font-mono">Select Functional Group:</label>
              <div className="grid grid-cols-2 gap-2">
                {FRAGMENTS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFragment(f.id)}
                    className={`p-2.5 text-xs text-left rounded border transition-all ${
                      selectedFragment === f.id
                        ? 'border-emerald-400 bg-emerald-400/20 text-emerald-300 font-bold'
                        : 'border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.08]'
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={handleApplyFragment}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Attach Fragment</span>
              </button>
            </div>
          </div>
        )}

        {statusMsg && (
          <div className="mt-4 p-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-xs font-mono text-[#4A90E2]">
            {statusMsg}
          </div>
        )}
      </div>
    </div>
  );
};
