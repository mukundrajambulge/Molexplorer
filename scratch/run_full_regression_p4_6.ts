/**
 * run_full_regression_p4_6.ts
 * Executes full regression suite covering Phase 3, Phase 4 (P4.1 - P4.6).
 */

import { execSync } from 'child_process';
import * as path from 'path';

const testSuites = [
  'scratch/test_generic_selection_semantics.ts',
  'scratch/test_p4_6_query_matrix.ts',
  'scratch/test_advanced_query_science.ts',
  'scratch/test_scientific_benchmarks.ts',
  'scratch/test_canonical_atom.ts',
  'scratch/test_canonical_bond.ts',
  'scratch/test_canonical_hierarchy.ts',
  'scratch/test_canonical_document.ts',
  'scratch/test_canonical_selection.ts',
  'scratch/test_selection_engine.ts',
  'scratch/test_remove_transaction.ts',
  'scratch/test_bond_transaction.ts',
  'scratch/test_bond_order_transaction.ts',
  'scratch/test_alter_transaction.ts',
  'scratch/test_hydrogen_transaction.ts',
  'scratch/test_history_inspector.ts',
  'scratch/test_revision_navigation.ts',
  'scratch/test_visual_scientific_convergence.ts',
  'scratch/test_performance_stress.ts',
  'scratch/test_export_integrity.ts',
  'scratch/test_phase4_pse_session.ts',
  'scratch/test_scientific_integrity_harness.ts'
];

let totalPassed = 0;
let totalFailed = 0;

console.log('================================================================================');
console.log('            MOLEXPLORER COMPREHENSIVE REGRESSION SUITE (P4.6)                   ');
console.log('================================================================================\n');

for (const suite of testSuites) {
  process.stdout.write(`Running ${suite.padEnd(50)} ... `);
  try {
    const cmd = `npx tsx ${suite}`;
    execSync(cmd, { stdio: 'pipe', encoding: 'utf8' });
    console.log('PASSED [✓]');
    totalPassed++;
  } catch (err: any) {
    console.log('FAILED [✗]');
    console.error(`Error in ${suite}:`, err.stderr || err.stdout || err.message);
    totalFailed++;
  }
}

console.log('\n================================================================================');
console.log(`REGRESSION SUMMARY: ${totalPassed} Passed, ${totalFailed} Failed (${totalPassed}/${testSuites.length} suites)`);
console.log('================================================================================');

if (totalFailed > 0) {
  process.exit(1);
}
