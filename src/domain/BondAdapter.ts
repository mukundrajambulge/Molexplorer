import { CanonicalAtom, CanonicalBond, CanonicalTopology } from '../types/domain';

export class BondEndpointError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BondEndpointError';
  }
}

export class SelfBondError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SelfBondError';
  }
}

export class DuplicateBondError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateBondError';
  }
}

export class BondValenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BondValenceError';
  }
}

export class ConformerDisjointnessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConformerDisjointnessError';
  }
}

/**
 * Generates a normalized, deterministic string key for an unordered bond edge.
 */
export function createBondKey(atomA_id: number, atomB_id: number): string {
  const minId = Math.min(atomA_id, atomB_id);
  const maxId = Math.max(atomA_id, atomB_id);
  return `${minId}:${maxId}`;
}

/**
 * Validates supported numeric bond orders (1, 1.5, 2, 3).
 */
export function normalizeBondOrder(rawOrder?: number | string | null): 1 | 1.5 | 2 | 3 {
  if (rawOrder === undefined || rawOrder === null) return 1;
  const num = typeof rawOrder === 'string' ? parseFloat(rawOrder) : rawOrder;
  if (num === 1.5) return 1.5;
  if (num === 2) return 2;
  if (num === 3) return 3;
  if (num === 1) return 1;
  throw new BondValenceError(`Unsupported bond order ${rawOrder}: must be 1, 1.5, 2, or 3.`);
}

/**
 * Pure, deterministic constructor for a single CanonicalBond.
 * Ensures atom_a < atom_b endpoint normalization.
 */
export function toCanonicalBond(
  atomA_id: number,
  atomB_id: number,
  options?: {
    order?: number;
    is_aromatic?: boolean;
    source?: 'file' | 'inferred' | 'editor';
    bond_id?: string;
    confidence?: number;
    provenance?: string;
  }
): CanonicalBond {
  if (!Number.isInteger(atomA_id) || !Number.isInteger(atomB_id)) {
    throw new BondEndpointError(`Invalid non-integer bond endpoints: [${atomA_id}, ${atomB_id}]`);
  }

  if (atomA_id === atomB_id) {
    throw new SelfBondError(`Self-bonding is prohibited: atom ID ${atomA_id} cannot bond to itself.`);
  }

  const minId = Math.min(atomA_id, atomB_id);
  const maxId = Math.max(atomA_id, atomB_id);

  const order = normalizeBondOrder(options?.order);
  const isAromatic = options?.is_aromatic !== undefined ? options.is_aromatic : (order === 1.5);
  const source = options?.source || 'inferred';
  const isInferred = source === 'inferred';
  const bondId = options?.bond_id || `b-${minId}-${maxId}`;

  return {
    bond_id: bondId,
    atom_a: minId,
    atom_b: maxId,
    order: order,
    is_aromatic: isAromatic,
    source: source,
    is_inferred: isInferred,
    confidence: options?.confidence ?? (source === 'file' ? 1.0 : 0.95),
    provenance: options?.provenance
  };
}

/**
 * Validates a single CanonicalBond against scientific integrity and topology rules.
 */
export function validateCanonicalBond(
  bond: CanonicalBond,
  validAtomIds: Set<number>,
  atomMap?: Map<number, CanonicalAtom>
): void {
  if (!validAtomIds.has(bond.atom_a)) {
    throw new BondEndpointError(`Bond endpoint atom_a (${bond.atom_a}) does not exist in molecule.`);
  }

  if (!validAtomIds.has(bond.atom_b)) {
    throw new BondEndpointError(`Bond endpoint atom_b (${bond.atom_b}) does not exist in molecule.`);
  }

  if (bond.atom_a === bond.atom_b) {
    throw new SelfBondError(`Self-bonding detected on atom ID ${bond.atom_a}.`);
  }

  if (bond.atom_a > bond.atom_b) {
    throw new BondEndpointError(`Bond endpoints are not normalized: atom_a (${bond.atom_a}) > atom_b (${bond.atom_b}).`);
  }

  if (![1, 1.5, 2, 3].includes(bond.order)) {
    throw new BondValenceError(`Invalid bond order ${bond.order} for bond ${bond.bond_id}.`);
  }

  // Conformer disjointness validation (P0.2 Rule DM-TOP-004)
  if (atomMap) {
    const a1 = atomMap.get(bond.atom_a);
    const a2 = atomMap.get(bond.atom_b);
    if (a1 && a2) {
      const alt1 = (a1.alt_loc || ' ').trim();
      const alt2 = (a2.alt_loc || ' ').trim();
      if (alt1.length > 0 && alt2.length > 0 && alt1 !== alt2) {
        throw new ConformerDisjointnessError(
          `Disjoint conformer bonding violation: atom ${bond.atom_a} (altLoc '${alt1}') cannot bond to atom ${bond.atom_b} (altLoc '${alt2}').`
        );
      }
    }
  }
}

