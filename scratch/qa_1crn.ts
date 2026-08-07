import fs from 'fs';
import path from 'path';
import { MolProcessor, Atom } from '../src/lib/MolProcessor';
import { SelectionParser } from '../src/lib/SelectionParser';

const PDB_URL = 'https://files.rcsb.org/download/1CRN.pdb';
const LOG_PATH = path.resolve(process.cwd(), 'scratch/qa_1crn.log');
const LOCAL_PDB_PATH = path.resolve(process.cwd(), 'scratch/1CRN.pdb');

// Vector 3D math helpers
interface Vec3 { x: number; y: number; z: number; }

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function norm(a: Vec3): number {
  return Math.sqrt(dot(a, a));
}

function dist(a: Vec3, b: Vec3): number {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2) + Math.pow(a.z - b.z, 2));
}

function angleBetween(h: Vec3, d: Vec3, a: Vec3): number {
  const vHD = sub(d, h);
  const vHA = sub(a, h);
  const dProd = dot(vHD, vHA);
  const nProduct = norm(vHD) * norm(vHA);
  if (nProduct === 0) return 0;
  const cos = dProd / nProduct;
  const clampedCos = Math.max(-1, Math.min(1, cos));
  return (Math.acos(clampedCos) * 180) / Math.PI;
}

// Dihedral angle calculation (in degrees [-180, 180])
function dihedral(p1: Vec3, p2: Vec3, p3: Vec3, p4: Vec3): number {
  const b1 = sub(p2, p1);
  const b2 = sub(p3, p2);
  const b3 = sub(p4, p3);

  const n1 = cross(b1, b2);
  const n2 = cross(b2, b3);

  const lenB2 = norm(b2);
  if (lenB2 === 0) return 0;

  const m1 = cross(n1, b2);
  const dotN = dot(n1, n2);
  const dotM = dot(m1, n2) / lenB2;

  return Math.atan2(-dotM, dotN) * (180.0 / Math.PI);
}

// Partial charge lookup table (AMBER force field defaults)
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
  return 0.00;
}

function getAtomicMass(elem: string): number {
  const clean = elem.trim().toUpperCase();
  switch (clean) {
    case 'H': return 1.008;
    case 'C': return 12.011;
    case 'N': return 14.007;
    case 'O': return 15.999;
    case 'P': return 30.974;
    case 'S': return 32.060;
    default: return 12.011;
  }
}

