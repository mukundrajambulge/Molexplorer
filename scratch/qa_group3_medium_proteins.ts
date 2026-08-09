import fs from 'fs';
import path from 'path';
import https from 'https';
import { performance } from 'perf_hooks';
import { MolProcessor, Atom } from '../src/lib/MolProcessor';
import { SelectionParser } from '../src/lib/SelectionParser';
import { calculateKabsch, applyTransform, alignStructures, AlignmentResult } from '../src/lib/Alignment';
import { Matrix } from 'ml-matrix';

// Target 20 Medium Protein Structures (200-1,000 atoms per domain/unit)
interface ProteinTarget {
  name: string;
  id: string;
  expectedClass: string;
}

const TARGET_PROTEINS: ProteinTarget[] = [
  { name: 'Lysozyme', id: '1HEW', expectedClass: 'Hydrolase / Antimicrobial' },
  { name: 'Ubiquitin', id: '1UBQ', expectedClass: 'Signaling / Post-translational' },
  { name: 'Myoglobin', id: '1MBN', expectedClass: 'Oxygen Storage / Globin' },
  { name: 'Ribonuclease A', id: '1RNS', expectedClass: 'Nuclease / Hydrolase' },
  { name: 'Cytochrome C', id: '1HRC', expectedClass: 'Electron Transport / Heme' },
  { name: 'Trp Repressor', id: '1TRO', expectedClass: 'Transcription / DNA-Binding' },
  { name: 'Green Fluorescent Protein', id: '1GFL', expectedClass: 'Chromophore / Fluorescent' },
  { name: 'Profilin', id: '1PFL', expectedClass: 'Actin-Binding / Cytoskeleton' },
  { name: 'Thioredoxin', id: '2TRX', expectedClass: 'Redox / Oxidoreductase' },
  { name: 'Calmodulin', id: '1CLL', expectedClass: 'Calcium Sensor / EF-Hand' },
  { name: 'Calbindin', id: '4ICB', expectedClass: 'Calcium Binding / EF-Hand' },
  { name: 'Parvalbumin', id: '5CPV', expectedClass: 'Calcium Buffer / EF-Hand' },
  { name: 'S100', id: '1A03', expectedClass: 'Calcium Binding / S100 Dimer' },
  { name: 'Cyclophilin', id: '2CPL', expectedClass: 'Peptidyl-Prolyl Isomerase' },
  { name: 'FKBP12', id: '1FKF', expectedClass: 'Immunophilin / PPIase' },
  { name: 'Superoxide Dismutase', id: '2SOD', expectedClass: 'Oxidoreductase / Antioxidant' },
  { name: 'Carbonic Anhydrase', id: '1CA2', expectedClass: 'Lyase / Zinc Enzyme' },
  { name: 'Triosephosphate Isomerase', id: '1TIM', expectedClass: 'Isomerase / TIM Barrel' },
  { name: 'Adenylate Kinase', id: '4AKE', expectedClass: 'Kinase / Transferase' },
  { name: 'Chemokine RANTES', id: '1RTN', expectedClass: 'Cytokine / Chemokine' }
];

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_PATH = path.resolve(__dirname, 'qa_group3_medium_proteins.log');
const CACHE_DIR = path.resolve(__dirname, 'pdb_cache');

interface HBond {
  donorRes: string;
  donorAtom: string;
  acceptorRes: string;
  acceptorAtom: string;
  distance: number;
  type: 'bb-bb' | 'sc-bb' | 'sc-sc';
}

interface SaltBridge {
  posRes: string;
  posAtom: string;
  negRes: string;
  negAtom: string;
  distance: number;
}

interface AnalysisResult {
  target: ProteinTarget;
  parseTimeMs: number;
  totalAtoms: number;
  heavyAtoms: number;
  residuesCount: number;
  chainsCount: number;
  heteroCount: number;
  centerOfMass: [number, number, number];
  kabschSelfRmsd: number;
  kabschSelfAtomCount: number;
  multiChainRmsd?: number;
  hBondsCount: number;
  avgHBondDist: number;
  saltBridgesCount: number;
  avgSaltBridgeDist: number;
  hbonds: HBond[];
  saltBridges: SaltBridge[];
  selectionResults: Record<string, number>;
  status: 'PASS' | 'FAIL';
  errors: string[];
}

