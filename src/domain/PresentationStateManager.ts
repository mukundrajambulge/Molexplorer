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
 *   4. MOST-SPECIFIC ATOM OVERRIDE / BITMASK / SPECTRUM (atomRepresentationMasks, atomColorMap)
 */

import { getColorFunction } from '../rendering/RepresentationStrategy';
import {
  SupportedRepresentation,
  CanonicalRepresentation,
  normalizeRepresentation,
  RepresentationBit,
  representationToBit,
  bitmaskToRepresentations
} from './RepresentationRegistry';

export type { CanonicalRepresentation };
export { normalizeRepresentation };

export type RepresentationName = SupportedRepresentation;
export type VisibilityState = 'visible' | 'hidden';

/**
 * Object-Scoped Stable Atom Identity Key (e.g. `${objectScope}:${serial}`)
 */
export type AtomIdentityKey = string;

export function makeAtomIdentityKey(serial: number, objectScope: string | null = null): AtomIdentityKey {
  const scope = (objectScope && objectScope.trim()) || 'main_mol';
  return `${scope}:${serial}`;
}

export function parseAtomIdentityKey(key: string): { objectScope: string; serial: number } {
  const colonIdx = key.indexOf(':');
  if (colonIdx === -1) {
    return { objectScope: 'default', serial: parseInt(key, 10) || 0 };
  }
  return {
    objectScope: key.substring(0, colonIdx),
    serial: parseInt(key.substring(colonIdx + 1), 10) || 0
  };
}

export interface AtomPresentationState {
  /** Serial number / ID of the atom */
  serial: number;
  /** Effective representation style */
  representation: RepresentationName;
  /** Effective representation bitmask */
  representationMask?: number;
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
  /** Per-atom stable representation bitmasks keyed by Object-Scoped AtomIdentityKey (`${objectScope}:${serial}`) */
  atomRepresentationMasks?: Map<string, number> | null;
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
  if (norm === 'ballandstick' || norm === 'ball_and_stick' || norm === 'ballstick') return 'ball_and_stick';
  if (norm === 'stick' || norm === 'sticks') return 'sticks';
  if (norm === 'sphere' || norm === 'spheres' || norm === 'spacefilling' || norm === 'vdw') return 'spheres';
  if (norm === 'line' || norm === 'lines' || norm === 'wireframe') return 'lines';
  if (norm === 'surface' || norm === 'vanderwaalssurface' || norm === 'solventaccessiblesurface' || norm === 'solventexcludedsurface') return 'surface';
  if (norm === 'ribbon' || norm === 'ribbons') return 'ribbon';
  if (norm === 'putty' || norm === 'putties') return 'putty';
  if (norm === 'trace' || norm === 'traces') return 'trace';
  if (norm === 'mesh' || norm === 'meshes') return 'mesh';
  if (norm === 'dot' || norm === 'dots' || norm === 'dotsurface') return 'dots';
  if (norm === 'nonbonded' || norm === 'cross' || norm === 'crosses') return 'nonbonded';
  if (norm === 'nbspheres' || norm === 'smallspheres') return 'nb_spheres';
  if (norm === 'label' || norm === 'labels') return 'labels';
  return 'cartoon';
}

/**
 * Default representation bitmask for an atom based on chemical type and global setting.
 */
export function defaultMaskForAtom(atom: any, globalRep: RepresentationName = 'cartoon'): number {
  const resnUpper = (atom.resname || atom.resName || atom.resn || '').toUpperCase();
  const isWater = ['HOH', 'WAT', 'DOD', 'SOL', 'TIP3', 'TIP4', 'SPC'].includes(resnUpper);
  const isHet = Boolean(atom.hetflag || atom.isHetero || isWater);
  if (isWater) {
    return RepresentationBit.NONBONDED;
  }
  if (isHet) {
    return RepresentationBit.STICKS;
  }
  return representationToBit(globalRep);
}

/**
 * Helper to construct a safe 3Dmol style object from a composite representation bitmask,
 * resolved hex color, and opacity. Allows multiple representations (e.g. sticks + spheres) to coexist.
 */
