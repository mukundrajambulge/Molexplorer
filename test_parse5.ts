import fs from 'fs';
const text = fs.readFileSync("1HVR.pdb", "utf-8");
const lines = text.split('\n');

let currentAssembly: any = null;
let currentChains: string[] = [];
let currentMatrices: any[] = [];
let currentMatrix: any = { r: [[1,0,0],[0,1,0],[0,0,1]], t: [0,0,0] };
let assemblies: any[] = [];

for (let line of lines) {
  line = line.trimEnd();
  if (line.startsWith("REMARK 350 BIOMOLECULE:")) {
    if (currentAssembly && currentMatrices.length > 0) {
      currentAssembly.operations.push({ chains: [...currentChains], matrices: [...currentMatrices] });
      currentMatrices = [];
    }
    const id = line.substring(23).trim();
    currentAssembly = { id, operations: [] };
    assemblies.push(currentAssembly);
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
    const match = line.match(/BIOMT([123])\s+\d+\s+([-.\d]+)\s+([-.\d]+)\s+([-.\d]+)\s+([-.\d]+)/);
    if (match) {
      const row = parseInt(match[1]) - 1;
      currentMatrix.r[row] = [parseFloat(match[2]), parseFloat(match[3]), parseFloat(match[4])];
      currentMatrix.t[row] = parseFloat(match[5]);
      if (row === 2) {
        currentMatrices.push(JSON.parse(JSON.stringify(currentMatrix)));
        currentMatrix = { r: [[1,0,0],[0,1,0],[0,0,1]], t: [0,0,0] };
      }
    }
  }
}
if (currentAssembly && currentMatrices.length > 0) {
  currentAssembly.operations.push({ chains: [...currentChains], matrices: [...currentMatrices] });
}
console.log(JSON.stringify(assemblies, null, 2));
