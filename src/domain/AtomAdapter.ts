import { CanonicalAtom } from '../types/domain';

/**
 * Standard IUPAC Atomic Numbers (Z) for common biological and chemical elements.
 */
export const ATOMIC_NUMBERS: Record<string, number> = {
  H: 1, HE: 2, LI: 3, BE: 4, B: 5, C: 6, N: 7, O: 8, F: 9, NE: 10,
  NA: 11, MG: 12, AL: 13, SI: 14, P: 15, S: 16, CL: 17, AR: 18,
  K: 19, CA: 20, SC: 21, TI: 22, V: 23, CR: 24, MN: 25, FE: 26, CO: 27, NI: 28, CU: 29, ZN: 30,
  GA: 31, GE: 32, AS: 33, SE: 34, BR: 35, KR: 36,
  RB: 37, SR: 38, Y: 39, ZR: 40, NB: 41, MO: 42, TC: 43, RU: 44, RH: 45, PD: 46, AG: 47, CD: 48,
  IN: 49, SN: 50, SB: 51, TE: 52, I: 53, XE: 54,
  CS: 55, BA: 56, LA: 57, CE: 58, PR: 59, ND: 60, PM: 61, SM: 62, EU: 63, GD: 64, TB: 65, DY: 66,
  HO: 67, ER: 68, TM: 69, YB: 70, LU: 71, HF: 72, TA: 73, W: 74, RE: 75, OS: 76, IR: 77, PT: 78,
  AU: 79, HG: 80, TL: 81, PB: 82, BI: 83, PO: 84, AT: 85, RN: 86,
  FR: 87, RA: 88, AC: 89, TH: 90, PA: 91, U: 92, NP: 93, PU: 94, AM: 95, CM: 96, BK: 97, CF: 98,
  ES: 99, FM: 100, MD: 101, NO: 102, LR: 103,
  // Deuterium handling
  D: 1
};

/**
 * Standard Covalent Radii in Angstroms for sanity checking and visualization.
 */
export const COVALENT_RADII: Record<string, number> = {
  H: 0.31, D: 0.31, C: 0.76, N: 0.71, O: 0.66, S: 1.05, P: 1.07, F: 0.57, CL: 1.02, BR: 1.20, I: 1.39,
  MG: 1.41, ZN: 1.22, FE: 1.32, CA: 1.76, NA: 1.66, K: 2.03, MN: 1.39, CU: 1.38, NI: 1.24, CO: 1.26
};

export class CoordinateSanityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CoordinateSanityError';
  }
}

export class CanonicalIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CanonicalIdentityError';
  }
}

export class ElementValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ElementValidationError';
  }
}

/**
 * Normalizes element symbol to standardized uppercase IUPAC representation.
 */
export function normalizeElementSymbol(rawElem: string | undefined | null, atomName?: string): string {
  if (rawElem && rawElem.trim()) {
    const clean = rawElem.trim().toUpperCase().replace(/[^A-Z]/g, '');
    if (clean.length > 0 && ATOMIC_NUMBERS[clean] !== undefined) {
      return clean;
    }
  }

  // Fallback: infer element from atom name if element column was missing or blank
  if (atomName && atomName.trim()) {
    const nameTrim = atomName.trim().toUpperCase().replace(/[^A-Z]/g, '');
    // Check 2-letter element matches first (e.g. FE, MG, ZN, CL, BR, NA, CA)
    if (nameTrim.length >= 2) {
      const twoLetter = nameTrim.slice(0, 2);
      if (ATOMIC_NUMBERS[twoLetter] !== undefined) {
        return twoLetter;
      }
    }
    // Check 1-letter match
    const oneLetter = nameTrim.slice(0, 1);
    if (ATOMIC_NUMBERS[oneLetter] !== undefined) {
      return oneLetter;
    }
  }

  return 'C'; // Standard fallback
}

/**
 * Normalizes atom name string.
 */
export function normalizeAtomName(name: string | undefined | null): string {
  if (!name) return '';
  return name.trim();
}

/**
 * Retrieves standard IUPAC atomic number (Z).
 */
export function getAtomicNumber(normalizedElement: string): number {
  const z = ATOMIC_NUMBERS[normalizedElement.toUpperCase()];
  return z !== undefined ? z : 6;
}

/**
 * Validates a single CanonicalAtom against scientific integrity rules.
 * Fails closed on non-finite coordinates, invalid IDs, or malformed fields.
 */
export function validateCanonicalAtom(atom: CanonicalAtom): void {
  if (!Number.isInteger(atom.canonical_id) || atom.canonical_id <= 0) {
    throw new CanonicalIdentityError(`Invalid canonical_id ${atom.canonical_id}: must be positive non-zero integer.`);
  }

  if (!Number.isFinite(atom.x) || !Number.isFinite(atom.y) || !Number.isFinite(atom.z)) {
    throw new CoordinateSanityError(
      `Non-finite coordinates for atom ID ${atom.canonical_id} (${atom.name}): [${atom.x}, ${atom.y}, ${atom.z}]`
    );
  }

  if (!atom.element || atom.element.trim().length === 0) {
    throw new ElementValidationError(`Missing or empty element for canonical atom ID ${atom.canonical_id}`);
  }

  if (!Number.isInteger(atom.atomic_number) || atom.atomic_number <= 0) {
    throw new ElementValidationError(`Invalid atomic number ${atom.atomic_number} for element ${atom.element}`);
  }
}

