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
  console.log('[Puppeteer] Launching Chrome for SQ2 command visual QA...');
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

    console.log('\n--- 1. Initial 4HHB Load ---');
    const shotInitial = path.join(process.cwd(), 'scratch', 'sq2_browser_4hhb_initial.png');
    await page.screenshot({ path: shotInitial });
    console.log(`[Puppeteer] Initial screenshot saved: ${shotInitial}`);

    // Workflow Step 1: select ligand, resn HEM
    console.log('\n--- 2. Command: select ligand, resn HEM ---');
    let r1 = await page.evaluate(() => window.__molStudioTestApi.runQuery('select ligand, resn HEM'));
    console.log('Result:', r1);
    await new Promise(r => setTimeout(r, 500));

    // Workflow Step 2: show sticks, ligand
    console.log('\n--- 3. Command: show sticks, ligand ---');
    let r2 = await page.evaluate(() => window.__molStudioTestApi.runQuery('show sticks, ligand'));
    console.log('Result:', r2);
    await new Promise(r => setTimeout(r, 500));

    // Workflow Step 3: colour cyan, ligand
    console.log('\n--- 4. Command: colour cyan, ligand ---');
    let r3 = await page.evaluate(() => window.__molStudioTestApi.runQuery('colour cyan, ligand'));
    console.log('Result:', r3);
    await new Promise(r => setTimeout(r, 500));
    const shotLigCyan = path.join(process.cwd(), 'scratch', 'sq2_browser_ligand_cyan.png');
    await page.screenshot({ path: shotLigCyan });
    console.log(`[Puppeteer] Screenshot saved: ${shotLigCyan}`);

    // Workflow Step 4: select pocket, byres (ligand around 5.0) and not ligand
    console.log('\n--- 5. Command: select pocket, byres (ligand around 5.0) and not ligand ---');
    let r4 = await page.evaluate(() => window.__molStudioTestApi.runQuery('select pocket, byres (ligand around 5.0) and not ligand'));
    console.log('Result:', r4);
    await new Promise(r => setTimeout(r, 500));

    // Workflow Step 5: colour yellow, pocket
    console.log('\n--- 6. Command: colour yellow, pocket ---');
    let r5 = await page.evaluate(() => window.__molStudioTestApi.runQuery('colour yellow, pocket'));
    console.log('Result:', r5);
    await new Promise(r => setTimeout(r, 500));
    const shotPocketYellow = path.join(process.cwd(), 'scratch', 'sq2_browser_pocket_yellow.png');
    await page.screenshot({ path: shotPocketYellow });
    console.log(`[Puppeteer] Screenshot saved: ${shotPocketYellow}`);

    // Workflow Step 6: zoom pocket
    console.log('\n--- 7. Command: zoom pocket ---');
    let r6 = await page.evaluate(() => window.__molStudioTestApi.runQuery('zoom pocket'));
    console.log('Result:', r6);
    await new Promise(r => setTimeout(r, 500));
    const shotZoomPocket = path.join(process.cwd(), 'scratch', 'sq2_browser_zoom_pocket.png');
    await page.screenshot({ path: shotZoomPocket });
    console.log(`[Puppeteer] Screenshot saved: ${shotZoomPocket}`);

    // Workflow Step 7: Chained command sequence: show cartoon, protein; color green, protein; zoom ligand
    console.log('\n--- 8. Chained Sequence: show cartoon, protein; color green, protein; zoom ligand ---');
    let r7 = await page.evaluate(() => window.__molStudioTestApi.runQuery('show cartoon, protein; color green, protein; zoom ligand'));
    console.log('Result:', r7);
    await new Promise(r => setTimeout(r, 500));
    const shotChained = path.join(process.cwd(), 'scratch', 'sq2_browser_chained_workflow.png');
    await page.screenshot({ path: shotChained });
    console.log(`[Puppeteer] Screenshot saved: ${shotChained}`);

    console.log('\n[Puppeteer] SQ2 Browser visual verification completed successfully!');
  } finally {
    await browser.close();
  }
}

runTest().catch(err => {
  console.error('[Puppeteer Error]', err);
  process.exit(1);
});
