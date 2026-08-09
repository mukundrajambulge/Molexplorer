import { RenderStyle } from '../types';

export interface MoleculeSessionData {
  data: string;
  format: 'pdb' | 'mmtf';
  name?: string;
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

export interface ViewSessionData {
  renderStyle: RenderStyle;
  colorScheme: string;
  surfaceOpacity: number;
  backgroundColor: string;
  orthographic: boolean;
  stereoMode: 'none' | 'cross-eye' | 'anaglyph';
}

export interface MolStudioSession {
  version: '1.0';
  timestamp: number;
  molecule: MoleculeSessionData | null;
  selectedAtomSerials: number[];
  namedSelections: NamedSelectionSession[];
  measurements: MeasurementSession[];
  biophysical: BiophysicalSessionData;
  viewState: ViewSessionData;
}
