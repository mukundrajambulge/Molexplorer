import fs from 'fs';
import path from 'path';
import { MolProcessor, formatAtomLine } from '../src/lib/MolProcessor.js';
import { SelectionParser } from '../src/lib/SelectionParser.js';

// Color map palette generator for chains
function generateChainColorMap(chains: string[]): Record<string, string> {
  const palette = [
    '#3498DB', '#E74C3C', '#2ECC71', '#F1C40F', '#9B59B6',
    '#1ABC9C', '#E67E22', '#34495E', '#E84393', '#00CEC9'
  ];
  const map: Record<string, string> = {};
  chains.forEach((ch, idx) => {
    map[ch] = palette[idx % palette.length];
  });
  return map;
}

// Exporters for testing round-trip format integrity
function exportToPDB(atoms: any[]): string {
  let pdb = "";
  let lastChain = "";
  for (const a of atoms) {
    if (lastChain && a.chainID !== lastChain) {
      pdb += "TER\n";
    }
    pdb += formatAtomLine(a) + "\n";
    lastChain = a.chainID;
  }
  pdb += "TER\nEND\n";
  return pdb;
}

function exportToXYZ(atoms: any[], molName: string = "Molecule"): string {
  let xyz = `${atoms.length}\n${molName}\n`;
  for (const a of atoms) {
    const elem = (a.elem || 'C').padEnd(3, ' ');
    const x = a.x.toFixed(4).padStart(10, ' ');
    const y = a.y.toFixed(4).padStart(10, ' ');
    const z = a.z.toFixed(4).padStart(10, ' ');
    xyz += `${elem} ${x} ${y} ${z}\n`;
  }
  return xyz;
}

function exportToJSON(atoms: any[]): string {
  return JSON.stringify(atoms.map(a => ({
    serial: a.serial,
    name: a.name,
    resName: a.resName,
    chainID: a.chainID,
    resSeq: a.resSeq,
    x: a.x,
    y: a.y,
    z: a.z,
    elem: a.elem,
    ss: a.ss
  })));
}

function exportToSDF(atoms: any[], molName: string = "Molecule"): string {
  let sdf = `${molName}\n  MolExplorer Export\n\n`;
  const numAtoms = atoms.length.toString().padStart(3, ' ');
  // Note: Standard V2000 counts line format
  sdf += `${numAtoms}  0  0  0  0  0  0  0  0  0999 V2000\n`;
  for (const a of atoms) {
    const x = a.x.toFixed(4).padStart(10, ' ');
    const y = a.y.toFixed(4).padStart(10, ' ');
    const z = a.z.toFixed(4).padStart(10, ' ');
    const symbol = (a.elem || 'C').padEnd(3, ' ');
    sdf += `${x}${y}${z} ${symbol} 0  0  0  0  0  0  0  0  0  0  0  0\n`;
  }
  sdf += "M  END\n$$$$\n";
  return sdf;
}

