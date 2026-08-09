import fs from 'fs';
import path from 'path';
import { MolProcessor, Atom } from '../src/lib/MolProcessor';
import { SelectionParser } from '../src/lib/SelectionParser';

interface PeptideTarget {
  name: string;
  pdbId: string;
  chain?: string;
  notes?: string;
}

const TARGET_PEPTIDES: PeptideTarget[] = [
  { name: 'Crambin', pdbId: '1CRN', notes: 'Plant seed peptide (46 residues)' },
  { name: 'TRP-Cage', pdbId: '1L2Y', notes: 'Synthetic 20-mer miniprotein TC5b' },
  { name: 'Met-Enkephalin', pdbId: '1PLW', notes: 'Opioid pentapeptide (5 residues)' },
  { name: 'Oxytocin', pdbId: '1NPO', chain: 'A', notes: 'Neurohypophyseal nonapeptide (9 residues)' },
  { name: 'Vasopressin', pdbId: '1YF1', chain: 'A', notes: 'Arginine vasopressin nonapeptide (9 residues)' },
  { name: 'Endothelin', pdbId: '1EDN', notes: 'Vasoactive peptide (21 residues)' },
  { name: 'Somatostatin', pdbId: '1SOM', chain: 'A', notes: 'Growth hormone-inhibiting peptide (14 residues)' },
  { name: 'Glucagon', pdbId: '1GCN', chain: 'A', notes: 'Pancreatic hormone (29 residues)' },
  { name: 'Insulin A chain', pdbId: '1TRZ', chain: 'A', notes: 'Insulin A chain (21 residues)' },
  { name: 'Angiotensin', pdbId: '1N9U', chain: 'A', notes: 'Angiotensin II octapeptide/decapeptide' },
  { name: 'Bradykinin', pdbId: '1BK1', chain: 'A', notes: 'Vasoactive nonapeptide (9 residues)' },
  { name: 'Substance P', pdbId: '1P1B', chain: 'A', notes: 'Neuropeptide (11 residues)' },
  { name: 'Neuropeptide Y', pdbId: '1RON', chain: 'A', notes: 'C-terminal fragment / 36-mer neuropeptide' },
  { name: 'Neurotensin', pdbId: '2LNE', chain: 'A', notes: 'Tridecapeptide neuropeptide (13 residues)' },
  { name: 'Bombesin', pdbId: '1BOM', chain: 'A', notes: 'Amphibian peptide analogue (14 residues)' },
  { name: 'Calcitonin', pdbId: '2GLH', chain: 'A', notes: 'Thyroid hormone peptide (32 residues)' },
  { name: 'Secretin', pdbId: '2LB7', chain: 'A', notes: 'Gastrointestinal peptide hormone (27 residues)' },
  { name: 'Motilin', pdbId: '1LVM', chain: 'A', notes: 'Gastrointestinal peptide (22 residues)' },
  { name: 'Gastrin', pdbId: '1GNT', chain: 'A', notes: 'Gastrointestinal peptide (17 residues)' },
  { name: 'Secretin fragment', pdbId: '1G8M', chain: 'A', notes: 'N-terminal secretin fragment / domain' }
];

interface ResidueTorsion {
  resSeq: number;
  resName: string;
  chainID: string;
  phi: number;
  psi: number;
  region: 'favored' | 'allowed' | 'outlier';
}

interface PeptideSummary {
  name: string;
  pdbId: string;
  totalAtoms: number;
  heavyAtoms: number;
  hydrogens: number;
  residueCount: number;
  chains: string[];
  dsspHelix: number;
  dsspSheet: number;
  dsspLoop: number;
  ramaFavored: number;
  ramaAllowed: number;
  ramaOutlier: number;
  torsions: ResidueTorsion[];
  passed: boolean;
  error?: string;
}

function isSolvent(atom: Atom): boolean {
  const name = (atom.resName || '').toUpperCase().trim();
  return ['HOH', 'WAT', 'DOD', 'SOL', 'TIP3', 'TIP', 'TIP4', 'NH4', 'CL', 'NA'].includes(name);
}

