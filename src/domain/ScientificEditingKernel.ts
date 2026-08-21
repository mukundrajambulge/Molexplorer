import {
  CanonicalAtom,
  CanonicalBond,
  CanonicalResidue,
  CanonicalChain,
  CanonicalMolecule,
  CanonicalState,
  CanonicalObject,
  CanonicalMolecularDocument,
  SelectionResult,
  ScientificRevision,
  ProvenanceRecord,
  EditOperation,
  ValidationReport
} from '../types/domain';
import { buildCanonicalTopology } from './BondAdapter';
import { buildCanonicalMolecule, validateCanonicalMolecule } from './HierarchyAdapter';
import { buildCanonicalState, validateCanonicalDocument } from './DocumentAdapter';
import { computeCanonicalStateHash, computeRevisionHash, generateUUID } from './StateHasher';
import { validateMolecularValence, calculateAtomValence } from './ValenceValidator';
import { computeHydrogenPositions } from './HydrogenGeometry';

export class ScientificEditingError extends Error {
  code: string;
  constructor(message: string, code: string = 'EDIT_PRECONDITION_ERROR') {
    super(message);
    this.name = 'ScientificEditingError';
    this.code = code;
  }
}

/**
 * Authoritative Scientific Editing Kernel.
 * Executes structural molecular mutations within atomic, validated transactions.
 */
export class ScientificEditingKernel {
  /**
   * Constructs an initial Root Revision (R0) for a molecular entity.
   */
  public static createRootRevision(
    documentId: string,
    objectId: string,
    molecule: CanonicalMolecule,
    author: string = 'System'
  ): ScientificRevision {
    const timestamp = new Date().toISOString();
    const stateHash = computeCanonicalStateHash(molecule);
    const opId = `op-root-${generateUUID()}`;
    const revId = `rev-0-${generateUUID().slice(0, 8)}`;
    const revHash = computeRevisionHash(null, opId, stateHash, timestamp);

    return {
      revision_id: revId,
      parent_revision_id: null,
      operation_id: opId,
      document_id: documentId,
      object_id: objectId,
      state_id: `${molecule.molecule_id}-state-1`,
      canonical_state_hash: stateHash,
      revision_hash: revHash,
      timestamp: timestamp,
      author: author,
      molecule_snapshot: molecule
    };
  }

  /**
   * Executes the atomic "remove <selection>" mutation.
   * Consumes a canonical SelectionResult and emits a new ScientificRevision and ProvenanceRecord.
   */
  public static remove(
    document: CanonicalMolecularDocument,
    selection: SelectionResult,
    options?: {
      objectId?: string;
      stateId?: string;
      author?: string;
      expectedRevisionId?: string;
      currentRevision?: ScientificRevision;
    }
  ): {
    revision: ScientificRevision;
    provenance: ProvenanceRecord;
    updatedDocument: CanonicalMolecularDocument;
    updatedMolecule: CanonicalMolecule;
  } {
    const targetObjectId = options?.objectId || selection.object_id || document.active_object_id;
    if (!targetObjectId) {
      throw new ScientificEditingError(
        'remove: target objectId must be specified or active in document',
        'EDIT_PRECONDITION_ERROR'
      );
    }

    const obj = document.objects.get(targetObjectId);
    if (!obj) {
      throw new ScientificEditingError(
        `remove: target object "${targetObjectId}" not found in document`,
        'EDIT_PRECONDITION_ERROR'
      );
    }

    const mol = document.molecules.get(obj.molecule_ref);
    if (!mol) {
      throw new ScientificEditingError(
        `remove: molecule "${obj.molecule_ref}" not found in document`,
        'EDIT_PRECONDITION_ERROR'
      );
    }

    // 1. Precondition: Empty selection check
    if (!selection.selected_ids || selection.selected_ids.size === 0) {
      throw new ScientificEditingError(
        'remove: selection is empty; no atoms targeted for removal',
        'EDIT_PRECONDITION_ERROR'
      );
    }

    // 2. Precondition: Revision concurrency check
    if (options?.expectedRevisionId && options?.currentRevision) {
      if (options.currentRevision.revision_id !== options.expectedRevisionId) {
        throw new ScientificEditingError(
          `remove: revision conflict. Expected "${options.expectedRevisionId}", current is "${options.currentRevision.revision_id}"`,
          'REVISION_CONFLICT'
        );
      }
    }

    const targetSet = selection.selected_ids;

    // 3. Precondition: Verify all selected atom IDs exist in target molecule
    for (const aId of targetSet) {
      if (!mol.atom_map.has(aId)) {
        throw new ScientificEditingError(
          `remove: target atom ID ${aId} does not exist in molecule ${mol.molecule_id}`,
          'EDIT_PRECONDITION_ERROR'
        );
      }
    }

    // 4. Transaction execution: Non-destructive filtering & pruning

    // A. Filter surviving atoms (preserving exact canonical_id, coordinates, and properties)
    const survivingAtoms: CanonicalAtom[] = [];
    for (let i = 0; i < mol.atoms.length; i++) {
      const atom = mol.atoms[i];
      if (!targetSet.has(atom.canonical_id)) {
        survivingAtoms.push({ ...atom });
      }
    }

    // B. Filter surviving bonds (purge all bonds incident to removed atoms)
    const survivingBonds: CanonicalBond[] = [];
    for (let i = 0; i < mol.topology.bonds.length; i++) {
      const bond = mol.topology.bonds[i];
      if (!targetSet.has(bond.atom_a) && !targetSet.has(bond.atom_b)) {
        survivingBonds.push({ ...bond });
      }
    }

    const derivedTopology = buildCanonicalTopology(survivingAtoms, survivingBonds);

    // C. Filter surviving residues and prune empty residues
    const survivingResidues: CanonicalResidue[] = [];
    const survivingResidueMap = new Map<string, CanonicalResidue>();

    for (let i = 0; i < mol.residues.length; i++) {
      const res = mol.residues[i];
      const resAtomIds = res.atom_ids.filter(id => !targetSet.has(id));
      if (resAtomIds.length > 0) {
        const derivedRes: CanonicalResidue = {
          ...res,
          atom_ids: resAtomIds
        };
        survivingResidues.push(derivedRes);
        survivingResidueMap.set(derivedRes.residue_id, derivedRes);
      }
    }

    // D. Filter surviving chains and prune empty chains
    const survivingChains: CanonicalChain[] = [];
    for (let i = 0; i < mol.chains.length; i++) {
      const chain = mol.chains[i];
      const chainResIds = chain.residue_ids.filter(rId => survivingResidueMap.has(rId));
      const chainAtomIds = chain.atom_ids.filter(id => !targetSet.has(id));
      if (chainResIds.length > 0 && chainAtomIds.length > 0) {
        const derivedChain: CanonicalChain = {
          ...chain,
          residue_ids: chainResIds,
          atom_ids: chainAtomIds
        };
        survivingChains.push(derivedChain);
      }
    }

    // 5. Construct derived CanonicalMolecule
    const derivedMolecule = buildCanonicalMolecule(survivingAtoms, derivedTopology, {
      molecule_id: mol.molecule_id,
      name: mol.name,
      source_format: mol.source_format,
      metadata: mol.metadata
    });

    // 6. Post-condition Scientific Validation
    validateCanonicalMolecule(derivedMolecule);

    // 7. Compute State Hashes & Construct Revision Record
    const previousStateHash = computeCanonicalStateHash(mol);
    const newStateHash = computeCanonicalStateHash(derivedMolecule);

    if (newStateHash === previousStateHash && targetSet.size > 0) {
      throw new ScientificEditingError(
        'remove: internal error - derived state hash identical after non-empty deletion',
        'TOPOLOGY_VALIDATION_ERROR'
      );
    }

    const timestamp = new Date().toISOString();
    const parentRevId = options?.currentRevision?.revision_id || null;
    const opId = `op-remove-${generateUUID()}`;
    const revId = `rev-${generateUUID().slice(0, 8)}`;
    const revHash = computeRevisionHash(parentRevId, opId, newStateHash, timestamp);

    const revision: ScientificRevision = {
      revision_id: revId,
      parent_revision_id: parentRevId,
      operation_id: opId,
      document_id: document.document_id,
      object_id: targetObjectId,
      state_id: options?.stateId || obj.active_state_id,
      canonical_state_hash: newStateHash,
      revision_hash: revHash,
      timestamp: timestamp,
      author: options?.author || 'User',
      molecule_snapshot: derivedMolecule
    };

    // 8. Append Provenance Record
    const provenance: ProvenanceRecord = {
      provenance_id: `prov-${generateUUID()}`,
      revision_id: revId,
      parent_revision_id: parentRevId,
      operation_name: 'remove',
      selection_query: selection.query,
      resolved_atom_ids: Array.from(targetSet).sort((a, b) => a - b),
      parameters: {
        target_object_id: targetObjectId,
        removed_count: targetSet.size,
        surviving_count: survivingAtoms.length
      },
      timestamp: timestamp,
      tool_version: 'Molexplorer 1.0',
      validation_summary: 'PASSED (Topology and Hierarchy Intact)'
    };

    // 9. Construct Updated CanonicalMolecularDocument Container
    const updatedMoleculeMap = new Map(document.molecules);
    updatedMoleculeMap.set(derivedMolecule.molecule_id, derivedMolecule);

    const derivedState = buildCanonicalState(
      derivedMolecule,
      1,
      obj.active_state_id,
      'Active State'
    );
    const updatedStateMap = new Map(document.states);
    updatedStateMap.set(derivedState.state_id, derivedState);

    const updatedDocument: CanonicalMolecularDocument = {
      ...document,
      molecules: updatedMoleculeMap,
      states: updatedStateMap,
      updated_at: timestamp
    };

    validateCanonicalDocument(updatedDocument);

    return {
      revision,
      provenance,
      updatedDocument,
      updatedMolecule: derivedMolecule
    };
  }

