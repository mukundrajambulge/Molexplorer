import { MolProcessor, Atom } from "./MolProcessor";

export interface Interaction {
  type: 'hbond' | 'hydrophobic' | 'pistacking' | 'saltbridge' | 'halogen' | 'cationpi';
  atom1: Atom; // receptor atom
  atom2: Atom; // ligand atom
  distance: number;
}

interface Vec3 { x: number; y: number; z: number; }

function dist(a: Vec3, b: Vec3) {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2) + Math.pow(a.z - b.z, 2));
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function norm(a: Vec3): number {
  return Math.sqrt(dot(a, a));
}

function angleBetween(h: Vec3, d: Vec3, a: Vec3): number {
  const vHD = sub(d, h);
  const vHA = sub(a, h);
  const dProd = dot(vHD, vHA);
  const nProduct = norm(vHD) * norm(vHA);
  if (nProduct === 0) return 0;
  const cos = dProd / nProduct;
  const clampedCos = Math.max(-1, Math.min(1, cos));
  return (Math.acos(clampedCos) * 180) / Math.PI;
}

interface Ring {
  centroid: Vec3;
  normal: Vec3;
  atoms: Atom[];
}

function findRings(atoms: Atom[]): Ring[] {
  const rings: Ring[] = [];
  
  // 1. For standard aromatic amino acids, detect rings by residue name and atom names
  const aromaticResidues = ['PHE', 'TYR', 'TRP', 'HIS'];
  const residueGroups = new Map<string, Atom[]>();
  atoms.forEach((a) => {
    if (aromaticResidues.includes(a.resName.toUpperCase())) {
      const key = `${a.chainID}:${a.resSeq}:${a.resName}`;
      if (!residueGroups.has(key)) residueGroups.set(key, []);
      residueGroups.get(key)!.push(a);
    }
  });

  residueGroups.forEach((resAtoms, key) => {
    const resName = key.split(':')[2].toUpperCase();
    if (resName === 'PHE' || resName === 'TYR') {
      const ringNames = ['CG', 'CD1', 'CD2', 'CE1', 'CE2', 'CZ'];
      const ring = resAtoms.filter(a => ringNames.includes(a.name.trim()));
      if (ring.length === 6) rings.push(createRing(ring));
    } else if (resName === 'HIS') {
      const ringNames = ['CG', 'ND1', 'CD2', 'CE1', 'NE2'];
      const ring = resAtoms.filter(a => ringNames.includes(a.name.trim()));
      if (ring.length === 5) rings.push(createRing(ring));
    } else if (resName === 'TRP') {
      const benzeneNames = ['CD2', 'CE2', 'CZ2', 'CH2', 'CZ3', 'CE3'];
      const pyrroleNames = ['CD1', 'NE1', 'CE2', 'CD2', 'CG'];
      const benzene = resAtoms.filter(a => benzeneNames.includes(a.name.trim()));
      const pyrrole = resAtoms.filter(a => pyrroleNames.includes(a.name.trim()));
      if (benzene.length === 6) rings.push(createRing(benzene));
      if (pyrrole.length === 5) rings.push(createRing(pyrrole));
    }
  });

  // 2. For ligands or arbitrary small molecules, detect rings using the bond graph (DFS)
  const adj: number[][] = Array.from({ length: atoms.length }, () => []);
  atoms.forEach((a, i) => {
    a.bonds.forEach(j => {
      if (j >= 0 && j < atoms.length) {
        adj[i].push(j);
      }
    });
  });

  const visited = new Set<number>();
  const path: number[] = [];
  const detectedSerials = new Set<string>();

  function dfs(curr: number, start: number, depth: number) {
    if (depth > 6) return;
    visited.add(curr);
    path.push(curr);

    for (const neighbor of adj[curr]) {
      if (neighbor === start && depth >= 5) {
        const ringAtoms = path.map(idx => atoms[idx]);
        const serials = ringAtoms.map(a => a.serial).sort().join(',');
        if (!detectedSerials.has(serials)) {
          detectedSerials.add(serials);
          if (ringAtoms.every(a => ['C', 'N', 'O', 'S'].includes(a.elem))) {
            rings.push(createRing(ringAtoms));
          }
        }
      } else if (!visited.has(neighbor)) {
        dfs(neighbor, start, depth + 1);
      }
    }

    path.pop();
    visited.delete(curr);
  }

  // We only run cycle search on hetero atoms to save performance
  atoms.forEach((a, i) => {
    if (a.isHetero && ['C', 'N', 'O', 'S'].includes(a.elem)) {
      dfs(i, i, 1);
    }
  });

  return rings;
}