export function get3DmolAtomStyleFromMask(
  mask: number,
  resolvedColor: string,
  opacity: number = 1.0
): any {
  if (mask === 0 || mask === RepresentationBit.NONE) {
    return { hidden: true };
  }

  const colorSpec = { color: resolvedColor };
  const styleObj: any = {};

  if (mask & RepresentationBit.LINES) {
    styleObj.line = { ...colorSpec, linewidth: 2.0 };
  }
  if (mask & RepresentationBit.STICKS) {
    styleObj.stick = { ...colorSpec, radius: 0.22, opacity };
  }
  if (mask & RepresentationBit.SPHERES) {
    styleObj.sphere = { ...colorSpec, radius: 0.65, opacity };
  }
  if (mask & RepresentationBit.CARTOON) {
    styleObj.cartoon = { ...colorSpec, opacity, arrows: true, tubes: false };
  } else if (mask & RepresentationBit.RIBBON) {
    styleObj.cartoon = { ...colorSpec, opacity, ribbon: true, arrows: false, tubes: false, style: 'oval' };
  } else if (mask & RepresentationBit.TRACE) {
    styleObj.cartoon = { ...colorSpec, opacity, style: 'trace' };
  } else if (mask & RepresentationBit.PUTTY) {
    styleObj.cartoon = { ...colorSpec, opacity, tubes: true, thickness: 0.45 };
  }
  if (mask & RepresentationBit.NONBONDED) {
    styleObj.cross = { ...colorSpec, radius: 0.5, linewidth: 1.5 };
  }
  if (mask & RepresentationBit.NB_SPHERES) {
    styleObj.sphere = { ...colorSpec, radius: 0.45, opacity };
  }
  if (mask & RepresentationBit.DOTS) {
    styleObj.dot = { ...colorSpec, radius: 0.35 };
  }

  return styleObj;
}

/**
 * Helper to construct a safe 3Dmol style object from representation, resolved hex color, and opacity.
 */
export function get3DmolAtomStyle(
  rep: RepresentationName,
  resolvedColor: string,
  opacity: number = 1.0
): any {
  const bit = representationToBit(rep);
  return get3DmolAtomStyleFromMask(bit, resolvedColor, opacity);
}