  /**
   * Restores a document to a previous ScientificRevision snapshot.
   */
  public static restoreRevision(
    document: CanonicalMolecularDocument,
    targetRevision: ScientificRevision
  ): {
    updatedDocument: CanonicalMolecularDocument;
    restoredMolecule: CanonicalMolecule;
  } {
    const restoredMol = targetRevision.molecule_snapshot;
    const obj = document.objects.get(targetRevision.object_id);
    if (!obj) {
      throw new ScientificEditingError(
        `restoreRevision: target object "${targetRevision.object_id}" not found in document`,
        'EDIT_PRECONDITION_ERROR'
      );
    }

    const updatedMoleculeMap = new Map(document.molecules);
    updatedMoleculeMap.set(restoredMol.molecule_id, restoredMol);

    const restoredState = buildCanonicalState(
      restoredMol,
      1,
      targetRevision.state_id || obj.active_state_id,
      'Restored State'
    );
    const updatedStateMap = new Map(document.states);
    updatedStateMap.set(restoredState.state_id, restoredState);

    const updatedDocument: CanonicalMolecularDocument = {
      ...document,
      molecules: updatedMoleculeMap,
      states: updatedStateMap,
      updated_at: new Date().toISOString()
    };

    validateCanonicalDocument(updatedDocument);

    return {
      updatedDocument,
      restoredMolecule: restoredMol
    };
  }

