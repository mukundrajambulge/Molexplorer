import React, { useMemo } from 'react';
import { X, Layers } from 'lucide-react';

interface SequenceViewerProps {
  atoms: any[];
  ssData: any[];
  selectedAtomSerials: Set<number>;
  onSelectResidue: (atomSerials: number[], isToggle: boolean) => void;
  onClose: () => void;
}

const THREE_TO_ONE: Record<string, string> = {
  ALA: 'A', CYS: 'C', ASP: 'D', GLU: 'E', PHE: 'F',
  GLY: 'G', HIS: 'H', ILE: 'I', LYS: 'K', LEU: 'L',
  MET: 'M', ASN: 'N', PRO: 'P', GLN: 'Q', ARG: 'R',
  SER: 'S', THR: 'T', VAL: 'V', TRP: 'W', TYR: 'Y',
  HOH: 'w', WAT: 'w', SOL: 'w'
};

export const SequenceViewer: React.FC<SequenceViewerProps> = ({
  atoms,
  ssData,
  selectedAtomSerials,
  onSelectResidue,
  onClose,
}) => {
  // Group atoms by chain and residue seq number
  const residuesByChain = useMemo(() => {
    const chains: Map<string, Array<{ resSeq: number; resName: string; code: string; atomSerials: number[]; ssType: string }>> = new Map();

    const ssMap = new Map<string, string>();
    (ssData || []).forEach(ss => ssMap.set(`${ss.chainID}:${ss.resi}`, ss.ss_type));

    atoms.forEach(atom => {
      const chain = atom.chainID || atom.chain || 'A';
      const resSeq = atom.resSeq !== undefined ? atom.resSeq : (atom.resi !== undefined ? atom.resi : 1);
      const resName = (atom.resName || atom.resname || 'UNK').toUpperCase();
      const code = THREE_TO_ONE[resName] || (resName.length === 1 ? resName : '?');

      if (!chains.has(chain)) {
        chains.set(chain, []);
      }

      const chainResidues = chains.get(chain)!;
      let res = chainResidues.find(r => r.resSeq === resSeq);

      if (!res) {
        const ssType = ssMap.get(`${chain}:${resSeq}`) || 'loop';
        res = { resSeq, resName, code, atomSerials: [], ssType };
        chainResidues.push(res);
      }
      res.atomSerials.push(atom.serial);
    });

    return Array.from(chains.entries()).map(([chainID, residues]) => ({
      chainID,
      residues: residues.sort((a, b) => a.resSeq - b.resSeq)
    }));
  }, [atoms, ssData]);

  if (residuesByChain.length === 0) return null;

  return (
    <div className="w-full bg-[#0D0D0D]/95 backdrop-blur-xl border-t border-white/10 text-white font-mono text-xs z-30 select-none flex flex-col shadow-2xl">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white/[0.03] border-b border-white/5">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#F27D26] font-semibold">
          <Layers size={14} />
          <span>1D Sequence Viewer Overlay</span>
          <span className="text-white/40 text-[9px]">({atoms.length} Atoms | {residuesByChain.reduce((acc, c) => acc + c.residues.length, 0)} Residues)</span>
        </div>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white transition-colors p-1 rounded hover:bg-white/10"
          title="Close Sequence Viewer"
        >
          <X size={14} />
        </button>
      </div>

      {/* Chain Rows */}
      <div className="max-h-40 overflow-y-auto overflow-x-auto p-3 space-y-3 custom-scrollbar">
        {residuesByChain.map(({ chainID, residues }) => (
          <div key={chainID} className="flex flex-col gap-1">
            <div className="text-[9px] uppercase tracking-widest text-white/50 font-bold flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-white/10 text-[#F27D26]">Chain {chainID}</span>
              <span>{residues.length} residues</span>
            </div>

            <div className="flex items-center gap-0.5 overflow-x-auto py-1">
              {residues.map((res) => {
                const isSelected = res.atomSerials.some(s => selectedAtomSerials.has(s));
                
                let ssBg = 'bg-gray-700/50';
                if (res.ssType === 'helix') ssBg = 'bg-pink-500/30 border-pink-500/50';
                if (res.ssType === 'sheet') ssBg = 'bg-yellow-500/30 border-yellow-500/50';

                return (
                  <button
                    key={`${chainID}-${res.resSeq}`}
                    onClick={(e) => onSelectResidue(res.atomSerials, e.shiftKey || e.ctrlKey || e.metaKey)}
                    title={`Chain ${chainID} | ${res.resName}${res.resSeq} (${res.ssType})`}
                    className={`
                      w-6 h-7 flex flex-col items-center justify-center rounded border transition-all text-[10px] font-mono flex-shrink-0 relative group
                      ${isSelected ? 'bg-[#F27D26] text-black border-[#F27D26] font-bold shadow-lg shadow-[#F27D26]/40 scale-105 z-10' : `${ssBg} text-white/80 hover:border-white/40 hover:bg-white/10`}
                    `}
                  >
                    <span className="leading-none">{res.code}</span>
                    <span className="text-[7px] opacity-60 leading-none">{res.resSeq % 10 === 0 || isSelected ? res.resSeq : ''}</span>
                    
                    {/* Secondary Structure Indicator Bar */}
                    <div className={`w-full h-1 absolute bottom-0 rounded-b ${res.ssType === 'helix' ? 'bg-pink-500' : res.ssType === 'sheet' ? 'bg-yellow-400' : 'bg-gray-600'}`} />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
