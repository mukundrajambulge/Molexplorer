import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { MolProcessor, Atom } from '../src/lib/MolProcessor';
import { SelectionParser } from '../src/lib/SelectionParser';

interface StructureConfig {
  id: string;
  name: string;
  category: string;
}

const STRUCTURE_SUITE: StructureConfig[] = [
  { id: '1CRN', name: 'Crambin (Small Plant Seed Protein)', category: 'Small Protein' },
  { id: '1L2Y', name: 'Trp-Cage (20-Residue Miniprotein)', category: 'Peptide/Miniprotein' },
  { id: '1A8O', name: 'HIV Capsid C-Terminal Domain Dimer', category: 'Viral Protein' },
  { id: '1HVR', name: 'HIV-1 Protease + Inhibitor + Water', category: 'Drug Target Complex' },
  { id: '1BNA', name: 'Synthetic B-DNA Dodecamer', category: 'Nucleic Acid (DNA)' },
  { id: '1ATN', name: 'Actin-DNase I Complex', category: 'Protein Complex' },
  { id: '1CFC', name: 'Calmodulin (Calcium-Binding)', category: 'Signal Transduction' },
  { id: '3I3D', name: 'T3R3 Human Insulin Hexamer + Phenol', category: 'Hormone Assembly' },
  { id: '4HHB', name: 'Deoxy Human Hemoglobin Tetramer', category: 'Transport Assembly' },
  { id: '2POR', name: 'Porin Membrane Protein', category: 'Membrane Protein' },
  { id: '1UBQ', name: 'Ubiquitin (Regulatory Protein)', category: 'Regulatory Protein' },
  { id: '1GCN', name: 'Glucagon (29-Residue Hormone)', category: 'Peptide Hormone' },
  { id: '2MBN', name: 'Myoglobin (Oxygen Storage)', category: 'Globular Protein' },
  { id: '1T41', name: 'High-Resolution Protein Structure', category: 'High Resolution' },
  { id: '1EVH', name: 'EVH1 Domain (Signaling Module)', category: 'Domain Structure' },
  { id: '1CAG', name: 'Collagen Triple Helix Model', category: 'Fibrous Protein' },
  { id: '351D', name: 'RNA Duplex (A-Form RNA)', category: 'Nucleic Acid (RNA)' },
  { id: '1K40', name: 'Potassium Channel Pore Domain', category: 'Ion Channel' },
  { id: '1AON', name: 'GroEL Chaperonin Complex (Large Assembly)', category: 'Chaperonin Machine' },
  { id: '1FFK', name: '50S Ribosomal Subunit Fragment', category: 'Ribosomal Assembly' },
];

function isSolvent(atom: Atom): boolean {
  const name = (atom.resName || '').trim().toUpperCase();
  return ['HOH', 'WAT', 'DOD', 'SOL', 'TIP3', 'TIP', 'TIP4'].includes(name);
}

function hasCarbons(atom: Atom, atoms: Atom[]): boolean {
  return atoms.some(a => a.chainID === atom.chainID && a.resSeq === atom.resSeq && a.elem.toUpperCase() === 'C');
}

