import { dihedral } from './src/lib/MolProcessor.ts';

// Ideal right-handed alpha helix geometry (approximate)
// C(i-1)
const p1 = { x: -1.033, y: 1.341, z: 0.165 };
// N(i)
const p2 = { x: 0.000, y: 0.000, z: 0.000 };
// CA(i)
const p3 = { x: 1.458, y: 0.000, z: 0.000 };
// C(i)
const p4 = { x: 2.012, y: 1.398, z: 0.000 };

const phi = dihedral(p1, p2, p3, p4);
console.log('Calculated phi:', phi);
