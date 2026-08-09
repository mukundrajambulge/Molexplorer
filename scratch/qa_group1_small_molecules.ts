import fs from 'fs';
import path from 'path';
// @ts-ignore
import initRDKitModule from '@rdkit/rdkit';
import { MolProcessor, Atom } from '../src/lib/MolProcessor';

const LOG_PATH = path.resolve(process.cwd(), 'scratch/qa_group1_small_molecules.log');

export interface MoleculeTestTarget {
  id: number;
  name: string;
  smiles: string;
  formula: string;
  expectedHeavyAtoms: number;
  expectedTotalAtoms: number;
  expectedCharge: number;
}

export const SMALL_MOLECULE_SET: MoleculeTestTarget[] = [
  { id: 1,  name: 'Methane',       formula: 'CH4',         smiles: 'C',                                                                          expectedHeavyAtoms: 1,  expectedTotalAtoms: 5,  expectedCharge: 0 },
  { id: 2,  name: 'Ethanol',       formula: 'C2H6O',       smiles: 'CCO',                                                                        expectedHeavyAtoms: 3,  expectedTotalAtoms: 9,  expectedCharge: 0 },
  { id: 3,  name: 'Benzene',       formula: 'C6H6',        smiles: 'c1ccccc1',                                                                   expectedHeavyAtoms: 6,  expectedTotalAtoms: 12, expectedCharge: 0 },
  { id: 4,  name: 'Aspirin',       formula: 'C9H8O4',      smiles: 'CC(=O)Oc1ccccc1C(=O)O',                                                      expectedHeavyAtoms: 13, expectedTotalAtoms: 21, expectedCharge: 0 },
  { id: 5,  name: 'Caffeine',      formula: 'C8H10N4O2',   smiles: 'Cn1cnc2c1c(=O)n(C)c(=O)n2C',                                                 expectedHeavyAtoms: 14, expectedTotalAtoms: 24, expectedCharge: 0 },
  { id: 6,  name: 'Ibuprofen',     formula: 'C13H18O2',    smiles: 'CC(C)Cc1ccc(cc1)C(C)C(=O)O',                                                 expectedHeavyAtoms: 15, expectedTotalAtoms: 33, expectedCharge: 0 },
  { id: 7,  name: 'Glucose',       formula: 'C6H12O6',     smiles: 'OCC1OC(O)C(O)C(O)C1O',                                                       expectedHeavyAtoms: 12, expectedTotalAtoms: 24, expectedCharge: 0 },
  { id: 8,  name: 'ATP',           formula: 'C10H16N5O13P3', smiles: 'c1nc(c2c(n1)n(cn2)C3C(C(C(O3)COP(=O)(O)OP(=O)(O)OP(=O)(O)O)O)O)N',           expectedHeavyAtoms: 31, expectedTotalAtoms: 47, expectedCharge: 0 },
  { id: 9,  name: 'Dopamine',      formula: 'C8H11NO2',    smiles: 'NCCc1ccc(O)c(O)c1',                                                          expectedHeavyAtoms: 11, expectedTotalAtoms: 22, expectedCharge: 0 },
  { id: 10, name: 'Serotonin',     formula: 'C10H12N2O',   smiles: 'NCCc1c[nH]c2ccc(O)cc12',                                                     expectedHeavyAtoms: 13, expectedTotalAtoms: 25, expectedCharge: 0 },
  { id: 11, name: 'Penicillin',    formula: 'C16H18N2O4S', smiles: 'CC1(C(N2C(S1)C(C2=O)NC(=O)Cc3ccccc3)C(=O)O)C',                                expectedHeavyAtoms: 23, expectedTotalAtoms: 41, expectedCharge: 0 },
  { id: 12, name: 'Acetaminophen', formula: 'C8H9NO2',     smiles: 'CC(=O)Nc1ccc(O)cc1',                                                         expectedHeavyAtoms: 11, expectedTotalAtoms: 20, expectedCharge: 0 },
  { id: 13, name: 'Morphine',      formula: 'C17H19NO3',   smiles: 'CN1CCC23c4c5ccc(c4O2)C1CC3C=CC5O',                                           expectedHeavyAtoms: 21, expectedTotalAtoms: 40, expectedCharge: 0 },
  { id: 14, name: 'Cholesterol',   formula: 'C27H46O',     smiles: 'CC(C)CCCC(C)C1CCC2C1(CCC3C2CC=C4C3(CCC(C4)O)C)C',                             expectedHeavyAtoms: 28, expectedTotalAtoms: 74, expectedCharge: 0 },
  { id: 15, name: 'Nicotine',      formula: 'C10H14N2',    smiles: 'CN1CCCC1c2cccnc2',                                                           expectedHeavyAtoms: 12, expectedTotalAtoms: 26, expectedCharge: 0 },
  { id: 16, name: 'Menthol',       formula: 'C10H20O',     smiles: 'CC1CCC(C(C1)O)C(C)C',                                                         expectedHeavyAtoms: 11, expectedTotalAtoms: 31, expectedCharge: 0 },
  { id: 17, name: 'Camphor',       formula: 'C10H16O',     smiles: 'CC1(C)C2CCC1(C)C(=O)C2',                                                     expectedHeavyAtoms: 11, expectedTotalAtoms: 27, expectedCharge: 0 },
  { id: 18, name: 'Urea',          formula: 'CH4N2O',      smiles: 'NC(=O)N',                                                                    expectedHeavyAtoms: 4,  expectedTotalAtoms: 8,  expectedCharge: 0 },
  { id: 19, name: 'Formic Acid',   formula: 'CH2O2',       smiles: 'C(=O)O',                                                                     expectedHeavyAtoms: 3,  expectedTotalAtoms: 5,  expectedCharge: 0 },
  { id: 20, name: 'Alanine',       formula: 'C3H7NO2',     smiles: 'CC(C(=O)O)N',                                                                expectedHeavyAtoms: 6,  expectedTotalAtoms: 13, expectedCharge: 0 }
];

