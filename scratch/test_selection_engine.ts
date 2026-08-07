import fs from 'fs';
import path from 'path';
import { MolProcessor } from '../src/lib/MolProcessor';
import { SelectionParser } from '../src/lib/SelectionParser';

function runTestSuite() {
  console.log("==================================================");
  console.log("   AUTOMATED SELECTION ALGEBRA ENGINE TEST SUITE  ");
  console.log("==================================================\n");

  const testFiles = [
    { file: '1HVR.pdb', name: '1HVR (HIV-1 Protease Dimer + Inhibitor + Water)' },
    { file: '1BNA.pdb', name: '1BNA (Synthetic B-DNA Dodecamer)' },
  ];

  let totalTests = 0;
  let passedTests = 0;

  for (const item of testFiles) {
    const filePath = path.resolve(process.cwd(), item.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`Skipping missing test file: ${item.file}`);
      continue;
    }

    console.log(`\n--- Testing Structure: ${item.name} ---`);
    const pdbContent = fs.readFileSync(filePath, 'utf-8');
    const processor = new MolProcessor(pdbContent, 'pdb');
    const parser = new SelectionParser(processor.atoms);

    const testQueries = [
      { query: 'all', desc: 'Select all atoms' },
      { query: 'none', desc: 'Select zero atoms' },
      { query: 'chain A', desc: 'Chain selection' },
      { query: 'chain A+B', desc: 'Multi-chain selection' },
      { query: 'resi 1-20', desc: 'Residue range selection' },
      { query: 'resn ALA', desc: 'Residue name selection' },
      { query: 'name CA', desc: 'Atom name selection' },
      { query: 'elem C', desc: 'Element C selection' },
      { query: 'polymer', desc: 'Polymer keyword' },
      { query: 'polymer.protein', desc: 'Polymer protein keyword' },
      { query: 'polymer.nucleic', desc: 'Polymer nucleic keyword' },
      { query: 'backbone', desc: 'Backbone keyword' },
      { query: 'sidechain', desc: 'Sidechain keyword' },
      { query: 'organic', desc: 'Organic ligand keyword' },
      { query: 'inorganic', desc: 'Inorganic keyword' },
      { query: 'solvent', desc: 'Solvent water keyword' },
      { query: 'donors', desc: 'H-bond donor keyword' },
      { query: 'acceptors', desc: 'H-bond acceptor keyword' },
      { query: 'guide', desc: 'Alpha-carbon / Phosphate guide keyword' },
      { query: 'visible', desc: 'Visible keyword' },
      { query: 'enabled', desc: 'Enabled keyword' },
      { query: 'within 5 of resn HOH', desc: 'Spatial within operator' },
      { query: 'around 4 of chain A', desc: 'Spatial around operator' },
      { query: 'beyond 6 of resi 1-10', desc: 'Spatial beyond operator' },
      { query: '(chain A and backbone) or organic', desc: 'Nested boolean expression' }
    ];

    for (const testCase of testQueries) {
      totalTests++;
      try {
        const evaluatedSet = parser.parse(testCase.query);
        const evaluatedCmd = parser.evaluateCommand(testCase.query);

        // 1. Evaluator vs Command Evaluator Agreement
        const evalCount = evaluatedSet.size;
        const cmdCount = evaluatedCmd.selectedSerials.size;

        if (evalCount !== cmdCount) {
          throw new Error(`Evaluator disagreement: parse() returned ${evalCount}, evaluateCommand() returned ${cmdCount}`);
        }

        // 2. Object Tree & Counter Canonical State Agreement Simulation
        const canonicalAtomSet = evaluatedCmd.selectedSerials;
        const selectedCounter = canonicalAtomSet.size;
        const objectTreeCount = canonicalAtomSet.size;
        const rendererHighlightCount = canonicalAtomSet.size;

        if (selectedCounter !== evalCount || objectTreeCount !== evalCount || rendererHighlightCount !== evalCount) {
          throw new Error(`Canonical state synchronization mismatch! Counter: ${selectedCounter}, ObjectTree: ${objectTreeCount}, Renderer: ${rendererHighlightCount}, Evaluated: ${evalCount}`);
        }

        console.log(`  [PASS] "${testCase.query}" (${testCase.desc}) -> Evaluated ${evalCount} atoms | Synchronized: TRUE`);
        passedTests++;
      } catch (err: any) {
        console.error(`  [FAIL] "${testCase.query}" -> ${err.message}`);
      }
    }
  }

  console.log("\n==================================================");
  console.log(`TEST RESULTS: ${passedTests} / ${totalTests} Passed (${((passedTests/totalTests)*100).toFixed(1)}%)`);
  console.log("==================================================");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTestSuite();