  /**
   * Executes the atomic "bond(atomA, atomB, order)" mutation.
   * Creates or updates a covalent bond edge between two canonical atoms.
   */
  public static bond(
    document: CanonicalMolecularDocument,
    atomA: number,
    atomB: number,
    order: number = 1.0,
    options?: {
      objectId?: string;
      stateId?: string;
      author?: string;
      expectedRevisionId?: string;
      currentRevision?: ScientificRevision;
    }
  ): {
    revision: ScientificRevision;
    provenance: ProvenanceRecord;
    updatedDocument: CanonicalMolecularDocument;
    updatedMolecule: CanonicalMolecule;
    bond: CanonicalBond;
  } {
    const targetObjectId = options?.objectId || document.active_object_id;
    if (!targetObjectId) {
      throw new ScientificEditingError(
        'bond: target objectId must be specified or active in document',
        'EDIT_PRECONDITION_ERROR'
      );
    }

    const obj = document.objects.get(targetObjectId);
    if (!obj) {
      throw new ScientificEditingError(
        `bond: target object "${targetObjectId}" not found in document`,
        'EDIT_PRECONDITION_ERROR'
      );
    }

    const mol = document.molecules.get(obj.molecule_ref);
    if (!mol) {
      throw new ScientificEditingError(
        `bond: molecule "${obj.molecule_ref}" not found in document`,
        'EDIT_PRECONDITION_ERROR'
      );
    }

    // 1. Revision concurrency check
    if (options?.expectedRevisionId && options?.currentRevision) {
      if (options.currentRevision.revision_id !== options.expectedRevisionId) {
        throw new ScientificEditingError(
          `bond: revision conflict. Expected "${options.expectedRevisionId}", current is "${options.currentRevision.revision_id}"`,
          'REVISION_CONFLICT'
        );
      }
    }

    // 2. Precondition: Self-bond check (DM-TOP-002)
    if (atomA === atomB) {
      throw new ScientificEditingError(
        `bond: self-bonding is strictly prohibited (atom ${atomA} to ${atomB})`,
        'TOPOLOGY_VALIDATION_ERROR'
      );
    }

    // 3. Precondition: Endpoint existence check (DM-TOP-001)
    const atom1 = mol.atom_map.get(atomA);
    const atom2 = mol.atom_map.get(atomB);

    if (!atom1) {
      throw new ScientificEditingError(
        `bond: atom endpoint ${atomA} does not exist in molecule ${mol.molecule_id}`,
        'TOPOLOGY_VALIDATION_ERROR'
      );
    }

    if (!atom2) {
      throw new ScientificEditingError(
        `bond: atom endpoint ${atomB} does not exist in molecule ${mol.molecule_id}`,
        'TOPOLOGY_VALIDATION_ERROR'
      );
    }

    // 4. Precondition: AltLoc conformer disjointness check (DM-TOP-004)
    if (atom1.alt_loc !== ' ' && atom2.alt_loc !== ' ' && atom1.alt_loc !== atom2.alt_loc) {
      throw new ScientificEditingError(
        `bond: cannot form covalent bond across disjoint altLoc conformers ('${atom1.alt_loc}' to '${atom2.alt_loc}')`,
        'TOPOLOGY_VALIDATION_ERROR'
      );
    }

    // 5. Precondition: Supported bond order check (P1.2)
    const VALID_BOND_ORDERS = [1, 1.5, 2, 3];
    if (!VALID_BOND_ORDERS.includes(order)) {
      throw new ScientificEditingError(
        `bond: unsupported bond order ${order}. Must be 1, 1.5, 2, or 3`,
        'VALENCE_VALIDATION_ERROR'
      );
    }

    // 6. Normalize endpoints
    const normA = Math.min(atomA, atomB);
    const normB = Math.max(atomA, atomB);

    // 7. Check existing bond (DM-TOP-003 duplicate check)
    const existingIndex = mol.topology.bonds.findIndex(
      b => b.atom_a === normA && b.atom_b === normB
    );

    let updatedBonds: CanonicalBond[];
    let targetBond: CanonicalBond;

    if (existingIndex >= 0) {
      const existing = mol.topology.bonds[existingIndex];
      if (existing.order === order) {
        throw new ScientificEditingError(
          `bond: duplicate bond with identical order (${order}) already exists between atoms ${normA} and ${normB}`,
          'TOPOLOGY_VALIDATION_ERROR'
        );
      }
      // Update existing bond order
      targetBond = {
        ...existing,
        order: order,
        is_aromatic: order === 1.5,
        source: 'edited',
        is_inferred: false
      };
      updatedBonds = [...mol.topology.bonds];
      updatedBonds[existingIndex] = targetBond;
    } else {
      // Create new bond
      targetBond = {
        bond_id: `bond-${normA}-${normB}`,
        atom_a: normA,
        atom_b: normB,
        order: order,
        is_aromatic: order === 1.5,
        source: 'edited',
        is_inferred: false
      };
      updatedBonds = [...mol.topology.bonds, targetBond];
    }

    // 8. Staging & Validation
    const survivingAtoms = mol.atoms.map(a => ({ ...a }));
    const derivedTopology = buildCanonicalTopology(survivingAtoms, updatedBonds);

    const derivedMolecule = buildCanonicalMolecule(survivingAtoms, derivedTopology, {
      molecule_id: mol.molecule_id,
      name: mol.name,
      source_format: mol.source_format,
      metadata: mol.metadata
    });

    validateCanonicalMolecule(derivedMolecule);

    // 9. Compute State Hashes & Construct Revision
    const previousStateHash = computeCanonicalStateHash(mol);
    const newStateHash = computeCanonicalStateHash(derivedMolecule);

    if (newStateHash === previousStateHash) {
      throw new ScientificEditingError(
        'bond: internal error - derived state hash identical after topology change',
        'TOPOLOGY_VALIDATION_ERROR'
      );
    }

    const timestamp = new Date().toISOString();
    const parentRevId = options?.currentRevision?.revision_id || null;
    const opId = `op-bond-${generateUUID()}`;
    const revId = `rev-${generateUUID().slice(0, 8)}`;
    const revHash = computeRevisionHash(parentRevId, opId, newStateHash, timestamp);

    const revision: ScientificRevision = {
      revision_id: revId,
      parent_revision_id: parentRevId,
      operation_id: opId,
      document_id: document.document_id,
      object_id: targetObjectId,
      state_id: options?.stateId || obj.active_state_id,
      canonical_state_hash: newStateHash,
      revision_hash: revHash,
      timestamp: timestamp,
      author: options?.author || 'User',
      molecule_snapshot: derivedMolecule
    };

    // 10. Append Provenance Record
    const provenance: ProvenanceRecord = {
      provenance_id: `prov-${generateUUID()}`,
      revision_id: revId,
      parent_revision_id: parentRevId,
      operation_name: 'bond',
      resolved_atom_ids: [normA, normB],
      parameters: {
        target_object_id: targetObjectId,
        atom_a: normA,
        atom_b: normB,
        order: order,
        is_aromatic: order === 1.5
      },
      timestamp: timestamp,
      tool_version: 'Molexplorer 1.0',
      validation_summary: 'PASSED (Covalent Edge Validated)'
    };

    // 11. Construct Updated CanonicalMolecularDocument Container
    const updatedMoleculeMap = new Map(document.molecules);
    updatedMoleculeMap.set(derivedMolecule.molecule_id, derivedMolecule);

    const derivedState = buildCanonicalState(
      derivedMolecule,
      1,
      obj.active_state_id,
      'Active State'
    );
    const updatedStateMap = new Map(document.states);
    updatedStateMap.set(derivedState.state_id, derivedState);

    const updatedDocument: CanonicalMolecularDocument = {
      ...document,
      molecules: updatedMoleculeMap,
      states: updatedStateMap,
      updated_at: timestamp
    };

    validateCanonicalDocument(updatedDocument);

    return {
      revision,
      provenance,
      updatedDocument,
      updatedMolecule: derivedMolecule,
      bond: targetBond
    };
  }

