import { useState } from 'react';

export interface CleaningState {
  bond_tolerance: number;
  altloc_filtered: boolean;
  solvent_stripped: boolean;
  hydrogens_added: boolean;
  ss_mode: 'pdb' | 'quick' | 'dssp';
}

export const defaultCleaningState: CleaningState = {
  bond_tolerance: 1.15,
  altloc_filtered: false,
  solvent_stripped: false,
  hydrogens_added: false,
  ss_mode: 'pdb'
};

export function useProteinPrep() {
  const [cleaningState, setCleaningState] = useState<CleaningState>(defaultCleaningState);

  return {
    cleaningState,
    setCleaningState
  };
}
