import { 
  MolStudioPSESession, 
  MoleculeSessionItem, 
  ViewerSessionData, 
  SelectionSessionState, 
  MeasurementSession, 
  BiophysicalSessionData,
  LegacyMolStudioSession 
} from './SessionSchema';

export const CURRENT_PSE_FORMAT = 'MolStudio-PSE';
export const CURRENT_PSE_VERSION = 1;

export class SessionManager {
  /**
   * Constructs a versioned MolStudioPSESession object.
   */
  public static createSession(params: {
    molecules: MoleculeSessionItem[];
    viewerState: ViewerSessionData;
    selectionState: SelectionSessionState;
    measurements?: MeasurementSession[];
    biophysical?: BiophysicalSessionData;
    metadata?: Record<string, any>;
  }): MolStudioPSESession {
    return {
      format: CURRENT_PSE_FORMAT,
      version: CURRENT_PSE_VERSION,
      createdAt: new Date().toISOString(),
      application: {
        name: 'Molexplorer',
        module: 'MolStudio'
      },
      molecules: params.molecules,
      viewerState: params.viewerState,
      selectionState: params.selectionState,
      measurements: params.measurements || [],
      biophysical: params.biophysical || { showDipoleArrow: false },
      metadata: params.metadata || {}
    };
  }

  /**
   * Serialize session object to formatted JSON string
   */
  public static exportSession(session: MolStudioPSESession): string {
    return JSON.stringify(session, null, 2);
  }

  /**
   * Parse and validate session file string (.pse or legacy .json).
   * Throws descriptive validation errors if the file is empty, malformed, or corrupted.
   */
  public static importSession(fileContent: string): MolStudioPSESession {
    if (!fileContent || typeof fileContent !== 'string' || fileContent.trim().length === 0) {
      throw new Error('Unable to load session: File is empty.');
    }

    let raw: any;
    try {
      raw = JSON.parse(fileContent);
    } catch (err: any) {
      throw new Error('Unable to load session: Malformed JSON content.');
    }

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('Unable to load session: Invalid session payload.');
    }

    // 1. Official MolStudio-PSE format validation
    if (raw.format === CURRENT_PSE_FORMAT) {
      if (typeof raw.version !== 'number' || raw.version > CURRENT_PSE_VERSION || raw.version < 1) {
        throw new Error(`Unable to load session: Unsupported MolStudio-PSE version (${raw.version}).`);
      }

      if (!Array.isArray(raw.molecules) || raw.molecules.length === 0) {
        throw new Error('Unable to load session: Missing molecular structure data.');
      }

      const validMolecules = raw.molecules.filter(
        (m: any) => m && typeof m.data === 'string' && m.data.trim().length > 0
      );

      if (validMolecules.length === 0) {
        throw new Error('Unable to load session: Missing molecular structure data.');
      }

      const viewerState: ViewerSessionData = {
        renderStyle: raw.viewerState?.renderStyle || 'Cartoon',
        colorScheme: raw.viewerState?.colorScheme || 'spectrum',
        surfaceOpacity: typeof raw.viewerState?.surfaceOpacity === 'number' ? raw.viewerState.surfaceOpacity : 0.8,
        backgroundColor: raw.viewerState?.backgroundColor || '#0A0A0A',
        orthographic: Boolean(raw.viewerState?.orthographic),
        stereoMode: raw.viewerState?.stereoMode || 'none',
        hiddenObjectIds: Array.isArray(raw.viewerState?.hiddenObjectIds) ? raw.viewerState.hiddenObjectIds : [],
        camera: raw.viewerState?.camera || undefined
      };

      const selectionState: SelectionSessionState = {
        selectionLevel: raw.selectionState?.selectionLevel || 'atom',
        selectedAtomSerials: Array.isArray(raw.selectionState?.selectedAtomSerials)
          ? raw.selectionState.selectedAtomSerials
          : [],
        namedSelections: Array.isArray(raw.selectionState?.namedSelections)
          ? raw.selectionState.namedSelections.map((ns: any) => ({
              name: ns.name,
              query: ns.query,
              atomIds: Array.isArray(ns.atomIds) ? ns.atomIds : [],
              objectId: ns.objectId,
              stateId: ns.stateId
            }))
          : [],
        lastSelectionQuery: raw.selectionState?.lastSelectionQuery || undefined,
        scopedKeys: Array.isArray(raw.selectionState?.scopedKeys) ? raw.selectionState.scopedKeys : undefined,
        activeObjectId: raw.selectionState?.activeObjectId,
        activeStateId: raw.selectionState?.activeStateId
      };

      return {
        format: CURRENT_PSE_FORMAT,
        version: CURRENT_PSE_VERSION,
        createdAt: raw.createdAt || new Date().toISOString(),
        application: raw.application || { name: 'Molexplorer', module: 'MolStudio' },
        molecules: validMolecules.map((m: any, idx: number) => ({
          id: m.id || `mol_${idx}`,
          name: m.name || 'molecule',
          format: m.format === 'mmtf' ? 'mmtf' : m.format === 'sdf' ? 'sdf' : 'pdb',
          data: m.data,
          atomCount: typeof m.atomCount === 'number' ? m.atomCount : undefined,
          visible: typeof m.visible === 'boolean' ? m.visible : true,
          style: m.style || undefined,
          colorScheme: m.colorScheme || undefined
        })),
        viewerState,
        selectionState,
        measurements: Array.isArray(raw.measurements) ? raw.measurements : [],
        biophysical: raw.biophysical || { showDipoleArrow: false },
        metadata: raw.metadata || {}
      };
    }

