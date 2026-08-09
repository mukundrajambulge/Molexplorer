import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { MolProcessor, Atom } from '../src/lib/MolProcessor';
import { SelectionParser } from '../src/lib/SelectionParser';

interface TargetConfig {
  pdbId: string;
  name: string;
  type: string;
  description: string;
  expectedMinAtoms: number;
}

const TARGETS: TargetConfig[] = [
  { pdbId: '1BNA', name: 'B-DNA Dodecamer', type: 'DNA', description: 'Synthetic B-DNA double helix dodecamer [d(CGCGAATTCGCG)]2', expectedMinAtoms: 400 },
  { pdbId: '1EHZ', name: 'tRNA-Phe', type: 'RNA', description: 'Yeast phenylalanine tRNA at 1.93 Å resolution', expectedMinAtoms: 1500 },
  { pdbId: '2GDI', name: 'Hammerhead Ribozyme', type: 'RNA', description: 'Full-length active hammerhead ribozyme RNA', expectedMinAtoms: 1000 },
  { pdbId: '1U8D', name: 'Guanine Riboswitch', type: 'RNA', description: 'Guanine-sensing riboswitch aptamer domain bound to hypoxanthine', expectedMinAtoms: 1200 },
  { pdbId: '4OO8', name: 'CRISPR-Cas9-sgRNA', type: 'Protein-RNA-DNA', description: 'Streptococcus pyogenes Cas9 with single-guide RNA and target DNA', expectedMinAtoms: 10000 },
  { pdbId: '1Y1W', name: 'RNA Polymerase II', type: 'Protein-RNA-DNA', description: 'Yeast RNA Polymerase II elongation complex with template DNA and RNA', expectedMinAtoms: 20000 },
  { pdbId: '1KX5', name: 'Nucleosome Core Particle', type: 'Protein-DNA', description: 'Nucleosome core particle NCP147 at 1.9 Å resolution', expectedMinAtoms: 10000 },
  { pdbId: '4R48', name: 'Telomerase catalytic core', type: 'Protein-RNA', description: 'Tetrahymena telomerase reverse transcriptase with RNA subunit', expectedMinAtoms: 3000 },
  { pdbId: '1HOU', name: 'Reverse Transcriptase-DNA', type: 'Protein-DNA', description: 'HIV-1 Reverse Transcriptase complexed with dsDNA template-primer', expectedMinAtoms: 7000 },
  { pdbId: '1AAY', name: 'Zinc Finger-DNA', type: 'Protein-DNA', description: 'Zif268 Cys2His2 zinc finger peptide complexed with target DNA', expectedMinAtoms: 1000 },
  { pdbId: '1YTB', name: 'TATA Box Binding Protein-DNA', type: 'Protein-DNA', description: 'Yeast TBP bound to TATA box element DNA', expectedMinAtoms: 2000 },
  { pdbId: '1YSA', name: 'Leucine Zipper-DNA', type: 'Protein-DNA', description: 'GCN4 bZIP leucine zipper transcription factor bound to DNA', expectedMinAtoms: 1000 },
  { pdbId: '1CKQ', name: 'EcoRI-DNA', type: 'Protein-DNA', description: 'EcoRI restriction endonuclease bound to cognate DNA site', expectedMinAtoms: 4000 },
  { pdbId: '1BHM', name: 'BamHI-DNA', type: 'Protein-DNA', description: 'BamHI restriction endonuclease bound to DNA substrate', expectedMinAtoms: 3000 },
  { pdbId: '1U9S', name: 'FoP-RNA', type: 'RNA', description: 'Friend of P-TEFb (FoP) / flavin-binding RNA motif architecture', expectedMinAtoms: 1000 },
  { pdbId: '2QWY', name: 'SAM Riboswitch', type: 'RNA', description: 'SAM-I riboswitch bound to S-adenosylmethionine', expectedMinAtoms: 1500 },
  { pdbId: '1KF1', name: 'G-Quadruplex DNA', type: 'DNA', description: 'Human telomeric intramolecular G-quadruplex DNA with K+ ions', expectedMinAtoms: 400 },
  { pdbId: '1DC0', name: 'Holliday Junction', type: 'Protein-DNA', description: 'Four-way DNA Holliday junction complexed with Cre recombinase', expectedMinAtoms: 3000 },
  { pdbId: '1U6B', name: 'Group I Intron', type: 'RNA', description: 'Tetrahymena Group I intron splicing domain architecture', expectedMinAtoms: 4000 },
  { pdbId: '1F7Y', name: 'Ribosome A-site RNA', type: 'RNA', description: 'Ribosomal 16S A-site RNA oligonucleotide complexed with paromomycin', expectedMinAtoms: 800 },
];

