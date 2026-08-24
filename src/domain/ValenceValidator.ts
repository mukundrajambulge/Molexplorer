import { CanonicalAtom, CanonicalMolecule, CanonicalBond, ValidationReport } from '../types/domain';

export interface ValenceLimits {
  standard: number;
  max: number;
  hardMax: number; // Hard chemical limit above which transaction must fail
}

/**
 * Normative elemental valency limits as specified in docs/science/EDITING_KERNEL_SPEC.md.
 */
export const ELEMENT_VALENCE_LIMITS: Record<string, ValenceLimits> = {
  H: { standard: 1, max: 1, hardMax: 1.0 },
  HE: { standard: 0, max: 0, hardMax: 0 },
  LI: { standard: 1, max: 1, hardMax: 1 },
  BE: { standard: 2, max: 2, hardMax: 2 },
  B: { standard: 3, max: 4, hardMax: 4 },
  C: { standard: 4, max: 4, hardMax: 4.5 }, // 4.5 allows aromatic resonance
  N: { standard: 3, max: 4, hardMax: 4.5 },
  O: { standard: 2, max: 3, hardMax: 3.5 },
  F: { standard: 1, max: 1, hardMax: 1.0 },
  NE: { standard: 0, max: 0, hardMax: 0 },
  NA: { standard: 1, max: 1, hardMax: 1 },
  MG: { standard: 2, max: 2, hardMax: 2 },
  AL: { standard: 3, max: 4, hardMax: 6 },
  SI: { standard: 4, max: 4, hardMax: 6 },
  P: { standard: 3, max: 5, hardMax: 6.0 },
  S: { standard: 2, max: 6, hardMax: 6.5 },
  CL: { standard: 1, max: 1, hardMax: 3 },
  AR: { standard: 0, max: 0, hardMax: 0 },
  K: { standard: 1, max: 1, hardMax: 1 },
  CA: { standard: 2, max: 2, hardMax: 2 },
  MN: { standard: 2, max: 4, hardMax: 6 },
  FE: { standard: 2, max: 3, hardMax: 6 },
  CO: { standard: 2, max: 3, hardMax: 6 },
  NI: { standard: 2, max: 2, hardMax: 6 },
  CU: { standard: 1, max: 2, hardMax: 4 },
  ZN: { standard: 2, max: 2, hardMax: 4 },
  BR: { standard: 1, max: 1, hardMax: 3 },
  I: { standard: 1, max: 1, hardMax: 5 }
};

export const COMMON_METALS = new Set([
  'LI', 'NA', 'K', 'RB', 'CS', 'MG', 'CA', 'SR', 'BA',
  'AL', 'GA', 'IN', 'SN', 'PB', 'SC', 'TI', 'V', 'CR',
  'MN', 'FE', 'CO', 'NI', 'CU', 'ZN', 'MO', 'TC', 'RU',
  'RH', 'PD', 'AG', 'CD', 'PT', 'AU', 'HG'
]);

export interface HydrogenFillEligibility {
  eligible: boolean;
  rejection_reason?:
    | 'METALS_DEFERRED'
    | 'NON_HYDROGEN_ACCEPTOR_ELEMENT'
    | 'VALENCE_SATURATED'
    | 'UNSUPPORTED_FORMAL_CHARGE'
    | 'HYPERVALENT_DEFERRED'
    | 'ALREADY_HYDROGEN';
  target_valence: number;
  bond_order_sum: number;
  remaining_valence: number;
  needed_hydrogens: number;
}

/**
 * Calculates the total incident bond order sum for a canonical atom.
 */
export function calculateAtomValence(
  atomId: number,
  topologyBonds: CanonicalBond[]
): number {
  let sum = 0;
  for (let i = 0; i < topologyBonds.length; i++) {
    const b = topologyBonds[i];
    if (b.atom_a === atomId || b.atom_b === atomId) {
      sum += b.order;
    }
  }
  return sum;
}

export const bond_order_sum = calculateAtomValence;

/**
 * Computes nominal target valence for an atom based on element and formal charge.
 */
