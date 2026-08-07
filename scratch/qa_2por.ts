import fs from 'fs';
import path from 'path';
import { MolProcessor, Atom } from '../src/lib/MolProcessor.ts';
import { SelectionParser } from '../src/lib/SelectionParser.ts';

// Global stub for 3Dmol if needed in Node
(global as any).$3Dmol = { Parsers: { mmtf: () => [] } };

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface RamaResidue {
  resName: string;
  resSeq: number;
  chainID: string;
  phi: number;
  psi: number;
  region: 'favored' | 'allowed' | 'outlier';
}

export interface InteractionContact {
  type: 'hbond_dssp' | 'hbond_geom' | 'saltbridge' | 'hydrophobic' | 'pistacking' | 'cationpi';
  res1: string;
  res2: string;
  atom1: string;
  atom2: string;
  distance: number;
  energy?: number;
}

// Atomic mass lookup (amu)
function getAtomicMass(elem: string): number {
  const clean = elem.trim().toUpperCase();
  switch (clean) {
    case 'H': return 1.008;
    case 'C': return 12.011;
    case 'N': return 14.007;
    case 'O': return 15.999;
    case 'P': return 30.974;
    case 'S': return 32.060;
    case 'F': return 18.998;
    case 'CL': return 35.450;
    case 'BR': return 79.904;
    case 'I': return 126.904;
    case 'FE': return 55.845;
    case 'ZN': return 65.380;
    case 'MG': return 24.305;
    case 'CA': return 40.078;
    case 'NA': return 22.990;
    case 'K': return 39.098;
    default: return 12.011;
  }
}

// AMBER partial charge lookup
const AMBER_CHARGES: Record<string, number> = {
  "N": -0.47, "H": 0.31, "CA": 0.07, "C": 0.51, "O": -0.51,
  "NZ": 1.00, "NH1": 0.40, "NH2": 0.40, "NE": -0.05,
  "OD1": -0.80, "OD2": -0.80, "OE1": -0.80, "OE2": -0.80,
  "SG": -0.20, "OH": -0.40, "ND1": -0.36, "NE2": -0.36
};

function getPartialCharge(atomName: string, elem: string): number {
  const cleanName = atomName.trim().toUpperCase();
  if (AMBER_CHARGES[cleanName] !== undefined) {
    return AMBER_CHARGES[cleanName];
  }
  const cleanElem = elem.trim().toUpperCase();
  if (cleanElem === 'O' || cleanName.startsWith('O')) return -0.40;
  if (cleanElem === 'N' || cleanName.startsWith('N')) return -0.40;
  if (cleanElem === 'C' || cleanName.startsWith('C')) return 0.00;
  if (cleanElem === 'H' || cleanName.startsWith('H')) return 0.10;
  if (cleanElem === 'S') return -0.20;
  if (cleanElem === 'P') return 0.40;
  return 0.00;
}

const DEBYE_PER_E_ANGSTROM = 4.8032;

