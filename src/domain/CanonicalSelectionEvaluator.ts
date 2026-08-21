import {
  CanonicalAtom,
  CanonicalMolecule,
  SelectionResult
} from '../types/domain';
import { SelectionParser, Atom } from '../lib/SelectionParser';

class CanonicalSpatialGrid {
  cellSize: number;
  grid: Map<string, CanonicalAtom[]>;

  constructor(cellSize: number, atoms: CanonicalAtom[], targetIds: Set<number>) {
    this.cellSize = Math.max(cellSize, 0.1);
    this.grid = new Map();

    for (let i = 0; i < atoms.length; i++) {
      const atom = atoms[i];
      if (targetIds.has(atom.canonical_id)) {
        const key = this.getKey(atom.x, atom.y, atom.z);
        let cell = this.grid.get(key);
        if (!cell) {
          cell = [];
          this.grid.set(key, cell);
        }
        cell.push(atom);
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
 * Evaluates Selection AST directly against CanonicalMolecule domain structures.
 */
export class CanonicalSelectionEvaluator {
  molecule: CanonicalMolecule;
  atoms: CanonicalAtom[];
  legacyAtoms: Atom[];
  dummyParser: SelectionParser;
  atomIdToResidueId: Map<number, string>;
  atomIdToChainId: Map<number, string>;

  constructor(molecule: CanonicalMolecule) {
    this.molecule = molecule;
    this.atoms = molecule.atoms;
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
    this.legacyAtoms = this.atoms.map(ca => ({
      serial: ca.canonical_id,
      elem: ca.element,
      name: ca.name,
      resName: ca.residue_name,
      resSeq: ca.residue_ref,
      chainID: ca.chain_ref,
      bonds: [],
      x: ca.x,
      y: ca.y,
      z: ca.z,
      isHetero: ca.is_hetero,
      altLoc: ca.alt_loc,
      bFactor: ca.b_factor,
      occupancy: ca.occupancy,
      ss: ca.secondary_structure,
      isModeledH: ca.modeled_hydrogen
    }));
    this.dummyParser = new SelectionParser(this.legacyAtoms);
  }

  /**
   * Evaluates a selection query string against the canonical molecule.
   */
  evaluateQuery(query: string, options?: { objectId?: string; stateId?: string }): SelectionResult {
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const qTrim = query.trim();
    if (!qTrim) {
      return {
        query: query,
        selected_ids: new Set(),
        selected_array: [],
        count: 0,
        object_id: options?.objectId,
        state_id: options?.stateId,
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
      object_id: options?.objectId,
      state_id: options?.stateId,
      execution_time_ms: endTime - startTime
    };
  }

  evaluateAST(expr: any): Set<number> {
    if (!expr) return new Set();

    switch (expr.type) {
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
              result.add(neighbors[i]);
            }
          }
        }
        return result;
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
        const grid = new CanonicalSpatialGrid(expr.distance, this.atoms, operand);
        const result = new Set<number>();

        for (let i = 0; i < this.atoms.length; i++) {
          const atom = this.atoms[i];
          if (!operand.has(atom.canonical_id) && grid.isNear(atom.x, atom.y, atom.z)) {
            result.add(atom.canonical_id);
          }
        }
        return result;
      }

      case 'within': {
        const operand = this.evaluateAST(expr.operand);
        const grid = new CanonicalSpatialGrid(expr.distance, this.atoms, operand);
        const result = new Set<number>();

        for (let i = 0; i < this.atoms.length; i++) {
          const atom = this.atoms[i];
          if (grid.isNear(atom.x, atom.y, atom.z)) {
            result.add(atom.canonical_id);
          }
        }
        return result;
      }

      case 'beyond': {
        const operand = this.evaluateAST(expr.operand);
        const grid = new CanonicalSpatialGrid(expr.distance, this.atoms, operand);
        const result = new Set<number>();

        for (let i = 0; i < this.atoms.length; i++) {
          const atom = this.atoms[i];
          if (!grid.isNear(atom.x, atom.y, atom.z)) {
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
}