/**
 * Authoritative Pure Function: buildViewerRenderState
 * Computes the complete deterministic visual state from base settings,
 * object settings, selection overrides, per-atom bitmasks, and per-atom colors.
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

  // 1. LEVEL 1: GLOBAL DEFAULTS & ATOM BITMASK INITIALIZATION
  atoms.forEach((atom: any, idx: number) => {
    const serial = atom.serial !== undefined ? atom.serial : (atom.canonical_id !== undefined ? atom.canonical_id : (atom.id !== undefined ? atom.id : idx + 1));
    let baseColor: string = '#94a3b8';

    const resnUpper = (atom.resname || atom.resName || atom.resn || '').toUpperCase();
    const isWater = ['HOH', 'WAT', 'DOD', 'SOL', 'TIP3', 'TIP4', 'SPC'].includes(resnUpper);
    const isHet = Boolean(atom.hetflag || atom.isHetero || isWater);

    if (isHet) {
      if (isWater) {
        baseColor = '#ff4d4d'; // Standard solvent red
      } else {
        const cpkFunc = getColorFunction('Classic CPK', minResi, maxResi, chainMap, false);
        baseColor = cpkFunc(atom);
      }
    } else {
      baseColor = globalColorEvaluator(atom);
    }

    let mask: number;
    let source: string;

    const objScope = atom.objectScope || atom.objectId || atom.object_id || atom.molecule_ref || atom.moleculeRef || options.activeObjectId || 'main_mol';
    const atomKey = makeAtomIdentityKey(serial, objScope);

    if (presentationState.atomRepresentationMasks && presentationState.atomRepresentationMasks.has(atomKey)) {
      mask = presentationState.atomRepresentationMasks.get(atomKey)!;
      source = 'atomRepresentationMask';
    } else if (presentationState.atomRepresentationMasks && presentationState.atomRepresentationMasks.has(`default:${serial}`)) {
      mask = presentationState.atomRepresentationMasks.get(`default:${serial}`)!;
      source = 'atomRepresentationMask';
    } else if (presentationState.atomRepresentationMasks && presentationState.atomRepresentationMasks.has(String(serial))) {
      mask = presentationState.atomRepresentationMasks.get(String(serial))!;
      source = 'atomRepresentationMask';
    } else {
      mask = defaultMaskForAtom(atom, presentationState.globalRepresentation);
      source = 'global';
    }

    const repList = bitmaskToRepresentations(mask);
    const primaryRep: RepresentationName = repList[0] || 'cartoon';

    atomPresentationMap.set(serial, {
      serial,
      representation: primaryRep,
      representationMask: mask,
      color: baseColor,
      visibility: mask === 0 ? 'hidden' : 'visible',
      opacity: presentationState.globalOpacity,
      source
    });
  });

  // 2. LEVEL 2: OBJECT-LEVEL OVERRIDES
  if (activeObjectId && presentationState.objectOverrides.has(activeObjectId)) {
    const objOverride = presentationState.objectOverrides.get(activeObjectId)!;
    for (const [serial, atomState] of atomPresentationMap) {
      if (objOverride.representation !== null) {
        atomState.representation = objOverride.representation;
        atomState.representationMask = representationToBit(objOverride.representation);
      }
      if (objOverride.color !== null) {
        const objColorEvaluator = getColorFunction(objOverride.color, minResi, maxResi, chainMap, false);
        const atomObj = atoms.find((a: any) => (a.serial !== undefined ? a.serial : (a.canonical_id !== undefined ? a.canonical_id : a.id)) === serial);
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

        const atomKey = makeAtomIdentityKey(serial, override.objectScope || options.activeObjectId);
        const hasMask = presentationState.atomRepresentationMasks && (
          presentationState.atomRepresentationMasks.has(atomKey) ||
          presentationState.atomRepresentationMasks.has(`default:${serial}`) ||
          presentationState.atomRepresentationMasks.has(String(serial))
        );

        if (override.visibility !== null && !hasMask) {
          atomState.visibility = override.visibility;
        }
        if (override.representation !== null && !hasMask) {
          atomState.representation = override.representation;
          atomState.representationMask = representationToBit(override.representation);
        }
        if (override.color !== null) {
          const atomObj = atoms.find((a: any) => (a.serial !== undefined ? a.serial : (a.canonical_id !== undefined ? a.canonical_id : a.id)) === serial);
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

    const objScope = options.activeObjectId || 'main_mol';
    const atomKey = makeAtomIdentityKey(serial, objScope);

    const mask = atomState.representationMask !== undefined
      ? atomState.representationMask
      : (presentationState.atomRepresentationMasks?.get(atomKey) ??
         presentationState.atomRepresentationMasks?.get(`default:${serial}`) ??
         presentationState.atomRepresentationMasks?.get(String(serial)) ??
         representationToBit(atomState.representation));

    if (mask === 0 || mask === RepresentationBit.NONE) {
      hiddenSerials.push(serial);
      continue;
    }

    if (mask & RepresentationBit.SURFACE) {
      surfaceSerials.push(serial);
    }

    const styleObj = get3DmolAtomStyleFromMask(mask, atomState.color, atomState.opacity);
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
 * with deterministic query, override, and bitmask resolution operations.
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
      atomColorMap: null,
      atomRepresentationMasks: new Map()
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
   * Returns the current bitmask for a given atom serial and optional object scope.
   */
  getAtomMask(serial: number, objectScope: string | null = null, allAtoms?: any[]): number {
    const key = makeAtomIdentityKey(serial, objectScope);
    if (this.state.atomRepresentationMasks) {
      if (this.state.atomRepresentationMasks.has(key)) {
        return this.state.atomRepresentationMasks.get(key)!;
      }
      if (this.state.atomRepresentationMasks.has(`default:${serial}`)) {
        return this.state.atomRepresentationMasks.get(`default:${serial}`)!;
      }
      if (this.state.atomRepresentationMasks.has(String(serial))) {
        return this.state.atomRepresentationMasks.get(String(serial))!;
      }
    }
    if (allAtoms && allAtoms.length > 0) {
      const atom = allAtoms.find(a => (a.serial !== undefined ? a.serial : (a.canonical_id !== undefined ? a.canonical_id : a.id)) === serial);
      if (atom) return defaultMaskForAtom(atom, this.state.globalRepresentation);
    }
    return representationToBit(this.state.globalRepresentation);
  }

  /**
   * SHOW(rep): mask = mask OR rep
   * Unselected atoms remain unchanged.
   */
  showRepresentation(
    atomSerials: Iterable<number>,
    rep: string | number,
    objectScope: string | null = null,
    allAtoms?: any[]
  ): void {
    if (!this.state.atomRepresentationMasks) {
      this.state.atomRepresentationMasks = new Map<string, number>();
    }
    const bit = typeof rep === 'number' ? rep : representationToBit(rep);
    for (const serial of atomSerials) {
      const key = makeAtomIdentityKey(serial, objectScope);
      const current = this.getAtomMask(serial, objectScope, allAtoms);
      this.state.atomRepresentationMasks.set(key, current | bit);
    }
  }

  /**
   * HIDE(rep): mask = mask AND NOT rep
   * If rep is 'everything' or 'all', mask = 0.
   * Unselected atoms remain unchanged.
   */
  hideRepresentation(
    atomSerials: Iterable<number>,
    rep: string | number,
    objectScope: string | null = null,
    allAtoms?: any[]
  ): void {
    if (!this.state.atomRepresentationMasks) {
      this.state.atomRepresentationMasks = new Map<string, number>();
    }
    const bit = typeof rep === 'number' ? rep : representationToBit(rep);
    for (const serial of atomSerials) {
      const key = makeAtomIdentityKey(serial, objectScope);
      const current = this.getAtomMask(serial, objectScope, allAtoms);
      this.state.atomRepresentationMasks.set(key, current & ~bit);
    }
  }

  /**
   * SHOW_AS(rep): mask = rep
   * Unselected atoms remain unchanged.
   */
  showAsRepresentation(
    atomSerials: Iterable<number>,
    rep: string | number,
    objectScope: string | null = null
  ): void {
    if (!this.state.atomRepresentationMasks) {
      this.state.atomRepresentationMasks = new Map<string, number>();
    }
    const bit = typeof rep === 'number' ? rep : representationToBit(rep);
    for (const serial of atomSerials) {
      const key = makeAtomIdentityKey(serial, objectScope);
      this.state.atomRepresentationMasks.set(key, bit);
    }
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
   * Apply a representation override to a selection (sets representation mask and override).
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
    this.showAsRepresentation(atomSerials, representation, objectScope);
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
    if (visibility === 'hidden') {
      this.hideRepresentation(atomSerials, RepresentationBit.ALL, objectScope);
    } else {
      this.showRepresentation(atomSerials, this.state.globalRepresentation, objectScope);
    }
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
    const existing = this.state.selectionOverrides.get(selectionKey);
    if (existing && this.state.atomRepresentationMasks) {
      for (const serial of existing.atomSerials) {
        const key = makeAtomIdentityKey(serial, existing.objectScope);
        this.state.atomRepresentationMasks.delete(key);
        this.state.atomRepresentationMasks.delete(`default:${serial}`);
        this.state.atomRepresentationMasks.delete(String(serial));
      }
    }
    this.state.selectionOverrides.delete(selectionKey);
  }

  /**
   * Remove an override for a specific selection key (alias for clearOverride).
   */
  removeOverride(selectionKey: string): void {
    this.clearOverride(selectionKey);
  }

  /**
   * Clear all selection overrides and representation masks.
   */
  clearAllOverrides(): void {
    this.state.selectionOverrides.clear();
    this.state.atomColorMap = null;
    this.state.atomRepresentationMasks = new Map();
  }

  /**
   * Set per-atom color map (e.g. from spectrum command).
   */
  setAtomColorMap(map: Map<number, string> | null): void {
    this.state.atomColorMap = map ? new Map(map) : null;
  }

  /**
   * Set per-atom representation masks map.
   */
  setAtomRepresentationMasks(map: Map<string | number, number> | null): void {
    if (!map) {
      this.state.atomRepresentationMasks = new Map();
      return;
    }
    const next = new Map<string, number>();
    for (const [k, v] of map.entries()) {
      const keyStr = typeof k === 'number' ? `default:${k}` : String(k);
      next.set(keyStr, v);
    }
    this.state.atomRepresentationMasks = next;
  }

  /**
   * Get per-atom representation masks map.
   */
  getAtomRepresentationMasks(): Map<string, number> {
    if (!this.state.atomRepresentationMasks) {
      this.state.atomRepresentationMasks = new Map();
    }
    return this.state.atomRepresentationMasks;
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
