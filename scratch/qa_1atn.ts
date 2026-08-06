import fs from 'fs';
import path from 'path';
import { MolProcessor, Atom } from '../src/lib/MolProcessor';
import { SelectionParser } from '../src/lib/SelectionParser';
import { calculateInteractions, Interaction } from '../src/lib/Interactions';

// Ensure 3Dmol global fallback for Node environment
if (typeof (global as any).$3Dmol === 'undefined') {
  (global as any).$3Dmol = { Parsers: { mmtf: () => [] } };
}

// Interfaces & Helper Types
interface PhaseTimer {
  name: string;
  durationMs: number;
}

interface RamachandranResidue {
  chainID: string;
  resSeq: number;
  resName: string;
  phi: number;
  psi: number;
  region: 'favored' | 'allowed' | 'outlier';
}

interface ChainDipole {
  chainID: string;
  atomCount: number;
  totalMass: number;
  netCharge: number;
  com: { x: number; y: number; z: number };
  dipoleEAng: { x: number; y: number; z: number };
  dipoleDebye: { x: number; y: number; z: number };
  magnitudeDebye: number;
}

const DEBYE_PER_E_ANGSTROM = 4.8032;

// Atomic Mass Table
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

// Partial Charge Table (AMBER + Element Fallbacks + Metal Ions)
const AMBER_CHARGES: Record<string, number> = {
  "N": -0.47, "H": 0.31, "CA": 0.07, "C": 0.51, "O": -0.51,
  "NZ": 1.00, "NH1": 0.40, "NH2": 0.40, "NE": -0.05,
  "OD1": -0.80, "OD2": -0.80, "OE1": -0.80, "OE2": -0.80,
  "SG": -0.20, "OH": -0.40, "ND1": -0.36, "NE2": -0.36
};

function getPartialCharge(atomName: string, elem: string, resName: string): number {
  const cleanName = atomName.trim().toUpperCase();
  const cleanElem = elem.trim().toUpperCase();
  const cleanRes = resName.trim().toUpperCase();

  // Metal Ions
  if (cleanElem === 'CA' || cleanElem === 'MG' || cleanElem === 'ZN' || cleanElem === 'FE') return 2.00;
  if (cleanElem === 'NA' || cleanElem === 'K') return 1.00;

  // Specific AMBER residue atom names
  if (AMBER_CHARGES[cleanName] !== undefined) {
    return AMBER_CHARGES[cleanName];
  }

  // Element fallbacks
  if (cleanElem === 'O' || cleanName.startsWith('O')) return -0.40;
  if (cleanElem === 'N' || cleanName.startsWith('N')) return -0.40;
  if (cleanElem === 'C' || cleanName.startsWith('C')) return 0.00;
  if (cleanElem === 'H' || cleanName.startsWith('H')) return 0.10;
  if (cleanElem === 'S') return -0.20;
  if (cleanElem === 'P') return 0.40;
  return 0.00;
}

