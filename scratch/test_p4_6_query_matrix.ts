/**
 * test_p4_6_query_matrix.ts
 * Comprehensive Multi-Fixture P4.6 Query Matrix testing:
 * 1. Direct built-in / discovered expression
 * 2. Parenthesized expression
 * 3. Named selection reference
 * 4. Invalid/unknown operand (fail-closed typed error)
 * 
 * Executed across multiple canonical structures (03PL, 1CRN, 1UBQ, 4DJW).
 */

import * as fs from 'fs';
import * as path from 'path';
import { MolProcessor } from '../src/lib/MolProcessor';
import { ScientificCommandRouter } from '../src/domain/ScientificCommandRouter';

interface FixtureSpec {
  id: string;
  filename: string;
}

const FIXTURES: FixtureSpec[] = [
  { id: '03PL', filename: '03_protein_with_ligand.pdb' },
  { id: '1CRN', filename: '1CRN.pdb' },
  { id: '1UBQ', filename: '1UBQ.pdb' },
  { id: '4DJW', filename: '4DJW.pdb' }
];

function loadFixturePdb(filename: string): string {
  const scratchPath = path.resolve(process.cwd(), 'scratch', filename);
  if (fs.existsSync(scratchPath)) return fs.readFileSync(scratchPath, 'utf8');
  const fixturesPath = path.resolve(process.cwd(), 'fixtures', filename);
  if (fs.existsSync(fixturesPath)) return fs.readFileSync(fixturesPath, 'utf8');
  throw new Error(`Fixture file not found: ${filename}`);
}

console.log('================================================================================');
console.log('          MOLEXPLORER P4.6 MULTI-FIXTURE GENERIC QUERY MATRIX                   ');
console.log('================================================================================\n');

let totalChecks = 0;
let passedChecks = 0;

