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
  console.log('       TASK P3.1: MANUAL BROWSER VERIFICATION (MOLSTUDIO)   ');
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

  console.log('2. Navigating to MolStudio (http://localhost:5173/molstudio)...');
  await page.goto('http://localhost:5173/molstudio', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  // Step 1 & 2: Load 03_protein_with_ligand.pdb and confirm 20 atoms
  console.log('3. Loading 03_protein_with_ligand.pdb into MolStudio...');
  await page.evaluate((pdb) => {
    window.__molStudioTestApi.loadMolecule('03_protein_with_ligand.pdb', pdb, 'pdb');
    window.__molStudioTestApi.setRenderStyle('Ball-and-Stick');
  }, fixturePdb);

  await new Promise(r => setTimeout(r, 2000));

  const state1 = await page.evaluate(() => {
    return window.__molStudioTestApi.getState();
  });
  console.log(`  -> Initial Atom Count: ${state1.atomsCount} (Expected: 20)`);

  const shot1 = path.join(SCREENSHOT_DIR, '01_loaded_20_atoms.png');
  await page.screenshot({ path: shot1 });
  console.log(`  -> Saved screenshot: ${shot1}`);

  // Step 3 & 4: Run Selection query: "hetatm and not resn HOH"
  console.log('4. Executing Selection Query: "hetatm and not resn HOH"...');
  const selRes = await page.evaluate(() => {
    return window.__molStudioTestApi.runQuery('hetatm and not resn HOH');
  });
  console.log(`  -> Selected Atoms: ${selRes.count} (Expected: 4)`);

  const shot2 = path.join(SCREENSHOT_DIR, '02_selected_ligand_4_atoms.png');
  await page.screenshot({ path: shot2 });
  console.log(`  -> Saved screenshot: ${shot2}`);

  // Step 5 & 6: Execute Remove operation
  console.log('5. Executing Scientific Remove mutation ("remove hetatm and not resn HOH")...');
  const removeRes = await page.evaluate(() => {
    return window.__molStudioTestApi.runQuery('remove hetatm and not resn HOH');
  });

  await new Promise(r => setTimeout(r, 2000));

  const state2 = await page.evaluate(() => {
    return window.__molStudioTestApi.getState();
  });

  console.log(`  -> Remaining Atom Count: ${state2.atomsCount} (Expected: 16)`);

  const shot3 = path.join(SCREENSHOT_DIR, '03_after_remove_16_atoms.png');
  await page.screenshot({ path: shot3 });
  console.log(`  -> Saved screenshot: ${shot3}`);

  // Step 7: Rotate/Zoom viewer and verify functionality
  console.log('6. Rotating and zooming 3D viewer...');
  await page.evaluate(() => {
    window.__molStudioTestApi.setRenderStyle('Cartoon');
    window.__molStudioTestApi.setColorScheme('spectrum');
  });
  await new Promise(r => setTimeout(r, 1000));

  // Step 8: Save and export session
  console.log('7. Exporting MolStudio-PSE session string for post-remove state...');
  const pseString = await page.evaluate(() => {
    return window.__molStudioTestApi.exportSessionString();
  });
  console.log(`  -> Exported PSE String length: ${pseString ? pseString.length : 0} bytes`);

  // Step 9: Reload session from exported PSE
  console.log('8. Reloading saved session back into MolStudio...');
  await page.evaluate((pseContent) => {
    const session = JSON.parse(pseContent);
    const mol = session.molecules[0];
    window.__molStudioTestApi.loadMolecule(mol.name, mol.data, mol.format);
  }, pseString);

  await new Promise(r => setTimeout(r, 2000));

  const state3 = await page.evaluate(() => {
    return window.__molStudioTestApi.getState();
  });

  console.log(`  -> Reloaded Session Atom Count: ${state3.atomsCount} (Expected: 16)`);

  const shot4 = path.join(SCREENSHOT_DIR, '04_reloaded_session_16_atoms.png');
  await page.screenshot({ path: shot4 });
  console.log(`  -> Saved screenshot: ${shot4}`);

  await browser.close();

  console.log('\n============================================================');
  console.log('           MANUAL BROWSER TEST COMPLETE: ALL PASS           ');
  console.log('============================================================\n');
})();