/**
 * Validates an entire collection of CanonicalBonds.
 * Asserts endpoint existence, lack of duplicate edges, and valid connectivity.
 */
export function validateCanonicalBondSet(
  bonds: CanonicalBond[],
  validAtomIds: Set<number>,
  atomMap?: Map<number, CanonicalAtom>
): void {
  const seenKeys = new Set<string>();

  for (let i = 0; i < bonds.length; i++) {
    const bond = bonds[i];
    validateCanonicalBond(bond, validAtomIds, atomMap);

    const key = createBondKey(bond.atom_a, bond.atom_b);
    if (seenKeys.has(key)) {
      throw new DuplicateBondError(`Duplicate bond edge detected between atom IDs ${bond.atom_a} and ${bond.atom_b}.`);
    }
    seenKeys.add(key);
  }
}

/**
 * Pure, deterministic conversion of legacy Atom.bonds neighbor index arrays into a deduplicated CanonicalBond array.
 * 
 * - Bridges 0-based array index bonds to 1-based CanonicalAtom IDs.
 * - Normalizes endpoints to atom_a < atom_b.
 * - Sorts deterministically: primary by atom_a ascending, secondary by atom_b ascending.
 */
export function toCanonicalBondSet(
  canonicalAtoms: CanonicalAtom[],
  sourceAtoms: any[],
  options?: { defaultSource?: 'file' | 'inferred' | 'editor' }
): CanonicalBond[] {
  if (!Array.isArray(canonicalAtoms) || !Array.isArray(sourceAtoms)) {
    throw new Error('toCanonicalBondSet: canonicalAtoms and sourceAtoms must be arrays');
  }

  const validAtomIds = new Set<number>(canonicalAtoms.map(a => a.canonical_id));
  const atomMap = new Map<number, CanonicalAtom>(canonicalAtoms.map(a => [a.canonical_id, a]));
  const bondMap = new Map<string, CanonicalBond>();

  for (let i = 0; i < sourceAtoms.length; i++) {
    const sourceAtom = sourceAtoms[i];
    if (!sourceAtom || !Array.isArray(sourceAtom.bonds)) continue;

    const sourceCanonicalAtom = canonicalAtoms[i];
    if (!sourceCanonicalAtom) continue;

    const atomA_id = sourceCanonicalAtom.canonical_id;

    for (let b = 0; b < sourceAtom.bonds.length; b++) {
      const neighborIdx = sourceAtom.bonds[b];
      if (neighborIdx < 0 || neighborIdx >= canonicalAtoms.length || neighborIdx === i) {
        continue; // Skip invalid indices or self-bonds in legacy data
      }

      const neighborCanonicalAtom = canonicalAtoms[neighborIdx];
      if (!neighborCanonicalAtom) continue;

      const atomB_id = neighborCanonicalAtom.canonical_id;
      const key = createBondKey(atomA_id, atomB_id);

      if (!bondMap.has(key)) {
        const bond = toCanonicalBond(atomA_id, atomB_id, {
          source: options?.defaultSource || 'inferred',
          order: 1
        });
        bondMap.set(key, bond);
      }
    }
  }

  // Deterministically sort bonds: primary sort by atom_a asc, secondary by atom_b asc
  const bonds = Array.from(bondMap.values()).sort((a, b) => {
    if (a.atom_a !== b.atom_a) return a.atom_a - b.atom_a;
    return a.atom_b - b.atom_b;
  });

  validateCanonicalBondSet(bonds, validAtomIds, atomMap);
  return bonds;
}

/**
 * Builds the complete CanonicalTopology graph containing sorted bonds and fast O(1) lookup structures.
 */
export function buildCanonicalTopology(
  canonicalAtoms: CanonicalAtom[],
  canonicalBonds: CanonicalBond[]
): CanonicalTopology {
  const adjacencyMap = new Map<number, number[]>();
  const bondMap = new Map<string, CanonicalBond>();

  for (const atom of canonicalAtoms) {
    adjacencyMap.set(atom.canonical_id, []);
  }

  for (const bond of canonicalBonds) {
    const key = createBondKey(bond.atom_a, bond.atom_b);
    bondMap.set(key, bond);

    const neighborsA = adjacencyMap.get(bond.atom_a);
    if (neighborsA && !neighborsA.includes(bond.atom_b)) {
      neighborsA.push(bond.atom_b);
    }

    const neighborsB = adjacencyMap.get(bond.atom_b);
    if (neighborsB && !neighborsB.includes(bond.atom_a)) {
      neighborsB.push(bond.atom_a);
    }
  }

  // Sort neighbor lists for strict determinism
  for (const [id, neighbors] of adjacencyMap.entries()) {
    neighbors.sort((a, b) => a - b);
  }

  return {
    bonds: canonicalBonds,
    adjacency_map: adjacencyMap,
    bond_map: bondMap
  };
}
