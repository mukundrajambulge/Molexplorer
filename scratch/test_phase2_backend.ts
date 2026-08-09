import fs from 'fs';
import path from 'path';

function runPhase2Validation() {
  console.log('=================================================================');
  console.log('  PHASE 2: C++ / DROGON BACKEND ARCHITECTURE VALIDATION SUITE    ');
  console.log('=================================================================');

  const requiredFiles = [
    'backend/CMakeLists.txt',
    'backend/config.json',
    'backend/src/main.cpp',
    'backend/src/models/User.hpp',
    'backend/src/models/Job.hpp',
    'backend/src/storage/Database.hpp',
    'backend/src/storage/Database.cpp',
    'backend/src/worker/JobWorker.hpp',
    'backend/src/worker/JobWorker.cpp',
    'backend/src/controllers/AuthController.hpp',
    'backend/src/controllers/AuthController.cpp',
    'backend/src/controllers/JobController.hpp',
    'backend/src/controllers/JobController.cpp',
    'backend/src/controllers/DownloadController.hpp',
    'backend/src/controllers/DownloadController.cpp',
    'Dockerfile.backend'
  ];

  let passed = 0;
  let failed = 0;

  for (const relPath of requiredFiles) {
    const fullPath = path.join(process.cwd(), relPath);
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);
      console.log(`[PASS] ${relPath} exists (${stats.size} bytes)`);
      passed++;
    } else {
      console.error(`[FAIL] ${relPath} missing`);
      failed++;
    }
  }

  // Verify bun.lock is removed per Section 13
  const bunLockPath = path.join(process.cwd(), 'bun.lock');
  if (!fs.existsSync(bunLockPath)) {
    console.log(`[PASS] bun.lock removed per Section 13 build consistency requirement`);
    passed++;
  } else {
    console.error(`[FAIL] bun.lock still present in root`);
    failed++;
  }

  // Verify package.json contains packageManager
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  if (pkg.packageManager && pkg.packageManager.startsWith('npm@')) {
    console.log(`[PASS] package.json packageManager pinned to ${pkg.packageManager}`);
    passed++;
  } else {
    console.error(`[FAIL] package.json missing packageManager field`);
    failed++;
  }

  console.log('-----------------------------------------------------------------');
  console.log(`Total Checks: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`Pass Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log('=================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2Validation();
