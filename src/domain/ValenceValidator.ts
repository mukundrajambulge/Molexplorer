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
  BR: { standard: 1, max: 1, hardMax: 3 },
  I: { standard: 1, max: 1, hardMax: 5 }
};

/**
 * Calculates the total valence (sum of incident bond orders) for a canonical atom.
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
