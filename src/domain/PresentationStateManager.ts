/**
 * PresentationStateManager.ts
 * Deterministic Presentation State Model & Render State Builder (SQ-RENDER-01).
 *
 * This system tracks visual overrides (color, representation, opacity,
 * visibility) per selection scope without ever modifying canonical scientific
 * state (coordinates, topology, identity, revisions).
 *
 * PRESENTATION INVARIANT:
 *   Presentation operations NEVER:
 *     - modify canonical_state_hash
 *     - modify coordinates
 *     - modify topology
 *     - create ScientificRevision
 *
 * STRICT PRECEDENCE HIERARCHY (lowest → highest):
 *   1. GLOBAL DEFAULT (globalRepresentation, globalColorScheme, globalOpacity)
 *   2. OBJECT-LEVEL OVERRIDE (per-object representation / color)
 *   3. SELECTION-LEVEL OVERRIDE (last-write-wins by appliedAt timestamp)
 *   4. MOST-SPECIFIC ATOM OVERRIDE / SPECTRUM (atomColorMap)
 */

import { getColorFunction } from '../rendering/RepresentationStrategy';

export type RepresentationName =
  | 'lines' | 'sticks' | 'spheres' | 'surface' | 'cartoon'
  | 'ribbon' | 'mesh' | 'dots' | 'nonbonded' | 'nb_spheres' | 'putty' | 'labels';

export type VisibilityState = 'visible' | 'hidden';

export interface AtomPresentationState {
  /** Serial number / ID of the atom */
  serial: number;
  /** Effective representation style */
  representation: RepresentationName;
  /** Effective color (resolved hex string '#RRGGBB' or standard named color) */
  color: string;
  /** Effective visibility */
  visibility: VisibilityState;
  /** Effective opacity (0.0 to 1.0) */
  opacity: number;
  /** Optional 3D label expression/text */
  label?: string | null;
  /** Provenance tag describing which precedence level resolved this state */
  source: string;
}

export interface SelectionPresentationOverride {
  /** Unique key identifying this override; typically the selection name or expression hash */
  selectionKey: string;
  /** The original selection query that produced this override (provenance) */
  selectionQuery: string;
  /** Resolved canonical atom serial IDs this override applies to */
  atomSerials: Set<number>;
  /** Object scope; null means all objects */
  objectScope: string | null;
  /** Color value (named or hex or scheme name). null = no color override */
  color: string | null;
  /** Representation name. null = no representation override */
  representation: RepresentationName | null;
  /** Opacity 0.0–1.0. null = no opacity override */
  opacity: number | null;
  /** Visibility. null = no visibility override */
  visibility: VisibilityState | null;
  /** Label state. null = no label override */
  labelState: {
    visible: boolean;
    expression?: string;
  } | null;
  /** When this override was applied; used for last-write-wins resolution */
  appliedAt: number;
}

export interface ObjectPresentationState {
  objectId: string;
  color: string | null;
  representation: RepresentationName | null;
  visibility: VisibilityState;
  opacity?: number;
}

export interface ViewerPresentationState {
  /** Global/base representation */
  globalRepresentation: RepresentationName;
  /** Global/base color scheme */
  globalColorScheme: string;
  /** Global base opacity */
  globalOpacity: number;
  /** Object-level overrides keyed by objectId */
  objectOverrides: Map<string, ObjectPresentationState>;
  /** Selection-level overrides keyed by selectionKey */
  selectionOverrides: Map<string, SelectionPresentationOverride>;
  /** Per-atom color map (e.g. from spectrum command) */
  atomColorMap?: Map<number, string> | null;
}

export interface BuildRenderStateParams {
  atoms: any[];
  presentationState: ViewerPresentationState;
  options: {
    minResi?: number;
    maxResi?: number;
    chainMap?: Record<string, string>;
    activeObjectId?: string;
  };
}

export interface ResolvedViewerRenderState {
  /** Map of atom serial -> exact resolved presentation state */
  atomPresentationMap: Map<number, AtomPresentationState>;
  /** Batched 3Dmol style groups */
  styleGroups: Map<string, { style: any; serials: number[] }>;
  /** Atom serials that are hidden */
  hiddenSerials: number[];
  /** Atom serials that have surface representation */
  surfaceSerials: number[];
}

/**
 * Standardize representation names into canonical RepresentationName.
 */
