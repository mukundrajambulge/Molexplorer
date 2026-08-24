/**
 * reproduce_p4_6_audit_bug.ts
 * Reproduction script for P4.6 Query Audit Bug: `bychain ligand` with named selection.
 */

import * as fs from 'fs';
import * as path from 'path';
import { MolProcessor } from '../src/lib/MolProcessor';
import { SelectionParser } from '../src/lib/SelectionParser';
import { ScientificCommandRouter } from '../src/domain/ScientificCommandRouter';

const fixturePath = path.resolve(process.cwd(), 'fixtures/03_protein_with_ligand.pdb');
const p = new MolProcessor(fs.readFileSync(fixturePath, 'utf8'), 'pdb');
p.assignBonds(1.1);

console.log('================================================================================');
console.log('                 P4.6 QUERY AUDIT REPRODUCTION REPORT                           ');
console.log('================================================================================\n');

const query = 'bychain ligand';
console.log(`Target Query: "${query}"`);

// 1. Tokenizer output
const parser = new SelectionParser(p.atoms);
const tokens = parser.tokenize(query);
console.log('\n1. Tokenizer Output:');
console.log(JSON.stringify(tokens, null, 2));

// 2. Parsed AST attempt
console.log('\n2. AST Parsing Attempt:');
try {
  const ast = parser.buildExpression([...tokens]);
  console.log('Parsed AST:', JSON.stringify(ast, null, 2));
} catch (err: any) {
  console.log(`AST Parsing Failed: ${err.message}`);
}

// 3. Command Router execution with named selection present
const namedSelections = [
  { name: 'ligand', query: 'resn LIG', atomIds: [17, 18, 19, 20] }
];

console.log('\n3. Execution via ScientificCommandRouter with named selection [ligand]:');
try {
  const res = ScientificCommandRouter.routeAndExecute(query, p.atoms, namedSelections, 'test_mol');
  console.log('Result:', res);
} catch (err: any) {
  console.log(`Router Error: ${err.message}`);
}

console.log('\n================================================================================');
