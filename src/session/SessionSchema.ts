import { RenderStyle } from '../types';
import { SelectionLevel } from '../interaction/types';

export interface PSEApplicationMeta {
  name: string;
  module: string;
}

export interface MoleculeSessionItem {
  id: string;
  name: string;
  format: 'pdb' | 'mmtf' | 'sdf';
  data: string;
  atomCount?: number;
  visible?: boolean;
  style?: RenderStyle;
  colorScheme?: string;
}

export interface NamedSelectionSession {
  name: string;
  query: string;
  atomIds: number[];
}

export interface MeasurementSession {
  id: string;
  type: 'distance' | 'angle' | 'dihedral' | 'label';
  atomSerials: number[];
  coordinates: { x: number; y: number; z: number }[];
  value: number;
  label: string;
}

export interface BiophysicalSessionData {
  showDipoleArrow: boolean;
  ramachandranData?: any[];
  dipoleMoment?: any;
}

export interface CameraSessionState {
  viewMatrix?: any;
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  zoom?: number;
}

export interface SelectionSessionState {
  selectionLevel: SelectionLevel;
  selectedAtomSerials: number[];
  namedSelections: NamedSelectionSession[];
  lastSelectionQuery?: string;
}

export interface ViewerSessionData {
  renderStyle: RenderStyle;
  colorScheme: string;
  surfaceOpacity: number;
  backgroundColor: string;
  orthographic: boolean;
  stereoMode: 'none' | 'cross-eye' | 'anaglyph';
  hiddenObjectIds?: string[];
  camera?: CameraSessionState;
}

export interface MolStudioPSESession {
  format: 'MolStudio-PSE';
  version: 1;
  createdAt: string;
  application: PSEApplicationMeta;
  molecules: MoleculeSessionItem[];
  viewerState: ViewerSessionData;
  selectionState: SelectionSessionState;
  measurements: MeasurementSession[];
  biophysical: BiophysicalSessionData;
  metadata?: Record<string, any>;
}

// Backward compatibility legacy session interface
export interface LegacyMolStudioSession {
  version?: string | number;
  timestamp?: number;
  name?: string;
  atomCount?: number;
  pdbContent?: string;
  molecule?: {
    data: string;
    format: 'pdb' | 'mmtf' | 'sdf';
    name?: string;
  } | null;
  selectedAtomSerials?: number[];
  namedSelections?: NamedSelectionSession[];
  measurements?: MeasurementSession[];
  biophysical?: BiophysicalSessionData;
  viewState?: Partial<ViewerSessionData>;
  renderStyle?: RenderStyle;
  colorScheme?: string;
  surfaceOpacity?: number;
  backgroundColor?: string;
  ssData?: any[];
}
