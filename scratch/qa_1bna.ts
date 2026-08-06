import fs from 'fs';
import path from 'path';
import https from 'https';
import { MolProcessor } from '../src/lib/MolProcessor';
import { SelectionParser } from '../src/lib/SelectionParser';

const PDB_URL = 'https://files.rcsb.org/download/1BNA.pdb';
const PDB_FILE_PATH = path.resolve(process.cwd(), '1BNA.pdb');
const LOG_FILE_PATH = path.resolve(process.cwd(), 'scratch', 'qa_1bna.log');

function log(logs: string[], msg: string = '') {
  console.log(msg);
  logs.push(msg);
}

function fetchPDB(url: string, destPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(destPath)) {
      resolve(fs.readFileSync(destPath, 'utf-8'));
      return;
    }
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download PDB. HTTP status code: ${response.statusCode}`));
        return;
      }
      let content = '';
      response.on('data', (chunk) => {
        content += chunk.toString('utf-8');
      });
      response.on('end', () => {
        fs.writeFileSync(destPath, content, 'utf-8');
        resolve(content);
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

// Custom DNA / nucleic acid & protein backbone phi/psi calculator
function computeTorsionsAndRamachandran(atoms: any[]) {
  const helperTorsion = (a: any, b: any, c: any, d: any): number => {
    const b1 = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const b2 = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
    const b3 = { x: d.x - c.x, y: d.y - c.y, z: d.z - c.z };
    const n1 = { x: b1.y*b2.z - b1.z*b2.y, y: b1.z*b2.x - b1.x*b2.z, z: b1.x*b2.y - b1.y*b2.x };
    const n2 = { x: b2.y*b3.z - b2.z*b3.y, y: b2.z*b3.x - b2.x*b3.z, z: b2.x*b3.y - b2.y*b3.x };
    const lenB2 = Math.sqrt(b2.x*b2.x + b2.y*b2.y + b2.z*b2.z);
    const m1 = { x: n1.y*b2.z - n1.z*b2.y, y: n1.z*b2.x - n1.x*b2.z, z: n1.x*b2.y - n1.y*b2.x };
    const dotN = n1.x*n2.x + n1.y*n2.y + n1.z*n2.z;
    const dotM = lenB2 > 0 ? (m1.x*n2.x + m1.y*n2.y + m1.z*n2.z) / lenB2 : 0;
    return Math.atan2(-dotM, dotN) * (180.0 / Math.PI);
  };

  const checkRegion = (phi: number, psi: number): 'favored' | 'allowed' | 'outlier' => {
    if (phi === 360 || psi === 360) return 'allowed';
    if (phi >= -100 && phi <= -30 && psi >= -70 && psi <= -10) return 'favored';
    if (phi >= -160 && phi <= -50 && (psi >= 90 && psi <= 180 || psi >= -180 && psi <= -160)) return 'favored';
    if (phi >= 30 && phi <= 90 && psi >= 20 && psi <= 90) return 'favored';
    if (phi >= -120 && phi <= -10 && psi >= -90 && psi <= 10) return 'allowed';
    if (phi >= -180 && phi <= -30 && (psi >= 70 && psi <= 180 || psi >= -180 && psi <= -140)) return 'allowed';
    if (phi >= 10 && phi <= 110 && psi >= 0 && psi <= 110) return 'allowed';
    return 'outlier';
  };

  const residues = new Map<string, any[]>();
  atoms.forEach(a => {
    const key = `${a.chainID}:${a.resSeq}:${a.resName}`;
    if (!residues.has(key)) residues.set(key, []);
    residues.get(key)!.push(a);
  });

  const proteinReport: any[] = [];
  const dnaTorsions: any[] = [];

  const sortedKeys = Array.from(residues.keys()).sort((x, y) => {
    const [chX, seqX] = x.split(':');
    const [chY, seqY] = y.split(':');
    if (chX !== chY) return chX.localeCompare(chY);
    return parseInt(seqX) - parseInt(seqY);
  });

  sortedKeys.forEach(key => {
    const [chainID, resSeqStr, resName] = key.split(':');
    const resSeq = parseInt(resSeqStr);
    const currAtoms = residues.get(key)!;

    // Check for protein backbone atoms
    const N = currAtoms.find(a => a.name.trim() === 'N');
    const CA = currAtoms.find(a => a.name.trim() === 'CA');
    const C = currAtoms.find(a => a.name.trim() === 'C');

    if (N && CA && C) {
      const prevKey = `${chainID}:${resSeq - 1}:`;
      const nextKey = `${chainID}:${resSeq + 1}:`;
      const prevAtoms = Array.from(residues.entries()).find(([k]) => k.startsWith(prevKey))?.[1] || [];
      const nextAtoms = Array.from(residues.entries()).find(([k]) => k.startsWith(nextKey))?.[1] || [];
      const C_prev = prevAtoms.find(a => a.name.trim() === 'C');
      const N_next = nextAtoms.find(a => a.name.trim() === 'N');

      let phi = 360;
      let psi = 360;
      if (C_prev) phi = helperTorsion(C_prev, N, CA, C);
      if (N_next) psi = helperTorsion(N, CA, C, N_next);

      if (phi !== 360 || psi !== 360) {
        const region = checkRegion(phi, psi);
        proteinReport.push({ resName, resSeq, chainID, phi, psi, region });
      }
    }

    // Check for DNA backbone torsion angles (e.g. delta: C5'-C4'-C3'-O3')
    const C5p = currAtoms.find(a => a.name.trim() === "C5'" || a.name.trim() === "C5*");
    const C4p = currAtoms.find(a => a.name.trim() === "C4'" || a.name.trim() === "C4*");
    const C3p = currAtoms.find(a => a.name.trim() === "C3'" || a.name.trim() === "C3*");
    const O3p = currAtoms.find(a => a.name.trim() === "O3'" || a.name.trim() === "O3*");

    if (C5p && C4p && C3p && O3p) {
      const delta = helperTorsion(C5p, C4p, C3p, O3p);
      dnaTorsions.push({ chainID, resSeq, resName: resName.trim(), angleName: "delta (C5'-C4'-C3'-O3')", value: delta });
    }
  });

  return { proteinReport, dnaTorsions };
}

// Dipole Moment Calculator
function computeDipoleMoment(atoms: any[]) {
  const getMass = (elem: string): number => {
    const el = (elem || '').toUpperCase().trim();
    switch (el) {
      case 'H': return 1.008;
      case 'C': return 12.011;
      case 'N': return 14.007;
      case 'O': return 15.999;
      case 'P': return 30.974;
      case 'S': return 32.060;
      case 'MG': return 24.305;
      case 'NA': return 22.990;
      case 'CL': return 35.450;
      default: return 12.011;
    }
  };

  const getNucleotideCharge = (atomName: string, elem: string, resName: string): number => {
    const cleanName = atomName.trim().toUpperCase();
    const cleanElem = elem.trim().toUpperCase();
    
    // Phosphate backbone charges
    if (cleanName === 'P') return 1.20;
    if (cleanName === 'OP1' || cleanName === 'OP2' || cleanName === 'O1P' || cleanName === 'O2P') return -0.78;
    if (cleanName === "O5'" || cleanName === "O3'" || cleanName === "C5'" || cleanName === "C4'" || cleanName === "C3'" || cleanName === "C2'" || cleanName === "C1'" || cleanName === "O4'") {
      if (cleanElem === 'O') return -0.40;
      if (cleanElem === 'C') return 0.10;
    }
    
    // Nitrogenous bases
    if (cleanElem === 'O') return -0.50;
    if (cleanElem === 'N') return -0.40;
    if (cleanElem === 'P') return 1.00;
    if (cleanElem === 'C') return 0.05;
    if (cleanElem === 'H') return 0.15;

    return 0.0;
  };

  let totalMass = 0;
  let com = { x: 0, y: 0, z: 0 };
  atoms.forEach(a => {
    const m = getMass(a.elem);
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

  atoms.forEach(a => {
    const q = getNucleotideCharge(a.name, a.elem, a.resName);
    netCharge += q;
    const dx = a.x - com.x;
    const dy = a.y - com.y;
    const dz = a.z - com.z;
    mux += q * dx;
    muy += q * dy;
    muz += q * dz;
  });

  const DEBYE_PER_E_ANGSTROM = 4.8032;
  const vectorEAng = { x: mux, y: muy, z: muz };
  const vectorDebye = {
    x: mux * DEBYE_PER_E_ANGSTROM,
    y: muy * DEBYE_PER_E_ANGSTROM,
    z: muz * DEBYE_PER_E_ANGSTROM
  };
  const magDebye = Math.sqrt(
    vectorDebye.x * vectorDebye.x +
    vectorDebye.y * vectorDebye.y +
    vectorDebye.z * vectorDebye.z
  );

  return {
    atomCount: atoms.length,
    totalMass,
    centerOfMass: com,
    netCharge,
    vectorEAng,
    vectorDebye,
    magnitudeDebye: magDebye
  };
}

// Inter-residue & Inter-chain Contact / H-Bond / Salt Bridge Calculator
function computeInteractionContacts(atoms: any[]) {
  const dist = (a: any, b: any) => Math.sqrt((a.x - b.x)**2 + (a.y - b.y)**2 + (a.z - b.z)**2);
  
  const hBonds: any[] = [];
  const saltBridges: any[] = [];
  const interChainContacts: any[] = [];
  const basePairContacts: any[] = [];

  const chainAAtoms = atoms.filter(a => a.chainID === 'A');
  const chainBAtoms = atoms.filter(a => a.chainID === 'B');

  // 1. Hydrogen Bonds & Base Pair Contacts between Chain A and Chain B
  for (const a of chainAAtoms) {
    for (const b of chainBAtoms) {
      const d = dist(a, b);
      if (d <= 3.6) {
        interChainContacts.push({ atomA: a, atomB: b, distance: d });
        
        // H-bond candidate between polar atoms (N, O)
        if (['N', 'O'].includes(a.elem) && ['N', 'O'].includes(b.elem) && d >= 2.4 && d <= 3.4) {
          hBonds.push({
            donorRes: `${a.chainID}:${a.resSeq}:${a.resName.trim()}:${a.name.trim()}`,
            acceptorRes: `${b.chainID}:${b.resSeq}:${b.resName.trim()}:${b.name.trim()}`,
            distance: d
          });

          // Watson-Crick Base Pair specific H-bonds
          const isBaseA = ['N1', 'N2', 'N3', 'N4', 'N6', 'O2', 'O4', 'O6'].includes(a.name.trim());
          const isBaseB = ['N1', 'N2', 'N3', 'N4', 'N6', 'O2', 'O4', 'O6'].includes(b.name.trim());
          if (isBaseA && isBaseB) {
            basePairContacts.push({
              resA: `A:${a.resSeq}(${a.resName.trim()})`,
              resB: `B:${b.resSeq}(${b.resName.trim()})`,
              atomA: a.name.trim(),
              atomB: b.name.trim(),
              distance: d
            });
          }
        }

        // Salt bridges / Ionic contacts (Phosphate O - Ion / Basic groups)
        if ((a.name.trim().startsWith('OP') || a.name.trim().startsWith('O1P') || a.name.trim().startsWith('O2P')) &&
            ['NA', 'MG', 'K', 'CA', 'NZ', 'NH1', 'NH2'].includes(b.elem.toUpperCase())) {
          saltBridges.push({
            phosphateAtom: `${a.chainID}:${a.resSeq}:${a.name.trim()}`,
            cationAtom: `${b.chainID}:${b.resSeq}:${b.name.trim()}`,
            distance: d
          });
        }
      }
    }
  }

  return {
    totalInterChainContacts: interChainContacts.length,
    hBondCount: hBonds.length,
    hBonds,
    saltBridgeCount: saltBridges.length,
    saltBridges,
    basePairContactCount: basePairContacts.length,
    basePairContacts
  };
}

async function main() {
  const logs: string[] = [];
  const globalStart = performance.now();
  log(logs, "===============================================================================");
  log(logs, "        1BNA BIOPHYSICAL ANALYSIS & QA COMPUTE RUNNER");
  log(logs, "===============================================================================\n");

  // Step 1: Fetching 1BNA.pdb
  log(logs, "--- Step 1: Fetching PDB 1BNA ---");
  const fetchStart = performance.now();
  let pdbContent = "";
  try {
    pdbContent = await fetchPDB(PDB_URL, PDB_FILE_PATH);
    const fetchEnd = performance.now();
    const fetchDuration = fetchEnd - fetchStart;
    log(logs, `  [SUCCESS] PDB 1BNA fetched / loaded successfully.`);
    log(logs, `  ↳ File path : ${PDB_FILE_PATH}`);
    log(logs, `  ↳ Content size : ${(pdbContent.length / 1024).toFixed(2)} KB`);
    log(logs, `  ↳ Fetch duration : ${fetchDuration.toFixed(2)} ms\n`);
  } catch (err: any) {
    log(logs, `  [ERROR] Failed to fetch 1BNA.pdb: ${err.message}`);
    process.exit(1);
  }

  // Step 2: Parsing 1BNA.pdb
  log(logs, "--- Step 2: Parsing Molecule Structure ---");
  const parseStart = performance.now();
  const processor = new MolProcessor(pdbContent, 'pdb');
  processor.assignBonds(1.1);
  const atoms = processor.atoms;
  const parseDuration = performance.now() - parseStart;

  const chains = Array.from(new Set(atoms.map(a => a.chainID))).sort();
  const residues = Array.from(new Set(atoms.map(a => `${a.chainID}:${a.resSeq}:${a.resName.trim()}`)));
  const hetAtoms = atoms.filter(a => a.isHetero);
  const waterAtoms = atoms.filter(a => ['HOH', 'WAT'].includes(a.resName.trim()));

  log(logs, `  [SUCCESS] PDB parsed ${atoms.length} atoms.`);
  log(logs, `  ↳ Chain IDs : ${JSON.stringify(chains)}`);
  log(logs, `  ↳ Total Residues : ${residues.length}`);
  log(logs, `  ↳ HETATM / Solvents : ${hetAtoms.length} atoms (${waterAtoms.length} water molecules)`);
  log(logs, `  ↳ Parse duration : ${parseDuration.toFixed(2)} ms\n`);

  // Step 3: Secondary Structure Calculation
  log(logs, "--- Step 3: Computing Secondary Structure ---");
  const ssStart = performance.now();
  processor.calculateSecondaryStructure('quick');
  const ssDuration = performance.now() - ssStart;

  const helixRes = processor.ss_per_residue.filter(r => r.ss_type === 'helix');
  const sheetRes = processor.ss_per_residue.filter(r => r.ss_type === 'sheet');
  const loopRes = processor.ss_per_residue.filter(r => r.ss_type === 'loop');

  log(logs, `  [SUCCESS] Secondary structure evaluated for ${processor.ss_per_residue.length} residues.`);
  log(logs, `  ↳ Helices : ${helixRes.length} residues`);
  log(logs, `  ↳ Sheets  : ${sheetRes.length} residues`);
  log(logs, `  ↳ Loops / Duplex : ${loopRes.length} residues`);
  log(logs, `  ↳ Note: 1BNA is a B-DNA double-helix dodecamer [d(CGCGAATTCGCG)]2.`);
  log(logs, `  ↳ Secondary structure duration : ${ssDuration.toFixed(2)} ms\n`);

  // Step 4: Ramachandran & Torsion Angles Calculation
  log(logs, "--- Step 4: Computing Ramachandran & Backbone Torsion Angles ---");
  const ramaStart = performance.now();
  const { proteinReport, dnaTorsions } = computeTorsionsAndRamachandran(atoms);
  const ramaDuration = performance.now() - ramaStart;

  log(logs, `  [SUCCESS] Torsion analysis complete.`);
  log(logs, `  ↳ Protein Ramachandran Residues Evaluated : ${proteinReport.length}`);
  if (proteinReport.length === 0) {
    log(logs, `  ↳ Note: 1BNA is a double-stranded DNA structure, containing 0 amino acid residues.`);
  } else {
    proteinReport.forEach(r => log(logs, `    - ${r.chainID}:${r.resSeq} (${r.resName}): Phi=${r.phi.toFixed(1)}°, Psi=${r.psi.toFixed(1)}° [${r.region}]`));
  }
  log(logs, `  ↳ Evaluated ${dnaTorsions.length} DNA backbone delta (C5'-C4'-C3'-O3') torsion angles:`);
  dnaTorsions.slice(0, 6).forEach(t => {
    log(logs, `    - ${t.chainID}:${t.resSeq} (${t.resName}) ${t.angleName} = ${t.value.toFixed(1)}°`);
  });
  if (dnaTorsions.length > 6) {
    log(logs, `    - ... (${dnaTorsions.length - 6} additional nucleotide torsions evaluated)`);
  }
  log(logs, `  ↳ Ramachandran & Torsion duration : ${ramaDuration.toFixed(2)} ms\n`);

  // Step 5: Molecular Dipole Moment Calculation
  log(logs, "--- Step 5: Computing Molecular Dipole Moment ---");
  const dipoleStart = performance.now();
  const dipole = computeDipoleMoment(atoms);
  const dipoleDuration = performance.now() - dipoleStart;

  log(logs, `  [SUCCESS] Molecular dipole calculation complete.`);
  log(logs, `  ↳ Atoms included : ${dipole.atomCount}`);
  log(logs, `  ↳ Total molecular mass : ${dipole.totalMass.toFixed(2)} amu`);
  log(logs, `  ↳ Center of Mass (x,y,z) : (${dipole.centerOfMass.x.toFixed(3)}, ${dipole.centerOfMass.y.toFixed(3)}, ${dipole.centerOfMass.z.toFixed(3)}) Å`);
  log(logs, `  ↳ Net Charge : ${dipole.netCharge.toFixed(2)} e`);
  log(logs, `  ↳ Dipole Vector (e·Å) : (${dipole.vectorEAng.x.toFixed(3)}, ${dipole.vectorEAng.y.toFixed(3)}, ${dipole.vectorEAng.z.toFixed(3)})`);
  log(logs, `  ↳ Dipole Vector (Debye) : (${dipole.vectorDebye.x.toFixed(3)}, ${dipole.vectorDebye.y.toFixed(3)}, ${dipole.vectorDebye.z.toFixed(3)})`);
  log(logs, `  ↳ Dipole Vector Magnitude : ${dipole.magnitudeDebye.toFixed(3)} Debye`);
  log(logs, `  ↳ Dipole duration : ${dipoleDuration.toFixed(2)} ms\n`);

  // Step 6: Interaction Contacts Calculation
  log(logs, "--- Step 6: Computing Interaction Contacts & H-Bonds ---");
  const interStart = performance.now();
  const interactions = computeInteractionContacts(atoms);
  const interDuration = performance.now() - interStart;

  log(logs, `  [SUCCESS] Interaction contacts analysis complete.`);
  log(logs, `  ↳ Total Inter-Chain Contacts (< 3.6 Å) : ${interactions.totalInterChainContacts}`);
  log(logs, `  ↳ Total Inter-Chain H-Bonds (2.4 - 3.4 Å) : ${interactions.hBondCount}`);
  log(logs, `  ↳ Watson-Crick Base Pair Contacts : ${interactions.basePairContactCount}`);
  log(logs, `  ↳ Salt Bridges / Phosphate-Cation Contacts : ${interactions.saltBridgeCount}`);
  log(logs, `  ↳ Sample Watson-Crick Base-Pairing H-Bonds:`);
  interactions.basePairContacts.slice(0, 10).forEach(bp => {
    log(logs, `    - ${bp.resA}:${bp.atomA} <--> ${bp.resB}:${bp.atomB} | Distance = ${bp.distance.toFixed(3)} Å`);
  });
  log(logs, `  ↳ Interactions duration : ${interDuration.toFixed(2)} ms\n`);

  // Summary & Performance Metrics
  const globalDuration = performance.now() - globalStart;
  log(logs, "===============================================================================");
  log(logs, "                    EXECUTION DURATION & PERFORMANCE SUMMARY");
  log(logs, "===============================================================================");
  log(logs, `  1. PDB Fetch / Load Duration    : ${(parseStart - fetchStart).toFixed(2)} ms`);
  log(logs, `  2. PDB Parsing Duration         : ${parseDuration.toFixed(2)} ms`);
  log(logs, `  3. Secondary Structure Duration : ${ssDuration.toFixed(2)} ms`);
  log(logs, `  4. Ramachandran/Torsion Duration: ${ramaDuration.toFixed(2)} ms`);
  log(logs, `  5. Dipole Moment Duration       : ${dipoleDuration.toFixed(2)} ms`);
  log(logs, `  6. Interaction Contacts Duration: ${interDuration.toFixed(2)} ms`);
  log(logs, `  -----------------------------------------------------------------------------`);
  log(logs, `  TOTAL EXECUTION TIME            : ${globalDuration.toFixed(2)} ms`);
  log(logs, "===============================================================================");

  // Write full log file
  fs.writeFileSync(LOG_FILE_PATH, logs.join('\n'), 'utf-8');
  console.log(`\nReport successfully saved to ${LOG_FILE_PATH}`);
}

main().catch(err => {
  console.error("FATAL ERROR during 1BNA QA execution:", err);
  process.exit(1);
});
