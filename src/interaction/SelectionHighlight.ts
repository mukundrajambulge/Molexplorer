import { MolecularSelection, PickedAtom } from './types';

export class SelectionHighlight {
  /**
   * Applies selection overlay without modifying base molecular representation.
   */
  static applySelectionOverlay(
    viewer: any,
    selection: MolecularSelection,
    highlightColor: string = '#00f2ff'
  ) {
    if (!viewer) return;

    // Clear previous selection shapes if any custom shapes were drawn
    // In 3Dmol, applying a style overlay to specific serials or AtomSpecs adds the visual indicator
    if (selection.atoms.length === 0) return;

    // Group atoms by structure/model
    const atomsByModel = new Map<number, number[]>();
    selection.atoms.forEach(a => {
      const mId = a.modelId !== undefined ? a.modelId : 0;
      let list = atomsByModel.get(mId);
      if (!list) {
        list = [];
        atomsByModel.set(mId, list);
      }
      list.push(a.serial);
    });

    atomsByModel.forEach((serials, mId) => {
      if (serials.length === 0) return;
      const model = viewer.getModel ? viewer.getModel(mId) : null;
      const target = model ? model : viewer;

      // Overlay luminous stick and sphere halo
      target.setStyle(
        { serial: serials },
        {
          stick: {
            color: highlightColor,
            radius: 0.26,
            opacity: 0.95
          },
          sphere: {
            color: highlightColor,
            scale: 0.38,
            opacity: 0.95
          }
        }
      );
    });
  }

  /**
   * Generates selection label or hover tooltip text.
   */
  static formatAtomTooltip(atom: PickedAtom): string {
    const typeLabel = atom.isHetatm ? 'LIGAND' : 'ATOM';
    return `${typeLabel} ${atom.atomName} #${atom.serial} | ${atom.residueName} ${atom.residueNumber}:${atom.chainId} | (${atom.x.toFixed(2)}, ${atom.y.toFixed(2)}, ${atom.z.toFixed(2)})`;
  }
}