export function getTargetValence(atom: CanonicalAtom): number {
  const elem = atom.element.toUpperCase().trim();
  const charge = atom.formal_charge || 0;

  switch (elem) {
    case 'C':
      return 4;
    case 'N':
      return charge > 0 ? 4 : 3;
    case 'O':
      return charge < 0 ? 1 : (charge > 0 ? 3 : 2);
    case 'S':
      return charge < 0 ? 1 : 2;
    case 'P':
      return 3;
    case 'H':
      return 1;
    case 'F':
    case 'CL':
    case 'BR':
    case 'I':
      return 1;
    default:
      return ELEMENT_VALENCE_LIMITS[elem]?.standard || 0;
  }
}

/**
 * Formal Hydrogen Fill Eligibility Predicate: hydrogen_fill_eligibility(atom)
 */
export function checkHydrogenFillEligibility(
  atom: CanonicalAtom,
  topologyBonds: CanonicalBond[]
): HydrogenFillEligibility {
  const elem = atom.element.toUpperCase().trim();
  const boSum = calculateAtomValence(atom.canonical_id, topologyBonds);

  if (elem === 'H') {
    return {
      eligible: false,
      rejection_reason: 'ALREADY_HYDROGEN',
      target_valence: 1,
      bond_order_sum: boSum,
      remaining_valence: 0,
      needed_hydrogens: 0
    };
  }

  if (COMMON_METALS.has(elem)) {
    return {
      eligible: false,
      rejection_reason: 'METALS_DEFERRED',
      target_valence: ELEMENT_VALENCE_LIMITS[elem]?.standard || 2,
      bond_order_sum: boSum,
      remaining_valence: 0,
      needed_hydrogens: 0
    };
  }

  const allowedNonMetals = new Set(['C', 'N', 'O', 'S', 'P']);
  if (!allowedNonMetals.has(elem)) {
    return {
      eligible: false,
      rejection_reason: 'NON_HYDROGEN_ACCEPTOR_ELEMENT',
      target_valence: ELEMENT_VALENCE_LIMITS[elem]?.standard || 0,
      bond_order_sum: boSum,
      remaining_valence: 0,
      needed_hydrogens: 0
    };
  }

  const targetVal = getTargetValence(atom);
  const remaining = Math.max(0, targetVal - boSum);
  const needed = Math.floor(remaining);

  if (boSum >= targetVal || needed <= 0) {
    return {
      eligible: false,
      rejection_reason: 'VALENCE_SATURATED',
      target_valence: targetVal,
      bond_order_sum: boSum,
      remaining_valence: remaining,
      needed_hydrogens: 0
    };
  }

  return {
    eligible: true,
    target_valence: targetVal,
    bond_order_sum: boSum,
    remaining_valence: remaining,
    needed_hydrogens: needed
  };
}

/**
 * Validates valence for specified atom IDs (or all atoms) in a CanonicalMolecule.
 * Classifies results into HARD ERRORS (abort transaction), WARNINGS, and INFO.
 */
export function validateMolecularValence(
  molecule: CanonicalMolecule,
  targetAtomIds?: number[]
): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];

  const atomsToCheck = targetAtomIds
    ? targetAtomIds.map(id => molecule.atom_map.get(id)).filter((a): a is CanonicalAtom => !!a)
    : molecule.atoms;

  for (let i = 0; i < atomsToCheck.length; i++) {
    const atom = atomsToCheck[i];
    const elem = atom.element.toUpperCase().trim();
    const valence = calculateAtomValence(atom.canonical_id, molecule.topology.bonds);
    const limits = ELEMENT_VALENCE_LIMITS[elem];

    if (limits) {
      if (valence > limits.hardMax) {
        errors.push(
          `HARD ERROR: Atom ${atom.canonical_id} (${elem} in ${atom.residue_name}${atom.residue_ref}) valence load ${valence} exceeds hard chemical limit of ${limits.hardMax}.`
        );
      } else if (valence > limits.max) {
        warnings.push(
          `WARNING: Atom ${atom.canonical_id} (${elem}) valence load ${valence} exceeds standard maximum ${limits.max}.`
        );
      } else if (valence > limits.standard) {
        info.push(
          `INFO: Atom ${atom.canonical_id} (${elem}) has expanded / hypervalent state (${valence} > standard ${limits.standard}).`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    info
  };
}
