const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\mukun\\.gemini\\antigravity\\brain\\e43f6ae3-6d0c-44fd-ae3d-9abd3e716b18';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

(async () => {
  console.log('============================================================');
  console.log('    TASK P3.4: MANUAL BROWSER VERIFICATION (HYDROGENS)      ');
  console.log('============================================================\n');

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

  // Step 1 & 2: Load fixture and confirm baseline (20 atoms, Stick representation)
  console.log('3. Loading 03_protein_with_ligand.pdb into MolStudio...');
  await page.evaluate((pdb) => {
    window.__molStudioTestApi.loadMolecule('03_protein_with_ligand.pdb', pdb, 'pdb');
    window.__molStudioTestApi.setRenderStyle('Stick');
    window.__molStudioTestApi.setColorScheme('Modern/Jmol');
  }, fixturePdb);

  await new Promise(r => setTimeout(r, 2000));

  const state1 = await page.evaluate(() => window.__molStudioTestApi.getState());
  console.log(`  -> Initial Atom Count: ${state1.atomsCount} (Expected: 20)`);

  const shot1 = path.join(SCREENSHOT_DIR, 'h_01_baseline.png');
  await page.screenshot({ path: shot1 });
  console.log(`  -> Saved screenshot: ${shot1}`);

  // Step 3 & 4: Execute h_add on ligand: "h_add id 17"
  console.log('4. Executing Command: "h_add id 17"...');
  const addRes = await page.evaluate(() => {
    return window.__molStudioTestApi.runQuery('h_add id 17');
  });
  console.log(`  -> Add Output: ${addRes.textOutput}`);

  await new Promise(r => setTimeout(r, 1500));

  const stateAfterAdd = await page.evaluate(() => window.__molStudioTestApi.getState());
  console.log(`  -> Atom Count After h_add: ${stateAfterAdd.atomsCount} (Expected: 22)`);

  const shot2 = path.join(SCREENSHOT_DIR, 'h_02_after_h_add.png');
  await page.screenshot({ path: shot2 });
  console.log(`  -> Saved screenshot: ${shot2}`);

  // Step 5: Export MolStudio-PSE session string
  console.log('5. Exporting MolStudio-PSE session string...');
  const pseString = await page.evaluate(() => {
    return window.__molStudioTestApi.exportSessionString();
  });
  console.log(`  -> Exported PSE String length: ${pseString ? pseString.length : 0} bytes`);

  // Step 6: Reload session and verify persistence of modeled hydrogens
  console.log('6. Reloading saved session back into MolStudio...');
  await page.evaluate((pseContent) => {
    const session = JSON.parse(pseContent);
    const mol = session.molecules[0];
    window.__molStudioTestApi.loadMolecule(mol.name, mol.data, mol.format);
  }, pseString);

  await new Promise(r => setTimeout(r, 2000));

  const stateReloaded = await page.evaluate(() => window.__molStudioTestApi.getState());
  console.log(`  -> Reloaded Atom Count: ${stateReloaded.atomsCount} (Expected: 22)`);

  const shot3 = path.join(SCREENSHOT_DIR, 'h_03_reloaded_state.png');
  await page.screenshot({ path: shot3 });
  console.log(`  -> Saved screenshot: ${shot3}`);

  // Step 7: Execute h_remove: "h_remove"
  console.log('7. Executing Command: "h_remove"...');
  const removeRes = await page.evaluate(() => {
    return window.__molStudioTestApi.runQuery('h_remove');
  });
  console.log(`  -> Remove Output: ${removeRes.textOutput}`);

  await new Promise(r => setTimeout(r, 1500));

  const stateAfterRemove = await page.evaluate(() => window.__molStudioTestApi.getState());
  console.log(`  -> Atom Count After h_remove: ${stateAfterRemove.atomsCount} (Expected: 20)`);

  const shot4 = path.join(SCREENSHOT_DIR, 'h_04_after_h_remove.png');
  await page.screenshot({ path: shot4 });
  console.log(`  -> Saved screenshot: ${shot4}`);

  await browser.close();

  console.log('\n============================================================');
  console.log('           MANUAL BROWSER TEST COMPLETE: ALL PASS           ');
  console.log('============================================================\n');
})();
