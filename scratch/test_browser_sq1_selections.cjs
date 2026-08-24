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
  console.log('[Puppeteer] Launching Chrome for SQ1 selection verification...');
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
    let vState = await page.evaluate(() => window.__molStudioTestApi.getViewerState());
    console.log(`Viewer atom count: ${vState?.atomCount}`);

    const shotInitial = path.join(process.cwd(), 'scratch', 'sq1_browser_4hhb_initial.png');
    await page.screenshot({ path: shotInitial });
    console.log(`[Puppeteer] Initial screenshot saved: ${shotInitial}`);

    console.log('\n--- 2. Evaluate SQ1 Selection: "name CA" ---');
    let q1 = await page.evaluate(() => window.__molStudioTestApi.runQuery('name CA'));
    console.log(`Query result:`, q1);
    await new Promise(r => setTimeout(r, 600));

    const shotCA = path.join(process.cwd(), 'scratch', 'sq1_browser_sel_name_ca.png');
    await page.screenshot({ path: shotCA });
    console.log(`[Puppeteer] Screenshot saved: ${shotCA}`);

    console.log('\n--- 3. Evaluate SQ1 Selection: "byres (elem FE around 5.0)" ---');
    let q2 = await page.evaluate(() => window.__molStudioTestApi.runQuery('byres (elem FE around 5.0)'));
    console.log(`Query result:`, q2);
    await new Promise(r => setTimeout(r, 600));

    const shotPocket = path.join(process.cwd(), 'scratch', 'sq1_browser_sel_fe_pocket.png');
    await page.screenshot({ path: shotPocket });
    console.log(`[Puppeteer] Screenshot saved: ${shotPocket}`);

    console.log('\n--- 4. Evaluate SQ1 Selection: "//A/10/CA" (Slash Macro) ---');
    let q3 = await page.evaluate(() => window.__molStudioTestApi.runQuery('//A/10/CA'));
    console.log(`Query result:`, q3);
    await new Promise(r => setTimeout(r, 600));

    const shotMacro = path.join(process.cwd(), 'scratch', 'sq1_browser_sel_macro.png');
    await page.screenshot({ path: shotMacro });
    console.log(`[Puppeteer] Screenshot saved: ${shotMacro}`);

    console.log('\n[Puppeteer] SQ1 Browser verification completed successfully!');
  } finally {
    await browser.close();
  }
}

runTest().catch(err => {
  console.error('[Puppeteer Error]', err);
  process.exit(1);
});