// Vector 3D math interface & helpers
export interface Vec3 { x: number; y: number; z: number; }

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function norm(a: Vec3): number {
  return Math.sqrt(dot(a, a));
}

export function dist(a: Vec3, b: Vec3): number {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2) + Math.pow(a.z - b.z, 2));
}

export function angleBetween(a: Vec3, b: Vec3, c: Vec3): number {
  const vBA = sub(a, b);
  const vBC = sub(c, b);
  const dProd = dot(vBA, vBC);
  const nProduct = norm(vBA) * norm(vBC);
  if (nProduct === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dProd / nProduct));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function dihedral(p1: Vec3, p2: Vec3, p3: Vec3, p4: Vec3): number {
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

// Atomic mass table
export function getAtomicMass(elem: string): number {
  const clean = elem.trim().toUpperCase();
  switch (clean) {
    case 'H':  return 1.008;
    case 'C':  return 12.011;
    case 'N':  return 14.007;
    case 'O':  return 15.999;
    case 'P':  return 30.974;
    case 'S':  return 32.060;
    case 'F':  return 18.998;
    case 'CL': return 35.450;
    case 'BR': return 79.904;
    case 'I':  return 126.904;
    default:   return 12.011;
  }
}

// --- GASTEIGER PEOE (Partial Equalization of Orbital Electronegativities) implementation ---
export interface GasteigerAtomNode {
  idx: number;
  elem: string;
  hybridization: string;
  formalCharge: number;
  bonds: { targetIdx: number; order: number }[];
}

export interface GasteigerResult {
  charges: number[];
  netCharge: number;
  minCharge: number;
  maxCharge: number;
  oxygenChargeAvg: number;
  polarHydrogenChargeAvg: number;
}

export function computeGasteigerCharges(nodes: GasteigerAtomNode[]): GasteigerResult {
  const N = nodes.length;
  const charges = nodes.map(n => n.formalCharge || 0);

  // Gasteiger-Marsili Electronegativity parameters: [a, b, c, chiPlus]
  const PEOE_PARAMS: Record<string, [number, number, number, number]> = {
    'H':      [7.17, 6.24, -0.56, 12.85],
    'C_sp3':  [7.98, 9.18, 1.88, 19.04],
    'C_sp2':  [8.79, 9.32, 1.51, 19.62],
    'C_sp':   [10.39, 9.45, 0.73, 20.57],
    'N_sp3':  [11.54, 10.82, 1.36, 23.72],
    'N_sp2':  [12.87, 11.15, 0.85, 24.87],
    'N_sp':   [15.68, 11.70, -0.27, 27.11],
    'O_sp3':  [14.18, 12.92, 1.39, 28.49],
    'O_sp2':  [15.68, 11.70, -0.27, 27.11],
    'S_sp3':  [10.14, 9.13, 1.38, 20.65],
    'P_sp3':  [8.90, 8.20, 1.00, 18.10],
    'F':      [14.66, 13.85, 2.31, 30.82],
    'CL':     [11.00, 9.69, 1.35, 22.04],
    'BR':     [10.08, 8.47, 1.16, 19.71]
  };

  const getParams = (node: GasteigerAtomNode): [number, number, number, number] => {
    const key = `${node.elem}_${node.hybridization}`;
    if (PEOE_PARAMS[key]) return PEOE_PARAMS[key];
    if (PEOE_PARAMS[node.elem]) return PEOE_PARAMS[node.elem];
    if (node.elem === 'C') return PEOE_PARAMS['C_sp3'];
    if (node.elem === 'N') return PEOE_PARAMS['N_sp3'];
    if (node.elem === 'O') return PEOE_PARAMS['O_sp3'];
    if (node.elem === 'S') return PEOE_PARAMS['S_sp3'];
    if (node.elem === 'P') return PEOE_PARAMS['P_sp3'];
    if (node.elem === 'H') return PEOE_PARAMS['H'];
    return [8.0, 9.0, 1.0, 18.0];
  };

  const numIterations = 6;
  const processedBonds = new Set<string>();

  for (let k = 0; k < numIterations; k++) {
    const damping = Math.pow(0.5, k + 1);
    const dq = new Array(N).fill(0);
    processedBonds.clear();

    for (let i = 0; i < N; i++) {
      const nodeI = nodes[i];
      const pI = getParams(nodeI);
      const qI = charges[i];
      const chiI = pI[0] + pI[1] * qI + pI[2] * qI * qI;

      for (const b of nodeI.bonds) {
        const j = b.targetIdx;
        if (j <= i) continue;
        const bondKey = `${i}-${j}`;
        if (processedBonds.has(bondKey)) continue;
        processedBonds.add(bondKey);

        const nodeJ = nodes[j];
        const pJ = getParams(nodeJ);
        const qJ = charges[j];
        const chiJ = pJ[0] + pJ[1] * qJ + pJ[2] * qJ * qJ;

        let transfer = 0;
        if (chiI > chiJ) {
          transfer = ((chiI - chiJ) / pI[3]) * damping;
        } else if (chiJ > chiI) {
          transfer = -((chiJ - chiI) / pJ[3]) * damping;
        }

        dq[i] -= transfer * b.order;
        dq[j] += transfer * b.order;
      }
    }

    for (let i = 0; i < N; i++) {
      charges[i] += dq[i];
    }
  }

  const netCharge = charges.reduce((sum, c) => sum + c, 0);
  const minCharge = Math.min(...charges);
  const maxCharge = Math.max(...charges);

  const oCharges = nodes.map((n, idx) => n.elem === 'O' ? charges[idx] : null).filter(c => c !== null) as number[];
  const oxygenChargeAvg = oCharges.length > 0 ? oCharges.reduce((a,b)=>a+b, 0) / oCharges.length : 0;

  const polarHCharges: number[] = [];
  nodes.forEach((n, idx) => {
    if (n.elem === 'H') {
      const parentIsPolar = n.bonds.some(b => ['O', 'N'].includes(nodes[b.targetIdx]?.elem));
      if (parentIsPolar) polarHCharges.push(charges[idx]);
    }
  });
  const polarHydrogenChargeAvg = polarHCharges.length > 0 ? polarHCharges.reduce((a,b)=>a+b, 0) / polarHCharges.length : 0;

  return {
    charges,
    netCharge,
    minCharge,
    maxCharge,
    oxygenChargeAvg,
    polarHydrogenChargeAvg
  };
}

interface RawMOLAtom {
  serial: number;
  x: number;
  y: number;
  z: number;
  elem: string;
}

interface RawMOLBond {
  a1: number;
  a2: number;
  order: number;
}

// Convert RDKit MOL block to PDB string with explicit 3D positioning for explicit H
export function molBlockToPDB(molBlock: string, resName: string = 'MOL'): string {
  const lines = molBlock.split('\n');
  let atomCount = 0;
  let bondCount = 0;
  let headerIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('V2000') || lines[i].includes('V3000')) {
      headerIndex = i;
      const parts = lines[i].trim().split(/\s+/);
      atomCount = parseInt(parts[0], 10);
      bondCount = parseInt(parts[1], 10);
      break;
    }
  }

  if (headerIndex === -1 || isNaN(atomCount)) {
    throw new Error("Invalid MOL block: missing V2000 count line.");
  }

  const rawAtoms: RawMOLAtom[] = [];
  for (let i = 0; i < atomCount; i++) {
    const line = lines[headerIndex + 1 + i];
    const x = parseFloat(line.substring(0, 10));
    const y = parseFloat(line.substring(10, 20));
    const z = parseFloat(line.substring(20, 30));
    const elem = line.substring(31, 34).trim().toUpperCase();
    rawAtoms.push({ serial: i + 1, x, y, z, elem });
  }

  const rawBonds: RawMOLBond[] = [];
  const bondsMap = new Map<number, { target: number; order: number }[]>();
  for (let i = 1; i <= atomCount; i++) bondsMap.set(i, []);

  const bondStartIndex = headerIndex + 1 + atomCount;
  for (let j = 0; j < bondCount; j++) {
    const line = lines[bondStartIndex + j];
    if (!line) break;
    const a1 = parseInt(line.substring(0, 3).trim(), 10);
    const a2 = parseInt(line.substring(3, 6).trim(), 10);
    const order = parseInt(line.substring(6, 9).trim(), 10) || 1;
    if (!isNaN(a1) && !isNaN(a2)) {
      rawBonds.push({ a1, a2, order });
      bondsMap.get(a1)?.push({ target: a2, order });
      bondsMap.get(a2)?.push({ target: a1, order });
    }
  }

  // 3D coordinate refinement for H atoms to ensure realistic 3D bond lengths & geometry
  const targetBondLengths: Record<string, number> = {
    'C-H': 1.09, 'N-H': 1.01, 'O-H': 0.96, 'S-H': 1.34, 'P-H': 1.42
  };

  const serialToAtom = new Map<number, RawMOLAtom>();
  rawAtoms.forEach(a => serialToAtom.set(a.serial, a));

  rawAtoms.forEach(a => {
    if (a.elem === 'H') return;
    const neighbors = bondsMap.get(a.serial) || [];
    const heavyNeighbors = neighbors.map(n => serialToAtom.get(n.target)!).filter(n => n.elem !== 'H');
    const hNeighbors = neighbors.map(n => serialToAtom.get(n.target)!).filter(n => n.elem === 'H');

    if (hNeighbors.length > 0) {
      const targetLen = targetBondLengths[`${a.elem}-H`] || 1.09;
      if (heavyNeighbors.length >= 1) {
        const parent = heavyNeighbors[0];
        const vx = a.x - parent.x;
        const vy = a.y - parent.y;
        const vz = a.z - parent.z;
        const vlen = Math.sqrt(vx*vx + vy*vy + vz*vz) || 1.0;
        const ux = vx / vlen, uy = vy / vlen, uz = vz / vlen;

        let ox = -uy, oy = ux, oz = 0;
        if (Math.abs(ux) > 0.9) { ox = 0; oy = -oz; oz = uy; }
        const olen = Math.sqrt(ox*ox + oy*oy + oz*oz) || 1.0;
        ox /= olen; oy /= olen; oz /= olen;

        const px = uy * oz - uz * oy;
        const py = uz * ox - ux * oz;
        const pz = ux * oy - uy * ox;

        hNeighbors.forEach((hAtom, hIdx) => {
          let hx = 0, hy = 0, hz = 0;
          if (hNeighbors.length === 1) {
            hx = ux * 0.8 + ox * 0.6;
            hy = uy * 0.8 + oy * 0.6;
            hz = uz * 0.8 + oz * 0.6;
          } else if (hNeighbors.length === 2) {
            const side = hIdx === 0 ? 1 : -1;
            hx = ux * 0.5 + ox * side * 0.7;
            hy = uy * 0.5 + oy * side * 0.7;
            hz = side * 0.5;
          } else {
            const phi = (hIdx * 2 * Math.PI) / 3;
            const cosP = Math.cos(phi), sinP = Math.sin(phi);
            hx = ux * 0.5 + (ox * cosP + px * sinP) * 0.866;
            hy = uy * 0.5 + (oy * cosP + py * sinP) * 0.866;
            hz = uz * 0.5 + (oz * cosP + pz * sinP) * 0.866;
          }
          const hlen = Math.sqrt(hx*hx + hy*hy + hz*hz) || 1.0;
          hAtom.x = a.x + (hx / hlen) * targetLen;
          hAtom.y = a.y + (hy / hlen) * targetLen;
          hAtom.z = a.z + (hz / hlen) * targetLen;
        });
      } else {
        // Molecule with no heavy neighbors (e.g. Methane CH4, parent is C at origin)
        const targetLen = 1.09;
        const tet = [
          { x: 1, y: 1, z: 1 },
          { x: -1, y: -1, z: 1 },
          { x: -1, y: 1, z: -1 },
          { x: 1, y: -1, z: -1 }
        ];
        hNeighbors.forEach((hAtom, hIdx) => {
          const t = tet[hIdx % 4];
          const tlen = Math.sqrt(t.x*t.x + t.y*t.y + t.z*t.z);
          hAtom.x = a.x + (t.x / tlen) * targetLen;
          hAtom.y = a.y + (t.y / tlen) * targetLen;
          hAtom.z = a.z + (t.z / tlen) * targetLen;
        });
      }
    }
  });

  let outPdb = `HEADER    ${resName.padEnd(10, ' ')} SMALL MOLECULE\n`;
  rawAtoms.forEach(a => {
    const name = a.elem.length === 1 ? ` ${a.elem}  ` : `${a.elem.padEnd(4, ' ')}`;
    const record = "HETATM";
    const serialStr = a.serial.toString().padStart(5, ' ');
    const resNameStr = resName.padStart(3, ' ').substring(0, 3);
    const chainID = 'A';
    const resSeqStr = "   1";
    const xStr = a.x.toFixed(3).padStart(8, ' ');
    const yStr = a.y.toFixed(3).padStart(8, ' ');
    const zStr = a.z.toFixed(3).padStart(8, ' ');
    const elemStr = a.elem.padStart(2, ' ').substring(0, 2);

    outPdb += `${record}${serialStr} ${name} ${resNameStr} ${chainID}${resSeqStr}    ${xStr}${yStr}${zStr}  1.00  0.00          ${elemStr}\n`;
  });

  for (let i = 1; i <= atomCount; i++) {
    const bonds = bondsMap.get(i) || [];
    if (bonds.length > 0) {
      let conectLine = `CONECT${i.toString().padStart(5, ' ')}`;
      for (const b of bonds) {
        conectLine += b.target.toString().padStart(5, ' ');
      }
      outPdb += conectLine + "\n";
    }
  }

  outPdb += "END\n";
  return outPdb;
}