async function main() {
  const timings: Record<string, number> = {};
  const totalStartTime = performance.now();
  const logLines: string[] = [];

  function log(msg: string) {
    console.log(msg);
    logLines.push(msg);
  }

  log("=================================================================================");
  log("                  QA AUTOMATION REPORT: 1CRN STRUCTURAL ANALYSIS");
  log("=================================================================================");
  log(`Timestamp: ${new Date().toISOString()}`);
  log(`Target PDB: 1CRN (Crambin)`);
  log("");

  // STEP 1: FETCH PDB
  const tFetchStart = performance.now();
  let pdbText = "";
  if (fs.existsSync(LOCAL_PDB_PATH)) {
    log(`[STEP 1] Loading 1CRN.pdb from local disk cache (${LOCAL_PDB_PATH})...`);
    pdbText = fs.readFileSync(LOCAL_PDB_PATH, 'utf-8');
  } else {
    log(`[STEP 1] Fetching 1CRN.pdb from RCSB (${PDB_URL})...`);
    const resp = await fetch(PDB_URL);
    if (!resp.ok) {
      throw new Error(`Failed to fetch 1CRN.pdb: HTTP ${resp.status} ${resp.statusText}`);
    }
    pdbText = await resp.text();
    // Cache locally for convenience
    fs.mkdirSync(path.dirname(LOCAL_PDB_PATH), { recursive: true });
    fs.writeFileSync(LOCAL_PDB_PATH, pdbText, 'utf-8');
  }
  timings['pdb_fetch_ms'] = performance.now() - tFetchStart;
  log(`  ↳ Done in ${timings['pdb_fetch_ms'].toFixed(2)} ms. Raw PDB length: ${pdbText.length} bytes.`);
  log("");

  // STEP 2: PARSE PDB
  const tParseStart = performance.now();
  const processor = new MolProcessor(pdbText, 'pdb');
  processor.filterAltlocs();
  processor.assignBonds(1.1);
  timings['pdb_parse_ms'] = performance.now() - tParseStart;

  const totalAtoms = processor.atoms.length;
  const nonHAtoms = processor.atoms.filter(a => a.elem !== 'H');
  const heteroAtoms = processor.atoms.filter(a => a.isHetero);
  
  // Extract residue info
  const residueMap = new Map<string, { resName: string; resSeq: number; chainID: string; atoms: Atom[] }>();
  processor.atoms.forEach(a => {
    const key = `${a.chainID}:${a.resSeq}:${a.resName.trim()}`;
    if (!residueMap.has(key)) {
      residueMap.set(key, { resName: a.resName.trim(), resSeq: a.resSeq, chainID: a.chainID, atoms: [] });
    }
    residueMap.get(key)!.atoms.push(a);
  });
  const residues = Array.from(residueMap.values()).sort((a, b) => a.resSeq - b.resSeq);

  log("[STEP 2] PARSING & METADATA");
  log(`  - Total Atoms (including altloc filtered): ${totalAtoms}`);
  log(`  - Heavy Atoms: ${nonHAtoms.length}`);
  log(`  - Hetero Atoms: ${heteroAtoms.length}`);
  log(`  - Total Residues: ${residues.length} (Residue range: ${residues[0]?.resSeq} - ${residues[residues.length-1]?.resSeq})`);
  log(`  - Chain ID: ${residues[0]?.chainID}`);
  log(`  - Parse & Connectivity Duration: ${timings['pdb_parse_ms'].toFixed(2)} ms`);
  log("");

  // STEP 3: SECONDARY STRUCTURE CALCULATION
  const tSSStart = performance.now();
  
  // 3a. Quick method
  processor.calculateSecondaryStructure('quick');
  const quickSS = [...processor.ss_per_residue];

  // 3b. DSSP method
  processor.calculateSecondaryStructure('dssp');
  const dsspSS = [...processor.ss_per_residue];

  // 3c. PDB record method
  processor.calculateSecondaryStructure('pdb');
  const pdbSS = [...processor.ss_per_residue];

  timings['secondary_structure_ms'] = performance.now() - tSSStart;

  const countSS = (ssList: typeof quickSS) => {
    let helix = 0, sheet = 0, loop = 0, undetermined = 0;
    ssList.forEach(r => {
      if (r.ss_type === 'helix') helix++;
      else if (r.ss_type === 'sheet') sheet++;
      else if (r.ss_type === 'loop') loop++;
      else undetermined++;
    });
    return { helix, sheet, loop, undetermined };
  };

  const quickCounts = countSS(quickSS);
  const dsspCounts = countSS(dsspSS);
  const pdbCounts = countSS(pdbSS);

  log("[STEP 3] SECONDARY STRUCTURE CALCULATION");
  log(`  Duration: ${timings['secondary_structure_ms'].toFixed(2)} ms`);
  log(`  - PDB Record SS : Helix = ${pdbCounts.helix}, Sheet = ${pdbCounts.sheet}, Loop = ${pdbCounts.loop}`);
  log(`  - DSSP Model SS : Helix = ${dsspCounts.helix}, Sheet = ${dsspCounts.sheet}, Loop = ${dsspCounts.loop}`);
  log(`  - Quick Model SS: Helix = ${quickCounts.helix}, Sheet = ${quickCounts.sheet}, Loop = ${quickCounts.loop}`);
  log("");
  log("  Per-Residue Secondary Structure Assignment:");
  log("  --------------------------------------------------");
  log("  ResSeq | ResName | PDB SS   | DSSP SS  | Quick SS ");
  log("  --------------------------------------------------");
  for (let i = 0; i < dsspSS.length; i++) {
    const p = pdbSS[i]?.ss_type || 'n/a';
    const d = dsspSS[i]?.ss_type || 'n/a';
    const q = quickSS[i]?.ss_type || 'n/a';
    const resSeqStr = String(dsspSS[i].resi).padStart(6, ' ');
    const resNameStr = dsspSS[i].resName.padStart(7, ' ');
    log(`  ${resSeqStr} | ${resNameStr} | ${p.padEnd(8, ' ')} | ${d.padEnd(8, ' ')} | ${q.padEnd(8, ' ')}`);
  }
  log("  --------------------------------------------------");
  log("");

  // STEP 4: RAMACHANDRAN PHI/PSI ANGLES
  const tRamaStart = performance.now();
  const parser = new SelectionParser(processor.atoms);
  const ramaCommandResult = parser.evaluateCommand("ramachandran all");
  const ramaReport = ramaCommandResult.ramachandranReport || [];
  timings['ramachandran_ms'] = performance.now() - tRamaStart;

  const ramaFavored = ramaReport.filter(r => r.region === 'favored');
  const ramaAllowed = ramaReport.filter(r => r.region === 'allowed');
  const ramaOutliers = ramaReport.filter(r => r.region === 'outlier');
  const totalEvaluated = ramaReport.length;

  const pctFav = ((ramaFavored.length / totalEvaluated) * 100).toFixed(1);
  const pctAll = ((ramaAllowed.length / totalEvaluated) * 100).toFixed(1);
  const pctOut = ((ramaOutliers.length / totalEvaluated) * 100).toFixed(1);

  log("[STEP 4] RAMACHANDRAN PHI/PSI ANGLES");
  log(`  Duration: ${timings['ramachandran_ms'].toFixed(2)} ms`);
  log(`  Total Evaluated Residues: ${totalEvaluated}`);
  log(`  - Favored Region : ${ramaFavored.length} (${pctFav}%)`);
  log(`  - Allowed Region : ${ramaAllowed.length} (${pctAll}%)`);
  log(`  - Outliers       : ${ramaOutliers.length} (${pctOut}%)`);
  log("");
  log("  Per-Residue Ramachandran Dihedrals:");
  log("  ---------------------------------------------------------------");
  log("  ResSeq | ResName | Chain |    Phi (°) |    Psi (°) | Region    ");
  log("  ---------------------------------------------------------------");
  ramaReport.forEach(r => {
    const seq = String(r.resSeq).padStart(6, ' ');
    const name = r.resName.padStart(7, ' ');
    const chain = r.chainID.padStart(5, ' ');
    const phi = r.phi.toFixed(2).padStart(10, ' ');
    const psi = r.psi.toFixed(2).padStart(10, ' ');
    log(`  ${seq} | ${name} | ${chain} | ${phi} | ${psi} | ${r.region}`);
  });
  log("  ---------------------------------------------------------------");
  log("");

  // STEP 5: DIPOLE MOMENT CALCULATION
  const tDipoleStart = performance.now();
  let totalMass = 0;
  let com = { x: 0, y: 0, z: 0 };
  
  processor.atoms.forEach(a => {
    const m = getAtomicMass(a.elem);
    totalMass += m;
    com.x += a.x * m;
    com.y += a.y * m;
    com.z += a.z * m;
  });

  if (totalMass > 0) {
    com.x /= totalMass;
    com.y /= totalMass;
    com.z /= totalMass;
  }

  let netCharge = 0;
  let mux = 0, muy = 0, muz = 0;

  processor.atoms.forEach(a => {
    const q = getPartialCharge(a.name, a.elem);
    netCharge += q;
    const dx = a.x - com.x;
    const dy = a.y - com.y;
    const dz = a.z - com.z;
    mux += q * dx;
    muy += q * dy;
    muz += q * dz;
  });

  const muxDebye = mux * 4.8032;
  const muyDebye = muy * 4.8032;
  const muzDebye = muz * 4.8032;
  const magDebye = Math.sqrt(muxDebye * muxDebye + muyDebye * muyDebye + muzDebye * muzDebye);
  const magEAng = Math.sqrt(mux * mux + muy * muy + muz * muz);

  timings['dipole_moment_ms'] = performance.now() - tDipoleStart;

  log("[STEP 5] DIPOLE MOMENT MAGNITUDE & VECTOR");
  log(`  Duration: ${timings['dipole_moment_ms'].toFixed(2)} ms`);
  log(`  - Center of Mass (COM) : (${com.x.toFixed(4)}, ${com.y.toFixed(4)}, ${com.z.toFixed(4)}) Å`);
  log(`  - Total Molecular Mass : ${totalMass.toFixed(2)} amu`);
  log(`  - Net Ionic Charge     : ${netCharge.toFixed(2)} e`);
  log(`  - Dipole Vector (e·Å)  : (${mux.toFixed(4)}, ${muy.toFixed(4)}, ${muz.toFixed(4)}) e·Å`);
  log(`  - Dipole Vector (Debye): (${muxDebye.toFixed(4)}, ${muyDebye.toFixed(4)}, ${muzDebye.toFixed(4)}) Debye`);
  log(`  - Dipole Magnitude     : ${magDebye.toFixed(4)} Debye (${magEAng.toFixed(4)} e·Å)`);
  log("");

  // STEP 6: INTERACTION CONTACTS (H-BONDS, SALT BRIDGES, DISULFIDE BONDS, HYDROPHOBIC)
  const tInteractionsStart = performance.now();

  // 6a. DSSP Kabsch-Sander Electrostatic H-bonds
  const hbondCmdResult = parser.evaluateCommand("hbond_energy all");
  const dsspHBonds = hbondCmdResult.addHBonds || [];

  // 6b. Disulfide Bridges (Cys SG - Cys SG distance < 2.5 Å)
  const cysSGAtoms = processor.atoms.filter(a => a.resName.trim() === 'CYS' && a.name.trim() === 'SG');
  const disulfideBonds: { res1: number; res2: number; distance: number }[] = [];
  for (let i = 0; i < cysSGAtoms.length; i++) {
    for (let j = i + 1; j < cysSGAtoms.length; j++) {
      const d = dist(cysSGAtoms[i], cysSGAtoms[j]);
      if (d <= 2.5) {
        disulfideBonds.push({
          res1: cysSGAtoms[i].resSeq,
          res2: cysSGAtoms[j].resSeq,
          distance: d
        });
      }
    }
  }

  // 6c. Geometric Intra-protein H-bonds
  // Ensure modeled hydrogens exist for angle checks
  const procH = new MolProcessor(pdbText, 'pdb');
  procH.filterAltlocs();
  procH.assignBonds(1.1);
  procH.addHydrogens();
  procH.assignBonds(1.1);

  const geometricHBonds: {
    donor: Atom;
    acceptor: Atom;
    distance: number;
    angle: number;
  }[] = [];

  const polarAtoms = procH.atoms.filter(a => ['N', 'O', 'S'].includes(a.elem));
  for (let i = 0; i < polarAtoms.length; i++) {
    const a1 = polarAtoms[i];
    for (let j = i + 1; j < polarAtoms.length; j++) {
      const a2 = polarAtoms[j];
      if (a1.chainID === a2.chainID && Math.abs(a1.resSeq - a2.resSeq) < 2) continue; // skip immediate neighbors

      const d = dist(a1, a2);
      if (d >= 2.5 && d <= 3.5) {
        // Case 1: a1 is donor (has H), a2 is acceptor
        const h1List = a1.bonds.map(bIdx => procH.atoms[bIdx]).filter(h => h && h.elem === 'H');
        for (const h of h1List) {
          const ang = angleBetween(h, a1, a2);
          if (ang >= 120.0) {
            geometricHBonds.push({ donor: a1, acceptor: a2, distance: d, angle: ang });
            break;
          }
        }

        // Case 2: a2 is donor (has H), a1 is acceptor
        const h2List = a2.bonds.map(bIdx => procH.atoms[bIdx]).filter(h => h && h.elem === 'H');
        for (const h of h2List) {
          const ang = angleBetween(h, a2, a1);
          if (ang >= 120.0) {
            geometricHBonds.push({ donor: a2, acceptor: a1, distance: d, angle: ang });
            break;
          }
        }
      }
    }
  }

  // 6d. Intra-protein Salt Bridges
  const basicRes = ['LYS', 'ARG', 'HIS'];
  const acidicRes = ['ASP', 'GLU'];
  const basicAtoms = ['NZ', 'NE', 'NH1', 'NH2', 'ND1', 'NE2'];
  const acidicAtoms = ['OD1', 'OD2', 'OE1', 'OE2'];

  const saltBridges: { basic: Atom; acidic: Atom; distance: number }[] = [];
  const bAtoms = processor.atoms.filter(a => basicRes.includes(a.resName.trim()) && basicAtoms.includes(a.name.trim()));
  const aAtoms = processor.atoms.filter(a => acidicRes.includes(a.resName.trim()) && acidicAtoms.includes(a.name.trim()));

  for (const b of bAtoms) {
    for (const a of aAtoms) {
      const d = dist(b, a);
      if (d <= 4.0) {
        saltBridges.push({ basic: b, acidic: a, distance: d });
      }
    }
  }

  timings['interaction_contacts_ms'] = performance.now() - tInteractionsStart;

  log("[STEP 6] INTERACTION CONTACTS");
  log(`  Duration: ${timings['interaction_contacts_ms'].toFixed(2)} ms`);
  log(`  - Disulfide Bonds (Cys-Cys SS): ${disulfideBonds.length}`);
  disulfideBonds.forEach(ss => {
    log(`    • CYS ${ss.res1} - CYS ${ss.res2} (S-S dist = ${ss.distance.toFixed(3)} Å)`);
  });

  log(`  - Intra-chain Geometric H-Bonds (2.5-3.5 Å, angle >= 120°): ${geometricHBonds.length}`);
  log(`  - DSSP Electrostatic H-Bonds (E < -0.5 kcal/mol): ${dsspHBonds.length}`);
  log(`  - Salt Bridges (Basic ... Acidic <= 4.0 Å): ${saltBridges.length}`);
  saltBridges.forEach(sb => {
    log(`    • ${sb.basic.resName} ${sb.basic.resSeq} (${sb.basic.name.trim()}) <--> ${sb.acidic.resName} ${sb.acidic.resSeq} (${sb.acidic.name.trim()}) [d = ${sb.distance.toFixed(3)} Å]`);
  });
  log("");

  log("  DSSP Electrostatic H-Bond Contact Detail Sample (Top 15):");
  log("  ---------------------------------------------------------------------------------");
  log("  Donor Atom                   --> Acceptor Atom                | Dist (Å) | E (kcal/mol)");
  log("  ---------------------------------------------------------------------------------");
  dsspHBonds.slice(0, 15).forEach(hb => {
    const dStr = hb.donorLabel.padEnd(28, ' ');
    const aStr = hb.acceptorLabel.padEnd(28, ' ');
    const distStr = hb.distance.toFixed(2).padStart(8, ' ');
    const energyStr = hb.energy.toFixed(2).padStart(12, ' ');
    log(`  ${dStr} --> ${aStr} | ${distStr} | ${energyStr}`);
  });
  if (dsspHBonds.length > 15) {
    log(`  ... (${dsspHBonds.length - 15} more DSSP H-bonds omitted)`);
  }
  log("  ---------------------------------------------------------------------------------");
  log("");

  // STEP 7: SUMMARY TIMING BENCHMARK
  const totalDuration = performance.now() - totalStartTime;
  timings['total_ms'] = totalDuration;

  log("[STEP 7] EXECUTION TIME BENCHMARK SUMMARY");
  log("  -------------------------------------------------------------");
  log("  Stage / Operation                       | Duration (ms)");
  log("  -------------------------------------------------------------");
  log(`  1. PDB Fetch / Load                      | ${timings['pdb_fetch_ms'].toFixed(2).padStart(10, ' ')} ms`);
  log(`  2. PDB Parsing & Connectivity            | ${timings['pdb_parse_ms'].toFixed(2).padStart(10, ' ')} ms`);
  log(`  3. Secondary Structure (DSSP/Quick/PDB)  | ${timings['secondary_structure_ms'].toFixed(2).padStart(10, ' ')} ms`);
  log(`  4. Ramachandran Phi/Psi Angle Calculation | ${timings['ramachandran_ms'].toFixed(2).padStart(10, ' ')} ms`);
  log(`  5. Dipole Moment Vector & Magnitude      | ${timings['dipole_moment_ms'].toFixed(2).padStart(10, ' ')} ms`);
  log(`  6. Interaction Contacts (H-Bonds/SS/SB)  | ${timings['interaction_contacts_ms'].toFixed(2).padStart(10, ' ')} ms`);
  log("  -------------------------------------------------------------");
  log(`  TOTAL EXECUTION DURATION                | ${totalDuration.toFixed(2).padStart(10, ' ')} ms`);
  log("  -------------------------------------------------------------");
  log("");
  log("=================================================================================");
  log("                        END OF QA REPORT FOR 1CRN");
  log("=================================================================================");

  // Write complete log output to scratch/qa_1crn.log
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.writeFileSync(LOG_PATH, logLines.join('\n'), 'utf-8');
  console.log(`\nReport successfully saved to ${LOG_PATH}`);
}

main().catch(err => {
  console.error("FATAL: Error running 1CRN QA script:", err);
  process.exit(1);
});
