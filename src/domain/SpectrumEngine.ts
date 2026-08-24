/**
 * SpectrumEngine.ts
 * Typed Spectrum Color Mapping Engine for Phase SQ3.
 *
 * Maps numeric atom property values to color ramps with deterministic normalization.
 *
 * Scientific Classification: SOFTWARE VERIFIED
 * (Not independently benchmarked against external reference spectra)
 */

import { Atom } from '../lib/SelectionParser';
import { CanonicalAtom } from '../types/domain';

export const SUPPORTED_SPECTRUM_PROPERTIES = [
  'b',
  'q',
  'formal_charge',
  'id',
  'index'
] as const;

export type SpectrumProperty = typeof SUPPORTED_SPECTRUM_PROPERTIES[number];

export const SUPPORTED_PALETTES = [
  'rainbow',
  'blue_white_red',
  'red_white_blue',
  'green_white_magenta',
  'blue_green_red',
  'red_green_blue',
  'grey'
] as const;

export type SpectrumPalette = typeof SUPPORTED_PALETTES[number];

/** Linear color gradient stop */
interface ColorStop {
  t: number;  // 0.0–1.0
  r: number;  g: number;  b: number;
}

const PALETTE_STOPS: Record<SpectrumPalette, ColorStop[]> = {
  rainbow: [
    { t: 0.0,   r: 0,   g: 0,   b: 255 },  // blue
    { t: 0.25,  r: 0,   g: 255, b: 255 },  // cyan
    { t: 0.5,   r: 0,   g: 255, b: 0   },  // green
    { t: 0.75,  r: 255, g: 255, b: 0   },  // yellow
    { t: 1.0,   r: 255, g: 0,   b: 0   }   // red
  ],
  blue_white_red: [
    { t: 0.0, r: 0,   g: 0,   b: 255 },
    { t: 0.5, r: 255, g: 255, b: 255 },
    { t: 1.0, r: 255, g: 0,   b: 0   }
  ],
  red_white_blue: [
    { t: 0.0, r: 255, g: 0,   b: 0   },
    { t: 0.5, r: 255, g: 255, b: 255 },
    { t: 1.0, r: 0,   g: 0,   b: 255 }
  ],
  green_white_magenta: [
    { t: 0.0, r: 0,   g: 200, b: 0   },
    { t: 0.5, r: 255, g: 255, b: 255 },
    { t: 1.0, r: 200, g: 0,   b: 200 }
  ],
  blue_green_red: [
    { t: 0.0,  r: 0,   g: 0,   b: 255 },
    { t: 0.5,  r: 0,   g: 255, b: 0   },
    { t: 1.0,  r: 255, g: 0,   b: 0   }
  ],
  red_green_blue: [
    { t: 0.0,  r: 255, g: 0,   b: 0   },
    { t: 0.5,  r: 0,   g: 255, b: 0   },
    { t: 1.0,  r: 0,   g: 0,   b: 255 }
  ],
  grey: [
    { t: 0.0, r: 20,  g: 20,  b: 20  },
    { t: 1.0, r: 240, g: 240, b: 240 }
  ]
};

/** Missing value default color: grey */
const MISSING_COLOR = '#808080';

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function toHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

function interpolateColor(stops: ColorStop[], t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  for (let i = 1; i < stops.length; i++) {
    if (clamped <= stops[i].t) {
      const prev = stops[i - 1];
      const next = stops[i];
      const local = (clamped - prev.t) / (next.t - prev.t);
      return toHex(lerp(prev.r, next.r, local), lerp(prev.g, next.g, local), lerp(prev.b, next.b, local));
    }
  }
  const last = stops[stops.length - 1];
  return toHex(last.r, last.g, last.b);
}

export interface SpectrumResult {
  /** Map of atom serial → hex color */
  atomColors: Map<number, string>;
  /** Actual min value found in selection */
  minValue: number;
  /** Actual max value found in selection */
  maxValue: number;
  /** Number of atoms that had the property */
  coveredCount: number;
  /** Number of atoms missing the property (assigned MISSING_COLOR) */
  missingCount: number;
  /** Property mapped */
  property: SpectrumProperty;
  /** Palette used */
  palette: SpectrumPalette;
}

