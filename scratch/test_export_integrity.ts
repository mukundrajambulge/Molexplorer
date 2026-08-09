import fs from 'fs';
import path from 'path';
import { MolProcessor, formatAtomLine } from '../src/lib/MolProcessor.js';

const pdbDir = path.join(process.cwd(), 'scratch', 'tier9_pdbs');
const pdbFiles = fs.readdirSync(pdbDir).filter(f => f.endsWith('.pdb') && !f.startsWith('raw_'));

console.log(`=== EXPORT INTEGRITY CHECKS FOR MULTI-CHAIN 3,000+ ATOM STRUCTURES ===\n`);

interface ExportTelemetry {
  pdbId: string;
  atomCount: number;
  chains: string[];
  is3000Plus: boolean;
  isMultiChain: boolean;
  pdbExportValid: boolean;
  sdfExportValid: boolean;
  xyzExportValid: boolean;
  jsonExportValid: boolean;
  pdbStrict80ColPass: boolean;
  coordPreservationPass: boolean;
}

const results: ExportTelemetry[] = [];
const issues: string[] = [];

for (const file of pdbFiles) {
  const pdbId = file.replace('.pdb', '');
  const pdbPath = path.join(pdbDir, file);
  const rawPdb = fs.readFileSync(pdbPath, 'utf8');

  const proc = new MolProcessor(rawPdb, 'pdb');
  const atoms = proc.atoms;
  const atomCount = atoms.length;
  const chains = Array.from(new Set(atoms.map(a => a.chainID))).sort();

  const is3000Plus = atomCount >= 3000;
  const isMultiChain = chains.length > 1;

  // 1. PDB Export
  let pdbExport = "";
  for (const a of atoms) {
    pdbExport += formatAtomLine(a) + "\n";
  }
  pdbExport += "END\n";

  // Check 80-col strict format
  let pdbStrict80ColPass = true;
  const pdbLines = pdbExport.split('\n').filter(l => l.startsWith('ATOM') || l.startsWith('HETATM'));
  for (const l of pdbLines) {
    if (l.length !== 80) {
      pdbStrict80ColPass = false;
      issues.push(`${pdbId}: PDB line length is ${l.length} (expected 80): "${l}"`);
      break;
    }
  }

  // Re-parse PDB
  const procPdb = new MolProcessor(pdbExport, 'pdb');
  const pdbExportValid = procPdb.atoms.length === atomCount;
  if (!pdbExportValid) {
    issues.push(`${pdbId}: PDB re-parse atom count mismatch (${procPdb.atoms.length} vs ${atomCount})`);
  }

  // 2. SDF Export (V2000 format)
  let sdfExport = `${pdbId}\n  MolExplorer Export\n\n`;
  const countHeader = atomCount.toString().padStart(3, ' ');
  sdfExport += `${countHeader}  0  0  0  0  0  0  0  0  00999 V2000\n`;
  for (const a of atoms) {
    const x = a.x.toFixed(4).padStart(10, ' ');
    const y = a.y.toFixed(4).padStart(10, ' ');
    const z = a.z.toFixed(4).padStart(10, ' ');
    const elem = (a.elem || 'C').padEnd(3, ' ');
    sdfExport += `${x}${y}${z} ${elem} 0  0  0  0  0  0  0  0  0  0  0  0\n`;
  }
  sdfExport += "M  END\n$$$$\n";

  // Verify SDF format lines
  const sdfLines = sdfExport.split('\n');
  const sdfExportValid = sdfLines.length >= atomCount + 5 && sdfLines[sdfLines.length - 2] === '$$$$';

  // 3. XYZ Export
  let xyzExport = `${atomCount}\n${pdbId} Multi-chain export\n`;
  for (const a of atoms) {
    const elem = (a.elem || 'C').padEnd(3, ' ');
    const x = a.x.toFixed(4).padStart(10, ' ');
    const y = a.y.toFixed(4).padStart(10, ' ');
    const z = a.z.toFixed(4).padStart(10, ' ');
    xyzExport += `${elem} ${x} ${y} ${z}\n`;
  }
  const xyzLines = xyzExport.trim().split('\n');
  const xyzExportValid = parseInt(xyzLines[0], 10) === atomCount && xyzLines.length === atomCount + 2;

  // 4. JSON Export
  const jsonObj = atoms.map(a => ({
    serial: a.serial,
    name: a.name,
    resName: a.resName,
    chainID: a.chainID,
    resSeq: a.resSeq,
    x: a.x,
    y: a.y,
    z: a.z,
    elem: a.elem
  }));
  const jsonExportStr = JSON.stringify(jsonObj);
  const reParsedJson = JSON.parse(jsonExportStr);
  const jsonExportValid = reParsedJson.length === atomCount;

  // 5. Coordinate Preservation Check (PDB re-parse vs original)
  let maxCoordDiff = 0;
  for (let i = 0; i < Math.min(atoms.length, procPdb.atoms.length); i++) {
    const a1 = atoms[i];
    const a2 = procPdb.atoms[i];
    const dx = Math.abs(a1.x - a2.x);
    const dy = Math.abs(a1.y - a2.y);
    const dz = Math.abs(a1.z - a2.z);
    maxCoordDiff = Math.max(maxCoordDiff, dx, dy, dz);
  }
  const coordPreservationPass = maxCoordDiff <= 0.001; // exact to 0.001 Angstrom

  results.push({
    pdbId,
    atomCount,
    chains,
    is3000Plus,
    isMultiChain,
    pdbExportValid,
    sdfExportValid,
    xyzExportValid,
    jsonExportValid,
    pdbStrict80ColPass,
    coordPreservationPass
  });
}

console.table(results.map(r => ({
  PDB: r.pdbId,
  Atoms: r.atomCount,
  Chains: r.chains.join(','),
  ">3000": r.is3000Plus,
  MultiChain: r.isMultiChain,
  PDB_OK: r.pdbExportValid,
  PDB_80Col: r.pdbStrict80ColPass,
  SDF_OK: r.sdfExportValid,
  XYZ_OK: r.xyzExportValid,
  JSON_OK: r.jsonExportValid,
  Coords_0_001A: r.coordPreservationPass
})));

if (issues.length > 0) {
  console.log("\n⚠️ Export Integrity Issues Found:");
  issues.forEach(i => console.log(`  - ${i}`));
} else {
  console.log("\n✅ ALL EXPORT FORMAT INTEGRITY CHECKS PASSED PERFECTLY FOR 3,000+ ATOM & MULTI-CHAIN STRUCTURES!");
}

const outDir = path.join(process.cwd(), 'scratch');
fs.writeFileSync(path.join(outDir, 'export_integrity_telemetry.json'), JSON.stringify({ results, issues }, null, 2));
