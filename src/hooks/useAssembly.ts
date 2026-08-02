import { useState } from 'react';

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

  return {
    assemblyState, setAssemblyState,
    availableAssemblies, setAvailableAssemblies,
    hasSymmetryInfo, setHasSymmetryInfo,
    assemblyPDB, setAssemblyPDB,
    symmetryPDB, setSymmetryPDB
  };
}
