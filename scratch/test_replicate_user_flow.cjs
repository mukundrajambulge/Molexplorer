/**
 * test_replicate_user_flow.cjs
 * Reproduces the user's exact sequence on 4HHB and inspects canvas visibility.
 */

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
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`[BROWSER ${msg.type()}] ${msg.text()}`);
  });

  try {
    await page.goto('http://127.0.0.1:5173/molstudio', { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => typeof window.__molStudioTestApi !== 'undefined');

    const hhbPdb = loadFixturePdb('4HHB.pdb');
    await page.evaluate((pdbText) => {
      window.__molStudioTestApi.loadMolecule('4HHB', pdbText, 'pdb');
    }, hhbPdb);
    await new Promise(r => setTimeout(r, 600));

    console.log('\n--- 1. Initial 4HHB Load ---');
    let vState = await page.evaluate(() => window.__molStudioTestApi.getViewerState());
    console.log(`Viewer atom count: ${vState?.atomCount}`);

    console.log('\n--- 2. Create Named Selection "ligand" ---');
    let q1 = await page.evaluate(() => window.__molStudioTestApi.runQuery('select ligand, resn HEM'));
    console.log(`select ligand result: count=${q1.count}, text="${q1.textOutput}"`);

    console.log('\n--- 3. Create Named Selection "pocket" ---');
    let q2 = await page.evaluate(() => window.__molStudioTestApi.runQuery('select pocket, byres ligand around 4'));
    console.log(`select pocket result: count=${q2.count}, text="${q2.textOutput}"`);

    console.log('\n--- 4. Run "show sticks, ligand" ---');
    let q3 = await page.evaluate(() => window.__molStudioTestApi.runQuery('show sticks, ligand'));
    console.log(`show sticks result: count=${q3.count}, text="${q3.textOutput}"`);

    console.log('\n--- 5. Run "colour green, pocket" ---');
    try {
      let q4 = await page.evaluate(() => window.__molStudioTestApi.runQuery('colour green, pocket'));
      console.log(`colour green result: count=${q4.count}, text="${q4.textOutput}"`);
    } catch (err) {
      console.log(`colour green caught error: ${err.message}`);
    }

    console.log('\n--- 6. Run "color cyan, ligand" ---');
    try {
      let q5 = await page.evaluate(() => window.__molStudioTestApi.runQuery('color cyan, ligand'));
      console.log(`color cyan result: count=${q5.count}, text="${q5.textOutput}"`);
    } catch (err) {
      console.log(`color cyan caught error: ${err.message}`);
    }

    await new Promise(r => setTimeout(r, 600));
    const ssPath = path.resolve(__dirname, 'sq_v0_replicate_user_sequence.png');
    await page.screenshot({ path: ssPath });
    console.log(`Screenshot saved: ${ssPath}`);

  } finally {
    await browser.close();
  }
}

runTest();
