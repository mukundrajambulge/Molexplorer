import {
  CanonicalMolecule,
  CanonicalMolecularDocument,
  ScientificRevision,
  ProvenanceRecord
} from '../types/domain';
import {
  ScientificEditingKernel,
  ScientificEditingError
} from './ScientificEditingKernel';

/**
 * Authoritative Scientific Revision Manager.
 * Manages the immutable Directed Acyclic Graph (DAG) of ScientificRevisions,
 * active revision pointers, deterministic branching policies, exact state restoration,
 * and provenance preservation across undo/redo navigation.
 * Formally specified in docs/science/EDITING_KERNEL_SPEC.md.
 */
export class ScientificRevisionManager {
  private rootRevisionId: string;
  private activeRevisionId: string;
  private revisions: Map<string, ScientificRevision> = new Map();
  private provenance: Map<string, ProvenanceRecord> = new Map();
  private childrenMap: Map<string, string[]> = new Map(); // parentRevisionId -> ordered childRevisionIds
  private activeBranchMap: Map<string, string> = new Map(); // parentRevisionId -> activeChildRevisionId

  constructor(rootRevision: ScientificRevision, rootProvenance?: ProvenanceRecord) {
    if (!rootRevision || !rootRevision.revision_id) {
      throw new ScientificEditingError(
        'ScientificRevisionManager: invalid root revision provided',
        'EDIT_PRECONDITION_ERROR'
      );
    }

    this.rootRevisionId = rootRevision.revision_id;
    this.activeRevisionId = rootRevision.revision_id;
    this.revisions.set(rootRevision.revision_id, rootRevision);

    if (rootProvenance) {
      this.provenance.set(rootRevision.revision_id, rootProvenance);
    }
  }

  /**
   * Registers a newly executed ScientificRevision and its ProvenanceRecord into the DAG.
   * If a parent revision exists, this new revision is registered as the active forward branch.
   */
  public addRevision(revision: ScientificRevision, provenance?: ProvenanceRecord): void {
    if (!revision || !revision.revision_id) {
      throw new ScientificEditingError(
        'addRevision: invalid revision record provided',
        'EDIT_PRECONDITION_ERROR'
      );
    }

    if (this.revisions.has(revision.revision_id)) {
      throw new ScientificEditingError(
        `addRevision: revision "${revision.revision_id}" is already registered`,
        'EDIT_PRECONDITION_ERROR'
      );
    }

    // If revision has a parent, verify parent exists in this manager
    if (revision.parent_revision_id) {
      if (!this.revisions.has(revision.parent_revision_id)) {
        throw new ScientificEditingError(
          `addRevision: parent revision "${revision.parent_revision_id}" does not exist in revision graph`,
          'EDIT_PRECONDITION_ERROR'
        );
      }

      // Append to children map
      let children = this.childrenMap.get(revision.parent_revision_id);
      if (!children) {
        children = [];
        this.childrenMap.set(revision.parent_revision_id, children);
      }
      if (!children.includes(revision.revision_id)) {
        children.push(revision.revision_id);
      }

      // Set as active forward branch from parent
      this.activeBranchMap.set(revision.parent_revision_id, revision.revision_id);
    }

    this.revisions.set(revision.revision_id, revision);
    if (provenance) {
      this.provenance.set(revision.revision_id, provenance);
    }

    this.activeRevisionId = revision.revision_id;
  }

  /**
   * Returns true if the active revision has a valid parent revision to undo to.
   */
  public canUndo(): boolean {
    const active = this.getActiveRevision();
    return active.parent_revision_id !== null && this.revisions.has(active.parent_revision_id);
  }

  /**
   * Returns true if the active revision has an eligible forward child revision to redo to.
   */
  public canRedo(): boolean {
    const activeChildId = this.activeBranchMap.get(this.activeRevisionId);
    if (activeChildId && this.revisions.has(activeChildId)) {
      return true;
    }
    const children = this.childrenMap.get(this.activeRevisionId);
    return !!(children && children.length > 0 && this.revisions.has(children[0]));
  }

