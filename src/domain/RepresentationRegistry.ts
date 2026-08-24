/**
 * RepresentationRegistry.ts
 * Authoritative Representation Registry and Validator for Phase SQ2.
 */

export const SUPPORTED_REPRESENTATIONS = [
  'lines',
  'sticks',
  'spheres',
  'surface',
  'cartoon',
  'ribbon',
  'mesh',
  'dots',
  'nonbonded',
  'nb_spheres',
  'labels'
] as const;

export type SupportedRepresentation = typeof SUPPORTED_REPRESENTATIONS[number];

const REPRESENTATION_ALIASES: Record<string, SupportedRepresentation> = {
  'line': 'lines',
  'lines': 'lines',
  'stick': 'sticks',
  'sticks': 'sticks',
  'sphere': 'spheres',
  'spheres': 'spheres',
  'spacefill': 'spheres',
  'space-filling': 'spheres',
  'surface': 'surface',
  'surfaces': 'surface',
  'cartoon': 'cartoon',
  'cartoons': 'cartoon',
  'ribbon': 'ribbon',
  'ribbons': 'ribbon',
  'mesh': 'mesh',
  'meshes': 'mesh',
  'dot': 'dots',
  'dots': 'dots',
  'nonbonded': 'nonbonded',
  'nb_spheres': 'nb_spheres',
  'label': 'labels',
  'labels': 'labels',
  'putty': 'cartoon'
};

export class RepresentationRegistry {
  /**
   * Validates and canonicalizes a representation name.
   * Throws "Representation syntax error: unknown representation '<name>'" if unsupported.
   */
  static validate(repName: string): SupportedRepresentation {
    const norm = (repName || '').trim().toLowerCase();
    const canonical = REPRESENTATION_ALIASES[norm];
    if (!canonical) {
      throw new Error(`Representation syntax error: unknown representation '${repName}'. Supported representations: ${SUPPORTED_REPRESENTATIONS.join(', ')}`);
    }
    return canonical;
  }

  static isSupported(repName: string): boolean {
    const norm = (repName || '').trim().toLowerCase();
    return norm in REPRESENTATION_ALIASES;
  }
}