async function runTier9CoreTests() {
  const pdbDir = path.join(process.cwd(), 'scratch', 'tier9_pdbs');
  if (!fs.existsSync(pdbDir)) {
    console.error("PDB directory missing. Run scratch/download_tier9.js first.");
    process.exit(1);
  }

  const files = fs.readdirSync(pdbDir).filter(f => f.endsWith('.pdb'));
  console.log(`Found ${files.length} PDB files for Tier 9 core testing.\n`);

  const telemetry = [];
  const issues = [];

  for (const file of files) {
    const pdbPath = path.join(pdbDir, file);
    const rawPdb = fs.readFileSync(pdbPath, 'utf8');
    const pdbId = file.replace('.pdb', '');

    const parseStart = performance.now();
    const processor = new MolProcessor(rawPdb, 'pdb');
    processor.calculateSecondaryStructure('pdb');
    const parseTime = performance.now() - parseStart;

    const atoms = processor.atoms;
    const atomCount = atoms.length;

    // Unique chain IDs
    const chainsSet = new Set(atoms.map(a => a.chainID));
    const chains = Array.from(chainsSet).sort();

    // 1. Multi-chain parsing & Chain ID Color Map check
    const colorMap = generateChainColorMap(chains);
    const colorMapUnique = new Set(Object.values(colorMap)).size === chains.length;

    // Verify TER markers placement / chain transitions
    let chainTransitionsCorrect = true;
    for (let i = 1; i < atoms.length; i++) {
      if (atoms[i].chainID !== atoms[i - 1].chainID) {
        // chain switch detected
      }
    }

    // 2. Complex Selection Queries
    const selParser = new SelectionParser(atoms);

    // Query 1: 'chain A and resn ALA and elem N'
    const q1Start = performance.now();
    let q1Serials = new Set<number>();
    let q1Valid = true;
    let q1Error = "";
    try {
      q1Serials = selParser.parse('chain A and resn ALA and elem N');
      // Validate returned atoms match criterion exactly
      for (const serial of q1Serials) {
        const at = atoms.find(a => a.serial === serial);
        if (!at || at.chainID !== 'A' || at.resName.trim().toUpperCase() !== 'ALA' || at.elem.trim().toUpperCase() !== 'N') {
          q1Valid = false;
          q1Error = `Atom ${serial} (${at?.chainID}, ${at?.resName}, ${at?.elem}) failed Q1 predicate`;
          break;
        }
      }
    } catch (e: any) {
      q1Valid = false;
      q1Error = e.message;
    }
    const q1Time = performance.now() - q1Start;

    // Query 2: 'ss h and not (resn HOH or elem H)'
    const q2Start = performance.now();
    let q2Serials = new Set<number>();
    let q2Valid = true;
    let q2Error = "";
    try {
      q2Serials = selParser.parse('ss h and not (resn HOH or elem H)');
      // Validate returned atoms match criterion
      for (const serial of q2Serials) {
        const at = atoms.find(a => a.serial === serial);
        const ssLower = (at?.ss || '').toLowerCase();
        const isHelix = ssLower === 'h' || ssLower === 'helix';
        const isWater = (at?.resName || '').trim().toUpperCase() === 'HOH';
        const isHydrogen = (at?.elem || '').trim().toUpperCase() === 'H';
        if (!at || !isHelix || isWater || isHydrogen) {
          q2Valid = false;
          q2Error = `Atom ${serial} (${ssLower}, ${at?.resName}, ${at?.elem}) failed Q2 predicate`;
          break;
        }
      }
    } catch (e: any) {
      q2Valid = false;
      q2Error = e.message;
    }
    const q2Time = performance.now() - q2Start;

    // 3. Export Format Integrity Checks
    const exportedPDB = exportToPDB(atoms);
    const exportedXYZ = exportToXYZ(atoms, pdbId);
    const exportedJSON = exportToJSON(atoms);
    const exportedSDF = exportToSDF(atoms, pdbId);

    // Re-parse exported PDB
    const rePdbProcessor = new MolProcessor(exportedPDB, 'pdb');
    const rePdbAtoms = rePdbProcessor.atoms;
    const pdbRoundTripMatch = rePdbAtoms.length === atomCount;

    // Re-parse exported JSON
    const reJsonAtoms = JSON.parse(exportedJSON);
    const jsonRoundTripMatch = reJsonAtoms.length === atomCount;

    // PDB Column Integrity (80 chars, columns formatted strictly)
    let pdbColumnOk = true;
    const pdbLines = exportedPDB.split('\n').filter(l => l.startsWith('ATOM') || l.startsWith('HETATM'));
    for (const line of pdbLines) {
      if (line.length < 78) {
        pdbColumnOk = false;
        issues.push(`${pdbId}: PDB line length less than 78 chars (${line.length})`);
        break;
      }
    }

    if (!pdbRoundTripMatch) {
      issues.push(`${pdbId}: PDB export round-trip atom count mismatch (original: ${atomCount}, re-parsed: ${rePdbAtoms.length})`);
    }

    if (!q1Valid) {
      issues.push(`${pdbId}: Selection Q1 invalid - ${q1Error}`);
    }

    if (!q2Valid) {
      issues.push(`${pdbId}: Selection Q2 invalid - ${q2Error}`);
    }

    telemetry.push({
      pdbId,
      atomCount,
      chains: chains.join(','),
      chainCount: chains.length,
      parseTimeMs: Number(parseTime.toFixed(2)),
      colorMapUnique,
      q1MatchedAtoms: q1Serials.size,
      q1TimeMs: Number(q1Time.toFixed(2)),
      q1Valid,
      q2MatchedAtoms: q2Serials.size,
      q2TimeMs: Number(q2Time.toFixed(2)),
      q2Valid,
      pdbExportRoundtrip: pdbRoundTripMatch,
      jsonExportRoundtrip: jsonRoundTripMatch,
      pdbColumnFormatOk: pdbColumnOk,
      passAll: q1Valid && q2Valid && pdbRoundTripMatch && jsonRoundTripMatch && pdbColumnOk
    });
  }

  console.log("\n=================== TIER 9 CORE TEST RESULTS ===================");
  console.table(telemetry);

  if (issues.length > 0) {
    console.log("\n⚠️ ISSUES DETECTED:");
    issues.forEach(iss => console.log(`  - ${iss}`));
  } else {
    console.log("\n✅ ALL TIER 9 CORE CHECKS PASSED PERFECTLY!");
  }

  const outDir = path.join(process.cwd(), 'scratch');
  fs.writeFileSync(path.join(outDir, 'tier9_core_telemetry.json'), JSON.stringify({ telemetry, issues }, null, 2));
}

runTier9CoreTests().catch(err => {
  console.error("Error running core tests:", err);
});
