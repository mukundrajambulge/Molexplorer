export interface NamedSelection {
  name: string;
  query: string;
  atomIds: number[];
}

export type SortColumn = "name" | "amw" | "logp" | "tpsa" | "hbd" | "hba" | "rotatable" | "ro5" | "date" | "similarity";
export type SortDirection = "asc" | "desc";

export type MeasureMode = "none" | "info" | "distance" | "angle" | "dihedral";

export interface Measurement {
  id: string;
  name: string;
  type: "distance" | "angle" | "dihedral";
  atoms: number[]; // RDKit / 3Dmol indices
  value: number;
}

export interface TableSortState {
  column: SortColumn;
  direction: SortDirection;
  referenceMoleculeId?: string; // For similarity sorting
}

export interface MoleculeData {
  id: string;
  name: string;
  smiles: string;
  inchikey?: string;
  formula?: string;
  molecular_weight?: number;
  format: string; // source_format
  rawContent: string | Uint8Array;
  uploadedAt: number; // uploaded_at
  library_id?: string;
  
  // Joined properties (from properties table or RDKit descriptors)
  properties?: {
    logp?: number;
    tpsa?: number;
    hbd?: number;
    hba?: number;
    rotatable_bonds?: number;
    lipinski_violations?: number;
    computed_at?: number;
    // Fallback for RDKit raw properties
    [key: string]: any;
  };
  
  fingerprint?: number[]; // indices of 1s in Morgan FP
  warnings?: string[]; // parser warnings
}

export interface LibraryData {
  id: string;
  name: string;
  source_filename: string;
  uploaded_at: number;
  molecule_count: number;
}

export interface SavedView {
  id: string;
  molecule_id: string;
  render_style: RenderStyle;
  color_scheme: ColorTheme;
  filters_json: string;
  measurements_json: string;
  created_at: number;
}

export interface EditHistory {
  id: string;
  molecule_id: string;
  action_type: string;
  payload_json: string;
  created_at: number;
}


export interface FilterState {
  // Library filters
  searchQuery: string;
  massRange: [number, number];
  logpRange: [number, number];
  hbdRange: [number, number];
  hbaRange: [number, number];
  tpsaRange: [number, number];
  rotatableRange: [number, number];
  maxRo5Violations: number | null; // e.g. 0, 1
  librarySmarts: string; // for searching the library by substructure

  // Visual filters
  visualSmarts: string;
  showStereoCenters: boolean;
  hiddenElements: string[];
}


export type RenderStyle = 
  | "Line" 
  | "Stick" 
  | "Ball-and-Stick" 
  | "Space-Filling" 
  | "Van der Waals Surface" 
  | "Solvent-Accessible Surface" 
  | "Solvent-Excluded Surface" 
  | "Mesh" 
  | "Dots" 
  | "Non-bonded (small spheres)"
  | "Dot Surface" 
  | "Cartoon";

export type ColorTheme = 
  | "Classic CPK" 
  | "Modern/Jmol" 
  | "By Molecule" 
  | "By Formal Charge" 
  | "By Partial Charge" 
  | "ESP" 
  | "Hydrophobicity" 
  | "Rainbow" 
  | "Monochrome" 
  | "SMARTS" 
  | "Colourblind-safe";

export type ElectronCloudMode = "None" | "Illustrative Approximation" | "Computed Density (Demo)";

export interface ViewState {
  renderStyle: RenderStyle;
  colorTheme: ColorTheme;
  showHydrogens: boolean;
  showLabels: boolean;
  surfaceOpacity: number;
  canvasBackground: "black" | "white" | "#f5f5f5";
  electronCloudMode: ElectronCloudMode;
  performanceMode: boolean;
}
