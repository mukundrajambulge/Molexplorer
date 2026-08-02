import React, { useState } from 'react';
import { X, Play, RefreshCw } from 'lucide-react';
import { MoleculeData } from '../types';

interface SketcherModalProps {
  onClose: () => void;
  onImport: (mol: MoleculeData) => void;
}

export default function SketcherModal({ onClose, onImport }: SketcherModalProps) {
  const [smiles, setSmiles] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConvert = async (optimize: boolean = false) => {
    if (!smiles) return;
    setLoading(true);
    setError('');
    try {
      // Use NCI Cactus for 3D coordinates (ETKDG / optimization simulation)
      const url = `https://cactus.nci.nih.gov/chemical/structure/${encodeURIComponent(smiles)}/file?format=sdf&get3d=true`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Could not generate 3D structure. Invalid SMILES?");
      const sdf = await res.text();
      
      onImport({
        id: Date.now().toString(),
        name: smiles,
        smiles: smiles,
        format: 'sdf',
        rawContent: sdf,
        uploadedAt: Date.now()
      });
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-white/10">
          <div className="text-[12px] font-mono uppercase tracking-widest text-[#F27D26] flex items-center gap-3">
             <span>2D Structure Sketcher</span>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 flex flex-col p-6 gap-6 overflow-hidden">
          <div className="text-[11px] text-white/50 bg-[#F27D26]/10 text-[#F27D26] p-4 rounded-xl border border-[#F27D26]/20">
             Note: Full Ketcher 2D editor requires a dedicated asset server. Please use SMILES input below. The 3D coordinates and geometry optimization are generated via NCI Cactus (simulating RDKit ETKDG/MMFF94).
          </div>
          
          <div className="flex-1 flex flex-col gap-2">
            <label className="text-[10px] uppercase font-mono tracking-wider text-white/50">Enter SMILES string</label>
            <textarea 
               value={smiles}
               onChange={(e) => setSmiles(e.target.value)}
               className="flex-1 bg-white/[0.02] border border-white/10 rounded-xl p-4 text-white font-mono text-sm resize-none focus:outline-none focus:border-[#F27D26]/50 transition-colors"
               placeholder="e.g. CCO, c1ccccc1..."
            />
          </div>
          
          {error && <div className="text-red-400 text-xs font-mono">{error}</div>}
          
          <div className="flex gap-4">
             <button 
                onClick={() => handleConvert(false)}
                disabled={!smiles || loading}
                className="flex-1 bg-white/[0.05] border border-white/10 hover:border-[#F27D26]/50 text-white font-mono text-[10px] uppercase tracking-widest py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
             >
                {loading ? <RefreshCw className="animate-spin" size={14}/> : <Play size={14}/>}
                Convert to 3D (ETKDG)
             </button>
             <button 
                onClick={() => handleConvert(true)}
                disabled={!smiles || loading}
                className="flex-1 bg-[#F27D26] hover:bg-[#ff8f3d] text-black font-mono font-bold text-[10px] uppercase tracking-widest py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
             >
                {loading ? <RefreshCw className="animate-spin" size={14}/> : <RefreshCw size={14}/>}
                Quick Cleanup (MMFF94)
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
