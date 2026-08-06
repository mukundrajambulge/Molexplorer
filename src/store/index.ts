import { create } from 'zustand';
import { RenderStyle, MoleculeData, FilterState, TableSortState } from '../types';

export interface Molecule {
  data: string | Uint8Array;
  format: 'pdb' | 'mmtf';
  name?: string;
}

export interface Measurement {
  id: string;
  type: 'distance' | 'angle' | 'dihedral' | 'label';
  atomSerials: number[];
  coordinates: { x: number; y: number; z: number }[];
  value: number;
  label: string;
}

interface MoleculeState {
  molData: Molecule | null;
  processedPDB: string | null;
  atoms: any[];
  selectedAtomSerials: Set<number>;
  ssData: any[];
  // MolExplorer integration
  explorerMolecule: MoleculeData | null;
  explorerCompareMolecule: MoleculeData | null;
  explorerLibrary: MoleculeData[];
  setMolData: (data: Molecule | null) => void;
  setProcessedPDB: (data: string | null) => void;
  setAtoms: (atoms: any[]) => void;
  setSelectedAtomSerials: (serials: Set<number>) => void;
  setSsData: (data: any[]) => void;
  setExplorerMolecule: (mol: MoleculeData | null) => void;
  setExplorerCompareMolecule: (mol: MoleculeData | null) => void;
  setExplorerLibrary: (lib: MoleculeData[]) => void;
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

interface MeasurementState {
  measurements: Measurement[];
  activeMeasurementMode: 'distance' | 'angle' | 'dihedral' | 'label' | null;
  clickedAtomBuffer: { serial: number; x: number; y: number; z: number }[];
  setMeasurementMode: (mode: 'distance' | 'angle' | 'dihedral' | 'label' | null) => void;
  addClickedAtom: (atom: { serial: number; x: number; y: number; z: number }) => void;
  clearClickedAtomBuffer: () => void;
  addMeasurement: (m: Measurement) => void;
  removeMeasurement: (id: string) => void;
  clearMeasurements: () => void;
}

interface BiophysicalState {
  showDipoleArrow: boolean;
  setShowDipoleArrow: (show: boolean) => void;
  ramachandranData: { resName: string; resSeq: number; chainID: string; phi: number; psi: number; region: 'favored' | 'allowed' | 'outlier' }[];
  setRamachandranData: (data: any[]) => void;
  dipoleMoment: { charge: number; magnitude: number; vector: { x: number; y: number; z: number }; com: { x: number; y: number; z: number } } | null;
  setDipoleMoment: (dipole: any | null) => void;
}

interface ExplorerFilterState {
  filters: FilterState;
  sortState: TableSortState;
  setFilters: (filters: FilterState) => void;
  setSortState: (sortState: TableSortState) => void;
}

export const useStore = create<MoleculeState & ViewerState & UIState & MeasurementState & BiophysicalState & ExplorerFilterState>((set) => ({
  // Molecule Slice
  molData: null,
  processedPDB: null,
  atoms: [],
  selectedAtomSerials: new Set(),
  ssData: [],
  explorerMolecule: null,
  explorerCompareMolecule: null,
  explorerLibrary: [],
  setMolData: (data) => set({ molData: data }),
  setProcessedPDB: (data) => set({ processedPDB: data }),
  setAtoms: (atoms) => set({ atoms }),
  setSelectedAtomSerials: (serials) => set({ selectedAtomSerials: serials }),
  setSsData: (ssData) => set({ ssData }),
  setExplorerMolecule: (mol) => set({ explorerMolecule: mol }),
  setExplorerCompareMolecule: (mol) => set({ explorerCompareMolecule: mol }),
  setExplorerLibrary: (lib) => set({ explorerLibrary: lib }),

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

  // Measurement Slice
  measurements: [],
  activeMeasurementMode: null,
  clickedAtomBuffer: [],
  setMeasurementMode: (activeMeasurementMode) => set({ activeMeasurementMode, clickedAtomBuffer: [] }),
  addClickedAtom: (atom) => set((state) => {
    const buffer = [...state.clickedAtomBuffer, atom];
    const mode = state.activeMeasurementMode;
    
    if (mode === 'distance' && buffer.length === 2) {
      const [A, B] = buffer;
      const dx = A.x - B.x;
      const dy = A.y - B.y;
      const dz = A.z - B.z;
      const val = Math.sqrt(dx*dx + dy*dy + dz*dz);
      const newMeasurement: Measurement = {
        id: crypto.randomUUID(),
        type: 'distance',
        atomSerials: [A.serial, B.serial],
        coordinates: [{ x: A.x, y: A.y, z: A.z }, { x: B.x, y: B.y, z: B.z }],
        value: val,
        label: `${val.toFixed(3)} Å`
      };
      return {
        measurements: [...state.measurements, newMeasurement],
        clickedAtomBuffer: []
      };
    }
    
    if (mode === 'angle' && buffer.length === 3) {
      const [A, B, C] = buffer;
      const vA = { x: A.x - B.x, y: A.y - B.y, z: A.z - B.z };
      const vC = { x: C.x - B.x, y: C.y - B.y, z: C.z - B.z };
      const dot = vA.x*vC.x + vA.y*vC.y + vA.z*vC.z;
      const lenA = Math.sqrt(vA.x*vA.x + vA.y*vA.y + vA.z*vA.z);
      const lenC = Math.sqrt(vC.x*vC.x + vC.y*vC.y + vC.z*vC.z);
      let val = 0;
      if (lenA > 0 && lenC > 0) {
        const cosTheta = Math.max(-1, Math.min(1, dot / (lenA * lenC)));
        val = Math.acos(cosTheta) * (180.0 / Math.PI);
      }
      const newMeasurement: Measurement = {
        id: crypto.randomUUID(),
        type: 'angle',
        atomSerials: [A.serial, B.serial, C.serial],
        coordinates: [{ x: A.x, y: A.y, z: A.z }, { x: B.x, y: B.y, z: B.z }, { x: C.x, y: C.y, z: C.z }],
        value: val,
        label: `${val.toFixed(1)}°`
      };
      return {
        measurements: [...state.measurements, newMeasurement],
        clickedAtomBuffer: []
      };
    }
    
    if (mode === 'dihedral' && buffer.length === 4) {
      const [A, B, C, D] = buffer;
      const b1 = { x: B.x - A.x, y: B.y - A.y, z: B.z - A.z };
      const b2 = { x: C.x - B.x, y: C.y - B.y, z: C.z - B.z };
      const b3 = { x: D.x - C.x, y: D.y - C.y, z: D.z - C.z };

      const n1 = {
        x: b1.y*b2.z - b1.z*b2.y,
        y: b1.z*b2.x - b1.x*b2.z,
        z: b1.x*b2.y - b1.y*b2.x
      };
      const n2 = {
        x: b2.y*b3.z - b2.z*b3.y,
        y: b2.z*b3.x - b2.x*b3.z,
        z: b2.x*b3.y - b2.y*b3.x
      };

      const lenB2 = Math.sqrt(b2.x*b2.x + b2.y*b2.y + b2.z*b2.z);
      const m1 = {
        x: n1.y*b2.z - n1.z*b2.y,
        y: n1.z*b2.x - n1.x*b2.z,
        z: n1.x*b2.y - n1.y*b2.x
      };

      const dotN = n1.x*n2.x + n1.y*n2.y + n1.z*n2.z;
      const dotM = lenB2 > 0 ? (m1.x*n2.x + m1.y*n2.y + m1.z*n2.z) / lenB2 : 0;
      const val = Math.atan2(dotM, dotN) * (180.0 / Math.PI);
      const newMeasurement: Measurement = {
        id: crypto.randomUUID(),
        type: 'dihedral',
        atomSerials: [A.serial, B.serial, C.serial, D.serial],
        coordinates: [{ x: A.x, y: A.y, z: A.z }, { x: B.x, y: B.y, z: B.z }, { x: C.x, y: C.y, z: C.z }, { x: D.x, y: D.y, z: D.z }],
        value: val,
        label: `${val.toFixed(1)}°`
      };
      return {
        measurements: [...state.measurements, newMeasurement],
        clickedAtomBuffer: []
      };
    }

    if (mode === 'label' && buffer.length === 1) {
      const [A] = buffer;
      const newMeasurement: Measurement = {
        id: crypto.randomUUID(),
        type: 'label',
        atomSerials: [A.serial],
        coordinates: [{ x: A.x, y: A.y, z: A.z }],
        value: 0,
        label: `Atom ${A.serial}`
      };
      return {
        measurements: [...state.measurements, newMeasurement],
        clickedAtomBuffer: []
      };
    }
    
    return { clickedAtomBuffer: buffer };
  }),
  clearClickedAtomBuffer: () => set({ clickedAtomBuffer: [] }),
  addMeasurement: (m) => set((state) => ({ measurements: [...state.measurements, m] })),
  removeMeasurement: (id) => set((state) => ({ measurements: state.measurements.filter(m => m.id !== id) })),
  clearMeasurements: () => set({ measurements: [], clickedAtomBuffer: [] }),

  // Biophysical Slice
  showDipoleArrow: false,
  setShowDipoleArrow: (showDipoleArrow) => set({ showDipoleArrow }),
  ramachandranData: [],
  setRamachandranData: (ramachandranData) => set({ ramachandranData }),
  dipoleMoment: null,
  setDipoleMoment: (dipoleMoment) => set({ dipoleMoment }),

  // Explorer Filter Slice
  filters: {
    searchQuery: "",
    massRange: [0, 2000],
    logpRange: [-10, 15],
    hbdRange: [0, 20],
    hbaRange: [0, 20],
    tpsaRange: [0, 300],
    rotatableRange: [0, 50],
    maxRo5Violations: null,
    librarySmarts: "",
    visualSmarts: "",
    showStereoCenters: false,
    hiddenElements: [],
  },
  sortState: {
    column: "name",
    direction: "asc"
  },
  setFilters: (filters) => set({ filters }),
  setSortState: (sortState) => set({ sortState })
}));

