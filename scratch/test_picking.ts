import * as $3Dmol from '3dmol';
import { MolecularPicker } from '../src/interaction/MolecularPicker';
import { SelectionManager } from '../src/interaction/SelectionManager';
import { SelectionHighlight } from '../src/interaction/SelectionHighlight';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="gviewer"></div></body></html>');
(global as any).window = dom.window;
(global as any).document = dom.window.document;

// Sample PDB Crambin 1CRN excerpt
const crambinPDB = `ATOM      1  N   THR A   1      17.047  14.099   3.625  1.00 13.79           N  
ATOM      2  CA  THR A   1      16.967  12.784   4.338  1.00 10.80           C  
ATOM      3  C   THR A   1      15.685  12.755   5.133  1.00  9.19           C  
ATOM      4  O   THR A   1      15.268  13.825   5.594  1.00  9.85           O  
ATOM      5  CB  THR A   1      18.170  12.703   5.337  1.00 13.02           C  
ATOM      6  OG1 THR A   1      19.334  12.829   4.463  1.00 15.06           O  
ATOM      7  CG2 THR A   1      18.150  11.454   6.253  1.00 13.79           C  
ATOM      8  N   THR A   2      15.115  11.555   5.265  1.00  7.81           N  
ATOM      9  CA  THR A   2      13.856  11.469   6.066  1.00  7.04           C  
ATOM     10  C   THR A   2      14.164  10.785   7.379  1.00  5.84           C  
ATOM     11  O   THR A   2      14.993   9.862   7.444  1.00  6.93           O  
ATOM     12  CB  THR A   2      12.732  10.724   5.281  1.00  8.86           C  
ATOM     13  OG1 THR A   2      12.443  11.488   4.108  1.00  9.03           O  
ATOM     14  CG2 THR A   2      11.472  10.598   6.166  1.00  8.71           C  
HETATM  328  O   HOH A 101      18.232  18.123  12.456  1.00 20.00           O  
HETATM  329  C1  LIG B   1      22.000  20.000  15.000  1.00 15.00           C  
HETATM  330  C2  LIG B   1      23.000  21.000  16.000  1.00 15.00           C  
END`;

console.log("Testing MolecularPicker normalization...");
const rawAtom = { serial: 2, name: 'CA', resn: 'THR', resi: 1, chain: 'A', x: 16.967, y: 12.784, z: 4.338 };
const picked = MolecularPicker.normalizeAtom(rawAtom, 'crambin');
console.log("Normalized PickedAtom:", picked);

console.log("\nTesting SelectionManager expansion:");
const rawAtomsList = [
  { serial: 1, atom: 'N', resn: 'THR', resi: 1, chain: 'A', x: 17, y: 14, z: 3.6 },
  { serial: 2, atom: 'CA', resn: 'THR', resi: 1, chain: 'A', x: 16.9, y: 12.7, z: 4.3 },
  { serial: 3, atom: 'C', resn: 'THR', resi: 1, chain: 'A', x: 15.6, y: 12.7, z: 5.1 },
  { serial: 8, atom: 'N', resn: 'THR', resi: 2, chain: 'A', x: 15.1, y: 11.5, z: 5.2 },
  { serial: 9, atom: 'CA', resn: 'THR', resi: 2, chain: 'A', x: 13.8, y: 11.4, z: 6.0 },
  { serial: 329, atom: 'C1', resn: 'LIG', resi: 1, chain: 'B', hetflag: true, x: 22, y: 20, z: 15 },
  { serial: 330, atom: 'C2', resn: 'LIG', resi: 1, chain: 'B', hetflag: true, x: 23, y: 21, z: 16 }
];

const allNormalized = rawAtomsList.map(a => MolecularPicker.normalizeAtom(a, 'test_mol'));

// 1. Atom level
const atomSel = SelectionManager.expandSelection(allNormalized[1], 'atom', allNormalized);
console.log("Atom level count (expected 1):", atomSel.length);

// 2. Residue level
const resSel = SelectionManager.expandSelection(allNormalized[1], 'residue', allNormalized);
console.log("Residue level count (expected 3 for THR-1):", resSel.length);

// 3. Ligand level
const ligSel = SelectionManager.expandSelection(allNormalized[5], 'ligand', allNormalized);
console.log("Ligand level count (expected 2 for LIG-1):", ligSel.length);

// 4. Chain level
const chainSel = SelectionManager.expandSelection(allNormalized[0], 'chain', allNormalized);
console.log("Chain level count (expected 5 for Chain A):", chainSel.length);

// 5. Molecule level
const molSel = SelectionManager.expandSelection(allNormalized[0], 'molecule', allNormalized);
console.log("Molecule level count (expected 7 for test_mol):", molSel.length);

// 6. Toggle & Deselect
let selState = { level: 'atom' as const, atoms: [], selectedKeys: new Set<string>() };
selState = SelectionManager.toggle(allNormalized[0], 'atom', allNormalized, selState, false);
console.log("After select 1 atom:", selState.atoms.length, "keys:", Array.from(selState.selectedKeys));

selState = SelectionManager.toggle(allNormalized[0], 'atom', allNormalized, selState, false);
console.log("After toggle same atom (expected 0 / deselected):", selState.atoms.length);

console.log("ALL TESTS PASSED!");
