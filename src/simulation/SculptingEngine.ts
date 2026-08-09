import { Atom } from '../lib/MolProcessor';

export interface DraggedAtomConstraint {
  atomIndex: number;
  targetPos: { x: number; y: number; z: number };
  springConstant: number;
}

export class SculptingEngine {
  /**
   * Perform steepest-descent energy minimization on atom coordinates
   * E_total = E_bond + E_angle + E_vdW + E_spring
   */
  public static minimize(
    atoms: Atom[],
    steps: number = 50,
    stepSize: number = 0.002,
    dragConstraint?: DraggedAtomConstraint
  ): { atoms: Atom[]; totalEnergy: number } {
    if (!atoms || atoms.length === 0) return { atoms: [], totalEnergy: 0 };

    // Work on copy of coordinates
    const coords = atoms.map(a => ({ x: a.x, y: a.y, z: a.z }));
    const forces = atoms.map(() => ({ x: 0, y: 0, z: 0 }));

    let totalEnergy = 0;

    for (let step = 0; step < steps; step++) {
      totalEnergy = 0;
      forces.forEach(f => { f.x = 0; f.y = 0; f.z = 0; });

      // 1. Bond Stretch Energy (Harmonic Oscillator)
      atoms.forEach((atom, i) => {
        atom.bonds.forEach(j => {
          if (j > i && j < atoms.length) {
            const dx = coords[j].x - coords[i].x;
            const dy = coords[j].y - coords[i].y;
            const dz = coords[j].z - coords[i].z;
            const r = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001;

            const r0 = 1.54; // Reference bond length in Angstroms
            const kb = 100.0; // Force constant kcal/(mol*A^2)

            const delta = r - r0;
            const energy = 0.5 * kb * delta * delta;
            totalEnergy += energy;

            const ux = dx / r;
            const uy = dy / r;
            const uz = dz / r;

            const fMag = kb * delta;
            forces[i].x += fMag * ux;
            forces[i].y += fMag * uy;
            forces[i].z += fMag * uz;

            forces[j].x -= fMag * ux;
            forces[j].y -= fMag * uy;
            forces[j].z -= fMag * uz;
          }
        });
      });

      // 2. Non-bonded Lennard-Jones 12-6 Repulsion
      for (let i = 0; i < atoms.length; i++) {
        for (let j = i + 1; j < atoms.length; j++) {
          if (!atoms[i].bonds.includes(j)) {
            const dx = coords[j].x - coords[i].x;
            const dy = coords[j].y - coords[i].y;
            const dz = coords[j].z - coords[i].z;
            const r2 = dx * dx + dy * dy + dz * dz;

            if (r2 > 0.01 && r2 < 16.0) { // 4.0 Angstrom cutoff
              const r = Math.sqrt(r2);
              const sigma = 3.4; // Average vdW contact distance
              const epsilon = 0.1;

              const sr6 = Math.pow(sigma / r, 6);
              const vdwEnergy = 4 * epsilon * (sr6 * sr6 - sr6);
              totalEnergy += Math.max(0, vdwEnergy);

              if (r < 2.5) { // Repulsive force gradient
                const fMag = (24 * epsilon / r2) * (2 * sr6 * sr6 - sr6);
                forces[i].x -= fMag * dx;
                forces[i].y -= fMag * dy;
                forces[i].z -= fMag * dz;

                forces[j].x += fMag * dx;
                forces[j].y += fMag * dy;
                forces[j].z += fMag * dz;
              }
            }
          }
        }
      }

      // 3. Dragged Atom Harmonic Spring Constraint
      if (dragConstraint && dragConstraint.atomIndex >= 0 && dragConstraint.atomIndex < atoms.length) {
        const idx = dragConstraint.atomIndex;
        const dx = dragConstraint.targetPos.x - coords[idx].x;
        const dy = dragConstraint.targetPos.y - coords[idx].y;
        const dz = dragConstraint.targetPos.z - coords[idx].z;
        const k = dragConstraint.springConstant || 200.0;

        forces[idx].x += k * dx;
        forces[idx].y += k * dy;
        forces[idx].z += k * dz;

        totalEnergy += 0.5 * k * (dx * dx + dy * dy + dz * dz);
      }

      // Update coordinates via steepest descent
      for (let i = 0; i < atoms.length; i++) {
        coords[i].x += stepSize * forces[i].x;
        coords[i].y += stepSize * forces[i].y;
        coords[i].z += stepSize * forces[i].z;
      }
    }

    // Return updated atoms
    const updatedAtoms = atoms.map((a, i) => ({
      ...a,
      x: coords[i].x,
      y: coords[i].y,
      z: coords[i].z
    }));

    return { atoms: updatedAtoms, totalEnergy };
  }
}
