const fs = require('fs');
let content = fs.readFileSync('src/pages/MolExplorer.tsx', 'utf8');
const target = `const mol = rdkit.get_mol(m.rawContent || m.smiles);`;
const replacement = `const mol = (typeof m.rawContent === "string" && m.format !== "mmtf") ? rdkit.get_mol(m.rawContent || m.smiles) : null;`;
fs.writeFileSync('src/pages/MolExplorer.tsx', content.replace(target, replacement));
