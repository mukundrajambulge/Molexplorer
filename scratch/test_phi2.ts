import { dihedral } from '../src/lib/MolProcessor.ts';

// p1 = (0, 1, 0)
// p2 = (0, 0, 0)
// p3 = (1, 0, 0)
// p4 = (1, 0, 1)
const p1 = { x: 0, y: 1, z: 0 };
const p2 = { x: 0, y: 0, z: 0 };
const p3 = { x: 1, y: 0, z: 0 };
const p4 = { x: 1, y: 0, z: 1 };

const d = dihedral(p1, p2, p3, p4);
console.log('Calculated dihedral (expected +90 for IUPAC):', d);