function createRing(ringAtoms: Atom[]): Ring {
  let cx = 0, cy = 0, cz = 0;
  ringAtoms.forEach(a => { cx += a.x; cy += a.y; cz += a.z; });
  const centroid = { x: cx / ringAtoms.length, y: cy / ringAtoms.length, z: cz / ringAtoms.length };

  const r1 = ringAtoms[0];
  const r2 = ringAtoms[1];
  const r3 = ringAtoms[2];
  const v1 = { x: r2.x - r1.x, y: r2.y - r1.y, z: r2.z - r1.z };
  const v2 = { x: r3.x - r1.x, y: r3.y - r1.y, z: r3.z - r1.z };
  const n = cross(v1, v2);
  const len = norm(n);
  const normal = len > 0 ? { x: n.x / len, y: n.y / len, z: n.z / len } : { x: 0, y: 0, z: 1 };

  return { centroid, normal, atoms: ringAtoms };
}

export function calculateInteractions(receptorPDB: string, ligandPDB: string): Interaction[] {
  const recProc = new MolProcessor(receptorPDB, 'pdb');
  const ligProc = new MolProcessor(ligandPDB, 'pdb');

  // Build connectivity
  recProc.assignBonds(1.1);
  ligProc.assignBonds(1.1);

  // Model hydrogens to do the geometric H-bond angle check
  if (!recProc.atoms.some(a => a.elem === 'H')) recProc.addHydrogens();
  if (!ligProc.atoms.some(a => a.elem === 'H')) ligProc.addHydrogens();

  // Re-assign bonds to link modeled hydrogens to their heavy atom parents
  recProc.assignBonds(1.1);
  ligProc.assignBonds(1.1);

  const interactions: Interaction[] = [];

  const recAtoms = recProc.atoms.filter(a => a.elem !== 'H');
  const ligAtoms = ligProc.atoms.filter(a => a.elem !== 'H');

  // 1. Detect Aromatic Rings
  const recRings = findRings(recProc.atoms);
  const ligRings = findRings(ligProc.atoms);

  // 2. Identify Salt Bridge Residues
  const basicResidues = ['LYS', 'ARG', 'HIS'];
  const acidicResidues = ['ASP', 'GLU'];
  const basicAtoms = ['NZ', 'NE', 'NH1', 'NH2', 'ND1', 'NE2'];
  const acidicAtoms = ['OD1', 'OD2', 'OE1', 'OE2'];

  function isAnionicAtom(atom: Atom): boolean {
    const resn = (atom.resName || '').toUpperCase();
    const name = atom.name.trim().toUpperCase();
    const elem = (atom.elem || '').toUpperCase();
    if (atom.formalCharge && atom.formalCharge < 0) return true;
    if (elem === 'O') {
      if (acidicResidues.includes(resn) && acidicAtoms.includes(name)) return true;
      if (['O', 'O1', 'O2', 'O3', 'O4', 'OP1', 'OP2', 'OP3'].includes(name)) return true;
      if (!['ALA', 'CYS', 'ASP', 'GLU', 'PHE', 'GLY', 'HIS', 'ILE', 'LYS', 'LEU', 'MET', 'ASN', 'PRO', 'GLN', 'ARG', 'SER', 'THR', 'VAL', 'TRP', 'TYR', 'HOH', 'WAT'].includes(resn)) {
        return true;
      }
    }
    return false;
  }

  function isCationicAtom(atom: Atom): boolean {
    const resn = (atom.resName || '').toUpperCase();
    const name = atom.name.trim().toUpperCase();
    const elem = (atom.elem || '').toUpperCase();
    if (atom.formalCharge && atom.formalCharge > 0) return true;
    if (elem === 'N') {
      if (basicResidues.includes(resn) && basicAtoms.includes(name)) return true;
      if (!['ALA', 'CYS', 'ASP', 'GLU', 'PHE', 'GLY', 'HIS', 'ILE', 'LYS', 'LEU', 'MET', 'ASN', 'PRO', 'GLN', 'ARG', 'SER', 'THR', 'VAL', 'TRP', 'TYR', 'HOH', 'WAT'].includes(resn)) {
        return true;
      }
    }
    return false;
  }

  // Heavy atom checks
  for (const latom of ligAtoms) {
    for (const ratom of recAtoms) {
      const d = dist(latom, ratom);
      if (d > 6.0) continue;

      const isLpolar = ['N', 'O', 'S'].includes(latom.elem);
      const isRpolar = ['N', 'O', 'S'].includes(ratom.elem);
      const isLnonpolar = ['C', 'F', 'CL', 'BR', 'I'].includes(latom.elem);
      const isRnonpolar = ['C', 'F', 'CL', 'BR', 'I'].includes(ratom.elem);

      // --- 2.1 HYDROGEN BONDS WITH ANGLE CRITERION ---
      if (d >= 2.5 && d <= 3.5 && isLpolar && isRpolar) {
        // Look for hydrogens bonded to either donor atom
        // case A: ratom is donor, latom is acceptor
        const rHydrogens = ratom.bonds
          .map(idx => recProc.atoms[idx])
          .filter(h => h && h.elem === 'H');
        
        let hbondFound = false;
        for (const h of rHydrogens) {
          const ang = angleBetween(h, ratom, latom);
          if (ang >= 120.0) {
            interactions.push({
              type: 'hbond',
              atom1: ratom,
              atom2: latom,
              distance: d
            });
            hbondFound = true;
            break;
          }
        }

        if (hbondFound) continue;

        // case B: latom is donor, ratom is acceptor
        const lHydrogens = latom.bonds
          .map(idx => ligProc.atoms[idx])
          .filter(h => h && h.elem === 'H');

        for (const h of lHydrogens) {
          const ang = angleBetween(h, latom, ratom);
          if (ang >= 120.0) {
            interactions.push({
              type: 'hbond',
              atom1: ratom,
              atom2: latom,
              distance: d
            });
            break;
          }
        }
      }

      // --- 2.2 SALT BRIDGES ---
      else if (d <= 4.0) {
        const isRBasic = isCationicAtom(ratom);
        const isLAcidic = isAnionicAtom(latom);
        const isRAcidic = isAnionicAtom(ratom);
        const isLBasic = isCationicAtom(latom);

        if ((isRBasic && isLAcidic) || (isRAcidic && isLBasic)) {
          interactions.push({
            type: 'saltbridge',
            atom1: ratom,
            atom2: latom,
            distance: d
          });
        }
      }

      // --- 2.3 HYDROPHOBIC INTERACTIONS ---
      if (d >= 3.5 && d <= 4.0 && isLnonpolar && isRnonpolar) {
        interactions.push({
          type: 'hydrophobic',
          atom1: ratom,
          atom2: latom,
          distance: d
        });
      }

      // --- 2.4 HALOGEN BONDS ---
      const halogens = ['F', 'CL', 'BR', 'I'];
      const isLHalogen = halogens.includes(latom.elem);
      const isRHalogen = halogens.includes(ratom.elem);

      if (d <= 3.5) {
        if (isLHalogen && isRpolar) {
          const bondedCarbons = latom.bonds
            .map(idx => ligProc.atoms[idx])
            .filter(c => c && c.elem === 'C');
          for (const c of bondedCarbons) {
            const ang = angleBetween(latom, c, ratom);
            if (ang >= 140.0) {
              interactions.push({
                type: 'halogen',
                atom1: ratom,
                atom2: latom,
                distance: d
              });
              break;
            }
          }
        } else if (isRHalogen && isLpolar) {
          const bondedCarbons = ratom.bonds
            .map(idx => recProc.atoms[idx])
            .filter(c => c && c.elem === 'C');
          for (const c of bondedCarbons) {
            const ang = angleBetween(ratom, c, latom);
            if (ang >= 140.0) {
              interactions.push({
                type: 'halogen',
                atom1: ratom,
                atom2: latom,
                distance: d
              });
              break;
            }
          }
        }
      }
    }
  }

  // --- 3. PI-PI STACKING ---
  for (const lring of ligRings) {
    for (const rring of recRings) {
      const d = dist(lring.centroid, rring.centroid);
      if (d >= 3.3 && d <= 5.5) {
        const dotProd = dot(lring.normal, rring.normal);
        const cosAngle = Math.max(-1, Math.min(1, Math.abs(dotProd)));
        const theta = Math.acos(cosAngle) * 180 / Math.PI;

        if (theta <= 30.0 || theta >= 60.0) {
          interactions.push({
            type: 'pistacking',
            atom1: rring.atoms[0],
            atom2: lring.atoms[0],
            distance: d
          });
        }
      }
    }
  }

  // --- 4. CATION-PI ---
  const metalElements = ['MG', 'ZN', 'FE', 'CA', 'NA', 'K'];
  
  for (const rring of recRings) {
    for (const latom of ligAtoms) {
      const isCation = metalElements.includes(latom.elem) || 
                       (basicResidues.includes(latom.resName.toUpperCase()) && basicAtoms.includes(latom.name.trim()));
      if (!isCation) continue;

      const d = dist(rring.centroid, latom);
      if (d <= 6.0) {
        const vCentroidCation = sub(latom, rring.centroid);
        const dProd = dot(vCentroidCation, rring.normal);
        const normProduct = norm(vCentroidCation) * norm(rring.normal);
        if (normProduct > 0) {
          const cos = Math.abs(dProd) / normProduct;
          const clampedCos = Math.max(-1, Math.min(1, cos));
          const angle = Math.acos(clampedCos) * 180 / Math.PI;
          if (angle <= 45.0) {
            interactions.push({
              type: 'cationpi',
              atom1: rring.atoms[0],
              atom2: latom,
              distance: d
            });
          }
        }
      }
    }
  }

  for (const lring of ligRings) {
    for (const ratom of recAtoms) {
      const isCation = metalElements.includes(ratom.elem) || 
                       (basicResidues.includes(ratom.resName.toUpperCase()) && basicAtoms.includes(ratom.name.trim()));
      if (!isCation) continue;

      const d = dist(lring.centroid, ratom);
      if (d <= 6.0) {
        const vCentroidCation = sub(ratom, lring.centroid);
        const dProd = dot(vCentroidCation, lring.normal);
        const normProduct = norm(vCentroidCation) * norm(lring.normal);
        if (normProduct > 0) {
          const cos = Math.abs(dProd) / normProduct;
          const clampedCos = Math.max(-1, Math.min(1, cos));
          const angle = Math.acos(clampedCos) * 180 / Math.PI;
          if (angle <= 45.0) {
            interactions.push({
              type: 'cationpi',
              atom1: ratom,
              atom2: lring.atoms[0],
              distance: d
            });
          }
        }
      }
    }
  }

  return interactions;
}
