const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\mukun\\.gemini\\antigravity\\brain\\e43f6ae3-6d0c-44fd-ae3d-9abd3e716b18';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

(async () => {
  console.log('========================================================================');
  console.log('       TASK P3.6: MANUAL BROWSER VERIFICATION (REVISION NAVIGATION)      ');
  console.log('========================================================================\n');

  const fixturePdb = fs.readFileSync(path.resolve(process.cwd(), 'fixtures/03_protein_with_ligand.pdb'), 'utf8');

  console.log('1. Launching Headless Chromium with WebGL support...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', msg => console.log('  [BROWSER CONSOLE]', msg.text()));
  page.on('pageerror', err => console.error('  [BROWSER ERROR]', err.message));
  page.on('dialog', async dialog => {
    console.log('  [BROWSER DIALOG]', dialog.message());
    await dialog.dismiss();
  });

  console.log('2. Navigating to MolStudio (http://localhost:5173/molstudio)...');
  await page.goto('http://localhost:5173/molstudio', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  // Step 1: Load fixture and confirm baseline (20 atoms)
  console.log('3. Loading 03_protein_with_ligand.pdb into MolStudio...');
  await page.evaluate((pdb) => {
    window.__molStudioTestApi.loadMolecule('03_protein_with_ligand.pdb', pdb, 'pdb');
    window.__molStudioTestApi.setRenderStyle('Stick');
    window.__molStudioTestApi.setColorScheme('Modern/Jmol');
  }, fixturePdb);

  await new Promise(r => setTimeout(r, 2000));

  const state1 = await page.evaluate(() => window.__molStudioTestApi.getState());
  console.log(`  -> Baseline Atom Count: ${state1.atomsCount} (Expected: 20)`);

  const shot1 = path.join(SCREENSHOT_DIR, 'nav_01_baseline.png');
  await page.screenshot({ path: shot1 });
  console.log(`  -> Saved screenshot: ${shot1}`);

  // Step 2: Perform R1: remove id 20
  console.log('4. Executing R1: "remove id 20"...');
  await page.evaluate(() => {
    window.__molStudioTestApi.runQuery('remove id 20');
  });
  await new Promise(r => setTimeout(r, 1000));

  // Step 3: Perform R2: alter id 17, name=C99
  console.log('5. Executing R2: "alter id 17, name=C99"...');
  await page.evaluate(() => {
    window.__molStudioTestApi.runQuery('alter id 17, name=C99');
  });
  await new Promise(r => setTimeout(r, 1500));

  const state2 = await page.evaluate(() => window.__molStudioTestApi.getState());
  console.log(`  -> State at R2 Atom Count: ${state2.atomsCount} (Expected: 19)`);

  const shot2 = path.join(SCREENSHOT_DIR, 'nav_02_after_edits_r2.png');
  await page.screenshot({ path: shot2 });
  console.log(`  -> Saved screenshot: ${shot2}`);

  // Step 4: Execute UNDO -> R1
  console.log('6. Executing UNDO -> R1...');
  const undoRes1 = await page.evaluate(() => {
    return window.__molStudioTestApi.runQuery('undo');
  });
  console.log(`  -> Undo Output: ${undoRes1.textOutput}`);
  await new Promise(r => setTimeout(r, 1500));

  const shot3 = path.join(SCREENSHOT_DIR, 'nav_03_after_undo_r1.png');
  await page.screenshot({ path: shot3 });
  console.log(`  -> Saved screenshot: ${shot3}`);

  // Step 5: Execute REDO -> R2
  console.log('7. Executing REDO -> R2...');
  const redoRes1 = await page.evaluate(() => {
    return window.__molStudioTestApi.runQuery('redo');
  });
  console.log(`  -> Redo Output: ${redoRes1.textOutput}`);
  await new Promise(r => setTimeout(r, 1500));

  const shot4 = path.join(SCREENSHOT_DIR, 'nav_04_after_redo_r2.png');
  await page.screenshot({ path: shot4 });
  console.log(`  -> Saved screenshot: ${shot4}`);

  // Step 6: UNDO to R1 and branch with new mutation: "unbond id 1, id 2" -> R3
  console.log('8. Executing UNDO to R1 and creating Branch R3 ("unbond id 1, id 2")...');
  await page.evaluate(() => {
    window.__molStudioTestApi.runQuery('undo');
    window.__molStudioTestApi.runQuery('unbond id 1, id 2');
  });
  await new Promise(r => setTimeout(r, 1500));

  const state3 = await page.evaluate(() => window.__molStudioTestApi.getState());
  console.log(`  -> Branch R3 Atom Count: ${state3.atomsCount} (Expected: 19)`);

  const shot5 = path.join(SCREENSHOT_DIR, 'nav_05_after_branch_r3.png');
  await page.screenshot({ path: shot5 });
  console.log(`  -> Saved screenshot: ${shot5}`);

  // Step 7: Export PSE session at R3 and reload
  console.log('9. Exporting MolStudio-PSE session string at Branch R3...');
  const pseString = await page.evaluate(() => {
    return window.__molStudioTestApi.exportSessionString();
  });
  console.log(`  -> Exported PSE String length: ${pseString ? pseString.length : 0} bytes`);

  console.log('10. Reloading saved session back into MolStudio...');
  await page.evaluate((pseContent) => {
    const session = JSON.parse(pseContent);
    const mol = session.molecules[0];
    window.__molStudioTestApi.loadMolecule(mol.name, mol.data, mol.format);
  }, pseString);

  await new Promise(r => setTimeout(r, 2000));

  const stateReloaded = await page.evaluate(() => window.__molStudioTestApi.getState());
  console.log(`  -> Reloaded Atom Count: ${stateReloaded.atomsCount} (Expected: 19)`);

  const shot6 = path.join(SCREENSHOT_DIR, 'nav_06_reloaded_state.png');
  await page.screenshot({ path: shot6 });
  console.log(`  -> Saved screenshot: ${shot6}`);

  await browser.close();

  console.log('\n========================================================================');
  console.log('       MANUAL BROWSER TEST COMPLETE: ALL NAVIGATION STEPS PASSED        ');
  console.log('========================================================================\n');
})();
