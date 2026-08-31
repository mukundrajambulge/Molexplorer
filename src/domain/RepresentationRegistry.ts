/**
 * RepresentationRegistry.ts
 * Authoritative Representation Registry and Validator for Phase SQ2.
 */

export const SUPPORTED_REPRESENTATIONS = [
  'lines',
  'sticks',
  'spheres',
  'ball_and_stick',
  'surface',
  'cartoon',
  'ribbon',
  'putty',
  'trace',
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
  'ball_and_stick': 'ball_and_stick',
  'ball-and-stick': 'ball_and_stick',
  'ballandstick': 'ball_and_stick',
  'ball_stick': 'ball_and_stick',
  'ballstick': 'ball_and_stick',
  'surface': 'surface',
  'surfaces': 'surface',
  'cartoon': 'cartoon',
  'cartoons': 'cartoon',
  'ribbon': 'ribbon',
  'ribbons': 'ribbon',
  'putty': 'putty',
  'putties': 'putty',
  'trace': 'trace',
  'traces': 'trace',
  'mesh': 'mesh',
  'meshes': 'mesh',
  'dot': 'dots',
  'dots': 'dots',
  'nonbonded': 'nonbonded',
  'nb_spheres': 'nb_spheres',
  'label': 'labels',
  'labels': 'labels'
};

export enum RepresentationBit {
  NONE = 0,
  LINES = 1 << 0,       // 1
  STICKS = 1 << 1,      // 2
  SPHERES = 1 << 2,     // 4
  CARTOON = 1 << 3,     // 8
  RIBBON = 1 << 4,      // 16
  TRACE = 1 << 5,       // 32
  SURFACE = 1 << 6,     // 64
  DOTS = 1 << 7,        // 128
  NONBONDED = 1 << 8,   // 256
  NB_SPHERES = 1 << 9,  // 512
  LABELS = 1 << 10,     // 1024
  PUTTY = 1 << 11,      // 2048
  MESH = 1 << 12,       // 4096
  BALL_AND_STICK = (1 << 1) | (1 << 2), // 6 (STICKS | SPHERES)
  ALL = ~0
}

export function representationToBit(repName: string): number {
  const norm = (repName || '').trim().toLowerCase();
  if (norm === 'all' || norm === 'everything' || norm === '*') return RepresentationBit.ALL;
  const canonical = REPRESENTATION_ALIASES[norm];
  if (!canonical) return RepresentationBit.NONE;
  switch (canonical) {
    case 'lines': return RepresentationBit.LINES;
    case 'sticks': return RepresentationBit.STICKS;
    case 'spheres': return RepresentationBit.SPHERES;
    case 'cartoon': return RepresentationBit.CARTOON;
    case 'ribbon': return RepresentationBit.RIBBON;
    case 'trace': return RepresentationBit.TRACE;
    case 'putty': return RepresentationBit.PUTTY;
    case 'surface': return RepresentationBit.SURFACE;
    case 'mesh': return RepresentationBit.MESH;
    case 'dots': return RepresentationBit.DOTS;
    case 'nonbonded': return RepresentationBit.NONBONDED;
    case 'nb_spheres': return RepresentationBit.NB_SPHERES;
    case 'labels': return RepresentationBit.LABELS;
    case 'ball_and_stick': return RepresentationBit.BALL_AND_STICK;
    default: return RepresentationBit.NONE;
  }
}

export function bitmaskToRepresentations(mask: number): SupportedRepresentation[] {
  const reps: SupportedRepresentation[] = [];
  if (mask & RepresentationBit.LINES) reps.push('lines');
  if (mask & RepresentationBit.STICKS && !(mask & RepresentationBit.SPHERES)) reps.push('sticks');
  if (mask & RepresentationBit.SPHERES && !(mask & RepresentationBit.STICKS)) reps.push('spheres');
  if ((mask & RepresentationBit.BALL_AND_STICK) === RepresentationBit.BALL_AND_STICK) reps.push('ball_and_stick');
  if (mask & RepresentationBit.CARTOON) reps.push('cartoon');
  if (mask & RepresentationBit.RIBBON) reps.push('ribbon');
  if (mask & RepresentationBit.TRACE) reps.push('trace');
  if (mask & RepresentationBit.PUTTY) reps.push('putty');
  if (mask & RepresentationBit.SURFACE) reps.push('surface');
  if (mask & RepresentationBit.MESH) reps.push('mesh');
  if (mask & RepresentationBit.DOTS) reps.push('dots');
  if (mask & RepresentationBit.NONBONDED) reps.push('nonbonded');
  if (mask & RepresentationBit.NB_SPHERES) reps.push('nb_spheres');
  if (mask & RepresentationBit.LABELS) reps.push('labels');
  return reps;
}

export class RepresentationRegistry {
  /**
   * Validates and canonicalizes a representation name.
   * Throws "Representation syntax error: unknown representation '<name>'" if unsupported.
   */
  static validate(repName: string, allowAll: boolean = false): SupportedRepresentation | 'everything' {
    const norm = (repName || '').trim().toLowerCase();
    if (allowAll && (norm === 'everything' || norm === 'all' || norm === '*')) {
      return 'everything';
    }
    const canonical = REPRESENTATION_ALIASES[norm];
    if (!canonical) {
      throw new Error(`Representation syntax error: unknown representation '${repName}'. Supported representations: ${SUPPORTED_REPRESENTATIONS.join(', ')}`);
    }
    return canonical;
  }

  static isSupported(repName: string, allowAll: boolean = false): boolean {
    const norm = (repName || '').trim().toLowerCase();
    if (allowAll && (norm === 'everything' || norm === 'all' || norm === '*')) {
      return true;
    }
    return norm in REPRESENTATION_ALIASES;
  }
}
