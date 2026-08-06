import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';

interface Atom {
  serial: number;
  name: string;
  resName: string;
  chainID: string;
  resSeq: number;
  iCode: string;
  x: number;
  y: number;
  z: number;
  occupancy: number;
  tempFactor: number;
  elem: string;
  altLoc: string;
  isHetero: boolean;
}

interface Residue {
  chainID: string;
  resSeq: number;
  iCode: string;
  resName: string;
  atoms: Atom[];
  N?: Atom;
  CA?: Atom;
  C?: Atom;
  O?: Atom;
  H?: { x: number; y: number; z: number };
  phi?: number;
  psi?: number;
  ssPDB?: string;
  ssQuick?: string;
  ssDSSP?: string;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// Vector math helpers
function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function mul(a: Vec3, scalar: number): Vec3 {
  return { x: a.x * scalar, y: a.y * scalar, z: a.z * scalar };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

function norm(a: Vec3): number {
  return Math.sqrt(dot(a, a));
}

function dist(a: Vec3, b: Vec3): number {
  return norm(sub(a, b));
}

function dihedral(p1: Vec3, p2: Vec3, p3: Vec3, p4: Vec3): number {
  const b1 = sub(p2, p1);
  const b2 = sub(p3, p2);
  const b3 = sub(p4, p3);

  const n1 = cross(b1, b2);
  const n2 = cross(b2, b3);

  const normB2 = norm(b2);
  if (normB2 === 0 || norm(n1) === 0 || norm(n2) === 0) return 0;

  const m = cross(n1, b2);
  const x = dot(n1, n2);
  const y = dot(m, n2) / normB2;

  return (Math.atan2(y, x) * 180) / Math.PI;
}

// Atomic weights for Center of Mass calculation
const ATOMIC_WEIGHTS: Record<string, number> = {
  H: 1.008, C: 12.011, N: 14.007, O: 15.999, S: 32.06, P: 30.974,
  F: 18.998, CL: 35.45, BR: 79.904, I: 126.90, MG: 24.305, ZN: 65.38,
  FE: 55.845, CA: 40.078, NA: 22.990, K: 39.098
};

function getMass(elem: string): number {
  return ATOMIC_WEIGHTS[elem.toUpperCase()] || 12.011;
}

// Standard Partial Charge Assignments (Amber ff99SB / CHARMM parameters)
function getPartialCharge(atom: Atom): number {
  const resName = atom.resName.trim().toUpperCase();
  const atomName = atom.name.trim().toUpperCase();
  const elem = atom.elem.trim().toUpperCase();

  // Backbone partial charges
  if (!atom.isHetero) {
    if (atomName === 'N') return -0.4177;
    if (atomName === 'H') return +0.2719;
    if (atomName === 'CA') return +0.0337;
    if (atomName === 'HA') return +0.0823;
    if (atomName === 'C') return +0.5973;
    if (atomName === 'O') return -0.5679;
  }

  // Charged Sidechains
  if (resName === 'ARG') {
    if (atomName === 'NH1' || atomName === 'NH2') return +0.513;
    if (atomName === 'NE') return -0.529;
    if (atomName === 'CZ') return +0.640;
    if (atomName.startsWith('HH') || atomName === 'HE') return +0.300;
  } else if (resName === 'LYS') {
    if (atomName === 'NZ') return -0.370;
    if (atomName.startsWith('HZ')) return +0.330;
  } else if (resName === 'ASP') {
    if (atomName === 'OD1' || atomName === 'OD2') return -0.603;
    if (atomName === 'CG') return +0.606;
  } else if (resName === 'GLU') {
    if (atomName === 'OE1' || atomName === 'OE2') return -0.603;
    if (atomName === 'CD') return +0.606;
  } else if (resName === 'HIS') {
    if (atomName === 'ND1' || atomName === 'NE2') return -0.350;
    if (atomName === 'CE1') return +0.200;
  }

  // Elementary formal charges fallback
  if (elem === 'N') return -0.15;
  if (elem === 'O') return -0.25;
  if (elem === 'S') return -0.10;
  if (elem === 'P') return +0.40;
  if (elem === 'CA' || elem === 'MG' || elem === 'ZN' || elem === 'FE') return +2.0;
  if (elem === 'NA' || elem === 'K') return +1.0;
  if (elem === 'CL' || elem === 'F' || elem === 'BR') return -1.0;

  return 0.0;
}

async function runQA() {
  const timings: Record<string, number> = {};
  const logLines: string[] = [];
  function log(msg: string) {
    console.log(msg);
    logLines.push(msg);
  }

  log("================================================================================");
  log("                     PDB 3I3D MOLECULAR QA COMPUTATION LOG                      ");
  log("================================================================================");
  log(`Execution Date/Time: ${new Date().toISOString()}`);
  log("");

  const tStart = performance.now();

  // ---------------------------------------------------------------------------
  // STEP 1: Fetch PDB 3I3D
  // ---------------------------------------------------------------------------
  log("--- [STEP 1] FETCHING PDB 3I3D FROM RCSB ---");
  const tFetchStart = performance.now();
  const pdbUrl = "https://files.rcsb.org/download/3I3D.pdb";
  log(`Fetching: ${pdbUrl}...`);

  const response = await fetch(pdbUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch 3I3D.pdb: ${response.status} ${response.statusText}`);
  }
  const rawPDB = await response.text();
  const tFetchEnd = performance.now();
  timings.fetchMs = tFetchEnd - tFetchStart;
  log(`Fetch Completed. Size: ${(rawPDB.length / 1024 / 1024).toFixed(2)} MB (${rawPDB.length} bytes)`);
  log(`Duration: ${timings.fetchMs.toFixed(2)} ms`);
  log("");

  // ---------------------------------------------------------------------------
  // STEP 2: Parsing PDB
  // ---------------------------------------------------------------------------
  log("--- [STEP 2] PARSING PDB DATA ---");
  const tParseStart = performance.now();

  const atoms: Atom[] = [];
  const helixRecords: string[] = [];
  const sheetRecords: string[] = [];
  const lines = rawPDB.split('\n');

  for (const line of lines) {
    if (line.startsWith("HELIX ")) {
      helixRecords.push(line);
    } else if (line.startsWith("SHEET ")) {
      sheetRecords.push(line);
    } else if (line.startsWith("ATOM  ") || line.startsWith("HETATM")) {
      const isHetero = line.startsWith("HETATM");
      const altLoc = line.substring(16, 17);
      
      // Filter out non-primary altLocs
      if (altLoc !== ' ' && altLoc !== 'A' && altLoc !== '1') continue;

      const serial = parseInt(line.substring(6, 11).trim() || "0", 10);
      const name = line.substring(12, 16);
      const resName = line.substring(17, 20).trim();
      const chainID = line.substring(21, 22).trim() || 'A';
      const resSeq = parseInt(line.substring(22, 26).trim() || "0", 10);
      const iCode = line.substring(26, 27).trim();
      const x = parseFloat(line.substring(30, 38));
      const y = parseFloat(line.substring(38, 46));
      const z = parseFloat(line.substring(46, 54));
      const occupancy = parseFloat(line.substring(54, 60) || "1.0");
      const tempFactor = parseFloat(line.substring(60, 66) || "0.0");
      let elem = line.substring(76, 78).trim().toUpperCase();
      if (!elem) {
        elem = name.trim().replace(/[0-9]/g, '').substring(0, 1);
      }

      atoms.push({
        serial, name, resName, chainID, resSeq, iCode, x, y, z,
        occupancy, tempFactor, elem, altLoc, isHetero
      });
    }
  }

  // Build Residue map
  const residueMap = new Map<string, Residue>();
  const residueList: Residue[] = [];

  for (const atom of atoms) {
    if (atom.isHetero && ['HOH', 'WAT', 'DOD'].includes(atom.resName)) continue;
    const key = `${atom.chainID}:${atom.resSeq}:${atom.iCode}`;
    if (!residueMap.has(key)) {
      const res: Residue = {
        chainID: atom.chainID,
        resSeq: atom.resSeq,
        iCode: atom.iCode,
        resName: atom.resName,
        atoms: []
      };
      residueMap.set(key, res);
      residueList.push(res);
    }
    const res = residueMap.get(key)!;
    res.atoms.push(atom);

    const cleanName = atom.name.trim();
    if (cleanName === 'N') res.N = atom;
    else if (cleanName === 'CA') res.CA = atom;
    else if (cleanName === 'C') res.C = atom;
    else if (cleanName === 'O') res.O = atom;
  }

  const tParseEnd = performance.now();
  timings.parseMs = tParseEnd - tParseStart;

  const chainIDs = Array.from(new Set(atoms.map(a => a.chainID)));
  const hetAtoms = atoms.filter(a => a.isHetero);
  const waterCount = hetAtoms.filter(a => ['HOH', 'WAT', 'DOD'].includes(a.resName)).length;
  const ligandAtoms = hetAtoms.filter(a => !['HOH', 'WAT', 'DOD'].includes(a.resName));

  log(`Parsed Atoms Total: ${atoms.length}`);
  log(`Protein Chains (${chainIDs.length}): [ ${chainIDs.join(', ')} ]`);
  log(`Total Protein Residues: ${residueList.length}`);
  log(`Water Molecules (HOH): ${waterCount}`);
  log(`Hetero/Ligand Atoms: ${ligandAtoms.length}`);
  log(`PDB HELIX Records: ${helixRecords.length}`);
  log(`PDB SHEET Records: ${sheetRecords.length}`);
  log(`Duration: ${timings.parseMs.toFixed(2)} ms`);
  log("");

  // ---------------------------------------------------------------------------
  // STEP 3: Secondary Structure Computation
  // ---------------------------------------------------------------------------
  log("--- [STEP 3] SECONDARY STRUCTURE CALCULATION ---");
  const tSSStart = performance.now();

  // 1. Assign PDB Secondary Structure
  for (const res of residueList) {
    res.ssPDB = 'loop';
  }

  for (const line of helixRecords) {
    const initChain = line.substring(19, 20).trim();
    const initSeq = parseInt(line.substring(21, 25).trim(), 10);
    const endChain = line.substring(31, 32).trim();
    const endSeq = parseInt(line.substring(33, 37).trim(), 10);

    for (const res of residueList) {
      if ((res.chainID === initChain || res.chainID === endChain) && res.resSeq >= initSeq && res.resSeq <= endSeq) {
        res.ssPDB = 'helix';
      }
    }
  }

  for (const line of sheetRecords) {
    const initChain = line.substring(21, 22).trim();
    const initSeq = parseInt(line.substring(22, 26).trim(), 10);
    const endChain = line.substring(32, 33).trim();
    const endSeq = parseInt(line.substring(33, 37).trim(), 10);

    for (const res of residueList) {
      if ((res.chainID === initChain || res.chainID === endChain) && res.resSeq >= initSeq && res.resSeq <= endSeq) {
        res.ssPDB = 'sheet';
      }
    }
  }

  // 2. Assign Quick Dihedral Secondary Structure
  // Compute phi/psi first for Quick SS assignment
  for (let i = 0; i < residueList.length; i++) {
    const curr = residueList[i];
    const prev = i > 0 ? residueList[i - 1] : undefined;
    const next = i < residueList.length - 1 ? residueList[i + 1] : undefined;

    if (prev && prev.chainID === curr.chainID && prev.C && curr.N && curr.CA && curr.C && dist(prev.C, curr.N) <= 2.0) {
      curr.phi = dihedral(prev.C, curr.N, curr.CA, curr.C);
    }
    if (next && next.chainID === curr.chainID && curr.N && curr.CA && curr.C && next.N && dist(curr.C, next.N) <= 2.0) {
      curr.psi = dihedral(curr.N, curr.CA, curr.C, next.N);
    }
  }

  for (const res of residueList) {
    if (res.phi !== undefined && res.psi !== undefined) {
      const phi = res.phi;
      const psi = res.psi;
      if (phi >= -140 && phi <= -40 && psi >= -70 && psi <= 20) {
        res.ssQuick = 'helix';
      } else if ((phi <= -40 || phi >= 140) && (psi >= 90 || psi <= -140)) {
        res.ssQuick = 'sheet';
      } else {
        res.ssQuick = 'loop';
      }
    } else {
      res.ssQuick = 'loop';
    }
  }

  // 3. Assign DSSP Electrostatic H-Bond Secondary Structure
  // Model amide H position: N-H vector is opposite to C=O of previous residue
  for (let i = 1; i < residueList.length; i++) {
    const curr = residueList[i];
    const prev = residueList[i - 1];
    if (curr.chainID === prev.chainID && curr.N && prev.C && prev.O && dist(prev.C, curr.N) <= 2.0) {
      const vCO = sub(prev.O, prev.C);
      const lenCO = norm(vCO);
      if (lenCO > 0) {
        curr.H = add(curr.N, mul(vCO, -1.0 / lenCO));
      }
    }
  }

  const hBondsDSSP = new Set<string>();
  const q1 = 0.42, q2 = 0.20, f = 332.0, eCutoff = -0.5;
  const nRes = residueList.length;

  for (let i = 0; i < nRes; i++) {
    const resI = residueList[i];
    if (!resI.C || !resI.O) continue;

    for (let j = 0; j < nRes; j++) {
      if (i === j) continue;
      const resJ = residueList[j];
      if (!resJ.N || !resJ.H) continue;
      if (resI.CA && resJ.CA && dist(resI.CA, resJ.CA) > 9.0) continue;

      const rON = dist(resI.O, resJ.N);
      const rCH = dist(resI.C, resJ.H);
      const rOH = dist(resI.O, resJ.H);
      const rCN = dist(resI.C, resJ.N);

      if (rON < 0.5 || rCH < 0.5 || rOH < 0.5 || rCN < 0.5) continue;

      const E = q1 * q2 * f * (1.0 / rON + 1.0 / rCH - 1.0 / rOH - 1.0 / rCN);
      if (E < eCutoff) {
        hBondsDSSP.add(`${i}->${j}`);
      }
    }
  }

  const isHelixDSSP = new Array(nRes).fill(false);
  for (let i = 0; i < nRes; i++) {
    if (hBondsDSSP.has(`${i}->${i + 4}`)) {
      for (let k = i; k <= i + 4 && k < nRes; k++) isHelixDSSP[k] = true;
    } else if (hBondsDSSP.has(`${i}->${i + 3}`)) {
      for (let k = i; k <= i + 3 && k < nRes; k++) isHelixDSSP[k] = true;
    }
  }

  const isBridgeDSSP = new Array(nRes).fill(false);
  for (let i = 0; i < nRes; i++) {
    for (let j = i + 3; j < nRes; j++) {
      const ap1 = hBondsDSSP.has(`${i}->${j}`) && hBondsDSSP.has(`${j}->${i}`);
      const ap2 = i > 0 && j < nRes - 1 && hBondsDSSP.has(`${i - 1}->${j + 1}`) && hBondsDSSP.has(`${j - 1}->${i + 1}`);
      if (ap1 || ap2) {
        isBridgeDSSP[i] = true;
        isBridgeDSSP[j] = true;
      }
    }
  }

  for (let i = 0; i < nRes; i++) {
    if (isHelixDSSP[i]) residueList[i].ssDSSP = 'helix';
    else if (isBridgeDSSP[i]) residueList[i].ssDSSP = 'sheet';
    else residueList[i].ssDSSP = 'loop';
  }

  const tSSEnd = performance.now();
  timings.ssMs = tSSEnd - tSSStart;

  // Counts summary
  const countPDB = { helix: 0, sheet: 0, loop: 0 };
  const countQuick = { helix: 0, sheet: 0, loop: 0 };
  const countDSSP = { helix: 0, sheet: 0, loop: 0 };

  for (const r of residueList) {
    countPDB[r.ssPDB as 'helix' | 'sheet' | 'loop']++;
    countQuick[r.ssQuick as 'helix' | 'sheet' | 'loop']++;
    countDSSP[r.ssDSSP as 'helix' | 'sheet' | 'loop']++;
  }

  log("Secondary Structure Breakdown Across Residues:");
  log(`  [PDB Header Records] : Helix=${countPDB.helix} (${(countPDB.helix/nRes*100).toFixed(1)}%), Sheet=${countPDB.sheet} (${(countPDB.sheet/nRes*100).toFixed(1)}%), Loop=${countPDB.loop} (${(countPDB.loop/nRes*100).toFixed(1)}%)`);
  log(`  [DSSP Electrostatic]: Helix=${countDSSP.helix} (${(countDSSP.helix/nRes*100).toFixed(1)}%), Sheet=${countDSSP.sheet} (${(countDSSP.sheet/nRes*100).toFixed(1)}%), Loop=${countDSSP.loop} (${(countDSSP.loop/nRes*100).toFixed(1)}%)`);
  log(`  [Quick Dihedral Map]: Helix=${countQuick.helix} (${(countQuick.helix/nRes*100).toFixed(1)}%), Sheet=${countQuick.sheet} (${(countQuick.sheet/nRes*100).toFixed(1)}%), Loop=${countQuick.loop} (${(countQuick.loop/nRes*100).toFixed(1)}%)`);
  log(`Duration: ${timings.ssMs.toFixed(2)} ms`);
  log("");

  // ---------------------------------------------------------------------------
  // STEP 4: Ramachandran Phi/Psi Angle Computation
  // ---------------------------------------------------------------------------
  log("--- [STEP 4] RAMACHANDRAN PHI/PSI ANGLES CALCULATION ---");
  const tRamaStart = performance.now();

  const validPairs: { res: Residue; phi: number; psi: number; region: string }[] = [];

  for (const res of residueList) {
    if (res.phi !== undefined && res.psi !== undefined) {
      const phi = res.phi;
      const psi = res.psi;
      let region = "Outlier/General";

      if (phi >= -160 && phi <= -30 && psi >= -70 && psi <= 10) {
        region = "Alpha-Helix (Favored)";
      } else if (phi >= -180 && phi <= -40 && (psi >= 80 || psi <= -140)) {
        region = "Beta-Sheet (Favored)";
      } else if (phi >= 30 && phi <= 100 && psi >= 0 && psi <= 100) {
        region = "Left-Handed Alpha (Favored)";
      } else if ((phi >= -180 && phi <= 0 && psi >= -100 && psi <= 180) || (phi >= 0 && phi <= 180 && psi >= -180 && psi <= 180)) {
        region = "Allowed Region";
      }

      validPairs.push({ res, phi, psi, region });
    }
  }

  const tRamaEnd = performance.now();
  timings.ramaMs = tRamaEnd - tRamaStart;

  const regionCounts: Record<string, number> = {};
  let sumPhi = 0, sumPsi = 0;
  let minPhi = Infinity, maxPhi = -Infinity, minPsi = Infinity, maxPsi = -Infinity;

  for (const p of validPairs) {
    regionCounts[p.region] = (regionCounts[p.region] || 0) + 1;
    sumPhi += p.phi;
    sumPsi += p.psi;
    if (p.phi < minPhi) minPhi = p.phi;
    if (p.phi > maxPhi) maxPhi = p.phi;
    if (p.psi < minPsi) minPsi = p.psi;
    if (p.psi > maxPsi) maxPsi = p.psi;
  }

  const avgPhi = validPairs.length ? sumPhi / validPairs.length : 0;
  const avgPsi = validPairs.length ? sumPsi / validPairs.length : 0;

  log(`Total Residues Evaluated for Dihedrals: ${validPairs.length} / ${nRes}`);
  log(`Phi Angle Summary (deg) : Mean = ${avgPhi.toFixed(2)}°, Min = ${minPhi.toFixed(2)}°, Max = ${maxPhi.toFixed(2)}°`);
  log(`Psi Angle Summary (deg) : Mean = ${avgPsi.toFixed(2)}°, Min = ${minPsi.toFixed(2)}°, Max = ${maxPsi.toFixed(2)}°`);
  log("Ramachandran Region Distributions:");
  for (const [reg, count] of Object.entries(regionCounts)) {
    log(`  - ${reg.padEnd(30, ' ')} : ${count.toString().padStart(5, ' ')} (${(count / validPairs.length * 100).toFixed(2)}%)`);
  }

  log("\nSample Ramachandran Angles (First 15 Residues Chain A):");
  log("Chain | ResSeq | ResName |   Phi (°)  |   Psi (°)  | Region");
  log("-------------------------------------------------------------------------");
  const samplePairs = validPairs.filter(p => p.res.chainID === 'A').slice(0, 15);
  for (const p of samplePairs) {
    log(`  ${p.res.chainID.padEnd(4)}| ${p.res.resSeq.toString().padStart(6)} | ${p.res.resName.padEnd(7)} | ${p.phi.toFixed(2).padStart(10)} | ${p.psi.toFixed(2).padStart(10)} | ${p.region}`);
  }
  log(`Duration: ${timings.ramaMs.toFixed(2)} ms`);
  log("");

  // ---------------------------------------------------------------------------
  // STEP 5: Dipole Moment Magnitude and Vector Computation
  // ---------------------------------------------------------------------------
  log("--- [STEP 5] DIPOLE MOMENT MAGNITUDE & VECTOR CALCULATION ---");
  const tDipoleStart = performance.now();

  function computeDipoleForAtoms(atomSet: Atom[]) {
    let totalMass = 0;
    let comX = 0, comY = 0, comZ = 0;

    for (const a of atomSet) {
      const m = getMass(a.elem);
      totalMass += m;
      comX += m * a.x;
      comY += m * a.y;
      comZ += m * a.z;
    }

    const com = { x: comX / totalMass, y: comY / totalMass, z: comZ / totalMass };

    let netCharge = 0;
    let dipX_eA = 0, dipY_eA = 0, dipZ_eA = 0;

    for (const a of atomSet) {
      const q = getPartialCharge(a);
      netCharge += q;
      dipX_eA += q * (a.x - com.x);
      dipY_eA += q * (a.y - com.y);
      dipZ_eA += q * (a.z - com.z);
    }

    // 1 e·Å = 4.803204 Debye
    const DEBYE_CONVERSION = 4.803204;
    const dipX_D = dipX_eA * DEBYE_CONVERSION;
    const dipY_D = dipY_eA * DEBYE_CONVERSION;
    const dipZ_D = dipZ_eA * DEBYE_CONVERSION;

    const mag_eA = Math.sqrt(dipX_eA * dipX_eA + dipY_eA * dipY_eA + dipZ_eA * dipZ_eA);
    const mag_D = mag_eA * DEBYE_CONVERSION;

    return {
      com,
      totalMass,
      netCharge,
      vector_eA: { x: dipX_eA, y: dipY_eA, z: dipZ_eA },
      vector_D: { x: dipX_D, y: dipY_D, z: dipZ_D },
      mag_eA,
      mag_D
    };
  }

  // Complex Dipole (all protein non-water atoms)
  const proteinAtoms = atoms.filter(a => !['HOH', 'WAT', 'DOD'].includes(a.resName));
  const complexDipole = computeDipoleForAtoms(proteinAtoms);

  const tDipoleEnd = performance.now();
  timings.dipoleMs = tDipoleEnd - tDipoleStart;

  log(`Whole Complex Atom Count (excluding water): ${proteinAtoms.length}`);
  log(`Total Mass: ${complexDipole.totalMass.toFixed(2)} Da`);
  log(`Center of Mass (COM): X=${complexDipole.com.x.toFixed(3)}, Y=${complexDipole.com.y.toFixed(3)}, Z=${complexDipole.com.z.toFixed(3)} Å`);
  log(`Estimated Net Charge: ${complexDipole.netCharge.toFixed(2)} e`);
  log(`Dipole Vector (e·Å): [ X=${complexDipole.vector_eA.x.toFixed(4)}, Y=${complexDipole.vector_eA.y.toFixed(4)}, Z=${complexDipole.vector_eA.z.toFixed(4)} ]`);
  log(`Dipole Vector (Debye): [ X=${complexDipole.vector_D.x.toFixed(2)}, Y=${complexDipole.vector_D.y.toFixed(2)}, Z=${complexDipole.vector_D.z.toFixed(2)} ]`);
  log(`Dipole Moment Magnitude: ${complexDipole.mag_D.toFixed(2)} Debye (${complexDipole.mag_eA.toFixed(2)} e·Å)`);

  log("\nPer-Chain Dipole Moments:");
  for (const cID of chainIDs) {
    const chainAtoms = proteinAtoms.filter(a => a.chainID === cID);
    if (chainAtoms.length === 0) continue;
    const chainDip = computeDipoleForAtoms(chainAtoms);
    log(`  Chain ${cID} (${chainAtoms.length} atoms): |µ| = ${chainDip.mag_D.toFixed(2)} Debye | Vector (Debye) = [${chainDip.vector_D.x.toFixed(1)}, ${chainDip.vector_D.y.toFixed(1)}, ${chainDip.vector_D.z.toFixed(1)}]`);
  }
  log(`Duration: ${timings.dipoleMs.toFixed(2)} ms`);
  log("");

  // ---------------------------------------------------------------------------
  // STEP 6: Interaction Contacts Computation
  // ---------------------------------------------------------------------------
  log("--- [STEP 6] INTERACTION CONTACTS CALCULATION ---");
  const tInterStart = performance.now();

  interface Contact {
    type: 'hbond' | 'saltbridge' | 'hydrophobic' | 'ligand_contact';
    atom1: Atom;
    atom2: Atom;
    distance: number;
  }

  const hbonds: Contact[] = [];
  const saltbridges: Contact[] = [];
  const hydrophobic: Contact[] = [];
  const ligandContacts: Contact[] = [];

  const basicRes = ['ARG', 'LYS', 'HIS'];
  const acidicRes = ['ASP', 'GLU'];
  const basicAtoms = ['NZ', 'NE', 'NH1', 'NH2', 'ND1', 'NE2'];
  const acidicAtoms = ['OD1', 'OD2', 'OE1', 'OE2'];

  const nonWaterAtoms = atoms.filter(a => !['HOH', 'WAT', 'DOD'].includes(a.resName));
  const ligandAtomList = nonWaterAtoms.filter(a => a.isHetero);
  const proteinAtomList = nonWaterAtoms.filter(a => !a.isHetero);

  // Grid spatial hashing for efficient contact search
  const cellSize = 5.0;
  const grid: Record<string, number[]> = {};
  function hash(x: number, y: number, z: number) {
    return `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)},${Math.floor(z / cellSize)}`;
  }

  for (let i = 0; i < nonWaterAtoms.length; i++) {
    const h = hash(nonWaterAtoms[i].x, nonWaterAtoms[i].y, nonWaterAtoms[i].z);
    if (!grid[h]) grid[h] = [];
    grid[h].push(i);
  }

  function getNeighborIndices(x: number, y: number, z: number): number[] {
    const cx = Math.floor(x / cellSize);
    const cy = Math.floor(y / cellSize);
    const cz = Math.floor(z / cellSize);
    const neighbors: number[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const h = `${cx + dx},${cy + dy},${cz + dz}`;
          if (grid[h]) neighbors.push(...grid[h]);
        }
      }
    }
    return neighbors;
  }

  for (let i = 0; i < nonWaterAtoms.length; i++) {
    const a1 = nonWaterAtoms[i];
    const neighbors = getNeighborIndices(a1.x, a1.y, a1.z);

    for (const j of neighbors) {
      if (j <= i) continue;
      const a2 = nonWaterAtoms[j];

      // Skip intra-residue contacts
      if (a1.chainID === a2.chainID && a1.resSeq === a2.resSeq && a1.isHetero === a2.isHetero) continue;

      const d = dist(a1, a2);
      if (d > 5.0) continue;

      // 1. Protein-Ligand contacts
      if (a1.isHetero !== a2.isHetero) {
        if (d <= 4.0) {
          ligandContacts.push({ type: 'ligand_contact', atom1: a1, atom2: a2, distance: d });
        }
      }

      const isPolar1 = ['N', 'O', 'S'].includes(a1.elem);
      const isPolar2 = ['N', 'O', 'S'].includes(a2.elem);

      // 2. Hydrogen Bonds (Distance < 3.5 Å between polar atoms)
      if (d >= 2.4 && d <= 3.5 && isPolar1 && isPolar2) {
        hbonds.push({ type: 'hbond', atom1: a1, atom2: a2, distance: d });
      }

      // 3. Salt Bridges (Distance <= 4.0 Å between opposite formal charges)
      if (d <= 4.0) {
        const isB1 = basicRes.includes(a1.resName) && basicAtoms.includes(a1.name.trim());
        const isA2 = acidicRes.includes(a2.resName) && acidicAtoms.includes(a2.name.trim());
        const isA1 = acidicRes.includes(a1.resName) && acidicAtoms.includes(a1.name.trim());
        const isB2 = basicRes.includes(a2.resName) && basicAtoms.includes(a2.name.trim());

        if ((isB1 && isA2) || (isA1 && isB2)) {
          saltbridges.push({ type: 'saltbridge', atom1: a1, atom2: a2, distance: d });
        }
      }

      // 4. Hydrophobic contacts (C-C nonpolar between residues separated by >= 3)
      if (d >= 3.2 && d <= 4.0 && a1.elem === 'C' && a2.elem === 'C') {
        const seqDiff = Math.abs(a1.resSeq - a2.resSeq);
        if (a1.chainID !== a2.chainID || seqDiff >= 3) {
          hydrophobic.push({ type: 'hydrophobic', atom1: a1, atom2: a2, distance: d });
        }
      }
    }
  }

  const tInterEnd = performance.now();
  timings.interMs = tInterEnd - tInterStart;

  log(`Hydrogen Bonds Detected (<3.5 Å polar): ${hbonds.length}`);
  log(`Salt Bridges Detected (<=4.0 Å acidic/basic): ${saltbridges.length}`);
  log(`Hydrophobic Contacts (C-C 3.2-4.0 Å): ${hydrophobic.length}`);
  log(`Protein-Ligand Contacts (<=4.0 Å): ${ligandContacts.length}`);

  log("\nSample Salt Bridges (Top 10):");
  log("Residue 1 (Chain:Seq:Res) | Atom 1 | Residue 2 (Chain:Seq:Res) | Atom 2 | Distance (Å)");
  log("------------------------------------------------------------------------------------");
  for (const sb of saltbridges.slice(0, 10)) {
    const r1 = `${sb.atom1.chainID}:${sb.atom1.resSeq}:${sb.atom1.resName}`.padEnd(25);
    const a1 = sb.atom1.name.trim().padEnd(7);
    const r2 = `${sb.atom2.chainID}:${sb.atom2.resSeq}:${sb.atom2.resName}`.padEnd(25);
    const a2 = sb.atom2.name.trim().padEnd(7);
    log(`${r1} | ${a1} | ${r2} | ${a2} | ${sb.distance.toFixed(3)} Å`);
  }

  log("\nSample Protein-Ligand Contacts (Top 10):");
  log("Ligand Atom (Res:Chain:Seq:Atom) | Protein Atom (Res:Chain:Seq:Atom) | Distance (Å)");
  log("------------------------------------------------------------------------------------");
  for (const lc of ligandContacts.slice(0, 10)) {
    const lig = lc.atom1.isHetero ? lc.atom1 : lc.atom2;
    const prot = lc.atom1.isHetero ? lc.atom2 : lc.atom1;
    const lStr = `${lig.resName}:${lig.chainID}:${lig.resSeq}:${lig.name.trim()}`.padEnd(30);
    const pStr = `${prot.resName}:${prot.chainID}:${prot.resSeq}:${prot.name.trim()}`.padEnd(30);
    log(`${lStr} | ${pStr} | ${lc.distance.toFixed(3)} Å`);
  }
  log(`Duration: ${timings.interMs.toFixed(2)} ms`);
  log("");

  // ---------------------------------------------------------------------------
  // STEP 7: Final Execution Time Summary
  // ---------------------------------------------------------------------------
  const tEnd = performance.now();
  timings.totalMs = tEnd - tStart;

  log("================================================================================");
  log("                     EXECUTION TIMING PERFORMANCE BREAKDOWN                     ");
  log("================================================================================");
  log(`1. HTTP Fetch Duration               : ${timings.fetchMs.toFixed(2).padStart(10)} ms  (${(timings.fetchMs/timings.totalMs*100).toFixed(1)}%)`);
  log(`2. PDB Parsing Duration              : ${timings.parseMs.toFixed(2).padStart(10)} ms  (${(timings.parseMs/timings.totalMs*100).toFixed(1)}%)`);
  log(`3. Secondary Structure Computation   : ${timings.ssMs.toFixed(2).padStart(10)} ms  (${(timings.ssMs/timings.totalMs*100).toFixed(1)}%)`);
  log(`4. Ramachandran Dihedral Angles      : ${timings.ramaMs.toFixed(2).padStart(10)} ms  (${(timings.ramaMs/timings.totalMs*100).toFixed(1)}%)`);
  log(`5. Dipole Moment Vector & Mag        : ${timings.dipoleMs.toFixed(2).padStart(10)} ms  (${(timings.dipoleMs/timings.totalMs*100).toFixed(1)}%)`);
  log(`6. Interaction Contacts Computation  : ${timings.interMs.toFixed(2).padStart(10)} ms  (${(timings.interMs/timings.totalMs*100).toFixed(1)}%)`);
  log("--------------------------------------------------------------------------------");
  log(`TOTAL QA PIPELINE EXECUTION TIME     : ${timings.totalMs.toFixed(2).padStart(10)} ms  (100.0%)`);
  log("================================================================================");
  log("STATUS: QA SUCCESSFUL");

  // Save log file to scratch/qa_3i3d.log
  const logFilePath = path.resolve('scratch/qa_3i3d.log');
  const logDir = path.dirname(logFilePath);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  fs.writeFileSync(logFilePath, logLines.join('\n'), 'utf8');
  console.log(`\nReport successfully written to ${logFilePath}`);
}

runQA().catch(err => {
  console.error("QA Execution Error:", err);
  process.exit(1);
});
