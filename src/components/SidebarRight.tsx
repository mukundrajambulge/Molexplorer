import { useEffect, useState } from "react";
import { MoleculeData } from "../types";
import { Info, BarChart2, Library, MousePointer, X, Atom, Dna } from "lucide-react";
import { getRDKit } from "../lib/rdkit";
import { useStore } from "../store";
import { SelectionManager } from "../interaction/SelectionManager";

interface SidebarRightProps {
  molecule: MoleculeData | null;
  library: MoleculeData[];
  onSelectMolecule: (mol: MoleculeData) => void;
}

interface ComputedProperties {
  mw: string;
  logp: string;
  tpsa: string;
  hba: string;
  hbd: string;
  rotatable: string;
  rings: string;
  formula: string;
}

export default function SidebarRight({ molecule, library, onSelectMolecule }: SidebarRightProps) {
  const [props, setProps] = useState<ComputedProperties | null>(null);
  const { molecularSelection, clearSelection } = useStore();

  const selectionSummary = molecularSelection && molecularSelection.atoms.length > 0 
    ? SelectionManager.computeSummary(molecularSelection)
    : null;

  const firstAtom = molecularSelection?.atoms?.[0] || null;

  useEffect(() => {
    if (!molecule || !molecule.rawContent) {
      setProps(null);
      return;
    }

    const computeProps = async () => {
      try {
        const rdkit = await getRDKit();
        let mol;
        if (molecule.format === "mol" || molecule.format === "sdf") {
           mol = rdkit.get_mol(molecule.rawContent);
        } else if (molecule.smiles) {
           mol = rdkit.get_mol(molecule.smiles);
        }

        if (mol) {
          const descriptors = JSON.parse(mol.get_descriptors());
          
          setProps({
            mw: descriptors.amw?.toFixed(2) || "N/A",
            logp: descriptors.CrippenClogP?.toFixed(2) || "N/A",
            tpsa: descriptors.tpsa?.toFixed(2) || "N/A",
            hba: descriptors.NumHBA?.toString() || "N/A",
            hbd: descriptors.NumHBD?.toString() || "N/A",
            rotatable: descriptors.NumRotatableBonds?.toString() || "N/A",
            rings: descriptors.NumRings?.toString() || "N/A",
            formula: mol.get_smiles()
          });

          mol.delete();
        }
      } catch (e) {
        console.error("Error computing properties:", e);
      }
    };
    computeProps();
  }, [molecule]);

  return (
    <div className="w-full h-full p-5 sm:p-6 overflow-y-auto flex flex-col gap-6">
      
      {/* Selected Entity Inspector Panel */}
      {molecularSelection && molecularSelection.atoms.length > 0 && (
        <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/5 backdrop-blur-xl shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] tracking-[0.2em] font-mono uppercase text-cyan-400 font-semibold flex items-center gap-1.5">
              <MousePointer size={12} /> Selected ({molecularSelection.atoms.length})
            </span>
            <button
              onClick={clearSelection}
              className="p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              title="Clear selection"
            >
              <X size={12} />
            </button>
          </div>

          {firstAtom && (
            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between pb-1 border-b border-white/10">
                <span className="text-slate-400">Atom:</span>
                <span className="text-cyan-300 font-bold">{firstAtom.atomName} (#{firstAtom.serial})</span>
              </div>
              <div className="flex items-center justify-between pb-1 border-b border-white/10">
                <span className="text-slate-400">Element:</span>
                <span className="text-white">{firstAtom.element}</span>
              </div>
              <div className="flex items-center justify-between pb-1 border-b border-white/10">
                <span className="text-slate-400">Residue:</span>
                <span className="text-amber-300">{firstAtom.residueName} {firstAtom.residueNumber}</span>
              </div>
              <div className="flex items-center justify-between pb-1 border-b border-white/10">
                <span className="text-slate-400">Chain:</span>
                <span className="text-white">{firstAtom.chainId}</span>
              </div>
              <div className="flex flex-col gap-0.5 pt-1">
                <span className="text-slate-400 text-[10px]">3D Coordinates:</span>
                <span className="text-[11px] text-slate-200">
                  X: {firstAtom.x.toFixed(3)}, Y: {firstAtom.y.toFixed(3)}, Z: {firstAtom.z.toFixed(3)}
                </span>
              </div>
            </div>
          )}

          {selectionSummary && selectionSummary.totalAtoms > 1 && (
            <div className="pt-2 border-t border-white/10 text-[11px] font-mono text-slate-400 space-y-1">
              <div>Level: <span className="text-cyan-300 uppercase">{molecularSelection.level}</span></div>
              {selectionSummary.residues.length > 0 && (
                <div>Residues: <span className="text-white">{selectionSummary.residues.slice(0, 4).join(', ')}{selectionSummary.residues.length > 4 ? '...' : ''}</span></div>
              )}
              {selectionSummary.chains.length > 0 && (
                <div>Chains: <span className="text-white">{selectionSummary.chains.join(', ')}</span></div>
              )}
            </div>
          )}
        </div>
      )}

      <div>
        <h2 className="text-[10px] tracking-[0.3em] uppercase opacity-50 mb-4 flex items-center gap-2">
          <Info size={12} /> Active Molecule
        </h2>
        
        {!molecule ? (
          <div className="text-[11px] font-mono opacity-40 italic">
            Awaiting input data...
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="space-y-4">
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-widest opacity-40 mb-1">Identifier</span>
                <span className="font-mono text-[11px] break-words text-[#F27D26]">{molecule.name}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-widest opacity-40 mb-1">Source Format</span>
                <span className="font-mono text-[11px] uppercase">{molecule.format}</span>
              </div>
            </div>

            {props && (
              <div className="pt-6 border-t border-white/10">
                <h3 className="text-[10px] tracking-[0.3em] uppercase opacity-50 mb-1 flex items-center gap-2">
                  <BarChart2 size={12} /> Computed Metrics
                </h3>
                <p className="text-[9px] font-mono opacity-40 italic mb-5">Predicted, not experimentally validated.</p>
                
                <div className="space-y-4">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="opacity-50 uppercase">Molecular Weight</span>
                      <span className="text-[#F0F0F0]">{props.mw}</span>
                    </div>
                    <div className="h-[2px] bg-white/10 w-full overflow-hidden">
                      <div className="h-full bg-white w-[50%]"></div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="opacity-50 uppercase">cLogP</span>
                      <span className="text-[#F27D26]">{props.logp}</span>
                    </div>
                    <div className="h-[2px] bg-white/10 w-full overflow-hidden">
                      <div className="h-full bg-[#F27D26] w-[60%] shadow-[0_0_10px_rgba(242,125,38,0.5)]"></div>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="opacity-50 uppercase">TPSA</span>
                      <span className="text-[#F0F0F0]">{props.tpsa}</span>
                    </div>
                    <div className="h-[2px] bg-white/10 w-full overflow-hidden">
                      <div className="h-full bg-white w-[40%]"></div>
                    </div>
                  </div>

                  <div className="flex justify-between gap-4 mt-6">
                    <div className="flex-1 space-y-1">
                      <span className="block text-[9px] uppercase tracking-widest opacity-40">Rot. Bonds</span>
                      <span className="text-sm font-mono">{props.rotatable}</span>
                    </div>
                    <div className="flex-1 space-y-1">
                      <span className="block text-[9px] uppercase tracking-widest opacity-40">H-Donors</span>
                      <span className="text-sm font-mono">{props.hbd}</span>
                    </div>
                    <div className="flex-1 space-y-1">
                      <span className="block text-[9px] uppercase tracking-widest opacity-40">H-Accept</span>
                      <span className="text-sm font-mono">{props.hba}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {molecule && (
        <div className="pt-6 border-t border-white/10">
           <h3 className="text-[10px] tracking-[0.3em] uppercase opacity-50 mb-5 flex items-center gap-2">
             <Library size={12} /> Conformers
           </h3>
           <div className="bg-white/5 border border-white/10 p-4 rounded-xl text-[10px] font-mono opacity-60">
             <p className="mb-2 text-[#F27D26] font-bold">Client-Side Limitations</p>
             <p>Multiple 3D conformer generation and relative energy sorting (e.g. via MMFF94/UFF embeddings) require server-side RDKit processing or cloud APIs.</p>
             <p className="mt-2">Use the <span className="text-white">2D Sketcher</span> to simulate a single ETKDG geometry optimization via NCI Cactus.</p>
           </div>
        </div>
      )}

      {library.length === 1 && (
        <div className="pt-6 border-t border-white/10 flex-1 flex flex-col min-h-0">
          <h3 className="text-[10px] tracking-[0.3em] uppercase opacity-50 mb-4 flex items-center gap-2">
            <Library size={12} /> Library ({library.length})
          </h3>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {library.map((mol, idx) => (
              <button 
                key={mol.id}
                onClick={() => onSelectMolecule(mol)}
                className={`w-full text-left px-3 py-2 rounded-lg border text-[10px] font-mono truncate transition-colors ${
                  molecule?.id === mol.id 
                    ? 'bg-[#F27D26]/20 border-[#F27D26]/50 text-[#F27D26]' 
                    : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/20'
                }`}
              >
                {mol.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
