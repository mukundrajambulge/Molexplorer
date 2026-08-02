import fs from 'fs';

function parsePDB(pdbString: string) {
  const atoms = [];
  const conects = [];
  const lines = pdbString.split('\n');
  for (const line of lines) {
    if (line.startsWith('ATOM  ') || line.startsWith('HETATM')) {
      const x = parseFloat(line.substring(30, 38));
      const y = parseFloat(line.substring(38, 46));
      const z = parseFloat(line.substring(46, 54));
      const elem = line.substring(76, 78).trim() || line.substring(12, 16).trim()[0];
      atoms.push({
        line,
        serial: parseInt(line.substring(6, 11)),
        altLoc: line.substring(16, 17),
        resName: line.substring(17, 20).trim(),
        x, y, z, elem
      });
    } else if (line.startsWith('CONECT')) {
      conects.push(line);
    }
  }
  return { atoms, conects, original: pdbString };
}
console.log(parsePDB("ATOM      1  N   ALA A   1      -0.525   1.362   0.000  1.00  0.00           N\nATOM      2  CA  ALA A   1       0.000   0.000   0.000  1.00  0.00           C").atoms);
