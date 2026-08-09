import { runAgentTierTest } from './test_agent_worker';
import * as fs from 'fs';
import * as path from 'path';

console.log("========================================================================");
console.log("   MOLEXPLORER COMPREHENSIVE TEST SUITE: 10 AGENTS x 20 MOLECULES (200) ");
console.log("========================================================================\n");

const startTime = performance.now();
const allTierResults: any[] = [];
const tierSummaries: any[] = [];

for (let tier = 1; tier <= 10; tier++) {
  console.log(`[AGENT ${tier}] Executing test worker on Tier ${tier} (20 molecules)...`);
  const { results, summary } = runAgentTierTest(tier);
  allTierResults.push(...results);
  tierSummaries.push(summary);

  console.log(`   -> Completed Tier ${tier}: Passed=${summary.passedCount}/${summary.totalMolecules}, Total Atoms=${summary.totalAtomsTested}, Avg Parse=${summary.avgParseTimeMs.toFixed(3)}ms, Avg Query=${summary.avgQueryTimeMs.toFixed(3)}ms`);
}

const totalTimeMs = performance.now() - startTime;
const grandTotalMolecules = allTierResults.length;
const grandPassed = allTierResults.filter(r => r.status === 'PASS').length;
const grandFailed = allTierResults.filter(r => r.status === 'FAIL').length;
const grandTotalAtoms = allTierResults.reduce((acc, r) => acc + r.atomCount, 0);

const fullReport = {
  timestamp: new Date().toISOString(),
  totalExecutionTimeMs: totalTimeMs,
  summary: {
    totalMolecules: grandTotalMolecules,
    passedMolecules: grandPassed,
    failedMolecules: grandFailed,
    passPercentage: ((grandPassed / grandTotalMolecules) * 100).toFixed(2) + "%",
    totalAtomsTested: grandTotalAtoms,
  },
  tierSummaries,
  detailedResults: allTierResults
};

const outputPath = path.join(process.cwd(), 'scratch', 'test_results_200_molecules.json');
fs.writeFileSync(outputPath, JSON.stringify(fullReport, null, 2));

console.log("\n========================================================================");
console.log(` GRAND SUMMARY: ${grandPassed}/${grandTotalMolecules} Passed (${fullReport.summary.passPercentage})`);
console.log(` TOTAL ATOMS TESTED across 200 molecules: ${grandTotalAtoms.toLocaleString()}`);
console.log(` TOTAL EXECUTION TIME: ${(totalTimeMs / 1000).toFixed(2)} seconds`);
console.log(` Full detailed report saved to: ${outputPath}`);
console.log("========================================================================\n");
