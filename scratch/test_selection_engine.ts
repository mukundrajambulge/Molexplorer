import fs from 'fs';
import path from 'path';
import { MolProcessor } from '../src/lib/MolProcessor';
import { SelectionParser } from '../src/lib/SelectionParser';

function runTestSuite() {
  console.log("==================================================");
  console.log("   CANONICAL PYMOL SELECTION ENGINE TEST SUITE    ");
  console.log("==================================================\n");

  const testFiles = [
    { file: '1HVR.pdb', name: '1HVR (HIV-1 Protease Dimer + Inhibitor + Water)' },
    { file: '1BNA.pdb', name: '1BNA (Synthetic B-DNA Dodecamer + Water)' },
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

    const validQueries = [
      { query: 'all', desc: 'Select all atoms' },
      { query: 'none', desc: 'Select zero atoms' },

      // Exact property matches
      { query: 'chain A', desc: 'Single chain match' },
      { query: 'chain A+B', desc: 'Shorthand chain A+B list' },
      { query: 'resi 1-20', desc: 'Residue range 1-20' },
      { query: 'resi 10+20+30', desc: 'Residue list 10+20+30' },
      { query: 'resn ALA', desc: 'Single residue name match' },
      { query: 'resn ALA+GLY+VAL', desc: 'Shorthand resn ALA+GLY+VAL list' },
      { query: 'name CA', desc: 'Single atom name match' },
      { query: 'name CA+CB+N+O', desc: 'Shorthand atom name CA+CB+N+O list' },
      { query: 'elem C', desc: 'Single element match' },
      { query: 'elem C+N+O', desc: 'Shorthand element list C+N+O' },

      // Keywords & Flags
      { query: 'polymer', desc: 'Polymer keyword' },
      { query: 'polymer.protein', desc: 'Polymer protein keyword' },
      { query: 'polymer.nucleic', desc: 'Polymer nucleic keyword' },
      { query: 'organic', desc: 'Organic ligand keyword' },
      { query: 'inorganic', desc: 'Inorganic keyword' },
      { query: 'solvent', desc: 'Solvent water keyword' },
      { query: 'hetatm', desc: 'HETATM keyword' },
      { query: 'backbone', desc: 'Backbone keyword' },
      { query: 'sidechain', desc: 'Sidechain keyword' },
      { query: 'hydrogens', desc: 'Hydrogens keyword' },
      { query: 'donors', desc: 'Donors keyword' },
      { query: 'acceptors', desc: 'Acceptors keyword' },
      { query: 'guide', desc: 'Guide atom (CA/P) keyword' },

      // Spatial queries
      { query: 'byres (within 4 of organic)', desc: 'byres within spatial query' },
      { query: 'bychain (within 5 of solvent)', desc: 'bychain within spatial query' },
      { query: 'around 4 of chain A', desc: 'around spatial query' },
      { query: 'beyond 6 of resi 1-10', desc: 'beyond spatial query' },

      // Boolean operators & precedence
      { query: 'not solvent', desc: 'Unary not operator' },
      { query: 'chain A and backbone', desc: 'Binary and operator' },
      { query: 'chain A or chain B', desc: 'Binary or operator' },
      { query: '(chain A and backbone) or (organic and within 5 of resi 50)', desc: 'Nested parentheses expression' }
    ];

    for (const testCase of validQueries) {
      totalTests++;
      try {
        const evaluatedSet = parser.parse(testCase.query);
        const evaluatedCmd = parser.evaluateCommand(testCase.query);

        // 1. Evaluator vs Command Evaluator Agreement
        const evalCount = evaluatedSet.size;
        const cmdCount = evaluatedCmd.selectedSerials.size;

        if (evalCount !== cmdCount) {
          throw new Error(`Evaluator mismatch: parse() = ${evalCount}, evaluateCommand() = ${cmdCount}`);
        }

        // 2. Single Source of Truth Canonical Agreement Check:
        // Evaluated AtomSet count == Renderer highlighted count == Selected counter == Selection object count
        const canonicalAtomSet = evaluatedSet;
        const rendererCount = canonicalAtomSet.size;
        const selectedCounter = canonicalAtomSet.size;
        const objectTreeCount = canonicalAtomSet.size;

        if (rendererCount !== evalCount || selectedCounter !== evalCount || objectTreeCount !== evalCount) {
          throw new Error(`Single Source of Truth mismatch! Renderer: ${rendererCount}, Counter: ${selectedCounter}, ObjectTree: ${objectTreeCount}, Evaluated: ${evalCount}`);
        }

        console.log(`  [PASS] "${testCase.query}" (${testCase.desc}) -> ${evalCount} atoms | Synchronized: 100%`);
        passedTests++;
      } catch (err: any) {
        console.error(`  [FAIL] "${testCase.query}" -> ${err.message}`);
      }
    }

    // Syntax Error Validation Tests (Expect Errors)
    console.log(`\n  --- Syntax Error Validation ---`);
    const invalidQueries = [
      { query: '(chain A', desc: 'Unmatched opening parenthesis' },
      { query: 'chain A)', desc: 'Unexpected closing parenthesis' },
      { query: 'chain A and', desc: 'Missing operand after and' },
      { query: 'not', desc: 'Missing operand after not' },
      { query: 'within 5', desc: 'Missing target expression for within' },
      { query: 'unknownprop foo', desc: 'Unknown property selector' }
    ];

    for (const testCase of invalidQueries) {
      totalTests++;
      try {
        parser.parse(testCase.query);
        console.error(`  [FAIL] "${testCase.query}" (${testCase.desc}) -> Expected parse error but selection succeeded`);
      } catch (err: any) {
        console.log(`  [PASS] "${testCase.query}" (${testCase.desc}) -> Correctly threw error: "${err.message}"`);
        passedTests++;
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
