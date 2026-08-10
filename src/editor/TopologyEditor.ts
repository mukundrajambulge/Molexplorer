import { MolProcessor, Atom } from '../lib/MolProcessor';

export class TopologyEditor {
  /**
   * Add or update a covalent bond between two atoms by index
   */
  public static addBond(proc: MolProcessor, atom1Idx: number, atom2Idx: number, order: number = 1): void {
    if (atom1Idx < 0 || atom1Idx >= proc.atoms.length || atom2Idx < 0 || atom2Idx >= proc.atoms.length || atom1Idx === atom2Idx) {
      return;
    }

    const a1 = proc.atoms[atom1Idx];
    const a2 = proc.atoms[atom2Idx];

    if (!a1.bonds.includes(atom2Idx)) a1.bonds.push(atom2Idx);
    if (!a2.bonds.includes(atom1Idx)) a2.bonds.push(atom1Idx);
  }

  /**
   * Remove a bond between two atoms
   */
  public static removeBond(proc: MolProcessor, atom1Idx: number, atom2Idx: number): void {
    if (atom1Idx < 0 || atom1Idx >= proc.atoms.length || atom2Idx < 0 || atom2Idx >= proc.atoms.length) {
      return;
    }

    const a1 = proc.atoms[atom1Idx];
    const a2 = proc.atoms[atom2Idx];

    a1.bonds = a1.bonds.filter(b => b !== atom2Idx);
    a2.bonds = a2.bonds.filter(b => b !== atom1Idx);
  }

  /**
   * Cycle bond order between two atoms (1 -> 2 -> 3 -> 1)
   */
  public static cycleBondOrder(proc: MolProcessor, atom1Idx: number, atom2Idx: number): void {
    if (!proc.atoms[atom1Idx]?.bonds.includes(atom2Idx)) {
      this.addBond(proc, atom1Idx, atom2Idx, 1);
    }
  }

  /**
   * Add implicit hydrogens based on standard valency (h_add)
   */
  public static addHydrogens(proc: MolProcessor): void {
    const newAtoms: Atom[] = [...proc.atoms];
    const STANDARD_VALENCY: Record<string, number> = { C: 4, N: 3, O: 2, S: 2, P: 5, F: 1, CL: 1, BR: 1, I: 1 };
    const BOND_LENGTH = 1.09; // Average C-H / N-H bond length in Angstroms

    let nextSerial = Math.max(...proc.atoms.map(a => a.serial), 0) + 1;

    proc.atoms.forEach((atom, idx) => {
      if (atom.elem === 'H') return;
      const targetValency = STANDARD_VALENCY[atom.elem.toUpperCase()] || 0;
      const currentBonds = atom.bonds.length;

      if (currentBonds < targetValency) {
        const neededH = targetValency - currentBonds;
        for (let h = 0; h < neededH; h++) {
          // Generate tetrahedral / trigonal coordinates for new Hydrogen
          const theta = (h * (2 * Math.PI / neededH)) + (Math.PI / 4);
          const dx = BOND_LENGTH * Math.cos(theta);
          const dy = BOND_LENGTH * Math.sin(theta);
          const dz = (h % 2 === 0 ? 0.5 : -0.5);

          const hIdx = newAtoms.length;
          const hAtom: Atom = {
            serial: nextSerial++,
            name: 'H',
            resName: atom.resName,
            chainID: atom.chainID,
            resSeq: atom.resSeq,
            x: atom.x + dx,
            y: atom.y + dy,
            z: atom.z + dz,
            occupancy: 1.0,
            bFactor: 20.0,
            altLoc: ' ',
            isHetero: false,
            elem: 'H',
            bonds: [idx]
          };

          newAtoms.push(hAtom);
          atom.bonds.push(hIdx);
        }
      }
    });

    proc.atoms = newAtoms;
  }

  /**
   * Remove all hydrogen atoms from structure (h_remove)
   */
  public static removeHydrogens(proc: MolProcessor): void {
    const nonHIndices = new Map<number, number>();
    const filteredAtoms: Atom[] = [];

    proc.atoms.forEach((atom, oldIdx) => {
      if (atom.elem !== 'H') {
        nonHIndices.set(oldIdx, filteredAtoms.length);
        filteredAtoms.push({ ...atom, bonds: [] });
      }
    });

    // Re-map bond indices
    proc.atoms.forEach((atom, oldIdx) => {
      if (atom.elem !== 'H' && nonHIndices.has(oldIdx)) {
        const newIdx = nonHIndices.get(oldIdx)!;
        const newBonds: number[] = [];
        atom.bonds.forEach(bOld => {
          if (nonHIndices.has(bOld)) {
            newBonds.push(nonHIndices.get(bOld)!);
          }
        });
        filteredAtoms[newIdx].bonds = newBonds;
      }
    });

    proc.atoms = filteredAtoms;
  }

  /**
   * Delete selected atoms by serial numbers
   */
  public static deleteAtoms(proc: MolProcessor, atomSerials: Set<number>): void {
    const keepIndices = new Map<number, number>();
    const filteredAtoms: Atom[] = [];

    proc.atoms.forEach((atom, oldIdx) => {
      if (!atomSerials.has(atom.serial)) {
        keepIndices.set(oldIdx, filteredAtoms.length);
        filteredAtoms.push({ ...atom, bonds: [] });
      }
    });

    proc.atoms.forEach((atom, oldIdx) => {
      if (!atomSerials.has(atom.serial) && keepIndices.has(oldIdx)) {
        const newIdx = keepIndices.get(oldIdx)!;
        const newBonds: number[] = [];
        atom.bonds.forEach(bOld => {
          if (keepIndices.has(bOld)) {
            newBonds.push(keepIndices.get(bOld)!);
          }
        });
        filteredAtoms[newIdx].bonds = newBonds;
      }
    });

    proc.atoms = filteredAtoms;
  }
}
