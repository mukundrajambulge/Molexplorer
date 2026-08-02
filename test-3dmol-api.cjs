const fs = require('fs');
// Very basic DOM shim
global.window = {};
global.document = { createElement: () => ({ style: {}, getContext: () => ({}) }) };
global.navigator = { userAgent: 'node' };

let file = fs.readFileSync('node_modules/3dmol/build/3Dmol-min.js', 'utf8');
eval(file);

const pdb = `REMARK 350 BIOMOLECULE: 1
REMARK 350 APPLY THE FOLLOWING TO CHAINS: A
REMARK 350   BIOMT1   1  1.000000  0.000000  0.000000        0.00000
REMARK 350   BIOMT2   1  0.000000  1.000000  0.000000        0.00000
REMARK 350   BIOMT3   1  0.000000  0.000000  1.000000        0.00000
REMARK 350   BIOMT1   2 -1.000000  0.000000  0.000000       10.00000
REMARK 350   BIOMT2   2  0.000000 -1.000000  0.000000       20.00000
REMARK 350   BIOMT3   2  0.000000  0.000000  1.000000       30.00000
CRYST1   50.000   50.000   50.000  90.00  90.00  90.00 P 21 21 21    8
ATOM      1  N   ALA A   1      10.000  10.000  10.000  1.00 10.00           N  
`;

const viewer = $3Dmol.createViewer(global.document.createElement('div'));
viewer.addModel(pdb, "pdb");
const m = viewer.getModel(0);
console.log(Object.keys(m));
console.log("biomt:", m.biomt);
console.log("symmetries:", m.symmetries);
console.log("cryst1:", m.cryst);
