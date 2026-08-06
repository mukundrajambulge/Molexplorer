import React from "react";
import { X } from "lucide-react";
import { useStore } from "../../store";

export interface BiophysicalValidationProps {
  onClose: () => void;
  centerSelection: (sel: any) => void;
}

export function BiophysicalValidation({ onClose, centerSelection }: BiophysicalValidationProps) {
  const {
    atoms,
    setSelectedAtomSerials,
    dipoleMoment,
    showDipoleArrow,
    setShowDipoleArrow,
    ramachandranData
  } = useStore();

  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-[#0B0B0C]/95 border-l border-white/10 z-20 shadow-2xl backdrop-blur-xl flex flex-col p-4 text-white overflow-hidden pointer-events-auto">
      <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-4">
        <h3 className="text-xs uppercase tracking-wider font-bold text-white/80">Biophysical Validation</h3>
        <button onClick={onClose} className="text-white/40 hover:text-white transition-all">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-5">
        {/* 1. Dipole Moment Card */}
        {dipoleMoment && (
          <div className="bg-[#141416] p-3.5 rounded-xl border border-white/5 flex flex-col gap-2.5">
            <h4 className="text-[10px] uppercase font-bold text-white/30 tracking-widest flex items-center justify-between">
              <span>Molecular Dipole Moment</span>
              <input 
                type="checkbox" 
                checked={showDipoleArrow}
                onChange={(e) => setShowDipoleArrow(e.target.checked)}
                className="rounded border-white/10 text-[#4A90E2] focus:ring-0 bg-transparent cursor-pointer w-3.5 h-3.5"
              />
            </h4>
            
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-white/50">Vector Magnitude:</span>
              <strong className="text-sm font-mono text-cyan-400">{dipoleMoment.magnitude.toFixed(2)} D</strong>
            </div>

            <div className="flex items-center justify-between text-[10px] border-t border-white/[0.03] pt-2">
              <span className="text-white/40">Net Charge:</span>
              <span className="font-mono text-white/80">{dipoleMoment.charge.toFixed(2)} e</span>
            </div>

            <div className="flex flex-col gap-1 text-[10px] border-t border-white/[0.03] pt-2">
              <span className="text-white/40 mb-0.5">Dipole Vector (Debye):</span>
              <div className="grid grid-cols-3 gap-1 text-center font-mono">
                <div className="bg-black/30 p-1 rounded border border-white/[0.02]">
                  <span className="text-[8px] text-white/30 block">X</span>
                  <span className="text-[9px] text-cyan-400/90">{dipoleMoment.vector.x.toFixed(2)}</span>
                </div>
                <div className="bg-black/30 p-1 rounded border border-white/[0.02]">
                  <span className="text-[8px] text-white/30 block">Y</span>
                  <span className="text-[9px] text-cyan-400/90">{dipoleMoment.vector.y.toFixed(2)}</span>
                </div>
                <div className="bg-black/30 p-1 rounded border border-white/[0.02]">
                  <span className="text-[8px] text-white/30 block">Z</span>
                  <span className="text-[9px] text-cyan-400/90">{dipoleMoment.vector.z.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. Ramachandran Plot Card */}
        {ramachandranData.length > 0 && (
          <div className="bg-[#141416] p-3.5 rounded-xl border border-white/5 flex flex-col gap-3">
            <h4 className="text-[10px] uppercase font-bold text-white/30 tracking-widest">
              Ramachandran Validation
            </h4>
            
            {/* SVG 2D Scatter Chart */}
            <div className="relative mx-auto bg-black/40 border border-white/5 rounded-lg overflow-hidden w-[200px] h-[200px]">
              <svg width="200" height="200" viewBox="0 0 200 200" className="absolute inset-0">
                <rect x="44.4" y="105.5" width="38.9" height="33.3" fill="rgba(255, 255, 255, 0.03)" stroke="rgba(255, 255, 255, 0.06)" strokeWidth="0.5" />
                <rect x="11.1" y="0" width="61.1" height="50" fill="rgba(255, 255, 255, 0.03)" stroke="rgba(255, 255, 255, 0.06)" strokeWidth="0.5" />
                
                <line x1="100" y1="0" x2="100" y2="200" stroke="rgba(255,255,255,0.08)" strokeDasharray="2,2" />
                <line x1="0" y1="100" x2="200" y2="100" stroke="rgba(255,255,255,0.08)" strokeDasharray="2,2" />
                
                {ramachandranData.map((d, idx) => {
                  const x = ((d.phi + 180) / 360) * 200;
                  const y = 200 - ((d.psi + 180) / 360) * 200;
                  const color = d.region === 'outlier' ? '#ef4444' : d.region === 'allowed' ? '#f59e0b' : '#10b981';
                  const r = d.region === 'outlier' ? 3.5 : 2.5;
                  
                  return (
                    <circle
                      key={idx}
                      cx={x}
                      cy={y}
                      r={r}
                      fill={color}
                      className="cursor-pointer hover:stroke-white hover:stroke-[1.5] transition-all"
                      onClick={() => {
                        const ca = atoms.find(a => a.chainID === d.chainID && a.resSeq === d.resSeq && a.name === 'CA');
                        if (ca) {
                          setSelectedAtomSerials(new Set([ca.serial]));
                          centerSelection({ serial: [ca.serial] });
                        }
                      }}
                    >
                      <title>{`${d.resName}-${d.resSeq} (${d.chainID}): Phi=${d.phi.toFixed(1)}°, Psi=${d.psi.toFixed(1)}° [${d.region}]`}</title>
                    </circle>
                  );
                })}
              </svg>
            </div>

            <div className="flex items-center justify-center gap-4 text-[9px] font-mono">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" /> Favored</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" /> Allowed</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" /> Outlier</span>
            </div>

            <div className="flex flex-col gap-1.5 text-[10px] border-t border-white/5 pt-2 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-white/40">Favored Region:</span>
                <span className="text-emerald-400 font-bold">
                  {((ramachandranData.filter(d=>d.region==='favored').length / ramachandranData.length)*100).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/40">Allowed Region:</span>
                <span className="text-amber-400 font-bold">
                  {((ramachandranData.filter(d=>d.region==='allowed').length / ramachandranData.length)*100).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/40">Steric Outliers:</span>
                <span className="text-rose-400 font-bold">
                  {((ramachandranData.filter(d=>d.region==='outlier').length / ramachandranData.length)*100).toFixed(1)}%
                </span>
              </div>
            </div>

            {ramachandranData.some(d => d.region === 'outlier') && (
              <div className="border-t border-white/5 pt-2 flex flex-col gap-1 max-h-[120px] overflow-y-auto pr-1">
                <span className="text-[9px] uppercase font-bold text-rose-400 tracking-wider">Outliers:</span>
                {ramachandranData.filter(d => d.region === 'outlier').map((d, idx) => (
                  <div 
                    key={idx}
                    onClick={() => {
                      const ca = atoms.find(a => a.chainID === d.chainID && a.resSeq === d.resSeq && a.name === 'CA');
                      if (ca) {
                        setSelectedAtomSerials(new Set([ca.serial]));
                        centerSelection({ serial: [ca.serial] });
                      }
                    }}
                    className="bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 p-1 rounded text-[9px] font-mono flex items-center justify-between cursor-pointer transition-all"
                  >
                    <span className="text-rose-300">/{d.chainID}/{d.resSeq}/{d.resName}</span>
                    <span className="text-white/50">{d.phi.toFixed(0)}°, {d.psi.toFixed(0)}°</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