  /**
   * Executes the atomic "unbond(atomA, atomB)" mutation.
   * Removes a covalent bond edge between two canonical atoms.
   */
  public static unbond(
    document: CanonicalMolecularDocument,
    atomA: number,
    atomB: number,
    options?: {
      objectId?: string;
      stateId?: string;
      author?: string;
      expectedRevisionId?: string;
      currentRevision?: ScientificRevision;
    }
  ): {
    revision: ScientificRevision;
    provenance: ProvenanceRecord;
    updatedDocument: CanonicalMolecularDocument;
    updatedMolecule: CanonicalMolecule;
    removedBond: CanonicalBond;
  } {
    const targetObjectId = options?.objectId || document.active_object_id;
    if (!targetObjectId) {
      throw new ScientificEditingError(
        'unbond: target objectId must be specified or active in document',
        'EDIT_PRECONDITION_ERROR'
      );
    }

    const obj = document.objects.get(targetObjectId);
    if (!obj) {
      throw new ScientificEditingError(
        `unbond: target object "${targetObjectId}" not found in document`,
        'EDIT_PRECONDITION_ERROR'
      );
    }

    const mol = document.molecules.get(obj.molecule_ref);
    if (!mol) {
      throw new ScientificEditingError(
        `unbond: molecule "${obj.molecule_ref}" not found in document`,
        'EDIT_PRECONDITION_ERROR'
      );
    }

    // 1. Revision concurrency check
    if (options?.expectedRevisionId && options?.currentRevision) {
      if (options.currentRevision.revision_id !== options.expectedRevisionId) {
        throw new ScientificEditingError(
          `unbond: revision conflict. Expected "${options.expectedRevisionId}", current is "${options.currentRevision.revision_id}"`,
          'REVISION_CONFLICT'
        );
      }
    }

    // 2. Precondition: Self-bond check
    if (atomA === atomB) {
      throw new ScientificEditingError(
        `unbond: self-bonding is invalid (atom ${atomA} to ${atomB})`,
        'TOPOLOGY_VALIDATION_ERROR'
      );
    }

    // 3. Precondition: Endpoint existence check
    const atom1 = mol.atom_map.get(atomA);
    const atom2 = mol.atom_map.get(atomB);

    if (!atom1) {
      throw new ScientificEditingError(
        `unbond: atom endpoint ${atomA} does not exist in molecule ${mol.molecule_id}`,
        'TOPOLOGY_VALIDATION_ERROR'
      );
    }

    if (!atom2) {
      throw new ScientificEditingError(
        `unbond: atom endpoint ${atomB} does not exist in molecule ${mol.molecule_id}`,
        'TOPOLOGY_VALIDATION_ERROR'
      );
    }

    // 4. Normalize endpoints
    const normA = Math.min(atomA, atomB);
    const normB = Math.max(atomA, atomB);

    // 5. Precondition: Bond existence check
    const existingIndex = mol.topology.bonds.findIndex(
      b => b.atom_a === normA && b.atom_b === normB
    );

    if (existingIndex === -1) {
      throw new ScientificEditingError(
        `unbond: no bond exists between specified atoms ${normA} and ${normB}`,
        'TOPOLOGY_VALIDATION_ERROR'
      );
    }

    const targetBond = mol.topology.bonds[existingIndex];

    // 6. Staging: Remove bond
    const updatedBonds = mol.topology.bonds.filter(
      (_, idx) => idx !== existingIndex
    );

    const survivingAtoms = mol.atoms.map(a => ({ ...a }));
    const derivedTopology = buildCanonicalTopology(survivingAtoms, updatedBonds);

    const derivedMolecule = buildCanonicalMolecule(survivingAtoms, derivedTopology, {
      molecule_id: mol.molecule_id,
      name: mol.name,
      source_format: mol.source_format,
      metadata: mol.metadata
    });

    validateCanonicalMolecule(derivedMolecule);

    // 7. Compute State Hashes & Construct Revision
    const previousStateHash = computeCanonicalStateHash(mol);
    const newStateHash = computeCanonicalStateHash(derivedMolecule);

    if (newStateHash === previousStateHash) {
      throw new ScientificEditingError(
        'unbond: internal error - derived state hash identical after unbonding',
        'TOPOLOGY_VALIDATION_ERROR'
      );
    }

    const timestamp = new Date().toISOString();
    const parentRevId = options?.currentRevision?.revision_id || null;
    const opId = `op-unbond-${generateUUID()}`;
    const revId = `rev-${generateUUID().slice(0, 8)}`;
    const revHash = computeRevisionHash(parentRevId, opId, newStateHash, timestamp);

    const revision: ScientificRevision = {
      revision_id: revId,
      parent_revision_id: parentRevId,
      operation_id: opId,
      document_id: document.document_id,
      object_id: targetObjectId,
      state_id: options?.stateId || obj.active_state_id,
      canonical_state_hash: newStateHash,
      revision_hash: revHash,
      timestamp: timestamp,
      author: options?.author || 'User',
      molecule_snapshot: derivedMolecule
    };

    // 8. Append Provenance Record
    const provenance: ProvenanceRecord = {
      provenance_id: `prov-${generateUUID()}`,
      revision_id: revId,
      parent_revision_id: parentRevId,
      operation_name: 'unbond',
      resolved_atom_ids: [normA, normB],
      parameters: {
        target_object_id: targetObjectId,
        atom_a: normA,
        atom_b: normB,
        removed_order: targetBond.order
      },
      timestamp: timestamp,
      tool_version: 'Molexplorer 1.0',
      validation_summary: 'PASSED (Covalent Edge Removed)'
    };

    // 9. Construct Updated CanonicalMolecularDocument Container
    const updatedMoleculeMap = new Map(document.molecules);
    updatedMoleculeMap.set(derivedMolecule.molecule_id, derivedMolecule);

    const derivedState = buildCanonicalState(
      derivedMolecule,
      1,
      obj.active_state_id,
      'Active State'
    );
    const updatedStateMap = new Map(document.states);
    updatedStateMap.set(derivedState.state_id, derivedState);

    const updatedDocument: CanonicalMolecularDocument = {
      ...document,
      molecules: updatedMoleculeMap,
      states: updatedStateMap,
      updated_at: timestamp
    };

    validateCanonicalDocument(updatedDocument);

    return {
      revision,
      provenance,
      updatedDocument,
      updatedMolecule: derivedMolecule,
      removedBond: targetBond
    };
  }

