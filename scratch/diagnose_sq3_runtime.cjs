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

async function runDiagnostic() {
  console.log('============================================================');
  console.log('SQ3.5 RUNTIME STABILITY & BROWSER DIAGNOSTIC');
  console.log('============================================================\n');

  const errors = [];
  const warnings = [];
  const pageErrors = [];

  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    if (type === 'error') {
      errors.push({ type: 'console.error', text, location: msg.location() });
      console.log(`[BROWSER ERROR] ${text}`);
    } else if (type === 'warning') {
      warnings.push({ type: 'console.warn', text });
    }
  });

  page.on('pageerror', err => {
    pageErrors.push({ type: 'pageerror', message: err.message, stack: err.stack });
    console.error(`[UNCAUGHT PAGE ERROR] ${err.message}\n${err.stack}`);
  });

  try {
    // 1. Fresh application load
    console.log('[Step 1] Fresh application load to /');
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle0' });
    await page.screenshot({ path: path.join(process.cwd(), 'scratch', 'sq3_diag_01_landing.png') });

    // 2. Open MolStudio
    console.log('[Step 2] Navigate to /molstudio');
    await page.goto('http://127.0.0.1:5173/molstudio', { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => typeof window.__molStudioTestApi !== 'undefined', { timeout: 10000 });
    await page.screenshot({ path: path.join(process.cwd(), 'scratch', 'sq3_diag_02_molstudio_empty.png') });

    // 3. Browser refresh
    console.log('[Step 3] Browser refresh on /molstudio');
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction(() => typeof window.__molStudioTestApi !== 'undefined', { timeout: 10000 });
    await page.screenshot({ path: path.join(process.cwd(), 'scratch', 'sq3_diag_03_molstudio_refresh.png') });

    // 4. Load 4HHB
    console.log('[Step 4] Load 4HHB');
    const hhbPdb = loadFixturePdb('4HHB.pdb');
    await page.evaluate((pdbText) => {
      window.__molStudioTestApi.loadMolecule('4HHB', pdbText, 'pdb');
    }, hhbPdb);
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: path.join(process.cwd(), 'scratch', 'sq3_diag_04_4hhb_loaded.png') });

    // 5. Load 4DJW
    console.log('[Step 5] Load 4DJW');
    const djwPdb = loadFixturePdb('4DJW.pdb');
    await page.evaluate((pdbText) => {
      window.__molStudioTestApi.loadMolecule('4DJW', pdbText, 'pdb');
    }, djwPdb);
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: path.join(process.cwd(), 'scratch', 'sq3_diag_05_4djw_loaded.png') });

    // Reload 4HHB for full command workflow
    console.log('[Step 6] Reload 4HHB for SQ3 command workflow');
    await page.evaluate((pdbText) => {
      window.__molStudioTestApi.loadMolecule('4HHB', pdbText, 'pdb');
    }, hhbPdb);
    await new Promise(r => setTimeout(r, 800));

    // 6. Execute SQ3 commands sequence
    const commands = [
      'select ligand, resn HEM',
      'select pocket, byres (ligand around 5.0) and not ligand',
      'colour cyan, ligand',
      'colour yellow, pocket',
      'show sticks, ligand',
      'show cartoon, pocket',
      'spectrum b, rainbow, protein',
      'zoom pocket',
      'center ligand',
      'orient ligand'
    ];

    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      console.log(`[Step 6.${i + 1}] Executing: ${cmd}`);
      const res = await page.evaluate((c) => window.__molStudioTestApi.runQuery(c), cmd);
      console.log(`         Result: count=${res.count}, textOutput="${res.textOutput || ''}"`);
      await new Promise(r => setTimeout(r, 300));
    }
    await page.screenshot({ path: path.join(process.cwd(), 'scratch', 'sq3_diag_06_after_commands.png') });

    // 7. Navigate away and return
    console.log('[Step 7] Navigate away to / and return to /molstudio');
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle0' });
    await page.goto('http://127.0.0.1:5173/molstudio', { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => typeof window.__molStudioTestApi !== 'undefined', { timeout: 10000 });
    await page.screenshot({ path: path.join(process.cwd(), 'scratch', 'sq3_diag_07_nav_return.png') });

    // 8. Refresh again
    console.log('[Step 8] Refresh again');
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction(() => typeof window.__molStudioTestApi !== 'undefined', { timeout: 10000 });
    await page.screenshot({ path: path.join(process.cwd(), 'scratch', 'sq3_diag_08_final_refresh.png') });

    console.log('\n============================================================');
    console.log('DIAGNOSTIC SUMMARY');
    console.log('============================================================');
    console.log(`Total console errors: ${errors.length}`);
    console.log(`Total page errors / unhandled exceptions: ${pageErrors.length}`);

    if (pageErrors.length > 0) {
      console.log('\nPAGE ERRORS DETECTED:');
      pageErrors.forEach((e, idx) => {
        console.log(`[${idx + 1}] ${e.message}\n${e.stack}\n`);
      });
    }

    if (errors.length > 0) {
      console.log('\nCONSOLE ERRORS:');
      errors.forEach((e, idx) => {
        console.log(`[${idx + 1}] ${e.text}`);
      });
    }

    console.log('\nAll diagnostic steps completed successfully!');

  } catch (err) {
    console.error('\n[DIAGNOSTIC FAILED]', err);
    await page.screenshot({ path: path.join(process.cwd(), 'scratch', 'sq3_diag_error.png') });
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runDiagnostic();
