import { PickedAtom, SelectionLevel, MolecularSelection, SelectionSummary, createSelectionKey } from './types';

export class SelectionManager {
  /**
   * Expands a picked atom to target granularity level based on surrounding model atoms.
   */
  static expandSelection(
    atom: PickedAtom,
    level: SelectionLevel,
    allAtoms: PickedAtom[]
  ): PickedAtom[] {
    if (!atom) return [];

    switch (level) {
      case 'atom':
        return [atom];

      case 'residue': {
        return allAtoms.filter(a => 
          a.structureId === atom.structureId &&
          a.chainId === atom.chainId &&
          a.residueNumber === atom.residueNumber &&
          a.residueName.toUpperCase() === atom.residueName.toUpperCase()
        );
      }

      case 'ligand': {
        // If atom is HETATM / ligand, expand to all atoms in that ligand residue
        if (atom.isHetatm) {
          const ligandAtoms = allAtoms.filter(a =>
            a.structureId === atom.structureId &&
            a.chainId === atom.chainId &&
            a.residueNumber === atom.residueNumber &&
            a.residueName.toUpperCase() === atom.residueName.toUpperCase() &&
            a.isHetatm
          );
          if (ligandAtoms.length > 0) return ligandAtoms;
        }
        // Fallback to residue expansion if clicked standard residue
        return SelectionManager.expandSelection(atom, 'residue', allAtoms);
      }

      case 'chain': {
        return allAtoms.filter(a =>
          a.structureId === atom.structureId &&
          a.chainId === atom.chainId
        );
      }

      case 'molecule': {
        return allAtoms.filter(a =>
          a.structureId === atom.structureId
        );
      }

      default:
        return [atom];
    }
  }

  /**
   * Toggles selection state of an atom/group.
   * If isMultiSelect (Shift/Ctrl) is false, replaces previous selection.
   * If isMultiSelect is true, adds or removes from existing selection.
   */
  static toggle(
    atom: PickedAtom,
    level: SelectionLevel,
    allAtoms: PickedAtom[],
    currentSelection: MolecularSelection,
    isMultiSelect: boolean = false
  ): MolecularSelection {
    const targetAtoms = SelectionManager.expandSelection(atom, level, allAtoms);
    if (targetAtoms.length === 0) return currentSelection;

    const atomKey = createSelectionKey(atom.structureId, atom.serial);
    const isAlreadySelected = currentSelection.selectedKeys.has(atomKey);

    let nextAtoms: PickedAtom[] = [];
    let nextKeys = new Set<string>();

    if (!isMultiSelect) {
      if (isAlreadySelected && currentSelection.atoms.length === targetAtoms.length) {
        // Deselect if clicking the exact same single selection
        return {
          level,
          atoms: [],
          selectedKeys: new Set()
        };
      } else {
        // Replace selection with new expanded group
        nextAtoms = [...targetAtoms];
        targetAtoms.forEach(a => nextKeys.add(createSelectionKey(a.structureId, a.serial)));
      }
    } else {
      // Multi-select toggle
      nextKeys = new Set(currentSelection.selectedKeys);
      const targetKeys = new Set(targetAtoms.map(a => createSelectionKey(a.structureId, a.serial)));

      if (isAlreadySelected) {
        // Remove target atoms from selection
        targetKeys.forEach(k => nextKeys.delete(k));
        nextAtoms = currentSelection.atoms.filter(a => nextKeys.has(createSelectionKey(a.structureId, a.serial)));
      } else {
        // Add target atoms to selection
        const existingAtomsMap = new Map<string, PickedAtom>();
        currentSelection.atoms.forEach(a => existingAtomsMap.set(createSelectionKey(a.structureId, a.serial), a));
        targetAtoms.forEach(a => {
          const k = createSelectionKey(a.structureId, a.serial);
          existingAtomsMap.set(k, a);
          nextKeys.add(k);
        });
        nextAtoms = Array.from(existingAtomsMap.values());
      }
    }

    return {
      level,
      atoms: nextAtoms,
      selectedKeys: nextKeys
    };
  }

  /**
   * Computes a structured summary of selected molecular entities for UI panels.
   */
  static computeSummary(selection: MolecularSelection): SelectionSummary {
    const residuesSet = new Set<string>();
    const chainsSet = new Set<string>();
    const ligandsSet = new Set<string>();
    const structuresSet = new Set<string>();

    let sumX = 0, sumY = 0, sumZ = 0;
    const count = selection.atoms.length;

    selection.atoms.forEach(a => {
      structuresSet.add(a.structureId);
      chainsSet.add(a.chainId);
      residuesSet.add(`${a.residueName}-${a.residueNumber}:${a.chainId}`);
      
      if (a.isHetatm && !['HOH', 'WAT', 'DOD', 'SOL'].includes(a.residueName.toUpperCase())) {
        ligandsSet.add(`${a.residueName}:${a.residueNumber}`);
      }

      sumX += a.x;
      sumY += a.y;
      sumZ += a.z;
    });

    return {
      totalAtoms: count,
      residues: Array.from(residuesSet),
      chains: Array.from(chainsSet).sort(),
      ligands: Array.from(ligandsSet),
      structures: Array.from(structuresSet),
      centroid: count > 0 ? { x: sumX / count, y: sumY / count, z: sumZ / count } : undefined
    };
  }
}
