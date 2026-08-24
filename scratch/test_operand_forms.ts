/**
 * test_operand_forms.ts
 * Tests both named-selection identifier and raw selection expression forms for P4.6 operators.
 */

import * as fs from 'fs';
import * as path from 'path';
import { MolProcessor } from '../src/lib/MolProcessor';
import { ScientificCommandRouter } from '../src/domain/ScientificCommandRouter';

const fixturePath = path.resolve(process.cwd(), 'fixtures/03_protein_with_ligand.pdb');
const p = new MolProcessor(fs.readFileSync(fixturePath, 'utf8'), 'pdb');
p.assignBonds(1.1);

const namedSelections = [
  { name: 'ligand', query: 'resn LIG', atomIds: [17, 18, 19, 20] },
  { name: 'protein', query: 'polymer', atomIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] }
];

const testPairs = [
  { name: 'bychain', named: 'bychain ligand', raw: 'bychain (resn LIG)' },
  { name: 'byres', named: 'byres ligand', raw: 'byres (resn LIG)' },
  { name: 'bymolecule', named: 'bymolecule ligand', raw: 'bymolecule (resn LIG)' },
  { name: 'bycalpha', named: 'bycalpha ligand', raw: 'bycalpha (resn LIG)' },
  { name: 'byring', named: 'byring ligand', raw: 'byring (resn LIG)' },
  { name: 'neighbor', named: 'neighbor ligand', raw: 'neighbor (resn LIG)' },
  { name: 'bound_to', named: 'bound_to ligand', raw: 'bound_to (resn LIG)' },
  { name: 'within', named: 'within 5.0 of ligand', raw: 'within 5.0 of (resn LIG)' },
  { name: 'around', named: 'around 5.0 of ligand', raw: 'around 5.0 of (resn LIG)' },
  { name: 'expand', named: 'ligand expand 5.0', raw: '(resn LIG) expand 5.0' },
  { name: 'distance', named: 'distance d1, ligand, protein', raw: 'distance d1, (resn LIG), (polymer)' },
  { name: 'polar_contacts', named: 'polar_contacts ligand, protein', raw: 'polar_contacts (resn LIG), (polymer)' }
];

console.log('================================================================================');
console.log('                 OPERAND FORMS BASELINE AUDIT MATRIX                            ');
console.log('================================================================================\n');

for (const pair of testPairs) {
  let namedStatus = 'UNKNOWN';
  let rawStatus = 'UNKNOWN';
  let namedErr = '';
  let rawErr = '';
  let namedCount = 0;
  let rawCount = 0;

  try {
    const res = ScientificCommandRouter.routeAndExecute(pair.named, p.atoms, namedSelections, 'test_mol');
    namedStatus = 'PASS';
    namedCount = res.count;
  } catch (err: any) {
    namedStatus = 'FAIL';
    namedErr = err.message;
  }

  try {
    const res = ScientificCommandRouter.routeAndExecute(pair.raw, p.atoms, namedSelections, 'test_mol');
    rawStatus = 'PASS';
    rawCount = res.count;
  } catch (err: any) {
    rawStatus = 'FAIL';
    rawErr = err.message;
  }

  console.log(`Operator: ${pair.name}`);
  console.log(`  Raw Form   ("${pair.raw}"): ${rawStatus} (count=${rawCount}) ${rawErr ? `[Err: ${rawErr}]` : ''}`);
  console.log(`  Named Form ("${pair.named}"): ${namedStatus} (count=${namedCount}) ${namedErr ? `[Err: ${namedErr}]` : ''}`);
  console.log('--------------------------------------------------------------------------------');
}