  /**
   * Performs exact scientific undo navigation.
   * Moves active pointer to parent revision, restores exact parent state snapshot,
   * preserves all history and provenance, and creates zero mutation revisions.
   */
  public undo(document: CanonicalMolecularDocument): {
    restoredRevision: ScientificRevision;
    updatedDocument: CanonicalMolecularDocument;
    restoredMolecule: CanonicalMolecule;
  } {
    if (!this.canUndo()) {
      throw new ScientificEditingError(
        'undo: cannot undo at root revision (no parent revision exists)',
        'EDIT_PRECONDITION_ERROR'
      );
    }

    const activeRev = this.getActiveRevision();
    const parentRevId = activeRev.parent_revision_id!;
    const parentRev = this.revisions.get(parentRevId);

    if (!parentRev) {
      throw new ScientificEditingError(
        `undo: parent revision "${parentRevId}" not found in revision graph`,
        'EDIT_PRECONDITION_ERROR'
      );
    }

    // Verify document scope
    if (parentRev.document_id && parentRev.document_id !== document.document_id) {
      throw new ScientificEditingError(
        `undo: revision document scope mismatch ("${parentRev.document_id}" vs "${document.document_id}")`,
        'EDIT_PRECONDITION_ERROR'
      );
    }

    const restoration = ScientificEditingKernel.restoreRevision(document, parentRev);
    this.activeRevisionId = parentRev.revision_id;

    return {
      restoredRevision: parentRev,
      updatedDocument: restoration.updatedDocument,
      restoredMolecule: restoration.restoredMolecule
    };
  }

  /**
   * Performs exact scientific redo navigation.
   * Moves active pointer to the active forward child revision, restores exact child state snapshot,
   * preserves all history and provenance, and creates zero mutation revisions.
   */
  public redo(
    document: CanonicalMolecularDocument,
    targetChildId?: string
  ): {
    restoredRevision: ScientificRevision;
    updatedDocument: CanonicalMolecularDocument;
    restoredMolecule: CanonicalMolecule;
  } {
    let childId = targetChildId;

    if (childId) {
      const children = this.childrenMap.get(this.activeRevisionId) || [];
      if (!children.includes(childId)) {
        throw new ScientificEditingError(
          `redo: revision "${childId}" is not a child of active revision "${this.activeRevisionId}"`,
          'EDIT_PRECONDITION_ERROR'
        );
      }
    } else {
      childId = this.activeBranchMap.get(this.activeRevisionId) || (this.childrenMap.get(this.activeRevisionId) || [])[0];
    }

    if (!childId || !this.revisions.has(childId)) {
      throw new ScientificEditingError(
        'redo: cannot redo when no child revision exists on active branch',
        'EDIT_PRECONDITION_ERROR'
      );
    }

    const childRev = this.revisions.get(childId)!;

    // Verify document scope
    if (childRev.document_id && childRev.document_id !== document.document_id) {
      throw new ScientificEditingError(
        `redo: revision document scope mismatch ("${childRev.document_id}" vs "${document.document_id}")`,
        'EDIT_PRECONDITION_ERROR'
      );
    }

    const restoration = ScientificEditingKernel.restoreRevision(document, childRev);
    this.activeRevisionId = childRev.revision_id;
    if (childRev.parent_revision_id) {
      this.activeBranchMap.set(childRev.parent_revision_id, childRev.revision_id);
    }

    return {
      restoredRevision: childRev,
      updatedDocument: restoration.updatedDocument,
      restoredMolecule: restoration.restoredMolecule
    };
  }

