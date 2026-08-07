import { useState, useCallback } from 'react';

export interface ChainInfo {
  chainID: string;
  type: 'protein' | 'nucleic' | 'ligand' | 'ion' | 'water' | 'other';
  atomCount: number;
  residueCount: number;
  residueTypes: string[];
  visible: boolean;
}

export interface ComponentVisibility {
  showProtein: boolean;
  showNucleic: boolean;
  showLigands: boolean;
  showCofactors: boolean;
  showIons: boolean;
  showWater: boolean;
}

export interface AssemblyState {
  active_assembly_id: string | null;
  generated_assembly_chains: string[];
  symmetry_mates_generated: boolean;
  symmetry_mate_count: number;
}

export function useAssembly() {
  const [assemblyState, setAssemblyState] = useState<AssemblyState>({
    active_assembly_id: null,
    generated_assembly_chains: [],
    symmetry_mates_generated: false,
    symmetry_mate_count: 0
  });

  const [availableAssemblies, setAvailableAssemblies] = useState<{id: string, isIdentityOnly: boolean}[]>([]);
  const [hasSymmetryInfo, setHasSymmetryInfo] = useState(false);
  const [assemblyPDB, setAssemblyPDB] = useState<string | null>(null);
  const [symmetryPDB, setSymmetryPDB] = useState<string | null>(null);

  // Generic N-Chain & Component Filter State
  const [chains, setChains] = useState<ChainInfo[]>([]);
  const [selectedChainIDs, setSelectedChainIDs] = useState<Set<string>>(new Set());
  const [isolatedChainIDs, setIsolatedChainIDs] = useState<Set<string> | null>(null);
  
  const [componentFilters, setComponentFilters] = useState<ComponentVisibility>({
    showProtein: true,
    showNucleic: true,
    showLigands: true,
    showCofactors: true,
    showIons: true,
    showWater: true,
  });

  const toggleChainVisibility = useCallback((chainID: string) => {
    setChains(prev => prev.map(c => c.chainID === chainID ? { ...c, visible: !c.visible } : c));
  }, []);

  const toggleChainSelection = useCallback((chainID: string) => {
    setSelectedChainIDs(prev => {
      const next = new Set(prev);
      if (next.has(chainID)) next.delete(chainID);
      else next.add(chainID);
      return next;
    });
  }, []);

  const isolateSelectedChains = useCallback(() => {
    if (selectedChainIDs.size === 0) return;
    setIsolatedChainIDs(new Set(selectedChainIDs));
    setChains(prev => prev.map(c => ({ ...c, visible: selectedChainIDs.has(c.chainID) })));
  }, [selectedChainIDs]);

  const restoreAllChains = useCallback(() => {
    setIsolatedChainIDs(null);
    setChains(prev => prev.map(c => ({ ...c, visible: true })));
  }, []);

  const toggleComponentFilter = useCallback((key: keyof ComponentVisibility) => {
    setComponentFilters(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  return {
    assemblyState, setAssemblyState,
    availableAssemblies, setAvailableAssemblies,
    hasSymmetryInfo, setHasSymmetryInfo,
    assemblyPDB, setAssemblyPDB,
    symmetryPDB, setSymmetryPDB,

    // Generic N-Chain & Component API
    chains, setChains,
    selectedChainIDs, setSelectedChainIDs,
    isolatedChainIDs, setIsolatedChainIDs,
    componentFilters, setComponentFilters,
    toggleChainVisibility,
    toggleChainSelection,
    isolateSelectedChains,
    restoreAllChains,
    toggleComponentFilter
  };
}

