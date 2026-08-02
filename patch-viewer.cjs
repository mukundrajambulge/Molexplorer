const fs = require('fs');
let content = fs.readFileSync('src/components/Viewer3D.tsx', 'utf8');

const target = `         let mol1Content = molecule.rawContent;
         let mol2Content = compareMolecule?.rawContent;

         // Attempt alignment if compareMolecule exists
         if (compareMolecule && compareMolecule.rawContent) {
            try {
               const rdkit = await getRDKit();
               const m1 = rdkit.get_mol(mol1Content);
               const m2 = rdkit.get_mol(mol2Content);`;

const replacement = `         let mol1Content = molecule.rawContent;
         let mol2Content = compareMolecule?.rawContent;

         // Attempt alignment if compareMolecule exists
         if (compareMolecule && compareMolecule.rawContent && format !== 'mmtf' && compareMolecule.format.toLowerCase() !== 'mmtf') {
            try {
               const rdkit = await getRDKit();
               const m1 = rdkit.get_mol(mol1Content as string);
               const m2 = rdkit.get_mol(mol2Content as string);`;

fs.writeFileSync('src/components/Viewer3D.tsx', content.replace(target, replacement));