    // 2. Legacy session backward compatibility (.json or legacy .pse.json format)
    const isLegacy = raw.version === '1.0' || raw.version === '1.0-molstudio' || raw.molecule || raw.pdbContent || raw.renderStyle;
    if (isLegacy) {
      const molData = raw.molecule?.data || raw.pdbContent;
      if (!molData || typeof molData !== 'string' || molData.trim().length === 0) {
        throw new Error('Unable to load session: Missing molecular structure data.');
      }

      const molFormat = raw.molecule?.format || 'pdb';
      const molName = raw.molecule?.name || raw.name || 'molecule';

      const legacyAtomSerials = Array.isArray(raw.selectedAtomSerials) ? raw.selectedAtomSerials : [];

      return {
        format: CURRENT_PSE_FORMAT,
        version: CURRENT_PSE_VERSION,
        createdAt: new Date().toISOString(),
        application: { name: 'Molexplorer', module: 'MolStudio' },
        molecules: [
          {
            id: 'main_mol',
            name: molName,
            format: molFormat,
            data: molData,
            atomCount: typeof raw.atomCount === 'number' ? raw.atomCount : undefined,
            visible: true
          }
        ],
        viewerState: {
          renderStyle: raw.viewState?.renderStyle || raw.renderStyle || 'Cartoon',
          colorScheme: raw.viewState?.colorScheme || raw.colorScheme || 'spectrum',
          surfaceOpacity: typeof (raw.viewState?.surfaceOpacity ?? raw.surfaceOpacity) === 'number'
            ? (raw.viewState?.surfaceOpacity ?? raw.surfaceOpacity)
            : 0.8,
          backgroundColor: raw.viewState?.backgroundColor || raw.backgroundColor || '#0A0A0A',
          orthographic: Boolean(raw.viewState?.orthographic),
          stereoMode: raw.viewState?.stereoMode || 'none'
        },
        selectionState: {
          selectionLevel: 'atom',
          selectedAtomSerials: legacyAtomSerials,
          namedSelections: Array.isArray(raw.namedSelections) ? raw.namedSelections : []
        },
        measurements: Array.isArray(raw.measurements) ? raw.measurements : [],
        biophysical: raw.biophysical || { showDipoleArrow: false },
        metadata: { legacyConverted: true, originalVersion: raw.version || '1.0' }
      };
    }

    throw new Error('Unable to load session: Invalid or unrecognized session format.');
  }

  /**
   * Ensures the exported file ends with `.pse` and initiates browser download.
   */
  public static downloadSessionFile(session: MolStudioPSESession, filename: string = 'workspace.pse'): void {
    let cleanFilename = filename.trim();
    
    // Strip trailing .json or .pse.json if present
    if (cleanFilename.toLowerCase().endsWith('.pse.json')) {
      cleanFilename = cleanFilename.slice(0, -9) + '.pse';
    } else if (cleanFilename.toLowerCase().endsWith('.json')) {
      cleanFilename = cleanFilename.slice(0, -5) + '.pse';
    }
    if (!cleanFilename.toLowerCase().endsWith('.pse')) {
      cleanFilename += '.pse';
    }

    const jsonStr = this.exportSession(session);
    const blob = new Blob([jsonStr], { type: 'application/vnd.molstudio.pse' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = cleanFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