async function runGroup2PeptideQA() {
  const logLines: string[] = [];
  function log(msg: string = '') {
    console.log(msg);
    logLines.push(msg);
  }

  const logPath = path.resolve(process.cwd(), 'scratch/qa_group2_peptides.log');
  const peptidesDir = path.resolve(process.cwd(), 'scratch/peptides');

  log('================================================================================');
  log('            MOLEXPLORER QA BENCHMARK REPORT: GROUP 2 PEPTIDES (20 STRUCTURES)   ');
  log('================================================================================');
  log(`Timestamp        : ${new Date().toISOString()}`);
  log(`Target Group     : Group 2 - Small Biological Peptides (50 - 200 Atoms / Chains)`);
  log(`Log Output File  : ${logPath}`);
  log('');

  const summaries: PeptideSummary[] = [];
  const globalStart = performance.now();

  for (let idx = 0; idx < TARGET_PEPTIDES.length; idx++) {
    const target = TARGET_PEPTIDES[idx];
    log('--------------------------------------------------------------------------------');
    log(`[PEPTIDE ${idx + 1}/20] ${target.name} (PDB: ${target.pdbId}) ${target.chain ? `[Chain ${target.chain}]` : ''}`);
    log(`Notes: ${target.notes || 'N/A'}`);

    const localFile = path.join(peptidesDir, `${target.pdbId}.pdb`);
    let pdbText = '';

    if (fs.existsSync(localFile)) {
      pdbText = fs.readFileSync(localFile, 'utf-8');
      log(`  Source: Loaded from ${localFile} (${pdbText.length} bytes)`);
    } else {
      log(`  Source: Fetching https://files.rcsb.org/download/${target.pdbId}.pdb ...`);
      try {
        const res = await fetch(`https://files.rcsb.org/download/${target.pdbId}.pdb`);
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        pdbText = await res.text();
        fs.mkdirSync(peptidesDir, { recursive: true });
        fs.writeFileSync(localFile, pdbText, 'utf-8');
        log(`  Source: Downloaded & saved to ${localFile} (${pdbText.length} bytes)`);
      } catch (err: any) {
        log(`  [FAIL] Could not load PDB for ${target.name}: ${err.message}`);
        summaries.push({
          name: target.name,
          pdbId: target.pdbId,
          totalAtoms: 0,
          heavyAtoms: 0,
          hydrogens: 0,
          residueCount: 0,
          chains: [],
          dsspHelix: 0,
          dsspSheet: 0,
          dsspLoop: 0,
          ramaFavored: 0,
          ramaAllowed: 0,
          ramaOutlier: 0,
          torsions: [],
          passed: false,
          error: err.message
        });
        continue;
      }
    }

    // Extract Representative Model 1 if NMR ensemble
    let modelText = pdbText;
    if (pdbText.includes('ENDMDL')) {
      modelText = pdbText.split('ENDMDL')[0] + 'ENDMDL\n';
      log(`  Conformation: NMR Ensemble detected -> Extracted Representative Model 1`);
    } else {
      log(`  Conformation: Single X-Ray / Cryo-EM Model`);
    }

    // Initialize MolProcessor
    const processor = new MolProcessor(modelText, 'pdb');

    // Filter out solvent / water atoms
    processor.atoms = processor.atoms.filter(a => !isSolvent(a) && !a.isHetero);

    // Filter chain if specified (e.g. Chain A)
    if (target.chain) {
      const targetChainUpper = target.chain.toUpperCase();
      const chainAtoms = processor.atoms.filter(a => a.chainID.toUpperCase() === targetChainUpper);
      if (chainAtoms.length > 0) {
        processor.atoms = chainAtoms;
        log(`  Chain Filter: Filtered for Chain '${target.chain}' (${processor.atoms.length} atoms remaining)`);
      }
    }

    // Atom Statistics
    const totalAtoms = processor.atoms.length;
    const heavyAtoms = processor.atoms.filter(a => a.elem.toUpperCase() !== 'H').length;
    const hydrogenAtoms = processor.atoms.filter(a => a.elem.toUpperCase() === 'H').length;

    // Unique Residues and Chains
    const chains = Array.from(new Set(processor.atoms.map(a => a.chainID || 'A'))).sort();
    const resMap = new Map<string, { resSeq: number; resName: string; chainID: string }>();
    processor.atoms.forEach(a => {
      const key = `${a.chainID}:${a.resSeq}:${a.resName}`;
      if (!resMap.has(key)) {
        resMap.set(key, { resSeq: a.resSeq, resName: a.resName, chainID: a.chainID });
      }
    });
    const uniqueResidues = Array.from(resMap.values()).sort((x, y) => x.resSeq - y.resSeq);
    const residueCount = uniqueResidues.length;
    const sequenceStr = uniqueResidues.map(r => r.resName).join('-');

    log(`  [Atom Stats] Total: ${totalAtoms} | Heavy: ${heavyAtoms} | H: ${hydrogenAtoms}`);
    log(`  [Residues] Count: ${residueCount} | Chains: [${chains.join(', ')}]`);
    log(`  [Sequence] ${sequenceStr}`);

    // Secondary Structure Calculation (DSSP)
    processor.calculateSecondaryStructure('dssp');
    const dsspMap = (processor.ss_per_residue || []).filter(ss => !['HOH', 'WAT', 'DOD', 'SOL'].includes(ss.resName.toUpperCase()));

    let dsspHelix = 0, dsspSheet = 0, dsspLoop = 0;
    dsspMap.forEach(ss => {
      if (ss.ss_type === 'helix') dsspHelix++;
      else if (ss.ss_type === 'sheet') dsspSheet++;
      else dsspLoop++;
    });

    log(`  [Secondary Structure (DSSP)] Helix: ${dsspHelix} | Sheet: ${dsspSheet} | Loop: ${dsspLoop}`);

    // Quick SS for comparison
    const processorQuick = new MolProcessor(modelText, 'pdb');
    processorQuick.atoms = processorQuick.atoms.filter(a => !isSolvent(a) && !a.isHetero);
    if (target.chain) {
      const targetChainUpper = target.chain.toUpperCase();
      const chainAtoms = processorQuick.atoms.filter(a => a.chainID.toUpperCase() === targetChainUpper);
      if (chainAtoms.length > 0) processorQuick.atoms = chainAtoms;
    }
    processorQuick.calculateSecondaryStructure('quick');
    const quickMap = (processorQuick.ss_per_residue || []).filter(ss => !['HOH', 'WAT', 'DOD', 'SOL'].includes(ss.resName.toUpperCase()));

    log(`  [SS Comparison] Per-Residue DSSP vs Quick Map:`);
    uniqueResidues.forEach(r => {
      const dsspInfo = dsspMap.find(s => s.resi === r.resSeq && s.chainID === r.chainID);
      const quickInfo = quickMap.find(s => s.resi === r.resSeq && s.chainID === r.chainID);
      log(`    Res ${String(r.resSeq).padStart(3)} (${r.resName.padEnd(3)}): DSSP=${(dsspInfo?.ss_type || 'loop').padEnd(7)} | Quick=${(quickInfo?.ss_type || 'loop').padEnd(7)}`);
    });

    // Ramachandran Phi / Psi Evaluation
    const parser = new SelectionParser(processor.atoms);
    const ramaRes = parser.evaluateCommand('ramachandran all');
    const rawReport = (ramaRes.ramachandranReport || []).filter(r => !['HOH', 'WAT', 'DOD', 'SOL'].includes(r.resName.toUpperCase()));

    const torsions: ResidueTorsion[] = rawReport.map(r => ({
      resSeq: r.resSeq,
      resName: r.resName,
      chainID: r.chainID,
      phi: r.phi,
      psi: r.psi,
      region: r.region
    }));

    let ramaFavored = 0, ramaAllowed = 0, ramaOutlier = 0;
    torsions.forEach(t => {
      if (t.region === 'favored') ramaFavored++;
      else if (t.region === 'allowed') ramaAllowed++;
      else ramaOutlier++;
    });

    const totalEvaluated = torsions.length;
    const pctFav = totalEvaluated > 0 ? ((ramaFavored / totalEvaluated) * 100).toFixed(1) : '0.0';
    const pctAll = totalEvaluated > 0 ? ((ramaAllowed / totalEvaluated) * 100).toFixed(1) : '0.0';
    const pctOut = totalEvaluated > 0 ? ((ramaOutlier / totalEvaluated) * 100).toFixed(1) : '0.0';

    log(`  [Ramachandran Stereochemistry] Total Evaluated: ${totalEvaluated}`);
    log(`    - Favored : ${ramaFavored} (${pctFav}%)`);
    log(`    - Allowed : ${ramaAllowed} (${pctAll}%)`);
    log(`    - Outlier : ${ramaOutlier} (${pctOut}%)`);

    log(`  [Torsion Angles Detail]`);
    torsions.forEach(t => {
      const phiStr = t.phi === 360 ? '  N/A   ' : `${t.phi.toFixed(2).padStart(7)}°`;
      const psiStr = t.psi === 360 ? '  N/A   ' : `${t.psi.toFixed(2).padStart(7)}°`;
      log(`    Res ${String(t.resSeq).padStart(3)} (${t.resName.padEnd(3)}): Phi = ${phiStr} | Psi = ${psiStr} | Region = ${t.region}`);
    });

    // Verification Checks
    let passed = true;
    let failReason = '';

    if (totalAtoms === 0) {
      passed = false;
      failReason += 'Zero atoms parsed; ';
    }
    if (residueCount === 0) {
      passed = false;
      failReason += 'Zero residues detected; ';
    }
    if (totalEvaluated === 0 && residueCount > 2) {
      passed = false;
      failReason += 'Zero backbone dihedrals evaluated; ';
    }

    // Verify phi / psi angle limits: values should be in range [-180, 180] or 360 for missing terminal
    torsions.forEach(t => {
      if (t.phi !== 360 && (t.phi < -180.01 || t.phi > 180.01)) {
        passed = false;
        failReason += `Phi out of bounds (${t.phi}°) at res ${t.resSeq}; `;
      }
      if (t.psi !== 360 && (t.psi < -180.01 || t.psi > 180.01)) {
        passed = false;
        failReason += `Psi out of bounds (${t.psi}°) at res ${t.resSeq}; `;
      }
    });

    if (passed) {
      log(`  [STATUS] PASS - ${target.name} biophysical validation succeeded.\n`);
    } else {
      log(`  [STATUS] FAIL - ${target.name}: ${failReason}\n`);
    }

    summaries.push({
      name: target.name,
      pdbId: target.pdbId,
      totalAtoms,
      heavyAtoms,
      hydrogens: hydrogenAtoms,
      residueCount,
      chains,
      dsspHelix,
      dsspSheet,
      dsspLoop,
      ramaFavored,
      ramaAllowed,
      ramaOutlier,
      torsions,
      passed,
      error: failReason || undefined
    });
  }

  const globalTime = performance.now() - globalStart;

  // Aggregate Benchmark Summary Table
  log('================================================================================');
  log('                         AGGREGATE BENCHMARK SUMMARY TABLE                       ');
  log('================================================================================');
  log(
    'No. | Peptide Name        | PDB  | Atoms (H/Tot) | Residues | DSSP (H/E/L) | Rama (Fav/All/Out) | Status'
  );
  log(
    '-------------------------------------------------------------------------------------------------------'
  );

  let totalResiduesAll = 0;
  let totalFavoredAll = 0;
  let totalAllowedAll = 0;
  let totalOutlierAll = 0;
  let totalHelixAll = 0;
  let totalSheetAll = 0;
  let totalLoopAll = 0;
  let totalPassed = 0;

  summaries.forEach((s, i) => {
    const numStr = String(i + 1).padStart(2, ' ');
    const nameStr = s.name.padEnd(19, ' ').substring(0, 19);
    const pdbStr = s.pdbId.padEnd(4, ' ');
    const atomStr = `${s.heavyAtoms}/${s.totalAtoms}`.padStart(13, ' ');
    const resStr = String(s.residueCount).padStart(8, ' ');
    const ssStr = `${s.dsspHelix}/${s.dsspSheet}/${s.dsspLoop}`.padStart(12, ' ');
    const ramaStr = `${s.ramaFavored}/${s.ramaAllowed}/${s.ramaOutlier}`.padStart(16, ' ');
    const statusStr = s.passed ? 'PASS' : 'FAIL';

    totalResiduesAll += s.residueCount;
    totalFavoredAll += s.ramaFavored;
    totalAllowedAll += s.ramaAllowed;
    totalOutlierAll += s.ramaOutlier;
    totalHelixAll += s.dsspHelix;
    totalSheetAll += s.dsspSheet;
    totalLoopAll += s.dsspLoop;
    if (s.passed) totalPassed++;

    log(`${numStr}  | ${nameStr} | ${pdbStr} | ${atomStr} | ${resStr} | ${ssStr} | ${ramaStr} | ${statusStr}`);
  });

  log(
    '-------------------------------------------------------------------------------------------------------'
  );
  log(`TOTAL BENCHMARK TARGETS : ${summaries.length}`);
  log(`TOTAL PASSED           : ${totalPassed} / ${summaries.length} (${((totalPassed / summaries.length) * 100).toFixed(1)}%)`);
  log(`TOTAL RESIDUES EVAL    : ${totalResiduesAll}`);
  log(`AGGREGATE DSSP SS      : Helix=${totalHelixAll} (${((totalHelixAll/totalResiduesAll)*100).toFixed(1)}%), Sheet=${totalSheetAll} (${((totalSheetAll/totalResiduesAll)*100).toFixed(1)}%), Loop=${totalLoopAll} (${((totalLoopAll/totalResiduesAll)*100).toFixed(1)}%)`);

  const totRamaRes = totalFavoredAll + totalAllowedAll + totalOutlierAll;
  log(`AGGREGATE RAMACHANDRAN : Favored=${totalFavoredAll} (${((totalFavoredAll/totRamaRes)*100).toFixed(1)}%), Allowed=${totalAllowedAll} (${((totalAllowedAll/totRamaRes)*100).toFixed(1)}%), Outlier=${totalOutlierAll} (${((totalOutlierAll/totRamaRes)*100).toFixed(1)}%)`);
  log(`EXECUTION TIME         : ${globalTime.toFixed(2)} ms`);
  log('================================================================================');

  // Write log to scratch/qa_group2_peptides.log
  fs.writeFileSync(logPath, logLines.join('\n'), 'utf-8');
  console.log(`\nLog written successfully to: ${logPath}`);
}

runGroup2PeptideQA().catch(err => {
  console.error('Fatal error running QA Group 2 peptides script:', err);
  process.exit(1);
});
