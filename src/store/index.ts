import { create } from 'zustand';
import { RenderStyle, MoleculeData, FilterState, TableSortState } from '../types';
import { SelectionLevel, PickedAtom, MolecularSelection, createSelectionKey } from '../interaction/types';

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
  selectionLevel: SelectionLevel;
  molecularSelection: MolecularSelection;
  hoveredAtom: PickedAtom | null;
  ssData: any[];
  // MolExplorer integration
  explorerMolecule: MoleculeData | null;
  explorerCompareMolecule: MoleculeData | null;
  explorerLibrary: MoleculeData[];
  setMolData: (data: Molecule | null) => void;
  setProcessedPDB: (data: string | null) => void;
  setAtoms: (atoms: any[]) => void;
  setSelectedAtomSerials: (serials: Set<number>) => void;
  setSelectionLevel: (level: SelectionLevel) => void;
  setMolecularSelection: (sel: MolecularSelection) => void;
  setHoveredAtom: (atom: PickedAtom | null) => void;
  clearSelection: () => void;
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

export interface ClickedAtomInfo {
  serial: number;
  x: number;
  y: number;
  z: number;
  name?: string;
  resName?: string;
  resSeq?: number;
  chainID?: string;
}

interface MeasurementState {
  measurements: Measurement[];
  activeMeasurementMode: 'distance' | 'angle' | 'dihedral' | 'label' | null;
  clickedAtomBuffer: ClickedAtomInfo[];
  lastMeasurementLog: string | null;
  setMeasurementMode: (mode: 'distance' | 'angle' | 'dihedral' | 'label' | null) => void;
  addClickedAtom: (atom: ClickedAtomInfo) => void;
  clearClickedAtomBuffer: () => void;
  addMeasurement: (m: Measurement) => void;
  removeMeasurement: (id: string) => void;
  clearMeasurements: () => void;
  setLastMeasurementLog: (msg: string | null) => void;
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

function formatAtomDesc(a: ClickedAtomInfo): string {
  const name = (a.name || '').trim() || `#${a.serial}`;
  const res = a.resName ? `${a.resName}${a.resSeq || ''}:${a.chainID || 'A'} ` : '';
  return `[${res}${name} (#${a.serial})]`;
}

export const useStore = create<MoleculeState & ViewerState & UIState & MeasurementState & BiophysicalState & ExplorerFilterState>((set) => ({
  // Molecule Slice
  molData: null,
  processedPDB: null,
  atoms: [],
  selectedAtomSerials: new Set(),
  selectionLevel: 'atom',
  molecularSelection: {
    level: 'atom',
    atoms: [],
    selectedKeys: new Set()
  },
  hoveredAtom: null,
  ssData: [],
  explorerMolecule: null,
  explorerCompareMolecule: null,
  explorerLibrary: [],
  setMolData: (data) => set({ molData: data }),
  setProcessedPDB: (data) => set({ processedPDB: data }),
  setAtoms: (atoms) => set({ atoms }),
  setSelectedAtomSerials: (serials) => set({ selectedAtomSerials: serials }),
  setSelectionLevel: (selectionLevel) => set({ selectionLevel }),
  setMolecularSelection: (molecularSelection) => set({
    molecularSelection,
    selectedAtomSerials: new Set(molecularSelection.atoms.map(a => a.serial))
  }),
  setHoveredAtom: (hoveredAtom) => set({ hoveredAtom }),
  clearSelection: () => set({
    molecularSelection: {
      level: 'atom',
      atoms: [],
      selectedKeys: new Set()
    },
    selectedAtomSerials: new Set()
  }),
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
  lastMeasurementLog: null,
  setLastMeasurementLog: (lastMeasurementLog) => set({ lastMeasurementLog }),
  setMeasurementMode: (activeMeasurementMode) => set({ 
    activeMeasurementMode, 
    clickedAtomBuffer: [],
    lastMeasurementLog: activeMeasurementMode ? `Selected ${activeMeasurementMode.toUpperCase()} mode. Click atoms in 3D viewport.` : null 
  }),
  clearClickedAtomBuffer: () => set({ clickedAtomBuffer: [] }),
  clearMeasurements: () => set({ measurements: [], clickedAtomBuffer: [], lastMeasurementLog: 'Cleared all 3D measurements.' }),
  removeMeasurement: (id) => set((state) => ({ measurements: state.measurements.filter(m => m.id !== id) })),
  addMeasurement: (m) => set((state) => ({ measurements: [...state.measurements, m] })),
  addClickedAtom: (atom) => set((state) => {
    const buffer = [...state.clickedAtomBuffer, atom];
    const mode = state.activeMeasurementMode;
    const atomDesc = formatAtomDesc(atom);
    
    if (mode === 'distance') {
      if (buffer.length === 1) {
        return {
          clickedAtomBuffer: buffer,
          lastMeasurementLog: `Point 1/2 selected: ${atomDesc}. Click 2nd atom to complete distance measurement.`
        };
      }
      if (buffer.length >= 2) {
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
          clickedAtomBuffer: [],
          lastMeasurementLog: `Distance: ${formatAtomDesc(A)} ↔ ${formatAtomDesc(B)} = ${val.toFixed(3)} Å`
        };
      }
    }
    
    if (mode === 'angle') {
      if (buffer.length < 3) {
        return {
          clickedAtomBuffer: buffer,
          lastMeasurementLog: `Point ${buffer.length}/3 selected: ${atomDesc}. Click ${3 - buffer.length} more atom(s) for angle.`
        };
      }
      if (buffer.length >= 3) {
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
          clickedAtomBuffer: [],
          lastMeasurementLog: `Angle: ${formatAtomDesc(A)} — ${formatAtomDesc(B)} (vertex) — ${formatAtomDesc(C)} = ${val.toFixed(1)}°`
        };
      }
    }
    
    if (mode === 'dihedral') {
      if (buffer.length < 4) {
        return {
          clickedAtomBuffer: buffer,
          lastMeasurementLog: `Point ${buffer.length}/4 selected: ${atomDesc}. Click ${4 - buffer.length} more atom(s) for dihedral.`
        };
      }
      if (buffer.length >= 4) {
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
          clickedAtomBuffer: [],
          lastMeasurementLog: `Dihedral Torsion: ${formatAtomDesc(A)}—${formatAtomDesc(B)}—${formatAtomDesc(C)}—${formatAtomDesc(D)} = ${val.toFixed(1)}°`
        };
      }
    }

    if (mode === 'label') {
      const newMeasurement: Measurement = {
        id: crypto.randomUUID(),
        type: 'label',
        atomSerials: [atom.serial],
        coordinates: [{ x: atom.x, y: atom.y, z: atom.z }],
        value: 0,
        label: atomDesc
      };
      return {
        measurements: [...state.measurements, newMeasurement],
        clickedAtomBuffer: [],
        lastMeasurementLog: `Labeled: ${atomDesc}`
      };
    }

    return { clickedAtomBuffer: buffer };
  }),

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

