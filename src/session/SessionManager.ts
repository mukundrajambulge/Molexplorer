import { MolStudioSession } from './SessionSchema';

export class SessionManager {
  /**
   * Serialize session object to formatted JSON string
   */
  public static exportSession(session: MolStudioSession): string {
    return JSON.stringify(session, null, 2);
  }

  /**
   * Parse and validate session JSON string
   */
  public static importSession(jsonString: string): MolStudioSession {
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid session JSON structure.');
      }
      
      // Basic validation
      const session: MolStudioSession = {
        version: data.version || '1.0',
        timestamp: data.timestamp || Date.now(),
        molecule: data.molecule || null,
        selectedAtomSerials: Array.isArray(data.selectedAtomSerials) ? data.selectedAtomSerials : [],
        namedSelections: Array.isArray(data.namedSelections) ? data.namedSelections : [],
        measurements: Array.isArray(data.measurements) ? data.measurements : [],
        biophysical: data.biophysical || { showDipoleArrow: false },
        viewState: {
          renderStyle: data.viewState?.renderStyle || 'Cartoon',
          colorScheme: data.viewState?.colorScheme || 'spectrum',
          surfaceOpacity: typeof data.viewState?.surfaceOpacity === 'number' ? data.viewState.surfaceOpacity : 0.8,
          backgroundColor: data.viewState?.backgroundColor || '#0A0A0A',
          orthographic: Boolean(data.viewState?.orthographic),
          stereoMode: data.viewState?.stereoMode || 'none',
        }
      };

      return session;
    } catch (e: any) {
      throw new Error(`Failed to parse MolStudio session file: ${e.message}`);
    }
  }

  /**
   * Download session JSON file to user's browser
   */
  public static downloadSessionFile(session: MolStudioSession, filename: string = 'workspace_session.pse.json'): void {
    const jsonStr = this.exportSession(session);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