// Dihedral Angle Calculation
function vecSub(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function vecCross(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

function vecDot(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function vecNorm(a: { x: number; y: number; z: number }) {
  return Math.sqrt(vecDot(a, a));
}

function calculateDihedral(
  p1: { x: number; y: number; z: number },
  p2: { x: number; y: number; z: number },
  p3: { x: number; y: number; z: number },
  p4: { x: number; y: number; z: number }
): number {
  const b1 = vecSub(p2, p1);
  const b2 = vecSub(p3, p2);
  const b3 = vecSub(p4, p3);

  const n1 = vecCross(b1, b2);
  const n2 = vecCross(b2, b3);

  const lenB2 = vecNorm(b2);
  if (lenB2 === 0) return 0;

  const m1 = vecCross(n1, b2);

  const dotN = vecDot(n1, n2);
  const dotM = vecDot(m1, n2) / lenB2;

  return Math.atan2(-dotM, dotN) * (180.0 / Math.PI);
}

// Ramachandran Region Evaluator (Lovell et al. 2003)
function classifyRamachandranRegion(phi: number, psi: number): 'favored' | 'allowed' | 'outlier' {
  if (phi === 360 || psi === 360) return 'allowed';
  // Alpha Helix Core
  if (phi >= -100 && phi <= -30 && psi >= -70 && psi <= -10) return 'favored';
  // Beta Sheet Core
  if (phi >= -160 && phi <= -50 && (psi >= 90 && psi <= 180 || psi >= -180 && psi <= -160)) return 'favored';
  // Left-handed Alpha
  if (phi >= 30 && phi <= 90 && psi >= 20 && psi <= 90) return 'favored';

  // Allowed Regions
  if (phi >= -120 && phi <= -10 && psi >= -90 && psi <= 10) return 'allowed';
  if (phi >= -180 && phi <= -30 && (psi >= 70 && psi <= 180 || psi >= -180 && psi <= -140)) return 'allowed';
  if (phi >= 10 && phi <= 110 && psi >= 0 && psi <= 110) return 'allowed';

  return 'outlier';
}

// Main Execution Routine
async function runQA1ATN() {
  const totalStartTime = performance.now();
  const timers: PhaseTimer[] = [];
  const logLines: string[] = [];

  function log(msg: string = '') {
    console.log(msg);
    logLines.push(msg);
  }

  log("===================================================================================");
  log("        BIOPHYSICAL ANALYSIS & QA PIPELINE FOR PDB ID: 1ATN (Actin-DNase I Complex)");
  log("===================================================================================");
  log(`Execution Date: ${new Date().toISOString()}`);
  log();

  // ---------------------------------------------------------------------------------
  // PHASE 1: FETCH PDB FILE
  // ---------------------------------------------------------------------------------
  log("--- PHASE 1: Fetching PDB File (1ATN.pdb from files.rcsb.org) ---");
  const fetchStart = performance.now();
  const url = "https://files.rcsb.org/download/1ATN.pdb";
  log(`Fetching from URL: ${url}`);
  
  let pdbText = "";
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
    }
    pdbText = await resp.text();
  } catch (err: any) {
    log(`[ERROR] Failed to fetch 1ATN.pdb over network: ${err.message}`);
    log("Attempting fallback to local scratch/1ATN.pdb if present...");
    const localPath = path.resolve(process.cwd(), 'scratch', '1ATN.pdb');
    if (fs.existsSync(localPath)) {
      pdbText = fs.readFileSync(localPath, 'utf8');
      log(`Successfully loaded 1ATN.pdb from local fallback path (${pdbText.length} bytes).`);
    } else {
      log(`[FATAL] Local fallback file not found at ${localPath}`);
      process.exit(1);
    }
  }
  const fetchDuration = performance.now() - fetchStart;
  timers.push({ name: "1. Fetch PDB File", durationMs: fetchDuration });
  log(`✓ Fetched PDB Content: ${pdbText.length.toLocaleString()} bytes, ${pdbText.split('\n').length.toLocaleString()} lines in ${fetchDuration.toFixed(2)} ms.`);
  log();

  // Save 1ATN.pdb locally in scratch for caching if needed
  const cachePath = path.resolve(process.cwd(), 'scratch', '1ATN.pdb');
  fs.writeFileSync(cachePath, pdbText, 'utf8');

  // ---------------------------------------------------------------------------------
  // PHASE 2: PARSE PDB STRUCTURE & ATOM MAPPING
  // ---------------------------------------------------------------------------------
  log("--- PHASE 2: Parsing PDB Structure & Atom Mapping ---");
  const parseStart = performance.now();
  const processor = new MolProcessor(pdbText, 'pdb');
  const atoms = processor.atoms;
  const parseDuration = performance.now() - parseStart;
  timers.push({ name: "2. Parse PDB & Atom Mapping", durationMs: parseDuration });

  const totalAtoms = atoms.length;
  const standardAtoms = atoms.filter(a => !a.isHetero);
  const hetAtoms = atoms.filter(a => a.isHetero);
  const waterAtoms = atoms.filter(a => ['HOH', 'WAT', 'DOD'].includes(a.resName.trim().toUpperCase()));
  const ligandAtoms = hetAtoms.filter(a => !['HOH', 'WAT', 'DOD'].includes(a.resName.trim().toUpperCase()));

  const chainSet = new Map<string, { atomCount: number; resSeqSet: Set<number>; resTypes: Set<string> }>();
  atoms.forEach(a => {
    const ch = a.chainID || 'Unassigned';
    if (!chainSet.has(ch)) {
      chainSet.set(ch, { atomCount: 0, resSeqSet: new Set(), resTypes: new Set() });
    }
    const data = chainSet.get(ch)!;
    data.atomCount++;
    if (!a.isHetero) {
      data.resSeqSet.add(a.resSeq);
      data.resTypes.add(a.resName.trim());
    }
  });

  log(`✓ Parsed ${totalAtoms.toLocaleString()} total atoms in ${parseDuration.toFixed(2)} ms.`);
  log(`  - Standard Protein Atoms (ATOM)  : ${standardAtoms.length.toLocaleString()}`);
  log(`  - Hetero / Ligand Atoms (HETATM) : ${hetAtoms.length.toLocaleString()}`);
  log(`  - Water Molecules (HOH)         : ${waterAtoms.length.toLocaleString()} atoms (${(waterAtoms.length / 3).toFixed(0)} molecules)`);
  log(`  - Non-Water Ligand/Ion Atoms    : ${ligandAtoms.length.toLocaleString()}`);
  log();
  log("Chains Summary:");
  chainSet.forEach((data, ch) => {
    log(`  - Chain ${ch}: ${data.atomCount.toLocaleString()} atoms, ${data.resSeqSet.size} protein residues`);
  });
  log();

  // ---------------------------------------------------------------------------------
  // PHASE 3: COMPUTE SECONDARY STRUCTURE (PDB, Quick, DSSP)
  // ---------------------------------------------------------------------------------
  log("--- PHASE 3: Computing Secondary Structure ---");
  const ssStart = performance.now();

  // Method 1: PDB Header Records
  const procPDB = new MolProcessor(pdbText, 'pdb');
  procPDB.calculateSecondaryStructure('pdb');
  const ssPDB = procPDB.ss_per_residue;

  // Method 2: Quick Geometric Dihedral Method
  const procQuick = new MolProcessor(pdbText, 'pdb');
  procQuick.calculateSecondaryStructure('quick');
  const ssQuick = procQuick.ss_per_residue;

  // Method 3: DSSP Electrostatic Hydrogen-Bond Pattern Method
  const procDSSP = new MolProcessor(pdbText, 'pdb');
  procDSSP.calculateSecondaryStructure('dssp');
  const ssDSSP = procDSSP.ss_per_residue;

  const ssDuration = performance.now() - ssStart;
  timers.push({ name: "3. Secondary Structure Calculation", durationMs: ssDuration });

  function summarizeSS(ssList: typeof ssQuick) {
    let helix = 0, sheet = 0, loop = 0, undetermined = 0;
    ssList.forEach(item => {
      if (item.ss_type === 'helix') helix++;
      else if (item.ss_type === 'sheet') sheet++;
      else if (item.ss_type === 'loop') loop++;
      else undetermined++;
    });
    const total = ssList.length || 1;
    return {
      helix, helixPct: (helix / total) * 100,
      sheet, sheetPct: (sheet / total) * 100,
      loop, loopPct: (loop / total) * 100,
      undetermined, total
    };
  }

  const statPDB = summarizeSS(ssPDB);
  const statQuick = summarizeSS(ssQuick);
  const statDSSP = summarizeSS(ssDSSP);

  log(`✓ Calculated Secondary Structure across 3 algorithms in ${ssDuration.toFixed(2)} ms.`);
  log();
  log("Secondary Structure Summary Comparison:");
  log(`  [PDB Header Records] : Total ${statPDB.total} residues -> Helix: ${statPDB.helix} (${statPDB.helixPct.toFixed(1)}%), Sheet: ${statPDB.sheet} (${statPDB.sheetPct.toFixed(1)}%), Loop: ${statPDB.loop} (${statPDB.loopPct.toFixed(1)}%)`);
  log(`  [Quick Dihedral Map] : Total ${statQuick.total} residues -> Helix: ${statQuick.helix} (${statQuick.helixPct.toFixed(1)}%), Sheet: ${statQuick.sheet} (${statQuick.sheetPct.toFixed(1)}%), Loop: ${statQuick.loop} (${statQuick.loopPct.toFixed(1)}%)`);
  log(`  [DSSP Electrostatic ]: Total ${statDSSP.total} residues -> Helix: ${statDSSP.helix} (${statDSSP.helixPct.toFixed(1)}%), Sheet: ${statDSSP.sheet} (${statDSSP.sheetPct.toFixed(1)}%), Loop: ${statDSSP.loop} (${statDSSP.loopPct.toFixed(1)}%)`);
  log();

  // Per-Chain Breakdown (DSSP)
  log("Per-Chain Secondary Structure Breakdown (DSSP Algorithm):");
  const chains = Array.from(chainSet.keys()).sort();
  chains.forEach(ch => {
    const chainSS = ssDSSP.filter(s => s.chainID === ch);
    if (chainSS.length > 0) {
      const stats = summarizeSS(chainSS);
      log(`  - Chain ${ch} (${stats.total} res): Helix=${stats.helix} (${stats.helixPct.toFixed(1)}%), Sheet=${stats.sheet} (${stats.sheetPct.toFixed(1)}%), Loop=${stats.loop} (${stats.loopPct.toFixed(1)}%)`);
    }
  });
  log();

  // ---------------------------------------------------------------------------------
  // PHASE 4: RAMACHANDRAN PHI / PSI ANGLES & REGION CLASSIFICATION
  // ---------------------------------------------------------------------------------
  log("--- PHASE 4: Computing Ramachandran Phi/Psi Angles & Stereochemistry ---");
  const ramaStart = performance.now();

  const ramaResidues: RamachandranResidue[] = [];
  const proteinAtoms = atoms.filter(a => !a.isHetero);

  // Group protein atoms by chain and resSeq
  const residueMap = new Map<string, Map<string, Atom>>();
  proteinAtoms.forEach(a => {
    const key = `${a.chainID}:${a.resSeq}`;
    if (!residueMap.has(key)) residueMap.set(key, new Map());
    residueMap.get(key)!.set(a.name.trim(), a);
  });

  const sortedResidueKeys = Array.from(residueMap.keys()).sort((k1, k2) => {
    const [c1, r1] = k1.split(':');
    const [c2, r2] = k2.split(':');
    if (c1 !== c2) return c1.localeCompare(c2);
    return parseInt(r1) - parseInt(r2);
  });

  sortedResidueKeys.forEach(key => {
    const [chainID, resSeqStr] = key.split(':');
    const resSeq = parseInt(resSeqStr);
    const currentResAtoms = residueMap.get(key)!;

    const N = currentResAtoms.get('N');
    const CA = currentResAtoms.get('CA');
    const C = currentResAtoms.get('C');
    if (!N || !CA || !C) return;

    const prevResAtoms = residueMap.get(`${chainID}:${resSeq - 1}`);
    const nextResAtoms = residueMap.get(`${chainID}:${resSeq + 1}`);

    const C_prev = prevResAtoms ? prevResAtoms.get('C') : undefined;
    const N_next = nextResAtoms ? nextResAtoms.get('N') : undefined;

    let phi = 360;
    let psi = 360;

    if (C_prev) {
      phi = calculateDihedral(C_prev, N, CA, C);
    }
    if (N_next) {
      psi = calculateDihedral(N, CA, C, N_next);
    }

    if (phi !== 360 && psi !== 360) {
      const region = classifyRamachandranRegion(phi, psi);
      const resName = CA.resName.trim();
      ramaResidues.push({ chainID, resSeq, resName, phi, psi, region });
    }
  });

  const ramaDuration = performance.now() - ramaStart;
  timers.push({ name: "4. Ramachandran Phi/Psi Calculation", durationMs: ramaDuration });

  const favoredList = ramaResidues.filter(r => r.region === 'favored');
  const allowedList = ramaResidues.filter(r => r.region === 'allowed');
  const outlierList = ramaResidues.filter(r => r.region === 'outlier');

  const totalEvaluated = ramaResidues.length;
  const favoredPct = ((favoredList.length / totalEvaluated) * 100).toFixed(1);
  const allowedPct = ((allowedList.length / totalEvaluated) * 100).toFixed(1);
  const outlierPct = ((outlierList.length / totalEvaluated) * 100).toFixed(1);

  log(`✓ Evaluated ${totalEvaluated} protein residues for Phi/Psi torsion angles in ${ramaDuration.toFixed(2)} ms.`);
  log(`  - Favored Region : ${favoredList.length} (${favoredPct}%)`);
  log(`  - Allowed Region : ${allowedList.length} (${allowedPct}%)`);
  log(`  - Outliers       : ${outlierList.length} (${outlierPct}%)`);
  log();

  if (outlierList.length > 0) {
    log(`Outliers Details (${outlierList.length} residues):`);
    outlierList.forEach(o => {
      log(`  Chain ${o.chainID} | Res ${o.resSeq.toString().padStart(4, ' ')} ${o.resName.padStart(3, ' ')} : Phi = ${o.phi.toFixed(1).padStart(6, ' ')}°, Psi = ${o.psi.toFixed(1).padStart(6, ' ')}°`);
    });
  } else {
    log("  No Ramachandran outliers detected!");
  }
  log();

  // Display sample residue torsion angles table (First 10 residues)
  log("Sample Residue Ramachandran Torsion Angles (First 10 residues):");
  log("Chain | ResSeq | ResName |   Phi (°)  |   Psi (°)  | Region");
  log("------+--------+---------+------------+------------+---------");
  ramaResidues.slice(0, 10).forEach(r => {
    log(`  ${r.chainID}   |  ${r.resSeq.toString().padStart(4, ' ')}  |   ${r.resName.padStart(3, ' ')}   | ${r.phi.toFixed(1).padStart(9, ' ')}  | ${r.psi.toFixed(1).padStart(9, ' ')}  | ${r.region}`);
  });
  log();

  // ---------------------------------------------------------------------------------
  // PHASE 5: DIPOLE MOMENT VECTOR & MAGNITUDE
  // ---------------------------------------------------------------------------------
  log("--- PHASE 5: Computing Molecular Dipole Moment (Magnitude & Vector) ---");
  const dipoleStart = performance.now();

  function calculateDipoleForAtoms(atomSet: Atom[]): ChainDipole {
    if (atomSet.length === 0) {
      return {
        chainID: "Empty", atomCount: 0, totalMass: 0, netCharge: 0,
        com: { x: 0, y: 0, z: 0 },
        dipoleEAng: { x: 0, y: 0, z: 0 },
        dipoleDebye: { x: 0, y: 0, z: 0 },
        magnitudeDebye: 0
      };
    }

    let totalMass = 0;
    let cx = 0, cy = 0, cz = 0;
    for (const a of atomSet) {
      const m = getAtomicMass(a.elem);
      totalMass += m;
      cx += a.x * m;
      cy += a.y * m;
      cz += a.z * m;
    }
    const com = { x: cx / totalMass, y: cy / totalMass, z: cz / totalMass };

    let netCharge = 0;
    let mux = 0, muy = 0, muz = 0;
    for (const a of atomSet) {
      const q = getPartialCharge(a.name, a.elem, a.resName);
      netCharge += q;
      const dx = a.x - com.x;
      const dy = a.y - com.y;
      const dz = a.z - com.z;
      mux += q * dx;
      muy += q * dy;
      muz += q * dz;
    }

    const dipoleEAng = { x: mux, y: muy, z: muz };
    const dipoleDebye = {
      x: mux * DEBYE_PER_E_ANGSTROM,
      y: muy * DEBYE_PER_E_ANGSTROM,
      z: muz * DEBYE_PER_E_ANGSTROM
    };
    const magnitudeDebye = Math.sqrt(
      dipoleDebye.x * dipoleDebye.x +
      dipoleDebye.y * dipoleDebye.y +
      dipoleDebye.z * dipoleDebye.z
    );

    return {
      chainID: atomSet[0]?.chainID || "Complex",
      atomCount: atomSet.length,
      totalMass,
      netCharge,
      com,
      dipoleEAng,
      dipoleDebye,
      magnitudeDebye
    };
  }

  // Complex dipole
  const complexDipole = calculateDipoleForAtoms(atoms);

  // Per-chain dipoles
  const chainDipoles: ChainDipole[] = [];
  chains.forEach(ch => {
    const chAtoms = atoms.filter(a => a.chainID === ch);
    chainDipoles.push(calculateDipoleForAtoms(chAtoms));
  });

  const dipoleDuration = performance.now() - dipoleStart;
  timers.push({ name: "5. Dipole Moment Calculation", durationMs: dipoleDuration });

  log(`✓ Computed Dipole Moment in ${dipoleDuration.toFixed(2)} ms.`);
  log();
  log("Whole Complex (1ATN) Dipole Result:");
  log(`  - Total Atoms       : ${complexDipole.atomCount.toLocaleString()}`);
  log(`  - Total Mass        : ${complexDipole.totalMass.toFixed(2)} amu`);
  log(`  - Net Charge        : ${complexDipole.netCharge.toFixed(2)} e`);
  log(`  - Center of Mass    : (${complexDipole.com.x.toFixed(3)}, ${complexDipole.com.y.toFixed(3)}, ${complexDipole.com.z.toFixed(3)}) Å`);
  log(`  - Dipole Vector (eÅ): (${complexDipole.dipoleEAng.x.toFixed(2)}, ${complexDipole.dipoleEAng.y.toFixed(2)}, ${complexDipole.dipoleEAng.z.toFixed(2)}) e·Å`);
  log(`  - Dipole Vector (D) : (${complexDipole.dipoleDebye.x.toFixed(2)}, ${complexDipole.dipoleDebye.y.toFixed(2)}, ${complexDipole.dipoleDebye.z.toFixed(2)}) Debye`);
  log(`  - Dipole Magnitude  : ${complexDipole.magnitudeDebye.toFixed(2)} Debye`);
  log();

  log("Per-Chain Dipole Moment Breakdown:");
  chainDipoles.forEach(cd => {
    log(`  - Chain ${cd.chainID}:`);
    log(`      Atoms: ${cd.atomCount} | Mass: ${cd.totalMass.toFixed(1)} amu | Net Charge: ${cd.netCharge.toFixed(2)} e`);
    log(`      COM: (${cd.com.x.toFixed(2)}, ${cd.com.y.toFixed(2)}, ${cd.com.z.toFixed(2)}) Å`);
    log(`      Dipole Vector: (${cd.dipoleDebye.x.toFixed(2)}, ${cd.dipoleDebye.y.toFixed(2)}, ${cd.dipoleDebye.z.toFixed(2)}) Debye`);
    log(`      Dipole Magnitude: ${cd.magnitudeDebye.toFixed(2)} Debye`);
  });
  log();

  // ---------------------------------------------------------------------------------
  // PHASE 6: INTERACTION CONTACTS (H-BONDS, SALT BRIDGES, ETC.)
  // ---------------------------------------------------------------------------------
  log("--- PHASE 6: Computing Inter-Chain Interaction Contacts ---");
  const contactsStart = performance.now();

  // Split PDB text into Chain A and Chain D
  const pdbLines = pdbText.split('\n');
  const chainALines = pdbLines.filter(l => (l.startsWith('ATOM') || l.startsWith('HETATM')) && l.substring(21, 22) === 'A');
  const chainDLines = pdbLines.filter(l => (l.startsWith('ATOM') || l.startsWith('HETATM')) && l.substring(21, 22) === 'D');

  const chainAPDB = chainALines.join('\n');
  const chainDPDB = chainDLines.join('\n');

  log(`Chain A PDB length: ${chainALines.length} atom records`);
  log(`Chain D PDB length: ${chainDLines.length} atom records`);

  const interactions: Interaction[] = calculateInteractions(chainAPDB, chainDPDB);
  const contactsDuration = performance.now() - contactsStart;
  timers.push({ name: "6. Interaction Contacts Calculation", durationMs: contactsDuration });

  const interactionCounts: Record<string, number> = {};
  interactions.forEach(i => {
    interactionCounts[i.type] = (interactionCounts[i.type] || 0) + 1;
  });

  log(`✓ Computed ${interactions.length} total inter-chain interactions between Chain A (Actin) and Chain D (DNase I) in ${contactsDuration.toFixed(2)} ms.`);
  log();
  log("Interaction Types Breakdown:");
  log(`  - Hydrogen Bonds (hbond)   : ${interactionCounts['hbond'] || 0}`);
  log(`  - Salt Bridges (saltbridge) : ${interactionCounts['saltbridge'] || 0}`);
  log(`  - Hydrophobic Contacts     : ${interactionCounts['hydrophobic'] || 0}`);
  log(`  - Pi-Pi Stacking           : ${interactionCounts['pistacking'] || 0}`);
  log(`  - Cation-Pi Interactions   : ${interactionCounts['cationpi'] || 0}`);
  log(`  - Halogen Bonds            : ${interactionCounts['halogen'] || 0}`);
  log();

  log("Key Inter-Chain Interactions List (Chain A vs Chain D):");
  log("Type        | Chain A Atom          | Chain D Atom          | Distance (Å)");
  log("------------+-----------------------+-----------------------+--------------");
  interactions.forEach(i => {
    const a1Str = `${i.atom1.resName} ${i.atom1.resSeq}:${i.atom1.name.trim()}`;
    const a2Str = `${i.atom2.resName} ${i.atom2.resSeq}:${i.atom2.name.trim()}`;
    log(`${i.type.padEnd(11, ' ')} | ${a1Str.padEnd(21, ' ')} | ${a2Str.padEnd(21, ' ')} | ${i.distance.toFixed(3)}`);
  });
  log();

  // ---------------------------------------------------------------------------------
  // SUMMARY BENCHMARK & EXECUTION TIMINGS
  // ---------------------------------------------------------------------------------
  const totalDuration = performance.now() - totalStartTime;
  timers.push({ name: "TOTAL PIPELINE DURATION", durationMs: totalDuration });

  log("===================================================================================");
  log("                         PERFORMANCE BENCHMARK TIMINGS                            ");
  log("===================================================================================");
  timers.forEach(t => {
    const pct = ((t.durationMs / totalDuration) * 100).toFixed(1);
    log(`  ${t.name.padEnd(40, ' ')} : ${t.durationMs.toFixed(2).padStart(8, ' ')} ms  (${pct.padStart(5, ' ')}%)`);
  });
  log("===================================================================================");
  log("                     QA & BIOPHYSICAL ANALYSIS COMPLETED                           ");
  log("===================================================================================");

  // Write log to scratch/qa_1atn.log
  const logFilePath = path.resolve(process.cwd(), 'scratch', 'qa_1atn.log');
  fs.writeFileSync(logFilePath, logLines.join('\n'), 'utf8');
  console.log(`\nLog report saved to: ${logFilePath}`);
}

runQA1ATN().catch(err => {
  console.error("[FATAL ERROR] QA Script Execution Failed:", err);
  process.exit(1);
});