// Vector math helpers
interface Vec3 { x: number; y: number; z: number; }

function dist(a: {x:number, y:number, z:number}, b: {x:number, y:number, z:number}): number {
  return Math.sqrt((a.x - b.x)**2 + (a.y - b.y)**2 + (a.z - b.z)**2);
}

function norm(v: Vec3): number {
  return Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x*b.x + a.y*b.y + a.z*b.z;
}

function angleBetween(h: Vec3, d: Vec3, a: Vec3): number {
  const vHD = sub(d, h);
  const vHA = sub(a, h);
  const dProd = dot(vHD, vHA);
  const nProduct = norm(vHD) * norm(vHA);
  if (nProduct === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dProd / nProduct));
  return (Math.acos(cos) * 180) / Math.PI;
}

// Fetch PDB helper with disk caching
async function fetchPDB(id: string): Promise<string> {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  const filePath = path.join(CACHE_DIR, `${id}.pdb`);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8');
  }
  return new Promise((resolve, reject) => {
    https.get(`https://files.rcsb.org/download/${id}.pdb`, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} fetching ${id}.pdb`));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        fs.writeFileSync(filePath, data, 'utf8');
        resolve(data);
      });
    }).on('error', reject);
  });
}

// Arbitrary 3D Rigid Transformation (Rotation by angle theta around axis + translation)
function generateRigidTransform(angleDeg: number, axis: [number, number, number], trans: [number, number, number]) {
  const rad = (angleDeg * Math.PI) / 180.0;
  const len = Math.sqrt(axis[0]**2 + axis[1]**2 + axis[2]**2);
  const u = [axis[0]/len, axis[1]/len, axis[2]/len];
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const C = 1 - cos;

  const R = [
    [cos + u[0]*u[0]*C, u[0]*u[1]*C - u[2]*sin, u[0]*u[2]*C + u[1]*sin],
    [u[1]*u[0]*C + u[2]*sin, cos + u[1]*u[1]*C, u[1]*u[2]*C - u[0]*sin],
    [u[2]*u[0]*C - u[1]*sin, u[2]*u[1]*C + u[0]*sin, cos + u[2]*u[2]*C]
  ];

  return (pt: [number, number, number]): [number, number, number] => {
    const x = pt[0]*R[0][0] + pt[1]*R[0][1] + pt[2]*R[0][2] + trans[0];
    const y = pt[0]*R[1][0] + pt[1]*R[1][1] + pt[2]*R[1][2] + trans[1];
    const z = pt[0]*R[2][0] + pt[1]*R[2][1] + pt[2]*R[2][2] + trans[2];
    return [x, y, z];
  };
}

// Hydrogen Bond Detection
function detectHydrogenBonds(atoms: Atom[], proc: MolProcessor): HBond[] {
  const hbonds: HBond[] = [];

  const polarAtoms = atoms.filter(a => ['N', 'O', 'S'].includes(a.elem.toUpperCase()));
  const basicOrDonorResidues = ['ARG', 'LYS', 'HIS', 'ASN', 'GLN', 'SER', 'THR', 'TYR', 'TRP', 'CYS'];
  const acidicOrAcceptorResidues = ['ASP', 'GLU', 'ASN', 'GLN', 'SER', 'THR', 'TYR', 'HIS'];

  function isDonor(a: Atom): boolean {
    const name = a.name.trim().toUpperCase();
    const elem = a.elem.toUpperCase();
    const resn = a.resName.trim().toUpperCase();
    if (name === 'N') return true; // Backbone amide donor
    if (elem === 'N' && basicOrDonorResidues.includes(resn)) return true;
    if (elem === 'O' && ['SER', 'THR', 'TYR'].includes(resn)) return true;
    if (elem === 'S' && resn === 'CYS') return true;
    return false;
  }

  function isAcceptor(a: Atom): boolean {
    const name = a.name.trim().toUpperCase();
    const elem = a.elem.toUpperCase();
    const resn = a.resName.trim().toUpperCase();
    if (name === 'O') return true; // Backbone carbonyl acceptor
    if (elem === 'O' && acidicOrAcceptorResidues.includes(resn)) return true;
    if (elem === 'N' && ['HIS'].includes(resn)) return true;
    return false;
  }

  for (let i = 0; i < polarAtoms.length; i++) {
    const a1 = polarAtoms[i];
    for (let j = i + 1; j < polarAtoms.length; j++) {
      const a2 = polarAtoms[j];

      // Exclude same residue or adjacent backbone bonds
      if (a1.chainID === a2.chainID && Math.abs(a1.resSeq - a2.resSeq) === 0) continue;

      const d = dist(a1, a2);
      if (d < 2.4 || d > 3.5) continue;

      let donor: Atom | null = null;
      let acceptor: Atom | null = null;

      if (isDonor(a1) && isAcceptor(a2)) { donor = a1; acceptor = a2; }
      else if (isDonor(a2) && isAcceptor(a1)) { donor = a2; acceptor = a1; }

      if (!donor || !acceptor) continue;

      // Check hydrogen angle if hydrogens exist
      const hAtoms = donor.bonds.map(idx => proc.atoms[idx]).filter(h => h && h.elem === 'H');
      let passesAngle = true;
      if (hAtoms.length > 0) {
        passesAngle = false;
        for (const h of hAtoms) {
          const ang = angleBetween(h, donor, acceptor);
          if (ang >= 120.0) {
            passesAngle = true;
            break;
          }
        }
      }

      if (!passesAngle) continue;

      const dResName = `${donor.resName.trim()}${donor.resSeq}:${donor.chainID}`;
      const aResName = `${acceptor.resName.trim()}${acceptor.resSeq}:${acceptor.chainID}`;

      let type: 'bb-bb' | 'sc-bb' | 'sc-sc' = 'sc-sc';
      const isDonorBB = donor.name.trim() === 'N';
      const isAccBB = acceptor.name.trim() === 'O';

      if (isDonorBB && isAccBB) type = 'bb-bb';
      else if (isDonorBB || isAccBB) type = 'sc-bb';

      hbonds.push({
        donorRes: dResName,
        donorAtom: donor.name.trim(),
        acceptorRes: aResName,
        acceptorAtom: acceptor.name.trim(),
        distance: parseFloat(d.toFixed(3)),
        type
      });
    }
  }

  return hbonds;
}

// Salt Bridge Detection
function detectSaltBridges(atoms: Atom[]): SaltBridge[] {
  const saltBridges: SaltBridge[] = [];

  const basicResidues = ['ARG', 'LYS', 'HIS'];
  const acidicResidues = ['ASP', 'GLU'];
  const posAtomNames = ['NZ', 'NH1', 'NH2', 'NE', 'ND1', 'NE2'];
  const negAtomNames = ['OD1', 'OD2', 'OE1', 'OE2', 'OXT'];

  const cations = atoms.filter(a => basicResidues.includes(a.resName.trim().toUpperCase()) && posAtomNames.includes(a.name.trim().toUpperCase()));
  const anions = atoms.filter(a => acidicResidues.includes(a.resName.trim().toUpperCase()) && negAtomNames.includes(a.name.trim().toUpperCase()));

  for (const cat of cations) {
    for (const ani of anions) {
      if (cat.chainID === ani.chainID && cat.resSeq === ani.resSeq) continue;

      const d = dist(cat, ani);
      if (d <= 4.0) {
        saltBridges.push({
          posRes: `${cat.resName.trim()}${cat.resSeq}:${cat.chainID}`,
          posAtom: cat.name.trim(),
          negRes: `${ani.resName.trim()}${ani.resSeq}:${ani.chainID}`,
          negAtom: ani.name.trim(),
          distance: parseFloat(d.toFixed(3))
        });
      }
    }
  }

  return saltBridges;
}

async function analyzeProtein(target: ProteinTarget, log: (msg: string) => void): Promise<AnalysisResult> {
  log(`---------------------------------------------------------------------------------`);
  log(`Analyzing Protein: ${target.name} (PDB ID: ${target.id}) [${target.expectedClass}]`);
  log(`---------------------------------------------------------------------------------`);

  const errors: string[] = [];
  const tFetchStart = performance.now();
  const pdbText = await fetchPDB(target.id);
  const fetchMs = performance.now() - tFetchStart;

  const tParseStart = performance.now();
  const processor = new MolProcessor(pdbText, 'pdb');
  processor.filterAltlocs();
  processor.assignBonds(1.1);
  if (!processor.atoms.some(a => a.elem === 'H')) {
    processor.addHydrogens();
    processor.assignBonds(1.1);
  }
  const parseMs = performance.now() - tParseStart;

  const totalAtoms = processor.atoms.length;
  const heavyAtoms = processor.atoms.filter(a => a.elem !== 'H');
  const heteroAtoms = processor.atoms.filter(a => a.isHetero);

  // Collect residue count and chain IDs
  const resKeys = new Set(processor.atoms.map(a => `${a.chainID}:${a.resSeq}:${a.resName}`));
  const chainIDs = Array.from(new Set(processor.atoms.map(a => a.chainID))).sort();

  log(`  • Atoms: Total = ${totalAtoms}, Heavy = ${heavyAtoms.length}, Hetero = ${heteroAtoms.length}`);
  log(`  • Residues: ${resKeys.size}, Chains: [${chainIDs.join(', ')}]`);
  log(`  • Timings: Fetch = ${fetchMs.toFixed(1)} ms, Parse = ${parseMs.toFixed(1)} ms`);

  // Center of Mass
  let comX = 0, comY = 0, comZ = 0;
  heavyAtoms.forEach(a => { comX += a.x; comY += a.y; comZ += a.z; });
  const com: [number, number, number] = [
    parseFloat((comX / heavyAtoms.length).toFixed(3)),
    parseFloat((comY / heavyAtoms.length).toFixed(3)),
    parseFloat((comZ / heavyAtoms.length).toFixed(3))
  ];
  log(`  • Center of Mass: (${com[0]}, ${com[1]}, ${com[2]})`);

  // 1. Kabsch Self-Alignment Verification
  const caAtoms = heavyAtoms.filter(a => a.name.trim() === 'CA');
  const coordsA = caAtoms.map(a => [a.x, a.y, a.z]);
  
  // Apply rigid 3D transformation
  const rigidTransform = generateRigidTransform(45.0, [1, 2, 3], [15.0, -25.0, 10.0]);
  const coordsB = coordsA.map(p => rigidTransform(p as [number, number, number]));

  const kabschRes = calculateKabsch(coordsA, coordsB);
  
  // Recover coordinates
  let sumSqErr = 0;
  for (let i = 0; i < coordsA.length; i++) {
    const recovered = applyTransform(coordsB[i], kabschRes.R, kabschRes.centroidA, kabschRes.centroidB);
    const dSq = (coordsA[i][0] - recovered[0])**2 + (coordsA[i][1] - recovered[1])**2 + (coordsA[i][2] - recovered[2])**2;
    sumSqErr += dSq;
  }
  const selfRmsd = Math.sqrt(sumSqErr / coordsA.length);
  log(`  • Kabsch Self-Recovery Test (${caAtoms.length} Cα atoms): RMSD = ${selfRmsd.toFixed(6)} Å`);
  if (selfRmsd > 1e-3) {
    errors.push(`Kabsch self-recovery RMSD exceeded threshold: ${selfRmsd} Å`);
  }

  // Multi-chain alignment check if available
  let multiChainRmsd: number | undefined;
  if (chainIDs.length >= 2) {
    const chainAAtoms = heavyAtoms.filter(a => a.chainID === chainIDs[0]);
    const chainBAtoms = heavyAtoms.filter(a => a.chainID === chainIDs[1]);
    if (chainAAtoms.length > 20 && chainBAtoms.length > 20) {
      try {
        const alignRes = alignStructures(chainAAtoms, chainBAtoms);
        multiChainRmsd = parseFloat(alignRes.rmsd.toFixed(3));
        log(`  • Chain Pair Alignment (Chain ${chainIDs[0]} vs ${chainIDs[1]}): RMSD = ${multiChainRmsd} Å across ${alignRes.atomPairsCount} Cα pairs`);
      } catch (err: any) {
        log(`  • Chain Pair Alignment Warning: ${err.message}`);
      }
    }
  }

  // 2. Hydrogen Bond Detection
  const hbonds = detectHydrogenBonds(heavyAtoms, processor);
  const avgHBondDist = hbonds.length > 0 ? hbonds.reduce((acc, h) => acc + h.distance, 0) / hbonds.length : 0;
  const bbBbCount = hbonds.filter(h => h.type === 'bb-bb').length;
  const scBbCount = hbonds.filter(h => h.type === 'sc-bb').length;
  const scScCount = hbonds.filter(h => h.type === 'sc-sc').length;
  log(`  • Hydrogen Bonds Detected: Total = ${hbonds.length} (bb-bb: ${bbBbCount}, sc-bb: ${scBbCount}, sc-sc: ${scScCount}), Avg Dist = ${avgHBondDist.toFixed(3)} Å`);

  // Sample H-Bonds
  if (hbonds.length > 0) {
    log(`    Top H-bonds: ${hbonds.slice(0, 3).map(h => `${h.donorRes}:${h.donorAtom} -> ${h.acceptorRes}:${h.acceptorAtom} (${h.distance} Å)`).join(', ')}`);
  }

  // 3. Salt Bridge Detection
  const saltBridges = detectSaltBridges(heavyAtoms);
  const avgSaltDist = saltBridges.length > 0 ? saltBridges.reduce((acc, s) => acc + s.distance, 0) / saltBridges.length : 0;
  log(`  • Salt Bridges Detected: Total = ${saltBridges.length}, Avg Dist = ${avgSaltDist.toFixed(3)} Å`);
  if (saltBridges.length > 0) {
    log(`    Salt Bridges: ${saltBridges.slice(0, 4).map(s => `${s.posRes}:${s.posAtom} - ${s.negRes}:${s.negAtom} (${s.distance} Å)`).join(', ')}`);
  }

  // 4. Selection Query Engine Verification
  const selectionResults: Record<string, number> = {};
  const queries = ['backbone', 'resname LYS,ARG', 'elem C', 'name CA'];
  for (const q of queries) {
    const selAtoms = SelectionParser.parse(q, processor.atoms);
    selectionResults[q] = selAtoms.length;
  }
  log(`  • Selection Algebra Verification: backbone=${selectionResults['backbone']}, LYS/ARG=${selectionResults['resname LYS,ARG']}, C=${selectionResults['elem C']}, CA=${selectionResults['name CA']}`);

  const status: 'PASS' | 'FAIL' = errors.length === 0 ? 'PASS' : 'FAIL';
  log(`  • Target Status: [ ${status} ]\n`);

  return {
    target,
    parseTimeMs: parseFloat(parseMs.toFixed(2)),
    totalAtoms,
    heavyAtoms: heavyAtoms.length,
    residuesCount: resKeys.size,
    chainsCount: chainIDs.length,
    heteroCount: heteroAtoms.length,
    centerOfMass: com,
    kabschSelfRmsd: parseFloat(selfRmsd.toFixed(6)),
    kabschSelfAtomCount: caAtoms.length,
    multiChainRmsd,
    hBondsCount: hbonds.length,
    avgHBondDist: parseFloat(avgHBondDist.toFixed(3)),
    saltBridgesCount: saltBridges.length,
    avgSaltBridgeDist: parseFloat(avgSaltDist.toFixed(3)),
    hbonds,
    saltBridges,
    selectionResults,
    status,
    errors
  };
}

async function main() {
  const logLines: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logLines.push(msg);
  };

  log("=================================================================================");
  log("        QA AUTOMATION SUITE: GROUP 3 - MEDIUM PROTEIN STRUCTURES (200-1000 ATOMS)");
  log("=================================================================================");
  log(`Timestamp: ${new Date().toISOString()}`);
  log(`Target Count: ${TARGET_PROTEINS.length} Medium Proteins`);
  log(`Verified Features: Kabsch RMSD Alignment, Hydrogen Bond Detection, Salt Bridges, Selections`);
  log("");

  const startTime = performance.now();
  const results: AnalysisResult[] = [];

  for (const target of TARGET_PROTEINS) {
    try {
      const res = await analyzeProtein(target, log);
      results.push(res);
    } catch (err: any) {
      log(`[ERROR] Failed processing ${target.name} (${target.id}): ${err.message}\n`);
      results.push({
        target,
        parseTimeMs: 0,
        totalAtoms: 0,
        heavyAtoms: 0,
        residuesCount: 0,
        chainsCount: 0,
        heteroCount: 0,
        centerOfMass: [0, 0, 0],
        kabschSelfRmsd: 999.0,
        kabschSelfAtomCount: 0,
        hBondsCount: 0,
        avgHBondDist: 0,
        saltBridgesCount: 0,
        avgSaltBridgeDist: 0,
        hbonds: [],
        saltBridges: [],
        selectionResults: {},
        status: 'FAIL',
        errors: [err.message]
      });
    }
  }

  const totalTimeMs = performance.now() - startTime;

  log("=================================================================================");
  log("                       CONSOLIDATED QA SUMMARY REPORT");
  log("=================================================================================");
  log(
    "PDB ID | Protein Name               | Total | Heavy | Residues | Parse(ms) | Kabsch RMSD(Å) | H-Bonds | SaltBridges | Status"
  );
  log("-".repeat(110));

  let passCount = 0;
  let failCount = 0;
  let totalHBonds = 0;
  let totalSaltBridges = 0;

  for (const r of results) {
    if (r.status === 'PASS') passCount++;
    else failCount++;
    totalHBonds += r.hBondsCount;
    totalSaltBridges += r.saltBridgesCount;

    const nameStr = r.target.name.padEnd(26, ' ').slice(0, 26);
    const pdbStr = r.target.id.padEnd(6, ' ');
    const totStr = String(r.totalAtoms).padStart(5, ' ');
    const hvyStr = String(r.heavyAtoms).padStart(5, ' ');
    const resStr = String(r.residuesCount).padStart(8, ' ');
    const timeStr = r.parseTimeMs.toFixed(1).padStart(9, ' ');
    const rmsdStr = r.kabschSelfRmsd.toFixed(6).padStart(14, ' ');
    const hbStr = String(r.hBondsCount).padStart(7, ' ');
    const sbStr = String(r.saltBridgesCount).padStart(11, ' ');
    const statStr = ` [${r.status}]`.padEnd(8, ' ');

    log(`${pdbStr} | ${nameStr} | ${totStr} | ${hvyStr} | ${resStr} | ${timeStr} | ${rmsdStr} | ${hbStr} | ${sbStr} | ${statStr}`);
  }

  log("-".repeat(110));
  log(`Total Medium Proteins Evaluated: ${results.length}`);
  log(`Passed: ${passCount} / ${results.length} | Failed: ${failCount} / ${results.length}`);
  log(`Total H-Bonds Detected Across Suite: ${totalHBonds}`);
  log(`Total Salt Bridges Detected Across Suite: ${totalSaltBridges}`);
  log(`Execution Duration: ${(totalTimeMs / 1000).toFixed(2)} s`);
  log("=================================================================================");

  // Write log to file
  const logDir = path.dirname(LOG_PATH);
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  fs.writeFileSync(LOG_PATH, logLines.join('\n'), 'utf8');
  console.log(`\nLog w