/**
 * Validates an entire array of CanonicalAtoms.
 * Asserts uniqueness of canonical IDs and validity of all records.
 */
export function validateCanonicalAtomSet(atoms: CanonicalAtom[]): void {
  const seenIds = new Set<number>();

  for (let i = 0; i < atoms.length; i++) {
    const atom = atoms[i];
    validateCanonicalAtom(atom);

    if (seenIds.has(atom.canonical_id)) {
      throw new CanonicalIdentityError(
        `Duplicate canonical_id detected: ID ${atom.canonical_id} appears multiple times in molecule.`
      );
    }
    seenIds.add(atom.canonical_id);
  }
}

/**
 * Pure, deterministic conversion of a single source atom into a CanonicalAtom.
 * 
 * Implemented against the PROPOSED P0.2 identity policy (OD-001):
 * - canonical_id is assigned sequentially (sequentialIndex + 1).
 * - Original source serial is preserved in source_serial.
 * - Coordinates are verified finite and preserved exactly.
 * - Does not mutate the source object.
 */
export function toCanonicalAtom(
  source: any,
  sequentialIndex: number,
  context?: { moleculeRef?: string }
): CanonicalAtom {
  if (!source) {
    throw new Error('toCanonicalAtom: source atom cannot be null or undefined');
  }

  const rawX = typeof source.x === 'number' ? source.x : parseFloat(source.x);
  const rawY = typeof source.y === 'number' ? source.y : parseFloat(source.y);
  const rawZ = typeof source.z === 'number' ? source.z : parseFloat(source.z);

  if (!Number.isFinite(rawX) || !Number.isFinite(rawY) || !Number.isFinite(rawZ)) {
    throw new CoordinateSanityError(
      `Cannot canonicalize atom: non-finite coordinates [${source.x}, ${source.y}, ${source.z}] for atom ${source.name || source.serial}`
    );
  }

  const rawName = (source.name || '').toString();
  const normalizedElem = normalizeElementSymbol(source.elem || source.element, rawName);
  const atomicNum = getAtomicNumber(normalizedElem);
  const normName = normalizeAtomName(rawName);

  const sourceSerial = typeof source.serial === 'number'
    ? source.serial
    : (typeof source.id === 'number' ? source.id : null);

  const resSeq = typeof source.resSeq === 'number'
    ? source.resSeq
    : (typeof source.residueNumber === 'number' ? source.residueNumber : 1);

  const resName = (source.resName || source.residueName || 'UNK').toString().trim().toUpperCase();
  const chainID = (source.chainID || source.chainId || 'A').toString().trim() || 'A';
  const altLoc = (source.altLoc || source.alt_loc || ' ').toString().slice(0, 1);
  const isHetero = Boolean(source.isHetero ?? source.isHetatm ?? false);
  const bFactor = typeof source.bFactor === 'number' ? source.bFactor : (typeof source.b === 'number' ? source.b : 0.0);
  const occupancy = typeof source.occupancy === 'number' ? source.occupancy : (typeof source.q === 'number' ? source.q : 1.0);
  const formalCharge = typeof source.formalCharge === 'number' ? source.formalCharge : 0;
  const partialCharge = typeof source.partialCharge === 'number' ? source.partialCharge : null;
  const isModeledH = Boolean(source.isModeledH ?? source.modeled_hydrogen ?? false);
  const ss = source.ss || undefined;

  const canonical: CanonicalAtom = {
    canonical_id: sequentialIndex + 1,
    source_serial: sourceSerial,
    molecule_ref: context?.moleculeRef,
    chain_ref: chainID,
    residue_ref: resSeq,
    residue_name: resName,
    element: normalizedElem,
    atomic_number: atomicNum,
    name: rawName,
    normalized_name: normName,
    is_hetero: isHetero,
    x: rawX,
    y: rawY,
    z: rawZ,
    occupancy: occupancy,
    b_factor: bFactor,
    alt_loc: altLoc,
    formal_charge: formalCharge,
    partial_charge: partialCharge,
    modeled_hydrogen: isModeledH,
    secondary_structure: ss
  };

  return canonical;
}

/**
 * Pure, deterministic conversion of an entire source atom collection into a CanonicalAtom array.
 * Validates the entire set post-conversion.
 */
export function toCanonicalAtomSet(
  sourceAtoms: any[],
  context?: { moleculeRef?: string }
): CanonicalAtom[] {
  if (!Array.isArray(sourceAtoms)) {
    throw new Error('toCanonicalAtomSet: sourceAtoms must be an array');
  }

  const canonicalList: CanonicalAtom[] = new Array(sourceAtoms.length);

  for (let i = 0; i < sourceAtoms.length; i++) {
    canonicalList[i] = toCanonicalAtom(sourceAtoms[i], i, context);
  }

  validateCanonicalAtomSet(canonicalList);
  return canonicalList;
}