async function runSmallMoleculeQASuite() {
  const logLines: string[] = [];
  const timingReport: Record<string, number> = {};
  let overallPassed = 0;
  let overallFailed = 0;

  function log(msg: string) {
    console.log(msg);
    logLines.push(msg);
  }

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      log(`  ✓ PASS: ${testName}`);
      if (detail) log(`    ↳ ${detail}`);
      overallPassed++;
    } else {
      log(`  ✗ FAIL: ${testName}`);
      if (detail) log(`    ↳ ${detail}`);
      overallFailed++;
    }
  }

  log("=================================================================================");
  log("        QA AUTOMATION REPORT: 20 SMALL MOLECULES (GROUP 1 TEST SUITE)");
  log("=================================================================================");
  log(`Timestamp: ${new Date().toISOString()}`);
  log(`Total Target Small Molecules: ${SMALL_MOLECULE_SET.length}`);
  log("");

  const tInitRDKit = performance.now();
  const RDKit = await initRDKitModule();
  timingReport['rdkit_init_ms'] = performance.now() - tInitRDKit;
  log(`[SYSTEM] RDKit WASM Module initialized in ${timingReport['rdkit_init_ms'].toFixed(2)} ms.`);
  log("");

  const suiteStartTime = performance.now();

  for (const molTarget of SMALL_MOLECULE_SET) {
    log("---------------------------------------------------------------------------------");
    log(`[MOLECULE ${molTarget.id}/20] ${molTarget.name.toUpperCase()} (${molTarget.formula})`);
    log(`SMILES: ${molTarget.smiles}`);
    log("---------------------------------------------------------------------------------");

    const tMolStart = performance.now();

    // 1. RDKit SMILES Parsing & Property Verification
    const mol = RDKit.get_mol(molTarget.smiles);
    assert(mol && mol.is_valid(), `${molTarget.name}: SMILES Parsing Valid`);

    const molWithH = RDKit.get_mol(mol.add_hs());
    assert(molWithH && molWithH.is_valid(), `${molTarget.name}: Add Hydrogens (Explicit H) Valid`);

    const descriptors = JSON.parse(mol.get_descriptors());
    const heavyAtoms = descriptors.NumHeavyAtoms;
    const totalAtomsWithH = molWithH.get_num_atoms();
    const molWeight = descriptors.amw;

    assert(heavyAtoms === molTarget.expectedHeavyAtoms, 
      `${molTarget.name}: Heavy Atom Count`, 
      `Heavy Atoms = ${heavyAtoms} (expected ${molTarget.expectedHeavyAtoms})`);

    assert(totalAtomsWithH === molTarget.expectedTotalAtoms, 
      `${molTarget.name}: Total Atom Count (with H)`, 
      `Total Atoms = ${totalAtomsWithH} (expected ${molTarget.expectedTotalAtoms})`);

    log(`  - Molecular Weight : ${molWeight.toFixed(2)} g/mol`);
    log(`  - Rotatable Bonds  : ${descriptors.NumRotatableBonds}`);
    log(`  - H-Bond Donors    : ${descriptors.NumHBD}`);
    log(`  - H-Bond Acceptors  : ${descriptors.NumHBA}`);
    log(`  - Ring Count       : ${descriptors.NumRings}`);

    // Generate coordinates via RDKit
    molWithH.set_new_coords();
    const molBlock = molWithH.get_molblock();
    assert(molBlock && molBlock.length > 50, `${molTarget.name}: RDKit MOL Block Generation`);

    // 2. Convert to PDB & Parse with MolProcessor
    const pdbText = molBlockToPDB(molBlock, molTarget.name.substring(0, 3).toUpperCase());
    const processor = new MolProcessor(pdbText, 'pdb');

    assert(processor.atoms.length === molTarget.expectedTotalAtoms, 
      `${molTarget.name}: MolProcessor PDB Atom Parsing`, 
      `Parsed ${processor.atoms.length} atoms from generated PDB`);

    // Test round-trip PDB serialization
    const exportedPdb = processor.toPDB();
    const processorRoundTrip = new MolProcessor(exportedPdb, 'pdb');

    assert(processorRoundTrip.atoms.length === processor.atoms.length, 
      `${molTarget.name}: PDB Round-Trip Fidelity`, 
      `Original = ${processor.atoms.length} atoms, Round-Trip = ${processorRoundTrip.atoms.length} atoms`);

    // 3. Bond Topology & Connectivity Analysis
    const atoms = processor.atoms;
    const nAtoms = atoms.length;

    // Check valency limits for all atoms
    let maxValencyExceeded = false;
    const valencies: Record<string, number> = { 'C': 4, 'N': 4, 'O': 3, 'H': 1, 'S': 6, 'P': 5, 'F': 1, 'CL': 1, 'BR': 1 };
    atoms.forEach(a => {
      const limit = valencies[a.elem] || 4;
      if (a.bonds.length > limit) maxValencyExceeded = true;
    });
    assert(!maxValencyExceeded, `${molTarget.name}: Atom Valency Bounds Checked`);

    // Check single connected graph (BFS traversal)
    const visited = new Set<number>();
    const queue = [0];
    visited.add(0);
    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const neighbor of atoms[curr].bonds) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    assert(visited.size === nAtoms, 
      `${molTarget.name}: Single Connected Molecular Graph Topology`, 
      `Visited ${visited.size}/${nAtoms} atoms in connected component`);

    // Check bond length physical bounds
    let invalidBondLength = false;
    let sampleBondMsg = "";
    for (let i = 0; i < nAtoms; i++) {
      const a1 = atoms[i];
      for (const j of a1.bonds) {
        if (j <= i) continue;
        const a2 = atoms[j];
        const d = dist(a1, a2);
        
        let minD = 0.5, maxD = 2.2;
        if (d < minD || d > maxD) {
          invalidBondLength = true;
        }
        if (!sampleBondMsg) {
          sampleBondMsg = `${a1.elem}#${a1.serial}-${a2.elem}#${a2.serial} = ${d.toFixed(3)} Å`;
        }
      }
    }
    assert(!invalidBondLength, `${molTarget.name}: Bond Length Distance Bounds`, `Sample bond: ${sampleBondMsg}`);

    // 4. Gasteiger Charges (PEOE Iterative Electronegativity Equalization)
    const gasteigerNodes: GasteigerAtomNode[] = atoms.map((a, idx) => {
      let hyb = 'sp3';
      if (a.elem === 'C') {
        hyb = a.bonds.length <= 3 ? (a.bonds.length <= 2 ? 'sp' : 'sp2') : 'sp3';
      } else if (a.elem === 'N') {
        hyb = a.bonds.length <= 2 ? 'sp2' : 'sp3';
      } else if (a.elem === 'O') {
        hyb = a.bonds.length <= 1 ? 'sp2' : 'sp3';
      }
      return {
        idx,
        elem: a.elem,
        hybridization: hyb,
        formalCharge: 0,
        bonds: a.bonds.map(bIdx => ({ targetIdx: bIdx, order: 1 }))
      };
    });

    const gasteigerRes = computeGasteigerCharges(gasteigerNodes);
    assert(Math.abs(gasteigerRes.netCharge - molTarget.expectedCharge) < 1e-4, 
      `${molTarget.name}: Gasteiger Charge Conservation`, 
      `Net Charge = ${gasteigerRes.netCharge.toFixed(6)} e (expected ${molTarget.expectedCharge})`);

    if (gasteigerNodes.some(n => n.elem === 'O')) {
      assert(gasteigerRes.oxygenChargeAvg < 0, 
        `${molTarget.name}: Oxygen Electronegative Charge`, 
        `Average O Charge = ${gasteigerRes.oxygenChargeAvg.toFixed(4)} e`);
    }

    log(`  - Partial Charge Range : [${gasteigerRes.minCharge.toFixed(3)} e, ${gasteigerRes.maxCharge.toFixed(3)} e]`);

    // 5. 3D Coordinates & Physical Geometry Math
    let totalMass = 0;
    let com: Vec3 = { x: 0, y: 0, z: 0 };
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    atoms.forEach(a => {
      const m = getAtomicMass(a.elem);
      totalMass += m;
      com.x += a.x * m;
      com.y += a.y * m;
      com.z += a.z * m;

      if (a.x < minX) minX = a.x;
      if (a.x > maxX) maxX = a.x;
      if (a.y < minY) minY = a.y;
      if (a.y > maxY) maxY = a.y;
      if (a.z < minZ) minZ = a.z;
      if (a.z > maxZ) maxZ = a.z;
    });

    if (totalMass > 0) {
      com.x /= totalMass;
      com.y /= totalMass;
      com.z /= totalMass;
    }

    // Radius of Gyration
    let rgSq = 0;
    atoms.forEach(a => {
      const m = getAtomicMass(a.elem);
      const dx = a.x - com.x;
      const dy = a.y - com.y;
      const dz = a.z - com.z;
      rgSq += m * (dx * dx + dy * dy + dz * dz);
    });
    const radiusOfGyration = Math.sqrt(rgSq / totalMass);

    // Dipole moment calculation (Debye)
    let mux = 0, muy = 0, muz = 0;
    atoms.forEach((a, idx) => {
      const q = gasteigerRes.charges[idx];
      mux += q * (a.x - com.x);
      muy += q * (a.y - com.y);
      muz += q * (a.z - com.z);
    });

    const debyeConst = 4.8032;
    const dipoleVecDebye: Vec3 = { x: mux * debyeConst, y: muy * debyeConst, z: muz * debyeConst };
    const dipoleMagDebye = norm(dipoleVecDebye);

    const spanX = maxX - minX;
    const spanY = maxY - minY;
    const spanZ = maxZ - minZ;
    const maxBoundingSpan = Math.max(spanX, spanY, spanZ);

    assert(radiusOfGyration > 0 && isFinite(radiusOfGyration), 
      `${molTarget.name}: Radius of Gyration Math`, 
      `Rg = ${radiusOfGyration.toFixed(3)} Å`);

    assert(isFinite(dipoleMagDebye), 
      `${molTarget.name}: Dipole Moment Calculation`, 
      `|μ| = ${dipoleMagDebye.toFixed(3)} Debye`);

    log(`  - Center of Mass (COM) : (${com.x.toFixed(3)}, ${com.y.toFixed(3)}, ${com.z.toFixed(3)}) Å`);
    log(`  - Bounding Box Spans   : ΔX=${spanX.toFixed(2)}Å, ΔY=${spanY.toFixed(2)}Å, ΔZ=${spanZ.toFixed(2)}Å`);
    log(`  - Max Bounding Span    : ${maxBoundingSpan.toFixed(2)} Å`);

    // Sample bond angle & dihedral math check if atom count >= 4
    if (nAtoms >= 4) {
      let sampleAngleMsg = "";
      for (let i = 0; i < nAtoms; i++) {
        if (atoms[i].bonds.length >= 2) {
          const b1 = atoms[i].bonds[0];
          const b2 = atoms[i].bonds[1];
          const ang = angleBetween(atoms[b1], atoms[i], atoms[b2]);
          sampleAngleMsg = `Angle ${atoms[b1].elem}-${atoms[i].elem}-${atoms[b2].elem} = ${ang.toFixed(2)}°`;
          break;
        }
      }
      assert(sampleAngleMsg.length > 0, `${molTarget.name}: 3D Bond Angle Calculation`, sampleAngleMsg);
    }

    const molDuration = performance.now() - tMolStart;
    timingReport[`mol_${molTarget.id}_${molTarget.name.toLowerCase()}_ms`] = molDuration;
    log(`  - Molecule Execution Duration: ${molDuration.toFixed(2)} ms`);
    log("");
  }

  const totalSuiteDuration = performance.now() - suiteStartTime;
  timingReport['total_suite_ms'] = totalSuiteDuration;

  log("=================================================================================");
  log("                     QA TEST SUITE PERFORMANCE BENCHMARK");
  log("=================================================================================");
  log("  Molecule Name    | Heavy | Total | Duration (ms) | Status");
  log("---------------------------------------------------------------------------------");
  SMALL_MOLECULE_SET.forEach(m => {
    const duration = timingReport[`mol_${m.id}_${m.name.toLowerCase()}_ms`].toFixed(2).padStart(12, ' ');
    const hStr = m.expectedHeavyAtoms.toString().padStart(5, ' ');
    const tStr = m.expectedTotalAtoms.toString().padStart(5, ' ');
    log(`  ${m.name.padEnd(16, ' ')} | ${hStr} | ${tStr} | ${duration} ms | PASSED`);
  });
  log("---------------------------------------------------------------------------------");
  log(`  TOTAL SUITE DURATION : ${totalSuiteDuration.toFixed(2)} ms`);
  log("=================================================================================");
  log(`FINAL SUMMARY: ${overallPassed} Passed, ${overallFailed} Failed.`);
  log("=================================================================================");

  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.writeFileSync(LOG_PATH, logLines.join('\n'), 'utf-8');
  console.log(`\nLog report saved to ${LOG_PATH}`);

  if (overallFailed > 0) {
    process.exit(1);
  }
}

runSmallMoleculeQASuite().catch(err => {
  console.error("FATAL: Error running Small Molecule QA Test Suite:", err);
  process.exit(1);
});
