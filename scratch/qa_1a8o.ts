import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';

interface Atom {
  serial: number;
  name: string;
  resName: string;
  chainID: string;
  resSeq: number;
  x: number;
  y: number;
  z: number;
  elem: string;
  altLoc: string;
  isHetero: boolean;
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface Residue {
  key: string;
  chainID: string;
  resSeq: number;
  resName: string;
  atoms: Atom[];
  N?: Atom;
  CA?: Atom;
  C?: Atom;
  O?: Atom;
  ssHeader: string;
  ssGeom: string;
  ssDssp: string;
}

interface RamaResidue {
  chainID: string;
  resSeq: number;
  resName: string;
  phi: number;
  psi: number;
  region: 'favored' | 'allowed' | 'outlier';
}

interface InteractionContact {
  type: 'hbond' | 'saltbridge' | 'disulfide' | 'hydrophobic' | 'close_contact';
  res1: string;
  atom1: string;
  res2: string;
  atom2: string;
  distance: number;
  details?: string;
}

// Atomic mass lookup
function getAtomicMass(elem: string): number {
  const el = elem.trim().toUpperCase();
  switch (el) {
    case 'H': return 1.008;
    case 'C': return 12.011;
    case 'N': return 14.007;
    case 'O': return 15.999;
    case 'P': return 30.974;
    case 'S': return 32.060;
    case 'SE': return 78.960;
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

// Partial charge lookup table based on AMBER force field parameters
const AMBER_CHARGES: Record<string, number> = {
  "N": -0.47, "H": 0.31, "CA": 0.07, "C": 0.51, "O": -0.51,
  "NZ": 1.00, "NH1": 0.40, "NH2": 0.40, "NE": -0.05,
  "OD1": -0.80, "OD2": -0.80, "OE1": -0.80, "OE2": -0.80,
  "SG": -0.20, "SE": -0.20, "OH": -0.40, "ND1": -0.36, "NE2": -0.36
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
  if (cleanElem === 'S' || cleanElem === 'SE') return -0.20;
  if (cleanElem === 'P') return 0.40;
  return 0.00;
}

// Vector helper functions
function dist(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function calculateDihedral(a: Vec3, b: Vec3, c: Vec3, d: Vec3): number {
  const b1 = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const b2 = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const b3 = { x: d.x - c.x, y: d.y - c.y, z: d.z - c.z };
  const n1 = { x: b1.y * b2.z - b1.z * b2.y, y: b1.z * b2.x - b1.x * b2.z, z: b1.x * b2.y - b1.y * b2.x };
  const n2 = { x: b2.y * b3.z - b2.z * b3.y, y: b2.z * b3.x - b2.x * b3.z, z: b2.x * b3.y - b2.y * b3.x };
  const lenB2 = Math.sqrt(b2.x * b2.x + b2.y * b2.y + b2.z * b2.z);
  const m1 = { x: n1.y * b2.z - n1.z * b2.y, y: n1.z * b2.x - n1.x * b2.z, z: n1.x * b2.y - n1.y * b2.x };
  const dotN = n1.x * n2.x + n1.y * n2.y + n1.z * n2.z;
  const dotM = lenB2 > 0 ? (m1.x * n2.x + m1.y * n2.y + m1.z * n2.z) / lenB2 : 0;
  return Math.atan2(-dotM, dotN) * (180.0 / Math.PI);
}

function classifyRamachandranRegion(phi: number, psi: number): 'favored' | 'allowed' | 'outlier' {
  if (phi === 360 || psi === 360) return 'allowed';
  // Alpha helix core
  if (phi >= -100 && phi <= -30 && psi >= -70 && psi <= -10) return 'favored';
  // Beta sheet core
  if (phi >= -160 && phi <= -50 && (psi >= 90 && psi <= 180 || psi >= -180 && psi <= -160)) return 'favored';
  // Left-handed alpha helix core
  if (phi >= 30 && phi <= 90 && psi >= 20 && psi <= 90) return 'favored';
  // Outer allowed contours
  if (phi >= -120 && phi <= -10 && psi >= -90 && psi <= 10) return 'allowed';
  if (phi >= -180 && phi <= -30 && (psi >= 70 && psi <= 180 || psi >= -180 && psi <= -140)) return 'allowed';
  if (phi >= 10 && phi <= 110 && psi >= 0 && psi <= 110) return 'allowed';
  return 'outlier';
}

async function main() {
  const startTime = performance.now();
  const logLines: string[] = [];

  const log = (msg: string) => {
    console.log(msg);
    logLines.push(msg);
  };

  log("================================================================================");
  log("        BIOPHYSICAL ANALYSIS REPORT FOR PDB 1A8O (HIV CAPSID C-TERMINAL DOMAIN)");
  log("================================================================================\n");

  // 1. Fetch PDB file from files.rcsb.org if not locally cached
  const pdbPath = path.join(process.cwd(), 'scratch', '1A8O.pdb');
  let pdbText = '';

  if (fs.existsSync(pdbPath)) {
    log(`[1/6] Loading 1A8O.pdb from local file: ${pdbPath}`);
    pdbText = fs.readFileSync(pdbPath, 'utf-8');
  } else {
    log(`[1/6] Fetching 1A8O.pdb from files.rcsb.org...`);
    const url = 'https://files.rcsb.org/download/1A8O.pdb';
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Failed to fetch 1A8O.pdb: ${resp.statusText}`);
    }
    pdbText = await resp.text();
    // Ensure scratch dir exists
    const scratchDir = path.join(process.cwd(), 'scratch');
    if (!fs.existsSync(scratchDir)) {
      fs.mkdirSync(scratchDir, { recursive: true });
    }
    fs.writeFileSync(pdbPath, pdbText, 'utf-8');
    log(`Saved downloaded PDB to ${pdbPath}`);
  }

  log(`PDB File Size: ${pdbText.length} bytes\n`);

  // 2. Parse PDB Structure
  log("--- [2/6] Structure Parsing & Metadata Extraction ---");
  const atoms: Atom[] = [];
  const helixHeaderRecords: { initSeq: number; endSeq: number; chainID: string; helixClass: number }[] = [];
  const sheetHeaderRecords: { initSeq: number; endSeq: number; chainID: string }[] = [];
  const ssbondRecords: string[] = [];
  let headerTitle = '';

  const rawLines = pdbText.split('\n');
  for (const line of rawLines) {
    const cleanLine = line.replace(/\r/g, '');
    if (cleanLine.startsWith('TITLE')) {
      headerTitle += cleanLine.substring(10).trim() + ' ';
    } else if (cleanLine.startsWith('HELIX')) {
      const chainID = cleanLine.substring(19, 20).trim();
      const initSeq = parseInt(cleanLine.substring(21, 25).trim(), 10);
      const endSeq = parseInt(cleanLine.substring(33, 37).trim(), 10);
      const helixClass = parseInt(cleanLine.substring(38, 40).trim(), 10) || 1;
      helixHeaderRecords.push({ initSeq, endSeq, chainID, helixClass });
    } else if (cleanLine.startsWith('SHEET')) {
      const chainID = cleanLine.substring(21, 22).trim();
      const initSeq = parseInt(cleanLine.substring(22, 26).trim(), 10);
      const endSeq = parseInt(cleanLine.substring(33, 37).trim(), 10);
      sheetHeaderRecords.push({ initSeq, endSeq, chainID });
    } else if (cleanLine.startsWith('SSBOND')) {
      ssbondRecords.push(cleanLine);
    } else if (cleanLine.startsWith('ATOM  ') || cleanLine.startsWith('HETATM')) {
      const isHetero = cleanLine.startsWith('HETATM');
      const serial = parseInt(cleanLine.substring(6, 11).trim() || "0", 10);
      const name = cleanLine.substring(12, 16);
      const altLoc = cleanLine.substring(16, 17);
      const resName = cleanLine.substring(17, 20).trim();
      const chainID = cleanLine.substring(21, 22);
      const resSeq = parseInt(cleanLine.substring(22, 26).trim() || "0", 10);
      const x = parseFloat(cleanLine.substring(30, 38));
      const y = parseFloat(cleanLine.substring(38, 46));
      const z = parseFloat(cleanLine.substring(46, 54));
      let elem = cleanLine.substring(76, 78).trim().toUpperCase();
      if (!elem) {
        elem = name.replace(/[0-9]/g, '').trim().substring(0, 1);
      }

      // Filter alternate locations: keep ' ' or 'A' or '1'
      if (altLoc === ' ' || altLoc === 'A' || altLoc === '1') {
        atoms.push({ serial, name, resName, chainID, resSeq, x, y, z, elem, altLoc, isHetero });
      }
    }
  }

  log(`Structure Title: ${headerTitle.trim()}`);
  log(`Total Parsed Atoms: ${atoms.length}`);
  log(`Header HELIX Annotations: ${helixHeaderRecords.length}`);
  log(`Header SHEET Annotations: ${sheetHeaderRecords.length}`);
  log(`SSBOND Annotations: ${ssbondRecords.length}`);
  if (ssbondRecords.length > 0) {
    ssbondRecords.forEach(s => log(`  ${s}`));
  }

  // Group atoms into residues
  const residuesMap = new Map<string, Residue>();
  const residuesList: Residue[] = [];

  atoms.forEach(a => {
    const key = `${a.chainID}:${a.resSeq}:${a.resName}`;
    if (!residuesMap.has(key)) {
      const res: Residue = {
        key,
        chainID: a.chainID,
        resSeq: a.resSeq,
        resName: a.resName,
        atoms: [],
        ssHeader: 'loop',
        ssGeom: 'loop',
        ssDssp: 'loop'
      };
      residuesMap.set(key, res);
      residuesList.push(res);
    }
    const res = residuesMap.get(key)!;
    res.atoms.push(a);

    const cleanAtomName = a.name.trim();
    if (cleanAtomName === 'N') res.N = a;
    else if (cleanAtomName === 'CA') res.CA = a;
    else if (cleanAtomName === 'C') res.C = a;
    else if (cleanAtomName === 'O') res.O = a;
  });

  log(`Total Non-Water Residues: ${residuesList.length}`);
  const chainIDs = Array.from(new Set(residuesList.map(r => r.chainID)));
  log(`Chains Identified: ${chainIDs.join(', ')} (Residues ${residuesList[0].resSeq} to ${residuesList[residuesList.length - 1].resSeq})\n`);

  // 3. Secondary Structure Analysis
  log("--- [3/6] Secondary Structure Assignment ---");
  // A. PDB Header Annotation
  residuesList.forEach(res => {
    for (const h of helixHeaderRecords) {
      if (res.chainID === h.chainID && res.resSeq >= h.initSeq && res.resSeq <= h.endSeq) {
        res.ssHeader = 'helix';
        break;
      }
    }
    for (const s of sheetHeaderRecords) {
      if (res.chainID === s.chainID && res.resSeq >= s.initSeq && res.resSeq <= s.endSeq) {
        res.ssHeader = 'sheet';
        break;
      }
    }
  });

  // B. Backbone Geometry-based SS (Quick Method)
  const nRes = residuesList.length;
  for (let i = 1; i < nRes - 1; i++) {
    const prev = residuesList[i - 1];
    const curr = residuesList[i];
    const next = residuesList[i + 1];

    if (prev.chainID !== curr.chainID || next.chainID !== curr.chainID) continue;
    if (!prev.C || !curr.N || !curr.CA || !curr.C || !next.N) continue;
    if (dist(prev.C, curr.N) > 2.2 || dist(curr.C, next.N) > 2.2) continue;

    const phi = calculateDihedral(prev.C, curr.N, curr.CA, curr.C);
    const psi = calculateDihedral(curr.N, curr.CA, curr.C, next.N);

    if (phi >= -140 && phi <= -40 && psi >= -70 && psi <= 20) {
      curr.ssGeom = 'helix';
    } else if ((phi <= -40 || phi >= 140) && (psi >= 90 || psi <= -140)) {
      curr.ssGeom = 'sheet';
    }
  }

  // Smooth runs & filter short elements
  for (let i = 1; i < nRes - 1; i++) {
    if (residuesList[i - 1].ssGeom === residuesList[i + 1].ssGeom &&
        residuesList[i - 1].ssGeom !== 'loop' && residuesList[i].ssGeom === 'loop') {
      residuesList[i].ssGeom = residuesList[i - 1].ssGeom;
    }
  }

  const ssHeaderCounts = { helix: 0, sheet: 0, loop: 0 };
  const ssGeomCounts = { helix: 0, sheet: 0, loop: 0 };

  residuesList.forEach(r => {
    ssHeaderCounts[r.ssHeader as keyof typeof ssHeaderCounts]++;
    ssGeomCounts[r.ssGeom as keyof typeof ssGeomCounts]++;
  });

  log("Secondary Structure Summary:");
  log(`  PDB Header Assignment:`);
  log(`    - Helices: ${ssHeaderCounts.helix} residues (${((ssHeaderCounts.helix / nRes) * 100).toFixed(1)}%)`);
  log(`    - Sheets:  ${ssHeaderCounts.sheet} residues (${((ssHeaderCounts.sheet / nRes) * 100).toFixed(1)}%)`);
  log(`    - Loops:   ${ssHeaderCounts.loop} residues (${((ssHeaderCounts.loop / nRes) * 100).toFixed(1)}%)`);
  log(`  Backbone Geometry Assignment:`);
  log(`    - Helices: ${ssGeomCounts.helix} residues (${((ssGeomCounts.helix / nRes) * 100).toFixed(1)}%)`);
  log(`    - Sheets:  ${ssGeomCounts.sheet} residues (${((ssGeomCounts.sheet / nRes) * 100).toFixed(1)}%)`);
  log(`    - Loops:   ${ssGeomCounts.loop} residues (${((ssGeomCounts.loop / nRes) * 100).toFixed(1)}%)`);

  log("\nAnnotated Helices from Header:");
  helixHeaderRecords.forEach((h, idx) => {
    log(`  Helix ${idx + 1}: Residues ${h.initSeq} -> ${h.endSeq} (Chain ${h.chainID}, Class ${h.helixClass})`);
  });
  log("");

  // 4. Ramachandran Phi/Psi Angles
  log("--- [4/6] Ramachandran Torsion Angle Computation ---");
  const ramaResults: RamaResidue[] = [];
  let favoredCount = 0;
  let allowedCount = 0;
  let outlierCount = 0;

  for (let i = 0; i < nRes; i++) {
    const curr = residuesList[i];
    const prev = i > 0 && residuesList[i - 1].chainID === curr.chainID && (curr.resSeq - residuesList[i - 1].resSeq <= 2) ? residuesList[i - 1] : null;
    const next = i < nRes - 1 && residuesList[i + 1].chainID === curr.chainID && (residuesList[i + 1].resSeq - curr.resSeq <= 2) ? residuesList[i + 1] : null;

    let phi = 360;
    let psi = 360;

    if (curr.N && curr.CA && curr.C) {
      if (prev && prev.C) {
        phi = calculateDihedral(prev.C, curr.N, curr.CA, curr.C);
      }
      if (next && next.N) {
        psi = calculateDihedral(curr.N, curr.CA, curr.C, next.N);
      }
    }

    if (phi !== 360 || psi !== 360) {
      const region = classifyRamachandranRegion(phi, psi);
      if (region === 'favored') favoredCount++;
      else if (region === 'allowed') allowedCount++;
      else outlierCount++;

      ramaResults.push({
        chainID: curr.chainID,
        resSeq: curr.resSeq,
        resName: curr.resName,
        phi,
        psi,
        region
      });
    }
  }

  const totalEvaluated = ramaResults.length;
  log(`Total Backbone Residues Evaluated: ${totalEvaluated}`);
  log(`  - Favored Region: ${favoredCount} (${((favoredCount / totalEvaluated) * 100).toFixed(1)}%)`);
  log(`  - Allowed Region: ${allowedCount} (${((allowedCount / totalEvaluated) * 100).toFixed(1)}%)`);
  log(`  - Outliers:       ${outlierCount} (${((outlierCount / totalEvaluated) * 100).toFixed(1)}%)`);

  log("\nPer-Residue Ramachandran Angle Table (Sample / Selected Residues):");
  log("Residue      Chain  ResSeq  Phi (deg)   Psi (deg)   Region");
  log("------------------------------------------------------------");
  ramaResults.slice(0, 25).forEach(r => {
    const phiStr = r.phi === 360 ? "    N/A  " : r.phi.toFixed(2).padStart(9, ' ');
    const psiStr = r.psi === 360 ? "    N/A  " : r.psi.toFixed(2).padStart(9, ' ');
    log(`${r.resName.padEnd(10, ' ')} ${r.chainID.padEnd(6, ' ')} ${r.resSeq.toString().padStart(6, ' ')} ${phiStr} ${psiStr}   ${r.region}`);
  });
  log(`... and ${ramaResults.length - 25} more residues evaluated.\n`);

  // 5. Dipole Moment Calculation
  log("--- [5/6] Molecular Dipole Moment & Center of Mass ---");
  let totalMass = 0;
  let comX = 0, comY = 0, comZ = 0;

  // Calculate Center of Mass over all non-hetero or all non-water protein atoms
  const validAtoms = atoms.filter(a => a.resName !== 'HOH' && a.resName !== 'WAT');
  validAtoms.forEach(a => {
    const m = getAtomicMass(a.elem);
    totalMass += m;
    comX += a.x * m;
    comY += a.y * m;
    comZ += a.z * m;
  });

  if (totalMass > 0) {
    comX /= totalMass;
    comY /= totalMass;
    comZ /= totalMass;
  }

  let netCharge = 0;
  let mux = 0, muy = 0, muz = 0;

  validAtoms.forEach(a => {
    const q = getPartialCharge(a.name, a.elem);
    netCharge += q;
    const dx = a.x - comX;
    const dy = a.y - comY;
    const dz = a.z - comZ;
    mux += q * dx;
    muy += q * dy;
    muz += q * dz;
  });

  const DEBYE_PER_E_ANGSTROM = 4.8032;
  const muxDebye = mux * DEBYE_PER_E_ANGSTROM;
  const muyDebye = muy * DEBYE_PER_E_ANGSTROM;
  const muzDebye = muz * DEBYE_PER_E_ANGSTROM;
  const magnitudeDebye = Math.sqrt(muxDebye * muxDebye + muyDebye * muyDebye + muzDebye * muzDebye);
  const magnitudeEAng = Math.sqrt(mux * mux + muy * muy + muz * muz);

  log(`Number of Atoms in Calculation: ${validAtoms.length}`);
  log(`Total Mass: ${totalMass.toFixed(2)} amu (g/mol)`);
  log(`Center of Mass (COM): (${comX.toFixed(3)}, ${comY.toFixed(3)}, ${comZ.toFixed(3)}) Å`);
  log(`Net Ionic Charge: ${netCharge.toFixed(2)} e`);
  log(`Dipole Vector (e·Å):  (${mux.toFixed(3)}, ${muy.toFixed(3)}, ${muz.toFixed(3)}) e·Å`);
  log(`Dipole Vector (Debye): (${muxDebye.toFixed(3)}, ${muyDebye.toFixed(3)}, ${muzDebye.toFixed(3)}) Debye`);
  log(`Dipole Vector Magnitude: ${magnitudeDebye.toFixed(3)} Debye (${magnitudeEAng.toFixed(3)} e·Å)\n`);

  // 6. Interaction Contacts
  log("--- [6/6] Intramolecular Interaction Contacts ---");
  const contacts: InteractionContact[] = [];

  // Heavy atom interactions
  const heavyAtoms = validAtoms.filter(a => a.elem !== 'H');

  for (let i = 0; i < heavyAtoms.length; i++) {
    const a1 = heavyAtoms[i];
    for (let j = i + 1; j < heavyAtoms.length; j++) {
      const a2 = heavyAtoms[j];
      // Skip atoms within the same residue or adjacent residues if too close
      if (a1.chainID === a2.chainID && Math.abs(a1.resSeq - a2.resSeq) < 2) continue;

      const d = dist(a1, a2);
      if (d > 4.2) continue;

      const r1Str = `${a1.resName} ${a1.resSeq} ${a1.chainID}`;
      const r2Str = `${a2.resName} ${a2.resSeq} ${a2.chainID}`;

      // A. Disulfide Bridge / Selenium bridge
      if ((a1.elem === 'S' || a1.elem === 'SE') && (a2.elem === 'S' || a2.elem === 'SE') && d <= 2.5) {
        contacts.push({
          type: 'disulfide',
          res1: r1Str, atom1: a1.name.trim(),
          res2: r2Str, atom2: a2.name.trim(),
          distance: d,
          details: 'Disulfide / Se-Se Bridge'
        });
      }

      // B. Salt Bridge
      const basicRes = ['LYS', 'ARG', 'HIS'];
      const acidicRes = ['ASP', 'GLU'];
      const basicAtoms = ['NZ', 'NE', 'NH1', 'NH2', 'ND1', 'NE2'];
      const acidicAtoms = ['OD1', 'OD2', 'OE1', 'OE2'];

      const isA1Basic = basicRes.includes(a1.resName) && basicAtoms.includes(a1.name.trim());
      const isA2Acidic = acidicRes.includes(a2.resName) && acidicAtoms.includes(a2.name.trim());
      const isA1Acidic = acidicRes.includes(a1.resName) && acidicAtoms.includes(a1.name.trim());
      const isA2Basic = basicRes.includes(a2.resName) && basicAtoms.includes(a2.name.trim());

      if (((isA1Basic && isA2Acidic) || (isA1Acidic && isA2Basic)) && d <= 4.0) {
        contacts.push({
          type: 'saltbridge',
          res1: r1Str, atom1: a1.name.trim(),
          res2: r2Str, atom2: a2.name.trim(),
          distance: d,
          details: 'Electrostatic Salt Bridge'
        });
      }

      // C. Hydrogen Bond (Polar-Polar 2.5 - 3.5 Å)
      const polarElems = ['N', 'O', 'S'];
      if (polarElems.includes(a1.elem) && polarElems.includes(a2.elem) && d >= 2.5 && d <= 3.5) {
        contacts.push({
          type: 'hbond',
          res1: r1Str, atom1: a1.name.trim(),
          res2: r2Str, atom2: a2.name.trim(),
          distance: d,
          details: 'Hydrogen Bond Contact'
        });
      }

      // D. Hydrophobic Contact (Carbon-Carbon 3.4 - 4.0 Å)
      const nonPolarResidues = ['ALA', 'VAL', 'LEU', 'ILE', 'PHE', 'PRO', 'MET', 'MSE', 'TRP'];
      if (a1.elem === 'C' && a2.elem === 'C' &&
          nonPolarResidues.includes(a1.resName) && nonPolarResidues.includes(a2.resName) &&
          !['C', 'CA'].includes(a1.name.trim()) && !['C', 'CA'].includes(a2.name.trim()) &&
          d >= 3.4 && d <= 4.0) {
        contacts.push({
          type: 'hydrophobic',
          res1: r1Str, atom1: a1.name.trim(),
          res2: r2Str, atom2: a2.name.trim(),
          distance: d,
          details: 'Hydrophobic Sidechain Contact'
        });
      }
    }
  }

  const hbondCount = contacts.filter(c => c.type === 'hbond').length;
  const saltBridgeCount = contacts.filter(c => c.type === 'saltbridge').length;
  const disulfideCount = contacts.filter(c => c.type === 'disulfide').length;
  const hydrophobicCount = contacts.filter(c => c.type === 'hydrophobic').length;

  log(`Total Detected Intramolecular Contacts: ${contacts.length}`);
  log(`  - Hydrogen Bonds:       ${hbondCount}`);
  log(`  - Salt Bridges:         ${saltBridgeCount}`);
  log(`  - Disulfide Bridges:    ${disulfideCount}`);
  log(`  - Hydrophobic Contacts: ${hydrophobicCount}\n`);

  log("Top Representative Interactions:");
  log("Type          Residue 1          Atom 1   Residue 2          Atom 2   Distance (Å)  Details");
  log("--------------------------------------------------------------------------------------------------");
  contacts.slice(0, 30).forEach(c => {
    log(`${c.type.padEnd(13, ' ')} ${c.res1.padEnd(18, ' ')} ${c.atom1.padEnd(8, ' ')} ${c.res2.padEnd(18, ' ')} ${c.atom2.padEnd(8, ' ')} ${c.distance.toFixed(3).padStart(12, ' ')}  ${c.details || ''}`);
  });
  log(`... and ${contacts.length - 30} more interaction contacts.\n`);

  const endTime = performance.now();
  const durationMs = endTime - startTime;
  log("================================================================================");
  log(`EXECUTION SUMMARY: Benchmark completed cleanly in ${durationMs.toFixed(2)} ms.`);
  log("================================================================================");

  // Write complete log to scratch/qa_1a8o.log
  const logFilePath = path.join(process.cwd(), 'scratch', 'qa_1a8o.log');
  fs.writeFileSync(logFilePath, logLines.join('\n'), 'utf-8');
  console.log(`\nLog output successfully written to: ${logFilePath}`);
}

main().catch(err => {
  console.error("Error executing QA 1A8O analysis script:", err);
  process.exit(1);
});
