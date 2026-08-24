import {
  CanonicalAtom,
  CanonicalMolecule,
  CanonicalState,
  CanonicalMolecularDocument,
  SelectionResult,
  ScopedSelectionResult,
  createScopedAtomKey
} from '../types/domain';
import { SelectionParser, Atom } from '../lib/SelectionParser';

class CanonicalSpatialGrid {
  cellSize: number;
  grid: Map<string, { id: number; x: number; y: number; z: number }[]>;

  constructor(
    cellSize: number,
    atoms: CanonicalAtom[],
    targetIds: Set<number>,
    coords?: { x: number; y: number; z: number }[]
  ) {
    this.cellSize = Math.max(cellSize, 0.1);
    this.grid = new Map();

    for (let i = 0; i < atoms.length; i++) {
      const atom = atoms[i];
      if (targetIds.has(atom.canonical_id)) {
        const x = coords ? coords[i].x : atom.x;
        const y = coords ? coords[i].y : atom.y;
        const z = coords ? coords[i].z : atom.z;
        const key = this.getKey(x, y, z);
        let cell = this.grid.get(key);
        if (!cell) {
          cell = [];
          this.grid.set(key, cell);
        }
        cell.push({ id: atom.canonical_id, x, y, z });
      }
    }
  }

  getKey(x: number, y: number, z: number): string {
    return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)},${Math.floor(z / this.cellSize)}`;
  }

  isNear(x: number, y: number, z: number): boolean {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    const distSq = this.cellSize * this.cellSize;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const key = `${cx + dx},${cy + dy},${cz + dz}`;
          const cell = this.grid.get(key);
          if (cell) {
            for (let i = 0; i < cell.length; i++) {
              const target = cell[i];
              const dX = target.x - x;
              const dY = target.y - y;
              const dZ = target.z - z;
              if (dX * dX + dY * dY + dZ * dZ <= distSq) {
                return true;
              }
            }
          }
        }
      }
    }
    return false;
  }
}

/**
 * Authoritative Canonical Selection Evaluator.
 * Evaluates Selection AST directly against CanonicalMolecule domain structures with explicit object and state scoping.
 */
export class CanonicalSelectionEvaluator {
  molecule: CanonicalMolecule;
  atoms: CanonicalAtom[];
  legacyAtoms: Atom[];
  dummyParser: SelectionParser;
  objectId?: string;
  stateId?: string;
  stateCoordinates?: { x: number; y: number; z: number }[];
  atomIdToResidueId: Map<number, string>;
  atomIdToChainId: Map<number, string>;
  namedSelections: { name: string; query: string; atomIds?: number[] }[];

  constructor(
    molecule: CanonicalMolecule,
    options?: {
      objectId?: string;
      stateId?: string;
      state?: CanonicalState;
      namedSelections?: { name: string; query: string; atomIds?: number[] }[];
    }
  ) {
    this.molecule = molecule;
    this.atoms = molecule.atoms;
    this.objectId = options?.objectId;
    this.stateId = options?.stateId || options?.state?.state_id;
    this.stateCoordinates = options?.state?.coordinates;
    this.namedSelections = options?.namedSelections || [];

    if (this.stateCoordinates && this.stateCoordinates.length !== this.atoms.length) {
      throw new Error(
        `State coordinates length (${this.stateCoordinates.length}) does not match molecule atom count (${this.atoms.length})`
      );
    }

    this.atomIdToResidueId = new Map();
    this.atomIdToChainId = new Map();

    for (const res of molecule.residues) {
      for (const aId of res.atom_ids) {
        this.atomIdToResidueId.set(aId, res.residue_id);
      }
    }

    for (const chain of molecule.chains) {
      for (const aId of chain.atom_ids) {
        this.atomIdToChainId.set(aId, chain.chain_id);
      }
    }

    // Bridge for macro and property evaluation compatibility
    this.legacyAtoms = this.atoms.map((ca, idx) => ({
      serial: ca.canonical_id,
      elem: ca.element,
      name: ca.name,
      resName: ca.residue_name,
      resSeq: ca.residue_ref,
      chainID: ca.chain_ref,
      bonds: [],
      x: this.stateCoordinates ? this.stateCoordinates[idx].x : ca.x,
      y: this.stateCoordinates ? this.stateCoordinates[idx].y : ca.y,
      z: this.stateCoordinates ? this.stateCoordinates[idx].z : ca.z,
      isHetero: ca.is_hetero,
      altLoc: ca.alt_loc,
      bFactor: ca.b_factor,
      occupancy: ca.occupancy,
      ss: ca.secondary_structure,
      isModeledH: ca.modeled_hydrogen
    }));
    this.dummyParser = new SelectionParser(this.legacyAtoms, this.namedSelections);
  }

  /**
   * Evaluates a selection query string against the canonical molecule.
   */
  evaluateQuery(
    query: string,
    options?: {
      objectId?: string;
      stateId?: string;
      scopeType?: 'active_object' | 'explicit_object' | 'workspace';
    }
  ): SelectionResult {
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const qTrim = query.trim();
    const resolvedObjectId = options?.objectId || this.objectId;
    const resolvedStateId = options?.stateId || this.stateId;
    const resolvedScopeType = options?.scopeType || 'active_object';

    if (!qTrim) {
      return {
        query: query,
        selected_ids: new Set(),
        selected_array: [],
        count: 0,
        object_id: resolvedObjectId,
        state_id: resolvedStateId,
        scope_type: resolvedScopeType,
        execution_time_ms: 0
      };
    }

    // Reuse existing parser tokenization & AST construction for 100% grammar parity
    const tokens = this.dummyParser.tokenize(qTrim);
    if (tokens.length === 0) {
      throw new Error(`Syntax error: empty selection query "${query}"`);
    }
    const expr = this.dummyParser.buildExpression(tokens);

    const selectedIds = this.evaluateAST(expr);
    const sortedArray = Array.from(selectedIds).sort((a, b) => a - b);
    const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

    return {
      query: query,
      selected_ids: selectedIds,
      selected_array: sortedArray,
      count: selectedIds.size,
      object_id: resolvedObjectId,
      state_id: resolvedStateId,
      scope_type: resolvedScopeType,
      execution_time_ms: endTime - startTime
    };
  }

  evaluateAST(expr: any): Set<number> {
    if (!expr) return new Set();

    switch (expr.type) {
      case 'named_selection': {
        if (expr.atomIds && expr.atomIds.length > 0) {
          return new Set(expr.atomIds);
        }
        if (expr.query) {
          return this.evaluateQuery(expr.query).selected_ids;
        }
        const match = this.namedSelections.find(s => s.name.toLowerCase() === expr.name.toLowerCase());
        if (match) {
          if (match.atomIds && match.atomIds.length > 0) {
            return new Set(match.atomIds);
          }
          return this.evaluateQuery(match.query).selected_ids;
        }
        throw new Error(`Unknown selection reference '${expr.name}'`);
      }

      case 'flag':
        return this.evaluateFlag(expr.flag);

      case 'property':
        return this.evaluateProperty(expr);

      case 'comparison':
        return this.evaluateComparisonExpr(expr);

      case 'and': {
        const left = this.evaluateAST(expr.left);
        const right = this.evaluateAST(expr.right);
        const result = new Set<number>();
        for (const id of left) {
          if (right.has(id)) result.add(id);
        }
        return result;
      }

      case 'or': {
        const left = this.evaluateAST(expr.left);
        const right = this.evaluateAST(expr.right);
        const result = new Set<number>(left);
        for (const id of right) {
          result.add(id);
        }
        return result;
      }

      case 'not': {
        // Crucial: NOT complement universe U(scope, state) is strictly this.atoms within this molecule/object
        const operand = this.evaluateAST(expr.operand);
        const result = new Set<number>();
        for (let i = 0; i < this.atoms.length; i++) {
          const id = this.atoms[i].canonical_id;
          if (!operand.has(id)) {
            result.add(id);
          }
        }
        return result;
      }

      case 'byres': {
        const operand = this.evaluateAST(expr.operand);
        const result = new Set<number>();
        const targetResIds = new Set<string>();

        for (const aId of operand) {
          const resId = this.atomIdToResidueId.get(aId);
          if (resId) targetResIds.add(resId);
        }

        for (const resId of targetResIds) {
          const res = this.molecule.residue_map.get(resId);
          if (res) {
            for (let i = 0; i < res.atom_ids.length; i++) {
              result.add(res.atom_ids[i]);
            }
          }
        }
        return result;
      }

      case 'bychain': {
        const operand = this.evaluateAST(expr.operand);
        const result = new Set<number>();
        const targetChainIds = new Set<string>();

        for (const aId of operand) {
          const chainId = this.atomIdToChainId.get(aId);
          if (chainId) targetChainIds.add(chainId);
        }

        for (const chainId of targetChainIds) {
          const chain = this.molecule.chain_map.get(chainId);
          if (chain) {
            for (let i = 0; i < chain.atom_ids.length; i++) {
              result.add(chain.atom_ids[i]);
            }
          }
        }
        return result;
      }

      case 'bymolecule': {
        const operand = this.evaluateAST(expr.operand);
        const visited = new Set<number>();
        const queue: number[] = [];

        for (const id of operand) {
          visited.add(id);
          queue.push(id);
        }

        const adj = this.molecule.topology.adjacency_map;
        while (queue.length > 0) {
          const currId = queue.shift()!;
          const neighbors = adj.get(currId);
          if (neighbors) {
            for (let i = 0; i < neighbors.length; i++) {
              const nId = neighbors[i];
              if (!visited.has(nId)) {
                visited.add(nId);
                queue.push(nId);
              }
            }
          }
        }
        return visited;
      }

      case 'neighbor': {
        const operand = this.evaluateAST(expr.operand);
        const result = new Set<number>();
        const adj = this.molecule.topology.adjacency_map;

        for (const id of operand) {
          const neighbors = adj.get(id);
          if (neighbors) {
            for (let i = 0; i < neighbors.length; i++) {
              const nId = neighbors[i];
              if (!operand.has(nId)) {
                result.add(nId);
              }
            }
          }
        }
        return result;
      }

      case 'bound_to': {
        const operand = this.evaluateAST(expr.operand);
        const result = new Set<number>();
        const adj = this.molecule.topology.adjacency_map;

        for (const id of operand) {
          const neighbors = adj.get(id);
          if (neighbors) {
            for (let i = 0; i < neighbors.length; i++) {
              result.add(neighbors[i]);
            }
          }
        }
        return result;
      }

      case 'bycalpha': {
        const operand = this.evaluateAST(expr.operand);
        const targetResIds = new Set<string>();
        for (const aId of operand) {
          const resId = this.atomIdToResidueId.get(aId);
          if (resId) targetResIds.add(resId);
        }
        const result = new Set<number>();
        for (const resId of targetResIds) {
          const res = this.molecule.residue_map.get(resId);
          if (res) {
            for (const aId of res.atom_ids) {
              const atom = this.molecule.atom_map.get(aId);
              if (atom && atom.name.trim().toUpperCase() === 'CA') {
                result.add(aId);
              }
            }
          }
        }
        return result;
      }

      case 'byring': {
        const operand = this.evaluateAST(expr.operand);
        const aromaticRes = ['PHE', 'TYR', 'TRP', 'HIS', 'PRO'];
        const aromaticNames: Record<string, string[]> = {
          PHE: ['CG', 'CD1', 'CD2', 'CE1', 'CE2', 'CZ'],
          TYR: ['CG', 'CD1', 'CD2', 'CE1', 'CE2', 'CZ'],
          HIS: ['CG', 'ND1', 'CD2', 'CE1', 'NE2'],
          TRP: ['CD2', 'CE2', 'CZ2', 'CH2', 'CZ3', 'CE3', 'CD1', 'NE1', 'CG'],
          PRO: ['N', 'CA', 'CB', 'CG', 'CD']
        };
        const resultRing = new Set<number>();
        for (const res of this.molecule.residues) {
          const resn = (res.name || '').toUpperCase();
          if (aromaticRes.includes(resn)) {
            const validNames = aromaticNames[resn] || [];
            const ringAtoms: number[] = [];
            for (const aId of res.atom_ids) {
              const atom = this.molecule.atom_map.get(aId);
              if (atom && validNames.includes(atom.name.trim().toUpperCase())) {
                ringAtoms.push(aId);
              }
            }
            if (ringAtoms.some(aId => operand.has(aId))) {
              ringAtoms.forEach(aId => resultRing.add(aId));
            }
          }
        }
        return resultRing;
      }

      case 'extend': {
        const operand = this.evaluateAST(expr.operand);
        const visited = new Map<number, number>();
        const queue: number[] = [];

        for (const id of operand) {
          visited.set(id, 0);
          queue.push(id);
        }

        const adj = this.molecule.topology.adjacency_map;
        while (queue.length > 0) {
          const currId = queue.shift()!;
          const depth = visited.get(currId)!;
          if (depth < expr.steps) {
            const neighbors = adj.get(currId);
            if (neighbors) {
              for (let i = 0; i < neighbors.length; i++) {
                const nId = neighbors[i];
                if (!visited.has(nId)) {
                  visited.set(nId, depth + 1);
                  queue.push(nId);
                }
              }
            }
          }
        }

        return new Set(visited.keys());
      }

      case 'around': {
        const operand = this.evaluateAST(expr.operand);
        const grid = new CanonicalSpatialGrid(expr.distance, this.atoms, operand, this.stateCoordinates);
        const result = new Set<number>();

        for (let i = 0; i < this.atoms.length; i++) {
          const atom = this.atoms[i];
          const x = this.stateCoordinates ? this.stateCoordinates[i].x : atom.x;
          const y = this.stateCoordinates ? this.stateCoordinates[i].y : atom.y;
          const z = this.stateCoordinates ? this.stateCoordinates[i].z : atom.z;
          if (!operand.has(atom.canonical_id) && grid.isNear(x, y, z)) {
            result.add(atom.canonical_id);
          }
        }
        return result;
      }

      case 'within': {
        const operand = this.evaluateAST(expr.operand);
        const grid = new CanonicalSpatialGrid(expr.distance, this.atoms, operand, this.stateCoordinates);
        const result = new Set<number>();

        for (let i = 0; i < this.atoms.length; i++) {
          const atom = this.atoms[i];
          const x = this.stateCoordinates ? this.stateCoordinates[i].x : atom.x;
          const y = this.stateCoordinates ? this.stateCoordinates[i].y : atom.y;
          const z = this.stateCoordinates ? this.stateCoordinates[i].z : atom.z;
          if (grid.isNear(x, y, z)) {
            result.add(atom.canonical_id);
          }
        }
        return result;
      }

      case 'expand': {
        const operand = this.evaluateAST(expr.operand);
        const grid = new CanonicalSpatialGrid(expr.distance, this.atoms, operand, this.stateCoordinates);
        const result = new Set<number>(operand);

        for (let i = 0; i < this.atoms.length; i++) {
          const atom = this.atoms[i];
          const x = this.stateCoordinates ? this.stateCoordinates[i].x : atom.x;
          const y = this.stateCoordinates ? this.stateCoordinates[i].y : atom.y;
          const z = this.stateCoordinates ? this.stateCoordinates[i].z : atom.z;
          if (!operand.has(atom.canonical_id) && grid.isNear(x, y, z)) {
            result.add(atom.canonical_id);
          }
        }
        return result;
      }

      case 'beyond': {
        const operand = this.evaluateAST(expr.operand);
        const grid = new CanonicalSpatialGrid(expr.distance, this.atoms, operand, this.stateCoordinates);
        const result = new Set<number>();

        for (let i = 0; i < this.atoms.length; i++) {
          const atom = this.atoms[i];
          const x = this.stateCoordinates ? this.stateCoordinates[i].x : atom.x;
          const y = this.stateCoordinates ? this.stateCoordinates[i].y : atom.y;
          const z = this.stateCoordinates ? this.stateCoordinates[i].z : atom.z;
          if (!grid.isNear(x, y, z)) {
            result.add(atom.canonical_id);
          }
        }
        return result;
      }

      default:
        return new Set();
    }
  }

  evaluateFlag(flag: string): Set<number> {
    const result = new Set<number>();
    const fl = flag.toLowerCase();

    if (fl === 'all') {
      for (let i = 0; i < this.atoms.length; i++) {
        result.add(this.atoms[i].canonical_id);
      }
      return result;
    }

    if (fl === 'none') {
      return result;
    }

    for (let i = 0; i < this.legacyAtoms.length; i++) {
      if (this.dummyParser.matchFlag(this.legacyAtoms[i], fl)) {
        result.add(this.atoms[i].canonical_id);
      }
    }

    return result;
  }

  evaluateProperty(expr: any): Set<number> {
    const result = new Set<number>();

    for (let i = 0; i < this.legacyAtoms.length; i++) {
      if (this.dummyParser.matchProperty(this.legacyAtoms[i], expr)) {
        result.add(this.atoms[i].canonical_id);
      }
    }

    return result;
  }

  evaluateComparisonExpr(expr: any): Set<number> {
    const result = new Set<number>();

    for (let i = 0; i < this.legacyAtoms.length; i++) {
      if (this.dummyParser.matchComparison(this.legacyAtoms[i], expr)) {
        result.add(this.atoms[i].canonical_id);
      }
    }

    return result;
  }

  /**
   * Evaluates a selection query across a CanonicalMolecularDocument workspace.
   * Supports ACTIVE_OBJECT, EXPLICIT_OBJECT, and WORKSPACE scopes.
   */
  static evaluateDocument(
    document: CanonicalMolecularDocument,
    query: string,
    scope?: {
      scopeType?: 'active_object' | 'explicit_object' | 'workspace';
      objectId?: string;
      stateId?: string;
      namedSelections?: { name: string; query: string; atomIds?: number[]; objectId?: string }[];
    }
  ): ScopedSelectionResult {
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const scopeType = scope?.scopeType || (scope?.objectId ? 'explicit_object' : 'active_object');
    const objectResults = new Map<string, SelectionResult>();
    const scopedKeys = new Set<string>();
    let totalCount = 0;

    const getObjectNamedSelections = (objId: string) => {
      if (!scope?.namedSelections) return [];
      return scope.namedSelections.filter(s => !s.objectId || s.objectId === objId);
    };

    if (scopeType === 'explicit_object') {
      if (!scope?.objectId) {
        throw new Error('evaluateDocument: explicit_object scope requires objectId');
      }
      const obj = document.objects.get(scope.objectId);
      if (!obj) {
        throw new Error(`evaluateDocument: object "${scope.objectId}" does not exist in document`);
      }
      const mol = document.molecules.get(obj.molecule_ref);
      if (!mol) {
        throw new Error(`evaluateDocument: molecule "${obj.molecule_ref}" not found for object "${scope.objectId}"`);
      }
      const targetStateId = scope.stateId || obj.active_state_id;
      const state = targetStateId ? document.states.get(targetStateId) : undefined;
      const objNamedSels = getObjectNamedSelections(obj.object_id);
      const evaluator = new CanonicalSelectionEvaluator(mol, {
        objectId: obj.object_id,
        stateId: targetStateId,
        state: state,
        namedSelections: objNamedSels
      });
      const singleRes = evaluator.evaluateQuery(query, {
        objectId: obj.object_id,
        stateId: targetStateId,
        scopeType: 'explicit_object'
      });
      objectResults.set(obj.object_id, singleRes);
      for (const aId of singleRes.selected_ids) {
        scopedKeys.add(createScopedAtomKey(obj.object_id, aId));
      }
      totalCount = singleRes.count;
    } else if (scopeType === 'active_object') {
      if (document.active_object_id) {
        const obj = document.objects.get(document.active_object_id);
        if (obj) {
          const mol = document.molecules.get(obj.molecule_ref);
          if (mol) {
            const targetStateId = scope?.stateId || obj.active_state_id;
            const state = targetStateId ? document.states.get(targetStateId) : undefined;
            const objNamedSels = getObjectNamedSelections(obj.object_id);
            const evaluator = new CanonicalSelectionEvaluator(mol, {
              objectId: obj.object_id,
              stateId: targetStateId,
              state: state,
              namedSelections: objNamedSels
            });
            const singleRes = evaluator.evaluateQuery(query, {
              objectId: obj.object_id,
              stateId: targetStateId,
              scopeType: 'active_object'
            });
            objectResults.set(obj.object_id, singleRes);
            for (const aId of singleRes.selected_ids) {
              scopedKeys.add(createScopedAtomKey(obj.object_id, aId));
            }
            totalCount = singleRes.count;
          }
        }
      }
    } else if (scopeType === 'workspace') {
      for (const [objId, obj] of document.objects.entries()) {
        if (!obj.enabled) continue;
        const mol = document.molecules.get(obj.molecule_ref);
        if (!mol) continue;
        const targetStateId = obj.active_state_id;
        const state = targetStateId ? document.states.get(targetStateId) : undefined;
        const objNamedSels = getObjectNamedSelections(objId);
        const evaluator = new CanonicalSelectionEvaluator(mol, {
          objectId: objId,
          stateId: targetStateId,
          state: state,
          namedSelections: objNamedSels
        });
        const singleRes = evaluator.evaluateQuery(query, {
          objectId: objId,
          stateId: targetStateId,
          scopeType: 'workspace'
        });
        objectResults.set(objId, singleRes);
        for (const aId of singleRes.selected_ids) {
          scopedKeys.add(createScopedAtomKey(objId, aId));
        }
        totalCount += singleRes.count;
      }
    }

    const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

    return {
      query: query,
      scoped_keys: scopedKeys,
      object_results: objectResults,
      total_count: totalCount,
      execution_time_ms: endTime - startTime
    };
  }

  /**
   * Validates a selection against a document to detect stale atoms, missing objects, or missing states.
   */
  static validateSelection(
    document: CanonicalMolecularDocument,
    selection: SelectionResult | ScopedSelectionResult
  ): {
    valid: boolean;
    staleKeys: string[];
    missingObjects: string[];
    missingStates: string[];
  } {
    const staleKeys: string[] = [];
    const missingObjects: string[] = [];
    const missingStates: string[] = [];

    if ('scoped_keys' in selection) {
      // ScopedSelectionResult
      for (const [objId, objRes] of selection.object_results.entries()) {
        const obj = document.objects.get(objId);
        if (!obj) {
          missingObjects.push(objId);
          continue;
        }
        if (objRes.state_id && !document.states.has(objRes.state_id)) {
          missingStates.push(objRes.state_id);
        }
        const mol = document.molecules.get(obj.molecule_ref);
        if (!mol) {
          missingObjects.push(objId);
          continue;
        }
        for (const aId of objRes.selected_ids) {
          if (!mol.atom_map.has(aId)) {
            staleKeys.push(createScopedAtomKey(objId, aId));
          }
        }
      }
    } else {
      // Single SelectionResult
      const objId = selection.object_id;
      if (objId) {
        const obj = document.objects.get(objId);
        if (!obj) {
          missingObjects.push(objId);
        } else {
          if (selection.state_id && !document.states.has(selection.state_id)) {
            missingStates.push(selection.state_id);
          }
          const mol = document.molecules.get(obj.molecule_ref);
          if (mol) {
            for (const aId of selection.selected_ids) {
              if (!mol.atom_map.has(aId)) {
                staleKeys.push(createScopedAtomKey(objId, aId));
              }
            }
          }
        }
      }
    }

    const valid = staleKeys.length === 0 && missingObjects.length === 0 && missingStates.length === 0;
    return { valid, staleKeys, missingObjects, missingStates };
  }
}