  /**
   * Executes the atomic "setBondOrder(atomA, atomB, order)" mutation.
   * Modifies the bond multiplicity between two existing canonical atoms.
   */
  public static setBondOrder(
    document: CanonicalMolecularDocument,
    atomA: number,
    atomB: number,
    order: number,
    options?: {
      objectId?: string;
      stateId?: string;
      author?: string;
      expectedRevisionId?: string;
      currentRevision?: ScientificRevision;
      operationName?: string;
    }
  ): {
    revision: ScientificRevision;
    provenance: ProvenanceRecord;
    updatedDocument: CanonicalMolecularDocument;
    updatedMolecule: CanonicalMolecule;
    modifiedBond: CanonicalBond;
    valenceReport: ValidationReport;
  } {
    const targetObjectId = options?.objectId || document.active_object_id;
    if (!targetObjectId) {
      throw new ScientificEditingError(
        'setBondOrder: target objectId must be specified or active in document',
        'EDIT_PRECONDITION_ERROR'
      );
    }

    const obj = document.objects.get(targetObjectId);
    if (!obj) {
      throw new ScientificEditingError(
        `setBondOrder: target object "${targetObjectId}" not found in document`,
        'EDIT_PRECONDITION_ERROR'
      );
    }

    const mol = document.molecules.get(obj.molecule_ref);
    if (!mol) {
      throw new ScientificEditingError(
        `setBondOrder: molecule "${obj.molecule_ref}" not found in document`,
        'EDIT_PRECONDITION_ERROR'
      );
    }

    // 1. Revision concurrency check
    if (options?.expectedRevisionId && options?.currentRevision) {
      if (options.currentRevision.revision_id !== options.expectedRevisionId) {
        throw new ScientificEditingError(
          `setBondOrder: revision conflict. Expected "${options.expectedRevisionId}", current is "${options.currentRevision.revision_id}"`,
          'REVISION_CONFLICT'
        );
      }
    }

    // 2. Precondition: Self-bond check
    if (atomA === atomB) {
      throw new ScientificEditingError(
        `setBondOrder: self-bonding is invalid (atom ${atomA} to ${atomB})`,
        'TOPOLOGY_VALIDATION_ERROR'
      );
    }

    // 3. Precondition: Endpoint existence check
    const atom1 = mol.atom_map.get(atomA);
    const atom2 = mol.atom_map.get(atomB);

    if (!atom1) {
      throw new ScientificEditingError(
        `setBondOrder: atom endpoint ${atomA} does not exist in molecule ${mol.molecule_id}`,
        'TOPOLOGY_VALIDATION_ERROR'
      );
    }

    if (!atom2) {
      throw new ScientificEditingError(
        `setBondOrder: atom endpoint ${atomB} does not exist in molecule ${mol.molecule_id}`,
        'TOPOLOGY_VALIDATION_ERROR'
      );
    }

    // 4. Precondition: AltLoc conformer disjointness check
    if (atom1.alt_loc !== ' ' && atom2.alt_loc !== ' ' && atom1.alt_loc !== atom2.alt_loc) {
      throw new ScientificEditingError(
        `setBondOrder: cannot modify bond across disjoint altLoc conformers ('${atom1.alt_loc}' to '${atom2.alt_loc}')`,
        'TOPOLOGY_VALIDATION_ERROR'
      );
    }

    // 5. Precondition: Supported bond order check
    const VALID_BOND_ORDERS = [1, 1.5, 2, 3];
    if (!VALID_BOND_ORDERS.includes(order)) {
      throw new ScientificEditingError(
        `setBondOrder: unsupported bond order ${order}. Must be 1, 1.5, 2, or 3`,
        'VALENCE_VALIDATION_ERROR'
      );
    }

    // 6. Normalize endpoints
    const normA = Math.min(atomA, atomB);
    const normB = Math.max(atomA, atomB);

    // 7. Precondition: Existing bond check
    const existingIndex = mol.topology.bonds.findIndex(
      b => b.atom_a === normA && b.atom_b === normB
    );

    if (existingIndex === -1) {
      throw new ScientificEditingError(
        `setBondOrder: no bond exists between specified atoms ${normA} and ${normB}`,
        'TOPOLOGY_VALIDATION_ERROR'
      );
    }

    const existingBond = mol.topology.bonds[existingIndex];

    if (existingBond.order === order) {
      throw new ScientificEditingError(
        `setBondOrder: bond between atoms ${normA} and ${normB} already has order ${order}`,
        'TOPOLOGY_VALIDATION_ERROR'
      );
    }

    // 8. Staging: Update bond order
    const targetBond: CanonicalBond = {
      ...existingBond,
      order: order,
      is_aromatic: order === 1.5,
      source: 'edited',
      is_inferred: false
    };

    const updatedBonds = [...mol.topology.bonds];
    updatedBonds[existingIndex] = targetBond;

    const survivingAtoms = mol.atoms.map(a => ({ ...a }));
    const derivedTopology = buildCanonicalTopology(survivingAtoms, updatedBonds);

    const derivedMolecule = buildCanonicalMolecule(survivingAtoms, derivedTopology, {
      molecule_id: mol.molecule_id,
      name: mol.name,
      source_format: mol.source_format,
      metadata: mol.metadata
    });

    validateCanonicalMolecule(derivedMolecule);

    // 9. Valence Validation (Fail-Closed on Hard Errors)
    const valenceReport = validateMolecularValence(derivedMolecule, [normA, normB]);
    if (!valenceReport.valid) {
      throw new ScientificEditingError(
        `setBondOrder: valence validation failed. ${valenceReport.errors.join(' ')}`,
        'VALENCE_VALIDATION_ERROR'
      );
    }

    // 10. Compute State Hashes & Construct Revision
    const previousStateHash = computeCanonicalStateHash(mol);
    const newStateHash = computeCanonicalStateHash(derivedMolecule);

    if (newStateHash === previousStateHash) {
      throw new ScientificEditingError(
        'setBondOrder: internal error - derived state hash identical after bond order change',
        'TOPOLOGY_VALIDATION_ERROR'
      );
    }

    const timestamp = new Date().toISOString();
    const parentRevId = options?.currentRevision?.revision_id || null;
    const opName = options?.operationName || 'set_bond_order';
    const opId = `op-${opName}-${generateUUID()}`;
    const revId = `rev-${generateUUID().slice(0, 8)}`;
    const revHash = computeRevisionHash(parentRevId, opId, newStateHash, timestamp);

    const revision: ScientificRevision = {
      revision_id: revId,
      parent_revision_id: parentRevId,
      operation_id: opId,
      document_id: document.document_id,
      object_id: targetObjectId,
      state_id: options?.stateId || obj.active_state_id,
      canonical_state_hash: newStateHash,
      revision_hash: revHash,
      timestamp: timestamp,
      author: options?.author || 'User',
      molecule_snapshot: derivedMolecule
    };

    // 11. Append Provenance Record
    const provenance: ProvenanceRecord = {
      provenance_id: `prov-${generateUUID()}`,
      revision_id: revId,
      parent_revision_id: parentRevId,
      operation_name: opName,
      resolved_atom_ids: [normA, normB],
      parameters: {
        target_object_id: targetObjectId,
        atom_a: normA,
        atom_b: normB,
        original_order: existingBond.order,
        target_order: order,
        is_aromatic: order === 1.5,
        valence_report: valenceReport
      },
      timestamp: timestamp,
      tool_version: 'Molexplorer 1.0',
      validation_summary: valenceReport.warnings.length > 0
        ? `PASSED WITH WARNINGS: ${valenceReport.warnings.join(' ')}`
        : 'PASSED (Valence & Topology Validated)'
    };

    // 12. Construct Updated CanonicalMolecularDocument Container
    const updatedMoleculeMap = new Map(document.molecules);
    updatedMoleculeMap.set(derivedMolecule.molecule_id, derivedMolecule);

    const derivedState = buildCanonicalState(
      derivedMolecule,
      1,
      obj.active_state_id,
      'Active State'
    );
    const updatedStateMap = new Map(document.states);
    updatedStateMap.set(derivedState.state_id, derivedState);

    const updatedDocument: CanonicalMolecularDocument = {
      ...document,
      molecules: updatedMoleculeMap,
      states: updatedStateMap,
      updated_at: timestamp
    };

    validateCanonicalDocument(updatedDocument);

    return {
      revision,
      provenance,
      updatedDocument,
      updatedMolecule: derivedMolecule,
      modifiedBond: targetBond,
      valenceReport
    };
  }

