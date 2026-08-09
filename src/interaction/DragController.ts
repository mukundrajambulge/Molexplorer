import { Atom } from '../lib/MolProcessor';

export interface DragEventState {
  isDragging: boolean;
  draggedAtomIndex: number;
  draggedAtomSerial: number;
  mouseWorldPos: { x: number; y: number; z: number };
}

export class DragController {
  private state: DragEventState = {
    isDragging: false,
    draggedAtomIndex: -1,
    draggedAtomSerial: -1,
    mouseWorldPos: { x: 0, y: 0, z: 0 }
  };

  public startDrag(atomIndex: number, atomSerial: number, initialWorldPos: { x: number; y: number; z: number }): void {
    this.state = {
      isDragging: true,
      draggedAtomIndex: atomIndex,
      draggedAtomSerial: atomSerial,
      mouseWorldPos: initialWorldPos
    };
  }

  public updateDragPosition(newWorldPos: { x: number; y: number; z: number }): void {
    if (this.state.isDragging) {
      this.state.mouseWorldPos = newWorldPos;
    }
  }

  public endDrag(): void {
    this.state.isDragging = false;
    this.state.draggedAtomIndex = -1;
    this.state.draggedAtomSerial = -1;
  }

  public getState(): DragEventState {
    return { ...this.state };
  }

  /**
   * Find nearest atom to 3D raycast target
   */
  public static findNearestAtom(atoms: Atom[], targetPos: { x: number; y: number; z: number }, maxDistance: number = 3.0): { atom: Atom; index: number; distance: number } | null {
    let bestMatch: { atom: Atom; index: number; distance: number } | null = null;
    let minDist = maxDistance;

    atoms.forEach((atom, idx) => {
      const dx = atom.x - targetPos.x;
      const dy = atom.y - targetPos.y;
      const dz = atom.z - targetPos.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (d < minDist) {
        minDist = d;
        bestMatch = { atom, index: idx, distance: d };
      }
    });

    return bestMatch;
  }
}