export class SpectrumEngine {
  /**
   * Validates a spectrum property name.
   */
  static validateProperty(prop: string): SpectrumProperty {
    const norm = prop.trim().toLowerCase() as SpectrumProperty;
    if (!SUPPORTED_SPECTRUM_PROPERTIES.includes(norm)) {
      throw new Error(
        `Spectrum syntax error: unsupported property '${prop}'. ` +
        `Supported: ${SUPPORTED_SPECTRUM_PROPERTIES.join(', ')}`
      );
    }
    return norm;
  }

  /**
   * Validates a spectrum palette name.
   */
  static validatePalette(palette: string): SpectrumPalette {
    const norm = palette.trim().toLowerCase() as SpectrumPalette;
    if (!SUPPORTED_PALETTES.includes(norm)) {
      throw new Error(
        `Spectrum syntax error: unsupported palette '${palette}'. ` +
        `Supported: ${SUPPORTED_PALETTES.join(', ')}`
      );
    }
    return norm;
  }

  /**
   * Extracts the numeric property value from an atom.
   * Returns null if the property is not available.
   */
  static getPropertyValue(atom: Atom | CanonicalAtom, property: SpectrumProperty): number | null {
    if ('canonical_id' in atom) {
      const ca = atom as CanonicalAtom;
      switch (property) {
        case 'b': return ca.b_factor ?? null;
        case 'q': return ca.occupancy ?? null;
        case 'formal_charge': return ca.formal_charge ?? null;
        case 'id': return ca.canonical_id;
        case 'index': return ca.canonical_id - 1;
      }
    } else {
      const a = atom as Atom;
      switch (property) {
        case 'b': return a.bFactor ?? null;
        case 'q': return a.occupancy ?? null;
        case 'formal_charge': return a.formalCharge ?? null;
        case 'id': return a.serial;
        case 'index': return a.index ?? a.serial - 1;
      }
    }
    return null;
  }

  /**
   * Maps a set of atoms through a spectrum (property → palette → per-atom hex color).
   *
   * @param atoms - Full atom array
   * @param selectedSerials - Atom serials to include in the spectrum scope
   * @param property - Which numeric property to map
   * @param palette - Color ramp to use
   * @param minOverride - Optional explicit minimum (otherwise auto-computed)
   * @param maxOverride - Optional explicit maximum (otherwise auto-computed)
   */
  static map(
    atoms: (Atom | CanonicalAtom)[],
    selectedSerials: Set<number>,
    property: SpectrumProperty,
    palette: SpectrumPalette,
    minOverride?: number,
    maxOverride?: number
  ): SpectrumResult {
    const stops = PALETTE_STOPS[palette];
    const atomColors = new Map<number, string>();

    // Collect values for selected atoms
    const values: Map<number, number> = new Map();
    let missingCount = 0;

    for (const atom of atoms) {
      const serial = 'canonical_id' in atom
        ? (atom as CanonicalAtom).canonical_id
        : (atom as Atom).serial;

      if (!selectedSerials.has(serial)) continue;

      const val = this.getPropertyValue(atom, property);
      if (val === null || !Number.isFinite(val)) {
        atomColors.set(serial, MISSING_COLOR);
        missingCount++;
      } else {
        values.set(serial, val);
      }
    }

    if (values.size === 0) {
      // All atoms missing — return grey, but still honour explicit min/max in result
      for (const serial of selectedSerials) {
        atomColors.set(serial, MISSING_COLOR);
      }
      return {
        atomColors,
        minValue: minOverride !== undefined ? minOverride : 0,
        maxValue: maxOverride !== undefined ? maxOverride : 0,
        coveredCount: 0,
        missingCount,
        property,
        palette
      };
    }

    const rawValues = Array.from(values.values());
    const minVal = minOverride !== undefined ? minOverride : Math.min(...rawValues);
    const maxVal = maxOverride !== undefined ? maxOverride : Math.max(...rawValues);
    const range = maxVal - minVal;

    for (const [serial, val] of values.entries()) {
      const t = range > 0 ? (val - minVal) / range : 0.5;
      atomColors.set(serial, interpolateColor(stops, t));
    }

    return {
      atomColors,
      minValue: minVal,
      maxValue: maxVal,
      coveredCount: values.size,
      missingCount,
      property,
      palette
    };
  }
}
