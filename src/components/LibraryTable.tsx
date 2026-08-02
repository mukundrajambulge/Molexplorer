import React from 'react';
import { MoleculeData, TableSortState, SortColumn, SortDirection } from "../types";
import { ArrowUp, ArrowDown, ChevronUp, ChevronDown } from "lucide-react";

interface LibraryTableProps {
  library: MoleculeData[];
  selectedMoleculeId: string | undefined;
  compareMoleculeId?: string | undefined;
  onSelectMolecule: (mol: MoleculeData) => void;
  onCompareMolecule?: (mol: MoleculeData | null) => void;
  sortState: TableSortState;
  setSortState: React.Dispatch<React.SetStateAction<TableSortState>>;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

function computeTanimoto(fp1?: number[], fp2?: number[]) {
  if (!fp1 || !fp2) return 0;
  let common = 0;
  let i = 0, j = 0;
  while (i < fp1.length && j < fp2.length) {
    if (fp1[i] === fp2[j]) { common++; i++; j++; }
    else if (fp1[i] < fp2[j]) i++;
    else j++;
  }
  return common / (fp1.length + fp2.length - common);
}

export default function LibraryTable({ library, selectedMoleculeId, compareMoleculeId, onSelectMolecule, onCompareMolecule, sortState, setSortState, isCollapsed = false, onToggleCollapse }: LibraryTableProps) {
  const refMol = sortState.referenceMoleculeId 
    ? library.find(m => m.id === sortState.referenceMoleculeId) 
    : undefined;

  const sortedLibrary = [...library].sort((a, b) => {
    let valA: any = 0;
    let valB: any = 0;
    
    switch (sortState.column) {
      case "name": valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); break;
      case "amw": valA = a.properties?.amw || 0; valB = b.properties?.amw || 0; break;
      case "logp": valA = a.properties?.CrippenClogP || 0; valB = b.properties?.CrippenClogP || 0; break;
      case "tpsa": valA = a.properties?.tpsa || 0; valB = b.properties?.tpsa || 0; break;
      case "hbd": valA = a.properties?.NumHDonors || 0; valB = b.properties?.NumHDonors || 0; break;
      case "hba": valA = a.properties?.NumHAcceptors || 0; valB = b.properties?.NumHAcceptors || 0; break;
      case "rotatable": valA = a.properties?.NumRotatableBonds || 0; valB = b.properties?.NumRotatableBonds || 0; break;
      case "ro5": valA = a.properties?.ro5Violations || 0; valB = b.properties?.ro5Violations || 0; break;
      case "date": valA = a.uploadedAt; valB = b.uploadedAt; break;
      case "similarity": 
        valA = computeTanimoto(a.fingerprint, refMol?.fingerprint);
        valB = computeTanimoto(b.fingerprint, refMol?.fingerprint);
        break;
    }

    if (valA < valB) return sortState.direction === "asc" ? -1 : 1;
    if (valA > valB) return sortState.direction === "asc" ? 1 : -1;
    return 0;
  });

  const handleSort = (col: SortColumn) => {
    setSortState(prev => ({
      ...prev,
      column: col,
      direction: prev.column === col && prev.direction === "asc" ? "desc" : "asc"
    }));
  };

  const SortIcon = ({ col }: { col: SortColumn }) => {
    if (sortState.column !== col) return <span className="opacity-0 w-3 inline-block"></span>;
    return sortState.direction === "asc" ? <ArrowUp size={12} className="inline ml-1" /> : <ArrowDown size={12} className="inline ml-1" />;
  };

