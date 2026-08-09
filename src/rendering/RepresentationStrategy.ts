import { RenderStyle } from '../types';

export interface RenderContextOptions {
  colorScheme: string;
  minResi: number;
  maxResi: number;
  chainMap: Record<string, string>;
  surfaceOpacity?: number;
}

export interface IRepresentationStrategy {
  getStyleObject(options: RenderContextOptions): any;
  applySurfacesOrShapes(viewer: any, options: RenderContextOptions): void;
}

export class DefaultRepresentationStrategy implements IRepresentationStrategy {
  private style: RenderStyle;

  constructor(style: RenderStyle) {
    this.style = style;
  }

  public getStyleObject(options: RenderContextOptions): any {
    const csLower = (options.colorScheme || '').toLowerCase();
    const base: any = {};

    if (csLower === 'white' || csLower === 'monochrome') {
      base.color = '#ffffff';
    } else if (csLower === 'by molecule') {
      base.color = options.chainMap[''] || '#4A90E2';
    } else if (csLower === 'chain' || csLower === 'by chain') {
      base.color = 'chain';
    } else if (csLower === 'ssjmol') {
      base.colorscheme = 'ssJmol';
    } else if (csLower === 'sspymol' || csLower === 'by ss') {
      base.colorscheme = 'ssPyMOL';
    } else if (csLower === 'element' || csLower === 'classic cpk' || csLower === 'modern/jmol') {
      base.colorscheme = 'default';
    } else {
      const isNamedColor = ['white', 'cyan', 'orange', 'red', 'green', 'blue', 'yellow', 'magenta', 'gray', 'purple'].includes(csLower);
      if (options.colorScheme.startsWith('#') || isNamedColor) {
        base.color = options.colorScheme;
      } else {
        base.colorscheme = 'default';
      }
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
        // Hardware-accelerated WebGL point cloud (0% CPU hang!)
        return { dot: { ...base, radius: 0.25 } };
      case "Non-bonded (crosses)":
        return { cross: { ...base, radius: 0.8, linewidth: 2 } };
      case "Non-bonded (small spheres)":
        return { sphere: { ...base, radius: 0.5 } };
      default:
        return { line: base };
    }
  }

  public applySurfacesOrShapes(viewer: any, options: RenderContextOptions): void {
    if (this.style.includes("Surface") || this.style === "Mesh") {
      let surfType = 1; // VDW
      if (this.style === "Solvent-Accessible Surface") surfType = 2; // SAS
      if (this.style === "Solvent-Excluded Surface") surfType = 3; // SES

      const surfOpts: any = {
        opacity: options.surfaceOpacity || 0.7,
        wireframe: this.style === "Mesh",
        colorscheme: options.colorScheme || 'default'
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