  /**
   * Executes the atomic "cycleValence(atomA, atomB)" mutation.
   * Cycles bond multiplicity: 1 -> 1.5 -> 2 -> 3 -> 1.
   */
  public static cycleValence(
    document: CanonicalMolecularDocument,
    atomA: number,
    atomB: number,
    options?: {
      objectId?: string;
      stateId?: string;
      author?: string;
      expectedRevisionId?: string;
      currentRevision?: ScientificRevision;
    }
  ): {
    revision: ScientificRevision;
    provenance: ProvenanceRecord;
    updatedDocument: CanonicalMolecularDocument;
    updatedMolecule: CanonicalMolecule;
    modifiedBond: CanonicalBond;
    valenceReport: ValidationReport;
  } {
    const targetObjectId = options?.objectId || document.active_object_id;
    const obj = document.objects.get(targetObjectId);
    if (!obj) {
      throw new ScientificEditingError(
        `cycleValence: target object "${targetObjectId}" not found`,
        'EDIT_PRECONDITION_ERROR'
      );
    }
    const mol = document.molecules.get(obj.molecule_ref);
    if (!mol) {
      throw new ScientificEditingError(
        `cycleValence: molecule "${obj.molecule_ref}" not found`,
        'EDIT_PRECONDITION_ERROR'
      );
    }

    const normA = Math.min(atomA, atomB);
    const normB = Math.max(atomA, atomB);
    const existing = mol.topology.bonds.find(b => b.atom_a === normA && b.atom_b === normB);
    if (!existing) {
      throw new ScientificEditingError(
        `cycleValence: no bond exists between atoms ${normA} and ${normB}`,
        'TOPOLOGY_VALIDATION_ERROR'
      );
    }

    let nextOrder: number;
    if (existing.order === 1.0) nextOrder = 1.5;
    else if (existing.order === 1.5) nextOrder = 2.0;
    else if (existing.order === 2.0) nextOrder = 3.0;
    else nextOrder = 1.0;

    return this.setBondOrder(document, normA, normB, nextOrder, {
      ...options,
      operationName: 'cycle_valence'
    });
  }

