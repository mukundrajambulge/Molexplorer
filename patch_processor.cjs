const fs = require('fs');

let content = fs.readFileSync('src/lib/MolProcessor.ts', 'utf8');

const interfacesToAdd = `
export interface Transformation {
  r: number[][];
  t: number[];
}

export interface BiologicalAssembly {
  id: string;
  operations: {
    chains: string[];
    matrices: Transformation[];
  }[];
}
`;

content = content.replace('export interface Atom {', interfacesToAdd + '\nexport interface Atom {');

const parseToAdd = `
  assemblies: BiologicalAssembly[] = [];
  symmetry_matrices: Transformation[] = [];

  constructor(pdbText: string) {
    this.parse(pdbText);
    this.parseMatrices(pdbText);
  }

  parseMatrices(pdbText: string) {
    const lines = pdbText.split('\\n');
    
    let currentAssembly = null;
    let currentChains = [];
    let currentMatrices = [];
    let currentMatrix = { r: [[1,0,0],[0,1,0],[0,0,1]], t: [0,0,0] };
    let currentSmtryMatrix = { r: [[1,0,0],[0,1,0],[0,0,1]], t: [0,0,0] };

    for (let line of lines) {
      line = line.trimEnd();
      if (line.startsWith("REMARK 350 BIOMOLECULE:")) {
        if (currentAssembly && currentMatrices.length > 0) {
          currentAssembly.operations.push({ chains: [...currentChains], matrices: [...currentMatrices] });
          currentMatrices = [];
        }
        const id = line.substring(23).trim();
        currentAssembly = { id, operations: [] };
        this.assemblies.push(currentAssembly);
      }
      else if (line.startsWith("REMARK 350 APPLY THE FOLLOWING TO CHAINS:")) {
        if (currentAssembly && currentMatrices.length > 0) {
          currentAssembly.operations.push({ chains: [...currentChains], matrices: [...currentMatrices] });
          currentMatrices = [];
        }
        const chainsPart = line.substring(41).trim();
        currentChains = chainsPart.split(/[, ]+/).filter(s => s && s !== 'AND');
      }
      else if (line.startsWith("REMARK 350   BIOMT")) {
        const row = parseInt(line.substring(19, 20)) - 1;
        const parts = line.substring(24).trim().split(/\\s+/).map(parseFloat);
        if (parts.length >= 4) {
          currentMatrix.r[row] = [parts[0], parts[1], parts[2]];
          currentMatrix.t[row] = parts[3];
        }
        if (row === 2) {
          currentMatrices.push(JSON.parse(JSON.stringify(currentMatrix)));
          currentMatrix = { r: [[1,0,0],[0,1,0],[0,0,1]], t: [0,0,0] };
        }
      }
      else if (line.startsWith("REMARK 290   SMTRY")) {
        const row = parseInt(line.substring(19, 20)) - 1;
        const parts = line.substring(24).trim().split(/\\s+/).map(parseFloat);
        if (parts.length >= 4) {
          currentSmtryMatrix.r[row] = [parts[0], parts[1], parts[2]];
          currentSmtryMatrix.t[row] = parts[3];
        }
        if (row === 2) {
          this.symmetry_matrices.push(JSON.parse(JSON.stringify(currentSmtryMatrix)));
          currentSmtryMatrix = { r: [[1,0,0],[0,1,0],[0,0,1]], t: [0,0,0] };
        }
      }
    }
    
    if (currentAssembly && currentMatrices.length > 0) {
      currentAssembly.operations.push({ chains: [...currentChains], matrices: [...currentMatrices] });
    }
  }

  formatAtomLine(a: Atom): string {
    const record = a.isHetero ? "HETATM" : "ATOM  ";
    const serial = a.serial.toString().padStart(5, ' ');
    const name = a.name.padEnd(4, ' ').substring(0, 4);
    const altLoc = a.altLoc;
    const resName = a.resName.padStart(3, ' ').substring(0, 3);
    const chain = a.chainID;
    const resSeq = a.resSeq.toString().padStart(4, ' ');
    const x = a.x.toFixed(3).padStart(8, ' ');
    const y = a.y.toFixed(3).padStart(8, ' ');
    const z = a.z.toFixed(3).padStart(8, ' ');
    const elem = a.elem.padStart(2, ' ').substring(0, 2);
    const bFactor = a.isModeledH ? " 99.90" : "  0.00";
    return \`\${record}\${serial} \${name}\${altLoc}\${resName} \${chain}\${resSeq}    \${x}\${y}\${z}  1.00\${bFactor}          \${elem}\`;
  }

  generateAssemblyPDB(assemblyId: string): { pdb: string, generated_chains: string[] } {
      const assembly = this.assemblies.find(a => a.id === assemblyId);
      if (!assembly) return { pdb: "", generated_chains: [] };

      let outPdb = "";
      const generatedChains = new Set();

      for (const op of assembly.operations) {
          for (const mat of op.matrices) {
              const isIdentity = Math.abs(mat.r[0][0]-1)<1e-4 && Math.abs(mat.r[1][1]-1)<1e-4 && Math.abs(mat.r[2][2]-1)<1e-4 && Math.abs(mat.t[0])<1e-4 && Math.abs(mat.t[1])<1e-4 && Math.abs(mat.t[2])<1e-4;
              if (isIdentity) continue;

              for (const atom of this.atoms) {
                  if (op.chains.includes(atom.chainID)) {
                      const x = mat.r[0][0]*atom.x + mat.r[0][1]*atom.y + mat.r[0][2]*atom.z + mat.t[0];
                      const y = mat.r[1][0]*atom.x + mat.r[1][1]*atom.y + mat.r[1][2]*atom.z + mat.t[1];
                      const z = mat.r[2][0]*atom.x + mat.r[2][1]*atom.y + mat.r[2][2]*atom.z + mat.t[2];
                      outPdb += this.formatAtomLine({...atom, x, y, z}) + "\\n";
                      generatedChains.add(atom.chainID);
                  }
              }
              outPdb += "TER\\n";
          }
      }
      return { pdb: outPdb, generated_chains: Array.from(generatedChains) };
  }

  generateSymmetryPDB(): { pdb: string, count: number } {
      if (this.symmetry_matrices.length === 0) return { pdb: "", count: 0 };
      
      let outPdb = "";
      let count = 0;
      
      for (const mat of this.symmetry_matrices) {
          const isIdentity = Math.abs(mat.r[0][0]-1)<1e-4 && Math.abs(mat.r[1][1]-1)<1e-4 && Math.abs(mat.r[2][2]-1)<1e-4 && Math.abs(mat.t[0])<1e-4 && Math.abs(mat.t[1])<1e-4 && Math.abs(mat.t[2])<1e-4;
          if (isIdentity) continue;
          
          count++;
          for (const atom of this.atoms) {
              const x = mat.r[0][0]*atom.x + mat.r[0][1]*atom.y + mat.r[0][2]*atom.z + mat.t[0];
              const y = mat.r[1][0]*atom.x + mat.r[1][1]*atom.y + mat.r[1][2]*atom.z + mat.t[1];
              const z = mat.r[2][0]*atom.x + mat.r[2][1]*atom.y + mat.r[2][2]*atom.z + mat.t[2];
              outPdb += this.formatAtomLine({...atom, x, y, z}) + "\\n";
          }
          outPdb += "TER\\n";
      }
      return { pdb: outPdb, count };
  }
`;

content = content.replace('constructor(pdbText: string) {', parseToAdd + '\n  constructor_old(pdbText: string) {');
content = content.replace('    this.parse(pdbText);', '    // parse now in new constructor');
// fix `toPDB` to use `this.formatAtomLine` ? We can just leave `toPDB` alone, it's fine.

fs.writeFileSync('src/lib/MolProcessor.ts', content);