export function normalizeRepresentationName(rep: string | null | undefined): RepresentationName {
  if (!rep) return 'cartoon';
  const norm = rep.toLowerCase().trim().replace(/[-_\s]+/g, '');
  if (norm === 'stick' || norm === 'sticks' || norm === 'ballandstick') return 'sticks';
  if (norm === 'sphere' || norm === 'spheres' || norm === 'spacefilling' || norm === 'vdw') return 'spheres';
  if (norm === 'line' || norm === 'lines' || norm === 'wireframe') return 'lines';
  if (norm === 'surface' || norm === 'vanderwaalssurface' || norm === 'solventaccessiblesurface' || norm === 'solventexcludedsurface') return 'surface';
  if (norm === 'ribbon') return 'ribbon';
  if (norm === 'putty') return 'putty';
  if (norm === 'mesh') return 'mesh';
  if (norm === 'dot' || norm === 'dots' || norm === 'dotsurface') return 'dots';
  if (norm === 'nonbonded' || norm === 'cross' || norm === 'crosses') return 'nonbonded';
  if (norm === 'nbspheres' || norm === 'smallspheres') return 'nb_spheres';
  return 'cartoon';
}

/**
 * Helper to construct a safe 3Dmol style object from representation, resolved hex color, and opacity.
 */
export function get3DmolAtomStyle(
  rep: RepresentationName,
  resolvedColor: string,
  opacity: number = 1.0
): any {
  const colorSpec = { color: resolvedColor };

  switch (rep) {
    case 'sticks':
      return { stick: { ...colorSpec, radius: 0.22, opacity } };
    case 'spheres':
      return { sphere: { ...colorSpec, radius: 0.65, opacity } };
    case 'lines':
      return { line: { ...colorSpec, linewidth: 2.0 } };
    case 'nonbonded':
      return { cross: { ...colorSpec, radius: 0.5, linewidth: 1.5 } };
    case 'nb_spheres':
      return { sphere: { ...colorSpec, radius: 0.45, opacity } };
    case 'ribbon':
      return { cartoon: { ...colorSpec, opacity, style: 'ribbon' } };
    case 'putty':
      return { cartoon: { ...colorSpec, opacity, tubes: true, thickness: 0.45 } };
    case 'dots':
      return { dot: { ...colorSpec, radius: 0.35 } };
    case 'surface':
      return { stick: { ...colorSpec, radius: 0.15, opacity: 0.3 } };
    case 'cartoon':
    default:
      return { cartoon: { ...colorSpec, opacity, style: 'oval' } };
  }
}

/**
 * Authoritative Pure Function: buildViewerRenderState
 * Computes the complete deterministic visual state from base settings,
 * object settings, selection overrides, and per-atom colors.
 */
