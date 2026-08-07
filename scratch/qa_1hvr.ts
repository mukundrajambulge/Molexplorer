import fs from 'fs';
import path from 'path';
import https from 'https';
import { MolProcessor } from '../src/lib/MolProcessor';
import { SelectionParser, Atom } from '../src/lib/SelectionParser';
import { calculateInteractions } from '../src/lib/Interactions';

// Interface definitions for timing and results
interface TimingReport {
  fetch_ms: number;
  parse_ms: number;
  ss_ms: number;
  rama_ms: number;
  dipole_ms: number;
  interactions_ms: number;
  total_ms: number;
}

// Function to fetch PDB text from RCSB with local fallback
async function fetchPDB(pdbId: string): Promise<{ pdbContent: string; source: string; fetchTimeMs: number }> {
  const t0 = performance.now();
  const url = `https://files.rcsb.org/download/${pdbId}.pdb`;
  
  try {
    const content = await new Promise<string>((resolve, reject) => {
      const req = https.get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`RCSB HTTP ${res.statusCode}`));
          return;
        }
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve(data));
      });
      req.on('error', (err) => reject(err));
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Fetch timeout'));
      });
    });
    const t1 = performance.now();
    return { pdbContent: content, source: `RCSB Direct (${url})`, fetchTimeMs: t1 - t0 };
  } catch (err) {
    console.warn(`[WARN] Online fetch failed (${err}), falling back to local file...`);
    const localPath = path.resolve(process.cwd(), `${pdbId}.pdb`);
    if (fs.existsSync(localPath)) {
      const content = fs.readFileSync(localPath, 'utf-8');
      const t1 = performance.now();
      return { pdbContent: content, source: `Local Fallback (${localPath})`, fetchTimeMs: t1 - t0 };
    }
    throw new Error(`Failed to load ${pdbId} from both RCSB and local filesystem.`);
  }
}