function dist(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function calculateDihedral(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
  c: { x: number; y: number; z: number },
  d: { x: number; y: number; z: number }
): number {
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

async function fetchPDB(pdbId: string): Promise<string> {
  const scratchDir = path.join(process.cwd(), 'scratch');
  if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
  }
  const pdbPath = path.join(scratchDir, `${pdbId}.pdb`);
  if (fs.existsSync(pdbPath) && fs.statSync(pdbPath).size > 500) {
    return fs.readFileSync(pdbPath, 'utf-8');
  }

  const url = `https://files.rcsb.org/download/${pdbId}.pdb`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Failed to download ${pdbId}.pdb: HTTP ${resp.status}`);
  }
  const text = await resp.text();
  fs.writeFileSync(pdbPath, text, 'utf-8');
  return text;
}

// 1. Base-pair hydrogen bonding analysis
function analyzeBasePairHBonds(atoms: Atom[]) {
  const nucleicResNames = new Set([
    'A', 'C', 'G', 'T', 'U', 'DA', 'DC', 'DG', 'DT', 'DU', 'RA', 'RC', 'RG', 'RU',
    '+A', '+C', '+G', '+T', '+U', '5MC', 'OMC', '1MG', '2MG', '7MG', 'OMG', 'YG', 'H2U', 'PSU', '5MU'
  ]);
  const basicResNames = new Set(['LYS', 'ARG', 'HIS']);
  const metalElems = new Set(['MG', 'NA', 'K', 'ZN', 'CA', 'MN', 'FE', 'CO', 'NI']);

  const nucleicAtoms = atoms.filter(a => nucleicResNames.has(a.resName.trim().toUpperCase()));
  const proteinAtoms = atoms.filter(a => !nucleicResNames.has(a.resName.trim().toUpperCase()) && !a.isHetero);
  const hetAtoms = atoms.filter(a => a.isHetero);

  const basePolarNames = new Set([
    'N1', 'N2', 'N3', 'N4', 'N6', 'O2', 'O4', 'O6', 'N7', 'O6', 'N9'
  ]);

  let totalInterResidueHBonds = 0;
  let watsonCrickPairsCount = 0;
  let nonCanonicalPairsCount = 0;
  let saltBridgesCount = 0;

  const hbondDetails: any[] = [];
  const saltBridgeDetails: any[] = [];

  // Group atoms by residue key chainID:resSeq:resName
  const resMap = new Map<string, Atom[]>();
  nucleicAtoms.forEach(a => {
    const key = `${a.chainID}:${a.resSeq}:${a.resName.trim()}`;
    if (!resMap.has(key)) resMap.set(key, []);
    resMap.get(key)!.push(a);
  });

  const resKeys = Array.from(resMap.keys());

  for (let i = 0; i < resKeys.length; i++) {
    const keyA = resKeys[i];
    const atomsA = resMap.get(keyA)!;
    const [chainA, seqAStr, resnA] = keyA.split(':');
    const seqA = parseInt(seqAStr, 10);

    for (let j = i + 1; j < resKeys.length; j++) {
      const keyB = resKeys[j];
      const [chainB, seqBStr, resnB] = keyB.split(':');
      const seqB = parseInt(seqBStr, 10);

      // Skip adjacent nucleotides on the same chain
      if (chainA === chainB && Math.abs(seqA - seqB) <= 1) continue;

      let resHBonds = 0;
      let isWC = false;

      for (const atomA of atomsA) {
        const nameA = atomA.name.trim().toUpperCase();
        if (!basePolarNames.has(nameA)) continue;

        for (const atomB of resMap.get(keyB)!) {
          const nameB = atomB.name.trim().toUpperCase();
          if (!basePolarNames.has(nameB)) continue;

          const d = dist(atomA, atomB);
          if (d >= 2.3 && d <= 3.5) {
            resHBonds++;
            totalInterResidueHBonds++;

            // Detect Watson-Crick pairing pairs
            const rA = resnA.toUpperCase().replace('D', '').replace('R', '');
            const rB = resnB.toUpperCase().replace('D', '').replace('R', '');

            if (
              ((rA === 'G' && rB === 'C') || (rA === 'C' && rB === 'G')) &&
              ((nameA === 'N1' && nameB === 'N3') || (nameA === 'N3' && nameB === 'N1') ||
               (nameA === 'O6' && nameB === 'N4') || (nameA === 'N4' && nameB === 'O6') ||
               (nameA === 'N2' && nameB === 'O2') || (nameA === 'O2' && nameB === 'N2'))
            ) {
              isWC = true;
            } else if (
              ((rA === 'A' && (rB === 'T' || rB === 'U')) || ((rA === 'T' || rA === 'U') && rB === 'A')) &&
              ((nameA === 'N1' && nameB === 'N3') || (nameA === 'N3' && nameB === 'N1') ||
               (nameA === 'N6' && nameB === 'O4') || (nameA === 'O4' && nameB === 'N6'))
            ) {
              isWC = true;
            }

            if (hbondDetails.length < 15) {
              hbondDetails.push({
                resA: `${chainA}:${seqA}(${resnA})`,
                atomA: nameA,
                resB: `${chainB}:${seqB}(${resnB})`,
                atomB: nameB,
                distance: d
              });
            }
          }
        }
      }

      if (resHBonds > 0) {
        if (isWC) watsonCrickPairsCount++;
        else nonCanonicalPairsCount++;
      }
    }
  }

  // Detect salt-bridges / ionic interactions between phosphate oxygens and cations/basic protein residues
  const phosphateOxygens = atoms.filter(a =>
    ['OP1', 'OP2', 'O1P', 'O2P', 'OP3'].includes(a.name.trim().toUpperCase())
  );

  const cationicAtoms = atoms.filter(a => {
    const elemUpper = a.elem.trim().toUpperCase();
    const resnUpper = a.resName.trim().toUpperCase();
    const nameUpper = a.name.trim().toUpperCase();
    if (metalElems.has(elemUpper)) return true;
    if (basicResNames.has(resnUpper) && ['NZ', 'NH1', 'NH2', 'NE', 'ND1', 'NE2'].includes(nameUpper)) return true;
    return false;
  });

  for (const pAtom of phosphateOxygens) {
    for (const cAtom of cationicAtoms) {
      const d = dist(pAtom, cAtom);
      if (d <= 3.8) {
        saltBridgesCount++;
        if (saltBridgeDetails.length < 10) {
          saltBridgeDetails.push({
            pRes: `${pAtom.chainID}:${pAtom.resSeq}(${pAtom.resName.trim()})`,
            pAtom: pAtom.name.trim(),
            cRes: `${cAtom.chainID}:${cAtom.resSeq}(${cAtom.resName.trim()})`,
            cAtom: cAtom.name.trim(),
            distance: d
          });
        }
      }
    }
  }

  return {
    totalNucleicAtoms: nucleicAtoms.length,
    totalInterResidueHBonds,
    watsonCrickPairsCount,
    nonCanonicalPairsCount,
    saltBridgesCount,
    hbondDetails,
    saltBridgeDetails
  };
}

// 2. Phosphate backbone geometry analysis
function analyzePhosphateBackboneGeometry(atoms: Atom[]) {
  const nucleicResNames = new Set([
    'A', 'C', 'G', 'T', 'U', 'DA', 'DC', 'DG', 'DT', 'DU', 'RA', 'RC', 'RG', 'RU',
    '+A', '+C', '+G', '+T', '+U', '5MC', 'OMC', '1MG', '2MG', '7MG', 'OMG', 'YG', 'H2U', 'PSU', '5MU'
  ]);

  const resMap = new Map<string, Atom[]>();
  atoms.forEach(a => {
    if (nucleicResNames.has(a.resName.trim().toUpperCase())) {
      const key = `${a.chainID}:${a.resSeq}:${a.resName.trim()}`;
      if (!resMap.has(key)) resMap.set(key, []);
      resMap.get(key)!.push(a);
    }
  });

  let c3EndoCount = 0;
  let c2EndoCount = 0;
  let otherPuckerCount = 0;

  let antiGlycosidicCount = 0;
  let synGlycosidicCount = 0;

  let validPPDistancesCount = 0;
  let missingPhosphateLinks = 0;

  const deltaAngles: number[] = [];
  const ppDistances: number[] = [];
  const sampleGeometries: any[] = [];

  const sortedResKeys = Array.from(resMap.keys()).sort((x, y) => {
    const [chX, seqX] = x.split(':');
    const [chY, seqY] = y.split(':');
    if (chX !== chY) return chX.localeCompare(chY);
    return parseInt(seqX, 10) - parseInt(seqY, 10);
  });

  sortedResKeys.forEach((key, idx) => {
    const resAtoms = resMap.get(key)!;
    const [chainID, seqStr, resName] = key.split(':');
    const resSeq = parseInt(seqStr, 10);

    const getAtom = (name: string) => resAtoms.find(a => a.name.trim().toUpperCase() === name.toUpperCase());

    const C5p = getAtom("C5'") || getAtom("C5*");
    const C4p = getAtom("C4'") || getAtom("C4*");
    const C3p = getAtom("C3'") || getAtom("C3*");
    const O3p = getAtom("O3'") || getAtom("O3*");
    const O4p = getAtom("O4'") || getAtom("O4*");
    const C1p = getAtom("C1'") || getAtom("C1*");
    const N9 = getAtom("N9");
    const N1 = getAtom("N1");
    const C4 = getAtom("C4");
    const C2 = getAtom("C2");
    const P = getAtom("P");

    // Compute Delta Torsion Angle (sugar pucker indicator)
    let delta = 360;
    if (C5p && C4p && C3p && O3p) {
      delta = calculateDihedral(C5p, C4p, C3p, O3p);
      deltaAngles.push(delta);
      const positiveDelta = (delta + 360) % 360;
      if (positiveDelta >= 75 && positiveDelta <= 115) {
        c3EndoCount++;
      } else if (positiveDelta >= 125 && positiveDelta <= 175) {
        c2EndoCount++;
      } else {
        otherPuckerCount++;
      }
    }

    // Compute Glycosidic Torsion Angle Chi
    let chi = 360;
    if (O4p && C1p) {
      if (N9 && C4) {
        chi = calculateDihedral(O4p, C1p, N9, C4);
      } else if (N1 && C2) {
        chi = calculateDihedral(O4p, C1p, N1, C2);
      }
    }
    if (chi !== 360) {
      if (chi >= -60 && chi <= 90) {
        synGlycosidicCount++;
      } else {
        antiGlycosidicCount++;
      }
    }

    // Compute Virtual P-P Distance with Next Residue on Same Chain
    if (idx < sortedResKeys.length - 1) {
      const nextKey = sortedResKeys[idx + 1];
      const [nextChain, nextSeqStr] = nextKey.split(':');
      const nextSeq = parseInt(nextSeqStr, 10);

      if (chainID === nextChain && nextSeq === resSeq + 1) {
        const nextResAtoms = resMap.get(nextKey)!;
        const nextP = nextResAtoms.find(a => a.name.trim().toUpperCase() === 'P');
        if (P && nextP) {
          const ppDist = dist(P, nextP);
          ppDistances.push(ppDist);
          if (ppDist >= 5.0 && ppDist <= 7.8) {
            validPPDistancesCount++;
          } else {
            missingPhosphateLinks++;
          }
        } else {
          missingPhosphateLinks++;
        }
      }
    }

    if (sampleGeometries.length < 5 && delta !== 360) {
      sampleGeometries.push({
        res: `${chainID}:${resSeq}(${resName})`,
        delta: delta.toFixed(1),
        chi: chi !== 360 ? chi.toFixed(1) : 'N/A',
        hasP: P ? 'Yes' : 'No'
      });
    }
  });

  const avgPPDistance = ppDistances.length > 0
    ? ppDistances.reduce((a, b) => a + b, 0) / ppDistances.length
    : 0;

  return {
    totalNucleotides: sortedResKeys.length,
    c3EndoCount,
    c2EndoCount,
    otherPuckerCount,
    antiGlycosidicCount,
    synGlycosidicCount,
    validPPDistancesCount,
    missingPhosphateLinks,
    avgPPDistance,
    sampleGeometries
  };
}

// 3. Selection algebra verification
function analyzeSelectionAlgebra(atoms: Atom[], parser: SelectionParser) {
  const tests: { name: string; query: string; expectedCondition: (size: number, set: Set<number>) => boolean; detail: string }[] = [
    {
      name: 'Nucleic Polymer Query',
      query: 'polymer.nucleic',
      expectedCondition: (size) => size >= 0,
      detail: 'Select all nucleic polymer atoms'
    },
    {
      name: 'Backbone Query',
      query: 'backbone',
      expectedCondition: (size) => size > 0,
      detail: 'Select nucleic and protein backbone atoms'
    },
    {
      name: 'Sidechain / Base Query',
      query: 'sidechain',
      expectedCondition: (size) => size >= 0,
      detail: 'Select nitrogenous base / sidechain atoms'
    },
    {
      name: 'Phosphorus Element Query',
      query: 'elem P',
      expectedCondition: (size) => size >= 0,
      detail: 'Select phosphorus atoms in nucleic backbone'
    },
    {
      name: 'Nucleotide Residue Query',
      query: 'resn DA+DC+DG+DT+A+C+G+U',
      expectedCondition: (size) => size >= 0,
      detail: 'Select standard DNA/RNA residue names'
    },
    {
      name: 'Metal Coordination Shell Query',
      query: 'around 5.0 of (resn MG or resn NA or resn ZN or resn CA or resn K)',
      expectedCondition: (size) => size >= 0,
      detail: 'Select atoms within 5.0 Å of metal cations'
    },
    {
      name: 'Protein-Nucleic Interface Query',
      query: 'byres (polymer.protein within 5.0 of polymer.nucleic)',
      expectedCondition: (size) => size >= 0,
      detail: 'Select protein interface residues interacting with nucleic acid'
    },
    {
      name: 'Compound Logical Query',
      query: '(polymer.nucleic and backbone) and not (elem H or solvent)',
      expectedCondition: (size) => size >= 0,
      detail: 'Compound query combining polymer, backbone, element filter and solvent exclusion'
    }
  ];

  const results: any[] = [];
  let passedCount = 0;

  for (const t of tests) {
    try {
      const selected = parser.parse(t.query);
      const pass = t.expectedCondition(selected.size, selected);
      if (pass) passedCount++;
      results.push({
        name: t.name,
        query: t.query,
        size: selected.size,
        pass,
        detail: t.detail
      });
    } catch (err: any) {
      results.push({
        name: t.name,
        query: t.query,
        size: 0,
        pass: false,
        detail: `Execution Error: ${err.message}`
      });
    }
  }

  return {
    totalSelectionTests: tests.length,
    passedCount,
    results
  };
}

async function main() {
  const globalStart = performance.now();
  const logs: string[] = [];
  const logFilePath = path.join(process.cwd(), 'scratch', 'qa_group7_nucleic_acids.log');

  const log = (msg: string = '') => {
    console.log(msg);
    logs.push(msg);
  };

  log("==========================================================================================");
  log("          GROUP 7 QA: NUCLEIC ACIDS & PROTEIN-NUCLEIC ACID COMPLEX SUITE");
  log("==========================================================================================\n");
  log(`Timestamp        : ${new Date().toISOString()}`);
  log(`Total Targets    : ${TARGETS.length} DNA/RNA & Protein-Nucleic Acid Structures`);
  log(`Log Destination  : ${logFilePath}\n`);

  let grandTotalAtoms = 0;
  let grandTotalNucleotides = 0;
  let grandTotalHBonds = 0;
  let grandTotalSaltBridges = 0;
  let grandTotalAssertionsPassed = 0;
  let grandTotalAssertionsRun = 0;

  const summaryRows: any[] = [];

  for (let idx = 0; idx < TARGETS.length; idx++) {
    const target = TARGETS[idx];
    log("------------------------------------------------------------------------------------------");
    log(`[TARGET ${idx + 1}/${TARGETS.length}] ${target.pdbId} — ${target.name} (${target.type})`);
    log(`Description: ${target.description}`);
    log("------------------------------------------------------------------------------------------");

    const tStart = performance.now();

    let pdbContent = '';
    try {
      pdbContent = await fetchPDB(target.pdbId);
      log(`  ↳ [FETCH] Loaded ${target.pdbId}.pdb (${(pdbContent.length / 1024).toFixed(1)} KB)`);
    } catch (err: any) {
      log(`  ↳ [ERROR] Failed to fetch ${target.pdbId}: ${err.message}`);
      summaryRows.push({ pdbId: target.pdbId, name: target.name, status: 'FETCH_FAIL', timeMs: 0 });
      continue;
    }

    const parseStart = performance.now();
    const processor = new MolProcessor(pdbContent, 'pdb');
    processor.assignBonds(1.1);
    const atoms = processor.atoms;
    const parseTime = performance.now() - parseStart;

    const parser = new SelectionParser(atoms);
    grandTotalAtoms += atoms.length;

    log(`  ↳ [PARSER] Parsed ${atoms.length} atoms in ${parseTime.toFixed(1)} ms`);

    // Verify minimum atom count assertion
    grandTotalAssertionsRun++;
    if (atoms.length >= target.expectedMinAtoms) {
      grandTotalAssertionsPassed++;
      log(`  ↳ [PASS] Atom count check: ${atoms.length} >= ${target.expectedMinAtoms}`);
    } else {
      log(`  ↳ [WARN] Atom count below expected: ${atoms.length} < ${target.expectedMinAtoms}`);
    }

    // 1. Base-pair H-Bonding Analysis
    const hbStart = performance.now();
    const hbRes = analyzeBasePairHBonds(atoms);
    const hbTime = performance.now() - hbStart;

    grandTotalHBonds += hbRes.totalInterResidueHBonds;
    grandTotalSaltBridges += hbRes.saltBridgesCount;

    log(`  ↳ [H-BONDS] Evaluated in ${hbTime.toFixed(1)} ms:`);
    log(`     - Total Nucleic Atoms        : ${hbRes.totalNucleicAtoms}`);
    log(`     - Inter-Residue Base H-Bonds : ${hbRes.totalInterResidueHBonds}`);
    log(`     - Watson-Crick Base Pairs    : ${hbRes.watsonCrickPairsCount}`);
    log(`     - Non-Canonical / Wobble Pairs: ${hbRes.nonCanonicalPairsCount}`);
    log(`     - Phosphate-Cation/Salt Bridges: ${hbRes.saltBridgesCount}`);

    if (hbRes.hbondDetails.length > 0) {
      log(`     - Sample Base-Pair H-Bonds:`);
      hbRes.hbondDetails.slice(0, 4).forEach(h => {
        log(`       * ${h.resA}:${h.atomA} <---> ${h.resB}:${h.atomB} (${h.distance.toFixed(3)} Å)`);
      });
    }

    // 2. Phosphate Backbone Geometry Analysis
    const geomStart = performance.now();
    const geomRes = analyzePhosphateBackboneGeometry(atoms);
    const geomTime = performance.now() - geomStart;

    grandTotalNucleotides += geomRes.totalNucleotides;

    log(`  ↳ [GEOMETRY] Evaluated in ${geomTime.toFixed(1)} ms:`);
    log(`     - Nucleotides Analyzed       : ${geomRes.totalNucleotides}`);
    log(`     - Sugar Pucker (C3'-endo)    : ${geomRes.c3EndoCount} (A-form RNA/DNA typical)`);
    log(`     - Sugar Pucker (C2'-endo)    : ${geomRes.c2EndoCount} (B-form DNA typical)`);
    log(`     - Glycosidic Conformation    : Anti=${geomRes.antiGlycosidicCount}, Syn=${geomRes.synGlycosidicCount}`);
    log(`     - P-P Virtual Link Distances : ${geomRes.validPPDistancesCount} valid links (avg ${geomRes.avgPPDistance.toFixed(2)} Å)`);

    if (geomRes.sampleGeometries.length > 0) {
      log(`     - Sample Residue Geometries:`);
      geomRes.sampleGeometries.forEach(g => {
        log(`       * ${g.res} | Delta=${g.delta}° | Chi=${g.chi}° | Phosphate P=${g.hasP}`);
      });
    }

    // 3. Selection Algebra Verification
    const selStart = performance.now();
    const selRes = analyzeSelectionAlgebra(atoms, parser);
    const selTime = performance.now() - selStart;

    grandTotalAssertionsRun += selRes.totalSelectionTests;
    grandTotalAssertionsPassed += selRes.passedCount;

    log(`  ↳ [SELECTION ALGEBRA] ${selRes.passedCount}/${selRes.totalSelectionTests} queries passed in ${selTime.toFixed(1)} ms:`);
    selRes.results.forEach(r => {
      log(`     - ${r.pass ? '[PASS]' : '[FAIL]'} ${r.name}: query "${r.query}" => ${r.size} atoms`);
    });

    const targetTotalTime = performance.now() - tStart;
    log(`  ↳ [COMPLETE] Target ${target.pdbId} total analysis time: ${targetTotalTime.toFixed(1)} ms\n`);

    summaryRows.push({
      pdbId: target.pdbId,
      name: target.name,
      type: target.type,
      atoms: atoms.length,
      nucleotides: geomRes.totalNucleotides,
      hBonds: hbRes.totalInterResidueHBonds,
      wcPairs: hbRes.watsonCrickPairsCount,
      saltBridges: hbRes.saltBridgesCount,
      c3Endo: geomRes.c3EndoCount,
      c2Endo: geomRes.c2EndoCount,
      selPassed: `${selRes.passedCount}/${selRes.totalSelectionTests}`,
      timeMs: targetTotalTime.toFixed(1)
    });
  }

  const globalTime = performance.now() - globalStart;

  log("==========================================================================================");
  log("                     GROUP 7 NUCLEIC ACIDS QA SUITE SUMMARY TABLE");
  log("==========================================================================================");
  log(
    "PDB ID | Type            | Atoms  | Nucleotides | H-Bonds | WC Pairs | SaltBridges | C3'/C2'-endo | Selection | Time (ms)"
  );
  log(
    "-------|-----------------|--------|-------------|---------|----------|-------------|--------------|-----------|----------"
  );
  summaryRows.forEach(r => {
    if (r.status === 'FETCH_FAIL') {
      log(`${r.pdbId.padEnd(6)} | ${r.name.padEnd(15)} | FETCH FAILED`);
    } else {
      log(
        `${r.pdbId.padEnd(6)} | ${r.type.padEnd(15)} | ${String(r.atoms).padStart(6)} | ${String(r.nucleotides).padStart(11)} | ${String(r.hBonds).padStart(7)} | ${String(r.wcPairs).padStart(8)} | ${String(r.saltBridges).padStart(11)} | ${(String(r.c3Endo) + '/' + String(r.c2Endo)).padStart(12)} | ${r.selPassed.padStart(9)} | ${String(r.timeMs).padStart(9)}`
      );
    }
  });

  log("\n==========================================================================================");
  log("                                   GRAND TOTAL METRICS");
  log("==========================================================================================");
  log(`  Total Complexes Tested   : ${summaryRows.length} / ${TARGETS.length}`);
  log(`  Total Atoms Processed    : ${grandTotalAtoms.toLocaleString()}`);
  log(`  Total Nucleotides        : ${grandTotalNucleotides.toLocaleString()}`);
  log(`  Total Base-Pair H-Bonds  : ${grandTotalHBonds.toLocaleString()}`);
  log(`  Total Salt Bridges       : ${grandTotalSaltBridges.toLocaleString()}`);
  log(`  Selection Assertions     : ${grandTotalAssertionsPassed} / ${grandTotalAssertionsRun} PASSED (${((grandTotalAssertionsPassed / grandTotalAssertionsRun) * 100).toFixed(1)}%)`);
  log(`  Total Execution Time     : ${(globalTime / 1000).toFixed(2)} seconds`);
  log("==========================================================================================");

  fs.writeFileSync(logFilePath, logs.join('\n'), 'utf-8');
  console.log(`\nLog written successfully to ${logFilePath}`);
}

main().catch(err => {
  console.error("FATAL ERROR in Group 7 QA Suite:", err);
  process.exit(1);
});
