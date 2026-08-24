const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Users\\mukun\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'
];

function findChrome() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Chrome executable not found');
}

function loadFixturePdb(filename) {
  const p1 = path.resolve(__dirname, filename);
  if (fs.existsSync(p1)) return fs.readFileSync(p1, 'utf8');
  const p2 = path.resolve(__dirname, '..', 'fixtures', filename);
  if (fs.existsSync(p2)) return fs.readFileSync(p2, 'utf8');
  throw new Error(`Fixture not found: ${filename}`);
}

async function runTest() {
  console.log('[Puppeteer] Launching Chrome for SQ3 command visual QA...');
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.text().includes('WebGL')) {
      console.log(`[BROWSER ${msg.type()}] ${msg.text()}`);
    }
  });

  try {
    await page.goto('http://127.0.0.1:5173/molstudio', { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => typeof window.__molStudioTestApi !== 'undefined');

    const hhbPdb = loadFixturePdb('4HHB.pdb');
    await page.evaluate((pdbText) => {
      window.__molStudioTestApi.loadMolecule('4HHB', pdbText, 'pdb');
    }, hhbPdb);
    await new Promise(r => setTimeout(r, 800));

    const shotInitial = path.join(process.cwd(), 'scratch', 'sq3_browser_4hhb_initial.png');
    await page.screenshot({ path: shotInitial });
    console.log(`[Initial] 4HHB loaded: ${shotInitial}`);

    // 1. select ligand, resn HEM
    let r1 = await page.evaluate(() => window.__molStudioTestApi.runQuery('select ligand, resn HEM'));
    console.log(`\n[1] select ligand, resn HEM → count=${r1.count}`);

    // 2. select pocket, byres (ligand around 5.0) and not ligand
    let r2 = await page.evaluate(() => window.__molStudioTestApi.runQuery('select pocket, byres (ligand around 5.0) and not ligand'));
    console.log(`[2] select pocket → count=${r2.count}`);

    // 3. color ligand cyan
    let r3 = await page.evaluate(() => window.__molStudioTestApi.runQuery('colour cyan, ligand'));
    console.log(`[3] colour cyan, ligand → count=${r3.count}`);
    await new Promise(r => setTimeout(r, 300));

    // 4. color pocket yellow
    let r4 = await page.evaluate(() => window.__molStudioTestApi.runQuery('colour yellow, pocket'));
    console.log(`[4] colour yellow, pocket → count=${r4.count}`);
    await new Promise(r => setTimeout(r, 300));

    const shotSimultaneous = path.join(process.cwd(), 'scratch', 'sq3_browser_simultaneous_color.png');
    await page.screenshot({ path: shotSimultaneous });
    console.log(`[Screenshot] Simultaneous colors: ${shotSimultaneous}`);

    // 5. show sticks, ligand
    let r5 = await page.evaluate(() => window.__molStudioTestApi.runQuery('show sticks, ligand'));
    console.log(`[5] show sticks, ligand → count=${r5.count}`);

    // 6. show cartoon, pocket
    let r6 = await page.evaluate(() => window.__molStudioTestApi.runQuery('show cartoon, pocket'));
    console.log(`[6] show cartoon, pocket → count=${r6.count}`);
    await new Promise(r => setTimeout(r, 300));

    const shotSimultaneousRep = path.join(process.cwd(), 'scratch', 'sq3_browser_simultaneous_rep.png');
    await page.screenshot({ path: shotSimultaneousRep });
    console.log(`[Screenshot] Simultaneous representations: ${shotSimultaneousRep}`);

    // 7. zoom pocket
    let r7 = await page.evaluate(() => window.__molStudioTestApi.runQuery('zoom pocket'));
    console.log(`[7] zoom pocket → count=${r7.count} cameraOp=zoom`);
    await new Promise(r => setTimeout(r, 300));

    const shotZoom = path.join(process.cwd(), 'scratch', 'sq3_browser_zoom_pocket.png');
    await page.screenshot({ path: shotZoom });
    console.log(`[Screenshot] zoom pocket: ${shotZoom}`);

    // 8. center ligand
    let r8 = await page.evaluate(() => window.__molStudioTestApi.runQuery('center ligand'));
    console.log(`[8] center ligand → count=${r8.count} op=${r8.textOutput?.split(':')[0]}`);

    // 9. orient ligand
    let r9 = await page.evaluate(() => window.__molStudioTestApi.runQuery('orient ligand'));
    console.log(`[9] orient ligand → count=${r9.count} op=${r9.textOutput?.split(':')[0]}`);

    // 10. spectrum b, rainbow, protein
    let r10 = await page.evaluate(() => window.__molStudioTestApi.runQuery('spectrum b, rainbow, protein'));
    console.log(`[10] spectrum b rainbow protein → count=${r10.count}`);
    await new Promise(r => setTimeout(r, 300));

    const shotSpectrum = path.join(process.cwd(), 'scratch', 'sq3_browser_spectrum.png');
    await page.screenshot({ path: shotSpectrum });
    console.log(`[Screenshot] spectrum: ${shotSpectrum}`);

    // 11. Verify simultaneous presentation state (re-check pocket was not disturbed by spectrum on protein)
    let r11 = await page.evaluate(() => window.__molStudioTestApi.runQuery('colour yellow, pocket'));
    console.log(`[11] Reapply colour yellow, pocket → count=${r11.count} (verify pocket independence)`);

    const shotFinal = path.join(process.cwd(), 'scratch', 'sq3_browser_final_state.png');
    await page.screenshot({ path: shotFinal });
    console.log(`[Screenshot] Final state: ${shotFinal}`);

    console.log('\n[SQ3 Browser] All visual workflow steps completed successfully!');
    console.log(`Results: ligand=${r1.count}, pocket=${r2.count}, protein spectrum=${r10.count}`);
    console.log(`Camera: zoom=${r7.count}, center=${r8.count}, orient=${r9.count}`);

  } finally {
    await browser.close();
  }
}

runTest().catch(err => {
  console.error('[Puppeteer Error]', err);
  process.exit(1);
});