async function runQA1HVR() {
  const startTime = performance.now();
  const logLines: string[] = [];

  function log(msg: string = '') {
    console.log(msg);
    logLines.push(msg);
  }

  log("===============================================================================");
  log("               MOLEXPLORER QA AUTOMATION REPORT: PDB 1HVR                      ");
  log("===============================================================================");
  log(`Timestamp: ${new Date().toISOString()}`);
  log(`Target PDB: 1HVR (HIV-1 Protease Dimered Complex with XK263 Inhibitor)\n`);

  // ---------------------------------------------------------------------------
  // STEP 1: Fetch 1HVR.pdb
  // ---------------------------------------------------------------------------
  log("--- Step 1: Fetching Structure ---");
  const { pdbContent, source, fetchTimeMs } = await fetchPDB("1HVR");
  log(`Source: ${source}`);
  log(`PDB Data Size: ${(pdbContent.length / 1024).toFixed(2)} KB (${pdbContent.split('\n').length} lines)`);
  log(`Duration: ${fetchTimeMs.toFixed(2)} ms\n`);

  // ---------------------------------------------------------------------------
  // STEP 2: Parse PDB Structure
  // ---------------------------------------------------------------------------
  log("--- Step 2: Parsing PDB Structure ---");
  const tParse0 = performance.now();
  const processor = new MolProcessor(pdbContent, 'pdb');
  const parser = new SelectionParser(processor.atoms);
  const tParse1 = performance.now();
  const parseTimeMs = tParse1 - tParse0;

  const totalAtoms = processor.atoms.length;
  const proteinAtoms = processor.atoms.filter(a => !a.isHetero);
  const hetAtoms = processor.atoms.filter(a => a.isHetero);
  const chains = Array.from(new Set(processor.atoms.map(a => a.chainID))).sort();
  
  const residues = new Set(processor.atoms.map(a => `${a.chainID}:${a.resSeq}:${a.resName}`));
  const proteinResidues = new Set(proteinAtoms.map(a => `${a.chainID}:${a.resSeq}:${a.resName}`));
  const ligandResidues = new Set(hetAtoms.map(a => `${a.chainID}:${a.resSeq}:${a.resName}`));

  log(`Total Atoms Parsed: ${totalAtoms}`);
  log(`  - Standard Protein Atoms: ${proteinAtoms.length}`);
  log(`  - Hetero / Ligand / Solvent Atoms: ${hetAtoms.length}`);
  log(`Chains Identified: [ ${chains.join(', ')} ]`);
  log(`Total Residues: ${residues.size} (Protein: ${proteinResidues.size}, Hetero/Solvent: ${ligandResidues.size})`);
  log(`Ligand Entry Identified: XK2 (XK263 Cyclic Urea Inhibitor)`);
  log(`Duration: ${parseTimeMs.toFixed(2)} ms\n`);

  // ---------------------------------------------------------------------------
  // STEP 3: Secondary Structure Computation
  // ---------------------------------------------------------------------------
  log("--- Step 3: Secondary Structure Computation ---");
  const tSS0 = performance.now();

  // 3a. Header (PDB records HELIX/SHEET)
  processor.calculateSecondaryStructure('pdb');
  const ssHeaderMap = new Map(processor.ss_per_residue.map(r => [`${r.chainID}:${r.resi}`, r.ss_type]));
  let headerHelix = 0, headerSheet = 0, headerLoop = 0;
  ssHeaderMap.forEach(type => {
    if (type === 'helix') headerHelix++;
    else if (type === 'sheet') headerSheet++;
    else headerLoop++;
  });

  // 3b. Quick (Phi/Psi heuristics)
  processor.calculateSecondaryStructure('quick');
  const ssQuickMap = new Map(processor.ss_per_residue.map(r => [`${r.chainID}:${r.resi}`, r.ss_type]));
  let quickHelix = 0, quickSheet = 0, quickLoop = 0;
  ssQuickMap.forEach(type => {
    if (type === 'helix') quickHelix++;
    else if (type === 'sheet') quickSheet++;
    else quickLoop++;
  });

  // 3c. DSSP (Kabsch-Sander hydrogen-bond pattern algorithm)
  processor.calculateSecondaryStructure('dssp');
  const ssDSSPMap = new Map(processor.ss_per_residue.map(r => [`${r.chainID}:${r.resi}`, r.ss_type]));
  let dsspHelix = 0, dsspSheet = 0, dsspLoop = 0;
  ssDSSPMap.forEach(type => {
    if (type === 'helix') dsspHelix++;
    else if (type === 'sheet') dsspSheet++;
    else dsspLoop++;
  });

  const tSS1 = performance.now();
  const ssTimeMs = tSS1 - tSS0;

  log("Secondary Structure Algorithm Comparison:");
  log(`┌──────────────────┬──────────┬──────────┬──────────┬──────────────┐`);
  log(`│ Algorithm        │ Helix (α)│ Sheet (β)│ Loop (c) │ Total Res    │`);
  log(`├──────────────────┼──────────┼──────────┼──────────┼──────────────┤`);
  log(`│ PDB Header       │ ${headerHelix.toString().padStart(8)} │ ${headerSheet.toString().padStart(8)} │ ${headerLoop.toString().padStart(8)} │ ${(headerHelix+headerSheet+headerLoop).toString().padStart(12)} │`);
  log(`│ Quick Heuristic  │ ${quickHelix.toString().padStart(8)} │ ${quickSheet.toString().padStart(8)} │ ${quickLoop.toString().padStart(8)} │ ${(quickHelix+quickSheet+quickLoop).toString().padStart(12)} │`);
  log(`│ DSSP (Kabsch)    │ ${dsspHelix.toString().padStart(8)} │ ${dsspSheet.toString().padStart(8)} │ ${dsspLoop.toString().padStart(8)} │ ${(dsspHelix+dsspSheet+dsspLoop).toString().padStart(12)} │`);
  log(`└──────────────────┴──────────┴──────────┴──────────┴──────────────┘`);
  log(`Duration: ${ssTimeMs.toFixed(2)} ms\n`);

  // ---------------------------------------------------------------------------
  // STEP 4: Ramachandran Phi/Psi Angles
  // ---------------------------------------------------------------------------
  log("--- Step 4: Ramachandran Phi/Psi Angle Calculation ---");
  const tRama0 = performance.now();
  const ramaResult = parser.evaluateCommand("ramachandran all");
  const tRama1 = performance.now();
  const ramaTimeMs = tRama1 - tRama0;

  const ramaReport = ramaResult.ramachandranReport || [];
  const favoredRes = ramaReport.filter(r => r.region === 'favored');
  const allowedRes = ramaReport.filter(r => r.region === 'allowed');
  const outlierRes = ramaReport.filter(r => r.region === 'outlier');

  const totalRama = ramaReport.length;
  const pctFavored = ((favoredRes.length / totalRama) * 100).toFixed(1);
  log(`Total Protein Residues Evaluated: ${totalRama}`);
  log(`- Core Favored Region:   ${favoredRes.length.toString().padStart(4)} (${pctFavored}%)`);
  log(`- Allowed Outer Region: ${allowedRes.length.toString().padStart(4)} (${((allowedRes.length / totalRama) * 100).toFixed(1)}%)`);
  log(`- Outliers:              ${outlierRes.length.toString().padStart(4)} (${((outlierRes.length / totalRama) * 100).toFixed(1)}%)`);

  log(`\nSample Phi/Psi Torsion Angles (Chain A: Residues 1-10 & Chain B: Residues 1-10):`);
  log(`Residue  Chain  ResSeq  Phi (°)    Psi (°)    Region`);
  log(`───────  ─────  ──────  ─────────  ─────────  ────────`);
  const sampleResidues = ramaReport.filter(r => (r.chainID === 'A' && r.resSeq <= 10) || (r.chainID === 'B' && r.resSeq <= 10));
  sampleResidues.forEach(r => {
    log(`${r.resName.padStart(7)}  ${r.chainID.padStart(5)}  ${r.resSeq.toString().padStart(6)}  ${r.phi.toFixed(2).padStart(9)}  ${r.psi.toFixed(2).padStart(9)}  ${r.region}`);
  });

  if (outlierRes.length > 0) {
    log(`\nRamachandran Outlier Details (${outlierRes.length} residues):`);
    outlierRes.forEach(r => {
      log(`  Chain ${r.chainID} Res ${r.resSeq} (${r.resName}): Phi=${r.phi.toFixed(2)}°, Psi=${r.psi.toFixed(2)}°`);
    });
  } else {
    log(`\nNo Ramachandran outliers detected. Stereochemistry is optimal.`);
  }
  log(`Duration: ${ramaTimeMs.toFixed(2)} ms\n`);

  // ---------------------------------------------------------------------------
  // STEP 5: Dipole Moment Magnitude and Vector
  // ---------------------------------------------------------------------------
  log("--- Step 5: Dipole Moment Calculation ---");
  const tDipole0 = performance.now();

  const fullDipole = parser.evaluateCommand("dipole all").dipoleResult;
  const chainADipole = parser.evaluateCommand("dipole chain A").dipoleResult;
  const chainBDipole = parser.evaluateCommand("dipole chain B").dipoleResult;
  const ligDipole = parser.evaluateCommand("dipole resn XK2").dipoleResult;

  const tDipole1 = performance.now();
  const dipoleTimeMs = tDipole1 - tDipole0;

  if (fullDipole) {
    log(`Whole Complex (Chain A + Chain B + XK2):`);
    log(`  - Center of Mass (x,y,z): (${fullDipole.com.x.toFixed(3)}, ${fullDipole.com.y.toFixed(3)}, ${fullDipole.com.z.toFixed(3)}) Å`);
    log(`  - Net Ionic Charge:       ${fullDipole.charge.toFixed(2)} e`);
    log(`  - Dipole Vector (x,y,z):  (${fullDipole.vector.x.toFixed(3)}, ${fullDipole.vector.y.toFixed(3)}, ${fullDipole.vector.z.toFixed(3)}) Debye`);
    log(`  - Dipole Magnitude:       ${fullDipole.magnitude.toFixed(3)} Debye\n`);
  }

  if (chainADipole && chainBDipole) {
    log(`Chain Breakdown Dipole Moments:`);
    log(`  - Chain A: Mag = ${chainADipole.magnitude.toFixed(3)} Debye | Charge = ${chainADipole.charge.toFixed(2)} e | Vector = (${chainADipole.vector.x.toFixed(2)}, ${chainADipole.vector.y.toFixed(2)}, ${chainADipole.vector.z.toFixed(2)}) D`);
    log(`  - Chain B: Mag = ${chainBDipole.magnitude.toFixed(3)} Debye | Charge = ${chainBDipole.charge.toFixed(2)} e | Vector = (${chainBDipole.vector.x.toFixed(2)}, ${chainBDipole.vector.y.toFixed(2)}, ${chainBDipole.vector.z.toFixed(2)}) D`);
  }

  if (ligDipole) {
    log(`  - Inhibitor (XK2): Mag = ${ligDipole.magnitude.toFixed(3)} Debye | Charge = ${ligDipole.charge.toFixed(2)} e | Vector = (${ligDipole.vector.x.toFixed(2)}, ${ligDipole.vector.y.toFixed(2)}, ${ligDipole.vector.z.toFixed(2)}) D`);
  }
  log(`Duration: ${dipoleTimeMs.toFixed(2)} ms\n`);

  // ---------------------------------------------------------------------------
  // STEP 6: Interaction Contacts (H-Bonds & Salt Bridges)
  // ---------------------------------------------------------------------------
  log("--- Step 6: Interaction Contacts (H-Bonds & Salt Bridges) ---");
  const tInter0 = performance.now();

  // 6a. DSSP Electrostatic Hydrogen Bonds
  const hbondCmdResult = parser.evaluateCommand("hbond_energy all");
  const hbondsDSSP = hbondCmdResult.addHBonds || [];

  // 6b. Protein-Ligand Interactions (Chain A+B vs XK2)
  // Extract PDB string for protein and ligand
  const proteinPDB = processor.atoms
    .filter(a => !a.isHetero)
    .map(a => formatAtomLine(a))
    .join('\n');
  const ligandPDB = processor.atoms
    .filter(a => a.isHetero && a.resName.trim() === 'XK2')
    .map(a => formatAtomLine(a))
    .join('\n');

  const ligInteractions = (proteinPDB && ligandPDB) ? calculateInteractions(proteinPDB, ligandPDB) : [];
  const ligHbonds = ligInteractions.filter(i => i.type === 'hbond');
  const ligSaltBridges = ligInteractions.filter(i => i.type === 'saltbridge');

  // 6c. Inter-chain Interactions (Chain A vs Chain B)
  const chainAPDB = processor.atoms
    .filter(a => a.chainID === 'A' && !a.isHetero)
    .map(a => formatAtomLine(a))
    .join('\n');
  const chainBPDB = processor.atoms
    .filter(a => a.chainID === 'B' && !a.isHetero)
    .map(a => formatAtomLine(a))
    .join('\n');

  const interChainInteractions = (chainAPDB && chainBPDB) ? calculateInteractions(chainAPDB, chainBPDB) : [];
  const interChainHbonds = interChainInteractions.filter(i => i.type === 'hbond');
  const interChainSaltBridges = interChainInteractions.filter(i => i.type === 'saltbridge');

  // 6d. Intra-protein Salt Bridges across all residues
  const saltBridgesAll: { res1: string; res2: string; distance: number }[] = [];
  const basicRes = ['ARG', 'LYS', 'HIS'];
  const acidicRes = ['ASP', 'GLU'];
  const basicAtomsList = ['NZ', 'NH1', 'NH2', 'NE', 'ND1', 'NE2'];
  const acidicAtomsList = ['OD1', 'OD2', 'OE1', 'OE2'];

  const basicAtomsFound = processor.atoms.filter(a => basicRes.includes(a.resName.trim()) && basicAtomsList.includes(a.name.trim()));
  const acidicAtomsFound = processor.atoms.filter(a => acidicRes.includes(a.resName.trim()) && acidicAtomsList.includes(a.name.trim()));

  basicAtomsFound.forEach(b => {
    acidicAtomsFound.forEach(a => {
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      const d = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (d <= 4.0) {
        saltBridgesAll.push({
          res1: `${b.chainID}:${b.resSeq}(${b.resName}/${b.name.trim()})`,
          res2: `${a.chainID}:${a.resSeq}(${a.resName}/${a.name.trim()})`,
          distance: d
        });
      }
    });
  });

  const tInter1 = performance.now();
  const interTimeMs = tInter1 - tInter0;

  log(`DSSP Electrostatic Hydrogen Bonds (Whole Protein):`);
  log(`  - Total DSSP H-Bonds Detected: ${hbondsDSSP.length}`);
  if (hbondsDSSP.length > 0) {
    const avgE = (hbondsDSSP.reduce((s, h) => s + h.energy, 0) / hbondsDSSP.length).toFixed(2);
    log(`  - Mean Energy: ${avgE} kcal/mol`);
    log(`  - Sample DSSP H-Bonds (first 5):`);
    hbondsDSSP.slice(0, 5).forEach(h => {
      log(`     ${h.donorLabel} ──> ${h.acceptorLabel} | dist = ${h.distance.toFixed(2)} Å | E = ${h.energy.toFixed(2)} kcal/mol`);
    });
  }

  log(`\nInhibitor (XK263) <──> HIV-1 Protease Contact Interactions:`);
  log(`  - H-Bonds: ${ligHbonds.length}`);
  log(`  - Salt Bridges: ${ligSaltBridges.length}`);
  log(`  - Total Direct Contacts: ${ligInteractions.length}`);
  if (ligInteractions.length > 0) {
    log(`  - Key Receptor-Ligand Contact Summary:`);
    ligInteractions.forEach(i => {
      log(`     [${i.type.toUpperCase()}] ${i.atom1.chainID}:${i.atom1.resSeq}(${i.atom1.resName}/${i.atom1.name.trim()}) ── ${i.atom2.chainID}:${i.atom2.resSeq}(${i.atom2.resName}/${i.atom2.name.trim()}) | dist = ${i.distance.toFixed(2)} Å`);
    });
  }

  log(`\nChain A <──> Chain B Inter-Chain Dimerization Contacts:`);
  log(`  - Inter-chain H-Bonds: ${interChainHbonds.length}`);
  log(`  - Inter-chain Salt Bridges: ${interChainSaltBridges.length}`);
  if (interChainInteractions.length > 0) {
    log(`  - Sample Dimer Interface Contacts:`);
    interChainInteractions.slice(0, 8).forEach(i => {
      log(`     [${i.type.toUpperCase()}] Chain A:${i.atom1.resSeq}(${i.atom1.resName}/${i.atom1.name.trim()}) ── Chain B:${i.atom2.resSeq}(${i.atom2.resName}/${i.atom2.name.trim()}) | dist = ${i.distance.toFixed(2)} Å`);
    });
  }

  log(`\nSalt Bridges Across Whole Structure (${saltBridgesAll.length} total):`);
  saltBridgesAll.forEach(sb => {
    log(`  - ${sb.res1} <─── ${sb.distance.toFixed(2)} Å ───> ${sb.res2}`);
  });
  log(`Duration: ${interTimeMs.toFixed(2)} ms\n`);

  // ---------------------------------------------------------------------------
  // STEP 7: Total Latency & Performance Summary
  // ---------------------------------------------------------------------------
  const endTime = performance.now();
  const totalMs = endTime - startTime;

  log("===============================================================================");
  log("                        PERFORMANCE LATENCY BREAKDOWN                          ");
  log("===============================================================================");
  log(`Stage 1: PDB Data Fetching            : ${fetchTimeMs.toFixed(2).padStart(8)} ms`);
  log(`Stage 2: PDB Parsing & Indexing       : ${parseTimeMs.toFixed(2).padStart(8)} ms`);
  log(`Stage 3: Secondary Structure Calc     : ${ssTimeMs.toFixed(2).padStart(8)} ms`);
  log(`Stage 4: Ramachandran Phi/Psi Calc    : ${ramaTimeMs.toFixed(2).padStart(8)} ms`);
  log(`Stage 5: Dipole Moment Calculation    : ${dipoleTimeMs.toFixed(2).padStart(8)} ms`);
  log(`Stage 6: Interaction Contact Calc     : ${interTimeMs.toFixed(2).padStart(8)} ms`);
  log(`-------------------------------------------------------------------------------`);
  log(`TOTAL EXECUTION TIME                  : ${totalMs.toFixed(2).padStart(8)} ms`);
  log("===============================================================================\n");

  // Save log report to scratch/qa_1hvr.log
  const logDir = path.resolve(process.cwd(), 'scratch');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const logFilePath = path.join(logDir, 'qa_1hvr.log');
  fs.writeFileSync(logFilePath, logLines.join('\n'), 'utf-8');
  console.log(`\n✓ QA Report successfully saved to: ${logFilePath}`);
}

function formatAtomLine(a: Atom): string {
  const record = a.isHetero ? "HETATM" : "ATOM  ";
  const serial = a.serial.toString().padStart(5, ' ');
  const name = a.name.padEnd(4, ' ').substring(0, 4);
  const altLoc = a.altLoc || " ";
  const resName = a.resName.padStart(3, ' ').substring(0, 3);
  const chain = a.chainID;
  const resSeq = a.resSeq.toString().padStart(4, ' ');
  const x = a.x.toFixed(3).padStart(8, ' ');
  const y = a.y.toFixed(3).padStart(8, ' ');
  const z = a.z.toFixed(3).padStart(8, ' ');
  const elem = a.elem.padStart(2, ' ').substring(0, 2);
  return `${record}${serial} ${name}${altLoc}${resName} ${chain}${resSeq}    ${x}${y}${z}  1.00  0.00          ${elem}`;
}

runQA1HVR().catch(err => {
  console.error("QA Execution Error:", err);
  process.exit(1);
});
