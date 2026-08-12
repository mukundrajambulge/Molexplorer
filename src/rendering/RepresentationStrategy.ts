import { RenderStyle } from '../types';

export interface RenderContextOptions {
  colorScheme: string;
  minResi: number;
  maxResi: number;
  chainMap: Record<string, string>;
  surfaceOpacity?: number;
  opacity?: number;
  minBfactor?: number;
  maxBfactor?: number;
}

export interface IRepresentationStrategy {
  getStyleObject(options: RenderContextOptions): any;
  applySurfacesOrShapes(viewer: any, options: RenderContextOptions): void;
}

// Convert HSL hue to Hex string for smooth gradients
function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// 12 High-Contrast Chain Colors
const CHAIN_PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4',
  '#f97316', '#14b8a6', '#ef4444', '#84cc16', '#6366f1', '#d97706'
];

// Shapely Amino Acid Palette
const SHAPELY_AMINO_COLORS: Record<string, string> = {
  // Acidic (Negatively charged) - Red
  'ASP': '#dc2626', 'GLU': '#dc2626',
  // Basic (Positively charged) - Blue
  'LYS': '#2563eb', 'ARG': '#1d4ed8', 'HIS': '#3b82f6',
  // Polar uncharged - Orange & Cyan
  'SER': '#f97316', 'THR': '#ea580c', 'ASN': '#06b6d4', 'GLN': '#0891b2',
  // Aromatic - Purple & Indigo
  'PHE': '#8b5cf6', 'TYR': '#a855f7', 'TRP': '#7c3aed',
  // Hydrophobic / Aliphatic - Emerald Green & Amber
  'ALA': '#10b981', 'VAL': '#059669', 'LEU': '#047857', 'ILE': '#065f46',
  'MET': '#eab308', 'PRO': '#d97706',
  // Special - Cysteine Yellow, Glycine Silver
  'CYS': '#facc15', 'GLY': '#e2e8f0',
  // Nucleic Acids
  'A': '#3b82f6', 'DA': '#3b82f6',
  'C': '#ef4444', 'DC': '#ef4444',
  'G': '#10b981', 'DG': '#10b981',
  'T': '#f59e0b', 'DT': '#f59e0b',
  'U': '#8b5cf6'
};

// Kyte-Doolittle Hydrophobicity Palette
const HYDROPHOBICITY_COLORS: Record<string, string> = {
  'ILE': '#f59e0b', 'VAL': '#f97316', 'LEU': '#f59e0b', 'PHE': '#ea580c',
  'CYS': '#eab308', 'MET': '#facc15', 'ALA': '#fbbf24',
  'GLY': '#10b981', 'THR': '#14b8a6', 'SER': '#06b6d4', 'TRP': '#34d399',
  'TYR': '#6ee7b7', 'PRO': '#a7f3d0',
  'HIS': '#60a5fa', 'GLN': '#3b82f6', 'ASP': '#2563eb', 'GLU': '#1d4ed8',
  'ASN': '#2563eb', 'LYS': '#1e40af', 'ARG': '#1e3a8a'
};

