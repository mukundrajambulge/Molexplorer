const { fork } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log("==========================================================================");
console.log("   ORCHESTRATING REMAINING AGENTS (7, 8, 9, 10) ON MOLSTUDIO              ");
console.log("==========================================================================\n");

const workerScript = path.join(__dirname, 'run_visual_agent_worker.cjs');

async function runAgent(tier) {
  return new Promise((resolve) => {
    console.log(`[ORCHESTRATOR] Spawning Agent ${tier}...`);
    const child = fork(workerScript, ['--agent', tier.toString()], { stdio: 'inherit' });
    child.on('close', (code) => {
      console.log(`[ORCHESTRATOR] Agent ${tier} exited with code ${code}.`);
      resolve({ tier, code });
    });
  });
}

async function runAll() {
  const startTime = Date.now();

  const tiers = [7, 8, 9, 10];

  for (const tier of tiers) {
    console.log(`\n>>> [ORCHESTRATOR] Launching Agent ${tier}...`);
    await runAgent(tier);
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n==========================================================================`);
  console.log(`   ALL REMAINING AGENTS COMPLETED IN ${durationSec} SECONDS!`);
  console.log(`==========================================================================\n`);
}

runAll();
