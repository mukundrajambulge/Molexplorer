/**
 * run_all_regressions.ts
 * Master Regression Gate Runner for Post-SQ3 Validation.
 */

import { execSync } from 'child_process';
import * as path from 'path';

const testSuites = [
  'scratch/test_selection_composition.ts',
  'scratch/test_canonical_selection.ts',
  'scratch/test_selection_macros_advanced.ts',
  'scratch/test_generic_selection_semantics.ts',
  'scratch/test_selection_presentation_commands.ts',
  'scratch/test_sequence_viewer.ts',
  'scratch/test_scientific_integrity_harness.ts',
  'scratch/test_history_inspector.ts',
  'scratch/test_revision_navigation.ts',
  'scratch/test_alter_transaction.ts',
  'scratch/test_hydrogen_transaction.ts',
  'scratch/test_bond_order_transaction.ts',
  'scratch/test_bond_transaction.ts',
  'scratch/test_remove_transaction.ts',
  'scratch/test_scientific_benchmarks.ts',
  'scratch/test_performance_stress.ts',
  'scratch/test_phase4_pse_session.ts'
];

console.log('================================================================================');
console.log('       MASTER POST-SQ3 REGRESSION HARNESS: RUNNING ALL SCIENTIFIC SUITES       ');
console.log('================================================================================\n');

let passedSuites = 0;
let failedSuites = 0;

for (const suite of testSuites) {
  const suiteName = path.basename(suite);
  process.stdout.write(`Executing ${suiteName.padEnd(45)} `);
  try {
    const startTime = Date.now();
    execSync(`npx tsx ${suite}`, { stdio: 'pipe', encoding: 'utf8' });
    const duration = Date.now() - startTime;
    console.log(`[PASS] (${duration}ms)`);
    passedSuites++;
  } catch (err: any) {
    console.log(`[FAIL]`);
    console.error(err.stdout || err.stderr || err.message);
    failedSuites++;
  }
}

console.log('\n================================================================================');
console.log(`MASTER REGRESSION HARNESS RESULT: ${passedSuites} / ${testSuites.length} Suites Passed`);
console.log('================================================================================');

if (failedSuites > 0) {
  process.exit(1);
}