export function buildViewerRenderState(params: BuildRenderStateParams): ResolvedViewerRenderState {
  const { atoms, presentationState, options } = params;
  const minResi = options.minResi !== undefined ? options.minResi : 1;
  const maxResi = options.maxResi !== undefined ? options.maxResi : 100;
  const chainMap = options.chainMap || {};
  const activeObjectId = options.activeObjectId;

  const atomPresentationMap = new Map<number, AtomPresentationState>();

  // Prepare color evaluator function for global color scheme
  const globalColorEvaluator = getColorFunction(
    presentationState.globalColorScheme,
    minResi,
    maxResi,
    chainMap,
    presentationState.globalRepresentation === 'cartoon' || presentationState.globalRepresentation === 'ribbon'
  );

  // 1. LEVEL 1: GLOBAL DEFAULTS
  atoms.forEach((atom: any, idx: number) => {
    const serial = atom.serial !== undefined ? atom.serial : (atom.id !== undefined ? atom.id : idx + 1);
    let baseRep: RepresentationName = presentationState.globalRepresentation;
    let baseColor: string = '#94a3b8';

    const resnUpper = (atom.resname || atom.resName || atom.resn || '').toUpperCase();
    const isWater = ['HOH', 'WAT', 'DOD', 'SOL', 'TIP3', 'TIP4', 'SPC'].includes(resnUpper);
    const isHet = Boolean(atom.hetflag || atom.isHetero || isWater);

    if (isHet) {
      if (isWater) {
        baseRep = 'nonbonded';
        baseColor = '#ff4d4d'; // Standard solvent red
      } else {
        baseRep = 'sticks';
        const cpkFunc = getColorFunction('Classic CPK', minResi, maxResi, chainMap, false);
        baseColor = cpkFunc(atom);
      }
    } else {
      baseRep = presentationState.globalRepresentation;
      baseColor = globalColorEvaluator(atom);
    }

    atomPresentationMap.set(serial, {
      serial,
      representation: baseRep,
      color: baseColor,
      visibility: 'visible',
      opacity: presentationState.globalOpacity,
      source: 'global'
    });
  });

  // 2. LEVEL 2: OBJECT-LEVEL OVERRIDES
  if (activeObjectId && presentationState.objectOverrides.has(activeObjectId)) {
    const objOverride = presentationState.objectOverrides.get(activeObjectId)!;
    for (const [serial, atomState] of atomPresentationMap) {
      if (objOverride.representation !== null) {
        atomState.representation = objOverride.representation;
      }
      if (objOverride.color !== null) {
        const objColorEvaluator = getColorFunction(objOverride.color, minResi, maxResi, chainMap, false);
        const atomObj = atoms.find((a: any) => (a.serial !== undefined ? a.serial : a.id) === serial);
        atomState.color = atomObj ? objColorEvaluator(atomObj) : objOverride.color;
      }
      if (objOverride.visibility !== null) {
        atomState.visibility = objOverride.visibility;
      }
      if (typeof objOverride.opacity === 'number') {
        atomState.opacity = objOverride.opacity;
      }
      atomState.source = `object:${activeObjectId}`;
    }
  }

  // 3. LEVEL 3: SELECTION-LEVEL OVERRIDES (Chronological last-write-wins)
  if (presentationState.selectionOverrides && presentationState.selectionOverrides.size > 0) {
    const sortedOverrides = Array.from(presentationState.selectionOverrides.values())
      .sort((a, b) => (a.appliedAt || 0) - (b.appliedAt || 0));

    for (const override of sortedOverrides) {
      if (!override.atomSerials || override.atomSerials.size === 0) continue;

      for (const serial of override.atomSerials) {
        const atomState = atomPresentationMap.get(serial);
        if (!atomState) continue;

        if (override.visibility !== null) {
          atomState.visibility = override.visibility;
        }
        if (override.representation !== null) {
          atomState.representation = override.representation;
        }
        if (override.color !== null) {
          // If the override color is a color scheme or element, evaluate with getColorFunction
          const atomObj = atoms.find((a: any) => (a.serial !== undefined ? a.serial : a.id) === serial);
          const overrideColorEvaluator = getColorFunction(
            override.color,
            minResi,
            maxResi,
            chainMap,
            atomState.representation === 'cartoon' || atomState.representation === 'ribbon'
          );
          atomState.color = atomObj ? overrideColorEvaluator(atomObj) : override.color;
        }
        if (typeof override.opacity === 'number') {
          atomState.opacity = override.opacity;
        }
        atomState.source = `selection:${override.selectionKey}`;
      }
    }
  }

  // 4. LEVEL 4: ATOM-LEVEL OVERRIDE / SPECTRUM COLOR MAP
  if (presentationState.atomColorMap && presentationState.atomColorMap.size > 0) {
    for (const [serial, hex] of presentationState.atomColorMap) {
      const atomState = atomPresentationMap.get(serial);
      if (atomState) {
        atomState.color = hex;
        atomState.source = 'atomColorMap';
      }
    }
  }

  // 5. BATCH ATOMS INTO 3DMOL STYLE GROUPS
  const styleGroups = new Map<string, { style: any; serials: number[] }>();
  const hiddenSerials: number[] = [];
  const surfaceSerials: number[] = [];

  for (const [serial, atomState] of atomPresentationMap) {
    if (atomState.visibility === 'hidden') {
      hiddenSerials.push(serial);
      continue;
    }
    if (atomState.representation === 'surface') {
      surfaceSerials.push(serial);
    }
    const styleObj = get3DmolAtomStyle(atomState.representation, atomState.color, atomState.opacity);
    const styleKey = JSON.stringify(styleObj);
    if (!styleGroups.has(styleKey)) {
      styleGroups.set(styleKey, { style: styleObj, serials: [] });
    }
    styleGroups.get(styleKey)!.serials.push(serial);
  }

  return {
    atomPresentationMap,
    styleGroups,
    hiddenSerials,
    surfaceSerials
  };
}

/**
 * PresentationStateManager class managing mutable presentation state
 * with deterministic query, override, and resolution operations.
 */
export class PresentationStateManager {
  private state: ViewerPresentationState;

