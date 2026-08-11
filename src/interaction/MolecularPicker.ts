import { PickedAtom } from './types';

export class MolecularPicker {
  /**
   * Normalizes raw 3Dmol atom / AtomSpec into standardized PickedAtom representation.
   */
  static normalizeAtom(rawAtom: any, structureId: string = 'model_0', modelId: number = 0): PickedAtom {
    if (!rawAtom) {
      return {
        structureId,
        serial: 0,
        atomName: '',
        element: 'C',
        residueName: 'UNK',
        residueNumber: 0,
        chainId: 'A',
        x: 0,
        y: 0,
        z: 0,
        modelId
      };
    }

    const serial = rawAtom.serial !== undefined 
      ? Number(rawAtom.serial) 
      : (rawAtom.index !== undefined ? Number(rawAtom.index) + 1 : 0);

    const atomName = (rawAtom.atom || rawAtom.name || '').trim();
    
    // Determine element symbol
    let element = (rawAtom.elem || rawAtom.element || '').toUpperCase().trim();
    if (!element && atomName) {
      element = atomName.replace(/[0-9]/g, '').trim().slice(0, 2);
    }
    if (!element) element = 'C';

    const residueName = (rawAtom.resn || rawAtom.resName || rawAtom.residue || 'UNK').trim();
    const residueNumber = rawAtom.resi !== undefined 
      ? Number(rawAtom.resi) 
      : (rawAtom.resSeq !== undefined ? Number(rawAtom.resSeq) : 0);

    const chainId = (rawAtom.chain || rawAtom.chainID || 'A').trim();
    
    const x = typeof rawAtom.x === 'number' ? rawAtom.x : 0;
    const y = typeof rawAtom.y === 'number' ? rawAtom.y : 0;
    const z = typeof rawAtom.z === 'number' ? rawAtom.z : 0;

    const isHetatm = Boolean(
      rawAtom.hetflag || 
      rawAtom.isHetero || 
      rawAtom.record_type === 'HETATM' ||
      !['ALA', 'ARG', 'ASN', 'ASP', 'CYS', 'GLN', 'GLU', 'GLY', 'HIS', 'ILE', 'LEU', 'LYS', 'MET', 'PHE', 'PRO', 'SER', 'THR', 'TRP', 'TYR', 'VAL', 'DA', 'DC', 'DG', 'DT', 'A', 'C', 'G', 'U'].includes(residueName.toUpperCase())
    );

    return {
      structureId,
      serial,
      atomName,
      element,
      residueName,
      residueNumber,
      chainId,
      x,
      y,
      z,
      isHetatm,
      bFactor: rawAtom.b,
      occupancy: rawAtom.q,
      modelId: rawAtom.model !== undefined ? rawAtom.model : modelId
    };
  }

  /**
   * Extracts all atoms from a 3Dmol viewer / model for selection expansion index.
   */
  static extractAllAtoms(viewer: any, structureId: string = 'model_0'): PickedAtom[] {
    if (!viewer) return [];
    const models = viewer.getModel ? [viewer.getModel()] : (viewer.getModels ? viewer.getModels() : []);
    const allAtoms: PickedAtom[] = [];

    models.forEach((m: any, mIdx: number) => {
      if (!m) return;
      const modelAtoms = m.selectedAtoms ? m.selectedAtoms({}) : [];
      modelAtoms.forEach((raw: any) => {
        allAtoms.push(MolecularPicker.normalizeAtom(raw, structureId, mIdx));
      });
    });

    return allAtoms;
  }
}
