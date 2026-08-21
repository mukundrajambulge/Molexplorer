import crypto from 'crypto';
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
  EditOperation
} from '../types/domain';
import { buildCanonicalTopology } from './BondAdapter';
import { buildCanonicalMolecule, validateCanonicalMolecule } from './HierarchyAdapter';
import { buildCanonicalState, validateCanonicalDocument } from './DocumentAdapter';
import { computeCanonicalStateHash, computeRevisionHash } from './StateHasher';

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
    const opId = `op-root-${crypto.randomUUID()}`;
    const revId = `rev-0-${crypto.randomUUID().slice(0, 8)}`;
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
    const opId = `op-remove-${crypto.randomUUID()}`;
    const revId = `rev-${crypto.randomUUID().slice(0, 8)}`;
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
      provenance_id: `prov-${crypto.randomUUID()}`,
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
}