// Vector helper functions
function sub(a: Vec3, b: Vec3): Vec3 { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
function dot(a: Vec3, b: Vec3): number { return a.x * b.x + a.y * b.y + a.z * b.z; }
function norm(a: Vec3): number { return Math.sqrt(dot(a, a)); }

async function runQA2POR() {
  const startTime = performance.now();
  const logLines: string[] = [];
  
  function log(msg: string) {
    console.log(msg);
    logLines.push(msg);
  }

  log("================================================================================");
  log("                     QA AUTOMATION REPORT: PDB 2POR                             ");
  log("================================================================================");
  log(`Execution Date/Time: ${new Date().toISOString()}`);
  log(`Target PDB: 2POR (Porin from Rhodobacter capsulatus)`);
  log(`Source URL: https://files.rcsb.org/download/2POR.pdb`);
  log("");

  // ---------------------------------------------------------------------------
  // STEP 1: FETCH PDB FILE
  // ---------------------------------------------------------------------------
  log("--------------------------------------------------------------------------------");
  log("1. FETCHING PDB FILE");
  log("--------------------------------------------------------------------------------");
  const tFetchStart = performance.now();
  
  const pdbUrl = "https://files.rcsb.org/download/2POR.pdb";
  let pdbText = "";
  try {
    const res = await fetch(pdbUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    pdbText = await res.text();
  } catch (err) {
    log(`[ERROR] Failed to fetch from URL: ${err}. Checking local fallback...`);
    const localPath = path.resolve(process.cwd(), '2POR.pdb');
    if (fs.existsSync(localPath)) {
      pdbText = fs.readFileSync(localPath, 'utf-8');
      log(`[INFO] Loaded local fallback: ${localPath}`);
    } else {
      throw new Error(`Could not fetch 2POR.pdb and no local fallback found.`);
    }
  }
  const tFetchEnd = performance.now();
  const fetchDuration = tFetchEnd - tFetchStart;

  log(`Status         : Successfully fetched`);
  log(`Data Length    : ${pdbText.length.toLocaleString()} characters`);
  log(`Total Lines    : ${pdbText.split('\n').length.toLocaleString()} lines`);
  log(`Fetch Latency  : ${fetchDuration.toFixed(2)} ms`);
  log("");

  // ---------------------------------------------------------------------------
  // STEP 2: PARSE PDB DATA
  // ---------------------------------------------------------------------------
  log("--------------------------------------------------------------------------------");
  log("2. PARSING PDB DATA");
  log("--------------------------------------------------------------------------------");
  const tParseStart = performance.now();
  
  const processor = new MolProcessor(pdbText, 'pdb');
  const tParseEnd = performance.now();
  const parseDuration = tParseEnd - tParseStart;

  const totalAtoms = processor.atoms.length;
  const atomRecords = processor.atoms.filter(a => !a.isHetero);
  const hetatmRecords = processor.atoms.filter(a => a.isHetero);
  const chains = Array.from(new Set(processor.atoms.map(a => a.chainID))).sort();
  const residues = new Set(processor.atoms.map(a => `${a.chainID}:${a.resSeq}:${a.resName}`));

  log(`Total Atoms    : ${totalAtoms}`);
  log(`ATOM Records   : ${atomRecords.length}`);
  log(`HETATM Records : ${hetatmRecords.length}`);
  log(`Chains (${chains.length})     : ${chains.join(', ') || 'None'}`);
  log(`Unique Residues: ${residues.size}`);
  log(`Parse Latency  : ${parseDuration.toFixed(2)} ms`);
  log("");

  // ---------------------------------------------------------------------------
  // STEP 3: SECONDARY STRUCTURE CALCULATION
  // ---------------------------------------------------------------------------
  log("--------------------------------------------------------------------------------");
  log("3. SECONDARY STRUCTURE ANALYSIS");
  log("--------------------------------------------------------------------------------");
  const tSSStart = performance.now();

  // A. PDB Record SS
  const helixHeaderRecords = processor.pdb_ss_records.filter(r => r.startsWith('HELIX'));
  const sheetHeaderRecords = processor.pdb_ss_records.filter(r => r.startsWith('SHEET'));

  // B. Calculated SS (Quick algorithm)
  processor.calculateSecondaryStructure('quick');
  const ssQuick = [...processor.ss_per_residue];
  
  // C. Calculated SS (DSSP algorithm)
  processor.calculateSecondaryStructure('dssp');
  const ssDssp = [...processor.ss_per_residue];

  const tSSEnd = performance.now();
  const ssDuration = tSSEnd - tSSStart;

  const countSS = (ssList: typeof ssQuick) => {
    let helix = 0, sheet = 0, loop = 0, undet = 0;
    for (const r of ssList) {
      if (r.ss_type === 'helix') helix++;
      else if (r.ss_type === 'sheet') sheet++;
      else if (r.ss_type === 'loop') loop++;
      else undet++;
    }
    const tot = ssList.length || 1;
    return {
      helix, sheet, loop, undet, total: ssList.length,
      pctHelix: (helix / tot * 100).toFixed(1),
      pctSheet: (sheet / tot * 100).toFixed(1),
      pctLoop: (loop / tot * 100).toFixed(1)
    };
  };

  const quickStats = countSS(ssQuick);
  const dsspStats = countSS(ssDssp);

  log(`PDB Header Records : ${helixHeaderRecords.length} HELIX records, ${sheetHeaderRecords.length} SHEET records`);
  log(`Calculated SS (Quick Algorithm):`);
  log(`  - Helix Residues : ${quickStats.helix} (${quickStats.pctHelix}%)`);
  log(`  - Sheet Residues : ${quickStats.sheet} (${quickStats.pctSheet}%)`);
  log(`  - Loop Residues  : ${quickStats.loop} (${quickStats.pctLoop}%)`);
  log(`  - Total Evaluated: ${quickStats.total}`);
  log(`Calculated SS (DSSP Algorithm):`);
  log(`  - Helix Residues : ${dsspStats.helix} (${dsspStats.pctHelix}%)`);
  log(`  - Sheet Residues : ${dsspStats.sheet} (${dsspStats.pctSheet}%)`);
  log(`  - Loop Residues  : ${dsspStats.loop} (${dsspStats.pctLoop}%)`);
  log(`  - Total Evaluated: ${dsspStats.total}`);
  log(`SS Latency         : ${ssDuration.toFixed(2)} ms`);
  log("");

  // ---------------------------------------------------------------------------
  // STEP 4: RAMACHANDRAN PHI/PSI TORSION ANGLES
  // ---------------------------------------------------------------------------
  log("--------------------------------------------------------------------------------");
  log("4. RAMACHANDRAN PHI/PSI TORSION ANGLE ANALYSIS");
  log("--------------------------------------------------------------------------------");
  const tRamaStart = performance.now();

  const parser = new SelectionParser(processor.atoms);
  const ramaRes = parser.evaluateCommand("ramachandran all");
  const ramaReport: RamaResidue[] = ramaRes.ramachandranReport || [];

  const tRamaEnd = performance.now();
  const ramaDuration = tRamaEnd - tRamaStart;

  let favoredCount = 0;
  let allowedCount = 0;
  let outlierCount = 0;

  for (const r of ramaReport) {
    if (r.region === 'favored') favoredCount++;
    else if (r.region === 'allowed') allowedCount++;
    else outlierCount++;
  }

  const totalRama = ramaReport.length || 1;
  const pctFavored = (favoredCount / totalRama * 100).toFixed(1);
  const pctAllowed = (allowedCount / totalRama * 100).toFixed(1);
  const pctOutlier = (outlierCount / totalRama * 100).toFixed(1);

  log(`Residues Evaluated : ${ramaReport.length}`);
  log(`Conformation Regions:`);
  log(`  - Favored Regions: ${favoredCount} (${pctFavored}%)`);
  log(`  - Allowed Regions: ${allowedCount} (${pctAllowed}%)`);
  log(`  - Outliers       : ${outlierCount} (${pctOutlier}%)`);
  log(`Ramachandran Latency: ${ramaDuration.toFixed(2)} ms`);
  log("");
  log("Sample Residue Phi/Psi Angles (First 15 residues):");
  log("Chain | ResSeq | ResName |    Phi (°) |    Psi (°) | Conformation Region");
  log("------|--------|---------|------------|------------|--------------------");
  for (let i = 0; i < Math.min(15, ramaReport.length); i++) {
    const r = ramaReport[i];
    log(`  ${r.chainID.padEnd(3)} | ${r.resSeq.toString().padStart(6)} | ${r.resName.padStart(7)} | ${r.phi.toFixed(2).padStart(10)} | ${r.psi.toFixed(2).padStart(10)} | ${r.region}`);
  }

  if (outlierCount > 0) {
    log("");
    log("Detected Steric Outliers:");
    const outliers = ramaReport.filter(r => r.region === 'outlier');
    outliers.forEach(r => {
      log(`  - Chain ${r.chainID} Res ${r.resSeq} (${r.resName}): Phi = ${r.phi.toFixed(2)}°, Psi = ${r.psi.toFixed(2)}°`);
    });
  }
  log("");

  // ---------------------------------------------------------------------------
  // STEP 5: DIPOLE MOMENT MAGNITUDE AND VECTOR
  // ---------------------------------------------------------------------------
  log("--------------------------------------------------------------------------------");
  log("5. MOLECULAR DIPOLE MOMENT ANALYSIS");
  log("--------------------------------------------------------------------------------");
  const tDipoleStart = performance.now();

  const dipoleRes = parser.evaluateCommand("dipole all");
  const dInfo = dipoleRes.dipoleResult || { charge: 0, magnitude: 0, vector: { x: 0, y: 0, z: 0 }, com: { x: 0, y: 0, z: 0 } };

  const tDipoleEnd = performance.now();
  const dipoleDuration = tDipoleEnd - tDipoleStart;

  // Calculate dipole per chain if multiple chains
  const chainDipoles: Record<string, { com: Vec3; netCharge: number; magnitude: number; vector: Vec3 }> = {};
  for (const c of chains) {
    const chainAtoms = processor.atoms.filter(a => a.chainID === c);
    if (chainAtoms.length === 0) continue;

    let totM = 0;
    let cx = 0, cy = 0, cz = 0;
    chainAtoms.forEach(a => {
      const m = getAtomicMass(a.elem);
      totM += m;
      cx += a.x * m;
      cy += a.y * m;
      cz += a.z * m;
    });
    if (totM > 0) { cx /= totM; cy /= totM; cz /= totM; }

    let qNet = 0;
    let mx = 0, my = 0, mz = 0;
    chainAtoms.forEach(a => {
      const q = getPartialCharge(a.name, a.elem);
      qNet += q;
      mx += q * (a.x - cx);
      my += q * (a.y - cy);
      mz += q * (a.z - cz);
    });

    mx *= DEBYE_PER_E_ANGSTROM;
    my *= DEBYE_PER_E_ANGSTROM;
    mz *= DEBYE_PER_E_ANGSTROM;
    const mag = Math.sqrt(mx * mx + my * my + mz * mz);

    chainDipoles[c] = {
      com: { x: cx, y: cy, z: cz },
      netCharge: qNet,
      magnitude: mag,
      vector: { x: mx, y: my, z: mz }
    };
  }

  log(`Center of Mass (COM) : (${dInfo.com.x.toFixed(3)}, ${dInfo.com.y.toFixed(3)}, ${dInfo.com.z.toFixed(3)}) Å`);
  log(`Net Ionic Charge     : ${dInfo.charge.toFixed(2)} e`);
  log(`Dipole Vector (Debye): (${dInfo.vector.x.toFixed(3)}, ${dInfo.vector.y.toFixed(3)}, ${dInfo.vector.z.toFixed(3)}) D`);
  log(`Dipole Vector (e·Å)  : (${(dInfo.vector.x / DEBYE_PER_E_ANGSTROM).toFixed(3)}, ${(dInfo.vector.y / DEBYE_PER_E_ANGSTROM).toFixed(3)}, ${(dInfo.vector.z / DEBYE_PER_E_ANGSTROM).toFixed(3)}) e·Å`);
  log(`Dipole Magnitude     : ${dInfo.magnitude.toFixed(3)} Debye (${(dInfo.magnitude / DEBYE_PER_E_ANGSTROM).toFixed(3)} e·Å)`);
  log(`Dipole Latency       : ${dipoleDuration.toFixed(2)} ms`);
  
  if (Object.keys(chainDipoles).length > 1) {
    log("");
    log("Per-Chain Dipole Breakdown:");
    for (const [c, info] of Object.entries(chainDipoles)) {
      log(`  Chain ${c}: COM = (${info.com.x.toFixed(2)}, ${info.com.y.toFixed(2)}, ${info.com.z.toFixed(2)}), NetCharge = ${info.netCharge.toFixed(2)}e, Dipole = ${info.magnitude.toFixed(2)} D, Vector = (${info.vector.x.toFixed(2)}, ${info.vector.y.toFixed(2)}, ${info.vector.z.toFixed(2)}) D`);
    }
  }
  log("");

  // ---------------------------------------------------------------------------
  // STEP 6: INTERACTION CONTACTS ANALYSIS
  // ---------------------------------------------------------------------------
  log("--------------------------------------------------------------------------------");
  log("6. INTERACTION CONTACTS ANALYSIS");
  log("--------------------------------------------------------------------------------");
  const tContactsStart = performance.now();

  const contacts: InteractionContact[] = [];

  // 6.1 DSSP Electrostatic Hydrogen Bonds
  const hbondCmdRes = parser.evaluateCommand("hbond_energy all");
  const dsspHBonds = hbondCmdRes.addHBonds || [];
  dsspHBonds.forEach((hb: any) => {
    contacts.push({
      type: 'hbond_dssp',
      res1: hb.donorLabel,
      res2: hb.acceptorLabel,
      atom1: hb.donorLabel.split('/').pop() || '',
      atom2: hb.acceptorLabel.split('/').pop() || '',
      distance: hb.distance,
      energy: hb.energy
    });
  });

  // 6.2 Salt Bridges
  const basicResidues = ['LYS', 'ARG', 'HIS'];
  const acidicResidues = ['ASP', 'GLU'];
  const basicAtoms = ['NZ', 'NE', 'NH1', 'NH2', 'ND1', 'NE2'];
  const acidicAtoms = ['OD1', 'OD2', 'OE1', 'OE2'];

  const basicAtomList = processor.atoms.filter(a => basicResidues.includes(a.resName.toUpperCase()) && basicAtoms.includes(a.name.trim()));
  const acidicAtomList = processor.atoms.filter(a => acidicResidues.includes(a.resName.toUpperCase()) && acidicAtoms.includes(a.name.trim()));

  for (const bAtom of basicAtomList) {
    for (const aAtom of acidicAtomList) {
      if (bAtom.chainID === aAtom.chainID && bAtom.resSeq === aAtom.resSeq) continue;
      const dx = bAtom.x - aAtom.x;
      const dy = bAtom.y - aAtom.y;
      const dz = bAtom.z - aAtom.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d <= 4.0) {
        contacts.push({
          type: 'saltbridge',
          res1: `/${bAtom.chainID}/${bAtom.resSeq}/${bAtom.resName}`,
          res2: `/${aAtom.chainID}/${aAtom.resSeq}/${aAtom.resName}`,
          atom1: bAtom.name.trim(),
          atom2: aAtom.name.trim(),
          distance: d
        });
      }
    }
  }

  // 6.3 Hydrophobic Sidechain Contacts
  const nonpolarResidues = ['ALA', 'VAL', 'LEU', 'ILE', 'MET', 'PHE', 'TRP', 'PRO'];
  const nonpolarAtoms = processor.atoms.filter(a => nonpolarResidues.includes(a.resName.toUpperCase()) && a.elem === 'C' && !['N', 'CA', 'C', 'O'].includes(a.name.trim()));

  // Spatial hashing for hydrophobic contacts
  const grid: Record<string, number[]> = {};
  const cellSize = 4.5;
  for (let i = 0; i < nonpolarAtoms.length; i++) {
    const a = nonpolarAtoms[i];
    const key = `${Math.floor(a.x / cellSize)},${Math.floor(a.y / cellSize)},${Math.floor(a.z / cellSize)}`;
    if (!grid[key]) grid[key] = [];
    grid[key].push(i);
  }

  const hydrophobicSet = new Set<string>();
  for (let i = 0; i < nonpolarAtoms.length; i++) {
    const a1 = nonpolarAtoms[i];
    const cx = Math.floor(a1.x / cellSize);
    const cy = Math.floor(a1.y / cellSize);
    const cz = Math.floor(a1.z / cellSize);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const key = `${cx + dx},${cy + dy},${cz + dz}`;
          const cellIndices = grid[key];
          if (!cellIndices) continue;

          for (const j of cellIndices) {
            if (j <= i) continue;
            const a2 = nonpolarAtoms[j];
            if (a1.chainID === a2.chainID && Math.abs(a1.resSeq - a2.resSeq) <= 2) continue;

            const dist = Math.sqrt((a1.x - a2.x) ** 2 + (a1.y - a2.y) ** 2 + (a1.z - a2.z) ** 2);
            if (dist >= 3.5 && dist <= 4.2) {
              const pairKey = a1.resSeq < a2.resSeq ? 
                `/${a1.chainID}/${a1.resSeq}/${a1.resName}-/${a2.chainID}/${a2.resSeq}/${a2.resName}` :
                `/${a2.chainID}/${a2.resSeq}/${a2.resName}-/${a1.chainID}/${a1.resSeq}/${a1.resName}`;
              
              if (!hydrophobicSet.has(pairKey)) {
                hydrophobicSet.add(pairKey);
                contacts.push({
                  type: 'hydrophobic',
                  res1: `/${a1.chainID}/${a1.resSeq}/${a1.resName}`,
                  res2: `/${a2.chainID}/${a2.resSeq}/${a2.resName}`,
                  atom1: a1.name.trim(),
                  atom2: a2.name.trim(),
                  distance: dist
                });
              }
            }
          }
        }
      }
    }
  }

  // 6.4 Aromatic Pi-Stacking Contacts
  interface AromaticRing {
    res1: string;
    centroid: Vec3;
    normal: Vec3;
    resName: string;
  }
  const aromaticRings: AromaticRing[] = [];
  const aromaticResiduesList = ['PHE', 'TYR', 'TRP', 'HIS'];
  const resGroups = new Map<string, Atom[]>();

  processor.atoms.forEach(a => {
    if (aromaticResiduesList.includes(a.resName.toUpperCase())) {
      const k = `/${a.chainID}/${a.resSeq}/${a.resName}`;
      if (!resGroups.has(k)) resGroups.set(k, []);
      resGroups.get(k)!.push(a);
    }
  });

  resGroups.forEach((ringAtoms, k) => {
    const resName = k.split('/')[3];
    let targetNames: string[] = [];
    if (resName === 'PHE' || resName === 'TYR') targetNames = ['CG', 'CD1', 'CD2', 'CE1', 'CE2', 'CZ'];
    else if (resName === 'HIS') targetNames = ['CG', 'ND1', 'CD2', 'CE1', 'NE2'];
    else if (resName === 'TRP') targetNames = ['CD2', 'CE2', 'CZ2', 'CH2', 'CZ3', 'CE3'];

    const filtered = ringAtoms.filter(a => targetNames.includes(a.name.trim()));
    if (filtered.length >= 5) {
      let cx = 0, cy = 0, cz = 0;
      filtered.forEach(a => { cx += a.x; cy += a.y; cz += a.z; });
      const centroid = { x: cx / filtered.length, y: cy / filtered.length, z: cz / filtered.length };

      const r1 = filtered[0]; const r2 = filtered[1]; const r3 = filtered[2];
      const v1 = sub(r2, r1); const v2 = sub(r3, r1);
      const n = cross(v1, v2);
      const len = norm(n);
      const normal = len > 0 ? { x: n.x / len, y: n.y / len, z: n.z / len } : { x: 0, y: 0, z: 1 };

      aromaticRings.push({ res1: k, centroid, normal, resName });
    }
  });

  for (let i = 0; i < aromaticRings.length; i++) {
    for (let j = i + 1; j < aromaticRings.length; j++) {
      const r1 = aromaticRings[i];
      const r2 = aromaticRings[j];
      const dist = norm(sub(r1.centroid, r2.centroid));
      if (dist >= 3.3 && dist <= 5.5) {
        contacts.push({
          type: 'pistacking',
          res1: r1.res1,
          res2: r2.res1,
          atom1: 'RingCentroid',
          atom2: 'RingCentroid',
          distance: dist
        });
      }
    }
  }

  const tContactsEnd = performance.now();
  const contactsDuration = tContactsEnd - tContactsStart;

  const hbondDsspCount = contacts.filter(c => c.type === 'hbond_dssp').length;
  const saltBridgeCount = contacts.filter(c => c.type === 'saltbridge').length;
  const hydrophobicCount = contacts.filter(c => c.type === 'hydrophobic').length;
  const piStackingCount = contacts.filter(c => c.type === 'pistacking').length;

  log(`DSSP H-Bonds (E < -0.5 kcal/mol) : ${hbondDsspCount}`);
  log(`Salt Bridges (d <= 4.0 Å)      : ${saltBridgeCount}`);
  log(`Hydrophobic Contacts           : ${hydrophobicCount}`);
  log(`Aromatic Pi-Stacking           : ${piStackingCount}`);
  log(`Total Interaction Contacts     : ${contacts.length}`);
  log(`Contacts Latency               : ${contactsDuration.toFixed(2)} ms`);
  log("");

  log("Sample Salt Bridges:");
  const sampleSalt = contacts.filter(c => c.type === 'saltbridge').slice(0, 10);
  if (sampleSalt.length > 0) {
    log("Basic Residue        | Acidic Residue       | Distance (Å)");
    log("---------------------|----------------------|-------------");
    sampleSalt.forEach(c => {
      log(`  ${c.res1.padEnd(18)} | ${c.res2.padEnd(20)} | ${c.distance.toFixed(2).padStart(11)}`);
    });
  } else {
    log("  No salt bridges found.");
  }
  log("");

  log("Sample DSSP Hydrogen Bonds:");
  const sampleHb = contacts.filter(c => c.type === 'hbond_dssp').slice(0, 10);
  if (sampleHb.length > 0) {
    log("Donor Residue        | Acceptor Residue     | Distance (Å) | Energy (kcal/mol)");
    log("---------------------|----------------------|--------------|------------------");
    sampleHb.forEach(c => {
      log(`  ${c.res1.padEnd(18)} | ${c.res2.padEnd(20)} | ${c.distance.toFixed(2).padStart(12)} | ${(c.energy || 0).toFixed(2).padStart(16)}`);
    });
  }
  log("");

  // ---------------------------------------------------------------------------
  // STEP 7: BENCHMARK TIMING SUMMARY
  // ---------------------------------------------------------------------------
  const totalDuration = performance.now() - startTime;
  log("--------------------------------------------------------------------------------");
  log("7. BENCHMARK & EXECUTION TIMING SUMMARY");
  log("--------------------------------------------------------------------------------");
  log(`  1. Fetch PDB File       : ${fetchDuration.toFixed(2).padStart(8)} ms (${(fetchDuration/totalDuration*100).toFixed(1)}%)`);
  log(`  2. Parse PDB Structure  : ${parseDuration.toFixed(2).padStart(8)} ms (${(parseDuration/totalDuration*100).toFixed(1)}%)`);
  log(`  3. Secondary Structure  : ${ssDuration.toFixed(2).padStart(8)} ms (${(ssDuration/totalDuration*100).toFixed(1)}%)`);
  log(`  4. Ramachandran Angles  : ${ramaDuration.toFixed(2).padStart(8)} ms (${(ramaDuration/totalDuration*100).toFixed(1)}%)`);
  log(`  5. Dipole Moment Vector : ${dipoleDuration.toFixed(2).padStart(8)} ms (${(dipoleDuration/totalDuration*100).toFixed(1)}%)`);
  log(`  6. Interaction Contacts : ${contactsDuration.toFixed(2).padStart(8)} ms (${(contactsDuration/totalDuration*100).toFixed(1)}%)`);
  log(`  --------------------------------------------------------`);
  log(`  TOTAL RUNTIME DURATION  : ${totalDuration.toFixed(2).padStart(8)} ms (100.0%)`);
  log("================================================================================");

  // Write full report to scratch/qa_2por.log
  const logFilePath = path.resolve(process.cwd(), 'scratch', 'qa_2por.log');
  fs.writeFileSync(logFilePath, logLines.join('\n'), 'utf-8');
  console.log(`\nReport successfully written to ${logFilePath}`);
}

runQA2POR().catch(err => {
  console.error("QA execution failed:", err);
  process.exit(1);
});
