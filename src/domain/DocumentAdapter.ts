import {
  CanonicalMolecule,
  CanonicalState,
  CanonicalObject,
  CanonicalMolecularDocument
} from '../types/domain';
import { validateCanonicalMolecule } from './HierarchyAdapter';

export class DocumentIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentIntegrityError';
  }
}

/**
 * Pure function that extracts a coordinate tensor state from a CanonicalMolecule.
 */
export function buildCanonicalState(
  molecule: CanonicalMolecule,
  stateIndex: number = 1,
  stateId?: string,
  name?: string,
  metadata?: Record<string, any>
): CanonicalState {
  if (!molecule || !Array.isArray(molecule.atoms)) {
    throw new DocumentIntegrityError('buildCanonicalState: invalid molecule input.');
  }

  const resolvedStateId = stateId || `${molecule.molecule_id}-state-${stateIndex}`;
  const coordinates = new Array(molecule.atoms.length);

  for (let i = 0; i < molecule.atoms.length; i++) {
    const atom = molecule.atoms[i];
    if (!Number.isFinite(atom.x) || !Number.isFinite(atom.y) || !Number.isFinite(atom.z)) {
      throw new DocumentIntegrityError(
        `Non-finite coordinates encountered for atom ID ${atom.canonical_id} in molecule ${molecule.molecule_id}`
      );
    }
    coordinates[i] = { x: atom.x, y: atom.y, z: atom.z };
  }

  return {
    state_id: resolvedStateId,
    state_index: stateIndex,
    molecule_ref: molecule.molecule_id,
    coordinates: coordinates,
    name: name || `State ${stateIndex}`,
    metadata: metadata
  };
}

/**
 * Pure function that constructs a CanonicalObject bound to a CanonicalMolecule.
 */
export function buildCanonicalObject(
  molecule: CanonicalMolecule,
  activeState: CanonicalState,
  options?: {
    object_id?: string;
    name?: string;
    metadata?: Record<string, any>;
  }
): CanonicalObject {
  if (!molecule) {
    throw new DocumentIntegrityError('buildCanonicalObject: molecule cannot be null or undefined.');
  }
  if (!activeState) {
    throw new DocumentIntegrityError('buildCanonicalObject: activeState cannot be null or undefined.');
  }

  const objectId = options?.object_id || `obj-${molecule.molecule_id}`;
  const objectName = options?.name || molecule.name;

  return {
    object_id: objectId,
    name: objectName,
    molecule_ref: molecule.molecule_id,
    state_ids: [activeState.state_id],
    active_state_id: activeState.state_id,
    enabled: true,
    metadata: options?.metadata
  };
}

/**
 * Validates the complete CanonicalMolecularDocument graph against structural integrity rules.
 */
export function validateCanonicalDocument(document: CanonicalMolecularDocument): void {
  if (!document.document_id || document.document_id.trim().length === 0) {
    throw new DocumentIntegrityError('Invalid document_id: must be a non-empty string.');
  }

  const objectMap = document.objects;
  const moleculeMap = document.molecules;
  const stateMap = document.states;

  // 1. Verify object references in document
  for (const objId of document.object_ids) {
    if (!objectMap.has(objId)) {
      throw new DocumentIntegrityError(`Document lists object ID ${objId} which is missing from objects map.`);
    }
  }

  if (document.active_object_id && !objectMap.has(document.active_object_id)) {
    throw new DocumentIntegrityError(
      `Active object ID ${document.active_object_id} does not exist in document objects map.`
    );
  }

  // 2. Verify objects reference valid molecules and states
  for (const [objId, obj] of objectMap.entries()) {
    if (obj.object_id !== objId) {
      throw new DocumentIntegrityError(`Object key mismatch: key ${objId} vs object_id ${obj.object_id}`);
    }

    if (!moleculeMap.has(obj.molecule_ref)) {
      throw new DocumentIntegrityError(
        `Object ${objId} references non-existent molecule ${obj.molecule_ref}`
      );
    }

    if (!stateMap.has(obj.active_state_id)) {
      throw new DocumentIntegrityError(
        `Object ${objId} references non-existent active state ${obj.active_state_id}`
      );
    }

    for (const sId of obj.state_ids) {
      if (!stateMap.has(sId)) {
        throw new DocumentIntegrityError(`Object ${objId} lists non-existent state ${sId}`);
      }
    }
  }

  // 3. Verify states reference valid molecules and coordinates align
  for (const [sId, state] of stateMap.entries()) {
    if (state.state_id !== sId) {
      throw new DocumentIntegrityError(`State key mismatch: key ${sId} vs state_id ${state.state_id}`);
    }

    const mol = moleculeMap.get(state.molecule_ref);
    if (!mol) {
      throw new DocumentIntegrityError(`State ${sId} references non-existent molecule ${state.molecule_ref}`);
    }

    if (state.coordinates.length !== mol.atoms.length) {
      throw new DocumentIntegrityError(
        `State ${sId} coordinate tensor length (${state.coordinates.length}) does not match molecule atom count (${mol.atoms.length})`
      );
    }
  }

  // 4. Validate each underlying CanonicalMolecule
  for (const mol of moleculeMap.values()) {
    validateCanonicalMolecule(mol);
  }
}

/**
 * Pure, deterministic builder that constructs a complete CanonicalMolecularDocument.
 */
export function buildCanonicalDocument(
  molecules: CanonicalMolecule[],
  options?: {
    document_id?: string;
    name?: string;
    active_object_id?: string;
    metadata?: Record<string, any>;
  }
): CanonicalMolecularDocument {
  const docId = options?.document_id || 'doc-default-1';
  const docName = options?.name || 'Workspace Document';

  const objectMap = new Map<string, CanonicalObject>();
  const moleculeMap = new Map<string, CanonicalMolecule>();
  const stateMap = new Map<string, CanonicalState>();
  const objectIds: string[] = [];

  for (let i = 0; i < molecules.length; i++) {
    const mol = molecules[i];
    moleculeMap.set(mol.molecule_id, mol);

    const activeState = buildCanonicalState(mol, 1, `${mol.molecule_id}-state-1`, 'Default State');
    stateMap.set(activeState.state_id, activeState);

    const obj = buildCanonicalObject(mol, activeState, {
      object_id: `obj-${mol.molecule_id}`,
      name: mol.name
    });
    objectMap.set(obj.object_id, obj);
    objectIds.push(obj.object_id);
  }

  const activeObjId = options?.active_object_id || (objectIds[0] || null);
  const now = new Date().toISOString();

  const doc: CanonicalMolecularDocument = {
    document_id: docId,
    name: docName,
    object_ids: objectIds,
    active_object_id: activeObjId,
    objects: objectMap,
    molecules: moleculeMap,
    states: stateMap,
    created_at: now,
    updated_at: now,
    metadata: options?.metadata
  };

  validateCanonicalDocument(doc);
  return doc;
}
