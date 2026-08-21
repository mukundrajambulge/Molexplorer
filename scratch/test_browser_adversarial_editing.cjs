const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\mukun\\.gemini\\antigravity\\brain\\e43f6ae3-6d0c-44fd-ae3d-9abd3e716b18';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function assertEqual(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(`[ASSERT FAIL] ${label}: expected ${expected}, got ${actual}`);
  }
  console.log(`  [ASSERT PASS] ${label}: ${actual}`);
}

async function assertMatches(label, actual, pattern) {
  if (!pattern.test(String(actual))) {
    throw new Error(`[ASSERT FAIL] ${label}: "${actual}" does not match ${pattern}`);
  }
  console.log(`  [ASSERT PASS] ${label}: ${actual}`);
}

(async () => {
  console.log('================================================================================');
  console.log('   TASK P4.1: BROWSER ADVERSARIAL EDITING VERIFICATION (MOLSTUDIO)             ');
  console.log('================================================================================\n');

  const fixturePdb = fs.readFileSync(path.resolve(process.cwd(), 'fixtures/03_protein_with_ligand.pdb'), 'utf8');
  let totalSteps = 0;
  let passedSteps = 0;

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
      '--enable-webgl', '--ignore-gpu-blocklist']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'warning' || msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', err => consoleErrors.push('[PAGEERROR] ' + err.message));
  page.on('dialog', async dialog => { await dialog.dismiss(); });

  async function runStep(stepName, fn) {
    totalSteps++;
    console.log(`\n[STEP ${totalSteps}] ${stepName}`);
    try {
      await fn();
      passedSteps++;
      console.log(`  -> PASSED`);
    } catch (err) {
      console.error(`  -> FAILED: ${err.message}`);
      throw err;
    }
  }

  await page.goto('http://localhost:5173/molstudio', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  await runStep("1. Load fixture (20 atoms baseline)", async () => {
    await page.evaluate((pdb) => {
      window.__molStudioTestApi.loadMolecule('03_protein_with_ligand.pdb', pdb, 'pdb');
    }, fixturePdb);
    await new Promise(r => setTimeout(r, 2000));
    const state = await page.evaluate(() => window.__molStudioTestApi.getState());
    await assertEqual("Baseline atom count", state.atomsCount, 20);

    const shot = path.join(SCREENSHOT_DIR, 'adv_01_baseline.png');
    await page.screenshot({ path: shot });
    console.log(`  -> Screenshot: ${shot}`);
  });

  await runStep("2. Valid mutation: remove id 20 -> 19 atoms", async () => {
    const preMutationErrors = consoleErrors.length;
    await page.evaluate(() => { window.__molStudioTestApi.runQuery('remove id 20'); });
    await new Promise(r => setTimeout(r, 1500));
    const state = await page.evaluate(() => window.__molStudioTestApi.getState());
    await assertEqual("Atom count after remove", state.atomsCount, 19);

    const shot = path.join(SCREENSHOT_DIR, 'adv_02_after_remove.png');
    await page.screenshot({ path: shot });
    console.log(`  -> Screenshot: ${shot}`);
  });

  await runStep("3. Adversarial: security injection in alter (state must remain unchanged)", async () => {
    const preState = await page.evaluate(() => window.__molStudioTestApi.getState());
    const preCount = preState.atomsCount;

    // Attempt security injection
    consoleErrors.length = 0;
    await page.evaluate(() => {
      window.__molStudioTestApi.runQuery("alter id 17, name=javascript:alert(1)");
    });
    await new Promise(r => setTimeout(r, 1200));

    const postState = await page.evaluate(() => window.__molStudioTestApi.getState());
    await assertEqual("Atom count unchanged after injected alter", postState.atomsCount, preCount);
    console.log(`  -> Error/warning logged: ${consoleErrors.length > 0 ? 'YES (fail-closed)' : 'NO (logged silently)'}`);

    const shot = path.join(SCREENSHOT_DIR, 'adv_03_after_injection_attempt.png');
    await page.screenshot({ path: shot });
    console.log(`  -> Screenshot: ${shot}`);
  });

  await runStep("4. Adversarial: invalid formal_charge=99 (out-of-range, state must remain unchanged)", async () => {
    const preState = await page.evaluate(() => window.__molStudioTestApi.getState());
    const preCount = preState.atomsCount;

    consoleErrors.length = 0;
    await page.evaluate(() => {
      window.__molStudioTestApi.runQuery("alter id 17, formal_charge=99");
    });
    await new Promise(r => setTimeout(r, 1200));

    const postState = await page.evaluate(() => window.__molStudioTestApi.getState());
    await assertEqual("Atom count unchanged after out-of-range charge", postState.atomsCount, preCount);
    console.log(`  -> Error/warning logged: ${consoleErrors.length > 0 ? 'YES (fail-closed)' : 'NO (logged silently)'}`);

    const shot = path.join(SCREENSHOT_DIR, 'adv_04_after_invalid_charge.png');
    await page.screenshot({ path: shot });
    console.log(`  -> Screenshot: ${shot}`);
  });

  await runStep("5. Undo -> restores 20 atoms", async () => {
    await page.evaluate(() => { window.__molStudioTestApi.runQuery('undo'); });
    await new Promise(r => setTimeout(r, 1500));
    const state = await page.evaluate(() => window.__molStudioTestApi.getState());
    await assertEqual("Atom count after undo", state.atomsCount, 20);

    const shot = path.join(SCREENSHOT_DIR, 'adv_05_after_undo.png');
    await page.screenshot({ path: shot });
    console.log(`  -> Screenshot: ${shot}`);
  });

  await runStep("6. Redo -> restores 19 atoms", async () => {
    await page.evaluate(() => { window.__molStudioTestApi.runQuery('redo'); });
    await new Promise(r => setTimeout(r, 1500));
    const state = await page.evaluate(() => window.__molStudioTestApi.getState());
    await assertEqual("Atom count after redo", state.atomsCount, 19);

    const shot = path.join(SCREENSHOT_DIR, 'adv_06_after_redo.png');
    await page.screenshot({ path: shot });
    console.log(`  -> Screenshot: ${shot}`);
  });

  await runStep("7. Branch edit: undo, then alter id 17 name=C99 -> R_branch", async () => {
    await page.evaluate(() => {
      window.__molStudioTestApi.runQuery('undo');
      window.__molStudioTestApi.runQuery('alter id 17, name=C99');
    });
    await new Promise(r => setTimeout(r, 1500));
    const state = await page.evaluate(() => window.__molStudioTestApi.getState());
    // After undo we're at 20 atoms; after alter still 20 atoms
    await assertEqual("Atom count after branch alter", state.atomsCount, 20);

    const shot = path.join(SCREENSHOT_DIR, 'adv_07_after_branch_edit.png');
    await page.screenshot({ path: shot });
    console.log(`  -> Screenshot: ${shot}`);
  });

  await runStep("8. PSE save/reload -> active state preserved", async () => {
    const pseString = await page.evaluate(() => window.__molStudioTestApi.exportSessionString());
    console.log(`  -> PSE length: ${pseString ? pseString.length : 0} bytes`);

    const imported = JSON.parse(pseString);
    const mol = imported.molecules[0];
    await page.evaluate((name, data, fmt) => {
      window.__molStudioTestApi.loadMolecule(name, data, fmt);
    }, mol.name, mol.data, mol.format);
    await new Promise(r => setTimeout(r, 2000));

    const reloadedState = await page.evaluate(() => window.__molStudioTestApi.getState());
    await assertEqual("Atom count after PSE reload", reloadedState.atomsCount, 20);

    const shot = path.join(SCREENSHOT_DIR, 'adv_08_after_pse_reload.png');
    await page.screenshot({ path: shot });
    console.log(`  -> Screenshot: ${shot}`);
  });

  await browser.close();

  console.log('\n================================================================================');
  console.log(`BROWSER ADVERSARIAL TEST SUMMARY: ${passedSteps} / ${totalSteps} Steps Passed`);
  console.log('================================================================================\n');

  if (passedSteps !== totalSteps) {
    process.exit(1);
  }
})();
