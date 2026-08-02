import { MolProcessor, Atom } from "./MolProcessor";

export interface Interaction {
  type: 'hbond' | 'hydrophobic' | 'pistacking';
  atom1: Atom; // receptor atom
  atom2: Atom; // ligand atom
  distance: number;
}

function dist(a: Atom, b: Atom) {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2) + Math.pow(a.z - b.z, 2));
}

// Very simple heuristic for interaction detection
export function calculateInteractions(receptorPDB: string, ligandPDB: string): Interaction[] {
  const recProc = new MolProcessor(receptorPDB, 'pdb');
  const ligProc = new MolProcessor(ligandPDB, 'pdb');
  
  const recAtoms = recProc.atoms.filter(a => a.elem !== 'H');
  const ligAtoms = ligProc.atoms.filter(a => a.elem !== 'H');
  const ligAllAtoms = ligProc.atoms;
  const recAllAtoms = recProc.atoms;

  const interactions: Interaction[] = [];
  const MAX_DIST = 5.5;

  // Pre-filter by distance for performance
  for (const latom of ligAtoms) {
    for (const ratom of recAtoms) {
      const d = dist(latom, ratom);
      if (d > MAX_DIST) continue;

      const isLpolar = ['N', 'O', 'S'].includes(latom.elem);
      const isRpolar = ['N', 'O', 'S'].includes(ratom.elem);
      const isLnonpolar = ['C', 'F', 'CL', 'BR', 'I'].includes(latom.elem);
      const isRnonpolar = ['C', 'F', 'CL', 'BR', 'I'].includes(ratom.elem);

      if (d >= 2.5 && d <= 3.5 && isLpolar && isRpolar) {
        // H-bond heuristic
        interactions.push({
          type: 'hbond',
          atom1: ratom,
          atom2: latom,
          distance: d
        });
      } else if (d >= 3.5 && d <= 4.0 && isLnonpolar && isRnonpolar) {
        // Hydrophobic contact heuristic
        interactions.push({
          type: 'hydrophobic',
          atom1: ratom,
          atom2: latom,
          distance: d
        });
      }
    }
  }

  // Pi-stacking is complex to detect perfectly without connectivity, 
  // but we can look for close aromatic rings. We'll skip complex ring detection 
  // for this heuristic and stick to H-bonds and hydrophobic contacts for the overlay.
  // We can add a simple centroid check if we detect 5 or 6 membered rings.
  // To keep it clean and robust, we'll just surface these two types as geometric heuristics.

  return interactions;
}