  constructor(opts?: { globalColor?: string; globalRep?: RepresentationName; globalOpacity?: number }) {
    this.state = {
      globalRepresentation: opts?.globalRep || 'cartoon',
      globalColorScheme: opts?.globalColor || 'spectrum',
      globalOpacity: typeof opts?.globalOpacity === 'number' ? opts?.globalOpacity : 0.8,
      objectOverrides: new Map(),
      selectionOverrides: new Map(),
      atomColorMap: null
    };
  }

  /**
   * Set global presentation defaults.
   */
  setGlobal(colorScheme?: string, representation?: RepresentationName, opacity?: number): void {
    if (colorScheme !== undefined) this.state.globalColorScheme = colorScheme;
    if (representation !== undefined) this.state.globalRepresentation = representation;
    if (opacity !== undefined) this.state.globalOpacity = opacity;
  }

  /**
   * Apply a color override to a selection.
   */
  applyColor(
    selectionKey: string,
    selectionQuery: string,
    atomSerials: Set<number>,
    color: string,
    objectScope: string | null = null
  ): void {
    const existing = this.state.selectionOverrides.get(selectionKey);
    this.state.selectionOverrides.set(selectionKey, {
      selectionKey,
      selectionQuery,
      atomSerials: new Set(atomSerials),
      objectScope,
      color,
      representation: existing?.representation ?? null,
      opacity: existing?.opacity ?? null,
      visibility: existing?.visibility ?? null,
      labelState: existing?.labelState ?? null,
      appliedAt: Date.now()
    });
  }

  /**
   * Apply a representation override to a selection.
   */
  applyRepresentation(
    selectionKey: string,
    selectionQuery: string,
    atomSerials: Set<number>,
    representation: RepresentationName,
    objectScope: string | null = null
  ): void {
    const existing = this.state.selectionOverrides.get(selectionKey);
    this.state.selectionOverrides.set(selectionKey, {
      selectionKey,
      selectionQuery,
      atomSerials: new Set(atomSerials),
      objectScope,
      color: existing?.color ?? null,
      representation,
      opacity: existing?.opacity ?? null,
      visibility: existing?.visibility ?? 'visible',
      labelState: existing?.labelState ?? null,
      appliedAt: Date.now()
    });
  }

  /**
   * Hide (or show) a selection.
   */
  applyVisibility(
    selectionKey: string,
    selectionQuery: string,
    atomSerials: Set<number>,
    visibility: VisibilityState,
    objectScope: string | null = null
  ): void {
    const existing = this.state.selectionOverrides.get(selectionKey);
    this.state.selectionOverrides.set(selectionKey, {
      selectionKey,
      selectionQuery,
      atomSerials: new Set(atomSerials),
      objectScope,
      color: existing?.color ?? null,
      representation: existing?.representation ?? null,
      opacity: existing?.opacity ?? null,
      visibility,
      labelState: existing?.labelState ?? null,
      appliedAt: Date.now()
    });
  }

  /**
   * Recolor a selection (reverts its color override to global color scheme).
   */
  recolor(selectionKey: string): void {
    const existing = this.state.selectionOverrides.get(selectionKey);
    if (existing) {
      if (existing.representation === null && existing.visibility === null) {
        this.state.selectionOverrides.delete(selectionKey);
      } else {
        existing.color = null;
      }
    }
  }

  /**
   * Clear an override for a specific selection key.
   */
  clearOverride(selectionKey: string): void {
    this.state.selectionOverrides.delete(selectionKey);
  }

  /**
   * Clear all selection overrides.
   */
  clearAllOverrides(): void {
    this.state.selectionOverrides.clear();
    this.state.atomColorMap = null;
  }

  /**
   * Set per-atom color map (e.g. from spectrum command).
   */
  setAtomColorMap(map: Map<number, string> | null): void {
    this.state.atomColorMap = map ? new Map(map) : null;
  }

  /**
   * Get array of all current selection overrides.
   */
  getOverrides(): SelectionPresentationOverride[] {
    return Array.from(this.state.selectionOverrides.values());
  }

  /**
   * Get raw viewer presentation state.
   */
  getState(): ViewerPresentationState {
    return this.state;
  }

  /**
   * Resolves the effective render state for an atom array.
   */
  buildRenderState(
    atoms: any[],
    options: { minResi?: number; maxResi?: number; chainMap?: Record<string, string>; activeObjectId?: string } = {}
  ): ResolvedViewerRenderState {
    return buildViewerRenderState({
      atoms,
      presentationState: this.state,
      options
    });
  }
}
