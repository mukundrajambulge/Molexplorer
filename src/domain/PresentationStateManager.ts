/**
 * PresentationStateManager.ts
 * Typed Per-Selection Presentation State Model for Phase SQ3.
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
 * OVERRIDE PRECEDENCE (lowest → highest):
 *   1. Global defaults (setRenderStyle, setColorScheme in MolStudio)
 *   2. Object-level overrides
 *   3. Selection-level overrides
 *   4. Most recently applied selection override (last-write-wins within same selection)
 */

export type RepresentationName =
  | 'lines' | 'sticks' | 'spheres' | 'surface' | 'cartoon'
  | 'ribbon' | 'mesh' | 'dots' | 'nonbonded' | 'nb_spheres' | 'labels';

export type VisibilityState = 'visible' | 'hidden';

export interface SelectionPresentationOverride {
  /** Unique key identifying this override; typically the selection name or expression hash */
  selectionKey: string;
  /** The original selection query that produced this override (provenance) */
  selectionQuery: string;
  /** Resolved canonical atom serial IDs this override applies to */
  atomSerials: Set<number>;
  /** Object scope; null means all objects */
  objectScope: string | null;
  /** Color value (named or hex). null = no color override */
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
}

export interface PresentationState {
  /** Global fallback: applied when no selection override matches */
  global: {
    color: string;
    representation: RepresentationName;
    opacity: number;
  };
  /** Per-object overrides */
  objects: Map<string, ObjectPresentationState>;
  /** Per-selection overrides, keyed by selectionKey */
  selectionOverrides: Map<string, SelectionPresentationOverride>;
}

export class PresentationStateManager {
  private state: PresentationState;

  constructor(opts?: { globalColor?: string; globalRep?: RepresentationName }) {
    this.state = {
      global: {
        color: opts?.globalColor || 'element',
        representation: opts?.globalRep || 'cartoon',
        opacity: 1.0
      },
      objects: new Map(),
      selectionOverrides: new Map()
    };
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
      visibility: existing?.visibility ?? null,
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
   * Remove an override for a selection key.
   */
  clearOverride(selectionKey: string): void {
    this.state.selectionOverrides.delete(selectionKey);
  }

  /**
   * Clear all overrides.
   */
  clearAllOverrides(): void {
    this.state.selectionOverrides.clear();
  }

  /**
   * Resolve the effective presentation (color, representation, visibility)
   * for a single atom serial, applying overrides in precedence order
   * (last-write-wins among same-serial overrides).
   */
  resolveAtom(
    serial: number,
    objectId?: string
  ): { color: string; representation: RepresentationName; visibility: VisibilityState; opacity: number } {
    // Start with global defaults
    let color = this.state.global.color;
    let rep = this.state.global.representation;
    let visibility: VisibilityState = 'visible';
    let opacity = this.state.global.opacity;
    let latestApplied = -1;

    // Apply object override if present
    if (objectId) {
      const objState = this.state.objects.get(objectId);
      if (objState) {
        if (objState.color) color = objState.color;
        if (objState.representation) rep = objState.representation;
        visibility = objState.visibility;
      }
    }

    // Apply selection overrides (last-write-wins for this atom)
    for (const override of this.state.selectionOverrides.values()) {
      if (!override.atomSerials.has(serial)) continue;
      if (objectId && override.objectScope && override.objectScope !== objectId) continue;
      if (override.appliedAt < latestApplied) continue;
      latestApplied = override.appliedAt;
      if (override.color !== null) color = override.color;
      if (override.representation !== null) rep = override.representation;
      if (override.visibility !== null) visibility = override.visibility;
      if (override.opacity !== null) opacity = override.opacity;
    }

    return { color, representation: rep, visibility, opacity };
  }

  /**
   * Returns a snapshot of all active selection overrides.
   */
  getOverrides(): SelectionPresentationOverride[] {
    return Array.from(this.state.selectionOverrides.values());
  }

  /**
   * Returns the current presentation state for debugging/inspection.
   */
  getState(): PresentationState {
    return this.state;
  }

  /**
   * Updates global default presentation.
   */
  setGlobal(color?: string, representation?: RepresentationName, opacity?: number): void {
    if (color !== undefined) this.state.global.color = color;
    if (representation !== undefined) this.state.global.representation = representation;
    if (opacity !== undefined) this.state.global.opacity = opacity;
  }

  /**
   * Returns all selection keys that contain the given serial.
   */
  getOverridesForAtom(serial: number): SelectionPresentationOverride[] {
    return Array.from(this.state.selectionOverrides.values()).filter(o => o.atomSerials.has(serial));
  }
}