  /**
   * Navigates directly to any historical revision in the DAG by its revisionId.
   */
  public navigateToRevision(
    document: CanonicalMolecularDocument,
    targetRevisionId: string
  ): {
    restoredRevision: ScientificRevision;
    updatedDocument: CanonicalMolecularDocument;
    restoredMolecule: CanonicalMolecule;
  } {
    const targetRev = this.revisions.get(targetRevisionId);
    if (!targetRev) {
      throw new ScientificEditingError(
        `navigateToRevision: revision "${targetRevisionId}" not found in revision graph`,
        'EDIT_PRECONDITION_ERROR'
      );
    }

    // Verify document scope
    if (targetRev.document_id && targetRev.document_id !== document.document_id) {
      throw new ScientificEditingError(
        `navigateToRevision: revision document scope mismatch ("${targetRev.document_id}" vs "${document.document_id}")`,
        'EDIT_PRECONDITION_ERROR'
      );
    }

    const restoration = ScientificEditingKernel.restoreRevision(document, targetRev);
    this.activeRevisionId = targetRev.revision_id;

    // If navigating to a node with a parent, update active branch tracking along the path
    if (targetRev.parent_revision_id) {
      this.activeBranchMap.set(targetRev.parent_revision_id, targetRev.revision_id);
    }

    return {
      restoredRevision: targetRev,
      updatedDocument: restoration.updatedDocument,
      restoredMolecule: restoration.restoredMolecule
    };
  }

  /**
   * Explicitly sets which child branch from a given parent revision is active for redo.
   */
  public selectBranch(parentRevisionId: string, childRevisionId: string): void {
    const children = this.childrenMap.get(parentRevisionId) || [];
    if (!children.includes(childRevisionId)) {
      throw new ScientificEditingError(
        `selectBranch: revision "${childRevisionId}" is not a child of parent "${parentRevisionId}"`,
        'EDIT_PRECONDITION_ERROR'
      );
    }
    this.activeBranchMap.set(parentRevisionId, childRevisionId);
  }

  public getActiveRevisionId(): string {
    return this.activeRevisionId;
  }

  public getActiveRevision(): ScientificRevision {
    const rev = this.revisions.get(this.activeRevisionId);
    if (!rev) {
      throw new ScientificEditingError(
        `ScientificRevisionManager: active revision "${this.activeRevisionId}" not found in revision graph`,
        'EDIT_PRECONDITION_ERROR'
      );
    }
    return rev;
  }

  public getRootRevision(): ScientificRevision {
    return this.revisions.get(this.rootRevisionId)!;
  }

  public getRevision(revisionId: string): ScientificRevision | undefined {
    return this.revisions.get(revisionId);
  }

  public getProvenance(revisionId: string): ProvenanceRecord | undefined {
    return this.provenance.get(revisionId);
  }

  public getAllRevisions(): ScientificRevision[] {
    return Array.from(this.revisions.values());
  }

  public getRevisionCount(): number {
    return this.revisions.size;
  }

  /**
   * Returns the linear history of revisions leading from root to the active revision.
   */
  public getHistory(): ScientificRevision[] {
    const chain: ScientificRevision[] = [];
    let curr: ScientificRevision | undefined = this.getActiveRevision();
    while (curr) {
      chain.unshift(curr);
      if (curr.parent_revision_id) {
        curr = this.revisions.get(curr.parent_revision_id);
      } else {
        break;
      }
    }
    return chain;
  }

  /**
   * Returns child revisions for a given parent revision ID.
   */
  public getChildren(parentRevisionId: string): ScientificRevision[] {
    const childIds = this.childrenMap.get(parentRevisionId) || [];
    return childIds.map(id => this.revisions.get(id)!).filter(Boolean);
  }

  /**
   * Returns the full tree structure for DAG inspection and visualization.
   */
  public getRevisionTree(): {
    revision: ScientificRevision;
    children: string[];
    isActive: boolean;
    activeChildId?: string;
  }[] {
    return Array.from(this.revisions.values()).map(rev => ({
      revision: rev,
      children: this.childrenMap.get(rev.revision_id) || [],
      isActive: rev.revision_id === this.activeRevisionId,
      activeChildId: this.activeBranchMap.get(rev.revision_id)
    }));
  }
}
