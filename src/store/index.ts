import { create } from 'zustand';
import { RenderStyle } from '../types';

export interface Molecule {
  data: string | Uint8Array;
  format: 'pdb' | 'mmtf';
  name?: string;
}

interface MoleculeState {
  molData: Molecule | null;
  processedPDB: string | null;
  atoms: any[];
  selectedAtomSerials: Set<number>;
  ssData: any[];
  setMolData: (data: Molecule | null) => void;
  setProcessedPDB: (data: string | null) => void;
  setAtoms: (atoms: any[]) => void;
  setSelectedAtomSerials: (serials: Set<number>) => void;
  setSsData: (data: any[]) => void;
}

interface ViewerState {
  renderStyle: RenderStyle;
  colorScheme: string;
  surfaceOpacity: number;
  backgroundColor: string;
  namedSelections: any[];
  focusTrigger: number;
  setRenderStyle: (style: RenderStyle) => void;
  setColorScheme: (scheme: string) => void;
  setSurfaceOpacity: (opacity: number) => void;
  setBackgroundColor: (color: string) => void;
  setNamedSelections: (selections: any[]) => void;
  triggerFocus: () => void;
}

interface UIState {
  isMobileSidebarOpen: boolean;
  activeWorkspace: string;
  setIsMobileSidebarOpen: (isOpen: boolean) => void;
  setActiveWorkspace: (workspace: string) => void;
}

export const useStore = create<MoleculeState & ViewerState & UIState>((set) => ({
  // Molecule Slice
  molData: null,
  processedPDB: null,
  atoms: [],
  selectedAtomSerials: new Set(),
  ssData: [],
  setMolData: (data) => set({ molData: data }),
  setProcessedPDB: (data) => set({ processedPDB: data }),
  setAtoms: (atoms) => set({ atoms }),
  setSelectedAtomSerials: (serials) => set({ selectedAtomSerials: serials }),
  setSsData: (ssData) => set({ ssData }),

  // Viewer Slice
  renderStyle: 'Cartoon',
  colorScheme: 'spectrum',
  surfaceOpacity: 0.7,
  backgroundColor: '#f0f0f0',
  namedSelections: [],
  focusTrigger: 0,
  setRenderStyle: (renderStyle) => set({ renderStyle }),
  setColorScheme: (colorScheme) => set({ colorScheme }),
  setSurfaceOpacity: (surfaceOpacity) => set({ surfaceOpacity }),
  setBackgroundColor: (backgroundColor) => set({ backgroundColor }),
  setNamedSelections: (namedSelections) => set({ namedSelections }),
  triggerFocus: () => set((state) => ({ focusTrigger: state.focusTrigger + 1 })),

  // UI Slice
  isMobileSidebarOpen: false,
  activeWorkspace: 'studio',
  setIsMobileSidebarOpen: (isOpen) => set({ isMobileSidebarOpen: isOpen }),
  setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),
}));