for (const fix of FIXTURES) {
  console.log(`\n================================================================================`);
  console.log(`EVALUATING MATRIX ON FIXTURE: ${fix.id} (${fix.filename})`);
  console.log(`================================================================================`);

  const p = new MolProcessor(loadFixturePdb(fix.filename), 'pdb');
  p.assignBonds(1.1);
  const canonMol = p.getCanonicalMolecule({ name: fix.filename });

  // Dynamic discovery of valid test selections
  const seedRes = canonMol.residues[0];
  const seedChain = canonMol.chains[0]?.chain_id || 'A';
  const seedAtom1 = canonMol.atoms[0];
  const seedAtom2 = canonMol.atoms[1] || seedAtom1;
  const seedAtom3 = canonMol.atoms[2] || seedAtom2;
  const seedAtom4 = canonMol.atoms[3] || seedAtom3;

  const rawSubsetExpr = `resi ${seedRes.sequence_number || 1}`;
  const rawChainExpr = `chain ${seedChain}`;

  const namedSelections = [
    { name: 'dyn_subset', query: rawSubsetExpr, atomIds: seedRes.atom_ids },
    { name: 'dyn_chain', query: rawChainExpr, atomIds: canonMol.chains[0]?.atom_ids || [] },
    { name: 'dyn_a1', query: `id ${seedAtom1.canonical_id}`, atomIds: [seedAtom1.canonical_id] },
    { name: 'dyn_a2', query: `id ${seedAtom2.canonical_id}`, atomIds: [seedAtom2.canonical_id] },
    { name: 'dyn_a3', query: `id ${seedAtom3.canonical_id}`, atomIds: [seedAtom3.canonical_id] },
    { name: 'dyn_a4', query: `id ${seedAtom4.canonical_id}`, atomIds: [seedAtom4.canonical_id] }
  ];

  interface MatrixRow {
    operator: string;
    direct: string;
    parenthesized: string;
    named: string;
    invalid: string;
    expectedInvalidError: string;
  }

  const matrix: MatrixRow[] = [
    {
      operator: 'neighbor',
      direct: `neighbor ${rawSubsetExpr}`,
      parenthesized: `neighbor (${rawSubsetExpr})`,
      named: 'neighbor dyn_subset',
      invalid: 'neighbor unknown_operand_xyz',
      expectedInvalidError: "Unknown selection reference 'unknown_operand_xyz'"
    },
    {
      operator: 'bound_to',
      direct: `bound_to ${rawSubsetExpr}`,
      parenthesized: `bound_to (${rawSubsetExpr})`,
      named: 'bound_to dyn_subset',
      invalid: 'bound_to unknown_operand_xyz',
      expectedInvalidError: "Unknown selection reference 'unknown_operand_xyz'"
    },
    {
      operator: 'within',
      direct: `within 5.0 of ${rawSubsetExpr}`,
      parenthesized: `within 5.0 of (${rawSubsetExpr})`,
      named: 'within 5.0 of dyn_subset',
      invalid: 'within 5.0 of unknown_operand_xyz',
      expectedInvalidError: "Unknown selection reference 'unknown_operand_xyz'"
    },
    {
      operator: 'around',
      direct: `around 5.0 of ${rawSubsetExpr}`,
      parenthesized: `around 5.0 of (${rawSubsetExpr})`,
      named: 'around 5.0 of dyn_subset',
      invalid: 'around 5.0 of unknown_operand_xyz',
      expectedInvalidError: "Unknown selection reference 'unknown_operand_xyz'"
    },
    {
      operator: 'beyond',
      direct: `beyond 5.0 of ${rawSubsetExpr}`,
      parenthesized: `beyond 5.0 of (${rawSubsetExpr})`,
      named: 'beyond 5.0 of dyn_subset',
      invalid: 'beyond 5.0 of unknown_operand_xyz',
      expectedInvalidError: "Unknown selection reference 'unknown_operand_xyz'"
    },
    {
      operator: 'expand',
      direct: `${rawSubsetExpr} expand 5.0`,
      parenthesized: `(${rawSubsetExpr}) expand 5.0`,
      named: 'dyn_subset expand 5.0',
      invalid: 'unknown_operand_xyz expand 5.0',
      expectedInvalidError: "Unknown selection reference 'unknown_operand_xyz'"
    },
    {
      operator: 'extend',
      direct: `extend 1 of ${rawSubsetExpr}`,
      parenthesized: `extend 1 of (${rawSubsetExpr})`,
      named: 'extend 1 of dyn_subset',
      invalid: 'extend 1 of unknown_operand_xyz',
      expectedInvalidError: "Unknown selection reference 'unknown_operand_xyz'"
    },
    {
      operator: 'byres',
      direct: `byres ${rawSubsetExpr}`,
      parenthesized: `byres (${rawSubsetExpr})`,
      named: 'byres dyn_subset',
      invalid: 'byres unknown_operand_xyz',
      expectedInvalidError: "Unknown selection reference 'unknown_operand_xyz'"
    },
    {
      operator: 'bychain',
      direct: `bychain ${rawSubsetExpr}`,
      parenthesized: `bychain (${rawSubsetExpr})`,
      named: 'bychain dyn_subset',
      invalid: 'bychain unknown_operand_xyz',
      expectedInvalidError: "Unknown selection reference 'unknown_operand_xyz'"
    },
    {
      operator: 'bymolecule',
      direct: `bymolecule ${rawSubsetExpr}`,
      parenthesized: `bymolecule (${rawSubsetExpr})`,
      named: 'bymolecule dyn_subset',
      invalid: 'bymolecule unknown_operand_xyz',
      expectedInvalidError: "Unknown selection reference 'unknown_operand_xyz'"
    },
    {
      operator: 'bycalpha',
      direct: `bycalpha ${rawChainExpr}`,
      parenthesized: `bycalpha (${rawChainExpr})`,
      named: 'bycalpha dyn_chain',
      invalid: 'bycalpha unknown_operand_xyz',
      expectedInvalidError: "Unknown selection reference 'unknown_operand_xyz'"
    },
    {
      operator: 'byca',
      direct: `byca ${rawChainExpr}`,
      parenthesized: `byca (${rawChainExpr})`,
      named: 'byca dyn_chain',
      invalid: 'byca unknown_operand_xyz',
      expectedInvalidError: "Unknown selection reference 'unknown_operand_xyz'"
    },
    {
      operator: 'byring',
      direct: `byring ${rawSubsetExpr}`,
      parenthesized: `byring (${rawSubsetExpr})`,
      named: 'byring dyn_subset',
      invalid: 'byring unknown_operand_xyz',
      expectedInvalidError: "Unknown selection reference 'unknown_operand_xyz'"
    },
    {
      operator: 'distance',
      direct: `distance d1, id ${seedAtom1.canonical_id}, id ${seedAtom2.canonical_id}`,
      parenthesized: `distance d1, (id ${seedAtom1.canonical_id}), (id ${seedAtom2.canonical_id})`,
      named: 'distance d1, dyn_a1, dyn_a2',
      invalid: 'distance d1, dyn_a1, unknown_operand_xyz',
      expectedInvalidError: "Unknown selection reference 'unknown_operand_xyz'"
    },
    {
      operator: 'angle',
      direct: `angle a1, id ${seedAtom1.canonical_id}, id ${seedAtom2.canonical_id}, id ${seedAtom3.canonical_id}`,
      parenthesized: `angle a1, (id ${seedAtom1.canonical_id}), (id ${seedAtom2.canonical_id}), (id ${seedAtom3.canonical_id})`,
      named: 'angle a1, dyn_a1, dyn_a2, dyn_a3',
      invalid: 'angle a1, dyn_a1, dyn_a2, unknown_operand_xyz',
      expectedInvalidError: "Unknown selection reference 'unknown_operand_xyz'"
    },
    {
      operator: 'dihedral',
      direct: `dihedral dih1, id ${seedAtom1.canonical_id}, id ${seedAtom2.canonical_id}, id ${seedAtom3.canonical_id}, id ${seedAtom4.canonical_id}`,
      parenthesized: `dihedral dih1, (id ${seedAtom1.canonical_id}), (id ${seedAtom2.canonical_id}), (id ${seedAtom3.canonical_id}), (id ${seedAtom4.canonical_id})`,
      named: 'dihedral dih1, dyn_a1, dyn_a2, dyn_a3, dyn_a4',
      invalid: 'dihedral dih1, dyn_a1, dyn_a2, dyn_a3, unknown_operand_xyz',
      expectedInvalidError: "Unknown selection reference 'unknown_operand_xyz'"
    },
    {
      operator: 'polar_contacts',
      direct: `polar_contacts ${rawSubsetExpr}, not (${rawSubsetExpr})`,
      parenthesized: `polar_contacts (${rawSubsetExpr}), (not (${rawSubsetExpr}))`,
      named: 'polar_contacts dyn_subset, dyn_chain',
      invalid: 'polar_contacts dyn_subset, unknown_operand_xyz',
      expectedInvalidError: "Unknown selection reference 'unknown_operand_xyz'"
    },
    {
      operator: 'salt_bridges',
      direct: 'salt_bridges all, all',
      parenthesized: 'salt_bridges (all), (all)',
      named: 'salt_bridges dyn_chain, dyn_chain',
      invalid: 'salt_bridges dyn_chain, unknown_operand_xyz',
      expectedInvalidError: "Unknown selection reference 'unknown_operand_xyz'"
    },
    {
      operator: 'pi_stack',
      direct: 'pi_stack all, all',
      parenthesized: 'pi_stack (all), (all)',
      named: 'pi_stack dyn_chain, dyn_chain',
      invalid: 'pi_stack dyn_chain, unknown_operand_xyz',
      expectedInvalidError: "Unknown selection reference 'unknown_operand_xyz'"
    },
    {
      operator: 'cation_pi',
      direct: 'cation_pi all, all',
      parenthesized: 'cation_pi (all), (all)',
      named: 'cation_pi dyn_chain, dyn_chain',
      invalid: 'cation_pi dyn_chain, unknown_operand_xyz',
      expectedInvalidError: "Unknown selection reference 'unknown_operand_xyz'"
    },
    {
      operator: 'halogen_bonds',
      direct: 'halogen_bonds all, all',
      parenthesized: 'halogen_bonds (all), (all)',
      named: 'halogen_bonds dyn_chain, dyn_chain',
      invalid: 'halogen_bonds dyn_chain, unknown_operand_xyz',
      expectedInvalidError: "Unknown selection reference 'unknown_operand_xyz'"
    },
    {
      operator: 'hydrophobic_contacts',
      direct: `hydrophobic_contacts ${rawSubsetExpr}, not (${rawSubsetExpr})`,
      parenthesized: `hydrophobic_contacts (${rawSubsetExpr}), (not (${rawSubsetExpr}))`,
      named: 'hydrophobic_contacts dyn_subset, dyn_chain',
      invalid: 'hydrophobic_contacts dyn_subset, unknown_operand_xyz',
      expectedInvalidError: "Unknown selection reference 'unknown_operand_xyz'"
    }
  ];

  const resultsTable: any[] = [];

  for (const row of matrix) {
    let directPass = false;
    let parenPass = false;
    let namedPass = false;
    let invalidPass = false;
    let directCount = 0;
    let parenCount = 0;
    let namedCount = 0;

    totalChecks++;
    try {
      const res = ScientificCommandRouter.routeAndExecute(row.direct, p.atoms, namedSelections, fix.id);
      directPass = true;
      directCount = res.count;
      passedChecks++;
    } catch (err: any) {
      console.error(`FAIL Direct: ${row.operator} on ${fix.id} -> ${err.message}`);
    }

    totalChecks++;
    try {
      const res = ScientificCommandRouter.routeAndExecute(row.parenthesized, p.atoms, namedSelections, fix.id);
      parenPass = true;
      parenCount = res.count;
      passedChecks++;
    } catch (err: any) {
      console.error(`FAIL Paren: ${row.operator} on ${fix.id} -> ${err.message}`);
    }

    totalChecks++;
    try {
      const res = ScientificCommandRouter.routeAndExecute(row.named, p.atoms, namedSelections, fix.id);
      namedPass = true;
      namedCount = res.count;
      passedChecks++;
    } catch (err: any) {
      console.error(`FAIL Named: ${row.operator} on ${fix.id} -> ${err.message}`);
    }

    totalChecks++;
    try {
      ScientificCommandRouter.routeAndExecute(row.invalid, p.atoms, namedSelections, fix.id);
      console.error(`FAIL Invalid: ${row.operator} on ${fix.id} expected error but passed`);
    } catch (err: any) {
      if (err.message.includes(row.expectedInvalidError)) {
        invalidPass = true;
        passedChecks++;
      } else {
        console.error(`FAIL Invalid: ${row.operator} on ${fix.id} error mismatch: got "${err.message}", expected "${row.expectedInvalidError}"`);
      }
    }

    const allPass = directPass && parenPass && namedPass && invalidPass;
    const status = allPass ? 'IMPLEMENTED' : (directPass || parenPass ? 'PARTIAL' : 'BROKEN');

    resultsTable.push({
      Operator: row.operator,
      Direct: directPass ? `PASS (${directCount})` : 'FAIL',
      Paren: parenPass ? `PASS (${parenCount})` : 'FAIL',
      Named: namedPass ? `PASS (${namedCount})` : 'FAIL',
      FailClosed: invalidPass ? 'PASS [Typed Error]' : 'FAIL',
      Status: status
    });
  }

  console.table(resultsTable);
}

console.log('\n================================================================================');
console.log(`MULTI-FIXTURE MATRIX SUMMARY: ${passedChecks} / ${totalChecks} Checks Passed (${((passedChecks / totalChecks) * 100).toFixed(1)}%)`);
console.log('================================================================================');

if (passedChecks !== totalChecks) {
  process.exit(1);
}
