/**
 * ColorRegistry.ts
 * Authoritative Color Registry and Validator for Phase SQ2.
 */

export const NAMED_COLOR_MAP: Record<string, string> = {
  // Standard CSS / PyMOL named colors
  'yellow': '#eab308',
  'cyan': '#06b6d4',
  'green': '#22c55e',
  'forest': '#15803d',
  'lime': '#84cc16',
  'red': '#ef4444',
  'blue': '#3b82f6',
  'deepblue': '#1d4ed8',
  'marine': '#0284c7',
  'orange': '#f97316',
  'magenta': '#d946ef',
  'purple': '#a855f7',
  'violet': '#8b5cf6',
  'pink': '#ec4899',
  'hotpink': '#f43f5e',
  'teal': '#14b8a6',
  'gold': '#eab308',
  'silver': '#94a3b8',
  'white': '#ffffff',
  'black': '#000000',
  'gray': '#64748b',
  'grey': '#64748b',
  'carbon': '#22c55e',
  'spectrum': 'spectrum'
};

export class ColorRegistry {
  /**
   * Validates a color name or hex string.
   * Throws "Color syntax error: unknown or invalid color '<color>'" if invalid.
   */
  static validate(colorString: string): string {
    const raw = (colorString || '').trim();
    if (!raw) {
      throw new Error("Color syntax error: missing color value");
    }

    const norm = raw.toLowerCase();

    // Check named colors
    if (norm in NAMED_COLOR_MAP) {
      return norm;
    }

    // Check hex code format #RGB or #RRGGBB
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) {
      return raw;
    }

    // Check standard color schemes (e.g. element, bfactor, rainbow, chain, secondary)
    const validSchemes = ['element', 'bfactor', 'occupancy', 'rainbow', 'chain', 'secondary', 'residue', 'charge'];
    if (validSchemes.includes(norm)) {
      return norm;
    }

    throw new Error(`Color syntax error: unknown or invalid color '${colorString}'`);
  }

  static isColor(colorString: string): boolean {
    try {
      this.validate(colorString);
      return true;
    } catch {
      return false;
    }
  }
}