export function getColorFunction(
  colorScheme: string,
  minResi: number,
  maxResi: number,
  chainMap: Record<string, string>,
  isRibbonStyle: boolean = false
) {
  const resiRange = Math.max(maxResi - minResi, 1);

  return (atom: any): string => {
    if (!atom) return '#ffffff';

    const csLower = (colorScheme || '').toLowerCase().trim();

    if (csLower === 'white') {
      return '#ffffff';
    }

    if (csLower === 'monochrome') {
      return '#94a3b8';
    }

    // B-Factor Temperature Scale (Blue = Rigid/Low B -> White -> Red = Flexible/High B)
    if (csLower === 'bfactor' || csLower === 'b-factor' || csLower === 'temperature') {
      const b = typeof atom.b === 'number' ? atom.b : (typeof atom.bFactor === 'number' ? atom.bFactor : 20.0);
      // Normalized between 0 and 60 (standard crystallographic range)
      const norm = Math.max(0, Math.min(1, b / 60));
      const hue = (1 - norm) * 240; // 240 (Blue) -> 0 (Red)
      return hslToHex(hue, 100, 50);
    }

    // 1. Classic CPK
    if (csLower === 'classic cpk' || csLower === 'element' || csLower === 'by element') {
      if (isRibbonStyle) {
        const ss = (atom.ss || '').toLowerCase();
        if (ss === 'h') return '#e11d48'; // Red Alpha-Helices
        if (ss === 's' || ss === 'e') return '#eab308'; // Golden Beta-Sheets
        const ch = atom.chain || 'A';
        const idx = ch.charCodeAt(0) % CHAIN_PALETTE.length;
        return CHAIN_PALETTE[idx];
      }
      
      const elem = (atom.elem || atom.element || '').toUpperCase();
      switch (elem) {
        case 'C': return '#909090'; // CPK Carbon Gray
        case 'N': return '#3050f8'; // CPK Nitrogen Blue
        case 'O': return '#ff0d0d'; // CPK Oxygen Red
        case 'S': return '#ffff30'; // CPK Sulfur Yellow
        case 'P': return '#ff8000'; // CPK Phosphorus Orange
        case 'H': return '#ffffff'; // CPK Hydrogen White
        case 'F': case 'CL': return '#1ff01f'; // Halogen Green
        case 'BR': return '#991b1b'; // Bromine Dark Red
        case 'I': return '#7e22ce'; // Iodine Dark Violet
        case 'FE': return '#e06633'; // Iron Rust Orange
        case 'ZN': return '#7d80b0'; // Zinc Purple
        case 'CA': return '#3dff00'; // Calcium Lime Green
        case 'MG': return '#8a99c7'; // Magnesium Blue-Gray
        default: return '#b8b8b8';
      }
    }

    // 2. Modern/Jmol (Shapely Amino Acid Standard)
    if (csLower === 'modern/jmol' || csLower === 'amino' || csLower === 'shapely') {
      const resn = (atom.resname || atom.resn || '').toUpperCase();
      if (SHAPELY_AMINO_COLORS[resn]) {
        return SHAPELY_AMINO_COLORS[resn];
      }
      const elem = (atom.elem || atom.element || '').toUpperCase();
      if (elem === 'N') return '#3050f8';
      if (elem === 'O') return '#ff0d0d';
      if (elem === 'S') return '#ffff30';
      return '#909090';
    }

    // 3. By Chain
    if (csLower === 'chain' || csLower === 'by chain') {
      const ch = atom.chain || 'A';
      if (chainMap[ch]) return chainMap[ch];
      const idx = ch.charCodeAt(0) % CHAIN_PALETTE.length;
      return CHAIN_PALETTE[idx];
    }

    // 4. By Molecule / Model
    if (csLower === 'by molecule' || csLower === 'molecule') {
      const mId = atom.modelId !== undefined ? atom.modelId : (atom.chain ? atom.chain.charCodeAt(0) : 0);
      return CHAIN_PALETTE[Math.abs(mId) % CHAIN_PALETTE.length];
    }

    // 5. Secondary Structure Standard (PyMOL Convention)
    if (csLower === 'sspymol' || csLower === 'ssstandard' || csLower === 'by ss' || csLower === 'secondary structure (standard)') {
      const ss = (atom.ss || '').toLowerCase();
      if (ss === 'h') return '#ef4444'; // Red Helices
      if (ss === 's' || ss === 'e') return '#f59e0b'; // Amber Sheets
      return '#10b981'; // Emerald Green Turns/Loops
    }

    // 6. Secondary Structure Jmol
    if (csLower === 'ssjmol' || csLower === 'secondary structure (jmol)') {
      const ss = (atom.ss || '').toLowerCase();
      if (ss === 'h') return '#ff0080'; // Magenta Helices
      if (ss === 's' || ss === 'e') return '#ffc800'; // Golden Sheets
      return '#3b82f6'; // Cornflower Blue Turns/Loops
    }

    // 7. Spectrum / Rainbow (N-to-C Terminal Gradient)
    if (csLower === 'spectrum' || csLower === 'rainbow') {
      const resi = typeof atom.resi === 'number' ? atom.resi : minResi;
      const t = Math.max(0, Math.min(1, (resi - minResi) / resiRange));
      const hue = (1 - t) * 240;
      return hslToHex(hue, 100, 48);
    }

    // 8. By Formal Charge
    if (csLower === 'by formal charge' || csLower === 'formal charge') {
      const charge = atom.formalCharge || 0;
      if (charge > 0) return '#2563eb';
      if (charge < 0) return '#dc2626';
      
      const resn = (atom.resname || atom.resn || '').toUpperCase();
      if (resn === 'ARG' || resn === 'LYS' || resn === 'HIS') return '#2563eb';
      if (resn === 'ASP' || resn === 'GLU') return '#dc2626';
      return '#94a3b8';
    }

    // 9. By Partial Charge / Electrostatic Potential (ESP)
    if (csLower === 'by partial charge' || csLower === 'esp' || csLower === 'electrostatic') {
      const resn = (atom.resname || atom.resn || '').toUpperCase();
      if (resn === 'ARG' || resn === 'LYS' || resn === 'HIS') return '#2563eb';
      if (resn === 'ASP' || resn === 'GLU') return '#dc2626';
      if (['SER', 'THR', 'ASN', 'GLN'].includes(resn)) return '#38bdf8';
      if (['PHE', 'TYR', 'TRP'].includes(resn)) return '#a855f7';
      
      const elem = (atom.elem || atom.element || '').toUpperCase();
      if (elem === 'O' || elem === 'F' || elem === 'CL') return '#ef4444';
      if (elem === 'N') return '#3b82f6';
      return '#cbd5e1';
    }

    // 10. Hydrophobicity (Kyte-Doolittle)
    if (csLower === 'hydrophobicity') {
      const resn = (atom.resname || atom.resn || '').toUpperCase();
      if (HYDROPHOBICITY_COLORS[resn]) {
        return HYDROPHOBICITY_COLORS[resn];
      }
      return '#10b981';
    }

    // 11. Colourblind-safe (Okabe-Ito / Wong Palette)
    if (csLower === 'colourblind-safe' || csLower === 'colorblind-safe' || csLower === 'colorblind safe') {
      const cbPalette = ['#0072B2', '#E69F00', '#009E73', '#F0E442', '#56B4E9', '#D55E00', '#CC79A7'];
      const ch = atom.chain || 'A';
      const idx = ch.charCodeAt(0) % cbPalette.length;
      return cbPalette[idx];
    }

    // 12. SMARTS (Default Element Colors)
    if (csLower === 'smarts') {
      const elem = (atom.elem || atom.element || '').toUpperCase();
      switch (elem) {
        case 'C': return '#909090';
        case 'N': return '#3050f8';
        case 'O': return '#ff0d0d';
        case 'S': return '#ffff30';
        case 'P': return '#ff8000';
        case 'H': return '#ffffff';
        default: return '#b8b8b8';
      }
    }

    // Custom Hex String Fallback
    const isHex = /^#[0-9A-F]{6}$/i.test(colorScheme);
    return isHex ? colorScheme : '#94a3b8';
  };
}