  return (
    <div className={`border-t border-white/10 bg-[#0A0A0A] flex flex-col z-20 transition-all duration-300 overflow-hidden ${isCollapsed ? 'h-10' : 'h-64 sm:h-72'}`}>
      <div 
        onClick={onToggleCollapse}
        className="h-10 px-4 sm:px-6 flex items-center justify-between border-b border-white/5 bg-[#111] cursor-pointer hover:bg-white/[0.02] transition-colors flex-shrink-0 select-none"
      >
        <div className="text-[9px] font-mono tracking-widest uppercase text-[#F27D26] font-semibold flex items-center gap-2">
          <span>PROJECT TABLE</span>
          <span className="opacity-40 text-white">({library.length} Compounds)</span>
        </div>
        <button className="text-[9px] font-mono tracking-widest text-white/40 hover:text-white uppercase flex items-center gap-1.5 font-semibold">
          {isCollapsed ? "Expand" : "Collapse"}
          {isCollapsed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {!isCollapsed && (
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-[11px] font-mono whitespace-nowrap">
            <thead className="sticky top-0 bg-[#111] z-10 text-[#F0F0F0]/60 uppercase tracking-wider text-[9px]">
              <tr>
                <th className="px-4 py-2 font-normal cursor-pointer hover:text-white transition-colors" onClick={() => handleSort("name")}>Name <SortIcon col="name" /></th>
                <th className="px-4 py-2 font-normal cursor-pointer hover:text-white transition-colors" onClick={() => handleSort("amw")}>MW <SortIcon col="amw" /></th>
                <th className="px-4 py-2 font-normal cursor-pointer hover:text-white transition-colors" onClick={() => handleSort("logp")}>cLogP <SortIcon col="logp" /></th>
                <th className="px-4 py-2 font-normal cursor-pointer hover:text-white transition-colors" onClick={() => handleSort("tpsa")}>TPSA <SortIcon col="tpsa" /></th>
                <th className="px-4 py-2 font-normal cursor-pointer hover:text-white transition-colors" onClick={() => handleSort("hbd")}>HBD <SortIcon col="hbd" /></th>
                <th className="px-4 py-2 font-normal cursor-pointer hover:text-white transition-colors" onClick={() => handleSort("hba")}>HBA <SortIcon col="hba" /></th>
                <th className="px-4 py-2 font-normal cursor-pointer hover:text-white transition-colors" onClick={() => handleSort("rotatable")}>Rotatable <SortIcon col="rotatable" /></th>
                <th className="px-4 py-2 font-normal cursor-pointer hover:text-white transition-colors" onClick={() => handleSort("ro5")}>Ro5 Viol. <SortIcon col="ro5" /></th>
                <th className="px-4 py-2 font-normal cursor-pointer hover:text-white transition-colors" onClick={() => handleSort("similarity")}>Similarity <SortIcon col="similarity" /></th>
              </tr>
            </thead>
            <tbody>
              {sortedLibrary.map((mol, idx) => {
                const p = mol.properties || {};
                const isSelected = mol.id === selectedMoleculeId;
                const sim = refMol ? computeTanimoto(mol.fingerprint, refMol.fingerprint).toFixed(2) : '-';
                
                return (
                  <tr 
                    key={mol.id} 
                    onClick={() => onSelectMolecule(mol)}
                    className={`cursor-pointer border-b border-white/5 transition-colors group ${isSelected ? 'bg-[#F27D26]/10 text-[#F27D26]' : 'hover:bg-white/[0.03] text-white/90'}`}
                  >
                    <td className="px-4 py-2 max-w-[150px] truncate" title={mol.name}>{mol.name}</td>
                    <td className="px-4 py-2">{p.amw ? p.amw.toFixed(1) : '-'}</td>
                    <td className="px-4 py-2">{p.CrippenClogP ? p.CrippenClogP.toFixed(2) : '-'}</td>
                    <td className="px-4 py-2">{p.tpsa ? p.tpsa.toFixed(1) : '-'}</td>
                    <td className="px-4 py-2">{p.NumHDonors !== undefined ? p.NumHDonors : '-'}</td>
                    <td className="px-4 py-2">{p.NumHAcceptors !== undefined ? p.NumHAcceptors : '-'}</td>
                    <td className="px-4 py-2">{p.NumRotatableBonds !== undefined ? p.NumRotatableBonds : '-'}</td>
                    <td className="px-4 py-2">{p.ro5Violations !== undefined ? p.ro5Violations : '-'}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        {sim}
                        {sortState.referenceMoleculeId === mol.id && <span className="text-[8px] bg-white/10 px-1 py-0.5 rounded uppercase tracking-wider text-white">Ref</span>}
                        {sortState.referenceMoleculeId !== mol.id && (
                          <button 
                            className="opacity-0 group-hover:opacity-100 hover:text-[#F27D26] hover:bg-white/10 transition-all text-[9px] uppercase tracking-wider bg-white/5 px-1 py-0.5 rounded"
                            onClick={(e) => { e.stopPropagation(); setSortState(prev => ({...prev, referenceMoleculeId: mol.id, column: "similarity", direction: "desc"})); }}
                            title="Set as reference for similarity search"
                          >
                            Set Ref
                          </button>
                        )}
                        {!isSelected && onCompareMolecule && (
                          <button 
                            className={`transition-all text-[9px] uppercase tracking-wider px-1 py-0.5 rounded ${compareMoleculeId === mol.id ? 'opacity-100 bg-[#F27D26] text-black font-bold' : 'opacity-0 group-hover:opacity-100 hover:text-white hover:bg-white/10 bg-white/5'}`}
                            onClick={(e) => { e.stopPropagation(); onCompareMolecule(compareMoleculeId === mol.id ? null : mol); }}
                            title="Overlay with active molecule"
                          >
                            {compareMoleculeId === mol.id ? 'Comparing' : 'Compare'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