  /**
   * Executes the atomic "h_add" mutation.
   * Models and attaches explicit hydrogens to satisfy standard neutral valencies.
   */
  public static addHydrogens(
    document: CanonicalMolecularDocument,
    selection?: SelectionResult | number[],
    options?: {
      objectId?: string;
      stateId?: string;
      author?: string;
      expectedRevisionId?: string;
      currentRevision?: ScientificRevision;
      operationName?: string;
    }
  ): {
    revision: ScientificRevision;
    provenance: ProvenanceRecord;
    updatedDocument: CanonicalMolecularDocument;
    updatedMolecule: CanonicalMolecule;
    addedHydrogens: CanonicalAtom[];
    addedBonds: CanonicalBond[];
  } {
    const targetObjectId = options?.objectId || document.active_object_id;
    if (!targetObjectId) {
      throw new ScientificEditingError(
        'addHydrogens: target objectId must be specified or active in document',
        'EDIT_PRECONDITION_ERROR'
      );
    }

    const obj = document.objects.get(targetObjectId);
    if (!obj) {
      throw new ScientificEditingError(
        `addHydrogens: target object "${targetObjectId}" not found in document`,
        'EDIT_PRECONDITION_ERROR'
      );
    }

    const mol = document.molecules.get(obj.molecule_ref);
    if (!mol) {
      throw new ScientificEditingError(
        `addHydrogens: molecule "${obj.molecule_ref}" not found in document`,
        'EDIT_PRECONDITION_ERROR'
      );
    }

    // 1. Revision concurrency check
    if (options?.expectedRevisionId && options?.currentRevision) {
      if (options.currentRevision.revision_id !== options.expectedRevisionId) {
        throw new ScientificEditingError(
          `addHydrogens: revision conflict. Expected "${options.expectedRevisionId}", current is "${options.currentRevision.revision_id}"`,
          'REVISION_CONFLICT'
        );
      }
    }

    // 2. Resolve target atom IDs
    let targetIds: number[];
    if (!selection) {
      targetIds = mol.atoms.map(a => a.canonical_id);
    } else if (Array.isArray(selection)) {
      targetIds = selection;
    } else {
      targetIds = selection.selected_array;
    }

    if (targetIds.length === 0) {
      throw new ScientificEditingError(
        'addHydrogens: target selection is empty',
        'EDIT_PRECONDITION_ERROR'
      );
    }

    // Verify target atom IDs exist in molecule
    for (const tid of targetIds) {
      if (!mol.atom_map.has(tid)) {
        throw new ScientificEditingError(
          `addHydrogens: atom ID ${tid} does not exist in molecule ${mol.molecule_id}`,
          'EDIT_PRECONDITION_ERROR'
        );
      }
    }

    const STANDARD_VALENCY: Record<string, number> = {
      C: 4, N: 3, O: 2, S: 2, P: 5, F: 1, CL: 1, BR: 1, I: 1
    };

    let nextCanonicalId = Math.max(...mol.atoms.map(a => a.canonical_id), 0) + 1;
    const newHydrogens: CanonicalAtom[] = [];
    const newBonds: CanonicalBond[] = [];

    // Map of residue_id -> array of new atom IDs to add
    const residueAdditions = new Map<string, number[]>();

    for (const tid of targetIds) {
      const atom = mol.atom_map.get(tid)!;
      const elem = atom.element.toUpperCase().trim();
      if (elem === 'H') continue; // Don't add hydrogens to hydrogens

      const targetValency = STANDARD_VALENCY[elem] || 0;
      const currentValence = calculateAtomValence(atom.canonical_id, mol.topology.bonds);

      const neededH = Math.max(0, Math.floor(targetValency - currentValence));
      if (neededH <= 0) continue;

      // Find neighbor atoms in current topology
      const neighborBonds = mol.topology.bonds.filter(
        b => b.atom_a === atom.canonical_id || b.atom_b === atom.canonical_id
      );
      const neighborIds = neighborBonds.map(b => (b.atom_a === atom.canonical_id ? b.atom_b : b.atom_a));
      const neighborAtoms = neighborIds.map(id => mol.atom_map.get(id)!).filter(Boolean);

      // Compute geometric coordinates for new hydrogens
      const coords = computeHydrogenPositions(atom, neighborAtoms, neededH);

      const parentRes = mol.residues.find(
        r => r.chain_ref === atom.chain_ref && r.res_seq === atom.residue_ref
      );
      const resId = parentRes ? parentRes.residue_id : `${atom.chain_ref}:${atom.residue_ref}`;
      if (!residueAdditions.has(resId)) {
        residueAdditions.set(resId, []);
      }

      for (let h = 0; h < neededH; h++) {
        const hId = nextCanonicalId++;
        const pos = coords[h];

        const hAtom: CanonicalAtom = {
          canonical_id: hId,
          element: 'H',
          name: 'H',
          chain_ref: atom.chain_ref,
          residue_ref: atom.residue_ref,
          residue_name: atom.residue_name,
          x: pos.x,
          y: pos.y,
          z: pos.z,
          occupancy: 1.0,
          b_factor: 99.90, // DM-H-DISTINCTION
          formal_charge: 0,
          alt_loc: ' ',
          is_hetero: atom.is_hetero,
          modeled_hydrogen: true // DM-H-DISTINCTION
        };

        newHydrogens.push(hAtom);
        residueAdditions.get(resId)!.push(hId);

        const hBond: CanonicalBond = {
          bond_id: `bond-${Math.min(atom.canonical_id, hId)}-${Math.max(atom.canonical_id, hId)}`,
          atom_a: Math.min(atom.canonical_id, hId),
          atom_b: Math.max(atom.canonical_id, hId),
          order: 1.0,
          is_aromatic: false,
          source: 'edited',
          is_inferred: false
        };

        newBonds.push(hBond);
      }
    }

    if (newHydrogens.length === 0) {
      throw new ScientificEditingError(
        'addHydrogens: no unsaturated valencies eligible for hydrogen addition in target selection',
        'EDIT_PRECONDITION_ERROR'
      );
    }

    // 3. Staging: Assemble updated atoms, bonds, residues, and hierarchy
    const updatedAtoms = [...mol.atoms.map(a => ({ ...a })), ...newHydrogens];
    const updatedBonds = [...mol.topology.bonds, ...newBonds];

    const updatedResidues: CanonicalResidue[] = mol.residues.map(r => {
      const adds = residueAdditions.get(r.residue_id);
      if (adds && adds.length > 0) {
        return {
          ...r,
          atom_ids: [...r.atom_ids, ...adds]
        };
      }
      return { ...r };
    });

    const derivedTopology = buildCanonicalTopology(updatedAtoms, updatedBonds);

    const derivedMolecule: CanonicalMolecule = {
      molecule_id: mol.molecule_id,
      name: mol.name,
      source_format: mol.source_format,
      atoms: updatedAtoms,
      atom_map: new Map(updatedAtoms.map(a => [a.canonical_id, a])),
      residues: updatedResidues,
      residue_map: new Map(updatedResidues.map(r => [r.residue_id, r])),
      chains: mol.chains.map(c => ({ ...c })),
      chain_map: new Map(mol.chains.map(c => [c.chain_id, { ...c }])),
      topology: derivedTopology,
      metadata: mol.metadata
    };

    // 4. Validate canonical structure & valence
    validateCanonicalMolecule(derivedMolecule);
    const valenceReport = validateMolecularValence(derivedMolecule);
    if (!valenceReport.valid) {
      throw new ScientificEditingError(
        `addHydrogens: valence validation failed after adding hydrogens. ${valenceReport.errors.join(' ')}`,
        'VALENCE_VALIDATION_ERROR'
      );
    }

    // 5. Compute State Hashes & Construct Revision
    const previousStateHash = computeCanonicalStateHash(mol);
    const newStateHash = computeCanonicalStateHash(derivedMolecule);

    if (newStateHash === previousStateHash) {
      throw new ScientificEditingError(
        'addHydrogens: internal error - derived state hash identical after adding hydrogens',
        'TOPOLOGY_VALIDATION_ERROR'
      );
    }

    const timestamp = new Date().toISOString();
    const parentRevId = options?.currentRevision?.revision_id || null;
    const opName = options?.operationName || 'h_add';
    const opId = `op-${opName}-${generateUUID()}`;
    const revId = `rev-${generateUUID().slice(0, 8)}`;
    const revHash = computeRevisionHash(parentRevId, opId, newStateHash, timestamp);

    const revision: ScientificRevision = {
      revision_id: revId,
      parent_revision_id: parentRevId,
      operation_id: opId,
      document_id: document.document_id,
      object_id: targetObjectId,
      state_id: options?.stateId || obj.active_state_id,
      canonical_state_hash: newStateHash,
      revision_hash: revHash,
      timestamp: timestamp,
      author: options?.author || 'User',
      molecule_snapshot: derivedMolecule
    };

    // 6. Append Provenance Record
    const provenance: ProvenanceRecord = {
      provenance_id: `prov-${generateUUID()}`,
      revision_id: revId,
      parent_revision_id: parentRevId,
      operation_name: opName,
      resolved_atom_ids: targetIds,
      parameters: {
        target_object_id: targetObjectId,
        added_count: newHydrogens.length,
        new_hydrogen_ids: newHydrogens.map(h => h.canonical_id),
        valence_report: valenceReport
      },
      timestamp: timestamp,
      tool_version: 'Molexplorer 1.0',
      validation_summary: valenceReport.warnings.length > 0
        ? `PASSED WITH WARNINGS: ${valenceReport.warnings.join(' ')}`
        : 'PASSED (Hydrogens Modeled and Valence Validated)'
    };

    // 7. Update CanonicalMolecularDocument Container
    const updatedMoleculeMap = new Map(document.molecules);
    updatedMoleculeMap.set(derivedMolecule.molecule_id, derivedMolecule);

    const derivedState = buildCanonicalState(
      derivedMolecule,
      1,
      obj.active_state_id,
      'Active State'
    );
    const updatedStateMap = new Map(document.states);
    updatedStateMap.set(derivedState.state_id, derivedState);

    const updatedDocument: CanonicalMolecularDocument = {
      ...document,
      molecules: updatedMoleculeMap,
      states: updatedStateMap,
      updated_at: timestamp
    };

    validateCanonicalDocument(updatedDocument);

    return {
      revision,
      provenance,
      updatedDocument,
      updatedMolecule: derivedMolecule,
      addedHydrogens: newHydrogens,
      addedBonds: newBonds
    };
  }

  /**
   * Executes the atomic "h_fill" mutation.
   * Fills unsaturated valencies with modeled hydrogens.
   */
  public static fillHydrogens(
    document: CanonicalMolecularDocument,
    selection?: SelectionResult | number[],
    options?: {
      objectId?: string;
      stateId?: string;
      author?: string;
      expectedRevisionId?: string;
      currentRevision?: ScientificRevision;
    }
  ) {
    return this.addHydrogens(document, selection, {
      ...options,
      operationName: 'h_fill'
    });
  }

