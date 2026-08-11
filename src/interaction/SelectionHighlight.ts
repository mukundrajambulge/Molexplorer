import { MolecularSelection, PickedAtom } from './types';

export class SelectionHighlight {
  /**
   * Applies non-destructive selection overlays on top of the 3Dmol scene.
   * Uses both addStyle and direct 3D luminous sphere/cylinder markers to guarantee 100% visibility
   * across all representation modes (Cartoon, Sticks, Surfaces, Spheres, Lines).
   */
  static applySelectionOverlay(
    viewer: any,
    selection: MolecularSelection,
    highlightColor: string = '#00f2ff'
  ) {
    if (!viewer || !selection || selection.atoms.length === 0) return;

    // 1. Group atoms by model ID
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

    // 2. Apply additive style overlay to each model
    atomsByModel.forEach((serials, mId) => {
      if (serials.length === 0) return;
      const model = viewer.getModel ? viewer.getModel(mId) : null;
      const target = model ? model : viewer;

      if (typeof target.addStyle === 'function') {
        target.addStyle(
          { serial: serials },
          {
            stick: {
              color: highlightColor,
              radius: 0.28,
              opacity: 0.95
            },
            sphere: {
              color: highlightColor,
              scale: 0.38,
              opacity: 0.95
            }
          }
        );
      }
    });

    // 3. Render 3D luminous sphere halos directly on the atom 3D coordinates
    // This ensures selected atoms glow brightly even in Cartoon or Surface representations
    selection.atoms.forEach(atom => {
      if (typeof atom.x === 'number' && typeof atom.y === 'number' && typeof atom.z === 'number') {
        viewer.addSphere({
          center: { x: atom.x, y: atom.y, z: atom.z },
          radius: 0.38,
          color: highlightColor,
          opacity: 0.90
        });
      }
    });
  }

  /**
   * Renders active measurement markers (points, lines, angles, labels) in the 3D viewport.
   */
  static applyMeasurementMarkers(
    viewer: any,
    clickedBuffer: Array<{ serial: number; x: number; y: number; z: number; name?: string }>,
    mode: 'distance' | 'angle' | 'dihedral' | 'label' | null
  ) {
    if (!viewer || !clickedBuffer || clickedBuffer.length === 0) return;

    // Draw pulsing highlight spheres on each selected measurement point
    clickedBuffer.forEach((pt, idx) => {
      const markerColor = idx === 0 ? '#00f2ff' : idx === 1 ? '#f59e0b' : idx === 2 ? '#a855f7' : '#ec4899';
      
      // Marker sphere
      viewer.addSphere({
        center: { x: pt.x, y: pt.y, z: pt.z },
        radius: 0.52,
        color: markerColor,
        opacity: 0.95
      });

      // Point label
      const ptLabel = `P${idx + 1}: ${(pt.name || '').trim() || `#${pt.serial}`}`;
      viewer.addLabel(ptLabel, {
        position: { x: pt.x, y: pt.y + 0.45, z: pt.z },
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: markerColor,
        fontColor: '#ffffff',
        font: 'monospace',
        fontSize: 11,
        backgroundOpacity: 0.95
      });
    });

    // Draw active connecting lines between collected points
    if (clickedBuffer.length >= 2) {
      for (let i = 0; i < clickedBuffer.length - 1; i++) {
        const p1 = clickedBuffer[i];
        const p2 = clickedBuffer[i + 1];
        viewer.addCylinder({
          start: { x: p1.x, y: p1.y, z: p1.z },
          end: { x: p2.x, y: p2.y, z: p2.z },
          radius: 0.12,
          color: '#00f2ff',
          fromCap: 1,
          toCap: 1
        });
      }
    }
  }

  /**
   * Generates selection label or hover tooltip text.
   */
  static formatAtomTooltip(atom: PickedAtom): string {
    const typeLabel = atom.isHetatm ? 'LIGAND' : 'ATOM';
    return `${typeLabel} ${atom.atomName} #${atom.serial} | ${atom.residueName} ${atom.residueNumber}:${atom.chainId} | (${atom.x.toFixed(2)}, ${atom.y.toFixed(2)}, ${atom.z.toFixed(2)})`;
  }
}
