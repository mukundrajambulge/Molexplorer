import fs from 'fs';
import path from 'path';
import { MolProcessor, Atom } from '../src/lib/MolProcessor';
import { SelectionParser } from '../src/lib/SelectionParser';

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface RamaResidue {
  resSeq: number;
  resName: string;
  chainID: string;
  phi: number;
  psi: number;
  region: 'favored' | 'allowed' | 'outlier';
}

interface InteractionContact {
  type: 'hbond' | 'saltbridge' | 'hydrophobic' | 'aromatic';
  res1: string;
  atom1: string;
  res2: string;
  atom2: string;
  distance: number;
  detail?: string;
}

async function runQA1L2Y() {
  const timings: Record<string, number> = {};
  const tTotalStart = performance.now();

  const logLines: string[] = [];
  function log(message: string) {
    console.log(message);
    logLines.push(message);
  }

  log("================================================================================");
  log("               MOLEXPLORER QA AUTOMATION REPORT: 1L2Y (Trp-cage)                ");
  log("================================================================================");
  log(`Timestamp: ${new Date().toISOString()}`);
  log("");

  // 1. Fetch 1L2Y.pdb
  const tFetchStart = performance.now();
  const pdbUrl = 'https://files.rcsb.org/download/1L2Y.pdb';
  const localPdbPath = path.resolve(process.cwd(), 'scratch', '1L2Y.pdb');
  let rawPdbText = '';

  log("--- 1. FETCHING PDB DATA ---");
  log(`Target URL: ${pdbUrl}`);

  try {
    const res = await fetch(pdbUrl);
    if (!res.ok) {
      throw new Error(`HTTP fetch failed with status: ${res.status} ${res.statusText}`);
    }
    rawPdbText = await res.text();
    fs.writeFileSync(localPdbPath, rawPdbText, 'utf-8');
    log(`Successfully fetched 1L2Y.pdb (${rawPdbText.length} bytes) from RCSB.`);
  } catch (err: any) {
    log(`Fetch error (${err.message}). Checking local fallback...`);
    if (fs.existsSync(localPdbPath)) {
      rawPdbText = fs.readFileSync(localPdbPath, 'utf-8');
      log(`Loaded cached 1L2Y.pdb from local scratch path.`);
    } else {
      throw new Error(`Could not fetch or locate 1L2Y.pdb: ${err.message}`);
    }
  }
  timings['Fetch 1L2Y.pdb'] = performance.now() - tFetchStart;
  log(`Duration: ${timings['Fetch 1L2Y.pdb'].toFixed(2)} ms\n`);

  // Extract Model 1 for single-conformation biophysical QA
  let model1Pdb = rawPdbText;
  if (rawPdbText.includes('ENDMDL')) {
    model1Pdb = rawPdbText.split('ENDMDL')[0] + 'ENDMDL\n';
  }

  // 2. Parsing PDB
  const tParseStart = performance.now();
  log("--- 2. PARSING PDB STRUCTURE (Model 1) ---");
  const processor = new MolProcessor(model1Pdb, 'pdb');
  const parser = new SelectionParser(processor.atoms);

  const totalAtoms = processor.atoms.length;
  const nonHAtoms = processor.atoms.filter(a => a.elem !== 'H').length;
  const hAtoms = processor.atoms.filter(a => a.elem === 'H').length;
  const chains = Array.from(new Set(processor.atoms.map(a => a.chainID))).filter(c => c.trim().length > 0);
  const residues = Array.from(new Set(processor.atoms.map(a => `${a.chainID}:${a.resSeq}:${a.resName}`)));

  log(`Structure ID: 1L2Y (NMR Ensembles, Representative Model 1)`);
  log(`Total Atoms (Model 1): ${totalAtoms} (${nonHAtoms} heavy atoms, ${hAtoms} hydrogens)`);
  log(`Chains: ${chains.join(', ') || 'A'}`);
  log(`Total Residues: ${residues.length}`);
  log(`Residue Sequence: ${residues.map(r => r.split(':')[2]).join('-')}`);

  timings['Parse PDB'] = performance.now() - tParseStart;
  log(`Duration: ${timings['Parse PDB'].toFixed(2)} ms\n`);

  // 3. Secondary Structure Calculation
  const tSSStart = performance.now();
  log("--- 3. SECONDARY STRUCTURE CALCULATION ---");

  // Calculate using DSSP mode
  processor.calculateSecondaryStructure('dssp');
  const dsspSS = [...processor.ss_per_residue];

  // Also compute using quick mode for comparison
  const processorQuick = new MolProcessor(model1Pdb, 'pdb');
  processorQuick.calculateSecondaryStructure('quick');
  const quickSS = [...processorQuick.ss_per_residue];

  let helixCountDSSP = 0, sheetCountDSSP = 0, loopCountDSSP = 0;
  dsspSS.forEach(s => {
    if (s.ss_type === 'helix') helixCountDSSP++;
    else if (s.ss_type === 'sheet') sheetCountDSSP++;
    else loopCountDSSP++;
  });

  log(`DSSP Secondary Structure Summary:`);
  log(`  - Helix Residues : ${helixCountDSSP} (${((helixCountDSSP / dsspSS.length) * 100).toFixed(1)}%)`);
  log(`  - Sheet Residues : ${sheetCountDSSP} (${((sheetCountDSSP / dsspSS.length) * 100).toFixed(1)}%)`);
  log(`  - Loop Residues  : ${loopCountDSSP} (${((loopCountDSSP / dsspSS.length) * 100).toFixed(1)}%)`);
  log(``);
  log(`Per-Residue Secondary Structure Map (Resi | ResName | DSSP | Quick):`);
  dsspSS.forEach((s, idx) => {
    const q = quickSS[idx];
    log(`  Res ${String(s.resi).padStart(2)} (${s.resName}): DSSP=${s.ss_type.padEnd(7)} | Quick=${q ? q.ss_type : 'N/A'}`);
  });

  timings['Secondary Structure'] = performance.now() - tSSStart;
  log(`Duration: ${timings['Secondary Structure'].toFixed(2)} ms\n`);

  // 4. Ramachandran Phi/Psi Angle Calculation
  const tRamaStart = performance.now();
  log("--- 4. RAMACHANDRAN PHI/PSI ANGLES & STEREOCHEMISTRY ---");

  const ramaResult = parser.evaluateCommand("ramachandran all");
  const ramaReport: RamaResidue[] = (ramaResult.ramachandranReport || []).map(r => ({
    resSeq: r.resSeq,
    resName: r.resName,
    chainID: r.chainID,
    phi: r.phi,
    psi: r.psi,
    region: r.region
  }));

  const favoredCount = ramaReport.filter(r => r.region === 'favored').length;
  const allowedCount = ramaReport.filter(r => r.region === 'allowed').length;
  const outlierCount = ramaReport.filter(r => r.region === 'outlier').length;
  const totalRama = ramaReport.length;

  log(`Ramachandran Evaluation Summary (${totalRama} residues evaluated):`);
  log(`  - Favored Region : ${favoredCount} (${((favoredCount / totalRama) * 100).toFixed(1)}%)`);
  log(`  - Allowed Region : ${allowedCount} (${((allowedCount / totalRama) * 100).toFixed(1)}%)`);
  log(`  - Outliers       : ${outlierCount} (${((outlierCount / totalRama) * 100).toFixed(1)}%)`);
  log(``);
  log(`Detailed Torsion Angles (Resi | ResName | Phi (°) | Psi (°) | Region):`);
  ramaReport.forEach(r => {
    log(`  Res ${String(r.resSeq).padStart(2)} (${r.resName}): Phi = ${r.phi.toFixed(2).padStart(7)}° | Psi = ${r.psi.toFixed(2).padStart(7)}° | Region = ${r.region}`);
  });

  timings['Ramachandran Angles'] = performance.now() - tRamaStart;
  log(`Duration: ${timings['Ramachandran Angles'].toFixed(2)} ms\n`);

  // 5. Dipole Moment Calculation
  const tDipoleStart = performance.now();
  log("--- 5. MOLECULAR DIPOLE MOMENT & CENTER OF MASS ---");

  const dipoleRes = parser.evaluateCommand("dipole all");
  const dipoleInfo = dipoleRes.dipoleResult;

  if (dipoleInfo) {
    log(`Net Ionic Charge       : ${dipoleInfo.charge.toFixed(2)} e`);
    log(`Center of Mass (x,y,z) : (${dipoleInfo.com.x.toFixed(4)}, ${dipoleInfo.com.y.toFixed(4)}, ${dipoleInfo.com.z.toFixed(4)}) Å`);
    log(`Dipole Vector (x,y,z)  : (${dipoleInfo.vector.x.toFixed(4)}, ${dipoleInfo.vector.y.toFixed(4)}, ${dipoleInfo.vector.z.toFixed(4)}) Debye`);
    log(`Dipole Vector Magnitude: ${dipoleInfo.magnitude.toFixed(4)} Debye`);
  } else {
    log(`Dipole calculation did not return result object.`);
  }

  timings['Dipole Moment'] = performance.now() - tDipoleStart;
  log(`Duration: ${timings['Dipole Moment'].toFixed(2)} ms\n`);

  // 6. Interaction Contacts (H-Bonds, Salt Bridges, Hydrophobic/Aromatic)
  const tInterStart = performance.now();
  log("--- 6. INTRA-MOLECULAR INTERACTION CONTACTS ---");

  const interactions: InteractionContact[] = [];

  // A. DSSP Electrostatic Hydrogen Bonds
  const hbondRes = parser.evaluateCommand("hbond all");
  const hbondList = hbondRes.addHBonds || [];

  hbondList.forEach(hb => {
    const dAtom = processor.atoms.find(a => a.serial === hb.donorSerial);
    const aAtom = processor.atoms.find(a => a.serial === hb.acceptorSerial);
    if (dAtom && aAtom) {
      interactions.push({
        type: 'hbond',
        res1: `${dAtom.resName}${dAtom.resSeq}`,
        atom1: dAtom.name.trim(),
        res2: `${aAtom.resName}${aAtom.resSeq}`,
        atom2: aAtom.name.trim(),
        distance: hb.distance,
        detail: `Energy = ${hb.energy.toFixed(2)} kcal/mol`
      });
    }
  });

  // B. Salt Bridges (Basic: LYS, ARG, HIS <-> Acidic: ASP, GLU within 4.0 Å)
  const basicResidues = ['LYS', 'ARG', 'HIS'];
  const acidicResidues = ['ASP', 'GLU'];
  const basicAtomNames = ['NZ', 'NH1', 'NH2', 'NE', 'ND1', 'NE2'];
  const acidicAtomNames = ['OD1', 'OD2', 'OE1', 'OE2'];

  const basicAtoms = processor.atoms.filter(a => basicResidues.includes(a.resName.toUpperCase()) && basicAtomNames.includes(a.name.trim()));
  const acidicAtoms = processor.atoms.filter(a => acidicResidues.includes(a.resName.toUpperCase()) && acidicAtomNames.includes(a.name.trim()));

  basicAtoms.forEach(bAtom => {
    acidicAtoms.forEach(aAtom => {
      const dx = bAtom.x - aAtom.x;
      const dy = bAtom.y - aAtom.y;
      const dz = bAtom.z - aAtom.z;
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (dist <= 4.0) {
        interactions.push({
          type: 'saltbridge',
          res1: `${bAtom.resName}${bAtom.resSeq}`,
          atom1: bAtom.name.trim(),
          res2: `${aAtom.resName}${aAtom.resSeq}`,
          atom2: aAtom.name.trim(),
          distance: dist,
          detail: 'Electrostatic Ion Pair'
        });
      }
    });
  });

  // C. Hydrophobic / Aromatic Core Contacts (Trp-cage core: TRP6, TYR3, LEU7, PRO12, PRO18, PRO19)
  const hydrophobicRes = ['TRP', 'TYR', 'LEU', 'ILE', 'VAL', 'PRO', 'ALA', 'MET'];
  const coreResidues = processor.atoms.filter(a => hydrophobicRes.includes(a.resName.toUpperCase()) && a.elem === 'C');

  for (let i = 0; i < coreResidues.length; i++) {
    for (let j = i + 1; j < coreResidues.length; j++) {
      const a1 = coreResidues[i];
      const a2 = coreResidues[j];

      // Skip intra-residue or adjacent residues
      if (Math.abs(a1.resSeq - a2.resSeq) <= 2) continue;

      const dx = a1.x - a2.x;
      const dy = a1.y - a2.y;
      const dz = a1.z - a2.z;
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

      if (dist <= 4.2) {
        // Limit logging to 1 per residue pair to avoid redundant atom-atom pairs
        const existing = interactions.find(it =>
          (it.type === 'hydrophobic' || it.type === 'aromatic') &&
          ((it.res1 === `${a1.resName}${a1.resSeq}` && it.res2 === `${a2.resName}${a2.resSeq}`) ||
           (it.res1 === `${a2.resName}${a2.resSeq}` && it.res2 === `${a1.resName}${a1.resSeq}`))
        );
        if (!existing) {
          const isAromatic = (a1.resName === 'TRP' || a1.resName === 'TYR') && (a2.resName === 'TRP' || a2.resName === 'TYR' || a2.resName === 'PRO');
          interactions.push({
            type: isAromatic ? 'aromatic' : 'hydrophobic',
            res1: `${a1.resName}${a1.resSeq}`,
            atom1: a1.name.trim(),
            res2: `${a2.resName}${a2.resSeq}`,
            atom2: a2.name.trim(),
            distance: dist,
            detail: isAromatic ? 'Trp-cage Aromatic-Proline/Aromatic Core Contact' : 'Sidechain Hydrophobic Contact'
          });
        }
      }
    }
  }

  const hbondCount = interactions.filter(i => i.type === 'hbond').length;
  const saltBridgeCount = interactions.filter(i => i.type === 'saltbridge').length;
  const hydrophobicCount = interactions.filter(i => i.type === 'hydrophobic').length;
  const aromaticCount = interactions.filter(i => i.type === 'aromatic').length;

  log(`Interaction Contacts Breakdown:`);
  log(`  - Hydrogen Bonds     : ${hbondCount}`);
  log(`  - Salt Bridges       : ${saltBridgeCount}`);
  log(`  - Hydrophobic Contacts: ${hydrophobicCount}`);
  log(`  - Aromatic Contacts  : ${aromaticCount}`);
  log(``);
  log(`Interaction List (Res1-Atom1 <---> Res2-Atom2 | Dist (Å) | Detail):`);
  interactions.forEach(it => {
    log(`  [${it.type.toUpperCase().padEnd(11)}] ${it.res1.padEnd(6)} (${it.atom1.padEnd(3)}) <---> ${it.res2.padEnd(6)} (${it.atom2.padEnd(3)}) | d = ${it.distance.toFixed(2)} Å | ${it.detail || ''}`);
  });

  timings['Interaction Contacts'] = performance.now() - tInterStart;
  log(`Duration: ${timings['Interaction Contacts'].toFixed(2)} ms\n`);

  // 7. Execution Time Benchmarks Summary
  const totalDuration = performance.now() - tTotalStart;
  timings['Total Execution'] = totalDuration;

  log("================================================================================");
  log("                       EXECUTION TIMINGS BENCHMARK                              ");
  log("================================================================================");
  Object.entries(timings).forEach(([phase, dur]) => {
    log(`  - ${phase.padEnd(28)} : ${dur.toFixed(2)} ms`);
  });
  log("================================================================================");
  log("STATUS: SUCCESS - All biophysical properties computed for 1L2Y.");
  log("================================================================================");

  // Write log report
  const logPath = path.resolve(process.cwd(), 'scratch', 'qa_1l2y.log');
  fs.writeFileSync(logPath, logLines.join('\n'), 'utf-8');
  console.log(`\nReport successfully saved to: ${logPath}`);
}

runQA1L2Y().catch(err => {
  console.error("QA Execution Error:", err);
  process.exit(1);
});
