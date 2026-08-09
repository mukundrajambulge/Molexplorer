const { fork } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log("==========================================================================");
console.log("   ORCHESTRATING 10 TESTING AGENTS ACROSS 200 MOLECULES ON MOLSTUDIO      ");
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

  // Run in concurrent pools of 2 agents to maintain high WebGL frame rates without GPU memory saturation
  const poolSize = 2;
  const tiers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  for (let i = 0; i < tiers.length; i += poolSize) {
    const chunk = tiers.slice(i, i + poolSize);
    console.log(`\n>>> [ORCHESTRATOR] Launching Agent Batch: [ ${chunk.map(t => 'Agent ' + t).join(', ')} ]`);
    await Promise.all(chunk.map(tier => runAgent(tier)));
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n==========================================================================`);
  console.log(`   ALL 10 AGENTS COMPLETED TESTING IN ${durationSec} SECONDS!`);
  console.log(`==========================================================================\n`);
}

runAll();