export class DefaultRepresentationStrategy implements IRepresentationStrategy {
  private style: RenderStyle;

  constructor(style: RenderStyle) {
    this.style = style;
  }

  public getStyleObject(options: RenderContextOptions): any {
    const isRibbon = this.style === "Cartoon" || this.style === "Putty";
    const colorfunc = getColorFunction(
      options.colorScheme,
      options.minResi,
      options.maxResi,
      options.chainMap,
      isRibbon
    );

    const base: any = { colorfunc };
    if (typeof options.opacity === 'number') {
      base.opacity = options.opacity;
    }

    switch (this.style) {
      case "Line":
        return { line: base };
      case "Stick":
        return { stick: { ...base, radius: 0.18 } };
      case "Ball-and-Stick":
        return { stick: { ...base, radius: 0.15 }, sphere: { ...base, radius: 0.35 } };
      case "Space-Filling":
        return { sphere: base };
      case "Cartoon":
        return { cartoon: { ...base, arrows: true, tubes: false } };
      case "Putty":
        // B-Factor Putty: variable thickness tube mapped to B-factor
        return { 
          cartoon: { 
            ...base, 
            tubes: true, 
            thickness: 0.45,
            colorfunc: options.colorScheme === 'spectrum' 
              ? getColorFunction('bfactor', options.minResi, options.maxResi, options.chainMap, true) 
              : colorfunc
          } 
        };
      case "Dots":
      case "Dot Surface":
        return { dot: { ...base, radius: 0.35 } };
      case "Non-bonded (crosses)":
        return { cross: { ...base, radius: 0.8, linewidth: 2 } };
      case "Non-bonded (small spheres)":
        return { sphere: { ...base, radius: 0.5 } };
      default:
        return { cartoon: base, stick: base };
    }
  }

  public applySurfacesOrShapes(viewer: any, options: RenderContextOptions): void {
    if (this.style.includes("Surface") || this.style === "Mesh") {
      let surfType = 1; // VDW
      if (this.style === "Solvent-Accessible Surface") surfType = 2; // SAS
      if (this.style === "Solvent-Excluded Surface") surfType = 3; // SES

      const colorfunc = getColorFunction(
        options.colorScheme,
        options.minResi,
        options.maxResi,
        options.chainMap,
        false
      );

      const surfOpts: any = {
        opacity: typeof options.surfaceOpacity === 'number' ? options.surfaceOpacity : 0.7,
        wireframe: this.style === "Mesh",
        colorfunc
      };

      try {
        viewer.addSurface(surfType, surfOpts);
      } catch (e) {
        console.warn('Surface generation deferred or unsupported:', e);
      }
    }
  }
}

export class RepresentationStrategyFactory {
  public static getStrategy(style: RenderStyle): IRepresentationStrategy {
    return new DefaultRepresentationStrategy(style);
  }
}