  /**
   * Executes the atomic "h_remove" mutation.
   * Removes explicit hydrogen atoms from the structure.
   */
  public static removeHydrogens(
    document: CanonicalMolecularDocument,
    selection?: SelectionResult | number[],
    options?: {
      objectId?: string;
      stateId?: string;
      author?: string;
      expectedRevisionId?: string;
      currentRevision?: ScientificRevision;
    }
  ): {
    revision: ScientificRevision;
    provenance: ProvenanceRecord;
    updatedDocument: CanonicalMolecularDocument;
    updatedMolecule: CanonicalMolecule;
    removedHydrogenIds: number[];
  } {
    const targetObjectId = options?.objectId || document.active_object_id;
    if (!targetObjectId) {
      throw new ScientificEditingError(
        'removeHydrogens: target objectId must be specified or active in document',
        'EDIT_PRECONDITION_ERROR'
      );
    }

    const obj = document.objects.get(targetObjectId);
    if (!obj) {
      throw new ScientificEditingError(
        `removeHydrogens: target object "${targetObjectId}" not found in document`,
        'EDIT_PRECONDITION_ERROR'
      );
    }

    const mol = document.molecules.get(obj.molecule_ref);
    if (!mol) {
      throw new ScientificEditingError(
        `removeHydrogens: molecule "${obj.molecule_ref}" not found in document`,
        'EDIT_PRECONDITION_ERROR'
      );
    }

    // 1. Revision concurrency check
    if (options?.expectedRevisionId && options?.currentRevision) {
      if (options.currentRevision.revision_id !== options.expectedRevisionId) {
        throw new ScientificEditingError(
          `removeHydrogens: revision conflict. Expected "${options.expectedRevisionId}", current is "${options.currentRevision.revision_id}"`,
          'REVISION_CONFLICT'
        );
      }
    }

    // 2. Identify target hydrogen atoms
    let candidateIds: number[];
    if (!selection) {
      candidateIds = mol.atoms.map(a => a.canonical_id);
    } else if (Array.isArray(selection)) {
      candidateIds = selection;
    } else {
      candidateIds = selection.selected_array;
    }

    const hydrogenIds = candidateIds.filter(id => {
      const a = mol.atom_map.get(id);
      return a && a.element.toUpperCase().trim() === 'H';
    });

    if (hydrogenIds.length === 0) {
      throw new ScientificEditingError(
        'removeHydrogens: no hydrogen atoms found to remove in target selection',
        'EDIT_PRECONDITION_ERROR'
      );
    }

    const targetSet = new Set(hydrogenIds);

    // 3. Staging: Remove target hydrogens and incident bonds
    const survivingAtoms = mol.atoms.filter(a => !targetSet.has(a.canonical_id)).map(a => ({ ...a }));
    const survivingBonds = mol.topology.bonds.filter(
      b => !targetSet.has(b.atom_a) && !targetSet.has(b.atom_b)
    );

    const updatedResidues: CanonicalResidue[] = [];
    for (const res of mol.residues) {
      const remainingAtomIds = res.atom_ids.filter(id => !targetSet.has(id));
      if (remainingAtomIds.length > 0) {
        updatedResidues.push({
          ...res,
          atom_ids: remainingAtomIds
        });
      }
    }

    const survivingResidueIds = new Set(updatedResidues.map(r => r.residue_id));
    const updatedChains: CanonicalChain[] = [];
    for (const chain of mol.chains) {
      const remainingResIds = chain.residue_ids.filter(rid => survivingResidueIds.has(rid));
      if (remainingResIds.length > 0) {
        updatedChains.push({
          ...chain,
          residue_ids: remainingResIds
        });
      }
    }

    const derivedTopology = buildCanonicalTopology(survivingAtoms, survivingBonds);

    const derivedMolecule: CanonicalMolecule = {
      molecule_id: mol.molecule_id,
      name: mol.name,
      source_format: mol.source_format,
      atoms: survivingAtoms,
      atom_map: new Map(survivingAtoms.map(a => [a.canonical_id, a])),
      residues: updatedResidues,
      residue_map: new Map(updatedResidues.map(r => [r.residue_id, r])),
      chains: updatedChains,
      chain_map: new Map(updatedChains.map(c => [c.chain_id, c])),
      topology: derivedTopology,
      metadata: mol.metadata
    };

    // 4. Validate canonical structure
    validateCanonicalMolecule(derivedMolecule);

    // 5. Compute State Hashes & Construct Revision
    const previousStateHash = computeCanonicalStateHash(mol);
    const newStateHash = computeCanonicalStateHash(derivedMolecule);

    if (newStateHash === previousStateHash) {
      throw new ScientificEditingError(
        'removeHydrogens: internal error - derived state hash identical after removing hydrogens',
        'TOPOLOGY_VALIDATION_ERROR'
      );
    }

    const timestamp = new Date().toISOString();
    const parentRevId = options?.currentRevision?.revision_id || null;
    const opId = `op-h_remove-${generateUUID()}`;
    const revId = `rev-${generateUUID().slice(0, 8)}`;
    const revHash = computeRevisionHash(parentRevId, opId, newStateHash, timestamp);

    const revision: ScientificRevision = {
      revision_id: revId,
      parent_revision_id: parentRevId,
      operation_id: opId,
      document_id: document.document_id,
      object_id: targetObjectId,
      state_id: options?.stateId || obj.active_state_id,
      canonical_state_hash: newStateHash,
      revision_hash: revHash,
      timestamp: timestamp,
      author: options?.author || 'User',
      molecule_snapshot: derivedMolecule
    };

    // 6. Append Provenance Record
    const provenance: ProvenanceRecord = {
      provenance_id: `prov-${generateUUID()}`,
      revision_id: revId,
      parent_revision_id: parentRevId,
      operation_name: 'h_remove',
      resolved_atom_ids: hydrogenIds,
      parameters: {
        target_object_id: targetObjectId,
        removed_count: hydrogenIds.length,
        removed_hydrogen_ids: hydrogenIds
      },
      timestamp: timestamp,
      tool_version: 'Molexplorer 1.0',
      validation_summary: 'PASSED (Hydrogens Removed and Topology Validated)'
    };

    // 7. Update CanonicalMolecularDocument Container
    const updatedMoleculeMap = new Map(document.molecules);
    updatedMoleculeMap.set(derivedMolecule.molecule_id, derivedMolecule);

    const derivedState = buildCanonicalState(
      derivedMolecule,
      1,
      obj.active_state_id,
      'Active State'
    );
    const updatedStateMap = new Map(document.states);
    updatedStateMap.set(derivedState.state_id, derivedState);

    const updatedDocument: CanonicalMolecularDocument = {
      ...document,
      molecules: updatedMoleculeMap,
      states: updatedStateMap,
      updated_at: timestamp
    };

    validateCanonicalDocument(updatedDocument);

    return {
      revision,
      provenance,
      updatedDocument,
      updatedMolecule: derivedMolecule,
      removedHydrogenIds: hydrogenIds
    };
  }
}
