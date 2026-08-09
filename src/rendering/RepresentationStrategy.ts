import { RenderStyle } from '../types';

export interface RenderContextOptions {
  colorScheme: string;
  minResi: number;
  maxResi: number;
  chainMap: Record<string, string>;
  surfaceOpacity?: number;
  opacity?: number;
}

export interface IRepresentationStrategy {
  getStyleObject(options: RenderContextOptions): any;
  applySurfacesOrShapes(viewer: any, options: RenderContextOptions): void;
}

// Convert HSL hue to Hex string for smooth Spectrum gradients
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

export function getColorFunction(
  colorScheme: string,
  minResi: number,
  maxResi: number,
  chainMap: Record<string, string>
) {
  const resiRange = Math.max(maxResi - minResi, 1);

  return (atom: any): string => {
    if (!atom) return '#ffffff';

    const csLower = (colorScheme || '').toLowerCase();

    if (csLower === 'white' || csLower === 'monochrome') {
      return '#ffffff';
    }

    if (csLower === 'element' || csLower === 'classic cpk') {
      const elem = (atom.elem || atom.element || '').toUpperCase();
      switch (elem) {
        case 'C': return '#909090'; // CPK Carbon Gray
        case 'N': return '#3050f8'; // CPK Nitrogen Blue
        case 'O': return '#ff0d0d'; // CPK Oxygen Red
        case 'S': return '#ffff30'; // CPK Sulfur Yellow
        case 'P': return '#ff8000'; // CPK Phosphorus Orange
        case 'H': return '#ffffff'; // CPK Hydrogen White
        case 'F': case 'CL': return '#1ff01f'; // Halogen Green
        case 'FE': return '#e06633'; // Iron Rust Orange
        case 'ZN': return '#7d80b0'; // Zinc Purple
        case 'CA': return '#3dff00'; // Calcium Lime Green
        case 'MG': return '#8a99c7'; // Magnesium Blue-Gray
        default: return '#b8b8b8';
      }
    }

    if (csLower === 'modern/jmol') {
      const elem = (atom.elem || atom.element || '').toUpperCase();
      switch (elem) {
        case 'C': return '#808080';
        case 'N': return '#1f77b4';
        case 'O': return '#d62728';
        case 'S': return '#bcbd22';
        case 'P': return '#ff7f0e';
        case 'H': return '#ffffff';
        default: return '#999999';
      }
    }

    if (csLower === 'chain' || csLower === 'by chain') {
      const ch = atom.chain || 'A';
      return chainMap[ch] || chainMap[ch.toUpperCase()] || chainMap[''] || '#3b82f6';
    }

    if (csLower === 'ssjmol') {
      const ss = (atom.ss || '').toLowerCase();
      if (ss === 'h') return '#ff0080';
      if (ss === 's' || ss === 'e') return '#ffc800';
      return '#ffffff';
    }

    if (csLower === 'sspymol' || csLower === 'by ss') {
      const ss = (atom.ss || '').toLowerCase();
      if (ss === 'h') return '#ff0000';
      if (ss === 's' || ss === 'e') return '#ffff00';
      return '#22c55e';
    }

    if (csLower === 'spectrum' || csLower === 'rainbow') {
      const resi = typeof atom.resi === 'number' ? atom.resi : minResi;
      const t = Math.max(0, Math.min(1, (resi - minResi) / resiRange));
      const hue = (1 - t) * 240;
      return hslToHex(hue, 100, 48);
    }

    if (csLower === 'by formal charge') {
      const charge = atom.formalCharge || 0;
      if (charge < 0) return '#ef4444';
      if (charge > 0) return '#3b82f6';
      return '#e5e7eb';
    }

    if (csLower === 'by partial charge' || csLower === 'esp') {
      const elem = (atom.elem || atom.element || '').toUpperCase();
      if (elem === 'O' || elem === 'F' || elem === 'CL') return '#ef4444';
      if (elem === 'N' || elem === 'H') return '#3b82f6';
      return '#9ca3af';
    }

    if (csLower === 'hydrophobicity') {
      const resn = (atom.resname || atom.resn || '').toUpperCase();
      const hydrophobic = ['ALA', 'VAL', 'LEU', 'ILE', 'MET', 'PHE', 'TYR', 'TRP', 'PRO'];
      if (hydrophobic.includes(resn)) return '#eab308';
      return '#3b82f6';
    }

    if (csLower === 'colourblind-safe' || csLower === 'colorblind safe') {
      const cbPalette = ['#0072B2', '#E69F00', '#009E73', '#F0E442', '#56B4E9', '#D55E00', '#CC79A7'];
      const ch = atom.chain || 'A';
      const idx = ch.charCodeAt(0) % cbPalette.length;
      return cbPalette[idx];
    }

    const isHex = /^#[0-9A-F]{6}$/i.test(colorScheme);
    return isHex ? colorScheme : '#3b82f6';
  };
}

export class DefaultRepresentationStrategy implements IRepresentationStrategy {
  private style: RenderStyle;

  constructor(style: RenderStyle) {
    this.style = style;
  }

  public getStyleObject(options: RenderContextOptions): any {
    const csLower = (options.colorScheme || '').toLowerCase();
    const base: any = {};
    if (typeof options.opacity === 'number') {
      base.opacity = options.opacity;
    }

    if (csLower === 'white' || csLower === 'monochrome') {
      base.color = '#ffffff';
    } else if (csLower === 'classic cpk' || csLower === 'element') {
      base.colorscheme = 'rasmol';
    } else if (csLower === 'modern/jmol') {
      base.colorscheme = 'Jmol';
    } else if (csLower === 'chain' || csLower === 'by chain') {
      base.colorscheme = 'chain';
    } else if (csLower === 'ssjmol') {
      base.colorscheme = 'ssJmol';
    } else if (csLower === 'sspymol' || csLower === 'by ss') {
      base.colorscheme = 'ssPyMOL';
    } else if (csLower === 'spectrum' || csLower === 'rainbow') {
      base.colorscheme = 'spectrum';
    } else if (csLower === 'by molecule') {
      base.color = options.chainMap[''] || '#4A90E2';
    } else {
      const colorfunc = getColorFunction(options.colorScheme, options.minResi, options.maxResi, options.chainMap);
      base.colorfunc = colorfunc;
    }

    switch (this.style) {
      case "Line":
        return { line: base };
      case "Stick":
        return { stick: base };
      case "Ball-and-Stick":
        return { stick: { ...base, radius: 0.15 }, sphere: { ...base, radius: 0.35 } };
      case "Space-Filling":
        return { sphere: base };
      case "Cartoon":
        return { cartoon: { ...base, arrows: true, tubes: false } };
      case "Putty":
        return { cartoon: { ...base, tubes: true, thickness: 0.5 } };
      case "Dots":
      case "Dot Surface":
        // Hardware-accelerated WebGL point cloud with rich multi-color scheme
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

      const colorfunc = getColorFunction(options.colorScheme, options.minResi, options.maxResi, options.chainMap);

      const surfOpts: any = {
        opacity: options.surfaceOpacity || 0.7,
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