function dist(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Compute ground-truth atom serial sets directly from processor.atoms
function computeGroundTruth(atoms: Atom[], queryType: string): Set<number> {
  const result = new Set<number>();
  const proteinBackboneAtoms = new Set(['N', 'CA', 'C', 'O', 'OXT', 'H', 'HA', 'H1', 'H2', 'H3']);
  const nucleicBackboneAtoms = new Set(['P', 'OP1', 'OP2', 'OP3', "O3'", "O5'", "C3'", "C4'", "C5'", "O4'", "C1'", "C2'"]);

  switch (queryType) {
    case 'name CA':
      atoms.forEach(a => { if (a.name.trim() === 'CA') result.add(a.serial); });
      break;
    case 'name CA+CB+N+O':
      atoms.forEach(a => { if (['CA', 'CB', 'N', 'O'].includes(a.name.trim())) result.add(a.serial); });
      break;
    case 'resn ALA':
      atoms.forEach(a => { if (a.resName.trim().toUpperCase() === 'ALA') result.add(a.serial); });
      break;
    case 'resn ALA+GLY+VAL':
      atoms.forEach(a => { if (['ALA', 'GLY', 'VAL'].includes(a.resName.trim().toUpperCase())) result.add(a.serial); });
      break;
    case 'resi 1-20':
      atoms.forEach(a => { if (a.resSeq >= 1 && a.resSeq <= 20) result.add(a.serial); });
      break;
    case 'resi 10+20+30':
      atoms.forEach(a => { if ([10, 20, 30].includes(a.resSeq)) result.add(a.serial); });
      break;
    case 'chain A':
      atoms.forEach(a => { if (a.chainID.trim() === 'A') result.add(a.serial); });
      break;
    case 'chain A+B':
      atoms.forEach(a => { if (['A', 'B'].includes(a.chainID.trim())) result.add(a.serial); });
      break;
    case 'elem C':
      atoms.forEach(a => { if (a.elem.trim().toUpperCase() === 'C') result.add(a.serial); });
      break;
    case 'elem C+N+O':
      atoms.forEach(a => { if (['C', 'N', 'O'].includes(a.elem.trim().toUpperCase())) result.add(a.serial); });
      break;
    case 'ss h':
      atoms.forEach(a => { if (a.ss === 'helix') result.add(a.serial); });
      break;
    case 'ss s':
      atoms.forEach(a => { if (a.ss === 'sheet') result.add(a.serial); });
      break;
    case 'ss l':
      atoms.forEach(a => { if (a.ss === 'loop') result.add(a.serial); });
      break;
    case 'hetatm':
      atoms.forEach(a => { if (a.isHetero) result.add(a.serial); });
      break;
    case 'solvent':
      atoms.forEach(a => { if (isSolvent(a)) result.add(a.serial); });
      break;
    case 'chain A and backbone':
      atoms.forEach(a => {
        if (a.chainID.trim() === 'A' && !isSolvent(a)) {
          const nUpper = a.name.trim().toUpperCase();
          if (proteinBackboneAtoms.has(nUpper) || nucleicBackboneAtoms.has(nUpper)) {
            result.add(a.serial);
          }
        }
      });
      break;
    case 'resn ALA or resn GLY':
      atoms.forEach(a => {
        const rUpper = a.resName.trim().toUpperCase();
        if (rUpper === 'ALA' || rUpper === 'GLY') result.add(a.serial);
      });
      break;
    case 'not solvent':
      atoms.forEach(a => { if (!isSolvent(a)) result.add(a.serial); });
      break;
    case 'within 4.0 of resn HOH': {
      const hohAtoms = atoms.filter(a => a.resName.trim().toUpperCase() === 'HOH');
      atoms.forEach(a => {
        if (hohAtoms.some(h => dist(a, h) <= 4.0)) {
          result.add(a.serial);
        }
      });
      break;
    }
    case 'around 4.0 of chain A': {
      const chainAAtoms = atoms.filter(a => a.chainID.trim() === 'A');
      atoms.forEach(a => {
        if (a.chainID.trim() !== 'A' && chainAAtoms.some(ca => dist(a, ca) <= 4.0)) {
          result.add(a.serial);
        }
      });
      break;
    }
    case 'byres (within 4.0 of resn HOH)': {
      const hohAtoms = atoms.filter(a => a.resName.trim().toUpperCase() === 'HOH');
      const withinSerials = new Set<number>();
      atoms.forEach(a => {
        if (hohAtoms.some(h => dist(a, h) <= 4.0)) {
          withinSerials.add(a.serial);
        }
      });
      const withinAtoms = atoms.filter(a => withinSerials.has(a.serial));
      const residueKeys = new Set(withinAtoms.map(a => `${a.chainID}:${a.resSeq}`));
      atoms.forEach(a => {
        if (residueKeys.has(`${a.chainID}:${a.resSeq}`)) {
          result.add(a.serial);
        }
      });
      break;
    }
    case '(chain A and backbone) or (organic and within 5 of resi 1-20)': {
      const chainABackboneSerials = new Set<number>();
      atoms.forEach(a => {
        if (a.chainID.trim() === 'A' && !isSolvent(a)) {
          const nUpper = a.name.trim().toUpperCase();
          if (proteinBackboneAtoms.has(nUpper) || nucleicBackboneAtoms.has(nUpper)) {
            chainABackboneSerials.add(a.serial);
          }
        }
      });
      const resi1_20Atoms = atoms.filter(a => a.resSeq >= 1 && a.resSeq <= 20);
      const organicWithinSerials = new Set<number>();
      atoms.forEach(a => {
        const isOrganic = !!a.isHetero && !isSolvent(a) && hasCarbons(a, atoms);
        if (isOrganic && resi1_20Atoms.some(r => dist(a, r) <= 5.0)) {
          organicWithinSerials.add(a.serial);
        }
      });
      atoms.forEach(a => {
        if (chainABackboneSerials.has(a.serial) || organicWithinSerials.has(a.serial)) {
          result.add(a.serial);
        }
      });
      break;
    }
    case 'select sele_1, chain A and resi 1-20':
      atoms.forEach(a => {
        if (a.chainID.trim() === 'A' && a.resSeq >= 1 && a.resSeq <= 20) {
          result.add(a.serial);
        }
      });
      break;
  }
  return result;
}

async function getOrFetchPDB(pdbId: string): Promise<string> {
  const scratchDir = path.join(process.cwd(), 'scratch');
  if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
  }

  const localPath = path.join(scratchDir, `${pdbId}.pdb`);
  if (fs.existsSync(localPath)) {
    return fs.readFileSync(localPath, 'utf-8');
  }

  const rootPath = path.join(process.cwd(), `${pdbId}.pdb`);
  if (fs.existsSync(rootPath)) {
    const content = fs.readFileSync(rootPath, 'utf-8');
    fs.writeFileSync(localPath, content, 'utf-8');
    return content;
  }

  console.log(`  Downloading ${pdbId}.pdb from files.rcsb.org...`);
  const url = `https://files.rcsb.org/download/${pdbId}.pdb`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Failed to fetch PDB ${pdbId}: ${resp.status} ${resp.statusText}`);
  }
  const text = await resp.text();
  fs.writeFileSync(localPath, text, 'utf-8');
  return text;
}

async function main() {
  const logLines: string[] = [];
  const log = (msg: string) => {
    console.log(msg);
    logLines.push(msg);
  };

  log("====================================================================================================");
  log("        GROUP 8 QA TEST SUITE: PYMOL SELECTION SYNTAX & ENGINE ACCURACY BENCHMARK          ");
  log("====================================================================================================\n");
  log(`Execution Date: ${new Date().toISOString()}`);
  log(`Target Test Structures: ${STRUCTURE_SUITE.length}`);
  log(`Evaluated PyMOL Syntax Features: byres, around, within, name, resn, resi, chain, elem, ss, hetatm, solvent, boolean and/or/not, parenthetical nesting, selection saving (select sele_name, expr)\n`);

  let totalQueriesExecuted = 0;
  let totalQueriesPassed = 0;
  let totalErrorValidationPassed = 0;
  let totalErrorValidationExecuted = 0;

  const timingStatsByQuery: Record<string, number[]> = {};
  const timingStatsByStructure: Record<string, { totalMs: number; count: number; atomCount: number }> = {};

  const validQueries = [
    { query: 'name CA', category: 'name', desc: 'Single atom name match' },
    { query: 'name CA+CB+N+O', category: 'name', desc: 'Shorthand atom name list match' },
    { query: 'resn ALA', category: 'resn', desc: 'Single residue name match' },
    { query: 'resn ALA+GLY+VAL', category: 'resn', desc: 'Shorthand residue name list match' },
    { query: 'resi 1-20', category: 'resi', desc: 'Residue sequence range match' },
    { query: 'resi 10+20+30', category: 'resi', desc: 'Residue sequence list match' },
    { query: 'chain A', category: 'chain', desc: 'Single chain ID match' },
    { query: 'chain A+B', category: 'chain', desc: 'Shorthand chain ID list match' },
    { query: 'elem C', category: 'elem', desc: 'Single element symbol match' },
    { query: 'elem C+N+O', category: 'elem', desc: 'Shorthand element list match' },
    { query: 'ss h', category: 'ss', desc: 'Secondary structure helix match' },
    { query: 'ss s', category: 'ss', desc: 'Secondary structure sheet match' },
    { query: 'ss l', category: 'ss', desc: 'Secondary structure loop match' },
    { query: 'hetatm', category: 'hetatm', desc: 'Heteroatom record keyword match' },
    { query: 'solvent', category: 'water', desc: 'Solvent/water keyword match' },
    { query: 'chain A and backbone', category: 'boolean', desc: 'Boolean AND with backbone keyword' },
    { query: 'resn ALA or resn GLY', category: 'boolean', desc: 'Boolean OR between residue queries' },
    { query: 'not solvent', category: 'boolean', desc: 'Unary NOT operator' },
    { query: 'within 4.0 of resn HOH', category: 'within', desc: 'Spatial within distance search' },
    { query: 'around 4.0 of chain A', category: 'around', desc: 'Spatial shell around query' },
    { query: 'byres (within 4.0 of resn HOH)', category: 'byres', desc: 'Residue-level expansion modifier' },
    { query: '(chain A and backbone) or (organic and within 5 of resi 1-20)', category: 'nesting', desc: 'Nested parenthetical complex expression' },
    { query: 'select sele_1, chain A and resi 1-20', category: 'saving', desc: 'Selection command execution & saving' },
  ];

  const invalidQueries = [
    { query: '(chain A', desc: 'Unmatched opening parenthesis' },
    { query: 'chain A)', desc: 'Unexpected closing parenthesis' },
    { query: 'chain A and', desc: 'Missing operand after binary AND' },
    { query: 'not', desc: 'Missing operand after unary NOT' },
    { query: 'within 5', desc: 'Missing target expression for spatial query' },
    { query: 'unknownprop foo', desc: 'Unknown property selector' },
  ];

  const suiteStartTime = performance.now();

  for (let sIdx = 0; sIdx < STRUCTURE_SUITE.length; sIdx++) {
    const config = STRUCTURE_SUITE[sIdx];
    log(`----------------------------------------------------------------------------------------------------`);
    log(`[Structure ${sIdx + 1}/${STRUCTURE_SUITE.length}] PDB: ${config.id} | Name: ${config.name} | Category: ${config.category}`);
    log(`----------------------------------------------------------------------------------------------------`);

    let pdbText = '';
    try {
      pdbText = await getOrFetchPDB(config.id);
    } catch (err: any) {
      log(`  [FAIL] Failed to load structure ${config.id}: ${err.message}`);
      continue;
    }

    const parseStartTime = performance.now();
    const processor = new MolProcessor(pdbText, 'pdb');
    processor.assignBonds(1.15);
    processor.calculateSecondaryStructure('quick');
    const parseEndTime = performance.now();

    const atomCount = processor.atoms.length;
    log(`  Atoms Parsed: ${atomCount} | Parsing & SS Assignment Time: ${(parseEndTime - parseStartTime).toFixed(2)} ms`);

    const parser = new SelectionParser(processor.atoms);
    let structPassed = 0;
    let structFailed = 0;
    let structTotalMs = 0;

    log(`\n  --- PyMOL Selection Query Benchmark ---`);

    for (const testCase of validQueries) {
      totalQueriesExecuted++;
      const qStart = performance.now();

      try {
        let evaluatedSet: Set<number>;
        let cmdResult: any = null;

        if (testCase.query.startsWith('select ')) {
          cmdResult = parser.evaluateCommand(testCase.query);
          evaluatedSet = cmdResult.selectedSerials;
        } else {
          evaluatedSet = parser.parse(testCase.query);
          cmdResult = parser.evaluateCommand(testCase.query);
        }

        const qEnd = performance.now();
        const durationMs = qEnd - qStart;

        structTotalMs += durationMs;

        if (!timingStatsByQuery[testCase.query]) {
          timingStatsByQuery[testCase.query] = [];
        }
        timingStatsByQuery[testCase.query].push(durationMs);

        // 1. Synchronized command vs parser check
        if (evaluatedSet.size !== cmdResult.selectedSerials.size) {
          throw new Error(`Evaluator mismatch: parse() count ${evaluatedSet.size} vs evaluateCommand() count ${cmdResult.selectedSerials.size}`);
        }

        // 2. Selection saving check for select command
        if (testCase.query.startsWith('select ')) {
          if (!cmdResult.saveSelection || cmdResult.saveSelection.name !== 'sele_1') {
            throw new Error(`Selection save failed: expected saveSelection.name 'sele_1', got ${JSON.stringify(cmdResult.saveSelection)}`);
          }
        }

        // 3. Ground truth index accuracy resolution check
        const groundTruthSet = computeGroundTruth(processor.atoms, testCase.query);
        let accuracyMatch = true;

        if (groundTruthSet.size !== evaluatedSet.size) {
          accuracyMatch = false;
        } else {
          for (const s of evaluatedSet) {
            if (!groundTruthSet.has(s)) {
              accuracyMatch = false;
              break;
            }
          }
        }

        if (!accuracyMatch) {
          throw new Error(`Ground truth accuracy mismatch: Parser returned ${evaluatedSet.size} atoms, Ground Truth expected ${groundTruthSet.size} atoms`);
        }

        log(`  [PASS] "${testCase.query.padEnd(45, ' ')}" -> ${evaluatedSet.size.toString().padStart(6, ' ')} atoms | Accuracy: 100.0% | Time: ${durationMs.toFixed(3).padStart(7, ' ')} ms`);
        totalQueriesPassed++;
        structPassed++;
      } catch (err: any) {
        const qEnd = performance.now();
        log(`  [FAIL] "${testCase.query}" -> ${err.message}`);
        structFailed++;
      }
    }

    log(`\n  --- Syntax Error Validation ---`);
    for (const errCase of invalidQueries) {
      totalErrorValidationExecuted++;
      try {
        parser.parse(errCase.query);
        log(`  [FAIL] "${errCase.query}" (${errCase.desc}) -> Expected parse error but selection succeeded`);
      } catch (err: any) {
        log(`  [PASS] "${errCase.query.padEnd(20, ' ')}" (${errCase.desc}) -> Caught error: "${err.message}"`);
        totalErrorValidationPassed++;
      }
    }

    timingStatsByStructure[config.id] = {
      totalMs: structTotalMs,
      count: validQueries.length,
      atomCount
    };

    log(`\n  Structure Summary [${config.id}]: ${structPassed}/${validQueries.length} Queries Passed | Execution Time: ${structTotalMs.toFixed(2)} ms\n`);
  }

  const suiteEndTime = performance.now();
  const totalSuiteTime = suiteEndTime - suiteStartTime;

  log("====================================================================================================");
  log("                              AGGREGATE TEST RESULTS & ACCURACY SUMMARY                             ");
  log("====================================================================================================");
  log(`Total Structures Evaluated:             ${STRUCTURE_SUITE.length}`);
  log(`Valid Selection Queries Executed:       ${totalQueriesExecuted}`);
  log(`Valid Selection Queries Passed:         ${totalQueriesPassed} / ${totalQueriesExecuted} (${((totalQueriesPassed / totalQueriesExecuted) * 100).toFixed(1)}%)`);
  log(`Atom Index Resolution Accuracy:         100.0% Verified Across All Passed Queries`);
  log(`Syntax Error Validation Cases Passed:   ${totalErrorValidationPassed} / ${totalErrorValidationExecuted} (${((totalErrorValidationPassed / totalErrorValidationExecuted) * 100).toFixed(1)}%)`);
  log(`Total Execution Duration:               ${(totalSuiteTime / 1000).toFixed(2)} s (${totalSuiteTime.toFixed(2)} ms)\n`);

  log("====================================================================================================");
  log("                           QUERY EXECUTION TIME PERFORMANCE BENCHMARK                               ");
  log("====================================================================================================");
  log(`Query Expression                                Category    Min (ms)    Max (ms)    Avg (ms)    Total (ms)`);
  log(`----------------------------------------------------------------------------------------------------`);

  let globalMin = Infinity;
  let globalMax = 0;
  let globalSum = 0;
  let globalCount = 0;

  for (const testCase of validQueries) {
    const times = timingStatsByQuery[testCase.query] || [];
    if (times.length > 0) {
      const min = Math.min(...times);
      const max = Math.max(...times);
      const sum = times.reduce((a, b) => a + b, 0);
      const avg = sum / times.length;

      if (min < globalMin) globalMin = min;
      if (max > globalMax) globalMax = max;
      globalSum += sum;
      globalCount += times.length;

      log(`${testCase.query.padEnd(48, ' ')} ${testCase.category.padEnd(11, ' ')} ${min.toFixed(3).padStart(9, ' ')} ${max.toFixed(3).padStart(11, ' ')} ${avg.toFixed(3).padStart(11, ' ')} ${sum.toFixed(3).padStart(13, ' ')}`);
    }
  }

  log(`----------------------------------------------------------------------------------------------------`);
  log(`OVERALL QUERY TIMING SUMMARY:`);
  log(`  - Minimum Single Query Time: ${globalMin.toFixed(3)} ms`);
  log(`  - Maximum Single Query Time: ${globalMax.toFixed(3)} ms (Spatial / High-Atom Structures)`);
  log(`  - Average Query Execution Time: ${(globalSum / globalCount).toFixed(3)} ms`);
  log(`  - Cumulative Query Benchmark Time: ${globalSum.toFixed(2)} ms\n`);

  log("====================================================================================================");
  log("                           PER-STRUCTURE EXECUTION BREAKDOWN                                        ");
  log("====================================================================================================");
  log(`PDB ID   Atom Count    Total Query Time (ms)    Avg Query Time (ms)    Category`);
  log(`----------------------------------------------------------------------------------------------------`);

  for (const config of STRUCTURE_SUITE) {
    const stats = timingStatsByStructure[config.id];
    if (stats) {
      const avg = stats.totalMs / stats.count;
      log(`${config.id.padEnd(8, ' ')} ${stats.atomCount.toString().padStart(10, ' ')} ${stats.totalMs.toFixed(2).padStart(22, ' ')} ${avg.toFixed(3).padStart(22, ' ')}    ${config.category}`);
    }
  }
  log(`====================================================================================================\n`);

  const logFilePath = path.join(process.cwd(), 'scratch', 'qa_group8_selection_query.log');
  fs.writeFileSync(logFilePath, logLines.join('\n'), 'utf-8');
  console.log(`Test log successfully written to: ${logFilePath}`);

  if (totalQueriesPassed !== totalQueriesExecuted || totalErrorValidationPassed !== totalErrorValidationExecuted) {
    console.error("Test suite completed with failures!");
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Error executing QA Group 8 selection query test suite:", err);
  process.exit(1);
});
